---
name: "TUI Widgets Demo (Storie)"
theme: "solarlight"
shaders: "ruledlines+paper"
---

A demo showing retained-mode TUI widgets with both keyboard and mouse input in Storie.

**Keyboard Controls:**
- **TAB / SHIFT+TAB**: Navigate focus through widgets
- **ENTER / SPACE**: Activate focused widget (button/checkbox)

## Game Code

```js
// Shared state lives on `scope` (persistent across lifecycle blocks).
scope.state = scope.state || {
  clickCount: 0,
  lastEvent: '',
  mouseX: 0,
  mouseY: 0,
  mouseDownLeft: false
};

scope.widgets = scope.widgets || null;
```

```js on:init
term.layerID = 'default';

// Initialize the built-in retained-mode TUI system.
tui.init();

// Create widgets.
const title = tui.createLabel({
  id: 'title',
  bounds: { x: 2, y: 1, width: 70, height: 1 },
  text: 'TUI Widgets Demo (Storie)',
  align: 'left'
});

const btn = tui.createButton({
  id: 'btn',
  bounds: { x: 2, y: 3, width: 26, height: 3 },
  label: 'Click Me'
});

const chk = tui.createCheckbox({
  id: 'chk',
  bounds: { x: 2, y: 7, width: 40, height: 1 },
  label: 'Enable Feature',
  checked: true
});

const sld = tui.createSlider({
  id: 'sld',
  bounds: { x: 2, y: 9, width: 30, height: 3 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50
});

const status = tui.createLabel({
  id: 'status',
  bounds: { x: 2, y: 13, width: 80, height: 1 },
  text: 'Status: Ready',
  align: 'left'
});

scope.widgets = { title, btn, chk, sld, status };
```

```js on:input
// Storie passes an `event` object into on:input blocks.
// For mouse events, event.x/event.y are terminal *cell* coordinates (not pixels).
const st = scope.state || (scope.state = {
  clickCount: 0,
  lastEvent: '',
  mouseX: 0,
  mouseY: 0,
  mouseDownLeft: false
});
if (!event || !st) return;

if (event.type === 'keydown') {
  st.lastEvent = `key: ${event.key}`;
  tui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'mouse') {
  st.mouseX = event.x ?? st.mouseX;
  st.mouseY = event.y ?? st.mouseY;
  if (event.button === 'left') {
    st.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }

  // Route immediately so fast clicks can't be missed between frames.
  tui.handleMouse(st.mouseX, st.mouseY, st.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  st.mouseX = event.x ?? st.mouseX;
  st.mouseY = event.y ?? st.mouseY;

  // Keep hover state responsive.
  tui.handleMouse(st.mouseX, st.mouseY, st.mouseDownLeft);
}
```

```js on:update
const st = scope.state || (scope.state = {
  clickCount: 0,
  lastEvent: '',
  mouseX: 0,
  mouseY: 0,
  mouseDownLeft: false
});
const w = scope.widgets;
if (!st || !w) return;

// Per-frame update keeps slider drag/hover consistent even without mouse_move events.
tui.update(st.mouseX, st.mouseY, st.mouseDownLeft, getTermWidth(), getTermHeight());

if (w.btn.wasClicked()) {
  st.clickCount++;
  w.status.setText(`Status: Clicked ${st.clickCount} time(s)`);
}

if (w.chk.wasToggled()) {
  w.status.setText(`Status: Feature ${w.chk.isChecked() ? 'enabled' : 'disabled'}`);
}

// Keep title showing slider value.
w.title.setText(`TUI Widgets Demo (Storie)  |  Volume: ${w.sld.getValue()}`);
```

```js on:render
// WebGPU compositor may place Canvas2D above the terminal.
// Clear it to transparent so the terminal remains visible.
canvas2d.clear('rgba(0,0,0,0)');

term.clear();
tui.render();

const st = scope.state;
if (st) {
  term.write(2, getTermHeight() - 2, `Mouse: (${st.mouseX},${st.mouseY}) Left:${st.mouseDownLeft ? 'down' : 'up'}  ${st.lastEvent}`);
}
```
