// Simple Spotlight Shader for t|Storie
// Simulates a soft circular spotlight over the rendered texture

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
    output.vUv.y = 1.0 - output.vUv.y; // Flip vertically
    output.position = vec4f(position, 0.0, 1.0);
    return output;
}
`,

        fragmentShader: `@group(0) @binding(0) var contentTexture: texture_2d<f32>;
@group(0) @binding(1) var contentTextureSampler: sampler;

// NOTE: This struct matches the uniform packing in docs/webgpu_shader_system.js:
// [time, pad3] [resolution.xy, pad2] [custom uniforms in insertion order]
struct Uniforms {
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    resolution: vec2f,
    _pad3: f32,
    _pad4: f32,

    lightPos: vec2f,     // UV space (0–1)
    _pad5: f32,
    _pad6: f32,

    radius: f32,         // Spotlight radius (0–1 in UV)
    softness: f32,       // Edge softness (0–1 in UV)
    intensity: f32,      // Brightness multiplier
    ambient: f32,        // Outside-spot ambient multiplier
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

    let uv: vec2f = vUv;

    // Sample the base texture
    let baseColor: vec4f = textureSample(contentTexture, contentTextureSampler, uv);

    // Aspect-corrected distance from spotlight center so the spot stays circular
    let aspect = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let delta = (uv - uniforms.lightPos) * vec2f(aspect, 1.0);
    let dist: f32 = length(delta);

    // Smooth radial falloff: 1.0 at center, 0.0 outside
    let spot: f32 = 1.0 - smoothstep(
        uniforms.radius,
        uniforms.radius + uniforms.softness,
        dist
    );

    // Lighting multiplier: ambient at edges, intensity at center
    let lighting: f32 = mix(uniforms.ambient, uniforms.intensity, spot);
    let litColor: vec3f = baseColor.rgb * lighting;
    return vec4f(litColor, baseColor.a);
}
`,

        uniforms: {
            // IMPORTANT: insertion order here must match Uniforms fields after resolution
            lightPos: [0.5, 0.5], // Center of screen
            radius: 0.25,
            softness: 0.25,
            intensity: 1.25,
            ambient: 0.25
        }
    };
}
