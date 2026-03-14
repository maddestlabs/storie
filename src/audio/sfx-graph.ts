export type SfxExpr =
  | number
  | string
  | { kind: 'var'; name: string }
  | { kind: 'rand'; min: number; max: number }
  | { kind: 'choice'; values: Array<number | string> }
  | { kind: 'add'; a: SfxExpr; b: SfxExpr }
  | { kind: 'sub'; a: SfxExpr; b: SfxExpr }
  | { kind: 'mul'; a: SfxExpr; b: SfxExpr }
  | { kind: 'div'; a: SfxExpr; b: SfxExpr };

export interface SfxGraphEdge {
  from: string;
  to: string;
  /** Optional AudioNode output index (for ChannelSplitter, etc). */
  fromChannel?: number;
  /** Optional AudioNode input index (for ChannelMerger, etc). */
  toChannel?: number;
}

/**
 * Optional layout metadata for graph tooling.
 *
 * These values are ignored by audio synthesis, but can be used by editors/viewers
 * to persist custom node layout across sessions.
 */
export interface SfxGraphNodeLayout {
  /** X position in editor "world" coordinates (pixels). */
  x?: number;
  /** Y position in editor "world" coordinates (pixels). */
  y?: number;
}

export type SfxGraphNode =
  | ({
      kind: 'oscVoice';
      id: string;
      oscType: SfxExpr; // OscillatorType
      freqHz: SfxExpr;
      gain: SfxExpr;
      stopAfter?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'noiseVoice';
      id: string;
      noiseType?: SfxExpr; // 'white' | 'pink' | 'brown' | 'bitcrush'
      duration: SfxExpr; // seconds
      gain: SfxExpr;
      // Optional parameters used when noiseType == 'bitcrush'
      crushBits?: SfxExpr; // 1..16
      holdHz?: SfxExpr; // sample-and-hold rate (Hz)
      stopAfter?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'delay';
      id: string;
      delayTime: SfxExpr; // seconds
      // Sets the maxDelayTime passed to createDelay().
      // If omitted, a conservative default is used.
      maxDelayTime?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'stereoPanner';
      id: string;
      pan: SfxExpr; // -1..+1
    } & SfxGraphNodeLayout)
  | ({
      kind: 'compressor';
      id: string;
      threshold?: SfxExpr; // dB
      knee?: SfxExpr; // dB
      ratio?: SfxExpr;
      attack?: SfxExpr; // seconds
      release?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'convolver';
      id: string;
      // Procedural impulse response parameters.
      // If omitted, a short noise IR is generated.
      impulseType?: SfxExpr; // 'white' | 'pink' | 'brown'
      seconds?: SfxExpr; // IR length
      decay?: SfxExpr; // envelope exponent
      reverse?: SfxExpr; // truthy => reverse envelope
      normalize?: SfxExpr; // truthy => convolver.normalize = true
    } & SfxGraphNodeLayout)
  | ({
      kind: 'filter';
      id: string;
      filterType: SfxExpr; // BiquadFilterType
      freqHz: SfxExpr;
      q: SfxExpr;
      gain?: SfxExpr; // used by peaking/shelf filters
    } & SfxGraphNodeLayout)
  | ({
      kind: 'waveshaper';
      id: string;
      curve: SfxExpr; // 'softClip' | 'hardClip' | 'tanh' | 'atan' | 'fold'
      amount?: SfxExpr; // intensity (default 1)
      oversample?: SfxExpr; // 'none' | '2x' | '4x'
    } & SfxGraphNodeLayout)
  | ({
      kind: 'panner';
      id: string;
      panningModel?: SfxExpr; // 'equalpower' | 'HRTF'
      distanceModel?: SfxExpr; // 'linear' | 'inverse' | 'exponential'
      positionX?: SfxExpr;
      positionY?: SfxExpr;
      positionZ?: SfxExpr;
      orientationX?: SfxExpr;
      orientationY?: SfxExpr;
      orientationZ?: SfxExpr;
      refDistance?: SfxExpr;
      maxDistance?: SfxExpr;
      rolloffFactor?: SfxExpr;
      coneInnerAngle?: SfxExpr;
      coneOuterAngle?: SfxExpr;
      coneOuterGain?: SfxExpr;
    } & SfxGraphNodeLayout)
  | ({
      kind: 'channelSplitter';
      id: string;
      outputs?: SfxExpr; // integer >= 1
    } & SfxGraphNodeLayout)
  | ({
      kind: 'channelMerger';
      id: string;
      inputs?: SfxExpr; // integer >= 1
    } & SfxGraphNodeLayout)
  | ({
      kind: 'iirFilter';
      id: string;
      feedforward: number[];
      feedback: number[];
    } & SfxGraphNodeLayout)
  | ({
      kind: 'constantSource';
      id: string;
      offset: SfxExpr;
      stopAfter?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'lfo';
      id: string;
      oscType: SfxExpr; // OscillatorType
      freqHz: SfxExpr;
      gain: SfxExpr; // modulation depth
      stopAfter?: SfxExpr; // seconds
    } & SfxGraphNodeLayout)
  | ({
      kind: 'gain';
      id: string;
      gain: SfxExpr;
    } & SfxGraphNodeLayout);

function parseOptionalFiniteNumber(v: unknown, path: string): number | undefined {
  if (v === undefined || v === null) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) err(path, 'must be a finite number');
  return n;
}

function parseNodeLayout(v: Record<string, unknown>, path: string): SfxGraphNodeLayout {
  const x = parseOptionalFiniteNumber((v as any).x, `${path}.x`);
  const y = parseOptionalFiniteNumber((v as any).y, `${path}.y`);
  return {
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
  };
}

export type SfxGraphEvent =
  | {
      kind: 'envAR';
      node: string; // voice/gain node
      attack: SfxExpr;
      release: SfxExpr;
      peak: SfxExpr;
      at?: SfxExpr; // seconds offset
    }
  | {
      kind: 'envADSR';
      node: string;
      attack: SfxExpr;
      decay: SfxExpr;
      sustain: SfxExpr;
      release: SfxExpr;
      peak: SfxExpr;
      hold: SfxExpr;
      at?: SfxExpr;
    }
  | {
      kind: 'freqDrop';
      node: string; // oscVoice
      startHz: SfxExpr;
      endHz: SfxExpr;
      duration: SfxExpr;
      at?: SfxExpr;
    }
  | {
      kind: 'freqSequence';
      node: string; // oscVoice
      baseHz: SfxExpr;
      multipliers: number[];
      stepDur: SfxExpr;
      at?: SfxExpr;
    };

export interface SfxGraphPreset {
  vars?: Record<string, SfxExpr>;
  nodes: SfxGraphNode[];
  edges: SfxGraphEdge[];
  events?: SfxGraphEvent[];
}

export interface SfxGraphPatch {
  vars?: Record<string, SfxExpr>;
  nodes?: SfxGraphNode[]; // upsert by id
  edges?: SfxGraphEdge[]; // replace
  edgesAdd?: SfxGraphEdge[];
  edgesRemove?: SfxGraphEdge[];
  events?: SfxGraphEvent[]; // replace
  eventsAdd?: SfxGraphEvent[];
}

export type StfxrDefinition =
  | { kind: 'preset'; preset: SfxGraphPreset }
  | { kind: 'derived'; base: string; patch: SfxGraphPatch };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function err(path: string, msg: string): never {
  throw new Error(`[stfxr] ${path}: ${msg}`);
}

function parseExpr(v: unknown, path: string): SfxExpr {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) err(path, 'number must be finite');
    return v;
  }
  if (typeof v === 'string') return v;
  if (!isPlainObject(v)) err(path, 'expected number | string | expr object');

  const kind = (v as any).kind;
  if (typeof kind !== 'string') err(path, 'expr.kind must be a string');

  switch (kind) {
    case 'var': {
      const name = (v as any).name;
      if (typeof name !== 'string' || !name) err(path, 'var.name must be a non-empty string');
      return { kind: 'var', name };
    }
    case 'rand': {
      const min = (v as any).min;
      const max = (v as any).max;
      if (typeof min !== 'number' || !Number.isFinite(min)) err(path, 'rand.min must be a finite number');
      if (typeof max !== 'number' || !Number.isFinite(max)) err(path, 'rand.max must be a finite number');
      return { kind: 'rand', min, max };
    }
    case 'choice': {
      const values = (v as any).values;
      if (!Array.isArray(values) || values.length === 0) err(path, 'choice.values must be a non-empty array');
      const out: Array<number | string> = [];
      for (let i = 0; i < values.length; i++) {
        const it = values[i];
        if (typeof it === 'number') {
          if (!Number.isFinite(it)) err(`${path}.values[${i}]`, 'number must be finite');
          out.push(it);
        } else if (typeof it === 'string') {
          out.push(it);
        } else {
          err(`${path}.values[${i}]`, 'must be number or string');
        }
      }
      return { kind: 'choice', values: out };
    }
    case 'add':
    case 'sub':
    case 'mul':
    case 'div': {
      const a = parseExpr((v as any).a, `${path}.a`);
      const b = parseExpr((v as any).b, `${path}.b`);
      return { kind, a, b } as any;
    }
    default:
      err(path, `unknown expr.kind "${kind}"`);
  }
}

function parseEdge(v: unknown, path: string): SfxGraphEdge {
  if (!isPlainObject(v)) err(path, 'edge must be an object');
  const from = (v as any).from;
  const to = (v as any).to;
  if (typeof from !== 'string' || !from) err(`${path}.from`, 'must be a non-empty string');
  if (typeof to !== 'string' || !to) err(`${path}.to`, 'must be a non-empty string');
  const fromChannelRaw = (v as any).fromChannel;
  const toChannelRaw = (v as any).toChannel;

  const parseChannel = (raw: any, p: string): number | undefined => {
    if (raw === undefined || raw === null) return undefined;
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n)) err(p, 'must be a finite number');
    if (n < 0 || n > 64) err(p, 'must be an integer in range 0..64');
    return n;
  };

  const fromChannel = parseChannel(fromChannelRaw, `${path}.fromChannel`);
  const toChannel = parseChannel(toChannelRaw, `${path}.toChannel`);

  return { from, to, fromChannel, toChannel };
}

function parseNode(v: unknown, path: string): SfxGraphNode {
  if (!isPlainObject(v)) err(path, 'node must be an object');
  const kind = (v as any).kind;
  const id = (v as any).id;
  if (typeof kind !== 'string') err(`${path}.kind`, 'must be a string');
  if (typeof id !== 'string' || !id) err(`${path}.id`, 'must be a non-empty string');

  const layout = parseNodeLayout(v, path);

  switch (kind) {
    case 'oscVoice':
      return {
        kind,
        id,
        ...layout,
        oscType: parseExpr((v as any).oscType, `${path}.oscType`),
        freqHz: parseExpr((v as any).freqHz, `${path}.freqHz`),
        gain: parseExpr((v as any).gain, `${path}.gain`),
        stopAfter: (v as any).stopAfter === undefined ? undefined : parseExpr((v as any).stopAfter, `${path}.stopAfter`)
      };
    case 'noiseVoice':
      return {
        kind,
        id,
        ...layout,
        noiseType: (v as any).noiseType === undefined ? undefined : parseExpr((v as any).noiseType, `${path}.noiseType`),
        duration: parseExpr((v as any).duration, `${path}.duration`),
        gain: parseExpr((v as any).gain, `${path}.gain`),
        crushBits: (v as any).crushBits === undefined ? undefined : parseExpr((v as any).crushBits, `${path}.crushBits`),
        holdHz: (v as any).holdHz === undefined ? undefined : parseExpr((v as any).holdHz, `${path}.holdHz`),
        stopAfter: (v as any).stopAfter === undefined ? undefined : parseExpr((v as any).stopAfter, `${path}.stopAfter`)
      };
    case 'delay':
      return {
        kind,
        id,
        ...layout,
        delayTime: parseExpr((v as any).delayTime, `${path}.delayTime`),
        maxDelayTime: (v as any).maxDelayTime === undefined ? undefined : parseExpr((v as any).maxDelayTime, `${path}.maxDelayTime`)
      };
    case 'stereoPanner':
      return {
        kind,
        id,
        ...layout,
        pan: parseExpr((v as any).pan, `${path}.pan`)
      };
    case 'compressor':
      return {
        kind,
        id,
        ...layout,
        threshold: (v as any).threshold === undefined ? undefined : parseExpr((v as any).threshold, `${path}.threshold`),
        knee: (v as any).knee === undefined ? undefined : parseExpr((v as any).knee, `${path}.knee`),
        ratio: (v as any).ratio === undefined ? undefined : parseExpr((v as any).ratio, `${path}.ratio`),
        attack: (v as any).attack === undefined ? undefined : parseExpr((v as any).attack, `${path}.attack`),
        release: (v as any).release === undefined ? undefined : parseExpr((v as any).release, `${path}.release`)
      };
    case 'convolver':
      return {
        kind,
        id,
        ...layout,
        impulseType: (v as any).impulseType === undefined ? undefined : parseExpr((v as any).impulseType, `${path}.impulseType`),
        seconds: (v as any).seconds === undefined ? undefined : parseExpr((v as any).seconds, `${path}.seconds`),
        decay: (v as any).decay === undefined ? undefined : parseExpr((v as any).decay, `${path}.decay`),
        reverse: (v as any).reverse === undefined ? undefined : parseExpr((v as any).reverse, `${path}.reverse`),
        normalize: (v as any).normalize === undefined ? undefined : parseExpr((v as any).normalize, `${path}.normalize`)
      };
    case 'panner':
      return {
        kind,
        id,
        ...layout,
        panningModel: (v as any).panningModel === undefined ? undefined : parseExpr((v as any).panningModel, `${path}.panningModel`),
        distanceModel: (v as any).distanceModel === undefined ? undefined : parseExpr((v as any).distanceModel, `${path}.distanceModel`),
        positionX: (v as any).positionX === undefined ? undefined : parseExpr((v as any).positionX, `${path}.positionX`),
        positionY: (v as any).positionY === undefined ? undefined : parseExpr((v as any).positionY, `${path}.positionY`),
        positionZ: (v as any).positionZ === undefined ? undefined : parseExpr((v as any).positionZ, `${path}.positionZ`),
        orientationX: (v as any).orientationX === undefined ? undefined : parseExpr((v as any).orientationX, `${path}.orientationX`),
        orientationY: (v as any).orientationY === undefined ? undefined : parseExpr((v as any).orientationY, `${path}.orientationY`),
        orientationZ: (v as any).orientationZ === undefined ? undefined : parseExpr((v as any).orientationZ, `${path}.orientationZ`),
        refDistance: (v as any).refDistance === undefined ? undefined : parseExpr((v as any).refDistance, `${path}.refDistance`),
        maxDistance: (v as any).maxDistance === undefined ? undefined : parseExpr((v as any).maxDistance, `${path}.maxDistance`),
        rolloffFactor: (v as any).rolloffFactor === undefined ? undefined : parseExpr((v as any).rolloffFactor, `${path}.rolloffFactor`),
        coneInnerAngle: (v as any).coneInnerAngle === undefined ? undefined : parseExpr((v as any).coneInnerAngle, `${path}.coneInnerAngle`),
        coneOuterAngle: (v as any).coneOuterAngle === undefined ? undefined : parseExpr((v as any).coneOuterAngle, `${path}.coneOuterAngle`),
        coneOuterGain: (v as any).coneOuterGain === undefined ? undefined : parseExpr((v as any).coneOuterGain, `${path}.coneOuterGain`)
      };
    case 'channelSplitter':
      return {
        kind,
        id,
        ...layout,
        outputs: (v as any).outputs === undefined ? undefined : parseExpr((v as any).outputs, `${path}.outputs`)
      };
    case 'channelMerger':
      return {
        kind,
        id,
        ...layout,
        inputs: (v as any).inputs === undefined ? undefined : parseExpr((v as any).inputs, `${path}.inputs`)
      };
    case 'iirFilter': {
      const ff = (v as any).feedforward;
      const fb = (v as any).feedback;
      if (!Array.isArray(ff) || ff.length === 0) err(`${path}.feedforward`, 'must be a non-empty number array');
      if (!Array.isArray(fb) || fb.length === 0) err(`${path}.feedback`, 'must be a non-empty number array');
      const feedforward: number[] = ff.map((n: any, i: number) => {
        const x = Number(n);
        if (!Number.isFinite(x)) err(`${path}.feedforward[${i}]`, 'must be a finite number');
        return x;
      });
      const feedback: number[] = fb.map((n: any, i: number) => {
        const x = Number(n);
        if (!Number.isFinite(x)) err(`${path}.feedback[${i}]`, 'must be a finite number');
        return x;
      });
      return { kind, id, ...layout, feedforward, feedback };
    }
    case 'constantSource':
      return {
        kind,
        id,
        ...layout,
        offset: parseExpr((v as any).offset, `${path}.offset`),
        stopAfter: (v as any).stopAfter === undefined ? undefined : parseExpr((v as any).stopAfter, `${path}.stopAfter`)
      };
    case 'filter':
      return {
        kind,
        id,
        ...layout,
        filterType: parseExpr((v as any).filterType, `${path}.filterType`),
        freqHz: parseExpr((v as any).freqHz, `${path}.freqHz`),
        q: parseExpr((v as any).q, `${path}.q`),
        gain: (v as any).gain === undefined ? undefined : parseExpr((v as any).gain, `${path}.gain`)
      };
    case 'waveshaper':
      return {
        kind,
        id,
        ...layout,
        curve: parseExpr((v as any).curve, `${path}.curve`),
        amount: (v as any).amount === undefined ? undefined : parseExpr((v as any).amount, `${path}.amount`),
        oversample: (v as any).oversample === undefined ? undefined : parseExpr((v as any).oversample, `${path}.oversample`)
      };
    case 'lfo':
      return {
        kind,
        id,
        ...layout,
        oscType: parseExpr((v as any).oscType, `${path}.oscType`),
        freqHz: parseExpr((v as any).freqHz, `${path}.freqHz`),
        gain: parseExpr((v as any).gain, `${path}.gain`),
        stopAfter: (v as any).stopAfter === undefined ? undefined : parseExpr((v as any).stopAfter, `${path}.stopAfter`)
      };
    case 'gain':
      return {
        kind,
        id,
        ...layout,
        gain: parseExpr((v as any).gain, `${path}.gain`)
      };
    default:
      err(path, `unknown node.kind "${kind}"`);
  }
}

function parseEvent(v: unknown, path: string): SfxGraphEvent {
  if (!isPlainObject(v)) err(path, 'event must be an object');
  const kind = (v as any).kind;
  if (typeof kind !== 'string') err(`${path}.kind`, 'must be a string');
  const node = (v as any).node;
  if (typeof node !== 'string' || !node) err(`${path}.node`, 'must be a non-empty string');

  const atRaw = (v as any).at;
  const at = atRaw === undefined ? undefined : parseExpr(atRaw, `${path}.at`);

  switch (kind) {
    case 'envAR':
      return {
        kind,
        node,
        attack: parseExpr((v as any).attack, `${path}.attack`),
        release: parseExpr((v as any).release, `${path}.release`),
        peak: parseExpr((v as any).peak, `${path}.peak`),
        at
      };
    case 'envADSR':
      return {
        kind,
        node,
        attack: parseExpr((v as any).attack, `${path}.attack`),
        decay: parseExpr((v as any).decay, `${path}.decay`),
        sustain: parseExpr((v as any).sustain, `${path}.sustain`),
        release: parseExpr((v as any).release, `${path}.release`),
        peak: parseExpr((v as any).peak, `${path}.peak`),
        hold: parseExpr((v as any).hold, `${path}.hold`),
        at
      };
    case 'freqDrop':
      return {
        kind,
        node,
        startHz: parseExpr((v as any).startHz, `${path}.startHz`),
        endHz: parseExpr((v as any).endHz, `${path}.endHz`),
        duration: parseExpr((v as any).duration, `${path}.duration`),
        at
      };
    case 'freqSequence': {
      const multipliers = (v as any).multipliers;
      if (!Array.isArray(multipliers) || multipliers.length === 0) err(`${path}.multipliers`, 'must be a non-empty number array');
      const out: number[] = [];
      for (let i = 0; i < multipliers.length; i++) {
        const m = multipliers[i];
        if (typeof m !== 'number' || !Number.isFinite(m)) err(`${path}.multipliers[${i}]`, 'must be a finite number');
        out.push(m);
      }
      return {
        kind,
        node,
        baseHz: parseExpr((v as any).baseHz, `${path}.baseHz`),
        multipliers: out,
        stepDur: parseExpr((v as any).stepDur, `${path}.stepDur`),
        at
      };
    }
    default:
      err(path, `unknown event.kind "${kind}"`);
  }
}

export function parseSfxGraphPreset(value: unknown): SfxGraphPreset {
  if (!isPlainObject(value)) err('$', 'preset must be an object');

  // Allow wrapper form: { preset: { ... } }
  const root = (value as any).preset !== undefined ? (value as any).preset : value;
  if (!isPlainObject(root)) err('$.preset', 'must be an object');

  const nodesRaw = (root as any).nodes;
  const edgesRaw = (root as any).edges;
  const eventsRaw = (root as any).events;
  const varsRaw = (root as any).vars;

  if (!Array.isArray(nodesRaw)) err('$.nodes', 'must be an array');
  if (!Array.isArray(edgesRaw)) err('$.edges', 'must be an array');

  const nodes: SfxGraphNode[] = nodesRaw.map((n, i) => parseNode(n, `$.nodes[${i}]`));
  const edges: SfxGraphEdge[] = edgesRaw.map((e, i) => parseEdge(e, `$.edges[${i}]`));

  let events: SfxGraphEvent[] | undefined;
  if (eventsRaw !== undefined) {
    if (!Array.isArray(eventsRaw)) err('$.events', 'must be an array');
    events = eventsRaw.map((ev, i) => parseEvent(ev, `$.events[${i}]`));
  }

  let vars: Record<string, SfxExpr> | undefined;
  if (varsRaw !== undefined) {
    if (!isPlainObject(varsRaw)) err('$.vars', 'must be an object');
    const out: Record<string, SfxExpr> = Object.create(null);
    for (const [k, v] of Object.entries(varsRaw)) {
      if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
      out[k] = parseExpr(v, `$.vars.${k}`);
    }
    vars = out;
  }

  return { vars, nodes, edges, events };
}

export function parseSfxGraphPresetJson(jsonText: string): SfxGraphPreset {
  let v: unknown;
  try {
    v = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`[stfxr] Invalid JSON: ${String((e as any)?.message ?? e)}`);
  }
  return parseSfxGraphPreset(v);
}

export function parseStfxrDefinition(value: unknown): StfxrDefinition {
  if (!isPlainObject(value)) err('$', 'stfxr definition must be an object');

  // Preset forms:
  // - { nodes, edges, ... }
  // - { preset: { nodes, edges, ... } }
  if ((value as any).nodes !== undefined || (value as any).preset !== undefined) {
    return { kind: 'preset', preset: parseSfxGraphPreset(value) };
  }

  // Derived form:
  // - { base: "zap", patch: { ... } }
  const base = (value as any).base;
  if (typeof base !== 'string' || !base.trim()) err('$.base', 'must be a non-empty string');

  const patchRaw = (value as any).patch;
  const patch: SfxGraphPatch = {};

  if (patchRaw !== undefined) {
    if (!isPlainObject(patchRaw)) err('$.patch', 'must be an object');

    const varsRaw = (patchRaw as any).vars;
    if (varsRaw !== undefined) {
      if (!isPlainObject(varsRaw)) err('$.patch.vars', 'must be an object');
      const out: Record<string, SfxExpr> = Object.create(null);
      for (const [k, v] of Object.entries(varsRaw)) {
        if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue;
        out[k] = parseExpr(v, `$.patch.vars.${k}`);
      }
      patch.vars = out;
    }

    const nodesRaw = (patchRaw as any).nodes;
    if (nodesRaw !== undefined) {
      if (!Array.isArray(nodesRaw)) err('$.patch.nodes', 'must be an array');
      patch.nodes = nodesRaw.map((n: unknown, i: number) => parseNode(n, `$.patch.nodes[${i}]`));
    }

    const edgesRaw = (patchRaw as any).edges;
    if (edgesRaw !== undefined) {
      if (!Array.isArray(edgesRaw)) err('$.patch.edges', 'must be an array');
      patch.edges = edgesRaw.map((e: unknown, i: number) => parseEdge(e, `$.patch.edges[${i}]`));
    }

    const edgesAddRaw = (patchRaw as any).edgesAdd;
    if (edgesAddRaw !== undefined) {
      if (!Array.isArray(edgesAddRaw)) err('$.patch.edgesAdd', 'must be an array');
      patch.edgesAdd = edgesAddRaw.map((e: unknown, i: number) => parseEdge(e, `$.patch.edgesAdd[${i}]`));
    }

    const edgesRemoveRaw = (patchRaw as any).edgesRemove;
    if (edgesRemoveRaw !== undefined) {
      if (!Array.isArray(edgesRemoveRaw)) err('$.patch.edgesRemove', 'must be an array');
      patch.edgesRemove = edgesRemoveRaw.map((e: unknown, i: number) => parseEdge(e, `$.patch.edgesRemove[${i}]`));
    }

    const eventsRaw = (patchRaw as any).events;
    if (eventsRaw !== undefined) {
      if (!Array.isArray(eventsRaw)) err('$.patch.events', 'must be an array');
      patch.events = eventsRaw.map((ev: unknown, i: number) => parseEvent(ev, `$.patch.events[${i}]`));
    }

    const eventsAddRaw = (patchRaw as any).eventsAdd;
    if (eventsAddRaw !== undefined) {
      if (!Array.isArray(eventsAddRaw)) err('$.patch.eventsAdd', 'must be an array');
      patch.eventsAdd = eventsAddRaw.map((ev: unknown, i: number) => parseEvent(ev, `$.patch.eventsAdd[${i}]`));
    }
  }

  return { kind: 'derived', base: base.trim(), patch };
}

export function parseStfxrDefinitionJson(jsonText: string): StfxrDefinition {
  let v: unknown;
  try {
    v = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`[stfxr] Invalid JSON: ${String((e as any)?.message ?? e)}`);
  }
  return parseStfxrDefinition(v);
}

export interface PlaySfxGraphOptions {
  volume?: number;
  when?: number;
}

export interface BakeSfxGraphOptions {
  // If omitted, duration is estimated from nodes/events.
  seconds?: number;
  // Default: 2
  channels?: number;
  // Bake-time volume multiplier applied inside the rendered buffer.
  // Prefer leaving this at 1 and using playback gain instead.
  volume?: number;
  // Extra tail time added after estimated duration.
  tailSeconds?: number;
  // Safety cap to avoid rendering huge buffers from untrusted graphs.
  maxSeconds?: number;
}

export interface SfxGraphHandle {
  stop: (when?: number) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function mulberry32(seed: number): () => number {
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

function hashStr32(s: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

class ExprEvaluator {
  private rng: () => number;
  private vars: Record<string, SfxExpr>;
  private cache: Map<string, number | string> = new Map();

  constructor(rng: () => number, vars: Record<string, SfxExpr> | undefined) {
    this.rng = rng;
    this.vars = vars ?? {};
  }

  eval(expr: SfxExpr): number | string {
    if (typeof expr === 'number' || typeof expr === 'string') return expr;

    switch (expr.kind) {
      case 'var': {
        const k = expr.name;
        if (this.cache.has(k)) return this.cache.get(k)!;
        const vexpr = this.vars[k];
        if (vexpr === undefined) return 0;
        const v = this.eval(vexpr);
        this.cache.set(k, v);
        return v;
      }
      case 'rand':
        return randRange(this.rng, expr.min, expr.max);
      case 'choice':
        return randChoice(this.rng, expr.values);
      case 'add':
        return Number(this.eval(expr.a)) + Number(this.eval(expr.b));
      case 'sub':
        return Number(this.eval(expr.a)) - Number(this.eval(expr.b));
      case 'mul':
        return Number(this.eval(expr.a)) * Number(this.eval(expr.b));
      case 'div': {
        const b = Number(this.eval(expr.b));
        return b === 0 ? 0 : Number(this.eval(expr.a)) / b;
      }
    }
  }
}

function envAR(gainParam: AudioParam, t0: number, attack: number, release: number, peak: number) {
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

function scheduleFreqDrop(freqParam: AudioParam, t0: number, startHz: number, endHz: number, duration: number) {
  const d = Math.max(0.01, duration);
  freqParam.cancelScheduledValues(t0);
  freqParam.setValueAtTime(Math.max(1, startHz), t0);
  freqParam.exponentialRampToValueAtTime(Math.max(1, endHz), t0 + d);
}

function makeWaveshaperCurve(name: string, amount: number, samples: number = 1024): Float32Array {
  const n = Math.max(32, Math.min(16384, samples | 0));
  const a = Number.isFinite(amount) ? Math.max(0, amount) : 1;
  const curve = new Float32Array(n);

  const kind = String(name || 'softClip');
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    let y = x;
    if (kind === 'hardClip') {
      const t = Math.max(0.0001, 1 / (1 + a));
      y = clamp(x, -t, t) / t;
    } else if (kind === 'tanh') {
      const k = 1 + a * 3;
      y = Math.tanh(k * x);
    } else if (kind === 'atan') {
      const k = 1 + a * 6;
      y = (2 / Math.PI) * Math.atan(k * x);
    } else if (kind === 'fold') {
      const k = 1 + a * 2;
      const v = x * k;
      const folded = Math.abs(((v + 1) % 4) - 2) - 1;
      y = clamp(folded, -1, 1);
    } else {
      // softClip (default)
      const k = 1 + a * 8;
      y = (1 + k) * x / (1 + k * Math.abs(x));
    }
    curve[i] = clamp(y, -1, 1);
  }
  return curve;
}

function safeConnect(node: AudioNode, dest: AudioNode) {
  try {
    node.connect(dest);
  } catch {
    // no-op
  }
}

function safeConnectIndexed(node: AudioNode, dest: AudioNode, outputIndex?: number, inputIndex?: number) {
  try {
    const out = outputIndex === undefined ? undefined : (outputIndex | 0);
    const inp = inputIndex === undefined ? undefined : (inputIndex | 0);
    if (out === undefined && inp === undefined) {
      node.connect(dest);
      return;
    }
    if (out !== undefined && inp !== undefined) {
      node.connect(dest, out, inp);
      return;
    }
    if (out !== undefined) {
      node.connect(dest, out);
      return;
    }
    // If only input index is provided, assume output 0.
    node.connect(dest, 0, inp!);
  } catch {
    // no-op
  }
}

function createNoiseSource(
  ctx: BaseAudioContext,
  duration: number,
  seed: number,
  opts?: { noiseType?: string; crushBits?: number; holdHz?: number }
): AudioBufferSourceNode {
  const frames = Math.max(1, Math.floor(duration * ctx.sampleRate));
  const buffer = getOrCreateNoiseBuffer(ctx, frames, seed, opts);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = false;
  return src;
}

type NoiseCacheEntry = { buffer: AudioBuffer; bytes: number };

class LruCache<K, V> {
  private map = new Map<K, V>();
  private maxBytes: number;
  private bytesFor: (v: V) => number;
  private currentBytes = 0;

  constructor(maxBytes: number, bytesFor: (v: V) => number) {
    this.maxBytes = Math.max(0, maxBytes | 0);
    this.bytesFor = bytesFor;
  }

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // refresh recency
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    const existing = this.map.get(key);
    if (existing !== undefined) {
      this.currentBytes -= this.bytesFor(existing);
      this.map.delete(key);
    }
    this.map.set(key, value);
    this.currentBytes += this.bytesFor(value);
    this.evictIfNeeded();
  }

  private evictIfNeeded(): void {
    if (this.maxBytes <= 0) return;
    while (this.currentBytes > this.maxBytes && this.map.size > 1) {
      const oldestKey = this.map.keys().next().value as K;
      const oldest = this.map.get(oldestKey);
      this.map.delete(oldestKey);
      if (oldest !== undefined) this.currentBytes -= this.bytesFor(oldest);
    }
  }
}

const NOISE_CACHE_MAX_BYTES = 2 * 1024 * 1024; // ~2MB per context
const noiseCacheByContext: WeakMap<BaseAudioContext, LruCache<string, NoiseCacheEntry>> = new WeakMap();

function getNoiseCache(ctx: BaseAudioContext): LruCache<string, NoiseCacheEntry> {
  const existing = noiseCacheByContext.get(ctx);
  if (existing) return existing;

  const cache = new LruCache<string, NoiseCacheEntry>(NOISE_CACHE_MAX_BYTES, (e) => e.bytes);
  noiseCacheByContext.set(ctx, cache);
  return cache;
}

function estimateAudioBufferBytes(buffer: AudioBuffer): number {
  // Float32 samples
  const frames = buffer.length;
  const channels = buffer.numberOfChannels;
  return Math.max(0, frames * channels * 4);
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.floor(v);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function generateWhiteNoise(data: Float32Array, seed: number) {
  const rng = mulberry32(seed);
  for (let i = 0; i < data.length; i++) data[i] = rng() * 2 - 1;
}

function generatePinkNoise(data: Float32Array, seed: number) {
  // Paul Kellet's pink noise filter (good enough for SFX).
  const rng = mulberry32(seed);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = rng() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    data[i] = clamp(pink * 0.11, -1, 1);
  }
}

function generateBrownNoise(data: Float32Array, seed: number) {
  const rng = mulberry32(seed);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = rng() * 2 - 1;
    last = (last + white * 0.02);
    last = clamp(last, -1, 1);
    data[i] = last;
  }
}

function applyBitcrush(data: Float32Array, sampleRate: number, crushBits: number, holdHz: number) {
  const bits = clampInt(crushBits, 1, 16);
  const levels = Math.max(2, 1 << bits);
  const step = 2 / (levels - 1);

  const hz = Math.max(1, holdHz);
  const holdSamples = clampInt(sampleRate / hz, 1, Math.max(1, data.length));

  let i = 0;
  while (i < data.length) {
    const x = data[i]!;
    const q = Math.round((x + 1) / step) * step - 1;
    const qq = clamp(q, -1, 1);
    const end = Math.min(data.length, i + holdSamples);
    for (let j = i; j < end; j++) data[j] = qq;
    i = end;
  }
}

type ImpulseCacheEntry = { buffer: AudioBuffer; bytes: number };

const IMPULSE_CACHE_MAX_BYTES = 2 * 1024 * 1024; // ~2MB per context
const impulseCacheByContext: WeakMap<BaseAudioContext, LruCache<string, ImpulseCacheEntry>> = new WeakMap();

function getImpulseCache(ctx: BaseAudioContext): LruCache<string, ImpulseCacheEntry> {
  const existing = impulseCacheByContext.get(ctx);
  if (existing) return existing;
  const cache = new LruCache<string, ImpulseCacheEntry>(IMPULSE_CACHE_MAX_BYTES, (e) => e.bytes);
  impulseCacheByContext.set(ctx, cache);
  return cache;
}

function applyImpulseEnvelope(data: Float32Array, decay: number, reverse: boolean) {
  const n = data.length;
  const d = Number.isFinite(decay) ? Math.max(0.01, decay) : 3;
  if (n <= 1) return;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = reverse ? t : (1 - t);
    const env = Math.pow(Math.max(0, x), d);
    data[i] = data[i]! * env;
  }
}

function getOrCreateImpulseBuffer(
  ctx: BaseAudioContext,
  frames: number,
  seed: number,
  opts?: { impulseType?: string; decay?: number; reverse?: boolean }
): AudioBuffer {
  const impulseType = String(opts?.impulseType ?? 'white');
  const decay = Number.isFinite(opts?.decay as any) ? Number(opts?.decay) : 3;
  const reverse = !!opts?.reverse;
  const key = `${ctx.sampleRate}|${frames}|${seed >>> 0}|${impulseType}|d${decay.toFixed(3)}|r${reverse ? 1 : 0}`;
  const cache = getImpulseCache(ctx);
  const hit = cache.get(key);
  if (hit) return hit.buffer;

  // Stereo IR for a slightly wider sound by default.
  const channels = 2;
  const buffer = ctx.createBuffer(channels, frames, ctx.sampleRate);

  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    const chSeed = (seed ^ (ch * 0x9e3779b9)) >>> 0;

    if (impulseType === 'pink') {
      generatePinkNoise(data, chSeed);
    } else if (impulseType === 'brown') {
      generateBrownNoise(data, chSeed);
    } else {
      generateWhiteNoise(data, chSeed);
    }

    applyImpulseEnvelope(data, decay, reverse);
  }

  cache.set(key, { buffer, bytes: estimateAudioBufferBytes(buffer) });
  return buffer;
}

function getOrCreateNoiseBuffer(
  ctx: BaseAudioContext,
  frames: number,
  seed: number,
  opts?: { noiseType?: string; crushBits?: number; holdHz?: number }
): AudioBuffer {
  // Key is tied to the AudioContext via WeakMap, so we only need sampleRate/frames/seed.
  const noiseType = String(opts?.noiseType ?? 'white');
  const crushBits = opts?.crushBits;
  const holdHz = opts?.holdHz;
  const crushPart = (noiseType === 'bitcrush') ? `|b${(crushBits ?? 6) | 0}|h${Math.floor(holdHz ?? 900)}` : '';
  const key = `${ctx.sampleRate}|${frames}|${seed >>> 0}|${noiseType}${crushPart}`;
  const cache = getNoiseCache(ctx);
  const hit = cache.get(key);
  if (hit) return hit.buffer;

  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (noiseType === 'pink') {
    generatePinkNoise(data, seed);
  } else if (noiseType === 'brown') {
    generateBrownNoise(data, seed);
  } else {
    // white (default) or bitcrush base
    generateWhiteNoise(data, seed);
    if (noiseType === 'bitcrush') {
      applyBitcrush(data, ctx.sampleRate, Number.isFinite(crushBits as any) ? Number(crushBits) : 6, Number.isFinite(holdHz as any) ? Number(holdHz) : 900);
    }
  }

  cache.set(key, { buffer, bytes: estimateAudioBufferBytes(buffer) });
  return buffer;
}

type RuntimeNode = {
  id: string;
  kind: SfxGraphNode['kind'] | 'out';
  input?: AudioNode;
  output: AudioNode;
  osc?: OscillatorNode;
  src?: AudioBufferSourceNode;
  csrc?: ConstantSourceNode;
  params?: Record<string, AudioParam>;
  stop?: (t: number) => void;
};

function safeConnectParam(node: AudioNode, param: AudioParam) {
  try {
    node.connect(param);
  } catch {
    // no-op
  }
}

export function playSfxGraph(
  ctx: BaseAudioContext,
  preset: SfxGraphPreset,
  seed: number,
  options: PlaySfxGraphOptions = {}
): SfxGraphHandle {
  const rng = mulberry32(seed);
  const evalr = new ExprEvaluator(rng, preset.vars);

  const t0 = ctx.currentTime + (options.when ?? 0);
  const vol = clamp(options.volume ?? 0.8, 0, 2);

  const outGain = ctx.createGain();
  outGain.gain.value = vol;
  safeConnect(outGain, ctx.destination);

  const nodes: Map<string, RuntimeNode> = new Map();
  nodes.set('out', { id: 'out', kind: 'out', input: outGain, output: outGain, params: { gain: outGain.gain } });

  const stoppables: Array<{ stop: (t: number) => void }> = [];

  const stopAll = (when: number = 0) => {
    const t = ctx.currentTime + when;
    for (const s of stoppables) {
      try {
        s.stop(t);
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

  for (const node of preset.nodes) {
    if (nodes.has(node.id)) continue;

    if (node.kind === 'oscVoice') {
      const osc = ctx.createOscillator();
      osc.type = String(evalr.eval(node.oscType)) as OscillatorType;
      osc.frequency.value = Math.max(1, Number(evalr.eval(node.freqHz)));

      const g = ctx.createGain();
      g.gain.value = Number(evalr.eval(node.gain));

      safeConnect(osc, g);
      osc.start(t0);

      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : undefined;
      if (stopAfter !== undefined && Number.isFinite(stopAfter) && stopAfter > 0) {
        osc.stop(t0 + stopAfter);
      }

      const rt: RuntimeNode = {
        id: node.id,
        kind: node.kind,
        output: g,
        input: g,
        osc,
        params: {
          gain: g.gain,
          freqHz: osc.frequency,
          frequency: osc.frequency
        },
        stop: (t) => {
          try {
            osc.stop(t);
          } catch {
            // ignore
          }
        }
      };
      nodes.set(node.id, rt);
      stoppables.push({ stop: rt.stop! });
      continue;
    }

    if (node.kind === 'lfo') {
      const osc = ctx.createOscillator();
      osc.type = String(evalr.eval(node.oscType)) as OscillatorType;
      osc.frequency.value = Math.max(0.01, Number(evalr.eval(node.freqHz)));

      const g = ctx.createGain();
      g.gain.value = Number(evalr.eval(node.gain));

      safeConnect(osc, g);
      osc.start(t0);

      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : undefined;
      if (stopAfter !== undefined && Number.isFinite(stopAfter) && stopAfter > 0) {
        osc.stop(t0 + stopAfter);
      }

      const rt: RuntimeNode = {
        id: node.id,
        kind: node.kind,
        output: g,
        input: g,
        osc,
        params: {
          gain: g.gain,
          freqHz: osc.frequency,
          frequency: osc.frequency
        },
        stop: (t) => {
          try {
            osc.stop(t);
          } catch {
            // ignore
          }
        }
      };
      nodes.set(node.id, rt);
      stoppables.push({ stop: rt.stop! });
      continue;
    }

    if (node.kind === 'noiseVoice') {
      const duration = Math.max(0.001, Number(evalr.eval(node.duration)));
      const gain = Number(evalr.eval(node.gain));

      const noiseType = node.noiseType !== undefined ? String(evalr.eval(node.noiseType)) : 'white';
      const crushBits = node.crushBits !== undefined ? Number(evalr.eval(node.crushBits)) : undefined;
      const holdHz = node.holdHz !== undefined ? Number(evalr.eval(node.holdHz)) : undefined;

      const nodeSeed = (seed ^ hashStr32(node.id) ^ 0x9e3779b9) >>> 0;
      const src = createNoiseSource(ctx, duration, nodeSeed, { noiseType, crushBits, holdHz });
      const g = ctx.createGain();
      g.gain.value = gain;
      safeConnect(src, g);

      src.start(t0);

      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : duration;
      if (Number.isFinite(stopAfter) && stopAfter > 0) {
        try {
          src.stop(t0 + stopAfter);
        } catch {
          // ignore
        }
      }

      const rt: RuntimeNode = {
        id: node.id,
        kind: node.kind,
        output: g,
        input: g,
        src,
        params: { gain: g.gain },
        stop: (t) => {
          try {
            src.stop(t);
          } catch {
            // ignore
          }
        }
      };
      nodes.set(node.id, rt);
      stoppables.push({ stop: rt.stop! });
      continue;
    }

    if (node.kind === 'delay') {
      const maxDelay = node.maxDelayTime !== undefined ? Number(evalr.eval(node.maxDelayTime)) : 2;
      const maxDelayTime = clamp(Number.isFinite(maxDelay) ? maxDelay : 2, 0.01, 10);
      const d = ctx.createDelay(maxDelayTime);
      const dt = clamp(Number(evalr.eval(node.delayTime)), 0, maxDelayTime);
      d.delayTime.value = Number.isFinite(dt) ? dt : 0;
      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: d,
        output: d,
        params: {
          delayTime: d.delayTime
        }
      });
      continue;
    }

    if (node.kind === 'stereoPanner') {
      const p = ctx.createStereoPanner();
      const pan = clamp(Number(evalr.eval(node.pan)), -1, 1);
      p.pan.value = Number.isFinite(pan) ? pan : 0;
      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: p,
        output: p,
        params: {
          pan: p.pan
        }
      });
      continue;
    }

    if (node.kind === 'compressor') {
      const c = ctx.createDynamicsCompressor();
      if (node.threshold !== undefined) {
        const v = Number(evalr.eval(node.threshold));
        if (Number.isFinite(v)) c.threshold.value = v;
      }
      if (node.knee !== undefined) {
        const v = Number(evalr.eval(node.knee));
        if (Number.isFinite(v)) c.knee.value = v;
      }
      if (node.ratio !== undefined) {
        const v = Number(evalr.eval(node.ratio));
        if (Number.isFinite(v)) c.ratio.value = v;
      }
      if (node.attack !== undefined) {
        const v = Number(evalr.eval(node.attack));
        if (Number.isFinite(v)) c.attack.value = Math.max(0, v);
      }
      if (node.release !== undefined) {
        const v = Number(evalr.eval(node.release));
        if (Number.isFinite(v)) c.release.value = Math.max(0, v);
      }
      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: c,
        output: c,
        params: {
          threshold: c.threshold,
          knee: c.knee,
          ratio: c.ratio,
          attack: c.attack,
          release: c.release
        }
      });
      continue;
    }

    if (node.kind === 'convolver') {
      const conv = ctx.createConvolver();

      const secondsRaw = node.seconds !== undefined ? Number(evalr.eval(node.seconds)) : 0.25;
      const seconds = clamp(Number.isFinite(secondsRaw) ? secondsRaw : 0.25, 0.01, 4);
      const frames = Math.max(1, Math.floor(seconds * ctx.sampleRate));

      const decayRaw = node.decay !== undefined ? Number(evalr.eval(node.decay)) : 3;
      const decay = clamp(Number.isFinite(decayRaw) ? decayRaw : 3, 0.01, 12);

      const impulseType = node.impulseType !== undefined ? String(evalr.eval(node.impulseType)) : 'white';

      const reverseRaw = node.reverse !== undefined ? evalr.eval(node.reverse) : 0;
      const reverse = typeof reverseRaw === 'string' ? (reverseRaw === 'true' || reverseRaw === '1') : Number(reverseRaw) >= 0.5;

      const normalizeRaw = node.normalize !== undefined ? evalr.eval(node.normalize) : 1;
      const normalize = typeof normalizeRaw === 'string' ? (normalizeRaw !== 'false' && normalizeRaw !== '0') : Number(normalizeRaw) >= 0.5;
      conv.normalize = normalize;

      const nodeSeed = (seed ^ hashStr32(node.id) ^ 0x85ebca6b) >>> 0;
      conv.buffer = getOrCreateImpulseBuffer(ctx, frames, nodeSeed, { impulseType, decay, reverse });

      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: conv,
        output: conv
      });
      continue;
    }

    if (node.kind === 'panner') {
      const p = ctx.createPanner();

      if (node.panningModel !== undefined) {
        const v = String(evalr.eval(node.panningModel));
        if (v === 'equalpower' || v === 'HRTF') p.panningModel = v;
      }
      if (node.distanceModel !== undefined) {
        const v = String(evalr.eval(node.distanceModel));
        if (v === 'linear' || v === 'inverse' || v === 'exponential') p.distanceModel = v;
      }

      const setParam = (param: AudioParam | undefined, expr: any) => {
        if (!param || expr === undefined) return;
        const n = Number(evalr.eval(expr));
        if (Number.isFinite(n)) param.value = n;
      };

      // Modern positional params (AudioParams)
      setParam((p as any).positionX, node.positionX);
      setParam((p as any).positionY, node.positionY);
      setParam((p as any).positionZ, node.positionZ);
      setParam((p as any).orientationX, node.orientationX);
      setParam((p as any).orientationY, node.orientationY);
      setParam((p as any).orientationZ, node.orientationZ);

      const setNumProp = (key: keyof PannerNode, expr: any, clampFn?: (x: number) => number) => {
        if (expr === undefined) return;
        const n = Number(evalr.eval(expr));
        if (!Number.isFinite(n)) return;
        (p as any)[key] = clampFn ? clampFn(n) : n;
      };

      setNumProp('refDistance', node.refDistance, (x) => Math.max(0, x));
      setNumProp('maxDistance', node.maxDistance, (x) => Math.max(0, x));
      setNumProp('rolloffFactor', node.rolloffFactor, (x) => Math.max(0, x));
      setNumProp('coneInnerAngle', node.coneInnerAngle, (x) => clamp(x, 0, 360));
      setNumProp('coneOuterAngle', node.coneOuterAngle, (x) => clamp(x, 0, 360));
      setNumProp('coneOuterGain', node.coneOuterGain, (x) => clamp(x, 0, 1));

      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: p,
        output: p,
        params: {
          positionX: (p as any).positionX,
          positionY: (p as any).positionY,
          positionZ: (p as any).positionZ,
          orientationX: (p as any).orientationX,
          orientationY: (p as any).orientationY,
          orientationZ: (p as any).orientationZ
        }
      });
      continue;
    }

    if (node.kind === 'channelSplitter') {
      const outputsRaw = node.outputs !== undefined ? Number(evalr.eval(node.outputs)) : 2;
      const outputs = clampInt(Number.isFinite(outputsRaw) ? outputsRaw : 2, 1, 64);
      const s = ctx.createChannelSplitter(outputs);
      nodes.set(node.id, { id: node.id, kind: node.kind, input: s, output: s });
      continue;
    }

    if (node.kind === 'channelMerger') {
      const inputsRaw = node.inputs !== undefined ? Number(evalr.eval(node.inputs)) : 2;
      const inputs = clampInt(Number.isFinite(inputsRaw) ? inputsRaw : 2, 1, 64);
      const m = ctx.createChannelMerger(inputs);
      nodes.set(node.id, { id: node.id, kind: node.kind, input: m, output: m });
      continue;
    }

    if (node.kind === 'iirFilter') {
      const ff = node.feedforward;
      const fb = node.feedback;
      const f = ctx.createIIRFilter(ff, fb);
      nodes.set(node.id, { id: node.id, kind: node.kind, input: f, output: f });
      continue;
    }

    if (node.kind === 'constantSource') {
      const cs = ctx.createConstantSource();
      const off = Number(evalr.eval(node.offset));
      cs.offset.value = Number.isFinite(off) ? off : 0;
      cs.start(t0);

      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : undefined;
      if (stopAfter !== undefined && Number.isFinite(stopAfter) && stopAfter > 0) {
        try {
          cs.stop(t0 + stopAfter);
        } catch {
          // ignore
        }
      }

      const rt: RuntimeNode = {
        id: node.id,
        kind: node.kind,
        output: cs,
        input: cs,
        csrc: cs,
        params: {
          offset: cs.offset
        },
        stop: (t) => {
          try {
            cs.stop(t);
          } catch {
            // ignore
          }
        }
      };
      nodes.set(node.id, rt);
      stoppables.push({ stop: rt.stop! });
      continue;
    }

    if (node.kind === 'filter') {
      const f = ctx.createBiquadFilter();
      f.type = String(evalr.eval(node.filterType)) as BiquadFilterType;
      f.frequency.value = Math.max(10, Number(evalr.eval(node.freqHz)));
      f.Q.value = Math.max(0.0001, Number(evalr.eval(node.q)));

      if (node.gain !== undefined) {
        const g = Number(evalr.eval(node.gain));
        if (Number.isFinite(g)) f.gain.value = g;
      }

      nodes.set(node.id, {
        id: node.id,
        kind: node.kind,
        input: f,
        output: f,
        params: {
          freqHz: f.frequency,
          frequency: f.frequency,
          q: f.Q,
          gain: f.gain
        }
      });
      continue;
    }

    if (node.kind === 'waveshaper') {
      const ws = ctx.createWaveShaper();
      const curveName = String(evalr.eval(node.curve));
      const amount = node.amount !== undefined ? Number(evalr.eval(node.amount)) : 1;
      // TS lib.dom has started typing WaveShaperNode.curve with a narrower typed-array backing.
      // Our generated curve is compatible at runtime.
      ws.curve = makeWaveshaperCurve(curveName, amount) as any;

      const os = node.oversample !== undefined ? String(evalr.eval(node.oversample)) : 'none';
      ws.oversample = (os === '2x' || os === '4x') ? (os as OverSampleType) : 'none';

      nodes.set(node.id, { id: node.id, kind: node.kind, input: ws, output: ws });
      continue;
    }

    if (node.kind === 'gain') {
      const g = ctx.createGain();
      g.gain.value = Number(evalr.eval(node.gain));
      nodes.set(node.id, { id: node.id, kind: node.kind, input: g, output: g, params: { gain: g.gain } });
      continue;
    }
  }

  for (const e of preset.edges) {
    const from = nodes.get(e.from);
    if (!from) continue;

    // Param edges: to can be "nodeId.paramName" (e.g. "v.freqHz", "f.frequency", "out.gain")
    const toStr = String(e.to);
    const dot = toStr.lastIndexOf('.');
    if (dot > 0 && dot < toStr.length - 1) {
      const toId = toStr.slice(0, dot);
      const paramName = toStr.slice(dot + 1);
      const toNode = nodes.get(toId);
      const param = toNode?.params?.[paramName];
      if (param) {
        safeConnectParam(from.output, param);
        continue;
      }
    }

    const to = nodes.get(e.to);
    if (!to) continue;
    const dest = to.input ?? to.output;
    safeConnectIndexed(from.output, dest, e.fromChannel, e.toChannel);
  }

  for (const ev of preset.events ?? []) {
    const at = ev.at !== undefined ? Number(evalr.eval(ev.at)) : 0;
    const t = t0 + Math.max(0, at);

    if (ev.kind === 'envAR') {
      const node = nodes.get(ev.node);
      const p = node?.params?.gain;
      if (!p) continue;
      envAR(p, t, Number(evalr.eval(ev.attack)), Number(evalr.eval(ev.release)), Number(evalr.eval(ev.peak)));
      continue;
    }

    if (ev.kind === 'envADSR') {
      const node = nodes.get(ev.node);
      const p = node?.params?.gain;
      if (!p) continue;
      envADSR(
        p,
        t,
        Number(evalr.eval(ev.attack)),
        Number(evalr.eval(ev.decay)),
        Number(evalr.eval(ev.sustain)),
        Number(evalr.eval(ev.release)),
        Number(evalr.eval(ev.peak)),
        Number(evalr.eval(ev.hold))
      );
      continue;
    }

    if (ev.kind === 'freqDrop') {
      const node = nodes.get(ev.node);
      const p = node?.params?.freqHz ?? node?.params?.frequency;
      if (!p) continue;
      scheduleFreqDrop(p, t, Number(evalr.eval(ev.startHz)), Number(evalr.eval(ev.endHz)), Number(evalr.eval(ev.duration)));
      continue;
    }

    if (ev.kind === 'freqSequence') {
      const node = nodes.get(ev.node);
      const p = node?.params?.freqHz ?? node?.params?.frequency;
      if (!p) continue;
      const base = Math.max(1, Number(evalr.eval(ev.baseHz)));
      const step = Math.max(0.001, Number(evalr.eval(ev.stepDur)));
      for (let i = 0; i < ev.multipliers.length; i++) {
        const hz = Math.max(1, base * ev.multipliers[i]!);
        p.setValueAtTime(hz, t + i * step);
      }
      continue;
    }
  }

  return { stop: stopAll };
}

export function estimateSfxGraphDurationSeconds(preset: SfxGraphPreset, seed: number, tailSeconds: number = 0.06): number {
  const rng = mulberry32(seed);
  const evalr = new ExprEvaluator(rng, preset.vars);

  let end = 0;

  for (const node of preset.nodes ?? []) {
    if (node.kind === 'oscVoice') {
      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : NaN;
      if (Number.isFinite(stopAfter) && stopAfter > end) end = stopAfter;
      continue;
    }
    if (node.kind === 'noiseVoice') {
      const duration = Math.max(0.001, Number(evalr.eval(node.duration)));
      const stopAfter = node.stopAfter !== undefined ? Number(evalr.eval(node.stopAfter)) : duration;
      const nEnd = Number.isFinite(stopAfter) && stopAfter > 0 ? stopAfter : duration;
      if (nEnd > end) end = nEnd;
      continue;
    }
  }

  for (const ev of preset.events ?? []) {
    const at = ev.at !== undefined ? Number(evalr.eval(ev.at)) : 0;
    const t = Math.max(0, Number.isFinite(at) ? at : 0);

    if (ev.kind === 'envAR') {
      const a = Math.max(0, Number(evalr.eval(ev.attack)));
      const r = Math.max(0, Number(evalr.eval(ev.release)));
      end = Math.max(end, t + a + r);
      continue;
    }

    if (ev.kind === 'envADSR') {
      const a = Math.max(0, Number(evalr.eval(ev.attack)));
      const d = Math.max(0, Number(evalr.eval(ev.decay)));
      const h = Math.max(0, Number(evalr.eval(ev.hold)));
      const r = Math.max(0, Number(evalr.eval(ev.release)));
      end = Math.max(end, t + a + d + h + r);
      continue;
    }

    if (ev.kind === 'freqDrop') {
      const d = Math.max(0, Number(evalr.eval(ev.duration)));
      end = Math.max(end, t + d);
      continue;
    }

    if (ev.kind === 'freqSequence') {
      const step = Math.max(0, Number(evalr.eval(ev.stepDur)));
      const steps = Math.max(0, ev.multipliers?.length ?? 0);
      end = Math.max(end, t + step * steps);
      continue;
    }
  }

  const tail = Math.max(0, tailSeconds);
  const total = end + tail;
  if (!Number.isFinite(total) || total <= 0) return 0.5;
  return total;
}

export async function bakeSfxGraphBuffer(
  liveCtx: AudioContext,
  preset: SfxGraphPreset,
  seed: number,
  options: BakeSfxGraphOptions = {}
): Promise<AudioBuffer> {
  const sampleRate = liveCtx.sampleRate;
  const channels = Math.max(1, Math.min(8, (options.channels ?? 2) | 0));
  const tail = options.tailSeconds ?? 0.06;
  const maxSeconds = options.maxSeconds ?? 10;

  const estimated = estimateSfxGraphDurationSeconds(preset, seed, tail);
  const seconds = clamp(options.seconds ?? estimated, 0.03, Math.max(0.03, maxSeconds));
  const frames = Math.max(1, Math.ceil(seconds * sampleRate));

  // Offline render at the live AudioContext sample rate.
  const offline = new OfflineAudioContext(channels, frames, sampleRate);
  playSfxGraph(offline, preset, seed, { volume: options.volume ?? 1, when: 0 });
  return await offline.startRendering();
}
