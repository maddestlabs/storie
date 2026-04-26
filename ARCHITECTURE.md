# Engine Scripting Architecture: Language-Agnostic API Design

## Core Concept

The scripting layer of this engine is designed as a **language-agnostic projection** of the engine API. Rather than treating the host language (currently JavaScript) as the scripting language, the API surface itself is the scripting language — the host is just notation.

This API direction now has a runtime consequence as well: the stricter and more analyzable the authored scripting model becomes, the more feasible it is for the compiler to assemble outputs from a tiny kernel plus only the capability packs and modules an app actually uses. See [documentation/MINIMAL_RUNTIME_ARCHITECTURE.md](documentation/MINIMAL_RUNTIME_ARCHITECTURE.md).

It also has a backend consequence: if Storie is expected to compile toward Nim in the long term, then JavaScript must remain a host notation and implementation layer rather than the semantic definition of authored behavior. See [documentation/NIM_COMPILATION_CONSIDERATIONS.md](documentation/NIM_COMPILATION_CONSIDERATIONS.md).

This means user scripts are constrained to a minimal subset of the host language:

- Data literals (objects, arrays, strings, numbers)
- Variable bindings (`const`, `let`)
- Function definitions (callbacks/handlers)
- Calls into the engine API

No standard library usage. No control flow beyond what the API provides. No host language idioms.

## Why This Works

If user scripts only ever contain data, bindings, and API calls, they form an **implicit intermediate representation** that happens to be expressed in JS syntax. The semantic content of any script lives entirely in the API calls — the host language is just the carrier.

This makes the gap between a JS-hosted dialect and any other scripting language purely **syntactic**, not semantic. A transpiler between them becomes a mechanical translation problem rather than a full language port.

## API Completeness as a Design Constraint

For this architecture to hold, the API must be expressive enough that users never need to reach for raw host language features as an escape hatch. Gaps in the API become walls, not inconveniences.

The design principle is: **if a user need can't be met by the API, extend the API — don't expose host language features.**

Common loop/control patterns are replaced by API-provided equivalents:

| Host language feature | API equivalent |
|---|---|
| `for` / `while` loops | `forEach`, `map`, `filter`, `repeat(n, fn)` |
| `async` / `await` / Promises | `onUpdate(fn)`, `after(ms, fn)`, `onEvent(type, fn)` |
| Error handling | Internal routing; callback-based error surface |
| State management | Reactive/observable primitives exposed through API |

## SES as Enforcement

The engine uses SES (Secure ECMAScript) for sandboxed scripting. SES reinforces this architecture by making unreachable APIs genuinely unreachable — the constraint is enforced at runtime, not just by convention. Scripts can be additionally linted/validated at load time to warn when users reach for features the API already covers.

## Lineage and Motivation

The previous iteration of this engine was terminal-based, written in Nim, with a custom scripting dialect (Nimini) that transpiles to native Nim. Users got the feel and ease of scripting with native performance underneath.

The current engine targets the web stack (WebGPU + WebAudio, TypeScript). The goal is to reproduce that same scripting feel: a constrained, ergonomic surface that doesn't expose the underlying platform complexity.

## The Re-Convergence Path

Because user scripts are constrained to API calls and minimal host syntax, the path back to native compilation is preserved:

1. The JS API surface is defined and stabilized
2. An equivalent native API is implemented with matching shape and naming
3. Nimini (or equivalent) is implemented to emit calls into the native API
4. User-facing scripts require zero or minimal changes

The engine API becomes the **true specification**. The scripting language — whether JS-hosted or Nim-hosted — is a notation for invoking it.

This is the key architectural property: the scripting layer is a *projection* of the API onto whatever host language is currently convenient, not a commitment to that host language.

The near-term product consequence is that Storie should not ship the whole runtime by default once a document is compiled. It should ship a minimal kernel and only the capability slices implied by the authored source.

## Current Architectural Consequences

For that direction to become real in this repository, several architectural consequences need to be treated as design requirements rather than future cleanup.

### 1. The authored API contract cannot remain a single ambient runtime object

Development mode can continue projecting a convenient global-style surface into the sandbox.

But the architectural contract should increasingly be defined as named capability interfaces:

- state
- lifecycle
- input
- terminal
- ui
- gui
- worlds
- audio
- shader
- assets
- host
- export

That distinction matters because the compiler can only assemble minimal outputs if it knows which capability interfaces an app actually depends on.

### 2. Ambient globals should be treated as a compatibility projection

The sandbox can still expose broad globals for development convenience.

However, those globals should no longer be considered the semantic source of truth. They should be understood as a dev-facing projection over narrower capability contracts. Compiled mode should depend on those narrower contracts directly.

This is already becoming concrete in the repository: the shared capability installer now defines compile-visible seams such as `audioContextRuntime`, `audioAssetDecoder`, `audioBufferFactory`, `audioExportCapture`, `stfxrDocumentStore`, and `stfxrBakedStore`. The ambient engine API can still project those services for dev mode, but compiled outputs should treat the named seams as the contract.

### 3. The current engine is not the future minimal kernel

The current engine remains an important development host, but it should not be mistaken for the eventual minimal compiled runtime.

The future kernel should be smaller in scope and should not assume:

- SES
- the full sandbox API
- the full renderer stack
- WebGPU
- GUI
- Worlds
- audio
- dynamic module loading

Those should be layered above the kernel as optional capability packs.

### 4. Package entrypoints should reflect capability boundaries

The package root can remain broad for compatibility.

But the architectural direction should favor stable subpath entrypoints for:

- the compile front end
- the minimal kernel
- capability packs
- domain modules

If consumers and generated output continue importing the compatibility root by default, the architecture will keep drifting back toward a monolith.

### 5. Runtime modules, domain modules, and document modules must stay distinct

Storie uses the word "module" for several different things.

The architecture should keep these separate:

- runtime modules: optional host/runtime integrations
- domain modules: reusable authored systems such as sequencer or graph tooling
- document modules: Markdown artifacts with explicit contracts

Those categories should compile and package differently. If they remain blurred, minimal app assembly will stay conservative and oversized.

### 6. The proving standard is omission, not only lazy loading

Lazy-loading a feature in development mode is useful, but it is not the same as making that feature omittable from a compiled app.

The architectural bar for a subsystem should now be:

1. the compiler can detect that the subsystem is required
2. the compiled output can exclude it entirely when it is not required

If a subsystem only satisfies the first condition, the modularization work is still incomplete.

The practical intermediate standard is narrower than full omission but stricter than today's ambient host object: if a surface still depends on the host, that dependency should at least be named as an explicit runtime adapter so compiled output stops depending on hidden engine-owned state.
