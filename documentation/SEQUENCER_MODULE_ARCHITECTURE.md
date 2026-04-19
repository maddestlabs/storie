# Sequencer Module Architecture

This note defines the recommended structure for `sequencer.md` as both a standalone Storie document and a reusable sequencing panel inside larger hosts such as `daw.md`.

## Design Goal

The sequencer should be a reusable timeline and arrangement module that can host other modules, especially `stfxr-graph`, without reimplementing instrument editing logic itself.

That means:

- the standalone document is one shell
- the DAW timeline panel is another shell
- the sequencer remains the owner of transport, pattern, and arrangement behavior
- instrument editors remain separate modules mounted by the sequencer or a higher-level host

## Recommended Layering

Current shared extraction target:

- `src/audio/sfx-graph-document.ts` for track instrument document normalization and preset/document serialization
- `src/sequencer/document.ts` for canonical track, pattern, and sequencer document helpers

### 1. Data Types

Define explicit durable and transient shapes.

#### `SequencerDocument`

Canonical song / arrangement data.

Suggested shape:

```ts
type SequencerDocument = {
  version: 1;
  bpm: number;
  stepCount: number;
  tracks: Array<{
    id: string;
    name: string;
    transpose?: number;
    gain?: number;
    volume?: number;
    muted?: boolean;
    solo?: boolean;
    slots: string[];
    instrument?: {
      graphDocument?: SfxGraphDocument;
      graphPreset?: SfxGraphPreset;
    };
  }>;
  patterns: Record<string, {
    id: string;
    name: string;
    notes: Array<{
      id: number;
      row: number;
      start: number;
      length: number;
      velocity?: number;
    }>;
  }>;
};
```

This is the payload that should persist across reloads and move between hosts.

#### `SequencerViewDocument`

Durable UI metadata that a host may want to preserve.

Suggested contents:

- visible pattern step count
- row offset
- note editor open/closed state
- graph panel open/closed state
- mixer rail size
- focused track and pattern ids

This is optional. It should not be mixed into the canonical musical document unless there is a deliberate reason.

#### `SequencerSession`

Ephemeral runtime state owned by the live module instance.

Suggested contents:

- drag state
- tap timing
- live transport counters
- active voices and buses
- piano gate state
- temporary graph editor interaction state

This state should remain local and should not be the persistence format.

### 2. Headless Controller

Create a shared sequencer controller in `src` that owns sequencing behavior independent of UI.

Suggested responsibilities:

- load or serialize a `SequencerDocument`
- manage track / pattern selection
- edit notes, slots, and track metadata
- expose transport state and step timing
- schedule playback events
- coordinate with track instrument documents
- expose derived view models for arranger, note editor, and mixer panels

The controller should not know about:

- retained widgets
- immediate-mode layout code
- markdown document structure
- graph editor widget implementation details

### 3. Panel / Shell Adapters

Build shells over the shared controller rather than letting the standalone markdown file own all behavior directly.

#### Standalone sequencer shell

Use for `sequencer.md`.

Capabilities:

- transport strip
- arrangement grid
- note editor overlay
- mixer / piano strip
- graph editor docking area

#### Embedded DAW shell

Use when sequencer becomes one panel inside `daw.md`.

Capabilities:

- host-managed bounds
- transport controlled by outer DAW when needed
- optional reduced chrome
- shared selection / automation hooks

#### Instrument host adapter

Use for opening a track's graph editor through the shared `stfxr-graph` module contract.

Responsibilities:

- open selected track instrument
- pass `SfxGraphDocument` or `SfxGraphPreset` into the graph editor
- accept graph change events back from the editor
- persist returned instrument data into the active track

## Host Contract

Use a small message contract so the sequencer works the same way cross-window and in-process.

### Inputs to sequencer module

- `openSequencerDocument`: load a `SequencerDocument`
- `replaceFocusedTrackInstrument`: apply a graph document or preset to the focused track
- `transportCommand`: play, pause, stop, or seek
- `setReadonly`: toggle editing
- `setSelection`: focus a track, pattern, or note from the host

### Outputs from sequencer module

- `sequencerDocumentChanged`: arrangement or note data changed
- `sequencerTransportChanged`: transport state changed
- `sequencerSelectionChanged`: track or pattern selection changed
- `trackInstrumentRequested`: user opened a track instrument editor
- `trackInstrumentChanged`: focused track instrument changed

The key rule is that the sequencer is the source of truth for arrangement state, while instrument graph editing is delegated and then folded back into the selected track.

## Ownership Rules

Keep ownership strict.

- Sequencer module owns musical arrangement and transport behavior.
- Graph module owns graph editing behavior.
- Outer host owns cross-module layout, persistence policy, and top-level orchestration.
- Audio engine owns voice creation, playback timing, and compiled graph execution.

This prevents the sequencer from becoming a second graph editor implementation.

## Recommended Extraction Order

### Phase 1

Extract from `docs/demos/sequencer.md` into shared `src` modules:

- pattern and track document helpers
- transport helpers
- note editing actions
- arrangement edit actions
- track instrument document helpers

### Phase 2

Refactor `sequencer.md` to consume the shared controller while keeping the current standalone behavior intact.

### Phase 3

Replace the local track graph editor state (`graphPreset`, `graphText`, parser/reset helpers, widget flow) with the shared `stfxr-graph` module contract.

### Phase 4

Promote the sequencer into `daw.md` as a panel shell rather than copying sequencer behavior into the DAW document.

### Phase 5

Add `host.send(...)` / `host.on(...)` messaging so the sequencer can run:

- as a standalone document
- as a host for a separate graph-editor window today
- as an in-process panel later

## Why This Is The Optimal Next Step

The current structural risk is that `sequencer.md` already mixes three concerns in one file:

- arrangement and note editing
- transport and playback orchestration
- track instrument graph editing

The first two belong here. The third should be hosted here, but not reimplemented here.

By making that boundary explicit now, future extraction work has one coherent target and can converge with the `stfxr-graph` module architecture instead of drifting away from it.