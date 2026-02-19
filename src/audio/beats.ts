import { fftMagReal, getFFTPlan, nextPow2, type FFTWindow } from './fft.js';

export type BeatDetectionOptions = {
  /** Min tempo to consider (BPM). */
  bpmMin?: number;
  /** Max tempo to consider (BPM). */
  bpmMax?: number;
  /** Envelope sampling rate (Hz). Higher = more detail, more CPU. */
  envelopeHz?: number;
  /** Moving-average smoothing window for onset envelope, in ms. */
  smoothMs?: number;
  /** If provided, forces a meter (beats per bar). Default 4 for now. */
  meter?: number;

  /**
   * Onset detector to use.
   * - 'energy': positive energy derivative (fast, decent)
   * - 'spectralFlux': STFT magnitude flux (better rhythmic sensitivity, heavier CPU)
   */
  onsetMode?: 'energy' | 'spectralFlux';

  /** FFT size used for spectral-flux onset (power of two recommended). */
  fftSize?: number;

  /** Window for spectral-flux STFT. */
  fftWindow?: FFTWindow;
};

export type BeatAnalysisResult = {
  bpm: number;
  /** 0..1-ish heuristic confidence (higher is better). */
  confidence: number;

  /** Beats per bar. Fixed 4 by default; reserved for future meter detection. */
  meter: number;

  /** Seconds between beats (derived from bpm). */
  periodSec: number;

  /** Estimated beat grid phase offset, in seconds (0 <= offset < periodSec). */
  offsetSec: number;

  /** Beat timestamps in seconds, starting at offsetSec. */
  beats: number[];

  /** Downbeat timestamps (every `meter` beats), starting at offsetSec. */
  downbeats: number[];

  /** Debug: onset envelope used for detection. */
  envelopeHz: number;
  envelope: Float32Array;
};

export type BeatState = {
  bpm: number;
  meter: number;
  periodSec: number;
  offsetSec: number;

  timeSec: number;

  /** 0-based beat index since offsetSec (clamped at 0). */
  beatIndex: number;
  /** 1..meter */
  beatInBar: number;
  /** 0-based bar index (clamped at 0). */
  barIndex: number;

  /** Continuous beat position (e.g. 12.25 means 25% through beat 13). */
  beatFloat: number;
  /** 0..1 */
  beatPhase: number;
  /** 0..1 */
  barPhase: number;

  nextBeatSec: number;
  nextDownbeatSec: number;

  /** True iff a beat boundary was crossed since prevTimeSec. */
  isBeatEdge: boolean;
  /** True iff a downbeat boundary was crossed since prevTimeSec. */
  isDownbeatEdge: boolean;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function movingAverage(src: Float32Array, window: number): Float32Array {
  const n = src.length;
  if (window <= 1 || n === 0) return src;
  const w = Math.max(1, Math.floor(window));
  const out = new Float32Array(n);
  let sum = 0;
  let count = 0;

  for (let i = 0; i < n; i++) {
    sum += src[i];
    count++;
    if (i - w >= 0) {
      sum -= src[i - w];
      count--;
    }
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

function normalize01(src: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < src.length; i++) max = Math.max(max, Math.abs(src[i]));
  if (max <= 0) return src;
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[i] / max;
  return out;
}

function onsetFromEnergy(energy: Float32Array): Float32Array {
  const n = energy.length;
  const out = new Float32Array(n);
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const v = energy[i];
    const d = v - prev;
    out[i] = d > 0 ? d : 0;
    prev = v;
  }
  return out;
}

function onsetFromSpectralFlux(
  mono: Float32Array,
  sampleRate: number,
  envelopeHz: number,
  fftSize: number,
  window: FFTWindow
): Float32Array {
  const hop = Math.max(1, Math.floor(sampleRate / envelopeHz));
  const frames = Math.max(1, Math.floor(mono.length / hop));

  const nfft = nextPow2(fftSize);
  const plan = getFFTPlan(nfft);
  const bins = (nfft >> 1) + 1;

  const frame = new Float32Array(nfft);
  const outRe = new Float32Array(nfft);
  const outIm = new Float32Array(nfft);
  const mag = new Float32Array(bins);
  const prev = new Float32Array(bins);

  const flux = new Float32Array(frames);

  for (let fi = 0; fi < frames; fi++) {
    const start = fi * hop;

    frame.fill(0);
    const copyN = Math.min(nfft, Math.max(0, mono.length - start));
    if (copyN > 0) {
      frame.set(mono.subarray(start, start + copyN), 0);
    }

    fftMagReal(frame, nfft, { window, plan, outMag: mag, outRe, outIm });

    let s = 0;
    for (let k = 0; k < bins; k++) {
      const d = mag[k] - prev[k];
      if (d > 0) s += d;
      prev[k] = mag[k];
    }
    flux[fi] = s;
  }

  return flux;
}

function bestTempoFromOnset(
  onset: Float32Array,
  envelopeHz: number,
  bpmMin: number,
  bpmMax: number
): { bpm: number; confidence: number; bestLag: number } {
  // Autocorrelation on onset envelope.
  const n = onset.length;
  if (n < 8) return { bpm: 120, confidence: 0, bestLag: Math.max(1, Math.floor((envelopeHz * 60) / 120)) };

  const minLag = Math.max(1, Math.floor((envelopeHz * 60) / bpmMax));
  const maxLag = Math.max(minLag + 1, Math.floor((envelopeHz * 60) / bpmMin));

  let bestLag = minLag;
  let bestScore = -1;
  let secondScore = -1;

  // Pre-normalize onset to reduce amplitude sensitivity.
  const x = normalize01(onset);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    // Skip a bit at ends; simple dot product.
    for (let i = 0; i + lag < n; i++) {
      sum += x[i] * x[i + lag];
    }
    if (sum > bestScore) {
      secondScore = bestScore;
      bestScore = sum;
      bestLag = lag;
    } else if (sum > secondScore) {
      secondScore = sum;
    }
  }

  const bpm = clamp((60 * envelopeHz) / bestLag, bpmMin, bpmMax);
  const conf = bestScore <= 0 ? 0 : clamp((bestScore - secondScore) / Math.max(1e-9, bestScore), 0, 1);
  return { bpm, confidence: conf, bestLag };
}

function scoreOffset(onset: Float32Array, envelopeHz: number, periodSec: number, offsetSec: number, maxTimeSec: number): number {
  const n = onset.length;
  let score = 0;

  // Sample onset energy at predicted beat times.
  for (let t = offsetSec; t <= maxTimeSec; t += periodSec) {
    const idx = Math.floor(t * envelopeHz);
    if (idx >= 0 && idx < n) score += onset[idx];
  }
  return score;
}

function bestOffsetFromOnset(onset: Float32Array, envelopeHz: number, periodSec: number, durationSec: number): number {
  // Coarse search across one period.
  const steps = 32;
  let best = 0;
  let bestScore = -1;

  const maxTimeSec = Math.min(durationSec, Math.max(0, durationSec - periodSec));

  for (let i = 0; i < steps; i++) {
    const off = (i / steps) * periodSec;
    const s = scoreOffset(onset, envelopeHz, periodSec, off, maxTimeSec);
    if (s > bestScore) {
      bestScore = s;
      best = off;
    }
  }

  // Small local refinement around the best coarse offset.
  const refineStep = periodSec / (steps * 4);
  for (let k = -8; k <= 8; k++) {
    const off = clamp(best + k * refineStep, 0, Math.max(0, periodSec - 1e-6));
    const s = scoreOffset(onset, envelopeHz, periodSec, off, maxTimeSec);
    if (s > bestScore) {
      bestScore = s;
      best = off;
    }
  }

  return best;
}

function sampleOnsetAt(onset: Float32Array, envelopeHz: number, timeSec: number): number {
  const idx = Math.floor(timeSec * envelopeHz);
  if (idx < 0 || idx >= onset.length) return 0;
  return onset[idx] ?? 0;
}

function tempoContrastScore(
  onset: Float32Array,
  envelopeHz: number,
  periodSec: number,
  offsetSec: number,
  durationSec: number,
  meter: number
): number {
  // Score favors tempos where predicted beats land on strong onsets
  // and the mid-beat positions are comparatively weaker.
  const beatsPerBar = Math.max(1, Math.floor(meter));

  let beatSum = 0;
  let beatCount = 0;
  let offSum = 0;
  let offCount = 0;
  let downSum = 0;
  let downCount = 0;

  const maxTimeSec = Math.min(durationSec, Math.max(0, durationSec - periodSec));
  let bi = 0;
  for (let t = offsetSec; t <= maxTimeSec; t += periodSec) {
    const vBeat = sampleOnsetAt(onset, envelopeHz, t);
    beatSum += vBeat;
    beatCount++;

    const vOff = sampleOnsetAt(onset, envelopeHz, t + periodSec * 0.5);
    offSum += vOff;
    offCount++;

    if ((bi % beatsPerBar) === 0) {
      downSum += vBeat;
      downCount++;
    }
    bi++;
  }

  const beatAvg = beatCount > 0 ? beatSum / beatCount : 0;
  const offAvg = offCount > 0 ? offSum / offCount : 0;
  const downAvg = downCount > 0 ? downSum / downCount : 0;

  // Weighted contrast: downbeats tend to be most salient.
  return (beatAvg - 0.6 * offAvg) + 0.5 * downAvg;
}

function pickTempoCandidate(
  onset: Float32Array,
  envelopeHz: number,
  durationSec: number,
  meter: number,
  bestLag: number,
  bpmMin: number,
  bpmMax: number
): { bpm: number; offsetSec: number } {
  const minLag = Math.max(1, Math.floor((envelopeHz * 60) / bpmMax));
  const maxLag = Math.max(minLag + 1, Math.floor((envelopeHz * 60) / bpmMin));

  const candidates: number[] = [];
  candidates.push(bestLag);
  candidates.push(bestLag * 2);
  candidates.push(Math.max(1, Math.floor(bestLag / 2)));

  // De-dupe and keep only within the search lag range.
  const unique = Array.from(new Set(candidates)).filter((lag) => lag >= minLag && lag <= maxLag);
  if (unique.length === 0) {
    const bpm = clamp((60 * envelopeHz) / bestLag, bpmMin, bpmMax);
    const periodSec = 60 / Math.max(1e-9, bpm);
    const offsetSec = bestOffsetFromOnset(onset, envelopeHz, periodSec, durationSec);
    return { bpm, offsetSec };
  }

  type Cand = { lag: number; bpm: number; periodSec: number; offsetSec: number; score: number };
  const scored: Cand[] = [];
  for (const lag of unique) {
    const bpm = clamp((60 * envelopeHz) / lag, bpmMin, bpmMax);
    const periodSec = 60 / Math.max(1e-9, bpm);
    const offsetSec = bestOffsetFromOnset(onset, envelopeHz, periodSec, durationSec);
    const score = tempoContrastScore(onset, envelopeHz, periodSec, offsetSec, durationSec, meter);
    scored.push({ lag, bpm, periodSec, offsetSec, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // If the top two are very close, prefer the slower tempo.
  if (scored.length >= 2) {
    const a = scored[0];
    const b = scored[1];
    const denom = Math.max(1e-9, Math.max(Math.abs(a.score), Math.abs(b.score)));
    const rel = Math.abs(a.score - b.score) / denom;
    if (rel < 0.02) {
      const slower = a.bpm <= b.bpm ? a : b;
      return { bpm: slower.bpm, offsetSec: slower.offsetSec };
    }
  }

  return { bpm: best.bpm, offsetSec: best.offsetSec };
}

export function analyzeBeatsFromAudioBuffer(
  buffer: AudioBuffer,
  options: BeatDetectionOptions = {}
): BeatAnalysisResult {
  const bpmMin = Number.isFinite(options.bpmMin) ? (options.bpmMin as number) : 60;
  const bpmMax = Number.isFinite(options.bpmMax) ? (options.bpmMax as number) : 200;
  const envelopeHz = Number.isFinite(options.envelopeHz) ? (options.envelopeHz as number) : 100;
  const smoothMs = Number.isFinite(options.smoothMs) ? (options.smoothMs as number) : 80;
  const onsetMode = (options.onsetMode === 'spectralFlux') ? 'spectralFlux' : 'energy';
  const fftSize = Number.isFinite(options.fftSize) ? Math.max(64, Math.floor(options.fftSize as number)) : 1024;
  const fftWindow: FFTWindow = options.fftWindow ?? 'hann';

  // Fixed 4/4 for now; keep field for future meter detection.
  const meter = Number.isFinite(options.meter) ? Math.max(1, Math.floor(options.meter as number)) : 4;

  const sr = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const durationSec = buffer.duration;

  const hop = Math.max(1, Math.floor(sr / envelopeHz));
  const frames = Math.max(1, Math.floor(length / hop));

  // Cache channel arrays once (avoid repeated getChannelData calls inside loops)
  const ch: Float32Array[] = [];
  for (let c = 0; c < channels; c++) ch.push(buffer.getChannelData(c));

  // Precompute mono mix (used by both onset modes)
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let v = 0;
    for (let c = 0; c < channels; c++) v += ch[c][i] ?? 0;
    mono[i] = v / channels;
  }

  let onsetRaw: Float32Array;
  if (onsetMode === 'spectralFlux') {
    onsetRaw = onsetFromSpectralFlux(mono, sr, envelopeHz, fftSize, fftWindow);
  } else {
    // RMS energy envelope
    const energy = new Float32Array(frames);
    for (let fi = 0; fi < frames; fi++) {
      const start = fi * hop;
      const end = Math.min(length, start + hop);

      let sumSq = 0;
      let count = 0;

      for (let i = start; i < end; i++) {
        const m = mono[i] ?? 0;
        sumSq += m * m;
        count++;
      }

      energy[fi] = count > 0 ? Math.sqrt(sumSq / count) : 0;
    }

    const energyNorm = normalize01(energy);
    onsetRaw = onsetFromEnergy(energyNorm);
  }

  const smoothWindow = Math.max(1, Math.round((smoothMs / 1000) * envelopeHz));
  const onsetSmooth = normalize01(movingAverage(onsetRaw, smoothWindow));

  const tempo = bestTempoFromOnset(onsetSmooth, envelopeHz, bpmMin, bpmMax);
  const picked = pickTempoCandidate(onsetSmooth, envelopeHz, durationSec, meter, tempo.bestLag, bpmMin, bpmMax);
  const periodSec = 60 / Math.max(1e-9, picked.bpm);
  const offsetSec = picked.offsetSec;

  const beats: number[] = [];
  for (let t = offsetSec; t < durationSec + 1e-6; t += periodSec) beats.push(t);

  const downbeats: number[] = [];
  for (let i = 0; i < beats.length; i += meter) downbeats.push(beats[i]);

  return {
    bpm: picked.bpm,
    confidence: tempo.confidence,
    meter,
    periodSec,
    offsetSec,
    beats,
    downbeats,
    envelopeHz,
    envelope: onsetSmooth
  };
}

export function getBeatState(
  analysis: BeatAnalysisResult,
  timeSec: number,
  prevTimeSec?: number
): BeatState {
  const bpm = analysis?.bpm ?? 120;
  const meter = analysis?.meter ?? 4;
  const periodSec = analysis?.periodSec ?? 0.5;
  const offsetSec = analysis?.offsetSec ?? 0;

  const t = Math.max(0, (Number.isFinite(timeSec) ? timeSec : 0) - offsetSec);
  const beatFloat = periodSec > 1e-9 ? t / periodSec : 0;

  const beatIndex = Math.max(0, Math.floor(beatFloat));
  const beatPhase = clamp(beatFloat - beatIndex, 0, 1);

  const barIndex = Math.max(0, Math.floor(beatIndex / Math.max(1, meter)));
  const beatInBar0 = ((beatIndex % meter) + meter) % meter;
  const beatInBar = beatInBar0 + 1;

  const beatsPerBar = Math.max(1, meter);
  const barFloat = beatFloat / beatsPerBar;
  const barPhase = clamp(barFloat - Math.floor(barFloat), 0, 1);

  const nextBeatSec = offsetSec + (beatIndex + 1) * periodSec;
  const nextDownbeatBeatIndex = (barIndex + 1) * beatsPerBar;
  const nextDownbeatSec = offsetSec + nextDownbeatBeatIndex * periodSec;

  let isBeatEdge = false;
  let isDownbeatEdge = false;
  if (typeof prevTimeSec === 'number' && Number.isFinite(prevTimeSec)) {
    const prevT = Math.max(0, prevTimeSec - offsetSec);
    const prevBeatIndex = Math.max(0, Math.floor(prevT / Math.max(1e-9, periodSec)));
    isBeatEdge = prevBeatIndex !== beatIndex;
    isDownbeatEdge = Math.floor(prevBeatIndex / beatsPerBar) !== barIndex;
  }

  return {
    bpm,
    meter,
    periodSec,
    offsetSec,
    timeSec: Number.isFinite(timeSec) ? timeSec : 0,
    beatIndex,
    beatInBar,
    barIndex,
    beatFloat,
    beatPhase,
    barPhase,
    nextBeatSec,
    nextDownbeatSec,
    isBeatEdge,
    isDownbeatEdge
  };
}
