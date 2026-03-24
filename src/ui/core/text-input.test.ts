import { describe, expect, it } from 'vitest';

import { createTextInputOptions, getHiddenTextInputBridgeAttributes } from './text-input.js';

describe('createTextInputOptions', () => {
  it('shows the soft keyboard by default', () => {
    expect(createTextInputOptions().showSoftKeyboard).toBe(true);
  });

  it('lets callers suppress the soft keyboard per field', () => {
    expect(createTextInputOptions({ showSoftKeyboard: false }).showSoftKeyboard).toBe(false);
  });

  it('hardens bridge attributes when the soft keyboard is disabled', () => {
    expect(getHiddenTextInputBridgeAttributes(createTextInputOptions({ showSoftKeyboard: false }))).toEqual({
      readOnly: true,
      inputMode: 'none',
      virtualKeyboardPolicy: 'manual'
    });
  });

  it('preserves editable bridge attributes when the soft keyboard is enabled', () => {
    expect(getHiddenTextInputBridgeAttributes(createTextInputOptions({ inputMode: 'numeric' }))).toEqual({
      readOnly: false,
      inputMode: 'numeric',
      virtualKeyboardPolicy: 'auto'
    });
  });
});