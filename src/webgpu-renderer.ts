/**
 * WebGPU Renderer (Facade)
 * Backward-compatible wrapper around the new modular architecture
 * For new code, prefer using WebGPUContext + TerminalRenderer directly
 */

import { WebGPUContext } from './webgpu-context.js';
import { GlyphAtlas } from './glyph-atlas.js';
import { TerminalRenderer } from './terminal-renderer.js';
import type { Cell, Color } from './types.js';

export interface WebGPURendererConfig {
  fontFamily?: string;
  fontSize?: number;
  charWidth?: number;
  charHeight?: number;
  /**
   * When true, renders terminal output to an offscreen GPU texture.
   * This is required when using the WebGPU compositor.
   */
  renderToTexture?: boolean;
}

/**
 * WebGPURenderer - Facade for backward compatibility
 * Internally uses WebGPUContext + GlyphAtlas + TerminalRenderer
 */
export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private context: WebGPUContext;
  private atlas: GlyphAtlas;
  private terminalRenderer: TerminalRenderer;
  
  private width: number;
  private height: number;

  private renderToTexture: boolean;
  
  private initialized: boolean = false;

  constructor(canvas: HTMLCanvasElement, config: WebGPURendererConfig = {}) {
    this.canvas = canvas;
    this.width = 80;
    this.height = 24;

    this.renderToTexture = config.renderToTexture ?? false;
    
    // Create modular components
    this.context = new WebGPUContext({
      canvas: canvas,
      powerPreference: 'high-performance'
    });
    
    this.atlas = new GlyphAtlas({
      fontFamily: config.fontFamily || '\'3270-regular\', \'Consolas\', \'Monaco\', monospace',
      fontSize: config.fontSize || 16
    });
    
    this.terminalRenderer = new TerminalRenderer(
      this.context,
      this.atlas,
      {
        width: this.width,
        height: this.height,
        renderToTexture: this.renderToTexture
      }
    );
  }
  
  async init(): Promise<boolean> {
    if (this.initialized) return true;
    
    console.log('[WebGPURenderer] Initializing (facade)...');
    
    try {
      // Initialize context
      const contextOk = await this.context.init();
      if (!contextOk) return false;
      
      // Initialize terminal renderer
      const rendererOk = await this.terminalRenderer.init(
        this.canvas.width,
        this.canvas.height
      );
      if (!rendererOk) return false;
      
      this.initialized = true;
      console.log('[WebGPURenderer] Initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[WebGPURenderer] Initialization failed:', error);
      return false;
    }
  }

  
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Update canvas size
    const charWidth = this.atlas.getCharWidth();
    const charHeight = this.atlas.getCharHeight();
    this.canvas.width = width * charWidth;
    this.canvas.height = height * charHeight;
    
    // Resize terminal renderer
    this.terminalRenderer.resize(width, height, this.canvas.width, this.canvas.height);
  }
  
  getWidth(): number {
    return this.width;
  }
  
  getHeight(): number {
    return this.height;
  }
  
  render(buffer: Cell[][]): void {
    if (!this.initialized) return;
    this.terminalRenderer.render(buffer);
  }
  
  clear(color: Color = 0x000000FF): void {
    this.terminalRenderer.clear(color);
  }
  
  /**
   * Get the render texture for compositing (not used in facade mode)
   */
  getRenderTexture(): GPUTexture | null {
    return this.terminalRenderer.getRenderTexture();
  }
  
  /**
   * Access underlying components for advanced usage
   */
  getContext(): WebGPUContext {
    return this.context;
  }
  
  getAtlas(): GlyphAtlas {
    return this.atlas;
  }
  
  getTerminalRenderer(): TerminalRenderer {
    return this.terminalRenderer;
  }
}