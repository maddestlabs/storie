# Example Gist Content

Copy this entire file into a GitHub gist to test URL parameter loading!

## Simple Moving Text

```javascript on:init
scope.x = 20;
scope.y = 10;
scope.dx = 1;
scope.dy = 1;
scope.message = "Hello from Gist!";
```

```javascript on:update
// Bounce the text around the screen
scope.x += scope.dx;
scope.y += scope.dy;

if (scope.x <= 0 || scope.x >= term.width - scope.message.length) {
  scope.dx = -scope.dx;
}

if (scope.y <= 0 || scope.y >= term.height - 1) {
  scope.dy = -scope.dy;
}
```

```javascript on:render
term.clear();

// Draw border
for (let x = 0; x < term.width; x++) {
  term.text(x, 0, "─", "#00ff88");
  term.text(x, term.height - 1, "─", "#00ff88");
}
for (let y = 0; y < term.height; y++) {
  term.text(0, y, "│", "#00ff88");
  term.text(term.width - 1, y, "│", "#00ff88");
}

// Draw corners
term.text(0, 0, "┌", "#00ff88");
term.text(term.width - 1, 0, "┐", "#00ff88");
term.text(0, term.height - 1, "└", "#00ff88");
term.text(term.width - 1, term.height - 1, "┘", "#00ff88");

// Draw the bouncing message
term.text(Math.floor(scope.x), Math.floor(scope.y), scope.message, "#ffff00");

// Instructions
term.text(2, term.height - 2, "Loaded from GitHub Gist!", "#ff00ff");
```

---

## How to Use This

1. Go to https://gist.github.com/
2. Create a new gist
3. Name the file `bouncing-text.md` (must end in .md)
4. Paste this content
5. Click "Create public gist"
6. Copy the gist ID from the URL
7. Load it: `https://yoursite.com/?content=gist:YOUR_ID`

## More Examples

You can create multiple files in a gist, but only the first `.md` file will be loaded.

### Interactive Example

Try adding keyboard controls:

```javascript on:update
// Manual controls
if (input.isKeyPressed('ArrowUp')) scope.y--;
if (input.isKeyPressed('ArrowDown')) scope.y++;
if (input.isKeyPressed('ArrowLeft')) scope.x--;
if (input.isKeyPressed('ArrowRight')) scope.x++;

// Prevent going out of bounds
scope.x = Math.max(1, Math.min(term.width - scope.message.length - 1, scope.x));
scope.y = Math.max(1, Math.min(term.height - 2, scope.y));
```

### Sharing Your Creation

Once you create a gist, you can share it as:
- Direct link: `?content=gist:abc123def456...`
- Full URL: `?content=https://gist.github.com/username/abc123def456...`
- Just the ID: `?content=abc123def456...` (if it's 32 hex characters)

Enjoy creating with S|torie! 🚀
