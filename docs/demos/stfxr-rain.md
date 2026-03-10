---
name: "STFXR: Water Drop"
theme: "neotopia"
stfxrSeed: 1337
---

A minimal demo of a synthetic **water drop / drip plink** sound built with `stfxr` graphs.

- Click **Play water_drop** to audition
- Click **Randomize Seed** to get small variations

## Preset

```stfxr name:water_drop seed:1337
{
  "vars": {
    "start":   { "kind": "rand", "min": 1400, "max": 2600 },
    "end":     { "kind": "rand", "min": 420, "max": 900 },
    "glide":   { "kind": "rand", "min": 0.07, "max": 0.12 },
    "ring":    { "kind": "rand", "min": 0.12, "max": 0.22 },
    "harmMul": { "kind": "rand", "min": 1.8, "max": 2.4 },
    "harm":    { "kind": "mul", "a": { "kind": "var", "name": "start" }, "b": { "kind": "var", "name": "harmMul" } },
    "harmEnd": { "kind": "mul", "a": { "kind": "var", "name": "end" }, "b": { "kind": "var", "name": "harmMul" } },
    "bp0":     { "kind": "rand", "min": 1300, "max": 2400 },
    "q":       { "kind": "rand", "min": 9, "max": 16 },
    "lp":      { "kind": "rand", "min": 2600, "max": 5200 }
  },
  "nodes": [
    { "kind": "oscVoice", "id": "tone", "oscType": "sine", "freqHz": { "kind": "var", "name": "start" }, "gain": 0.85, "stopAfter": 0.35 },
    { "kind": "oscVoice", "id": "partial", "oscType": "triangle", "freqHz": { "kind": "var", "name": "harm" }, "gain": 0.22, "stopAfter": 0.28 },

    { "kind": "noiseVoice", "id": "tick", "noiseType": "pink", "duration": 0.018, "gain": 0.18, "stopAfter": 0.028 },

    { "kind": "filter", "id": "bp", "filterType": "bandpass", "freqHz": { "kind": "var", "name": "bp0" }, "q": { "kind": "var", "name": "q" } },
    { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": { "kind": "var", "name": "lp" }, "q": 0.8 }
  ],
  "edges": [
    { "from": "tone", "to": "bp" },
    { "from": "partial", "to": "bp" },
    { "from": "tick", "to": "bp" },
    { "from": "bp", "to": "lp" },
    { "from": "lp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "tone", "attack": 0.0008, "release": { "kind": "var", "name": "ring" }, "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "partial", "attack": 0.001, "release": { "kind": "var", "name": "ring" }, "peak": 0.65, "at": 0 },

    { "kind": "freqDrop", "node": "tone", "startHz": { "kind": "var", "name": "start" }, "endHz": { "kind": "var", "name": "end" }, "duration": { "kind": "var", "name": "glide" }, "at": 0 },
    { "kind": "freqDrop", "node": "partial", "startHz": { "kind": "var", "name": "harm" }, "endHz": { "kind": "var", "name": "harmEnd" }, "duration": { "kind": "var", "name": "glide" }, "at": 0 },

    { "kind": "envAR", "node": "tick", "attack": 0.0005, "release": 0.018, "peak": 1.0, "at": 0 },

    { "kind": "freqDrop", "node": "bp", "startHz": 3200, "endHz": 1100, "duration": 0.06, "at": 0 },
    { "kind": "freqDrop", "node": "lp", "startHz": 6500, "endHz": { "kind": "var", "name": "lp" }, "duration": 0.07, "at": 0 }
  ]
}
```

## Demo UI

```js
let mouseDownLeft = false;
let widgets = null;
```

```js on:init
term.layerID = 'default';

// Initialize retained-mode GUI
gui.init();

const title = gui.createLabel({
  bounds: { x: 20, y: 20, width: 1000, height: 30 },
  text: 'STFXR: water_drop (synthetic drip / plink)',
  align: 'left'
});

const info = gui.createLabel({
  bounds: { x: 20, y: 50, width: 1000, height: 24 },
  text: `Seed: ${stfxrSeed}   (click a button to unlock audio if needed)`,
  align: 'left'
});

const vol = gui.createSlider({
  bounds: { x: 20, y: 80, width: 420, height: 44 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 65
});

const btnPlay = gui.createButton({
  bounds: { x: 460, y: 80, width: 240, height: 44 },
  label: 'Play water_drop'
});

const btnRandomize = gui.createButton({
  bounds: { x: 720, y: 80, width: 240, height: 44 },
  label: 'Randomize Seed'
});

const status = gui.createLabel({
  bounds: { x: 20, y: 130, width: 1200, height: 24 },
  text: 'Click Play to audition the drop.',
  align: 'left'
});

widgets = { title, info, vol, btnPlay, btnRandomize, status };

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

if (widgets.btnRandomize.wasClicked()) {
  stfxrSeed = random.seed();
  widgets.info.setText(`Seed: ${stfxrSeed}   (click a button to unlock audio if needed)`);
}

if (widgets.btnPlay.wasClicked()) {
  stfxr.play('water_drop', stfxrSeed, { volume });
  widgets.status.setText(`Played: water_drop (seed ${stfxrSeed})  (volume ${Math.round(volume * 100)}%)`);
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();
```