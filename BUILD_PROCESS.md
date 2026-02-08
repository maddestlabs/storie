# Build Process Guide

## ✅ Build Successfully Deployed to `/docs/`

The new JavaScript engine is now built and ready for testing!

## Build Output

```
docs/
  ├── storie.es.js       235 KB  ← Main ES module
  ├── storie.umd.js       90 KB  ← UMD/browser version
  ├── index.html                   ← Demo page
  ├── .nojekyll                    ← GitHub Pages config
  └── AUTO_GENERATED_README.md     ← Build warning
```

## How Build Works

### 1. **Source Files**

```
site/              ← Edit HTML, CSS, demos here
  └── index.html

src/               ← Edit TypeScript engine here
  ├── main.ts
  ├── engine.ts
  ├── sandbox.ts
  └── ...
```

### 2. **Build Command**

```bash
npm run build
```

This runs two steps:

#### Step 1: `npm run build:lib`
- Compiles TypeScript (`tsc`)
- Bundles with Vite
- Outputs to `docs/storie.*.js`

#### Step 2: `npm run build:site`
- Runs `scripts/build-site.js`
- Copies `site/` → `docs/`
- Creates warning README
- Creates `.nojekyll` file

### 3. **Result**

All files in `/docs/` are ready to:
- Preview locally: `npm run preview`
- Deploy to GitHub Pages (automatic when pushed)

## Development Workflow

### For Development (Live Reload)

```bash
npm run dev
```

- Serves `site/` folder at http://localhost:3000
- Hot module replacement (instant updates)
- TypeScript transpiled on-the-fly
- Uses source files directly (no build step)

### For Testing Production Build

```bash
npm run build
npm run preview
```

- Builds to `docs/`
- Serves at http://localhost:4173
- Tests exactly what will be deployed

### For Deployment

```bash
npm run build
git add docs/ site/ src/
git commit -m "Update engine"
git push
```

- GitHub Pages automatically serves from `docs/`
- Available at: https://maddestlabs.github.io/storie/

## Important Notes

### ⚠️ DO NOT Edit `/docs/` Directly

The `/docs/` folder is **auto-generated**. Any manual edits will be overwritten on next build.

**Instead:**
- Edit HTML/demos → `site/` folder
- Edit engine code → `src/` folder
- Run `npm run build` to update `docs/`

### File Sizes

**Built files:**
- `storie.es.js`: 235 KB (ES modules)
- `storie.umd.js`: 90 KB (UMD/browser)

**Gzipped (actual download size):**
- `storie.es.js`: 52 KB
- `storie.umd.js`: 30 KB

### SES Package

We're using `ses` v1.14.0 (not `@endo/init`):
- `ses` is the correct package for Compartment API
- Actively maintained by Agoric team
- Published to npm regularly
- Part of the Endo monorepo but published separately

### TypeScript → JavaScript

Remember: TypeScript is **development-only**
- Source: `.ts` files
- Build output: Pure `.js` files
- Users only see JavaScript
- No TypeScript runtime in browser

## Testing Checklist

- [x] TypeScript compiles
- [x] Vite builds successfully
- [x] Files copied to `docs/`
- [x] Preview server works
- [ ] Demo loads in browser
- [ ] SES sandbox works
- [ ] Bouncing rocket demo runs
- [ ] Keyboard input works
- [ ] Performance is good

## Next Steps

1. **Test Demo**: Open http://localhost:4173/ and verify:
   - Page loads
   - No console errors
   - Rocket bounces
   - SPACE key randomizes velocity
   - FPS counter shows ~60 FPS

2. **Deploy**: If all tests pass:
   ```bash
   git add .
   git commit -m "Add S|torie engine"
   git push
   ```

3. **Verify Deployment**: Check https://maddestlabs.github.io/storie/

---

**Build Status**: ✅ Complete  
**Preview**: http://localhost:4173/  
**Production**: https://maddestlabs.github.io/storie/
