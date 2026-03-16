---
name: "STFXR: Graph Viewer"
theme: "neotopia"
requiresAudioGesture: true
---

A basic **graph viewer** for a single `stfxr` preset.

- **Play** auditions the preset
- **Click** a node to select it
- **Drag** a node to reposition it
- **Drag empty space** to pan the view

> Note: this demo uses the WebGPU `ui` immediate-mode drawing API.

## Demo

```js
let state = {
  seed: 1337,
  volume: 0.7,

  // Graph + layout
  preset: null,
  graph: null,
  layoutById: new Map(), // id -> { x, y, w, h }

  // View
  camX: 0,
  camY: 0,

  // Panels
  rightW: 420,

  // Interaction
  mouseDownLeft: false,
  drag: null, // { mode: 'node'|'pan'|'split', id?, ox, oy, startCamX, startCamY, startRightW }
  hoveredId: null,
  selectedId: null,

  // UI widgets
  widgets: null,
  lastSelectedId: null,
  nodeJsonDirty: false,
  statusText: ''
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

function buildSelectedNodeJson(graph, selectedId) {
  if (!graph || !selectedId) return '';
  const node = graph.nodeById.get(selectedId);
  if (!node) return '';
  return JSON.stringify(node, null, 2);
}

function getPresetNodeById(id) {
  if (!state.preset || !Array.isArray(state.preset.nodes)) return null;
  for (const n of state.preset.nodes) {
    if (String(n?.id ?? '') === String(id)) return n;
  }
  return null;
}

function computeDefaultNodeSize(node) {
  const id = String(node?.id ?? '');
  const kind = String(node?.kind ?? '');
  const label = `${id}`;
  const w = Math.max(180, (label.length + Math.max(0, kind.length - 2)) * 9 + 44);
  const h = 60;
  return { w, h };
}

function buildInitialLayout(graph, bounds) {
  const auto = autoLayout(graph, bounds);
  const out = new Map(auto);

  for (const n of graph.nodes) {
    const id = String(n?.id ?? '');
    if (!id) continue;
    const cur = out.get(id) || null;
    const def = computeDefaultNodeSize(n);

    const x = Number(n?.x);
    const y = Number(n?.y);
    const nx = Number.isFinite(x) ? x : (cur ? cur.x : bounds.x);
    const ny = Number.isFinite(y) ? y : (cur ? cur.y : bounds.y);
    const nw = cur ? cur.w : def.w;
    const nh = cur ? cur.h : def.h;

    out.set(id, { x: nx, y: ny, w: nw, h: nh });
  }

  return out;
}

function writeLayoutToPreset(layout) {
  if (!state.preset || !Array.isArray(state.preset.nodes)) return;
  for (const [id, r] of layout.entries()) {
    const n = getPresetNodeById(id);
    if (!n || !r) continue;
    n.x = r.x;
    n.y = r.y;
  }
}

function applySelectedNodeJson(jsonText) {
  if (!state.preset || !state.graph || !state.selectedId) {
    state.statusText = 'No preset/node selected.';
    return false;
  }

  let parsed;
  try {
    parsed = JSON.parse(String(jsonText ?? ''));
  } catch (e) {
    state.statusText = 'Invalid JSON.';
    return false;
  }

  if (!isObject(parsed)) {
    state.statusText = 'JSON must be an object.';
    return false;
  }

  const selectedId = String(state.selectedId);
  const prev = state.graph.nodeById.get(selectedId);
  if (!prev) {
    state.statusText = 'Selected node not found.';
    return false;
  }

  // Keep identity stable for layout + edge references.
  parsed.id = selectedId;
  if (parsed.kind == null) parsed.kind = prev.kind;

  const nodes = Array.isArray(state.preset.nodes) ? state.preset.nodes : [];
  let replaced = false;
  for (let i = 0; i < nodes.length; i++) {
    if (String(nodes[i]?.id ?? '') === selectedId) {
      nodes[i] = parsed;
      replaced = true;
      break;
    }
  }
  if (!replaced) {
    nodes.push(parsed);
    state.preset.nodes = nodes;
  }

  state.graph = computeGraph(state.preset);
  {
    const b = graphBounds();
    state.layoutById = buildInitialLayout(state.graph, b.graph);
  }
  state.nodeJsonDirty = false;
  state.statusText = `Updated node ${selectedId} and replayed.`;

  // Audition immediately so changes affect sound.
  stfxr.playPreset(state.preset, state.seed, { volume: state.volume });
  return true;
}

function ensureGraphLoaded() {
  // Single-preset demo: start from built-in preset once, then keep edits.
  if (!state.preset) {
    state.preset = JSON.parse(JSON.stringify(BUILTIN_PRESET));
  }

  // Legacy cleanup: older presets may have stored w/h. Keep only x/y.
  if (state.preset && Array.isArray(state.preset.nodes)) {
    for (const n of state.preset.nodes) {
      if (n && typeof n === 'object') {
        if (Object.prototype.hasOwnProperty.call(n, 'w')) delete n.w;
        if (Object.prototype.hasOwnProperty.call(n, 'h')) delete n.h;
      }
    }
  }
  if (!state.graph) {
    state.graph = computeGraph(state.preset);
  }
  if (state.graph && (!state.selectedId || !state.graph.nodeById.has(state.selectedId))) {
    const first = state.graph.nodes[0];
    state.selectedId = first ? String(first.id) : null;
  }

  // Ensure layout exists (prefer preset node x/y when present)
  if (!state.layoutById || state.layoutById.size === 0) {
    const b = graphBounds();
    state.layoutById = buildInitialLayout(state.graph, b.graph);
  }
}

function graphBounds() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;

  const splitterW = 20;
  const minRightW = 260;
  const maxRightW = Math.max(minRightW, W - 220); // keep graph >= ~200px
  const rightW = clamp(state.rightW || 420, minRightW, maxRightW);
  state.rightW = rightW;
  const topPad = 20;
  const bottomPad = 20;
  const toolbarH = 78;

  const rightX = W - rightW + splitterW;
  const graphX = 20;
  const graphW = Math.max(200, (rightX - 20) - graphX);
  const graphH = Math.max(200, H - topPad - bottomPad - toolbarH);

  return {
    graph: { x: graphX, y: topPad, w: graphW, h: graphH },
    right: { x: rightX, y: topPad, w: rightW - 40, h: graphH },
    splitter: { x: graphX + graphW, y: topPad, w: splitterW, h: graphH },
    toolbar: { x: 20, y: topPad + graphH + 12, w: W - 40, h: toolbarH }
  };
}

function layoutToolbar() {
  if (!state.widgets) return;
  const W = ui.metrics.canvasWidth || 1280;
  const b = graphBounds();
  const y = b.toolbar.y;
  const h = b.toolbar.h;

  // Right-align volume slider.
  const volW = Math.max(220, Math.min(360, Math.floor(W * 0.28)));
  state.widgets.vol.bounds.x = b.toolbar.x + b.toolbar.w - volW;
  state.widgets.vol.bounds.y = y + 8;
  state.widgets.vol.bounds.width = volW;
  state.widgets.vol.bounds.height = h - 16;

  // Left-to-right controls.
  let x = b.toolbar.x;
  const gap = 10;
  const btnW = 92;
  const btnH = 42;
  const fieldW = 240;

  state.widgets.seedField.bounds.x = x;
  state.widgets.seedField.bounds.y = y + Math.floor((h - btnH) / 2);
  state.widgets.seedField.bounds.width = fieldW;
  state.widgets.seedField.bounds.height = btnH;
  x += fieldW + gap;

  const buttons = [state.widgets.btnRand, state.widgets.btnPlay, state.widgets.btnAuto, state.widgets.btnReset];
  for (const btn of buttons) {
    btn.bounds.x = x;
    btn.bounds.y = y + Math.floor((h - btnH) / 2);
    btn.bounds.width = btnW;
    btn.bounds.height = btnH;
    x += btnW + gap;
  }
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

// Bottom toolbar widgets
const seedField = gui.createTextField({
  bounds: { x: 20, y: 20, width: 240, height: 42 },
  value: String(state.seed),
  placeholder: 'Seed'
});

const btnRand = gui.createButton({
  bounds: { x: 270, y: 20, width: 92, height: 42 },
  label: 'Random'
});

const btnPlay = gui.createButton({
  bounds: { x: 372, y: 20, width: 92, height: 42 },
  label: 'Play'
});

const btnAuto = gui.createButton({
  bounds: { x: 474, y: 20, width: 92, height: 42 },
  label: 'Auto'
});

const btnReset = gui.createButton({
  bounds: { x: 576, y: 20, width: 92, height: 42 },
  label: 'Reset'
});

const vol = gui.createSlider({
  bounds: { x: 690, y: 20, width: 320, height: 62 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: Math.round(state.volume * 100)
});

const nodeJsonLabel = gui.createLabel({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 48, width: 380, height: 18 },
  text: 'Node JSON',
  align: 'left'
});

const nodeJson = gui.createTextEditor({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 72, width: 380, height: 160 },
  value: '',
  placeholder: '{\n  "kind": "...",\n  ...\n}'
});

const btnUpdate = gui.createButton({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 240, width: 120, height: 42 },
  label: 'Update'
});

const status = gui.createLabel({
  bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 288, width: 380, height: 18 },
  text: '',
  align: 'left'
});

state.widgets = {
  seedField,
  btnRand,
  vol,
  btnPlay,
  btnAuto,
  btnReset,
  nodeJsonLabel,
  nodeJson,
  btnUpdate,
  status
};

layoutToolbar();

// Load initial preset
ensureGraphLoaded();

// Populate initial layout (prefer preset node x/y if present)
if (state.graph) {
  const b = graphBounds();
  state.layoutById = buildInitialLayout(state.graph, b.graph);
}

// Warm audio unlock
audio.context.resume().catch(() => {});

// Seed editor with selected node JSON
if (state.graph && state.selectedId && state.widgets?.nodeJson) {
  state.widgets.nodeJson.setValue(buildSelectedNodeJson(state.graph, state.selectedId));
  state.lastSelectedId = state.selectedId;
}
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
    const inSplitter = event.x >= b.splitter.x && event.x < (b.splitter.x + b.splitter.w) &&
                       event.y >= b.splitter.y && event.y < (b.splitter.y + b.splitter.h);
    const inGraph = event.x >= b.graph.x && event.x < (b.graph.x + b.graph.w) &&
                    event.y >= b.graph.y && event.y < (b.graph.y + b.graph.h);

    if (state.mouseDownLeft && inSplitter) {
      state.drag = {
        mode: 'split',
        ox: event.x,
        startRightW: state.rightW
      };
    } else if (state.mouseDownLeft && inGraph && state.graph) {
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
    if (state.drag.mode === 'split') {
      const W = ui.metrics.canvasWidth || 1280;
      const minRightW = 260;
      const maxRightW = Math.max(minRightW, W - 220);
      const dx = event.x - state.drag.ox;
      state.rightW = clamp(state.drag.startRightW - dx, minRightW, maxRightW);
      return;
    }
    if (state.drag.mode === 'node') {
      const id = state.drag.id;
      const r = state.layoutById.get(id);
      if (r) {
        const w = viewToWorld(event.x, event.y);
        r.x = w.x - state.drag.ox;
        r.y = w.y - state.drag.oy;

        // Persist into preset node layout (optional metadata)
        const pn = getPresetNodeById(id);
        if (pn) {
          pn.x = r.x;
          pn.y = r.y;
        }
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

layoutToolbar();

// Keep inspector bounds in sync with resize.
{
  const b = graphBounds();
  const x = b.right.x;
  const y = b.right.y;
  const w = b.right.w;
  const h = b.right.h;

  const gap = 8;
  const titleH = 22;
  const labelH = 18;
  const btnH = 42;
  const statusH = 18;

  // Single inspector: editable node JSON
  const nodeEditorH = Math.max(120, h - labelH - gap - btnH - gap - statusH);

  const nodeLabelY = y;
  state.widgets.nodeJsonLabel.bounds.x = x;
  state.widgets.nodeJsonLabel.bounds.y = nodeLabelY;
  state.widgets.nodeJsonLabel.bounds.width = w;
  state.widgets.nodeJsonLabel.bounds.height = labelH;

  state.widgets.nodeJson.bounds.x = x;
  state.widgets.nodeJson.bounds.y = nodeLabelY + labelH + gap;
  state.widgets.nodeJson.bounds.width = w;
  state.widgets.nodeJson.bounds.height = nodeEditorH;

  const btnY = nodeLabelY + labelH + gap + nodeEditorH + gap;
  state.widgets.btnUpdate.bounds.x = x;
  state.widgets.btnUpdate.bounds.y = btnY;
  state.widgets.btnUpdate.bounds.width = 120;
  state.widgets.btnUpdate.bounds.height = btnH;

  state.widgets.status.bounds.x = x;
  state.widgets.status.bounds.y = btnY + btnH + gap;
  state.widgets.status.bounds.width = w;
  state.widgets.status.bounds.height = statusH;
}

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

if (state.widgets.btnAuto.wasClicked()) {
  if (state.graph) {
    const b = graphBounds();
    state.layoutById = autoLayout(state.graph, b.graph);
    writeLayoutToPreset(state.layoutById);
    state.statusText = 'Auto layout applied (saved into node x/y).';
  }
}

if (state.widgets.btnReset.wasClicked()) {
  state.camX = 0;
  state.camY = 0;
}

if (state.widgets.btnPlay.wasClicked()) {
  if (state.preset) stfxr.playPreset(state.preset, state.seed, { volume: state.volume });
}

// Node JSON editor dirty tracking
if (state.widgets.nodeJson.wasChanged()) {
  state.nodeJsonDirty = true;
}

// If selection changed, refresh node JSON editor (unless user is mid-edit)
if (state.selectedId !== state.lastSelectedId) {
  const canOverwrite = !state.nodeJsonDirty;
  if (canOverwrite && state.graph) {
    state.widgets.nodeJson.setValue(buildSelectedNodeJson(state.graph, state.selectedId));
    state.nodeJsonDirty = false;
  }
  state.lastSelectedId = state.selectedId;
}

// Update label
{
  const id = state.selectedId ? String(state.selectedId) : '(none)';
  state.widgets.nodeJsonLabel.setText(`Node JSON — ${id}`);
}

// Apply node JSON to preset + replay
if (state.widgets.btnUpdate.wasClicked()) {
  const ok = applySelectedNodeJson(state.widgets.nodeJson.getValue());
  if (ok && state.graph) {
    // Keep editor reflecting canonical applied JSON.
    state.widgets.nodeJson.setValue(buildSelectedNodeJson(state.graph, state.selectedId));
  }
}

state.widgets.status.setText(state.statusText);
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();

ensureGraphLoaded();

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

// Splitter handle
{
  const s = b.splitter;
  const bg = rgba01(255, 255, 255, 0.03);
  const edge = rgba01(255, 255, 255, 0.10);
  ui.rect(s.x, s.y, s.w, s.h, bg);
  ui.rect(s.x + Math.floor(s.w / 2), s.y + 10, 1, Math.max(0, s.h - 20), edge);
}

// Graph frame
{
  const frame = rgba01(255, 255, 255, 0.10);
  ui.rect(b.graph.x, b.graph.y, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y + b.graph.h - 1, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y, 1, b.graph.h, frame);
  ui.rect(b.graph.x + b.graph.w - 1, b.graph.y, 1, b.graph.h, frame);
}
```
