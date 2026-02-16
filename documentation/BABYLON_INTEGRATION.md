# Babylon.js Modular Integration Architecture

## Overview

Storie integrates Babylon.js as an **optional 3D module** that can be dynamically loaded when needed. Users creating 2D experiences won't pay the bandwidth/performance cost.

## Architecture Layers

```
┌─────────────────────────────────────────────────────┐
│  User Markdown (.md)                                │
│  - Declares modules needed                          │
│  - JavaScript code blocks use unified API           │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Storie Core Engine (~200KB)                        │
│  ├── WebGPU device management                       │
│  ├── 2D renderer (sprites, quads, primitives)       │
│  ├── WebAudio node graph                            │
│  ├── Input system                                   │
│  ├── Module loader                                  │
│  └── Unified API layer                              │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Optional Modules (lazy loaded)                     │
│  ├── babylon.module.js (~700KB) ← Babylon.js + glue│
│  ├── physics.module.js (~150KB)                     │
│  ├── particles.module.js (~80KB)                    │
│  └── terminal.module.js (~100KB) ← TStorie compat  │
└─────────────────────────────────────────────────────┘
```

## Module Declaration in Markdown

Users declare required modules in frontmatter:

```markdown
---
modules: [babylon, physics]
---

# My 3D Game

```javascript
function init() {
  // Babylon.js is now available via graphics3d
  const box = graphics3d.box({
    size: 2,
    position: [0, 1, 0],
    material: 'pbr'
  });
  
  box.rotate([0, 1, 0], getDelta());
}
```

## Core API Design

### Unified Graphics API

```javascript
// 2D API (always available - core)
graphics2d.sprite(texture, x, y, options);
graphics2d.rect(x, y, w, h, color);
graphics2d.circle(x, y, radius, color);
graphics2d.text(text, x, y, font, color);
graphics2d.layer(name, zIndex);

// 3D API (requires babylon module)
graphics3d.box(config);
graphics3d.sphere(config);
graphics3d.mesh(vertices, indices, config);
graphics3d.model(url, config);
graphics3d.camera(type, config);
graphics3d.light(type, config);

// Shader API (works with both)
shader.load(name, wgslCode);
shader.apply(name, object);
shader.uniform(name, key, value);

// Audio API (always available - core)
audio.node(type, config);
audio.connect(source, target);
audio.play(source);
```

## File Structure

```
src/
├── core/
│   ├── engine.ts              # Main engine
│   ├── renderer2d.ts          # Core 2D renderer
│   ├── webgpu-device.ts       # Shared WebGPU device
│   ├── audio-system.ts        # WebAudio wrapper
│   ├── input-system.ts        # Keyboard/mouse/touch
│   ├── module-loader.ts       # Dynamic module loading
│   └── api/
│       ├── graphics2d.ts      # 2D API
│       ├── graphics3d-stub.ts # Stub (loads module)
│       ├── shader.ts          # Shader API
│       └── audio.ts           # Audio API
│
└── modules/
    ├── babylon/
    │   ├── babylon.module.ts  # Main module entry
    │   ├── graphics3d-impl.ts # Babylon-backed 3D API
    │   ├── shader-bridge.ts   # WGSL shader integration
    │   ├── scene-manager.ts   # Scene lifecycle
    │   └── camera-controller.ts
    │
    ├── physics/
    │   └── physics.module.ts
    │
    └── terminal/
        └── terminal.module.ts

web/
└── modules/                   # Built modules (output)
    ├── babylon.module.js
    ├── physics.module.js
    └── terminal.module.js

docs/shaders/wgsl/            # Your existing WGSL shaders
├── plasma.wgsl
├── fire.wgsl
└── ...
```

## Module Loader Implementation

```typescript
// src/core/module-loader.ts

export interface StorieModule {
  name: string;
  version: string;
  init(engine: StorieEngine): Promise<void>;
  dispose(): void;
}

export class ModuleLoader {
  private engine: StorieEngine;
  private loaded = new Map<string, StorieModule>();
  private loading = new Map<string, Promise<StorieModule>>();
  
  constructor(engine: StorieEngine) {
    this.engine = engine;
  }
  
  async load(moduleName: string): Promise<StorieModule> {
    // Check if already loaded
    if (this.loaded.has(moduleName)) {
      return this.loaded.get(moduleName)!;
    }
    
    // Check if currently loading
    if (this.loading.has(moduleName)) {
      return this.loading.get(moduleName)!;
    }
    
    // Start loading
    const loadPromise = this.loadModule(moduleName);
    this.loading.set(moduleName, loadPromise);
    
    const module = await loadPromise;
    this.loaded.set(moduleName, module);
    this.loading.delete(moduleName);
    
    console.log(`✓ Module loaded: ${moduleName} (${module.version})`);
    return module;
  }
  
  private async loadModule(name: string): Promise<StorieModule> {
    const modulePath = `./modules/${name}.module.js`;
    
    try {
      const moduleExports = await import(modulePath);
      const ModuleClass = moduleExports.default;
      const module: StorieModule = new ModuleClass();
      
      await module.init(this.engine);
      
      return module;
    } catch (error) {
      console.error(`✗ Failed to load module: ${name}`, error);
      throw new Error(`Module not found: ${name}`);
    }
  }
  
  isLoaded(name: string): boolean {
    return this.loaded.has(name);
  }
  
  get(name: string): StorieModule | undefined {
    return this.loaded.get(name);
  }
  
  dispose() {
    for (const module of this.loaded.values()) {
      module.dispose();
    }
    this.loaded.clear();
  }
}
```

## Babylon.js Module Implementation

```typescript
// src/modules/babylon/babylon.module.ts

import * as BABYLON from '@babylonjs/core';
import type { StorieModule, StorieEngine } from '../../core/engine';
import { BabylonGraphics3D } from './graphics3d-impl';
import { ShaderBridge } from './shader-bridge';

export default class BabylonModule implements StorieModule {
  name = 'babylon';
  version = '7.0.0';
  
  private engine!: StorieEngine;
  private babylonEngine!: BABYLON.WebGPUEngine;
  private scene!: BABYLON.Scene;
  private graphics3d!: BabylonGraphics3D;
  private shaderBridge!: ShaderBridge;
  
  async init(storieEngine: StorieEngine): Promise<void> {
    this.engine = storieEngine;
    
    // Get shared WebGPU device from Storie core
    const device = storieEngine.getWebGPUDevice();
    const canvas = storieEngine.getCanvas();
    
    // Create Babylon WebGPU engine using shared device
    this.babylonEngine = new BABYLON.WebGPUEngine(canvas, {
      deviceDescriptor: { device }, // Use existing device
      antialias: true,
      stencil: true,
    });
    
    await this.babylonEngine.initAsync();
    
    // Create scene
    this.scene = new BABYLON.Scene(this.babylonEngine);
    this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0); // Transparent
    
    // Setup default camera
    const camera = new BABYLON.ArcRotateCamera(
      'camera',
      0, Math.PI / 3, 10,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    camera.attachControl(canvas, true);
    
    // Setup default light
    const light = new BABYLON.HemisphericLight(
      'light',
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    
    // Create API implementations
    this.graphics3d = new BabylonGraphics3D(this.scene, this.babylonEngine);
    this.shaderBridge = new ShaderBridge(this.scene, storieEngine.shaderLibrary);
    
    // Register APIs with engine
    storieEngine.registerAPI('graphics3d', this.graphics3d);
    storieEngine.registerAPI('shader', this.shaderBridge);
    
    // Hook into render loop
    storieEngine.on('beforeRender', () => this.scene.render());
  }
  
  dispose(): void {
    this.scene?.dispose();
    this.babylonEngine?.dispose();
  }
  
  // Public accessors for advanced users
  getScene(): BABYLON.Scene {
    return this.scene;
  }
  
  getEngine(): BABYLON.WebGPUEngine {
    return this.babylonEngine;
  }
}
```

## Graphics3D API Implementation

```typescript
// src/modules/babylon/graphics3d-impl.ts

import * as BABYLON from '@babylonjs/core';

export interface MeshConfig {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
  material?: string | MaterialConfig;
  castShadows?: boolean;
  receiveShadows?: boolean;
}

export interface MaterialConfig {
  type: 'pbr' | 'standard' | 'custom';
  albedo?: [number, number, number, number];
  metallic?: number;
  roughness?: number;
  emissive?: [number, number, number];
  texture?: string;
  shader?: string;
}

export class BabylonGraphics3D {
  private scene: BABYLON.Scene;
  private engine: BABYLON.WebGPUEngine;
  private meshes = new Map<string, BABYLON.Mesh>();
  private materials = new Map<string, BABYLON.Material>();
  
  constructor(scene: BABYLON.Scene, engine: BABYLON.WebGPUEngine) {
    this.scene = scene;
    this.engine = engine;
  }
  
  // Primitive creation
  box(config: MeshConfig & { size?: number; width?: number; height?: number; depth?: number }): string {
    const id = this.generateId('box');
    const mesh = BABYLON.MeshBuilder.CreateBox(id, {
      size: config.size || 1,
      width: config.width,
      height: config.height,
      depth: config.depth,
    }, this.scene);
    
    this.applyConfig(mesh, config);
    this.meshes.set(id, mesh);
    return id;
  }
  
  sphere(config: MeshConfig & { radius?: number; segments?: number }): string {
    const id = this.generateId('sphere');
    const mesh = BABYLON.MeshBuilder.CreateSphere(id, {
      diameter: (config.radius || 1) * 2,
      segments: config.segments || 32,
    }, this.scene);
    
    this.applyConfig(mesh, config);
    this.meshes.set(id, mesh);
    return id;
  }
  
  cylinder(config: MeshConfig & { radius?: number; height?: number }): string {
    const id = this.generateId('cylinder');
    const mesh = BABYLON.MeshBuilder.CreateCylinder(id, {
      diameter: (config.radius || 1) * 2,
      height: config.height || 2,
    }, this.scene);
    
    this.applyConfig(mesh, config);
    this.meshes.set(id, mesh);
    return id;
  }
  
  plane(config: MeshConfig & { width?: number; height?: number }): string {
    const id = this.generateId('plane');
    const mesh = BABYLON.MeshBuilder.CreatePlane(id, {
      width: config.width || 1,
      height: config.height || 1,
    }, this.scene);
    
    this.applyConfig(mesh, config);
    this.meshes.set(id, mesh);
    return id;
  }
  
  // Model loading
  async model(url: string, config: MeshConfig = {}): Promise<string> {
    const id = this.generateId('model');
    
    const result = await BABYLON.SceneLoader.ImportMeshAsync('', '', url, this.scene);
    
    // Group meshes under a parent
    const parent = new BABYLON.TransformNode(id, this.scene);
    result.meshes.forEach(mesh => {
      if (mesh.parent === null) {
        mesh.parent = parent;
      }
    });
    
    this.applyConfig(parent, config);
    
    return id;
  }
  
  // Custom mesh
  mesh(vertices: number[], indices: number[], config: MeshConfig = {}): string {
    const id = this.generateId('mesh');
    const mesh = new BABYLON.Mesh(id, this.scene);
    
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = vertices;
    vertexData.indices = indices;
    vertexData.applyToMesh(mesh);
    
    this.applyConfig(mesh, config);
    this.meshes.set(id, mesh);
    return id;
  }
  
  // Transform methods
  setPosition(id: string, x: number, y: number, z: number): void {
    const obj = this.getNode(id);
    if (obj) obj.position = new BABYLON.Vector3(x, y, z);
  }
  
  setRotation(id: string, x: number, y: number, z: number): void {
    const obj = this.getNode(id);
    if (obj) obj.rotation = new BABYLON.Vector3(x, y, z);
  }
  
  setScale(id: string, x: number, y: number, z: number): void {
    const obj = this.getNode(id);
    if (obj) obj.scaling = new BABYLON.Vector3(x, y, z);
  }
  
  rotate(id: string, axis: [number, number, number], angle: number): void {
    const obj = this.getNode(id);
    if (obj) {
      obj.rotate(new BABYLON.Vector3(...axis), angle);
    }
  }
  
  // Camera
  camera(type: 'arc' | 'free' | 'universal', config: any = {}): string {
    const id = this.generateId('camera');
    let camera: BABYLON.Camera;
    
    switch (type) {
      case 'arc':
        camera = new BABYLON.ArcRotateCamera(
          id,
          config.alpha || 0,
          config.beta || Math.PI / 3,
          config.radius || 10,
          config.target ? new BABYLON.Vector3(...config.target) : BABYLON.Vector3.Zero(),
          this.scene
        );
        break;
      case 'free':
        camera = new BABYLON.FreeCamera(
          id,
          config.position ? new BABYLON.Vector3(...config.position) : new BABYLON.Vector3(0, 5, -10),
          this.scene
        );
        break;
      default:
        camera = new BABYLON.UniversalCamera(
          id,
          config.position ? new BABYLON.Vector3(...config.position) : new BABYLON.Vector3(0, 5, -10),
          this.scene
        );
    }
    
    if (config.active !== false) {
      this.scene.activeCamera = camera;
      camera.attachControl(this.engine.getRenderingCanvas()!, true);
    }
    
    return id;
  }
  
  // Lighting
  light(type: 'point' | 'directional' | 'spot' | 'hemispheric', config: any = {}): string {
    const id = this.generateId('light');
    let light: BABYLON.Light;
    
    switch (type) {
      case 'point':
        light = new BABYLON.PointLight(
          id,
          config.position ? new BABYLON.Vector3(...config.position) : new BABYLON.Vector3(0, 10, 0),
          this.scene
        );
        break;
      case 'directional':
        light = new BABYLON.DirectionalLight(
          id,
          config.direction ? new BABYLON.Vector3(...config.direction) : new BABYLON.Vector3(0, -1, 0),
          this.scene
        );
        break;
      case 'spot':
        light = new BABYLON.SpotLight(
          id,
          config.position ? new BABYLON.Vector3(...config.position) : new BABYLON.Vector3(0, 10, 0),
          config.direction ? new BABYLON.Vector3(...config.direction) : new BABYLON.Vector3(0, -1, 0),
          config.angle || Math.PI / 4,
          config.exponent || 2,
          this.scene
        );
        break;
      default:
        light = new BABYLON.HemisphericLight(
          id,
          config.direction ? new BABYLON.Vector3(...config.direction) : new BABYLON.Vector3(0, 1, 0),
          this.scene
        );
    }
    
    if (config.intensity !== undefined) light.intensity = config.intensity;
    if (config.color) light.diffuse = new BABYLON.Color3(...config.color);
    
    return id;
  }
  
  // Material
  material(config: MaterialConfig): string {
    const id = this.generateId('material');
    let material: BABYLON.Material;
    
    switch (config.type) {
      case 'pbr':
        const pbr = new BABYLON.PBRMaterial(id, this.scene);
        if (config.albedo) pbr.albedoColor = new BABYLON.Color3(...config.albedo.slice(0, 3));
        if (config.metallic !== undefined) pbr.metallic = config.metallic;
        if (config.roughness !== undefined) pbr.roughness = config.roughness;
        if (config.emissive) pbr.emissiveColor = new BABYLON.Color3(...config.emissive);
        material = pbr;
        break;
      default:
        const standard = new BABYLON.StandardMaterial(id, this.scene);
        if (config.albedo) standard.diffuseColor = new BABYLON.Color3(...config.albedo.slice(0, 3));
        material = standard;
    }
    
    this.materials.set(id, material);
    return id;
  }
  
  applyMaterial(meshId: string, materialId: string): void {
    const mesh = this.meshes.get(meshId);
    const material = this.materials.get(materialId);
    if (mesh && material) {
      mesh.material = material;
    }
  }
  
  // Disposal
  remove(id: string): void {
    const node = this.getNode(id);
    if (node) {
      node.dispose();
      this.meshes.delete(id);
    }
  }
  
  // Helpers
  private applyConfig(node: BABYLON.TransformNode | BABYLON.Mesh, config: MeshConfig): void {
    if (config.position) node.position = new BABYLON.Vector3(...config.position);
    if (config.rotation) node.rotation = new BABYLON.Vector3(...config.rotation);
    if (config.scale) {
      const scale = typeof config.scale === 'number' 
        ? [config.scale, config.scale, config.scale] 
        : config.scale;
      node.scaling = new BABYLON.Vector3(...scale);
    }
    
    // Apply material if it's a mesh
    if (node instanceof BABYLON.Mesh && config.material) {
      if (typeof config.material === 'string') {
        // Look up existing material
        const mat = this.materials.get(config.material);
        if (mat) node.material = mat;
      } else {
        // Create material inline
        const matId = this.material(config.material);
        node.material = this.materials.get(matId)!;
      }
    }
  }
  
  private getNode(id: string): BABYLON.TransformNode | null {
    return this.scene.getTransformNodeById(id) || this.meshes.get(id) || null;
  }
  
  private idCounter = 0;
  private generateId(prefix: string): string {
    return `${prefix}_${this.idCounter++}`;
  }
}
```

## WGSL Shader Bridge

```typescript
// src/modules/babylon/shader-bridge.ts

import * as BABYLON from '@babylonjs/core';

export class ShaderBridge {
  private scene: BABYLON.Scene;
  private shaderLibrary: Map<string, string>; // From Storie core
  private materials = new Map<string, BABYLON.ShaderMaterial>();
  
  constructor(scene: BABYLON.Scene, shaderLibrary: Map<string, string>) {
    this.scene = scene;
    this.shaderLibrary = shaderLibrary;
  }
  
  // Load WGSL shader from Storie's library
  load(name: string, wgslCode?: string): void {
    if (wgslCode) {
      this.shaderLibrary.set(name, wgslCode);
    }
    
    const code = this.shaderLibrary.get(name);
    if (!code) {
      throw new Error(`Shader not found: ${name}`);
    }
    
    // Babylon.js 7.x+ supports WGSL directly via ShaderMaterial
    const material = new BABYLON.ShaderMaterial(
      `shader_${name}`,
      this.scene,
      {
        // WGSL vertex shader
        vertexSource: this.getDefaultVertexShader(),
        // WGSL fragment shader  
        fragmentSource: code,
      },
      {
        attributes: ['position', 'normal', 'uv'],
        uniforms: ['worldViewProjection', 'time', 'resolution'],
        shaderLanguage: BABYLON.ShaderLanguage.WGSL,
      }
    );
    
    this.materials.set(name, material);
  }
  
  // Apply shader to mesh
  apply(shaderName: string, meshId: string): void {
    const material = this.materials.get(shaderName);
    if (!material) {
      throw new Error(`Shader not loaded: ${shaderName}`);
    }
    
    const mesh = this.scene.getMeshById(meshId);
    if (mesh) {
      mesh.material = material;
    }
  }
  
  // Set uniform
  uniform(shaderName: string, key: string, value: any): void {
    const material = this.materials.get(shaderName);
    if (!material) return;
    
    if (Array.isArray(value)) {
      if (value.length === 2) material.setVector2(key, new BABYLON.Vector2(...value));
      else if (value.length === 3) material.setVector3(key, new BABYLON.Vector3(...value));
      else if (value.length === 4) material.setVector4(key, new BABYLON.Vector4(...value));
    } else if (typeof value === 'number') {
      material.setFloat(key, value);
    }
  }
  
  private getDefaultVertexShader(): string {
    return `
      struct Uniforms {
        worldViewProjection : mat4x4<f32>,
      };
      @binding(0) @group(0) var<uniform> uniforms : Uniforms;
      
      struct VertexInput {
        @location(0) position : vec3<f32>,
        @location(1) normal : vec3<f32>,
        @location(2) uv : vec2<f32>,
      };
      
      struct VertexOutput {
        @builtin(position) position : vec4<f32>,
        @location(0) vUV : vec2<f32>,
        @location(1) vNormal : vec3<f32>,
      };
      
      @vertex
      fn main(input : VertexInput) -> VertexOutput {
        var output : VertexOutput;
        output.position = uniforms.worldViewProjection * vec4<f32>(input.position, 1.0);
        output.vUV = input.uv;
        output.vNormal = input.normal;
        return output;
      }
    `;
  }
}
```

## Usage Examples

### Basic 3D Scene

```markdown
---
modules: [babylon]
---

# Rotating Cube

```javascript
let cube;

function init() {
  // Create cube
  cube = graphics3d.box({
    size: 2,
    position: [0, 1, 0],
    material: {
      type: 'pbr',
      albedo: [1, 0, 0, 1],
      metallic: 0.5,
      roughness: 0.5
    }
  });
  
  // Setup camera
  graphics3d.camera('arc', {
    alpha: 0,
    beta: Math.PI / 4,
    radius: 8
  });
  
  // Add light
  graphics3d.light('hemispheric', {
    intensity: 1.0
  });
}

function update(delta) {
  // Rotate cube
  graphics3d.rotate(cube, [0, 1, 0], delta * 2);
}
```
```

### Using WGSL Shaders

```markdown
---
modules: [babylon]
---

# Plasma Shader Demo

```javascript
let sphere;

function init() {
  // Create sphere
  sphere = graphics3d.sphere({
    radius: 2,
    segments: 64
  });
  
  // Load and apply shader from docs/shaders/wgsl/
  shader.load('plasma', await fetch('shaders/wgsl/plasma.wgsl').then(r => r.text()));
  shader.apply('plasma', sphere);
  
  graphics3d.camera('arc', { radius: 8 });
  graphics3d.light('hemispheric');
}

function update(delta) {
  // Update shader uniforms
  shader.uniform('plasma', 'time', getTime());
  graphics3d.rotate(sphere, [0, 1, 0], delta);
}
```
```

### Mixed 2D/3D

```markdown
---
modules: [babylon]
---

# Mixed 2D/3D Game

```javascript
let player3d;

function init() {
  // 3D world
  player3d = graphics3d.box({ size: 1, position: [0, 0.5, 0] });
  graphics3d.plane({ width: 20, height: 20, rotation: [Math.PI/2, 0, 0] });
  graphics3d.camera('free', { position: [0, 5, -10] });
  graphics3d.light('directional', { direction: [0, -1, 0.5] });
  
  // 2D HUD overlay
  graphics2d.layer('hud', 100);
}

function render() {
  // 2D UI rendered on top
  graphics2d.text(`Score: ${score}`, 10, 10, '24px Arial', '#fff');
  graphics2d.rect(0, canvas.height - 50, healthBar * 200, 40, '#0f0');
}
```
```

## Build Configuration

```typescript
// vite.config.ts

export default {
  build: {
    rollupOptions: {
      input: {
        main: 'src/main.ts',
      },
      output: {
        // Core bundle
        entryFileNames: 'storie.es.js',
        
        // Split modules
        manualChunks: {
          'babylon.module': ['src/modules/babylon/babylon.module.ts'],
          'physics.module': ['src/modules/physics/physics.module.ts'],
          'terminal.module': ['src/modules/terminal/terminal.module.ts'],
        }
      }
    },
    
    // External Babylon.js CDN (optional)
    external: ['@babylonjs/core'],
  }
}
```

## Benefits

1. **Small core** - Users only download what they need
2. **WGSL compatibility** - Your shader library works directly
3. **Shared WebGPU device** - No resource duplication
4. **Progressive enhancement** - 2D → 3D as needed
5. **Keep your audio system** - No wrapper overhead
6. **Clean API** - Consistent interface regardless of backend
7. **Future-proof** - Easy to add more modules (physics, particles, etc.)

## Next Steps

1. Implement core 2D renderer
2. Build module loader system
3. Create Babylon.js module wrapper
4. Test WGSL shader integration
5. Add example demos
6. Document API
