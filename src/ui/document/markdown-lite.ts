import type { DocNode, Inline } from './types.js';

function isBrailleBlankLine(text: string): boolean {
  // Many docs/stories use U+2800 BRAILLE PATTERN BLANK to represent an
  // intentional blank line (since it isn't trimmed as whitespace).
  const t = (text ?? '').trim();
  return t.length > 0 && /^[\u2800]+$/.test(t);
}

function parseInlines(text: string): Inline[] {
  const inlines: Inline[] = [];
  let i = 0;

  const pushText = (t: string) => {
    if (!t) return;
    inlines.push({ kind: 'text', text: t });
  };

  while (i < text.length) {
    const ch = text[i];

    // Inline code: `code`
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        const before = text.slice(0, i);
        if (before) {
          // We'll handle before by slicing from last boundary; simpler approach below.
        }
      }
    }

    // Link: [label](url)
    if (ch === '[') {
      const closeBracket = text.indexOf(']', i + 1);
      const openParen = closeBracket !== -1 ? text.indexOf('(', closeBracket + 1) : -1;
      const closeParen = openParen !== -1 ? text.indexOf(')', openParen + 1) : -1;
      if (closeBracket !== -1 && openParen === closeBracket + 1 && closeParen !== -1) {
        const label = text.slice(i + 1, closeBracket);
        const url = text.slice(openParen + 1, closeParen);
        if (label) inlines.push({ kind: 'link', text: label, url });
        i = closeParen + 1;
        continue;
      }
    }

    // Inline code (second pass, after link so `[` doesn't confuse)
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end !== -1) {
        const code = text.slice(i + 1, end);
        inlines.push({ kind: 'code', text: code });
        i = end + 1;
        continue;
      }
    }

    // Plain text: consume until next special token
    let next = text.length;
    const nextLink = text.indexOf('[', i + 1);
    const nextCode = text.indexOf('`', i + 1);
    if (nextLink !== -1) next = Math.min(next, nextLink);
    if (nextCode !== -1) next = Math.min(next, nextCode);

    pushText(text.slice(i, next));
    i = next;
  }

  return inlines;
}

export function parseMarkdownLite(source: string): DocNode[] {
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
          inlines.push(...parseInlines(trimmed));
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
        const node: DocNode = { kind: 'codeblock', code: fenceLines.join('\n') };
        if (fenceLang) (node as any).lang = fenceLang;
        if (fenceMetadata) (node as any).metadata = fenceMetadata;
        nodes.push(node);
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

    // Heading
    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) {
      nodes.push({ kind: 'heading', level: h[1].length, inlines: parseInlines(h[2].trim()) });
      i++;
      continue;
    }

    // Unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*]\s+/, '').trimEnd();
        items.push(parseInlines(itemText));
        i++;
      }
      nodes.push({ kind: 'list', items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: Inline[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s+/, '').trimEnd();
        items.push(parseInlines(itemText));
        i++;
      }
      nodes.push({ kind: 'list', items });
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
    const node: DocNode = { kind: 'codeblock', code: fenceLines.join('\n') };
    if (fenceLang) (node as any).lang = fenceLang;
    if (fenceMetadata) (node as any).metadata = fenceMetadata;
    nodes.push(node);
  }

  return nodes;
}
