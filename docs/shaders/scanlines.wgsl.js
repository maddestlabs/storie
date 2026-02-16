// Simple Scanlines Shader for t|Storie
// Clean, good-looking horizontal scanlines

function getShaderConfig() {
    // WGSL shader (WebGPU) - Auto-converted from GLSL {
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
    scanlineStrength: f32,  // offset 16
    scanlineWidth: f32,     // offset 20
    scanlineSpeed: f32,     // offset 24
    _pad1: f32,             // offset 28 (padding to 32 bytes)
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

                var uv: vec2f = vUv;
                
                // Sample base color
                var color: vec3f = textureSample(contentTexture, contentTextureSampler, uv).rgb;
                
                // Calculate scanline pattern
                // Protect against invalid width (e.g., mis-packed uniforms reading as 0)
                var width: f32 = max(uniforms.scanlineWidth, 0.0001);
                var scanline: f32 = sin((uv.y + uniforms.time * uniforms.scanlineSpeed) * uniforms.resolution.y * 3.14159 / width);
                
                // Convert from -1.0,1.0 to 0.0,1.0 range and apply strength
                scanline = uniforms.scanlineStrength + (1.0 - uniforms.scanlineStrength) * (scanline * 0.5 + 0.5);
                
                // Apply scanlines
                color *= scanline;
                
                return vec4f(color, 1.0);
            }
`,
        
        uniforms: {
            scanlineStrength: 0.7,    // 0.0 = black lines, 1.0 = no effect
            scanlineWidth: 1.5,       // Pixels per scanline pair
            scanlineSpeed: 0.0        // 0.0 = static, 0.01 = slow scroll
        }
    };
}