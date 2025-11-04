{.passL: "-static".}
{.passL: "-lm".}
{.passL: "-ldl".}
{.passL: "-llua5.3".}

import strutils, tables, os, parseopt, times, posix, termios, json
import nimLUA

const bundledStoryFile {.strdefine.} = ""
const bundledCanvasFile {.strdefine.} = ""

const defaultMarkdown = """
---
title: "Storie"
author: "Maddest Labs"
minWidth: 80
minHeight: 24
---

# Introduction

Welcome to **Storie** - a Markdown-based interactive story engine.

This is the default view: all sections rendered top to bottom as scrollable Markdown.

You can scroll with arrow keys, navigate links with Tab, and press Enter to follow links.

**Press ESC or Ctrl+C to exit at any time.**

Try this [example link](#section_2) to navigate to another section!

Here's [another link](#section_3) you can try.

# Another Section

This is section 2 - you navigated here using a link!

Try going back to the [introduction](#section_1).

# Third Section

This is section 3. Navigate back to [section 1](#section_1) or [section 2](#section_2).
"""

const
  version = "0.3.0"
  DEFAULT_MIN_WIDTH = 40
  DEFAULT_MIN_HEIGHT = 20

# Box drawing characters (using strings since Unicode won't fit in char)
const
  BoxChars = (
    topLeft: "┌",
    topRight: "┐",
    bottomLeft: "└",
    bottomRight: "┘",
    horizontal: "─",
    vertical: "│",
    tJoin: "┬",
    bJoin: "┴",
    lJoin: "├",
    rJoin: "┤",
    cross: "┼"
  )

type
  Cell = object
    ch: string  # Changed from char to string to support UTF-8
    fg: int
    bg: int
    bold: bool
    underline: bool
    italic: bool
    dim: bool
    reverse: bool

  TermBuffer = object
    width, height: int
    cells: seq[Cell]

  Style = object
    fg: int
    bg: int
    bold: bool
    underline: bool
    italic: bool
    dim: bool
    reverse: bool

  MarkdownElement = object
    text: string
    bold: bool
    italic: bool
    isLink: bool
    linkUrl: string

  EventType = enum
    OnStartup, OnShutdown, OnEnter, OnExit, OnKey, OnUpdate, OnRender

  ContentBlockKind = enum
    TextBlock, CodeBlock, HeadingBlock

  ContentBlock = object
    case kind: ContentBlockKind
    of TextBlock:
      text: string
      elements: seq[MarkdownElement]  # Parsed markdown elements
    of CodeBlock:
      language: string
      code: string
      metadata: string
    of HeadingBlock:
      level: int
      title: string

  Section = object
    id: string
    title: string
    level: int
    blocks: seq[ContentBlock]
    scripts: Table[EventType, string]
    position: JsonNode

  StoryContent = object
    metadata: JsonNode
    globalCode: string
    modules: Table[string, string]
    sections: seq[Section]

  MouseEventType = enum
    MouseDown, MouseUp, MouseMove, MouseDrag, ScrollUp, ScrollDown

  MouseEvent = object
    eventType: MouseEventType
    x, y: int
    button: int

  KeyInfo = object
    name: string      # Normalized key name like "enter", "tab", "f1"
    char: string      # The actual character (empty for special keys)
    code: int         # ASCII/scan code
    ctrl: bool        # Modifier flags
    alt: bool
    shift: bool

# Default styles
var defaultStyles = {
  "default": Style(fg: 37, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false),
  "heading": Style(fg: 33, bg: 0, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "code": Style(fg: 36, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false),
  "error": Style(fg: 31, bg: 0, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "success": Style(fg: 32, bg: 0, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "warning": Style(fg: 33, bg: 0, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "info": Style(fg: 34, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false),
  "link": Style(fg: 34, bg: 0, bold: false, underline: true, italic: false, dim: false, reverse: false),
  "button": Style(fg: 37, bg: 44, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "disabled": Style(fg: 37, bg: 0, bold: false, underline: false, italic: false, dim: true, reverse: false),
  "highlight": Style(fg: 30, bg: 47, bold: true, underline: false, italic: false, dim: false, reverse: false),
  "border": Style(fg: 36, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false)
}.toTable

var
  termWidth = 80
  termHeight = 24
  prevTermWidth = 80
  prevTermHeight = 24
  offsetX = 0
  offsetY = 0
  oldTermios: Termios
  currentBuffer: TermBuffer
  previousBuffer: TermBuffer
  running = true
  story: StoryContent
  currentSectionIdx = 0
  scrollY = 0
  luaState: PState
  multiSectionRenderMode = false
  minRequiredWidth = DEFAULT_MIN_WIDTH
  minRequiredHeight = DEFAULT_MIN_HEIGHT
  viewportChanged = false
  mouseEnabled = false
  lastMouseEvent: MouseEvent
  mouseX = 0
  mouseY = 0
  mouseButton = 0
  mousePressed = false
  linkPositions: seq[tuple[x, y: int, url: string]]
  currentLinkIndex = -1
  totalContentHeight = 0

proc restoreTerminal()

proc setupRawMode() =
  discard tcGetAttr(STDIN_FILENO, addr oldTermios)
  var raw = oldTermios
  raw.c_lflag = raw.c_lflag and not(ECHO or ICANON or ISIG or IEXTEN)
  raw.c_iflag = raw.c_iflag and not(IXON or ICRNL or BRKINT or INPCK or ISTRIP)
  raw.c_oflag = raw.c_oflag and not(OPOST)
  raw.c_cc[VMIN] = 0.char
  raw.c_cc[VTIME] = 0.char
  discard tcSetAttr(STDIN_FILENO, TCSAFLUSH, addr raw)

proc emergencyExit() {.noconv.} =
  restoreTerminal()
  echo "\nInterrupted by user"
  quit(130)

proc setupSignalHandler() =
  proc signalHandler(sig: cint) {.noconv.} =
    running = false
    emergencyExit()
  signal(SIGINT, signalHandler)
  signal(SIGTERM, signalHandler)

proc enableMouseTracking() =
  stdout.write("\e[?1000h")  # Enable mouse click tracking
  stdout.write("\e[?1002h")  # Enable mouse drag tracking
  stdout.write("\e[?1006h")  # Enable SGR mouse mode
  stdout.flushFile()
  mouseEnabled = true

proc disableMouseTracking() =
  if mouseEnabled:
    stdout.write("\e[?1000l")
    stdout.write("\e[?1002l")
    stdout.write("\e[?1006l")
    stdout.flushFile()
    mouseEnabled = false

proc restoreTerminal() =
  disableMouseTracking()
  discard tcSetAttr(STDIN_FILENO, TCSAFLUSH, addr oldTermios)
  stdout.write("\e[?25h\e[0m\e[2J\e[H")
  stdout.flushFile()

proc hideCursor() =
  stdout.write("\e[?25l")
  stdout.flushFile()

proc showCursor() =
  stdout.write("\e[?25h")
  stdout.flushFile()

proc setCursorPos(x, y: int) =
  stdout.write("\e[" & $(y + 1) & ";" & $(x + 1) & "H")
  stdout.flushFile()

proc clearScreen() =
  stdout.write("\e[2J\e[H")
  stdout.flushFile()

proc getTermSize(): (int, int) =
  var ws: IOctl_WinSize
  if ioctl(STDOUT_FILENO, TIOCGWINSZ, addr ws) != -1:
    return (ws.ws_col.int, ws.ws_row.int)
  return (80, 24)

proc parseMouseEvent(buf: string): MouseEvent =
  # Parse SGR mouse format: \e[<b;x;y[Mm]
  result.eventType = MouseMove
  result.button = 0
  result.x = 0
  result.y = 0
  
  if buf.len < 6:
    return
  
  let parts = buf[3..^2].split(';')
  if parts.len < 3:
    return
  
  try:
    let b = parseInt(parts[0])
    result.x = parseInt(parts[1]) - 1  # Convert to 0-based
    result.y = parseInt(parts[2]) - 1
    
    let isRelease = buf[^1] == 'm'
    
    if (b and 64) != 0:  # Scroll wheel
      if (b and 1) != 0:
        result.eventType = ScrollDown
      else:
        result.eventType = ScrollUp
    elif isRelease:
      result.eventType = MouseUp
      result.button = b and 3
    elif (b and 32) != 0:  # Drag
      result.eventType = MouseDrag
      result.button = b and 3
    else:  # Press
      result.eventType = MouseDown
      result.button = b and 3
  except:
    discard

proc getKey(): char =
  var fds: TFdSet
  FD_ZERO(fds)
  FD_SET(STDIN_FILENO, fds)
  var tv = Timeval(tv_sec: posix.Time(0), tv_usec: 0)
  if select(STDIN_FILENO + 1, addr fds, nil, nil, addr tv) > 0:
    var c: char
    if read(STDIN_FILENO, addr c, 1) == 1:
      return c
  return '\0'

proc normalizeKey(key: char, escSeq: string = ""): KeyInfo =
  ## Convert raw key input into a normalized KeyInfo structure
  result.code = key.ord
  result.char = $key
  result.ctrl = false
  result.alt = false
  result.shift = false
  
  # Handle special keys
  case key
  of '\r', '\n':
    result.name = "enter"
    result.char = ""
  of '\t':
    result.name = "tab"
    result.char = ""
  of '\x1b':
    result.name = "escape"
    result.char = ""
  of '\x7f', '\x08':  # DEL or BS
    result.name = "backspace"
    result.char = ""
  of ' ':
    result.name = "space"
  of '\x01'..'\x07', '\x0B'..'\x0C', '\x0E'..'\x1A', '\x1C'..'\x1F':
    # Control characters (excluding the ones handled above)
    # Ctrl+A through Ctrl+Z (excluding handled ones)
    if key.ord >= 1 and key.ord <= 26:
      # Map to corresponding letter
      result.name = $(chr(key.ord + 64)).toLowerAscii()
      result.ctrl = true
      result.char = ""
    else:
      result.name = "ctrl"
      result.char = ""
  else:
    # Printable characters
    if key >= '!' and key <= '~':
      result.name = $key
      result.char = $key
    else:
      result.name = "unknown"
      result.char = ""

proc parseEscapeSequence(seq: string): KeyInfo =
  ## Parse escape sequences for arrow keys, function keys, etc.
  result.ctrl = false
  result.alt = false
  result.shift = false
  
  if seq.len == 0:
    result.name = "escape"
    result.char = ""
    result.code = 27
    return
  
  # Arrow keys and other CSI sequences
  if seq[0] == '[':
    if seq.len == 2:
      case seq[1]
      of 'A':
        result.name = "up"
      of 'B':
        result.name = "down"
      of 'C':
        result.name = "right"
      of 'D':
        result.name = "left"
      of 'H':
        result.name = "home"
      of 'F':
        result.name = "end"
      of 'Z':
        result.name = "tab"
        result.shift = true
      else:
        result.name = "unknown"
    elif seq.len >= 3:
      # Check for modified keys or function keys
      if seq[1] == '1' and seq.len >= 4 and seq[2] == ';':
        # Modified key (e.g., \e[1;2Z = Shift+Tab)
        let modifier = seq[3]
        case modifier
        of '2':
          result.shift = true
        of '3':
          result.alt = true
        of '4':
          result.shift = true
          result.alt = true
        of '5':
          result.ctrl = true
        of '6':
          result.ctrl = true
          result.shift = true
        of '7':
          result.ctrl = true
          result.alt = true
        of '8':
          result.ctrl = true
          result.shift = true
          result.alt = true
        else:
          discard
        
        # Get the actual key
        if seq.len >= 5:
          case seq[4]
          of 'A':
            result.name = "up"
          of 'B':
            result.name = "down"
          of 'C':
            result.name = "right"
          of 'D':
            result.name = "left"
          of 'Z':
            result.name = "tab"
          else:
            result.name = "unknown"
        else:
          result.name = "unknown"
      elif seq[^1] == '~':
        # Function keys and other special keys
        let keyNum = seq[1..^2]
        case keyNum
        of "1", "7":
          result.name = "home"
        of "2":
          result.name = "insert"
        of "3":
          result.name = "delete"
        of "4", "8":
          result.name = "end"
        of "5":
          result.name = "pageup"
        of "6":
          result.name = "pagedown"
        of "11":
          result.name = "f1"
        of "12":
          result.name = "f2"
        of "13", "25":
          result.name = "f3"
        of "14", "26":
          result.name = "f4"
        of "15", "28":
          result.name = "f5"
        of "17", "29":
          result.name = "f6"
        of "18", "31":
          result.name = "f7"
        of "19", "32":
          result.name = "f8"
        of "20", "33":
          result.name = "f9"
        of "21", "34":
          result.name = "f10"
        of "23":
          result.name = "f11"
        of "24":
          result.name = "f12"
        else:
          result.name = "unknown"
      else:
        result.name = "unknown"
    else:
      result.name = "unknown"
  elif seq[0] == 'O':
    # Some terminals use SS3 for function keys
    if seq.len == 2:
      case seq[1]
      of 'P':
        result.name = "f1"
      of 'Q':
        result.name = "f2"
      of 'R':
        result.name = "f3"
      of 'S':
        result.name = "f4"
      of 'H':
        result.name = "home"
      of 'F':
        result.name = "end"
      else:
        result.name = "unknown"
    else:
      result.name = "unknown"
  else:
    result.name = "unknown"
  
  result.char = ""
  result.code = 0

proc pushKeyInfoToLua(L: PState, keyInfo: KeyInfo) =
  ## Push a KeyInfo object to Lua as a table
  L.createTable(0, 6)
  
  # name
  discard L.pushString(cstring(keyInfo.name))
  L.setField(-2, cstring("name"))
  
  # char
  discard L.pushString(cstring(keyInfo.char))
  L.setField(-2, cstring("char"))
  
  # code
  L.pushInteger(keyInfo.code)
  L.setField(-2, cstring("code"))
  
  # ctrl
  L.pushBoolean(cint(keyInfo.ctrl))
  L.setField(-2, cstring("ctrl"))
  
  # alt
  L.pushBoolean(cint(keyInfo.alt))
  L.setField(-2, cstring("alt"))
  
  # shift
  L.pushBoolean(cint(keyInfo.shift))
  L.setField(-2, cstring("shift"))

proc readInputSequence(): string =
  result = ""
  var c = getKey()
  while c != '\0':
    result.add(c)
    if c == 'M' or c == 'm':  # Mouse event terminators
      break
    if result.len > 20:  # Safety limit
      break
    c = getKey()

proc newTermBuffer(w, h: int): TermBuffer =
  result.width = w
  result.height = h
  result.cells = newSeq[Cell](w * h)
  for i in 0 ..< result.cells.len:
    result.cells[i] = Cell(ch: " ", fg: 37, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false)

proc write(tb: var TermBuffer, x, y: int, ch: string, fg: int, bg: int = 0, bold: bool = false, underline: bool = false, italic: bool = false, dim: bool = false, reverse: bool = false) =
  if x >= 0 and x < tb.width and y >= 0 and y < tb.height:
    let idx = y * tb.width + x
    tb.cells[idx] = Cell(ch: ch, fg: fg, bg: bg, bold: bold, underline: underline, italic: italic, dim: dim, reverse: reverse)

proc writeWithStyle(tb: var TermBuffer, x, y: int, ch: string, style: Style) =
  tb.write(x, y, ch, style.fg, style.bg, style.bold, style.underline, style.italic, style.dim, style.reverse)

proc writeText(tb: var TermBuffer, x, y: int, text: string, fg: int, bg: int = 0, bold: bool = false, underline: bool = false, italic: bool = false, dim: bool = false, reverse: bool = false) =
  var currentX = x
  var i = 0
  while i < text.len and currentX < tb.width:
    # Check if this is a UTF-8 multi-byte character
    let b = text[i].ord
    var charLen = 1
    var ch = ""
    
    if (b and 0x80) == 0:
      # Single byte (ASCII)
      ch = $text[i]
      charLen = 1
    elif (b and 0xE0) == 0xC0:
      # 2-byte UTF-8
      if i + 1 < text.len:
        ch = text[i..i+1]
        charLen = 2
    elif (b and 0xF0) == 0xE0:
      # 3-byte UTF-8
      if i + 2 < text.len:
        ch = text[i..i+2]
        charLen = 3
    elif (b and 0xF8) == 0xF0:
      # 4-byte UTF-8
      if i + 3 < text.len:
        ch = text[i..i+3]
        charLen = 4
    else:
      # Invalid UTF-8 or continuation byte, skip
      ch = "?"
      charLen = 1
    
    tb.write(currentX, y, ch, fg, bg, bold, underline, italic, dim, reverse)
    currentX += 1
    i += charLen

proc writeTextWithStyle(tb: var TermBuffer, x, y: int, text: string, style: Style) =
  var currentX = x
  var i = 0
  while i < text.len and currentX < tb.width:
    # Check if this is a UTF-8 multi-byte character
    let b = text[i].ord
    var charLen = 1
    var ch = ""
    
    if (b and 0x80) == 0:
      # Single byte (ASCII)
      ch = $text[i]
      charLen = 1
    elif (b and 0xE0) == 0xC0:
      # 2-byte UTF-8
      if i + 1 < text.len:
        ch = text[i..i+1]
        charLen = 2
    elif (b and 0xF0) == 0xE0:
      # 3-byte UTF-8
      if i + 2 < text.len:
        ch = text[i..i+2]
        charLen = 3
    elif (b and 0xF8) == 0xF0:
      # 4-byte UTF-8
      if i + 3 < text.len:
        ch = text[i..i+3]
        charLen = 4
    else:
      # Invalid UTF-8 or continuation byte, skip
      ch = "?"
      charLen = 1
    
    tb.writeWithStyle(currentX, y, ch, style)
    currentX += 1
    i += charLen

proc fillRect(tb: var TermBuffer, x, y, w, h: int, ch: string, fg: int, bg: int = 0, bold: bool = false, underline: bool = false, italic: bool = false, dim: bool = false, reverse: bool = false) =
  for dy in 0 ..< h:
    for dx in 0 ..< w:
      tb.write(x + dx, y + dy, ch, fg, bg, bold, underline, italic, dim, reverse)

proc fillRectWithStyle(tb: var TermBuffer, x, y, w, h: int, ch: string, style: Style) =
  for dy in 0 ..< h:
    for dx in 0 ..< w:
      tb.writeWithStyle(x + dx, y + dy, ch, style)

proc drawBox(tb: var TermBuffer, x, y, w, h: int, style: Style) =
  if w < 2 or h < 2:
    return
  
  # Top edge
  tb.writeTextWithStyle(x, y, BoxChars.topLeft, style)
  for i in 1..<w-1:
    tb.writeTextWithStyle(x + i, y, BoxChars.horizontal, style)
  tb.writeTextWithStyle(x + w - 1, y, BoxChars.topRight, style)
  
  # Sides
  for i in 1..<h-1:
    tb.writeTextWithStyle(x, y + i, BoxChars.vertical, style)
    tb.writeTextWithStyle(x + w - 1, y + i, BoxChars.vertical, style)
  
  # Bottom edge
  tb.writeTextWithStyle(x, y + h - 1, BoxChars.bottomLeft, style)
  for i in 1..<w-1:
    tb.writeTextWithStyle(x + i, y + h - 1, BoxChars.horizontal, style)
  tb.writeTextWithStyle(x + w - 1, y + h - 1, BoxChars.bottomRight, style)

proc drawRect(tb: var TermBuffer, x, y, w, h: int, fg: int, bg: int = 0, bold: bool = false) =
  # Legacy compatibility version using simple ASCII characters
  if w < 2 or h < 2:
    return
  # Top and bottom edges
  for dx in 0 ..< w:
    tb.write(x + dx, y, "-", fg, bg, bold)
    tb.write(x + dx, y + h - 1, "-", fg, bg, bold)
  # Left and right edges
  for dy in 0 ..< h:
    tb.write(x, y + dy, "|", fg, bg, bold)
    tb.write(x + w - 1, y + dy, "|", fg, bg, bold)
  # Corners
  tb.write(x, y, "+", fg, bg, bold)
  tb.write(x + w - 1, y, "+", fg, bg, bold)
  tb.write(x, y + h - 1, "+", fg, bg, bold)
  tb.write(x + w - 1, y + h - 1, "+", fg, bg, bold)

proc drawLine(tb: var TermBuffer, x1, y1, x2, y2: int, ch: string, style: Style) =
  if y1 == y2:
    # Horizontal line
    let startX = min(x1, x2)
    let endX = max(x1, x2)
    for x in startX..endX:
      tb.writeWithStyle(x, y1, ch, style)
  elif x1 == x2:
    # Vertical line
    let startY = min(y1, y2)
    let endY = max(y1, y2)
    for y in startY..endY:
      tb.writeWithStyle(x1, y, ch, style)

proc clear(tb: var TermBuffer) =
  for i in 0 ..< tb.cells.len:
    tb.cells[i] = Cell(ch: " ", fg: 37, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false)

proc buildStyleCode(cell: Cell): string =
  result = "\e["
  var codes: seq[string] = @[]
  
  # Reset first
  codes.add("0")
  
  # Text attributes
  if cell.bold:
    codes.add("1")
  if cell.dim:
    codes.add("2")
  if cell.italic:
    codes.add("3")
  if cell.underline:
    codes.add("4")
  if cell.reverse:
    codes.add("7")
  
  # Foreground color
  codes.add($cell.fg)
  
  # Background color
  if cell.bg != 0:
    codes.add($(cell.bg + 10))  # Background colors are +10 from foreground
  
  result.add(codes.join(";") & "m")

proc cellsEqual(a, b: Cell): bool =
  a.ch == b.ch and a.fg == b.fg and a.bg == b.bg and 
  a.bold == b.bold and a.underline == b.underline and 
  a.italic == b.italic and a.dim == b.dim and a.reverse == b.reverse

proc display(tb: var TermBuffer, prev: var TermBuffer) =
  var output = newStringOfCap(tb.width * tb.height * 2)
  var lastStyle = ""
  let sizeChanged = prev.width != tb.width or prev.height != tb.height
  
  if sizeChanged:
    output.add("\e[2J")
    prev = newTermBuffer(tb.width, tb.height)
  
  for y in 0 ..< tb.height:
    var x = 0
    while x < tb.width:
      let idx = y * tb.width + x
      let cell = tb.cells[idx]
      
      if not sizeChanged and prev.cells.len > 0 and idx < prev.cells.len and
         cellsEqual(prev.cells[idx], cell):
        x += 1
        continue
      
      # Find run of cells with same style
      var runLength = 1
      while x + runLength < tb.width:
        let nextIdx = idx + runLength
        let nextCell = tb.cells[nextIdx]
        
        if not sizeChanged and prev.cells.len > 0 and nextIdx < prev.cells.len and
           cellsEqual(prev.cells[nextIdx], nextCell):
          break
        
        if not cellsEqual(cell, nextCell):
          # Check if only character differs (same style)
          if nextCell.fg == cell.fg and nextCell.bg == cell.bg and
             nextCell.bold == cell.bold and nextCell.underline == cell.underline and
             nextCell.italic == cell.italic and nextCell.dim == cell.dim and
             nextCell.reverse == cell.reverse:
            runLength += 1
          else:
            break
        else:
          runLength += 1
      
      # Position cursor
      output.add("\e[" & $(y + 1) & ";" & $(x + 1) & "H")
      
      # Apply style
      let styleCode = buildStyleCode(cell)
      if styleCode != lastStyle:
        output.add(styleCode)
        lastStyle = styleCode
      
      # Write characters
      for i in 0 ..< runLength:
        output.add(tb.cells[idx + i].ch)
      
      x += runLength
  
  stdout.write(output)
  stdout.flushFile()

# Lua API functions

proc luaBufferWrite(L: PState): cint {.cdecl.} =
  let x = L.toInteger(2)
  let y = L.toInteger(3)
  let text = L.toString(4)
  let fg = if L.getTop() >= 5: L.toInteger(5) else: 37
  let bg = if L.getTop() >= 6: L.toInteger(6) else: 0
  let bold = if L.getTop() >= 7: L.toBoolean(7) != 0 else: false
  let underline = if L.getTop() >= 8: L.toBoolean(8) != 0 else: false
  let italic = if L.getTop() >= 9: L.toBoolean(9) != 0 else: false
  let dim = if L.getTop() >= 10: L.toBoolean(10) != 0 else: false
  let reverse = if L.getTop() >= 11: L.toBoolean(11) != 0 else: false
  currentBuffer.writeText(x, y, text, fg, bg, bold, underline, italic, dim, reverse)
  return 0

proc luaBufferWriteStyled(L: PState): cint {.cdecl.} =
  let x = L.toInteger(2)
  let y = L.toInteger(3)
  let text = L.toString(4)
  let styleName = L.toString(5)
  
  if defaultStyles.hasKey(styleName):
    let style = defaultStyles[styleName]
    currentBuffer.writeTextWithStyle(x, y, text, style)
  else:
    # Fallback to default style
    currentBuffer.writeTextWithStyle(x, y, text, defaultStyles["default"])
  return 0

proc luaBufferClear(L: PState): cint {.cdecl.} =
  currentBuffer.clear()
  return 0

proc luaBufferDrawLine(L: PState): cint {.cdecl.} =
  let x1 = L.toInteger(2)
  let y1 = L.toInteger(3)
  let x2 = L.toInteger(4)
  let y2 = L.toInteger(5)
  let ch = if L.getTop() >= 6: L.toString(6) else: "-"
  let styleName = if L.getTop() >= 7: L.toString(7) else: "default"
  
  let style = if defaultStyles.hasKey(styleName): defaultStyles[styleName] else: defaultStyles["default"]
  currentBuffer.drawLine(x1, y1, x2, y2, ch, style)
  return 0

proc luaBufferDrawRect(L: PState): cint {.cdecl.} =
  let x = L.toInteger(2)
  let y = L.toInteger(3)
  let w = L.toInteger(4)
  let h = L.toInteger(5)
  
  # Check if using old API (color codes) or new API (style name)
  if L.getTop() >= 6:
    if L.isString(6) != 0:
      # New API: style name
      let styleName = L.toString(6)
      let style = if defaultStyles.hasKey(styleName): defaultStyles[styleName] else: defaultStyles["border"]
      currentBuffer.drawBox(x, y, w, h, style)
    else:
      # Old API: color code - use ASCII drawRect
      let fg = L.toInteger(6)
      let bg = if L.getTop() >= 7: L.toInteger(7) else: 0
      let bold = if L.getTop() >= 8: L.toBoolean(8) != 0 else: false
      currentBuffer.drawRect(x, y, w, h, fg, bg, bold)
  else:
    # Default to ASCII drawRect for backward compatibility
    currentBuffer.drawRect(x, y, w, h, 37, 0, false)
  return 0

proc luaBufferDrawBox(L: PState): cint {.cdecl.} =
  let x = L.toInteger(2)
  let y = L.toInteger(3)
  let w = L.toInteger(4)
  let h = L.toInteger(5)
  let styleName = if L.getTop() >= 6: L.toString(6) else: "border"
  
  let style = if defaultStyles.hasKey(styleName): defaultStyles[styleName] else: defaultStyles["border"]
  currentBuffer.drawBox(x, y, w, h, style)
  return 0

proc luaBufferFillRect(L: PState): cint {.cdecl.} =
  let x = L.toInteger(2)
  let y = L.toInteger(3)
  let w = L.toInteger(4)
  let h = L.toInteger(5)
  let ch = if L.getTop() >= 6: L.toString(6) else: " "
  
  # Check if using style name or color codes
  if L.getTop() >= 7:
    if L.isString(7) != 0:
      # New API: style name
      let styleName = L.toString(7)
      let style = if defaultStyles.hasKey(styleName): defaultStyles[styleName] else: defaultStyles["default"]
      currentBuffer.fillRectWithStyle(x, y, w, h, ch, style)
    else:
      # Old API: color codes
      let fg = L.toInteger(7)
      let bg = if L.getTop() >= 8: L.toInteger(8) else: 0
      let bold = if L.getTop() >= 9: L.toBoolean(9) != 0 else: false
      currentBuffer.fillRect(x, y, w, h, ch, fg, bg, bold)
  else:
    currentBuffer.fillRect(x, y, w, h, ch, 37, 0)
  return 0

proc luaGetStyle(L: PState): cint {.cdecl.} =
  let styleName = L.toString(1)
  if defaultStyles.hasKey(styleName):
    let style = defaultStyles[styleName]
    L.createTable(0, 7)
    L.pushInteger(style.fg)
    L.setField(-2, cstring("fg"))
    L.pushInteger(style.bg)
    L.setField(-2, cstring("bg"))
    L.pushBoolean(cint(style.bold))
    L.setField(-2, cstring("bold"))
    L.pushBoolean(cint(style.underline))
    L.setField(-2, cstring("underline"))
    L.pushBoolean(cint(style.italic))
    L.setField(-2, cstring("italic"))
    L.pushBoolean(cint(style.dim))
    L.setField(-2, cstring("dim"))
    L.pushBoolean(cint(style.reverse))
    L.setField(-2, cstring("reverse"))
    return 1
  L.pushNil()
  return 1

proc luaSetStyle(L: PState): cint {.cdecl.} =
  let styleName = L.toString(1)
  if L.isTable(2):
    var style = Style(fg: 37, bg: 0, bold: false, underline: false, italic: false, dim: false, reverse: false)
    
    L.getField(2, cstring("fg"))
    if L.isNumber(-1) != 0:
      style.fg = L.toInteger(-1)
    L.pop(1)
    
    L.getField(2, cstring("bg"))
    if L.isNumber(-1) != 0:
      style.bg = L.toInteger(-1)
    L.pop(1)
    
    L.getField(2, cstring("bold"))
    if L.lua_type(-1) == LUA_TBOOLEAN:
      style.bold = L.toBoolean(-1) != 0
    L.pop(1)
    
    L.getField(2, cstring("underline"))
    if L.lua_type(-1) == LUA_TBOOLEAN:
      style.underline = L.toBoolean(-1) != 0
    L.pop(1)
    
    L.getField(2, cstring("italic"))
    if L.lua_type(-1) == LUA_TBOOLEAN:
      style.italic = L.toBoolean(-1) != 0
    L.pop(1)
    
    L.getField(2, cstring("dim"))
    if L.lua_type(-1) == LUA_TBOOLEAN:
      style.dim = L.toBoolean(-1) != 0
    L.pop(1)
    
    L.getField(2, cstring("reverse"))
    if L.lua_type(-1) == LUA_TBOOLEAN:
      style.reverse = L.toBoolean(-1) != 0
    L.pop(1)
    
    defaultStyles[styleName] = style
    L.pushBoolean(1)
    return 1
  L.pushBoolean(0)
  return 1

proc luaGetAllStyles(L: PState): cint {.cdecl.} =
  L.createTable(0, cint(defaultStyles.len))
  for name, style in defaultStyles.pairs:
    L.createTable(0, 7)
    L.pushInteger(style.fg)
    L.setField(-2, cstring("fg"))
    L.pushInteger(style.bg)
    L.setField(-2, cstring("bg"))
    L.pushBoolean(cint(style.bold))
    L.setField(-2, cstring("bold"))
    L.pushBoolean(cint(style.underline))
    L.setField(-2, cstring("underline"))
    L.pushBoolean(cint(style.italic))
    L.setField(-2, cstring("italic"))
    L.pushBoolean(cint(style.dim))
    L.setField(-2, cstring("dim"))
    L.pushBoolean(cint(style.reverse))
    L.setField(-2, cstring("reverse"))
    L.setField(-2, cstring(name))
  return 1

proc luaShowCursor(L: PState): cint {.cdecl.} =
  showCursor()
  return 0

proc luaHideCursor(L: PState): cint {.cdecl.} =
  hideCursor()
  return 0

proc luaSetCursorPos(L: PState): cint {.cdecl.} =
  let x = L.toInteger(1)
  let y = L.toInteger(2)
  setCursorPos(x, y)
  return 0

proc luaEnableMouse(L: PState): cint {.cdecl.} =
  if not mouseEnabled:
    enableMouseTracking()
  return 0

proc luaDisableMouse(L: PState): cint {.cdecl.} =
  disableMouseTracking()
  return 0

proc luaGetMouse(L: PState): cint {.cdecl.} =
  L.createTable(0, 4)
  L.pushInteger(mouseX)
  L.setField(-2, cstring("x"))
  L.pushInteger(mouseY)
  L.setField(-2, cstring("y"))
  L.pushInteger(mouseButton)
  L.setField(-2, cstring("button"))
  L.pushBoolean(cint(mousePressed))
  L.setField(-2, cstring("pressed"))
  return 1

proc luaGetViewport(L: PState): cint {.cdecl.} =
  L.createTable(0, 2)
  L.pushInteger(termWidth)
  L.setField(-2, cstring("width"))
  L.pushInteger(termHeight)
  L.setField(-2, cstring("height"))
  return 1

proc pushJsonAsLuaTable(L: PState, node: JsonNode) =
  case node.kind
  of JObject:
    L.createTable(0, cint(node.len))
    for key, val in node.pairs:
      discard L.pushString(cstring(key))
      pushJsonAsLuaTable(L, val)  # Recursive
      L.setTable(-3)
  of JArray:
    L.createTable(cint(node.len), 0)
    for i in 0..<node.len:
      pushJsonAsLuaTable(L, node[i])
      L.rawSeti(-2, cint(i + 1))
  of JString:
    discard L.pushString(cstring(node.getStr()))
  of JInt:
    L.pushInteger(node.getInt())
  of JFloat:
    L.pushNumber(node.getFloat())
  of JBool:
    L.pushBoolean(cint(node.getBool()))
  of JNull:
    L.pushNil()

proc luaGetCurrentSection(L: PState): cint {.cdecl.} =
  if currentSectionIdx < story.sections.len:
    let section = story.sections[currentSectionIdx]
    L.createTable(0, 5)
    discard pushstring(L, cstring(section.id))
    L.setField(-2, cstring("id"))
    discard pushstring(L, cstring(section.title))
    L.setField(-2, cstring("title"))
    L.pushInteger(section.level)
    L.setField(-2, cstring("level"))
    L.pushInteger(currentSectionIdx)
    L.setField(-2, cstring("index"))
    var content = ""
    for blk in section.blocks:
      case blk.kind
      of TextBlock:
        content.add(blk.text & "\n")
      of HeadingBlock:
        content.add(repeat("#", blk.level) & " " & blk.title & "\n")
      of CodeBlock:
        content.add("```" & blk.language & "\n" & blk.code & "\n```\n")
    discard pushstring(L, cstring(content))
    L.setField(-2, cstring("content"))
    if not section.position.isNil:
      pushJsonAsLuaTable(L, section.position)
      L.setField(-2, cstring("metadata"))
    return 1
  return 0

proc luaGetAllSections(L: PState): cint {.cdecl.} =
  L.createTable(cint(story.sections.len), 0)
  for i, section in story.sections:
    L.createTable(0, 6)
    discard pushstring(L, cstring(section.id))
    L.setField(-2, cstring("id"))
    discard pushstring(L, cstring(section.title))
    L.setField(-2, cstring("title"))
    L.pushInteger(section.level)
    L.setField(-2, cstring("level"))
    L.pushInteger(i)
    L.setField(-2, cstring("index"))
    var content = ""
    for blk in section.blocks:
      case blk.kind
      of TextBlock:
        content.add(blk.text & "\n")
      of HeadingBlock:
        content.add(repeat("#", blk.level) & " " & blk.title & "\n")
      of CodeBlock:
        content.add("```" & blk.language & "\n" & blk.code & "\n```\n")
    discard pushstring(L, cstring(content))
    L.setField(-2, cstring("content"))
    if not section.position.isNil:
      pushJsonAsLuaTable(L, section.position)
      L.setField(-2, cstring("metadata"))
    L.rawSeti(-2, cint(i + 1))
  return 1

proc parseMarkdownInline(text: string): seq[MarkdownElement]  # Forward declaration

proc luaGetSectionById(L: PState): cint {.cdecl.} =
  ## Get section data by ID
  if L.getTop() < 1:
    L.pushNil()
    return 1
  
  let targetId = L.toString(1)
  
  for i, section in story.sections:
    if section.id == targetId:
      L.createTable(0, 5)
      discard pushstring(L, cstring(section.id))
      L.setField(-2, cstring("id"))
      discard pushstring(L, cstring(section.title))
      L.setField(-2, cstring("title"))
      L.pushInteger(section.level)
      L.setField(-2, cstring("level"))
      L.pushInteger(i)
      L.setField(-2, cstring("index"))
      
      var content = ""
      for blk in section.blocks:
        case blk.kind
        of TextBlock:
          content.add(blk.text & "\n")
        of HeadingBlock:
          content.add(repeat("#", blk.level) & " " & blk.title & "\n")
        of CodeBlock:
          content.add("```" & blk.language & "\n" & blk.code & "\n```\n")
      discard pushstring(L, cstring(content))
      L.setField(-2, cstring("content"))
      return 1
  
  L.pushNil()
  return 1

proc luaCreateSection(L: PState): cint {.cdecl.} =
  ## Create a new section dynamically
  if L.getTop() < 3:
    L.pushBoolean(0)
    return 1
  
  let id = L.toString(1)
  let title = L.toString(2)
  let content = L.toString(3)
  let level = if L.getTop() >= 4: L.toInteger(4) else: 1
  
  # Parse the content into blocks
  var blocks: seq[ContentBlock] = @[]
  for line in content.splitLines():
    if line.strip() != "":
      let elements = parseMarkdownInline(line)
      blocks.add(ContentBlock(kind: TextBlock, text: line, elements: elements))
  
  var newSection = Section(
    id: id,
    title: title,
    level: level,
    blocks: blocks,
    scripts: initTable[EventType, string](),
    position: newJNull()
  )
  
  # Add scripts if provided as a table
  if L.getTop() >= 5 and L.isTable(5):
    # Get onEnter script
    L.getField(5, cstring("onEnter"))
    if L.isString(-1) != 0:
      newSection.scripts[OnEnter] = L.toString(-1)
    L.pop(1)
    
    # Get onExit script
    L.getField(5, cstring("onExit"))
    if L.isString(-1) != 0:
      newSection.scripts[OnExit] = L.toString(-1)
    L.pop(1)
    
    # Get onKey script
    L.getField(5, cstring("onKey"))
    if L.isString(-1) != 0:
      newSection.scripts[OnKey] = L.toString(-1)
    L.pop(1)
    
    # Get onUpdate script
    L.getField(5, cstring("onUpdate"))
    if L.isString(-1) != 0:
      newSection.scripts[OnUpdate] = L.toString(-1)
    L.pop(1)
    
    # Get onRender script
    L.getField(5, cstring("onRender"))
    if L.isString(-1) != 0:
      newSection.scripts[OnRender] = L.toString(-1)
    L.pop(1)
  
  # Add to story sections
  story.sections.add(newSection)
  
  # Return the new section's index
  L.pushInteger(story.sections.len - 1)
  return 1

proc luaDeleteSection(L: PState): cint {.cdecl.} =
  ## Delete a section by ID or index
  if L.getTop() < 1:
    L.pushBoolean(0)
    return 1
  
  var targetIdx = -1
  
  if L.isString(1) != 0:
    let targetId = L.toString(1)
    for i, section in story.sections:
      if section.id == targetId:
        targetIdx = i
        break
  elif L.isNumber(1) != 0:
    targetIdx = L.toInteger(1)
  
  if targetIdx >= 0 and targetIdx < story.sections.len:
    story.sections.delete(targetIdx)
    # Adjust current section index if needed
    if currentSectionIdx >= story.sections.len:
      currentSectionIdx = max(0, story.sections.len - 1)
    L.pushBoolean(1)
    return 1
  
  L.pushBoolean(0)
  return 1

proc luaUpdateSection(L: PState): cint {.cdecl.} =
  ## Update an existing section's content
  if L.getTop() < 2:
    L.pushBoolean(0)
    return 1
  
  # Check if second parameter is a table
  if L.lua_type(2) != LUA_TTABLE:
    L.pushBoolean(0)
    return 1
  
  var targetIdx = -1
  
  if L.isString(1) != 0:
    let targetId = L.toString(1)
    for i, section in story.sections:
      if section.id == targetId:
        targetIdx = i
        break
  elif L.isNumber(1) != 0:
    targetIdx = L.toInteger(1)
  
  if targetIdx < 0 or targetIdx >= story.sections.len:
    L.pushBoolean(0)
    return 1
  
  # Update title
  L.getField(2, cstring("title"))
  if L.isString(-1) != 0:
    story.sections[targetIdx].title = L.toString(-1)
  L.pop(1)
  
  # Update content
  L.getField(2, cstring("content"))
  if L.isString(-1) != 0:
    let content = L.toString(-1)
    var blocks: seq[ContentBlock] = @[]
    for line in content.splitLines():
      if line.strip() != "":
        let elements = parseMarkdownInline(line)
        blocks.add(ContentBlock(kind: TextBlock, text: line, elements: elements))
    story.sections[targetIdx].blocks = blocks
  L.pop(1)
  
  # Update scripts
  L.getField(2, cstring("scripts"))
  if L.lua_type(-1) == LUA_TTABLE:
    L.getField(-1, cstring("onEnter"))
    if L.isString(-1) != 0:
      story.sections[targetIdx].scripts[OnEnter] = L.toString(-1)
    L.pop(1)
    
    L.getField(-1, cstring("onExit"))
    if L.isString(-1) != 0:
      story.sections[targetIdx].scripts[OnExit] = L.toString(-1)
    L.pop(1)
    
    L.getField(-1, cstring("onKey"))
    if L.isString(-1) != 0:
      story.sections[targetIdx].scripts[OnKey] = L.toString(-1)
    L.pop(1)
    
    L.getField(-1, cstring("onUpdate"))
    if L.isString(-1) != 0:
      story.sections[targetIdx].scripts[OnUpdate] = L.toString(-1)
    L.pop(1)
    
    L.getField(-1, cstring("onRender"))
    if L.isString(-1) != 0:
      story.sections[targetIdx].scripts[OnRender] = L.toString(-1)
    L.pop(1)
  L.pop(1)
  
  L.pushBoolean(1)
  return 1

proc luaGetScrollY(L: PState): cint {.cdecl.} =
  L.pushInteger(scrollY)
  return 1

proc luaSetScrollY(L: PState): cint {.cdecl.} =
  scrollY = L.toInteger(1)
  return 0

proc luaSetMultiSectionMode(L: PState): cint {.cdecl.} =
  multiSectionRenderMode = L.toBoolean(1) != 0
  return 0

proc luaGetMultiSectionMode(L: PState): cint {.cdecl.} =
  L.pushBoolean(cint(multiSectionRenderMode))
  return 1

proc luaViewportChanged(L: PState): cint {.cdecl.} =
  L.pushBoolean(cint(viewportChanged))
  return 1

proc luaGetMinDimensions(L: PState): cint {.cdecl.} =
  L.createTable(0, 2)
  L.pushInteger(minRequiredWidth)
  L.setField(-2, cstring("width"))
  L.pushInteger(minRequiredHeight)
  L.setField(-2, cstring("height"))
  return 1

proc luaSaveStory(L: PState): cint {.cdecl.} =
  L.getGlobal(cstring("storyState"))
  if L.isTable(-1):
    var data = newJObject()
    L.pushNil()
    while L.next(-2) != 0:
      if L.isString(-2) != 0:
        let key = L.toString(-2)
        case L.lua_type(-1)
        of LUA_TSTRING:
          data[key] = newJString(L.toString(-1))
        of LUA_TNUMBER:
          data[key] = newJFloat(L.toNumber(-1))
        of LUA_TBOOLEAN:
          data[key] = newJBool(L.toBoolean(-1) != 0)
        else:
          discard
      L.pop(1)
    writeFile("storystate.json", $data)
    L.pushBoolean(1)
  else:
    L.pushBoolean(0)
  return 1

proc luaLoadStory(L: PState): cint {.cdecl.} =
  if not fileExists("storystate.json"):
    L.pushBoolean(0)
    return 1
  try:
    let jsonContent = readFile("storystate.json")
    let data = parseJson(jsonContent)
    L.createTable(0, 10)
    for key, val in data.pairs:
      case val.kind
      of JString:
        discard L.pushString(cstring(val.getStr()))
      of JInt:
        L.pushNumber(val.getInt().float)
      of JFloat:
        L.pushNumber(val.getFloat())
      of JBool:
        L.pushBoolean(cint(val.getBool()))
      else:
        L.pushNil()
      L.setField(-2, cstring(key))
    L.setGlobal(cstring("storyState"))
    L.pushBoolean(1)
  except:
    L.pushBoolean(0)
  return 1

proc luaHasSavedStory(L: PState): cint {.cdecl.} =
  L.pushBoolean(cint(fileExists("storystate.json")))
  return 1

proc luaGotoSection(L: PState): cint {.cdecl.} =
  var targetIdx = -1
  if L.isString(1) != 0:
    let targetId = L.toString(1)
    for i, section in story.sections:
      if section.id == targetId:
        targetIdx = i
        break
  elif L.isNumber(1) != 0:
    targetIdx = L.toInteger(1)
  if targetIdx >= 0 and targetIdx < story.sections.len:
    if currentSectionIdx < story.sections.len:
      let oldSection = story.sections[currentSectionIdx]
      if oldSection.scripts.hasKey(OnExit):
        if luaState.doString(oldSection.scripts[OnExit]) != 0:
          let err = luaState.toString(-1)
          stderr.writeLine("\nScript error in OnExit: ", err)
          luaState.pop(1)
    currentSectionIdx = targetIdx
    let section = story.sections[targetIdx]
    if section.scripts.hasKey(OnEnter):
      if luaState.doString(section.scripts[OnEnter]) != 0:
        let err = luaState.toString(-1)
        stderr.writeLine("\nScript error in OnEnter: ", err)
        luaState.pop(1)
    L.pushBoolean(1)
    return 1
  L.pushBoolean(0)
  return 1

var loadedModules: Table[string, bool]

proc luaCustomRequire(L: PState): cint {.cdecl.} =
  let moduleName = L.toString(1)
  if loadedModules.hasKey(moduleName):
    L.getGlobal(cstring("_LOADED_" & moduleName))
    return 1
  if story.modules.hasKey(moduleName):
    let code = story.modules[moduleName]
    if L.loadString(cstring(code)) == 0:
      if L.pcall(0, 1, 0) == 0:
        loadedModules[moduleName] = true
        L.pushValue(-1)
        L.setGlobal(cstring("_LOADED_" & moduleName))
        return 1
      else:
        let err = L.toString(-1)
        discard L.pushString(cstring("Error executing module '" & moduleName & "': " & err))
        discard L.error()
    else:
      let err = L.toString(-1)
      discard L.pushString(cstring("Error loading module '" & moduleName & "': " & err))
      discard L.error()
  # Check filesystem for .lua file
  let luaFile = moduleName & ".lua"
  if fileExists(luaFile):
    try:
      let code = readFile(luaFile)
      if L.loadString(cstring(code)) == 0:
        if L.pcall(0, 1, 0) == 0:
          loadedModules[moduleName] = true
          L.pushValue(-1)
          L.setGlobal(cstring("_LOADED_" & moduleName))
          return 1
        else:
          let err = L.toString(-1)
          discard L.pushString(cstring("Error executing module '" & moduleName & "': " & err))
          discard L.error()
      else:
        let err = L.toString(-1)
        discard L.pushString(cstring("Error loading module '" & moduleName & "': " & err))
        discard L.error()
    except IOError:
      discard  # Fall through to "not found"
  discard L.pushString(cstring("Module not found: " & moduleName))
  discard L.error()
  return 0

proc initLuaState(): PState =
  result = newState()
  result.openLibs()
  
  # Buffer metatable
  discard result.newMetatable("buffer")
  discard result.pushString("write")
  result.pushCFunction(luaBufferWrite)
  result.setTable(-3)
  discard result.pushString("writeStyled")
  result.pushCFunction(luaBufferWriteStyled)
  result.setTable(-3)
  discard result.pushString("clear")
  result.pushCFunction(luaBufferClear)
  result.setTable(-3)
  discard result.pushString("drawLine")
  result.pushCFunction(luaBufferDrawLine)
  result.setTable(-3)
  discard result.pushString("drawRect")
  result.pushCFunction(luaBufferDrawRect)
  result.setTable(-3)
  discard result.pushString("drawBox")
  result.pushCFunction(luaBufferDrawBox)
  result.setTable(-3)
  discard result.pushString("fillRect")
  result.pushCFunction(luaBufferFillRect)
  result.setTable(-3)
  discard result.pushString("__index")
  result.pushValue(-2)
  result.setTable(-3)
  result.pop(1)
  
  discard result.newUserdata(1)
  result.getField(LUA_REGISTRYINDEX, "buffer")
  discard result.setMetatable(-2)
  result.setGlobal(cstring("buffer"))
  
  # Register functions
  result.register("getViewport", luaGetViewport)
  result.register("getCurrentSection", luaGetCurrentSection)
  result.register("getAllSections", luaGetAllSections)
  result.register("getSectionById", luaGetSectionById)
  result.register("createSection", luaCreateSection)
  result.register("deleteSection", luaDeleteSection)
  result.register("updateSection", luaUpdateSection)
  result.register("getScrollY", luaGetScrollY)
  result.register("setScrollY", luaSetScrollY)
  result.register("setMultiSectionMode", luaSetMultiSectionMode)
  result.register("getMultiSectionMode", luaGetMultiSectionMode)
  result.register("viewportChanged", luaViewportChanged)
  result.register("getMinDimensions", luaGetMinDimensions)
  result.register("saveStory", luaSaveStory)
  result.register("loadStory", luaLoadStory)
  result.register("hasSavedStory", luaHasSavedStory)
  result.register("gotoSection", luaGotoSection)
  result.register("showCursor", luaShowCursor)
  result.register("hideCursor", luaHideCursor)
  result.register("setCursorPos", luaSetCursorPos)
  result.register("enableMouse", luaEnableMouse)
  result.register("disableMouse", luaDisableMouse)
  result.register("getMouse", luaGetMouse)
  result.register("getStyle", luaGetStyle)
  result.register("setStyle", luaSetStyle)
  result.register("getAllStyles", luaGetAllStyles)
  
  result.pushCFunction(luaCustomRequire)
  result.setGlobal(cstring("require"))
  result.createTable(0, 10)
  result.setGlobal(cstring("storyState"))
  
  if not story.metadata.isNil:
    result.createTable(0, 10)
    for key, val in story.metadata.pairs:
      case val.kind
      of JString:
        discard result.pushString(cstring(val.getStr()))
        result.setField(-2, cstring(key))
      of JInt:
        result.pushInteger(val.getInt())
        result.setField(-2, cstring(key))
      of JFloat:
        result.pushNumber(val.getFloat())
        result.setField(-2, cstring(key))
      of JBool:
        result.pushBoolean(cint(val.getBool()))
        result.setField(-2, cstring(key))
      else:
        discard
    result.setGlobal(cstring("story"))
  
  if story.globalCode != "":
    if result.doString(story.globalCode) != 0:
      let err = result.toString(-1)
      echo "Error in global code: ", err

proc executeScript(script: string): bool =
  if luaState.doString(script) != 0:
    let err = luaState.toString(-1)
    stderr.writeLine("\nScript error: ", err)
    luaState.pop(1)
    return false
  return true

proc parseFrontMatter(content: string): (JsonNode, string) =
  if not content.startsWith("---"):
    return (newJNull(), content)
  let parts = content.split("---", 3)
  if parts.len < 3:
    return (newJNull(), content)
  let frontMatter = parts[1].strip()
  let remaining = parts[2]
  var root = newJObject()
  for line in frontMatter.splitLines():
    if line.strip() == "" or ':' notin line:
      continue
    let colonPos = line.find(':')
    let key = line[0..<colonPos].strip()
    let value = line[colonPos+1..^1].strip()
    if value == "true":
      root[key] = newJBool(true)
    elif value == "false":
      root[key] = newJBool(false)
    elif value.startsWith("\"") and value.endsWith("\""):
      root[key] = newJString(value[1..^2])
    else:
      try:
        root[key] = newJInt(parseInt(value))
      except:
        try:
          root[key] = newJFloat(parseFloat(value))
        except:
          root[key] = newJString(value)
  return (root, remaining)

proc parseMarkdownInline(text: string): seq[MarkdownElement] =
  ## Parse inline markdown elements: **bold**, *italic*, [text](url)
  result = @[]
  var i = 0
  var currentText = ""
  var isBold = false
  var isItalic = false
  
  template flushCurrent() =
    if currentText.len > 0:
      result.add(MarkdownElement(
        text: currentText,
        bold: isBold,
        italic: isItalic,
        isLink: false,
        linkUrl: ""
      ))
      currentText = ""
  
  while i < text.len:
    # Check for links [text](url)
    if text[i] == '[':
      flushCurrent()
      var linkText = ""
      var linkUrl = ""
      var j = i + 1
      
      # Find closing ]
      while j < text.len and text[j] != ']':
        linkText.add(text[j])
        j += 1
      
      if j < text.len and j + 1 < text.len and text[j + 1] == '(':
        # Found ](, now get URL
        j += 2
        while j < text.len and text[j] != ')':
          linkUrl.add(text[j])
          j += 1
        
        if j < text.len:
          # Valid link found
          result.add(MarkdownElement(
            text: linkText,
            bold: isBold,
            italic: isItalic,
            isLink: true,
            linkUrl: linkUrl
          ))
          i = j + 1
          continue
      
      # Not a valid link, treat as regular text
      currentText.add('[')
      i += 1
      continue
    
    # Check for bold **text**
    if i + 1 < text.len and text[i] == '*' and text[i + 1] == '*':
      flushCurrent()
      isBold = not isBold
      i += 2
      continue
    
    # Check for italic *text*
    if text[i] == '*':
      flushCurrent()
      isItalic = not isItalic
      i += 1
      continue
    
    # Check for italic _text_
    if text[i] == '_':
      flushCurrent()
      isItalic = not isItalic
      i += 1
      continue
    
    # Regular character
    currentText.add(text[i])
    i += 1
  
  flushCurrent()

proc parseMarkdown(content: string): StoryContent =
  result.modules = initTable[string, string]()
  let (metadata, remaining) = parseFrontMatter(content)
  result.metadata = metadata
  var currentSection: Section
  var inCodeBlock = false
  var codeBlockLang = ""
  var codeBlockMeta = ""
  var codeBlockContent = ""
  var sectionCount = 0
  var hasAnySections = false
  for line in remaining.splitLines():
    if line.strip().startsWith("```"):
      if inCodeBlock:
        if codeBlockLang == "lua":
          if codeBlockMeta.startsWith("module:"):
            let moduleName = codeBlockMeta[7..^1].strip()
            result.modules[moduleName] = codeBlockContent
          elif codeBlockMeta.startsWith("global"):
            result.globalCode.add(codeBlockContent)
          elif codeBlockMeta.startsWith("on:"):
            let eventName = codeBlockMeta[3..^1].strip()
            var eventType = OnUpdate
            case eventName.toLowerAscii()
            of "startup": eventType = OnStartup
            of "shutdown": eventType = OnShutdown
            of "enter": eventType = OnEnter
            of "exit": eventType = OnExit
            of "key": eventType = OnKey
            of "update": eventType = OnUpdate
            of "render": eventType = OnRender
            else: discard
            if currentSection.title == "" and not hasAnySections:
              sectionCount += 1
              currentSection = Section(id: "section_" & $sectionCount, title: "Untitled", level: 1, blocks: @[], scripts: initTable[EventType, string](), position: newJNull())
              hasAnySections = true
            currentSection.scripts[eventType] = codeBlockContent
        else:
          if currentSection.title == "" and not hasAnySections:
            sectionCount += 1
            currentSection = Section(id: "section_" & $sectionCount, title: "Untitled", level: 1, blocks: @[], scripts: initTable[EventType, string](), position: newJNull())
            hasAnySections = true
          currentSection.blocks.add(ContentBlock(kind: CodeBlock, language: codeBlockLang, code: codeBlockContent, metadata: codeBlockMeta))
        inCodeBlock = false
        codeBlockLang = ""
        codeBlockMeta = ""
        codeBlockContent = ""
      else:
        inCodeBlock = true
        let header = line.strip()[3..^1].strip()
        let parts = header.split(' ', 2)
        if parts.len >= 1:
          codeBlockLang = parts[0]
        if parts.len >= 2:
          codeBlockMeta = parts[1..^1].join(" ")
    elif inCodeBlock:
      if codeBlockContent.len > 0:
        codeBlockContent.add("\n")
      codeBlockContent.add(line)
    elif line.startsWith("#"):
      if currentSection.title != "":
        result.sections.add(currentSection)
      var level = 0
      for ch in line:
        if ch == '#':
          level += 1
        else:
          break
      let title = line[level..^1].strip()
      var actualTitle = title
      var positionData = newJNull()
      if '{' in title and title.endsWith('}'):
        let bracePos = title.rfind('{')
        actualTitle = title[0..<bracePos].strip()
        let jsonStr = title[bracePos..^1]
        try:
          positionData = parseJson(jsonStr)
        except:
          discard
      sectionCount += 1
      hasAnySections = true
      currentSection = Section(id: "section_" & $sectionCount, title: actualTitle, level: level, blocks: @[], scripts: initTable[EventType, string](), position: positionData)
      currentSection.blocks.add(ContentBlock(kind: HeadingBlock, level: level, title: actualTitle))
    elif line.strip() != "":
      if currentSection.title == "" and not hasAnySections:
        sectionCount += 1
        hasAnySections = true
        currentSection = Section(id: "section_" & $sectionCount, title: "Untitled", level: 1, blocks: @[], scripts: initTable[EventType, string](), position: newJNull())
      # Parse inline markdown elements
      let elements = parseMarkdownInline(line)
      currentSection.blocks.add(ContentBlock(kind: TextBlock, text: line, elements: elements))
  if currentSection.title != "" or currentSection.blocks.len > 0:
    result.sections.add(currentSection)

proc wrapText(text: string, maxWidth: int): seq[string] =
  result = @[]
  if maxWidth <= 0:
    return
  var currentLine = ""
  let words = text.split(' ')
  for word in words:
    if currentLine.len + word.len + 1 <= maxWidth:
      if currentLine.len > 0:
        currentLine.add(" ")
      currentLine.add(word)
    else:
      if currentLine.len > 0:
        result.add(currentLine)
      currentLine = word
  if currentLine.len > 0:
    result.add(currentLine)

proc renderMarkdownElements(tb: var TermBuffer, x: var int, y: int, elements: seq[MarkdownElement], baseStyle: Style, recordLinks: bool = false) =
  ## Render markdown elements with proper styling
  for elemIdx, elem in elements:
    var style = baseStyle
    
    # Apply inline formatting
    if elem.bold:
      style.bold = true
    if elem.italic:
      style.italic = true
    if elem.isLink:
      # Record link position at the start of the link (only once per link element)
      if recordLinks:
        let linkStartX = x
        let linkStartY = y + scrollY
        linkPositions.add((linkStartX, linkStartY, elem.linkUrl))
      
      # Check if this link is currently highlighted
      let isHighlighted = recordLinks and currentLinkIndex >= 0 and 
                          currentLinkIndex < linkPositions.len and
                          linkPositions[currentLinkIndex].x == x and
                          linkPositions[currentLinkIndex].y == y + scrollY
      
      if isHighlighted:
        style = defaultStyles["highlight"]
      else:
        style.underline = true
        if not baseStyle.bold:  # Only change color if not already styled
          style.fg = 34  # Blue for links
    
    # Write the text
    for ch in elem.text:
      if x < tb.width:
        tb.writeWithStyle(x, y, $ch, style)
        x += 1

proc renderMarkdownDefault() =
  currentBuffer.clear()
  linkPositions = @[]
  var y = -scrollY
  totalContentHeight = 0
  
  for section in story.sections:
    for blk in section.blocks:
      case blk.kind
      of HeadingBlock:
        if y >= 0 and y < termHeight:
          let prefix = repeat("#", blk.level) & " "
          currentBuffer.writeTextWithStyle(0, y, prefix & blk.title, defaultStyles["heading"])
        y += 1
        totalContentHeight += 1
      of TextBlock:
        if blk.elements.len > 0:
          # Process the line to track links and render
          let wrapped = wrapText(blk.text, termWidth)
          for line in wrapped:
            # Parse inline markdown for this line
            let lineElements = parseMarkdownInline(line)
            var x = 0
            
            # Record all links and render
            for elem in lineElements:
              if elem.isLink:
                # Record this link position
                linkPositions.add((x, y + scrollY, elem.linkUrl))
              
              # Render if visible
              if y >= 0 and y < termHeight:
                var style = defaultStyles["default"]
                if elem.bold:
                  style.bold = true
                if elem.italic:
                  style.italic = true
                if elem.isLink:
                  # Check if this is the currently selected link
                  let isHighlighted = currentLinkIndex >= 0 and 
                                      currentLinkIndex < linkPositions.len and
                                      linkPositions[currentLinkIndex].x == x and
                                      linkPositions[currentLinkIndex].y == y + scrollY
                  if isHighlighted:
                    style = defaultStyles["highlight"]
                  else:
                    style.underline = true
                    style.fg = 34
                
                # Write each character
                for ch in elem.text:
                  if x < termWidth:
                    currentBuffer.writeWithStyle(x, y, $ch, style)
                  x += 1
              else:
                # Still need to track x position even if not visible
                x += elem.text.len
            
            y += 1
            totalContentHeight += 1
        else:
          # Fallback for unparsed text
          let wrapped = wrapText(blk.text, termWidth)
          for line in wrapped:
            if y >= 0 and y < termHeight:
              currentBuffer.writeTextWithStyle(0, y, line, defaultStyles["default"])
            y += 1
            totalContentHeight += 1
      of CodeBlock:
        if y >= 0 and y < termHeight:
          currentBuffer.writeTextWithStyle(2, y, "```" & blk.language, defaultStyles["code"])
        y += 1
        totalContentHeight += 1
        let codeLines = blk.code.splitLines()
        for line in codeLines:
          if y >= 0 and y < termHeight:
            currentBuffer.writeTextWithStyle(2, y, line, defaultStyles["code"])
          y += 1
          totalContentHeight += 1
        if y >= 0 and y < termHeight:
          currentBuffer.writeTextWithStyle(2, y, "```", defaultStyles["code"])
        y += 1
        totalContentHeight += 1
    y += 1
    totalContentHeight += 1

proc render() =
  swap(currentBuffer, previousBuffer)
  if multiSectionRenderMode:
    luaState.getGlobal(cstring("globalRender"))
    if luaState.isFunction(-1):
      luaState.pop(1)
      if luaState.doString("if globalRender then globalRender() end") == 0:
        currentBuffer.display(previousBuffer)
        return
    luaState.pop(1)
    currentBuffer.clear()
    currentBuffer.display(previousBuffer)
    return
  var hasAnyCustomRenderer = false
  for section in story.sections:
    if section.scripts.hasKey(OnRender):
      hasAnyCustomRenderer = true
      break
  if hasAnyCustomRenderer:
    currentBuffer.clear()
    if currentSectionIdx < story.sections.len:
      let section = story.sections[currentSectionIdx]
      if section.scripts.hasKey(OnRender):
        discard executeScript(section.scripts[OnRender])
      else:
        var y = 0
        for blk in section.blocks:
          case blk.kind
          of HeadingBlock:
            if y < termHeight:
              let prefix = repeat("#", blk.level) & " "
              currentBuffer.writeTextWithStyle(0, y, prefix & blk.title, defaultStyles["heading"])
            y += 1
          of TextBlock:
            if blk.elements.len > 0:
              # Render parsed markdown elements
              let wrapped = wrapText(blk.text, termWidth)
              for line in wrapped:
                if y < termHeight:
                  let lineElements = parseMarkdownInline(line)
                  var x = 0
                  currentBuffer.renderMarkdownElements(x, y, lineElements, defaultStyles["default"], false)
                y += 1
            else:
              # Fallback for unparsed text
              let wrapped = wrapText(blk.text, termWidth)
              for line in wrapped:
                if y < termHeight:
                  currentBuffer.writeTextWithStyle(0, y, line, defaultStyles["default"])
                y += 1
          of CodeBlock:
            if y < termHeight:
              currentBuffer.writeTextWithStyle(2, y, "```" & blk.language, defaultStyles["code"])
            y += 1
            let codeLines = blk.code.splitLines()
            for line in codeLines:
              if y < termHeight:
                currentBuffer.writeTextWithStyle(2, y, line, defaultStyles["code"])
              y += 1
            if y < termHeight:
              currentBuffer.writeTextWithStyle(2, y, "```", defaultStyles["code"])
            y += 1
  else:
    renderMarkdownDefault()
  currentBuffer.display(previousBuffer)

proc handleMouseEvent(event: MouseEvent) =
  mouseX = event.x
  mouseY = event.y
  mouseButton = event.button
  
  case event.eventType
  of MouseDown:
    mousePressed = true
  of MouseUp:
    mousePressed = false
  else:
    discard
  
  # Call Lua mouse handler if it exists
  if multiSectionRenderMode:
    luaState.getGlobal(cstring("globalHandleMouse"))
    if luaState.isFunction(-1):
      luaState.pop(1)
      # Create event table
      luaState.createTable(0, 4)
      luaState.pushInteger(event.x)
      luaState.setField(-2, cstring("x"))
      luaState.pushInteger(event.y)
      luaState.setField(-2, cstring("y"))
      luaState.pushInteger(event.button)
      luaState.setField(-2, cstring("button"))
      let eventName = case event.eventType
        of MouseDown: "down"
        of MouseUp: "up"
        of MouseMove: "move"
        of MouseDrag: "drag"
        of ScrollUp: "scrollup"
        of ScrollDown: "scrolldown"
      discard luaState.pushString(cstring(eventName))
      luaState.setField(-2, cstring("type"))
      luaState.setGlobal(cstring("mouseEvent"))
      # Call handler
      let code = "if globalHandleMouse then globalHandleMouse(mouseEvent) end"
      if luaState.doString(code) != 0:
        let err = luaState.toString(-1)
        stderr.writeLine("Error in globalHandleMouse: ", err)
        luaState.pop(1)
      return
    luaState.pop(1)
  
  if currentSectionIdx < story.sections.len:
    let section = story.sections[currentSectionIdx]
    if section.scripts.hasKey(OnKey):  # We'll check for mouse handler in OnKey
      luaState.createTable(0, 4)
      luaState.pushInteger(event.x)
      luaState.setField(-2, cstring("x"))
      luaState.pushInteger(event.y)
      luaState.setField(-2, cstring("y"))
      luaState.pushInteger(event.button)
      luaState.setField(-2, cstring("button"))
      let eventName = case event.eventType
        of MouseDown: "down"
        of MouseUp: "up"
        of MouseMove: "move"
        of MouseDrag: "drag"
        of ScrollUp: "scrollup"
        of ScrollDown: "scrolldown"
      discard luaState.pushString(cstring(eventName))
      luaState.setField(-2, cstring("type"))
      luaState.setGlobal(cstring("mouseEvent"))

proc handleInput(key: char) =
  var keyInfo: KeyInfo
  
  # Handle escape sequences first (arrows, function keys, etc)
  if key == '\e':
    let key2 = getKey()
    if key2 == '[' or key2 == 'O':
      # Build escape sequence
      var escSeq = $key2
      var c = getKey()
      while c != '\0' and escSeq.len < 20:
        escSeq.add(c)
        # Check for sequence terminators
        if c in {'A', 'B', 'C', 'D', 'H', 'F', 'Z', 'P', 'Q', 'R', 'S', '~', 'm', 'M'}:
          break
        # Check for mouse events
        if key2 == '[' and escSeq.len >= 2 and escSeq[1] == '<':
          # Mouse event - read until M or m
          if c == 'M' or c == 'm':
            break
        c = getKey()
      
      # Check if it's a mouse event
      if key2 == '[' and escSeq.len > 2 and escSeq[1] == '<':
        let fullSeq = "\e[<" & escSeq[2..^1]
        let mouseEvent = parseMouseEvent(fullSeq)
        handleMouseEvent(mouseEvent)
        return
      
      # Parse as keyboard escape sequence
      keyInfo = parseEscapeSequence(escSeq)
    elif key2 == '\0':
      # ESC key pressed alone
      keyInfo = normalizeKey('\e')
    else:
      # Alt+key combination
      keyInfo = normalizeKey(key2)
      keyInfo.alt = true
  else:
    # Regular key
    keyInfo = normalizeKey(key)
  
  # Special handling for arrow keys in default mode
  if not multiSectionRenderMode:
    if keyInfo.name == "up":
      scrollY = max(0, scrollY - 1)
      return
    elif keyInfo.name == "down":
      let maxScroll = max(0, totalContentHeight - termHeight)
      scrollY = min(maxScroll, scrollY + 1)
      return
    elif keyInfo.name == "tab":
      if keyInfo.shift:
        # Shift+Tab - navigate to previous link
        if linkPositions.len > 0:
          currentLinkIndex = (currentLinkIndex - 1 + linkPositions.len) mod linkPositions.len
          let linkY = linkPositions[currentLinkIndex].y
          if linkY < scrollY:
            scrollY = linkY
          elif linkY >= scrollY + termHeight:
            scrollY = linkY - termHeight + 1
      else:
        # Tab - navigate to next link
        if linkPositions.len > 0:
          if currentLinkIndex < 0:
            currentLinkIndex = 0
          else:
            currentLinkIndex = (currentLinkIndex + 1) mod linkPositions.len
          let linkY = linkPositions[currentLinkIndex].y
          if linkY < scrollY:
            scrollY = linkY
          elif linkY >= scrollY + termHeight:
            scrollY = max(0, linkY - termHeight + 1)
      return
    elif keyInfo.name == "enter":
      # Enter - activate highlighted link
      if currentLinkIndex >= 0 and currentLinkIndex < linkPositions.len:
        let url = linkPositions[currentLinkIndex].url
        if url.startsWith("#"):
          let sectionId = url[1..^1]
          for i, section in story.sections:
            if section.id == sectionId or section.title == sectionId:
              if currentSectionIdx < story.sections.len:
                let oldSection = story.sections[currentSectionIdx]
                if oldSection.scripts.hasKey(OnExit):
                  if luaState.doString(oldSection.scripts[OnExit]) != 0:
                    let err = luaState.toString(-1)
                    stderr.writeLine("\nScript error in OnExit: ", err)
                    luaState.pop(1)
              currentSectionIdx = i
              scrollY = 0
              currentLinkIndex = -1
              let newSection = story.sections[i]
              if newSection.scripts.hasKey(OnEnter):
                if luaState.doString(newSection.scripts[OnEnter]) != 0:
                  let err = luaState.toString(-1)
                  stderr.writeLine("\nScript error in OnEnter: ", err)
                  luaState.pop(1)
              return
      return
  
  # Ctrl+C or ESC always quits
  if keyInfo.name == "escape" or (keyInfo.name == "c" and keyInfo.ctrl):
    running = false
    return
  
  # Pass to Lua handlers
  if multiSectionRenderMode:
    # Check for arrow key handler
    if keyInfo.name in ["up", "down", "left", "right"]:
      luaState.getGlobal(cstring("globalHandleArrow"))
      if luaState.isFunction(-1):
        luaState.pop(1)
        discard luaState.pushString(cstring(keyInfo.name))
        luaState.setGlobal(cstring("arrowDir"))
        if luaState.doString("if globalHandleArrow then globalHandleArrow(arrowDir) end") != 0:
          let err = luaState.toString(-1)
          stderr.writeLine("Error in arrow handler: ", err)
          luaState.pop(1)
        return
      luaState.pop(1)
    
    # Check for tab handler
    if keyInfo.name == "tab":
      if keyInfo.shift:
        luaState.getGlobal(cstring("globalHandleShiftTab"))
        if luaState.isFunction(-1):
          luaState.pop(1)
          if luaState.doString("if globalHandleShiftTab then globalHandleShiftTab() end") != 0:
            let err = luaState.toString(-1)
            stderr.writeLine("Error in shift-tab handler: ", err)
            luaState.pop(1)
          return
        luaState.pop(1)
      else:
        luaState.getGlobal(cstring("globalHandleTab"))
        if luaState.isFunction(-1):
          luaState.pop(1)
          if luaState.doString("if globalHandleTab then globalHandleTab() end") != 0:
            let err = luaState.toString(-1)
            stderr.writeLine("Error in tab handler: ", err)
            luaState.pop(1)
          return
        luaState.pop(1)
    
    # Check for enter handler
    if keyInfo.name == "enter":
      luaState.getGlobal(cstring("globalHandleEnter"))
      if luaState.isFunction(-1):
        luaState.pop(1)
        if currentLinkIndex >= 0 and currentLinkIndex < linkPositions.len:
          discard luaState.pushString(cstring(linkPositions[currentLinkIndex].url))
          luaState.setGlobal(cstring("linkUrl"))
        if luaState.doString("if globalHandleEnter then globalHandleEnter(linkUrl) end") != 0:
          let err = luaState.toString(-1)
          stderr.writeLine("Error in enter handler: ", err)
          luaState.pop(1)
        return
      luaState.pop(1)
    
    # General key handler
    luaState.getGlobal(cstring("globalHandleKey"))
    if luaState.isFunction(-1):
      luaState.pop(1)
      pushKeyInfoToLua(luaState, keyInfo)
      luaState.setGlobal(cstring("key"))
      let code = "if globalHandleKey then globalHandleKey(key) end"
      if luaState.doString(code) != 0:
        let err = luaState.toString(-1)
        stderr.writeLine("Error in globalHandleKey: ", err)
        luaState.pop(1)
      return
    else:
      luaState.pop(1)
  
  # Section-level handlers
  if currentSectionIdx < story.sections.len:
    let section = story.sections[currentSectionIdx]
    if section.scripts.hasKey(OnKey):
      pushKeyInfoToLua(luaState, keyInfo)
      luaState.setGlobal(cstring("key"))
      discard executeScript(section.scripts[OnKey])
      return
  
  # Default quit on q/Q
  if keyInfo.name == "q" or keyInfo.name == "Q":
    running = false
    return

proc checkAndUpdateTerminalSize(): bool =
  let (w, h) = getTermSize()
  
  if w != prevTermWidth or h != prevTermHeight:
    viewportChanged = true
    prevTermWidth = w
    prevTermHeight = h
  
  let sizeChanged = w != termWidth or h != termHeight
  termWidth = w
  termHeight = h
  offsetX = max(0, (w - minRequiredWidth) div 2)
  offsetY = max(0, (h - minRequiredHeight) div 2)
  
  if sizeChanged:
    currentBuffer = newTermBuffer(termWidth, termHeight)
    previousBuffer = newTermBuffer(termWidth, termHeight)
    stdout.write("\e[2J\e[H")
    stdout.flushFile()
  
  return w >= minRequiredWidth and h >= minRequiredHeight

proc showHelp() =
  echo """Storie v""", version, """

Markdown-based interactive story engine with UI support.

Usage:
  storie [options] [markdown_file]

Options:
  -h, --help       Show this help message
  -v, --version    Show version information

Default Controls:
  ↑/↓              Scroll content up/down
  Tab/Shift+Tab    Navigate to next/previous link
  Enter            Activate highlighted link (follow link)
  Esc/Ctrl+C       Exit
  q                Exit (legacy)

Custom stories may define their own controls via Lua scripts.
Enhanced with mouse support and UI primitives for interactive controls.

Compilation with embedded content:
  nim c -d:bundledStoryFile="story.md" -d:bundledCanvasFile="canvas.lua" storie.nim
"""
  quit(0)

proc main() =
  var p = initOptParser()
  var filename = ""
  for kind, key, val in p.getopt():
    case kind
    of cmdLongOption, cmdShortOption:
      case key
      of "help", "h": showHelp()
      of "version", "v":
        echo "Storie version ", version
        quit(0)
    of cmdArgument:
      if filename == "":
        filename = key
    else: discard
  
  var content: string
  
  # Priority: command line argument > bundled file > default
  if filename != "":
    content = readFile(filename)
  else:
    when bundledStoryFile != "":
      # File was embedded at compile time
      const embeddedStory = staticRead(bundledStoryFile)
      content = embeddedStory
    else:
      content = defaultMarkdown
  
  story = parseMarkdown(content)
  
  # Embed canvas module if specified at compile time
  when bundledCanvasFile != "":
    const embeddedCanvas = staticRead(bundledCanvasFile)
    story.modules["canvas"] = embeddedCanvas
  
  if not story.metadata.isNil:
    if story.metadata.hasKey("minWidth"):
      let widthNode = story.metadata["minWidth"]
      if widthNode.kind == JInt:
        minRequiredWidth = widthNode.getInt()
      elif widthNode.kind == JFloat:
        minRequiredWidth = int(widthNode.getFloat())
    
    if story.metadata.hasKey("minHeight"):
      let heightNode = story.metadata["minHeight"]
      if heightNode.kind == JInt:
        minRequiredHeight = heightNode.getInt()
      elif heightNode.kind == JFloat:
        minRequiredHeight = int(heightNode.getFloat())
  
  setupRawMode()
  setupSignalHandler()
  hideCursor()
  clearScreen()
  discard checkAndUpdateTerminalSize()
  currentBuffer = newTermBuffer(termWidth, termHeight)
  previousBuffer = newTermBuffer(termWidth, termHeight)
  loadedModules = initTable[string, bool]()
  luaState = initLuaState()
  for section in story.sections:
    if section.scripts.hasKey(OnStartup):
      discard executeScript(section.scripts[OnStartup])
  if story.sections.len > 0 and story.sections[0].scripts.hasKey(OnEnter):
    discard executeScript(story.sections[0].scripts[OnEnter])
  var lastTime = epochTime()
  while running:
    let currentTime = epochTime()
    let deltaTime = currentTime - lastTime
    lastTime = currentTime
    let key = getKey()
    if key != '\0':
      if checkAndUpdateTerminalSize():
        handleInput(key)
    if multiSectionRenderMode:
      luaState.getGlobal(cstring("globalUpdate"))
      if luaState.isFunction(-1):
        luaState.pop(1)
        luaState.pushNumber(deltaTime)
        luaState.setGlobal(cstring("deltaTime"))
        discard luaState.doString("if globalUpdate then globalUpdate(deltaTime) end")
      else:
        luaState.pop(1)
    if currentSectionIdx < story.sections.len and not multiSectionRenderMode:
      let section = story.sections[currentSectionIdx]
      if section.scripts.hasKey(OnUpdate):
        luaState.pushNumber(deltaTime)
        luaState.setGlobal(cstring("deltaTime"))
        discard executeScript(section.scripts[OnUpdate])
    if checkAndUpdateTerminalSize():
      render()
    else:
      currentBuffer = newTermBuffer(termWidth, termHeight)
      let msg = "Terminal too small. Need at least " & $minRequiredWidth & "x" & $minRequiredHeight
      let msgX = max(0, (termWidth - msg.len) div 2)
      let msgY = max(0, termHeight div 2)
      if msgX + msg.len <= termWidth and msgY < termHeight:
        currentBuffer.writeTextWithStyle(msgX, msgY, msg, defaultStyles["error"])
      currentBuffer.display(previousBuffer)
    let frameTime = epochTime() - currentTime
    const targetFrameTime = 1.0 / 30.0
    let sleepTime = targetFrameTime - frameTime
    if sleepTime > 0:
      sleep(int(sleepTime * 1000))
  for section in story.sections:
    if section.scripts.hasKey(OnShutdown):
      discard executeScript(section.scripts[OnShutdown])
  luaState.close()
  restoreTerminal()

when isMainModule:
  main()