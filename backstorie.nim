import strutils, times, parseopt, os, tables, math
import macros

when not defined(emscripten):
  import src/platform/terminal

const version = "0.1.0"

# ================================================================
# INPUT CONSTANTS
# ================================================================

const
  INPUT_ESCAPE* = 27
  INPUT_BACKSPACE* = 127
  INPUT_SPACE* = 32
  INPUT_TAB* = 9
  INPUT_ENTER* = 13
  INPUT_DELETE* = 46

  INPUT_UP* = 1000
  INPUT_DOWN* = 1001
  INPUT_LEFT* = 1002
  INPUT_RIGHT* = 1003

  INPUT_HOME* = 1004
  INPUT_END* = 1005
  INPUT_PAGE_UP* = 1006
  INPUT_PAGE_DOWN* = 1007

  INPUT_F1* = 1008
  INPUT_F2* = 1009
  INPUT_F3* = 1010
  INPUT_F4* = 1011
  INPUT_F5* = 1012
  INPUT_F6* = 1013
  INPUT_F7* = 1014
  INPUT_F8* = 1015
  INPUT_F9* = 1016
  INPUT_F10* = 1017
  INPUT_F11* = 1018
  INPUT_F12* = 1019

const
  ModShift* = 0'u8
  ModAlt* = 1'u8
  ModCtrl* = 2'u8
  ModSuper* = 3'u8

# ================================================================
# INPUT EVENT TYPES
# ================================================================

type
  InputAction* = enum
    Press
    Release
    Repeat

  MouseButton* = enum
    Left
    Middle
    Right
    Unknown
    ScrollUp
    ScrollDown

  InputEventKind* = enum
    KeyEvent
    TextEvent
    MouseEvent
    MouseMoveEvent
    ResizeEvent

  InputEvent* = object
    case kind*: InputEventKind
    of KeyEvent:
      keyCode*: int
      keyMods*: set[uint8]
      keyAction*: InputAction
    of TextEvent:
      text*: string
    of MouseEvent:
      button*: MouseButton
      mouseX*: int
      mouseY*: int
      mods*: set[uint8]
      action*: InputAction
    of MouseMoveEvent:
      moveX*: int
      moveY*: int
      moveMods*: set[uint8]
    of ResizeEvent:
      newWidth*: int
      newHeight*: int

# ================================================================
# COLOR AND STYLE SYSTEM
# ================================================================

type
  Color* = object
    r*, g*, b*: uint8

  Style* = object
    fg*: Color
    bg*: Color
    bold*: bool
    underline*: bool
    italic*: bool
    dim*: bool

# Color constructor helpers
proc rgb*(r, g, b: uint8): Color =
  Color(r: r, g: g, b: b)

proc gray*(level: uint8): Color =
  rgb(level, level, level)

proc black*(): Color = rgb(0, 0, 0)
proc red*(): Color = rgb(255, 0, 0)
proc green*(): Color = rgb(0, 255, 0)
proc yellow*(): Color = rgb(255, 255, 0)
proc blue*(): Color = rgb(0, 0, 255)
proc magenta*(): Color = rgb(255, 0, 255)
proc cyan*(): Color = rgb(0, 255, 255)
proc white*(): Color = rgb(255, 255, 255)

proc defaultStyle*(): Style =
  Style(fg: white(), bg: black(), bold: false, underline: false, italic: false, dim: false)

# ================================================================
# TERMINAL INPUT PARSER (sophisticated)
# ================================================================

const
  INTERMED_MAX = 16
  CSI_ARGS_MAX = 16
  CSI_LEADER_MAX = 16
  CSI_ARG_FLAG_MORE* = 0x80000000'i64
  CSI_ARG_MASK* = 0x7FFFFFFF'i64
  CSI_ARG_MISSING* = 0x7FFFFFFF'i64

type
  StringCsiState = object
    leaderlen: int
    leader: array[CSI_LEADER_MAX, char]
    argi: int
    args: array[CSI_ARGS_MAX, int64]

  ParserState = enum
    Normal
    CSILeader
    CSIArgs
    CSIIntermed

  TerminalInputParser* = object
    prevEsc: bool
    inEsc: bool
    inEscO: bool
    inUtf8: bool
    utf8Remaining: int
    utf8Buffer: string
    state: ParserState
    csi: StringCsiState
    intermedlen: int
    intermed: array[INTERMED_MAX, char]
    mouseCol: int
    mouseRow: int
    width*: int
    height*: int
    escTimer: float
    endedInEsc: bool
    enableEscapeTimeout*: bool
    escapeTimeout*: int

proc newTerminalInputParser*(): TerminalInputParser =
  result.state = Normal
  result.csi.args[0] = CSI_ARG_MISSING
  result.enableEscapeTimeout = true
  result.escapeTimeout = 300
  result.escTimer = epochTime()

proc csiArg(a: int64): int = int(a and CSI_ARG_MASK)
proc csiArgHasMore(a: int64): bool = (a and CSI_ARG_FLAG_MORE) != 0
proc csiArgIsMissing(a: int64): bool = (a and CSI_ARG_MASK) == CSI_ARG_MISSING

proc csiArgOr(a: int64, def: int): int =
  if csiArgIsMissing(a): def else: csiArg(a)

proc csiArg(vt: TerminalInputParser, i: int, i1: int, default: int = 0): int =
  var index = 0
  var k = 0
  while index < vt.csi.argi and k < i:
    if vt.csi.args[index].csiArgHasMore():
      inc index
      continue
    inc index
    inc k

  if index + i1 < vt.csi.argi:
    let a = vt.csi.args[index + i1]
    if a.csiArgIsMissing():
      return default
    return csiArg(a)
  return default

proc csiArg(vt: TerminalInputParser, i: int, default: int = 0): int =
  return vt.csiArg(i, 0, default)

proc isIntermed(c: char): bool =
  return c.int >= 0x20 and c.int <= 0x2f

proc handleCsi(vt: var TerminalInputParser, command: char): seq[InputEvent] =
  result = @[]
  let leader = if vt.csi.leaderlen > 0: vt.csi.leader[0] else: '\0'
  let args = vt.csi.args
  let argcount = vt.csi.argi

  proc parseModsAndAction(vt: TerminalInputParser): (set[uint8], InputAction) =
    result = ({}, Press)
    let mods = vt.csiArg(1) - 1
    if mods >= 0:
      if (mods and 0x1) != 0:
        result[0].incl ModShift
      if (mods and 0x2) != 0:
        result[0].incl ModAlt
      if (mods and 0x4) != 0:
        result[0].incl ModCtrl
      if (mods and 0x8) != 0:
        result[0].incl ModSuper

    let action = vt.csiArg(1, 1, default = 1)
    case action
    of 1: result[1] = Press
    of 2: result[1] = Repeat
    of 3: result[1] = Release
    else: discard

  case command
  of 'u':
    let input = vt.csiArg(0)
    if input != 0:
      let (mods, action) = vt.parseModsAndAction()
      result.add InputEvent(kind: KeyEvent, keyCode: input, keyMods: mods, keyAction: action)

  of 'A':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_UP, keyMods: mods, keyAction: action)
  of 'B':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_DOWN, keyMods: mods, keyAction: action)
  of 'C':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_RIGHT, keyMods: mods, keyAction: action)
  of 'D':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_LEFT, keyMods: mods, keyAction: action)
  of 'F':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_END, keyMods: mods, keyAction: action)
  of 'H':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_HOME, keyMods: mods, keyAction: action)
  of 'P':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F1, keyMods: mods, keyAction: action)
  of 'Q':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F2, keyMods: mods, keyAction: action)
  of 'S':
    let (mods, action) = vt.parseModsAndAction()
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F4, keyMods: mods, keyAction: action)
  of 'Z':
    var (mods, action) = vt.parseModsAndAction()
    mods.incl ModShift
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_TAB, keyMods: mods, keyAction: action)
  of '~':
    let (mods, action) = vt.parseModsAndAction()
    if argcount > 0:
      case args[0].int
      of 3: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_DELETE, keyMods: mods, keyAction: action)
      of 5: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_PAGE_UP, keyMods: mods, keyAction: action)
      of 6: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_PAGE_DOWN, keyMods: mods, keyAction: action)
      of 11: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F1, keyMods: mods, keyAction: action)
      of 12: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F2, keyMods: mods, keyAction: action)
      of 13: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F3, keyMods: mods, keyAction: action)
      of 14: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F4, keyMods: mods, keyAction: action)
      of 15: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F5, keyMods: mods, keyAction: action)
      of 17: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F6, keyMods: mods, keyAction: action)
      of 18: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F7, keyMods: mods, keyAction: action)
      of 19: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F8, keyMods: mods, keyAction: action)
      of 20: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F9, keyMods: mods, keyAction: action)
      of 21: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F10, keyMods: mods, keyAction: action)
      of 23: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F11, keyMods: mods, keyAction: action)
      of 24: result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F12, keyMods: mods, keyAction: action)
      else: discard

  of 'm', 'M':
    if argcount == 3:
      let codeAndMods = vt.csiArg(0)
      let buttonCode = codeAndMods and 0b11
      let mods = (codeAndMods shr 2) and 0b111
      let col = vt.csiArg(1) - 1
      let row = vt.csiArg(2) - 1
      let action = if command == 'M': Press else: Release
      let move = (codeAndMods and 0x20) != 0
      let scroll = (codeAndMods and 0x40) != 0

      let mouseButton: MouseButton = case buttonCode
      of 0: Left
      of 1: Middle
      of 2: Right
      else: Unknown

      var modifiers: set[uint8] = {}
      if (mods and 0x1) != 0:
        modifiers.incl ModShift
      if (mods and 0x2) != 0:
        modifiers.incl ModAlt
      if (mods and 0x4) != 0:
        modifiers.incl ModCtrl

      if move:
        result.add InputEvent(kind: MouseMoveEvent, moveX: col, moveY: row, moveMods: modifiers)
      elif scroll:
        let scrollBtn = if (codeAndMods and 0x1) == 0: ScrollUp else: ScrollDown
        result.add InputEvent(kind: MouseEvent, button: scrollBtn, mouseX: col, mouseY: row, mods: modifiers, action: Press)
      else:
        result.add InputEvent(kind: MouseEvent, button: mouseButton, mouseX: col, mouseY: row, mods: modifiers, action: action)
  else:
    discard

proc parseInput*(vt: var TerminalInputParser, text: openArray[char]): seq[InputEvent] =
  result = @[]
  var mods: set[uint8] = {}

  if vt.enableEscapeTimeout and vt.endedInEsc and (epochTime() - vt.escTimer) * 1000.0 >= vt.escapeTimeout.float:
    if vt.prevEsc:
      mods.incl ModAlt
    result.add InputEvent(kind: KeyEvent, keyCode: INPUT_ESCAPE, keyMods: mods, keyAction: Press)
    vt.inEsc = false
    vt.prevEsc = false
    vt.endedInEsc = false

  if text.len > 0:
    vt.endedInEsc = false

  var i = 0

  while i < text.len:
    defer: inc i
    var c1Allowed = false
    var c = text[i]

    if vt.inEscO:
      vt.inEscO = false
      case c
      of 'P':
        result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F1, keyMods: mods, keyAction: Press)
        continue
      of 'Q':
        result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F2, keyMods: mods, keyAction: Press)
        continue
      of 'R':
        result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F3, keyMods: mods, keyAction: Press)
        continue
      of 'S':
        result.add InputEvent(kind: KeyEvent, keyCode: INPUT_F4, keyMods: mods, keyAction: Press)
        continue
      else: discard

    vt.prevEsc = vt.inEsc

    case c
    of '\x1b':
      vt.intermedLen = 0
      vt.state = Normal
      vt.inEsc = true

      if i == text.len - 1:
        vt.endedInEsc = true
        vt.escTimer = epochTime()
        continue

      vt.endedInEsc = false
      continue

    of '\x7f':
      if vt.inEsc:
        mods.incl ModAlt
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: INPUT_BACKSPACE, keyMods: mods, keyAction: Press)
      mods = {}
      continue
    of '\x08':
      if vt.inEsc:
        mods.incl ModAlt
      mods.incl ModCtrl
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: INPUT_BACKSPACE, keyMods: mods, keyAction: Press)
      mods = {}
      continue
    of '\x09':
      if vt.inEsc:
        mods.incl ModAlt
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: INPUT_TAB, keyMods: mods, keyAction: Press)
      mods = {}
      continue
    of '\x0d', '\x0a':
      if vt.inEsc:
        mods.incl ModAlt
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: INPUT_ENTER, keyMods: mods, keyAction: Press)
      mods = {}
      continue

    of '\x01'..'\x07', '\x10'..'\x1a', '\x1c'..'\x1f':
      var key = c.int
      if c.int >= 1 and c.int <= 26:
        key = (c.int - 1 + 'a'.int)
      if vt.inEsc:
        mods.incl ModAlt
      mods.incl ModCtrl
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: key, keyMods: mods, keyAction: Press)
      mods = {}
      continue

    of '\x20':
      vt.inEsc = false
      result.add InputEvent(kind: KeyEvent, keyCode: INPUT_SPACE, keyMods: mods, keyAction: Press)
      mods = {}
      continue

    else:
      discard

    if vt.inEsc:
      if vt.intermedLen == 0 and c.int >= 0x40 and c.int < 0x60:
        c = (c.int + 0x40).char
        c1Allowed = true
        vt.inEsc = false
      else:
        vt.state = Normal

    if vt.state == CSILeader:
      if c.int >= 0x3c and c.int <= 0x3f:
        if vt.csi.leaderlen < CSI_LEADER_MAX - 1:
          vt.csi.leader[vt.csi.leaderlen] = c
          inc(vt.csi.leaderlen)
        continue
      vt.csi.leader[vt.csi.leaderlen] = 0.char
      vt.csi.argi = 0
      vt.csi.args[0] = CSI_ARG_MISSING
      vt.state = CSIArgs

    if vt.state == CSIArgs:
      if c >= '0' and c <= '9':
        if vt.csi.args[vt.csi.argi] == CSI_ARG_MISSING:
          vt.csi.args[vt.csi.argi] = 0
        vt.csi.args[vt.csi.argi] = vt.csi.args[vt.csi.argi] * 10
        inc(vt.csi.args[vt.csi.argi], c.int - '0'.int)
        continue
      if c == ':':
        vt.csi.args[vt.csi.argi] = vt.csi.args[vt.csi.argi] or CSI_ARG_FLAG_MORE
        c = ';'
      if c == ';':
        inc(vt.csi.argi)
        vt.csi.args[vt.csi.argi] = CSI_ARG_MISSING
        continue
      inc(vt.csi.argi)
      vt.intermedlen = 0
      vt.state = CSIIntermed

    if vt.state == CSIIntermed:
      if isIntermed(c):
        if vt.intermedlen < INTERMED_MAX - 1:
          vt.intermed[vt.intermedlen] = c
          inc(vt.intermedlen)
        continue
      elif c.int >= 0x40 and c.int <= 0x7e:
        vt.intermed[vt.intermedlen] = 0.char
        for event in vt.handleCsi(c):
          result.add event
      vt.state = Normal
      continue

    case vt.state
    of Normal:
      if vt.inEsc:
        if isIntermed(c):
          if vt.intermedLen < INTERMED_MAX - 1:
            vt.intermed[vt.intermedLen] = c
            inc(vt.intermedLen)
        elif c.int >= 0x30 and c.int < 0x7f:
          mods.incl ModAlt
          vt.inEsc = false
          result.add InputEvent(kind: KeyEvent, keyCode: c.int, keyMods: mods, keyAction: Press)
          mods = {}
        continue

      if c1Allowed and c.int >= 0x80 and c.int < 0xa0:
        if c.int == 0x9b:
          vt.csi.leaderlen = 0
          vt.state = CSILeader
      else:
        var k = i
        var n = i + vt.utf8Remaining
        while k < text.len:
          let ch = text[k]
          if ch.int <= 127:
            vt.inUtf8 = false
            if ch.int < 32 or ch.int == 127:
              break
            n = k + 1
            inc k
          else:
            if (ch.int and 0b11000000) == 0b10000000:
              vt.inUtf8 = false
              n = k + 1
            elif (ch.int and 0b11100000) == 0b11000000:
              vt.inUtf8 = true
              n = k + 2
            elif (ch.int and 0b11110000) == 0b11100000:
              vt.inUtf8 = true
              n = k + 3
            elif (ch.int and 0b11111000) == 0b11110000:
              vt.inUtf8 = true
              n = k + 4
            else:
              vt.inUtf8 = false
            inc k
        if k == i:
          inc k

        vt.utf8Remaining = n - k
        if k == text.len:
          if k < n:
            vt.utf8Buffer.add text[i..<k].join("")
            break
          if vt.utf8Buffer.len > 0:
            result.add InputEvent(kind: TextEvent, text: vt.utf8Buffer & text[i..<k].join(""))
            vt.utf8Buffer.setLen(0)
          else:
            result.add InputEvent(kind: TextEvent, text: text[i..<k].join(""))
          vt.inUtf8 = false
          vt.utf8Remaining = 0
        else:
          if vt.utf8Buffer.len > 0:
            result.add InputEvent(kind: TextEvent, text: vt.utf8Buffer & text[i..<k].join(""))
            vt.utf8Buffer.setLen(0)
          else:
            result.add InputEvent(kind: TextEvent, text: text[i..<k].join(""))
          vt.inUtf8 = false
          vt.utf8Remaining = 0
        i = k - 1

    else:
      discard

# ================================================================
# INTERNAL TYPES (not exposed to plugins)
# ================================================================

type
  Cell = object
    ch: string
    style: Style

  TermBuffer* = object
    width*, height*: int
    cells: seq[Cell]
    clipX*, clipY*, clipW*, clipH*: int
    offsetX*, offsetY*: int

  Layer* = ref object
    id*: string
    z*: int
    visible*: bool
    buffer*: TermBuffer

  AppState* = ref object
    running*: bool
    termWidth*, termHeight*: int
    currentBuffer*: TermBuffer
    previousBuffer*: TermBuffer
    frameCount*: int
    totalTime*: float
    fps*: float
    lastFpsUpdate*: float
    targetFps*: float
    colorSupport*: int
    layers*: seq[Layer]
    inputParser*: TerminalInputParser
    lastMouseX*, lastMouseY*: int

when not defined(emscripten):
  var globalRunning {.global.} = true
  var globalTerminalState: TerminalState

# ================================================================
# COLOR UTILITIES
# ================================================================

proc toAnsi256*(c: Color): int =
  let r = int(c.r) * 5 div 255
  let g = int(c.g) * 5 div 255
  let b = int(c.b) * 5 div 255
  return 16 + 36 * r + 6 * g + b

proc toAnsi8*(c: Color): int =
  let bright = (int(c.r) + int(c.g) + int(c.b)) div 3 > 128
  var code = 30
  if c.r > 128: code += 1
  if c.g > 128: code += 2
  if c.b > 128: code += 4
  if bright and code == 30: code = 37
  return code

# ================================================================
# TERMINAL SETUP
# ================================================================

proc detectColorSupport(): int =
  when defined(emscripten):
    return 16777216
  else:
    let colorterm = getEnv("COLORTERM")
    if colorterm in ["truecolor", "24bit"]:
      return 16777216
    let term = getEnv("TERM")
    if "256color" in term:
      return 256
    if term in ["xterm", "screen", "linux"]:
      return 8
    return 0

proc getInputEvent*(state: AppState): seq[InputEvent] =
  when defined(emscripten):
    return @[]
  else:
    var buffer: array[256, char]
    let bytesRead = readInputRaw(buffer)
    if bytesRead > 0:
      return state.inputParser.parseInput(buffer.toOpenArray(0, bytesRead - 1))
    return @[]

# ================================================================
# BUFFER OPERATIONS
# ================================================================

proc newTermBuffer*(w, h: int): TermBuffer =
  result.width = w
  result.height = h
  result.cells = newSeq[Cell](w * h)
  result.clipX = 0
  result.clipY = 0
  result.clipW = w
  result.clipH = h
  result.offsetX = 0
  result.offsetY = 0
  let defaultStyle = Style(fg: white(), bg: black(), bold: false)
  for i in 0 ..< result.cells.len:
    result.cells[i] = Cell(ch: " ", style: defaultStyle)

proc setClip*(tb: var TermBuffer, x, y, w, h: int) =
  tb.clipX = max(0, x)
  tb.clipY = max(0, y)
  tb.clipW = min(w, tb.width - tb.clipX)
  tb.clipH = min(h, tb.height - tb.clipY)

proc clearClip*(tb: var TermBuffer) =
  tb.clipX = 0
  tb.clipY = 0
  tb.clipW = tb.width
  tb.clipH = tb.height

proc setOffset*(tb: var TermBuffer, x, y: int) =
  tb.offsetX = x
  tb.offsetY = y

proc write*(tb: var TermBuffer, x, y: int, ch: string, style: Style) =
  let screenX = x + tb.offsetX
  let screenY = y + tb.offsetY
  
  if screenX < tb.clipX or screenX >= tb.clipX + tb.clipW:
    return
  if screenY < tb.clipY or screenY >= tb.clipY + tb.clipH:
    return
  
  if screenX >= 0 and screenX < tb.width and screenY >= 0 and screenY < tb.height:
    let idx = screenY * tb.width + screenX
    tb.cells[idx] = Cell(ch: ch, style: style)

proc writeText*(tb: var TermBuffer, x, y: int, text: string, style: Style) =
  var currentX = x
  var i = 0
  while i < text.len:
    let b = text[i].ord
    var charLen = 1
    var ch = ""
    
    if (b and 0x80) == 0:
      ch = $text[i]
    elif (b and 0xE0) == 0xC0 and i + 1 < text.len:
      ch = text[i..i+1]
      charLen = 2
    elif (b and 0xF0) == 0xE0 and i + 2 < text.len:
      ch = text[i..i+2]
      charLen = 3
    elif (b and 0xF8) == 0xF0 and i + 3 < text.len:
      ch = text[i..i+3]
      charLen = 4
    else:
      ch = "?"
    
    tb.write(currentX, y, ch, style)
    currentX += 1
    i += charLen

proc fillRect*(tb: var TermBuffer, x, y, w, h: int, ch: string, style: Style) =
  for dy in 0 ..< h:
    for dx in 0 ..< w:
      tb.write(x + dx, y + dy, ch, style)

proc clear*(tb: var TermBuffer) =
  let defaultStyle = Style(fg: white(), bg: black(), bold: false)
  for i in 0 ..< tb.cells.len:
    tb.cells[i] = Cell(ch: " ", style: defaultStyle)

proc clearTransparent*(tb: var TermBuffer) =
  let defaultStyle = Style(fg: white(), bg: black(), bold: false)
  for i in 0 ..< tb.cells.len:
    tb.cells[i] = Cell(ch: "", style: defaultStyle)

proc compositeBufferOnto*(dest: var TermBuffer, src: TermBuffer) =
  let w = min(dest.width, src.width)
  let h = min(dest.height, src.height)
  for y in 0 ..< h:
    let dr = y * dest.width
    let sr = y * src.width
    for x in 0 ..< w:
      let s = src.cells[sr + x]
      if s.ch.len > 0:
        dest.cells[dr + x] = s

# ================================================================
# DISPLAY
# ================================================================

proc colorsEqual(a, b: Color): bool =
  a.r == b.r and a.g == b.g and a.b == b.b

proc stylesEqual(a, b: Style): bool =
  colorsEqual(a.fg, b.fg) and colorsEqual(a.bg, b.bg) and
  a.bold == b.bold and a.underline == b.underline and
  a.italic == b.italic and a.dim == b.dim

proc cellsEqual(a, b: Cell): bool =
  a.ch == b.ch and stylesEqual(a.style, b.style)

proc buildStyleCode(style: Style, colorSupport: int): string =
  result = "\e["
  var codes: seq[string] = @["0"]
  
  if style.bold: codes.add("1")
  if style.dim: codes.add("2")
  if style.italic: codes.add("3")
  if style.underline: codes.add("4")
  
  case colorSupport
  of 16777216:
    codes.add("38;2;" & $style.fg.r & ";" & $style.fg.g & ";" & $style.fg.b)
  of 256:
    codes.add("38;5;" & $toAnsi256(style.fg))
  else:
    codes.add($toAnsi8(style.fg))
  
  if not (style.bg.r == 0 and style.bg.g == 0 and style.bg.b == 0):
    case colorSupport
    of 16777216:
      codes.add("48;2;" & $style.bg.r & ";" & $style.bg.g & ";" & $style.bg.b)
    of 256:
      codes.add("48;5;" & $toAnsi256(style.bg))
    else:
      codes.add($(toAnsi8(style.bg) + 10))
  
  result.add(codes.join(";") & "m")

proc display*(tb: var TermBuffer, prev: var TermBuffer, colorSupport: int) =
  when defined(emscripten):
    discard
  else:
    var output = ""
    let sizeChanged = prev.width != tb.width or prev.height != tb.height
    
    if sizeChanged:
      output.add("\e[2J")
      prev = newTermBuffer(tb.width, tb.height)
    
    # Pre-allocate string capacity for better performance (Windows consoles benefit)
    when defined(windows):
      output = newStringOfCap(tb.width * tb.height * 4)
    
    var haveLastStyle = false
    var lastStyle: Style
    var haveCursor = false
    var lastCursorY = -1
    var lastCursorXEnd = -1
    
    for y in 0 ..< tb.height:
      var x = 0
      while x < tb.width:
        let idx = y * tb.width + x
        let cell = tb.cells[idx]
        
        if not sizeChanged and prev.cells.len > 0 and idx < prev.cells.len and
           cellsEqual(prev.cells[idx], cell):
          x += 1
          continue
        
        var runLength = 1
        while x + runLength < tb.width:
          let nextIdx = idx + runLength
          let nextCell = tb.cells[nextIdx]
          
          if not sizeChanged and prev.cells.len > 0 and nextIdx < prev.cells.len and
             cellsEqual(prev.cells[nextIdx], nextCell):
            break
          
          if not cellsEqual(cell, nextCell):
            if stylesEqual(nextCell.style, cell.style):
              runLength += 1
            else:
              break
          else:
            runLength += 1
        
        if not haveCursor or lastCursorY != y or lastCursorXEnd != x:
          output.add("\e[" & $(y + 1) & ";" & $(x + 1) & "H")
        if (not haveLastStyle) or (not stylesEqual(cell.style, lastStyle)):
          output.add(buildStyleCode(cell.style, colorSupport))
          lastStyle = cell.style
          haveLastStyle = true
        
        for i in 0 ..< runLength:
          output.add(tb.cells[idx + i].ch)
        
        x += runLength
        haveCursor = true
        lastCursorY = y
        lastCursorXEnd = x
    
    # Batch write for better Windows console performance
    stdout.write(output)
    stdout.flushFile()

# ================================================================
# LAYER SYSTEM
# ================================================================

proc addLayer*(state: AppState, id: string, z: int): Layer =
  let layer = Layer(
    id: id,
    z: z,
    visible: true,
    buffer: newTermBuffer(state.termWidth, state.termHeight)
  )
  layer.buffer.clearTransparent()
  state.layers.add(layer)
  return layer

proc getLayer*(state: AppState, id: string): Layer =
  for layer in state.layers:
    if layer.id == id:
      return layer
  return nil

proc removeLayer*(state: AppState, id: string) =
  var i = 0
  while i < state.layers.len:
    if state.layers[i].id == id:
      state.layers.delete(i)
    else:
      i += 1

proc resizeLayers*(state: AppState, newWidth, newHeight: int) =
  ## Resize all layer buffers to match new terminal size
  for layer in state.layers:
    layer.buffer = newTermBuffer(newWidth, newHeight)
    layer.buffer.clearTransparent()

proc compositeLayers*(state: AppState) =
  if state.layers.len == 0:
    return
  
  for i in 0 ..< state.layers.len:
    for j in i + 1 ..< state.layers.len:
      if state.layers[j].z < state.layers[i].z:
        swap(state.layers[i], state.layers[j])
  
  for layer in state.layers:
    if layer.visible:
      compositeBufferOnto(state.currentBuffer, layer.buffer)

# ================================================================
# FPS CONTROL
# ================================================================

proc setTargetFps*(state: AppState, fps: float) =
  state.targetFps = fps

# ================================================================
# USER CALLBACKS
# ================================================================

when not defined(emscripten):
  var onInit*: proc(state: AppState) = nil
  var onUpdate*: proc(state: AppState, dt: float) = nil
  var onRender*: proc(state: AppState) = nil
  var onShutdown*: proc(state: AppState) = nil
  var onInput*: proc(state: AppState, event: InputEvent): bool = nil
  
  # Include user-specified file or default to index.nim at compile time
  # To run a specific file, use: ./compile.sh <filename>
  # Or compile with: nim c -d:userFile="filename" backstorie.nim
  const userFile {.strdefine.} = "index"
  
  # Macro to dynamically include file based on compile-time string
  macro includeUserFile(filename: static[string]): untyped =
    let file = if filename.endsWith(".nim"): filename else: filename & ".nim"
    if not fileExists(file):
      error("File not found: " & file & ". Create the file or specify a different one with -d:userFile=<filename>")
    result = newNimNode(nnkIncludeStmt)
    result.add(newIdentNode(file.replace(".nim", "")))
  
  includeUserFile(userFile)
  
  proc callOnSetup(state: AppState) =
    if not onInit.isNil:
      onInit(state)
  
  proc callOnFrame(state: AppState, dt: float) =
    if not onUpdate.isNil:
      onUpdate(state, dt)
  
  proc callOnDraw(state: AppState) =
    if not onRender.isNil:
      onRender(state)
  
  proc callOnShutdown(state: AppState) =
    if not onShutdown.isNil:
      onShutdown(state)
  
  proc callOnInput(state: AppState, event: InputEvent): bool =
    if not onInput.isNil:
      return onInput(state, event)
    return false

# ================================================================
# WEB EXPORTS
# ================================================================

when defined(emscripten):
  var globalState: AppState
  # Define callbacks directly as procs (not proc variables)
  proc userInit(state: AppState) =
    discard

  proc userUpdate(state: AppState, dt: float) =
    discard

  proc userRender(state: AppState) =
    # Clear the screen
    state.currentBuffer.clear()
    
    let w = state.termWidth
    let h = state.termHeight
    
    # Define styles
    var borderStyle = defaultStyle()
    borderStyle.fg = green()
    
    var welcomeStyle = defaultStyle()
    welcomeStyle.fg = cyan()
    welcomeStyle.bold = true
    
    var infoStyle = defaultStyle()
    infoStyle.fg = yellow()
    
    var hintStyle = defaultStyle()
    hintStyle.fg = gray(180)
    
    # Draw border box using box drawing characters
    # Top border
    state.currentBuffer.write(0, 0, "╔", borderStyle)
    for x in 1 ..< w - 1:
      state.currentBuffer.write(x, 0, "═", borderStyle)
    state.currentBuffer.write(w - 1, 0, "╗", borderStyle)
    
    # Side borders
    for y in 1 ..< h - 1:
      state.currentBuffer.write(0, y, "║", borderStyle)
      state.currentBuffer.write(w - 1, y, "║", borderStyle)
    
    # Bottom border
    state.currentBuffer.write(0, h - 1, "╚", borderStyle)
    for x in 1 ..< w - 1:
      state.currentBuffer.write(x, h - 1, "═", borderStyle)
    state.currentBuffer.write(w - 1, h - 1, "╝", borderStyle)
    
    # Calculate center position
    let centerY = h div 2
    
    # Welcome message
    let welcomeMsg = "Welcome to Backstorie engine!"
    let welcomeX = (w - welcomeMsg.len) div 2
    state.currentBuffer.writeText(welcomeX, centerY - 2, welcomeMsg, welcomeStyle)
    
    # Display dimensions and FPS
    let infoMsg = "Window: " & $w & "x" & $h & " | FPS: " & formatFloat(state.fps, ffDecimal, 1)
    let infoX = (w - infoMsg.len) div 2
    state.currentBuffer.writeText(infoX, centerY, infoMsg, infoStyle)
    
    # Exit hint
    let hintMsg = "Press Q or ESC to quit."
    let hintX = (w - hintMsg.len) div 2
    state.currentBuffer.writeText(hintX, centerY + 2, hintMsg, hintStyle)

  proc userInput(state: AppState, event: InputEvent): bool =
    if event.kind == KeyEvent and event.keyAction == Press:
      # Check for Q key or ESC key
      if event.keyCode == ord('q') or event.keyCode == ord('Q') or event.keyCode == INPUT_ESCAPE:
        state.running = false
        return true
    return false

  proc userShutdown(state: AppState) =
    discard
  
  proc emInit(width, height: int) {.exportc.} =
    globalState = new(AppState)
    globalState.termWidth = width
    globalState.termHeight = height
    globalState.currentBuffer = newTermBuffer(width, height)
    globalState.previousBuffer = newTermBuffer(width, height)
    globalState.colorSupport = 16777216  # Full RGB support in browser
    globalState.running = true
    globalState.layers = @[]
    globalState.targetFps = 60.0
    globalState.inputParser = newTerminalInputParser()
    globalState.lastMouseX = 0
    globalState.lastMouseY = 0
    globalState.fps = 60.0
    
    userInit(globalState)
  
  proc emUpdate(deltaMs: float) {.exportc.} =
    let dt = deltaMs / 1000.0
    globalState.totalTime += dt
    globalState.frameCount += 1
    
    if globalState.totalTime - globalState.lastFpsUpdate >= 0.5:
      globalState.fps = 1.0 / dt
      globalState.lastFpsUpdate = globalState.totalTime
    
    userUpdate(globalState, dt)
    userRender(globalState)
    
    compositeLayers(globalState)
  
  proc emResize(width, height: int) {.exportc.} =
    globalState.termWidth = width
    globalState.termHeight = height
    globalState.currentBuffer = newTermBuffer(width, height)
    globalState.previousBuffer = newTermBuffer(width, height)
    resizeLayers(globalState, width, height)
  
  proc emGetCell(x, y: int): cstring {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return cstring(globalState.currentBuffer.cells[idx].ch)
    return cstring("")
  
  proc emGetCellFgR(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.fg.r.int
    return 255
  
  proc emGetCellFgG(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.fg.g.int
    return 255
  
  proc emGetCellFgB(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.fg.b.int
    return 255
  
  proc emGetCellBgR(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.bg.r.int
    return 0
  
  proc emGetCellBgG(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.bg.g.int
    return 0
  
  proc emGetCellBgB(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return globalState.currentBuffer.cells[idx].style.bg.b.int
    return 0
  
  proc emGetCellBold(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return if globalState.currentBuffer.cells[idx].style.bold: 1 else: 0
    return 0
  
  proc emGetCellItalic(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return if globalState.currentBuffer.cells[idx].style.italic: 1 else: 0
    return 0
  
  proc emGetCellUnderline(x, y: int): int {.exportc.} =
    if x >= 0 and x < globalState.currentBuffer.width and 
       y >= 0 and y < globalState.currentBuffer.height:
      let idx = y * globalState.currentBuffer.width + x
      return if globalState.currentBuffer.cells[idx].style.underline: 1 else: 0
    return 0
  
  proc emHandleKeyPress(keyCode: int, shift, alt, ctrl: int) {.exportc.} =
    var mods: set[uint8] = {}
    if shift != 0: mods.incl ModShift
    if alt != 0: mods.incl ModAlt
    if ctrl != 0: mods.incl ModCtrl
    
    let event = InputEvent(kind: KeyEvent, keyCode: keyCode, keyMods: mods, keyAction: Press)
    discard userInput(globalState, event)
  
  proc emHandleTextInput(text: cstring) {.exportc.} =
    let event = InputEvent(kind: TextEvent, text: $text)
    discard userInput(globalState, event)
  
  proc emHandleMouseClick(x, y, button, shift, alt, ctrl: int) {.exportc.} =
    var mods: set[uint8] = {}
    if shift != 0: mods.incl ModShift
    if alt != 0: mods.incl ModAlt
    if ctrl != 0: mods.incl ModCtrl
    
    let mouseButton = case button
      of 0: Left
      of 1: Middle
      of 2: Right
      else: Unknown
    
    let event = InputEvent(kind: MouseEvent, button: mouseButton, mouseX: x, mouseY: y, mods: mods, action: Press)
    discard userInput(globalState, event)
  
  proc emHandleMouseMove(x, y: int) {.exportc.} =
    globalState.lastMouseX = x
    globalState.lastMouseY = y
    let event = InputEvent(kind: MouseMoveEvent, moveX: x, moveY: y, moveMods: {})
    discard userInput(globalState, event)

proc showHelp() =
  echo "backstorie v" & version
  echo "Terminal engine with sophisticated input parsing"
  echo ""
  echo "Usage: Use the run.sh script (recommended)"
  echo "       ./run.sh [OPTIONS] [FILE]"
  echo ""
  echo "Or compile directly:"
  echo "       nim c -r backstorie.nim [OPTIONS]"
  echo ""
  echo "Options:"
  echo "  -h, --help            Show this help message"
  echo "  -v, --version         Show version information"
  echo "  --fps <num>          Set target FPS (default 60; Windows non-WT default 30)"
  echo "                       Can also use BACKSTORIE_TARGET_FPS env var"
  echo ""
  echo "Examples:"
  echo "  ./run.sh example_boxes              # Run example_boxes.nim"
  echo "  ./run.sh                            # Run default index.nim"
  echo ""
  echo "Note: To specify a file at compile time, add it to the include list in backstorie.nim"

proc main() =
  var p = initOptParser()
  var cliFps: float = 0.0
  
  for kind, key, val in p.getopt():
    case kind
    of cmdLongOption, cmdShortOption:
      case key
      of "help", "h":
        showHelp()
        quit(0)
      of "version", "v":
        echo "backstorie version " & version
        quit(0)
      else:
        echo "Unknown option: " & key
        echo "Use --help for usage information"
        quit(1)
    of cmdArgument:
      echo "Unexpected argument: " & key
      echo "Note: To run a custom file, use: nim c -r -d:userFile=<file> backstorie.nim"
      quit(1)
    else: discard
    # Handle long option with value (e.g., --fps 30 or --fps=30)
    if kind in {cmdLongOption, cmdShortOption}:
      case key
      of "fps":
        if val.len == 0:
          echo "--fps requires a value (e.g., --fps 30)"
          quit(1)
        try:
          let f = parseFloat(val)
          if f <= 0:
            echo "--fps must be > 0"
            quit(1)
          cliFps = f
        except:
          echo "Invalid --fps value: " & val
          quit(1)
      else: discard
  
  when not defined(emscripten):
    var state = new(AppState)
    state.colorSupport = detectColorSupport()
    state.layers = @[]
    state.inputParser = newTerminalInputParser()
    state.targetFps = 60.0
    when defined(windows):
      # If not Windows Terminal (WT_SESSION absent), lower default FPS for performance
      if getEnv("WT_SESSION").len == 0:
        state.targetFps = 30.0
    let fpsEnv = getEnv("BACKSTORIE_TARGET_FPS")
    if fpsEnv.len > 0:
      try:
        let envFps = parseFloat(fpsEnv)
        if envFps > 0:
          state.targetFps = envFps
      except:
        discard  # Ignore invalid values
    if cliFps > 0.0:
      state.targetFps = cliFps
    
    globalTerminalState = setupRawMode()
    hideCursor()
    enableMouseReporting()
    enableKeyboardProtocol()
    
    setupSignalHandlers(proc(sig: cint) {.noconv.} = globalRunning = false)
    
    let (w, h) = getTermSize()
    state.termWidth = w
    state.termHeight = h
    state.currentBuffer = newTermBuffer(w, h)
    state.previousBuffer = newTermBuffer(w, h)
    state.running = true
    
    callOnSetup(state)
    
    var lastTime = epochTime()
    
    try:
      while state.running and globalRunning:
        if not globalRunning:
          break
          
        let currentTime = epochTime()
        let deltaTime = currentTime - lastTime
        lastTime = currentTime
        
        # Process input events
        let events = getInputEvent(state)
        for event in events:
          if event.kind == ResizeEvent:
            state.termWidth = event.newWidth
            state.termHeight = event.newHeight
            state.currentBuffer = newTermBuffer(event.newWidth, event.newHeight)
            state.previousBuffer = newTermBuffer(event.newWidth, event.newHeight)
            state.resizeLayers(event.newWidth, event.newHeight)
            stdout.write("\e[2J\e[H")
            stdout.flushFile()
          else:
            discard callOnInput(state, event)
        
        let (newW, newH) = getTermSize()
        if newW != state.termWidth or newH != state.termHeight:
          state.termWidth = newW
          state.termHeight = newH
          state.currentBuffer = newTermBuffer(newW, newH)
          state.previousBuffer = newTermBuffer(newW, newH)
          state.resizeLayers(newW, newH)
          stdout.write("\e[2J\e[H")
          stdout.flushFile()
        
        state.totalTime += deltaTime
        state.frameCount += 1
        
        if state.totalTime - state.lastFpsUpdate >= 0.5:
          state.fps = 1.0 / deltaTime
          state.lastFpsUpdate = state.totalTime
        
        callOnFrame(state, deltaTime)
        
        swap(state.currentBuffer, state.previousBuffer)
        callOnDraw(state)
        compositeLayers(state)
        
        state.currentBuffer.display(state.previousBuffer, state.colorSupport)
        
        if state.targetFps > 0.0:
          let frameTime = epochTime() - currentTime
          let targetFrameTime = 1.0 / state.targetFps
          let sleepTime = targetFrameTime - frameTime
          if sleepTime > 0:
            sleep(int(sleepTime * 1000))
        
        if not globalRunning:
          break
    finally:
      callOnShutdown(state)
      disableKeyboardProtocol()
      disableMouseReporting()
      showCursor()
      clearScreen()
      restoreTerminal(globalTerminalState)
      stdout.write("\n")
      stdout.flushFile()

when isMainModule:
  main()