// Western Poster Paper Shader for t|Storie
// Simulates aged, textured paper like old "wanted" criminal posters
// Features directional paper fibers, aging effects, and rough surface texture

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

    #include "lib/proc-hash.wgsl"

struct Uniforms {
    time: f32,              // offset 0
    _pad0: f32,             // offset 4 (padding for resolution alignment)
    resolution: vec2f,      // offset 8
    paperColorR: f32,       // offset 16 - Base paper color (warm parchment)
    paperColorG: f32,       // offset 20
    paperColorB: f32,       // offset 24
    grainStrength: f32,     // offset 28 - Fine grain intensity
    grainScale: f32,        // offset 32 - Fine grain frequency (scaled by resolution)
    fiberStrength: f32,     // offset 36 - Directional fibers intensity
    fiberAngle: f32,        // offset 40 - Fiber direction (radians)
    stainStrength: f32,     // offset 44 - Blotches/stains intensity
    stainScale: f32,        // offset 48 - Stain frequency in UV space
    vignetteStrength: f32,  // offset 52 - Darken toward edges
    edgeBurnStrength: f32,  // offset 56 - Extra dark edge burn
    speckleStrength: f32,   // offset 60 - Dust/speckle amount
    creaseStrength: f32,    // offset 64 - Fold/crease hints
    _pad1: f32,             // offset 68
    _pad2: f32,             // offset 72
    _pad3: f32,             // offset 76
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn valueNoise(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);
    let u = f * f * (3.0 - 2.0 * f);

    let a = hash21(i + vec2f(0.0, 0.0));
    let b = hash21(i + vec2f(1.0, 0.0));
    let c = hash21(i + vec2f(0.0, 1.0));
    let d = hash21(i + vec2f(1.0, 1.0));

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbm(p: vec2f, baseFreq: f32) -> f32 {
    var sum: f32 = 0.0;
    var amp: f32 = 0.5;
    var freq: f32 = baseFreq;

    // 4 octaves is enough for paper.
    for (var i: i32 = 0; i < 4; i++) {
        sum += valueNoise(p * freq) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }

    return sum;
}

fn ridge(n: f32) -> f32 {
    // Ridged noise: 1 at midpoints, 0 at extremes.
    return 1.0 - abs(n * 2.0 - 1.0);
}

fn rotate2(p: vec2f, angle: f32) -> vec2f {
    let c = cos(angle);
    let s = sin(angle);
    return vec2f(p.x * c - p.y * s, p.x * s + p.y * c);
}

fn creaseLine(uv: vec2f, angle: f32, offset: f32, width: f32) -> f32 {
    let dir = vec2f(cos(angle), sin(angle));
    let d = dot(uv - vec2f(0.5, 0.5), dir) + offset;
    return smoothstep(width, 0.0, abs(d));
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    // Aged parchment base.
    var rgb = vec3f(uniforms.paperColorR, uniforms.paperColorG, uniforms.paperColorB);

    // Two coordinate spaces:
    // - uv: stable 0..1 for large features (stains, vignettes)
    // - px: resolution-scaled for fine grain and fibers
    let uv = vUv;
    let px = vUv * uniforms.resolution;

    // Fine grain (high frequency, subtle).
    if (uniforms.grainStrength > 0.0) {
        let grain = fbm(px, max(0.0001, uniforms.grainScale));
        let g = (grain - 0.5) * 2.0;
        rgb *= 1.0 + g * 0.10 * uniforms.grainStrength;
    }

    // Directional fibers: ridged noise stretched along an angle.
    if (uniforms.fiberStrength > 0.0) {
        let rp = rotate2(px * vec2f(0.02, 0.004), uniforms.fiberAngle);
        let fibers = ridge(fbm(rp, 1.0));
        let f = (fibers - 0.5) * 2.0;
        rgb *= 1.0 + f * 0.08 * uniforms.fiberStrength;
    }

    // Stains/blotches: low-frequency, slightly brown, uneven.
    if (uniforms.stainStrength > 0.0) {
        let stainBase = fbm(uv * max(0.0001, uniforms.stainScale), 1.0);
        // Push toward splotches.
        let blotch = smoothstep(0.62, 0.98, stainBase);
        let ring = smoothstep(0.25, 0.0, abs(stainBase - 0.72));
        let stain = saturate(blotch * 0.85 + ring * 0.25);

        let stainColor = vec3f(0.42, 0.30, 0.16);
        rgb = mix(rgb, rgb * (1.0 - 0.22 * stain) + stainColor * (0.18 * stain), uniforms.stainStrength);
    }

    // Vignette / edge darkening: classic poster feel.
    let aspect = uniforms.resolution.x / max(1.0, uniforms.resolution.y);
    let centered = vec2f((uv.x - 0.5) * aspect, uv.y - 0.5);
    let r = length(centered);
    let vignette = smoothstep(0.35, 0.78, r);
    rgb *= 1.0 - vignette * 0.18 * saturate(uniforms.vignetteStrength);

    let edgeDist = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y));
    let edge = 1.0 - smoothstep(0.02, 0.20, edgeDist);
    rgb *= 1.0 - edge * 0.22 * saturate(uniforms.edgeBurnStrength);

    // Speckles: sparse dark dust.
    if (uniforms.speckleStrength > 0.0) {
        let h = hash21(floor(px * 0.6));
        let speck = step(0.992, h);
        rgb *= 1.0 - speck * 0.35 * saturate(uniforms.speckleStrength);
    }

    // Creases / folds: very subtle.
    if (uniforms.creaseStrength > 0.0) {
        let c0 = creaseLine(uv, 0.0, -0.03, 0.006);
        let c1 = creaseLine(uv, 1.5707963, 0.02, 0.008);
        let crease = saturate(c0 + c1);
        rgb *= 1.0 - crease * 0.10 * saturate(uniforms.creaseStrength);
        rgb += vec3f(0.03, 0.02, 0.01) * crease * 0.35 * saturate(uniforms.creaseStrength);
    }

    // Keep it in-range.
    rgb = clamp(rgb, vec3f(0.0), vec3f(1.0));
    return vec4f(rgb, 1.0);
}
`,
        uniforms: {
            // Base parchment tone (slightly warm, still readable under text)
            paperColorR: 0.97,
            paperColorG: 0.93,
            paperColorB: 0.82,

            // Fine texture layers
            grainStrength: 0.35,
            grainScale: 0.055,
            fiberStrength: 0.45,
            fiberAngle: 0.12,

            // Aging / defects
            stainStrength: 0.35,
            stainScale: 2.2,
            // NOTE: When used as a tiled Worlds background, per-tile edge effects
            // read as visible “cell boundaries”. Keep these off by default.
            vignetteStrength: 0.0,
            edgeBurnStrength: 0.0,
            speckleStrength: 0.22,
            creaseStrength: 0.18
        }
    };
}