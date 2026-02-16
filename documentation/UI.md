# User Interface Systems in S|torie

S|torie provides multiple approaches to building user interfaces, from low-level immediate-mode drawing to high-level retained-mode widget systems. Choose the approach that best fits your needs and development style.

## UI Paradigms

### Immediate Mode

**Immediate mode** means you draw and handle events manually every frame. This gives you maximum control and flexibility, but requires more code for common UI patterns.

**When to use:**
- Custom UI designs that don't fit standard widgets
- Performance-critical rendering where you need fine control
- Simple UIs with just a few interactive elements
- Learning and prototyping

**Helpers provided:**
- `ui.rect()` - Draw rectangles
- `ui.text()` - Draw text
- `ui.image()` - Draw images (WebGPU only)
- `ui.button()` - Helper for button hit testing and rendering
- `ui.clear()` - Clear the UI layer
- `ui.pointer` - Mouse position and button state
- `ui.metrics` - Canvas dimensions and character metrics
- `ui.colors` - Color utilities (rgb, rgba, from)

**Demo:** [gui_immediate_basic.md](docs/demos/gui_immediate_basic.md)

### Retained Mode

**Retained mode** uses a widget system where you create UI elements once (during initialization), then the system handles rendering and input routing automatically. Widgets maintain their own state and provide simple APIs to query interactions.

**When to use:**
- Building complex UIs with many interactive elements
- Standard forms with buttons, checkboxes, sliders, etc.
- Faster development with less boilerplate
- Focus management and keyboard navigation

**Widgets automatically handle:**
- Hover states and visual feedback
- Mouse click detection
- Keyboard focus and navigation (TAB, SHIFT+TAB)
- State management (checked, value, etc.)
- Rendering (you just clear layers each frame)

## TUI - Terminal User Interface (Text-Based)

**Coordinate System:** Cell-based (terminal columns and rows)

The TUI system provides retained-mode widgets rendered using terminal characters. Perfect for retro interfaces, ASCII art, or terminal-style games.

### Available Widgets

- **Label** - Static or dynamic text display
- **Button** - Clickable buttons with hover states
- **Checkbox** - Toggle switches with labels
- **Slider** - Value selectors with drag interaction

### API

```javascript
// Initialize the TUI system (call in on:init)
tui.init();

// Create widgets (bounds in terminal cells)
const button = tui.createButton({
  bounds: { x: 2, y: 3, width: 20, height: 3 },
  label: 'Click Me'
});

const checkbox = tui.createCheckbox({
  bounds: { x: 2, y: 7, width: 30, height: 1 },
  label: 'Enable Feature',
  checked: false
});

const slider = tui.createSlider({
  bounds: { x: 2, y: 9, width: 30, height: 3 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50
});

const label = tui.createLabel({
  bounds: { x: 2, y: 1, width: 50, height: 1 },
  text: 'Status: Ready'
});
```

### Input Handling

```javascript
// In on:input block
if (event.type === 'keydown') {
  tui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'mouse' || event.type === 'mouse_move') {
  const mouseDown = event.type === 'mouse' && event.action === 'press';
  tui.handleMouse(getMouseCellX(), getMouseCellY(), mouseDown);
}
```

### Querying Widget State

```javascript
// In on:update block
if (button.wasClicked()) {
  console.log('Button clicked!');
}

if (checkbox.isChecked()) {
  console.log('Checkbox is enabled');
}

const volume = slider.getValue(); // 0-100

// Update widget state
label.setText('New status text');
checkbox.setChecked(true);
slider.setValue(75);
```

### Rendering

```javascript
// In on:update (after input routing)
tui.update(getMouseCellX(), getMouseCellY(), mouseDownLeft);

// In on:render
term.clear();  // TUI widgets render to terminal automatically
tui.render();  // Draws all widgets
```

**Demo:** [tui_basic.md](docs/demos/tui_basic.md)

## GUI - Graphical User Interface (Pixel-Based)

**Coordinate System:** Pixel-based (absolute screen coordinates)

The GUI system provides retained-mode widgets rendered using WebGPU primitives (rectangles and text). Perfect for modern game UIs with mouse interaction.

### Available Widgets

- **Label** - Text display with alignment options
- **Button** - Pixel-based clickable buttons
- **Checkbox** - Graphical toggle switches
- **Slider** - Draggable value sliders

### API

```javascript
// Initialize the GUI system (call in on:init)
gui.init();

// Create widgets (bounds in pixels)
const button = gui.createButton({
  bounds: { x: 20, y: 80, width: 260, height: 50 },
  label: 'Click Me'
});

const checkbox = gui.createCheckbox({
  bounds: { x: 20, y: 150, width: 300, height: 30 },
  label: 'Enable Feature',
  checked: false
});

const slider = gui.createSlider({
  bounds: { x: 20, y: 200, width: 400, height: 50 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50
});

const label = gui.createLabel({
  bounds: { x: 20, y: 30, width: 600, height: 30 },
  text: 'GUI Demo',
  align: 'center'
});
```

### Input Handling

```javascript
// In on:input block
if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'mouse' || event.type === 'mouse_move') {
  const mouseDown = event.type === 'mouse' && event.action === 'press';
  gui.handleMouse(getMouseX(), getMouseY(), mouseDown);
}
```

### Querying Widget State

```javascript
// In on:update block
if (button.wasClicked()) {
  console.log('Button clicked!');
}

if (checkbox.isChecked()) {
  console.log('Checkbox is enabled');
}

const volume = slider.getValue(); // 0-100

// Update widget state
label.setText('New status text');
checkbox.setChecked(true);
slider.setValue(75);
```

### Rendering

```javascript
// In on:update (after input routing)
gui.update(getMouseX(), getMouseY(), mouseDownLeft);

// In on:render
term.clear();  // Clear terminal layer
ui.clear();    // Clear UI layer
gui.render();  // GUI widgets render automatically
```

**Demo:** [gui_basic.md](docs/demos/gui_basic.md)

## Immediate-Mode GUI with Helpers

For simpler UIs or when you need precise control, you can use immediate-mode helpers:

```javascript
// In on:update
const clicked = ui.button('btn1', 100, 100, 200, 50, 'Click Me');
if (clicked) {
  console.log('Button clicked!');
}

// Manual drawing
ui.rect(50, 50, 300, 200, [255, 255, 255, 255]);
ui.text('Hello World', 100, 100, [0, 0, 0, 255]);

// In on:render
ui.clear([0, 0, 0, 0]);  // Clear with transparent background
```

**Demo:** [gui_immediate_basic.md](docs/demos/gui_immediate_basic.md)

## Images (WebGPU UI)

The immediate-mode `ui` renderer supports drawing images via GPU textures. Images are identified by opaque string ids.

### Loading images

- `ui.loadImage(url) -> Promise<string|null>` loads an image from a URL, decodes it in the browser, uploads it to the GPU, and returns an id.
- `ui.loadImageFromBlob(name) -> Promise<string|null>` loads an image from an embedded `blob` block (see below) and returns an id.

### Drawing images

`ui.image(imageId, x, y, w, h, options?)` draws a previously-loaded image.

### Auto-loading from embedded blobs

If you pass an `imageId` that isn't registered yet, `ui.image()` will also treat it as a blob name and attempt to load an embedded blob in the background (document-scoped) if:

- a blob exists with that `name`
- its `mime:` starts with `image/` (for example `image/png` or `image/jpeg`)

This lets you write `ui.image('icon', ...)` without manual preloading; the first few frames will no-op until the image finishes decoding/uploading.

### Embedded `blob` blocks (images)

You can embed binary data in markdown using a fenced `blob` block:

```markdown
```blob name:icon mime:image/png enc:base64
...base64...
```
```

Supported encodings:

- `enc:base64` (most common)
- `enc:hex` (useful for compact diffs and copy/paste)

**Demo:** [docs/demos/blob-image.md](docs/demos/blob-image.md)

### Layering note: UI clear can cover the terminal

When using the compositor (terminal + UI layers), the UI layer sits on top. If you clear the UI layer with an opaque color, it will cover the terminal layer.

Use a transparent clear to keep terminal output visible:

```js
// Keep UI layer transparent when you want terminal text visible underneath
ui.clear();
// or
ui.clear([0, 0, 0, 0]);
```

### Magic blocks compatibility

`blob` blocks are extracted after magic expansion, so images embedded via magic-generated markdown work the same way as normal `blob` blocks.

## Mouse Coordinate Helpers

S|torie provides global helpers to access mouse coordinates in different coordinate systems:

```javascript
// Pixel coordinates (for GUI work)
getMouseX()      // X position in pixels
getMouseY()      // Y position in pixels
getMousePixelX() // Alias for getMouseX()
getMousePixelY() // Alias for getMouseY()

// Cell coordinates (for TUI work)
getMouseCellX()  // X position in terminal cells
getMouseCellY()  // Y position in terminal cells

// Terminal dimensions
getTermWidth()   // Terminal width in cells
getTermHeight()  // Terminal height in cells
```

## Comparison Matrix

| Feature | Immediate Mode | TUI Retained | GUI Retained |
|---------|---------------|--------------|--------------|
| **Coordinate System** | Pixels | Cells | Pixels |
| **Rendering** | Manual per frame | Automatic | Automatic |
| **Input Handling** | Manual | Automatic | Automatic |
| **Focus Management** | Manual | Automatic | Automatic |
| **State Management** | Manual | Per-widget | Per-widget |
| **Development Speed** | Slower | Faster | Faster |
| **Control/Flexibility** | Maximum | Standard | Standard |
| **Best For** | Custom UIs | Terminal UIs | Game UIs |

## Best Practices

### Initialization Pattern

```javascript
// Persistent state
let widgets = null;

// on:init - Create widgets once
tui.init(); // or gui.init()
widgets = {
  button: tui.createButton({ /* ... */ }),
  checkbox: tui.createCheckbox({ /* ... */ }),
  // ...
};

// on:input - Route events to widget system
tui.handleKey(event.key, mods);
tui.handleMouse(mouseX, mouseY, mouseDown);

// on:update - Query widget state
tui.update(mouseX, mouseY, mouseDown);
if (widgets.button.wasClicked()) {
  // Handle interaction
}

// on:render - Clear and let widgets render
term.clear();
tui.render();
```

### Coordinate Conversions

```javascript
// Converting between coordinate systems
const cellWidth = ui.metrics.charWidth;
const cellHeight = ui.metrics.charHeight;

// Pixels to cells
const cellX = Math.floor(pixelX / cellWidth);
const cellY = Math.floor(pixelY / cellHeight);

// Cells to pixels
const pixelX = cellX * cellWidth;
const pixelY = cellY * cellHeight;
```

### HiDPI Display Support

S|torie automatically handles HiDPI displays by scaling coordinates correctly. Mouse coordinates (`getMouseX()`, `getMouseY()`) are always in backing store pixels, which works correctly with both TUI and GUI systems.

## Examples

- **[tui_basic.md](docs/demos/tui_basic.md)** - Retained-mode TUI with buttons, checkboxes, and sliders
- **[gui_basic.md](docs/demos/gui_basic.md)** - Retained-mode GUI with pixel-based widgets
- **[gui_immediate_basic.md](docs/demos/gui_immediate_basic.md)** - Immediate-mode GUI with manual drawing

## Architecture

The retained-mode systems are built on top of immediate-mode primitives:

```
┌─────────────────────────────────────┐
│  Retained-Mode Widget Systems       │
│  (TUI / GUI)                        │
├─────────────────────────────────────┤
│  Input Router & Widget Manager      │
├─────────────────────────────────────┤
│  Immediate-Mode Rendering           │
│  (term.*, ui.*)                     │
├─────────────────────────────────────┤
│  WebGPU Renderer                    │
└─────────────────────────────────────┘
```

You can mix immediate and retained modes in the same application - for example, using retained-mode widgets for standard UI elements while manually drawing custom visualizations.
