# Backstorie on Windows - Quick Start Guide

Welcome Windows users! Backstorie now has basic Windows support.

## Requirements

- **Windows 10 or later** (for ANSI escape sequence support)
- **Nim compiler** - [Download from nim-lang.org](https://nim-lang.org/install_windows.html)
- **Windows Terminal** (strongly recommended) - [Get it from Microsoft Store](https://aka.ms/terminal)

## Installation

1. Install Nim if you haven't already
2. Clone this repository
3. You're ready to build!

## Building and Running

### Option 1: Using the Build Script (Easiest)

```batch
REM Build and run the default demo
build-windows.bat
backstorie.exe

REM Build and run an example
build-windows.bat examples\windows_test
backstorie.exe

REM Build and run the boxes example
build-windows.bat examples\boxes
backstorie.exe
```

### Option 2: Direct Compilation

```batch
REM Compile with Nim directly
nim c -d:release -d:userFile=examples\windows_test backstorie.nim

REM Run it
backstorie.exe
```

## First Steps

Try the minimal Windows test to verify everything works:

```batch
build-windows.bat examples\windows_test
backstorie.exe
```

You should see:
- A bordered screen with colored text
- Terminal size information
- FPS counter updating
- Color test showing multiple colors

Press `Q` or `ESC` to quit.

## Running Examples

All examples should work on Windows. Try them out:

```batch
REM Simple welcome screen (default)
build-windows.bat index
backstorie.exe

REM Animated boxes
build-windows.bat examples\boxes
backstorie.exe

REM Core events demonstration
build-windows.bat examples\core_events
backstorie.exe
```

## Troubleshooting

### Colors Don't Show Properly

**Solution:** Use Windows Terminal instead of legacy CMD.

```batch
REM Launch in Windows Terminal
wt backstorie.exe
```

### "Nim not found" Error

**Solution:** Make sure Nim is installed and in your PATH.

1. Download Nim from https://nim-lang.org/install_windows.html
2. Install using the installer (it will set up PATH)
3. Restart your terminal
4. Test with: `nim --version`

### Input Doesn't Work / Laggy

**Known Issue:** The current Windows input implementation is minimal. This will be improved in future updates. For now:
- Input should work but may have some latency
- Q and ESC keys should work for quitting
- More sophisticated input will be added later

### Screen Flickering

**Solution:** This might happen in some terminals. Try:
1. Use Windows Terminal (best results)
2. Make sure your terminal size doesn't change during runtime
3. Ensure no other programs are writing to the console

## What's Supported (Current Status)

✅ **Working:**
- Basic rendering and colors
- Terminal size detection
- Screen clearing and cursor control
- Basic keyboard input (letters, numbers, special keys)
- FPS control and timing
- Layer system
- All drawing functions

⚠️ **Limited:**
- Mouse input (experimental)
- Advanced keyboard events
- Input may have slight latency
- Resize events (polled, not event-based)

🔧 **Planned:**
- Improved input handling using ReadConsoleInput
- Better mouse support
- Full keyboard protocol support
- Signal handling (Ctrl+C cleanup)

## Tips for Best Results

1. **Always use Windows Terminal** - It has the best ANSI support and performance
2. **Run in fullscreen** - Gives you more space and better experience
3. **Use PowerShell or CMD from Windows Terminal** - Both work well
4. **Keep terminal size stable** - Resizing during runtime might cause visual glitches

## Creating Your Own Programs

Create a new `.nim` file with your code:

```nim
# my_app.nim

onInit = proc(state: AppState) =
  # Initialize your app
  discard

onUpdate = proc(state: AppState, dt: float) =
  # Update logic (runs every frame)
  discard

onRender = proc(state: AppState) =
  # Clear and draw
  state.currentBuffer.clear()
  
  let style = defaultStyle()
  state.currentBuffer.writeText(5, 5, "Hello from Windows!", style)

onInput = proc(state: AppState, event: InputEvent): bool =
  # Handle input
  if event.kind == KeyEvent and event.keyAction == Press:
    if event.keyCode == ord('q'):
      state.running = false
      return true
  return false

onShutdown = proc(state: AppState) =
  discard
```

Build and run:

```batch
build-windows.bat my_app
backstorie.exe
```

## Need Help?

- Check the full documentation in `docs/`
- See `docs/WINDOWS_SUPPORT.md` for technical details
- Look at examples in `examples/` folder
- Report issues on GitHub

## Performance Notes

**TL;DR: Use Windows Terminal for best performance!**

### Expected Performance by Terminal

| Terminal | Expected FPS | Notes |
|----------|-------------|-------|
| **Windows Terminal** | 60 FPS | ✅ Best performance, recommended |
| **PowerShell 7+** | 20-30 FPS | ⚠️ Slower but usable |
| **CMD (Legacy)** | 10-20 FPS | ⚠️ Very slow, avoid if possible |
| **ConEmu** | 30-50 FPS | ✅ Good alternative |

### Why PowerShell is Slower

PowerShell's console has higher ANSI parsing overhead than Windows Terminal. Each frame sends many ANSI escape sequences for colors and positioning, which PowerShell processes slowly.

### How to Get Better Performance

1. **Use Windows Terminal (strongly recommended):**
   ```powershell
   wt backstorie.exe
   ```

2. **If stuck with PowerShell, reduce target FPS:**
   ```nim
   onInit = proc(state: AppState) =
     state.setTargetFps(30.0)  # Lower FPS = less console updates
   ```

3. **Minimize screen changes:**
   - Use layers efficiently
   - Only redraw what changes
   - Reduce animations

4. **Smaller terminal window:**
   - Fewer cells = faster rendering
   - Try 80x24 instead of fullscreen

## What's Next?

The Windows implementation is functional but basic. Future improvements will focus on:

- Better input handling with full keyboard support
- Native mouse event handling
- Performance optimizations
- Better integration with Windows Console API

For now, enjoy building terminal applications on Windows with Backstorie! 🎉
