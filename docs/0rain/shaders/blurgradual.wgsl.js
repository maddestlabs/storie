// Gradual Blur Shader for t|Storie
// Blur increases smoothly from a focus point toward the edges (vignette-like, but blur)

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
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    resolution: vec2f,
    _pad3: f32,
    _pad4: f32,

    // Focus controls
    focusPoint: vec2f,
    _pad5: f32,
    _pad6: f32,
    focusRadius: f32,

    // Blur controls
    blurRadius: f32,
    falloffPower: f32,
    sampleCount: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    var uv: vec2f = vUv;

    // Distance from focus point in UV space
    var centerOffset: vec2f = uv - uniforms.focusPoint;
    var distFromCenter: f32 = length(centerOffset);

    // Blur amount: 0 near focusRadius, ramps up toward edges
    var blurAmount: f32 = smoothstep(uniforms.focusRadius, uniforms.focusRadius + 0.4, distFromCenter);
    blurAmount = pow(blurAmount, uniforms.falloffPower);

    var baseColor: vec4f = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0);
    if (blurAmount < 0.02) {
        return baseColor;
    }

    // Blur radius in pixels, scaled by blur amount
    var radiusPx: f32 = blurAmount * uniforms.blurRadius;
    var texelSize: vec2f = 1.0 / uniforms.resolution;
    var r: vec2f = texelSize * radiusPx;

    // Fixed tap patterns: 1, 5, 9, 13 samples
    var color: vec4f = baseColor;
    var total: f32 = 1.0;

    if (uniforms.sampleCount >= 5.0) {
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( r.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-r.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0,  r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0, -r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        total += 4.0;
    }

    if (uniforms.sampleCount >= 9.0) {
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( r.x,  r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-r.x,  r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( r.x, -r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-r.x, -r.y), vec2f(0.0), vec2f(1.0)), 0.0);
        total += 4.0;
    }

    if (uniforms.sampleCount >= 13.0) {
        var r2: vec2f = r * 2.0;
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f( r2.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(-r2.x, 0.0), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0,  r2.y), vec2f(0.0), vec2f(1.0)), 0.0);
        color += textureSampleLevel(contentTexture, contentTextureSampler, clamp(uv + vec2f(0.0, -r2.y), vec2f(0.0), vec2f(1.0)), 0.0);
        total += 4.0;
    }

    var blurred: vec4f = color / total;

    // Blend to preserve a crisp center even with small radii
    return mix(baseColor, blurred, blurAmount);
}
`,

        uniforms: {
            // Focus area (center of sharpness)
            focusPoint: [0.5, 0.5],
            focusRadius: 0.2,

            // Blur intensity (pixels at edges)
            blurRadius: 1.5,

            // Falloff control
            falloffPower: 1.15,

            // Performance / quality: 1, 5, 9, 13
            sampleCount: 13.0
        }
    };
}
