# STFXR Graph GUI Modernization Handoff

This note captures the current state of `docs/demos/stfxr-graph.md` and the recommended path for a future GUI API modernization pass.

## Current State

The demo has already had two focused refactor passes:

- graph normalization and data-shaping helpers were extracted near the top of the file
- widget/editor/inspector flow was decomposed into named helpers so `on:init`, `on:input`, and `on:update` are easier to follow

The demo still uses the older retained-GUI construction style:

- `gui.createTextField(...)`
- `gui.createButton(...)`
- `gui.createSlider(...)`
- `gui.createLabel(...)`
- `gui.createTextEditor(...)`

It also still keeps a direct widget registry in `state.widgets` and uses imperative bounds syncing via:

- `layoutToolbar()`
- `updateInspectorLayout()`

That means the next meaningful cleanup is no longer small helper extraction. The next step is a broader GUI API modernization pass.

## Why This Is Next

The highest remaining structural cost in `docs/demos/stfxr-graph.md` is not graph logic. It is the toolbar and inspector UI being built and maintained at a low level.

The current design works, but it spreads GUI concerns across:

- raw widget creation in `on:init`
- manual per-frame bounds mutation in `on:update`
- direct widget instance access in helper functions
- explicit `gui.handleKey(...)`, `gui.handleText(...)`, `gui.handleMouse(...)`, and `gui.update(...)`

That is the same kind of seam that was successfully modernized in `saintbilly-words.md`.

## Recommended Target

Move the demo toward newer GUI helpers and a more declarative structure.

Primary targets:

1. Replace raw toolbar and inspector widget construction with `gui.screen(...)`.
2. Replace direct widget lookups where practical with helper accessors such as `gui.get(...)`, `gui.text(...)`, and `gui.value(...)`.
3. Consider enabling `gui.init({ input: 'auto', update: 'auto' })` if the demo’s mixed immediate-mode graph interaction does not conflict with that routing model.

## Suggested Migration Order

Do this in phases rather than in one rewrite.

### Phase 1: Screen Definitions

Replace the raw `create*` calls in `on:init` with two screen/group definitions:

- toolbar screen
- inspector screen

Reason:

- this removes the most repetitive setup code first
- it keeps behavior stable while changing construction style

Likely widget IDs to preserve:

- `seedField`
- `btnRand`
- `btnPlay`
- `btnAuto`
- `btnReset`
- `vol`
- `nodeJsonLabel`
- `nodeJson`
- `btnUpdate`
- `status`

Preserving IDs will reduce downstream churn.

### Phase 2: Layout Helpers

After screen creation is migrated, adapt:

- `layoutToolbar()`
- `updateInspectorLayout()`

so they update screen/widget bounds through the newer GUI abstraction rather than direct raw instance assumptions.

If `gui.screen(...)` layout hooks are expressive enough, move as much of this as possible into screen-level layout logic instead of mutating bounds everywhere.

### Phase 3: Widget Access Modernization

Replace direct widget references in the helper flow where it improves clarity.

Examples:

- use `gui.get('nodeJson')` instead of reaching through `state.widgets.nodeJson`
- use `gui.value('vol')` where slider reads/writes do not require full widget methods
- use `gui.text('status', ...)` and `gui.text('nodeJsonLabel', ...)` where appropriate

Keep direct widget access only where the widget API is still needed, for example:

- `getSelectionRange()`
- `replaceTextRange()`
- text editor-specific methods

### Phase 4: Auto Routing Evaluation

Only after the above is stable, evaluate whether this demo can safely use:

```js
gui.init({ input: 'auto', update: 'auto' })
```

This needs care because the demo mixes retained-GUI interaction with immediate-mode graph dragging and splitter dragging.

Questions to verify during that pass:

- does auto routing interfere with graph-area drag/pan behavior?
- does auto routing interfere with the splitter drag?
- do editor text entry and slider interaction still behave correctly?

If the answer is mixed, it is acceptable to keep manual routing for this demo.

## Known Sensitive Areas

These are the places most likely to regress during modernization:

### 1. Text Editor Selection Tracking

The numeric-binding flow depends on:

- `getSelectionRange()`
- editor text replacement
- preserving selection-driven binding retargeting

Relevant helpers:

- `getNodeJsonSelection(...)`
- `syncNumericBindingFromEditor()`
- `syncNumericBindingForEditorState(...)`
- `applyNumericSliderValue(...)`

### 2. Splitter Drag

The right panel width is resized by dragging the splitter in immediate-mode space.

Relevant helpers:

- `beginSplitterDrag(...)`
- `updateActiveGraphDrag(...)`
- `graphBounds()`

Do not assume GUI auto layout should own this unless you intentionally redesign the splitter.

### 3. Node Drag And Pan

The graph itself is not a retained-GUI scene. It is immediate-mode canvas drawing with custom hit testing and drag state.

Relevant helpers:

- `beginGraphDrag(...)`
- `updateHoveredGraphNode(...)`
- `updateActiveGraphDrag(...)`
- `viewToWorld(...)`
- `worldToView(...)`

The modernization pass should avoid coupling this too tightly to the retained-GUI system.

## Practical Goal For The Next Session

If continuing in a new session, the best first implementation target is:

1. migrate only the toolbar and inspector widget creation in `on:init` to `gui.screen(...)`
2. preserve existing widget IDs
3. keep the current behavior of `layoutToolbar()` and `updateInspectorLayout()` initially
4. validate before attempting auto input/update routing

That keeps the change set narrow and reversible.

## Acceptance Criteria

The modernization pass should be considered successful if all of the following still work:

- random seed entry and randomize button
- play button
- auto layout button
- reset camera button
- volume slider
- node selection in graph
- node dragging
- graph panning
- splitter dragging
- node JSON editing
- numeric-value retargeting from text selection
- update/apply button

And validation should still pass with:

- `npm run check:authoring`
- `npm run build`

## File To Continue From

Primary file:

- `docs/demos/stfxr-graph.md`

This handoff note:

- `documentation/STFXR_GRAPH_GUI_MODERNIZATION_HANDOFF.md`