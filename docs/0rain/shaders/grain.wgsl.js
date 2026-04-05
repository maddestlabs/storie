// Grain Shader for t|Storie
// Film-accurate luminance-weighted grain.
//
// Unlike 'paper', grain intensity follows a bell curve that peaks in the midtones
// and falls off toward deep shadows and bright highlights — matching the behaviour
// of real film stock where grain is only visible where silver halide gradients exist.
//
// Two-octave noise combines pixel-scale fine grain with a coarser clump layer,
// reproducing the micro/macro structure of a real film emulsion.
//
// Uniforms:
//   grainAmount   — master strength (0 = off, 1 = heavy)
//   grainSize     — spatial frequency: 1.0 = sharp 1-pixel grain; 0.5 = coarser 2-pixel
//   grainAnimate  — 0 = static frozen frame; 1 = animated at ~24 fps

function getShaderConfig() {
    return {
        vertexShader: `struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) vUv: vec2f,
}

@vertex
fn vertexMain(@location(0) position: vec2f) -> VertexOutput {
    var output: VertexOutput;
    output.vUv = position * 0.5 + 0.5;
    output.vUv.y = 1.0 - output.vUv.y;
    output.position = vec4f(position, 0.0, 1.0);
    return output;
}
`,

        fragmentShader: `@group(0) @binding(0) var contentTexture: texture_2d<f32>;
@group(0) @binding(1) var contentTextureSampler: sampler;

    #include "lib/proc-hash.wgsl"

struct Uniforms {
    time:         f32,   // offset  0  (system)
    _pad0:        f32,   // offset  4
    resolution:   vec2f, // offset  8  (system)
    grainAmount:  f32,   // offset 16 — master strength  (0–1)
    grainSize:    f32,   // offset 20 — spatial scale    (1.0 = 1-pixel grain)
    grainAnimate: f32,   // offset 24 — 0 = static, 1 = animated ~24 fps
    _pad1:        f32,   // offset 28
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    var col: vec4f = textureSample(contentTexture, contentTextureSampler, vUv);

    if (uniforms.grainAmount <= 0.0) { return col; }

    // Snap time to ~24 fps boundaries for animated grain; hold at 0.0 for static.
    // The large prime multipliers prevent the same grain pattern repeating each frame.
    let frameSeed = select(0.0, floor(uniforms.time * 24.0), uniforms.grainAnimate > 0.5);

    // Screen-space coordinate, scaled by grainSize (lower = coarser grain).
    // Frame-seed offset scrambles the hash spatially each tick.
    let coord = vUv * uniforms.resolution * uniforms.grainSize
              + vec2f(frameSeed * 127.1, frameSeed * 311.7);

    // Two-octave noise: dominant fine grain + a 50%-scale coarser clump layer.
    // Fine: hash21 at full frequency   — sharp film grain
    // Coarse: hash21 at half frequency — subtle emulsion clumping
    let grainFine   = hash21(coord);
    let grainCoarse = hash21(coord * 0.5 + vec2f(17.3, 41.9));
    let noise = grainFine * 0.75 + grainCoarse * 0.25;

    // Luminance-weighted bell curve: 4L(1-L) gives 0 at pure black/white, 1 at L=0.5.
    // Mimics film stock where grain is only visible in exposed (mid-tone) areas.
    let lumaDot = vec3f(0.299, 0.587, 0.114);
    let luma    = dot(col.rgb, lumaDot);
    let weight  = 4.0 * luma * (1.0 - luma);

    // Additive ±offset (noise 0.5 → no change) so grain both lightens AND darkens.
    // Multiplicative-only grain would only darken, which looks wrong on bright cards.
    let delta = (noise - 0.5) * uniforms.grainAmount * weight * 0.35;

    return vec4f(clamp(col.rgb + vec3f(delta), vec3f(0.0), vec3f(1.0)), col.a);
}
`,

        uniforms: {
            grainAmount:  0.25,  // moderate; raise toward 1.0 for heavy film grain
            grainSize:    1.0,   // 1-pixel grain — sharpest / most film-like
            grainAnimate: 1.0,   // animated by default; set 0.0 for fixed paper texture
        }
    };
}
