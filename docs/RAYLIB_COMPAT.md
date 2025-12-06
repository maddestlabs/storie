# Storie Raylib Compatibility Module

This module provides a raylib-compatible API for Storie, making existing raylib and [naylib](https://github.com/planetis-m/raylib-examples) examples work with Storie with minimal changes.

## Features

- ✅ **camelCase naming** - Matches naylib conventions (`initWindow`, `drawCircle`, etc.)
- ✅ **PascalCase colors** - `RayWhite`, `LightGray`, `Red`, etc.
- ✅ **PascalCase keys** - `KeySpace`, `KeyEnter`, `KeyEscape`, etc.
- ✅ **Classic raylib loop** - Manual `while not windowShouldClose()` loop
- ✅ **Drop-in compatibility** - naylib examples work with minimal changes
- 🚧 **SDL3 backend** (planned) - Same code, SDL3 underneath with `-d:sdl3`

## Usage

### Basic Example

```nim
import storie/raylib

initWindow(800, 600, "My Game")
setTargetFPS(60)

while not windowShouldClose():
    beginDrawing()
    clearBackground(RayWhite)
    drawText("Hello World!", 190, 200, 20, LightGray)
    drawCircle(400, 300, 50, Red)
    endDrawing()

closeWindow()
```

### Compilation

```bash
nim c --passL:"build/vendor/raylib-build/raylib/libraylib.a -lm" myapp.nim
```

**Note:** The `-lm` (math library) flag must come after `libraylib.a` due to linking order requirements.

Or use the provided build script:

```bash
cd examples
./build-raylib-demo.sh
```

## Migration from naylib

Most naylib code works with just an import change:

```nim
# Before (naylib)
import raylib

# After (Storie)
import storie/raylib
```

## API Coverage

Currently supported:

### Window Management
- `initWindow`, `closeWindow`, `windowShouldClose`
- `isWindowReady`, `isWindowFullscreen`, `isWindowMinimized`, etc.
- `setWindowTitle`, `setWindowSize`, `setWindowPosition`
- `getScreenWidth`, `getScreenHeight`

### Timing
- `setTargetFPS`, `getFPS`
- `getFrameTime`, `getTime`

### Drawing
- `beginDrawing`, `endDrawing`
- `clearBackground`

### Shapes
- Lines: `drawLine`, `drawLineV`, `drawLineEx`
- Circles: `drawCircle`, `drawCircleV`, `drawCircleLines`
- Rectangles: `drawRectangle`, `drawRectangleV`, `drawRectangleRec`, `drawRectanglePro`
- Rectangle outlines: `drawRectangleLines`, `drawRectangleLinesEx`
- Pixels: `drawPixel`, `drawPixelV`

### Text
- `drawText`, `drawTextEx`
- `measureText`, `measureTextEx`

### Input - Keyboard
- `isKeyPressed`, `isKeyDown`, `isKeyReleased`, `isKeyUp`
- `getKeyPressed`, `getCharPressed`
- `setExitKey`

### Input - Mouse
- `isMouseButtonPressed`, `isMouseButtonDown`, `isMouseButtonReleased`, `isMouseButtonUp`
- `getMouseX`, `getMouseY`, `getMousePosition`, `getMouseDelta`
- `setMousePosition`, `getMouseWheelMove`

### Colors
All standard raylib colors: `RayWhite`, `LightGray`, `Gray`, `DarkGray`, `Yellow`, `Gold`, `Orange`, `Pink`, `Red`, `Maroon`, `Green`, `Lime`, `DarkGreen`, `SkyBlue`, `Blue`, `DarkBlue`, `Purple`, `Violet`, `DarkPurple`, `Beige`, `Brown`, `DarkBrown`, `White`, `Black`, `Blank`, `Magenta`

### Keys
Alphanumeric and common function keys: `KeySpace`, `KeyEnter`, `KeyEscape`, `KeyTab`, `KeyBackspace`, `KeyA`-`KeyZ`, `Key0`-`Key9`, arrow keys, etc.

### Helper Constructors
- `color(r, g, b, a)` - Create custom colors
- `vec2(x, y)` - Create Vector2
- `vec3(x, y, z)` - Create Vector3
- `rectangle(x, y, width, height)` - Create Rectangle

## Examples

See `examples/raylib_compat_demo.nim` for a complete working example with:
- Bouncing ball physics
- Mouse interaction
- Shape drawing
- Text rendering
- FPS counter

## What's Missing?

Currently not available (can be added as needed):
- Textures and images
- Audio
- 3D functions
- Shaders
- Additional shapes (triangles, polygons)
- Advanced input (gamepad, gestures)
- File I/O helpers
- Some keyboard keys (F1-F12, NumLock, etc.)

## Future: SDL3 Backend

When complete, you'll be able to use SDL3 as the backend:

```bash
nim c -d:sdl3 myapp.nim
```

This will give you raylib's simple API with SDL3's advanced features:
- Better cross-platform support
- Networking capabilities
- Advanced audio
- Better mobile/console support

## Philosophy

This module follows Storie's philosophy of providing the **raylib API with SDL3 power**:
- Write simple, familiar raylib code
- Get advanced SDL3 features when needed
- Easy migration path from raylib's limitations

## Learn More

- [Raylib Cheatsheet](https://www.raylib.com/cheatsheet/cheatsheet.html)
- [naylib Examples](https://github.com/planetis-m/raylib-examples)
- [Storie Documentation](../docs/)
