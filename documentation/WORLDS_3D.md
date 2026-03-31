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
// If WebGPU isn’t available, worlds.available will be false.
worlds.enable();
console.log('✓ 3D Canvas requested');

if (!worlds.available) {
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
worlds.camera.focusOnSection(sectionIndex, distance);

// Or set camera directly
worlds.camera.setPosition(x, y, z);
worlds.camera.setRotation(rx, ry, rz);

// Smooth movement
worlds.camera.moveTo(x, y, z);
```

## Section Metadata

Configure 3D properties in section headings using a trailing directive object:

```markdown
# Section Title {x: 100, y: 50, z: -20, rotate-x: 45, rotate-y: 30, rotate-z: 10, scale: 1.5, opacity: 0.4, width: 80, height: 30, interactive: false, render: content}
```

Strict JSON also works and is still the better option when you need nested data or exact JSON interoperability.

Card content uses the shared lightweight markdown renderer. In addition to headings, paragraphs, and links, Worlds cards now support lists, callouts (`> [!TIP]`), standalone blob-backed markdown images with optional width/alignment metadata, ASCII fenced blocks, blockquotes (`>`), and horizontal rules (`---`, `***`, `___`).

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
| `opacity` | number | 1.0 | Card alpha multiplier (0..1) |
| `width` | number | `defaultSectionWidth` (60) | Section width in characters |
| `height` | number | `defaultSectionHeight` (20) | Section height in lines |
| `render` | enum | `all` | Card composition: `all`, `heading`, `content`, or `none` |
| `hidden` | boolean | false | Hide the whole card and exclude it from normal navigation |
| `hiddenUntilVisited` | boolean | false | Start hidden; reveal the first time the section is navigated to |
| `removeAfterVisit` | boolean | false | After leaving the section once, hide it permanently |
| `navigable` | boolean | true | Allow navigation to section |
| `interactive` | boolean | true | Include card in picking/link interaction |

## API Reference

### `worlds` Object

`worlds.config.setDefaults({ sectionRender })` sets the default card composition for the whole document. A section heading with explicit `render: ...` metadata still wins.

`worlds.config.setDefaults({ autoHideSectionsUntilVisited: true })` makes all sections start hidden until first navigation, unless overridden by a section's `hiddenUntilVisited` heading directive.

Main 3D canvas API exposed to user scripts.

#### Enable/Disable

```javascript
worlds.enable()        // Request 3D rendering mode (returns true if available now)
worlds.disable()       // Disable 3D rendering mode
worlds.enabled         // Check if currently enabled (boolean)
worlds.available       // Check if WebGPU is available (boolean)
```

#### Built-in Controls

Worlds has optional built-in navigation controls (WASD + QE + right-drag mouse-look).

```javascript
worlds.controls.setEnabled(true)
worlds.controls.enabled
```

#### Built-in 3D Link Key Handling

When 3D Canvas is enabled, Storie also provides built-in keyboard navigation for
**3D link focus + activation** (Tab/Enter/Arrow keys). This is convenient for
docs where you want keyboard-accessible link navigation.

For slide decks / presenter apps, you may want to disable this so your document
can own those keys.

```javascript
// Disable Worlds's built-in Tab/Enter/Arrow handling
worlds.links.setKeyHandlingEnabled(false)

// Check current state
console.log(worlds.links.keyHandlingEnabled)
```

#### Camera Control

```javascript
// Position
worlds.camera.setPosition(x, y, z)
worlds.camera.getPosition()  // Returns {x, y, z}

// Rotation (radians)
worlds.camera.setRotation(x, y, z)
worlds.camera.getRotation()  // Returns {x, y, z}

// Smooth movement
worlds.camera.moveTo(x, y, z)

// Focus on section
worlds.camera.focusOnSection(sectionIndex, distance = 50, options?)

// options (all optional)
// - keepRotation: boolean           // if true, focus moves position only
// - positionOffset: {x,y,z}         // adds a world-space offset to the computed target position
// - rotationOffset: {x,y,z}         // adds an offset (radians) to the computed target rotation

// Focus and fit the whole card in view
worlds.camera.focusOnSectionFit(sectionIndex, fill = 0.9, options?)

// Frame a set of sections using their real world transforms (no relayout)
worlds.camera.frameSections(sections?, options?)

// Bird's-eye framing convenience helper for the current scene
worlds.camera.birdsEye(options?)

// frame/birdsEye options
// - sections: number | string | Array<number|string>   // optional explicit section selectors
// - fill: number                                       // viewport fill fraction
// - padding: number                                    // extra world-space padding around bounds
// - includeHidden: boolean                             // include hidden sections when no explicit list is provided
// - includeNonNavigable: boolean                       // include non-navigable sections when no explicit list is provided
// - rotation: {x,y,z}                                  // for frameSections, explicit camera rotation in radians

// birdsEye-only options
// - view: 'oblique' | 'top'                            // default: 'oblique'
// - pitch: number                                      // override default view pitch in radians
// - yaw: number                                        // override default view yaw in radians
// - roll: number                                       // override default view roll in radians

// Field of view
worlds.camera.setFOV(fov)  // fov in radians (default: Math.PI/4)

// Easing speed (0-1, higher = faster)
worlds.camera.setEaseSpeed(positionSpeed, rotationSpeed)
```

#### Section Transforms

```javascript
// Get section layout
const layout = worlds.getSectionLayout(sectionIndex);
// Returns: { position, rotation, scale, width, height, renderMode, visible, navigable }

// Set section transform at runtime
worlds.setSectionTransform(sectionIndex, {
  position: { x: 100, y: 50, z: -20 },      // Optional
  rotation: { x: 45, y: 30, z: 10 },         // Optional (degrees)
  scale: { x: 1.5, y: 1.5, z: 1.0 }          // Optional
});

// Show/hide section
worlds.setSectionVisible(sectionIndex, visible);

// Get total section count
const count = worlds.getSectionCount();

// Experimental runtime section CRUD
const inserted = worlds.sections.insert({ title: 'Spawned Room', content: 'Generated at runtime.' });
worlds.sections.move(inserted.sectionId, { index: 0 });
worlds.sections.update(inserted.sectionId, { title: 'Spawned Room A' });
const current = worlds.sections.get(inserted.sectionId);
```

#### Configuration

```javascript
// Set default values
worlds.config.setDefaults({
  defaultDepth: 0,                // Default Z position
  defaultSectionWidth: 60,        // Default width
  defaultSectionHeight: 20,       // Default height
  sectionClickFocusEnabled: true, // Non-link card clicks/taps focus the section

  // Auto-layout (applies when x/y aren’t specified in metadata)
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,         // Spacing between auto-laid-out sections (world units)

  // Section texture rendering mode
  sectionTextureMode: 'canvas2d', // 'canvas2d' | 'webgpu-ui'

  // Section overflow / auto-resize behavior
  // - 'clip' (default): fixed-size cards
  // - 'expand': only grow to fit content
  // - 'expand-y': only grow height to fit content
  // - 'fit': shrink or grow to tightly fit content
  // - 'fit-y': shrink or grow height to fit content
  sectionOverflow: 'clip',

  sectionBackground: 'surface',   // Section background: 'surface' | 'bg' | 'bgAlt' | 'accent1' | '#RRGGBB' | 0xRRGGBBAA
  sectionBorderEnabled: true,     // Draw a border around each section
  sectionBorderWidth: 2,          // Border thickness (pixels)
  sectionLinkUnderline: false,    // Underline markdown links rendered into Worlds cards
  sectionListMarker: '> ',        // Optional list marker string for Worlds card markdown
  sectionListMarkerGapPx: 0,      // Optional extra gap between marker and list text
  sectionListHangIndentPx: 0,     // Optional hanging indent for wrapped list lines
  cameraFov: Math.PI / 4,         // Field of view (45°)
  cameraNear: 0.1,                // Near clipping plane
  cameraFar: 1000,                // Far clipping plane
  positionEaseSpeed: 0.1,         // Camera position ease speed
  rotationEaseSpeed: 0.15         // Camera rotation ease speed
});

// Get current defaults
const config = worlds.config.getDefaults();
```

If you want Worlds cards to behave more like passive surfaces, disable
non-link click focus:

```javascript
worlds.config.setDefaults({
  sectionClickFocusEnabled: false
});
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
worlds.camera.focusOnSection(sectionIndex, 80);
```

### Slide Deck Navigation

If you want to treat sections as “slides”, use `worlds.nav`.

It’s outline-based (powered by `doc.outline()`), so you can choose what “next”
means: next H1, next heading of any level, next within the current subtree,
next sibling, etc.

```javascript
// Presenter-friendly: disable Worlds’s Tab/Enter/Arrow link navigation
// so your document can own those keys.
worlds.links.setKeyHandlingEnabled(false);

// Global slide deck: H1 only
const h1Slides = { scope: 'global', levels: 1, includeHidden: false };

// Jump to slide cursor 0 (first)
worlds.nav.goto(0, { ...h1Slides, fill: 0.92 });

// Next / previous
worlds.nav.next({ ...h1Slides, fill: 0.92 });
worlds.nav.prev({ ...h1Slides, fill: 0.92 });

// Next heading of any level (global)
worlds.nav.next({ scope: 'global', levels: 'any', fill: 0.92 });

// Navigate "under the current heading" (descendants of the current section)
worlds.nav.next({ scope: 'subtree', root: 'current', depth: 'descendants', levels: 'any', fill: 0.92 });

// Read state
console.log('count', worlds.nav.count(h1Slides));
console.log('cursor', worlds.nav.cursor(h1Slides));
console.log('indices', worlds.nav.list(h1Slides));
```

### Overview Grid (Thumbnails)

For a PowerPoint-style “all slides at once” view, you can enable the **overview grid**.

This is intended to be *host-only* when using Host Sync: client/audience windows ignore
overview calls.

```javascript
// Toggle grid overview on/off
worlds.overview.toggle({ levels: 'any' });

// Or explicitly enable with options
worlds.overview.setEnabled(true, {
  levels: 'any',
  columns: 6,
  fill: 0.92
});

// Disable and return to the last focused slide
worlds.overview.setEnabled(false);
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
  
  worlds.setSectionTransform(i, {
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

worlds.setSectionTransform(sectionIndex, {
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

worlds.setSectionTransform(sectionIndex, {
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

worlds.setSectionTransform(sectionIndex, {
  scale: { x: scale, y: scale, z: 1 }
});
```

### Manual Camera Control

WASD-style camera movement:

```javascript
// on:update handler
const speed = 50;
const pos = worlds.camera.getPosition();

if (key.down('w')) {
  worlds.camera.setPosition(pos.x, pos.y, pos.z - speed * getDelta());
}
if (key.down('s')) {
  worlds.camera.setPosition(pos.x, pos.y, pos.z + speed * getDelta());
}
if (key.down('a')) {
  worlds.camera.setPosition(pos.x - speed * getDelta(), pos.y, pos.z);
}
if (key.down('d')) {
  worlds.camera.setPosition(pos.x + speed * getDelta(), pos.y, pos.z);
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
for (let i = 0; i < worlds.getSectionCount(); i++) {
  const layout = worlds.getSectionLayout(i);
  console.log(`Section ${i}:`, layout);
}

// Log camera state
console.log('Camera pos:', worlds.camera.getPosition());
console.log('Camera rot:', worlds.camera.getRotation());

// Check availability
if (!worlds.available) {
  console.warn('WebGPU not available - 3D canvas disabled');
}
```

## Examples

See these demo documents:

- [worlds-demo.md](demos/worlds-demo.md) - Basic 3D positioning and camera
- [worlds-animation.md](demos/worlds-animation.md) - Runtime animations

## Architecture

The 3D canvas system consists of:

- **WorldsRenderer**: WebGPU renderer for 3D quads
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

Fallback behavior: 3D canvas API is available but `worlds.available` returns `false`.

## TypeScript Types

```typescript
import type {
  Vec3,
  Transform3D,
  Camera3D,
  Section3DLayout,
  WorldsConfig
} from 'storie';

// Example
const defaults: Partial<WorldsConfig> = {
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,
  sectionTextureMode: 'canvas2d',
  sectionBackground: 'surface',
  sectionBorderEnabled: true,
  sectionBorderWidth: 2
};
```

See [worlds-types.ts](../src/worlds-types.ts) for full type definitions.
