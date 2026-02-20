/**
 * Custom markdown parser for section-based processing
 * Sections are hierarchical based on heading levels (h1-h6)
 */

import type { Section, CodeBlock, MarkdownDocument, BlobBlock, BlobEncoding } from './types.js';
import { expandMagicBlocks, decompressString } from './magic.js';
import { extractWGSLBlocks } from './wgsl-parser.js';

interface HeadingMatch {
  level: number;
  title: string;
  line: number;
}

export async function parseMarkdown(source: string): Promise<MarkdownDocument> {
  // Step 1: Process magic blocks FIRST - they expand into markdown content
  const expandedSource = await expandMagicBlocks(source);
  
  // Step 2: Extract WGSL shaders AFTER magic expansion (so shaders can be compressed)
  const wgslShaders = extractWGSLBlocks(expandedSource);
  
  // Step 3: Extract normal markdown elements
  const sections = extractSections(expandedSource);
  const codeBlocks = extractCodeBlocks(expandedSource);
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

  return {
    sections,
    codeBlocks,
    metadata,
    wgslShaders,
    blobBlocks
  };
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
      continue;
    }

    // Skip frontmatter and fenced code
    if (inFence) continue;
    if (frontmatterEnd >= 0 && i <= frontmatterEnd) continue;
    
    // ATX-style headings (# Heading)
    // Allow optional leading whitespace before the # so section parsing still
    // works when markdown is indented (e.g. embedded in HTML or copied/pasted).
    const atxMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
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

  // Build hierarchical structure
  const rootSections: Section[] = [];
  const stack: { section: Section; level: number }[] = [];

  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length - 1;

    // Extract content (everything between this heading and the next)
    const contentLines = lines.slice(heading.line + 1, endLine + 1);
    const content = contentLines.join('\n').trim();

    const section: Section = {
      title: heading.title,
      level: heading.level,
      content,
      startLine: heading.line,
      endLine,
      children: []
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

  return rootSections;
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
