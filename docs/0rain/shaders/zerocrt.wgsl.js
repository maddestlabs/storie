// ZeroCRT Shader for t|Storie
// 0rain-inspired CRT post-process: curvature, sync ripple, moving light, tint, and rumble.

function getShaderConfig() {
    return {
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
    time: f32,
    _pad0: f32,
    _pad1: f32,
    _pad2: f32,
    resolution: vec2f,
    _pad3: f32,
    _pad4: f32,

    curveStrength: f32,
    curveDistance: f32,
    frameSize: f32,
    borderSize: f32,

    frameHue: f32,
    frameSat: f32,
    frameLight: f32,
    frameReflect: f32,

    frameGrain: f32,
    rgbOffsetPx: f32,
    grilleLevel: f32,
    grilleDensity: f32,

    scanlineLevel: f32,
    scanlineDivisor: f32,
    noiseLevel: f32,
    flicker: f32,

    glassTint: f32,
    glassHue: f32,
    glassSat: f32,
    screenTint: f32,

    screenHue: f32,
    screenSat: f32,
    hSync: f32,
    hSyncPeriod: f32,

    hSyncJitter: f32,
    hSyncDuration: f32,
    lightSpeed: f32,
    lightIntensity: f32,

    ambientLight: f32,
    lightOrbit: f32,
    rumblePeriod: f32,
    rumbleJitter: f32,

    rumbleDuration: f32,
    rumbleDim: f32,
    rumbleOffsetPx: f32,
    rumbleShakeMix: f32,

    vignettePower: f32,
    vignetteAmount: f32,
    _pad5: f32,
    _pad6: f32,
}
@group(0) @binding(2) var<uniform> uniforms: Uniforms;

const PI: f32 = 3.14159265;

fn random(c: vec2f) -> f32 {
    return fract(sin(dot(c, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn hsl2rgb(c: vec3f) -> vec3f {
    let K: vec4f = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    let p: vec3f = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}

fn sampleSafe(uv: vec2f) -> vec3f {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return vec3f(0.0);
    }
    return textureSampleLevel(contentTexture, contentTextureSampler, uv, 0.0).rgb;
}

fn rgbDistortion(uv: vec2f, offsetUV: f32) -> vec3f {
    return vec3f(
        sampleSafe(uv + vec2f(offsetUV, 0.0)).r,
        sampleSafe(uv).g,
        sampleSafe(uv - vec2f(offsetUV, 0.0)).b
    );
}

fn calculateLightFactor(uv: vec2f, iTime: f32) -> f32 {
    let lightX = 0.5 + sin(iTime * 1.75) * uniforms.lightOrbit;
    let lightPos = vec2f(lightX, 0.2);
    let scaledDistance = length(uv - lightPos);
    let lightFalloff = pow(clamp(1.0 - (scaledDistance / 1.5), 0.0, 1.0), 0.85);
    return mix(uniforms.ambientLight, 1.0 + uniforms.lightIntensity, lightFalloff);
}

fn hsyncOffset(uv: vec2f, iTime: f32) -> f32 {
    let time = iTime * 5.0;
    let size = uniforms.hSync * 0.1;
    let cycleBase = max(uniforms.hSyncPeriod, 0.001);
    let randomOffset = fract(sin(floor(iTime / cycleBase) * 12345.67) * 43758.5453) * uniforms.hSyncJitter;
    let actualCyclePeriod = max(cycleBase + randomOffset, 0.001);
    let cyclePosition = fract(iTime / actualCyclePeriod);

    var waveStrength = 0.0;
    if (cyclePosition < uniforms.hSyncDuration) {
        let normalizedTime = cyclePosition / max(uniforms.hSyncDuration, 0.0001);
        waveStrength = sin(normalizedTime * PI) * size;
    }

    return sin(uv.y * 10.0 + time) * waveStrength;
}

fn frameReflection(contentUV: vec2f, resolution: vec2f) -> vec3f {
    var reflectedUV = contentUV;
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

    var blurred = vec3f(0.0);
    let blur = 2.0 / max(resolution.x, 1.0);
    for (var x: i32 = -1; x <= 1; x = x + 1) {
        for (var y: i32 = -1; y <= 1; y = y + 1) {
            let blurPos = reflectedUV + vec2f(f32(x) * blur, f32(y) * blur);
            blurred += sampleSafe(blurPos);
        }
    }
    return blurred / 9.0;
}

fn applyScreenFx(curvedUV: vec2f, screenUV: vec2f, resolution: vec2f, iTime: f32) -> vec3f {
    let border = uniforms.borderSize / max(resolution.x, 1.0);
    let rgbOffsetUV = uniforms.rgbOffsetPx / max(resolution.x, 1.0);
    let borderColor = vec3f(0.0);
    let isBorder = border > 0.0 && (
        screenUV.x < border || screenUV.x > 1.0 - border ||
        screenUV.y < border || screenUV.y > 1.0 - border
    );

    var sampleUV = screenUV;
    if (!isBorder) {
        sampleUV.x += hsyncOffset(screenUV, iTime);
    } else {
        let denom = max(1.0 - 2.0 * border, 0.0001);
        sampleUV = (screenUV - vec2f(border, border)) / denom;
    }

    var color = borderColor;
    if (!isBorder || border <= 0.0) {
        color = rgbDistortion(sampleUV, rgbOffsetUV);
    } else if (sampleUV.x >= 0.0 && sampleUV.x <= 1.0 && sampleUV.y >= 0.0 && sampleUV.y <= 1.0) {
        color = rgbDistortion(sampleUV, rgbOffsetUV);
    }

    if (uniforms.grilleLevel > 0.0) {
        var grillePattern = sin(curvedUV.x * uniforms.grilleDensity * PI);
        grillePattern = uniforms.grilleLevel + (1.0 - uniforms.grilleLevel) * grillePattern;
        color *= 0.5 + 0.5 * grillePattern;
    }

    if (uniforms.scanlineLevel > 0.05) {
        let scanlinePattern = sin(curvedUV.y * resolution.y * PI / max(uniforms.scanlineDivisor, 0.001));
        color *= uniforms.scanlineLevel + (1.0 - uniforms.scanlineLevel) * scanlinePattern;
    }

    if (uniforms.noiseLevel > 0.0) {
        let noise = random(curvedUV + vec2f(iTime, iTime));
        color += noise * uniforms.noiseLevel * 0.5;
    }

    if (uniforms.screenTint > 0.0) {
        let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
        let screen = hsl2rgb(vec3f(uniforms.screenHue, uniforms.screenSat, luma));
        color = mix(color, screen, uniforms.screenTint);
    }

    if (uniforms.glassTint > 0.0) {
        let tintRamp = 0.5 + 0.5 * curvedUV.y;
        let tintColor = hsl2rgb(vec3f(uniforms.glassHue, uniforms.glassSat, tintRamp));
        color += tintColor * uniforms.glassTint;
    }

    if (uniforms.flicker > 0.0) {
        let flicker = 1.0 + 0.25 * sin(iTime * 60.0) * uniforms.flicker;
        color *= flicker;
    }

    let lightColor = vec3f(1.0, 0.98, 0.95);
    color *= lightColor * calculateLightFactor(screenUV, iTime * uniforms.lightSpeed);
    return color;
}

@fragment
fn fragmentMain(
    @location(0) vUv: vec2f
) -> @location(0) vec4f {
    let iTime = uniforms.time;
    let iResolution = max(uniforms.resolution, vec2f(1.0));

    let rumbleHash = fract(sin(floor(iTime / max(uniforms.rumblePeriod, 0.001)) * 43758.5453));
    let rumbleInterval = max(0.001, uniforms.rumblePeriod + rumbleHash * uniforms.rumbleJitter);
    let currentIntervalStart = floor(iTime / rumbleInterval) * rumbleInterval;
    let rumblePhase = iTime - currentIntervalStart;

    var rumbleStrength = 0.0;
    var rumbleDim = 0.0;
    if (rumblePhase < uniforms.rumbleDuration) {
        rumbleStrength = sin(rumblePhase * PI / max(uniforms.rumbleDuration, 0.0001));
        rumbleDim = uniforms.rumbleDim * rumbleStrength;
    }

    let rumbleOffset = vec2f(
        sin(iTime * 20.0 + 0.3) * cos(iTime * 13.0),
        cos(iTime * 17.0 - 0.7) * sin(iTime * 11.0)
    ) * rumbleStrength * (uniforms.rumbleOffsetPx / iResolution);

    let center = vec2f(0.5, 0.5);
    var curvedUV = vUv + rumbleOffset * uniforms.rumbleShakeMix;
    let distanceFromCenter = length(curvedUV - center);
    curvedUV += (curvedUV - center) * pow(distanceFromCenter, uniforms.curveDistance) * uniforms.curveStrength;

    let frame = uniforms.frameSize / max(iResolution.x, 1.0);
    let contentDenom = max(1.0 - 2.0 * frame, 0.0001);
    let screenUV = (curvedUV - vec2f(frame, frame)) / contentDenom;
    let isFrame = (
        curvedUV.x < frame || curvedUV.x > 1.0 - frame ||
        curvedUV.y < frame || curvedUV.y > 1.0 - frame
    );

    var color = vec3f(0.0);
    if (isFrame) {
        let frameVal = 100.0;
        let nX = frameVal / max(iResolution.x, 1.0);
        let nY = frameVal / max(iResolution.y, 1.0);
        let distX = min(curvedUV.x, 1.0 - curvedUV.x);
        let distY = min(curvedUV.y, 1.0 - curvedUV.y);
        let minDist = min(distX, distY);
        let intensity = mix(uniforms.frameLight, 0.0, minDist / max(nX, nY) * 4.0);

        color = hsl2rgb(vec3f(uniforms.frameHue, uniforms.frameSat, intensity));
        color *= 1.0 - uniforms.frameGrain * random(screenUV);
        color += frameReflection(screenUV, iResolution) * uniforms.frameReflect * 0.5;

        let lightColor = vec3f(1.0, 0.98, 0.95);
        color *= lightColor * calculateLightFactor(curvedUV, iTime);
    } else {
        color = applyScreenFx(curvedUV, screenUV, iResolution, iTime);

        let vignetteUV = curvedUV * (vec2f(1.0) - vec2f(curvedUV.y, curvedUV.x));
        let vignetteBase = max(vignetteUV.x * vignetteUV.y * uniforms.vignetteAmount, 0.000001);
        color *= pow(vignetteBase, uniforms.vignettePower);
    }

    color = max(color - vec3f(rumbleDim), vec3f(0.0));
    return vec4f(color, 1.0);
}
`,

        uniforms: {
            curveStrength: 0.2,
            curveDistance: 5.0,
            frameSize: 0.0,
            borderSize: 0.0,

            frameHue: 0.025,
            frameSat: 0.1,
            frameLight: 0.0,
            frameReflect: 0.2,

            frameGrain: 0.15,
            rgbOffsetPx: 1.0,
            grilleLevel: 0.95,
            grilleDensity: 800.0,

            scanlineLevel: 0.8,
            scanlineDivisor: 1.0,
            noiseLevel: 0.0,
            flicker: 0.05,

            glassTint: 0.2,
            glassHue: 0.6,
            glassSat: 0.3,
            screenTint: 0.2,

            screenHue: 0.0,
            screenSat: 1.0,
            hSync: 0.01,
            hSyncPeriod: 2.0,

            hSyncJitter: 1.0,
            hSyncDuration: 0.15,
            lightSpeed: 1.0,
            lightIntensity: 1.5,

            ambientLight: 0.25,
            lightOrbit: 0.35,
            rumblePeriod: 7.0,
            rumbleJitter: 6.0,

            rumbleDuration: 1.0,
            rumbleDim: 0.05,
            rumbleOffsetPx: 3.0,
            rumbleShakeMix: 0.0,

            vignettePower: 0.25,
            vignetteAmount: 20.0
        }
    };
}