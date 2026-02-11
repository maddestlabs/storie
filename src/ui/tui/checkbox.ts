/**
 * TUI Checkbox Widget
 * Terminal-based checkbox with label
 */

import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { TerminalRenderer } from '../../terminal-renderer.js';
import { ColorUtils } from '../../types.js';

export interface TUICheckboxConfig extends WidgetConfig {
  label: string;
  checked?: boolean;
}

/**
 * Checkbox widget with toggleable state
 */
export class TUICheckbox extends BaseWidget {
  public label: string;
  private checked: boolean;
  private toggledThisFrame: boolean = false;
  
  constructor(config: TUICheckboxConfig) {
    super(config);
    this.label = config.label;
    this.checked = config.checked ?? false;
    
    // Toggle on click
    this.on('click', () => {
      this.checked = !this.checked;
      this.toggledThisFrame = true;
      this.emit({
        type: 'change',
        widget: this.id,
        timestamp: Date.now(),
        data: { checked: this.checked }
      });
    });
  }
  
  /**
   * Check if checkbox was toggled this frame
   */
  wasToggled(): boolean {
    const result = this.toggledThisFrame;
    this.toggledThisFrame = false;
    return result;
  }
  
  /**
   * Get checked state
   */
  isChecked(): boolean {
    return this.checked;
  }
  
  /**
   * Set checked state programmatically
   */
  setChecked(checked: boolean): void {
    this.checked = checked;
  }
  
  /**
   * Update label text
   */
  setLabel(label: string): void {
    this.label = label;
  }
  
  /**
   * Render checkbox to cell buffer
   */
  render(buffer: any[][], renderer: TerminalRenderer): void {
    if (!this.state.visible) return;
    
    const { x, y } = this.bounds;
    const style = this.getEffectiveStyle();
    
    // Get colors
    const fg = style.fg ?? ColorUtils.rgb(200, 200, 200);
    const bg = style.bg ?? ColorUtils.rgb(0, 0, 0);
    
    // Choose checkbox symbol based on focus
    let symbol: string;
    if (this.state.focused) {
      symbol = this.checked ? '《X》' : '《 》';
    } else {
      symbol = this.checked ? '[X]' : '[ ]';
    }
    
    // Draw checkbox symbol
    for (let i = 0; i < symbol.length; i++) {
      renderer.setCell(buffer, x + i, y, symbol[i], fg, bg);
    }
    
    // Draw label
    const labelStart = x + symbol.length + 1;
    for (let i = 0; i < this.label.length; i++) {
      renderer.setCell(buffer, labelStart + i, y, this.label[i], fg, bg);
    }
  }
}
