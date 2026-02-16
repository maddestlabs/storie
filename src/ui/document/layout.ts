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

export function layoutMarkdownDocument(
  nodes: DocNode[],
  box: LayoutBox,
  metrics: TextMetrics,
  style: MarkdownStyle,
  scrollY: number = 0,
  padding: number = 10
): LayoutResult {
  const ops: DrawOp[] = [];
  const linkRegions: LinkRegion[] = [];

  const charW = Math.max(1, metrics.charW);
  const charH = Math.max(1, metrics.charH);

  const x0 = box.x;
  const y0 = box.y;
  const innerW = Math.max(1, box.width - padding * 2);

  const maxChars = Math.max(1, Math.floor(innerW / charW));

  const baseLineHeight = Math.round(charH * 1.25);
  const paragraphGap = Math.round(charH * 0.75);

  // Background
  ops.push({ kind: 'rect', x: x0, y: y0, w: box.width, h: box.height, color: style.bg });

  let cursorY = y0 + padding - scrollY;

  const emitTextLine = (line: Run[], lineX: number, lineY: number, fgOverride?: any) => {
    let cx = lineX;
    for (const run of line) {
      if (run.kind === 'newline') continue;
      const color =
        fgOverride ??
        (run.kind === 'link' ? style.linkFg : run.kind === 'code' ? style.codeFg : style.fg);

      // code: draw a small background behind the run
      if (run.kind === 'code' && run.text.trim().length > 0) {
        const w = run.text.length * charW;
        ops.push({ kind: 'rect', x: cx, y: lineY - Math.round(charH * 0.15), w, h: Math.round(charH * 1.15), color: style.codeBg });
      }

      ops.push({ kind: 'text', text: run.text, x: cx, y: lineY, color });

      if (run.kind === 'link' && run.url && run.text.trim().length > 0) {
        linkRegions.push({ x: cx, y: lineY, w: run.text.length * charW, h: charH, url: run.url, text: run.text });
        // underline
        ops.push({ kind: 'rect', x: cx, y: lineY + charH - 2, w: run.text.length * charW, h: 2, color: style.linkFg });
      }

      cx += run.text.length * charW;
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
        if (cursorY > y0 + box.height) break;
        // Preserve trailing spaces visually is hard in a glyph renderer;
        // keep leading/middle spaces and trim only right-side newlines.
        const line = (rawLine ?? '').trimEnd();
        ops.push({ kind: 'text', text: line, x: x0 + padding, y: cursorY, color: fg });
        cursorY += baseLineHeight;
      }
      cursorY += paragraphGap;
      continue;
    }

    if (node.kind === 'heading') {
      cursorY += Math.round(charH * 0.25);
      const runs = tokenizeInlines(node.inlines);
      const lines = wrapRuns(runs, maxChars);
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
      const lines = wrapRuns(runs, maxChars);
      for (const ln of lines) {
        emitTextLine(ln, x0 + padding, cursorY);
        cursorY += baseLineHeight;
      }
      cursorY += paragraphGap;
      continue;
    }

    if (node.kind === 'list') {
      const indentChars = 2;
      const bullet = '- ';
      for (const item of node.items) {
        const itemRuns = [{ kind: 'text' as const, text: bullet }, ...tokenizeInlines(item)];
        const lines = wrapRuns(itemRuns, Math.max(1, maxChars - indentChars));
        let first = true;
        for (const ln of lines) {
          const x = x0 + padding + (first ? 0 : bullet.length * charW);
          // for wrapped lines, indent without repeating bullet
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

  return { ops, linkRegions, contentHeight };
}
