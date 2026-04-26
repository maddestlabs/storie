import { BaseWidget } from '../core/base-widget.js';
import { createDefaultGUITokens } from './tokens.js';
const defaultTokens = createDefaultGUITokens();
/**
 * Static text label with graphical rendering
 */
export class GUILabel extends BaseWidget {
    text;
    align;
    labelStyle;
    constructor(config) {
        super(config);
        this.text = String(config.text ?? '');
        this.align = config.align ?? 'left';
        this.labelStyle = {
            fg: config.labelStyle?.fg,
            bg: config.labelStyle?.bg,
            typographyRole: config.labelStyle?.typographyRole ?? defaultTokens.typography.body.role
        };
    }
    setText(text) {
        this.text = String(text ?? '');
    }
    /**
     * Render method (rendering is handled by GUISystem)
     */
    render() {
        // No-op: GUI widgets are rendered by GUISystem.render()
    }
    getPreferredSize() {
        const type = defaultTokens.typography[this.labelStyle.typographyRole];
        return {
            width: Math.max(this.bounds.width, this.text.length * 10),
            height: Math.max(this.bounds.height, type.minHeight)
        };
    }
}
//# sourceMappingURL=label.js.map