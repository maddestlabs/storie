---
title: Shader System Test
---

# Shader System Test

Basic test for WGSL parsing, registration, and API.

```wgsl fragment:colorize
// Test shader with custom uniforms
struct Uniforms {
  time: f32,
  resolution: vec2f,
  colorR: f32,
  colorG: f32,
  colorB: f32,
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
  // WebGPU texture coordinates are (0,0) at top-left; NDC has +Y up.
  // Flip Y so uv.y=0 is the top of the screen.
  output.uv = vec2f(pos.x * 0.5 + 0.5, 1.0 - (pos.y * 0.5 + 0.5));
  return output;
}

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  var color = textureSample(inputTexture, inputSampler, input.uv);
  let tint = vec3f(uniforms.colorR, uniforms.colorG, uniforms.colorB);
  return vec4f(color.rgb * tint, color.a);
}
```

```javascript
// Persistent test state (shared across all lifecycle blocks)
let testPassed = 0;
let testFailed = 0;
let testResults = [];
```

```javascript on:update
// Clear screen
term.clear();

// Header
term.write(0, 0, "WGSL Shader System Test", theme.accent1);
term.write(0, 1, "─".repeat(termWidth), theme.border);

// Run tests
testResults = [];
testPassed = 0;
testFailed = 0;

// Local helper: mutates the imported locals above
const test = (name, fn) => {
  try {
    const result = fn();
    if (result) {
      testPassed++;
      testResults.push(`✓ ${name}`);
    } else {
      testFailed++;
      testResults.push(`✗ ${name}`);
    }
  } catch (error) {
    testFailed++;
    testResults.push(`✗ ${name}: ${error.message}`);
  }
};

// Test 1: Shader API exists
test("shader API exists", () => typeof shader !== 'undefined');

// Test 2: Shader API methods exist
test("shader.list() exists", () => typeof shader.list === 'function');
test("shader.has() exists", () => typeof shader.has === 'function');
test("shader.info() exists", () => typeof shader.info === 'function');
test("shader.setUniform() exists", () => typeof shader.setUniform === 'function');
test("shader.setActive() exists", () => typeof shader.setActive === 'function');
test("shader.getActive() exists", () => typeof shader.getActive === 'function');

// Test 3: Check if shader was parsed and registered
const shaders = shader.list();
test("shader.list() returns array", () => Array.isArray(shaders));
test("shader registered", () => shaders.length > 0);

if (shaders.length > 0) {
  const shaderName = shaders[0];
  test(`shader.has("${shaderName}")`, () => shader.has(shaderName));
  
  // Test 4: Get shader info
  const info = shader.info(shaderName);
  test("shader.info() returns data", () => info !== null && info !== undefined);
  
  if (info) {
    test("shader has name", () => info.name === shaderName);
    test("shader has kind", () => info.kind === 'fragment');
    test("shader has uniforms", () => Array.isArray(info.uniforms));
    
    // Test 5: Set uniform
    test("shader.setUniform() works", () => {
      shader.setUniform(shaderName, "colorR", 1.0);
      return true;
    });
    
    // Test 6: Set active shader
    test("shader.setActive() works", () => {
      shader.setActive(shaderName);
      return true;
    });
    
    // Test 7: Get active shader
    const active = shader.getActive();
    test("shader.getActive() returns active", () => active === shaderName);
  }
}

// Display results
let y = 3;
for (const result of testResults) {
  const color = result.startsWith('✓') ? theme.success : theme.error;
  term.write(0, y++, result, color);
}

y++;
term.write(0, y++, `Tests: ${testPassed} passed, ${testFailed} failed`, theme.fg);

// Display shader details
if (shaders.length > 0) {
  y++;
  term.write(0, y++, "Registered Shaders:", theme.accent2);
  for (const name of shaders) {
    const info = shader.info(name);
    term.write(2, y++, `${name} (${info.kind})`, theme.fg);
    if (info.uniforms && info.uniforms.length > 0) {
      term.write(4, y++, `Uniforms: ${info.uniforms.join(', ')}`, theme.dim);
    }
  }
}
```
