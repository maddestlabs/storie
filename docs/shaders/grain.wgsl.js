// Grain Shader for t|Storie
// Blue-noise driven film grain for a more photographic result than procedural hash noise.
//
// The runtime binds a tiled blue-noise texture at binding(2) and a repeat sampler at
// binding(3). Temporal offsets move through the tile without introducing the low-frequency
// streaks and grid patterns typical of simple procedural grain.

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
    time:          f32,   // offset 0 — frame count or elapsed time
    _pad0:         f32,   // offset 4
    resolution:    vec2f, // offset 8
    grainAmount:   f32,   // offset 16 — overall grain strength
    grainSize:     f32,   // offset 20 — texel scale of grain
    shadowLift:    f32,   // offset 24 — grain boost in shadows (film look)
    chromaAmount:  f32,   // offset 28 — subtle per-channel variation
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

@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let baseColor = textureSample(contentTexture, contentTextureSampler, vUv).rgb;

    let noiseScale = max(uniforms.grainSize, 0.001);
    let timeSeed = uniforms.time * 24.0;
    let temporalOffset = vec2f(
        fract(timeSeed * PHI),
        fract(timeSeed * PHI * PHI)
    );
    let baseNoiseUv = vUv * (uniforms.resolution / noiseScale / 64.0) + temporalOffset;

    let noiseR = sampleBlueNoise(baseNoiseUv);
    let noiseG = sampleBlueNoise(baseNoiseUv + vec2f(0.371, 0.173)) * uniforms.chromaAmount + noiseR * (1.0 - uniforms.chromaAmount);
    let noiseB = sampleBlueNoise(baseNoiseUv + vec2f(0.619, 0.417)) * uniforms.chromaAmount + noiseR * (1.0 - uniforms.chromaAmount);
    let grainRGB = vec3f(noiseR, noiseG, noiseB);

    let lum = luminance(baseColor);
    let response = grainResponse(lum, uniforms.shadowLift);
    let grain = grainRGB * uniforms.grainAmount * response;

    let finalColor = clamp(baseColor + grain, vec3f(0.0), vec3f(1.0));
    return vec4f(finalColor, 1.0);
}
`,

        uniforms: {
            grainAmount:  0.02,
            grainSize:    3.0,
            shadowLift:   0.35,
            chromaAmount: 0.22,
        }
    };
}