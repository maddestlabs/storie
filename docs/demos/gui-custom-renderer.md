---
name: "GUI Custom Widget Renderer Demo (Storie)"
theme: "neonopia"
---

A minimal demo showing how to override retained-mode widget drawing with `gui.setWidgetRenderer`.

- The GUI system still handles input, focus, and state updates.
- Your callback only controls *drawing*.
- Return `true` to skip Storie’s default renderer for that widget.

## Game Code

## Embedded Icon (PNG)

```blob name:favicon mime:image/png enc:base64
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
```

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
ui.loadImageFromBlob('favicon')
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
