---
title: Magic Shader Demo
---

# CRT Shader from Magic Block

This demo showcases the magic block compression system with a full CRT shader. The shader code (~4.5KB) is compressed into a magic block (~2KB) and decompressed at runtime.

```magic
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
```

```javascript
// Persistent state for controls
let curveStrength = 0.95;
let frameSize = 20.0;
let frameHue = 0.025;
let frameSat = 0.0;
let frameLight = 0.01;
let frameReflect = 0.35;
let frameGrain = 0.25;
```

```javascript on:update
// Clear screen
term.clear();

// Title and description
term.write(0, 0, "╔═══════════════════════════════════════════════════════╗", theme.accent1);
term.write(0, 1, "║  RETRO TERMINAL - CRT SHADER DEMONSTRATION            ║", theme.accent1);
term.write(0, 2, "╚═══════════════════════════════════════════════════════╝", theme.accent1);
term.write(0, 3, "", theme.fg);

// Content area for display
let y = 4;
term.write(0, y++, "  This content is rendered with the CRT shader effect.", theme.fg);
term.write(0, y++, "  The shader includes:", theme.fg);
term.write(0, y++, "    • Screen curvature simulation", theme.accent2);
term.write(0, y++, "    • Decorative frame with grain texture", theme.accent2);
term.write(0, y++, "    • Frame reflection of screen content", theme.accent2);
term.write(0, y++, "    • Animated lighting effect", theme.accent2);
y++;

// Show shader info
const shaders = shader.list();
term.write(0, y++, "  Shader Status:", theme.success);
if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('crt')) || shaders[0];
  term.write(0, y++, `    ✓ Registered: ${shaderName}`, theme.success);
  
  const info = shader.info(shaderName);
  if (info) {
    term.write(0, y++, `    ✓ Type: ${info.kind}`, theme.success);
    term.write(0, y++, `    ✓ Coordinate Transform: ${info.coordinateTransform || 'none'}`, theme.success);
    
    // Activate shader if not already active
    if (shader.getActive() !== shaderName) {
      shader.setActive(shaderName);
      term.write(0, y++, "    ✓ Shader activated", theme.success);
    }
  }
}
y++;

// Interactive controls section
term.write(0, y++, "  Shader Controls:", theme.accent2);
term.write(0, y++, "  ─────────────────────────────────────────────────────", theme.dim);
term.write(0, y++, `  [Q/W] Curve:       ${curveStrength.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [A/S] Frame Size:  ${frameSize.toFixed(0)} px`, theme.fg);
term.write(0, y++, `  [Z/X] Frame Hue:   ${frameHue.toFixed(3)}`, theme.fg);
term.write(0, y++, `  [E/R] Frame Sat:   ${frameSat.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [D/F] Frame Light: ${frameLight.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [C/V] Reflection:  ${frameReflect.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [T/Y] Grain:       ${frameGrain.toFixed(2)}`, theme.fg);
y++;

// Magic block info
term.write(0, y++, "  Magic Block Compression:", theme.accent1);
term.write(0, y++, "    Original shader: ~4.5 KB", theme.dim);
term.write(0, y++, "    Compressed:      ~2.0 KB (44.8%)", theme.dim);
term.write(0, y++, "    Format:          zlib/base64", theme.dim);
y++;

// Footer decoration
term.write(0, y++, "  ─────────────────────────────────────────────────────", theme.dim);
term.write(0, y++, "  Press keys above to adjust shader parameters", theme.dim);

// Apply current uniform values to shader
if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('crt')) || shaders[0];
  shader.setUniform(shaderName, 'curveStrength', curveStrength);
  shader.setUniform(shaderName, 'frameSize', frameSize);
  shader.setUniform(shaderName, 'frameHue', frameHue);
  shader.setUniform(shaderName, 'frameSat', frameSat);
  shader.setUniform(shaderName, 'frameLight', frameLight);
  shader.setUniform(shaderName, 'frameReflect', frameReflect);
  shader.setUniform(shaderName, 'frameGrain', frameGrain);
}
```

```javascript on:input
// Handle keyboard controls for shader parameters
if (!event || event.type !== 'keydown') return;

const key = event.key.toLowerCase();
const shaders = shader.list();

if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('crt')) || shaders[0];
  
  switch(key) {
    // Curve strength
    case 'q':
      curveStrength = Math.max(0.0, curveStrength - 0.05);
      shader.setUniform(shaderName, 'curveStrength', curveStrength);
      break;
    case 'w':
      curveStrength = Math.min(2.0, curveStrength + 0.05);
      shader.setUniform(shaderName, 'curveStrength', curveStrength);
      break;
    
    // Frame size
    case 'a':
      frameSize = Math.max(0.0, frameSize - 2.0);
      shader.setUniform(shaderName, 'frameSize', frameSize);
      break;
    case 's':
      frameSize = Math.min(100.0, frameSize + 2.0);
      shader.setUniform(shaderName, 'frameSize', frameSize);
      break;
    
    // Frame hue
    case 'z':
      frameHue = Math.max(0.0, frameHue - 0.01);
      shader.setUniform(shaderName, 'frameHue', frameHue);
      break;
    case 'x':
      frameHue = Math.min(1.0, frameHue + 0.01);
      shader.setUniform(shaderName, 'frameHue', frameHue);
      break;
    
    // Frame saturation
    case 'e':
      frameSat = Math.max(0.0, frameSat - 0.05);
      shader.setUniform(shaderName, 'frameSat', frameSat);
      break;
    case 'r':
      frameSat = Math.min(1.0, frameSat + 0.05);
      shader.setUniform(shaderName, 'frameSat', frameSat);
      break;
    
    // Frame light
    case 'd':
      frameLight = Math.max(0.0, frameLight - 0.01);
      shader.setUniform(shaderName, 'frameLight', frameLight);
      break;
    case 'f':
      frameLight = Math.min(1.0, frameLight + 0.01);
      shader.setUniform(shaderName, 'frameLight', frameLight);
      break;
    
    // Frame reflection
    case 'c':
      frameReflect = Math.max(0.0, frameReflect - 0.05);
      shader.setUniform(shaderName, 'frameReflect', frameReflect);
      break;
    case 'v':
      frameReflect = Math.min(1.0, frameReflect + 0.05);
      shader.setUniform(shaderName, 'frameReflect', frameReflect);
      break;
    
    // Frame grain
    case 't':
      frameGrain = Math.max(0.0, frameGrain - 0.05);
      shader.setUniform(shaderName, 'frameGrain', frameGrain);
      break;
    case 'y':
      frameGrain = Math.min(1.0, frameGrain + 0.05);
      shader.setUniform(shaderName, 'frameGrain', frameGrain);
      break;
  }
}
```
