# S|torie - Site Source

This directory contains the **source files** for the GitHub Pages site.

## Structure

```
site/
  ├── index.html              # Main demo (auto-loads index.md)
  ├── index.md                # Main demo markdown
  ├── demo-hooks.html         # Lifecycle hooks demo
  ├── demo-hooks.md           # Lifecycle hooks markdown
  ├── demo-frontmatter.html   # Frontmatter variables demo
  ├── demo-frontmatter.md     # Frontmatter markdown
  ├── assets/                 # Fonts and favicons
  │   ├── 3270-regular-startup.ttf
  │   └── favicons/           # All favicon variants
  └── README.md               # This file
```

## Available Demos

- **index.html** - Main bouncing rocket demo (loads index.md)
- **demo-hooks.html** - Shows lifecycle hook pattern (`on:init`, `on:update`, `on:render`)
- **demo-frontmatter.html** - Shows frontmatter variable usage

All demos feature:
- ✅ Full-screen immersive layout
- ✅ 3270-regular terminal font
- ✅ No canvas outlines (clean full-screen aesthetic)
- ✅ Dynamic window resizing
- ✅ SES sandboxing

## Development

Edit files in this directory, then build:

```bash
npm run build
```

This copies files to `/docs/` which is served by GitHub Pages.

## Preview

```bash
npm run preview
```

Serves `docs/` at http://localhost:4173 to preview production build.

## Dev Server

```bash
npm run dev
```

Serves `site/` at http://localhost:3000 with hot reload.
