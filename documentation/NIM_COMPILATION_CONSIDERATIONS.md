# Nim Compilation Considerations

## Purpose

Storie's long-term native target should not be framed as "port the JavaScript runtime to Nim later".

The real target is:

1. define Storie semantics independently of JavaScript
2. keep authored scripts inside that semantic layer
3. lower those semantics into either a JS backend or a Nim backend

This is how Storie preserves a swappable scripting language surface while still using JavaScript as the current authoring notation.

The precedent from `tStorie` matters here: if a project can ultimately export to native Nim code for compilation, then Storie should be designed so that authored content depends on Storie concepts first and host-language behavior second.

## Core Requirement

The scripting language must be swappable.

That means JavaScript cannot be the semantic source of truth.

JavaScript is currently one notation for authored behavior. Nim should be able to target the same underlying Storie behavior model without requiring authored apps to be rethought.

The more user code depends on JS-specific behavior, browser object identity, event loop quirks, dynamic reflection, or closure-heavy patterns, the less realistic Nim compilation becomes.

## What Must Become Backend-Neutral

### 1. State Semantics

Persistent state must have an explicit Storie meaning.

Do not let long-term semantics depend on:

- implicit top-level JS variable persistence
- hot-reload transforms
- closure capture behavior as the persistence model
- dynamic object mutation patterns that are only easy because of JS object flexibility

For Nim compilation, the compiler should be able to emit a stable state structure directly.

### 2. Lifecycle Semantics

Hooks like `init`, `update`, `render`, `input`, `drop`, `export`, and `enter` need stable backend-independent meaning.

They should map to Storie behavior units, not to ad hoc JS snippets whose behavior depends on wrapper generation.

### 3. Capability Semantics

Capabilities such as audio, GUI, Worlds, timed content, and host messaging need to be defined as Storie interfaces with backend adapters.

The API shape can stay similar across backends, but the semantic contract must belong to Storie.

For example:

- `audio.playTone(...)` is a Storie capability
- `audio.context.createOscillator()` is a JS/browser-native escape hatch

The first is portable. The second is backend-specific.

Backend-specific escape hatches can still exist in dev mode or JS-only targets, but they should not define the compile contract.

### 4. Asset Semantics

Assets need canonical Storie formats and pipeline rules.

This includes:

- blob blocks
- timed blocks
- shader blocks
- logic blocks
- document-scoped media
- generated resources

If JS and Nim backends consume different representations, the compiler should lower from the same Storie asset IR into each backend's native form.

### 5. Event And Time Semantics

Do not let browser scheduling become the semantic definition of Storie behavior.

Storie should define:

- what `delta` means
- what frame/update ordering means
- what timed content resolution means
- what host messaging guarantees mean
- what export-time playback semantics mean

The JS runtime can implement those semantics with browser timing primitives. Nim can implement them with native timing primitives. The semantics themselves must stay the same.

## JS Features That Need Extra Caution

If Nim export is a serious target, these areas need to stay constrained or be treated as explicitly JS-only:

### Raw Native Browser APIs

The current browser-native APIs are useful, but they should be treated as backend adapters or optional target-specific extensions rather than the primary authoring model.

If authored apps depend heavily on:

- `AudioContext`
- `CanvasRenderingContext2D`
- raw WebGL objects
- raw WebGPU device access

then Nim compilation becomes either impossible or hostage to browser API emulation.

The portable layer should stay at the Storie capability level.

### Dynamic Reflection And Metaprogramming

Patterns such as:

- dynamic property discovery
- prototype manipulation
- runtime code generation
- eval-like behavior
- dynamic import graphs discovered only at runtime

should not be part of the compile contract.

### JS Object Identity As API Contract

Do not make important semantics depend on object identity of browser-native instances or mutable object bags passed around implicitly.

Nim backends will work better with explicit IDs, handles, records, and declared ownership.

### Promise-Centric Orchestration

Async behavior should be expressed in Storie lifecycle or capability terms when possible.

If authors need `Promise` choreography everywhere, that is usually a sign the Storie API is too thin or too browser-shaped.

## Implementation Constraints To Add Now

### 1. Separate Portable APIs From JS-Only APIs

Every exposed API should be classified as one of:

- portable Storie capability
- backend adapter surface
- JS-only convenience or escape hatch

That classification should appear in docs and eventually in compile validation.

The current working audit lives in [API_BACKEND_CLASSIFICATION.md](./API_BACKEND_CLASSIFICATION.md).

### 2. Strengthen The IR Boundary

The IR should become the true interchange layer between authored content and generated backends.

The Nim backend should consume the same conceptual IR as the JS backend:

- content IR
- behavior IR
- capability IR
- asset IR
- dependency/module IR

If a feature cannot be represented cleanly in IR, it is not ready to be a cross-backend authoring feature.

### 3. Prefer Structured Data Over Opaque Host Objects

Cross-backend compilation improves when behavior lowers to:

- plain records
- enums
- arrays
- maps with constrained meaning
- explicit handles and IDs

It becomes harder when behavior depends on opaque host objects that only exist naturally in JS.

### 4. Make Resource Ownership Explicit

Native backends care much more about ownership and disposal boundaries.

Compilation should eventually know:

- who creates a resource
- who owns it
- when it is disposable
- whether it is document-scoped, section-scoped, or global

This matters for audio nodes, GPU resources, images, exports, and host-linked resources.

### 5. Stabilize Numeric And Serialization Behavior

If JS and Nim are both targets, data formats and math behavior need to be predictable.

Important areas:

- integer vs float assumptions
- rounding behavior
- clamping behavior
- time units
- random generation semantics when deterministic output matters
- canonical serialization formats for presets and assets

Even small mismatches here can cause compile divergence between backends.

### 6. Design For Backend Test Parity

The compile pipeline should eventually support golden tests where the same authored source yields equivalent behavior across:

- dev runtime
- compiled JS runtime
- compiled Nim/native runtime

Without parity tests, the JS backend will quietly become the real spec even if the docs say otherwise.

## Recommended Backend Contract

The cleanest long-term arrangement is:

1. Authored Markdown lowers into Storie IR.
2. Storie IR lowers into generated JS or generated Nim.
3. Each backend links against a backend-specific runtime implementing the same Storie capability contracts.

That means the true long-term compatibility promise is not:

> this JavaScript code also happens to work elsewhere

It is:

> this authored Storie program lowers into multiple backends because its semantics are defined above any one host language.

## Practical Near-Term Rules

To keep Nim export viable, current implementation work should follow these rules:

### Prefer

- explicit `state` objects
- lifecycle-oriented behavior
- compile-visible capability usage
- declarative metadata
- structured asset formats
- stable document-module contracts
- API helpers that encode intent rather than raw host access

### Be Careful With

- direct browser API usage in authored code
- broad ambient globals
- implicit persistence tricks
- runtime-only dependency discovery
- metaprogramming-heavy helper patterns
- semantics hidden inside transforms

### Treat As JS-Only Unless Proven Portable

- raw browser contexts and devices
- browser-specific scheduling assumptions
- direct DOM reachability
- host-native object passing as a durable contract

## Relationship To Minimal Runtime Work

The minimal-runtime direction and the Nim direction reinforce each other.

If Storie can compile an app into:

- a tiny kernel
- only the required capability packs
- only the required domain/document modules

then Storie is already moving away from a monolithic JS runtime and toward a backend-neutral architecture.

That same separation is what a Nim backend needs.

## Recommendation

Yes, there is more to consider for compilation if Nim is the eventual native target.

The biggest additional requirement is this:

Storie must distinguish between:

- the portable Storie language and runtime contract
- the current JS-hosted development implementation
- backend-specific escape hatches

If those layers stay blurred, Nim compilation will always feel like a later port.

If those layers become explicit now, Nim compilation becomes a normal backend of the same authored model.