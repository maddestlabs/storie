---
name: "GUI Custom Widget Renderer Demo (Storie)"
theme: "neonopia"
---

A minimal demo showing how to override retained-mode widget drawing with `gui.setWidgetRenderer`.

- The GUI system still handles input, focus, and state updates.
- Your callback only controls *drawing*.
- Return `true` to skip Storie’s default renderer for that widget.

## Game Code

```js
let widgets = null;
let mouseDownLeft = false;
let lastStatus = 'Ready';

let iconId = null;
let iconLoading = false;
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

// Kick off a one-time icon load.
// (We keep it promise-based so init doesn't need to be async.)
iconLoading = true;
ui.loadImage('/favicon.png')
  .then((id) => { iconId = id; })
  .catch(() => { iconId = null; })
  .finally(() => { iconLoading = false; });

// Override drawing for *buttons* only.
// Everything else (label/checkbox/slider/markdown) uses the built-in renderer.
gui.setWidgetRenderer((w, ui) => {
  if (!w || w.kind !== 'button') return false;

  const x = w.bounds.x;
  const y = w.bounds.y;
  const width = w.bounds.width;
  const height = w.bounds.height;

  const hovered = !!w.state.hovered;
  const pressed = !!w.state.pressed;
  const focused = !!w.state.focused;

  // Colors (simple, no new theme system):
  const bg = pressed
    ? ui.colors.rgb(60, 90, 255)
    : hovered
      ? ui.colors.rgb(100, 200, 255)
      : ui.colors.rgb(255, 80, 140);

  const border = focused ? ui.colors.rgb(255, 255, 255) : ui.colors.rgb(20, 20, 20);
  const fg = ui.colors.rgb(10, 10, 10);

  // Background
  ui.rect(x, y, width, height, bg);

  // Border
  ui.rect(x, y, width, 2, border);
  ui.rect(x, y + height - 2, width, 2, border);
  ui.rect(x, y, 2, height, border);
  ui.rect(x + width - 2, y, 2, height, border);

  // Optional icon (if loaded)
  if (iconId && ui.image) {
    const size = Math.max(16, Math.min(height - 12, 28));
    const ix = x + 10;
    const iy = y + Math.max(0, (height - size) / 2);
    ui.image(iconId, ix, iy, size, size);
  }

  // Label centered using monospace metrics
  const cw = (w.metrics && w.metrics.charWidth) ? w.metrics.charWidth : 10;
  const ch = (w.metrics && w.metrics.charHeight) ? w.metrics.charHeight : 16;
  const label = w.label || '';
  const labelW = label.length * cw;
  const hasIcon = !!(iconId && ui.image);
  const leftPad = hasIcon ? 10 + Math.max(16, Math.min(height - 12, 28)) + 10 : 0;
  const tx = x + leftPad + Math.max(0, (width - leftPad - labelW) / 2);
  const ty = y + Math.max(0, (height - ch) / 2);
  ui.text(label, tx, ty, fg);

  return true;
});

const title = gui.createLabel({
  bounds: { x: 20, y: 30, width: 740, height: 30 },
  text: 'Custom Widget Renderer Demo',
  align: 'center'
});

const btn = gui.createButton({
  bounds: { x: 20, y: 80, width: 320, height: 56 },
  label: 'Custom-Drawn Button'
});

const chk = gui.createCheckbox({
  bounds: { x: 20, y: 150, width: 360, height: 30 },
  label: 'Default checkbox renderer',
  checked: true
});

const sld = gui.createSlider({
  bounds: { x: 20, y: 200, width: 420, height: 50 },
  label: 'Default slider renderer',
  min: 0,
  max: 100,
  value: 50
});

const status = gui.createLabel({
  bounds: { x: 20, y: 270, width: 740, height: 24 },
  text: 'Status: Ready'
});

widgets = { title, btn, chk, sld, status };
```

```js on:input
if (!event || !widgets) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}
```

```js on:update
if (!widgets) return;

gui.update(getMouseX(), getMouseY(), mouseDownLeft);

if (widgets.btn.wasClicked()) {
  lastStatus = 'Button clicked';
}

if (widgets.chk.wasToggled()) {
  lastStatus = `Checkbox: ${widgets.chk.isChecked() ? 'on' : 'off'}`;
}

widgets.status.setText(`Status: ${lastStatus} | Slider=${Math.round(widgets.sld.getValue())}`);
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.clear();

term.write(2, termHeight - 2, 'Tip: TAB focus changes the button border.');
```
