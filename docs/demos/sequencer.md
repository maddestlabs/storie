---
name: "Pattern Sequencer Sketch"
theme: "nord"
requiresAudioGesture: true
---

A higher-level sequencer sketch that starts in **pattern view** and keeps the **note sequencer hidden by default**.

The idea is:

- Arrange patterns on tracks first
- Open the note sequencer only when you want to edit a specific pattern
- Keep `stfxr` as the synth core underneath both layers

Workflow:

- Left click arrangement cells to cycle pattern assignments
- Select pattern `A`, `B`, or `C`
- Use **Open Note Editor** to reveal the note sequencer for that pattern
- Inside the note editor: left click empty space to add, left click note to delete, left drag note to resize, middle drag to pan

## Demo

```js
let state = {
  mouseDownLeft: false,
  mouseDownMiddle: false,
  editorOpen: false,
  selectedPatternId: 'A',
  selectedTrackIndex: 0,
  pointerMode: 'idle',
  activeNoteId: null,
  interactionStartX: 0,
  interactionStartY: 0,
  interactionViewStartStep: 0,
  interactionViewRowOffset: 0,
  layoutSize: { width: 0, height: 0 },
  arrangementBounds: { x: 0, y: 0, w: 0, h: 0, headerH: 28, labelW: 78 },
  noteBounds: { x: 0, y: 0, w: 0, h: 0, headerH: 28, labelW: 54 },
  widgets: null,
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
  midiTop: 84,
  totalRows: 36,
  visibleRows: 16,
  noteViewStartStep: 0,
  noteViewRowOffset: 10,
  nextNoteId: 1,
  tracks: [],
  patterns: {},
  statusText: 'Pattern view first. Click arrangement cells to assign patterns. Open Note Editor when needed.',
  transportText: 'Stopped',
  graphError: '',
  lastNoteText: '(none)',
  graphPreset: null,
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

function noteId() {
  const id = state.nextNoteId;
  state.nextNoteId += 1;
  return id;
}

function makePattern(id, name) {
  return {
    id: id,
    name: name,
    notes: []
  };
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
  state.tracks = [
    { id: 'lead', name: 'Lead', transpose: 0, gain: 0.8, slots: ['A', '.', 'B', '.', 'A', '.', 'C', '.'] },
    { id: 'bass', name: 'Bass', transpose: -12, gain: 0.72, slots: ['B', '.', 'B', '.', 'C', '.', 'B', '.'] },
    { id: 'arp', name: 'Arp', transpose: 12, gain: 0.58, slots: ['.', 'C', '.', 'A', '.', 'C', '.', 'A'] }
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

function noteNameForMidi(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const value = Number(midi);
  const octave = Math.floor(value / 12) - 1;
  return names[((value % 12) + 12) % 12] + String(octave);
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

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function setStatus(text) {
  state.statusText = String(text == null ? '' : text);
  if (state.widgets && state.widgets.status) state.widgets.status.setText(state.statusText);
}

function setTransportText(text) {
  state.transportText = String(text || '');
  if (state.widgets && state.widgets.transport) state.widgets.transport.setText(state.transportText);
}

function setGraphStatus(text) {
  if (state.widgets && state.widgets.graphStatus) state.widgets.graphStatus.setText(String(text || ''));
}

function setNowPlaying(text) {
  state.lastNoteText = String(text || '(none)');
  if (state.widgets && state.widgets.nowPlaying) state.widgets.nowPlaying.setText('Last note: ' + state.lastNoteText);
}

function syncButtons() {
  if (state.widgets && state.widgets.playButton && typeof state.widgets.playButton.setLabel === 'function') {
    state.widgets.playButton.setLabel(state.isPlaying ? 'Pause' : 'Play');
  }
  if (state.widgets && state.widgets.openEditorButton && typeof state.widgets.openEditorButton.setLabel === 'function') {
    state.widgets.openEditorButton.setLabel(state.editorOpen ? 'Close Note Editor' : 'Open Note Editor');
  }
  if (state.widgets && state.widgets.patternAButton && typeof state.widgets.patternAButton.setLabel === 'function') {
    state.widgets.patternAButton.setLabel(state.selectedPatternId === 'A' ? '[A]' : 'A');
    state.widgets.patternBButton.setLabel(state.selectedPatternId === 'B' ? '[B]' : 'B');
    state.widgets.patternCButton.setLabel(state.selectedPatternId === 'C' ? '[C]' : 'C');
  }
}

function syncEditorVisibility() {
  const visible = !!state.editorOpen;
  if (!state.widgets) return;
  state.widgets.pianoLabel.setVisible(visible);
  state.widgets.nowPlaying.setVisible(visible);
  state.widgets.piano.setVisible(visible);
  state.widgets.graphLabel.setVisible(visible);
  state.widgets.graphStatus.setVisible(visible);
  state.widgets.graphEditor.setVisible(visible);
  state.widgets.applyGraph.setVisible(visible);
  state.widgets.resetGraph.setVisible(visible);
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

function auditionMidi(midi, velocity, sourceLabel, stepLength, gainMul) {
  resumeAudioIfNeeded();
  const hz = midiToHz(midi);
  const durationSec = stepDurationSeconds() * Math.max(1, Number(stepLength) || 1);
  const preset = applyDurationToPreset(buildTunedPreset(state.graphPreset || DEFAULT_MONO_PRESET, hz), durationSec);
  stfxr.playPreset(preset, nextSeed(), {
    volume: clamp(state.masterVolume * clamp(gainMul == null ? 1 : gainMul, 0.05, 1) * clamp(velocity == null ? 0.8 : velocity, 0.05, 1), 0, 1)
  });
  setNowPlaying(noteNameForMidi(midi) + ' from ' + sourceLabel);
}

function parseGraphEditor() {
  if (!state.widgets || !state.widgets.graphEditor) return false;
  const raw = String(state.widgets.graphEditor.getValue() || '').trim();
  if (!raw) {
    state.graphError = 'Graph JSON is empty.';
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
  try {
    state.graphPreset = JSON.parse(raw);
    state.graphError = '';
    setGraphStatus('Graph parsed. Pattern playback and note editing now use this synth.');
    setStatus('Applied synth graph from editor.');
    return true;
  } catch (error) {
    state.graphError = 'Graph parse error: ' + String(error && error.message ? error.message : error);
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
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
  syncButtons();
  setStatus('Transport running. Pattern slots are triggering their note patterns.');
}

function pauseTransport() {
  if (!state.isPlaying) return;
  state.pauseBeats = getTransportBeats();
  state.isPlaying = false;
  syncButtons();
  setStatus('Transport paused.');
}

function stopTransport() {
  state.pauseBeats = 0;
  state.startBeatOffset = 0;
  state.isPlaying = false;
  state.lastProcessedStep = -1;
  state.currentStep = 0;
  syncButtons();
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
      auditionMidi(globalRowToMidi(note.row) + track.transpose, note.velocity, track.name + ' / ' + patternId, note.length, track.gain);
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
    ' | Pattern Step ' + String(patternStep).padStart(2, '0') +
    ' | Beat ' + beat.toFixed(2)
  );
}

function layoutWidgets() {
  if (!state.widgets) return;
  const viewport = gui.getViewportRect();
  const width = Math.max(1120, Math.floor(viewport.width));
  const height = Math.max(820, Math.floor(viewport.height));
  if (width === state.layoutSize.width && height === state.layoutSize.height) return;
  state.layoutSize = { width: width, height: height };

  const pad = 18;
  const gap = 12;
  const leftWidth = Math.max(320, Math.floor(width * 0.30));
  const rightX = pad + leftWidth + gap;
  const rightWidth = width - rightX - pad;
  const editorHeight = state.editorOpen ? Math.max(300, Math.floor(height * 0.44)) : 0;
  const arrangementHeight = state.editorOpen ? height - pad * 2 - editorHeight - gap : height - pad * 2;

  state.widgets.title.setBounds({ x: pad, y: pad, width: leftWidth, height: 28 });
  state.widgets.status.setBounds({ x: pad, y: pad + 30, width: leftWidth, height: 52 });
  state.widgets.transport.setBounds({ x: pad, y: pad + 84, width: leftWidth, height: 24 });

  const buttonY = pad + 118;
  const halfButton = Math.floor((leftWidth - gap) / 2);
  state.widgets.playButton.setBounds({ x: pad, y: buttonY, width: halfButton, height: 40 });
  state.widgets.stopButton.setBounds({ x: pad + halfButton + gap, y: buttonY, width: halfButton, height: 40 });

  state.widgets.tempo.setBounds({ x: pad, y: buttonY + 48, width: leftWidth, height: 42 });
  state.widgets.master.setBounds({ x: pad, y: buttonY + 96, width: leftWidth, height: 42 });
  state.widgets.openEditorButton.setBounds({ x: pad, y: buttonY + 148, width: leftWidth, height: 40 });

  state.widgets.patternLabel.setBounds({ x: pad, y: buttonY + 204, width: leftWidth, height: 24 });
  const third = Math.floor((leftWidth - gap * 2) / 3);
  state.widgets.patternAButton.setBounds({ x: pad, y: buttonY + 236, width: third, height: 40 });
  state.widgets.patternBButton.setBounds({ x: pad + third + gap, y: buttonY + 236, width: third, height: 40 });
  state.widgets.patternCButton.setBounds({ x: pad + (third + gap) * 2, y: buttonY + 236, width: third, height: 40 });

  if (state.editorOpen) {
    const editorTop = buttonY + 300;
    const pianoHeight = 156;
    const graphTop = editorTop + pianoHeight + gap;
    state.widgets.pianoLabel.setBounds({ x: pad, y: editorTop, width: leftWidth, height: 24 });
    state.widgets.nowPlaying.setBounds({ x: pad, y: editorTop + 24, width: leftWidth, height: 24 });
    state.widgets.piano.setBounds({ x: pad, y: editorTop + 54, width: leftWidth, height: pianoHeight - 54 });

    state.widgets.graphLabel.setBounds({ x: pad, y: graphTop, width: leftWidth, height: 24 });
    state.widgets.graphStatus.setBounds({ x: pad, y: graphTop + 24, width: leftWidth, height: 44 });
    state.widgets.graphEditor.setBounds({ x: pad, y: graphTop + 72, width: leftWidth, height: Math.max(120, height - graphTop - 72 - 52) });
    state.widgets.applyGraph.setBounds({ x: pad, y: height - pad - 40, width: halfButton, height: 40 });
    state.widgets.resetGraph.setBounds({ x: pad + halfButton + gap, y: height - pad - 40, width: halfButton, height: 40 });
  }

  state.arrangementBounds = {
    x: rightX,
    y: pad,
    w: rightWidth,
    h: arrangementHeight,
    headerH: 28,
    labelW: 78
  };

  state.noteBounds = {
    x: rightX,
    y: pad + arrangementHeight + gap,
    w: rightWidth,
    h: editorHeight,
    headerH: 28,
    labelW: 54
  };
}

function arrangementMetrics() {
  const b = state.arrangementBounds;
  const innerX = b.x + b.labelW;
  const innerY = b.y + b.headerH;
  const innerW = Math.max(1, b.w - b.labelW);
  const innerH = Math.max(1, b.h - b.headerH);
  return {
    x: innerX,
    y: innerY,
    w: innerW,
    h: innerH,
    cellW: innerW / state.arrangementSlotCount,
    cellH: innerH / state.tracks.length
  };
}

function arrangementHit(x, y) {
  const m = arrangementMetrics();
  if (x < m.x || y < m.y || x >= m.x + m.w || y >= m.y + m.h) return null;
  return {
    trackIndex: clamp(Math.floor((y - m.y) / m.cellH), 0, state.tracks.length - 1),
    slotIndex: clamp(Math.floor((x - m.x) / m.cellW), 0, state.arrangementSlotCount - 1)
  };
}

function cycleArrangementCell(trackIndex, slotIndex) {
  const track = state.tracks[trackIndex];
  if (!track) return;
  const cycle = ['.', 'A', 'B', 'C'];
  const current = track.slots[slotIndex] || '.';
  const index = cycle.indexOf(current);
  const next = cycle[(index + 1 + cycle.length) % cycle.length];
  track.slots[slotIndex] = next;
  state.selectedTrackIndex = trackIndex;
  if (next !== '.') state.selectedPatternId = next;
  syncButtons();
  setStatus(track.name + ' slot ' + String(slotIndex + 1) + ' -> ' + next + '.');
}

function noteMetrics() {
  const b = state.noteBounds;
  const innerX = b.x + b.labelW;
  const innerY = b.y + b.headerH;
  const innerW = Math.max(1, b.w - b.labelW);
  const innerH = Math.max(1, b.h - b.headerH);
  return {
    x: innerX,
    y: innerY,
    w: innerW,
    h: innerH,
    cellW: innerW / state.visiblePatternSteps,
    cellH: innerH / state.visibleRows
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

function patternNoteHit(x, y) {
  const pattern = currentPattern();
  if (!pattern) return null;
  for (let i = pattern.notes.length - 1; i >= 0; i--) {
    const note = pattern.notes[i];
    const rect = noteScreenRect(note);
    if (!rect) continue;
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) return { note: note, rect: rect };
  }
  return null;
}

function beginNoteLeftInteraction(x, y) {
  if (!state.editorOpen) return false;
  const noteHit = patternNoteHit(x, y);
  if (noteHit) {
    state.pointerMode = 'delete-or-resize';
    state.activeNoteId = noteHit.note.id;
    state.interactionStartX = x;
    state.interactionStartY = y;
    return true;
  }
  const hit = noteGridHit(x, y);
  if (!hit) return false;
  const pattern = currentPattern();
  if (!pattern) return false;
  const note = addPatternNote(pattern.id, hit.row, hit.step, 1);
  state.pointerMode = 'create';
  state.activeNoteId = note.id;
  state.interactionStartX = x;
  state.interactionStartY = y;
  auditionMidi(globalRowToMidi(note.row), note.velocity, 'note editor', note.length, 1);
  setStatus('Added ' + noteNameForMidi(globalRowToMidi(note.row)) + ' to ' + pattern.id + ' at step ' + String(note.start + 1) + '.');
  return true;
}

function beginNotePan(x, y) {
  if (!state.editorOpen) return false;
  const b = state.noteBounds;
  if (!(x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return false;
  state.pointerMode = 'pan';
  state.interactionStartX = x;
  state.interactionStartY = y;
  state.interactionViewStartStep = state.noteViewStartStep;
  state.interactionViewRowOffset = state.noteViewRowOffset;
  return true;
}

function getCurrentPatternNoteById(id) {
  const pattern = currentPattern();
  if (!pattern) return null;
  for (let i = 0; i < pattern.notes.length; i++) {
    if (pattern.notes[i] && pattern.notes[i].id === id) return pattern.notes[i];
  }
  return null;
}

function updateNoteInteraction(x, y) {
  if (state.pointerMode === 'idle') return false;
  if (state.pointerMode === 'pan') {
    const m = noteMetrics();
    const dx = x - state.interactionStartX;
    const dy = y - state.interactionStartY;
    state.noteViewStartStep = clamp(state.interactionViewStartStep - Math.round(dx / Math.max(1, m.cellW)), 0, Math.max(0, state.patternStepCount - state.visiblePatternSteps));
    state.noteViewRowOffset = clamp(state.interactionViewRowOffset - Math.round(dy / Math.max(1, m.cellH)), 0, Math.max(0, state.totalRows - state.visibleRows));
    setStatus('Panning note editor. Step ' + String(state.noteViewStartStep + 1) + ', top note ' + noteNameForMidi(globalRowToMidi(state.noteViewRowOffset)) + '.');
    return true;
  }

  const note = getCurrentPatternNoteById(state.activeNoteId);
  if (!note) return false;
  const dx = x - state.interactionStartX;
  if (state.pointerMode === 'delete-or-resize') {
    if (Math.abs(dx) > 6) state.pointerMode = 'resize';
    else return true;
  }

  if (state.pointerMode === 'create' || state.pointerMode === 'resize') {
    const hit = noteGridHit(x, y);
    const targetStep = hit ? hit.step : note.start;
    note.length = Math.max(1, Math.min(state.patternStepCount - note.start, (targetStep - note.start) + 1));
    setStatus('Set ' + currentPattern().id + ' note length to ' + String(note.length) + ' step' + (note.length === 1 ? '' : 's') + '.');
    return true;
  }

  return false;
}

function endNoteInteraction() {
  if (state.pointerMode === 'delete-or-resize') {
    const pattern = currentPattern();
    const note = getCurrentPatternNoteById(state.activeNoteId);
    if (pattern && note) {
      pattern.notes = pattern.notes.filter(function (item) { return item.id !== note.id; });
      setStatus('Deleted note from ' + pattern.id + '.');
    }
  }
  state.pointerMode = 'idle';
  state.activeNoteId = null;
}

function createWidgets() {
  gui.init();

  const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 28 }, text: 'Pattern Sequencer Sketch', align: 'left' });
  const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: state.statusText, align: 'left' });
  const transport = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: state.transportText, align: 'left' });
  const playButton = gui.createButton({ bounds: { x: 0, y: 0, width: 140, height: 40 }, label: 'Play' });
  const stopButton = gui.createButton({ bounds: { x: 0, y: 0, width: 140, height: 40 }, label: 'Stop' });
  const tempo = gui.createSlider({ bounds: { x: 0, y: 0, width: 100, height: 42 }, label: 'Tempo', min: 40, max: 180, value: state.bpm });
  const master = gui.createSlider({ bounds: { x: 0, y: 0, width: 100, height: 42 }, label: 'Master', min: 0, max: 100, value: Math.round(state.masterVolume * 100) });
  const openEditorButton = gui.createButton({ bounds: { x: 0, y: 0, width: 140, height: 40 }, label: 'Open Note Editor' });

  const patternLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Selected pattern', align: 'left' });
  const patternAButton = gui.createButton({ bounds: { x: 0, y: 0, width: 80, height: 40 }, label: 'A' });
  const patternBButton = gui.createButton({ bounds: { x: 0, y: 0, width: 80, height: 40 }, label: 'B' });
  const patternCButton = gui.createButton({ bounds: { x: 0, y: 0, width: 80, height: 40 }, label: 'C' });

  const pianoLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Pattern note editor: piano strip', align: 'left', visible: false });
  const nowPlaying = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Last note: (none)', align: 'left', visible: false });
  const piano = gui.createPianoKeyboard({
    bounds: { x: 0, y: 0, width: 100, height: 120 },
    minMidi: state.midiTop - state.totalRows + 1,
    maxMidi: state.midiTop,
    visibleWhiteKeys: 10,
    minVisibleWhiteKeys: 8,
    maxVisibleWhiteKeys: 16,
    showLabels: 'all',
    interactionMode: 'gate',
    railPlacement: 'leading',
    velocityMode: 'axis-cross',
    visible: false
  });

  const graphLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Editable stfxr instrument JSON', align: 'left', visible: false });
  const graphStatus = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: 'Apply the graph to update pattern playback and note editing.', align: 'left', visible: false });
  const graphEditor = gui.createTextEditor({ bounds: { x: 0, y: 0, width: 100, height: 180 }, value: JSON.stringify(DEFAULT_MONO_PRESET, null, 2), placeholder: '{\n  "nodes": []\n}', visible: false });
  const applyGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Apply Graph', visible: false });
  const resetGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Reset Graph', visible: false });

  piano.on('noteon', function (event) {
    if (!event || !event.data) return;
    auditionMidi(Number(event.data.midi), Number(event.data.velocity || 0.7), 'piano', 1, 1);
  });

  state.widgets = {
    title,
    status,
    transport,
    playButton,
    stopButton,
    tempo,
    master,
    openEditorButton,
    patternLabel,
    patternAButton,
    patternBButton,
    patternCButton,
    pianoLabel,
    nowPlaying,
    piano,
    graphLabel,
    graphStatus,
    graphEditor,
    applyGraph,
    resetGraph
  };

  state.graphPreset = deepClone(DEFAULT_MONO_PRESET);
  syncButtons();
  syncEditorVisibility();
  setGraphStatus('Apply the graph to update pattern playback and note editing.');
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
    if (event.key === 'Enter' && (event.mods || []).includes('ctrl')) {
      if (state.editorOpen) parseGraphEditor();
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
        if (state.editorOpen && beginNoteLeftInteraction(event.x, event.y)) return;
        const arrangement = arrangementHit(event.x, event.y);
        if (arrangement) {
          cycleArrangementCell(arrangement.trackIndex, arrangement.slotIndex);
          return;
        }
      }
      if (event.action === 'release' && state.pointerMode !== 'idle') {
        endNoteInteraction();
        return;
      }
    }
    if (event.button === 'middle') {
      state.mouseDownMiddle = event.action === 'press' || event.action === 'repeat';
      if (event.action === 'press' && beginNotePan(event.x, event.y)) return;
      if (event.action === 'release' && state.pointerMode === 'pan') {
        endNoteInteraction();
        return;
      }
    }
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }

  if (event.type === 'mouse_move') {
    if ((state.mouseDownLeft || state.mouseDownMiddle) && state.pointerMode !== 'idle') {
      updateNoteInteraction(event.x, event.y);
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

  state.bpm = clamp(state.widgets.tempo.getValue() || state.bpm, 40, 180);
  state.masterVolume = clamp((state.widgets.master.getValue() || 0) / 100, 0, 1);

  if (state.widgets.playButton.wasClicked()) {
    if (state.isPlaying) pauseTransport();
    else startTransport();
  }
  if (state.widgets.stopButton.wasClicked()) stopTransport();
  if (state.widgets.openEditorButton.wasClicked()) {
    state.editorOpen = !state.editorOpen;
    syncButtons();
    syncEditorVisibility();
    layoutWidgets();
    setStatus(state.editorOpen ? 'Opened the note sequencer for pattern ' + state.selectedPatternId + '.' : 'Closed the note sequencer.');
  }
  if (state.widgets.patternAButton.wasClicked()) state.selectedPatternId = 'A';
  if (state.widgets.patternBButton.wasClicked()) state.selectedPatternId = 'B';
  if (state.widgets.patternCButton.wasClicked()) state.selectedPatternId = 'C';
  if (state.widgets.patternAButton.wasClicked() || state.widgets.patternBButton.wasClicked() || state.widgets.patternCButton.wasClicked()) {
    syncButtons();
    setStatus('Selected pattern ' + state.selectedPatternId + '.');
  }

  if (state.editorOpen && state.widgets.applyGraph.wasClicked()) parseGraphEditor();
  if (state.editorOpen && state.widgets.resetGraph.wasClicked()) {
    state.graphPreset = deepClone(DEFAULT_MONO_PRESET);
    state.widgets.graphEditor.setValue(JSON.stringify(DEFAULT_MONO_PRESET, null, 2));
    state.graphError = '';
    setGraphStatus('Reset to the default mono synth graph.');
    setStatus('Reset the synth graph.');
  }

  updateTransport();
};

scope.render = function() {
  const base = getStyle('default');
  ui.clear(base.bg);
  term.layerID = 'default';
  term.clear();

  const subtle = rgba01(226, 231, 238, 0.72);
  const strong = ui.colors.rgb(226, 231, 238);
  const frame = rgba01(255, 255, 255, 0.18);
  const arrangementBg = rgba01(255, 255, 255, 0.03);
  const headerBg = rgba01(255, 255, 255, 0.05);
  const gridLine = rgba01(255, 255, 255, 0.08);
  const playHead = rgba01(255, 188, 92, 0.18);

  const a = state.arrangementBounds;
  const am = arrangementMetrics();
  ui.rect(a.x, a.y, a.w, a.h, arrangementBg);
  ui.rect(a.x, a.y, a.w, a.headerH, headerBg);
  ui.text('Pattern Arrangement', a.x + 8, a.y + 6, strong);

  const currentSlot = Math.floor((state.currentStep % arrangementTotalSteps()) / state.patternStepCount);
  for (let slot = 0; slot < state.arrangementSlotCount; slot++) {
    const x = Math.round(am.x + slot * am.cellW);
    const w = Math.ceil(am.cellW);
    if (slot === currentSlot) ui.rect(x, am.y, w, am.h, playHead);
    ui.text(String(slot + 1).padStart(2, '0'), x + 10, a.y + 6, slot === currentSlot ? strong : subtle);
    ui.rect(x, a.y, 1, a.h, gridLine);
  }
  ui.rect(Math.round(am.x + am.w), a.y, 1, a.h, gridLine);

  for (let row = 0; row < state.tracks.length; row++) {
    const y = Math.round(am.y + row * am.cellH);
    const h = Math.ceil(am.cellH);
    const selectedTrack = row === state.selectedTrackIndex;
    if (selectedTrack) ui.rect(a.x, y, a.w, h, rgba01(255, 255, 255, 0.03));
    ui.rect(a.x, y, a.w, 1, gridLine);
    ui.text(state.tracks[row].name, a.x + 8, y + Math.max(2, Math.floor((h - 16) / 2)), selectedTrack ? strong : subtle);
    for (let slot = 0; slot < state.arrangementSlotCount; slot++) {
      const x = Math.round(am.x + slot * am.cellW);
      const label = state.tracks[row].slots[slot] || '.';
      const isSelectedPattern = label === state.selectedPatternId;
      const fill = label === '.'
        ? rgba01(255, 255, 255, 0.02)
        : (isSelectedPattern ? rgba01(101, 189, 255, 0.35) : rgba01(255, 255, 255, 0.1));
      ui.rect(x + 2, y + 2, Math.max(4, Math.ceil(am.cellW) - 4), Math.max(4, h - 4), fill);
      ui.text(label, x + Math.max(10, Math.floor(am.cellW * 0.4)), y + Math.max(2, Math.floor((h - 16) / 2)), isSelectedPattern ? strong : subtle);
    }
  }
  ui.rect(a.x, Math.round(am.y + am.h), a.w, 1, gridLine);
  ui.rect(a.x, a.y, a.w, 1, frame);
  ui.rect(a.x, a.y + a.h - 1, a.w, 1, frame);
  ui.rect(a.x, a.y, 1, a.h, frame);
  ui.rect(a.x + a.w - 1, a.y, 1, a.h, frame);
  ui.text('Click cells to cycle ., A, B, C. Pattern editor stays hidden until you open it.', a.x + 8, a.y + a.h - 22, subtle);

  if (!state.editorOpen) return;

  const pattern = currentPattern();
  if (!pattern) return;

  const b = state.noteBounds;
  const m = noteMetrics();
  const noteBg = rgba01(255, 255, 255, 0.03);
  const rowAlt = rgba01(255, 255, 255, 0.025);
  const cellOn = rgba01(101, 189, 255, 0.88);
  const cellOnActive = rgba01(255, 196, 104, 0.95);
  const handleColor = rgba01(255, 255, 255, 0.45);

  ui.rect(b.x, b.y, b.w, b.h, noteBg);
  ui.rect(b.x, b.y, b.w, b.headerH, headerBg);
  ui.text('Note Editor: ' + pattern.id + '  (' + pattern.name + ')', b.x + 8, b.y + 6, strong);

  for (let step = 0; step < state.visiblePatternSteps; step++) {
    const globalStep = state.noteViewStartStep + step;
    const x = Math.round(m.x + step * m.cellW);
    const w = Math.ceil(m.cellW);
    const activeInPattern = (state.currentStep % state.patternStepCount) === globalStep;
    if (activeInPattern) ui.rect(x, m.y, w, m.h, playHead);
    ui.text(String(globalStep + 1).padStart(2, '0'), x + 8, b.y + 6, activeInPattern ? strong : subtle);
    ui.rect(x, b.y, 1, b.h, gridLine);
  }
  ui.rect(Math.round(m.x + m.w), b.y, 1, b.h, gridLine);

  for (let row = 0; row < state.visibleRows; row++) {
    const y = Math.round(m.y + row * m.cellH);
    const h = Math.ceil(m.cellH);
    if (row % 2 === 1) ui.rect(b.x, y, b.w, h, rowAlt);
    ui.rect(b.x, y, b.w, 1, gridLine);
    ui.text(noteNameForMidi(rowToMidi(row)), b.x + 8, y + Math.max(2, Math.floor((h - 16) / 2)), subtle);
  }

  for (let i = 0; i < pattern.notes.length; i++) {
    const note = pattern.notes[i];
    const rect = noteScreenRect(note);
    if (!rect) continue;
    const active = (state.currentStep % state.patternStepCount) >= note.start && (state.currentStep % state.patternStepCount) < note.start + note.length;
    ui.rect(rect.x, rect.y, rect.w, rect.h, active ? cellOnActive : cellOn);
    ui.rect(rect.x + rect.w - 3, rect.y + 1, 2, Math.max(2, rect.h - 2), handleColor);
  }

  ui.rect(b.x, Math.round(m.y + m.h), b.w, 1, gridLine);
  ui.rect(b.x, b.y, b.w, 1, frame);
  ui.rect(b.x, b.y + b.h - 1, b.w, 1, frame);
  ui.rect(b.x, b.y, 1, b.h, frame);
  ui.rect(b.x + b.w - 1, b.y, 1, b.h, frame);
  ui.text('Note editor is hidden by default. Left: add/delete/resize. Middle: pan.', b.x + 8, b.y + b.h - 22, subtle);
};
```

## Notes

- This demo treats the note sequencer as a subordinate editor, not the default surface.
- The current pattern layer is intentionally simple: it arranges pattern IDs per track and slot.
- The natural next step is clip metadata per slot: mute, transpose, probability, automation, and launch mode.