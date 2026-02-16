// CRT Frame Shader for t|Storie
// Curved CRT screen with decorative frame

function getShaderConfig() {
    // WGSL shader (WebGPU) - Auto-converted from GLSL {
    return {
        // Enables pointer remapping (screen UV -> content UV) so curved CRT effects remain interactive.
        coordinateTransform: 'crt',
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
    curveStrength: f32,     // offset 16
    frameSize: f32,         // offset 20
    frameHue: f32,          // offset 24
    frameSat: f32,          // offset 28
    frameLight: f32,        // offset 32
    frameReflect: f32,      // offset 36
    frameGrain: f32,        // offset 40
    _pad1: f32,             // offset 44 (padding to 48 bytes)
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn random(c: vec2f) -> f32 {
    return fract(sin(dot(c, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn hsl2rgb(c: vec3f) -> vec3f {
    let K: vec4f = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p: vec3f = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}

fn mirror01(x: f32) -> f32 {
    var v: f32 = x;
    if (v < 0.0) {
        v = -v;
    }
    if (v > 1.0) {
        v = 2.0 - v;
    }
    return v;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    let iTime: f32 = uniforms.time;
    let iResolution: vec2f = uniforms.resolution;

    var uv: vec2f = vUv;
    let center: vec2f = vec2f(0.5, 0.5);
    let distanceFromCenter: f32 = length(uv - center);

    // Frame thickness in UV units (frameSize is in pixels)
    let px: f32 = 1.0 / max(iResolution.x, 1.0);
    let frame: f32 = uniforms.frameSize * px;

    // Apply CRT curvature (matches original GLSL)
    uv = vUv + (vUv - center) * pow(distanceFromCenter, 5.0) * uniforms.curveStrength;

    // Determine if we're in the frame region
    let isFrame: bool = (uv.x < frame || uv.x > (1.0 - frame) || uv.y < frame || uv.y > (1.0 - frame));

    // Calculate content UV (everything inside the frame)
    let denom: f32 = max(1.0 - 2.0 * frame, 0.0001);
    let contentUV: vec2f = (uv - vec2f(frame, frame)) / denom;

    var color: vec3f = vec3f(0.0);

    if (isFrame) {
        // Frame rendering with gradient and grain
        let frameVal: f32 = 100.0;
        let nX: f32 = frameVal / max(iResolution.x, 1.0);
        let nY: f32 = frameVal / max(iResolution.y, 1.0);

        let distX: f32 = min(uv.x, 1.0 - uv.x);
        let distY: f32 = min(uv.y, 1.0 - uv.y);
        let minDist: f32 = min(distX, distY);

        let ramp: f32 = (minDist / max(nX, nY)) * 4.0;
        let intensity: f32 = mix(uniforms.frameLight, 0.0, ramp);
        color = hsl2rgb(vec3f(uniforms.frameHue, uniforms.frameSat, intensity));
        color *= 1.0 - uniforms.frameGrain * random(uv);

        // Reflection effect on frame - mirror and blur the content
        var reflectedUV: vec2f = contentUV;
        if (reflectedUV.x < 0.0) {
            reflectedUV.x = -reflectedUV.x;
        } else if (reflectedUV.x > 1.0) {
            reflectedUV.x = 2.0 - reflectedUV.x;
        }
        if (reflectedUV.y < 0.0) {
            reflectedUV.y = -reflectedUV.y;
        } else if (reflectedUV.y > 1.0) {
            reflectedUV.y = 2.0 - reflectedUV.y;
        }

        // Simple blur for reflection (matches original radius)
        var blurred: vec3f = vec3f(0.0);
        let blur: f32 = 2.0 / max(iResolution.x, 1.0);
        for (var x: i32 = -1; x <= 1; x = x + 1) {
            for (var y: i32 = -1; y <= 1; y = y + 1) {
                let blurPos: vec2f = reflectedUV + vec2f(f32(x) * blur, f32(y) * blur);
                blurred += textureSampleLevel(contentTexture, contentTextureSampler, blurPos, 0.0).rgb;
            }
        }
        blurred = blurred / 9.0;
        color += blurred * uniforms.frameReflect * 0.5;

        // Animated light source on frame
        let lightX: f32 = 0.5 + sin(iTime * 1.75) * 0.35;
        let lightPos: vec2f = vec2f(lightX, 0.2);
        let lightDist: f32 = length(uv - lightPos);
        let lightFalloff: f32 = pow(clamp(1.0 - (lightDist / 1.5), 0.0, 1.0), 0.85);
        color *= mix(0.25, 2.5, lightFalloff);
    } else {
        // CRT content area - sample texture only if in bounds
        if (contentUV.x < 0.0 || contentUV.x > 1.0 || contentUV.y < 0.0 || contentUV.y > 1.0) {
            color = vec3f(0.0);
        } else {
            color = textureSampleLevel(contentTexture, contentTextureSampler, contentUV, 0.0).rgb;
        }
    }

    return vec4f(color, 1.0);
}
`,
        
        uniforms: {
            curveStrength: 0.95,      // CRT screen curvature (0.0 = flat, 1.0 = curved)
            frameSize: 20.0,          // Outer frame thickness in pixels
            frameHue: 0.025,          // Frame color hue (0.0-1.0)
            frameSat: 0.0,            // Frame color saturation (0.0-1.0)
            frameLight: 0.01,         // Frame base brightness (0.0-1.0)
            frameReflect: 0.35,       // Screen reflection on frame (0.0-1.0)
            frameGrain: 0.25          // Frame texture grain (0.0-1.0)
        }
    };
}