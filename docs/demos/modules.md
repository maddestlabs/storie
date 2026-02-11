# Module System Demo

This demo shows how to use the Storie module system to dynamically load optional features.

## Example: Loading Modules

```javascript on:init
async function init() {
  console.log('🚀 Module system demo started');
  
  // Check built-in module availability
  console.log('Available modules:', {
    babylon: 'babylon.module.js (3D graphics)',
    physics: 'physics.module.js (physics engine)',
    particles: 'particles.module.js (particle systems)',
    terminal: 'terminal.module.js (terminal emulation)'
  });
  
  // Try loading the example module
  try {
    console.log('⏳ Loading example module...');
    
    const module = await modules.load('example');
    
    console.log('✓ Module loaded:', {
      name: module.name,
      version: module.version,
      description: module.description
    });
    
    // Get module metadata
    const meta = modules.getMetadata('example');
    console.log('Module metadata:', meta);
    
  } catch (error) {
    console.warn('⚠ Could not load example module:', error.message);
    console.log('This is expected if example.module.js is not built yet.');
  }
  
  // Listen to module events
  modules.on('module:loaded', ({ name, version }) => {
    term.write(2, 8, `Module loaded: ${name} v${version}`, 
      { r: 100, g: 255, b: 100 });
  });
  
  modules.on('module:error', ({ name, error }) => {
    term.write(2, 9, `Module error: ${name} - ${error.message}`, 
      { r: 255, g: 100, b: 100 });
  });
}
```

```javascript on:render
function render() {
  term.clear();
  
  // Title
  term.write(2, 2, 'Storie Module System Demo', { r: 255, g: 200, b: 0 });
  term.write(2, 3, '━'.repeat(40), { r: 100, g: 100, b: 100 });
  
  // Instructions
  term.write(2, 5, 'Press keys to test module loading:', { r: 200, g: 200, b: 200 });
  term.write(4, 6, '1 - Load example module', { r: 150, g: 150, b: 150 });
  term.write(4, 7, '2 - Check module status', { r: 150, g: 150, b: 150 });
  term.write(4, 8, '3 - Unload example module', { r: 150, g: 150, b: 150 });
  
  // Status
  term.write(2, 10, 'Status:', { r: 200, g: 200, b: 200 });
  
  const isLoaded = modules.isLoaded('example');
  const isLoading = modules.isLoading('example');
  
  if (isLoaded) {
    term.write(4, 11, '✓ Example module: LOADED', { r: 100, g: 255, g: 100 });
  } else if (isLoading) {
    term.write(4, 11, '⏳ Example module: LOADING...', { r: 255, g: 200, b: 0 });
  } else {
    term.write(4, 11, '○ Example module: Not loaded', { r: 150, g: 150, b: 150 });
  }
  
  // Module info
  term.write(2, 13, 'Module API:', { r: 200, g: 200, b: 200 });
  term.write(4, 14, 'modules.load(name)', { r: 100, g: 200, b: 255 });
  term.write(4, 15, 'modules.loadAll([names])', { r: 100, g: 200, b: 255 });
  term.write(4, 16, 'modules.isLoaded(name)', { r: 100, g: 200, b: 255 });
  term.write(4, 17, 'modules.get(name)', { r: 100, g: 200, b: 255 });
  term.write(4, 18, 'modules.unload(name)', { r: 100, g: 200, b: 255 });
  
  // Footer
  const frameText = `Frame: ${getFrame()} | Time: ${getTime().toFixed(1)}s`;
  term.write(2, termHeight - 2, frameText, { r: 100, g: 100, b: 100 });
}
```

```javascript on:input
function input(event) {
  if (event.type === 'key' && event.action === 'down') {
    if (event.key === '1') {
      console.log('Loading example module...');
      modules.load('example')
        .then(() => console.log('✓ Loaded!'))
        .catch(err => console.error('✗ Failed:', err));
    }
    else if (event.key === '2') {
      console.log('Module status:');
      console.log('  Loaded:', modules.isLoaded('example'));
      console.log('  Loading:', modules.isLoading('example'));
      
      const meta = modules.getMetadata('example');
      if (meta) {
        console.log('  Metadata:', meta);
      }
    }
    else if (event.key === '3') {
      console.log('Unloading example module...');
      modules.unload('example')
        .then(() => console.log('✓ Unloaded!'))
        .catch(err => console.error('✗ Failed:', err));
    }
  }
  
  return true; // Continue running
}
```

## Usage

This demo shows the module system API available to all Storie applications.

### Loading via Frontmatter

You can also declare modules in frontmatter to load them automatically:

```markdown
---
modules: [example, babylon]
---

# My App

Modules are loaded before init() runs.
```

### Module Features

- **Lazy Loading**: Modules are only loaded when needed
- **Dependency Management**: Modules can depend on other modules
- **Event System**: Listen to load/error events
- **Metadata**: Query module information
- **Async Support**: All operations are properly async

See `MODULE_SYSTEM.md` for complete documentation.
