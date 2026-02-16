---
name: "GUI Clip + Mask Test (Storie)"
theme: "neonopia"
---

A small demo for:
- Retained-mode GUI layout helper (`gui.createContainer`) + retained widgets
- Rect clipping (`ui.pushClipRect`) + MarkdownView clipping
- Stencil masking (`ui.pushMaskRoundedRect`, `ui.pushMaskPolygon`)

## Demo Code

```js
let widgets = null;
let layout = null;

let maskRadius = 24;

let mouseDownLeft = false;
// MarkdownView handles scroll clamping internally.

let lastInfo = 'Ready';
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

// Left side: a small stacked form using the layout helper.
const title = gui.createLabel({
  bounds: { x: 0, y: 0, width: 440, height: 24 },
  text: 'GUI Clip + Mask Test',
  align: 'center'
});

const chk = gui.createCheckbox({
  bounds: { x: 0, y: 0, width: 440, height: 30 },
  label: 'Enable Feature',
  checked: true
});

const sld = gui.createSlider({
  bounds: { x: 0, y: 0, width: 440, height: 50 },
  label: 'Radius',
  min: 0,
  max: 48,
  value: 24
});

const status = gui.createLabel({
  bounds: { x: 0, y: 0, width: 440, height: 24 },
  text: 'Status: Ready'
});

layout = gui.createContainer({
  bounds: { x: 20, y: 20, width: 440, height: 260 },
  padding: 12,
  gap: 10,
  alignX: 'stretch'
});
layout.addMany([title, chk, sld, status]);
layout.layout();

// Right side: MarkdownView (internally clipped to its bounds).
const markdown = `# MarkdownView (clipped)\n\nTry scrolling. Content should not draw outside the box.\n\n- Link: [Storie on GitHub](https://github.com/maddestlabs/storie)\n- Inline code: \`vec4<f32>\`\n\n## Long Paragraph\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

const mdStatus = gui.createLabel({
  bounds: { x: 480, y: 20, width: 480, height: 24 },
  text: 'Markdown: J/K or Up/Down to scroll; click link'
});

const view = gui.createMarkdownView({
  bounds: { x: 480, y: 52, width: 480, height: 260 },
  markdown,
  padding: 12
});

widgets = { title, chk, sld, status, mdStatus, view };
```

```js on:input
if (!event || !widgets) return;

if (event.type === 'keydown') {
  const key = event.key;

  // Scroll markdown
  if (key === 'j' || key === 'J' || key === 'ArrowDown') {
    widgets.view.scrollBy(28);
  }
  if (key === 'k' || key === 'K' || key === 'ArrowUp') {
    widgets.view.scrollBy(-28);
  }

  gui.handleKey(key, {
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

maskRadius = Math.round(widgets.sld.getValue());

if (widgets.chk.wasToggled()) {
  lastInfo = `Feature: ${widgets.chk.isChecked() ? 'on' : 'off'}`;
}

const url = widgets.view.popClickedLink();
if (url) {
  lastInfo = `Clicked: ${url}`;
}

widgets.status.setText(`Status: ${lastInfo} | radius=${maskRadius}`);
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.clear();

const cw = ui.metrics.charWidth || 10;
const ch = ui.metrics.charHeight || 16;

// === Immediate-mode masking tests ===
// Bottom-left: rounded-rect mask
const maskX = 20;
const maskY = 320;
const maskW = 440;
const maskH = 180;
const radius = maskRadius;

ui.text('Immediate-mode masks:', maskX, maskY - 22, ui.colors.rgb(220, 220, 220));

// Make the rounded corner cutouts visually obvious.
ui.rect(maskX, maskY, maskW, maskH, ui.colors.rgb(40, 40, 40));

ui.pushMaskRoundedRect(maskX, maskY, maskW, maskH, radius);

// Draw a bright fill that would normally occupy the corners.
ui.rect(maskX - 40, maskY - 40, maskW + 80, maskH + 80, ui.colors.rgb(80, 180, 255));

// Draw some stripes that would normally overflow
for (let i = 0; i < 40; i++) {
  const y = maskY - 30 + i * 12;
  ui.rect(maskX - 40, y, maskW + 80, 6, ui.colors.rgba(80, 180, 255, 0.35));
}

ui.text(`Rounded mask (radius=${radius})`, maskX + 12, maskY + 12, ui.colors.rgb(20, 20, 20));
ui.text('Stripes are clipped by the mask', maskX + 12, maskY + 12 + ch, ui.colors.rgb(200, 200, 200));

ui.popMask();

// Bottom-right: polygon mask (convex)
const polyX = 480;
const polyY = 320;
const polyW = 480;
const polyH = 180;

ui.text('Polygon mask (convex):', polyX, polyY - 22, ui.colors.rgb(220, 220, 220));

const cx = polyX + polyW * 0.5;
const cy = polyY + polyH * 0.55;
const r = Math.min(polyW, polyH) * 0.42;

const points = [];
for (let i = 0; i < 6; i++) {
  const a = (Math.PI * 2 * i) / 6;
  points.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
}

ui.pushMaskPolygon(points);

ui.rect(polyX, polyY, polyW, polyH, ui.colors.rgba(255, 255, 255, 0.06));
ui.text('Masked to a hexagon', polyX + 12, polyY + 12, ui.colors.rgb(240, 240, 240));
ui.text('Note: expects convex polygon', polyX + 12, polyY + 12 + ch, ui.colors.rgb(200, 200, 200));

// Also demonstrate scissor clip inside the polygon
ui.pushClipRect(polyX + 12, polyY + 12 + 3 * ch, polyW - 24, polyH - 24 - 3 * ch);
for (let i = 0; i < 30; i++) {
  ui.text(`clipped line ${i}`, polyX + 12, polyY + 12 + (3 + i) * ch, ui.colors.rgb(180, 180, 180));
}
ui.popClipRect();

ui.popMask();

// Footer hint
term.write(2, termHeight - 2, 'Use J/K or Up/Down to scroll markdown.');
```
