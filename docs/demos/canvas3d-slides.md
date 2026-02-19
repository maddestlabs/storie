---
title: "3D Canvas Slides (Prototype)"
theme: "neotopia"
---

# Canvas3D Slides (Prototype) {"x":"0","y":"0","z":"0"}

This demo tests the idea that **Canvas3D + Sections = a slide deck**.

Controls (presentation-style):

- Next slide: `Space`, `PageDown`, `n`
- Previous slide: `Shift+Space`, `PageUp`, `p`
- Jump: `Home` / `End`
- Overview grid: `O`
- Reveal steps (host-only): `]` next, `[` prev, `0` reset

If you disable Canvas3D’s built-in 3D link key handling (this demo does), you can
also use:

- Next/prev: `ArrowRight` / `ArrowLeft`

Notes:

- Canvas3D can use Tab/Enter/Arrow keys for **3D link focus navigation**; this demo disables that so it can use Arrow keys for slide navigation.
- We define an `on:input` handler solely so the engine calls `preventDefault()` for key events (avoids browser scrolling on Space/PageUp/PageDown).

```javascript
// === Slide deck settings ===
// Convention:
// - Slides are H1 sections by default.
// - Hidden/non-navigable sections are excluded by default.
const navRule = { scope: 'global', levels: 1, includeHidden: false };
let slideFill = 0.92;

function gotoSlide(i) {
  canvas3D.nav.goto(i, { ...navRule, fill: slideFill });
}

function nextSlide() {
  canvas3D.nav.next({ ...navRule, fill: slideFill });
}

function prevSlide() {
  canvas3D.nav.prev({ ...navRule, fill: slideFill });
}
```

```javascript on:init
canvas3D.enable();
canvas3D.controls.setEnabled(false);
canvas3D.links.setKeyHandlingEnabled(false);

// Make the camera motion feel like a slide deck.
canvas3D.camera.setEaseSpeed(0.10, 0.16);

// Start on the first slide section after the intro (cursor 1) when present.
if (canvas3D.nav.count(navRule) > 0) {
  gotoSlide(1);
}
```

```javascript on:input
// We don’t need fine-grained DOM input here; we just want the engine
// to call preventDefault() for key events to avoid browser scrolling.
// (Returning false would stop the engine.)
return true;
```

```javascript on:update
const next = key.pressed(' ') || key.pressed('PageDown') || key.pressed('n') || key.pressed('N');
const prev = (key.pressed(' ') && (key.down('Shift') || key.down('ShiftLeft') || key.down('ShiftRight')))
  || key.pressed('PageUp')
  || key.pressed('p')
  || key.pressed('P');

// Optional Arrow key bindings (work best when Canvas3D link key handling is disabled)
const nextArrow = key.pressed('ArrowRight') || key.pressed('ArrowDown');
const prevArrow = key.pressed('ArrowLeft') || key.pressed('ArrowUp');

if ((next || nextArrow) && !(prev || prevArrow)) nextSlide();
if ((prev || prevArrow) && !(next || nextArrow)) prevSlide();

if (key.pressed('Home')) gotoSlide(0);
if (key.pressed('End')) gotoSlide(canvas3D.nav.count(navRule) - 1);

// Overview grid toggle (host-only; client/audience windows ignore this)
if (key.pressed('o') || key.pressed('O')) {
  canvas3D.overview.toggle({ levels: 'any', fill: slideFill });
}

// Reveal step controls (host-only)
if (host.isHost) {
  if (key.pressed(']')) scene.nextRevealStep();
  if (key.pressed('[')) scene.setRevealStep(Math.max(0, scene.revealStep - 1));
  if (key.pressed('0')) scene.resetRevealStep();
}

// Quick jump: number keys 1-9
for (let n = 1; n <= 9; n++) {
  if (key.pressed(String(n))) {
    gotoSlide(n - 1);
  }
}

// Optional: tweak framing on the fly.
if (key.pressed('+') || key.pressed('=')) {
  slideFill = Math.max(0.70, Math.min(0.98, slideFill + 0.02));
  gotoSlide(canvas3D.nav.cursor(navRule) ?? 0);
}
if (key.pressed('-') || key.pressed('_')) {
  slideFill = Math.max(0.70, Math.min(0.98, slideFill - 0.02));
  gotoSlide(canvas3D.nav.cursor(navRule) ?? 0);
}
```

```javascript on:render
// Host HUD as a top-left terminal "panel" (surface + border).
// (Avoid clearing — the 3D layer is separate and we don’t want to stomp other layers.)
const base = getStyle('default');
const surface = getStyle('surface');
const border = getStyle('border');
const heading = getStyle('heading');
const dim = getStyle('dim');

const c = canvas3D.nav.cursor(navRule);
const total = canvas3D.nav.count(navRule);
const list = canvas3D.nav.list(navRule);
const idx = c === null ? -1 : (list[c] ?? -1);
const outline = doc.outline();

const lines = [];
lines.push(host.isHost ? 'Canvas3D Slides (Host)' : 'Canvas3D Slides');
lines.push(`Slides: ${c === null ? 0 : (c + 1)}/${total} (section ${idx})`);
lines.push(`Next: Space/PageDown/N | Prev: Shift+Space/PageUp/P | Home/End`);
lines.push(`Overview: ${canvas3D.overview.enabled ? 'ON' : 'off'} (O)`);
lines.push(`Reveal: ${scene.revealStep} ${host.isHost ? '([ / ] / 0)' : ''}`);
lines.push('');
lines.push('Index (press 1-9):');

const max = Math.min(9, list.length);
for (let i = 0; i < max; i++) {
  const sectionIndex = list[i];
  const title = outline[sectionIndex]?.title ?? `Section ${sectionIndex}`;
  const marker = c === i ? '>' : ' ';
  lines.push(`${marker} ${i + 1}. ${title}`);
}

const panelX = 0;
const panelY = 0;
const padX = 1;
const padY = 1;
const maxLineLen = lines.reduce((m, s) => Math.max(m, String(s ?? '').length), 0);
const contentW = Math.max(10, maxLineLen);

const panelW = Math.max(12, Math.min(termWidth, contentW + padX * 2 + 2));
const panelH = Math.max(6, Math.min(termHeight, lines.length + padY * 2 + 2));

const innerW = Math.max(0, panelW - 2);
const innerH = Math.max(0, panelH - 2);

// Borders
term.write(panelX, panelY, `┌${'─'.repeat(Math.max(0, panelW - 2))}┐`, border.fg, surface.bg);
for (let row = 0; row < innerH; row++) {
  term.write(panelX, panelY + 1 + row, '│', border.fg, surface.bg);
  term.write(panelX + 1, panelY + 1 + row, ' '.repeat(innerW), surface.fg, surface.bg);
  term.write(panelX + panelW - 1, panelY + 1 + row, '│', border.fg, surface.bg);
}
term.write(panelX, panelY + panelH - 1, `└${'─'.repeat(Math.max(0, panelW - 2))}┘`, border.fg, surface.bg);

// Text
const textX = panelX + 1 + padX;
const textY = panelY + 1 + padY;
const textW = Math.max(0, panelW - 2 - padX * 2);

for (let i = 0; i < lines.length; i++) {
  const y = textY + i;
  if (y >= panelY + panelH - 1) break;
  const raw = String(lines[i] ?? '');
  const clipped = raw.length > textW ? raw.slice(0, Math.max(0, textW - 1)) + '…' : raw;

  const style = (i === 0) ? heading : (raw.endsWith(':') ? dim : base);
  term.write(textX, y, clipped.padEnd(textW, ' '), style.fg, surface.bg);
}
```

# Slide 1 — Sections are slides {"x":"0","y":"0","z":"-200"}

Canvas3D already renders Sections as 3D “cards”. For a slide deck you mostly need:

- A **slide order** (this prototype uses depth-first order, H1-only)
- A **next/prev input mapping**
- Optional: per-slide `on:enter` scripting

```javascript on:enter
// Per-slide code: runs when the section becomes the current 3D section.
term.write(0, 3, 'Entered Slide 1');
```

# Slide 2 — Per-slide scripting {"x":"0","y":"0","z":"-400","rotate-y":"8"}

Because `on:enter` is section-scoped, it works as a “slide enter” hook.

Ideas:

- Start/stop audio
- Reset simulation state
- Spawn UI widgets
- Kick off per-slide animations

```javascript on:enter
scope.slide2EnteredAt = getTime();
term.write(0, 4, `Slide 2 entered at t=${scope.slide2EnteredAt.toFixed(2)}s`);
```

# Slide 3 — Camera fit vs focus {"x":"0","y":"0","z":"-600","rotate-y":"-10"}

This demo uses `focusOnSectionFit()` so the whole card stays framed.

If you want a more cinematic presenter, you can switch to `focusOnSection()` with an explicit distance.

```javascript on:enter
// Slightly different feel per slide.
canvas3D.camera.setEaseSpeed(0.08, 0.12);
```

# Slide 4 — Layout conventions {"x":"0","y":"0","z":"-800"}

For presenter mode, you probably want a consistent layout convention, for example:

- Slides laid out along -Z at fixed spacing (like this demo)
- Or auto-layout into a grid/ring for “overview mode”

```javascript on:enter
canvas3D.camera.setEaseSpeed(0.10, 0.16);
```

# Appendix — Implementation suggestions {"hidden":true,"navigable":false}

If you decide to turn this into a first-class feature, some implementation ideas:

1) **Presentation keymap toggle**
   - Today, Arrow keys are reserved for Canvas3D link-focus navigation.
   - Consider adding something like `canvas3D.nav.setKeyMode('links' | 'slides')` or `canvas3D.presenter.setEnabled(true)`.

2) **Slide selection rules**
   - This demo treats `H1` as slides. Alternatives:
     - `level <= 2` as “slides + subslides”
     - frontmatter like `slides: h1` / `slides: all`
     - metadata on headings: `{"slide": true}` or `{"slide": false}`

3) **Reliable slide IDs**
   - `canvas3D.camera.focusOnSectionFit()` can already accept a string (it resolves by title slug).
   - For stability when titles change, consider allowing explicit IDs in metadata, e.g. `{"id":"intro"}`.

4) **Host sync becomes presenter sync**
   - Engine already broadcasts `sendGotoSectionFit()` when host role is enabled.
   - A presenter mode could standardize: slide index, transition style, and maybe a “reveal step” counter.
