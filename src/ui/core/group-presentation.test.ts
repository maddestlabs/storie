import { describe, expect, it } from 'vitest';

import { BaseWidget } from './base-widget.js';
import { InputRouter } from './input-router.js';
import { WidgetManager } from './widget-manager.js';

class DummyWidget extends BaseWidget {
  render(): void {
    // No-op for tests.
  }

  protected getPreferredSize(): { width: number; height: number } {
    return {
      width: this.bounds.width,
      height: this.bounds.height,
    };
  }
}

describe('widget group presentation', () => {
  it('preserves configured group presentation when widgets register later', () => {
    const manager = new WidgetManager();

    manager.setGroupOpacity('hint', 0.35);
    manager.setGroupTransform('hint', { x: 24, y: 48, scale: 1.5 });

    const widget = new DummyWidget({
      id: 'hint-a',
      group: 'hint',
      focusable: false,
      bounds: { x: 10, y: 20, width: 50, height: 30 },
    });

    manager.register(widget);

    const group = manager.getGroupState('hint');
    expect(group.presentation.opacity).toBe(0.35);
    expect(group.transform).toEqual({ x: 24, y: 48, scale: 1.5 });
    expect(group.widgets.has('hint-a')).toBe(true);
  });

  it('routes pointer hit testing through group translation and scale', () => {
    const manager = new WidgetManager();
    const router = new InputRouter({ widgetManager: manager });
    const widget = new DummyWidget({
      id: 'translated',
      group: 'hint',
      bounds: { x: 10, y: 10, width: 20, height: 20 },
    });
    const clicks: string[] = [];

    widget.on('click', () => clicks.push('translated'));
    manager.register(widget);
    manager.setGroupTransform('hint', { x: 100, y: 50, scale: 2 });

    router.update({ x: 125, y: 75 }, false);
    expect(router.getHoveredWidget()?.id).toBe('translated');

    router.update({ x: 125, y: 75 }, true);
    expect(clicks).toEqual(['translated']);
    expect(manager.getFocused()?.id).toBe('translated');

    router.update({ x: 20, y: 20 }, false);
    expect(router.getHoveredWidget()).toBeNull();
  });
});