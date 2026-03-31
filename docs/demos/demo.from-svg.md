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
# This {x: 7.642, y: -7.295}
This is a test

# Section 2 {x: 6.947, y: -20.321}
Here

# And rotated {x: 33.529, y: -29.901, rotate-z: 90}
Section 3
