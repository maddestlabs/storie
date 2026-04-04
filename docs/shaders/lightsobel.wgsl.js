// LightSobel Shader for t|Storie
// Lacquer-style bump-mapped lighting: Sobel 3×3 gradient builds a per-pixel
// surface normal from the scene's luminance, then a Phong reflection model
// (diffuse + glossy specular) is applied from a mouse-driven point light.
//
//   • Sobel normal  — treat luminance as a height field; depth controls flatness
//   • Diffuse       — Lambertian dot(normal, lightDir) rolls brightness across ridges
//   • Specular      — reflect(-lightDir, normal) with white highlight → lacquer gloss
//   • Composite     — texColor * diff + white * spec  (same as original lacquer.glsl)
//   • lightX/Y      — UV position of the light; set from mouse each frame

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

// ── Uniform layout ────────────────────────────────────────────────────────────
//  offset  0 : time        (system)
//  offset  4 : _pad0
//  offset  8 : resolution  (system, vec2f / 8 bytes)
//  offset 16 : custom uniforms begin
struct Uniforms {
    time:           f32,
    _pad0:          f32,
    resolution:     vec2f,

    lightX:         f32,   // light UV x position (0–1); driven by mouse
    lightY:         f32,   // light UV y position (0–1); driven by mouse
    depth:          f32,   // Z component of bump normal — higher = flatter surface
    lightZ:         f32,   // light elevation above screen plane (Z in lightDir vec3)

    lightSize:      f32,   // specular shininess exponent (higher = tighter gloss)
    lightIntensity: f32,   // specular brightness multiplier
    diffuseAmt:     f32,   // scales the Lambertian diffuse contribution
    ambient:        f32,   // additive brightness floor so dark regions stay readable
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// ── Helpers ───────────────────────────────────────────────────────────────────
fn _avg(c: vec3f) -> f32 { return (c.r + c.g + c.b) / 3.0; }

fn _s(uv: vec2f, dx: f32, dy: f32, invRes: vec2f) -> f32 {
    return _avg(
        textureSampleLevel(contentTexture, contentTextureSampler,
                           uv + vec2f(dx, dy) * invRes, 0.0).rgb
    );
}

// ── Fragment ──────────────────────────────────────────────────────────────────
@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let uv     = vUv;
    let col    = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0);
    let invRes = 1.0 / max(uniforms.resolution, vec2f(1.0));

    // ── Sobel 3×3 gradient (matches lacquer.glsl kernelX / kernelY) ──────────
    //  kernelX:  [+1  0 -1]    kernelY:  [+1 +2 +1]
    //            [+2  0 -2]              [ 0  0  0]
    //            [+1  0 -1]              [-1 -2 -1]
    let s00 = _s(uv, -1.0, -1.0, invRes);
    let s10 = _s(uv,  0.0, -1.0, invRes);
    let s20 = _s(uv,  1.0, -1.0, invRes);
    let s01 = _s(uv, -1.0,  0.0, invRes);
    let s21 = _s(uv,  1.0,  0.0, invRes);
    let s02 = _s(uv, -1.0,  1.0, invRes);
    let s12 = _s(uv,  0.0,  1.0, invRes);
    let s22 = _s(uv,  1.0,  1.0, invRes);

    let gx = (s00 - s20) + 2.0 * (s01 - s21) + (s02 - s22);
    let gy = (s00 + 2.0 * s10 + s20) - (s02 + 2.0 * s12 + s22);

    // ── Bump normal (lacquer: normalize(vec3(gradX, gradY, depth))) ───────────
    let normal = normalize(vec3f(gx, gy, uniforms.depth));

    // ── Light & view directions (lacquer style) ───────────────────────────────
    let lightPos = vec2f(uniforms.lightX, uniforms.lightY);
    let lightDir = normalize(vec3f(lightPos - uv, uniforms.lightZ));
    let viewDir  = normalize(vec3f(0.5 - uv, 1.0));

    // ── Lambertian diffuse ────────────────────────────────────────────────────
    let diff = max(dot(normal, lightDir), 0.0) * uniforms.diffuseAmt;

    // ── Phong specular (reflect, not half-vector — matches lacquer.glsl) ──────
    let reflectDir = reflect(-lightDir, normal);
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), uniforms.lightSize)
               * uniforms.lightIntensity;

    // ── Composite (lacquer: texColor * diff + white * spec) ───────────────────
    // ambient lifts the dark floor so unlit regions stay readable.
    let lit = col.rgb * (uniforms.ambient + diff) + vec3f(spec);
    return vec4f(clamp(lit, vec3f(0.0), vec3f(1.0)), col.a);
}
`,

        uniforms: {
            // ── light position (mouse-driven at runtime) ───────────────────────
            lightX:         0.5,   // default: screen centre
            lightY:         0.5,

            // ── surface bumpiness (ZGEdepth in lacquer) ────────────────────────
            depth:          2.5,   // ~1.0 gives a good raised feel; higher = flatter

            // ── light elevation ────────────────────────────────────────────────
            lightZ:         0.5,   // Z component of lightDir vec3 (as in lacquer)

            // ── specular (ZGElightSize / ZGElightIntensity in lacquer) ─────────
            lightSize:      1.0,  // shininess exponent; higher = tighter gloss
            lightIntensity:  0.1,  // specular multiplier

            // ── diffuse & ambient ──────────────────────────────────────────────
            diffuseAmt:     0.85,   // full Lambertian; reduce for subtler roll
            ambient:        0.3,   // small floor so unlit areas are not pure black
        }
    };
}
