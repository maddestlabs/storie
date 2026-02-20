---
name: "Audio Peaks → Lyric Sections (Drop MP3)"
theme: "nord"
dropTarget: true
# Lyric section selection (usability knobs)
# - lyricLevel: heading level to treat as a lyric "segment" (1 = '#', 2 = '##', ...)
# - lyricPrefix: if set, only headings whose title starts with this prefix are included
# - lyricExcludeTitles: exact titles to skip (array)
lyricLevel: 1
lyricPrefix: ""
lyricExcludeTitles: ["Game Code"]

# Peak detection tuning (optional)
peakWindowMs: 12
peakSmoothMs: 100
peakMinGapMs: 140
peakThresholdMul: 1.3
peakMinThreshold: 0.02
peakCompressPow: 2
peakMinProminence: 0.02
---

Drop an `.mp3` file and watch the engine trigger lyric section changes on detected audio peaks.

- Uses **offline peak detection** via `audio.peaksFromBuffer(audioBuffer)`.
- On each peak, advances the current lyric **section index**.
- If Worlds is available, it focuses the 3D camera on the current section.

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
  if (!scope.__peakLyrics) {
    scope.__peakLyrics = {
      widgets: null,
      panel: null,
      mouseDownLeft: false,

      audioBuffer: null,
      source: null,
      gain: null,
      isPlaying: false,
      startTime: 0,
      pauseOffset: 0,

      peaks: [],
      peakIndex: 0,
      sectionIndex: 0,

      lyricSectionIndices: [],
      lyricCursor: 0,

      wasSeeking: false,

      peakTuning: {
        windowMs: 12,
        smoothMs: 100,
        minGapMs: 140,
        thresholdMul: 1.3,
        minProminence: 0.02
      },

      statusText: 'Status: waiting for drop'
    };
  }
  return scope.__peakLyrics;
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

function focusSection(target) {
  const s = st();
  s.sectionIndex = target;

  // Worlds is optional: focus camera when available/enabled.
  if (worlds?.available) {
    worlds.enable();
    worlds.controls.setEnabled(false);
    worlds.camera.focusOnSection(target, 60);
  }

  if (s.widgets?.section) s.widgets.section.setText(`Section: ${String(target)}`);
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

function syncPeaksAndSectionToPos(posSec) {
  const s = st();
  if (!s.audioBuffer) return;

  const list = (s.lyricSectionIndices && s.lyricSectionIndices.length > 0)
    ? s.lyricSectionIndices
    : computeLyricSectionIndices();

  s.peakIndex = lowerBound(s.peaks ?? [], posSec);

  if (list.length > 0) {
    s.lyricCursor = s.peakIndex % list.length;
    focusSection(list[s.lyricCursor]);
  }
}

function peakOptions() {
  // Frontmatter values are exposed as globals.
  // Keep this tolerant of strings/invalid values.
  const num = (v, def) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : def;
  };

  return {
    windowMs: num(peakWindowMs, 12),
    smoothMs: num(peakSmoothMs, 120),
    minGapMs: num(peakMinGapMs, 160),
    thresholdMul: num(peakThresholdMul, 1.7),
    minThreshold: num(peakMinThreshold, 0.02),
    compressPow: num(peakCompressPow, 2),
    minProminence: num(peakMinProminence, 0.03)
  };
}

function peakOptionsFromUI() {
  const s = st();
  const t = s.peakTuning;
  const base = peakOptions();
  return {
    ...base,
    windowMs: t.windowMs,
    smoothMs: t.smoothMs,
    minGapMs: t.minGapMs,
    thresholdMul: t.thresholdMul,
    minProminence: t.minProminence
  };
}
```

```js on:init
term.layerID = 'default';
const s = st();

computeLyricSectionIndices();

gui.init();

// Initialize runtime tuning from frontmatter defaults.
{
  const opts = peakOptions();
  s.peakTuning.windowMs = opts.windowMs;
  s.peakTuning.smoothMs = opts.smoothMs;
  s.peakTuning.minGapMs = opts.minGapMs;
  s.peakTuning.thresholdMul = opts.thresholdMul;
  s.peakTuning.minProminence = opts.minProminence;
}

// Top-right panel (kept pinned each frame in on:update)
const panel = gui.createContainer({ bounds: { x: 0, y: 0, width: 420, height: 520 }, padding: 12, gap: 8, alignX: 'stretch' });

const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 30 }, text: 'Audio Peaks → Lyric Sections', align: 'left' });
const hint = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Drop an .mp3. Play. Peaks focus sections (WebGPU required).', align: 'left' });
const file = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'File: (none)', align: 'left' });
const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: s.statusText, align: 'left' });

const btnPlay = gui.createButton({ bounds: { x: 0, y: 0, width: 420, height: 44 }, label: 'Play' });
const btnPause = gui.createButton({ bounds: { x: 0, y: 0, width: 420, height: 44 }, label: 'Pause' });

const time = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Time: --:-- / --:--', align: 'left' });
const seek = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Seek (sec)', min: 0, max: 1, value: 0, step: 0.01 });

const section = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Section: (none)', align: 'left' });
const peaksLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: 420, height: 24 }, text: 'Peaks: (none)', align: 'left' });

const peakThresholdMulSld = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Peak threshold mul', min: 0.5, max: 5, value: s.peakTuning.thresholdMul, step: 0.05 });
const peakMinProminenceSld = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Peak min prominence', min: 0, max: 0.2, value: s.peakTuning.minProminence, step: 0.005 });
const peakMinGapMsSld = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Peak min gap (ms)', min: 0, max: 500, value: s.peakTuning.minGapMs, step: 10 });
const peakSmoothMsSld = gui.createSlider({ bounds: { x: 0, y: 0, width: 420, height: 52 }, label: 'Peak smooth (ms)', min: 0, max: 500, value: s.peakTuning.smoothMs, step: 10 });
const btnReanalyze = gui.createButton({ bounds: { x: 0, y: 0, width: 420, height: 44 }, label: 'Reanalyze Peaks' });

panel
  .add(title)
  .add(hint)
  .add(file)
  .add(status)
  .add(btnPlay)
  .add(btnPause)
  .add(time)
  .add(seek)
  .add(section)
  .add(peaksLbl)
  .add(peakThresholdMulSld)
  .add(peakMinProminenceSld)
  .add(peakMinGapMsSld)
  .add(peakSmoothMsSld)
  .add(btnReanalyze);

panel.layout();

s.panel = panel;
s.widgets = {
  title,
  hint,
  file,
  status,
  btnPlay,
  btnPause,
  time,
  seek,
  section,
  peaksLbl,
  peakThresholdMulSld,
  peakMinProminenceSld,
  peakMinGapMsSld,
  peakSmoothMsSld,
  btnReanalyze
};

s.gain = audio.createGain();
s.gain.gain.value = 1;
s.gain.connect(audio.destination);

// Optional: enable 3D early if available
if (worlds?.available) {
  worlds.enable();
  worlds.controls.setEnabled(false);
  worlds.camera.setFOV?.(60);
}

focusSection(0);
audio.context.resume().catch(() => {});
```

```js on:drop
const s = st();
stopSource({ keepOffset: false });

s.audioBuffer = null;
s.peaks = [];
s.peakIndex = 0;
s.pauseOffset = 0;

s.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
s.widgets.time.setText('Time: --:-- / --:--');
s.widgets.peaksLbl.setText('Peaks: analyzing...');
setStatus('Status: decoding...');

void (async () => {
  try {
    await audio.context.resume().catch(() => {});

    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);

    const buf = await audio.context.decodeAudioData(ab);
    s.audioBuffer = buf;

    setStatus(`Status: analyzing peaks... (${fmtTime(buf.duration)})`);

    // Detection tuned for "event triggers" (not strict BPM beats).
    const result = audio.peaksFromBuffer(buf, peakOptionsFromUI());

    s.peaks = result.peaks;
    s.peakIndex = 0;
    s.lyricCursor = 0;

    // Sync UI/section state to start.
    if (s.widgets?.seek) {
      s.widgets.seek.max = buf.duration;
      s.widgets.seek.setValue(0);
    }

    const list = computeLyricSectionIndices();
    if (list.length > 0) focusSection(list[0]);

    s.widgets.peaksLbl.setText(`Peaks: ${result.peaks.length}  (threshold ${result.threshold.toFixed(3)})`);
    s.widgets.time.setText(`Time: 0:00 / ${fmtTime(buf.duration)}`);
    setStatus('Status: ready');
  } catch (e) {
    console.warn('[drop] decode/analyze failed:', e);
    setStatus('Status: decode/analyze failed');
    s.widgets.peaksLbl.setText('Peaks: (failed)');
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

// Keep panel pinned top-right (above animated content)
if (s.panel) {
  const margin = 20;
  const w = 420;
  const h = 520;
  const x = Math.max(margin, getScreenW() - w - margin);
  const y = margin;
  s.panel.setBounds({ x, y, width: w, height: h }, true);
}

gui.update(getMouseX(), getMouseY(), s.mouseDownLeft);

// Update tuning from runtime sliders
if (s.widgets.peakThresholdMulSld) s.peakTuning.thresholdMul = s.widgets.peakThresholdMulSld.getValue();
if (s.widgets.peakMinProminenceSld) s.peakTuning.minProminence = s.widgets.peakMinProminenceSld.getValue();
if (s.widgets.peakMinGapMsSld) s.peakTuning.minGapMs = s.widgets.peakMinGapMsSld.getValue();
if (s.widgets.peakSmoothMsSld) s.peakTuning.smoothMs = s.widgets.peakSmoothMsSld.getValue();

if (s.widgets.btnPlay.wasClicked()) {
  if (!s.audioBuffer) {
    setStatus('Status: drop an .mp3 first');
  } else {
    audio.context.resume().catch(() => {});
    playFrom(s.pauseOffset);
  }
}

if (s.widgets.btnPause.wasClicked()) {
  stopSource({ keepOffset: true });
}

if (s.widgets.btnReanalyze?.wasClicked()) {
  if (!s.audioBuffer) {
    setStatus('Status: drop an .mp3 first');
  } else {
    setStatus('Status: analyzing peaks...');
    const pos = getPosSec();
    const result = audio.peaksFromBuffer(s.audioBuffer, peakOptionsFromUI());
    s.peaks = result.peaks;
    s.widgets.peaksLbl.setText(`Peaks: ${result.peaks.length}  (threshold ${result.threshold.toFixed(3)})`);
    syncPeaksAndSectionToPos(pos);
    setStatus('Status: ready');
  }
}

// Seek slider: keep in sync with playback and with peak/section cursor.
const isSeeking = s.widgets.seek?.isDragging?.() ?? false;
if (s.audioBuffer && s.widgets.seek) {
  s.widgets.seek.max = s.audioBuffer.duration;
  const released = s.wasSeeking && !isSeeking;
  if (released) {
    const newPos = s.widgets.seek.getValue();
    if (s.isPlaying) playFrom(newPos);
    else s.pauseOffset = clamp(newPos, 0, s.audioBuffer.duration);
    syncPeaksAndSectionToPos(newPos);
  }

  // Keep slider synced during playback (unless user is dragging, or just released)
  if (!isSeeking && !released) {
    s.widgets.seek.setValue(getPosSec());
  }
}
s.wasSeeking = isSeeking;

if (s.audioBuffer) {
  const pos = isSeeking && s.widgets.seek ? s.widgets.seek.getValue() : getPosSec();
  s.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(s.audioBuffer.duration)}`);

  // Trigger: advance section on peaks (disabled while scrubbing)
  if (!isSeeking) {
    while (s.peakIndex < s.peaks.length && pos >= s.peaks[s.peakIndex]) {
      s.peakIndex++;

      const list = s.lyricSectionIndices && s.lyricSectionIndices.length > 0
        ? s.lyricSectionIndices
        : computeLyricSectionIndices();

      if (list.length > 0) {
        s.lyricCursor = (s.lyricCursor + 1) % list.length;
        focusSection(list[s.lyricCursor]);
      }
    }
  }
}
```

```js on:render
// Let the engine render markdown sections and Worlds normally.
// Clearing here can wipe section text / 3D output depending on render order.
```
