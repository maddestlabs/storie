# Nimini Parser Issue with `-` Operator

## ✅ RESOLVED

The issue was **NOT** with the minus operator itself! The minus operator was already working correctly for subtraction.

## The Real Problem

The parser was failing on **array index assignments** like:
```nim
audioBuffer[idx] = value  # This caused the error!
```

The error message "Unexpected prefix operator at line X" was misleading - it appeared because the parser couldn't handle indexed assignments and fell through to an unexpected code path.

## What Was Actually Failing

```nim
var x = a - b           # ✅ This works fine!
var y = width / 2 - 100 # ✅ This works fine!
var z = mouseX - sliderX # ✅ This works fine!

# The ACTUAL problem:
audioBuffer[0] = sample  # ❌ This was failing!
```

## The Fix

Modified the Nimini parser to support indexed assignments:

1. **AST Changes** (`src/nimini/ast.nim`):
   - Changed `skAssign` to use expression-based targets instead of string-only
   - Added `newAssignExpr` function for assigning to any expression

2. **Parser Changes** (`src/nimini/parser.nim`):
   - Parse left-hand side as expression first, then check for `=`
   - Updated `parseAssign` to accept expression targets
   - Now handles both `x = value` and `array[idx] = value`

3. **Runtime Changes** (`src/nimini/runtime.nim`):
   - Handle assignment to identifiers (`ekIdent`)
   - Handle assignment to indexed arrays (`ekIndex`)

4. **Codegen Changes** (`src/nimini/codegen.nim`):
   - Generate code for expression-based assignment targets

## Impact on audio_slider.md

The file was failing with "Unexpected prefix operator at line 96", which corresponded to:
```nim
audioBuffer[bufIdx1] = sample  # Line 96 - array index assignment
```

All the subtraction operations were working fine:
- ✅ Layout calculations: `width / 2 - 180`
- ✅ Mouse interaction: `mouseX - sliderX`
- ✅ Positioning: `sliderY - 20`
- ✅ Waveform rendering: `waveYCenter - int(sampleOffset)`
- ✅ Info text: `height - 40`

### Actual Failing Lines (Array Assignments)

```nim
audioBuffer[bufIdx1] = sample   # Line 96 - This was the issue!
audioBuffer[bufIdx2] = sample   # Line 97 - This too!
```

## Testing Results

After the fix, `audio_slider.md` now parses successfully:
```
Testing markdown file: examples/audio_slider.md
============================================================
Parsed 2 code blocks

--- Code Block 1 (on:init) ---
  Tokens: 76
  Parsed successfully!

--- Code Block 2 (on:render) ---
  Tokens: 962
  Parsed successfully!

============================================================
All code blocks compiled successfully!
```

## Conclusion

The minus operator was **never broken**. The parser just needed support for indexed assignments (`array[idx] = value`), which is now implemented and working correctly.
