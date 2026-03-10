---
name: "Automation: Arcade Intro"
theme: "neonopia"
fontsize: 22
shaders: "lightvignette"
---

A tiny demo showing a **time-based automation track** that:

- Tweens variables with easing (`sys.automation.valueAt`)
- Fires impulses on edges (`sys.automation.impulsesBetween`)
- Can **simulate input** (`sys.input.emit`) to drive an input-controlled loop

Controls:
- Arrow keys: move
- `A`: toggle autopilot (automation-driven input)
- `R`: reset position

```timed name:events
0|{"var":"ui.fade","value":0}
800|{"var":"ui.fade","value":1,"ease":"outCubic"}

0|{"var":"player.speed","value":1}
2000|{"var":"player.speed","value":2.2,"ease":"inOutQuad"}
5000|{"var":"player.speed","value":1,"ease":"outQuad"}

// Autopilot (synthetic key events)
0|{"input":{"type":"keydown","key":"ArrowRight"}}
900|{"input":{"type":"keyup","key":"ArrowRight"}}
1000|{"input":{"type":"keydown","key":"ArrowDown"}}
1600|{"input":{"type":"keyup","key":"ArrowDown"}}
1700|{"input":{"type":"keydown","key":"ArrowLeft"}}
2600|{"input":{"type":"keyup","key":"ArrowLeft"}}
2700|{"input":{"type":"keydown","key":"ArrowUp"}}
3400|{"input":{"type":"keyup","key":"ArrowUp"}}
3600|{"input":{"type":"keydown","key":"ArrowRight"}}
5200|{"input":{"type":"keyup","key":"ArrowRight"}}
```

```js
function st() {
  if (!scope.__automationArcadeIntro) {
    scope.__automationArcadeIntro = {
      track: null,
      prevT: 0,
      autopilot: true,
      x: 10,
      y: 10,
      lastInput: null,
    };
  }
  return scope.__automationArcadeIntro;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function rgba(rgb, a01) {
  const a = clamp(Math.round(255 * clamp(a01, 0, 1)), 0, 255);
  return ((rgb << 8) | a) >>> 0;
}
```

```js on:init
const s = st();
term.layerID = 'default';

s.track = sys.automation.compile(doc.timedBlock('events'));
s.prevT = getTime();

// Start centered-ish.
s.x = Math.floor(termWidth / 2);
s.y = Math.floor(termHeight / 2);
```

```js on:export
const s = st();

// When exporting, the engine runs a synthetic clock that starts at t=0.
// Reset automation state so impulses fire deterministically from the beginning.
const name = (options && options.timedBlock) ? options.timedBlock : 'events';
s.track = sys.automation.compile(doc.timedBlock(name));
s.prevT = 0;
```

```js on:input
const s = st();

if (event.type === 'keydown') {
  if (event.key === 'a' || event.key === 'A') {
    s.autopilot = !s.autopilot;
    return true;
  }
  if (event.key === 'r' || event.key === 'R') {
    s.x = Math.floor(termWidth / 2);
    s.y = Math.floor(termHeight / 2);
    return true;
  }
}

s.lastInput = event;
return true;
```

```js on:update
const s = st();
const nowT = getTime();
const dt = Math.max(0, getDelta());

// Fire automation impulses first so key.down() reflects them this frame.
if (s.autopilot && s.track) {
  const impulses = sys.automation.impulsesBetween(s.track, s.prevT, nowT);
  for (const ev of impulses) {
    if (ev.type === 'input') sys.input.emit(ev.input);
  }
}

// Sample eased variables.
const speedMul = s.track ? sys.automation.valueAt(s.track, 'player.speed', nowT, 1) : 1;
const baseSpeedCellsPerSec = 16;
const spd = baseSpeedCellsPerSec * speedMul;

// Input-driven movement (works for real input AND synthetic input).
let vx = 0;
let vy = 0;
if (key.down('ArrowLeft'))  vx -= 1;
if (key.down('ArrowRight')) vx += 1;
if (key.down('ArrowUp'))    vy -= 1;
if (key.down('ArrowDown'))  vy += 1;

s.x += vx * spd * dt;
s.y += vy * spd * dt;

s.x = clamp(s.x, 2, termWidth - 3);
s.y = clamp(s.y, 3, termHeight - 3);

s.prevT = nowT;
```

```js on:render
const s = st();
term.clear();

const t = getTime();
const fade = s.track ? sys.automation.valueAt(s.track, 'ui.fade', t, 1) : 1;

const C_TITLE = rgba(0xffffff, fade);
const C_DIM = rgba(0xaaaaaa, fade);
const C_HUD = rgba(0x66ffcc, fade);
const C_PLAYER = rgba(0xffcc66, fade);

// Frame
term.write(0, 0, '═'.repeat(termWidth), C_DIM);
term.write(0, termHeight - 1, '═'.repeat(termWidth), C_DIM);
for (let y = 1; y < termHeight - 1; y++) {
  term.write(0, y, '║', C_DIM);
  term.write(termWidth - 1, y, '║', C_DIM);
}

// Title + HUD
const title = 'AUTOMATION: ARCADE INTRO';
term.write(Math.max(2, Math.floor((termWidth - title.length) / 2)), 1, title, C_TITLE);

const hud1 = `t=${t.toFixed(2)}s  autopilot=${s.autopilot ? 'ON' : 'OFF'}  speedMul=${(s.track ? sys.automation.valueAt(s.track, 'player.speed', t, 1) : 1).toFixed(2)}`;
term.write(2, 2, hud1.slice(0, termWidth - 4), C_HUD);
term.write(2, termHeight - 2, 'Arrows move • A toggles autopilot • R resets', C_DIM);

// Player
const px = Math.round(s.x);
const py = Math.round(s.y);
term.write(px, py, '@', C_PLAYER);
```

# Notes

This demo uses the same pattern that makes lyric sync robust:

- State sampling is a pure function of playhead time (great for seeking/export)
- Impulses are edge-triggered between `(prevT, nowT]`
- Synthetic input is optional, but powerful when you already have an input-driven game loop
