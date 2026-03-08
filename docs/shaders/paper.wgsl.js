// Paper Texture Shader for t|Storie
// Subtle paper grain/noise for realistic paper effect
// Rewritten for WebGPU with optimized noise generation

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
    paperNoise: f32,        // offset 16
    noiseIntensity: f32,    // offset 20
    noiseMix: f32,          // offset 24
    _pad1: f32,             // offset 28 (padding to 32 bytes)
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    var color: vec4f = textureSample(contentTexture, contentTextureSampler, vUv);
    
    // Generate and apply paper texture noise
    if (uniforms.paperNoise > 0.0) {
        var screenPos: vec2f = vUv * uniforms.resolution;
        
        // Multi-scale noise for realistic paper grain
        var noise: f32 = paperNoise3Octaves(screenPos, 1.0);
        
        // Apply intensity
        noise = noise * uniforms.noiseIntensity;
        
        // Apply noise as a multiplicative texture (darken/lighten existing color)
        // Center noise around 1.0 so it darkens AND lightens
        var noiseMod: f32 = 1.0 + (noise - 0.5) * 2.0 * uniforms.noiseMix * uniforms.paperNoise;
        
        // Apply to color
        let modifiedRgb = color.rgb * noiseMod;
        return vec4f(modifiedRgb, color.a);
    }
    
    return color;
}
`,
        uniforms: {
            paperNoise: 0.1,          // Paper texture on/off (0.0-1.0) - TESTING: maxed
            noiseIntensity: 0.3,      // How strong the noise pattern is - TESTING: increased
            noiseMix: 0.5            // How much noise blends with color - TESTING: increased
        }
    };
}