---
name: "Responsive GUI Demo (Storie)"
theme: "nord"
authoringCheck: explicit-conditionals
---

A demo showcasing Storie's retained-mode GUI panels adapting to the viewport. **Resize the window** to watch the layout reflow: columns change at 900 px (3→2) and 500 px (2→1), and the panel continuously stretches to fill the window.

**Keyboard Controls:**
- **TAB / SHIFT+TAB**: Navigate focus through widgets
- **ENTER / SPACE**: Activate focused button or checkbox
- **LEFT / RIGHT**: Adjust a focused slider

## Demo Code

```js
var state = {
  clickCount: 0,
  statusText: 'Ready — resize the window to see the layout adapt.',
  query: '',
  animations: true,
  sound: false,
  hints: true,
  volume: 64,
  speed: 5,
  brightness: 80,
  viewportWidth: 0,
  viewportHeight: 0,
  breakpoint: 'md',
  orientation: 'landscape',
  columns: 3
};

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
  var status = msg;
  if (status == null) status = '';
  state.statusText = String(status);
  gui.text('statusLabel', state.statusText);
}

function syncResponsiveLayout(ctx) {
  if (!ctx || !ctx.viewport || !ctx.widgets) return;

  var viewport = ctx.viewport;
  var tokens = ctx.tokens || gui.getTokens();
  var info = ctx.responsive || gui.getResponsiveInfo(viewport);
  var cols = getColumns(viewport.width);
  var inset = getInset(viewport.width, tokens);
  var gap = tokens.spacing.sm;
  var panelWidth = Math.max(0, viewport.width - 2 * inset);

  if (ctx.root && ctx.root.container) {
    ctx.root.container.padding = inset;
    ctx.root.container.rowGap = gap;
  }

  if (ctx.widgets.controlsGrid) {
    ctx.widgets.controlsGrid.setColumns(cols, false);
    ctx.widgets.controlsGrid.rowGap = gap;
    ctx.widgets.controlsGrid.columnGap = gap;
  }

  state.viewportWidth = Math.round(viewport.width);
  state.viewportHeight = Math.round(viewport.height);
  state.breakpoint = info.breakpoint;
  state.orientation = info.orientation;
  state.columns = cols;

  var columnLabel = ' cols';
  if (cols === 1) columnLabel = ' col';

  gui.text(
    'infoLabel',
    info.breakpoint + ' · ' + state.viewportWidth + '×' + state.viewportHeight +
      ' · ' + info.orientation +
      ' · ' + cols + columnLabel +
      ' · panelW ' + Math.round(panelWidth)
  );

  return {
    inset: inset,
    width: panelWidth,
    anchorX: 'center',
    anchorY: 'start'
  };
}
```

```js on:init
term.layerID = 'default';

gui.screen({
  input: 'auto',
  update: 'auto',
  state,
  layout: {
    type: 'panel',
    insetX: 'lg',
    insetTop: 'lg',
    rowGap: 'sm',
    anchorX: 'center',
    anchorY: 'start',
    onLayout: syncResponsiveLayout
  },
  widgets: {
    titleLabel: {
      type: 'label',
      bounds: { height: 32 },
      text: 'Responsive GUI Demo',
      align: 'center',
      labelStyle: { typographyRole: 'title' }
    },
    infoLabel: {
      type: 'label',
      bounds: { height: 22 },
      text: 'Viewport: — · Breakpoint: — · Orientation: — · Columns: —',
      align: 'center'
    },
    controlsGrid: {
      type: 'container',
      mode: 'grid',
      columns: 3,
      rowGap: 8,
      columnGap: 8,
      alignX: 'stretch',
      alignY: 'stretch',
      bounds: { height: 1 },
      widgets: {
        btnNew: {
          type: 'button',
          bounds: { height: 44 },
          label: 'New',
          onClick() {
            state.clickCount += 1;
            setStatus('New (' + state.clickCount + ')');
          }
        },
        chkAnimations: {
          type: 'checkbox',
          bounds: { height: 36 },
          label: 'Animations',
          checked: state.animations,
          bind: 'animations',
          onToggle() {
            var animationStatus = 'off';
            if (state.animations) animationStatus = 'on';
            setStatus('Animations: ' + animationStatus);
          }
        },
        sldVolume: {
          type: 'slider',
          bounds: { height: 44 },
          label: 'Volume',
          min: 0,
          max: 100,
          value: state.volume,
          bind: 'volume',
          onChange() {
            setStatus('Volume: ' + Math.round(state.volume));
          }
        },
        btnOpen: {
          type: 'button',
          bounds: { height: 44 },
          label: 'Open',
          onClick() {
            state.clickCount += 1;
            setStatus('Open (' + state.clickCount + ')');
          }
        },
        chkSound: {
          type: 'checkbox',
          bounds: { height: 36 },
          label: 'Sound',
          checked: state.sound,
          bind: 'sound',
          onToggle() {
            var soundStatus = 'off';
            if (state.sound) soundStatus = 'on';
            setStatus('Sound: ' + soundStatus);
          }
        },
        sldSpeed: {
          type: 'slider',
          bounds: { height: 44 },
          label: 'Speed',
          min: 0,
          max: 10,
          value: state.speed,
          bind: 'speed',
          onChange() {
            setStatus('Speed: ' + Number(state.speed).toFixed(1));
          }
        },
        btnSave: {
          type: 'button',
          bounds: { height: 44 },
          label: 'Save',
          onClick() {
            state.clickCount += 1;
            setStatus('Save (' + state.clickCount + ')');
          }
        },
        chkHints: {
          type: 'checkbox',
          bounds: { height: 36 },
          label: 'Hints',
          checked: state.hints,
          bind: 'hints',
          onToggle() {
            var hintStatus = 'off';
            if (state.hints) hintStatus = 'on';
            setStatus('Hints: ' + hintStatus);
          }
        },
        sldBrightness: {
          type: 'slider',
          bounds: { height: 44 },
          label: 'Brightness',
          min: 0,
          max: 100,
          value: state.brightness,
          bind: 'brightness',
          onChange() {
            setStatus('Brightness: ' + Math.round(state.brightness) + '%');
          }
        }
      }
    },
    searchField: {
      type: 'textField',
      bounds: { height: 44 },
      value: state.query,
      placeholder: 'Search or enter a note…',
      bind: 'query',
      onChange() {
        var q = String(state.query || '');
        if (q) {
          setStatus('Input: "' + q + '"');
          return;
        }
        setStatus('Ready — resize the window to see the layout adapt.');
      }
    },
    statusLabel: {
      type: 'label',
      bounds: { height: 22 },
      text: state.statusText,
      align: 'left'
    }
  }
});
```

```js on:render
var base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();

gui.render(ui);
```

## How It Works

### `gui.screen(..., { layout })`

This demo uses `gui.screen(...)` as the top-level retained UI builder. The
`layout` block creates a managed root panel, auto-routes overlay input/update,
and keeps all widgets addressable by name.

### Nested Containers

`controlsGrid` is declared as a `type: 'container'` widget inside the screen
spec, with its own nested `widgets` block. That lets the demo keep the grid and
its children together declaratively instead of creating them piecemeal and
manually wiring them into a separate container.

### `layout.onLayout`

The `onLayout` callback runs whenever the managed screen relayouts. It receives
the live viewport, responsive info, screen widgets, and tokens, so the demo can
adjust grid columns, spacing, and panel fit from viewport state without manual
`on:input` or `on:update` GUI plumbing.

Column thresholds are still driven by raw viewport width: `< 500 px` → 1 col ·
`500–899 px` → 2 cols · `≥ 900 px` → 3 cols.

### Explicit State + Callbacks

Buttons, checkboxes, sliders, and the text field all bind directly to explicit
state and use `onClick` / `onToggle` / `onChange` callbacks for reactions. The
demo no longer needs a manual widget registry or polling code to detect changes.
