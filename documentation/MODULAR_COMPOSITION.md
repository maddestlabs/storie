# Modular Composition

## Strategic Context

Storie's long-term goal is full native compilation (via `miniaudio`, `wgpu`, and related
libraries) that eliminates the scripting runtime entirely — a direction already proven by
`tStorie`, the terminal-focused predecessor. The modular composition system described here
is designed to survive that transition: the same document-as-module pattern works in the
browser today and will map cleanly to native panels once the native layer exists.

---

## Core Principle: One Artifact, Three Roles

A Storie `.md` file is simultaneously:

1. **Standalone application** — open `?content=demo:stfxr-graph` and it runs fully  
2. **Composable module** — slot it as a panel inside another app, sharing GPU device,
   atlas, audio context, and compositor layers  
3. **Human-readable source** — composition metadata lives in frontmatter; no separate
   build artifact exists

No existing toolset delivers all three from the same file. Micro-frontend frameworks
(Single-SPA, Module Federation) require different build artifacts for the shell vs. the
module. Node-graph environments (Max/MSP, TouchDesigner) are not deployable as public
webpages. Observable notebooks have no GPU/audio sharing. Storie's SES sandbox layer adds
bounded trust: a module from a different author can be slotted into your app without
granting it full host privileges.

---

## Two-Phase Development Workflow

### Phase 1 — Cross-Window (build and validate today)

Each module runs as an independent browser window connected via `BroadcastChannel`.

```
?content=sequencer&host=chan1&role=host      ← orchestrator window
?content=stfxr-graph&host=chan1&role=client  ← editor panel window
```

Modules communicate through the sandbox `host` API:

```js
// sender
host.send({ kind: 'graphEdit', trackId, preset });

// receiver
host.on('message', ({ payload }) => {
  if (payload.kind === 'graphChange') applyPreset(payload.preset);
});
```

Cross-window communication uses `BroadcastChannel` under the hood — same-origin,
same browser profile. Works across tabs and windows identically.

**This phase validates the module contract before any engine investment.**

### Phase 2 — Single-Window Panels (promote once patterns are stable)

The same `host.send` / `host.on` API works unchanged. The transport switches from
`BroadcastChannel` to an in-process event bus. Modules share:

- GPU device and texture atlas (no duplicate font rasterization)
- `AudioContext` (no separate audio graphs, no cross-origin timing issues)
- Compositor layers (z-ordering, opacity, and resize between panels)
- SES compartment pool (faster startup, shared lockdown)

The engine already has the infrastructure: `documentId`-scoped blob/image stores,
a `Compositor` with named layers, `WebGPUUIRenderer` per layer. The missing piece is
a panel-host that instantiates multiple sandboxes against the same device and routes
messages between them.

---

## Module Contract Convention (emerging)

As real cross-module integrations harden, a frontmatter convention will emerge. Current
direction:

```yaml
---
name: "STFXR: Graph Viewer"
exports: [audioGraph, currentPreset]   # what this module publishes
accepts: [audioGraph]                   # what it can receive from a host
---
```

The engine will eventually wire compatible modules automatically when loaded as panels.
Until that infrastructure exists, contracts are enforced by convention in demo code.

---

## Known Working Cross-Module Pairs

| Host | Module | Payload |
|------|--------|---------|
| `sequencer.md` | `stfxr-graph.md` | `SfxGraphPreset` JSON per track |
| `worlds-edit.md` | `edit.md` (planned) | full markdown source string |

---

## What Requires Engine Work

| Capability | Status |
|---|---|
| `BroadcastChannel` transport | ✅ exists (`host-sync.ts`) |
| `host.isHost` / `host.isClient` | ✅ exists |
| `worlds.sections.update()` per section | ✅ exists |
| `gui.createTextEditor` | ✅ exists |
| `host.send(payload)` / `host.on(cb)` sandbox API | ❌ needs adding (~30 lines in `host-sync.ts` + engine sandbox) |
| `worlds.document.setSource(markdown)` full hot-swap | ❌ needs adding (moderate) |
| Engine panel-host (multiple sandboxes, one device) | ❌ future work |
| `exports` / `accepts` frontmatter auto-wiring | ❌ future work |

---

## Relationship to Native Target

When the engine compiles natively:

- `BroadcastChannel` → IPC between native windows (same process or named pipe)
- In-process event bus → direct function calls between native panels
- The `.md` source → either interpreted at runtime or compiled to a native scene graph

The `host.send` / `host.on` API is the stable abstraction layer that insulates module
code from which transport is active. Module authors write the same code regardless of
whether the runtime is browser, Tauri webview, or fully native.
