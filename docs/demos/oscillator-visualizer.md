---
title: "Oscillator Visualizer"
theme: "neotopia"

# ── Oscillator config ──────────────────────────────────────────────
# Waveform type: sine | square | sawtooth | triangle
oscType: sine
# Starting frequency in Hz
oscFreq: 440
# Output volume (0.0–1.0). Oscillator always feeds the analyser, even at 0.
oscVolume: 0.04

# ── Visualizer config ──────────────────────────────────────────────
# Number of terminal columns used by the waveform (auto-clamped to termWidth)
vizCols: 72
# Number of rows tall
vizRows: 14
# Foreground colour (0xRRGGBBAA)
vizFg: 0x00ff88ff
# Render style: line | bar
vizStyle: line
---

# Oscillator Visualizer

A configurable oscilloscope using ASCII line-drawing characters.
Works in both regular terminal apps and as a Worlds overlay.

**Controls**
- **Space** — toggle audio on / off
- **↑ / ↓** — frequency ±10 Hz  ·  **Shift + ↑/↓** — ±100 Hz
- **1 2 3 4** — waveform: Sine / Square / Sawtooth / Triangle
- **L / B** — render style: Line / Bar

Configure defaults via frontmatter: `oscFreq`, `oscType`, `oscVolume`,
`vizCols`, `vizRows`, `vizFg`, `vizStyle`.

---

```js
// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
let oscState   = null;   // { osc, gain, analyser }
let isPlaying  = false;

let currentFreq  = typeof oscFreq  !== 'undefined' ? Number(oscFreq)  : 440;
let currentType  = typeof oscType  !== 'undefined' ? String(oscType)  : 'sine';
let currentStyle = typeof vizStyle !== 'undefined' ? String(vizStyle) : 'line';

const VOL      = typeof oscVolume !== 'undefined' ? Number(oscVolume) : 0.04;
const FG       = typeof vizFg    !== 'undefined' ? Number(vizFg)    : 0x00ff88ff;
const VIZ_COLS = typeof vizCols  !== 'undefined' ? Math.max(8,  Math.min(200, Number(vizCols)))  : 72;
const VIZ_ROWS = typeof vizRows  !== 'undefined' ? Math.max(3,  Math.min(40,  Number(vizRows)))  : 14;

const WAVEFORMS = ['sine', 'square', 'sawtooth', 'triangle'];

// ─────────────────────────────────────────────────────────────────────────────
// oscSetup — (re)creates the oscillator node, reusing gain & analyser.
//
// Signal graph:
//   osc ──┬──► gain ──► destination   (volume path, mutable)
//         └──► analyser               (visual tap, always active)
//
// Tapping from the oscillator directly (not from gain) means the waveform
// is visible even when audio is muted — useful for silent visual contexts.
// ─────────────────────────────────────────────────────────────────────────────
function oscSetup() {
  const first = !oscState;

  // Tear down previous oscillator node only
  if (!first) {
    try { oscState.osc.stop();       } catch {}
    try { oscState.osc.disconnect(); } catch {}
  }

  const gain         = first ? audio.createGain() : oscState.gain;
  const analyserHook = first
    ? audio.fft.createAnalyser({ fftSize: 2048, smoothing: 0.85 })
    : oscState.analyser;

  if (first) {
    gain.gain.value = 0;          // Start silent regardless of isPlaying
    gain.connect(audio.destination);
  }

  const osc = audio.createOscillator();
  osc.type            = currentType;
  osc.frequency.value = currentFreq;

  osc.connect(gain);                   // Audio path
  analyserHook.connectFrom(osc);       // Visual tap (pre-gain)
  osc.start();

  oscState = { osc, gain, analyser: analyserHook };
}

// ─────────────────────────────────────────────────────────────────────────────
// drawOscilloscope — reusable ASCII oscilloscope renderer.
//
// Works in plain terminal apps (full-screen) and Worlds overlay mode.
// Call in on:render after term.clear() (or omit clear for overlay use).
//
// @param {Uint8Array} samples   getTimeDomainBytes() — 0–255, 128 = silence
// @param {object}    opts
//   x0, y0   top-left terminal position
//   cols     horizontal cell count
//   rows     vertical cell count
//   fg       foreground colour 0xRRGGBBAA
//   style    'line' | 'bar'
// ─────────────────────────────────────────────────────────────────────────────
function drawOscilloscope(samples, opts) {
  const x0   = opts.x0   ?? 0;
  const y0   = opts.y0   ?? 0;
  const cols = opts.cols ?? VIZ_COLS;
  const rows = opts.rows ?? VIZ_ROWS;
  const fg   = opts.fg   ?? FG;
  const style = opts.style ?? currentStyle;

  const mid = (rows - 1) * 0.5;

  // Map each column to a row index
  const pos = new Array(cols);
  for (let c = 0; c < cols; c++) {
    const si = Math.floor(c * samples.length / cols);
    const v  = (samples[si] / 128.0) - 1.0;   // –1 … +1
    const r  = Math.round(mid - v * mid);
    pos[c]   = Math.max(0, Math.min(rows - 1, r));
  }

  // ── Bar style ────────────────────────────────────────────────────
  if (style === 'bar') {
    const midR = Math.round(mid);
    for (let c = 0; c < cols; c++) {
      const top = Math.min(pos[c], midR);
      const bot = Math.max(pos[c], midR);
      for (let r = 0; r < rows; r++) {
        term.write(x0 + c, y0 + r, r >= top && r <= bot ? '█' : ' ', fg);
      }
    }
    return;
  }

  // ── Line style (connected waveform) ──────────────────────────────
  //
  // Character mapping:
  //   ─   flat (slope = 0)
  //   ╱   rising  (screen-y decreasing, i.e. dy < 0)
  //   ╲   falling (screen-y increasing, i.e. dy > 0)
  //   │   vertical gap fill between steep consecutive samples
  //
  // Build the full grid first, then flush one row-string at a time.
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(' '));

  for (let c = 0; c < cols; c++) {
    const yc = pos[c];
    const yp = c > 0 ? pos[c - 1] : yc;
    const dy = yc - yp;

    if (dy === 0) {
      grid[yc][c] = '─';
    } else if (dy > 0) {
      // Falling — place diagonal at destination row, fill gap above it
      grid[yc][c] = '╲';
      for (let r = yp + 1; r < yc; r++) grid[r][c] = '│';
    } else {
      // Rising — place diagonal at destination row, fill gap below it
      grid[yc][c] = '╱';
      for (let r = yc + 1; r < yp; r++) grid[r][c] = '│';
    }
  }

  for (let r = 0; r < rows; r++) {
    term.write(x0, y0 + r, grid[r].join(''), fg);
  }
}
```

```js on:init
oscSetup();

// Resume audio context on first user gesture — required by browsers.
audio.startOnGesture(() => {
  if (oscState && isPlaying) {
    oscState.gain.gain.setTargetAtTime(VOL, audio.currentTime, 0.05);
  }
});
```

```js on:update
// ── Frequency control ────────────────────────────────────────────
const step = key.down('Shift') ? 100 : 10;

if (key.pressed(key.ARROW_UP)) {
  currentFreq = Math.min(8000, currentFreq + step);
  if (oscState) oscState.osc.frequency.setTargetAtTime(currentFreq, audio.currentTime, 0.02);
}
if (key.pressed(key.ARROW_DOWN)) {
  currentFreq = Math.max(20, currentFreq - step);
  if (oscState) oscState.osc.frequency.setTargetAtTime(currentFreq, audio.currentTime, 0.02);
}

// ── Waveform switching (1–4) ─────────────────────────────────────
const wfKeys = ['1', '2', '3', '4'];
for (let i = 0; i < wfKeys.length; i++) {
  if (key.pressed(wfKeys[i])) {
    currentType = WAVEFORMS[i];
    oscSetup();
  }
}

// ── Render style ─────────────────────────────────────────────────
if (key.pressed('l') || key.pressed('L')) currentStyle = 'line';
if (key.pressed('b') || key.pressed('B')) currentStyle = 'bar';

// ── Toggle audio ─────────────────────────────────────────────────
if (key.pressed(key.SPACE)) {
  isPlaying = !isPlaying;
  if (oscState) {
    const targetVol = isPlaying ? VOL : 0;
    oscState.gain.gain.setTargetAtTime(targetVol, audio.currentTime, 0.05);
  }
}
```

```js on:render
term.clear();

const W  = termWidth;
const H  = termHeight;
const vw = Math.min(VIZ_COLS, W - 4);
const vh = Math.min(VIZ_ROWS, H - 10);

// ── Header ────────────────────────────────────────────────────────
term.write(2, 1, '≋ OSCILLATOR VISUALIZER ≋', FG);
term.write(2, 2,
  `Freq: ${currentFreq.toFixed(0)} Hz  │  Wave: ${currentType}  │  Style: ${currentStyle}  │  Audio: ${isPlaying ? 'ON ♪' : 'OFF'}`,
  0x888888ff
);

// ── Bounding box ─────────────────────────────────────────────────
const bx = 1;
const by = 3;
term.write(bx,        by,        '┌' + '─'.repeat(vw + 2) + '┐', 0x334433ff);
term.write(bx,        by + vh + 1, '└' + '─'.repeat(vw + 2) + '┘', 0x334433ff);
for (let r = 0; r < vh; r++) {
  term.write(bx,        by + 1 + r, '│', 0x334433ff);
  term.write(bx + vw + 3, by + 1 + r, '│', 0x334433ff);
}

// ── Waveform ─────────────────────────────────────────────────────
if (oscState) {
  const samples = oscState.analyser.getTimeDomainBytes();
  drawOscilloscope(samples, { x0: bx + 2, y0: by + 1, cols: vw, rows: vh, fg: FG });
}

// ── Mid-line marker ───────────────────────────────────────────────
const midRow = by + 1 + Math.floor(vh / 2);
term.write(bx + 1, midRow, '·', 0x335533ff);
term.write(bx + vw + 2, midRow, '·', 0x335533ff);

// ── Controls legend ───────────────────────────────────────────────
const cy = by + vh + 3;
term.write(2, cy,     'Space  toggle audio  │  ↑↓  freq ±10 Hz  │  Shift+↑↓  ±100 Hz', 0x555555ff);
term.write(2, cy + 1, '1 2 3 4  sine  square  sawtooth  triangle  │  L/B  line/bar',    0x555555ff);

// ── Frequency label ───────────────────────────────────────────────
const A4 = 440;
const semitones = 12 * Math.log2(currentFreq / A4);
const noteNames = ['A','A#','B','C','C#','D','D#','E','F','F#','G','G#'];
const si = ((Math.round(semitones) % 12) + 12) % 12;
const octave = 4 + Math.floor((Math.round(semitones) + 9) / 12);
const noteName = `${noteNames[si]}${octave}`;
const centsDiff = Math.round((semitones - Math.round(semitones)) * 100);
const centsStr = centsDiff === 0 ? '' : ` ${centsDiff > 0 ? '+' : ''}${centsDiff}¢`;
term.write(2, cy + 3, `${currentFreq.toFixed(1)} Hz  ≈  ${noteName}${centsStr}`, FG);
```
