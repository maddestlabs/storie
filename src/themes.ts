/**
 * Theme system for S|torie
 * Provides semantic color palettes compatible with tstorie
 */

import type { ThemeColors, ThemeStyleSheet } from './types.js';

/**
 * Built-in theme registry
 * Themes are designed to work well in terminals and UIs
 */
export const THEMES: Record<string, ThemeColors> = {
  neotopia: {
    bg:      { r: 0x00, g: 0x11, b: 0x11 },   // Deep teal
    bgAlt:   { r: 0x09, g: 0x34, b: 0x3a },   // Lighter teal
    fg:      { r: 0xe0, g: 0xe0, b: 0xe0 },   // Bright gray
    fgAlt:   { r: 0x90, g: 0x90, b: 0x90 },   // Medium gray
    accent1: { r: 0x00, g: 0xd9, b: 0x8e },   // Aquamarine
    accent2: { r: 0xff, g: 0xff, b: 0x00 },   // Yellow
    accent3: { r: 0xff, g: 0x00, b: 0x6e }    // Pink
  },
  
  neonopia: {
    bg:      { r: 0x05, g: 0x00, b: 0x00 },   // Deep burgundy
    bgAlt:   { r: 0x34, g: 0x09, b: 0x05 },   // Dark coral
    fg:      { r: 0xa0, g: 0xa0, b: 0xa0 },   // Dark gray
    fgAlt:   { r: 0x6f, g: 0x6f, b: 0x6f },   // Lighter gray
    accent1: { r: 0xff, g: 0x26, b: 0x71 },   // Hot pink
    accent2: { r: 0x00, g: 0x00, b: 0xff },   // Pure blue
    accent3: { r: 0x00, g: 0xff, b: 0x91 }    // Bright mint
  },
  
  catppuccin: {
    bg:      { r: 0x1e, g: 0x1e, b: 0x2e },
    bgAlt:   { r: 0x31, g: 0x32, b: 0x44 },
    fg:      { r: 0xcd, g: 0xd6, b: 0xf4 },
    fgAlt:   { r: 0x6c, g: 0x70, b: 0x86 },
    accent1: { r: 0xf5, g: 0xc2, b: 0xe7 },   // Pink
    accent2: { r: 0x89, g: 0xb4, b: 0xfa },   // Blue
    accent3: { r: 0xa6, g: 0xe3, b: 0xa1 }    // Green
  },
  
  nord: {
    bg:      { r: 0x2e, g: 0x34, b: 0x40 },
    bgAlt:   { r: 0x3b, g: 0x42, b: 0x52 },
    fg:      { r: 0xec, g: 0xef, b: 0xf4 },
    fgAlt:   { r: 0xd8, g: 0xde, b: 0xe9 },
    accent1: { r: 0x88, g: 0xc0, b: 0xd0 },   // Frost cyan
    accent2: { r: 0x81, g: 0xa1, b: 0xc1 },   // Frost teal
    accent3: { r: 0xa3, g: 0xbe, b: 0x8c }    // Aurora green
  },
  
  dracula: {
    bg:      { r: 0x28, g: 0x2a, b: 0x36 },
    bgAlt:   { r: 0x44, g: 0x47, b: 0x5a },
    fg:      { r: 0xf8, g: 0xf8, b: 0xf2 },
    fgAlt:   { r: 0x62, g: 0x72, b: 0xa4 },
    accent1: { r: 0xff, g: 0x79, b: 0xc6 },   // Pink
    accent2: { r: 0x8b, g: 0xe9, b: 0xfd },   // Cyan
    accent3: { r: 0x50, g: 0xfa, b: 0x7b }    // Green
  },
  
  outrun: {
    bg:      { r: 0x1a, g: 0x00, b: 0x33 },
    bgAlt:   { r: 0x2d, g: 0x00, b: 0x55 },
    fg:      { r: 0xf0, g: 0xf0, b: 0xff },
    fgAlt:   { r: 0x8b, g: 0x5c, b: 0xf6 },
    accent1: { r: 0xff, g: 0x00, b: 0x6e },   // Neon pink
    accent2: { r: 0x00, g: 0xf5, b: 0xff },   // Electric cyan
    accent3: { r: 0xff, g: 0xbe, b: 0x0b }    // Golden yellow
  },
  
  alleycat: {
    bg:      { r: 0x0a, g: 0x0a, b: 0x0f },
    bgAlt:   { r: 0x1a, g: 0x1a, b: 0x2e },
    fg:      { r: 0xe0, g: 0xe0, b: 0xff },
    fgAlt:   { r: 0x6b, g: 0x7f, b: 0xd7 },
    accent1: { r: 0x00, g: 0xff, b: 0xff },   // Electric cyan
    accent2: { r: 0xff, g: 0x00, b: 0xff },   // Magenta
    accent3: { r: 0x00, g: 0xff, b: 0x00 }    // Matrix green
  },
  
  terminal: {
    bg:      { r: 0x0a, g: 0x0a, b: 0x0a },
    bgAlt:   { r: 0x1a, g: 0x1a, b: 0x1a },
    fg:      { r: 0x00, g: 0xff, b: 0x00 },
    fgAlt:   { r: 0x00, g: 0x88, b: 0x00 },
    accent1: { r: 0x00, g: 0xff, b: 0x00 },   // Bright green
    accent2: { r: 0x00, g: 0xcc, b: 0x00 },   // Medium green
    accent3: { r: 0x00, g: 0xaa, b: 0x00 }    // Dark green
  },
  
  solardark: {
    bg:      { r: 0x00, g: 0x2b, b: 0x36 },
    bgAlt:   { r: 0x07, g: 0x36, b: 0x42 },
    fg:      { r: 0x83, g: 0x94, b: 0x96 },
    fgAlt:   { r: 0x58, g: 0x6e, b: 0x75 },
    accent1: { r: 0x26, g: 0x8b, b: 0xd2 },   // Blue
    accent2: { r: 0x2a, g: 0xa1, b: 0x98 },   // Cyan
    accent3: { r: 0x85, g: 0x99, b: 0x00 }    // Green
  },
  
  solarlight: {
    bg:      { r: 0xfd, g: 0xf6, b: 0xe3 },
    bgAlt:   { r: 0xee, g: 0xe8, b: 0xd5 },
    fg:      { r: 0x65, g: 0x7b, b: 0x83 },
    fgAlt:   { r: 0x93, g: 0xa1, b: 0xa1 },
    accent1: { r: 0x26, g: 0x8b, b: 0xd2 },   // Blue
    accent2: { r: 0x2a, g: 0xa1, b: 0x98 },   // Cyan
    accent3: { r: 0x85, g: 0x99, b: 0x00 }    // Green
  },
  
  coffee: {
    bg:      { r: 0xf2, g: 0xd3, b: 0xac },   // Cream
    bgAlt:   { r: 0x73, g: 0x14, b: 0x25 },   // Dark burgundy
    fg:      { r: 0x26, g: 0x03, b: 0x24 },   // Deep purple-brown
    fgAlt:   { r: 0xbf, g: 0x8c, b: 0x6f },   // Tan
    accent1: { r: 0xbf, g: 0x34, b: 0x34 },   // Rich red
    accent2: { r: 0xbf, g: 0x8c, b: 0x6f },   // Tan
    accent3: { r: 0xf2, g: 0xd3, b: 0xac }    // Cream accent
  },
  
  stonegarden: {
    bg:      { r: 0x1a, g: 0x1d, b: 0x1e },   // Darker stone
    bgAlt:   { r: 0x2d, g: 0x30, b: 0x32 },   // Elevated surfaces
    fg:      { r: 0xe8, g: 0xe6, b: 0xe3 },   // Soft cream
    fgAlt:   { r: 0x98, g: 0x96, b: 0x93 },   // Muted stone
    accent1: { r: 0x8d, g: 0xb8, b: 0x8d },   // Moss green
    accent2: { r: 0xc4, g: 0xa7, b: 0x77 },   // Warm sand
    accent3: { r: 0x5a, g: 0x7a, b: 0x8e }    // Blue-gray
  }
};

/**
 * Apply a theme to generate a complete style sheet with semantic styles
 */
export function applyTheme(theme: ThemeColors): ThemeStyleSheet {
  return {
    // Default body text
    default: {
      fg: theme.fg,
      bg: theme.bg
    },
    
    // Direct access to theme base colors
    fg: {
      fg: theme.fg,
      bg: theme.bg
    },
    
    bg: {
      fg: theme.fg,
      bg: theme.bg
    },
    
    fgAlt: {
      fg: theme.fgAlt,
      bg: theme.bg
    },
    
    bgAlt: {
      fg: theme.fg,
      bg: theme.bgAlt
    },
    
    // Direct access to accent colors
    accent1: {
      fg: theme.accent1,
      bg: theme.bg
    },
    
    accent2: {
      fg: theme.accent2,
      bg: theme.bg
    },
    
    accent3: {
      fg: theme.accent3,
      bg: theme.bg
    },
    
    // Inverted colors (for hidden cells, selections, etc.)
    inverted: {
      fg: theme.bg,
      bg: theme.fg,
      bold: true
    },
    
    // Dim/muted text
    dim: {
      fg: theme.fgAlt,
      bg: theme.bg
    },
    
    // Primary heading (h1)
    heading: {
      fg: theme.accent1,
      bg: theme.bg,
      bold: true
    },
    
    // Secondary heading (h2)
    heading2: {
      fg: theme.accent2,
      bg: theme.bg,
      bold: true
    },
    
    // Tertiary heading (h3+)
    heading3: {
      fg: theme.accent3,
      bg: theme.bg
    },
    
    // Links
    link: {
      fg: theme.accent2,
      bg: theme.bg,
      underline: false
    },
    
    // Interactive buttons
    button: {
      fg: theme.accent1,
      bg: theme.bgAlt,
      bold: true
    },
    
    // Borders and frames
    border: {
      fg: theme.accent2,
      bg: theme.bg
    },
    
    // Elevated surfaces (cards, panels)
    surface: {
      fg: theme.fg,
      bg: theme.bgAlt
    },
    
    // Code or monospace text
    code: {
      fg: theme.accent3,
      bg: theme.bgAlt
    },
    
    // Warnings and errors
    warning: {
      fg: theme.accent3,
      bg: theme.bg,
      bold: true
    }
  };
}

/**
 * Get a theme by name (case-insensitive)
 * Falls back to neotopia if not found
 */
export function getTheme(name: string): ThemeColors {
  const normalized = name.toLowerCase();
  return THEMES[normalized] || THEMES.neotopia;
}

/**
 * Get list of available theme names
 */
export function getAvailableThemes(): string[] {
  return Object.keys(THEMES);
}
