---
name: "Hex Viewer Demo"
dropTarget: true
theme: "neotopia"
shaders: "invert+ruledlines+paper"
---

# Hex Viewer

Drop any file to view a classic **hex + ASCII** dump.

This demo uses Storie's `dropTarget: true` support.

## Game Code

```js
function state() {
  if (!scope.__hexview) {
    scope.__hexview = {
      file: null,
      scrollRow: 0,
      bytesPerRow: 16,
      maxVisibleRows: 0
    };
  }
  return scope.__hexview;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function toHex(n, width) {
  const s = Math.max(0, Math.floor(n)).toString(16).toUpperCase();
  return s.padStart(width, '0');
}

function byteStyle(getStyle, b) {
  // Prefer theme styles when available; fall back to default.
  if (b === 0) return getStyle('default');
  if (b === 9 || b === 10 || b === 13 || b === 32) return getStyle('accent2');
  if (b >= 32 && b <= 126) return getStyle('accent1');
  return getStyle('accent3');
}

function computeLayout(st, width, height) {
  // Layout constants (in terminal cells)
  const headerLines = 5;      // rows 0..4 used by title/meta/separator
  const footerLines = 1;      // bottom row for help/scroll info

  // Keep bytesPerRow within width; 16 fits nicely in ~80 cols.
  // Required width ≈ 15 + bytesPerRow*4 (offset + hex + ascii)
  const maxBPR = 16;
  const minBPR = 4;
  const fit = Math.floor((width - 15) / 4);
  st.bytesPerRow = clamp(Number.isFinite(fit) ? fit : maxBPR, minBPR, maxBPR);

  st.maxVisibleRows = Math.max(0, height - headerLines - footerLines);

  const size = st.file?.bytes?.byteLength ?? 0;
  const totalRows = st.bytesPerRow > 0 ? Math.ceil(size / st.bytesPerRow) : 0;
  const maxScroll = Math.max(0, totalRows - st.maxVisibleRows);
  st.scrollRow = clamp(st.scrollRow, 0, maxScroll);

  return { headerLines, footerLines, size, totalRows, maxScroll };
}
```

```js on:init
term.layerID = 'default';
term.clear();
```

```js on:drop
// Enabled by frontmatter: dropTarget: true
const st = state();
st.file = file;
st.scrollRow = 0;
```

```js on:input
if (!event) return;

const st = state();
if (!st.file) return;

if (event.type !== 'keydown') return;

// Recompute layout so PageUp/PageDown use the current viewport height.
const { totalRows } = computeLayout(st, termWidth, termHeight);

switch (event.key) {
  case 'ArrowDown':
  case 'j':
  case 'J':
    st.scrollRow += 1;
    break;
  case 'ArrowUp':
  case 'k':
  case 'K':
    st.scrollRow -= 1;
    break;
  case 'PageDown':
    st.scrollRow += Math.max(1, st.maxVisibleRows);
    break;
  case 'PageUp':
    st.scrollRow -= Math.max(1, st.maxVisibleRows);
    break;
  case 'Home':
    st.scrollRow = 0;
    break;
  case 'End':
    st.scrollRow = Math.max(0, totalRows - st.maxVisibleRows);
    break;
}
```

```js on:render
term.layerID = 'default';
term.clear();

const st = state();
const base = getStyle('default');
const heading = getStyle('heading');
const dim = getStyle('dim');

// Empty state
if (!st.file || !st.file.bytes) {
  const msg = 'Drop a file to view its hex dump';
  const hint = 'Tip: use ↑/↓, PgUp/PgDn, Home/End';
  const x1 = Math.max(0, Math.floor((termWidth - msg.length) / 2));
  const x2 = Math.max(0, Math.floor((termWidth - hint.length) / 2));
  term.write(x1, Math.floor(termHeight / 2) - 1, msg, heading.fg, heading.bg);
  term.write(x2, Math.floor(termHeight / 2) + 1, hint, dim.fg, dim.bg);
  return;
}

const { headerLines, size, totalRows } = computeLayout(st, termWidth, termHeight);

// Header
term.write(2, 0, '=== Hex Viewer ===', heading.fg, heading.bg);
term.write(2, 1, `File: ${st.file.name}`, base.fg, base.bg);
term.write(2, 2, `Size: ${size} bytes`, base.fg, base.bg);
term.write(2, 3, `MIME: ${st.file.mime || 'application/octet-stream'}`, base.fg, base.bg);
term.write(2, 4, '─'.repeat(Math.max(0, termWidth - 4)), dim.fg, dim.bg);

// Hex dump body
const bytes = st.file.bytes;
const startByte = st.scrollRow * st.bytesPerRow;
const endByte = Math.min(size, startByte + st.maxVisibleRows * st.bytesPerRow);

let y = headerLines;
for (let offset = startByte; offset < endByte; offset += st.bytesPerRow) {
  // Offset column
  term.write(2, y, `${toHex(offset, 8)}:`, dim.fg, dim.bg);

  // Columns (match the older tStorie layout)
  let hexX = 13;
  let asciiX = 13 + st.bytesPerRow * 3 + 2;

  for (let i = 0; i < st.bytesPerRow; i++) {
    const pos = offset + i;
    if (pos >= size) break;

    const b = bytes[pos];
    const sty = byteStyle(getStyle, b);
    term.write(hexX, y, toHex(b, 2), sty.fg, sty.bg);

    const ch = (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.';
    term.write(asciiX, y, ch, sty.fg, sty.bg);

    hexX += 3;
    asciiX += 1;
  }

  y++;
  if (y >= termHeight - 1) break;
}

// Footer
const rowInfo = totalRows > 0
  ? `Row ${Math.min(totalRows, st.scrollRow + 1)} / ${totalRows}`
  : 'Row 0 / 0';
const help = `${rowInfo}  (↑/↓, PgUp/PgDn, Home/End)`;
term.write(2, termHeight - 1, help.slice(0, Math.max(0, termWidth - 4)), dim.fg, dim.bg);
```

## Features

- **Hexadecimal display**: View file contents as hex bytes
- **ASCII preview**: See readable characters alongside hex
- **Scrolling support**: Use ↑/↓, PgUp/PgDn, Home/End
- **Address offsets**: Each row shows its byte offset
- **Drop target**: Drag and drop any file type

## Try It!

Drop a `.ans` file, an image, or any binary file to explore its contents.
