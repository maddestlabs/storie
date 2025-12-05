## Storie Index - Default markdown-based entry point
## This demonstrates using the Storie engine with markdown code blocks

import strutils, times, os, parseopt, sequtils
import storie

# Emscripten support for dynamic gist loading
when defined(emscripten):
  {.passL: "-s EXPORTED_FUNCTIONS=['_main','_loadMarkdownFromJS','_setWaitingForGist']".}
  {.passL: "-s EXPORTED_RUNTIME_METHODS=['ccall','cwrap']".}
  {.emit: """
  #include <emscripten.h>
  """.}

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
        let blk = CodeBlock(
          code: codeLines.join("\n"),
          lifecycle: lifecycle,
          language: language
        )
        result.add(blk)
    
    inc i

# ================================================================
# LIFECYCLE MANAGEMENT
# ================================================================

type
  StorieContext = ref object
    codeBlocks: seq[CodeBlock]
    
var storieCtx: StorieContext
var customMarkdownPath: string = ""  # Command-line specified markdown file
var contentLoaded: bool = false  # Track if content has been loaded
var contentInitRun: bool = false  # Track if init blocks have been executed

proc loadMarkdownContent(filePath: string): string =
  ## Load markdown content from a file path
  if fileExists(filePath):
    return readFile(filePath)
  else:
    echo "Warning: ", filePath, " not found"
    return ""

proc loadAndParseMarkdown(markdownPath: string = ""): seq[CodeBlock] =
  ## Load and parse markdown from specified path or default index.md
  when defined(emscripten):
    # In WASM, embed the default markdown at compile time
    # (can be overridden via loadMarkdownFromJS)
    const mdContent = staticRead("index.md")
    return parseMarkdown(mdContent)
  else:
    # Native: read from file (custom path or default index.md)
    let targetPath = if markdownPath.len > 0: markdownPath else: "index.md"
    let mdContent = loadMarkdownContent(targetPath)
    if mdContent.len > 0:
      return parseMarkdown(mdContent)
    else:
      return @[]

proc shouldWaitForGist(): bool =
  ## Check if JavaScript wants us to wait for a gist
  when defined(emscripten):
    var result: cint
    {.emit: """
    `result` = EM_ASM_INT({
      if (typeof Module !== 'undefined' && 
          typeof Module.waitingForGist !== 'undefined' && 
          Module.waitingForGist === true) {
        return 1;
      }
      return 0;
    });
    """.}
    return result == 1
  else:
    return false

proc runLifecycleBlocks(lifecycle: string) =
  ## Execute all code blocks for a given lifecycle
  if storieCtx.isNil:
    return
  
  if storieCtx.codeBlocks.len == 0:
    # No content loaded yet
    return
  
  var executedCount = 0
  for blk in storieCtx.codeBlocks:
    if blk.lifecycle == lifecycle:
      discard executeNiminiCode(blk.code)
      executedCount += 1
  
  # Log render execution on first few frames to verify it's running
  when defined(emscripten):
    if lifecycle == "render" and getFrameCount() < 5:
      echo "Frame ", getFrameCount(), ": Executed ", executedCount, " ", lifecycle, " blocks"

proc loadContent(mdContent: string) =
  ## Load markdown content - can be called at any time
  if storieCtx.isNil:
    storieCtx = StorieContext()
  
  # Parse the markdown
  let newBlocks = parseMarkdown(mdContent)
  
  echo "Parsed ", newBlocks.len, " code blocks from markdown content"
  
  # Replace code blocks (don't just assign, ensure it's a fresh reference)
  storieCtx.codeBlocks = newBlocks
  contentLoaded = true
  contentInitRun = false
  
  # Show what we loaded
  let initCount = storieCtx.codeBlocks.filterIt(it.lifecycle == "init").len
  let renderCount = storieCtx.codeBlocks.filterIt(it.lifecycle == "render").len
  let updateCount = storieCtx.codeBlocks.filterIt(it.lifecycle == "update").len
  echo "Loaded content - Init: ", initCount, ", Update: ", updateCount, ", Render: ", renderCount
  echo "storieCtx.codeBlocks.len is now: ", storieCtx.codeBlocks.len

proc tryRunContentInit() =
  ## Try to run init blocks if content is loaded but init hasn't run yet
  if not contentLoaded:
    return
  
  if contentInitRun:
    return
  
  echo "=== Running content init blocks ==="
  runLifecycleBlocks("init")
  contentInitRun = true
  echo "=== Content initialized and ready ==="

proc initStorieContext() =
  ## Initialize the Storie context - loads default content unless waiting for dynamic content
  
  # If storieCtx already exists with content, don't reinitialize
  if not storieCtx.isNil and storieCtx.codeBlocks.len > 0:
    echo "storieCtx already has ", storieCtx.codeBlocks.len, " code blocks, skipping reinitialization"
    return
  
  storieCtx = StorieContext(codeBlocks: @[])
  
  when defined(emscripten):
    # Check if JavaScript wants us to wait for a gist
    if shouldWaitForGist():
      echo "Waiting for dynamic content (gist), skipping default markdown"
      return
  
  # Load default content
  let mdContent = when defined(emscripten):
    const content = staticRead("index.md")
    content
  else:
    let targetPath = if customMarkdownPath.len > 0: customMarkdownPath else: "index.md"
    loadMarkdownContent(targetPath)
  
  if mdContent.len > 0:
    let sourceName = if customMarkdownPath.len > 0: customMarkdownPath else: "index.md"
    echo "Loading default content from ", sourceName
    loadContent(mdContent)

# ================================================================
# EMSCRIPTEN JAVASCRIPT INTEROP
# ================================================================

when defined(emscripten):
  # JavaScript-callable function to check if we should wait for gist
  var waitingForGist = false
  
  proc setWaitingForGist() {.cdecl, exportc.} =
    ## Tell WASM to skip default markdown and wait for gist
    waitingForGist = true
    echo "Waiting for gist to load, skipping default markdown"
  
  # JavaScript-callable function to load markdown dynamically (for gist support)
  proc loadMarkdownFromJS(mdPtr: cstring) {.cdecl, exportc.} =
    ## Load markdown content from JavaScript (used for ?gist= parameter)
    let mdContent = $mdPtr
    echo "Loading markdown from JavaScript (", mdContent.len, " bytes)"
    waitingForGist = false
    loadContent(mdContent)
    echo "Content loaded, will initialize when app is ready"

# ================================================================
# CUSTOM UPDATE HOOK
# ================================================================

proc customUpdate() =
  ## Custom update logic called every frame
  # Try to initialize content if it hasn't been yet
  # (handles race condition where gist loads during first few frames)
  tryRunContentInit()
  
  # Run update lifecycle blocks
  runLifecycleBlocks("update")

proc customRender() =
  ## Custom render logic called every frame
  # Try init again right before render (catches late-loading gists)
  tryRunContentInit()
  
  # Run render lifecycle blocks
  runLifecycleBlocks("render")

proc customInput() =
  ## Custom input handler
  runLifecycleBlocks("input")

proc customShutdown() =
  ## Custom shutdown handler
  runLifecycleBlocks("shutdown")

# ================================================================
# COMMAND-LINE PARSING
# ================================================================

var enable3DMode: bool = false

proc parseCommandLine() =
  ## Parse command-line arguments (desktop only)
  when not defined(emscripten):
    var p = initOptParser()
    while true:
      p.next()
      case p.kind
      of cmdEnd: break
      of cmdShortOption, cmdLongOption:
        case p.key
        of "markdown", "m":
          customMarkdownPath = p.val
          echo "Using custom markdown file: ", customMarkdownPath
        of "3d", "3D":
          enable3DMode = true
          echo "3D rendering mode enabled"
        of "help", "h":
          echo "Storie - Creative coding platform"
          echo ""
          echo "Usage: storie [options]"
          echo ""
          echo "Options:"
          echo "  -m, --markdown FILE    Load markdown from custom file (default: index.md)"
          echo "  --3d                   Enable 3D rendering mode"
          echo "  -h, --help             Show this help message"
          quit(0)
        else:
          echo "Unknown option: ", p.key
          echo "Use --help for usage information"
          quit(1)
      of cmdArgument:
        # Allow markdown file as positional argument
        if customMarkdownPath.len == 0:
          customMarkdownPath = p.key
          echo "Using markdown file: ", customMarkdownPath

# ================================================================
# ENTRY POINT
# ================================================================

when isMainModule:
  parseCommandLine()
  
  # Initialize storie context (load markdown)
  initStorieContext()
  
  # Initialize and run the Storie engine
  initStorie(
    width = 800,
    height = 600,
    enable3D = enable3DMode,
    updateCallback = customUpdate,
    renderCallback = customRender,
    inputCallback = customInput,
    shutdownCallback = customShutdown
  )
  
  # Run main loop (blocking call)
  runStorie()
