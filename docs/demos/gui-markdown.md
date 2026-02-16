---
name: "MarkdownView Demo (Storie)"
theme: "neonopia"
---

A minimal demo for the retained-mode `MarkdownView` widget.

**Controls**
- **Mouse**: click links
- **J/K** or **Up/Down**: scroll

## Demo Code

```js
let widgets = null;
let mouseDownLeft = false;
```

```js on:init
term.layerID = 'default';

// Init retained GUI system
gui.init();

// A small status label
const status = gui.createLabel({
  bounds: { x: 20, y: 20, width: 760, height: 24 },
  text: 'MarkdownView: click a link or scroll (J/K)'
});

const markdown = `# MarkdownView\n\nThis is a *minimal* markdown renderer (MVP) meant to exercise layout + glyph rendering.\n\n- Wraps text to the widget width\n- Supports inline code like \`vec4<f32>\`\n- Supports links like [Storie on GitHub](https://github.com/maddestlabs/storie)\n\n## Code Block\n\n\`\`\`wgsl\n@fragment\nfn main() -> @location(0) vec4<f32> {\n  return vec4<f32>(1.0, 0.6, 0.2, 1.0);\n}\n\`\`\`\n\nAnd a longer paragraph to prove wrapping works. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

const view = gui.createMarkdownView({
  bounds: { x: 20, y: 60, width: 760, height: 420 },
  markdown,
  padding: 12
});

widgets = { status, view };
```

```js on:input
if (!event || !widgets) return;

if (event.type === 'keydown') {
  // Scroll
  if (event.key === 'j' || event.key === 'J' || event.key === 'ArrowDown') {
    widgets.view.scrollBy(28);
  }
  if (event.key === 'k' || event.key === 'K' || event.key === 'ArrowUp') {
    widgets.view.scrollBy(-28);
  }

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

const url = widgets.view.popClickedLink();
if (url) {
  widgets.status.setText(`Clicked link: ${url}`);
  // (Optional) you can also do: window.open(url, '_blank')
}
```

```js on:render
const base = getStyle('default');
ui.clear(base.bg);

term.layerID = 'default';
term.clear();
term.write(0, 0, 'MarkdownView Demo');
term.write(0, 1, 'Click the link and scroll (J/K)');
```
