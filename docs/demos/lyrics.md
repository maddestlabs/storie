---
name: "Timed Lyrics Demo"
theme: "neonopia"
dropTarget: true
---

Demonstrates both lyric sync layers:

- **Line layer** — `doc.atTime('lyrics', audio.currentTime)` reads millisecond-stamped lines from the `timed` block below.
- **Section layer** — heading directives `{"timed": "Xms"}` advance the active section automatically when the playhead passes each timestamp.

Drop an `.mp3` to replace the built-in placeholder content.  If the file carries a `TXXX:STORIE` tag (written by the Metadata Editor demo), those lyrics are loaded instead.  If it carries a standard `USLT` lyrics tag, that plain text is split into lines and used.

# Intro {"timed": "0ms"}
Welcome to the timed lyrics demo.
Drop an MP3 to load real content.

# Verse 1 {"timed": "4000ms"}
First verse begins here.
Words appear line by line as the track plays.
Each section advances when its timestamp is reached.

# Chorus {"timed": "12000ms"}
This is the chorus.
It arrives at twelve seconds.
Line-level and section-level sync run independently.

# Verse 2 {"timed": "20000ms"}
Back to the second verse now.
Timestamps in headings drive section focus.
Timestamps in the timed block drive individual lines.

# Outro {"timed": "28000ms"}
Fading out.
That's a wrap.

```timed name:lyrics
# Lines map to audio positions in milliseconds.
# Format: ms|text
# Lines starting with # and blank lines are ignored.
# Entries do not need to be in order — they are sorted on load.
0|♪  ·  ·  ·
1000|Welcome to the timed lyrics demo.
2000|Drop an MP3 to load real content.
4000|First verse begins here.
6000|Words appear line by line as the track plays.
8000|Each section advances when its timestamp is reached.
10000|Approaching the chorus…
12000|This is the chorus.
14000|It arrives at twelve seconds.
16000|Line-level and section-level sync run independently.
20000|Back to the second verse now.
22000|Timestamps in headings drive section focus.
24000|Timestamps in the timed block drive individual lines.
28000|Fading out.
30000|That's a wrap.
```

## Game Code

```javascript on:init
worlds.enable();
console.log('✓ 3D Canvas enabled!');
worlds.config.setDefaults({
  defaultSectionWidth: 100,        // Default width
  defaultSectionHeight: 24,       // Default height
  autoLayoutSpacing: 150,         // Spacing between auto-laid-out sections (world units)
  sectionBorderEnabled: false,     // Draw a border around each section card
  sectionBackground: 'bg',   // Section card background: 'surface' | 'bg' | 'bgAlt' | 'accent1' | '#RRGGBB' | 0xRRGGBBAA
});
worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 10, 0.5);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSection(0, 50);
```

```js
// ── State ─────────────────────────────────────────────────────────────────────
var state = {
  audioBuffer:    null,
  source:         null,
  gain:           null,
  isPlaying:      false,
  startTime:      0,
  pauseOffset:    0,
  wasSeeking:     false,

  // Active lyric line and section title (updated each frame)
  currentLine:    '',
  currentSection: '',

  // Ordered list of {timedMs, title, index} built from heading directives
  timedSections:  [],

  // Whether lyric content came from dropped file metadata (vs. built-in timed block)
  fromMeta:       false,
  // Flat {ms, text}[] entries — points at doc timed block OR metadata-derived entries.
  // null = use doc.atTime() directly (built-in block).
  externalEntries: null,

  panel:         null,
  widgets:       null,
  mouseDownLeft: false
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Playback ───────────────────────────────────────────────────────────────────
function stopAudio({ keepOffset } = { keepOffset: true }) {
  if (!state.source) return;
  try {
    if (keepOffset) {
      state.pauseOffset = clamp(audio.currentTime - state.startTime, 0, state.audioBuffer?.duration ?? 0);
    } else {
      state.pauseOffset = 0;
    }
    state.source.onended = null;
    state.source.stop();
  } catch { /* ignore */ }
  try { state.source.disconnect(); } catch { /* ignore */ }
  state.source    = null;
  state.isPlaying = false;
}

function playFrom(off) {
  if (!state.audioBuffer) return;
  stopAudio({ keepOffset: false });
  const offset = clamp(off, 0, state.audioBuffer.duration);
  state.pauseOffset = offset;
  const src = audio.createBufferSource();
  src.buffer = state.audioBuffer;
  src.connect(state.gain);
  state.startTime = audio.currentTime - offset;
  state.isPlaying = true;
  src.onended = () => {
    if (state.source === src) {
      state.source = null;
      state.isPlaying = false;
      state.pauseOffset = clamp(audio.currentTime - state.startTime, 0, state.audioBuffer.duration);
    }
  };
  state.source = src;
  src.start(0, offset);
}

function getPosSec() {
  if (!state.audioBuffer) return 0;
  if (!state.isPlaying) return clamp(state.pauseOffset, 0, state.audioBuffer.duration);
  return clamp(audio.currentTime - state.startTime, 0, state.audioBuffer.duration);
}

// ── Timed section index ────────────────────────────────────────────────────────
// Build an ascending list of sections that have heading directives with timed values.
function buildTimedSections() {
  const all = doc.sectionsFlat();
  state.timedSections = all
    .filter(s => s.timedMs !== undefined)
    .sort((a, b) => a.timedMs - b.timedMs);
}

// Returns the section that should be active at posMs milliseconds.
function sectionAtMs(posMs) {
  const list = state.timedSections;
  if (!list.length) return null;
  let result = null;
  for (const s of list) {
    if (s.timedMs <= posMs) result = s;
    else break;
  }
  return result;
}

// ── Lyric line lookup ─────────────────────────────────────────────────────────
// Returns the current lyric line text for a given audio.currentTime.
function lineAtTime(timeSec) {
  if (state.externalEntries) {
    // Linear/binary search in metadata-derived entries.
    const nowMs = timeSec * 1000;
    let result = null;
    for (const e of state.externalEntries) {
      if (e.ms <= nowMs) result = e;
      else break;
    }
    return result ? result.text : '';
  }
  // Use built-in doc timed block via the engine API.
  const entry = doc.atTime('lyrics', timeSec);
  return entry ? entry.text : '';
}

// ── ID3v2 metadata reader (same as audio-lyrics.md / metadata editor) ─────────
function _textDecode(enc, data) {
  try {
    if (enc === 0x01 || enc === 0x02) return new TextDecoder('utf-16').decode(data).replace(/\0/g, '');
    if (enc === 0x03) return new TextDecoder('utf-8').decode(data).replace(/\0/g, '');
    return new TextDecoder('latin1').decode(data).replace(/\0/g, '');
  } catch { return ''; }
}

function _nullPos(data, enc) {
  if (enc === 0x01 || enc === 0x02) {
    for (let i = 0; i + 1 < data.length; i += 2) if (data[i] === 0 && data[i + 1] === 0) return i;
    return -1;
  }
  return data.indexOf(0);
}

function parseAudioMeta(bytes) {
  const out = { storieMd: null, lyrics: null };
  if (!bytes || bytes.length < 10) return out;
  if (!(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) return out;
  const ver     = bytes[3];
  if (ver < 2 || ver > 4) return out;
  const tagSize = ((bytes[6] & 0x7F) << 21) | ((bytes[7] & 0x7F) << 14) | ((bytes[8] & 0x7F) << 7) | (bytes[9] & 0x7F);
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
    if (ver !== 2) pos += 2;
    if (fsz <= 0 || pos + fsz > tagEnd) break;
    const fd  = bytes.subarray(pos, pos + fsz);
    pos += fsz;
    const enc = fd[0];
    if ((fid === 'USLT' || fid === 'ULT') && fd.length > 4 && !out.lyrics) {
      const afterLang = fd.subarray(4);
      const np = _nullPos(afterLang, enc);
      if (np >= 0) {
        const skip = np + (enc === 0x01 || enc === 0x02 ? 2 : 1);
        const val  = new Uint8Array(1 + (afterLang.length - skip));
        val[0] = enc; val.set(afterLang.subarray(skip), 1);
        out.lyrics = _textDecode(val[0], val.subarray(1)).trim();
      }
    } else if ((fid === 'TXXX' || fid === 'TXX') && fd.length > 1) {
      const rest = fd.subarray(1);
      const np   = _nullPos(rest, enc);
      if (np >= 0) {
        const descBytes = new Uint8Array(1 + np); descBytes[0] = enc; descBytes.set(rest.subarray(0, np), 1);
        const skip      = np + (enc === 0x01 || enc === 0x02 ? 2 : 1);
        const valBytes  = new Uint8Array(1 + (rest.length - skip)); valBytes[0] = enc; valBytes.set(rest.subarray(skip), 1);
        const desc = _textDecode(enc, new Uint8Array(descBytes.buffer, 1)).toUpperCase().trim();
        if ((desc === 'STORIE' || desc === 'STORIE_MD' || desc === 'STORIE-LYRICS') && !out.storieMd)
          out.storieMd = _textDecode(valBytes[0], valBytes.subarray(1));
      }
    }
  }
  return out;
}

// Convert raw Storie markdown (# headings + body) or plain-text lyrics into
// a sorted {ms, text}[] array usable by lineAtTime().
function metaToEntries(text) {
  if (!text || !text.trim()) return null;
  const lines = text.split(/\r?\n/);
  // Detect timed block format embedded in TXXX:STORIE (ms|text lines)
  const timedLines = lines.filter(l => /^\d/.test(l.trim()) && l.includes('|'));
  if (timedLines.length > 0) {
    const entries = [];
    for (const l of timedLines) {
      const sep  = l.indexOf('|');
      const ms   = parseFloat(l.slice(0, sep).trim());
      const text = l.slice(sep + 1);
      if (Number.isFinite(ms) && ms >= 0) entries.push({ ms, text });
    }
    entries.sort((a, b) => a.ms - b.ms);
    return entries.length ? entries : null;
  }
  // Plain text — number the lines, spacing them 3 seconds apart as a rough placeholder.
  const textLines = lines.filter(l => l.trim() && !l.startsWith('#'));
  if (!textLines.length) return null;
  return textLines.map((text, i) => ({ ms: i * 3000, text }));
}

function setStatus(t) { if (state.widgets?.status) state.widgets.status.setText(t); }
```

```js on:init
term.layerID = 'default';
gui.init();

buildTimedSections();

const PW = 500;

const panel = gui.createContainer({ bounds: { x: 0, y: 0, width: PW, height: 600 }, padding: 14, gap: 8, alignX: 'stretch' });

const heading  = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:28 }, text: 'Timed Lyrics Demo', align: 'left' });
const fileInfo = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:20 }, text: 'File: (none) — using built-in placeholder', align: 'left' });
const status   = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:20 }, text: 'Drop an .mp3 to load real content.', align: 'left' });

const section  = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:26 }, text: 'Section: Intro', align: 'left' });
const lyricLine = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:26 }, text: '', align: 'left' });

const time = gui.createLabel({ bounds: { x:0,y:0,width:PW,height:20 }, text: 'Time: --:-- / --:--', align: 'left' });
const seek = gui.createSlider({ bounds: { x:0,y:0,width:PW,height:48 }, label: 'Seek', min: 0, max: 30, value: 0, step: 0.1 });

const btnPlay  = gui.createButton({ bounds: { x:0,y:0,width:PW,height:40 }, label: '▶  Play' });
const btnPause = gui.createButton({ bounds: { x:0,y:0,width:PW,height:40 }, label: '⏸  Pause' });

panel
  .add(heading)
  .add(fileInfo)
  .add(status)
  .add(section)
  .add(lyricLine)
  .add(time)
  .add(seek)
  .add(btnPlay)
  .add(btnPause);

panel.layout();

state.panel   = panel;
state.widgets = { heading, fileInfo, status, section, lyricLine, time, seek, btnPlay, btnPause };

state.gain = audio.createGain();
state.gain.gain.value = 1;
state.gain.connect(audio.destination);
```

```js on:drop
stopAudio({ keepOffset: false });
state.audioBuffer    = null;
state.pauseOffset    = 0;
state.externalEntries = null;
state.fromMeta       = false;

const fileName = file.name || 'audio.mp3';
state.widgets.fileInfo.setText(`File: ${fileName}  (${(file.size / (1024*1024)).toFixed(2)} MB)`);
setStatus('Loading…');

// ── 1. Try to get lyrics from embedded metadata ────────────────────────────
const meta = parseAudioMeta(file.bytes);
if (meta.storieMd || meta.lyrics) {
  const entries = metaToEntries(meta.storieMd || meta.lyrics);
  if (entries && entries.length) {
    state.externalEntries = entries;
    state.fromMeta = true;
    const src = meta.storieMd ? 'TXXX:STORIE' : 'USLT';
    setStatus(`Loaded ${entries.length} lyric lines from ${src} tag.`);
  }
}
if (!state.fromMeta) {
  // ── 2. Fall back to built-in timed block ──────────────────────────────────
  setStatus('No lyric metadata found — using built-in timed block.');
}

// ── 3. Decode audio ────────────────────────────────────────────────────────
void (async () => {
  try {
    await audio.context.resume().catch(() => {});
    const ab = new ArrayBuffer(file.bytes.byteLength);
    new Uint8Array(ab).set(file.bytes);
    state.audioBuffer = await audio.context.decodeAudioData(ab);
    state.widgets.seek.max  = state.audioBuffer.duration;
    state.widgets.seek.setValue(0);
    state.widgets.time.setText(`Time: 0:00 / ${fmtTime(state.audioBuffer.duration)}`);
    setStatus(state.fromMeta
      ? `Ready — ${state.externalEntries.length} lines from metadata.`
      : `Ready — using built-in timed block (${doc.timedBlock('lyrics').length} lines).`);
  } catch (e) {
    console.warn('[lyrics] decode failed:', e);
    setStatus('Audio decode failed.');
  }
})();
```

```js on:input
if (!event) return;
if (event.type === 'keydown') gui.handleKey(event.key, { shift: (event.mods||[]).includes('shift'), ctrl: (event.mods||[]).includes('ctrl'), alt: (event.mods||[]).includes('alt') });
if (event.type === 'text')       gui.handleText(event.text);
if (event.type === 'mouse') {
  if (event.button === 'left') state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
if (event.type === 'mouse_move') gui.handleMouse(event.x, event.y, state.mouseDownLeft);
```

```js on:update
if (!state.widgets) return;

// Pin panel top-left
if (state.panel) {
  const m = 20;
  state.panel.setBounds({ x: m, y: m, width: 500, height: 600 }, true);
}

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.btnPlay.wasClicked()) {
  audio.context.resume().catch(() => {});
  if (state.audioBuffer) playFrom(state.pauseOffset);
  else setStatus('Drop an .mp3 file first.');
}
if (state.widgets.btnPause.wasClicked()) stopAudio({ keepOffset: true });

// Seek widget
const dragging = state.widgets.seek.isDragging?.() ?? false;
if (state.audioBuffer) {
  if (!dragging && state.wasSeeking) {
    const target = clamp(state.widgets.seek.getValue(), 0, state.audioBuffer.duration);
    state.pauseOffset = target;
    if (state.isPlaying) playFrom(target);
  }
  if (!dragging) state.widgets.seek.setValue(getPosSec());
}
state.wasSeeking = dragging;

if (state.audioBuffer) {
  const pos = getPosSec();
  state.widgets.time.setText(`Time: ${fmtTime(pos)} / ${fmtTime(state.audioBuffer.duration)}`);

  // ── Line-level sync: doc.atTime() or external entries ───────────────────
  const newLine = lineAtTime(pos);
  if (newLine !== state.currentLine) {
    state.currentLine = newLine;
    state.widgets.lyricLine.setText(newLine);
  }

  // ── Section-level sync: heading directive timedMs ───────────────────────
  const sec = sectionAtMs(pos * 1000);
  const secTitle = sec ? sec.title : '';
  if (secTitle !== state.currentSection) {
    state.currentSection = secTitle;
    state.widgets.section.setText(`Section: ${secTitle}`);
  }
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();
```
