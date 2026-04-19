---
name: "Retained GUI Demo (Storie)"
theme: "nord"
shaders: "paper+invert"
authoringCheck: explicit-conditionals
---

A demo showing retained-mode graphical UI widgets with mouse and keyboard input.

**Keyboard Controls:**
- **TAB / SHIFT+TAB**: Navigate focus through widgets
- **ENTER / SPACE**: Activate focused widget (button/checkbox)
- **LEFT / RIGHT**: Adjust slider (when focused)

## Game Code

```js
// Preferred persistent pattern: keep shared demo state in one object.
var state = {
  clickCount: 0,
  featureEnabled: false,
  volume: 50,
  text: 'Type here\nSecond line'
};
```

```js on:init
term.layerID = 'default';

gui.screen({
  input: 'auto',
  update: 'auto',
  state,
  layout: {
    type: 'panel',
    insetX: 'lg',
    insetTop: 'xl',
    insetBottom: 'lg',
    maxWidth: 640,
    padding: 0,
    rowGap: 'md',
    alignX: 'stretch',
    anchorX: 'start',
    anchorY: 'start'
  },
  widgets: {
    title: {
      type: 'label',
      bounds: { height: 30 },
      text: 'Retained-Mode GUI Demo (Storie)',
      align: 'center'
    },
    click: {
      type: 'button',
      bounds: { height: 50 },
      label: 'Click Me',
      onClick() {
        state.clickCount++;
        var suffix = '';
        if (state.clickCount !== 1) suffix = 's';
        gui.text('status', `Button clicked ${state.clickCount} time${suffix}!`);
      }
    },
    feature: {
      type: 'checkbox',
      bounds: { height: 30 },
      label: 'Enable Feature',
      checked: state.featureEnabled,
      bind: 'featureEnabled',
      onToggle() {
        var featureStatus = 'disabled';
        if (state.featureEnabled) featureStatus = 'enabled';
        gui.text('status', `Feature ${featureStatus}`);
      }
    },
    volume: {
      type: 'slider',
      bounds: { height: 50 },
      label: 'Volume',
      min: 0,
      max: 100,
      value: state.volume,
      bind: 'volume'
    },
    input: {
      type: 'editor',
      bounds: { height: 120 },
      value: state.text,
      placeholder: 'Type here',
      bind: 'text',
      onChange() {
        const safe = String(state.text).replace(/\n/g, '\\n');
        gui.text('status', `Input = "${safe}"`);
      }
    },
    status: {
      type: 'label',
      bounds: { height: 30 },
      text: 'Status: Ready'
    },
    debug: {
      type: 'label',
      bounds: { height: 30 },
      text: 'Debug: ...'
    }
  }
});
```

```js on:update
const btn = gui.get('click');

if (!btn) return;

// Check if mouse is over button (for debugging)
const btnBounds = btn.bounds;
const mx = getMouseX();
const my = getMouseY();
const overBtn = mx >= btnBounds.x && mx < (btnBounds.x + btnBounds.width) &&
                my >= btnBounds.y && my < (btnBounds.y + btnBounds.height);

// Update debug display
gui.text('debug', `Frame ${getFrame()} | Mouse: (${mx.toFixed(0)}, ${my.toFixed(0)}) | Over: ${overBtn} | Hover: ${btn.state.hovered} | Vol: ${Math.round(Number(state.volume) || 0)}`);
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
- Widgets created once in `on:init`, here via `gui.screen(...)`
- Input routing and per-frame GUI stepping are enabled via `gui.screen({ input: 'auto', update: 'auto', ... })`
- Shared app state lives in one persistent `state` object
- A simple `layout` block can stack and fit screen widgets without per-widget x/y math
- Layout spacing can use GUI token names like `sm`, `md`, `lg`, and `xl`
- Widgets are declared by name and still accessible via `gui.get(...)`, `gui.text(...)`, `gui.value(...)`, and `gui.checked(...)`
- `gui.bind(...)` keeps widget values synchronized with explicit state for common retained controls
- `gui.screen(...)` specs can attach simple `onClick`, `onToggle`, and `onChange` callbacks for common reactions
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
