---
name: "STFXR (Graph SFX Fences)"
theme: "neonopia"
stfxrSeed: 1337
---

A focused demo of `stfxr` fenced blocks:

- Embed strict JSON sound graphs directly in Markdown
- Play them via `stfxr.play(name, seed?, options?)`
- Derive from built-ins (or other `stfxr` presets) via `base + patch`

## Embedded Presets

### 1) A full preset

```stfxr name:customBlip seed:1337
{
  "nodes": [
    {
      "kind": "oscVoice",
      "id": "v",
      "oscType": "square",
      "freqHz": { "kind": "rand", "min": 660, "max": 990 },
      "gain": 0.8,
      "stopAfter": 0.25
    }
  ],
  "edges": [
    { "from": "v", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "v", "attack": 0.002, "release": 0.10, "peak": 1.0 }
  ]
}
```

### 2) Derive from a built-in preset with `base + patch`

This derives from the built-in `zap` (from `audio.sfx`) and upserts the filter node `id: "f"`.

```stfxr name:zapHeavy seed:1337
{
  "base": "zap",
  "patch": {
    "nodes": [
      {
        "kind": "filter",
        "id": "f",
        "filterType": "lowpass",
        "freqHz": 900,
        "q": 8
      }
    ]
  }
}
```

### 3) Derive from another `stfxr` preset (in the same doc)

This derives from `customBlip` and appends a quick pitch-drop event.

```stfxr name:customBlipGlide seed:1337
{
  "base": "customBlip",
  "patch": {
    "eventsAdd": [
      { "kind": "freqDrop", "node": "v", "startHz": 1200, "endHz": 240, "duration": 0.08, "at": 0 }
    ]
  }
}
```

### 4) New node kinds: colored noise + waveshaper + LFO param modulation

This one uses:
- `noiseVoice.noiseType: "pink"`
- `filter.gain` (useful for shelf/peaking)
- `waveshaper` distortion
- `lfo` connected to an AudioParam via an edge target like `"lp.frequency"`

```stfxr name:noisePunch seed:1337
{
  "vars": {
    "dur": { "kind": "rand", "min": 0.12, "max": 0.22 },
    "cut": { "kind": "rand", "min": 700, "max": 2200 }
  },
  "nodes": [
    { "kind": "noiseVoice", "id": "n", "noiseType": "pink", "duration": { "kind": "var", "name": "dur" }, "gain": 0.45, "stopAfter": 0.35 },
    { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": { "kind": "var", "name": "cut" }, "q": 1.6, "gain": 0 },
    { "kind": "waveshaper", "id": "ws", "curve": "softClip", "amount": 1.2, "oversample": "2x" },
    { "kind": "lfo", "id": "l", "oscType": "sine", "freqHz": 9, "gain": 600, "stopAfter": 0.4 }
  ],
  "edges": [
    { "from": "n", "to": "lp" },
    { "from": "lp", "to": "ws" },
    { "from": "ws", "to": "out" },
    { "from": "l", "to": "lp.frequency" }
  ],
  "events": [
    { "kind": "envAR", "node": "n", "attack": 0.002, "release": 0.18, "peak": 1.0 }
  ]
}
```

## Game Code

```js
let mouseDownLeft = false;
let widgets = null;

let lastPlayed = '';
let lastSnippet = '';

// NOTE: Baking is async. To persist results across frames,
// store baked state on `scope.*` (not imported locals).
```

```js on:init
term.layerID = 'default';

scope.bakedId = scope.bakedId || '';
scope.bakedName = scope.bakedName || '';
scope.bakedSeed = scope.bakedSeed || 0;
scope.baking = false;

// Initialize retained-mode GUI
gui.init();

const title = gui.createLabel({
  bounds: { x: 20, y: 20, width: 900, height: 30 },
  text: 'STFXR Fences: JSON Presets + base/patch',
  align: 'left'
});

const info = gui.createLabel({
  bounds: { x: 20, y: 50, width: 900, height: 24 },
  text: `Seed: ${stfxrSeed}   (click a button to unlock audio if needed)`,
  align: 'left'
});

const vol = gui.createSlider({
  bounds: { x: 20, y: 80, width: 420, height: 44 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 60
});

const btnRandomize = gui.createButton({
  bounds: { x: 460, y: 80, width: 220, height: 44 },
  label: 'Randomize Seed'
});

const btnList = gui.createButton({
  bounds: { x: 700, y: 80, width: 220, height: 44 },
  label: 'List stfxr Presets'
});

const status = gui.createLabel({
  bounds: { x: 20, y: 130, width: 600, height: 24 },
  text: 'Last: (none)',
  align: 'left'
});

const btnBakeLast = gui.createButton({
  bounds: { x: 640, y: 130, width: 280, height: 44 },
  label: 'Bake last played'
});

const btnPlayBaked = gui.createButton({
  bounds: { x: 940, y: 130, width: 280, height: 44 },
  label: 'Play baked'
});

const snippet = gui.createLabel({
  bounds: { x: 20, y: 175, width: 1200, height: 24 },
  text: 'Snippet: (none)',
  align: 'left'
});

const presetsLabel = gui.createLabel({
  bounds: { x: 20, y: 200, width: 1200, height: 24 },
  text: 'Presets: (click "List stfxr Presets")',
  align: 'left'
});

const x0 = 20;
const y0 = 240;
const w = 280;
const h = 44;
const gapX = 14;
const gapY = 12;

const btnCustom = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 0, width: w, height: h }, label: 'Play customBlip (default seed)' });
const btnVariant = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 0, width: w, height: h }, label: 'Play customBlip (seed+1)' });

const btnZapHeavy = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 1, width: w, height: h }, label: 'Play zapHeavy (derived from zap)' });
const btnGlide = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 1, width: w, height: h }, label: 'Play customBlipGlide (derived)' });

const btnNoisePunch = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 2, width: w, height: h }, label: 'Play noisePunch (pink + LFO + shaper)' });

widgets = {
  title,
  info,
  vol,
  btnRandomize,
  btnList,
  status,
  btnBakeLast,
  btnPlayBaked,
  snippet,
  presetsLabel,
  btnCustom,
  btnVariant,
  btnZapHeavy,
  btnGlide,
  btnNoisePunch
};

// If autoplay is blocked, the first click will unlock.
audio.context.resume().catch(() => {});
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

if (event.type === 'mouse') {
  if (event.button === 'left') {
    mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, mouseDownLeft);
}
```

```js on:update
if (!widgets) return;

gui.update(getMouseX(), getMouseY(), mouseDownLeft);

const volume = (widgets.vol.getValue() || 0) / 100;

const playNamed = (name, seedOverride) => {
  const seed = seedOverride === undefined ? stfxrSeed : seedOverride;
  stfxr.play(name, seed, { volume });
  lastPlayed = name;
  lastSnippet = stfxr.snippet(name, seed, Number(volume.toFixed(2)));
  widgets.status.setText(`Last: ${name} (seed ${seed})  (volume ${Math.round(volume * 100)}%)`);
  widgets.snippet.setText(`Snippet: ${lastSnippet}`);
};

const bakeLastPlayed = () => {
  if (scope.baking) return;
  const name = lastPlayed || 'customBlip';
  const seed = Number(stfxrSeed) >>> 0;

  scope.baking = true;
  widgets.status.setText(`Baking: ${name} (seed ${seed}) ...`);
  widgets.snippet.setText(`Snippet: (baking async)`);

  stfxr
    .bake(name, seed, { maxSeconds: 3 })
    .then(function(id) {
      scope.bakedId = String(id || '');
      scope.bakedName = name;
      scope.bakedSeed = seed;
      scope.baking = false;
      if (!scope.bakedId) {
        widgets.status.setText(`Bake failed: ${name} (seed ${seed})`);
        return;
      }
      widgets.status.setText(`Baked: ${scope.bakedName} (seed ${scope.bakedSeed})`);
      widgets.snippet.setText(`Snippet: stfxr.playBaked(${JSON.stringify(scope.bakedId)}, { volume: ${Number(volume.toFixed(2))} })`);
    })
    .catch(function(e) {
      scope.baking = false;
      widgets.status.setText(`Bake error: ${String((e && e.message) || e)}`);
    });
};

const playBaked = () => {
  const id = String(scope.bakedId || '');
  if (!id) {
    widgets.status.setText('No baked sound yet. Click "Bake last played" first.');
    return;
  }
  stfxr.playBaked(id, { volume });
  widgets.status.setText(`Played baked: ${scope.bakedName} (seed ${scope.bakedSeed})`);
};

if (widgets.btnRandomize.wasClicked()) {
  stfxrSeed = random.seed();
  widgets.info.setText(`Seed: ${stfxrSeed}   (click a button to unlock audio if needed)`);
}

if (widgets.btnList.wasClicked()) {
  widgets.presetsLabel.setText(`Presets: ${stfxr.list().join(', ') || '(none)'}`);
}

if (widgets.btnBakeLast.wasClicked()) bakeLastPlayed();
if (widgets.btnPlayBaked.wasClicked()) playBaked();

if (widgets.btnCustom.wasClicked()) playNamed('customBlip');
if (widgets.btnVariant.wasClicked()) playNamed('customBlip', (Number(stfxrSeed) + 1) >>> 0);
if (widgets.btnZapHeavy.wasClicked()) playNamed('zapHeavy');
if (widgets.btnGlide.wasClicked()) playNamed('customBlipGlide');
if (widgets.btnNoisePunch.wasClicked()) playNamed('noisePunch');
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();
```
