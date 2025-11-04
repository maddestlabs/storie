# Robust Key Handling System for Storie

## Overview

The Storie engine now provides normalized key information to Lua scripts, eliminating the need for ASCII code guessing and making cross-platform key handling reliable.

## Implementation

### Nim Side

Three new components added to `storie.nim`:

1. **KeyInfo type** - Structured representation of key events
2. **normalizeKey()** - Converts raw characters to KeyInfo
3. **parseEscapeSequence()** - Handles arrow keys, function keys, etc.
4. **pushKeyInfoToLua()** - Pushes KeyInfo as a Lua table
5. **Updated handleInput()** - Uses KeyInfo throughout

### Lua API

Instead of receiving a single character, `globalHandleKey()` now receives a table:

```lua
function globalHandleKey(key)
  -- key = {
  --   name = "enter",    -- Normalized key name
  --   char = "",         -- Character (empty for special keys)
  --   code = 13,         -- ASCII/scan code
  --   ctrl = false,      -- Modifier flags
  --   alt = false,
  --   shift = false
  -- }
end
```

## Supported Key Names

### Regular Keys
- Printable characters: `"a"`, `"1"`, `"@"`, etc. (both `name` and `char` are set)
- `"space"` - Space bar
- `"enter"` - Enter/Return key
- `"tab"` - Tab key
- `"escape"` - Escape key
- `"backspace"` - Backspace/Delete

### Arrow Keys
- `"up"`, `"down"`, `"left"`, `"right"`

### Navigation Keys
- `"home"`, `"end"`
- `"pageup"`, `"pagedown"`
- `"insert"`, `"delete"`

### Function Keys
- `"f1"` through `"f12"`

### Control Characters
- `"a"` through `"z"` with `ctrl = true` for Ctrl+A through Ctrl+Z

### Modifier Flags
- `ctrl` - Control key held
- `alt` - Alt/Option key held
- `shift` - Shift key held

## Usage Examples

### Basic Key Handling

```lua
function globalHandleKey(key)
  if key.name == "enter" then
    print("Enter pressed!")
  elseif key.name == "escape" then
    print("Escape pressed!")
  elseif key.name == "space" then
    print("Space pressed!")
  elseif key.char ~= "" then
    print("Character: " .. key.char)
  end
end
```

### Arrow Keys

```lua
function globalHandleKey(key)
  if key.name == "up" then
    scrollY = scrollY - 1
  elseif key.name == "down" then
    scrollY = scrollY + 1
  elseif key.name == "left" then
    scrollX = scrollX - 1
  elseif key.name == "right" then
    scrollX = scrollX + 1
  end
end
```

### Function Keys

```lua
function globalHandleKey(key)
  if key.name == "f1" then
    showHelp()
  elseif key.name == "f5" then
    refresh()
  elseif key.name == "f12" then
    openDebugConsole()
  end
end
```

### Modifier Keys

```lua
function globalHandleKey(key)
  if key.name == "s" and key.ctrl then
    -- Ctrl+S: Save
    saveGame()
  elseif key.name == "q" and key.ctrl then
    -- Ctrl+Q: Quit
    running = false
  elseif key.name == "c" and key.ctrl then
    -- Ctrl+C: Copy (or interrupt)
    handleCopy()
  end
end
```

### Tab Navigation

```lua
function globalHandleKey(key)
  if key.name == "tab" then
    if key.shift then
      -- Shift+Tab: Previous item
      currentItem = math.max(1, currentItem - 1)
    else
      -- Tab: Next item
      currentItem = math.min(maxItems, currentItem + 1)
    end
  end
end
```

### Number Keys

```lua
function globalHandleKey(key)
  if key.char >= "0" and key.char <= "9" then
    local num = tonumber(key.char)
    selectOption(num)
  end
end
```

### Alt Combinations

```lua
function globalHandleKey(key)
  if key.alt then
    if key.name == "f" then
      -- Alt+F: File menu
      openFileMenu()
    elseif key.name == "e" then
      -- Alt+E: Edit menu
      openEditMenu()
    end
  end
end
```

## Benefits

1. **No ASCII code memorization** - Use readable key names
2. **Reliable special keys** - Arrow keys, function keys work consistently
3. **Modifier support** - Easy Ctrl/Alt/Shift detection
4. **Cross-platform** - Terminal differences handled in Nim
5. **Type safety** - Lua gets proper booleans and strings
6. **Readable code** - `key.name == "enter"` vs `string.byte(k) == 13`

## Migration Guide

### Old Code (Character-based)

```lua
function globalHandleKey(k)
  local keyByte = string.byte(k)
  if keyByte == 13 then
    -- Enter key
  elseif keyByte == 9 then
    -- Tab key
  elseif k >= "1" and k <= "9" then
    -- Number keys
  end
end
```

### New Code (KeyInfo-based)

```lua
function globalHandleKey(key)
  if key.name == "enter" then
    -- Enter key
  elseif key.name == "tab" then
    -- Tab key
  elseif key.char >= "1" and key.char <= "9" then
    -- Number keys
  end
end
```

## Special Handlers

The engine also calls specialized handlers for common operations:

- `globalHandleArrow(direction)` - Called for arrow keys with direction string
- `globalHandleTab()` - Called for Tab key
- `globalHandleShiftTab()` - Called for Shift+Tab
- `globalHandleEnter()` - Called for Enter key

You can use either the specialized handlers OR the general `globalHandleKey()` - the engine checks for specialized handlers first.

## Notes

- The `char` field is empty for special keys (arrows, function keys, etc.)
- For printable characters, both `name` and `char` contain the same value
- Modifier flags can be combined (e.g., Ctrl+Shift+A)
- Mouse events are still handled separately via `globalHandleMouse(event)`
