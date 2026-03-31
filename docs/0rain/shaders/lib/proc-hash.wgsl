// Shared procedural primitives: hash + simple noise helpers

fn hash21(p: vec2f) -> f32 {
  var p3: vec3f = fract(vec3f(p.x, p.y, p.x) * 0.1031);
  p3 += dot(p3, vec3f(p3.y, p3.z, p3.x) + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

fn paperNoise3Octaves(coord: vec2f, baseFreq: f32) -> f32 {
  var noise: f32 = 0.0;
  var amplitude: f32 = 1.0;
  var frequency: f32 = baseFreq;

  for (var i: i32 = 0; i < 3; i++) {
    noise += hash21(coord * frequency) * amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }

  // Normalize (sum of amplitudes = 1.875)
  return noise / 1.875;
}
