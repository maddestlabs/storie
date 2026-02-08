/**
 * Core type definitions for S|torie engine
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a?: number;
}

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

export interface MarkdownDocument {
  sections: Section[];
  codeBlocks: CodeBlock[];
  metadata: Record<string, any>;
}

export interface InputEvent {
  type: 'key' | 'text' | 'mouse' | 'mouse_move';
  action?: 'press' | 'release' | 'repeat';
  
  // Keyboard
  key?: string;
  keyCode?: number;
  text?: string;  // For text input
  
  // Mouse
  button?: 'left' | 'middle' | 'right';
  x?: number;
  y?: number;
  
  // Modifiers
  mods?: string[];  // ['shift', 'ctrl', 'alt', 'meta']
}

export interface UserHandlers {
  init?: () => void;
  update?: (delta: number) => void;
  render?: () => void;
  input?: (event: InputEvent) => boolean;  // Returns true to continue, false to quit
}

export interface UserScript {
  id: string;
  handlers: UserHandlers;
  sections: Section[];
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

// Common colors
export const COLORS = {
  BLACK: { r: 0, g: 0, b: 0 },
  WHITE: { r: 255, g: 255, b: 255 },
  RED: { r: 255, g: 0, b: 0 },
  GREEN: { r: 0, g: 255, b: 0 },
  BLUE: { r: 0, g: 0, b: 255 },
  YELLOW: { r: 255, g: 255, b: 0 },
  CYAN: { r: 0, g: 255, b: 255 },
  MAGENTA: { r: 255, g: 0, b: 255 },
} as const;
