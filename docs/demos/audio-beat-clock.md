---
name: "Audio Beats (4/4) → Beat/Bar Clock (Drop MP3)"
theme: "nord"
dropTarget: true

# Beat analysis tuning (optional)
bpmMin: 70
bpmMax: 190
envelopeHz: 120
smoothMs: 80
---

Drop an `.mp3`, then press Play.

- Detects a **4/4 beat grid** offline via `audio.beatsFromBuffer(audioBuffer)`.
- Shows **BPM**, **bar**, and **beat**.
- Exposes edge flags you can use to trigger animations.

## Game Code

```js
function st() {
  if (!scope.__beatClock) {
    scope.__beatClock = {
      widgets: null,
      mouseDownLeft: false,

      audioBuffer: null,
      source: null,
      gain: null,
      isPlaying: false,
      startTime: 0,
      pauseOffset: 0,
      wasSeeking: false,

      analysis: null,
      lastPos: 0,

      statusText: 'Status: waiting for drop'
    };
  }
  return scope.__beatClock;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getPosSec() {
  const s = st();
  if (!s.audioBuffer) return 0;
  if (!s.isPlaying) return clamp(s.pauseOffset, 0, s.audioBuffer.duration);
  return clamp(audio.currentTime - s.startTime, 0, s.audioBuffer.duration);
}

function stopSource({ keepOffset } = { keepOffset: true }) {
  const s = st();
  if (!s.source) return;
  try {
    if (keepOffset) {
      const pos = audio.currentTime - s.startTime;
      s.pauseOffset = clamp(pos, 0, s.audioBuffer?.duration ?? pos);
    } else {
      s.pauseOffset = 0;
    }
    s.source.onended = null;
    s.source.stop();
  } catch {
    // ignore
  }
  try { s.source.disconnect(); } catch { /* ignore */ }
  s.source = null;
  s.isPlaying = false;
}

function playFrom(offsetSec) {
  const s = st();
  if (!s.audioBuffer) return;

  stopSource({ keepOffset: false });

  const offset = clamp(offsetSec, 0, s.audioBuffer.duration);
  s.pauseOffset = offset;

  const src = audio.createBufferSource();
  src.buffer = s.audioBuffer;
  src.connect(s.gain ?? audio.destination);

  s.startTime = audio.currentTime - offset;
  s.isPlaying = true;

  src.onended = () => {
    const ss = st();
    if (ss.source === src) {
      ss.source = null;
      ss.isPlaying = false;
      const pos = audio.currentTime - ss.startTime;
      if (ss.audioBuffer) ss.pauseOffset = clamp(pos, 0, ss.audioBuffer.duration);
    }
  };

  s.source = src;
  src.start(0, offset);
}

function setStatus(t) {
  const s = st();
  s.statusText = t;
  if (s.widgets?.status) s.widgets.status.setText(t);
}

function beatOptions() {
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  return {
    bpmMin: num(bpmMin, 70),
    bpmMax: num(bpmMax, 190),
    envelopeHz: num(envelopeHz, 120),
    smoothMs: num(smoothMs, 80),
    meter: 4
  };
}
```

```js on:init
term.layerID = 'default';
const s = st();

gui.init();

const title = gui.createLabel({ bounds: { x: 20, y: 20, width: 900, height: 30 }, text: 'Audio Beats (4/4) → Beat/Bar Clock', align: 'left' });
const file = gui.createLabel({ bounds: { x: 20, y: 54, width: 1200, height: 24 }, text: 'File: (none)', align: 'left' });
const status = gui.createLabel({ bounds: { x: 20, y: 80, width: 1200, height: 24 }, text: s.statusText, align: 'left' });

const btnPlay = gui.createButton({ bounds: { x: 20, y: 120, width: 160, height: 44 }, label: 'Play' });
const btnPause = gui.createButton({ bounds: { x: 196, y: 120, width: 160, height: 44 }, label: 'Pause' });

const seek = gui.createSlider({ bounds: { x: 20, y: 178, width: 720, height: 52 }, label: 'Seek (sec)', min: 0, max: 1, value: 0, step: 0.01 });

const bpmLbl = gui.createLabel({ bounds: { x: 20, y: 240, width: 1200, height: 24 }, text: 'BPM: --', align: 'left' });
const clockLbl = gui.createLabel({ bounds: { x: 20, y: 266, width: 1200, height: 24 }, text: 'Bar: --  Beat: --  Phase: --', align: 'left' });
const timeLbl = gui.createLabel({ bounds: { x: 20, y: 292, width: 1200, height: 24 }, text: 'Time: --:-- / --:--', align: 'left' });

s.widgets = { title, file, status, btnPlay, btnPause, seek, bpmLbl, clockLbl, timeLbl };

s.gain = audio.createGain();
s.gain.gain.value = 1;
s.gain.connect(audio.destination);

audio.context.resume().catch(() => {});
```

```js on:drop
const s = st();
stopSource({ keepOffset: false });

s.audioBuffer = null;
s.analysis = null;
s.pauseOffset = 0;

s.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
setStatus('Status: decoding...');

void (async () => {
  try {
    await audio.context.resume().catch(() => {});

    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);

    const buf = await audio.context.decodeAudioData(ab);
    s.audioBuffer = buf;

    setStatus('Status: analyzing beats...');
    const analysis = audio.beatsFromBuffer(buf, beatOptions());
    s.analysis = analysis;

    s.widgets.seek.max = buf.duration;
    s.widgets.seek.setValue(0);

    s.widgets.bpmLbl.setText(`BPM: ${analysis.bpm.toFixed(1)}  (conf ${analysis.confidence.toFixed(2)})  meter ${analysis.meter}/4`);
    s.widgets.timeLbl.setText(`Time: 0:00 / ${fmtTime(buf.duration)}`);
    setStatus('Status: ready');
  } catch (e) {
    console.warn('[drop] decode/analyze failed:', e);
    setStatus('Status: decode/analyze failed');
  }
})();
```

```js on:input
const s = st();
if (!event) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt')
  });
}

if (event.type === 'text') gui.handleText(event.text);

if (event.type === 'mouse') {
  if (event.button === 'left') s.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  gui.handleMouse(event.x, event.y, s.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, s.mouseDownLeft);
}
```

```js on:update
const s = st();
if (!s.widgets) return;

gui.update(getMouseX(), getMouseY(), s.mouseDownLeft);

if (s.widgets.btnPlay.wasClicked()) {
  if (!s.audioBuffer) setStatus('Status: drop an .mp3 first');
  else {
    audio.context.resume().catch(() => {});
    playFrom(s.pauseOffset);
  }
}

if (s.widgets.btnPause.wasClicked()) stopSource({ keepOffset: true });

const isSeeking = s.widgets.seek?.isDragging?.() ?? false;
if (s.audioBuffer && s.widgets.seek) {
  s.widgets.seek.max = s.audioBuffer.duration;
  const released = s.wasSeeking && !isSeeking;
  if (released) {
    const newPos = s.widgets.seek.getValue();
    if (s.isPlaying) playFrom(newPos);
    else s.pauseOffset = clamp(newPos, 0, s.audioBuffer.duration);
  }
  if (!isSeeking && !released) s.widgets.seek.setValue(getPosSec());
}
s.wasSeeking = isSeeking;

if (s.audioBuffer) {
  const pos = getPosSec();
  s.widgets.timeLbl.setText(`Time: ${fmtTime(pos)} / ${fmtTime(s.audioBuffer.duration)}`);

  if (s.analysis) {
    const beat = audio.beatState(s.analysis, pos, s.lastPos);

    // 1-based display for bar/beat
    const bar1 = beat.barIndex + 1;
    const beat1 = beat.beatInBar;

    // Use phase as a handy animation driver.
    const phase = beat.beatPhase;

    s.widgets.clockLbl.setText(
      `Bar: ${bar1}  Beat: ${beat1}/${beat.meter}  Phase: ${phase.toFixed(2)}  ${beat.isDownbeatEdge ? '[DOWN]' : beat.isBeatEdge ? '[BEAT]' : ''}`
    );
  }

  s.lastPos = pos;
}
```
