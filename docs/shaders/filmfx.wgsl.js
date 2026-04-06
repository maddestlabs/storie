// Film FX Shader for t|Storie
// Six optical effects in a single pass, sharing texture fetches where possible.
//
//   1. Soft Blur
//      5-tap cross Gaussian (centre + 4 cardinal arms at blurRadius px) is the
//      cheapest possible directional softening. The same 5 samples seed the bloom
//      inner ring — so blur is structurally free once bloom is in the kernel.
//      blurRadius: 0 = sharp, 1–2 = subtle photographic softness, 3+ = heavy
//
//   2. Chromatic Aberration
//      Lateral RGB channel split proportional to r² from the image centre.
//      Red samples from the original sharp texture shifted outward (longer
//      wavelength, less refraction); blue shifted inward; green uses the blurred
//      centre sample as its channel (green is least-refracted spectrally, and
//      blurring it avoids a hard unblurred reference channel).
//      caStrength: 0 = off, 0.004–0.010 = 1–3 px corner fringe at 1280 wide
//
//   3. Bloom / Halation
//      The blur's 5 cross taps are reused as the bloom inner ring, giving 9
//      effective input points (5 inner + 4 outer diagonals) from only 4 extra
//      fetches beyond what blur already needed.
//      bloomThresh + bloomSoftness: soft-knee threshold; bloomIntensity: additive
//      strength; bloomRadius: outer diagonal tap distance in pixels.
//
//   4. Shadow Toe Lift + Warm Tint
//      Raises the black floor and applies a warm colour cast to deep shadows,
//      matching the ambient scatter and film base fog of real photography.
//
//   5. Desaturation
//      Blend toward greyscale.  saturation: 1.0 = full colour, 0.0 = monochrome.
//      Values around 0.85–0.95 give the slight colour fatigue of aged print.
//
//   6. Film Grain
//      Luminance-weighted 2-octave hash noise, animated at ~24 fps.
//      grainAnimate: 0 = static (paper texture feel), 1 = animated film grain.
//
// Total texture fetches per pixel:
//   5 (blur/bloom inner) + 4 (bloom outer diagonals) + 2 (CA R+B) = 11
//
// Recommended chain:  lightsobel → filmfx → blurgradual → lightvignette

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

// ── Uniform layout (96 bytes, 6 × 16-byte rows) ──────────────────────────────
//  offset  0 : time        (system f32)
//  offset  4 : _pad0
//  offset  8 : resolution  (system vec2f)
//  offset 16 : custom uniforms begin
struct Uniforms {
    time:           f32,   // offset  0  (system)
    _pad0:          f32,   // offset  4
    resolution:     vec2f, // offset  8  (system)

    // ── Chromatic aberration (offset 16) ─────────────────────────────────────
    caStrength:     f32,   //  16 — radial channel split; 0=off, 0.006 ≈ 2px corner fringe

    // ── Bloom (offset 20) ─────────────────────────────────────────────────────
    bloomThresh:    f32,   //  20 — luminance threshold for bright extraction (0–1)
    bloomIntensity: f32,   //  24 — additive bloom strength; 0=off
    bloomRadius:    f32,   //  28 — outer diagonal tap distance in pixels

    // ── Shadow toe lift (offset 32) ───────────────────────────────────────────
    liftAmount:     f32,   //  32 — max floor lift; 0=off, 0.045 ≈ 11/255 floor
    shadowRange:    f32,   //  36 — luminance below which lift applies (e.g. 0.28)
    shadowTintR:    f32,   //  40 — shadow tint R (0–1)
    shadowTintG:    f32,   //  44 — shadow tint G (0–1)

    // ── (offset 48) ───────────────────────────────────────────────────────────
    shadowTintB:    f32,   //  48 — shadow tint B (0–1)
    bloomSoftness:  f32,   //  52 — soft knee half-width around bloomThresh

    // ── Blur (offset 56) ──────────────────────────────────────────────────────
    blurRadius:     f32,   //  56 — cross-tap arm length in pixels; 0=sharp, 1.5=subtle

    // ── Desaturation (offset 60) ──────────────────────────────────────────────
    saturation:     f32,   //  60 — 1.0=full colour, 0.0=greyscale

    // ── Film Grain (offset 64) ────────────────────────────────────────────────
    grainAmount:    f32,   //  64 — grain master strength; 0=off, 1=heavy
    grainSize:      f32,   //  68 — spatial scale; 1.0=sharp 1px grain, 0.5=coarser
    grainAnimate:   f32,   //  72 — 0=static, 1=animated ~24fps

    _pad1:          f32,   //  76
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// ── Helpers ────────────────────────────────────────────────────────────────────
fn filmLuma(c: vec3f) -> f32 {
    return dot(c, vec3f(0.299, 0.587, 0.114));
}

fn extractBright(c: vec3f) -> vec3f {
    let l  = filmLuma(c);
    let lo = uniforms.bloomThresh - uniforms.bloomSoftness;
    let hi = uniforms.bloomThresh + uniforms.bloomSoftness;
    return c * smoothstep(lo, hi, l);
}

// ── Fragment ───────────────────────────────────────────────────────────────────
@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let texel = 1.0 / uniforms.resolution;

    // ── 1 + 3. Blur cross taps — shared with bloom inner ring ─────────────────
    // 5-tap cross Gaussian.  Weights: centre=0.4, each arm=0.15 → sum=1.0.
    // The tap distance drives both the soft-blur neighbourhood and the bloom inner
    // ring simultaneously, so blur adds zero net fetch cost over bloom alone.
    let br = max(uniforms.blurRadius, 0.5);

    let c0v = textureSampleLevel(contentTexture, contentTextureSampler, vUv, 0.0);
    let cL  = textureSampleLevel(contentTexture, contentTextureSampler,
                  vUv + vec2f(-br, 0.0) * texel, 0.0).rgb;
    let cR  = textureSampleLevel(contentTexture, contentTextureSampler,
                  vUv + vec2f( br, 0.0) * texel, 0.0).rgb;
    let cU  = textureSampleLevel(contentTexture, contentTextureSampler,
                  vUv + vec2f(0.0,-br) * texel, 0.0).rgb;
    let cD  = textureSampleLevel(contentTexture, contentTextureSampler,
                  vUv + vec2f(0.0, br) * texel, 0.0).rgb;

    let blurCol = c0v.rgb * 0.4 + (cL + cR + cU + cD) * 0.15;

    // ── 2. Chromatic Aberration ────────────────────────────────────────────────
    // r² weighting: zero at centre, grows toward corners exactly as real lateral CA.
    // Red and blue sample the *original* (sharp) texture at offset UVs for crisp
    // colour fringing on card edges; green channel comes from the blurred centre
    // (green shifts least spectrally, and soft-green avoids a hard unblurred axis).
    let p     = vUv - vec2f(0.5);
    let r2    = dot(p, p);
    let caOff = p * uniforms.caStrength * r2;

    let rSamp = textureSampleLevel(contentTexture, contentTextureSampler,
                    clamp(vUv + caOff, vec2f(0.0), vec2f(1.0)), 0.0).r;
    let bSamp = textureSampleLevel(contentTexture, contentTextureSampler,
                    clamp(vUv - caOff, vec2f(0.0), vec2f(1.0)), 0.0).b;

    var col = vec3f(rSamp, blurCol.g, bSamp);

    // ── 3. Bloom — 4 outer diagonal taps, inner shared from blur ──────────────
    // Inner ring:  5 cross samples already fetched above (no extra cost)
    // Outer ring:  4 diagonal taps at bloomRadius px (4 new fetches)
    // Weight sum:  centre(1) + inner4(1) + outer4(0.5) = 7  →  normalised result
    if (uniforms.bloomIntensity > 0.0) {
        let od  = uniforms.bloomRadius + 0.5;
        var bAcc = extractBright(c0v.rgb)
                 + extractBright(cL) + extractBright(cR)
                 + extractBright(cU) + extractBright(cD);

        bAcc += extractBright(textureSampleLevel(contentTexture, contentTextureSampler,
                    vUv + vec2f( od,  od) * texel, 0.0).rgb) * 0.5;
        bAcc += extractBright(textureSampleLevel(contentTexture, contentTextureSampler,
                    vUv + vec2f(-od,  od) * texel, 0.0).rgb) * 0.5;
        bAcc += extractBright(textureSampleLevel(contentTexture, contentTextureSampler,
                    vUv + vec2f( od, -od) * texel, 0.0).rgb) * 0.5;
        bAcc += extractBright(textureSampleLevel(contentTexture, contentTextureSampler,
                    vUv + vec2f(-od, -od) * texel, 0.0).rgb) * 0.5;

        col += (bAcc / 7.0) * uniforms.bloomIntensity;
    }

    // ── 4. Shadow Toe Lift + Warm Tint ─────────────────────────────────────────
    if (uniforms.liftAmount > 0.0) {
        let liftFactor = smoothstep(uniforms.shadowRange, 0.0, filmLuma(col));
        col += vec3f(uniforms.shadowTintR, uniforms.shadowTintG, uniforms.shadowTintB)
               * liftFactor * uniforms.liftAmount;
    }

    // ── 5. Desaturation ────────────────────────────────────────────────────────
    if (uniforms.saturation < 1.0) {
        col = mix(vec3f(filmLuma(col)), col, uniforms.saturation);
    }

    // ── 6. Film Grain ──────────────────────────────────────────────────────────
    // Two-octave luminance-weighted hash noise, snapped to ~24 fps for animation.
    // Bell weight 4L(1-L): grain is zero at pure black/white, peaks at midtones.
    if (uniforms.grainAmount > 0.0) {
        let frameSeed = select(0.0, floor(uniforms.time * 24.0),
                               uniforms.grainAnimate > 0.5);
        let coord = vUv * uniforms.resolution * uniforms.grainSize
                  + vec2f(frameSeed * 127.1, frameSeed * 311.7);
        let noise  = hash21(coord) * 0.75
                   + hash21(coord * 0.5 + vec2f(17.3, 41.9)) * 0.25;
        let weight = 4.0 * filmLuma(col) * (1.0 - filmLuma(col));
        //col += vec3f((noise - 0.5) * uniforms.grainAmount * weight * 0.35);
    }

    return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), c0v.a);
}
`,

        uniforms: {
            // ── Chromatic aberration ──────────────────────────────────────────
            caStrength:     0.006,   // ~2px corner fringe at 1280 wide

            // ── Bloom ─────────────────────────────────────────────────────────
            bloomThresh:    0.72,    // catches card faces (~L 0.97), not felt (~L 0.15)
            bloomSoftness:  0.08,
            bloomIntensity: 0.055,
            bloomRadius:    9.0,     // outer diagonal tap distance in pixels

            // ── Shadow toe lift ────────────────────────────────────────────────
            liftAmount:     0.045,   // raises pure black to ~11/255
            shadowRange:    0.28,
            shadowTintR:    1.00,    // warm amber — tungsten lamp at table level
            shadowTintG:    0.88,
            shadowTintB:    0.72,

            // ── Blur ──────────────────────────────────────────────────────────
            blurRadius:     2.5,     // 1.5px cross: just takes the CG edge off

            // ── Desaturation ──────────────────────────────────────────────────
            saturation:     0.62,    // slight fade — aged photographic print feel

            // ── Grain ─────────────────────────────────────────────────────────
            grainAmount:    0.6,
            grainSize:      4.0,     // 1px grain — sharpest / most film-like
            grainAnimate:   0.0,     // animated; set 0.0 for static paper texture
        }
    };
}
