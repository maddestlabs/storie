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
// Persistent state - automatically available in all lifecycle blocks
let clickCount = 0;
let lastEvent = '';
let mouseDownLeft = false;

// Widget references (initialized in on:init)
let widgets = null;
```

```js on:init
term.layerID = 'default';

// Initialize the built-in retained-mode TUI system.
tui.init();

// Create widgets
const title = tui.createLabel({ bounds: { x: 2, y: 1, width: 70, height: 1 }, text: 'TUI Widgets Demo (Storie)' });
const btn = tui.createButton({ bounds: { x: 2, y: 3, width: 26, height: 3 }, label: 'Click Me' });
const chk = tui.createCheckbox({ bounds: { x: 2, y: 7, width: 40, height: 1 }, label: 'Enable Feature' });
const sld = tui.createSlider({
  bounds: { x: 2, y: 9, width: 30, height: 3 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50
});
const status = tui.createLabel({ bounds: { x: 2, y: 13, width: 80, height: 1 }, text: 'Status: Ready' });

// Store widget references in persistent state
widgets = { title, btn, chk, sld, status };
```

```js on:input
// Storie provides global mouse coordinates: getMouseX()/getMouseY() (pixels), getMouseCellX()/getMouseCellY() (cells).
// For TUI work, we use cell coordinates.
if (!event) return;

if (event.type === 'keydown') {
  lastEvent = `key: ${event.key}`;
  tui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }

  // Route immediately so fast clicks can't be missed between frames.
  tui.handleMouse(getMouseCellX(), getMouseCellY(), mouseDownLeft);
}

if (event.type === 'mouse_move') {
  // Keep hover state responsive.
  tui.handleMouse(getMouseCellX(), getMouseCellY(), mouseDownLeft);
}
```

```js on:update
if (!widgets) return;

// Per-frame update keeps slider drag/hover consistent even without mouse_move events.
// Use cell coordinates for TUI widgets
const termW = getTermWidth();
const termH = getTermHeight();
tui.update(getMouseCellX(), getMouseCellY(), mouseDownLeft, termW, termH);

if (widgets.btn.wasClicked()) {
  clickCount++;
  widgets.status.setText(`Status: Clicked ${clickCount} time(s)`);
}

if (widgets.chk.wasToggled()) {
  const checkedState = widgets.chk.isChecked() ? 'enabled' : 'disabled';
  widgets.status.setText(`Status: Feature ${checkedState}`);
}

// Keep title showing slider value.
const volume = widgets.sld.getValue();
widgets.title.setText(`TUI Widgets Demo (Storie)  |  Volume: ${volume}`);
```

```js on:render
term.clear();
tui.render();

// Display mouse/input debug info (using cell coordinates for terminal display)
const leftState = mouseDownLeft ? 'down' : 'up';
const debugText = `Mouse: cell(${getMouseCellX()},${getMouseCellY()}) pixel(${Math.floor(getMouseX())},${Math.floor(getMouseY())}) ${leftState}  ${lastEvent}`;
term.write(2, getTermHeight() - 2, debugText);
```
