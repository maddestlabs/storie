import type {
  TextInputCapable,
  TextInputOptions,
  TextSelectionDirection,
  TextSelectionRange
} from './types.js';

const DEFAULT_TEXT_INPUT_OPTIONS: TextInputOptions = {
  multiline: false,
  inputMode: 'text',
  enterKeyHint: 'done',
  autoCapitalize: 'none',
  autoCorrect: false,
  spellcheck: false,
  secure: false,
  showSoftKeyboard: true
};

export function createTextInputOptions(
  overrides?: Partial<TextInputOptions> | null,
  defaults?: Partial<TextInputOptions> | null
): TextInputOptions {
  const base: TextInputOptions = {
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

export function normalizeTextSelectionRange(
  length: number,
  start: number,
  end?: number,
  direction: TextSelectionDirection = 'none'
): TextSelectionRange {
  const size = Math.max(0, Number(length) | 0);
  const rawStart = Number.isFinite(start) ? Math.max(0, Math.min(size, start | 0)) : 0;
  const rawEnd = Number.isFinite(end as number) ? Math.max(0, Math.min(size, (end as number) | 0)) : rawStart;
  return {
    start: Math.min(rawStart, rawEnd),
    end: Math.max(rawStart, rawEnd),
    direction
  };
}

export function normalizeSingleLineText(value: string): string {
  return String(value ?? '').replace(/\r\n/g, ' ').replace(/[\r\n]+/g, ' ');
}

export function isTextInputCapable(value: unknown): value is TextInputCapable {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as TextInputCapable;
  return typeof candidate.getValue === 'function'
    && typeof candidate.setValue === 'function'
    && typeof candidate.getSelectionRange === 'function'
    && typeof candidate.setSelectionRange === 'function'
    && typeof candidate.replaceTextRange === 'function'
    && typeof candidate.getTextInputOptions === 'function';
}