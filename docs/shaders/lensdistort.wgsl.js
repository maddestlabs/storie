// Lens Distortion Shader for t|Storie
// Brown–Conrady radial barrel / pincushion distortion with compensating zoom.
//
//   k1 > 0  — barrel distortion (edges bow outward — most real camera lenses)
//   k1 < 0  — pincushion distortion (edges bow inward — telephoto character)
//   zoom    — scale > 1.0 zooms in slightly to clip the black wedge that barrel
//              distortion would otherwise leave at the corners
//
// Intended as a subtle finishing pass (k1 ≈ 0.15–0.25, zoom ≈ 1.04–1.08).
// The optional caEdge uniform adds a tiny chromatic aberration term proportional
// to the distortion magnitude — physically motivated (both arise from the same
// radial lens aberration) and essentially free since r² is already computed.
//
// Math:
//   p = centred UV / zoom                       (range ~±0.5, tighter with zoom)
//   r² = dot(p, p)
//   warpedP = p × (1 + k1 × r²)                (Brown–Conrady 1st-order radial)
//   sampleUV = warpedP + 0.5
//
// With k1 > 0 and zoom > 1:
//   - centre region is mostly unaffected (r² ≈ 0)
//   - edges are pushed outward (larger r² → larger multiplier → UV pulled away)
//   - zoom pre-shrinks the coordinate so the distorted edges still land in [0,1]
//
// Recommended chain position: last (or near-last), after all lighting passes.

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

struct Uniforms {
    time:    f32,    // offset  0  (system)
    _pad0:   f32,    // offset  4
    resolution: vec2f, // offset 8  (system)
    k1:      f32,    // offset 16 — radial coefficient (+barrel, −pincushion)
    zoom:    f32,    // offset 20 — compensate for stretched corners (≥ 1.0)
    caEdge:  f32,    // offset 24 — edge chromatic aberration strength (0 = off)
                     //   Physically: same aberration that causes barrel distortion
                     //   also separates red/blue at edges. ~0.004–0.008 is subtle.
    _pad1:   f32,    // offset 28
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// Apply Brown–Conrady 1st-order radial distortion to a centred UV offset.
// p is the offset from the image centre (±0.5 range after zoom pre-scale).
fn warpUV(p: vec2f) -> vec2f {
    let r2 = dot(p, p);
    return p * (1.0 + uniforms.k1 * r2);
}

@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    // Offset from image centre, pre-divided by zoom so the warped edges stay
    // within [0, 1] after the inverse-distortion sample lookup.
    let p = (vUv - 0.5) / uniforms.zoom;

    // Base warp — same UV for all three channels unless caEdge is active.
    let warpedP   = warpUV(p);
    let sampledUV = warpedP + 0.5;

    // Hard black outside the valid UV range (the zoom should prevent this at
    // typical settings, but guard anyway for extreme k1 values).
    if (any(sampledUV < vec2f(0.0)) || any(sampledUV > vec2f(1.0))) {
        return vec4f(0.0, 0.0, 0.0, 1.0);
    }

    // Chromatic aberration: red channel warped at a slightly larger radius,
    // blue at a slightly smaller radius. r² weighting means zero shift at centre
    // and maximum fringe at the corners — matching real lateral CA from barrel lenses.
    // Green (centre of the visible spectrum) uses the base warp.
    if (uniforms.caEdge > 0.0) {
        let r2     = dot(warpedP, warpedP);
        let caShift = uniforms.caEdge * r2;

        let uvR = warpUV(p * (1.0 + caShift)) + 0.5;
        let uvB = warpUV(p * (1.0 - caShift)) + 0.5;

        let rChan = textureSampleLevel(contentTexture, contentTextureSampler,
                        clamp(uvR, vec2f(0.0), vec2f(1.0)), 0.0).r;
        let gChan = textureSampleLevel(contentTexture, contentTextureSampler,
                        sampledUV, 0.0).g;
        let bChan = textureSampleLevel(contentTexture, contentTextureSampler,
                        clamp(uvB, vec2f(0.0), vec2f(1.0)), 0.0).b;
        let alpha = textureSampleLevel(contentTexture, contentTextureSampler,
                        sampledUV, 0.0).a;

        return vec4f(rChan, gChan, bChan, alpha);
    }

    return textureSampleLevel(contentTexture, contentTextureSampler, sampledUV, 0.0);
}
`,

        uniforms: {
            // k1 = 0.18: subtle barrel bow — noticeable on straight horizontal
            // lines at the frame edges but not distracting on card content.
            k1:     0.18,
            // zoom = 1.05: clips ~5% from each edge to hide the corner wedge.
            // Slightly tighter framing, like a real crop from a lens-corrected photo.
            zoom:   1.05,
            // caEdge = 0.005: at r²≈0.5 (corner), the per-channel shift is
            // ±(0.5 × 0.5 × 0.5 × 0.005) ≈ 1.6 px at 1280-wide — just visible.
            caEdge: 0.005,
        }
    };
}
