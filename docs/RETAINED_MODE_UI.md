# Retained-Mode UI System for Storie

## Overview

Storie provides a robust **retained-mode UI framework** inspired by tStorie's `tui.nim` module. The system offers a clean separation between core UI abstractions and rendering backends, supporting both **TUI (Terminal UI)** and **GUI (Graphical UI)** implementations.

## Architecture

```
┌─────────────────────────────────────────────┐
│  User Code (JavaScript in markdown)        │
│  - Declares widgets once in on:init        │
│  - Queries state in on:update              │
│  - Automatic rendering                     │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│  Widget API (Unified Interface)            │
│  - Button, Label, Checkbox, Slider         │
│  - wasClicked(), isHovered(), getValue()   │
└─────────────────────────────────────────────┘
            ↓                   ↓
┌──────────────────┐  ┌──────────────────────┐
│   TUI System     │  │   GUI System         │
│   (Terminal)     │  │   (Canvas/WebGPU)    │
│   ✓ Implemented  │  │   🔨 Coming Soon     │
└──────────────────┘  └──────────────────────┘
            ↓                   ↓
┌──────────────────┐  ┌──────────────────────┐
│  Core Framework  │  │  Core Framework      │
│  - BaseWidget    │  │  - BaseWidget        │
│  - WidgetManager │  │  - WidgetManager     │
│  - InputRouter   │  │  - InputRouter       │
└──────────────────┘  └──────────────────────┘
```

## Core Concepts

### 1. **Retained vs Immediate Mode**

**Immediate Mode** (what users would write without this system):
```javascript
// ❌ Inefficient: Recreate UI every frame
function render() {
  if (drawButton(x, y, "Click Me")) {
    // Handle click
  }
}
```

**Retained Mode** (with TUI/UI system):
```javascript
// ✅ Efficient: Declare once, query state
let myButton;

function init() {
  myButton = tui.createButton({
    id: 'btn1',
    bounds: { x: 10, y: 5, width: 20, height: 3 },
    label: 'Click Me'
  });
}

function update() {
  if (myButton.wasClicked()) {
    // Handle click
  }
}

function render() {
  tui.render(buffer); // Automatic
}
```

### 2. **Core Abstractions**

All UI systems share these core components:

- **`BaseWidget`**: Base class for all widgets with common state (bounds, visibility, focus, hover)
- **`WidgetManager`**: Central registry managing widget lifecycle, groups, and z-ordering
- **`InputRouter`**: Distributes mouse/keyboard input to appropriate widgets
- **`WidgetState`**: Tracks interactive states (visible, enabled, hovered, focused, pressed)

### 3. **Widget Lifecycle**

```
Create → Register → Update → Render → Destroy
   ↓         ↓         ↓         ↓        ↓
 new()    manager   input     draw    unregister()
```

## TUI System (Terminal UI)

### Available Widgets

#### **Button**
Interactive button with box-drawing border
```typescript
const btn = tui.createButton({
  bounds: { x: 10, y: 5, width: 20, height: 3 },
  label: 'Click Me',
  group: 0 // Optional group for visibility management
});

// Query state
if (btn.wasClicked()) {
  console.log('Button clicked!');
}

if (btn.state.hovered) {
  console.log('Mouse over button');
}

// Update label
btn.setLabel('New Label');
```

**Note:** The `id` field is optional. If not provided, a unique ID is auto-generated internally.

#### **Label**
Static text display
```typescript
const lbl = tui.createLabel({
  bounds: { x: 5, y: 2, width: 30, height: 1 },
  text: 'My Application',
  align: 'center' // 'left', 'center', 'right'
});

// Update text
lbl.setText('Updated Title');
```

#### **Checkbox**
Toggle control with label
```typescript
const chk = tui.createCheckbox({
  bounds: { x: 10, y: 10, width: 20, height: 1 },
  label: 'Enable sound',
  checked: true
});

// Query state
if (chk.wasToggled()) {
  console.log('Checkbox toggled:', chk.isChecked());
}

// Set programmatically
chk.setChecked(false);
```

#### **Slider**
Draggable value control
```typescript
const slider = tui.createSlider({
  bounds: { x: 10, y: 15, width: 30, height: 3 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 50,
  step: 1
});

// Get value
const volume = slider.getValue();

// Set value
slider.setValue(75);
```

### Input Handling

#### Mouse Input
The TUI system automatically handles mouse input:
```javascript
// In your update loop
tui.update(mouseX, mouseY, mouseDown, gridWidth, gridHeight);
```

#### Keyboard Navigation
Built-in keyboard navigation support:
- **Tab**: Focus next widget
- **Shift+Tab**: Focus previous widget
- **Arrow Keys**: Navigate between widgets
- **Enter/Space**: Activate focused widget

```javascript
// In your input handler
tui.handleKey(key, { shift: false, ctrl: false, alt: false });
```

### Widget Groups

Organize widgets into groups for visibility management:
```javascript
// Create widgets in different groups
const menuBtn = tui.createButton({ bounds: {...}, label: 'Menu', group: 0 });
const settingsBtn = tui.createButton({ bounds: {...}, label: 'Settings', group: 1 });

// Toggle group visibility
tui.setGroupVisible(1, false); // Hide all group 1 widgets
```

### Styling

Widgets support theming via style objects:
```typescript
const btn = tui.createButton({
  bounds: { x: 10, y: 5, width: 20, height: 3 },
  label: 'Styled',
  style: {
    fg: ColorUtils.rgb(255, 255, 0),    // Yellow text
    bg: ColorUtils.rgb(0, 50, 50),      // Dark teal background
    accentColor: ColorUtils.rgb(0, 200, 255), // Cyan accent
    hoverStyle: {
      fg: ColorUtils.rgb(255, 255, 255)  // White when hovered
    },
    focusStyle: {
      fg: ColorUtils.rgb(255, 200, 0)    // Gold when focused
    }
  }
});
```

## Complete Example

```javascript
// TUI Demo
let tui;
let startButton, quitButton;
let soundCheckbox, musicCheckbox;
let volumeSlider;
let titleLabel, statusLabel;

function init() {
  // Initialize TUI system (assuming renderer is available)
  tui = new TUISystem(renderer);
  
  // Create title
  titleLabel = tui.createLabel({
    id: 'title',
    bounds: { x: 5, y: 2, width: 70, height: 1 },
    text: 'TUI Demo Application',
    align: 'center'
  });
  
  // Create buttons
  startButton = tui.createButton({
    id: 'start',
    bounds: { x: 10, y: 5, width: 20, height: 3 },
    label: 'Start Game',
    group: 0
  });
  
  quitButton = tui.createButton({
    id: 'quit',
    bounds: { x: 10, y: 9, width: 20, height: 3 },
    label: 'Quit',
    group: 0
  });
  
  // Create checkboxes
  soundCheckbox = tui.createCheckbox({
    id: 'sound',
    bounds: { x: 40, y: 5, width: 25, height: 1 },
    label: 'Sound Effects',
    checked: true
  });
  
  musicCheckbox = tui.createCheckbox({
    id: 'music',
    bounds: { x: 40, y: 7, width: 25, height: 1 },
    label: 'Background Music',
    checked: false
  });
  
  // Create slider
  volumeSlider = tui.createSlider({
    id: 'volume',
    bounds: { x: 40, y: 10, width: 30, height: 3 },
    label: 'Volume',
    min: 0,
    max: 100,
    value: 50
  });
  
  // Create status label
  statusLabel = tui.createLabel({
    id: 'status',
    bounds: { x: 5, y: 20, width: 70, height: 1 },
    text: 'Ready',
    align: 'left'
  });
}

function update(delta) {
  // Update TUI with mouse input
  const mousePressed = input.isMouseDown(0);
  tui.update(input.mouseX, input.mouseY, mousePressed, 80, 24);
  
  // Check button clicks
  if (startButton.wasClicked()) {
    statusLabel.setText('Game started!');
  }
  
  if (quitButton.wasClicked()) {
    statusLabel.setText('Goodbye!');
  }
  
  // Check checkbox toggles
  if (soundCheckbox.wasToggled()) {
    const enabled = soundCheckbox.isChecked();
    statusLabel.setText(`Sound: ${enabled ? 'ON' : 'OFF'}`);
  }
  
  if (musicCheckbox.wasToggled()) {
    const enabled = musicCheckbox.isChecked();
    statusLabel.setText(`Music: ${enabled ? 'ON' : 'OFF'}`);
  }
  
  // Get slider value
  const volume = volumeSlider.getValue();
  // Use volume value...
}

function render() {
  // Clear buffer
  clearBuffer(buffer);
  
  // Render all TUI widgets automatically
  tui.render(buffer);
}

function onKey(key, modifiers) {
  // Handle keyboard navigation
  tui.handleKey(key, modifiers);
}
```

## Future: GUI System

The same architecture will support graphical rendering:

```javascript
// Coming soon
const gui = new GUISystem(canvasContext);

const btn = gui.createButton({
  id: 'fancy',
  bounds: { x: 100, y: 100, width: 200, height: 50 },
  label: 'Fancy Button',
  style: {
    borderRadius: 8,
    gradient: true,
    font: '16px Arial'
  }
});
```

## Benefits Over Immediate Mode

1. **Performance**: Widgets only redraw when state changes
2. **State Management**: Widget state persists between frames
3. **Input Handling**: Automatic hover/focus/click detection
4. **Keyboard Navigation**: Built-in tab navigation and focus management
5. **Scalability**: Easy to add complex widgets (trees, menus, dialogs)
6. **Consistency**: Unified API across TUI and GUI
7. **Debugging**: Widgets can be inspected and modified at runtime

## API Reference

See individual widget files for complete API:
- `src/ui/tui/button.ts`
- `src/ui/tui/label.ts`
- `src/ui/tui/checkbox.ts`
- `src/ui/tui/slider.ts`

Core framework:
- `src/ui/core/base-widget.ts`
- `src/ui/core/widget-manager.ts`
- `src/ui/core/input-router.ts`
