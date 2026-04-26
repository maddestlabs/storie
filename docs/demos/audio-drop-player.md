---
name: "Dropped Audio Player"
theme: "neonopia"
dropTarget: true
---

A minimal drag-and-drop music player demo built on the portable audio handle layer.

- Drop an audio file onto the canvas.
- Use **Play / Pause** and the **Position** slider to seek.

## Game Code

```js
function state() {
  // Important: Storie wraps lifecycle handlers with local imports from `scope`.
  // Any helper functions declared in global scope close over *global* bindings,
  // not the handler-local imports. To keep everything consistent, store demo
  // state on `scope` and always read/write through it.
  if (!scope.__audioDropPlayer) {
    scope.__audioDropPlayer = {
      widgets: null,
      mouseDownLeft: false,

      clip: null,
      clipInfo: null,
      voice: null,
      pauseOffset: 0,     // seconds
      lastSeekDragging: false
    };
  }
  return scope.__audioDropPlayer;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getDurationSec() {
  const st = state();
  return st.clipInfo?.durationSec ?? 0;
}

function syncVoice() {
  const st = state();
  if (!st.voice) return null;

  const voice = audio.voiceInfo(st.voice);
  if (!voice) {
    st.voice = null;
    return null;
  }

  if (voice.state === 'stopped') {
    st.pauseOffset = clamp(voice.offsetSec, 0, getDurationSec());
    st.voice = null;
    return null;
  }

  return voice;
}

function getPositionSec() {
  const st = state();
  const duration = getDurationSec();
  if (!duration) return 0;

  const voice = syncVoice();
  if (!voice || voice.startedAtSec == null) {
    return clamp(st.pauseOffset, 0, duration);
  }

  const elapsed = Math.max(0, audio.currentTime - voice.startedAtSec);
  return clamp(voice.offsetSec + elapsed * voice.playbackRate, 0, duration);
}

function stopVoice({ keepOffset } = { keepOffset: true }) {
  const st = state();
  const voice = syncVoice();
  if (keepOffset) {
    st.pauseOffset = getPositionSec();
  } else {
    st.pauseOffset = 0;
  }

  if (!voice) return;
  audio.stop(voice);
  st.voice = null;
}

function playFrom(offsetSec) {
  const st = state();
  if (!st.clip || !st.clipInfo) return;

  stopVoice({ keepOffset: false });

  const offset = clamp(offsetSec, 0, st.clipInfo.durationSec);
  st.pauseOffset = offset;

  const voice = audio.play(st.clip, { gain: 1, offsetSec: offset });
  if (!voice) {
    console.warn('[audio] play failed');
    return;
  }
  st.voice = voice;
}

function setStatus(text) {
  const st = state();
  if (st.widgets?.status) st.widgets.status.setText(text);
}
```

```js on:init
term.layerID = 'default';

const st = state();

// Initialize GUI
gui.init();

const title = gui.createLabel({
  bounds: { x: 20, y: 20, width: 800, height: 30 },
  text: 'Dropped Audio Player',
  align: 'left'
});

const hint = gui.createLabel({
  bounds: { x: 20, y: 52, width: 1000, height: 24 },
  text: 'Drop an audio file onto the canvas to load it.',
  align: 'left'
});

const file = gui.createLabel({
  bounds: { x: 20, y: 80, width: 1000, height: 24 },
  text: 'File: (none)',
  align: 'left'
});

const status = gui.createLabel({
  bounds: { x: 20, y: 106, width: 1000, height: 24 },
  text: 'Status: waiting for drop',
  align: 'left'
});

const btnPlay = gui.createButton({
  bounds: { x: 20, y: 150, width: 160, height: 44 },
  label: 'Play'
});

const btnPause = gui.createButton({
  bounds: { x: 196, y: 150, width: 160, height: 44 },
  label: 'Pause'
});

const seek = gui.createSlider({
  bounds: { x: 20, y: 210, width: 720, height: 54 },
  label: 'Position',
  min: 0,
  max: 1,
  value: 0,
  step: 0.01
});

const time = gui.createLabel({
  bounds: { x: 20, y: 274, width: 1000, height: 24 },
  text: 'Time: 0:00 / 0:00',
  align: 'left'
});

st.widgets = { title, hint, file, status, btnPlay, btnPause, seek, time };
```

```js on:drop
// Drop handler receives raw bytes because this document sets `dropTarget: true`.

const st = state();

// Stop current playback if any
stopVoice({ keepOffset: false });
st.clip = null;
st.clipInfo = null;
st.pauseOffset = 0;

st.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
st.widgets.time.setText('Time: --:-- / --:--');
setStatus('Status: decoding...');

const clip = await audio.asset.fromDrop();
if (!clip) {
  setStatus('Status: decode failed (try a different audio file)');
  return;
}

st.clip = clip;
st.clipInfo = audio.asset.info(clip);
st.pauseOffset = 0;

const duration = st.clipInfo?.durationSec ?? 0;

st.widgets.seek.min = 0;
st.widgets.seek.max = Math.max(0.01, duration);
st.widgets.seek.step = 0.01;
st.widgets.seek.setValue(0);

st.widgets.time.setText(`Time: 0:00 / ${fmtTime(duration)}`);
setStatus(`Status: ready (${fmtTime(duration)}) via portable audio handles`);
```

```js on:input
if (!event) return;

const st = state();

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    st.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, st.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, st.mouseDownLeft);
}
```

```js on:update
const st = state();
if (!st.widgets) return;

gui.update(getMouseX(), getMouseY(), st.mouseDownLeft);

// Buttons
if (st.widgets.btnPlay.wasClicked()) {
  if (!st.clip || !st.clipInfo) {
    setStatus('Status: drop an audio file first');
  } else {
    playFrom(st.pauseOffset);
    setStatus('Status: playing');
  }
}

if (st.widgets.btnPause.wasClicked()) {
  stopVoice({ keepOffset: true });
  setStatus('Status: paused');
}

// Seek behavior: apply seek when the user releases the knob
if (st.clipInfo) {
  syncVoice();
  const dragging = st.widgets.seek.isDragging();
  if (!dragging && st.lastSeekDragging) {
    const target = clamp(st.widgets.seek.getValue(), 0, st.clipInfo.durationSec);
    st.pauseOffset = target;
    if (st.voice) {
      playFrom(target);
      setStatus(`Status: seeked to ${fmtTime(target)}`);
    }
  }
  st.lastSeekDragging = dragging;

  // Keep slider synced during playback (unless the user is dragging)
  if (!dragging) {
    st.widgets.seek.setValue(getPositionSec());
  }

  // Update time display
  const pos = getPositionSec();
  st.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(st.clipInfo.durationSec)}`);
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

// Keep the terminal layer quiet; GUI is the focus.
term.layerID = 'default';
term.clear();
```
