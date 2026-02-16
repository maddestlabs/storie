---
name: "Frontmatter Variables Demo"
theme: "solarlight"
playerName: "Hero"
startingHealth: 100
maxLevel: 10
debugMode: true
colors: red, green, blue, yellow
---

# Frontmatter Variables

This demo shows how frontmatter variables work with Storie's variable persistence system.

**Frontmatter variables:**
- Are automatically added to the persistent scope
- Can be accessed directly in all code blocks
- Can be modified just like regular variables
- Persist across code blocks when modified

## Code

```js
// Additional persistent variables (work alongside frontmatter)
let currentHealth = startingHealth;  // Uses frontmatter value
let level = 1;
let experience = 0;
let colorIndex = 0;
```

```js on:init
term.clear();
console.log("✓ Game initialized");
console.log(`  Player: ${playerName}`);
console.log(`  Starting health: ${startingHealth}`);
console.log(`  Max level: ${maxLevel}`);
console.log(`  Debug mode: ${debugMode}`);
console.log(`  Colors available: ${colors}`);
```

```js on:update
// Frontmatter variables are directly accessible
if (key.pressed('ArrowUp') && level < maxLevel) {
  level++;
  experience = 0;
  console.log(`Level up! Now level ${level}`);
}

if (key.pressed('ArrowDown') && level > 1) {
  level--;
  console.log(`Level down! Now level ${level}`);
}

// Gain experience
experience += 1;
if (experience >= 100) {
  experience = 0;
  if (level < maxLevel) {
    level++;
  }
}

// Cycle colors
if (key.pressed(' ')) {
  colorIndex = (colorIndex + 1) % colors.length;
}

// Health changes (demonstrate modifying frontmatter-derived var)
if (key.pressed('h')) {
  currentHealth = Math.min(startingHealth, currentHealth + 10);
}
if (key.pressed('d')) {
  currentHealth = Math.max(0, currentHealth - 10);
}
```

```js on:render
term.clear();

// Display frontmatter variables
term.write(2, 2, `=== ${name} ===`);
term.write(2, 4, `Player: ${playerName}`);
term.write(2, 5, `Health: ${currentHealth} / ${startingHealth}`);
term.write(2, 6, `Level: ${level} / ${maxLevel}`);
term.write(2, 7, `Experience: ${experience} / 100`);

// Show current color
const currentColor = colors[colorIndex];
term.write(2, 9, `Current color: ${currentColor}`);

// Debug info (using frontmatter boolean)
if (debugMode) {
  term.write(2, 11, `[DEBUG MODE ENABLED]`);
  term.write(2, 12, `Available colors: ${colors.join(', ')}`);
}

// Instructions
const y = termHeight - 6;
term.write(2, y, "Controls:");
term.write(2, y + 1, "  ↑/↓ : Change level");
term.write(2, y + 2, "  H   : Heal (+10 HP)");
term.write(2, y + 3, "  D   : Damage (-10 HP)");
term.write(2, y + 4, "  SPACE: Cycle color");
```

## How It Works

### 1. Frontmatter Variables
Declared in the YAML frontmatter at the top:
```yaml
---
playerName: "Hero"
startingHealth: 100
maxLevel: 10
debugMode: true
colors: red, green, blue, yellow
---
```

### 2. Automatic Persistence
- Frontmatter variables are **automatically added to scope**
- They work exactly like variables declared in raw `js` blocks
- Can be accessed directly: `playerName`, `startingHealth`, etc.
- Can be modified in lifecycle blocks and changes persist

### 3. Combined with Code Variables
```js
// Can reference frontmatter values
let currentHealth = startingHealth;  // Uses frontmatter!

// Mix frontmatter and code variables naturally
if (currentHealth > startingHealth / 2) {
  console.log(`${playerName} is healthy!`);
}
```

### 4. Benefits
- ✅ Configuration at the document level
- ✅ No need to duplicate values in code
- ✅ Easy to modify without touching code
- ✅ Type conversion automatic (numbers, booleans, arrays)
- ✅ Works with AI code generation (values visible in frontmatter)
