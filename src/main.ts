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

export { KEY, COLORS } from './types.js';

// Version
export const VERSION = '2.0.0-alpha.1';

console.log(`S|torie v${VERSION}`);
