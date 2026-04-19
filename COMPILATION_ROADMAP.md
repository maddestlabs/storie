# Storie Compilation Roadmap

## Purpose

Storie is not meant to stop at being a browser runtime with a clever sandbox.

The long-term target is an environment where authored Storie applications can:

1. stay fast and pleasant to iterate on during development
2. compile into deployable applications without carrying the scripting engine forever
3. eventually target an OS-native runtime without changing the authored model

That requires a change in emphasis.

The main problem is not "how do we compile more JavaScript?"

The main problem is "how do we make Storie scripts depend less on host-language semantics, and more on the Storie API itself?"

This roadmap describes that shift.

## Architectural Decision

Storie should treat the engine API as the real scripting language.

JavaScript is currently only the notation used to write it.

That means the compilation strategy is no longer:

- preserve as much arbitrary JavaScript behavior as possible
- bolt a compiler onto the side later

Instead, the strategy becomes:

- define a constrained Storie scripting profile
- make the API expressive enough that authors stay inside it
- represent authored behavior as Storie semantics first
- lower those semantics to multiple backends

This is consistent with the engine direction described in `ARCHITECTURE.md`:

- the API surface is the scripting language
- the host language is incidental
- gaps should be solved by extending the API, not exposing more host features

## Product Goal

Storie should support three execution modes built from the same authored source.

### 1. Scripted Development Mode

The authoring workflow remains Markdown-first and fast.

- Markdown stays editable
- lifecycle blocks stay first-class
- hot reload stays first-class
- SES remains useful for safety and iteration
- development mode may be permissive, but it should increasingly validate against the compile model

### 2. Compiled JavaScript App Mode

This is the near-term target.

- Markdown is parsed and analyzed ahead of time
- behavior is lowered into explicit program units
- runtime state becomes explicit
- capability usage becomes explicit
- shipped apps do not require the SES scripting engine
- output can target web or Tauri packaging

### 3. OS-Native Compiled Mode

This is the long-term target.

- the same authored source lowers into a Storie-defined intermediate form
- the OS runtime provides Storie capabilities directly
- authored behavior maps to native structures instead of browser scripting machinery
- the authored model stays recognizable across all targets

The core objective for this repository is to make mode 2 real in a way that naturally evolves into mode 3.

## New Core Principle

The compiler is not an export feature.

It is the discipline that should shape the runtime.

Every major Storie subsystem should now be evaluated with this question:

> Does this make authored behavior more obviously representable as Storie semantics, or does it make the engine more dependent on JavaScript tricks?

If a feature relies on more sandbox rewriting, more implicit scope magic, or more host-language cleverness, it is moving in the wrong direction unless it is temporary and on a path to removal.

## What Must Change

Storie currently has the front half of the compile pipeline:

- Markdown parsing
- frontmatter extraction
- lifecycle-oriented code fences
- timed blocks
- blob blocks
- WGSL extraction
- a broad runtime capability surface
- an early compiler scaffold under `src/compile/`

What is still too JS-centric is the execution model.

Today, a meaningful amount of behavior depends on:

- implicit persistence of top-level variables
- sandbox transforms and rewrites
- lifecycle wrapper generation
- global-object style runtime exposure
- user scripts carrying more state semantics than they should

That is acceptable for development ergonomics in the short term, but it should no longer be treated as the design center.

## The Direction

The next stage of Storie should make the scripting engine thinner and the API stronger.

The intended end state is:

- authors write small, clear, API-centered scripts
- scripts look closer to Scratch or Nimini than to advanced browser JavaScript
- state is explicit
- lifecycle behavior is explicit
- capability use is explicit
- compilation is a normal execution path, not a special case

## Storie Script Profile v1

Storie should define and progressively enforce a constrained scripting profile.

This profile is the real authored language, even when written in JS syntax.

### Allowed shape

- data literals
- object and array construction
- simple variable bindings
- simple function definitions for callbacks and handlers
- calls into Storie API objects
- frontmatter-driven configuration
- lifecycle blocks

### Strongly discouraged or rejected in compile-oriented mode

- dynamic import
- eval or Function constructors
- arbitrary fetch-driven orchestration in user code
- ad hoc async control flow as the primary authoring model
- prototype-heavy or class-heavy abstractions in document scripts
- complex closure tricks used only to preserve state
- user-land dependency injection patterns
- host-environment escape hatches

### Design rule

If authors repeatedly want a host-language feature, that is usually evidence that the Storie API is missing a concept.

The fix should usually be one of:

- a new API method
- a new lifecycle capability
- a new declarative metadata field
- a new intermediate-representation construct

It should not usually be "support more JavaScript semantics in authored content."

## API Completeness As The Main Work

To make thin scripting viable, the API must absorb complexity that authors should not carry themselves.

That includes higher-level solutions for common needs such as:

- repeated actions
- time-based sequencing
- event routing
- state transitions
- widget binding
- section navigation
- asset lookup
- animation and automation
- host communication
- export orchestration

The practical rule is simple:

if user scripts are becoming clever, the API is probably too weak.

## Explicit State Model

One of the most important changes is to stop treating implicit sandbox persistence as the long-term semantic model.

Compiled mode needs explicit state.

Development mode should converge on the same model.

The preferred authored pattern should become a single explicit persistent state object, rather than many magically persisted top-level bindings.

Conceptually:

```js
var state = {
  score: 0,
  currentScene: 'title',
  widgets: null
};
```

Then lifecycle blocks operate on that state through a stable reference.

In compiled mode, this becomes:

```ts
export function createAppState() {
  return {
    score: 0,
    currentScene: 'title',
    widgets: null
  };
}
```

The semantic goal is the same in both modes.

This change reduces reliance on:

- auto-binding transforms
- variable import/export wrappers
- hot-reload-sensitive persistence tricks
- closure recreation hacks

## Lifecycle Model

Lifecycle blocks should be represented as Storie behavior units first, not as loose snippets of JavaScript that the runtime later tries to interpret.

The important lifecycle concepts are already visible:

- global setup
- init
- update
- render
- input
- drop
- export
- enter

The next step is to make those units explicit in the compile pipeline and increasingly explicit in development execution as well.

Each block should be understood as:

- a hook type
- a section scope if relevant
- declared or inferred capability usage
- explicit state interaction
- explicit asset interaction

This is the bridge between dev mode and compiled mode.

## Capability Packs

The runtime must continue moving away from one giant scripting surface and toward explicit capability packs.

Suggested pack layout:

- core-document
- core-state
- core-loop
- input
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

- define a stable public surface
- avoid hidden dependencies on unrelated packs
- initialize as independently as possible
- be importable directly by compiled backends
- be analyzable during compilation

Development mode can still compose these into the familiar author-facing API object.

Compiled mode should import only what is needed.

## Compiler Pipeline

The compile pipeline should be organized into explicit stages.

### Stage 1. Parse

Input:

- Markdown source
- local asset references
- frontmatter configuration

Output:

- normalized document model

This mostly already exists.

### Stage 2. Validate Against The Script Profile

Before generation, the compiler should determine whether authored scripts stay inside the intended Storie profile.

Validation outputs should include:

- unsupported host-language features
- dynamic dependency usage
- non-portable behavior
- API gaps suggested by recurring patterns

This stage should gradually become useful in development mode too.

### Stage 3. Analyze Capabilities

The compiler should detect:

- used lifecycle hooks
- used capability packs
- declared modules
- assets referenced by behavior
- features that require compile restrictions or warnings

The current analyzer scaffold is the start of this, not the finish.

### Stage 4. Lower To Storie IR

This is the most important step.

The compiler should lower authored content into a Storie application IR that separates:

#### Content IR

- sections
- structure
- metadata
- timed content
- document-scoped resources

#### Behavior IR

- lifecycle handlers
- section-scoped behavior
- event bindings
- explicit state access
- widget and interaction bindings

#### Capability IR

- required runtime packs
- module requirements
- host permissions
- export requirements

#### Asset IR

- blobs
- shaders
- decoded resources
- generated resources

If this IR is solid, Storie can support multiple backends without changing the authored model.

### Stage 5. Generate Backend Code

The JS backend should emit explicit modules and explicit runtime entrypoints.

Generated output should resemble:

```text
generated/
  manifest.json
  content.json
  behavior.js
  runtime.js
  main.js
```

The current compiler scaffold already points in this direction and should now be treated as a real architectural foundation.

### Stage 6. Bundle Only What Is Needed

The bundler should receive:

- generated application modules
- required runtime packs only
- required optional modules only
- the asset payload required by the document

This is where compile mode stops behaving like "dev mode with strings removed" and starts behaving like a real product backend.

## Development Mode Strategy

Development mode still matters.

It should remain:

- editable
- hot-reloadable
- forgiving enough for experimentation
- safe for untrusted or semi-trusted content

But development mode should stop diverging from compiled semantics where possible.

That means:

- validate authored scripts against the compile-oriented profile
- steer authors toward explicit state
- prefer API-level helpers over JS cleverness
- preserve the same lifecycle meanings as compiled mode
- keep sandbox transforms on a path toward reduction, not growth

SES remains useful as enforcement and isolation.

It should not remain the semantic definition of Storie applications.

## Compatibility Strategy

Storie should preserve current authored content where practical, but compatibility should be framed carefully.

The goal is not to preserve every sandbox-era trick forever.

The goal is to keep useful authored apps working while converging toward the better model.

Recommended compatibility policy:

### Tier 1. Supported And Preferred

- API-centered scripts
- explicit state object patterns
- straightforward lifecycle handlers
- frontmatter-declared modules
- explicit asset references

### Tier 2. Supported But Transitional

- implicit persistent top-level variables
- global-style access patterns that can be mechanically lowered
- limited existing hot-reload conveniences

These can remain during transition, but should emit guidance where appropriate.

### Tier 3. Not A Compile Contract

- dynamic module graphs discovered only at runtime
- arbitrary JS metaprogramming
- sandbox-specific behavior quirks
- reliance on transform internals
- code that depends on browser-global reachability rather than Storie APIs

These should not define the future architecture.

## Runtime Refactor Priorities

The highest-leverage runtime changes are not glamorous.

They are the ones that remove hidden semantics from the scripting layer.

Priority order:

1. converge on explicit persistent state
2. define and enforce the Storie script profile
3. keep growing the analyzer and warning surface
4. split runtime APIs into true capability packs
5. route more author needs through the API instead of through JS patterns
6. reduce sandbox rewriting that exists only to preserve implicit JS behavior

## Proposed Milestones

### Milestone 1. Define The Storie Script Profile

Deliverables:

- a written script-profile specification
- validation rules for unsupported or discouraged host-language features
- clear author guidance for preferred patterns

Success criteria:

- authors can tell what counts as normal Storie code
- the engine can warn when authored code drifts outside the intended model

### Milestone 2. Make Persistent State Explicit

Deliverables:

- an explicit app-state model for compiled output
- a preferred dev-mode state pattern
- migration guidance away from broad implicit persistence

Success criteria:

- non-trivial apps can use explicit state without extra ceremony
- compile and dev semantics get noticeably closer

### Milestone 3. Strengthen Analysis And IR

Deliverables:

- richer capability analysis
- script-profile validation output
- stable application IR types for content, behavior, capabilities, and assets

Success criteria:

- a document can be fully described without executing it
- unsupported compile behavior is detected before generation

### Milestone 4. Make Compiled JS A Real Runtime Path

Deliverables:

- generated lifecycle modules
- explicit state creation
- compiled runtime adapter
- removal of SES from shipped compiled apps

Success criteria:

- a non-trivial document runs from generated JS output alone

### Milestone 5. Split Runtime Into True Capability Packs

Deliverables:

- pack-oriented runtime modules
- compile-time selected imports
- smaller generated runtime surface per app

Success criteria:

- bundle contents differ substantially based on document usage
- pack boundaries become stable enough to be backend contracts

### Milestone 6. Add Stable Compile Entry Points

Deliverables:

- compile CLI
- output directory structure
- editor or UI trigger
- repeatable packaging targets for web and Tauri

Success criteria:

- authors can compile without hand-editing generated files

### Milestone 7. Add OS-Oriented Lowering

Deliverables:

- IR-to-native-lowering path
- OS capability manifest generation
- native packaging integration

Success criteria:

- the same authored model can target an OS-native runtime through the same front end

## Suggested Repository Work

The repository already contains the beginnings of the compiler front end under `src/compile/`.

That work should continue, but with a clearer architectural mandate.

Near-term implementation work should focus on:

- strengthening `src/compile/analyze.ts` into a real validation and capability pass
- strengthening `src/compile/ir.ts` into the stable application IR contract
- keeping `src/compile/generate-js.ts` focused on explicit modules and explicit state
- keeping `src/compile/compile.ts` as the front-end entry point from Markdown to IR and generated output
- evolving `scripts/compile-app.js` into a stable compile interface

Likely structure:

```text
src/compile/
  analyze.ts
  ir.ts
  manifest.ts
  generate-js.ts
  generate-assets.ts
  validate-profile.ts
  compile.ts
```

Possible adjacent refactors:

- reduce sandbox persistence magic as explicit state becomes normal
- expose cleaner pack boundaries from engine/runtime modules
- add author-facing diagnostics for compile incompatibilities

## Constraints And Non-Goals

The first compiler should not try to:

- compile arbitrary JavaScript semantics into native form
- preserve every sandbox-era convenience indefinitely
- infer every dynamic dependency perfectly
- make compile mode equivalent to unrestricted browser scripting
- replace development mode as an experimentation environment

The first serious goal is narrower and more useful:

> Make compiled deployment real for the class of Storie apps that stay inside the intended Storie scripting model.

That is enough to justify the architectural work.

## Why This Matters

Without this shift, Storie risks becoming a runtime that happens to have an exporter.

With this shift, Storie becomes a real authored system with a stable semantic core.

That distinction matters for the OS vision.

If Storie is meant to become part of an application platform, the authored model cannot be permanently defined by sandboxed JavaScript behavior. It needs a core that:

- is author-friendly
- is portable across backends
- is analyzable ahead of execution
- is implementable natively later

That core should be the Storie API and its intermediate representation.

## Immediate Recommendation

The next implementation work should proceed in this order:

1. write down the Storie script profile explicitly
2. standardize the explicit state model
3. expand compile analysis to validate authored code against that profile
4. keep improving generated JS output as the primary compile backend
5. split runtime APIs into stable capability packs

This keeps the project moving toward a simpler scripting engine, a stronger API contract, and a realistic path to OS-native compilation.

## Summary

Storie should treat the API as the language, and the scripting engine as a temporary host.

The authored format remains Markdown.
The development model remains scripting-first.
The deployment model becomes compiled.

The near-term backend is compiled JavaScript without SES.
The long-term backend is OS-native lowering through the same semantic core.

The crucial move is not to make the sandbox more powerful.

It is to make authored Storie behavior more obviously representable as Storie semantics.
