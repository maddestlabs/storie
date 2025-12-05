# Platform Abstraction Architecture

## Overview
Storie uses a platform abstraction layer that allows swapping between different graphics backends (SDL3, raylib, sokol) while maintaining a unified API for the user-facing Nimini scripting language.

## Current Architecture

```
┌─────────────────────────────────────────┐
│         User Code (Markdown)            │
│  Nimini DSL: fillRect(), drawCircle()   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│        storie.nim + storie_core.nim     │
│   (High-level API, lifecycle, nimini)   │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│       RenderBuffer + pixel_types        │
│    (Abstract draw commands, no impl)    │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────▼──────────────────────┐
│       platform_interface.nim            │
│       (Abstract Platform base)          │
└──────────────────┬──────────────────────┘
                   │
        ┌──────────┴──────────┬───────────┬─────────────┐
        │                     │           │             │
┌───────▼────────┐  ┌────────▼───────┐  ┌▼──────────┐  ┌▼──────────┐
│  sdl_platform  │  │ raylib_platform│  │   sokol   │  │  future   │
│  (SDL3+OpenGL) │  │  (raylib API)  │  │ (sokol_gfx)│  │ backends  │
└────────────────┘  └────────────────┘  └───────────┘  └───────────┘
```

## Design Principles

1. **Single API**: User code (Nimini) never knows about the backend
2. **Command-based**: 2D rendering uses RenderBuffer commands
3. **Direct API**: 3D rendering uses backend-specific APIs (OpenGL, raylib 3D)
4. **Compile-time selection**: Choose backend via `-d:raylib` flag
5. **Runtime selection (future)**: URL param like `?backend=raylib` for WASM builds

## Backend Comparison

| Feature         | SDL3     | Raylib   | Sokol    |
|-----------------|----------|----------|----------|
| 2D API          | ✅ Easy  | ✅ Easy  | ⚠️ Manual|
| 3D API          | OpenGL   | Built-in | Built-in |
| Text Rendering  | TTF lib  | Built-in | Manual   |
| Binary Size     | ~2MB     | ~1MB     | ~500KB   |
| WASM Size       | ~1.5MB   | ~750KB   | ~300KB   |
| Dependencies    | Many     | None     | None     |
| Setup Complexity| Medium   | Low      | High     |
| Documentation   | Good     | Excellent| Good     |

## Implementation Plan

### Phase 1: Refactor Current Code ✅ (Mostly Done)
- [x] Abstract platform interface exists
- [x] SDL implementation separated
- [x] RenderBuffer command system
- [ ] Move 3D code to platform-specific modules

### Phase 2: Add Raylib Backend
1. Create `platform/raylib/raylib_platform.nim`
2. Implement Platform interface methods
3. Add raylib bindings (use existing nim-raylib or create minimal bindings)
4. Build system: `-d:raylib` flag
5. Test all 2D examples work identically
6. Test 3D examples with raylib's 3D API

### Phase 3: WASM Multi-Backend
1. Build separate WASM binaries: `storie-sdl3.wasm` and `storie-raylib.wasm`
2. Create unified loader HTML that checks `?backend=` param
3. Load appropriate WASM binary dynamically
4. Share same JavaScript wrapper code

### Phase 4: Sokol Backend (Optional)
- More work, but smallest binaries
- Best for production-optimized builds

## File Structure

```
platform/
├── platform_interface.nim        # Abstract base (current)
├── pixel_types.nim              # Shared types (current)
├── render3d.nim                 # 3D abstractions (refactor needed)
├── sdl/
│   ├── sdl_platform.nim         # SDL3 impl (current)
│   ├── sdl3_bindings/
│   └── sdl_render3d.nim         # SDL-specific 3D (to create)
├── raylib/
│   ├── raylib_platform.nim      # Raylib impl (to create)
│   ├── raylib_bindings.nim      # Raylib API (to create)
│   └── raylib_render3d.nim      # Raylib 3D (to create)
└── sokol/
    ├── sokol_platform.nim       # Sokol impl (future)
    └── sokol_bindings.nim       # Sokol API (future)
```

## Code Example: Backend Selection

### Compile-time (Native)
```bash
# SDL3 backend (default)
nim c -r storie.nim

# Raylib backend
nim c -d:raylib -r storie.nim

# Sokol backend
nim c -d:sokol -r storie.nim
```

### Runtime (WASM)
```html
<!-- URL: index.html?backend=raylib -->
<script>
  const params = new URLSearchParams(window.location.search);
  const backend = params.get('backend') || 'sdl3';
  const wasmFile = `storie-${backend}.wasm`;
  // Load appropriate WASM binary
</script>
```

## User API Remains Identical

```nim
# This code works with ANY backend:
setColor(255, 0, 0)
fillRect(10, 10, 100, 100)
drawCircle(200, 200, 50)

# 3D code uses backend-specific APIs (documented per backend):
# SDL3: Uses OpenGL directly
# Raylib: Uses raylib 3D functions
# Sokol: Uses sokol_gfx 3D functions
```

## Migration Notes

### Current SDL-Specific Code to Refactor
1. **`render3d.nim`**: Currently OpenGL-specific, needs abstraction
2. **3D globals in storie.nim**: `gShader`, `gCamera` - make platform-owned
3. **OpenGL imports**: Should only be in `sdl_render3d.nim`

### Backwards Compatibility
- Default backend remains SDL3
- Existing examples work unchanged
- 3D API may differ per backend (documented)

## Benefits

1. **Smaller WASM**: Users choose size vs features
2. **Platform flexibility**: Desktop vs web vs mobile
3. **Performance options**: Hardware vs software rendering
4. **Future-proof**: Easy to add new backends (WebGPU, Metal, Vulkan)
5. **Educational**: Users can learn different graphics APIs

## Drawbacks to Consider

1. **Maintenance**: More code to maintain across backends
2. **Testing**: Need to test every example on every backend
3. **API differences**: 3D APIs may diverge between backends
4. **Build complexity**: Multiple WASM binaries to host

## Recommendation

**YES, proceed with this approach**, but phase it:
- ✅ **Immediate**: Clean up current SDL3 code (move 3D to separate module)
- ✅ **Next**: Add raylib backend (high value, low effort)
- ⏸️ **Later**: Consider sokol if size becomes critical
- ⏸️ **Future**: WebGPU backend for modern web

The architecture is sound and the investment will pay off in flexibility and performance options.
