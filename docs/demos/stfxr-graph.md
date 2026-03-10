---
name: "STFXR: Graph Viewer"
theme: "neotopia"
---

A basic **graph viewer** for `stfxr` presets embedded in this document.

- **Prev/Next** cycles presets from `stfxr.list()`
- **Play** auditions the currently selected preset
- **Click** a node to select it
- **Drag** a node to reposition it
- **Drag empty space** to pan the view

> Note: this demo uses the WebGPU `ui` immediate-mode drawing API.

## Demo

```js
let state = {
  presetNames: [],
  presetIndex: 0,
  seed: 1337,
  volume: 0.7,

  // Graph + layout
  preset: null,
  graph: null,
  layoutById: new Map(), // id -> { x, y, w, h }

  // View
  camX: 0,
  camY: 0,

  // Interaction
  mouseDownLeft: false,
  drag: null, // { mode: 'node'|'pan', id?, ox, oy, startCamX, startCamY }
  hoveredId: null,
  selectedId: null,

  // UI widgets
  widgets: null,
  lastInspector: ''
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function rgba01(r, g, b, a01) {
  const a = Math.round(clamp(Number(a01), 0, 1) * 255);
  return ui.colors.rgba(r, g, b, a);
}

function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

const BUILTIN_PRESET_NAME = '__builtin__:beep';
const BUILTIN_PRESET = {
  nodes: [
    { kind: 'oscVoice', id: 'v', oscType: 'sine', freqHz: 440, gain: 0.28, stopAfter: 1.1 },
    { kind: 'lfo', id: 'lfo1', oscType: 'sine', freqHz: 5, gain: 60, stopAfter: 1.1 },
    { kind: 'filter', id: 'lp', filterType: 'lowpass', freqHz: 1800, q: 0.7 },
    { kind: 'gain', id: 'amp', gain: 0.9 }
  ],
  edges: [
    { from: 'v', to: 'lp' },
    { from: 'lp', to: 'amp' },
    { from: 'amp', to: 'out' },
    { from: 'lfo1', to: 'v.freqHz' }
  ],
  events: [
    { kind: 'envAR', node: 'amp', attack: 0.01, release: 0.25, peak: 1.0, at: 0 }
  ]
};

function shortExpr(expr) {
  if (typeof expr === 'number' || typeof expr === 'string') return String(expr);
  if (!isObject(expr)) return String(expr);
  const k = expr.kind;
  if (k === 'var') return `$${expr.name}`;
  if (k === 'rand') return `rand(${expr.min}, ${expr.max})`;
  if (k === 'choice') return `choice(${(expr.values || []).join(', ')})`;
  if (k === 'add' || k === 'sub' || k === 'mul' || k === 'div') return `(${shortExpr(expr.a)} ${k} ${shortExpr(expr.b)})`;
  return JSON.stringify(expr);
}

function computeGraph(preset) {
  const nodes = Array.isArray(preset?.nodes) ? preset.nodes.slice() : [];
  const edges = Array.isArray(preset?.edges) ? preset.edges.slice() : [];
  const events = Array.isArray(preset?.events) ? preset.events.slice() : [];

  const nodeById = new Map();
  for (const n of nodes) {
    if (n && n.id) nodeById.set(String(n.id), n);
  }

  let needsOut = false;
  for (const e of edges) {
    if (String(e?.to) === 'out') needsOut = true;
  }
  if (needsOut && !nodeById.has('out')) {
    nodeById.set('out', { kind: 'out', id: 'out' });
  }

  // Partition edges into audio edges (node->node/out) vs param edges (node->node.param)
  const audioEdges = [];
  const paramEdges = [];

  for (const e of edges) {
    const from = String(e?.from ?? '');
    const toRaw = String(e?.to ?? '');
    if (!from || !toRaw) continue;

    const dot = toRaw.indexOf('.');
    if (dot >= 0) {
      const to = toRaw.slice(0, dot);
      const param = toRaw.slice(dot + 1);
      paramEdges.push({ ...e, to, param, toRaw });
      continue;
    }

    audioEdges.push({ ...e, to: toRaw });
  }

  // Build adjacency for topo-ish layout using only audio edges.
  const ids = Array.from(nodeById.keys());
  const indeg = new Map(ids.map(id => [id, 0]));
  const out = new Map(ids.map(id => [id, []]));

  for (const e of audioEdges) {
    const a = String(e.from);
    const b = String(e.to);
    if (!nodeById.has(a) || !nodeById.has(b)) continue;
    out.get(a).push(b);
    indeg.set(b, (indeg.get(b) || 0) + 1);
  }

  // Kahn order
  const q = [];
  for (const id of ids) {
    if ((indeg.get(id) || 0) === 0) q.push(id);
  }

  const order = [];
  const indeg2 = new Map(indeg);
  while (q.length) {
    const id = q.shift();
    order.push(id);
    for (const b of out.get(id) || []) {
      indeg2.set(b, (indeg2.get(b) || 0) - 1);
      if ((indeg2.get(b) || 0) === 0) q.push(b);
    }
  }

  // If cycle, append remaining in stable order.
  if (order.length < ids.length) {
    const seen = new Set(order);
    for (const id of ids) if (!seen.has(id)) order.push(id);
  }

  // Compute levels from order.
  const level = new Map(ids.map(id => [id, 0]));
  for (const id of order) {
    const l = level.get(id) || 0;
    for (const b of out.get(id) || []) {
      level.set(b, Math.max(level.get(b) || 0, l + 1));
    }
  }

  const nodesOut = order.map(id => nodeById.get(id));

  return {
    nodeById,
    nodes: nodesOut,
    audioEdges,
    paramEdges,
    events,
    level
  };
}

function autoLayout(graph, bounds) {
  const pad = 24;
  const colW = 260;
  const rowH = 88;

  // Group by level.
  const groups = new Map();
  for (const n of graph.nodes) {
    const id = String(n.id);
    const l = graph.level.get(id) || 0;
    const arr = groups.get(l) || [];
    arr.push(id);
    groups.set(l, arr);
  }

  const levels = Array.from(groups.keys()).sort((a, b) => a - b);
  const layout = new Map();

  for (let li = 0; li < levels.length; li++) {
    const l = levels[li];
    const ids = groups.get(l) || [];

    for (let ri = 0; ri < ids.length; ri++) {
      const id = ids[ri];
      const n = graph.nodeById.get(id);
      const label = `${id}`;
      const kind = String(n?.kind ?? '');

      const w = Math.max(180, (label.length + Math.max(0, kind.length - 2)) * 9 + 44);
      const h = 60;

      const x = bounds.x + pad + li * colW;
      const y = bounds.y + pad + ri * rowH;

      layout.set(id, { x, y, w, h });
    }
  }

  return layout;
}

function hitTest(layoutById, x, y) {
  // Iterate in insertion order so later nodes are "on top" if we reinsert.
  let hit = null;
  for (const [id, r] of layoutById.entries()) {
    if (!r) continue;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
      hit = id;
    }
  }
  return hit;
}

function drawLine(ui, x0, y0, x1, y1, color, thickness = 1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);

  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  const stamp = (x, y) => {
    if (thickness <= 1) {
      ui.rect(x, y, 1, 1, color);
      return;
    }
    const t = Math.max(1, Math.floor(thickness));
    const o = Math.floor(t / 2);
    ui.rect(x - o, y - o, t, t, color);
  };

  while (true) {
    stamp(x0, y0);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function edgePoints(layout, fromId, toId) {
  const a = layout.get(fromId);
  const b = layout.get(toId);
  if (!a || !b) return null;

  const x0 = a.x + a.w;
  const y0 = a.y + a.h * 0.5;
  const x1 = b.x;
  const y1 = b.y + b.h * 0.5;
  return { x0, y0, x1, y1 };
}

function paramTargetPoint(layout, toId, param) {
  const b = layout.get(toId);
  if (!b) return null;

  // Stack param ports down the left edge.
  const portX = b.x;
  const baseY = b.y + 18;
  const hStep = 12;
  const hash = String(param ?? '')
    .split('')
    .reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const slot = hash % 6;

  return { x: portX, y: baseY + slot * hStep };
}

function buildInspectorText(graph, layout, selectedId) {
  if (!graph || !selectedId) return 'Select a node to inspect.';

  const node = graph.nodeById.get(selectedId);
  if (!node) return `Unknown node: ${selectedId}`;

  const inbound = [];
  const outbound = [];
  for (const e of graph.audioEdges) {
    if (String(e.to) === selectedId) inbound.push(e);
    if (String(e.from) === selectedId) outbound.push(e);
  }
  for (const e of graph.paramEdges) {
    if (String(e.to) === selectedId) inbound.push({ from: e.from, to: `${e.to}.${e.param}` });
    if (String(e.from) === selectedId) outbound.push({ from: e.from, to: `${e.to}.${e.param}` });
  }

  const targetingEvents = (graph.events || []).filter(ev => String(ev?.node ?? '') === selectedId);

  const lines = [];
  lines.push(`# ${selectedId}`);
  lines.push(`kind: ${String(node.kind ?? '')}`);

  const r = layout.get(selectedId);
  if (r) lines.push(`pos: (${Math.round(r.x)}, ${Math.round(r.y)})  size: (${Math.round(r.w)}x${Math.round(r.h)})`);

  lines.push('');
  lines.push('## Node');

  // A lightly "pretty" version of the node.
  const nodeCopy = JSON.parse(JSON.stringify(node));
  for (const k of Object.keys(nodeCopy)) {
    const v = nodeCopy[k];
    if (isObject(v) && v.kind) nodeCopy[k] = shortExpr(v);
  }
  lines.push(JSON.stringify(nodeCopy, null, 2));

  lines.push('');
  lines.push(`## Inbound (${inbound.length})`);
  for (const e of inbound) lines.push(`- ${e.from} → ${e.to}`);

  lines.push('');
  lines.push(`## Outbound (${outbound.length})`);
  for (const e of outbound) lines.push(`- ${e.from} → ${e.to}`);

  lines.push('');
  lines.push(`## Events (${targetingEvents.length})`);
  for (const ev of targetingEvents) lines.push(`- ${ev.kind}`);

  return lines.join('\n');
}

function ensurePresetLoaded() {
  if (!state.presetNames || state.presetNames.length === 0) {
    const listed = stfxr.list();
    state.presetNames = [BUILTIN_PRESET_NAME, ...listed.filter(n => String(n) !== BUILTIN_PRESET_NAME)];
    state.presetIndex = 0;
  } else if (state.presetNames[0] !== BUILTIN_PRESET_NAME) {
    const dedup = state.presetNames.filter(n => String(n) !== BUILTIN_PRESET_NAME);
    state.presetNames = [BUILTIN_PRESET_NAME, ...dedup];
  }

  const presetName = state.presetNames[state.presetIndex] || null;
  const preset = (presetName === BUILTIN_PRESET_NAME)
    ? BUILTIN_PRESET
    : (presetName ? stfxr.get(presetName) : null);

  state.preset = preset;
  state.graph = preset ? computeGraph(preset) : null;

  // Default selection
  if (state.graph && (!state.selectedId || !state.graph.nodeById.has(state.selectedId))) {
    const first = state.graph.nodes[0];
    state.selectedId = first ? String(first.id) : null;
  }
}

function graphBounds() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;

  const leftW = 320;
  const rightW = 420;
  const topPad = 20;

  return {
    left: { x: 20, y: topPad, w: leftW - 40, h: H - topPad - 40 },
    graph: { x: leftW, y: topPad, w: Math.max(200, W - leftW - rightW), h: H - topPad - 40 },
    right: { x: W - rightW + 20, y: topPad, w: rightW - 40, h: H - topPad - 40 }
  };
}

function viewToWorld(x, y) {
  return { x: x - state.camX, y: y - state.camY };
}

function worldToView(x, y) {
  return { x: x + state.camX, y: y + state.camY };
}
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

// Widgets (left panel)
const title = gui.createLabel({
  bounds: { x: 20, y: 20, width: 280, height: 26 },
  text: 'STFXR Graph Viewer',
  align: 'left'
});

const presetLbl = gui.createLabel({
  bounds: { x: 20, y: 54, width: 280, height: 22 },
  text: 'Preset: (none)',
  align: 'left'
});

const btnPrev = gui.createButton({
  bounds: { x: 20, y: 84, width: 130, height: 44 },
  label: 'Prev'
});

const btnNext = gui.createButton({
  bounds: { x: 170, y: 84, width: 130, height: 44 },
  label: 'Next'
});

const seedField = gui.createTextField({
  bounds: { x: 20, y: 140, width: 280, height: 44 },
  value: String(state.seed),
  placeholder: 'Seed (number or string)'
});

const btnRand = gui.createButton({
  bounds: { x: 20, y: 194, width: 280, height: 44 },
  label: 'Randomize Seed'
});

const vol = gui.createSlider({
  bounds: { x: 20, y: 250, width: 280, height: 52 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: Math.round(state.volume * 100)
});

const btnPlay = gui.createButton({
  bounds: { x: 20, y: 312, width: 280, height: 44 },
  label: 'Play'
});

const btnLayout = gui.createButton({
  bounds: { x: 20, y: 366, width: 280, height: 44 },
  label: 'Auto Layout'
});

const btnResetView = gui.createButton({
  bounds: { x: 20, y: 420, width: 280, height: 44 },
  label: 'Reset View'
});

const hint = gui.createLabel({
  bounds: { x: 20, y: 474, width: 280, height: 44 },
  text: 'Click node: inspect\nDrag node: move\nDrag empty: pan',
  align: 'left'
});

// Right panel inspector
const inspectorTitle = gui.createLabel({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 20, width: 380, height: 22 },
  text: 'Inspector',
  align: 'left'
});

const inspector = gui.createTextEditor({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 48, width: 380, height: Math.max(220, (ui.metrics.canvasHeight || 720) - 88) },
  value: 'Loading…',
  placeholder: 'Select a node'
});

state.widgets = {
  title,
  presetLbl,
  btnPrev,
  btnNext,
  seedField,
  btnRand,
  vol,
  btnPlay,
  btnLayout,
  btnResetView,
  hint,
  inspectorTitle,
  inspector
};

// Load initial preset
ensurePresetLoaded();

// Populate default layout
if (state.graph) {
  const b = graphBounds();
  state.layoutById = autoLayout(state.graph, b.graph);
}

// Warm audio unlock
audio.context.resume().catch(() => {});
```

```js on:input
if (!event) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt'),
    meta: (event.mods || []).includes('meta')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';

    const b = graphBounds();
    const inGraph = event.x >= b.graph.x && event.x < (b.graph.x + b.graph.w) &&
                    event.y >= b.graph.y && event.y < (b.graph.y + b.graph.h);

    if (state.mouseDownLeft && inGraph && state.graph) {
      const w = viewToWorld(event.x, event.y);
      const hit = hitTest(state.layoutById, w.x, w.y);
      state.hoveredId = hit;
      state.selectedId = hit;

      if (hit) {
        const r = state.layoutById.get(hit);
        state.drag = {
          mode: 'node',
          id: hit,
          ox: w.x - r.x,
          oy: w.y - r.y
        };
        // Bring to front
        state.layoutById.delete(hit);
        state.layoutById.set(hit, r);
      } else {
        state.drag = {
          mode: 'pan',
          ox: event.x,
          oy: event.y,
          startCamX: state.camX,
          startCamY: state.camY
        };
      }
    }

    if (!state.mouseDownLeft) {
      state.drag = null;
    }
  }

  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);

  const b = graphBounds();
  const inGraph = event.x >= b.graph.x && event.x < (b.graph.x + b.graph.w) &&
                  event.y >= b.graph.y && event.y < (b.graph.y + b.graph.h);

  if (inGraph && state.graph) {
    const w = viewToWorld(event.x, event.y);
    state.hoveredId = hitTest(state.layoutById, w.x, w.y);
  } else {
    state.hoveredId = null;
  }

  if (state.mouseDownLeft && state.drag) {
    if (state.drag.mode === 'node') {
      const id = state.drag.id;
      const r = state.layoutById.get(id);
      if (r) {
        const w = viewToWorld(event.x, event.y);
        r.x = w.x - state.drag.ox;
        r.y = w.y - state.drag.oy;
      }
    }
    if (state.drag.mode === 'pan') {
      const dx = event.x - state.drag.ox;
      const dy = event.y - state.drag.oy;
      state.camX = state.drag.startCamX + dx;
      state.camY = state.drag.startCamY + dy;
    }
  }
}
```

```js on:update
if (!state.widgets) return;

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

// Keep inspector bounds in sync with resize.
{
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  state.widgets.inspectorTitle.bounds.x = W - 420 + 20;
  state.widgets.inspector.bounds.x = W - 420 + 20;
  state.widgets.inspector.bounds.height = Math.max(220, H - 88);
}

// Refresh preset list if needed.
if (!state.presetNames || state.presetNames.length === 0) {
  const listed = stfxr.list();
  state.presetNames = [BUILTIN_PRESET_NAME, ...listed.filter(n => String(n) !== BUILTIN_PRESET_NAME)];
  state.presetIndex = 0;
} else if (state.presetNames[0] !== BUILTIN_PRESET_NAME) {
  const dedup = state.presetNames.filter(n => String(n) !== BUILTIN_PRESET_NAME);
  state.presetNames = [BUILTIN_PRESET_NAME, ...dedup];
}

const presetName = state.presetNames[state.presetIndex] || null;
state.widgets.presetLbl.setText(`Preset: ${presetName ?? '(none)'}   nodes: ${state.graph?.nodes?.length ?? 0}`);

// Seed handling
if (state.widgets.seedField.wasChanged()) {
  const raw = String(state.widgets.seedField.getValue() ?? '').trim();
  const asNum = Number(raw);
  state.seed = (raw && Number.isFinite(asNum)) ? asNum : (raw || 0);
}

if (state.widgets.btnRand.wasClicked()) {
  // Prefer deterministic seed helper if present.
  if (typeof random?.seed === 'function') {
    state.seed = random.seed();
  } else {
    state.seed = Math.floor(Math.random() * 0x7fffffff);
  }
  state.widgets.seedField.setValue(String(state.seed));
}

state.volume = clamp((state.widgets.vol.getValue() || 0) / 100, 0, 1);

// Preset navigation
let changedPreset = false;
if (state.widgets.btnPrev.wasClicked()) {
  state.presetIndex = (state.presetIndex - 1 + state.presetNames.length) % Math.max(1, state.presetNames.length);
  changedPreset = true;
}
if (state.widgets.btnNext.wasClicked()) {
  state.presetIndex = (state.presetIndex + 1) % Math.max(1, state.presetNames.length);
  changedPreset = true;
}

if (changedPreset) {
  ensurePresetLoaded();
  if (state.graph) {
    const b = graphBounds();
    state.layoutById = autoLayout(state.graph, b.graph);
  }
  state.camX = 0;
  state.camY = 0;
}

if (state.widgets.btnLayout.wasClicked()) {
  if (state.graph) {
    const b = graphBounds();
    state.layoutById = autoLayout(state.graph, b.graph);
  }
}

if (state.widgets.btnResetView.wasClicked()) {
  state.camX = 0;
  state.camY = 0;
}

if (state.widgets.btnPlay.wasClicked()) {
  if (presetName === BUILTIN_PRESET_NAME) {
    stfxr.playPreset(BUILTIN_PRESET, state.seed, { volume: state.volume });
  } else if (presetName) {
    stfxr.play(presetName, state.seed, { volume: state.volume });
  }
}

// Inspector refresh (only when needed)
{
  const next = buildInspectorText(state.graph, state.layoutById, state.selectedId);
  if (next !== state.lastInspector) {
    state.lastInspector = next;
    state.widgets.inspector.setValue(next);
  }
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();

ensurePresetLoaded();

const b = graphBounds();

// Graph background
ui.rect(b.graph.x, b.graph.y, b.graph.w, b.graph.h, rgba01(255, 255, 255, 0.03));

// Clip to graph area
ui.pushClipRect(b.graph.x, b.graph.y, b.graph.w, b.graph.h);

// Grid (subtle)
{
  const grid = rgba01(255, 255, 255, 0.04);
  const step = 80;
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  for (let x = ((b.graph.x + state.camX) % step) - step; x < W; x += step) {
    ui.rect(x, b.graph.y, 1, b.graph.h, grid);
  }
  for (let y = ((b.graph.y + state.camY) % step) - step; y < H; y += step) {
    ui.rect(b.graph.x, y, b.graph.w, 1, grid);
  }
}

if (!state.graph) {
  ui.text('No stfxr presets found in this document.', b.graph.x + 24, b.graph.y + 24, ui.colors.rgb(220, 220, 220));
  ui.popClipRect();
  return;
}

// Draw edges first (under nodes)
{
  const edgeColor = rgba01(220, 220, 220, 0.35);
  const modColor = rgba01(120, 180, 255, 0.35);

  for (const e of state.graph.audioEdges) {
    const from = String(e.from);
    const to = String(e.to);
    const pts = edgePoints(state.layoutById, from, to);
    if (!pts) continue;

    const a = worldToView(pts.x0, pts.y0);
    const c = worldToView(pts.x1, pts.y1);
    drawLine(ui, a.x, a.y, c.x, c.y, edgeColor, 2);
  }

  for (const e of state.graph.paramEdges) {
    const from = String(e.from);
    const to = String(e.to);
    const param = String(e.param ?? '');
    const aRect = state.layoutById.get(from);
    if (!aRect) continue;

    const tp = paramTargetPoint(state.layoutById, to, param);
    if (!tp) continue;

    const x0 = aRect.x + aRect.w;
    const y0 = aRect.y + aRect.h * 0.5;

    const a = worldToView(x0, y0);
    const c = worldToView(tp.x, tp.y);

    drawLine(ui, a.x, a.y, c.x, c.y, modColor, 2);

    // Small param label near the target port.
    ui.text(param, c.x + 6, c.y - 8, rgba01(160, 210, 255, 0.65));
  }
}

// Draw nodes
{
  const border = rgba01(255, 255, 255, 0.18);
  const hover = rgba01(255, 255, 255, 0.10);
  const selected = rgba01(120, 180, 255, 0.18);

  for (const [id, r] of state.layoutById.entries()) {
    const n = state.graph.nodeById.get(id);
    if (!n || !r) continue;

    const v = worldToView(r.x, r.y);
    const isSel = state.selectedId === id;
    const isHover = state.hoveredId === id;

    const bg = isSel ? selected : isHover ? hover : rgba01(0, 0, 0, 0.25);

    ui.rect(v.x, v.y, r.w, r.h, bg);
    ui.rect(v.x, v.y, r.w, 1, border);
    ui.rect(v.x, v.y + r.h - 1, r.w, 1, border);
    ui.rect(v.x, v.y, 1, r.h, border);
    ui.rect(v.x + r.w - 1, v.y, 1, r.h, border);

    const idText = String(id);
    const kindText = String(n.kind ?? '');

    ui.text(idText, v.x + 10, v.y + 10, ui.colors.rgb(240, 240, 240));
    if (kindText) {
      ui.text(kindText, v.x + 10, v.y + 30, rgba01(200, 200, 200, 0.7));
    }

    // Draw a small left-side port hint (audio in)
    ui.rect(v.x - 2, v.y + r.h * 0.5 - 2, 4, 4, rgba01(255, 255, 255, 0.25));
    // Right-side port hint (audio out)
    ui.rect(v.x + r.w - 2, v.y + r.h * 0.5 - 2, 4, 4, rgba01(255, 255, 255, 0.25));

    // Subtle in-node connector: input -> output
    ui.rect(v.x + 2, Math.round(v.y + r.h * 0.5), Math.max(0, r.w - 4), 1, rgba01(255, 255, 255, 0.08));
  }
}

ui.popClipRect();

// Graph frame
{
  const frame = rgba01(255, 255, 255, 0.10);
  ui.rect(b.graph.x, b.graph.y, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y + b.graph.h - 1, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y, 1, b.graph.h, frame);
  ui.rect(b.graph.x + b.graph.w - 1, b.graph.y, 1, b.graph.h, frame);
}
```
