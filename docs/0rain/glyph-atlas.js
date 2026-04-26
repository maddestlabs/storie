/**
 * Glyph Atlas Manager
 * Manages font rasterization and glyph texture atlas
 * Uses Canvas2D for text rendering, exports to GPU texture
 */
import { getPrimaryFontFamily, measureMonospaceCellWidth, tryLoadGoogleFontFamily } from './font-loading.js';
export class GlyphAtlas {
    fontFamily;
    fontSize;
    atlasWidth;
    atlasHeight;
    // Canvas2D for rasterization
    atlasCanvas;
    atlasCtx;
    // Glyph cache
    glyphCache = new Map();
    // Atlas packing state
    atlasX = 0;
    atlasY = 0;
    atlasRowHeight = 0;
    // GPU resources
    atlasTexture = null;
    atlasSampler = null;
    atlasNeedsUpload = false;
    // Metrics
    charWidth = 0;
    charHeight = 0;
    fontLoggedOnce = false;
    constructor(config = {}) {
        this.fontFamily = config.fontFamily || '\'3270-regular\', \'Consolas\', \'Monaco\', monospace';
        this.fontSize = config.fontSize || 16;
        this.atlasWidth = config.atlasWidth || 2048;
        this.atlasHeight = config.atlasHeight || 2048;
        // Create canvas for rasterization
        this.atlasCanvas = document.createElement('canvas');
        this.atlasCanvas.width = this.atlasWidth;
        this.atlasCanvas.height = this.atlasHeight;
        const ctx = this.atlasCanvas.getContext('2d', {
            alpha: true,
            willReadFrequently: true
        });
        if (!ctx)
            throw new Error('Failed to create atlas context');
        this.atlasCtx = ctx;
        this.initFont();
    }
    initFont() {
        // Quote font family if needed
        const fontString = this.fontFamily.includes(',')
            ? this.fontFamily
            : `'${this.fontFamily}'`;
        // Match classic terminal behavior (and tStorie): treat 1 cell row as exactly
        // `fontSize` pixels tall. Using font bounding boxes tends to introduce extra
        // leading and creates visible gaps between stacked glyph rows.
        const fontSizePx = Math.max(1, Math.round(this.fontSize));
        this.atlasCtx.font = `${fontSizePx}px ${fontString}`;
        this.atlasCtx.textBaseline = 'top';
        this.atlasCtx.textAlign = 'left';
        // Measure character dimensions
        this.charWidth = measureMonospaceCellWidth(this.atlasCtx);
        // Terminal cell height: exactly one font-size.
        this.charHeight = fontSizePx;
        console.log(`[GlyphAtlas] Font initialized: ${this.atlasCtx.font}`);
        console.log(`[GlyphAtlas] Base char size: ${this.charWidth}x${this.charHeight}px`);
    }
    /**
     * Initialize GPU resources
     */
    async initGPU(context) {
        const device = context.getDevice();
        if (!device)
            throw new Error('WebGPU device not available');
        // If the primary font looks like a Google Font family, try to load it.
        // This is best-effort and time-bounded; we still proceed with local fallbacks.
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
        // Wait for fonts to load
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
            try {
                const fontString = this.fontFamily.includes(',')
                    ? this.fontFamily
                    : `'${this.fontFamily}'`;
                await document.fonts.load(`${this.fontSize}px ${fontString}`);
                console.log(`[GlyphAtlas] Loaded font: ${fontString}`);
            }
            catch (e) {
                console.warn('[GlyphAtlas] Font load failed, continuing anyway:', e);
            }
        }
        // IMPORTANT: the constructor measures metrics before fonts are guaranteed
        // to be available. Re-measure now so charWidth/charHeight match the actual
        // resolved font face and fontsize.
        this.initFont();
        // Create atlas texture
        this.atlasTexture = device.createTexture({
            size: [this.atlasWidth, this.atlasHeight],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT
        });
        // Create sampler
        this.atlasSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });
        console.log('[GlyphAtlas] GPU resources initialized');
    }
    /**
     * Cache a single glyph
     */
    cacheGlyph(char) {
        if (this.glyphCache.has(char)) {
            return this.glyphCache.get(char);
        }
        // Ensure font is set
        const fontString = this.fontFamily.includes(',')
            ? this.fontFamily
            : `'${this.fontFamily}'`;
        const fontSizePx = Math.max(1, Math.round(this.fontSize));
        this.atlasCtx.font = `${fontSizePx}px ${fontString}`;
        this.atlasCtx.textBaseline = 'top';
        // Log font once
        if (!this.fontLoggedOnce) {
            console.log(`[GlyphAtlas] Caching glyphs with font: ${this.atlasCtx.font}`);
            this.fontLoggedOnce = true;
        }
        // Measure glyph
        const metrics = this.atlasCtx.measureText(char);
        const glyphWidth = Math.ceil(metrics.width);
        // Add extra padding to prevent bleeding from adjacent rows
        const padding = 4; // 4px padding to catch all artifacts
        const width = glyphWidth + padding * 2;
        const height = this.charHeight + padding * 2;
        // Check if we need a new row
        if (this.atlasX + width > this.atlasWidth) {
            this.atlasX = 0;
            this.atlasY += this.atlasRowHeight;
            this.atlasRowHeight = 0;
        }
        // Check if we're out of space
        if (this.atlasY + height > this.atlasHeight) {
            console.warn('[GlyphAtlas] Atlas full! Cannot cache more glyphs.');
            // Return a fallback glyph info
            return {
                u: 0, v: 0, w: 0, h: 0,
                pixelWidth: this.charWidth,
                pixelHeight: this.charHeight
            };
        }
        // Render glyph to atlas
        // Clear area with extra space to ensure no stray pixels remain
        this.atlasCtx.clearRect(this.atlasX, this.atlasY, width, height);
        this.atlasCtx.fillStyle = '#ffffff';
        // Draw at integer position using top baseline.
        const x = Math.floor(this.atlasX + padding);
        const y = Math.floor(this.atlasY + padding);
        this.atlasCtx.fillText(char, x, y);
        // Calculate normalized UV coordinates
        // Use inner rect (skip padding) for actual glyph sampling
        const info = {
            u: (this.atlasX + padding) / this.atlasWidth,
            v: (this.atlasY + padding) / this.atlasHeight,
            w: glyphWidth / this.atlasWidth,
            h: this.charHeight / this.atlasHeight,
            pixelWidth: glyphWidth,
            pixelHeight: this.charHeight
        };
        this.glyphCache.set(char, info);
        // Update packing state
        this.atlasX += width;
        this.atlasRowHeight = Math.max(this.atlasRowHeight, height);
        this.atlasNeedsUpload = true;
        return info;
    }
    /**
     * Cache a range of characters (e.g., ASCII)
     */
    cacheCharRange(start, end) {
        for (let i = start; i <= end; i++) {
            this.cacheGlyph(String.fromCharCode(i));
        }
        // Log sample after caching ASCII range
        if (start === 32 && end === 127) {
            const sampleGlyph = this.glyphCache.get('M');
            console.log(`[GlyphAtlas] ASCII range cached. Sample "M" width: ${sampleGlyph?.pixelWidth}px`);
        }
    }
    /**
     * Get cached glyph info (caches if not present)
     */
    getGlyph(char) {
        if (!this.glyphCache.has(char)) {
            return this.cacheGlyph(char);
        }
        return this.glyphCache.get(char);
    }
    /**
     * Cache and return a glyph rasterized at a specific pixel size rather than
     * the atlas base fontSize.  Keyed as `${char}@${sizeInPx}` so it does not
     * collide with the base-size cache entries.
     *
     * Use this when rendering at a scale significantly different from 1.0 so the
     * GPU samples a sharp, correctly-sized texture rather than stretching a small
     * rasterization.
     */
    cacheGlyphAtSize(char, sizeInPx) {
        const key = `${char}@${sizeInPx}`;
        if (this.glyphCache.has(key)) {
            return this.glyphCache.get(key);
        }
        const fontString = this.fontFamily.includes(',')
            ? this.fontFamily
            : `'${this.fontFamily}'`;
        const prevFont = this.atlasCtx.font;
        this.atlasCtx.font = `${sizeInPx}px ${fontString}`;
        this.atlasCtx.textBaseline = 'top';
        const metrics = this.atlasCtx.measureText(char);
        const glyphWidth = Math.ceil(metrics.width);
        // With textBaseline='top', actualBoundingBoxAscent > 0 means the glyph has
        // pixels ABOVE the draw y coordinate.  The original fixed 4px padding was
        // often not enough at large sizes, causing those top pixels to fall outside
        // the UV region and appear clipped.  We now:
        //   1. Measure the exact above/below extents from the browser.
        //   2. Shift the draw y DOWN by `ascent` so above-baseline pixels land
        //      exactly at the top of the UV region (atlasY + padding).
        //   3. Size the UV to the actual visual height (ascent + descent).
        const rawAscent = metrics.actualBoundingBoxAscent;
        const rawDescent = metrics.actualBoundingBoxDescent;
        const ascent = (typeof rawAscent === 'number' && isFinite(rawAscent))
            ? Math.max(0, Math.ceil(rawAscent))
            : Math.round(sizeInPx * 0.05); // conservative 5% fallback
        const descent = (typeof rawDescent === 'number' && isFinite(rawDescent) && rawDescent > 0)
            ? Math.ceil(rawDescent)
            : sizeInPx; // fallback: full font size
        const actualGlyphH = ascent + descent;
        const padding = 4;
        const sidePad = 4;
        const width = glyphWidth + sidePad * 2;
        const height = actualGlyphH + padding * 2;
        if (this.atlasX + width > this.atlasWidth) {
            this.atlasX = 0;
            this.atlasY += this.atlasRowHeight;
            this.atlasRowHeight = 0;
        }
        if (this.atlasY + height > this.atlasHeight) {
            console.warn('[GlyphAtlas] Atlas full — cannot cache sized glyph, falling back to base size.');
            this.atlasCtx.font = prevFont;
            return this.getGlyph(char);
        }
        this.atlasCtx.clearRect(this.atlasX, this.atlasY, width, height);
        this.atlasCtx.fillStyle = '#ffffff';
        // Draw at (padding + ascent) from the row top so the above-baseline pixels
        // land exactly at atlasY + padding — the start of the UV region.
        this.atlasCtx.fillText(char, Math.floor(this.atlasX + sidePad), Math.floor(this.atlasY + padding + ascent));
        const info = {
            u: (this.atlasX + sidePad) / this.atlasWidth,
            v: (this.atlasY + padding) / this.atlasHeight, // top of actual bbox
            w: glyphWidth / this.atlasWidth,
            h: actualGlyphH / this.atlasHeight, // exact visual height
            pixelWidth: glyphWidth,
            pixelHeight: actualGlyphH,
        };
        this.glyphCache.set(key, info);
        this.atlasX += width;
        this.atlasRowHeight = Math.max(this.atlasRowHeight, height);
        this.atlasNeedsUpload = true;
        this.atlasCtx.font = prevFont;
        return info;
    }
    /**
     * Get a glyph at a specific pixel size (caches if not present).
     * Falls back to the base-size glyph when sizeInPx equals the atlas fontSize.
     */
    getGlyphAtSize(char, sizeInPx) {
        if (Math.abs(sizeInPx - this.fontSize) < 0.5) {
            return this.getGlyph(char);
        }
        return this.cacheGlyphAtSize(char, Math.round(sizeInPx));
    }
    /**
     * Upload atlas to GPU texture
     */
    uploadToGPU(device) {
        if (!this.atlasTexture || !this.atlasNeedsUpload)
            return;
        const imageData = this.atlasCtx.getImageData(0, 0, this.atlasWidth, this.atlasHeight);
        device.queue.writeTexture({ texture: this.atlasTexture }, imageData.data, { bytesPerRow: this.atlasWidth * 4 }, { width: this.atlasWidth, height: this.atlasHeight });
        this.atlasNeedsUpload = false;
    }
    /**
     * Check if upload is needed
     */
    needsUpload() {
        return this.atlasNeedsUpload;
    }
    /**
     * Get atlas texture
     */
    getTexture() {
        return this.atlasTexture;
    }
    /**
     * Get atlas sampler
     */
    getSampler() {
        return this.atlasSampler;
    }
    /**
     * Get base character dimensions
     */
    getCharWidth() {
        return this.charWidth;
    }
    getCharHeight() {
        return this.charHeight;
    }
    getFontSize() {
        return this.fontSize;
    }
    /**
     * Get canvas for debugging
     */
    getCanvas() {
        return this.atlasCanvas;
    }
    /**
     * Clear the atlas and cache
     */
    clear() {
        this.glyphCache.clear();
        this.atlasX = 0;
        this.atlasY = 0;
        this.atlasRowHeight = 0;
        this.atlasCtx.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
        this.atlasNeedsUpload = true;
    }
    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.atlasTexture) {
            this.atlasTexture.destroy();
            this.atlasTexture = null;
        }
        this.glyphCache.clear();
    }
}
//# sourceMappingURL=glyph-atlas.js.map