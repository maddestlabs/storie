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

// High-quality hash function for paper texture
fn hash21(p: vec2f) -> f32 {
    var p3: vec3f = fract(vec3f(p.x, p.y, p.x) * 0.1031);
    p3 += dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Multi-octave noise for more realistic paper texture
fn paperNoise(uv: vec2f, scale: f32) -> f32 {
    var noise: f32 = 0.0;
    var amplitude: f32 = 1.0;
    var frequency: f32 = scale;
    
    // 3 octaves for fine detail
    for (var i: i32 = 0; i < 3; i++) {
        noise += hash21(uv * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    
    return noise / 1.875; // Normalize (sum of amplitudes: 1 + 0.5 + 0.25 = 1.875)
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    var color: vec4f = textureSample(contentTexture, contentTextureSampler, vUv);
    
    // Generate and apply paper texture noise
    if (uniforms.paperNoise > 0.0) {
        var screenPos: vec2f = vUv * uniforms.resolution;
        
        // Multi-scale noise for realistic paper grain
        var noise: f32 = paperNoise(screenPos, 1.0);
        
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
            paperNoise: 0.2,          // Paper texture on/off (0.0-1.0) - TESTING: maxed
            noiseIntensity: 0.5,      // How strong the noise pattern is - TESTING: increased
            noiseMix: 0.5            // How much noise blends with color - TESTING: increased
        }
    };
}