/**
 * Core type definitions for S|torie engine
 */

/**
 * Color represented as packed 32-bit integer: 0xRRGGBBAA
 * For RGB colors without alpha, use 0xRRGGBBFF (full opacity)
 * This format is more efficient for WASM/JS than object-based colors
 */
export type Color = number;

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

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

    // CSS hex string: #rgb, #rgba, #rrggbb, #rrggbbaa
    if (typeof color === 'string') {
      const s = color.trim();
      if (s.startsWith('#')) {
        const h = s.slice(1);
        let r = 0, g = 0, b = 0, a = 0xFF;
        if (h.length === 3 || h.length === 4) {
          r = parseInt(h[0]! + h[0]!, 16);
          g = parseInt(h[1]! + h[1]!, 16);
          b = parseInt(h[2]! + h[2]!, 16);
          if (h.length === 4) a = parseInt(h[3]! + h[3]!, 16);
        } else if (h.length === 6 || h.length === 8) {
          r = parseInt(h.slice(0, 2), 16);
          g = parseInt(h.slice(2, 4), 16);
          b = parseInt(h.slice(4, 6), 16);
          if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
        }
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF);
        }
      }
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
  /**
   * Millisecond start time parsed from a heading directive, e.g.
   * `# Chorus {"timed": "32000ms"}` → timedMs = 32000.
   * When present the section can be advanced automatically when
   * `audio.currentTime * 1000 >= section.timedMs`.
   */
  timedMs?: number;
  /**
   * Full directive object parsed from the heading suffix, e.g.
   * `{"timed":"32000ms", "x":"400", "y":"600"}`.
   * The `timed` key is consumed and stored as `timedMs`; any other keys
   * are left here for user scripts to interpret freely.
   */
  directive?: Record<string, any>;
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

// ── Timed lyric / transcript blocks (```timed name:...) ─────────────────────

/**
 * A single timestamped entry in a timed block.
 * `ms`   — playhead position in milliseconds at which this text becomes active.
 * `text` — the line or word to display.
 */
export interface TimedEntry {
  ms: number;
  text: string;
}

/**
 * A named set of timestamped entries parsed from a ```timed fenced block.
 * Entries are guaranteed sorted by `ms` ascending.
 *
 * Example block:
 * ```timed name:lyrics
 * 0|Intro line
 * 2400|First verse line one
 * 5200|First verse line two
 * ```
 */
export interface TimedBlock {
  name: string;
  entries: TimedEntry[];
  startLine: number;
  endLine: number;
}

export type BlobEncoding = 'base64' | 'hex';

export interface BlobBlock {
  name: string;
  mime: string;
  encoding: BlobEncoding;
  data: string; // encoded payload (e.g. base64), whitespace allowed
  /**
   * If true, `data` is a base64-encoded, deflate-raw compressed UTF-8 string.
   * It will be decompressed during markdown parsing.
   */
  magic?: boolean;
  startLine: number;
  endLine: number;
}

export interface MarkdownDocument {
  sections: Section[];
  codeBlocks: CodeBlock[];
  metadata: Record<string, any>;
  wgslShaders?: WGSLShader[];  // Parsed WGSL shaders from ```wgsl blocks
  blobBlocks?: BlobBlock[];    // Parsed binary blobs from ```blob blocks
  timedBlocks?: TimedBlock[];  // Parsed timed lyric/transcript blocks from ```timed blocks
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
  /** Called once when a video export begins (after the engine enters export mode). */
  export?: (options?: { timedBlock?: string | null }) => void;
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
