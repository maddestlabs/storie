---
name: "Recorder: Input Demo"
theme: "neonopia"
fontsize: 20
---

A demo showing **`sys.recorder`** — record your keyboard input then play it back
as a classic arcade attract-mode loop.

Controls:
- **Arrow keys**: move the player `@`
- **R**: start / stop recording  
- **Space**: toggle playback of the last recording
- **Esc**: stop playback

```js
let recdr = null;    // InputRecorder instance
let tape = null;     // RecordedTape
let track = null;    // CompiledAutomation from the tape
let prevT = 0;

let mode = 'idle';   // 'idle' | 'recording' | 'playing'
let px = 10, py = 10;
let statusMsg = 'Press R to record';
```

```js on:init
recdr = sys.recorder.create();
px = Math.floor(termWidth / 2);
py = Math.floor(termHeight / 2);
prevT = getTime();
```

```js on:input
if (event.type !== 'keydown' && event.type !== 'keyup') return true;

const k = event.key;

// Toggle recording
if (event.type === 'keydown' && (k === 'r' || k === 'R')) {
  if (mode === 'recording') {
    tape = recdr.stop();
    track = sys.automation.compile(tape.toTimedEntries());
    mode = 'idle';
    statusMsg = `Recorded ${tape.length} events (${(tape.durationMs / 1000).toFixed(1)}s) — Space to play`;
  } else {
    // Reset player and start recording
    px = Math.floor(termWidth / 2);
    py = Math.floor(termHeight / 2);
    recdr.start();
    mode = 'recording';
    statusMsg = 'Recording… press R to stop';
  }
  return true;
}

// Toggle playback
if (event.type === 'keydown' && k === ' ') {
  if (mode === 'playing') {
    mode = 'idle';
    statusMsg = 'Playback stopped — Space to replay';
  } else if (tape && track) {
    px = Math.floor(termWidth / 2);
    py = Math.floor(termHeight / 2);
    prevT = 0;  // playback starts at t=0
    mode = 'playing';
    statusMsg = 'Playing back… Space to stop';
  }
  return true;
}

if (event.type === 'keydown' && k === 'Escape') {
  mode = 'idle';
  statusMsg = tape ? 'Space to replay' : 'Press R to record';
  return true;
}

// Always feed real input to the recorder if active.
if (mode === 'recording') recdr.record(event);

// Forward to movement handler
handleMove(event);
return true;
```

```js
function handleMove(event) {
  if (event.type === 'keydown') {
    if (event.key === 'ArrowLeft')  px = Math.max(1, px - 1);
    if (event.key === 'ArrowRight') px = Math.min(termWidth - 2, px + 1);
    if (event.key === 'ArrowUp')    py = Math.max(1, py - 1);
    if (event.key === 'ArrowDown')  py = Math.min(termHeight - 2, py + 1);
  }
}
```

```js on:update
if (mode !== 'playing' || !track) return;

const nowT = getTime();
// During playback we use a self-contained time that starts at 0.
// We accumulate time from when playback began — store accumulated time in prevT.
// Actually prevT=0 means "just started"; use getDelta() to accumulate.
const dt = getDelta();
prevT += dt;

const impulses = sys.automation.impulsesBetween(track, prevT - dt, prevT);
for (const ev of impulses) {
  if (ev.type === 'input') {
    handleMove(ev.input);
    sys.input.emit(ev.input);
  }
}

// Loop the playback tape.
if (tape && prevT * 1000 > tape.durationMs + 500) {
  px = Math.floor(termWidth / 2);
  py = Math.floor(termHeight / 2);
  prevT = 0;
}
```

```js on:render
term.clear();

const recColor  = 0xff4444ff;
const playColor = 0x44ff88ff;
const idleColor = 0x888888ff;
const hudColor  = mode === 'recording' ? recColor : mode === 'playing' ? playColor : idleColor;

// Border
for (let x = 0; x < termWidth; x++) {
  term.write(x, 0, '─', 0x444444ff);
  term.write(x, termHeight - 1, '─', 0x444444ff);
}
for (let y = 1; y < termHeight - 1; y++) {
  term.write(0, y, '│', 0x444444ff);
  term.write(termWidth - 1, y, '│', 0x444444ff);
}

// Player
const marker = mode === 'playing' ? '●' : '@';
term.write(px, py, marker, mode === 'playing' ? 0x44ff88ff : 0xffcc66ff);

// Recording indicator
if (mode === 'recording') {
  const elapsed = recdr ? recdr.getElapsedMs() : 0;
  term.write(termWidth - 12, 1, `● REC ${(elapsed / 1000).toFixed(1)}s`, recColor);
}

// HUD
term.write(2, 0, ' RECORDER DEMO ', hudColor);
term.write(2, termHeight - 1, statusMsg.slice(0, termWidth - 4), hudColor);
```
