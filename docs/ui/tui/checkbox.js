/**
 * TUI Checkbox Widget
 * Terminal-based checkbox with label
 */
import { BaseWidget } from '../core/base-widget.js';
import { getTUIThemeDefaults } from './theme.js';
/**
 * Checkbox widget with toggleable state
 */
export class TUICheckbox extends BaseWidget {
    label;
    checked;
    toggledThisFrame = false;
    constructor(config) {
        super(config);
        this.label = String(config.label ?? '');
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
    wasToggled() {
        const result = this.toggledThisFrame;
        this.toggledThisFrame = false;
        return result;
    }
    /**
     * Get checked state
     */
    isChecked() {
        return this.checked;
    }
    /**
     * Set checked state programmatically
     */
    setChecked(checked) {
        this.checked = checked;
    }
    /**
     * Update label text
     */
    setLabel(label) {
        this.label = String(label ?? '');
    }
    /**
     * Render checkbox to cell buffer
     */
    render(buffer, renderer) {
        if (!this.state.visible)
            return;
        const { x, y } = this.bounds;
        const style = this.getEffectiveStyle();
        const defaults = getTUIThemeDefaults();
        // Get colors
        const fg = style.fg ?? defaults.checkbox.fg;
        const bg = style.bg ?? defaults.checkbox.bg;
        // Choose checkbox symbol based on focus
        let symbol;
        if (this.state.focused) {
            symbol = this.checked ? '《X》' : '《 》';
        }
        else {
            symbol = this.checked ? '[X]' : '[ ]';
        }
        // Draw checkbox symbol
        for (let i = 0; i < symbol.length; i++) {
            renderer.setCell(buffer, x + i, y, symbol[i], fg, bg);
        }
        const label = String(this.label ?? '');
        // Draw label
        const labelStart = x + symbol.length + 1;
        for (let i = 0; i < label.length; i++) {
            renderer.setCell(buffer, labelStart + i, y, label[i], fg, bg);
        }
    }
}
//# sourceMappingURL=checkbox.js.map