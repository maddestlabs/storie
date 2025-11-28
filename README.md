# Backstorie
Nim-based engine for building terminal apps and games, with support for both native and WebAssembly targets.

## Features

- **Cross-Platform** - Runs natively in terminals and in web browsers via WebAssembly
- **Modular Architecture** - Platform-specific code cleanly separated for easy maintenance
- **Reusable Libraries** - Helper modules for events, animations, and UI components
- **Input Handling** - Comprehensive keyboard, mouse, and special key support
- **Color Support** - True color (24-bit), 256-color, and 8-color terminal support
- **Layer System** - Z-ordered layers with transparency support
- **Automatic Terminal Resize Handling** - All layers automatically resize when the terminal or browser window changes size
- **Direct Callback Architecture** - Simple onInit/onUpdate/onRender callback system

## Quick Start

### Native Terminal Apps

#### Using the Run Script (Recommended)

With Nim installed, the easiest way to run backstorie with different example files:

```bash
# Run using index.nim
./build.sh

# Run a specific example
./build.sh events_core
./build.sh events_advanced

# Compile in release mode (optimized)
./build.sh -r boxes

# Compile only
./build.sh -c boxes

# Show help
./build.sh --help
```

#### Direct Compilation

You can also compile directly with nim:

```bash
# Compile and run with default index.nim
nim c -r backstorie.nim

# Compile and run with a specific file
nim c -r -d:userFile=examples/boxes backstorie.nim

# Show help
nim c -r backstorie.nim --help
```

### WebAssembly (Browser)

Compile your Backstorie apps to run in the browser:

```bash
# Compile to WASM
./build-web.sh boxes

# Compile and serve locally
./build-web.sh -s boxes

# Deploy to GitHub Pages
./build-web.sh -o docs -r boxes
```

See detailed guides:
- [WASM_GUIDE.md](docs/WASM_GUIDE.md) - Compilation and deployment
- [GITHUB_PAGES.md](docs/GITHUB_PAGES.md) - Deploy to GitHub Pages

## Creating Your Own App

1. Simply edit index.nim. Or create a `.nim` file (e.g., `myapp.nim`)
2. Optionally import helper libraries and define callbacks:

```nim
# Import helper libraries (optional)
import lib/events
import lib/ui_components
import lib/animation

# Create your app state
var myText = "Hello, World!"
var myAnimation = newAnimation(2.0, loop = true)

onInit = proc(state: AppState) =
  # Initialize your app
  echo "App started!"

onUpdate = proc(state: AppState, dt: float) =
  # Update animations, game logic, etc.
  myAnimation.update(dt)

onRender = proc(state: AppState) =
  # Draw using helper functions or directly
  drawBox(state, 10, 5, 40, 10, defaultStyle(), "My App")
  state.currentBuffer.writeText(12, 7, myText, defaultStyle())

onInput = proc(state: AppState, event: InputEvent): bool =
  # Handle input events
  if event.kind == KeyEvent and event.keyCode == ord('q'):
    state.running = false
    return true
  return false

onShutdown = proc(state: AppState) =
  echo "App shutting down"
```

3. Run it:

```bash
./build.sh myapp
```

or compile directly:

```bash
nim c -r -d:userFile=myapp backstorie.nim
```

## Helpful Examples

- `index.nim` - Default simple demo
- [examples/boxes.nim](https://github.com/maddestlabs/Backstorie/blob/main/examples/boxes.nim) - Animated bouncing boxes with layers
- [examples/counter.nim](https://github.com/maddestlabs/Backstorie/blob/main/examples/counter.nim) - Basic frame counter
- [examples/events_core.nim](https://github.com/maddestlabs/Backstorie/blob/main/examples/events_core.nim) - Core event handling demo
- [examples/events_advanced.nim](https://github.com/maddestlabs/Backstorie/blob/main/examples/events_advanced.nim) - More complex event system usage

## Helper Libraries

- `lib/events.nim` - Robust event handling with callbacks
- `lib/animation.nim` - Easing functions, interpolation, particles
- `lib/ui_components.nim` - Reusable UI elements (boxes, buttons, progress bars)

See [LIBRARY_GUIDE.md](LIBRARY_GUIDE.md) for detailed usage instructions and examples.

## Engine Internals

- `src/platform/terminal.nim` - Platform dispatcher for terminal operations
- `src/platform/platform_posix.nim` - POSIX implementation (Linux, macOS, BSD)
- `src/platform/platform_win.nim` - Windows implementation

## Platform Notes

- **Linux/macOS/BSD**: Native POSIX support with optimized terminal operations
- **Windows**: Performance struggles a bit on Windows natively. WSL provides a speedier experience.
- **Browser**: Full WebAssembly support with canvas rendering (works on all platforms)
