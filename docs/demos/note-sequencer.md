---
name: "Note Sequencer Sketch"
theme: "nord"
requiresAudioGesture: true
---

A dedicated note sequencer sketch for the DAW direction.

This demo isolates one problem: how a text-first Storie workflow can still support a proper note grid.

- Left click empty space to create notes
- Left click an existing note to delete it
- Left drag an existing note to resize its length
- Middle drag to pan around a larger note grid
- Press Play to audition the pattern
- Use the piano strip to preview notes manually
- Edit the `stfxr` synth graph so the sequencer and the future DAW share the same instrument core

This is intentionally still a sketch, but it pushes closer to a real piano-roll foundation than the original DAW demo.

## Demo

```js
let state = {
  mouseDownLeft: false,
  mouseDownMiddle: false,
  pointerMode: 'idle',
  activeNoteId: null,
  interactionStartX: 0,
  interactionStartY: 0,
  interactionMoved: false,
  interactionNoteStart: 0,
  interactionNoteLength: 1,
  interactionViewStartStep: 0,
  interactionViewRowOffset: 0,
  widgets: null,
  layoutSize: { width: 0, height: 0 },
  gridBounds: { x: 0, y: 0, w: 0, h: 0, headerH: 28, labelW: 54 },
  bpm: 124,
  masterVolume: 0.7,
  seed: 1337,
  isPlaying: false,
  startAudioTime: 0,
  startBeatOffset: 0,
  pauseBeats: 0,
  lastProcessedStep: -1,
  currentStep: 0,
  totalSteps: 64,
  visibleStepCount: 16,
  midiTop: 84,
  totalRows: 36,
  visibleRowCount: 16,
  viewStartStep: 0,
  viewRowOffset: 12,
  notes: [],
  nextNoteId: 1,
  statusText: 'Left click to add or delete. Left drag existing notes to resize. Middle drag pans the grid.',
  transportText: 'Stopped',
  lastNoteText: '(none)',
  graphPreset: null,
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

function noteNameForMidi(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const value = Number(midi);
  const octave = Math.floor(value / 12) - 1;
  return names[((value % 12) + 12) % 12] + String(octave);
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function globalRowToMidi(rowIndex) {
  return state.midiTop - rowIndex;
}

function visibleRowToGlobal(rowIndex) {
  return state.viewRowOffset + rowIndex;
}

function rowToMidi(rowIndex) {
  return globalRowToMidi(visibleRowToGlobal(rowIndex));
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

function syncTransportButtons() {
  if (state.widgets && state.widgets.playButton && typeof state.widgets.playButton.setLabel === 'function') {
    state.widgets.playButton.setLabel(state.isPlaying ? 'Pause' : 'Play');
  }
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

function stepDurationSeconds() {
  return (60 / clamp(state.bpm, 40, 220)) * stepDurationBeats();
}

function auditionMidi(midi, velocity, sourceLabel, stepLength) {
  resumeAudioIfNeeded();
  const hz = midiToHz(midi);
  const durationSec = stepDurationSeconds() * Math.max(1, Number(stepLength) || 1);
  const preset = applyDurationToPreset(buildTunedPreset(state.graphPreset || DEFAULT_MONO_PRESET, hz), durationSec);
  stfxr.playPreset(preset, nextSeed(), {
    volume: clamp(state.masterVolume * clamp(velocity == null ? 0.8 : velocity, 0.05, 1), 0, 1)
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
    setGraphStatus('Graph parsed. Grid playback and piano audition now use this synth.');
    setStatus('Applied synth graph from editor.');
    return true;
  } catch (error) {
    state.graphError = 'Graph parse error: ' + String(error && error.message ? error.message : error);
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
}

function getNoteById(id) {
  for (let i = 0; i < state.notes.length; i++) {
    if (state.notes[i] && state.notes[i].id === id) return state.notes[i];
  }
  return null;
}

function noteAtStep(globalRow, stepIndex) {
  for (let i = state.notes.length - 1; i >= 0; i--) {
    const note = state.notes[i];
    if (!note) continue;
    if (note.row !== globalRow) continue;
    if (stepIndex >= note.start && stepIndex < note.start + note.length) return note;
  }
  return null;
}

function triggerSequencerStep(stepIndex) {
  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];
    if (!note || note.start !== stepIndex) continue;
    auditionMidi(globalRowToMidi(note.row), 0.72, 'grid', note.length);
  }
  state.currentStep = stepIndex;
}

function stepDurationBeats() {
  return 0.25;
}

function getTransportBeats() {
  if (!state.isPlaying) return state.pauseBeats;
  const bpm = clamp(state.bpm, 40, 220);
  const elapsed = Math.max(0, audio.currentTime - state.startAudioTime);
  return state.startBeatOffset + elapsed * (bpm / 60);
}

function startTransport() {
  resumeAudioIfNeeded();
  if (state.isPlaying) return;
  state.startAudioTime = audio.currentTime;
  state.startBeatOffset = state.pauseBeats;
  state.isPlaying = true;
  state.lastProcessedStep = Math.floor(getTransportBeats() / stepDurationBeats());
  syncTransportButtons();
  setStatus('Transport running. The note grid is driving the stfxr instrument graph.');
}

function pauseTransport() {
  if (!state.isPlaying) return;
  state.pauseBeats = getTransportBeats();
  state.isPlaying = false;
  syncTransportButtons();
  setStatus('Transport paused.');
}

function stopTransport() {
  state.pauseBeats = 0;
  state.startBeatOffset = 0;
  state.isPlaying = false;
  state.lastProcessedStep = -1;
  state.currentStep = 0;
  syncTransportButtons();
  setStatus('Transport stopped and rewound.');
}

function updateTransport() {
  const beat = getTransportBeats();
  const globalStep = Math.floor(beat / stepDurationBeats());
  if (state.isPlaying && globalStep > state.lastProcessedStep) {
    for (let step = state.lastProcessedStep + 1; step <= globalStep; step++) {
      triggerSequencerStep(step % state.totalSteps);
    }
    state.lastProcessedStep = globalStep;
  }
  const bar = Math.floor(beat / 4) + 1;
  const stepInBar = (Math.floor(beat / stepDurationBeats()) % state.visibleStepCount) + 1;
  setTransportText(
    (state.isPlaying ? 'Running' : 'Stopped') +
    ' | Bar ' + String(bar) +
    ' | Step ' + String(stepInBar).padStart(2, '0') +
    ' | Beat ' + beat.toFixed(2)
  );
}

function clearGrid() {
  state.notes = [];
  setStatus('Cleared the note grid.');
}

function seedExamplePattern() {
  clearGrid();
  const phrase = [
    { offset: 0, step: 0, length: 2 },
    { offset: 4, step: 2, length: 2 },
    { offset: 7, step: 4, length: 2 },
    { offset: 11, step: 6, length: 2 },
    { offset: 12, step: 8, length: 1 },
    { offset: 11, step: 9, length: 1 },
    { offset: 7, step: 10, length: 2 },
    { offset: 4, step: 12, length: 2 },
    { offset: 0, step: 14, length: 2 },
    { offset: 7, step: 18, length: 4 },
    { offset: 4, step: 24, length: 4 },
    { offset: 0, step: 32, length: 8 }
  ];
  const rootRow = 20;
  for (let i = 0; i < phrase.length; i++) {
    const entry = phrase[i];
    const row = clamp(rootRow - entry.offset, 0, state.totalRows - 1);
    state.notes.push({ id: noteId(), row: row, start: entry.step, length: entry.length, velocity: 0.72 });
  }
  state.viewStartStep = 0;
  state.viewRowOffset = clamp(rootRow - 8, 0, Math.max(0, state.totalRows - state.visibleRowCount));
  setStatus('Loaded a simple example phrase.');
}

function layoutWidgets() {
  if (!state.widgets) return;
  const viewport = gui.getViewportRect();
  const width = Math.max(960, Math.floor(viewport.width));
  const height = Math.max(780, Math.floor(viewport.height));
  if (width === state.layoutSize.width && height === state.layoutSize.height) return;
  state.layoutSize = { width: width, height: height };

  const pad = 18;
  const gap = 12;
  const leftWidth = Math.max(300, Math.floor(width * 0.28));
  const rightX = pad + leftWidth + gap;
  const rightWidth = width - rightX - pad;
  const topY = pad;
  const controlsBottom = 320;
  const pianoHeight = 180;
  const graphHeight = height - pad - (topY + controlsBottom + pianoHeight + gap * 2);

  state.widgets.title.setBounds({ x: pad, y: topY, width: leftWidth, height: 28 });
  state.widgets.status.setBounds({ x: pad, y: topY + 30, width: leftWidth, height: 52 });
  state.widgets.transport.setBounds({ x: pad, y: topY + 84, width: leftWidth, height: 24 });

  const buttonY = topY + 118;
  const buttonW = Math.floor((leftWidth - gap) / 2);
  state.widgets.playButton.setBounds({ x: pad, y: buttonY, width: buttonW, height: 40 });
  state.widgets.stopButton.setBounds({ x: pad + buttonW + gap, y: buttonY, width: buttonW, height: 40 });

  state.widgets.tempo.setBounds({ x: pad, y: buttonY + 48, width: leftWidth, height: 42 });
  state.widgets.master.setBounds({ x: pad, y: buttonY + 96, width: leftWidth, height: 42 });
  state.widgets.clearButton.setBounds({ x: pad, y: buttonY + 148, width: buttonW, height: 40 });
  state.widgets.exampleButton.setBounds({ x: pad + buttonW + gap, y: buttonY + 148, width: buttonW, height: 40 });

  const pianoY = topY + controlsBottom;
  state.widgets.pianoLabel.setBounds({ x: pad, y: pianoY, width: leftWidth, height: 24 });
  state.widgets.nowPlaying.setBounds({ x: pad, y: pianoY + 24, width: leftWidth, height: 24 });
  state.widgets.piano.setBounds({ x: pad, y: pianoY + 54, width: leftWidth, height: pianoHeight - 54 });

  const graphY = pianoY + pianoHeight + gap;
  state.widgets.graphLabel.setBounds({ x: pad, y: graphY, width: leftWidth, height: 24 });
  state.widgets.graphStatus.setBounds({ x: pad, y: graphY + 24, width: leftWidth, height: 44 });
  state.widgets.graphEditor.setBounds({ x: pad, y: graphY + 72, width: leftWidth, height: Math.max(160, graphHeight - 120) });
  state.widgets.applyGraph.setBounds({ x: pad, y: height - pad - 40, width: buttonW, height: 40 });
  state.widgets.resetGraph.setBounds({ x: pad + buttonW + gap, y: height - pad - 40, width: buttonW, height: 40 });

  state.gridBounds = {
    x: rightX,
    y: topY,
    w: rightWidth,
    h: height - pad * 2,
    headerH: 28,
    labelW: 54
  };
}

function gridMetrics() {
  const b = state.gridBounds;
  const innerX = b.x + b.labelW;
  const innerY = b.y + b.headerH;
  const innerW = Math.max(1, b.w - b.labelW);
  const innerH = Math.max(1, b.h - b.headerH);
  return {
    x: innerX,
    y: innerY,
    w: innerW,
    h: innerH,
    cellW: innerW / state.visibleStepCount,
    cellH: innerH / state.visibleRowCount
  };
}

function gridHit(x, y) {
  const m = gridMetrics();
  if (x < m.x || y < m.y || x >= m.x + m.w || y >= m.y + m.h) return null;
  const localStep = clamp(Math.floor((x - m.x) / m.cellW), 0, state.visibleStepCount - 1);
  const localRow = clamp(Math.floor((y - m.y) / m.cellH), 0, state.visibleRowCount - 1);
  return {
    row: state.viewRowOffset + localRow,
    step: state.viewStartStep + localStep,
    localRow: localRow,
    localStep: localStep
  };
}

function addNote(globalRow, step, length) {
  const note = {
    id: noteId(),
    row: clamp(globalRow, 0, state.totalRows - 1),
    start: clamp(step, 0, state.totalSteps - 1),
    length: clamp(length, 1, state.totalSteps),
    velocity: 0.72
  };
  note.length = Math.min(note.length, state.totalSteps - note.start);
  state.notes.push(note);
  return note;
}

function deleteNote(noteIdValue) {
  const next = [];
  for (let i = 0; i < state.notes.length; i++) {
    if (state.notes[i] && state.notes[i].id !== noteIdValue) next.push(state.notes[i]);
  }
  state.notes = next;
}

function noteScreenRect(note) {
  if (!note) return null;
  const m = gridMetrics();
  const visibleStart = state.viewStartStep;
  const visibleEnd = state.viewStartStep + state.visibleStepCount;
  const visibleRowStart = state.viewRowOffset;
  const visibleRowEnd = state.viewRowOffset + state.visibleRowCount;
  if (note.row < visibleRowStart || note.row >= visibleRowEnd) return null;
  const noteStart = Math.max(note.start, visibleStart);
  const noteEnd = Math.min(note.start + note.length, visibleEnd);
  if (noteEnd <= noteStart) return null;
  const localRow = note.row - visibleRowStart;
  const x = Math.round(m.x + (noteStart - visibleStart) * m.cellW) + 2;
  const y = Math.round(m.y + localRow * m.cellH) + 2;
  const w = Math.max(4, Math.round((noteEnd - noteStart) * m.cellW) - 4);
  const h = Math.max(4, Math.round(m.cellH) - 4);
  return { x: x, y: y, w: w, h: h };
}

function noteHitAt(x, y) {
  for (let i = state.notes.length - 1; i >= 0; i--) {
    const note = state.notes[i];
    const rect = noteScreenRect(note);
    if (!rect) continue;
    if (x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h) {
      return { note: note, rect: rect };
    }
  }
  return null;
}

function beginLeftInteraction(x, y) {
  const noteHit = noteHitAt(x, y);
  if (noteHit) {
    state.pointerMode = 'delete-or-resize';
    state.activeNoteId = noteHit.note.id;
    state.interactionStartX = x;
    state.interactionStartY = y;
    state.interactionMoved = false;
    state.interactionNoteStart = noteHit.note.start;
    state.interactionNoteLength = noteHit.note.length;
    return true;
  }

  const hit = gridHit(x, y);
  if (!hit) return false;
  const existing = noteAtStep(hit.row, hit.step);
  if (existing) {
    state.pointerMode = 'delete-or-resize';
    state.activeNoteId = existing.id;
    state.interactionStartX = x;
    state.interactionStartY = y;
    state.interactionMoved = false;
    state.interactionNoteStart = existing.start;
    state.interactionNoteLength = existing.length;
    return true;
  }

  const note = addNote(hit.row, hit.step, 1);
  state.pointerMode = 'create';
  state.activeNoteId = note.id;
  state.interactionStartX = x;
  state.interactionStartY = y;
  state.interactionMoved = false;
  state.interactionNoteStart = note.start;
  state.interactionNoteLength = note.length;
  auditionMidi(globalRowToMidi(note.row), 0.72, 'grid edit', note.length);
  setStatus('Added ' + noteNameForMidi(globalRowToMidi(note.row)) + ' at step ' + String(note.start + 1) + '.');
  return true;
}

function beginMiddlePan(x, y) {
  if (!gridHit(x, y) && !(x >= state.gridBounds.x && x < state.gridBounds.x + state.gridBounds.w && y >= state.gridBounds.y && y < state.gridBounds.y + state.gridBounds.h)) return false;
  state.pointerMode = 'pan';
  state.interactionStartX = x;
  state.interactionStartY = y;
  state.interactionViewStartStep = state.viewStartStep;
  state.interactionViewRowOffset = state.viewRowOffset;
  return true;
}

function updateInteraction(x, y) {
  if (state.pointerMode === 'idle') return false;

  if (state.pointerMode === 'pan') {
    const m = gridMetrics();
    const dx = x - state.interactionStartX;
    const dy = y - state.interactionStartY;
    const nextStep = state.interactionViewStartStep - Math.round(dx / Math.max(1, m.cellW));
    const nextRow = state.interactionViewRowOffset - Math.round(dy / Math.max(1, m.cellH));
    state.viewStartStep = clamp(nextStep, 0, Math.max(0, state.totalSteps - state.visibleStepCount));
    state.viewRowOffset = clamp(nextRow, 0, Math.max(0, state.totalRows - state.visibleRowCount));
    setStatus('Panning grid. Step offset ' + String(state.viewStartStep + 1) + ', top note ' + noteNameForMidi(globalRowToMidi(state.viewRowOffset)) + '.');
    return true;
  }

  const note = getNoteById(state.activeNoteId);
  if (!note) return false;
  const hit = gridHit(x, y);
  const dx = x - state.interactionStartX;
  const dragThreshold = 6;

  if (state.pointerMode === 'delete-or-resize') {
    if (Math.abs(dx) > dragThreshold) {
      state.pointerMode = 'resize';
      state.interactionMoved = true;
    } else {
      return true;
    }
  }

  if (state.pointerMode === 'create' || state.pointerMode === 'resize') {
    const targetStep = hit ? hit.step : state.interactionNoteStart;
    const endStep = clamp(targetStep, note.start, state.totalSteps - 1);
    note.length = Math.max(1, (endStep - note.start) + 1);
    state.interactionMoved = true;
    setStatus('Set ' + noteNameForMidi(globalRowToMidi(note.row)) + ' to length ' + String(note.length) + ' step' + (note.length === 1 ? '' : 's') + '.');
    return true;
  }

  return false;
}

function endInteraction() {
  if (state.pointerMode === 'delete-or-resize') {
    const note = getNoteById(state.activeNoteId);
    if (note) {
      deleteNote(note.id);
      setStatus('Deleted ' + noteNameForMidi(globalRowToMidi(note.row)) + ' at step ' + String(note.start + 1) + '.');
    }
  }
  state.pointerMode = 'idle';
  state.activeNoteId = null;
  state.interactionMoved = false;
}

function createWidgets() {
  gui.init();

  const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 28 }, text: 'Note Sequencer Sketch', align: 'left' });
  const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: state.statusText, align: 'left' });
  const transport = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: state.transportText, align: 'left' });
  const playButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Play' });
  const stopButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Stop' });
  const tempo = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Tempo', min: 40, max: 180, value: state.bpm });
  const master = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Master', min: 0, max: 100, value: Math.round(state.masterVolume * 100) });
  const clearButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Clear Grid' });
  const exampleButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Example Phrase' });

  const pianoLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Piano audition strip', align: 'left' });
  const nowPlaying = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Last note: (none)', align: 'left' });
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
    velocityMode: 'axis-cross'
  });

  const graphLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Editable stfxr instrument JSON', align: 'left' });
  const graphStatus = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: 'Apply the graph to update grid playback and piano auditioning.', align: 'left' });
  const graphEditor = gui.createTextEditor({
    bounds: { x: 0, y: 0, width: 100, height: 180 },
    value: JSON.stringify(DEFAULT_MONO_PRESET, null, 2),
    placeholder: '{\n  "nodes": []\n}'
  });
  const applyGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Apply Graph' });
  const resetGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Reset Graph' });

  piano.on('noteon', function (event) {
    if (!event || !event.data) return;
    auditionMidi(Number(event.data.midi), Number(event.data.velocity || 0.7), 'piano', 1);
  });

  state.widgets = {
    title,
    status,
    transport,
    playButton,
    stopButton,
    tempo,
    master,
    clearButton,
    exampleButton,
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
  syncTransportButtons();
  setGraphStatus('Apply the graph to update grid playback and piano auditioning.');
  seedExamplePattern();
  layoutWidgets();
}

scope.init = function() {
  term.layerID = 'default';
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
      parseGraphEditor();
      return;
    }
    if (event.key === 'Backspace') {
      clearGrid();
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
      if (event.action === 'press' && beginLeftInteraction(event.x, event.y)) return;
      if (event.action === 'release') endInteraction();
    }
    if (event.button === 'middle') {
      state.mouseDownMiddle = event.action === 'press' || event.action === 'repeat';
      if (event.action === 'press' && beginMiddlePan(event.x, event.y)) return;
      if (event.action === 'release' && state.pointerMode === 'pan') endInteraction();
    }
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }

  if (event.type === 'mouse_move') {
    if ((state.mouseDownLeft || state.mouseDownMiddle) && state.pointerMode !== 'idle') {
      updateInteraction(event.x, event.y);
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
  if (state.widgets.clearButton.wasClicked()) clearGrid();
  if (state.widgets.exampleButton.wasClicked()) seedExamplePattern();
  if (state.widgets.applyGraph.wasClicked()) parseGraphEditor();
  if (state.widgets.resetGraph.wasClicked()) {
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

  const b = state.gridBounds;
  const m = gridMetrics();
  const headerBg = rgba01(255, 255, 255, 0.05);
  const frame = rgba01(255, 255, 255, 0.18);
  const gridLine = rgba01(255, 255, 255, 0.07);
  const rowAlt = rgba01(255, 255, 255, 0.025);
  const cellOn = rgba01(101, 189, 255, 0.88);
  const cellOnActive = rgba01(255, 196, 104, 0.95);
  const playHead = rgba01(255, 188, 92, 0.18);
  const textColor = ui.colors.rgb(226, 231, 238);
  const subtle = rgba01(226, 231, 238, 0.72);
  const handleColor = rgba01(255, 255, 255, 0.45);

  ui.rect(b.x, b.y, b.w, b.h, rgba01(255, 255, 255, 0.03));
  ui.rect(b.x, b.y, b.w, b.headerH, headerBg);

  for (let step = 0; step < state.visibleStepCount; step++) {
    const x = Math.round(m.x + step * m.cellW);
    const w = Math.ceil(m.cellW);
    const globalStep = state.viewStartStep + step;
    if (globalStep === state.currentStep) ui.rect(x, m.y, w, m.h, playHead);
    ui.text(String(globalStep + 1).padStart(2, '0'), x + 8, b.y + 6, globalStep === state.currentStep ? textColor : subtle);
    ui.rect(x, b.y, 1, b.h, gridLine);
  }
  ui.rect(Math.round(m.x + m.w), b.y, 1, b.h, gridLine);

  for (let row = 0; row < state.visibleRowCount; row++) {
    const y = Math.round(m.y + row * m.cellH);
    const h = Math.ceil(m.cellH);
    if (row % 2 === 1) ui.rect(b.x, y, b.w, h, rowAlt);
    ui.rect(b.x, y, b.w, 1, gridLine);
    ui.text(noteNameForMidi(rowToMidi(row)), b.x + 8, y + Math.max(2, Math.floor((h - 16) / 2)), subtle);
  }

  for (let i = 0; i < state.notes.length; i++) {
    const note = state.notes[i];
    const rect = noteScreenRect(note);
    if (!rect) continue;
    const active = state.currentStep >= note.start && state.currentStep < note.start + note.length;
    ui.rect(rect.x, rect.y, rect.w, rect.h, active ? cellOnActive : cellOn);
    ui.rect(rect.x + rect.w - 3, rect.y + 1, 2, Math.max(2, rect.h - 2), handleColor);
  }

  ui.rect(b.x, Math.round(m.y + m.h), b.w, 1, gridLine);
  ui.rect(b.x, b.y, b.w, 1, frame);
  ui.rect(b.x, b.y + b.h - 1, b.w, 1, frame);
  ui.rect(b.x, b.y, 1, b.h, frame);
  ui.rect(b.x + b.w - 1, b.y, 1, b.h, frame);
  ui.text('Left click empty: add | Left click note: delete | Left drag note: resize | Middle drag: pan', b.x + 8, b.y + b.h - 22, subtle);
};
```

## Notes

- This is a retained-GUI plus immediate-grid hybrid on purpose. The piano and graph editor stay in the standard Storie widget system while the note surface is custom drawn.
- The grid now uses note objects with `row`, `start`, and `length`, which is the minimum shape needed for panning and resize interactions.
- The next natural step is sharing the same instrument document between this grid and [daw.md](./daw.md).