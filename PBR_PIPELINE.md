# PBR Pipeline — Recommendations for Storie

This document analyses the current rendering architecture and gives concrete, prioritised recommendations for adding Physically Based Rendering (PBR) material support to Storie. It is written to be actionable: each section names exactly which files to touch and why.

---

## 1. The Core Problem With Post-Process-Only Lighting

Storie's current shader model is a **screen-space post-process chain**:

```
Compositor (layer compositing)
  → ping-pong texture A/B
    → shader 1 (e.g. lightsobel) reads contentTexture, writes output
      → shader 2 (e.g. lightvignette) reads previous output
        → canvas swapchain
```

This is great for stylistic effects but has a fundamental limitation for lighting: **the lighting shader has no knowledge of which pixel belongs to which material**. A card face, a card back, and a paper texture all project identical geometry into the frame — a solid RGBA quad — so the fragment shader cannot distinguish them.

The symptoms are exactly what was observed: Sobel bump-map normals are as strong on white card faces as they are on midtone paper, because the shader sees only luminance, not *material intent*.

---

## 2. What Real PBR Pipelines Do: The G-Buffer

In a deferred rendering pipeline, the geometry pass writes per-pixel material properties to a **Geometry Buffer (G-Buffer)** before any lighting is calculated. A minimal PBR G-Buffer looks like this:

| Attachment | Contents | Format |
|---|---|---|
| **RT0** — Albedo | Base colour (RGB) | `rgba8unorm` |
| **RT1** — Normal | World-space normal (XYZ), packed | `rgba16float` |
| **RT2** — Material | Roughness (R), Metallic (G), Normal-Scale (B), Emissive (A) | `rgba8unorm` |
| **Depth** | Non-linear depth | `depth24plus` |

The lighting pass reads these four textures and from them can apply any BRDF (Cook-Torrance, Blinn-Phong, etc.) with full per-material control — without any scene knowledge baked into the shader.

---

## 3. What Storie's Architecture Can Support Right Now

Storie does not have a geometry pass in the traditional sense — the "scene" is an immediate-mode 2D UI layer. But it does have:

- **WebGPU render passes** inside `Compositor` and `ShaderPipeline`
- **Ping-pong offscreen textures** managed by `ShaderChainManager`
- **A uniform system** in `ShaderManager` that can push per-shader properties each frame
- **A multi-pass chain** that can already run N shaders sequentially

This is sufficient to implement a **2D deferred-style G-Buffer** where material data is written by the `ui` renderer alongside the colour output, then consumed by a lighting shader.

---

## 4. Recommended Architecture

### 4.1 — Add a Material Render Target

The most important change is giving the UI renderer a second render target alongside the colour attachment: a **material texture** that encodes per-pixel lighting properties.

```
WebGPUUI render pass:
  attachment 0: rgba8unorm   ← colour (existing)
  attachment 1: rgba8unorm   ← material: { roughness, normalScale, metallic, emissive }
```

The material target is written by every `ui.rect()`, `ui.image()`, `ui.text()`, and `ui.pushMask*()` call. Its default value is `(0.5, 1.0, 0.0, 0.0)` — half-rough, full normal-scale, non-metallic, non-emissive — so existing code requires no changes. Callers that want to opt in set material properties explicitly.

**Files to modify:**
- `src/ui/webgpu-ui-renderer.ts` — add second colour attachment, extend vertex/fragment shaders
- `src/engine.ts` — expose `ui.setMaterial({ roughness, normalScale, metallic, emissive })` on the sandbox API; resets to default after each draw call (same pattern as `pushMask`/`popMask`)

### 4.2 — Pass Both Textures to the Lighting Shader

The shader chain already threads one texture through the pipeline. It needs to thread two: the composited colour and the material texture.

The cleanest approach is to keep the existing `contentTexture` binding and add a second binding:

```wgsl
@group(0) @binding(0) var contentTexture:  texture_2d<f32>;  // existing colour
@group(0) @binding(1) var contentSampler:  sampler;
@group(0) @binding(2) var materialTexture: texture_2d<f32>;  // NEW: material properties
@group(0) @binding(3) var uniforms:        Uniforms;          // uniform buffer (shift index)
```

**Files to modify:**
- `src/shader-chain.ts` (`ShaderChainManager`) — carry and bind `materialTexture` alongside colour in each pass
- `src/shader-manager.ts` (`ShaderManager`) — extend bind group layout and creation to optionally include a material texture
- `src/compositor.ts` — hand the material texture off to the shader chain on each frame

### 4.3 — Rewrite Lighting Shaders to Use Material Texture

Once material data arrives in the fragment shader, Sobel bump-map strength becomes a per-pixel property rather than a global uniform:

```wgsl
let mat         = textureSampleLevel(materialTexture, contentSampler, uv, 0.0);
let roughness   = mat.r;   // 0=mirror, 1=fully diffuse
let normalScale = mat.g;   // 0=flat, 1=full Sobel bump
let metallic    = mat.b;
// emissive = mat.a

// Sobel normal — attenuated by normalScale from material buffer
let sobelNormal  = normalize(vec3f(gx, gy, uniforms.depth));
let blendedNormal = normalize(mix(vec3f(0.0, 0.0, 1.0), sobelNormal, normalScale));

// Roughness drives specular exponent (PBR approximation)
let shininess = mix(128.0, 4.0, roughness);  // rough=low gloss, smooth=high gloss
let spec = pow(max(dot(viewDir, reflectDir), 0.0), shininess) * uniforms.lightIntensity;

// Metallic blends specular colour from white toward albedo
let specColor = mix(vec3f(1.0), col.rgb, metallic);
```

**Files to modify:**
- `docs/shaders/lightsobel.wgsl.js` — consume `materialTexture` binding 2
- Any future lighting shaders follow the same pattern

### 4.4 — Sandbox API: `ui.setMaterial()`

Demo code in Markdown needs a way to declare material intent per draw call:

```js
// Card face — smooth paper, no Sobel bump
ui.setMaterial({ roughness: 0.85, normalScale: 0.0 });
ui.rect(x, y, cw, ch, pal.cardFace);

// Paper texture tile — midtone, full bump
ui.setMaterial({ roughness: 0.65, normalScale: 1.0 });
ui.image(bgId, tx, ty, tw, th);

// Reset to defaults — happens automatically before next draw call,
// but explicit reset is also valid
ui.setMaterial(null);
```

The material state is a 4-component vector held on the `WebGPUUIRenderer` instance, consumed by the next draw call, then reset — identical to how `pushMaskRoundedRect` works as a modifier.

**Files to modify:**
- `src/ui/webgpu-ui-renderer.ts` — `setMaterial(mat)`, vertex buffer extension or separate material vertex stream
- `src/engine.ts` — expose `ui.setMaterial` in the sandbox

---

## 5. Prioritised Implementation Plan

### Phase 1 — Material Texture Infrastructure *(highest value, enables everything)*

1. Add a second `rgba8unorm` render target to the `WebGPUUIRenderer` render pass
2. Write default material values `(0.5, 1.0, 0.0, 0.0)` for every draw call
3. Add `setMaterial(mat)` on `WebGPUUIRenderer`; store in a 4-float "pending material" that is emitted into the material target for the next draw call
4. Thread the material texture from `WebGPUUIRenderer` → `Compositor` → `ShaderChainManager`
5. Update `ShaderManager` bind group layout to optionally bind a material texture at slot 2 (fallback to a 1×1 default-material texture when not available so all existing shaders continue to work without modification)
6. Expose `ui.setMaterial()` in `src/engine.ts`

**No existing shader changes required in this phase.** All shaders get a `materialTexture` binding but can ignore it.

### Phase 2 — Lighting Shader Upgrade *(immediate visual payoff)*

1. Rewrite `lightsobel.wgsl.js` to read `normalScale` from the material texture instead of applying Sobel uniformly
2. Update `lightsoft.wgsl.js` to read `roughness` and drive specular exponent from it
3. Update `docs/demos/cards-klondike.md`:
   - Card faces: `ui.setMaterial({ roughness: 0.9, normalScale: 0.0 })` — flat, matte paper
   - Card backs: `ui.setMaterial({ roughness: 0.7, normalScale: 0.2 })` — slight texture
   - Paper bg: `ui.setMaterial({ roughness: 0.6, normalScale: 1.0 })` — full bump

### Phase 3 — Extended PBR Properties *(optional, for richer demos)*

1. Add `metallic` support in the lighting shader — specular tint toward albedo
2. Add `emissive` channel — directly adds to final colour before tonemapping, bypassing lighting entirely (good for glowing UI elements, score numbers, etc.)
3. Add a `normalMap` variant: instead of Sobel derivation, sample a pre-authored normal-map texture passed as an additional binding

### Phase 4 — Tonemapping & Colour Science *(polish)*

1. Add a tonemapping pass at the end of the chain (Reinhard, ACES filmic, or Khronos-neutral)
2. Add an `exposure` uniform controlled from demos via `shader.setUniform('tonemap', 'exposure', 1.2)`
3. Ensures specular highlights don't blow out to pure white on bright backgrounds

---

## 6. What to Leave Alone

- **The shader chain pattern** — it is the right architecture for a post-process pipeline; only the inter-pass texture count needs expanding from 1 to 2
- **The demo `.wgsl.js` module format** — it maps cleanly to WebGPU's bind group model; just add the optional second texture binding
- **The sandbox security model** — `ui.setMaterial()` is a pure CPU-side mutation of renderer state, no new privilege required

---

## 7. Why Not Babylon.js / Three.js?

`documentation/BABYLON_INTEGRATION.md` already discusses this trade-off. The short answer for PBR specifically: Storie's scene is **UI-first, 2D-immediate-mode**. Babylon's PBR is designed around mesh geometry, material assets, and a retained-mode scene graph. Adopting it for what is essentially textured-quad compositing would import hundreds of KB of framework to replicate what a 200-line WGSL shader and a second render target can do natively. The architecture above stays entirely in WebGPU primitives that Storie already has initialised and tested.

---

## 8. Quick Reference — Material Texture Channel Assignments

| Channel | Property | Range | Default | Notes |
|---|---|---|---|---|
| R | `roughness` | 0–1 | 0.5 | 0 = mirror-smooth, 1 = fully Lambertian |
| G | `normalScale` | 0–1 | 1.0 | Sobel / normal-map strength; 0 = flat normal |
| B | `metallic` | 0–1 | 0.0 | Tints specular toward albedo colour |
| A | `emissive` | 0–1 | 0.0 | Additive glow, bypasses lighting |

These match the **GLTF 2.0 metallic-roughness material model** channel layout — the same convention used by Babylon, Three.js, and the Khronos glTF spec — so future asset imports will be straightforward.
