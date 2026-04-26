# Compile Warning Codes

## Purpose

The compiler now emits structured warnings with:

- code
- severity
- category
- message

These warnings are used both for diagnostics and for portability-profile enforcement.

Profiles currently behave like this:

- `js`: warnings never block compilation
- `portable`: `error` severity warnings block compilation
- `nim`: `error` severity warnings and portability-category warnings block compilation

This document explains what each warning code means and what to do about it.

## Categories

### `dynamic-behavior`

Warnings about behavior that is difficult to analyze or lower reliably at compile time.

### `portability`

Warnings about authored code that depends on backend-specific or browser-specific behavior.

### `security`

Warnings about patterns that should not be part of the compile contract at all.

## Warning Codes

## `CPDYN001`

Category: `dynamic-behavior`

Severity: `warning`

Meaning:

Dynamic `modules.load(...)` or `modules.loadAll(...)` was detected in authored code.

Why it matters:

Runtime-only module discovery makes it harder for the compiler to assemble minimal app bundles and impossible to guarantee backend portability.

Recommended direction:

- prefer frontmatter `modules: [...]` for declared module requirements
- prefer compile-visible document or domain module dependencies
- keep runtime module loading as a JS-target convenience, not the core authoring contract

## `CPDYN002`

Category: `dynamic-behavior`

Severity: `warning`

Meaning:

Dynamic `import()` was detected in document code.

Why it matters:

This creates runtime dependency graphs that the compiler cannot fully reason about ahead of time.

Recommended direction:

- replace dynamic import graphs with declared dependencies
- if dynamic import must exist for JS-only targets, keep it outside the portable compile contract

## `CPPORT001`

Category: `portability`

Severity: `warning`

Meaning:

Direct `fetch()` was detected in document code.

Why it matters:

Browser fetch semantics do not map cleanly to minimal compiled runtimes or Nim-native backends.

Recommended direction:

- move network/resource acquisition into declared assets, host-side loading, or explicit Storie APIs
- treat direct fetch as JS-target behavior unless a backend-neutral resource contract is defined

## `CPPORT002`

Category: `portability`

Severity: `warning`

Meaning:

Backend-adapter surfaces were detected, such as legacy `audio` bridge APIs, `gui`, `ui`, `worlds`, `shader`, or `compositor`.

Why it matters:

These APIs represent real Storie capabilities, but their current shape is still closely tied to the current runtime/backend implementation.

Recommended direction:

- keep using them where needed in JS development
- avoid treating them as fully portable authored semantics yet
- progressively replace backend-shaped behavior with structured Storie-level contracts
- for Nim-target work, define explicit IR and adapter boundaries first

Audio-specific note:

The warning now intentionally distinguishes legacy audio bridge surfaces from the newer handle-based seam. `audio.asset.*`, `audio.analysis.*`, and handle-based `audio.play(...)` are the intended portable migration path; older helpers like `audio.playTone(...)`, `audio.playBuffer(...)`, `audio.captureForExport(...)`, and `audio.sfx.*` remain transitional. See [AUDIO_PORTABILITY_CONTRACT.md](./AUDIO_PORTABILITY_CONTRACT.md) for the contract direction.

`audio.buffer.create(...)` is also treated as a transitional bridge API: it is useful for JS-hosted synthesis code that still needs explicit sample buffers, but it is not yet part of the backend-neutral authored model.

`audio.ambient.createLayeredBed(...)` is a similar transitional bridge: it isolates raw node-graph construction behind a named Storie-owned adapter surface, which is better than direct `audio.create*` usage but still not a final portable contract.

## `CPPORT003`

Category: `portability`

Severity: `error`

Meaning:

JS-only runtime access was detected, such as raw browser audio contexts, raw WebGL/WebGPU access, browser URL/image loading, or other browser-specific orchestration.

Why it matters:

These are target-specific escape hatches, not portable Storie semantics.

Recommended direction:

- replace raw browser-native access with Storie helper APIs where possible
- if no helper exists, that usually means the Storie API is missing a concept
- keep JS-only access isolated behind a JS-target profile instead of making it part of the portable authored model

Audio-specific note:

Raw `audio.context` and raw node construction are explicitly JS-only until a higher-level audio handle/asset/playback contract replaces them. See [AUDIO_PORTABILITY_CONTRACT.md](./AUDIO_PORTABILITY_CONTRACT.md).

For browser query parameters or launch state, prefer `sys.params.get(...)` over `getParam(...)` so authored code depends on a Storie-owned host contract instead of direct URL semantics.

## `CPSEC001`

Category: `security`

Severity: `error`

Meaning:

Dynamic code evaluation such as `eval(...)` or `Function(...)` was detected.

Why it matters:

This is outside the intended compile contract and undermines both security and backend portability.

Recommended direction:

- remove the dynamic evaluation pattern
- represent the behavior directly in Storie code, metadata, or compile-visible structured data

## `CPDECL001`

Category: `capability`

Severity: `warning`

Meaning:

Frontmatter declared one or more unknown capability names in `requires:` or `capabilities:`.

Why it matters:

Compile analysis can only use declared requirements when they refer to known capability-pack names. Unknown entries are ignored, which means the document contract is incomplete or misspelled.

Recommended direction:

- use only known capability-pack names such as `audio`, `worlds`, `gui`, `terminal`, `shader`, `modules`, and `host`
- prefer frontmatter declarations when a document intentionally depends on a capability that static JS analysis may not infer reliably
- treat unknown names as a contract bug to fix rather than as harmless metadata

## `CPDECL002`

Category: `capability`

Severity: `warning`

Meaning:

Frontmatter declared one or more unknown host permission names in `hostPermissions:` or `permissions:`.

Why it matters:

The compile path can only reason about declared host permissions when they refer to known permission names. Unknown entries may reflect a typo or a host contract that has not been formalized yet.

Recommended direction:

- use known permission names such as `clipboard-read`, `clipboard-write`, `download`, `modules-load`, `dynamic-import`, `cross-origin-dynamic-import`, and `webgpu-device`
- keep host permission declarations narrow and explicit
- if a new host behavior is genuinely needed, define it as a named Storie contract before depending on it in authored content

## Workflow Guidance

If you want broad compatibility:

1. get to zero `CPPORT003` warnings first
2. reduce `CPPORT002` warnings by moving behavior toward structured capability contracts
3. reduce `CPDYN001` and `CPDYN002` by making dependencies compile-visible

If you are building only for current JS/web runtime:

- these warnings are still useful because they show where authored content is becoming less analyzable and less minimizable

## Related Docs

- [API_BACKEND_CLASSIFICATION.md](./API_BACKEND_CLASSIFICATION.md)
- [NIM_COMPILATION_CONSIDERATIONS.md](./NIM_COMPILATION_CONSIDERATIONS.md)
- [MINIMAL_RUNTIME_ARCHITECTURE.md](./MINIMAL_RUNTIME_ARCHITECTURE.md)
- [../COMPILATION_ROADMAP.md](../COMPILATION_ROADMAP.md)