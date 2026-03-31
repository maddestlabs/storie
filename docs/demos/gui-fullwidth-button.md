---
name: "GUI Full-Width Button"
theme: "nord"
---

A minimal retained-mode GUI demo: **one button** (no containers) that is re-sized every frame to span the **full canvas width**.

```js on:init
term.layerID = 'default';
gui.init();

scope.btn = gui.createButton({
  bounds: { x: 0, y: 0, width: 100, height: 56 },
  label: 'Full-width GUI button'
});
scope.mouseDownLeft = false;
```

```js on:input
if (!event) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl:  (event.mods || []).includes('ctrl'),
    alt:   (event.mods || []).includes('alt'),
    meta:  (event.mods || []).includes('meta')
  });
}
if (event.type === 'text') gui.handleText(event.text);

if (event.type === 'mouse') {
  if (event.button === 'left') {
    scope.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, scope.mouseDownLeft);
}
if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, scope.mouseDownLeft);
}
```

```js on:update
// ui.metrics.canvasWidth/Height are live device-pixel canvas dimensions —
// the same source shader-graph.md uses for all its layout (graphBounds()).
var W = ui.metrics.canvasWidth  || 800;
var H = ui.metrics.canvasHeight || 600;

if (scope.btn) {
  scope.btn.setBounds({ x: 0, y: 0, width: W, height: 56 });
  scope.btn.setLabel('W=' + W + ' H=' + H);
}

gui.update(getMouseX(), getMouseY(), scope.mouseDownLeft);
```

```js on:render
var base = getStyle('default');
ui.clear(base.bg);
term.layerID = 'default';
term.clear();

gui.render(ui);
```
