<!-- authoring-check: explicit-conditionals -->

# GUI Basic API-First Pilot

## Purpose

This note treats `docs/demos/gui-basic.md` as the first concrete pilot for moving Storie toward an API-first scripting model.

The goal is not to perfect one demo in isolation.

The goal is to use one real demo to identify:

- which parts of the current authoring model are still too JavaScript-shaped
- which parts should become clearer Storie API concepts
- which changes are reusable across other demos and applications

`gui-basic.md` is a good first pilot because it is small, easy to reason about, and touches several important seams at once:

- persistent state
- retained widget creation
- input routing
- per-frame update semantics
- automatic retained rendering

## What The Demo Already Proves

Even today, `gui-basic.md` shows that Storie already has a useful retained GUI layer.

The author can:

- initialize the GUI system once
- create widgets once
- query widget state later
- rely on automatic retained rendering

That is already closer to the intended future than immediate-mode UI demos.

The problem is that too much author effort is still spent on plumbing.

## Current Friction In gui-basic.md

The current demo is simple, but it still exposes several implementation details that the API should absorb.

### 1. Input routing is still manual

The demo has to explicitly forward keyboard, text, mouse press, and mouse move events into the GUI system.

That means the authored script still has to know too much about the event transport layer.

Desired direction:

- `gui` should be able to opt into default input routing
- the engine should feed GUI systems automatically when requested
- the author should only handle input manually when they want custom behavior

### 2. Per-frame GUI update is still manual

The demo still calls `gui.update(mouseX, mouseY, state.mouseDownLeft)` each frame.

That is reasonable as an implementation detail, but it is not ideal as an authoring primitive.

Desired direction:

- retained GUI should be able to auto-update once initialized
- the author should only step the GUI manually for unusual cases

### 3. Widget references are still managed manually

The demo builds a `state.widgets` object and then reaches into it everywhere.

This is workable and better than many implicit globals, but it is still low-level.

Desired direction:

- support widget IDs or named groups as first-class lookup handles
- support higher-level screen/form builders for common retained layouts
- support binding widget state to explicit app state where appropriate

### 4. Layout is still mostly manual bounds math

The demo still uses hard-coded bounds for each widget.

That is acceptable for now, but it is not the long-term sweet spot if the goal is Scratch-like or Nim-like authoring.

Desired direction:

- keep absolute bounds available
- but increasingly steer simple demos toward containers, panels, tokens, and named layout helpers

### 5. Event handling is still poll-heavy

The demo checks widget state in `on:update` using `.wasClicked()`, `.wasToggled()`, and `.wasChanged()`.

That is not inherently bad, but simple retained demos often want a more direct way to express reactions.

Desired direction:

- allow polling to remain
- also support simple `onClick`, `onToggle`, `onChange`, or binding-oriented authoring for common cases

### 6. Debug and app semantics are mixed together

The demo mixes real application logic with raw debug label updates, hover inspection, and pointer readback.

That is normal for a demo, but it highlights that Storie still lacks a clean "screen" abstraction where app state, widgets, bindings, and diagnostics can live together.

## What We Changed Immediately

The first pass on the demo already moves it in the right direction:

- shared mutable state now lives in a single `state` object
- `gui-basic.md` now opts into automatic retained GUI input and update routing via `gui.init({ input: 'auto', update: 'auto' })`
- `gui-basic.md` now uses named widget IDs plus `gui.get(...)`, `gui.text(...)`, `gui.value(...)`, and `gui.checked(...)` instead of maintaining a manual widget map
- `gui-basic.md` now binds common retained controls directly to explicit state via `gui.bind(...)`
- `gui-basic.md` now uses a small `gui.screen(...)` helper to declare named widgets and their bindings in one place
- `gui-basic.md` now uses simple `onClick`, `onToggle`, and `onChange` callbacks inside `gui.screen(...)` for common reactions
- `gui-basic.md` now uses a simple `layout` block inside `gui.screen(...)` to stack and fit widgets without per-widget x/y placement
- `gui-basic.md` now uses token-aware layout spacing such as `insetTop: 'xl'` and `rowGap: 'md'`
- the newer `gui-responsive.md` follow-up now proves that `gui.screen(...)` can also host nested container widgets and a per-frame `layout.onLayout(...)` hook for responsive relayout
- the newer `keypad.md` follow-up now proves that a breakpoint-heavy demo can move from manual rebuild loops onto `gui.screen(...)` with explicit state, nested containers, and a responsive layout hook

This is not the final model.

It is a low-risk transition step that aligns the demo with the explicit-state direction already needed for compilation.

## Current Pilot Result

The first engine-side simplification from this pilot is now implemented for overlay retained GUI:

- `gui.init({ input: 'auto', update: 'auto' })` enables automatic keyboard and pointer routing for retained GUI widgets
- the engine now performs per-frame retained GUI stepping automatically for the standard overlay path
- `gui-basic.md` no longer needs a manual `on:input` block or a manual `gui.update(...)` call in `on:update`
- `gui-responsive.md` no longer needs manual widget registries, manual `createResponsivePanel(...)` plumbing, or a hand-written `applyLayout()` / `gui.update(...)` loop just to stay responsive
- `keypad.md` no longer needs `widgets` / `layouts` registries, `rebuildLayout(...)`, or manual input forwarding to stay responsive and interactive

This is exactly the kind of change the pilot was meant to drive:

- less JS plumbing in the demo
- more engine-owned behavior
- clearer author intent

The old pointer-accessor mismatch should now be treated as a transitional implementation detail of the manual path, not as the preferred way to author retained GUI demos.

## Target Authoring Shape

The long-term version of a demo like `gui-basic.md` should look more like this:

```js
var state = {
  clickCount: 0,
  featureEnabled: false,
  volume: 50,
  text: 'Type here\nSecond line'
};
```

```js on:init
gui.screen({
  input: 'auto',
  update: 'auto',
  layout: {
    type: 'panel',
    inset: 'lg',
    gap: 'md',
    maxWidth: 620
  },
  widgets: {
    title: gui.label('Retained-Mode GUI Demo (Storie)', {
      align: 'center',
      role: 'title'
    }),
    click: gui.button('Click Me', {
      onClick() {
        state.clickCount += 1;
        let suffix = 's';
        if (state.clickCount === 1) {
          suffix = '';
        }
        gui.text('status', `Button clicked ${state.clickCount} time${suffix}!`);
      }
    }),
    feature: gui.checkbox('Enable Feature', {
      bind: 'state.featureEnabled'
    }),
    volume: gui.slider('Volume', {
      min: 0,
      max: 100,
      bind: 'state.volume'
    }),
    input: gui.editor({
      bind: 'state.text'
    }),
    status: gui.label('Status: Ready'),
    debug: gui.label('Debug: ...')
  }
});
```

```js on:update
gui.text('debug', `Frame ${getFrame()} | Mouse: (${mouseX.toFixed(0)}, ${mouseY.toFixed(0)}) | Vol: ${Math.round(state.volume)}`);
```

That sample is intentionally aspirational.

The point is not the exact API spelling.

The point is the semantic shift:

- the author declares a screen, not a widget registry
- default input and update wiring become opt-in engine behavior
- common widget reactions become declarative or callback-based
- explicit state becomes the stable contract

## Proposed API Additions Driven By This Demo

This pilot suggests several concrete API additions.

### A. Automatic retained-GUI routing

Candidate shapes:

- `gui.init({ input: 'auto', update: 'auto' })`
- `gui.mount({ autoInput: true, autoUpdate: true })`
- `gui.screen({ input: 'auto', update: 'auto', ... })`

`gui.init({ input: 'auto', update: 'auto' })` is now the first implemented slice of this direction for overlay retained GUI demos.

The remaining work is to make this richer and more uniform, not to prove the idea.

### B. Named widget lookup

Candidate shapes:

- `id` support as a first-class authoring pattern
- `gui.get('status')`
- `gui.text('status', '...')`
- `gui.value('volume')`

This is now implemented for retained GUI demos.

The current helper layer is intentionally small:

- `gui.get(id)` returns the widget instance
- `gui.text(id, next?)` reads or writes label/text-like widgets
- `gui.value(id, next?)` reads or writes value-based widgets
- `gui.checked(id, next?)` reads or writes checkbox state

That is enough to remove hand-built `widgets = { ... }` maps from simple demos like `gui-basic.md`.

### C. Screen or form builder

The initial `gui.screen(...)` helper now has a stronger shape than the first pilot draft:

- widgets can include nested `container` / `responsivePanel` children via nested `widgets` blocks
- screen layout can expose a per-frame `onLayout(context)` seam for responsive rules that depend on viewport state
- responsive demos can now stay declarative while still adjusting columns, spacing, and fitted panel width at runtime
- small shorthand builders such as `gui.label(...)`, `gui.button(...)`, `gui.checkbox(...)`, `gui.slider(...)`, `gui.input(...)`, `gui.editor(...)`, and `gui.container(...)` now reduce screen-spec noise in real demos

Candidate shapes:

- `gui.screen(...)`
- `gui.form(...)`
- `gui.panel(...)`

The first concrete slice is now implemented as a small `gui.screen(...)` helper.

Current behavior:

- initializes retained GUI automatically when needed
- creates named widgets from declarative `{ type, ...config }` specs
- applies `bind` entries against a shared screen `state` object
- supports simple `onClick`, `onToggle`, and `onChange` callbacks for common retained reactions
- supports a small managed root layout panel for stacked/row/grid screen layouts that fit to the viewport
- allows screen layout spacing to use GUI token names (`xs`/`sm`/`md`/`lg`/`xl`) instead of raw pixel values
- still leaves interaction handling compatible with the existing `gui.get(...)` / `.wasClicked()` polling model when lower-level control is needed

This is intentionally narrower than the long-term aspiration.

It already gives demos a higher-level retained entry point that groups:

- layout
- named widgets
- default routing
- state binding
- screen-local helpers

### D. State binding helpers

Candidate shapes:

- `bind: 'state.volume'`
- `bind: { get: () => state.volume, set: (v) => state.volume = v }`
- `gui.bind(widget, state, 'volume')`

The first concrete slice is now implemented as `gui.bind(widgetOrId, stateObject, path)`.

Current behavior:

- binding mode is inferred for common retained widgets (`value`, `checked`, `text`)
- widget-originated changes flow back into explicit state during retained GUI input/update handling
- state-originated changes flow into widgets before retained GUI render

This is enough for simple demos like `gui-basic.md` to treat explicit state as the stable data model while keeping the existing retained widgets.

### E. Higher-level layout defaults

Candidate shapes:

- named panel presets
- token-driven default spacing
- stack/grid helpers that avoid scattering raw bounds for simple forms

This would keep absolute positioning available without forcing it to be the default authoring style.

## Compiler And IR Implications

This demo also suggests what the compiler should understand as first-class behavior.

### Behavior IR should recognize

- GUI initialization
- named widget declarations
- input routing mode
- widget event callbacks or bindings
- debug-only per-frame label updates

### Capability analysis should recognize

- retained GUI usage
- text input usage
- keyboard routing usage
- pointer usage
- layout helper usage

### Compile-oriented profile guidance should flag

- manual transport plumbing when a retained helper would suffice
- excessive top-level persistent bindings
- widget state wiring patterns that should collapse into bindings later

The point is not to reject the current demo.

The point is to make the compiler increasingly able to say: "this is a retained GUI screen" instead of seeing only a pile of arbitrary JS statements.

## Recommended Implementation Order

For `gui-basic.md`, the most useful next steps are:

1. keep the explicit `state` object pattern
2. add optional automatic GUI input routing
3. add optional automatic retained GUI update stepping
4. add first-class widget IDs and lookup helpers
5. introduce a higher-level screen or form helper for simple retained demos
6. add state-binding helpers once the screen model is stable

This ordering keeps the improvements incremental while still moving toward the long-term API-first direction.

## How To Use This Pilot

This document should be treated as a template for other demo-by-demo migrations.

For each selected demo:

1. identify the plumbing the author is still carrying
2. decide whether that plumbing should become API surface, compiler understanding, or remain manual
3. update the demo to reflect the preferred current pattern
4. extract a reusable engine task from that result

If that discipline is maintained, demo-by-demo migration is feasible and valuable.

If that discipline is not maintained, demo-by-demo migration will produce one-off helpers instead of a better architecture.