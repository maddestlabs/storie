---
title: "impress.js Recreation"
theme: "saintbilly"
---

```javascript
const slideRule = { scope: 'global', levels: 1, includeHidden: false };
let slideFill = 0.76;

function applySlideStyle() {
  worlds.config.setDefaults({
    sectionBorderEnabled: false,
    sectionBackground: 0x00000000,
    sectionRender: 'content',
    sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.003;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',
  });
}

function getSlides() {
  return worlds.nav.list(slideRule);
}

function gotoSlide(index) {
  applySlideStyle();
  const slides = getSlides();
  if (slides.length === 0) return;
  const nextIndex = Math.max(0, Math.min(slides.length - 1, Math.floor(index)));
  worlds.camera.focusOnSectionFit(slides[nextIndex], slideFill, { keepRotation: true });
}

function nextSlide() {
  const cursor = worlds.nav.cursor(slideRule);
  gotoSlide((cursor ?? -1) + 1);
}

function prevSlide() {
  const cursor = worlds.nav.cursor(slideRule);
  gotoSlide((cursor ?? 1) - 1);
}

function gotoOverview() {
  applySlideStyle();
  worlds.camera.birdsEye({
    fill: Math.max(0.9, slideFill),
    padding: 60,
    pitch: 0.38,
  });
}
```

```javascript on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.links.setKeyHandlingEnabled(false);
worlds.config.setDefaults({
  sectionOverflow: 'fit-y',
  defaultSectionWidth: 20,
  defaultSectionHeight: 18,
  sectionClickFocusEnabled: true,
  sectionBorderEnabled: false,
  sectionBackground: 0x00000000,
  sectionRender: 'content',
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
});

applySlideStyle();

worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setFOV(Math.PI / 3.6);
worlds.camera.setEaseSpeed(0.10, 0.16);

if (worlds.nav.count(slideRule) > 0) {
  gotoSlide(0);
}
```

```javascript on:input
return true;
```

```javascript on:update
const shiftHeld = key.down('Shift') || key.down('ShiftLeft') || key.down('ShiftRight');
const shiftSpace = key.pressed(' ') && shiftHeld;

const next = !shiftSpace && (
  key.pressed(' ') ||
  key.pressed('PageDown') ||
  key.pressed('ArrowRight') ||
  key.pressed('ArrowDown') ||
  key.pressed('n') ||
  key.pressed('N')
);

const prev = shiftSpace ||
  key.pressed('PageUp') ||
  key.pressed('ArrowLeft') ||
  key.pressed('ArrowUp') ||
  key.pressed('p') ||
  key.pressed('P');

if (next && !prev) nextSlide();
if (prev && !next) prevSlide();

if (key.pressed('Home')) gotoSlide(0);
if (key.pressed('End')) gotoOverview();
if (key.pressed('o') || key.pressed('O')) gotoOverview();

if (key.pressed('+') || key.pressed('=')) {
  slideFill = Math.max(0.58, Math.min(0.92, slideFill + 0.02));
  gotoSlide(worlds.nav.cursor(slideRule) ?? 0);
}

if (key.pressed('-') || key.pressed('_')) {
  slideFill = Math.max(0.58, Math.min(0.92, slideFill - 0.02));
  gotoSlide(worlds.nav.cursor(slideRule) ?? 0);
}
```

# Bored {"x":"-23","y":"-35"}

This is a **Storie Worlds recreation** of the classic impress.js core demo.

The point here is not to clone the original HTML and CSS line for line. The point is to prove that markdown sections plus authored transform metadata are enough to recreate the same presentation model:

- large infinite canvas
- 2D and 3D rotation
- per-step scale
- camera travel between authored positions

# Title {"x":"0","y":"0","scale":"4"}

then you should try

## Storie Worlds

This step mirrors the big center-title moment from the original demo.

The section itself is just markdown. The authored metadata carries the spatial weight.

# Its {"x":"20","y":"69","rotate-z":"90","scale":"5"}

It is a presentation tool inspired by the same idea as impress.js, but authored through **sections** instead of freeform HTML steps.

In Storie, the transform lives beside the heading:

`{"x":850,"y":3000,"rotate-z":90,"scale":5}`

# Big {"x":"81","y":"48","rotate-z":"180","scale":"6"}

visualize your **big** thoughts

This is the same move as the original: bigger scale, farther away on the canvas, and rotated so the camera has to swing around to meet it.

# Tiny {"x":"66","y":"54","z":"-69","rotate-z":"300"}

and **tiny** ideas

This step is where the original demo pushes into depth. Worlds handles the same authored `z` offset directly in section metadata.

# Ing {"x":"81","y":"-20","rotate-z":"270","scale":"6"}

presentations are no longer trapped in a flat stack.

Rotate the section, move it across the canvas, and let the engine do the camera work.

# Imagination {"x":"154","y":"-7","scale":"6"}

the only limit is your **imagination**

This step exists mostly to prove scale and long-distance navigation still read cleanly in the Worlds model.

# Source {"x":"145","y":"46","rotate-z":"20","scale":"4"}

want to know more?

The original impress.js demo points people back to the source. This recreation points back to the Storie demo model instead: sections, metadata, and Worlds navigation.

# One More Thing {"x":"138","y":"92","scale":"2"}

one more thing...

The final stretch in the original demo uses the same layout grammar and then escalates into 3D rotation.

# Its In 3D {"x":"143","y":"99","z":"-2","rotate-x":"-40","rotate-y":"10","scale":"2"}

have you noticed?

## it is in 3D

This is the key validation point for Worlds. The step uses:

- `z` depth
- `rotate-x`
- `rotate-y`
- `scale`

and Storie still computes a usable camera framing automatically.

# Overview {"x":"69","y":"35","z":"0","scale":"4","width":"180","height":"120","render":"none","opacity":"0","interactive":"false"}

```javascript on:enter
gotoOverview();
```

This slide is intentionally invisible.

It acts like the classic impress.js overview step: a very large framing target positioned over the scene so the camera zooms out and shows the whole layout.

Use `Home` to return to the first slide, or click a card to focus it again.

- [Back to Bored](#bored)