## POSIX-specific terminal operations
## This module handles raw terminal mode, input reading, and terminal control
## for Unix-like systems (Linux, macOS, BSD, etc.)

import posix, termios

type
  TerminalState* = object
    ## Stores the original terminal state for restoration
    oldTermios: Termios
    isRawMode: bool

var globalTerminalState: TerminalState

proc setupRawMode*(): TerminalState =
  ## Configure terminal for raw mode (no echo, no line buffering)
  ## Returns the terminal state for later restoration
  result.isRawMode = false
  
  discard tcGetAttr(STDIN_FILENO, addr result.oldTermios)
  var raw = result.oldTermios
  
  # Disable canonical mode, echo, and special signal processing
  raw.c_lflag = raw.c_lflag and not(ECHO or ICANON or IEXTEN)
  
  # Disable software flow control and CR/NL translation
  raw.c_iflag = raw.c_iflag and not(IXON or ICRNL or BRKINT or INPCK or ISTRIP)
  
  # Disable output processing
  raw.c_oflag = raw.c_oflag and not(OPOST)
  
  # Set minimum characters and timeout for non-blocking reads
  raw.c_cc[VMIN] = 0.char
  raw.c_cc[VTIME] = 0.char
  
  discard tcSetAttr(STDIN_FILENO, TCSAFLUSH, addr raw)
  result.isRawMode = true
  
  globalTerminalState = result

proc restoreTerminal*(state: TerminalState) =
  ## Restore terminal to its original state
  if state.isRawMode:
    discard tcSetAttr(STDIN_FILENO, TCSAFLUSH, unsafeAddr state.oldTermios)

proc restoreTerminal*() =
  ## Restore terminal using the global state
  restoreTerminal(globalTerminalState)

proc hideCursor*() =
  ## Hide the terminal cursor
  stdout.write("\e[?25l")
  stdout.flushFile()

proc showCursor*() =
  ## Show the terminal cursor
  stdout.write("\e[?25h")
  stdout.flushFile()

proc clearScreen*() =
  ## Clear the entire screen and move cursor to home
  stdout.write("\e[2J\e[H")
  stdout.flushFile()

proc enableMouseReporting*() =
  ## Enable SGR mouse reporting mode (1006)
  ## This provides better mouse coordinate reporting
  stdout.write("\e[?1006h\e[?1000h")
  stdout.flushFile()

proc disableMouseReporting*() =
  ## Disable mouse reporting
  stdout.write("\e[?1006l\e[?1000l")
  stdout.flushFile()

proc enableKeyboardProtocol*() =
  ## Enable enhanced keyboard protocol (CSI u mode)
  ## This allows proper detection of key presses with modifiers
  stdout.write("\e[>1u")
  stdout.flushFile()

proc disableKeyboardProtocol*() =
  ## Disable enhanced keyboard protocol
  stdout.write("\e[<u")
  stdout.flushFile()

proc getTermSize*(): (int, int) =
  ## Get the current terminal size (width, height)
  ## Returns (80, 24) as fallback if detection fails
  var ws: IOctl_WinSize
  if ioctl(STDOUT_FILENO, TIOCGWINSZ, addr ws) != -1:
    return (ws.ws_col.int, ws.ws_row.int)
  return (80, 24)

proc readInputRaw*(buffer: var openArray[char]): int =
  ## Read raw input from stdin without blocking
  ## Returns the number of bytes read, or 0 if no input available
  var fds: TFdSet
  FD_ZERO(fds)
  FD_SET(STDIN_FILENO, fds)
  var tv = Timeval(tv_sec: posix.Time(0), tv_usec: 0)
  
  if select(STDIN_FILENO + 1, addr fds, nil, nil, addr tv) > 0:
    let bytesRead = read(STDIN_FILENO, addr buffer[0], buffer.len)
    if bytesRead > 0:
      return bytesRead
  
  return 0

proc setupSignalHandlers*(handler: proc(sig: cint) {.noconv.}) =
  ## Set up signal handlers for graceful shutdown
  signal(SIGINT, handler)
  signal(SIGTERM, handler)
