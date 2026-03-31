---
name: "stfxr Synth Voice"
theme: "nord"
requiresAudioGesture: true
---

A small demo that uses the **new synth-style stfxr voice API** (`stfxr.voicePreset`) instead of triggering one-shot notes.

- Press **Play** to start a simple monophonic step sequence
- Use the **piano strip** to manually gate notes (note on/off)
- Edit the **stfxr graph JSON** and press **Apply Graph** to change the instrument

This is based on the transport + editable instrument pattern in [note-sequencer.md](./note-sequencer.md), but kept intentionally minimal.

## Demo

```js
let state = {
  mouseDownLeft: false,
  bpm: 124,
  masterVolume: 0.7,
  seed: 1337,
  playCounter: 0,

  isPlaying: false,
  startAudioTime: 0,
  startBeatOffset: 0,
  pauseBeats: 0,

  // Scheduler state
  nextStepToSchedule: 0,

  // Synth preset (editable)
  graphPreset: null,
  graphError: '',

  // Runtime handles
  seqVoice: null,
  pianoVoice: null,

  // UI
  widgets: null,
  statusText: 'Play starts a monophonic sequence. The piano strip gates notes using stfxr.voicePreset().',
  transportText: 'Stopped',
  lastNoteText: '(none)'
};

// A simple voice-friendly instrument graph.
// Notes:
// - No stopAfter needed (the voice is long-lived)
// - No env events needed (the voice provides its own gate envelope)
const DEFAULT_VOICE_PRESET = {
  vars: {
    rootHz: 220,
    tone: 2200
  },
  nodes: [
    { kind: 'oscVoice', id: 'osc1', oscType: 'sawtooth', freqHz: { kind: 'var', name: 'rootHz' }, gain: 0.14 },
    { kind: 'oscVoice', id: 'osc2', oscType: 'triangle', freqHz: { kind: 'mul', a: { kind: 'var', name: 'rootHz' }, b: 1.005 }, gain: 0.10 },
    { kind: 'filter', id: 'lp', filterType: 'lowpass', freqHz: { kind: 'var', name: 'tone' }, q: 0.7 },
    { kind: 'gain', id: 'amp', gain: 1.0 }
  ],
  edges: [
    { from: 'osc1', to: 'lp' },
    { from: 'osc2', to: 'lp' },
    { from: 'lp', to: 'amp' },
    { from: 'amp', to: 'out' }
  ],
  events: []
};

// A tiny monophonic pattern: 16 steps (16th notes).
// If a step has null, it’s a rest.
const STEPS_MIDI = [
  60, null, 67, null,
  69, null, 67, null,
  65, null, 64, null,
  62, null, null, null
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function noteNameForMidi(midi) {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const value = Number(midi);
  const octave = Math.floor(value / 12) - 1;
  return names[((value % 12) + 12) % 12] + String(octave);
}

function setStatus(text) {
  state.statusText = String(text == null ? '' : text);
  if (state.widgets && state.widgets.status) state.widgets.status.setText(state.statusText);
}

function setTransportText(text) {
  state.transportText = String(text || '');
  if (state.widgets && state.widgets.transport) state.widgets.transport.setText(state.transportText);
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

function stepBeats() {
  return 0.25; // 16ths
}

function stepSeconds() {
  const bpm = clamp(state.bpm, 40, 220);
  return (60 / bpm) * stepBeats();
}

function getTransportBeats() {
  if (!state.isPlaying) return state.pauseBeats;
  const bpm = clamp(state.bpm, 40, 220);
  const elapsed = Math.max(0, audio.currentTime - state.startAudioTime);
  return state.startBeatOffset + elapsed * (bpm / 60);
}

function beatsToSeconds(beats) {
  const bpm = clamp(state.bpm, 40, 220);
  return (60 / bpm) * Number(beats);
}

function safeSetParamValue(param, value, when) {
  if (!param) return;
  const t = audio.currentTime + Math.max(0, Number(when) || 0);
  const v = Number(value);
  try {
    if (typeof param.setValueAtTime === 'function') param.setValueAtTime(v, t);
    else param.value = v;
  } catch {
    try {
      param.value = v;
    } catch {}
  }
}

function stopVoice(handle) {
  if (!handle) return;
  try {
    handle.stop(0);
  } catch {}
}

function rebuildVoices() {
  stopVoice(state.seqVoice);
  stopVoice(state.pianoVoice);
  state.seqVoice = null;
  state.pianoVoice = null;

  // Create voices lazily (on play / on piano usage).
}

function parseGraphEditor() {
  if (!state.widgets || !state.widgets.graphEditor) return false;
  const raw = String(state.widgets.graphEditor.getValue() || '').trim();
  if (!raw) {
    state.graphError = 'Graph JSON is empty.';
    setStatus(state.graphError);
    return false;
  }
  try {
    state.graphPreset = JSON.parse(raw);
    state.graphError = '';
    setStatus('Applied synth graph from editor.');
    rebuildVoices();
    return true;
  } catch (error) {
    state.graphError = 'Graph parse error: ' + String(error && error.message ? error.message : error);
    setStatus(state.graphError);
    return false;
  }
}

function ensureSeqVoice() {
  if (state.seqVoice) return state.seqVoice;
  resumeAudioIfNeeded();
  state.seqVoice = stfxr.voicePreset(state.graphPreset || DEFAULT_VOICE_PRESET, nextSeed(), {
    volume: clamp(state.masterVolume, 0, 1),
    attack: 0.003,
    decay: 0.035,
    sustain: 0.18,
    release: 0.06
  });
  return state.seqVoice;
}

function ensurePianoVoice() {
  if (state.pianoVoice) return state.pianoVoice;
  resumeAudioIfNeeded();
  state.pianoVoice = stfxr.voicePreset(state.graphPreset || DEFAULT_VOICE_PRESET, nextSeed(), {
    volume: clamp(state.masterVolume, 0, 1),
    attack: 0.003,
    decay: 0.04,
    sustain: 0.22,
    release: 0.08
  });
  return state.pianoVoice;
}

function updateVoiceVolumes() {
  const vol = clamp(state.masterVolume, 0, 1);
  // stfxr voices expose graph params; the output gain is "out.gain".
  if (state.seqVoice && state.seqVoice.params) safeSetParamValue(state.seqVoice.params['out.gain'], vol, 0);
  if (state.pianoVoice && state.pianoVoice.params) safeSetParamValue(state.pianoVoice.params['out.gain'], vol, 0);
}

function scheduleStep(stepIndex, whenSec) {
  const midi = STEPS_MIDI[stepIndex % STEPS_MIDI.length];
  const voice = ensureSeqVoice();

  // A small default gate length (release handles tail).
  const dur = stepSeconds() * 0.85;

  if (midi == null) {
    // Rest
    voice.noteOff(whenSec);
    return;
  }

  const hz = midiToHz(midi);
  voice.noteOn(hz, 1.0, whenSec);
  voice.noteOff(whenSec + dur);
  setNowPlaying(noteNameForMidi(midi) + ' (seq)');
}

function startTransport() {
  resumeAudioIfNeeded();
  if (state.isPlaying) return;

  state.startAudioTime = audio.currentTime;
  state.startBeatOffset = state.pauseBeats;
  state.isPlaying = true;

  // Start scheduling from the current step.
  const beat = getTransportBeats();
  state.nextStepToSchedule = Math.floor(beat / stepBeats());

  ensureSeqVoice();
  syncTransportButtons();
  setStatus('Transport running. Sequencer drives a single stfxr voice (noteOn/noteOff).');
}

function pauseTransport() {
  if (!state.isPlaying) return;
  state.pauseBeats = getTransportBeats();
  state.isPlaying = false;
  syncTransportButtons();
  setStatus('Transport paused.');

  // Release the current note.
  if (state.seqVoice) {
    try { state.seqVoice.noteOff(0); } catch {}
  }
}

function stopTransport() {
  state.pauseBeats = 0;
  state.startBeatOffset = 0;
  state.isPlaying = false;
  state.nextStepToSchedule = 0;
  syncTransportButtons();
  setStatus('Transport stopped.');
  setTransportText('Stopped');

  stopVoice(state.seqVoice);
  state.seqVoice = null;
}

function schedulerTick() {
  if (!state.isPlaying) return;

  // Schedule a bit ahead for stability.
  const lookaheadSec = 0.18;
  const now = audio.currentTime;
  const currentBeat = getTransportBeats();

  let scheduled = 0;
  const maxSchedulePerTick = 64;

  while (true) {
    const stepBeat = state.nextStepToSchedule * stepBeats();
    const deltaBeats = stepBeat - currentBeat;
    const whenSec = beatsToSeconds(deltaBeats);
    if (now + whenSec > now + lookaheadSec) break;

    scheduled += 1;
    if (scheduled > maxSchedulePerTick) break;

    scheduleStep(state.nextStepToSchedule, whenSec);
    state.nextStepToSchedule += 1;
  }

  const beat = getTransportBeats();
  const bar = Math.floor(beat / 4) + 1;
  const stepInBar = (Math.floor(beat / stepBeats()) % STEPS_MIDI.length) + 1;
  setTransportText(
    'Running | Bar ' + String(bar) +
    ' | Step ' + String(stepInBar).padStart(2, '0') +
    ' | Beat ' + beat.toFixed(2)
  );
}

function createWidgets() {
  gui.init();

  const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 28 }, text: 'stfxr Synth Voice', align: 'left' });
  const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 44 }, text: state.statusText, align: 'left' });
  const transport = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: state.transportText, align: 'left' });

  const playButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Play' });
  const stopButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Stop' });

  const tempo = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Tempo', min: 40, max: 180, value: state.bpm });
  const master = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Master', min: 0, max: 100, value: Math.round(state.masterVolume * 100) });

  const pianoLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Piano audition strip (gated)', align: 'left' });
  const nowPlaying = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Last note: (none)', align: 'left' });
  const piano = gui.createPianoKeyboard({
    bounds: { x: 0, y: 0, width: 100, height: 112 },
    minMidi: 48,
    maxMidi: 84,
    visibleWhiteKeys: 10,
    minVisibleWhiteKeys: 8,
    maxVisibleWhiteKeys: 16,
    showLabels: 'c',
    interactionMode: 'gate',
    railPlacement: 'leading',
    velocityMode: 'axis-cross'
  });

  const graphLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Editable stfxr instrument JSON', align: 'left' });
  const graphEditor = gui.createTextEditor({
    bounds: { x: 0, y: 0, width: 100, height: 180 },
    value: JSON.stringify(DEFAULT_VOICE_PRESET, null, 2),
    placeholder: '{\n  "nodes": []\n}'
  });
  const applyGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 160, height: 40 }, label: 'Apply Graph' });
  const resetGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 160, height: 40 }, label: 'Reset Graph' });

  piano.on('noteon', function (event) {
    if (!event || !event.data) return;
    const voice = ensurePianoVoice();
    voice.noteOn(Number(event.data.hz), clamp(Number(event.data.velocity || 0.7), 0.05, 1), 0);
    setNowPlaying(String(event.data.noteName) + ' (piano)');
  });

  piano.on('noteoff', function () {
    if (!state.pianoVoice) return;
    try { state.pianoVoice.noteOff(0); } catch {}
  });

  state.widgets = {
    title,
    status,
    transport,
    playButton,
    stopButton,
    tempo,
    master,
    pianoLabel,
    nowPlaying,
    piano,
    graphLabel,
    graphEditor,
    applyGraph,
    resetGraph
  };

  state.graphPreset = deepClone(DEFAULT_VOICE_PRESET);
  syncTransportButtons();
  layoutWidgets();
}

function layoutWidgets() {
  if (!state.widgets) return;

  const viewport = gui.getViewportRect();
  const responsive = gui.getResponsiveInfo(viewport);
  const safeArea = responsive.safeAreaInsets || { top: 0, right: 0, bottom: 0, left: 0 };

  const width = Math.max(320, Math.floor(responsive.usableWidth || viewport.width || 1200));
  const height = Math.max(360, Math.floor(responsive.usableHeight || viewport.height || 800));

  const pad = width < 980 ? 12 : 16;
  const gap = 10;
  const x = Math.floor(safeArea.left + pad);
  const y0 = Math.floor(safeArea.top + pad);
  const w = Math.max(240, width - pad * 2);

  let y = y0;

  state.widgets.title.setBounds({ x, y, width: w, height: 28 });
  y += 32;
  state.widgets.status.setBounds({ x, y, width: w, height: 44 });
  y += 48;
  state.widgets.transport.setBounds({ x, y, width: w, height: 24 });
  y += 32;

  const btnW = 140;
  state.widgets.playButton.setBounds({ x, y, width: btnW, height: 40 });
  state.widgets.stopButton.setBounds({ x: x + btnW + gap, y, width: btnW, height: 40 });
  y += 50;

  state.widgets.tempo.setBounds({ x, y, width: w, height: 42 });
  y += 50;
  state.widgets.master.setBounds({ x, y, width: w, height: 42 });
  y += 56;

  state.widgets.pianoLabel.setBounds({ x, y, width: w, height: 24 });
  y += 24;
  state.widgets.nowPlaying.setBounds({ x, y, width: w, height: 24 });
  y += 28;
  state.widgets.piano.setBounds({ x, y, width: w, height: 112 });
  y += 122;

  state.widgets.graphLabel.setBounds({ x, y, width: w, height: 24 });
  y += 28;
  state.widgets.graphEditor.setBounds({ x, y, width: w, height: Math.max(120, height - y - 60) });

  const buttonsY = Math.floor(y0 + height - 48);
  state.widgets.applyGraph.setBounds({ x, y: buttonsY, width: 160, height: 40 });
  state.widgets.resetGraph.setBounds({ x: x + 160 + gap, y: buttonsY, width: 160, height: 40 });
}

scope.init = function () {
  term.layerID = 'default';
  createWidgets();
};

scope.input = function (event) {
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
    }
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }

  if (event.type === 'mouse_move') {
    gui.handleMouse(event.x, event.y, state.mouseDownLeft);
  }
};

scope.update = function () {
  if (!state.widgets) return;

  layoutWidgets();
  gui.handleMouse(getMouseX(), getMouseY(), state.mouseDownLeft);
  gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

  state.bpm = clamp(state.widgets.tempo.getValue() || state.bpm, 40, 180);
  state.masterVolume = clamp((state.widgets.master.getValue() || 0) / 100, 0, 1);
  updateVoiceVolumes();

  if (state.widgets.playButton.wasClicked()) {
    if (state.isPlaying) pauseTransport();
    else startTransport();
  }
  if (state.widgets.stopButton.wasClicked()) stopTransport();

  if (state.widgets.applyGraph.wasClicked()) parseGraphEditor();
  if (state.widgets.resetGraph.wasClicked()) {
    state.graphPreset = deepClone(DEFAULT_VOICE_PRESET);
    state.widgets.graphEditor.setValue(JSON.stringify(DEFAULT_VOICE_PRESET, null, 2));
    state.graphError = '';
    rebuildVoices();
    setStatus('Reset the synth graph.');
  }

  schedulerTick();

  if (!state.isPlaying) {
    const beat = getTransportBeats();
    const bar = Math.floor(beat / 4) + 1;
    setTransportText('Stopped | Bar ' + String(bar) + ' | Beat ' + beat.toFixed(2));
  }
};

scope.render = function () {
  const base = getStyle('default');
  ui.clear(base.bg);
  term.layerID = 'default';
  term.clear();
};
```

## Notes

- This is intentionally **monophonic**: one `stfxr` voice is reused for the entire pattern.
- The voice API is ideal for synth-like workflows because it can sustain and gate (`noteOn` / `noteOff`) without rebuilding the graph for every note.
