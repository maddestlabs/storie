import type { DocNode, Inline, LayoutBox, LayoutResult, LinkRegion, MarkdownStyle, TextMetrics, DrawOp, WidgetPlacement, WidgetSpec, LayoutOptions } from './types.js';

type Run =
  | { kind: 'text' | 'link' | 'code'; text: string; url?: string }
  | { kind: 'widget'; widget: WidgetSpec }
  | { kind: 'newline' };

interface WrappedLine {
  runs: Run[];
  height: number;
}

function getLineWidth(line: WrappedLine, maxWidthPx: number, measure: ((text: string) => number) | null, charW: number, charH: number): number {
  let width = 0;
  for (const run of line.runs) {
    width += getRunWidth(run, maxWidthPx, measure, charW, charH);
  }
  return width;
}

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
    } else if (inline.kind === 'widget') {
      runs.push({ kind: 'widget', widget: inline.widget });
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

function isWhitespaceRun(run: Run | undefined): boolean {
  return !!run && run.kind !== 'newline' && run.kind !== 'widget' && /^\s+$/.test(run.text);
}

function resolveSizedWidth(width: string | undefined, maxWidth: number, fallbackWidth: number): number {
  if (!width) return Math.max(1, Math.min(maxWidth, Math.round(fallbackWidth)));
  const raw = String(width).trim().toLowerCase();
  if (raw.endsWith('%')) {
    const pct = Number.parseFloat(raw.slice(0, -1));
    if (Number.isFinite(pct) && pct > 0) {
      return Math.max(1, Math.min(maxWidth, Math.round(maxWidth * (pct / 100))));
    }
  }
  if (raw.endsWith('px')) {
    const px = Number.parseFloat(raw.slice(0, -2));
    if (Number.isFinite(px) && px > 0) {
      return Math.max(1, Math.min(maxWidth, Math.round(px)));
    }
  }
  return Math.max(1, Math.min(maxWidth, Math.round(fallbackWidth)));
}

function resolveInlineWidgetHeight(widget: WidgetSpec, charH: number): number {
  if (widget.type === 'slider') return Math.max(Math.round(charH * 1.9), 30);
  if (widget.type === 'button') return Math.max(Math.round(charH * 1.65), 28);
  if (widget.type === 'checkbox') return Math.max(Math.round(charH * 1.4), 24);
  return Math.max(charH, Math.round(charH * 1.1));
}

function resolveInlineWidgetWidth(widget: WidgetSpec, charW: number, charH: number, maxWidth: number, measure: ((text: string) => number) | null): number {
  const label = String(widget.label || widget.text || widget.id || '').trim();
  const labelWidth = label ? (measure ? measure(label) : label.length * charW) : 0;
  const checkboxBox = Math.max(14, Math.round(charH * 0.95));

  if (widget.type === 'button') {
    return resolveSizedWidth(widget.width, maxWidth, labelWidth + charW * 4.5);
  }
  if (widget.type === 'slider') {
    return resolveSizedWidth(widget.width, maxWidth, Math.max(charW * 16, labelWidth + charW * 11));
  }
  if (widget.type === 'checkbox') {
    return resolveSizedWidth(widget.width, maxWidth, checkboxBox + labelWidth + charW * 4);
  }
  return resolveSizedWidth(widget.width, maxWidth, Math.max(charW * 4, labelWidth + charW * 2));
}

function getRunWidth(run: Run, maxWidthPx: number, measure: ((text: string) => number) | null, charW: number, charH: number): number {
  if (run.kind === 'newline') return 0;
  if (run.kind === 'widget') return resolveInlineWidgetWidth(run.widget, charW, charH, maxWidthPx, measure);
  return measure ? measure(run.text) : run.text.length * charW;
}

function getRunHeight(run: Run, charH: number): number {
  if (run.kind === 'widget') return resolveInlineWidgetHeight(run.widget, charH);
  return charH;
}

function wrapRuns(runs: Run[], maxChars: number, charW: number, charH: number): WrappedLine[] {
  const lines: WrappedLine[] = [];
  let current: Run[] = [];
  let used = 0;
  let currentHeight = charH;

  const pushLine = () => {
    while (isWhitespaceRun(current[0])) current.shift();
    while (isWhitespaceRun(current[current.length - 1])) current.pop();
    lines.push({ runs: current, height: Math.max(charH, currentHeight) });
    current = [];
    used = 0;
    currentHeight = charH;
  };

  for (const run of runs) {
    if (run.kind === 'newline') {
      pushLine();
      continue;
    }

    const len = run.kind === 'widget'
      ? Math.max(1, Math.ceil(resolveInlineWidgetWidth(run.widget, charW, charH, maxChars * charW, null) / charW))
      : run.text.length;

    // Hard-break huge tokens
    if (run.kind !== 'widget' && len > maxChars && !/^\s+$/.test(run.text)) {
      if (current.length > 0) pushLine();
      let start = 0;
      while (start < run.text.length) {
        const chunk = run.text.slice(start, start + maxChars);
        lines.push({ runs: [{ ...run, text: chunk }], height: charH });
        start += maxChars;
      }
      continue;
    }

    if (used + len > maxChars && current.length > 0) {
      pushLine();
    }

    // If at line start, avoid leading whitespace
    if (current.length === 0 && isWhitespaceRun(run)) {
      continue;
    }

    current.push(run);
    used += len;
    currentHeight = Math.max(currentHeight, getRunHeight(run, charH));
  }

  if (current.length > 0) pushLine();
  if (lines.length === 0) lines.push({ runs: [], height: charH });
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

function wrapRunsByWidth(runs: Run[], maxWidthPx: number, measure: (s: string) => number, charW: number, charH: number): WrappedLine[] {
  const lines: WrappedLine[] = [];
  let current: Run[] = [];
  let usedPx = 0;
  let currentHeight = charH;

  const pushLine = () => {
    while (isWhitespaceRun(current[0])) current.shift();
    while (isWhitespaceRun(current[current.length - 1])) current.pop();
    lines.push({ runs: current, height: Math.max(charH, currentHeight) });
    current = [];
    usedPx = 0;
    currentHeight = charH;
  };

  for (const run of runs) {
    if (run.kind === 'newline') {
      pushLine();
      continue;
    }

    // If at line start, avoid leading whitespace
    if (current.length === 0 && isWhitespaceRun(run)) {
      continue;
    }

    const runW = getRunWidth(run, maxWidthPx, measure, charW, charH);

    // Hard-break huge tokens that exceed a full line.
    if (run.kind !== 'widget' && runW > maxWidthPx && !/^\s+$/.test(run.text)) {
      if (current.length > 0) pushLine();
      const chunks = hardBreakByWidth(run.text, maxWidthPx, measure);
      for (const chunk of chunks) {
        lines.push({ runs: [{ ...run, text: chunk }], height: charH });
      }
      continue;
    }

    if (usedPx + runW > maxWidthPx && current.length > 0) {
      pushLine();
    }

    current.push(run);
    usedPx += runW;
    currentHeight = Math.max(currentHeight, getRunHeight(run, charH));
  }

  if (current.length > 0) pushLine();
  if (lines.length === 0) lines.push({ runs: [], height: charH });
  return lines;
}

function resolveAlignedX(baseX: number, availableWidth: number, contentWidth: number, align?: 'left' | 'center' | 'right'): number {
  if (align === 'center') return baseX + Math.max(0, Math.round((availableWidth - contentWidth) / 2));
  if (align === 'right') return baseX + Math.max(0, availableWidth - contentWidth);
  return baseX;
}

function getCalloutToneColor(tone: 'note' | 'info' | 'tip' | 'warning' | 'important' | 'caution', style: MarkdownStyle): any {
  if (tone === 'note' || tone === 'info') return style.infoFg;
  if (tone === 'tip' || tone === 'important') return style.successFg;
  if (tone === 'warning') return style.warningFg;
  if (tone === 'caution') return style.errorFg;
  return style.infoFg;
}

function defaultCalloutTitle(tone: 'note' | 'info' | 'tip' | 'warning' | 'important' | 'caution'): string {
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

function resolveWidgetHeight(widget: WidgetSpec, charH: number): number {
  if (widget.type === 'slider') return Math.max(Math.round(charH * 3.4), 56);
  if (widget.type === 'button') return Math.max(Math.round(charH * 2.3), 38);
  if (widget.type === 'checkbox') return Math.max(Math.round(charH * 2), 32);
  return Math.max(Math.round(charH * 1.7), 28);
}

function emitWidgetPlaceholder(
  ops: DrawOp[],
  placement: WidgetPlacement,
  style: MarkdownStyle,
  charW: number,
  charH: number,
  measure: ((text: string) => number) | null,
  bumpMax: (x: number, y: number, w: number, h: number) => void,
  mode: 'full' | 'frame' | 'none'
): void {
  const { x, y, w, h, widget } = placement;
  if (mode === 'none') {
    bumpMax(x, y, w, h);
    return;
  }
  const border = style.borderFg;
  const bg = style.surfaceBg;
  const inset = Math.max(1, Math.round(charH * 0.18));
  const innerX = x + inset;
  const innerY = y + inset;
  const innerW = Math.max(1, w - inset * 2);
  const innerH = Math.max(1, h - inset * 2);

  ops.push({ kind: 'rect', x, y, w, h, color: border });
  ops.push({ kind: 'rect', x: innerX, y: innerY, w: innerW, h: innerH, color: bg });
  bumpMax(x, y, w, h);

  if (mode === 'frame') {
    return;
  }

  const label = String(widget.label || widget.text || widget.id || '').trim();
  const labelWidth = label ? (measure ? measure(label) : label.length * charW) : 0;

  if (widget.type === 'button') {
    if (label) {
      const textX = x + Math.max(inset * 2, Math.round((w - labelWidth) / 2));
      const textY = y + Math.max(inset, Math.round((h - charH) / 2));
      ops.push({ kind: 'text', text: label, x: textX, y: textY, color: style.fg });
      bumpMax(textX, textY, labelWidth, charH);
    }
    return;
  }

  if (widget.type === 'slider') {
    const titleY = y + inset + 2;
    if (label) {
      ops.push({ kind: 'text', text: label, x: innerX + charW, y: titleY, color: style.fg });
      bumpMax(innerX + charW, titleY, labelWidth, charH);
    }

    const min = Number.isFinite(widget.min) ? Number(widget.min) : 0;
    const max = Number.isFinite(widget.max) ? Number(widget.max) : 100;
    const value = Number.isFinite(widget.value) ? Number(widget.value) : min;
    const range = Math.max(1e-6, max - min);
    const ratio = Math.max(0, Math.min(1, (value - min) / range));
    const trackY = y + h - inset - Math.max(6, Math.round(charH * 0.35));
    const trackX = innerX + charW;
    const trackW = Math.max(charW * 4, innerW - charW * 2);
    const trackH = Math.max(4, Math.round(charH * 0.2));
    const knobW = Math.max(10, Math.round(charW * 1.25));
    const knobH = Math.max(14, Math.round(charH * 0.9));
    const knobX = trackX + Math.round((trackW - knobW) * ratio);
    const knobY = trackY - Math.round((knobH - trackH) / 2);

    ops.push({ kind: 'rect', x: trackX, y: trackY, w: trackW, h: trackH, color: style.mutedFg });
    ops.push({ kind: 'rect', x: knobX, y: knobY, w: knobW, h: knobH, color: style.linkFg });
    bumpMax(trackX, knobY, trackW, knobH);
    return;
  }

  if (widget.type === 'checkbox') {
    const boxSize = Math.max(14, Math.round(charH * 0.95));
    const boxX = innerX + charW;
    const boxY = y + Math.max(inset, Math.round((h - boxSize) / 2));
    ops.push({ kind: 'rect', x: boxX, y: boxY, w: boxSize, h: boxSize, color: border });
    ops.push({ kind: 'rect', x: boxX + 2, y: boxY + 2, w: Math.max(1, boxSize - 4), h: Math.max(1, boxSize - 4), color: widget.checked ? style.successFg : bg });
    bumpMax(boxX, boxY, boxSize, boxSize);
    if (label) {
      const textX = boxX + boxSize + charW;
      const textY = y + Math.max(inset, Math.round((h - charH) / 2));
      ops.push({ kind: 'text', text: label, x: textX, y: textY, color: style.fg });
      bumpMax(textX, textY, labelWidth, charH);
    }
    return;
  }

  if (label) {
    const textX = widget.align === 'center'
      ? x + Math.max(inset, Math.round((w - labelWidth) / 2))
      : widget.align === 'right'
        ? x + Math.max(inset, w - inset - labelWidth)
        : innerX + charW;
    const textY = y + Math.max(inset, Math.round((h - charH) / 2));
    ops.push({ kind: 'text', text: label, x: textX, y: textY, color: style.fg });
    bumpMax(textX, textY, labelWidth, charH);
  }
}

export function layoutMarkdownDocument(
  nodes: DocNode[],
  box: LayoutBox,
  metrics: TextMetrics,
  style: MarkdownStyle,
  scrollY: number = 0,
  padding: number = 10,
  options?: LayoutOptions
): LayoutResult {
  const ops: DrawOp[] = [];
  const linkRegions: LinkRegion[] = [];
  const widgetPlacements: WidgetPlacement[] = [];
  let linkIndex = 0;
  const linkUnderline = style.linkUnderline ?? true;

  const charW = Math.max(1, metrics.charW);
  const charH = Math.max(1, metrics.charH);
  const measure = typeof metrics.measureTextWidth === 'function' ? metrics.measureTextWidth : null;
  const getImageSize = typeof metrics.getImageSize === 'function' ? metrics.getImageSize : null;

  const x0 = box.x;
  const y0 = box.y;
  const innerW = Math.max(1, box.width - padding * 2);

  const baseLineHeight = Math.round(charH * 1.25);
  const paragraphGap = Math.round(charH * 0.75);

  const overflow = options?.overflow === 'expand' ? 'expand' : 'clip';
  const widgetPlaceholderMode = options?.widgetPlaceholderMode ?? 'full';

  // Background
  ops.push({ kind: 'rect', x: x0, y: y0, w: box.width, h: box.height, color: style.bg });

  let cursorY = y0 + padding - scrollY;

  // Content bounds for measuring required size (excluding the background rect).
  const contentStartX = x0 + padding;
  const contentStartY = y0 + padding - scrollY;
  let contentMinX = Number.POSITIVE_INFINITY;
  let contentMinY = Number.POSITIVE_INFINITY;
  let contentMaxX = contentStartX;
  let contentMaxY = contentStartY;

  const bumpMax = (x: number, y: number, w: number, h: number) => {
    if (w > 0) {
      contentMinX = Math.min(contentMinX, x);
      contentMaxX = Math.max(contentMaxX, x + w);
    }
    if (h > 0) {
      contentMinY = Math.min(contentMinY, y);
      contentMaxY = Math.max(contentMaxY, y + h);
    }
  };

  const emitTextLine = (line: Run[], lineX: number, textY: number, fgOverride: any | undefined, containerWidth: number, lineTop: number, lineHeight: number) => {
    let cx = lineX;
    for (const run of line) {
      if (run.kind === 'newline') continue;
      if (run.kind === 'widget') {
        const widgetW = resolveInlineWidgetWidth(run.widget, charW, charH, containerWidth, measure);
        const widgetH = resolveInlineWidgetHeight(run.widget, charH);
        const placement: WidgetPlacement = {
          x: cx,
          y: lineTop + Math.max(0, Math.round((lineHeight - widgetH) / 2)),
          w: widgetW,
          h: widgetH,
          widget: run.widget,
        };
        widgetPlacements.push(placement);
        emitWidgetPlaceholder(ops, placement, style, charW, charH, measure, bumpMax, widgetPlaceholderMode);
        cx += widgetW;
        continue;
      }

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
        ops.push({ kind: 'rect', x: cx, y: textY - Math.round(charH * 0.15), w, h: Math.round(charH * 1.15), color: style.codeBg });
        bumpMax(cx, textY - Math.round(charH * 0.15), w, Math.round(charH * 1.15));
      }

      ops.push({ kind: 'text', text: run.text, x: cx, y: textY, color });
      {
        const w = measure ? measure(run.text) : run.text.length * charW;
        bumpMax(cx, textY, w, charH);
      }

      if (run.kind === 'link' && run.url && run.text.trim().length > 0) {
        const w = measure ? measure(run.text) : run.text.length * charW;
        linkRegions.push({ x: cx, y: textY, w, h: charH, url: run.url, text: run.text });
        if (linkUnderline) {
          ops.push({ kind: 'rect', x: cx, y: textY + charH - 2, w, h: 2, color });
          bumpMax(cx, textY + charH - 2, w, 2);
        }
        linkIndex++;
      }

      cx += measure ? measure(run.text) : run.text.length * charW;
    }
  };

  const renderNodes = (nodeList: DocNode[], contentX: number, contentWidth: number): void => {
    const localInnerW = Math.max(1, contentWidth);
    const localMaxChars = Math.max(1, Math.floor(localInnerW / charW));

    for (const node of nodeList) {
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
          const line = (rawLine ?? '').trimEnd();
          if (!(overflow === 'clip' && cursorY > y0 + box.height)) {
            ops.push({ kind: 'text', text: line, x: contentX, y: cursorY, color: fg });
          }
          const w = measure ? measure(line) : line.length * charW;
          bumpMax(contentX, cursorY, w, charH);
          cursorY += baseLineHeight;
        }
        cursorY += paragraphGap;
        continue;
      }

      if (node.kind === 'heading') {
        cursorY += Math.round(charH * 0.25);
        const runs = tokenizeInlines(node.inlines);
        const lines = measure ? wrapRunsByWidth(runs, localInnerW, measure, charW, charH) : wrapRuns(runs, localMaxChars, charW, charH);
        const fg = style.headingFg;

        for (const ln of lines) {
          const lineWidth = getLineWidth(ln, localInnerW, measure, charW, charH);
          const lineX = resolveAlignedX(contentX, localInnerW, lineWidth, style.textAlign);
          const textY = cursorY + (ln.height > charH ? Math.round((ln.height - charH) / 2) : 0);
          emitTextLine(ln.runs, lineX, textY, fg, localInnerW, cursorY, ln.height);
          cursorY += Math.max(baseLineHeight, ln.height);
        }
        cursorY += Math.round(charH * 0.2);
        continue;
      }

      if (node.kind === 'paragraph') {
        const runs = tokenizeInlines(node.inlines);
        const lines = measure ? wrapRunsByWidth(runs, localInnerW, measure, charW, charH) : wrapRuns(runs, localMaxChars, charW, charH);
        for (const ln of lines) {
          const lineWidth = getLineWidth(ln, localInnerW, measure, charW, charH);
          const lineX = resolveAlignedX(contentX, localInnerW, lineWidth, style.textAlign);
          const textY = cursorY + (ln.height > charH ? Math.round((ln.height - charH) / 2) : 0);
          emitTextLine(ln.runs, lineX, textY, undefined, localInnerW, cursorY, ln.height);
          cursorY += Math.max(baseLineHeight, ln.height);
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
          const listInnerWidth = Math.max(1, localInnerW - wrapIndentPx);
          const listMaxChars = Math.max(1, Math.floor(listInnerWidth / charW));
          const itemRuns = tokenizeInlines(item);
          const lines = measure
            ? wrapRunsByWidth(itemRuns, listInnerWidth, measure, charW, charH)
            : wrapRuns(itemRuns, listMaxChars, charW, charH);
          let first = true;
          for (const ln of lines) {
            if (first && markerText.length > 0) {
              ops.push({ kind: 'text', text: markerText, x: contentX, y: cursorY, color: markerColor });
              bumpMax(contentX, cursorY, markerWidth, charH);
            }
            const availableWidth = first ? listInnerWidth : Math.max(1, localInnerW - hangIndentPx);
            const baseX = contentX + (first ? markerAdvance : hangIndentPx);
            const lineWidth = getLineWidth(ln, availableWidth, measure, charW, charH);
            const x = resolveAlignedX(baseX, availableWidth, lineWidth, style.textAlign);
            const textY = cursorY + (ln.height > charH ? Math.round((ln.height - charH) / 2) : 0);
            emitTextLine(ln.runs, x, textY, undefined, listInnerWidth, cursorY, ln.height);
            cursorY += Math.max(baseLineHeight, ln.height);
            first = false;
          }
        }
        cursorY += paragraphGap;
        continue;
      }

      if (node.kind === 'image') {
        const imageInfo = getImageSize ? getImageSize(node.source) : null;
        const aspect = imageInfo && imageInfo.width > 0 && imageInfo.height > 0
          ? imageInfo.height / imageInfo.width
          : (9 / 16);
        const imageW = resolveSizedWidth(node.width, localInnerW, localInnerW);
        const imageH = Math.max(
          charH * 6,
          Math.min(Math.round(imageW * 1.25), Math.round(imageW * aspect))
        );

        const outerX = resolveAlignedX(contentX, localInnerW, imageW, node.align);
        const outerY = cursorY;
        const outerW = imageW;
        const outerH = imageH;
        const innerInset = Math.max(1, Math.round(charH * 0.18));
        const innerX = outerX + innerInset;
        const innerY = outerY + innerInset;
        const innerW2 = Math.max(1, outerW - innerInset * 2);
        const innerH2 = Math.max(1, outerH - innerInset * 2);

        ops.push({ kind: 'rect', x: outerX, y: outerY, w: outerW, h: outerH, color: style.borderFg });
        ops.push({ kind: 'rect', x: innerX, y: innerY, w: innerW2, h: innerH2, color: style.codeBg });
        ops.push({ kind: 'image', source: node.source, x: innerX, y: innerY, w: innerW2, h: innerH2, ...(node.alt ? { alt: node.alt } : {}) });
        bumpMax(outerX, outerY, outerW, outerH);

        if (!imageInfo) {
          const label = String(node.alt || node.title || node.source || 'image').trim();
          if (label.length > 0) {
            const labelRuns = label
              .split(/(\s+)/)
              .filter(Boolean)
              .map((text) => ({ kind: 'text', text } as Run));
            const labelMaxW = Math.max(1, innerW2 - charW * 2);
            const labelLines = measure
              ? wrapRunsByWidth(labelRuns, labelMaxW, measure, charW, charH)
              : wrapRuns(labelRuns, Math.max(1, Math.floor(labelMaxW / charW)), charW, charH);
            const maxLines = Math.max(1, Math.floor((innerH2 - charH * 2) / baseLineHeight));
            const shown = labelLines.slice(0, maxLines);
            const textStartY = innerY + Math.max(charH, Math.round((innerH2 - shown.length * baseLineHeight) / 2));
            for (let li = 0; li < shown.length; li++) {
              emitTextLine(shown[li].runs, innerX + charW, textStartY + li * baseLineHeight, style.fg, labelMaxW, textStartY + li * baseLineHeight, shown[li].height);
            }
          }
        }

        cursorY += imageH + paragraphGap;
        continue;
      }

      if (node.kind === 'widget') {
        const widgetW = resolveSizedWidth(node.widget.width, localInnerW, localInnerW);
        const widgetH = resolveWidgetHeight(node.widget, charH);
        const widgetX = resolveAlignedX(contentX, localInnerW, widgetW, node.widget.align);
        const placement: WidgetPlacement = {
          x: widgetX,
          y: cursorY,
          w: widgetW,
          h: widgetH,
          widget: node.widget,
        };
        widgetPlacements.push(placement);
        emitWidgetPlaceholder(ops, placement, style, charW, charH, measure, bumpMax, widgetPlaceholderMode);
        cursorY += widgetH + paragraphGap;
        continue;
      }

      if (node.kind === 'callout') {
        const accent = getCalloutToneColor(node.tone, style);
        const insertIndex = ops.length;
        const calloutX = contentX;
        const calloutY = cursorY;
        const calloutW = localInnerW;
        const barW = Math.max(4, Math.round(charW * 0.45));
        const insetX = Math.max(10, Math.round(charW * 1.1));
        const insetY = Math.max(8, Math.round(charH * 0.55));
        const titleText = String(node.title || defaultCalloutTitle(node.tone));
        const titleY = cursorY + insetY;
        const titleX = contentX + barW + insetX;

        cursorY = titleY;
        emitTextLine([{ kind: 'text', text: titleText }], titleX, cursorY, accent, Math.max(1, localInnerW - barW - insetX * 2), cursorY, charH);
        cursorY += baseLineHeight;
        cursorY += Math.max(4, Math.round(charH * 0.15));

        const bodyX = contentX + barW + insetX;
        const bodyW = Math.max(1, localInnerW - barW - insetX * 2);
        renderNodes(node.nodes, bodyX, bodyW);

        const calloutBottom = Math.max(calloutY + baseLineHeight + insetY * 2, cursorY - paragraphGap + insetY);
        const calloutH = Math.max(1, calloutBottom - calloutY);
        const backgroundColor = style.surfaceBg;

        ops.splice(insertIndex, 0,
          { kind: 'rect', x: calloutX, y: calloutY, w: calloutW, h: calloutH, color: backgroundColor },
          { kind: 'rect', x: calloutX, y: calloutY, w: barW, h: calloutH, color: accent }
        );
        bumpMax(calloutX, calloutY, calloutW, calloutH);
        cursorY = calloutBottom + paragraphGap;
        continue;
      }

      if (node.kind === 'blockquote') {
        const quoteBarWidth = Math.max(2, Math.round(charW * 0.35));
        const quoteGap = Math.max(8, Math.round(charW * 0.9));
        const quoteTop = cursorY;
        const quoteContentX = contentX + quoteBarWidth + quoteGap;
        const quoteContentWidth = Math.max(1, localInnerW - quoteBarWidth - quoteGap);

        renderNodes(node.nodes, quoteContentX, quoteContentWidth);

        const quoteBottom = Math.max(quoteTop + charH, cursorY - paragraphGap);
        const quoteHeight = Math.max(1, quoteBottom - quoteTop);
        const quoteBarY = quoteTop + Math.round(charH * 0.1);
        ops.push({ kind: 'rect', x: contentX, y: quoteBarY, w: quoteBarWidth, h: quoteHeight, color: style.borderFg });
        bumpMax(contentX, quoteBarY, quoteBarWidth, quoteHeight);
        continue;
      }

      if (node.kind === 'hr') {
        const ruleThickness = Math.max(1, Math.round(charH * 0.12));
        const ruleY = cursorY + Math.round(baseLineHeight * 0.55);
        ops.push({ kind: 'rect', x: contentX, y: ruleY, w: localInnerW, h: ruleThickness, color: style.borderFg });
        bumpMax(contentX, ruleY, localInnerW, ruleThickness);
        cursorY += baseLineHeight;
      }
    }
  };

  renderNodes(nodes, x0 + padding, innerW);

  const contentOffsetX = Number.isFinite(contentMinX) ? contentMinX : contentStartX;
  const contentOffsetY = Number.isFinite(contentMinY) ? contentMinY : contentStartY;
  const contentHeight = Math.max(0, cursorY - (y0 + padding - scrollY));
  const contentWidth = Math.max(0, contentMaxX - (x0 + padding));

  return { ops, linkRegions, widgetPlacements, contentOffsetX, contentOffsetY, contentWidth, contentHeight };
}
