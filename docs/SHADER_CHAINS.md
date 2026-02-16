# Shader Chains - Quick Reference

Shader chains allow you to compose multiple post-processing shaders for visual effects in Storie, bringing back the beloved tstorie shader system with enhanced functionality.

## Usage

### 1. Frontmatter (in your .md file)

```markdown
---
title: "My Demo"
shaders: "invert+paper+scanlines"
---
```

**Separators supported:** `+`, `;`, `,`, `|`

### 2. URL Parameter

```
?content=demo:myfile&shaders=bloom+crt
```

**Important:** The URL parameter **overrides** frontmatter shaders.

### 3. JavaScript API

```javascript
// Set a chain
await shader.setChain(['invert', 'bloom', 'crt']);

// Get current chain
const chain = shader.getChain();  // ['invert', 'bloom', 'crt']

// Check if chain is active
if (shader.hasChain()) {
  console.log('Chain info:', shader.chainInfo());
}

// Clear chain
shader.clearChain();
```

## Common Issues

### ❌ Wrong: Missing `=` sign
```
?content=demo&shaders+invert
```

### ✅ Correct: Use `=` before shader names
```
?content=demo&shaders=invert
```

### ❌ Wrong: Using `&` between shader names
```
?content=demo&shaders=invert&paper
```

### ✅ Correct: Use `+` (or `;`, `,`) between shader names
```
?content=demo&shaders=invert+paper+scanlines
```

## Available Built-in Shaders

Located in `/docs/shaders/`:
- `invert` - Invert colors
- `scanlines` - CRT scanline effect
- `paper` - Paper texture overlay
- `ruledlines` - Notebook-style lines
- `bloom` - Bloom/glow effect
- `crt` - CRT monitor effect
- `blur` - Blur effect
- `lightvignette` - Subtle vignette
- `lightson` - Lighting effect
- `clouds` - Cloud texture
- `border` - Border effect

## How It Works

1. **Multi-pass rendering**: Each shader processes the output of the previous one
2. **Automatic loading**: Built-in shaders are loaded on-demand
3. **Priority**: URL param > API > Frontmatter
4. **Composable**: Mix built-in and custom WGSL shaders

## Example: Custom + Built-in

Define a custom shader in your markdown:

````markdown
```wgsl fragment:myEffect
// Your custom shader code
```
````

Then chain it with built-ins:

```javascript
await shader.setChain(['myEffect', 'bloom', 'crt']);
```

Or in frontmatter:

```yaml
shaders: "myEffect+bloom+crt"
```

## Performance Tips

- Limit chains to 8 shaders (enforced automatically)
- Simpler shaders = better performance
- Test on lower-end devices

## Debugging

Check browser console for:
- `✓ Shader chain parameter detected: ...` - URL param parsed
- `⚠️ Shader chain parameter malformed!` - URL syntax error (use `=` not just `+`)
- `[ShaderChain] Activating chain: ...` - Chain activation
- `[ShaderChain] Loading built-in shader: ...` - Shader loading
- `[ShaderChain] ✓ Loaded built-in shader: ...` - Shader loaded successfully
- `[ShaderChain] ✓ Active chain: ...` - Chain activated successfully
- `✓ Applying deferred shader chain: ...` - Deferred chain applied after WebGPU init

### Common Issues

**"ShaderChainManager not available"**
- This is normal during startup - shader chains are now automatically deferred until WebGPU initializes
- The chain will be applied automatically once the engine starts

**"Shader not available: shaderName"**
- The shader failed to load or doesn't exist
- Check the shader name spelling
- Verify the shader file exists in `/docs/shaders/`

**"No valid shaders in chain"**
- All shaders in the chain failed to load
- Check console for individual shader errors

## Examples

### Simple Effect
```
?content=demo:tui_basic&shaders=invert
```

### Classic CRT Look
```
?content=demo:myapp&shaders=scanlines+crt+lightvignette
```

### Paper Notepad Style
```
?content=demo:notes&shaders=paper+ruledlines
```

### Cyberpunk Style
```
?content=demo:game&shaders=bloom+scanlines+crt
```

## See Also

- [WGSL Code Blocks](WGSL_CODE_BLOCKS.md) - Define custom shaders
- [Shader API Demo](demos/shader-api.md) - Shader API reference
- [Shader Chain Test](demos/shader-chain-test.md) - Interactive test

