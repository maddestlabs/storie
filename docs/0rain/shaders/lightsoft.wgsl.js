// LightSoft Shader for t|Storie
// Simulates a soft overhead lamp swaying gently above the scene, like a
// pendant lamp over a card table. Applies Blinn-Phong shading using a flat
// surface normal (camera-facing), producing a smooth directional light roll
// across the frame without bump-mapping:
//   • Lambertian diffuse  — broad rolling light across the table surface
//   • Blinn-Phong specular — highlight centred on the light's UV position
//   • Swaying animation   — sin-driven pendulum orbit along the X axis
//
// For Sobel-derived surface normals (bump-mapped edges), chain sobel.wgsl.js
// upstream — lightsoft reads the already-processed frame.

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
// System-managed fields (time, resolution) are followed by custom uniforms.
// All f32; vec2f has align=8 so one pad before resolution closes the gap.
//
//  offset  0 : time        (system)
//  offset  4 : _pad0
//  offset  8 : resolution  (system, vec2f / 8 bytes)
//  offset 16 : custom uniforms begin
struct Uniforms {
    time:        f32,
    _pad0:       f32,
    resolution:  vec2f,

    swayAmp:     f32,    // pendulum swing radius in UV x-units (0 – 0.4)
    swaySpeed:   f32,    // radians/sec; full cycle = 2π/swaySpeed ≈ 15 s at 0.42
    lightY:      f32,    // UV.y anchor of the light bulb (0=top, 1=bottom)
    lightHeight: f32,    // elevation above the scene plane in UV units (0.2 – 1.5)

    diffuseAmt:  f32,    // Lambertian scale (0 – 1.0)
    specAmt:     f32,    // specular highlight strength (0 – 2.0)
    specShine:   f32,    // Blinn-Phong exponent — higher = tighter glint (4 – 64)
    ambient:     f32,    // minimum brightness floor so dark areas stay readable (0 – 1)

    lightX:      f32,    // base x anchor of the light (0–1 UV); sway oscillates around this
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

// ── Fragment ──────────────────────────────────────────────────────────────────
@fragment
fn fragmentMain(@location(0) vUv: vec2f) -> @location(0) vec4f {
    let uv  = vUv;
    let col = textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0);

    // Flat surface normal — camera-facing. For Sobel-derived bump normals,
    // place sobel.wgsl.js upstream in the shader chain.
    let normal = vec3f(0.0, 0.0, 1.0);

    // ── Swaying overhead light ───────────────────────────────────────────────
    // The light swings sinusoidally along x around the horizontal centre (0.5).
    // Divide swayAmp by aspect ratio so the physical swing distance is the same
    // regardless of canvas dimensions.
    let aspect  = uniforms.resolution.x / max(uniforms.resolution.y, 1.0);
    let lx      = uniforms.lightX
                  + sin(uniforms.time * uniforms.swaySpeed)
                    * (uniforms.swayAmp / aspect);

    // Light is a point source in UV-space 3D:
    //   xy = position on the scene plane (UV coords)
    //   z  = elevation above the plane (lightHeight, same units as UV)
    let lightPos = vec3f(lx, uniforms.lightY, uniforms.lightHeight);
    let lightDir = normalize(lightPos - vec3f(uv, 0.0));

    // ── Lambertian diffuse ───────────────────────────────────────────────────
    let diffuse  = max(dot(normal, lightDir), 0.0) * uniforms.diffuseAmt;

    // ── Blinn-Phong specular ─────────────────────────────────────────────────
    // viewDir is straight up (camera above the table).
    let viewDir  = vec3f(0.0, 0.0, 1.0);
    let halfDir  = normalize(lightDir + viewDir);
    let specular = pow(max(dot(normal, halfDir), 0.0), uniforms.specShine)
                   * uniforms.specAmt;

    // ── Composite ────────────────────────────────────────────────────────────
    // ambient keeps unlit regions readable; diffuse adds broad directional roll;
    // specular adds glints on high-gradient regions (card edges, felt ridges).
    let lit = col.rgb * (uniforms.ambient + diffuse) + vec3f(specular);
    return vec4f(clamp(lit, vec3f(0.0), vec3f(1.0)), col.a);
}
`,

        uniforms: {
            // ── pendulum motion ────────────────────────────────────────────────
            swayAmp:    0.22,   // ~ 22% of screen width total arc
            swaySpeed:  0.42,   // ≈ one full swing every 15 s  (2π / 0.42)

            // ── light source position ──────────────────────────────────────────
            lightY:     0.35,   // sits above the foundation / top-card row
            lightHeight: 0.55,  // mid-height: wide enough to illuminate the whole table

            // ── shading strengths ──────────────────────────────────────────────
            diffuseAmt:  0.26,  // subtle directional roll; does not darken much
            specAmt:     0.13,  // gentle gleam on card edges
            specShine:  20.0,   // moderately focused highlight (not mirror-like)
            ambient:    0.82,   // high floor — scene stays bright overall

            // ── light x anchor (sway oscillates around this value) ─────────────
            lightX:     0.5,    // screen centre; mouse-follow overwrites this at runtime
        }
    };
}
