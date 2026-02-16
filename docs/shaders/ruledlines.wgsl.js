// Ruled Lines Shader for t|Storie
// Notebook-style ruled lines for real paper effect
// Optimized for WebGPU

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
    cellSize: vec2f,
    _pad5: f32,
    _pad6: f32,
    lightLineSpacing: f32,
    darkLineSpacing: f32,
    alternatingLineSpacing: f32,
    lineOpacity: f32,
    lightLineColor: vec3f,
    _padLight: f32,
    darkLineColor: vec3f,
    _padDark: f32,
    alternatingTint: vec3f,
    _padAlt: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn isNanF32(x: f32) -> bool {
    // NaN is the only float where (x != x) is true.
    return x != x;
}

fn modF32(x: f32, y: f32) -> f32 {
    // GLSL-style mod(): x - y * floor(x / y)
    // (WGSL doesn't have a float % operator in all implementations)
    return x - y * floor(x / y);
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    var uv: vec2f = vUv;
    
    // Use cellSize directly (already scaled by DPR from terminal)
    // Guard against NaNs/zeros (can happen early in init, or if JS writes NaN)
    var cellSize: vec2f = uniforms.cellSize;
    if (isNanF32(cellSize.x) || isNanF32(cellSize.y) || cellSize.x < 1.0 || cellSize.y < 1.0) {
        cellSize = vec2f(10.0, 20.0);
    }
    
    // Prefer uniforms.resolution, but fall back to the input texture size if needed
    var resolution: vec2f = uniforms.resolution;
    if (isNanF32(resolution.x) || isNanF32(resolution.y) || resolution.x < 1.0 || resolution.y < 1.0) {
        let dims: vec2u = textureDimensions(contentTexture);
        resolution = vec2f(f32(dims.x), f32(dims.y));
    }
    
    // Sample terminal content
    var color: vec4f = textureSample(contentTexture, contentTextureSampler, uv);
    
    // Calculate screen position for pixel-perfect lines
    var screenPos: vec2f = uv * resolution;
    var yScreen: f32 = screenPos.y;
    var lineHeight: f32 = cellSize.y;
    
    // Calculate base line number
    var lineNumber: f32 = floor(yScreen / lineHeight);
    
    // Light lines - use multiply blend mode (matching GLSL)
    let enableLight: bool = uniforms.lightLineSpacing > 0.001;
    let lightPeriod: f32 = max(0.0001, lineHeight * uniforms.lightLineSpacing);
    var lightLineMask: f32 = select(
        0.0,
        step(modF32(yScreen, lightPeriod), 1.0),
        enableLight
    );
    var lightBlend: vec3f = mix(vec3f(1.0), uniforms.lightLineColor, uniforms.lineOpacity);
    color = vec4f(color.rgb * mix(vec3f(1.0), lightBlend, lightLineMask), color.a);
    
    // Alternating line tint - also using multiply (matching GLSL)
    let enableAlt: bool = uniforms.alternatingLineSpacing > 0.001;
    let altPeriod: f32 = max(0.0001, uniforms.alternatingLineSpacing);
    let altPhase: f32 = modF32(lineNumber, altPeriod);
    var altLineMask: f32 = select(
        0.0,
        (1.0 - step(1.0, altPhase)),
        enableAlt
    );
    var altBlend: vec3f = mix(vec3f(1.0), uniforms.alternatingTint, 1.0);
    color = vec4f(color.rgb * mix(vec3f(1.0), altBlend, altLineMask), color.a);
    
    // Dark lines - multiply blend (matching GLSL)
    let enableDark: bool = uniforms.darkLineSpacing > 0.001;
    let darkPeriod: f32 = max(0.0001, lineHeight * uniforms.darkLineSpacing);
    var darkLineMask: f32 = select(
        0.0,
        step(modF32(yScreen, darkPeriod), 1.0),
        enableDark
    );
    var darkBlend: vec3f = mix(vec3f(1.0), uniforms.darkLineColor, uniforms.lineOpacity);
    color = vec4f(color.rgb * mix(vec3f(1.0), darkBlend, darkLineMask), color.a);
    
    return vec4f(color.rgb, 1.0);
}
`,
        uniforms: {
            // Cell size (set dynamically from terminal/game engine)
            cellSize: [10.0, 20.0],

            // IMPORTANT: the legacy WebGPU uniform packer packs custom uniforms
            // strictly in insertion order. Keep this object in the same order as
            // the WGSL `Uniforms` struct fields after `cellSize`.

            // Line spacing (relative to cellSize.y)
            lightLineSpacing: 0.2,       // Light lines every 20% of line height
            darkLineSpacing: 1.0,        // Dark lines every 100% of line height
            alternatingLineSpacing: 2.0, // Alternating tint every 2 lines

            // Line opacity
            lineOpacity: 0.6,
            
            // Line colors (for multiply blend - values < 1.0 darken)
            lightLineColor: [0.92, 0.94, 0.96],  // Subtle gray-blue
            darkLineColor: [0.7, 0.75, 0.8],     // Medium gray-blue
            alternatingTint: [0.96, 0.96, 0.96]  // Very subtle darkening
        }
    };
}