---
name: "Audio SFX Presets (Seeded)"
theme: "neonopia"
sfxSeed: 1337
---

A tiny demo of Storie’s seeded, chiptone-style SFX presets.

- Click any button to play a sound.
- The same preset + seed should sound the same each time on the same device.

## Game Code

```js
let mouseDownLeft = false;
let widgets = null;

let lastPlayed = '';
let lastSnippet = '';
```

```js on:init
term.layerID = 'default';

// Override frontmatter seed with URL param if provided (e.g. ?seed=42)
sfxSeed = getParam('seed', sfxSeed);

// Initialize retained-mode GUI
gui.init();

const title = gui.createLabel({
  bounds: { x: 20, y: 20, width: 640, height: 30 },
  text: 'Seeded SFX Presets (Coin/Zap/Boom/Jump/1UP/Lose/Hurt/Blip)',
  align: 'left'
});

const info = gui.createLabel({
  bounds: { x: 20, y: 50, width: 640, height: 24 },
  text: `Seed: ${sfxSeed}   (click buttons to unlock audio if needed)`,
  align: 'left'
});

const btnRandomize = gui.createButton({
  bounds: { x: 460, y: 80, width: 220, height: 44 },
  label: 'Randomize Seed'
});

const vol = gui.createSlider({
  bounds: { x: 20, y: 80, width: 420, height: 44 },
  label: 'Volume',
  min: 0,
  max: 100,
  value: 60
});

const status = gui.createLabel({
  bounds: { x: 20, y: 130, width: 640, height: 24 },
  text: 'Last: (none)',
  align: 'left'
});

const snippet = gui.createLabel({
  bounds: { x: 20, y: 155, width: 900, height: 24 },
  text: 'Snippet: (none)',
  align: 'left'
});

// Button grid (2 columns x 4 rows)
const x0 = 20;
const y0 = 190;
const w = 220;
const h = 44;
const gapX = 14;
const gapY = 12;

const btnCoin = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 0, width: w, height: h }, label: 'Coin' });
const btnZap  = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 0, width: w, height: h }, label: 'Zap' });

const btnBoom = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 1, width: w, height: h }, label: 'Boom' });
const btnJump = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 1, width: w, height: h }, label: 'Jump' });

const btn1Up  = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 2, width: w, height: h }, label: '1UP' });
const btnLose = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 2, width: w, height: h }, label: 'Lose' });

const btnHurt = gui.createButton({ bounds: { x: x0, y: y0 + (h + gapY) * 3, width: w, height: h }, label: 'Hurt' });
const btnBlip = gui.createButton({ bounds: { x: x0 + w + gapX, y: y0 + (h + gapY) * 3, width: w, height: h }, label: 'Blip' });

widgets = {
  title,
  info,
  btnRandomize,
  vol,
  status,
  snippet,
  btnCoin,
  btnZap,
  btnBoom,
  btnJump,
  btn1Up,
  btnLose,
  btnHurt,
  btnBlip
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

if (widgets.btnRandomize.wasClicked()) {
  sfxSeed = random.seed();
  widgets.info.setText(`Seed: ${sfxSeed}   (click buttons to unlock audio if needed)`);
  //setSeedInUrl(sfxSeed);
}

const trigger = (name) => {
  audio.sfx.play(name, sfxSeed, { volume });
  lastPlayed = name;
  lastSnippet = audio.sfx.snippet(name, sfxSeed, Number(volume.toFixed(2)));
  widgets.status.setText(`Last: ${name}  (volume ${Math.round(volume * 100)}%)`);
  widgets.snippet.setText(`Snippet: ${lastSnippet}`);
};

if (widgets.btnCoin.wasClicked()) trigger('coin');
if (widgets.btnZap.wasClicked()) trigger('zap');
if (widgets.btnBoom.wasClicked()) trigger('boom');
if (widgets.btnJump.wasClicked()) trigger('jump');
if (widgets.btn1Up.wasClicked()) trigger('1up');
if (widgets.btnLose.wasClicked()) trigger('lose');
if (widgets.btnHurt.wasClicked()) trigger('hurt');
if (widgets.btnBlip.wasClicked()) trigger('blip');
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

// Keep terminal quiet so the GUI is the focus.
term.layerID = 'default';
term.clear();
```
