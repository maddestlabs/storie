# Offscreen Compositor Architecture

## Overview

All rendering contexts become **offscreen layers** that get composited in one final WebGPU (or WebGL2 fallback) render pass.

## Architecture

```
Main Canvas (800x600)
  ├─ WebGPU Context (Compositor)
  │
  └─ Layers (textures):
      ├─ Layer 0: Terminal Grid (WebGPU texture, 80x24 chars)
      ├─ Layer 1: Canvas 2D (OffscreenCanvas, full resolution)
      └─ Layer 2: WebGL (OffscreenCanvas with WebGL context)
```

## Components

### 1. Layer System

Each layer is an offscreen render target:

```typescript
interface Layer {
  id: string;
  texture: GPUTexture | OffscreenCanvas;
  enabled: boolean;
  opacity: number;
  blendMode: 'normal' | 'additive' | 'multiply' | 'screen';
  zIndex: number;
}
```

### 2. Compositor (WebGPU Primary, WebGL2 Fallback)

**WebGPU Compositor:**
- Render pass with multiple texture samplers
- Fragment shader composites layers with blend modes
- Outputs to main canvas

**WebGL2 Fallback Compositor:**
- Same architecture using WebGL2 textures
- Fragment shader GLSL equivalent
- `gl.canvas` outputs to main canvas

### 3. Layer Implementations

#### Terminal Layer (GPU Texture)
```typescript
class TerminalLayer {
  private texture: GPUTexture;
  private renderPipeline: GPURenderPipeline;
  
  render(cells: Cell[][]): GPUTexture {
    // Render character grid to texture
    // (existing WebGPURenderer logic, but to texture instead of canvas)
    return this.texture;
  }
}
```

#### Canvas 2D Layer (OffscreenCanvas)
```typescript
class Canvas2DLayer {
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  
  getContext(): OffscreenCanvasRenderingContext2D {
    return this.ctx;
  }
  
  toTexture(device: GPUDevice): GPUTexture {
    // Create texture from OffscreenCanvas ImageBitmap
    const bitmap = this.canvas.transferToImageBitmap();
    // Upload to GPU texture
  }
}
```

#### WebGL Layer (OffscreenCanvas)
```typescript
class WebGLLayer {
  private canvas: OffscreenCanvas;
  private gl: WebGLRenderingContext;
  
  getContext(): WebGLRenderingContext {
    return this.gl;
  }
  
  toTexture(device: GPUDevice): GPUTexture {
    // Create texture from WebGL canvas
  }
}
```

### 4. Compositor Shader (WGSL)

```wgsl
@group(0) @binding(0) var terminalTexture: texture_2d<f32>;
@group(0) @binding(1) var canvas2dTexture: texture_2d<f32>;
@group(0) @binding(2) var webglTexture: texture_2d<f32>;
@group(0) @binding(3) var texSampler: sampler;

struct LayerConfig {
  opacity: f32,
  blendMode: u32, // 0=normal, 1=additive, 2=multiply, 3=screen
  enabled: u32,
}

@group(1) @binding(0) var<uniform> layers: array<LayerConfig, 3>;

@fragment
fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
  var color = vec4<f32>(0.0, 0.0, 0.0, 0.0);
  
  // Layer 0: Terminal
  if (layers[0].enabled != 0u) {
    let term = textureSample(terminalTexture, texSampler, uv);
    color = blend(color, term, layers[0].opacity, layers[0].blendMode);
  }
  
  // Layer 1: Canvas 2D
  if (layers[1].enabled != 0u) {
    let c2d = textureSample(canvas2dTexture, texSampler, uv);
    color = blend(color, c2d, layers[1].opacity, layers[1].blendMode);
  }
  
  // Layer 2: WebGL
  if (layers[2].enabled != 0u) {
    let wgl = textureSample(webglTexture, texSampler, uv);
    color = blend(color, wgl, layers[2].opacity, layers[2].blendMode);
  }
  
  return color;
}

fn blend(base: vec4<f32>, blend: vec4<f32>, opacity: f32, mode: u32) -> vec4<f32> {
  var result: vec4<f32>;
  
  // Alpha blending (normal)
  if (mode == 0u) {
    let alpha = blend.a * opacity;
    result = base * (1.0 - alpha) + blend * alpha;
  }
  // Additive
  else if (mode == 1u) {
    result = base + blend * opacity;
  }
  // Multiply
  else if (mode == 2u) {
    result = base * mix(vec4<f32>(1.0), blend, opacity);
  }
  // Screen
  else if (mode == 3u) {
    result = vec4<f32>(1.0) - (vec4<f32>(1.0) - base) * (vec4<f32>(1.0) - blend * opacity);
  }
  
  return result;
}
```

## API Changes

### User-Facing API

```javascript
// Canvas 2D - now offscreen but same API
canvas2d.drawRect(10, 10, 100, 100, '#ff0000');

// WebGL - user gets offscreen WebGL context
const gl = webgl.context;
gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);

// Compositor controls (optional)
compositor.setLayerOpacity('terminal', 0.8);
compositor.setLayerBlendMode('canvas2d', 'additive');
compositor.setLayerEnabled('webgl', false);
```

### No Breaking Changes

All existing Canvas 2D and WebGL APIs remain the same - only the internal rendering changes.

## Implementation Steps

1. **Phase 1: Refactor WebGPURenderer**
   - Change to render to offscreen texture instead of main canvas
   - Keep existing character grid logic

2. **Phase 2: Create Compositor Class**
   - WebGPU compositor with texture samplers
   - Basic alpha blending first
   - Add blend modes later

3. **Phase 3: Offscreen Canvas 2D**
   - Change from DOM canvas to OffscreenCanvas
   - Texture upload pipeline

4. **Phase 4: Offscreen WebGL**
   - Create OffscreenCanvas with WebGL context
   - Expose to user scripts
   - Texture upload pipeline

5. **Phase 5: WebGL2 Fallback**
   - Implement compositor using WebGL2
   - Same shader logic in GLSL
   - Feature parity with WebGPU path

6. **Phase 6: Advanced Features**
   - Post-processing effects
   - Layer transformations (scale, rotate)
   - Performance optimizations

## Performance Considerations

- **Texture uploads**: Only upload Canvas 2D/WebGL when dirty
- **Render targets reuse**: Persistent textures, no per-frame allocation
- **Dirty tracking**: Only composite when layers change
- **Layer caching**: Skip disabled/transparent layers

## Fallback Strategy

```
Try WebGPU Compositor
  ├─ Success → Use WebGPU path
  └─ Fail → Try WebGL2 Compositor
      ├─ Success → Use WebGL2 path
      └─ Fail → Fallback to Canvas 2D compositor (slowest)
```

## Questions to Resolve

1. **Texture size**: Should Canvas 2D layer match main canvas resolution or be configurable?
2. **WebGL layer size**: Same as Canvas 2D or separate?
3. **Multiple layers**: Allow users to create additional layers dynamically?
4. **Layer ordering**: Fixed order or user-controllable z-index?
5. **Effects**: Built-in post-processing (CRT, bloom, blur) or user-defined shaders?

## Next Steps

- [ ] Prototype compositor with 2 layers (terminal + canvas2d)
- [ ] Measure performance vs current DOM overlay
- [ ] Implement WebGL2 fallback
- [ ] Add advanced blend modes
- [ ] Add post-processing effects API
