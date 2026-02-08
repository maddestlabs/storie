/**
 * Custom markdown parser for section-based processing
 * Sections are hierarchical based on heading levels (h1-h6)
 */

import type { Section, CodeBlock, MarkdownDocument } from './types.js';

interface HeadingMatch {
  level: number;
  title: string;
  line: number;
}

export function parseMarkdown(source: string): MarkdownDocument {
  const sections = extractSections(source);
  const codeBlocks = extractCodeBlocks(source);
  const metadata = extractFrontmatter(source);

  return {
    sections,
    codeBlocks,
    metadata
  };
}

/**
 * Extract hierarchical sections based on heading levels
 */
function extractSections(source: string): Section[] {
  const lines = source.split('\n');
  const headings: HeadingMatch[] = [];

  // Find all headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // ATX-style headings (# Heading)
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
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
        
        // Parse metadata like "on:init" or "key:value"
        for (let j = 1; j < parts.length; j++) {
          const pair = parts[j].split(':');
          if (pair.length === 2) {
            metadata[pair[0]] = pair[1];
          }
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

  return codeBlocks;
}

/**
 * Extract YAML frontmatter if present
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
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1];
          let value: any = match[2].trim();
          
          // Remove surrounding quotes from strings
          if ((value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          // Try to parse as JSON
          else if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (!isNaN(Number(value))) value = Number(value);
          
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
