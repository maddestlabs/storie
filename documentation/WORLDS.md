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

## Presets

For common Worlds document setups, use presets instead of repeating the same
camera and config boilerplate in every doc.

```js
// Narrative / exploration doc
worlds.presets.apply('story');
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });

// Authoring / editing doc
worlds.presets.apply('story-editor');
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
```

Available presets:

- `story` - oblique narrative view similar to `depths.md`, including cinematic camera shake
- `story-editor` - steadier authoring-oriented view with readable cards and no shake

Preset API:

```js
const names = worlds.presets.list();
const preset = worlds.presets.get('story-editor');
worlds.presets.apply('story');
```

Presets intentionally cover the repeated document-level setup work:

- `worlds.enable()`
- common `worlds.config.setDefaults(...)` values
- default camera position / rotation / FOV / easing
- optional camera shake

Per-section metadata still works the same way and still overrides document defaults.

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
- Content block alignment: `contentAlign: "start" | "center"`
- Wrapped text alignment: `textAlign: "left" | "center" | "right"`
- Flags: `hidden: "true"` (hard-hide), `hiddenUntilVisited: "true"` (reveal on first navigation), `removeAfterVisit: "true"` (hide permanently after leaving once), `navigable: "false"`, `interactive: "false"`

Notes:
- Rotations are specified in degrees in metadata but are stored internally as radians.
- `displayTitle` is the heading text with the JSON suffix stripped.
- The relaxed form is intended for flat key/value metadata. If you need nested data, strict JSON is the safer choice.
- `worlds.config.setDefaults({ sectionRender })` sets the document-wide default render mode, and per-section `render` metadata still overrides it.
- `worlds.config.setDefaults({ autoHideSectionsUntilVisited: true })` makes all sections start hidden until first navigation, unless overridden per-section with `hiddenUntilVisited`.
- `contentAlign` centers the rendered markdown block inside the card. `textAlign` aligns wrapped text lines inside headings, paragraphs, and lists.

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

## Authoring Pattern

For text-heavy Worlds docs, the best editing flow is usually hybrid:

- use the Worlds scene for navigation and spatial structure
- use retained GUI for the actual title / metadata / markdown editors
- push edits back into the runtime section store with `worlds.sections.update(...)`

See [docs/demos/depths-editor.md](docs/demos/depths-editor.md) for a concrete first-pass story editor built this way.

## Backgrounds

Worlds supports both procedural and custom shader backgrounds that move with the 3D camera.

### Procedural Backgrounds

Use built-in effects via `sectionBackground`:

```js
worlds.config.setDefaults({
  sectionBackground: 'paper+ruledlines', // Notebook-style background
  sectionForeground: 'accent1',          // Optional: override text color for all cards
  sectionLinkUnderline: true,            // Optional: underline card links
  sectionListMarker: '> ',               // Optional: custom list marker in card markdown
});
```

Available procedural effects:
- `paper`: Textured paper with optional noise
- `ruledlines`: Notebook ruled lines
- Combine with `+`: `paper+ruledlines`

Image texture backgrounds also support an optional baked overlay layer:

```js
worlds.config.setDefaults({
  sectionBackground: 'texture:assets/img/Paper006_1K.jpg;tilePx=400;overlay=assets/img/texas-map.svg;overlayBlend=hardlight;overlayOpacity=0.24'
});
```

Useful overlay params:
- `overlay=` or `overlayUrl=`: second image to composite over the base texture
- `overlayBlend=`: `normal`, `multiply`, `screen`, `overlay`, `softlight`, `hardlight`, `darken`, `lighten`, `difference`, `exclusion`, `colorburn`, `colordodge`
- `overlayOpacity=`: `0..1`
- `overlayFit=`: `cover`, `contain`, or `stretch`

### Decorative Borders

Worlds cards can also use an optional decorative border spec on top of the regular `sectionBorderEnabled` and `sectionBorderWidth` settings. The first supported format is `image9`, which uses 9-slice cuts from a source image or SVG so corners stay fixed while edges tile or stretch.

```js
worlds.config.setDefaults({
  sectionBorderEnabled: true,
  sectionBorder: {
    kind: 'image9',
    source: 'assets/img/borders/1210514.svg',
    cuts: { left: 96, right: 928, top: 96, bottom: 928 },
    edgeMode: 'tile',
    scale: 1,
    opacity: 1,
  }
});
```

Useful border params:
- `source`: image or SVG URL, resolved through the shared image/SVG asset loader
- `cuts`: source-space 9-slice guides; `left` and `top` are the inner corner edges, `right` and `bottom` are the far-side inner edges
- `edgeMode`: `tile` or `stretch`, globally or per edge
- `scale`: multiplies source corner and edge thickness in destination pixels
- `opacity`: border alpha multiplier
- `inset`: optional inward offset in pixels before the border is drawn

Borders can also be overridden per section in heading metadata:

```markdown
# saloon {border: {kind: "image9", source: "assets/img/borders/1210514.svg", cuts: {left: 34, right: 1103, top: 34, bottom: 1673}, edgeMode: "tile", scale: 0.22, opacity: 0.46}}
```

Use `border:` or `sectionBorder:` in heading metadata. Per-section border specs override the document-level `worlds.config.setDefaults({ sectionBorder: ... })` value for that card only.

### Section Art

Sections can also declare a separate art plate in heading metadata. This is rendered as its own quad, so it is not clipped by markdown flow layout and can sit under or over the text card.

```markdown
# saloon {art: "assets/img/saloon-plan.svg", artBlend: "hardlight", artOpacity: 0.28, artFit: "cover", artLayer: "under"}
```

Useful section art params:
- `art`: image URL
- `artBlend`: same blend modes as `overlayBlend`
- `artOpacity`: `0..1`
- `artFit`: `cover`, `contain`, or `stretch`
- `artLayer`: `under` or `over`
- `artScale`: scalar multiplier, default `1`
- `artOffsetX`, `artOffsetY`: local card-space offsets

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
- `worlds.unprojectPoint(sectionIndexOrTitle, { x, y }, options?)`
- `worlds.projectPoint(sectionIndexOrTitle, { x, y }, options?)`
- `worlds.projectRect(sectionIndexOrTitle, { x, y, width, height }, options?)`
- `worlds.projectQuad(sectionIndexOrTitle, { x, y, width, height }, options?)`

Experimental runtime section store helpers:
- `worlds.sections.list()`
- `worlds.sections.get(sectionIndexOrIdOrTitle)`
- `worlds.sections.insert(section, { parent?, index? })`
- `worlds.sections.update(sectionIndexOrIdOrTitle, patch)`
- `worlds.sections.remove(sectionIndexOrIdOrTitle)`
- `worlds.sections.move(sectionIndexOrIdOrTitle, { parent?, index? })`

Per-section style overrides (rebakes only the affected card's texture):
- `worlds.sections.style.set(sectionIndexOrIdOrTitle, { fg? })` — override text color for one card
- `worlds.sections.style.clear(sectionIndexOrIdOrTitle?)` — remove override for one card
- `worlds.sections.style.clearAll()` — remove all per-section style overrides

`fg` accepts the same values as `sectionForeground`: a theme key (`'accent1'`, `'fg'`, etc.), a hex string, or a packed RGBA number. Pass `null` to reset a single property to the global default.

Use `on:enter` to highlight only the focused card:

```js on:enter
if (state._prevSection !== undefined && state._prevSection !== null) {
  worlds.sections.style.clear(state._prevSection);
}
state._prevSection = worlds.currentSection;
worlds.sections.style.set('current', { fg: 'accent1' });
```

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

Projection helpers convert between screen coordinates and the same logical section
coordinate space used by `ui.pointer` and `ui.metrics.canvasWidth/Height`.
They are useful when a live-section demo wants to draw a transient overlay, such as
a drag preview, outside the section's clipped texture bounds.

- `unprojectPoint(...)` converts a screen point back into logical section coordinates.
- `projectPoint(...)` returns a single screen point.
- `projectRect(...)` returns a screen-space AABB.
- `projectQuad(...)` returns the projected four-corner quad for the local rect.

Rect arguments accept either `{ x, y, w, h }` or `{ x, y, width, height }`.

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
