# Generated WebGPU Compute Shaders

These shaders were **automatically generated** from TStorie's noise composer API.

## Shaders

### terrain.wgsl (3.0K)
**Configuration:** Basic Perlin terrain
```nim
noise(ntPerlin2D).seed(42).scale(100)
```
**Use:** Heightmaps, basic terrain generation

### clouds.wgsl (4.2K)
**Configuration:** Multi-octave Simplex clouds
```nim
noise(ntSimplex2D).seed(123).scale(60).octaves(3)
```
**Use:** Cloud layers, atmospheric effects

### mountains.wgsl (3.5K)
**Configuration:** Ridged mountain ranges
```nim
noise(ntPerlin2D).seed(999).scale(80).octaves(4).ridged()
```
**Use:** Mountain peaks, crystalline structures

### billow.wgsl (4.2K)
**Configuration:** Billowy cloud formations
```nim
noise(ntSimplex2D).seed(456).scale(50).octaves(3).billow()
```
**Use:** Puffy clouds, steam, smoke effects

### turbulence.wgsl (3.5K)
**Configuration:** Chaotic turbulence
```nim
noise(ntPerlin2D).seed(777).scale(40).octaves(3).turbulent()
```
**Use:** Fire, magic effects, marble patterns

## Regenerating

To regenerate these shaders or create new ones:

```bash
cd /workspaces/telestorie
nim c -r tools/generate_webgpu_shaders
```

Or modify `tools/generate_webgpu_shaders.nim` to add your own configurations!

## Using in WebGPU

All shaders have the same interface:

**Bindings:**
- `@group(0) @binding(0)` - Output buffer (u32 array)
- `@group(0) @binding(1)` - Params uniform (width, height, offsetX, offsetY)

**Entry Point:** `@compute fn main()`

**Workgroup Size:** 8×8 threads

**Output:** 16-bit noise values (0..65535) as u32

See [../WEBGPU_NOISE_SHADERS.md](../WEBGPU_NOISE_SHADERS.md) for complete integration examples.

## The Power

These ~20KB of WGSL code would take **hours** to write by hand.

With TStorie's composer: **30 seconds** per shader.

And they're **deterministic** - same output as CPU version, perfect for debugging!
