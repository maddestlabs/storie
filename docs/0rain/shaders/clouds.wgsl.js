// Clouds Shader for tStorie
// Procedural cloud/fog effect inspired by Chrono Trigger

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
        // Base uniforms provided by the shader system.
        time: f32,
        _pad0: f32,
        _pad1: f32,
        _pad2: f32,
        resolution: vec2f,
        _pad3: f32,
        _pad4: f32,

        // Custom uniforms (ordered to match JS packer alignment rules).
        cloudDirection: vec2f,
        _pad5: f32,
        _pad6: f32,
        cloudColor: vec3f,
        _pad7: f32,

        cloudDensity: f32,
        cloudScale: f32,
        cloudSpeed: f32,
        cloudSoftness: f32,
        layerCount: f32,
        _pad8: f32,
        _pad9: f32,
        _pad10: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn hash(p: vec2f) -> vec2f {
    let q = vec2f(
        dot(p, vec2f(127.1, 311.7)),
        dot(p, vec2f(269.5, 183.3))
    );
    return fract(sin(q) * 43758.5453);
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    return a + (b - a) * t;
}

fn noise(p: vec2f) -> f32 {
    let i = floor(p);
    let f = fract(p);

    // Smooth interpolation
    let u = f * f * (3.0 - 2.0 * f);

    // Four corners
    let a = dot(hash(i + vec2f(0.0, 0.0)) - 0.5, f - vec2f(0.0, 0.0));
    let b = dot(hash(i + vec2f(1.0, 0.0)) - 0.5, f - vec2f(1.0, 0.0));
    let c = dot(hash(i + vec2f(0.0, 1.0)) - 0.5, f - vec2f(0.0, 1.0));
    let d = dot(hash(i + vec2f(1.0, 1.0)) - 0.5, f - vec2f(1.0, 1.0));

    // Bilinear interpolation
    let ab = lerp(a, b, u.x);
    let cd = lerp(c, d, u.x);
    return lerp(ab, cd, u.y);
}

fn fbm(p: vec2f, octaves: i32) -> f32 {
    var value: f32 = 0.0;
    var amplitude: f32 = 0.5;
    var frequency: f32 = 1.0;

    for (var i: i32 = 0; i < 5; i = i + 1) {
        if (i >= octaves) {
            break;
        }
        value = value + amplitude * noise(p * frequency);
        frequency = frequency * 2.0;
        amplitude = amplitude * 0.5;
    }

    return value;
}

fn cloudPattern(uv: vec2f, timeOffset: f32) -> f32 {
    // Apply cloud movement
    let movement = uniforms.cloudDirection * uniforms.time * uniforms.cloudSpeed + vec2f(timeOffset * 10.0, 0.0);
    let cloudUv = (uv + movement) * uniforms.cloudScale;

    // Create billowy cloud shapes with FBM
    var clouds = fbm(cloudUv, 4);

    // Add another layer at different scale for variety
    clouds = clouds + fbm(cloudUv * 0.5 + vec2f(100.0), 3) * 0.5;

    // Normalize and apply softness
    clouds = (clouds + 1.0) * 0.5;
    clouds = smoothstep(0.5 - uniforms.cloudSoftness, 0.5 + uniforms.cloudSoftness, clouds);

    return clouds;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {

    // Aspect-correct UVs so noise doesn't stretch with window size.
    let aspect = max(1e-6, uniforms.resolution.x) / max(1e-6, uniforms.resolution.y);
    let uv = (vUv - 0.5) * vec2f(aspect, 1.0) + 0.5;

    // Sample base texture (use SampleLevel to avoid any non-uniform-flow restrictions).
    let baseColor = textureSampleLevel(contentTexture, contentTextureSampler, vUv, 0.0).rgb;

    // Generate multiple cloud layers for depth
    var cloudMask: f32 = 0.0;
    let layers = clamp(i32(round(uniforms.layerCount)), 1, 4);

    for (var i: i32 = 0; i < 4; i = i + 1) {
        if (i >= layers) {
            break;
        }
        let fi = f32(i);
        let layerOffset = fi * 0.3;
        let layerWeight = 1.0 - fi * 0.2;
        cloudMask = cloudMask + cloudPattern(uv, layerOffset) * layerWeight;
    }

    cloudMask = cloudMask / f32(layers);
    let alpha = clamp(cloudMask * uniforms.cloudDensity, 0.0, 1.0);
    let cloudCol = uniforms.cloudColor;
    let outColor = baseColor * (1.0 - alpha) + cloudCol * alpha;

    return vec4f(outColor, 1.0);
}
`,
        
        uniforms: {
    // Vectors first (keeps uniform buffer alignment compatible with the JS packer)
    cloudDirection: [1.15, -0.3],
    cloudColor: [0.7, 0.75, 0.8],

    cloudDensity: 0.5,
    cloudScale: 0.5,
    cloudSpeed: 0.075,
    cloudSoftness: 0.01,
    layerCount: 2.0
        }
    };
}