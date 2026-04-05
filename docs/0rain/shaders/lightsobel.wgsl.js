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
@group(0) @binding(2) var materialTexture: texture_2d<f32>;

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
@group(0) @binding(3) var<uniform> uniforms: Uniforms;

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

    // ── Per-pixel material properties (from WebGPUUIRenderer material target) ─
    //   R = roughness  (0=mirror, 1=fully diffuse)
    //   G = normalScale (0=no bump, 1=full bump)
    //   B = metallic    (not used in this pass)
    //   A = emissive    (not used in this pass)
    let mat        = textureSampleLevel(materialTexture, contentTextureSampler, uv, 0.0);
    let roughness  = mat.r;   // [0,1]
    let normalScale = mat.g;  // [0,1]

    // Modulate the uniform depth by roughness:
    //   rough surfaces (paper, felt) = lower depth value = stronger bump relief
    //   smooth surfaces (card back, lacquer) = higher depth = flatter normal
    // Mapping: roughness 1.0 → depth*0.4,  roughness 0.0 → depth*4.0
    let roughDepth = uniforms.depth * mix(4.0, 0.4, roughness);

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

    // normalScale gates the Sobel gradient: 0 = flat normal (no bump), 1 = full bump.
    let scaledGx = gx * normalScale;
    let scaledGy = gy * normalScale;

    // ── Bump normal (lacquer: normalize(vec3(gradX, gradY, depth))) ───────────
    let normal = normalize(vec3f(scaledGx, scaledGy, roughDepth));

    // ── Light & view directions (lacquer style) ───────────────────────────────
    let lightPos = vec2f(uniforms.lightX, uniforms.lightY);
    let lightDir = normalize(vec3f(lightPos - uv, uniforms.lightZ));
    let viewDir  = normalize(vec3f(0.5 - uv, 1.0));

    // ── Lambertian diffuse ────────────────────────────────────────────────────
    let diff = max(dot(normal, lightDir), 0.0) * uniforms.diffuseAmt;

    // ── Phong specular — roughness narrows/dims the highlight ──────────────────
    // Smooth surfaces (roughness≈0) → tight bright gloss; rough (≈1) → broad dim scatter
    let specExp = uniforms.lightSize * mix(64.0, 1.0, roughness);
    let specAmt = uniforms.lightIntensity * mix(1.0, 0.1, roughness);
    let reflectDir = reflect(-lightDir, normal);
    let spec = pow(max(dot(viewDir, reflectDir), 0.0), specExp) * specAmt;

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

            // ── surface bumpiness ─────────────────────────────────────────────
            // Lower depth = smaller Z in normalize(gx, gy, Z) = steeper tilts
            // from Sobel gradients = more visible bump relief on the background.
            // Cards use normalScale:0.0 so depth has no effect on them.
            depth:          0.5,

            // ── light elevation ────────────────────────────────────────────────
            lightZ:         0.5,   // Z component of lightDir vec3 (as in lacquer)

            // ── specular ──────────────────────────────────────────────────────
            lightSize:      1.5,   // tighter specular base for card gloss
            lightIntensity: 0.18,  // slightly stronger peak for glossy card backs

            // ── diffuse & ambient ──────────────────────────────────────────────
            // Full Lambertian so background ridges roll clearly across the surface.
            // Lower ambient creates more shadow contrast between bump facets.
            diffuseAmt:     1.0,
            ambient:        0.18,
        }
    };
}
