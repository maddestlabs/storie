/**
 * TUI Button Widget
 * Terminal-based button using box-drawing characters
 */

import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { TerminalRenderer } from '../../terminal-renderer.js';
import { getTUIThemeDefaults } from './theme.js';

export interface TUIButtonConfig extends WidgetConfig {
  label: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Button widget rendered using terminal cells
 */
export class TUIButton extends BaseWidget {
  public label: string;
  public align: 'left' | 'center' | 'right';
  
  // Track if clicked this frame
  private clickedThisFrame: boolean = false;
  
  constructor(config: TUIButtonConfig) {
    super(config);
    this.label = String(config.label ?? '');
    this.align = config.align || 'center';
    
    // Listen for click events
    this.on('click', () => {
      this.clickedThisFrame = true;
    });
  }
  
  /**
   * Check if button was clicked this frame
   * This is the main API for user code
   */
  wasClicked(): boolean {
    const result = this.clickedThisFrame;
    this.clickedThisFrame = false; // Clear after reading
    return result;
  }
  
  /**
   * Update label text
   */
  setLabel(label: unknown): void {
    this.label = String(label ?? '');
  }
  
  /**
   * Render button to cell buffer
   */
  render(buffer: any[][], renderer: TerminalRenderer): void {
    if (!this.state.visible) return;
    
    const { x, y, width, height } = this.bounds;
    const style = this.getEffectiveStyle();

    const defaults = getTUIThemeDefaults();
    
    // Choose border style based on focus state
    const borderChars = this.state.focused
      ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
      : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
    
    // Get colors (with defaults)
    const fg = style.fg ?? defaults.button.fg;
    const bg = style.bg ?? defaults.button.bg;
    
    // Draw border
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        let char = ' ';
        
        // Top and bottom borders
        if (row === 0 && col === 0) char = borderChars.tl;
        else if (row === 0 && col === width - 1) char = borderChars.tr;
        else if (row === height - 1 && col === 0) char = borderChars.bl;
        else if (row === height - 1 && col === width - 1) char = borderChars.br;
        else if (row === 0 || row === height - 1) char = borderChars.h;
        // Left and right borders
        else if (col === 0 || col === width - 1) char = borderChars.v;
        
        renderer.setCell(buffer, x + col, y + row, char, fg, bg);
      }
    }
    
    const label = String(this.label ?? '');

    // Draw label (centered vertically)
    const centerY = Math.floor(height / 2);
    let labelX = 1; // Default left-aligned (1 char from left border)
    
    if (this.align === 'center') {
      labelX = Math.floor((width - label.length) / 2);
    } else if (this.align === 'right') {
      labelX = width - label.length - 1;
    }
    
    // Ensure label fits within bounds
    labelX = Math.max(1, Math.min(labelX, width - label.length - 1));
    
    // Draw label text
    for (let i = 0; i < label.length; i++) {
      const charX = x + labelX + i;
      if (charX >= x + 1 && charX < x + width - 1) {
        renderer.setCell(buffer, charX, y + centerY, label[i], fg, bg);
      }
    }
  }
}
