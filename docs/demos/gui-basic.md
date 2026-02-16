---
name: "Retained GUI Demo (Storie)"
theme: "neonopia"
shaders: "invert+paper"
---

A demo showing retained-mode graphical UI widgets with mouse and keyboard input.

**Keyboard Controls:**
- **TAB / SHIFT+TAB**: Navigate focus through widgets
- **ENTER / SPACE**: Activate focused widget (button/checkbox)
- **LEFT / RIGHT**: Adjust slider (when focused)

## Game Code

```js
// Persistent state - automatically available in all lifecycle blocks
let clickCount = 0;
let lastEvent = '';
let mouseDownLeft = false;

// Widget references (initialized in on:init)
let widgets = null;

// Debug: Track GUI system state
let guiInitialized = false;
```

```js on:init
term.layerID = 'default';

// Initialize the built-in retained-mode GUI system
gui.init();

// Create widgets (using pixel coordinates)
const title = gui.createLabel({
  bounds: { x: 20, y: 30, width: 600, height: 30 },
  text: 'Retained-Mode GUI Demo (Storie)',
  align: 'center'
});

const btn = gui.createButton({
  bounds: { x: 20, y: 80, width: 260, height: 50 },
  label: 'Click Me'
});

const chk = gui.createCheckbox({
  bounds: { x: 20, y: 150, width: 300, height: 30 },
  label: 'Enable Feature',
  checked: false
});

const sld = gui.createSlider({
  bounds: { x: 20, y: 200, width: 400, height: 50 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50
});

const input = gui.createTextField({
  bounds: { x: 20, y: 270, width: 400, height: 44 },
  value: 'Type here',
  placeholder: 'Type here'
});

const status = gui.createLabel({
  bounds: { x: 20, y: 330, width: 600, height: 30 },
  text: 'Status: Ready'
});

const debugLabel = gui.createLabel({
  bounds: { x: 20, y: 370, width: 600, height: 30 },
  text: 'Debug: ...'
});

// Store widget references in persistent state
widgets = { title, btn, chk, sld, input, status, debugLabel };
```

```js on:input
// Storie provides global mouse coordinates: mouseX/mouseY (pixels by default).
// For graphical UI, we use pixel coordinates directly.
if (!event) return;

if (event.type === 'keydown') {
  lastEvent = `key: ${event.key}`;
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'text') {
  lastEvent = `text: ${event.text}`;
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }

  // Use event coordinates for immediate input handling
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}

if (event.type === 'mouse_move') {
  // Use event coordinates for hover state
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}
```

```js on:update
if (!widgets) return;

// Per-frame update keeps widget states consistent
// Use function calls for mouse coordinates
gui.update(getMouseX(), getMouseY(), mouseDownLeft);

// Check for button clicks
if (widgets.btn.wasClicked()) {
  clickCount++;
  widgets.status.setText(`Button clicked ${clickCount} time${clickCount !== 1 ? 's' : ''}!`);
  lastEvent = 'button clicked';
}

// Check for checkbox toggles
if (widgets.chk.wasToggled()) {
  const enabled = widgets.chk.isChecked();
  widgets.status.setText(`Feature ${enabled ? 'enabled' : 'disabled'}`);
  lastEvent = `checkbox ${enabled ? 'checked' : 'unchecked'}`;
}

// Read slider value
const volume = widgets.sld.getValue();

if (widgets.input.wasChanged()) {
  widgets.status.setText(`Input = "${widgets.input.getValue()}"`);
}

// Check if mouse is over button (for debugging)
const btnBounds = widgets.btn.bounds;
const mx = getMouseX();
const my = getMouseY();
const overBtn = mx >= btnBounds.x && mx < (btnBounds.x + btnBounds.width) &&
                my >= btnBounds.y && my < (btnBounds.y + btnBounds.height);

// Update debug display
widgets.debugLabel.setText(
  `Frame ${getFrame()} | Mouse: (${mx.toFixed(0)}, ${my.toFixed(0)}) | Over: ${overBtn} | Hover: ${widgets.btn.state.hovered} | Vol: ${Math.round(volume)}`
);
```

```js on:render
// Clear the UI layer each frame
const base = getStyle('default');
ui.clear(base.bg);

// Render terminal background every frame
term.layerID = 'default';
term.clear();

// Draw a simple background
term.write(0, 0, "═".repeat(termWidth));
term.write(0, termHeight - 1, "═".repeat(termWidth));

// Retained-mode GUI renders automatically!
// The gui.render() call happens automatically in the engine,
// compositing the UI layer on top of the terminal layer.
```

## Notes

### Retained vs Immediate Mode

**Retained Mode** (this demo):
- Widgets created once in `on:init`
- State persists automatically
- Query state with `.wasClicked()`, `.getValue()`, etc.
- Visual updates handled automatically
- Focus, hover, and keyboard navigation built-in

**Immediate Mode** (see `ui_immediate.md`):
- UI recreated every frame in `on:update`
- Manual state tracking required
- Returns interaction state immediately
- More control but more boilerplate
- No built-in focus or keyboard navigation

### Coordinate Systems

GUI widgets use **pixel coordinates** for bounds:
```js-example
// Pixel-based (for graphical UI)
gui.createButton({ 
  bounds: { x: 100, y: 50, width: 200, height: 40 }
});
```

TUI widgets use **cell coordinates** for bounds:
```js-example
// Cell-based (for terminal UI)
tui.createButton({ 
  bounds: { x: 10, y: 5, width: 20, height: 3 }
});
```

### Global Mouse Coordinates

Storie provides convenient global accessors:
- `mouseX` / `mouseY` - Pixel coordinates (default, matches event.x/event.y)
- `mouseCellX` / `mouseCellY` - Terminal cell coordinates
- `mousePixelX` / `mousePixelY` - Explicit aliases for pixel coordinates

Use pixel coordinates for GUI work, cell coordinates for TUI work.
