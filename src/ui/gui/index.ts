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
import type { MarkdownStyle } from '../document/types.js';
import { ColorUtils, type Color } from '../../types.js';
import {
  applyButtonTokens,
  applyCheckboxTokens,
  applyContainerTokens,
  applyLabelTokens,
  applySliderTokens,
  applyTextEditorTokens,
  applyTextFieldTokens,
  createDefaultGUITokens,
  cloneGUITokens,
  mergeGUITokens,
  type GUITokenPatch,
  type GUITokens
} from './tokens.js';
import {
  createDefaultGUIMarkdownThemeDefaults,
  createDefaultGUIThemeDefaults,
  createGUIMarkdownThemeDefaultsFromStyles,
  createGUIThemeDefaultsFromStyles,
  type GUIMarkdownThemeDefaults,
  type GUIThemeDefaults
} from './theme.js';

/**
 * Main GUI system that manages graphical UI widgets
 */
export class GUISystem {
  private widgetManager: WidgetManager;
  private inputRouter: InputRouter;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private lastMouseDown: boolean = false;
  private tokens: GUITokens;
  private themeDefaults: GUIThemeDefaults;
  private markdownThemeDefaults: GUIMarkdownThemeDefaults;

  // Optional draw override hook. If it returns true, default drawing is skipped.
  private widgetRenderer: ((widgetInfo: WidgetDrawInfo, ui: Draw2D) => boolean | void) | null = null;
  
  constructor() {
    this.widgetManager = new WidgetManager();
    this.inputRouter = new InputRouter({ widgetManager: this.widgetManager });
    this.tokens = createDefaultGUITokens();
    this.themeDefaults = createDefaultGUIThemeDefaults();
    this.markdownThemeDefaults = createDefaultGUIMarkdownThemeDefaults();
  }

  setThemeDefaults(defaults: GUIThemeDefaults): GUIThemeDefaults {
    this.themeDefaults = {
      label: { ...defaults.label },
      button: { ...defaults.button },
      checkbox: { ...defaults.checkbox },
      slider: { ...defaults.slider },
      input: { ...defaults.input }
    };
    return this.themeDefaults;
  }

  setMarkdownThemeDefaults(defaults: GUIMarkdownThemeDefaults): GUIMarkdownThemeDefaults {
    this.markdownThemeDefaults = { ...defaults };
    return { ...this.markdownThemeDefaults };
  }

  setThemeFromStyles(getStyle: (name: string) => any): GUIThemeDefaults {
    this.setMarkdownThemeDefaults(createGUIMarkdownThemeDefaultsFromStyles(getStyle));
    return this.setThemeDefaults(createGUIThemeDefaultsFromStyles(getStyle));
  }

  getTokens(): GUITokens {
    return cloneGUITokens(this.tokens);
  }

  setTokens(patch?: GUITokenPatch | null): GUITokens {
    this.tokens = mergeGUITokens(this.tokens, patch);
    return this.getTokens();
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
    const renderContext = typeof widget.resolveRenderContext === 'function'
      ? widget.resolveRenderContext(charWidth, charHeight)
      : { charWidth, charHeight, scale: 1 };
    const base: WidgetDrawInfoCommon = {
      id: String(widget.id),
      bounds: { ...widget.bounds },
      state: { ...widget.state },
      group: widget.group,
      metrics: { charWidth: renderContext.charWidth, charHeight: renderContext.charHeight }
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

    if (widget instanceof GUITextField) {
      return { ...base, kind: 'textField', align: widget.align, value: widget.getValue(), placeholder: widget.placeholder };
    }

    if (widget instanceof GUITextEditor) {
      return { ...base, kind: 'textEditor', align: widget.align, value: widget.getValue(), placeholder: widget.placeholder };
    }

    return { ...base, kind: 'unknown' };
  }
  
  /**
   * Create a button widget
   */
  createButton(config: GUIButtonConfig): GUIButton {
    const button = new GUIButton(applyButtonTokens(config, this.tokens));
    this.widgetManager.register(button);
    return button;
  }
  
  /**
   * Create a label widget
   */
  createLabel(config: GUILabelConfig): GUILabel {
    const label = new GUILabel(applyLabelTokens(config, this.tokens));
    this.widgetManager.register(label);
    return label;
  }
  
  /**
   * Create a checkbox widget
   */
  createCheckbox(config: GUICheckboxConfig): GUICheckbox {
    const checkbox = new GUICheckbox(applyCheckboxTokens(config, this.tokens));
    this.widgetManager.register(checkbox);
    return checkbox;
  }
  
  /**
   * Create a slider widget
   */
  createSlider(config: GUISliderConfig): GUISlider {
    const slider = new GUISlider(applySliderTokens(config, this.tokens));
    this.widgetManager.register(slider);
    return slider;
  }

  /**
   * Create a text field widget
   */
  createTextField(config: GUITextFieldConfig): GUITextField {
    const tf = new GUITextField(applyTextFieldTokens(config, this.tokens));
    this.widgetManager.register(tf);
    return tf;
  }

  /**
   * Create a text editor widget (multi-line)
   */
  createTextEditor(config: GUITextEditorConfig): GUITextEditor {
    const editor = new GUITextEditor(applyTextEditorTokens(config, this.tokens));
    this.widgetManager.register(editor);
    return editor;
  }

  /**
   * Create a markdown view widget (flow layout inside bounds)
   */
  createMarkdownView(config: GUIMarkdownViewConfig): GUIMarkdownView {
    const view = new GUIMarkdownView({
      ...config,
      style: {
        ...(this.markdownThemeDefaults as Partial<MarkdownStyle>),
        ...(config.style ?? {})
      }
    });
    this.widgetManager.register(view);
    return view;
  }

  /**
   * Create a layout helper container.
   * Note: this does not register with the widget manager; it only updates child widget bounds.
   */
  createContainer(config: GUILayoutContainerConfig): GUILayoutContainer {
    return new GUILayoutContainer(applyContainerTokens(config, this.tokens));
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
      const metrics = slider.resolveRenderContext(charWidth, charHeight);
      slider.handleDrag(mouseX, mouseY, mouseDown, metrics.charHeight, metrics.scale);
    }

    // Update text field metrics (for caret placement/scroll)
    const textFields = this.widgetManager.getAll().filter(w => w instanceof GUITextField) as GUITextField[];
    for (const tf of textFields) {
      const metrics = tf.resolveRenderContext(charWidth, charHeight);
      tf.updateMetrics(metrics.charWidth, metrics.charHeight);
    }

    // Update text editor metrics
    const textEditors = this.widgetManager.getAll().filter(w => w instanceof GUITextEditor) as GUITextEditor[];
    for (const ed of textEditors) {
      const metrics = ed.resolveRenderContext(charWidth, charHeight);
      ed.updateMetrics(metrics.charWidth, metrics.charHeight);
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
   * Clear focused widget, if any.
   */
  clearFocus(): void {
    this.widgetManager.focus(null);
  }

  /**
   * Get the currently focused widget, if any.
   */
  getFocusedWidget(): any | null {
    return this.widgetManager.getFocused();
  }
  
  /**
   * Render all visible widgets
   * Call this in your render loop
   */
  render(uiAPI: Draw2D, charWidth: number, charHeight: number): void {
    if (!uiAPI) return;
    
    const widgets = this.widgetManager.getVisible();
    
    for (const widget of widgets) {
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
        this.renderButton(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUILabel) {
        this.renderLabel(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUICheckbox) {
        this.renderCheckbox(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUISlider) {
        this.renderSlider(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUITextField) {
        this.renderTextField(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUITextEditor) {
        this.renderTextEditor(widget, uiAPI, charWidth, charHeight);
      } else if (widget instanceof GUIMarkdownView) {
        this.renderMarkdownView(widget, uiAPI, charWidth, charHeight);
      }
    }
  }

  private renderTextField(tf: GUITextField, ui: Draw2D, charW: number, charH: number): void {
    const metrics = tf.resolveRenderContext(charW, charH);
    charW = metrics.charWidth;
    charH = metrics.charHeight;
    const { x, y, width, height } = tf.bounds;
    const {
      fg,
      bg,
      borderColor,
      focusBorderColor,
      drawBackground,
      drawBorder,
      paddingX,
      paddingY,
      borderWidth,
      focusBorderWidth
    } = this.resolveTextFieldStyle(tf);

    if (drawBackground) {
      ui.rect(x, y, width, height, bg);
    }

    if (drawBorder) {
      const b = tf.state.focused ? focusBorderWidth : borderWidth;
      const bc = tf.state.focused ? focusBorderColor : borderColor;
      ui.rect(x, y, width, b, bc);
      ui.rect(x, y + height - b, width, b, bc);
      ui.rect(x, y, b, height, bc);
      ui.rect(x + width - b, y, b, height, bc);
    }

    const innerX = x + paddingX;
    const innerW = Math.max(0, width - paddingX * 2);
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
    const textOffsetCols = tf.getAlignedColumnOffset(maxChars, visibleText.length);
    const textX = innerX + textOffsetCols * charW;
    const clipY = y + paddingY;
    const clipH = Math.max(0, height - paddingY * 2);
    const textY = y + Math.max(0, Math.floor((height - charH) / 2));

    // Optional clip to inner region (if backend supports it)
    if (ui.pushClipRect) ui.pushClipRect(innerX, clipY, innerW, clipH);

    if (visibleText.length > 0) {
      ui.text(visibleText, textX, textY, fg);
    } else if (tf.placeholder) {
      const placeholderCols = tf.getAlignedColumnOffset(maxChars, Math.min(maxChars, tf.placeholder.length));
      ui.text(tf.placeholder, innerX + placeholderCols * charW, textY, fg);
    }

    // Caret: invert by drawing a filled rect and re-drawing the character.
    if (tf.state.focused) {
      const caretLocal = cursorPos - scroll;
      const caretX = textX + caretLocal * charW;
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
    const metrics = ed.resolveRenderContext(charW, charH);
    charW = metrics.charWidth;
    charH = metrics.charHeight;
    const { x, y, width, height } = ed.bounds;
    const {
      fg,
      bg,
      borderColor,
      focusBorderColor,
      drawBackground,
      drawBorder,
      paddingX,
      paddingY,
      borderWidth,
      focusBorderWidth
    } = this.resolveTextEditorStyle(ed);

    if (drawBackground) {
      ui.rect(x, y, width, height, bg);
    }

    if (drawBorder) {
      const b = ed.state.focused ? focusBorderWidth : borderWidth;
      const bc = ed.state.focused ? focusBorderColor : borderColor;
      ui.rect(x, y, width, b, bc);
      ui.rect(x, y + height - b, width, b, bc);
      ui.rect(x, y, b, height, bc);
      ui.rect(x + width - b, y, b, height, bc);
    }

    const innerX = x + paddingX;
    const innerY = y + paddingY;
    const innerW = Math.max(0, width - paddingX * 2);
    const innerH = Math.max(0, height - paddingY * 2);
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
      const placeholderCols = ed.getAlignedColumnOffset(maxCols, ed.placeholder.length, 0);
      ui.text(ed.placeholder, innerX + placeholderCols * charW, innerY, fg);
    } else {
      for (let row = 0; row < maxRows; row++) {
        const lineIdx = scrollY + row;
        if (lineIdx >= lineCount) break;
        const line = ed.getLine(lineIdx);
        const visible = line.slice(scrollX, scrollX + maxCols);
        if (!visible) continue;
        const textY = innerY + row * charH;
        const textOffsetCols = ed.getAlignedColumnOffset(maxCols, line.length, scrollX);
        const textX = innerX + textOffsetCols * charW;
        ui.text(visible, textX, textY, fg);
      }
    }

    // Caret
    if (ed.state.focused) {
      const caretRow = info.cursorRow - scrollY;
      const caretCol = info.cursorCol - scrollX;
      if (caretRow >= 0 && caretRow < maxRows && caretCol >= 0 && caretCol < maxCols) {
        const line = ed.getLine(info.cursorRow);
        const caretOffsetCols = ed.getAlignedColumnOffset(maxCols, line.length, scrollX);
        const caretX = innerX + (caretOffsetCols + caretCol) * charW;
        const caretY = innerY + caretRow * charH;

        ui.rect(caretX, caretY, charW, charH, fg);

        const ch = info.cursorCol < line.length ? line[info.cursorCol] : ' ';
        ui.text(ch, caretX, caretY, bg);
      }
    }

    if (ui.popClipRect) ui.popClipRect();
  }

  private renderMarkdownView(view: GUIMarkdownView, ui: Draw2D, charW: number, charH: number): void {
    const metrics = view.resolveRenderContext(charW, charH);
    charW = metrics.charWidth;
    charH = metrics.charHeight;
    view.renderToUI(ui, charW, charH);
  }
  
  private renderButton(button: GUIButton, ui: Draw2D, charW: number, charH: number): void {
    const metrics = button.resolveRenderContext(charW, charH);
    charW = metrics.charWidth;
    charH = metrics.charHeight;
    const { x, y, width, height } = button.bounds;
    const { fg, bg, borderColor, hoverBg, activeBg, borderWidth, focusBorderWidth } = this.resolveButtonStyle(button);
    const label = String(button.label ?? '');
    
    // Background
    const bgColor = button.state.pressed ? activeBg : 
                    button.state.hovered ? hoverBg : bg;
    ui.rect(x, y, width, height, bgColor);
    
    // Border
    const border = button.getRenderPixels(button.state.focused ? focusBorderWidth : borderWidth);
    ui.rect(x, y, width, border, borderColor);
    ui.rect(x, y + height - border, width, border, borderColor);
    ui.rect(x, y, border, height, borderColor);
    ui.rect(x + width - border, y, border, height, borderColor);
    
    const labelWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(label) : label.length * charW;
    const labelX = x + (width - labelWidth) / 2;
    const labelY = y + Math.max(0, Math.floor((height - charH) / 2));
    
    ui.text(label, labelX, labelY, fg);
  }
  
  private renderLabel(label: GUILabel, ui: Draw2D, charW: number, charH: number): void {
    const metrics = label.resolveRenderContext(charW, charH);
    charW = metrics.charWidth;
    charH = metrics.charHeight;
    const { x, y, width, height } = label.bounds;
    const { fg, bg } = this.resolveLabelStyle(label);
    const text = String(label.text ?? '');
    
    // Background (if not transparent)
    if (ColorUtils.a(bg) !== 0) {
      ui.rect(x, y, width, height, bg);
    }
    
    // Text alignment
    let textX = x;
    if (label.align === 'center') {
      const textWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(text) : text.length * charW;
      textX = x + (width - textWidth) / 2;
    } else if (label.align === 'right') {
      const textWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(text) : text.length * charW;
      textX = x + width - textWidth;
    }
    
    ui.text(text, textX, y + Math.max(0, Math.floor((height - charH) / 2)), fg);
  }
  
  private renderCheckbox(checkbox: GUICheckbox, ui: Draw2D, charW: number, _charH: number): void {
    const metrics = checkbox.resolveRenderContext(charW, _charH);
    charW = metrics.charWidth;
    const charH = metrics.charHeight;
    const { x, y, height } = checkbox.bounds;
    const { fg, bg, borderColor, checkColor, hoverBg, boxSize, labelGap, borderWidth } = this.resolveCheckboxStyle(checkbox);
    const label = String(checkbox.label ?? '');
    
    const scaledBoxSize = checkbox.getRenderPixels(boxSize);
    const scaledLabelGap = checkbox.getRenderPixels(labelGap);
    const scaledBorderWidth = checkbox.getRenderPixels(borderWidth);
    const actualBoxSize = Math.min(height, Math.max(scaledBoxSize, charW));
    const boxY = y + (height - actualBoxSize) / 2;
    
    // Checkbox box background
    const bgColor = checkbox.state.hovered ? hoverBg : bg;
    ui.rect(x, boxY, actualBoxSize, actualBoxSize, bgColor);
    
    // Border
    ui.rect(x, boxY, actualBoxSize, scaledBorderWidth, borderColor);
    ui.rect(x, boxY + actualBoxSize - scaledBorderWidth, actualBoxSize, scaledBorderWidth, borderColor);
    ui.rect(x, boxY, scaledBorderWidth, actualBoxSize, borderColor);
    ui.rect(x + actualBoxSize - scaledBorderWidth, boxY, scaledBorderWidth, actualBoxSize, borderColor);
    
    // Check mark
    if (checkbox.checked) {
      const checkPadding = actualBoxSize * 0.25;
      ui.rect(
        x + checkPadding,
        boxY + checkPadding,
        actualBoxSize - checkPadding * 2,
        actualBoxSize - checkPadding * 2,
        checkColor
      );
    }
    
    // Label
    ui.text(label, x + actualBoxSize + scaledLabelGap, y + Math.max(0, Math.floor((height - charH) / 2)), fg);
  }
  
  private renderSlider(slider: GUISlider, ui: Draw2D, _charW: number, charH: number): void {
    const metrics = slider.resolveRenderContext(_charW, charH);
    charH = metrics.charHeight;
    const { x, y, width, height } = slider.bounds;
    const {
      fg,
      trackColor,
      knobColor,
      knobHoverColor,
      knobActiveColor,
      labelGap,
      trackHeight,
      knobWidth,
      knobHeight,
      valueGap
    } = this.resolveSliderStyle(slider);
    
    // Label (if present)
    const scaledLabelGap = slider.getRenderPixels(labelGap);
    const scaledTrackHeight = slider.getRenderPixels(trackHeight);
    const scaledKnobWidth = slider.getRenderPixels(knobWidth);
    const scaledKnobHeight = slider.getRenderPixels(knobHeight);
    const scaledValueGap = slider.getRenderPixels(valueGap);

    let trackY = y;
    if (slider.label) {
      ui.text(slider.label, x, y, fg);
      trackY += charH + scaledLabelGap;
    }
    const trackAreaH = Math.max(0, height - (slider.label ? charH + scaledLabelGap : 0));
    
    // Track
    const trackYPos = trackY + Math.max(0, (trackAreaH - scaledTrackHeight) / 2);
    ui.rect(x, trackYPos, width, scaledTrackHeight, trackColor);
    
    // Knob
    const actualKnobHeight = Math.min(trackAreaH, scaledKnobHeight);
    const range = slider.max - slider.min;
    const ratio = range > 0 ? (slider.value - slider.min) / range : 0;
    const knobX = x + ratio * (width - scaledKnobWidth);
    const knobY = trackY + Math.max(0, (trackAreaH - actualKnobHeight) / 2);
    
    const knobCol = slider.isDragging() ? knobActiveColor : (slider.state.hovered ? knobHoverColor : knobColor);
    ui.rect(knobX, knobY, scaledKnobWidth, actualKnobHeight, knobCol);
    
    // Value text
    if (slider.showValue) {
      const valueText = `${Math.round(slider.value)}`;
      ui.text(valueText, x + width + scaledValueGap, y + Math.max(0, Math.floor((height - charH) / 2)), fg);
    }
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

  private resolveLabelStyle(widget: GUILabel): { fg: Color; bg: Color } {
    return {
      fg: widget.labelStyle.fg ?? this.themeDefaults.label.fg,
      bg: widget.labelStyle.bg ?? this.themeDefaults.label.bg
    };
  }

  private resolveButtonStyle(widget: GUIButton): {
    fg: Color;
    bg: Color;
    borderColor: Color;
    hoverBg: Color;
    activeBg: Color;
    borderWidth: number;
    focusBorderWidth: number;
  } {
    return {
      fg: widget.buttonStyle.fg ?? this.themeDefaults.button.fg,
      bg: widget.buttonStyle.bg ?? this.themeDefaults.button.bg,
      borderColor: widget.state.focused
        ? this.themeDefaults.button.focusBorder
        : (widget.buttonStyle.borderColor ?? this.themeDefaults.button.border),
      hoverBg: widget.buttonStyle.hoverBg ?? this.themeDefaults.button.hoverBg,
      activeBg: widget.buttonStyle.activeBg ?? this.themeDefaults.button.activeBg,
      borderWidth: widget.buttonStyle.borderWidth,
      focusBorderWidth: widget.buttonStyle.focusBorderWidth
    };
  }

  private resolveCheckboxStyle(widget: GUICheckbox): {
    fg: Color;
    bg: Color;
    borderColor: Color;
    checkColor: Color;
    hoverBg: Color;
    boxSize: number;
    labelGap: number;
    borderWidth: number;
  } {
    return {
      fg: widget.checkboxStyle.fg ?? this.themeDefaults.checkbox.fg,
      bg: widget.checkboxStyle.bg ?? this.themeDefaults.checkbox.bg,
      borderColor: widget.state.focused
        ? this.themeDefaults.checkbox.focusBorder
        : this.themeDefaults.checkbox.border,
      checkColor: widget.checkboxStyle.checkColor ?? this.themeDefaults.checkbox.check,
      hoverBg: widget.checkboxStyle.hoverBg ?? this.themeDefaults.checkbox.hoverBg,
      boxSize: widget.checkboxStyle.boxSize,
      labelGap: widget.checkboxStyle.labelGap,
      borderWidth: widget.checkboxStyle.borderWidth
    };
  }

  private resolveSliderStyle(widget: GUISlider): {
    fg: Color;
    trackColor: Color;
    knobColor: Color;
    knobHoverColor: Color;
    knobActiveColor: Color;
    labelGap: number;
    trackHeight: number;
    knobWidth: number;
    knobHeight: number;
    valueGap: number;
  } {
    return {
      fg: widget.sliderStyle.fg ?? this.themeDefaults.slider.fg,
      trackColor: widget.sliderStyle.trackColor ?? this.themeDefaults.slider.track,
      knobColor: widget.sliderStyle.knobColor ?? this.themeDefaults.slider.knob,
      knobHoverColor: widget.sliderStyle.knobHoverColor ?? this.themeDefaults.slider.knobHover,
      knobActiveColor: this.themeDefaults.slider.knobActive,
      labelGap: widget.sliderStyle.labelGap,
      trackHeight: widget.sliderStyle.trackHeight,
      knobWidth: widget.sliderStyle.knobWidth,
      knobHeight: widget.sliderStyle.knobHeight,
      valueGap: widget.sliderStyle.valueGap
    };
  }

  private resolveTextFieldStyle(widget: GUITextField): {
    fg: Color;
    bg: Color;
    borderColor: Color;
    focusBorderColor: Color;
    drawBackground: boolean;
    drawBorder: boolean;
    paddingX: number;
    paddingY: number;
    borderWidth: number;
    focusBorderWidth: number;
  } {
    return {
      fg: widget.textFieldStyle.fg ?? this.themeDefaults.input.fg,
      bg: widget.textFieldStyle.bg ?? this.themeDefaults.input.bg,
      borderColor: widget.state.hovered
        ? this.themeDefaults.input.hoverBorder
        : (widget.textFieldStyle.borderColor ?? this.themeDefaults.input.border),
      focusBorderColor: widget.textFieldStyle.focusBorderColor ?? this.themeDefaults.input.focusBorder,
      drawBackground: widget.textFieldStyle.drawBackground,
      drawBorder: widget.textFieldStyle.drawBorder,
      paddingX: widget.textFieldStyle.paddingX,
      paddingY: widget.textFieldStyle.paddingY,
      borderWidth: widget.textFieldStyle.borderWidth,
      focusBorderWidth: widget.textFieldStyle.focusBorderWidth
    };
  }

  private resolveTextEditorStyle(widget: GUITextEditor): {
    fg: Color;
    bg: Color;
    borderColor: Color;
    focusBorderColor: Color;
    drawBackground: boolean;
    drawBorder: boolean;
    paddingX: number;
    paddingY: number;
    borderWidth: number;
    focusBorderWidth: number;
  } {
    return {
      fg: widget.textEditorStyle.fg ?? this.themeDefaults.input.fg,
      bg: widget.textEditorStyle.bg ?? this.themeDefaults.input.bg,
      borderColor: widget.state.hovered
        ? this.themeDefaults.input.hoverBorder
        : (widget.textEditorStyle.borderColor ?? this.themeDefaults.input.border),
      focusBorderColor: widget.textEditorStyle.focusBorderColor ?? this.themeDefaults.input.focusBorder,
      drawBackground: widget.textEditorStyle.drawBackground,
      drawBorder: widget.textEditorStyle.drawBorder,
      paddingX: widget.textEditorStyle.paddingX,
      paddingY: widget.textEditorStyle.paddingY,
      borderWidth: widget.textEditorStyle.borderWidth,
      focusBorderWidth: widget.textEditorStyle.focusBorderWidth
    };
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
