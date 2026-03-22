# Worlds

Worlds renders Markdown sections as textured cards (quads) in a WebGPU 3D scene and composites the result with the terminal and UI layers.

This doc covers:
- Section metadata (position/rotation/size)
- Built-in link-centric navigation (mouse + keyboard)
- `on:enter` section hooks
- Section-scoped GUI mounts
- Default auto-layout (3-column grid)
- Layout callback for custom arrangements

## Requirements

- Worlds requires WebGPU to actually render, but `worlds.enable()` is safe to call unconditionally (it becomes a no-op when WebGPU isn’t available).
- Worlds is a composited layer; it renders into an offscreen texture and the compositor presents it.

## Quick Start

```js
// on:init
worlds.enable();
worlds.config.setDefaults({
  sectionTextureMode: 'webgpu-ui',
  sectionRender: 'content'
});

worlds.camera.setPosition(0, 0, 260);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.08, 0.12);

// Focus by index or by section title:
worlds.camera.focusOnSectionFit(0, 0.9);
// worlds.camera.focusOnSectionFit('Card One', 0.9);

// Optional: if you want to show a message when WebGPU isn’t available
// if (!worlds.available) console.warn('3D Canvas not available - WebGPU required');
```

## Section Metadata

Worlds reads a trailing directive object from the end of a heading title.

Example:

```md
# Card One {x: 90, y: 0, z: -30, rotate-y: -18, width: 80, height: 24}
```

Strict JSON also remains valid:

```md
# Card One {"x": "90", "y": "0", "z": "-30", "rotate-y": "-18"}
```

Supported keys:
- Position: `x`, `y`, `z` (or `depth`)
- Rotation (degrees): `rotate-x`, `rotate-y`, `rotate-z`
- Uniform scale: `scale`
- Alpha: `opacity` (`0..1`)
- Dimensions: `width`, `height`
- Card composition: `render: "all" | "heading" | "content" | "none"`
- Flags: `hidden: "true"` (visibility), `navigable: "false"`, `interactive: "false"`

Notes:
- Rotations are specified in degrees in metadata but are stored internally as radians.
- `displayTitle` is the heading text with the JSON suffix stripped.
- The relaxed form is intended for flat key/value metadata. If you need nested data, strict JSON is the safer choice.
- `worlds.config.setDefaults({ sectionRender })` sets the document-wide default render mode, and per-section `render` metadata still overrides it.

## Card Content

Worlds cards use the shared lightweight markdown renderer that also powers GUI markdown views.

Supported content includes:
- Headings, paragraphs, and links
- Ordered and unordered lists
- Standalone markdown images referencing embedded blob names, for example `![Alt](icon)`
- Embedded `gui` fences for block widgets such as buttons, sliders, checkboxes, and labels
- Callouts written as blockquotes with a marker, for example `> [!TIP]`
- ASCII fenced blocks (` ```ascii `)
- Blockquotes using `>`
- Horizontal rules using `---`, `***`, or `___`

Non-ASCII code fences such as `js on:init` and `wgsl` remain non-visual by design; they are treated as behavior/source blocks, not card body content.

Image notes:
- The current image phase is blob-backed: the image source should match the `name:` of an embedded `blob` block whose `mime:` starts with `image/`.
- Images are treated as standalone block elements rather than inline text runs.
- Optional image metadata can be supplied in the title field, for example `![Alt](icon "width:50% align:center")`.
- Worlds cards rerasterize automatically when an image finishes decoding.

Callout notes:
- GitHub-style markers such as `[!NOTE]`, `[!TIP]`, `[!WARNING]`, `[!IMPORTANT]`, `[!INFO]`, and `[!CAUTION]` are recognized when they appear at the start of a blockquote.
- Callouts remain document content, not executable UI widgets.

Embedded widget notes:
- Use a visible `gui` fence to place a retained widget in the markdown flow.
- Use `:gui{...}` inside text when you want a compact inline control in a paragraph, heading, or list item.
- Supported `type:` values are `button`, `slider`, `checkbox`, and `label`.
- Common fields: `id`, `label`, `text`, `width`, `align`, and `scale`.
- Slider fields: `min`, `max`, `value`, `step`.
- Checkbox field: `checked`.
- `scale` defaults to `gui`, which keeps the normal retained-GUI text/control sizing.
- Use `scale: worlds` when you want the live widget internals to track the projected Worlds card scale more closely.
- Inline directives accept comma-delimited `key:value` or `key=value` pairs. Quote values when they contain spaces.

Example:

````md
```gui
type: slider
id: mix
label: Mix
min: 0
max: 1
value: 0.5
step: 0.05
width: 70%
align: center
scale: worlds
```
````

Runtime access:
- Embedded widgets mount as real retained GUI widgets only for the active Worlds section.
- Read events with `worlds.widgets.popEvent()`.
- Read current values with `worlds.widgets.getValue(id, section?)`.
- Update label/slider/checkbox state with `worlds.widgets.setValue(id, value, section?)`.

Inline example:

```md
Tap :gui{type:button, id: quick-fire, label:"Fire", scale: worlds} to trigger the action without leaving the paragraph.
```

## Navigation (Link-centric)

Worlds is optimized for a “document navigation” feel:
- Hover highlights links (not whole cards).
- Clicking an internal link (e.g. `#card-one`) focuses the linked section.
- Clicking a non-link area of a card focuses that section by default.
- Keyboard navigation:
  - `Tab` / `Shift+Tab` cycles through visible links.
  - Arrow keys also cycle link focus.
  - `Enter` activates the focused link.

If you want link-only interaction, disable non-link click focus:

```js
worlds.config.setDefaults({
  sectionClickFocusEnabled: false,
});
```

Internal links:
- `#anchor` links are treated as “navigate to section”.
- Matching uses a slugified form of the section heading.

External links:
- `https://...` / `http://...` open in a new tab.

Activated link queue:
- Every activated 3D link is also exposed to scripts through `worlds.links.popActivated()`.
- The returned object is `{ url, sectionIndex, linkIndex }`.
- This makes non-navigation links possible, for example `[Toggle audio](action:toggle-audio)`.
- Built-in behavior still applies for normal links: `#anchor` keeps navigating to sections, `http(s)` still opens externally.
- Custom schemes such as `action:` are not handled by the engine, so documents can consume them in `on:update` or `on:input`.

## Section Entry Hooks (`js on:enter`)

You can define section-scoped enter handlers using code blocks inside a section:

```md
# Card One

```js on:enter
// Runs when Card One becomes the current section via Worlds navigation
worlds.camera.focusOnSectionFit('Card One', 0.9);
```
```

How section entry is determined:
- Worlds tracks `worlds.currentSection`.
- Enter handlers run when the current section changes.
- Current section changes when:
  - You activate an internal `#anchor` link
  - You click a card (non-link area)
  - You call `worlds.camera.focusOnSection(...)` or `focusOnSectionFit(...)`

## Section-Scoped Lifecycle Blocks (`section:` metadata)

Lifecycle hooks like `on:update`, `on:render`, and `on:input` are global by default (they run every frame / input event).
If you want a lifecycle block to only run while a particular section is focused, add `section:` metadata:

```md
# Card Three

```js on:render section:3
// Only runs while Card Three is the current Worlds section
term.write(0, 0, 'Card Three');
```
```

To target “this section” without hard-coding an index, use `section:current`:

```md
# Card Three

```js on:update section:current
// Only runs while this section is current
rainLevel = (rainLevel ?? 0) + 0.02;
```

You can also target a section by its title (matched via a slugified form of the heading text):

````md
# Awake

```js on:render section:Awake
term.write(0, 0, 'Awake');
```
````

Notes:
- Fence metadata is whitespace-delimited, so for multi-word headings prefer the slug form (e.g. `section:city-entrance`).

## Section-Scoped GUI

Retained GUI widgets can be bound to Worlds sections so they automatically appear only while those sections are active.

Use `gui.section(...)` to create a section-scoped widget context:

````md
# Settings

```js on:enter
state.settingsGui = state.settingsGui || gui.section('current');

if (!state.audioLabel) {
  state.audioLabel = state.settingsGui.createLabel({
    bounds: { x: 24, y: 24, width: 240, height: 32 },
    text: 'Audio: On'
  });
}
```
````

Behavior:
- `gui.section('current')` resolves the currently focused Worlds section and allocates a dedicated GUI group for it.
- Widgets created through that section context inherit the section's group automatically.
- The group is shown only while the bound section is active.
- Focus is cleared automatically if a focused widget is hidden because its section is no longer active.

If you already have a GUI group, you can bind it directly:

```js
gui.bindGroupToSection(existingGroup, 'settings');
gui.bindGroupToSections(sharedGroup, ['title', 'settings']);
```

## Backgrounds

Worlds supports both procedural and custom shader backgrounds that move with the 3D camera.

### Procedural Backgrounds

Use built-in effects via `sectionBackground`:

```js
worlds.config.setDefaults({
  sectionBackground: 'paper+ruledlines', // Notebook-style background
  sectionLinkUnderline: true,            // Optional: underline card links
  sectionListMarker: '> ',               // Optional: custom list marker in card markdown
});
```

Available procedural effects:
- `paper`: Textured paper with optional noise
- `ruledlines`: Notebook ruled lines
- Combine with `+`: `paper+ruledlines`

### Shader Backgrounds

Use custom WGSL fragment shaders as backgrounds:

```js
worlds.config.setDefaults({
  sectionBackground: 'shader:myShader;speed=1.0;intensity=0.8'
});
```

Or use built-in shaders from `docs/shaders/`:

```js
worlds.config.setDefaults({
  sectionBackground: 'shader:lightvignette;vignetteStart=0.5;vignetteLvl=20.0'
});
```

For paper texture backgrounds, use the dedicated paper-background shader:

```js
worlds.config.setDefaults({
  sectionBackground: 'shader:paper-background;paperNoise=1.0;noiseIntensity=0.3'
});
```

Define the shader in your markdown:

```wgsl
```wgsl fragment:myShader
struct Uniforms {
  time: f32,
  resolution: vec2f,
  speed: f32,
  intensity: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  // Your shader code here
  return vec4f(1.0, 0.0, 0.0, 1.0);
}
```
```

Shader backgrounds maintain world-space coordinates, so they move naturally with camera movement.

## API Reference

### `worlds`

- `worlds.available: boolean`
- `worlds.enabled: boolean`
- `worlds.enable(): boolean`
- `worlds.disable(): void`
- `worlds.currentSection: number | null`

### Controls

- `worlds.controls.setEnabled(enabled: boolean)`
  - Enables/disables built-in free-move controls (WASD + right-drag mouselook).
  - For document-style navigation you’ll typically keep this disabled.

### Camera

- `worlds.camera.setPosition(x, y, z)`
- `worlds.camera.setRotation(x, y, z)`
- `worlds.camera.moveTo(x, y, z)`
- `worlds.camera.setFOV(fovRadians)`
- `worlds.camera.setEaseSpeed(positionEase, rotationEase)`
- `worlds.camera.getPosition()`
- `worlds.camera.getRotation()`

Focus helpers:
- `worlds.camera.focusOnSection(sectionIndexOrTitle, distance?, options?)`
- `worlds.camera.focusOnSectionFit(sectionIndexOrTitle, fill?, options?)`
- `worlds.config.setDefaults({ sectionClickFocusEnabled: false })`

`sectionIndexOrTitle` can be:
- a numeric section index (`0..N-1`), or
- a string section heading name (e.g. `"Stronghold"`).

### Section Layout Access

- `worlds.getSectionLayout(sectionIndex)`
- `worlds.setSectionTransform(sectionIndex, { position?, rotation?, scale? })`
- `worlds.setSectionVisible(sectionIndex, visible)`
- `worlds.getSectionCount()`

Experimental runtime section store helpers:
- `worlds.sections.list()`
- `worlds.sections.get(sectionIndexOrIdOrTitle)`
- `worlds.sections.insert(section, { parent?, index? })`
- `worlds.sections.update(sectionIndexOrIdOrTitle, patch)`
- `worlds.sections.remove(sectionIndexOrIdOrTitle)`
- `worlds.sections.move(sectionIndexOrIdOrTitle, { parent?, index? })`

Same-card render-content helpers:
- `worlds.content.get(sectionIndexOrIdOrTitle?)`
- `worlds.content.set(sectionIndexOrIdOrTitle, { title?, content? })`
- `worlds.content.clear(sectionIndexOrIdOrTitle?, target?)`
- `worlds.content.clearAll()`
- `worlds.content.stateAt(entries, timeSec, { mode?, separator?, maxEntries? })`
- `worlds.content.applyTimed(sectionIndexOrIdOrTitle, entries, timeSec, { target?, mode?, separator?, maxEntries?, clearWhenEmpty? })`

String selectors now resolve by stable section id first, then by heading title slug.
`insert()` and `move()` use sibling indices within the selected parent; omit `parent` to operate at the root level.

`worlds.content.*` updates the rendered markdown for the existing card in-place. It does not create a second overlay card and it does not mutate the runtime section store unless you explicitly use `worlds.sections.update(...)`.

`getSectionLayout()` also exposes `opacity`, `interactive`, and `renderMode`.

Rotation passed to `setSectionTransform` is in degrees.

## Texture Generation

`worlds.config.setDefaults({ sectionTextureMode })` controls how section textures are produced:
- `"canvas2d"`: OffscreenCanvas rasterization (simple fallback)
- `"webgpu-ui"`: WebGPU UI glyph pipeline rendered into per-section textures

## Auto-layout (Default 3-column grid)

For sections without explicit `x/y/z/depth` metadata, Worlds can auto-place them into a grid:
- `autoLayoutEnabled` (default `true`)
- `autoLayoutColumns` (default `3`)
- `autoLayoutSpacing` (default `200`)

Example:

```js
worlds.config.setDefaults({
  autoLayoutEnabled: true,
  autoLayoutColumns: 3,
  autoLayoutSpacing: 200,
});
```

If you set explicit `{"x":...,"y":...}` metadata on a section, it will use that position instead of the auto-layout.

## Layout Callback (Custom Layouts)

For more flexibility than the default grid, you can provide a layout callback.

```js
worlds.layout.setCallback(({ sectionIndex, title, layout }) => {
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

- `docs/demos/worlds-markdown.md`: GPU markdown textures + internal links
- `docs/demos/worlds-layout-callback.md`: layout callback on a single Z plane
- `docs/demos/worlds-demo.md`: basic 3D canvas usage
