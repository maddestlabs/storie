import { describe, expect, it } from 'vitest';

import { createTextInputOptions } from './text-input.js';

describe('createTextInputOptions', () => {
  it('shows the soft keyboard by default', () => {
    expect(createTextInputOptions().showSoftKeyboard).toBe(true);
  });

  it('lets callers suppress the soft keyboard per field', () => {
    expect(createTextInputOptions({ showSoftKeyboard: false }).showSoftKeyboard).toBe(false);
  });
});