/**
 * S|torie - Interactive Stories Engine
 * Main entry point
 */

export { StorieEngine } from './engine.js';
export { LayerStack, Layer } from './layers.js';
export { InputManager } from './input.js';
export { Canvas2DRenderer } from './renderer.js';
export { WebGPURenderer } from './webgpu-renderer.js';
export { compileMarkdownApp } from './compile/compile.js';
export { validateMarkdownApp } from './compile/compile.js';
export { CompilePolicyError } from './compile/compile.js';
export { analyzeMarkdownDocument } from './compile/analyze.js';
export { parseMarkdownContentReference, resolveMarkdownSource } from './content-source.js';
export { parseMarkdown, findSection, flattenSections } from './markdown.js';
export { getTheme, applyTheme, getAvailableThemes, THEMES } from './themes.js';
export { ModuleLoader } from './modules/loader.js';
export { BuiltInModules } from './modules/types.js';
export { WorldsRenderer } from './worlds-renderer.js';
export {
  cloneSfxGraphPreset,
  serializeSfxGraphPreset,
  createSfxGraphDocument,
  cloneSfxGraphDocument,
  createSfxGraphInstrumentDocument,
  cloneSfxGraphInstrumentDocument,
  normalizeSfxGraphInstrumentDocument,
  applyPresetToSfxGraphInstrumentDocument,
  parseSfxGraphInstrumentSource,
} from './audio/sfx-graph-document.js';
export {
  createSequencerTrack,
  normalizeSequencerTrack,
  graphPresetForSequencerTrack,
  graphSourceTextForSequencerTrack,
  applyPresetToSequencerTrack,
  createSequencerDocument,
} from './sequencer/document.js';
export {
  stateAtWorldsContent,
} from './worlds-content.js';
export {
  compileWorldsTimeline,
  stateAtWorldsTimeline,
  mergeWorldsTimelinePatch,
  getWorldsTimelineSelectorKey,
} from './worlds-timeline.js';
export {
  createCamera3D,
  updateCamera3D,
  createSection3DLayouts,
  getDefaultWorldsConfig,
  focusOnSection,
  vec3,
  lerp,
  lerpAngle,
  lerpVec3,
  lerpRotation,
  distance
} from './worlds.js';

export type {
  CompileTarget,
  CompilePortabilityProfile,
  CompileCapabilityName,
  CompileLifecycleHook,
  CompileAppIR,
  CompileBehaviorBlock,
  CompileSectionNode,
  CompileWarning,
  CompileWarningSeverity,
  CompileWarningCategory,
} from './compile/ir.js';

export type {
  CompileManifest,
  CompileManifestLifecycleUsage,
  CompileManifestAssetSummary,
} from './compile/manifest.js';

export type {
  CompileAnalysis,
} from './compile/analyze.js';

export type {
  CompileMarkdownAppOptions,
  CompiledMarkdownApp,
  ValidatedMarkdownApp,
} from './compile/compile.js';

export type {
  MarkdownContentSourceKind,
  ParsedMarkdownContentReference,
  ResolvedMarkdownSource,
  ResolveMarkdownSourceOptions,
} from './content-source.js';

export type {
  Color,
  Cell,
  Style,
  Section,
  CodeBlock,
  MarkdownDocument,
  UserHandlers,
  UserScript,
  InputState,
  InputEvent,
  AudioAssetHandle,
  AudioVoiceHandle,
  ThemeColors,
  ThemeStyleSheet,
  NamedStyle
} from './types.js';

export type {
  StorieModule,
  ModuleMetadata,
  ModuleLoadOptions,
  ModuleResolver,
  ModuleLoaderEvents,
  ModuleResolverConfig,
  BuiltInModuleName
} from './modules/types.js';

export type {
  Vec3,
  Transform3D,
  Camera3D,
  Section3DLayout,
  WorldsConfig
} from './worlds-types.js';

export type {
  WorldsContentTimedEntry,
  WorldsContentMode,
  WorldsContentTarget,
  WorldsContentState,
  WorldsContentStateOptions,
} from './worlds-content.js';

export type {
  SfxGraphDocumentLayout,
  SfxGraphDocumentMeta,
  SfxGraphDocument,
  SfxGraphInstrumentDocument,
  LegacySfxGraphInstrumentShape,
} from './audio/sfx-graph-document.js';

export type {
  SequencerNote,
  SequencerPattern,
  SequencerTrack,
  LegacySequencerTrack,
  SequencerDocument,
  CreateSequencerTrackOptions,
  CreateSequencerDocumentOptions,
} from './sequencer/document.js';

export type {
  WorldsTimelineSectionSelector,
  WorldsTimelineVec3,
  WorldsTimelinePatch,
  WorldsTimelineEvent,
  WorldsTimelineStateEntry,
  CompiledWorldsTimeline,
} from './worlds-timeline.js';

export { KEY, COLORS } from './types.js';

// Version
export const VERSION = '2.0.0-alpha.1';
