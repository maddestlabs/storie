# Storie Compilation Roadmap

## Purpose

Storie is not just a browser runtime. The long-term target is an operating system where Storie is the primary application and game development mechanism, and where the OS itself provides the capabilities Storie needs.

That means Storie needs two things at once:

1. A scripting-first development workflow that stays fast, flexible, and easy to iterate on.
2. A native compilation path that can turn the same authored content into a compiled application with minimal friction.

The target experience is simple: during development, authors work in Markdown with embedded scripting. When ready, they press a button and get a compiled build.

This document outlines the path from the current Storie web runtime to that model.

## Background

Storie already has the right authoring substrate:

- Markdown is the document format.
- Frontmatter carries configuration and feature declarations.
- Code fences define lifecycle-driven behavior.
- The runtime already parses content into structured sections, code blocks, timed blocks, blobs, shaders, and metadata.

The current implementation executes document code through the SES sandbox. That is the correct choice for development, portability, and safety, especially for untrusted or semi-trusted authored content.

But the sandbox is not the end state for deployable applications.

The previous engine, tStorie, already proved the core idea: Markdown-driven authored apps can compile down into native code. That precedent matters. The goal here is not speculative. The goal is to re-establish that capability in the modern Storie architecture, then push it further beyond the terminal.

## Product Goal

Storie should support three execution modes built from the same authored source:

### 1. Scripted Development Mode

The current model.

- Markdown stays editable.
- JS fences run through the scripting engine.
- Hot reload and rapid iteration stay first-class.
- Dynamic behavior remains maximally flexible.

### 2. Compiled JavaScript App Mode

The near-term compilation target.

- Markdown is compiled ahead of time.
- Script fences become static program units.
- The SES execution path is removed from the shipped app.
- Only the needed Storie runtime features are bundled.
- Output is a deployable web or Tauri app built from generated JS modules.

### 3. OS-Native Compiled Mode

The long-term target.

- Markdown compiles into a Storie-defined AST or intermediate representation.
- The OS hosts the runtime directly.
- Script behavior compiles into native OS-understood program structures.
- The same authored app can target a browser-compatible runtime during development and a native OS pipeline for deployment.

The current repository should focus on making mode 2 real in a clean, principled way that naturally evolves into mode 3.

## Core Principle

The compiler should not be a one-off exporter bolted onto the engine.

It should become a first-class stage in the Storie architecture.

That means:

- Parsing should produce stable structured data.
- Document behavior should be representable independently of SES.
- Runtime capabilities should be split into explicit feature packs.
- Script behavior should be compilable into an intermediate form.
- The dev runtime and compiled runtime should share as much semantics as possible.

## What Exists Today

Storie already contains most of the front half of the pipeline:

- Markdown parsing into sections, frontmatter, code blocks, blob blocks, timed blocks, and WGSL blocks.
- Lifecycle-oriented script organization.
- Module declarations via frontmatter.
- A broad runtime capability surface including UI, Worlds, audio, shaders, blobs, GUI, TUI, random, and host APIs.

This means the missing piece is not content understanding. The missing piece is compilation.

More specifically, the missing piece is taking the authored document and converting it into a generated app package with explicit static structure.

## Near-Term Compiler Goal

The first serious compiler target should be:

> Compile a Storie Markdown document into a generated JavaScript application that preserves document behavior without requiring the SES scripting engine at runtime.

That target is ambitious enough to matter and constrained enough to ship.

It avoids trying to solve the full OS-native compilation problem too early, while forcing the architecture to become compiler-friendly.

## Proposed Architecture

The compile pipeline should be organized into distinct stages.

### Stage 1. Parse

Input:

- Markdown source
- Optional included assets or referenced local files

Output:

- Normalized document model

Suggested structure:

- Frontmatter
- Section tree
- Code blocks with lifecycle metadata
- Timed blocks
- Blob blocks
- Shader blocks
- Inline GUI or widget metadata where applicable

This stage already mostly exists.

### Stage 2. Analyze

The compiler should analyze document behavior before generating code.

Analysis outputs should include:

- Which lifecycle hooks are used
- Which runtime capabilities are referenced by scripts
- Which optional modules are declared in frontmatter
- Which assets are embedded or externally referenced
- Whether the document relies on dynamic runtime-only features that compiled mode cannot safely support

Examples of capability buckets:

- terminal
- ui
- gui
- worlds
- audio
- shader
- blobs
- timed
- random
- modules
- host sync
- export

This stage is where Storie starts moving from a monolithic runtime surface toward a compiler-aware runtime surface.

### Stage 3. Lower To An Intermediate Representation

This is the most important architectural step.

Instead of generating final code directly from raw Markdown parse results, the compiler should lower documents into a Storie application IR.

Suggested IR layers:

#### Content IR

Represents:

- sections
- content fragments
- metadata
- timed content
- embedded resources

#### Behavior IR

Represents:

- init/update/render/input/enter/export handlers
- state variables
- event bindings
- section-scoped handlers
- widget interactions
- link actions

#### Capability IR

Represents:

- required runtime packs
- required modules
- required host permissions or OS capabilities

#### Asset IR

Represents:

- blobs
- decoded assets
- shaders
- generated textures or imported files

This IR becomes the bridge between:

- the browser scripting runtime
- compiled JS output
- future OS-native AST output

If this IR is well-designed, Storie can target multiple backends without changing the authoring model.

### Stage 4. Generate Compiled App Code

The JS compiler backend should emit generated source files.

Example generated outputs:

- app.manifest.json
- app.content.json
- app.assets.js
- app.behavior.js
- app.runtime-config.js
- main.js

Possible structure:

```text
generated/
  manifest.json
  content.json
  assets.ts
  behavior.ts
  main.ts
```

The generated behavior module should expose explicit handler functions instead of dynamic string execution.

Example shape:

```ts
export function init(ctx) {}
export function update(ctx, delta) {}
export function render(ctx) {}
export function input(ctx, event) {}
export const enterHandlers = new Map();
```

The compiled runtime then imports those functions normally.

### Stage 5. Bundle

The bundler should receive:

- generated app files
- only the runtime packs required by the analyzed document
- only the declared optional modules required by the document

This is where bundle minimization happens.

## Required Runtime Refactor

To make real compilation possible, Storie needs to stop treating the entire runtime API as one inseparable global blob.

The runtime should be reorganized into explicit capability packs.

Suggested pack breakdown:

- core-document
- core-loop
- terminal
- ui-2d
- gui
- worlds
- audio
- shader
- blobs
- timed
- themes
- random
- modules
- host-sync
- export

Each pack should:

- define its public context surface
- initialize independently when possible
- avoid hidden side effects across unrelated packs
- be importable directly by the compiled backend

In development mode, Storie can still compose these packs into the familiar global scripting API.

In compiled mode, the generator can import only what is needed.

## Script Compatibility Strategy

Current Storie scripts are authored against globals like:

- scope
- ui
- worlds
- audio
- random
- shader
- themes
- modules

That is convenient for authors, but it is not naturally tree-shakeable or compiler-friendly.

The compile pipeline should preserve this authoring model while changing how it is implemented.

### Development Mode

- Keep global-style authoring.
- Keep sandbox execution.
- Keep hot reload semantics.

### Compiled Mode

The compiler should transform those globals into explicit context accesses.

Conceptually:

```js
ui.clear();
worlds.enable();
random.seed();
```

becomes generated behavior that receives a context object:

```ts
export function init(ctx) {
  ctx.ui.clear();
  ctx.worlds.enable();
  ctx.random.seed();
}
```

The author does not need to write that form directly. The compiler does the lowering.

## Persistent State Model

One of the most important current Storie semantics is persistent document scope.

That must survive compilation.

Compiled behavior should therefore receive an explicit state object.

Suggested pattern:

```ts
export function createAppState() {
  return {
    gs: null,
    sections: {},
    _settings: { themeIndex: 0, jitterIndex: 2 }
  };
}
```

Handlers then operate on `ctx.state` instead of relying on SES-managed persistence.

This is the same semantic model, just made explicit.

## Handling Optional Modules

Frontmatter-declared modules are already a strong fit for compilation.

Compiled mode should prefer static inclusion over runtime dynamic loading whenever possible.

For example:

- Development mode: `modules: [babylon]` triggers runtime loading.
- Compiled mode: the compiler emits a bundle that statically includes the Babylon module pack.

This makes startup more deterministic and eliminates a major class of runtime indirection.

Dynamic `modules.load(...)` should either:

- be unsupported in strict compiled mode, or
- require declaration in a compile manifest so the compiler knows what to include.

## Asset Strategy

The compiler should normalize assets into a stable manifest.

Sources include:

- embedded blob blocks
- embedded timed blocks
- embedded shaders
- referenced local files
- declared textures, audio, and images

Compiled outputs should contain:

- a logical asset manifest
- any necessary generated binary or text payloads
- preprocessed shader and timed data where useful

This is especially important for the future OS target, where assets should be addressable through a uniform app package format.

## Button-Click Compilation

The user-facing workflow should eventually become:

1. Author or open a Storie Markdown app.
2. Click Compile.
3. Select target:
   - web app
   - Tauri/native shell
   - OS-native package
4. Receive a packaged build.

The implementation should therefore aim toward a single compiler command with multiple backends.

Suggested shape:

```text
storie compile app.md --target web
storie compile app.md --target tauri
storie compile app.md --target os
```

The button in the future UI should just call the same pipeline.

## Proposed Milestones

### Milestone 1. Establish Compiler Data Model

Deliverables:

- stable compile manifest type
- application IR type definitions
- document analysis pass

Success criteria:

- given a Markdown document, Storie can produce a full structured compile description without running the app

### Milestone 2. Generate Compiled JavaScript Behavior

Deliverables:

- code generation for lifecycle handlers
- explicit state object generation
- explicit context binding generation

Success criteria:

- a non-trivial document can run without SES in generated JS form

### Milestone 3. Split Runtime Into Capability Packs

Deliverables:

- feature-oriented runtime modules
- generated imports based on analysis
- smaller compiled bundles

Success criteria:

- bundle contents differ meaningfully based on document feature usage

### Milestone 4. Add Compile CLI And UI Trigger

Deliverables:

- compile command
- output directory structure
- integration into dev workflow

Success criteria:

- a document author can compile an app without hand-editing generated files

### Milestone 5. Add OS-Oriented Backend

Deliverables:

- IR-to-OS AST lowering
- OS capability manifest generation
- native packaging integration

Success criteria:

- the same authored Markdown app targets the OS-native backend through the same compiler front end

## Suggested Repository Work

The first implementation pass in this repo should likely add:

- a dedicated compiler module under `src/compile/`
- compile IR and manifest types
- a document analyzer for capability detection
- a JS backend that emits generated TypeScript or JavaScript
- a minimal compiled runtime entrypoint

Possible layout:

```text
src/compile/
  analyze.ts
  ir.ts
  manifest.ts
  generate-js.ts
  generate-assets.ts
  compile.ts
```

And perhaps:

```text
scripts/
  compile-app.js
```

## Constraints And Non-Goals

The first compiler does not need to solve everything.

It should not try to:

- compile arbitrary dynamic JavaScript semantics into an OS-native form immediately
- preserve every sandbox-only feature in compiled mode
- infer every possible dynamic dependency perfectly
- replace the development runtime

The initial goal is narrower:

> Make compiled deployment real and useful for a large class of Storie apps.

That is enough to justify the architecture work.

## Why This Matters

Without compilation, Storie risks becoming only a powerful runtime.

With compilation, Storie becomes a real authoring system.

That distinction matters for the broader OS vision. If Storie is meant to be the application layer of an operating system, it cannot depend forever on an interpreted browser-style scripting setup. It needs a path where authored apps become stable compiled artifacts.

The scripting runtime remains essential because it makes Storie usable.

The compiler becomes essential because it makes Storie foundational.

## Immediate Recommendation

The next implementation work should begin with the compiler front end, not the final backend.

Specifically:

1. Define the Storie compile IR.
2. Add document capability analysis.
3. Generate explicit JS lifecycle modules from Markdown code fences.
4. Create a minimal compiled runtime that runs those modules without SES.

If that ships cleanly, the path to pack-level bundling and eventual OS-native AST lowering becomes much clearer.

## Summary

Storie should treat compilation as a primary product capability.

The authored format remains Markdown.
The development model remains scripting-first.
The deployment model becomes compiled.

The short-term backend is compiled JavaScript without the scripting engine.
The long-term backend is OS-native compilation through a custom AST.

That path is consistent with Storie's goals, consistent with the tStorie precedent, and consistent with building an operating system where Storie is both empowered by the platform and the mechanism through which software for that platform is created.