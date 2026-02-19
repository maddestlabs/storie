// Waver Shader for t|Storie
// Subtle camera-hover simulation: gentle zoom, pan, roll, and 3D tilt.

function getShaderConfig() {
    return {
        // Enables pointer remapping (screen UV -> content UV) for interactive correctness.
        coordinateTransform: 'waver',
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

    // Custom uniforms (ordered to match the JS packer).
    panPx: vec2f,
    _pad5: f32,
    _pad6: f32,

    tiltPx: vec2f,
    _pad7: f32,
    _pad8: f32,

    zoom: f32,
    panSpeed: f32,
    rollPx: f32,
    rollSpeed: f32,

    tiltSpeed: f32,
    tiltWobble: f32,
    perspective: f32,
    _pad9: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn rot2(p: vec2f, a: f32) -> vec2f {
    let c = cos(a);
    let s = sin(a);
    return vec2f(c * p.x - s * p.y, s * p.x + c * p.y);
}

fn rotateX(v: vec3f, a: f32) -> vec3f {
    let c = cos(a);
    let s = sin(a);
    return vec3f(v.x, c * v.y - s * v.z, s * v.y + c * v.z);
}

fn rotateY(v: vec3f, a: f32) -> vec3f {
    let c = cos(a);
    let s = sin(a);
    return vec3f(c * v.x + s * v.z, v.y, -s * v.x + c * v.z);
}

// Maps output UV -> input UV (contentUV)
fn waverUv(uv: vec2f) -> vec2f {
    let t = uniforms.time;
    let res = max(uniforms.resolution, vec2f(1.0));

    // Slow, subtle pan in pixels (roughly 1-2px)
    let panWave = vec2f(
        sin(t * uniforms.panSpeed) + 0.35 * sin(t * uniforms.panSpeed * 0.41 + 1.7),
        sin(t * uniforms.panSpeed * 0.91 + 0.8) + 0.35 * sin(t * uniforms.panSpeed * 0.33 + 2.3)
    );
    let panUv = (panWave * uniforms.panPx) / res;

    // Very small roll rotation (angle derived from desired pixel displacement at edges)
    let minRes = max(1.0, min(res.x, res.y));
    let rollWave = sin(t * uniforms.rollSpeed) + 0.25 * sin(t * uniforms.rollSpeed * 0.37 + 0.9);
    let rollAngle = rollWave * (uniforms.rollPx * 2.0 / minRes);

    // 3D tilt / hover: use tiny rotations around X/Y derived from pixel amplitudes
    let tiltWave = vec2f(
        sin(t * uniforms.tiltSpeed + 1.1),
        sin(t * uniforms.tiltSpeed * 0.83 + 2.4)
    );
    let wobble = vec2f(
        sin(t * uniforms.tiltSpeed * 1.77 + 0.2),
        sin(t * uniforms.tiltSpeed * 1.53 + 1.9)
    );
    let tilt = (tiltWave + wobble * uniforms.tiltWobble) * uniforms.tiltPx;
    let tiltAngleX = tilt.y * 2.0 / res.y;
    let tiltAngleY = tilt.x * 2.0 / res.x;

    // Begin with centered coords
    var p = uv - vec2f(0.5, 0.5);

    // Zoom in (divide to zoom in content)
    let z = max(0.001, uniforms.zoom);
    p = p / z;

    // Apply pan (camera moves -> content moves opposite)
    p = p - panUv;

    // Roll around center
    p = rot2(p, rollAngle);

    // Tilt with a simple perspective projection
    let persp = max(0.2, uniforms.perspective);
    var v = vec3f(p.x, p.y, 1.0 / persp);
    v = rotateX(v, tiltAngleX);
    v = rotateY(v, tiltAngleY);
    let invZ = 1.0 / max(0.2, v.z);
    p = vec2f(v.x, v.y) * invZ;

    return p + vec2f(0.5, 0.5);
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    let contentUV = waverUv(vUv);
    let clampedUV = clamp(contentUV, vec2f(0.0), vec2f(1.0));
    let color = textureSampleLevel(contentTexture, contentTextureSampler, clampedUV, 0.0).rgb;
    return vec4f(color, 1.0);
}
`,

        uniforms: {
            // Pan/tilt sizes are in *pixels*.
            panPx: [1.6, 1.2],
            tiltPx: [2.0, 2.0],

            // Camera feel controls
            zoom: 1.1,
            panSpeed: 0.22,
            rollPx: 1.0,
            rollSpeed: 0.14,
            tiltSpeed: 0.11,
            tiltWobble: 0.35,
            perspective: 1.35
        }
    };
}
