import { fftMagReal, getFFTPlan, nextPow2 } from './fft.js';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function movingAverage(src, window) {
    const n = src.length;
    if (window <= 1 || n === 0)
        return src;
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
function normalize01(src) {
    let max = 0;
    for (let i = 0; i < src.length; i++)
        max = Math.max(max, Math.abs(src[i]));
    if (max <= 0)
        return src;
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++)
        out[i] = src[i] / max;
    return out;
}
function onsetFromEnergy(energy) {
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
function onsetFromSpectralFlux(mono, sampleRate, envelopeHz, fftSize, window) {
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
            if (d > 0)
                s += d;
            prev[k] = mag[k];
        }
        flux[fi] = s;
    }
    return flux;
}
function bestTempoFromOnset(onset, envelopeHz, bpmMin, bpmMax) {
    // Autocorrelation on onset envelope.
    const n = onset.length;
    if (n < 8)
        return { bpm: 120, confidence: 0, bestLag: Math.max(1, Math.floor((envelopeHz * 60) / 120)) };
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
        }
        else if (sum > secondScore) {
            secondScore = sum;
        }
    }
    const bpm = clamp((60 * envelopeHz) / bestLag, bpmMin, bpmMax);
    const conf = bestScore <= 0 ? 0 : clamp((bestScore - secondScore) / Math.max(1e-9, bestScore), 0, 1);
    return { bpm, confidence: conf, bestLag };
}
function scoreOffset(onset, envelopeHz, periodSec, offsetSec, maxTimeSec) {
    const n = onset.length;
    let score = 0;
    // Sample onset energy at predicted beat times.
    for (let t = offsetSec; t <= maxTimeSec; t += periodSec) {
        const idx = Math.floor(t * envelopeHz);
        if (idx >= 0 && idx < n)
            score += onset[idx];
    }
    return score;
}
function bestOffsetFromOnset(onset, envelopeHz, periodSec, durationSec) {
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
function sampleOnsetAt(onset, envelopeHz, timeSec) {
    const idx = Math.floor(timeSec * envelopeHz);
    if (idx < 0 || idx >= onset.length)
        return 0;
    return onset[idx] ?? 0;
}
function tempoContrastScore(onset, envelopeHz, periodSec, offsetSec, durationSec, meter) {
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
function pickTempoCandidate(onset, envelopeHz, durationSec, meter, bestLag, bpmMin, bpmMax) {
    const minLag = Math.max(1, Math.floor((envelopeHz * 60) / bpmMax));
    const maxLag = Math.max(minLag + 1, Math.floor((envelopeHz * 60) / bpmMin));
    const candidates = [];
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
    const scored = [];
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
export function analyzeBeatsFromAudioBuffer(buffer, options = {}) {
    const bpmMin = Number.isFinite(options.bpmMin) ? options.bpmMin : 60;
    const bpmMax = Number.isFinite(options.bpmMax) ? options.bpmMax : 200;
    const envelopeHz = Number.isFinite(options.envelopeHz) ? options.envelopeHz : 100;
    const smoothMs = Number.isFinite(options.smoothMs) ? options.smoothMs : 80;
    const onsetMode = (options.onsetMode === 'spectralFlux') ? 'spectralFlux' : 'energy';
    const fftSize = Number.isFinite(options.fftSize) ? Math.max(64, Math.floor(options.fftSize)) : 1024;
    const fftWindow = options.fftWindow ?? 'hann';
    // Fixed 4/4 for now; keep field for future meter detection.
    const meter = Number.isFinite(options.meter) ? Math.max(1, Math.floor(options.meter)) : 4;
    const sr = buffer.sampleRate;
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const durationSec = buffer.duration;
    const hop = Math.max(1, Math.floor(sr / envelopeHz));
    const frames = Math.max(1, Math.floor(length / hop));
    // Cache channel arrays once (avoid repeated getChannelData calls inside loops)
    const ch = [];
    for (let c = 0; c < channels; c++)
        ch.push(buffer.getChannelData(c));
    // Precompute mono mix (used by both onset modes)
    const mono = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        let v = 0;
        for (let c = 0; c < channels; c++)
            v += ch[c][i] ?? 0;
        mono[i] = v / channels;
    }
    let onsetRaw;
    if (onsetMode === 'spectralFlux') {
        onsetRaw = onsetFromSpectralFlux(mono, sr, envelopeHz, fftSize, fftWindow);
    }
    else {
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
    const beats = [];
    for (let t = offsetSec; t < durationSec + 1e-6; t += periodSec)
        beats.push(t);
    const downbeats = [];
    for (let i = 0; i < beats.length; i += meter)
        downbeats.push(beats[i]);
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
export function getBeatState(analysis, timeSec, prevTimeSec) {
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
//# sourceMappingURL=beats.js.map