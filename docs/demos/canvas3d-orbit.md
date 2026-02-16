---
title: "3D Canvas - Orbit Animation"
theme: "neotopia"
---

# 3D Orbit Animation

This demo shows sections orbiting in 3D space!

Three colored sections move in a circular path around the center.

```js
// Animation state (global - persists across handlers)
let time = 0;
let orbitSpeed = 1.0;
```

```js on:init
// Enable 3D canvas (safe no-op if WebGPU isn't available)
canvas3D.enable();
canvas3D.camera.setPosition(0, 0, 200);
canvas3D.camera.setEaseSpeed(0.05, 0.08);
console.log('✓ 3D Canvas enable requested');
console.log('Total sections:', canvas3D.getSectionCount());

// Debug: Print all section info
for (let i = 0; i < canvas3D.getSectionCount(); i++) {
  const layout = canvas3D.getSectionLayout(i);
  console.log(`Section ${i}:`, layout ? layout.sectionTitle : 'null');
}
```

```js on:update
time += getDelta();

// Avoid per-frame warnings if layouts aren't ready/available.
if (canvas3D.getSectionCount() < 4) return;

// Orbit radius
const radius = 60;

// Section 1 - Red orbit path
const angle1 = time * orbitSpeed;
canvas3D.setSectionTransform(1, {
  position: {
    x: Math.cos(angle1) * radius,
    y: Math.sin(angle1) * radius,
    z: 0
  }
});

// Section 2 - Green orbit path (offset +120°)
const angle2 = time * orbitSpeed + (Math.PI * 2 / 3);
canvas3D.setSectionTransform(2, {
  position: {
    x: Math.cos(angle2) * radius,
    y: Math.sin(angle2) * radius,
    z: 0
  }
});

// Section 3 - Blue orbit path (offset +240°)
const angle3 = time * orbitSpeed + (Math.PI * 4 / 3);
canvas3D.setSectionTransform(3, {
  position: {
    x: Math.cos(angle3) * radius,
    y: Math.sin(angle3) * radius,
    z: 0
  }
});
```

```js on:render
term.clear();
term.write(0, 0, "=== 3D Orbit Animation ===");
term.write(0, 2, `Time: ${time.toFixed(2)}s`);
term.write(0, 3, `Speed: ${orbitSpeed.toFixed(2)}`);
term.write(0, 5, "Three sections orbit in a circle");
term.write(0, 6, "Press +/- to adjust speed");
```

```js on:input
if (event.type === 'keydown') {
  if (event.key === '+' || event.key === '=') {
    orbitSpeed += 0.1;
  }
  if (event.key === '-' || event.key === '_') {
    orbitSpeed = Math.max(0.1, orbitSpeed - 0.1);
  }
}
```

# Center {"x": "0", "y": "0", "z": "0"}
⭐ **Center**

# Red Orbiter {"x": "60", "y": "0", "z": "0"}
🔴 **Red**

# Green Orbiter {"x": "-30", "y": "50", "z": "0"}
🟢 **Green**

# Blue Orbiter {"x": "-30", "y": "-50", "z": "0"}
🔵 **Blue**
