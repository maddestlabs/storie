function cloneBounds(bounds) {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}
function finiteOr(value, fallback) {
    return Number.isFinite(value) ? Number(value) : fallback;
}
function positiveOr(value, fallback) {
    const next = finiteOr(value, fallback);
    return next > 0 ? next : fallback;
}
export function createDefaultGUITokens() {
    return {
        spacing: {
            xs: 4,
            sm: 8,
            md: 12,
            lg: 16,
            xl: 24
        },
        typography: {
            caption: { role: 'caption', lineHeight: 1, minHeight: 18, letterSpacing: 0 },
            body: { role: 'body', lineHeight: 1.15, minHeight: 22, letterSpacing: 0 },
            button: { role: 'button', lineHeight: 1.1, minHeight: 22, letterSpacing: 0 },
            title: { role: 'title', lineHeight: 1.25, minHeight: 28, letterSpacing: 0 },
            input: { role: 'input', lineHeight: 1.15, minHeight: 22, letterSpacing: 0 }
        },
        controls: {
            button: {
                minHeight: 44,
                paddingX: 12,
                paddingY: 8,
                borderWidth: 2,
                focusBorderWidth: 3
            },
            input: {
                minHeight: 44,
                paddingX: 8,
                paddingY: 6,
                borderWidth: 2,
                focusBorderWidth: 3
            },
            checkbox: {
                minHeight: 24,
                boxSize: 18,
                labelGap: 8,
                borderWidth: 1
            },
            slider: {
                minHeight: 36,
                labelGap: 4,
                trackHeight: 8,
                knobWidth: 16,
                knobHeight: 24,
                valueGap: 8
            }
        }
    };
}
export function cloneGUITokens(tokens) {
    return {
        spacing: { ...tokens.spacing },
        typography: {
            caption: { ...tokens.typography.caption },
            body: { ...tokens.typography.body },
            button: { ...tokens.typography.button },
            title: { ...tokens.typography.title },
            input: { ...tokens.typography.input }
        },
        controls: {
            button: { ...tokens.controls.button },
            input: { ...tokens.controls.input },
            checkbox: { ...tokens.controls.checkbox },
            slider: { ...tokens.controls.slider }
        }
    };
}
export function mergeGUITokens(base, patch) {
    const next = cloneGUITokens(base);
    if (!patch)
        return next;
    if (patch.spacing) {
        next.spacing.xs = positiveOr(patch.spacing.xs, next.spacing.xs);
        next.spacing.sm = positiveOr(patch.spacing.sm, next.spacing.sm);
        next.spacing.md = positiveOr(patch.spacing.md, next.spacing.md);
        next.spacing.lg = positiveOr(patch.spacing.lg, next.spacing.lg);
        next.spacing.xl = positiveOr(patch.spacing.xl, next.spacing.xl);
    }
    if (patch.typography) {
        Object.keys(next.typography).forEach((role) => {
            const src = patch.typography?.[role];
            if (!src)
                return;
            next.typography[role] = {
                role,
                lineHeight: positiveOr(src.lineHeight, next.typography[role].lineHeight),
                minHeight: positiveOr(src.minHeight, next.typography[role].minHeight),
                letterSpacing: finiteOr(src.letterSpacing, next.typography[role].letterSpacing)
            };
        });
    }
    if (patch.controls?.button) {
        const src = patch.controls.button;
        next.controls.button = {
            minHeight: positiveOr(src.minHeight, next.controls.button.minHeight),
            paddingX: positiveOr(src.paddingX, next.controls.button.paddingX),
            paddingY: positiveOr(src.paddingY, next.controls.button.paddingY),
            borderWidth: positiveOr(src.borderWidth, next.controls.button.borderWidth),
            focusBorderWidth: positiveOr(src.focusBorderWidth, next.controls.button.focusBorderWidth)
        };
    }
    if (patch.controls?.input) {
        const src = patch.controls.input;
        next.controls.input = {
            minHeight: positiveOr(src.minHeight, next.controls.input.minHeight),
            paddingX: positiveOr(src.paddingX, next.controls.input.paddingX),
            paddingY: positiveOr(src.paddingY, next.controls.input.paddingY),
            borderWidth: positiveOr(src.borderWidth, next.controls.input.borderWidth),
            focusBorderWidth: positiveOr(src.focusBorderWidth, next.controls.input.focusBorderWidth)
        };
    }
    if (patch.controls?.checkbox) {
        const src = patch.controls.checkbox;
        next.controls.checkbox = {
            minHeight: positiveOr(src.minHeight, next.controls.checkbox.minHeight),
            boxSize: positiveOr(src.boxSize, next.controls.checkbox.boxSize),
            labelGap: positiveOr(src.labelGap, next.controls.checkbox.labelGap),
            borderWidth: positiveOr(src.borderWidth, next.controls.checkbox.borderWidth)
        };
    }
    if (patch.controls?.slider) {
        const src = patch.controls.slider;
        next.controls.slider = {
            minHeight: positiveOr(src.minHeight, next.controls.slider.minHeight),
            labelGap: positiveOr(src.labelGap, next.controls.slider.labelGap),
            trackHeight: positiveOr(src.trackHeight, next.controls.slider.trackHeight),
            knobWidth: positiveOr(src.knobWidth, next.controls.slider.knobWidth),
            knobHeight: positiveOr(src.knobHeight, next.controls.slider.knobHeight),
            valueGap: positiveOr(src.valueGap, next.controls.slider.valueGap)
        };
    }
    return next;
}
function withMinHeight(bounds, minHeight) {
    const next = cloneBounds(bounds);
    next.height = Math.max(next.height, minHeight);
    return next;
}
function mergeStyle(style, patch) {
    return { ...(style || {}), ...patch };
}
export function applyButtonTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.controls.button.minHeight),
        buttonStyle: mergeStyle(config.buttonStyle, {
            paddingX: tokens.controls.button.paddingX,
            paddingY: tokens.controls.button.paddingY,
            borderWidth: tokens.controls.button.borderWidth,
            focusBorderWidth: tokens.controls.button.focusBorderWidth,
            typographyRole: 'button'
        })
    };
}
export function applyLabelTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.typography.body.minHeight),
        labelStyle: mergeStyle(config.labelStyle, {
            typographyRole: 'body'
        })
    };
}
export function applyTextFieldTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.controls.input.minHeight),
        textFieldStyle: mergeStyle(config.textFieldStyle, {
            paddingX: tokens.controls.input.paddingX,
            paddingY: tokens.controls.input.paddingY,
            borderWidth: tokens.controls.input.borderWidth,
            focusBorderWidth: tokens.controls.input.focusBorderWidth,
            typographyRole: 'input'
        })
    };
}
export function applyTextEditorTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.controls.input.minHeight),
        textEditorStyle: mergeStyle(config.textEditorStyle, {
            paddingX: tokens.controls.input.paddingX,
            paddingY: tokens.controls.input.paddingY,
            borderWidth: tokens.controls.input.borderWidth,
            focusBorderWidth: tokens.controls.input.focusBorderWidth,
            typographyRole: 'body'
        })
    };
}
export function applyCheckboxTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.controls.checkbox.minHeight),
        checkboxStyle: mergeStyle(config.checkboxStyle, {
            boxSize: tokens.controls.checkbox.boxSize,
            labelGap: tokens.controls.checkbox.labelGap,
            borderWidth: tokens.controls.checkbox.borderWidth,
            typographyRole: 'body'
        })
    };
}
export function applySliderTokens(config, tokens) {
    return {
        ...config,
        bounds: withMinHeight(config.bounds, tokens.controls.slider.minHeight),
        sliderStyle: mergeStyle(config.sliderStyle, {
            labelGap: tokens.controls.slider.labelGap,
            trackHeight: tokens.controls.slider.trackHeight,
            knobWidth: tokens.controls.slider.knobWidth,
            knobHeight: tokens.controls.slider.knobHeight,
            valueGap: tokens.controls.slider.valueGap,
            typographyRole: 'body'
        })
    };
}
export function applyContainerTokens(config, tokens) {
    return {
        ...config,
        padding: positiveOr(config.padding, tokens.spacing.md),
        gap: positiveOr(config.gap, tokens.spacing.sm)
    };
}
//# sourceMappingURL=tokens.js.map