import { describe, expect, it } from 'vitest';

import { GUILayoutContainer } from './layout-container.js';

describe('GUILayoutContainer fitToViewport', () => {
  it('can grow again after shrinking to a smaller viewport', () => {
    const container = new GUILayoutContainer({
      bounds: { x: 0, y: 0, width: 600, height: 120 },
      padding: 0,
      gap: 0,
      maxWidth: 600,
    });

    container.fitToViewport(
      { x: 0, y: 0, width: 320, height: 400 },
      { inset: 20, maxWidth: 600 },
      false,
    );

    expect(container.bounds.width).toBe(280);

    container.fitToViewport(
      { x: 0, y: 0, width: 900, height: 400 },
      { inset: 20, maxWidth: 600 },
      false,
    );

    expect(container.bounds.width).toBe(600);
  });

  it('still respects explicit width overrides', () => {
    const container = new GUILayoutContainer({
      bounds: { x: 0, y: 0, width: 600, height: 120 },
      padding: 0,
      gap: 0,
      maxWidth: 600,
    });

    container.fitToViewport(
      { x: 0, y: 0, width: 900, height: 400 },
      { inset: 20, width: 420, maxWidth: 600 },
      false,
    );

    expect(container.bounds.width).toBe(420);
  });
});