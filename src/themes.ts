/**
 * Theme system for S|torie
 * Provides semantic color palettes compatible with tstorie
 * Colors are stored as packed 32-bit integers (0xRRGGBBAA) for optimal WASM performance
 */

import type { ThemeColors, ThemeStyleSheet } from './types.js';

/**
 * Built-in theme registry
 * Themes are designed to work well in terminals and UIs
 * Format: 0xRRGGBBAA (Red, Green, Blue, Alpha as hex bytes)
 */
export const THEMES: Record<string, ThemeColors> = {
  saintbilly: {
    // Old-western, light theme: parchment-ish gray with a subtle red-brown tint
    bg:      0xF4EEEAFF,   // Warm paper (slight red-brown)
    bgAlt:   0xE6DFDAFF,   // Raised paper
    fg:      0x2A2A2CFF,   // Near-black ink
    fgAlt:   0x6C6C6EFF,   // Muted gray
    accent1: 0x7A1414FF,   // Dark red
    accent2: 0x3A3A3CFF,   // Charcoal (links/secondary)
    accent3: 0x7D7D80FF,   // Mid gray (tertiary)
  },

  neotopia: {
    bg:      0x090909FF,   // Dark gray
    bgAlt:   0x09343AFF,   // Lighter teal
    fg:      0xE0E0E0FF,   // Bright gray
    fgAlt:   0x909090FF,   // Medium gray
    accent1: 0x00D98EFF,   // Aquamarine
    accent2: 0xFF0000FF,   // Bold red
    accent3: 0xFF006EFF,   // Pink
  },

  aquatopia: {
    bg:      0x001111FF,   // Deep teal
    bgAlt:   0x09343AFF,   // Lighter teal
    fg:      0xE0E0E0FF,   // Bright gray
    fgAlt:   0x909090FF,   // Medium gray
    accent1: 0x00D98EFF,   // Aquamarine
    accent2: 0xFFFF00FF,   // Yellow
    accent3: 0xFF006EFF,   // Pink
  },
  
  neonopia: {
    bg:      0x050000FF,   // Deep burgundy
    bgAlt:   0x340905FF,   // Dark coral
    fg:      0xA0A0A0FF,   // Dark gray
    fgAlt:   0x6F6F6FFF,   // Lighter gray
    accent1: 0xFF2671FF,   // Hot pink
    accent2: 0x0000FFFF,   // Pure blue
    accent3: 0x00FF91FF,   // Bright mint
  },
  
  catppuccin: {
    bg:      0x1E1E2EFF,
    bgAlt:   0x313244FF,
    fg:      0xCDD6F4FF,
    fgAlt:   0x6C7086FF,
    accent1: 0xF5C2E7FF,   // Pink
    accent2: 0x89B4FAFF,   // Blue
    accent3: 0xA6E3A1FF,   // Green
  },
  
  nord: {
    bg:      0x2E3440FF,
    bgAlt:   0x3B4252FF,
    fg:      0xECEFF4FF,
    fgAlt:   0xD8DEE9FF,
    accent1: 0x88C0D0FF,   // Frost cyan
    accent2: 0x81A1C1FF,   // Frost teal
    accent3: 0xA3BE8CFF,   // Aurora green
  },
  
  dracula: {
    bg:      0x282A36FF,
    bgAlt:   0x44475AFF,
    fg:      0xF8F8F2FF,
    fgAlt:   0x6272A4FF,
    accent1: 0xFF79C6FF,   // Pink
    accent2: 0x8BE9FDFF,   // Cyan
    accent3: 0x50FA7BFF,   // Green
  },
  
  outrun: {
    bg:      0x1A0033FF,
    bgAlt:   0x2D0055FF,
    fg:      0xF0F0FFFF,
    fgAlt:   0x8B5CF6FF,
    accent1: 0xFF006EFF,   // Neon pink
    accent2: 0x00F5FFFF,   // Electric cyan
    accent3: 0xFFBE0BFF,   // Golden yellow
  },
  
  alleycat: {
    bg:      0x0A0A0FFF,
    bgAlt:   0x1A1A2EFF,
    fg:      0xE0E0FFFF,
    fgAlt:   0x6B7FD7FF,
    accent1: 0x00FFFFFF,   // Electric cyan
    accent2: 0xFF00FFFF,   // Magenta
    accent3: 0x00FF00FF,   // Matrix green
  },
  
  terminal: {
    bg:      0x0A0A0AFF,
    bgAlt:   0x1A1A1AFF,
    fg:      0x00FF00FF,
    fgAlt:   0x008800FF,
    accent1: 0x00FF00FF,   // Bright green
    accent2: 0x00CC00FF,   // Medium green
    accent3: 0x00AA00FF,   // Dark green
  },
  
  solardark: {
    bg:      0x002B36FF,
    bgAlt:   0x073642FF,
    fg:      0x839496FF,
    fgAlt:   0x586E75FF,
    accent1: 0x268BD2FF,   // Blue
    accent2: 0x2AA198FF,   // Cyan
    accent3: 0x859900FF,   // Green
  },
  
  solarlight: {
    bg:      0xFDF6E3FF,
    bgAlt:   0xEEE8D5FF,
    fg:      0x657B83FF,
    fgAlt:   0x93A1A1FF,
    accent1: 0x268BD2FF,   // Blue
    accent2: 0x2AA198FF,   // Cyan
    accent3: 0x859900FF,   // Green
  },
  
  coffee: {
    bg:      0xF2D3ACFF,   // Cream
    bgAlt:   0x731425FF,   // Dark burgundy
    fg:      0x260324FF,   // Deep purple-brown
    fgAlt:   0xBF8C6FFF,   // Tan
    accent1: 0xBF3434FF,   // Rich red
    accent2: 0xBF8C6FFF,   // Tan
    accent3: 0xF2D3ACFF,   // Cream accent
  },
  
  stonegarden: {
    bg:      0x1A1D1EFF,   // Darker stone
    bgAlt:   0x2D3032FF,   // Elevated surfaces
    fg:      0xE8E6E3FF,   // Soft cream
    fgAlt:   0x989693FF,   // Muted stone
    accent1: 0x8DB88DFF,   // Moss green
    accent2: 0xC4A777FF,   // Warm sand
    accent3: 0x5A7A8EFF,   // Blue-gray
  },
  
  zerorain: {
    bg:      0x101417FF,   // Gray
    bgAlt:   0x182626FF,   // Slightly lighter teal-gray
    fg:      0xAAAAAAFF,   // Light white (~#ccc)
    fgAlt:   0x606060FF,   // Medium gray
    accent2: 0xFFCC00FF,   // Yellow
    accent1: 0x00E5FFFF,   // Cyan
    accent3: 0xFFFFFFFF,   // Bright white (#fff)
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
