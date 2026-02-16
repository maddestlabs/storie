# Magic Blocks Implementation

## Overview

Magic blocks are a feature that allows you to embed compressed, parameterized markdown snippets in your documents. They are decompressed at parse time, BEFORE normal markdown processing, so they can expand into any markdown content including code blocks, headings, and text.

## How It Works

### Compression Format

- **Compression**: zlib DEFLATE (RFC 1950) - includes 2-byte header and 4-byte checksum
- **Encoding**: Base64
- **Browser API**: `CompressionStream('deflate')` / `DecompressionStream('deflate')`
- **Node.js**: `deflateSync()` / `inflateSync()` from `zlib` module

### Processing Pipeline

```
Original Markdown
    ↓
1. Expand Magic Blocks (decompress & substitute params)
    ↓
Expanded Markdown
    ↓
2. Extract Sections (headings)
    ↓
3. Extract Code Blocks (```js on:init, etc.)
    ↓
4. Extract Frontmatter (---)
    ↓
Parsed Document (sections, code blocks, metadata)
```

### Syntax

#### Basic Magic Block
```markdown
\`\`\`magic
eNqLjk5OTgYABBwBpQ==
\`\`\`
```

#### With Parameters
```markdown
\`\`\`magic name="fireflies" count="30" speed="2.5"
eNqLjk5OTgYABBwBpQ==
\`\`\`
```

### Parameter Substitution

Magic blocks support parameter placeholders with multiple syntax options:

- `{{param}}` - Mustache/Handlebars style (default, recommended)
- `@param@` - Simple markers
- `$param$` - Dollar signs
- `<!--param-->` - HTML comments (safest for code)

#### Parameter Declaration (Optional Safety Feature)

Declare parameters explicitly for safety:

```markdown
<!-- MAGIC_PARAMS: name, count, speed -->

\`\`\`js on:init
var particleSystem = createParticles("{{name}}", {{count}}, {{speed}});
\`\`\`
```

When `MAGIC_PARAMS` is declared, only those parameters will be substituted. This prevents accidental replacement of code that happens to match the placeholder pattern.

## Browser Implementation

### Files Created

1. **`src/magic.ts`** - Core magic block processing
   - `decompressString()` - Decompress base64 zlib data
   - `compressString()` - Compress and encode strings
   - `parseMagicParams()` - Parse parameter key-value pairs
   - `extractDeclaredParams()` - Find declared parameters
   - `substituteMagicParams()` - Replace placeholders with values
   - `expandMagicBlocks()` - Main entry point

2. **`scripts/magic.js`** - CLI tool for developers
   - `compress <file>` - Compress markdown file
   - `decompress <base64>` - Decompress base64 string
   - `pack <input> <output>` - Create magic block file

### Integration Points

**Modified Files:**

1. **`src/markdown.ts`**
   - Made `parseMarkdown()` async to support magic blocks
   - Added magic block expansion as first step

2. **`src/engine.ts`**
   - Updated to await `parseMarkdown()`

## Usage

### Creating Magic Blocks

#### Using CLI Tool

```bash
# Compress a preset
node scripts/magic.js compress preset.md

# Decompress for inspection
node scripts/magic.js decompress eJx9ks...

# Create a magic block file
node scripts/magic.js pack preset.md magic-block.md
```

#### Creating Parameterized Presets

1. **Create your preset** (`particle-preset.md`):

```markdown
<!-- MAGIC_PARAMS: name, count, speed -->

# {{name}} Particle System

\`\`\`js on:init
var particles_{{name}} = [];
for (let i = 0; i < {{count}}; i++) {
  particles_{{name}}.push({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * {{speed}},
    vy: (Math.random() - 0.5) * {{speed}}
  });
}
\`\`\`

\`\`\`js on:update
particles_{{name}}.forEach(p => {
  p.x += p.vx * delta;
  p.y += p.vy * delta;
  if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
  if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
});
\`\`\`

\`\`\`js on:render
ctx.fillStyle = '#00ff00';
particles_{{name}}.forEach(p => {
  ctx.fillRect(p.x, p.y, 2, 2);
});
\`\`\`
```

2. **Compress it:**

```bash
node scripts/magic.js compress particle-preset.md
```

3. **Use in your document:**

```markdown
---
title: "Particle Demo"
---

# Fireflies

\`\`\`magic name="fireflies" count="50" speed="2.0"
eJx9ksFKw0AQhu95ijVeWmlqKQhaRCgqVVAoSWuPZk2m...
\`\`\`

# Stars

\`\`\`magic name="stars" count="150" speed="5.0"
eJx9ksFKw0AQhu95ijVeWmlqKQhaRCgqVVAoSWuPZk2m...
\`\`\`
```

Each magic block expands with different parameters, creating multiple particle systems from a single preset!

### Best Practices

#### Parameter Syntax
- **Use `{{param}}`** for most cases - clear and Mustache-compatible
- **Declare parameters** with `<!-- MAGIC_PARAMS: ... -->` for safety
- **Keep names simple** - alphanumeric only, no spaces

#### Compression Tips
- Magic blocks work best for **reusable patterns**
- **Typical compression ratio**: 70-90% of original size
- **Overhead**: Base64 encoding adds ~33% to raw compressed size
- **Sweet spot**: 200-1000 bytes of original content

#### Security
- Parameters are **string-substituted** - no code execution
- Declared parameters provide **whitelist protection**
- Decompressed content is **parsed as normal markdown** with same security model

## Performance

### Compression/Decompression
- **Browser**: Native `CompressionStream`/`DecompressionStream` - hardware accelerated
- **Node.js**: Native `zlib` module - also hardware accelerated
- **Overhead**: Minimal - typically <1ms per block on modern hardware

### Parse Time Impact
- Magic blocks are expanded **once** at document load
- No runtime overhead after expansion
- Async processing doesn't block UI

## Examples

See the following files:
- **`docs/demos/magic-demo.md`** - Full demo with multiple examples
- **`test-magic.html`** - Browser test page
- **`src/magic.nim`** - Original Nim implementation (reference)

## Future Enhancements

Potential improvements:
- **Validation**: Verify required parameters before expansion
- **Default values**: `{{param:default}}`  syntax
- **Nested blocks**: Magic blocks within magic blocks
- **Compression levels**: Trade size for speed
- **Block library**: Shared presets via CDN or package manager
- **IDE support**: Syntax highlighting for magic blocks

## Technical Notes

### Why zlib format?

The original `magic.nim` comments suggested raw DEFLATE, but the actual implementation uses zlib format (DEFLATE + header/checksum). We matched the actual behavior rather than the comments.

**Formats:**
- **Raw DEFLATE** (dfDeflate): RFC 1951 - pure compression
- **zlib** (dfZlib): RFC 1950 - DEFLATE + 2-byte header + 4-byte Adler-32 checksum
- **gzip**: RFC 1952 - DEFLATE + extensive headers + CRC32

Browser API mapping:
- `'deflate-raw'` → Raw DEFLATE
- `'deflate'` → zlib format ← **We use this**
- `'gzip'` → gzip format

### Async Requirement

Magic blocks require async processing because browser compression APIs are stream-based. This had a cascading effect:
- `expandMagicBlocks()` → async
- `parseMarkdown()` → async
- `loadMarkdown()` → already async (no change needed)

This is acceptable because document loading is already async.

## Compatibility

- **Browsers**: Modern browsers with `CompressionStream` support (Chrome 80+, Firefox 113+, Safari 16.4+)
- **Node.js**: Any version with `zlib` module (all modern versions)
- **TypeScript**: ES2020+ target for `replaceAll()` and async iterables

## Testing

Run the test suite:

```bash
# Build the project
npm run build

# Start dev server
python3 -m http.server 8080

# Open test page
open http://localhost:8080/test-magic.html
```

Check browser console for:
```
=== Loading markdown with magic blocks ===
[Magic] Expanded block with params: {myValue: "42"}
[Magic] Expanded block with params: {myValue: "999"}
✓ Markdown loaded successfully!
```

You should see text rendered on the canvas showing the substituted values!
