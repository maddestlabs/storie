/**
 * GUI System
 * Main entry point for graphical retained-mode UI (WebGPU/Canvas)
 */
import { WidgetManager } from '../core/widget-manager.js';
import { InputRouter } from '../core/input-router.js';
import { isTextInputCapable } from '../core/text-input.js';
import { GUIButton } from './button.js';
import { GUILabel } from './label.js';
import { GUICheckbox } from './checkbox.js';
import { GUISlider } from './slider.js';
import { GUIPianoKeyboard } from './piano.js';
import { GUITextField } from './textfield.js';
import { GUITextEditor } from './texteditor.js';
import { GUIMarkdownView } from './markdown-view.js';
import { GUILayoutContainer } from './layout-container.js';
import { ColorUtils } from '../../types.js';
import { applyButtonTokens, applyCheckboxTokens, applyContainerTokens, applyLabelTokens, applySliderTokens, applyTextEditorTokens, applyTextFieldTokens, createDefaultGUITokens, cloneGUITokens, mergeGUITokens } from './tokens.js';
import { createDefaultGUIMarkdownThemeDefaults, createDefaultGUIThemeDefaults, createGUIMarkdownThemeDefaultsFromStyles, createGUIThemeDefaultsFromStyles } from './theme.js';
/**
 * Main GUI system that manages graphical UI widgets
 */
export class GUISystem {
    widgetManager;
    inputRouter;
    lastMouseX = 0;
    lastMouseY = 0;
    lastMouseDown = false;
    tokens;
    themeDefaults;
    markdownThemeDefaults;
    // Optional draw override hook. If it returns true, default drawing is skipped.
    widgetRenderer = null;
    constructor() {
        this.widgetManager = new WidgetManager();
        this.inputRouter = new InputRouter({ widgetManager: this.widgetManager });
        this.tokens = createDefaultGUITokens();
        this.themeDefaults = createDefaultGUIThemeDefaults();
        this.markdownThemeDefaults = createDefaultGUIMarkdownThemeDefaults();
    }
    setThemeDefaults(defaults) {
        this.themeDefaults = {
            label: { ...defaults.label },
            button: { ...defaults.button },
            checkbox: { ...defaults.checkbox },
            slider: { ...defaults.slider },
            input: { ...defaults.input }
        };
        return this.themeDefaults;
    }
    setMarkdownThemeDefaults(defaults) {
        this.markdownThemeDefaults = { ...defaults };
        return { ...this.markdownThemeDefaults };
    }
    setThemeFromStyles(getStyle) {
        this.setMarkdownThemeDefaults(createGUIMarkdownThemeDefaultsFromStyles(getStyle));
        return this.setThemeDefaults(createGUIThemeDefaultsFromStyles(getStyle));
    }
    getTokens() {
        return cloneGUITokens(this.tokens);
    }
    setTokens(patch) {
        this.tokens = mergeGUITokens(this.tokens, patch);
        return this.getTokens();
    }
    /**
     * Set a custom renderer hook for widgets.
     * The callback receives a plain widgetInfo object (safe snapshot), plus the uiAPI.
     * If the callback returns true, GUISystem will skip its default renderer for that widget.
     */
    setWidgetRenderer(renderer) {
        this.widgetRenderer = renderer;
    }
    withTemporarilyHiddenGroups(groupIds, callback) {
        const previousStates = [];
        const seen = new Set();
        if (groupIds) {
            for (const groupId of groupIds) {
                if (seen.has(groupId))
                    continue;
                seen.add(groupId);
                previousStates.push({ groupId, visible: this.widgetManager.isGroupVisible(groupId) });
                this.widgetManager.setGroupVisible(groupId, false);
            }
        }
        try {
            return callback();
        }
        finally {
            for (const { groupId, visible } of previousStates) {
                this.widgetManager.setGroupVisible(groupId, visible);
            }
        }
    }
    getWidgetGroup(widget) {
        return this.widgetManager.getGroupState(widget.group);
    }
    getGroupScale(group) {
        const scale = Number(group.transform.scale);
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }
    getGroupOpacity(group) {
        const opacity = Number(group.presentation.opacity);
        if (!Number.isFinite(opacity))
            return 1;
        return Math.max(0, Math.min(1, opacity));
    }
    getTransformedBounds(widget, group) {
        const scale = this.getGroupScale(group);
        return {
            x: group.transform.x + widget.bounds.x * scale,
            y: group.transform.y + widget.bounds.y * scale,
            width: widget.bounds.width * scale,
            height: widget.bounds.height * scale,
        };
    }
    applyOpacityToColor(color, opacity) {
        if (opacity >= 0.999)
            return color;
        if (opacity <= 0.001)
            return ColorUtils.rgba(ColorUtils.r(color), ColorUtils.g(color), ColorUtils.b(color), 0);
        return ColorUtils.rgba(ColorUtils.r(color), ColorUtils.g(color), ColorUtils.b(color), Math.round(ColorUtils.a(color) * opacity));
    }
    withWidgetGroupContext(widget, run) {
        const group = this.getWidgetGroup(widget);
        const opacity = this.getGroupOpacity(group);
        const transformedBounds = this.getTransformedBounds(widget, group);
        const originalBounds = { ...widget.bounds };
        const originalScale = typeof widget.getRenderScale === 'function' ? widget.getRenderScale() : 1;
        const groupScale = this.getGroupScale(group);
        widget.bounds = transformedBounds;
        if (typeof widget.setRenderScale === 'function') {
            widget.setRenderScale(originalScale * groupScale);
        }
        try {
            return run(group, opacity);
        }
        finally {
            widget.bounds = originalBounds;
            if (typeof widget.setRenderScale === 'function') {
                widget.setRenderScale(originalScale);
            }
        }
    }
    createOpacityAdjustedUI(ui, opacity) {
        if (opacity >= 0.999)
            return ui;
        return {
            rect: (x, y, w, h, color) => ui.rect(x, y, w, h, this.applyOpacityToColor(color, opacity)),
            text: (text, x, y, color, scale) => ui.text(text, x, y, this.applyOpacityToColor(color, opacity), scale),
            measureTextWidth: ui.measureTextWidth ? (text) => ui.measureTextWidth(text) : undefined,
            image: ui.image
                ? (imageId, x, y, w, h, options) => ui.image(imageId, x, y, w, h, options && options.tint
                    ? { ...options, tint: this.applyOpacityToColor(options.tint, opacity) }
                    : options)
                : undefined,
            getImageSize: ui.getImageSize ? (imageId) => ui.getImageSize(imageId) : undefined,
            clear: ui.clear ? (color) => ui.clear(this.applyOpacityToColor(color, opacity)) : undefined,
            pushClipRect: ui.pushClipRect ? (x, y, w, h) => ui.pushClipRect(x, y, w, h) : undefined,
            popClipRect: ui.popClipRect ? () => ui.popClipRect() : undefined,
            pushMaskRect: ui.pushMaskRect ? (x, y, w, h) => ui.pushMaskRect(x, y, w, h) : undefined,
            pushMaskRoundedRect: ui.pushMaskRoundedRect ? (x, y, w, h, radius) => ui.pushMaskRoundedRect(x, y, w, h, radius) : undefined,
            pushMaskPolygon: ui.pushMaskPolygon ? (points) => ui.pushMaskPolygon(points) : undefined,
            popMask: ui.popMask ? () => ui.popMask() : undefined,
            colors: ui.colors,
            metrics: ui.metrics,
        };
    }
    buildWidgetInfo(widget, charWidth, charHeight) {
        const renderContext = typeof widget.resolveRenderContext === 'function'
            ? widget.resolveRenderContext(charWidth, charHeight)
            : { charWidth, charHeight, scale: 1 };
        const base = {
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
        if (widget instanceof GUIPianoKeyboard) {
            return {
                ...base,
                kind: 'pianoKeyboard',
                orientation: widget.orientation,
                activeMidi: widget.getActiveMidi(),
                visibleWhiteKeys: widget.visibleWhiteKeys
            };
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
    createButton(config) {
        const button = new GUIButton(applyButtonTokens(config, this.tokens));
        this.widgetManager.register(button);
        return button;
    }
    /**
     * Create a label widget
     */
    createLabel(config) {
        const label = new GUILabel(applyLabelTokens(config, this.tokens));
        this.widgetManager.register(label);
        return label;
    }
    /**
     * Create a checkbox widget
     */
    createCheckbox(config) {
        const checkbox = new GUICheckbox(applyCheckboxTokens(config, this.tokens));
        this.widgetManager.register(checkbox);
        return checkbox;
    }
    /**
     * Create a slider widget
     */
    createSlider(config) {
        const slider = new GUISlider(applySliderTokens(config, this.tokens));
        this.widgetManager.register(slider);
        return slider;
    }
    /**
     * Create a piano keyboard widget
     */
    createPianoKeyboard(config) {
        const piano = new GUIPianoKeyboard(config);
        this.widgetManager.register(piano);
        return piano;
    }
    /**
     * Create a text field widget
     */
    createTextField(config) {
        const tf = new GUITextField(applyTextFieldTokens(config, this.tokens));
        this.widgetManager.register(tf);
        return tf;
    }
    /**
     * Create a text editor widget (multi-line)
     */
    createTextEditor(config) {
        const editor = new GUITextEditor(applyTextEditorTokens(config, this.tokens));
        this.widgetManager.register(editor);
        return editor;
    }
    /**
     * Create a markdown view widget (flow layout inside bounds)
     */
    createMarkdownView(config) {
        const view = new GUIMarkdownView({
            ...config,
            style: {
                ...this.markdownThemeDefaults,
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
    createContainer(config) {
        return new GUILayoutContainer(applyContainerTokens(config, this.tokens));
    }
    /**
     * Update all widgets with current input state (pixel coordinates)
     * Call this in your update loop
     */
    update(mouseX, mouseY, mouseDown, charWidth, charHeight) {
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        this.lastMouseDown = mouseDown;
        // GUI works in pixel coordinates
        const cellX = Math.floor(mouseX / charWidth);
        const cellY = Math.floor(mouseY / charHeight);
        const inputCoord = {
            x: mouseX,
            y: mouseY,
            cellX,
            cellY
        };
        // Update input routing
        this.inputRouter.update(inputCoord, mouseDown);
        // Update sliders (for drag behavior)
        const sliders = this.widgetManager.getAll().filter(w => w instanceof GUISlider);
        for (const slider of sliders) {
            this.withWidgetGroupContext(slider, () => {
                const metrics = slider.resolveRenderContext(charWidth, charHeight);
                slider.handleDrag(mouseX, mouseY, mouseDown, metrics.charHeight, metrics.scale);
            });
        }
        const pianos = this.widgetManager.getAll().filter(w => w instanceof GUIPianoKeyboard);
        for (const piano of pianos) {
            this.withWidgetGroupContext(piano, () => {
                piano.handlePointer(mouseX, mouseY, mouseDown);
            });
        }
        // Update text field metrics (for caret placement/scroll)
        const textFields = this.widgetManager.getAll().filter(w => w instanceof GUITextField);
        for (const tf of textFields) {
            this.withWidgetGroupContext(tf, () => {
                const metrics = tf.resolveRenderContext(charWidth, charHeight);
                tf.updateMetrics(metrics.charWidth, metrics.charHeight);
            });
        }
        // Update text editor metrics
        const textEditors = this.widgetManager.getAll().filter(w => w instanceof GUITextEditor);
        for (const ed of textEditors) {
            this.withWidgetGroupContext(ed, () => {
                const metrics = ed.resolveRenderContext(charWidth, charHeight);
                ed.updateMetrics(metrics.charWidth, metrics.charHeight);
            });
        }
    }
    updateExcludingGroups(mouseX, mouseY, mouseDown, charWidth, charHeight, excludedGroups) {
        this.withTemporarilyHiddenGroups(excludedGroups, () => {
            this.update(mouseX, mouseY, mouseDown, charWidth, charHeight);
        });
    }
    /**
     * Handle a mouse update immediately (for use in on:input)
     */
    handleMouse(mouseX, mouseY, mouseDown, charWidth, charHeight) {
        this.update(mouseX, mouseY, mouseDown, charWidth, charHeight);
    }
    handleMouseExcludingGroups(mouseX, mouseY, mouseDown, charWidth, charHeight, excludedGroups) {
        this.withTemporarilyHiddenGroups(excludedGroups, () => {
            this.handleMouse(mouseX, mouseY, mouseDown, charWidth, charHeight);
        });
    }
    /**
     * Get last observed mouse state (pixel coordinates)
     */
    getMouseState() {
        return { x: this.lastMouseX, y: this.lastMouseY, down: this.lastMouseDown };
    }
    /**
     * Handle keyboard input
     */
    handleKey(key, modifiers) {
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
    handleText(text) {
        this.inputRouter.handleText(text);
    }
    /**
     * Clear focused widget, if any.
     */
    clearFocus() {
        this.widgetManager.focus(null);
    }
    /**
     * Get the currently focused widget, if any.
     */
    getFocusedWidget() {
        return this.widgetManager.getFocused();
    }
    getFocusedTextInput() {
        const focused = this.widgetManager.getFocused();
        return isTextInputCapable(focused) ? focused : null;
    }
    /**
     * Render all visible widgets
     * Call this in your render loop
     */
    render(uiAPI, charWidth, charHeight) {
        if (!uiAPI)
            return;
        const widgets = this.widgetManager.getVisible();
        for (const widget of widgets) {
            const handled = this.withWidgetGroupContext(widget, (_group, opacity) => {
                const widgetUI = this.createOpacityAdjustedUI(uiAPI, opacity);
                if (this.widgetRenderer) {
                    try {
                        const info = this.buildWidgetInfo(widget, charWidth, charHeight);
                        if (this.widgetRenderer(info, widgetUI) === true) {
                            return true;
                        }
                    }
                    catch (err) {
                        // If custom rendering fails, fall back to default drawing.
                        console.warn('gui.setWidgetRenderer callback threw; falling back to default widget rendering.', err);
                    }
                }
                if (widget instanceof GUIButton) {
                    this.renderButton(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUILabel) {
                    this.renderLabel(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUICheckbox) {
                    this.renderCheckbox(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUISlider) {
                    this.renderSlider(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUIPianoKeyboard) {
                    this.renderPianoKeyboard(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUITextField) {
                    this.renderTextField(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUITextEditor) {
                    this.renderTextEditor(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUIMarkdownView) {
                    this.renderMarkdownView(widget, widgetUI, charWidth, charHeight);
                }
                return false;
            });
            if (handled === true)
                continue;
        }
    }
    renderExcludingGroups(excludedGroups, uiAPI, charWidth, charHeight) {
        this.withTemporarilyHiddenGroups(excludedGroups, () => {
            this.render(uiAPI, charWidth, charHeight);
        });
    }
    /**
     * Render only widgets belonging to a specific group.
     * This is used by Worlds to attach GUI widgets to a section-space transform.
     */
    renderGroup(group, uiAPI, charWidth, charHeight) {
        if (!uiAPI)
            return;
        const widgets = this.widgetManager.getVisible().filter((widget) => widget?.group === group);
        for (const widget of widgets) {
            const handled = this.withWidgetGroupContext(widget, (_group, opacity) => {
                const widgetUI = this.createOpacityAdjustedUI(uiAPI, opacity);
                if (this.widgetRenderer) {
                    try {
                        const info = this.buildWidgetInfo(widget, charWidth, charHeight);
                        if (this.widgetRenderer(info, widgetUI) === true) {
                            return true;
                        }
                    }
                    catch (err) {
                        console.warn('gui.setWidgetRenderer callback threw; falling back to default widget rendering.', err);
                    }
                }
                if (widget instanceof GUIButton) {
                    this.renderButton(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUILabel) {
                    this.renderLabel(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUICheckbox) {
                    this.renderCheckbox(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUISlider) {
                    this.renderSlider(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUIPianoKeyboard) {
                    this.renderPianoKeyboard(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUITextField) {
                    this.renderTextField(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUITextEditor) {
                    this.renderTextEditor(widget, widgetUI, charWidth, charHeight);
                }
                else if (widget instanceof GUIMarkdownView) {
                    this.renderMarkdownView(widget, widgetUI, charWidth, charHeight);
                }
                return false;
            });
            if (handled === true)
                continue;
        }
    }
    renderTextField(tf, ui, charW, charH) {
        const metrics = tf.resolveRenderContext(charW, charH);
        charW = metrics.charWidth;
        charH = metrics.charHeight;
        const { x, y, width, height } = tf.bounds;
        const { fg, bg, borderColor, focusBorderColor, drawBackground, drawBorder, paddingX, paddingY, borderWidth, focusBorderWidth } = this.resolveTextFieldStyle(tf);
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
        if (cursorPos < scroll)
            scroll = cursorPos;
        else if (cursorPos > scroll + maxChars - 1)
            scroll = cursorPos - maxChars + 1;
        scroll = Math.max(0, Math.min(scroll, Math.max(0, value.length - maxChars)));
        tf.setScrollOffset(scroll);
        const visibleText = value.slice(scroll, scroll + maxChars);
        const textOffsetCols = tf.getAlignedColumnOffset(maxChars, visibleText.length);
        const textX = innerX + textOffsetCols * charW;
        const clipY = y + paddingY;
        const clipH = Math.max(0, height - paddingY * 2);
        const textY = y + Math.max(0, Math.floor((height - charH) / 2));
        // Optional clip to inner region (if backend supports it)
        if (ui.pushClipRect)
            ui.pushClipRect(innerX, clipY, innerW, clipH);
        if (visibleText.length > 0) {
            ui.text(visibleText, textX, textY, fg);
        }
        else if (tf.placeholder) {
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
        if (ui.popClipRect)
            ui.popClipRect();
    }
    renderTextEditor(ed, ui, charW, charH) {
        const metrics = ed.resolveRenderContext(charW, charH);
        charW = metrics.charWidth;
        charH = metrics.charHeight;
        const { x, y, width, height } = ed.bounds;
        const { fg, bg, borderColor, focusBorderColor, drawBackground, drawBorder, paddingX, paddingY, borderWidth, focusBorderWidth } = this.resolveTextEditorStyle(ed);
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
        if (info.cursorRow < scrollY)
            scrollY = info.cursorRow;
        else if (info.cursorRow > scrollY + maxRows - 1)
            scrollY = info.cursorRow - maxRows + 1;
        scrollY = Math.max(0, Math.min(scrollY, Math.max(0, lineCount - maxRows)));
        if (info.cursorCol < scrollX)
            scrollX = info.cursorCol;
        else if (info.cursorCol > scrollX + maxCols - 1)
            scrollX = info.cursorCol - maxCols + 1;
        scrollX = Math.max(0, Math.min(scrollX, Math.max(0, maxLineLen - maxCols)));
        ed.setScroll(scrollX, scrollY);
        if (ui.pushClipRect)
            ui.pushClipRect(innerX, innerY, innerW, innerH);
        const value = ed.getValue();
        if (value.length === 0 && ed.placeholder) {
            const placeholderCols = ed.getAlignedColumnOffset(maxCols, ed.placeholder.length, 0);
            ui.text(ed.placeholder, innerX + placeholderCols * charW, innerY, fg);
        }
        else {
            for (let row = 0; row < maxRows; row++) {
                const lineIdx = scrollY + row;
                if (lineIdx >= lineCount)
                    break;
                const line = ed.getLine(lineIdx);
                const visible = line.slice(scrollX, scrollX + maxCols);
                if (!visible)
                    continue;
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
        if (ui.popClipRect)
            ui.popClipRect();
    }
    renderMarkdownView(view, ui, charW, charH) {
        const metrics = view.resolveRenderContext(charW, charH);
        charW = metrics.charWidth;
        charH = metrics.charHeight;
        view.renderToUI(ui, charW, charH);
    }
    renderButton(button, ui, charW, charH) {
        const metrics = button.resolveRenderContext(charW, charH);
        const renderScale = metrics.scale;
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
        const labelWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(label, renderScale) : label.length * charW;
        const labelX = x + (width - labelWidth) / 2;
        const labelY = y + Math.max(0, Math.floor((height - charH) / 2));
        ui.text(label, labelX, labelY, fg, renderScale);
    }
    renderLabel(label, ui, charW, charH) {
        const metrics = label.resolveRenderContext(charW, charH);
        const renderScale = metrics.scale;
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
            const textWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(text, renderScale) : text.length * charW;
            textX = x + (width - textWidth) / 2;
        }
        else if (label.align === 'right') {
            const textWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(text, renderScale) : text.length * charW;
            textX = x + width - textWidth;
        }
        ui.text(text, textX, y + Math.max(0, Math.floor((height - charH) / 2)), fg, renderScale);
    }
    renderCheckbox(checkbox, ui, charW, _charH) {
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
            ui.rect(x + checkPadding, boxY + checkPadding, actualBoxSize - checkPadding * 2, actualBoxSize - checkPadding * 2, checkColor);
        }
        // Label
        ui.text(label, x + actualBoxSize + scaledLabelGap, y + Math.max(0, Math.floor((height - charH) / 2)), fg);
    }
    renderSlider(slider, ui, _charW, charH) {
        const metrics = slider.resolveRenderContext(_charW, charH);
        charH = metrics.charHeight;
        const { x, y, width, height } = slider.bounds;
        const { fg, trackColor, knobColor, knobHoverColor, knobActiveColor, labelGap, trackHeight, knobWidth, knobHeight, valueGap } = this.resolveSliderStyle(slider);
        // Label (if present)
        const scaledLabelGap = slider.getRenderPixels(labelGap);
        const scaledTrackHeight = slider.getRenderPixels(trackHeight);
        const scaledKnobWidth = slider.getRenderPixels(knobWidth);
        const scaledKnobHeight = slider.getRenderPixels(knobHeight);
        const scaledValueGap = slider.getRenderPixels(valueGap);
        if (slider.orientation === 'vertical') {
            let trackTopY = y;
            if (slider.label) {
                ui.text(slider.label, x, y, fg);
                trackTopY += charH + scaledLabelGap;
            }
            const valueReserve = slider.showValue ? charH + scaledValueGap : 0;
            const trackAreaH = Math.max(0, height - (slider.label ? charH + scaledLabelGap : 0) - valueReserve);
            const trackX = x + Math.max(0, (width - scaledTrackHeight) / 2);
            ui.rect(trackX, trackTopY, scaledTrackHeight, trackAreaH, trackColor);
            const actualKnobWidth = Math.min(width, scaledKnobWidth);
            const actualKnobHeight = Math.min(trackAreaH, scaledKnobHeight);
            const range = slider.max - slider.min;
            const ratio = range > 0 ? (slider.value - slider.min) / range : 0;
            const knobTravel = Math.max(0, trackAreaH - actualKnobHeight);
            const knobY = trackTopY + (1 - ratio) * knobTravel;
            const knobX = x + Math.max(0, (width - actualKnobWidth) / 2);
            const knobCol = slider.isDragging() ? knobActiveColor : (slider.state.hovered ? knobHoverColor : knobColor);
            ui.rect(knobX, knobY, actualKnobWidth, actualKnobHeight, knobCol);
            if (slider.showValue) {
                const valueText = `${Math.round(slider.value)}`;
                const valueY = trackTopY + trackAreaH + scaledValueGap;
                ui.text(valueText, x + Math.max(0, Math.floor((width - valueText.length * (_charW || 8)) / 2)), valueY, fg);
            }
            return;
        }
        let trackY = y;
        if (slider.label) {
            ui.text(slider.label, x, y, fg);
            trackY += charH + scaledLabelGap;
        }
        const trackAreaH = Math.max(0, height - (slider.label ? charH + scaledLabelGap : 0));
        const trackYPos = trackY + Math.max(0, (trackAreaH - scaledTrackHeight) / 2);
        ui.rect(x, trackYPos, width, scaledTrackHeight, trackColor);
        const actualKnobHeight = Math.min(trackAreaH, scaledKnobHeight);
        const range = slider.max - slider.min;
        const ratio = range > 0 ? (slider.value - slider.min) / range : 0;
        const knobX = x + ratio * (width - scaledKnobWidth);
        const knobY = trackY + Math.max(0, (trackAreaH - actualKnobHeight) / 2);
        const knobCol = slider.isDragging() ? knobActiveColor : (slider.state.hovered ? knobHoverColor : knobColor);
        ui.rect(knobX, knobY, scaledKnobWidth, actualKnobHeight, knobCol);
        if (slider.showValue) {
            const valueText = `${Math.round(slider.value)}`;
            ui.text(valueText, x + width + scaledValueGap, y + Math.max(0, Math.floor((height - charH) / 2)), fg);
        }
    }
    renderPianoKeyboard(widget, ui, charW, charH) {
        const layout = widget.getLayoutSnapshot();
        const metrics = widget.resolveRenderContext(charW, charH);
        charW = metrics.charWidth;
        charH = metrics.charHeight;
        const style = widget.pianoStyle;
        const border = widget.getRenderPixels(style.borderWidth);
        const activeMidi = widget.getActiveMidi();
        const hoveredMidi = widget.getHoveredMidi();
        ui.rect(widget.bounds.x, widget.bounds.y, widget.bounds.width, widget.bounds.height, style.background);
        if (layout.railBounds) {
            ui.rect(layout.railBounds.x, layout.railBounds.y, layout.railBounds.width, layout.railBounds.height, style.railColor);
            if (layout.railThumbBounds) {
                const hoverRail = widget.state.hovered && layout.railBounds
                    && (widget.orientation === 'horizontal'
                        ? this.lastMouseY >= layout.railBounds.y && this.lastMouseY < layout.railBounds.y + layout.railBounds.height
                        : this.lastMouseX >= layout.railBounds.x && this.lastMouseX < layout.railBounds.x + layout.railBounds.width);
                const thumbColor = widget.state.pressed
                    ? style.railThumbActiveColor
                    : hoverRail
                        ? style.railThumbHoverColor
                        : style.railThumbColor;
                ui.rect(layout.railThumbBounds.x, layout.railThumbBounds.y, layout.railThumbBounds.width, layout.railThumbBounds.height, style.railViewportColor);
                ui.rect(layout.railThumbBounds.x, layout.railThumbBounds.y, layout.railThumbBounds.width, layout.railThumbBounds.height, thumbColor);
            }
        }
        if (ui.pushClipRect)
            ui.pushClipRect(layout.mainBounds.x, layout.mainBounds.y, layout.mainBounds.width, layout.mainBounds.height);
        for (const key of layout.whiteKeys) {
            const isActive = activeMidi === key.midi;
            const isHovered = widget.state.hovered && key.midi === hoveredMidi;
            const fill = isActive ? style.whiteKeyActiveColor : (isHovered ? style.whiteKeyHoverColor : style.whiteKeyColor);
            ui.rect(key.bounds.x, key.bounds.y, key.bounds.width, key.bounds.height, fill);
            ui.rect(key.bounds.x, key.bounds.y, key.bounds.width, border, style.whiteKeyBorderColor);
            ui.rect(key.bounds.x, key.bounds.y + key.bounds.height - border, key.bounds.width, border, style.whiteKeyBorderColor);
            ui.rect(key.bounds.x, key.bounds.y, border, key.bounds.height, style.whiteKeyBorderColor);
            ui.rect(key.bounds.x + key.bounds.width - border, key.bounds.y, border, key.bounds.height, style.whiteKeyBorderColor);
            if (key.noteName.startsWith('C') && key.midi !== layout.firstVisibleMidi) {
                if (widget.orientation === 'horizontal') {
                    ui.rect(key.bounds.x, key.bounds.y, border, key.bounds.height, style.octaveLineColor);
                }
                else {
                    ui.rect(key.bounds.x, key.bounds.y, key.bounds.width, border, style.octaveLineColor);
                }
            }
            const shouldDrawLabel = widget.showLabels === 'white' || widget.showLabels === 'all' || (widget.showLabels === 'c' && key.noteName.startsWith('C'));
            if (!shouldDrawLabel)
                continue;
            const labelWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(key.noteName) : key.noteName.length * charW;
            const enoughAlong = widget.orientation === 'horizontal' ? key.bounds.width >= labelWidth + style.labelInset * 2 : key.bounds.height >= charH + style.labelInset * 2;
            const enoughCross = widget.orientation === 'horizontal' ? key.bounds.height >= charH + style.labelInset * 2 : key.bounds.width >= labelWidth + style.labelInset * 2;
            if (!enoughAlong || !enoughCross)
                continue;
            const textX = widget.orientation === 'horizontal'
                ? key.bounds.x + style.labelInset
                : key.bounds.x + Math.max(style.labelInset, key.bounds.width - labelWidth - style.labelInset);
            const textY = widget.orientation === 'horizontal'
                ? key.bounds.y + Math.max(style.labelInset, key.bounds.height - charH - style.labelInset)
                : key.bounds.y + style.labelInset;
            ui.text(key.noteName, textX, textY, style.labelColor);
        }
        for (const key of layout.blackKeys) {
            const isActive = activeMidi === key.midi;
            const isHovered = widget.state.hovered && key.midi === hoveredMidi;
            const fill = isActive ? style.blackKeyActiveColor : (isHovered ? style.blackKeyHoverColor : style.blackKeyColor);
            ui.rect(key.bounds.x, key.bounds.y, key.bounds.width, key.bounds.height, fill);
            ui.rect(key.bounds.x, key.bounds.y, key.bounds.width, border, style.blackKeyBorderColor);
            ui.rect(key.bounds.x, key.bounds.y + key.bounds.height - border, key.bounds.width, border, style.blackKeyBorderColor);
            ui.rect(key.bounds.x, key.bounds.y, border, key.bounds.height, style.blackKeyBorderColor);
            ui.rect(key.bounds.x + key.bounds.width - border, key.bounds.y, border, key.bounds.height, style.blackKeyBorderColor);
            if (widget.showLabels !== 'all')
                continue;
            const labelWidth = typeof ui.measureTextWidth === 'function' ? ui.measureTextWidth(key.noteName) : key.noteName.length * charW;
            const enoughAlong = widget.orientation === 'horizontal' ? key.bounds.width >= labelWidth + style.labelInset * 2 : key.bounds.height >= charH + style.labelInset * 2;
            const enoughCross = widget.orientation === 'horizontal' ? key.bounds.height >= charH + style.labelInset * 2 : key.bounds.width >= labelWidth + style.labelInset * 2;
            if (!enoughAlong || !enoughCross)
                continue;
            const textX = key.bounds.x + style.labelInset;
            const textY = key.bounds.y + style.labelInset;
            ui.text(key.noteName, textX, textY, style.blackLabelColor);
        }
        if (ui.popClipRect)
            ui.popClipRect();
        if (widget.state.focused) {
            ui.rect(widget.bounds.x, widget.bounds.y, widget.bounds.width, border, style.focusBorderColor);
            ui.rect(widget.bounds.x, widget.bounds.y + widget.bounds.height - border, widget.bounds.width, border, style.focusBorderColor);
            ui.rect(widget.bounds.x, widget.bounds.y, border, widget.bounds.height, style.focusBorderColor);
            ui.rect(widget.bounds.x + widget.bounds.width - border, widget.bounds.y, border, widget.bounds.height, style.focusBorderColor);
        }
    }
    /**
     * Set visibility for all widgets in a group
     */
    setGroupVisible(group, visible) {
        this.widgetManager.setGroupVisible(group, visible);
    }
    setGroupOpacity(group, opacity) {
        this.widgetManager.setGroupOpacity(group, opacity);
    }
    setGroupTransform(group, transform) {
        this.widgetManager.setGroupTransform(group, transform);
    }
    getGroupState(group) {
        return this.widgetManager.getGroupState(group);
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
    getWidgetManager() {
        return this.widgetManager;
    }
    resolveLabelStyle(widget) {
        return {
            fg: widget.labelStyle.fg ?? this.themeDefaults.label.fg,
            bg: widget.labelStyle.bg ?? this.themeDefaults.label.bg
        };
    }
    resolveButtonStyle(widget) {
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
    resolveCheckboxStyle(widget) {
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
    resolveSliderStyle(widget) {
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
    resolveTextFieldStyle(widget) {
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
    resolveTextEditorStyle(widget) {
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
export { GUIButton, GUILabel, GUICheckbox, GUISlider, GUIPianoKeyboard, GUITextField, GUITextEditor, GUIMarkdownView, GUILayoutContainer };
//# sourceMappingURL=index.js.map