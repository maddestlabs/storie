# Shader Pipeline Architecture

## Overview

The Shader Pipeline system enables chaining WGSL (WebGPU Shading Language) post-processing effects to create complex visual styles. It's inspired by the original tstorie engine's shader chain system and leverages the existing WGSL shader library.

## Architecture

### Components

```
┌─────────────────────────────────────────────────┐
│             StorieEngine (API)                   │
│  - User-facing compositor methods                │
│  - loadEffect(), buildPipeline(), setUniform()   │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│             Compositor                           │
│  - Manages layers & compositing                  │
│  - Owns ShaderPipeline instance                 │
│  - Exposes pipeline control                      │
└───────────────────┬─────────────────────────────┘
                    │
┌───────────────────▼─────────────────────────────┐
│          ShaderPipeline                          │
│  - Loads and compiles WGSL shaders              │
│  - Builds multi-stage render pipelines          │
│  - Manages ping-pong textures                   │
│  - Applies effects sequentially                 │
└───────────────────┬─────────────────────────────┘
                    │
                    │  Loads from
                    ▼
┌─────────────────────────────────────────────────┐
│      WGSL Shader Library                         │
│  /docs/shaders/wgsl/*.wgsl.js                   │
│  - bloom, scanlines, crt, blur, vignette, etc.  │
│  - Each exports getShaderConfig()               │
└─────────────────────────────────────────────────┘
```

### Data Flow

```
Input Texture (Composed Layers)
    │
    ▼
┌─────────────┐  Pass 1: Bloom
│  Texture A  │────────────────────▶┌──────────────┐
└─────────────┘                     │  Texture B   │
                                    └──────┬───────┘
                                           │
                               Pass 2: Scanlines
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Texture A   │
                                    └──────┬───────┘
                                           │
                                Pass 3: CRT
                                           │
                                           ▼
                                    ┌──────────────┐
                                    │  Texture B   │
                                    └──────┬───────┘
                                           │
                                           ▼
                                    Canvas Output
```

## Shader Module Format

All shaders follow a consistent structure:

```javascript
// shader.wgsl.js
function getShaderConfig() {
  return {
    vertexShader: `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) vUv: vec2f,
      }
      
      @vertex
      fn vertexMain(@location(0) position: vec2f) -> VertexOutput {
        var output: VertexOutput;
        output.vUv = position * 0.5 + 0.5;
        output.vUv.y = 1.0 - output.vUv.y;
        output.position = vec4f(position, 0.0, 1.0);
        return output;
      }
    `,
    
    fragmentShader: `
      @group(0) @binding(0) var contentTexture: texture_2d<f32>;
      @group(0) @binding(1) var contentTextureSampler: sampler;
      
      struct Uniforms {
        time: f32,
        _pad0: f32, _pad1: f32, _pad2: f32,
        resolution: vec2f,
        _pad3: f32, _pad4: f32,
        // Custom effect parameters...
        effectParam1: f32,
        effectParam2: f32,
        // ...
      }
      @group(0) @binding(2) var<uniform> uniforms: Uniforms;
      
      @fragment
      fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
        // Effect implementation
        let color = textureSample(contentTexture, contentTextureSampler, vUv);
        // Apply effect...
        return color;
      }
    `,
    
    uniforms: {
      effectParam1: 1.0,
      effectParam2: 0.5
    }
  };
}
```

### Binding Layout (Standardized)

All shaders use the same binding layout:

- **@group(0) @binding(0)**: Input texture (`texture_2d<f32>`)
- **@group(0) @binding(1)**: Texture sampler (`sampler`)
- **@group(0) @binding(2)**: Uniform buffer with standard fields:
  - `time` (f32): Current time in seconds
  - `_pad0, _pad1, _pad2` (f32): Padding for alignment
  - `resolution` (vec2f): Texture resolution in pixels
  - `_pad3, _pad4` (f32): Padding for alignment
  - Custom effect parameters...

## Implementation Details

### Stage Creation

When adding a stage to the pipeline:

1. **Combine shaders**: Concatenate vertex + fragment shader code
2. **Create shader module**: Compile WGSL to GPU code
3. **Allocate uniform buffer**: Size based on standard layout + custom parameters
4. **Create output texture**: Same size as canvas, RENDER_ATTACHMENT + TEXTURE_BINDING usage
5. **Build render pipeline**: Configure vertex attributes, fragment targets, topology

### Pipeline Execution

When applying the pipeline (`apply(inputTexture)`):

1. **Create fullscreen quad**: 2 triangles covering clip space (-1 to 1)
2. **For each stage**:
   a. Update uniform buffer (time, resolution, custom params)
   b. Create bind group with previous stage's output as input
   c. Begin render pass to this stage's output texture
   d. Draw fullscreen quad through shader
   e. Submit commands
3. **Return final texture**: Output of last stage

### Texture Management

The pipeline uses **ping-pong textures**:
- Each stage has its own output texture
- Stage N's output feeds into Stage N+1's input
- No intermediate CPU readback (fully GPU-resident)
- Textures destroyed when pipeline is rebuilt

## API Reference

### Compositor Methods (Exposed via Engine)

#### `loadEffect(name, url)`
Load a shader effect from a JavaScript module.

```javascript
await engine.compositor.loadEffect('bloom', '/docs/shaders/wgsl/bloom.wgsl.js');
```

**Parameters:**
- `name` (string): Name to register effect under
- `url` (string): Path to `.wgsl.js` file

**Returns:** `Promise<void>`

**Requirements:**
- Module must export `getShaderConfig()` function
- Config must have `vertexShader`, `fragmentShader`, `uniforms`

---

#### `buildPipeline(effects)`
Build a shader pipeline from an array of effect names.

```javascript
await engine.compositor.buildPipeline(['bloom', 'scanlines', 'crt']);
```

**Parameters:**
- `effects` (string[]): Array of effect names in execution order

**Returns:** `Promise<void>`

**Notes:**
- Order matters! Effects applied left-to-right
- Clears any existing pipeline
- Empty array removes all effects

---

#### `setEffectUniform(effectName, uniformName, value)`
Update a uniform parameter for a specific effect.

```javascript
engine.compositor.setEffectUniform('bloom', 'bloomIntensity', 0.8);
```

**Parameters:**
- `effectName` (string): Name of registered effect
- `uniformName` (string): Uniform field name (must match shader struct)
- `value` (number | number[]): New value (scalar or array)

**Notes:**
- Changes apply on next pipeline application
- Arrays must match expected length
- Invalid uniform names are silently ignored

---

#### `getEffects()`
Get list of all registered effects.

```javascript
const effects = engine.compositor.getEffects();
console.log(effects); // ['bloom', 'scanlines', 'crt']
```

**Returns:** `string[]`

---

#### `hasEffect(name)`
Check if an effect is registered.

```javascript
if (engine.compositor.hasEffect('bloom')) {
  engine.compositor.setEffectUniform('bloom', 'bloomIntensity', 1.5);
}
```

**Parameters:**
- `name` (string): Effect name

**Returns:** `boolean`

---

#### `setPipelineEnabled(enabled)`
Enable/disable the shader pipeline.

```javascript
engine.compositor.setPipelineEnabled(false); // Bypass effects
engine.compositor.setPipelineEnabled(true);  // Re-enable
```

**Parameters:**
- `enabled` (boolean): `true` to apply effects, `false` to bypass

**Status:** ⚠️ Not yet implemented (placeholder for future integration)

## Performance Considerations

### Cost per Effect

| Effect | Cost | Notes |
|--------|------|-------|
| Invert | Very Low | Single texture sample |
| Vignette | Very Low | Simple math, 1 sample |
| Border | Low | Edge detection, 1-2 samples |
| Paper | Low | Noise function |
| Scanlines | Low | Sin function, 1 sample |
| Ruled Lines | Low | Conditionals, 1 sample |
| CRT | Medium | Distortion math, 1-3 samples |
| Clouds | Medium | Noise function, time-based |
| Blur | **High** | 5-13 texture samples |
| Bloom | **Very High** | Brightness extraction + blur |

### Optimization Tips

1. **Limit chain length**: Keep to 3-5 effects maximum
2. **Order strategically**: Expensive effects last (bloom, blur)
3. **Reduce resolution**: Render at lower res, upscale final output
4. **Adjust blur radius**: Lower radius = fewer samples = faster
5. **Profile on target hardware**: WebGPU performance varies widely

### Memory Usage

Each stage allocates:
- **Output texture**: `width × height × 4 bytes`  (RGBA8)
- **Uniform buffer**: `~32-128 bytes` per effect

Example: 1920×1080, 4 effects:
- Textures: `1920 × 1080 × 4 × 4 = 33 MB`
- Uniforms: `4 × 128 = 512 bytes`

## Future Enhancements

### Planned Features

- [ ] **Automatic integration**: Apply pipeline in `autoComposite()`
- [ ] **Offscreen composition**: Render to intermediate texture for pipeline input
- [ ] **Effect presets**: Named combinations (e.g., "retro", "dreamstate")
- [ ] **Dynamic loading**: Lazy-load shaders on demand
- [ ] **Shader hot-reload**: Update shaders without rebuilding pipeline
- [ ] **Custom uniform blocks**: User-defined struct layouts
- [ ] **Compute shaders**: Parallel post-processing passes
- [ ] **Effect gallery**: Interactive showcase of all available shaders

### API Additions

```javascript
// Proposed future API
await engine.compositor.loadEffectPreset('retro'); // bloom + scanlines + crt
await engine.compositor.saveEffectPreset('myStyle', ['blur', 'vignette']);

engine.compositor.onPipelineRebuild((effects) => {
  console.log(`Pipeline updated: ${effects.join(' → ')}`);
});

const stats = engine.compositor.getPipelineStats();
// { stages: 3, textureMemory: 33MB, lastFrameTime: 2.3ms }
```

## Debugging

### Common Issues

**Error: "Shader pipeline not initialized"**
- Cause: Compositor not available (WebGPU disabled or unsupported)
- Fix: Check `engine.compositor.available` before calling pipeline methods

**Error: "Effect not found"**
- Cause: Effect name in `buildPipeline()` wasn't loaded via `loadEffect()`
- Fix: Ensure `await loadEffect()` completes before `buildPipeline()`

**No visual effect**
- Cause: Pipeline not integrated with compositor rendering yet
- Status: Integration in progress (post-composition pass)

**Shader compilation errors**
- Cause: Invalid WGSL syntax in shader module
- Fix: Check browser console for WebGPU validation errors

### Logging

Enable verbose logging:

```javascript
// In compositor.ts or shader-pipeline.ts
const DEBUG = true;

if (DEBUG) {
  console.log('[ShaderPipeline] Stage info:', stage);
}
```

## Examples

### Basic Usage

```javascript
const engine = new StorieEngine(canvas);
await engine.init();

// Load effects
await engine.compositor.loadEffect('bloom', '/docs/shaders/wgsl/bloom.wgsl.js');
await engine.compositor.loadEffect('vignette', '/docs/shaders/wgsl/vignette.wgsl.js');

// Build pipeline
await engine.compositor.buildPipeline(['bloom', 'vignette']);

// Adjust parameters
engine.compositor.setEffectUniform('bloom', 'bloomIntensity', 0.7);
engine.compositor.setEffectUniform('vignette', 'vignetteStrength', 1.2);
```

### Dynamic Pipeline

```javascript
let effects = [];

document.getElementById('bloom-toggle').addEventListener('change', async (e) => {
  if (e.target.checked) {
    effects.push('bloom');
  } else {
    effects = effects.filter(fx => fx !== 'bloom');
  }
  await engine.compositor.buildPipeline(effects);
});
```

### Animated Parameters

```javascript
function animate() {
  const time = performance.now() / 1000;
  
  // Pulse bloom
  const intensity = 0.5 + Math.sin(time * 2) * 0.3;
  engine.compositor.setEffectUniform('bloom', 'bloomIntensity', intensity);
  
  // Scroll scanlines
  engine.compositor.setEffectUniform('scanlines', 'scanlineSpeed', 2.0);
  
  requestAnimationFrame(animate);
}
animate();
```

## Shader Library Catalog

See `/docs/shaders/wgsl/` for available effects:

- **bloom.wgsl.js**: Gaussian bloom with brightness extraction
- **blur.wgsl.js**: Gaussian blur
- **border.wgsl.js**: Decorative border overlay
- **clouds.wgsl.js**: Procedural cloud noise
- **crt.wgsl.js**: CRT curvature + frame
- **invert.wgsl.js**: Color inversion
- **paper.wgsl.js**: Paper texture
- **ruledlines.wgsl.js**: Notebook ruled lines
- **scanlines.wgsl.js**: CRT scanlines
- **vignette.wgsl.js**: Edge darkening

Each shader includes documentation and default uniform values.
