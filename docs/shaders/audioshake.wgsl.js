// Audio Shake Shader for Storie
// Displaces UV coordinates sinusoidally to produce a screen-shake effect.
// Driven by script-supplied `strength` (0–1) and `phase` (radians) uniforms.
// Add to a shader chain before other effects: shaders: "audioshake+vintage"

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

struct Uniforms {
    time: f32,        // offset 0  (built-in)
    _pad0: f32,       // offset 4
    resolution: vec2f,// offset 8  (built-in)
    strength: f32,    // offset 16 — 0..1, t² from trauma pattern in script
    phase: f32,       // offset 20 — radians, advanced at 12Hz by script
    _pad1: f32,       // offset 24
    _pad2: f32,       // offset 28
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    // Primary horizontal displacement + secondary vertical at irrational frequency ratio.
    // aspect-correct: x displacement is naturally larger in pixel space so scale y down.
    let amp = uniforms.strength * 0.03;  // peak UV displacement: 0.03 = ~58px at 1920px wide
    let dx = amp * sin(uniforms.phase);
    let dy = amp * 0.55 * sin(uniforms.phase * 0.73 + 1.1);

    // Clamp away from edges so displaced samples don't wrap or go black
    let uv = clamp(vUv + vec2f(dx, dy), vec2f(0.002), vec2f(0.998));
    let color = textureSample(contentTexture, contentTextureSampler, uv);
    return color;
}
`,
        uniforms: {
            strength: 0.0,  // driven by audio each frame
            phase: 0.0,     // driven by audio each frame
        }
    };
}
