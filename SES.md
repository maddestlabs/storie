# SES Migration: storie → storie-js

**Status:** Planning / Architecture Document  
**Goal:** Replace Nimini (1.9 MB WASM) with SES (150 KB JS) for 78% size reduction  
**Impact:** Complete rewrite - New repository recommended

---

## Executive Summary

### Current Architecture (Nimini-based)
```
Markdown with Nim-like code blocks
         ↓
Nim compiler → WASM (1.9 MB)
         ↓
Nimini interpreter executes user code
         ↓
Nim APIs (canvas, text, layers) via FFI
         ↓
JavaScript bridges → WebGPU rendering
```

**Size:** 2.1 MB (WASM + JS)  
**Security:** ✅ Perfect (Nimini completely sandboxed)  
**Syntax:** Python-like (custom DSL)

### Proposed Architecture (SES-based)
```
Markdown with JavaScript code blocks
         ↓
Pure JavaScript/TypeScript engine (~300 KB)
         ↓
SES Compartments execute user code (native JS)
         ↓
JavaScript APIs (canvas, text, layers) directly
         ↓
WebGPU rendering (no FFI bridging)
```

**Size:** 450 KB (engine + SES)  
**Security:** ✅ Perfect (SES compartments isolated)  
**Syntax:** JavaScript (universal)

### Benefits
- ✅ **1.65 MB smaller** (78% reduction)
- ✅ **Native JS execution** (no VM overhead)
- ✅ **JavaScript syntax** (lower learning curve)
- ✅ **Better debugging** (Chrome DevTools sees everything)
- ✅ **Faster iteration** (no compile step)
- ✅ **Easier contributions** (more developers know JS)

### Risks
- ❌ **Complete rewrite** (~6-8 weeks effort)
- ❌ **All Nim code must be ported** (50+ files)
- ❌ **Learning SES** (new capability-based model)
- ❌ **Migration complexity** (existing users must update)

---

## Architecture Considerations

### 1. Main Loop Design

#### Option A: Keep Event Handler Model (Recommended ⭐)

**Current Nimini pattern:**
```nim
on:init:
  # Setup
  text.layerID = "main"

on:update:
  # Game logic
  if key_pressed(KEY_SPACE):
    playerY -= 1

on:render:
  # Drawing
  text.write(playerX, playerY, "🚀")
```

**SES equivalent:**
```javascript
// In user's markdown code block
export const init = () => {
  text.layerID = "main";
};

export const update = (delta) => {
  if (key.pressed(KEY_SPACE)) {
    playerY -= 1;
  }
};

export const render = () => {
  text.write(playerX, playerY, "🚀");
};
```

**Pros:**
- ✅ Familiar pattern (matches Nimini)
- ✅ Clean separation of concerns
- ✅ Easy to understand
- ✅ Works well with hot reload

**Cons:**
- ⚠️ Slightly verbose (export statements)

#### Option B: Declarative Frame Handler

```javascript
// User code
export default {
  init() {
    this.playerY = 10;
  },
  
  frame(frameNumber, delta) {
    // Combined update + render
    if (key.pressed(KEY_SPACE)) {
      this.playerY -= 1;
    }
    text.write(10, this.playerY, "🚀");
  }
};
```

**Pros:**
- ✅ More concise
- ✅ Context object (this) for state

**Cons:**
- ❌ Mixing update/render logic
- ❌ Less flexible

#### Option C: Reactive/Declarative Model

```javascript
// Inspired by SolidJS/Vue
export default {
  state: {
    playerY: 10
  },
  
  effects: {
    onSpace: () => key.pressed(KEY_SPACE),
    moveUp: () => this.playerY -= 1
  },
  
  render() {
    return [
      text(10, this.playerY, "🚀")
    ];
  }
};
```

**Pros:**
- ✅ Modern reactive pattern
- ✅ Declarative

**Cons:**
- ❌ More complex to implement
- ❌ Steeper learning curve
- ❌ Overkill for terminal graphics

**Recommendation:** **Option A** - Explicit init/update/render handlers match current Nimini model and are easiest to migrate.

---

### 2. Module System Design

Current Nim modules need JavaScript equivalents:

#### lib/canvas.nim → canvas.js

**Current Nimini API:**
```nim
canvas.plot(x, y, "█", fg, bg)
canvas.width()
canvas.height()
canvas.scrollTo(x, y)
```

**SES JavaScript API:**
```javascript
// /src/modules/canvas.js
export class Canvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.viewportX = 0;
    this.viewportY = 0;
  }
  
  plot(x, y, char, fg, bg) {
    // Implementation
  }
  
  scrollTo(x, y) {
    this.viewportX = x;
    this.viewportY = y;
  }
  
  // ... rest of API
}
```

#### lib/storie_md.nim → markdown.js

**Current:** Nim markdown parser  
**Proposed:** Port custom markdown parser to JavaScript

**Note:** We use a custom parser specifically designed for **section-by-section processing**. Sections are designated by headings (h1-h6) along with all subsequent content under those headings until the next heading of equal or higher level. This hierarchical section model is central to tstorie's navigation and rendering system, and standard libraries like marked.js don't provide this section-based parsing out of the box.

```javascript
// /src/modules/markdown.js

export function parseMarkdown(source) {
  return {
    sections: extractSections(source),      // Custom section extraction
    codeBlocks: extractCodeBlocks(source),
    metadata: extractFrontmatter(source)
  };
}

function extractSections(source) {
  // Parse markdown into hierarchical sections based on headings
  // Each section contains: title, level, content, children sections
  // This is critical for tstorie's section navigation system
}
```

#### lib/storie_themes.nim → themes.js

**Current:** Nim theme system  
**Proposed:** Plain JavaScript objects

```javascript
// /src/modules/themes.js
export const themes = {
  dracula: {
    bg: { r: 40, g: 42, b: 54 },
    fg: { r: 248, g: 248, b: 242 },
    accent1: { r: 255, g: 121, b: 198 },
    // ...
  },
  gruvbox: {
    // ...
  }
};

export function applyTheme(themeName) {
  const theme = themes[themeName];
  // Apply to engine
}
```

#### lib/layers.nim → layers.js

**Current:** Layer buffer system in Nim  
**Proposed:** TypeScript classes

```typescript
// /src/core/layers.ts
export class Layer {
  id: string;
  buffer: Cell[][];
  visible: boolean = true;
  alpha: number = 1.0;
  
  constructor(width: number, height: number) {
    this.buffer = Array(height).fill(null)
      .map(() => Array(width).fill({ ch: ' ', fg: white(), bg: black() }));
  }
  
  write(x: number, y: number, text: string, style: Style) {
    // Implementation
  }
  
  clear(bgColor: Color) {
    // Implementation
  }
}

export class LayerStack {
  layers: Map<string, Layer> = new Map();
  
  composite(): Cell[][] {
    // Alpha blend all visible layers
  }
}
```

---

### 3. SES Security Model

#### Lockdown and Compartment Creation

```javascript
// /src/core/sandbox.js
import { lockdown, Compartment } from 'ses';

// One-time initialization (on engine startup)
lockdown({
  errorTaming: 'unsafe',   // Better error messages
  consoleTaming: 'unsafe', // Allow console.log for debugging
  stackFiltering: 'verbose'
});

export class ScriptSandbox {
  constructor(engineAPIs) {
    this.engineAPIs = engineAPIs;
    this.compartments = new Map();
  }
  
  /**
   * Create isolated compartment for user script
   * Each markdown document gets its own compartment
   */
  createCompartment(documentId) {
    const compartment = new Compartment({
      // Only expose these globals to user code
      console,  // Safe: can't break out via console
      
      // Engine APIs
      text: this.engineAPIs.text,
      canvas: this.engineAPIs.canvas,
      layer: this.engineAPIs.layer,
      key: this.engineAPIs.key,
      mouse: this.engineAPIs.mouse,
      
      // Read-only state
      frame: this.engineAPIs.getFrame,
      time: this.engineAPIs.getTime,
      delta: this.engineAPIs.getDelta,
      
      // Utilities
      Math,  // Safe: pure functions
      Date,  // Safe: no system access
      
      // NO ACCESS TO:
      // - fetch (network)
      // - localStorage (storage)
      // - document (DOM)
      // - window (global)
      // - eval (code injection)
      // - Function (code injection)
      // - XMLHttpRequest (network)
    });
    
    this.compartments.set(documentId, compartment);
    return compartment;
  }
  
  /**
   * Execute user's init/update/render functions
   */
  executeUserCode(documentId, code) {
    const compartment = this.compartments.get(documentId);
    
    try {
      // Evaluate user code (returns module exports)
      const module = compartment.evaluate(`
        ${code}
        
        // Return handlers
        ({ init, update, render })
      `);
      
      return module;
    } catch (error) {
      console.error(`Script error in ${documentId}:`, error);
      return null;
    }
  }
}
```

#### API Surface (What Users Can Access)

```javascript
// /src/core/user-api.js

/**
 * Define what APIs are exposed to sandboxed user code
 * This is the ONLY way user code interacts with engine
 */
export function createUserAPI(engine) {
  return {
    // Text/Terminal API
    text: {
      write: (x, y, text, style) => engine.layers.active.write(x, y, text, style),
      clear: () => engine.layers.active.clear(),
      layerID: '' // getter/setter for active layer
    },
    
    // Canvas API
    canvas: {
      plot: (x, y, char, fg, bg) => engine.canvas.plot(x, y, char, fg, bg),
      line: (x1, y1, x2, y2, char, style) => engine.canvas.line(x1, y1, x2, y2, char, style),
      rect: (x, y, w, h, char, style, filled) => engine.canvas.rect(x, y, w, h, char, style, filled),
      scrollTo: (x, y) => engine.canvas.scrollTo(x, y),
      width: () => engine.canvas.width,
      height: () => engine.canvas.height
    },
    
    // Layer API
    layer: {
      create: (id, width, height) => engine.layers.create(id, width, height),
      show: (id) => engine.layers.show(id),
      hide: (id) => engine.layers.hide(id),
      setAlpha: (id, alpha) => engine.layers.setAlpha(id, alpha),
      clear: (id) => engine.layers.get(id).clear()
    },
    
    // Input API
    key: {
      pressed: (keyCode) => engine.input.isKeyPressed(keyCode),
      down: (keyCode) => engine.input.isKeyDown(keyCode),
      up: (keyCode) => engine.input.isKeyUp(keyCode),
      // Key code constants
      SPACE: 32, ENTER: 13, ESC: 27, // etc.
    },
    
    mouse: {
      x: () => engine.input.mouseX,
      y: () => engine.input.mouseY,
      pressed: (button) => engine.input.isMousePressed(button),
      clicked: (button) => engine.input.wasMouseClicked(button)
    },
    
    // Read-only state (functions to prevent mutation)
    getFrame: () => engine.frameCount,
    getTime: () => engine.elapsedTime,
    getDelta: () => engine.deltaTime,
    
    // Audio API
    audio: {
      play: (url, volume, loop) => engine.audio.play(url, volume, loop),
      stop: (handle) => engine.audio.stop(handle),
      setVolume: (handle, volume) => engine.audio.setVolume(handle, volume)
    },
    
    // WebGPU noise/shaders
    noise: {
      compile: (config) => engine.gpu.compileNoise(config),
      sample: (x, y) => engine.gpu.sampleNoise(x, y)
    }
  };
}
```

---

### 4. Engine Core Architecture

```typescript
// /src/core/engine.ts

import { ScriptSandbox } from './sandbox.js';
import { createUserAPI } from './user-api.js';
import { LayerStack } from './layers.js';
import { Canvas } from '../modules/canvas.js';
import { InputManager } from './input.js';
import { WebGPURenderer } from '../render/webgpu-renderer.js';

export class TStorieEngine {
  // Core systems
  private sandbox: ScriptSandbox;
  private renderer: WebGPURenderer;
  private layers: LayerStack;
  private canvas: Canvas;
  private input: InputManager;
  
  // Timing
  private frameCount: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private lastFrameTime: number = 0;
  
  // User scripts
  private documents: Map<string, UserScript> = new Map();
  
  async init(canvasElement: HTMLCanvasElement) {
    // Initialize WebGPU
    this.renderer = new WebGPURenderer(canvasElement);
    await this.renderer.init();
    
    // Initialize systems
    this.layers = new LayerStack(80, 24);
    this.canvas = new Canvas(80, 24);
    this.input = new InputManager(canvasElement);
    
    // Create sandbox with API
    const userAPI = createUserAPI(this);
    this.sandbox = new ScriptSandbox(userAPI);
    
    // Start main loop
    this.startMainLoop();
  }
  
  loadMarkdown(documentId: string, markdown: string) {
    // Parse markdown
    const parsed = parseMarkdown(markdown);
    
    // Extract JavaScript code blocks
    const codeBlocks = parsed.codeBlocks.filter(block => 
      block.lang === 'javascript' || block.lang === 'js'
    );
    
    // Combine code blocks
    const userCode = codeBlocks.map(block => block.code).join('\n');
    
    // Create compartment and load script
    const compartment = this.sandbox.createCompartment(documentId);
    const handlers = this.sandbox.executeUserCode(documentId, userCode);
    
    // Store
    this.documents.set(documentId, {
      id: documentId,
      handlers,
      sections: parsed.sections
    });
    
    // Call init handler
    if (handlers?.init) {
      handlers.init();
    }
  }
  
  private startMainLoop() {
    const frame = (timestamp: number) => {
      // Calculate delta
      if (this.lastFrameTime === 0) this.lastFrameTime = timestamp;
      this.deltaTime = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;
      this.elapsedTime += this.deltaTime;
      
      // Update phase
      this.updateActiveDocument();
      
      // Render phase
      this.renderActiveDocument();
      
      // Composite and present
      this.renderer.render(this.layers.composite());
      
      // Input cleanup
      this.input.endFrame();
      
      // Next frame
      this.frameCount++;
      requestAnimationFrame(frame);
    };
    
    requestAnimationFrame(frame);
  }
  
  private updateActiveDocument() {
    const doc = this.getActiveDocument();
    if (doc?.handlers?.update) {
      try {
        doc.handlers.update(this.deltaTime);
      } catch (error) {
        console.error('Error in update:', error);
      }
    }
  }
  
  private renderActiveDocument() {
    const doc = this.getActiveDocument();
    if (doc?.handlers?.render) {
      try {
        doc.handlers.render();
      } catch (error) {
        console.error('Error in render:', error);
      }
    }
  }
}
```

---

## Migration Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Basic engine with SES

- [ ] Set up new repository (`tstorie-js`)
- [ ] Initialize TypeScript project
- [ ] Add SES dependency
- [ ] Implement `ScriptSandbox` class
- [ ] Create basic `Engine` class with main loop
- [ ] Port `Layer` and `LayerStack` to TypeScript
- [ ] Basic text rendering (Canvas 2D fallback)

**Deliverable:** Hello World in SES compartment

### Phase 2: Core Modules (Week 3-4)
**Goal:** Port essential Nim modules

- [ ] Port `canvas.nim` → `canvas.js`
- [ ] Port `input.nim` → `input.js`
- [ ] Port `storie_types.nim` → `types.ts`
- [ ] Port custom markdown parser (section-based parsing)
- [ ] Port theme system
- [ ] Implement user API surface

**Deliverable:** Basic demo running (bouncing character)

### Phase 3: WebGPU Integration (Week 5-6)
**Goal:** GPU rendering and compute

- [ ] Port WebGPU renderer (already mostly JS)
- [ ] Integrate existing `webgpu-render.js`
- [ ] Port noise system
- [ ] Port shader system (WGSL blocks still work)
- [ ] GPU compute API for user code

**Deliverable:** GPU-accelerated rendering + noise working

### Phase 4: Feature Parity (Week 7-8)
**Goal:** Match Nimini capabilities

- [ ] Port all lib/ modules (figlet, particles, etc.)
- [ ] Audio integration (WebAudio)
- [ ] File drop support
- [ ] Section navigation
- [ ] Export to video/gif
- [ ] All demos working

**Deliverable:** Feature-complete SES version

### Phase 5: Polish (Week 9-10)
**Goal:** Production ready

- [ ] Error handling and debugging
- [ ] Performance optimization
- [ ] Documentation
- [ ] Migration guide for existing users
- [ ] Examples and tutorials
- [ ] Bundle optimization

**Deliverable:** 1.0 release

---

## Code Examples

### Current (Nimini)

```nim
# In markdown code block
on:init:
  text.layerID = "game"
  var score = 0

on:update:
  if key_pressed(KEY_SPACE):
    score += 1

on:render:
  text.clear()
  text.write(0, 0, "Score: " & $score, white(), black())
```

### Proposed (SES JavaScript)

```javascript
// In markdown code block
let score = 0;

export const init = () => {
  text.layerID = "game";
  score = 0;
};

export const update = (delta) => {
  if (key.pressed(key.SPACE)) {
    score += 1;
  }
};

export const render = () => {
  text.clear();
  text.write(0, 0, `Score: ${score}`, white(), black());
};
```

### Advanced Example: Particles

```javascript
// User code in markdown
const particles = [];

export const init = () => {
  // Create 100 particles
  for (let i = 0; i < 100; i++) {
    particles.push({
      x: Math.random() * canvas.width(),
      y: Math.random() * canvas.height(),
      vx: (Math.random() - 0.5) * 2,
      vy: (Math.random() - 0.5) * 2,
      char: ['*', '·', '•', '○'][Math.floor(Math.random() * 4)]
    });
  }
};

export const update = (delta) => {
  for (const p of particles) {
    p.x += p.vx * delta * 60;
    p.y += p.vy * delta * 60;
    
    // Wrap around
    if (p.x < 0) p.x = canvas.width();
    if (p.x > canvas.width()) p.x = 0;
    if (p.y < 0) p.y = canvas.height();
    if (p.y > canvas.height()) p.y = 0;
  }
};

export const render = () => {
  layer.clear("game");
  
  for (const p of particles) {
    canvas.plot(
      Math.floor(p.x),
      Math.floor(p.y),
      p.char,
      { r: 255, g: 255, b: 255 },
      { r: 0, g: 0, b: 0 }
    );
  }
};
```

---

## Performance Considerations

### Bundle Size Optimization

```javascript
// Use rollup/esbuild for tree-shaking
// rollup.config.js
export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/tstorie.min.js',
    format: 'esm'
  },
  plugins: [
    typescript(),
    terser()  // Minification
  ]
};
```

**Target sizes:**
- Engine core: ~200 KB minified
- SES: ~150 KB
- Custom markdown parser: ~30 KB
- Total: ~380 KB (vs current 2.1 MB)

### Runtime Performance

**Native JS execution:**
```
Nimini: User code → WASM interpreter → Nim FFI → JS → WebGPU
SES:    User code → Native JS → WebGPU
```

**Expected speedup:** 2-5× for logic-heavy scripts (no interpreter overhead)

---

## Security Comparison

| Feature | Nimini | SES |
|---------|--------|-----|
| Sandboxing | ✅ Perfect | ✅ Perfect |
| No network access | ✅ | ✅ |
| No filesystem | ✅ | ✅ |
| No DOM access | ✅ | ✅ |
| Frozen intrinsics | N/A | ✅ |
| Capability-based | ✅ | ✅ |
| Production-tested | ⚠️ Custom | ✅ Agoric, MetaMask |

Both are equally secure. SES has more real-world usage.

---

## Risk Mitigation

### Technical Risks

1. **SES compatibility issues**
   - Mitigation: Extensive testing, fallback to Workers if needed
   
2. **Performance regressions**
   - Mitigation: Benchmark early, profile often
   
3. **API surface too large**
   - Mitigation: Start minimal, add incrementally

### Project Risks

1. **8-week rewrite**
   - Mitigation: Can keep Nimini version maintained during transition
   
2. **User migration**
   - Mitigation: Provide syntax converter tool (Nim-like → JS)
   
3. **Feature gaps**
   - Mitigation: Port modules incrementally, maintain feature list

---

## Decision Checklist

Before proceeding, confirm:

- [ ] Team has JavaScript/TypeScript expertise
- [ ] 8-10 weeks development time acceptable
- [ ] Willing to maintain two codebases during transition
- [ ] 1.65 MB size savings important enough
- [ ] Users will accept JavaScript syntax
- [ ] Can provide migration tooling for existing content

---

## Next Steps

1. **Prototype** (1 week)
   - Create minimal SES sandbox
   - Port one simple demo
   - Validate approach
   - Measure actual bundle size

2. **Decision Point**
   - If prototype successful → Proceed with fork
   - If issues found → Revisit or keep Nimini

3. **Repository Setup**
   - Create `tstorie-js` repository
   - Set up TypeScript tooling
   - Begin Phase 1 (Foundation)

---

## Questions to Answer

1. **Module system**: ES modules or AMD or both?
2. **TypeScript**: Full TS or JavaScript with JSDoc?
3. **Build tool**: Rollup, esbuild, or Vite?
4. **Testing**: Jest, Vitest, or native node:test?
5. **Documentation**: Maintain separate or unified?
6. **Versioning**: tstorie 2.0 or new project?

---

## References

- **SES**: https://github.com/endojs/endo/tree/master/packages/ses
- **Agoric (SES usage)**: https://docs.agoric.com/guides/js-programming/
- **MetaMask Snaps**: https://docs.metamask.io/snaps/
- **Rollup**: https://rollupjs.org/

---

## Appendix: Full Module Mapping

| Current Nim Module | Proposed JS Module | Notes |
|-------------------|-------------------|--------|
| `lib/canvas.nim` | `src/modules/canvas.js` | Port directly |
| `lib/storie_md.nim` | `src/modules/markdown.js` | Port custom section parser |
| `lib/storie_types.nim` | `src/types.ts` | TypeScript interfaces |
| `lib/storie_themes.nim` | `src/modules/themes.js` | Plain objects |
| `lib/nimini_bridge.nim` | `src/core/user-api.js` | API surface |
| `lib/figlet.nim` | `src/modules/figlet.js` | Port or use library |
| `lib/particles_bindings.nim` | `src/modules/particles.js` | Port directly |
| `lib/noise_composer.nim` | `src/modules/noise.js` | Keep WGSL generation |
| `lib/audio.nim` | `src/modules/audio.js` | WebAudio wrapper |
| `src/layers.nim` | `src/core/layers.ts` | Port directly |
| `src/input.nim` | `src/core/input.ts` | Port directly |
| `src/timing.nim` | `src/core/timing.ts` | Port directly |
| `backends/webgpu/*` | Keep as-is | Already JS |

**Total:** ~15 modules to port, ~8000 lines of code estimated.

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-06  
**Author:** Architecture team  
**Status:** For discussion and prototyping
