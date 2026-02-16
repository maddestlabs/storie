import type { SfxGraphPreset } from './sfx-graph.js';

export type SfxPresetName =
  | 'coin'
  | 'zap'
  | 'boom'
  | 'jump'
  | '1up'
  | 'lose'
  | 'hurt'
  | 'blip';

export const SFX_PRESET_NAMES: SfxPresetName[] = ['coin', 'zap', 'boom', 'jump', '1up', 'lose', 'hurt', 'blip'];

type E = import('./sfx-graph.js').SfxExpr;

const v = (name: string): E => ({ kind: 'var', name });
const r = (min: number, max: number): E => ({ kind: 'rand', min, max });
const c = (values: Array<number | string>): E => ({ kind: 'choice', values });
const mul = (a: E, b: E): E => ({ kind: 'mul', a, b });
const add = (a: E, b: E): E => ({ kind: 'add', a, b });
const sub = (a: E, b: E): E => ({ kind: 'sub', a, b });

export const SFX_PRESETS: Record<SfxPresetName, SfxGraphPreset> = {
  blip: {
    vars: {
      type: c(['square', 'triangle']),
      base: r(600, 1200),
      atk: r(0.002, 0.01),
      rel: r(0.05, 0.12)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('base'), gain: 1.0, stopAfter: 0.2 }
    ],
    edges: [{ from: 'v', to: 'out' }],
    events: [
      { kind: 'envAR', node: 'v', attack: v('atk'), release: v('rel'), peak: 0.6 }
    ]
  },

  coin: {
    vars: {
      type: c(['square', 'triangle']),
      f1: r(900, 1400),
      f2: mul(v('f1'), r(1.25, 1.7)),
      rel1: r(0.08, 0.16),
      rel2: r(0.06, 0.14)
    },
    nodes: [
      { kind: 'oscVoice', id: 'a', oscType: v('type'), freqHz: v('f1'), gain: 1.0, stopAfter: 0.25 },
      { kind: 'oscVoice', id: 'b', oscType: v('type'), freqHz: v('f2'), gain: 0.8, stopAfter: 0.25 }
    ],
    edges: [
      { from: 'a', to: 'out' },
      { from: 'b', to: 'out' }
    ],
    events: [
      { kind: 'envAR', node: 'a', attack: 0.002, release: v('rel1'), peak: 0.5 },
      { kind: 'envAR', node: 'b', attack: 0.002, release: v('rel2'), peak: 0.4 }
    ]
  },

  jump: {
    vars: {
      type: c(['square', 'sawtooth', 'triangle']),
      start: r(250, 420),
      end: mul(v('start'), r(1.8, 2.8)),
      dur: r(0.10, 0.18)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('start'), gain: 1.0, stopAfter: add(v('dur'), 0.12) }
    ],
    edges: [{ from: 'v', to: 'out' }],
    events: [
      { kind: 'freqDrop', node: 'v', startHz: v('start'), endHz: v('end'), duration: v('dur') },
      { kind: 'envAR', node: 'v', attack: 0.002, release: add(v('dur'), 0.05), peak: 0.55 }
    ]
  },

  zap: {
    vars: {
      type: c(['sawtooth', 'square']),
      start: r(900, 2200),
      end: r(90, 260),
      dur: r(0.08, 0.18),
      lp: r(1200, 5000),
      q: r(0.3, 2.5)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('start'), gain: 1.0, stopAfter: add(v('dur'), 0.15) },
      { kind: 'filter', id: 'f', filterType: 'lowpass', freqHz: v('lp'), q: v('q') }
    ],
    edges: [
      { from: 'v', to: 'f' },
      { from: 'f', to: 'out' }
    ],
    events: [
      { kind: 'freqDrop', node: 'v', startHz: v('start'), endHz: v('end'), duration: v('dur') },
      { kind: 'envAR', node: 'v', attack: 0.001, release: add(v('dur'), 0.06), peak: 0.45 }
    ]
  },

  hurt: {
    vars: {
      type: c(['square', 'sawtooth']),
      start: r(380, 720),
      end: r(80, 140),
      dur: r(0.18, 0.28),
      bp: r(1200, 2600),
      q: r(2, 8)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('start'), gain: 1.0, stopAfter: add(v('dur'), 0.18) },
      { kind: 'noiseVoice', id: 'n', duration: 0.12, gain: 0.15, stopAfter: 0.2 },
      { kind: 'filter', id: 'nf', filterType: 'bandpass', freqHz: v('bp'), q: v('q') }
    ],
    edges: [
      { from: 'v', to: 'out' },
      { from: 'n', to: 'nf' },
      { from: 'nf', to: 'out' }
    ],
    events: [
      { kind: 'freqDrop', node: 'v', startHz: v('start'), endHz: v('end'), duration: v('dur') },
      { kind: 'envAR', node: 'v', attack: 0.002, release: add(v('dur'), 0.06), peak: 0.55 },
      { kind: 'envAR', node: 'n', attack: 0.001, release: 0.10, peak: 0.18 }
    ]
  },

  lose: {
    vars: {
      type: c(['square', 'triangle']),
      start: r(520, 900),
      end: r(110, 200),
      dur: r(0.35, 0.55)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('start'), gain: 1.0, stopAfter: add(v('dur'), 0.25) }
    ],
    edges: [{ from: 'v', to: 'out' }],
    events: [
      { kind: 'freqDrop', node: 'v', startHz: v('start'), endHz: v('end'), duration: v('dur') },
      { kind: 'envADSR', node: 'v', attack: 0.003, decay: 0.12, sustain: 0.45, release: 0.18, peak: 0.6, hold: sub(v('dur'), 0.12) }
    ]
  },

  '1up': {
    vars: {
      type: c(['square', 'triangle']),
      base: r(440, 620),
      step: r(0.08, 0.11)
    },
    nodes: [
      { kind: 'oscVoice', id: 'v', oscType: v('type'), freqHz: v('base'), gain: 1.0, stopAfter: add(mul(v('step'), 4), 0.12) }
    ],
    edges: [{ from: 'v', to: 'out' }],
    events: [
      { kind: 'envADSR', node: 'v', attack: 0.002, decay: 0.06, sustain: 0.8, release: 0.10, peak: 0.5, hold: mul(v('step'), 3) },
      { kind: 'freqSequence', node: 'v', baseHz: v('base'), multipliers: [1.0, 1.26, 1.5, 2.0], stepDur: v('step') }
    ]
  },

  boom: {
    vars: {
      dur: r(0.45, 0.75),
      thStart: r(55, 90),
      thEnd: r(25, 40),
      bp: r(120, 380),
      bpQ: r(0.7, 2.2),
      lp: r(800, 1800),
      lpQ: r(0.2, 1.1)
    },
    nodes: [
      { kind: 'oscVoice', id: 'th', oscType: 'sine', freqHz: v('thStart'), gain: 1.0, stopAfter: add(v('dur'), 0.2) },
      { kind: 'noiseVoice', id: 'n', duration: v('dur'), gain: 0.25, stopAfter: add(v('dur'), 0.05) },
      { kind: 'filter', id: 'bp', filterType: 'bandpass', freqHz: v('bp'), q: v('bpQ') },
      { kind: 'filter', id: 'lp', filterType: 'lowpass', freqHz: v('lp'), q: v('lpQ') }
    ],
    edges: [
      { from: 'th', to: 'out' },
      { from: 'n', to: 'bp' },
      { from: 'bp', to: 'lp' },
      { from: 'lp', to: 'out' }
    ],
    events: [
      { kind: 'freqDrop', node: 'th', startHz: v('thStart'), endHz: v('thEnd'), duration: mul(v('dur'), 0.6) },
      { kind: 'envAR', node: 'th', attack: 0.002, release: v('dur'), peak: 0.65 },
      { kind: 'envAR', node: 'n', attack: 0.001, release: v('dur'), peak: 0.5 }
    ]
  }
};
