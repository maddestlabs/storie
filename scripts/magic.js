#!/usr/bin/env node

/**
 * Magic Block CLI Tool
 * 
 * Compress markdown presets into magic blocks that can be embedded in documents.
 * 
 * Usage:
 *   node scripts/magic.js compress input.md         # Compress and output base64
 *   node scripts/magic.js decompress <base64>       # Decompress base64 string
 *   node scripts/magic.js pack input.md output.md   # Create magic block file
 */

import { readFileSync, writeFileSync } from 'fs';
import { deflateRawSync, inflateRawSync } from 'zlib';

/**
 * Compress a string using raw DEFLATE and encode as base64
 * Uses raw DEFLATE format (RFC 1951) to match Nim's dfDeflate
 * Compatible with browser DecompressionStream('deflate-raw')
 */
function compressString(input) {
  const compressed = deflateRawSync(Buffer.from(input, 'utf-8'));
  return compressed.toString('base64');
}

/**
 * Decompress a base64-encoded raw DEFLATE string
 * Uses raw DEFLATE format (RFC 1951) to match Nim's dfDeflate
 * Compatible with browser DecompressionStream('deflate-raw')
 */
function decompressString(base64Input) {
  try {
    const buffer = Buffer.from(base64Input, 'base64');
    const decompressed = inflateRawSync(buffer);
    return decompressed.toString('utf-8');
  } catch (error) {
    console.error('Decompression error:', error.message);
    return '';
  }
}

const commands = {
  compress: (inputFile) => {
    const content = readFileSync(inputFile, 'utf-8');
    const compressed = compressString(content);
    console.log('\nCompressed (base64):');
    console.log(compressed);
    console.log(`\nOriginal size: ${content.length} bytes`);
    console.log(`Compressed size: ${compressed.length} bytes`);
    console.log(`Compression ratio: ${(compressed.length / content.length * 100).toFixed(1)}%`);
  },

  decompress: (base64Input) => {
    const decompressed = decompressString(base64Input);
    if (decompressed) {
      console.log('\nDecompressed content:');
      console.log(decompressed);
    } else {
      console.error('Decompression failed');
      process.exit(1);
    }
  },

  pack: (inputFile, outputFile) => {
    const content = readFileSync(inputFile, 'utf-8');
    const compressed = compressString(content);
    
    const magicBlock = `\`\`\`magic
${compressed}
\`\`\`
`;
    
    writeFileSync(outputFile, magicBlock);
    console.log(`✓ Created magic block: ${outputFile}`);
    console.log(`  Original: ${content.length} bytes`);
    console.log(`  Compressed: ${compressed.length} bytes`);
    console.log(`  Ratio: ${(compressed.length / content.length * 100).toFixed(1)}%`);
  },

  help: () => {
    console.log(`
Magic Block CLI Tool

Usage:
  node scripts/magic.js compress <input.md>
    Compress a markdown file and output base64 string

  node scripts/magic.js decompress <base64>
    Decompress a base64 string

  node scripts/magic.js pack <input.md> <output.md>
    Create a magic block file from input

Examples:
  # Compress a preset
  node scripts/magic.js compress presets/particles.md

  # Decompress for testing
  node scripts/magic.js decompress eJx9ksFKw0AQhu95ijVeWmlqKQhaRCg...

  # Create a magic block file
  node scripts/magic.js pack presets/particles.md particles-magic.md
`);
  }
};

// Main CLI handler
const [,, command, ...args] = process.argv;

if (!command || command === 'help' || command === '--help' || command === '-h') {
  commands.help();
  process.exit(0);
}

if (commands[command]) {
  try {
    commands[command](...args);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
} else {
  console.error(`Unknown command: ${command}`);
  commands.help();
  process.exit(1);
}
