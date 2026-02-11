---
name: "Variable Persistence Example"
theme: "solarlight"
---

# Storie Variable Persistence

This demo shows how variables persist across code blocks using Storie's two-block pattern.

**Raw `js` blocks:** Variables persist automatically  
**Lifecycle blocks:** Use persistent vars + local vars naturally

## Code

```js
// Raw js block - variables declared here persist automatically!
let counter = 0;
let message = "Hello, Storie!";
let colors = ['red', 'green', 'blue', 'yellow'];
let position = { x: 10, y: 5 };
```

```js on:init
term.clear();
console.log("✓ Variables initialized");
console.log(`Starting at position (${position.x}, ${position.y})`);
```

```js on:update
// Persistent variables are automatically accessible
counter++;

// Local variables work normally - they DON'T persist
const frameRate = 60;
const cycleLength = frameRate * 2;

// Cycle through colors every 2 seconds
if (counter % cycleLength === 0) {
  const colorIndex = Math.floor(counter / cycleLength) % colors.length;
  message = `Color ${colorIndex + 1}: ${colors[colorIndex]}`;
}

// Move position (persistent)
if (key.pressed('ArrowRight')) position.x++;
if (key.pressed('ArrowLeft')) position.x--;
if (key.pressed('ArrowDown')) position.y++;
if (key.pressed('ArrowUp')) position.y--;

// Clamp position using local vars
const maxX = termWidth - 1;
const maxY = termHeight - 3;
position.x = Math.max(0, Math.min(maxX, position.x));
position.y = Math.max(0, Math.min(maxY, position.y));
```

```js on:render
term.clear();

// Persistent variables automatically available
term.write(2, 2, message);
term.write(2, 4, `Counter: ${counter}`);
term.write(2, 6, `Position: (${position.x}, ${position.y})`);
term.write(position.x, position.y, '●');

// Local rendering variables
const instructionY = termHeight - 2;
const instructionText = "Use arrow keys to move the dot";
term.write(2, instructionY, instructionText);
```

## How It Works

### 1. **Raw `js` Blocks** (No lifecycle annotation)
Declare persistent variables here:
```js
let score = 0;
let playerX = 10;
```
These are automatically stored in the persistent scope.

### 2. **Lifecycle Blocks** (`on:init`, `on:update`, `on:render`)
- **Persistent variables** are automatically accessible
- **Local variables** work normally and don't persist
- **No boilerplate** needed!

```js on:update
// score and playerX are automatically available
score++;

// velocity is local - doesn't persist
const velocity = 5;
playerX += velocity;
```

### 3. **Behind the Scenes**
The engine wraps lifecycle blocks with automatic import/export:
- **Import:** `let {score, playerX} = scope;`
- **Your code here**
- **Export:** `scope.score = score; scope.playerX = playerX;`

You get clean code without manual state management!
