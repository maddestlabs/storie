---
title: "3D Canvas Demo - Rotating Cube"
theme: "neotopia"
---

# Welcome to 3D Canvas {"x": "0", "y": "0", "z": "0"}

This demo showcases Storie's new **3D Canvas** system! 

Sections can now be positioned and rotated in 3D space using metadata
in the section heading.

Click through the sections to see the camera smoothly ease between different
3D positions and rotations.

- [Go to Front Face](#front-face)
- [Go to Top Face](#top-face)
- [Go to Side Face](#side-face)
- [See the Ring](#ring-demo)

```javascript on:init
// Enable 3D canvas mode
  
  // Configure camera
  // Start farther back so nearby sections (e.g. ring z=80)
  // don't fill the entire view.
  canvas3D.camera.setPosition(0, 0, 250);
  canvas3D.camera.setRotation(0, 0, 0);
  canvas3D.camera.setEaseSpeed(0.08, 0.12);
canvas3D.enable();

// Position camera
canvas3D.camera.setPosition(0, 0, 250);
canvas3D.camera.setRotation(0, 0, 0);
canvas3D.camera.setEaseSpeed(0.08, 0.12);

// Optional: show a message when WebGPU isn't available
// if (!canvas3D.available) console.warn('3D Canvas not available - WebGPU required');
```

# Front Face {"x": "0", "y": "0", "z": "0", "rotate-y": "0"}

You're looking at the **front face** of our 3D cube structure.

This section is positioned at the origin (0, 0, 0) with no rotation.

The camera smoothly eases to look at each section when you navigate via links.

- [Go to Top](#top-face)
- [Go to Side](#side-face)
- [Back to Welcome](#welcome-to-3d-canvas)

```javascript on:enter
// Focus camera on this section
canvas3D.camera.focusOnSection(2, 80);
```

# Top Face {"x": "0", "y": "50", "z": "0", "rotate-x": "90"}

This is the **top face** - rotated 90° around the X axis!

Notice how the section appears to be tilted when the camera focuses on it.
The rotation is specified in the section metadata as `rotate-x: 90`.

- [Go to Front](#front-face)
- [Go to Side](#side-face)
- [See the Ring](#ring-demo)

```javascript on:enter
canvas3D.camera.focusOnSection(3, 80);
```

# Side Face {"x": "50", "y": "0", "z": "0", "rotate-y": "90"}

The **side face** - rotated 90° around the Y axis!

This section is positioned at x=50 and rotated to face sideways.
Perfect for creating 3D spatial layouts!

- [Go to Front](#front-face)
- [Go to Top](#top-face)
- [Check out the Ring](#ring-demo)

```javascript on:enter
canvas3D.camera.focusOnSection(4, 80);
```

# Ring Demo {"hidden": true}

Let's create a **ring of sections** in 3D space!

The following sections are arranged in a circle around you,
each rotated to face the center.

- [Section 0](#ring-0)
- [Section 1](#ring-1)
- [Section 2](#ring-2)
- [Section 3](#ring-3)
- [Section 4](#ring-4)
- [Back to Start](#welcome-to-3d-canvas)

```javascript on:enter
// Set camera to look at ring center
canvas3D.camera.setPosition(0, 0, 150);
canvas3D.camera.setRotation(0, 0, 0);
```

# Ring 0 {"x": "0", "y": "0", "z": "-80", "rotate-y": "0"}

**Section 0** - Front of the ring

You're standing in the center of a circle of sections.
Each section is 80 units away and rotated to face inward.

- [Next: Section 1](#ring-1)
- [Back to Ring Intro](#ring-demo)

```javascript on:enter
canvas3D.camera.focusOnSection(5, 120);
```

# Ring 1 {"x": "56", "y": "0", "z": "-56", "rotate-y": "45"}

**Section 1** - 45° clockwise

Positioned at (56, 0, -56) with Y rotation of 45°.

- [Next: Section 2](#ring-2)
- [Previous: Section 0](#ring-0)

```javascript on:enter
canvas3D.camera.focusOnSection(7, 120);
```

# Ring 2 {"x": "80", "y": "0", "z": "0", "rotate-y": "90"}

**Section 2** - 90° (right side)

Positioned at (80, 0, 0) with Y rotation of 90°.

- [Next: Section 3](#ring-3)
- [Previous: Section 1](#ring-1)

```javascript on:enter
canvas3D.camera.focusOnSection(8, 120);
```

# Ring 3 {"x": "56", "y": "0", "z": "56", "rotate-y": "135"}

**Section 3** - 135° clockwise

Positioned at (56, 0, 56) with Y rotation of 135°.

- [Next: Section 4](#ring-4)
- [Previous: Section 2](#ring-2)

```javascript on:enter
canvas3D.camera.focusOnSection(9, 120);
```

# Ring 4 {"x": "0", "y": "0", "z": "80", "rotate-y": "180"}

**Section 4** - 180° (back of ring)

Positioned at (0, 0, 80) with Y rotation of 180°.

- [Back to Ring Intro](#ring-demo)
- [Previous: Section 3](#ring-3)

```javascript on:enter
canvas3D.camera.focusOnSection(10, 120);
```

# Manual Camera Control {"hidden": true}

You can also control the camera manually!

Try these buttons:

```javascript on:render
// Simple camera control UI
term.clear();
term.write(0, 0, "=== Manual Camera Control ===");
term.write(0, 2, "Press arrow keys to move camera");
term.write(0, 3, "Press W/S to zoom in/out");
term.write(0, 4, "Press A/D to rotate left/right");
term.write(0, 6, "Camera Position:");
const pos = canvas3D.camera.getPosition();
term.write(0, 7, `  X: ${pos.x.toFixed(1)}`);
term.write(0, 8, `  Y: ${pos.y.toFixed(1)}`);
term.write(0, 9, `  Z: ${pos.z.toFixed(1)}`);

// Navigate link
term.write(0, 12, "[Back to Start] - Click welcome section");
```

```javascript on:update
// Manual camera control
const speed = 50; // units per second
const rotSpeed = 1; // radians per second

const pos = canvas3D.camera.getPosition();
const rot = canvas3D.camera.getRotation();

// Movement
if (key.down('ArrowUp')) {
  canvas3D.camera.setPosition(pos.x, pos.y - speed * getDelta(), pos.z);
}
if (key.down('ArrowDown')) {
  canvas3D.camera.setPosition(pos.x, pos.y + speed * getDelta(), pos.z);
}
if (key.down('ArrowLeft')) {
  canvas3D.camera.setPosition(pos.x - speed * getDelta(), pos.y, pos.z);
}
if (key.down('ArrowRight')) {
  canvas3D.camera.setPosition(pos.x + speed * getDelta(), pos.y, pos.z);
}

// Zoom
if (key.down('w') || key.down('W')) {
  canvas3D.camera.setPosition(pos.x, pos.y, pos.z - speed * getDelta());
}
if (key.down('s') || key.down('S')) {
  canvas3D.camera.setPosition(pos.x, pos.y, pos.z + speed * getDelta());
}

// Rotation
if (key.down('a') || key.down('A')) {
  canvas3D.camera.setRotation(rot.x, rot.y - rotSpeed * getDelta(), rot.z);
}
if (key.down('d') || key.down('D')) {
  canvas3D.camera.setRotation(rot.x, rot.y + rotSpeed * getDelta(), rot.z);
}
```
