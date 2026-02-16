import type { Color } from './types.js';
import { ColorUtils } from './types.js';

export type AnsiRun = {
  text: string;
  fg: Color;
  bg: Color;
};

export type AnsiParsed = {
  lines: AnsiRun[][];
  width: number;
  height: number;
};

export type AnsiParseOptions = {
  defaultFg: Color;
  defaultBg: Color;
  tabSize?: number;
  /**
   * If true, treats bracketed SGR like "[31m" as if it were "\x1b[31m".
   * This is convenient for embedding ANSI in markdown.
   */
  bracketSGR?: boolean;
};

const ESC = '\x1b';

function clampByte(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(255, n | 0));
}

function packRgb(r: number, g: number, b: number): Color {
  return ColorUtils.rgb(clampByte(r), clampByte(g), clampByte(b));
}

// Basic xterm-ish 16-color palette.
const ANSI_16: Color[] = [
  packRgb(0, 0, 0),         // 0 black
  packRgb(205, 0, 0),       // 1 red
  packRgb(0, 205, 0),       // 2 green
  packRgb(205, 205, 0),     // 3 yellow
  packRgb(0, 0, 238),       // 4 blue
  packRgb(205, 0, 205),     // 5 magenta
  packRgb(0, 205, 205),     // 6 cyan
  packRgb(229, 229, 229),   // 7 white (light gray)
  packRgb(127, 127, 127),   // 8 bright black (dark gray)
  packRgb(255, 0, 0),       // 9 bright red
  packRgb(0, 255, 0),       // 10 bright green
  packRgb(255, 255, 0),     // 11 bright yellow
  packRgb(92, 92, 255),     // 12 bright blue
  packRgb(255, 0, 255),     // 13 bright magenta
  packRgb(0, 255, 255),     // 14 bright cyan
  packRgb(255, 255, 255)    // 15 bright white
];

function xterm256ToColor(n: number): Color {
  const idx = n | 0;
  if (idx < 0) return ANSI_16[0]!;
  if (idx < 16) return ANSI_16[idx]!;

  if (idx >= 16 && idx <= 231) {
    const v = idx - 16;
    const r = Math.floor(v / 36);
    const g = Math.floor((v % 36) / 6);
    const b = v % 6;
    const steps = [0, 95, 135, 175, 215, 255];
    return packRgb(steps[r]!, steps[g]!, steps[b]!);
  }

  if (idx >= 232 && idx <= 255) {
    const gray = 8 + (idx - 232) * 10;
    return packRgb(gray, gray, gray);
  }

  return ANSI_16[7]!;
}

function isDigit(ch: string): boolean {
  const c = ch.charCodeAt(0);
  return c >= 48 && c <= 57;
}

function tryParseSGRAt(text: string, i: number, allowBracket: boolean): { params: number[]; nextIndex: number } | null {
  // Supports either "\x1b[...m" or "[...m".
  if (i >= text.length) return null;

  let start = i;
  if (text[start] === ESC) {
    if (text[start + 1] !== '[') return null;
    start += 2;
  } else {
    if (!allowBracket || text[start] !== '[') return null;
    start += 1;
  }

  // Parse params until 'm'. Only accept digits/; and allow empty (equivalent to 0).
  let j = start;
  while (j < text.length) {
    const ch = text[j]!;
    if (ch === 'm') {
      const paramStr = text.substring(start, j);
      const rawParts = paramStr.length ? paramStr.split(';') : ['0'];
      const params: number[] = [];
      for (const p of rawParts) {
        if (!p) {
          params.push(0);
          continue;
        }
        if ([...p].every(isDigit)) {
          params.push(Number.parseInt(p, 10));
        } else {
          return null;
        }
      }
      return { params, nextIndex: j + 1 };
    }

    if (ch === ';' || isDigit(ch)) {
      j++;
      continue;
    }

    // Not an SGR sequence.
    return null;
  }

  return null;
}

function applySGR(
  params: number[],
  state: { fg: Color; bg: Color; bright: boolean },
  defaults: { fg: Color; bg: Color }
): void {
  // Empty means reset.
  if (params.length === 0) params = [0];

  let k = 0;
  while (k < params.length) {
    const p = params[k] ?? 0;

    if (p === 0) {
      state.fg = defaults.fg;
      state.bg = defaults.bg;
      state.bright = false;
      k++;
      continue;
    }

    // Bold is commonly used to mean "bright" in ANSI art.
    if (p === 1) {
      state.bright = true;
      k++;
      continue;
    }
    if (p === 22) {
      state.bright = false;
      k++;
      continue;
    }

    // Default fg/bg
    if (p === 39) {
      state.fg = defaults.fg;
      k++;
      continue;
    }
    if (p === 49) {
      state.bg = defaults.bg;
      k++;
      continue;
    }

    // 8-color fg/bg
    if (p >= 30 && p <= 37) {
      const base = p - 30;
      state.fg = ANSI_16[(state.bright ? base + 8 : base)]!;
      k++;
      continue;
    }
    if (p >= 40 && p <= 47) {
      const base = p - 40;
      state.bg = ANSI_16[base]!;
      k++;
      continue;
    }

    // Bright fg/bg
    if (p >= 90 && p <= 97) {
      state.fg = ANSI_16[(p - 90) + 8]!;
      k++;
      continue;
    }
    if (p >= 100 && p <= 107) {
      state.bg = ANSI_16[(p - 100) + 8]!;
      k++;
      continue;
    }

    // Extended color
    if (p === 38 || p === 48) {
      const isFg = p === 38;
      const mode = params[k + 1];
      if (mode === 5) {
        const idx = params[k + 2];
        if (typeof idx === 'number') {
          const c = xterm256ToColor(idx);
          if (isFg) state.fg = c; else state.bg = c;
          k += 3;
          continue;
        }
      } else if (mode === 2) {
        const r = params[k + 2];
        const g = params[k + 3];
        const b = params[k + 4];
        if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
          const c = packRgb(r, g, b);
          if (isFg) state.fg = c; else state.bg = c;
          k += 5;
          continue;
        }
      }
    }

    // Ignore unsupported SGR codes (italic/underline/etc).
    k++;
  }
}

export function parseAnsiToRuns(text: string, opts: AnsiParseOptions): AnsiParsed {
  const tabSize = Math.max(0, (opts.tabSize ?? 4) | 0) || 4;
  const bracketSGR = opts.bracketSGR ?? true;

  const defaults = { fg: opts.defaultFg, bg: opts.defaultBg };
  const state = { fg: defaults.fg, bg: defaults.bg, bright: false };

  const lines: AnsiRun[][] = [];
  let currentLine: AnsiRun[] = [];
  let currentText = '';
  let currentFg = state.fg;
  let currentBg = state.bg;

  const flush = () => {
    if (currentText.length > 0) {
      currentLine.push({ text: currentText, fg: currentFg, bg: currentBg });
      currentText = '';
    }
  };

  const pushLine = () => {
    flush();
    lines.push(currentLine);
    currentLine = [];
  };

  const s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '');
  let i = 0;
  while (i < s.length) {
    const ch = s[i]!;

    if (ch === '\n') {
      pushLine();
      i++;
      continue;
    }

    if (ch === '\t') {
      currentText += ' '.repeat(tabSize);
      i++;
      continue;
    }

    // SGR escapes
    if (ch === ESC || (bracketSGR && ch === '[')) {
      const parsed = tryParseSGRAt(s, i, bracketSGR);
      if (parsed) {
        flush();
        applySGR(parsed.params, state, defaults);
        currentFg = state.fg;
        currentBg = state.bg;
        i = parsed.nextIndex;
        continue;
      }
    }

    currentText += ch;
    i++;
  }

  pushLine();

  // Measure width/height
  let width = 0;
  for (const line of lines) {
    let w = 0;
    for (const run of line) w += (run.text ?? '').length;
    width = Math.max(width, w);
  }

  return { lines, width, height: lines.length };
}
