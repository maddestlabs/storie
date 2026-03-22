---
name: "DAW Sketch"
theme: "nord"
requiresAudioGesture: true
---

A first pass at a text-first DAW built inside Storie.

The direction here is:

- `stfxr` as the sound graph core for instruments, drums, buses, and FX
- Markdown and JS as the session format
- A piano widget for note auditioning and eventually piano-roll gutters
- Pattern strings first, then richer scheduling and routing later

Companion demos:

- [piano-keyboard.md](./piano-keyboard.md)
- [stfxr-graph.md](./stfxr-graph.md)
- [stfxr-edit.md](./stfxr-edit.md)

Suggested next core milestones after this sketch:

1. Sample-accurate transport and lookahead scheduling.
2. First-class `stfxr` instrument documents with reusable graph references.
3. Mixer buses, sends, return FX, and graph-to-graph routing.
4. Clip and pattern abstractions beyond raw text fields.
5. Automation lanes that target graph params directly.

```stfxr name:dawKick seed:1337
{
  "nodes": [
    { "kind": "oscVoice", "id": "body", "oscType": "sine", "freqHz": 54, "gain": 0.95, "stopAfter": 0.32 },
    { "kind": "gain", "id": "amp", "gain": 0.9 }
  ],
  "edges": [
    { "from": "body", "to": "amp" },
    { "from": "amp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "amp", "attack": 0.002, "release": 0.18, "peak": 1.0, "at": 0 },
    { "kind": "freqDrop", "node": "body", "startHz": 140, "endHz": 42, "duration": 0.08, "at": 0 }
  ]
}
```

```stfxr name:dawSnare seed:1337
{
  "nodes": [
    { "kind": "noiseVoice", "id": "noise", "noiseType": "white", "duration": 0.2, "gain": 0.45, "stopAfter": 0.22 },
    { "kind": "filter", "id": "hp", "filterType": "highpass", "freqHz": 1800, "q": 0.7 },
    { "kind": "gain", "id": "amp", "gain": 0.8 }
  ],
  "edges": [
    { "from": "noise", "to": "hp" },
    { "from": "hp", "to": "amp" },
    { "from": "amp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "amp", "attack": 0.001, "release": 0.11, "peak": 1.0, "at": 0 }
  ]
}
```

```stfxr name:dawHat seed:1337
{
  "nodes": [
    { "kind": "noiseVoice", "id": "noise", "noiseType": "white", "duration": 0.08, "gain": 0.22, "stopAfter": 0.08 },
    { "kind": "filter", "id": "hp", "filterType": "highpass", "freqHz": 5400, "q": 0.8 },
    { "kind": "gain", "id": "amp", "gain": 0.8 }
  ],
  "edges": [
    { "from": "noise", "to": "hp" },
    { "from": "hp", "to": "amp" },
    { "from": "amp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "amp", "attack": 0.001, "release": 0.035, "peak": 1.0, "at": 0 }
  ]
}
```

## Demo

```js
let state = {
  mouseDownLeft: false,
  widgets: null,
  layoutSize: { width: 0, height: 0 },
  bpm: 110,
  masterVolume: 0.68,
  seed: 1337,
  isPlaying: false,
  startAudioTime: 0,
  startBeatOffset: 0,
  pauseBeats: 0,
  lastProcessedStep: -1,
  currentStep: 0,
  stepCount: 16,
  statusText: 'Ready. Edit patterns or the synth graph, then press Play.',
  graphPreset: null,
  graphError: '',
  transportText: 'Stopped',
  lastNoteText: '(none)',
  playCounter: 0
};

const DEFAULT_MONO_PRESET = {
  vars: {
    rootHz: 110,
    tone: 1600
  },
  nodes: [
    { kind: 'oscVoice', id: 'osc1', oscType: 'sawtooth', freqHz: { kind: 'var', name: 'rootHz' }, gain: 0.22, stopAfter: 0.42 },
    { kind: 'oscVoice', id: 'osc2', oscType: 'square', freqHz: { kind: 'mul', a: { kind: 'var', name: 'rootHz' }, b: 0.5 }, gain: 0.08, stopAfter: 0.42 },
    { kind: 'filter', id: 'lp', filterType: 'lowpass', freqHz: { kind: 'var', name: 'tone' }, q: 0.9 },
    { kind: 'gain', id: 'amp', gain: 0.95 }
  ],
  edges: [
    { from: 'osc1', to: 'lp' },
    { from: 'osc2', to: 'lp' },
    { from: 'lp', to: 'amp' },
    { from: 'amp', to: 'out' }
  ],
  events: [
    { kind: 'envAR', node: 'amp', attack: 0.008, release: 0.18, peak: 1.0, at: 0 }
  ]
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value)));
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setStatus(text) {
  state.statusText = String(text == null ? '' : text);
  if (state.widgets && state.widgets.status) state.widgets.status.setText(state.statusText);
}

function setGraphStatus(text) {
  if (state.widgets && state.widgets.graphStatus) state.widgets.graphStatus.setText(String(text || ''));
}

function setTransportText(text) {
  state.transportText = String(text || '');
  if (state.widgets && state.widgets.transport) state.widgets.transport.setText(state.transportText);
}

function syncTransportButtons() {
  if (state.widgets && state.widgets.playButton && typeof state.widgets.playButton.setLabel === 'function') {
    state.widgets.playButton.setLabel(state.isPlaying ? 'Pause' : 'Play');
  }
}

function setStepText() {
  if (!state.widgets || !state.widgets.stepView) return;
  const cells = [];
  for (let i = 0; i < state.stepCount; i++) {
    const label = String(i + 1).padStart(2, '0');
    cells.push(i === state.currentStep ? '[' + label + ']' : ' ' + label + ' ');
  }
  state.widgets.stepView.setText('Steps: ' + cells.join(' '));
}

function setNowPlaying(text) {
  state.lastNoteText = String(text || '(none)');
  if (state.widgets && state.widgets.nowPlaying) state.widgets.nowPlaying.setText('Last note: ' + state.lastNoteText);
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

function noteNameToMidi(noteName) {
  const match = String(noteName || '').trim().match(/^([A-Ga-g])([#b]?)(-?\d+)$/);
  if (!match) return null;
  const baseMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let semitone = baseMap[match[1].toUpperCase()];
  if (match[2] === '#') semitone += 1;
  if (match[2] === 'b') semitone -= 1;
  const octave = Number(match[3]);
  if (!Number.isFinite(octave)) return null;
  return (octave + 1) * 12 + semitone;
}

function midiToHz(midi) {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

function noteNameToHz(noteName) {
  const midi = noteNameToMidi(noteName);
  return midi == null ? null : midiToHz(midi);
}

function sanitizeDrumPattern(text) {
  return String(text || '').replace(/\s+/g, '').toLowerCase();
}

function patternActive(text, stepIndex) {
  const pattern = sanitizeDrumPattern(text);
  if (!pattern) return false;
  const ch = pattern[stepIndex % pattern.length];
  return ch === 'x' || ch === '1' || ch === '*' || ch === '!';
}

function parseBassPattern(text) {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function bassTokenAt(text, stepIndex) {
  const tokens = parseBassPattern(text);
  if (!tokens.length) return '.';
  return tokens[stepIndex % tokens.length];
}

function buildTunedPreset(basePreset, hz) {
  const preset = deepClone(basePreset || DEFAULT_MONO_PRESET);
  if (!preset.vars || typeof preset.vars !== 'object') preset.vars = {};
  preset.vars.rootHz = Number(Number(hz).toFixed(4));
  if (preset.vars.tone == null) preset.vars.tone = 1600;
  return preset;
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
    const parsed = JSON.parse(raw);
    state.graphPreset = parsed;
    state.graphError = '';
    setGraphStatus('Graph parsed. Piano notes and bass lane now use this instrument.');
    setStatus('Applied synth graph from editor.');
    return true;
  } catch (error) {
    state.graphError = 'Graph parse error: ' + String(error && error.message ? error.message : error);
    setGraphStatus(state.graphError);
    setStatus(state.graphError);
    return false;
  }
}

function auditionInstrumentHz(hz, velocity, sourceLabel) {
  if (!Number.isFinite(hz)) return;
  resumeAudioIfNeeded();
  const preset = buildTunedPreset(state.graphPreset || DEFAULT_MONO_PRESET, hz);
  stfxr.playPreset(preset, nextSeed(), {
    volume: clamp(state.masterVolume * clamp(velocity == null ? 0.8 : velocity, 0.05, 1), 0, 1)
  });
  setNowPlaying(sourceLabel);
}

function triggerDrum(name, laneVolume) {
  resumeAudioIfNeeded();
  stfxr.play(name, nextSeed(), {
    volume: clamp(state.masterVolume * clamp(laneVolume, 0, 1), 0, 1)
  });
}

function triggerSequencerStep(stepIndex) {
  if (!state.widgets) return;

  if (patternActive(state.widgets.kickPattern.getValue(), stepIndex)) triggerDrum('dawKick', 0.95);
  if (patternActive(state.widgets.snarePattern.getValue(), stepIndex)) triggerDrum('dawSnare', 0.55);
  if (patternActive(state.widgets.hatPattern.getValue(), stepIndex)) triggerDrum('dawHat', 0.34);

  const noteToken = bassTokenAt(state.widgets.bassPattern.getValue(), stepIndex);
  if (noteToken !== '.' && noteToken !== '-' && noteToken !== '_') {
    const hz = noteNameToHz(noteToken);
    if (hz != null) {
      auditionInstrumentHz(hz, 0.72, noteToken + ' from bass lane');
    } else {
      setGraphStatus('Ignored invalid bass token: ' + String(noteToken));
    }
  }

  state.currentStep = stepIndex % state.stepCount;
  setStepText();
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
  setTransportText('Running at ' + String(Math.round(state.bpm)) + ' BPM');
  setStatus('Transport running. Text patterns are driving the graph-based kit and synth.');
}

function pauseTransport() {
  if (!state.isPlaying) return;
  state.pauseBeats = getTransportBeats();
  state.isPlaying = false;
  syncTransportButtons();
  setTransportText('Paused at beat ' + state.pauseBeats.toFixed(2));
  setStatus('Transport paused.');
}

function stopTransport() {
  state.pauseBeats = 0;
  state.startBeatOffset = 0;
  state.isPlaying = false;
  state.lastProcessedStep = -1;
  state.currentStep = 0;
  syncTransportButtons();
  setStepText();
  setTransportText('Stopped');
  setStatus('Transport stopped and rewound.');
}

function updateTransport() {
  const beat = getTransportBeats();
  const globalStep = Math.floor(beat / stepDurationBeats());
  if (state.isPlaying && globalStep > state.lastProcessedStep) {
    for (let step = state.lastProcessedStep + 1; step <= globalStep; step++) {
      triggerSequencerStep(step % state.stepCount);
    }
    state.lastProcessedStep = globalStep;
  }

  const bar = Math.floor(beat / 4) + 1;
  const stepInBar = (Math.floor(beat / stepDurationBeats()) % state.stepCount) + 1;
  setTransportText(
    (state.isPlaying ? 'Running' : 'Stopped') +
    ' | Bar ' + String(bar) +
    ' | Step ' + String(stepInBar).padStart(2, '0') +
    ' | Beat ' + beat.toFixed(2)
  );
}

function layoutWidgets() {
  if (!state.widgets) return;
  const viewport = gui.getViewportRect();
  const width = Math.max(780, Math.floor(viewport.width));
  const height = Math.max(720, Math.floor(viewport.height));
  if (width === state.layoutSize.width && height === state.layoutSize.height) return;
  state.layoutSize = { width: width, height: height };

  const gap = 12;
  const pad = 18;
  const leftWidth = Math.max(320, Math.floor(width * 0.34));
  const rightWidth = width - leftWidth - pad * 2 - gap;
  const transportHeight = 220;
  const pianoHeight = 200;
  const graphHeight = height - pad * 2 - transportHeight - pianoHeight - gap * 2;

  state.widgets.title.setBounds({ x: pad, y: pad, width: leftWidth, height: 28 });
  state.widgets.status.setBounds({ x: pad, y: pad + 28, width: leftWidth, height: 48 });
  state.widgets.transport.setBounds({ x: pad, y: pad + 74, width: leftWidth, height: 24 });
  state.widgets.stepView.setBounds({ x: pad, y: pad + 100, width: width - pad * 2, height: 24 });

  const buttonY = pad + 136;
  const buttonW = Math.floor((leftWidth - gap) / 2);
  state.widgets.playButton.setBounds({ x: pad, y: buttonY, width: buttonW, height: 40 });
  state.widgets.stopButton.setBounds({ x: pad + buttonW + gap, y: buttonY, width: buttonW, height: 40 });

  state.widgets.bpm.setBounds({ x: pad, y: buttonY + 48, width: leftWidth, height: 42 });
  state.widgets.master.setBounds({ x: pad, y: buttonY + 96, width: leftWidth, height: 42 });

  const patternY = buttonY + 148;
  state.widgets.patternLabel.setBounds({ x: pad, y: patternY, width: leftWidth, height: 24 });
  state.widgets.kickPattern.setBounds({ x: pad, y: patternY + 26, width: leftWidth, height: 40 });
  state.widgets.snarePattern.setBounds({ x: pad, y: patternY + 70, width: leftWidth, height: 40 });
  state.widgets.hatPattern.setBounds({ x: pad, y: patternY + 114, width: leftWidth, height: 40 });
  state.widgets.bassPattern.setBounds({ x: pad, y: patternY + 158, width: leftWidth, height: 40 });

  const pianoY = pad + transportHeight + gap;
  state.widgets.pianoLabel.setBounds({ x: pad, y: pianoY, width: leftWidth, height: 24 });
  state.widgets.nowPlaying.setBounds({ x: pad, y: pianoY + 24, width: leftWidth, height: 24 });
  state.widgets.piano.setBounds({ x: pad, y: pianoY + 52, width: leftWidth, height: pianoHeight - 52 });

  const rightX = pad + leftWidth + gap;
  state.widgets.graphLabel.setBounds({ x: rightX, y: pad, width: rightWidth, height: 24 });
  state.widgets.graphStatus.setBounds({ x: rightX, y: pad + 24, width: rightWidth, height: 44 });
  state.widgets.graphEditor.setBounds({ x: rightX, y: pad + 72, width: rightWidth, height: Math.max(240, graphHeight - 88) });
  state.widgets.applyGraph.setBounds({ x: rightX, y: pad + graphHeight - 6, width: 220, height: 40 });
  state.widgets.resetGraph.setBounds({ x: rightX + 232, y: pad + graphHeight - 6, width: 220, height: 40 });
}

function createWidgets() {
  gui.init();

  const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 28 }, text: 'DAW Sketch: text patterns + stfxr graphs', align: 'left' });
  const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: state.statusText, align: 'left' });
  const transport = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: state.transportText, align: 'left' });
  const stepView = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: '', align: 'left' });

  const playButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Play' });
  const stopButton = gui.createButton({ bounds: { x: 0, y: 0, width: 120, height: 40 }, label: 'Stop' });

  const bpm = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Tempo', min: 40, max: 180, value: state.bpm });
  const master = gui.createSlider({ bounds: { x: 0, y: 0, width: 120, height: 42 }, label: 'Master', min: 0, max: 100, value: Math.round(state.masterVolume * 100) });

  const patternLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Patterns: x = hit, . = rest, bass uses note tokens', align: 'left' });
  const kickPattern = gui.createTextField({ bounds: { x: 0, y: 0, width: 120, height: 40 }, value: 'x...x...x...x...', placeholder: 'Kick pattern' });
  const snarePattern = gui.createTextField({ bounds: { x: 0, y: 0, width: 120, height: 40 }, value: '....x.......x...', placeholder: 'Snare pattern' });
  const hatPattern = gui.createTextField({ bounds: { x: 0, y: 0, width: 120, height: 40 }, value: 'x.x.x.x.x.x.x.x.', placeholder: 'Hat pattern' });
  const bassPattern = gui.createTextField({ bounds: { x: 0, y: 0, width: 120, height: 40 }, value: 'C2 . C2 . G1 . A#1 . C2 . C2 . F1 . G1 .', placeholder: 'Bass notes' });

  const pianoLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Piano audition strip', align: 'left' });
  const nowPlaying = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Last note: (none)', align: 'left' });
  const piano = gui.createPianoKeyboard({
    bounds: { x: 0, y: 0, width: 100, height: 120 },
    minMidi: 36,
    maxMidi: 96,
    visibleWhiteKeys: 16,
    minVisibleWhiteKeys: 8,
    maxVisibleWhiteKeys: 24,
    showLabels: 'c',
    interactionMode: 'gate',
    railPlacement: 'leading',
    velocityMode: 'axis-cross'
  });

  const graphLabel = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 24 }, text: 'Editable stfxr instrument JSON', align: 'left' });
  const graphStatus = gui.createLabel({ bounds: { x: 0, y: 0, width: 100, height: 40 }, text: 'Apply the graph to update bass sequencing and piano auditioning.', align: 'left' });
  const graphEditor = gui.createTextEditor({
    bounds: { x: 0, y: 0, width: 100, height: 300 },
    value: JSON.stringify(DEFAULT_MONO_PRESET, null, 2),
    placeholder: '{\n  "nodes": []\n}'
  });
  const applyGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 180, height: 40 }, label: 'Apply Graph' });
  const resetGraph = gui.createButton({ bounds: { x: 0, y: 0, width: 180, height: 40 }, label: 'Reset Graph' });

  piano.on('noteon', function (event) {
    if (!event || !event.data) return;
    auditionInstrumentHz(Number(event.data.hz), Number(event.data.velocity || 0.7), String(event.data.noteName) + ' from piano');
  });

  state.widgets = {
    title,
    status,
    transport,
    stepView,
    playButton,
    stopButton,
    bpm,
    master,
    patternLabel,
    kickPattern,
    snarePattern,
    hatPattern,
    bassPattern,
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
  setStepText();
  setGraphStatus('Apply the graph to update bass sequencing and piano auditioning.');
  syncTransportButtons();
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

scope.update = function() {
  if (!state.widgets) return;

  layoutWidgets();
  gui.handleMouse(getMouseX(), getMouseY(), state.mouseDownLeft);
  gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

  state.bpm = clamp(state.widgets.bpm.getValue() || state.bpm, 40, 180);
  state.masterVolume = clamp((state.widgets.master.getValue() || 0) / 100, 0, 1);

  if (state.widgets.playButton.wasClicked()) {
    if (state.isPlaying) pauseTransport();
    else startTransport();
  }
  if (state.widgets.stopButton.wasClicked()) stopTransport();
  if (state.widgets.applyGraph.wasClicked()) parseGraphEditor();
  if (state.widgets.resetGraph.wasClicked()) {
    state.graphPreset = deepClone(DEFAULT_MONO_PRESET);
    state.widgets.graphEditor.setValue(JSON.stringify(DEFAULT_MONO_PRESET, null, 2));
    state.graphError = '';
    setGraphStatus('Reset to the default mono instrument graph.');
    setStatus('Reset the synth graph.');
  }

  updateTransport();
};

scope.render = function() {
  term.layerID = 'default';
  term.clear();
  ui.clear(getStyle('default').bg);
};
```

## Notes

- The transport here is intentionally simple and frame-driven. A real DAW needs lookahead scheduling tied to audio time.
- The current synth lane assumes a monophonic graph rooted at `vars.rootHz`.
- The most promising next merge is: piano keyboard note-axis + `stfxr` graph inspector + a text clip model.