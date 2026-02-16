/**
 * GUI System
 * Main entry point for graphical retained-mode UI (WebGPU/Canvas)
 */

import { WidgetManager } from '../core/widget-manager.js';
import { InputRouter } from '../core/input-router.js';
import type { InputCoordinate } from '../core/types.js';

import { GUIButton, type GUIButtonConfig } from './button.js';
import { GUILabel, type GUILabelConfig } from './label.js';
import { GUICheckbox, type GUICheckboxConfig } from './checkbox.js';
import { GUISlider, type GUISliderConfig } from './slider.js';
import { GUIMarkdownView, type GUIMarkdownViewConfig } from './markdown-view.js';
import { GUILayoutContainer, type GUILayoutContainerConfig } from './layout-container.js';
import type { Draw2D, WidgetDrawInfo, WidgetDrawInfoCommon } from '../draw2d.js';

/**
 * Main GUI system that manages graphical UI widgets
 */
export class GUISystem {
  private widgetManager: WidgetManager;
  private inputRouter: InputRouter;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastMouseDown: boolean = false;

  // Optional draw override hook. If it returns true, default drawing is skipped.
  private widgetRenderer: ((widgetInfo: WidgetDrawInfo, ui: Draw2D) => boolean | void) | null = null;
  
  constructor() {
    this.widgetManager = new WidgetManager();
    this.inputRouter = new InputRouter({ widgetManager: this.widgetManager });
  }

  /**
   * Set a custom renderer hook for widgets.
   * The callback receives a plain widgetInfo object (safe snapshot), plus the uiAPI.
   * If the callback returns true, GUISystem will skip its default renderer for that widget.
   */
  setWidgetRenderer(renderer: ((widgetInfo: WidgetDrawInfo, ui: Draw2D) => boolean | void) | null): void {
    this.widgetRenderer = renderer;
  }

  private buildWidgetInfo(widget: any, charWidth: number, charHeight: number): WidgetDrawInfo {
    const base: WidgetDrawInfoCommon = {
      id: String(widget.id),
      bounds: { ...widget.bounds },
      state: { ...widget.state },
      group: widget.group,
      metrics: { charWidth, charHeight }
    };

    if (widget instanceof GUIButton) {
      return { ...base, kind: 'button', label: widget.label };
    }
    if (widget instanceof GUILabel) {
      return { ...base, kind: 'label', text: widget.text, align: widget.align };
    }
    if (widget instanceof GUICheckbox) {
      return { ...base, kind: 'checkbox', label: widget.label, checked: widget.checked };
    }
    if (widget instanceof GUISlider) {
      return { ...base, kind: 'slider', label: widget.label, min: widget.min, max: widget.max, value: widget.value };
    }
    if (widget instanceof GUIMarkdownView) {
      return { ...base, kind: 'markdownView' };
    }

    return { ...base, kind: 'unknown' };
  }
  
  /**
   * Create a button widget
   */
  createButton(config: GUIButtonConfig): GUIButton {
    const button = new GUIButton(config);
    this.widgetManager.register(button);
    return button;
  }
  
  /**
   * Create a label widget
   */
  createLabel(config: GUILabelConfig): GUILabel {
    const label = new GUILabel(config);
    this.widgetManager.register(label);
    return label;
  }
  
  /**
   * Create a checkbox widget
   */
  createCheckbox(config: GUICheckboxConfig): GUICheckbox {
    const checkbox = new GUICheckbox(config);
    this.widgetManager.register(checkbox);
    return checkbox;
  }
  
  /**
   * Create a slider widget
   */
  createSlider(config: GUISliderConfig): GUISlider {
    const slider = new GUISlider(config);
    this.widgetManager.register(slider);
    return slider;
  }

  /**
   * Create a markdown view widget (flow layout inside bounds)
   */
  createMarkdownView(config: GUIMarkdownViewConfig): GUIMarkdownView {
    const view = new GUIMarkdownView(config);
    this.widgetManager.register(view);
    return view;
  }

  /**
   * Create a layout helper container.
   * Note: this does not register with the widget manager; it only updates child widget bounds.
   */
  createContainer(config: GUILayoutContainerConfig): GUILayoutContainer {
    return new GUILayoutContainer(config);
  }
  
  /**
   * Update all widgets with current input state (pixel coordinates)
   * Call this in your update loop
   */
  update(mouseX: number, mouseY: number, mouseDown: boolean, charWidth: number, charHeight: number): void {
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.lastMouseDown = mouseDown;

    // GUI works in pixel coordinates
    const cellX = Math.floor(mouseX / charWidth);
    const cellY = Math.floor(mouseY / charHeight);
    
    const inputCoord: InputCoordinate = {
      x: mouseX,
      y: mouseY,
      cellX,
      cellY
    };
    
    // Update input routing
    this.inputRouter.update(inputCoord, mouseDown);
    
    // Update sliders (for drag behavior)
    const sliders = this.widgetManager.getAll().filter(w => w instanceof GUISlider) as GUISlider[];
    for (const slider of sliders) {
      slider.handleDrag(mouseX, mouseY, mouseDown);
    }
  }

  /**
   * Handle a mouse update immediately (for use in on:input)
   */
  handleMouse(mouseX: number, mouseY: number, mouseDown: boolean, charWidth: number, charHeight: number): void {
    this.update(mouseX, mouseY, mouseDown, charWidth, charHeight);
  }

  /**
   * Get last observed mouse state (pixel coordinates)
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
    
    // Allow widgets to handle key events
    const focused = this.widgetManager.getFocused();
    if (focused) {
      // Buttons can be activated with Space/Enter
      if ((key === ' ' || key === 'Enter') && focused instanceof GUIButton) {
        focused.emit({ type: 'click', widget: focused.id, timestamp: Date.now() });
      }
      // Checkbox can be toggled with Space/Enter
      if ((key === ' ' || key === 'Enter') && focused instanceof GUICheckbox) {
        focused.emit({ type: 'click', widget: focused.id, timestamp: Date.now() });
      }
    }
  }
  
  /**
   * Render all visible widgets
   * Call this in your render loop
   */
  render(uiAPI: Draw2D, charWidth: number, charHeight: number): void {
    if (!uiAPI) return;
    
    const widgets = this.widgetManager.getAll();
    
    for (const widget of widgets) {
      if (!widget.state.visible) continue;

      if (this.widgetRenderer) {
        try {
          const info = this.buildWidgetInfo(widget, charWidth, charHeight);
          const handled = this.widgetRenderer(info, uiAPI);
          if (handled === true) {
            continue;
          }
        } catch (err) {
          // If custom rendering fails, fall back to default drawing.
          console.warn('gui.setWidgetRenderer callback threw; falling back to default widget rendering.', err);
        }
      }
      
      if (widget instanceof GUIButton) {
        this.renderButton(widget, uiAPI);
      } else if (widget instanceof GUILabel) {
        this.renderLabel(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUICheckbox) {
        this.renderCheckbox(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUISlider) {
        this.renderSlider(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUIMarkdownView) {
        this.renderMarkdownView(widget, uiAPI, charWidth, charHeight);
      }
    }
  }

  private renderMarkdownView(view: GUIMarkdownView, ui: Draw2D, charW: number, charH: number): void {
    view.renderToUI(ui, charW, charH);
  }
  
  private renderButton(button: GUIButton, ui: Draw2D): void {
    const { x, y, width, height } = button.bounds;
    const { fg, bg, borderColor, hoverBg, activeBg } = button.buttonStyle;
    
    // Background
    const bgColor = button.state.pressed ? activeBg : 
                    button.state.hovered ? hoverBg : bg;
    ui.rect(x, y, width, height, bgColor);
    
    // Border
    ui.rect(x, y, width, 2, borderColor); // Top
    ui.rect(x, y + height - 2, width, 2, borderColor); // Bottom
    ui.rect(x, y, 2, height, borderColor); // Left
    ui.rect(x + width - 2, y, 2, height, borderColor); // Right
    
    // Centered label (estimate character width)
    const charW = 10; // Fallback
    const labelWidth = button.label.length * charW;
    const labelX = x + (width - labelWidth) / 2;
    const labelY = y + height / 2;
    
    ui.text(button.label, labelX, labelY, fg);
  }
  
  private renderLabel(label: GUILabel, ui: Draw2D, charW: number, _charH: number): void {
    const { x, y, width, height } = label.bounds;
    const { fg, bg } = label.labelStyle;
    
    // Background (if not transparent)
    const bgColor = bg as any;
    if (bgColor.a !== undefined && bgColor.a !== 0) {
      ui.rect(x, y, width, height, bg);
    }
    
    // Text alignment
    let textX = x;
    if (label.align === 'center') {
      const textWidth = label.text.length * charW;
      textX = x + (width - textWidth) / 2;
    } else if (label.align === 'right') {
      const textWidth = label.text.length * charW;
      textX = x + width - textWidth;
    }
    
    ui.text(label.text, textX, y + height / 2, fg);
  }
  
  private renderCheckbox(checkbox: GUICheckbox, ui: Draw2D, charW: number, _charH: number): void {
    const { x, y, height } = checkbox.bounds;
    const { fg, bg, checkColor, hoverBg } = checkbox.checkboxStyle;
    
    const boxSize = Math.min(height, charW * 2);
    const boxY = y + (height - boxSize) / 2;
    
    // Checkbox box background
    const bgColor = checkbox.state.hovered ? hoverBg : bg;
    ui.rect(x, boxY, boxSize, boxSize, bgColor);
    
    // Border
    ui.rect(x, boxY, boxSize, 1, fg);
    ui.rect(x, boxY + boxSize - 1, boxSize, 1, fg);
    ui.rect(x, boxY, 1, boxSize, fg);
    ui.rect(x + boxSize - 1, boxY, 1, boxSize, fg);
    
    // Check mark
    if (checkbox.checked) {
      const checkPadding = boxSize * 0.25;
      ui.rect(
        x + checkPadding,
        boxY + checkPadding,
        boxSize - checkPadding * 2,
        boxSize - checkPadding * 2,
        checkColor
      );
    }
    
    // Label
    ui.text(checkbox.label, x + boxSize + 8, y + height / 2, fg);
  }
  
  private renderSlider(slider: GUISlider, ui: Draw2D, _charW: number, charH: number): void {
    const { x, y, width, height } = slider.bounds;
    const { fg, trackColor, knobColor, knobHoverColor } = slider.sliderStyle;
    
    // Label (if present)
    let trackY = y;
    if (slider.label) {
      ui.text(slider.label, x, y, fg);
      trackY += charH;
    }
    
    // Track
    const trackHeight = 8;
    const trackYPos = trackY + (height - trackHeight) / 2;
    ui.rect(x, trackYPos, width, trackHeight, trackColor);
    
    // Knob
    const knobWidth = 16;
    const knobHeight = Math.min(height - (slider.label ? charH : 0), 24);
    const range = slider.max - slider.min;
    const ratio = range > 0 ? (slider.value - slider.min) / range : 0;
    const knobX = x + ratio * (width - knobWidth);
    const knobY = trackY + (height - knobHeight) / 2;
    
    const knobCol = slider.state.hovered || slider.isDragging() ? knobHoverColor : knobColor;
    ui.rect(knobX, knobY, knobWidth, knobHeight, knobCol);
    
    // Value text
    const valueText = `${Math.round(slider.value)}`;
    ui.text(valueText, x + width + 8, y + height / 2, fg);
  }
  
  /**
   * Set visibility for all widgets in a group
   */
  setGroupVisible(group: number, visible: boolean): void {
    this.widgetManager.setGroupVisible(group, visible);
  }
  
  /**
   * Get all widgets
   */
  getWidgets() {
    return this.widgetManager.getAll();
  }
}

// Re-export widget types for convenience
export { GUIButton, GUILabel, GUICheckbox, GUISlider, GUIMarkdownView, GUILayoutContainer };
export type {
  GUIButtonConfig,
  GUILabelConfig,
  GUICheckboxConfig,
  GUISliderConfig,
  GUIMarkdownViewConfig,
  GUILayoutContainerConfig
};
