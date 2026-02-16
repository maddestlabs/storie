export type FigletChar = {
  lines: string[];
  width: number;
};

export type FigletFont = {
  name?: string;
  signature: string;
  hardblank: string;
  height: number;
  baseline: number;
  maxLength: number;
  oldLayout: number;
  commentLines: number;
  printDirection: 0 | 1;
  fullLayout: number;
  codetagCount: number;
  comments: string[];
  chars: Map<number, FigletChar>;
};

export type FigletLayoutMode = 'full';

export type FigletRenderOptions = {
  layout?: FigletLayoutMode;
};

class LineStream {
  private lines: string[];
  private i = 0;

  constructor(text: string) {
    this.lines = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  }

  atEnd(): boolean {
    return this.i >= this.lines.length;
  }

  readLine(): string {
    if (this.atEnd()) return '';
    const line = this.lines[this.i] ?? '';
    this.i++;
    return line;
  }
}

function parseIntAuto(s: string): number | null {
  const t = String(s ?? '').trim();
  if (!t) return null;
  try {
    if (/^0x/i.test(t)) return Number.parseInt(t.substring(2), 16);
    if (/^0[0-7]+$/.test(t) && t.length > 1) return Number.parseInt(t.substring(1), 8);
    return Number.parseInt(t, 10);
  } catch {
    return null;
  }
}

function parseCharacter(stream: LineStream, height: number, hardblank: string): FigletChar {
  const lines: string[] = new Array(Math.max(0, height));
  let width = 0;

  for (let i = 0; i < height; i++) {
    let line = stream.readLine();
    if (line.length === 0 && stream.atEnd()) {
      throw new Error('FIGlet: unexpected end of character data');
    }

    // Endmark delimiter is the last char.
    let endPos = line.length - 1;
    const endChar = line[endPos] ?? '';
    if (i === height - 1 && endPos > 0 && line[endPos - 1] === endChar) {
      endPos = endPos - 1;
    }
    line = line.substring(0, Math.max(0, endPos));

    // Replace hardblanks with spaces.
    if (hardblank) {
      line = line.split(hardblank).join(' ');
    }

    lines[i] = line;
    if (line.length > width) width = line.length;
  }

  return { lines, width };
}

export function parseFIGfont(fontText: string, name?: string): FigletFont {
  const stream = new LineStream(fontText);
  const headerLine = stream.readLine();
  if (!headerLine.startsWith('flf2a')) {
    throw new Error('FIGlet: invalid FIGfont signature');
  }

  const hardblank = headerLine[5] ?? '$';
  const parts = headerLine.substring(6).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 5) {
    throw new Error('FIGlet: invalid header format');
  }

  const height = Number.parseInt(parts[0], 10);
  const baseline = Number.parseInt(parts[1], 10);
  const maxLength = Number.parseInt(parts[2], 10);
  const oldLayout = Number.parseInt(parts[3], 10);
  const commentLines = Number.parseInt(parts[4], 10);
  const printDirection: 0 | 1 = (parts.length > 5 && Number.parseInt(parts[5], 10) === 1) ? 1 : 0;
  const fullLayout = (parts.length > 6) ? Number.parseInt(parts[6], 10) : oldLayout;
  const codetagCount = (parts.length > 7) ? Number.parseInt(parts[7], 10) : 0;

  const comments: string[] = [];
  for (let i = 0; i < commentLines; i++) {
    comments.push(stream.readLine());
  }

  const chars = new Map<number, FigletChar>();

  const requiredChars: number[] = [
    32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
    48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63,
    64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
    80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95,
    96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111,
    112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126,
    196, 214, 220, 228, 246, 252, 223
  ];

  for (const code of requiredChars) {
    chars.set(code, parseCharacter(stream, height, hardblank));
  }

  // Code-tagged characters (optional)
  while (!stream.atEnd()) {
    const raw = stream.readLine();
    const line = raw.trim();
    if (!line) continue;
    const tok = line.split(/\s+/)[0] ?? '';
    const cc = parseIntAuto(tok);
    if (cc === null || cc === -1) continue;
    try {
      chars.set(cc, parseCharacter(stream, height, hardblank));
    } catch {
      break;
    }
  }

  return {
    name,
    signature: 'flf2a',
    hardblank,
    height,
    baseline,
    maxLength,
    oldLayout,
    commentLines,
    printDirection,
    fullLayout,
    codetagCount,
    comments,
    chars
  };
}

export function renderFigletLines(font: FigletFont, text: string, _opts: FigletRenderOptions = {}): string[] {
  const t = String(text ?? '');
  const height = Math.max(0, font.height | 0);
  const out: string[] = new Array(height).fill('');

  const fallback = font.chars.get(32);
  for (const ch of Array.from(t)) {
    const code = ch.codePointAt(0) ?? 32;
    const fig = font.chars.get(code) ?? fallback;
    if (!fig) continue;
    for (let i = 0; i < height; i++) {
      out[i] = (out[i] ?? '') + (fig.lines[i] ?? '');
    }
  }

  return out;
}

export function renderFigletCharLines(font: FigletFont, ch: string): string[] {
  const height = Math.max(0, font.height | 0);
  const c = String(ch ?? ' ').slice(0, 1);
  const cp = c.codePointAt(0) ?? 32;
  const fig = font.chars.get(cp) ?? font.chars.get(32);
  if (!fig) return new Array(height).fill('');
  const out: string[] = new Array(height);
  for (let i = 0; i < height; i++) out[i] = fig.lines[i] ?? '';
  return out;
}

export function measureFigletLinesWidth(lines: string[]): number {
  let w = 0;
  for (const l of lines) w = Math.max(w, (l ?? '').length);
  return w;
}
