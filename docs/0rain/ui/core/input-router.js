/**
 * Input Router
 * Routes input events to appropriate widgets
 */
/**
 * Handles mouse and keyboard input routing to widgets
 */
export class InputRouter {
    widgetManager;
    currentHoverWidget = null;
    currentPressedWidget = null;
    mousePressed = false;
    // De-dupe for environments that emit both keydown (printable) and text events.
    lastPrintableKeydownText = null;
    constructor(config) {
        this.widgetManager = config.widgetManager;
    }
    isPointWithinWidget(widget, point) {
        const group = this.widgetManager.getGroupState(widget.group);
        const scale = Number.isFinite(group.transform.scale) && group.transform.scale > 0
            ? group.transform.scale
            : 1;
        const x = group.transform.x + widget.bounds.x * scale;
        const y = group.transform.y + widget.bounds.y * scale;
        const width = widget.bounds.width * scale;
        const height = widget.bounds.height * scale;
        return (point.x >= x &&
            point.x < x + width &&
            point.y >= y &&
            point.y < y + height);
    }
    /**
     * Update input routing
     * Should be called every frame before rendering
     */
    update(mousePos, mouseDown) {
        // Get visible widgets in reverse order (top to bottom)
        const visibleWidgets = this.widgetManager.getVisible().reverse();
        // Find hovered widget
        let hoveredWidget = null;
        for (const widget of visibleWidgets) {
            if (widget.state.enabled && this.isPointWithinWidget(widget, mousePos)) {
                hoveredWidget = widget;
                break;
            }
        }
        // Update hover states
        if (hoveredWidget !== this.currentHoverWidget) {
            if (this.currentHoverWidget) {
                this.currentHoverWidget.updateState(false, this.currentHoverWidget.state.pressed, this.currentHoverWidget.state.focused);
            }
            if (hoveredWidget) {
                hoveredWidget.updateState(true, hoveredWidget.state.pressed, hoveredWidget.state.focused);
            }
            this.currentHoverWidget = hoveredWidget;
        }
        // Handle mouse press/release
        const mouseJustPressed = mouseDown && !this.mousePressed;
        const mouseJustReleased = !mouseDown && this.mousePressed;
        if (mouseJustPressed && hoveredWidget) {
            // Press started on widget
            this.currentPressedWidget = hoveredWidget;
            hoveredWidget.updateState(hoveredWidget.state.hovered, true, hoveredWidget.state.focused);
            // Focus on click
            if (hoveredWidget.focusable) {
                this.widgetManager.focus(hoveredWidget.id);
            }
            // Match tStorie semantics: treat a press on a widget as a click.
            // This makes buttons/checkboxes respond immediately and avoids relying on
            // observing the release in a later update.
            hoveredWidget.emit({
                type: 'click',
                widget: hoveredWidget.id,
                timestamp: Date.now(),
                data: { x: mousePos.x, y: mousePos.y }
            });
        }
        if (mouseJustReleased && this.currentPressedWidget) {
            // Press ended
            const wasHovered = this.currentPressedWidget.state.hovered;
            this.currentPressedWidget.updateState(wasHovered, false, this.currentPressedWidget.state.focused);
            this.currentPressedWidget = null;
        }
        this.mousePressed = mouseDown;
    }
    /**
     * Handle keyboard input for focused widget
     */
    handleKey(key, modifiers) {
        // Handle Tab navigation
        if (key === 'Tab') {
            if (modifiers?.shift) {
                this.widgetManager.focusPrevious();
            }
            else {
                this.widgetManager.focusNext();
            }
            return true; // Consumed
        }
        // Give focused widget first chance to consume keys
        const focused = this.widgetManager.getFocused();
        if (focused) {
            const maybeHandleKey = focused.handleKey;
            if (typeof maybeHandleKey === 'function') {
                const consumed = maybeHandleKey.call(focused, key, modifiers);
                if (consumed) {
                    const ctrl = !!modifiers?.ctrl;
                    const alt = !!modifiers?.alt;
                    if (!ctrl && !alt && key.length === 1) {
                        this.lastPrintableKeydownText = { text: key, at: Date.now() };
                    }
                }
                if (consumed)
                    return true;
            }
        }
        // Handle arrow key navigation
        if (key === 'ArrowDown' || key === 'ArrowRight') {
            this.widgetManager.focusNext();
            return true;
        }
        if (key === 'ArrowUp' || key === 'ArrowLeft') {
            this.widgetManager.focusPrevious();
            return true;
        }
        return false; // Not consumed
    }
    /**
     * Handle text input for focused widget
     */
    handleText(text) {
        // If we just inserted the same printable char via keydown, ignore the text event.
        if (this.lastPrintableKeydownText && text === this.lastPrintableKeydownText.text) {
            const dt = Date.now() - this.lastPrintableKeydownText.at;
            if (dt >= 0 && dt < 50) {
                return true;
            }
        }
        const focused = this.widgetManager.getFocused();
        if (!focused)
            return false;
        const maybeHandleText = focused.handleText;
        if (typeof maybeHandleText === 'function') {
            return !!maybeHandleText.call(focused, text);
        }
        return false;
    }
    /**
     * Handle activation (Enter/Space on focused widget)
     */
    handleActivate() {
        const focused = this.widgetManager.getFocused();
        if (focused && focused.state.enabled) {
            // Emit click event on focused widget
            focused.emit({
                type: 'click',
                widget: focused.id,
                timestamp: Date.now()
            });
            return true;
        }
        return false;
    }
    /**
     * Get widget currently under mouse
     */
    getHoveredWidget() {
        return this.currentHoverWidget;
    }
    /**
     * Get widget currently being pressed
     */
    getPressedWidget() {
        return this.currentPressedWidget;
    }
}
//# sourceMappingURL=input-router.js.map