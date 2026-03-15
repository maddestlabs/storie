import type { DocNode, Inline, LayoutBox, LayoutResult, LinkRegion, MarkdownStyle, TextMetrics, DrawOp } from './types.js';

type Run =
  | { kind: 'text' | 'link' | 'code'; text: string; url?: string }
  | { kind: 'newline' };

function tokenizeInlines(inlines: Inline[]): Run[] {
  const runs: Run[] = [];
  for (const inline of inlines) {
    if (inline.kind === 'text') {
      // preserve spaces by splitting with capture
      const parts = inline.text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        runs.push({ kind: 'text', text: p });
      }
    } else if (inline.kind === 'newline') {
      runs.push({ kind: 'newline' });
    } else if (inline.kind === 'link') {
      // Keep the link label as a single run so hit-testing + keyboard navigation
      // treat it as one link (not a separate link per word).
      // wrapRuns() will still hard-break extremely long labels if needed.
      runs.push({ kind: 'link', text: inline.text, url: inline.url });
    } else {
      // code
      runs.push({ kind: 'code', text: inline.text });
    }
  }
  return runs;
}

function wrapRuns(runs: Run[], maxChars: number): Run[][] {
  const lines: Run[][] = [];
  let current: Run[] = [];
  let used = 0;

  const pushLine = () => {
    // trim leading whitespace
    while (current.length > 0 && current[0].kind !== 'newline' && /^\s+$/.test((current[0] as any).text)) current.shift();
    // trim trailing whitespace
    while (current.length > 0 && current[current.length - 1].kind !== 'newline' && /^\s+$/.test((current[current.length - 1] as any).text)) current.pop();
    lines.push(current);
    current = [];
    used = 0;
  };

  for (const run of runs) {
    if (run.kind === 'newline') {
      pushLine();
      continue;
    }

    const len = run.text.length;

    // Hard-break huge tokens
    if (len > maxChars && !/^\s+$/.test(run.text)) {
      if (current.length > 0) pushLine();
      let start = 0;
      while (start < run.text.length) {
        const chunk = run.text.slice(start, start + maxChars);
        lines.push([{ ...run, text: chunk }]);
        start += maxChars;
      }
      continue;
    }

    if (used + len > maxChars && current.length > 0) {
      pushLine();
    }

    // If at line start, avoid leading whitespace
    if (current.length === 0 && /^\s+$/.test(run.text)) {
      continue;
    }

    current.push(run);
    used += len;
  }

  if (current.length > 0) pushLine();
  if (lines.length === 0) lines.push([]);
  return lines;
}

function hardBreakByWidth(text: string, maxWidthPx: number, measure: (s: string) => number): string[] {
  const out: string[] = [];
  let current = '';
  for (const ch of text) {
    const next = current + ch;
    if (current.length > 0 && measure(next) > maxWidthPx) {
      out.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current.length > 0) out.push(current);
  return out.length > 0 ? out : [''];
}

function wrapRunsByWidth(runs: Run[], maxWidthPx: number, measure: (s: string) => number): Run[][] {
  const lines: Run[][] = [];
  let current: Run[] = [];
  let usedPx = 0;

  const pushLine = () => {
    while (current.length > 0 && current[0].kind !== 'newline' && /^\s+$/.test((current[0] as any).text)) current.shift();
    while (
      current.length > 0 &&
      current[current.length - 1].kind !== 'newline' &&
      /^\s+$/.test((current[current.length - 1] as any).text)
    ) {
      current.pop();
    }
    lines.push(current);
    current = [];
    usedPx = 0;
  };

  for (const run of runs) {
    if (run.kind === 'newline') {
      pushLine();
      continue;
    }

    // If at line start, avoid leading whitespace
    if (current.length === 0 && /^\s+$/.test(run.text)) {
      continue;
    }

    const runW = measure(run.text);

    // Hard-break huge tokens that exceed a full line.
    if (runW > maxWidthPx && !/^\s+$/.test(run.text)) {
      if (current.length > 0) pushLine();
      const chunks = hardBreakByWidth(run.text, maxWidthPx, measure);
      for (const chunk of chunks) {
        lines.push([{ ...run, text: chunk }]);
      }
      continue;
    }

    if (usedPx + runW > maxWidthPx && current.length > 0) {
      pushLine();
    }

    current.push(run);
    usedPx += runW;
  }

  if (current.length > 0) pushLine();
  if (lines.length === 0) lines.push([]);
  return lines;
}

export function layoutMarkdownDocument(
  nodes: DocNode[],
  box: LayoutBox,
  metrics: TextMetrics,
  style: MarkdownStyle,
  scrollY: number = 0,
  padding: number = 10,
  options?: { overflow?: 'clip' | 'expand' }
): LayoutResult {
  const ops: DrawOp[] = [];
  const linkRegions: LinkRegion[] = [];
  let linkIndex = 0;
  const linkUnderline = style.linkUnderline ?? true;

  const charW = Math.max(1, metrics.charW);
  const charH = Math.max(1, metrics.charH);
  const measure = typeof metrics.measureTextWidth === 'function' ? metrics.measureTextWidth : null;

  const x0 = box.x;
  const y0 = box.y;
  const innerW = Math.max(1, box.width - padding * 2);

  const maxChars = Math.max(1, Math.floor(innerW / charW));

  const baseLineHeight = Math.round(charH * 1.25);
  const paragraphGap = Math.round(charH * 0.75);

  const overflow = options?.overflow === 'expand' ? 'expand' : 'clip';

  // Background
  ops.push({ kind: 'rect', x: x0, y: y0, w: box.width, h: box.height, color: style.bg });

  let cursorY = y0 + padding - scrollY;

  // Content bounds for measuring required size (excluding the background rect).
  const contentStartX = x0 + padding;
  const contentStartY = y0 + padding - scrollY;
  let contentMaxX = contentStartX;
  let contentMaxY = contentStartY;

  const bumpMax = (x: number, y: number, w: number, h: number) => {
    if (w > 0) contentMaxX = Math.max(contentMaxX, x + w);
    if (h > 0) contentMaxY = Math.max(contentMaxY, y + h);
  };

  const emitTextLine = (line: Run[], lineX: number, lineY: number, fgOverride?: any) => {
    let cx = lineX;
    for (const run of line) {
      if (run.kind === 'newline') continue;
      const isActiveLink = run.kind === 'link' && style.activeLinkIndex === linkIndex;
      const color =
        fgOverride ??
        (run.kind === 'link'
          ? (isActiveLink ? (style.activeLinkFg ?? style.linkFg) : style.linkFg)
          : run.kind === 'code'
            ? style.codeFg
            : style.fg);

      // code: draw a small background behind the run
      if (run.kind === 'code' && run.text.trim().length > 0) {
        const w = measure ? measure(run.text) : run.text.length * charW;
        ops.push({ kind: 'rect', x: cx, y: lineY - Math.round(charH * 0.15), w, h: Math.round(charH * 1.15), color: style.codeBg });
        bumpMax(cx, lineY - Math.round(charH * 0.15), w, Math.round(charH * 1.15));
      }

      ops.push({ kind: 'text', text: run.text, x: cx, y: lineY, color });
      {
        const w = measure ? measure(run.text) : run.text.length * charW;
        bumpMax(cx, lineY, w, charH);
      }

      if (run.kind === 'link' && run.url && run.text.trim().length > 0) {
        const w = measure ? measure(run.text) : run.text.length * charW;
        linkRegions.push({ x: cx, y: lineY, w, h: charH, url: run.url, text: run.text });
        if (linkUnderline) {
          ops.push({ kind: 'rect', x: cx, y: lineY + charH - 2, w, h: 2, color });
          bumpMax(cx, lineY + charH - 2, w, 2);
        }
        linkIndex++;
      }

      cx += measure ? measure(run.text) : run.text.length * charW;
    }
  };

  for (const node of nodes) {
    // Storie uses fenced code blocks primarily for scripting (on:init/on:enter/etc).
    // They should not be rendered as visible content.
    if (node.kind === 'codeblock') {
      const lang = (node as any).lang as string | undefined;
      const meta = (node as any).metadata as Record<string, string> | undefined;
      const isRawAscii = typeof lang === 'string' && lang === 'ascii' && !String(meta?.name ?? '').trim();

      if (!isRawAscii) {
        continue;
      }

      // Render ASCII fences as preformatted text (no wrapping; preserve spaces).
      cursorY += Math.round(charH * 0.15);
      const fg = style.codeFg;
      const codeLines = (node.code || '').replace(/\r\n/g, '\n').split('\n');
      for (const rawLine of codeLines) {
        if (overflow === 'clip' && cursorY > y0 + box.height) break;
        // Preserve trailing spaces visually is hard in a glyph renderer;
        // keep leading/middle spaces and trim only right-side newlines.
        const line = (rawLine ?? '').trimEnd();
        if (!(overflow === 'clip' && cursorY > y0 + box.height)) {
          ops.push({ kind: 'text', text: line, x: x0 + padding, y: cursorY, color: fg });
        }
        {
          const w = measure ? measure(line) : line.length * charW;
          bumpMax(x0 + padding, cursorY, w, charH);
        }
        cursorY += baseLineHeight;
      }
      cursorY += paragraphGap;
      continue;
    }

    if (node.kind === 'heading') {
      cursorY += Math.round(charH * 0.25);
      const runs = tokenizeInlines(node.inlines);
      const lines = measure ? wrapRunsByWidth(runs, innerW, measure) : wrapRuns(runs, maxChars);
      const fg = style.headingFg;

      for (const ln of lines) {
        emitTextLine(ln, x0 + padding, cursorY, fg);
        cursorY += baseLineHeight;
      }
      cursorY += Math.round(charH * 0.2);
      continue;
    }

    if (node.kind === 'paragraph') {
      const runs = tokenizeInlines(node.inlines);
      const lines = measure ? wrapRunsByWidth(runs, innerW, measure) : wrapRuns(runs, maxChars);
      for (const ln of lines) {
        emitTextLine(ln, x0 + padding, cursorY);
        cursorY += baseLineHeight;
      }
      cursorY += paragraphGap;
      continue;
    }

    if (node.kind === 'list') {
      const customMarkerText = style.listMarker === undefined ? '- ' : String(style.listMarker ?? '');
      const gapPx = Number.isFinite(style.listMarkerGapPx as number)
        ? Math.max(0, style.listMarkerGapPx as number)
        : undefined;
      const markerColor = style.listMarkerFg ?? style.fg;

      for (let itemIndex = 0; itemIndex < node.items.length; itemIndex++) {
        const item = node.items[itemIndex];
        const markerText = node.ordered
          ? `${(node.start ?? 1) + itemIndex}.`
          : customMarkerText;
        const markerWidth = markerText.length > 0
          ? (measure ? measure(markerText) : markerText.length * charW)
          : 0;
        const defaultGapPx = markerText.length > 0 && !/\s$/.test(markerText) ? charW : 0;
        const resolvedGapPx = gapPx ?? defaultGapPx;
        const markerAdvance = markerText.length > 0 ? markerWidth + resolvedGapPx : 0;
        const hangIndentPx = Number.isFinite(style.listHangIndentPx as number)
          ? Math.max(0, style.listHangIndentPx as number)
          : markerAdvance;
        const wrapIndentPx = Math.max(markerAdvance, hangIndentPx);
        const listInnerWidth = Math.max(1, innerW - wrapIndentPx);
        const listMaxChars = Math.max(1, Math.floor(listInnerWidth / charW));
        const itemRuns = tokenizeInlines(item);
        const lines = measure
          ? wrapRunsByWidth(itemRuns, listInnerWidth, measure)
          : wrapRuns(itemRuns, listMaxChars);
        let first = true;
        for (const ln of lines) {
          if (first && markerText.length > 0) {
            ops.push({ kind: 'text', text: markerText, x: x0 + padding, y: cursorY, color: markerColor });
            bumpMax(x0 + padding, cursorY, markerWidth, charH);
          }
          const x = x0 + padding + (first ? markerAdvance : hangIndentPx);
          emitTextLine(ln, x, cursorY);
          cursorY += baseLineHeight;
          first = false;
        }
      }
      cursorY += paragraphGap;
      continue;
    }
  }

  const contentHeight = Math.max(0, cursorY - (y0 + padding - scrollY));
  const contentWidth = Math.max(0, contentMaxX - (x0 + padding));

  return { ops, linkRegions, contentWidth, contentHeight };
}
