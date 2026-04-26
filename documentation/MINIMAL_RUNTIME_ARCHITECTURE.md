# Minimal Runtime Architecture

## Purpose

Storie should be able to compile authored Markdown applications into standalone apps or games that ship only the runtime pieces they actually need.

The target is not a smaller version of today's browser runtime.

The target is an app-specific runtime assembly model:

1. a tiny kernel for the most basic app shape
2. capability packs for optional engine features
3. domain and document modules layered above those packs

This changes the question from:

> how do we make the whole engine portable?

to:

> how do we make authored behavior analyzable enough that the compiler can assemble only the required runtime pieces?

That is the short-term path to truly minimal standalone outputs, and the long-term path to native compilation without carrying the full scripting runtime forever.

## Core Principle

The strict scripting API and the modular runtime are the same project.

The API must become strict enough that authored source can be analyzed as Storie semantics rather than arbitrary JavaScript semantics. Once that is true, the compiler can determine:

- which lifecycle machinery is required
- which capability packs are required
- which assets are required
- which domain modules are required
- which state structures and behavior hooks must exist at runtime

If user code can freely depend on host-language tricks, runtime assembly becomes conservative and bloated because the compiler can no longer know what is actually needed.

## Runtime Layers

### 1. Kernel

The kernel is the smallest runtime that can execute a compiled Storie app.

It should contain only the essentials needed by a trivial app:

- explicit app state creation and storage
- lifecycle dispatch
- behavior block registration and execution
- capability registry / dependency wiring
- asset lookup for compile-declared assets
- minimal document/section navigation primitives
- deterministic startup and teardown

The kernel should not assume terminal rendering, GUI, Worlds, audio, shader support, or sandbox scripting by default.

If a blank or extremely simple app does not need a subsystem, that subsystem does not belong in the kernel.

### 2. Capability Packs

Capability packs are optional runtime slices that sit on top of the kernel.

These should align with compile-visible capability classes, for example:

- terminal
- ui
- gui
- worlds
- audio
- shader
- blobs
- timed
- logic
- random
- themes
- modules
- host
- sys
- input
- export

The compiler should emit which packs are required for a given app. The pack list should become the authoritative assembly contract for compiled targets.

Each capability pack should expose a stable API surface and avoid hidden dependencies on unrelated packs. If one pack requires another, that dependency should be explicit and machine-readable.

### 3. Domain Modules

Domain modules are reusable authored systems built on capability packs.

Examples:

- sequencer core
- stfxr graph editor core
- worlds timeline helpers
- ANSI / ASCII render helpers
- retained UI patterns

These are not foundational engine capabilities. They are reusable product-level logic that should compile into the app only when referenced.

The main engineering goal for domain modules is to move logic out of monolithic demo documents and into reusable, analyzable modules with explicit contracts.

### 4. Document Modules

Document modules are Markdown artifacts that can act as:

1. standalone apps
2. embeddable panels or sub-applications
3. human-readable source

Their contracts should be declared through metadata such as:

- exports
- accepts
- required capabilities
- required domain modules

Document modules should compile into app-specific bundles without forcing unrelated runtime features into the output.

## Module Taxonomy

Storie should distinguish clearly between three different meanings of "module":

### Runtime module

An optional engine/runtime implementation unit loaded by the host runtime.

Examples:

- Babylon integration
- advanced physics
- networking bridge

### Domain module

A reusable Storie subsystem that expresses product behavior.

Examples:

- sequencer
- graph editor
- worlds editor

### Document module

A Markdown-authored application or panel with declared input/output contracts.

These categories should not be collapsed together. They solve different problems and should be compiled, versioned, and reasoned about separately.

## Development Mode vs Compiled Mode

Development mode may keep SES, hot reload, and permissive execution because those are useful for iteration.

But development mode should no longer define the semantics of the shipped product.

Compiled mode should be the semantic center:

- explicit state instead of implicit top-level persistence
- explicit lifecycle hooks instead of wrapper magic as the long-term model
- explicit capability usage instead of broad global availability
- explicit dependencies instead of runtime discovery as the default model

The dev runtime should progressively converge toward that model even if it continues to offer compatibility affordances during the transition.

## Compiler Responsibilities

The compiler should evolve from a scaffold generator into a runtime assembler.

For each compiled app, it should determine:

1. kernel requirements
2. required capability packs
3. required domain modules
4. document-module contracts
5. explicit asset manifest
6. explicit state and lifecycle layout

The output should not be "the full engine plus compiled behavior".

The output should be "the smallest valid runtime assembly for this app".

## API Design Implications

This architecture only works if authored code stays inside a constrained Storie scripting profile.

That means:

- authored code should prefer a single explicit state object
- repeated patterns should move into API methods or declarative metadata
- dynamic host-language features should be discouraged or rejected in compile-oriented mode
- if authors repeatedly need a host-language trick, the engine is probably missing an API concept

The strict API is therefore not merely a style preference. It is what makes minimal runtime assembly feasible.

## Near-Term Priorities

### 1. Define the kernel boundary

Document exactly what the minimal compiled runtime must contain, and remove everything else from the implicit baseline.

### 2. Turn capability names into real runtime boundaries

The compile-visible capability list should become a build and packaging boundary, not just a diagnostic summary.

That is already partly true in code: compile output now carries runtime-assembly metadata describing pack-constructible API, host-required API, per-capability surface details, and named host adapters. The next step is to make the assembler consume that metadata instead of merely reporting it.

### 3. Turn named host adapters into explicit runtime seams

When a capability still depends on the host, that dependency should stop being implicit.

Recent audio-side examples already exposed this pattern:

- `audioContextRuntime`
- `audioAssetDecoder`
- `audioBufferFactory`
- `audioExportCapture`
- `stfxrDocumentStore`
- `stfxrBakedStore`

Those seams do not finish modularization by themselves, but they prevent hidden engine state from remaining the only executable contract.

### 4. Make compile analysis authoritative

If the compiler cannot statically understand a document's needs, the authoring model should be adjusted until it can.

### 5. Treat sandbox rewriting as compatibility, not semantics

SES and hot-reload transforms can remain useful during development, but they should no longer define the intended long-term execution model.

### 6. Extract large demo documents into domain modules

The first targets should be the areas already showing stable module boundaries, such as sequencer and `stfxr-graph`.

### 7. Add document-module assembly metadata

`exports`, `accepts`, capability requirements, and module dependencies should become compile-visible metadata used to assemble output bundles.

Parts of that metadata already exist in manifests and generated scaffold output. The remaining work is to make composition, bundling, and backend selection consume it as a real assembly contract.

## Practical Test

Any new subsystem should now be evaluated with two questions:

1. can the compiler determine whether this subsystem is needed for a given app?
2. can this subsystem be omitted entirely from outputs that do not use it?

If the answer to either is no, the subsystem boundary is probably too implicit.

## Relationship to Other Docs

- [ARCHITECTURE.md](../ARCHITECTURE.md) defines the language-agnostic API direction.
- [COMPILATION_ROADMAP.md](../COMPILATION_ROADMAP.md) defines the shift toward compile-first execution.
- [MODULAR_COMPOSITION.md](./MODULAR_COMPOSITION.md) defines document-as-module composition.
- [MODULE_SYSTEM.md](./MODULE_SYSTEM.md) covers the current optional runtime module loader.

This document narrows those ideas into a concrete short-term product goal: compiled outputs should contain only the minimal runtime kernel and capability/module slices required by the authored source.