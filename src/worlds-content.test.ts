import { describe, expect, it } from 'vitest';

import { stateAtWorldsContent } from './worlds-content.js';

describe('worlds content timing', () => {
  it('returns the current line in replace mode', () => {
    const state = stateAtWorldsContent([
      { ms: 0, text: 'intro' },
      { ms: 1000, text: 'verse' },
      { ms: 2000, text: 'chorus' },
    ], 1.5, { mode: 'replace' });

    expect(state.current).toEqual({ ms: 1000, text: 'verse' });
    expect(state.entries).toEqual([{ ms: 1000, text: 'verse' }]);
    expect(state.text).toBe('verse');
  });

  it('appends prior lines in append mode', () => {
    const state = stateAtWorldsContent([
      { ms: 0, text: 'intro' },
      { ms: 1000, text: 'verse' },
      { ms: 2000, text: 'chorus' },
    ], 2.5, { mode: 'append', separator: ' | ' });

    expect(state.current).toEqual({ ms: 2000, text: 'chorus' });
    expect(state.entries).toEqual([
      { ms: 0, text: 'intro' },
      { ms: 1000, text: 'verse' },
      { ms: 2000, text: 'chorus' },
    ]);
    expect(state.text).toBe('intro | verse | chorus');
  });

  it('supports maxEntries in append mode', () => {
    const state = stateAtWorldsContent([
      { ms: 0, text: 'a' },
      { ms: 1000, text: 'b' },
      { ms: 2000, text: 'c' },
    ], 2.5, { mode: 'append', maxEntries: 2 });

    expect(state.entries).toEqual([
      { ms: 1000, text: 'b' },
      { ms: 2000, text: 'c' },
    ]);
    expect(state.text).toBe('b\nc');
  });
});