// Sobel Edge Detection Shader for t|Storie
// Detects edges in the scene using a 3×3 Sobel gradient on luminance, then
// overlays detected edges on the original image as a darkening mask.
//
// Useful as a standalone artistic effect or as the first pass in a chain that
// should emphasise outlines (e.g. sobel → lightsoft for bump-mapped edges).

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

// ── Uniform layout ────────────────────────────────────────────────────────────
//  offset  0 : time        (system)
//  offset  4 : _pad0
//  offset  8 : resolution  (system, vec2f / 8 bytes)
//  offset 16 : custom uniforms begin
struct Uniforms {
    time:        f32,
    _pad0:       f32,
    resolution:  vec2f,

    edgeAmt:     f32,    // edge overlay intensity (0 = off, 1 = full darkening)
    threshold:   f32,    // gradient magnitude below this is ignored
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// ── Helpers ───────────────────────────────────────────────────────────────────
fn _luma(c: vec3f) -> f32 { return dot(c, vec3f(0.299, 0.587, 0.114)); }

fn _s(uv: vec2f, dx: f32, dy: f32, invRes: vec2f) -> f32 {
    return _luma(
        textureSampleLevel(contentTexture, contentTextureSampler,
                           uv + vec2f(dx, dy) * invRes, 0.0).rgb
    );
}

// ── Fragment ──────────────────────────────────────────────────────────────────
@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let uv     = vUv;
    let col    = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0);
    let invRes = 1.0 / max(uniforms.resolution, vec2f(1.0));

    // ── Sobel 3×3 gradient ───────────────────────────────────────────────────
    //  X kernel:   [-1  0 +1]     Y kernel:  [-1 -2 -1]
    //              [-2  0 +2]                [ 0  0  0]
    //              [-1  0 +1]                [+1 +2 +1]
    //
    let s00 = _s(uv, -1.0, -1.0, invRes);
    let s10 = _s(uv,  0.0, -1.0, invRes);
    let s20 = _s(uv,  1.0, -1.0, invRes);
    let s01 = _s(uv, -1.0,  0.0, invRes);
    let s21 = _s(uv,  1.0,  0.0, invRes);
    let s02 = _s(uv, -1.0,  1.0, invRes);
    let s12 = _s(uv,  0.0,  1.0, invRes);
    let s22 = _s(uv,  1.0,  1.0, invRes);

    let gx = (-s00 + s20) + 2.0 * (-s01 + s21) + (-s02 + s22);
    let gy = (-s00 - 2.0 * s10 - s20) + (s02 + 2.0 * s12 + s22);

    // Edge magnitude, thresholded and smoothed.
    let mag  = length(vec2f(gx, gy));
    let edge = smoothstep(uniforms.threshold,
                          uniforms.threshold + 0.15,
                          mag) * uniforms.edgeAmt;

    // Darken the original image at detected edges.
    let out = col.rgb * (1.0 - edge);
    return vec4f(clamp(out, vec3f(0.0), vec3f(1.0)), col.a);
}
`,

        uniforms: {
            edgeAmt:   0.80,  // how strongly edges darken the image
            threshold: 0.05,  // ignore gradients below this magnitude
        }
    };
}
