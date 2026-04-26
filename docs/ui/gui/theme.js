import { ColorUtils } from '../../types.js';
const TRANSPARENT = ColorUtils.rgba(0, 0, 0, 0);
const FALLBACKS = {
    label: {
        fg: ColorUtils.rgb(224, 224, 224),
        bg: TRANSPARENT
    },
    button: {
        fg: ColorUtils.rgb(240, 240, 240),
        bg: ColorUtils.rgb(60, 60, 60),
        border: ColorUtils.rgb(100, 100, 100),
        hoverBg: ColorUtils.rgb(80, 80, 80),
        activeBg: ColorUtils.rgb(40, 120, 180),
        focusBorder: ColorUtils.rgb(120, 170, 220)
    },
    checkbox: {
        fg: ColorUtils.rgb(220, 220, 220),
        bg: ColorUtils.rgb(40, 40, 40),
        border: ColorUtils.rgb(220, 220, 220),
        check: ColorUtils.rgb(0, 200, 100),
        hoverBg: ColorUtils.rgb(60, 60, 60),
        focusBorder: ColorUtils.rgb(120, 170, 220)
    },
    slider: {
        fg: ColorUtils.rgb(220, 220, 220),
        track: ColorUtils.rgb(60, 60, 60),
        knob: ColorUtils.rgb(100, 150, 200),
        knobHover: ColorUtils.rgb(120, 170, 220),
        knobActive: ColorUtils.rgb(255, 200, 0)
    },
    input: {
        fg: ColorUtils.rgb(240, 240, 240),
        bg: ColorUtils.rgba(30, 30, 30, 242),
        border: ColorUtils.rgb(90, 90, 90),
        hoverBorder: ColorUtils.rgb(130, 130, 130),
        focusBorder: ColorUtils.rgb(120, 170, 220),
        cursor: ColorUtils.rgb(120, 170, 220)
    }
};
const MARKDOWN_FALLBACKS = {
    fg: ColorUtils.rgb(230, 230, 230),
    mutedFg: ColorUtils.rgb(160, 160, 160),
    borderFg: ColorUtils.rgb(110, 110, 110),
    surfaceBg: ColorUtils.rgba(24, 24, 24, 235),
    headingFg: ColorUtils.rgb(255, 255, 255),
    linkFg: ColorUtils.rgb(80, 180, 255),
    infoFg: ColorUtils.rgb(80, 180, 255),
    successFg: ColorUtils.rgb(64, 210, 140),
    warningFg: ColorUtils.rgb(255, 205, 96),
    errorFg: ColorUtils.rgb(255, 110, 120),
    codeFg: ColorUtils.rgb(240, 240, 240),
    codeBg: ColorUtils.rgba(35, 35, 35, 230),
    bg: TRANSPARENT
};
function styleOrFallback(style, fallback) {
    return (style ?? fallback ?? {});
}
function pickFg(style, fallback) {
    return style?.fg ?? fallback;
}
function pickBg(style, fallback) {
    return style?.bg ?? fallback;
}
export function createGUIThemeDefaultsFromStyles(getStyle) {
    const base = styleOrFallback(getStyle('default'), FALLBACKS.label);
    const surface = styleOrFallback(getStyle('surface'), base);
    const button = styleOrFallback(getStyle('button'), surface);
    const border = styleOrFallback(getStyle('border'), button);
    const hover = styleOrFallback(getStyle('hover'), button);
    const focus = styleOrFallback(getStyle('focus'), hover);
    const active = styleOrFallback(getStyle('active'), hover);
    const info = styleOrFallback(getStyle('info'), getStyle('accent2'));
    const success = styleOrFallback(getStyle('success'), getStyle('accent1'));
    const error = styleOrFallback(getStyle('error'), getStyle('warning'));
    return {
        label: {
            fg: pickFg(base, FALLBACKS.label.fg),
            bg: TRANSPARENT
        },
        button: {
            fg: pickFg(button, FALLBACKS.button.fg),
            bg: pickBg(button, FALLBACKS.button.bg),
            border: pickFg(border, FALLBACKS.button.border),
            hoverBg: pickBg(hover, pickBg(button, FALLBACKS.button.hoverBg)),
            activeBg: pickBg(active, pickBg(hover, FALLBACKS.button.activeBg)),
            focusBorder: pickFg(focus, pickFg(border, FALLBACKS.button.focusBorder))
        },
        checkbox: {
            fg: pickFg(base, FALLBACKS.checkbox.fg),
            bg: pickBg(surface, FALLBACKS.checkbox.bg),
            border: pickFg(border, FALLBACKS.checkbox.border),
            check: pickFg(success, FALLBACKS.checkbox.check),
            hoverBg: pickBg(hover, FALLBACKS.checkbox.hoverBg),
            focusBorder: pickFg(focus, FALLBACKS.checkbox.focusBorder)
        },
        slider: {
            fg: pickFg(base, FALLBACKS.slider.fg),
            track: pickBg(surface, FALLBACKS.slider.track),
            knob: pickFg(info, FALLBACKS.slider.knob),
            knobHover: pickFg(focus, FALLBACKS.slider.knobHover),
            knobActive: pickFg(active, pickFg(error, FALLBACKS.slider.knobActive))
        },
        input: {
            fg: pickFg(base, FALLBACKS.input.fg),
            bg: pickBg(surface, FALLBACKS.input.bg),
            border: pickFg(border, FALLBACKS.input.border),
            hoverBorder: pickFg(hover, FALLBACKS.input.hoverBorder),
            focusBorder: pickFg(focus, FALLBACKS.input.focusBorder),
            cursor: pickFg(info, FALLBACKS.input.cursor)
        }
    };
}
export function createGUIMarkdownThemeDefaultsFromStyles(getStyle) {
    const base = styleOrFallback(getStyle('default'), MARKDOWN_FALLBACKS);
    const dim = styleOrFallback(getStyle('dim'), base);
    const border = styleOrFallback(getStyle('border'), dim);
    const surface = styleOrFallback(getStyle('surface'), getStyle('code'));
    const heading = styleOrFallback(getStyle('heading'), base);
    const link = styleOrFallback(getStyle('link'), getStyle('active'));
    const active = styleOrFallback(getStyle('active'), link);
    const info = styleOrFallback(getStyle('info'), getStyle('accent2'));
    const success = styleOrFallback(getStyle('success'), getStyle('accent1'));
    const warning = styleOrFallback(getStyle('warning'), getStyle('accent3'));
    const error = styleOrFallback(getStyle('error'), warning);
    const code = styleOrFallback(getStyle('code'), surface);
    return {
        fg: pickFg(base, MARKDOWN_FALLBACKS.fg),
        mutedFg: pickFg(dim, MARKDOWN_FALLBACKS.mutedFg),
        borderFg: pickFg(border, MARKDOWN_FALLBACKS.borderFg),
        surfaceBg: pickBg(surface, MARKDOWN_FALLBACKS.surfaceBg),
        headingFg: pickFg(heading, MARKDOWN_FALLBACKS.headingFg),
        linkFg: pickFg(link, MARKDOWN_FALLBACKS.linkFg),
        activeLinkFg: pickFg(active, pickFg(link, MARKDOWN_FALLBACKS.linkFg)),
        infoFg: pickFg(info, MARKDOWN_FALLBACKS.infoFg),
        successFg: pickFg(success, MARKDOWN_FALLBACKS.successFg),
        warningFg: pickFg(warning, MARKDOWN_FALLBACKS.warningFg),
        errorFg: pickFg(error, MARKDOWN_FALLBACKS.errorFg),
        codeFg: pickFg(code, MARKDOWN_FALLBACKS.codeFg),
        codeBg: pickBg(code, MARKDOWN_FALLBACKS.codeBg),
        bg: TRANSPARENT
    };
}
export function createDefaultGUIThemeDefaults() {
    return {
        label: { ...FALLBACKS.label },
        button: { ...FALLBACKS.button },
        checkbox: { ...FALLBACKS.checkbox },
        slider: { ...FALLBACKS.slider },
        input: { ...FALLBACKS.input }
    };
}
export function createDefaultGUIMarkdownThemeDefaults() {
    return { ...MARKDOWN_FALLBACKS };
}
//# sourceMappingURL=theme.js.map