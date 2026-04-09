---
name: "Beat Clock: Groove Sync"
theme: "neonopia"
fontsize: 20
---

A demo of **`sys.beat`** — BPM-synced automation that uses beat numbers instead
of milliseconds.  The `groove` timed block uses `beat:N|json` lines with a
`# bpm:128` header; `sys.beat.parseBlock` converts them to milliseconds before
handing off to `sys.automation.compile`.

Controls:
- **↑ / ↓**: adjust BPM
- **Space**: reset playhead to beat 0

```timed name:groove
# bpm:128
beat:0|{"var":"kick","value":0}
beat:0|{"var":"filter","value":0.1}
beat:1|{"var":"kick","value":1,"ease":"step"}
beat:1.5|{"var":"kick","value":0,"ease":"step"}
beat:2|{"var":"kick","value":1,"ease":"step"}
beat:2.5|{"var":"kick","value":0,"ease":"step"}
beat:3|{"var":"kick","value":1,"ease":"step"}
beat:3.5|{"var":"kick","value":0,"ease":"step"}
beat:4|{"var":"kick","value":1,"ease":"step"}
beat:4.5|{"var":"kick","value":0,"ease":"step"}
beat:4|{"var":"filter","value":0.9,"ease":"outCubic"}
beat:8|{"var":"filter","value":0.1,"ease":"inCubic"}
beat:8|{"var":"kick","value":0}
```

```js
let clock = null;
let track = null;
let startT = 0;
let bpm = 128;
```

```js on:init
startT = getTime();
clock = sys.beat.clock({ bpm, beatsPerBar: 4 });
track = sys.automation.compile(
  sys.beat.parseBlock(doc.timedBlock('groove'), clock)
);
```

```js on:input
if (event.type !== 'keydown') return true;
if (event.key === 'ArrowUp')   bpm = Math.min(300, bpm + 5);
if (event.key === 'ArrowDown') bpm = Math.max(40,  bpm - 5);
if (event.key === ' ')         startT = getTime();

// Rebuild clock and track whenever BPM changes.
clock = sys.beat.clock({ bpm, beatsPerBar: 4 });
track = sys.automation.compile(
  sys.beat.parseBlock(doc.timedBlock('groove'), clock)
);
return true;
```

```js on:render
term.clear();

const t = getTime() - startT;
const beatF  = clock ? sys.beat.beatAt(clock, t) : 0;
const barF   = clock ? sys.beat.barAt(clock, t) : 0;
const bphase = clock ? sys.beat.beatPhase(clock, t) : 0;
const rphase = clock ? sys.beat.barPhase(clock, t) : 0;

const kick   = track ? sys.automation.valueAt(track, 'kick',   t, 0) : 0;
const filter = track ? sys.automation.valueAt(track, 'filter', t, 0.1) : 0.1;

// ── Beat grid ──────────────────────────────────────────────────────────────
const gridW = termWidth - 4;
const barLen = 4; // beats per bar shown
const barPx  = Math.floor(gridW / barLen);

const gridY = 4;
for (let b = 0; b < barLen; b++) {
  const bx = 2 + b * barPx;
  const isActive = Math.floor(beatF) % barLen === b;
  const brightness = isActive ? 0xffff44ff : 0x334455ff;
  term.write(bx, gridY,     '┌' + '─'.repeat(barPx - 2) + '┐', brightness);
  term.write(bx, gridY + 1, '│' + (isActive ? '█'.repeat(barPx - 2) : ' '.repeat(barPx - 2)) + '│', brightness);
  term.write(bx, gridY + 2, '└' + '─'.repeat(barPx - 2) + '┘', brightness);
  term.write(bx + Math.floor(barPx / 2) - 1, gridY + 1, ` ${b + 1} `, isActive ? 0x000000ff : 0x667788ff);
}

// ── Beat phase bar ─────────────────────────────────────────────────────────
const phaseY = gridY + 5;
const phaseFill = Math.round(bphase * (termWidth - 4));
term.write(2, phaseY,     'beat phase:', 0x888888ff);
term.write(2, phaseY + 1, '█'.repeat(phaseFill) + '░'.repeat(termWidth - 4 - phaseFill), 0x44ccffff);

// ── Filter cutoff bar ──────────────────────────────────────────────────────
const filterY = phaseY + 3;
const filterFill = Math.round(filter * (termWidth - 4));
term.write(2, filterY,     `filter ${filter.toFixed(2)}:`, 0x888888ff);
term.write(2, filterY + 1, '█'.repeat(filterFill) + '░'.repeat(termWidth - 4 - filterFill), 0xaa44ffff);

// ── Kick indicator ─────────────────────────────────────────────────────────
const kickY = filterY + 3;
term.write(2, kickY, kick > 0.5 ? '◉ KICK' : '○     ', kick > 0.5 ? 0xff8844ff : 0x444444ff);

// ── HUD ────────────────────────────────────────────────────────────────────
const hud = `BPM:${bpm}  beat:${beatF.toFixed(2)}  bar:${barF}  ↑↓ adjust BPM  Space reset`;
term.write(2, 0, hud.slice(0, termWidth - 3), 0x66ffccff);
term.write(2, 1, `bar phase: ${(rphase * 100).toFixed(0)}%`, 0x888888ff);
```
