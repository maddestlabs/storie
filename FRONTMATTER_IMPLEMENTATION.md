# Frontmatter Implementation Summary

## Overview
Successfully ported the frontmatter handling from tstorie (Nim) to Storie (TypeScript). Frontmatter variables are now automatically exposed as globals in JavaScript code blocks, matching the original `exposeFrontMatterVariables()` behavior.

## Changes Made

### 1. Enhanced Frontmatter Parsing ([markdown.ts](src/markdown.ts))
Improved the `extractFrontmatter()` function to handle:
- **Booleans**: Checked before number parsing to avoid false positives
- **Numbers**: Both integers and floats with proper type detection
- **Strings**: With automatic quote stripping
- **Arrays**: 
  - Comma-separated values (e.g., `colors: red, green, blue`)
  - JSON arrays (e.g., `items: [1, 2, 3]`)
  - Mixed-type arrays with per-item type detection
- **Null values**: Handles `null`, `nil`, `none`, `~`
- **Hyphenated keys**: Supports keys like `alt-title` or `font-family`

### 2. Global Variable Exposure ([sandbox.ts](src/sandbox.ts))
Modified `createCompartment()` to:
- Spread frontmatter variables into compartment globals
- Added comprehensive documentation explaining the feature
- Maintained backward compatibility with the `scope` object

**Before:**
```typescript
const compartment = new Compartment({
  console,
  Math,
  Date,
  scope,
  term: this.api.term,
  // ...
});
```

**After:**
```typescript
const compartmentGlobals: Record<string, any> = {
  console,
  Math,
  Date,
  scope,
  ...frontmatter,  // ← Expose as direct globals
  term: this.api.term,
  // ...
};

const compartment = new Compartment(compartmentGlobals);
```

### 3. Logging Enhancement ([engine.ts](src/engine.ts))
Added debug logging to show exposed frontmatter variables:
```typescript
const frontmatterKeys = Object.keys(parsed.metadata);
if (frontmatterKeys.length > 0) {
  console.log(`  Exposed ${frontmatterKeys.length} frontmatter variable(s) as globals:`, frontmatterKeys.join(', '));
}
```

### 4. Test Demo ([docs/demos/frontmatter-test.md](docs/demos/frontmatter-test.md))
Created a comprehensive demo showing:
- All supported frontmatter types
- Direct variable access in code blocks
- Usage across all lifecycle hooks (init, update, render, input)
- Real-time visualization of values

## Usage Examples

### Simple Frontmatter
```yaml
---
title: "My Game"
version: 1.5
debugMode: true
maxScore: 100
---
```

### Accessing in JavaScript
```javascript
// Direct access - no need for scope.variable
console.log(title);        // "My Game"
console.log(version);      // 1.5
console.log(debugMode);    // true
console.log(maxScore);     // 100
```

### Array Support
```yaml
---
colors: red, green, blue
scores: 10, 20, 30
tags: demo, test, game
---
```

```javascript
// Arrays are automatically parsed
colors.forEach(color => console.log(color));
// Output: red, green, blue
```

### Complex Example (from stonegarden.md)
```yaml
---
title: "Stone Garden"
alttitle: "石庭/Sekitei"
author: "Maddest Labs"
chars: "岩僧石座固僧・苔霧松竹梅"
doubleWidth: true
theme: "stonegarden"
---
```

```javascript
// All variables available globally
if (doubleWidth) {
  charWidth = 2;
}
console.log(chars);  // "岩僧石座固僧・苔霧松竹梅"
```

## Implementation Details

### Type Detection Order
1. Empty/null values → `null`
2. Booleans → `true`/`false`
3. Quoted strings → string (quotes removed)
4. JSON arrays/objects → parsed with `JSON.parse()`
5. Comma-separated values → array of typed items
6. Numbers → `Number(value)`
7. Default → string

### Benefits
- ✅ **Simpler code**: Direct access instead of `scope.variable`
- ✅ **Better DX**: Matches common expectations for frontmatter
- ✅ **Type safety**: Automatic type detection
- ✅ **Flexible**: Supports strings, numbers, booleans, arrays
- ✅ **Compatible**: Matches tstorie's behavior exactly

### Backward Compatibility
- `scope` object still contains all frontmatter for legacy access
- No breaking changes to existing code
- Additional access method, not a replacement

## Testing

Run the frontmatter test demo:
```bash
npm run preview
```

Then navigate to:
```
?content=demo:frontmatter-test
```

Or test with stonegarden:
```
?content=demo:stonegarden
```

## Files Modified
1. `src/markdown.ts` - Enhanced frontmatter parsing
2. `src/sandbox.ts` - Global variable exposure
3. `src/engine.ts` - Debug logging
4. `docs/demos/frontmatter-test.md` - Test demo (new)

## Comparison with tstorie

| Feature | tstorie (Nim) | Storie (TypeScript) |
|---------|---------------|---------------------|
| Boolean detection | ✅ | ✅ |
| Number detection | ✅ | ✅ |
| String handling | ✅ | ✅ |
| Array support | ⚠️ Limited | ✅ Enhanced |
| Quote stripping | ✅ | ✅ |
| Global exposure | ✅ `setGlobal()` | ✅ Spread operator |
| Type safety | ✅ | ✅ |

The TypeScript implementation actually improves on the original with better array support and cleaner type detection logic.
