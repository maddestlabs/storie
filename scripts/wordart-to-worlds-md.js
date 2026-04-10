#!/usr/bin/env node
/**
 * wordart-to-worlds-md.js
 *
 * Pack a list of words into a shape and emit a Worlds-ready Markdown document
 * where each word is a positioned section.  The canonical use-case is building
 * lyric word-art (e.g. a cross silhouette from song lyrics) that can be revealed
 * with `worlds.camera.focusOnFrame(...)` at the end of a timed sequence.
 *
 * Usage:
 *   node scripts/wordart-to-worlds-md.js --words lyrics.txt --shape cross
 *   node scripts/wordart-to-worlds-md.js --words lyrics.txt --shape cross --out docs/demos/cross-art.md
 *   node scripts/wordart-to-worlds-md.js --words-stdin --shape circle --stdout
 *   node scripts/wordart-to-worlds-md.js --lyric-words docs/demos/saintbilly-ballad.md --shape cross --out docs/demos/billy-cross.md
 *   node scripts/wordart-to-worlds-md.js --json-words docs/demos/saintbilly.json --shape cross --out docs/demos/billy-cross.md
 *
 * Built-in shapes:
 *   cross   – Latin cross (vertical + horizontal bar; proportions controlled by --cross-*)
 *   circle  – filled circle / ellipse
 *   diamond – 45° rotated square (|nx|+|ny| ≤ 1)
 *   heart   – approximate heart (two overlapping circles + lower triangle)
 *   star5   – 5-pointed star
 *   rect    – filled rectangle (entire canvas)
 *   pillv   – vertical pill (tall rounded rectangle)
 *   pillh   – horizontal pill (wide rounded rectangle)
 *
 * Options:
 *   --words <file>          Plain-text word source (whitespace-separated or one-per-line)
 *   --words-stdin           Read words from stdin
 *   --lyric-words <file>    Extract words from a ```timed name:lyricWords block in a .md file
 *   --json-words <file>     Extract words+timestamps from a JSON [{timestamp:[s,e],text:"..."}] file
 *   --shape <name>          Shape name (default: cross)
 *   --canvas-width <n>      Canvas width in world units (default: 160)
 *   --canvas-height <n>     Canvas height in world units (default: 200)
 *   --cell-width <n>        Width of each word cell in world units (default: 8)
 *   --cell-height <n>       Height of each word cell in world units (default: 4)
 *   --gap-x <n>             Extra horizontal gap between cells (default: 0.5)
 *   --gap-y <n>             Extra vertical gap between cells (default: 0.5)
 *   --cross-vw <f>          Cross: vertical bar width as fraction of canvas width (default: 0.33)
 *   --cross-hh <f>          Cross: horizontal bar height as fraction of canvas height (default: 0.33)
 *   --cross-vy <f>          Cross: vertical center as fraction 0..1 from top (default: 0.5, i.e. centred)
 *   --cross-hx <f>          Cross: horizontal center as fraction 0..1 from left (default: 0.5)
 *   --prefix <str>          Section-id prefix (default: "w")
 *   --theme <name>          Frontmatter theme (default: saintbilly)
 *   --font <name>           Optional font override (e.g. Rye)
 *   --template <path>       Template markdown file; uses <!-- WORDART_SECTIONS --> placeholder
 *   --out <path>            Output path (default: wordart-<shape>.md in cwd)
 *   --stdout                Write to stdout
 *   --no-repeat             Emit each word only once; stop when shape is exhausted
 *   --shuffle               Shuffle the word list before packing (default: off)
 *   --seed <n>              RNG seed for --shuffle (default: 42)
 *   --reveal-ms <n>         If set, append a worldsTimeline JSON block with camera zoom-out at this ms
 *   --reveal-section <s>    Section id/index to attach the zoom-out snip to (for documentation)
 *
 * Rotation options (combinable):
 *   --rotate <deg>          Fixed rotate-z applied to every section (default: 0)
 *   --rotate-choices <list> Comma-separated list of angles to pick randomly per section
 *                           e.g. --rotate-choices 0,90,-90  (overrides --rotate)
 *   --rotate-jitter <deg>   Max ±random rotation per section; seeded by --seed (default: 0)
 *   --rotate-radial         Point each section radially outward from the shape centre
 *                           (ideal for circle / star layouts)
 *   --rotate-jitter-seed <n> Independent seed for jitter RNG (default: shares --seed)
 *
 * Scale options:
 *   --scale-min <n>         Minimum section scale (default: 1)
 *   --scale-max <n>         Maximum section scale; if > min, each section gets a random scale
 *                           between min and max using the seeded RNG (default: 1 = uniform)
 *   --scale-seed <n>        Independent seed for scale RNG (default: shares --seed + 17)
 */

import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function die(msg) {
  process.stderr.write(`[wordart] ${msg}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = {
    wordsFile: null,
    wordsStdin: false,
    lyricWordsFile: null,
    lyricJsonFile: null,
    shape: 'cross',
    canvasWidth: 160,
    canvasHeight: 200,
    cellWidth: 8,
    cellHeight: 4,
    gapX: 0.5,
    gapY: 0.5,
    crossVw: 0.33,  // vertical bar width fraction
    crossHh: 0.33,  // horizontal bar height fraction
    crossVy: 0.5,   // vertical bar center y-fraction (0 = top, 1 = bottom)
    crossHx: 0.5,   // horizontal bar center x-fraction
    prefix: 'w',
    theme: 'saintbilly',
    font: null,
    template: null,
    out: null,
    stdout: false,
    noRepeat: false,
    shuffle: false,
    seed: 42,
    revealMs: null,
    revealSection: null,
    rotate: 0,
    rotateChoices: null,     // null = disabled; array of degrees when set
    rotateJitter: 0,
    rotateRadial: false,
    rotateJitterSeed: null,  // null = share --seed value
    scaleMin: 1,
    scaleMax: 1,
    scaleSeed: null,         // null = share --seed + 17
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const nextArg = () => {
      const v = argv[++i];
      if (v === undefined) die(`Missing value for ${a}`);
      return v;
    };

    if (a === '--words') args.wordsFile = nextArg();
    else if (a === '--words-stdin') args.wordsStdin = true;
    else if (a === '--lyric-words') args.lyricWordsFile = nextArg();
    else if (a === '--json-words') args.lyricJsonFile = nextArg();
    else if (a === '--shape') args.shape = nextArg().toLowerCase();
    else if (a === '--canvas-width') args.canvasWidth = Number(nextArg());
    else if (a === '--canvas-height') args.canvasHeight = Number(nextArg());
    else if (a === '--cell-width') args.cellWidth = Number(nextArg());
    else if (a === '--cell-height') args.cellHeight = Number(nextArg());
    else if (a === '--gap-x') args.gapX = Number(nextArg());
    else if (a === '--gap-y') args.gapY = Number(nextArg());
    else if (a === '--cross-vw') args.crossVw = Number(nextArg());
    else if (a === '--cross-hh') args.crossHh = Number(nextArg());
    else if (a === '--cross-vy') args.crossVy = Number(nextArg());
    else if (a === '--cross-hx') args.crossHx = Number(nextArg());
    else if (a === '--prefix') args.prefix = nextArg();
    else if (a === '--theme') args.theme = nextArg();
    else if (a === '--font') args.font = nextArg();
    else if (a === '--template') args.template = nextArg();
    else if (a === '--out') args.out = nextArg();
    else if (a === '--stdout') args.stdout = true;
    else if (a === '--no-repeat') args.noRepeat = true;
    else if (a === '--shuffle') args.shuffle = true;
    else if (a === '--seed') args.seed = Number(nextArg());
    else if (a === '--reveal-ms') args.revealMs = Number(nextArg());
    else if (a === '--reveal-section') args.revealSection = nextArg();
    else if (a === '--rotate') args.rotate = Number(nextArg());
    else if (a === '--rotate-choices') args.rotateChoices = nextArg().split(',').map(s => Number(s.trim()));
    else if (a === '--rotate-jitter') args.rotateJitter = Number(nextArg());
    else if (a === '--rotate-radial') args.rotateRadial = true;
    else if (a === '--rotate-jitter-seed') args.rotateJitterSeed = Number(nextArg());
    else if (a === '--scale-min') args.scaleMin = Number(nextArg());
    else if (a === '--scale-max') args.scaleMax = Number(nextArg());
    else if (a === '--scale-seed') args.scaleSeed = Number(nextArg());
    else if (a === '--help' || a === '-h') {
      process.stdout.write(HELP);
      process.exit(0);
    } else if (a.startsWith('-')) {
      die(`Unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }

  // Positional fallback: first positional arg is --words
  if (!args.wordsFile && !args.wordsStdin && !args.lyricWordsFile && !args.lyricJsonFile && positional[0]) {
    args.wordsFile = positional[0];
  }

  return args;
}

const HELP = `Usage: node scripts/wordart-to-worlds-md.js [options]

Word sources (pick one):
  --words <file>          Whitespace-separated words from a plain-text file
  --words-stdin           Read words from stdin
  --lyric-words <file>    Extract words from a \`\`\`timed name:lyricWords block in an .md file
  --json-words <file>     Parse [{"timestamp":[startSec,endSec],"text":"phrase"}] JSON;
                          timestamps are distributed evenly across each phrase's words

Shape options:
  --shape <name>          cross | circle | diamond | heart | star5 | rect | pillv | pillh
  --canvas-width <n>      Canvas width in world units (default: 160)
  --canvas-height <n>     Canvas height in world units (default: 200)
  --cell-width <n>        Cell width in world units (default: 8)
  --cell-height <n>       Cell height in world units (default: 4)
  --gap-x <n>             Extra gap between cells horizontally (default: 0.5)
  --gap-y <n>             Extra gap between cells vertically (default: 0.5)

Cross-specific:
  --cross-vw <f>          Vertical bar width fraction 0..1 (default: 0.33)
  --cross-hh <f>          Horizontal bar height fraction 0..1 (default: 0.33)
  --cross-vy <f>          Vertical bar center y-fraction 0..1 from top (default: 0.5)
  --cross-hx <f>          Horizontal bar center x-fraction 0..1 from left (default: 0.5)

Output options:
  --prefix <str>          Section id prefix (default: "w")
  --theme <name>          Frontmatter theme (default: saintbilly)
  --font <name>           Font (e.g. Rye)
  --template <path>       Template .md file with <!-- WORDART_SECTIONS --> marker
  --out <path>            Output file path
  --stdout                Write output to stdout
  --no-repeat             Use each word once; stop early if shape has more cells than words
  --shuffle               Shuffle word list before packing
  --seed <n>              RNG seed for --shuffle (default: 42)
  --reveal-ms <n>         Append a reveal code comment for camera zoom-out at <ms>
  --reveal-section <s>    Section selector hint for the reveal snippet

Rotation options (combinable):
  --rotate <deg>          Fixed rotate-z for every section (default: 0)
  --rotate-choices <list> Comma-separated list of angles to pick randomly per section
                          e.g. --rotate-choices 0,90,-90  (overrides --rotate)
  --rotate-jitter <deg>   Max ±random rotation per section (default: 0)
  --rotate-radial         Point each section radially outward from the shape centre
  --rotate-jitter-seed <n> Independent seed for jitter (default: shares --seed)

Scale options:
  --scale-min <n>         Minimum section scale (default: 1)
  --scale-max <n>         Maximum scale; each section gets a random scale in [min,max] (default: 1)
  --scale-seed <n>        Independent seed for scale RNG (default: shares --seed + 17)

Per-word directives (--lyric-words source only):
  Append key:value tokens to any timed entry line to override scale/rotation
  for that specific word.  They take priority over global rotation/scale flags.

  Supported keys:
    rotate:<deg>   Override rotate-z for this word  e.g.  46346|towers rotate:90
    scale:<n>      Override scale for this word      e.g.  46346|towers scale:1.8

  Example:
    45000|One rotate:90 scale:1.4
    45897|man scale:0.8
    46346|towers rotate:-90

Timed reveals (automatic when using --lyric-words):
  When timing data is present the generated document automatically includes:
    • hidden: true on each timed section
    • A timed name:wordart-reveals block with per-word reveal events
    • on:init / on:update boilerplate to compile and apply the timeline
`;

// ---------------------------------------------------------------------------
// Word extraction
// ---------------------------------------------------------------------------

/**
 * Parse a ```timed name:lyricWords block, preserving per-entry timing and
 * optional inline key:value directives.
 *
 * Format per line:  ms|word [key:value ...]
 * Example:          46346|towers scale:1.8 rotate:90
 *
 * __BREAK__ and empty entries are filtered out.
 * Multi-word tokens ("Go on,") are split into individual sub-entries that
 * each carry the same ms and directives as their parent line.
 *
 * Returns: {ms: number|null, word: string, directives: Record<string,string>}[]
 */
function extractLyricEntries(mdText) {
  const fenceRe = /^```+\s*timed\s+name\s*:\s*lyricWords\b[^\n]*\n([\s\S]*?)^```+/gim;
  const entries = [];
  let match;
  while ((match = fenceRe.exec(mdText)) !== null) {
    const block = match[1];
    for (const rawLine of block.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const pipeIdx = line.indexOf('|');
      if (pipeIdx < 0) continue;
      const ms = parseInt(line.slice(0, pipeIdx), 10);
      const rest = line.slice(pipeIdx + 1).trim();
      if (!rest || rest === '__BREAK__') continue;

      // Split tokens: key:value pairs (where key is all word-chars) become
      // per-word directives; everything else is the word text.
      const tokens = rest.split(/\s+/);
      const wordTokens = [];
      const directives = {};
      for (const tok of tokens) {
        const colonIdx = tok.indexOf(':');
        if (colonIdx > 0 && colonIdx < tok.length - 1 &&
            /^[a-z-]+$/i.test(tok.slice(0, colonIdx))) {
          directives[tok.slice(0, colonIdx).toLowerCase()] = tok.slice(colonIdx + 1);
        } else if (tok) {
          wordTokens.push(tok);
        }
      }
      if (!wordTokens.length) continue;

      const entryMs = isNaN(ms) ? null : ms;
      // Each word token becomes its own entry (same ms + directives)
      for (const w of wordTokens) {
        const wt = w.trim();
        if (wt) entries.push({ ms: entryMs, word: wt, directives: { ...directives } });
      }
    }
  }
  return entries;
}

/** Backwards-compatible helper — returns just the words. */
function extractLyricWords(mdText) {
  return extractLyricEntries(mdText).map(e => e.word);
}

/**
 * Parse a [{timestamp:[startSec, endSec|null], text:"phrase"}] JSON file.
 *
 * Each phrase is split into individual words.  The timestamp start is used as
 * the base ms value, and each word within the phrase receives a timestamp
 * interpolated linearly across the phrase duration:
 *
 *   word[i].ms = startMs + round(i / wordCount * durationMs)
 *
 * Tokens surrounded by brackets (e.g. [Music]) are filtered out.
 * Leading/trailing punctuation is stripped so display text stays clean.
 *
 * Returns: {ms: number|null, word: string, directives: Record<string,string>}[]
 */
function extractJsonEntries(jsonText) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch (e) {
    die(`Failed to parse JSON: ${e.message}`);
  }
  if (!Array.isArray(data)) die('JSON input must be an array of {timestamp, text} entries.');

  const entries = [];
  for (const item of data) {
    const ts = item.timestamp;
    const startSec = Array.isArray(ts) && ts[0] != null ? Number(ts[0]) : null;
    const endSec   = Array.isArray(ts) && ts[1] != null ? Number(ts[1]) : null;
    const text = String(item.text || '').trim();
    if (!text) continue;

    // Tokenize, drop [Bracket] annotations, strip edge punctuation
    const wordTokens = text.split(/\s+/)
      .filter(t => t && !/^\[.*\]$/.test(t))
      .map(t => t.replace(/^[^\w'♪]+|[^\w'♪]+$/g, ''))
      .filter(Boolean);
    if (!wordTokens.length) continue;

    const startMs    = Number.isFinite(startSec) ? Math.round(startSec * 1000) : null;
    const durationMs = (Number.isFinite(startSec) && Number.isFinite(endSec))
      ? Math.round((endSec - startSec) * 1000)
      : 0;

    wordTokens.forEach((word, i) => {
      const ms = startMs !== null
        ? startMs + Math.round((i / wordTokens.length) * durationMs)
        : null;
      entries.push({ word, ms, directives: {} });
    });
  }
  return entries;
}

/**
 * Load words from the configured source, returning enriched entries:
 *   {word: string, ms: number|null, directives: Record<string,string>}[]
 *
 * Only --lyric-words sources carry timing and directives; plain text / stdin
 * sources return entries with ms: null and empty directives objects.
 */
function loadEnrichedWords(args) {
  if (args.lyricJsonFile) {
    const jsonText = fs.readFileSync(args.lyricJsonFile, 'utf8');
    const entries = extractJsonEntries(jsonText);
    if (!entries.length) die(`No word entries found in ${args.lyricJsonFile}`);
    return entries;
  }

  if (args.lyricWordsFile) {
    const mdText = fs.readFileSync(args.lyricWordsFile, 'utf8');
    const entries = extractLyricEntries(mdText);
    if (!entries.length) die(`No lyricWords entries found in ${args.lyricWordsFile}`);
    return entries;
  }

  let raw = '';
  if (args.wordsStdin) {
    raw = fs.readFileSync('/dev/stdin', 'utf8');
  } else if (args.wordsFile) {
    raw = fs.readFileSync(args.wordsFile, 'utf8');
  } else {
    die('No word source specified. Use --words, --words-stdin, or --lyric-words.');
  }

  const words = raw.split(/\s+/).map(s => s.trim()).filter(Boolean);
  if (!words.length) die('Word source is empty.');
  return words.map(w => ({ word: w, ms: null, directives: {} }));
}

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — no external deps
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Shape rasterizer
// ---------------------------------------------------------------------------

/**
 * Returns an array of {col, row} cells (in reading order, top-to-bottom,
 * left-to-right) that fall inside the given shape.
 *
 * Normalised coordinates: nx = col/cols, ny = row/rows (both in [0,1]).
 * Shape functions receive (nx, ny) and return true if inside.
 *
 * @param {Function} inShape  (nx: number, ny: number) => boolean
 * @param {number} cols  number of columns
 * @param {number} rows  number of rows
 */
function rasterize(inShape, cols, rows) {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const nx = (col + 0.5) / cols;
      const ny = (row + 0.5) / rows;
      if (inShape(nx, ny)) cells.push({ col, row });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Built-in shape definitions (all in normalised [0,1]×[0,1] space)
// ---------------------------------------------------------------------------

function shapeCross(opts) {
  const { vw = 0.33, hh = 0.33, vy = 0.5, hx = 0.5 } = opts;
  const vHalfW = vw / 2;
  const hHalfH = hh / 2;
  return (nx, ny) => {
    const inVBar = Math.abs(nx - hx) <= vHalfW;  // vertical bar (full height)
    const inHBar = Math.abs(ny - vy) <= hHalfH;  // horizontal bar (full width)
    return inVBar || inHBar;
  };
}

function shapeCircle() {
  return (nx, ny) => {
    const dx = nx - 0.5;
    const dy = ny - 0.5;
    return dx * dx + dy * dy <= 0.25; // radius 0.5 in normalised space
  };
}

function shapeDiamond() {
  return (nx, ny) => {
    return Math.abs(nx - 0.5) + Math.abs(ny - 0.5) <= 0.5;
  };
}

function shapeHeart() {
  // Classic parametric heart via two circles + bottom triangle.
  // Circles centred at (0.5±0.25, 0.35), radius 0.25; triangle below.
  const rc = 0.25;
  return (nx, ny) => {
    const ny2 = ny * 1.1 - 0.05; // slight vertical stretch
    const inLeft  = (nx - 0.25) ** 2 + (ny2 - 0.30) ** 2 <= rc * rc;
    const inRight = (nx - 0.75) ** 2 + (ny2 - 0.30) ** 2 <= rc * rc;
    // Lower triangle: apex at bottom centre (0.5, 0.9), base at y=0.55
    const triBase = 0.55;
    const triApex = 0.95;
    if (ny2 >= triBase && ny2 <= triApex) {
      const t = (ny2 - triBase) / (triApex - triBase); // 0..1 frm base to apex
      const halfW = (1 - t) * 0.5;
      if (Math.abs(nx - 0.5) <= halfW) return true;
    }
    return inLeft || inRight;
  };
}

function shapeStar5() {
  // 5-pointed star via point-in-polygon with 10 outer/inner vertices.
  const cx = 0.5, cy = 0.5;
  const R = 0.45, r = 0.20;
  const verts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI / 5) - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    verts.push({ x: cx + rad * Math.cos(angle), y: cy + rad * Math.sin(angle) });
  }
  return (nx, ny) => pointInPolygon(nx, ny, verts);
}

function shapeRect() {
  return () => true;
}

function shapePillV() {
  // Vertical pill: rectangle + two semicircles at top/bottom
  const rc = 0.3; // radius of the end caps
  return (nx, ny) => {
    if (Math.abs(nx - 0.5) > rc) return false; // outside horizontal bounds
    if (ny >= rc && ny <= 1 - rc) return true;  // middle band
    if (ny < rc) return (nx - 0.5) ** 2 + (ny - rc) ** 2 <= rc * rc;
    return (nx - 0.5) ** 2 + (ny - (1 - rc)) ** 2 <= rc * rc;
  };
}

function shapePillH() {
  // Horizontal pill: rectangle + two semicircles at left/right
  const rc = 0.3;
  return (nx, ny) => {
    if (Math.abs(ny - 0.5) > rc) return false;
    if (nx >= rc && nx <= 1 - rc) return true;
    if (nx < rc) return (nx - rc) ** 2 + (ny - 0.5) ** 2 <= rc * rc;
    return (nx - (1 - rc)) ** 2 + (ny - 0.5) ** 2 <= rc * rc;
  };
}

/**
 * Simple point-in-polygon (even-odd rule).
 */
function pointInPolygon(px, py, verts) {
  let inside = false;
  const n = verts.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = verts[i].x, yi = verts[i].y;
    const xj = verts[j].x, yj = verts[j].y;
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getShapeFn(args) {
  switch (args.shape) {
    case 'cross':   return shapeCross({ vw: args.crossVw, hh: args.crossHh, vy: args.crossVy, hx: args.crossHx });
    case 'circle':  return shapeCircle();
    case 'diamond': return shapeDiamond();
    case 'heart':   return shapeHeart();
    case 'star5':   return shapeStar5();
    case 'rect':    return shapeRect();
    case 'pillv':   return shapePillV();
    case 'pillh':   return shapePillH();
    default: die(`Unknown shape "${args.shape}". Supported: cross, circle, diamond, heart, star5, rect, pillv, pillh`);
  }
}

// ---------------------------------------------------------------------------
// Rotation helpers
// ---------------------------------------------------------------------------

/**
 * Compute the radial angle (degrees) from the grid centre to the cell centre.
 * Returns 0 for the centre cell itself.
 * In Worlds Y-up space: angle 0 = pointing right, 90 = pointing up.
 */
function radialAngleDeg(col, row, cols, rows) {
  const cx = (cols - 1) / 2;
  const cy = (rows - 1) / 2;
  const dx = col - cx;
  const dy = -(row - cy);  // invert: rows increase downward, Y is up
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return 0;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/**
 * Compute the per-cell rotation (degrees) from the rotation options.
 * Priority: choices > (base + radial + jitter).
 */
function computeRotation(col, row, cols, rows, args, jitterRng) {
  // --rotate-choices: randomly pick one angle from the list, then add jitter
  if (args.rotateChoices && args.rotateChoices.length > 0) {
    const idx = Math.floor(jitterRng() * args.rotateChoices.length);
    let r = args.rotateChoices[idx];
    if (args.rotateJitter > 0) r += (jitterRng() * 2 - 1) * args.rotateJitter;
    r = ((r % 360) + 360) % 360;
    if (r > 180) r -= 360;
    return Math.abs(r) < 1e-6 ? 0 : r;
  }

  let r = args.rotate ?? 0;

  if (args.rotateRadial) {
    r += radialAngleDeg(col, row, cols, rows);
  }

  if (args.rotateJitter > 0 && jitterRng) {
    r += (jitterRng() * 2 - 1) * args.rotateJitter;
  }

  // Normalise to (-180, 180]
  r = ((r % 360) + 360) % 360;
  if (r > 180) r -= 360;
  return Math.abs(r) < 1e-6 ? 0 : r;
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

function pack(entries, cells, noRepeat) {
  if (!cells.length) die('Shape has zero cells. Try larger --canvas-* or smaller --cell-* values.');
  if (!entries.length) die('Word list is empty.');

  const count = noRepeat ? Math.min(entries.length, cells.length) : cells.length;
  const result = [];
  for (let i = 0; i < count; i++) {
    const e = entries[i % entries.length];
    result.push({
      word: e.word,
      ms: e.ms ?? null,
      directives: e.directives ?? {},
      ...cells[i],
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Markdown emission
// ---------------------------------------------------------------------------

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Build the worlds sections markdown from packed cells.
 *
 * Grid origin: world coordinate (0,0) is the top-left of the canvas *before*
 * centering.  After centering the cross (or other shape) sits at the origin.
 *
 * World Y is up, so rows at the top of the canvas have higher Y values.
 */
function buildSectionsMarkdown(packed, args) {
  const stepX = args.cellWidth + args.gapX;
  const stepY = args.cellHeight + args.gapY;
  const cols = Math.ceil(args.canvasWidth / stepX);
  const rows = Math.ceil(args.canvasHeight / stepY);

  // Center the grid around (0,0)
  const originX = -((cols - 1) * stepX) / 2;
  const originY =  ((rows - 1) * stepY) / 2; // Y-up: first row is highest

  // Rotation RNG — needed whenever rotate-choices or jitter is active
  const needsRotRng = (args.rotateChoices && args.rotateChoices.length > 0) || args.rotateJitter > 0;
  const jitterSeed = (args.rotateJitterSeed !== null && Number.isFinite(args.rotateJitterSeed))
    ? Math.abs(Math.round(args.rotateJitterSeed))
    : (Math.abs(Math.round(args.seed)) + 9973);
  const jitterRng = needsRotRng ? mulberry32(jitterSeed) : null;

  // Scale RNG
  const useScale = Number.isFinite(args.scaleMin) && Number.isFinite(args.scaleMax) && args.scaleMax > args.scaleMin;
  const scaleSeed = (args.scaleSeed !== null && Number.isFinite(args.scaleSeed))
    ? Math.abs(Math.round(args.scaleSeed))
    : (Math.abs(Math.round(args.seed)) + 17);
  const scaleRng = useScale ? mulberry32(scaleSeed) : null;

  // Timed mode: any entry with a finite ms gets hidden: true so the timeline
  // can reveal it at the right moment.
  const timedMode = packed.some(p => p.ms !== null && Number.isFinite(p.ms));

  const lines = [];
  packed.forEach(({ word, col, row, ms, directives = {} }, idx) => {
    const x = originX + col * stepX;
    const y = originY - row * stepY;        // Y-up: subtract row offset
    const id = `${args.prefix}-${idx}`;

    // Always advance RNG slots to keep sequence stable regardless of overrides.
    // If a per-word directive is present it replaces the computed value.
    const rngRotZ = computeRotation(col, row, cols, rows, args, jitterRng);
    const rotZ = ('rotate' in directives)
      ? (parseFloat(directives.rotate) || 0)
      : rngRotZ;

    const rngScale = (useScale && scaleRng)
      ? args.scaleMin + scaleRng() * (args.scaleMax - args.scaleMin)
      : null;
    const sectionScale = ('scale' in directives)
      ? (parseFloat(directives.scale) || null)
      : rngScale;

    const parts = [`x: ${formatNumber(x)}`, `y: ${formatNumber(y)}`];
    if (Math.abs(rotZ) > 1e-6) parts.push(`rotate-z: ${formatNumber(rotZ)}`);
    if (sectionScale !== null) parts.push(`scale: ${formatNumber(sectionScale)}`);
    // Embed the per-word timestamp directly in the section directive (same format
    // as timed section headings in the main ballad), and start hidden so the
    // on:update boilerplate can reveal each word at the right playback moment.
    if (timedMode && ms !== null && Number.isFinite(ms)) {
      parts.push(`timed: "${ms}ms"`);
      parts.push(`hidden: true`);
    }

    const directive = `{${parts.join(', ')}}`;
    lines.push(`# ${id} ${directive}`);
    lines.push('');
    lines.push(word);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

function buildRevealSnippet(args) {
  const ms = args.revealMs;
  const sec = args.revealSection ?? '"<SECTION_ID>"';
  return [
    '<!--',
    `  WORDART ZOOM-OUT REVEAL`,
    `  At ${ms}ms, animate the camera to frame all word-art sections.`,
    `  Add the snippet below to your on:update handler:`,
    '',
    `  // In your on:update (runs every frame):`,
    `  const REVEAL_SEC = ${(ms / 1000).toFixed(3)};`,
    `  if (getDemoTimeSec() >= REVEAL_SEC && !state.revealFired) {`,
    `    state.revealFired = true;`,
    `    // Frame all sections whose id starts with "${args.prefix}-"`,
    `    const selectors = doc.sectionsFlat()`,
    `      .filter(s => s.sectionId?.startsWith('${args.prefix}-'))`,
    `      .map(s => s.sectionId);`,
    `    worlds.camera.focusOnFrame({ sectionSelectors: selectors, fill: 0.85, padding: 20 });`,
    `  }`,
    '',
    `  // Or bind to a timed WorldsTimeline entry at ${ms}ms:`,
    `  // {"section": ${JSON.stringify(sec)}, "set": {"scale": {"x": 1, "y": 1}}}`,
    '-->',
  ].join('\n');
}

function applyTemplate(templateText, sectionsMarkdown, vars) {
  let out = String(templateText);
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  if (out.includes('<!-- WORDART_SECTIONS -->')) {
    return out.replace('<!-- WORDART_SECTIONS -->', sectionsMarkdown);
  }
  return `${out.trimEnd()}\n\n${sectionsMarkdown}\n`;
}

function buildFallbackDocument(sectionsMarkdown, hasTimed, args) {
  const parts = [
    '---',
    `title: "Word Art: ${args.shape}"`,
    `theme: "${args.theme}"`,
    ...(args.font ? [`font: "${args.font}"`] : []),
    '---',
    '',
  ];

  if (hasTimed) {
    // Outer-scope state shared between on:init and on:update.
    // The reveal track is built lazily in on:update from each section's
    // timedMs property (set via the `timed: "Nms"` heading directive) so
    // no separate `timed name:` fence block is required.
    parts.push(
      '```js',
      `var _wordRevealTrack = null;`,
      `var _wordRevealBuilt = false;`,
      '```',
      '',
    );
  }

  parts.push(
    '```js on:init',
    `worlds.presets.apply('story-editor');`,
    `worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });`,
    `worlds.config.setDefaults({`,
    `  keepRotation: true,`,
    `  straightenOnFocus: true,`,
    `  screenSpaceRecenter: true,`,
    `  screenSpaceRecenterIters: 5,`,
    `  sectionBorderEnabled: false,`,
    `  sectionRender: 'content',`,
    `  sectionOverflow: 'fit-y',`,
    `  sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.003;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',`,
    `});`,
    '```',
    '',
  );

  if (hasTimed) {
    parts.push(
      '```js on:update',
      `// Build reveal timeline once from each section's timed: directive`,
      `if (!_wordRevealBuilt) {`,
      `  const events = doc.sectionsFlat()`,
      `    .filter(s => s.sectionId?.startsWith('${args.prefix}-') && s.timedMs !== undefined)`,
      `    .map(s => ({ ms: s.timedMs, text: JSON.stringify({ section: s.sectionId, visible: true }) }));`,
      `  if (events.length) _wordRevealTrack = worlds.timeline.compile(events);`,
      `  _wordRevealBuilt = true;`,
      `}`,
      `if (_wordRevealTrack) worlds.timeline.apply(_wordRevealTrack, getDemoTimeSec());`,
      '```',
      '',
    );
  }

  parts.push(sectionsMarkdown, '');
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = parseArgs(process.argv.slice(2));

  // Validate numeric args
  for (const [k, v] of [
    ['--canvas-width',  args.canvasWidth],
    ['--canvas-height', args.canvasHeight],
    ['--cell-width',    args.cellWidth],
    ['--cell-height',   args.cellHeight],
  ]) {
    if (!Number.isFinite(v) || v <= 0) die(`Invalid value for ${k}: must be a positive number.`);
  }
  if (!Number.isFinite(args.gapX) || args.gapX < 0) die('--gap-x must be ≥ 0.');
  if (!Number.isFinite(args.gapY) || args.gapY < 0) die('--gap-y must be ≥ 0.');

  // Load words (enriched entries preserving per-word timing + directives)
  let entries = loadEnrichedWords(args);
  if (args.shuffle) {
    const rng = mulberry32(Math.abs(Math.round(args.seed)) || 42);
    entries = shuffle(entries, rng);
  }

  // Compute grid dimensions
  const stepX = args.cellWidth + args.gapX;
  const stepY = args.cellHeight + args.gapY;
  const cols = Math.max(1, Math.ceil(args.canvasWidth / stepX));
  const rows = Math.max(1, Math.ceil(args.canvasHeight / stepY));

  // Rasterize shape
  const shapeFn = getShapeFn(args);
  const cells = rasterize(shapeFn, cols, rows);

  if (!cells.length) {
    die(`Shape "${args.shape}" produced 0 cells at the current grid resolution (${cols}×${rows}). ` +
        `Try increasing --canvas-* or decreasing --cell-* values.`);
  }

  // Pack entries into cells (preserves ms + directives per cell)
  const packed = pack(entries, cells, args.noRepeat);

  // Detect whether any entry carries timing — drives the reveal boilerplate
  const hasTimed = packed.some(p => p.ms !== null && Number.isFinite(p.ms));

  // Emit markdown
  const sectionsMarkdown = buildSectionsMarkdown(packed, args);

  let md;
  if (args.template && fs.existsSync(args.template)) {
    const templateText = fs.readFileSync(args.template, 'utf8');
    md = applyTemplate(templateText, sectionsMarkdown, {
      SHAPE: args.shape,
      THEME: args.theme,
      FONT: args.font ?? '',
      PREFIX: args.prefix,
      CELL_COUNT: packed.length,
      WORD_COUNT: entries.length,
    });
  } else {
    md = buildFallbackDocument(sectionsMarkdown, hasTimed, args);
  }

  if (args.revealMs !== null && Number.isFinite(args.revealMs)) {
    md = `${md.trimEnd()}\n\n${buildRevealSnippet(args)}\n`;
  }

  if (!md.endsWith('\n')) md += '\n';

  // Determine output path
  const outPath = args.out ?? `wordart-${args.shape}.md`;

  if (args.stdout) {
    process.stdout.write(md);
  } else {
    fs.writeFileSync(outPath, md, 'utf8');
    const outAbs = path.resolve(outPath);
    process.stderr.write(
      `[wordart] Shape: ${args.shape} | Grid: ${cols}×${rows} | In-shape cells: ${cells.length} | Sections emitted: ${packed.length} | Words: ${entries.length}${hasTimed ? ' | Timed reveals: enabled' : ''}\n`
    );
    process.stderr.write(`[wordart] Wrote ${outAbs}\n`);
  }
}

main();
