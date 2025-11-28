## Platform-agnostic terminal operations interface
## This module provides a unified API for terminal operations
## that works across different platforms (POSIX, Windows, WASM)

when not defined(emscripten):
  when defined(windows):
    # Windows systems (Windows 10+ recommended for best ANSI support)
    import platform_win
    export platform_win
  else:
    # POSIX systems (Linux, macOS, BSD, etc.)
    import platform_posix
    export platform_posix
else:
  # WebAssembly target - no terminal operations needed
  type
    TerminalState* = object
      dummy: int
  
  proc setupRawMode*(): TerminalState =
    discard
  
  proc restoreTerminal*(state: TerminalState) =
    discard
  
  proc restoreTerminal*() =
    discard
  
  proc hideCursor*() =
    discard
  
  proc showCursor*() =
    discard
  
  proc clearScreen*() =
    discard
  
  proc enableMouseReporting*() =
    discard
  
  proc disableMouseReporting*() =
    discard
  
  proc enableKeyboardProtocol*() =
    discard
  
  proc disableKeyboardProtocol*() =
    discard
  
  proc getTermSize*(): (int, int) =
    return (80, 24)
  
  proc readInputRaw*(buffer: var openArray[char]): int =
    return 0
  
  proc setupSignalHandlers*(handler: proc(sig: cint) {.noconv.}) =
    discard
