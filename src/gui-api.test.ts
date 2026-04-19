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

  it('exposes group presentation methods on the public api', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    gui.init();
    gui.setGroupOpacity('demo-group', 0.4);
    gui.setGroupTransform('demo-group', { x: 12, y: 18, scale: 1.25 });

    const system = gui.getSystem();
    expect(system?.getGroupState('demo-group').presentation.opacity).toBe(0.4);
    expect(system?.getGroupState('demo-group').transform).toEqual({ x: 12, y: 18, scale: 1.25 });
  });

  it('exposes automatic retained GUI routing flags from init options', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    gui.init({ input: 'auto', update: 'auto' });

    expect(gui.isAutoInputEnabled()).toBe(true);
    expect(gui.isAutoUpdateEnabled()).toBe(true);
  });

  it('supports named widget lookup and convenience helpers', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    gui.init();

    gui.createLabel({ id: 'status', bounds: { x: 0, y: 0, width: 100, height: 20 }, text: 'Ready' });
    gui.createSlider({ id: 'volume', bounds: { x: 0, y: 24, width: 120, height: 40 }, min: 0, max: 100, value: 25 });
    gui.createCheckbox({ id: 'feature', bounds: { x: 0, y: 70, width: 140, height: 24 }, label: 'Feature', checked: false });

    expect(gui.get('status')?.id).toBe('status');
    expect(gui.text('status')).toBe('Ready');
    expect(gui.value('volume')).toBe(25);
    expect(gui.checked('feature')).toBe(false);

    gui.text('status', 'Updated');
    gui.value('volume', 80);
    gui.checked('feature', true);

    expect(gui.text('status')).toBe('Updated');
    expect(gui.value('volume')).toBe(80);
    expect(gui.checked('feature')).toBe(true);
  });

  it('provides shorthand builders for gui.screen widget specs', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    expect(gui.label('Hello', { align: 'center' })).toEqual({ type: 'label', text: 'Hello', align: 'center' });
    expect(gui.button('Go', { bounds: { height: 24 } })).toEqual({ type: 'button', label: 'Go', bounds: { height: 24 } });
    expect(gui.checkbox('Enabled', { bind: 'enabled' })).toEqual({ type: 'checkbox', label: 'Enabled', bind: 'enabled' });
    expect(gui.slider('Volume', { min: 0, max: 100 })).toEqual({ type: 'slider', label: 'Volume', min: 0, max: 100 });
    expect(gui.input({ bind: 'text' })).toEqual({ type: 'textField', bind: 'text' });
    expect(gui.editor({ bind: 'body' })).toEqual({ type: 'textEditor', bind: 'body' });
    expect(gui.container({ mode: 'grid' })).toEqual({ type: 'container', mode: 'grid' });
    expect(gui.panel({ mode: 'stack' })).toEqual({ type: 'responsivePanel', mode: 'stack' });
  });

  it('binds retained widget values to explicit state', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    const state = {
      volume: 25,
      featureEnabled: false,
      text: 'hello',
    };

    gui.init();
    const slider = gui.createSlider({ id: 'volume', bounds: { x: 0, y: 0, width: 120, height: 40 }, min: 0, max: 100, value: 0 });
    const checkbox = gui.createCheckbox({ id: 'feature', bounds: { x: 0, y: 48, width: 120, height: 24 }, label: 'Feature', checked: true });
    const input = gui.createTextField({ id: 'input', bounds: { x: 0, y: 80, width: 180, height: 24 }, value: '' });

    gui.bind('volume', state, 'volume');
    gui.bind('feature', state, 'featureEnabled');
    gui.bind('input', state, 'text');

    expect(slider.getValue()).toBe(25);
    expect(checkbox.isChecked()).toBe(false);
    expect(input.getValue()).toBe('hello');

    slider.setValue(80);
    checkbox.setChecked(true);
    input.setValue('updated from widget');
    gui.syncBindings();

    expect(state.volume).toBe(80);
    expect(state.featureEnabled).toBe(true);
    expect(state.text).toBe('updated from widget');

    state.volume = 40;
    state.featureEnabled = false;
    state.text = 'updated from state';
    gui.syncBindings();

    expect(slider.getValue()).toBe(40);
    expect(checkbox.isChecked()).toBe(false);
    expect(input.getValue()).toBe('updated from state');
  });

  it('builds a named retained screen from declarative widget specs', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    const state = {
      volume: 30,
      featureEnabled: true,
      text: 'screen text',
    };

    const screen = gui.screen({
      input: 'auto',
      update: 'auto',
      state,
      widgets: {
        title: {
          type: 'label',
          bounds: { x: 0, y: 0, width: 120, height: 20 },
          text: 'Ready',
        },
        feature: {
          type: 'checkbox',
          bounds: { x: 0, y: 28, width: 120, height: 24 },
          label: 'Feature',
          checked: false,
          bind: 'featureEnabled',
        },
        volume: {
          type: 'slider',
          bounds: { x: 0, y: 60, width: 140, height: 40 },
          min: 0,
          max: 100,
          value: 0,
          bind: 'volume',
        },
        input: {
          type: 'editor',
          bounds: { x: 0, y: 108, width: 180, height: 60 },
          value: '',
          bind: 'text',
        },
      },
    });

    expect(gui.isAutoInputEnabled()).toBe(true);
    expect(gui.isAutoUpdateEnabled()).toBe(true);
    expect(screen.get('title')?.id).toBe('title');
    expect(gui.get('feature')?.id).toBe('feature');
    expect(gui.checked('feature')).toBe(true);
    expect(gui.value('volume')).toBe(30);
    expect(gui.value('input')).toBe('screen text');

    state.volume = 75;
    gui.syncBindings();

    expect(gui.value('volume')).toBe(75);
  });

  it('supports simple gui.screen callback specs for common reactions', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    const state = {
      featureEnabled: false,
      volume: 10,
      text: 'hello',
      clicks: 0,
      lastStatus: '',
    };

    gui.screen({
      input: 'auto',
      update: 'auto',
      state,
      widgets: {
        click: {
          type: 'button',
          bounds: { x: 0, y: 0, width: 120, height: 24 },
          label: 'Click',
          onClick() {
            state.clicks += 1;
          },
        },
        feature: {
          type: 'checkbox',
          bounds: { x: 0, y: 32, width: 120, height: 24 },
          label: 'Feature',
          checked: false,
          bind: 'featureEnabled',
          onToggle() {
            state.lastStatus = state.featureEnabled ? 'enabled' : 'disabled';
          },
        },
        volume: {
          type: 'slider',
          bounds: { x: 0, y: 64, width: 140, height: 40 },
          min: 0,
          max: 100,
          value: 10,
          bind: 'volume',
          onChange() {
            state.lastStatus = `volume:${state.volume}`;
          },
        },
        input: {
          type: 'textField',
          bounds: { x: 0, y: 112, width: 180, height: 24 },
          value: 'hello',
          bind: 'text',
          onChange() {
            state.lastStatus = `text:${state.text}`;
          },
        },
      },
    });

    gui.get('click')?.emit({ type: 'click', widget: 'click', timestamp: Date.now() });
    expect(state.clicks).toBe(1);

    const checkbox = gui.get('feature');
    checkbox?.setChecked(true);
    gui.update(0, 0, false);
    expect(state.featureEnabled).toBe(true);
    expect(state.lastStatus).toBe('enabled');

    const slider = gui.get('volume');
    slider?.setValue(42);
    gui.update(0, 0, false);
    expect(state.volume).toBe(42);
    expect(state.lastStatus).toBe('volume:42');

    const input = gui.get('input');
    input?.setValue('world');
    gui.update(0, 0, false);
    expect(state.text).toBe('world');
    expect(state.lastStatus).toBe('text:world');
  });

  it('supports a managed gui.screen layout panel for stacked widgets', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    const screen = gui.screen({
      input: 'auto',
      update: 'auto',
      layout: {
        type: 'panel',
        insetLeft: 20,
        insetRight: 20,
        insetTop: 10,
        maxWidth: 180,
        rowGap: 8,
        padding: 0,
      },
      widgets: {
        title: {
          type: 'label',
          bounds: { height: 20 },
          text: 'Title',
        },
        action: {
          type: 'button',
          bounds: { height: 30 },
          label: 'Action',
        },
      },
    });

    const title = gui.get('title');
    const action = gui.get('action');

    expect(screen.root).toBeTruthy();
    expect(title?.bounds.x).toBeGreaterThanOrEqual(20);
    expect(title?.bounds.y).toBeGreaterThanOrEqual(10);
    expect(title?.bounds.width).toBeLessThanOrEqual(180);
    expect(action?.bounds.x).toBe(title?.bounds.x);
    expect(action?.bounds.y).toBeGreaterThan(title?.bounds.y ?? 0);
    expect(action?.bounds.width).toBe(title?.bounds.width);
  });

  it('resolves token-based spacing shorthands in gui.screen layout', () => {
    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => ({ x: 0, y: 0, width: 400, height: 300 }),
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    gui.screen({
      input: 'auto',
      update: 'auto',
      layout: {
        type: 'panel',
        insetX: 'lg',
        insetTop: 'xl',
        rowGap: 'sm',
        maxWidth: 200,
        padding: 0,
      },
      widgets: {
        title: {
          type: 'label',
          bounds: { height: 20 },
          text: 'Title',
        },
        action: {
          type: 'button',
          bounds: { height: 30 },
          label: 'Action',
        },
      },
    });

    const title = gui.get('title');
    const action = gui.get('action');

    expect(title?.bounds.x).toBeGreaterThanOrEqual(16);
    expect(title?.bounds.y).toBeGreaterThanOrEqual(24);
    expect(action?.bounds.y).toBe((title?.bounds.y ?? 0) + (title?.bounds.height ?? 0) + 8);
  });

  it('supports nested screen containers with responsive per-frame relayout hooks', () => {
    let viewport = { x: 0, y: 0, width: 400, height: 300 };

    const gui = createGUIAPI(
      () => ({ charWidth: 10, charHeight: 16 }),
      undefined,
      undefined,
      () => ({ scaleX: 1, scaleY: 1 }),
      () => viewport,
      () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
    );

    const screen = gui.screen({
      input: 'auto',
      update: 'auto',
      layout: {
        type: 'panel',
        insetX: 20,
        insetTop: 10,
        rowGap: 8,
        onLayout({ viewport, widgets }) {
          widgets.controls.setColumns(viewport.width < 320 ? 1 : 2, false);
          return {
            width: Math.max(0, viewport.width - 40),
            anchorX: 'center',
            anchorY: 'start',
          };
        },
      },
      widgets: {
        controls: {
          type: 'container',
          mode: 'grid',
          columns: 2,
          columnGap: 8,
          rowGap: 8,
          bounds: { height: 1 },
          widgets: {
            one: {
              type: 'button',
              bounds: { height: 24 },
              label: 'One',
            },
            two: {
              type: 'button',
              bounds: { height: 24 },
              label: 'Two',
            },
            three: {
              type: 'button',
              bounds: { height: 24 },
              label: 'Three',
            },
          },
        },
      },
    });

    const one = screen.get('one');
    const two = screen.get('two');
    const three = screen.get('three');

    expect(screen.get('controls')).toBeTruthy();
    expect(one?.bounds.x).toBeLessThan(two?.bounds.x ?? 0);
    expect(two?.bounds.y).toBe(one?.bounds.y);
    expect(three?.bounds.y).toBeGreaterThan(one?.bounds.y ?? 0);

    viewport = { x: 0, y: 0, width: 280, height: 300 };
    gui.update(0, 0, false);

    expect(two?.bounds.x).toBe(one?.bounds.x);
    expect(two?.bounds.y).toBeGreaterThan(one?.bounds.y ?? 0);
    expect(three?.bounds.x).toBe(one?.bounds.x);
    expect(three?.bounds.y).toBeGreaterThan(two?.bounds.y ?? 0);
  });
});