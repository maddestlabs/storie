# Security & Scoping

## Is the code sandboxed?

**Yes!** User code runs in a secure SES (Secure ECMAScript) sandbox with strict isolation:

### What SES Provides

1. **Hardened JavaScript** - `lockdown()` freezes all intrinsics (Object, Array, etc.) preventing prototype pollution
2. **Compartments** - Isolated execution contexts with limited globals
3. **No Network Access** - `fetch`, `XMLHttpRequest` blocked
4. **No Storage** - `localStorage`, `sessionStorage` blocked
5. **No DOM Manipulation** - `document`, `window` blocked
6. **No Code Injection** - `eval`, `Function()` constructor blocked

### What User Code CAN Access

- `console` - For debugging output
- `Math`, `Date` - Safe standard library objects
- **S|torie API** - `term`, `termCanvas`, `layer`, `key`, `mouse`, `getFrame()`, `getTime()`, `getDelta()`
- **Shared Scope** - Persistent variables across code blocks (within same document)

### What User Code CANNOT Access

❌ Network (fetch, XHR)  
❌ Storage (localStorage, cookies)  
❌ DOM (document, window)  
❌ Code execution (eval)  
❌ File system  
❌ Other documents' scopes  

## Important: Untrusted Content (Public Gists)

SES isolates JavaScript *authority* (no `window`, no `fetch`, no `eval`, etc.), but the **host engine** still contains privileged features that can execute code in the host realm (not inside SES).

In particular:

- Dynamic module loading (`modules.load(...)`) uses host-side dynamic `import()`.
- Shader effect loading (`compositor.loadEffect(name, url)`) uses host-side dynamic `import()`.

If untrusted scripts can influence those URLs, they can effectively escape the sandbox.

### Mitigation: `security.untrusted`

When running content you do not control (e.g. `?content=gist:...`, `decode:...`, or `browser:...`), start the engine with `security.untrusted: true`.

In untrusted mode, Storie disables high-risk capabilities including:

- `modules.load` / `modules.loadAll`
- `compositor.loadEffect` for arbitrary URLs (restricted to local `shaders/` only)
- direct access to `webgpu.device` (to prevent bypassing WebGPU guardrails)

## How Does Scoping Work?

### Persistent Shared Scope

Each document gets a **persistent scope object** that survives across all code blocks:

```markdown
\`\`\`js
// This block executes first - declare variables
let x = 10;
let y = 20;
\`\`\`

\`\`\`js on:init
// Variables from above are accessible here
console.log(x, y); // 10, 20
x = 30; // Modify the shared variable
\`\`\`

\`\`\`js on:update
// Still accessible and maintains changes
console.log(x); // 30
x += 1; // Persists across frames
\`\`\`

\`\`\`js on:render
// All variables remain in scope
console.log(x); // 31 (after one update)
\`\`\`
```

### How It Works Internally

1. **Document Load**: Creates a new `Compartment` with a shared `scope` object
2. **Frontmatter**: Variables from YAML frontmatter are added to scope
3. **Global Blocks**: Code blocks without hooks execute first, populating scope
4. **Lifecycle Hooks**: Hook blocks are wrapped in functions and added to scope
5. **Execution**: Functions access scope via closure, changes persist

### Scope Isolation

Each document has its own isolated scope:

```javascript
// Document A
let x = 10;

// Document B  
let x = 20; // Different x, completely isolated

// Document A cannot access Document B's variables and vice versa
```

## Lifecycle Hooks

Code blocks can specify which lifecycle phase they belong to:

### `on:init`

Runs **once** when document loads:

```markdown
\`\`\`js on:init
// Set up state
let score = 0;
let lives = 3;

// Initialize systems
layer.create('game', 80, 24);
console.log('Game started!');
\`\`\`
```

### `on:update`

Runs **every frame**, receives delta time:

```markdown
\`\`\`js on:update
// Update game logic
if (key.pressed(key.SPACE)) {
  score += 10;
}

// Apply physics
player.y += velocity * delta;
\`\`\`
```

### `on:render`

Runs **every frame** after update:

```markdown
\`\`\`js on:render
// Clear and draw
term.clear();
term.write(0, 0, `Score: ${score}`);
termCanvas.plot(player.x, player.y, '@', {r: 255, g: 100, b: 50});
\`\`\`
```

### No Hook (Global)

Code blocks without hooks execute **once at load**, before any hooks:

```markdown
\`\`\`js
// Global declarations
let SPEED = 5;
let MAX_ENEMIES = 10;

function distance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}
\`\`\`
```

## Frontmatter Variables

Variables defined in YAML frontmatter are automatically added to the scope:

```markdown
---
playerSpeed: 5
enemyCount: 10
difficulty: hard
debugMode: true
---

\`\`\`js on:init
// Frontmatter variables are immediately available
console.log(playerSpeed); // 5
console.log(enemyCount); // 10
console.log(difficulty); // "hard"
console.log(debugMode); // true

// You can modify them too
if (difficulty === 'easy') {
  enemyCount = 5;
}
\`\`\`
```

## Multiple Blocks Per Hook

You can have multiple blocks for the same hook - they're concatenated:

```markdown
\`\`\`js on:update
// Physics update
player.x += velocity.x * delta;
player.y += velocity.y * delta;
\`\`\`

\`\`\`js on:update
// Enemy AI update  
for (let enemy of enemies) {
  enemy.update(delta);
}
\`\`\`

\`\`\`js on:update
// Collision detection
checkCollisions();
\`\`\`
```

All three blocks above will execute in the `update` handler, in document order.

## Execution Order

1. **Parse** - Extract frontmatter, sections, code blocks
2. **Create Scope** - New compartment with frontmatter variables
3. **Execute Globals** - Run code blocks without hooks (in document order)
4. **Build Handlers** - Combine hook blocks into init/update/render functions
5. **Call init()** - Run initialization once
6. **Main Loop** - Call update() and render() every frame

## Safety Guarantees

✅ **Memory Isolation** - Each document has separate scope  
✅ **No Global Pollution** - Cannot modify built-in prototypes  
✅ **Capability-Based** - Only access explicitly granted API  
✅ **No Side Channels** - Cannot access other documents or external resources  
✅ **Error Containment** - Exceptions don't crash the engine  
✅ **Deterministic** - Same code always produces same result (given same inputs)  

## Best Practices

1. **Declare Once** - Use global blocks for variable declarations
2. **Initialize in init** - Set up state, create layers
3. **Update Logic** - Use on:update for game logic, physics
4. **Render Last** - Use on:render for drawing only
5. **Use Frontmatter** - Configuration values belong in frontmatter
6. **Pure Functions** - Helper functions in global blocks
7. **Consistent State** - Don't rely on timing - use delta time

## Example: Complete Game Loop

```markdown
---
title: My Game
width: 80
height: 24
---

# My Game

\`\`\`js
// Constants and helpers
const PLAYER_CHAR = '@';
const ENEMY_CHAR = 'E';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
\`\`\`

\`\`\`js on:init
// Initialize game state
let player = { x: width / 2, y: height / 2 };
let enemies = [];
let score = 0;

// Create enemies
for (let i = 0; i < 5; i++) {
  enemies.push({
    x: Math.random() * width,
    y: Math.random() * height
  });
}

layer.create('game', width, height);
term.layerID = 'game';
\`\`\`

\`\`\`js on:update
// Player movement
if (key.down(key.ARROW_UP)) player.y--;
if (key.down(key.ARROW_DOWN)) player.y++;
if (key.down(key.ARROW_LEFT)) player.x--;
if (key.down(key.ARROW_RIGHT)) player.x++;

// Clamp to screen
player.x = clamp(player.x, 0, width - 1);
player.y = clamp(player.y, 0, height - 1);

// Move enemies toward player
for (let enemy of enemies) {
  if (enemy.x < player.x) enemy.x++;
  if (enemy.x > player.x) enemy.x--;
  if (enemy.y < player.y) enemy.y++;
  if (enemy.y > player.y) enemy.y--;
}
\`\`\`

\`\`\`js on:render
term.clear();

// Draw UI
term.write(2, 1, \`\${title} - Score: \${score}\`, {r: 255, g: 255, b: 255});

// Draw border
termCanvas.rect(0, 0, width, height, '#', {r: 100, g: 100, b: 100});

// Draw player
termCanvas.plot(
  Math.floor(player.x), 
  Math.floor(player.y), 
  PLAYER_CHAR, 
  {r: 100, g: 255, b: 100}
);

// Draw enemies
for (let enemy of enemies) {
  termCanvas.plot(
    Math.floor(enemy.x),
    Math.floor(enemy.y),
    ENEMY_CHAR,
    {r: 255, g: 100, b: 100}
  );
}
\`\`\`
```

This example demonstrates:
- Frontmatter for configuration
- Global block for constants/helpers
- init block for one-time setup
- update block for game logic
- render block for drawing
- Persistent scope (all variables accessible everywhere)
- Safe, sandboxed execution
