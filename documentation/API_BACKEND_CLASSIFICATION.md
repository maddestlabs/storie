# API Backend Classification

## Purpose

If Storie is expected to compile toward both JS and Nim backends, the exposed scripting API needs a portability classification.

This document classifies the current runtime surface into three buckets:

1. portable Storie capability
2. backend-adapter surface
3. JS-only escape hatch

The goal is not to remove everything in buckets 2 and 3.

The goal is to make the compile contract explicit so authored apps can be analyzed for portability instead of silently depending on JS/browser behavior.

## Classification Rules

### Portable Storie capability

Use this when the semantic contract can reasonably be implemented across:

- dev runtime
- compiled JS runtime
- compiled Nim/native runtime

These APIs should be safe to treat as part of the long-term authored model.

### Backend-adapter surface

Use this when the API expresses a real Storie concept, but the current shape is still strongly influenced by the active backend.

These APIs are useful and can stay public, but they should not yet be treated as backend-neutral without an adapter contract or tighter IR representation.

### JS-only escape hatch

Use this when the API directly exposes browser-native objects, browser-only orchestration, dynamic host behavior, or runtime discovery patterns that are not a stable compile contract.

These APIs can remain available in JS-hosted development or JS-only targets, but should be rejected, warned on, or clearly labeled outside that context.

## Current Top-Level Classification

## Portable Storie Capabilities

These are the strongest candidates for the long-term authored contract.

### Core document and runtime state

- `doc.*`
- `scene.*`
- `getFrame()`
- `getTime()`
- `getDelta()`
- `getIsExporting()`
- `isExporting`
- `random.seed()`
- `random.rng()`
- `random.toSeed()`

Reasoning:

These express Storie-level document, timing, and deterministic-state concepts rather than browser-native object models.

### Terminal-style rendering

- `term.*`
- `termCanvas.*`
- `layer.create/show/hide/setAlpha/clear`

Reasoning:

These are already close to an engine-defined rendering vocabulary and do not inherently depend on browser-native APIs.

### Input and dropped-file semantics

- `key.*`
- `mouse.*`
- `drop.*`
- `mouseX`, `mouseY`, `mouseCellX`, `mouseCellY`, `mousePixelX`, `mousePixelY`
- `termWidth`, `termHeight`

Reasoning:

These map cleanly to backend-neutral polling/input concepts if the event and coordinate semantics stay explicit.

### Theme and packaged asset access

- `getStyle()`
- `theme`
- `themes.list/getName/get/set`
- `blob.*`
- `ascii.*`
- `drawAscii(...)`
- `figlet.*`
- `drawFiglet(...)`
- `ansi.*`
- `drawAnsi(...)`

Reasoning:

These operate on engine-defined assets and styles rather than backend-native handles.

### Structured system helpers

- `sys.params.get(...)`
- `sys.parseTimed(...)`
- `sys.input.emit(...)`
- `sys.automation.*`
- `sys.history.create(...)`
- `sys.recorder.create(...)`
- `sys.beat.*`

Reasoning:

These are strong candidates for compile-visible portable utilities because they work on structured data and Storie-defined timing semantics.

## Backend-Adapter Surfaces

These represent real Storie features, but the current public shape is still backend-shaped enough that the compiler should treat them carefully.

### Audio capability

Portable-leaning subset:

- `audio.playTone(...)`
- `audio.loadSound(...)`
- `audio.loadSoundFromDrop(...)`
- `audio.loadSoundFromBlob(...)`
- `audio.playBuffer(...)`
- `audio.playDrop(...)`
- `audio.playBlob(...)`
- `audio.ambient.createLayeredBed(...)`
- `audio.buffer.create(...)`
- `audio.peaksFromBuffer(...)`
- `audio.beatsFromBuffer(...)`
- `audio.beatState(...)`
- `audio.captureForExport(...)`
- `audio.getCapturedForExport()`
- `audio.sfx.*`

Classification:

Backend-adapter surface.

Reasoning:

These expose a real Storie audio capability, but several current methods still pass browser-native `AudioBuffer`, `AudioNode`, or `AudioBufferSourceNode` objects around. That is useful today, but not yet a clean cross-backend compile contract.

Migration target:

See [AUDIO_PORTABILITY_CONTRACT.md](./AUDIO_PORTABILITY_CONTRACT.md) for the intended asset/playback/analysis/synth split.

### GUI, TUI, UI, Worlds, shader, compositor

- `tui.*`
- `gui.*`
- `ui.*`
- `worlds.*`
- `shader.*`
- `compositor.*`

Classification:

Backend-adapter surface.

Reasoning:

These are important Storie subsystems, but they still need clearer backend-neutral contracts before they should be treated as portable authored semantics. In particular:

- `ui` is currently tied to WebGPU-oriented immediate drawing semantics
- `worlds` needs a stable scene/navigation contract independent of the current web renderer
- `shader` needs a backend-neutral shader/material model above raw WGSL details
- `compositor` needs clearer capability boundaries and ownership semantics
- `gui` and `tui` likely can become portable, but the current runtime shape is still closely coupled to present engine internals

### Declarative modules

- frontmatter `modules: [...]`
- compile-visible declared module requirements

Classification:

Backend-adapter surface, moving toward portable contract.

Reasoning:

Declared module dependencies are compatible with a cross-backend compiler model, but they still need tighter semantics distinguishing runtime modules, domain modules, and document modules.

### Host information

- `host.enabled`
- `host.role`
- `host.isHost`
- `host.isClient`
- `host.transport`
- `host.channel`

Classification:

Backend-adapter surface.

Reasoning:

These are portable in spirit, but the long-term contract should be message- and role-oriented rather than defined by the current browser transport implementation.

## JS-Only Escape Hatches

These should not define the long-term compile contract.

### Raw browser-native audio access

- `audio.context`
- `audio.createOscillator()`
- `audio.createGain()`
- `audio.createBiquadFilter()`
- `audio.createDelay()`
- `audio.createConvolver()`
- `audio.createDynamicsCompressor()`
- `audio.createAnalyser()`
- `audio.createBufferSource()`
- `audio.createPanner()`
- `audio.createStereoPanner()`
- `audio.createWaveShaper()`
- any authored code that relies on returned browser-native audio node identity as part of app logic

Reasoning:

This is direct Web Audio authoring. Useful, but not a backend-neutral Storie contract.

### Raw canvas and browser image access

- `canvas2d.context`
- `canvas2d.drawImage(...)` with browser-native image objects
- any authored code depending on `HTMLImageElement`, `ImageBitmap`, or `HTMLCanvasElement` identity

Reasoning:

These are browser-native object contracts.

### Raw WebGL and WebGPU access

- `webgl.context`
- `webgl.createShader(...)`
- `webgl.createProgram(...)`
- `webgl.available`
- `webgpu.device`
- `webgpu.init()`
- `webgpu.createBuffer(...)`
- `webgpu.createShaderModule(...)`
- `webgpu.createTexture(...)`
- `webgpu.GPUBufferUsage`
- `webgpu.GPUTextureUsage`
- `webgpu.GPUShaderStage`

Reasoning:

These are direct browser GPU APIs or thin wrappers around them. They can remain for JS-hosted development and JS-specific apps, but they should be treated as target-specific features unless a higher-level Storie contract is defined.

### Browser-environment orchestration

- `sys.download(...)`
- `getParam(...)`
- `ui.loadImageFromURL(...)`
- dynamic `modules.load(...)`
- dynamic `modules.loadAll(...)`
- `modules.on(...)` when used for runtime-only discovery/orchestration

Reasoning:

These depend on browser environment assumptions, dynamic import behavior, URL semantics, or host-side runtime discovery that should not define portable compiled behavior.

`sys.params.get(...)` is the preferred portable replacement for `getParam(...)` when authored code needs launch/query state without depending on browser URL semantics directly.

## Transitional Or Ambiguous Areas

These are not automatically JS-only, but they are not yet clean compile-contract surfaces either.

### `canvas2d.*` helper layer

The helper methods such as `clear`, `drawRect`, `drawCircle`, `drawLine`, and `text` express useful intent, but they still map directly onto the browser 2D canvas model today.

Treat as backend-adapter surface until there is a clearer Storie 2D drawing contract.

### `modules.get/isLoaded/isLoading/unload/getMetadata`

These are useful runtime inspection helpers, but compile mode should prefer explicit module declarations over runtime module graph decisions.

### `host` without `host.send/on`

The metadata surface is classifiable, but the actual durable composition contract should eventually center on structured messaging rather than transport inspection.

## Authoring Guidance

For portability toward Nim/native compilation, authored content should prefer the following subsets.

### Preferred portable subset

- `term`, `termCanvas`, `layer`
- `key`, `mouse`, `drop`
- `doc`, `scene`
- themes and packaged asset access
- `random`
- `sys.parseTimed`, `sys.automation`, `sys.history`, `sys.recorder`, `sys.beat`
- explicit state objects and lifecycle hooks

### Allowed with caution

- `audio` helper APIs
- `gui`, `tui`, `ui`, `worlds`, `shader`, `compositor`
- declarative module usage

### JS-target only unless explicitly approved

- raw browser contexts and devices
- runtime dynamic module loading as core app behavior
- URL-driven loading/orchestration as core app behavior
- browser-native object identity used as durable app state

## Compile-Validation Implications

The compiler should eventually be able to assign warnings or hard failures based on this classification.

Suggested policy:

### Portable mode

- allow portable capabilities
- allow approved backend-adapter surfaces with warnings where needed
- reject JS-only escape hatches

### JS-target mode

- allow all three classes
- still warn when authored code depends heavily on JS-only surfaces because it reduces future portability and runtime minimization

## Immediate Refactor Priorities

1. Mark raw browser-native accessors as JS-only in docs and validation.
2. Move more author workflows toward helper APIs that return structured data or handles instead of raw host objects.
3. Define backend-neutral contracts for `audio`, `gui`, `ui`, `worlds`, `shader`, and `compositor`.
4. Treat declarative module metadata as the compile contract and runtime module discovery as optional dev/runtime behavior.
5. Add script-profile validation rules that can reference these portability classes directly.

## Relationship To Other Docs

- [NIM_COMPILATION_CONSIDERATIONS.md](./NIM_COMPILATION_CONSIDERATIONS.md) explains why this classification is necessary.
- [MINIMAL_RUNTIME_ARCHITECTURE.md](./MINIMAL_RUNTIME_ARCHITECTURE.md) explains how capability separation enables minimal compiled outputs.
- [MODULE_SYSTEM.md](./MODULE_SYSTEM.md) documents the current optional runtime module loader.

This document is the practical portability audit for the current API surface.