---
name: "Portable Audio Drop"
theme: "neonopia"
dropTarget: true
---

A minimal audio demo that uses the portable audio handle layer instead of raw `audio.context` access.

- Drop an audio file onto the canvas.
- Press `SPACE` to play or stop.
- Press `B` to run beat detection on the loaded asset.

```js
let state = {
  clip: null,
  voice: null,
  status: 'Drop an audio file to begin.',
  beats: null,
};

function stopVoice() {
  if (!state.voice) return;
  audio.stop(state.voice);
  state.voice = null;
}
```

```js on:drop
state.beats = null;
stopVoice();

const clip = await audio.asset.fromDrop();
if (!clip) {
  state.clip = null;
  state.status = 'Failed to decode dropped audio.';
  return;
}

state.clip = clip;
const info = audio.asset.info(clip);
state.status = info
  ? `Loaded ${info.source} audio: ${info.durationSec.toFixed(2)}s, ${info.channels}ch @ ${info.sampleRate}Hz`
  : 'Loaded audio asset.';
```

```js on:update
if (!state.clip) return;

if (key.pressed(key.SPACE)) {
  if (state.voice && audio.voiceInfo(state.voice)?.state === 'playing') {
    stopVoice();
    state.status = 'Stopped playback.';
  } else {
    state.voice = audio.play(state.clip, { gain: 0.8 });
    state.status = state.voice ? 'Playing loaded audio.' : 'Failed to start playback.';
  }
}

if (key.pressed('b') || key.pressed('B')) {
  state.beats = audio.analysis.beats(state.clip);
  if (state.beats) {
    state.status = `Beat analysis ready: ${state.beats.bpm.toFixed(1)} BPM, ${state.beats.beats.length} beats.`;
  } else {
    state.status = 'Beat analysis failed.';
  }
}

if (state.voice && audio.voiceInfo(state.voice)?.state === 'stopped') {
  state.voice = null;
}
```

```js on:render
term.clear();

term.write(2, 2, '=== Portable Audio Handle Demo ===', 0x00ff88ff);
term.write(2, 4, 'Drop an audio file onto the canvas.', 0xffffffff);
term.write(2, 5, 'Press SPACE to play or stop.', 0xffffffff);
term.write(2, 6, 'Press B to run beat detection.', 0xffffffff);

term.write(2, 8, state.status, 0xaaaaffff);

if (state.clip) {
  const info = audio.asset.info(state.clip);
  if (info) {
    term.write(2, 10, `Asset: ${info.id}`, 0x888888ff);
    term.write(2, 11, `Duration: ${info.durationSec.toFixed(2)}s`, 0x888888ff);
    term.write(2, 12, `Channels: ${info.channels}`, 0x888888ff);
  }
}

if (state.voice) {
  const voice = audio.voiceInfo(state.voice);
  if (voice) {
    term.write(2, 14, `Voice: ${voice.id}`, 0x888888ff);
    term.write(2, 15, `State: ${voice.state}`, 0x888888ff);
    term.write(2, 16, `Gain: ${voice.gain.toFixed(2)}`, 0x888888ff);
  }
}

if (state.beats) {
  term.write(2, 18, `Detected BPM: ${state.beats.bpm.toFixed(1)}`, 0xffdd88ff);
  term.write(2, 19, `Beat Count: ${state.beats.beats.length}`, 0xffdd88ff);
}
```