---
title: "3D Cards: Layout Callback (2D Plane)"
theme: "neotopia"
---

# 3D Cards: Layout Callback (2D Plane)

This demo keeps all cards on the same Z plane (so it behaves like 2D), while still using the 3D card system.

- Use Tab / Shift-Tab (or arrow keys) to move link focus
- Press Enter to activate a focused link

- [Jump to Start](#start)
- [Jump to Side Track](#side-track)
- [Jump to Deeper](#deeper)

```js on:init
worlds.enable();
worlds.config.setDefaults({ sectionTextureMode: 'webgpu-ui' });

// Keep cards effectively 2D: constant Z and no rotations.
const Z = -80;
const STEP_Y = 220;
const STEP_X = 260;

// Optional: disable built-in free-move controls (WASD).
worlds.controls.setEnabled(false);

// Layout callback: mostly a vertical descent, with a couple side tracks.
worlds.layout.setCallback(({ sectionIndex, layout }) => {
  const isSideTrack = sectionIndex === 2 || sectionIndex === 4;
  const x = isSideTrack ? STEP_X : 0;
  const y = -sectionIndex * STEP_Y;

  // Keep everything on the same plane.
  return {
    position: { x, y, z: Z },
    rotation: { x: 0, y: 0, z: 0 }
  };
});

// Initial framing
worlds.camera.setPosition(0, 0, 260);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSectionFit('Start', 0.9);

// Optional: show a message when WebGPU isn't available
// if (!worlds.available) console.warn('3D Canvas not available - WebGPU required');
```

# Start

This is the start of the descent.

- [Go deeper](#deeper)
- [Take the side track](#side-track)

# Deeper

You’re moving downward card-by-card.

- [Back to Start](#start)
- [Go to Side Track](#side-track)

# Side Track

A quick detour to the right, but still on the same Z plane.

- [Back to Start](#start)
- [Go deeper](#deeper)
