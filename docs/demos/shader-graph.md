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
  // IMPORTANT: WebGPU UI renderer has a per-frame rect limit (4096).
  // Drawing wires one pixel at a time will blow that limit as edges get longer,
  // causing later UI (sliders/preview) to silently stop rendering.
  const t = Math.max(1, Math.round(thickness || 1));
  const t2 = Math.floor(t / 2);

  // Fast path: axis-aligned segments as a single rectangle.
  if (Math.abs(y1 - y0) < 0.001) {
    const xMin = Math.min(x0, x1);
    const xMax = Math.max(x0, x1);
    ui.rect(Math.round(xMin), Math.round(y0) - t2, Math.round(xMax - xMin), t, color);
    return;
  }
  if (Math.abs(x1 - x0) < 0.001) {
    const yMin = Math.min(y0, y1);
    const yMax = Math.max(y0, y1);
    ui.rect(Math.round(x0) - t2, Math.round(yMin), t, Math.round(yMax - yMin), color);
    return;
  }

  // Fallback for non-axis-aligned segments: cap steps.
  const dx = x1 - x0; const dy = y1 - y0;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return;
  const stepPx = 4;
  const steps = Math.max(1, Math.min(256, Math.ceil(len / stepPx)));
  for (let i = 0; i <= steps; i++) {
    const tt = i / steps;
    ui.rect(Math.round(x0 + dx * tt) - t2, Math.round(y0 + dy * tt) - t2, t, t, color);
  }
}

// ─── Colour helpers ────────────────────────────────────────────────────────────
function rgba01(r, g, b, a01) {
  return ui.colors.rgba(r, g, b, Math.round(Math.max(0, Math.min(1, a01)) * 255));
}
// NOTE: In Storie's SES sandbox, top-level `function` declarations are auto-bound
// onto `scope` (they do not create a stable global binding). Use `scope.clamp(...)`
// everywhere to avoid capturing a missing/non-function `clamp` identifier.
// Also: `scope` persists across hot reloads, so always overwrite these helpers
// to avoid keeping a truthy-but-non-function value from a previous run.
scope.clamp = function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); };

// ─── JS math helpers (mirror WGSL helpers for software preview) ───────────────
scope._fract = function _fract(x) { return x - Math.floor(x); };
scope._jMix = function _jMix(a, b, t) { return a + (b - a) * t; };
scope._h21 = function _h21(px, py) { return scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453); };
scope._h22 = function _h22(px, py) { return [scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453), scope._fract(Math.sin(px * 269.5 + py * 183.3) * 43758.5453)]; };

// Make clamp resilient when bounds are accidentally reversed.
scope.clamp = function clamp(v, a, b) {
  if (a > b) { const t = a; a = b; b = t; }
  return Math.max(a, Math.min(b, v));
};

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
    wgsl: (p, ins, out) => `let ${out}_uv: vec2f = uv;`,
    js:   (p, ins, u, v, t) => ({ uv: [u, v] })
  },
  {
    kind: 'time',
    label: 'Time',
    category: 'input',
    inputs: [],
    outputs: [{ name: 'time', type: 'f32' }],
    params: [],
    wgsl: (p, ins, out) => `let ${out}_time: f32 = time;`,
    js:   (p, ins, u, v, t) => ({ time: t })
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
    wgsl: (p, ins, out) => `let ${out}_color: vec4f = vec4f(${p.r ?? 1.0}f, ${p.g ?? 0.5}f, ${p.b ?? 0.2}f, ${p.a ?? 1.0}f);`,
    js:   (p, ins, u, v, t) => ({ color: [p.r ?? 1.0, p.g ?? 0.5, p.b ?? 0.2, p.a ?? 1.0] })
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
    },
    js: (p, ins, u, v, t) => {
      const uv = ins.uv || [u, v];
      const sc = p.scale ?? 8.0;
      const cx = Math.floor(uv[0] * sc); const cy = Math.floor(uv[1] * sc);
      return { value: scope._fract((cx + cy) * 0.5) * 2.0 };
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
    },
    js: (p, ins, u, v, t) => {
      const uv = ins.uv || [u, v]; const ti = ins.time !== undefined ? ins.time : t;
      return { value: Math.sin(uv[0] * (p.freq ?? 4.0) * 6.28318 + ti * (p.speed ?? 1.0)) * 0.5 + 0.5 };
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
    },
    js: (p, ins, u, v, t) => {
      const uv = ins.uv || [u, v]; const ti = ins.time !== undefined ? ins.time : t;
      const sc = p.scale ?? 3.0; const oct = Math.round(p.octaves ?? 5); const spd = p.speed ?? 0.2;
      let px = uv[0] * sc + ti * spd; let py = uv[1] * sc;
      let val = 0; let amp = 0.5; let freq = 1.0;
      for (let i = 0; i < oct; i++) {
        val += amp * (scope._h21(px * freq, py * freq) * 2.0 - 1.0);
        freq *= 2.0; amp *= 0.5; px = px * 2.01 + 0.13; py = py * 2.01 + 0.7;
      }
      return { value: scope.clamp(val * 0.5 + 0.5, 0, 1) };
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
    },
    js: (p, ins, u, v, t) => {
      const uv = ins.uv || [u, v]; const ti = ins.time !== undefined ? ins.time : t;
      const sc = p.scale ?? 5.0; const spd = p.speed ?? 0.3;
      const sx = uv[0] * sc; const sy = uv[1] * sc;
      const ix = Math.floor(sx); const iy = Math.floor(sy);
      let md = 8.0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = ix + dx; const ny = iy + dy;
          const h = scope._h22(nx, ny);
          const hpx = h[0] * 0.5 + 0.5 + Math.sin(ti * spd + scope._h21(nx, ny) * 6.28) * 0.3;
          const hpy = h[1] * 0.5 + 0.5 + Math.cos(ti * spd + scope._h21(nx + 1, ny) * 6.28) * 0.3;
          const ddx = (sx - ix) - (nx - ix + hpx); const ddy = (sy - iy) - (ny - iy + hpy);
          md = Math.min(md, Math.sqrt(ddx * ddx + ddy * ddy));
        }
      }
      return { value: scope.clamp(md, 0, 1) };
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
    },
    js: (p, ins, u, v, t) => {
      const a = ins.a !== undefined ? ins.a : 0.0;
      const b = ins.b !== undefined ? ins.b : 1.0;
      const f = ins.factor !== undefined ? ins.factor : (p.factor ?? 0.5);
      return { result: scope._jMix(a, b, f) };
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
    },
    js: (p, ins, u, v, t) => {
      const val = ins.value !== undefined ? ins.value : 0.5;
      return { color: [scope._jMix(p.r0 ?? 0.05, p.r1 ?? 0.8, val), scope._jMix(p.g0 ?? 0.02, p.g1 ?? 0.5, val), scope._jMix(p.b0 ?? 0.15, p.b1 ?? 1.0, val), 1.0] };
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
    },
    js: (p, ins, u, v, t) => {
      const a = ins.a || [1,1,1,1]; const b = ins.b || [1,1,1,1];
      return { color: [a[0]*b[0], a[1]*b[1], a[2]*b[2], (a[3]??1)*(b[3]??1)] };
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
    },
    js: (p, ins, u, v, t) => ({ _result: ins.color || [0,0,0,1] })
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

// ─── Software graph evaluator (for preview panel) ─────────────────────────────
// Evaluates the node graph at a single UV coordinate in JavaScript.
// Returns [r, g, b, a] (each 0-1) for the output node colour, or null on error.
function evalGraphAtUV(graph, u, v, t, _cachedOrder) {
  if (!graph) return null;
  const topo = _cachedOrder ? { order: _cachedOrder, hasCycle: false } : topoSort(graph);
  if (topo.hasCycle) return null;
  // port values keyed by "nodeId.portName"
  const vals = {};
  for (let ni = 0; ni < topo.order.length; ni++) {
    const nodeId = topo.order[ni];
    const node = graph.nodes.find(function(n) { return n.id === nodeId; });
    if (!node) continue;
    const def = NODE_DEF_MAP[node.kind];
    if (!def || typeof def.js !== 'function') continue;
    // Gather inputs from upstream edges
    const ins = {};
    for (let ei = 0; ei < (graph.edges || []).length; ei++) {
      const e = graph.edges[ei];
      if (String(e.to && e.to.node) === nodeId) {
        ins[e.to.port] = vals[e.from.node + '.' + e.from.port];
      }
    }
    const outs = def.js(node.params || {}, ins, u, v, t);
    // Store outputs
    for (let pi = 0; pi < (def.outputs || []).length; pi++) {
      vals[nodeId + '.' + def.outputs[pi].name] = outs && outs[def.outputs[pi].name];
    }
    if (node.kind === 'output') {
      const c = outs && outs._result;
      if (Array.isArray(c)) return [c[0]||0, c[1]||0, c[2]||0, c[3]!==undefined?c[3]:1];
      return [0.1, 0.05, 0.2, 1.0];
    }
  }
  return [0.1, 0.05, 0.2, 1.0];
}
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
  previewH: 260,       // height of preview area at the bottom

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
  addPanelX: 12,
  addPanelY: 8,
  longPress: null,

  // Shader compilation
  shaderName: 'shader-graph-live',
  compiledWGSL: null,
  compileError: null,
  shaderDirty: true,
  lastCompileTime: 0,

  // Inspector
  inspectedId: null,
  inspectorScrollY: 0,
};

// ─── Layout helpers ───────────────────────────────────────────────────────────
function graphBounds() {
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  const toolbarH = 0;
  const previewH = scope.clamp(state.previewH || 260, 140, H - toolbarH - 100);
  state.previewH = previewH;
  const graphH = H - toolbarH - previewH - 8; // 8px splitter
  return {
    toolbar: { x: 0, y: 0, w: W, h: toolbarH },
    graph:   { x: 0, y: toolbarH, w: W, h: graphH },
    split:   { x: 0, y: toolbarH + graphH, w: W, h: 8 },
    preview: { x: 0, y: toolbarH + graphH + 8, w: W, h: previewH }
  };
}

function openAddPanelAt(mx, my) {
  const b = graphBounds();
  const pw = 260;
  const ph = Math.min(440, (ui.metrics.canvasHeight || 720) - 80);

  // Prefer opening within the graph canvas.
  const minX = b.graph.x + 8;
  const maxX = b.graph.x + b.graph.w - pw - 8;
  const minY = b.graph.y + 8;
  const maxY = b.graph.y + b.graph.h - ph - 8;

  state.addPanelX = scope.clamp(mx - pw / 2, minX, maxX);
  state.addPanelY = scope.clamp(my - 20,    minY, maxY);
  state.addPanelScroll = 0;
  state.addPanelOpen = true;
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
  // Validate WGSL on GPU but never set as active — preview renders via JS software rasterizer.
  // Only surface real thrown errors; a false return (e.g. WebGPU not yet ready) is not a WGSL error.
  shader.define(state.shaderName, wgsl, { kind: 'fragment' }).catch(function(e) {
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
// Guard against hot-reload / persisted scope corruption.
if (typeof scope.clamp !== 'function') scope.clamp = function clamp(v, a, b) { if (a > b) { const t = a; a = b; b = t; } return Math.max(a, Math.min(b, v)); };
if (typeof scope._fract !== 'function') scope._fract = function _fract(x) { return x - Math.floor(x); };
if (typeof scope._jMix !== 'function') scope._jMix = function _jMix(a, b, t) { return a + (b - a) * t; };
if (typeof scope._h21 !== 'function') scope._h21 = function _h21(px, py) { return scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453); };
if (typeof scope._h22 !== 'function') scope._h22 = function _h22(px, py) { return [scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453), scope._fract(Math.sin(px * 269.5 + py * 183.3) * 43758.5453)]; };

term.layerID = 'default';
term.clear();
gui.init();

// Fresh widget map every load (state persists across hot reloads).
state.widgets = {};
state.addPanelOpen = false;
state.longPress = null;

// Load default graph
state.graph = JSON.parse(JSON.stringify(DEFAULT_GRAPH));
rebuildLayout();

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

  // Desktop: right-click opens the Add Node menu.
  if (event.button === 'right' && event.action === 'press') {
    const b = graphBounds();
    const inGraph = mx >= b.graph.x && mx < b.graph.x + b.graph.w && my >= b.graph.y && my < b.graph.y + b.graph.h;
    if (inGraph) {
      openAddPanelAt(mx, my);
      return;
    }
  }

  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';

    if (event.action === 'press') {
      const b = graphBounds();

      // Add-node panel click handling (overlay, check first)
      if (state.addPanelOpen) {
        const pw = 260; const ph = Math.min(440, (ui.metrics.canvasHeight || 720) - 80);
        const px2 = state.addPanelX != null ? state.addPanelX : 12;
        const py2 = state.addPanelY != null ? state.addPanelY : (b.toolbar.h + 8);
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
      const inSplit = my >= b.split.y && my < b.split.y + b.split.h + 2; // slight tolerance

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
          // Mobile-friendly: arm long-press to open Add Node. If the pointer
          // moves, this becomes a pan drag.
          state.longPress = { x: mx, y: my, t0: Date.now() };
          state.drag = { mode: 'panPending', ox: mx, oy: my, startCamX: state.camX, startCamY: state.camY };
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
      state.longPress = null;
    }
  }
  // Immediate GUI mouse handling (slider drag requires same-frame input)
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}

// Inspector scroll: click on scroll arrows drawn in on:render
if (event.type === 'mouse' && event.action === 'press') {
  const emx = event.x; const emy = event.y;
  const bb = graphBounds();
  const INSP_W2 = 296;
  const SAX = bb.preview.x + INSP_W2 - 22;
  const inArrowX = emx >= SAX && emx < SAX + 18;
  if (inArrowX) {
    const upY = bb.preview.y + 4;
    const dnY = bb.preview.y + bb.preview.h - 22;
    if (emy >= upY && emy < upY + 18) { state.inspectorScrollY = Math.max(0, (state.inspectorScrollY || 0) - 40); }
    if (emy >= dnY && emy < dnY + 18) { state.inspectorScrollY = (state.inspectorScrollY || 0) + 40; }
  }
}

if (event.type === 'mouse_move') {
  const mx = event.x; const my = event.y;
  gui.handleMouse(mx, my, state.mouseDownLeft);
  if (!state.drag) {
    const w = viewToWorld(mx, my);
    state.hoveredId = hitTestNode(state.layoutById, w.x, w.y);
    return;
  }
  const d = state.drag;
  if (d.mode === 'panPending') {
    const dx = mx - d.ox;
    const dy = my - d.oy;
    if ((dx * dx + dy * dy) > (6 * 6)) {
      state.longPress = null;
      state.drag = { mode: 'pan', ox: d.ox, oy: d.oy, startCamX: d.startCamX, startCamY: d.startCamY };
    }
    return;
  }
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
    state.previewH = scope.clamp(d.startPreviewH - (my - d.ox), 80, H - b.toolbar.h - 80);
  }
}
```

```js on:update
if (!state || !state.widgets) return;

// Guard against hot-reload / persisted scope corruption.
if (typeof scope.clamp !== 'function') scope.clamp = function clamp(v, a, b) { if (a > b) { const t = a; a = b; b = t; } return Math.max(a, Math.min(b, v)); };
if (typeof scope._fract !== 'function') scope._fract = function _fract(x) { return x - Math.floor(x); };
if (typeof scope._jMix !== 'function') scope._jMix = function _jMix(a, b, t) { return a + (b - a) * t; };
if (typeof scope._h21 !== 'function') scope._h21 = function _h21(px, py) { return scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453); };
if (typeof scope._h22 !== 'function') scope._h22 = function _h22(px, py) { return [scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453), scope._fract(Math.sin(px * 269.5 + py * 183.3) * 43758.5453)]; };

// Long-press on empty graph space opens Add Node.
if (state.longPress && state.mouseDownLeft && !state.addPanelOpen) {
  const lp = state.longPress;
  const dt = Date.now() - (lp.t0 || 0);
  const dx = (getMouseX() - lp.x);
  const dy = (getMouseY() - lp.y);
  if (dt > 520 && (dx * dx + dy * dy) <= (6 * 6) && (!state.drag || state.drag.mode === 'panPending')) {
    openAddPanelAt(lp.x, lp.y);
    state.longPress = null;
    state.drag = null;
  }
}

// Inspector: param sliders — use gui.setGroupVisible() for reliable show/hide
// Group key: the node id string (e.g. 'noise0')
const sel = state.selectedId;
const bInsp = graphBounds();
const INSP_PAD = 8;
const ITEM_H = 36;
const ITEM_GAP = 6;
const HEADER_H = 44;  // space for title + id text above sliders

// Slider colors (theme-derived). Default slider track uses the theme surface bg,
// which can look too opaque against the inspector panel.
const _baseStyle = getStyle('default');
const _accent1 = getStyle('accent1');
const _accent2 = getStyle('accent2');
function _cr(c) { return (Number(c) >>> 24) & 255; }
function _cg(c) { return (Number(c) >>> 16) & 255; }
function _cb(c) { return (Number(c) >>>  8) & 255; }
function _cl01(t) { return Math.max(0, Math.min(1, Number(t) || 0)); }
function _withAlpha(c, a01) {
  const a = Math.round(_cl01(a01) * 255);
  return ui.colors.rgba(_cr(c), _cg(c), _cb(c), a);
}
function _mix(c0, c1, t) {
  const tt = _cl01(t);
  const inv = 1 - tt;
  return ui.colors.rgba(
    Math.round(_cr(c0) * inv + _cr(c1) * tt),
    Math.round(_cg(c0) * inv + _cg(c1) * tt),
    Math.round(_cb(c0) * inv + _cb(c1) * tt),
    255
  );
}
const SLIDER_TRACK_ALPHA = 0.16;
const _sliderTrackColor = _withAlpha(_mix(_baseStyle.fg, _accent2.fg, 0.12), SLIDER_TRACK_ALPHA);
const _sliderKnobColor = _withAlpha(_accent2.fg, 0.85);
const _sliderKnobHoverColor = _withAlpha(_accent1.fg, 0.92);

// Selection changed: switch visible group
if (state.inspectedId !== sel) {
  if (state.inspectedId != null) { gui.setGroupVisible(state.inspectedId, false); }
  state.inspectorScrollY = 0;
  state.inspectedId = sel;
  if (sel != null) { gui.setGroupVisible(sel, true); }
}

// Keep the selected group's widgets visible even during drags.
if (sel != null) gui.setGroupVisible(sel, true);

if (sel && state.graph) {
  const node = state.graph.nodes.find(function(n) { return n.id === sel; });
  const def = node ? NODE_DEF_MAP[node.kind] : null;
  const params = (def && def.params) ? def.params : [];
  const totalH = HEADER_H + params.length * (ITEM_H + ITEM_GAP) + (ITEM_H + ITEM_GAP);
  const availH = bInsp.preview.h - INSP_PAD * 2;
  const maxScroll = Math.max(0, totalH - availH);
  if ((state.inspectorScrollY || 0) > maxScroll) state.inspectorScrollY = maxScroll;
  if ((state.inspectorScrollY || 0) < 0) state.inspectorScrollY = 0;

  for (let pi2 = 0; pi2 < params.length; pi2++) {
    const p = params[pi2];
    const widgetId = 'param_' + sel + '_' + p.name;
    const sliderY = bInsp.preview.y + HEADER_H + INSP_PAD + pi2 * (ITEM_H + ITEM_GAP) - (state.inspectorScrollY || 0);

    if (!state.widgets[widgetId]) {
      // Create slider, assign to node's group for clean show/hide
      state.widgets[widgetId] = gui.createSlider({
        group: sel,
        bounds: { x: bInsp.preview.x + INSP_PAD, y: sliderY, width: 278 - INSP_PAD * 2, height: ITEM_H },
        label: p.label || p.name,
        min: p.min != null ? p.min : 0,
        max: p.max != null ? p.max : 1,
        value: Number(node.params ? (node.params[p.name] != null ? node.params[p.name] : p.default) : p.default),
        step: p.step != null ? p.step : 0.01,
        sliderStyle: {
          fg: _baseStyle.fg,
          trackColor: _sliderTrackColor,
          knobColor: _sliderKnobColor,
          knobHoverColor: _sliderKnobHoverColor
        }
      });
    } else {
      const w = state.widgets[widgetId];
      // Update position for scroll (use setBounds to stay in the API)
      w.setBounds({ x: bInsp.preview.x + INSP_PAD, y: sliderY, width: 278 - INSP_PAD * 2, height: ITEM_H });
      // Keep theme-derived, lower-opacity slider styling in sync.
      if (w.sliderStyle) {
        w.sliderStyle.fg = _baseStyle.fg;
        w.sliderStyle.trackColor = _sliderTrackColor;
        w.sliderStyle.knobColor = _sliderKnobColor;
        w.sliderStyle.knobHoverColor = _sliderKnobHoverColor;
      }
      // Sync param from slider value
      const newVal = w.getValue();
      const cur = Number(node.params ? (node.params[p.name] != null ? node.params[p.name] : p.default) : p.default);
      if (Math.abs(newVal - cur) > 0.0001) { setParam(sel, p.name, newVal); }
    }
  }

  // Delete button inline after the sliders (scrolls with inspector content).
  const delId = 'btnDeleteNode_' + sel;
  const delY = bInsp.preview.y + HEADER_H + INSP_PAD + params.length * (ITEM_H + ITEM_GAP) - (state.inspectorScrollY || 0);
  const delBounds = { x: bInsp.preview.x + INSP_PAD, y: delY, width: 278 - INSP_PAD * 2, height: ITEM_H };
  if (!state.widgets[delId]) {
    state.widgets[delId] = gui.createButton({ group: sel, bounds: delBounds, label: 'Delete Node' });
  } else {
    state.widgets[delId].setBounds(delBounds);
  }
  if (state.widgets[delId].wasClicked()) deleteSelectedNode();
}

// Compile
recompileIfDirty();
```

```js on:render
if (!state) return;

// Guard against hot-reload / persisted scope corruption.
if (typeof scope.clamp !== 'function') scope.clamp = function clamp(v, a, b) { if (a > b) { const t = a; a = b; b = t; } return Math.max(a, Math.min(b, v)); };
if (typeof scope._fract !== 'function') scope._fract = function _fract(x) { return x - Math.floor(x); };
if (typeof scope._jMix !== 'function') scope._jMix = function _jMix(a, b, t) { return a + (b - a) * t; };
if (typeof scope._h21 !== 'function') scope._h21 = function _h21(px, py) { return scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453); };
if (typeof scope._h22 !== 'function') scope._h22 = function _h22(px, py) { return [scope._fract(Math.sin(px * 127.1 + py * 311.7) * 43758.5453), scope._fract(Math.sin(px * 269.5 + py * 183.3) * 43758.5453)]; };

// Keep GUI alive even if some graph draw path throws.
state._lastRenderErrAt = state._lastRenderErrAt || 0;
try {
  const base = getStyle('default');
  const bgAlt = getStyle('bgAlt');
  const dim = getStyle('dim');
  const hover = getStyle('hover');
  const focus = getStyle('focus');
  const active = getStyle('active');
  const accent1 = getStyle('accent1');
  const accent2 = getStyle('accent2');
  const accent3 = getStyle('accent3');
  const success = getStyle('success');
  const error = getStyle('error');

  // Theme color helpers (packed 0xRRGGBBAA).
  function _cr(c) { return (Number(c) >>> 24) & 255; }
  function _cg(c) { return (Number(c) >>> 16) & 255; }
  function _cb(c) { return (Number(c) >>>  8) & 255; }
  function _ca(c) { return (Number(c) >>>  0) & 255; }
  function _cl01(t) { return Math.max(0, Math.min(1, Number(t) || 0)); }
  function withAlpha(c, a01) {
    return ui.colors.rgba(_cr(c), _cg(c), _cb(c), Math.round(_cl01(a01) * 255));
  }
  function mix(c0, c1, t) {
    const tt = _cl01(t);
    const inv = 1 - tt;
    return ui.colors.rgba(
      Math.round(_cr(c0) * inv + _cr(c1) * tt),
      Math.round(_cg(c0) * inv + _cg(c1) * tt),
      Math.round(_cb(c0) * inv + _cb(c1) * tt),
      Math.round(_ca(c0) * inv + _ca(c1) * tt)
    );
  }
  const W = ui.metrics.canvasWidth || 1280;
  const H = ui.metrics.canvasHeight || 720;
  const mx = getMouseX();
  const my = getMouseY();

  // Theme-derived palette
  const BG         = base.bg;
  const GRAPH_BG   = bgAlt.bg;
  const PREVIEW_BG = mix(base.bg, bgAlt.bg, 0.55);

  const NODE_BG    = mix(bgAlt.bg, base.fg, 0.06);
  const NODE_SEL   = withAlpha(active.bg, 0.80);
  const NODE_HOV   = withAlpha(hover.bg, 0.75);

  const BORDER     = withAlpha(mix(base.fg, accent2.fg, 0.15), 0.55);
  const BORDER_SEL = withAlpha(accent1.fg, 0.95);

  const PORT_OUT   = withAlpha(accent3.fg, 0.95);
  const PORT_IN    = withAlpha(accent2.fg, 0.95);
  const WIRE       = withAlpha(accent2.fg, 0.60);
  const WIRE_PEND  = withAlpha(accent1.fg, 0.85);

  const TEXT_PRI   = base.fg;
  const TEXT_DIM   = dim.fg;
  const TEXT_KIND  = withAlpha(accent3.fg, 0.90);

  const GRID_LINE  = withAlpha(base.fg, 0.05);
  const PANEL_BG   = withAlpha(bgAlt.bg, 0.92);
  const PANEL_DIV  = withAlpha(mix(base.fg, accent2.fg, 0.10), 0.25);
  const SPLIT_BG   = mix(bgAlt.bg, accent2.fg, 0.10);
  const SPLIT_HOV  = mix(bgAlt.bg, accent2.fg, 0.18);
  const SPLIT_BAR  = withAlpha(accent2.fg, 0.40);
  const GRIP_DOT   = withAlpha(accent2.fg, 0.45);
  const GRIP_DOT_H = withAlpha(accent1.fg, 0.65);

  function catColorFor(category, a01) {
    const a = a01 != null ? a01 : 1;
    if (category === 'input')  return withAlpha(accent3.fg, a);
    if (category === 'pattern')return withAlpha(accent2.fg, a);
    if (category === 'math')   return withAlpha(accent1.fg, a);
    if (category === 'color')  return withAlpha(mix(accent1.fg, accent3.fg, 0.5), a);
    if (category === 'output') return withAlpha(mix(accent1.fg, base.fg, 0.35), a);
    return withAlpha(base.fg, a * 0.25);
  }

  ui.clear(BG);
  term.clear();

  const b = graphBounds();

  // ── Graph canvas ────────────────────────────────────────────────────────────
  ui.rect(b.graph.x, b.graph.y, b.graph.w, b.graph.h, GRAPH_BG);
  ui.pushClipRect(b.graph.x, b.graph.y, b.graph.w, b.graph.h);
try {
  // Grid
  {
    const step = 40;
    const grid = GRID_LINE;
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
      const bCol = isSel ? BORDER_SEL : BORDER;
      ui.rect(vr.x, vr.y, r.w, 1, bCol);
      ui.rect(vr.x, vr.y + r.h - 1, r.w, 1, bCol);
      ui.rect(vr.x, vr.y, 1, r.h, bCol);
      ui.rect(vr.x + r.w - 1, vr.y, 1, r.h, bCol);
      // Category colour bar on left
      const catColor = catColorFor(def?.category, 0.70);
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
  } finally {
    ui.popClipRect();
  }

// ── Splitter (draggable — drag up to expand bottom panel) ──────────────────
const splitHover = mx >= b.split.x && mx < b.split.x + b.split.w && my >= b.split.y && my < b.split.y + b.split.h;
ui.rect(b.split.x, b.split.y, b.split.w, b.split.h, splitHover ? SPLIT_HOV : SPLIT_BG);
ui.rect(b.split.x, b.split.y + 2, b.split.w, 2, SPLIT_BAR);
// Grip dots in the center
{
  const gx = Math.floor(W / 2) - 20;
  const gy = b.split.y + 1;
  for (let gi = 0; gi < 5; gi++) {
    ui.rect(gx + gi * 10, gy, 4, 4, splitHover ? GRIP_DOT_H : GRIP_DOT);
  }
}

  // ── Preview area: inspector strip (left) + shader square (right) ─────────────
  const INSP_W  = 296;
  const INSP_PAD = 8;
  const PREV_SZ = Math.min(b.preview.h - 16, 240);  // square size
  const prevSqX = b.preview.x + b.preview.w - PREV_SZ - INSP_PAD;
  const prevSqY = b.preview.y + Math.max(0, Math.floor((b.preview.h - PREV_SZ) / 2));

  // Background
  ui.rect(b.preview.x, b.preview.y, b.preview.w, b.preview.h, PREVIEW_BG);
  // Inspector strip background
  ui.rect(b.preview.x, b.preview.y, INSP_W, b.preview.h, PANEL_BG);
  // Divider line
  ui.rect(b.preview.x + INSP_W, b.preview.y, 1, b.preview.h, PANEL_DIV);

  // Inspector content (clipped to strip)
  ui.pushClipRect(b.preview.x, b.preview.y, INSP_W, b.preview.h);
  try {
    if (!state.selectedId) {
      ui.text('No node selected', b.preview.x + INSP_PAD, b.preview.y + INSP_PAD, TEXT_DIM);
      ui.text('Click a node to inspect it', b.preview.x + INSP_PAD, b.preview.y + INSP_PAD + 16, withAlpha(TEXT_DIM, 0.75));
    } else {
      const selNode = state.graph ? state.graph.nodes.find(function(n) { return n.id === state.selectedId; }) : null;
      const selDef = selNode ? NODE_DEF_MAP[selNode.kind] : null;
      if (selDef) {
        const hx = b.preview.x + INSP_PAD;
        const hy = b.preview.y + INSP_PAD;
        // Category colour dot
        const dotCol = catColorFor(selDef.category, 1.0);
        ui.rect(hx, hy + 3, 6, 10, dotCol);
        ui.text(selDef.label != null ? selDef.label : selNode.kind, hx + 10, hy, TEXT_PRI);
        ui.text('id: ' + state.selectedId, hx + 10, hy + 14, TEXT_DIM);
        if (!selDef.params || selDef.params.length === 0) {
          ui.text('(no parameters)', hx + 10, hy + 34, TEXT_DIM);
        }
      }
    }
  } finally {
    ui.popClipRect();
  }

// Scroll arrows for inspector (if needed)
{
  const selNode2 = state.selectedId && state.graph ? state.graph.nodes.find(function(n) { return n.id === state.selectedId; }) : null;
  const selDef2 = selNode2 ? NODE_DEF_MAP[selNode2.kind] : null;
  const paramCount = selDef2 && selDef2.params ? selDef2.params.length : 0;
  const totalContentH = 34 + paramCount * 40;
  const availH = b.preview.h - INSP_PAD * 2;
  const maxScroll = Math.max(0, totalContentH - availH);
  const sax = b.preview.x + INSP_W - 22;
  if (maxScroll > 0 && (state.inspectorScrollY || 0) > 0) {
    ui.rect(sax, b.preview.y + 4, 18, 18, withAlpha(focus.bg, 0.75));
    ui.text('\u25b2', sax + 5, b.preview.y + 5, withAlpha(accent2.fg, 0.90));
  }
  if (maxScroll > 0 && (state.inspectorScrollY || 0) < maxScroll) {
    ui.rect(sax, b.preview.y + b.preview.h - 22, 18, 18, withAlpha(focus.bg, 0.75));
    ui.text('\u25bc', sax + 5, b.preview.y + b.preview.h - 21, withAlpha(accent2.fg, 0.90));
  }
}

// Shader preview square (bottom-right)
ui.rect(prevSqX - 2, prevSqY - 2, PREV_SZ + 4, PREV_SZ + 4, withAlpha(accent2.fg, 0.25));
ui.rect(prevSqX, prevSqY, PREV_SZ, PREV_SZ, withAlpha(base.bg, 1.0));
ui.pushClipRect(prevSqX, prevSqY, PREV_SZ, PREV_SZ);
try {
  if (state.graph && state.compiledWGSL) {
    const topoCache = topoSort(state.graph);
    if (!topoCache.hasCycle) {
      const PREV_PX = 6;
      const pcols = Math.max(1, Math.floor(PREV_SZ / PREV_PX));
      const prows = Math.max(1, Math.floor(PREV_SZ / PREV_PX));
      const pt = getTime();

      // Sanitize channel values to avoid NaNs breaking color creation.
      function _ch(x) {
        const n = Number(x);
        return Number.isFinite(n) ? n : 0;
      }

      for (let prow = 0; prow < prows; prow++) {
        for (let pcol = 0; pcol < pcols; pcol++) {
          const pu = (pcol + 0.5) / pcols;
          const pv = (prow + 0.5) / prows;
          const rgba = evalGraphAtUV(state.graph, pu, pv, pt, topoCache.order);
          if (rgba && rgba.length >= 3) {
            const r = scope.clamp(_ch(rgba[0]), 0, 1);
            const g = scope.clamp(_ch(rgba[1]), 0, 1);
            const b2 = scope.clamp(_ch(rgba[2]), 0, 1);
            const pc = ui.colors.rgba(
              Math.round(r * 255),
              Math.round(g * 255),
              Math.round(b2 * 255),
              255
            );
            ui.rect(prevSqX + pcol * PREV_PX, prevSqY + prow * PREV_PX, PREV_PX, PREV_PX, pc);
          }
        }
      }
    }
  }
} catch(_e) {
  // If preview rendering fails, keep the rest of the UI alive.
  // Throttle logs to avoid spamming on every frame.
  state._lastPreviewErrAt = state._lastPreviewErrAt || 0;
  const now = Date.now();
  if (now - state._lastPreviewErrAt > 1000) {
    state._lastPreviewErrAt = now;
    try { console.warn('[shader-graph] preview render failed:', _e); } catch { /* ignore */ }
  }
} finally {
  ui.popClipRect();
}
// Status below preview square
{
  const slx = prevSqX;
  const sly = prevSqY + PREV_SZ + 5;
  if (state.compileError) {
    ui.text('WGSL Error', slx, sly, error.fg);
  } else if (state.compiledWGSL) {
    ui.text('Live Preview', slx, sly, withAlpha(success.fg, 0.95));
  } else {
    ui.text('No shader', slx, sly, TEXT_DIM);
  }
}

// ── Add-node panel (overlay) ───────────────────────────────────────────────
if (state.addPanelOpen) {
  const pw = 260; const ph = Math.min(440, H - 80);
  const px2 = state.addPanelX != null ? state.addPanelX : 12;
  const py2 = state.addPanelY != null ? state.addPanelY : (b.toolbar.h + 8);
  ui.rect(px2, py2, pw, ph, withAlpha(bgAlt.bg, 0.97));
  ui.rect(px2, py2, pw, 1, withAlpha(accent2.fg, 0.60));
  ui.rect(px2, py2 + ph - 1, pw, 1, withAlpha(accent2.fg, 0.60));
  ui.rect(px2, py2, 1, ph, withAlpha(accent2.fg, 0.60));
  ui.rect(px2 + pw - 1, py2, 1, ph, withAlpha(accent2.fg, 0.60));
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
      if (hovered) ui.rect(px2 + 4, rowY - 2, pw - 8, 20, withAlpha(focus.bg, 0.85));
      ui.text(d.label, px2 + 14, rowY, hovered ? accent1.fg : TEXT_PRI);
      // Click detection in render is not ideal but works for overlay panels
      rowY += 22;
      if (rowY > py2 + ph - 16) break;
    }
    rowY += 4;
    if (rowY > py2 + ph - 16) break;
  }
}

} catch(_e) {
  const now = Date.now();
  if (now - state._lastRenderErrAt > 1000) {
    state._lastRenderErrAt = now;
    try { console.warn('[shader-graph] render failed:', _e); } catch { /* ignore */ }
  }
} finally {
  // GUI overlay should always render (sliders, buttons, etc.)
  try { gui.render(ui); } catch { /* ignore */ }
}
```
