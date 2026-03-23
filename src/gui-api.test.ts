import { describe, expect, it } from 'vitest';

import { createGUIAPI } from './gui-api.js';

describe('createResponsivePanel fitToViewport', () => {
  it('does not double-apply safe area for derived viewport rects', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 12, right: 16, bottom: 20, left: 24 }),
    );

    gui.init();

    const panel = gui.createResponsivePanel({
      bounds: { x: 0, y: 0, width: 200, height: 80 },
      padding: 0,
      gap: 0,
    });

    const bounds = panel.fitToViewport(
      { x: 40, y: 50, width: 220, height: 160 },
      { inset: 10, safeArea: true },
      false,
    );

    expect(bounds.x).toBe(50);
    expect(bounds.y).toBe(60);
  });
});