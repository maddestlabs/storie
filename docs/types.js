/**
 * Core type definitions for S|torie engine
 */
/**
 * Color utility functions for working with packed integers
 */
export const ColorUtils = {
    /**
     * Create a color from RGB components (0-255)
     */
    rgb(r, g, b) {
        return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | 0xFF;
    },
    /**
     * Create a color from RGBA components (0-255)
     */
    rgba(r, g, b, a) {
        return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF);
    },
    /**
     * Extract red component (0-255)
     */
    r(color) {
        return (color >>> 24) & 0xFF;
    },
    /**
     * Extract green component (0-255)
     */
    g(color) {
        return (color >>> 16) & 0xFF;
    },
    /**
     * Extract blue component (0-255)
     */
    b(color) {
        return (color >>> 8) & 0xFF;
    },
    /**
     * Extract alpha component (0-255)
     */
    a(color) {
        return color & 0xFF;
    },
    /**
     * Get normalized RGB components (0-1) for GPU
     */
    rgbNorm(color) {
        return [
            ((color >>> 24) & 0xFF) / 255,
            ((color >>> 16) & 0xFF) / 255,
            ((color >>> 8) & 0xFF) / 255
        ];
    },
    /**
     * Get normalized RGBA components (0-1) for GPU
     */
    rgbaNorm(color) {
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
    toCss(color) {
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
    blend(src, dst, alpha) {
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
    from(color) {
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
                    r = parseInt(h[0] + h[0], 16);
                    g = parseInt(h[1] + h[1], 16);
                    b = parseInt(h[2] + h[2], 16);
                    if (h.length === 4)
                        a = parseInt(h[3] + h[3], 16);
                }
                else if (h.length === 6 || h.length === 8) {
                    r = parseInt(h.slice(0, 2), 16);
                    g = parseInt(h.slice(2, 4), 16);
                    b = parseInt(h.slice(4, 6), 16);
                    if (h.length === 8)
                        a = parseInt(h.slice(6, 8), 16);
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
};
// Common colors (packed RGBA format: 0xRRGGBBAA)
export const COLORS = {
    BLACK: 0x000000FF,
    WHITE: 0xFFFFFFFF,
    RED: 0xFF0000FF,
    GREEN: 0x00FF00FF,
    BLUE: 0x0000FFFF,
    YELLOW: 0xFFFF00FF,
    CYAN: 0x00FFFFFF,
    MAGENTA: 0xFF00FFFF,
};
//# sourceMappingURL=types.js.map