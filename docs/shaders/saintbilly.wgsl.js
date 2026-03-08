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
    // NOTE: Intentionally no time uniform. This background is fully static.
    resolution: vec2f,
    paperColorR: f32,       // Base paper color (warm parchment)
    paperColorG: f32,       // offset 20
    paperColorB: f32,       // offset 24
    grainStrength: f32,     // offset 28 - Fine grain intensity
    grainScale: f32,        // offset 32 - Fine grain frequency (scaled by resolution)
    fiberStrength: f32,     // offset 36 - Paper fiber intensity
    fiberAngle: f32,        // offset 40 - Fiber direction hint (radians)
    stainStrength: f32,     // offset 44 - Blotches/stains intensity
    stainScale: f32,        // offset 48 - Stain frequency in UV space
    cloudStrength: f32,     // offset 52 - Soft shadow clouds overlay
    cloudScale: f32,        // offset 56 - Cloud feature count per tile (rounded)
    cloudSoftness: f32,     // offset 60 - Smoothstep softness for clouds
    vignetteStrength: f32,  // offset 52 - Darken toward edges
    edgeBurnStrength: f32,  // offset 56 - Extra dark edge burn
    speckleStrength: f32,   // offset 60 - Dust/speckle amount
    creaseStrength: f32,    // offset 64 - Wrinkle/crease hints
    _pad1: f32,             // offset 68
    _pad2: f32,             // offset 72
    _pad3: f32,             // offset 76
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn saturate(x: f32) -> f32 {
    return clamp(x, 0.0, 1.0);
}

fn mod2(p: vec2f, period: vec2f) -> vec2f {
    let per = max(period, vec2f(1.0, 1.0));
    return p - floor(p / per) * per;
}

fn smooth2(t: vec2f) -> vec2f {
    // Cubic smoothstep interpolation (cheap and “soft”).
    return t * t * (3.0 - 2.0 * t);
}

fn valueNoisePeriodic(p: vec2f, period: vec2f) -> f32 {
    // Cheap tileable value noise on an axis-aligned grid.
    // Periods are in lattice cells. Wrap ensures perfect seams.
    let per = max(period, vec2f(1.0, 1.0));
    let i = floor(p);
    let f = fract(p);
    let u = smooth2(f);

    let i00 = mod2(i + vec2f(0.0, 0.0), per);
    let i10 = mod2(i + vec2f(1.0, 0.0), per);
    let i01 = mod2(i + vec2f(0.0, 1.0), per);
    let i11 = mod2(i + vec2f(1.0, 1.0), per);

    let a = hash21(i00);
    let b = hash21(i10);
    let c = hash21(i01);
    let d = hash21(i11);

    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

fn fbmValuePeriodic(uv: vec2f, basePeriod: vec2f, octaves: i32) -> f32 {
    // Low-octave tileable fBm over periodic value noise.
    let per0 = max(basePeriod, vec2f(1.0, 1.0));
    var sum: f32 = 0.0;
    var amp: f32 = 0.55;
    var freq: f32 = 1.0;
    for (var i: i32 = 0; i < octaves; i++) {
        let per = max(vec2f(1.0, 1.0), floor(per0 * freq + vec2f(0.5, 0.5)));
        sum += valueNoisePeriodic(uv * per, per) * amp;
        freq *= 2.0;
        amp *= 0.5;
    }
    return sum;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    // Aged parchment base.
    var rgb = vec3f(uniforms.paperColorR, uniforms.paperColorG, uniforms.paperColorB);

    // Everything in this shader is designed to be seamless in UV space because
    // Worlds samples the generated background with uv = fract(...).
    let uv = vUv;
    let res = max(uniforms.resolution, vec2f(1.0, 1.0));

    // Periods are integer-ish (in lattice cells across the tile). Flooring keeps
    // the texture perfectly tileable, even when parameters are fractional.
    // Very high grainScale creates sub-pixel frequencies. Since this shader's
    // output is sampled again by Worlds (without mipmaps), it can shimmer when
    // the camera moves. Clamp to keep the texture stable.
    let grainScale = min(0.12, max(0.0001, uniforms.grainScale));
    let grainPeriod = vec2f(
        max(12.0, floor(res.x * grainScale)),
        max(12.0, floor(res.y * grainScale))
    );

    // Fine grain (high frequency, subtle).
    if (uniforms.grainStrength > 0.0) {
        let grain = fbmValuePeriodic(uv, grainPeriod, 3);
        let g = (grain - 0.5) * 2.0;
        rgb *= 1.0 + g * 0.10 * uniforms.grainStrength;
    }

    // Cloud-like soft shadowing (static) to add “old poster” depth.
    // Keep it low frequency and seamless.
    if (uniforms.cloudStrength > 0.0) {
        let cP = max(1.0, floor(max(0.0001, uniforms.cloudScale) + 0.5));
        let cloudPeriod = vec2f(cP, cP);
        // 2 octaves for performance; normalize by amplitude sum (0.55 + 0.275 = 0.825).
        let cloudBase = clamp(fbmValuePeriodic(uv + vec2f(0.37, 0.11), cloudPeriod, 2) / 0.825, 0.0, 1.0);
        let s = clamp(uniforms.cloudSoftness, 0.0001, 0.45);
        let cloudMask = smoothstep(0.5 - s, 0.5 + s, cloudBase);
        let shadow = cloudMask * 0.28 * saturate(uniforms.cloudStrength);
        rgb *= 1.0 - shadow;
    }

    // Paper fibers: optional, kept cheap and disabled by default.
    if (uniforms.fiberStrength > 0.0) {
        let fiberPeriod = vec2f(max(24.0, floor(res.x * 0.020)), max(24.0, floor(res.y * 0.020)));
        // Anisotropy is faked by scaling UVs. Still seamless because the base noise is periodic.
        let a = saturate(abs(sin(uniforms.fiberAngle)));
        let fuv = mix(uv * vec2f(1.0, 6.0), uv * vec2f(6.0, 1.0), a);
        let fibers = fbmValuePeriodic(fuv, fiberPeriod, 2);
        let f = (fibers - 0.5) * 2.0;
        rgb *= 1.0 + f * 0.06 * uniforms.fiberStrength;
    }

    // Stains/blotches: low-frequency, slightly brown, uneven.
    if (uniforms.stainStrength > 0.0) {
        let stainP = max(1.0, floor(max(0.0001, uniforms.stainScale) + 0.5));
        let stainPeriod = vec2f(stainP, stainP);
        let stainBase = fbmValuePeriodic(uv, stainPeriod, 2);

        // Subtle overall warm “foxing” tint (reddish-brown), driven by the
        // same low-frequency field so it stays coherent and seamless.
        // This pushes the paper toward an old western poster feel.
        let fox = smoothstep(0.25, 0.90, stainBase) * 0.10 * saturate(uniforms.stainStrength);
        rgb = clamp(rgb * (1.0 + vec3f(0.06, 0.01, -0.07) * fox), vec3f(0.0), vec3f(1.0));

        // Push toward splotches / tide-marks.
        let blotch = smoothstep(0.60, 0.98, stainBase);
        let ring = smoothstep(0.20, 0.0, abs(stainBase - 0.70));
        let stain = saturate(blotch * 0.85 + ring * 0.28);

        let stainColor = vec3f(0.50, 0.26, 0.16);
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
        let speckPeriod = vec2f(max(32.0, floor(res.x * 0.35)), max(32.0, floor(res.y * 0.35)));
        let cell = mod2(floor(uv * speckPeriod), speckPeriod);
        let h = hash21(cell);
        let speck = step(0.993, h);
        rgb *= 1.0 - speck * 0.33 * saturate(uniforms.speckleStrength);
    }

    // Creases / folds: very subtle.
    if (uniforms.creaseStrength > 0.0) {
        // Tileable wrinkle field: single low-frequency ridge pass.
        let creasePeriod = vec2f(4.0, 6.0);
        let cBase = fbmValuePeriodic(uv, creasePeriod, 2);
        let crease = smoothstep(0.72, 0.96, 1.0 - abs(cBase * 2.0 - 1.0));
        let cs = saturate(uniforms.creaseStrength);
        rgb *= 1.0 - crease * 0.085 * cs;
        rgb += vec3f(0.030, 0.020, 0.012) * crease * 0.28 * cs;
    }

    // Keep it in-range.
    rgb = clamp(rgb, vec3f(0.0), vec3f(1.0));
    return vec4f(rgb, 1.0);
}
`,
        uniforms: {
            // Base parchment tone (slightly warm, still readable under text)
            paperColorR: 0.97,
            paperColorG: 0.85,
            paperColorB: 0.71,

            // Fine texture layers
            grainStrength: 0.65,
            grainScale: 0.02,
            fiberStrength: 0.7,
            fiberAngle: 0.12,

            // Aging / defects
            stainStrength: 1.5,
            stainScale: 1.2,
            cloudStrength: 0.82,
            cloudScale: 1.0,
            cloudSoftness: 0.12,
            // NOTE: When used as a tiled Worlds background, per-tile edge effects
            // read as visible “cell boundaries”. Keep these off by default.
            vignetteStrength: 0.0,
            edgeBurnStrength: 0.0,
            speckleStrength: 0.0,
            creaseStrength: 0.0
        }
    };
}