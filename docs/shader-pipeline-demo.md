# Shader Pipeline Demo

This demo shows how to use the shader pipeline system to chain post-processing effects.

The shader pipeline allows you to:
1. Load WGSL shader effects
2. Chain them together
3. Apply the chain as a post-processing pass

## Example: Bloom + Scanlines + CRT

```javascript
import { createStorieSystem } from './storie.es.js';

const system = await createStorieSystem(document.getElementById('canvas'));
await system.init();

// Load shader effects from the library
await system.compositor.loadEffect('bloom', '/docs/shaders/wgsl/bloom.wgsl.js');
await system.compositor.loadEffect('scanlines', '/docs/shaders/wgsl/scanlines.wgsl.js');
await system.compositor.loadEffect('crt', '/docs/shaders/wgsl/crt.wgsl.js');

// Build a pipeline chain
await system.compositor.buildPipeline(['bloom', 'scanlines', 'crt']);

// Adjust effect parameters
system.compositor.setEffectUniform('bloom', 'bloomIntensity', 0.8);
system.compositor.setEffectUniform('bloom', 'bloomRadius', 3.0);
system.compositor.setEffectUniform('scanlines', 'scanlineStrength', 0.5);
system.compositor.setEffectUniform('crt', 'curveStrength', 0.3);

// Render content
system.terminal.write('\\x1b[1;32mShader Pipeline Demo\\x1b[0m\\n');
system.terminal.write('Effects: Bloom → Scanlines → CRT\\n');

// If you want to disable the pipeline temporarily
system.compositor.setPipelineEnabled(false);

// Re-enable it
system.compositor.setPipelineEnabled(true);
```

## Available Shaders

The following shaders are available in `/docs/shaders/wgsl/`:

### bloom.wgsl.js
Gaussian bloom with brightness extraction.
- `bloomIntensity` (0.0-2.0): Bloom strength
- `bloomRadius` (0.0-10.0): Blur radius
- `bloomThreshold` (0.0-1.0): Brightness threshold
- `bloomSoftness` (0.0-1.0): Threshold softness

### scanlines.wgsl.js
Horizontal scanline overlay.
- `scanlineStrength` (0.0-1.0): Line opacity
- `scanlineWidth` (1.0-10.0): Line spacing in pixels
- `scanlineSpeed` (-5.0-5.0): Scroll speed

### crt.wgsl.js
CRT screen curvature with decorative frame.
- `curveStrength` (0.0-1.0): Barrel distortion amount
- `frameSize` (0.0-0.5): Frame thickness
- `frameHue`, `frameSat`, `frameLight`: Frame HSL color
- `frameReflect` (0.0-1.0): Frame shininess
- `frameGrain` (0.0-1.0): Noise amount

### blur.wgsl.js
Gaussian blur.
- `blurRadius` (0.0-20.0): Blur amount

### vignette.wgsl.js
Darkens edges for focus.
- `vignetteStrength` (0.0-2.0): Effect intensity
- `vignetteRadius` (0.0-2.0): Falloff radius

### invert.wgsl.js
Inverts colors.
- `invertAmount` (0.0-1.0): Mix amount

### clouds.wgsl.js
Procedural cloud overlay.
- `cloudScale` (0.1-10.0): Noise scale
- `cloudSpeed` (0.0-5.0): Animation speed
- `cloudOpacity` (0.0-1.0): Visibility

### paper.wgsl.js
Paper texture overlay.
- `paperStrength` (0.0-1.0): Texture intensity

### border.wgsl.js
Decorative border.
- `borderWidth` (0.0-100.0): Border thickness in pixels
- `borderColor`: RGB color array

### ruledlines.wgsl.js
Notebook ruled lines.
- `lineSpacing` (10.0-100.0): Space between lines
- `lineThickness` (0.5-5.0): Line width
- `lineColor`: RGB color array

## Building Custom Pipelines

You can create any combination of effects:

```javascript
// Subtle enhancement
await system.compositor.buildPipeline(['vignette', 'paper']);

// Retro terminal
await system.compositor.buildPipeline(['scanlines', 'crt', 'vignette']);

// Dream state
await system.compositor.buildPipeline(['blur', 'bloom', 'clouds']);

// Notebook style
await system.compositor.buildPipeline(['paper', 'ruledlines', 'vignette']);
```

## Dynamic Effect Control

Effects can be animated by updateing uniforms in your render loop:

```javascript
function animate() {
  const time = performance.now() / 1000;
  
  // Pulse bloom
  const bloomIntensity = 0.5 + Math.sin(time) * 0.3;
  system.compositor.setEffectUniform('bloom', 'bloomIntensity', bloomIntensity);
  
  // Scroll scanlines
  system.compositor.setEffectUniform('scanlines', 'scanlineSpeed', 2.0);
  
  requestAnimationFrame(animate);
}
animate();
```

## Performance Notes

- Each effect in the pipeline is a separate GPU pass
- Keep chains short (3-5 effects) for best performance
- Blur and bloom are the most expensive (multiple texture samples)
- Simple effects like invert and vignette are very cheap

## Order Matters

The order of effects impacts the final visual:

```javascript
// Bloom then blur - soft glowing
['bloom', 'blur']

// Blur then bloom - extracts blur as bloom
['blur', 'bloom']

// CRT last - everything gets curved
['bloom', 'scanlines', 'crt']

// CRT first - only terminal content is curved
['crt', 'bloom', 'scanlines']
```
