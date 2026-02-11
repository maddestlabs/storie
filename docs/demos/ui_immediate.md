---
name: "Immediate WebGPU UI Demo (Storie)"
theme: "solarlight"
shaders: "ruledlines+paper"
---

A demo showing an immediate-mode WebGPU UI overlay (rects + atlas text) with mouse + keyboard input.

**Keyboard Controls:**
- **LEFT / RIGHT**: Adjust volume
- **SPACE / ENTER**: Click the button (when hovered)

## Game Code

```js
// Variables automatically persist across all code blocks.
// No boilerplate needed - just declare them!
let clickCount = 0;
let enabled = true;
let volume = 50;
let draggingSlider = false;
let lastEvent = '';
let lastStatus = 'Status: Ready';
let titleText = 'Immediate WebGPU UI Demo (Storie)';
```

```js on:init
term.layerID = 'default';

// Keep terminal mostly empty; UI is drawn via `ui.*`.
term.clear();
```

```js on:input
if (!event) return;

if (event.type === 'keydown') {
  lastEvent = `key: ${event.key}`;

  if (event.key === 'ArrowLeft') volume = Math.max(0, volume - 1);
  if (event.key === 'ArrowRight') volume = Math.min(100, volume + 1);

  // Optional: allow keyboard click while hovered.
  if (event.key === ' ' || event.key === 'Enter') {
    // handled in on:update using ui.button (hover-aware)
  }
}

if (event.type === 'mouse') {
  lastEvent = `mouse: ${event.action} ${event.button} (${event.x},${event.y})`;
}

if (event.type === 'mouse_move') {
  // No-op; UI reads pointer directly from ui.pointer in update.
}
```

```js on:update
// Layout in *cells*, converted to pixels with ui.metrics.
const cw = ui.metrics.charWidth || 10;
const ch = ui.metrics.charHeight || 16;

const px = (cx, cy) => ({ x: cx * cw, y: cy * ch });

const titlePos = px(2, 1);
const btnPos = px(2, 3);
const chkPos = px(2, 7);
const sldPos = px(2, 9);
const statusPos = px(2, 13);

const btnW = 26 * cw;
const btnH = 3 * ch;

const chkW = 40 * cw;
const chkH = 1 * ch;

const sldW = 30 * cw;
const sldH = 3 * ch;

// === Button ===
const clickedBtn = ui.button('btn', btnPos.x, btnPos.y, btnW, btnH, 'Click Me')
  || ((lastEvent.startsWith('key:') && (lastEvent.includes('Enter') || lastEvent.includes('key:  '))) && false);

if (clickedBtn) {
  clickCount++;
  lastStatus = `Status: Clicked ${clickCount} time(s)`;
}

// === Checkbox (clickable row) ===
// Draw checkbox using rect/text; use ui.button as the hit target with an empty label.
const chkClicked = ui.button('chk', chkPos.x, chkPos.y, chkW, chkH, enabled ? '[✓] Enable Feature' : '[ ] Enable Feature');
if (chkClicked) {
  enabled = !enabled;
  lastStatus = `Status: Feature ${enabled ? 'enabled' : 'disabled'}`;
}

// === Slider (drag on knob; click track to jump) ===
const trackX = sldPos.x;
const trackY = sldPos.y + ch + Math.floor(ch / 2);
const trackW = sldW;
const trackH = 2;

const knobW = Math.max(8, cw);
const knobH = ch;
const t = volume / 100;
const knobX = trackX + Math.floor((trackW - knobW) * t);
const knobY = sldPos.y + ch;

const mx = ui.pointer.x();
const my = ui.pointer.y();
const down = ui.pointer.down(0);
const clicked = ui.pointer.clicked(0);

const inRect = (x, y, w, h) => mx >= x && mx < (x + w) && my >= y && my < (y + h);

// Start drag when pressing on knob.
if (!draggingSlider && down && inRect(knobX, knobY, knobW, knobH)) {
  draggingSlider = true;
}

// Stop drag on mouse up.
if (draggingSlider && !down) {
  draggingSlider = false;
}

// Drag updates volume.
if (draggingSlider) {
  const rel = Math.max(0, Math.min(1, (mx - trackX - knobW / 2) / (trackW - knobW)));
  const next = Math.round(rel * 100);
  if (next !== volume) {
    volume = next;
  }
}

// Click on track jumps volume.
if (clicked && inRect(trackX, knobY, trackW, knobH)) {
  const rel = Math.max(0, Math.min(1, (mx - trackX) / trackW));
  volume = Math.round(rel * 100);
}

// Title reflects slider value.
titleText = `Immediate WebGPU UI Demo (Storie)  |  Volume: ${volume}`;
```

```js on:render
// Clear the UI layer each frame. Use the theme default background so the demo
// is always visibly painting even if the terminal layer is empty.
const base = getStyle('default');
ui.clear(base.bg);

// Optional: keep the terminal clear so it doesn't fight the UI.
term.clear();

const cw = ui.metrics.charWidth || 10;
const ch = ui.metrics.charHeight || 16;

const x0 = 2 * cw;

// Title
ui.text(titleText || 'Immediate WebGPU UI Demo (Storie)', x0, 1 * ch, ui.colors.rgb(240, 240, 240));

// The button/checkbox/slider are drawn by calling ui.* in update.
// For immediate-mode UI, we re-emit draw calls every frame here.

// Re-draw button
ui.button('btn', 2 * cw, 3 * ch, 26 * cw, 3 * ch, 'Click Me');

// Re-draw checkbox
ui.button('chk', 2 * cw, 7 * ch, 40 * cw, 1 * ch, enabled ? '[✓] Enable Feature' : '[ ] Enable Feature');

// Slider label
ui.text(`Volume`, 2 * cw, 9 * ch, ui.colors.rgb(210, 210, 210));

// Slider track + knob
const trackX = 2 * cw;
const trackY = 10 * ch + Math.floor(ch / 2);
const trackW = 30 * cw;
const knobW = Math.max(8, cw);
const knobH = ch;
const t = volume / 100;
const knobX = trackX + Math.floor((trackW - knobW) * t);

ui.rect(trackX, trackY, trackW, 2, ui.colors.rgb(120, 120, 120));
ui.rect(knobX, 10 * ch, knobW, knobH, ui.colors.rgb(100, 200, 255));
ui.text(`${volume}`, trackX + trackW + cw, 10 * ch, ui.colors.rgb(200, 200, 200));

// Status
ui.text(lastStatus || 'Status: Ready', x0, 13 * ch, ui.colors.rgb(220, 220, 220));

// Debug line in terminal (cell space)
term.write(2, termHeight - 2, `Pointer(px): (${ui.pointer.x()},${ui.pointer.y()})  ${lastEvent || ''}`);
```
