---
title: "Shader Chain Test"
theme: "neotopia"
shaders: "invert+scanlines"
---

# Shader Chain Test

This demo tests the new shader chain system.

## Features Tested

1. **Frontmatter shader chains** - Defined in frontmatter: `shaders: "invert+scanlines"`
2. **URL parameter override** - Try: `?content=demo:shader-chain-test&shaders=bloom+crt`
3. **Programmatic API** - Use `shader.setChain()` in code

```javascript
// Persistent variables (available in all lifecycle blocks)
let rotation = 0;
let chainIndex = 0;

// Available chains to cycle through
const chains = [
  ['invert', 'scanlines'],
  ['paper', 'ruledlines'],
  ['bloom', 'crt'],
  ['invert', 'paper', 'scanlines'],
  []  // No shaders
];
```

```javascript on:init
console.log('🎨 Shader chain test initialized');
console.log('Current chain:', shader.getChain());
console.log('Available shaders:', shader.list());
```

```javascript on:update
rotation += getDelta() * 30;

// Press SPACE to cycle through different shader chains
if (key.pressed(key.SPACE)) {
  chainIndex = (chainIndex + 1) % chains.length;
  const newChain = chains[chainIndex];
  
  if (newChain.length === 0) {
    console.log('🔴 Clearing shader chain');
    shader.clearChain();
  } else {
    console.log('🎨 Setting shader chain:', newChain.join(' → '));
    shader.setChain(newChain);
  }
}
```

```javascript on:render
term.clear();

// Title
term.write(2, 1, '═'.repeat(76), theme.border);
term.write(2, 2, '  SHADER CHAIN TEST', theme.accent1);
term.write(2, 3, '═'.repeat(76), theme.border);

// Instructions
term.write(2, 5, 'Controls:', theme.accent2);
term.write(4, 6, 'SPACE - Cycle through shader chains', theme.fg);
term.write(4, 7, 'URL   - Override with ?shaders=bloom+crt', theme.fg);

// Current status
term.write(2, 9, 'Current Chain:', theme.accent2);
const currentChain = shader.getChain();
if (currentChain.length > 0) {
  term.write(4, 10, currentChain.join(' → '), theme.success);
  term.write(4, 11, `(${currentChain.length} shader${currentChain.length === 1 ? '' : 's'})`, theme.dim);
} else {
  term.write(4, 10, 'None (original rendering)', theme.dim);
}

// Available chains
term.write(2, 13, 'Press SPACE to try:', theme.accent2);
for (let i = 0; i < chains.length; i++) {
  const chain = chains[i];
  const label = chain.length === 0 ? 'No shaders' : chain.join(' → ');
  const color = i === chainIndex ? theme.accent1 : theme.fg;
  const prefix = i === chainIndex ? '▶ ' : '  ';
  term.write(4, 14 + i, prefix + label, color);
}

// Animated pattern to show shader effects
term.write(2, 21, 'Pattern (to visualize shader effects):', theme.accent2);
const patternY = 22;
const patternHeight = 10;

for (let y = 0; y < patternHeight; y++) {
  let line = '';
  for (let x = 0; x < 76; x++) {
    const phase = (x + y + rotation) % 4;
    if (phase === 0) line += '█';
    else if (phase === 1) line += '▓';
    else if (phase === 2) line += '▒';
    else line += '░';
  }
  term.write(2, patternY + y, line, theme.fg);
}

// Footer with shader info
term.write(2, patternY + patternHeight + 2, '─'.repeat(76), theme.border);
term.write(2, patternY + patternHeight + 3, 
  `Available shaders: ${shader.list().join(', ')}`, theme.dim);

// Frame counter
term.write(2, termHeight - 2, `Frame: ${getFrame()}`, theme.dim);
term.write(2, termHeight - 1, `FPS: ${Math.round(1 / getDelta())}`, theme.dim);
```

## API Examples

### Set a shader chain

```typescript
// Set a chain of 3 shaders
await shader.setChain(['invert', 'bloom', 'crt']);
```

### Get current chain

```typescript
const chain = shader.getChain();
console.log('Active chain:', chain);  // ['invert', 'bloom', 'crt']
```

### Clear the chain

```typescript
shader.clearChain();
```

### Check chain status

```typescript
if (shader.hasChain()) {
  console.log('Chain info:', shader.chainInfo());
}
```

## How It Works

1. **Frontmatter chains** - Loaded from markdown metadata
2. **URL parameter chains** - Override frontmatter via `?shaders=shader1+shader2`
3. **Programmatic chains** - Set via `shader.setChain()` API
4. **Multi-pass rendering** - Each shader processes the output of the previous one
5. **Automatic intermediate textures** - Managed by the ShaderChainManager

## Compatibility

- ✅ Works with inline WGSL shader definitions
- ✅ Works with built-in shader library
- ✅ Composable with custom shaders
- ✅ Priority: URL > API > Frontmatter
