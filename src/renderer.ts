/**
 * Canvas 2D renderer for terminal-style graphics
 * Falls back to standard Canvas API when WebGPU is unavailable
 */

import type { Cell, Color } from './types.js';
import { ColorUtils, COLORS } from './types.js';

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
    this.cellWidth = config.cellWidth || 10;
    this.cellHeight = config.cellHeight || 20;
    
    this.setupCanvas();
    this.waitForFont();
  }
  
  private async waitForFont(): Promise<void> {
    try {
      // Wait for the font to be loaded
      await document.fonts.load(`${this.fontSize}px ${this.fontFamily}`);
      // Update context with loaded font
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.fontLoaded = true;
    } catch (e) {
      console.warn('Font loading failed, using fallback:', e);
      this.fontLoaded = true;
    }
  }

  private setupCanvas(): void {
    this.canvas.width = this.width * this.cellWidth;
    this.canvas.height = this.height * this.cellHeight;
    
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
    this.setupCanvas();
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

    // Draw background
    this.ctx.fillStyle = ColorUtils.toCss(cell.bg);
    this.ctx.fillRect(px, py, this.cellWidth, this.cellHeight);

    // Draw character if not space
    if (cell.char && cell.char !== ' ') {
      this.ctx.fillStyle = ColorUtils.toCss(cell.fg);
      this.ctx.fillText(cell.char, px + 1, py + 2);
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
