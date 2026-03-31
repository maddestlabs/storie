// Border Shader for t|Storie
// Adds a solid color border around content

function getShaderConfig() {
    // WGSL shader (WebGPU) - Auto-converted from GLSL {
    return {
        // Enables pointer remapping through this shader (uv -> contentUV)
        coordinateTransform: 'border',
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
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    resolution: vec2f,
    _pad3: f32,
    _pad4: f32,
    cellSize: vec2f,
    _pad5: f32,
    _pad6: f32,
    backgroundColor: vec3f,
    _pad7: f32,
    borderSize: f32,
    _pad8: f32,
    _pad9: f32,
    _pad10: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

                var uv: vec2f = vUv;
                
                // Border thickness in pixels based on terminal cell size.
                // borderSize is in "cells".
                var cellPx: f32 = max(1.0, min(uniforms.cellSize.x, uniforms.cellSize.y));
                var borderPx: f32 = max(0.0, uniforms.borderSize) * cellPx;
                var borderX: f32 = borderPx / max(uniforms.resolution.x, 1.0);
                var borderY: f32 = borderPx / max(uniforms.resolution.y, 1.0);
                
                // Check if we're in the border region
                var isBorder: bool = (uv.x < borderX || uv.x > (1.0 - borderX) || 
                                uv.y < borderY || uv.y > (1.0 - borderY));
                
                // Calculate content UV (area inside border)
                var denom: vec2f = max(vec2f(0.0001), vec2f(1.0 - 2.0 * borderX, 1.0 - 2.0 * borderY));
                var contentUV: vec2f = (uv - vec2f(borderX, borderY)) / denom;
                contentUV = clamp(contentUV, vec2f(0.0), vec2f(1.0));
                
                // Always sample the content texture (required for uniform control flow)
                var sampledColor: vec3f = textureSampleLevel(contentTexture, contentTextureSampler, contentUV, 0.0).rgb;
                
                // Blend between border color and content
                var color: vec3f = select(sampledColor, uniforms.backgroundColor, isBorder);
                
                return vec4f(color, 1.0);
            }
`,
        
        uniforms: {
            // This is auto-filled by the shader system at runtime.
            cellSize: [10.0, 20.0],

            // Set to 'theme' to pull the active theme background color from the app.
            // Or override with an explicit vec3 like [0.0, 0.0, 0.0].
            backgroundColor: 'theme',

            borderSize: 3.0                      // Border thickness in terminal cells
        }
    };
}