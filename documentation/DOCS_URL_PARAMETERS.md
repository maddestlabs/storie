# URL Parameter Loading

S|torie supports loading content from various sources via URL parameters, making it easy to share stories, demos, and games.

## Basic Syntax

Add a `?content=` parameter to the URL:

```
https://yoursite.com/?content=SOURCE
```

## Host Sync (Host/Client)

Storie can optionally sync *navigation state* (e.g. the current Canvas3D section) across two windows:

- **Host** window: you control navigation
- **Client** window: follows along (audience / player)

This is implemented at the engine level using `BroadcastChannel` (same-origin, same browser/profile). It does **not** expose raw network primitives to sandboxed scripts.

### Parameters

Preferred (short) form:

- `role=host|client` (presence implies host sync is enabled)
- `channel=<id>` shared channel identifier
- `token=<secret>` shared secret token (required)
- `transport=broadcast` (optional; default). `websocket` reserved for future.

Compatibility (long) form (still accepted):

- `host=1` (or `host=true`) enables host sync
- `hostRole=host|client`
- `hostTransport=broadcast`
- `hostChannel=<id>`
- `hostToken=<secret>`

Backwards compatibility: older `present*` parameters are also still accepted for now.

### Quick start (two windows)

1. Open a host window:

        - `?role=host`

        If `channel`/`token` are not provided, Storie generates them and logs a **Client join URL** to the browser console.

2. Open the client window using that join URL, then move it to the projector/second monitor.

### Notes

- Keep the client URL private: anyone with the `channel` + `token` can inject navigation events.
- This currently syncs *section navigation* (focused section) and intentionally does not provide a general-purpose messaging channel.
- When `role=client`, Storie treats the window as an *audience/presentation view* by default: it suppresses keyboard/mouse navigation input and hides the terminal layer once the Canvas3D (3D) layer is active (to keep projector windows clean).

### Script access

User scripts can detect which window they’re running in:

```js
if (host.isHost) {
        term.write(0, 0, 'Host controls here');
}
```

Available fields: `host.enabled`, `host.role`, `host.isHost`, `host.isClient`, `host.transport`, `host.channel`.

Shared scene state (synced host -> client):

```js
// Host-only: advance staged reveals
if (host.isHost && key.pressed(']')) scene.nextRevealStep();

// Client: react to reveal step
if (scene.revealStep >= 1) {
        // show extra info / remove fog / reveal clue
}
```

Available fields: `scene.sectionIndex`, `scene.revealStep`, plus host-only mutators `scene.setRevealStep(n)`, `scene.nextRevealStep()`, `scene.resetRevealStep()`.

## Supported Sources

### 1. GitHub Gists 🌐

Load markdown content from a public GitHub gist:

```
?content=gist:abc123def456789...
```

**Examples:**
- `?content=gist:a1b2c3d4e5f6...` - Using gist ID
- `?content=https://gist.github.com/username/a1b2c3d4e5f6...` - Full gist URL
- `?content=a1b2c3d4e5f6...` - Just the 32-character gist ID

**Requirements:**
- Gist must be public
- Must contain at least one `.md` file
- The first `.md` file found will be loaded

**Creating a Gist:**
1. Go to [gist.github.com](https://gist.github.com/)
2. Create a file with `.md` extension (e.g., `story.md`)
3. Add your S|torie content with lifecycle hooks
4. Click "Create public gist"
5. Copy the gist ID from the URL
6. Share: `?content=gist:YOUR_ID`

### 2. Demo Files 📄

Load pre-made demos from the server:

```
?content=demo:NAME
```

**Examples:**
- `?content=demo:simple` - Loads `demo-simple.md`
- `?content=demo:hooks` - Loads `demo-hooks.md`
- `?content=hooks` - Same as above (demo: prefix optional)

The `.md` extension is automatically added if not present.

### 3. LocalStorage 💾

Load content from browser's localStorage:

```
?content=browser:KEY
?content=local:KEY
```

**Examples:**
- `?content=browser:mystory` - Loads from localStorage key `storie_mystory`
- `?content=local:test` - Also checks raw key `test` as fallback

**Saving to localStorage:**
```javascript
// In browser console
localStorage.setItem('storie_mystory', '# My Story\n\n```javascript on:render\nterm.text(5, 5, "Hello!", "#00ff00");\n```');
```

Then load with: `?content=browser:mystory`

### 4. Compressed Content 📦

Load base64-encoded and gzip-compressed content:

```
?content=decode:BASE64_ENCODED_GZIPPED_CONTENT
```

This is useful for embedding large documents in URLs (though URL length limits apply).

**Creating compressed content:**
```javascript
// Example encoding (requires compression library)
const text = '# My Story...';
const compressed = gzip(text);
const encoded = btoa(compressed);
const url = `?content=decode:${encoded}`;
```

## Priority Order

When loading content, S|torie checks sources in this order:

1. **URL parameter** (`?content=...`)
2. **index.md** file (if no URL parameter)
3. **Embedded demo** (fallback if nothing else loads)

## Use Cases

### Sharing Stories
Create a gist and share the link:
```
https://yoursite.com/?content=gist:abc123...
```

### Testing Demos
Quickly switch between demos during development:
```
http://localhost:4173/?content=demo:test1
http://localhost:4173/?content=demo:test2
```

### Embedded Content
Embed stories in other pages with iframes:
```html
<iframe src="https://yoursite.com/?content=gist:abc123..." 
        width="800" height="600"></iframe>
```

### Local Development
Save work-in-progress to localStorage:
```javascript
// Save current work
localStorage.setItem('storie_wip', editor.getValue());

// Resume later
window.location = '?content=browser:wip';
```

## Error Handling

If content fails to load from the URL parameter:
- An error is logged to the console
- S|torie falls back to loading `index.md`
- If that fails, the embedded demo is used

Check the browser console for detailed error messages:
- `✓ Loaded from gist` - Success!
- `✗ Error loading from URL parameter:` - Check the error details

## Examples

### Minimal Gist Content
```markdown
# Hello S|torie

```javascript on:render
term.clear();
term.text(5, 5, "Hello from a gist!", "#00ff00");
```

### Complex Demo with State
```markdown
# Interactive Demo

```javascript on:init
scope.x = 10;
scope.y = 10;
scope.message = "Use arrow keys!";
```

```javascript on:update
if (input.isKeyPressed('ArrowUp')) scope.y--;
if (input.isKeyPressed('ArrowDown')) scope.y++;
if (input.isKeyPressed('ArrowLeft')) scope.x--;
if (input.isKeyPressed('ArrowRight')) scope.x++;
```

```javascript on:render
term.clear();
term.text(scope.x, scope.y, scope.message, "#00ff00");
```

## API Reference

The URL parameter parser is implemented in `site/index.html` and includes:

- `parseContentSource()` - Main parser function
- `loadGist(gistId)` - Fetches from GitHub API
- `decompressContent(compressed)` - Decompresses base64-gzipped content

See [index.html](index.html) for implementation details.

## Security Note

Content loaded from external sources (gists, localStorage) runs in the same SES sandbox as embedded content, providing security through:

- **Strict mode** JavaScript only
- **No access** to `eval`, `Function` constructor, or other unsafe features
- **Isolated scope** - User code cannot access engine internals
- **Controlled APIs** - Only `term`, `termCanvas`, `input`, and `scope` are exposed

However, always be cautious when loading content from untrusted sources!
