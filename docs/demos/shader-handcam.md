---
title: Hand-Cam Shader Demo
---

# Hand-Cam Shader Demo

This demo uses a **vertex+fragment WGSL shader pair** to simulate subtle handheld camera motion.

- Vertex shader: applies pseudo-random camera rotation around **X/Y** plus a tiny translation and a light perspective-like skew.
- Fragment shader: applies a cheap blur that scales with the effect strength.

```wgsl vertex:handcam
// Hand-cam vertex shader (paired with fragment:handcam)
// Provides shared bindings, VertexOutput, and vertexMain().

struct Uniforms {
  time: f32,
  resolution: vec2f,
  strength: f32,
  blur: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

fn hash11(x: f32) -> f32 {
  return fract(sin(x * 127.1) * 43758.5453123);
}

fn smoothNoise1(t: f32) -> f32 {
  let i = floor(t);
  let f = fract(t);
  let a = hash11(i);
  let b = hash11(i + 1.0);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u);
}

fn rotX(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x, p.y * c - p.z * s, p.y * s + p.z * c);
}

fn rotY(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
}

@vertex
fn vertexMain(input: VertexIn) -> VertexOutput {
  var out: VertexOutput;

  let t = uniforms.time;
  let s = clamp(uniforms.strength, 0.0, 2.0);

  // Zoom in a bit so hand-cam skew/rotation doesn't reveal black edges.
  // Scales with strength, but never below 1.1×.
  //let zoom = clamp(1.1 + 0.12 * s, 1.1, 1.5);
  let zoom = clamp(1.01, 1.01, 1.01);

  // Pseudo-random-ish motion (smooth value noise) at a few different rates.
  let nx = smoothNoise1(t * 1.30 + 10.0) - 0.5;
  let ny = smoothNoise1(t * 1.05 + 20.0) - 0.5;
  let nb = smoothNoise1(t * 1.80 + 30.0) - 0.5;

  // Rotation around X/Y in radians.
  let angX = nx * 0.18 * s;
  let angY = ny * 0.22 * s;

  // Small translation in clip/NDC-ish units.
  let tx = (smoothNoise1(t * 2.20 + 40.0) - 0.5) * 0.06 * s;
  let ty = (smoothNoise1(t * 1.95 + 50.0) - 0.5) * 0.05 * s;

  // Z wobble drives a mild perspective-like skew via clip.w.
  let z = nb * 0.35 * s;

  var p = vec3f(input.pos.x + tx, input.pos.y + ty, z);
  p = rotX(p, angX);
  p = rotY(p, angY);

  // Keep geometry full-screen. Apply the motion as a UV (sampling) transform.
  out.position = vec4f(input.pos, 0.0, 1.0);

  // Project the rotated point back to a 2D plane for UVs.
  let w = max(0.25, 1.0 + p.z * 0.85);
  let ndc = p.xy / w;
  let uv0 = vec2f(ndc.x * 0.5 + 0.5, 1.0 - (ndc.y * 0.5 + 0.5));
  let center = vec2f(0.5, 0.5);
  out.uv = center + (uv0 - center) / zoom;

  return out;
}
```

```wgsl fragment:handcam
// Hand-cam fragment shader (paired with vertex:handcam)
// Only needs fragmentMain(); shared bindings/types live in the vertex block.

fn sampleClamped(uv: vec2f) -> vec3f {
  let uvc = clamp(uv, vec2f(0.0), vec2f(1.0));
  return textureSampleLevel(inputTexture, inputSampler, uvc, 0.0).rgb;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let res = max(uniforms.resolution, vec2f(1.0, 1.0));
  let s = clamp(uniforms.strength, 0.0, 2.0);
  let blurAmt = clamp(uniforms.blur, 0.0, 2.0);

  // Blur radius in UV units; scales with strength.
  let px = 1.0 / res;
  let r = px * (1.0 + 2.0 * s) * blurAmt;

  // Cheap 5-tap cross blur.
  let c0 = sampleClamped(input.uv);
  let cx1 = sampleClamped(input.uv + vec2f(r.x, 0.0));
  let cx2 = sampleClamped(input.uv - vec2f(r.x, 0.0));
  let cy1 = sampleClamped(input.uv + vec2f(0.0, r.y));
  let cy2 = sampleClamped(input.uv - vec2f(0.0, r.y));

  let color = c0 * 0.45 + (cx1 + cx2 + cy1 + cy2) * 0.1375;

  return vec4f(color, 1.0);
}
```

```javascript
// Persistent control state
let strength = 0.05;
let blur = 0.15;
```

```javascript on:update
term.clear();

term.write(0, 0, "╔═══════════════════════════════════════════════════════╗", theme.accent1);
term.write(0, 1, "║  HAND-CAM SHADER DEMO                                 ║", theme.accent1);
term.write(0, 2, "╚═══════════════════════════════════════════════════════╝", theme.accent1);

let y = 4;
term.write(0, y++, "  This demo pairs a vertex+fragment WGSL shader to:", theme.fg);
term.write(0, y++, "    • Apply subtle handheld camera skew (rotate X/Y)", theme.accent2);
term.write(0, y++, "    • Add a small cheap blur", theme.accent2);
y++;

const shaders = shader.list();
term.write(0, y++, "  Shader Status:", theme.success);

if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('handcam')) || shaders[0];
  term.write(0, y++, `    ✓ Registered: ${shaderName}`, theme.success);

  const info = shader.info(shaderName);
  if (info) {
    term.write(0, y++, `    ✓ Type: ${info.kind}`, theme.success);
    term.write(0, y++, `    ✓ Uniforms: ${info.uniforms.length} custom`, theme.success);

    if (shader.getActive() !== shaderName) {
      shader.setActive(shaderName);
      term.write(0, y++, "    ✓ Shader activated", theme.success);
    }

    shader.setUniform(shaderName, 'strength', strength);
    shader.setUniform(shaderName, 'blur', blur);
  }
}

y++;
term.write(0, y++, "  Controls:", theme.accent2);
term.write(0, y++, "  ─────────────────────────────────────────────────────", theme.dim);
term.write(0, y++, `  [Q/W] Strength: ${strength.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [A/S] Blur:     ${blur.toFixed(2)}`, theme.fg);

y++;
term.write(0, y++, "  Tip: combine with other post-process shaders via shader chains.", theme.dim);
```

```javascript on:input
if (!event || event.type !== 'keydown') return;

const keyName = event.key.toLowerCase();
const shaders = shader.list();
if (shaders.length === 0) return;

const shaderName = shaders.find(s => s.includes('handcam')) || shaders[0];

switch (keyName) {
  case 'q':
    strength = Math.max(0.0, strength - 0.05);
    shader.setUniform(shaderName, 'strength', strength);
    break;
  case 'w':
    strength = Math.min(2.0, strength + 0.05);
    shader.setUniform(shaderName, 'strength', strength);
    break;
  case 'a':
    blur = Math.max(0.0, blur - 0.05);
    shader.setUniform(shaderName, 'blur', blur);
    break;
  case 's':
    blur = Math.min(2.0, blur + 0.05);
    shader.setUniform(shaderName, 'blur', blur);
    break;
}
```
