/**
 * Magic Blocks - Runtime compression/decompression for magic blocks
 * 
 * This module provides compression/decompression functions for "magic blocks"
 * that allow embedding compressed, parameterized markdown snippets.
 * 
 * Magic blocks are processed BEFORE normal markdown parsing, so they can
 * expand into code blocks, headings, and other markdown content.
 * 
 * Example:
 * ```magic name="stars" count="100"
 * eJx9ksFKw0AQhu95ijVeWmlqKQhaRCgqVVAoSWuPZk2m7UB2EzYbpYY8gHjwmMfw6N1HyZO4iTZ20+ptZ...
 * ```
 * 
 * The compressed content can include parameter placeholders like {{name}} and {{count}}
 * which are substituted with the provided values.
 */

/**
 * Decompress a base64-encoded deflate-compressed string
 * Uses browser's native DecompressionStream API (available in modern browsers)
 * 
 * Note: Uses raw DEFLATE format (RFC 1951) to match Nim's dfDeflate  
 * Compatible with DecompressionStream('deflate-raw')
 */
export async function decompressString(base64Input: string): Promise<string> {
  try {
    // Decode base64 to Uint8Array
    const binaryString = atob(base64Input);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Decompress using raw DEFLATE format (matches Nim's dfDeflate)
    const stream = new Response(bytes).body!
      .pipeThrough(new DecompressionStream('deflate-raw'));
    const decompressed = await new Response(stream).arrayBuffer();
    const decoder = new TextDecoder();
    return decoder.decode(decompressed);
  } catch (error) {
    console.error('[Magic] Decompression error:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Compress a string and encode as base64
 * Uses browser's native CompressionStream API
 * Uses raw DEFLATE format to match Nim's dfDeflate
 */
export async function compressString(input: string): Promise<string> {
  try {
    // Encode string to Uint8Array
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);

    // Compress using raw DEFLATE (matches Nim's dfDeflate)
    const stream = new Response(bytes).body!
      .pipeThrough(new CompressionStream('deflate-raw'));

    // Read the compressed data
    const compressed = await new Response(stream).arrayBuffer();
    
    // Convert to base64
    const compressedBytes = new Uint8Array(compressed);
    let binaryString = '';
    for (let i = 0; i < compressedBytes.length; i++) {
      binaryString += String.fromCharCode(compressedBytes[i]);
    }
    return btoa(binaryString);
  } catch (error) {
    console.error('[Magic] Compression error:', error);
    return '';
  }
}

/**
 * Parse parameters from magic block header
 * Example: name="bugs" count="100" speed="3.0"
 * Returns: {name: "bugs", count: "100", speed: "3.0"}
 */
export function parseMagicParams(paramString: string): Record<string, string> {
  const result: Record<string, string> = {};
  
  let i = 0;
  while (i < paramString.length) {
    // Skip whitespace
    while (i < paramString.length && /\s/.test(paramString[i])) {
      i++;
    }
    
    if (i >= paramString.length) break;
    
    // Parse key
    let key = '';
    while (i < paramString.length && !/[\s=]/.test(paramString[i])) {
      key += paramString[i];
      i++;
    }
    
    // Skip whitespace and '='
    while (i < paramString.length && /[\s=]/.test(paramString[i])) {
      i++;
    }
    
    if (i >= paramString.length || key.length === 0) break;
    
    // Parse value (expect quoted string)
    let value = '';
    if (paramString[i] === '"' || paramString[i] === "'") {
      const quote = paramString[i];
      i++; // Skip opening quote
      while (i < paramString.length && paramString[i] !== quote) {
        value += paramString[i];
        i++;
      }
      if (i < paramString.length) {
        i++; // Skip closing quote
      }
    } else {
      // Unquoted value (until space)
      while (i < paramString.length && !/\s/.test(paramString[i])) {
        value += paramString[i];
        i++;
      }
    }
    
    if (key.length > 0) {
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Extract parameter names declared in <!-- MAGIC_PARAMS: name, count, speed --> comments
 * This provides explicit parameter declaration for safety
 */
export function extractDeclaredParams(content: string): string[] {
  const result: string[] = [];
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('<!--') && trimmed.includes('MAGIC_PARAMS:')) {
      // Extract parameter list
      const startPos = trimmed.indexOf('MAGIC_PARAMS:') + 13;
      const endPos = trimmed.indexOf('-->', startPos);
      if (endPos > startPos) {
        const paramList = trimmed.substring(startPos, endPos).trim();
        for (const param of paramList.split(',')) {
          const cleaned = param.trim();
          if (cleaned.length > 0) {
            result.push(cleaned);
          }
        }
      }
      break;
    }
  }
  
  return result;
}

/**
 * Replace parameter placeholders in content with actual values
 * 
 * Syntax options:
 * - "{{PARAM}}" (default): {{name}} becomes "bugs"  - Mustache/Handlebars style
 * - "@PARAM@": @name@ becomes "bugs" - Simple distinctive markers
 * - "$PARAM$": $name$ becomes "bugs" - Dollar signs
 * - "<!--PARAM-->": <!--name--> becomes "bugs" - HTML comment style (safest for code)
 * 
 * If content contains <!-- MAGIC_PARAMS: ... -->, only those declared params are substituted
 */
export function substituteMagicParams(
  content: string,
  params: Record<string, string>,
  syntax: string = '{{PARAM}}'
): string {
  let result = content;
  
  // Check if parameters are explicitly declared
  const declaredParams = extractDeclaredParams(content);
  const useOnlyDeclared = declaredParams.length > 0;
  
  for (const [key, value] of Object.entries(params)) {
    // Skip if this param isn't declared (when using explicit declaration)
    if (useOnlyDeclared && !declaredParams.includes(key)) {
      continue;
    }
    
    // Build placeholder based on syntax
    let placeholder = '';
    switch (syntax) {
      case '{{PARAM}}':
        placeholder = `{{${key}}}`;
        break;
      case '@PARAM@':
        placeholder = `@${key}@`;
        break;
      case '$PARAM$':
        placeholder = `$${key}$`;
        break;
      case '<!--PARAM-->':
        placeholder = `<!--${key}-->`;
        break;
      default:
        // Fallback to double-brace
        placeholder = `{{${key}}}`;
    }
    
    // Replace all occurrences
    result = result.replaceAll(placeholder, value);
  }
  
  return result;
}

/**
 * Expand all magic blocks in markdown source
 * Processes magic blocks BEFORE normal markdown parsing
 * 
 * Magic blocks are identified by ```magic markers and contain:
 * 1. Optional parameters in the marker line: ```magic name="test" count="10"
 * 2. Compressed base64 content on subsequent lines
 * 
 * The compressed content is decompressed and parameter placeholders are substituted.
 * The resulting markdown is inserted in place of the magic block.
 */
export async function expandMagicBlocks(source: string): Promise<string> {
  const lines = source.split('\n');
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for magic block start
    if (trimmed.startsWith('```magic')) {
      // Parse parameters from the marker line
      const markerLine = trimmed.substring(8).trim(); // Remove "```magic"
      const params = parseMagicParams(markerLine);
      
      // Collect compressed content until closing ```
      const compressedLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        compressedLines.push(lines[i].trim());
        i++;
      }
      
      // Skip the closing ```
      if (i < lines.length) {
        i++;
      }
      
      // Decompress the content
      const compressedContent = compressedLines.join('');
      if (compressedContent.length > 0) {
        try {
          const decompressed = await decompressString(compressedContent);
          
          if (decompressed.length > 0) {
            // Substitute parameters
            const expanded = substituteMagicParams(decompressed, params);
            
            // Add the expanded content to result
            result.push(expanded);
            
            console.log(`[Magic] Expanded block with params:`, params);
          } else {
            console.warn('[Magic] Decompression resulted in empty content');
          }
        } catch (error) {
          console.error('[Magic] Failed to expand magic block:', error);
        }
      }
    } else {
      // Regular line - pass through as-is
      result.push(line);
      i++;
    }
  }

  return result.join('\n');
}
