# URL Parameter Implementation Summary

## Overview

Added comprehensive URL parameter support to S|torie, enabling dynamic content loading from multiple sources.

## Implementation Date
2024-02-08

## Files Modified

### `/site/index.html`
- Added `parseContentSource()` - Main URL parameter parser
- Added `loadGist(gistId)` - GitHub Gist API integration
- Added `decompressContent(compressed)` - Base64/gzip decompression
- Modified `main()` - Priority: URL params → index.md → embedded

**Line count:** ~150 lines of new code

## Features Implemented

### ✅ GitHub Gist Loading
**Syntax:** `?content=gist:ID`

- Fetches from `https://api.github.com/gists/{id}`
- Finds first `.md` file in gist
- Supports full URLs: `?content=https://gist.github.com/user/id`
- Supports bare gist IDs: `?content=abc123def456...`

**Pattern matching:**
- `gist:ID` prefix
- Full gist URLs via regex: `/gist\.github\.com\/(?:[^\/]+\/)?([a-f0-9]+)/`
- 32-character hex IDs: `/^[a-f0-9]{32}$/i`

### ✅ Demo File Loading
**Syntax:** `?content=demo:name`

- Loads from local server: `demo-{name}.md`
- Auto-adds `.md` extension if not present
- Works without prefix: `?content=hooks` → `demo-hooks.md`

**Available demos:**
- `demo-simple.md` - Basic interactive text movement
- `demo-hooks.md` - Lifecycle hooks example
- `demo-frontmatter.md` - Frontmatter variables

### ✅ LocalStorage Loading
**Syntax:** `?content=browser:key` or `?content=local:key`

- Checks `storie_{key}` prefix first
- Falls back to raw key name
- Useful for saving work-in-progress

**Example:**
```javascript
localStorage.setItem('storie_test', '# Test Story...');
// Load with: ?content=browser:test
```

### ✅ Compressed Content
**Syntax:** `?content=decode:BASE64`

- Decodes base64 string
- Decompresses using `DecompressionStream` (gzip)
- Useful for embedding content in URLs

### ✅ Content Priority
1. **URL parameter** - Highest priority
2. **index.md** - Default file
3. **Embedded demo** - Fallback

### ✅ Error Handling
- Console logging for all operations
- Graceful fallback on errors
- Clear error messages for debugging

## Supporting Files Created

### `/site/demo-simple.md`
Simple interactive demo for testing URL parameters:
- Moving text with arrow keys
- Basic lifecycle hooks
- ~20 lines

### `/docs/test-url-params.html`
Test page with links to all parameter types:
- Demo links
- Gist examples
- LocalStorage test
- Instructions for creating gists
- ~150 lines

### `/docs/URL_PARAMETERS.md`
Comprehensive documentation (~250 lines):
- All syntax examples
- Use cases
- Security notes
- API reference
- Step-by-step gist creation guide

### `/docs/GIST_EXAMPLE.md`
Copy-paste example for creating gists:
- Complete working example
- Bouncing text with border
- Instructions for sharing
- ~100 lines

### `/docs/README.md`
Updated to mention URL parameter feature with quick reference

## Testing

Server running at: `http://localhost:4173/`

**Test URLs:**
- `http://localhost:4173/?content=demo:simple` ✅
- `http://localhost:4173/?content=demo:hooks` ✅
- `http://localhost:4173/test-url-params.html` ✅

**Console output verification:**
```
Content parameter detected: demo:simple
Loading demo: simple
Loaded demo (503 chars)
✓ Loaded from demo
✓ Demo loaded from demo
✓ Engine started
```

## API Integration

### GitHub Gist API
**Endpoint:** `https://api.github.com/gists/{id}`

**Response structure:**
```json
{
  "files": {
    "filename.md": {
      "filename": "filename.md",
      "content": "# Markdown content..."
    }
  }
}
```

**Rate limits:** 60 requests/hour (unauthenticated)

## Security Considerations

All loaded content runs in SES Compartment:
- ✅ Strict mode only
- ✅ No `eval` or `Function`
- ✅ Isolated scope
- ✅ Controlled APIs (`term`, `input`, `scope`)

**Safe to load from:**
- ✅ Public gists (read-only)
- ✅ LocalStorage (user's own data)
- ✅ Demo files (server-controlled)

## Browser Compatibility

- ✅ URLSearchParams - All modern browsers
- ✅ Fetch API - All modern browsers
- ✅ DecompressionStream - Chrome 80+, Firefox 109+, Safari 16.4+

**Fallback:** If DecompressionStream not available, `decode:` will fail gracefully

## Future Enhancements

Potential additions:
- [ ] URL shortener integration
- [ ] Gist authentication for private gists
- [ ] Content caching
- [ ] Save to gist from editor
- [ ] Share button with auto-generated URLs
- [ ] QR code generation for URLs

## Code Statistics

**Total lines added:** ~600 lines
- site/index.html: ~150 lines
- Documentation: ~450 lines

**Functions added:**
- `parseContentSource()` - 90 lines
- `loadGist()` - 20 lines  
- `decompressContent()` - 15 lines

## Commit-Ready

All changes are in:
- `site/index.html` - Modified
- `site/demo-simple.md` - New
- `docs/` - Built from site/
- Documentation files - New

**Ready for:** `git add site/ docs/` and commit.
