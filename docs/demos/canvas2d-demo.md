# 🎨 Canvas 2D Demo

Simple example showing native Canvas 2D API integration.

## Animated graphics with Canvas 2D

```js
// Animation state - declarations
let rotation = 0;
let particles = [];
```

```js on:init
console.log('🎨 Canvas 2D demo ready!');
console.log('Canvas 2D available:', typeof canvas2d);
console.log('Canvas size:', canvas2d.width, 'x', canvas2d.height);
console.log('Context available:', canvas2d.context !== null);

if (!canvas2d.context) {
  console.error('Canvas 2D not available!');
}

// Initialize particles array
for (let i = 0; i < 50; i++) {
  particles.push({
    x: Math.random() * 800,
    y: Math.random() * 600,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    size: Math.random() * 5 + 2,
    color: `hsl(${Math.random() * 360}, 80%, 60%)`
  });
}

console.log(`Initialized ${particles.length} particles`);
```

```js on:update
// Update rotation
rotation += delta * 2;

// Update particles
for (let p of particles) {
  p.x += p.vx;
  p.y += p.vy;
  
  // Wrap around edges
  if (p.x < 0) p.x = canvas2d.width;
  if (p.x > canvas2d.width) p.x = 0;
  if (p.y < 0) p.y = canvas2d.height;
  if (p.y > canvas2d.height) p.y = 0;
}

// Interactive: mouse affects particles
const mx = mouseX * (canvas2d.width / termWidth);
const my = mouseY * (canvas2d.height / termHeight);

for (let p of particles) {
  const dx = p.x - mx;
  const dy = p.y - my;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < 100 && dist > 0) {
    const force = (100 - dist) / 1000;
    p.vx += (dx / dist) * force;
    p.vy += (dy / dist) * force;
  }
  
  // Damping
  p.vx *= 0.99;
  p.vy *= 0.99;
}
```

```js on:render
// === Canvas 2D Rendering ===

// Clear with dark background
canvas2d.clear('#0a0a1e');

// Draw particles
for (let p of particles) {
  canvas2d.drawCircle(p.x, p.y, p.size, p.color, true);
}

// Draw rotating rectangle in center
const ctx = canvas2d.context;
if (ctx) {
  const cx = canvas2d.width / 2;
  const cy = canvas2d.height / 2;
  
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  
  // Draw with gradient
  const gradient = ctx.createLinearGradient(-50, -50, 50, 50);
  gradient.addColorStop(0, '#00ffff');
  gradient.addColorStop(1, '#ff00ff');
  
  ctx.fillStyle = gradient;
  ctx.fillRect(-50, -50, 100, 100);
  
  // Draw border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(-50, -50, 100, 100);
  
  ctx.restore();
}

// Draw mouse position
const mx = mouseX * (canvas2d.width / termWidth);
const my = mouseY * (canvas2d.height / termHeight);
canvas2d.drawCircle(mx, my, 20, 'rgba(255, 255, 255, 0.3)', false);

// Title text
canvas2d.text('Canvas 2D API', 10, 30, '#ffffff', 'bold 24px monospace');
canvas2d.text(`${particles.length} particles`, 10, 55, '#aaaaaa', '16px monospace');

// === Terminal Display ===

term.clear();

term.write(2, 2, '=== Canvas 2D Demo ===', 0x00ff88ff);
term.write(2, 4, 'Move mouse to interact!', 0xffffffff);
term.write(2, 5, 'Watch the canvas animation', 0xaaaaaaff);

term.write(2, 7, `Canvas: ${canvas2d.width}x${canvas2d.height}`, 0x888888ff);
term.write(2, 8, `Mouse: (${mouseX}, ${mouseY})`, 0x888888ff);
term.write(2, 9, `Particles: ${particles.length}`, 0x888888ff);
term.write(2, 10, `Rotation: ${(rotation % (Math.PI * 2)).toFixed(2)}`, 0x888888ff);

term.write(2, termHeight - 2, `Frame: ${getFrame()}`, 0x444444ff);
```

## How Canvas 2D Works

**Shared Instance Pattern:**

```text
// Simple helpers
canvas2d.clear('#000000');
canvas2d.drawCircle(100, 100, 50, '#ff0000');

// Direct context access for advanced features
const ctx = canvas2d.context;
ctx.globalCompositeOperation = 'screen';
ctx.filter = 'blur(5px)';
canvas2d.drawRect(50, 50, 100, 100, '#00ff00');
```

**Mix helpers and raw Canvas 2D API freely!**

- `canvas2d.context` - The real CanvasRenderingContext2D
- Helpers like `drawCircle()` use the same context
- Zero overhead, full Canvas 2D power

## API Reference

### Helpers
- `clear(color?)` - Clear or fill canvas
- `drawRect(x, y, w, h, color, filled?)` - Draw rectangle
- `drawCircle(x, y, radius, color, filled?)` - Draw circle
- `drawLine(x1, y1, x2, y2, color, lineWidth?)` - Draw line
- `drawImage(img, x, y, w?, h?)` - Draw image
- `text(text, x, y, color, font?)` - Draw text
- `loadImage(url)` - Load image (async)

### Properties
- `context` - Full CanvasRenderingContext2D
- `width`, `height` - Canvas dimensions
