// Shared math helpers

fn isNanF32(x: f32) -> bool {
  return x != x;
}

fn modF32(x: f32, y: f32) -> f32 {
  return x - y * floor(x / y);
}
