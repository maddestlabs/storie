# Transform Demo - Phase 4

This demo showcases **Phase 4: Transforms** - rotation, scale, and translation of layers.

**Features:**
- 🔄 Rotation (animated)
- 📏 Scale (animated pulsing)
- 📍 Translation (positioning)
- 🎯 Transform origin control
- 🎨 Combined with blend modes

Press **R** to toggle rotation
Press **S** to toggle scaling
Press **T** to toggle translation

---

## Setup

```js
// Animation controls
let enableRotation = true;
let enableScaling = true;
let enableTranslation = true;

// Animation state
let rotation = 0;
let scale = 1.0;
let translateX = 0;
let translateY = 0;
```

---

## Initialization

```js on:init
compositor.setMode('manual');

// Create additional Canvas2D context for rotating logo
const logo = compositor.createContext('logo', {
  type: 'canvas2d',
  width: 200,
  height: 200,
  alpha: true,
  zIndex: 25
});

// Draw logo
if (logo) {
  const ctx = logo.context;
  
  // Draw a cool logo
  ctx.fillStyle = '#ff0088';
  ctx.fillRect(20, 20, 160, 160);
  
  ctx.fillStyle = '#00ff88';  
  ctx.beginPath();
  ctx.arc(100, 100, 60, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 40px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', 100, 100);
  
  scope.logo = logo;
}

term.write(2, 2, "Transform Demo Active!");
term.write(2, 3, "Press R/S/T to toggle effects");
```

---

## Input Handler

```js on:input
if (event.type === 'keydown') {
  if (event.key === 'r' || event.key === 'R') {
    enableRotation = !enableRotation;
  }
  if (event.key === 's' || event.key === 'S') {
    enableScaling = !enableScaling;
  }
  if (event.key === 't' || event.key === 'T') {
    enableTranslation = !enableTranslation;
  }
}
```

---

## Render Loop

```js on:render
const time = getTime();
const dt = getDelta();

// Update animations
if (scope.enableRotation) {
  scope.rotation = (scope.rotation || 0) + dt;
}

if (scope.enableScaling) {
  scope.scale = 1.0 + Math.sin(time * 2) * 0.3;
} else {
  scope.scale = 1.0;
}

if (scope.enableTranslation) {
  scope.translateX = Math.cos(time * 1.5) * 100;
  scope.translateY = Math.sin(time * 1.5) * 80;
} else {
  scope.translateX = 0;
  scope.translateY = 0;
}

// === CANVAS 2D BACKGROUND ===
// Draw gradient
canvas2d.clear('rgba(0, 0, 0, 0)');
const ctx = canvas2d.context;
if (ctx) {
  const gradient = ctx.createLinearGradient(0, 0, 800, 600);
  gradient.addColorStop(0, 'rgba(30, 10, 60, 0.8)');
  gradient.addColorStop(1, 'rgba(10, 30, 60, 0.8)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 800, 600);
  
  // Draw grid
  ctx.strokeStyle = 'rgba(100, 100, 150, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 800; i += 50) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 600);
    ctx.stroke();
  }
  for (let i = 0; i < 600; i += 50) {
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(800, i);
    ctx.stroke();
  }
  
  // Draw center crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(390, 300);
  ctx.lineTo(410, 300);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(400, 290);
  ctx.lineTo(400, 310);
  ctx.stroke();
}

// === TERMINAL UI ===
term.clear();
term.write(2, 2, "╔══════════════════════════════════════╗");
term.write(2, 3, "║  TRANSFORM DEMO - PHASE 4           ║");
term.write(2, 4, "╠══════════════════════════════════════╣");
term.write(2, 5, "║                                      ║");
const rotStatus = scope.enableRotation ? "✓" : "✗";
term.write(2, 6, "║  [R] Rotation:    " + rotStatus + "                 ║");
const scaleStatus = scope.enableScaling ? "✓" : "✗";
term.write(2, 7, "║  [S] Scaling:     " + scaleStatus + "                 ║");
const transStatus = scope.enableTranslation ? "✓" : "✗";
term.write(2, 8, "║  [T] Translation: " + transStatus + "                 ║");
term.write(2, 9, "║                                      ║");
term.write(2, 10, "║  Values:                             ║");
term.write(2, 11, "║    Rotation: " + (scope.rotation || 0).toFixed(2) + " rad           ║");
term.write(2, 12, "║    Scale:    " + (scope.scale || 1).toFixed(2) + "                ║");
term.write(2, 13, "║    Pos X:    " + (scope.translateX || 0).toFixed(0).padStart(4) + " px            ║");
term.write(2, 14, "║    Pos Y:    " + (scope.translateY || 0).toFixed(0).padStart(4) + " px            ║");
term.write(2, 15, "║                                      ║");
term.write(2, 16, "╚══════════════════════════════════════╝");

term.write(2, 18, "Watch the spinning logo in the center!");
term.write(2, 19, "All transforms happen GPU-side.");

// === MANUAL COMPOSITING WITH TRANSFORMS ===
compositor.clear('#0a0a0f');

// Background gradient
compositor.blit(compositor.layers.canvas2d, {
  opacity: 1.0,
  blendMode: 'normal'
});

// Logo with transforms applied
if (scope.logo) {
  compositor.blit(scope.logo, {
    x: 400 + scope.translateX,  // Center X + animation
    y: 300 + scope.translateY,  // Center Y + animation
    rotation: scope.rotation || 0,
    scale: scope.scale || 1.0,
    origin: { x: 0.5, y: 0.5 },  // Rotate around center
    opacity: 0.95,
    blendMode: 'normal'
  });
  
  // Second logo with different params (overlay)
  compositor.blit(scope.logo, {
    x: 400 - scope.translateX,  // Opposite translation
    y: 300 - scope.translateY,
    rotation: -(scope.rotation || 0),  // Counter-rotation
    scale: (scope.scale || 1.0) * 0.5,  // Half size
    origin: { x: 0.5, y: 0.5 },
    opacity: 0.3,
    blendMode: 'additive'  // Additive blend for glow
  });
}

// Terminal UI on top
compositor.blit(compositor.layers.terminal, {
  opacity: 1.0,
  blendMode: 'normal'
});

compositor.present();
```

---

## Transform Examples

### Simple Rotation
```
compositor.blit(layer, {
  rotation: Math.PI / 4  // 45 degrees
});
```

### Scale (uniform)
```
compositor.blit(layer, {
  scale: 1.5  // 150% size
});
```

### Scale (non-uniform)
```
compositor.blit(layer, {
  scale: { x: 2.0, y: 0.5 }  // Wide and short
});
```

### Translation
```
compositor.blit(layer, {
  x: 200,  // 200px from left
  y: 100   // 100px from top
});
```

### Combined Transform
```
compositor.blit(layer, {
  x: 400,
  y: 300,
  rotation: time,
  scale: 1.5,
  origin: { x: 0.5, y: 0.5 },  // Rotate around center
  opacity: 0.8,
  blendMode: 'additive'
});
```

### Custom Origin
```
// Rotate around top-left corner
compositor.blit(layer, {
  rotation: angle,
  origin: { x: 0, y: 0 }
});

// Rotate around bottom-right
compositor.blit(layer, {
  rotation: angle,
  origin: { x: 1, y: 1 }
});
```

---

## Technical Details

**Transform Matrix:** All transforms computed GPU-side using 4x4 matrices  
**Performance:** Zero CPU overhead, pure GPU acceleration  
**Order:** Translate → Rotate → Scale → Origin offset  
**Precision:** Full floating-point precision maintained

This is GPU-accelerated 2D compositing at its finest! 🚀
