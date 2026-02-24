---
name: "St|rain"
theme: "neonopia"
width: 1080
height: 2400
shaders: "bloom+lightvignette+crt"
---

Binary strains of rain fall. Type `0` or `1` to match the **bottom digit** of each falling strain.  
Clear the full strain from bottom to top for points. Miss a key and it resets.  
A strain reaching the bottom ends the game.

**Keys:** `0` / `1` (or numpad) · `S` start · `R` restart same seed  
**Touch/click:** left half = `1` · right half = `0`

---

## Sounds

```stfxr name:rain_hit
{
  "nodes": [
    { "kind": "oscVoice", "id": "v", "oscType": "triangle",
      "freqHz": { "kind": "rand", "min": 660, "max": 1100 },
      "gain": 0.22, "stopAfter": 0.11 }
  ],
  "edges": [{ "from": "v", "to": "out" }],
  "events": [
    { "kind": "envAR", "node": "v", "attack": 0.001, "release": 0.09, "peak": 1.0 },
    { "kind": "freqDrop", "node": "v", "startHz": 1100, "endHz": 220, "duration": 0.09, "at": 0 }
  ]
}
```

```stfxr name:rain_clear
{
  "base": "boom",
  "patch": {
    "nodes": [
      { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": 800, "q": 1.5 }
    ]
  }
}
```

```stfxr name:rain_over
{
  "base": "lose"
}
```

```stfxr name:rain_start
{
  "base": "coin"
}
```

---

## Game Code

```js
// ── Constants (module-level, safe to re-declare as var) ───────────────────
var STRAIN_MIN  = 3;
var STRAIN_MAX  = 6;
var SPEED_MIN   = 1.4;
var SPEED_MAX   = 3.2;
var MAX_STRAINS = 20;
var DESTROY_DUR = 0.55;

// ── Palette (derived from the active theme) ─────────────────────────────
// Theme colors are packed 0xRRGGBBAA integers, so they can be used directly.
var C_TARGET   = theme.fg;
var C_LEAD     = theme.accent1;
var C_PENDING  = theme.accent3;
var C_DONE     = theme.fgAlt;
var C_FADE1    = theme.accent3;
var C_FADE2    = theme.fgAlt;
var C_SCORE    = theme.accent2;
var C_SEED_HUD = theme.fgAlt;
var C_TITLE    = theme.fgAlt;
var C_MENU     = theme.fg;
var C_MENUALT  = theme.accent1;

// ── All mutable state lives on scope.* so every function closure ──────────
// ── (persisted or new) always reads/writes the same object. ──────────────
// Initialised once; on:init only overwrites if starting fresh.
if (!scope.g) {
  scope.g = {
    gameMode: 'start',
    score:    0,
    seed:     Math.floor(Math.random() * 1000000),
    rng:      null,
    strains:  [],
    sparks:   []
  };
}
var g = scope.g;  // local alias for convenience

// ── PRNG helpers (take the raw ()=>number from random.rng) ────────────────
function rInt(r, min, max)   { return Math.floor(r() * (max - min + 1)) + min; }
function rFloat(r, min, max) { return r() * (max - min) + min; }

// ── Object factories ───────────────────────────────────────────────────────
function makeStrain(col, r) {
  var size = rInt(r, STRAIN_MIN, STRAIN_MAX);
  var digits = [];
  for (var i = 0; i < size; i++) {
    digits.push({ value: r() < 0.5 ? '0' : '1', row: -(size - i), drift: 0 });
  }
  return {
    col,
    digits,
    speed:        rFloat(r, SPEED_MIN, SPEED_MAX),
    strainSize:   size,
    highlight:    size - 1,
    destroyTimer: -1,
    gameover:     false
  };
}

function makeSpark(col, row) {
  return {
    col, row,
    vx:   (Math.random() - 0.5) * 3.0,
    vy:   (Math.random() - 0.5) * 2.5,
    life: 1.0
  };
}

// ── Column picker ─────────────────────────────────────────────────────────
function findFreeCol(r) {
  var busy = new Set();
  for (var i = 0; i < g.strains.length; i++) {
    for (var d = -2; d <= 2; d++) busy.add(g.strains[i].col + d);
  }
  var free = [];
    var tw = getTermWidth();
    for (var c = 1; c < tw - 1; c++) {
    if (!busy.has(c)) free.push(c);
  }
  if (!free.length) return -1;
  return free[rInt(r, 0, free.length - 1)];
}

// ── Audio ─────────────────────────────────────────────────────────────────
function sfx(name, vol) { stfxr.play(name, undefined, { volume: vol }); }

// ── Input ─────────────────────────────────────────────────────────────────
function handleDigit(key) {
  for (var i = 0; i < g.strains.length; i++) {
    var s = g.strains[i];
    if (s.destroyTimer > 0) continue;
    var cur = s.digits[s.highlight];
    if (key === cur.value) {
      var hitRow = Math.floor(cur.row);
      s.highlight--;
      sfx('rain_hit', 0.38);
      spawnSparks(s.col, hitRow, 2);
      if (s.highlight < 0) scoreUp(s);
    } else {
      s.highlight = s.strainSize - 1;
    }
  }
}

function spawnSparks(col, row, n) {
  //for (var i = 0; i < n; i++) g.sparks.push(makeSpark(col, row));
}

function scoreUp(s) {
  g.score += s.strainSize;
  s.destroyTimer = DESTROY_DUR;
  sfx('rain_clear', 0.45);
  for (var i = 0; i < s.digits.length; i++) spawnSparks(s.col, Math.floor(s.digits[i].row), 3);
}

// ── Mode transitions ──────────────────────────────────────────────────────
function startGame() {
  g.seed    = random.seed();
  g.rng     = random.rng(g.seed);
  g.gameMode = 'play';
  g.score   = 0;
  g.strains = [];
  g.sparks  = [];
  sfx('rain_start', 0.4);
}

function restartGame() {
  g.rng     = random.rng(g.seed);
  g.gameMode = 'play';
  g.score   = 0;
  g.strains = [];
  g.sparks  = [];
}

function doGameOver() {
  g.gameMode = 'gameover';
  sfx('rain_over', 0.5);
  for (var i = 0; i < g.strains.length; i++) {
    if (g.strains[i].destroyTimer <= 0) g.strains[i].destroyTimer = DESTROY_DUR;
  }
}

// ── Update ────────────────────────────────────────────────────────────────
function updateStrains(dt) {
  for (var i = g.strains.length - 1; i >= 0; i--) {
    var s = g.strains[i];
    for (var j = 0; j < s.digits.length; j++) {
      var d = s.digits[j];
      d.row += s.speed * dt;
      if (s.destroyTimer > 0) {
        d.drift += (Math.random() - 0.5) * 1.2;
        d.row   += (Math.random() - 0.5) * 0.6;
      }
    }
    if (s.destroyTimer > 0) {
      s.destroyTimer -= dt;
      if (s.destroyTimer <= 0) { g.strains.splice(i, 1); continue; }
    } else if (!s.gameover) {
      var bottom = s.digits[s.digits.length - 1];
        var th = getTermHeight();
        if (bottom.row >= th && g.gameMode === 'play') {
        s.gameover = true;
        doGameOver();
        return;
      }
    }
  }
}

function updateSparks(dt) {
  for (var i = g.sparks.length - 1; i >= 0; i--) {
    var p = g.sparks[i];
    p.col  += p.vx * dt * 7;
    p.row  += p.vy * dt * 7;
    p.life -= dt * 3.8;
    if (p.life <= 0) g.sparks.splice(i, 1);
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────
function drawStrains() {
  for (var si = 0; si < g.strains.length; si++) {
    var s = g.strains[si];
    var dying = s.destroyTimer > 0;
    for (var i = 0; i < s.digits.length; i++) {
      var d = s.digits[i];
      var col = Math.floor(s.col + (dying ? d.drift : 0));
      var row = Math.floor(d.row);
        var tw = getTermWidth();
        var th = getTermHeight();
        if (col < 0 || col >= tw || row < 0 || row >= th) continue;
      var fg;
      if (dying)                        fg = s.destroyTimer > DESTROY_DUR * 0.5 ? C_FADE1 : C_FADE2;
      else if (i > s.highlight)         fg = C_DONE;
      else if (i === s.highlight)       fg = C_TARGET;
      else if (i === s.digits.length-1) fg = C_LEAD;
      else                              fg = C_PENDING;
      term.write(col, row, d.value, fg);
    }
  }
}

function drawSparks() {
  for (var i = 0; i < g.sparks.length; i++) {
    var p = g.sparks[i];
    var c = Math.floor(p.col), row = Math.floor(p.row);
      var tw = getTermWidth();
      var th = getTermHeight();
      if (c < 0 || c >= tw || row < 0 || row >= th) continue;
    var v = Math.min(Math.floor(p.life * 220), 255);
    term.write(c, row, '.', ((v << 24) | (v << 16) | (v << 8) | 0xFF) >>> 0);
  }
}

function drawHUD() {
  var sStr = 'S:' + g.seed;
    var tw = getTermWidth();
    term.write(tw - sStr.length - 1, 0, sStr, C_SEED_HUD);
  if (g.gameMode !== 'start') {
    var sc = String(g.score);
      var th = getTermHeight();
      term.write(tw - sc.length - 1, th - 1, sc, C_SCORE);
  }
}

function drawMenu() {
  var tw = getTermWidth();
  var th = getTermHeight();
  var cx = Math.floor(tw / 2);
  var cy = Math.floor(th / 2);
  var title = '0RA1N';
  term.write(cx - Math.floor(title.length / 2), cy - 4, title, C_TITLE);
  if (g.gameMode === 'start') {
    var s1 = '[S]tart';
    term.write(cx - Math.floor(s1.length / 2), cy - 1, s1, C_MENU);
    var sd = 'Seed: ' + g.seed;
    term.write(cx - Math.floor(sd.length / 2), cy + 1, sd, C_MENUALT);
    var hint = '0/1 keys or tap left/right';
    term.write(cx - Math.floor(hint.length / 2), cy + 3, hint, C_TITLE);
  } else if (g.gameMode === 'gameover') {
    var s1 = '[S]tart new game';
    var s2 = '[R]estart same seed';
    term.write(cx - Math.floor(s1.length / 2), cy - 2, s1, C_MENU);
    term.write(cx - Math.floor(s2.length / 2), cy,     s2, C_MENUALT);
    var sd = 'Seed: ' + g.seed + '   Score: ' + g.score;
    term.write(cx - Math.floor(sd.length / 2), cy + 2, sd, C_SCORE);
  }
}
```

```js on:init
term.layerID = 'default';

// Apply URL seed override on first load only
var urlSeed = getParam('seed', '');
if (urlSeed !== '' && scope.g.gameMode === 'start') {
  scope.g.seed = Math.floor(Number(urlSeed));
}
// Always recreate rng — ensures it's a live closure from the current
// SES compartment rather than a stale reference from a previous reload.
scope.g.rng = random.rng(scope.g.seed);

```

```js on:input
if (!event) return;
var _gm = scope.g.gameMode;

if (event.type === 'keydown') {
  var k = event.key;
  if      (k === '0' || k === 'Numpad0')       { if (_gm === 'play') handleDigit('0'); }
  else if (k === '1' || k === 'Numpad1')        { if (_gm === 'play') handleDigit('1'); }
  else if (k.toLowerCase() === 's')             { if (_gm !== 'play') startGame(); }
  else if (k.toLowerCase() === 'r')             { if (_gm === 'gameover') restartGame(); }
}

if (event.type === 'mouse' && event.action === 'press') {
  if (_gm === 'play') {
     handleDigit(event.cellX < getTermWidth() / 2 ? '1' : '0');
  } else {
    startGame();
  }
}
```

```js on:update
if (!scope.g.rng) return;
var dt = Math.min(getDelta(), 0.05);

updateSparks(dt);

if (scope.g.gameMode === 'play' || scope.g.gameMode === 'gameover') {
  updateStrains(dt);
}

if (scope.g.gameMode === 'play') {
  var cap = Math.min(MAX_STRAINS, Math.floor(getTermWidth() / 3));
  while (scope.g.strains.length < cap) {
    var col = findFreeCol(scope.g.rng);
    if (col < 0) break;
    scope.g.strains.push(makeStrain(col, scope.g.rng));
  }
}
```

```js on:render
term.layerID = 'default';
term.clear();

drawStrains();
drawSparks();
drawHUD();

if (scope.g.gameMode !== 'play') {
  drawMenu();
}
```
