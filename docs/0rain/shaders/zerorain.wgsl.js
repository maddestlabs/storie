// ZeroRain Shader for t|Storie
// Retro-future rain overlay: soft white pixel trails + darker distortion drops.
// Designed to be performant: 1 texture sample + procedural math.

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

  ghostOpacity: f32,      // overlay blend amount
  ghostScale: f32,        // zoom factor for the captured overlay

  // Custom uniforms
  whiteOpacity: f32,      // 0..1 (target: 0.3)
  blackOpacity: f32,      // 0..1 (target: 0.2)

  whiteColumnPx: f32,     // pixel width of columns
  blackColumnPx: f32,

  whiteTrailPx: f32,      // exponential falloff length
  blackTrailPx: f32,

  whiteMaxTrailPx: f32,   // clamp trail length
  blackMaxTrailPx: f32,

  whiteSpeed: f32,        // cycles/sec (normalized 0..1 in Y)
  blackSpeed: f32,

  whiteDensity: f32,      // 0..1 (speckle along trail)
  blackDensity: f32,

  distortPx: f32,         // distortion amplitude in pixels
  distortFalloff: f32,    // higher = tighter distortion around drops

  seed: f32,
  _pad1: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn hash11(p: f32) -> f32 {
  return fract(sin(p) * 43758.5453123);
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453123);
}

fn ghostUv(uv: vec2f, scale: f32) -> vec2f {
  return clamp(uv / max(scale, 1.0), vec2f(0.0), vec2f(1.0));
}

fn rainLayer(
  ip: vec2f,
  res: vec2f,
  colPx: f32,
  speed: f32,
  trailPx: f32,
  maxTrailPx: f32,
  density: f32,
  seedOffset: f32
) -> f32 {
  let colW = max(colPx, 1.0);
  let col = floor(ip.x / colW);

  // Stable per-column seeds
  let h0 = hash11(col * 13.37 + seedOffset + uniforms.seed * 0.001);
  let h1 = hash11(col * 19.11 + seedOffset + 7.0 + uniforms.seed * 0.001);

  // Drop head position in pixels (wraps vertically)
  let yHead = fract(h0 + uniforms.time * speed) * res.y;

  // Distance behind head (wrap so it's always [0, res.y)).
  // Since y increases downward on screen, the trail behind a falling drop is *above* the head.
  var dy = yHead - ip.y;
  dy = select(dy + res.y, dy, dy >= 0.0);

  // Soft head + exponential trail
  let head = smoothstep(1.25, 0.0, dy);
  let trailLen = max(1.0, trailPx);
  let trail = exp(-dy / trailLen) * step(dy, maxTrailPx);

  // Break trail into sparse pixels (stable across frames per row block)
  let rowBlock = floor(ip.y * 0.5); // 2px blocks
  let speckle = step(1.0 - clamp(density, 0.0, 1.0), hash21(vec2f(col, rowBlock) + vec2f(seedOffset, h1 * 100.0)));

  return max(head, trail * speckle);
}

@fragment
fn fragmentMain(
  @location(0) vUv: vec2f
) -> @location(0) vec4f {
  let res = max(uniforms.resolution, vec2f(1.0));

  // Pixel coords for crisp rain dots
  let p = vUv * res;
  let ip = floor(p) + vec2f(0.5);

  // Two rain layers: white overlay and black distortion drops
  let whiteI = rainLayer(
    ip,
    res,
    uniforms.whiteColumnPx,
    uniforms.whiteSpeed,
    uniforms.whiteTrailPx,
    uniforms.whiteMaxTrailPx,
    uniforms.whiteDensity,
    11.0
  );

  let blackI = rainLayer(
    ip,
    res,
    uniforms.blackColumnPx,
    uniforms.blackSpeed,
    uniforms.blackTrailPx,
    uniforms.blackMaxTrailPx,
    uniforms.blackDensity,
    29.0
  );

  // Use black drops to distort sampling of the underlying content.
  // Distortion is small and localized around black drops.
  let dFall = max(0.001, uniforms.distortFalloff);
  let d = pow(clamp(blackI, 0.0, 1.0), dFall);

  // Column-based distortion direction (stable-ish)
  let col = floor(ip.x / max(uniforms.blackColumnPx, 1.0));
  let dirA = hash11(col * 17.7 + 123.4 + uniforms.seed * 0.01) * 6.2831853;
  let dir = vec2f(cos(dirA), sin(dirA));

  let distortUv = (dir * (uniforms.distortPx / res)) * d;
  let sampleUv = clamp(vUv + distortUv, vec2f(0.0), vec2f(1.0));
  let zoomUv = ghostUv(vUv, uniforms.ghostScale);

  let baseColor = textureSample(contentTexture, contentTextureSampler, sampleUv).rgb;
  let overlayColor = textureSample(contentTexture, contentTextureSampler, zoomUv).rgb;
  let ghostAmt = clamp(uniforms.ghostOpacity, 0.0, 1.0);
  var color = mix(baseColor, overlayColor, ghostAmt);

  // Apply white pixels at target opacity (alpha blend toward white)
  let aW = clamp(uniforms.whiteOpacity, 0.0, 1.0) * clamp(whiteI, 0.0, 1.0);
  color = color * (1.0 - aW) + vec3f(1.0) * aW;

  // Apply black pixels at target opacity (darken)
  let aB = clamp(uniforms.blackOpacity, 0.0, 1.0) * clamp(blackI, 0.0, 1.0);
  color = color * (1.0 - aB);

  return vec4f(color, 1.0);
}
`,

    uniforms: {
      ghostOpacity: 0.05,
      ghostScale: 4.0,

      // Requested opacities
      whiteOpacity: 0.02,
      blackOpacity: 0.07,

      // Column spacing (pixels). Smaller => denser rain.
      whiteColumnPx: 5.0,
      blackColumnPx: 3.0,

      // Trail feel (pixels)
      whiteTrailPx: 18.0,
      blackTrailPx: 26.0,
      whiteMaxTrailPx: 140.0,
      blackMaxTrailPx: 170.0,

      // Fall speed (cycles/sec). Higher => faster.
      whiteSpeed: 0.45,
      blackSpeed: 0.8,

      // Sparsity along the trail
      whiteDensity: 0.99,
      blackDensity: 0.9,

      // Distortion from black drops
      distortPx: 4.0,
      distortFalloff: 2.2,

      seed: 0.0
    }
  };
}
