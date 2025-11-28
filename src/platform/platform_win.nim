## Windows-specific terminal operations
## This module handles raw terminal mode, input reading, and terminal control
## for Windows systems using the Windows Console API
##
## MINIMAL IMPLEMENTATION - Just enough to get basic rendering working
## This provides a foundation that can be expanded later

import winlean

# Windows Console API types and constants
type
  COORD = object
    x: int16
    y: int16

  SMALL_RECT = object
    left: int16
    top: int16
    right: int16
    bottom: int16

  CONSOLE_SCREEN_BUFFER_INFO = object
    dwSize: COORD
    dwCursorPosition: COORD
    wAttributes: uint16
    srWindow: SMALL_RECT
    dwMaximumWindowSize: COORD

  DWORD = uint32
  WINBOOL = int32

const
  STD_INPUT_HANDLE = -10
  STD_OUTPUT_HANDLE = -11
  
  # Input mode flags
  ENABLE_PROCESSED_INPUT = 0x0001
  ENABLE_LINE_INPUT = 0x0002
  ENABLE_ECHO_INPUT = 0x0004
  ENABLE_WINDOW_INPUT = 0x0008
  ENABLE_MOUSE_INPUT = 0x0010
  ENABLE_VIRTUAL_TERMINAL_INPUT = 0x0200
  
  # Output mode flags
  ENABLE_PROCESSED_OUTPUT = 0x0001
  ENABLE_WRAP_AT_EOL_OUTPUT = 0x0002
  ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004

  # Input record event types
  KEY_EVENT = 0x0001
  MOUSE_EVENT = 0x0002
  WINDOW_BUFFER_SIZE_EVENT = 0x0004

  # Control key state flags
  RIGHT_ALT_PRESSED = 0x0001
  LEFT_ALT_PRESSED  = 0x0002
  RIGHT_CTRL_PRESSED = 0x0004
  LEFT_CTRL_PRESSED  = 0x0008
  SHIFT_PRESSED      = 0x0010

# Windows Console API functions
proc GetStdHandle(nStdHandle: DWORD): Handle {.
  stdcall, dynlib: "kernel32", importc: "GetStdHandle".}

proc GetConsoleMode(hConsoleHandle: Handle, lpMode: ptr DWORD): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "GetConsoleMode".}

proc SetConsoleMode(hConsoleHandle: Handle, dwMode: DWORD): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "SetConsoleMode".}

proc GetConsoleScreenBufferInfo(hConsoleOutput: Handle, 
                                 lpConsoleScreenBufferInfo: ptr CONSOLE_SCREEN_BUFFER_INFO): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "GetConsoleScreenBufferInfo".}

proc GetNumberOfConsoleInputEvents(hConsoleInput: Handle, lpcNumberOfEvents: ptr DWORD): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "GetNumberOfConsoleInputEvents".}

proc ReadConsoleInputW(hConsoleInput: Handle, lpBuffer: pointer, nLength: DWORD, lpNumberOfEventsRead: ptr DWORD): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "ReadConsoleInputW".}

type
  TerminalState* = object
    ## Stores the original terminal state for restoration
    hStdin: Handle
    hStdout: Handle
    oldInputMode: DWORD
    oldOutputMode: DWORD
    isRawMode: bool

var globalTerminalState: TerminalState

proc setupRawMode*(): TerminalState =
  ## Configure terminal for raw mode with ANSI support
  ## Returns the terminal state for later restoration
  result.isRawMode = false
  
  # Get console handles
  result.hStdin = GetStdHandle(STD_INPUT_HANDLE.DWORD)
  result.hStdout = GetStdHandle(STD_OUTPUT_HANDLE.DWORD)
  
  # Save original modes
  discard GetConsoleMode(result.hStdin, addr result.oldInputMode)
  discard GetConsoleMode(result.hStdout, addr result.oldOutputMode)
  
  # Configure input mode:
  # - Enable virtual terminal input for ANSI escape sequences
  # - Enable window input for resize events
  # - Disable line input and echo for raw mode
  var newInputMode = ENABLE_VIRTUAL_TERMINAL_INPUT or ENABLE_WINDOW_INPUT
  discard SetConsoleMode(result.hStdin, newInputMode.DWORD)
  
  # Configure output mode:
  # - Enable virtual terminal processing for ANSI escape sequences
  # - Enable wrap at EOL
  var newOutputMode = ENABLE_VIRTUAL_TERMINAL_PROCESSING or 
                      ENABLE_WRAP_AT_EOL_OUTPUT or
                      ENABLE_PROCESSED_OUTPUT
  discard SetConsoleMode(result.hStdout, newOutputMode.DWORD)
  
  result.isRawMode = true
  globalTerminalState = result

proc restoreTerminal*(state: TerminalState) =
  ## Restore terminal to its original state
  if state.isRawMode:
    discard SetConsoleMode(state.hStdin, state.oldInputMode)
    discard SetConsoleMode(state.hStdout, state.oldOutputMode)

proc restoreTerminal*() =
  ## Restore terminal using the global state
  restoreTerminal(globalTerminalState)

proc hideCursor*() =
  ## Hide the terminal cursor using ANSI escape sequence
  ## Works on Windows 10+ with virtual terminal processing enabled
  stdout.write("\e[?25l")
  stdout.flushFile()

proc showCursor*() =
  ## Show the terminal cursor using ANSI escape sequence
  stdout.write("\e[?25h")
  stdout.flushFile()

proc clearScreen*() =
  ## Clear the entire screen and move cursor to home using ANSI
  stdout.write("\e[2J\e[H")
  stdout.flushFile()

proc enableMouseReporting*() =
  ## Enable SGR mouse reporting mode (1006)
  ## Note: Mouse input on Windows may require additional work
  stdout.write("\e[?1006h\e[?1000h")
  stdout.flushFile()

proc disableMouseReporting*() =
  ## Disable mouse reporting
  stdout.write("\e[?1006l\e[?1000l")
  stdout.flushFile()

proc enableKeyboardProtocol*() =
  ## Enable enhanced keyboard protocol (CSI u mode)
  ## Note: This may not work perfectly on all Windows terminals
  stdout.write("\e[>1u")
  stdout.flushFile()

proc disableKeyboardProtocol*() =
  ## Disable enhanced keyboard protocol
  stdout.write("\e[<u")
  stdout.flushFile()

proc getTermSize*(): (int, int) =
  ## Get the current terminal size (width, height)
  ## Returns (80, 24) as fallback if detection fails
  var info: CONSOLE_SCREEN_BUFFER_INFO
  let hStdout = GetStdHandle(STD_OUTPUT_HANDLE.DWORD)
  
  if GetConsoleScreenBufferInfo(hStdout, addr info) != 0:
    let width = info.srWindow.right - info.srWindow.left + 1
    let height = info.srWindow.bottom - info.srWindow.top + 1
    return (width.int, height.int)
  
  return (80, 24)

proc PeekConsoleInputW(hConsoleInput: Handle,
                       lpBuffer: pointer,
                       nLength: DWORD,
                       lpNumberOfEventsRead: ptr DWORD): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "PeekConsoleInputW".}

proc ReadFile(hFile: Handle,
              lpBuffer: pointer,
              nNumberOfBytesToRead: DWORD,
              lpNumberOfBytesRead: ptr DWORD,
              lpOverlapped: pointer): WINBOOL {.
  stdcall, dynlib: "kernel32", importc: "ReadFile".}

type
  KEY_EVENT_RECORD = object
    bKeyDown: int32      # BOOL
    wRepeatCount: uint16
    wVirtualKeyCode: uint16
    wVirtualScanCode: uint16
    UnicodeChar: uint16  # from uChar.UnicodeChar
    dwControlKeyState: DWORD

  INPUT_RECORD = object
    EventType: uint16
    padding: uint16
    # Only define fields we use (key events); size/layout must match
    KeyEvent: KEY_EVENT_RECORD

proc readInputRaw*(buffer: var openArray[char]): int =
  ## Read input via Windows Console API and encode as CSI u sequences
  ## Returns number of bytes written to buffer (non-blocking)
  let hStdin = GetStdHandle(STD_INPUT_HANDLE.DWORD)
  var num: DWORD = 0
  if GetNumberOfConsoleInputEvents(hStdin, addr num) == 0 or num == 0:
    return 0

  # Read up to a small batch of records
  let toRead = (if num > 16'u32: 16'u32 else: num)
  var recs: array[16, INPUT_RECORD]
  var readCount: DWORD = 0
  if ReadConsoleInputW(hStdin, addr recs[0], toRead, addr readCount) == 0:
    return 0

  var outStr = ""

  for i in 0 ..< int(readCount):
    let r = recs[i]
    if r.EventType == KEY_EVENT.uint16:
      let ke = r.KeyEvent
      var mods = 0
      if (ke.dwControlKeyState and SHIFT_PRESSED.DWORD) != 0: mods = mods or 0x1
      if (ke.dwControlKeyState and (LEFT_ALT_PRESSED.DWORD or RIGHT_ALT_PRESSED.DWORD)) != 0: mods = mods or 0x2
      if (ke.dwControlKeyState and (LEFT_CTRL_PRESSED.DWORD or RIGHT_CTRL_PRESSED.DWORD)) != 0: mods = mods or 0x4
      # Super/Win key not exposed here; leave bit 0x8 unset

      var action = 0
      if ke.bKeyDown != 0:
        if ke.wRepeatCount > 1'u16: action = 2 else: action = 1
      else:
        action = 3

      # Determine key code: prefer Unicode char if available
      var keyCode = int(ke.UnicodeChar)
      if keyCode == 0:
        # Map a few common virtual keys
        case ke.wVirtualKeyCode
        of 0x1B'u16: keyCode = 27      # VK_ESCAPE
        of 0x0D'u16: keyCode = 13      # VK_RETURN
        of 0x08'u16: keyCode = 127     # VK_BACK (map to DEL-like backspace consistent with parser)
        of 0x09'u16: keyCode = 9       # VK_TAB
        else: discard

      if keyCode != 0:
        # Emit CSI u: \e[<key>;<mods+1>;<action>u
        outStr.add("\e[")
        outStr.add($keyCode)
        outStr.add(";")
        outStr.add($(mods + 1))
        outStr.add(";")
        outStr.add($action)
        outStr.add("u")

  # Copy to caller buffer
  let ncopy = min(outStr.len, buffer.len)
  for i in 0 ..< ncopy:
    buffer[i] = outStr[i]
  return ncopy

proc setupSignalHandlers*(handler: proc(sig: cint) {.noconv.}) =
  ## Set up signal handlers for graceful shutdown
  ## 
  ## MINIMAL IMPLEMENTATION: Windows signal handling is different
  ## For now, this is a stub. A full implementation would use
  ## SetConsoleCtrlHandler to handle CTRL_C_EVENT, etc.
  
  # TODO: Implement Windows-specific signal handling
  # For now, Ctrl+C will still work via default handler
  discard
