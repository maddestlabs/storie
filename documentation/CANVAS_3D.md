# 3D Canvas System

The **3D Canvas** system extends Storie's section-based rendering into true 3D space using WebGPU hardware acceleration. Sections can be positioned, rotated, and scaled in 3D, with smooth camera transitions and real-time animations.

## Overview

- **Hardware Accelerated**: Uses WebGPU for real 3D rendering (not terminal ASCII art)
- **Section-Based**: Your markdown sections become 3D quads in space
- **Smooth Camera**: Automatic easing between section views
- **Runtime Animation**: Transform sections dynamically in your code
- **Metadata-Driven**: Configure 3D properties via section heading metadata

## Quick Start

### 1. Enable 3D Mode

```javascript
// In your on:init handler
// Safe to call unconditionally — enable() is treated as a request.
// If WebGPU isn’t available, canvas3D.available will be false.
canvas3D.enable();
console.log('✓ 3D Canvas requested');

if (!canvas3D.available) {
  console.warn('WebGPU not available — 3D sections will not render');
}
```

### 2. Position Sections in 3D

Use metadata in your section headings:

```markdown
# Welcome {"x": "0", "y": "0", "z": "0"}

# Front Panel {"x": "0", "y": "0", "z": "-50", "rotate-y": "0"}

# Side Panel {"x": "50", "y": "0", "z": "0", "rotate-y": "90"}

# Top Panel {"x": "0", "y": "50", "z": "0", "rotate-x": "90"}
```

### 3. Navigate with Camera

```javascript
// Focus on a section (smooth ease)
canvas3D.camera.focusOnSection(sectionIndex, distance);

// Or set camera directly
canvas3D.camera.setPosition(x, y, z);
canvas3D.camera.setRotation(rx, ry, rz);

// Smooth movement
canvas3D.camera.moveTo(x, y, z);
```

## Section Metadata

Configure 3D properties in section headings using JSON metadata:

```markdown
# Section Title {"x": "100", "y": "50", "z": "-20", "rotate-x": "45", "rotate-y": "30", "rotate-z": "10", "scale": "1.5", "width": "80", "height": "30"}
```

### Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `x` | number | 0 | X position in world space |
| `y` | number | 0 | Y position in world space |
| `z` (or `depth`) | number | `defaultDepth` (-100) | Z position (negative = further) |
| `rotate-x` | degrees | 0 | Rotation around X axis (pitch) |
| `rotate-y` | degrees | 0 | Rotation around Y axis (yaw) |
| `rotate-z` | degrees | 0 | Rotation around Z axis (roll) |
| `scale` | number | 1.0 | Uniform scale multiplier |
| `width` | number | `defaultSectionWidth` (60) | Section width in characters |
| `height` | number | `defaultSectionHeight` (20) | Section height in lines |
| `hidden` | boolean | false | Hide from navigation |
| `navigable` | boolean | true | Allow navigation to section |

## API Reference

### `canvas3D` Object

Main 3D canvas API exposed to user scripts.

#### Enable/Disable

```javascript
canvas3D.enable()        // Request 3D rendering mode (returns true if available now)
canvas3D.disable()       // Disable 3D rendering mode
canvas3D.enabled         // Check if currently enabled (boolean)
canvas3D.available       // Check if WebGPU is available (boolean)
```

#### Built-in Controls

Canvas3D has optional built-in navigation controls (WASD + QE + right-drag mouse-look).

```javascript
canvas3D.controls.setEnabled(true)
canvas3D.controls.enabled
```

#### Camera Control

```javascript
// Position
canvas3D.camera.setPosition(x, y, z)
canvas3D.camera.getPosition()  // Returns {x, y, z}

// Rotation (radians)
canvas3D.camera.setRotation(x, y, z)
canvas3D.camera.getRotation()  // Returns {x, y, z}

// Smooth movement
canvas3D.camera.moveTo(x, y, z)

// Focus on section
canvas3D.camera.focusOnSection(sectionIndex, distance = 50)

// Focus and fit the whole card in view
canvas3D.camera.focusOnSectionFit(sectionIndex, fill = 0.9)

// Field of view
canvas3D.camera.setFOV(fov)  // fov in radians (default: Math.PI/4)

// Easing speed (0-1, higher = faster)
canvas3D.camera.setEaseSpeed(positionSpeed, rotationSpeed)
```

#### Section Transforms

```javascript
// Get section layout
const layout = canvas3D.getSectionLayout(sectionIndex);
// Returns: { position, rotation, scale, width, height, visible, navigable }

// Set section transform at runtime
canvas3D.setSectionTransform(sectionIndex, {
  position: { x: 100, y: 50, z: -20 },      // Optional
  rotation: { x: 45, y: 30, z: 10 },         // Optional (degrees)
  scale: { x: 1.5, y: 1.5, z: 1.0 }          // Optional
});

// Show/hide section
canvas3D.setSectionVisible(sectionIndex, visible);

// Get total section count
const count = canvas3D.getSectionCount();
```

#### Configuration

```javascript
// Set default values
canvas3D.config.setDefaults({
  defaultDepth: 0,                // Default Z position
  defaultSectionWidth: 60,        // Default width
  defaultSectionHeight: 20,       // Default height

  // Auto-layout (applies when x/y aren’t specified in metadata)
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,         // Spacing between auto-laid-out sections (world units)

  // Section texture rendering mode
  sectionTextureMode: 'canvas2d', // 'canvas2d' | 'webgpu-ui'

  sectionBackground: 'surface',   // Section background: 'surface' | 'bg' | 'bgAlt' | 'accent1' | '#RRGGBB' | 0xRRGGBBAA
  sectionBorderEnabled: true,     // Draw a border around each section
  sectionBorderWidth: 2,          // Border thickness (pixels)
  cameraFov: Math.PI / 4,         // Field of view (45°)
  cameraNear: 0.1,                // Near clipping plane
  cameraFar: 1000,                // Far clipping plane
  positionEaseSpeed: 0.1,         // Camera position ease speed
  rotationEaseSpeed: 0.15         // Camera rotation ease speed
});

// Get current defaults
const config = canvas3D.config.getDefaults();
```

## Common Patterns

### Navigation Links

Use section links with automatic camera focus:

```markdown
# Hub Section

- [Go to Front](#front-panel)
- [Go to Side](#side-panel)
- [Go to Top](#top-panel)
```

```javascript
// In each section's on:enter handler
canvas3D.camera.focusOnSection(sectionIndex, 80);
```

### Circular Layout

Position sections in a ring:

```javascript
const count = 8;
const radius = 100;

for (let i = 0; i < count; i++) {
  const angle = (i / count) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const rotY = -angle * (180 / Math.PI); // Face center
  
  canvas3D.setSectionTransform(i, {
    position: { x, y: 0, z },
    rotation: { x: 0, y: rotY, z: 0 }
  });
}
```

### Orbit Animation

Animate sections in circular motion:

```javascript
let time = 0;

// on:update handler
time += getDelta();
const angle = time * 0.5; // 0.5 rad/sec
const radius = 60;

canvas3D.setSectionTransform(sectionIndex, {
  position: {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z: 0
  }
});
```

### Rotation Animation

Continuous spinning:

```javascript
let time = 0;

// on:update handler
time += getDelta();

canvas3D.setSectionTransform(sectionIndex, {
  rotation: {
    x: 0,
    y: time * 50, // 50 degrees/second
    z: 0
  }
});
```

### Scale Pulse

Breathing/pulsing effect:

```javascript
let time = 0;

// on:update handler
time += getDelta();
const scale = 1.0 + Math.sin(time * 2) * 0.3;

canvas3D.setSectionTransform(sectionIndex, {
  scale: { x: scale, y: scale, z: 1 }
});
```

### Manual Camera Control

WASD-style camera movement:

```javascript
// on:update handler
const speed = 50;
const pos = canvas3D.camera.getPosition();

if (key.down('w')) {
  canvas3D.camera.setPosition(pos.x, pos.y, pos.z - speed * getDelta());
}
if (key.down('s')) {
  canvas3D.camera.setPosition(pos.x, pos.y, pos.z + speed * getDelta());
}
if (key.down('a')) {
  canvas3D.camera.setPosition(pos.x - speed * getDelta(), pos.y, pos.z);
}
if (key.down('d')) {
  canvas3D.camera.setPosition(pos.x + speed * getDelta(), pos.y, pos.z);
}
```

## Coordinate System

- **X axis**: Right is positive
- **Y axis**: Up is positive
- **Z axis**: Forward (towards camera) is positive, away is negative
- **Rotations**: In degrees in metadata, radians in API
- **Units**: Abstract units (roughly matched to character width/height)

## Performance Tips

1. **Limit visible sections**: Use `hidden: true` for off-screen sections
2. **Batch transforms**: Update multiple sections in one `on:update` call
3. **Use easing**: Let the camera ease naturally instead of jumping
4. **Reduce rotation updates**: Only animate what's visible
5. **Test on target hardware**: WebGPU performance varies by GPU

## Debugging

```javascript
// Log section layouts
for (let i = 0; i < canvas3D.getSectionCount(); i++) {
  const layout = canvas3D.getSectionLayout(i);
  console.log(`Section ${i}:`, layout);
}

// Log camera state
console.log('Camera pos:', canvas3D.camera.getPosition());
console.log('Camera rot:', canvas3D.camera.getRotation());

// Check availability
if (!canvas3D.available) {
  console.warn('WebGPU not available - 3D canvas disabled');
}
```

## Examples

See these demo documents:

- [canvas3d-demo.md](demos/canvas3d-demo.md) - Basic 3D positioning and camera
- [canvas3d-animation.md](demos/canvas3d-animation.md) - Runtime animations

## Architecture

The 3D canvas system consists of:

- **Canvas3DRenderer**: WebGPU renderer for 3D quads
- **Camera3D**: 3D camera with position, rotation, and easing
- **Transform3D**: Section transform (position, rotation, scale)
- **Section3DLayout**: Per-section 3D configuration
- **WGSL Shaders**: Vertex/fragment shaders for 3D rendering

All rendering is done on the GPU with hardware acceleration, providing smooth 60fps performance even with many sections.

## Browser Support

Requires **WebGPU** support:

- ✅ Chrome/Edge 113+
- ✅ Firefox 121+ (with `dom.webgpu.enabled` flag)
- ❌ Safari (WebGPU in development)

Fallback behavior: 3D canvas API is available but `canvas3D.available` returns `false`.

## TypeScript Types

```typescript
import type {
  Vec3,
  Transform3D,
  Camera3D,
  Section3DLayout,
  Canvas3DConfig
} from 'storie';

// Example
const defaults: Partial<Canvas3DConfig> = {
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,
  sectionTextureMode: 'canvas2d',
  sectionBackground: 'surface',
  sectionBorderEnabled: true,
  sectionBorderWidth: 2
};
```

See [canvas3d-types.ts](../src/canvas3d-types.ts) for full type definitions.
