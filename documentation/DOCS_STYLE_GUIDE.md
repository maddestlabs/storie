# Storie Code Style Guide

> **For AI Assistants & Developers**: This guide shows the idiomatic way to write Storie code.

## Variable Persistence Options

Storie provides **three ways** to create persistent variables:

1. **Frontmatter variables** (YAML configuration)
2. **Raw `js` blocks** (code-level initialization)
3. **Direct scope assignment** (for dynamic/rare cases)

---

## Frontmatter Variables (Recommended for Configuration)

### ✅ Best for Document-Level Config

Declare variables in YAML frontmatter - they're automatically persistent and globally accessible:

```markdown
---
name: "My Game"
playerName: "Hero"
startingHealth: 100
maxLevel: 10
debugMode: true
colors: red, green, blue
---
```

**Access directly in any code block:**

```js on:init
console.log(`Welcome, ${playerName}!`);
console.log(`Starting with ${startingHealth} HP`);
```

```js on:update
// Use frontmatter values with code variables
let currentHealth = currentHealth || startingHealth;

if (currentHealth < startingHealth / 2) {
  console.log(`${playerName} is hurt!`);
}
```

**Benefits:**
- ✅ Configuration separate from code logic
- ✅ Easy to modify without touching code
- ✅ Type conversion automatic (numbers, booleans, arrays)
- ✅ Visible to AI assistants (aids code generation)
- ✅ Works great with template documents

**Use cases:**
- Game configuration (health, damage, speed)
- Theme/style settings
- Player/character names
- Feature flags (debugMode, enableSound)
- Level data, enemy types, item lists

---

## Persistent Variables: The Two-Block Pattern

For **runtime state** (not configuration), use the two-block pattern:

### ✅ Preferred Style (Clean & Readable)

**1. Initialize in raw `js` blocks (no lifecycle annotation)**

```js
// Variables declared here persist automatically
let score = 0;
let playerX = 10;
let playerY = 5;
let enemies = [];
```

**2. Use in lifecycle blocks (local variables work normally)**

```js on:update
// Access persistent variables - they're automatically imported
if (key.pressed('ArrowRight')) {
  playerX++;
}

// Local variables work normally - they DON'T persist
const delta = getDelta();
const velocity = calculateVelocity(delta);
score += delta * 10;

// Changes to persistent vars are automatically saved
```

```js on:render
// Still have access to persistent state
term.write(playerX, playerY, '🚀');
term.write(0, 0, `Score: ${Math.floor(score)}`);

// Local variables for rendering calculations
const color = score > 100 ? 'gold' : 'white';
const x = Math.floor(playerX);
```

### ❌ Avoid This Pattern (Unnecessary Boilerplate)

```js
// DON'T DO THIS - too verbose and harder to read
scope.state = scope.state || {
  score: 0,
  playerX: 10,
  playerY: 5,
  enemies: []
};
```

```js on:update
// DON'T DO THIS - clutters the code
scope.state.score += delta * 10;
if (key.pressed('ArrowRight')) {
  scope.state.playerX++;
}
```

## How It Works

### Initialization Blocks (Raw `js`)

Top-level declarations in raw `js` blocks are transformed to scope assignments:

```js
let clickCount = 0;  // Becomes: scope.clickCount = scope.clickCount ?? 0;
```

### Lifecycle Blocks (`on:init`, `on:update`, `on:render`, `on:input`)

The engine automatically wraps these with import/export:

```js
// You write:
```js on:update
clickCount++;
const dx = 5; // Local variable
```

// Engine wraps it as:
function update(delta) {
  let {clickCount} = scope;  // Auto-imported
  
  clickCount++;
  const dx = 5;  // Stays local
  
  scope.clickCount = clickCount;  // Auto-exported
}
```

**Result:** Persistent vars are accessible, local vars stay local, no boilerplate!

#### Optional Fence Metadata: `section:` (Worlds)

When using the Worlds module, you can scope a lifecycle block to a specific section:

```js on:render section:3
// Only runs while Worlds is focused on section index 3
term.write(0, 0, 'Section 3 active');
```

You can also use `section:current` to target the section that the code block is located under:

```js on:update section:current
// Runs only when the current Worlds section is this section
crewMorale = (crewMorale ?? 0) - 0.01;
```

You can also target by section title (matched by a slugified form of the heading text):

```js on:render section:Awake
term.write(0, 0, 'Awake');
```

For multi-word headings, use the slug form (e.g. `section:city-entrance`).

## Block Types

### Raw `js` Blocks (Initialization)

Use for persistent state declaration:

```js
let health = 100;
let inventory = [];
let playerName = "Hero";

function saveGame() {
  // Functions also persist
  console.log("Saving...");
}
```

### `on:init` Block (Setup)

Runs once at start. Use for one-time initialization:

```js on:init
term.clear();
console.log(`Welcome, ${playerName}!`);

// Local variables here don't persist
const welcomeMsg = `HP: ${health}`;
```

### `on:update` Block (Game Logic)

Runs every frame. Use for game logic:

```js on:update
// Persistent: playerX, score
// Local: velocity, newX
const velocity = key.pressed('Shift') ? 2 : 1;
const newX = playerX + velocity;
if (newX < termWidth) {
  playerX = newX;
  score++;
}
```

### `on:render` Block (Drawing)

Runs every frame after update. Use for rendering:

```js on:render
term.clear();

// Persistent: playerX, playerY, score
// Local: color, displayText
const color = health > 50 ? 'green' : 'red';
const displayText = `HP: ${health}`;

term.write(playerX, playerY, '🚀');
term.write(0, 0, displayText, color);
```

## Combining Frontmatter and Code Variables

Mix configuration (frontmatter) with runtime state (code) naturally:

**Frontmatter (configuration):**
```yaml
---
startingHealth: 100
maxHealth: 100
playerSpeed: 5
enemyCount: 10
debugMode: false
---
```

**Code (runtime state):**
```js
// Initialize runtime state from frontmatter config
let currentHealth = startingHealth;
let playerX = 10;
let playerY = 10;
let enemies = [];
let score = 0;
```

**Usage in lifecycle blocks:**
```js on:update
// Mix frontmatter config with runtime state
const moveSpeed = debugMode ? playerSpeed * 2 : playerSpeed;
playerX += moveSpeed;

// Update runtime state
currentHealth = Math.min(maxHealth, currentHealth + 1);

// Use config to initialize arrays on first frame
if (enemies.length === 0) {
  for (let i = 0; i < enemyCount; i++) {
    enemies.push({ x: Math.random() * 100, y: Math.random() * 50 });
  }
}
```

**Benefits:**
- ✅ Configuration visible and editable in frontmatter
- ✅ Runtime state managed in code
- ✅ Clear separation of concerns
- ✅ Easy to create template documents with different configs

## Complex State Objects

You can still use objects for organized state:

```js
// In raw js block
let player = {
  x: 10,
  y: 5,
  health: 100,
  inventory: []
};

let gameState = {
  level: 1,
  paused: false,
  score: 0
};
```

```js on:update
// Access directly - automatically imported
player.x += velocity;
gameState.score += 10;

// Local objects don't persist
const tempData = { dx: 5, dy: 3 };
```

## When to Use `scope` Explicitly

Rarely needed, but useful for:

### Dynamic Property Access
```js
// When property name is computed at runtime
const statName = 'playerHealth';
scope[statName] = 100;
```

### Debugging
```js
// Inspect all persistent state
console.log('All state:', Object.keys(scope));
```

## Summary for AI Code Generators

When generating Storie code:

1. **Use raw `js` blocks** for persistent variable declarations
2. **Declare simply**: `let playerX = 10;` (no `scope.` prefix needed)
3. **Use lifecycle blocks** for logic and rendering
4. **Local variables work normally** in lifecycle blocks
5. **Persistent variables are automatically accessible** in lifecycle blocks

The goal is code that looks like normal JavaScript with automatic persistence where needed.
