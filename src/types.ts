/**
 * Core type definitions for S|torie engine
 */

/**
 * Color represented as packed 32-bit integer: 0xRRGGBBAA
 * For RGB colors without alpha, use 0xRRGGBBFF (full opacity)
 * This format is more efficient for WASM/JS than object-based colors
 */
export type Color = number;

/**
 * Color utility functions for working with packed integers
 */
export const ColorUtils = {
  /**
   * Create a color from RGB components (0-255)
   */
  rgb(r: number, g: number, b: number): Color {
    return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | 0xFF;
  },

  /**
   * Create a color from RGBA components (0-255)
   */
  rgba(r: number, g: number, b: number, a: number): Color {
    return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF);
  },

  /**
   * Extract red component (0-255)
   */
  r(color: Color): number {
    return (color >>> 24) & 0xFF;
  },

  /**
   * Extract green component (0-255)
   */
  g(color: Color): number {
    return (color >>> 16) & 0xFF;
  },

  /**
   * Extract blue component (0-255)
   */
  b(color: Color): number {
    return (color >>> 8) & 0xFF;
  },

  /**
   * Extract alpha component (0-255)
   */
  a(color: Color): number {
    return color & 0xFF;
  },

  /**
   * Get normalized RGB components (0-1) for GPU
   */
  rgbNorm(color: Color): [number, number, number] {
    return [
      ((color >>> 24) & 0xFF) / 255,
      ((color >>> 16) & 0xFF) / 255,
      ((color >>> 8) & 0xFF) / 255
    ];
  },

  /**
   * Get normalized RGBA components (0-1) for GPU
   */
  rgbaNorm(color: Color): [number, number, number, number] {
    return [
      ((color >>> 24) & 0xFF) / 255,
      ((color >>> 16) & 0xFF) / 255,
      ((color >>> 8) & 0xFF) / 255,
      (color & 0xFF) / 255
    ];
  },

  /**
   * Convert to CSS color string
   */
  toCss(color: Color): string {
    const r = (color >>> 24) & 0xFF;
    const g = (color >>> 16) & 0xFF;
    const b = (color >>> 8) & 0xFF;
    const a = color & 0xFF;
    
    if (a === 0xFF) {
      return `rgb(${r}, ${g}, ${b})`;
    }
    return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
  },

  /**
   * Blend two colors with alpha
   */
  blend(src: Color, dst: Color, alpha: number): Color {
    const invAlpha = 1 - alpha;
    const sr = ((src >>> 24) & 0xFF);
    const sg = ((src >>> 16) & 0xFF);
    const sb = ((src >>> 8) & 0xFF);
    const dr = ((dst >>> 24) & 0xFF);
    const dg = ((dst >>> 16) & 0xFF);
    const db = ((dst >>> 8) & 0xFF);
    
    const r = Math.round(sr * alpha + dr * invAlpha);
    const g = Math.round(sg * alpha + dg * invAlpha);
    const b = Math.round(sb * alpha + db * invAlpha);
    
    return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | 0xFF;
  },

  /**
   * Convert from any color format to packed integer
   * Supports both new packed format and legacy object format {r, g, b, a?}
   * This provides backward compatibility for user code
   */
  from(color: Color | { r: number; g: number; b: number; a?: number } | any): Color {
    // Already a number (packed format)
    if (typeof color === 'number') {
      return color;
    }
    
    // Legacy object format
    if (color && typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
      const r = Math.round(color.r) & 0xFF;
      const g = Math.round(color.g) & 0xFF;
      const b = Math.round(color.b) & 0xFF;
      const a = color.a !== undefined ? Math.round(color.a * 255) & 0xFF : 0xFF;
      return (r << 24) | (g << 16) | (b << 8) | a;
    }
    
    // Fallback to white
    return 0xFFFFFFFF;
  }
};

export interface Cell {
  char: string;
  fg: Color;
  bg: Color;
}

export interface Style {
  fg?: Color;
  bg?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface Section {
  title: string;
  level: number; // 1-6 for h1-h6
  content: string;
  startLine: number;
  endLine: number;
  children: Section[];
}

export interface CodeBlock {
  lang: string;
  code: string;
  startLine: number;
  endLine: number;
  metadata?: Record<string, string>; // e.g., { "on": "init" }
}

export type WGSLShaderKind = 'compute' | 'vertex' | 'fragment';

export interface WGSLShader {
  name: string;
  code: string;
  kind: WGSLShaderKind;
  uniforms: string[];          // Parsed uniform field names
  bindings: number[];          // Detected @binding() numbers
  workgroupSize: [number, number, number]; // For compute shaders
}

export type BlobEncoding = 'base64' | 'hex';

export interface BlobBlock {
  name: string;
  mime: string;
  encoding: BlobEncoding;
  data: string; // encoded payload (e.g. base64), whitespace allowed
  startLine: number;
  endLine: number;
}

export interface MarkdownDocument {
  sections: Section[];
  codeBlocks: CodeBlock[];
  metadata: Record<string, any>;
  wgslShaders?: WGSLShader[];  // Parsed WGSL shaders from ```wgsl blocks
  blobBlocks?: BlobBlock[];    // Parsed binary blobs from ```blob blocks
}

export interface InputEvent {
  type: 'key' | 'keydown' | 'keyup' | 'text' | 'mouse' | 'mouse_move';
  action?: 'press' | 'release' | 'repeat';
  
  // Keyboard
  key?: string;
  keyCode?: number;
  text?: string;  // For text input
  
  // Mouse (pixel coordinates - matches DOM/Canvas standard)
  button?: 'left' | 'middle' | 'right';
  x?: number;      // Pixel X coordinate (relative to canvas)
  y?: number;      // Pixel Y coordinate (relative to canvas)
  cellX?: number;  // Terminal cell X coordinate (for TUI/text-based games)
  cellY?: number;  // Terminal cell Y coordinate (for TUI/text-based games)
  
  // Modifiers
  mods?: string[];  // ['shift', 'ctrl', 'alt', 'meta']
}

export interface DroppedFile {
  name: string;
  size: number;
  mime: string;
  bytes: Uint8Array;
  lastModified?: number;
}

export interface UserHandlers {
  init?: () => void;
  update?: (delta: number) => void;
  render?: () => void;
  input?: (event: InputEvent) => boolean;  // Returns true to continue, false to quit
  drop?: (file: DroppedFile) => void;
}

export interface UserScript {
  id: string;
  handlers: UserHandlers;
  sections: Section[];
  metadata?: Record<string, any>;
}

export interface InputState {
  keys: Map<string, boolean>;
  keysPressed: Set<string>;
  keysReleased: Set<string>;
  mouseX: number;
  mouseY: number;
  mouseButtons: Map<number, boolean>;
  mouseButtonsClicked: Set<number>;
}

// Key code constants
export const KEY = {
  SPACE: ' ',
  ENTER: 'Enter',
  ESC: 'Escape',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  TAB: 'Tab',
  BACKSPACE: 'Backspace',
  DELETE: 'Delete',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown'
} as const;

// Theme system types
export interface ThemeColors {
  bg: Color;       // Primary background
  bgAlt: Color;    // Secondary/elevated surfaces
  fg: Color;       // Primary text
  fgAlt: Color;    // Secondary/muted text
  accent1: Color;  // Primary accent
  accent2: Color;  // Secondary accent
  accent3: Color;  // Tertiary accent
}

export interface NamedStyle {
  fg: Color;
  bg: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
}

export interface ThemeStyleSheet {
  // Standard semantic styles
  default: NamedStyle;
  accent1: NamedStyle;
  accent2: NamedStyle;
  accent3: NamedStyle;
  inverted: NamedStyle;
  dim: NamedStyle;
  
  // UI element styles
  heading: NamedStyle;
  heading2: NamedStyle;
  heading3: NamedStyle;
  link: NamedStyle;
  button: NamedStyle;
  border: NamedStyle;
  surface: NamedStyle;
  code: NamedStyle;
  warning: NamedStyle;
  
  // Allow custom styles
  [key: string]: NamedStyle;
}

// Common colors (packed RGBA format: 0xRRGGBBAA)
export const COLORS = {
  BLACK:   0x000000FF,
  WHITE:   0xFFFFFFFF,
  RED:     0xFF0000FF,
  GREEN:   0x00FF00FF,
  BLUE:    0x0000FFFF,
  YELLOW:  0xFFFF00FF,
  CYAN:    0x00FFFFFF,
  MAGENTA: 0xFF00FFFF,
} as const;
