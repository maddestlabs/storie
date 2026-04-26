/**
 * Base Widget Class
 * Core widget functionality shared by all UI implementations
 *
 * The `id` field in WidgetConfig is optional. If not provided, a unique ID
 * will be auto-generated using an internal counter. Users can reference
 * widgets directly via the returned object without needing explicit IDs.
 */
// Auto-increment counter for widget IDs
let nextAutoId = 1;
/**
 * Abstract base class for all widgets
 * Handles common state, input testing, and event emission
 */
export class BaseWidget {
    id;
    bounds;
    style;
    group;
    state;
    focusable;
    layout;
    renderScale;
    eventListeners;
    constructor(config) {
        // Auto-generate ID if not provided
        this.id = config.id ?? `widget_${nextAutoId++}`;
        this.bounds = { ...config.bounds };
        this.style = config.style || {};
        this.group = config.group || 0;
        this.focusable = config.focusable ?? true;
        this.layout = { ...(config.layout || {}) };
        this.renderScale = 1;
        this.state = {
            visible: config.visible ?? true,
            enabled: config.enabled ?? true,
            hovered: false,
            focused: false,
            pressed: false
        };
        this.eventListeners = new Map();
    }
    /**
     * Test if a point is within widget bounds
     */
    containsPoint(coord) {
        return (coord.x >= this.bounds.x &&
            coord.x < this.bounds.x + this.bounds.width &&
            coord.y >= this.bounds.y &&
            coord.y < this.bounds.y + this.bounds.height);
    }
    /**
     * Update widget state based on input
     * Returns true if state changed
     */
    updateState(hovered, pressed, focused) {
        let changed = false;
        if (this.state.hovered !== hovered) {
            this.state.hovered = hovered;
            changed = true;
            if (hovered) {
                this.emit({ type: 'hover', widget: this.id, timestamp: Date.now() });
            }
        }
        if (this.state.pressed !== pressed) {
            this.state.pressed = pressed;
            changed = true;
        }
        if (this.state.focused !== focused) {
            const wasFocused = this.state.focused;
            this.state.focused = focused;
            changed = true;
            if (focused && !wasFocused) {
                this.emit({ type: 'focus', widget: this.id, timestamp: Date.now() });
            }
            else if (!focused && wasFocused) {
                this.emit({ type: 'blur', widget: this.id, timestamp: Date.now() });
            }
        }
        return changed;
    }
    /**
     * Get effective style based on current state
     */
    getEffectiveStyle() {
        let effectiveStyle = { ...this.style };
        if (!this.state.enabled && this.style.disabledStyle) {
            effectiveStyle = { ...effectiveStyle, ...this.style.disabledStyle };
        }
        else if (this.state.pressed && this.style.focusStyle) {
            // Pressed takes precedence
            effectiveStyle = { ...effectiveStyle, ...this.style.focusStyle };
        }
        else if (this.state.focused && this.style.focusStyle) {
            effectiveStyle = { ...effectiveStyle, ...this.style.focusStyle };
        }
        else if (this.state.hovered && this.style.hoverStyle) {
            effectiveStyle = { ...effectiveStyle, ...this.style.hoverStyle };
        }
        return effectiveStyle;
    }
    /**
     * Register event listener
     */
    on(eventType, callback) {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType).push(callback);
    }
    /**
     * Emit event to listeners
     */
    emit(event) {
        const listeners = this.eventListeners.get(event.type);
        if (listeners) {
            listeners.forEach(callback => callback(event));
        }
    }
    /**
     * Set visibility
     */
    setVisible(visible) {
        this.state.visible = visible;
    }
    /**
     * Set enabled state
     */
    setEnabled(enabled) {
        this.state.enabled = enabled;
    }
    /**
     * Update bounds
     */
    setBounds(bounds) {
        this.bounds = { ...this.bounds, ...bounds };
    }
    setRenderScale(scale) {
        this.renderScale = Number.isFinite(scale) && scale > 0 ? Number(scale) : 1;
    }
    getRenderScale() {
        return this.renderScale;
    }
    resolveRenderContext(charWidth, charHeight) {
        const scale = this.getRenderScale();
        return {
            scale,
            charWidth: Math.max(1, charWidth * scale),
            charHeight: Math.max(1, charHeight * scale)
        };
    }
    getRenderPixels(value, min = 1) {
        return Math.max(min, value * this.getRenderScale());
    }
    getLayoutSize() {
        const preferred = this.getPreferredSize();
        const min = this.getMinSize(preferred);
        return {
            minWidth: min.width,
            minHeight: min.height,
            preferredWidth: Math.max(min.width, preferred.width),
            preferredHeight: Math.max(min.height, preferred.height),
            widthPolicy: this.getWidthPolicy(),
            heightPolicy: this.getHeightPolicy()
        };
    }
    getWidthPolicy() {
        return this.layout.widthPolicy ?? 'fixed';
    }
    getHeightPolicy() {
        return this.layout.heightPolicy ?? 'fixed';
    }
    getPreferredSize() {
        return {
            width: Number.isFinite(this.layout.preferredWidth) ? Number(this.layout.preferredWidth) : this.bounds.width,
            height: Number.isFinite(this.layout.preferredHeight) ? Number(this.layout.preferredHeight) : this.bounds.height
        };
    }
    getMinSize(preferred) {
        const base = preferred || this.getPreferredSize();
        return {
            width: Number.isFinite(this.layout.minWidth) ? Number(this.layout.minWidth) : Math.max(0, base.width),
            height: Number.isFinite(this.layout.minHeight) ? Number(this.layout.minHeight) : Math.max(0, base.height)
        };
    }
}
//# sourceMappingURL=base-widget.js.map