---
title: "3D Cards: GPU Markdown Textures"
theme: "nord"
---

# 3D Cards (GPU Markdown) {"x": "0", "y": "0", "z": "0"}

This demo renders section textures using the **WebGPU UI glyph pipeline** (no Canvas2D).

- Click a card in 3D, or use links:
  - [Go to Card One](#card-one)
  - [Go to Card Two](#card-two)

```js on:init
canvas3D.enable();

// Use WebGPU UI renderer to generate the section textures.
canvas3D.config.setDefaults({ sectionTextureMode: 'webgpu-ui' });

// Optional: keep built-in nav controls enabled for testing.
canvas3D.controls.setEnabled(true);

canvas3D.camera.setPosition(0, 0, 260);
canvas3D.camera.setRotation(0, 0, 0);
canvas3D.camera.setEaseSpeed(0.08, 0.12);

// Initial framing. Internal link navigation auto-focuses cards.
canvas3D.camera.focusOnSectionFit(1, 0.9);

// Optional: show a message when WebGPU isn't available
// if (!canvas3D.available) console.warn('3D Canvas not available - WebGPU required');
```

# Card One {"x": "90", "y": "0", "z": "-30", "rotate-y": "-18"}

A small card with a few markdown features:

- Inline code: `vec4<f32>`
- A link: [Storie](https://github.com/maddestlabs/storie)
- Wrapped text: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.


# Card Two {"x": "-90", "y": "15", "z": "-10", "rotate-y": "22"}

A longer block to exercise layout:

```wgsl
@fragment
fn main() -> @location(0) vec4<f32> {
  return vec4<f32>(0.2, 0.9, 0.6, 1.0);
}
```

Back to [Intro](#3d-cards-gpu-markdown)

