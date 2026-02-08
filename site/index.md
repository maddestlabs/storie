# S|torie Demo

Welcome to **S|torie** - an interactive story and game engine with SES sandboxing!

This `index.md` file runs automatically when you open this page, just like how web servers run `index.html`.

## 🚀 Bouncing Rocket Demo

Watch the rocket bounce around the screen with physics and a motion trail.

```js
// Game state variables
let x = 40;
let y = 12;
let vx = 0.8;
let vy = 0.5;
let frame = 0;
```

```js on:init
console.log('🎮 S|torie - Rocket Demo from index.md!');
term.layerID = 'default';
```

```js on:update
// Update position with velocity
x += vx * delta * 60;
y += vy * delta * 60;

// Bounce off walls
if (x <= 0 || x >= termCanvas.width() - 1) {
  vx = -vx;
  x = Math.max(0, Math.min(termCanvas.width() - 1, x));
}

if (y <= 0 || y >= termCanvas.height() - 1) {
  vy = -vy;
  y = Math.max(0, Math.min(termCanvas.height() - 1, y));
}

// Keyboard input
if (key.pressed(key.SPACE)) {
  // Randomize velocity
  vx = (Math.random() - 0.5) * 3;
  vy = (Math.random() - 0.5) * 3;
}

if (key.down(key.ARROW_UP)) y -= 0.3;
if (key.down(key.ARROW_DOWN)) y += 0.3;
if (key.down(key.ARROW_LEFT)) x -= 0.3;
if (key.down(key.ARROW_RIGHT)) x += 0.3;

frame++;
```

```js on:render
// Clear screen
term.clear();

// Draw border with box-drawing characters
for (let i = 0; i < termCanvas.width(); i++) {
  termCanvas.plot(i, 0, '═', {r: 100, g: 100, b: 100});
  termCanvas.plot(i, termCanvas.height() - 1, '═', {r: 100, g: 100, b: 100});
}

for (let i = 0; i < termCanvas.height(); i++) {
  termCanvas.plot(0, i, '║', {r: 100, g: 100, b: 100});
  termCanvas.plot(termCanvas.width() - 1, i, '║', {r: 100, g: 100, b: 100});
}

// Corners
termCanvas.plot(0, 0, '╔', {r: 100, g: 100, b: 100});
termCanvas.plot(termCanvas.width() - 1, 0, '╗', {r: 100, g: 100, b: 100});
termCanvas.plot(0, termCanvas.height() - 1, '╚', {r: 100, g: 100, b: 100});
termCanvas.plot(termCanvas.width() - 1, termCanvas.height() - 1, '╝', {r: 100, g: 100, b: 100});

// Draw rocket
const ix = Math.floor(x);
const iy = Math.floor(y);
termCanvas.plot(ix, iy, '🚀', {r: 255, g: 255, b: 0});

// Draw motion trail
const trailLen = 5;
for (let i = 1; i <= trailLen; i++) {
  const tx = Math.floor(x - vx * i * 2);
  const ty = Math.floor(y - vy * i * 2);
  const alpha = 1 - (i / trailLen);
  const c = Math.floor(255 * alpha);
  if (tx >= 0 && tx < termCanvas.width() && ty >= 0 && ty < termCanvas.height()) {
    termCanvas.plot(tx, ty, '·', {r: c, g: c, b: 0});
  }
}

// Draw UI info
term.write(2, 2, `Frame: ${frame}`, {r: 150, g: 150, b: 150});
term.write(2, 3, `FPS: ${Math.round(1 / getDelta())}`, {r: 150, g: 150, b: 150});
term.write(2, 4, `Pos: (${ix}, ${iy})`, {r: 150, g: 150, b: 150});
term.write(2, 5, `Vel: (${vx.toFixed(2)}, ${vy.toFixed(2)})`, {r: 150, g: 150, b: 150});

// Instructions at bottom
term.write(2, termCanvas.height() - 3, `SPACE - Randomize velocity`, {r: 100, g: 200, b: 255});
term.write(2, termCanvas.height() - 2, `ARROWS - Manual control`, {r: 100, g: 200, b: 255});
```

## Features Demonstrated

- ✅ **SES Sandboxing**: Code runs in isolated Compartment
- ✅ **Main Loop**: `init()` → `update(delta)` → `render()`
- ✅ **Terminal Canvas API**: Character-based drawing and text
- ✅ **Input Handling**: Keyboard state tracking
- ✅ **Performance**: 60 FPS with delta timing
- ✅ **Auto-loading**: This `index.md` loads automatically!

## How It Works

1. Engine looks for `index.md` in the current directory
2. Parses markdown and extracts JavaScript code blocks
3. Creates SES Compartment and loads code
4. Calls `init()`, then loops `update()` + `render()`
5. Falls back to embedded code if `index.md` not found

---

**Try it!** Edit this `index.md` file and reload the page to see your changes.
