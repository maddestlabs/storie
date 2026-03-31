#!/usr/bin/env node
/**
 * Convert a simple Inkscape SVG into a Worlds-ready Markdown document.
 *
 * Designed for authoring layouts in 2D (Inkscape) and retrofitting into Worlds sections.
 *
 * Usage:
 *   node scripts/svg-to-worlds-md.js docs/demos/demo.svg
 *   node scripts/svg-to-worlds-md.js docs/demos/demo.svg --out docs/demos/import-demo.md
 *
 * Options:
 *   --out <path>        Output markdown path (default: import-<svgBase>.md next to the svg)
 *   --template <path>   Template markdown file to use (default: docs/demos/worlds-import.md)
 *   --anchor <mode>     How to interpret SVG <text> x/y: "baseline-left" (default) or "point" (no correction)
 *   --scale <number>    Multiply all coordinates by this factor (default: 1)
 *   --flip-y <0|1>      Flip SVG Y-down to Worlds Y-up (default: 1)
 *   --center <0|1>      Center the imported points around (0,0) (default: 0)
 *   --stdout            Write to stdout instead of a file
 */

import fs from 'node:fs';
import path from 'node:path';

function die(message) {
  console.error(message);
  process.exit(1);
}

function decodeXmlEntities(text) {
  return String(text ?? '')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    template: 'docs/demos/worlds-import.md',
    anchor: 'baseline-left',
    scale: 1,
    flipY: true,
    center: false,
    stdout: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') {
      args.out = argv[++i] ?? null;
    } else if (a === '--template') {
      args.template = argv[++i] ?? null;
    } else if (a === '--anchor') {
      args.anchor = String(argv[++i] ?? '').trim().toLowerCase();
    } else if (a === '--scale') {
      args.scale = Number(argv[++i]);
    } else if (a === '--flip-y') {
      const v = argv[++i];
      args.flipY = v === undefined ? true : String(v) !== '0' && String(v).toLowerCase() !== 'false';
    } else if (a === '--center') {
      const v = argv[++i];
      args.center = v === undefined ? true : String(v) !== '0' && String(v).toLowerCase() !== 'false';
    } else if (a === '--stdout') {
      args.stdout = true;
    } else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/svg-to-worlds-md.js <input.svg> [--out file.md] [--template template.md] [--anchor baseline-left|point] [--scale n] [--flip-y 0|1] [--center 0|1] [--stdout]');
      process.exit(0);
    } else if (a.startsWith('-')) {
      die(`Unknown option: ${a}`);
    } else {
      positional.push(a);
    }
  }

  args.input = positional[0] ?? null;
  if (!args.input) die('Missing input SVG path.');
  if (!Number.isFinite(args.scale) || args.scale === 0) die('Invalid --scale value.');

  if (args.anchor !== 'baseline-left' && args.anchor !== 'point') {
    die('Invalid --anchor. Use "baseline-left" or "point".');
  }

  return args;
}

function parseSvgRootMetrics(svgXml) {
  // Best-effort unit mapping. We only need px→user-units for font-size.
  // If the SVG uses a mm viewBox that matches width="...mm", then 1 user unit ≈ 1mm.
  // Otherwise default to 1 user unit ≈ 1px.
  const svgTagMatch = /<svg\b([^>]*)>/i.exec(svgXml);
  const attrs = svgTagMatch ? parseAttributes(svgTagMatch[1] ?? '') : {};
  const widthRaw = String(attrs.width ?? '').trim();
  const heightRaw = String(attrs.height ?? '').trim();
  const viewBoxRaw = String(attrs.viewBox ?? '').trim();

  const parseLen = (raw) => {
    const m = /^\s*([+-]?(?:\d+\.?\d*|\d*\.?\d+))(mm|px|in|cm|pt)?\s*$/i.exec(String(raw ?? '').trim());
    if (!m) return null;
    return { value: Number(m[1]), unit: (m[2] || '').toLowerCase() };
  };

  const vb = viewBoxRaw.split(/\s+|\s*,\s*/).map((s) => Number(s)).filter((n) => Number.isFinite(n));
  const vbW = vb.length === 4 ? vb[2] : null;
  const vbH = vb.length === 4 ? vb[3] : null;

  const w = parseLen(widthRaw);
  const h = parseLen(heightRaw);

  const mmToUser = (() => {
    if (w && w.unit === 'mm' && Number.isFinite(vbW) && vbW > 0 && w.value > 0) return vbW / w.value;
    if (h && h.unit === 'mm' && Number.isFinite(vbH) && vbH > 0 && h.value > 0) return vbH / h.value;
    return null;
  })();

  const pxToUser = (() => {
    if (w && w.unit === 'px' && Number.isFinite(vbW) && vbW > 0 && w.value > 0) return vbW / w.value;
    if (h && h.unit === 'px' && Number.isFinite(vbH) && vbH > 0 && h.value > 0) return vbH / h.value;
    // Assume user units are mm if mm mapping exists; otherwise assume user units are px.
    if (mmToUser !== null) {
      const mmPerPx = 25.4 / 96;
      return mmPerPx * mmToUser;
    }
    return 1;
  })();

  return { pxToUser };
}

function parseStyleFontSize(styleText) {
  const style = String(styleText ?? '');
  const m = /(?:^|;)\s*font-size\s*:\s*([^;]+)\s*(?:;|$)/i.exec(style);
  if (!m) return null;
  return String(m[1]).trim();
}

function parseCssLengthToNumber(raw, pxToUser) {
  const m = /^\s*([+-]?(?:\d+\.?\d*|\d*\.?\d+))(px|mm|cm|in|pt)?\s*$/i.exec(String(raw ?? '').trim());
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] || 'px').toLowerCase();
  if (!Number.isFinite(value)) return null;
  if (unit === 'px') return value * pxToUser;
  if (unit === 'mm') return value; // when user units are mm, pxToUser already handled above; but if not, this is still a best-effort.
  if (unit === 'cm') return value * 10;
  if (unit === 'in') return value * 25.4;
  if (unit === 'pt') return (value * 25.4) / 72;
  return value * pxToUser;
}

// 2D affine matrix in SVG form: [a c e; b d f; 0 0 1]
function matIdentity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function matMultiply(m1, m2) {
  // m = m1 * m2
  return {
    a: m1.a * m2.a + m1.c * m2.b,
    b: m1.b * m2.a + m1.d * m2.b,
    c: m1.a * m2.c + m1.c * m2.d,
    d: m1.b * m2.c + m1.d * m2.d,
    e: m1.a * m2.e + m1.c * m2.f + m1.e,
    f: m1.b * m2.e + m1.d * m2.f + m1.f,
  };
}

function matApply(m, p) {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  };
}

function degToRad(deg) {
  return (deg * Math.PI) / 180;
}

function radToDeg(rad) {
  return (rad * 180) / Math.PI;
}

function parseNumberList(raw) {
  return String(raw)
    .trim()
    .split(/(?:\s+|\s*,\s*)/)
    .filter(Boolean)
    .map((s) => Number(s));
}

function parseTransform(transformText) {
  const t = String(transformText ?? '').trim();
  if (!t) return matIdentity();

  // Parse items like: translate(1 2) rotate(-90) matrix(a b c d e f)
  const re = /(matrix|translate|rotate|scale|skewX|skewY)\s*\(([^)]*)\)/g;
  let match;

  let mTotal = matIdentity();

  while ((match = re.exec(t))) {
    const name = match[1];
    const nums = parseNumberList(match[2]);

    let mOp = matIdentity();
    if (name === 'matrix') {
      const [a, b, c, d, e, f] = nums;
      if ([a, b, c, d, e, f].some((n) => !Number.isFinite(n))) continue;
      mOp = { a, b, c, d, e, f };
    } else if (name === 'translate') {
      const tx = nums[0] ?? 0;
      const ty = nums[1] ?? 0;
      mOp = { a: 1, b: 0, c: 0, d: 1, e: tx, f: ty };
    } else if (name === 'scale') {
      const sx = nums[0] ?? 1;
      const sy = nums.length > 1 ? (nums[1] ?? sx) : sx;
      mOp = { a: sx, b: 0, c: 0, d: sy, e: 0, f: 0 };
    } else if (name === 'rotate') {
      const angle = nums[0] ?? 0;
      const cx = nums[1];
      const cy = nums[2];
      const rad = degToRad(angle);
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const r = { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
      if (Number.isFinite(cx) && Number.isFinite(cy)) {
        const t1 = { a: 1, b: 0, c: 0, d: 1, e: cx, f: cy };
        const t2 = { a: 1, b: 0, c: 0, d: 1, e: -cx, f: -cy };
        mOp = matMultiply(t1, matMultiply(r, t2));
      } else {
        mOp = r;
      }
    } else if (name === 'skewX') {
      const angle = nums[0] ?? 0;
      const tan = Math.tan(degToRad(angle));
      mOp = { a: 1, b: 0, c: tan, d: 1, e: 0, f: 0 };
    } else if (name === 'skewY') {
      const angle = nums[0] ?? 0;
      const tan = Math.tan(degToRad(angle));
      mOp = { a: 1, b: tan, c: 0, d: 1, e: 0, f: 0 };
    }

    // SVG transform lists apply in order; for column vectors that means pre-multiplying.
    mTotal = matMultiply(mOp, mTotal);
  }

  return mTotal;
}

function rotationDegFromMatrix(m) {
  // Best-effort: angle from the matrix's (a,b) assuming mostly rotate/translate (+ optional scale)
  const angle = Math.atan2(m.b, m.a);
  return radToDeg(angle);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function formatNumber(n) {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 1000) / 1000;
  // Avoid "-0"
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

function parseAttributes(openTag) {
  const attrs = {};
  const re = /([:\w.-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = re.exec(openTag))) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

function extractTextSpans(textNodeInnerXml) {
  // Prefer tspans with role=line.
  const tspanRe = /<tspan\b([^>]*)>([\s\S]*?)<\/tspan>/g;
  const spans = [];
  let match;
  while ((match = tspanRe.exec(textNodeInnerXml))) {
    const attrs = parseAttributes(match[1] ?? '');
    const raw = match[2]
      .replace(/<[^>]+>/g, '')
      .replace(/\r\n?/g, '\n');
    const decoded = decodeXmlEntities(raw).trimEnd();
    if (decoded.length) {
      const sx = Number(attrs.x ?? NaN);
      const sy = Number(attrs.y ?? NaN);
      spans.push({
        text: decoded,
        x: Number.isFinite(sx) ? sx : null,
        y: Number.isFinite(sy) ? sy : null,
      });
    }
  }

  if (spans.length) return spans;

  const stripped = decodeXmlEntities(String(textNodeInnerXml).replace(/<[^>]+>/g, '')).trim();
  return stripped ? [{ text: stripped, x: null, y: null }] : [];
}

function estimateTextMetricsInUserUnits(spans, fontSizeUser) {
  const lines = spans.map((s) => s.text);
  const maxChars = lines.reduce((m, s) => Math.max(m, String(s).length), 0);
  const charWidth = fontSizeUser * 0.62; // heuristic; works OK for mono-ish fonts
  const estWidth = Math.max(0, maxChars * charWidth);

  // Height: if tspan y values exist, use their spread; otherwise line-height heuristic.
  const ys = spans.map((s) => s.y).filter((y) => Number.isFinite(y));
  let estHeight = 0;
  if (ys.length >= 2) {
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    estHeight = (maxY - minY) + fontSizeUser;
  } else {
    const lineHeight = fontSizeUser * 1.25;
    estHeight = Math.max(fontSizeUser, lines.length * lineHeight);
  }

  const ascent = fontSizeUser * 0.8; // heuristic

  return { estWidth, estHeight, ascent };
}

function parseSvgTextElements(svgXml) {
  const textBlocks = [];

  const rootMetrics = parseSvgRootMetrics(svgXml);
  const pxToUser = rootMetrics.pxToUser;

  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = re.exec(svgXml))) {
    const openAttrs = match[1] ?? '';
    const innerXml = match[2] ?? '';
    const attrs = parseAttributes(openAttrs);

    const x = Number(attrs.x ?? '0');
    const y = Number(attrs.y ?? '0');
    const transform = attrs.transform ?? '';
    const id = attrs.id ?? null;
    const style = attrs.style ?? '';

    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const spans = extractTextSpans(innerXml);
    if (!spans.length) continue;
    const lines = spans.map((s) => s.text);

    const fontSizeRaw = parseStyleFontSize(style);
    const fontSizeUser = (() => {
      const n = parseCssLengthToNumber(fontSizeRaw ?? '16px', pxToUser);
      return Number.isFinite(n) && n > 0 ? n : (16 * pxToUser);
    })();
    const metrics = estimateTextMetricsInUserUnits(spans, fontSizeUser);

    const m = parseTransform(transform);
    const p = matApply(m, { x, y });
    const rot = rotationDegFromMatrix(m);

    textBlocks.push({ id, lines, spans, point: p, rotationDeg: rot, fontSizeUser, metrics, raw: { x, y }, matrix: m });
  }

  return textBlocks;
}

function buildDirective({ x, y, rotateZ }) {
  const parts = [`x: ${formatNumber(x)}`, `y: ${formatNumber(y)}`];
  if (Math.abs(rotateZ) > 1e-6) parts.push(`rotate-z: ${formatNumber(rotateZ)}`);
  return `{${parts.join(', ')}}`;
}

function buildSectionsMarkdown(items) {
  return items
    .map((it, idx) => {
      const heading = (typeof it.id === 'string' && it.id.trim().length)
        ? it.id.trim()
        : `section-${idx + 1}`;
      const content = it.lines.join('\n').trim();
      const directive = buildDirective({ x: it.x, y: it.y, rotateZ: it.rotateZ });
      return [
        `# ${heading} ${directive}`,
        '',
        content,
      ].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function applyTemplate(templateText, vars, sectionsMarkdown) {
  let out = String(templateText ?? '');
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  if (out.includes('<!-- SVG_TO_WORLDS_SECTIONS -->')) {
    out = out.replace('<!-- SVG_TO_WORLDS_SECTIONS -->', sectionsMarkdown);
    return out;
  }
  // Fallback: append
  return `${out.trimEnd()}\n\n${sectionsMarkdown}\n`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const svgPath = options.input;

  const svgXml = fs.readFileSync(svgPath, 'utf8');
  const blocks = parseSvgTextElements(svgXml);
  if (!blocks.length) die('No <text> elements found to convert.');

  // Convert coordinates
  const converted = blocks.map((b) => {
    const dxLocal = (() => {
      if (options.anchor === 'point') return 0;
      // Convert SVG baseline-left anchor point into an approximate center point.
      return (b.metrics?.estWidth ?? 0) / 2;
    })();
    const dyLocal = (() => {
      if (options.anchor === 'point') return 0;
      const ascent = b.metrics?.ascent ?? 0;
      const h = b.metrics?.estHeight ?? 0;
      return (-ascent + h / 2);
    })();

    const pCenter = (options.anchor === 'point')
      ? b.point
      : matApply(b.matrix, { x: b.raw.x + dxLocal, y: b.raw.y + dyLocal });

    let x = pCenter.x * options.scale;
    let y = pCenter.y * options.scale;
    let rotZ = b.rotationDeg;

    if (options.flipY) {
      y = -y;
      rotZ = -rotZ;
    }

    return {
      id: b.id,
      lines: b.lines,
      x,
      y,
      rotateZ: rotZ,
    };
  });

  if (options.center) {
    const xs = converted.map((c) => c.x);
    const ys = converted.map((c) => c.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    for (const c of converted) {
      c.x -= cx;
      c.y -= cy;
    }
  }

  // Sort roughly top-to-bottom then left-to-right (in Worlds Y-up coordinates)
  converted.sort((a, b) => {
    const dy = b.y - a.y;
    if (Math.abs(dy) > 1e-6) return dy;
    return a.x - b.x;
  });

  // Normalize rotations to [-180, 180)
  for (const c of converted) {
    let r = c.rotateZ;
    if (!Number.isFinite(r)) r = 0;
    while (r >= 180) r -= 360;
    while (r < -180) r += 360;
    // Avoid tiny -0
    if (Math.abs(r) < 1e-6) r = 0;
    c.rotateZ = r;
  }

  const baseName = path.basename(svgPath);
  const baseNoExt = baseName.replace(/\.[^.]+$/, '');
  const defaultOut = path.join(path.dirname(svgPath), `import-${baseNoExt}.md`);
  const outPath = options.out ?? defaultOut;

  const sectionsMarkdown = buildSectionsMarkdown(converted);

  const templatePath = options.template;
  let md;
  if (templatePath && fs.existsSync(templatePath)) {
    const templateText = fs.readFileSync(templatePath, 'utf8');
    md = applyTemplate(templateText, {
      SVG_FILENAME: baseName,
      SVG_BASENAME: baseNoExt,
      SVG_PATH: svgPath,
      OUTPUT_FILENAME: path.basename(outPath),
      OUTPUT_PATH: outPath,
    }, sectionsMarkdown);
    if (!md.endsWith('\n')) md += '\n';
  } else {
    // Minimal fallback if template is missing.
    md = [
      '---',
      `title: "SVG Import: ${baseName.replaceAll('"', '\\"')}"`,
      'theme: "saintbilly"',
      '---',
      '',
      sectionsMarkdown,
      '',
    ].join('\n');
  }

  if (options.stdout) {
    process.stdout.write(md);
    return;
  }

  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`Wrote ${outPath}`);
}

main();
