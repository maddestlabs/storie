/**
 * TUI System
 * Main entry point for terminal-based retained-mode UI
 */

import { WidgetManager } from '../core/widget-manager.js';
import { InputRouter } from '../core/input-router.js';
import type { TerminalRenderer } from '../../terminal-renderer.js';
import type { InputCoordinate } from '../core/types.js';

import { TUIButton, type TUIButtonConfig } from './button.js';
import { TUILabel, type TUILabelConfig } from './label.js';
import { TUICheckbox, type TUICheckboxConfig } from './checkbox.js';
import { TUISlider, type TUISliderConfig } from './slider.js';
import { TUITextField, type TUITextFieldConfig } from './textfield.js';

/**
 * Main TUI system that manages terminal-based UI
 */
export class TUISystem {
  private widgetManager: WidgetManager;
  private inputRouter: InputRouter;
  private renderer: TerminalRenderer;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastMouseDown: boolean = false;
  
  constructor(renderer: TerminalRenderer) {
    this.renderer = renderer;
    this.widgetManager = new WidgetManager();
    this.inputRouter = new InputRouter({ widgetManager: this.widgetManager });
  }
  
  /**
   * Create a button widget
   */
  createButton(config: TUIButtonConfig): TUIButton {
    const button = new TUIButton(config);
    this.widgetManager.register(button);
    return button;
  }
  
  /**
   * Create a label widget
   */
  createLabel(config: TUILabelConfig): TUILabel {
    const label = new TUILabel(config);
    this.widgetManager.register(label);
    return label;
  }
  
  /**
   * Create a checkbox widget
   */
  createCheckbox(config: TUICheckboxConfig): TUICheckbox {
    const checkbox = new TUICheckbox(config);
    this.widgetManager.register(checkbox);
    return checkbox;
  }
  
  /**
   * Create a slider widget
   */
  createSlider(config: TUISliderConfig): TUISlider {
    const slider = new TUISlider(config);
    this.widgetManager.register(slider);
    return slider;
  }

  /**
   * Create a text field widget
   */
  createTextField(config: TUITextFieldConfig): TUITextField {
    const textField = new TUITextField(config);
    this.widgetManager.register(textField);
    return textField;
  }
  
  /**
   * Update all widgets with current input state
   * Call this in your update loop
   */
  update(mouseX: number, mouseY: number, mouseDown: boolean, _gridWidth: number, _gridHeight: number): void {
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.lastMouseDown = mouseDown;

    // Storie's input events (and polling helpers) provide mouse coordinates in terminal-cell units.
    // Treat them as cell coordinates directly.
    const inputCoord: InputCoordinate = {
      x: mouseX,
      y: mouseY,
      cellX: mouseX,
      cellY: mouseY
    };
    
    // Update input routing
    this.inputRouter.update(inputCoord, mouseDown);
    
    // Update sliders (for drag behavior)
    const sliders = this.widgetManager.getAll().filter(w => w instanceof TUISlider) as TUISlider[];
    for (const slider of sliders) {
      slider.updateDrag(inputCoord, mouseDown);
    }
  }

  /**
   * Handle a mouse update immediately (for use in on:input)
   * This makes quick clicks reliable even if press+release happen between frames.
   */
  handleMouse(mouseX: number, mouseY: number, mouseDown: boolean): void {
    // Reuse the same routing logic as update().
    this.update(mouseX, mouseY, mouseDown, 0, 0);
  }

  /**
   * Get last observed mouse state (cell coordinates)
   */
  getMouseState(): { x: number; y: number; down: boolean } {
    return { x: this.lastMouseX, y: this.lastMouseY, down: this.lastMouseDown };
  }
  
  /**
   * Handle keyboard input
   */
  handleKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }): void {
    // Handle navigation
    if (this.inputRouter.handleKey(key, modifiers)) {
      return; // Consumed by navigation
    }
    
    // Handle activation
    if (key === 'Enter' || key === ' ') {
      this.inputRouter.handleActivate();
    }
  }

  /**
   * Handle text input (printable characters)
   */
  handleText(text: string): void {
    this.inputRouter.handleText(text);
  }
  
  /**
   * Render all visible widgets
   * Call this in your render loop
   * @param buffer - Cell buffer to render to (Cell[][])
   */
  render(buffer: any[][]): void {
    const visibleWidgets = this.widgetManager.getVisible();
    for (const widget of visibleWidgets) {
      widget.render(buffer, this.renderer);
    }
  }
  
  /**
   * Set group visibility
   */
  setGroupVisible(groupId: string | number, visible: boolean): void {
    this.widgetManager.setGroupVisible(groupId, visible);
  }
  
  /**
   * Clear all widgets
   */
  clear(): void {
    this.widgetManager.clear();
  }
  
  /**
   * Get widget manager (for advanced usage)
   */
  getWidgetManager(): WidgetManager {
    return this.widgetManager;
  }
}

// Re-export widget types for convenience
export type { TUIButtonConfig, TUILabelConfig, TUICheckboxConfig, TUISliderConfig, TUITextFieldConfig };
export { TUIButton, TUILabel, TUICheckbox, TUISlider, TUITextField };
