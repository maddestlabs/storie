/**
 * Layer system for compositing multiple drawing surfaces
 */

import type { Cell, Color } from './types.js';
import { COLORS, ColorUtils } from './types.js';

export class Layer {
  id: string;
  buffer: Cell[][];
  visible: boolean = true;
  alpha: number = 1.0;
  width: number;
  height: number;
  private defaultBg: Color;

  constructor(id: string, width: number, height: number) {
    this.id = id;
    this.width = width;
    this.height = height;
    this.defaultBg = COLORS.BLACK;
    this.buffer = this.createBuffer(width, height);
  }

  private createBuffer(width: number, height: number): Cell[][] {
    const buffer: Cell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < width; x++) {
        row.push({
          char: ' ',
          fg: COLORS.WHITE,
          bg: this.defaultBg
        });
      }
      buffer.push(row);
    }
    return buffer;
  }

  write(x: number, y: number, text: string, fg?: Color | any, bg?: Color | any): void {
    if (y < 0 || y >= this.height) return;
    
    for (let i = 0; i < text.length; i++) {
      const px = x + i;
      if (px < 0 || px >= this.width) continue;
      
      const cell = this.buffer[y][px];
      cell.char = text[i];
      if (fg !== undefined) cell.fg = ColorUtils.from(fg);
      if (bg !== undefined) cell.bg = ColorUtils.from(bg);
    }
  }

  plot(x: number, y: number, char: string, fg?: Color | any, bg?: Color | any): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    
    const cell = this.buffer[y][x];
    cell.char = char;
    if (fg !== undefined) cell.fg = ColorUtils.from(fg);
    if (bg !== undefined) cell.bg = ColorUtils.from(bg);
  }

  clear(bgColor?: Color): void {
    const bg = bgColor || COLORS.BLACK;
    this.defaultBg = bg;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = {
          char: ' ',
          fg: COLORS.WHITE,
          bg: bg
        };
      }
    }
  }

  resize(width: number, height: number): void {
    const oldBuffer = this.buffer;
    const oldW = this.width;
    const oldH = this.height;

    this.width = width;
    this.height = height;

    const next = this.createBuffer(width, height);

    const copyW = Math.min(oldW, width);
    const copyH = Math.min(oldH, height);
    for (let y = 0; y < copyH; y++) {
      for (let x = 0; x < copyW; x++) {
        next[y][x] = oldBuffer[y][x];
      }
    }

    this.buffer = next;
  }
}

export class LayerStack {
  private layers: Map<string, Layer> = new Map();
  private layerOrder: string[] = [];
  activeLayerId: string = 'default';
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Create default layer
    this.create('default', width, height);
  }

  create(id: string, width?: number, height?: number): Layer {
    const w = width || this.width;
    const h = height || this.height;
    const layer = new Layer(id, w, h);
    this.layers.set(id, layer);
    if (!this.layerOrder.includes(id)) {
      this.layerOrder.push(id);
    }
    return layer;
  }

  get(id: string): Layer | undefined {
    return this.layers.get(id);
  }

  getActive(): Layer {
    return this.layers.get(this.activeLayerId) || this.layers.get('default')!;
  }

  show(id: string): void {
    const layer = this.layers.get(id);
    if (layer) layer.visible = true;
  }

  hide(id: string): void {
    const layer = this.layers.get(id);
    if (layer) layer.visible = false;
  }

  setAlpha(id: string, alpha: number): void {
    const layer = this.layers.get(id);
    if (layer) layer.alpha = Math.max(0, Math.min(1, alpha));
  }

  remove(id: string): void {
    if (id === 'default') return; // Can't remove default layer
    this.layers.delete(id);
    const index = this.layerOrder.indexOf(id);
    if (index !== -1) {
      this.layerOrder.splice(index, 1);
    }
  }

  /**
   * Composite all visible layers into a single buffer
   * Layers are composited in order with alpha blending
   */
  composite(): Cell[][] {
    const result: Cell[][] = [];
    
    // Initialize with transparent cells
    for (let y = 0; y < this.height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          char: ' ',
          fg: COLORS.WHITE,
          bg: COLORS.BLACK
        });
      }
      result.push(row);
    }

    // Composite each visible layer
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible) continue;

      for (let y = 0; y < Math.min(layer.height, this.height); y++) {
        for (let x = 0; x < Math.min(layer.width, this.width); x++) {
          const srcCell = layer.buffer[y][x];
          const dstCell = result[y][x];
          
          if (layer.alpha >= 1.0) {
            // Fully opaque - direct copy
            dstCell.char = srcCell.char;
            dstCell.fg = srcCell.fg;
            dstCell.bg = srcCell.bg;
          } else {
            // Alpha blend
            const alpha = layer.alpha;
            
            // Only blend if not space
            if (srcCell.char !== ' ') {
              dstCell.char = srcCell.char;
              dstCell.fg = ColorUtils.blend(srcCell.fg, dstCell.fg, alpha);
            }
            
            dstCell.bg = ColorUtils.blend(srcCell.bg, dstCell.bg, alpha);
          }
        }
      }
    }

    return result;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    for (const layer of this.layers.values()) {
      layer.resize(width, height);
    }
  }

  clearAll(bgColor?: Color): void {
    for (const layer of this.layers.values()) {
      layer.clear(bgColor);
    }
  }
}
