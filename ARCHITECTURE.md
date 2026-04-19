# Engine Scripting Architecture: Language-Agnostic API Design

## Core Concept

The scripting layer of this engine is designed as a **language-agnostic projection** of the engine API. Rather than treating the host language (currently JavaScript) as the scripting language, the API surface itself is the scripting language — the host is just notation.

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
