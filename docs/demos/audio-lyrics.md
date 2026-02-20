---
name: "Audio Beats → Lyric Sections (Drop MP3)"
theme: "neonopia"
dropTarget: true
shaders: "handcam+bloom+lightvignette+crt"

# Lyric section selection
lyricLevel: 1
lyricPrefix: ""
lyricExcludeTitles: ["Game Code"]

# Beat analysis tuning (optional)
bpmMin: 70
bpmMax: 190
envelopeHz: 120
smoothMs: 80
meter: 4

# Optional onset mode (defaults to energy)
# onsetMode: "energy" | "spectralFlux"
onsetMode: "energy"
fftSize: 2048
fftWindow: "hann"
---

Drop an `.mp3` file and watch the engine advance lyric sections on **downbeats** (bar starts).

- Uses offline beat detection via `audio.beatsFromBuffer(audioBuffer)`.
- Uses `audio.beatState(analysis, time, prevTime)` each frame to detect downbeat edges.
- If Worlds is available (WebGPU), it focuses the 3D camera on the current section.

# Verse 1
Lorem ipsum dolor sit amet, consectetur adipiscing elit.
Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
Nisi ut aliquip ex ea commodo consequat.

# Verse 2
Duis aute irure dolor in reprehenderit in voluptate velit esse.
Cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident.
Sunt in culpa qui officia deserunt mollit anim id est laborum.

# Pre-Chorus
Vivamus sagittis lacus vel augue laoreet rutrum faucibus dolor auctor.
Integer posuere erat a ante venenatis dapibus posuere velit aliquet.
Donec sed odio dui. Aenean eu leo quam.
Pellentesque ornare sem lacinia quam venenatis vestibulum.

# Chorus
Curabitur blandit tempus porttitor.
Maecenas sed diam eget risus varius blandit sit amet non magna.
Praesent commodo cursus magna, vel scelerisque nisl consectetur et.
Etiam porta sem malesuada magna mollis euismod.

# Bridge
Fusce dapibus, tellus ac cursus commodo, tortor mauris condimentum nibh.
Ut fermentum massa justo sit amet risus.
Morbi leo risus, porta ac consectetur ac, vestibulum at eros.
Nullam id dolor id nibh ultricies vehicula ut id elit.

# Outro
Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit.
Quo minus id quod maxime placeat facere possimus.
Omnis voluptas assumenda est, omnis dolor repellendus.
Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus.

## Game Code

```js
function st() {
  if (!scope.__beatLyrics) {
    scope.__beatLyrics = {
      widgets: null,
      panel: null,
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

      lyricSectionIndices: [],
      lyricCursor: 0,

      statusText: 'Status: waiting for drop'
    };
  }
  return scope.__beatLyrics;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getScreenW() {
  if (typeof getViewportPixelWidth === 'function') return getViewportPixelWidth();
  if (typeof width === 'number' && width > 0) return width;
  if (ui?.metrics?.canvasWidth) return ui.metrics.canvasWidth;
  return 800;
}

function getScreenH() {
  if (typeof getViewportPixelHeight === 'function') return getViewportPixelHeight();
  if (typeof height === 'number' && height > 0) return height;
  if (ui?.metrics?.canvasHeight) return ui.metrics.canvasHeight;
  return 600;
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

function computeLyricSectionIndices() {
  const s = st();
  const flat = (doc?.sectionsFlat && typeof doc.sectionsFlat === 'function') ? doc.sectionsFlat() : [];

  const desiredLevel = (typeof lyricLevel === 'number' && Number.isFinite(lyricLevel))
    ? Math.max(1, Math.min(6, Math.floor(lyricLevel)))
    : 1;
  const prefix = (typeof lyricPrefix === 'string') ? lyricPrefix : '';
  const exclude = Array.isArray(lyricExcludeTitles)
    ? new Set(lyricExcludeTitles.map((t) => String(t)))
    : new Set(["Game Code"]);

  const indices = [];
  for (const sec of flat) {
    if (!sec) continue;
    if (sec.level !== desiredLevel) continue;
    const title = String(sec.title ?? '');
    if (exclude.has(title)) continue;
    if (prefix && !title.startsWith(prefix)) continue;
    indices.push(title);
  }

  s.lyricSectionIndices = indices;
  s.lyricCursor = 0;
  return indices;
}

function focusSection(targetTitle) {
  const s = st();

  if (worlds?.available) {
    worlds.enable();
    worlds.controls.setEnabled(false);
    worlds.camera.focusOnSection(targetTitle, 60);
  }

  if (s.widgets?.section) s.widgets.section.setText(`Section: ${String(targetTitle)}`);
}

function lowerBound(arr, v) {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function syncSectionToPos(posSec) {
  const s = st();
  const list = (s.lyricSectionIndices && s.lyricSectionIndices.length > 0)
    ? s.lyricSectionIndices
    : computeLyricSectionIndices();
  if (!s.analysis || list.length === 0) return;

  // Choose a section based on which downbeat we're currently in.
  const db = s.analysis.downbeats ?? [];
  const downbeatIndex = lowerBound(db, posSec);
  s.lyricCursor = downbeatIndex % list.length;
  focusSection(list[s.lyricCursor]);
}

function beatOptions() {
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };
  const mode = (typeof onsetMode === 'string') ? onsetMode : 'energy';
  const win = (typeof fftWindow === 'string') ? fftWindow : 'hann';
  return {
    bpmMin: num(bpmMin, 70),
    bpmMax: num(bpmMax, 190),
    envelopeHz: num(envelopeHz, 120),
    smoothMs: num(smoothMs, 80),
    meter: num(meter, 4),
    onsetMode: mode,
    fftSize: num(fftSize, 2048),
    fftWindow: win
  };
}
```

```js on:init
term.layerID = 'default';
const s = st();

computeLyricSectionIndices();

gui.init();

// Top-right panel (kept pinned each frame in on:update)
const panel = gui.createContainer({ bounds: { x: 0, y: 0, width: 420, height: 420 }, padding: 12, gap: 8, alignX: 'stretch' });

const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 30 }, text: 'Audio Beats → Lyric Sections', align: 'left' });
const hint = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Drop an .mp3. Play. Downbeats focus sections (WebGPU required).', align: 'left' });
const file = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'File: (none)', align: 'left' });
const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: s.statusText, align: 'left' });

const btnPlay = gui.createButton({ bounds: { x: 0, y: 0, width: 420, height: 44 }, label: 'Play' });
const btnPause = gui.createButton({ bounds: { x: 0, y: 0, width: 420, height: 44 }, label: 'Pause' });

const time = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Time: --:-- / --:--', align: 'left' });
const seek = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Seek (sec)', min: 0, max: 1, value: 0, step: 0.01 });

const bpmLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'BPM: --', align: 'left' });
const clockLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Bar: --  Beat: --  Phase: --', align: 'left' });

const section = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Section: (none)', align: 'left' });

panel
  .add(title)
  .add(hint)
  .add(file)
  .add(status)
  .add(btnPlay)
  .add(btnPause)
  .add(time)
  .add(seek)
  .add(bpmLbl)
  .add(clockLbl)
  .add(section);

panel.layout();

s.panel = panel;
s.widgets = { title, hint, file, status, btnPlay, btnPause, time, seek, bpmLbl, clockLbl, section };

s.gain = audio.createGain();
s.gain.gain.value = 1;
s.gain.connect(audio.destination);

if (worlds?.available) {
  worlds.enable();
  worlds.controls.setEnabled(false);
  worlds.camera.setFOV?.(60);
}

audio.context.resume().catch(() => {});
```

```js on:drop
const s = st();
stopSource({ keepOffset: false });

s.audioBuffer = null;
s.analysis = null;
s.pauseOffset = 0;
s.lastPos = 0;

s.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
s.widgets.time.setText('Time: --:-- / --:--');
s.widgets.bpmLbl.setText('BPM: analyzing...');
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
    s.widgets.time.setText(`Time: 0:00 / ${fmtTime(buf.duration)}`);

    const list = computeLyricSectionIndices();
    if (list.length > 0) focusSection(list[0]);

    setStatus('Status: ready');
  } catch (e) {
    console.warn('[drop] decode/analyze failed:', e);
    setStatus('Status: decode/analyze failed');
    s.widgets.bpmLbl.setText('BPM: (failed)');
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

// Keep panel pinned top-right
if (s.panel) {
  const margin = 20;
  const w = 420;
  const h = 420;
  const x = Math.max(margin, getScreenW() - w - margin);
  const y = margin;
  s.panel.setBounds({ x, y, width: w, height: h }, true);
}

gui.update(getMouseX(), getMouseY(), s.mouseDownLeft);

if (s.widgets.btnPlay.wasClicked()) {
  if (!s.audioBuffer) setStatus('Status: drop an .mp3 first');
  else {
    audio.context.resume().catch(() => {});
    playFrom(s.pauseOffset);
  }
}

if (s.widgets.btnPause.wasClicked()) stopSource({ keepOffset: true });

// Seek
const isSeeking = s.widgets.seek?.isDragging?.() ?? false;
if (s.audioBuffer && s.widgets.seek) {
  s.widgets.seek.max = s.audioBuffer.duration;
  const released = s.wasSeeking && !isSeeking;
  if (released) {
    const newPos = s.widgets.seek.getValue();
    if (s.isPlaying) playFrom(newPos);
    else s.pauseOffset = clamp(newPos, 0, s.audioBuffer.duration);

    syncSectionToPos(clamp(newPos, 0, s.audioBuffer.duration));
    s.lastPos = clamp(newPos, 0, s.audioBuffer.duration);
  }
  if (!isSeeking && !released) s.widgets.seek.setValue(getPosSec());
}
s.wasSeeking = isSeeking;

if (s.audioBuffer) {
  const pos = getPosSec();
  s.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(s.audioBuffer.duration)}`);

  if (s.analysis) {
    const beat = audio.beatState(s.analysis, pos, s.lastPos);

    const bar1 = beat.barIndex + 1;
    const beat1 = beat.beatInBar;

    s.widgets.clockLbl.setText(
      `Bar: ${bar1}  Beat: ${beat1}/${beat.meter}  Phase: ${beat.beatPhase.toFixed(2)}  ${beat.isDownbeatEdge ? '[DOWN]' : beat.isBeatEdge ? '[BEAT]' : ''}`
    );

    // Advance lyric section on downbeat edges
    if (beat.isDownbeatEdge) {
      const list = (s.lyricSectionIndices && s.lyricSectionIndices.length > 0)
        ? s.lyricSectionIndices
        : computeLyricSectionIndices();

      if (list.length > 0) {
        s.lyricCursor = (s.lyricCursor + 1) % list.length;
        focusSection(list[s.lyricCursor]);
      }
    }
  }

  s.lastPos = pos;
}
```
