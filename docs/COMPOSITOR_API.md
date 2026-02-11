# Compositor API Design

## Philosophy

**Default: "Just Works"** - Terminal and Canvas 2D render offscreen and auto-composite
**Advanced: Full Control** - Users can create contexts and manually composite everything

## Core Concept

All rendering happens **offscreen**:
- Terminal → GPU texture (internal)
- Canvas 2D → OffscreenCanvas (user draws to it)
- User WebGL/Canvas contexts → OffscreenCanvas (user creates)

The **Compositor** blits these to the main canvas with blend modes, opacity, transforms.

---

## API Design

### Auto Mode (Default)

Zero configuration - terminal and canvas2d just work:

```javascript
// on:render block
print("Hello World");  // Terminal renders offscreen
canvas2d.drawRect(10, 10, 100, 100);  // Canvas2D renders offscreen
// Compositor auto-blits: terminal → canvas2d → main canvas
```

**Defaults:**
- Terminal layer: opacity 1.0, normal blend
- Canvas 2D layer: opacity 1.0, normal blend
- Rendering order: Terminal (back) → Canvas 2D (front)

---

### Manual Mode (Full Control)

User explicitly composites all layers:

```javascript
// Switch to manual compositing
compositor.setMode('manual');  // or 'auto' (default)

on('render', () => {
  // 1. Draw to contexts (same as before)
  print("Terminal text");
  canvas2d.fillRect(10, 10, 100, 100);
  
  // 2. Explicitly composite
  compositor.clear();
  compositor.blit(compositor.layers.terminal, { opacity: 1.0 });
  compositor.blit(compositor.layers.canvas2d, { opacity: 0.8, blendMode: 'normal' });
  compositor.present();
});
```

---

### Creating Custom Contexts

Users can create additional offscreen contexts:

```javascript
// Create offscreen WebGL context
const webgl = compositor.createContext('webgl', {
  type: 'webgl',  // or 'canvas2d', 'webgl2'
  width: 800,
  height: 600,
  alpha: true
});

// Use it
on('render', () => {
  const gl = webgl.context;  // WebGLRenderingContext
  gl.clearColor(1, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  // Composite manually
  compositor.setMode('manual');
  compositor.clear();
  compositor.blit(compositor.layers.terminal);
  compositor.blit(compositor.layers.canvas2d);
  compositor.blit(webgl);  // Custom context
  compositor.present();
});
```

---

## Compositor API Reference

### Properties

```typescript
compositor.mode: 'auto' | 'manual'
  // 'auto': Terminal and Canvas 2D auto-composite (default)
  // 'manual': User explicitly calls blit/present

compositor.layers: {
  terminal: Layer,    // Built-in terminal layer
  canvas2d: Layer,    // Built-in canvas2d layer
  [key: string]: Layer  // User-created layers
}
```

### Methods

#### `compositor.setMode(mode: 'auto' | 'manual')`

Switch between auto and manual compositing.

```javascript
compositor.setMode('manual');  // Take full control
compositor.setMode('auto');    // Back to auto-compositing
```

---

#### `compositor.createContext(name: string, options: ContextOptions)` ✅ Phase 3

Create a new offscreen rendering context.

```typescript
interface ContextOptions {
  type: 'canvas2d' | 'webgl' | 'webgl2';
  width: number;
  height: number;
  alpha?: boolean;
  antialias?: boolean;
}
```

**Returns:** `OffscreenLayer`

```javascript
const webgl = compositor.createContext('myWebGL', {
  type: 'webgl',
  width: 800,
  height: 600,
  alpha: true
});

// Access context
const gl = webgl.context;  // WebGLRenderingContext
const canvas = webgl.canvas;  // OffscreenCanvas
```

---

#### `compositor.clear(color?: string)`

Clear the main canvas (manual mode only).

```javascript
compositor.clear('#000000');  // Clear to black
compositor.clear();           // Clear to transparent
```

---

#### `compositor.blit(layer: Layer, options?: BlitOptions)`

Draw a layer to the main canvas (manual mode only).

```typescript
interface BlitOptions {
  x?: number;           // X offset (default: 0)
  y?: number;           // Y offset (default: 0)
  width?: number;       // Destination width (default: layer width)
  height?: number;      // Destination height (default: layer height)
  opacity?: number;     // 0.0 - 1.0 (default: 1.0)
  blendMode?: BlendMode; // Blend mode (default: 'normal')
  rotation?: number;    // Rotation in radians (default: 0)
  scale?: { x: number, y: number };  // Scale (default: 1.0)
}

type BlendMode = 
  | 'normal'      // Alpha blending
  | 'additive'    // Add colors
  | 'multiply'    // Multiply colors
  | 'screen'      // Screen blend
  | 'overlay';    // Overlay blend
```

**Examples:**

```javascript
// Simple blit
compositor.blit(compositor.layers.terminal);

// With opacity
compositor.blit(compositor.layers.canvas2d, { opacity: 0.5 });

// With blend mode
compositor.blit(webglLayer, { blendMode: 'additive' });

// With transforms (Phase 4)
compositor.blit(layer, {
  x: 100, y: 100,
  rotation: Math.PI / 4,  // 45 degrees
  scale: { x: 2.0, y: 2.0 },
  origin: { x: 0.5, y: 0.5 },  // Rotate around center
  opacity: 0.8,
  blendMode: 'additive'
});
```

---

#### `compositor.present()`

Finalize compositing and display on main canvas (manual mode only).

```javascript
compositor.clear();
compositor.blit(layer1);
compositor.blit(layer2);
compositor.present();  // Display result
```

---

#### `compositor.getTexture(layer: Layer)`

Get the GPU texture for a layer (advanced use).

```javascript
const texture = compositor.getTexture(compositor.layers.terminal);
// Returns GPUTexture (WebGPU) or WebGLTexture (WebGL)
```

---

## Layer Object

Represents an offscreen rendering context.

```typescript
interface Layer {
  name: string;
  canvas?: OffscreenCanvas;  // For Canvas2D/WebGL contexts
  texture?: GPUTexture;      // For GPU textures (terminal)
  context?: CanvasRenderingContext2D | WebGLRenderingContext;
  width: number;
  height: number;
  
  // Layer configuration (for auto mode)
  opacity: number;           // 0.0 - 1.0
  blendMode: BlendMode;
  enabled: boolean;
  zIndex: number;
}
```

**Auto mode uses layer properties:**

```javascript
// Configure layers for auto-compositing
compositor.layers.canvas2d.opacity = 0.8;
compositor.layers.canvas2d.blendMode = 'additive';
compositor.layers.canvas2d.zIndex = 10;  // Higher = front
```

---

## Usage Examples

### Example 1: Default (No Compositor Code)

```javascript
// Just works - no compositor code needed
on('render', () => {
  print("Hello World");
  canvas2d.fillRect(10, 10, 100, 100);
  // Auto-composited: terminal → canvas2d
});
```

---

### Example 2: Adjust Canvas 2D Opacity

```javascript
// Stay in auto mode, just configure layers
compositor.layers.canvas2d.opacity = 0.5;

on('render', () => {
  print("Terminal text");
  canvas2d.fillRect(10, 10, 100, 100);  // 50% opacity
});
```

---

### Example 3: Add WebGL Layer ✅ Phase 3

```javascript
const webgl = compositor.createContext('particles', {
  type: 'webgl',
  width: 800,
  height: 600,
  alpha: true
});

on('render', () => {
  // Terminal (auto)
  print("FPS: " + Math.round(1 / getDeltaTime()));
  
  // Canvas 2D (auto)
  canvas2d.drawText("Score: 100", 10, 10);
  
  // WebGL particles (custom)
  const gl = webgl.context;
  gl.clear(gl.COLOR_BUFFER_BIT);
  // ... draw particles
  
  // Switch to manual to include WebGL
  compositor.setMode('manual');
  compositor.clear();
  compositor.blit(compositor.layers.terminal);
  compositor.blit(compositor.layers.canvas2d);
  compositor.blit(webgl, { blendMode: 'additive' });
  compositor.present();
});
```

---

### Example 4: Full Manual Control

```javascript
compositor.setMode('manual');

const bg = compositor.createContext('background', {
  type: 'canvas2d',
  width: 800,
  height: 600
});

on('render', () => {
  // Draw background gradient
  const ctx = bg.context;
  const gradient = ctx.createLinearGradient(0, 0, 0, 600);
  gradient.addColorStop(0, '#1a1a2e');
  gradient.addColorStop(1, '#16213e');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);
  
  // Draw terminal
  print("Terminal on top of gradient");
  
  // Composite
  compositor.clear();
  compositor.blit(bg);  // Background first
  compositor.blit(compositor.layers.terminal, { opacity: 0.9 });
  compositor.present();
});
```

---

### Example 5: Layer Effects

```javascript
const time = getTime();

// Rotate canvas2d layer
compositor.layers.canvas2d.rotation = time;
compositor.layers.canvas2d.scale = {
  x: 1.0 + Math.sin(time) * 0.2,
  y: 1.0 + Math.cos(time) * 0.2
};

on('render', () => {
  canvas2d.drawCircle(400, 300, 50, '#ff0088', true);
  // Rotates and scales automatically
});
```

---

## Implementation Strategy

### Phase 1: Basic Offscreen + Compositor ✅ COMPLETE
- [x] Terminal renders to GPU texture (offscreen)
- [x] Canvas 2D uses OffscreenCanvas
- [x] Simple compositor: blit terminal → blit canvas2d
- [x] Auto mode works like current behavior

### Phase 2: Manual Mode ✅ COMPLETE
- [x] `compositor.setMode('manual')`
- [x] `compositor.clear()`, `blit()`, `present()`
- [x] Opacity support in blit options
- [x] Blend modes: normal, additive, multiply, screen, overlay

### Phase 3: Custom Contexts ✅ COMPLETE
- [x] `compositor.createContext()`
- [x] Return OffscreenCanvas with context (Canvas2D, WebGL, WebGL2)
- [x] Allow blitting custom contexts
- [x] `compositor.removeLayer()` for cleanup

### Phase 4: Transforms ✅ COMPLETE
- [x] Rotation per blit (radians)
- [x] Scale per blit (uniform or {x, y})
- [x] Translation (x, y positioning)
- [x] Transform origin control (0-1 normalized)
- [x] GPU-accelerated transform matrices
- [x] Combined transforms (translate + rotate + scale)

### Phase 5: Advanced Features 🔮 FUTURE
- [ ] Post-processing effects (blur, glow, CRT)
- [ ] Layer groups
- [ ] Render-to-texture for recursive effects
- [ ] Performance optimizations (dirty tracking)

---

## Benefits

✅ **Zero-config default**: Terminal + Canvas 2D just work
✅ **Gradual complexity**: Users add compositor code only when needed
✅ **Maximum flexibility**: Create any contexts, composite any way
✅ **Composable**: Mix terminal, Canvas 2D, WebGL, custom effects
✅ **Performance**: GPU-accelerated compositing
✅ **No breaking changes**: Existing scripts work exactly the same

---

## Open Questions

1. **Layer ordering in auto mode**: Should canvas2d always be on top of terminal, or configurable?
2. **Transform API**: Layer properties vs blit options vs both?
3. **Effects API**: Built-in (blur, glow) or user shaders?
4. **Render targets**: Should users be able to blit to a layer instead of main canvas?
5. **Performance**: Dirty tracking - only composite when layers change?
