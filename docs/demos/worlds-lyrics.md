---
name: "Worlds Lyrics Demo"
theme: "neotopia"
---

Demonstrates the new same-card Worlds lyric flow without requiring an audio file.

- Heading `timed` directives drive active Worlds section focus.
- A global `timed` block provides lyric lines.
- `worlds.content.stateAt(...)` plus `worlds.content.set(...)` append a rolling lyric window to the active card.
- A synthetic transport with play, pause, reset, and scrub makes seek-safe behavior easy to inspect.

# Opening {"timed": "0ms"}
The room hums before the first line arrives.
Static light hangs over the stage.

# First Verse {"timed": "6000ms"}
The camera glides to the next card.
The lyric window should stay inside this same section.

# Chorus {"timed": "12000ms"}
The section changes independently from the lyric lines.
The active card should keep its authored text plus a rolling lyric block.

# Echo {"timed": "18000ms"}
Use the scrubber to jump forward and backward.
This demo is intentionally synthetic so scrubbing is deterministic.

# Outro {"timed": "24000ms"}
The lyric window narrows to the latest lines.
Then the loop returns to the opening.

```timed name:lyrics
# ms|text
0|A low signal shivers through the room.
2000|The first words rise out of the floor.
4000|Light leaks across the opening card.
6000|We step into the first verse.
8000|Every line stays on the same card.
10000|Only the lyric window keeps moving.
12000|Now the chorus takes the frame.
14000|The hook lands without rebuilding the section.
16000|The camera shift and lyric shift stay independent.
18000|Echoes collect in the rolling window.
20000|Scrub backward and the state should still resolve cleanly.
22000|Scrub forward and the same card updates in place.
24000|The outro lowers the lights.
26000|Only the newest lines remain on screen.
28000|Then the loop folds back to the start.
```

## Game Code

```js
var state = {
  isPlaying: true,
  startTime: 0,
  pauseOffset: 0,
  wasSeeking: false,

  currentLine: '',
  currentSection: '',
  currentSectionId: null,

  timedSections: [],

  panel: null,
  widgets: null,
  mouseDownLeft: false,
};

const DEMO_DURATION_SEC = 30;
const WORLDS_LYRIC_WINDOW = 3;
const WORLDS_SECTION_FILL = 0.9;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildTimedSections() {
  const all = doc.sectionsFlat();
  state.timedSections = all
    .filter((section) => section.timedMs !== undefined)
    .sort((a, b) => a.timedMs - b.timedMs);
}

function sectionAtMs(posMs) {
  const list = state.timedSections;
  if (!list.length) return null;
  let result = null;
  for (const section of list) {
    if (section.timedMs <= posMs) result = section;
    else break;
  }
  return result;
}

function getDemoTimeSec() {
  if (!state.isPlaying) return clamp(state.pauseOffset, 0, DEMO_DURATION_SEC);
  const elapsed = Math.max(0, getTime() - state.startTime);
  return elapsed % DEMO_DURATION_SEC;
}

function setDemoTimeSec(nextSec) {
  const clamped = clamp(nextSec, 0, DEMO_DURATION_SEC);
  state.pauseOffset = clamped;
  if (state.isPlaying) {
    state.startTime = getTime() - clamped;
  }
}

function playDemo() {
  state.startTime = getTime() - state.pauseOffset;
  state.isPlaying = true;
}

function pauseDemo() {
  state.pauseOffset = getDemoTimeSec();
  state.isPlaying = false;
}

function resetDemo(autoplay) {
  state.pauseOffset = 0;
  state.startTime = getTime();
  state.isPlaying = autoplay !== false;
  worlds.content?.clearAll?.();
  state.currentSectionId = null;
  state.currentSection = '';
  state.currentLine = '';
}

function lineAtTime(timeSec) {
  const entry = doc.atTime('lyrics', timeSec);
  return entry ? entry.text : '';
}

function getLyricEntries() {
  return doc.timedBlock('lyrics');
}

function getSectionWindow(section) {
  if (!section) return null;
  const list = state.timedSections;
  const startMs = Number(section.timedMs);
  if (!Number.isFinite(startMs)) return null;
  const index = list.findIndex((item) => item.index === section.index && item.timedMs === section.timedMs);
  const next = index >= 0 ? list[index + 1] : null;
  const endMs = Number.isFinite(next?.timedMs) ? Number(next.timedMs) : null;
  return { startMs, endMs };
}

function entriesForSection(section) {
  const window = getSectionWindow(section);
  if (!window) return [];
  return getLyricEntries().filter((entry) => {
    if (!Number.isFinite(entry.ms)) return false;
    if (entry.ms < window.startMs) return false;
    if (window.endMs !== null && entry.ms >= window.endMs) return false;
    return true;
  });
}

function composeWorldsSectionContent(baseContent, sampledText) {
  const base = String(baseContent || '').trim();
  const lyrics = String(sampledText || '').trim();
  if (!lyrics) return base;
  if (!base) return lyrics;
  return [base, '', '### Live Lyrics', '', lyrics].join('\n');
}

function syncWorldsSectionContent(section, posSec) {
  if (!worlds.content) return '';

  const nextLayout = section ? worlds.getSectionLayout(section.index) : null;
  const nextSectionId = nextLayout?.sectionId ?? null;

  if (state.currentSectionId && state.currentSectionId !== nextSectionId) {
    worlds.content.clear(state.currentSectionId, 'content');
  }

  if (!section || !nextSectionId) {
    state.currentSectionId = null;
    return '';
  }

  const sectionEntries = entriesForSection(section);
  const sampled = worlds.content.stateAt(sectionEntries, posSec, {
    mode: 'append',
    separator: '\n',
    maxEntries: WORLDS_LYRIC_WINDOW,
  });

  if (!sampled.text) {
    worlds.content.clear(nextSectionId, 'content');
    state.currentSectionId = nextSectionId;
    return '';
  }

  const existing = worlds.content.get(nextSectionId);
  if (!existing) return sampled.text;

  const composedContent = composeWorldsSectionContent(existing.baseContent, sampled.text);
  if (existing.overrideContent !== composedContent && existing.effectiveContent !== composedContent) {
    worlds.content.set(nextSectionId, {
      content: composedContent,
    });
  }

  state.currentSectionId = nextSectionId;
  return sampled.text;
}
```

```js on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.config.setDefaults({
  defaultSectionWidth: 88,
  defaultSectionHeight: 24,
  autoLayoutSpacing: 150,
  sectionBorderEnabled: false,
  sectionBackground: 'bg',
});

worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 10, 0.5);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSectionFit(0, WORLDS_SECTION_FILL, { keepRotation: true });

gui.init();
buildTimedSections();

const tokens = gui.getTokens();
const panel = gui.createResponsivePanel({
  bounds: { x: 0, y: 0, width: 480, height: 560 },
  padding: tokens.spacing.lg,
  gap: tokens.spacing.sm,
  maxWidth: 520,
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content' }
});

const heading = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 28 },
  text: 'Worlds Lyrics Demo',
  align: 'left',
  labelStyle: { typographyRole: 'title' },
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const status = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 20 },
  text: 'Synthetic transport running.',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const section = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 24 },
  text: 'Section: Opening',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const lyricLine = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 24 },
  text: '',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const time = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 20 },
  text: 'Time: 0:00 / 0:30',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const seek = gui.createSlider({
  bounds: { x: 0, y: 0, width: 1, height: 48 },
  label: 'Scrub',
  min: 0,
  max: DEMO_DURATION_SEC,
  value: 0,
  step: 0.1,
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnPlay = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Play',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnPause = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Pause',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnReset = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Reset',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

panel
  .add(heading)
  .add(status)
  .add(section)
  .add(lyricLine)
  .add(time)
  .add(seek)
  .add(btnPlay)
  .add(btnPause)
  .add(btnReset);

panel.layout();

state.panel = panel;
state.widgets = { heading, status, section, lyricLine, time, seek, btnPlay, btnPause, btnReset };
state.startTime = getTime();
worlds.content?.clearAll?.();
```

```js on:input
if (!event) return;
if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}
if (event.type === 'text') gui.handleText(event.text);
if (event.type === 'mouse') {
  if (event.button === 'left') state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
if (event.type === 'mouse_move') gui.handleMouse(event.x, event.y, state.mouseDownLeft);
```

```js on:update
if (!state.widgets) return;

if (state.panel) {
  const viewport = gui.getViewportRect();
  const info = gui.getResponsiveInfo({ width: viewport.width, height: viewport.height });
  const tokens = gui.getTokens();
  const compact = info.breakpoint === 'xs';
  const inset = compact ? tokens.spacing.sm : tokens.spacing.lg;
  const maxWidth = compact
    ? Math.max(300, Math.min(420, info.usableWidth || viewport.width))
    : Math.max(420, Math.min(520, info.usableWidth || viewport.width));

  state.panel.container.padding = compact ? tokens.spacing.md : tokens.spacing.lg;
  state.panel.container.gap = compact ? tokens.spacing.xs : tokens.spacing.sm;
  state.panel.setMaxWidth(maxWidth, false);
  state.panel.fitToViewport(viewport, {
    inset,
    safeArea: true,
    maxWidth,
    anchorX: 'start',
    anchorY: 'start'
  }, false);
  state.panel.layout();
}

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.btnPlay.wasClicked()) playDemo();
if (state.widgets.btnPause.wasClicked()) pauseDemo();
if (state.widgets.btnReset.wasClicked()) resetDemo(true);

const dragging = state.widgets.seek.isDragging?.() ?? false;
const livePos = getDemoTimeSec();
const previewPos = dragging ? clamp(state.widgets.seek.getValue(), 0, DEMO_DURATION_SEC) : livePos;

if (!dragging && state.wasSeeking) {
  setDemoTimeSec(clamp(state.widgets.seek.getValue(), 0, DEMO_DURATION_SEC));
}
if (!dragging) state.widgets.seek.setValue(livePos);
state.wasSeeking = dragging;

const sec = sectionAtMs(previewPos * 1000);
const secTitle = sec ? sec.title : '';
if (secTitle !== state.currentSection) {
  state.currentSection = secTitle;
  state.widgets.section.setText(`Section: ${secTitle || '(none)'}`);
  if (sec) {
    worlds.camera.focusOnSectionFit(sec.index, WORLDS_SECTION_FILL, { keepRotation: true });
  }
}

const newLine = lineAtTime(previewPos);
if (newLine !== state.currentLine) {
  state.currentLine = newLine;
  state.widgets.lyricLine.setText(newLine ? `Line: ${newLine}` : 'Line: (none)');
}

syncWorldsSectionContent(sec, previewPos);

state.widgets.time.setText(
  `${dragging ? 'Preview' : 'Time'}: ${fmtTime(previewPos)} / ${fmtTime(DEMO_DURATION_SEC)}`
);
state.widgets.status.setText(
  dragging
    ? `Scrubbing ${fmtTime(previewPos)} — the active card should update deterministically.`
    : (state.isPlaying ? 'Synthetic transport running.' : 'Paused — drag the scrubber or press Play.')
);
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();
```