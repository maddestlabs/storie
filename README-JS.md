# S|torie

**Interactive Story & Game Engine - Rebuilt with SES and Modern Web APIs**

A lightweight, sandboxed engine for creating interactive terminal-style stories and games using Markdown and JavaScript.

## 🎯 Key Features

- **✅ 78% Smaller**: ~450 KB (vs 2.1 MB Nimini version)
- **🔒 Secure**: SES Compartments provide complete sandboxing
- **📝 Markdown-First**: Write stories in Markdown with embedded JavaScript
- **⚡ Lifecycle Hooks**: `on:init`, `on:update`, `on:render` pattern from original TStorie
- **🔄 Persistent Scope**: Variables persist across code blocks and frames
- **📄 Auto-loads index.md**: Like web servers with index.html, but for Markdown
- **🎮 Game Loop**: Clean `init` → `update` → `render` pattern
- **🎨 Layer System**: Multi-layer compositing with alpha blending
- **⌨️ Input Handling**: Keyboard and mouse support
- **🖥️ Canvas Rendering**: Canvas 2D (WebGPU support planned)
- **🎵 Native Browser APIs**: Direct access to Web Audio, Canvas 2D, WebGL, WebGPU with shared instances

## 🧭 API Architecture

S|torie separates terminal-style rendering from future pixel-based graphics:

- **`term.*`** - Terminal text rendering (write, clear, layerID)
- **`termCanvas.*`** - Character-based drawing (plot, line, rect, etc.)
- **`graphics.*`** - *(Future)* True pixel-based graphics API for WebGPU

This separation allows games to choose between retro terminal aesthetics or modern pixel graphics without API confusion.

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000/demo.html](http://localhost:3000/demo.html)

### Build

```bash
npm run build
```

Output will be in `dist/` directory.

## 📖 Usage

### Basic Example

The engine **automatically loads `index.md`** from the current directory, just like how web servers load `index.html`.

**Create `index.md`:**

```markdown
# My Interactive Story

## Game Code

\`\`\`javascript
function init() {
  console.log('Story started!');
}

function update(delta) {
  // Game logic
}

function render() {
  term.write(10, 10, 'Hello, World!', {r: 255, g: 255, b: 255});
}
\`\`\`
```

**Create `index.html`:**

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Story</title>
</head>
<body>
  <canvas id="canvas" width="800" height="480"></canvas>
  
  <script type="module">
    import { StorieEngine } from './storie.es.js';
    
    const canvas = document.getElementById('canvas');
    const engine = new StorieEngine(canvas, {
      width: 80,
      height: 24
    });
    
    // Try to load index.md, fall back to embedded markdown
    try {
      const response = await fetch('index.md');
      if (response.ok) {
        const markdown = await response.text();
        engine.loadMarkdown('story', markdown);
        engine.start();
      }
    } catch (error) {
      console.error('Failed to load index.md:', error);
    }
  </script>
</body>
</html>
```

That's it! Open `index.html` and the engine will automatically find and run `index.md`.

## 🎮 API Reference

### Engine

```typescript
class StorieEngine {
  constructor(canvas: HTMLCanvasElement, config?: EngineConfig);
  loadMarkdown(id: string, markdown: string): boolean;
  start(): void;
  stop(): void;
  setActiveDocument(id: string): void;
  resize(width: number, height: number): void;
}
```

### User Code API

Inside your JavaScript code blocks, you have access to:

#### Terminal Text API

```javascript
term.write(x, y, text, fg, bg)  // Write text at position
term.clear()                     // Clear active layer
term.layerID = "layer-name"      // Set active layer
```

#### Terminal Canvas API (Character-Based Drawing)

```javascript
termCanvas.plot(x, y, char, fg, bg)                    // Plot single character
termCanvas.line(x1, y1, x2, y2, char, fg, bg)          // Draw line
termCanvas.rect(x, y, w, h, char, fg, bg, filled)      // Draw rectangle
termCanvas.scrollTo(x, y)                               // Scroll viewport
termCanvas.width()                                      // Get width
termCanvas.height()                                     // Get height
```

#### Layer API

```javascript
layer.create(id, width, height)  // Create new layer
layer.show(id)                   // Show layer
layer.hide(id)                   // Hide layer
layer.setAlpha(id, alpha)        // Set layer opacity (0-1)
layer.clear(id)                  // Clear layer
```

#### Input API

```javascript
// Keyboard
key.down(keyCode)       // Is key currently held?
key.pressed(keyCode)    // Was key just pressed this frame?
key.released(keyCode)   // Was key just released this frame?

// Key constants
key.SPACE, key.ENTER, key.ESC
key.ARROW_UP, key.ARROW_DOWN, key.ARROW_LEFT, key.ARROW_RIGHT

// Mouse
mouse.x()               // Mouse X in cells
mouse.y()               // Mouse Y in cells
mouse.down(button)      // Is button held? (0=left, 1=middle, 2=right)
mouse.clicked(button)   // Was button just clicked?
```

#### State API

```javascript
getFrame()   // Current frame number
getTime()    // Elapsed time in seconds
getDelta()   // Delta time in seconds (time since last frame)
```

#### Native Browser APIs

S|torie provides direct access to native browser APIs with **zero overhead** using the **shared instance pattern**. Helpers and raw API access use the same underlying objects.

##### Web Audio API

```javascript
// === Simple Helpers ===
audio.playTone(440, 1.0, 0.5);  // frequency, duration, volume
const buffer = await audio.loadSound('sound.mp3');
audio.playBuffer(buffer, { loop: true, volume: 0.8 });

// === Raw API (same AudioContext!) ===
const osc = audio.createOscillator();
const gain = audio.createGain();
osc.connect(gain);
gain.connect(audio.destination);
osc.start();

// === Direct Context Access ===
audio.context.currentTime;
audio.context.sampleRate;
audio.state;  // 'running', 'suspended', etc.
```

##### Canvas 2D API

```javascript
// === Simple Helpers ===
canvas2d.clear('#000000');
canvas2d.drawCircle(100, 100, 50, '#ff0000', true);
canvas2d.drawRect(0, 0, 200, 100, '#00ff00', false);
canvas2d.text('Hello!', 10, 30, '#ffffff', '24px monospace');

// === Raw API (same Canvas2D context!) ===
const ctx = canvas2d.context;
ctx.globalAlpha = 0.5;
ctx.filter = 'blur(5px)';
canvas2d.drawRect(100, 100, 50, 50, '#0000ff');

// === Load Images ===
const img = await canvas2d.loadImage('sprite.png');
canvas2d.drawImage(img, 0, 0, 64, 64);
```

##### WebGL API

```javascript
// Check availability
if (webgl.available) {
  const gl = webgl.context;
  
  // Create shaders
  const vs = webgl.createShader('vertex', vertexSource);
  const fs = webgl.createShader('fragment', fragmentSource);
  const program = webgl.createProgram(vs, fs);
  
  // Use full WebGL API
  gl.useProgram(program);
  // ... rest of WebGL code
}
```

##### WebGPU API

```javascript
// Initialize (async, lazy)
if (await webgpu.init()) {
  const device = webgpu.device;
  
  // Safe helpers with guardrails
  const buffer = webgpu.createBuffer(1024, GPUBufferUsage.UNIFORM);
  const shader = webgpu.createShaderModule(wgslCode);
  const texture = webgpu.createTexture(512, 512, 'rgba8unorm');
  
  // Direct device access for advanced use
  const pipeline = device.createComputePipeline({ ... });
}
```

**Key Benefits:**
- ✅ **Shared Instances** - One AudioContext, one device, helpers use same objects
- ✅ **Zero Overhead** - Helpers are thin wrappers, no duplication
- ✅ **Mix API Levels** - Use helpers for simplicity, raw API for power
- ✅ **Safety Guardrails** - WebGPU has memory limits, WebGL has shader validation

See [SES_NATIVE_APIS.md](SES_NATIVE_APIS.md) for detailed architecture and examples.

### Colors

```javascript
// RGB color object
{ r: 255, g: 255, b: 255 }

// With alpha
{ r: 255, g: 255, b: 255, a: 0.5 }
```

## 📝 Markdown Structure

S|torie parses Markdown into **sections** based on headings:

```markdown
# Level 1 Heading

Content under this heading...

## Level 2 Heading

More content...

### Level 3 Heading

Nested content...
```

Each section contains:
- `title`: Heading text
- `level`: 1-6 (h1-h6)
- `content`: All content until next heading
- `children`: Nested sections

## 🎯 Main Loop Pattern

### Method 1: Direct Function Definition

Define handler functions directly in your code:

```javascript
function init() {
  // Called once when document loads
  // Setup your game state here
}

function update(delta) {
  // Called every frame before render
  // Update game logic here
  // delta = time since last frame in seconds
}

function render() {
  // Called every frame after update
  // Draw your game here
}
```

### Method 2: Lifecycle Hooks (Recommended)

Use code block metadata to organize your code into lifecycle phases, just like the original TStorie:

```markdown
\`\`\`js
// Global variables (accessible everywhere)
let x = 0;
let y = 0;
\`\`\`

\`\`\`js on:init
// Runs once at load
console.log('Initializing...');
x = 10;
y = 10;
\`\`\`

\`\`\`js on:update
// Runs every frame
x += 1;
if (key.down(key.ARROW_UP)) y -= 1;
\`\`\`

\`\`\`js on:render
// Runs every frame after update
term.clear();
termCanvas.plot(x, y, '@', {r: 255, g: 100, b: 50});
\`\`\`
```

**Benefits:**
- **Organized Code**: Separate initialization, logic, and rendering
- **Persistent Scope**: Variables declared in any block persist across all blocks
- **Multiple Blocks**: Can have multiple `on:update` or `on:render` blocks that concatenate
- **Familiar**: Same pattern as original TStorie (`on:init`, `on:update`, `on:render`)

### Frontmatter Variables

You can define variables in YAML frontmatter that are automatically available in all code blocks:

```markdown
---
playerSpeed: 5
enemyCount: 10
maxHealth: 100
---

\`\`\`js on:init
console.log(playerSpeed);  // 5
console.log(enemyCount);   // 10
console.log(maxHealth);    // 100

// These are just regular variables, you can modify them
if (enemyCount > 5) {
  console.log('Hard mode!');
}
\`\`\`
```

See [SECURITY_AND_SCOPING.md](docs/SECURITY_AND_SCOPING.md) for complete details on scoping and security.

## 🔒 Security & Sandboxing

User code runs in **SES (Secure ECMAScript) Compartments** with complete isolation:

✅ **Allowed:**
- `console` (debugging)
- `Math`, `Date` (safe standard library)
- Engine APIs (`term`, `termCanvas`, `layer`, `key`, `mouse`)
- Shared persistent scope (within same document)

❌ **Blocked:**
- `fetch` (network access)
- `localStorage` (storage)
- `document` (DOM manipulation)
- `window` (global scope)
- `eval` (code injection)
- `Function` constructor

**Key Security Features:**
- 🔐 **Hardened JavaScript** - SES `lockdown()` freezes intrinsics
- 🏝️ **Isolated Compartments** - Each document gets its own scope
- 🚫 **No Side Channels** - Cannot access other documents or external resources
- ✅ **Capability-Based** - Only access explicitly granted APIs

**Scoping:**
- Variables persist across code blocks within the same document
- Each document's scope is completely isolated from others
- Frontmatter variables automatically added to scope
- Changes persist across frames (init → update → render)

**📚 Complete Documentation:** See [SECURITY_AND_SCOPING.md](docs/SECURITY_AND_SCOPING.md) for comprehensive details on sandboxing, scoping, and lifecycle hooks.

## 🏗️ Architecture

```
Markdown
   ↓
Custom Parser → Sections + Code Blocks
   ↓
SES Compartment (isolated environment)
   ↓
User Handlers (init/update/render)
   ↓
Engine APIs
   ↓
Layer System (compositing)
   ↓
Canvas 2D Renderer
```

## 📦 Project Structure

```
src/
  ├── main.ts          # Entry point
  ├── engine.ts        # Main engine class
  ├── sandbox.ts       # SES sandboxing
  ├── layers.ts        # Layer system
  ├── input.ts         # Input management
  ├── renderer.ts      # Canvas 2D renderer
  ├── markdown.ts      # Markdown parser
  └── types.ts         # TypeScript types

demo.html              # Example demo
package.json           # Dependencies
tsconfig.json          # TypeScript config
vite.config.ts         # Vite build config
```

## 🎨 Examples

### Bouncing Character

```javascript
let x = 40, y = 12;
let vx = 0.5, vy = 0.3;

function init() {
  term.layerID = 'default';
}

function update(delta) {
  x += vx * delta * 60;
  y += vy * delta * 60;
  
  if (x <= 0 || x >= termCanvas.width() - 1) vx = -vx;
  if (y <= 0 || y >= termCanvas.height() - 1) vy = -vy;
}

function render() {
  term.clear();
  termCanvas.plot(Math.floor(x), Math.floor(y), '🚀', 
    {r: 255, g: 255, b: 0});
}
```

### Particle System

```javascript
const particles = [];

function init() {
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * termCanvas.width(),
      y: Math.random() * termCanvas.height(),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      char: ['*', '·', '•'][Math.floor(Math.random() * 3)]
    });
  }
}

function update(delta) {
  for (const p of particles) {
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    
    if (p.x < 0) p.x = termCanvas.width();
    if (p.x > termCanvas.width()) p.x = 0;
    if (p.y < 0) p.y = termCanvas.height();
    if (p.y > termCanvas.height()) p.y = 0;
  }
}

function render() {
  term.clear();
  for (const p of particles) {
    termCanvas.plot(Math.floor(p.x), Math.floor(p.y), p.char,
      {r: 255, g: 255, b: 255});
  }
}
```

## 🚧 Roadmap

- [x] Core engine with SES sandboxing
- [x] Layer system
- [x] Canvas 2D renderer
- [x] Input handling
- [x] Section-based markdown parser
- [ ] WebGPU renderer
- [ ] WebGPU compute shaders
- [ ] Audio system (WebAudio)
- [ ] Asset loading
- [ ] Animation helpers
- [ ] Particle system module
- [ ] Figlet text module
- [ ] Export to video/gif
- [ ] Tauri native builds

## 📚 Migration from Nimini

**Old Syntax (Nimini/Nim):**
```nim
on:init:
  text.layerID = "main"

on:update:
  if key_pressed(KEY_SPACE):
    playerY -= 1

on:render:
  text.write(0, 0, "Hello", white(), black())
```

**New Syntax (S|torie JS):**
```javascript
function init() {
  term.layerID = "main";
}

function update(delta) {
  if (key.pressed(key.SPACE)) {
    playerY -= 1;
  }
}

function render() {
  term.write(0, 0, "Hello", {r: 255, g: 255, b: 255}, {r: 0, g: 0, b: 0});
}
```

function update(delta) {
  if (key.pressed(key.SPACE)) {
    playerY -= 1;
  }
}

function render() {
  text.write(0, 0, "Hello", {r: 255, g: 255, b: 255});
}
```

## 🤝 Contributing

Contributions welcome! This is a complete rewrite of the original Nimini-based engine.

## 📄 License

MIT License - see [LICENSE](LICENSE)

## 🔗 Links

- **Original Storie**: https://github.com/maddestlabs/tstorie
- **Endo (SES)**: https://github.com/endojs/endo
- **Agoric (SES usage)**: https://docs.agoric.com/

---

**Version**: 2.0.0-alpha.1  
**Built with**: TypeScript + SES + Vite  
**Made by**: MaddestLabs
