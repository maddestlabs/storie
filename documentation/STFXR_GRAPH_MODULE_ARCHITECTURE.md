# STFXR Graph Module Architecture

This note defines the recommended structure for `stfxr-graph` as both a standalone Storie document and a reusable module inside larger hosts such as `sequencer.md` and `daw.md`.

## Design Goal

The graph editor should exist once in the codebase and be wrapped by multiple shells.

That means:

- the standalone document is one shell
- the sequencer track editor is another shell
- the DAW instrument / bus / FX editor is a third shell

The underlying graph behavior, data model, validation, layout, and edit operations should not be reimplemented per host.

## Recommended Layering

Current shared extraction target:

- `src/audio/sfx-graph-document.ts` for durable graph document and instrument-document helpers

### 1. Data Types

Define three explicit types and keep them separate.

#### `SfxGraphPreset`

Canonical synth data used by playback.

Suggested shape:

```ts
type SfxGraphPreset = {
  vars?: Record<string, unknown>;
  nodes: Array<Record<string, unknown>>;
  edges: Array<Record<string, unknown>>;
  events?: Array<Record<string, unknown>>;
};
```

This is the payload that sequencer tracks, DAW instruments, and future reusable presets should store and render.

#### `SfxGraphDocument`

Editor-oriented document that includes preset data plus durable layout metadata.

Suggested shape:

```ts
type SfxGraphDocument = {
  version: 1;
  preset: SfxGraphPreset;
  layout?: {
    nodes?: Record<string, { x: number; y: number }>;
    camera?: { x: number; y: number; zoom?: number };
    groups?: Array<Record<string, unknown>>;
  };
  meta?: {
    name?: string;
    tags?: string[];
  };
};
```

Hosts should persist this when they want graph layout, grouping, or editor organization to survive reloads.

#### `SfxGraphEditorSession`

Ephemeral runtime state owned by the mounted editor instance.

Suggested contents:

- selected node id
- hovered node id
- active drag mode
- splitter width
- text selection binding
- parse status
- dirty state for pending edits

This state should not be part of saved track or project data unless a host explicitly opts in.

### 2. Headless Controller

Create a shared controller in `src` that owns graph behavior independent of UI.

Suggested responsibilities:

- load a preset or document
- normalize graph data
- validate references and topology
- compute or reset auto layout
- move nodes and update layout metadata
- select nodes and expose derived inspector state
- serialize preset-only output
- serialize full document output
- expose a view model for rendering

The controller should not know about:

- retained widgets
- immediate-mode draw calls
- markdown documents
- host transport APIs

This is the main seam that prevents standalone and embedded variants from drifting.

### 3. Renderer / Shell Adapters

Build thin shells over the same controller.

#### Standalone shell

Use for `stfxr-graph.md`.

Capabilities:

- toolbar
- Play button
- JSON inspector
- numeric retarget slider
- status area

#### Embedded editor shell

Use for `sequencer.md` and later `daw.md`.

Capabilities:

- host-managed sizing
- optional toolbar
- optional inspector visibility
- graph canvas plus selection / update notifications

#### Compact preview shell

Use later for track strips, preset browsers, sends, buses, or automation targets.

Capabilities:

- read-only graph preview
- highlight selected node or changed path
- minimal controls

## Host Contract

Use one small, explicit message contract regardless of whether the transport is cross-window or in-process.

### Inputs to graph module

- `openDocument`: load a `SfxGraphDocument`
- `openPreset`: load a `SfxGraphPreset`
- `setReadonly`: toggle editing
- `setSelection`: focus a node from the host
- `requestAudition`: ask the module to audition current state

### Outputs from graph module

- `documentChanged`: full `SfxGraphDocument` changed
- `presetChanged`: canonical `SfxGraphPreset` changed
- `selectionChanged`: selected node changed
- `validationChanged`: graph validation or parse status changed
- `auditionRequested`: user pressed Play inside the module

The most important output is `presetChanged`. That is the stable payload that sequencer tracks, DAW channels, buses, and effect slots should consume.

## Ownership Rules

Keep ownership strict.

- Graph module owns editing behavior.
- Host owns persistence, undo integration across modules, transport, routing, and layout around the panel.
- Audio engine owns playback and compiled graph execution.

This avoids coupling the graph editor to any one host's transport or project model.

## Recommended Extraction Order

### Phase 1

Extract from `docs/demos/stfxr-graph.md` into shared `src` modules:

- graph normalization helpers
- topology / layout helpers
- document serialization helpers
- validation helpers
- editor action functions

Do not start with GUI modernization. Separate graph behavior from shell code first.

### Phase 2

Refactor `stfxr-graph.md` to consume the shared controller while preserving current behavior.

Success condition:

- same demo behavior
- less inlined logic
- shared data model established

### Phase 3

Refactor `sequencer.md` to replace local `graphPreset` / `graphText` ownership with the shared graph module contract.

This is where the duplication starts paying down immediately.

### Phase 4

Refactor `daw.md` to use the same module for:

- instrument graphs
- insert FX graphs
- send / return graphs
- bus graphs

### Phase 5

Add `host.send(...)` / `host.on(...)` messaging so the same graph module can run:

- as a separate window today
- as an in-process panel later

## Why This Is The Optimal First Step

The current risk is not that `stfxr-graph.md` lacks features. The risk is structural duplication.

Today:

- `stfxr-graph.md` is a full standalone editor
- `sequencer.md` carries separate graph editor state and JSON handling
- `daw.md` carries separate graph editor state and JSON handling

If that continues, each host will drift in validation, layout handling, editor affordances, and saved document shape.

The correct first move is to define the contract and data boundary clearly so future code extraction has one target.