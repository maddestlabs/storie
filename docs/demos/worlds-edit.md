---
name: "Worlds Editor Lab"
theme: "solarlight"
fontsize: 22
font: "Special+Elite"
shaders: "blurgradual+lightvignette"
---

A dedicated **Worlds editor lab** for building out authoring and navigation.

- A single draggable panel for navigation and editing
- Center: navigate the story in 3D

> This demo edits the current document's runtime section store. It is the sandbox for iterating on the Worlds editor UX.

```js
let state = {
  sections: [],
  selectedSectionId: null,
  selectedSectionIndex: null,
  loadedSectionId: null,
  dirty: false,
  mouseDownLeft: false,
  pointerX: 0,
  pointerY: 0,
  lastWorldSection: null,
  statusText: 'Ready',
  panel: {
    x: 24,
    y: 24,
    width: 440,
    height: 560,
    scale: 1,
    dragging: false,
    scaling: false,
    dragOffsetX: 0,
    dragOffsetY: 0,
    scaleStartX: 0,
    scaleStartY: 0,
    scaleStartValue: 1,
    minWidth: 340,
    minHeight: 360,
    minScale: 0.7,
    maxScale: 1.8,
    resizeHandleSize: 26,
  },
  widgets: null,
  layouts: null,
  logicalBounds: null,
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

function pointInBounds(x, y, bounds) {
  return !!bounds && x >= bounds.x && y >= bounds.y && x < (bounds.x + bounds.width) && y < (bounds.y + bounds.height);
}

function getDeviceViewportRect() {
  const viewport = gui.getViewportRect();
  const deviceWidth = Math.max(1, Number(ui.metrics.canvasWidth || viewport.width || 0));
  const deviceHeight = Math.max(1, Number(ui.metrics.canvasHeight || viewport.height || 0));
  const scaleX = viewport.width > 0 ? deviceWidth / viewport.width : 1;
  const scaleY = viewport.height > 0 ? deviceHeight / viewport.height : 1;
  return {
    x: Math.floor((viewport.x || 0) * scaleX),
    y: Math.floor((viewport.y || 0) * scaleY),
    width: Math.max(1, Math.floor((viewport.width || deviceWidth) * scaleX)),
    height: Math.max(1, Math.floor((viewport.height || deviceHeight) * scaleY)),
  };
}

function getPanelActualWidth() {
  return state.panel.width * state.panel.scale;
}

function getPanelActualHeight() {
  return state.panel.height * state.panel.scale;
}

function getScaledBounds(bounds) {
  return {
    x: state.panel.x + (bounds.x - state.panel.x) * state.panel.scale,
    y: state.panel.y + (bounds.y - state.panel.y) * state.panel.scale,
    width: bounds.width * state.panel.scale,
    height: bounds.height * state.panel.scale,
  };
}

function applyScaledBounds(widget, logicalBounds) {
  const scaled = getScaledBounds(logicalBounds);
  widget.bounds.x = scaled.x;
  widget.bounds.y = scaled.y;
  widget.bounds.width = scaled.width;
  widget.bounds.height = scaled.height;
  if (typeof widget.setRenderScale === 'function') {
    widget.setRenderScale(state.panel.scale);
  }
}

function getScalablePanelWidgets() {
  if (!state.widgets) return [];
  return [
    state.widgets.hintLabel,
    state.widgets.titleField,
    state.widgets.directiveField,
    state.widgets.contentEditor,
    state.widgets.btnPrev,
    state.widgets.btnNext,
    state.widgets.btnFocus,
    state.widgets.btnBirdsEye,
    state.widgets.btnResetView,
    state.widgets.btnToggleControls,
    state.widgets.btnApply,
    state.widgets.btnRevert,
  ];
}

function captureLogicalBounds() {
  state.logicalBounds = {
    hintLabel: { ...state.widgets.hintLabel.bounds },
    titleField: { ...state.widgets.titleField.bounds },
    directiveField: { ...state.widgets.directiveField.bounds },
    contentEditor: { ...state.widgets.contentEditor.bounds },
    btnPrev: { ...state.widgets.btnPrev.bounds },
    btnNext: { ...state.widgets.btnNext.bounds },
    btnFocus: { ...state.widgets.btnFocus.bounds },
    btnBirdsEye: { ...state.widgets.btnBirdsEye.bounds },
    btnResetView: { ...state.widgets.btnResetView.bounds },
    btnToggleControls: { ...state.widgets.btnToggleControls.bounds },
    btnApply: { ...state.widgets.btnApply.bounds },
    btnRevert: { ...state.widgets.btnRevert.bounds },
  };
}

function restoreLogicalBounds() {
  if (!state.logicalBounds || !state.widgets) return;
  for (const widget of getScalablePanelWidgets()) {
    if (typeof widget.setRenderScale === 'function') {
      widget.setRenderScale(1);
    }
  }
  state.widgets.hintLabel.bounds = { ...state.logicalBounds.hintLabel };
  state.widgets.titleField.bounds = { ...state.logicalBounds.titleField };
  state.widgets.directiveField.bounds = { ...state.logicalBounds.directiveField };
  state.widgets.contentEditor.bounds = { ...state.logicalBounds.contentEditor };
  state.widgets.btnPrev.bounds = { ...state.logicalBounds.btnPrev };
  state.widgets.btnNext.bounds = { ...state.logicalBounds.btnNext };
  state.widgets.btnFocus.bounds = { ...state.logicalBounds.btnFocus };
  state.widgets.btnBirdsEye.bounds = { ...state.logicalBounds.btnBirdsEye };
  state.widgets.btnResetView.bounds = { ...state.logicalBounds.btnResetView };
  state.widgets.btnToggleControls.bounds = { ...state.logicalBounds.btnToggleControls };
  state.widgets.btnApply.bounds = { ...state.logicalBounds.btnApply };
  state.widgets.btnRevert.bounds = { ...state.logicalBounds.btnRevert };
}

function getResizeHandleBounds() {
  return {
    x: state.panel.x + getPanelActualWidth() - state.panel.resizeHandleSize,
    y: state.panel.y + getPanelActualHeight() - state.panel.resizeHandleSize,
    width: state.panel.resizeHandleSize,
    height: state.panel.resizeHandleSize,
  };
}

function clampPanelToViewport() {
  const viewport = getDeviceViewportRect();
  const margin = 12;
  const maxScaleX = Math.max(state.panel.minScale, (viewport.width - margin * 2) / state.panel.width);
  const maxScaleY = Math.max(state.panel.minScale, (viewport.height - margin * 2) / state.panel.height);
  state.panel.scale = Math.max(state.panel.minScale, Math.min(state.panel.scale, state.panel.maxScale, maxScaleX, maxScaleY));
  const actualWidth = getPanelActualWidth();
  const actualHeight = getPanelActualHeight();
  state.panel.x = Math.max(margin, Math.min(state.panel.x, viewport.x + viewport.width - actualWidth - margin));
  state.panel.y = Math.max(margin, Math.min(state.panel.y, viewport.y + viewport.height - actualHeight - margin));
}

function updateHintLabel() {
  if (!state.widgets?.hintLabel) return;
  const selectedTitle = safeText(state.draft.title, '(untitled)');
  const mode = worlds.controls.enabled ? 'free-fly on' : 'free-fly off';
  const dirty = state.dirty ? 'draft' : 'live';
  const status = safeText(state.statusText, 'Ready');
  const scaleText = `${state.panel.scale.toFixed(2)}x`;
  state.widgets.hintLabel.setText(`${selectedTitle} | ${dirty} | ${mode} | ${scaleText} | ${status}`);
}

function updateModeButtonStyles() {
  if (!state.widgets?.btnToggleControls) return;
  const enabled = !!worlds.controls.enabled;
  state.widgets.btnToggleControls.buttonStyle.fg = enabled ? ui.colors.rgba(18, 18, 18, 255) : undefined;
  state.widgets.btnToggleControls.buttonStyle.bg = enabled ? ui.colors.rgba(244, 238, 224, 255) : undefined;
  state.widgets.btnToggleControls.buttonStyle.hoverBg = enabled ? ui.colors.rgba(255, 246, 232, 255) : undefined;
  state.widgets.btnToggleControls.buttonStyle.activeBg = enabled ? ui.colors.rgba(226, 214, 192, 255) : undefined;
  state.widgets.btnToggleControls.buttonStyle.borderColor = enabled ? ui.colors.rgba(255, 246, 232, 255) : undefined;
}

function refreshSections() {
  state.sections = worlds.sections.list();
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

function setStatus(text) {
  state.statusText = String(text ?? '');
  updateHintLabel();
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
  worlds.links.setRenderOverlay({ enabled: true, section: section.sectionId, internalOnly: true, thickness: 0.12 });

  syncWidgetsFromDraft();
  updateHintLabel();

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

function resetView() {
  const current = state.selectedSectionIndex ?? 0;
  applyEditorPreset();
  worlds.camera.focusOnSectionFit(current, 0.9, { keepRotation: true });
  setStatus('Reset the editor camera to the story-editor preset.');
}

function applyEditorPreset() {
  worlds.presets.apply('story-editor');
  worlds.camera.setRotation(0, 0, 0);
}

function drawSelectedSectionLinkGuides() {
  canvas2d.clear('rgba(0, 0, 0, 0)');
}

function toggleBuiltInControls() {
  worlds.controls.setEnabled(!worlds.controls.enabled);
  updateModeButtonStyles();
  setStatus(worlds.controls.enabled
    ? 'Free-fly edit mode enabled. Click sections to select, or left-drag to pan and reposition them.'
    : 'Free-fly edit mode disabled. Section clicks focus/navigate again.');
}

function layoutPanels() {
  if (!state.layouts) return;

  clampPanelToViewport();
  restoreLogicalBounds();
  state.widgets.panelBackdrop.bounds.x = state.panel.x;
  state.widgets.panelBackdrop.bounds.y = state.panel.y;
  state.widgets.panelBackdrop.bounds.width = getPanelActualWidth();
  state.widgets.panelBackdrop.bounds.height = getPanelActualHeight();
  state.layouts.panel.setBounds({
    x: state.panel.x,
    y: state.panel.y,
    width: state.panel.width,
    height: state.panel.height,
  }, false);
  state.layouts.panel.layout();
  state.layouts.navRow.layout();
  state.layouts.modeRow.layout();
  state.layouts.actionRow.layout();
  captureLogicalBounds();
  applyScaledBounds(state.widgets.hintLabel, state.logicalBounds.hintLabel);
  applyScaledBounds(state.widgets.titleField, state.logicalBounds.titleField);
  applyScaledBounds(state.widgets.directiveField, state.logicalBounds.directiveField);
  applyScaledBounds(state.widgets.contentEditor, state.logicalBounds.contentEditor);
  applyScaledBounds(state.widgets.btnPrev, state.logicalBounds.btnPrev);
  applyScaledBounds(state.widgets.btnNext, state.logicalBounds.btnNext);
  applyScaledBounds(state.widgets.btnFocus, state.logicalBounds.btnFocus);
  applyScaledBounds(state.widgets.btnBirdsEye, state.logicalBounds.btnBirdsEye);
  applyScaledBounds(state.widgets.btnResetView, state.logicalBounds.btnResetView);
  applyScaledBounds(state.widgets.btnToggleControls, state.logicalBounds.btnToggleControls);
  applyScaledBounds(state.widgets.btnApply, state.logicalBounds.btnApply);
  applyScaledBounds(state.widgets.btnRevert, state.logicalBounds.btnRevert);
  const resizeBounds = getResizeHandleBounds();
  state.widgets.resizeHandle.bounds.x = resizeBounds.x;
  state.widgets.resizeHandle.bounds.y = resizeBounds.y;
  state.widgets.resizeHandle.bounds.width = resizeBounds.width;
  state.widgets.resizeHandle.bounds.height = resizeBounds.height;
  state.widgets.resizeHandle.setRenderScale(state.panel.scale);
}
```

```js on:init
applyEditorPreset();
worlds.links.setKeyHandlingEnabled(false);

gui.init();

const btnPrev = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '<<', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnNext = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '>>', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnFocus = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '☐', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 80 } });
const btnBirdsEye = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '⌕', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 80 } });
const btnResetView = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '↺', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 80 } });
const btnToggleControls = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '✥', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 92 } });
const panelBackdrop = gui.createLabel({ bounds: { x: state.panel.x, y: state.panel.y, width: state.panel.width, height: state.panel.height }, text: '', align: 'left', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(12, 12, 12, 0.3) } });
const hintLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 44 }, text: 'Ready', align: 'left', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(0, 0, 0, 0.22) }, layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const titleField = gui.createTextField({ bounds: { x: 0, y: 0, width: 1, height: 42 }, value: '', placeholder: 'Section title', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const directiveField = gui.createTextField({ bounds: { x: 0, y: 0, width: 1, height: 42 }, value: '{}', placeholder: '{"rotate-x":17}', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const contentEditor = gui.createTextEditor({ bounds: { x: 0, y: 0, width: 1, height: 320 }, value: '', placeholder: 'Section markdown content', layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 260 } });
const btnApply = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Apply', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const btnRevert = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: 'Revert', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 120 } });
const resizeHandle = gui.createLabel({ bounds: { x: 0, y: 0, width: state.panel.resizeHandleSize, height: state.panel.resizeHandleSize }, text: '///', align: 'center', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(255, 255, 255, 0.12) } });

const navRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
navRow.addMany([btnPrev, btnNext]);

const modeRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
modeRow.addMany([btnFocus, btnBirdsEye, btnResetView, btnToggleControls]);

const actionRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
actionRow.addMany([btnApply, btnRevert]);

const panel = gui.createContainer({ bounds: { x: state.panel.x, y: state.panel.y, width: state.panel.width, height: state.panel.height }, padding: 12, gap: 10, alignX: 'stretch', layout: { widthPolicy: 'fixed', heightPolicy: 'fill', minWidth: 320, minHeight: 360 } });
panel.addMany([hintLabel, navRow, modeRow, titleField, directiveField, contentEditor, actionRow]);

state.widgets = {
  btnPrev,
  btnNext,
  btnFocus,
  btnBirdsEye,
  btnResetView,
  btnToggleControls,
  panelBackdrop,
  hintLabel,
  titleField,
  directiveField,
  contentEditor,
  resizeHandle,
  btnApply,
  btnRevert
};

state.layouts = { panel, navRow, modeRow, actionRow };

refreshSections();
layoutPanels();
loadSection(0, false);
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
updateModeButtonStyles();
setStatus('Drag the top bar to move. Drag the lower-right corner to scale. Wheel zooms. Two-finger pinch zooms and pans.');
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
  state.pointerX = event.x;
  state.pointerY = event.y;
  if (event.button === 'left') {
    state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
    if (event.action === 'press') {
      if (pointInBounds(event.x, event.y, state.widgets.resizeHandle.bounds)) {
        state.panel.scaling = true;
        state.panel.dragging = false;
        state.panel.scaleStartX = event.x;
        state.panel.scaleStartY = event.y;
        state.panel.scaleStartValue = state.panel.scale;
      } else if (pointInBounds(event.x, event.y, state.widgets.hintLabel.bounds)) {
        state.panel.dragging = true;
        state.panel.scaling = false;
        state.panel.dragOffsetX = event.x - state.panel.x;
        state.panel.dragOffsetY = event.y - state.panel.y;
      }
    }
    if (event.action === 'release') {
      state.panel.dragging = false;
      state.panel.scaling = false;
    }
  }
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  state.pointerX = event.x;
  state.pointerY = event.y;
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
```

```js on:update
if (state.panel.scaling && state.mouseDownLeft) {
  const deltaX = state.pointerX - state.panel.scaleStartX;
  const deltaY = state.pointerY - state.panel.scaleStartY;
  const dominantDelta = Math.abs(deltaX) >= Math.abs(deltaY) ? deltaX : deltaY;
  state.panel.scale = state.panel.scaleStartValue + (dominantDelta / 320);
} else if (state.panel.dragging && state.mouseDownLeft) {
  state.panel.x = state.pointerX - state.panel.dragOffsetX;
  state.panel.y = state.pointerY - state.panel.dragOffsetY;
} else if (!state.mouseDownLeft) {
  state.panel.dragging = false;
  state.panel.scaling = false;
}

layoutPanels();
gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.titleField.wasChanged() || state.widgets.directiveField.wasChanged() || state.widgets.contentEditor.wasChanged()) {
  syncDraftFromWidgets();
  state.dirty = true;
  updateHintLabel();
  setStatus('Draft changed. Apply to update the Worlds runtime section.');
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
  setStatus('Focused the selected section.');
}

if (state.widgets.btnBirdsEye.wasClicked()) {
  if (state.dirty) applyDraft();
  worlds.camera.birdsEye({ view: 'oblique', fill: 0.88, padding: 40 });
  setStatus('Framed the full story layout.');
}

if (state.widgets.btnResetView.wasClicked()) {
  if (state.dirty) applyDraft();
  resetView();
}

if (state.widgets.btnToggleControls.wasClicked()) {
  toggleBuiltInControls();
}

if (state.widgets.btnApply.wasClicked()) {
  applyDraft();
}

if (state.widgets.btnRevert.wasClicked()) {
  revertDraft();
}

const current = typeof worlds.selectedSection === 'number' ? worlds.selectedSection : worlds.currentSection;
if (typeof current === 'number' && current !== state.lastWorldSection) {
  selectSection(current, false);
}
```

```js on:render
term.layerID = 'default';
term.clear();
canvas2d.clear('rgba(0, 0, 0, 0)');
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

From here, the interesting question is no longer what the player does next, but how the editor itself should move through the story.