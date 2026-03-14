/**
 * Canvas 2D renderer for terminal-style graphics
 * Falls back to standard Canvas API when WebGPU is unavailable
 */

import type { Cell, Color } from './types.js';
import { ColorUtils, COLORS } from './types.js';
import { getPrimaryFontFamily, measureMonospaceCellWidth, tryLoadGoogleFontFamily } from './font-loading.js';

export interface RendererConfig {
  fontFamily?: string;
  fontSize?: number;
  cellWidth?: number;
  cellHeight?: number;
}

export class Canvas2DRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  
  // Font settings
  private fontFamily: string;
  private fontSize: number;
  private cellWidth: number;
  private cellHeight: number;
  
  // Font loaded flag
  private fontLoaded: boolean = false;

  constructor(canvas: HTMLCanvasElement, config: RendererConfig = {}) {
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
  
  private async waitForFont(): Promise<void> {
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
      } catch {
        // ignore
      }

      // Wait for the font to be loaded
      await document.fonts.load(`${this.fontSize}px ${this.fontFamily}`);
      // Update context with loaded font
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.cellWidth = measureMonospaceCellWidth(this.ctx);
      this.fontLoaded = true;
    } catch (e) {
      console.warn('Font loading failed, using fallback:', e);
      this.fontLoaded = true;
    }
  }

  private setupCanvas(): void {
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

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // Re-apply context transform in case the canvas buffer was resized externally.
    this.setupCanvas();
  }

  getCharWidth(): number {
    return this.cellWidth;
  }

  getCharHeight(): number {
    return this.cellHeight;
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /**
   * Render a buffer of cells to the canvas
   */
  render(buffer: Cell[][]): void {
    if (!this.fontLoaded) return;

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

  private renderCell(x: number, y: number, cell: Cell): void {
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
  clear(color: Color = COLORS.BLACK): void {
    this.ctx.fillStyle = ColorUtils.toCss(color);
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
