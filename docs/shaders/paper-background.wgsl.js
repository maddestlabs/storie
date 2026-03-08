// Paper Background Shader for Worlds 3D
// Generates paper texture directly as a background (no input texture needed)

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
    paperNoise: f32,        // offset 16 - Paper texture strength (0.0-1.0)
    noiseIntensity: f32,    // offset 20 - How strong the noise pattern is
    noiseMix: f32,          // offset 24 - How much noise blends with color
    paperColorR: f32,       // offset 28 - Paper base color R
    paperColorG: f32,       // offset 32 - Paper base color G
    paperColorB: f32,       // offset 36 - Paper base color B
    scale: f32,             // offset 40 - Paper scale
    _pad1: f32,             // offset 44
    _pad2: f32,             // offset 48
    _pad3: f32,             // offset 52
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn paperGrain3Octaves(screenPos: vec2f) -> f32 {
    // Multi-scale grain with grid-snapped hashes to avoid directional banding.
    let n0 = hash21(floor(screenPos * 8.0));
    let n1 = hash21(floor(screenPos * 23.0));
    let n2 = hash21(floor(screenPos * 61.0));
    return n0 * 0.6 + n1 * 0.3 + n2 * 0.1;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    // Base paper color
    let paperColor = vec3f(uniforms.paperColorR, uniforms.paperColorG, uniforms.paperColorB);

    // Generate paper texture noise
    if (uniforms.paperNoise > 0.0) {
        let screenPos = vUv * uniforms.resolution * uniforms.scale;

        // Multi-scale noise for realistic paper grain
        let noise = paperGrain3Octaves(screenPos);

        // Apply intensity
        let adjustedNoise = noise * uniforms.noiseIntensity;

        // Apply noise as a multiplicative texture (darken/lighten existing color)
        // Center noise around 1.0 so it darkens AND lightens
        let noiseMod = 1.0 + (adjustedNoise - 0.5) * 2.0 * uniforms.noiseMix * uniforms.paperNoise;

        // Apply to color
        let modifiedRgb = paperColor * noiseMod;
        return vec4f(modifiedRgb, 1.0);
    }

    return vec4f(paperColor, 1.0);
}
`,
        uniforms: {
            paperNoise: 1.0,        // Paper texture on/off (0.0-1.0)
            noiseIntensity: 0.3,    // How strong the noise pattern is
            noiseMix: 0.5,          // How much noise blends with color
            paperColorR: 0.98,      // Paper base color R (slightly off-white)
            paperColorG: 0.96,      // Paper base color G
            paperColorB: 0.94,      // Paper base color B
            // Noise frequency scale. Values around 0.04-0.10 tend to read as
            // fine “paper grain” at typical viewport resolutions.
            scale: 0.06
        }
    };
}
