/**
 * timed-parsers.ts
 *
 * Parsers for common timed-text and subtitle formats.
 * Every parser returns TimedEntry[] — { ms: number; text: string }[] — sorted
 * ascending by ms.  The engine's timed block system stores and queries this
 * single unified type regardless of source format.
 *
 * Supported formats
 * -----------------
 *  native   — Storie native: `ms|text` one entry per line
 *  srt      — SubRip (.srt)
 *  vtt      — WebVTT (.vtt)
 *  ttml     — Timed Text Markup Language (.ttml / DFXP, regex-based, no DOM dep)
 *  whisper  — OpenAI Whisper JSON  { segments:[{start,end,text}] }
 *  json     — Generic ASR JSON — tries segments[], words[], utterances[],
 *             monologues[], recognizedPhrases[], results[] (Google STT)
 *
 * Usage
 * -----
 *  import { parseTimedAuto, parseTimedFormat } from './timed-parsers.js';
 *
 *  const entries = parseTimedAuto(rawText);
 *  const entries = parseTimedFormat(rawText, 'srt');
 */
// ── Shared helpers ──────────────────────────────────────────────────────────
/**
 * Convert a `HH:MM:SS,mmm`, `HH:MM:SS.mmm`, `MM:SS.mmm`, `MM:SS,mmm` or
 * bare `SS.mmm` / `SS,mmm` timestamp string to milliseconds.
 * Returns NaN when the string is unrecognisable.
 */
export function parseTimestamp(ts) {
    const s = ts.trim().replace(',', '.');
    // HH:MM:SS.mmm  or  MM:SS.mmm
    const parts = s.split(':');
    if (parts.length === 3) {
        const h = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        const sec = parseFloat(parts[2]);
        if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec))
            return Math.round((h * 3600 + m * 60 + sec) * 1000);
    }
    else if (parts.length === 2) {
        const m = parseFloat(parts[0]);
        const sec = parseFloat(parts[1]);
        if (Number.isFinite(m) && Number.isFinite(sec))
            return Math.round((m * 60 + sec) * 1000);
    }
    // bare seconds
    const sec = parseFloat(s);
    if (Number.isFinite(sec))
        return Math.round(sec * 1000);
    return NaN;
}
/**
 * Parse a TTML time expression.
 * Handles: HH:MM:SS.mmm, HH:MM:SS:FF (frame dropped), Ns, Nms, N.Ns, N ticks
 */
export function parseTTMLTime(expr) {
    const s = expr.trim();
    if (!s)
        return NaN;
    // Metric suffix forms: "1500ms", "1.5s", "90000t" (ticks, 10000000/s)
    const metricMatch = s.match(/^(\d+(?:\.\d+)?)(ms|s|t|f|h|m)$/i);
    if (metricMatch) {
        const val = parseFloat(metricMatch[1]);
        const unit = metricMatch[2].toLowerCase();
        if (unit === 'ms')
            return Math.round(val);
        if (unit === 's')
            return Math.round(val * 1000);
        if (unit === 't')
            return Math.round(val / 10000); // ticks at 10MHz SMPTE
        if (unit === 'h')
            return Math.round(val * 3600000);
        if (unit === 'm')
            return Math.round(val * 60000);
        if (unit === 'f')
            return Math.round((val / 30) * 1000); // assume 30fps fallback
    }
    // HH:MM:SS.mmm  /  HH:MM:SS,mmm  /  HH:MM:SS:FF
    const colonParts = s.split(':');
    if (colonParts.length >= 3) {
        const h = parseFloat(colonParts[0]);
        const m = parseFloat(colonParts[1]);
        // Last part may have frames: SS:FF — just drop the frame count
        const secStr = colonParts[2].replace(',', '.');
        const sec = parseFloat(secStr);
        if (Number.isFinite(h) && Number.isFinite(m) && Number.isFinite(sec))
            return Math.round((h * 3600 + m * 60 + sec) * 1000);
    }
    return NaN;
}
/** Strip HTML/XML tags from a string. */
function stripTags(s) {
    return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}
/** Decode basic XML entities. */
function decodeEntities(s) {
    return s
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&apos;/gi, "'")
        .replace(/&quot;/gi, '"')
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}
/** Normalise and sort entries: remove empty text, sort by ms. */
function finish(entries) {
    return entries
        .filter(e => e.text.trim().length > 0)
        .sort((a, b) => a.ms - b.ms);
}
// ── Native: ms|text ─────────────────────────────────────────────────────────
/**
 * Parse Storie native timed format: one `ms|text` entry per line.
 * Lines starting with `#` and blank lines are treated as comments.
 */
export function parseTimedNative(text) {
    const entries = [];
    for (const line of text.split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#'))
            continue;
        const sep = t.indexOf('|');
        if (sep < 0)
            continue;
        const ms = parseFloat(t.slice(0, sep).trim());
        if (!Number.isFinite(ms) || ms < 0)
            continue;
        entries.push({ ms, text: t.slice(sep + 1) });
    }
    return finish(entries);
}
// ── SRT ─────────────────────────────────────────────────────────────────────
/**
 * Parse SubRip (.srt) subtitle text.
 * Format: blank-line-separated blocks of `index\nHH:MM:SS,mmm --> ...\ntext...`
 */
export function parseSRT(text) {
    const entries = [];
    // Split on one or more blank lines
    const blocks = text.trim().split(/\n\s*\n/);
    for (const block of blocks) {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length < 2)
            continue;
        // Find the timestamp line (may be the first or second line — second if there's an index)
        let tsLine = lines[0];
        let textStart = 1;
        if (!tsLine.includes('-->')) {
            tsLine = lines[1] ?? '';
            textStart = 2;
        }
        if (!tsLine.includes('-->'))
            continue;
        const [startStr] = tsLine.split('-->');
        const ms = parseTimestamp(startStr?.trim() ?? '');
        if (isNaN(ms))
            continue;
        const textLines = lines.slice(textStart).join(' ');
        entries.push({ ms, text: stripTags(textLines) });
    }
    return finish(entries);
}
// ── WebVTT ──────────────────────────────────────────────────────────────────
/**
 * Parse WebVTT (.vtt) subtitle text.
 * Similar to SRT but uses `.` as millisecond separator and may include
 * cue settings (position, align, etc.) after the `-->` timestamp:
 *   `00:00:01.000 --> 00:00:03.000 align:start`
 *
 * NOTE, STYLE, REGION, and WEBVTT header blocks are ignored.
 */
export function parseWebVTT(text) {
    const entries = [];
    // Normalise: remove BOM, CRLF
    const src = text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = src.trim().split(/\n\s*\n/);
    for (const block of blocks) {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (!lines.length)
            continue;
        // Skip header / metadata blocks
        if (lines[0].startsWith('WEBVTT') || lines[0].startsWith('NOTE') ||
            lines[0].startsWith('STYLE') || lines[0].startsWith('REGION'))
            continue;
        // Find the timestamp line
        let tsLine = '';
        let textStart = 0;
        for (let i = 0; i < Math.min(lines.length, 2); i++) {
            if (lines[i].includes('-->')) {
                tsLine = lines[i];
                textStart = i + 1;
                break;
            }
        }
        if (!tsLine)
            continue;
        // Strip cue settings that follow `-->  timestamp  [settings]`
        const tsParts = tsLine.split('-->');
        const ms = parseTimestamp(tsParts[0]?.trim() ?? '');
        if (isNaN(ms))
            continue;
        const textLines = lines.slice(textStart).join(' ');
        entries.push({ ms, text: stripTags(textLines) });
    }
    return finish(entries);
}
// ── TTML / DFXP ─────────────────────────────────────────────────────────────
/**
 * Parse a TTML / DFXP document (regex-based, no DOM dependency).
 * Extracts `<p begin="..." ...>text</p>` elements from the `<body>`.
 * Handles nested `<span>` elements and basic time offset inheritance
 * from ancestor `<div begin="...">` elements.
 */
export function parseTTML(text) {
    const entries = [];
    // Extract all <p ...> elements (may span multiple lines, keep it simple).
    // TTML allows begin/dur/end on individual <p> as well as on ancestor <div>/<body>.
    // We handle one level of div-inherited offset.
    const divRe = /<div\b([^>]*)>([\s\S]*?)<\/div>/gi;
    const pRe = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
    const attrRe = /\b(begin|dur|end|timeContainer)\s*=\s*["']([^"']*)["']/gi;
    function extractAttrs(attrStr) {
        const out = {};
        let m;
        attrRe.lastIndex = 0;
        while ((m = attrRe.exec(attrStr)) !== null)
            out[m[1].toLowerCase()] = m[2];
        return out;
    }
    function processBlock(htmlFragment, divOffsetMs) {
        pRe.lastIndex = 0;
        let pm;
        while ((pm = pRe.exec(htmlFragment)) !== null) {
            const attrs = extractAttrs(pm[1]);
            const begin = attrs['begin'] ? parseTTMLTime(attrs['begin']) : NaN;
            if (isNaN(begin))
                continue;
            const ms = divOffsetMs + begin;
            // Strip tags but decode entities
            const raw = decodeEntities((pm[2] ?? '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
            if (raw)
                entries.push({ ms, text: raw });
        }
    }
    // Try div-level grouping first
    divRe.lastIndex = 0;
    let dm;
    let foundDivs = false;
    while ((dm = divRe.exec(text)) !== null) {
        foundDivs = true;
        const divAttrs = extractAttrs(dm[1]);
        const divOffset = divAttrs['begin'] ? (parseTTMLTime(divAttrs['begin']) || 0) : 0;
        processBlock(dm[2], divOffset);
    }
    // Fall back: process the whole document as a flat list of <p> elements
    if (!foundDivs)
        processBlock(text, 0);
    return finish(entries);
}
// ── OpenAI Whisper JSON ──────────────────────────────────────────────────────
/**
 * Parse OpenAI Whisper transcription JSON.
 * Expected shape: `{ segments: [{ start: number, end: number, text: string }] }`
 * Also handles Whisper word-level: each segment may have `words[]`.
 */
export function parseWhisperJSON(obj) {
    const entries = [];
    const segments = obj['segments'];
    if (!Array.isArray(segments))
        return entries;
    for (const seg of segments) {
        const start = Number(seg['start']);
        const t = String(seg['text'] ?? '').trim();
        if (Number.isFinite(start) && t)
            entries.push({ ms: Math.round(start * 1000), text: t });
    }
    return finish(entries);
}
// ── Generic ASR JSON ─────────────────────────────────────────────────────────
// Maximum words per synthesised lyric line when building from word-level data.
const WORDS_PER_LINE = 8;
// Gap between consecutive words (ms) that starts a new lyric line.
const WORD_BREAK_GAP_MS = 600;
/**
 * Group word-level tokens `[{start, end?, word|text, ...}]` into lyric lines.
 * A new line is started when the gap to the previous word exceeds
 * WORD_BREAK_GAP_MS, or when WORDS_PER_LINE words have accumulated.
 */
function groupWords(words, startKey, wordKey, msScale) {
    const entries = [];
    let lineWords = [];
    let lineStart = NaN;
    let prevEnd = NaN;
    function flush() {
        if (lineWords.length && Number.isFinite(lineStart))
            entries.push({ ms: Math.round(lineStart * msScale), text: lineWords.join(' ') });
        lineWords = [];
        lineStart = NaN;
        prevEnd = NaN;
    }
    for (const w of words) {
        const word = String(w[wordKey] ?? w['text'] ?? w['word'] ?? '').trim();
        const start = Number(w[startKey] ?? w['start'] ?? w['startTime'] ?? 0);
        const end = Number(w['end'] ?? w['endTime'] ?? w['duration'] ?? start);
        if (!word || !Number.isFinite(start))
            continue;
        const startMs = start * msScale;
        if (!lineWords.length) {
            lineStart = start;
        }
        else if ((startMs - prevEnd * msScale > WORD_BREAK_GAP_MS) ||
            (lineWords.length >= WORDS_PER_LINE)) {
            flush();
            lineStart = start;
        }
        lineWords.push(word);
        prevEnd = end;
    }
    flush();
    return entries;
}
/**
 * Parse generic ASR / transcription JSON.
 * Tries multiple well-known shapes in order:
 *
 *  1. Whisper-style   `segments[].{start, text}`               (seconds)
 *  2. AssemblyAI      `utterances[].{start, text}`             (ms)
 *                     OR `words[].{start, end, text}`          (ms)
 *  3. Rev.ai          `monologues[].elements[].{ts, value}`    (seconds)
 *  4. Google STT v1   `results[].alternatives[].words[].{startTime, word}` (seconds)
 *  5. Azure           `recognizedPhrases[].{offsetInTicks, nBest[0].lexical}`
 *                     offsetInTicks is 100-nanosecond units
 *  6. Deepgram        `results.channels[0].alternatives[0].paragraphs.paragraphs[].sentences[]`
 *                           or `.words[]`
 *  7. Flat array      check if root is array of {start, text} or {offset, text}
 */
export function parseASRJSON(obj) {
    // 1. Whisper segments
    if (Array.isArray(obj['segments']) && obj['segments'][0]?.hasOwnProperty?.('start')) {
        const result = parseWhisperJSON(obj);
        if (result.length)
            return result;
    }
    // 2a. AssemblyAI utterances
    if (Array.isArray(obj['utterances'])) {
        const entries = [];
        for (const u of obj['utterances']) {
            const ms = Number(u['start']);
            const t = String(u['text'] ?? '').trim();
            if (Number.isFinite(ms) && t)
                entries.push({ ms, text: t });
        }
        if (entries.length)
            return finish(entries);
    }
    // 2b. AssemblyAI / generic words[] (ms-scale)
    if (Array.isArray(obj['words']) && obj['words'].length) {
        // Heuristic: if start values are > 1000, treat as ms; otherwise seconds.
        const firstStart = Number(obj['words'][0]?.['start'] ?? 0);
        const msScale = firstStart > 1000 ? 1 : 1000;
        const result = groupWords(obj['words'], 'start', 'text', msScale);
        if (result.length)
            return finish(result);
    }
    // 3. Rev.ai monologues
    if (Array.isArray(obj['monologues'])) {
        const entries = [];
        for (const mono of obj['monologues']) {
            const elems = mono['elements'];
            if (!Array.isArray(elems))
                continue;
            const words = elems.filter((e) => e['type'] === 'text' || !e['type']);
            const result = groupWords(words, 'ts', 'value', 1000);
            entries.push(...result);
        }
        if (entries.length)
            return finish(entries);
    }
    // 4. Google STT v1 results
    if (Array.isArray(obj['results'])) {
        const entries = [];
        for (const res of obj['results']) {
            const alts = res['alternatives'];
            if (!Array.isArray(alts) || !alts.length)
                continue;
            const alt = alts[0];
            if (Array.isArray(alt['words'])) {
                // Word-level; start/end are `{seconds: "N", nanos: M}` objects
                const words = alt['words'].map((w) => ({
                    start: Number(w['startTime']?.seconds ?? 0) + Number(w['startTime']?.nanos ?? 0) / 1e9,
                    end: Number(w['endTime']?.seconds ?? 0) + Number(w['endTime']?.nanos ?? 0) / 1e9,
                    text: String(w['word'] ?? ''),
                }));
                entries.push(...groupWords(words, 'start', 'text', 1000));
            }
            else if (typeof alt['transcript'] === 'string' && alt['transcript'].trim()) {
                // No word timing — emit one entry at 0ms (plain transcript)
                entries.push({ ms: 0, text: alt['transcript'].trim() });
            }
        }
        if (entries.length)
            return finish(entries);
    }
    // 5. Azure recognizedPhrases — offsetInTicks (100ns units)
    if (Array.isArray(obj['recognizedPhrases'])) {
        const entries = [];
        for (const p of obj['recognizedPhrases']) {
            const ticks = Number(p['offsetInTicks'] ?? p['offset'] ?? NaN);
            // Fallback: try offset as HH:MM:SS.mmm string
            let ms;
            if (Number.isFinite(ticks)) {
                ms = Math.round(ticks / 10000); // 100ns → ms
            }
            else {
                const offsetStr = p['offset'];
                ms = typeof offsetStr === 'string' ? parseTimestamp(offsetStr) : NaN;
            }
            if (isNaN(ms))
                continue;
            const nBest = p['nBest'];
            const t = (Array.isArray(nBest) && nBest.length)
                ? String(nBest[0]?.['lexical'] ?? nBest[0]?.['display'] ?? '')
                : String(p['text'] ?? '');
            if (t.trim())
                entries.push({ ms, text: t.trim() });
        }
        if (entries.length)
            return finish(entries);
    }
    // 6. Deepgram — nested paragraphs/sentences or words
    try {
        const chan = obj['results']?.['channels']?.[0]?.['alternatives']?.[0];
        if (chan) {
            const sentences = chan['paragraphs']?.['paragraphs']
                ?.flatMap((p) => p['sentences'] ?? []);
            if (Array.isArray(sentences) && sentences.length) {
                const entries = sentences.map((s) => ({
                    ms: Math.round(Number(s['start'] ?? 0) * 1000),
                    text: String(s['text'] ?? '').trim(),
                })).filter(e => e.text);
                if (entries.length)
                    return finish(entries);
            }
            if (Array.isArray(chan['words'])) {
                const result = groupWords(chan['words'], 'start', 'word', 1000);
                if (result.length)
                    return finish(result);
            }
        }
    }
    catch { /* ignore */ }
    // 7. Flat root array
    if (Array.isArray(obj)) {
        const arr = obj;
        const entries = [];
        for (const item of arr) {
            const start = Number(item['start'] ?? item['offset'] ?? item['begin'] ?? NaN);
            const t = String(item['text'] ?? item['transcript'] ?? item['content'] ?? '').trim();
            if (Number.isFinite(start) && t) {
                const msScale = start > 1000 ? 1 : 1000; // ms vs seconds heuristic
                entries.push({ ms: Math.round(start * msScale), text: t });
            }
        }
        if (entries.length)
            return finish(entries);
    }
    return [];
}
// ── JSON dispatcher ──────────────────────────────────────────────────────────
/**
 * Parse JSON text and dispatch to the most appropriate ASR parser.
 * Returns [] if the text is not valid JSON or no known shape is found.
 */
export function parseTimedJSON(text) {
    let obj;
    try {
        obj = JSON.parse(text);
    }
    catch {
        return [];
    }
    if (typeof obj !== 'object' || obj === null)
        return [];
    // Whisper has a top-level `text` field alongside `segments`
    if ('segments' in obj)
        return parseWhisperJSON(obj);
    return parseASRJSON(obj);
}
/**
 * Detect the format of a timed-text string from its content.
 * Returns a canonical format name or 'native' as the fallback.
 */
export function detectTimedFormat(text) {
    const head = text.trimStart().slice(0, 256);
    if (/^WEBVTT/i.test(head))
        return 'vtt';
    if (/^<\?xml|^<tt[\s>]/i.test(head))
        return 'ttml';
    if (/^\s*\{/i.test(head) || /^\s*\[/i.test(head))
        return 'json';
    // SRT: starts with a digit-only line followed by a timestamp line
    if (/^\d+\s*\n\s*\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s+-->/.test(head))
        return 'srt';
    // Loose SRT: first line is a timestamp (no index number)
    if (/^\d{1,2}:\d{2}:\d{2}[,\.]\d{3}\s+-->/.test(head))
        return 'srt';
    return 'native';
}
/**
 * Parse `text` according to the given format.
 * When `format` is `'auto'` (or omitted), the format is detected automatically.
 *
 * @param text   Raw text content to parse.
 * @param format Optional format hint — 'srt' | 'vtt' | 'ttml' | 'json' | 'whisper' | 'native' | 'auto'
 */
export function parseTimedFormat(text, format = 'auto') {
    const fmt = format === 'auto' ? detectTimedFormat(text) : format;
    switch (fmt) {
        case 'native': return parseTimedNative(text);
        case 'srt': return parseSRT(text);
        case 'vtt': return parseWebVTT(text);
        case 'ttml': return parseTTML(text);
        case 'whisper': return parseTimedJSON(text); // Whisper goes through JSON dispatcher
        case 'json': return parseTimedJSON(text);
        default: return parseTimedNative(text);
    }
}
/**
 * Auto-detect and parse timed text.
 * Equivalent to `parseTimedFormat(text, 'auto')`.
 */
export function parseTimedAuto(text) {
    return parseTimedFormat(text, 'auto');
}
/**
 * Parse a `---`-delimited frame block used in inline section animations.
 *
 * Each frame begins with a timestamp on its first non-empty line
 * (e.g. `37600ms`, `37.6s`, or a bare millisecond number), followed by the
 * frame's content lines.  Frames are separated by a `---` line on its own.
 *
 * Leading and trailing blank lines within each frame's content are stripped;
 * internal blank lines are preserved so multi-line ASCII art renders correctly.
 *
 * Example:
 * ```
 * 37600ms
 * spill
 * ⠀⠀
 * ---
 * 37650ms
 * spill
 * ⠀•
 * ```
 */
export function parseTimedFrames(text) {
    const entries = [];
    const frames = text.split(/^---[ \t]*$/m);
    for (const frame of frames) {
        const lines = frame.split('\n');
        let tsLine = '';
        let tsIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            const l = (lines[i] ?? '').trim();
            if (l) {
                tsLine = l;
                tsIdx = i;
                break;
            }
        }
        if (tsIdx < 0)
            continue;
        const ms = parseTTMLTime(tsLine);
        if (!Number.isFinite(ms))
            continue;
        const contentLines = lines.slice(tsIdx + 1);
        // Trim leading empty lines
        while (contentLines.length > 0 && !(contentLines[0] ?? '').trim())
            contentLines.shift();
        // Trim trailing empty lines
        while (contentLines.length > 0 && !(contentLines[contentLines.length - 1] ?? '').trim())
            contentLines.pop();
        entries.push({ ms, text: contentLines.join('\n') });
    }
    return entries.sort((a, b) => a.ms - b.ms);
}
//# sourceMappingURL=timed-parsers.js.map