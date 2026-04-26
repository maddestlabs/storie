/**
 * TUI Slider Widget
 * Terminal-based slider with draggable handle
 */
import { BaseWidget } from '../core/base-widget.js';
import { getTUIThemeDefaults } from './theme.js';
/**
 * Slider widget with draggable value control
 */
export class TUISlider extends BaseWidget {
    label;
    min;
    max;
    step;
    value;
    dragging = false;
    lastValue;
    constructor(config) {
        super(config);
        this.label = config.label;
        this.min = config.min;
        this.max = config.max;
        this.step = config.step ?? 1;
        this.value = config.value ?? this.min;
        this.lastValue = this.value;
        // Clamp initial value
        this.value = Math.max(this.min, Math.min(this.max, this.value));
    }
    /**
     * Update slider state with mouse position
     * Should be called during input update
     */
    updateDrag(mousePos, mouseDown) {
        if (!this.state.visible || !this.state.enabled)
            return;
        // Start dragging on press
        if (mouseDown && this.containsPoint(mousePos) && !this.dragging) {
            this.dragging = true;
        }
        // Stop dragging on release
        if (!mouseDown) {
            this.dragging = false;
        }
        // Update value while dragging
        if (this.dragging) {
            const trackWidth = this.bounds.width - 2; // Account for brackets
            const relX = mousePos.x - (this.bounds.x + 1); // Relative to track start
            if (relX >= 0 && relX <= trackWidth) {
                const normalizedPos = relX / trackWidth;
                const range = this.max - this.min;
                const newValue = this.min + normalizedPos * range;
                // Apply step and clamp
                this.value = Math.round(newValue / this.step) * this.step;
                this.value = Math.max(this.min, Math.min(this.max, this.value));
                // Emit change event if value changed
                if (this.value !== this.lastValue) {
                    this.lastValue = this.value;
                    this.emit({
                        type: 'change',
                        widget: this.id,
                        timestamp: Date.now(),
                        data: { value: this.value }
                    });
                }
            }
        }
    }
    /**
     * Get current slider value
     */
    getValue() {
        return this.value;
    }
    /**
     * Set slider value programmatically
     */
    setValue(value) {
        this.value = Math.max(this.min, Math.min(this.max, value));
        this.lastValue = this.value;
    }
    /**
     * Render slider to cell buffer
     */
    render(buffer, renderer) {
        if (!this.state.visible)
            return;
        const { x, y, width } = this.bounds;
        const style = this.getEffectiveStyle();
        const defaults = getTUIThemeDefaults();
        // Get colors
        const fg = style.fg ?? defaults.slider.fg;
        const bg = style.bg ?? defaults.slider.bg;
        const accentColor = style.accentColor ?? defaults.slider.accent;
        // Draw label (first row)
        for (let i = 0; i < this.label.length && i < width; i++) {
            renderer.setCell(buffer, x + i, y, this.label[i], fg, bg);
        }
        // Draw track (second row)
        const trackY = y + 1;
        const trackWidth = width - 2;
        // Choose bracket style based on focus
        const leftBracket = this.state.focused ? '《' : '[';
        const rightBracket = this.state.focused ? '》' : ']';
        const trackChar = this.state.focused ? '═' : '─';
        // Draw brackets
        renderer.setCell(buffer, x, trackY, leftBracket, fg, bg);
        renderer.setCell(buffer, x + width - 1, trackY, rightBracket, fg, bg);
        // Draw track
        for (let i = 0; i < trackWidth; i++) {
            renderer.setCell(buffer, x + 1 + i, trackY, trackChar, fg, bg);
        }
        // Draw handle
        const range = this.max - this.min;
        const normalizedPos = range > 0 ? (this.value - this.min) / range : 0;
        const handleX = x + 1 + Math.floor(normalizedPos * trackWidth);
        const handleColor = this.dragging ? defaults.slider.dragAccent : accentColor;
        renderer.setCell(buffer, handleX, trackY, '█', handleColor, bg);
        // Draw value (third row)
        const valueStr = this.value.toFixed(0);
        for (let i = 0; i < valueStr.length && i < width; i++) {
            renderer.setCell(buffer, x + i, y + 2, valueStr[i], fg, bg);
        }
    }
}
//# sourceMappingURL=slider.js.map