# Compositor Manual Mode Demo

This demo showcases **manual compositing** with full control over layers, blend modes, and opacity.

Press **1-5** to cycle blend modes:
- **1**: Normal
- **2**: Additive  
- **3**: Multiply
- **4**: Screen
- **5**: Overlay

Press **+/-** to adjust opacity

---

## Setup

```js
// State
let blendMode = 'normal';
let opacity = 0.8;
let rotation = 0;
let compositorInitialized = false;

// Blend mode names for display
const blendModes = ['normal', 'additive', 'multiply', 'screen', 'overlay'];
let blendModeIndex = 0;
```

---

## Initialization

```js on:init
// Compositor setup will be done in render block when available
```

---

## Input Handler

```js on:input
const notes = scope.notes || {};
const activeOscillators = scope.activeOscillators || {};

if (event.type === 'keydown') {
  // Blend mode selection
  if (event.key >= '1' && event.key <= '5') {
    blendModeIndex = parseInt(event.key) - 1;
    blendMode = blendModes[blendModeIndex];
  }
  
  // Opacity control
  if (event.key === '=' || event.key === '+') {
    opacity = Math.min(1.0, opacity + 0.1);
  }
  if (event.key === '-' || event.key === '_') {
    opacity = Math.max(0.0, opacity - 0.1);
  }
}
```

---

## Render Loop

```js on:render
// Initialize compositor once when available
if (!compositorInitialized && compositor.available) {
  compositor.setMode('manual');
  compositorInitialized = true;
  term.write(2, 2, "Compositor Manual Mode Active!");
  term.write(2, 3, "Press 1-5 to change blend modes");
  term.write(2, 4, "Press +/- to adjust opacity");
}

// Update rotation
rotation = (rotation || 0) + getDelta();

// === TERMINAL LAYER (Background) ===
term.clear();
term.write(0, 0, "╔════════════════════════════════════╗");
term.write(0, 1, "║  COMPOSITOR MANUAL MODE DEMO      ║");
term.write(0, 2, "╠════════════════════════════════════╣");
term.write(0, 3, "║                                    ║");
term.write(0, 4, "║  Blend Mode: " + blendMode.padEnd(19) + "║");
term.write(0, 5, "║  Opacity: " + opacity.toFixed(2).padEnd(22) + "║");
term.write(0, 6, "║                                    ║");
term.write(0, 7, "║  Controls:                         ║");
term.write(0, 8, "║    1-5: Change blend mode          ║");
term.write(0, 9, "║    +/-: Adjust opacity             ║");
term.write(0, 10, "║                                    ║");
term.write(0, 11, "╚════════════════════════════════════╝");

// Add some animated text
const time = getTime() || 0;
const frame = Math.floor(time * 2);
const chars = ['◢', '◣', '◤', '◥'];
const charIndex = Math.abs(frame % 4);
const char = chars[charIndex] || '◢';
term.write(2, 14, char.repeat(36));
term.write(2, 15, "Frame: " + getFrame());
term.write(2, 16, "Time: " + time.toFixed(2) + "s");

// === CANVAS 2D LAYER (Foreground) ===
// Clear with transparency
canvas2d.clear('rgba(0, 0, 0, 0)');

const ctx = canvas2d.context;
if (ctx) {
  const centerX = canvas2d.width / 2;
  const centerY = canvas2d.height / 2;
  
  // Draw rotating gradient squares
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.translate(centerX + Math.cos(rotation + i * 2) * 150, 
                  centerY + Math.sin(rotation + i * 2) * 150);
    ctx.rotate(rotation * (i + 1));
    
    // Gradient fill
    const gradient = ctx.createLinearGradient(-50, -50, 50, 50);
    gradient.addColorStop(0, `hsla(${i * 120}, 100%, 50%, 0.8)`);
    gradient.addColorStop(1, `hsla(${i * 120 + 60}, 100%, 50%, 0.8)`);
    
    ctx.fillStyle = gradient;
    ctx.fillRect(-50, -50, 100, 100);
    
    ctx.restore();
  }
  
  // Draw center circle with glow
  ctx.save();
  
  // Glow effect
  ctx.shadowBlur = 30;
  ctx.shadowColor = '#00ffff';
  
  ctx.fillStyle = '#00ffff';
  ctx.beginPath();
  ctx.arc(centerX, centerY, 40 + Math.sin(rotation * 3) * 10, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.restore();
  
  // Draw info text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('COMPOSITOR', centerX, centerY - 150);
  ctx.fillText(blendMode.toUpperCase(), centerX, centerY + 150);
}

// === MANUAL COMPOSITING ===
// Clear main canvas
compositor.clear('#0a0a0f');

// Blit terminal layer first (background)
compositor.blit('terminal', {
  opacity: 1.0,
  blendMode: 'normal'
});

// Blit canvas2d layer with current blend mode and opacity
compositor.blit('canvas2d', {
  opacity: opacity,
  blendMode: blendMode
});

// Present final composition
compositor.present();
```

---

## Try It!

1. **Normal blend**: Standard alpha blending (default)
2. **Additive blend**: Colors add together (great for glow effects)
3. **Multiply blend**: Colors multiply (darker, good for shadows)
4. **Screen blend**: Inverse multiply (lighter, good for highlights)
5. **Overlay blend**: Combination of multiply and screen

Experiment with different opacity values to see how layers interact!
