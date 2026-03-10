---
name: "STFXR: Splash"
theme: "neotopia"
stfxrSeed: 1337
---

A minimal demo of a synthetic **water splash** sound built with `stfxr` graphs.

- Click **Play water_splash** to audition
- Click **Randomize Seed** to get small variations

## Preset

```stfxr name:water_splash seed:1337
{
  "vars": {
    "burst": { "kind": "rand", "min": 0.03, "max": 0.07 },
    "wash":  { "kind": "rand", "min": 0.12, "max": 0.22 },

    "body":  { "kind": "rand", "min": 0.18, "max": 0.32 },

    "plop0": { "kind": "rand", "min": 260, "max": 480 },
    "plop1": { "kind": "rand", "min": 90,  "max": 160 },

    "hp0":   { "kind": "rand", "min": 520,  "max": 1800 },
    "hp1":   { "kind": "rand", "min": 220,  "max": 1200 },

    "bpStart": { "kind": "rand", "min": 260,  "max": 720 },
    "bp0":   { "kind": "rand", "min": 650,  "max": 2400 },
    "q":     { "kind": "rand", "min": 0.45, "max": 1.25 },

    "lp0":   { "kind": "rand", "min": 5200, "max": 11000 },
    "lp1":   { "kind": "rand", "min": 900,  "max": 2600 },

    "apBase":  { "kind": "rand", "min": 520,  "max": 1200 },
    "apDepth": { "kind": "rand", "min": 140,  "max": 360 },
    "apQ":     { "kind": "rand", "min": 0.45, "max": 1.05 },
    "apRate":  { "kind": "rand", "min": 0.18, "max": 0.55 },

    "wet":   { "kind": "rand", "min": 0.26, "max": 0.44 },
    "dry":   { "kind": "rand", "min": 0.58, "max": 0.78 },

    "panDepth": { "kind": "rand", "min": 0.05, "max": 0.14 },
    "panRate":  { "kind": "rand", "min": 0.18, "max": 0.38 }
  },

  "nodes": [
    { "kind": "noiseVoice", "id": "burst", "noiseType": "white", "duration": { "kind": "var", "name": "burst" }, "gain": 0.50, "stopAfter": 0.12 },
    { "kind": "noiseVoice", "id": "wash",  "noiseType": "pink",  "duration": { "kind": "var", "name": "wash" },  "gain": 0.30, "stopAfter": 0.32 },
    { "kind": "noiseVoice", "id": "body",  "noiseType": "brown", "duration": { "kind": "var", "name": "body" },  "gain": 0.18, "stopAfter": 0.45 },
    { "kind": "oscVoice",   "id": "plop",  "oscType": "sine", "freqHz": { "kind": "var", "name": "plop0" }, "gain": 0.22, "stopAfter": 0.22 },

    { "kind": "filter", "id": "hp", "filterType": "highpass", "freqHz": { "kind": "var", "name": "hp0" }, "q": 0.7 },
    { "kind": "filter", "id": "bp", "filterType": "bandpass", "freqHz": { "kind": "var", "name": "bp0" }, "q": { "kind": "var", "name": "q" } },
    { "kind": "filter", "id": "lp", "filterType": "lowpass",  "freqHz": { "kind": "var", "name": "lp0" }, "q": 0.9 },

    { "kind": "filter", "id": "plopLP", "filterType": "lowpass", "freqHz": 1100, "q": 0.8 },

    { "kind": "lfo", "id": "apLfo", "oscType": "sine", "freqHz": { "kind": "var", "name": "apRate" }, "gain": { "kind": "var", "name": "apDepth" }, "stopAfter": 0.35 },
    { "kind": "filter", "id": "ap1", "filterType": "allpass", "freqHz": { "kind": "var", "name": "apBase" }, "q": { "kind": "var", "name": "apQ" } },
    { "kind": "filter", "id": "ap2", "filterType": "allpass", "freqHz": { "kind": "var", "name": "apBase" }, "q": { "kind": "var", "name": "apQ" } },
    { "kind": "filter", "id": "ap3", "filterType": "allpass", "freqHz": { "kind": "var", "name": "apBase" }, "q": { "kind": "var", "name": "apQ" } },

    { "kind": "convolver", "id": "room", "impulseType": "brown", "seconds": 0.28, "decay": 5.5, "normalize": 1 },
    { "kind": "delay", "id": "preDelay", "delayTime": 0.018, "maxDelayTime": 0.05 },
    { "kind": "gain", "id": "wet", "gain": { "kind": "var", "name": "wet" } },
    { "kind": "gain", "id": "dry", "gain": { "kind": "var", "name": "dry" } },

    { "kind": "compressor", "id": "comp", "threshold": -18, "knee": 18, "ratio": 3.2, "attack": 0.002, "release": 0.14 },

    { "kind": "lfo", "id": "panLfo", "oscType": "sine", "freqHz": { "kind": "var", "name": "panRate" }, "gain": { "kind": "var", "name": "panDepth" }, "stopAfter": 0.35 },
    { "kind": "stereoPanner", "id": "pan", "pan": 0 }
  ],

  "edges": [
    { "from": "burst", "to": "hp" },
    { "from": "wash",  "to": "hp" },
    { "from": "body",  "to": "hp" },
    { "from": "hp",    "to": "bp" },
    { "from": "bp",    "to": "lp" },

    { "from": "plop",  "to": "plopLP" },

    { "from": "lp",    "to": "dry" },
    { "from": "plopLP", "to": "dry" },

    { "from": "lp",    "to": "ap1" },
    { "from": "ap1",   "to": "ap2" },
    { "from": "ap2",   "to": "ap3" },
    { "from": "ap3",   "to": "room" },
    { "from": "room",  "to": "preDelay" },
    { "from": "preDelay",  "to": "wet" },
    { "from": "wet",   "to": "pan" },
    { "from": "pan",   "to": "comp" },

    { "from": "dry",   "to": "comp" },
    { "from": "comp",  "to": "out" },

    { "from": "apLfo", "to": "ap1.frequency" },
    { "from": "apLfo", "to": "ap2.frequency" },
    { "from": "apLfo", "to": "ap3.frequency" },
    { "from": "panLfo", "to": "pan.pan" }
  ],

  "events": [
    { "kind": "envAR", "node": "burst", "attack": 0.0008, "release": { "kind": "var", "name": "burst" }, "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "wash",  "attack": 0.002,  "release": { "kind": "var", "name": "wash" },  "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "body",  "attack": 0.004,  "release": { "kind": "var", "name": "body" },  "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "plop",  "attack": 0.0012, "release": 0.10, "peak": 1.0, "at": 0 },
    { "kind": "freqDrop", "node": "plop", "startHz": { "kind": "var", "name": "plop0" }, "endHz": { "kind": "var", "name": "plop1" }, "duration": 0.085, "at": 0 },

    { "kind": "freqDrop", "node": "bp", "startHz": { "kind": "var", "name": "bpStart" }, "endHz": { "kind": "var", "name": "bp0" }, "duration": 0.16, "at": 0 },
    { "kind": "freqDrop", "node": "lp", "startHz": { "kind": "var", "name": "lp1" }, "endHz": { "kind": "var", "name": "lp0" }, "duration": 0.16, "at": 0 },
    { "kind": "freqDrop", "node": "hp", "startHz": { "kind": "var", "name": "hp1" }, "endHz": { "kind": "var", "name": "hp0" }, "duration": 0.16, "at": 0 }
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
  text: 'STFXR: water_splash (synthetic splash / burst)',
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
  value: 70
});

const btnPlay = gui.createButton({
  bounds: { x: 460, y: 80, width: 240, height: 44 },
  label: 'Play water_splash'
});

const btnRandomize = gui.createButton({
  bounds: { x: 720, y: 80, width: 240, height: 44 },
  label: 'Randomize Seed'
});

const status = gui.createLabel({
  bounds: { x: 20, y: 130, width: 1200, height: 24 },
  text: 'Click Play to audition the splash.',
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
  stfxr.play('water_splash', stfxrSeed, { volume });
  widgets.status.setText(`Played: water_splash (seed ${stfxrSeed})  (volume ${Math.round(volume * 100)}%)`);
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();
```
