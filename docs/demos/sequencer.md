---
name: "Pattern Sequencer Sketch"
theme: "nord"
requiresAudioGesture: true
---

A pattern-first sequencer sketch that is closer to a DAW layout:

- A compact transport strip sits at the top
- The pattern arranger is the primary surface
- Clicking a pattern opens the note sequencer over the arranger
- Clicking a track name opens the JSON graph editor for that track
- The graph editor stays hidden otherwise

## Demo

```js
let state = {
  mouseDownLeft: false,
  mouseDownMiddle: false,
  pointerMode: 'idle',
  layoutSize: { width: 0, height: 0, editorOpen: false, graphOpen: false, pianoStripHeight: 0, bottomPanelMode: 'keys' },
  layoutScaleY: 1,
  transportBounds: { x: 0, y: 0, w: 0, h: 0 },
  sidebarBounds: { x: 0, y: 0, w: 0, h: 0 },
  rightPanelBounds: { x: 0, y: 0, w: 0, h: 0 },
  pianoBounds: { x: 0, y: 0, w: 0, h: 0 },
  arrangementBounds: { x: 0, y: 0, w: 0, h: 0, headerH: 26, labelW: 86, rowH: 28 },
  noteBounds: { x: 0, y: 0, w: 0, h: 0, headerH: 28, labelW: 56 },
  bpm: 124,
  masterVolume: 0.72,
  seed: 1337,
  isPlaying: false,
  startAudioTime: 0,
  startBeatOffset: 0,
  pauseBeats: 0,
  lastProcessedStep: -1,
  currentStep: 0,
  arrangementSlotCount: 8,
  patternStepCount: 32,
  visiblePatternSteps: 16,
  pianoStripHeight: 142,
  bottomPanelMode: 'keys',
  mixerScrollIndex: 0,
  mixerRailBounds: { x: 0, y: 0, w: 0, h: 0 },
  mixerRailThumbBounds: { x: 0, y: 0, w: 0, h: 0 },
  mixerVisibleTrackCount: 0,
  mixerRailDragOffset: 0,
  mixerRailStartY: 0,
  mixerRailStartHeight: 142,
  midiTop: 84,
  totalRows: 36,
  visibleRows: 16,
  noteViewStartStep: 0,
  noteViewRowOffset: 10,
  nextNoteId: 1,
  selectedPatternId: 'A',
  selectedTrackIndex: 0,
  editorOpen: false,
  editorPatternId: 'A',
  editorTrackIndex: 0,
  graphEditorTrackId: null,
  dragTrackIndex: -1,
  dragSlotIndex: -1,
  dragPatternId: '',
  dragMoved: false,
  dragStartX: 0,
  dragStartY: 0,
  lastTapAt: 0,
  lastTapTrackIndex: -1,
  lastTapSlotIndex: -1,
  activeNoteId: null,
  noteInteractionStartX: 0,
  noteInteractionStartY: 0,
  noteInteractionViewStartStep: 0,
  noteInteractionViewRowOffset: 0,
  mixerReady: false,
  masterBus: null,
  trackBuses: {},
  widgets: null,
  tracks: [],
  patterns: {},
  statusText: 'Pattern view first. Single tap focuses a pattern, drag moves it, and double tap opens note editing.',
  transportText: 'Stopped',
  lastNoteText: '(none)',
  graphError: '',
  playCounter: 0
};

const DEFAULT_MONO_PRESET = {
  vars: {
    rootHz: 220,
    tone: 2100
  },
  nodes: [
    { kind: 'oscVoice', id: 'osc1', oscType: 'sawtooth', freqHz: { kind: 'var', name: 'rootHz' }, gain: 0.18, stopAfter: 0.35 },
    { kind: 'oscVoice', id: 'osc2', oscType: 'triangle', freqHz: { kind: 'mul', a: { kind: 'var', name: 'rootHz' }, b: 1.005 }, gain: 0.12, stopAfter: 0.35 },
    { kind: 'filter', id: 'lp', filterType: 'lowpass', freqHz: { kind: 'var', name: 'tone' }, q: 0.8 },
    { kind: 'gain', id: 'amp', gain: 0.95 }
  ],
  edges: [
    { from: 'osc1', to: 'lp' },
    { from: 'osc2', to: 'lp' },
    { from: 'lp', to: 'amp' },
    { from: 'amp', to: 'out' }
  ],
  events: [
    { kind: 'envAR', node: 'amp', attack: 0.01, release: 0.15, peak: 1.0, at: 0 }
  ]
};

const TRACK_COLORS = [
  ui.colors.rgb(101, 189, 255),
  ui.colors.rgb(140, 222, 168),
  ui.colors.rgb(255, 196, 104)
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function rgba01(r, g, b, a01) {
  const a = Math.round(clamp(Number(a01), 0, 1) * 255);
  return ui.colors.rgba(r, g, b, a);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowSeconds() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now() / 1000;
    }
  } catch {}
  return Date.now() / 1000;
}

function noteId() {
  const id = state.nextNoteId;
  state.nextNoteId += 1;
  return id;
}

function makePattern(id, name) {
  return { id: id, name: name, notes: [] };
}

function addPatternNote(patternId, row, start, length) {
  const pattern = state.patterns[patternId];
  if (!pattern) return null;
  const note = {
    id: noteId(),
    row: clamp(row, 0, state.totalRows - 1),
    start: clamp(start, 0, state.patternStepCount - 1),
    length: clamp(length, 1, state.patternStepCount),
    velocity: 0.72
  };
  note.length = Math.min(note.length, state.patternStepCount - note.start);
  pattern.notes.push(note);
  return note;
}

function initState() {
  const defaultGraphText = JSON.stringify(DEFAULT_MONO_PRESET, null, 2);
  state.tracks = [
    { id: 'lead', name: 'Lead', transpose: 0, gain: 0.8, volume: 0.92, muted: false, solo: false, slots: ['A', '.', 'B', '.', 'A', '.', 'C', '.'], graphText: defaultGraphText, graphPreset: deepClone(DEFAULT_MONO_PRESET) },
    { id: 'bass', name: 'Bass', transpose: -12, gain: 0.72, volume: 0.88, muted: false, solo: false, slots: ['B', '.', 'B', '.', 'C', '.', 'B', '.'], graphText: defaultGraphText, graphPreset: deepClone(DEFAULT_MONO_PRESET) },
    { id: 'arp', name: 'Arp', transpose: 12, gain: 0.58, volume: 0.8, muted: false, solo: false, slots: ['.', 'C', '.', 'A', '.', 'C', '.', 'A'], graphText: defaultGraphText, graphPreset: deepClone(DEFAULT_MONO_PRESET) }
  ];

  state.patterns = {
    A: makePattern('A', 'Pattern A'),
    B: makePattern('B', 'Pattern B'),
    C: makePattern('C', 'Pattern C')
  };

  addPatternNote('A', 18, 0, 2);
  addPatternNote('A', 14, 4, 2);
  addPatternNote('A', 11, 8, 4);
  addPatternNote('A', 14, 16, 2);
  addPatternNote('A', 18, 20, 4);

  addPatternNote('B', 26, 0, 4);
  addPatternNote('B', 26, 8, 4);
  addPatternNote('B', 21, 16, 4);
  addPatternNote('B', 26, 24, 4);

  addPatternNote('C', 9, 0, 1);
  addPatternNote('C', 13, 2, 1);
  addPatternNote('C', 16, 4, 1);
  addPatternNote('C', 21, 6, 1);
  addPatternNote('C', 16, 8, 1);
  addPatternNote('C', 13, 10, 1);
  addPatternNote('C', 9, 12, 2);
}

function currentPattern() {
  return state.patterns[state.selectedPatternId] || null;
}

function editorPattern() {
  return state.patterns[state.editorPatternId] || null;
}

function selectedTrack() {
  return state.tracks[state.selectedTrackIndex] || null;
}

function editorTrack() {
  return state.tracks[state.editorTrackIndex] || null;
}

function focusedTrack() {
  return state.tracks[clamp(state.selectedTrackIndex, 0, state.tracks.length - 1)] || null;
}

function graphTrack() {
  for (let i = 0; i < state.tracks.length; i++) {
    if (state.tracks[i] && state.tracks[i].id === state.graphEditorTrackId) return state.tracks[i];
  }
  return null;
}

function noteNameForMidi(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const value = Number(midi);
  const octave = Math.floor(value / 12) - 1;
  return names[((value % 12) + 12) % 12] + String(octave);
}

function shortTrackLabel(track) {
  if (!track || !track.name) return '--';
  const compact = String(track.name).trim();
  if (compact.length <= 4) return compact;
  return compact.slice(0, 4).toUpperCase();
}

function mixerDockMetrics() {
  const bounds = state.pianoBounds;
  if (!bounds || bounds.w <= 0 || bounds.h <= 0) return null;
  const compact = bounds.w < 900;
  const pad = compact ? 8 : 10;
  const gap = compact ? 4 : 6;
  const railOuterH = 14;
  const railPad = 2;
  const railBounds = {
    x: bounds.x + pad,
    y: bounds.y + 4,
    w: Math.max(24, bounds.w - pad * 2),
    h: railOuterH
  };
  const contentTop = railBounds.y + railBounds.h + 6;
  const contentBottom = bounds.y + bounds.h - pad - 6;
  const contentHeight = Math.max(40, contentBottom - contentTop);
  const dockInnerW = Math.max(120, bounds.w - pad * 2);
  const preferredChannelW = 50;
  const totalTracks = Math.max(1, state.tracks.length);
  const visibleCount = Math.max(1, Math.min(totalTracks, Math.floor((dockInnerW + gap) / (preferredChannelW + gap)) || 1));
  const maxStart = Math.max(0, totalTracks - visibleCount);
  const startIndex = clamp(state.mixerScrollIndex, 0, maxStart);
  const channelW = Math.max(50, Math.floor((dockInnerW - gap * Math.max(0, visibleCount - 1)) / visibleCount));
  const titleH = Math.max(10, Math.min(16, Math.floor(contentHeight * 0.15)));
  const buttonW = channelW < 54 ? 20 : 22;
  const buttonH = Math.max(12, Math.min(18, Math.floor(contentHeight * 0.16)));
  const buttonGapY = contentHeight < 110 ? 2 : 4;
  const valueReserve = contentHeight >= 100 ? 14 : 0;
  const controlsBottomY = contentBottom - (buttonH * 2 + buttonGapY);
  const faderY = contentTop + titleH + 4;
  const faderBottomY = controlsBottomY - 6 - valueReserve;
  const faderH = Math.max(24, faderBottomY - faderY);
  const faderW = channelW >= 60 ? 30 : 26;
  const thumbW = maxStart === 0
    ? railBounds.w
    : Math.max(20, Math.round((railBounds.w * visibleCount) / totalTracks));
  const thumbTravel = Math.max(0, railBounds.w - thumbW);
  const thumbX = railBounds.x + (maxStart > 0 ? Math.round((startIndex / maxStart) * thumbTravel) : 0);
  const thumbBounds = {
    x: thumbX,
    y: railBounds.y + railPad,
    w: thumbW,
    h: Math.max(4, railBounds.h - railPad * 2)
  };
  return {
    pad,
    gap,
    railBounds,
    thumbBounds,
    startIndex,
    visibleCount,
    maxStart,
    channelW,
    titleH,
    buttonW,
    buttonH,
    buttonGapY,
    controlsBottomY,
    faderY,
    faderH,
    faderW,
    showSliderValue: valueReserve > 0,
    stripTop: contentTop,
    stripHeight: Math.max(32, contentHeight)
  };
}

function mixerRailHit(x, y) {
  if (state.bottomPanelMode !== 'mixer') return false;
  const rail = state.mixerRailBounds;
  return !!rail && x >= rail.x && x < rail.x + rail.w && y >= rail.y && y < rail.y + rail.h;
}

function beginMixerRailInteraction(x, y) {
  const metrics = mixerDockMetrics();
  if (!metrics) return false;
  state.pointerMode = 'mixer-rail';
  state.mixerRailStartY = y;
  state.mixerRailStartHeight = state.pianoStripHeight;
  const thumb = metrics.thumbBounds;
  state.mixerRailDragOffset = (x >= thumb.x && x < thumb.x + thumb.w) ? x - thumb.x : Math.round(thumb.w / 2);
  updateMixerRailInteraction(x, y);
  setStatus('Scrolling and resizing bottom mixer from the dock rail.');
  return true;
}

function updateMixerRailInteraction(x, y) {
  if (state.pointerMode !== 'mixer-rail') return false;
  const metrics = mixerDockMetrics();
  if (metrics) {
    const thumbTravel = Math.max(0, metrics.railBounds.w - metrics.thumbBounds.w);
    if (metrics.maxStart > 0 && thumbTravel > 0) {
      const thumbX = clamp(x - state.mixerRailDragOffset, metrics.railBounds.x, metrics.railBounds.x + thumbTravel);
      const ratio = (thumbX - metrics.railBounds.x) / thumbTravel;
      state.mixerScrollIndex = clamp(Math.round(ratio * metrics.maxStart), 0, metrics.maxStart);
    } else {
      state.mixerScrollIndex = 0;
    }
  }
  const scaleY = Math.max(0.0001, Number(state.layoutScaleY) || 1);
  const delta = (y - state.mixerRailStartY) / scaleY;
  state.pianoStripHeight = clamp(Math.round(state.mixerRailStartHeight - delta), currentBottomPanelMinHeight('mixer'), 320);
  return true;
}

function endMixerRailInteraction() {
  if (state.pointerMode !== 'mixer-rail') return;
  state.pointerMode = 'idle';
  setStatus('Bottom mixer dock set to height ' + String(state.pianoStripHeight) + '.');
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function globalRowToMidi(rowIndex) {
  return state.midiTop - rowIndex;
}

function visibleRowToGlobal(rowIndex) {
  return state.noteViewRowOffset + rowIndex;
}

function rowToMidi(rowIndex) {
  return globalRowToMidi(visibleRowToGlobal(rowIndex));
}

function setStatus(text) {
  state.statusText = String(text == null ? '' : text);
  syncTopBarText();
}

function setTransportText(text) {
  state.transportText = String(text || '');
  syncTopBarText();
}

function setNowPlaying(text) {
  state.lastNoteText = String(text || '(none)');
  if (state.widgets && state.widgets.nowPlaying) state.widgets.nowPlaying.setText('Last note: ' + state.lastNoteText);
}

function setGraphStatus(text) {
  if (state.widgets && state.widgets.graphStatus) state.widgets.graphStatus.setText(String(text || ''));
}

function syncTopBarText() {
  if (!state.widgets || !state.widgets.transportLabel) return;
  const track = selectedTrack();
  const parts = [state.transportText || 'Stopped'];
  if (track) parts.push('Track ' + track.name);
  if (state.selectedPatternId) parts.push('Pattern ' + state.selectedPatternId);
  if (state.statusText) parts.push(state.statusText);
  state.widgets.transportLabel.setText(parts.join(' | '));
}

function clearTapState() {
  state.lastTapAt = 0;
  state.lastTapTrackIndex = -1;
  state.lastTapSlotIndex = -1;
}

function bottomPanelMinHeight(compact, mode) {
  if (mode === 'mixer') return compact ? 146 : 164;
  return compact ? 88 : 104;
}

function currentBottomPanelMinHeight(mode) {
  const viewport = gui.getViewportRect();
  const responsive = gui.getResponsiveInfo(viewport);
  const width = Math.max(720, Math.floor(viewport.width || responsive.usableWidth || 0));
  const compact = responsive.breakpoint === 'xs' || responsive.breakpoint === 'sm' || width < 1180;
  return bottomPanelMinHeight(compact, mode || state.bottomPanelMode);
}

function setBottomPanelMode(mode) {
  const nextMode = mode === 'mixer' ? 'mixer' : 'keys';
  if (state.bottomPanelMode === nextMode) return;
  state.bottomPanelMode = nextMode;
  state.pianoStripHeight = Math.max(state.pianoStripHeight, currentBottomPanelMinHeight(nextMode));
  syncWidgets();
  setStatus(nextMode === 'mixer' ? 'Bottom dock switched to mixer.' : 'Bottom dock switched to keys.');
}

function syncWidgets() {
  if (!state.widgets) return;

  if (typeof state.widgets.playButton.setLabel === 'function') {
    state.widgets.playButton.setLabel(state.isPlaying ? 'Pause' : 'Play');
    state.widgets.keysModeButton.setLabel(state.bottomPanelMode === 'keys' ? '[Keys]' : 'Keys');
    state.widgets.mixerModeButton.setLabel(state.bottomPanelMode === 'mixer' ? '[Mixer]' : 'Mixer');
  }
  state.widgets.closeEditorButton.setVisible(!!state.editorOpen);

  if (typeof state.widgets.assignAButton.setLabel === 'function') {
    state.widgets.assignAButton.setLabel(state.selectedPatternId === 'A' ? '[A]' : 'A');
    state.widgets.assignBButton.setLabel(state.selectedPatternId === 'B' ? '[B]' : 'B');
    state.widgets.assignCButton.setLabel(state.selectedPatternId === 'C' ? '[C]' : 'C');
  }

  state.widgets.assignLabel.setVisible(false);
  state.widgets.assignAButton.setVisible(false);
  state.widgets.assignBButton.setVisible(false);
  state.widgets.assignCButton.setVisible(false);
  state.widgets.status.setVisible(false);
  state.widgets.selectionInfo.setVisible(false);

  state.widgets.pianoLabel.setVisible(false);
  state.widgets.nowPlaying.setVisible(false);
  state.widgets.piano.setVisible(state.bottomPanelMode === 'keys');

  if (state.widgets.trackSoloButtons) {
    for (let i = 0; i < state.tracks.length; i++) {
      const track = state.tracks[i];
      if (!track) continue;
      const mixerVisible = state.bottomPanelMode === 'mixer';
      state.widgets.trackSoloButtons[i].setVisible(mixerVisible);
      state.widgets.trackMuteButtons[i].setVisible(mixerVisible);
      state.widgets.trackVolumeSliders[i].setVisible(mixerVisible);
      if (typeof state.widgets.trackSoloButtons[i].setLabel === 'function') {
        state.widgets.trackSoloButtons[i].setLabel(track.solo ? '[S]' : 'S');
        state.widgets.trackMuteButtons[i].setLabel(track.muted ? '[M]' : 'M');
      }
    }
  }

  const graphVisible = !!state.graphEditorTrackId;
  state.widgets.graphTitle.setVisible(graphVisible);
  state.widgets.graphStatus.setVisible(graphVisible);
  state.widgets.graphEditor.setVisible(graphVisible);
  state.widgets.applyGraphButton.setVisible(graphVisible);
  state.widgets.resetGraphButton.setVisible(graphVisible);
  state.widgets.closeGraphButton.setVisible(graphVisible);
}

function nextSeed() {
  state.playCounter += 1;
  return (Number(state.seed) + state.playCounter) >>> 0;
}

function resumeAudioIfNeeded() {
  try {
    if (audio && audio.context && typeof audio.context.resume === 'function') {
      const result = audio.context.resume();
      if (result && typeof result.catch === 'function') result.catch(function () {});
    }
  } catch {}
}

function buildTunedPreset(basePreset, hz) {
  const preset = deepClone(basePreset || DEFAULT_MONO_PRESET);
  if (!preset.vars || typeof preset.vars !== 'object') preset.vars = {};
  preset.vars.rootHz = Number(Number(hz).toFixed(4));
  if (preset.vars.tone == null) preset.vars.tone = 2100;
  return preset;
}

function applyDurationToPreset(preset, durationSec) {
  const safeDuration = Math.max(0.06, Number(durationSec) || 0.12);
  const nodes = Array.isArray(preset.nodes) ? preset.nodes : [];
  const events = Array.isArray(preset.events) ? preset.events : [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (!node || typeof node !== 'object') continue;
    if (typeof node.stopAfter === 'number' || node.kind === 'oscVoice' || node.kind === 'noiseVoice' || node.kind === 'lfo') {
      node.stopAfter = Number((safeDuration + 0.05).toFixed(4));
    }
  }
  for (let j = 0; j < events.length; j++) {
    const event = events[j];
    if (!event || event.kind !== 'envAR') continue;
    event.release = Number(Math.max(0.05, safeDuration * 0.85).toFixed(4));
  }
  return preset;
}

function stepDurationBeats() {
  return 0.25;
}

function stepDurationSeconds() {
  return (60 / clamp(state.bpm, 40, 220)) * stepDurationBeats();
}

function graphPresetForTrack(track) {
  return track && track.graphPreset ? track.graphPreset : DEFAULT_MONO_PRESET;
}

function hasSoloTracks() {
  for (let i = 0; i < state.tracks.length; i++) {
    if (state.tracks[i] && state.tracks[i].solo) return true;
  }
  return false;
}

function isTrackAudible(track) {
  if (!track || track.muted) return false;
  if (hasSoloTracks()) return !!track.solo;
  return true;
}

function effectiveTrackBusGain(track) {
  if (!track) return 0;
  if (!isTrackAudible(track)) return 0;
  return clamp(track.volume == null ? 1 : track.volume, 0, 1);
}

function voiceGainForTrack(track, velocity) {
  if (!track) return 0;
  return clamp(clamp(track.gain == null ? 1 : track.gain, 0.05, 1) * clamp(velocity == null ? 0.8 : velocity, 0.05, 1), 0, 1);
}

function audioContextOrNull() {
  try {
    if (audio && audio.context) return audio.context;
  } catch {}
  return null;
}

function syncMixerRouting() {
  const ctx = audioContextOrNull();
  if (!ctx || !state.masterBus) return;
  state.masterBus.gain.value = clamp(state.masterVolume, 0, 1);
  for (let i = 0; i < state.tracks.length; i++) {
    const track = state.tracks[i];
    if (!track) continue;
    const bus = state.trackBuses[track.id];
    if (!bus) continue;
    bus.gain.value = effectiveTrackBusGain(track);
  }
}

function ensureMixerRouting() {
  const ctx = audioContextOrNull();
  if (!ctx) return false;
  if (!state.masterBus || state.masterBus.context !== ctx) {
    state.masterBus = ctx.createGain();
    state.masterBus.connect(ctx.destination);
    state.trackBuses = {};
    state.mixerReady = false;
  }
  for (let i = 0; i < state.tracks.length; i++) {
    const track = state.tracks[i];
    if (!track) continue;
    const bus = state.trackBuses[track.id];
    if (!bus || bus.context !== ctx) {
      state.trackBuses[track.id] = ctx.createGain();
      state.trackBuses[track.id].connect(state.masterBus);
    }
  }
  state.mixerReady = true;
  syncMixerRouting();
  return true;
}

function trackBusFor(track) {
  if (!track) return null;
  ensureMixerRouting();
  return state.trackBuses[track.id] || null;
}

function toggleTrackMute(index) {
  const track = state.tracks[index];
  if (!track) return;
  track.muted = !track.muted;
  syncMixerRouting();
  syncWidgets();
  setStatus((track.muted ? 'Muted ' : 'Unmuted ') + track.name + '.');
}

function toggleTrackSolo(index) {
  const track = state.tracks[index];
  if (!track) return;
  track.solo = !track.solo;
  syncMixerRouting();
  syncWidgets();
  setStatus((track.solo ? 'Solo enabled for ' : 'Solo disabled for ') + track.name + '.');
}

function auditionMidiWithTrack(track, midi, velocity, sourceLabel, stepLength) {
  resumeAudioIfNeeded();
  ensureMixerRouting();
  if (!isTrackAudible(track)) {
    setNowPlaying(noteNameForMidi(midi) + ' muted on ' + sourceLabel);
    return;
  }
  const hz = midiToHz(midi);
  const durationSec = stepDurationSeconds() * Math.max(1, Number(stepLength) || 1);
  const preset = applyDurationToPreset(buildTunedPreset(graphPresetForTrack(track), hz), durationSec);
  stfxr.playPreset(preset, nextSeed(), {
    volume: voiceGainForTrack(track, velocity),
    output: trackBusFor(track)
  });
  setNowPlaying(noteNameForMidi(midi) + ' from ' + sourceLabel);
}

function openNoteEditor(patternId, trackIndex) {
  state.editorOpen = true;
  state.editorPatternId = patternId;
  state.editorTrackIndex = clamp(trackIndex, 0, state.tracks.length - 1);
  state.selectedPatternId = patternId;
  state.selectedTrackIndex = state.editorTrackIndex;
  syncWidgets();
  setStatus('Opened note editor for pattern ' + patternId + ' on ' + state.tracks[state.editorTrackIndex].name + '.');
}

function closeNoteEditor() {
  state.editorOpen = false;
  state.pointerMode = 'idle';
  state.activeNoteId = null;
  syncWidgets();
  setStatus('Closed note editor.');
}

function openGraphEditor(trackIndex) {
  const track = state.tracks[clamp(trackIndex, 0, state.tracks.length - 1)];
  if (!track) return;
  state.selectedTrackIndex = trackIndex;
  state.graphEditorTrackId = track.id;
  if (state.widgets && state.widgets.graphEditor) {
    state.widgets.graphEditor.setValue(String(track.graphText || JSON.stringify(DEFAULT_MONO_PRESET, null, 2)));
  }
  syncWidgets();
  setGraphStatus('Editing graph for ' + track.name + '.');
  setStatus('Opened graph editor for ' + track.name + '.');
}

function closeGraphEditor() {
  state.graphEditorTrackId = null;
  syncWidgets();
  setStatus('Closed graph editor.');
}

function parseGraphEditor() {
  const track = graphTrack();
  if (!track || !state.widgets || !state.widgets.graphEditor) return false;
  const raw = String(state.widgets.graphEditor.getValue() || '').trim();
  if (!raw) {
    state.graphError = 'Graph JSON is empty.';
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
  try {
    track.graphPreset = JSON.parse(raw);
    track.graphText = raw;
    state.graphError = '';
    setGraphStatus('Applied graph for ' + track.name + '.');
    setStatus('Applied graph for ' + track.name + '.');
    return true;
  } catch (error) {
    state.graphError = 'Graph parse error: ' + String(error && error.message ? error.message : error);
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
}

function resetGraphEditor() {
  const track = graphTrack();
  if (!track || !state.widgets) return;
  track.graphPreset = deepClone(DEFAULT_MONO_PRESET);
  track.graphText = JSON.stringify(DEFAULT_MONO_PRESET, null, 2);
  state.widgets.graphEditor.setValue(track.graphText);
  setGraphStatus('Reset graph for ' + track.name + '.');
  setStatus('Reset graph for ' + track.name + '.');
}

function getTransportBeats() {
  if (!state.isPlaying) return state.pauseBeats;
  const bpm = clamp(state.bpm, 40, 220);
  const elapsed = Math.max(0, audio.currentTime - state.startAudioTime);
  return state.startBeatOffset + elapsed * (bpm / 60);
}

function arrangementTotalSteps() {
  return state.arrangementSlotCount * state.patternStepCount;
}

function startTransport() {
  resumeAudioIfNeeded();
  if (state.isPlaying) return;
  state.startAudioTime = audio.currentTime;
  state.startBeatOffset = state.pauseBeats;
  state.isPlaying = true;
  state.lastProcessedStep = Math.floor(getTransportBeats() / stepDurationBeats());
  syncWidgets();
  setStatus('Transport running.');
}

function pauseTransport() {
  if (!state.isPlaying) return;
  state.pauseBeats = getTransportBeats();
  state.isPlaying = false;
  syncWidgets();
  setStatus('Transport paused.');
}

function stopTransport() {
  state.pauseBeats = 0;
  state.startBeatOffset = 0;
  state.isPlaying = false;
  state.lastProcessedStep = -1;
  state.currentStep = 0;
  syncWidgets();
  setStatus('Transport stopped and rewound.');
}

function triggerArrangementStep(globalStep) {
  const safeStep = globalStep % arrangementTotalSteps();
  const slotIndex = Math.floor(safeStep / state.patternStepCount);
  const patternStep = safeStep % state.patternStepCount;
  for (let trackIndex = 0; trackIndex < state.tracks.length; trackIndex++) {
    const track = state.tracks[trackIndex];
    const patternId = track.slots[slotIndex] || '.';
    if (patternId === '.') continue;
    const pattern = state.patterns[patternId];
    if (!pattern) continue;
    for (let i = 0; i < pattern.notes.length; i++) {
      const note = pattern.notes[i];
      if (!note || note.start !== patternStep) continue;
      auditionMidiWithTrack(track, globalRowToMidi(note.row) + track.transpose, note.velocity, track.name + ' / ' + patternId, note.length);
    }
  }
  state.currentStep = safeStep;
}

function updateTransport() {
  const beat = getTransportBeats();
  const globalStep = Math.floor(beat / stepDurationBeats());
  if (state.isPlaying && globalStep > state.lastProcessedStep) {
    for (let step = state.lastProcessedStep + 1; step <= globalStep; step++) {
      triggerArrangementStep(step % arrangementTotalSteps());
    }
    state.lastProcessedStep = globalStep;
  }
  const safeStep = state.currentStep % arrangementTotalSteps();
  const slotIndex = Math.floor(safeStep / state.patternStepCount) + 1;
  const patternStep = (safeStep % state.patternStepCount) + 1;
  setTransportText(
    (state.isPlaying ? 'Running' : 'Stopped') +
    ' | Slot ' + String(slotIndex).padStart(2, '0') +
    ' | Step ' + String(patternStep).padStart(2, '0') +
    ' | BPM ' + String(Math.round(state.bpm))
  );
}

function mixerRowTop(index) {
  return state.rightPanelBounds.y + 34 + index * 40;
}

function layoutWidgets() {
  if (!state.widgets) return;
  const viewport = gui.getViewportRect();
  const deviceWidth = Math.max(1, Number(ui.metrics.canvasWidth || 0));
  const deviceHeight = Math.max(1, Number(ui.metrics.canvasHeight || 0));
  const responsive = gui.getResponsiveInfo(viewport);
  const scaleX = viewport.width > 0 ? deviceWidth / viewport.width : 1;
  const scaleY = viewport.height > 0 ? deviceHeight / viewport.height : 1;
  const width = Math.max(720, Math.floor(viewport.width || responsive.usableWidth || 0));
  const height = Math.max(520, Math.floor(viewport.height || responsive.usableHeight || 0));
  const compact = responsive.breakpoint === 'xs' || responsive.breakpoint === 'sm' || width < 1180;
  const rightPanelWidth = compact ? 220 : 280;
  const pad = compact ? 10 : 16;
  const gap = compact ? 8 : 12;
  const stripH = compact ? 60 : 68;
  const pianoStripMinH = bottomPanelMinHeight(compact, state.bottomPanelMode);
  const leftX = Math.floor(viewport.x || 0);
  const topY = Math.floor((viewport.y || 0) + pad);
  const contentWidth = Math.max(320, width);
  const contentHeight = Math.max(240, height - pad * 2);
  const pianoStripH = clamp(state.pianoStripHeight || (compact ? 128 : 142), pianoStripMinH, Math.max(pianoStripMinH, contentHeight - 220 - gap));
  state.pianoStripHeight = pianoStripH;
  const stageHeight = Math.max(220, contentHeight - pianoStripH - gap);
  const panelY = topY + stripH + gap;
  const panelH = stageHeight - stripH - gap;
  const rightPanelX = leftX + contentWidth - rightPanelWidth;
  const mainX = leftX;
  const mainW = Math.max(240, rightPanelX - gap - mainX);
  const mainY = panelY;
  const mainH = panelH;
  const pianoY = topY + stageHeight + gap;
  const toDeviceRect = function (bounds) {
    return {
      x: Math.round(bounds.x * scaleX),
      y: Math.round(bounds.y * scaleY),
      w: Math.max(1, Math.round(bounds.w * scaleX)),
      h: Math.max(0, Math.round(bounds.h * scaleY)),
      headerH: Math.max(1, Math.round(bounds.headerH * scaleY)),
      labelW: Math.max(1, Math.round(bounds.labelW * scaleX)),
      rowH: Math.max(1, Math.round((bounds.rowH || 28) * scaleY))
    };
  };
  const toDeviceBox = function (x, y, widthValue, heightValue) {
    return {
      x: Math.round(x * scaleX),
      y: Math.round(y * scaleY),
      width: Math.max(1, Math.round(widthValue * scaleX)),
      height: Math.max(1, Math.round(heightValue * scaleY))
    };
  };

  if (width === state.layoutSize.width
    && height === state.layoutSize.height
    && state.layoutSize.editorOpen === !!state.editorOpen
    && state.layoutSize.graphOpen === !!state.graphEditorTrackId
    && state.layoutSize.pianoStripHeight === pianoStripH
    && state.layoutSize.bottomPanelMode === state.bottomPanelMode) {
    return;
  }
  state.layoutSize = {
    width: width,
    height: height,
    editorOpen: !!state.editorOpen,
    graphOpen: !!state.graphEditorTrackId,
    pianoStripHeight: pianoStripH,
    bottomPanelMode: state.bottomPanelMode
  };
  state.layoutScaleY = scaleY;

  state.transportBounds = toDeviceRect({ x: leftX, y: topY, w: contentWidth, h: stripH, headerH: 0, labelW: 0, rowH: 0 });
  state.sidebarBounds = toDeviceRect({ x: leftX, y: panelY, w: 0, h: 0, headerH: 0, labelW: 0, rowH: 0 });
  state.rightPanelBounds = toDeviceRect({ x: rightPanelX, y: panelY, w: rightPanelWidth, h: panelH, headerH: 0, labelW: 0, rowH: 0 });
  state.pianoBounds = toDeviceRect({ x: leftX, y: pianoY, w: contentWidth, h: pianoStripH, headerH: 0, labelW: 0, rowH: 0 });

  const stripButtonW = compact ? 84 : 92;
  const closeButtonW = compact ? 110 : 124;
  const dockModeW = compact ? 80 : 90;
  const stripSliderW = compact ? Math.max(120, Math.floor((contentWidth - 340) * 0.36)) : 220;
  const stripY = topY + Math.max(8, Math.floor((stripH - 42) / 2));
  let stripX = leftX + 10;
  state.widgets.playButton.setBounds(toDeviceBox(stripX, stripY, stripButtonW, 40));
  stripX += stripButtonW + gap;
  state.widgets.stopButton.setBounds(toDeviceBox(stripX, stripY, stripButtonW, 40));
  stripX += stripButtonW + gap;
  state.widgets.keysModeButton.setBounds(toDeviceBox(stripX, stripY, dockModeW, 40));
  stripX += dockModeW + gap;
  state.widgets.mixerModeButton.setBounds(toDeviceBox(stripX, stripY, dockModeW, 40));
  stripX += dockModeW + gap;
  state.widgets.tempoSlider.setBounds(toDeviceBox(stripX, stripY, stripSliderW, 42));
  stripX += stripSliderW + gap;
  state.widgets.volumeSlider.setBounds(toDeviceBox(stripX, stripY, stripSliderW, 42));
  state.widgets.transportLabel.setBounds(toDeviceBox(leftX + 10, topY + 6, contentWidth - 20, 20));
  state.widgets.closeEditorButton.setBounds(toDeviceBox(leftX + contentWidth - closeButtonW - 10, stripY, closeButtonW, 40));

  state.widgets.status.setBounds(toDeviceBox(leftX, panelY, 1, 1));
  state.widgets.assignLabel.setBounds(toDeviceBox(leftX, panelY, 1, 1));
  state.widgets.assignAButton.setBounds(toDeviceBox(leftX, panelY, 1, 1));
  state.widgets.assignBButton.setBounds(toDeviceBox(leftX, panelY, 1, 1));
  state.widgets.assignCButton.setBounds(toDeviceBox(leftX, panelY, 1, 1));
  state.widgets.selectionInfo.setBounds(toDeviceBox(leftX, panelY, 1, 1));

  state.widgets.pianoLabel.setBounds(toDeviceBox(leftX, pianoY, 1, 1));
  state.widgets.nowPlaying.setBounds(toDeviceBox(leftX, pianoY, 1, 1));
  state.widgets.piano.setBounds(toDeviceBox(leftX, pianoY, contentWidth, pianoStripH));

  const mixerMetrics = mixerDockMetrics();
  if (mixerMetrics) {
    state.mixerRailBounds = { x: mixerMetrics.railBounds.x, y: mixerMetrics.railBounds.y, w: mixerMetrics.railBounds.w, h: mixerMetrics.railBounds.h };
    state.mixerRailThumbBounds = { x: mixerMetrics.thumbBounds.x, y: mixerMetrics.thumbBounds.y, w: mixerMetrics.thumbBounds.w, h: mixerMetrics.thumbBounds.h };
    state.mixerVisibleTrackCount = mixerMetrics.visibleCount;
    state.mixerScrollIndex = mixerMetrics.startIndex;
  }
  for (let i = 0; i < state.tracks.length; i++) {
    const metrics = mixerMetrics;
    const visible = !!metrics && state.bottomPanelMode === 'mixer' && i >= metrics.startIndex && i < metrics.startIndex + metrics.visibleCount;
    state.widgets.trackSoloButtons[i].setVisible(visible);
    state.widgets.trackMuteButtons[i].setVisible(visible);
    state.widgets.trackVolumeSliders[i].setVisible(visible);
    if (!metrics || !visible) {
      state.widgets.trackVolumeSliders[i].setBounds({ x: state.pianoBounds.x, y: state.pianoBounds.y, width: 1, height: 1 });
      state.widgets.trackSoloButtons[i].setBounds({ x: state.pianoBounds.x, y: state.pianoBounds.y, width: 1, height: 1 });
      state.widgets.trackMuteButtons[i].setBounds({ x: state.pianoBounds.x, y: state.pianoBounds.y, width: 1, height: 1 });
      continue;
    }
    const visibleIndex = i - metrics.startIndex;
    const stripLeft = metrics.railBounds.x + visibleIndex * (metrics.channelW + metrics.gap);
    state.widgets.trackVolumeSliders[i].showValue = metrics.showSliderValue;
    state.widgets.trackVolumeSliders[i].setBounds({
      x: stripLeft + Math.max(0, Math.floor((metrics.channelW - metrics.faderW) / 2)),
      y: metrics.faderY,
      width: metrics.faderW,
      height: metrics.faderH
    });
    state.widgets.trackSoloButtons[i].setBounds({
      x: stripLeft + Math.max(0, Math.floor((metrics.channelW - metrics.buttonW) / 2)),
      y: metrics.controlsBottomY,
      width: metrics.buttonW,
      height: metrics.buttonH
    });
    state.widgets.trackMuteButtons[i].setBounds({
      x: stripLeft + Math.max(0, Math.floor((metrics.channelW - metrics.buttonW) / 2)),
      y: metrics.controlsBottomY + metrics.buttonH + metrics.buttonGapY,
      width: metrics.buttonW,
      height: metrics.buttonH
    });
  }

  if (state.graphEditorTrackId) {
    const buttonW = Math.floor((rightPanelWidth - gap) / 2);
    const graphButtonsY = panelY + panelH - 40;
    const graphEditorY = panelY + 70;
    const graphEditorHeight = Math.max(100, graphButtonsY - gap - graphEditorY);
    state.widgets.graphTitle.setBounds(toDeviceBox(rightPanelX + 10, panelY + 10, rightPanelWidth - 118, 24));
    state.widgets.closeGraphButton.setBounds(toDeviceBox(rightPanelX + rightPanelWidth - 100, panelY + 4, 100, 34));
    state.widgets.graphStatus.setBounds(toDeviceBox(rightPanelX + 10, panelY + 34, rightPanelWidth - 20, 28));
    state.widgets.graphEditor.setBounds(toDeviceBox(rightPanelX, graphEditorY, rightPanelWidth, graphEditorHeight));
    state.widgets.applyGraphButton.setBounds(toDeviceBox(rightPanelX, graphButtonsY, buttonW, 40));
    state.widgets.resetGraphButton.setBounds(toDeviceBox(rightPanelX + buttonW + gap, graphButtonsY, buttonW, 40));
  } else {
    state.widgets.graphTitle.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
    state.widgets.closeGraphButton.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
    state.widgets.graphStatus.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
    state.widgets.graphEditor.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
    state.widgets.applyGraphButton.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
    state.widgets.resetGraphButton.setBounds(toDeviceBox(rightPanelX, panelY, 1, 1));
  }

  if (state.editorOpen) {
    state.noteBounds = toDeviceRect({ x: mainX, y: mainY, w: mainW, h: mainH, headerH: 28, labelW: 56, rowH: 0 });
    state.arrangementBounds = toDeviceRect({ x: mainX, y: mainY, w: mainW, h: 0, headerH: 26, labelW: 86, rowH: 28 });
  } else {
    const arrangementHeight = 28 + state.tracks.length * 28 + 28;
    state.arrangementBounds = toDeviceRect({ x: mainX, y: mainY, w: mainW, h: arrangementHeight, headerH: 26, labelW: 86, rowH: 28 });
    state.noteBounds = toDeviceRect({ x: mainX, y: mainY, w: mainW, h: 0, headerH: 28, labelW: 56, rowH: 0 });
  }

  state.noteViewStartStep = clamp(state.noteViewStartStep, 0, Math.max(0, state.patternStepCount - state.visiblePatternSteps));
  state.noteViewRowOffset = clamp(state.noteViewRowOffset, 0, Math.max(0, state.totalRows - state.visibleRows));
}

function arrangementMetrics() {
  const b = state.arrangementBounds;
  return {
    x: b.x + b.labelW,
    y: b.y + b.headerH,
    w: Math.max(1, b.w - b.labelW),
    h: Math.max(1, b.rowH * state.tracks.length),
    cellW: Math.max(1, (b.w - b.labelW) / state.arrangementSlotCount),
    cellH: b.rowH,
    labelX: b.x,
    labelW: b.labelW
  };
}

function arrangementTrackLabelHit(x, y) {
  const m = arrangementMetrics();
  if (x < state.arrangementBounds.x || x >= state.arrangementBounds.x + m.labelW) return null;
  if (y < m.y || y >= m.y + m.h) return null;
  return clamp(Math.floor((y - m.y) / m.cellH), 0, state.tracks.length - 1);
}

function arrangementCellHit(x, y) {
  const m = arrangementMetrics();
  if (x < m.x || x >= m.x + m.w) return null;
  if (y < m.y || y >= m.y + m.h) return null;
  return {
    trackIndex: clamp(Math.floor((y - m.y) / m.cellH), 0, state.tracks.length - 1),
    slotIndex: clamp(Math.floor((x - m.x) / m.cellW), 0, state.arrangementSlotCount - 1)
  };
}

function assignSelectedPatternToSlot(trackIndex, slotIndex) {
  const track = state.tracks[trackIndex];
  if (!track) return;
  track.slots[slotIndex] = state.selectedPatternId;
  state.selectedTrackIndex = trackIndex;
  clearTapState();
  setStatus('Placed pattern ' + state.selectedPatternId + ' on ' + track.name + ' slot ' + String(slotIndex + 1) + '.');
}

function focusArrangementSlot(trackIndex, slotIndex) {
  const track = state.tracks[trackIndex];
  if (!track) return;
  const patternId = track.slots[slotIndex] || '.';
  state.selectedTrackIndex = trackIndex;
  if (patternId !== '.') state.selectedPatternId = patternId;
  syncWidgets();
  setStatus(
    patternId === '.'
      ? 'Focused ' + track.name + ' slot ' + String(slotIndex + 1) + '.'
      : 'Focused pattern ' + patternId + ' on ' + track.name + ' slot ' + String(slotIndex + 1) + '. Double tap to open note editing.'
  );
}

function handleArrangementTap(trackIndex, slotIndex) {
  const track = state.tracks[trackIndex];
  if (!track) return;
  const patternId = track.slots[slotIndex] || '.';
  if (patternId === '.') {
    assignSelectedPatternToSlot(trackIndex, slotIndex);
    return;
  }

  const tapTime = nowSeconds();
  const doubleTap = state.lastTapTrackIndex === trackIndex
    && state.lastTapSlotIndex === slotIndex
    && (tapTime - state.lastTapAt) <= 0.35;

  focusArrangementSlot(trackIndex, slotIndex);

  if (doubleTap) {
    clearTapState();
    openNoteEditor(patternId, trackIndex);
    return;
  }

  state.lastTapAt = tapTime;
  state.lastTapTrackIndex = trackIndex;
  state.lastTapSlotIndex = slotIndex;
}

function moveArrangementPattern(sourceTrackIndex, sourceSlotIndex, targetTrackIndex, targetSlotIndex) {
  const sourceTrack = state.tracks[sourceTrackIndex];
  const targetTrack = state.tracks[targetTrackIndex];
  if (!sourceTrack || !targetTrack) return;
  if (sourceTrackIndex === targetTrackIndex && sourceSlotIndex === targetSlotIndex) {
    focusArrangementSlot(sourceTrackIndex, sourceSlotIndex);
    clearTapState();
    return;
  }

  const sourcePatternId = sourceTrack.slots[sourceSlotIndex] || '.';
  if (sourcePatternId === '.') return;
  const displacedPatternId = targetTrack.slots[targetSlotIndex] || '.';
  sourceTrack.slots[sourceSlotIndex] = displacedPatternId;
  targetTrack.slots[targetSlotIndex] = sourcePatternId;
  state.selectedTrackIndex = targetTrackIndex;
  state.selectedPatternId = sourcePatternId;
  clearTapState();
  setStatus('Moved pattern ' + sourcePatternId + ' to ' + targetTrack.name + ' slot ' + String(targetSlotIndex + 1) + '.');
}

function beginArrangementBlockInteraction(trackIndex, slotIndex, x, y) {
  const track = state.tracks[trackIndex];
  const patternId = track ? (track.slots[slotIndex] || '.') : '.';
  if (patternId === '.') {
    handleArrangementTap(trackIndex, slotIndex);
    return true;
  }
  state.pointerMode = 'arrangement-drag-or-open';
  state.dragTrackIndex = trackIndex;
  state.dragSlotIndex = slotIndex;
  state.dragPatternId = patternId;
  state.dragMoved = false;
  state.dragStartX = x;
  state.dragStartY = y;
  state.selectedTrackIndex = trackIndex;
  state.selectedPatternId = patternId;
  syncWidgets();
  return true;
}

function updateArrangementBlockInteraction(x, y) {
  if (state.pointerMode !== 'arrangement-drag-or-open' && state.pointerMode !== 'arrangement-drag') return false;
  if (state.pointerMode === 'arrangement-drag-or-open') {
    if (Math.abs(x - state.dragStartX) > 6 || Math.abs(y - state.dragStartY) > 6) {
      state.pointerMode = 'arrangement-drag';
      state.dragMoved = true;
      setStatus('Moving pattern ' + state.dragPatternId + '.');
    } else {
      return true;
    }
  }
  return true;
}

function endArrangementBlockInteraction(x, y) {
  if (state.pointerMode === 'arrangement-drag-or-open') {
    handleArrangementTap(state.dragTrackIndex, state.dragSlotIndex);
  } else if (state.pointerMode === 'arrangement-drag') {
    const target = arrangementCellHit(x, y);
    if (target) moveArrangementPattern(state.dragTrackIndex, state.dragSlotIndex, target.trackIndex, target.slotIndex);
  }
  state.pointerMode = 'idle';
  state.dragTrackIndex = -1;
  state.dragSlotIndex = -1;
  state.dragPatternId = '';
  state.dragMoved = false;
}

function noteMetrics() {
  const b = state.noteBounds;
  return {
    x: b.x + b.labelW,
    y: b.y + b.headerH,
    w: Math.max(1, b.w - b.labelW),
    h: Math.max(1, b.h - b.headerH),
    cellW: Math.max(1, (b.w - b.labelW) / state.visiblePatternSteps),
    cellH: Math.max(1, (b.h - b.headerH) / state.visibleRows)
  };
}

function noteGridHit(x, y) {
  if (!state.editorOpen) return null;
  const m = noteMetrics();
  if (x < m.x || y < m.y || x >= m.x + m.w || y >= m.y + m.h) return null;
  return {
    row: state.noteViewRowOffset + clamp(Math.floor((y - m.y) / m.cellH), 0, state.visibleRows - 1),
    step: state.noteViewStartStep + clamp(Math.floor((x - m.x) / m.cellW), 0, state.visiblePatternSteps - 1)
  };
}

function noteScreenRect(note) {
  const m = noteMetrics();
  const startVisible = state.noteViewStartStep;
  const endVisible = startVisible + state.visiblePatternSteps;
  const rowStart = state.noteViewRowOffset;
  const rowEnd = rowStart + state.visibleRows;
  if (note.row < rowStart || note.row >= rowEnd) return null;
  const noteStart = Math.max(note.start, startVisible);
  const noteEnd = Math.min(note.start + note.length, endVisible);
  if (noteEnd <= noteStart) return null;
  return {
    x: Math.round(m.x + (noteStart - startVisible) * m.cellW) + 2,
    y: Math.round(m.y + (note.row - rowStart) * m.cellH) + 2,
    w: Math.max(4, Math.round((noteEnd - noteStart) * m.cellW) - 4),
    h: Math.max(4, Math.round(m.cellH) - 4)
  };
}

function editorPatternNoteHit(x, y) {
  const pattern = editorPattern();
  if (!pattern) return null;
  for (let i = pattern.notes.length - 1; i >= 0; i--) {
    const note = pattern.notes[i];
    const rect = noteScreenRect(note);
    if (!rect) continue;
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return note;
  }
  return null;
}

function getEditorPatternNoteById(id) {
  const pattern = editorPattern();
  if (!pattern) return null;
  for (let i = 0; i < pattern.notes.length; i++) {
    if (pattern.notes[i] && pattern.notes[i].id === id) return pattern.notes[i];
  }
  return null;
}

function beginNoteEditorLeftInteraction(x, y) {
  if (!state.editorOpen) return false;
  const note = editorPatternNoteHit(x, y);
  if (note) {
    state.pointerMode = 'note-delete-or-resize';
    state.activeNoteId = note.id;
    state.noteInteractionStartX = x;
    state.noteInteractionStartY = y;
    return true;
  }
  const hit = noteGridHit(x, y);
  if (!hit) return false;
  const pattern = editorPattern();
  const track = editorTrack();
  if (!pattern || !track) return false;
  const created = addPatternNote(pattern.id, hit.row, hit.step, 1);
  state.pointerMode = 'note-create';
  state.activeNoteId = created.id;
  state.noteInteractionStartX = x;
  state.noteInteractionStartY = y;
  auditionMidiWithTrack(track, globalRowToMidi(created.row) + track.transpose, created.velocity, 'note editor', created.length);
  setStatus('Added note to pattern ' + pattern.id + '.');
  return true;
}

function beginNoteEditorPan(x, y) {
  if (!state.editorOpen) return false;
  const b = state.noteBounds;
  if (!(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
  state.pointerMode = 'note-pan';
  state.noteInteractionStartX = x;
  state.noteInteractionStartY = y;
  state.noteInteractionViewStartStep = state.noteViewStartStep;
  state.noteInteractionViewRowOffset = state.noteViewRowOffset;
  return true;
}

function updateNoteEditorInteraction(x, y) {
  if (state.pointerMode === 'note-pan') {
    const m = noteMetrics();
    state.noteViewStartStep = clamp(state.noteInteractionViewStartStep - Math.round((x - state.noteInteractionStartX) / Math.max(1, m.cellW)), 0, Math.max(0, state.patternStepCount - state.visiblePatternSteps));
    state.noteViewRowOffset = clamp(state.noteInteractionViewRowOffset - Math.round((y - state.noteInteractionStartY) / Math.max(1, m.cellH)), 0, Math.max(0, state.totalRows - state.visibleRows));
    setStatus('Panning note editor.');
    return true;
  }

  const note = getEditorPatternNoteById(state.activeNoteId);
  if (!note) return false;
  if (state.pointerMode === 'note-delete-or-resize') {
    if (Math.abs(x - state.noteInteractionStartX) > 6) {
      state.pointerMode = 'note-resize';
    } else {
      return true;
    }
  }

  if (state.pointerMode === 'note-create' || state.pointerMode === 'note-resize') {
    const hit = noteGridHit(x, y);
    const targetStep = hit ? hit.step : note.start;
    note.length = Math.max(1, Math.min(state.patternStepCount - note.start, (targetStep - note.start) + 1));
    setStatus('Adjusted note length to ' + String(note.length) + ' step' + (note.length === 1 ? '' : 's') + '.');
    return true;
  }

  return false;
}

function endNoteEditorInteraction() {
  if (state.pointerMode === 'note-delete-or-resize') {
    const pattern = editorPattern();
    if (pattern) {
      pattern.notes = pattern.notes.filter(function (note) { return note.id !== state.activeNoteId; });
      setStatus('Deleted note from pattern ' + pattern.id + '.');
    }
  }
  state.pointerMode = 'idle';
  state.activeNoteId = null;
}

function createWidgets() {
  gui.init();

  const playButton = gui.createButton({ bounds: { x: 0, y: 0, width: 92, height: 40 }, label: 'Play' });
  const stopButton = gui.createButton({ bounds: { x: 0, y: 0, width: 92, height: 40 }, label: 'Stop' });
  const keysModeButton = gui.createButton({ bounds: { x: 0, y: 0, width: 90, height: 40 }, label: '[Keys]' });
  const mixerModeButton = gui.createButton({ bounds: { x: 0, y: 0, width: 90, height: 40 }, label: 'Mixer' });
  const tempoSlider = gui.createSlider({ bounds: { x: 0, y: 0, width: 220, height: 42 }, label: 'Tempo', min: 40, max: 180, value: state.bpm });
  const volumeSlider = gui.createSlider({ bounds: { x: 0, y: 0, width: 220, height: 42 }, label: 'Volume', min: 0, max: 100, value: Math.round(state.masterVolume * 100) });
  const closeEditorButton = gui.createButton({ bounds: { x: 0, y: 0, width: 124, height: 40 }, label: 'Close Editor', visible: false });
  const transportLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 20 }, text: state.transportText, align: 'left' });

  const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 52 }, text: state.statusText, align: 'left' });
  const assignLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 24 }, text: 'Assign pattern', align: 'left' });
  const assignAButton = gui.createButton({ bounds: { x: 0, y: 0, width: 72, height: 36 }, label: 'A' });
  const assignBButton = gui.createButton({ bounds: { x: 0, y: 0, width: 72, height: 36 }, label: 'B' });
  const assignCButton = gui.createButton({ bounds: { x: 0, y: 0, width: 72, height: 36 }, label: 'C' });
  const selectionInfo = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 44 }, text: '', align: 'left' });

  const pianoLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 24 }, text: 'Note editor piano', align: 'left', visible: false });
  const nowPlaying = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 24 }, text: 'Last note: (none)', align: 'left', visible: false });
  const piano = gui.createPianoKeyboard({
    bounds: { x: 0, y: 0, width: 200, height: 96 },
    minMidi: state.midiTop - state.totalRows + 1,
    maxMidi: state.midiTop,
    railGestureMode: 'scroll-resize',
    railResizeMinCrossSize: 88,
    railResizeMaxCrossSize: 320,
    visibleWhiteKeys: 10,
    minVisibleWhiteKeys: 8,
    maxVisibleWhiteKeys: 16,
    showLabels: 'all',
    interactionMode: 'gate',
    railPlacement: 'leading',
    velocityMode: 'axis-cross',
    visible: true
  });

  const graphTitle = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 24 }, text: 'Track Graph', align: 'left', visible: false });
  const closeGraphButton = gui.createButton({ bounds: { x: 0, y: 0, width: 100, height: 34 }, label: 'Close Graph', visible: false });
  const graphStatus = gui.createLabel({ bounds: { x: 0, y: 0, width: 200, height: 44 }, text: '', align: 'left', visible: false });
  const graphEditor = gui.createTextEditor({ bounds: { x: 0, y: 0, width: 200, height: 180 }, value: JSON.stringify(DEFAULT_MONO_PRESET, null, 2), placeholder: '{\n  "nodes": []\n}', visible: false });
  const applyGraphButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Apply Graph', visible: false });
  const resetGraphButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Reset Graph', visible: false });
  const trackSoloButtons = state.tracks.map(function () {
    return gui.createButton({ bounds: { x: 0, y: 0, width: 38, height: 28 }, label: 'S' });
  });
  const trackMuteButtons = state.tracks.map(function () {
    return gui.createButton({ bounds: { x: 0, y: 0, width: 38, height: 28 }, label: 'M' });
  });
  const trackVolumeSliders = state.tracks.map(function (track) {
    return gui.createSlider({ bounds: { x: 0, y: 0, width: 30, height: 120 }, orientation: 'vertical', label: '', min: 0, max: 100, value: Math.round(clamp(track.volume == null ? 1 : track.volume, 0, 1) * 100), showValue: true, sliderStyle: { trackHeight: 6, knobWidth: 24, knobHeight: 12, valueGap: 4 } });
  });

  piano.on('noteon', function (event) {
    const track = focusedTrack();
    if (!track || !event || !event.data) return;
    auditionMidiWithTrack(track, Number(event.data.midi) + track.transpose, Number(event.data.velocity || 0.7), 'piano', 1);
  });
  piano.on('railgesture', function (event) {
    if (!event || !event.data || !event.data.suggestedBounds) return;
    const scaleY = Math.max(0.0001, Number(state.layoutScaleY) || 1);
    const nextHeight = Math.round(Number(event.data.suggestedBounds.height || 0) / scaleY);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    state.pianoStripHeight = clamp(nextHeight, currentBottomPanelMinHeight('keys'), 320);
    if (event.data.phase === 'start') setStatus('Scrolling and resizing bottom keyboard from the piano rail.');
    if (event.data.phase === 'end') setStatus('Bottom keyboard height set to ' + String(state.pianoStripHeight) + '.');
  });

  state.widgets = {
    playButton,
    stopButton,
    keysModeButton,
    mixerModeButton,
    tempoSlider,
    volumeSlider,
    closeEditorButton,
    transportLabel,
    status,
    assignLabel,
    assignAButton,
    assignBButton,
    assignCButton,
    selectionInfo,
    pianoLabel,
    nowPlaying,
    piano,
    graphTitle,
    closeGraphButton,
    graphStatus,
    graphEditor,
    applyGraphButton,
    resetGraphButton,
    trackSoloButtons,
    trackMuteButtons,
    trackVolumeSliders
  };

  syncWidgets();
  setGraphStatus('');
  ensureMixerRouting();
  layoutWidgets();
}

scope.init = function() {
  term.layerID = 'default';
  initState();
  createWidgets();
};

scope.input = function(event) {
  if (!event || !state.widgets) return;

  if (event.type === 'keydown') {
    if (event.key === ' ') {
      if (state.isPlaying) pauseTransport();
      else startTransport();
      return;
    }
    if (event.key === 'Escape' && state.editorOpen) {
      closeNoteEditor();
      return;
    }
    if (event.key === 'Enter' && (event.mods || []).includes('ctrl')) {
      if (state.graphEditorTrackId) parseGraphEditor();
      return;
    }
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
    if (event.action === 'press') resumeAudioIfNeeded();

    if (event.button === 'left') {
      state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
      if (event.action === 'press') {
        if (mixerRailHit(event.x, event.y)) {
          beginMixerRailInteraction(event.x, event.y);
          return;
        }
        if (state.editorOpen && beginNoteEditorLeftInteraction(event.x, event.y)) return;

        const labelTrack = !state.editorOpen ? arrangementTrackLabelHit(event.x, event.y) : null;
        if (labelTrack != null) {
          openGraphEditor(labelTrack);
          return;
        }

        const arrangementCell = !state.editorOpen ? arrangementCellHit(event.x, event.y) : null;
        if (arrangementCell) {
          beginArrangementBlockInteraction(arrangementCell.trackIndex, arrangementCell.slotIndex, event.x, event.y);
          return;
        }
      }

      if (event.action === 'release') {
        if (state.pointerMode === 'mixer-rail') {
          endMixerRailInteraction();
          return;
        }
        if (state.pointerMode === 'arrangement-drag-or-open' || state.pointerMode === 'arrangement-drag') {
          endArrangementBlockInteraction(event.x, event.y);
          return;
        }
        if (state.pointerMode === 'note-delete-or-resize' || state.pointerMode === 'note-resize' || state.pointerMode === 'note-create') {
          endNoteEditorInteraction();
          return;
        }
      }
    }

    if (event.button === 'middle') {
      state.mouseDownMiddle = event.action === 'press' || event.action === 'repeat';
      if (event.action === 'press' && beginNoteEditorPan(event.x, event.y)) return;
      if (event.action === 'release' && state.pointerMode === 'note-pan') {
        endNoteEditorInteraction();
        return;
      }
    }

    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }

  if (event.type === 'mouse_move') {
    if (state.mouseDownLeft) {
      if (state.pointerMode === 'mixer-rail') {
        updateMixerRailInteraction(event.x, event.y);
        return;
      }
      if (state.pointerMode === 'arrangement-drag-or-open' || state.pointerMode === 'arrangement-drag') {
        updateArrangementBlockInteraction(event.x, event.y);
        return;
      }
      if (state.pointerMode === 'note-delete-or-resize' || state.pointerMode === 'note-resize' || state.pointerMode === 'note-create') {
        updateNoteEditorInteraction(event.x, event.y);
        return;
      }
    }
    if (state.mouseDownMiddle && state.pointerMode === 'note-pan') {
      updateNoteEditorInteraction(event.x, event.y);
      return;
    }
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }
};

scope.update = function() {
  if (!state.widgets) return;

  layoutWidgets();
  gui.handleMouse(getMouseX(), getMouseY(), state.mouseDownLeft);
  gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

  state.bpm = clamp(state.widgets.tempoSlider.getValue() || state.bpm, 40, 180);
  state.masterVolume = clamp((state.widgets.volumeSlider.getValue() || 0) / 100, 0, 1);
  syncMixerRouting();

  for (let i = 0; i < state.tracks.length; i++) {
    const track = state.tracks[i];
    if (!track) continue;
    const sliderValue = clamp((state.widgets.trackVolumeSliders[i].getValue() || 0) / 100, 0, 1);
    if (Math.abs(sliderValue - clamp(track.volume == null ? 1 : track.volume, 0, 1)) > 0.0001) {
      track.volume = sliderValue;
      syncMixerRouting();
    }
    if (state.widgets.trackSoloButtons[i].wasClicked()) toggleTrackSolo(i);
    if (state.widgets.trackMuteButtons[i].wasClicked()) toggleTrackMute(i);
  }

  if (state.widgets.playButton.wasClicked()) {
    if (state.isPlaying) pauseTransport();
    else startTransport();
  }
  if (state.widgets.keysModeButton.wasClicked()) setBottomPanelMode('keys');
  if (state.widgets.mixerModeButton.wasClicked()) setBottomPanelMode('mixer');
  if (state.widgets.stopButton.wasClicked()) stopTransport();
  if (state.widgets.closeEditorButton.wasClicked()) closeNoteEditor();
  if (state.widgets.closeGraphButton.wasClicked()) closeGraphEditor();
  if (state.graphEditorTrackId && state.widgets.applyGraphButton.wasClicked()) parseGraphEditor();
  if (state.graphEditorTrackId && state.widgets.resetGraphButton.wasClicked()) resetGraphEditor();

  if (state.graphEditorTrackId) {
    const track = graphTrack();
    state.widgets.graphTitle.setText('Track Graph: ' + (track ? track.name : '(none)'));
  }

  updateTransport();
};

scope.render = function() {
  const base = getStyle('default');
  ui.clear(base.bg);
  term.layerID = 'default';
  term.clear();

  const strong = ui.colors.rgb(226, 231, 238);
  const subtle = rgba01(226, 231, 238, 0.72);
  const frame = rgba01(255, 255, 255, 0.18);
  const panelBg = rgba01(255, 255, 255, 0.03);
  const headerBg = rgba01(255, 255, 255, 0.05);
  const gridLine = rgba01(255, 255, 255, 0.08);
  const playHead = rgba01(255, 188, 92, 0.18);

  const strip = state.transportBounds;
  ui.rect(strip.x, strip.y, strip.w, strip.h, panelBg);
  ui.rect(strip.x, strip.y, strip.w, 1, frame);
  ui.rect(strip.x, strip.y + strip.h - 1, strip.w, 1, frame);
  ui.rect(strip.x, strip.y, 1, strip.h, frame);
  ui.rect(strip.x + strip.w - 1, strip.y, 1, strip.h, frame);

  const rightPanel = state.rightPanelBounds;
  ui.rect(rightPanel.x, rightPanel.y, rightPanel.w, rightPanel.h, panelBg);
  ui.rect(rightPanel.x, rightPanel.y, rightPanel.w, 1, frame);
  ui.rect(rightPanel.x, rightPanel.y + rightPanel.h - 1, rightPanel.w, 1, frame);
  ui.rect(rightPanel.x, rightPanel.y, 1, rightPanel.h, frame);
  ui.rect(rightPanel.x + rightPanel.w - 1, rightPanel.y, 1, rightPanel.h, frame);

  if (!state.graphEditorTrackId) {
    ui.text('Inspector', rightPanel.x + 10, rightPanel.y + 10, strong);
    ui.text('Selected: ' + (selectedTrack() ? selectedTrack().name : '(none)'), rightPanel.x + 10, rightPanel.y + 162, subtle);
    ui.text('Pattern: ' + state.selectedPatternId, rightPanel.x + 10, rightPanel.y + 180, subtle);
    ui.text('Bottom dock: ' + (state.bottomPanelMode === 'mixer' ? 'Mixer' : 'Keys'), rightPanel.x + 10, rightPanel.y + 198, subtle);
    ui.text('Bottom dock height: ' + String(state.pianoStripHeight), rightPanel.x + 10, rightPanel.y + 216, subtle);
    ui.text('Status: ' + state.statusText, rightPanel.x + 10, rightPanel.y + 244, subtle);
    ui.text('Track name click: open JSON graph editor here.', rightPanel.x + 10, rightPanel.y + 272, subtle);
  }

  const pianoStrip = state.pianoBounds;
  ui.rect(pianoStrip.x, pianoStrip.y, pianoStrip.w, pianoStrip.h, panelBg);
  ui.rect(pianoStrip.x, pianoStrip.y, pianoStrip.w, 1, frame);
  ui.rect(pianoStrip.x, pianoStrip.y + pianoStrip.h - 1, pianoStrip.w, 1, frame);
  ui.rect(pianoStrip.x, pianoStrip.y, 1, pianoStrip.h, frame);
  ui.rect(pianoStrip.x + pianoStrip.w - 1, pianoStrip.y, 1, pianoStrip.h, frame);
  if (state.bottomPanelMode === 'mixer') {
    const metrics = mixerDockMetrics();
    if (metrics) {
      ui.rect(metrics.railBounds.x, metrics.railBounds.y, metrics.railBounds.w, metrics.railBounds.h, rgba01(255, 255, 255, 0.08));
      ui.rect(metrics.thumbBounds.x, metrics.thumbBounds.y, metrics.thumbBounds.w, metrics.thumbBounds.h, state.pointerMode === 'mixer-rail' ? rgba01(255, 188, 92, 0.9) : rgba01(132, 164, 196, 0.9));
      for (let i = metrics.startIndex; i < Math.min(state.tracks.length, metrics.startIndex + metrics.visibleCount); i++) {
      const visibleIndex = i - metrics.startIndex;
      const stripLeft = metrics.railBounds.x + visibleIndex * (metrics.channelW + metrics.gap);
      const track = state.tracks[i];
      if (!track) continue;
      const color = TRACK_COLORS[i % TRACK_COLORS.length];
      const dimmed = !isTrackAudible(track) && !track.solo;
      ui.rect(stripLeft, metrics.stripTop, metrics.channelW, metrics.stripHeight, i === state.selectedTrackIndex ? rgba01(255, 255, 255, 0.05) : rgba01(255, 255, 255, 0.015));
      ui.rect(stripLeft, metrics.stripTop, 3, metrics.stripHeight, color);
      ui.text(shortTrackLabel(track), stripLeft + 6, metrics.stripTop + 4, dimmed ? subtle : strong);
      if (track.solo) ui.text('S', stripLeft + metrics.channelW - 12, metrics.stripTop + 4, color);
      else if (track.muted) ui.text('M', stripLeft + metrics.channelW - 12, metrics.stripTop + 4, subtle);
      }
    }
  }

  if (!state.editorOpen) {
    const a = state.arrangementBounds;
    const m = arrangementMetrics();
    ui.rect(a.x, a.y, a.w, a.h, panelBg);
    ui.rect(a.x, a.y, a.w, a.headerH, headerBg);
    ui.text('Pattern Arranger', a.x + 8, a.y + 5, strong);

    const currentSlot = Math.floor((state.currentStep % arrangementTotalSteps()) / state.patternStepCount);
    for (let slot = 0; slot < state.arrangementSlotCount; slot++) {
      const x = Math.round(m.x + slot * m.cellW);
      const w = Math.ceil(m.cellW);
      if (slot === currentSlot) ui.rect(x, m.y, w, m.h, playHead);
      ui.text(String(slot + 1).padStart(2, '0'), x + 8, a.y + 5, slot === currentSlot ? strong : subtle);
      ui.rect(x, a.y, 1, a.h, gridLine);
    }
    ui.rect(Math.round(m.x + m.w), a.y, 1, a.h, gridLine);

    for (let row = 0; row < state.tracks.length; row++) {
      const y = Math.round(m.y + row * m.cellH);
      const track = state.tracks[row];
      const rowColor = TRACK_COLORS[row % TRACK_COLORS.length];
      ui.rect(a.x, y, a.w, 1, gridLine);
      if (row === state.selectedTrackIndex) ui.rect(a.x, y, a.w, m.cellH, rgba01(255, 255, 255, 0.03));
      ui.text(track.name, a.x + 8, y + Math.max(2, Math.floor((m.cellH - 16) / 2)), rowColor);
      ui.text('graph', a.x + a.labelW - 42, y + Math.max(2, Math.floor((m.cellH - 16) / 2)), subtle);
      for (let slot = 0; slot < state.arrangementSlotCount; slot++) {
        const x = Math.round(m.x + slot * m.cellW) + 2;
        const w = Math.max(4, Math.ceil(m.cellW) - 4);
        const label = track.slots[slot] || '.';
        const fill = label === '.'
          ? rgba01(255, 255, 255, 0.02)
          : (label === state.selectedPatternId ? rgba01(101, 189, 255, 0.35) : rgba01(255, 255, 255, 0.1));
        ui.rect(x, y + 2, w, Math.max(4, m.cellH - 4), fill);
        ui.text(label, x + Math.max(10, Math.floor(m.cellW * 0.4)), y + Math.max(2, Math.floor((m.cellH - 16) / 2)), strong);
      }
    }
    ui.rect(a.x, Math.round(m.y + m.h), a.w, 1, gridLine);
    ui.rect(a.x, a.y, a.w, 1, frame);
    ui.rect(a.x, a.y + a.h - 1, a.w, 1, frame);
    ui.rect(a.x, a.y, 1, a.h, frame);
    ui.rect(a.x + a.w - 1, a.y, 1, a.h, frame);

    const infoY = a.y + a.h + 18;
    ui.text('Empty slot click: place selected pattern.', a.x, infoY, subtle);
    ui.text('Pattern block click: focus pattern and track.', a.x, infoY + 18, subtle);
    ui.text('Pattern block double click: open note editor.', a.x, infoY + 36, subtle);
    ui.text('Track name click: open JSON graph editor in the right panel.', a.x, infoY + 54, subtle);
  }

  if (state.editorOpen) {
    const b = state.noteBounds;
    const m = noteMetrics();
    const pattern = editorPattern();
    const track = editorTrack();
    ui.rect(b.x, b.y, b.w, b.h, panelBg);
    ui.rect(b.x, b.y, b.w, b.headerH, headerBg);
    ui.text('Note Editor: ' + state.editorPatternId + ' on ' + (track ? track.name : '(none)'), b.x + 8, b.y + 6, strong);

    const activePatternStep = state.currentStep % state.patternStepCount;
    for (let step = 0; step < state.visiblePatternSteps; step++) {
      const globalStep = state.noteViewStartStep + step;
      const x = Math.round(m.x + step * m.cellW);
      const w = Math.ceil(m.cellW);
      if (globalStep === activePatternStep) ui.rect(x, m.y, w, m.h, playHead);
      ui.text(String(globalStep + 1).padStart(2, '0'), x + 8, b.y + 6, globalStep === activePatternStep ? strong : subtle);
      ui.rect(x, b.y, 1, b.h, gridLine);
    }
    ui.rect(Math.round(m.x + m.w), b.y, 1, b.h, gridLine);

    for (let row = 0; row < state.visibleRows; row++) {
      const y = Math.round(m.y + row * m.cellH);
      const h = Math.ceil(m.cellH);
      if (row % 2 === 1) ui.rect(b.x, y, b.w, h, rgba01(255, 255, 255, 0.02));
      ui.rect(b.x, y, b.w, 1, gridLine);
      ui.text(noteNameForMidi(rowToMidi(row)), b.x + 8, y + Math.max(2, Math.floor((h - 16) / 2)), subtle);
    }

    if (pattern) {
      for (let i = 0; i < pattern.notes.length; i++) {
        const note = pattern.notes[i];
        const rect = noteScreenRect(note);
        if (!rect) continue;
        const active = activePatternStep >= note.start && activePatternStep < note.start + note.length;
        ui.rect(rect.x, rect.y, rect.w, rect.h, active ? rgba01(255, 196, 104, 0.95) : rgba01(101, 189, 255, 0.88));
        ui.rect(rect.x + rect.w - 3, rect.y + 1, 2, Math.max(2, rect.h - 2), rgba01(255, 255, 255, 0.45));
      }
    }

    ui.rect(b.x, Math.round(m.y + m.h), b.w, 1, gridLine);
    ui.rect(b.x, b.y, b.w, 1, frame);
    ui.rect(b.x, b.y + b.h - 1, b.w, 1, frame);
    ui.rect(b.x, b.y, 1, b.h, frame);
    ui.rect(b.x + b.w - 1, b.y, 1, b.h, frame);
    ui.text('Left empty: add | Left note: delete | Left drag note: resize | Middle drag: pan', b.x + 8, b.y + b.h - 22, subtle);
  }
};
```

## Notes

- The arranger is intentionally compact and clip-oriented.
- The note editor replaces the arranger rather than living beside it.
- Track graphs are now treated as a separate editor surface opened from track labels.
