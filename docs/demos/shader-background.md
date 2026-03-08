---
title: "Shader Background Demo"
author: "Maddest Labs"
theme: "saintbilly"
shaders: "blurgradual"
font: "Rye"
---

# Shader Background Demo

This demo shows how to use custom fragment shaders as backgrounds in Worlds 3D, including both inline WGSL shaders and existing shaders from the `docs/shaders/` directory.

```wgsl fragment:gradient-bg
struct Uniforms {
  time: f32,
  resolution: vec2f,
  speed: f32,
  intensity: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;

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
  let t = uniforms.time * uniforms.speed;
  let uv = input.uv;
  
  // Create animated gradient
  let r = sin(uv.x * 3.14159 + t) * 0.5 + 0.5;
  let g = sin(uv.y * 3.14159 + t * 1.3) * 0.5 + 0.5;
  let b = sin((uv.x + uv.y) * 1.57 + t * 0.7) * 0.5 + 0.5;
  
  let color = vec3f(r, g, b) * uniforms.intensity;
  return vec4f(color, 1.0);
}
```

```javascript on:init
// Enable 3D Worlds
worlds.enable();
console.log('✓ 3D Canvas enabled!');

// Configure Worlds with custom shader background
worlds.config.setDefaults({
  sectionSizeUnits: 'px',
  defaultSectionWidth: 800,
  defaultSectionHeight: 500,
  autoLayoutSpacing: 100,
  sectionBorderEnabled: false,
  // Use custom inline shader as background
  sectionBackground: 'shader:gradient-bg;speed=1.0;intensity=0.8',
});

// Set up camera
worlds.camera.setPosition(0, 50, 300);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setFOV(Math.PI / 4);
worlds.camera.setEaseSpeed(0.15, 0.12);

// Focus on first section
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
```

# Introduction

Welcome to the **Shader Background Demo**! This section demonstrates how custom fragment shaders can be used as backgrounds in Worlds 3D.

The background is rendered using a custom WGSL shader that creates an animated gradient effect. Notice how the background moves and warps naturally with the 3D camera movement.

## Features

- **Inline WGSL Shaders**: Define shaders directly in your markdown
- **Existing Shader Library**: Use shaders from `docs/shaders/` directory
- **World-Space Coordinates**: Backgrounds maintain proper perspective and movement
- **Runtime Uniforms**: Control shader parameters dynamically
- **Seamless Integration**: Works with existing Worlds features

## How It Works

1. Define a WGSL fragment shader in your markdown or reference existing shaders
2. Configure `sectionBackground` with `shader:name;param1=value1;param2=value2`
3. The shader renders to the background texture
4. Worlds composites sections over the shader background

# Built-in Shader Background

[Switch to built-in vignette shader](#vignette-background)

# Vignette Background

This section uses the `lightvignette` shader from the built-in shader library.

```javascript on:enter
// Switch to built-in shader background
worlds.config.setDefaults({
  sectionBackground: 'shader:lightvignette;vignetteStart=0.5;vignetteLvl=20.0',
});
```

The `lightvignette` shader creates a soft vignette effect that darkens toward the edges. This shader is loaded automatically from `docs/shaders/lightvignette.wgsl.js` when referenced.

## Built-in Shader Benefits

- **No Code Duplication**: Reuse existing shader effects
- **Performance**: Pre-optimized shaders
- **Compatibility**: Tested across different hardware
- **Automatic Loading**: Shaders load on-demand

# Technical Details

The shader background system:

- **Preserves World Coordinates**: Uses the same `paperCoordFromScreenUv()` function for consistent world-space positioning
- **Maintains Performance**: Shaders compile once and reuse efficiently
- **Supports Uniforms**: Runtime control of shader parameters
- **Falls Back Gracefully**: If shader fails, falls back to procedural backgrounds

## Dynamic Shader Control

You can change shader uniforms at runtime:

```javascript
// Update shader parameters
shader.setUniform('gradient-bg', 'speed', 2.0);
shader.setUniform('gradient-bg', 'intensity', 1.0);

// Or for built-in shaders
shader.setUniform('lightvignette', 'vignetteStart', 0.3);
shader.setUniform('lightvignette', 'vignetteLvl', 30.0);
```

## Multiple Background Types

The system supports:
- **Procedural**: `sectionBackground: 'paper+ruledlines'`
- **Inline Shader**: `sectionBackground: 'shader:gradient-bg;speed=1.0'`
- **Built-in Shader**: `sectionBackground: 'shader:lightvignette;vignetteStart=0.5'`
- **Combined**: Mix procedural and shader elements

# Conclusion

Shader backgrounds open up endless possibilities for creating immersive 3D environments in Storie!

[Back to Introduction](#introduction)