---
name: "STFXR: Graph Viewer"
theme: "nord"
requiresAudioGesture: true
exports: [sfxGraphDocument, sfxGraphPreset, sfxGraphSelection]
accepts: [sfxGraphDocument, sfxGraphPreset, readonly, auditionRequest]
---

A basic **graph viewer** for a single `stfxr` preset.

- **Play** auditions the preset
- **Click** a node to select it
- **Place the cursor over a numeric JSON value** to retarget the slider
- **Drag** a node to reposition it
- **Drag empty space** to pan the view

> Note: this demo uses the WebGPU `ui` immediate-mode drawing API.

## Modular Role

This document is intended to serve three roles over time:

1. A standalone sound-design surface for a single `stfxr` graph.
2. An embedded instrument editor inside [sequencer.md](./sequencer.md).
3. The graph-editing surface for instruments, buses, and FX chains inside [daw.md](./daw.md).

To keep those roles aligned, treat this document as a shell around a reusable graph editor subsystem rather than the subsystem itself.

### Stable Data Boundary

The reusable boundary should be split into three layers:

- `SfxGraphPreset`: synth-only data consumed by the audio engine (`vars`, `nodes`, `edges`, `events`).
- `SfxGraphDocument`: a preset plus editor metadata such as node positions, camera defaults, and future grouping/layout data.
- `SfxGraphEditorSession`: transient UI state such as selection, hover, drag state, splitter position, and dirty flags.

Only the first two should be shared with a host. Session state should remain local to the graph editor instance.

### Embedding Contract

When this document is embedded by another Storie document, the host should own persistence and orchestration while this module owns graph editing behavior.

Recommended incoming payloads:

- `sfxGraphDocument` to open a saved graph plus layout metadata.
- `sfxGraphPreset` to open a synth graph when no editor metadata exists yet.
- `readonly` to disable editing for preview or locked contexts.
- `auditionRequest` when the host wants a graph to be played externally.

Recommended outgoing payloads:

- `sfxGraphDocumentChanged` when preset or layout state changes.
- `sfxGraphPresetChanged` when the canonical synth graph changes.
- `sfxGraphSelectionChanged` when the selected node changes.
- `sfxGraphValidationChanged` when parse or validation status changes.
- `sfxGraphAuditionRequested` when the user presses Play inside the graph editor.

The host should treat `sfxGraphPresetChanged` as the main integration seam for track instruments, bus FX, and future DAW routing.

### Implementation Direction

The optimal implementation path is:

1. Extract the graph model, layout, validation, and edit actions into shared `src` modules.
2. Keep this file as the standalone shell that mounts that shared core.
3. Make `sequencer.md` and `daw.md` mount the same core instead of carrying their own graph JSON/editor state.
4. Add `host.send(...)` and `host.on(...)` wiring once the shared controller exists.

## Demo

```js
// Inlined graph utilities (src/graph/core.ts + layout.ts)
function getArrayOrEmpty(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function getClonedArrayOrEmpty(value) {
  if (Array.isArray(value)) {
    return value.slice();
  }
  return [];
}

function getNodeId(node) {
  if (node && node.id !== undefined && node.id !== null) {
    return String(node.id);
  }
  return '';
}

function getNodeKind(node, fallback) {
  if (node && node.kind !== undefined && node.kind !== null) {
    return String(node.kind);
  }
  return fallback;
}

function getEdgeEndpointNodeId(endpoint) {
  if (endpoint && endpoint.node !== undefined && endpoint.node !== null) {
    return String(endpoint.node);
  }
  return '';
}

function getEdgeFromNodeId(edge) {
  return getEdgeEndpointNodeId(edge && edge.from);
}

function getEdgeToNodeId(edge) {
  return getEdgeEndpointNodeId(edge && edge.to);
}

function getEdgeToTarget(edge) {
  if (edge && edge.to !== undefined && edge.to !== null) {
    return String(edge.to);
  }
  return '';
}

function getEdgeFromSource(edge) {
  if (edge && edge.from !== undefined && edge.from !== null) {
    return String(edge.from);
  }
  return '';
}

function getMapArray(map, key) {
  const value = map.get(key);
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function getMapNumber(map, key) {
  const value = map.get(key);
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return 0;
}

function _graphNodeById(graph) {
  const map = new Map();
  for (const n of getArrayOrEmpty(graph && graph.nodes)) {
    const id = getNodeId(n);
    if (!id) continue;
    if (!map.has(id)) map.set(id, { ...n, id });
  }
  return map;
}
function topoSort(graph) {
  const nodes = _graphNodeById(graph);
  const ids = Array.from(nodes.keys());
  const indeg = new Map();
  const out = new Map();
  for (const id of ids) { indeg.set(id, 0); out.set(id, []); }
  for (const e of getArrayOrEmpty(graph && graph.edges)) {
    const a = getEdgeFromNodeId(e);
    const b = getEdgeToNodeId(e);
    if (!a || !b || !nodes.has(a) || !nodes.has(b)) continue;
    out.get(a).push(b);
    indeg.set(b, getMapNumber(indeg, b) + 1);
  }
  const q = [];
  for (const id of ids) {
    if (getMapNumber(indeg, id) === 0) {
      q.push(id);
    }
  }
  const order = [];
  const indeg2 = new Map(indeg);
  while (q.length) {
    const id = q.shift();
    order.push(id);
    for (const b of getMapArray(out, id)) {
      indeg2.set(b, getMapNumber(indeg2, b) - 1);
      if (getMapNumber(indeg2, b) === 0) {
        q.push(b);
      }
    }
  }
  if (order.length === ids.length) return { order, hasCycle: false, cyclicNodes: [] };
  const seen = new Set(order);
  const cyclicNodes = ids.filter(id => !seen.has(id));
  return { order: order.concat(cyclicNodes), hasCycle: true, cyclicNodes };
}
function computeLevels(graph, order) {
  const nodes = _graphNodeById(graph);
  const ids = Array.from(nodes.keys());
  const out = new Map();
  for (const id of ids) out.set(id, []);
  for (const e of getArrayOrEmpty(graph && graph.edges)) {
    const a = getEdgeFromNodeId(e);
    const b = getEdgeToNodeId(e);
    if (!a || !b || !nodes.has(a) || !nodes.has(b)) continue;
    out.get(a).push(b);
  }
  const level = new Map();
  for (const id of ids) level.set(id, 0);
  const seq = Array.isArray(order) && order.length ? order : topoSort(graph).order;
  for (const id of seq) {
    const l = getMapNumber(level, id);
    for (const b of getMapArray(out, id)) {
      level.set(b, Math.max(getMapNumber(level, b), l + 1));
    }
  }
  return level;
}
function autoLayoutLevels(graph, bounds, opts) {
  opts = opts || {};
  const pad = opts.pad ?? 24;
  const colW = opts.colW ?? 260;
  const rowH = opts.rowH ?? 88;
  const nodeW = opts.nodeW ?? 180;
  const nodeH = opts.nodeH ?? 60;
  const nodes = _graphNodeById(graph);
  const topo = topoSort(graph);
  const level = computeLevels(graph, topo.order);
  const groups = new Map();
  for (const id of nodes.keys()) {
    const l = getMapNumber(level, id);
    const arr = getMapArray(groups, l);
    arr.push(id);
    groups.set(l, arr);
  }
  const levels = Array.from(groups.keys()).sort((a, b) => a - b);
  const layout = new Map();
  for (let li = 0; li < levels.length; li++) {
    const l = levels[li];
    const ids = getMapArray(groups, l);
    for (let ri = 0; ri < ids.length; ri++) {
      const id = ids[ri];
      layout.set(id, { x: bounds.x + pad + li * colW, y: bounds.y + pad + ri * rowH, w: nodeW, h: nodeH });
    }
  }
  return layout;
}
function hitTestNode(layoutById, x, y) {
  let hit = null;
  for (const [id, r] of layoutById.entries()) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = id;
  }
  return hit;
}
function drawLine(ui, x0, y0, x1, y1, color, thickness) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const steps = Math.ceil(len);
  const t2 = Math.max(0, Math.floor((thickness || 1) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = Math.round(x0 + dx * t);
    const y = Math.round(y0 + dy * t);
    ui.rect(x - t2, y - t2, (thickness || 1) + t2, (thickness || 1) + t2, color);
  }
}

let state = {
  seed: 1337,
  seedText: '1337',
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

  lastSelectedId: null,
  inspectorId: null,
  nodeJsonDirty: false,
  numericBinding: null,
  lastNodeJsonSelectionStart: -1,
  lastNodeJsonSelectionEnd: -1,
  lastSliderWidgetValue: null,
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
  const nodes = getClonedArrayOrEmpty(preset && preset.nodes);
  const edges = getClonedArrayOrEmpty(preset && preset.edges);
  const events = getClonedArrayOrEmpty(preset && preset.events);

  const nodeById = new Map();
  for (const n of nodes) {
    const id = getNodeId(n);
    if (id) {
      nodeById.set(id, n);
    }
  }

  let needsOut = false;
  for (const e of edges) {
    if (getEdgeToTarget(e) === 'out') {
      needsOut = true;
    }
  }
  if (needsOut && !nodeById.has('out')) {
    nodeById.set('out', { kind: 'out', id: 'out' });
  }

  // Partition edges into audio edges (node->node/out) vs param edges (node->node.param)
  const audioEdges = [];
  const paramEdges = [];

  for (const e of edges) {
    const from = getEdgeFromSource(e);
    const toRaw = getEdgeToTarget(e);
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

  // Reuse shared topo sort + level computation by adapting to the core graph shape.
  const topoGraph = {
    nodes: Array.from(nodeById.keys()).map((id) => ({ id, kind: getNodeKind(nodeById.get(id), 'node') })),
    edges: audioEdges.map((e, idx) => ({
      id: `e${idx}`,
      from: { node: String(e.from), port: 'out' },
      to: { node: String(e.to), port: 'in' }
    }))
  };
  const topo = topoSort(topoGraph);
  const level = computeLevels(topoGraph, topo.order);
  const nodesOut = topo.order.map(id => nodeById.get(id));

  // Compatibility: provide a port-based graph for shared graph-core utilities.
  // stfxr graph viewer treats all audio edges as node-level connections.
  const coreGraph = {
    version: 1,
    nodes: nodesOut.map((n) => ({ id: getNodeId(n), kind: getNodeKind(n, 'unknown'), params: n })),
    edges: audioEdges.map((e, idx) => ({
      id: e.id ?? `e${idx}`,
      from: { node: String(e.from), port: 'out' },
      to: { node: String(e.to), port: 'in' }
    }))
  };

  return {
    nodeById,
    nodes: nodesOut,
    audioEdges,
    paramEdges,
    events,
    level,
    coreGraph
  };
}

function autoLayout(graph, bounds) {
  const coreGraph = {
    nodes: graph.nodes.map((n) => ({ id: getNodeId(n), kind: getNodeKind(n, 'node') })),
    edges: graph.audioEdges.map((e, idx) => ({
      id: `e${idx}`,
      from: { node: String(e.from), port: 'out' },
      to: { node: String(e.to), port: 'in' }
    }))
  };

  const base = autoLayoutLevels(coreGraph, bounds, { nodeW: 180, nodeH: 60, colW: 260, rowH: 88, pad: 24 });

  // Preserve the original demo's dynamic node width behavior.
  const layout = new Map();
  for (const [id, r] of base.entries()) {
    const node = graph.nodeById.get(id);
    const label = `${id}`;
    const kind = getNodeKind(node, '');
    const w = Math.max(180, (label.length + Math.max(0, kind.length - 2)) * 9 + 44);
    layout.set(id, { x: r.x, y: r.y, w, h: 60 });
  }

  return layout;
}

function hitTest(layoutById, x, y) {
  return hitTestNode(layoutById, x, y);
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
  const hash = String(param || '')
    .split('')
    .reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 0);
  const slot = hash % 6;

  return { x: portX, y: baseY + slot * hStep };
}

function buildSelectedNodeJson(graph, selectedId) {
  if (!graph || !selectedId) return '';
  if (String(selectedId) === 'out') {
    return JSON.stringify({ id: 'out', kind: 'out', volume: Number(state.volume.toFixed(4)) }, null, 2);
  }
  const node = graph.nodeById.get(selectedId);
  if (!node) return '';
  return JSON.stringify(node, null, 2);
}

function formatBindingPath(path) {
  if (!Array.isArray(path) || path.length === 0) return 'value';
  let out = '';
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else out += out ? `.${part}` : String(part);
  }
  return out || 'value';
}

function parseJsonNumericBindings(text) {
  const src = String(text ?? '');
  const bindings = [];
  let i = 0;

  const fail = (msg) => {
    throw new Error(`JSON parse error at ${i}: ${msg}`);
  };

  const skipWs = () => {
    while (i < src.length) {
      const ch = src[i];
      if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') i += 1;
      else break;
    }
  };

  const parseString = () => {
    if (src[i] !== '"') fail('expected string');
    const start = i;
    i += 1;
    let out = '';
    while (i < src.length) {
      const ch = src[i++];
      if (ch === '"') return { value: out, start, end: i };
      if (ch === '\\') {
        if (i >= src.length) fail('unterminated escape');
        const esc = src[i++];
        if (esc === '"' || esc === '\\' || esc === '/') out += esc;
        else if (esc === 'b') out += '\b';
        else if (esc === 'f') out += '\f';
        else if (esc === 'n') out += '\n';
        else if (esc === 'r') out += '\r';
        else if (esc === 't') out += '\t';
        else if (esc === 'u') {
          const hex = src.slice(i, i + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('invalid unicode escape');
          out += String.fromCharCode(parseInt(hex, 16));
          i += 4;
        } else fail('invalid escape');
      } else {
        out += ch;
      }
    }
    fail('unterminated string');
  };

  const parseNumber = (path) => {
    const start = i;
    if (src[i] === '-') i += 1;
    if (src[i] === '0') i += 1;
    else {
      if (!/[1-9]/.test(src[i] ?? '')) fail('invalid number');
      while (/[0-9]/.test(src[i] ?? '')) i += 1;
    }
    if (src[i] === '.') {
      i += 1;
      if (!/[0-9]/.test(src[i] ?? '')) fail('invalid fraction');
      while (/[0-9]/.test(src[i] ?? '')) i += 1;
    }
    if (src[i] === 'e' || src[i] === 'E') {
      i += 1;
      if (src[i] === '+' || src[i] === '-') i += 1;
      if (!/[0-9]/.test(src[i] ?? '')) fail('invalid exponent');
      while (/[0-9]/.test(src[i] ?? '')) i += 1;
    }
    const raw = src.slice(start, i);
    const value = Number(raw);
    if (!Number.isFinite(value)) fail('number must be finite');
    bindings.push({
      path: Array.isArray(path) ? path.slice() : [],
      label: formatBindingPath(path),
      start,
      end: i,
      value
    });
  };

  const parseLiteral = (literal) => {
    if (src.slice(i, i + literal.length) !== literal) fail(`expected ${literal}`);
    i += literal.length;
  };

  const parseValue = (path) => {
    skipWs();
    const ch = src[i];
    if (ch === '{') {
      i += 1;
      skipWs();
      if (src[i] === '}') {
        i += 1;
        return;
      }
      while (i < src.length) {
        skipWs();
        const key = parseString().value;
        skipWs();
        if (src[i] !== ':') fail('expected colon');
        i += 1;
        parseValue(path.concat(key));
        skipWs();
        if (src[i] === ',') {
          i += 1;
          continue;
        }
        if (src[i] === '}') {
          i += 1;
          return;
        }
        fail('expected comma or object end');
      }
      fail('unterminated object');
    }
    if (ch === '[') {
      i += 1;
      skipWs();
      if (src[i] === ']') {
        i += 1;
        return;
      }
      let idx = 0;
      while (i < src.length) {
        parseValue(path.concat(idx));
        idx += 1;
        skipWs();
        if (src[i] === ',') {
          i += 1;
          continue;
        }
        if (src[i] === ']') {
          i += 1;
          return;
        }
        fail('expected comma or array end');
      }
      fail('unterminated array');
    }
    if (ch === '"') {
      parseString();
      return;
    }
    if (ch === '-' || /[0-9]/.test(ch ?? '')) {
      parseNumber(path);
      return;
    }
    if (ch === 't') {
      parseLiteral('true');
      return;
    }
    if (ch === 'f') {
      parseLiteral('false');
      return;
    }
    if (ch === 'n') {
      parseLiteral('null');
      return;
    }
    fail('unexpected token');
  };

  skipWs();
  if (!src) return bindings;
  parseValue([]);
  skipWs();
  if (i !== src.length) fail('unexpected trailing content');
  return bindings;
}

function findNumericBindingAtCursor(bindings, selectionStart, selectionEnd, preferredLabel) {
  if (!Array.isArray(bindings) || bindings.length === 0) return null;
  const start = Math.max(0, Number(selectionStart) || 0);
  const end = Math.max(start, Number(selectionEnd) || start);

  for (const binding of bindings) {
    if (end >= binding.start && start <= binding.end) return binding;
  }
  for (const binding of bindings) {
    if (end === binding.end || end === binding.start) return binding;
  }
  if (preferredLabel) {
    const exact = bindings.find((binding) => binding.label === preferredLabel);
    if (exact) return exact;
  }
  return null;
}

function niceCeil(value) {
  const n = Math.abs(Number(value) || 0);
  if (!n) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(n)));
  const norm = n / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

function sliderSpecForBinding(binding) {
  const label = String(binding?.label ?? 'value');
  const lower = label.toLowerCase();
  const value = Number(binding?.value ?? 0);
  if (/volume|gain|peak|mix|wet|dry|q$/.test(lower) && value >= 0 && value <= 2) {
    return { min: 0, max: 2, step: 0.01 };
  }
  if (/freq|hz/.test(lower) && value >= 0) {
    return { min: 0, max: Math.max(1000, niceCeil(Math.max(1, value) * 2)), step: 1 };
  }
  if (/attack|release|decay|duration|time|delay|stopafter/.test(lower) && value >= 0) {
    return { min: 0, max: Math.max(1, niceCeil(Math.max(0.1, value) * 2)), step: value < 1 ? 0.01 : 0.1 };
  }

  const abs = Math.abs(value);
  let step = 1;
  if (abs < 0.001) step = 0.0001;
  else if (abs < 0.01) step = 0.001;
  else if (abs < 0.1) step = 0.005;
  else if (abs < 1) step = 0.01;
  else if (abs < 10) step = 0.1;
  else if (abs < 100) step = 1;
  else if (abs < 1000) step = 5;
  else step = 10;

  if (value === 0) return { min: -1, max: 1, step };
  if (value > 0) return { min: 0, max: niceCeil(abs * 2), step };

  const bound = niceCeil(abs * 2);
  return { min: -bound, max: bound, step };
}

function decimalsForStep(step) {
  const s = String(step ?? '');
  const expIdx = s.indexOf('e-');
  if (expIdx >= 0) return Math.max(0, Math.min(6, parseInt(s.slice(expIdx + 2), 10) || 0));
  const dot = s.indexOf('.');
  return dot >= 0 ? Math.max(0, Math.min(6, s.length - dot - 1)) : 0;
}

function formatSliderNumber(value, step) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0';
  const decimals = decimalsForStep(step);
  let out = decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
  if (out.includes('.')) out = out.replace(/\.?0+$/, '');
  if (out === '-0') out = '0';
  return out;
}

function getInspectorId() {
  return state.inspectorId || state.selectedId || null;
}

function syncNumericBindingFromEditor() {
  const editor = getNodeJsonEditor();
  const slider = getVolumeSlider();
  if (!editor || !slider) return;

  const inspectorId = getInspectorId();
  const selection = getNodeJsonSelection(editor);
  const text = getNodeJsonText(editor);

  let bindings = [];
  try {
    bindings = parseJsonNumericBindings(text);
  } catch {
    bindings = [];
  }

  const preferredLabel = inspectorId === 'out' ? 'volume' : null;
  const found = findNumericBindingAtCursor(bindings, selection.start, selection.end, preferredLabel);

  if (!found) {
    state.numericBinding = null;
    syncNumericSliderWidget();
    return;
  }

  const bindingKey = `${String(inspectorId ?? '')}:${found.label}`;
  const prev = state.numericBinding;
  const spec = prev && prev.key === bindingKey
    ? { min: prev.min, max: prev.max, step: prev.step }
    : sliderSpecForBinding(found);

  state.numericBinding = {
    key: bindingKey,
    label: found.label,
    start: found.start,
    end: found.end,
    value: found.value,
    min: spec.min,
    max: spec.max,
    step: spec.step
  };

  syncNumericSliderWidget();
}

function applyNumericSliderValue(nextValue) {
  const editor = getNodeJsonEditor();
  if (!editor || !state.numericBinding) return false;

  const binding = state.numericBinding;
  const clamped = clamp(Number(nextValue ?? binding.value), binding.min, binding.max);
  const nextText = formatSliderNumber(clamped, binding.step);
  editor.replaceTextRange(binding.start, binding.end, nextText);
  state.nodeJsonDirty = true;

  if (getInspectorId() === 'out' && binding.label === 'volume') {
    state.volume = clamp(clamped, 0, 2);
  }

  syncNumericBindingFromEditor();
  return true;
}

function getPresetNodeById(id) {
  if (!state.preset || !Array.isArray(state.preset.nodes)) return null;
  for (const n of state.preset.nodes) {
    if (getNodeId(n) === String(id)) return n;
  }
  return null;
}

function computeDefaultNodeSize(node) {
  const id = getNodeId(node);
  const kind = getNodeKind(node, '');
  const label = `${id}`;
  const w = Math.max(180, (label.length + Math.max(0, kind.length - 2)) * 9 + 44);
  const h = 60;
  return { w, h };
}

function buildInitialLayout(graph, bounds) {
  const auto = autoLayout(graph, bounds);
  const out = new Map(auto);

  for (const n of graph.nodes) {
    const id = getNodeId(n);
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

function rebuildGraphLayout() {
  if (!state.graph) return;
  const b = graphBounds();
  state.layoutById = buildInitialLayout(state.graph, b.graph);
}

function rebuildGraphFromPreset() {
  if (!state.preset) return;
  state.graph = computeGraph(state.preset);
  rebuildGraphLayout();
}

function playCurrentPreset() {
  if (!state.preset) return;
  stfxr.playPreset(state.preset, state.seed, { volume: state.volume });
}

function applyAutoLayoutToGraph() {
  if (!state.graph) return;
  const b = graphBounds();
  state.layoutById = autoLayout(state.graph, b.graph);
  writeLayoutToPreset(state.layoutById);
  state.statusText = 'Auto layout applied (saved into node x/y).';
}

function applySelectedNodeJson(jsonText) {
  const inspectorId = getInspectorId();
  if (!inspectorId) {
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

  const selectedId = String(inspectorId);
  if (selectedId === 'out') {
    const volume = Number(parsed.volume);
    if (!Number.isFinite(volume)) {
      state.statusText = 'Out node JSON must include a finite numeric volume.';
      return false;
    }
    state.volume = clamp(volume, 0, 2);
    state.nodeJsonDirty = false;
    state.statusText = 'Updated out volume.';
    return true;
  }

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

  rebuildGraphFromPreset();
  state.nodeJsonDirty = false;
  state.statusText = `Updated node ${selectedId} and replayed.`;

  // Audition immediately so changes affect sound.
  playCurrentPreset();
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
    rebuildGraphLayout();
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
  const W = ui.metrics.canvasWidth || 1280;
  const b = graphBounds();
  const y = b.toolbar.y;
  const h = b.toolbar.h;
  const vol = getVolumeSlider();
  const seedField = getSeedFieldWidget();
  const btnRand = getWidget('btnRand');
  const btnPlay = getWidget('btnPlay');
  const btnAuto = getWidget('btnAuto');
  const btnReset = getWidget('btnReset');
  if (!vol || !seedField || !btnRand || !btnPlay || !btnAuto || !btnReset) return;

  // Right-align volume slider.
  const volW = Math.max(220, Math.min(360, Math.floor(W * 0.28)));
  setWidgetBounds(vol, {
    x: b.toolbar.x + b.toolbar.w - volW,
    y: y + 8,
    width: volW,
    height: h - 16
  });

  // Left-to-right controls.
  let x = b.toolbar.x;
  const gap = 10;
  const btnW = 92;
  const btnH = 42;
  const fieldW = 240;

  setWidgetBounds(seedField, {
    x,
    y: y + Math.floor((h - btnH) / 2),
    width: fieldW,
    height: btnH
  });
  x += fieldW + gap;

  const buttons = [btnRand, btnPlay, btnAuto, btnReset];
  for (const btn of buttons) {
    setWidgetBounds(btn, {
      x,
      y: y + Math.floor((h - btnH) / 2),
      width: btnW,
      height: btnH
    });
    x += btnW + gap;
  }
}

function viewToWorld(x, y) {
  return { x: x - state.camX, y: y - state.camY };
}

function worldToView(x, y) {
  return { x: x + state.camX, y: y + state.camY };
}

function setWidgetBounds(widget, bounds) {
  if (!widget || !bounds) return;
  if (typeof widget.setBounds === 'function') {
    widget.setBounds(bounds);
    return;
  }

  widget.bounds.x = bounds.x;
  widget.bounds.y = bounds.y;
  widget.bounds.width = bounds.width;
  widget.bounds.height = bounds.height;
}

function getWidget(name) {
  return gui.get(name) || null;
}

function getNodeJsonEditor() {
  return getWidget('nodeJson');
}

function getVolumeSlider() {
  return getWidget('vol');
}

function getSeedFieldWidget() {
  return getWidget('seedField');
}

function getNodeJsonSelection(editor) {
  if (!editor) return { start: 0, end: 0 };
  if (typeof editor.getSelectionRange === 'function') {
    return editor.getSelectionRange();
  }
  return { start: 0, end: 0 };
}

function updateStoredNodeJsonSelection(selection) {
  state.lastNodeJsonSelectionStart = selection.start;
  state.lastNodeJsonSelectionEnd = selection.end;
}

function getNodeJsonText(editor) {
  if (!editor) return '';
  return String(editor.getValue() ?? '');
}

function setWidgetEnabled(widget, enabled) {
  if (!widget || typeof widget.setEnabled !== 'function') return;
  widget.setEnabled(!!enabled);
}

function setNodeJsonText(text) {
  if (!getNodeJsonEditor()) return;
  gui.value('nodeJson', String(text ?? ''));
}

function setSliderRange(widget, range) {
  if (!widget || !range) return;
  if (typeof range.min === 'number' && Number.isFinite(range.min)) {
    widget.min = range.min;
  }
  if (typeof range.max === 'number' && Number.isFinite(range.max)) {
    widget.max = range.max;
  }
  if (typeof range.step === 'number' && Number.isFinite(range.step) && range.step > 0) {
    widget.step = range.step;
  }
}

function syncNumericSliderWidget() {
  const slider = getVolumeSlider();
  if (!slider) return;

  if (!state.numericBinding) {
    const inspectorId = getInspectorId();
    gui.text('vol', inspectorId === 'out' ? 'Volume' : 'Select Numeric Value');
    setWidgetEnabled(slider, false);
    state.lastSliderWidgetValue = gui.value('vol');
    return;
  }

  const binding = state.numericBinding;
  gui.text('vol', binding.label);
  setSliderRange(slider, binding);
  setWidgetEnabled(slider, true);
  gui.value('vol', binding.value);
  state.lastSliderWidgetValue = gui.value('vol');
}

function updateInspectorLayout() {
  const b = graphBounds();
  const x = b.right.x;
  const y = b.right.y;
  const w = b.right.w;
  const h = b.right.h;

  const gap = 8;
  const labelH = 18;
  const btnH = 42;
  const statusH = 18;
  const nodeEditorH = Math.max(120, h - labelH - gap - btnH - gap - statusH);
  const nodeLabelY = y;

  const nodeJsonLabel = getWidget('nodeJsonLabel');
  const nodeJson = getNodeJsonEditor();
  const btnUpdate = getWidget('btnUpdate');
  const status = getWidget('status');
  if (!nodeJsonLabel || !nodeJson || !btnUpdate || !status) return;

  setWidgetBounds(nodeJsonLabel, {
    x,
    y: nodeLabelY,
    width: w,
    height: labelH
  });

  setWidgetBounds(nodeJson, {
    x,
    y: nodeLabelY + labelH + gap,
    width: w,
    height: nodeEditorH
  });

  const btnY = nodeLabelY + labelH + gap + nodeEditorH + gap;
  setWidgetBounds(btnUpdate, {
    x,
    y: btnY,
    width: 120,
    height: btnH
  });

  setWidgetBounds(status, {
    x,
    y: btnY + btnH + gap,
    width: w,
    height: statusH
  });
}

function refreshInspectorEditorFromSelection(forceOverwrite) {
  const nodeJson = getNodeJsonEditor();
  if (!nodeJson || !state.graph) return;

  const canOverwrite = forceOverwrite || !state.nodeJsonDirty;
  if (!canOverwrite) return;

  setNodeJsonText(buildSelectedNodeJson(state.graph, state.selectedId));
  state.nodeJsonDirty = false;
  state.inspectorId = state.selectedId;
  syncNumericBindingFromEditor();
  updateStoredNodeJsonSelection(getNodeJsonSelection(nodeJson));
}

function updateNodeJsonLabel() {
  if (!getWidget('nodeJsonLabel')) return;

  const inspectorId = getInspectorId();
  const id = inspectorId ? String(inspectorId) : '(none)';
  gui.text('nodeJsonLabel', `Node JSON — ${id}`);
}

function syncSeedFromText() {
  const raw = String(state.seedText ?? '').trim();
  const asNum = Number(raw);
  if (raw && Number.isFinite(asNum)) {
    state.seed = asNum;
    return;
  }
  state.seed = raw || 0;
}

function syncSelectionDrivenInspectorState() {
  if (state.selectedId === state.lastSelectedId) return;
  refreshInspectorEditorFromSelection(false);
  state.lastSelectedId = state.selectedId;
}

function randomizeSeed() {
  if (typeof random?.seed === 'function') {
    state.seed = random.seed();
  } else {
    state.seed = Math.floor(Math.random() * 0x7fffffff);
  }

  state.seedText = String(state.seed);

  const seedField = getSeedFieldWidget();
  if (seedField) {
    gui.value('seedField', state.seedText);
  }
}

function syncNumericBindingForEditorState(nodeJsonChanged) {
  const nodeJson = getNodeJsonEditor();
  if (!nodeJson) return;

  const selection = getNodeJsonSelection(nodeJson);
  const selectionChanged = selection.start !== state.lastNodeJsonSelectionStart
    || selection.end !== state.lastNodeJsonSelectionEnd;

  if (nodeJsonChanged || selectionChanged) {
    syncNumericBindingFromEditor();
    updateStoredNodeJsonSelection(selection);
  }
}

function applyPendingSliderBindingValue() {
  if (!state.numericBinding) return;

  const vol = getVolumeSlider();
  if (!vol) return;

  const sliderValue = vol.getValue();
  const previousValue = state.lastSliderWidgetValue ?? sliderValue;
  const minDelta = Math.max(1e-6, state.numericBinding.step * 0.25);
  if (Math.abs(sliderValue - previousValue) > minDelta) {
    applyNumericSliderValue(sliderValue);
  }
  state.lastSliderWidgetValue = vol.getValue();
}

function setStatusWidgetText() {
  if (!getWidget('status')) return;
  gui.text('status', state.statusText);
}

function routeRetainedGUIInput(event) {
  if (!event) return;

  if (event.type === 'keydown') {
    gui.handleKey(event.key, {
      shift: (event.mods || []).includes('shift'),
      ctrl: (event.mods || []).includes('ctrl'),
      alt: (event.mods || []).includes('alt'),
      meta: (event.mods || []).includes('meta')
    });
    return;
  }

  if (event.type === 'text') {
    gui.handleText(event.text);
    return;
  }

  if (event.type === 'mouse') {
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
    return;
  }

  if (event.type === 'mouse_move') {
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }
}

function stepRetainedGUI() {
  gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);
}

function beginSplitterDrag(event) {
  state.drag = {
    mode: 'split',
    ox: event.x,
    startRightW: state.rightW
  };
}

function beginGraphDrag(event, graphBoundsRect) {
  if (!state.graph) return;

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
    state.layoutById.delete(hit);
    state.layoutById.set(hit, r);
    return;
  }

  state.drag = {
    mode: 'pan',
    ox: event.x,
    oy: event.y,
    startCamX: state.camX,
    startCamY: state.camY
  };
}

function handleGraphMousePress(event) {
  const b = graphBounds();
  const inSplitter = event.x >= b.splitter.x && event.x < (b.splitter.x + b.splitter.w) &&
                     event.y >= b.splitter.y && event.y < (b.splitter.y + b.splitter.h);
  const inGraph = event.x >= b.graph.x && event.x < (b.graph.x + b.graph.w) &&
                  event.y >= b.graph.y && event.y < (b.graph.y + b.graph.h);

  if (inSplitter) {
    beginSplitterDrag(event);
    return;
  }

  if (inGraph) {
    beginGraphDrag(event, b.graph);
  }
}

function updateHoveredGraphNode(event) {
  const b = graphBounds();
  const inGraph = event.x >= b.graph.x && event.x < (b.graph.x + b.graph.w) &&
                  event.y >= b.graph.y && event.y < (b.graph.y + b.graph.h);

  if (!inGraph || !state.graph) {
    state.hoveredId = null;
    return;
  }

  const w = viewToWorld(event.x, event.y);
  state.hoveredId = hitTest(state.layoutById, w.x, w.y);
}

function updateActiveGraphDrag(event) {
  if (!state.mouseDownLeft || !state.drag) return false;

  if (state.drag.mode === 'split') {
    const W = ui.metrics.canvasWidth || 1280;
    const minRightW = 260;
    const maxRightW = Math.max(minRightW, W - 220);
    const dx = event.x - state.drag.ox;
    state.rightW = clamp(state.drag.startRightW - dx, minRightW, maxRightW);
    return true;
  }

  if (state.drag.mode === 'node') {
    const id = state.drag.id;
    const r = state.layoutById.get(id);
    if (r) {
      const w = viewToWorld(event.x, event.y);
      r.x = w.x - state.drag.ox;
      r.y = w.y - state.drag.oy;

      const pn = getPresetNodeById(id);
      if (pn) {
        pn.x = r.x;
        pn.y = r.y;
      }
    }
    return false;
  }

  if (state.drag.mode === 'pan') {
    const dx = event.x - state.drag.ox;
    const dy = event.y - state.drag.oy;
    state.camX = state.drag.startCamX + dx;
    state.camY = state.drag.startCamY + dy;
  }

  return false;
}


```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

gui.screen({
  state,
  group: 'stfxr-toolbar',
  widgets: {
    seedField: {
      type: 'textField',
      bounds: { x: 20, y: 20, width: 240, height: 42 },
      value: state.seedText,
      bind: 'seedText',
      placeholder: 'Seed',
      onChange() {
        syncSeedFromText();
      }
    },
    btnRand: {
      type: 'button',
      bounds: { x: 270, y: 20, width: 92, height: 42 },
      label: 'Random',
      onClick() {
        randomizeSeed();
      }
    },
    btnPlay: {
      type: 'button',
      bounds: { x: 372, y: 20, width: 92, height: 42 },
      label: 'Play',
      onClick() {
        playCurrentPreset();
      }
    },
    btnAuto: {
      type: 'button',
      bounds: { x: 474, y: 20, width: 92, height: 42 },
      label: 'Auto',
      onClick() {
        applyAutoLayoutToGraph();
      }
    },
    btnReset: {
      type: 'button',
      bounds: { x: 576, y: 20, width: 92, height: 42 },
      label: 'Reset',
      onClick() {
        state.camX = 0;
        state.camY = 0;
      }
    },
    vol: {
      type: 'slider',
      bounds: { x: 690, y: 20, width: 320, height: 62 },
      label: 'Volume',
      min: 0,
      max: 100,
      value: Math.round(state.volume * 100)
    }
  }
});

gui.screen({
  state,
  group: 'stfxr-inspector',
  widgets: {
    nodeJsonLabel: {
      type: 'label',
      bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 48, width: 380, height: 18 },
      text: 'Node JSON',
      align: 'left'
    },
    nodeJson: {
      type: 'editor',
      bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 72, width: 380, height: 160 },
      value: '',
      placeholder: '{\n  "kind": "...",\n  ...\n}'
    },
    btnUpdate: {
      type: 'button',
      bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 240, width: 120, height: 42 },
      label: 'Update',
      onClick() {
        const jsonText = gui.value('nodeJson');
        const ok = applySelectedNodeJson(jsonText);
        if (ok && state.graph) {
          refreshInspectorEditorFromSelection(true);
        }
      }
    },
    status: {
      type: 'label',
      bounds: { x: ui.metrics.canvasWidth - 420 + 20, y: 288, width: 380, height: 18 },
      text: '',
      align: 'left'
    }
  }
});

layoutToolbar();
syncSeedFromText();

// Load initial preset
ensureGraphLoaded();

// Populate initial layout (prefer preset node x/y if present)
if (state.graph) {
  rebuildGraphLayout();
}

// Warm audio unlock
audio.context.resume().catch(() => {});

// Seed editor with selected node JSON
const nodeJson = getNodeJsonEditor();
if (state.graph && state.selectedId && nodeJson) {
  refreshInspectorEditorFromSelection(true);
  state.lastSelectedId = state.selectedId;
}
```

```js on:input
if (!event) return;
if (!state) return;

if (event.type === 'mouse') {
  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';

    if (state.mouseDownLeft) {
      handleGraphMousePress(event);
    }

    if (!state.mouseDownLeft) {
      state.drag = null;
    }
  }
}

routeRetainedGUIInput(event);

if (event.type === 'mouse_move') {
  updateHoveredGraphNode(event);
  if (updateActiveGraphDrag(event)) {
    return;
  }
}
```

```js on:update
if (!state) return;
if (!getSeedFieldWidget()) return;

stepRetainedGUI();

layoutToolbar();
updateInspectorLayout();

const nodeJsonEditor = getNodeJsonEditor();
const nodeJsonChanged = !!(nodeJsonEditor && nodeJsonEditor.wasChanged());
if (nodeJsonChanged) {
  state.nodeJsonDirty = true;
}
syncNumericBindingForEditorState(nodeJsonChanged);
applyPendingSliderBindingValue();

// If selection changed, refresh node JSON editor (unless user is mid-edit)
syncSelectionDrivenInspectorState();
updateNodeJsonLabel();
setStatusWidgetText();
```

```js on:render
if (!state) return; // main block hasn't run yet

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
