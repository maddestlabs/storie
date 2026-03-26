---
title: "Worlds + Section GUI"
theme: "neotopia"
---

# Worlds Section GUI {"x":"0","y":"0","z":"0"}

This demo shows **GUI panels that are attached to a Worlds section**.

- The panel renders *inside* the section bounds.
- The panel moves/scales/rotates with the section during navigation transitions.
- Buttons remain clickable because hit-testing is remapped into section-local space.

- [Go to Flat Panel](#flat-panel)
- [Go to Rotated Panel](#rotated-panel)
- [Go to Scaled Panel](#scaled-panel)

```javascript on:init
worlds.enable();
worlds.config.setDefaults({ sectionGuiMode: 'baked' });
worlds.camera.setPosition(0, 0, 240);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.10, 0.14);

// Start focused so section-bound GUI is visible immediately.
worlds.camera.focusOnSection(1, 90);

// Retained-mode GUI
gui.init({ boundsSpace: 'device' });
```

```javascript
// Helpers must be defined in a plain JS fence so they exist
// when section on:render handlers execute.

var sectionGuiDemo = {
  clicks: 0,
  widgets: null,
};

function ensureSectionGuiWidgets() {
  if (sectionGuiDemo.widgets || typeof gui === 'undefined' || typeof gui.section !== 'function') return sectionGuiDemo.widgets;

  var group = 'sectionGuiDemo';
  // Create widgets inside a section-scoped group. Binding happens per-section.
  // Note: some runtimes can't resolve 'current', so callers should pass explicit indices.
  gui.section(0, { group: group, clearFocusOnHide: true });

  var title = gui.createLabel({
    align: 'left',
    focusable: false,
    group: group,
    boundsSpace: 'worldsSection',
    bounds: { x: 0, y: 0, width: 360, height: 30 },
    text: 'Section GUI'
  });

  var primary = gui.createButton({
    group: group,
    boundsSpace: 'worldsSection',
    bounds: { x: 0, y: 0, width: 240, height: 44 },
    label: 'Ping'
  });

  var next = gui.createButton({
    group: group,
    boundsSpace: 'worldsSection',
    bounds: { x: 0, y: 0, width: 240, height: 44 },
    label: 'Next'
  });

  var status = gui.createLabel({
    align: 'left',
    focusable: false,
    group: group,
    boundsSpace: 'worldsSection',
    bounds: { x: 0, y: 0, width: 420, height: 30 },
    text: 'Clicks: 0'
  });

  sectionGuiDemo.widgets = { group: group, title: title, primary: primary, next: next, status: status };
  return sectionGuiDemo.widgets;
}

function layoutSectionGui(bounds) {
  var w = ensureSectionGuiWidgets();
  if (!w) return;

  var x = Math.floor(bounds.x);
  var y = Math.floor(bounds.y);
  var width = Math.floor(bounds.width);
  var line = 34;
  var gap = 10;

  w.title.setBounds({ x: x, y: y, width: width, height: line });
  w.primary.setBounds({ x: x, y: y + line + gap, width: Math.min(240, width), height: 44 });
  w.next.setBounds({ x: x, y: y + line + gap + 44 + gap, width: Math.min(240, width), height: 44 });
  w.status.setBounds({ x: x, y: y + line + gap + 44 + gap + 44 + gap, width: width, height: line });
}
```

# Flat Panel {"x":"0","y":"0","z":"0","rotate-y":"0"}

This section has a simple attached panel at the top-left.

```javascript on:enter
// In docs preview, worlds.section may be undefined; focus by known index.
worlds.camera.focusOnSection(1, 90);
```

```javascript on:render
var w = ensureSectionGuiWidgets();
if (w) {
  gui.section(1, { group: w.group, clearFocusOnHide: true });

  // Keep the per-section GUI bounds consistent across sections.
  w.title.setText('Flat Panel');
  layoutSectionGui({ x: 0, y: 0, width: 420, height: 170 });

  if (w.primary.wasClicked()) {
    sectionGuiDemo.clicks++;
    w.status.setText('Clicks: ' + sectionGuiDemo.clicks);
    console.log('Ping (Flat Panel)');
  }

  if (w.next.wasClicked()) {
    worlds.nav.goto(2);
  }
}
```

# Rotated Panel {"x":"70","y":"0","z":"0","rotate-y":"30"}

This section rotates in 3D; the GUI should stay glued to it.

```javascript on:enter
worlds.camera.focusOnSection(2, 100);
```

```javascript on:render
var w = ensureSectionGuiWidgets();
if (w) {
  gui.section(2, { group: w.group, clearFocusOnHide: true });

  w.title.setText('Rotated Panel');
  w.next.setLabel('Next');
  layoutSectionGui({ x: 0, y: 0, width: 420, height: 170 });

  w.primary.setLabel('Back');
  if (w.primary.wasClicked()) {
    worlds.nav.goto(1);
  }

  if (w.next.wasClicked()) {
    worlds.nav.goto(3);
  }
}
```

# Scaled Panel {"x":"0","y":"45","z":"-40","rotate-x":"15","rotate-y":"-20","scale":"1.15"}

This section is rotated and scaled.

```javascript on:enter
worlds.camera.focusOnSection(3, 110);
```

```javascript on:render
var w = ensureSectionGuiWidgets();
if (w) {
  gui.section(3, { group: w.group, clearFocusOnHide: true });

  w.title.setText('Scaled Panel');
  w.primary.setLabel('Back');
  w.next.setLabel('Console');
  // Offset the panel so it's clearly visible below the section header text.
  layoutSectionGui({ x: 0, y: 44, width: 420, height: 170 });

  if (w.primary.wasClicked()) {
    worlds.nav.goto(2);
  }

  if (w.next.wasClicked()) {
    console.log('Hello from section GUI');
  }
}
```
