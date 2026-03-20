import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import {
  createTextInputOptions,
  normalizeTextSelectionRange
} from '../core/text-input.js';
import type {
  TextInputOptions,
  TextSelectionDirection
} from '../core/types.js';
import type { Color } from '../../types.js';
import type { GUITextAlign } from './textfield.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUITextEditorConfig extends WidgetConfig {
  value?: string;
  placeholder?: string;
  align?: GUITextAlign;
  textInput?: Partial<TextInputOptions>;
  textEditorStyle?: {
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

function splitLines(value: string): string[] {
  const normalized = (value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');
  return lines.length > 0 ? lines : [''];
}

/**
 * Multi-line text editor for the retained GUI system.
 * Rendering is performed by GUISystem.
 */
export class GUITextEditor extends BaseWidget {
  public placeholder: string;
  public align: GUITextAlign;
  public textInput: TextInputOptions;
  public textEditorStyle: {
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

  private lines: string[];
  private cursorRow: number;
  private cursorCol: number;
  private desiredCol: number;
  private selectionStart: number;
  private selectionEnd: number;
  private selectionDirection: TextSelectionDirection = 'none';
  private scrollX: number;
  private scrollY: number;
  private changedThisFrame: boolean = false;

  private charWidth: number = 10;
  private charHeight: number = 18;

  constructor(config: GUITextEditorConfig) {
    super(config);

    this.lines = splitLines(config.value ?? '');
    this.cursorRow = Math.max(0, this.lines.length - 1);
    this.cursorCol = this.lines[this.cursorRow].length;
    this.desiredCol = this.cursorCol;
    this.selectionStart = this.getOffsetFromPosition(this.cursorRow, this.cursorCol);
    this.selectionEnd = this.selectionStart;
    this.scrollX = 0;
    this.scrollY = 0;

    this.placeholder = config.placeholder ?? '';
    this.align = config.align ?? 'left';
    this.textInput = createTextInputOptions(config.textInput, {
      multiline: true,
      enterKeyHint: 'enter'
    });
    this.textEditorStyle = {
      fg: config.textEditorStyle?.fg,
      bg: config.textEditorStyle?.bg,
      borderColor: config.textEditorStyle?.borderColor,
      focusBorderColor: config.textEditorStyle?.focusBorderColor,
      drawBackground: config.textEditorStyle?.drawBackground ?? true,
      drawBorder: config.textEditorStyle?.drawBorder ?? true,
      paddingX: config.textEditorStyle?.paddingX ?? defaultTokens.controls.input.paddingX,
      paddingY: config.textEditorStyle?.paddingY ?? defaultTokens.controls.input.paddingY,
      borderWidth: config.textEditorStyle?.borderWidth ?? defaultTokens.controls.input.borderWidth,
      focusBorderWidth: config.textEditorStyle?.focusBorderWidth ?? defaultTokens.controls.input.focusBorderWidth,
      typographyRole: config.textEditorStyle?.typographyRole ?? 'body'
    };

    this.on('click', (ev) => {
      const clickX = typeof ev.data?.x === 'number' ? (ev.data.x as number) : null;
      const clickY = typeof ev.data?.y === 'number' ? (ev.data.y as number) : null;
      if (clickX === null || clickY === null) return;

      const padX = this.textEditorStyle.paddingX;
      const padY = this.textEditorStyle.paddingY;
      const innerX = this.bounds.x + padX;
      const innerY = this.bounds.y + padY;
      const innerW = Math.max(0, this.bounds.width - padX * 2);
      const innerH = Math.max(0, this.bounds.height - padY * 2);
      if (innerW <= 0 || innerH <= 0) return;

      const relPxX = Math.max(0, Math.min(innerW - 1, clickX - innerX));
      const relPxY = Math.max(0, Math.min(innerH - 1, clickY - innerY));

      const relRow = Math.floor(relPxY / Math.max(1, this.charHeight));

      const targetRow = Math.max(0, Math.min(this.lines.length - 1, this.scrollY + relRow));
      const maxCols = Math.max(0, Math.floor(innerW / Math.max(1, this.charWidth)));
      const lineLength = this.lines[targetRow].length;
      const alignedX = this.getAlignedColumnOffset(maxCols, lineLength, this.scrollX);
      const relColAligned = Math.floor(relPxX / Math.max(1, this.charWidth)) - alignedX;
      const targetCol = Math.max(0, Math.min(lineLength, this.scrollX + relColAligned));

      const targetOffset = this.getOffsetFromPosition(targetRow, targetCol);
      this.setSelectionRange(targetOffset, targetOffset);
    });
  }

  updateMetrics(charWidth: number, charHeight: number): void {
    if (Number.isFinite(charWidth) && charWidth > 0) this.charWidth = charWidth;
    if (Number.isFinite(charHeight) && charHeight > 0) this.charHeight = charHeight;
  }

  getValue(): string {
    return this.lines.join('\n');
  }

  getLineCount(): number {
    return this.lines.length;
  }

  getLine(row: number): string {
    const idx = row | 0;
    if (idx < 0 || idx >= this.lines.length) return '';
    return this.lines[idx];
  }

  getMaxLineLength(): number {
    let max = 0;
    for (const line of this.lines) max = Math.max(max, line.length);
    return max;
  }

  setValue(next: string): void {
    this.lines = splitLines(next ?? '');
    this.cursorRow = Math.max(0, Math.min(this.cursorRow, this.lines.length - 1));
    this.cursorCol = Math.max(0, Math.min(this.cursorCol, this.lines[this.cursorRow].length));
    this.desiredCol = this.cursorCol;
    const offset = this.getOffsetFromPosition(this.cursorRow, this.cursorCol);
    this.selectionStart = offset;
    this.selectionEnd = offset;
    this.selectionDirection = 'none';
    this.scrollX = 0;
    this.scrollY = 0;
  }

  getSelectionRange() {
    return {
      start: this.selectionStart,
      end: this.selectionEnd,
      direction: this.selectionDirection
    };
  }

  setSelectionRange(start: number, end: number = start, direction: TextSelectionDirection = 'none'): boolean {
    const next = normalizeTextSelectionRange(this.getValue().length, start, end, direction);
    const changed = next.start !== this.selectionStart
      || next.end !== this.selectionEnd
      || next.direction !== this.selectionDirection;
    this.selectionStart = next.start;
    this.selectionEnd = next.end;
    this.selectionDirection = next.direction ?? 'none';
    this.updateCursorFromOffset(this.selectionEnd);
    return changed;
  }

  replaceTextRange(start: number, end: number, text: string): boolean {
    const current = this.getValue();
    const range = normalizeTextSelectionRange(current.length, start, end);
    const insert = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const nextValue = current.slice(0, range.start) + insert + current.slice(range.end);
    const changed = nextValue !== current;
    this.lines = splitLines(nextValue);
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
          return true;
        }
        this.moveLeft();
        this.collapseSelectionToCursor();
        return true;
      case 'ArrowRight':
        if (this.selectionStart !== this.selectionEnd) {
          this.setSelectionRange(this.selectionEnd, this.selectionEnd);
          return true;
        }
        this.moveRight();
        this.collapseSelectionToCursor();
        return true;
      case 'ArrowUp':
        this.moveUp();
        this.collapseSelectionToCursor();
        return true;
      case 'ArrowDown':
        this.moveDown();
        this.collapseSelectionToCursor();
        return true;
      case 'Home':
        this.cursorCol = 0;
        this.desiredCol = 0;
        this.collapseSelectionToCursor();
        return true;
      case 'End':
        this.cursorCol = this.lines[this.cursorRow].length;
        this.desiredCol = this.cursorCol;
        this.collapseSelectionToCursor();
        return true;
      case 'Backspace':
        if (this.selectionStart !== this.selectionEnd) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, '');
        } else if (this.backspace()) {
          this.markChanged();
        }
        return true;
      case 'Delete':
        if (this.selectionStart !== this.selectionEnd) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, '');
        } else if (this.del()) {
          this.markChanged();
        }
        return true;
      case 'Enter':
        this.replaceTextRange(this.selectionStart, this.selectionEnd, '\n');
        return true;
      default:
        if (!ctrl && !alt && key.length === 1) {
          this.replaceTextRange(this.selectionStart, this.selectionEnd, key);
          return true;
        }
        return false;
    }
  }

  getCursorInfo(): {
    cursorRow: number;
    cursorCol: number;
    scrollX: number;
    scrollY: number;
    charWidth: number;
    charHeight: number;
  } {
    return {
      cursorRow: this.cursorRow,
      cursorCol: this.cursorCol,
      scrollX: this.scrollX,
      scrollY: this.scrollY,
      charWidth: this.charWidth,
      charHeight: this.charHeight
    };
  }

  setScroll(scrollX: number, scrollY: number): void {
    this.scrollX = Math.max(0, scrollX | 0);
    this.scrollY = Math.max(0, scrollY | 0);
  }

  getAlignedColumnOffset(maxCols: number, lineLength: number, scrollX: number): number {
    if (maxCols <= 0) return 0;
    if (scrollX > 0) return 0;

    const visibleLength = Math.min(maxCols, Math.max(0, lineLength - scrollX));
    const gap = Math.max(0, maxCols - visibleLength);
    if (gap === 0) return 0;
    if (this.align === 'right') return gap;
    if (this.align === 'center') return Math.floor(gap / 2);
    return 0;
  }

  private backspace(): boolean {
    if (this.cursorCol > 0) {
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol -= 1;
      this.desiredCol = this.cursorCol;
      this.collapseSelectionToCursor();
      return true;
    }

    if (this.cursorRow > 0) {
      const prev = this.lines[this.cursorRow - 1];
      const cur = this.lines[this.cursorRow];
      const nextCol = prev.length;
      this.lines[this.cursorRow - 1] = prev + cur;
      this.lines.splice(this.cursorRow, 1);
      this.cursorRow -= 1;
      this.cursorCol = nextCol;
      this.desiredCol = this.cursorCol;
      this.collapseSelectionToCursor();
      return true;
    }

    return false;
  }

  private del(): boolean {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
      this.desiredCol = this.cursorCol;
      this.collapseSelectionToCursor();
      return true;
    }

    if (this.cursorRow < this.lines.length - 1) {
      const next = this.lines[this.cursorRow + 1];
      this.lines[this.cursorRow] = line + next;
      this.lines.splice(this.cursorRow + 1, 1);
      this.desiredCol = this.cursorCol;
      this.collapseSelectionToCursor();
      return true;
    }

    return false;
  }

  private moveLeft(): void {
    if (this.cursorCol > 0) {
      this.cursorCol -= 1;
      this.desiredCol = this.cursorCol;
      return;
    }
    if (this.cursorRow > 0) {
      this.cursorRow -= 1;
      this.cursorCol = this.lines[this.cursorRow].length;
      this.desiredCol = this.cursorCol;
    }
  }

  private moveRight(): void {
    const lineLen = this.lines[this.cursorRow].length;
    if (this.cursorCol < lineLen) {
      this.cursorCol += 1;
      this.desiredCol = this.cursorCol;
      return;
    }
    if (this.cursorRow < this.lines.length - 1) {
      this.cursorRow += 1;
      this.cursorCol = 0;
      this.desiredCol = 0;
    }
  }

  private moveUp(): void {
    if (this.cursorRow <= 0) return;
    this.cursorRow -= 1;
    this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.desiredCol);
  }

  private moveDown(): void {
    if (this.cursorRow >= this.lines.length - 1) return;
    this.cursorRow += 1;
    this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.desiredCol);
  }

  private collapseSelectionToCursor(): void {
    const offset = this.getOffsetFromPosition(this.cursorRow, this.cursorCol);
    this.selectionStart = offset;
    this.selectionEnd = offset;
    this.selectionDirection = 'none';
  }

  private updateCursorFromOffset(offset: number): void {
    const pos = this.getPositionFromOffset(offset);
    this.cursorRow = pos.row;
    this.cursorCol = pos.col;
    this.desiredCol = this.cursorCol;
  }

  private getOffsetFromPosition(row: number, col: number): number {
    let offset = 0;
    const targetRow = Math.max(0, Math.min(this.lines.length - 1, row | 0));
    for (let i = 0; i < targetRow; i++) {
      offset += this.lines[i].length + 1;
    }
    const targetCol = Math.max(0, Math.min(this.lines[targetRow].length, col | 0));
    return offset + targetCol;
  }

  private getPositionFromOffset(offset: number): { row: number; col: number } {
    const text = this.getValue();
    let remaining = Math.max(0, Math.min(text.length, offset | 0));
    for (let row = 0; row < this.lines.length; row++) {
      const lineLength = this.lines[row].length;
      if (remaining <= lineLength) {
        return { row, col: remaining };
      }
      remaining -= lineLength;
      if (row < this.lines.length - 1) {
        if (remaining === 0) return { row: row + 1, col: 0 };
        remaining -= 1;
      }
    }
    const lastRow = Math.max(0, this.lines.length - 1);
    return { row: lastRow, col: this.lines[lastRow].length };
  }

  private markChanged(): void {
    this.changedThisFrame = true;
    this.emit({
      type: 'change',
      widget: this.id,
      timestamp: Date.now(),
      data: { value: this.getValue() }
    });
  }

  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render().
  }

  protected getPreferredSize(): { width: number; height: number } {
    const lines = this.lines.length || 1;
    const maxLine = this.getMaxLineLength();
    const contentWidth = maxLine * 10 + this.textEditorStyle.paddingX * 2;
    const contentHeight = lines * 18 + this.textEditorStyle.paddingY * 2;
    return {
      width: Math.max(this.bounds.width, contentWidth, 160),
      height: Math.max(this.bounds.height, contentHeight, defaultTokens.controls.input.minHeight)
    };
  }
}
