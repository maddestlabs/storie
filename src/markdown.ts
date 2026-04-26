/**
 * Custom markdown parser for section-based processing
 * Sections are hierarchical based on heading levels (h1-h6)
 */

import type { Section, CodeBlock, MarkdownDocument, BlobBlock, BlobEncoding, TimedBlock, TimedEntry } from './types.js';
import { expandMagicBlocks, decompressString } from './magic.js';
import { attachLogicBlocksToSections, extractLogicBlocks } from './logic-blocks.js';
import { extractWGSLBlocks } from './wgsl-parser.js';
import { parseTimedFormat, parseTimedFrames, type TimedFormat } from './timed-parsers.js';

interface HeadingMatch {
  level: number;
  title: string;
  line: number;
}

function slugifySectionIdPart(value: string): string {
  const slug = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'section';
}

export function ensureSectionIds(sections: Section[]): Section[] {
  const used = new Set<string>();

  const assign = (list: Section[]) => {
    for (const section of list) {
      const existing = typeof section.id === 'string' ? section.id.trim() : '';
      if (existing && !used.has(existing)) {
        section.id = existing;
        used.add(existing);
      } else {
        const lineSuffix = Number.isFinite(section.startLine) ? `-${section.startLine + 1}` : '';
        const base = `${slugifySectionIdPart(section.title)}${lineSuffix}`;
        let candidate = base;
        let suffix = 2;
        while (used.has(candidate)) {
          candidate = `${base}-${suffix++}`;
        }
        section.id = candidate;
        used.add(candidate);
      }

      if (section.children.length > 0) {
        assign(section.children);
      }
    }
  };

  assign(sections);
  return sections;
}

export async function parseMarkdown(source: string): Promise<MarkdownDocument> {
  // Normalize line endings so parsing behaves consistently across platforms.
  // On Windows, fetched files often contain CRLF, and downstream parsing logic
  // splits on '\n', leaving a trailing '\r' on each line.
  const normalizedSource = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 1: Process magic blocks FIRST - they expand into markdown content
  const expandedSource = await expandMagicBlocks(normalizedSource);
  
  // Step 2: Extract WGSL shaders AFTER magic expansion (so shaders can be compressed)
  const wgslShaders = extractWGSLBlocks(expandedSource);
  
  // Step 3: Extract normal markdown elements
  const sections = extractSections(expandedSource);
  const codeBlocks = extractCodeBlocks(expandedSource);
  const logicBlocks = extractLogicBlocks(codeBlocks, sections);
  attachLogicBlocksToSections(sections, logicBlocks);
  let blobBlocks = extractBlobBlocks(codeBlocks);
  // Blob-level magic decompression: ```blob ... magic
  // If present, the blob payload is treated as base64(deflate-raw(utf8(text)))
  // and decompressed here so downstream blob decoding remains synchronous.
  if (blobBlocks.length > 0 && blobBlocks.some(b => !!b.magic)) {
    blobBlocks = await Promise.all(
      blobBlocks.map(async (b) => {
        if (!b.magic) return b;
        const compressed = String(b.data ?? '').replace(/\s+/g, '');
        if (!compressed) return b;
        const decompressed = await decompressString(compressed);
        if (!decompressed) {
          console.warn(`[blob] Magic decompression failed for blob "${b.name}" (${b.encoding}); keeping original payload`);
          return b;
        }
        return { ...b, data: decompressed };
      })
    );
  }
  const metadata = extractFrontmatter(expandedSource);
  const timedBlocks = extractTimedBlocks(codeBlocks);

  return {
    sections,
    codeBlocks,
    metadata,
    sourceMarkdown: normalizedSource,
    wgslShaders,
    blobBlocks,
    timedBlocks,
    logicBlocks,
  };
}

function serializeFrontmatterValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
    return JSON.stringify(value);
  }

  const text = String(value);
  if (text.length === 0) return '""';
  if (/^[A-Za-z0-9._/+:-]+$/.test(text) && !/^(true|false|null|nil|none|~)$/i.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function serializeHeadingDirective(section: Section): string {
  const directive: Record<string, any> = section.directive ? { ...section.directive } : {};
  if (section.timedMs !== undefined) {
    directive.timed = `${section.timedMs}ms`;
  }
  const keys = Object.keys(directive);
  if (keys.length === 0) return '';
  return ` ${JSON.stringify(directive)}`;
}

function serializeSectionTree(sections: Section[]): string {
  const parts: string[] = [];

  const visit = (section: Section) => {
    const heading = `${'#'.repeat(Math.max(1, Math.min(6, Math.round(section.level || 1))))} ${section.title}${serializeHeadingDirective(section)}`;
    const body = String(section.content || '').replace(/\s+$/g, '');
    const children = Array.isArray(section.children) ? section.children : [];

    let chunk = heading;
    if (body.length > 0) {
      chunk += `\n\n${body}`;
    }
    if (children.length > 0) {
      const childMarkdown = children.map((child) => {
        visit(child);
        return parts.pop() || '';
      }).filter(Boolean).join('\n\n');
      if (childMarkdown.length > 0) {
        chunk += `\n\n${childMarkdown}`;
      }
    }

    parts.push(chunk);
  };

  for (const section of sections) {
    visit(section);
  }

  return parts.join('\n\n');
}

export function serializeMarkdownDocumentSource(document: Pick<MarkdownDocument, 'metadata' | 'sections'>): string {
  const metadata = document.metadata && typeof document.metadata === 'object' ? document.metadata : {};
  const sections = Array.isArray(document.sections) ? document.sections : [];
  const body = serializeSectionTree(sections);
  const frontmatterKeys = Object.keys(metadata);

  if (frontmatterKeys.length === 0) {
    return body;
  }

  const frontmatter = [
    '---',
    ...frontmatterKeys.map((key) => `${key}: ${serializeFrontmatterValue(metadata[key])}`),
    '---',
  ].join('\n');

  return body.length > 0 ? `${frontmatter}\n\n${body}` : `${frontmatter}\n`;
}

// ── Heading directive helpers ──────────────────────────────────────────────────

/**
 * Parse a millisecond value from a directive field.
 * Accepts: number, "4000", "4000ms", "4.5s".
 * Returns `undefined` for unrecognised / missing values.
 */
function _parseTimedMs(v: any): number | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  const s = String(v).trim().toLowerCase();
  // "4000ms" or "4000"
  const msMatch = s.match(/^(\d+(?:\.\d+)?)\s*ms$/);
  if (msMatch) return Math.max(0, parseFloat(msMatch[1]!));
  // "4.5s"
  const sMatch = s.match(/^(\d+(?:\.\d+)?)\s*s$/);
  if (sMatch) return Math.max(0, parseFloat(sMatch[1]!) * 1000);
  // bare number string
  const n = parseFloat(s);
  if (Number.isFinite(n)) return Math.max(0, n);
  return undefined;
}

function _tryParseJsonObject(raw: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, any>;
    }
  } catch {
    // Fall through to relaxed parsing.
  }
  return null;
}

function _splitTopLevel(input: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let quote: '"' | "'" | null = null;
  let escape = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      continue;
    }
    if (ch === '}') {
      if (braceDepth === 0) return null;
      braceDepth--;
      continue;
    }
    if (ch === '[') {
      bracketDepth++;
      continue;
    }
    if (ch === ']') {
      if (bracketDepth === 0) return null;
      bracketDepth--;
      continue;
    }

    if (ch === ',' && braceDepth === 0 && bracketDepth === 0) {
      parts.push(input.slice(start, i).trim());
      start = i + 1;
    }
  }

  if (quote || escape || braceDepth !== 0 || bracketDepth !== 0) return null;

  const tail = input.slice(start).trim();
  if (tail.length > 0) parts.push(tail);

  while (parts.length > 0 && parts[parts.length - 1] === '') {
    parts.pop();
  }

  return parts.some((part) => part.length === 0) ? null : parts;
}

function _findTopLevelColon(input: string): number {
  let quote: '"' | "'" | null = null;
  let escape = false;
  let braceDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;

    if (quote) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === '{') {
      braceDepth++;
      continue;
    }
    if (ch === '}') {
      if (braceDepth > 0) braceDepth--;
      continue;
    }
    if (ch === '[') {
      bracketDepth++;
      continue;
    }
    if (ch === ']') {
      if (bracketDepth > 0) bracketDepth--;
      continue;
    }

    if (ch === ':' && braceDepth === 0 && bracketDepth === 0) {
      return i;
    }
  }

  return -1;
}

function _parseSingleQuotedString(raw: string): string | null {
  if (raw.length < 2 || raw[0] !== "'" || raw[raw.length - 1] !== "'") return null;
  let out = '';
  for (let i = 1; i < raw.length - 1; i++) {
    const ch = raw[i]!;
    if (ch !== '\\') {
      out += ch;
      continue;
    }
    i++;
    if (i >= raw.length - 1) return null;
    const esc = raw[i]!;
    switch (esc) {
      case '\\': out += '\\'; break;
      case "'": out += "'"; break;
      case '"': out += '"'; break;
      case 'n': out += '\n'; break;
      case 'r': out += '\r'; break;
      case 't': out += '\t'; break;
      default: out += esc; break;
    }
  }
  return out;
}

function _parseLooseDirectiveKey(raw: string): string | null {
  const key = raw.trim();
  if (!key) return null;

  if (key.startsWith('"')) {
    try {
      const parsed = JSON.parse(key);
      return typeof parsed === 'string' ? parsed : null;
    } catch {
      return null;
    }
  }

  if (key.startsWith("'")) return _parseSingleQuotedString(key);

  return /^[A-Za-z0-9_.-]+$/.test(key) ? key : null;
}

function _parseLooseDirectiveValue(raw: string): any {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith('{') && value.endsWith('}')) {
    const jsonObject = _tryParseJsonObject(value);
    if (jsonObject) return jsonObject;
    return _parseLooseDirectiveObject(value);
  }

  if (value.startsWith('[') && value.endsWith(']')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (value.startsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  if (value.startsWith("'")) {
    const parsed = _parseSingleQuotedString(value);
    return parsed ?? value;
  }

  if (/^(?:true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  if (/^null$/i.test(value)) return null;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)) return Number(value);

  return value;
}

function _parseLooseDirectiveObject(raw: string): Record<string, any> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;

  const body = trimmed.slice(1, -1).trim();
  if (!body) return {};

  const parts = _splitTopLevel(body);
  if (!parts) return null;

  const out: Record<string, any> = {};
  for (const part of parts) {
    const colon = _findTopLevelColon(part);
    if (colon <= 0) return null;

    const key = _parseLooseDirectiveKey(part.slice(0, colon));
    if (!key) return null;

    out[key] = _parseLooseDirectiveValue(part.slice(colon + 1));
  }

  return out;
}

export function parseHeadingDirectiveObject(raw: string): Record<string, any> | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  return _tryParseJsonObject(trimmed) ?? _parseLooseDirectiveObject(trimmed);
}

/**
 * Look for a trailing directive object at the end of a heading title, e.g.
 *   `# First Verse {timed: 4000ms, x: 400}`
 *   `# First Verse {"timed": "4000ms", "x": "400"}`
 *
 * Returns the display title (text before the `{`), the parsed directive
 * object, and the extracted `timedMs` in milliseconds.
 * If no valid object suffix is found, returns the original title
 * with null directive and undefined timedMs.
 */
function _parseHeadingDirective(rawTitle: string): {
  displayTitle: string;
  directive: Record<string, any> | null;
  timedMs: number | undefined;
} {
  const lastBrace = rawTitle.lastIndexOf('{');
  if (lastBrace >= 0) {
    const directivePart = rawTitle.slice(lastBrace);
    const obj = parseHeadingDirectiveObject(directivePart);
    if (obj) {
      const displayTitle = rawTitle.slice(0, lastBrace).trim();
      const timedMs = _parseTimedMs(obj['timed']);
      return { displayTitle, directive: obj, timedMs };
    }
  }
  return { displayTitle: rawTitle, directive: null, timedMs: undefined };
}

// ── Inline section frame animation extraction ─────────────────────────────

/**
 * Detect and extract `timed animate:content` / `timed animate:title` fenced
 * blocks from raw section content.  The fence is removed from the returned
 * `strippedContent` so it never reaches the card renderer.
 *
 * Syntax inside a section:
 * ```timed animate:content
 * 37600ms
 * first frame line one
 * first frame line two
 * ---
 * 37650ms
 * second frame…
 * ```
 */
function extractSectionAnimateBlocks(content: string): {
  contentFrames: TimedEntry[] | undefined;
  titleFrames: TimedEntry[] | undefined;
  contentFramesRelative: boolean;
  titleFramesRelative: boolean;
  strippedContent: string;
} {
  let strippedContent = content;
  let contentFrames: TimedEntry[] | undefined;
  let titleFrames: TimedEntry[] | undefined;
  let contentFramesRelative = false;
  let titleFramesRelative = false;

  // Match ```timed animate:content or ```timed animate:title fenced blocks.
  // Optional modifiers follow the target, e.g. ```timed animate:content relative
  // The `s` (dotAll) flag is not used for compatibility; [\s\S] covers newlines.
  const fenceRe = /^```timed\s+animate:(content|title)((?:[ \t][^\n]*)?)\n([\s\S]*?)^```/gm;
  const matches = [...content.matchAll(fenceRe)];

  for (const match of matches) {
    const target = match[1] as 'content' | 'title';
    const modifiers = (match[2] ?? '').toLowerCase();
    const isRelative = /\brelative\b/.test(modifiers);
    const body = match[3] ?? '';
    const entries = parseTimedFrames(body);
    if (entries.length > 0) {
      if (target === 'content') {
        contentFrames = entries;
        contentFramesRelative = isRelative;
      } else {
        titleFrames = entries;
        titleFramesRelative = isRelative;
      }
    }
    strippedContent = strippedContent.replace(match[0]!, '');
  }

  strippedContent = strippedContent.trim();
  return { contentFrames, titleFrames, contentFramesRelative, titleFramesRelative, strippedContent };
}

// ── Timed block extraction ────────────────────────────────────────────

/**
 * Extract all ```timed name:... fenced blocks from parsed code blocks.
 *
 * The fence info line supports an optional `format:` hint that tells the
 * parser which timed-text dialect to use:
 *
 *   ```timed name:lyrics format:srt
 *   ```timed name:lyrics format:vtt
 *   ```timed name:lyrics format:ttml
 *   ```timed name:lyrics format:json
 *   ```timed name:lyrics format:native   (default Storie ms|text format)
 *
 * When `format` is absent the format is auto-detected from the content.
 * Entries are always sorted ascending by `ms` before being stored.
 */
function extractTimedBlocks(codeBlocks: CodeBlock[]): TimedBlock[] {
  const out: TimedBlock[] = [];

  for (const block of codeBlocks) {
    if (block.lang !== "timed") continue;

    const name = String(block.metadata?.["name"] ?? "").trim();

    // Optional format hint on the fence info line: `format:srt` etc.
    const formatHint = (String(block.metadata?.["format"] ?? "auto").trim().toLowerCase()) as TimedFormat;

    const entries: TimedEntry[] = parseTimedFormat(block.code, formatHint);
    // parseTimedFormat guarantees sorted output, but sort again as a safety net.
    entries.sort((a, b) => a.ms - b.ms);

    out.push({ name, entries, startLine: block.startLine, endLine: block.endLine });
  }

  return out;
}
function extractBlobBlocks(codeBlocks: CodeBlock[]): BlobBlock[] {
  const out: BlobBlock[] = [];

  const isTruthy = (v: any): boolean => {
    if (v === true) return true;
    if (v === false || v === null || v === undefined) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on' || s === 'magic';
  };

  for (const block of codeBlocks) {
    if (block.lang !== 'blob') continue;

    const name = String(block.metadata?.name ?? '').trim();
    if (!name) {
      // Skip unnamed blobs.
      continue;
    }

    const mime = String(block.metadata?.mime ?? 'application/octet-stream').trim() || 'application/octet-stream';
    const encoding = String(block.metadata?.enc ?? 'base64').trim().toLowerCase() as BlobEncoding;
    if (encoding !== 'base64' && encoding !== 'hex') {
      continue;
    }

    // Keep payload as-is; consumers can strip whitespace when decoding.
    out.push({
      name,
      mime,
      encoding,
      data: block.code,
      magic: isTruthy(block.metadata?.magic),
      startLine: block.startLine,
      endLine: block.endLine
    });
  }

  return out;
}

/**
 * Extract hierarchical sections based on heading levels
 */
function extractSections(source: string): Section[] {
  const lines = source.split('\n');
  const headings: HeadingMatch[] = [];

  // Debug aid (only used when headings unexpectedly come out empty).
  const candidateHeadings: Array<{ line: number; inFence: boolean; text: string }> = [];
  let fenceToggles = 0;

  // Detect YAML frontmatter range so we don't accidentally treat the closing
  // '---' as a Setext underline (e.g. "key: value\n---").
  let frontmatterEnd = -1;
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        frontmatterEnd = i;
        break;
      }
    }
  }

  // Track fenced code blocks so headings inside fences are ignored.
  let inFence = false;

  // Find all headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Toggle fenced code blocks
    if (line.trim().startsWith('```')) {
      inFence = !inFence;
      fenceToggles++;
      continue;
    }

    // Skip frontmatter and fenced code
    if (inFence) continue;
    if (frontmatterEnd >= 0 && i <= frontmatterEnd) continue;

    // Capture a few heading-like lines for debugging if section extraction fails.
    if (candidateHeadings.length < 8) {
      const ls = line.trimStart();
      if (ls.startsWith('#')) {
        candidateHeadings.push({ line: i + 1, inFence, text: ls.slice(0, 120) });
      }
    }
    
    // ATX-style headings (# Heading)
    // Allow optional leading whitespace before the # so section parsing still
    // works when markdown is indented (e.g. embedded in HTML or copied/pasted).
    // Also allow *no* whitespace after the hashes ("#Title"), because some
    // content sources can introduce odd characters after the hash which makes
    // strict "\s+" matching fail in practice.
    const atxMatch = line.match(/^\s*(#{1,6})\s*(.+)$/);
    if (atxMatch) {
      headings.push({
        level: atxMatch[1].length,
        title: atxMatch[2].trim(),
        line: i
      });
      continue;
    }

    // Setext-style headings (underlined with = or -)
    if (i > 0 && lines[i - 1].trim().length > 0) {
      if (frontmatterEnd >= 0 && i - 1 <= frontmatterEnd) {
        continue;
      }
      if (/^=+$/.test(line.trim())) {
        headings.push({
          level: 1,
          title: lines[i - 1].trim(),
          line: i - 1
        });
      } else if (/^-+$/.test(line.trim())) {
        headings.push({
          level: 2,
          title: lines[i - 1].trim(),
          line: i - 1
        });
      }
    }
  }

  if (headings.length === 0 && candidateHeadings.length > 0) {
    // Re-test the regex against our samples to diagnose environment-specific regex behavior.
    const re = /^\s*(#{1,6})\s*(.+)$/;
    const tested = candidateHeadings.map((c) => {
      const raw = c.text;
      const m = raw.match(re);
      return {
        line: c.line,
        inFence: c.inFence,
        raw,
        matched: !!m,
        groups: m ? [m[1], m[2]] : null,
        cps: Array.from(raw).slice(0, 24).map(ch => '0x' + ch.codePointAt(0)!.toString(16))
      };
    });

    console.warn('[markdown] No sections detected, but heading-like lines exist:', {
      frontmatterEnd: frontmatterEnd >= 0 ? frontmatterEnd + 1 : null,
      fenceToggles,
      sample: tested
    });
  }

  // Build hierarchical structure
  const rootSections: Section[] = [];
  const stack: { section: Section; level: number }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length - 1;

    // Extract content (everything between this heading and the next)
    const contentLines = lines.slice(heading.line + 1, endLine + 1);
    const rawContent = contentLines.join('\n').trim();

    // Extract inline animation blocks before storing content
    const { contentFrames, titleFrames, contentFramesRelative, titleFramesRelative, strippedContent } = extractSectionAnimateBlocks(rawContent);

    const { displayTitle, directive, timedMs } = _parseHeadingDirective(heading.title);
    const section: Section = {
      id: undefined,
      title: displayTitle,
      level: heading.level,
      content: strippedContent,
      startLine: heading.line,
      endLine,
      children: [],
      ...(timedMs !== undefined       ? { timedMs }               : {}),
      ...(directive                   ? { directive }              : {}),
      ...(contentFrames               ? { contentFrames }          : {}),
      ...(titleFrames                 ? { titleFrames }            : {}),
      ...(contentFramesRelative       ? { contentFramesRelative }  : {}),
      ...(titleFramesRelative         ? { titleFramesRelative }    : {}),
    };

    // Pop from stack until we find a parent
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      // Top-level section
      rootSections.push(section);
    } else {
      // Child section
      stack[stack.length - 1].section.children.push(section);
    }

    stack.push({ section, level: heading.level });
  }

  return ensureSectionIds(rootSections);
}

/**
 * Extract code blocks with language tags and metadata
 * Supports syntax like: ```js on:init
 */
function extractCodeBlocks(source: string): CodeBlock[] {
  const lines = source.split('\n');
  const codeBlocks: CodeBlock[] = [];
  let inCodeBlock = false;
  let currentBlock: { lang: string; metadata: Record<string, string>; lines: string[]; startLine: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      if (!inCodeBlock) {
        // Start of code block - parse language and metadata
        const declLine = line.trim().substring(3).trim();
        const parts = declLine.split(/\s+/);
        const lang = parts[0] || 'text';
        const metadata: Record<string, string> = {};
        
        // Parse metadata like "on:init" or "key:value".
        // Also support bare flags like "magic" (stored as "true").
        for (let j = 1; j < parts.length; j++) {
          const token = parts[j] ?? '';
          if (!token) continue;
          const idx = token.indexOf(':');
          if (idx > 0) {
            const k = token.slice(0, idx);
            const v = token.slice(idx + 1);
            if (k) metadata[k] = v;
            continue;
          }
          // Bare flag
          metadata[token] = 'true';
        }
        
        currentBlock = {
          lang,
          metadata,
          lines: [],
          startLine: i
        };
        inCodeBlock = true;
      } else {
        // End of code block
        if (currentBlock) {
          const block: CodeBlock = {
            lang: currentBlock.lang,
            code: currentBlock.lines.join('\n'),
            startLine: currentBlock.startLine,
            endLine: i
          };
          
          // Only add metadata if not empty
          if (Object.keys(currentBlock.metadata).length > 0) {
            block.metadata = currentBlock.metadata;
          }
          
          codeBlocks.push(block);
        }
        currentBlock = null;
        inCodeBlock = false;
      }
    } else if (inCodeBlock && currentBlock) {
      currentBlock.lines.push(line);
    }
  }

  // If the file ends while still inside a fenced block, emit it anyway.
  // This makes the parser more robust for large embedded assets.
  if (inCodeBlock && currentBlock) {
    const block: CodeBlock = {
      lang: currentBlock.lang,
      code: currentBlock.lines.join('\n'),
      startLine: currentBlock.startLine,
      endLine: lines.length - 1
    };
    if (Object.keys(currentBlock.metadata).length > 0) {
      block.metadata = currentBlock.metadata;
    }
    codeBlocks.push(block);
  }

  return codeBlocks;
}

/**
 * Extract YAML frontmatter if present
 * Supports: strings, numbers, booleans, arrays (comma-separated or JSON)
 */
function extractFrontmatter(source: string): Record<string, any> {
  const lines = source.split('\n');
  const metadata: Record<string, any> = {};

  if (lines[0]?.trim() === '---') {
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex > 0) {
      const yamlLines = lines.slice(1, endIndex);
      for (const line of yamlLines) {
        // Match key: value pairs (support hyphens and underscores in keys)
        const match = line.match(/^([\w-]+):\s*(.*)$/);
        if (match) {
          const key = match[1];
          let value: any = match[2].trim();
          
          // Handle empty/null values
          if (value.length === 0 || ['null', 'nil', 'none', '~'].includes(value.toLowerCase())) {
            metadata[key] = null;
            continue;
          }
          
          // Check for boolean FIRST (before trying to parse as number)
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'true' || lowerValue === 'false') {
            metadata[key] = lowerValue === 'true';
            continue;
          }
          
          // Remove surrounding quotes from strings
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
            metadata[key] = value;
            continue;
          }
          
          // Try to parse as JSON array/object first (handles [1,2,3] or {"x": 1})
          if ((value.startsWith('[') && value.endsWith(']')) ||
              (value.startsWith('{') && value.endsWith('}'))) {
            try {
              metadata[key] = JSON.parse(value);
              continue;
            } catch {
              // Not valid JSON, treat as string
            }
          }
          
          // Handle comma-separated arrays (e.g., "tags: one, two, three")
          if (value.includes(',') && !value.startsWith('"') && !value.startsWith("'")) {
            const items = value.split(',').map((item: string) => {
              const trimmed = item.trim();
              // Try to parse each item as number/boolean
              if (trimmed === 'true') return true;
              if (trimmed === 'false') return false;
              if (!isNaN(Number(trimmed)) && trimmed !== '') return Number(trimmed);
              // Remove quotes if present
              if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
                  (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                return trimmed.slice(1, -1);
              }
              return trimmed;
            });
            metadata[key] = items;
            continue;
          }
          
          // Try to parse as number (int or float)
          if (!isNaN(Number(value)) && value !== '') {
            metadata[key] = Number(value);
            continue;
          }
          
          // Default: store as string
          metadata[key] = value;
        }
      }
    }
  }

  return metadata;
}

/**
 * Find a section by title (case-insensitive search)
 */
export function findSection(sections: Section[], title: string): Section | null {
  const normalized = title.toLowerCase().trim();
  
  for (const section of sections) {
    if (section.title.toLowerCase().trim() === normalized) {
      return section;
    }
    
    const found = findSection(section.children, title);
    if (found) return found;
  }
  
  return null;
}

/**
 * Get all sections flattened (depth-first)
 */
export function flattenSections(sections: Section[]): Section[] {
  const result: Section[] = [];
  
  for (const section of sections) {
    result.push(section);
    if (section.children.length > 0) {
      result.push(...flattenSections(section.children));
    }
  }
  
  return result;
}
