# Worlds Config Reference

All settings are applied via `worlds.config.setDefaults({ ... })` inside an `on:init` code block.

```javascript on:init
worlds.enable();
worlds.config.setDefaults({
  defaultSectionWidth: 60,
  sectionBackground: 'bg',
  autoHideSectionsUntilVisited: true,
});
```

---

## Section Dimensions

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `defaultSectionWidth` | `number` | `60` | Default card width (columns when `sectionSizeUnits: 'text'`, pixels when `'px'`). |
| `defaultSectionHeight` | `number` | `20` | Default card height. |
| `defaultDepth` | `number` | `-100` | Default Z position for sections (negative = in front of camera). |
| `sectionSizeUnits` | `'text' \| 'px'` | `'text'` | Units for width/height. `'text'` = logical columns/rows; `'px'` = pixels (padding added). |

---

## Section Appearance

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sectionBackground` | `string \| Color` | `'surface'` | Card background. See [Background values](#background-values). |
| `sectionBackgroundPaperNoiseStrength` | `number` | — | Paper grain strength for `paper`-including backgrounds. Range `0..1`. |
| `sectionForeground` | `string \| Color` | — | Override text/foreground color. Accepts theme keys, hex strings, or packed color. |
| `sectionBlendMode` | `'normal' \| 'multiply'` | `'normal'` | How card content composites over the background. `'multiply'` lets textures show through light areas — ideal for paper backgrounds. |
| `sectionBorderEnabled` | `boolean` | `true` | Whether to draw a border around each card. |
| `sectionBorderWidth` | `number` | `2` | Border width in pixels. |
| `sectionContentAlign` | `'start' \| 'center'` | `'start'` | Alignment of the rendered markdown block inside the card. |
| `sectionTextAlign` | `'left' \| 'center' \| 'right'` | `'left'` | Alignment of wrapped text lines. |
| `sectionLinkUnderline` | `boolean` | `false` | Whether links in cards draw an underline. |
| `sectionListMarker` | `string \| null` | — | Custom list marker string (e.g. `'> '`, `'• '`, `''` to hide). |
| `sectionListMarkerGapPx` | `number` | — | Extra gap in pixels between a list marker and item text. |
| `sectionListHangIndentPx` | `number` | — | Hanging indent in pixels for wrapped list item lines. |

### Background values

| Value | Description |
|-------|-------------|
| `'surface'` | Theme surface color (typically `bgAlt` / elevated panel). |
| `'bg'` | Theme background color. |
| `'bgAlt'` | Theme alternate background. |
| `'fg'` / `'fgAlt'` | Theme foreground colors. |
| `'accent1'` / `'accent2'` / `'accent3'` | Theme accent colors. |
| `'ruledlines'` | Seamless procedural ruled-paper background (shader). |
| `'paper'` | Seamless procedural paper grain background (shader). |
| `'ruledlines+paper'` | Both `ruledlines` and `paper` combined. |
| `'ruledlines-baked'` | Ruled paper drawn into the card texture (non-seamless across cards). |
| `'texture:path;tilePx=N'` | Image texture. Supports extra parameters: `tilePx`, `blendMode`, `paperPlaneZ`. |
| `'#RRGGBB'` / `'#RRGGBBAA'` | Hex color. |
| `0xRRGGBBAA` | Packed RGBA number. |

---

## Section Rendering

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sectionRender` | `'all' \| 'heading' \| 'content' \| 'none'` | `'all'` | Which parts of the section to render on each card. Per-section `render:` metadata overrides this. |
| `sectionOverflow` | `'clip' \| 'expand' \| 'expand-y' \| 'fit' \| 'fit-y'` | `'clip'` | How card textures handle content that exceeds the declared size. |
| `sectionTextureMode` | `'canvas2d' \| 'webgpu-ui'` | `'canvas2d'` | How card textures are generated. `'webgpu-ui'` uses the glyph pipeline. |
| `liveTextureScale` | `number` | `2` | Minimum texture scale for live sections (`worlds.setSectionLive()`). Range `1..4`. Set to `1` to save fill-rate on full-viewport sections. |
| `sectionTextureCacheRadius` | `number` | — | Evict GPU textures for sections more than this many navigation steps away from the current section. Recommended for large decks on mobile/integrated GPU. |
| `sectionGuiMode` | `'overlay' \| 'baked'` | `'overlay'` | How section-bound retained GUI is rendered. `'overlay'` is fast and axis-aligned; `'baked'` draws GUI into the card texture so it rotates with the card. |

---

## Section Visibility

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoHideSectionsUntilVisited` | `boolean` | `false` | When `true`, all sections start hidden and are revealed the first time they are navigated to. Can be overridden per-section with the `hidden: true` or `hiddenUntilVisited: true` heading directive. Alias: `hiddenUntilVisited` (shorthand matching the per-section directive name). |

**Per-section heading directives:**

| Directive | Description |
|-----------|-------------|
| `hidden: true` | Section starts hidden and reveals on first navigation (i.e. excluded from camera focus listings but reachable via links). |
| `hiddenUntilVisited: true` | Explicit alias for the same behavior as `hidden: true`. |
| `removeAfterVisit: true` | Section is permanently hidden after being visited once. |
| `navigable: false` | Excluded from `next`/`prev` navigation and overview grids. |
| `interactive: false` | Section is not pickable (no link hover / click). |

---

## Interaction

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `sectionClickFocusEnabled` | `boolean` | `true` | Whether clicking/tapping a non-link area of a card focuses that section. |
| `sectionArrowNavigation` | `boolean` | `false` | Arrow keys navigate between sections like a slide deck (Right/Down = next, Left/Up = prev). Disables in-card link cycling with arrow keys. |
| `multiTouchRotateEnabled` | `boolean` | `false` | Enable 3-finger drag to pitch and 4-finger drag to yaw the camera. |
| `doubleTapResetEnabled` | `boolean` | `false` | Double-tap on the 3D background to reset camera to the current section's view. |
| `doubleTapResetRotation` | `{x,y,z}` | — | Camera rotation (radians) to restore on double-tap reset. If omitted, current rotation is preserved. |

---

## Navigation Constraints

Limit user-driven pan/zoom. Programmatic `worlds.camera.*` calls are unaffected.

```javascript
worlds.config.setDefaults({
  navigationConstraints: {
    minX: -100, maxX: 100,  // horizontal pan bounds
    minY: -50,  maxY: 50,   // vertical pan bounds
    minZ: 50,   maxZ: 500,  // zoom bounds
    dragAxis: 'y',           // 'x' | 'y' | null (free)
  }
});
```

| Key | Type | Description |
|-----|------|-------------|
| `minX` / `maxX` | `number` | Camera X position bounds. |
| `minY` / `maxY` | `number` | Camera Y position bounds. |
| `minZ` / `maxZ` | `number` | Camera Z bounds (zoom). |
| `dragAxis` | `'x' \| 'y' \| null` | Restrict drag gestures to a single axis. `null` = free (default). |

---

## Camera

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `cameraFov` | `number` | `Math.PI / 4` | Vertical field of view in radians (45°). |
| `cameraNear` | `number` | `0.1` | Near clip plane. |
| `cameraFar` | `number` | `1000` | Far clip plane. |
| `positionEaseSpeed` | `number` | `0.1` | Camera position easing speed (0..1, higher = snappier). |
| `rotationEaseSpeed` | `number` | `0.15` | Camera rotation easing speed. |
| `keepRotation` | `boolean` | `false` | Default for focus helpers: keep camera rotation when focusing a section. Can be overridden per-call. |
| `straightenOnFocus` | `boolean` | `false` | When focusing, apply camera roll so the focused section appears upright. |
| `screenSpaceRecenter` | `boolean` | `false` | When `keepRotation` is active, adjust camera position to center the focused section in screen space. Helps with tilted cameras. |
| `screenSpaceRecenterIters` | `number` | `5` | Solver iterations for screen-space recentering (3–8 typical). |

---

## Auto-Layout

Applies to sections that do not specify `x`/`y`/`z` in their heading directive.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `autoLayoutEnabled` | `boolean` | `true` | Enable automatic grid layout. |
| `autoLayoutColumns` | `number` | `3` | Number of columns in the auto-layout grid. |
| `autoLayoutSpacing` | `number` | `200` | Spacing between auto-laid-out sections in world units. |
