// Vignette Shader for t|Storie
// Soft vignette that's evenly distributed toward edges

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
    vignetteStart: f32,     // offset 16
    vignetteLvl: f32,       // offset 20
    _pad1: f32,             // offset 24
    _pad2: f32,             // offset 28 (padding to 32 bytes)
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

                var uv: vec2f = vUv;
                
                // Sample base color
                var color: vec3f = textureSample(contentTexture, contentTextureSampler, uv).rgb;
                
                // Vignette using edge multiplication
                var vignetteUV: vec2f = uv * (vec2f(1.0) - vec2f(uv.y, uv.x));
                var base: f32 = max(vignetteUV.x * vignetteUV.y * uniforms.vignetteLvl, 0.000001);
                var vignette: f32 = pow(base, uniforms.vignetteStart);
                
                color *= vignette;
                
                return vec4f(color, 1.0);
            }
`,
        
        uniforms: {
            vignetteStart: 0.25,  // Controls the power curve (lower = softer falloff)
            vignetteLvl: 40.0     // Controls intensity (higher = stronger effect)
        }
    };
}