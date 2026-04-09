---
name: "History: Undo/Redo"
theme: "neonopia"
fontsize: 20
---

A minimal demo of **`sys.history`** — general-purpose undo/redo using the command pattern.

Controls:
- **A–Z**: place a character at the cursor
- **Arrow keys**: move cursor
- **Ctrl+Z**: undo  
- **Ctrl+Y** / **Ctrl+Shift+Z**: redo
- **Backspace**: delete + undo-able
- **C**: clear canvas (undo-able)

```js
// State — persists across lifecycle blocks.
let canvas = [];       // Array<{x,y,ch}> — the "document"
let curX = 4;
let curY = 4;
let h = null;          // HistoryStack
```

```js on:init
h = sys.history.create({ maxDepth: 64 });
canvas = [];
curX = Math.floor(termWidth / 2);
curY = Math.floor(termHeight / 2);
```

```js on:input
if (event.type !== 'keydown') return true;

const k = event.key;

// Undo / Redo
const ctrl = event.mods && event.mods.includes('ctrl');
if (ctrl && (k === 'z' || k === 'Z') && !event.mods.includes('shift')) {
  h.undo();
  return true;
}
if (ctrl && ((k === 'y' || k === 'Y') || (k === 'z' || k === 'Z') && event.mods.includes('shift'))) {
  h.redo();
  return true;
}

// Movement
if (k === 'ArrowLeft')  { curX = Math.max(0, curX - 1); return true; }
if (k === 'ArrowRight') { curX = Math.min(termWidth - 1, curX + 1); return true; }
if (k === 'ArrowUp')    { curY = Math.max(0, curY - 1); return true; }
if (k === 'ArrowDown')  { curY = Math.min(termHeight - 1, curY + 1); return true; }

// Backspace — undo-able delete
if (k === 'Backspace') {
  const cx = curX - 1;
  const cy = curY;
  const idx = canvas.findIndex(c => c.x === cx && c.y === cy);
  if (idx !== -1) {
    const removed = canvas[idx];
    h.push({
      label: 'delete',
      do() {
        canvas.splice(canvas.findIndex(c => c.x === removed.x && c.y === removed.y), 1);
        curX = cx;
        return removed;
      },
      undo(snap) {
        canvas.push(snap);
        curX = snap.x + 1;
      },
    });
  }
  return true;
}

// Clear
if (k === 'c' || k === 'C') {
  const snapshot = canvas.slice();
  const ox = curX, oy = curY;
  h.push({
    label: 'clear',
    do() { canvas.length = 0; return { cells: snapshot, x: ox, y: oy }; },
    undo(s) { canvas.length = 0; for (const c of s.cells) canvas.push(c); curX = s.x; curY = s.y; },
  });
  return true;
}

// Printable character
if (k.length === 1 && k >= ' ') {
  const px = curX, py = curY, ch = k;
  const prev = canvas.find(c => c.x === px && c.y === py);
  h.push({
    label: `type '${ch}'`,
    do() {
      const i = canvas.findIndex(c => c.x === px && c.y === py);
      if (i !== -1) canvas[i] = { x: px, y: py, ch };
      else canvas.push({ x: px, y: py, ch });
      curX = Math.min(termWidth - 1, px + 1);
      return prev;
    },
    undo(snap) {
      const i = canvas.findIndex(c => c.x === px && c.y === py);
      if (snap) { if (i !== -1) canvas[i] = snap; else canvas.push(snap); }
      else if (i !== -1) canvas.splice(i, 1);
      curX = px;
    },
  });
  return true;
}

return true;
```

```js on:render
term.clear();

// Draw canvas cells
for (const cell of canvas) {
  term.write(cell.x, cell.y, cell.ch, 0xaaffaaff);
}

// Cursor
term.write(curX, curY, '_', 0xffff00ff);

// HUD
const hud = `depth:${h ? h.depth : 0}  undo:${h ? (h.undoLabel || '—') : '—'}  redo:${h ? (h.redoLabel || '—') : '—'}`;
term.write(1, 0, hud.slice(0, termWidth - 2), 0x66ccffff);
term.write(1, termHeight - 1, 'A-Z type • Arrows move • Ctrl+Z undo • Ctrl+Y redo • C clear', 0x888888ff);
```
