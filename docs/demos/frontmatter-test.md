---
title: "Frontmatter Test Demo"
author: "Maddest Labs"
version: 1.5
maxScore: 100
debugMode: true
colors: red, green, blue
tags: test, demo, frontmatter
customMessage: "Hello from frontmatter!"
---

# Frontmatter Variable Access Demo

This demo shows how frontmatter variables are automatically exposed as globals in JavaScript code blocks.

```javascript on:init
// All frontmatter variables are now available as globals!
console.log('📋 Frontmatter Variables:');
console.log('  title:', title);
console.log('  author:', author);
console.log('  version:', version, '(type:', typeof version, ')');
console.log('  maxScore:', maxScore, '(type:', typeof maxScore, ')');
console.log('  debugMode:', debugMode, '(type:', typeof debugMode, ')');
console.log('  colors:', colors);
console.log('  tags:', tags);
console.log('  customMessage:', customMessage);

// Initialize game state using frontmatter values
let score = 0;
let frame = 0;
let flashColor = 0;
```

```javascript on:update
// Use frontmatter values in game logic
frame++;

// Cycle through colors array
if (colors && Array.isArray(colors)) {
  flashColor = Math.floor(frame / 30) % colors.length;
}

// Cap score at maxScore from frontmatter
if (score > maxScore) {
  score = maxScore;
}
```

```javascript on:render
term.clear();

// Draw title from frontmatter
const centerX = Math.floor(termCanvas.width() / 2);
const titleX = Math.floor(centerX - (title.length / 2));
term.write(titleX, 2, title, { r: 100, g: 200, b: 255 });

// Draw author
const authorText = `by ${author}`;
const authorX = Math.floor(centerX - (authorText.length / 2));
term.write(authorX, 3, authorText, { r: 150, g: 150, b: 150 });

// Draw version
term.write(2, 5, `Version: ${version}`, { r: 200, g: 200, b: 200 });

// Draw custom message
term.write(2, 7, customMessage, { r: 255, g: 220, b: 100 });

// Draw debug info if enabled in frontmatter
if (debugMode) {
  term.write(2, 9, '🐛 DEBUG MODE ENABLED', { r: 255, g: 100, b: 100 });
  term.write(2, 10, `Frame: ${frame}`, { r: 150, g: 150, b: 150 });
}

// Draw colors array
if (colors && Array.isArray(colors)) {
  term.write(2, 12, 'Colors from frontmatter:', { r: 200, g: 200, b: 200 });
  
  for (let i = 0; i < colors.length; i++) {
    const isActive = i === flashColor;
    const color = isActive ? { r: 255, g: 255, b: 0 } : { r: 100, g: 100, b: 100 };
    const prefix = isActive ? '➤ ' : '  ';
    term.write(4, 13 + i, `${prefix}${colors[i]}`, color);
  }
}

// Draw tags
if (tags && Array.isArray(tags)) {
  const tagsText = `Tags: ${tags.join(', ')}`;
  term.write(2, 18, tagsText, { r: 150, g: 200, b: 150 });
}

// Draw score with max from frontmatter
term.write(2, 20, `Score: ${score} / ${maxScore}`, { r: 200, g: 255, b: 200 });

// Instructions
term.write(2, termCanvas.height() - 2, 'Press SPACE to increase score', { r: 100, g: 150, b: 255 });
```

```javascript on:input
if (event.type === 'key' && event.action === 'press') {
  if (event.keyCode === key.SPACE) {
    score += 10;
  }
}
```

## How It Works

The frontmatter variables defined at the top of this file are automatically:

1. **Parsed** - The markdown parser extracts YAML frontmatter and type-detects values:
   - Strings: `title`, `author`, `customMessage`
   - Numbers: `version`, `maxScore`
   - Booleans: `debugMode`
   - Arrays: `colors`, `tags` (comma-separated)

2. **Exposed as Globals** - Each variable is injected into the SES compartment as a global, so you can access them directly:
   ```javascript
   console.log(title);      // "Frontmatter Test Demo"
   console.log(version);    // 1.5 (number)
   console.log(debugMode);  // true (boolean)
   console.log(colors);     // ["red", "green", "blue"] (array)
   ```

3. **Available in All Code Blocks** - All lifecycle hooks (`init`, `update`, `render`, `input`) have access to these variables.

This matches the behavior of the original tstorie implementation where frontmatter variables were exposed via `exposeFrontMatterVariables()`.
