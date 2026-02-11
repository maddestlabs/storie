/**
 * Glyph Atlas Manager
 * Manages font rasterization and glyph texture atlas
 * Uses Canvas2D for text rendering, exports to GPU texture
 */

import type { WebGPUContext } from './webgpu-context.js';

export interface GlyphAtlasConfig {
  fontFamily?: string;
  fontSize?: number;
  atlasWidth?: number;
  atlasHeight?: number;
}

export interface GlyphInfo {
  u: number;        // UV x coordinate (normalized)
  v: number;        // UV y coordinate (normalized)
  w: number;        // UV width (normalized)
  h: number;        // UV height (normalized)
  pixelWidth: number;  // Actual width in pixels
  pixelHeight: number; // Actual height in pixels
}

export class GlyphAtlas {
  private fontFamily: string;
  private fontSize: number;
  private atlasWidth: number;
  private atlasHeight: number;
  
  // Canvas2D for rasterization
  private atlasCanvas: HTMLCanvasElement;
  private atlasCtx: CanvasRenderingContext2D;
  
  // Glyph cache
  private glyphCache: Map<string, GlyphInfo> = new Map();
  
  // Atlas packing state
  private atlasX: number = 0;
  private atlasY: number = 0;
  private atlasRowHeight: number = 0;
  
  // GPU resources
  private atlasTexture: GPUTexture | null = null;
  private atlasSampler: GPUSampler | null = null;
  private atlasNeedsUpload: boolean = false;
  
  // Metrics
  private charWidth: number = 0;
  private charHeight: number = 0;
  
  private fontLoggedOnce: boolean = false;

  constructor(config: GlyphAtlasConfig = {}) {
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
    
    if (!ctx) throw new Error('Failed to create atlas context');
    this.atlasCtx = ctx;
    
    this.initFont();
  }

  private initFont(): void {
    // Quote font family if needed
    const fontString = this.fontFamily.includes(',')
      ? this.fontFamily
      : `'${this.fontFamily}'`;
    
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = 'top';
    this.atlasCtx.textAlign = 'left';
    
    // Measure character dimensions
    const metrics = this.atlasCtx.measureText('M');
    this.charWidth = Math.ceil(metrics.width);
    this.charHeight = this.fontSize;
    
    console.log(`[GlyphAtlas] Font initialized: ${this.atlasCtx.font}`);
    console.log(`[GlyphAtlas] Base char size: ${this.charWidth}x${this.charHeight}px`);
  }

  /**
   * Initialize GPU resources
   */
  async initGPU(context: WebGPUContext): Promise<void> {
    const device = context.getDevice();
    if (!device) throw new Error('WebGPU device not available');
    
    // Wait for fonts to load
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
      
      try {
        const fontString = this.fontFamily.includes(',')
          ? this.fontFamily
          : `'${this.fontFamily}'`;
        await document.fonts.load(`${this.fontSize}px ${fontString}`);
        console.log(`[GlyphAtlas] Loaded font: ${fontString}`);
      } catch (e) {
        console.warn('[GlyphAtlas] Font load failed, continuing anyway:', e);
      }
    }
    
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
  cacheGlyph(char: string): GlyphInfo {
    if (this.glyphCache.has(char)) {
      return this.glyphCache.get(char)!;
    }
    
    // Ensure font is set
    const fontString = this.fontFamily.includes(',')
      ? this.fontFamily
      : `'${this.fontFamily}'`;
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = 'top';
    
    // Log font once
    if (!this.fontLoggedOnce) {
      console.log(`[GlyphAtlas] Caching glyphs with font: ${this.atlasCtx.font}`);
      this.fontLoggedOnce = true;
    }
    
    // Measure glyph
    const metrics = this.atlasCtx.measureText(char);
    const width = Math.ceil(metrics.width) + 2;  // padding
    const height = this.charHeight + 2;
    
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
    this.atlasCtx.clearRect(this.atlasX, this.atlasY, width, height);
    this.atlasCtx.fillStyle = '#ffffff';
    this.atlasCtx.fillText(char, this.atlasX + 1, this.atlasY + 1);
    
    // Calculate normalized UV coordinates
    const info: GlyphInfo = {
      u: this.atlasX / this.atlasWidth,
      v: this.atlasY / this.atlasHeight,
      w: width / this.atlasWidth,
      h: height / this.atlasHeight,
      pixelWidth: width,
      pixelHeight: height
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
  cacheCharRange(start: number, end: number): void {
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
  getGlyph(char: string): GlyphInfo {
    if (!this.glyphCache.has(char)) {
      return this.cacheGlyph(char);
    }
    return this.glyphCache.get(char)!;
  }

  /**
   * Upload atlas to GPU texture
   */
  uploadToGPU(device: GPUDevice): void {
    if (!this.atlasTexture || !this.atlasNeedsUpload) return;
    
    const imageData = this.atlasCtx.getImageData(
      0, 0,
      this.atlasWidth,
      this.atlasHeight
    );
    
    device.queue.writeTexture(
      { texture: this.atlasTexture },
      imageData.data,
      { bytesPerRow: this.atlasWidth * 4 },
      { width: this.atlasWidth, height: this.atlasHeight }
    );
    
    this.atlasNeedsUpload = false;
  }

  /**
   * Check if upload is needed
   */
  needsUpload(): boolean {
    return this.atlasNeedsUpload;
  }

  /**
   * Get atlas texture
   */
  getTexture(): GPUTexture | null {
    return this.atlasTexture;
  }

  /**
   * Get atlas sampler
   */
  getSampler(): GPUSampler | null {
    return this.atlasSampler;
  }

  /**
   * Get base character dimensions
   */
  getCharWidth(): number {
    return this.charWidth;
  }

  getCharHeight(): number {
    return this.charHeight;
  }

  /**
   * Get canvas for debugging
   */
  getCanvas(): HTMLCanvasElement {
    return this.atlasCanvas;
  }

  /**
   * Clear the atlas and cache
   */
  clear(): void {
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
  destroy(): void {
    if (this.atlasTexture) {
      this.atlasTexture.destroy();
      this.atlasTexture = null;
    }
    this.glyphCache.clear();
  }
}
