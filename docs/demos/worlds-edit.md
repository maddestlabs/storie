---
name: "Worlds Editor Lab"
theme: "nord"
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
  showAllConnectors: false,
  mouseDownLeft: false,
  pointerX: 0,
  pointerY: 0,
  lastWorldSection: null,
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
  sectionHandles: {
    handleSize: 28,
    resizing: false,
    rotating: false,
    resizeStartX: 0,
    resizeStartY: 0,
    resizeStartWidth: 1,
    resizeStartHeight: 1,
    resizeStartScreenW: 1,
    resizeStartScreenH: 1,
    rotateStartX: 0,
    rotateStartY: 0,
    rotateStartAngle: 0,
    rotateCenterX: 0,
    rotateCenterY: 0,
    rotateStartRotX: 0,
    rotateStartRotY: 0,
    rotateStartRotZ: 0,
  },
  widgets: null,
  layouts: null,
  logicalBounds: null,
  minimap: {
    width: 200,
    height: 150,
    margin: 14,
    padding: 8,
    visible: true,
    bounds: null,
    mapTransform: null,
  },
};

function safeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
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
    state.widgets.btnPrev,
    state.widgets.btnNext,
    state.widgets.btnFocus,
    state.widgets.btnBirdsEye,
    state.widgets.btnResetView,
    state.widgets.btnToggleControls,
    state.widgets.btnToggleConnectors,
  ];
}

function captureLogicalBounds() {
  state.logicalBounds = {
    hintLabel: { ...state.widgets.hintLabel.bounds },
    btnPrev: { ...state.widgets.btnPrev.bounds },
    btnNext: { ...state.widgets.btnNext.bounds },
    btnFocus: { ...state.widgets.btnFocus.bounds },
    btnBirdsEye: { ...state.widgets.btnBirdsEye.bounds },
    btnResetView: { ...state.widgets.btnResetView.bounds },
    btnToggleControls: { ...state.widgets.btnToggleControls.bounds },
    btnToggleConnectors: { ...state.widgets.btnToggleConnectors.bounds },
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
  state.widgets.btnPrev.bounds = { ...state.logicalBounds.btnPrev };
  state.widgets.btnNext.bounds = { ...state.logicalBounds.btnNext };
  state.widgets.btnFocus.bounds = { ...state.logicalBounds.btnFocus };
  state.widgets.btnBirdsEye.bounds = { ...state.logicalBounds.btnBirdsEye };
  state.widgets.btnResetView.bounds = { ...state.logicalBounds.btnResetView };
  state.widgets.btnToggleControls.bounds = { ...state.logicalBounds.btnToggleControls };
  state.widgets.btnToggleConnectors.bounds = { ...state.logicalBounds.btnToggleConnectors };
}

function getResizeHandleBounds() {
  return {
    x: state.panel.x + getPanelActualWidth() - state.panel.resizeHandleSize,
    y: state.panel.y + getPanelActualHeight() - state.panel.resizeHandleSize,
    width: state.panel.resizeHandleSize,
    height: state.panel.resizeHandleSize,
  };
}

function updateSectionHandles() {
  if (!state.widgets?.sectionResizeHandle || !state.widgets?.sectionRotateHandle) return;
  const idx = state.selectedSectionIndex;
  if (idx === null || idx === undefined) {
    state.widgets.sectionResizeHandle.enabled = false;
    state.widgets.sectionRotateHandle.enabled = false;
    state.widgets.sectionResizeHandle.bounds.width = 0;
    state.widgets.sectionRotateHandle.bounds.width = 0;
    return;
  }
  const quad = worlds.getScreenQuad(idx);
  if (!quad || quad.length < 4) {
    state.widgets.sectionResizeHandle.enabled = false;
    state.widgets.sectionRotateHandle.enabled = false;
    state.widgets.sectionResizeHandle.bounds.width = 0;
    state.widgets.sectionRotateHandle.bounds.width = 0;
    return;
  }
  // quad order: [bottom-left, bottom-right, top-right, top-left] in screen space
  const hs = state.sectionHandles.handleSize;
  const bottomRight = quad[1];
  const topRight = quad[2];
  state.widgets.sectionResizeHandle.enabled = true;
  state.widgets.sectionResizeHandle.bounds.x = bottomRight.x - hs / 2;
  state.widgets.sectionResizeHandle.bounds.y = bottomRight.y - hs / 2;
  state.widgets.sectionResizeHandle.bounds.width = hs;
  state.widgets.sectionResizeHandle.bounds.height = hs;
  state.widgets.sectionRotateHandle.enabled = true;
  state.widgets.sectionRotateHandle.bounds.x = topRight.x - hs / 2;
  state.widgets.sectionRotateHandle.bounds.y = topRight.y - hs / 2;
  state.widgets.sectionRotateHandle.bounds.width = hs;
  state.widgets.sectionRotateHandle.bounds.height = hs;
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
  state.widgets.hintLabel.setText('Controls');
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

function updateConnectorButtonStyles() {
  if (!state.widgets?.btnToggleConnectors) return;
  const enabled = !!state.showAllConnectors;
  state.widgets.btnToggleConnectors.buttonStyle.fg = enabled ? ui.colors.rgba(18, 18, 18, 255) : undefined;
  state.widgets.btnToggleConnectors.buttonStyle.bg = enabled ? ui.colors.rgba(244, 238, 224, 255) : undefined;
  state.widgets.btnToggleConnectors.buttonStyle.hoverBg = enabled ? ui.colors.rgba(255, 246, 232, 255) : undefined;
  state.widgets.btnToggleConnectors.buttonStyle.activeBg = enabled ? ui.colors.rgba(226, 214, 192, 255) : undefined;
  state.widgets.btnToggleConnectors.buttonStyle.borderColor = enabled ? ui.colors.rgba(255, 246, 232, 255) : undefined;
}

function refreshSections() {
  state.sections = worlds.sections.list();
}

function applyLinkOverlay() {
  if (!state.selectedSectionId) return;
  worlds.links.setRenderOverlay({
    enabled: true,
    section: state.selectedSectionId,
    internalOnly: true,
    thickness: 0.12,
    allVisible: !!state.showAllConnectors,
  });
}

function loadSection(selector, focusCamera) {
  const section = worlds.sections.get(selector);
  if (!section) return false;

  state.selectedSectionId = section.sectionId;
  state.selectedSectionIndex = section.sectionIndex;
  state.loadedSectionId = section.sectionId;
  state.lastWorldSection = section.sectionIndex;
  applyLinkOverlay();
  updateHintLabel();

  if (focusCamera) {
    worlds.camera.focusOnSectionFit(section.sectionIndex, 0.9, { keepRotation: true });
  }

  return true;
}

function selectSection(selector, focusCamera = true) {
  loadSection(selector, focusCamera);
}

function resetView() {
  const current = state.selectedSectionIndex ?? 0;
  applyEditorPreset();
  worlds.camera.focusOnSectionFit(current, 0.9, { keepRotation: true });
}

function applyEditorPreset() {
  worlds.presets.apply('story-editor');
  worlds.config.setDefaults({
    sectionLinkUnderline: true,
    sectionListMarker: '>',
    sectionListMarkerGapPx: 12,
    sectionListHangIndentPx: 24,
    sectionBorderEnabled: true,
    sectionClickFocusEnabled: false,
  });
  worlds.camera.setRotation(0, 0, 0);
}

function drawMinimap() {
  if (!state.minimap.visible) return;
  const mm = state.minimap;
  const count = worlds.getSectionCount();
  if (!count) return;

  const cw = canvas2d.width || 800;
  const ch = canvas2d.height || 600;
  const deviceRect = getDeviceViewportRect();
  const dw = Math.max(1, deviceRect.width);
  const dh = Math.max(1, deviceRect.height);
  // device pixel → canvas2d pixel scale
  const dx = cw / dw, dy = ch / dh;

  // Collect all screen quads (already 3D-projected) converted to canvas2d space
  const allQuads = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const quad = worlds.getScreenQuad(i);
    if (!quad || quad.length < 4) { allQuads.push(null); continue; }
    const pts = quad.map(p => ({ x: p.x * dx, y: p.y * dy }));
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    allQuads.push(pts);
  }
  if (!isFinite(minX)) return;

  const mmW = mm.width, mmH = mm.height;
  const mmX = cw - mmW - mm.margin;
  const mmY = ch - mmH - mm.margin;
  mm.bounds = { x: mmX, y: mmY, width: mmW, height: mmH };

  const innerX = mmX + mm.padding;
  const innerY = mmY + mm.padding;
  const innerW = mmW - mm.padding * 2;
  const innerH = mmH - mm.padding * 2;

  const contentW = Math.max(1, maxX - minX);
  const contentH = Math.max(1, maxY - minY);
  const fitScale = Math.min(innerW / contentW, innerH / contentH);
  const fitOffX = innerX + (innerW - contentW * fitScale) / 2 - minX * fitScale;
  const fitOffY = innerY + (innerH - contentH * fitScale) / 2 - minY * fitScale;

  // Transform quads into minimap-canvas2d space and store for hit testing
  const mmQuads = allQuads.map(pts => pts ? pts.map(p => ({
    x: fitOffX + p.x * fitScale,
    y: fitOffY + p.y * fitScale,
  })) : null);
  mm.mapTransform = { mmQuads, cw, ch };

  const ctx = canvas2d.context;
  ctx.save();

  // Background
  ctx.fillStyle = 'rgba(8, 10, 16, 0.80)';
  ctx.fillRect(mmX, mmY, mmW, mmH);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mmX + 0.5, mmY + 0.5, mmW - 1, mmH - 1);

  // Clip to inner area
  ctx.beginPath();
  ctx.rect(innerX, innerY, innerW, innerH);
  ctx.clip();

  // Draw each projected quad as a polygon
  for (let i = 0; i < count; i++) {
    const pts = mmQuads[i];
    if (!pts) continue;
    const isSelected = i === state.selectedSectionIndex;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
    ctx.closePath();
    ctx.fillStyle = isSelected ? 'rgba(255, 220, 70, 0.92)' : 'rgba(150, 165, 200, 0.45)';
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = 'rgba(255, 240, 100, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  ctx.restore();
}

function minimapPointInQuad(px, py, pts) {
  // Sign-consistent cross product test: works for both CW and CCW wound convex polys
  const n = pts.length;
  let sign = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
    if (cross === 0) continue;
    const s = cross > 0 ? 1 : -1;
    if (sign === 0) { sign = s; } else if (s !== sign) return false;
  }
  return true;
}

function minimapHitSection(mx, my) {
  const mm = state.minimap;
  if (!mm.bounds || !mm.mapTransform) return -1;
  const { mmQuads, cw, ch } = mm.mapTransform;
  const deviceRect = getDeviceViewportRect();
  const cx = mx * cw / Math.max(1, deviceRect.width);
  const cy = my * ch / Math.max(1, deviceRect.height);
  if (!pointInBounds(cx, cy, mm.bounds)) return -1;
  const count = worlds.getSectionCount();
  for (let i = count - 1; i >= 0; i--) {
    const pts = mmQuads[i];
    if (!pts) continue;
    if (minimapPointInQuad(cx, cy, pts)) return i;
  }
  return -1;
}

function drawSelectedSectionLinkGuides() {
  canvas2d.clear('rgba(0, 0, 0, 0)');
}

function toggleBuiltInControls() {
  worlds.controls.setEnabled(!worlds.controls.enabled);
  updateModeButtonStyles();
}

function toggleConnectorOverlayMode() {
  state.showAllConnectors = !state.showAllConnectors;
  updateConnectorButtonStyles();
  applyLinkOverlay();
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
  captureLogicalBounds();
  applyScaledBounds(state.widgets.hintLabel, state.logicalBounds.hintLabel);
  applyScaledBounds(state.widgets.btnPrev, state.logicalBounds.btnPrev);
  applyScaledBounds(state.widgets.btnNext, state.logicalBounds.btnNext);
  applyScaledBounds(state.widgets.btnFocus, state.logicalBounds.btnFocus);
  applyScaledBounds(state.widgets.btnBirdsEye, state.logicalBounds.btnBirdsEye);
  applyScaledBounds(state.widgets.btnResetView, state.logicalBounds.btnResetView);
  applyScaledBounds(state.widgets.btnToggleControls, state.logicalBounds.btnToggleControls);
  applyScaledBounds(state.widgets.btnToggleConnectors, state.logicalBounds.btnToggleConnectors);
  const resizeBounds = getResizeHandleBounds();
  state.widgets.resizeHandle.bounds.x = resizeBounds.x;
  state.widgets.resizeHandle.bounds.y = resizeBounds.y;
  state.widgets.resizeHandle.bounds.width = resizeBounds.width;
  state.widgets.resizeHandle.bounds.height = resizeBounds.height;
  state.widgets.resizeHandle.setRenderScale(state.panel.scale);
  updateSectionHandles();
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
const btnToggleConnectors = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 42 }, label: '⛓', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 92 } });
const panelBackdrop = gui.createLabel({ bounds: { x: state.panel.x, y: state.panel.y, width: state.panel.width, height: state.panel.height }, text: '', align: 'left', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(12, 12, 12, 0.3) } });
const hintLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 44 }, text: 'Controls', align: 'left', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(0, 0, 0, 0.22) }, layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const resizeHandle = gui.createLabel({ bounds: { x: 0, y: 0, width: state.panel.resizeHandleSize, height: state.panel.resizeHandleSize }, text: '///', align: 'center', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(255, 255, 255, 0.12) } });

const navRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
navRow.addMany([btnPrev, btnNext]);

const modeRow = gui.createContainer({ bounds: { x: 0, y: 0, width: 1, height: 1 }, mode: 'row', gap: 8, alignX: 'stretch', alignY: 'center', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
modeRow.addMany([btnFocus, btnBirdsEye, btnResetView, btnToggleControls, btnToggleConnectors]);

const panel = gui.createContainer({ bounds: { x: state.panel.x, y: state.panel.y, width: state.panel.width, height: state.panel.height }, padding: 12, gap: 10, alignX: 'stretch', layout: { widthPolicy: 'fixed', heightPolicy: 'fill', minWidth: 320, minHeight: 360 } });
panel.addMany([hintLabel, navRow, modeRow]);

const hs = state.sectionHandles.handleSize;
const sectionResizeHandle = gui.createLabel({ bounds: { x: 0, y: 0, width: hs, height: hs }, text: '⤡', align: 'center', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(255, 200, 100, 0.85), fg: ui.colors.rgba(20, 20, 20, 255) } });
const sectionRotateHandle = gui.createLabel({ bounds: { x: 0, y: 0, width: hs, height: hs }, text: '↻', align: 'center', enabled: false, focusable: false, labelStyle: { bg: ui.colors.rgba(100, 200, 255, 0.85), fg: ui.colors.rgba(20, 20, 20, 255) } });

state.widgets = {
  btnPrev,
  btnNext,
  btnFocus,
  btnBirdsEye,
  btnResetView,
  btnToggleControls,
  btnToggleConnectors,
  panelBackdrop,
  hintLabel,
  resizeHandle,
  sectionResizeHandle,
  sectionRotateHandle,
};

state.layouts = { panel, navRow, modeRow };

refreshSections();
layoutPanels();
loadSection(0, false);
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
updateModeButtonStyles();
updateConnectorButtonStyles();
updateHintLabel();
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
      if (state.minimap.visible) {
        const mmHit = minimapHitSection(event.x, event.y);
        if (mmHit >= 0) { selectSection(mmHit, true); }
      }
      const sh = state.sectionHandles;
      const resizeW = state.widgets.sectionResizeHandle;
      const rotateW = state.widgets.sectionRotateHandle;
      const idx = state.selectedSectionIndex;
      if (resizeW && resizeW.enabled && resizeW.bounds.width > 0 && pointInBounds(event.x, event.y, resizeW.bounds)) {
        // Grab section resize handle — make this section current without moving camera
        if (idx !== null) selectSection(idx, false);
        sh.resizing = true;
        sh.rotating = false;
        state.panel.scaling = false;
        state.panel.dragging = false;
        sh.resizeStartX = event.x;
        sh.resizeStartY = event.y;
        const layout = idx !== null ? worlds.getSectionLayout(idx) : null;
        sh.resizeStartWidth = layout ? layout.width : 1;
        sh.resizeStartHeight = layout ? layout.height : 1;
        // Record screen dimensions of the section quad to convert pixel delta to dimension delta
        const quad = idx !== null ? worlds.getScreenQuad(idx) : null;
        if (quad && quad.length >= 4) {
          sh.resizeStartScreenW = Math.max(1, Math.hypot(quad[1].x - quad[0].x, quad[1].y - quad[0].y));
          sh.resizeStartScreenH = Math.max(1, Math.hypot(quad[2].x - quad[1].x, quad[2].y - quad[1].y));
        } else {
          sh.resizeStartScreenW = 1;
          sh.resizeStartScreenH = 1;
        }
      } else if (rotateW && rotateW.enabled && rotateW.bounds.width > 0 && pointInBounds(event.x, event.y, rotateW.bounds)) {
        // Grab section rotate handle — make this section current without moving camera
        if (idx !== null) selectSection(idx, false);
        sh.rotating = true;
        sh.resizing = false;
        state.panel.scaling = false;
        state.panel.dragging = false;
        sh.rotateStartX = event.x;
        sh.rotateStartY = event.y;
        const quad = idx !== null ? worlds.getScreenQuad(idx) : null;
        if (quad && quad.length >= 4) {
          sh.rotateCenterX = (quad[0].x + quad[1].x + quad[2].x + quad[3].x) / 4;
          sh.rotateCenterY = (quad[0].y + quad[1].y + quad[2].y + quad[3].y) / 4;
        } else {
          sh.rotateCenterX = event.x;
          sh.rotateCenterY = event.y;
        }
        sh.rotateStartAngle = Math.atan2(event.y - sh.rotateCenterY, event.x - sh.rotateCenterX);
        const layout = idx !== null ? worlds.getSectionLayout(idx) : null;
        // rotation is in radians in getSectionLayout; convert to degrees for setSectionTransform
        sh.rotateStartRotX = layout ? (layout.rotation.x * 180 / Math.PI) : 0;
        sh.rotateStartRotY = layout ? (layout.rotation.y * 180 / Math.PI) : 0;
        sh.rotateStartRotZ = layout ? (layout.rotation.z * 180 / Math.PI) : 0;
      } else if (pointInBounds(event.x, event.y, state.widgets.resizeHandle.bounds)) {
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
      state.sectionHandles.resizing = false;
      state.sectionHandles.rotating = false;
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

const sh = state.sectionHandles;
const idx = state.selectedSectionIndex;
if (sh.resizing && state.mouseDownLeft && idx !== null) {
  const deltaX = state.pointerX - sh.resizeStartX;
  const deltaY = state.pointerY - sh.resizeStartY;
  const newW = Math.max(10, sh.resizeStartWidth  * (1 + deltaX / sh.resizeStartScreenW));
  const newH = Math.max(4,  sh.resizeStartHeight * (1 + deltaY / sh.resizeStartScreenH));
  worlds.setSectionSize(idx, newW, newH);
} else if (sh.rotating && state.mouseDownLeft && idx !== null) {
  const curAngle = Math.atan2(state.pointerY - sh.rotateCenterY, state.pointerX - sh.rotateCenterX);
  const deltaAngleDeg = (sh.rotateStartAngle - curAngle) * (180 / Math.PI);
  worlds.setSectionTransform(idx, {
    rotation: { x: sh.rotateStartRotX, y: sh.rotateStartRotY, z: sh.rotateStartRotZ + deltaAngleDeg }
  });
} else if (!state.mouseDownLeft) {
  sh.resizing = false;
  sh.rotating = false;
}

layoutPanels();
gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

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
  worlds.camera.birdsEye({ view: 'oblique', fill: 0.88, padding: 40 });
}

if (state.widgets.btnResetView.wasClicked()) {
  resetView();
}

if (state.widgets.btnToggleControls.wasClicked()) {
  toggleBuiltInControls();
}

if (state.widgets.btnToggleConnectors.wasClicked()) {
  toggleConnectorOverlayMode();
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
drawMinimap();
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