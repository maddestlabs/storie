---
name: "GUI Custom Widget Renderer Demo (Storie)"
theme: "neonopia"
authoringCheck: explicit-conditionals
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
var state = {
  lastStatus: 'Ready',
  featureEnabled: true,
  volume: 50,
  iconId: null,
  iconLoading: false
};

function rgb(r, g, b) {
  return ((r & 255) << 24) | ((g & 255) << 16) | ((b & 255) << 8) | 255;
}

function setStatus(msg) {
  var status = msg;
  if (status == null) status = '';
  state.lastStatus = String(status);
  gui.text('status', `Status: ${state.lastStatus} | Slider=${Math.round(Number(state.volume) || 0)}`);
}
```

```js on:init
term.layerID = 'default';

// Kick off a one-time icon load.
// (We keep it promise-based so init doesn't need to be async.)
state.iconLoading = true;
ui.loadImageFromBlob('favicon')
  .then((id) => { state.iconId = id; })
  .catch(() => { state.iconId = null; })
  .finally(() => { state.iconLoading = false; });

gui.screen({
  input: 'auto',
  update: 'auto',
  state,
  layout: {
    type: 'panel',
    insetX: 'lg',
    insetTop: 'xl',
    maxWidth: 760,
    rowGap: 'md',
    anchorX: 'start',
    anchorY: 'start'
  },
  widgets: {
    title: {
      type: 'label',
      bounds: { height: 30 },
      text: 'Custom Widget Renderer Demo',
      align: 'center'
    },
    button: {
      type: 'button',
      bounds: { height: 56 },
      label: 'Custom-Drawn Button',
      onClick() {
        setStatus('Button clicked');
      }
    },
    feature: {
      type: 'checkbox',
      bounds: { height: 30 },
      label: 'Default checkbox renderer',
      checked: state.featureEnabled,
      bind: 'featureEnabled',
      onToggle() {
        var checkboxStatus = 'off';
        if (state.featureEnabled) checkboxStatus = 'on';
        setStatus(`Checkbox: ${checkboxStatus}`);
      }
    },
    volume: {
      type: 'slider',
      bounds: { height: 50 },
      label: 'Default slider renderer',
      min: 0,
      max: 100,
      value: state.volume,
      bind: 'volume',
      onChange() {
        setStatus('Slider changed');
      }
    },
    status: {
      type: 'label',
      bounds: { height: 24 },
      text: 'Status: Ready | Slider=50'
    }
  }
});

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
  let bg = rgb(255, 80, 140);
  if (pressed) bg = rgb(60, 90, 255);
  else if (hovered) bg = rgb(100, 200, 255);

  let border = rgb(20, 20, 20);
  if (focused) border = rgb(255, 255, 255);
  const fg = rgb(10, 10, 10);

  // Background
  ui.rect(x, y, width, height, bg);

  // Border
  ui.rect(x, y, width, 2, border);
  ui.rect(x, y + height - 2, width, 2, border);
  ui.rect(x, y, 2, height, border);
  ui.rect(x + width - 2, y, 2, height, border);

  // Optional icon (if loaded)
  if (state.iconId && ui.image) {
    const size = Math.max(16, Math.min(height - 12, 28));
    const ix = x + 10;
    const iy = y + Math.max(0, (height - size) / 2);
    ui.image(state.iconId, ix, iy, size, size);
  }

  // Label centered using monospace metrics
  let cw = 10;
  if (w.metrics && w.metrics.charWidth) cw = w.metrics.charWidth;

  let ch = 16;
  if (w.metrics && w.metrics.charHeight) ch = w.metrics.charHeight;

  const label = w.label || '';
  const labelW = label.length * cw;
  const hasIcon = !!(state.iconId && ui.image);
  let leftPad = 0;
  if (hasIcon) {
    leftPad = 10 + Math.max(16, Math.min(height - 12, 28)) + 10;
  }
  const tx = x + leftPad + Math.max(0, (width - leftPad - labelW) / 2);
  const ty = y + Math.max(0, (height - ch) / 2);
  ui.text(label, tx, ty, fg);

  return true;
});
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.clear();

gui.render(ui);

term.write(2, termHeight - 2, 'Tip: TAB focus changes the button border.');
```
