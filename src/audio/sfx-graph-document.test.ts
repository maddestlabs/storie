import { describe, expect, it } from 'vitest';

import {
  applyPresetToSfxGraphInstrumentDocument,
  createSfxGraphDocument,
  createSfxGraphInstrumentDocument,
  normalizeSfxGraphInstrumentDocument,
  parseSfxGraphInstrumentSource,
  serializeSfxGraphPreset,
} from './sfx-graph-document.js';
import type { SfxGraphPreset } from './sfx-graph.js';

const BASE_PRESET: SfxGraphPreset = {
  nodes: [
    { kind: 'oscVoice', id: 'osc1', oscType: 'sine', freqHz: 220, gain: 0.4, stopAfter: 0.4 },
    { kind: 'gain', id: 'amp', gain: 0.8 },
  ],
  edges: [
    { from: 'osc1', to: 'amp' },
    { from: 'amp', to: 'out' },
  ],
  events: [
    { kind: 'envAR', node: 'amp', attack: 0.01, release: 0.18, peak: 1.0, at: 0 },
  ],
};

describe('sfx graph document helpers', () => {
  it('creates a durable graph document with cloned preset data', () => {
    const document = createSfxGraphDocument(BASE_PRESET, {
      meta: { name: 'Lead' },
    });

    expect(document.version).toBe(1);
    expect(document.meta).toEqual({ name: 'Lead' });
    expect(document.preset).toEqual(BASE_PRESET);
    expect(document.preset).not.toBe(BASE_PRESET);
  });

  it('normalizes legacy graphPreset and graphText fields into an instrument document', () => {
    const sourceText = serializeSfxGraphPreset(BASE_PRESET);
    const instrument = normalizeSfxGraphInstrumentDocument({
      graphPreset: BASE_PRESET,
      graphText: sourceText,
    }, BASE_PRESET);

    expect(instrument.kind).toBe('stfxr-graph');
    expect(instrument.graphDocument.preset).toEqual(BASE_PRESET);
    expect(instrument.sourceText).toBe(sourceText);
  });

  it('preserves layout and meta when applying a new preset to an instrument document', () => {
    const instrument = createSfxGraphInstrumentDocument(BASE_PRESET, {
      layout: { camera: { x: 12, y: 20, zoom: 1.2 } },
      meta: { name: 'Bass' },
    });
    const nextPreset: SfxGraphPreset = {
      nodes: [
        { kind: 'noiseVoice', id: 'n1', duration: 0.2, gain: 0.3, stopAfter: 0.2 },
      ],
      edges: [{ from: 'n1', to: 'out' }],
    };

    const updated = applyPresetToSfxGraphInstrumentDocument(instrument, nextPreset);

    expect(updated.graphDocument.preset).toEqual(nextPreset);
    expect(updated.graphDocument.layout).toEqual({ camera: { x: 12, y: 20, zoom: 1.2 } });
    expect(updated.graphDocument.meta).toEqual({ name: 'Bass' });
  });

  it('parses source text into a canonical instrument document', () => {
    const sourceText = serializeSfxGraphPreset(BASE_PRESET);
    const instrument = parseSfxGraphInstrumentSource(sourceText);

    expect(instrument.kind).toBe('stfxr-graph');
    expect(instrument.graphDocument.preset).toEqual(BASE_PRESET);
    expect(instrument.sourceText).toBe(sourceText);
  });
});