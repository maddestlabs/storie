# Frontmatter Quick Reference

## Basic Usage

### 1. Define Frontmatter
Add YAML frontmatter at the top of your markdown file:

```markdown
---
title: "My Demo"
version: 1.0
debugMode: true
colors: red, green, blue
---

# Your Content Here
```

### 2. Access in JavaScript
All frontmatter variables are automatically available as globals:

```javascript on:init
console.log(title);      // "My Demo"
console.log(version);    // 1.0
console.log(debugMode);  // true
console.log(colors);     // ["red", "green", "blue"]
```

## Supported Types

| YAML | JavaScript | Example |
|------|-----------|---------|
| `key: "text"` | String | `"text"` |
| `key: 123` | Number | `123` |
| `key: 1.5` | Number | `1.5` |
| `key: true` | Boolean | `true` |
| `key: false` | Boolean | `false` |
| `key: a, b, c` | Array | `["a", "b", "c"]` |
| `key: [1,2,3]` | Array | `[1, 2, 3]` |
| `key: null` | null | `null` |

## Real Examples

### Game Configuration
```yaml
---
title: "Space Shooter"
lives: 3
difficulty: "hard"
powerUps: shield, laser, bomb
maxScore: 999999
---
```

### Theme Settings
```yaml
---
theme: "dark"
fontSize: 16
fontFamily: "monospace"
showFPS: true
---
```

### Character Settings (stonegarden.md)
```yaml
---
chars: "岩僧石座固僧・苔霧松竹梅"
doubleWidth: true
wallChar: "岩"
---
```

## Test Demos

Access these URLs in the preview:

1. **Frontmatter Test**: `http://localhost:4173/?content=demo:frontmatter-test`
   - Shows all variable types
   - Interactive demo with live values

2. **Stonegarden**: `http://localhost:4173/?content=demo:stonegarden`
   - Real-world usage example
   - Uses chars, doubleWidth, theme frontmatter

## Tips

✅ **Do:**
- Use descriptive variable names
- Prefer comma-separated arrays for simple lists
- Use booleans for flags
- Keep frontmatter concise

❌ **Don't:**
- Use reserved JavaScript keywords (e.g., `var`, `function`, `class`)
- Put complex logic in frontmatter (use code blocks instead)
- Forget to check if optional variables exist

## Advanced Features

### Mixed-Type Arrays
```yaml
values: 1, true, "text", 3.14
```
```javascript
console.log(values); // [1, true, "text", 3.14]
```

### Hyphenated Keys
```yaml
font-family: "Arial"
max-width: 800
```
```javascript
console.log(scope['font-family']); // Use bracket notation
// Or define without hyphens:
// fontFamily: "Arial"
```

### Null/Empty Values
```yaml
optional: null
empty:
```
```javascript
console.log(optional); // null
console.log(empty);    // null
```
