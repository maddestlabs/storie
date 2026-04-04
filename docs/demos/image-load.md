---
title: "Image Load Test"
author: "Maddest Labs"
theme: "default"
---

```js on:init
scope.imgId   = null;
scope.imgW    = 0;
scope.imgH    = 0;
scope.status  = 'loading…';

console.log('[image-load] calling ui.loadImageFromURL…');
console.log('[image-load] typeof ui.loadImageFromURL =', typeof ui.loadImageFromURL);
console.log('[image-load] typeof ui.getImageSize =', typeof ui.getImageSize);

ui.loadImageFromURL('assets/img/paper_seamless_texture_3197.jpg').then(function(id) {
  console.log('[image-load] result id =', id);
  if (!id) {
    scope.status = 'FAILED: loadImageFromURL returned null';
    return;
  }
  var sz = ui.getImageSize(id);
  console.log('[image-load] getImageSize =', sz);
  scope.imgId  = id;
  scope.imgW   = sz ? sz.width  : 0;
  scope.imgH   = sz ? sz.height : 0;
  scope.status = sz
    ? 'OK: ' + sz.width + 'x' + sz.height
    : 'WARN: loaded but getImageSize returned null';
}).catch(function(err) {
  console.error('[image-load] error:', err);
  scope.status = 'ERROR: ' + String(err);
});
```

```js on:render
ui.clear();
var W = ui.metrics.canvasWidth  || 800;
var H = ui.metrics.canvasHeight || 600;

var cw = ui.metrics.charWidth  || 9;
var ch = ui.metrics.charHeight || 18;

// Status text
ui.text('Status: ' + scope.status, cw, ch, 0xFFFFFFFF);

// If loaded – draw the image stretched to fill the canvas, then again at native size
if (scope.imgId && scope.imgW > 0 && scope.imgH > 0) {
  // Full-canvas stretch
  ui.image(scope.imgId, 0, ch * 2, W, H - ch * 2);

  ui.text('(full-stretch below, native 200x200 inset top-right)', cw, ch * 2 - 2, 0xAAAAAAFF);

  // Native-size inset (capped at 200px)
  var iw = Math.min(200, scope.imgW);
  var ih = Math.min(200, scope.imgH);
  ui.image(scope.imgId, W - iw - cw, ch * 3, iw, ih);
} else {
  ui.text('(waiting for image…)', cw, ch * 3, 0x888888FF);
}
```
