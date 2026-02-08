# TStorie to Storie Conversion Guide

This guide shows how to convert demos from **tstorie** (Nim-based) to **Storie** (JavaScript-based).

## Overview

| Feature | TStorie (Nim) | Storie (JavaScript) |
|---------|---------------|---------------------|
| **Scripting Language** | Nimini (Nim subset) | JavaScript (SES sandbox) |
| **Input Handling** | `on:input` event-driven | `on:input` event-driven ✅ (NEW) |
| **Themes** | Built-in theme system | Built-in theme system ✅ (NEW) |
| **Lifecycle Hooks** | `on:init`, `on:update`, `on:render`, `on:input` | `on:init`, `on:update`, `on:render`, `on:input` |

## Syntax Comparison

### Variables and Types

**TStorie (Nim):**
```nim
var score: int = 0
let maxScore = 100
var message: string = "Hello"
var revealed: array[8*8, bool]
```

**Storie (JavaScript):**
```javascript
let score = 0;
const maxScore = 100;
let message = "Hello";
let revealed = new Array(8 * 8).fill(false);
```

### Input Events

**TStorie (Nim):**
```nim
```nim on:input
if event.typ == EventType.Keyboard:
  if event.action == InputAction.Press:
    if event.key == "r":
      resetGame()
```
\```

**Storie (JavaScript):**
```javascript
```javascript on:input
if (event.type === 'key') {
  if (event.action === 'press') {
    if (event.key === 'r') {
      resetGame();
    }
  }
}
return true; // Mark event as handled
```
\```

### Mouse Events

**TStorie (Nim):**
```nim
```nim on:input
if event.typ == EventType.Mouse:
  if event.action == InputAction.Press:
    let gridX = event.x div 2
    let gridY = event.y - 2
    handleClick(gridX, gridY)
```
\```

**Storie (JavaScript):**
```javascript
```javascript on:input
if (event.type === 'mouse') {
  if (event.action === 'press') {
    const gridX = Math.floor(event.x / 2);
    const gridY = event.y - 2;
    handleClick(gridX, gridY);
  }
}
return true;
```
\```

### Themes

**TStorie (Nim):**
```nim
# Frontmatter
theme: catppuccin

# In code
let style = getStyle("accent1")
term.write(x, y, text, style.fg, style.bg)
```

**Storie (JavaScript):**
```javascript
// Frontmatter (same)
theme: catppuccin

// In code
const style = getStyle("accent1");
term.write(x, y, text, style.fg, style.bg);
```

## Available Themes

Both tstorie and Storie support these themes:

- `neotopia` - Cyberpunk teal/purple
- `catppuccin` - Warm pastels
- `dracula` - Dark vampire purple
- `solarlight` - Solarized light
- `nord` - Arctic cool blues
- `tokyonight` - Night city neon
- `gruvbox` - Retro warm earth tones
- `monokai` - Classic syntax highlighting
- `onedark` - Atom-inspired dark
- `ayu` - Minimal modern
- `nightowl` - Soft night editor
- `palenight` - Subtle purple-grey
- `material` - Google Material Design

## Input Event Properties

| Property | TStorie | Storie | Description |
|----------|---------|--------|-------------|
| **Type** | `event.typ` (enum) | `event.type` (string) | `"key"`, `"text"`, `"mouse"`, or `"mouse_move"` |
| **Action** | `event.action` (enum) | `event.action` (string) | `"press"`, `"release"`, `"repeat"` |
| **Key** | `event.key` | `event.key` | Key string (for keyboard) |
| **Key Code** | `event.keyCode` | `event.keyCode` | Numeric key code |
| **Button** | `event.button` | `event.button` | Mouse button: `"left"`, `"middle"`, `"right"` |
| **X Position** | `event.x` | `event.x` | Character X coordinate |
| **Y Position** | `event.y` | `event.y` | Character Y coordinate |
| **Modifiers** | `event.mods` | `event.mods` | Array: `['shift', 'ctrl', 'alt', 'meta']` |

## Style Properties

| Property | TStorie | Storie | Description |
|----------|---------|--------|-------------|
| **Foreground** | `style.fg` | `style.fg` | Text color `{r, g, b}` |
| **Background** | `style.bg` | `style.bg` | Background color `{r, g, b}` |
| **Bold** | `style.bold` | `style.bold` | Bold flag |
| **Italic** | `style.italic` | `style.italic` | Italic flag |
| **Underline** | `style.underline` | `style.underline` | Underline flag |

## Common Patterns

### Grid Indexing

**TStorie:**
```nim
let index = y * width + x
revealed[index] = true
```

**Storie:**
```javascript
const index = y * width + x;
revealed[index] = true;
```

### Iterating Grid

**TStorie:**
```nim
for y in 0..<height:
  for x in 0..<width:
    let index = y * width + x
    drawCell(x, y, cells[index])
```

**Storie:**
```javascript
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const index = y * width + x;
    drawCell(x, y, cells[index]);
  }
}
```

### Random Numbers

**TStorie:**
```nim
import std/random
randomize()
let n = rand(1..10)
```

**Storie:**
```javascript
// Math.random() is available
const n = Math.floor(Math.random() * 10) + 1;
```

### Terminal Drawing

Both use the same API pattern:

```javascript
term.write(x, y, text, fg, bg);
term.clear();
```

### Complete Example: Simple Clicker

**TStorie Version**

\```nim
---
title: Simple Clicker
theme: catppuccin
---

```nim
var clicks: int = 0
```

```nim on:input
if event.typ == EventType.Mouse and event.action == InputAction.Press:
  clicks += 1
```

```nim on:render
let style = getStyle("accent1")
term.write(2, 2, "Clicks: " & $clicks, style.fg)
```
\```

**Storie Version**

\```markdown
---
title: Simple Clicker
theme: catppuccin
---

```javascript
let clicks = 0;
```

```javascript on:input
if (event.type === 'mouse' && event.action === 'press' && event.button === 'left') {
  clicks++;
}
return true;
```

```javascript on:render
const style = getStyle("accent1");
term.write(2, 2, `Clicks: ${clicks}`, style.fg);
```
\```

## Conversion Checklist

When converting a tstorie demo:

- [ ] Change code block language from `nim` to `javascript`
- [ ] Convert variable declarations: `var x: int = 0` → `let x = 0`
- [ ] Convert string concatenation: `"text" & $value` → `` `text${value}` ``
- [ ] Convert conditionals: `if x == 5:` → `if (x === 5) {`
- [ ] Convert loops: `for i in 0..<10:` → `for (let i = 0; i < 10; i++)`
- [ ] Convert event checks: `event.typ == EventType.Mouse` → `event.type === 'mouse'`
- [ ] Convert event actions: `InputAction.Press` → `'press'`
- [ ] Add `return true` to `on:input` handlers
- [ ] Convert array access: use same syntax, just ensure proper initialization
- [ ] Test with Storie engine

## Resources

- [Storie JavaScript Demos](./demos/)
- [TStorie Nim Examples](../tests/)
- [Theme Reference](./THEMES.md)
- [Input Event API](./INPUT_EVENTS.md)
