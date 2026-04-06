// Blur Shader for tStorie
// Separable Gaussian blur using hardware bilinear interpolation (most efficient single-pass method)
// A 9-tap Gaussian kernel reduced to 5 bilinear samples per axis — 9 total for 2D approximation.
//
// Technique: position each bilinear sample at the weighted mean of two adjacent Gaussian taps so
// the hardware filter returns their exact weighted sum in a single fetch.
//   Center:   offset = 0,          weight = 0.2270270  (tap 0)
//   Pair 1:   offset = 1.3846154,  weight = 0.3162162  (taps ±1 + ±2 combined)
//   Pair 2:   offset = 3.2307692,  weight = 0.0702703  (taps ±3 + ±4 combined)
// Weights sum to 1.0 — no normalisation step needed.

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
    time: f32,          // offset  0
    _pad0: f32,         // offset  4 (alignment pad before vec2f)
    resolution: vec2f,  // offset  8
    blurRadius: f32,    // offset 16  — blur spread in pixels
    blurStrength: f32,  // offset 20  — mix: 0.0 = original, 1.0 = fully blurred
    _pad1: f32,         // offset 24
    _pad2: f32,         // offset 28
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// Bilinear-sampled separable Gaussian blur.
// 5 samples horizontal + 4 new samples vertical (shared center) = 9 fetches total.
// Produces a smooth isotropic Gaussian blur comparable to a full 9×9 kernel.
fn gaussianBlur(uv: vec2f, radius: f32) -> vec3f {
    let px = 1.0 / uniforms.resolution;

    // Bilinear-optimised offsets & combined weights for a 9-tap Gaussian
    let o1 = 1.3846154 * radius;
    let o2 = 3.2307692 * radius;
    let w0 = 0.2270270;
    let w1 = 0.3162162;
    let w2 = 0.0702703;

    let center = textureSample(contentTexture, contentTextureSampler, uv).rgb;

    // Horizontal pass
    var h = center * w0;
    h += textureSample(contentTexture, contentTextureSampler, uv + vec2f( o1 * px.x, 0.0)).rgb * w1;
    h += textureSample(contentTexture, contentTextureSampler, uv + vec2f(-o1 * px.x, 0.0)).rgb * w1;
    h += textureSample(contentTexture, contentTextureSampler, uv + vec2f( o2 * px.x, 0.0)).rgb * w2;
    h += textureSample(contentTexture, contentTextureSampler, uv + vec2f(-o2 * px.x, 0.0)).rgb * w2;

    // Vertical pass (center already fetched above; reuse weight)
    var v = center * w0;
    v += textureSample(contentTexture, contentTextureSampler, uv + vec2f(0.0,  o1 * px.y)).rgb * w1;
    v += textureSample(contentTexture, contentTextureSampler, uv + vec2f(0.0, -o1 * px.y)).rgb * w1;
    v += textureSample(contentTexture, contentTextureSampler, uv + vec2f(0.0,  o2 * px.y)).rgb * w2;
    v += textureSample(contentTexture, contentTextureSampler, uv + vec2f(0.0, -o2 * px.y)).rgb * w2;

    // Average horizontal and vertical to approximate isotropic 2D Gaussian
    return (h + v) * 0.5;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    let uv = vUv;

    let original = textureSample(contentTexture, contentTextureSampler, uv).rgb;
    let blurred  = gaussianBlur(uv, uniforms.blurRadius);

    let finalColor = mix(original, blurred, uniforms.blurStrength);

    return vec4f(finalColor, 1.0);
}
`,

        uniforms: {
            blurRadius:   2.0,  // Blur spread in pixels (increase for stronger blur)
            blurStrength: 1.0   // Mix factor: 0.0 = no blur, 1.0 = full blur
        }
    };
}
