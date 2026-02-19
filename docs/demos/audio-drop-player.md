---
name: "Dropped MP3 Player"
theme: "neonopia"
dropTarget: true
---

A minimal drag-and-drop music player demo.

- Drop an `.mp3` file onto the canvas.
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

      audioBuffer: null,
      source: null,
      gain: null,

      isPlaying: false,
      startTime: 0,       // audio.currentTime - offset
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

function stopSource({ keepOffset } = { keepOffset: true }) {
  const st = state();
  if (!st.source) return;
  try {
    if (keepOffset) {
      const pos = audio.currentTime - st.startTime;
      st.pauseOffset = clamp(pos, 0, st.audioBuffer?.duration ?? pos);
    } else {
      st.pauseOffset = 0;
    }
    st.source.onended = null;
    st.source.stop();
  } catch {
    // ignore
  }
  try { st.source.disconnect(); } catch { /* ignore */ }
  st.source = null;
  st.isPlaying = false;
}

function playFrom(offsetSec) {
  const st = state();
  if (!st.audioBuffer) return;

  // WebAudio sources are one-shot; recreate each play/seek.
  stopSource({ keepOffset: false });

  const offset = clamp(offsetSec, 0, st.audioBuffer.duration);
  st.pauseOffset = offset;

  const s = audio.createBufferSource();
  s.buffer = st.audioBuffer;
  s.connect(st.gain ?? audio.destination);

  st.startTime = audio.currentTime - offset;
  st.isPlaying = true;

  s.onended = () => {
    // Natural end (or stop) ends playback; we treat both as "not playing".
    // pauseOffset is maintained by stopSource() when we stop explicitly.
    if (st.source === s) {
      st.source = null;
      st.isPlaying = false;
      // Clamp at end if we ran to completion.
      const pos = audio.currentTime - st.startTime;
      if (st.audioBuffer) st.pauseOffset = clamp(pos, 0, st.audioBuffer.duration);
    }
  };

  st.source = s;
  try {
    s.start(0, offset);
  } catch (e) {
    // If start fails, reset state.
    st.source = null;
    st.isPlaying = false;
    console.warn('[audio] start failed:', e);
  }
}

function getPositionSec() {
  const st = state();
  if (!st.audioBuffer) return 0;
  if (!st.isPlaying) return clamp(st.pauseOffset, 0, st.audioBuffer.duration);
  return clamp(audio.currentTime - st.startTime, 0, st.audioBuffer.duration);
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
  text: 'Dropped MP3 Player',
  align: 'left'
});

const hint = gui.createLabel({
  bounds: { x: 20, y: 52, width: 1000, height: 24 },
  text: 'Drop an .mp3 file onto the canvas to load it.',
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

// Gain node for clean reconnects (volume left at 100% for this minimal demo)
st.gain = audio.createGain();
st.gain.gain.value = 1;
st.gain.connect(audio.destination);

// Try to pre-warm the context; browsers may still require a gesture.
audio.context.resume().catch(() => {});
```

```js on:drop
// Drop handler receives raw bytes because this document sets `dropTarget: true`.

const st = state();

// Stop current playback if any
stopSource({ keepOffset: false });
st.audioBuffer = null;
st.pauseOffset = 0;

st.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
st.widgets.time.setText('Time: --:-- / --:--');
setStatus('Status: decoding...');

const lowerName = String(file.name || '').toLowerCase();
const looksLikeMp3 = lowerName.endsWith('.mp3') || String(file.mime || '').includes('mpeg');
if (!looksLikeMp3) {
  setStatus('Status: please drop an .mp3 file');
}

void (async () => {
  try {
    await audio.context.resume().catch(() => {});

    // Copy into an exact, standalone ArrayBuffer for decodeAudioData
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);

    const buf = await audio.context.decodeAudioData(ab);
    st.audioBuffer = buf;
    st.pauseOffset = 0;

    // Configure seek slider to match duration
    st.widgets.seek.min = 0;
    st.widgets.seek.max = Math.max(0.01, buf.duration);
    st.widgets.seek.step = 0.01;
    st.widgets.seek.setValue(0);

    st.widgets.time.setText(`Time: 0:00 / ${fmtTime(buf.duration)}`);
    setStatus(`Status: ready (${fmtTime(buf.duration)})`);
  } catch (e) {
    console.warn('[drop] audio decode failed:', e);
    setStatus('Status: decode failed (try a different mp3)');
  }
})();
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
  if (!st.audioBuffer) {
    setStatus('Status: drop an .mp3 first');
  } else {
    audio.context.resume().catch(() => {});
    playFrom(st.pauseOffset);
  }
}

if (st.widgets.btnPause.wasClicked()) {
  stopSource({ keepOffset: true });
}

// Seek behavior: apply seek when the user releases the knob
if (st.audioBuffer) {
  const dragging = st.widgets.seek.isDragging();
  if (!dragging && st.lastSeekDragging) {
    const target = clamp(st.widgets.seek.getValue(), 0, st.audioBuffer.duration);
    st.pauseOffset = target;
    if (st.isPlaying) {
      playFrom(target);
    }
  }
  st.lastSeekDragging = dragging;

  // Keep slider synced during playback (unless the user is dragging)
  if (!dragging) {
    st.widgets.seek.setValue(getPositionSec());
  }

  // Update time display
  const pos = getPositionSec();
  st.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(st.audioBuffer.duration)}`);
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

// Keep the terminal layer quiet; GUI is the focus.
term.layerID = 'default';
term.clear();
```
