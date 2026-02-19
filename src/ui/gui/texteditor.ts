import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

export interface GUITextEditorConfig extends WidgetConfig {
  value?: string;
  placeholder?: string;
  textEditorStyle?: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    focusBorderColor?: Color;
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
  public textEditorStyle: {
    fg: Color;
    bg: Color;
    borderColor: Color;
    focusBorderColor: Color;
  };

  private lines: string[];
  private cursorRow: number;
  private cursorCol: number;
  private desiredCol: number;
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
    this.scrollX = 0;
    this.scrollY = 0;

    this.placeholder = config.placeholder ?? '';
    this.textEditorStyle = {
      fg: (config.textEditorStyle?.fg ?? { r: 240, g: 240, b: 240 }) as Color,
      bg: (config.textEditorStyle?.bg ?? { r: 30, g: 30, b: 30, a: 0.95 }) as Color,
      borderColor: (config.textEditorStyle?.borderColor ?? { r: 90, g: 90, b: 90 }) as Color,
      focusBorderColor: (config.textEditorStyle?.focusBorderColor ?? { r: 120, g: 170, b: 220 }) as Color
    };

    this.on('click', (ev) => {
      const clickX = typeof ev.data?.x === 'number' ? (ev.data.x as number) : null;
      const clickY = typeof ev.data?.y === 'number' ? (ev.data.y as number) : null;
      if (clickX === null || clickY === null) return;

      const padX = 8;
      const padY = 8;
      const innerX = this.bounds.x + padX;
      const innerY = this.bounds.y + padY;
      const innerW = Math.max(0, this.bounds.width - padX * 2);
      const innerH = Math.max(0, this.bounds.height - padY * 2);
      if (innerW <= 0 || innerH <= 0) return;

      const relPxX = Math.max(0, Math.min(innerW - 1, clickX - innerX));
      const relPxY = Math.max(0, Math.min(innerH - 1, clickY - innerY));

      const relCol = Math.floor(relPxX / Math.max(1, this.charWidth));
      const relRow = Math.floor(relPxY / Math.max(1, this.charHeight));

      const targetRow = Math.max(0, Math.min(this.lines.length - 1, this.scrollY + relRow));
      const targetCol = Math.max(0, Math.min(this.lines[targetRow].length, this.scrollX + relCol));

      this.cursorRow = targetRow;
      this.cursorCol = targetCol;
      this.desiredCol = this.cursorCol;
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
    this.scrollX = 0;
    this.scrollY = 0;
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

    this.insertText(text);
    this.markChanged();
    return true;
  }

  handleKey(key: string, modifiers?: KeyModifiers): boolean {
    if (!this.state.enabled || !this.state.visible) return false;
    if (!this.state.focused) return false;

    const ctrl = !!modifiers?.ctrl;
    const alt = !!modifiers?.alt;

    switch (key) {
      case 'ArrowLeft':
        this.moveLeft();
        return true;
      case 'ArrowRight':
        this.moveRight();
        return true;
      case 'ArrowUp':
        this.moveUp();
        return true;
      case 'ArrowDown':
        this.moveDown();
        return true;
      case 'Home':
        this.cursorCol = 0;
        this.desiredCol = 0;
        return true;
      case 'End':
        this.cursorCol = this.lines[this.cursorRow].length;
        this.desiredCol = this.cursorCol;
        return true;
      case 'Backspace':
        if (this.backspace()) this.markChanged();
        return true;
      case 'Delete':
        if (this.del()) this.markChanged();
        return true;
      case 'Enter':
        this.insertNewline();
        this.markChanged();
        return true;
      default:
        if (!ctrl && !alt && key.length === 1) {
          this.insertText(key);
          this.markChanged();
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

  private insertText(text: string): void {
    const parts = (text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    if (parts.length === 1) {
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + parts[0] + line.slice(this.cursorCol);
      this.cursorCol += parts[0].length;
      this.desiredCol = this.cursorCol;
      return;
    }

    const line = this.lines[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol);

    const first = before + parts[0];
    const last = parts[parts.length - 1] + after;
    const middle = parts.slice(1, -1);

    const newLines = [first, ...middle, last];
    this.lines.splice(this.cursorRow, 1, ...newLines);

    this.cursorRow += newLines.length - 1;
    this.cursorCol = parts[parts.length - 1].length;
    this.desiredCol = this.cursorCol;
  }

  private insertNewline(): void {
    const line = this.lines[this.cursorRow];
    const before = line.slice(0, this.cursorCol);
    const after = line.slice(this.cursorCol);
    this.lines[this.cursorRow] = before;
    this.lines.splice(this.cursorRow + 1, 0, after);
    this.cursorRow += 1;
    this.cursorCol = 0;
    this.desiredCol = 0;
  }

  private backspace(): boolean {
    if (this.cursorCol > 0) {
      const line = this.lines[this.cursorRow];
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol);
      this.cursorCol -= 1;
      this.desiredCol = this.cursorCol;
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
      return true;
    }

    return false;
  }

  private del(): boolean {
    const line = this.lines[this.cursorRow];
    if (this.cursorCol < line.length) {
      this.lines[this.cursorRow] = line.slice(0, this.cursorCol) + line.slice(this.cursorCol + 1);
      this.desiredCol = this.cursorCol;
      return true;
    }

    if (this.cursorRow < this.lines.length - 1) {
      const next = this.lines[this.cursorRow + 1];
      this.lines[this.cursorRow] = line + next;
      this.lines.splice(this.cursorRow + 1, 1);
      this.desiredCol = this.cursorCol;
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
}
