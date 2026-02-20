---
title: "3D Canvas Slides (Prototype)"
theme: "neotopia"
---

# Worlds Slides (Prototype) {"x":"0","y":"0","z":"0"}

This demo tests the idea that **Worlds + Sections = a slide deck**.

Controls (presentation-style):

- Next slide: `Space`, `PageDown`, `n`
- Previous slide: `Shift+Space`, `PageUp`, `p`
- Jump: `Home` / `End`
- Overview grid: `O`
- Reveal steps (host-only): `]` next, `[` prev, `0` reset

If you disable Worlds’s built-in 3D link key handling (this demo does), you can
also use:

- Next/prev: `ArrowRight` / `ArrowLeft`

Notes:

- Worlds can use Tab/Enter/Arrow keys for **3D link focus navigation**; this demo disables that so it can use Arrow keys for slide navigation.
- We define an `on:input` handler solely so the engine calls `preventDefault()` for key events (avoids browser scrolling on Space/PageUp/PageDown).

```javascript
// === Slide deck settings ===
// Convention:
// - Slides are H1 sections by default.
// - Hidden/non-navigable sections are excluded by default.
const navRule = { scope: 'global', levels: 1, includeHidden: false };
let slideFill = 0.92;

function cleanSectionTitle(title) {
  const s = String(title ?? '');
  // Strip trailing section directive JSON like:  Slide 4 ... {"x":"0",...}
  const idx = s.lastIndexOf(' {"');
  if (idx >= 0 && s.trimEnd().endsWith('}')) return s.slice(0, idx);
  return s;
}

function gotoSlide(i) {
  worlds.nav.goto(i, { ...navRule, fill: slideFill });
}

function nextSlide() {
  worlds.nav.next({ ...navRule, fill: slideFill });
}

function prevSlide() {
  worlds.nav.prev({ ...navRule, fill: slideFill });
}
```

```javascript on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.links.setKeyHandlingEnabled(false);

// Host overlay panel (GUI layer renders above the 3D layer).
if (host.isHost) {
  gui.init();

  const panelW = 420;
  const panelH = 380;

  const panel = gui.createContainer({ bounds: { x: 0, y: 0, width: panelW, height: panelH }, padding: 12, gap: 6, alignX: 'stretch' });
  const title = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 26 }, text: 'Worlds Slides (Host)', align: 'left' });

  const slidesLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: 'Slides: --', align: 'left' });
  const keysLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: 'Next/Prev: Space/PageDown/N | Shift+Space/PageUp/P', align: 'left' });
  const overviewLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: 'Overview: off (O)', align: 'left' });
  const revealLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: 'Reveal: 0 ([ / ] / 0)', align: 'left' });

  const indexHdr = gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: 'Index (press 1-9):', align: 'left' });
  const indexLabels = [];
  for (let i = 0; i < 9; i++) {
    indexLabels.push(gui.createLabel({ bounds: { x: 0, y: 0, width: panelW, height: 22 }, text: '', align: 'left' }));
  }

  panel
    .add(title)
    .add(slidesLbl)
    .add(keysLbl)
    .add(overviewLbl)
    .add(revealLbl)
    .add(indexHdr);
  for (const lbl of indexLabels) panel.add(lbl);

  panel.layout();

  scope.__hostHud = { panel, panelW, panelH, slidesLbl, overviewLbl, revealLbl, indexLabels };
}

// Make the camera motion feel like a slide deck.
worlds.camera.setEaseSpeed(0.10, 0.16);

// Start on the first slide section after the intro (cursor 1) when present.
if (worlds.nav.count(navRule) > 0) {
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

// Optional Arrow key bindings (work best when Worlds link key handling is disabled)
const nextArrow = key.pressed('ArrowRight') || key.pressed('ArrowDown');
const prevArrow = key.pressed('ArrowLeft') || key.pressed('ArrowUp');

if ((next || nextArrow) && !(prev || prevArrow)) nextSlide();
if ((prev || prevArrow) && !(next || nextArrow)) prevSlide();

if (key.pressed('Home')) gotoSlide(0);
if (key.pressed('End')) gotoSlide(worlds.nav.count(navRule) - 1);

// Overview grid toggle (host-only; client/audience windows ignore this)
if (key.pressed('o') || key.pressed('O')) {
  worlds.overview.toggle({ levels: 'any', fill: slideFill });
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
  gotoSlide(worlds.nav.cursor(navRule) ?? 0);
}
if (key.pressed('-') || key.pressed('_')) {
  slideFill = Math.max(0.70, Math.min(0.98, slideFill - 0.02));
  gotoSlide(worlds.nav.cursor(navRule) ?? 0);
}

// Keep host HUD pinned top-right + updated.
if (host.isHost && scope.__hostHud?.panel) {
  const hud = scope.__hostHud;
  const c = worlds.nav.cursor(navRule);
  const total = worlds.nav.count(navRule);
  const list = worlds.nav.list(navRule);
  const idx = c === null ? -1 : (list[c] ?? -1);
  const outline = doc.outline();

  hud.slidesLbl.setText(`Slides: ${c === null ? 0 : (c + 1)}/${total} (section ${idx})`);
  hud.overviewLbl.setText(`Overview: ${worlds.overview.enabled ? 'ON' : 'off'} (O)`);
  hud.revealLbl.setText(`Reveal: ${scene.revealStep} ([ / ] / 0)`);

  const max = Math.min(9, list.length);
  for (let i = 0; i < 9; i++) {
    if (i >= max) {
      hud.indexLabels[i].setText('');
      continue;
    }
    const sectionIndex = list[i];
    const rawTitle = outline[sectionIndex]?.title ?? `Section ${sectionIndex}`;
    const title = cleanSectionTitle(rawTitle);
    const marker = c === i ? '>' : ' ';
    hud.indexLabels[i].setText(`${marker} ${i + 1}. ${title}`);
  }

  const w = hud.panelW;
  const h = hud.panelH;
  const margin = 12;
  const cw = ui?.metrics?.canvasWidth ?? 800;
  const x = Math.max(0, cw - w - margin);
  const y = margin;
  hud.panel.setBounds({ x, y, width: w, height: h }, true);
}
```

# Slide 1 — Sections are slides {"x":"0","y":"0","z":"-200"}

Worlds already renders Sections as 3D “cards”. For a slide deck you mostly need:

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
worlds.camera.setEaseSpeed(0.08, 0.12);
```

# Slide 4 — Layout conventions {"x":"0","y":"0","z":"-800"}

For presenter mode, you probably want a consistent layout convention, for example:

- Slides laid out along -Z at fixed spacing (like this demo)
- Or auto-layout into a grid/ring for “overview mode”

```javascript on:enter
worlds.camera.setEaseSpeed(0.10, 0.16);
```

# Appendix — Implementation suggestions {"hidden":true,"navigable":false}

If you decide to turn this into a first-class feature, some implementation ideas:

1) **Presentation keymap toggle**
   - Today, Arrow keys are reserved for Worlds link-focus navigation.
   - Consider adding something like `worlds.nav.setKeyMode('links' | 'slides')` or `worlds.presenter.setEnabled(true)`.

2) **Slide selection rules**
   - This demo treats `H1` as slides. Alternatives:
     - `level <= 2` as “slides + subslides”
     - frontmatter like `slides: h1` / `slides: all`
     - metadata on headings: `{"slide": true}` or `{"slide": false}`

3) **Reliable slide IDs**
   - `worlds.camera.focusOnSectionFit()` can already accept a string (it resolves by title slug).
   - For stability when titles change, consider allowing explicit IDs in metadata, e.g. `{"id":"intro"}`.

4) **Host sync becomes presenter sync**
   - Engine already broadcasts `sendGotoSectionFit()` when host role is enabled.
   - A presenter mode could standardize: slide index, transition style, and maybe a “reveal step” counter.
