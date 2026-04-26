import { BaseWidget } from '../core/base-widget.js';
import { createTextInputOptions, normalizeTextSelectionRange } from '../core/text-input.js';
import { createDefaultGUITokens } from './tokens.js';
const defaultTokens = createDefaultGUITokens();
function splitLines(value) {
    const normalized = (value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    return lines.length > 0 ? lines : [''];
}
/**
 * Multi-line text editor for the retained GUI system.
 * Rendering is performed by GUISystem.
 */
export class GUITextEditor extends BaseWidget {
    placeholder;
    align;
    textInput;
    textEditorStyle;
    lines;
    cursorRow;
    cursorCol;
    desiredCol;
    selectionStart;
    selectionEnd;
    selectionDirection = 'none';
    scrollX;
    scrollY;
    changedThisFrame = false;
    charWidth = 10;
    charHeight = 18;
    constructor(config) {
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
            const clickX = typeof ev.data?.x === 'number' ? ev.data.x : null;
            const clickY = typeof ev.data?.y === 'number' ? ev.data.y : null;
            if (clickX === null || clickY === null)
                return;
            const padX = this.textEditorStyle.paddingX;
            const padY = this.textEditorStyle.paddingY;
            const innerX = this.bounds.x + padX;
            const innerY = this.bounds.y + padY;
            const innerW = Math.max(0, this.bounds.width - padX * 2);
            const innerH = Math.max(0, this.bounds.height - padY * 2);
            if (innerW <= 0 || innerH <= 0)
                return;
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
    updateMetrics(charWidth, charHeight) {
        if (Number.isFinite(charWidth) && charWidth > 0)
            this.charWidth = charWidth;
        if (Number.isFinite(charHeight) && charHeight > 0)
            this.charHeight = charHeight;
    }
    getValue() {
        return this.lines.join('\n');
    }
    getLineCount() {
        return this.lines.length;
    }
    getLine(row) {
        const idx = row | 0;
        if (idx < 0 || idx >= this.lines.length)
            return '';
        return this.lines[idx];
    }
    getMaxLineLength() {
        let max = 0;
        for (const line of this.lines)
            max = Math.max(max, line.length);
        return max;
    }
    setValue(next) {
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
    setSelectionRange(start, end = start, direction = 'none') {
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
    replaceTextRange(start, end, text) {
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
    getTextInputOptions() {
        return { ...this.textInput };
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
        this.replaceTextRange(this.selectionStart, this.selectionEnd, text);
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
                }
                else if (this.backspace()) {
                    this.markChanged();
                }
                return true;
            case 'Delete':
                if (this.selectionStart !== this.selectionEnd) {
                    this.replaceTextRange(this.selectionStart, this.selectionEnd, '');
                }
                else if (this.del()) {
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
    getCursorInfo() {
        return {
            cursorRow: this.cursorRow,
            cursorCol: this.cursorCol,
            scrollX: this.scrollX,
            scrollY: this.scrollY,
            charWidth: this.charWidth,
            charHeight: this.charHeight
        };
    }
    setScroll(scrollX, scrollY) {
        this.scrollX = Math.max(0, scrollX | 0);
        this.scrollY = Math.max(0, scrollY | 0);
    }
    getAlignedColumnOffset(maxCols, lineLength, scrollX) {
        if (maxCols <= 0)
            return 0;
        if (scrollX > 0)
            return 0;
        const visibleLength = Math.min(maxCols, Math.max(0, lineLength - scrollX));
        const gap = Math.max(0, maxCols - visibleLength);
        if (gap === 0)
            return 0;
        if (this.align === 'right')
            return gap;
        if (this.align === 'center')
            return Math.floor(gap / 2);
        return 0;
    }
    backspace() {
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
    del() {
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
    collapseSelectionToCursor() {
        const offset = this.getOffsetFromPosition(this.cursorRow, this.cursorCol);
        this.selectionStart = offset;
        this.selectionEnd = offset;
        this.selectionDirection = 'none';
    }
    updateCursorFromOffset(offset) {
        const pos = this.getPositionFromOffset(offset);
        this.cursorRow = pos.row;
        this.cursorCol = pos.col;
        this.desiredCol = this.cursorCol;
    }
    getOffsetFromPosition(row, col) {
        let offset = 0;
        const targetRow = Math.max(0, Math.min(this.lines.length - 1, row | 0));
        for (let i = 0; i < targetRow; i++) {
            offset += this.lines[i].length + 1;
        }
        const targetCol = Math.max(0, Math.min(this.lines[targetRow].length, col | 0));
        return offset + targetCol;
    }
    getPositionFromOffset(offset) {
        const text = this.getValue();
        let remaining = Math.max(0, Math.min(text.length, offset | 0));
        for (let row = 0; row < this.lines.length; row++) {
            const lineLength = this.lines[row].length;
            if (remaining <= lineLength) {
                return { row, col: remaining };
            }
            remaining -= lineLength;
            if (row < this.lines.length - 1) {
                if (remaining === 0)
                    return { row: row + 1, col: 0 };
                remaining -= 1;
            }
        }
        const lastRow = Math.max(0, this.lines.length - 1);
        return { row: lastRow, col: this.lines[lastRow].length };
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
    render() {
        // No-op: GUI widgets are rendered by GUISystem.render().
    }
    getPreferredSize() {
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
//# sourceMappingURL=texteditor.js.map