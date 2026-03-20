import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import {
  createTextInputOptions,
  normalizeSingleLineText,
  normalizeTextSelectionRange
} from '../core/text-input.js';
import type {
  TextInputOptions,
  TextSelectionDirection
} from '../core/types.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export type GUITextAlign = 'left' | 'center' | 'right';

export interface GUITextFieldConfig extends WidgetConfig {
  value?: string;
  placeholder?: string;
  align?: GUITextAlign;
  textInput?: Partial<TextInputOptions>;
  textFieldStyle?: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    focusBorderColor?: Color;
    drawBackground?: boolean;
    drawBorder?: boolean;
    paddingX?: number;
    paddingY?: number;
    borderWidth?: number;
    focusBorderWidth?: number;
    typographyRole?: GUITypographyRole;
  };
}

type KeyModifiers = { shift?: boolean; ctrl?: boolean; alt?: boolean };

/**
 * Single-line text input for the retained GUI system.
 * Rendering is performed by GUISystem.
 */
export class GUITextField extends BaseWidget {
  public placeholder: string;
  public align: GUITextAlign;
  public textInput: TextInputOptions;
  public textFieldStyle: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    focusBorderColor?: Color;
    drawBackground: boolean;
    drawBorder: boolean;
    paddingX: number;
    paddingY: number;
    borderWidth: number;
    focusBorderWidth: number;
    typographyRole: GUITypographyRole;
  };

  private value: string;
  private cursorPos: number;
  private selectionStart: number;
  private selectionEnd: number;
  private selectionDirection: TextSelectionDirection = 'none';
  private scrollOffset: number;
  private changedThisFrame: boolean = false;
  private charWidth: number = 10;

  constructor(config: GUITextFieldConfig) {
    super(config);

    this.value = normalizeSingleLineText(config.value ?? '');
    this.cursorPos = this.value.length;
    this.selectionStart = this.cursorPos;
    this.selectionEnd = this.cursorPos;
    this.scrollOffset = 0;
    this.placeholder = config.placeholder ?? '';
    this.align = config.align ?? 'left';
    this.textInput = createTextInputOptions(config.textInput, {
      multiline: false,
      enterKeyHint: 'done'
    });

    this.textFieldStyle = {
      fg: config.textFieldStyle?.fg,
      bg: config.textFieldStyle?.bg,
      borderColor: config.textFieldStyle?.borderColor,
      focusBorderColor: config.textFieldStyle?.focusBorderColor,
      drawBackground: config.textFieldStyle?.drawBackground ?? true,
      drawBorder: config.textFieldStyle?.drawBorder ?? true,
      paddingX: config.textFieldStyle?.paddingX ?? defaultTokens.controls.input.paddingX,
      paddingY: config.textFieldStyle?.paddingY ?? defaultTokens.controls.input.paddingY,
      borderWidth: config.textFieldStyle?.borderWidth ?? defaultTokens.controls.input.borderWidth,
      focusBorderWidth: config.textFieldStyle?.focusBorderWidth ?? defaultTokens.controls.input.focusBorderWidth,
      typographyRole: config.textFieldStyle?.typographyRole ?? 'input'
    };

    this.on('click', (ev) => {
      const clickX = typeof ev.data?.x === 'number' ? (ev.data.x as number) : null;
      if (clickX === null) return;

      const padX = this.textFieldStyle.paddingX;
      const innerX = this.bounds.x + padX;
      const innerW = Math.max(0, this.bounds.width - padX * 2);
      if (innerW <= 0) return;

      const maxChars = Math.max(0, Math.floor(innerW / Math.max(1, this.charWidth)));
      const visibleLength = Math.min(maxChars, Math.max(0, this.value.length - this.scrollOffset));
      const textStartX = innerX + this.getAlignedColumnOffset(maxChars, visibleLength) * this.charWidth;
      const relPx = Math.max(0, Math.min(innerW, clickX - textStartX));
      const relChars = Math.floor(relPx / Math.max(1, this.charWidth));
      const target = this.scrollOffset + relChars;
      this.setSelectionRange(target, target);
    });
  }

  updateMetrics(charWidth: number, charHeight: number): void {
    if (Number.isFinite(charWidth) && charWidth > 0) this.charWidth = charWidth;
    // charHeight currently unused; retained for future multi-line / baseline alignment.
    void charHeight;
  }

  getValue(): string {
    return this.value;
  }

  setValue(next: string): void {
    this.value = normalizeSingleLineText(next ?? '');
    this.cursorPos = Math.max(0, Math.min(this.cursorPos, this.value.length));
    this.selectionStart = this.cursorPos;
    this.selectionEnd = this.cursorPos;
    this.selectionDirection = 'none';
    this.scrollOffset = 0;
  }

  getSelectionRange() {
    return {
      start: this.selectionStart,
      end: this.selectionEnd,
      direction: this.selectionDirection
    };
  }

  setSelectionRange(start: number, end: number = start, direction: TextSelectionDirection = 'none'): boolean {
    const next = normalizeTextSelectionRange(this.value.length, start, end, direction);
    const changed = next.start !== this.selectionStart
      || next.end !== this.selectionEnd
      || next.direction !== this.selectionDirection;
    this.selectionStart = next.start;
    this.selectionEnd = next.end;
    this.selectionDirection = next.direction ?? 'none';
    this.cursorPos = this.selectionEnd;
    return changed;
  }

  replaceTextRange(start: number, end: number, text: string): boolean {
    const range = normalizeTextSelectionRange(this.value.length, start, end);
    const insert = normalizeSingleLineText(text ?? '');
    const nextValue = this.value.slice(0, range.start) + insert + this.value.slice(range.end);
    const changed = nextValue !== this.value;
    this.value = nextValue;
    const nextCaret = range.start + insert.length;
    this.setSelectionRange(nextCaret, nextCaret);
    if (changed) {
      this.markChanged();
    }
    return changed;
  }

  getTextInputOptions(): TextInputOptions {
    return { ...this.textInput };
  }

  wasChanged(): boolean {
    const result = this.changedThisFrame;
    this.changedThisFrame = false;
    return result;
  }

  handleText(text: string): boolean {
    if (!this.state.enabled || !this.state.visible) return false;
    if (!this.state.focused) return false;
    if (!text) return false;

    this.replaceTextRange(this.selectionStart, this.selectionEnd, text);
    return true;
  }

  handleKey(key: string, modifiers?: KeyModifiers): boolean {
    if (!this.state.enabled || !this.state.visible) return false;
    if (!this.state.focused) return false;

    const ctrl = !!modifiers?.ctrl;
    const alt = !!modifiers?.alt;

    switch (key) {
      case 'ArrowLeft':
        if (this.selectionStart !== this.selectionEnd) {
          this.setSelectionRange(this.selectionStart, this.selectionStart);
        } else if (this.cursorPos > 0) {
          this.setSelectionRange(this.cursorPos - 1, this.cursorPos - 1);
        }
        return true;
      case 'ArrowRight':
        if (this.selectionStart !== this.selectionEnd) {
          this.setSelectionRange(this.selectionEnd, this.selectionEnd);
        } else if (this.cursorPos < this.value.length) {
          this.setSelectionRange(this.cursorPos + 1, this.cursorPos + 1);
        }
        return true;
      case 'Home':
        this.setSelectionRange(0, 0);
        return true;
      case 'End':
        this.setSelectionRange(this.value.length, this.value.length);
        return true;
      case 'Backspace':
        if (this.selectionStart !== this.selectionEnd) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, '');
        } else if (this.cursorPos > 0) {
          this.replaceTextRange(this.cursorPos - 1, this.cursorPos, '');
        }
        return true;
      case 'Delete':
        if (this.selectionStart !== this.selectionEnd) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, '');
        } else if (this.cursorPos < this.value.length) {
          this.replaceTextRange(this.cursorPos, this.cursorPos + 1, '');
        }
        return true;
      case 'Enter':
        return true;
      default:
        // Printable fallback for keydown-only environments.
        if (!ctrl && !alt && key.length === 1) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, key);
          return true;
        }
        return false;
    }
  }

  getCursorInfo(): { cursorPos: number; scrollOffset: number } {
    return { cursorPos: this.cursorPos, scrollOffset: this.scrollOffset };
  }

  setScrollOffset(offset: number): void {
    this.scrollOffset = Math.max(0, offset | 0);
  }

  getAlignedColumnOffset(maxChars: number, visibleLength: number): number {
    if (maxChars <= 0) return 0;
    if (this.scrollOffset > 0) return 0;

    const gap = Math.max(0, maxChars - Math.max(0, visibleLength));
    if (gap === 0) return 0;
    if (this.align === 'right') return gap;
    if (this.align === 'center') return Math.floor(gap / 2);
    return 0;
  }

  private markChanged(): void {
    this.changedThisFrame = true;
    this.emit({
      type: 'change',
      widget: this.id,
      timestamp: Date.now(),
      data: { value: this.value }
    });
  }

  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }

  protected getPreferredSize(): { width: number; height: number } {
    const sample = this.value || this.placeholder || '';
    const contentWidth = sample.length * 10 + this.textFieldStyle.paddingX * 2;
    const contentHeight = defaultTokens.typography[this.textFieldStyle.typographyRole].minHeight + this.textFieldStyle.paddingY * 2;
    return {
      width: Math.max(this.bounds.width, contentWidth, 120),
      height: Math.max(this.bounds.height, contentHeight, defaultTokens.controls.input.minHeight)
    };
  }
}
