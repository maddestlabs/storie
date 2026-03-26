---
name: "Shader Graph Editor"
theme: "nord"
---

A **Filter Forge-style node graph** that compiles to live WGSL shaders.

- **Click** a node to select it and edit its parameters
- **Drag** a node to reposition it
- **Drag empty space** to pan the canvas
- **Click Add Node** to insert a new node from the library
- The graph compiles to WGSL and runs live in the preview panel

> Uses the WebGPU `ui` immediate-mode drawing API + inline WGSL shader preview.

## Demo

```js
// ─── Inlined graph utilities (src/graph/core.ts + layout.ts) ─────────────────
function _gnb(graph) {
  const m = new Map();
  for (const n of graph.nodes ?? []) { const id = String(n?.id ?? ''); if (id && !m.has(id)) m.set(id, { ...n, id }); }
  return m;
}
function topoSort(graph) {
  const nodes = _gnb(graph); const ids = Array.from(nodes.keys());
  const indeg = new Map(); const out = new Map();
  for (const id of ids) { indeg.set(id, 0); out.set(id, []); }
  for (const e of graph.edges ?? []) {
    const a = String(e?.from?.node ?? ''); const b = String(e?.to?.node ?? '');
    if (!a || !b || !nodes.has(a) || !nodes.has(b)) continue;
    out.get(a).push(b); indeg.set(b, (indeg.get(b) ?? 0) + 1);
  }
  const q = []; for (const id of ids) if ((indeg.get(id) ?? 0) === 0) q.push(id);
  const order = []; const indeg2 = new Map(indeg);
  while (q.length) { const id = q.shift(); order.push(id); for (const b of out.get(id) ?? []) { indeg2.set(b, (indeg2.get(b) ?? 0) - 1); if ((indeg2.get(b) ?? 0) === 0) q.push(b); } }
  if (order.length === ids.length) return { order, hasCycle: false };
  const seen = new Set(order); return { order: order.concat(ids.filter(id => !seen.has(id))), hasCycle: true };
}
function computeLevels(graph, order) {
  const nodes = _gnb(graph); const ids = Array.from(nodes.keys());
  const out = new Map(); for (const id of ids) out.set(id, []);
  for (const e of graph.edges ?? []) { const a = String(e?.from?.node ?? ''); const b = String(e?.to?.node ?? ''); if (a && b && nodes.has(a) && nodes.has(b)) out.get(a).push(b); }
  const level = new Map(); for (const id of ids) level.set(id, 0);
  const seq = Array.isArray(order) && order.length ? order : topoSort(graph).order;
  for (const id of seq) { const l = level.get(id) ?? 0; for (const b of out.get(id) ?? []) level.set(b, Math.max(level.get(b) ?? 0, l + 1)); }
  return level;
}
function autoLayoutLevels(graph, bounds, opts) {
  opts = opts || {};
  const pad = opts.pad ?? 24; const colW = opts.colW ?? 240; const rowH = opts.rowH ?? 90;
  const nodeW = opts.nodeW ?? 190; const nodeH = opts.nodeH ?? 64;
  const nodes = _gnb(graph); const topo = topoSort(graph); const level = computeLevels(graph, topo.order);
  const groups = new Map();
  for (const id of nodes.keys()) { const l = level.get(id) ?? 0; const arr = groups.get(l) ?? []; arr.push(id); groups.set(l, arr); }
  const levels = Array.from(groups.keys()).sort((a, b) => a - b);
  const layout = new Map();
  for (let li = 0; li < levels.length; li++) {
    const ids = groups.get(levels[li]) ?? [];
    for (let ri = 0; ri < ids.length; ri++) layout.set(ids[ri], { x: bounds.x + pad + li * colW, y: bounds.y + pad + ri * rowH, w: nodeW, h: nodeH });
  }
  return layout;
}
function hitTestNode(layoutById, x, y) {
  let hit = null;
  for (const [id, r] of layoutById.entries()) { if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) hit = id; }
  return hit;
}
function drawLine(ui, x0, y0, x1, y1, color, thickness) {
  const dx = x1 - x0; const dy = y1 - y0; const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const steps = Math.ceil(len); const t2 = Math.floor((thickness || 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    ui.rect(Math.round(x0 + dx * t) - t2, Math.round(y0 + dy * t) - t2, (thickness || 1), (thickness || 1), color);
  }
}

// ─── Colour helpers ────────────────────────────────────────────────────────────
function rgba01(r, g, b, a01) {
  return ui.colors.rgba(r, g, b, Math.round(Math.max(0, Math.min(1, a01)) * 255));
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// ─── Node library ─────────────────────────────────────────────────────────────
// Each entry: { kind, label, category, inputs, outputs, params, wgsl }
// wgsl(params, inputVars, outputVar) → WGSL expression string or multi-line block
// Use scope.XXX = ... || IIFE pattern: autoBindVariables regex stops at ';' inside template
// literals so we bypass the transform; var NODE_DEFS = scope.NODE_DEFS then creates the
// local variable the second-pass IIFE needs for functions like compileGraphToWGSLFinal.
scope.NODE_DEFS = scope.NODE_DEFS || (function() { return [
  {
    kind: 'uv',
    label: 'UV Coords',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'uv', type: 'vec2f' }],
    params: [],
    wgsl: (p, ins, out) => `let ${out}_uv: vec2f = uv;`
  },
  {
    kind: 'time',
    label: 'Time',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'time', type: 'f32' }],
    params: [],
    wgsl: (p, ins, out) => `let ${out}_time: f32 = time;`
  },
  {
    kind: 'color_const',
    label: 'Color',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'color', type: 'vec4f' }],
    params: [
      { name: 'r', label: 'R', type: 'f32', default: 1.0, min: 0, max: 1, step: 0.01 },
      { name: 'g', label: 'G', type: 'f32', default: 0.5, min: 0, max: 1, step: 0.01 },
      { name: 'b', label: 'B', type: 'f32', default: 0.2, min: 0, max: 1, step: 0.01 },
      { name: 'a', label: 'A', type: 'f32', default: 1.0, min: 0, max: 1, step: 0.01 }
    ],
    wgsl: (p, ins, out) => `let ${out}_color: vec4f = vec4f(${p.r ?? 1.0}f, ${p.g ?? 0.5}f, ${p.b ?? 0.2}f, ${p.a ?? 1.0}f);`
  },
  {
    kind: 'checkerboard',
    label: 'Checkerboard',
    category: 'pattern',
    inputs: [{ name: 'uv', type: 'vec2f' }],
    outputs: [{ name: 'value', type: 'f32' }],
    params: [
      { name: 'scale', label: 'Scale', type: 'f32', default: 8.0, min: 1, max: 64, step: 0.5 }
    ],
    wgsl: (p, ins, out) => {
      const uvIn = ins.uv || 'uv';
      return `let ${out}_c = floor(${uvIn} * ${p.scale ?? 8.0}f);\nlet ${out}_value: f32 = fract((${out}_c.x + ${out}_c.y) * 0.5) * 2.0;`;
    }
  },
  {
    kind: 'sine_wave',
    label: 'Sine Wave',
    category: 'pattern',
    inputs: [{ name: 'uv', type: 'vec2f' }, { name: 'time', type: 'f32' }],
    outputs: [{ name: 'value', type: 'f32' }],
    params: [
      { name: 'freq', label: 'Frequency', type: 'f32', default: 4.0, min: 0.1, max: 20, step: 0.1 },
      { name: 'speed', label: 'Speed', type: 'f32', default: 1.0, min: 0, max: 10, step: 0.1 }
    ],
    wgsl: (p, ins, out) => {
      const uvIn = ins.uv || 'uv'; const tIn = ins.time || 'time';
      return `let ${out}_value: f32 = sin(${uvIn}.x * ${p.freq ?? 4.0}f * 6.28318f + ${tIn} * ${p.speed ?? 1.0}f) * 0.5 + 0.5;`;
    }
  },
  {
    kind: 'fbm_noise',
    label: 'fBm Noise',
    category: 'pattern',
    inputs: [{ name: 'uv', type: 'vec2f' }, { name: 'time', type: 'f32' }],
    outputs: [{ name: 'value', type: 'f32' }],
    params: [
      { name: 'scale', label: 'Scale', type: 'f32', default: 3.0, min: 0.1, max: 20, step: 0.1 },
      { name: 'octaves', label: 'Octaves', type: 'i32', default: 5, min: 1, max: 8, step: 1 },
      { name: 'speed', label: 'Speed', type: 'f32', default: 0.2, min: 0, max: 5, step: 0.05 }
    ],
    wgsl: (p, ins, out) => {
      const uvIn = ins.uv || 'uv'; const tIn = ins.time || '0.0';
      const oct = Math.round(p.octaves ?? 5);
      return `var ${out}_p: vec2f = ${uvIn} * ${p.scale ?? 3.0}f + vec2f(${tIn} * ${p.speed ?? 0.2}f, 0.0);
var ${out}_v: f32 = 0.0; var ${out}_a: f32 = 0.5; var ${out}_f: f32 = 1.0;
for (var ${out}_i: i32 = 0; ${out}_i < ${oct}; ${out}_i++) {
  ${out}_v += ${out}_a * (_hash21(${out}_p * ${out}_f) * 2.0 - 1.0);
  ${out}_f *= 2.0; ${out}_a *= 0.5; ${out}_p = ${out}_p * 2.01 + vec2f(0.13, 0.7);
}
let ${out}_value: f32 = ${out}_v * 0.5 + 0.5;`;
    }
  },
  {
    kind: 'voronoi',
    label: 'Voronoi',
    category: 'pattern',
    inputs: [{ name: 'uv', type: 'vec2f' }, { name: 'time', type: 'f32' }],
    outputs: [{ name: 'value', type: 'f32' }],
    params: [
      { name: 'scale', label: 'Scale', type: 'f32', default: 5.0, min: 0.5, max: 30, step: 0.5 },
      { name: 'speed', label: 'Anim', type: 'f32', default: 0.3, min: 0, max: 5, step: 0.05 }
    ],
    wgsl: (p, ins, out) => {
      const uvIn = ins.uv || 'uv'; const tIn = ins.time || '0.0';
      return `var ${out}_md: f32 = 8.0; let ${out}_sc = ${uvIn} * ${p.scale ?? 5.0}f;
let ${out}_ic: vec2f = floor(${out}_sc);
for (var ${out}_dy: i32 = -1; ${out}_dy <= 1; ${out}_dy++) {
  for (var ${out}_dx: i32 = -1; ${out}_dx <= 1; ${out}_dx++) {
    let ${out}_nc = ${out}_ic + vec2f(f32(${out}_dx), f32(${out}_dy));
    let ${out}_hp = _hash22(${out}_nc) * 0.5 + 0.5 + vec2f(sin(${tIn} * ${p.speed ?? 0.3}f + _hash21(${out}_nc) * 6.28f) * 0.3, cos(${tIn} * ${p.speed ?? 0.3}f + _hash21(${out}_nc + 1.0) * 6.28f) * 0.3);
    let ${out}_d = distance(${out}_sc - ${out}_ic, ${out}_nc - ${out}_ic + ${out}_hp);
    ${out}_md = min(${out}_md, ${out}_d);
  }
}
let ${out}_value: f32 = clamp(${out}_md, 0.0, 1.0);`;
    }
  },
  {
    kind: 'mix_float',
    label: 'Mix (f32)',
    category: 'math',
    inputs: [{ name: 'a', type: 'f32' }, { name: 'b', type: 'f32' }, { name: 'factor', type: 'f32' }],
    outputs: [{ name: 'result', type: 'f32' }],
    params: [
      { name: 'factor', label: 'Factor', type: 'f32', default: 0.5, min: 0, max: 1, step: 0.01 }
    ],
    wgsl: (p, ins, out) => {
      const aIn = ins.a || '0.0'; const bIn = ins.b || '1.0'; const fIn = ins.factor || `${p.factor ?? 0.5}f`;
      return `let ${out}_result: f32 = mix(${aIn}, ${bIn}, ${fIn});`;
    }
  },
  {
    kind: 'color_ramp',
    label: 'Color Ramp',
    category: 'color',
    inputs: [{ name: 'value', type: 'f32' }],
    outputs: [{ name: 'color', type: 'vec4f' }],
    params: [
      { name: 'r0', label: 'R0', type: 'f32', default: 0.05, min: 0, max: 1, step: 0.01 },
      { name: 'g0', label: 'G0', type: 'f32', default: 0.02, min: 0, max: 1, step: 0.01 },
      { name: 'b0', label: 'B0', type: 'f32', default: 0.15, min: 0, max: 1, step: 0.01 },
      { name: 'r1', label: 'R1', type: 'f32', default: 0.8, min: 0, max: 1, step: 0.01 },
      { name: 'g1', label: 'G1', type: 'f32', default: 0.5, min: 0, max: 1, step: 0.01 },
      { name: 'b1', label: 'B1', type: 'f32', default: 1.0, min: 0, max: 1, step: 0.01 }
    ],
    wgsl: (p, ins, out) => {
      const vIn = ins.value || '0.5';
      return `let ${out}_color: vec4f = vec4f(mix(${p.r0 ?? 0.05}f, ${p.r1 ?? 0.8}f, ${vIn}), mix(${p.g0 ?? 0.02}f, ${p.g1 ?? 0.5}f, ${vIn}), mix(${p.b0 ?? 0.15}f, ${p.b1 ?? 1.0}f, ${vIn}), 1.0);`;
    }
  },
  {
    kind: 'multiply_color',
    label: 'Multiply Color',
    category: 'color',
    inputs: [{ name: 'a', type: 'vec4f' }, { name: 'b', type: 'vec4f' }],
    outputs: [{ name: 'color', type: 'vec4f' }],
    params: [],
    wgsl: (p, ins, out) => {
      const aIn = ins.a || 'vec4f(1.0)'; const bIn = ins.b || 'vec4f(1.0)';
      return `let ${out}_color: vec4f = ${aIn} * ${bIn};`;
    }
  },
  {
    kind: 'output',
    label: 'Output',
    category: 'output',
    inputs: [{ name: 'color', type: 'vec4f' }],
    outputs: [],
    params: [],
    wgsl: (p, ins, out) => {
      const cIn = ins.color || 'vec4f(0.0, 0.0, 0.0, 1.0)';
      return `return ${cIn};`;
    }
  }
]; })();
var NODE_DEFS = scope.NODE_DEFS;

// Map kind -> def (built in IIFE so scope.NODE_DEFS is accessible; var creates IIFE closure var)
scope.NODE_DEF_MAP = scope.NODE_DEF_MAP || (function() {
  var m = {}; var ds = scope.NODE_DEFS;
  for (var i = 0; i < ds.length; i++) { m[ds[i].kind] = ds[i]; }
  return m;
})();
var NODE_DEF_MAP = scope.NODE_DEF_MAP;

// ─── Graph-to-WGSL Compiler ───────────────────────────────────────────────────
// Rewrite the final `return` from the output node to be the actual shader return.
// The output node emits `return <expr>;` — we just keep it, but we need it to
// appear BEFORE the fallback return, so actually compile it correctly:
function compileGraphToWGSLFinal(graph) {
  const topo = topoSort(graph);
  if (topo.hasCycle) return null;

  const helpers = `
fn _hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(127.1, 311.7));
  q += dot(q, q + 19.19);
  return fract(q.x * q.y);
}
fn _hash22(p: vec2f) -> vec2f {
  let q = vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)));
  return fract(sin(q) * 43758.5453);
}`;

  const edgeMap = {};
  for (const e of graph.edges ?? []) {
    const fromNode = String(e.from?.node ?? '');
    const fromPort = String(e.from?.port ?? '');
    const toNode = String(e.to?.node ?? '');
    const toPort = String(e.to?.port ?? '');
    if (!fromNode || !fromPort || !toNode || !toPort) continue;
    edgeMap[`${toNode}.${toPort}`] = `${fromNode}_${fromPort}`;
  }

  const bodyLines = [];
  let hasOutput = false;

  for (const nodeId of topo.order) {
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) continue;
    const def = NODE_DEF_MAP[node.kind];
    if (!def || typeof def.wgsl !== 'function') continue;

    const params = node.params ?? {};
    const ins = {};
    for (const portDef of def.inputs ?? []) {
      const key = `${nodeId}.${portDef.name}`;
      if (edgeMap[key]) ins[portDef.name] = edgeMap[key];
    }

    const snippet = def.wgsl(params, ins, nodeId);
    if (snippet) {
      bodyLines.push(`  // [${node.kind}] ${nodeId}`);
      bodyLines.push(snippet.split('\n').map(l => '  ' + l).join('\n'));
    }

    for (const portDef of def.outputs ?? []) {
      edgeMap[`_out.${nodeId}.${portDef.name}`] = `${nodeId}_${portDef.name}`;
      // Register by port name for downstream
      if (!edgeMap[portDef.name]) edgeMap[portDef.name] = `${nodeId}_${portDef.name}`;
    }

    if (node.kind === 'output') hasOutput = true;
  }

  if (!hasOutput) {
    bodyLines.push('  return vec4f(0.1, 0.05, 0.2, 1.0);');
  }

  // No vertex shader here — buildRenderModuleCode will prepend DEFAULT_VERTEX_WGSL
  // which defines DefaultVertexOut and uses both @location(0) pos + @location(1) uv,
  // matching the pipeline's hard-coded vertex buffer layout exactly.
  return `struct Uniforms {
  time: f32,
  resolution: vec2f,
};
@group(0) @binding(2) var<uniform> uniforms: Uniforms;
${helpers}
@fragment
fn fragmentMain(vtx: DefaultVertexOut) -> @location(0) vec4f {
  let uv: vec2f = vtx.uv;
  let time: f32 = uniforms.time;
${bodyLines.join('\n')}
}`;
}

// ─── Default graph ─────────────────────────────────────────────────────────────
var DEFAULT_GRAPH = {
  version: 1,
  nodes: [
    { id: 'uv0',    kind: 'uv',         params: {} },
    { id: 't0',     kind: 'time',        params: {} },
    { id: 'noise0', kind: 'fbm_noise',   params: { scale: 3.0, octaves: 5, speed: 0.2 } },
    { id: 'ramp0',  kind: 'color_ramp',  params: { r0: 0.05, g0: 0.02, b0: 0.15, r1: 0.8, g1: 0.5, b1: 1.0 } },
    { id: 'out0',   kind: 'output',      params: {} }
  ],
  edges: [
    { id: 'e0', from: { node: 'uv0',    port: 'uv' },    to: { node: 'noise0', port: 'uv' } },
    { id: 'e1', from: { node: 't0',     port: 'time' },  to: { node: 'noise0', port: 'time' } },
    { id: 'e2', from: { node: 'noise0', port: 'value' }, to: { node: 'ramp0',  port: 'value' } },
    { id: 'e3', from: { node: 'ramp0',  port: 'color' }, to: { node: 'out0',   port: 'color' } }
  ]
};

// ─── Editor state ─────────────────────────────────────────────────────────────
var state = {
  graph: null,        // Graph (nodes + edges)
  layoutById: new Map(),

  // Camera / pan
  camX: 0,
  camY: 0,

  // Panel split
  previewH: 300,       // height of preview area at the bottom

  // Interaction
  mouseDownLeft: false,
  drag: null,  // { mode:'node'|'pan'|'split', id?, ox, oy, startCamX, startCamY, startPreviewH }
  hoveredId: null,
  selectedId: null,

  // Wire drawing
  wireFrom: null,  // { nodeId, portName, portType, side:'out', px, py }

  // GUI widgets
  widgets: null,

  // Add-node panel
  addPanelOpen: false,
  addPanelScroll: 0,

  // Shader compilation
  shaderName: 'shader-graph-live',
  compiledWGSL: null,
  compileError: null,
  shaderDirty: true,
  lastCompileTime: 0,
};

// ─── Layout helpers ───────────────────────────────────────────────────────────
function graphBounds() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  const toolbarH = 52;
  const previewH = clamp(state.previewH || 300, 120, H - toolbarH - 120);
  state.previewH = previewH;
  const graphH = H - toolbarH - previewH - 6; // 6px splitter
  return {
    toolbar: { x: 0, y: 0, w: W, h: toolbarH },
    graph:   { x: 0, y: toolbarH, w: W, h: graphH },
    split:   { x: 0, y: toolbarH + graphH, w: W, h: 6 },
    preview: { x: 0, y: toolbarH + graphH + 6, w: W, h: previewH }
  };
}

function viewToWorld(x, y) { return { x: x - state.camX, y: y - state.camY }; }
function worldToView(x, y) { return { x: x + state.camX, y: y + state.camY }; }

function rebuildLayout() {
  if (!state.graph) return;
  const b = graphBounds();
  const auto = autoLayoutLevels(state.graph, b.graph, { nodeW: 190, nodeH: 64, colW: 240, rowH: 90, pad: 32 });
  // Preserve existing positions if nodes already placed.
  const out = new Map();
  for (const [id, rect] of auto.entries()) {
    const node = state.graph.nodes.find(n => n.id === id);
    const existing = state.layoutById.get(id);
    if (existing) {
      out.set(id, existing);
    } else {
      // Use preset x/y if stored on node
      const nx = Number.isFinite(Number(node?.x)) ? Number(node.x) : rect.x;
      const ny = Number.isFinite(Number(node?.y)) ? Number(node.y) : rect.y;
      out.set(id, { x: nx, y: ny, w: rect.w, h: rect.h });
    }
  }
  state.layoutById = out;
}

// ─── Shader management ────────────────────────────────────────────────────────
function scheduleRecompile() {
  state.shaderDirty = true;
}

function recompileIfDirty() {
  if (!state.shaderDirty) return;
  if (!state.graph) return;
  state.shaderDirty = false;
  state.lastCompileTime = Date.now();

  const wgsl = compileGraphToWGSLFinal(state.graph);
  if (!wgsl) {
    state.compileError = 'Cycle detected in graph';
    state.compiledWGSL = null;
    return;
  }

  state.compiledWGSL = wgsl;
  state.compileError = null;

  shader.define(state.shaderName, wgsl, { kind: 'fragment' }).then(function(ok) {
    if (ok) { shader.setActive(state.shaderName); }
    else { state.compileError = 'Shader compile failed (GPU rejected)'; }
  }).catch(function(e) {
    state.compileError = String(e?.message ?? e);
  });
}

// ─── Graph mutation helpers ───────────────────────────────────────────────────
let _nextId = 100;
function newId(prefix) { return `${prefix}_${_nextId++}`; }

function addNode(kind) {
  if (!state.graph) return;
  const def = NODE_DEF_MAP[kind];
  if (!def) return;
  const id = newId(kind);
  const b = graphBounds();
  const params = {};
  for (const p of def.params ?? []) params[p.name] = p.default;
  state.graph.nodes.push({ id, kind, params });
  // Place near center of visible graph area
  const cx = b.graph.x + b.graph.w / 2 - state.camX;
  const cy = b.graph.y + b.graph.h / 2 - state.camY;
  state.layoutById.set(id, { x: cx - 95, y: cy - 32, w: 190, h: 64 });
  state.selectedId = id;
  state.addPanelOpen = false;
  scheduleRecompile();
}

function deleteSelectedNode() {
  if (!state.selectedId || !state.graph) return;
  const id = state.selectedId;
  state.graph.nodes = state.graph.nodes.filter(n => n.id !== id);
  state.graph.edges = state.graph.edges.filter(e => e.from?.node !== id && e.to?.node !== id);
  state.layoutById.delete(id);
  state.selectedId = null;
  scheduleRecompile();
}

function setParam(nodeId, paramName, value) {
  if (!state.graph) return;
  const node = state.graph.nodes.find(n => n.id === nodeId);
  if (!node) return;
  if (!node.params) node.params = {};
  node.params[paramName] = value;
  scheduleRecompile();
}

function addEdge(fromNode, fromPort, toNode, toPort) {
  if (!state.graph) return;
  // Remove existing edge to the same input port
  state.graph.edges = state.graph.edges.filter(e => !(e.to?.node === toNode && e.to?.port === toPort));
  state.graph.edges.push({ id: newId('e'), from: { node: fromNode, port: fromPort }, to: { node: toNode, port: toPort } });
  scheduleRecompile();
}

// ─── Port hit-testing ─────────────────────────────────────────────────────────
// Returns { nodeId, portName, portType, side, px, py } or null
function hitTestPort(x, y) {
  if (!state.graph) return null;
  for (const [nodeId, r] of state.layoutById.entries()) {
    const node = state.graph.nodes.find(n => n.id === nodeId);
    if (!node) continue;
    const def = NODE_DEF_MAP[node.kind];
    if (!def) continue;
    const vr = worldToView(r.x, r.y);

    // Output ports (right side)
    const outs = def.outputs ?? [];
    for (let i = 0; i < outs.length; i++) {
      const py = vr.y + 20 + i * 18;
      const px = vr.x + r.w;
      if (Math.abs(x - px) <= 10 && Math.abs(y - py) <= 8) {
        return { nodeId, portName: outs[i].name, portType: outs[i].type, side: 'out', px, py };
      }
    }
    // Input ports (left side)
    const ins = def.inputs ?? [];
    for (let i = 0; i < ins.length; i++) {
      const py = vr.y + 20 + i * 18;
      const px = vr.x;
      if (Math.abs(x - px) <= 10 && Math.abs(y - py) <= 8) {
        return { nodeId, portName: ins[i].name, portType: ins[i].type, side: 'in', px, py };
      }
    }
  }
  return null;
}
```

```js on:init
term.layerID = 'default';
term.clear();
gui.init();

// Load default graph
state.graph = JSON.parse(JSON.stringify(DEFAULT_GRAPH));
rebuildLayout();

const b = graphBounds();

// Toolbar widgets
const btnAddNode = gui.createButton({
  bounds: { x: 12, y: 8, width: 110, height: 36 },
  label: 'Add Node'
});
const btnDelete = gui.createButton({
  bounds: { x: 130, y: 8, width: 90, height: 36 },
  label: 'Delete'
});
const btnReLayout = gui.createButton({
  bounds: { x: 228, y: 8, width: 100, height: 36 },
  label: 'Re-Layout'
});
const lblStatus = gui.createLabel({
  bounds: { x: 340, y: 14, width: 600, height: 24 },
  text: 'Ready',
  align: 'left'
});

state.widgets = { btnAddNode, btnDelete, btnReLayout, lblStatus };

// Initial compile
recompileIfDirty();
```

```js on:input
if (!event) return;
if (!state) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl:  (event.mods || []).includes('ctrl'),
    alt:   (event.mods || []).includes('alt'),
    meta:  (event.mods || []).includes('meta')
  });
  if (event.key === 'Delete' || event.key === 'Backspace') {
    if (state.selectedId) deleteSelectedNode();
  }
  if (event.key === 'Escape') {
    state.wireFrom = null;
    state.addPanelOpen = false;
  }
}
if (event.type === 'text') gui.handleText(event.text);

if (event.type === 'mouse') {
  const mx = event.x; const my = event.y;
  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';

    if (event.action === 'press') {
      const b = graphBounds();

      // Add-node panel click handling (overlay, check first)
      if (state.addPanelOpen) {
        const pw = 260; const ph = Math.min(440, (ui.metrics.canvasHeight || 720) - 80);
        const px2 = 12; const py2 = b.toolbar.h + 8;
        const inPanel = mx >= px2 && mx < px2 + pw && my >= py2 && my < py2 + ph;
        if (inPanel) {
          // Recalculate row layout to find which node was clicked
          const categories = ['input', 'pattern', 'math', 'color', 'output'];
          let rowY = py2 + 28;
          let found = false;
          for (const cat of categories) {
            const catDefs = NODE_DEFS.filter(d => d.category === cat);
            if (!catDefs.length) continue;
            rowY += 16; // category label
            for (const d of catDefs) {
              if (my >= rowY - 2 && my < rowY + 18) { addNode(d.kind); found = true; break; }
              rowY += 22;
              if (rowY > py2 + ph - 16) break;
            }
            if (found) break;
            rowY += 4;
            if (rowY > py2 + ph - 16) break;
          }
          return;
        } else {
          state.addPanelOpen = false;
        }
      }

      const inGraph = mx >= b.graph.x && mx < b.graph.x + b.graph.w && my >= b.graph.y && my < b.graph.y + b.graph.h;
      const inSplit = my >= b.split.y && my < b.split.y + b.split.h;

      if (inSplit) {
        state.drag = { mode: 'split', ox: my, startPreviewH: state.previewH };
        return;
      }

      if (inGraph) {
        state.addPanelOpen = false;

        // Port hit test first (for wire drawing)
        const port = hitTestPort(mx, my);
        if (port && port.side === 'out') {
          state.wireFrom = port;
          return;
        }

        // Node hit test (world space)
        const w = viewToWorld(mx, my);
        const hitId = hitTestNode(state.layoutById, w.x, w.y);

        if (hitId) {
          state.selectedId = hitId;
          const r = state.layoutById.get(hitId);
          state.drag = { mode: 'node', id: hitId, ox: mx, oy: my, startX: r.x, startY: r.y };
        } else {
          state.selectedId = null;
          state.drag = { mode: 'pan', ox: mx, oy: my, startCamX: state.camX, startCamY: state.camY };
        }
      }
    }

    if (event.action === 'release') {
      if (state.wireFrom) {
        const port = hitTestPort(mx, my);
        if (port && port.side === 'in' && port.nodeId !== state.wireFrom.nodeId) {
          addEdge(state.wireFrom.nodeId, state.wireFrom.portName, port.nodeId, port.portName);
        }
        state.wireFrom = null;
      }
      state.drag = null;
    }
  }
}

if (event.type === 'mouse_move') {
  const mx = event.x; const my = event.y;
  if (!state.drag) {
    const w = viewToWorld(mx, my);
    state.hoveredId = hitTestNode(state.layoutById, w.x, w.y);
    return;
  }
  const d = state.drag;
  if (d.mode === 'pan') {
    state.camX = d.startCamX + (mx - d.ox);
    state.camY = d.startCamY + (my - d.oy);
  } else if (d.mode === 'node') {
    const r = state.layoutById.get(d.id);
    if (r) {
      r.x = d.startX + (mx - d.ox);
      r.y = d.startY + (my - d.oy);
    }
  } else if (d.mode === 'split') {
    const b = graphBounds();
    const H = ui.metrics.canvasHeight || 720;
    state.previewH = clamp(d.startPreviewH - (my - d.ox), 80, H - b.toolbar.h - 80);
  }
}
```

```js on:update
if (!state || !state.widgets) return;

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

// Toolbar button events
if (state.widgets.btnAddNode.wasClicked()) {
  state.addPanelOpen = !state.addPanelOpen;
}
if (state.widgets.btnDelete.wasClicked()) {
  deleteSelectedNode();
}
if (state.widgets.btnReLayout.wasClicked()) {
  state.layoutById = new Map(); // clear positions, force auto-layout
  rebuildLayout();
}

// Inspector: param sliders for selected node
const sel = state.selectedId;
if (sel && state.graph) {
  const node = state.graph.nodes.find(n => n.id === sel);
  const def = node ? NODE_DEF_MAP[node.kind] : null;
  if (def && def.params && def.params.length > 0) {
    for (const p of def.params) {
      const widgetId = `param_${sel}_${p.name}`;
      const existing = state.widgets[widgetId];
      if (!existing) {
        // Create slider on-demand
        const b = graphBounds();
        const idx = def.params.indexOf(p);
        state.widgets[widgetId] = gui.createSlider({
          bounds: { x: 4, y: b.preview.y + 8 + idx * 44, width: 260, height: 36 },
          label: p.label || p.name,
          min: p.min ?? 0,
          max: p.max ?? 1,
          value: Number(node.params?.[p.name] ?? p.default),
          step: p.step ?? 0.01
        });
      } else {
        // Update param from slider changes
        const newVal = existing.getValue();
        const cur = Number(node?.params?.[p.name] ?? p.default);
        if (Math.abs(newVal - cur) > 0.0001) {
          setParam(sel, p.name, newVal);
        }
      }
    }
  }
}

// Update shader time uniform on every frame
if (state.compiledWGSL && !state.compileError) {
  shader.setUniform(state.shaderName, 'time', getTime());
  shader.setUniform(state.shaderName, 'resolution',
    [ui.metrics.canvasWidth || 1280, ui.metrics.canvasHeight || 720]);
}

// Status
recompileIfDirty();
const statusMsg = state.compileError
  ? 'Error: ' + state.compileError.slice(0, 80)
  : state.compiledWGSL ? 'Compiled OK' : 'No graph';
if (state.widgets.lblStatus) state.widgets.lblStatus.setText(statusMsg);
```

```js on:render
if (!state) return;

const base = getStyle('default');
const W = ui.metrics.canvasWidth || 1280;
const H = ui.metrics.canvasHeight || 720;
const mx = getMouseX();
const my = getMouseY();

// Colour palette
const BG        = rgba01(12, 10, 20, 1.0);
const GRAPH_BG  = rgba01(14, 12, 24, 1.0);
const PREVIEW_BG= rgba01(8, 6, 16, 1.0);
const NODE_BG   = rgba01(28, 24, 48, 0.92);
const NODE_SEL  = rgba01(80, 60, 180, 0.5);
const NODE_HOV  = rgba01(50, 40, 100, 0.4);
const BORDER    = rgba01(80, 70, 140, 0.5);
const PORT_OUT  = rgba01(120, 220, 140, 1.0);
const PORT_IN   = rgba01(100, 160, 255, 1.0);
const WIRE      = rgba01(160, 100, 255, 0.7);
const WIRE_PEND = rgba01(255, 200, 80, 0.8);
const TEXT_PRI  = rgba01(230, 220, 255, 1.0);
const TEXT_DIM  = rgba01(150, 140, 200, 0.8);
const TEXT_KIND = rgba01(120, 200, 160, 0.9);

ui.clear(BG);
term.clear();

const b = graphBounds();

// ── Toolbar background ──────────────────────────────────────────────────────
ui.rect(0, 0, W, b.toolbar.h, rgba01(20, 16, 36, 1.0));
ui.rect(0, b.toolbar.h - 1, W, 1, rgba01(80, 70, 140, 0.4));

// ── Graph canvas ────────────────────────────────────────────────────────────
ui.rect(b.graph.x, b.graph.y, b.graph.w, b.graph.h, GRAPH_BG);
ui.pushClipRect(b.graph.x, b.graph.y, b.graph.w, b.graph.h);

// Grid
{
  const step = 40;
  const grid = rgba01(255, 255, 255, 0.025);
  for (let x = ((state.camX % step) + b.graph.x - step); x < b.graph.x + b.graph.w; x += step) {
    ui.rect(Math.round(x), b.graph.y, 1, b.graph.h, grid);
  }
  for (let y = ((state.camY % step) + b.graph.y - step); y < b.graph.y + b.graph.h; y += step) {
    ui.rect(b.graph.x, Math.round(y), b.graph.w, 1, grid);
  }
}

// Edges
if (state.graph) {
  for (const e of state.graph.edges ?? []) {
    const fromId = String(e.from?.node ?? '');
    const toId   = String(e.to?.node ?? '');
    const fromPort = String(e.from?.port ?? '');
    const toPort   = String(e.to?.port ?? '');
    const fr = state.layoutById.get(fromId);
    const tr = state.layoutById.get(toId);
    if (!fr || !tr) continue;

    const fromDef = NODE_DEF_MAP[state.graph.nodes.find(n => n.id === fromId)?.kind ?? ''];
    const toDef   = NODE_DEF_MAP[state.graph.nodes.find(n => n.id === toId)?.kind ?? ''];
    const fromOutIdx = (fromDef?.outputs ?? []).findIndex(p => p.name === fromPort);
    const toInIdx    = (toDef?.inputs    ?? []).findIndex(p => p.name === toPort);

    const fv = worldToView(fr.x + fr.w, fr.y + 20 + fromOutIdx * 18);
    const tv = worldToView(tr.x,        tr.y + 20 + toInIdx * 18);

    // Bezier-like: just draw 3 segments via midpoint
    const mx2 = (fv.x + tv.x) / 2;
    drawLine(ui, fv.x, fv.y, mx2, fv.y, WIRE, 2);
    drawLine(ui, mx2, fv.y, mx2, tv.y, WIRE, 2);
    drawLine(ui, mx2, tv.y, tv.x, tv.y, WIRE, 2);
  }
}

// In-progress wire
if (state.wireFrom) {
  const ox = state.wireFrom.px;
  const oy = state.wireFrom.py;
  const mx2 = (ox + mx) / 2;
  drawLine(ui, ox, oy, mx2, oy, WIRE_PEND, 2);
  drawLine(ui, mx2, oy, mx2, my, WIRE_PEND, 2);
  drawLine(ui, mx2, my, mx, my, WIRE_PEND, 2);
}

// Nodes
if (state.graph) {
  for (const [nodeId, r] of state.layoutById.entries()) {
    const node = state.graph.nodes.find(n => n.id === nodeId);
    if (!node || !r) continue;
    const def = NODE_DEF_MAP[node.kind];
    const vr = worldToView(r.x, r.y);

    const isSel = state.selectedId === nodeId;
    const isHov = state.hoveredId === nodeId;

    const bg = isSel ? NODE_SEL : isHov ? NODE_HOV : NODE_BG;
    ui.rect(vr.x, vr.y, r.w, r.h, bg);
    // Border
    const bCol = isSel ? rgba01(140, 100, 255, 0.9) : BORDER;
    ui.rect(vr.x, vr.y, r.w, 1, bCol);
    ui.rect(vr.x, vr.y + r.h - 1, r.w, 1, bCol);
    ui.rect(vr.x, vr.y, 1, r.h, bCol);
    ui.rect(vr.x + r.w - 1, vr.y, 1, r.h, bCol);
    // Category colour bar on left
    const catColor = def?.category === 'input'  ? rgba01(80, 200, 120, 0.7)
                   : def?.category === 'pattern' ? rgba01(80, 140, 220, 0.7)
                   : def?.category === 'color'   ? rgba01(220, 100, 200, 0.7)
                   : def?.category === 'math'    ? rgba01(220, 180, 60, 0.7)
                   : def?.category === 'output'  ? rgba01(220, 80, 80, 0.7)
                   : BORDER;
    ui.rect(vr.x, vr.y, 3, r.h, catColor);

    // Labels
    ui.text(String(def?.label ?? node.kind), vr.x + 10, vr.y + 6, TEXT_PRI);
    ui.text(nodeId, vr.x + 10, vr.y + 22, TEXT_DIM);

    // Output ports (right side)
    for (let i = 0; i < (def?.outputs ?? []).length; i++) {
      const py = vr.y + 20 + i * 18;
      ui.rect(vr.x + r.w - 6, py - 4, 7, 8, PORT_OUT);
      ui.text(def.outputs[i].name, vr.x + r.w - 60, py - 6, TEXT_KIND);
    }
    // Input ports (left side)
    for (let i = 0; i < (def?.inputs ?? []).length; i++) {
      const py = vr.y + 20 + i * 18;
      ui.rect(vr.x - 1, py - 4, 7, 8, PORT_IN);
      ui.text(def.inputs[i].name, vr.x + 8, py - 6, TEXT_KIND);
    }
  }
}

ui.popClipRect();

// ── Splitter ────────────────────────────────────────────────────────────────
ui.rect(b.split.x, b.split.y, b.split.w, b.split.h, rgba01(40, 35, 70, 1.0));
ui.rect(b.split.x, b.split.y + 2, b.split.w, 2, rgba01(100, 80, 180, 0.5));

// ── Preview area ────────────────────────────────────────────────────────────
ui.rect(b.preview.x, b.preview.y, b.preview.w, b.preview.h, PREVIEW_BG);

// The active shader (if compiled) renders via the `shader` system to the
// screen background, so we just overlay a label + WGSL source peek here.
{
  const px = b.preview.x + 4;
  const py = b.preview.y + 4;
  if (state.compileError) {
    ui.text('Compile Error:', px, py, rgba01(255, 80, 80, 1.0));
    ui.text(state.compileError.slice(0, 120), px, py + 18, rgba01(255, 160, 100, 0.9));
  } else if (!state.compiledWGSL) {
    ui.text('No compiled shader', px, py, TEXT_DIM);
  } else {
    ui.text('Live Preview  (shader running)', px, py, rgba01(120, 220, 140, 1.0));
    // Show first few lines of WGSL
    const lines = state.compiledWGSL.split('\n').slice(0, 6);
    for (let i = 0; i < lines.length; i++) {
      ui.text(lines[i].slice(0, 90), px, py + 20 + i * 16, rgba01(160, 150, 200, 0.6));
    }
  }
}

// Inspector panel (right side of preview, param sliders)
if (state.selectedId && state.graph) {
  const node = state.graph.nodes.find(n => n.id === state.selectedId);
  const def = node ? NODE_DEF_MAP[node.kind] : null;
  if (def) {
    const ix = b.preview.x + 270;
    const iy = b.preview.y + 4;
    ui.text(`[${def.label ?? node.kind}]  id: ${state.selectedId}`, ix, iy, TEXT_PRI);
    if (def.params && def.params.length === 0) {
      ui.text('(no parameters)', ix, iy + 18, TEXT_DIM);
    }
  }
}

// ── Add-node panel (overlay) ───────────────────────────────────────────────
if (state.addPanelOpen) {
  const pw = 260; const ph = Math.min(440, H - 80);
  const px2 = 12; const py2 = b.toolbar.h + 8;
  ui.rect(px2, py2, pw, ph, rgba01(20, 16, 40, 0.97));
  ui.rect(px2, py2, pw, 1, rgba01(120, 100, 220, 0.7));
  ui.rect(px2, py2 + ph - 1, pw, 1, rgba01(120, 100, 220, 0.7));
  ui.rect(px2, py2, 1, ph, rgba01(120, 100, 220, 0.7));
  ui.rect(px2 + pw - 1, py2, 1, ph, rgba01(120, 100, 220, 0.7));
  ui.text('Add Node', px2 + 10, py2 + 8, TEXT_PRI);

  const categories = ['input', 'pattern', 'math', 'color', 'output'];
  let rowY = py2 + 28;
  for (const cat of categories) {
    const catDefs = NODE_DEFS.filter(d => d.category === cat);
    if (!catDefs.length) continue;
    ui.text(cat.toUpperCase(), px2 + 10, rowY, TEXT_DIM);
    rowY += 16;
    for (const d of catDefs) {
      const hovered = mx >= px2 + 4 && mx < px2 + pw - 4 && my >= rowY - 2 && my < rowY + 18;
      if (hovered) ui.rect(px2 + 4, rowY - 2, pw - 8, 20, rgba01(80, 60, 160, 0.5));
      ui.text(d.label, px2 + 14, rowY, hovered ? rgba01(240, 220, 255, 1.0) : TEXT_PRI);
      // Click detection in render is not ideal but works for overlay panels
      rowY += 22;
      if (rowY > py2 + ph - 16) break;
    }
    rowY += 4;
    if (rowY > py2 + ph - 16) break;
  }
}

// GUI overlay
gui.render(ui);
```
