---
title: "SVG Import: demo.svg"
theme: "saintbilly"
---

```js on:init
worlds.presets.apply('story-editor');
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
worlds.config.setDefaults({
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionListMarker: '-',
  sectionListMarkerGapPx: 12,
  sectionListHangIndentPx: 24,
  sectionBorderEnabled: false,
  sectionRender: 'content',
  sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.003;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',
});

```

# text1 {x: 11.288, y: -7.148}
This is a test

# text2 {x: 10.593, y: -20.174}
Section 2 Here

# text3 {x: 35.262, y: -27.036, rotate-z: 90}
And rotated
Section 3
