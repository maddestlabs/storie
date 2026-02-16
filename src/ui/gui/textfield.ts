import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

export interface GUITextFieldConfig extends WidgetConfig {
  value?: string;
  placeholder?: string;
  textFieldStyle?: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    focusBorderColor?: Color;
  };
}

type KeyModifiers = { shift?: boolean; ctrl?: boolean; alt?: boolean };

/**
 * Single-line text input for the retained GUI system.
 * Rendering is performed by GUISystem.
 */
export class GUITextField extends BaseWidget {
  public placeholder: string;
  public textFieldStyle: {
    fg: Color;
    bg: Color;
    borderColor: Color;
    focusBorderColor: Color;
  };

  private value: string;
  private cursorPos: number;
  private scrollOffset: number;
  private changedThisFrame: boolean = false;
  private charWidth: number = 10;

  constructor(config: GUITextFieldConfig) {
    super(config);

    this.value = config.value ?? '';
    this.cursorPos = this.value.length;
    this.scrollOffset = 0;
    this.placeholder = config.placeholder ?? '';

    this.textFieldStyle = {
      fg: (config.textFieldStyle?.fg ?? { r: 240, g: 240, b: 240 }) as Color,
      bg: (config.textFieldStyle?.bg ?? { r: 30, g: 30, b: 30, a: 0.95 }) as Color,
      borderColor: (config.textFieldStyle?.borderColor ?? { r: 90, g: 90, b: 90 }) as Color,
      focusBorderColor: (config.textFieldStyle?.focusBorderColor ?? { r: 120, g: 170, b: 220 }) as Color
    };

    this.on('click', (ev) => {
      const clickX = typeof ev.data?.x === 'number' ? (ev.data.x as number) : null;
      if (clickX === null) return;

      const padX = 8;
      const innerX = this.bounds.x + padX;
      const innerW = Math.max(0, this.bounds.width - padX * 2);
      if (innerW <= 0) return;

      const relPx = Math.max(0, Math.min(innerW, clickX - innerX));
      const relChars = Math.floor(relPx / Math.max(1, this.charWidth));
      const target = this.scrollOffset + relChars;
      this.cursorPos = Math.max(0, Math.min(this.value.length, target));
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
    this.value = next ?? '';
    this.cursorPos = Math.max(0, Math.min(this.cursorPos, this.value.length));
    this.scrollOffset = 0;
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

    const before = this.value.slice(0, this.cursorPos);
    const after = this.value.slice(this.cursorPos);
    this.value = before + text + after;
    this.cursorPos += text.length;
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
        if (this.cursorPos > 0) this.cursorPos -= 1;
        return true;
      case 'ArrowRight':
        if (this.cursorPos < this.value.length) this.cursorPos += 1;
        return true;
      case 'Home':
        this.cursorPos = 0;
        return true;
      case 'End':
        this.cursorPos = this.value.length;
        return true;
      case 'Backspace':
        if (this.cursorPos > 0) {
          this.value = this.value.slice(0, this.cursorPos - 1) + this.value.slice(this.cursorPos);
          this.cursorPos -= 1;
          this.markChanged();
        }
        return true;
      case 'Delete':
        if (this.cursorPos < this.value.length) {
          this.value = this.value.slice(0, this.cursorPos) + this.value.slice(this.cursorPos + 1);
          this.markChanged();
        }
        return true;
      case 'Enter':
        return true;
      default:
        // Printable fallback for keydown-only environments.
        if (!ctrl && !alt && key.length === 1) {
          const before = this.value.slice(0, this.cursorPos);
          const after = this.value.slice(this.cursorPos);
          this.value = before + key + after;
          this.cursorPos += 1;
          this.markChanged();
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
}
