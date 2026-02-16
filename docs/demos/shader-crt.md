---
title: CRT Shader Test
---

# CRT Shader Test

Testing the CRT shader with frame and curvature effects.

```wgsl fragment:crt
// CRT shader with curved screen and decorative frame
struct Uniforms {
  time: f32,
  resolution: vec2f,
  curveStrength: f32,
  frameSize: f32,
  frameHue: f32,
  frameSat: f32,
  frameLight: f32,
  frameReflect: f32,
  frameGrain: f32,
};

@group(0) @binding(2) var<uniform> uniforms: Uniforms;
@group(0) @binding(0) var inputTexture: texture_2d<f32>;
@group(0) @binding(1) var inputSampler: sampler;

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(@location(0) pos: vec2f) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f(pos, 0.0, 1.0);
  output.uv = vec2f(pos.x * 0.5 + 0.5, 1.0 - (pos.y * 0.5 + 0.5));
  return output;
}

fn random(c: vec2f) -> f32 {
  return fract(sin(dot(c, vec2f(12.9898, 78.233))) * 43758.5453);
}

fn hsl2rgb(c: vec3f) -> vec3f {
  let K: vec4f = vec4f(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  let p: vec3f = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, vec3f(0.0), vec3f(1.0)), c.y);
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  let iTime: f32 = uniforms.time;
  let iResolution: vec2f = uniforms.resolution;

  var uv: vec2f = input.uv;
  let center: vec2f = vec2f(0.5, 0.5);
  let distanceFromCenter: f32 = length(uv - center);

  let px: f32 = 1.0 / max(iResolution.x, 1.0);
  let frame: f32 = uniforms.frameSize * px;

  // Apply CRT curvature
  uv = input.uv + (input.uv - center) * pow(distanceFromCenter, 5.0) * uniforms.curveStrength;

  let isFrame: bool = (uv.x < frame || uv.x > (1.0 - frame) || uv.y < frame || uv.y > (1.0 - frame));

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

    // Reflection effect on frame
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

    var blurred: vec3f = vec3f(0.0);
    let blur: f32 = 2.0 / max(iResolution.x, 1.0);
    for (var x: i32 = -1; x <= 1; x = x + 1) {
      for (var y: i32 = -1; y <= 1; y = y + 1) {
        let blurPos: vec2f = reflectedUV + vec2f(f32(x) * blur, f32(y) * blur);
        blurred += textureSampleLevel(inputTexture, inputSampler, blurPos, 0.0).rgb;
      }
    }
    blurred = blurred / 9.0;
    color += blurred * uniforms.frameReflect * 0.5;

    // Animated lighting effect
    let lightX: f32 = 0.5 + sin(iTime * 1.75) * 0.35;
    let lightPos: vec2f = vec2f(lightX, 0.2);
    let lightDist: f32 = length(uv - lightPos);
    let lightFalloff: f32 = pow(clamp(1.0 - (lightDist / 1.5), 0.0, 1.0), 0.85);
    color *= mix(0.25, 2.5, lightFalloff);
  } else {
    // CRT content area
    if (contentUV.x < 0.0 || contentUV.x > 1.0 || contentUV.y < 0.0 || contentUV.y > 1.0) {
      color = vec3f(0.0);
    } else {
      color = textureSampleLevel(inputTexture, inputSampler, contentUV, 0.0).rgb;
    }
  }

  return vec4f(color, 1.0);
}
```

```javascript
// Persistent state for controls
let curveStrength = 0.95;
let frameSize = 20.0;
let frameHue = 0.025;
let frameSat = 0.0;
let frameLight = 0.01;
let frameReflect = 0.35;
let frameGrain = 0.25;
```

```javascript on:update
// Clear screen
term.clear();

// Title
term.write(0, 0, "╔═══════════════════════════════════════════════════════╗", theme.accent1);
term.write(0, 1, "║  CRT SHADER TEST - RETRO TERMINAL EFFECT              ║", theme.accent1);
term.write(0, 2, "╚═══════════════════════════════════════════════════════╝", theme.accent1);
term.write(0, 3, "", theme.fg);

// Content
let y = 4;
term.write(0, y++, "  This demo tests the CRT shader effect with:", theme.fg);
term.write(0, y++, "    • Screen curvature simulation", theme.accent2);
term.write(0, y++, "    • Decorative frame with grain texture", theme.accent2);
term.write(0, y++, "    • Frame reflection of screen content", theme.accent2);
term.write(0, y++, "    • Animated lighting effect", theme.accent2);
y++;

// Show shader info
const shaders = shader.list();
term.write(0, y++, "  Shader Status:", theme.success);

if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('crt')) || shaders[0];
  term.write(0, y++, `    ✓ Registered: ${shaderName}`, theme.success);
  
  const info = shader.info(shaderName);
  if (info) {
    term.write(0, y++, `    ✓ Type: ${info.kind}`, theme.success);
    term.write(0, y++, `    ✓ Uniforms: ${info.uniforms.length} custom`, theme.success);
    
    // Activate shader if not already active
    if (shader.getActive() !== shaderName) {
      shader.setActive(shaderName);
      term.write(0, y++, "    ✓ Shader activated", theme.success);
    }
    
    // Set initial uniform values
    shader.setUniform(shaderName, 'curveStrength', curveStrength);
    shader.setUniform(shaderName, 'frameSize', frameSize);
    shader.setUniform(shaderName, 'frameHue', frameHue);
    shader.setUniform(shaderName, 'frameSat', frameSat);
    shader.setUniform(shaderName, 'frameLight', frameLight);
    shader.setUniform(shaderName, 'frameReflect', frameReflect);
    shader.setUniform(shaderName, 'frameGrain', frameGrain);
  }
}
y++;

// Interactive controls
term.write(0, y++, "  Shader Controls:", theme.accent2);
term.write(0, y++, "  ─────────────────────────────────────────────────────", theme.dim);
term.write(0, y++, `  [Q/W] Curve:       ${curveStrength.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [A/S] Frame Size:  ${frameSize.toFixed(0)} px`, theme.fg);
term.write(0, y++, `  [Z/X] Frame Hue:   ${frameHue.toFixed(3)}`, theme.fg);
term.write(0, y++, `  [E/R] Frame Sat:   ${frameSat.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [D/F] Frame Light: ${frameLight.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [C/V] Reflection:  ${frameReflect.toFixed(2)}`, theme.fg);
term.write(0, y++, `  [T/Y] Grain:       ${frameGrain.toFixed(2)}`, theme.fg);
y++;

// Footer
term.write(0, y++, "  ─────────────────────────────────────────────────────", theme.dim);
term.write(0, y++, "  Press keys above to adjust shader parameters", theme.dim);
```

```javascript on:input
// Handle keyboard controls
if (!event || event.type !== 'keydown') return;

const key = event.key.toLowerCase();
const shaders = shader.list();

if (shaders.length > 0) {
  const shaderName = shaders.find(s => s.includes('crt')) || shaders[0];
  
  switch(key) {
    case 'q':
      curveStrength = Math.max(0.0, curveStrength - 0.05);
      shader.setUniform(shaderName, 'curveStrength', curveStrength);
      break;
    case 'w':
      curveStrength = Math.min(2.0, curveStrength + 0.05);
      shader.setUniform(shaderName, 'curveStrength', curveStrength);
      break;
    case 'a':
      frameSize = Math.max(0.0, frameSize - 2.0);
      shader.setUniform(shaderName, 'frameSize', frameSize);
      break;
    case 's':
      frameSize = Math.min(100.0, frameSize + 2.0);
      shader.setUniform(shaderName, 'frameSize', frameSize);
      break;
    case 'z':
      frameHue = Math.max(0.0, frameHue - 0.01);
      shader.setUniform(shaderName, 'frameHue', frameHue);
      break;
    case 'x':
      frameHue = Math.min(1.0, frameHue + 0.01);
      shader.setUniform(shaderName, 'frameHue', frameHue);
      break;
    case 'e':
      frameSat = Math.max(0.0, frameSat - 0.05);
      shader.setUniform(shaderName, 'frameSat', frameSat);
      break;
    case 'r':
      frameSat = Math.min(1.0, frameSat + 0.05);
      shader.setUniform(shaderName, 'frameSat', frameSat);
      break;
    case 'd':
      frameLight = Math.max(0.0, frameLight - 0.01);
      shader.setUniform(shaderName, 'frameLight', frameLight);
      break;
    case 'f':
      frameLight = Math.min(1.0, frameLight + 0.01);
      shader.setUniform(shaderName, 'frameLight', frameLight);
      break;
    case 'c':
      frameReflect = Math.max(0.0, frameReflect - 0.05);
      shader.setUniform(shaderName, 'frameReflect', frameReflect);
      break;
    case 'v':
      frameReflect = Math.min(1.0, frameReflect + 0.05);
      shader.setUniform(shaderName, 'frameReflect', frameReflect);
      break;
    case 't':
      frameGrain = Math.max(0.0, frameGrain - 0.05);
      shader.setUniform(shaderName, 'frameGrain', frameGrain);
      break;
    case 'y':
      frameGrain = Math.min(1.0, frameGrain + 0.05);
      shader.setUniform(shaderName, 'frameGrain', frameGrain);
      break;
  }
}
```
