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
import { GUITextField, type GUITextFieldConfig } from './textfield.js';
import { GUITextEditor, type GUITextEditorConfig } from './texteditor.js';
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
   * Create a text field widget
   */
  createTextField(config: GUITextFieldConfig): GUITextField {
    const tf = new GUITextField(config);
    this.widgetManager.register(tf);
    return tf;
  }

  /**
   * Create a text editor widget (multi-line)
   */
  createTextEditor(config: GUITextEditorConfig): GUITextEditor {
    const editor = new GUITextEditor(config);
    this.widgetManager.register(editor);
    return editor;
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
      slider.handleDrag(mouseX, mouseY, mouseDown, charHeight);
    }

    // Update text field metrics (for caret placement/scroll)
    const textFields = this.widgetManager.getAll().filter(w => w instanceof GUITextField) as GUITextField[];
    for (const tf of textFields) {
      tf.updateMetrics(charWidth, charHeight);
    }

    // Update text editor metrics
    const textEditors = this.widgetManager.getAll().filter(w => w instanceof GUITextEditor) as GUITextEditor[];
    for (const ed of textEditors) {
      ed.updateMetrics(charWidth, charHeight);
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
   * Handle text input (printable characters)
   */
  handleText(text: string): void {
    this.inputRouter.handleText(text);
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
      } else if (widget instanceof GUITextField) {
        this.renderTextField(widget, uiAPI, charWidth);
      } else if (widget instanceof GUITextEditor) {
        this.renderTextEditor(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUIMarkdownView) {
        this.renderMarkdownView(widget, uiAPI, charWidth, charHeight);
      }
    }
  }

  private renderTextField(tf: GUITextField, ui: Draw2D, charW: number): void {
    const { x, y, width, height } = tf.bounds;
    const { fg, bg, borderColor, focusBorderColor } = tf.textFieldStyle;

    // Background
    ui.rect(x, y, width, height, bg);

    // Border (thicker when focused)
    const b = tf.state.focused ? 3 : 2;
    const bc = tf.state.focused ? focusBorderColor : borderColor;
    ui.rect(x, y, width, b, bc);
    ui.rect(x, y + height - b, width, b, bc);
    ui.rect(x, y, b, height, bc);
    ui.rect(x + width - b, y, b, height, bc);

    const padX = 8;
    const innerX = x + padX;
    const innerW = Math.max(0, width - padX * 2);
    const maxChars = Math.max(0, Math.floor(innerW / Math.max(1, charW)));

    const value = tf.getValue();
    const { cursorPos, scrollOffset } = tf.getCursorInfo();

    // Keep cursor visible (compute desired scroll and store back onto widget)
    let scroll = scrollOffset;
    if (cursorPos < scroll) scroll = cursorPos;
    else if (cursorPos > scroll + maxChars - 1) scroll = cursorPos - maxChars + 1;
    scroll = Math.max(0, Math.min(scroll, Math.max(0, value.length - maxChars)));
    tf.setScrollOffset(scroll);

    const visibleText = value.slice(scroll, scroll + maxChars);
    const textY = y + height / 2;

    // Optional clip to inner region (if backend supports it)
    if (ui.pushClipRect) ui.pushClipRect(innerX, y, innerW, height);

    if (visibleText.length > 0) {
      ui.text(visibleText, innerX, textY, fg);
    } else if (tf.placeholder) {
      ui.text(tf.placeholder, innerX, textY, fg);
    }

    // Caret: invert by drawing a filled rect and re-drawing the character.
    if (tf.state.focused) {
      const caretLocal = cursorPos - scroll;
      const caretX = innerX + caretLocal * charW;
      const caretW = charW;
      const caretH = Math.max(2, height - 8);
      const caretY = y + (height - caretH) / 2;

      if (caretX >= innerX && caretX < innerX + innerW) {
        ui.rect(caretX, caretY, caretW, caretH, fg);
        const ch = caretLocal >= 0 && caretLocal < visibleText.length ? visibleText[caretLocal] : ' ';
        ui.text(ch, caretX, textY, bg);
      }
    }

    if (ui.popClipRect) ui.popClipRect();
  }

  private renderTextEditor(ed: GUITextEditor, ui: Draw2D, charW: number, charH: number): void {
    const { x, y, width, height } = ed.bounds;
    const { fg, bg, borderColor, focusBorderColor } = ed.textEditorStyle;

    // Background
    ui.rect(x, y, width, height, bg);

    // Border (thicker when focused)
    const b = ed.state.focused ? 3 : 2;
    const bc = ed.state.focused ? focusBorderColor : borderColor;
    ui.rect(x, y, width, b, bc);
    ui.rect(x, y + height - b, width, b, bc);
    ui.rect(x, y, b, height, bc);
    ui.rect(x + width - b, y, b, height, bc);

    const padX = 8;
    const padY = 8;
    const innerX = x + padX;
    const innerY = y + padY;
    const innerW = Math.max(0, width - padX * 2);
    const innerH = Math.max(0, height - padY * 2);
    const maxCols = Math.max(0, Math.floor(innerW / Math.max(1, charW)));
    const maxRows = Math.max(0, Math.floor(innerH / Math.max(1, charH)));

    const info = ed.getCursorInfo();
    const lineCount = ed.getLineCount();
    const maxLineLen = ed.getMaxLineLength();

    // Keep cursor visible
    let scrollX = info.scrollX;
    let scrollY = info.scrollY;
    if (info.cursorRow < scrollY) scrollY = info.cursorRow;
    else if (info.cursorRow > scrollY + maxRows - 1) scrollY = info.cursorRow - maxRows + 1;
    scrollY = Math.max(0, Math.min(scrollY, Math.max(0, lineCount - maxRows)));

    if (info.cursorCol < scrollX) scrollX = info.cursorCol;
    else if (info.cursorCol > scrollX + maxCols - 1) scrollX = info.cursorCol - maxCols + 1;
    scrollX = Math.max(0, Math.min(scrollX, Math.max(0, maxLineLen - maxCols)));

    ed.setScroll(scrollX, scrollY);

    if (ui.pushClipRect) ui.pushClipRect(innerX, innerY, innerW, innerH);

    const value = ed.getValue();
    if (value.length === 0 && ed.placeholder) {
      ui.text(ed.placeholder, innerX, innerY, fg);
    } else {
      for (let row = 0; row < maxRows; row++) {
        const lineIdx = scrollY + row;
        if (lineIdx >= lineCount) break;
        const line = ed.getLine(lineIdx);
        const visible = line.slice(scrollX, scrollX + maxCols);
        if (!visible) continue;
        const textY = innerY + row * charH;
        ui.text(visible, innerX, textY, fg);
      }
    }

    // Caret
    if (ed.state.focused) {
      const caretRow = info.cursorRow - scrollY;
      const caretCol = info.cursorCol - scrollX;
      if (caretRow >= 0 && caretRow < maxRows && caretCol >= 0 && caretCol < maxCols) {
        const caretX = innerX + caretCol * charW;
        const caretY = innerY + caretRow * charH;

        ui.rect(caretX, caretY, charW, charH, fg);

        const line = ed.getLine(info.cursorRow);
        const ch = info.cursorCol < line.length ? line[info.cursorCol] : ' ';
        ui.text(ch, caretX, caretY, bg);
      }
    }

    if (ui.popClipRect) ui.popClipRect();
  }

  private renderMarkdownView(view: GUIMarkdownView, ui: Draw2D, charW: number, charH: number): void {
    view.renderToUI(ui, charW, charH);
  }
  
  private renderButton(button: GUIButton, ui: Draw2D): void {
    const { x, y, width, height } = button.bounds;
    const { fg, bg, borderColor, hoverBg, activeBg } = button.buttonStyle;
    const label = String(button.label ?? '');
    
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
    const labelWidth = label.length * charW;
    const labelX = x + (width - labelWidth) / 2;
    const labelY = y + height / 2;
    
    ui.text(label, labelX, labelY, fg);
  }
  
  private renderLabel(label: GUILabel, ui: Draw2D, charW: number, _charH: number): void {
    const { x, y, width, height } = label.bounds;
    const { fg, bg } = label.labelStyle;
    const text = String(label.text ?? '');
    
    // Background (if not transparent)
    const bgColor = bg as any;
    if (bgColor.a !== undefined && bgColor.a !== 0) {
      ui.rect(x, y, width, height, bg);
    }
    
    // Text alignment
    let textX = x;
    if (label.align === 'center') {
      const textWidth = text.length * charW;
      textX = x + (width - textWidth) / 2;
    } else if (label.align === 'right') {
      const textWidth = text.length * charW;
      textX = x + width - textWidth;
    }
    
    ui.text(text, textX, y + height / 2, fg);
  }
  
  private renderCheckbox(checkbox: GUICheckbox, ui: Draw2D, charW: number, _charH: number): void {
    const { x, y, height } = checkbox.bounds;
    const { fg, bg, checkColor, hoverBg } = checkbox.checkboxStyle;
    const label = String(checkbox.label ?? '');
    
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
    ui.text(label, x + boxSize + 8, y + height / 2, fg);
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

  /**
   * Get widget manager (for advanced usage)
   */
  getWidgetManager(): WidgetManager {
    return this.widgetManager;
  }
}

// Re-export widget types for convenience
export { GUIButton, GUILabel, GUICheckbox, GUISlider, GUITextField, GUITextEditor, GUIMarkdownView, GUILayoutContainer };
export type {
  GUIButtonConfig,
  GUILabelConfig,
  GUICheckboxConfig,
  GUISliderConfig,
  GUITextFieldConfig,
  GUITextEditorConfig,
  GUIMarkdownViewConfig,
  GUILayoutContainerConfig
};
