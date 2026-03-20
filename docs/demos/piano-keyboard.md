---
name: "Dual-Orientation Piano Keyboard"
theme: "dracula"
fontsize: 18
---

```js
var guiMouseDown = false;
var widgets = null;
var currentBreakpoint = '';
var statusText = 'Click or drag a piano. Mouse wheel over a piano zooms. Arrow keys pan the focused piano.';
var pointerDebugText = '';
var voices = Object.create(null);
var resetDefaults = { horizontal: 14, vertical: 14 };
var manualPointerState = { down: false, kind: 'none', scope: '', midi: null, railOffset: 0 };
var layouts = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function boundsContains(bounds, x, y) {
  if (!bounds) return false;
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function getPianoByScope(scopeName) {
  if (!widgets) return null;
  return scopeName === 'vertical' ? widgets.vertical : widgets.horizontal;
}

function hitTestPiano(scopeName, x, y) {
  var piano = getPianoByScope(scopeName);
  if (!piano || !piano.containsPoint({ x: x, y: y })) return null;
  var layout = piano.getLayoutSnapshot();
  for (var i = 0; i < layout.blackKeys.length; i++) {
    if (boundsContains(layout.blackKeys[i].bounds, x, y)) {
      return { kind: 'key', scope: scopeName, piano: piano, layout: layout, key: layout.blackKeys[i] };
    }
  }
  for (var j = 0; j < layout.whiteKeys.length; j++) {
    if (boundsContains(layout.whiteKeys[j].bounds, x, y)) {
      return { kind: 'key', scope: scopeName, piano: piano, layout: layout, key: layout.whiteKeys[j] };
    }
  }
  if (boundsContains(layout.railBounds, x, y)) {
    return { kind: 'rail', scope: scopeName, piano: piano, layout: layout };
  }
  return { kind: 'body', scope: scopeName, piano: piano, layout: layout };
}

function computePointerVelocity(piano, layout, x, y) {
  var main = layout.mainBounds;
  var ratio = piano.orientation === 'horizontal'
    ? (y - main.y) / Math.max(1, main.height)
    : (x - main.x) / Math.max(1, main.width);
  return clamp(ratio, 0.05, 1);
}

function updateRailFromPointer(piano, layout, x, y, dragOffset) {
  if (!layout || !layout.railBounds || !layout.railThumbBounds) return false;
  var railStart = piano.orientation === 'horizontal' ? layout.railBounds.x : layout.railBounds.y;
  var railSize = piano.orientation === 'horizontal' ? layout.railBounds.width : layout.railBounds.height;
  var thumbSize = piano.orientation === 'horizontal' ? layout.railThumbBounds.width : layout.railThumbBounds.height;
  var pointerAlong = piano.orientation === 'horizontal' ? x : y;
  var travel = Math.max(0, railSize - thumbSize);
  var maxStart = Math.max(0, layout.totalWhiteKeys - piano.visibleWhiteKeys);
  if (travel <= 0 || maxStart <= 0) {
    piano.setFirstVisibleWhiteKey(0);
    return true;
  }
  var thumbStart = clamp(pointerAlong - dragOffset, railStart, railStart + travel);
  var ratio = (thumbStart - railStart) / travel;
  piano.setFirstVisibleWhiteKey(Math.round(ratio * maxStart));
  return true;
}

function getPrimaryHit(x, y) {
  if (!widgets) return null;
  if (widgets.resetButton && widgets.resetButton.containsPoint({ x: x, y: y })) {
    return { kind: 'reset' };
  }
  var horizontalHit = hitTestPiano('horizontal', x, y);
  if (horizontalHit && horizontalHit.kind !== 'body') return horizontalHit;
  var verticalHit = hitTestPiano('vertical', x, y);
  if (verticalHit && verticalHit.kind !== 'body') return verticalHit;
  return horizontalHit || verticalHit || null;
}

function processManualPointer(x, y, isDown) {
  if (!widgets) return;

  var justPressed = isDown && !manualPointerState.down;
  var justReleased = !isDown && manualPointerState.down;
  var hit = getPrimaryHit(x, y);

  if (justPressed) {
    resumeAudioIfNeeded();
    if (hit && hit.kind === 'reset') {
      manualPointerState.kind = 'reset';
      manualPointerState.scope = '';
      manualPointerState.midi = null;
      manualPointerState.railOffset = 0;
    } else if (hit && hit.kind === 'key') {
      var velocity = computePointerVelocity(hit.piano, hit.layout, x, y);
      hit.piano.noteOn(hit.key.midi, velocity, 'api');
      manualPointerState.kind = 'key';
      manualPointerState.scope = hit.scope;
      manualPointerState.midi = hit.key.midi;
      manualPointerState.railOffset = 0;
    } else if (hit && hit.kind === 'rail') {
      var thumbStart = hit.piano.orientation === 'horizontal' ? hit.layout.railThumbBounds.x : hit.layout.railThumbBounds.y;
      var thumbSize = hit.piano.orientation === 'horizontal' ? hit.layout.railThumbBounds.width : hit.layout.railThumbBounds.height;
      var pointerAlong = hit.piano.orientation === 'horizontal' ? x : y;
      manualPointerState.kind = 'rail';
      manualPointerState.scope = hit.scope;
      manualPointerState.midi = null;
      manualPointerState.railOffset = boundsContains(hit.layout.railThumbBounds, x, y)
        ? pointerAlong - thumbStart
        : thumbSize / 2;
      updateRailFromPointer(hit.piano, hit.layout, x, y, manualPointerState.railOffset);
    } else {
      manualPointerState.kind = 'none';
      manualPointerState.scope = '';
      manualPointerState.midi = null;
      manualPointerState.railOffset = 0;
    }
  } else if (isDown) {
    if (manualPointerState.kind === 'key') {
      var piano = getPianoByScope(manualPointerState.scope);
      var currentHit = hitTestPiano(manualPointerState.scope, x, y);
      if (currentHit && currentHit.kind === 'key') {
        if (manualPointerState.midi !== currentHit.key.midi) {
          if (piano && manualPointerState.midi != null) piano.noteOff(manualPointerState.midi, 0, 'api');
          piano = currentHit.piano;
          piano.noteOn(currentHit.key.midi, computePointerVelocity(piano, currentHit.layout, x, y), 'api');
          manualPointerState.midi = currentHit.key.midi;
        }
      } else if (piano && manualPointerState.midi != null) {
        piano.noteOff(manualPointerState.midi, 0, 'api');
        manualPointerState.midi = null;
      }
    } else if (manualPointerState.kind === 'rail') {
      var railPiano = getPianoByScope(manualPointerState.scope);
      if (railPiano) {
        updateRailFromPointer(railPiano, railPiano.getLayoutSnapshot(), x, y, manualPointerState.railOffset);
      }
    }
  }

  if (justReleased) {
    if (manualPointerState.kind === 'reset' && widgets.resetButton && widgets.resetButton.containsPoint({ x: x, y: y })) {
      resetViewports();
    }
    if (manualPointerState.kind === 'key') {
      var activePiano = getPianoByScope(manualPointerState.scope);
      if (activePiano && manualPointerState.midi != null) {
        activePiano.noteOff(manualPointerState.midi, 0, 'api');
      }
    }
    manualPointerState.kind = 'none';
    manualPointerState.scope = '';
    manualPointerState.midi = null;
    manualPointerState.railOffset = 0;
  }

  manualPointerState.down = isDown;
}

function resumeAudioIfNeeded() {
  try {
    if (audio && audio.context && typeof audio.context.resume === 'function') {
      var result = audio.context.resume();
      if (result && typeof result.catch === 'function') result.catch(function () {});
    }
  } catch {}
}

function resetViewports() {
  if (!widgets) return;
  widgets.horizontal.setFirstVisibleWhiteKey(0);
  widgets.horizontal.setVisibleWhiteKeys(resetDefaults.horizontal);
  widgets.vertical.setFirstVisibleWhiteKey(0);
  widgets.vertical.setVisibleWhiteKeys(resetDefaults.vertical);
  setStatus('Reset both piano viewports.');
  syncViewportLabels();
}

function setStatus(next) {
  statusText = String(next == null ? '' : next);
  if (widgets && widgets.statusLabel) widgets.statusLabel.setText(statusText);
}

function voiceId(scopeName, midi) {
  return String(scopeName) + ':' + String(midi);
}

function stopVoice(scopeName, midi) {
  var id = voiceId(scopeName, midi);
  var voice = voices[id];
  if (!voice) return;
  var now = audio.currentTime;
  try {
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value || 0.0001), now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
  } catch {}
  try { voice.osc.stop(now + 0.09); } catch {}
  delete voices[id];
}

function startVoice(scopeName, event) {
  if (!event || !event.data) return;
  var midi = Number(event.data.midi);
  var hz = Number(event.data.hz);
  var velocity = Math.max(0.05, Math.min(1, Number(event.data.velocity || 0.6)));
  stopVoice(scopeName, midi);

  var osc = audio.createOscillator();
  var gain = audio.createGain();
  var now = audio.currentTime;

  osc.type = scopeName === 'vertical' ? 'square' : 'triangle';
  osc.frequency.value = hz;

  gain.gain.value = 0.0001;
  osc.connect(gain);
  gain.connect(audio.destination);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.02 + velocity * 0.14, now + 0.015);

  osc.start(now);
  voices[voiceId(scopeName, midi)] = { osc: osc, gain: gain };
}

function bindPianoEvents(piano, scopeName) {
  piano.on('focus', function () {
    setStatus('Focused ' + scopeName + ' piano. Arrow keys pan. +/- zooms.');
  });

  piano.on('noteon', function (event) {
    startVoice(scopeName, event);
    setStatus(scopeName + ' note on: ' + String(event.data.noteName) + '  velocity ' + String(Math.round(Number(event.data.velocity || 0) * 100)) + '%');
    if (widgets && widgets.nowPlayingLabel) {
      widgets.nowPlayingLabel.setText(scopeName + ': ' + String(event.data.noteName) + '  (' + String(event.data.midi) + ')');
    }
  });

  piano.on('noteoff', function (event) {
    stopVoice(scopeName, Number(event.data.midi));
    setStatus(scopeName + ' note off: ' + String(event.data.noteName));
  });

  piano.on('viewportchange', function () {
    syncViewportLabels();
  });
}

function syncViewportLabels() {
  if (!widgets) return;
  var h = widgets.horizontal.getViewportState();
  var v = widgets.vertical.getViewportState();
  widgets.horizontalViewportLabel.setText('Horizontal range: ' + String(h.firstVisibleMidi == null ? '-' : h.firstVisibleMidi) + ' -> ' + String(h.lastVisibleMidi == null ? '-' : h.lastVisibleMidi) + '   whites: ' + String(h.visibleWhiteKeys));
  widgets.verticalViewportLabel.setText('Vertical range: ' + String(v.firstVisibleMidi == null ? '-' : v.firstVisibleMidi) + ' -> ' + String(v.lastVisibleMidi == null ? '-' : v.lastVisibleMidi) + '   whites: ' + String(v.visibleWhiteKeys));
  widgets.statusLabel.setText(pointerDebugText ? statusText + '   ' + pointerDebugText : statusText);
}

function getBreakpointConfig() {
  var viewport = gui.getViewportRect();
  var width = viewport && viewport.width ? viewport.width : 1200;
  var height = viewport && viewport.height ? viewport.height : 800;
  var info = gui.getResponsiveInfo({ width: width, height: height });
  var tokens = gui.getTokens();

  if (info.breakpoint === 'xs') {
    return {
      breakpoint: 'xs',
      insetX: tokens.spacing.sm,
      insetY: tokens.spacing.md,
      panelPadding: tokens.spacing.md,
      rootGap: tokens.spacing.sm,
      contentGap: tokens.spacing.sm,
      sectionGap: tokens.spacing.xs,
      footerGap: tokens.spacing.sm,
      panelMaxWidth: Math.max(320, Math.min(560, info.usableWidth || width)),
      panelHeight: Math.max(420, (info.usableHeight || height) - tokens.spacing.md * 2),
      mainMinHeight: 260,
      horizontalHeight: 150,
      verticalWidth: 132,
      stackVertical: true,
      stackFooter: true,
      horizontalWhiteKeys: 8,
      verticalWhiteKeys: 10
    };
  }

  if (info.breakpoint === 'sm') {
    return {
      breakpoint: 'sm',
      insetX: tokens.spacing.md,
      insetY: tokens.spacing.lg,
      panelPadding: tokens.spacing.lg,
      rootGap: tokens.spacing.sm,
      contentGap: tokens.spacing.sm,
      sectionGap: tokens.spacing.xs,
      footerGap: tokens.spacing.sm,
      panelMaxWidth: Math.max(520, Math.min(760, info.usableWidth || width)),
      panelHeight: Math.max(520, (info.usableHeight || height) - tokens.spacing.lg * 2),
      mainMinHeight: 320,
      horizontalHeight: 164,
      verticalWidth: 144,
      stackVertical: true,
      stackFooter: false,
      horizontalWhiteKeys: 10,
      verticalWhiteKeys: 14
    };
  }

  return {
    breakpoint: 'md',
    insetX: tokens.spacing.lg,
    insetY: tokens.spacing.xl,
    panelPadding: tokens.spacing.lg,
    rootGap: tokens.spacing.md,
    contentGap: tokens.spacing.md,
    sectionGap: tokens.spacing.xs,
    footerGap: tokens.spacing.sm,
    panelMaxWidth: Math.max(860, Math.min(1120, info.usableWidth || width)),
    panelHeight: Math.max(560, (info.usableHeight || height) - tokens.spacing.xl * 2),
    mainMinHeight: 360,
    horizontalHeight: 176,
    verticalWidth: 164,
    stackVertical: false,
    stackFooter: false,
    horizontalWhiteKeys: 14,
    verticalWhiteKeys: 14
  };
}

function rebuildLayout(force) {
  var config = getBreakpointConfig();
  var breakpointChanged = force || currentBreakpoint !== config.breakpoint;

  if (!widgets || !layouts) {
    gui.init();

    var tokens = gui.getTokens();

    layouts = {
      root: gui.createResponsivePanel({
        bounds: { x: 0, y: 0, width: 920, height: 1 },
        gap: tokens.spacing.md,
        padding: tokens.spacing.lg,
        maxWidth: 1120,
        layout: { widthPolicy: 'fill', heightPolicy: 'fill' }
      }),
      mainArea: gui.createContainer({
        bounds: { x: 0, y: 0, width: 1, height: 360 },
        mode: 'row',
        gap: tokens.spacing.md,
        alignX: 'stretch',
        alignY: 'stretch',
        layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 320 }
      }),
      horizontalSection: gui.createContainer({
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        mode: 'stack',
        gap: tokens.spacing.xs,
        alignX: 'stretch',
        layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 0 }
      }),
      verticalSection: gui.createContainer({
        bounds: { x: 0, y: 0, width: 164, height: 1 },
        mode: 'stack',
        gap: tokens.spacing.xs,
        alignX: 'stretch',
        layout: { widthPolicy: 'fixed', heightPolicy: 'fill', minWidth: 0, minHeight: 0 }
      }),
      footerRow: gui.createContainer({
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        mode: 'row',
        gap: tokens.spacing.sm,
        alignX: 'start',
        alignY: 'center',
        layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
      })
    };

    var title = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 30 },
      text: 'Dual-Orientation Piano Keyboard',
      align: 'left',
      labelStyle: { typographyRole: 'title' },
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var hint = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: 'Shared note-axis core. Horizontal for auditioning, vertical for future piano-roll gutters.',
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var statusLabel = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: statusText,
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var nowPlayingLabel = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: 'Now playing: (none)',
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var horizontalViewportLabel = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 22 },
      text: 'Horizontal range: --',
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var horizontal = gui.createPianoKeyboard({
      bounds: { x: 0, y: 0, width: 1, height: config.horizontalHeight },
      minMidi: 36,
      maxMidi: 96,
      visibleWhiteKeys: config.horizontalWhiteKeys,
      minVisibleWhiteKeys: 6,
      maxVisibleWhiteKeys: 18,
      showLabels: 'c',
      interactionMode: 'gate',
      railPlacement: 'leading',
      velocityMode: 'axis-cross',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0, minHeight: 0 }
    });

    var verticalViewportLabel = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 22 },
      text: 'Vertical range: --',
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var vertical = gui.createPianoKeyboard({
      bounds: { x: 0, y: 0, width: config.verticalWidth, height: 280 },
      orientation: 'vertical',
      noteFlow: 'desc',
      minMidi: 36,
      maxMidi: 96,
      visibleWhiteKeys: config.verticalWhiteKeys,
      minVisibleWhiteKeys: 8,
      maxVisibleWhiteKeys: 24,
      showLabels: 'c',
      interactionMode: 'gate',
      railPlacement: 'trailing',
      velocityMode: 'axis-cross',
      pianoStyle: {
        railThumbColor: ui.colors.rgba(109, 153, 192, 255),
        railThumbActiveColor: ui.colors.rgba(249, 191, 99, 255),
        whiteKeyActiveColor: ui.colors.rgba(195, 226, 255, 255),
        blackKeyActiveColor: ui.colors.rgba(106, 174, 234, 255)
      },
      layout: { widthPolicy: 'fill', heightPolicy: 'fill', minWidth: 0, minHeight: 0 }
    });

    var resetButton = gui.createButton({
      bounds: { x: 0, y: 0, width: 220, height: 44 },
      label: 'Reset Viewports',
      layout: { widthPolicy: 'fixed', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var footer = gui.createLabel({
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: 'Mouse wheel zooms under the pointer. Click a piano to focus it, then use arrows or +/-.',
      align: 'left',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    layouts.horizontalSection.add(horizontalViewportLabel).add(horizontal);
    layouts.verticalSection.add(verticalViewportLabel).add(vertical);
    layouts.mainArea.add(layouts.horizontalSection).add(layouts.verticalSection);
    layouts.footerRow.add(resetButton).add(footer);
    layouts.root
      .add(title)
      .add(hint)
      .add(statusLabel)
      .add(nowPlayingLabel)
      .add(layouts.mainArea)
      .add(layouts.footerRow);

    widgets = {
      title: title,
      hint: hint,
      statusLabel: statusLabel,
      nowPlayingLabel: nowPlayingLabel,
      horizontalViewportLabel: horizontalViewportLabel,
      verticalViewportLabel: verticalViewportLabel,
      horizontal: horizontal,
      vertical: vertical,
      resetButton: resetButton,
      footer: footer
    };

    bindPianoEvents(horizontal, 'horizontal');
    bindPianoEvents(vertical, 'vertical');
    resetButton.on('click', function () {
      resetViewports();
    });
  }

  if (breakpointChanged) {
    if (Math.abs(widgets.horizontal.visibleWhiteKeys - resetDefaults.horizontal) < 0.001) {
      widgets.horizontal.setVisibleWhiteKeys(config.horizontalWhiteKeys, 0.5, false);
    }
    if (Math.abs(widgets.vertical.visibleWhiteKeys - resetDefaults.vertical) < 0.001) {
      widgets.vertical.setVisibleWhiteKeys(config.verticalWhiteKeys, 0.5, false);
    }
  }

  resetDefaults.horizontal = config.horizontalWhiteKeys;
  resetDefaults.vertical = config.verticalWhiteKeys;
  currentBreakpoint = config.breakpoint;

  layouts.root.container.padding = config.panelPadding;
  layouts.root.container.gap = config.rootGap;
  layouts.root.setMaxWidth(config.panelMaxWidth, false);

  layouts.mainArea.setMode(config.stackVertical ? 'stack' : 'row', false);
  layouts.mainArea.gap = config.contentGap;
  layouts.mainArea.rowGap = config.contentGap;
  layouts.mainArea.columnGap = config.contentGap;
  layouts.mainArea.layoutHints.minHeight = config.mainMinHeight;

  layouts.horizontalSection.gap = config.sectionGap;
  layouts.verticalSection.gap = config.sectionGap;
  layouts.verticalSection.layoutHints.widthPolicy = config.stackVertical ? 'fill' : 'fixed';

  layouts.footerRow.setMode(config.stackFooter ? 'stack' : 'row', false);
  layouts.footerRow.alignX = config.stackFooter ? 'stretch' : 'start';
  layouts.footerRow.alignY = config.stackFooter ? 'stretch' : 'center';
  layouts.footerRow.gap = config.footerGap;
  layouts.footerRow.rowGap = config.footerGap;
  layouts.footerRow.columnGap = config.footerGap;

  widgets.horizontal.setBounds({ width: 1, height: config.horizontalHeight });
  widgets.vertical.setBounds({ width: config.verticalWidth, height: Math.max(220, config.mainMinHeight - config.horizontalHeight) });

  var viewport = gui.getViewportRect();
  layouts.root.fitToViewport(viewport, {
    insetTop: config.insetY,
    insetRight: config.insetX,
    insetBottom: config.insetY,
    insetLeft: config.insetX,
    safeArea: true,
    maxWidth: config.panelMaxWidth,
    height: config.panelHeight,
    anchorX: 'center',
    anchorY: 'start'
  }, false);
  layouts.root.layout();
  syncViewportLabels();
}

function zoomPianoAt(piano, direction, x, y) {
  if (!piano || typeof piano.containsPoint !== 'function') return false;
  if (!piano.containsPoint({ x: x, y: y })) return false;
  var layout = piano.getLayoutSnapshot();
  var anchor = piano.orientation === 'horizontal'
    ? (x - layout.mainBounds.x) / Math.max(1, layout.mainBounds.width)
    : (y - layout.mainBounds.y) / Math.max(1, layout.mainBounds.height);
  piano.zoomBy(direction, anchor);
  syncViewportLabels();
  return true;
}
scope.init = function() {
  term.layerID = 'default';
  gui.init();
  rebuildLayout(true);
};

scope.input = function(event) {
  if (!event) return;
  if (!widgets) return;

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
    if (event.action === 'press') {
      setStatus('Pointer press: ' + String(event.button) + ' @ ' + String(Math.round(event.x)) + ', ' + String(Math.round(event.y)));
      resumeAudioIfNeeded();
    }
    if (event.action === 'press' && event.button === 'scroll_up') {
      if (zoomPianoAt(widgets.horizontal, -1, event.x, event.y)) return;
      if (zoomPianoAt(widgets.vertical, -1, event.x, event.y)) return;
    }
    if (event.action === 'press' && event.button === 'scroll_down') {
      if (zoomPianoAt(widgets.horizontal, 1, event.x, event.y)) return;
      if (zoomPianoAt(widgets.vertical, 1, event.x, event.y)) return;
    }
    if (event.button === 'left') {
      guiMouseDown = event.action === 'press' || event.action === 'repeat';
    }
    gui.handleMouse(event.x, event.y, guiMouseDown);
  }

  if (event.type === 'mouse_move') {
    gui.handleMouse(event.x, event.y, guiMouseDown);
  }
};

scope.update = function() {
  if (!widgets) return;

  rebuildLayout(false);

  var liveMouseDown = false;
  try {
    liveMouseDown = !!(mouse && typeof mouse.down === 'function' ? mouse.down(0) : guiMouseDown);
  } catch {
    liveMouseDown = !!guiMouseDown;
  }

  guiMouseDown = liveMouseDown;
  processManualPointer(getMouseX(), getMouseY(), liveMouseDown);
  gui.handleMouse(getMouseX(), getMouseY(), liveMouseDown);
  gui.update(getMouseX(), getMouseY(), liveMouseDown);

  if (widgets.resetButton && typeof widgets.resetButton.wasClicked === 'function' && widgets.resetButton.wasClicked()) {
    resetViewports();
  }

  if (!liveMouseDown && widgets && widgets.horizontal && widgets.vertical) {
    var primaryHit = getPrimaryHit(getMouseX(), getMouseY());
    var hovered = primaryHit ? (primaryHit.scope || primaryHit.kind || 'none') : 'none';
    pointerDebugText = 'mouse=' + hovered + ' @ ' + String(Math.round(getMouseX())) + ',' + String(Math.round(getMouseY()));
  } else if (liveMouseDown) {
    pointerDebugText = 'mouse=down/' + String(manualPointerState.kind) + ' @ ' + String(Math.round(getMouseX())) + ',' + String(Math.round(getMouseY()));
  }

  syncViewportLabels();
};

scope.render = function() {
  term.layerID = 'default';
  term.clear();
  ui.clear(getStyle('default').bg);
};
```