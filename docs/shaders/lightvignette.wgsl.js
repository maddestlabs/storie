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
    bass: f32,              // offset 24 — normalised bass band energy (0–1)
    beatImpulse: f32,       // offset 28 — decaying impulse, 1.0 on beat then falls to 0
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
                // Audio-reactive: bass and beat impulse loosen the vignette; beat adds a warm flash
                var activeLvl: f32 = uniforms.vignetteLvl + uniforms.bass * 8.0 + uniforms.beatImpulse * 12.0;
                var vignetteUV: vec2f = uv * (vec2f(1.0) - vec2f(uv.y, uv.x));
                var base: f32 = max(vignetteUV.x * vignetteUV.y * activeLvl, 0.000001);
                var vignette: f32 = pow(base, uniforms.vignetteStart);
                
                color *= vignette;
                color += vec3f(0.10, 0.06, 0.02) * uniforms.beatImpulse;
                
                return vec4f(color, 1.0);
            }
`,
        
        uniforms: {
            vignetteStart: 0.25,  // Controls the power curve (lower = softer falloff)
            vignetteLvl: 40.0,    // Controls intensity (higher = stronger effect)
            bass: 0.0,            // Driven at runtime by audio analyser (0–1)
            beatImpulse: 0.0      // Driven at runtime by beat detector (1→0 decay)
        }
    };
}