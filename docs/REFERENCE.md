# Quick Reference: Native vs WASM

## Compilation

### Native
```bash
./build.sh example_boxes          # Compile and run
nim c -r backstorie.nim           # Direct compilation
```

### WASM
```bash
./build-web.sh example_boxes      # Compile to WASM using Emscripten
./build-web.sh -s example_boxes   # Compile and serve
```

## Code Differences

Your application code remains **exactly the same** for both targets. The engine handles the differences internally.

### Example App (works for both native and WASM)

```nim
onInit = proc(state: AppState) =
  # Initialize your app
  discard

onUpdate = proc(state: AppState, dt: float) =
  # Update logic
  discard

onRender = proc(state: AppState) =
  # Draw to terminal
  let tb = addr state.currentBuffer
  tb.writeText(10, 10, "Hello World!", defaultStyle())

onInput = proc(state: AppState, event: InputEvent): bool =
  # Handle input
  if event.kind == KeyEvent and event.keyCode == INPUT_ESCAPE:
    state.running = false
    return true
  return false

onShutdown = proc(state: AppState) =
  # Cleanup
  discard
```

## API Compatibility

All core APIs work identically:

### Buffer Operations
- `write(x, y, ch, style)` ✅ Works in both
- `writeText(x, y, text, style)` ✅ Works in both
- `fillRect(x, y, w, h, ch, style)` ✅ Works in both
- `clear()` ✅ Works in both

### Layer System
- `addLayer(id, z)` ✅ Works in both
- `getLayer(id)` ✅ Works in both
- `removeLayer(id)` ✅ Works in both

### Input Events
- `KeyEvent` ✅ Works in both
- `TextEvent` ✅ Works in both
- `MouseEvent` ✅ Works in both
- `MouseMoveEvent` ✅ Works in both
- `ResizeEvent` ✅ Works in both

### Colors and Styles
- `rgb(r, g, b)` ✅ Works in both
- `defaultStyle()` ✅ Works in both
- All style properties ✅ Works in both

## Environment-Specific Code

If you need platform-specific code:

```nim
when defined(emscripten):
  # WASM-specific code
  const platform = "Browser"
else:
  # Native-specific code
  const platform = "Terminal"
```

## Testing Both Targets

```bash
# Test native version
./build.sh myapp
./backstorie

# Test WASM version
./build-web.sh myapp
cd web && python3 -m http.server 8000
# Open http://localhost:8000
```

## Performance Tips

### Native
- Use release mode for production: `./compile.sh -r`
- Minimize unnecessary buffer operations
- Cache style objects when possible

### WASM
- Always use release mode for deployment: `./compile_wasm.sh -r`
- Minimize cell queries (they cross WASM boundary)
- Consider reducing terminal size for mobile
- Use layers efficiently (they're composited in WASM)

## File Organization

```
your-project/
├── backstorie.nim          # Engine (don't modify)
├── compile.sh              # Native compiler
├── compile_wasm.sh         # WASM compiler
├── myapp.nim               # Your app
├── web/                    # WASM output directory
│   ├── index.html
│   ├── backstorie.js
│   ├── backstorie.wasm     (generated)
│   └── backstorie.wasm.js  (generated)
└── lib/                    # Optional libraries
    └── mylib.nim
```

## Common Issues

### WASM build fails with "emcc not found"
```bash
# Activate Emscripten environment
source /path/to/emsdk/emsdk_env.sh
```

### Terminal too small in browser
The terminal auto-sizes to fill the window. Adjust font size in `web/backstorie.js`:
```javascript
this.fontSize = 16;  // Increase for larger cells
```

### Input not working in browser
Click on the canvas to focus it. The canvas must have focus to receive input.

### Colors look different
Native terminals may have limited color support (8/256 colors). WASM always uses full RGB.

## Deployment Checklist

### Native Binary
- [ ] Compile in release mode
- [ ] Test on target OS
- [ ] Include any required libraries
- [ ] Document terminal requirements

### WASM Web App
- [ ] Compile in release mode
- [ ] Test in multiple browsers
- [ ] Configure web server for `.wasm` MIME type
- [ ] Optimize font size for target devices
- [ ] Consider adding loading screen
- [ ] Test on mobile devices

## Support

- **Documentation**: See `README.md`, `WASM_GUIDE.md`
- **Examples**: All examples in the repo work with both targets
- **Issues**: Check compilation output for specific errors
