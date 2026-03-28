import type { DocNode, Inline, WidgetSpec } from './types.js';

interface ParseMarkdownLiteOptions {
  createWidgetId?: (type: WidgetSpec['type']) => string;
}

function parseImageMetadata(title?: string): { title?: string; align?: 'left' | 'center' | 'right'; width?: string } {
  const raw = String(title ?? '').trim();
  if (!raw) return {};

  if (!/(^|\s)(align|width)\s*:/i.test(raw)) {
    return { title: raw };
  }

  let align: 'left' | 'center' | 'right' | undefined;
  let width: string | undefined;
  const remainder = raw.replace(/\b(align|width)\s*:\s*([^\s]+)/gi, (_match, key: string, value: string) => {
    const k = String(key).toLowerCase();
    const v = String(value).trim();
    if (k === 'align') {
      if (v === 'left' || v === 'center' || v === 'right') align = v;
    } else if (k === 'width' && /^\d+(?:\.\d+)?(?:px|%)$/i.test(v)) {
      width = v.toLowerCase();
    }
    return ' ';
  }).trim();

  return {
    ...(remainder ? { title: remainder } : {}),
    ...(align ? { align } : {}),
    ...(width ? { width } : {}),
  };
}

function tryParseJsonObject(raw: string): Record<string, any> | null {
  try {
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return obj as Record<string, any>;
  } catch {
    // ignore
  }
  return null;
}

function parseLooseDirectiveValue(raw: string): any {
  const s = raw.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^[+-]?(?:\d+\.?\d*|\d*\.\d+)$/.test(s)) return Number(s);
  const quoted = s.match(/^"([\s\S]*)"$/) ?? s.match(/^'([\s\S]*)'$/);
  if (quoted) return quoted[1];
  return s;
}

function parseLooseDirectiveObject(raw: string): Record<string, any> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return {};

  const parts: string[] = [];
  let buf = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]!;
    if (quote) {
      buf += ch;
      if (ch === quote && inner[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch as any;
      buf += ch;
      continue;
    }
    if (ch === ',') {
      parts.push(buf.trim());
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());

  const out: Record<string, any> = {};
  for (const part of parts) {
    if (!part) continue;
    const colon = part.indexOf(':');
    if (colon <= 0) continue;
    const key = part.slice(0, colon).trim().replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    out[key] = parseLooseDirectiveValue(part.slice(colon + 1));
  }
  return out;
}

function parseDirectiveObject(raw: string): Record<string, any> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  return tryParseJsonObject(trimmed) ?? parseLooseDirectiveObject(trimmed);
}

function parseTrailingDirectiveObject(text: string): { displayText: string; directive: Record<string, any> | null } {
  const lastBrace = text.lastIndexOf('{');
  if (lastBrace >= 0) {
    const directivePart = text.slice(lastBrace);
    const obj = parseDirectiveObject(directivePart);
    if (obj) {
      return { displayText: text.slice(0, lastBrace).trimEnd(), directive: obj };
    }
  }
  return { displayText: text, directive: null };
}

function parseCalloutBlock(lines: string[], options?: ParseMarkdownLiteOptions): DocNode | null {
  let firstContentIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (String(lines[i] ?? '').trim().length > 0) {
      firstContentIndex = i;
      break;
    }
  }
  if (firstContentIndex < 0) return null;

  const firstLine = String(lines[firstContentIndex] ?? '').trim();
  const match = firstLine.match(/^\[!(NOTE|INFO|TIP|WARNING|IMPORTANT|CAUTION)\](?:\s+(.*))?$/i);
  if (!match) return null;

  const tone = String(match[1] ?? '').toLowerCase() as 'note' | 'info' | 'tip' | 'warning' | 'important' | 'caution';
  const title = String(match[2] ?? '').trim();
  const bodyLines = lines.slice(firstContentIndex + 1);
  const nodes = parseMarkdownLite(bodyLines.join('\n'), options);

  return {
    kind: 'callout',
    tone,
    ...(title ? { title } : {}),
    nodes,
  };
}

function isBrailleBlankLine(text: string): boolean {
  // Many docs/stories use U+2800 BRAILLE PATTERN BLANK to represent an
  // intentional blank line (since it isn't trimmed as whitespace).
  const t = (text ?? '').trim();
  return t.length > 0 && /^[\u2800]+$/.test(t);
}

function parseInlineDirectiveValues(raw: string): Record<string, string> {
  const values: Record<string, string> = {};
  let i = 0;

  while (i < raw.length) {
    while (i < raw.length && (raw[i] === ',' || /\s/.test(raw[i] || ''))) i++;
    if (i >= raw.length) break;

    const keyStart = i;
    while (i < raw.length && /[A-Za-z0-9_-]/.test(raw[i] || '')) i++;
    const key = raw.slice(keyStart, i).trim().toLowerCase();
    if (!key) break;

    while (i < raw.length && /\s/.test(raw[i] || '')) i++;
    const separator = raw[i];
    if (separator !== ':' && separator !== '=') break;
    i++;

    while (i < raw.length && /\s/.test(raw[i] || '')) i++;
    if (i >= raw.length) {
      values[key] = '';
      break;
    }

    let value = '';
    const quote = raw[i];
    if (quote === '"' || quote === "'") {
      i++;
      while (i < raw.length) {
        const ch = raw[i] || '';
        if (ch === '\\' && i + 1 < raw.length) {
          value += raw[i + 1] || '';
          i += 2;
          continue;
        }
        if (ch === quote) {
          i++;
          break;
        }
        value += ch;
        i++;
      }
    } else {
      const valueStart = i;
      while (i < raw.length && raw[i] !== ',') i++;
      value = raw.slice(valueStart, i).trim();
    }

    values[key] = value;
    while (i < raw.length && (raw[i] === ',' || /\s/.test(raw[i] || ''))) i++;
  }

  return values;
}

function parseWidgetSpec(values: Record<string, string>, createWidgetId?: (type: WidgetSpec['type']) => string): WidgetSpec | null {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    normalized[String(key).toLowerCase()] = String(value);
  }

  const typeRaw = String(normalized.type || normalized.widget || '').trim().toLowerCase();
  if (typeRaw !== 'button' && typeRaw !== 'slider' && typeRaw !== 'checkbox' && typeRaw !== 'label') {
    return null;
  }

  const id = String(normalized.id || normalized.name || '').trim() || (createWidgetId ? createWidgetId(typeRaw) : `widget-${typeRaw}`);
  const alignRaw = String(normalized.align || '').trim().toLowerCase();
  const align = alignRaw === 'left' || alignRaw === 'center' || alignRaw === 'right' ? alignRaw : undefined;
  const scaleRaw = String(normalized.scale || normalized.sizing || '').trim().toLowerCase();
  const scale = scaleRaw === 'gui' || scaleRaw === 'worlds' ? scaleRaw : undefined;
  const widthRaw = String(normalized.width || '').trim().toLowerCase();
  const width = /^\d+(?:\.\d+)?(?:px|%)$/i.test(widthRaw) ? widthRaw : undefined;
  const parseNumber = (key: string): number | undefined => {
    const raw = String(normalized[key] || '').trim();
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  };
  const parseBoolean = (key: string): boolean | undefined => {
    const raw = String(normalized[key] || '').trim().toLowerCase();
    if (!raw) return undefined;
    if (raw === 'true' || raw === 'yes' || raw === 'on' || raw === '1') return true;
    if (raw === 'false' || raw === 'no' || raw === 'off' || raw === '0') return false;
    return undefined;
  };

  return {
    type: typeRaw,
    id,
    ...(normalized.label ? { label: String(normalized.label) } : {}),
    ...(normalized.text ? { text: String(normalized.text) } : {}),
    ...(parseNumber('min') !== undefined ? { min: parseNumber('min') } : {}),
    ...(parseNumber('max') !== undefined ? { max: parseNumber('max') } : {}),
    ...(parseNumber('value') !== undefined ? { value: parseNumber('value') } : {}),
    ...(parseNumber('step') !== undefined ? { step: parseNumber('step') } : {}),
    ...(parseBoolean('showvalue') !== undefined ? { showValue: parseBoolean('showvalue') } : {}),
    ...(parseBoolean('checked') !== undefined ? { checked: parseBoolean('checked') } : {}),
    ...(align ? { align } : {}),
    ...(width ? { width } : {}),
    ...(scale ? { scale } : {}),
  };
}

function findInlineDirectiveEnd(text: string, start: number): number {
  let i = start;
  let quote: '"' | "'" | null = null;

  while (i < text.length) {
    const ch = text[i] || '';
    if (quote) {
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch as '"' | "'";
      i++;
      continue;
    }
    if (ch === '}') return i;
    i++;
  }

  return -1;
}

function parseInlines(text: string, options?: ParseMarkdownLiteOptions): Inline[] {
  const inlines: Inline[] = [];
  let i = 0;
  let buffer = '';

  const flushText = () => {
    if (!buffer) return;
    inlines.push({ kind: 'text', text: buffer });
    buffer = '';
  };

  while (i < text.length) {
    const ch = text[i] || '';

    // Strong emphasis: **text**
    if (text.startsWith('**', i)) {
      const end = text.indexOf('**', i + 2);
      if (end !== -1) {
        const inner = text.slice(i + 2, end);
        flushText();
        inlines.push({ kind: 'strong', inlines: parseInlines(inner, options) });
        i = end + 2;
        continue;
      }
    }

    // Emphasis: *text*
    if (ch === '*' && text[i + 1] !== '*') {
      const end = text.indexOf('*', i + 1);
      if (end !== -1) {
        const inner = text.slice(i + 1, end);
        flushText();
        inlines.push({ kind: 'em', inlines: parseInlines(inner, options) });
        i = end + 1;
        continue;
      }
    }

    if (text.startsWith(':gui{', i)) {
      const end = findInlineDirectiveEnd(text, i + 5);
      if (end !== -1) {
        const raw = text.slice(i + 5, end);
        const widget = parseWidgetSpec(parseInlineDirectiveValues(raw), options?.createWidgetId);
        if (widget) {
          flushText();
          inlines.push({ kind: 'widget', widget });
          i = end + 1;
          continue;
        }
      }
    }

    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      const openParen = closeBracket !== -1 ? text.indexOf('(', closeBracket + 1) : -1;
      const closeParen = openParen !== -1 ? text.indexOf(')', openParen + 1) : -1;
      if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
        const label = text.slice(i + 1, closeBracket);
        const url = text.slice(openParen + 1, closeParen);
        flushText();
        if (label) inlines.push({ kind: 'link', text: label, url });
        i = closeParen + 1;
        continue;
      }
    }

    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        const code = text.slice(i + 1, end);
        flushText();
        inlines.push({ kind: 'code', text: code });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i++;
  }

  flushText();

  return inlines;
}

function parseWidgetFence(code: string, metadata?: Record<string, string>, options?: ParseMarkdownLiteOptions): WidgetSpec | null {
  const values: Record<string, string> = {};
  if (metadata) {
    for (const [key, value] of Object.entries(metadata)) {
      values[String(key).toLowerCase()] = String(value);
    }
  }

  const lines = String(code || '').replace(/\r\n/g, '\n').split('\n');
  for (const rawLine of lines) {
    const line = String(rawLine ?? '').trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!match) continue;
    values[String(match[1]).toLowerCase()] = String(match[2]).trim();
  }
  return parseWidgetSpec(values, options?.createWidgetId);
}

export function parseMarkdownLite(source: string, options?: ParseMarkdownLiteOptions): DocNode[] {
  const lines = (source || '').replace(/\r\n/g, '\n').split('\n');
  const nodes: DocNode[] = [];

  let i = 0;
  let inFence = false;
  let fenceLines: string[] = [];
  let fenceLang: string | undefined = undefined;
  let fenceMetadata: Record<string, string> | undefined = undefined;

  const flushParagraph = (paraLines: string[]) => {
    if (paraLines.length === 0) return;
    const inlines: Inline[] = [];
    for (let li = 0; li < paraLines.length; li++) {
      const rawLine = (paraLines[li] ?? '').trimEnd();

      // Preserve explicit newlines between lines inside a paragraph.
      // Special-case braille blank lines so they create vertical spacing
      // without drawing any visible glyphs.
      if (!isBrailleBlankLine(rawLine)) {
        const trimmed = rawLine.trim();
        if (trimmed.length > 0) {
          inlines.push(...parseInlines(trimmed, options));
        }
      }

      if (li < paraLines.length - 1) {
        inlines.push({ kind: 'newline' });
      }
    }
    if (inlines.length === 0) return;
    nodes.push({ kind: 'paragraph', inlines });
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw ?? '';

    // Code fences
    if (line.trim().startsWith('```')) {
      if (!inFence) {
        inFence = true;
        fenceLines = [];
        fenceLang = undefined;
        fenceMetadata = undefined;

        // Parse fence declaration: ```lang key:value key:value
        const decl = line.trim().substring(3).trim();
        const parts = decl.length > 0 ? decl.split(/\s+/) : [];
        if (parts.length > 0) {
          fenceLang = parts[0] || undefined;
          const md: Record<string, string> = {};
          for (let p = 1; p < parts.length; p++) {
            const seg = parts[p] ?? '';
            const idx = seg.indexOf(':');
            if (idx > 0 && idx < seg.length - 1) {
              const k = seg.slice(0, idx);
              const v = seg.slice(idx + 1);
              md[k] = v;
            }
          }
          if (Object.keys(md).length > 0) fenceMetadata = md;
        }
      } else {
        inFence = false;
        const fenceCode = fenceLines.join('\n');
        const fenceLangKey = String(fenceLang || '').trim().toLowerCase();
        if (fenceLangKey === 'gui') {
          const widget = parseWidgetFence(fenceCode, fenceMetadata, options);
          if (widget) {
            nodes.push({ kind: 'widget', widget });
          }
        } else {
          const node: DocNode = { kind: 'codeblock', code: fenceCode };
          if (fenceLang) (node as any).lang = fenceLang;
          if (fenceMetadata) (node as any).metadata = fenceMetadata;
          nodes.push(node);
        }
        fenceLines = [];
        fenceLang = undefined;
        fenceMetadata = undefined;
      }
      i++;
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
      i++;
      continue;
    }

    // Skip empty lines
    if (line.trim().length === 0) {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) {
      nodes.push({ kind: 'hr' });
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      nodes.push({ kind: 'heading', level: h[1].length, inlines: parseInlines(h[2].trim(), options) });
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i] ?? '')) {
        const rawQuoted = lines[i] ?? '';
        quoteLines.push(rawQuoted.replace(/^\s*>\s?/, ''));
        i++;
      }
      const callout = parseCalloutBlock(quoteLines, options);
      if (callout) {
        nodes.push(callout);
      } else {
        nodes.push({ kind: 'blockquote', nodes: parseMarkdownLite(quoteLines.join('\n'), options) });
      }
      continue;
    }

    // Standalone image
    const imageMatch = line.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/);
    if (imageMatch) {
      const [, alt = '', source = '', title] = imageMatch;
      const imageMeta = parseImageMetadata(title);
      nodes.push({ kind: 'image', alt, source, ...imageMeta });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: { inlines: Inline[]; markerText?: string | null }[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const rawItemText = lines[i].replace(/^\s*[-*]\s+/, '').trimEnd();
        const { displayText, directive } = parseTrailingDirectiveObject(rawItemText);
        const markerText = directive && Object.prototype.hasOwnProperty.call(directive, 'list-icon')
          ? (directive['list-icon'] === null ? null : String(directive['list-icon']))
          : undefined;
        items.push({ inlines: parseInlines(displayText, options), markerText });
        i++;
      }
      nodes.push({ kind: 'list', items, ordered: false });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: { inlines: Inline[]; markerText?: string | null }[] = [];
      let start: number | undefined;
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const match = lines[i].match(/^\s*(\d+)\.\s+(.*)$/);
        if (!match) break;
        if (start === undefined) {
          const parsed = Number(match[1]);
          start = Number.isFinite(parsed) ? parsed : 1;
        }
        const itemText = match[2].trimEnd();
        items.push({ inlines: parseInlines(itemText, options) });
        i++;
      }
      nodes.push({ kind: 'list', items, ordered: true, start: start ?? 1 });
      continue;
    }

    // Paragraph: consume until blank or next block
    const para: string[] = [];
    while (i < lines.length) {
      const l = lines[i] ?? '';
      if (l.trim().length === 0) break;
      if (l.trim().startsWith('```')) break;
      if (/^(#{1,6})\s+/.test(l)) break;
      if (/^\s*[-*]\s+/.test(l)) break;
      if (/^\s*\d+\.\s+/.test(l)) break;
      para.push(l);
      i++;
    }
    flushParagraph(para);
  }

  // Unclosed fence: treat as codeblock
  if (inFence && fenceLines.length > 0) {
    const fenceCode = fenceLines.join('\n');
    const fenceLangKey = String(fenceLang || '').trim().toLowerCase();
    if (fenceLangKey === 'gui') {
      const widget = parseWidgetFence(fenceCode, fenceMetadata, options);
      if (widget) {
        nodes.push({ kind: 'widget', widget });
      }
    } else {
      const node: DocNode = { kind: 'codeblock', code: fenceCode };
      if (fenceLang) (node as any).lang = fenceLang;
      if (fenceMetadata) (node as any).metadata = fenceMetadata;
      nodes.push(node);
    }
  }

  return nodes;
}
