---
name: "Worlds Story Editor (Depths)"
theme: "solarlight"
fontsize: 22
font: "Special+Elite"
shaders: "blurgradual+lightvignette"
---

A first-pass **Worlds authoring demo** for branching story content.

- Left: outline + camera helpers
- Center: walk the story in 3D
- Right: edit the selected section's title, metadata, and markdown body

> This demo edits the current document's runtime section store. It is intentionally focused on the editing workflow first; file save-back can layer on top later.

```js
let state = {
  sections: [],
  selectedSectionId: null,
  selectedSectionIndex: null,
  loadedSectionId: null,
  dirty: false,
  mouseDownLeft: false,
  lastWorldSection: null,
  statusText: 'Ready',
  widgets: null,
  layouts: null,
  draft: {
    title: '',
    directiveText: '{}',
    content: ''
  }
};

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function directiveToText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '{}';
  const keys = Object.keys(value);
  if (keys.length === 0) return '{}';
  try {
    return JSON.stringify(value);
  } catch {
    return '{}';
  }
}

function parseDirectiveText(text) {
  const raw = String(text ?? '').trim();
  if (!raw || raw === '{}') return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Directive must be a JSON object.');
  }
  return parsed;
}

function buildOutlineMarkdown() {
  const lines = [
    '## Sections',
    '',
    'Click a Worlds card or an outline link to edit that section.',
    ''
  ];

  for (const section of state.sections) {
    const indent = '  '.repeat(Math.max(0, Number(section.level || 1) - 1));
    const prefix = section.sectionId === state.selectedSectionId ? '> ' : '- ';
    const title = safeText(section.title, '(untitled)');
    lines.push(`${indent}${prefix}[${title}](section:${section.sectionId})`);
  }

  return lines.join('\n');
}

function updateOutline() {
  if (!state.widgets?.outline) return;
  state.widgets.outline.setMarkdown(buildOutlineMarkdown());
}

function refreshSections() {
  state.sections = worlds.sections.list();
  updateOutline();
  if (state.widgets?.sectionCount) {
    state.widgets.sectionCount.setText(`${state.sections.length} sections`);
  }
}

function syncDraftFromWidgets() {
  if (!state.widgets) return;
  state.draft.title = String(state.widgets.titleField.getValue() ?? '');
  state.draft.directiveText = String(state.widgets.directiveField.getValue() ?? '{}');
  state.draft.content = String(state.widgets.contentEditor.getValue() ?? '');
}

function syncWidgetsFromDraft() {
  if (!state.widgets) return;
  state.widgets.titleField.setValue(state.draft.title);
  state.widgets.directiveField.setValue(state.draft.directiveText);
  state.widgets.contentEditor.setValue(state.draft.content);
}

function updateHeader() {
  if (!state.widgets?.editorHeader) return;
  const title = safeText(state.draft.title, '(untitled)');
  const suffix = state.dirty ? ' · draft' : '';
  state.widgets.editorHeader.setText(`Editing: ${title}${suffix}`);
}

function setStatus(text) {
  state.statusText = String(text ?? '');
  if (state.widgets?.status) state.widgets.status.setText(state.statusText);
}

function loadSection(selector, focusCamera) {
  const section = worlds.sections.get(selector);
  if (!section) return false;

  state.selectedSectionId = section.sectionId;
  state.selectedSectionIndex = section.sectionIndex;
  state.loadedSectionId = section.sectionId;
  state.lastWorldSection = section.sectionIndex;
  state.draft.title = String(section.title ?? '');
  state.draft.directiveText = directiveToText(section.directive);
  state.draft.content = String(section.content ?? '');
  state.dirty = false;

  syncWidgetsFromDraft();
  updateHeader();
  updateOutline();

  if (focusCamera) {
    worlds.camera.focusOnSectionFit(section.sectionIndex, 0.9, { keepRotation: true });
  }

  setStatus(`Selected ${safeText(section.title, '(untitled)')}`);
  return true;
}

function applyDraft() {
  if (!state.selectedSectionId) return false;

  syncDraftFromWidgets();

  let directive = {};
  try {
    directive = parseDirectiveText(state.draft.directiveText);
  } catch (error) {
    setStatus(`Directive error: ${String(error?.message ?? error)}`);
    return false;
  }

  const title = safeText(state.draft.title, 'Untitled Section');
  const ok = worlds.sections.update(state.selectedSectionId, {
    title,
    content: state.draft.content,
    directive
  });

  if (!ok) {
    setStatus('Failed to update the selected section.');
    return false;
  }

  refreshSections();
  loadSection(state.selectedSectionId, false);
  setStatus(`Applied changes to ${title}`);
  return true;
}

function revertDraft() {
  if (!state.selectedSectionId) return;
  loadSection(state.selectedSectionId, false);
  setStatus('Reverted draft to the runtime section state.');
}

function selectSection(selector, focusCamera = true) {
  if (state.dirty) applyDraft();
  loadSection(selector, focusCamera);
}

function layoutPanels() {
  if (!state.layouts) return;

  const viewport = gui.getViewportRect();
  const info = gui.getResponsiveInfo(viewport);
  const tokens = gui.getTokens();

  const outer = info.breakpoint === 'xs' ? tokens.spacing.sm : tokens.spacing.lg;
  const leftWidth = info.breakpoint === 'xs' ? 240 : 300;
  const rightWidth = info.breakpoint === 'xs' ? 320 : 420;

  state.layouts.left.fitToViewport(viewport, {
    insetTop: outer,
    insetRight: outer,
    insetBottom: outer,
    insetLeft: outer,
    width: leftWidth,
    height: Math.max(320, viewport.height - outer * 2),
    maxWidth: leftWidth,
    anchorX: 'start',
    anchorY: 'start'
  }, false);

  state.layouts.right.fitToViewport(viewport, {
    insetTop: outer,
    insetRight: outer,
    insetBottom: outer,
    insetLeft: outer,
    width: rightWidth,
    height: Math.max(360, viewport.height - outer * 2),
    maxWidth: rightWidth,
    anchorX: 'end',
    anchorY: 'start'
  }, false);

  state.layouts.left.layout();
  state.layouts.right.layout();
  state.layouts.cameraRow.layout();
  state.layouts.actionRow.layout();
}
```

```js on:init
worlds.presets.apply('story-editor');
worlds.links.setKeyHandlingEnabled(false);

gui.init();

const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 30 }, text: 'Worlds Story Editor', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const subtitle = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 22 }, text: 'Depths Beckon as a content-first authoring surface.', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const sectionCount = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 20 }, text: '0 sections', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnPrev = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Prev Section', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnNext = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Next Section', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnFocus = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Focus Current', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnBirdsEye = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Birds Eye', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const outline = gui.createMarkdownView({ bounds: { x: 0, y: 0, width: 1, height: 320 }, markdown: 'Loading sections...', layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 260 } });

const editorHeader = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'Editing: (none)', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const titleField = gui.createTextField({ bounds: { x: 0, y: 0, width: 1, height: 42 }, value: '', placeholder: 'Section title', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const directiveField = gui.createTextField({ bounds: { x: 0, y: 0, width: 1, height: 42 }, value: '{}', placeholder: '{"rotate-x":17}', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const contentEditor = gui.createTextEditor({ bounds: { x: 0, y: 0, width: 1, height: 320 }, value: '', placeholder: 'Section markdown content', layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 260 } });
const btnApply = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Apply Draft', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnRevert = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Revert', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 36 }, text: state.statusText, align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const cameraRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
cameraRow.addMany([btnPrev, btnNext]);

const actionRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
actionRow.addMany([btnApply, btnRevert]);

const left = gui.createContainer({ bounds: { x: 0, y: 0, width: 300, height: 1 }, padding: 12, gap: 10, alignX: 'stretch', layout: { widthPolicy: 'fixed', heightPolicy: 'fill', minWidth: 0, minHeight: 320 } });
left.addMany([title, subtitle, sectionCount, cameraRow, btnFocus, btnBirdsEye, outline]);

const right = gui.createContainer({ bounds: { x: 0, y: 0, width: 420, height: 1 }, padding: 12, gap: 10, alignX: 'stretch', layout: { widthPolicy: 'fixed', heightPolicy: 'fill', minWidth: 0, minHeight: 360 } });
right.addMany([editorHeader, titleField, directiveField, contentEditor, actionRow, status]);

state.widgets = {
  sectionCount,
  btnPrev,
  btnNext,
  btnFocus,
  btnBirdsEye,
  outline,
  editorHeader,
  titleField,
  directiveField,
  contentEditor,
  btnApply,
  btnRevert,
  status
};

state.layouts = { left, right, cameraRow, actionRow };

refreshSections();
layoutPanels();
loadSection(0, false);
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
setStatus('Editing runtime sections. Click a card or outline link to switch sections.');
```

```js on:input
if (!event) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt'),
    meta: (event.mods || []).includes('meta')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
```

```js on:update
layoutPanels();
gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.titleField.wasChanged() || state.widgets.directiveField.wasChanged() || state.widgets.contentEditor.wasChanged()) {
  syncDraftFromWidgets();
  state.dirty = true;
  updateHeader();
  setStatus('Draft changed. Apply to update the Worlds runtime section.');
}

const outlineLink = state.widgets.outline.popClickedLink();
if (outlineLink && outlineLink.startsWith('section:')) {
  selectSection(outlineLink.slice('section:'.length), true);
}

if (state.widgets.btnPrev.wasClicked() && state.sections.length > 0) {
  const idx = Math.max(0, (state.selectedSectionIndex ?? 0) - 1);
  selectSection(idx, true);
}

if (state.widgets.btnNext.wasClicked() && state.sections.length > 0) {
  const idx = Math.min(state.sections.length - 1, (state.selectedSectionIndex ?? 0) + 1);
  selectSection(idx, true);
}

if (state.widgets.btnFocus.wasClicked() && state.selectedSectionIndex !== null) {
  worlds.camera.focusOnSectionFit(state.selectedSectionIndex, 0.9, { keepRotation: true });
}

if (state.widgets.btnBirdsEye.wasClicked()) {
  if (state.dirty) applyDraft();
  worlds.camera.birdsEye({ view: 'oblique', fill: 0.88, padding: 40 });
  setStatus('Framed the full story layout.');
}

if (state.widgets.btnApply.wasClicked()) {
  applyDraft();
}

if (state.widgets.btnRevert.wasClicked()) {
  revertDraft();
}

const current = worlds.currentSection;
if (typeof current === 'number' && current !== state.lastWorldSection) {
  selectSection(current, false);
}
```

```js on:render
term.layerID = 'default';
term.clear();
```

# Entrance

You stand before the ancient ruins of **Khel-Daran**, a fortress swallowed by time and shadow. The stone archway before you exhales cold, stale air. Moss clings to the weathered pillars, and somewhere deep within, you hear the faint echo of water dripping.

Your torch flickers in the darkness. The adventure begins here.

**What do you do?**

- [Enter the ruins](#hall-of-statues)
- [Examine the entrance more carefully](#entrance-examine)
- [Light a better torch](#prepare-torch)

# Entrance Examine

You take a moment to inspect the entrance more carefully. Ancient runes are carved into the archway, worn smooth by centuries of wind and rain. You can barely make out what appears to be a warning:

*"Beware the guardian of the depths. Only the wise may pass."*

Beside the entrance, you notice an old iron sconce. It's empty, but appears functional.

- [Enter the ruins](#hall-of-statues)
- [Take the sconce](#entrance)
- [Go back](#entrance)

# Prepare Torch

You take time to properly prepare your torch, wrapping it with oil-soaked cloth from your pack. The flame burns brighter now, casting long shadows across the ancient stone.

*You feel more confident with better light.*

- [Enter the ruins](#hall-of-statues)
- [Return to the entrance](#entrance)

# Hall of Statues {"rotate-x": 17}

You step into a vast hall supported by crumbling pillars. **Three stone statues** stand guard, each depicting a different warrior from a forgotten age. Their hollow eyes seem to follow you as you move.

Passages branch off in three directions:

- To the **north**, you hear the sound of rushing water
- To the **east**, a faint blue glow emanates from the darkness
- To the **west**, you smell something acrid and unpleasant

- [Go north toward the water](#underground-river)
- [Go east toward the blue glow](#crystal-chamber)
- [Go west toward the smell](#alchemist-lab)
- [Examine the statues](#examine-statues)
- [Return to entrance](#entrance)

# Examine Statues

You approach the statues carefully. Each warrior is carved in exquisite detail.

The **first statue** holds a sword pointed downward, its face serene.  
The **second statue** clutches a shield, face twisted in rage.  
The **third statue** bears a broken chain, face sorrowful.

At the base of the third statue, you notice something glinting in the torchlight.

- [Take the glinting object](#find-key)
- [Return to the hall](#hall-of-statues)

# Find Key

You reach down and pick up a small, tarnished **brass key**. It's surprisingly heavy for its size, and covered in the same ancient runes you saw at the entrance.

*This might unlock something important.*

[Return to the hall](#hall-of-statues)

# Underground River

The passage opens into a cavern split by a **rushing underground river**. The water is black as ink and moves with frightening speed. A narrow stone bridge crosses the chasm, but it looks ancient and unstable.

On the far side, you can see a doorway carved into the rock.

- [Cross the bridge carefully](#treasure-vault)
- [Search for another way](#search-riverbank)
- [Return to the hall](#hall-of-statues)

# Search Riverbank

You search along the riverbank, looking for another way across. Behind a fallen column, you discover an old rope tied to an iron ring. Following it up, you see it leads to a natural rock shelf that crosses above the river.

A safer path, if you're willing to climb.

- [Take the high route](#treasure-vault)
- [Just use the bridge](#treasure-vault)
- [Go back](#underground-river)

# Crystal Chamber

You follow the blue glow into a chamber filled with **luminescent crystals** growing from the walls and ceiling. They pulse with an eerie inner light, casting everything in shades of azure and violet.

In the center of the room stands a stone pedestal. Resting atop it is a beautiful **silver amulet**, set with a matching blue crystal.

- [Take the amulet](#guardian-chamber)
- [Return to the hall](#hall-of-statues)

# Alchemist Lab

The acrid smell leads you to an old laboratory. Broken glass and ceramic vessels litter the floor. Strange stains mark the walls. Whatever happened here, it wasn't pleasant.

Among the debris, you find a workbench with several intact bottles. One contains a glowing green liquid labeled *"Essence of Light"* in faded script.

- [Take the essence](#guardian-chamber)
- [Search the room more carefully](#guardian-chamber)
- [Return to the hall](#hall-of-statues)

# Guardian Chamber

You enter a vast circular chamber. At its center stands a towering figure of **living stone**. Its eyes glow with ancient intelligence.

Three pedestals surround the guardian, each marked with a symbol: **Sword**, **Shield**, and **Chains**.

- [Choose the Chains pedestal](#ending)
- [Attack the guardian](#ending)
- [Retreat to the hall](#hall-of-statues)

# Treasure Vault

The vault door yields with a deep groan. Beyond it, gold and relics gleam in the torchlight. Yet what lingers most is the sense that the place is watching.

- [Take the treasure](#ending)
- [Leave it untouched](#ending)

# Ending

The depths answer according to what you carried with you: caution, greed, humility, or wonder.

From here, the interesting question is no longer what the player does next, but what the author changes next.