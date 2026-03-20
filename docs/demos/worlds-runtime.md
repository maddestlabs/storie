---
title: "Worlds Runtime Store"
theme: "neotopia"
---

# Worlds Runtime Store

This demo exercises the runtime Worlds section store.

- `N` inserts a new runtime card
- `U` updates the selected runtime card
- `M` moves the selected runtime card to the front
- `V` toggles visibility on the selected runtime card
- `Backspace` or `Delete` removes the selected runtime card
- `Tab` or arrow keys change the selected runtime card
- `Enter` focuses the selected runtime card
- `R` reapplies a fan layout to the runtime cards
- `0` rebuilds the default runtime set

```js
let runtimeIds = [];
let selectedRuntimeIndex = 0;
let nextRuntimeNumber = 1;
let statusLine = 'Press 0 to build the runtime set.';

const RUNTIME_FILL = 0.9;

function makeRuntimeCard(label) {
  return {
    title: `Runtime ${label}`,
    content: [
      `Created at frame ${getFrame()}.`,
      '',
      '- Stable id backed lookup',
      '- Runtime CRUD exercise',
      '- Manual transform overrides should persist across recompiles',
    ].join('\n'),
  };
}

function getRuntimeSection(id) {
  if (!worlds.sections) return null;
  return worlds.sections.get(id);
}

function pruneRuntimeIds() {
  runtimeIds = runtimeIds.filter((id) => !!getRuntimeSection(id));
  if (runtimeIds.length === 0) {
    selectedRuntimeIndex = 0;
  } else if (selectedRuntimeIndex >= runtimeIds.length) {
    selectedRuntimeIndex = runtimeIds.length - 1;
  }
  return runtimeIds;
}

function getSelectedRuntimeId() {
  const live = pruneRuntimeIds();
  if (live.length === 0) return null;
  selectedRuntimeIndex = ((selectedRuntimeIndex % live.length) + live.length) % live.length;
  return live[selectedRuntimeIndex] ?? null;
}

function getSelectedRuntimeSection() {
  const id = getSelectedRuntimeId();
  return id ? getRuntimeSection(id) : null;
}

function focusRuntimeSection(id) {
  if (!id) return;
  worlds.camera.focusOnSectionFit(id, RUNTIME_FILL, { keepRotation: true });
}

function spawnRuntimeCard(label, focus = true) {
  const inserted = worlds.sections.insert(makeRuntimeCard(label));
  if (!inserted) {
    statusLine = `Insert failed for Runtime ${label}`;
    return null;
  }

  runtimeIds.push(inserted.sectionId);
  selectedRuntimeIndex = runtimeIds.length - 1;

  const summary = getRuntimeSection(inserted.sectionId);
  if (summary) {
    worlds.setSectionTransform(summary.sectionIndex, {
      position: { x: (runtimeIds.length - 1) * 48, y: -130, z: -180 },
      rotation: { x: 0, y: 14, z: 0 },
    });
  }

  statusLine = `Inserted ${inserted.sectionId}`;
  if (focus) focusRuntimeSection(inserted.sectionId);
  return inserted.sectionId;
}

function relayoutRuntimeCards() {
  const live = pruneRuntimeIds();
  const center = (live.length - 1) / 2;

  for (let i = 0; i < live.length; i++) {
    const id = live[i];
    const summary = getRuntimeSection(id);
    if (!summary) continue;
    const offset = i - center;
    worlds.setSectionTransform(summary.sectionIndex, {
      position: {
        x: offset * 170,
        y: i % 2 === 0 ? 30 : -45,
        z: -120 - Math.abs(offset) * 12,
      },
      rotation: { x: 0, y: offset * 8, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    });
  }

  statusLine = `Relaid out ${live.length} runtime card${live.length === 1 ? '' : 's'}.`;
}

function rebuildRuntimeSet() {
  if (!worlds.sections) {
    statusLine = 'worlds.sections is unavailable in this build.';
    return;
  }

  const existing = worlds.sections.list().filter((section) => String(section.title || '').startsWith('Runtime '));
  for (let i = existing.length - 1; i >= 0; i--) {
    worlds.sections.remove(existing[i].sectionId);
  }

  runtimeIds = [];
  selectedRuntimeIndex = 0;
  nextRuntimeNumber = 1;

  const alpha = spawnRuntimeCard('Alpha', false);
  const beta = spawnRuntimeCard('Beta', false);
  const gamma = spawnRuntimeCard('Gamma', false);

  if (beta) {
    worlds.sections.update(beta, {
      title: 'Runtime Beta Updated',
      content: [
        'Updated during init.',
        '',
        '- Exercise update()',
        '- Exercise title + content mutation',
      ].join('\n'),
    });
  }

  if (gamma) {
    worlds.sections.move(gamma, { index: 0 });
  }

  runtimeIds = [gamma, alpha, beta].filter(Boolean);
  selectedRuntimeIndex = 0;
  nextRuntimeNumber = 4;
  relayoutRuntimeCards();
  focusRuntimeSection(getSelectedRuntimeId());
  statusLine = 'Rebuilt default runtime cards. Existing transforms should persist through CRUD.';
}

function selectRuntime(delta) {
  const live = pruneRuntimeIds();
  if (live.length === 0) {
    statusLine = 'No runtime cards to select.';
    return;
  }

  selectedRuntimeIndex = ((selectedRuntimeIndex + delta) % live.length + live.length) % live.length;
  const selected = getSelectedRuntimeSection();
  statusLine = selected ? `Selected ${selected.title} (${selected.sectionId})` : 'Selection changed.';
  focusRuntimeSection(getSelectedRuntimeId());
}

function updateSelectedRuntimeCard() {
  const id = getSelectedRuntimeId();
  const summary = id ? getRuntimeSection(id) : null;
  if (!id || !summary) {
    statusLine = 'No runtime card selected for update.';
    return;
  }

  worlds.sections.update(id, {
    title: `${summary.title} *`,
    content: [
      `Updated at frame ${getFrame()}.`,
      '',
      '- Exercise update()',
      `- Previous title: ${summary.title}`,
    ].join('\n'),
  });
  statusLine = `Updated ${id}`;
  focusRuntimeSection(id);
}

function moveSelectedRuntimeCardToFront() {
  const id = getSelectedRuntimeId();
  if (!id) {
    statusLine = 'No runtime card selected for move.';
    return;
  }

  worlds.sections.move(id, { index: 0 });
  runtimeIds = [id, ...runtimeIds.filter((item) => item !== id)];
  selectedRuntimeIndex = 0;
  statusLine = `Moved ${id} to the front.`;
  focusRuntimeSection(id);
}

function toggleSelectedRuntimeVisibility() {
  const summary = getSelectedRuntimeSection();
  if (!summary) {
    statusLine = 'No runtime card selected for visibility toggle.';
    return;
  }

  const layout = worlds.getSectionLayout(summary.sectionIndex);
  if (!layout) {
    statusLine = `No layout found for ${summary.sectionId}`;
    return;
  }

  worlds.setSectionVisible(summary.sectionIndex, !layout.visible);
  statusLine = `${summary.sectionId} visibility -> ${!layout.visible}`;
}

function removeSelectedRuntimeCard() {
  const id = getSelectedRuntimeId();
  if (!id) {
    statusLine = 'No runtime card selected for removal.';
    return;
  }

  worlds.sections.remove(id);
  runtimeIds = runtimeIds.filter((item) => item !== id);
  if (selectedRuntimeIndex >= runtimeIds.length) {
    selectedRuntimeIndex = Math.max(0, runtimeIds.length - 1);
  }
  statusLine = `Removed ${id}`;

  const nextId = getSelectedRuntimeId();
  if (nextId) {
    focusRuntimeSection(nextId);
  }
}
```

```js on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.config.setDefaults({
  sectionTextureMode: 'webgpu-ui',
  defaultSectionWidth: 66,
  defaultSectionHeight: 24,
});

worlds.camera.setPosition(0, 10, 260);
worlds.camera.setRotation(-0.04, 0.05, 0);
worlds.camera.setEaseSpeed(0.08, 0.12);

if (!worlds.sections) {
  statusLine = 'worlds.sections is unavailable in this build.';
} else {
  rebuildRuntimeSet();
}
```

```js on:render
term.clear();
term.write(0, 0, 'Worlds Runtime Store Demo');
term.write(0, 2, `Worlds enabled: ${worlds.enabled ? 'yes' : 'no'}`);
term.write(0, 3, `Runtime cards: ${pruneRuntimeIds().length}`);

const selected = getSelectedRuntimeSection();
term.write(0, 5, selected ? `Selected: ${selected.title}` : 'Selected: none');
term.write(0, 6, selected ? `Section id: ${selected.sectionId}` : 'Section id: -');
term.write(0, 7, statusLine.slice(0, Math.max(0, termWidth - 1)));

term.write(0, 9, 'N new  U update  M move-front  V toggle  Backspace remove');
term.write(0, 10, 'Tab/arrows select  Enter focus  R relayout  0 reset');

const live = pruneRuntimeIds();
for (let i = 0; i < Math.min(live.length, 6); i++) {
  const summary = getRuntimeSection(live[i]);
  if (!summary) continue;
  const prefix = i === selectedRuntimeIndex ? '>' : ' ';
  const line = `${prefix} ${summary.sectionIndex}: ${summary.title}`;
  term.write(0, 12 + i, line.slice(0, Math.max(0, termWidth - 1)));
}
```

```js on:input
if (event.type !== 'keydown') return;
if (!worlds.sections) return;

if (event.key === 'Tab' || event.key === 'ArrowRight' || event.key === 'ArrowDown') {
  selectRuntime(1);
  return;
}

if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
  selectRuntime(-1);
  return;
}

if (event.key === 'Enter') {
  focusRuntimeSection(getSelectedRuntimeId());
  return;
}

if (event.key === 'n' || event.key === 'N') {
  spawnRuntimeCard(String(nextRuntimeNumber));
  nextRuntimeNumber += 1;
  return;
}

if (event.key === 'u' || event.key === 'U') {
  updateSelectedRuntimeCard();
  return;
}

if (event.key === 'm' || event.key === 'M') {
  moveSelectedRuntimeCardToFront();
  return;
}

if (event.key === 'v' || event.key === 'V') {
  toggleSelectedRuntimeVisibility();
  return;
}

if (event.key === 'Backspace' || event.key === 'Delete') {
  removeSelectedRuntimeCard();
  return;
}

if (event.key === 'r' || event.key === 'R') {
  relayoutRuntimeCards();
  return;
}

if (event.key === '0') {
  rebuildRuntimeSet();
}
```

# Runtime Control Desk

This authored card stays in the markdown source.

Use the terminal overlay to mutate the runtime section store and compare authored sections against procedurally created ones.

# What To Watch

The runtime cards should let you verify four things quickly.

- string selectors can resolve by stable section id
- inserted cards can be updated, moved, hidden, and removed
- camera focus can target runtime-created sections
- manual transform overrides should persist across store recompiles

# Static Reference

If a runtime action forces a store rebuild, this authored card should remain stable while the spawned runtime cards keep their ids and their last manual transforms.