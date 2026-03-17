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

const markdown = `# MarkdownView\n\nThis is a *minimal* markdown renderer (MVP) meant to exercise layout + glyph rendering.\n\n- Wraps text to the widget width\n- Supports inline code like \`vec4<f32>\`\n- Supports links like [Storie on GitHub](https://github.com/maddestlabs/storie)\n- Supports callouts and blob-backed block images\n\n> [!TIP] Shared renderer\n> GUI MarkdownView and Worlds cards now share the same lightweight markdown renderer.\n\n![Storie favicon](gui-markdown-icon \"width:25% align:center\")\n\n## Code Block\n\n\`\`\`wgsl\n@fragment\nfn main() -> @location(0) vec4<f32> {\n  return vec4<f32>(1.0, 0.6, 0.2, 1.0);\n}\n\`\`\`\n\nAnd a longer paragraph to prove wrapping works. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.`;

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

```blob name:gui-markdown-icon mime:image/png enc:base64
iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAAAAAAAAAHqZRakAAAKWklEQVR4nIVXy2sd9xWex33M+3HnfWfu3Oe8517ZphDSkpQuCukm1ImTfyCB0qab0hKb2HFjhyZkUQpetDZ00Y3BCy8MxYtu5IW8MBRkilVkOXYTqZYwhmtqbCVIsnXK+d2RKruFLg6MR9e/8833O+c736EoivIpiiooinqNoqijFEW9x1DUhzRNf0HT9AWapi8xDHOVYZhrDMPcYFl2kWXZWyzLLtdY9jYGPlfvFlmGuVH99ipL05eqM75gGOZDPLvK8VqV06eqh+9TFHWMoqifURR1mmbZczWWvViv1682Go0Fjmsu8jy/IgrCqiiJG7IsPpQkaSpL0iNZkh+RZ1l8KEvShiiJq6IgrPA8v9hs8gvNZv1qrVa7yLLsOYZhTlc5jlU5C6pCc4yimA9omj5br9fPN5vNyzzPzYuiuKgo0h1FUdc1XZu2dO2JYRjfmoaxZVnmDoZdhWWZW5ZpfmsarSeG0Zrqmr6uqdodRZEXJUmY5zjhMsdx51mWPUtR1AcViNeoipKf0jR9ptFoXOC45hVBEBZkWV7SVGWt1dKnpmls2pa17Tj2c9d1oO250G574JNog+9X0W5Du+0+91xn23GsTdu2pqZhrGmatqQo8oIoiFc4jrvAsuwZzFnlpt5nKOo0+fJZ8uuKIt3WdW3DNM3Htm1teY6zSxL6begEPoSdAMKwQ6JLItwP8r4T4O92/XZ7y3NdPGOj1dJvq6pyXRSFK41G4zxeB0NR7yOA4zRNn6vXm5cFgV9QFHlZ1/UHpmk8dRz7GX5tgIkxaScgCXu9LvT3ot+DwUvR7/Wg15sBCgL/WbvtPXUc60GrpS8jE4LAXWbrpCaOU1ihLMte5DluXpalJU3TNkyjSt729r8YE+8nHPRhNBzMYjSE6GAMBxCPhuRvBEy3i+BnIGx7o9XSliRJmm80ahcxNwK4gNWOBaeqypph6EjZDknu+9DtBLMv7vdgOBhANBpAFA0hiaNZJDGkBwLfIVhMjoCGgz4B3gmCHc/1HluWsaYpymKz2byKuRHApUajviCJ4h1d06aWaW55rgO+X315r0sOGw375MAkGkGaRJAlMWRpAlmWQJ6lVSSQpwm8ffRNePW7r5LkeyB63RBraMux7amu63d4gV9gWfYSRTP01WazcVOR5XVd1zcd29r1K+q73RAGvS4MkU6kNRpBFEcQpwnEVdIyz6DIMyiLHLIshXGRwD+Wb8KvTpyEtucQkHhN+BFhp7Pbdp3NVktfF0XxJooVharFcc0VVZWnhtHadh2btBMWHVLX6/ehOxzAOBrBJIngUJrA4SyF7+Qp5EUGaZHDGKPMCZC5MoO1e3+H46c+Ab/tQp5lEI9GMBzOWGi3vW3TNKaiKK7UGOYaArjB881VVVWemKbx3HNd0m7dMIAQ6R/04c+jIWzHEfwrieFJlsLjPIOtIoOlMofXywLisoC5SQFFkcOhcQb3v1qBj379KQRtF4o8J3WBRYkfFAT+c9s0n8iStFpn2RsUyzAosxuapn5jWeau57mE/l7YgU6vB1eGfdiMR/BpEsOJNIGTeQqnihw+KnNYHZewNi7h1XEJ47kSxmUBhycF3P/6Lpz85DfQCTwoi4IUZ1RdQ6cT7Dq29Y2iyBs4OyiGZW4JPP9Q17Qt27YAAYSBD0EYQtHvwdZoCCeiEbBJDP0shTDPoFvk4JYFvDMuYX4yhjcmY8jnxjAZl3BkroD11btw6sznEAZtAipJY4iiEWEThcp17C1VUR7WarVbFMOwy4LAT3Vd20EA2H4IIOyGEA36cG84gH9GERxLYwizBObyDA6XORwuCygnJcSTMUwmYzg0N4bxQQBnP4ewgwBKSNOEAMBuwBZ1XWdHU9VprVZbpliWvS0I/KODAPAK+t0QwkEfXh8O4K9RBJDG8LsshSjPICYASpiblHAIk0/GcPgAAxur9+DjsxUD4xLSJIE4fgmApj6q12q3KZY5AMCyyKAJsAXDEIb9LoSDAXRHQ/htEgOkCSzmKfywyKFXFnBoXMChCQLZY6CAIxNkYA+AB2W5VwP/xcAMAMOyywLPT3VNw5FKagC1n2g+qtmgT9rITSJ4O01gNUthu8jgoyKHwbiAfIwslDCZlCTZ4QMA9ooQuwDledDvoxaA6zg72PazK2CYWzzPP9Q0desgAPwhDpV42IdkNII8jiBMYyizFC7lGUCZw1/KAr43LvdBzADk5ApOnf0MOn7FQBwR+Z6JUQDOwSJkSRtyG5qqfmOaxi7Oe6IDnQ50eyFolRBl8QjKSn7DPIWf5xlsljncLQt4pSygmBREDQ+Nc8LAyTOfzXSgyCFJIjKk+lUb2tiGsrxRI23IMDeazeaqoijoZJ47RAk9aAc+5N0Q/tDrwg+GA7BGQ+hFI+jhfaYJiFkCP0Em8gzeKHIiRijLc2VKugB1IGg7kOfZbB6gEqIQ+S8JEcMw15rN5oosS9NWS992sBPQ8fg+DDsBrPa6sNzvwVuDPhwdDeFYPIJjSUza8m9pCl9lKRypZBmHEc6C9a/vwonTn0Lbtcl8IKMZCxCl2PO2TaOS4lrtGsXQNBrPm7IkrWuaurl3DYHnge37cKTTgZVeCICiNBzAzmgIO9EIII7gQRLBj9IY+slsCsYx1kgM97/+Eo6fOgOubZJxPRvJIXFJrmNvtlqt/wwjmqYv1ev1BVEQ7qA4GK3WviIGbQ/sIIAs7MCbvRDe7Pfgx4M+vDUcwLujAbwSjaCL4zkakT4fRUNSK6v3bsMvT3wMttkiAoTFjF3Vbnt4NnbcHZ7fG8c0faFWq13leW5RlqU1XdMeW6axg7XgEVPSBr/jgxV2wOmG4PW74PV74OGMJ+4HTcoQ4krpsngA97/6En5x/BRYhk5GcW9mzXY8z31smsaaLMvEkLAse2HfknEcNy8IwpKqKBstXX9qmeYz13H2mQj33FEYwqDyCcRyveQFUTf+9Mffw1vvvAtYT1h4HfSFnvuUmFNNnVmyWmXJGGbPlNYvIy2iKC6rqoIGkoCwbRvQIWFhok8IgsoZH3TE3ZDMegz898xRoZYE+H+eeZ771LLMB7quLSuyvMBx3OVqUTlObDlV2fJ6s35F4PnrkiTeVhRlA6/DNI0t2zJ3HdtGCQX0CzgvZntBm4hW4PtEvkn4PgHo++1dz3O2XMd5bBkGnoVnXheEA7acYd5/YTGps+yFZrN5BZmQJGFJluQ1VVVxUm4aLR2dzHPLsgCLFGsEr4iE+0I8t21r27LMTcMwpi1NwzOW8MsxOddo7C8mLMsePbCa4bpEn2Xr7Pl6vYZr1DzPcYuCIN6RZGldlaWpqihPNE39Fr1Dq6XvGBhGaxatFr7Dvz3RdW2qqsq6qip3ZFlaFAR+HmlHlv/Xala8vJyyNH0OCxO7A1u02Wgschy3wjf5VZRtnB2CIExFQXgkiiTw+aEoihuiwK8KPL/Ccdxis9lYQMv//5bTF9ZzBtdzhnlxPadpsp7j6o02qsayt2q4ntfY21XgM77D1f1GrVat5yx7iT2wnjMM815F+/56/m/7BfLG+HP1hgAAAABJRU5ErkJggg==
```
