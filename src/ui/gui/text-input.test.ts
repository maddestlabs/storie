import { describe, expect, it } from 'vitest';

import { GUITextField } from './textfield.js';
import { GUITextEditor } from './texteditor.js';

describe('GUI text input capabilities', () => {
  it('replaces selected text in text fields and normalizes single-line content', () => {
    const field = new GUITextField({
      bounds: { x: 0, y: 0, width: 120, height: 32 },
      value: 'alpha beta'
    });

    field.setSelectionRange(6, 10);
    const changed = field.replaceTextRange(6, 10, 'gamma\n');

    expect(changed).toBe(true);
    expect(field.getValue()).toBe('alpha gamma ');
    expect(field.getSelectionRange()).toEqual({ start: 12, end: 12, direction: 'none' });
  });

  it('supports offset-based replacement and selection syncing in text editors', () => {
    const editor = new GUITextEditor({
      bounds: { x: 0, y: 0, width: 200, height: 120 },
      value: 'one\ntwo\nthree'
    });

    const changed = editor.replaceTextRange(4, 7, 'middle');
    expect(changed).toBe(true);
    expect(editor.getValue()).toBe('one\nmiddle\nthree');

    editor.setSelectionRange(4, 10);
    expect(editor.getSelectionRange()).toEqual({ start: 4, end: 10, direction: 'none' });

    editor.setValue('abc\ndef');
    editor.setSelectionRange(2, 5);
    expect(editor.getSelectionRange()).toEqual({ start: 2, end: 5, direction: 'none' });
    expect(editor.getCursorInfo().cursorRow).toBe(1);
    expect(editor.getCursorInfo().cursorCol).toBe(1);
  });
});