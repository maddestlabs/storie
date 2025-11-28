# Storie - Markdown-based Nim execution engine
# Parses index.md for Nim code blocks and executes them using Nimini

import strutils, tables, os
import src/nimini/[runtime, tokenizer, parser, autopragma]

# ================================================================
# MARKDOWN PARSER
# ================================================================

type
  CodeBlock = object
    code: string
    lifecycle: string  # "render", "update", "init", "input", "shutdown"
    language: string

proc parseMarkdown(content: string): seq[CodeBlock] =
  ## Parse Markdown content and extract Nim code blocks with lifecycle hooks
  result = @[]
  var lines = content.splitLines()
  var i = 0
  
  while i < lines.len:
    let line = lines[i].strip()
    
    # Look for code block start: ```nim or ``` nim
    if line.startsWith("```") or line.startsWith("``` "):
      var headerParts = line[3..^1].strip().split()
      if headerParts.len > 0 and headerParts[0] == "nim":
        var lifecycle = ""
        var language = "nim"
        
        # Check for on:* attribute (e.g., on:render, on:update)
        for part in headerParts:
          if part.startsWith("on:"):
            lifecycle = part[3..^1]
            break
        
        # Extract code block content
        var codeLines: seq[string] = @[]
        inc i
        while i < lines.len:
          if lines[i].strip().startsWith("```"):
            break
          codeLines.add(lines[i])
          inc i
        
        # Add the code block
        let codeBlock = CodeBlock(
          code: codeLines.join("\n"),
          lifecycle: lifecycle,
          language: language
        )
        result.add(codeBlock)
    
    inc i

# ================================================================
# NIMINI INTEGRATION
# ================================================================

type
  NiminiContext = ref object
    env: ref Env

# ================================================================
# NIMINI WRAPPERS - Bridge backstorie functions to Nimini
# ================================================================

# Global references to layers (set in initStorieContext)
var gBgLayer: Layer
var gFgLayer: Layer
var gTextStyle, gBorderStyle, gInfoStyle: Style

# Type conversion functions
proc nimini_int(env: ref Env; args: seq[Value]): Value =
  ## Convert a value to integer
  if args.len > 0:
    case args[0].kind
    of vkInt: return args[0]
    of vkFloat: return valInt(args[0].f.int)
    of vkString: 
      try:
        return valInt(parseInt(args[0].s))
      except:
        return valInt(0)
    of vkBool: return valInt(if args[0].b: 1 else: 0)
    else: return valInt(0)
  return valInt(0)

proc nimini_float(env: ref Env; args: seq[Value]): Value =
  ## Convert a value to float
  if args.len > 0:
    case args[0].kind
    of vkFloat: return args[0]
    of vkInt: return valFloat(args[0].i.float)
    of vkString: 
      try:
        return valFloat(parseFloat(args[0].s))
      except:
        return valFloat(0.0)
    of vkBool: return valFloat(if args[0].b: 1.0 else: 0.0)
    else: return valFloat(0.0)
  return valFloat(0.0)

proc nimini_str(env: ref Env; args: seq[Value]): Value =
  ## Convert a value to string
  if args.len > 0:
    return valString($args[0])
  return valString("")

# Print function
proc print(env: ref Env; args: seq[Value]): Value {.nimini.} =
  var output = ""
  for i, arg in args:
    if i > 0: output.add(" ")
    case arg.kind
    of vkInt: output.add($arg.i)
    of vkFloat: output.add($arg.f)
    of vkString: output.add(arg.s)
    of vkBool: output.add($arg.b)
    of vkNil: output.add("nil")
    else: output.add("<value>")
  echo output
  return valNil()

# Buffer drawing functions
proc bgClear(env: ref Env; args: seq[Value]): Value {.nimini.} =
  gBgLayer.buffer.clear()
  return valNil()

proc bgClearTransparent(env: ref Env; args: seq[Value]): Value {.nimini.} =
  gBgLayer.buffer.clearTransparent()
  return valNil()

proc fgClear(env: ref Env; args: seq[Value]): Value {.nimini.} =
  gFgLayer.buffer.clear()
  return valNil()

proc fgClearTransparent(env: ref Env; args: seq[Value]): Value {.nimini.} =
  gFgLayer.buffer.clearTransparent()
  return valNil()

proc bgWrite(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 3:
    let x = args[0].i
    let y = args[1].i
    let ch = args[2].s
    let style = if args.len >= 4: gTextStyle else: gTextStyle  # TODO: support style arg
    gBgLayer.buffer.write(x, y, ch, style)
  return valNil()

proc fgWrite(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 3:
    let x = args[0].i
    let y = args[1].i
    let ch = args[2].s
    let style = if args.len >= 4: gTextStyle else: gTextStyle
    gFgLayer.buffer.write(x, y, ch, style)
  return valNil()

proc bgWriteText(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 3:
    let x = args[0].i
    let y = args[1].i
    let text = args[2].s
    gBgLayer.buffer.writeText(x, y, text, gTextStyle)
  return valNil()

proc fgWriteText(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 3:
    let x = args[0].i
    let y = args[1].i
    let text = args[2].s
    gFgLayer.buffer.writeText(x, y, text, gTextStyle)
  return valNil()

proc bgFillRect(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 5:
    let x = args[0].i
    let y = args[1].i
    let w = args[2].i
    let h = args[3].i
    let ch = args[4].s
    gBgLayer.buffer.fillRect(x, y, w, h, ch, gTextStyle)
  return valNil()

proc fgFillRect(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len >= 5:
    let x = args[0].i
    let y = args[1].i
    let w = args[2].i
    let h = args[3].i
    let ch = args[4].s
    gFgLayer.buffer.fillRect(x, y, w, h, ch, gTextStyle)
  return valNil()

proc createNiminiContext(state: AppState): NiminiContext =
  ## Create a Nimini interpreter context with exposed APIs
  initRuntime()
  
  # Register type conversion functions with custom names
  registerNative("int", nimini_int)
  registerNative("float", nimini_float)
  registerNative("str", nimini_str)
  
  # Auto-register all {.nimini.} pragma functions
  exportNiminiProcs(
    print,
    bgClear, bgClearTransparent, bgWrite, bgWriteText, bgFillRect,
    fgClear, fgClearTransparent, fgWrite, fgWriteText, fgFillRect
  )
  
  let ctx = NiminiContext(env: runtimeEnv)
  
  return ctx

proc executeCodeBlock(context: NiminiContext, codeBlock: CodeBlock, state: AppState): bool =
  ## Execute a code block using Nimini
  if codeBlock.code.strip().len == 0:
    return true
  
  try:
    # Build a wrapper that includes state access
    # We expose common variables directly in the script context
    var scriptCode = ""
    
    # Add state field accessors as local variables
    scriptCode.add("var termWidth = " & $state.termWidth & "\n")
    scriptCode.add("var termHeight = " & $state.termHeight & "\n")
    scriptCode.add("var fps = " & formatFloat(state.fps, ffDecimal, 2) & "\n")
    scriptCode.add("var frameCount = " & $state.frameCount & "\n")
    scriptCode.add("\n")
    
    # Add user code
    scriptCode.add(codeBlock.code)
    
    # Debug: print generated script (uncomment to debug)
    # echo "=== Generated Script ===\n", scriptCode, "\n=== End Script ===\n"
    
    let tokens = tokenizeDsl(scriptCode)
    let program = parseDsl(tokens)
    execProgram(program, context.env)
    
    return true
  except:
    echo "Error in ", codeBlock.lifecycle, " block: ", getCurrentExceptionMsg()
    return false

# ================================================================
# DEFAULT STYLES (available to code blocks)
# ================================================================

var textStyle = defaultStyle()
textStyle.fg = cyan()
textStyle.bold = true

var borderStyle = defaultStyle()
borderStyle.fg = green()

var infoStyle = defaultStyle()
infoStyle.fg = yellow()

# ================================================================
# LIFECYCLE MANAGEMENT
# ================================================================

type
  StorieContext = ref object
    codeBlocks: seq[CodeBlock]
    niminiContext: NiminiContext
    # Pre-compiled layer references
    bgLayer: Layer
    fgLayer: Layer
    
var storieCtx: StorieContext

proc loadAndParseMarkdown(): seq[CodeBlock] =
  ## Load index.md and parse it for code blocks
  let mdPath = "index.md"
  
  if not fileExists(mdPath):
    echo "Warning: index.md not found, using default behavior"
    return @[]
  
  try:
    let content = readFile(mdPath)
    return parseMarkdown(content)
  except:
    echo "Error reading index.md: ", getCurrentExceptionMsg()
    return @[]

# ================================================================
# INITIALIZE CONTEXT AND LAYERS
# ================================================================

proc initStorieContext(state: AppState) =
  ## Initialize the Storie context, parse Markdown, and set up layers
  storieCtx = StorieContext()
  storieCtx.codeBlocks = loadAndParseMarkdown()
  
  # Create default layers that code blocks can use
  storieCtx.bgLayer = state.addLayer("background", 0)
  storieCtx.fgLayer = state.addLayer("foreground", 10)
  
  # Set global references for Nimini wrappers
  gBgLayer = storieCtx.bgLayer
  gFgLayer = storieCtx.fgLayer
  gTextStyle = textStyle
  gBorderStyle = borderStyle
  gInfoStyle = infoStyle
  
  storieCtx.niminiContext = createNiminiContext(state)
  
  echo "Loaded ", storieCtx.codeBlocks.len, " code blocks from index.md"
  
  # Execute init code blocks
  for codeBlock in storieCtx.codeBlocks:
    if codeBlock.lifecycle == "init":
      discard executeCodeBlock(storieCtx.niminiContext, codeBlock, state)

# ================================================================
# CALLBACK IMPLEMENTATIONS
# ================================================================

onInit = proc(state: AppState) =
  initStorieContext(state)

onUpdate = proc(state: AppState, dt: float) =
  if storieCtx.isNil:
    return
  
  # Execute update code blocks
  for codeBlock in storieCtx.codeBlocks:
    if codeBlock.lifecycle == "update":
      discard executeCodeBlock(storieCtx.niminiContext, codeBlock, state)

onRender = proc(state: AppState) =
  if storieCtx.isNil:
    # Fallback rendering if no context
    state.currentBuffer.clear()
    let msg = "No index.md found or parsing failed"
    let x = (state.termWidth - msg.len) div 2
    let y = state.termHeight div 2
    state.currentBuffer.writeText(x, y, msg, textStyle)
    return
  
  # Execute render code blocks
  for codeBlock in storieCtx.codeBlocks:
    if codeBlock.lifecycle == "render":
      discard executeCodeBlock(storieCtx.niminiContext, codeBlock, state)

onInput = proc(state: AppState, event: InputEvent): bool =
  if storieCtx.isNil:
    return false
  
  # Default quit behavior (Q or ESC)
  if event.kind == KeyEvent and event.keyAction == Press:
    if event.keyCode == ord('q') or event.keyCode == ord('Q') or event.keyCode == INPUT_ESCAPE:
      state.running = false
      return true
  
  # Execute input code blocks
  for codeBlock in storieCtx.codeBlocks:
    if codeBlock.lifecycle == "input":
      if executeCodeBlock(storieCtx.niminiContext, codeBlock, state):
        return true
  
  return false

onShutdown = proc(state: AppState) =
  if storieCtx.isNil:
    return
  
  # Execute shutdown code blocks
  for codeBlock in storieCtx.codeBlocks:
    if codeBlock.lifecycle == "shutdown":
      discard executeCodeBlock(storieCtx.niminiContext, codeBlock, state)
  
  # TODO: Clean up Nimini context
