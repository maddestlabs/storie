---
name: "Responsive GUI Demo (Storie)"
theme: "nord"
---

A demo showcasing Storie's retained-mode GUI panels adapting to the viewport. **Resize the window** to watch the layout reflow: columns change at 900 px (3→2) and 500 px (2→1), and the panel continuously stretches to fill the window.

**Keyboard Controls:**
- **TAB / SHIFT+TAB**: Navigate focus through widgets
- **ENTER / SPACE**: Activate focused button or checkbox
- **LEFT / RIGHT**: Adjust a focused slider

## Demo Code

```js
// Persistent state — stored on scope so all lifecycle blocks share the same refs.
// (Preamble closure vars are NOT shared across on:init / on:update / on:render.)
scope.mouseDownLeft = false;
scope.layouts = null;
scope.widgets = null;
scope.clickCount = 0;
scope.statusText = 'Ready — resize the window to see the layout adapt.';
scope.dbg = { lastSig: '', changes: 0, lastChangeFrame: 0 };

// ── Helper: determine grid columns from viewport pixel width ────────────────
// Thresholds are in CSS pixels and cover typical desktop resize ranges:
//   < 500 px → 1 column   500–899 px → 2 columns   ≥ 900 px → 3 columns
function getColumns(vw) {
  if (vw < 500) return 1;
  if (vw < 900) return 2;
  return 3;
}

// ── Helper: inset size from viewport pixel width ──────────────────────────────
function getInset(vw, tokens) {
  if (vw < 500) return tokens.spacing.sm;
  if (vw < 900) return tokens.spacing.md;
  return tokens.spacing.lg;
}

// ── Helper: write status text and update the label ───────────────────────────
function setStatus(msg) {
  scope.statusText = String(msg == null ? '' : msg);
  if (scope.widgets && scope.widgets.statusLabel) {
    scope.widgets.statusLabel.setText(scope.statusText);
  }
}

// ── Build all widgets once ───────────────────────────────────────────────────
// Called from on:init after gui.init().  Uses function declaration so that the
// sandbox autoBindVariables can safely persist the surrounding vars.
function buildLayout() {
  var tokens = gui.getTokens();

  // Root responsive panel: will be re-fitted to the viewport every frame.
  // mode:'stack' stacks children top→bottom; alignX:'stretch' fills width.
  var root = gui.createResponsivePanel({
    bounds: { x: 0, y: 0, width: 700, height: 1 },
    mode: 'stack',
    padding: tokens.spacing.lg,
    rowGap: tokens.spacing.sm,
    alignX: 'stretch',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content' }
  });

  // ── Title ─────────────────────────────────────────────────────────────────
  var titleLabel = gui.createLabel({
    bounds: { x: 0, y: 0, width: 1, height: 32 },
    text: 'Responsive GUI Demo',
    align: 'center',
    labelStyle: { typographyRole: 'title' },
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // ── Live viewport / breakpoint info ───────────────────────────────────────
  // Updated every frame in applyLayout() to show current responsive state.
  var infoLabel = gui.createLabel({
    bounds: { x: 0, y: 0, width: 1, height: 22 },
    text: 'Viewport: — · Breakpoint: — · Orientation: — · Columns: —',
    align: 'center',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // ── Adaptive controls grid ────────────────────────────────────────────────
  // Columns: 1 col below 500 px, 2 cols 500–899 px, 3 cols at 900 px+.
  var controlsGrid = gui.createContainer({
    bounds: { x: 0, y: 0, width: 1, height: 1 },
    mode: 'grid',
    columns: 3,
    rowGap: tokens.spacing.sm,
    columnGap: tokens.spacing.sm,
    alignX: 'stretch',
    alignY: 'stretch',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // Column 1 — Buttons
  var btnNew = gui.createButton({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'New',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var btnOpen = gui.createButton({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'Open',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var btnSave = gui.createButton({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'Save',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // Column 2 — Checkboxes
  var chkAnimations = gui.createCheckbox({
    bounds: { x: 0, y: 0, width: 1, height: 36 },
    label: 'Animations',
    checked: true,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var chkSound = gui.createCheckbox({
    bounds: { x: 0, y: 0, width: 1, height: 36 },
    label: 'Sound',
    checked: false,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var chkHints = gui.createCheckbox({
    bounds: { x: 0, y: 0, width: 1, height: 36 },
    label: 'Hints',
    checked: true,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // Column 3 — Sliders
  var sldVolume = gui.createSlider({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'Volume',
    min: 0, max: 100, value: 64,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var sldSpeed = gui.createSlider({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'Speed',
    min: 0, max: 10, value: 5,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });
  var sldBrightness = gui.createSlider({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    label: 'Brightness',
    min: 0, max: 100, value: 80,
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // Populate the grid — widgets fill in row-major order so at 3 cols the
  // grid naturally forms three columns: buttons | checkboxes | sliders.
  controlsGrid
    .add(btnNew).add(chkAnimations).add(sldVolume)
    .add(btnOpen).add(chkSound).add(sldSpeed)
    .add(btnSave).add(chkHints).add(sldBrightness);

  // ── Search / notes field ──────────────────────────────────────────────────
  var searchField = gui.createTextField({
    bounds: { x: 0, y: 0, width: 1, height: 44 },
    value: '',
    placeholder: 'Search or enter a note…',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // ── Status / event log ────────────────────────────────────────────────────
  var statusLabel = gui.createLabel({
    bounds: { x: 0, y: 0, width: 1, height: 22 },
    text: scope.statusText,
    align: 'left',
    layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
  });

  // ── Assemble the panel ────────────────────────────────────────────────────
  root
    .add(titleLabel)
    .add(infoLabel)
    .add(controlsGrid)
    .add(searchField)
    .add(statusLabel);

  root.layout();

  // Store references on scope so on:update / on:input can access them.
  scope.layouts = { root: root, controlsGrid: controlsGrid };
  scope.widgets = {
    titleLabel: titleLabel,
    infoLabel: infoLabel,
    btnNew: btnNew,
    btnOpen: btnOpen,
    btnSave: btnSave,
    chkAnimations: chkAnimations,
    chkSound: chkSound,
    chkHints: chkHints,
    sldVolume: sldVolume,
    sldSpeed: sldSpeed,
    sldBrightness: sldBrightness,
    searchField: searchField,
    statusLabel: statusLabel
  };
}

// ── Per-frame responsive relayout ────────────────────────────────────────────
// Called every frame from on:update so the layout always tracks the viewport.
function applyLayout() {
  if (!scope.dbg) scope.dbg = { lastSig: '', changes: 0, lastChangeFrame: 0 };
  if (!scope.layouts || !scope.widgets) return;

  var tokens = gui.getTokens();

  // Use ui.metrics.canvasWidth/Height (live device pixels, same source as shader-graph.md)
  // and convert to CSS px via the canvas aspect to drive breakpoints.
  var W = ui.metrics.canvasWidth  || 800;
  var H = ui.metrics.canvasHeight || 600;

  // Also read viewport for fitToViewport (which works in CSS-pixel space).
  var viewport = gui.getViewportRect();
  if (!viewport || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) || viewport.width <= 0 || viewport.height <= 0) {
    return;
  }
  var vw = viewport.width;
  var info = gui.getResponsiveInfo({ width: vw, height: viewport.height });

  // Column count and inset driven by raw pixel width — visible at desktop sizes
  var cols = getColumns(vw);
  var inset = getInset(vw, tokens);
  var gap = tokens.spacing.sm;

  // Root panel: padding and rowGap (stack layout uses rowGap, NOT gap)
  scope.layouts.root.container.padding = inset;
  scope.layouts.root.container.rowGap = gap;

  // Grid: columns and gaps
  scope.layouts.controlsGrid.setColumns(cols, false);
  scope.layouts.controlsGrid.rowGap = gap;
  scope.layouts.controlsGrid.columnGap = gap;

  // Fit panel to fill the viewport — no maxWidth cap so width tracks window size
  var panelW = Math.max(0, vw - 2 * inset);
  scope.layouts.root.fitToViewport(viewport, {
    inset: inset,
    width: panelW,
    anchorX: 'center',
    anchorY: 'start'
  }, false);

  scope.layouts.root.layout();

  // Live info string — updated every frame so it reflects any resize instantly
  var rw = Math.round(vw);
  var rh = Math.round(viewport.height);
  var sig = W + 'x' + H;
  var frame = (typeof getFrame === 'function') ? getFrame() : 0;
  if (sig !== scope.dbg.lastSig) {
    scope.dbg.lastSig = sig;
    scope.dbg.changes++;
    scope.dbg.lastChangeFrame = frame;
  }
  var pb = scope.layouts.root.getBounds ? scope.layouts.root.getBounds() : (scope.layouts.root.container ? scope.layouts.root.container.bounds : null);
  var pw = pb && Number.isFinite(pb.width) ? Math.round(pb.width) : NaN;
  scope.widgets.infoLabel.setText(
    info.breakpoint + ' \u00b7 ' + rw + '\u00d7' + rh +
    ' \u00b7 canvas ' + W + '\u00d7' + H +
    ' \u00b7 ' + info.orientation +
    ' \u00b7 ' + cols + (cols === 1 ? ' col' : ' cols') +
    (Number.isFinite(pw) ? (' \u00b7 panelW ' + pw) : '') +
    ' \u00b7 vpChanges ' + scope.dbg.changes + (scope.dbg.lastChangeFrame ? (' @' + scope.dbg.lastChangeFrame) : '')
  );
}
```

```js on:init
term.layerID = 'default';

// Re-initialize scope state here so it's definitely live inside this lifecycle block.
scope.mouseDownLeft = false;
scope.layouts = null;
scope.widgets = null;
scope.clickCount = 0;
scope.statusText = 'Ready — resize the window to see the layout adapt.';
scope.dbg = { lastSig: '', changes: 0, lastChangeFrame: 0 };

// Initialise the retained-mode GUI system (applies theme + scales tokens to DPR)
gui.init();

// Build all widgets once; layout is recomputed every frame in applyLayout()
buildLayout();

// Ensure the very first frame is correctly fitted to the viewport.
applyLayout();
```

```js on:input
if (!event) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl:  (event.mods || []).includes('ctrl'),
    alt:   (event.mods || []).includes('alt'),
    meta:  (event.mods || []).includes('meta')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    scope.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, scope.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, scope.mouseDownLeft);
}
```

```js on:update
if (!scope.widgets) return;

// Refit layout to viewport every frame — handles window resize for free
applyLayout();

// Feed current pointer state into the GUI system
gui.update(getMouseX(), getMouseY(), scope.mouseDownLeft);

// ── Button clicks ─────────────────────────────────────────────────────────
if (scope.widgets.btnNew.wasClicked()) {
  scope.clickCount++;
  setStatus('New (' + scope.clickCount + ')');
}
if (scope.widgets.btnOpen.wasClicked()) {
  scope.clickCount++;
  setStatus('Open (' + scope.clickCount + ')');
}
if (scope.widgets.btnSave.wasClicked()) {
  scope.clickCount++;
  setStatus('Save (' + scope.clickCount + ')');
}

// ── Checkbox toggles ──────────────────────────────────────────────────────
if (scope.widgets.chkAnimations.wasToggled()) {
  setStatus('Animations: ' + (scope.widgets.chkAnimations.isChecked() ? 'on' : 'off'));
}
if (scope.widgets.chkSound.wasToggled()) {
  setStatus('Sound: ' + (scope.widgets.chkSound.isChecked() ? 'on' : 'off'));
}
if (scope.widgets.chkHints.wasToggled()) {
  setStatus('Hints: ' + (scope.widgets.chkHints.isChecked() ? 'on' : 'off'));
}

// ── Slider changes ────────────────────────────────────────────────────────
if (scope.widgets.sldVolume.wasChanged()) {
  setStatus('Volume: ' + Math.round(scope.widgets.sldVolume.getValue()));
}
if (scope.widgets.sldSpeed.wasChanged()) {
  setStatus('Speed: ' + scope.widgets.sldSpeed.getValue().toFixed(1));
}
if (scope.widgets.sldBrightness.wasChanged()) {
  setStatus('Brightness: ' + Math.round(scope.widgets.sldBrightness.getValue()) + '%');
}

// ── Text field ────────────────────────────────────────────────────────────
if (scope.widgets.searchField.wasChanged()) {
  var q = String(scope.widgets.searchField.getValue() || '');
  setStatus(q ? 'Input: "' + q + '"' : 'Ready — resize the window to see the layout adapt.');
}
```

```js on:render
var base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();

gui.render(ui);
```

## How It Works

### `createResponsivePanel`

Wraps `createContainer` with viewport-aware helpers. `fitToViewport` computes
`x / y / width / height` from insets and anchors so you never need to calculate
absolute positions manually.

### `getResponsiveInfo`

Returns `{ breakpoint, orientation, width, height, usableWidth, usableHeight }`.
Column thresholds are driven by raw pixel width: `< 500 px` → 1 col · `500–899 px` → 2 cols · `≥ 900 px` → 3 cols. `getResponsiveInfo` breakpoints (`xs`/`sm`/`md`/`lg`/`xl`) are shown in the info label for reference.

### Per-frame relayout

Calling `applyLayout()` inside `on:update` means any window resize is handled
automatically — no resize-event wiring required.  The two-phase pattern keeps
things clean:

1. **`fitToViewport(viewport, options, false)`** — set bounds only, no layout pass
2. **`layout()`** — run the layout pass once bounds are final

### Nested containers

`controlsGrid` is a plain `createContainer` added as a child of the root panel.
When the root's `layout()` runs, it cascades into `controlsGrid` automatically
because `setChildBounds` calls `child.setBounds(bounds, true)` on nested containers.
