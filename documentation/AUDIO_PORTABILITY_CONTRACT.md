# Audio Portability Contract

## Purpose

Audio is currently the clearest example of a real Storie capability whose public API is still too shaped by the browser runtime.

Today, Storie exposes both:

- helper-style audio operations such as `audio.playTone(...)`
- raw browser-native Web Audio access such as `audio.context` and `audio.createOscillator()`

That is useful for JS-hosted development, but it is not yet a clean contract for:

- minimal compiled JS runtimes
- portable compile profiles
- future Nim/native backends

This document defines the intended direction for a backend-neutral Storie audio layer.

## Core Principle

Storie audio semantics should describe:

- what sound asset is being referenced
- what playback is requested
- what analysis is requested
- what export audio should be attached
- what deterministic sound-generation intent exists

They should not require authored code to depend on browser-native `AudioContext`, `AudioBuffer`, `AudioNode`, or `AudioBufferSourceNode` identity.

Those objects may remain available in JS-target mode, but they should be treated as backend-specific implementation details or escape hatches.

## Contract Layers

## 1. Portable Storie Audio Contract

This is the layer authored code should ideally target for portability.

### Asset-oriented loading

Portable audio should prefer named or declared assets over arbitrary browser objects.

Examples of portable intent:

- load audio from a declared document asset
- load dropped audio into a Storie-managed audio asset handle
- refer to a sound by a stable engine-level ID

The long-term contract should be closer to:

- `audio.asset.load(name)`
- `audio.asset.fromDrop()`
- `audio.asset.info(handle)`

than to:

- `AudioBuffer` as the main portable value

### Playback-oriented control

Portable playback should express intent such as:

- play asset
- stop playback
- set loop
- set gain
- set playback rate
- start or restart from an explicit offset
- schedule or restart playback

The return value should eventually be a Storie playback handle, not a browser-native source node.

Conceptually:

```js
const clip = await audio.asset.load('intro-theme');
const voice = audio.play(clip, { loop: true, gain: 0.8, offsetSec: 4.5 });
audio.stop(voice);
```

The current APIs `playBuffer`, `playDrop`, and `playBlob` encode useful intent, but they still return browser-native nodes and accept backend-native buffers.

### Deterministic synthesis intent

Chiptone/SFX generation is a strong candidate for portability because it already leans toward data-driven generation.

Examples:

- preset name
- seed
- synthesis parameters

This is much easier to lower to Nim than open-ended raw node graphs.

The long-term portable subset here is likely the strongest part of current audio support.

### Offline analysis

Audio analysis features such as:

- peak detection
- beat detection
- beat-state queries

are also good portability candidates because they operate on structured audio data and return structured analysis results.

The key design requirement is to make sure the analysis input and output formats are backend-neutral.

### Export contract

The export path should describe attached audio in Storie terms:

- source asset or clip
- offset
- duration/window if needed

Rather than relying on backend-native buffers as the durable authored contract.

## 2. Backend-Adapter Layer

This is the transitional layer Storie currently occupies.

The following current APIs express real Storie audio behavior, but are still tied to backend-native value types:

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

These should be treated as bridge APIs.

They are useful and worth preserving, but the contract should gradually shift from browser-native values toward:

- asset handles
- playback handles
- analysis data records
- portable synth/preset records

`audio.resume()` and `audio.state` are useful host-owned helpers for gesture/device state without forcing authored code to reach through `audio.context`, but they do not by themselves make raw node graphs portable.

`audio.ambient.createLayeredBed(...)` is the same kind of bridge for authored ambience graphs: it moves construction into a Storie-owned adapter boundary so documents can stop calling raw `audio.create*` constructors directly, while still acknowledging that the graph semantics are not yet backend-neutral.

## 3. JS-Only Escape Hatches

These should remain explicitly JS-target only unless a backend-neutral abstraction is added above them:

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
- any logic that depends on raw node graph identity as durable authored state

These are powerful and should remain available for JS-specific work.

They should not define the portable authored model.

## Proposed Long-Term Shape

The portable contract should move toward four sub-areas.

An initial runtime seam now exists in the JS engine around:

- `audio.asset.*`
- `audio.analysis.*`
- `audio.play(...)`
- `audio.stop(...)`
- `audio.setGain(...)`
- `audio.setPlaybackRate(...)`
- `audio.voiceInfo(...)`

That seam is intentionally small. It does not complete the contract, but it gives authored code a migration target that does not begin with raw `audio.context`.

It now also supports explicit playback offsets so authored code can implement pause/resume or seek-style transport behavior without relying on raw `AudioBufferSourceNode` state.

The compile analyzer now treats that seam as the preferred portable direction. Legacy helpers such as `audio.playTone(...)`, `audio.playBuffer(...)`, `audio.captureForExport(...)`, and `audio.sfx.*` are still supported, but they remain explicitly transitional backend-adapter surfaces under `CPPORT002`.

## A. Assets

Purpose:

- identify audio content independent of backend-native buffers

Conceptual responsibilities:

- load by declared name
- load from dropped file
- describe asset metadata
- expose stable handle or ID

## B. Playback

Purpose:

- request playback without exposing raw source node identity

Conceptual responsibilities:

- play
- stop
- pause/resume if supported
- set gain
- set rate
- query state

## C. Analysis

Purpose:

- run deterministic offline or runtime analysis on engine-managed audio data

Conceptual responsibilities:

- peaks
- beats
- beat-state
- FFT/bands only if represented in backend-neutral value shapes

## D. Synth / SFX Intent

Purpose:

- express seed-driven or preset-driven synthesis in a portable way

Conceptual responsibilities:

- preset selection
- preset data
- seeded generation
- snippet export / serializable synth intent

## Migration Guidance

If you want authored content to move toward Nim compatibility, the audio migration order should be:

1. stop depending on `audio.context` in authored logic
2. stop depending on returned raw nodes as durable state
3. prefer helper APIs that express intent rather than graph construction
4. move loading and playback around named assets or explicit handles
5. keep deterministic synth/preset behavior data-driven

## Immediate Design Implications

### `audio.playTone(...)`

Keep it as a convenience API, but stop treating its current return value as part of the long-term contract.

### `audio.loadSound(...)`, `playBuffer(...)`, `playBlob(...)`, `playDrop(...)`

Useful, but they should move toward an asset-handle and playback-handle model.

### `audio.peaksFromBuffer(...)`, `audio.beatsFromBuffer(...)`

These are good portability candidates, but they should eventually accept a portable audio asset handle or a backend-neutral audio data record rather than only a browser-native decoded buffer.

### `audio.captureForExport(...)`

This should eventually attach export audio by portable asset/clip reference rather than backend-native buffer identity.

## Relationship To Warning Codes

- `CPPORT002` currently covers the helper-level audio API as a backend-adapter surface.
- `CPPORT003` covers raw browser-native audio access.

This document is the migration target those warnings are pointing at.

## Related Docs

- [API_BACKEND_CLASSIFICATION.md](./API_BACKEND_CLASSIFICATION.md)
- [COMPILE_WARNING_CODES.md](./COMPILE_WARNING_CODES.md)
- [NIM_COMPILATION_CONSIDERATIONS.md](./NIM_COMPILATION_CONSIDERATIONS.md)
- [SES_NATIVE_APIS.md](./SES_NATIVE_APIS.md)

This contract is intentionally narrower than the current JS runtime. That is the point: Storie needs a backend-neutral audio model above the current browser implementation.