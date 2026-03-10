---
name: "STFXR: Edit (playPreset)"
theme: "neotopia"
---

A minimal **STFXR graph editor** demo that exercises the new `stfxr.playPreset(preset, seed, options)` API.

- Left: preset picker + seed/volume + Play/Apply/Revert
- Center: live graph visualization of the current draft preset
- Right: edit the preset JSON and hit **Apply**

> This is intentionally basic: JSON editing first, then we can add per-node parameter widgets.

## Demo

```js
let state = {
  presetNames: [],
  presetIndex: 0,

  seed: 1337,
  volume: 0.7,

  // Original preset from stfxr.get(name)
  basePreset: null,
  // Current editable draft (SfxGraphPreset shape)
  draftPreset: null,

  graph: null,
  layoutById: new Map(),

  camX: 0,
  camY: 0,

  mouseDownLeft: false,
  drag: null,
  hoveredId: null,
  selectedId: null,

  widgets: null,
  statusText: 'Ready',

  lastEditorText: '',

  // Inspector bindings (selected node -> editable fields)
  inspectorBindings: [],
  lastInspectedId: null
};

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

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function isObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function rgba01(r, g, b, a01) {
  const a = Math.round(clamp(Number(a01), 0, 1) * 255);
  return ui.colors.rgba(r, g, b, a);
}

function isEditorDirty() {
  if (!state.widgets?.editor) return false;
  const cur = String(state.widgets.editor.getValue() ?? '');
  return cur !== String(state.lastEditorText ?? '');
}

function exprToText(expr) {
  if (expr === undefined || expr === null) return '';
  if (typeof expr === 'number' || typeof expr === 'string') return String(expr);
  try { return JSON.stringify(expr); } catch { return String(expr); }
}

function parseExprText(text) {
  const t = String(text ?? '').trim();
  if (!t) return { kind: 'empty' };

  const first = t[0];
  if (first === '{' || first === '[') {
    try { return { kind: 'value', value: JSON.parse(t) }; } catch { /* fallthrough */ }
  }

  // Only treat as number if it looks numeric.
  if (/^[+-]?(?:\d+\.?\d*|\d*\.?\d+)(?:[eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return { kind: 'value', value: n };
  }

  return { kind: 'value', value: t };
}

function getDraftNodeById(nodeId) {
  const nodes = Array.isArray(state.draftPreset?.nodes) ? state.draftPreset.nodes : [];
  const id = String(nodeId ?? '');
  for (const n of nodes) if (String(n?.id ?? '') === id) return n;
  return null;
}

function syncEditorFromDraft(force) {
  if (!state.widgets?.editor) return;
  if (!force && isEditorDirty()) return;
  const text = state.draftPreset ? JSON.stringify(state.draftPreset, null, 2) : '';
  state.lastEditorText = text;
  state.widgets.editor.setValue(text);
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
  if (needsOut && !nodeById.has('out')) nodeById.set('out', { kind: 'out', id: 'out' });

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
    } else {
      audioEdges.push({ ...e, to: toRaw });
    }
  }

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

  const q = [];
  for (const id of ids) if ((indeg.get(id) || 0) === 0) q.push(id);

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

  if (order.length < ids.length) {
    const seen = new Set(order);
    for (const id of ids) if (!seen.has(id)) order.push(id);
  }

  const level = new Map(ids.map(id => [id, 0]));
  for (const id of order) {
    const l = level.get(id) || 0;
    for (const b of out.get(id) || []) level.set(b, Math.max(level.get(b) || 0, l + 1));
  }

  return { nodeById, nodes: order.map(id => nodeById.get(id)), audioEdges, paramEdges, events, level };
}

function autoLayout(graph, bounds) {
  const pad = 24;
  const colW = 260;
  const rowH = 88;

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
      const kind = String(n?.kind ?? '');
      const w = Math.max(180, (String(id).length + Math.max(0, kind.length - 2)) * 9 + 44);
      const h = 60;
      const x = bounds.x + pad + li * colW;
      const y = bounds.y + pad + ri * rowH;
      layout.set(id, { x, y, w, h });
    }
  }

  return layout;
}

function hitTest(layoutById, x, y) {
  let hit = null;
  for (const [id, r] of layoutById.entries()) {
    if (!r) continue;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = id;
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
    if (thickness <= 1) return ui.rect(x, y, 1, 1, color);
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
  return {
    x0: a.x + a.w,
    y0: a.y + a.h * 0.5,
    x1: b.x,
    y1: b.y + b.h * 0.5
  };
}

function paramTargetPoint(layout, toId, param) {
  const b = layout.get(toId);
  if (!b) return null;
  const portX = b.x;
  const baseY = b.y + 18;
  const hStep = 12;
  const hash = String(param ?? '').split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const slot = hash % 6;
  return { x: portX, y: baseY + slot * hStep };
}

function graphBounds() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;

  const leftW = 320;
  const rightW = 520;
  const top = 20;

  return {
    graph: { x: leftW, y: top, w: Math.max(240, W - leftW - rightW), h: H - top - 40 }
  };
}

function viewToWorld(x, y) { return { x: x - state.camX, y: y - state.camY }; }
function worldToView(x, y) { return { x: x + state.camX, y: y + state.camY }; }

function refreshGraphAndLayout(forceLayout) {
  state.graph = state.draftPreset ? computeGraph(state.draftPreset) : null;
  if (!state.graph) {
    state.layoutById = new Map();
    state.selectedId = null;
    state.lastInspectedId = null;
    return;
  }

  if (!state.selectedId || !state.graph.nodeById.has(state.selectedId)) {
    const first = state.graph.nodes[0];
    state.selectedId = first ? String(first.id) : null;
  }

  if (forceLayout || !state.layoutById || state.layoutById.size === 0) {
    const b = graphBounds();
    state.layoutById = autoLayout(state.graph, b.graph);
  }
}

function loadBasePresetByIndex() {
  if (!state.presetNames || state.presetNames.length === 0) {
    const listed = stfxr.list();
    state.presetNames = [BUILTIN_PRESET_NAME, ...listed.filter(n => String(n) !== BUILTIN_PRESET_NAME)];
  } else if (state.presetNames[0] !== BUILTIN_PRESET_NAME) {
    const dedup = state.presetNames.filter(n => String(n) !== BUILTIN_PRESET_NAME);
    state.presetNames = [BUILTIN_PRESET_NAME, ...dedup];
  }

  const presetName = state.presetNames[state.presetIndex] || null;
  if (presetName === BUILTIN_PRESET_NAME) state.basePreset = BUILTIN_PRESET;
  else state.basePreset = presetName ? stfxr.get(presetName) : null;

  // Clone by JSON roundtrip (safe in sandbox)
  state.draftPreset = state.basePreset ? JSON.parse(JSON.stringify(state.basePreset)) : null;

  refreshGraphAndLayout(true);

  syncEditorFromDraft(true);
  state.statusText = presetName ? `Loaded: ${presetName}` : 'No preset found.';
}

function tryApplyEditor() {
  const raw = String(state.widgets.editor.getValue() ?? '');
  if (!raw.trim()) {
    state.statusText = 'Editor is empty.';
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    // Allow wrapper form { preset: { ... } }
    const normalized = (parsed && typeof parsed === 'object' && parsed.preset) ? parsed.preset : parsed;
    state.draftPreset = normalized;
    // Normalize editor text to the draft we just accepted.
    state.lastEditorText = state.draftPreset ? JSON.stringify(state.draftPreset, null, 2) : '';
    state.widgets.editor.setValue(state.lastEditorText);
    refreshGraphAndLayout(false);
    state.statusText = 'Applied JSON to draft.';
  } catch (e) {
    state.statusText = `JSON parse failed: ${String(e?.message ?? e)}`;
  }
}

function setWidgetVisible(w, v) {
  if (!w) return;
  if (w.state) w.state.visible = !!v;
}

function setWidgetEnabled(w, v) {
  if (!w) return;
  if (w.state) w.state.enabled = !!v;
}

function updateInspectorUI() {
  if (!state.widgets) return;

  const id = state.selectedId ? String(state.selectedId) : null;
  const node = id ? getDraftNodeById(id) : null;

  if (!id) {
    state.widgets.inspectorHeader.setText('Selected: (none)');
  } else if (!node) {
    state.widgets.inspectorHeader.setText(`Selected: ${id} (not editable)`);
  } else {
    state.widgets.inspectorHeader.setText(`Selected: ${id} (${String(node.kind ?? '')})`);
  }

  const schema = node ? inspectorSchemaForNode(node) : [];
  state.inspectorBindings = schema.slice(0, 4);

  for (let i = 0; i < 4; i++) {
    const row = state.widgets.paramRows[i];
    const binding = state.inspectorBindings[i] || null;
    if (!row) continue;

    if (!binding || !node) {
      setWidgetVisible(row.label, false);
      setWidgetVisible(row.field, false);
      continue;
    }

    setWidgetVisible(row.label, true);
    setWidgetVisible(row.field, true);
    setWidgetEnabled(row.field, true);

    row.label.setText(String(binding.label ?? binding.key));
    row.field.placeholder = String(binding.placeholder ?? '');

    const current = exprToText(node[binding.key]);
    const focused = !!row.field.state?.focused;
    const selectionChanged = state.lastInspectedId !== id;
    if (!focused || selectionChanged) {
      if (String(row.field.getValue() ?? '') !== current) row.field.setValue(current);
    }
  }

  if (state.widgets.inspectorLayout?.layout) state.widgets.inspectorLayout.layout();
  state.lastInspectedId = id;
}

function inspectorSchemaForNode(node) {
  const kind = String(node?.kind ?? '');
  switch (kind) {
    case 'oscVoice':
      return [
        { key: 'oscType', label: 'oscType', placeholder: 'sine | square | sawtooth | triangle' },
        { key: 'freqHz', label: 'freqHz', placeholder: 'e.g. 440 or {"kind":"rand","min":200,"max":800}' },
        { key: 'gain', label: 'gain', placeholder: 'e.g. 0.2' },
        { key: 'stopAfter', label: 'stopAfter (opt)', placeholder: 'seconds (optional)', optional: true }
      ];
    case 'lfo':
      return [
        { key: 'oscType', label: 'oscType', placeholder: 'sine | square | sawtooth | triangle' },
        { key: 'freqHz', label: 'freqHz', placeholder: 'Hz' },
        { key: 'gain', label: 'gain (depth)', placeholder: 'mod depth' },
        { key: 'stopAfter', label: 'stopAfter (opt)', placeholder: 'seconds (optional)', optional: true }
      ];
    case 'gain':
      return [
        { key: 'gain', label: 'gain', placeholder: 'e.g. 0.8' }
      ];
    case 'filter':
      return [
        { key: 'filterType', label: 'filterType', placeholder: 'lowpass | highpass | bandpass | ...' },
        { key: 'freqHz', label: 'freqHz', placeholder: 'Hz' },
        { key: 'q', label: 'q', placeholder: 'Q' },
        { key: 'gain', label: 'gain (opt)', placeholder: 'dB (optional)', optional: true }
      ];
    case 'noiseVoice':
      return [
        { key: 'noiseType', label: 'noiseType (opt)', placeholder: 'white | pink | brown | bitcrush', optional: true },
        { key: 'duration', label: 'duration', placeholder: 'seconds' },
        { key: 'gain', label: 'gain', placeholder: 'e.g. 0.15' },
        { key: 'stopAfter', label: 'stopAfter (opt)', placeholder: 'seconds (optional)', optional: true }
      ];
    case 'stereoPanner':
      return [
        { key: 'pan', label: 'pan', placeholder: '-1 .. +1' }
      ];
    case 'delay':
      return [
        { key: 'delayTime', label: 'delayTime', placeholder: 'seconds' },
        { key: 'maxDelayTime', label: 'maxDelayTime (opt)', placeholder: 'seconds (optional)', optional: true }
      ];
    case 'waveshaper':
      return [
        { key: 'curve', label: 'curve', placeholder: 'softClip | hardClip | tanh | atan | fold' },
        { key: 'amount', label: 'amount (opt)', placeholder: 'default 1', optional: true },
        { key: 'oversample', label: 'oversample (opt)', placeholder: 'none | 2x | 4x', optional: true }
      ];
    default:
      return [];
  }
}

function layoutRightPane() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;

  const rightPaneW = 520;
  const rightX = W - rightPaneW + 20;
  const innerW = rightPaneW - 40;

  const inspectorH = Math.min(320, Math.max(190, Math.floor(H * 0.33)));
  const inspectorY = 20;

  if (state.widgets?.inspectorTitle) {
    state.widgets.inspectorTitle.bounds.x = rightX;
    state.widgets.inspectorTitle.bounds.y = inspectorY;
    state.widgets.inspectorTitle.bounds.width = innerW;
  }

  if (state.widgets?.inspectorLayout?.setBounds) {
    state.widgets.inspectorLayout.setBounds({ x: rightX, y: inspectorY + 28, width: innerW, height: Math.max(120, inspectorH - 28) }, true);
  }

  const editorTitleY = inspectorY + inspectorH + 12;
  const editorY = editorTitleY + 28;
  const editorH = Math.max(220, H - editorY - 40);

  if (state.widgets?.editorTitle) {
    state.widgets.editorTitle.bounds.x = rightX;
    state.widgets.editorTitle.bounds.y = editorTitleY;
    state.widgets.editorTitle.bounds.width = innerW;
  }
  if (state.widgets?.editor) {
    state.widgets.editor.bounds.x = rightX;
    state.widgets.editor.bounds.y = editorY;
    state.widgets.editor.bounds.width = innerW;
    state.widgets.editor.bounds.height = editorH;
  }
}

function currentPresetName() {
  return (state.presetNames && state.presetNames.length)
    ? (state.presetNames[state.presetIndex] || null)
    : null;
}
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

const title = gui.createLabel({ bounds: { x: 20, y: 20, width: 280, height: 24 }, text: 'STFXR Edit (playPreset)', align: 'left' });
const presetLbl = gui.createLabel({ bounds: { x: 20, y: 48, width: 280, height: 22 }, text: 'Preset: (none)', align: 'left' });

const btnPrev = gui.createButton({ bounds: { x: 20, y: 78, width: 130, height: 44 }, label: 'Prev' });
const btnNext = gui.createButton({ bounds: { x: 170, y: 78, width: 130, height: 44 }, label: 'Next' });

const seedField = gui.createTextField({ bounds: { x: 20, y: 132, width: 280, height: 44 }, value: String(state.seed), placeholder: 'Seed (number or string)' });
const btnRand = gui.createButton({ bounds: { x: 20, y: 186, width: 280, height: 44 }, label: 'Randomize Seed' });

const vol = gui.createSlider({ bounds: { x: 20, y: 242, width: 280, height: 52 }, label: 'Volume', min: 0, max: 100, value: Math.round(state.volume * 100) });

const btnPlay = gui.createButton({ bounds: { x: 20, y: 304, width: 280, height: 44 }, label: 'Play Draft (playPreset)' });
const btnApply = gui.createButton({ bounds: { x: 20, y: 358, width: 280, height: 44 }, label: 'Apply JSON → Draft' });
const btnRevert = gui.createButton({ bounds: { x: 20, y: 412, width: 280, height: 44 }, label: 'Revert to Base' });
const btnLayout = gui.createButton({ bounds: { x: 20, y: 466, width: 280, height: 44 }, label: 'Auto Layout' });
const btnResetView = gui.createButton({ bounds: { x: 20, y: 520, width: 280, height: 44 }, label: 'Reset View' });

const status = gui.createLabel({ bounds: { x: 20, y: 574, width: 280, height: 44 }, text: state.statusText, align: 'left' });

const inspectorTitle = gui.createLabel({ bounds: { x: 20, y: 20, width: 480, height: 22 }, text: 'Selected Node', align: 'left' });
const inspectorHeader = gui.createLabel({ bounds: { x: 20, y: 48, width: 480, height: 22 }, text: 'Selected: (none)', align: 'left' });

const p1Label = gui.createLabel({ bounds: { x: 20, y: 80, width: 480, height: 16 }, text: '—', align: 'left', visible: false });
const p1Field = gui.createTextField({ bounds: { x: 20, y: 98, width: 480, height: 28 }, value: '', placeholder: '', visible: false });

const p2Label = gui.createLabel({ bounds: { x: 20, y: 130, width: 480, height: 16 }, text: '—', align: 'left', visible: false });
const p2Field = gui.createTextField({ bounds: { x: 20, y: 148, width: 480, height: 28 }, value: '', placeholder: '', visible: false });

const p3Label = gui.createLabel({ bounds: { x: 20, y: 180, width: 480, height: 16 }, text: '—', align: 'left', visible: false });
const p3Field = gui.createTextField({ bounds: { x: 20, y: 198, width: 480, height: 28 }, value: '', placeholder: '', visible: false });

const p4Label = gui.createLabel({ bounds: { x: 20, y: 230, width: 480, height: 16 }, text: '—', align: 'left', visible: false });
const p4Field = gui.createTextField({ bounds: { x: 20, y: 248, width: 480, height: 28 }, value: '', placeholder: '', visible: false });

const inspectorLayout = gui.createContainer({ bounds: { x: 20, y: 48, width: 480, height: 240 }, padding: 0, gap: 4, alignX: 'stretch' });
inspectorLayout.addMany([inspectorHeader, p1Label, p1Field, p2Label, p2Field, p3Label, p3Field, p4Label, p4Field]);
inspectorLayout.layout();

const editorTitle = gui.createLabel({ bounds: { x: 20, y: 320, width: 480, height: 22 }, text: 'Preset JSON (draft)', align: 'left' });
const editor = gui.createTextEditor({
  bounds: { x: 20, y: 348, width: 480, height: 260 },
  value: '',
  placeholder: '{ "nodes": [...], "edges": [...] }'
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
  btnApply,
  btnRevert,
  btnLayout,
  btnResetView,
  status,
  inspectorTitle,
  inspectorLayout,
  inspectorHeader,
  paramRows: [
    { label: p1Label, field: p1Field },
    { label: p2Label, field: p2Field },
    { label: p3Label, field: p3Field },
    { label: p4Label, field: p4Field }
  ],
  editorTitle,
  editor
};

layoutRightPane();

{
  const listed = stfxr.list();
  state.presetNames = [BUILTIN_PRESET_NAME, ...listed.filter(n => String(n) !== BUILTIN_PRESET_NAME)];
  state.presetIndex = 0;
}
loadBasePresetByIndex();

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

    // Graph interactions: select/drag nodes or pan
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
        state.drag = { mode: 'node', id: hit, ox: w.x - r.x, oy: w.y - r.y };
        state.layoutById.delete(hit);
        state.layoutById.set(hit, r);
      } else {
        state.drag = { mode: 'pan', ox: event.x, oy: event.y, startCamX: state.camX, startCamY: state.camY };
      }
    }

    if (!state.mouseDownLeft) state.drag = null;
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
      const r = state.layoutById.get(state.drag.id);
      if (r) {
        const w = viewToWorld(event.x, event.y);
        r.x = w.x - state.drag.ox;
        r.y = w.y - state.drag.oy;
      }
    } else if (state.drag.mode === 'pan') {
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

// Keep right-pane bounds in sync with resize.
layoutRightPane();

// Update labels
const presetName = currentPresetName();
state.widgets.presetLbl.setText(`Preset: ${presetName ?? '(none)'}   nodes: ${state.graph?.nodes?.length ?? 0}`);
state.widgets.status.setText(state.statusText);

updateInspectorUI();

// Seed + volume
if (state.widgets.seedField.wasChanged()) {
  const raw = String(state.widgets.seedField.getValue() ?? '').trim();
  const asNum = Number(raw);
  state.seed = (raw && Number.isFinite(asNum)) ? asNum : (raw || 0);
}

if (state.widgets.btnRand.wasClicked()) {
  if (typeof random?.seed === 'function') state.seed = random.seed();
  else state.seed = Math.floor(Math.random() * 0x7fffffff);
  state.widgets.seedField.setValue(String(state.seed));
}

state.volume = clamp((state.widgets.vol.getValue() || 0) / 100, 0, 1);

// Preset navigation
let changed = false;
if (state.widgets.btnPrev.wasClicked()) {
  const n = Math.max(1, state.presetNames.length);
  state.presetIndex = (state.presetIndex - 1 + n) % n;
  changed = true;
}
if (state.widgets.btnNext.wasClicked()) {
  const n = Math.max(1, state.presetNames.length);
  state.presetIndex = (state.presetIndex + 1) % n;
  changed = true;
}
if (changed) {
  state.camX = 0; state.camY = 0;
  loadBasePresetByIndex();
}

if (state.widgets.btnLayout.wasClicked()) {
  refreshGraphAndLayout(true);
  state.statusText = 'Auto layout applied.';
}

if (state.widgets.btnResetView.wasClicked()) {
  state.camX = 0; state.camY = 0;
  state.statusText = 'View reset.';
}

if (state.widgets.btnRevert.wasClicked()) {
  state.draftPreset = state.basePreset ? JSON.parse(JSON.stringify(state.basePreset)) : null;
  refreshGraphAndLayout(true);
  syncEditorFromDraft(true);
  state.statusText = 'Reverted to base preset.';
}

if (state.widgets.btnApply.wasClicked()) {
  tryApplyEditor();
}

if (state.widgets.btnPlay.wasClicked()) {
  if (!state.draftPreset) {
    state.statusText = 'No draft preset to play.';
  } else {
    // Exercise new API
    stfxr.playPreset(state.draftPreset, state.seed, { volume: state.volume });
    state.statusText = `Played draft via playPreset (seed=${String(state.seed)})`;
  }
}

// Apply inspector edits (text fields -> mutate draft)
if (state.selectedId && state.draftPreset && state.widgets?.paramRows) {
  const node = getDraftNodeById(state.selectedId);
  for (let i = 0; i < state.widgets.paramRows.length; i++) {
    const row = state.widgets.paramRows[i];
    const binding = state.inspectorBindings[i];
    if (!row?.field || !binding) continue;
    if (!row.field.state?.visible) continue;
    if (!node) continue;

    if (row.field.wasChanged()) {
      const parsed = parseExprText(row.field.getValue());
      if (parsed.kind === 'empty') {
        if (binding.optional) {
          delete node[binding.key];
        } else {
          // Revert the field to current value if a required field was cleared.
          row.field.setValue(exprToText(node[binding.key]));
          state.statusText = `${binding.key} cannot be empty.`;
          continue;
        }
      } else {
        node[binding.key] = parsed.value;
      }

      refreshGraphAndLayout(false);
      syncEditorFromDraft(false);
      state.statusText = `Updated ${String(state.selectedId)}.${binding.key}` + (isEditorDirty() ? ' (editor dirty)' : '');
    }
  }
}

// If user typed, don't auto-overwrite their content.
// We only sync into the editor when it's not dirty,
// or when doing explicit load/revert/apply actions.
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();

const b = graphBounds();

ui.rect(b.graph.x, b.graph.y, b.graph.w, b.graph.h, rgba01(255, 255, 255, 0.03));
ui.pushClipRect(b.graph.x, b.graph.y, b.graph.w, b.graph.h);

// Grid
{
  const grid = rgba01(255, 255, 255, 0.04);
  const step = 80;
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  for (let x = ((b.graph.x + state.camX) % step) - step; x < W; x += step) ui.rect(x, b.graph.y, 1, b.graph.h, grid);
  for (let y = ((b.graph.y + state.camY) % step) - step; y < H; y += step) ui.rect(b.graph.x, y, b.graph.w, 1, grid);
}

if (!state.graph) {
  ui.text('No draft preset loaded.', b.graph.x + 24, b.graph.y + 24, ui.colors.rgb(220, 220, 220));
  ui.popClipRect();
  return;
}

// Edges
{
  const edgeColor = rgba01(220, 220, 220, 0.35);
  const modColor = rgba01(120, 180, 255, 0.35);

  for (const e of state.graph.audioEdges) {
    const pts = edgePoints(state.layoutById, String(e.from), String(e.to));
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

    const a = worldToView(aRect.x + aRect.w, aRect.y + aRect.h * 0.5);
    const c = worldToView(tp.x, tp.y);
    drawLine(ui, a.x, a.y, c.x, c.y, modColor, 2);
    ui.text(param, c.x + 6, c.y - 8, rgba01(160, 210, 255, 0.65));
  }
}

// Nodes
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

    ui.text(String(id), v.x + 10, v.y + 10, ui.colors.rgb(240, 240, 240));
    const kindText = String(n.kind ?? '');
    if (kindText) ui.text(kindText, v.x + 10, v.y + 30, rgba01(200, 200, 200, 0.7));

    ui.rect(v.x - 2, v.y + r.h * 0.5 - 2, 4, 4, rgba01(255, 255, 255, 0.25));
    ui.rect(v.x + r.w - 2, v.y + r.h * 0.5 - 2, 4, 4, rgba01(255, 255, 255, 0.25));

    // Subtle in-node connector: input -> output
    ui.rect(v.x + 2, Math.round(v.y + r.h * 0.5), Math.max(0, r.w - 4), 1, rgba01(255, 255, 255, 0.08));
  }
}

ui.popClipRect();

// Frame
{
  const frame = rgba01(255, 255, 255, 0.10);
  ui.rect(b.graph.x, b.graph.y, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y + b.graph.h - 1, b.graph.w, 1, frame);
  ui.rect(b.graph.x, b.graph.y, 1, b.graph.h, frame);
  ui.rect(b.graph.x + b.graph.w - 1, b.graph.y, 1, b.graph.h, frame);
}
```
