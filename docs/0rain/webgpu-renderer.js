/**
 * WebGPU Renderer (Facade)
 * Backward-compatible wrapper around the new modular architecture
 * For new code, prefer using WebGPUContext + TerminalRenderer directly
 */
import { WebGPUContext } from './webgpu-context.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { TerminalRenderer } from './terminal-renderer.js';
/**
 * WebGPURenderer - Facade for backward compatibility
 * Internally uses WebGPUContext + GlyphAtlas + TerminalRenderer
 */
export class WebGPURenderer {
    canvas;
    context;
    atlas;
    terminalRenderer;
    width;
    height;
    renderToTexture;
    initialized = false;
    constructor(canvas, config = {}) {
        this.canvas = canvas;
        this.width = 80;
        this.height = 24;
        this.renderToTexture = config.renderToTexture ?? false;
        // Create modular components
        this.context = new WebGPUContext({
            canvas: canvas,
            powerPreference: 'high-performance'
        });
        // Scale font size to physical pixels so glyph atlas is rasterized at
        // native device resolution (crisp on HiDPI / Retina displays).
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        const fontSizePx = Math.max(1, Math.round((config.fontSize || 16) * dpr));
        this.atlas = new GlyphAtlas({
            fontFamily: config.fontFamily || '\'3270-regular\', \'Consolas\', \'Monaco\', monospace',
            fontSize: fontSizePx
        });
        this.terminalRenderer = new TerminalRenderer(this.context, this.atlas, {
            width: this.width,
            height: this.height,
            renderToTexture: this.renderToTexture
        });
    }
    async init() {
        if (this.initialized)
            return true;
        console.log('[WebGPURenderer] Initializing (facade)...');
        try {
            // Initialize context
            const contextOk = await this.context.init();
            if (!contextOk)
                return false;
            // Initialize terminal renderer
            const rendererOk = await this.terminalRenderer.init(this.canvas.width, this.canvas.height);
            if (!rendererOk)
                return false;
            this.initialized = true;
            console.log('[WebGPURenderer] Initialized successfully');
            return true;
        }
        catch (error) {
            console.error('[WebGPURenderer] Initialization failed:', error);
            return false;
        }
    }
    resize(width, height) {
        this.width = width;
        this.height = height;
        // Canvas dimensions are managed externally (viewport-driven, DPR-aware).
        // Pass the current physical canvas size to the terminal renderer so its
        // uniforms stay consistent with the backing buffer.
        this.terminalRenderer.resize(width, height, this.canvas.width, this.canvas.height);
    }
    getCharWidth() {
        return this.atlas.getCharWidth();
    }
    getCharHeight() {
        return this.atlas.getCharHeight();
    }
    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    render(buffer) {
        if (!this.initialized)
            return;
        this.terminalRenderer.render(buffer);
    }
    clear(color = 0x000000FF) {
        this.terminalRenderer.clear(color);
    }
    /**
     * Get the render texture for compositing (not used in facade mode)
     */
    getRenderTexture() {
        return this.terminalRenderer.getRenderTexture();
    }
    /**
     * Access underlying components for advanced usage
     */
    getContext() {
        return this.context;
    }
    getAtlas() {
        return this.atlas;
    }
    getTerminalRenderer() {
        return this.terminalRenderer;
    }
}
//# sourceMappingURL=webgpu-renderer.js.map