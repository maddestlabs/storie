---
title: "Worlds Borders"
theme: "saintbilly"
font: "Rye"
---

```javascript on:init
const deg = d => d * Math.PI / 180;

worlds.enable();
worlds.controls.setEnabled(true);
worlds.config.setDefaults({
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionContentAlign: 'start',
  sectionRender: 'all',
  defaultSectionWidth: 420,
  defaultSectionHeight: 240,
  autoLayoutEnabled: false,
  sectionBorderEnabled: true,
  sectionBorderWidth: 2,
  sectionBorder: {
    kind: 'image9',
    source: 'assets/img/borders/1210514.svg',
    cuts: { left: 34, right: 1103, top: 34, bottom: 1673 },
    edgeMode: {
      top: 'tile',
      right: 'tile',
      bottom: 'tile',
      left: 'tile',
    },
    scale: 0.22,
    opacity: 0.46,
  },
  sectionBackground: 'texture:assets/img/paper_crumpled.jpg;tilePx=400;contentDistort=0.004;paperPlaneZ=focus',
});

worlds.camera.setPosition(0, 20, 310);
worlds.camera.setRotation(deg(-8), deg(2), 0);
worlds.camera.setFOV(deg(42));
worlds.camera.setEaseSpeed(0.16, 0.12);
worlds.camera.focusOnSectionFit('Worlds Borders Showcase', 0.9, { keepRotation: true });
```

# Worlds Borders Showcase {"x":"0","y":"0","z":"0","width":"540","height":"260","render":"all"}

This demo isolates the new `sectionBorder` feature in Worlds.

What it is showing:

- One SVG source reused across several section sizes.
- Nine-slice cuts keep the corners stable while edges tile.
- The decorative border sits on top of the regular section background.
- Individual sections can override the default border with a different SVG and slice setup.

- [Small card](#small-card)
- [Wide ledger](#wide-ledger)
- [Tall notice](#tall-notice)
- [Dense notes](#dense-notes)
- [Config](#border-config)

# Small Card {"x":"-170","y":"90","z":"-130","rotate-y":"11","width":"300","height":"170"}

This is the compact case.

The corners stay legible even when the content box gets tight, because the border thickness is derived from the source corners instead of scaling the whole SVG uniformly.

This demo uses a deliberately stronger scale than a subtle production frame so the decorative motif reads clearly.

- [Back to intro](#worlds-borders-showcase)
- [Wide ledger](#wide-ledger)

# Wide Ledger {"x":"190","y":"92","z":"-170","rotate-y":"-14","width":"640","height":"170","border":{"kind":"image9","source":"assets/img/borders/32831.svg","cuts":{"left":74,"right":7006,"top":74,"bottom":12726},"edgeMode":"tile","scale":0.06,"opacity":0.42}}

This is the wide case.

The edge band tiles along the long horizontal run while the corner ornaments keep their original silhouette.

This card overrides the document default and pulls from a second SVG border source.

- [Back to intro](#worlds-borders-showcase)
- [Tall notice](#tall-notice)

# Tall Notice {"x":"-185","y":"-92","z":"-240","rotate-y":"13","width":"270","height":"380"}

This is the tall case.

The same source art still works without needing a second asset for portrait-oriented sections.

- [Back to intro](#worlds-borders-showcase)
- [Dense notes](#dense-notes)

# Dense Notes {"x":"195","y":"-105","z":"-280","rotate-y":"-10","width":"440","height":"320","sectionBorder":{"kind":"image9","source":"assets/img/borders/33264.svg","cuts":{"left":68,"right":12732,"top":68,"bottom":9188},"edgeMode":{"top":"tile","right":"stretch","bottom":"tile","left":"stretch"},"scale":0.045,"opacity":0.36}}

The border is drawn over an ordinary paper-texture card.

That means the feature composes with the existing section background system rather than replacing it.

This one uses `sectionBorder` instead of `border`, which resolves the same override path.

Practical tuning knobs:

- `cuts` decides where the fixed corners end and the resizable edge band begins.
- `scale` controls destination border thickness.
- `opacity` lets the art read as a subtle frame instead of a heavy black box.

- [Back to intro](#worlds-borders-showcase)
- [Config](#border-config)

# Border Config {"x":"0","y":"-205","z":"-360","rotate-x":"8","width":"560","height":"250"}

The demo is using this config shape:

```javascript
worlds.config.setDefaults({
  sectionBorderEnabled: true,
  sectionBorder: {
    kind: 'image9',
    source: 'assets/img/borders/1210514.svg',
    cuts: { left: 34, right: 1103, top: 34, bottom: 1673 },
    edgeMode: {
      top: 'tile',
      right: 'tile',
      bottom: 'tile',
      left: 'tile',
    },
    scale: 0.22,
    opacity: 0.46,
  },
});
```

Sections can override that default inline:

```markdown
# Wide Ledger {"border":{"kind":"image9","source":"assets/img/borders/32831.svg","cuts":{"left":74,"right":7006,"top":74,"bottom":12726},"edgeMode":"tile","scale":0.06,"opacity":0.42}}

# Dense Notes {"sectionBorder":{"kind":"image9","source":"assets/img/borders/33264.svg","cuts":{"left":68,"right":12732,"top":68,"bottom":9188},"edgeMode":{"top":"tile","right":"stretch","bottom":"tile","left":"stretch"},"scale":0.045,"opacity":0.36}}
```

The SVG itself now lives under `docs/assets/img/borders/` so demos and documentation can reference the same asset path.

- [Back to intro](#worlds-borders-showcase)