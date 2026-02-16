---
title: "Canvas3D Simple Test"
theme: "neotopia"
---

# Simple Canvas3D Test

Testing canvas3D with proper lifecycle hooks.

```js on:init
console.log('=== Canvas3D Test (init) ===');
console.log('typeof canvas3D:', typeof canvas3D);
console.log('canvas3D:', canvas3D);

if (typeof canvas3D !== 'undefined') {
  console.log('✓ canvas3D is defined');
  console.log('canvas3D.available:', canvas3D.available);
  console.log('canvas3D.camera:', canvas3D.camera);

  canvas3D.enable();
  console.log('✓ 3D enable requested');
} else {
  console.error('✗ canvas3D is undefined!');
}
```

```js on:render
term.clear();
term.write(0, 0, "Canvas3D Test");
term.write(0, 2, canvas3D.enabled ? "3D Mode: ENABLED" : "3D Mode: disabled");
term.write(0, 3, canvas3D.available ? "Available: YES" : "Available: NO");
```

## Test Section

Content here.
