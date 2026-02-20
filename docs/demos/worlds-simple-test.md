---
title: "Worlds Simple Test"
theme: "neotopia"
---

# Simple Worlds Test

Testing worlds with proper lifecycle hooks.

```js on:init
console.log('=== Worlds Test (init) ===');
console.log('typeof worlds:', typeof worlds);
console.log('worlds:', worlds);

if (typeof worlds !== 'undefined') {
  console.log('✓ worlds is defined');
  console.log('worlds.available:', worlds.available);
  console.log('worlds.camera:', worlds.camera);

  worlds.enable();
  console.log('✓ 3D enable requested');
} else {
  console.error('✗ worlds is undefined!');
}
```

```js on:render
term.clear();
term.write(0, 0, "Worlds Test");
term.write(0, 2, worlds.enabled ? "3D Mode: ENABLED" : "3D Mode: disabled");
term.write(0, 3, worlds.available ? "Available: YES" : "Available: NO");
```

## Test Section

Content here.
