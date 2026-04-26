const DEFAULT_TEXT_INPUT_OPTIONS = {
    multiline: false,
    inputMode: 'text',
    enterKeyHint: 'done',
    autoCapitalize: 'none',
    autoCorrect: false,
    spellcheck: false,
    secure: false,
    showSoftKeyboard: true
};
export function createTextInputOptions(overrides, defaults) {
    const base = {
        ...DEFAULT_TEXT_INPUT_OPTIONS,
        ...(defaults ?? {})
    };
    return {
        ...base,
        ...(overrides ?? {}),
        multiline: overrides?.multiline ?? defaults?.multiline ?? base.multiline,
        autoCorrect: overrides?.autoCorrect ?? defaults?.autoCorrect ?? base.autoCorrect,
        spellcheck: overrides?.spellcheck ?? defaults?.spellcheck ?? base.spellcheck,
        secure: overrides?.secure ?? defaults?.secure ?? base.secure,
        showSoftKeyboard: overrides?.showSoftKeyboard ?? defaults?.showSoftKeyboard ?? base.showSoftKeyboard
    };
}
export function normalizeTextSelectionRange(length, start, end, direction = 'none') {
    const size = Math.max(0, Number(length) | 0);
    const rawStart = Number.isFinite(start) ? Math.max(0, Math.min(size, start | 0)) : 0;
    const rawEnd = Number.isFinite(end) ? Math.max(0, Math.min(size, end | 0)) : rawStart;
    return {
        start: Math.min(rawStart, rawEnd),
        end: Math.max(rawStart, rawEnd),
        direction
    };
}
export function normalizeSingleLineText(value) {
    return String(value ?? '').replace(/\r\n/g, ' ').replace(/[\r\n]+/g, ' ');
}
export function getHiddenTextInputBridgeAttributes(options) {
    if (!options.showSoftKeyboard) {
        return {
            readOnly: true,
            inputMode: 'none',
            virtualKeyboardPolicy: 'manual'
        };
    }
    return {
        readOnly: false,
        inputMode: options.inputMode,
        virtualKeyboardPolicy: 'auto'
    };
}
export function isTextInputCapable(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return typeof candidate.getValue === 'function'
        && typeof candidate.setValue === 'function'
        && typeof candidate.getSelectionRange === 'function'
        && typeof candidate.setSelectionRange === 'function'
        && typeof candidate.replaceTextRange === 'function'
        && typeof candidate.getTextInputOptions === 'function';
}
//# sourceMappingURL=text-input.js.map