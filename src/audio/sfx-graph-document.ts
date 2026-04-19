import {
  parseSfxGraphPresetJson,
  type SfxGraphPreset,
} from './sfx-graph.js';

export interface SfxGraphDocumentLayout {
  nodes?: Record<string, { x: number; y: number }>;
  camera?: { x: number; y: number; zoom?: number };
  groups?: Array<Record<string, unknown>>;
}

export interface SfxGraphDocumentMeta {
  name?: string;
  tags?: string[];
}

export interface SfxGraphDocument {
  version: 1;
  preset: SfxGraphPreset;
  layout?: SfxGraphDocumentLayout;
  meta?: SfxGraphDocumentMeta;
}

export interface SfxGraphInstrumentDocument {
  kind: 'stfxr-graph';
  graphDocument: SfxGraphDocument;
  sourceText: string;
}

export interface LegacySfxGraphInstrumentShape {
  graphPreset?: SfxGraphPreset;
  graphText?: string;
}

function cloneJsonValue<T>(value: T): T {
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
  } catch {}
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneSfxGraphPreset(preset: SfxGraphPreset): SfxGraphPreset {
  return cloneJsonValue(preset);
}

export function serializeSfxGraphPreset(preset: SfxGraphPreset): string {
  return JSON.stringify(preset, null, 2);
}

export function createSfxGraphDocument(
  preset: SfxGraphPreset,
  options: {
    layout?: SfxGraphDocumentLayout;
    meta?: SfxGraphDocumentMeta;
  } = {}
): SfxGraphDocument {
  const document: SfxGraphDocument = {
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

export function cloneSfxGraphDocument(document: SfxGraphDocument): SfxGraphDocument {
  return {
    version: 1,
    preset: cloneSfxGraphPreset(document.preset),
    ...(document.layout ? { layout: cloneJsonValue(document.layout) } : {}),
    ...(document.meta ? { meta: cloneJsonValue(document.meta) } : {}),
  };
}

export function createSfxGraphInstrumentDocument(
  preset: SfxGraphPreset,
  options: {
    sourceText?: string;
    layout?: SfxGraphDocumentLayout;
    meta?: SfxGraphDocumentMeta;
  } = {}
): SfxGraphInstrumentDocument {
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

export function cloneSfxGraphInstrumentDocument(
  instrument: SfxGraphInstrumentDocument
): SfxGraphInstrumentDocument {
  return {
    kind: 'stfxr-graph',
    graphDocument: cloneSfxGraphDocument(instrument.graphDocument),
    sourceText: String(instrument.sourceText || serializeSfxGraphPreset(instrument.graphDocument.preset)),
  };
}

export function normalizeSfxGraphInstrumentDocument(
  value: SfxGraphInstrumentDocument | LegacySfxGraphInstrumentShape | null | undefined,
  fallbackPreset: SfxGraphPreset
): SfxGraphInstrumentDocument {
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

export function applyPresetToSfxGraphInstrumentDocument(
  instrument: SfxGraphInstrumentDocument,
  preset: SfxGraphPreset,
  sourceText?: string
): SfxGraphInstrumentDocument {
  return {
    kind: 'stfxr-graph',
    graphDocument: createSfxGraphDocument(preset, {
      layout: instrument.graphDocument.layout,
      meta: instrument.graphDocument.meta,
    }),
    sourceText: String(sourceText || serializeSfxGraphPreset(preset)),
  };
}

export function parseSfxGraphInstrumentSource(
  sourceText: string,
  instrument?: SfxGraphInstrumentDocument
): SfxGraphInstrumentDocument {
  const preset = parseSfxGraphPresetJson(sourceText);
  if (!instrument) {
    return createSfxGraphInstrumentDocument(preset, { sourceText });
  }
  return applyPresetToSfxGraphInstrumentDocument(instrument, preset, sourceText);
}
