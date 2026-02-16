# Canvas3D

Canvas3D renders Markdown sections as textured cards (quads) in a WebGPU 3D scene and composites the result with the terminal and UI layers.

This doc covers:
- Section metadata (position/rotation/size)
- Built-in link-centric navigation (mouse + keyboard)
- `on:enter` section hooks
- Default auto-layout (3-column grid)
- Layout callback for custom arrangements

## Requirements

- Canvas3D requires WebGPU to actually render, but `canvas3D.enable()` is safe to call unconditionally (it becomes a no-op when WebGPU isn’t available).
- Canvas3D is a composited layer; it renders into an offscreen texture and the compositor presents it.

## Quick Start

```js
// on:init
canvas3D.enable();
canvas3D.config.setDefaults({ sectionTextureMode: 'webgpu-ui' });

canvas3D.camera.setPosition(0, 0, 260);
canvas3D.camera.setRotation(0, 0, 0);
canvas3D.camera.setEaseSpeed(0.08, 0.12);

// Focus by index or by section title:
canvas3D.camera.focusOnSectionFit(0, 0.9);
// canvas3D.camera.focusOnSectionFit('Card One', 0.9);

// Optional: if you want to show a message when WebGPU isn’t available
// if (!canvas3D.available) console.warn('3D Canvas not available - WebGPU required');
```

## Section Metadata

Canvas3D reads JSON metadata from the end of a heading title.

Example:

```md
# Card One {"x": "90", "y": "0", "z": "-30", "rotate-y": "-18", "width": "80", "height": "24"}
```

Supported keys:
- Position: `x`, `y`, `z` (or `depth`)
- Rotation (degrees): `rotate-x`, `rotate-y`, `rotate-z`
- Uniform scale: `scale`
- Dimensions: `width`, `height`
- Flags: `hidden: "true"` (visibility), `navigable: "false"`

Notes:
- Rotations are specified in degrees in metadata but are stored internally as radians.
- `displayTitle` is the heading text with the JSON suffix stripped.

## Navigation (Link-centric)

Canvas3D is optimized for a “document navigation” feel:
- Hover highlights links (not whole cards).
- Clicking an internal link (e.g. `#card-one`) focuses the linked section.
- Keyboard navigation:
  - `Tab` / `Shift+Tab` cycles through visible links.
  - Arrow keys also cycle link focus.
  - `Enter` activates the focused link.

Internal links:
- `#anchor` links are treated as “navigate to section”.
- Matching uses a slugified form of the section heading.

External links:
- `https://...` / `http://...` open in a new tab.

## Section Entry Hooks (`js on:enter`)

You can define section-scoped enter handlers using code blocks inside a section:

```md
# Card One

```js on:enter
// Runs when Card One becomes the current section via Canvas3D navigation
canvas3D.camera.focusOnSectionFit('Card One', 0.9);
```
```

How section entry is determined:
- Canvas3D tracks `canvas3D.currentSection`.
- Enter handlers run when the current section changes.
- Current section changes when:
  - You activate an internal `#anchor` link
  - You click a card (non-link area)
  - You call `canvas3D.camera.focusOnSection(...)` or `focusOnSectionFit(...)`

## API Reference

### `canvas3D`

- `canvas3D.available: boolean`
- `canvas3D.enabled: boolean`
- `canvas3D.enable(): boolean`
- `canvas3D.disable(): void`
- `canvas3D.currentSection: number | null`

### Controls

- `canvas3D.controls.setEnabled(enabled: boolean)`
  - Enables/disables built-in free-move controls (WASD + right-drag mouselook).
  - For document-style navigation you’ll typically keep this disabled.

### Camera

- `canvas3D.camera.setPosition(x, y, z)`
- `canvas3D.camera.setRotation(x, y, z)`
- `canvas3D.camera.moveTo(x, y, z)`
- `canvas3D.camera.setFOV(fovRadians)`
- `canvas3D.camera.setEaseSpeed(positionEase, rotationEase)`
- `canvas3D.camera.getPosition()`
- `canvas3D.camera.getRotation()`

Focus helpers:
- `canvas3D.camera.focusOnSection(sectionIndexOrTitle, distance?)`
- `canvas3D.camera.focusOnSectionFit(sectionIndexOrTitle, fill?)`

`sectionIndexOrTitle` can be:
- a numeric section index (`0..N-1`), or
- a string section heading name (e.g. `"Stronghold"`).

### Section Layout Access

- `canvas3D.getSectionLayout(sectionIndex)`
- `canvas3D.setSectionTransform(sectionIndex, { position?, rotation?, scale? })`
- `canvas3D.setSectionVisible(sectionIndex, visible)`
- `canvas3D.getSectionCount()`

Rotation passed to `setSectionTransform` is in degrees.

## Texture Generation

`canvas3D.config.setDefaults({ sectionTextureMode })` controls how section textures are produced:
- `"canvas2d"`: OffscreenCanvas rasterization (simple fallback)
- `"webgpu-ui"`: WebGPU UI glyph pipeline rendered into per-section textures

## Auto-layout (Default 3-column grid)

For sections without explicit `x/y/z/depth` metadata, Canvas3D can auto-place them into a grid:
- `autoLayoutEnabled` (default `true`)
- `autoLayoutColumns` (default `3`)
- `autoLayoutSpacing` (default `200`)

Example:

```js
canvas3D.config.setDefaults({
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,
});
```

If you set explicit `{"x":...,"y":...}` metadata on a section, it will use that position instead of the auto-layout.

## Layout Callback (Custom Layouts)

For more flexibility than the default grid, you can provide a layout callback.

```js
canvas3D.layout.setCallback(({ sectionIndex, title, layout }) => {
  // Return partial overrides
  return {
    position: { x: 0, y: -sectionIndex * 220, z: -80 },
    rotation: { x: 0, y: 0, z: 0 }, // degrees
  };
});
```

Use cases:
- Keep everything on a single Z plane (2D-on-a-plane)
- Random scatter with minimum distances
- “Downward descent” narrative layouts with occasional side tracks

## Demos

- `docs/demos/canvas3d-markdown.md`: GPU markdown textures + internal links
- `docs/demos/canvas3d-layout-callback.md`: layout callback on a single Z plane
- `docs/demos/canvas3d-demo.md`: basic 3D canvas usage
