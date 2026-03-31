---
title: "SVG Import: {{SVG_FILENAME}}"
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
  sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.008;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',
});

```

<!-- SVG_TO_WORLDS_SECTIONS -->
