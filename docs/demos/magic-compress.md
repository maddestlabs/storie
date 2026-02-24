---
name: "Magic Crush (Storie)"
theme: "neonopia"
---

A tiny front-end helper for generating **magic block** payloads.

- Paste any text/markdown into the editor
- Click **Compress →**
- Copy the generated `magic` block into your document

## Demo Code

```js
let widgets = null;
let mouseDownLeft = false;

let statusText = 'Paste content and click Compress →';
let busy = false;

function wrapBase64(s, width = 76) {
  const out = [];
  for (let i = 0; i < s.length; i += width) out.push(s.slice(i, i + width));
  return out.join('\n');
}

function compressDeflateRawBase64(text) {
  return (async () => {
    if (typeof CompressionStream !== 'function') {
      throw new Error('CompressionStream is not available in this runtime');
    }

    const encoder = new TextEncoder();
    const inputBytes = encoder.encode(text);

    // Preferred: raw DEFLATE (RFC 1951) to match Storie magic blocks.
    // Fallback: zlib-wrapped DEFLATE (RFC 1950) and strip header+adler32.
    let compressedBytes = null;
    let method = 'deflate-raw';

    try {
      const stream = new Response(inputBytes).body
        .pipeThrough(new CompressionStream('deflate-raw'));
      const compressedBuf = await new Response(stream).arrayBuffer();
      compressedBytes = new Uint8Array(compressedBuf);
    } catch (err) {
      method = 'deflate(strip-zlib)';
      const stream = new Response(inputBytes).body
        .pipeThrough(new CompressionStream('deflate'));
      const zlibBuf = await new Response(stream).arrayBuffer();
      const z = new Uint8Array(zlibBuf);
      if (z.length < 6) {
        throw new Error('Deflate output too small to be valid zlib');
      }
      // Strip: [CMF, FLG] ...DEFLATE... [ADLER32 x4]
      compressedBytes = z.subarray(2, z.length - 4);
    }

    let binary = '';
    for (let i = 0; i < compressedBytes.length; i++) {
      binary += String.fromCharCode(compressedBytes[i]);
    }

    return {
      base64: btoa(binary),
      inputBytes: inputBytes.length,
      compressedBytes: compressedBytes.length,
      method
    };
  })();
}

function setStatus(text) {
  scope.statusText = String(text);
  const w = scope.widgets;
  if (w?.status) w.status.setText(`Status: ${scope.statusText}`);
}

function runCompress() {
  const w = scope.widgets;
  if (!w || scope.busy) return;

  const input = String(w.input.getValue() || '');
  if (!input.trim()) {
    w.output.setValue('');
    setStatus('Nothing to compress (input is empty).');
    return;
  }

  scope.busy = true;
  setStatus('Compressing…');

  compressDeflateRawBase64(input)
    .then(({ base64, inputBytes, compressedBytes, method }) => {
      const wrapped = wrapBase64(base64);
      const magicBlock = `\`\`\`magic\n${wrapped}\n\`\`\``;
      const w2 = scope.widgets;
      if (w2?.output) w2.output.setValue(magicBlock);

      const ratio = inputBytes > 0 ? (compressedBytes / inputBytes) * 100 : 0;
      setStatus(`Done (${method}). input=${inputBytes}B, deflate=${compressedBytes}B, ratio=${ratio.toFixed(1)}%`);
    })
    .catch((err) => {
      console.error('[magic-crush] compress failed:', err);
      const w2 = scope.widgets;
      if (w2?.output) w2.output.setValue('');
      setStatus(`Compression failed: ${String(err?.message || err)} (see console)`);
    })
    .finally(() => {
      scope.busy = false;
    });
}
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();

const title = gui.createLabel({
  bounds: { x: 20, y: 18, width: 960, height: 28 },
  text: 'Magic Crush — compress text for a `magic` block',
  align: 'left'
});

const inputLabel = gui.createLabel({
  bounds: { x: 20, y: 56, width: 460, height: 22 },
  text: 'Input'
});

const outputLabel = gui.createLabel({
  bounds: { x: 520, y: 56, width: 460, height: 22 },
  text: 'Output (paste this into your markdown)'
});

const input = (typeof gui.createTextEditor === 'function')
  ? gui.createTextEditor({
      bounds: { x: 20, y: 80, width: 460, height: 420 },
      value: '# Example\n\nThis will be compressed into a magic block.\n',
      placeholder: 'Paste content to compress…'
    })
  : gui.createTextField({
      bounds: { x: 20, y: 80, width: 460, height: 44 },
      value: 'Paste content to compress…',
      placeholder: 'Paste content to compress…'
    });

const output = (typeof gui.createTextEditor === 'function')
  ? gui.createTextEditor({
      bounds: { x: 520, y: 80, width: 460, height: 420 },
      value: '',
      placeholder: 'Compressed magic block will appear here…'
    })
  : gui.createTextField({
      bounds: { x: 520, y: 80, width: 460, height: 44 },
      value: '',
      placeholder: 'Compressed magic block will appear here…'
    });

const btn = gui.createButton({
  bounds: { x: 20, y: 512, width: 220, height: 44 },
  label: 'Compress →'
});

const status = gui.createLabel({
  bounds: { x: 260, y: 520, width: 720, height: 24 },
  text: `Status: ${statusText}`,
  align: 'left'
});

widgets = { title, inputLabel, outputLabel, input, output, btn, status };
```

```js on:input
if (!event || !widgets) return;

if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt'),
    meta: (event.mods || []).includes('meta')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
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

if (widgets.btn.wasClicked()) {
  runCompress();
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();
term.write(0, 0, 'Magic Crush');
```
