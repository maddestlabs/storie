/**
 * Font loading helpers
 *
 * We rasterize glyphs into a texture atlas (Canvas2D -> WebGPU), so fonts must
 * be available before we measure and render glyphs. The engine already waits on
 * `document.fonts`, but that only helps if the font is actually discoverable by
 * the browser (e.g. via @font-face or a Google Fonts stylesheet).
 */

export const DEFAULT_FONT_FALLBACK_STACK = "'3270-regular', 'Consolas', 'Monaco', monospace";

function normalizeFontFamilyValue(value: string): string {
  // Frontmatter (and Google Fonts URLs) often use `+` for spaces.
  // Treat it as a space for font-family resolution.
  return String(value ?? '').replace(/\+/g, ' ').trim();
}

function safeCssEscape(value: string): string {
  const v = String(value ?? '');
  try {
    const css: any = (globalThis as any).CSS;
    if (css && typeof css.escape === 'function') return css.escape(v);
  } catch {
    // ignore
  }
  // Very small fallback: escape quotes and backslashes.
  // This isn't a full CSS escape implementation, but is good enough for
  // typical font family names.
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function isProbablyMonospaceFontStack(
  fontFamilyOrStack: string,
  opts?: { fontCssPixelSize?: number; tolerancePx?: number }
): boolean {
  if (typeof document === 'undefined') return true;
  const stack = String(fontFamilyOrStack ?? '').trim();
  if (!stack) return true;

  const size = Number.isFinite(opts?.fontCssPixelSize as any) && (opts!.fontCssPixelSize as number) > 0
    ? (opts!.fontCssPixelSize as number)
    : 16;
  const tol = Number.isFinite(opts?.tolerancePx as any) && (opts!.tolerancePx as number) >= 0
    ? (opts!.tolerancePx as number)
    : 0.5;

  // Heuristic: in a monospace font, glyph widths should match.
  // Use repeated characters to reduce rounding noise.
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return true;
  ctx.font = `${size}px ${stack}`;

  const w1 = ctx.measureText('iiiiiiiiii').width / 10;
  const w2 = ctx.measureText('WWWWWWWWWW').width / 10;
  const w3 = ctx.measureText('..........').width / 10;

  // If we get nonsense, don't block.
  if (![w1, w2, w3].every(Number.isFinite)) return true;
  if (w1 <= 0 || w2 <= 0 || w3 <= 0) return true;

  return Math.abs(w1 - w2) <= tol && Math.abs(w1 - w3) <= tol;
}

export function getPrimaryFontFamily(fontFamilyOrStack: string): string | null {
  const raw = String(fontFamilyOrStack ?? '').trim();
  if (!raw) return null;

  // Take first comma-separated token.
  const first = raw.split(',')[0]?.trim();
  if (!first) return null;

  // Strip matching quotes.
  const unquoted = first.replace(/^['"]/, '').replace(/['"]$/, '').trim();
  const normalized = normalizeFontFamilyValue(unquoted);
  return normalized || null;
}

export function buildFontStack(primaryFamily: string, fallbackStack = DEFAULT_FONT_FALLBACK_STACK): string {
  const primary = normalizeFontFamilyValue(String(primaryFamily ?? ''));
  if (!primary) return fallbackStack;

  // If caller already passed a stack, keep as-is.
  if (primary.includes(',')) return primary;

  // Quote the primary to preserve spaces and punctuation.
  return `'${primary.replace(/'/g, "\\'")}', ${fallbackStack}`;
}

function looksLikeGenericFamily(family: string): boolean {
  const f = String(family ?? '').trim().toLowerCase();
  if (!f) return true;
  return [
    'serif',
    'sans-serif',
    'monospace',
    'system-ui',
    'ui-serif',
    'ui-sans-serif',
    'ui-monospace',
    'cursive',
    'fantasy',
    'emoji',
    'math',
    'fangsong'
  ].includes(f);
}

function googleFontsHref(family: string, opts?: { display?: string; weights?: number[] }): string {
  // https://fonts.google.com/ -> CSS2 API
  // Basic form: https://fonts.googleapis.com/css2?family=Rye&display=swap
  const fam = normalizeFontFamilyValue(String(family ?? ''));
  const display = (opts?.display ?? 'swap').trim() || 'swap';

  // Encode family: spaces become '+'; keep other characters URL-safe.
  const famParam = encodeURIComponent(fam).replace(/%20/g, '+');

  // Optional weights; keep it simple and avoid generating huge CSS.
  const weights = Array.isArray(opts?.weights) ? opts!.weights!.filter(w => Number.isFinite(w) && w > 0) : [];
  const weightPart = weights.length > 0 ? `:wght@${weights.join(';')}` : '';

  return `https://fonts.googleapis.com/css2?family=${famParam}${weightPart}&display=${encodeURIComponent(display)}`;
}

function timeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  if (!(ms > 0)) return p;
  return new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve(fallback), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(fallback);
      }
    );
  });
}

async function ensureGoogleFontsStylesheet(family: string, opts?: { display?: string; weights?: number[]; timeoutMs?: number }): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (!document.head) return false;

  const fam = String(family ?? '').trim();
  if (!fam || looksLikeGenericFamily(fam)) return false;

  // Avoid spamming requests for common local fallback fonts.
  const lower = fam.toLowerCase();
  if (lower === '3270-regular' || lower === 'consolas' || lower === 'monaco') return false;

  const existing = document.querySelector(`link[data-storie-google-font="${safeCssEscape(fam)}"]`) as HTMLLinkElement | null;
  if (existing) return true;

  const href = googleFontsHref(fam, { display: opts?.display, weights: opts?.weights });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.setAttribute('data-storie-google-font', fam);

  const loaded = new Promise<boolean>((resolve) => {
    link.onload = () => resolve(true);
    link.onerror = () => resolve(false);
  });

  document.head.appendChild(link);

  const ok = await timeout(loaded, opts?.timeoutMs ?? 1500, false);
  return ok;
}

/**
 * Attempt to load a Google Font into the document.
 *
 * Returns true if we *likely* made the font available. Even when this returns
 * false, callers can still proceed with local fallbacks.
 */
export async function tryLoadGoogleFontFamily(
  family: string,
  opts?: {
    timeoutMs?: number;
    display?: string;
    weights?: number[];
    fontCssPixelSize?: number;
  }
): Promise<boolean> {
  if (typeof document === 'undefined' || !(document as any).fonts) return false;

  const fam = normalizeFontFamilyValue(String(family ?? ''));
  if (!fam || looksLikeGenericFamily(fam)) return false;

  // 1) Ensure the Google Fonts stylesheet exists.
  const cssOk = await ensureGoogleFontsStylesheet(fam, {
    display: opts?.display,
    weights: opts?.weights,
    timeoutMs: opts?.timeoutMs
  });
  if (!cssOk) return false;

  // 2) Ask the Font Loading API to resolve the face.
  // Note: for the glyph atlas we typically pass physical pixel size.
  const size = Number.isFinite(opts?.fontCssPixelSize as any) && (opts!.fontCssPixelSize as number) > 0
    ? (opts!.fontCssPixelSize as number)
    : 16;

  const loadPromise = (document as any).fonts.load(`${size}px "${fam}"`).then(
    () => true,
    () => false
  );

  return await timeout(loadPromise, opts?.timeoutMs ?? 1500, false);
}
