# WGSL Shader Application System

Complete guide to using WGSL shaders in Storie for GPU-accelerated visual effects.

## Overview

The shader system provides three main capabilities:
1. **Parsing**: Extract WGSL shaders from markdown code blocks
2. **Compilation**: Compile shaders to GPU pipelines with uniform buffers
3. **Application**: Set uniforms and control shader effects at runtime

## Quick Start

### 1. Define a WGSL Shader

```wgsl fragment:myShader
struct Uniforms {
  time: f32,
  resolution: vec2f,
  intensity: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + 0.5;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSample(inputTexture, inputSampler, input.uv);
}
```

### 2. Control the Shader from JavaScript

```javascript on:update
// Set custom uniform
shader.setUniform("myShader", "intensity", 0.8);

// Activate shader
shader.setActive("myShader");

// Check if shader is registered
if (shader.has("myShader")) {
  term.write(0, 0, "Shader active!", theme.success);
}
```

## JavaScript API Reference

### `shader.list()`
Returns an array of all registered shader names.

```javascript
const shaders = shader.list();
console.log(shaders); // ["colorize", "blur", "ripple"]
```

### `shader.has(name)`
Check if a shader is registered.

```javascript
if (shader.has("colorize")) {
  // Shader exists
}
```

### `shader.info(name)`
Get shader metadata (name, kind, uniforms, bindings).

```javascript
const info = shader.info("colorize");
console.log(info.name);      // "colorize"
console.log(info.kind);      // "fragment"
console.log(info.uniforms);  // [{ name: "colorR", type: "f32", ... }, ...]
```

### `shader.setUniform(shaderName, uniformName, value)`
Set a uniform value. Value can be a number or array of numbers.

```javascript
// Scalar uniform
shader.setUniform("colorize", "intensity", 0.5);

// Vector uniform
shader.setUniform("colorize", "position", [0.5, 0.3]);

// Built-in uniforms (time, resolution) are set automatically
```

### `shader.setActive(name)`
Set the active shader. Pass `null` to disable shader effects.

```javascript
shader.setActive("colorize");  // Enable "colorize" shader
shader.setActive(null);        // Disable all shaders
```

### `shader.getActive()`
Get the currently active shader name (or `null` if none).

```javascript
const active = shader.getActive();
if (active) {
  console.log(`Active shader: ${active}`);
}
```

## WGSL Shader Structure

### Required Components

Every fragment shader must include:

1. **Uniforms struct** with at least `time` and `resolution`:
```wgsl
struct Uniforms {
  time: f32,
  resolution: vec2f,
  // ... your custom uniforms
};
```

2. **Texture bindings**:
```wgsl
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;
@group(0) @binding(2) var<uniform> uniforms: Uniforms;
```

3. **Vertex function** (standard fullscreen quad):
```wgsl
@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + 0.5;
  return output;
}
```

4. **Fragment function** (your effect logic):
```wgsl
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(inputTexture, inputSampler, input.uv);
  // Apply your effect here
  return color;
}
```

### Built-in Uniforms

The shader system automatically provides:
- `time` (f32): Elapsed time in seconds
- `resolution` (vec2f): Canvas dimensions in pixels

### Custom Uniforms

Add any custom uniforms to the `Uniforms` struct. They will be:
1. Parsed automatically
2. Included in uniform buffer with proper alignment
3. Accessible via `shader.setUniform()`

**Important**: All uniforms are aligned to vec4 (16-byte) boundaries. Use `f32` and `vec2f`/`vec3f`/`vec4f` types.

## Shader Types

### Fragment Shaders
Post-processing effects that process each pixel.

```wgsl fragment:sepia
// Sepia tone effect
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(inputTexture, inputSampler, input.uv);
  let gray = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
  let sepia = vec3f(
    gray * 1.2,
    gray * 1.0,
    gray * 0.8
  );
  return vec4f(sepia, color.a);
}
```

### Compute Shaders
General-purpose GPU computation (future support).

```wgsl compute:particles
// Particle simulation (not yet supported)
```

## Magic Block Integration

Shaders can be compressed using magic blocks:

```markdown
<!-- MAGIC_BEGIN compressed:shader
params: 
-->
<!-- MAGIC_DATA zlib base64 -->
H4sIAAAAAAAAA...
<!-- MAGIC_END -->
```

The compressed shader will be decompressed and parsed automatically. See [WGSL_MAGIC_BLOCKS.md](WGSL_MAGIC_BLOCKS.md) for details.

## Examples

### Color Tint Effect

```wgsl fragment:tint
struct Uniforms {
  time: f32,
  resolution: vec2f,
  tintR: f32,
  tintG: f32,
  tintB: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + 0.5;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(inputTexture, inputSampler, input.uv);
  let tint = vec3f(uniforms.tintR, uniforms.tintG, uniforms.tintB);
  return vec4f(color.rgb * tint, color.a);
}
```

```javascript on:init
// Set tint to magenta
shader.setUniform("tint", "tintR", 1.0);
shader.setUniform("tint", "tintG", 0.3);
shader.setUniform("tint", "tintB", 1.0);
shader.setActive("tint");
```

### Animated Wave Effect

```wgsl fragment:wave
struct Uniforms {
  time: f32,
  resolution: vec2f,
  amplitude: f32,
  frequency: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = pos * 0.5 + 0.5;
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var uv = input.uv;
  // Apply wave distortion
  let wave = sin(uv.y * uniforms.frequency + uniforms.time) * uniforms.amplitude;
  uv.x += wave;
  return textureSample(inputTexture, inputSampler, uv);
}
```

```javascript on:update
// Animate wave parameters
shader.setUniform("wave", "amplitude", 0.02);
shader.setUniform("wave", "frequency", 10.0);
shader.setActive("wave");
```

## Architecture

### Processing Pipeline

1. **Parsing** (markdown.ts):
   - Magic blocks expanded first
   - WGSL blocks extracted with metadata
   - Uniforms/bindings parsed from code

2. **Registration** (engine.ts):
   - Shaders registered after markdown load
   - WebGPU shader modules created
   - Uniform buffers allocated and aligned

3. **Runtime** (shader-manager.ts):
   - Uniforms updated per frame
   - Active shader applied to textures
   - Built-in uniforms (time, resolution) auto-updated

### Files

- `src/shader-manager.ts` - High-level shader compilation and application
- `src/wgsl-parser.ts` - WGSL code parsing and metadata extraction
- `src/magic.ts` - Magic block decompression for shader compression
- `src/engine.ts` - Shader registration and API exposure
- `src/sandbox.ts` - JavaScript API interface definition

## Limitations

1. **Application Integration**: Shaders are compiled but not yet integrated with compositor rendering pipeline
2. **Compute Shaders**: Only fragment shaders currently supported
3. **Multiple Shaders**: Only one shader can be active at a time
4. **Texture Formats**: Assumes rgba8unorm format

## Future Enhancements

- [ ] Compositor integration for automatic shader application
- [ ] Shader chaining (multiple effects in sequence)
- [ ] Compute shader support for particle systems
- [ ] Custom texture inputs beyond main render target
- [ ] Shader presets library

## Troubleshooting

### "Shader not found"
- Check that WGSL block has correct syntax: ` ```wgsl fragment:name`
- Verify shader name matches exactly (case-sensitive)
- Confirm WebGPU is initialized before shader usage

### "Failed to compile shader"
- Validate WGSL syntax with browser DevTools
- Ensure all required bindings present (@group/@binding)
- Check uniform alignment (use vec4 padding if needed)

### Uniforms not updating
- Verify uniform name matches Uniforms struct
- Check value type (number or number array)
- Ensure shader is registered before setUniform() call

## See Also

- [WGSL_MAGIC_BLOCKS.md](WGSL_MAGIC_BLOCKS.md) - Compress shaders with magic blocks
- [WGSL_IMPLEMENTATION_SUMMARY.md](WGSL_IMPLEMENTATION_SUMMARY.md) - Technical implementation details
- [SHADER_PIPELINE_SUMMARY.md](SHADER_PIPELINE_SUMMARY.md) - Legacy shader pipeline system
