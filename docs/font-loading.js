/**
 * Font loading helpers
 *
 * We rasterize glyphs into a texture atlas (Canvas2D -> WebGPU), so fonts must
 * be available before we measure and render glyphs. The engine already waits on
 * `document.fonts`, but that only helps if the font is actually discoverable by
 * the browser (e.g. via @font-face or a Google Fonts stylesheet).
 */
export const DEFAULT_FONT_FALLBACK_STACK = "'3270-regular', 'Consolas', 'Monaco', monospace";
const LOCAL_FONT_EXTENSIONS = ['otf', 'ttf', 'woff2', 'woff'];
const LOCAL_FONT_STYLESHEET_ID_PREFIX = 'storie-local-font-';
const MONOSPACE_MEASURE_SAMPLES = ['M', 'W', '@', '#', '0', '1', '8', '|', '_'];
function normalizeFontFamilyValue(value) {
    // Frontmatter (and Google Fonts URLs) often use `+` for spaces.
    // Treat it as a space for font-family resolution.
    return String(value ?? '').replace(/\+/g, ' ').trim();
}
function safeCssEscape(value) {
    const v = String(value ?? '');
    try {
        const css = globalThis.CSS;
        if (css && typeof css.escape === 'function')
            return css.escape(v);
    }
    catch {
        // ignore
    }
    // Very small fallback: escape quotes and backslashes.
    // This isn't a full CSS escape implementation, but is good enough for
    // typical font family names.
    return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
function toKebabCase(value) {
    return String(value ?? '')
        .trim()
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
function toFilenameStemVariants(family) {
    const normalized = normalizeFontFamilyValue(String(family ?? ''));
    if (!normalized)
        return [];
    const compact = normalized.replace(/\s+/g, '');
    const kebab = toKebabCase(normalized);
    const variants = [normalized, compact, kebab]
        .map(v => v.trim())
        .filter(Boolean);
    return Array.from(new Set(variants));
}
function buildLocalFontCandidates(family) {
    if (typeof document === 'undefined')
        return [];
    const baseUrl = new URL('./assets/', document.baseURI);
    const stems = toFilenameStemVariants(family);
    const names = new Set();
    for (const stem of stems) {
        names.add(stem);
        names.add(`${stem}-Regular`);
        names.add(`${stem}-regular`);
        names.add(`${stem}-VariableFont_wght`);
    }
    const candidates = [];
    for (const name of names) {
        for (const ext of LOCAL_FONT_EXTENSIONS) {
            candidates.push({
                href: new URL(`${name}.${ext}`, baseUrl).href,
                format: ext === 'otf' ? 'opentype' : ext === 'ttf' ? 'truetype' : ext
            });
        }
    }
    return candidates;
}
async function ensureLocalFontAsset(family, opts) {
    if (typeof document === 'undefined' || !document.fonts)
        return false;
    const fam = normalizeFontFamilyValue(String(family ?? ''));
    if (!fam || looksLikeGenericFamily(fam))
        return false;
    const selectorId = `${LOCAL_FONT_STYLESHEET_ID_PREFIX}${fam}`;
    const existing = document.querySelector(`style[data-storie-local-font="${safeCssEscape(selectorId)}"]`);
    if (existing)
        return true;
    const descriptors = {};
    const firstWeight = Array.isArray(opts?.weights) ? opts?.weights.find(w => Number.isFinite(w) && w > 0) : null;
    if (Number.isFinite(firstWeight))
        descriptors.weight = String(firstWeight);
    for (const candidate of buildLocalFontCandidates(fam)) {
        try {
            const face = new FontFace(fam, `url("${candidate.href}") format("${candidate.format}")`, descriptors);
            const loadedFace = await timeout(face.load().then(() => face, () => null), opts?.timeoutMs ?? 750, null);
            if (!loadedFace)
                continue;
            document.fonts.add(loadedFace);
            const marker = document.createElement('style');
            marker.setAttribute('data-storie-local-font', selectorId);
            marker.textContent = `:root { --${toKebabCase(selectorId) || 'storie-local-font'}: 1; }`;
            document.head?.appendChild(marker);
            return true;
        }
        catch {
            // Try the next local asset candidate.
        }
    }
    return false;
}
export function measureMonospaceCellWidth(ctx, opts) {
    const samples = Array.isArray(opts?.samples) && opts.samples.length > 0
        ? opts.samples
        : MONOSPACE_MEASURE_SAMPLES;
    const extraGutterPx = Number.isFinite(opts?.extraGutterPx)
        ? Math.max(0, Math.round(opts.extraGutterPx))
        : 1;
    let maxAdvance = 0;
    let maxInk = 0;
    for (const sample of samples) {
        const metrics = ctx.measureText(sample);
        if (Number.isFinite(metrics.width)) {
            maxAdvance = Math.max(maxAdvance, metrics.width);
        }
        const left = Number.isFinite(metrics.actualBoundingBoxLeft)
            ? Math.abs(metrics.actualBoundingBoxLeft)
            : 0;
        const right = Number.isFinite(metrics.actualBoundingBoxRight)
            ? Math.abs(metrics.actualBoundingBoxRight)
            : 0;
        maxInk = Math.max(maxInk, left + right);
    }
    const width = Math.max(maxAdvance, maxInk);
    return Math.max(1, Math.ceil(width) + extraGutterPx);
}
export function isProbablyMonospaceFontStack(fontFamilyOrStack, opts) {
    if (typeof document === 'undefined')
        return true;
    const stack = String(fontFamilyOrStack ?? '').trim();
    if (!stack)
        return true;
    const size = Number.isFinite(opts?.fontCssPixelSize) && opts.fontCssPixelSize > 0
        ? opts.fontCssPixelSize
        : 16;
    const tol = Number.isFinite(opts?.tolerancePx) && opts.tolerancePx >= 0
        ? opts.tolerancePx
        : 0.5;
    // Heuristic: in a monospace font, glyph widths should match.
    // Use repeated characters to reduce rounding noise.
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx)
        return true;
    ctx.font = `${size}px ${stack}`;
    const w1 = ctx.measureText('iiiiiiiiii').width / 10;
    const w2 = ctx.measureText('WWWWWWWWWW').width / 10;
    const w3 = ctx.measureText('..........').width / 10;
    // If we get nonsense, don't block.
    if (![w1, w2, w3].every(Number.isFinite))
        return true;
    if (w1 <= 0 || w2 <= 0 || w3 <= 0)
        return true;
    return Math.abs(w1 - w2) <= tol && Math.abs(w1 - w3) <= tol;
}
export function getPrimaryFontFamily(fontFamilyOrStack) {
    const raw = String(fontFamilyOrStack ?? '').trim();
    if (!raw)
        return null;
    // Take first comma-separated token.
    const first = raw.split(',')[0]?.trim();
    if (!first)
        return null;
    // Strip matching quotes.
    const unquoted = first.replace(/^['"]/, '').replace(/['"]$/, '').trim();
    const normalized = normalizeFontFamilyValue(unquoted);
    return normalized || null;
}
export function buildFontStack(primaryFamily, fallbackStack = DEFAULT_FONT_FALLBACK_STACK) {
    const primary = normalizeFontFamilyValue(String(primaryFamily ?? ''));
    if (!primary)
        return fallbackStack;
    // If caller already passed a stack, keep as-is.
    if (primary.includes(','))
        return primary;
    // Quote the primary to preserve spaces and punctuation.
    return `'${primary.replace(/'/g, "\\'")}', ${fallbackStack}`;
}
function looksLikeGenericFamily(family) {
    const f = String(family ?? '').trim().toLowerCase();
    if (!f)
        return true;
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
function googleFontsHref(family, opts) {
    // https://fonts.google.com/ -> CSS2 API
    // Basic form: https://fonts.googleapis.com/css2?family=Rye&display=swap
    const fam = normalizeFontFamilyValue(String(family ?? ''));
    const display = (opts?.display ?? 'swap').trim() || 'swap';
    // Encode family: spaces become '+'; keep other characters URL-safe.
    const famParam = encodeURIComponent(fam).replace(/%20/g, '+');
    // Optional weights; keep it simple and avoid generating huge CSS.
    const weights = Array.isArray(opts?.weights) ? opts.weights.filter(w => Number.isFinite(w) && w > 0) : [];
    const weightPart = weights.length > 0 ? `:wght@${weights.join(';')}` : '';
    return `https://fonts.googleapis.com/css2?family=${famParam}${weightPart}&display=${encodeURIComponent(display)}`;
}
function timeout(p, ms, fallback) {
    if (!(ms > 0))
        return p;
    return new Promise((resolve) => {
        const t = setTimeout(() => resolve(fallback), ms);
        p.then((v) => {
            clearTimeout(t);
            resolve(v);
        }, () => {
            clearTimeout(t);
            resolve(fallback);
        });
    });
}
async function ensureGoogleFontsStylesheet(family, opts) {
    if (typeof document === 'undefined')
        return false;
    if (!document.head)
        return false;
    const fam = String(family ?? '').trim();
    if (!fam || looksLikeGenericFamily(fam))
        return false;
    // Avoid spamming requests for common local fallback fonts.
    const lower = fam.toLowerCase();
    if (lower === '3270-regular' || lower === 'consolas' || lower === 'monaco')
        return false;
    const existing = document.querySelector(`link[data-storie-google-font="${safeCssEscape(fam)}"]`);
    if (existing)
        return true;
    const href = googleFontsHref(fam, { display: opts?.display, weights: opts?.weights });
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-storie-google-font', fam);
    const loaded = new Promise((resolve) => {
        link.onload = () => resolve(true);
        link.onerror = () => resolve(false);
    });
    document.head.appendChild(link);
    const ok = await timeout(loaded, opts?.timeoutMs ?? 1500, false);
    return ok;
}
/**
 * Attempt to load a font into the document.
 *
 * Resolution order:
 * 1) bundled local asset from ./assets
 * 2) Google Fonts stylesheet fallback
 *
 * Returns true if we *likely* made the font available. Even when this returns
 * false, callers can still proceed with fallback stacks.
 */
export async function tryLoadGoogleFontFamily(family, opts) {
    if (typeof document === 'undefined' || !document.fonts)
        return false;
    const fam = normalizeFontFamilyValue(String(family ?? ''));
    if (!fam || looksLikeGenericFamily(fam))
        return false;
    // 1) Prefer a bundled local asset when present.
    const localOk = await ensureLocalFontAsset(fam, {
        timeoutMs: opts?.timeoutMs,
        weights: opts?.weights
    });
    if (localOk) {
        const size = Number.isFinite(opts?.fontCssPixelSize) && opts.fontCssPixelSize > 0
            ? opts.fontCssPixelSize
            : 16;
        const localLoad = document.fonts.load(`${size}px "${fam}"`).then(() => true, () => false);
        return await timeout(localLoad, opts?.timeoutMs ?? 1500, true);
    }
    // 2) Ensure the Google Fonts stylesheet exists.
    const cssOk = await ensureGoogleFontsStylesheet(fam, {
        display: opts?.display,
        weights: opts?.weights,
        timeoutMs: opts?.timeoutMs
    });
    if (!cssOk)
        return false;
    // 3) Ask the Font Loading API to resolve the face.
    // Note: for the glyph atlas we typically pass physical pixel size.
    const size = Number.isFinite(opts?.fontCssPixelSize) && opts.fontCssPixelSize > 0
        ? opts.fontCssPixelSize
        : 16;
    const loadPromise = document.fonts.load(`${size}px "${fam}"`).then(() => true, () => false);
    return await timeout(loadPromise, opts?.timeoutMs ?? 1500, false);
}
//# sourceMappingURL=font-loading.js.map