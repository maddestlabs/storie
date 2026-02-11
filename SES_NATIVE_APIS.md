# Native Browser APIs in SES Sandbox

Guide for exposing native browser APIs through Storie's SES sandbox, balancing ease of use with full access to underlying power.

## Core Philosophy: Shared Instances

The key insight is that **helpers and raw API access share the same underlying instances**. This means:

✅ Zero duplication - one AudioContext, one WebGPU device, etc.  
✅ Helpers use the same objects users can access directly  
✅ No overhead - helpers are just convenience wrappers around the real thing  
✅ Users can mix helper calls and raw API calls seamlessly  

## Architecture Pattern

```javascript
// Create native API instance ONCE
const audioContext = new AudioContext();
const webgpuDevice = await adapter.requestDevice();
const canvas2dContext = canvas.getContext('2d');

// Expose to sandbox
return {
  audio: {
    // SHARED INSTANCE - users get the real thing
    context: audioContext,
    
    // HELPERS - use the same instance
    playTone(freq, duration) {
      // Helper uses audioContext directly
      const osc = audioContext.createOscillator();
      osc.frequency.value = freq;
      osc.connect(audioContext.destination);
      osc.start();
      osc.stop(audioContext.currentTime + duration);
    },
    
    // Raw API shortcuts (also use same instance)
    createOscillator: () => audioContext.createOscillator(),
    createGain: () => audioContext.createGain()
  }
};
```

Users can do:

```javascript
// Use helper
audio.playTone(440, 1.0);

// Or use raw API (same AudioContext!)
const osc = audio.context.createOscillator();
osc.connect(audio.context.destination);
osc.start();

// Or mix both
audio.playTone(440, 0.5); // Helper
const gain = audio.createGain(); // Raw shortcut
gain.connect(audio.context.destination); // Raw API
```

## API-by-API Implementation Guide

### Web Audio API - Full Exposure ✅

**Safety Level:** HIGH - Can't harm system or escape sandbox

**Implementation:**

```typescript
// In engine constructor
private audioContext: AudioContext;

constructor(canvas: HTMLCanvasElement, config: EngineConfig = {}) {
  // Create single shared instance
  this.audioContext = new AudioContext();
}

// In createUserAPI()
audio: {
  // === SHARED INSTANCE (Full Web Audio API) ===
  context: this.audioContext,
  
  // === RAW API SHORTCUTS ===
  createOscillator: () => this.audioContext.createOscillator(),
  createGain: () => this.audioContext.createGain(),
  createBiquadFilter: () => this.audioContext.createBiquadFilter(),
  createDelay: () => this.audioContext.createDelay(),
  createConvolver: () => this.audioContext.createConvolver(),
  createDynamicsCompressor: () => this.audioContext.createDynamicsCompressor(),
  createAnalyser: () => this.audioContext.createAnalyser(),
  createBufferSource: () => this.audioContext.createBufferSource(),
  createMediaStreamSource: (stream: MediaStream) => 
    this.audioContext.createMediaStreamSource(stream),
  
  // === HELPERS (Use same AudioContext) ===
  playTone(frequency: number, duration: number, volume: number = 0.5) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.frequency.value = frequency;
    gain.gain.value = volume;
    
    osc.connect(gain);
    gain.connect(this.audioContext.destination);
    
    osc.start();
    osc.stop(this.audioContext.currentTime + duration);
  },
  
  async loadSound(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return await this.audioContext.decodeAudioData(arrayBuffer);
  },
  
  playBuffer(buffer: AudioBuffer, loop: boolean = false) {
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(this.audioContext.destination);
    source.start();
    return source; // Return so user can stop it
  },
  
  // Utility properties
  get currentTime() { return this.audioContext.currentTime; },
  get sampleRate() { return this.audioContext.sampleRate; },
  get destination() { return this.audioContext.destination; }
}
```

**Usage:**

```javascript
// Simple - use helper
audio.playTone(440, 2.0, 0.3);

// Advanced - full Web Audio API
const osc = audio.createOscillator();
const lfo = audio.createOscillator();
const gain = audio.createGain();

lfo.frequency.value = 5; // 5Hz modulation
lfo.connect(gain.gain);

osc.frequency.value = 440;
osc.connect(gain);
gain.connect(audio.destination);

osc.start();
lfo.start();

// Load and play sound
const buffer = await audio.loadSound('kick.wav');
audio.playBuffer(buffer);
```

### Canvas 2D API - Full Exposure ✅

**Safety Level:** HIGH - Drawing only, no system access

**Implementation:**

```typescript
// In createUserAPI()
canvas2d: {
  // === SHARED INSTANCE ===
  // Note: This could be a separate offscreen canvas for 2D overlay
  context: this.get2DContext(),
  
  // === HELPERS ===
  clear(color?: string) {
    const ctx = this.get2DContext();
    if (color) {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    } else {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  },
  
  drawRect(x: number, y: number, w: number, h: number, color: string, filled: boolean = true) {
    const ctx = this.get2DContext();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    
    if (filled) {
      ctx.fillRect(x, y, w, h);
    } else {
      ctx.strokeRect(x, y, w, h);
    }
  },
  
  drawCircle(x: number, y: number, radius: number, color: string, filled: boolean = true) {
    const ctx = this.get2DContext();
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    if (filled) {
      ctx.fill();
    } else {
      ctx.stroke();
    }
  },
  
  drawImage(image: HTMLImageElement | ImageBitmap, x: number, y: number, w?: number, h?: number) {
    const ctx = this.get2DContext();
    if (w !== undefined && h !== undefined) {
      ctx.drawImage(image, x, y, w, h);
    } else {
      ctx.drawImage(image, x, y);
    }
  },
  
  text(text: string, x: number, y: number, color: string, font: string = '16px sans-serif') {
    const ctx = this.get2DContext();
    ctx.fillStyle = color;
    ctx.font = font;
    ctx.fillText(text, x, y);
  },
  
  // Convenience properties
  get width() { return this.get2DContext().canvas.width; },
  get height() { return this.get2DContext().canvas.height; }
}
```

**Usage:**

```javascript
// Helper
canvas2d.clear('#000000');
canvas2d.drawCircle(100, 100, 50, '#ff0000');

// Raw API (same context!)
const ctx = canvas2d.context;
ctx.save();
ctx.translate(200, 200);
ctx.rotate(Math.PI / 4);
ctx.fillStyle = '#00ff00';
ctx.fillRect(-25, -25, 50, 50);
ctx.restore();

// Mix both
canvas2d.drawRect(0, 0, 50, 50, '#0000ff');
canvas2d.context.globalAlpha = 0.5; // Raw API
canvas2d.drawRect(25, 25, 50, 50, '#ff00ff'); // Helper with alpha
```

### WebGL API - Selective Exposure ⚠️

**Safety Level:** MEDIUM - Can be complex, but mostly safe

**Implementation:**

```typescript
// In createUserAPI()
webgl: {
  // === SHARED INSTANCE ===
  // Could be useful for simple shader effects
  context: this.getWebGLContext(),
  
  // === HELPERS for common patterns ===
  createShader(type: 'vertex' | 'fragment', source: string): WebGLShader | null {
    const gl = this.getWebGLContext();
    const shaderType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
    const shader = gl.createShader(shaderType);
    if (!shader) return null;
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  },
  
  createProgram(vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
    const gl = this.getWebGLContext();
    const program = gl.createProgram();
    if (!program) return null;
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      return null;
    }
    
    return program;
  },
  
  // Common constants
  VERTEX_SHADER: WebGLRenderingContext.VERTEX_SHADER,
  FRAGMENT_SHADER: WebGLRenderingContext.FRAGMENT_SHADER,
  TRIANGLES: WebGLRenderingContext.TRIANGLES,
  TRIANGLE_STRIP: WebGLRenderingContext.TRIANGLE_STRIP,
  ARRAY_BUFFER: WebGLRenderingContext.ARRAY_BUFFER,
  STATIC_DRAW: WebGLRenderingContext.STATIC_DRAW,
  FLOAT: WebGLRenderingContext.FLOAT
}
```

**Usage:**

```javascript
// Raw API access
const gl = webgl.context;
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

// Or use helpers
const vs = webgl.createShader('vertex', vertexSource);
const fs = webgl.createShader('fragment', fragmentSource);
const program = webgl.createProgram(vs, fs);
```

### WebGPU API - Controlled Access ⚠️

**Safety Level:** LOW - Can crash GPU, steal memory

**Strategy:** Share device but control dangerous operations

**Implementation:**

```typescript
// Store device on engine
private webgpuDevice: GPUDevice | null = null;

async initWebGPU() {
  if (!navigator.gpu) return false;
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) return false;
  
  this.webgpuDevice = await adapter.requestDevice();
  return true;
}

// In createUserAPI()
webgpu: {
  // === CONTROLLED DEVICE ACCESS ===
  // Give users the device but not adapter (can't request unlimited devices)
  get device(): GPUDevice | null {
    return engine.webgpuDevice;
  },
  
  get available(): boolean {
    return engine.webgpuDevice !== null;
  },
  
  // === SAFE HELPERS ===
  createBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer | null {
    if (!engine.webgpuDevice) return null;
    
    // Enforce size limits to prevent memory exhaustion
    const MAX_BUFFER_SIZE = 256 * 1024 * 1024; // 256MB
    if (size > MAX_BUFFER_SIZE) {
      console.error('Buffer size exceeds maximum allowed:', MAX_BUFFER_SIZE);
      return null;
    }
    
    return engine.webgpuDevice.createBuffer({ size, usage });
  },
  
  createShaderModule(code: string): GPUShaderModule | null {
    if (!engine.webgpuDevice) return null;
    return engine.webgpuDevice.createShaderModule({ code });
  },
  
  createTexture(width: number, height: number, format: GPUTextureFormat = 'rgba8unorm'): GPUTexture | null {
    if (!engine.webgpuDevice) return null;
    
    // Enforce texture size limits
    const MAX_DIMENSION = 8192;
    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      console.error('Texture dimensions exceed maximum:', MAX_DIMENSION);
      return null;
    }
    
    return engine.webgpuDevice.createTexture({
      size: { width, height },
      format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
  },
  
  // Buffer usage constants
  BUFFER_USAGE_VERTEX: GPUBufferUsage.VERTEX,
  BUFFER_USAGE_INDEX: GPUBufferUsage.INDEX,
  BUFFER_USAGE_UNIFORM: GPUBufferUsage.UNIFORM,
  BUFFER_USAGE_STORAGE: GPUBufferUsage.STORAGE,
  BUFFER_USAGE_COPY_DST: GPUBufferUsage.COPY_DST,
  BUFFER_USAGE_COPY_SRC: GPUBufferUsage.COPY_SRC,
  
  // === BLOCK DANGEROUS OPERATIONS ===
  // Don't expose: device.destroy(), adapter.requestDevice(), etc.
}
```

**Usage:**

```javascript
// Check availability
if (!webgpu.available) {
  console.log('WebGPU not available');
  return;
}

// Safe helper
const buffer = webgpu.createBuffer(1024, webgpu.BUFFER_USAGE_UNIFORM);

// Direct device access for advanced users
const device = webgpu.device;
const commandEncoder = device.createCommandEncoder();

// Create compute pipeline
const shaderModule = webgpu.createShaderModule(wgslCode);
const pipeline = device.createComputePipeline({
  layout: 'auto',
  compute: {
    module: shaderModule,
    entryPoint: 'main'
  }
});

// Users can still do complex WebGPU programming
const bindGroup = device.createBindGroup({
  layout: pipeline.getBindGroupLayout(0),
  entries: [
    { binding: 0, resource: { buffer } }
  ]
});

const computePass = commandEncoder.beginComputePass();
computePass.setPipeline(pipeline);
computePass.setBindGroup(0, bindGroup);
computePass.dispatchWorkgroups(64);
computePass.end();

device.queue.submit([commandEncoder.finish()]);
```

## Security Boundaries

### What SES Already Blocks ✅

- DOM access (`document`, `window`)
- Network (`fetch`, `XMLHttpRequest`)
- Storage (`localStorage`, `sessionStorage`, `indexedDB`)
- Timers (we can provide controlled versions)
- Import/dynamic code loading
- `eval`, `Function()` constructor

### What We Need to Guard

| API | Risk | Mitigation |
|-----|------|------------|
| **WebAudio** | Low - Can't escape sandbox | Full access OK |
| **Canvas 2D** | Low - Just drawing | Full access OK |
| **WebGL** | Medium - GPU complexity | Give full context, helpers for safety |
| **WebGPU** | High - Can crash, OOM | Share device, limit buffer sizes, no adapter |

### WebGPU Specific Safeguards

```typescript
// Implement these checks in helpers
class WebGPUGuard {
  private static readonly MAX_BUFFER_SIZE = 256 * 1024 * 1024; // 256MB
  private static readonly MAX_TEXTURE_DIMENSION = 8192;
  private static totalBufferMemory = 0;
  private static readonly MAX_TOTAL_MEMORY = 1024 * 1024 * 1024; // 1GB
  
  static canAllocateBuffer(size: number): boolean {
    if (size > this.MAX_BUFFER_SIZE) return false;
    if (this.totalBufferMemory + size > this.MAX_TOTAL_MEMORY) return false;
    return true;
  }
  
  static trackBuffer(size: number) {
    this.totalBufferMemory += size;
  }
  
  static untrackBuffer(size: number) {
    this.totalBufferMemory -= size;
  }
}
```

## Implementation Patterns

### Pattern 1: Helper + Raw Access

```typescript
// Shared AudioContext pattern
audio: {
  context: audioContext, // Full API
  
  // Helpers use same context
  playTone(freq: number) {
    const osc = audioContext.createOscillator(); // Same instance!
    // ...
  },
  
  // Shortcuts use same context
  createOscillator: () => audioContext.createOscillator()
}
```

### Pattern 2: Controlled Device Sharing

```typescript
// WebGPU device sharing pattern
webgpu: {
  get device() { return sharedDevice; }, // Read-only device access
  
  // Helpers with safety checks
  createBuffer(size: number, usage: number) {
    if (!this.canAllocate(size)) throw new Error('Size limit exceeded');
    return sharedDevice.createBuffer({ size, usage });
  }
}
```

### Pattern 3: Progressive Enhancement

```typescript
// Start simple, expose more as needed
graphics: {
  // Level 1: Simple helpers
  drawRect(x, y, w, h, color) { },
  
  // Level 2: Raw 2D API
  get canvas2d() { return ctx2d; },
  
  // Level 3: WebGL for advanced users
  get webgl() { return glContext; },
  
  // Level 4: WebGPU for experts
  get webgpu() { return device; }
}
```

## Best Practices

### 1. Always Share Instances

```typescript
// ✅ GOOD - One AudioContext
const audioContext = new AudioContext();
return {
  audio: {
    context: audioContext,
    playTone() { /* uses audioContext */ }
  }
};

// ❌ BAD - Multiple contexts
return {
  audio: {
    context: new AudioContext(), // Instance 1
    playTone() {
      const ctx = new AudioContext(); // Instance 2!
    }
  }
};
```

### 2. Helpers as Convenience, Not Replacement

```typescript
// Helpers should use the same APIs users can access
audio: {
  context: audioContext, // Users can use this
  
  playTone(freq) {
    // Helper uses what user can use
    const osc = audioContext.createOscillator();
    osc.connect(audioContext.destination);
    // ...
  }
}
```

### 3. Document the Shared Instance

```typescript
/**
 * Web Audio API
 * 
 * The `context` property exposes the full AudioContext.
 * All helpers (playTone, loadSound, etc.) use this same context.
 * You can mix helper calls and direct Web Audio API calls freely.
 * 
 * @example
 * // Use helper
 * audio.playTone(440, 1.0);
 * 
 * // Use raw API (same context!)
 * const osc = audio.context.createOscillator();
 * osc.connect(audio.context.destination);
 */
audio: {
  context: AudioContext;
  playTone(freq: number, duration: number): void;
  // ...
}
```

### 4. Provide Safety Without Preventing Power

```typescript
// Give users power, but with guardrails
webgpu: {
  device: GPUDevice, // Full power
  
  // But helpers prevent common mistakes
  createBuffer(size: number, usage: number) {
    if (size > MAX_SAFE_SIZE) {
      throw new Error(`Buffer too large. Max: ${MAX_SAFE_SIZE}`);
    }
    return device.createBuffer({ size, usage });
  },
  
  // Advanced users can bypass if needed
  unsafeCreateBuffer(size: number, usage: number) {
    return device.createBuffer({ size, usage });
  }
}
```

### 5. Layer the Complexity

```typescript
// Make simple things simple, complex things possible
return {
  // Layer 1: Super simple (80% of users)
  draw: {
    rect(x, y, w, h, color) { }
  },
  
  // Layer 2: More control (15% of users)
  canvas2d: {
    context: ctx2d
  },
  
  // Layer 3: Full power (5% of users)
  webgl: {
    context: glCtx
  },
  
  // Layer 4: Bleeding edge (1% of users)
  webgpu: {
    device: gpuDevice
  }
};
```

## Example: Complete Audio API

```typescript
class StorieEngine {
  private audioContext: AudioContext;
  private audioBufferCache = new Map<string, AudioBuffer>();
  
  constructor(canvas: HTMLCanvasElement, config: EngineConfig = {}) {
    // Create shared AudioContext
    this.audioContext = new AudioContext();
  }
  
  private createUserAPI(): SandboxAPI {
    return {
      audio: {
        // === SHARED INSTANCE ===
        context: this.audioContext,
        
        // === HELPERS ===
        playTone(frequency: number, duration: number, volume: number = 0.5) {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          
          osc.frequency.value = frequency;
          gain.gain.value = volume;
          
          osc.connect(gain);
          gain.connect(this.audioContext.destination);
          
          osc.start();
          osc.stop(this.audioContext.currentTime + duration);
          
          return { osc, gain }; // Return for user control
        },
        
        async loadSound(url: string, cache: boolean = true): Promise<AudioBuffer> {
          // Check cache
          if (cache && this.audioBufferCache.has(url)) {
            return this.audioBufferCache.get(url)!;
          }
          
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
          
          if (cache) {
            this.audioBufferCache.set(url, buffer);
          }
          
          return buffer;
        },
        
        playBuffer(buffer: AudioBuffer, options: {
          loop?: boolean;
          volume?: number;
          playbackRate?: number;
        } = {}): AudioBufferSourceNode {
          const source = this.audioContext.createBufferSource();
          const gain = this.audioContext.createGain();
          
          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;
          
          source.connect(gain);
          gain.connect(this.audioContext.destination);
          source.start();
          
          return source; // User can stop/modify
        },
        
        // === RAW API SHORTCUTS ===
        createOscillator: () => this.audioContext.createOscillator(),
        createGain: () => this.audioContext.createGain(),
        createBiquadFilter: () => this.audioContext.createBiquadFilter(),
        createDelay: () => this.audioContext.createDelay(),
        createConvolver: () => this.audioContext.createConvolver(),
        createAnalyser: () => this.audioContext.createAnalyser(),
        createBufferSource: () => this.audioContext.createBufferSource(),
        
        // === PROPERTIES ===
        get currentTime() { return this.audioContext.currentTime; },
        get sampleRate() { return this.audioContext.sampleRate; },
        get destination() { return this.audioContext.destination; }
      }
    };
  }
}
```

## Timeline for Implementation

### Phase 1: Core Audio (Week 1)
- ✅ Shared AudioContext
- ✅ Basic helpers (playTone, loadSound)
- ✅ Raw API exposure
- ✅ Documentation

### Phase 2: Canvas 2D (Week 2)
- ✅ Shared 2D context or offscreen canvas
- ✅ Drawing helpers
- ✅ Raw context exposure
- ✅ Image loading utilities

### Phase 3: WebGL (Week 3)
- ✅ Shared WebGL context
- ✅ Shader compilation helpers
- ✅ Common pattern helpers
- ✅ Full context access

### Phase 4: WebGPU (Week 4)
- ✅ Shared device
- ✅ Safety guardrails
- ✅ Helper functions
- ✅ Controlled device access

## Testing Strategy

### Test Shared Instance Pattern

```javascript
// Test that helpers and raw API use same instance
function testSharedAudioContext() {
  // Create oscillator via helper
  const { osc: osc1 } = audio.playTone(440, 1.0);
  
  // Create oscillator via raw API
  const osc2 = audio.context.createOscillator();
  
  // Both should be connected to same destination
  assert(audio.context.destination === audio.destination);
  
  // Changes in one should reflect in other
  audio.context.destination.maxChannelCount = 4;
  assert(audio.destination.maxChannelCount === 4);
}
```

### Test Memory Limits

```javascript
function testWebGPULimits() {
  // Should succeed
  const smallBuffer = webgpu.createBuffer(1024, webgpu.BUFFER_USAGE_UNIFORM);
  assert(smallBuffer !== null);
  
  // Should fail gracefully
  const tooBig = webgpu.createBuffer(1024 * 1024 * 1024, webgpu.BUFFER_USAGE_UNIFORM);
  assert(tooBig === null);
}
```

## Summary

**Key Principles:**

1. **Share Instances** - One AudioContext, one device, helpers use the same objects
2. **Layer Complexity** - Simple helpers for common tasks, raw API for power users
3. **Zero Overhead** - Helpers are thin wrappers, no duplication
4. **Safety with Power** - Guard dangerous operations, but don't prevent advanced use
5. **Progressive Enhancement** - Start simple, expose more as user needs grow

**The Result:**

Users get a **powerful scripting environment** with:
- ✅ Simple helpers for 80% of tasks
- ✅ Full native API access for the other 20%
- ✅ Zero performance penalty
- ✅ Ability to mix approaches seamlessly
- ✅ Safety guardrails where needed

This approach makes Storie both **easy for beginners** and **powerful for experts**, without the overhead of fully wrapping native APIs.
