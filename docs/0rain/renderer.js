/**
 * Canvas 2D renderer for terminal-style graphics
 * Falls back to standard Canvas API when WebGPU is unavailable
 */
import { ColorUtils, COLORS } from './types.js';
import { getPrimaryFontFamily, measureMonospaceCellWidth, tryLoadGoogleFontFamily } from './font-loading.js';
export class Canvas2DRenderer {
    canvas;
    ctx;
    width;
    height;
    // Font settings
    fontFamily;
    fontSize;
    cellWidth;
    cellHeight;
    // Font loaded flag
    fontLoaded = false;
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.width = 80;
        this.height = 24;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Failed to get 2D context');
        }
        this.ctx = ctx;
        // Configure font
        this.fontFamily = config.fontFamily || '\'3270-regular\', \'Consolas\', \'Monaco\', monospace';
        this.fontSize = config.fontSize || 16;
        // Measure font dimensions.
        // Like tStorie, use fontSize directly for row height to avoid gaps.
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.cellWidth = config.cellWidth || measureMonospaceCellWidth(this.ctx);
        this.cellHeight = config.cellHeight || Math.max(1, Math.round(this.fontSize));
        this.setupCanvas();
        this.waitForFont();
    }
    async waitForFont() {
        try {
            // Best-effort: if the primary family is a Google Font, pull it in.
            // Time-bounded so offline/native environments don't hang.
            try {
                const primary = getPrimaryFontFamily(this.fontFamily);
                if (primary) {
                    await tryLoadGoogleFontFamily(primary, {
                        timeoutMs: 1500,
                        fontCssPixelSize: this.fontSize,
                        display: 'swap'
                    });
                }
            }
            catch {
                // ignore
            }
            // Wait for the font to be loaded
            await document.fonts.load(`${this.fontSize}px ${this.fontFamily}`);
            // Update context with loaded font
            this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
            this.cellWidth = measureMonospaceCellWidth(this.ctx);
            this.fontLoaded = true;
        }
        catch (e) {
            console.warn('Font loading failed, using fallback:', e);
            this.fontLoaded = true;
        }
    }
    setupCanvas() {
        // Canvas dimensions are managed externally (viewport-driven, DPR-aware).
        // Apply the device pixel ratio as a context transform so all draw calls
        // are specified in logical (CSS) pixels and rendered at physical resolution.
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        // Configure context
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';
        // Enable smoother text rendering
        this.ctx.imageSmoothingEnabled = true;
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        // Re-apply context transform in case the canvas buffer was resized externally.
        this.setupCanvas();
    }
    getCharWidth() {
        return this.cellWidth;
    }
    getCharHeight() {
        return this.cellHeight;
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    /**
     * Render a buffer of cells to the canvas
     */
    render(buffer) {
        if (!this.fontLoaded)
            return;
        // Clear canvas
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Render each cell
        for (let y = 0; y < Math.min(buffer.length, this.height); y++) {
            const row = buffer[y];
            for (let x = 0; x < Math.min(row.length, this.width); x++) {
                const cell = row[x];
                this.renderCell(x, y, cell);
            }
        }
    }
    renderCell(x, y, cell) {
        const px = x * this.cellWidth;
        const py = y * this.cellHeight;
        // Draw background with extra clearance above/below to eliminate artifacts
        this.ctx.fillStyle = ColorUtils.toCss(cell.bg);
        this.ctx.fillRect(px, py - 2, this.cellWidth, this.cellHeight + 4);
        // Draw character if not space
        if (cell.char && cell.char !== ' ') {
            this.ctx.fillStyle = ColorUtils.toCss(cell.fg);
            this.ctx.fillText(cell.char, px + 1, py);
        }
    }
    /**
     * Clear the canvas
     */
    clear(color = COLORS.BLACK) {
        this.ctx.fillStyle = ColorUtils.toCss(color);
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
    createDraw2D() {
        return {
            rect: (x, y, w, h, color) => {
                this.ctx.fillStyle = ColorUtils.toCss(color);
                this.ctx.fillRect(x, y, w, h);
            },
            text: (text, x, y, color, scale = 1) => {
                const nextScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
                const prevFont = this.ctx.font;
                const prevBaseline = this.ctx.textBaseline;
                const prevAlign = this.ctx.textAlign;
                this.ctx.font = `${Math.max(1, this.fontSize * nextScale)}px ${this.fontFamily}`;
                this.ctx.textBaseline = 'top';
                this.ctx.textAlign = 'left';
                this.ctx.fillStyle = ColorUtils.toCss(color);
                this.ctx.fillText(text, x, y);
                this.ctx.font = prevFont;
                this.ctx.textBaseline = prevBaseline;
                this.ctx.textAlign = prevAlign;
            },
            measureTextWidth: (text, scale = 1) => {
                const nextScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
                const prevFont = this.ctx.font;
                this.ctx.font = `${Math.max(1, this.fontSize * nextScale)}px ${this.fontFamily}`;
                const width = this.ctx.measureText(text).width;
                this.ctx.font = prevFont;
                return width;
            },
            clear: (color) => {
                this.ctx.fillStyle = ColorUtils.toCss(color);
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            },
            metrics: {
                charWidth: this.cellWidth,
                charHeight: this.cellHeight,
            },
        };
    }
}
//# sourceMappingURL=renderer.js.map