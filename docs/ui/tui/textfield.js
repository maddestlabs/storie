/**
 * TUI TextField Widget
 * Single-line editable text input
 */
import { BaseWidget } from '../core/base-widget.js';
import { getTUIThemeDefaults } from './theme.js';
export class TUITextField extends BaseWidget {
    value;
    cursorPos;
    scrollOffset;
    changedThisFrame = false;
    constructor(config) {
        super(config);
        this.value = config.value ?? '';
        this.cursorPos = this.value.length;
        this.scrollOffset = 0;
        // Click focuses and places caret
        this.on('click', (ev) => {
            const clickX = typeof ev.data?.x === 'number' ? ev.data.x : null;
            if (clickX === null)
                return;
            const innerStartX = this.bounds.x + 1;
            const innerWidth = Math.max(0, this.bounds.width - 2);
            if (innerWidth <= 0)
                return;
            const relX = Math.max(0, Math.min(innerWidth, clickX - innerStartX));
            const target = this.scrollOffset + relX;
            this.cursorPos = Math.max(0, Math.min(this.value.length, target));
        });
    }
    getValue() {
        return this.value;
    }
    setValue(next) {
        this.value = next ?? '';
        this.cursorPos = Math.max(0, Math.min(this.cursorPos, this.value.length));
        this.scrollOffset = 0;
    }
    wasChanged() {
        const result = this.changedThisFrame;
        this.changedThisFrame = false;
        return result;
    }
    handleText(text) {
        if (!this.state.enabled || !this.state.visible)
            return false;
        if (!this.state.focused)
            return false;
        if (!text)
            return false;
        const before = this.value.slice(0, this.cursorPos);
        const after = this.value.slice(this.cursorPos);
        this.value = before + text + after;
        this.cursorPos += text.length;
        this.markChanged();
        return true;
    }
    handleKey(key, _modifiers) {
        if (!this.state.enabled || !this.state.visible)
            return false;
        if (!this.state.focused)
            return false;
        const ctrl = !!_modifiers?.ctrl;
        const alt = !!_modifiers?.alt;
        switch (key) {
            case 'ArrowLeft':
                if (this.cursorPos > 0)
                    this.cursorPos -= 1;
                return true;
            case 'ArrowRight':
                if (this.cursorPos < this.value.length)
                    this.cursorPos += 1;
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
                // Consume to avoid being treated as "activate" by the router/system.
                return true;
            default:
                // Fallback for runtimes that only deliver printable characters as keydown.
                // Prefer TextEvent when available (handled via handleText()).
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
    markChanged() {
        this.changedThisFrame = true;
        this.emit({
            type: 'change',
            widget: this.id,
            timestamp: Date.now(),
            data: { value: this.value }
        });
    }
    render(buffer, renderer) {
        if (!this.state.visible)
            return;
        const { x, y, width, height } = this.bounds;
        const style = this.getEffectiveStyle();
        const defaults = getTUIThemeDefaults();
        const fg = style.fg ?? defaults.textfield.fg;
        const bg = style.bg ?? defaults.textfield.bg;
        const borderFg = style.borderColor ?? defaults.textfield.borderFg;
        const cursorAccent = style.accentColor ?? defaults.textfield.cursor;
        const rowMid = y + Math.floor(height / 2);
        // Fill background
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                renderer.setCell(buffer, x + col, y + row, ' ', fg, bg);
            }
        }
        if (width >= 2 && height >= 2) {
            const borderChars = this.state.focused
                ? { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' }
                : { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' };
            // Top/bottom borders
            for (let col = 0; col < width; col++) {
                const topChar = col === 0 ? borderChars.tl : (col === width - 1 ? borderChars.tr : borderChars.h);
                const botChar = col === 0 ? borderChars.bl : (col === width - 1 ? borderChars.br : borderChars.h);
                renderer.setCell(buffer, x + col, y, topChar, borderFg, bg);
                renderer.setCell(buffer, x + col, y + height - 1, botChar, borderFg, bg);
            }
            // Left/right borders
            for (let row = 1; row < height - 1; row++) {
                renderer.setCell(buffer, x, y + row, borderChars.v, borderFg, bg);
                renderer.setCell(buffer, x + width - 1, y + row, borderChars.v, borderFg, bg);
            }
        }
        // Draw content
        const innerWidth = Math.max(0, width - 2);
        if (innerWidth <= 0)
            return;
        // Keep cursor visible
        const cursor = Math.max(0, Math.min(this.cursorPos, this.value.length));
        if (cursor < this.scrollOffset) {
            this.scrollOffset = cursor;
        }
        else if (cursor > this.scrollOffset + innerWidth - 1) {
            this.scrollOffset = cursor - innerWidth + 1;
        }
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, Math.max(0, this.value.length - innerWidth)));
        const visibleText = this.value.slice(this.scrollOffset, this.scrollOffset + innerWidth);
        for (let i = 0; i < visibleText.length && i < innerWidth; i++) {
            renderer.setCell(buffer, x + 1 + i, rowMid, visibleText[i], fg, bg);
        }
        // Draw cursor
        if (this.state.focused) {
            const cursorX = x + 1 + (cursor - this.scrollOffset);
            if (cursorX >= x + 1 && cursorX < x + width - 1) {
                // Invert colors at caret position without replacing content.
                // If at end-of-line, show a filled cell using a space.
                const localIdx = cursor - this.scrollOffset;
                const ch = (localIdx >= 0 && localIdx < visibleText.length) ? visibleText[localIdx] : ' ';
                const caretFg = bg;
                const caretBg = fg;
                // If fg/bg are identical, fall back to an accent background to keep cursor visible.
                const same = caretFg === caretBg;
                if (same) {
                    renderer.setCell(buffer, cursorX, rowMid, ch, bg, cursorAccent);
                }
                else {
                    renderer.setCell(buffer, cursorX, rowMid, ch, caretFg, caretBg);
                }
            }
        }
    }
}
//# sourceMappingURL=textfield.js.map