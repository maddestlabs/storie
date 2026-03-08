---
title: ANSI Art Demo
theme: "solarlight"
shaders: "ruledlines+saintbilly"
---

# ANSI Art Support

Storie supports **embedded ANSI (SGR color) art blocks** in markdown.

- Define named blocks with fenced code like `ansi name:logo`.
- Access them from sandboxed JS via `ansi.*`.
- Draw them into the terminal with `drawAnsi(x, y, name)`.

Notes:

- Storie currently renders **colors only** (per-cell `fg`/`bg`).
- Most non-color SGR attributes (underline/italic/etc) are ignored.
- `SGR 1` (bold) is treated as **bright** for 16-color ANSI art.

```js
let status = 'Loading…';
```

```js on:init
term.layerID = 'default';
term.clear();

status = `Found ${ansi.list().length} ANSI asset(s): ${ansi.list().join(', ')}`;
```

```js on:render
term.layerID = 'default';
term.clear();

const base = getStyle('default');
const dim = getStyle('dim');
const heading = getStyle('heading');

term.write(2, 1, '=== ANSI Art Demo ===', heading.fg, heading.bg);
term.write(2, 3, status, dim.fg, dim.bg);

term.write(2, 5, 'logo:', base.fg, base.bg);
drawAnsi(2, 6, 'logo');

term.write(2, 13, 'gradient (256-color):', base.fg, base.bg);
drawAnsi(2, 14, 'gradient');

term.write(2, 17, 'palette (16/256/truecolor + bg):', base.fg, base.bg);
drawAnsi(2, 18, 'palette');
```

## Embedded ANSI Art

These blocks use **bracket SGR** sequences like `[38;5;196m` (markdown-friendly).

```ansi name:logo
[38;2;0;217;142m  ▄  [0m [1;37m█[0m [38;2;100;100;100m▄▄▄▄   ▄                     [0m
[38;2;0;217;142m ▄█▄ [0m [1;37m█[0m [38;2;100;100;100m█     ▄█▄  ▄▄▄▄ ▄▄▄▄ ▄  ▄▄▄▄▄[0m
[38;2;0;217;142m  █  [0m [1;37m█[0m [38;2;100;100;100m▀▀▀▀▄  █   █  █ █    █  █▄▄▄█[0m
[38;2;0;217;142m  █  [0m [1;37m█[0m [38;2;100;100;100m    █  █   █  █ █    █  █    [0m
[38;2;0;217;142m  ▀▀ [0m [1;37m█[0m [38;2;100;100;100m▀▀▀▀   ▀▀  ▀▀▀▀ ▀    ▀  ▀▀▀▀▀[0m
```

```ansi name:gradient
[38;5;196m▀[38;5;202m▀[38;5;208m▀[38;5;214m▀[38;5;220m▀[38;5;226m▀[38;5;190m▀[38;5;154m▀[38;5;118m▀[38;5;82m▀[38;5;46m▀[38;5;47m▀[38;5;48m▀[38;5;49m▀[38;5;50m▀[38;5;51m▀[38;5;45m▀[38;5;39m▀[38;5;33m▀[38;5;27m▀[0m  256 Color Gradient
[38;5;196m■[38;5;202m■[38;5;208m■[38;5;214m■[38;5;220m■[38;5;226m■[38;5;190m■[38;5;154m■[38;5;118m■[38;5;82m■[38;5;46m■[38;5;47m■[38;5;48m■[38;5;49m■[38;5;50m■[38;5;51m■[38;5;45m■[38;5;39m■[38;5;33m■[38;5;27m■[0m
```

```ansi name:palette
[31m●[0m Red   [32m●[0m Green   [33m●[0m Yellow   [34m●[0m Blue
[1;31m●[0m Bright red via SGR 1 (treated as “bright”)
[38;5;141m●[0m 256-color example (38;5;141)
[38;2;255;105;180m●[0m Truecolor example (hot pink)
[48;5;18;38;5;226m  BG+FG  [0m Background + Foreground
```

## Advanced Features

Supported in Storie today:

- **16-color mode**: `30–37`, `40–47`, `90–97`, `100–107`
- **256-color mode**: `38;5;N` / `48;5;N`
- **RGB mode**: `38;2;R;G;B` / `48;2;R;G;B`
- **Reset/defaults**: `0`, `39`, `49`

Notes:

- Tabs in ANSI blocks are expanded to spaces during parsing (default `tabSize=4`).
- You can override tab size per-block with metadata like: `ansi name:myArt tabSize:8`.
