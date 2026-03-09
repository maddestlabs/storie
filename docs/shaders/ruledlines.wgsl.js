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

    #include "lib/math.wgsl"

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
    // Use scalar RGB uniforms instead of vec3 to avoid cross-impl
    // uniform-buffer packing pitfalls.
    lightLineColorR: f32,
    lightLineColorG: f32,
    lightLineColorB: f32,
    _padLight: f32,
    darkLineColorR: f32,
    darkLineColorG: f32,
    darkLineColorB: f32,
    _padDark: f32,
    alternatingTintR: f32,
    alternatingTintG: f32,
    alternatingTintB: f32,
    _padAlt: f32,

    // Worlds background mode:
    // When > 0, ignore the input texture and generate a tiled lined-paper
    // background in UV space. This is used by Worlds sectionBackground.
    worldsBackground: f32,
    // How many *text rows* exist in one tiled background texture (world-locked).
    // With Worlds coordScale = 1/rowsPerTile, each row is 1 world unit.
    rowsPerTile: f32,
    // Row-space offset applied in Worlds background mode.
    // Positive values shift lines toward the top of the tile.
    offsetRows: f32,
    _padWorld0: f32,
    // Base paper color used for Worlds background generation.
    paperColorR: f32,
    paperColorG: f32,
    paperColorB: f32,
    _padPaper: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

fn periodicLineMask(y: f32, period: f32, thickness: f32) -> f32 {
    let p = max(0.0001, period);
    let t = modF32(y, p);
    let aa = max(0.0001, abs(dpdx(y)) + abs(dpdy(y)));
    return 1.0 - smoothstep(thickness, thickness + aa, t);
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
    
    // Sample terminal/content input (default mode).
    // In Worlds background rendering we currently feed a cleared texture, so
    // this may be fully transparent.
    var color: vec4f = textureSample(contentTexture, contentTextureSampler, uv);

    // Two operating modes:
    // - Default (worldsBackground == 0): compositor/terminal overlay (pixel-aligned)
    // - Worlds background (worldsBackground > 0): generate a tiled paper texture
    let isWorldsBackground: bool = uniforms.worldsBackground > 0.5;

    if (isWorldsBackground) {
        // Generate in "row units" so the pattern can be world-locked and aligned
        // to Worlds character-cell measurements.
        var rowsPerTile: f32 = uniforms.rowsPerTile;
        if (isNanF32(rowsPerTile) || rowsPerTile < 1.0) {
            rowsPerTile = 32.0;
        }

        // yRow increases by 1.0 per text row within a tile.
        let yRow: f32 = uv.y * rowsPerTile + uniforms.offsetRows;
        let lineNumber: f32 = floor(yRow);

        let paperColor: vec3f = vec3f(uniforms.paperColorR, uniforms.paperColorG, uniforms.paperColorB);
        let lightLineColor: vec3f = vec3f(uniforms.lightLineColorR, uniforms.lightLineColorG, uniforms.lightLineColorB);
        let darkLineColor: vec3f = vec3f(uniforms.darkLineColorR, uniforms.darkLineColorG, uniforms.darkLineColorB);
        let alternatingTint: vec3f = vec3f(uniforms.alternatingTintR, uniforms.alternatingTintG, uniforms.alternatingTintB);

        var rgb: vec3f = clamp(paperColor, vec3f(0.0), vec3f(1.0));

        // Light lines (minor grid): period expressed in rows.
        let enableLight: bool = uniforms.lightLineSpacing > 0.001;
        let lightPeriodRows: f32 = max(0.0001, uniforms.lightLineSpacing);
        let lightMask: f32 = select(0.0, periodicLineMask(yRow, lightPeriodRows, 0.02), enableLight);
        let lightBlend: vec3f = mix(vec3f(1.0), lightLineColor, uniforms.lineOpacity);
        rgb = rgb * mix(vec3f(1.0), lightBlend, lightMask);

        // Alternating band tint (every N rows)
        let enableAlt: bool = uniforms.alternatingLineSpacing > 0.001;
        let altPeriod: f32 = max(0.0001, uniforms.alternatingLineSpacing);
        let altPhase: f32 = modF32(lineNumber, altPeriod);
        let altMask: f32 = select(0.0, (1.0 - step(1.0, altPhase)), enableAlt);
        rgb = rgb * mix(vec3f(1.0), alternatingTint, altMask);

        // Dark lines (major ruled lines): period expressed in rows.
        let enableDark: bool = uniforms.darkLineSpacing > 0.001;
        let darkPeriodRows: f32 = max(0.0001, uniforms.darkLineSpacing);
        let darkMask: f32 = select(0.0, periodicLineMask(yRow, darkPeriodRows, 0.06), enableDark);
        let darkBlend: vec3f = mix(vec3f(1.0), darkLineColor, uniforms.lineOpacity);
        rgb = rgb * mix(vec3f(1.0), darkBlend, darkMask);

        return vec4f(rgb, 1.0);
    }
    
    // Calculate screen position for pixel-perfect lines (default mode)
    var screenPos: vec2f = uv * resolution;
    var yScreen: f32 = screenPos.y;
    var lineHeight: f32 = cellSize.y;
    
    // Calculate base line number
    var lineNumber: f32 = floor(yScreen / lineHeight);
    
    // Light lines - use multiply blend mode (matching GLSL)
    let lightLineColor: vec3f = vec3f(uniforms.lightLineColorR, uniforms.lightLineColorG, uniforms.lightLineColorB);
    let darkLineColor: vec3f = vec3f(uniforms.darkLineColorR, uniforms.darkLineColorG, uniforms.darkLineColorB);
    let alternatingTint: vec3f = vec3f(uniforms.alternatingTintR, uniforms.alternatingTintG, uniforms.alternatingTintB);

    let enableLight: bool = uniforms.lightLineSpacing > 0.001;
    let lightPeriod: f32 = max(0.0001, lineHeight * uniforms.lightLineSpacing);
    var lightLineMask: f32 = select(
        0.0,
        step(modF32(yScreen, lightPeriod), 1.0),
        enableLight
    );
    var lightBlend: vec3f = mix(vec3f(1.0), lightLineColor, uniforms.lineOpacity);
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
    var altBlend: vec3f = mix(vec3f(1.0), alternatingTint, 1.0);
    color = vec4f(color.rgb * mix(vec3f(1.0), altBlend, altLineMask), color.a);
    
    // Dark lines - multiply blend (matching GLSL)
    let enableDark: bool = uniforms.darkLineSpacing > 0.001;
    let darkPeriod: f32 = max(0.0001, lineHeight * uniforms.darkLineSpacing);
    var darkLineMask: f32 = select(
        0.0,
        step(modF32(yScreen, darkPeriod), 1.0),
        enableDark
    );
    var darkBlend: vec3f = mix(vec3f(1.0), darkLineColor, uniforms.lineOpacity);
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
            lightLineColorR: 0.92,  // Subtle gray-blue
            lightLineColorG: 0.94,
            lightLineColorB: 0.96,
            darkLineColorR: 0.7,     // Medium gray-blue
            darkLineColorG: 0.75,
            darkLineColorB: 0.8,
            alternatingTintR: 0.96,  // Very subtle darkening
            alternatingTintG: 0.96,
            alternatingTintB: 0.96,

            // Worlds background mode defaults (engine will override when used as Worlds background)
            worldsBackground: 0.0,
            rowsPerTile: 32.0,
            offsetRows: 0.0,
            paperColorR: 0.99,
            paperColorG: 0.985,
            paperColorB: 0.97
        }
    };
}