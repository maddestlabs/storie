import { ColorUtils } from '../../types.js';
const FALLBACKS = {
    label: {
        fg: ColorUtils.rgb(200, 200, 200),
        bg: ColorUtils.rgb(0, 0, 0)
    },
    checkbox: {
        fg: ColorUtils.rgb(200, 200, 200),
        bg: ColorUtils.rgb(0, 0, 0)
    },
    button: {
        fg: ColorUtils.rgb(224, 224, 224),
        bg: ColorUtils.rgb(0, 17, 17),
        borderFg: ColorUtils.rgb(224, 224, 224)
    },
    slider: {
        fg: ColorUtils.rgb(150, 150, 150),
        bg: ColorUtils.rgb(0, 0, 0),
        accent: ColorUtils.rgb(100, 200, 255),
        dragAccent: ColorUtils.rgb(255, 200, 0)
    },
    textfield: {
        fg: ColorUtils.rgb(224, 224, 224),
        bg: ColorUtils.rgb(0, 0, 0),
        borderFg: ColorUtils.rgb(200, 200, 200),
        cursor: ColorUtils.rgb(100, 200, 255)
    }
};
let defaults = { ...FALLBACKS };
export function getTUIThemeDefaults() {
    return defaults;
}
export function setTUIThemeDefaults(next) {
    defaults = {
        label: { ...defaults.label, ...next.label },
        checkbox: { ...defaults.checkbox, ...next.checkbox },
        button: { ...defaults.button, ...next.button },
        slider: { ...defaults.slider, ...next.slider },
        textfield: { ...defaults.textfield, ...next.textfield }
    };
}
export function setTUIThemeFromStyles(getStyle) {
    const base = getStyle('default') ?? {};
    const surface = getStyle('surface') ?? {};
    const button = getStyle('button') ?? surface;
    const dim = getStyle('dim') ?? base;
    const accent = getStyle('accent2') ?? getStyle('accent1') ?? base;
    const warning = getStyle('warning') ?? accent;
    const border = getStyle('border') ?? base;
    setTUIThemeDefaults({
        label: {
            fg: base.fg ?? FALLBACKS.label.fg,
            bg: base.bg ?? FALLBACKS.label.bg
        },
        checkbox: {
            fg: base.fg ?? FALLBACKS.checkbox.fg,
            bg: base.bg ?? FALLBACKS.checkbox.bg
        },
        button: {
            fg: button.fg ?? FALLBACKS.button.fg,
            bg: button.bg ?? FALLBACKS.button.bg,
            borderFg: border.fg ?? (button.fg ?? FALLBACKS.button.borderFg)
        },
        slider: {
            fg: dim.fg ?? FALLBACKS.slider.fg,
            bg: base.bg ?? FALLBACKS.slider.bg,
            accent: accent.fg ?? FALLBACKS.slider.accent,
            dragAccent: warning.fg ?? FALLBACKS.slider.dragAccent
        },
        textfield: {
            fg: base.fg ?? FALLBACKS.textfield.fg,
            bg: surface.bg ?? base.bg ?? FALLBACKS.textfield.bg,
            borderFg: border.fg ?? (base.fg ?? FALLBACKS.textfield.borderFg),
            cursor: accent.fg ?? FALLBACKS.textfield.cursor
        }
    });
}
//# sourceMappingURL=theme.js.map