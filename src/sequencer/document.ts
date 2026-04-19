import {
  applyPresetToSfxGraphInstrumentDocument,
  createSfxGraphInstrumentDocument,
  normalizeSfxGraphInstrumentDocument,
  type LegacySfxGraphInstrumentShape,
  type SfxGraphInstrumentDocument,
} from '../audio/sfx-graph-document.js';
import type { SfxGraphPreset } from '../audio/sfx-graph.js';

export interface SequencerNote {
  id: number;
  row: number;
  start: number;
  length: number;
  velocity?: number;
}

export interface SequencerPattern {
  id: string;
  name: string;
  notes: SequencerNote[];
}

export interface SequencerTrack {
  id: string;
  name: string;
  transpose?: number;
  gain?: number;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  slots: string[];
  instrument: SfxGraphInstrumentDocument;
}

export interface LegacySequencerTrack {
  id: string;
  name: string;
  transpose?: number;
  gain?: number;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
  slots: string[];
  instrument?: SfxGraphInstrumentDocument | LegacySfxGraphInstrumentShape;
  graphPreset?: SfxGraphPreset;
  graphText?: string;
}

export interface SequencerDocument {
  version: 1;
  bpm: number;
  stepCount: number;
  tracks: SequencerTrack[];
  patterns: Record<string, SequencerPattern>;
}

export interface CreateSequencerTrackOptions {
  id: string;
  name: string;
  slots: string[];
  preset: SfxGraphPreset;
  transpose?: number;
  gain?: number;
  volume?: number;
  muted?: boolean;
  solo?: boolean;
}

export interface CreateSequencerDocumentOptions {
  bpm: number;
  stepCount: number;
  tracks: Array<SequencerTrack | LegacySequencerTrack>;
  patterns: Record<string, SequencerPattern>;
  fallbackPreset: SfxGraphPreset;
}

function cloneJsonValue<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {}
  return JSON.parse(JSON.stringify(value)) as T;
}

export function createSequencerTrack(options: CreateSequencerTrackOptions): SequencerTrack {
  return {
    id: String(options.id),
    name: String(options.name),
    ...(options.transpose != null ? { transpose: options.transpose } : {}),
    ...(options.gain != null ? { gain: options.gain } : {}),
    ...(options.volume != null ? { volume: options.volume } : {}),
    ...(options.muted != null ? { muted: options.muted } : {}),
    ...(options.solo != null ? { solo: options.solo } : {}),
    slots: Array.isArray(options.slots) ? options.slots.map((slot) => String(slot)) : [],
    instrument: createSfxGraphInstrumentDocument(options.preset),
  };
}

export function normalizeSequencerTrack(
  track: SequencerTrack | LegacySequencerTrack,
  fallbackPreset: SfxGraphPreset
): SequencerTrack {
  let legacyGraphPreset: SfxGraphPreset | undefined;
  let legacyGraphText: string | undefined;
  if ('graphPreset' in track) {
    legacyGraphPreset = track.graphPreset;
  }
  if ('graphText' in track && typeof track.graphText === 'string') {
    legacyGraphText = track.graphText;
  }

  const normalizedInstrument = normalizeSfxGraphInstrumentDocument(
    track.instrument ?? {
      graphPreset: legacyGraphPreset,
      graphText: legacyGraphText,
    },
    fallbackPreset
  );

  return {
    id: String(track.id),
    name: String(track.name),
    ...(track.transpose != null ? { transpose: track.transpose } : {}),
    ...(track.gain != null ? { gain: track.gain } : {}),
    ...(track.volume != null ? { volume: track.volume } : {}),
    ...(track.muted != null ? { muted: track.muted } : {}),
    ...(track.solo != null ? { solo: track.solo } : {}),
    slots: Array.isArray(track.slots) ? track.slots.map((slot) => String(slot)) : [],
    instrument: normalizedInstrument,
  };
}

export function graphPresetForSequencerTrack(track: SequencerTrack): SfxGraphPreset {
  return cloneJsonValue(track.instrument.graphDocument.preset);
}

export function graphSourceTextForSequencerTrack(track: SequencerTrack): string {
  return String(track.instrument.sourceText || '');
}

export function applyPresetToSequencerTrack(
  track: SequencerTrack,
  preset: SfxGraphPreset,
  sourceText?: string
): SequencerTrack {
  return {
    ...track,
    slots: track.slots.map((slot) => String(slot)),
    instrument: applyPresetToSfxGraphInstrumentDocument(track.instrument, preset, sourceText),
  };
}

export function createSequencerDocument(options: CreateSequencerDocumentOptions): SequencerDocument {
  const patterns: Record<string, SequencerPattern> = {};
  for (const [patternId, pattern] of Object.entries(options.patterns || {})) {
    patterns[String(patternId)] = {
      id: String(pattern.id),
      name: String(pattern.name),
      notes: Array.isArray(pattern.notes)
        ? pattern.notes.map((note) => ({
            id: Number(note.id),
            row: Number(note.row),
            start: Number(note.start),
            length: Number(note.length),
            ...(note.velocity != null ? { velocity: Number(note.velocity) } : {}),
          }))
        : [],
    };
  }

  return {
    version: 1,
    bpm: Number(options.bpm),
    stepCount: Number(options.stepCount),
    tracks: Array.isArray(options.tracks)
      ? options.tracks.map((track) => normalizeSequencerTrack(track, options.fallbackPreset))
      : [],
    patterns,
  };
}
