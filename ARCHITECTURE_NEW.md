# Storie Architecture Guide

## Overview

Storie now has a clean separation between the **engine library** and the **application entry points**:

- **`storie.nim`** - Core engine library (import this to build custom apps)
- **`index.nim`** - Default markdown-based entry point (the "batteries included" experience)
- **Your custom entry** - Build whatever you want!

## File Structure

```
storie.nim           # Engine library - import this
index.nim            # Default markdown entry point
storie_core.nim      # Core types and utilities
platform/            # Platform abstraction (SDL3/Raylib)
src/nimini/          # Nimini scripting language
examples/            # Usage examples
```

## Usage Patterns

### 1. Default Markdown Experience (index.nim)

The classic Storie experience - write Nim code in markdown:

```bash
# Edit index.md with your code blocks
./build.sh
```

**index.md:**
````markdown
# My Creative Sketch

```nim on:render
var x = 100
fillRect(x, 100, 50, 50)
```
````

### 2. Pure Nimini Scripts

Skip markdown, write Nimini directly:

```nim
import storie

const script = """
var x = 100
while true:
  clear()
  fillRect(x, 100, 50, 50)
"""

proc render() =
  discard executeNiminiCode(script)

when isMainModule:
  initStorie(renderCallback = render)
  runStorie()
```

### 3. Pure Nim API

Use Storie as a regular Nim library:

```nim
import storie

var x = 0

proc update() =
  x += 1
  if x > 800: x = 0

proc render() =
  # Draw using Nimini for now
  discard executeNiminiCode("clear(); fillRect(" & $x & ", 100, 50, 50)")

when isMainModule:
  initStorie(
    updateCallback = update,
    renderCallback = render
  )
  runStorie()
```

### 4. Load Nimini from Files

```nim
import storie, os

let script = readFile("my_sketch.nimini")

proc render() =
  discard executeNiminiCode(script)

when isMainModule:
  initStorie(renderCallback = render)
  runStorie()
```

## API Reference

### Initialization

```nim
proc initStorie*(
  width: int = 800,
  height: int = 600,
  title: string = "Storie",
  enable3D: bool = false,
  targetFps: float = 60.0,
  updateCallback: UpdateCallback = nil,
  renderCallback: RenderCallback = nil,
  inputCallback: InputCallback = nil,
  shutdownCallback: ShutdownCallback = nil
)
```

### Main Loop

```nim
proc runStorie*()
  ## Run the main loop (blocking call)

proc stopEngine*()
  ## Stop the engine gracefully

proc shutdownStorie*()
  ## Clean up resources
```

### State Queries

```nim
proc getFrameCount*(): int
proc getFps*(): float
proc getWidth*(): int
proc getHeight*(): int
proc isRunning*(): bool
```

### Execute Nimini Code

```nim
proc executeNiminiCode*(code: string): bool
  ## Execute Nimini code in the global context
  ## Returns true on success, false on error
```

## Callback Types

```nim
type
  UpdateCallback* = proc() {.closure.}
  RenderCallback* = proc() {.closure.}
  InputCallback* = proc() {.closure.}
  ShutdownCallback* = proc() {.closure.}
```

## Building

### Native Build

```bash
./build.sh              # Uses index.nim (markdown)
./build.sh --compile-only
```

### Custom Entry Point

```bash
# Compile your own entry point
nim c --passL:"build/vendor/raylib-build/raylib/libraylib.a" \
      --passL:"-lm -lpthread -ldl -lrt -lX11" \
      my_app.nim
```

### Web Build

```bash
./build-web.sh          # Uses index.nim
```

## Examples

See the `examples/` directory:

- `pure_nimini.nim` - Using Nimini scripts without markdown
- `pure_nim.nim` - Using pure Nim with the engine
- Other examples showing various patterns

## Why This Design?

1. **Flexibility** - Users can choose their preferred workflow
2. **Simplicity** - Beginners get markdown, advanced users get full control
3. **Library First** - Storie is now a proper library, not just an app
4. **Extensibility** - Easy to build tools on top of Storie

## Migration from Old Code

If you have existing code using `storie.nim` as the entry point:

1. Rename your usage to `index.nim` or
2. Import `storie` and use the new API pattern
3. Update build scripts to point to your entry file

The engine functionality is unchanged - only the entry point architecture improved!
