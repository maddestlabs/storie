import { describe, expect, it } from 'vitest';

import {
  applyPresetToSequencerTrack,
  createSequencerDocument,
  createSequencerTrack,
  graphPresetForSequencerTrack,
  graphSourceTextForSequencerTrack,
  normalizeSequencerTrack,
} from './document.js';
import type { SfxGraphPreset } from '../audio/sfx-graph.js';

const BASE_PRESET: SfxGraphPreset = {
  nodes: [
    { kind: 'oscVoice', id: 'osc1', oscType: 'sine', freqHz: 220, gain: 0.4, stopAfter: 0.4 },
    { kind: 'gain', id: 'amp', gain: 0.8 },
  ],
  edges: [
    { from: 'osc1', to: 'amp' },
    { from: 'amp', to: 'out' },
  ],
};

describe('sequencer document helpers', () => {
  it('creates a canonical sequencer track with an instrument document', () => {
    const track = createSequencerTrack({
      id: 'lead',
      name: 'Lead',
      slots: ['A', '.', 'B'],
      preset: BASE_PRESET,
      transpose: 12,
    });

    expect(track.id).toBe('lead');
    expect(track.instrument.kind).toBe('stfxr-graph');
    expect(track.instrument.graphDocument.preset).toEqual(BASE_PRESET);
    expect(track.slots).toEqual(['A', '.', 'B']);
  });

  it('normalizes a legacy track with graphPreset and graphText fields', () => {
    const track = normalizeSequencerTrack({
      id: 'bass',
      name: 'Bass',
      slots: ['B', '.', 'B'],
      graphPreset: BASE_PRESET,
      graphText: JSON.stringify(BASE_PRESET, null, 2),
      gain: 0.7,
    }, BASE_PRESET);

    expect(track.instrument.kind).toBe('stfxr-graph');
    expect(track.instrument.graphDocument.preset).toEqual(BASE_PRESET);
    expect(graphSourceTextForSequencerTrack(track)).toContain('"nodes"');
  });

  it('applies a new preset to a track while preserving its other fields', () => {
    const track = createSequencerTrack({
      id: 'arp',
      name: 'Arp',
      slots: ['.', 'C', '.'],
      preset: BASE_PRESET,
      volume: 0.8,
    });
    const nextPreset: SfxGraphPreset = {
      nodes: [
        { kind: 'noiseVoice', id: 'n1', duration: 0.2, gain: 0.3, stopAfter: 0.2 },
      ],
      edges: [{ from: 'n1', to: 'out' }],
    };

    const updated = applyPresetToSequencerTrack(track, nextPreset);

    expect(updated.id).toBe('arp');
    expect(updated.volume).toBe(0.8);
    expect(graphPresetForSequencerTrack(updated)).toEqual(nextPreset);
  });

  it('creates a canonical sequencer document with normalized tracks', () => {
    const document = createSequencerDocument({
      bpm: 124,
      stepCount: 32,
      fallbackPreset: BASE_PRESET,
      tracks: [
        {
          id: 'lead',
          name: 'Lead',
          slots: ['A', '.', 'B'],
          graphPreset: BASE_PRESET,
        },
      ],
      patterns: {
        A: {
          id: 'A',
          name: 'Pattern A',
          notes: [{ id: 1, row: 18, start: 0, length: 2, velocity: 0.72 }],
        },
      },
    });

    expect(document.version).toBe(1);
    expect(document.tracks).toHaveLength(1);
    expect(document.tracks[0]?.instrument.kind).toBe('stfxr-graph');
    expect(document.patterns.A?.notes).toHaveLength(1);
  });
});