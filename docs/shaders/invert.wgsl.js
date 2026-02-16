// Simple Invert Shader for t|Storie
// Handy negative effect for inverting dark/light themes

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
                output.vUv.y = 1.0 - output.vUv.y;  // Flip vertically
                output.position = vec4f(position, 0.0, 1.0);
                return output;
}
`,
        
        fragmentShader: `@group(0) @binding(0) var contentTexture: texture_2d<f32>;
@group(0) @binding(1) var contentTextureSampler: sampler;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

                let uv: vec2f = vUv;
                
                // Sample the terminal texture
                let sampledColor: vec4f = textureSample(contentTexture, contentTextureSampler, uv);
                
                // Invert the colors
                let invertedRgb = vec3f(1.0) - sampledColor.rgb;
                
                return vec4f(invertedRgb, sampledColor.a);
            }
`,
        
        uniforms: {}
    };
}
