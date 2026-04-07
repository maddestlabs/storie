// Vintage Shader for t|Storie
// One-pass approximation of the Klondike stack:
//   lightsoft + blur + grain + blurgradual + lightvignette + desaturation
//
// This is not pixel-identical to chaining five independent post-process passes,
// because a single shader has no intermediate render targets to feed one effect
// into the next. Instead it folds the same ingredients into one pass so the demo
// pays the fullscreen overhead once while keeping the same overall look.

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
@group(0) @binding(2) var blueNoiseTexture: texture_2d<f32>;
@group(0) @binding(3) var blueNoiseSampler: sampler;

struct Uniforms {
    time:             f32,
    _pad0:            f32,
    resolution:       vec2f,

    swayAmp:          f32,
    swaySpeed:        f32,
    lightY:           f32,
    lightHeight:      f32,

    diffuseAmt:       f32,
    specAmt:          f32,
    specShine:        f32,
    ambient:          f32,

    lightX:           f32,
    blurRadius:       f32,
    blurStrength:     f32,
    gradualBlurRadius:f32,

    focusPoint:       vec2f,
    focusRadius:      f32,
    falloffPower:     f32,

    grainAmount:      f32,
    grainSize:        f32,
    shadowLift:       f32,
    chromaAmount:     f32,

    vignetteStart:    f32,
    vignetteLvl:      f32,
    desaturation:     f32,
    _pad1:            f32,
}
@group(0) @binding(4) var<uniform> uniforms: Uniforms;

const PHI: f32 = 1.6180339887498948482;

fn luminance(color: vec3f) -> f32 {
    return dot(color, vec3f(0.299, 0.587, 0.114));
}

fn grainResponse(lum: f32, shadowLift: f32) -> f32 {
    let midtone = 1.0 - abs(lum - 0.5) * 2.0;
    let shadow = (1.0 - lum) * shadowLift;
    return clamp(midtone + shadow, 0.0, 1.5);
}

fn sampleBlueNoise(uv: vec2f) -> f32 {
    return textureSampleLevel(blueNoiseTexture, blueNoiseSampler, fract(uv), 0.0).r * 2.0 - 1.0;
}

// Shared Gaussian blur kernel. Radius grows toward the edges to absorb the old
// blur + blurgradual passes into one sample pattern.
fn gaussianBlur(uv: vec2f, radius: f32) -> vec3f {
    let px = 1.0 / uniforms.resolution;
    let r = max(radius, 0.001);

    let o1 = 1.3846154 * r;
    let o2 = 3.2307692 * r;
    let w0 = 0.2270270;
    let w1 = 0.3162162;
    let w2 = 0.0702703;

    let center = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0).rgb;

    var h = center * w0;
    h += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( o1 * px.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w1;
    h += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-o1 * px.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w1;
    h += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( o2 * px.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w2;
    h += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-o2 * px.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w2;

    var v = center * w0;
    v += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0,  o1 * px.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w1;
    v += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0, -o1 * px.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w1;
    v += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0,  o2 * px.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w2;
    v += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0, -o2 * px.y), vec2f(0.0), vec2f(1.0)), 0.0).rgb * w2;

    return (h + v) * 0.5;
}

@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let uv = vUv;
    let base = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0);

    // Fold blurgradual into the blur radius itself: center stays near blurRadius,
    // edges expand toward blurRadius + gradualBlurRadius.
    var blurAmount = smoothstep(uniforms.focusRadius, uniforms.focusRadius + 0.4, length(uv - uniforms.focusPoint));
    blurAmount = pow(blurAmount, uniforms.falloffPower);
    let effectiveRadius = uniforms.blurRadius + blurAmount * uniforms.gradualBlurRadius;
    let blurred = gaussianBlur(uv, effectiveRadius);
    var col = mix(base.rgb, blurred, clamp(uniforms.blurStrength, 0.0, 1.0));

    // Soft swaying overhead light.
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let lx = uniforms.lightX + sin(uniforms.time * uniforms.swaySpeed) * (uniforms.swayAmp / aspect);
    let lightPos = vec3f(lx, uniforms.lightY, uniforms.lightHeight);
    let lightDir = normalize(lightPos - vec3f(uv, 0.0));
    let normal = vec3f(0.0, 0.0, 1.0);
    let diffuse = max(dot(normal, lightDir), 0.0) * uniforms.diffuseAmt;
    let viewDir = vec3f(0.0, 0.0, 1.0);
    let halfDir = normalize(lightDir + viewDir);
    let specular = pow(max(dot(normal, halfDir), 0.0), uniforms.specShine) * uniforms.specAmt;
    col = col * (uniforms.ambient + diffuse) + vec3f(specular);

    // Blue-noise grain.
    let noiseScale = max(uniforms.grainSize, 0.001);
    let timeSeed = uniforms.time * 24.0;
    let temporalOffset = vec2f(fract(timeSeed * PHI), fract(timeSeed * PHI * PHI));
    let baseNoiseUv = uv * (uniforms.resolution / noiseScale / 64.0) + temporalOffset;
    let noiseR = sampleBlueNoise(baseNoiseUv);
    let noiseG = sampleBlueNoise(baseNoiseUv + vec2f(0.371, 0.173)) * uniforms.chromaAmount + noiseR * (1.0 - uniforms.chromaAmount);
    let noiseB = sampleBlueNoise(baseNoiseUv + vec2f(0.619, 0.417)) * uniforms.chromaAmount + noiseR * (1.0 - uniforms.chromaAmount);
    let grainRGB = vec3f(noiseR, noiseG, noiseB);
    let grain = grainRGB * uniforms.grainAmount * grainResponse(luminance(col), uniforms.shadowLift);
    col = clamp(col + grain, vec3f(0.0), vec3f(1.0));

    // Vintage fade.
    col = mix(col, vec3f(luminance(col)), clamp(uniforms.desaturation, 0.0, 1.0));

    // Edge vignette last, matching the old chain.
    let vignetteUV = uv * (vec2f(1.0) - vec2f(uv.y, uv.x));
    let vignetteBase = max(vignetteUV.x * vignetteUV.y * uniforms.vignetteLvl, 0.000001);
    let vignette = pow(vignetteBase, uniforms.vignetteStart);
    col *= vignette;

    return vec4f(clamp(col, vec3f(0.0), vec3f(1.0)), base.a);
}
`,

        uniforms: {
            // ── lightsoft defaults ──────────────────────────────────────────
            swayAmp:           1.22,
            swaySpeed:         0.8,
            lightY:            0.15,
            lightHeight:       0.55,
            diffuseAmt:        0.26,
            specAmt:           0.13,
            specShine:         20.0,
            ambient:           0.82,
            lightX:            0.5,

            // ── blur + blurgradual defaults ────────────────────────────────
            blurRadius:        0.7,
            blurStrength:      1.0,
            gradualBlurRadius: 1.05,
            focusPoint:        [0.5, 0.5],
            focusRadius:       0.2,
            falloffPower:      1.15,

            // ── grain defaults ──────────────────────────────────────────────
            grainAmount:       0.02,
            grainSize:         3.0,
            shadowLift:        0.35,
            chromaAmount:      0.22,

            // ── vignette + vintage fade ────────────────────────────────────
            vignetteStart:     0.25,
            vignetteLvl:       40.0,
            desaturation:      0.3,
        }
    };
}