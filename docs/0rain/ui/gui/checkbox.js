import { BaseWidget } from '../core/base-widget.js';
import { createDefaultGUITokens } from './tokens.js';
const defaultTokens = createDefaultGUITokens();
/**
 * Checkbox widget with label and graphical rendering
 */
export class GUICheckbox extends BaseWidget {
    label;
    checked;
    wasToggledThisFrame = false;
    checkboxStyle;
    constructor(config) {
        super(config);
        this.label = String(config.label ?? '');
        this.checked = config.checked ?? false;
        this.checkboxStyle = {
            fg: config.checkboxStyle?.fg,
            bg: config.checkboxStyle?.bg,
            checkColor: config.checkboxStyle?.checkColor,
            hoverBg: config.checkboxStyle?.hoverBg,
            boxSize: config.checkboxStyle?.boxSize ?? defaultTokens.controls.checkbox.boxSize,
            labelGap: config.checkboxStyle?.labelGap ?? defaultTokens.controls.checkbox.labelGap,
            borderWidth: config.checkboxStyle?.borderWidth ?? defaultTokens.controls.checkbox.borderWidth,
            typographyRole: config.checkboxStyle?.typographyRole ?? 'body'
        };
        // Listen for click events
        this.on('click', () => {
            this.checked = !this.checked;
            this.wasToggledThisFrame = true;
        });
    }
    wasToggled() {
        const result = this.wasToggledThisFrame;
        this.wasToggledThisFrame = false;
        return result;
    }
    isChecked() {
        return this.checked;
    }
    setChecked(checked) {
        this.checked = checked;
    }
    /**
     * Render method (rendering is handled by GUISystem)
     */
    render() {
        // No-op: GUI widgets are rendered by GUISystem.render()
    }
    getPreferredSize() {
        const labelWidth = this.label.length * 10;
        const contentWidth = this.checkboxStyle.boxSize + this.checkboxStyle.labelGap + labelWidth;
        return {
            width: Math.max(this.bounds.width, contentWidth),
            height: Math.max(this.bounds.height, this.checkboxStyle.boxSize, defaultTokens.controls.checkbox.minHeight)
        };
    }
}
//# sourceMappingURL=checkbox.js.map