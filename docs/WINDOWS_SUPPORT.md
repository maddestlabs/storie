# Windows Support Implementation Guide

## Current Status

As of the latest update, minimal Windows support has been implemented!

**Status:** POSIX code separated ✅ | Minimal Windows implementation complete ✅ | Full Windows support in progress ⏳

### What Works Now

- ✅ Basic terminal setup with ANSI escape sequence support
- ✅ Terminal size detection
- ✅ Screen clearing and cursor control
- ✅ Color output (RGB, 256-color, basic 8-color)
- ✅ Basic rendering to Windows console
- ✅ Graceful cleanup on exit

### What's Limited

- ⚠️ Input handling is basic (simple stdin reading)
- ⚠️ Mouse events may not work perfectly
- ⚠️ Keyboard protocol support is experimental
- ⚠️ Signal handling is minimal (Ctrl+C uses default handler)
- ⚠️ Best results require Windows Terminal (legacy CMD has limitations)

### Quick Start

**Requirements:**
- Windows 10 or later (for ANSI support)
- Windows Terminal recommended (better performance and compatibility)
- Nim compiler installed

**Build and run:**
```batch
REM Using the build script
build-windows.bat examples\windows_test

REM Then run
backstorie.exe
```

**Or compile directly:**
```batch
nim c -d:release -d:userFile=examples\windows_test backstorie.nim
backstorie.exe
```

## Why Windows Support Was Removed

Windows support was initially removed due to:

1. **Too many compilation errors** - Mixing POSIX and Windows code paths was messy
2. **Performance issues** - Command-line execution was terribly slow with artifacts
3. **Maintenance burden** - Required separate testing and code paths

## Why Reconsider Now?

1. **Better code organization** - POSIX code is now cleanly separated
2. **Modern Windows Terminal** - Windows 10+ has excellent ANSI support
3. **Windows Terminal performance** - Much better than legacy CMD/PowerShell
4. **Larger potential audience** - Many developers still use Windows

## Architecture Overview

### Current Structure (After Refactoring)

```
src/platform/terminal.nim        # Platform-agnostic interface (dispatcher)
├── src/platform/posix_impl.nim  # POSIX implementation (Linux, macOS, BSD)
└── src/platform/windows_impl.nim # Windows implementation (TODO)
```

The main `backstorie.nim` file now imports `lib/terminal.nim` which automatically selects the correct platform implementation.

## Windows Implementation Roadmap

### Phase 1: Terminal Module Implementation ✅ COMPLETE

- [x] Separate POSIX code into `lib/terminal_posix.nim`
- [x] Create platform dispatcher `lib/terminal.nim`
- [x] Test that existing functionality still works

### Phase 2: Windows Console API Wrapper (Estimated: 1-2 days)

Create `src/platform/windows_impl.nim` with Windows Console API wrappers:

#### Required Windows API Functions

```nim
# From wincon.h / kernel32.dll
proc GetStdHandle(nStdHandle: DWORD): Handle
proc GetConsoleMode(hConsoleHandle: Handle, lpMode: ptr DWORD): WINBOOL
proc SetConsoleMode(hConsoleHandle: Handle, dwMode: DWORD): WINBOOL
proc GetConsoleScreenBufferInfo(hConsoleOutput: Handle, 
                                lpConsoleScreenBufferInfo: ptr CONSOLE_SCREEN_BUFFER_INFO): WINBOOL
proc ReadConsoleInputW(hConsoleInput: Handle, 
                       lpBuffer: ptr INPUT_RECORD,
                       nLength: DWORD, 
                       lpNumberOfEventsRead: ptr DWORD): WINBOOL
proc PeekConsoleInputW(hConsoleInput: Handle,
                       lpBuffer: ptr INPUT_RECORD,
                       nLength: DWORD,
                       lpNumberOfEventsRead: ptr DWORD): WINBOOL
proc SetConsoleCtrlHandler(HandlerRoutine: pointer, Add: WINBOOL): WINBOOL
```

#### Core Functions to Implement

1. **`setupRawMode()`** - Configure console for raw input
   ```nim
   # Enable:
   # - ENABLE_VIRTUAL_TERMINAL_INPUT (ANSI support)
   # - ENABLE_WINDOW_INPUT (resize events)
   # - ENABLE_MOUSE_INPUT (mouse events)
   # Disable:
   # - ENABLE_LINE_INPUT (no line buffering)
   # - ENABLE_ECHO_INPUT (no echo)
   # - ENABLE_PROCESSED_INPUT (get raw Ctrl+C, etc.)
   ```

2. **`restoreTerminal()`** - Restore original console settings

3. **`getTermSize()`** - Get console buffer dimensions
   ```nim
   # Use GetConsoleScreenBufferInfo
   # Return (width, height) from srWindow dimensions
   ```

4. **`readInputRaw()`** - Non-blocking input reading
   ```nim
   # Use PeekConsoleInputW to check for input without blocking
   # Use ReadConsoleInputW to read INPUT_RECORD structures
   # Convert KEY_EVENT_RECORD to character buffer
   ```

5. **`setupSignalHandlers()`** - Handle Ctrl+C gracefully
   ```nim
   # Use SetConsoleCtrlHandler
   # Handle CTRL_C_EVENT, CTRL_CLOSE_EVENT
   ```

6. **`hideCursor()`, `showCursor()`** - ANSI sequences work on Win10+

7. **`enableMouseReporting()`, `disableMouseReporting()`** - ANSI sequences

8. **`enableKeyboardProtocol()`, `disableKeyboardProtocol()`** - ANSI sequences

### Phase 3: Input Parsing Enhancements (Estimated: 1 day)

Windows provides much richer input events than POSIX:

```nim
type KEY_EVENT_RECORD = object
  bKeyDown: BOOL
  wRepeatCount: WORD
  wVirtualKeyCode: WORD      # VK_* constants
  wVirtualScanCode: WORD
  uChar: WCHAR               # Unicode character
  dwControlKeyState: DWORD   # Better modifier detection than POSIX!
```

**Advantages:**
- Clear key down/up events (no need to guess)
- Proper modifier key detection (Shift, Ctrl, Alt, Win key)
- Virtual key codes (easier to detect special keys)
- Unicode support built-in

**Implementation:**
- Convert `KEY_EVENT_RECORD` to existing `InputEvent` types
- Map virtual key codes to `INPUT_*` constants
- Parse `dwControlKeyState` for modifier keys

### Phase 4: Performance Optimization (Estimated: 1 day)

Address the original performance issues:

1. **Use Windows Terminal or ConEmu** - Much faster than CMD
   - Detect and warn if running in legacy console

2. **Reduce console API calls**
   - Batch writes where possible
   - Cache terminal size (only check on WINDOW_BUFFER_SIZE_EVENT)

3. **Optimize screen updates**
   - The current delta-based rendering should already help
   - Consider double-buffering optimizations

4. **Test on different Windows terminals:**
   - Windows Terminal (recommended)
   - ConEmu
   - PowerShell 7+
   - Legacy CMD (warning only)

### Phase 5: Testing & Documentation (Estimated: 1 day)

- [ ] Test on Windows 10/11
- [ ] Test in Windows Terminal
- [ ] Test in PowerShell
- [ ] Test in CMD (with warning)
- [ ] Test all examples
- [ ] Document Windows-specific requirements
- [ ] Update README with Windows instructions

## Windows API Reference

### Console Mode Flags

```nim
const
  ENABLE_PROCESSED_INPUT = 0x0001
  ENABLE_LINE_INPUT = 0x0002
  ENABLE_ECHO_INPUT = 0x0004
  ENABLE_WINDOW_INPUT = 0x0008
  ENABLE_MOUSE_INPUT = 0x0010
  ENABLE_INSERT_MODE = 0x0020
  ENABLE_QUICK_EDIT_MODE = 0x0040
  ENABLE_EXTENDED_FLAGS = 0x0080
  ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200
  
  ENABLE_PROCESSED_OUTPUT = 0x0001
  ENABLE_WRAP_AT_EOL_OUTPUT = 0x0002
  ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
  DISABLE_NEWLINE_AUTO_RETURN = 0x0008
```

### Control Key State Flags

```nim
const
  RIGHT_ALT_PRESSED = 0x0001
  LEFT_ALT_PRESSED = 0x0002
  RIGHT_CTRL_PRESSED = 0x0004
  LEFT_CTRL_PRESSED = 0x0008
  SHIFT_PRESSED = 0x0010
  NUMLOCK_ON = 0x0020
  SCROLLLOCK_ON = 0x0040
  CAPSLOCK_ON = 0x0080
  ENHANCED_KEY = 0x0100
```

## Expected Benefits

### Performance
- **Native console API** - No ANSI parsing overhead on Windows
- **Better event model** - Rich input events vs. escape sequence parsing
- **Modern terminals** - Windows Terminal is quite fast

### Input Handling
- **Better modifier detection** - Windows gives explicit modifier states
- **Cleaner key events** - Press/release explicit, no heuristics needed
- **Mouse support** - Native mouse events from console API

### Developer Experience
- **Native Windows build** - No need for WSL for Windows developers
- **Familiar terminal** - Windows Terminal feels modern and responsive

## Alternative: Recommend WSL

If Windows native support proves too complex or performs poorly:

### Pros of WSL Approach
- ✅ Existing POSIX code works perfectly
- ✅ Better terminal performance (Linux kernel)
- ✅ No Windows-specific code to maintain
- ✅ More Unix-like environment for developers

### Cons of WSL Approach
- ❌ Requires WSL installation
- ❌ Not truly native Windows
- ❌ Extra complexity for users

### Current Recommendation
The WASM/browser build is already the best cross-platform solution:
- ✅ Works on Windows, macOS, Linux
- ✅ No terminal compatibility issues
- ✅ Consistent behavior across platforms
- ✅ Can be deployed as a web app

## Implementation Priority

Given the alternatives, here's the suggested priority:

1. **High Priority:** Improve WASM build and documentation
   - Already works everywhere
   - Best cross-platform experience

2. **Medium Priority:** Windows native support
   - Good for Windows developers who want native CLI
   - Estimated effort: 4-6 days
   - Risk: Performance may still be suboptimal

3. **Low Priority:** Improve WSL documentation
   - Easy solution for Windows users
   - Current POSIX code works perfectly

## Testing the Windows Implementation

### Quick Verification Test

We've included a minimal test example specifically for Windows:

```batch
REM Build the Windows test
build-windows.bat examples\windows_test

REM Run it
backstorie.exe
```

This test will verify:
- ✓ Terminal initialization works
- ✓ Screen clearing works
- ✓ Text rendering works
- ✓ Colors display correctly
- ✓ Terminal size detection works
- ✓ FPS counter updates
- ✓ Input handling (Q/ESC to quit) works

### Testing in Different Terminals

**Windows Terminal (Recommended):**
```batch
wt backstorie.exe
```
- Full ANSI support
- Best performance
- RGB colors work perfectly

**PowerShell:**
```powershell
.\backstorie.exe
```
- Good ANSI support in PowerShell 7+
- Works well with the implementation

**Command Prompt (CMD):**
```batch
backstorie.exe
```
- Limited support in legacy CMD
- May have visual artifacts
- Use Windows Terminal instead

### Known Issues

1. **Input Latency:** The current `readInputRaw()` implementation is basic and may have some latency. This will be improved in future updates.

2. **Mouse Support:** Mouse events are enabled but may not work perfectly in all scenarios. This requires more sophisticated input handling.

3. **Resize Events:** Terminal resize detection works via polling `getTermSize()`, but doesn't catch resize events directly yet.

## Getting Started with Windows Implementation

Basic Windows support is now implemented! Here's what was done:

1. ✅ Created `src/platform/platform_win.nim` with Windows Console API wrappers
2. ✅ Implemented basic console mode setup/restore
3. ✅ Added terminal size detection
4. ✅ Created Windows build scripts
5. ✅ Added minimal test example (`examples/windows_test.nim`)
6. ✅ Updated dispatcher in `src/platform/terminal.nim`

### Next Steps for Full Support

To expand Windows support further:

1. **Improve Input Handling:**
   - Implement proper `ReadConsoleInput()` based reading
   - Convert `INPUT_RECORD` structures properly
   - Add better keyboard event handling
   - Implement mouse event conversion

2. **Add Signal Handling:**
   - Implement `SetConsoleCtrlHandler()`
   - Handle CTRL_C_EVENT gracefully
   - Handle CTRL_CLOSE_EVENT

3. **Performance Optimization:**
   - Profile in Windows Terminal
   - Optimize screen updates if needed
   - Consider console buffer direct writes for speed

4. **Testing:**
   - Test all examples on Windows
   - Verify in different terminal emulators
   - Document any platform-specific quirks

The refactored code structure makes this much more manageable than before!

## Performance Tips for Windows

### 1. Detect Terminal Type
```nim
proc isWindowsTerminal(): bool =
  # Check WT_SESSION or WT_PROFILE_ID environment variables
  getEnv("WT_SESSION").len > 0
```

### 2. Batch ANSI Sequences
```nim
# Instead of many small writes:
stdout.write("\e[10;5H")
stdout.write("\e[32m")
stdout.write("Hello")

# Do this:
stdout.write("\e[10;5H\e[32mHello")
```

### 3. Use Console API When Faster
```nim
# For simple operations, console API may be faster than ANSI:
# - GetConsoleScreenBufferInfo (for cursor position)
# - FillConsoleOutputCharacter (for clearing)
# - WriteConsoleOutputCharacter (for direct buffer writes)
```

### 4. Reduce Screen Updates
The existing delta-based rendering should help, but on Windows:
- Cache previous frame more aggressively
- Only update changed cells
- Consider double-buffering at console API level

## Questions to Consider

Before implementing:

1. **Target audience:** How many users actually need native Windows CLI?
2. **Performance requirements:** Is WSL performance acceptable?
3. **Maintenance cost:** Can you maintain Windows-specific code long-term?
4. **Testing infrastructure:** Do you have Windows machines for testing?

The WASM build might be the best answer for most use cases!
