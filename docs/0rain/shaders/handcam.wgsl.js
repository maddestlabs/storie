// Handcam Shader for S|torie
// Pseudo-random handheld camera motion (tilt X/Y + subtle pan + perspective) + cheap blur.
//
// Usage:
// - Frontmatter: shaders: "handcam"
// - API: await shader.setChain(['handcam'])
//
// Uniforms:
// - strength: overall intensity (0..2)
// - blur: cheap blur amount (0..2)
// - zoom: zoom-in factor to hide edges (>= 1.0, typical 1.01..1.15)
// - seed: per-run seed (0..1) to break repeating patterns

function getShaderConfig() {
  return {
    vertexShader: `struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) vUv: vec2f,
}

@vertex
fn vertexMain(
  @location(0) position: vec2f
) -> VertexOutput {
  var output: VertexOutput;
  output.vUv = position * 0.5 + 0.5;
  output.vUv.y = 1.0 - output.vUv.y;
  output.position = vec4f(position, 0.0, 1.0);
  return output;
}
`,

    fragmentShader: `@group(0) @binding(0) var contentTexture: texture_2d<f32>;
@group(0) @binding(1) var contentTextureSampler: sampler;

struct Uniforms {
  // Base uniforms provided by the shader system
  time: f32,
  _pad0: f32,
  resolution: vec2f,

  // Custom uniforms
  strength: f32,
  blur: f32,
  zoom: f32,
  seed: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// 2D value noise + fBm (less obviously periodic than 1D smooth noise)
fn hash12(p: vec2f) -> f32 {
  var p3 = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, p3.yzx + vec3f(33.33));
  return fract((p3.x + p3.y) * p3.z);
}

fn valueNoise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);

  let a = hash12(i + vec2f(0.0, 0.0));
  let b = hash12(i + vec2f(1.0, 0.0));
  let c = hash12(i + vec2f(0.0, 1.0));
  let d = hash12(i + vec2f(1.0, 1.0));

  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm2(p: vec2f) -> f32 {
  var f = 0.0;
  var a = 0.5;
  var x = p;
  for (var i = 0; i < 4; i = i + 1) {
    f += a * valueNoise2(x);
    x = x * 2.03 + vec2f(17.7, 9.2);
    a *= 0.5;
  }
  return f;
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

fn rotZ(p: vec3f, a: f32) -> vec3f {
  let c = cos(a);
  let s = sin(a);
  return vec3f(p.x * c - p.y * s, p.x * s + p.y * c, p.z);
}

fn sampleClamped(uv: vec2f) -> vec3f {
  let uvc = clamp(uv, vec2f(0.0), vec2f(1.0));
  return textureSampleLevel(contentTexture, contentTextureSampler, uvc, 0.0).rgb;
}

fn handcamUv(uv: vec2f) -> vec2f {
  let t = uniforms.time;
  let s = clamp(uniforms.strength, 0.0, 2.0);
  let res = max(uniforms.resolution, vec2f(1.0, 1.0));

  // Sample 2D fBm along a time “track”; seed de-correlates runs.
  let base = vec2f(t * 0.17, uniforms.seed * 19.19);

  // Domain warp to reduce residual patterning / looping.
  let warp = vec2f(
    fbm2(base + vec2f(12.3, 4.7)),
    fbm2(base + vec2f(3.1, 27.9))
  );
  let p2 = base + (warp - 0.5) * 3.0;

  // Decorrelated channels in [-0.5, 0.5]
  let nx = fbm2(p2 + vec2f(10.0, 20.0)) - 0.5;
  let ny = fbm2(p2 + vec2f(30.0, 40.0)) - 0.5;
  let nb = fbm2(p2 + vec2f(50.0, 60.0)) - 0.5;

  // Rotation around X/Y in radians.
  let angX = nx * 0.18 * s;
  let angY = ny * 0.22 * s;
  let angZ = (fbm2(p2 + vec2f(70.0, 80.0)) - 0.5) * 0.10 * s;

  // Subtle translation in *pixels* (stable across resolutions).
  // At strength=1, this is roughly a few pixels.
  let panXpx = (fbm2(p2 + vec2f(90.0, 100.0)) - 0.5) * 6.0 * s;
  let panYpx = (fbm2(p2 + vec2f(110.0, 120.0)) - 0.5) * 5.0 * s;
  let panNdc = vec2f((panXpx / res.x) * 2.0, (panYpx / res.y) * 2.0);

  // Z wobble drives a mild perspective skew.
  let z = nb * 0.35 * s;

  // Convert uv to ndc (-1..1), apply pan, then rotate in 3D.
  var p = vec3f((uv - vec2f(0.5, 0.5)) * 2.0 + panNdc, z);
  p = rotX(p, angX);
  p = rotY(p, angY);
  p = rotZ(p, angZ);

  let w = max(0.25, 1.0 + p.z * 0.85);
  let ndc = p.xy / w;

  var outUv = vec2f(ndc.x * 0.5 + 0.5, ndc.y * 0.5 + 0.5);

  // Zoom-in to hide edges (divide to zoom in content).
  let zoom = clamp(uniforms.zoom, 1.0, 1.1);
  outUv = vec2f(0.5, 0.5) + (outUv - vec2f(0.5, 0.5)) / zoom;

  return outUv;
}

@fragment
fn fragmentMain(
  @location(0) vUv: vec2f
) -> @location(0) vec4f {
  let res = max(uniforms.resolution, vec2f(1.0, 1.0));
  let s = clamp(uniforms.strength, 0.0, 2.0);
  let blurAmt = clamp(uniforms.blur, 0.0, 2.0);

  // Apply the camera motion to base UV.
  let baseUv = handcamUv(vUv);

  // Blur radius in UV units; scales with strength.
  let px = 1.0 / res;
  let r = px * (1.0 + 2.0 * s) * blurAmt;

  // Cheap 5-tap cross blur around the transformed UV.
  let c0 = sampleClamped(baseUv);
  let cx1 = sampleClamped(baseUv + vec2f(r.x, 0.0));
  let cx2 = sampleClamped(baseUv - vec2f(r.x, 0.0));
  let cy1 = sampleClamped(baseUv + vec2f(0.0, r.y));
  let cy2 = sampleClamped(baseUv - vec2f(0.0, r.y));

  let color = c0 * 0.45 + (cx1 + cx2 + cy1 + cy2) * 0.1375;
  return vec4f(color, 1.0);
}
`,

    uniforms: {
      strength: 0.1,
      blur: 0.15,
      zoom: 1.005,
      seed: Math.random()
    }
  };
}
