import { applyPresetToSfxGraphInstrumentDocument, createSfxGraphInstrumentDocument, normalizeSfxGraphInstrumentDocument, } from '../audio/sfx-graph-document.js';
function cloneJsonValue(value) {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
    }
    catch { }
    return JSON.parse(JSON.stringify(value));
}
export function createSequencerTrack(options) {
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
export function normalizeSequencerTrack(track, fallbackPreset) {
    let legacyGraphPreset;
    let legacyGraphText;
    if ('graphPreset' in track) {
        legacyGraphPreset = track.graphPreset;
    }
    if ('graphText' in track && typeof track.graphText === 'string') {
        legacyGraphText = track.graphText;
    }
    const normalizedInstrument = normalizeSfxGraphInstrumentDocument(track.instrument ?? {
        graphPreset: legacyGraphPreset,
        graphText: legacyGraphText,
    }, fallbackPreset);
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
export function graphPresetForSequencerTrack(track) {
    return cloneJsonValue(track.instrument.graphDocument.preset);
}
export function graphSourceTextForSequencerTrack(track) {
    return String(track.instrument.sourceText || '');
}
export function applyPresetToSequencerTrack(track, preset, sourceText) {
    return {
        ...track,
        slots: track.slots.map((slot) => String(slot)),
        instrument: applyPresetToSfxGraphInstrumentDocument(track.instrument, preset, sourceText),
    };
}
export function createSequencerDocument(options) {
    const patterns = {};
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
//# sourceMappingURL=document.js.map