---
name: "Audio Metadata Editor"
theme: "neonopia"
dropTarget: true
---

Drop an **MP3** to read and edit its embedded ID3v2 tags, then save the modified file.

Reads / writes:
- **TIT2** — title
- **TPE1** — artist
- **TCON** — genre
- **USLT** — standard lyrics (used by media players)
- **TXXX:STORIE** — full Storie markdown (used by the lyric-visualizer demo)

WAV files are read-only (RIFF INFO `ILYC` lyrics displayed but not written back).

## Game Code

```js
// ── State ─────────────────────────────────────────────────────────────────────
var state = {
  // dropped file
  rawBytes:  null,   // Uint8Array — original bytes, kept for re-mix on save
  fileName:  '',
  isMp3:     false,
  isWav:     false,

  // decoded audio (for playback only)
  audioBuffer: null,
  source:      null,
  gain:        null,
  isPlaying:   false,
  startTime:   0,
  pauseOffset: 0,

  // parsed metadata (strings, editable)
  fields: {
    title:    '',
    artist:   '',
    genre:    '',
    lyrics:   '',
    storieMd: ''
  },

  // GUI
  panel:   null,
  widgets: null,
  mouseDownLeft: false,
  statusText: 'Drop an .mp3 file to begin'
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ── Playback helpers ──────────────────────────────────────────────────────────
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
  state.source = null;
  state.isPlaying = false;
}

function playFrom(off) {
  if (!state.audioBuffer) return;
  stopAudio({ keepOffset: false });
  state.gain = state.gain ?? (() => {
    const g = audio.createGain(); g.gain.value = 1; g.connect(audio.destination); return g;
  })();
  const offset = clamp(off, 0, state.audioBuffer.duration);
  state.pauseOffset = offset;
  const src = audio.createBufferSource();
  src.buffer = state.audioBuffer;
  src.connect(state.gain);
  state.startTime = audio.currentTime - offset;
  state.isPlaying = true;
  src.onended = () => {
    if (state.source === src) { state.source = null; state.isPlaying = false; }
  };
  state.source = src;
  src.start(0, offset);
}

function setStatus(t) {
  state.statusText = t;
  if (state.widgets?.status) state.widgets.status.setText(t);
}

// ── ID3v2 reader (ID3v2.2 / 2.3 / 2.4) ───────────────────────────────────────
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

function readID3v2(bytes) {
  const out = { title: '', artist: '', genre: '', lyrics: '', storieMd: '' };
  if (!bytes || bytes.length < 10) return out;
  if (!(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) return out;
  const ver    = bytes[3];
  if (ver < 2 || ver > 4) return out;
  const tagSize = ((bytes[6]&0x7F)<<21)|((bytes[7]&0x7F)<<14)|((bytes[8]&0x7F)<<7)|(bytes[9]&0x7F);
  const tagEnd  = Math.min(10 + tagSize, bytes.length);
  const idLen   = ver === 2 ? 3 : 4;
  const szLen   = ver === 2 ? 3 : 4;
  let pos = 10;
  // Skip optional extended header
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
    const enc = fd[0];
    if ((fid === 'TIT2' || fid === 'TT2') && !out.title)
      out.title  = _textDecode(enc, fd.subarray(1));
    else if ((fid === 'TPE1' || fid === 'TP1') && !out.artist)
      out.artist = _textDecode(enc, fd.subarray(1));
    else if ((fid === 'TCON' || fid === 'TCO') && !out.genre)
      out.genre  = _textDecode(enc, fd.subarray(1));
    else if ((fid === 'USLT' || fid === 'ULT') && fd.length > 4 && !out.lyrics) {
      const afterLang = fd.subarray(4);
      const np = _nullPos(afterLang, enc);
      if (np >= 0) {
        const skip = np + (enc === 0x01 || enc === 0x02 ? 2 : 1);
        const valBytes = new Uint8Array(1 + (afterLang.length - skip));
        valBytes[0] = enc; valBytes.set(afterLang.subarray(skip), 1);
        out.lyrics = _textDecode(valBytes[0], valBytes.subarray(1)).trim();
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

function readRIFFLyrics(bytes) {
  const out = { lyrics: '' };
  if (!bytes || bytes.length < 12) return out;
  if (!(bytes[8]===0x57&&bytes[9]===0x41&&bytes[10]===0x56&&bytes[11]===0x45)) return out;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const cid = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
    const csz = view.getUint32(pos + 4, true);
    pos += 8;
    if (cid === 'LIST' && pos + 4 <= bytes.length) {
      const lt = String.fromCharCode(bytes[pos],bytes[pos+1],bytes[pos+2],bytes[pos+3]);
      if (lt === 'INFO') {
        const end = pos + csz, td = new TextDecoder('latin1', { fatal: false });
        let ip = pos + 4;
        while (ip + 8 <= end && ip + 8 <= bytes.length) {
          const sub = String.fromCharCode(bytes[ip],bytes[ip+1],bytes[ip+2],bytes[ip+3]);
          const ssz = view.getUint32(ip + 4, true);
          ip += 8;
          if (sub === 'ILYC' && !out.lyrics)
            out.lyrics = td.decode(bytes.subarray(ip, ip + ssz)).replace(/\0/g,'').trim();
          ip += ssz + (ssz % 2);
        }
      }
    }
    pos += csz + (csz & 1);
  }
  return out;
}

// ── ID3v2.3 writer ────────────────────────────────────────────────────────────
function _makeFrame(id4, payload) {
  const frame = new Uint8Array(10 + payload.length);
  const id    = new TextEncoder().encode(id4.slice(0, 4).padEnd(4, '\0'));
  frame.set(id, 0);
  const sz = payload.length;
  frame[4] = (sz >> 24) & 0xFF; frame[5] = (sz >> 16) & 0xFF;
  frame[6] = (sz >>  8) & 0xFF; frame[7] =  sz        & 0xFF;
  // bytes [8,9] = frame flags, both 0x00
  frame.set(payload, 10);
  return frame;
}

function _utf8TextFrame(id4, text) {
  const tb = new TextEncoder().encode(text);
  const payload = new Uint8Array(1 + tb.length);
  payload[0] = 0x03; // UTF-8
  payload.set(tb, 1);
  return _makeFrame(id4, payload);
}

function _usltFrame(text, lang) {
  const lb  = new TextEncoder().encode((lang || 'eng').slice(0, 3).padEnd(3, ' '));
  const tb  = new TextEncoder().encode(text);
  // encoding(1) + lang(3) + content-desc ""(1 null byte) + text
  const payload = new Uint8Array(1 + 3 + 1 + tb.length);
  payload[0] = 0x03; payload.set(lb, 1); payload[4] = 0x00; payload.set(tb, 5);
  return _makeFrame('USLT', payload);
}

function _txxxFrame(desc, text) {
  const db = new TextEncoder().encode(desc);
  const tb = new TextEncoder().encode(text);
  const payload = new Uint8Array(1 + db.length + 1 + tb.length);
  let off = 0;
  payload[off++] = 0x03;
  payload.set(db, off); off += db.length;
  payload[off++] = 0x00; // null separator
  payload.set(tb, off);
  return _makeFrame('TXXX', payload);
}

function _syncsafe(n) {
  return [(n >> 21) & 0x7F, (n >> 14) & 0x7F, (n >> 7) & 0x7F, n & 0x7F];
}

function buildID3v2Tag(fields) {
  const frames = [];
  if (fields.title.trim())    frames.push(_utf8TextFrame('TIT2', fields.title));
  if (fields.artist.trim())   frames.push(_utf8TextFrame('TPE1', fields.artist));
  if (fields.genre.trim())    frames.push(_utf8TextFrame('TCON', fields.genre));
  if (fields.lyrics.trim())   frames.push(_usltFrame(fields.lyrics));
  if (fields.storieMd.trim()) frames.push(_txxxFrame('STORIE', fields.storieMd));

  const bodyLen  = frames.reduce((s, f) => s + f.length, 0);
  const tag      = new Uint8Array(10 + bodyLen);
  tag[0] = 0x49; tag[1] = 0x44; tag[2] = 0x33; // 'ID3'
  tag[3] = 0x03; tag[4] = 0x00; // v2.3.0
  tag[5] = 0x00; // no flags
  const sz = _syncsafe(bodyLen);
  tag[6] = sz[0]; tag[7] = sz[1]; tag[8] = sz[2]; tag[9] = sz[3];
  let off = 10;
  for (const f of frames) { tag.set(f, off); off += f.length; }
  return tag;
}

function audioDataOffset(bytes) {
  // Skip any existing ID3v2 tag so we never double-tag
  if (!bytes || bytes.length < 10) return 0;
  if (!(bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)) return 0;
  const tagSize = ((bytes[6]&0x7F)<<21)|((bytes[7]&0x7F)<<14)|((bytes[8]&0x7F)<<7)|(bytes[9]&0x7F);
  return 10 + tagSize;
}

function saveModifiedFile() {
  if (!state.rawBytes) { setStatus('Drop a file first'); return; }
  if (!state.isMp3)    { setStatus('WAV write not supported — use MP3'); return; }

  const fields = {};
  for (const k of ['title','artist','genre','lyrics','storieMd'])
    fields[k] = state.widgets[k] ? (state.widgets[k].getValue?.() ?? '') : (state.fields[k] ?? '');

  const newTag   = buildID3v2Tag(fields);
  const audioOff = audioDataOffset(state.rawBytes);
  const audioPart = state.rawBytes.subarray(audioOff);
  const result   = new Uint8Array(newTag.length + audioPart.length);
  result.set(newTag, 0);
  result.set(audioPart, newTag.length);
  sys.download(result, state.fileName || 'output.mp3', 'audio/mpeg');
  setStatus(`Saved: ${state.fileName} (${(result.length / (1024*1024)).toFixed(2)} MB)`);
}
```

```js on:init
term.layerID = 'default';
gui.init();
const tokens = gui.getTokens();

const panel = gui.createResponsivePanel({
  bounds: { x: 0, y: 0, width: 520, height: 820 },
  padding: tokens.spacing.md,
  gap: tokens.spacing.xs,
  maxWidth: 520,
  alignX: 'stretch',
  layout: { widthPolicy: 'fill', heightPolicy: 'fill' }
});

const heading  = gui.createLabel({ bounds: { x:0,y:0,width:1,height:30 }, text: 'Audio Metadata Editor', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const hint     = gui.createLabel({ bounds: { x:0,y:0,width:1,height:20 }, text: 'Drop an .mp3 to read and edit embedded tags.', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fileInfo = gui.createLabel({ bounds: { x:0,y:0,width:1,height:20 }, text: 'File: (none)', align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const status   = gui.createLabel({ bounds: { x:0,y:0,width:1,height:20 }, text: state.statusText, align: 'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

// ── Editable metadata fields ──
const lTitle   = gui.createLabel({ bounds:{x:0,y:0,width:1,height:18}, text:'Title', align:'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fTitle   = gui.createTextField({ bounds:{x:0,y:0,width:1,height:40}, value:'', placeholder:'Song title (TIT2)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const lArtist  = gui.createLabel({ bounds:{x:0,y:0,width:1,height:18}, text:'Artist', align:'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fArtist  = gui.createTextField({ bounds:{x:0,y:0,width:1,height:40}, value:'', placeholder:'Artist name (TPE1)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const lGenre   = gui.createLabel({ bounds:{x:0,y:0,width:1,height:18}, text:'Genre', align:'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fGenre   = gui.createTextField({ bounds:{x:0,y:0,width:1,height:40}, value:'', placeholder:'Genre (TCON)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const lLyrics  = gui.createLabel({ bounds:{x:0,y:0,width:1,height:18}, text:'Lyrics  (USLT — standard lyrics tag)', align:'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fLyrics  = (typeof gui.createTextEditor === 'function')
  ? gui.createTextEditor({ bounds:{x:0,y:0,width:1,height:110}, value:'', placeholder:'Paste plain-text lyrics here', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } })
  : gui.createTextField({ bounds:{x:0,y:0,width:1,height:40}, value:'', placeholder:'Lyrics (USLT)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

const lStorie  = gui.createLabel({ bounds:{x:0,y:0,width:1,height:18}, text:'Storie Markdown  (TXXX:STORIE — lyric-visualizer content)', align:'left', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const fStorie  = (typeof gui.createTextEditor === 'function')
  ? gui.createTextEditor({ bounds:{x:0,y:0,width:1,height:140}, value:'', placeholder:'# Verse 1\nLyrics here…\n\n# Chorus\nMore lyrics…', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } })
  : gui.createTextField({ bounds:{x:0,y:0,width:1,height:40}, value:'', placeholder:'Storie markdown (TXXX:STORIE)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

// ── Action buttons ────────────────────────────────────────────────────────────
const btnSave  = gui.createButton({ bounds:{x:0,y:0,width:1,height:44}, label:'💾  Save Modified File (.mp3)', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnPlay  = gui.createButton({ bounds:{x:0,y:0,width:1,height:36}, label:'▶  Play', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });
const btnPause = gui.createButton({ bounds:{x:0,y:0,width:1,height:36}, label:'⏸  Pause', layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 } });

panel
  .add(heading).add(hint).add(fileInfo).add(status)
  .add(lTitle).add(fTitle)
  .add(lArtist).add(fArtist)
  .add(lGenre).add(fGenre)
  .add(lLyrics).add(fLyrics)
  .add(lStorie).add(fStorie)
  .add(btnSave).add(btnPlay).add(btnPause);

panel.layout();

state.panel   = panel;
state.widgets = { heading, hint, fileInfo, status, lTitle, fTitle, lArtist, fArtist, lGenre, fGenre, lLyrics, fLyrics, lStorie, fStorie, btnSave, btnPlay, btnPause, title: fTitle, artist: fArtist, genre: fGenre, lyrics: fLyrics, storieMd: fStorie };

state.gain = audio.createGain();
state.gain.gain.value = 1;
state.gain.connect(audio.destination);
```

```js on:drop
stopAudio({ keepOffset: false });

state.rawBytes    = null;
state.audioBuffer = null;
state.pauseOffset = 0;
state.fileName    = file.name || 'audio.mp3';

const lower   = state.fileName.toLowerCase();
state.isMp3   = lower.endsWith('.mp3') || String(file.mime || '').includes('mpeg');
state.isWav   = lower.endsWith('.wav') || String(file.mime || '').includes('wav');

// Store a copy before anything detaches the underlying buffer
const copy = new Uint8Array(file.bytes.length);
copy.set(file.bytes);
state.rawBytes = copy;

state.widgets.fileInfo.setText(`File: ${state.fileName}  (${(file.size / (1024*1024)).toFixed(2)} MB  ·  ${state.isMp3 ? 'MP3' : state.isWav ? 'WAV' : 'unknown'})`);
setStatus('Parsing metadata…');

// ── Parse metadata ────────────────────────────────────────────────────────────
let parsed;
if (state.isMp3) {
  parsed = readID3v2(copy);
} else if (state.isWav) {
  const riff = readRIFFLyrics(copy);
  parsed = { title:'', artist:'', genre:'', lyrics: riff.lyrics, storieMd:'' };
} else {
  parsed = { title:'', artist:'', genre:'', lyrics:'', storieMd:'' };
}
state.fields = parsed;

// Populate GUI fields with parsed values
for (const key of ['title', 'artist', 'genre', 'lyrics', 'storieMd']) {
  const w = state.widgets[key];
  if (w && typeof w.setValue === 'function') w.setValue(parsed[key] ?? '');
}

const tagSummary = [
  parsed.title    ? `TIT2:"${parsed.title.slice(0,30)}"` : null,
  parsed.artist   ? `TPE1:"${parsed.artist.slice(0,20)}"` : null,
  parsed.lyrics   ? `USLT(${parsed.lyrics.length}ch)` : null,
  parsed.storieMd ? `TXXX:STORIE(${parsed.storieMd.length}ch)` : null,
].filter(Boolean).join('  ');
setStatus(tagSummary || 'No recognised tags found — fill fields and save');

if (state.isWav && !state.isMp3) {
  setStatus('WAV (read-only): ILYC lyrics displayed. Use MP3 for write support.');
}

// ── Decode audio for playback preview ────────────────────────────────────────
void (async () => {
  try {
    await audio.context.resume().catch(() => {});
    const ab = new ArrayBuffer(copy.byteLength);
    new Uint8Array(ab).set(copy);
    state.audioBuffer = await audio.context.decodeAudioData(ab);
  } catch (e) {
    console.warn('[metadata-editor] audio decode failed:', e);
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

if (state.panel) {
  const tokens = gui.getTokens();
  const viewport = gui.getViewportRect();
  const info = gui.getResponsiveInfo({ width: viewport.width, height: viewport.height });
  const inset = info.breakpoint === 'xs' ? tokens.spacing.sm : tokens.spacing.lg;
  const maxWidth = info.breakpoint === 'xs' ? 420 : 520;
  const panelHeight = Math.max(500, viewport.height - inset * 2);

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
    height: panelHeight,
    anchorX: 'start',
    anchorY: 'start'
  }, false);
  state.panel.layout();
}

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.btnSave.wasClicked())  saveModifiedFile();
if (state.widgets.btnPlay.wasClicked())  { audio.context.resume().catch(()=>{}); playFrom(state.pauseOffset); }
if (state.widgets.btnPause.wasClicked()) stopAudio({ keepOffset: true });
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();
```
