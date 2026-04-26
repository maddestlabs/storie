/**
 * TUI TextEditor Widget
 * Multi-line editable text input
 */
import { BaseWidget } from '../core/base-widget.js';
import { getTUIThemeDefaults } from './theme.js';
function splitLines(value) {
    // Normalize CRLF and ensure there's always at least one line.
    const normalized = (value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    return lines.length > 0 ? lines : [''];
}
export class TUITextEditor extends BaseWidget {
    lines;
    cursorRow;
    cursorCol;
    desiredCol;
    scrollX;
    scrollY;
    changedThisFrame = false;
    constructor(config) {
        super(config);
        this.lines = splitLines(config.value ?? '');
        this.cursorRow = Math.max(0, this.lines.length - 1);
        this.cursorCol = this.lines[this.cursorRow].length;
        this.desiredCol = this.cursorCol;
        this.scrollX = 0;
        this.scrollY = 0;
        this.on('click', (ev) => {
            const clickX = typeof ev.data?.x === 'number' ? ev.data.x : null;
            const clickY = typeof ev.data?.y === 'number' ? ev.data.y : null;
            if (clickX === null || clickY === null)
                return;
            const innerStartX = this.bounds.x + 1;
            const innerStartY = this.bounds.y + 1;
            const innerWidth = Math.max(0, this.bounds.width - 2);
            const innerHeight = Math.max(0, this.bounds.height - 2);
            if (innerWidth <= 0 || innerHeight <= 0)
                return;
            const relX = Math.max(0, Math.min(innerWidth - 1, clickX - innerStartX));
            const relY = Math.max(0, Math.min(innerHeight - 1, clickY - innerStartY));
            const targetRow = Math.max(0, Math.min(this.lines.length - 1, this.scrollY + relY));
            const targetCol = Math.max(0, Math.min(this.lines[targetRow].length, this.scrollX + relX));
            this.cursorRow = targetRow;
            this.cursorCol = targetCol;
            this.desiredCol = this.cursorCol;
        });
    }
    getValue() {
        return this.lines.join('\n');
    }
    setValue(next) {
        this.lines = splitLines(next ?? '');
        this.cursorRow = Math.max(0, Math.min(this.cursorRow, this.lines.length - 1));
        this.cursorCol = Math.max(0, Math.min(this.cursorCol, this.lines[this.cursorRow].length));
        this.desiredCol = this.cursorCol;
        this.scrollX = 0;
        this.scrollY = 0;
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
        // Most runtimes won't send newlines in text events, but handle them defensively.
        this.insertText(text);
        this.markChanged();
        return true;
    }
    handleKey(key, modifiers) {
        if (!this.state.enabled || !this.state.visible)
            return false;
        if (!this.state.focused)
            return false;
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
                if (this.backspace())
                    this.markChanged();
                return true;
            case 'Delete':
                if (this.del())
                    this.markChanged();
                return true;
            case 'Enter':
                this.insertNewline();
                this.markChanged();
                return true;
            default:
                // Printable fallback for keydown-only environments.
                if (!ctrl && !alt && key.length === 1) {
                    this.insertText(key);
                    this.markChanged();
                    return true;
                }
                return false;
        }
    }
    insertText(text) {
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
    insertNewline() {
        const line = this.lines[this.cursorRow];
        const before = line.slice(0, this.cursorCol);
        const after = line.slice(this.cursorCol);
        this.lines[this.cursorRow] = before;
        this.lines.splice(this.cursorRow + 1, 0, after);
        this.cursorRow += 1;
        this.cursorCol = 0;
        this.desiredCol = 0;
    }
    backspace() {
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
    del() {
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
    moveLeft() {
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
    moveRight() {
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
    moveUp() {
        if (this.cursorRow <= 0)
            return;
        this.cursorRow -= 1;
        this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.desiredCol);
    }
    moveDown() {
        if (this.cursorRow >= this.lines.length - 1)
            return;
        this.cursorRow += 1;
        this.cursorCol = Math.min(this.lines[this.cursorRow].length, this.desiredCol);
    }
    markChanged() {
        this.changedThisFrame = true;
        this.emit({
            type: 'change',
            widget: this.id,
            timestamp: Date.now(),
            data: { value: this.getValue() }
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
            for (let col = 0; col < width; col++) {
                const topChar = col === 0 ? borderChars.tl : (col === width - 1 ? borderChars.tr : borderChars.h);
                const botChar = col === 0 ? borderChars.bl : (col === width - 1 ? borderChars.br : borderChars.h);
                renderer.setCell(buffer, x + col, y, topChar, borderFg, bg);
                renderer.setCell(buffer, x + col, y + height - 1, botChar, borderFg, bg);
            }
            for (let row = 1; row < height - 1; row++) {
                renderer.setCell(buffer, x, y + row, borderChars.v, borderFg, bg);
                renderer.setCell(buffer, x + width - 1, y + row, borderChars.v, borderFg, bg);
            }
        }
        const innerWidth = Math.max(0, width - 2);
        const innerHeight = Math.max(0, height - 2);
        if (innerWidth <= 0 || innerHeight <= 0)
            return;
        // Keep cursor visible
        this.cursorRow = Math.max(0, Math.min(this.cursorRow, this.lines.length - 1));
        this.cursorCol = Math.max(0, Math.min(this.cursorCol, this.lines[this.cursorRow].length));
        if (this.cursorRow < this.scrollY)
            this.scrollY = this.cursorRow;
        else if (this.cursorRow > this.scrollY + innerHeight - 1)
            this.scrollY = this.cursorRow - innerHeight + 1;
        this.scrollY = Math.max(0, Math.min(this.scrollY, Math.max(0, this.lines.length - innerHeight)));
        if (this.cursorCol < this.scrollX)
            this.scrollX = this.cursorCol;
        else if (this.cursorCol > this.scrollX + innerWidth - 1)
            this.scrollX = this.cursorCol - innerWidth + 1;
        const maxLineLen = this.lines.reduce((m, l) => Math.max(m, l.length), 0);
        this.scrollX = Math.max(0, Math.min(this.scrollX, Math.max(0, maxLineLen - innerWidth)));
        // Draw visible lines
        for (let row = 0; row < innerHeight; row++) {
            const lineIdx = this.scrollY + row;
            if (lineIdx >= this.lines.length)
                break;
            const line = this.lines[lineIdx];
            const visible = line.slice(this.scrollX, this.scrollX + innerWidth);
            for (let i = 0; i < visible.length && i < innerWidth; i++) {
                renderer.setCell(buffer, x + 1 + i, y + 1 + row, visible[i], fg, bg);
            }
        }
        // Draw cursor
        if (this.state.focused) {
            const cursorScreenX = x + 1 + (this.cursorCol - this.scrollX);
            const cursorScreenY = y + 1 + (this.cursorRow - this.scrollY);
            if (cursorScreenX >= x + 1 && cursorScreenX < x + width - 1 &&
                cursorScreenY >= y + 1 && cursorScreenY < y + height - 1) {
                const line = this.lines[this.cursorRow] ?? '';
                const localIdx = this.cursorCol - this.scrollX;
                const visible = line.slice(this.scrollX, this.scrollX + innerWidth);
                const ch = localIdx >= 0 && localIdx < visible.length ? visible[localIdx] : ' ';
                const caretFg = bg;
                const caretBg = fg;
                const same = caretFg === caretBg;
                if (same)
                    renderer.setCell(buffer, cursorScreenX, cursorScreenY, ch, bg, cursorAccent);
                else
                    renderer.setCell(buffer, cursorScreenX, cursorScreenY, ch, caretFg, caretBg);
            }
        }
    }
}
//# sourceMappingURL=texteditor.js.map