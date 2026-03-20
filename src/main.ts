/**
 * S|torie - Interactive Stories Engine
 * Main entry point
 */

export { StorieEngine } from './engine.js';
export { LayerStack, Layer } from './layers.js';
export { InputManager } from './input.js';
export { Canvas2DRenderer } from './renderer.js';
export { WebGPURenderer } from './webgpu-renderer.js';
export { parseMarkdown, findSection, flattenSections } from './markdown.js';
export { getTheme, applyTheme, getAvailableThemes, THEMES } from './themes.js';
export { ModuleLoader } from './modules/loader.js';
export { BuiltInModules } from './modules/types.js';
export { WorldsRenderer } from './worlds-renderer.js';
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
