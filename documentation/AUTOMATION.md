# Automation

Storie already supports time-indexed data via ```timed blocks (parsed into `TimedEntry[] { ms, text }`).
This document describes a small, deterministic automation layer that builds on that data.

The automation helpers are exposed to document code as:
- `sys.automation.*`
- `sys.input.emit(...)`

These are designed to be deterministic under video export (where the engine runs with a synthetic clock via `tickExportFrame()` and freezes real user input).

## Authoring: ```timed name:events

Use Storie's native timed format (`ms|text`), and make `text` be JSON.

Example:

```timed name:events
0|{"var":"ui.zoom","value":1}
1000|{"var":"ui.zoom","value":1.3,"ease":"outCubic"}
2000|{"var":"ui.zoom","to":1,"durMs":600,"ease":"inOutQuad"}
2500|{"call":"spawnEnemy","args":[3]}
3000|{"input":{"type":"keydown","key":"ArrowRight"}}
3200|{"input":{"type":"keyup","key":"ArrowRight"}}
```

### Supported JSON shapes

**Keyframe (absolute value)**
- `{ "var": "some.name", "value": 1.25, "ease"?: "outCubic" | {type:'cubicBezier',...} }`

**Tween (relative segment)**
- `{ "var": "some.name", "to": 2, "durMs": 500, "ease"?: ... }`

**Impulse: call**
- `{ "call": "functionName", "args"?: [...] }`

**Impulse: input**
- `{ "input": { "type": "keydown"|"keyup"|"mouse"|"mouse_move"|"text", ... } }`

## Runtime usage

### Compile once, sample every frame

```js
let track;
let prevT = 0;

init = () => {
  track = sys.automation.compile(doc.timedBlock('events'));
  prevT = getTime();
};

update = () => {
  const nowT = getTime();

  // Sample eased variable state (deterministic, seek-safe)
  const zoom = sys.automation.valueAt(track, 'ui.zoom', nowT, 1);

  // Apply it wherever you want (scope vars, shader uniforms, UI state, etc.)
  uiZoom = zoom;

  // Fire impulses on forward-moving edges
  for (const ev of sys.automation.impulsesBetween(track, prevT, nowT)) {
    if (ev.type === 'input') sys.input.emit(ev.input);
    if (ev.type === 'call') {
      // Recommended: handle calls explicitly instead of eval.
      // Example:
      // if (ev.call === 'spawnEnemy') spawnEnemy(...(ev.args||[]));
    }
  }

  prevT = nowT;
};
```

### Easing functions

You can preview an easing curve by calling:
- `sys.automation.ease(u, 'outCubic')` where `u` is in [0..1].

For cubic beziers:
- `sys.automation.ease(u, { type: 'cubicBezier', x1, y1, x2, y2 })`

## Worlds timelines

For export-safe Worlds authoring, prefer a deterministic section-state track over
ad hoc per-frame mutation. Keep using a normal global ```timed block, but make
each line JSON that targets a section.

Example:

```timed name:worlds-edit
0|{"section":"intro","content":"Opening title","visible":true}
1000|{"section":"intro","title":"Act I"}
2000|{"section":"intro","position":{"x":20,"y":0,"z":-80}}
3000|{"section":"chorus","visible":true}
```

Compile once, then sample/apply from time:

```js
let track;

init = () => {
  track = worlds.timeline.compile(doc.timedBlock('worlds-edit'));
};

export = () => {
  worlds.timeline.reset(track);
};

update = () => {
  worlds.timeline.apply(track, getTime());
};
```

This model is safer for video export and future scrubbing because state is
derived from the selected time instead of relying only on forward-moving edge
triggers.

## Worlds section content

For lyric-style or caption-style content inside a Worlds card, prefer the
same-card content override path instead of repeatedly mutating the runtime
section store.

Example:

```js
const lyricsTrack = doc.timedBlock('lyrics');

update = () => {
  worlds.content.applyTimed('current', lyricsTrack, getTime(), {
    target: 'content',
    mode: 'replace'
  });
};
```

`worlds.content.applyTimed()` samples timed entries at the requested time and
updates only the rendered card content for that section. This keeps the change
inside the existing Worlds card render path and avoids using section CRUD for
high-frequency content changes.

For custom composition, sample without applying:

```js
const sampled = worlds.content.stateAt(doc.timedBlock('lyrics'), getTime(), {
  mode: 'append',
  separator: '\n'
});

worlds.content.set('chorus', {
  content: `Now singing:\n\n${sampled.text}`
});
```

## Synthetic input

`sys.input.emit(event)`:
- Updates the engine's internal key/mouse state (so `key.down(...)` / `mouse.down(...)` reflect it)
- Dispatches an `on:input` event to the document handler (if defined)

This works during video export as well (real input is disabled during export).

Notes:
- Synthetic input is ignored in audience/client view.
- Prefer explicit automation events (e.g. "goto section") when possible; only use synthetic input when you want to reuse an existing input-driven game loop.

## Export start (resetting state)

Video export runs with a synthetic clock that starts at `t=0` for the exported capture.
If your document stores state like `prevT` from live playback, reset it when export begins so edge-triggered impulses fire from the start.

Use an `on:export` handler:

```js on:export
const s = st();
s.prevT = 0;
```
