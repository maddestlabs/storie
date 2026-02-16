export type SfxPresetName =
  | 'coin'
  | 'zap'
  | 'boom'
  | 'jump'
  | '1up'
  | 'lose'
  | 'hurt'
  | 'blip';

export interface PlaySfxOptions {
  volume?: number;
  when?: number; // seconds from now
}

export interface SfxHandle {
  stop: (when?: number) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function toSeed(seed: number | string | undefined): number {
  if (seed === undefined) return (Math.random() * 0xffffffff) >>> 0;
  if (typeof seed === 'number' && Number.isFinite(seed)) return seed >>> 0;
  const s = String(seed);
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randRange(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}

function randChoice<T>(rng: () => number, choices: readonly T[]): T {
  return choices[Math.floor(rng() * choices.length)]!;
}

function envAR(
  gainParam: AudioParam,
  t0: number,
  attack: number,
  release: number,
  peak: number
) {
  const a = Math.max(0.0005, attack);
  const r = Math.max(0.002, release);
  gainParam.cancelScheduledValues(t0);
  gainParam.setValueAtTime(0.00001, t0);
  gainParam.exponentialRampToValueAtTime(Math.max(0.00001, peak), t0 + a);
  gainParam.exponentialRampToValueAtTime(0.00001, t0 + a + r);
}

function envADSR(
  gainParam: AudioParam,
  t0: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  peak: number,
  hold: number
) {
  const a = Math.max(0.0005, attack);
  const d = Math.max(0.001, decay);
  const r = Math.max(0.002, release);
  const sus = clamp(sustain, 0.0, 1.0);
  const pk = Math.max(0.00001, peak);
  const tA = t0 + a;
  const tD = tA + d;
  const tH = tD + Math.max(0, hold);

  gainParam.cancelScheduledValues(t0);
  gainParam.setValueAtTime(0.00001, t0);
  gainParam.exponentialRampToValueAtTime(pk, tA);
  gainParam.exponentialRampToValueAtTime(Math.max(0.00001, pk * sus), tD);
  gainParam.setValueAtTime(Math.max(0.00001, pk * sus), tH);
  gainParam.exponentialRampToValueAtTime(0.00001, tH + r);
}

function scheduleFreqDrop(
  freqParam: AudioParam,
  t0: number,
  startHz: number,
  endHz: number,
  duration: number
) {
  const d = Math.max(0.01, duration);
  freqParam.cancelScheduledValues(t0);
  freqParam.setValueAtTime(Math.max(1, startHz), t0);
  freqParam.exponentialRampToValueAtTime(Math.max(1, endHz), t0 + d);
}

function createNoiseSource(
  ctx: AudioContext,
  duration: number,
  seed: number
): AudioBufferSourceNode {
  const frames = Math.max(1, Math.floor(duration * ctx.sampleRate));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rng = mulberry32(seed ^ 0x9e3779b9);

  for (let i = 0; i < frames; i++) {
    data[i] = rng() * 2 - 1;
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = false;
  return src;
}

function safeConnect(node: AudioNode, dest: AudioNode) {
  try {
    node.connect(dest);
  } catch {
    // no-op
  }
}

export function getSfxPresetNames(): SfxPresetName[] {
  return ['coin', 'zap', 'boom', 'jump', '1up', 'lose', 'hurt', 'blip'];
}

export function sfxSnippet(name: SfxPresetName, seed?: number | string, volume?: number): string {
  const seedPart = seed === undefined ? '' : `, ${JSON.stringify(seed)}`;
  const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
  return `audio.sfx.play(${JSON.stringify(name)}${seedPart}${optPart})`;
}

export function playSfx(
  ctx: AudioContext,
  name: SfxPresetName,
  seedIn?: number | string,
  options: PlaySfxOptions = {}
): SfxHandle {
  // Try to resume, but don’t fail if user gesture rules block it.
  ctx.resume().catch(() => {});

  const seed = toSeed(seedIn);
  const rng = mulberry32(seed);
  const t0 = ctx.currentTime + (options.when ?? 0);
  const vol = clamp(options.volume ?? 0.8, 0, 2);

  const outGain = ctx.createGain();
  outGain.gain.value = vol;
  safeConnect(outGain, ctx.destination);

  const nodesToStop: Array<{ stop: (t?: number) => void }> = [];

  const stopAll = (when: number = 0) => {
    const t = ctx.currentTime + when;
    for (const n of nodesToStop) {
      try {
        n.stop(t);
      } catch {
        // ignore
      }
    }
    try {
      outGain.gain.cancelScheduledValues(t);
      outGain.gain.setValueAtTime(outGain.gain.value, t);
      outGain.gain.exponentialRampToValueAtTime(0.00001, t + 0.03);
    } catch {
      // ignore
    }
  };

  const addOsc = (
    type: OscillatorType,
    freqHz: number,
    gain: number
  ): { osc: OscillatorNode; g: GainNode } => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = Math.max(1, freqHz);

    const g = ctx.createGain();
    g.gain.value = gain;

    safeConnect(osc, g);
    safeConnect(g, outGain);

    osc.start(t0);
    nodesToStop.push(osc);
    return { osc, g };
  };

  const addNoise = (duration: number, gain: number): { src: AudioBufferSourceNode; g: GainNode } => {
    const src = createNoiseSource(ctx, duration, seed);
    const g = ctx.createGain();
    g.gain.value = gain;
    safeConnect(src, g);
    safeConnect(g, outGain);
    src.start(t0);
    nodesToStop.push(src);
    return { src, g };
  };

  const addFilter = (
    input: AudioNode,
    type: BiquadFilterType,
    freqHz: number,
    q: number
  ): BiquadFilterNode => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = Math.max(10, freqHz);
    f.Q.value = Math.max(0.0001, q);
    safeConnect(input, f);
    return f;
  };

  // === Presets ===
  switch (name) {
    case 'blip': {
      const base = randRange(rng, 600, 1200);
      const type = randChoice(rng, ['square', 'triangle'] as const);
      const { osc, g } = addOsc(type, base, 1.0);
      envAR(g.gain, t0, randRange(rng, 0.002, 0.01), randRange(rng, 0.05, 0.12), 0.6);
      osc.stop(t0 + 0.2);
      break;
    }

    case 'coin': {
      const type = randChoice(rng, ['square', 'triangle'] as const);
      const f1 = randRange(rng, 900, 1400);
      const f2 = f1 * randRange(rng, 1.25, 1.7);

      const a = addOsc(type, f1, 1.0);
      const b = addOsc(type, f2, 0.8);

      envAR(a.g.gain, t0, 0.002, randRange(rng, 0.08, 0.16), 0.5);
      envAR(b.g.gain, t0, 0.002, randRange(rng, 0.06, 0.14), 0.4);

      a.osc.stop(t0 + 0.25);
      b.osc.stop(t0 + 0.25);
      break;
    }

    case 'jump': {
      const type = randChoice(rng, ['square', 'sawtooth', 'triangle'] as const);
      const start = randRange(rng, 250, 420);
      const end = start * randRange(rng, 1.8, 2.8);
      const dur = randRange(rng, 0.10, 0.18);

      const { osc, g } = addOsc(type, start, 1.0);
      scheduleFreqDrop(osc.frequency, t0, start, end, dur);
      envAR(g.gain, t0, 0.002, dur + 0.05, 0.55);
      osc.stop(t0 + dur + 0.12);
      break;
    }

    case 'zap': {
      const type = randChoice(rng, ['sawtooth', 'square'] as const);
      const start = randRange(rng, 900, 2200);
      const end = randRange(rng, 90, 260);
      const dur = randRange(rng, 0.08, 0.18);

      const { osc, g } = addOsc(type, start, 1.0);

      const filter = addFilter(g, 'lowpass', randRange(rng, 1200, 5000), randRange(rng, 0.3, 2.5));
      // Re-route: osc -> g, g -> filter -> out
      try {
        g.disconnect();
      } catch {}
      safeConnect(g, filter);
      safeConnect(filter, outGain);

      scheduleFreqDrop(osc.frequency, t0, start, end, dur);
      envAR(g.gain, t0, 0.001, dur + 0.06, 0.45);

      osc.stop(t0 + dur + 0.15);
      break;
    }

    case 'hurt': {
      const type = randChoice(rng, ['square', 'sawtooth'] as const);
      const start = randRange(rng, 380, 720);
      const end = randRange(rng, 80, 140);
      const dur = randRange(rng, 0.18, 0.28);

      const { osc, g } = addOsc(type, start, 1.0);
      scheduleFreqDrop(osc.frequency, t0, start, end, dur);

      // Add a short noise click for grit
      const noise = addNoise(0.12, 0.15);
      const nf = addFilter(noise.g, 'bandpass', randRange(rng, 1200, 2600), randRange(rng, 2, 8));
      try {
        noise.g.disconnect();
      } catch {}
      safeConnect(noise.g, nf);
      safeConnect(nf, outGain);

      envAR(g.gain, t0, 0.002, dur + 0.06, 0.55);
      envAR(noise.g.gain, t0, 0.001, 0.10, 0.18);

      osc.stop(t0 + dur + 0.18);
      noise.src.stop(t0 + 0.2);
      break;
    }

    case 'lose': {
      const type = randChoice(rng, ['square', 'triangle'] as const);
      const start = randRange(rng, 520, 900);
      const end = randRange(rng, 110, 200);
      const dur = randRange(rng, 0.35, 0.55);

      const { osc, g } = addOsc(type, start, 1.0);
      scheduleFreqDrop(osc.frequency, t0, start, end, dur);
      envADSR(g.gain, t0, 0.003, 0.12, 0.45, 0.18, 0.6, dur - 0.12);
      osc.stop(t0 + dur + 0.25);
      break;
    }

    case '1up': {
      const type = randChoice(rng, ['square', 'triangle'] as const);
      const base = randRange(rng, 440, 620);
      const intervals = [1.0, 1.26, 1.5, 2.0] as const; // roughly: unison, M3, P5, octave
      const stepDur = randRange(rng, 0.08, 0.11);

      const { osc, g } = addOsc(type, base, 1.0);
      envADSR(g.gain, t0, 0.002, 0.06, 0.8, 0.10, 0.5, stepDur * (intervals.length - 1));

      intervals.forEach((k, i) => {
        const t = t0 + i * stepDur;
        osc.frequency.setValueAtTime(Math.max(1, base * k), t);
      });

      osc.stop(t0 + stepDur * intervals.length + 0.12);
      break;
    }

    case 'boom': {
      const dur = randRange(rng, 0.45, 0.75);

      // Thump
      const thump = addOsc('sine', randRange(rng, 55, 90), 1.0);
      scheduleFreqDrop(thump.osc.frequency, t0, thump.osc.frequency.value, randRange(rng, 25, 40), dur * 0.6);
      envAR(thump.g.gain, t0, 0.002, dur, 0.65);
      thump.osc.stop(t0 + dur + 0.2);

      // Noise burst
      const noise = addNoise(dur, 0.25);
      const bp = addFilter(noise.g, 'bandpass', randRange(rng, 120, 380), randRange(rng, 0.7, 2.2));
      const lp = addFilter(bp, 'lowpass', randRange(rng, 800, 1800), randRange(rng, 0.2, 1.1));
      try {
        noise.g.disconnect();
      } catch {}
      safeConnect(noise.g, bp);
      safeConnect(bp, lp);
      safeConnect(lp, outGain);

      envAR(noise.g.gain, t0, 0.001, dur, 0.5);
      noise.src.stop(t0 + dur + 0.05);
      break;
    }

    default: {
      // Should be unreachable due to typing, but keep runtime safe.
      const { osc, g } = addOsc('square', 880, 1.0);
      envAR(g.gain, t0, 0.002, 0.09, 0.45);
      osc.stop(t0 + 0.2);
      break;
    }
  }

  return { stop: stopAll };
}
