# Storie Module System

The module system enables dynamic loading of optional features, keeping the core engine lightweight while providing powerful extensibility.

## Overview

Modules are self-contained features that can be dynamically loaded when needed. Users creating 2D experiences won't pay the cost of 3D libraries, and vice versa.

### Architecture

```
Core Engine (~200KB)
  ├── WebGPU device management
  ├── 2D rendering
  ├── WebAudio
  ├── Input system
  └── Module loader

Optional Modules (lazy loaded)
  ├── babylon.module.js (~700KB) - 3D graphics
  ├── physics.module.js (~150KB) - Physics engine
  ├── particles.module.js (~80KB) - Advanced particles
  └── terminal.module.js (~100KB) - Terminal aesthetics
```

## Usage

### Declaring Modules in Markdown

Add modules to your markdown frontmatter:

```markdown
---
modules: [babylon, physics]
---

# My 3D Game

\`\`\`javascript on:init
async function init() {
  // Modules are automatically loaded before init runs
  console.log(modules.isLoaded('babylon')); // true
  
  // Access module APIs
  const box = graphics3d.box({ size: 2 });
}
\`\`\`
```

### Loading Modules Dynamically

Load modules at runtime from JavaScript code:

```javascript
// Load single module
await modules.load('babylon');

// Load multiple modules
await modules.loadAll(['babylon', 'physics']);

// Check if loaded
if (modules.isLoaded('babylon')) {
  // Use module features
}

// Listen to module events
modules.on('module:loaded', ({ name, version }) => {
  console.log(`${name} v${version} loaded`);
});

modules.on('module:error', ({ name, error }) => {
  console.error(`Failed to load ${name}:`, error);
});
```

### Module API

Available in user code via the `modules` global:

```javascript
// Load a module
await modules.load(name: string, options?: ModuleLoadOptions)

// Load multiple modules
await modules.loadAll(names: string[], options?: ModuleLoadOptions)

// Check if module is loaded
modules.isLoaded(name: string): boolean

// Check if module is loading
modules.isLoading(name: string): boolean

// Get loaded module instance
modules.get(name: string): StorieModule | undefined

// Get module metadata
modules.getMetadata(name: string): ModuleMetadata | undefined

// Unload a module
await modules.unload(name: string)

// Event listeners
modules.on(event: string, callback: Function)
```

## Creating Custom Modules

### Module Interface

Every module must implement the `StorieModule` interface:

```typescript
interface StorieModule {
  readonly name: string;          // Unique identifier
  readonly version: string;        // Semantic version
  readonly description?: string;   // Optional description
  readonly dependencies?: string[]; // Module dependencies
  
  init(engine: StorieEngine): Promise<void>;  // Initialize
  dispose(): void;                             // Cleanup
  update?(deltaTime: number): void;           // Optional update hook
  render?(): void;                             // Optional render hook
}
```

### Example Module

```typescript
// src/modules/mymodule/mymodule.module.ts

import type { StorieModule } from '../types.js';
import type { StorieEngine } from '../../engine.js';

export default class MyModule implements StorieModule {
  readonly name = 'mymodule';
  readonly version = '1.0.0';
  readonly description = 'My custom module';
  readonly dependencies = []; // e.g., ['babylon']
  
  private engine!: StorieEngine;
  
  async init(engine: StorieEngine): Promise<void> {
    this.engine = engine;
    console.log(`✓ MyModule initialized`);
    
    // Setup your module
    // Access engine systems: engine.getCanvas(), etc.
  }
  
  update(deltaTime: number): void {
    // Called every frame
  }
  
  render(): void {
    // Called every frame during render
  }
  
  dispose(): void {
    // Clean up resources
    console.log(`✓ MyModule disposed`);
  }
}
```

### Building Modules

Modules are built as separate JavaScript files:

```typescript
// vite.config.ts
export default {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'mymodule.module': ['src/modules/mymodule/mymodule.module.ts']
        }
      }
    }
  }
}
```

This outputs `mymodule.module.js` which can be loaded via:

```javascript
await modules.load('mymodule');
```

### Module Resolution

By default, modules are resolved from `./modules/{name}.module.js`.

Configure custom resolution:

```typescript
const engine = new StorieEngine(canvas, {
  modules: {
    baseUrl: 'https://cdn.example.com/storie-modules',
    versions: {
      'babylon': '7.0.0',
      'physics': '2.1.0'
    },
    patterns: {
      'custom': 'https://example.com/custom-module.js'
    }
  }
});
```

Or set a custom resolver:

```typescript
engine.getModuleLoader().setResolver((name) => {
  return `https://my-cdn.com/${name}.js`;
});
```

## Built-in Modules

### Babylon.js (3D Graphics)

**Name:** `babylon`  
**Size:** ~700KB  
**Features:**
- Full 3D scene graph
- PBR materials & lighting
- Model loading (GLTF, etc.)
- Shadow mapping
- Post-processing
- Native WGSL shader support

**API:** `graphics3d.*`

```javascript
// Frontmatter
---
modules: [babylon]
---

// Usage
const box = graphics3d.box({ size: 2 });
graphics3d.camera('arc', { radius: 10 });
graphics3d.light('directional');
```

### Physics

**Name:** `physics`  
**Size:** ~150KB (TBD)  
**Features:** Rigid body physics, collisions, constraints

### Particles

**Name:** `particles`  
**Size:** ~80KB (TBD)  
**Features:** GPU-accelerated particle systems

### Terminal

**Name:** `terminal`  
**Size:** ~100KB  
**Features:** Advanced terminal emulation, ANSI art compatibility

## Module Lifecycle

1. **Declaration** - User declares modules in frontmatter or loads dynamically
2. **Resolution** - Module name resolved to URL
3. **Import** - JavaScript module imported
4. **Dependency Loading** - Dependencies loaded recursively
5. **Initialization** - Module's `init()` called with engine reference
6. **Registration** - Module registered and available
7. **Update/Render** - Module's `update()` and `render()` called each frame
8. **Disposal** - Module's `dispose()` called when unloaded or engine disposed

## Events

Module loader emits events for monitoring:

```javascript
modules.on('module:loading', ({ name }) => {
  console.log(`Loading ${name}...`);
});

modules.on('module:loaded', ({ name, version, url }) => {
  console.log(`✓ ${name} v${version} loaded from ${url}`);
});

modules.on('module:error', ({ name, error }) => {
  console.error(`✗ ${name} failed:`, error);
});

modules.on('module:disposed', ({ name }) => {
  console.log(`✓ ${name} unloaded`);
});
```

## Best Practices

### Module Size

Keep modules focused and lightweight. If a module is >1MB, consider splitting it further.

### Dependencies

Declare dependencies explicitly to ensure proper load order:

```typescript
readonly dependencies = ['babylon']; // Loads babylon first
```

### Cleanup

Always clean up resources in `dispose()`:

```typescript
dispose(): void {
  // Remove event listeners
  // Dispose GPU resources
  // Clear timers/intervals
  // Release memory
}
```

### Error Handling

Handle initialization failures gracefully:

```typescript
async init(engine: StorieEngine): Promise<void> {
  try {
    // Initialization code
  } catch (error) {
    console.error('Module init failed:', error);
    throw error; // Re-throw to prevent module registration
  }
}
```

### Shared Resources

Modules can share the WebGPU device:

```typescript
async init(engine: StorieEngine): Promise<void> {
  const device = engine.getWebGPUDevice();
  if (device) {
    // Use shared device
  }
}
```

## Troubleshooting

### Module Not Found

```
Module load failed: mymodule - Failed to fetch
```

**Solution:** Check module URL resolution. Ensure module file exists at the resolved path.

### Dependency Errors

```
Module load failed: Failed to load dependencies
```

**Solution:** Check that all dependencies are available and loadable.

### Init Timeout

```
Module load timeout: mymodule
```

**Solution:** Module initialization took >30s (default). Increase timeout:

```javascript
await modules.load('mymodule', { timeout: 60000 }); // 60s
```

### Circular Dependencies

Avoid circular dependencies between modules. If module A depends on B, and B depends on A, loading will fail.

## Examples

See:
- `src/modules/example/example.module.ts` - Template module
- `BABYLON_INTEGRATION.md` - Babylon.js integration architecture
- `docs/demos/` - Example markdown files using modules

## API Reference

Full TypeScript interfaces in `src/modules/types.ts`:

- `StorieModule` - Module interface
- `ModuleMetadata` - Module information
- `ModuleLoadOptions` - Load configuration
- `ModuleResolver` - URL resolution function
- `ModuleLoaderEvents` - Event types
