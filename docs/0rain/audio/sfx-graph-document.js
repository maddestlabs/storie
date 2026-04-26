import { parseSfxGraphPresetJson, } from './sfx-graph.js';
function cloneJsonValue(value) {
    try {
        if (typeof structuredClone === 'function') {
            return structuredClone(value);
        }
    }
    catch { }
    return JSON.parse(JSON.stringify(value));
}
export function cloneSfxGraphPreset(preset) {
    return cloneJsonValue(preset);
}
export function serializeSfxGraphPreset(preset) {
    return JSON.stringify(preset, null, 2);
}
export function createSfxGraphDocument(preset, options = {}) {
    const document = {
        version: 1,
        preset: cloneSfxGraphPreset(preset),
    };
    if (options.layout) {
        document.layout = cloneJsonValue(options.layout);
    }
    if (options.meta) {
        document.meta = cloneJsonValue(options.meta);
    }
    return document;
}
export function cloneSfxGraphDocument(document) {
    return {
        version: 1,
        preset: cloneSfxGraphPreset(document.preset),
        ...(document.layout ? { layout: cloneJsonValue(document.layout) } : {}),
        ...(document.meta ? { meta: cloneJsonValue(document.meta) } : {}),
    };
}
export function createSfxGraphInstrumentDocument(preset, options = {}) {
    const graphDocument = createSfxGraphDocument(preset, {
        layout: options.layout,
        meta: options.meta,
    });
    return {
        kind: 'stfxr-graph',
        graphDocument,
        sourceText: String(options.sourceText || serializeSfxGraphPreset(graphDocument.preset)),
    };
}
export function cloneSfxGraphInstrumentDocument(instrument) {
    return {
        kind: 'stfxr-graph',
        graphDocument: cloneSfxGraphDocument(instrument.graphDocument),
        sourceText: String(instrument.sourceText || serializeSfxGraphPreset(instrument.graphDocument.preset)),
    };
}
export function normalizeSfxGraphInstrumentDocument(value, fallbackPreset) {
    if (value && 'kind' in value && value.kind === 'stfxr-graph' && value.graphDocument) {
        return cloneSfxGraphInstrumentDocument({
            kind: 'stfxr-graph',
            graphDocument: value.graphDocument,
            sourceText: value.sourceText,
        });
    }
    const legacyPreset = value && 'graphPreset' in value && value.graphPreset
        ? value.graphPreset
        : fallbackPreset;
    const legacyText = value && 'graphText' in value && value.graphText
        ? String(value.graphText)
        : undefined;
    return createSfxGraphInstrumentDocument(legacyPreset, {
        sourceText: legacyText,
    });
}
export function applyPresetToSfxGraphInstrumentDocument(instrument, preset, sourceText) {
    return {
        kind: 'stfxr-graph',
        graphDocument: createSfxGraphDocument(preset, {
            layout: instrument.graphDocument.layout,
            meta: instrument.graphDocument.meta,
        }),
        sourceText: String(sourceText || serializeSfxGraphPreset(preset)),
    };
}
export function parseSfxGraphInstrumentSource(sourceText, instrument) {
    const preset = parseSfxGraphPresetJson(sourceText);
    if (!instrument) {
        return createSfxGraphInstrumentDocument(preset, { sourceText });
    }
    return applyPresetToSfxGraphInstrumentDocument(instrument, preset, sourceText);
}
//# sourceMappingURL=sfx-graph-document.js.map