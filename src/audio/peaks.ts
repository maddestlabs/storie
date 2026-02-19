export type PeakDetectionOptions = {
  /** Window size for RMS/envelope analysis. Typical: 10-20ms. */
  windowMs?: number;
  /** Smoothing window over the envelope. Typical: 80-150ms. */
  smoothMs?: number;
  /** Minimum time between detected peaks. Typical: 120-250ms. */
  minGapMs?: number;
  /**
   * Threshold multiplier relative to the envelope mean.
   * Higher = fewer peaks.
   */
  thresholdMul?: number;
  /**
   * Optional hard minimum threshold on envelope units (0..~1).
   * Useful to avoid noise floors.
   */
  minThreshold?: number;
  /**
   * How much to compress dynamic range before detection.
   * 1 = no compression. Typical: 1.5-3.
   */
  compressPow?: number;
  /**
   * Only consider peaks with prominence relative to local neighbors.
   * 0 disables. Typical: 0.02-0.08.
   */
  minProminence?: number;
};

export type PeakDetectionResult = {
  /** Peak timestamps (seconds), sorted ascending. */
  peaks: number[];
  /** Envelope sample rate (Hz). envelope[i] corresponds to i / envelopeHz seconds. */
  envelopeHz: number;
  /** Smoothed envelope (0..~1). */
  envelope: Float32Array;
  /** Threshold used for detection. */
  threshold: number;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function mean(arr: Float32Array): number {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i];
  return arr.length ? s / arr.length : 0;
}

function movingAverage(src: Float32Array, win: number): Float32Array {
  if (win <= 1) return src;
  const out = new Float32Array(src.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < src.length; i++) {
    sum += src[i];
    count++;
    if (i - win >= 0) {
      sum -= src[i - win];
      count--;
    }
    out[i] = sum / Math.max(1, count);
  }
  return out;
}

function getMonoChannelData(buffer: AudioBuffer): Float32Array {
  const ch = buffer.numberOfChannels;
  if (ch <= 1) return buffer.getChannelData(0);

  // Average channels into a fresh mono buffer.
  const len = buffer.length;
  const out = new Float32Array(len);
  for (let c = 0; c < ch; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < len; i++) out[i] += data[i];
  }
  const inv = 1 / ch;
  for (let i = 0; i < len; i++) out[i] *= inv;
  return out;
}

/**
 * Dependency-free peak detection for decoded audio.
 *
 * Pipeline:
 * 1) mono mixdown
 * 2) RMS envelope over short windows
 * 3) optional dynamic range compression
 * 4) smoothing (moving average)
 * 5) local maxima + adaptive threshold + min gap
 */
export function detectPeaksFromAudioBuffer(
  buffer: AudioBuffer,
  options: PeakDetectionOptions = {}
): PeakDetectionResult {
  const sampleRate = buffer.sampleRate;
  const windowMs = options.windowMs ?? 12;
  const smoothMs = options.smoothMs ?? 120;
  const minGapMs = options.minGapMs ?? 160;
  const thresholdMul = options.thresholdMul ?? 1.6;
  const minThreshold = options.minThreshold ?? 0.02;
  const compressPow = options.compressPow ?? 2;
  const minProminence = options.minProminence ?? 0.03;

  const mono = getMonoChannelData(buffer);

  const win = Math.max(16, Math.floor((windowMs / 1000) * sampleRate));
  const hop = win; // non-overlapping; fast and stable
  const frames = Math.max(1, Math.floor(mono.length / hop));
  const envelope = new Float32Array(frames);

  // RMS per window
  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    const end = Math.min(mono.length, start + win);
    let s = 0;
    for (let i = start; i < end; i++) {
      const v = mono[i];
      s += v * v;
    }
    const rms = Math.sqrt(s / Math.max(1, end - start));
    envelope[f] = rms;
  }

  // Normalize by max
  let max = 0;
  for (let i = 0; i < envelope.length; i++) max = Math.max(max, envelope[i]);
  const invMax = max > 0 ? 1 / max : 1;
  for (let i = 0; i < envelope.length; i++) envelope[i] *= invMax;

  // Mild compression to emphasize transients
  if (compressPow && Number.isFinite(compressPow) && compressPow !== 1) {
    const p = 1 / clamp(compressPow, 1, 10);
    for (let i = 0; i < envelope.length; i++) {
      envelope[i] = Math.pow(clamp(envelope[i], 0, 1), p);
    }
  }

  const smoothWin = Math.max(1, Math.floor((smoothMs / 1000) * (sampleRate / hop)));
  const smooth = movingAverage(envelope, smoothWin);

  const envMean = mean(smooth);
  const threshold = Math.max(minThreshold, envMean * thresholdMul);

  const minGapFrames = Math.max(1, Math.floor((minGapMs / 1000) * (sampleRate / hop)));
  const peaks: number[] = [];

  let lastPeakFrame = -Infinity;

  for (let i = 1; i < smooth.length - 1; i++) {
    const v = smooth[i];
    if (v < threshold) continue;

    // Local max
    if (!(v >= smooth[i - 1] && v > smooth[i + 1])) continue;

    // Prominence
    if (minProminence > 0) {
      const left = smooth[i - 1];
      const right = smooth[i + 1];
      const prom = v - Math.max(left, right);
      if (prom < minProminence) continue;
    }

    // Min gap: if too close, keep the stronger one
    if (i - lastPeakFrame < minGapFrames) {
      const prevIdx = peaks.length - 1;
      if (prevIdx >= 0) {
        const prevFrame = Math.round(peaks[prevIdx] * (sampleRate / hop));
        if (v > smooth[prevFrame]) {
          peaks[prevIdx] = i / (sampleRate / hop);
          lastPeakFrame = i;
        }
      }
      continue;
    }

    peaks.push(i / (sampleRate / hop));
    lastPeakFrame = i;
  }

  return {
    peaks,
    envelopeHz: sampleRate / hop,
    envelope: smooth,
    threshold
  };
}
