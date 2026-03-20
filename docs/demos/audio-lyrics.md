---
name: "Audio Beats → Lyric Sections (Drop MP3)"
theme: "neotopia"
dropTarget: true
shaders: "handcam+scanlines+lightvignette"

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
var state = {
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

  // Lyric sections sourced from dropped file's audio metadata (overrides doc sections when set).
  // Each entry: { title: string, body: string }
  externalSections: null,

  startOnExport: false,
  exportAutoStarted: false,
  wasExporting: false,

  statusText: 'Status: waiting for drop'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function getPosSec() {
  if (!state.audioBuffer) return 0;
  // During export the engine drives time; use getTime() for frame-accurate sync.
  const exporting = (typeof getIsExporting === 'function')
    ? !!getIsExporting()
    : (typeof isExporting === 'boolean' && isExporting);
  if (exporting && typeof getTime === 'function') {
    // Export defaults to starting at 0 regardless of the live play/seek state.
    return clamp(getTime(), 0, state.audioBuffer.duration);
  }
  if (!state.isPlaying) return clamp(state.pauseOffset, 0, state.audioBuffer.duration);
  return clamp(audio.currentTime - state.startTime, 0, state.audioBuffer.duration);
}

function stopSource({ keepOffset } = { keepOffset: true }) {
  if (!state.source) return;
  try {
    if (keepOffset) {
      const pos = audio.currentTime - state.startTime;
      state.pauseOffset = clamp(pos, 0, state.audioBuffer?.duration ?? pos);
    } else {
      state.pauseOffset = 0;
    }
    state.source.onended = null;
    state.source.stop();
  } catch {
    // ignore
  }
  try { state.source.disconnect(); } catch { /* ignore */ }
  state.source = null;
  state.isPlaying = false;
}

function playFrom(offsetSec) {
  if (!state.audioBuffer) return;

  stopSource({ keepOffset: false });

  const offset = clamp(offsetSec, 0, state.audioBuffer.duration);
  state.pauseOffset = offset;

  const src = audio.createBufferSource();
  src.buffer = state.audioBuffer;
  src.connect(state.gain ?? audio.destination);

  state.startTime = audio.currentTime - offset;
  state.isPlaying = true;

  src.onended = () => {
    if (state.source === src) {
      state.source = null;
      state.isPlaying = false;
      const pos = audio.currentTime - state.startTime;
      if (state.audioBuffer) state.pauseOffset = clamp(pos, 0, state.audioBuffer.duration);
    }
  };

  state.source = src;
  src.start(0, offset);
}

function setStatus(t) {
  state.statusText = t;
  if (state.widgets?.status) state.widgets.status.setText(t);
}

function computeLyricSectionIndices() {
  // External sections (from audio metadata) take priority over doc sections.
  if (state.externalSections && state.externalSections.length > 0) {
    const indices = state.externalSections.map(s => s.title);
    state.lyricSectionIndices = indices;
    state.lyricCursor = 0;
    return indices;
  }

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

  state.lyricSectionIndices = indices;
  state.lyricCursor = 0;
  return indices;
}

function focusSection(targetTitle) {
  // Only drive Worlds camera when using doc-native sections (not external lyrics).
  if (!state.externalSections && worlds?.available) {
    worlds.enable();
    worlds.controls.setEnabled(false);
    worlds.camera.focusOnSection(targetTitle, 60);
  }

  if (state.widgets?.section) state.widgets.section.setText(`Section: ${String(targetTitle)}`);

  // When using metadata-sourced lyrics, show the body text for this section.
  if (state.externalSections && state.widgets?.lyricBody) {
    const sec = state.externalSections.find(s => s.title === targetTitle);
    state.widgets.lyricBody.setText(sec ? sec.body : '');
  }
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
  const list = (state.lyricSectionIndices && state.lyricSectionIndices.length > 0)
    ? state.lyricSectionIndices
    : computeLyricSectionIndices();
  if (!state.analysis || list.length === 0) return;

  // Choose a section based on which downbeat we're currently in.
  const db = state.analysis.downbeats ?? [];
  const downbeatIndex = lowerBound(db, posSec);
  state.lyricCursor = downbeatIndex % list.length;
  focusSection(list[state.lyricCursor]);
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

// ─── Audio metadata helpers ────────────────────────────────────────────────
// Extracts:
//   result.storieMd  – full Storie markdown from a TXXX frame with description
//                      "STORIE", "STORIE_MD", or "STORIE-LYRICS" (ID3v2 MP3)
//   result.lyrics    – plain-text lyrics from USLT (ID3v2 MP3) or ILYC (WAV)
// No external libraries needed – parses raw bytes directly.
function parseAudioMeta(bytes) {
  const result = { storieMd: null, lyrics: null };
  if (!bytes || bytes.length < 12) return result;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) _parseID3v2(bytes, result);  // 'ID3'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) _parseRIFFWav(bytes, result); // 'RIFF'
  return result;
}

function _id3TextDecode(data) {
  if (!data || data.length === 0) return '';
  const enc = data[0], payload = data.subarray(1);
  try {
    if (enc === 0x01 || enc === 0x02) return new TextDecoder('utf-16').decode(payload).replace(/\0/g, '');
    if (enc === 0x03) return new TextDecoder('utf-8').decode(payload).replace(/\0/g, '');
    return new TextDecoder('latin1').decode(payload).replace(/\0/g, '');
  } catch { return ''; }
}

function _id3NullPos(data, enc) {
  if (enc === 0x01 || enc === 0x02) {
    for (let i = 0; i + 1 < data.length; i += 2) { if (data[i] === 0 && data[i + 1] === 0) return i; }
    return -1;
  }
  return data.indexOf(0);
}

function _parseID3v2(bytes, result) {
  if (bytes.length < 10) return;
  const ver = bytes[3];
  if (ver < 2 || ver > 4) return;
  const tagSize = ((bytes[6]&0x7F)<<21)|((bytes[7]&0x7F)<<14)|((bytes[8]&0x7F)<<7)|(bytes[9]&0x7F);
  const tagEnd  = Math.min(10 + tagSize, bytes.length);
  const idLen   = ver === 2 ? 3 : 4;
  const szLen   = ver === 2 ? 3 : 4;
  let pos = 10;
  if ((bytes[5] & 0x40) && pos + 4 <= tagEnd) {
    const extSz = ver === 4
      ? ((bytes[pos]&0x7F)<<21)|((bytes[pos+1]&0x7F)<<14)|((bytes[pos+2]&0x7F)<<7)|(bytes[pos+3]&0x7F)
      : (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3];
    pos += extSz;
  }
  while (pos + idLen + szLen < tagEnd) {
    if (bytes[pos] === 0) break;
    const fid = String.fromCharCode(...bytes.subarray(pos, pos + idLen));
    pos += idLen;
    let fsz;
    if (ver === 2)      fsz = (bytes[pos]<<16)|(bytes[pos+1]<<8)|bytes[pos+2];
    else if (ver === 4) fsz = ((bytes[pos]&0x7F)<<21)|((bytes[pos+1]&0x7F)<<14)|((bytes[pos+2]&0x7F)<<7)|(bytes[pos+3]&0x7F);
    else                fsz = (bytes[pos]<<24)|(bytes[pos+1]<<16)|(bytes[pos+2]<<8)|bytes[pos+3];
    pos += szLen;
    if (ver !== 2) pos += 2; // frame flags
    if (fsz <= 0 || pos + fsz > tagEnd) break;
    const fd = bytes.subarray(pos, pos + fsz);
    pos += fsz;
    if ((fid === 'TXXX' || fid === 'TXX') && fd.length > 1) {
      const enc = fd[0], rest = fd.subarray(1);
      const np = _id3NullPos(rest, enc);
      if (np >= 0) {
        const descBytes = new Uint8Array(1 + np); descBytes[0] = enc; descBytes.set(rest.subarray(0, np), 1);
        const skip = np + (enc === 0x01 || enc === 0x02 ? 2 : 1);
        const valBytes = new Uint8Array(1 + (rest.length - skip)); valBytes[0] = enc; valBytes.set(rest.subarray(skip), 1);
        const desc = _id3TextDecode(descBytes).toUpperCase().trim();
        if (desc === 'STORIE' || desc === 'STORIE_MD' || desc === 'STORIE-LYRICS')
          result.storieMd = _id3TextDecode(valBytes);
      }
    } else if ((fid === 'USLT' || fid === 'ULT') && fd.length > 4 && !result.lyrics) {
      // encoding(1) + language(3) + content-desc(null-terminated) + lyrics text
      const enc = fd[0], afterLang = fd.subarray(4);
      const np = _id3NullPos(afterLang, enc);
      if (np >= 0) {
        const skip = np + (enc === 0x01 || enc === 0x02 ? 2 : 1);
        const valBytes = new Uint8Array(1 + (afterLang.length - skip)); valBytes[0] = enc; valBytes.set(afterLang.subarray(skip), 1);
        result.lyrics = _id3TextDecode(valBytes).trim();
      }
    }
  }
}

function _parseRIFFWav(bytes, result) {
  if (bytes.length < 12) return;
  if (!(bytes[8]===0x57&&bytes[9]===0x41&&bytes[10]===0x56&&bytes[11]===0x45)) return; // not WAVE
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const cid  = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
    const csz  = view.getUint32(pos + 4, true);
    pos += 8;
    if (cid === 'LIST' && pos + 4 <= bytes.length) {
      const ltype = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      if (ltype === 'INFO') {
        const end = pos + csz, td = new TextDecoder('latin1', { fatal: false });
        let ip = pos + 4;
        while (ip + 8 <= end && ip + 8 <= bytes.length) {
          const sub  = String.fromCharCode(bytes[ip],bytes[ip+1],bytes[ip+2],bytes[ip+3]);
          const ssz  = view.getUint32(ip + 4, true);
          ip += 8;
          const text = td.decode(bytes.subarray(ip, ip + ssz)).replace(/\0/g,'').trim();
          if (sub === 'ILYC' && !result.lyrics) result.lyrics = text;
          ip += ssz + (ssz % 2);
        }
      }
    }
    pos += csz + (csz % 2);
  }
}

// Convert Storie markdown (# headings) or plain lyrics text into
// an array of { title, body } sections for belt-synced display.
function lyricsToSections(text) {
  if (!text || !text.trim()) return [];
  const lines = text.split(/\r?\n/);
  if (lines.some(l => /^#{1,6}\s/.test(l))) {
    const sections = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(/^(#{1,6})\s+(.*)/);
      if (m) { if (cur) sections.push(cur); cur = { title: m[2].trim(), body: '' }; }
      else if (cur) { cur.body += (cur.body ? '\n' : '') + line; }
    }
    if (cur) sections.push(cur);
    return sections.map(s => ({ ...s, body: s.body.trim() }));
  }
  // Plain text: split by blank lines into stanzas
  return text.split(/\n\s*\n/).map((b, i) => ({ title: `Stanza ${i + 1}`, body: b.trim() })).filter(s => s.body);
}
```

```js on:init
term.layerID = 'default';

computeLyricSectionIndices();

gui.init();
const tokens = gui.getTokens();

const panel = gui.createResponsivePanel({
  bounds: { x: 0, y: 0, width: 420, height: 1 },
  padding: tokens.spacing.md,
  gap: tokens.spacing.sm,
  maxWidth: 420,
  alignX: 'stretch',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content' }
});

const title = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 30 }, text: 'Audio Beats → Lyric Sections', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const hint = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'Drop an .mp3. Play. Downbeats focus sections (WebGPU required).', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const file = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'File: (none)', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const status = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: state.statusText, align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const chkExportStart = gui.createCheckbox({ bounds: { x: 0, y: 0, width: 1, height: 30 }, label: 'Start on Export', checked: false, layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnPlay = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 44 }, label: 'Play', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnPause = gui.createButton({ bounds: { x: 0, y: 0, width: 1, height: 44 }, label: 'Pause', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const time = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'Time: --:-- / --:--', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const seek = gui.createSlider({ bounds: { x: 0, y: 0, width: 1, height: 52 }, label: 'Seek (sec)', min: 0, max: 1, value: 0, step: 0.01, layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const bpmLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'BPM: --', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const clockLbl = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'Bar: --  Beat: --  Phase: --', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const section   = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 24 }, text: 'Section: (none)', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const lyricBody = gui.createLabel({ bounds: { x: 0, y: 0, width: 1, height: 80 }, text: '', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

panel
  .add(title)
  .add(hint)
  .add(file)
  .add(status)
  .add(chkExportStart)
  .add(btnPlay)
  .add(btnPause)
  .add(time)
  .add(seek)
  .add(bpmLbl)
  .add(clockLbl)
  .add(section)
  .add(lyricBody);

panel.layout();

state.panel = panel;
state.widgets = { title, hint, file, status, chkExportStart, btnPlay, btnPause, time, seek, bpmLbl, clockLbl, section, lyricBody };

state.gain = audio.createGain();
state.gain.gain.value = 1;
state.gain.connect(audio.destination);

if (worlds?.available) {
  worlds.enable();
  worlds.controls.setEnabled(false);
  worlds.camera.setFOV?.(60);
}
```

```js on:drop
stopSource({ keepOffset: false });

state.audioBuffer = null;
state.analysis = null;
state.pauseOffset = 0;
state.lastPos = 0;
state.externalSections = null;
if (state.widgets?.lyricBody) state.widgets.lyricBody.setText('');

// ── 1. Extract lyric/storie metadata before the bytes are consumed ────────
const _meta = parseAudioMeta(file.bytes);
if (_meta.storieMd || _meta.lyrics) {
  state.externalSections = lyricsToSections(_meta.storieMd || _meta.lyrics);
  state.lyricSectionIndices = state.externalSections.map(s => s.title);
  state.lyricCursor = 0;
  const _src = _meta.storieMd ? 'custom TXXX:STORIE tag' : (_meta.lyrics ? 'USLT/ILYC lyrics tag' : '');
  console.log(`[audio-lyrics] loaded ${state.externalSections.length} sections from ${_src}`);
} else {
  // Recompute from document sections (clears any leftover external state)
  computeLyricSectionIndices();
}
// ─────────────────────────────────────────────────────────────────────────

state.widgets.file.setText(`File: ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`);
state.widgets.time.setText('Time: --:-- / --:--');
state.widgets.bpmLbl.setText('BPM: analyzing...');
setStatus('Status: decoding...');

void (async () => {
  try {
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);

    const buf = await audio.context.decodeAudioData(ab);
    state.audioBuffer = buf;

    setStatus('Status: analyzing beats...');
    const analysis = audio.beatsFromBuffer(buf, beatOptions());
    state.analysis = analysis;

    state.widgets.seek.max = buf.duration;
    state.widgets.seek.setValue(0);

    state.widgets.bpmLbl.setText(`BPM: ${analysis.bpm.toFixed(1)}  (conf ${analysis.confidence.toFixed(2)})  meter ${analysis.meter}/4`);
    state.widgets.time.setText(`Time: 0:00 / ${fmtTime(buf.duration)}`);

    const list = computeLyricSectionIndices();
    if (list.length > 0) focusSection(list[0]);

    setStatus('Status: ready');
  } catch (e) {
    console.warn('[drop] decode/analyze failed:', e);
    setStatus('Status: decode/analyze failed');
    state.widgets.bpmLbl.setText('BPM: (failed)');
  }
})();
```

```js on:input
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
  if (event.button === 'left') state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
```

```js on:update
if (!state.widgets) return;

if (state.panel) {
  const tokens = gui.getTokens();
  const viewport = gui.getViewportRect();
  const info = gui.getResponsiveInfo({ width: viewport.width, height: viewport.height });
  const inset = info.breakpoint === 'xs' ? tokens.spacing.sm : tokens.spacing.lg;
  const maxWidth = info.breakpoint === 'xs' ? 360 : 420;

  state.panel.container.padding = info.breakpoint === 'xs' ? tokens.spacing.sm : tokens.spacing.md;
  state.panel.container.gap = info.breakpoint === 'xs' ? tokens.spacing.xs : tokens.spacing.sm;
  state.panel.setMaxWidth(maxWidth, false);
  state.panel.fitToViewport(viewport, {
    insetTop: inset,
    insetRight: inset,
    insetBottom: inset,
    insetLeft: inset,
    safeArea: true,
    maxWidth: maxWidth,
    anchorX: 'end',
    anchorY: 'start'
  }, false);
  state.panel.layout();
}

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

// Sync "Start on Export" checkbox
if (state.widgets.chkExportStart) {
  state.startOnExport = state.widgets.chkExportStart.isChecked();
}

const exporting = (typeof getIsExporting === 'function')
  ? !!getIsExporting()
  : (typeof isExporting === 'boolean' && isExporting);
if (exporting && !state.wasExporting) {
  // Export just started: default to starting at 0.
  state.pauseOffset = 0;

  // Prefer the engine-latched export buffer (host-decoded fallback or captureForExport)
  // so export-time animation works even if on:drop decode/analysis never ran.
  if (typeof audio?.getCapturedForExport === 'function') {
    const cap = audio.getCapturedForExport();
    if (cap?.buffer) {
      if (state.audioBuffer !== cap.buffer) {
        state.audioBuffer = cap.buffer;
        state.analysis = null;
      }
    }
  }

  // Ensure we have beat analysis available for export-time animation.
  if (state.audioBuffer && !state.analysis && typeof audio?.beatsFromBuffer === 'function') {
    try {
      state.analysis = audio.beatsFromBuffer(state.audioBuffer, beatOptions());
      if (state.widgets?.bpmLbl && state.analysis) {
        state.widgets.bpmLbl.setText(
          `BPM: ${state.analysis.bpm.toFixed(1)}  (conf ${state.analysis.confidence.toFixed(2)})  meter ${state.analysis.meter}/4`
        );
      }
    } catch {
      // ignore
    }
  }

  // Snap section + prev time to the export timeline.
  syncSectionToPos(0);
  state.lastPos = 0;
}

// During video export: hand the AudioBuffer directly to the exporter.
// The export panel encodes it as an AAC audio track via AudioEncoder.
if (exporting) {
  if (state.audioBuffer && typeof audio?.captureForExport === 'function') {
    // Always export from 0 by default.
    audio.captureForExport(state.audioBuffer, 0);
  }
} else {
  // Reset so the next export captures again
  state.exportAutoStarted = false;
}

if (state.widgets.btnPlay.wasClicked()) {
  if (!state.audioBuffer) setStatus('Status: drop an .mp3 first');
  else playFrom(state.pauseOffset);
}

if (state.widgets.btnPause.wasClicked()) stopSource({ keepOffset: true });

// Seek
const isSeeking = state.widgets.seek?.isDragging?.() ?? false;
if (state.audioBuffer && state.widgets.seek) {
  state.widgets.seek.max = state.audioBuffer.duration;
  const released = state.wasSeeking && !isSeeking;
  if (released) {
    const newPos = state.widgets.seek.getValue();
    if (state.isPlaying) playFrom(newPos);
    else state.pauseOffset = clamp(newPos, 0, state.audioBuffer.duration);

    syncSectionToPos(clamp(newPos, 0, state.audioBuffer.duration));
    state.lastPos = clamp(newPos, 0, state.audioBuffer.duration);
  }
  if (!isSeeking && !released) state.widgets.seek.setValue(getPosSec());
}
state.wasSeeking = isSeeking;

if (state.audioBuffer) {
  const pos = getPosSec();
  state.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(state.audioBuffer.duration)}`);

  if (state.analysis) {
    const beat = audio.beatState(state.analysis, pos, state.lastPos);

    const bar1 = beat.barIndex + 1;
    const beat1 = beat.beatInBar;

    state.widgets.clockLbl.setText(
      `Bar: ${bar1}  Beat: ${beat1}/${beat.meter}  Phase: ${beat.beatPhase.toFixed(2)}  ${beat.isDownbeatEdge ? '[DOWN]' : beat.isBeatEdge ? '[BEAT]' : ''}`
    );

    // Advance lyric section on downbeat edges
    if (beat.isDownbeatEdge) {
      const list = (state.lyricSectionIndices && state.lyricSectionIndices.length > 0)
        ? state.lyricSectionIndices
        : computeLyricSectionIndices();

      if (list.length > 0) {
        state.lyricCursor = (state.lyricCursor + 1) % list.length;
        focusSection(list[state.lyricCursor]);
      }
    }
  }

  state.lastPos = pos;
}

state.wasExporting = exporting;
```
