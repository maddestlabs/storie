/**
 * TUI Label Widget
 * Terminal-based static text display
 */

import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { TerminalRenderer } from '../../terminal-renderer.js';
import { getTUIThemeDefaults } from './theme.js';

export interface TUILabelConfig extends WidgetConfig {
  text: string;
  align?: 'left' | 'center' | 'right';
}

/**
 * Label widget for displaying static text
 */
export class TUILabel extends BaseWidget {
  public text: string;
  public align: 'left' | 'center' | 'right';
  
  constructor(config: TUILabelConfig) {
    super({ ...config, focusable: false }); // Labels are not focusable
    this.text = String(config.text ?? '');
    this.align = config.align || 'left';
  }
  
  /**
   * Update label text
   */
  setText(text: unknown): void {
    this.text = String(text ?? '');
  }
  
  /**
   * Render label to cell buffer
   */
  render(buffer: any[][], renderer: TerminalRenderer): void {
    if (!this.state.visible) return;
    
    const { x, y, width, height } = this.bounds;
    const style = this.getEffectiveStyle();

    const defaults = getTUIThemeDefaults();
    
    // Get colors (with defaults)
    const fg = style.fg ?? defaults.label.fg;
    const bg = style.bg ?? defaults.label.bg;
    
    // Clear background
    for (let col = 0; col < width; col++) {
      for (let row = 0; row < height; row++) {
        renderer.setCell(buffer, x + col, y + row, ' ', fg, bg);
      }
    }
    
    const text = String(this.text ?? '');

    // Draw text (centered vertically)
    const centerY = Math.floor(height / 2);
    let textX = 0;
    
    if (this.align === 'center') {
      textX = Math.floor((width - text.length) / 2);
    } else if (this.align === 'right') {
      textX = width - text.length;
    }
    
    // Ensure text fits within bounds
    textX = Math.max(0, Math.min(textX, width - text.length));
    
    // Draw text
    for (let i = 0; i < text.length && i < width; i++) {
      const charX = x + textX + i;
      if (charX >= x && charX < x + width) {
        renderer.setCell(buffer, charX, y + centerY, text[i], fg, bg);
      }
    }
  }
}
