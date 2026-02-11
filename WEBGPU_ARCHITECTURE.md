# WebGPU Architecture - Modular Design

This document describes the refactored WebGPU rendering architecture that separates concerns and enables better code reuse.

## Overview

The previous `webgpu-renderer.ts` mixed terminal cell rendering with WebGPU device management and font rasterization. The new architecture separates these into distinct, reusable modules:

```
┌─────────────────────────────────────┐
│     WebGPU Context (Device/GPU)     │
│   - Adapter & device management     │
│   - Canvas configuration            │
│   - Resource creation helpers       │
└──────────────┬──────────────────────┘
               │
       ┌───────┴───────┐
       ↓               ↓
┌──────────────┐  ┌──────────────────┐
│ Glyph Atlas  │  │  Other Textures  │
│ - Font mgmt  │  │  & Resources     │
│ - Rasterize  │  └──────────────────┘
│ - UV mapping │
└──────┬───────┘
       │
       ↓
┌──────────────────────────────────────┐
│   Terminal Renderer (Cell Grid)     │
│   - Instance-based rendering         │
│   - Terminal cell specific           │
└──────────────────────────────────────┘
       
       ↓ (other renderers can share context)
       
┌──────────────────────────────────────┐
│   Future: Sprite/Shape/Particle      │
│   Renderers, Post-processing, etc.   │
└──────────────────────────────────────┘
```

## New Modules

### 1. `webgpu-context.ts` - Core WebGPU Context

**Purpose**: Manages the WebGPU device, adapter, and canvas context.

**Key Features**:
- Device & adapter initialization
- Canvas context configuration
- Helper methods for creating buffers, textures, samplers
- Shared across multiple renderers

**Usage**:
```typescript
const context = new WebGPUContext({
  canvas: myCanvas,
  powerPreference: 'high-performance'
});
await context.init();
```

### 2. `glyph-atlas.ts` - Font Rasterization & Atlas Management

**Purpose**: Handles text rendering and glyph texture atlas creation.

**Key Features**:
- Uses Canvas2D for text rasterization
- Efficient glyph caching and UV mapping
- Dynamic atlas packing
- GPU texture upload management
- Multiple atlases for different fonts

**Usage**:
```typescript
const atlas = new GlyphAtlas({
  fontFamily: 'Monaco, monospace',
  fontSize: 14,
  atlasWidth: 2048,
  atlasHeight: 2048
});
await atlas.initGPU(context);

// Pre-cache common characters
atlas.cacheCharRange(32, 127); // ASCII
atlas.uploadToGPU(device);
```

### 3. `terminal-renderer.ts` - Terminal Cell Grid Renderer

**Purpose**: GPU-accelerated rendering of terminal cell grids.

**Key Features**:
- Renders `Cell[][]` buffers efficiently
- Instance-based rendering (one draw call per frame)
- WGSL shader for cell quads
- Optional offscreen rendering to texture
- Independent of WebGPU context lifecycle

**Usage**:
```typescript
const terminalRenderer = new TerminalRenderer(context, atlas, {
  width: 80,
  height: 24,
  renderToTexture: false
});
await terminalRenderer.init(800, 600);

// Render cell buffer
terminalRenderer.render(cellBuffer);
```

### 4. `webgpu-renderer.ts` - Backward Compatibility Facade

**Purpose**: Maintains API compatibility with existing code.

**Implementation**: Wraps the new modular components internally while preserving the old interface.

**Usage** (same as before):
```typescript
const renderer = new WebGPURenderer(canvas, {
  fontFamily: 'Monaco',
  fontSize: 16
});
await renderer.init();
renderer.render(cellBuffer);

// Can also access underlying components:
const context = renderer.getContext();
const atlas = renderer.getAtlas();
```

## Benefits of This Architecture

### 1. **Separation of Concerns**
- GPU management ≠ Font rendering ≠ Terminal rendering
- Each module has a single, well-defined responsibility
- Easier to understand, test, and maintain

### 2. **Reusability**
- Share one `WebGPUContext` across multiple renderers
- Use different `GlyphAtlas` instances for different fonts
- Create multiple `TerminalRenderer` instances for different views

### 3. **Extensibility**
- Add new renderer types (sprites, particles, shapes) without modifying existing code
- Implement custom text renderers using `GlyphAtlas`
- Compose multiple rendering techniques

### 4. **Performance**
- Efficient resource sharing
- Single GPU device for all rendering
- Ability to render to textures for compositing

### 5. **Testability**
- Each module can be tested independently
- Mock interfaces for unit testing
- Clear dependencies

## Migration Guide

### For Existing Code (No Changes Required)

Your existing code using `WebGPURenderer` continues to work:

```typescript
// This still works exactly as before
const renderer = new WebGPURenderer(canvas);
await renderer.init();
renderer.render(buffer);
```

### For New Code (Recommended Pattern)

Use the modular components directly:

```typescript
// 1. Create shared context
const context = new WebGPUContext({ canvas });
await context.init();

// 2. Create glyph atlas
const atlas = new GlyphAtlas({ fontSize: 14 });
await atlas.initGPU(context);

// 3. Create terminal renderer
const terminal = new TerminalRenderer(context, atlas, {
  width: 80,
  height: 24
});
await terminal.init(canvas.width, canvas.height);

// 4. Render
terminal.render(cellBuffer);
```

## Advanced Usage Examples

### Multiple Terminal Views with Different Fonts

```typescript
const context = new WebGPUContext({ canvas });
await context.init();

// Code editor font
const codeAtlas = new GlyphAtlas({ 
  fontFamily: 'Fira Code, monospace',
  fontSize: 14 
});
await codeAtlas.initGPU(context);

// UI font
const uiAtlas = new GlyphAtlas({ 
  fontFamily: 'Inter, sans-serif',
  fontSize: 12 
});
await uiAtlas.initGPU(context);

// Two separate terminals
const editorTerminal = new TerminalRenderer(context, codeAtlas, {
  width: 120, height: 50,
  renderToTexture: true
});

const statusTerminal = new TerminalRenderer(context, uiAtlas, {
  width: 120, height: 3,
  renderToTexture: true
});

await editorTerminal.init(1200, 1000);
await statusTerminal.init(1200, 36);
```

### Mixed Rendering (Terminal + Other GPU Effects)

```typescript
const context = new WebGPUContext({ canvas });
await context.init();

// Terminal rendering
const atlas = new GlyphAtlas({ fontSize: 14 });
await atlas.initGPU(context);
const terminal = new TerminalRenderer(context, atlas, {
  width: 80, height: 24,
  renderToTexture: true
});
await terminal.init(800, 600);

// Future: Add other renderers using same context
// const spriteRenderer = new SpriteRenderer(context);
// const particleSystem = new ParticleRenderer(context);
// const postProcessing = new PostProcessor(context);

// Compose rendering passes
terminal.render(cellBuffer);
// spriteRenderer.render(sprites);
// particleSystem.render(deltaTime);
// postProcessing.apply(terminal.getRenderTexture());
```

## File Structure

```
src/
├── webgpu-context.ts         # GPU device/context management
├── glyph-atlas.ts            # Font rasterization & atlas
├── terminal-renderer.ts      # Terminal cell grid renderer
├── webgpu-renderer.ts        # Backward compatibility facade
└── webgpu-examples.ts        # Usage examples
```

## Future Extensions

### Potential New Renderers

1. **SpriteRenderer** - 2D sprite/texture rendering
2. **ShapeRenderer** - Primitive shapes (lines, rectangles, circles)
3. **ParticleRenderer** - GPU-accelerated particle systems
4. **PostProcessor** - Shader effects and filters
5. **CompositeRenderer** - Layer composition and blending

### Enhanced GlyphAtlas

- SDF (Signed Distance Field) fonts for better scaling
- Multiple font weights/styles in same atlas
- Emoji and icon support
- Dynamic atlas resizing

### Terminal Enhancements

- Bold/italic/underline support
- Better Unicode handling
- Ligature support
- Cursor rendering
- Selection highlights

## Design Principles

1. **Single Responsibility**: Each module does one thing well
2. **Open/Closed**: Open for extension, closed for modification
3. **Dependency Inversion**: Depend on abstractions, not concretions
4. **Composition over Inheritance**: Favor composition of modules
5. **Explicit Dependencies**: Clear dependency graph

## Testing Strategy

### Unit Tests
- Test each module independently
- Mock GPU resources when needed
- Verify atlas packing logic
- Test color/UV conversions

### Integration Tests
- Test module interactions
- Verify full rendering pipeline
- Test with real GPU (when available)
- Performance benchmarks

### Visual Tests
- Compare rendered output
- Font rendering quality
- Edge cases (empty cells, special chars)

## Performance Considerations

### Memory
- Single GPU device shared across renderers
- One glyph atlas per unique font (not per renderer)
- Efficient instance-based rendering (single draw call)

### GPU
- Minimize state changes
- Batch similar operations
- Use offscreen rendering for compositing
- Lazy atlas uploads

### CPU
- Cache glyph measurements
- Minimize JS ↔ GPU data transfers
- Typed arrays for performance

## Conclusion

This refactoring provides a solid foundation for building complex, GPU-accelerated UIs while maintaining clear separation of concerns. The architecture is extensible, testable, and performant.

For questions or contributions, see the examples in `webgpu-examples.ts`.
