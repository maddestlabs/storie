# Markdown Editing Handoff

## Purpose

This document captures the current state of Storie's canonical markdown-source work and the remaining gap needed to support live markdown editing inside demos such as `worlds-edit.md`.

The short version:

Storie now keeps authored markdown as a canonical runtime string, but the runtime does not yet expose a first-class API for user-authored markdown text edits to reparse and replace the active structured document in place.

That means the following path exists today:

1. markdown source loads into the runtime
2. markdown parses into structured sections / blocks / metadata
3. structured runtime mutations regenerate canonical markdown

But this path does not yet exist as a demo-facing feature:

1. user edits markdown text
2. runtime reparses that markdown
3. active structured document updates immediately

## Current State

### What already exists

- A parsed `MarkdownDocument` now carries `sourceMarkdown`.
- Active runtime documents also carry `sourceMarkdown`.
- The engine exposes the active canonical source string.
- Runtime section-store mutations regenerate the markdown string so save/export paths can use it directly.
- Browser and Tauri save flows now consume that canonical markdown string.

### Relevant code seams

- `src/markdown.ts`
  - `parseMarkdown(source)` returns normalized source via `sourceMarkdown`.
  - `serializeMarkdownDocumentSource(document)` rebuilds markdown from metadata + section tree.

- `src/types.ts`
  - `MarkdownDocument.sourceMarkdown?: string`
  - `UserScript.sourceMarkdown?: string`

- `src/engine.ts`
  - `loadMarkdown(documentId, markdown)` reparses markdown into a fresh active document.
  - `getActiveDocumentSourceMarkdown()` returns the canonical markdown string.
  - runtime section sync updates `sourceMarkdown` after structured mutations.

- `src/sandbox.ts`
  - demos currently have access to structured section editing APIs such as `sections.insert`, `sections.update`, `sections.remove`, and `sections.move`.
  - demos do not yet have a reverse path such as `replaceSourceMarkdown(markdown)`.

- `docs/demos/worlds-edit.md`
  - currently edits the runtime section store directly.
  - it is explicitly described as editing the runtime section store rather than the authored markdown text.

## What is missing

The missing seam is not markdown serialization.

The missing seam is a safe runtime API that lets a demo or editor submit a markdown string and replace or reload the current document from that text.

Today, only this is supported reliably:

- structured edit -> markdown regenerated

What is not yet supported as a first-class editor operation:

- markdown string edit -> structured doc reparse -> active document replacement

## Why this matters

For editor demos such as `worlds-edit.md`, this missing seam is the difference between two editor models.

### Current editor model

- manipulate sections directly through runtime APIs
- export/save current markdown when needed

### Needed editor model

- allow direct editing of authored markdown text
- reparse and update the structured document from that text
- continue using structured runtime APIs for worlds/layout/selection interactions

The second model is a better foundation for true authoring tools because:

- markdown remains the authored source of truth
- exports become trivial
- text-based editing and structured editing can coexist
- demo editors can switch between source mode and visual mode

## Recommended API Direction

The next implementation should add an explicit engine-to-sandbox bridge for replacing active document source markdown.

Preferred shapes:

### Option A: document-centric API

- `doc.sourceMarkdown()`
- `doc.replaceSourceMarkdown(markdown, options?)`

This is the most natural API if the active document is treated as the authoring unit.

### Option B: system-centric API

- `sys.reloadDocumentFromMarkdown(markdown, options?)`

This is acceptable if the operation is considered a host/runtime reload rather than a document mutation.

### Recommended preference

Prefer `doc.replaceSourceMarkdown(...)`.

Reasoning:

- it keeps the mental model attached to the current active document
- it composes better with `doc.sourceMarkdown()`
- it reads naturally in editor demos
- it makes future options like partial validation or cursor-preserving reload easier to explain

## Suggested Behavior Contract

If `doc.replaceSourceMarkdown(markdown)` is implemented, it should do the following:

1. normalize line endings
2. parse markdown through the same `parseMarkdown(...)` pipeline as normal loading
3. rebuild asset stores and handlers exactly like `engine.loadMarkdown(...)`
4. replace the active document's structured representation
5. set the active document's canonical `sourceMarkdown`
6. preserve editor-relevant runtime context when possible

At minimum it should preserve:

- active document identity if feasible
- current section selection if the same section id still exists
- camera position / view state when appropriate for worlds-based editors
- transient editor UI state outside the document itself

If exact preservation is too complex for the first pass, the first version should still be acceptable if it:

- reparses safely
- swaps in the new document
- restores focus to the closest matching section by id or title

## Important Design Constraint

This must not create two independent truths.

The intended model is:

- canonical authored markdown string
- derived structured runtime document

So when `replaceSourceMarkdown(...)` runs, the structured document should be treated as a fresh derivation from the supplied markdown.

That is different from today's structured-mutation path, where markdown is regenerated from the active structure.

Both directions are valid, but each operation should have one clear source of truth:

- text edit path: markdown is authoritative
- visual/structured edit path: runtime structure is authoritative until markdown is regenerated

## Risks To Address

### 1. Section identity churn

If a reparse changes section ids, editor selection and worlds camera focus may jump unexpectedly.

Mitigation:

- preserve explicit section ids when present
- keep section id generation stable
- try to reselect by prior section id first, then title, then nearest index

### 2. Runtime-only state loss

Some demos may hold editor state in JS variables that is not encoded in markdown.

Mitigation:

- keep editor UI state outside document-authored state where practical
- document clearly that reparse replaces authored state, not arbitrary runtime locals

### 3. Reparsing cost during typing

A full reparse on every keystroke may be too expensive or visually disruptive.

Mitigation:

- first pass: explicit apply/reload action
- second pass: debounced live preview
- avoid pretending incremental parsing exists if it does not

### 4. Invalid markdown / parse failures

Editors need failure handling that does not destroy the current working document.

Mitigation:

- parse first
- only swap active document on success
- return structured error information on failure

## Recommended First Implementation

The first implementation should be intentionally narrow.

### Phase 1

- add `doc.replaceSourceMarkdown(markdown)`
- implement it by routing through the engine's existing markdown load path
- preserve current section selection when possible
- return `{ ok, error?, restoredSectionId? }`

### Phase 2

- add a demo that includes a source text editor + apply button
- prove the round-trip:
  - edit markdown text
  - apply
  - structured worlds view updates
  - save/export returns the same canonical markdown

### Phase 3

- add debounced live preview mode if needed
- consider diff-aware or partial update behavior only after the full reload model is stable

## Why This Fits `worlds-edit.md`

`worlds-edit.md` is already the right sandbox for this work because it is focused on authoring and navigation rather than just playback.

The best long-term shape is likely a dual-mode editor:

- source mode: edit raw markdown
- worlds mode: manipulate structured content spatially

Those two modes can share the same canonical source seam:

- source mode writes markdown directly
- worlds mode edits the structure and regenerates markdown

That makes the demo a good proving ground for bidirectional authoring.

## Practical Acceptance Criteria

The next discussion/implementation should be considered successful if all of the following are true:

1. a demo can present editable markdown text for the active document
2. applying edited text reparses and updates the active structured document
3. current section focus is preserved when possible
4. save/export returns the updated markdown string directly
5. parse failure does not destroy the previous active document

## Recommended Discussion Starter

If continuing this in a future conversation, the implementation brief should be:

> Add a sandbox-safe active-document API for replacing the canonical markdown source string and reparsing the active document in place, initially with explicit apply/reload semantics and best-effort preservation of worlds selection/focus.

That is the smallest next step that turns the current source-tracking architecture into a real markdown editor foundation.