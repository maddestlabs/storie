---
title: "t|Storie Editor"
theme: "neotopia"
editorX: 0
editorY: 2
dropTarget: true
fontsize: 16
shaders: "invert+ruledlines+paper"
---

# t|Storie Text Editor

File size increase: use a Google font

A fully-featured text editor with Unicode support, gap buffer optimization, and minimap visualization!

```nim on:init
# ===================================================================
# State Management
# ===================================================================

# Track frame times for FPS display
var frameStartTime = getTime()
var lastFrameTime = frameStartTime
var displayFps = 60

# Load initial content from URL parameter if provided
var initialContent = @[""]
let contentParam = getParam("load")
var currentFileName = "untitled"
var isSaved = 1
var lastSaveTime = ""

if contentParam != "":
  # Content will be loaded from browser:key or decode:xxx by tstorie itself
  # We just initialize with current content
  add(initialContent, "# Loading...")
else:
  # Default template
  add(initialContent, "")

var editor = newEditor(initialContent)

# Try to restore auto-saved content if no URL parameter provided
if contentParam == "":
  let autoSaved = localStorage_getItem("__autosave__")
  if autoSaved != "" and autoSaved != "#":
    editor = newEditor(autoSaved)
    statusMessage = "Restored auto-saved content (Ctrl+S to save)"
    lastAutoSaveContent = autoSaved

# Focus system: 0=editor, 1=menu, 2=dialog
var focusedComponent = 0

# Menu state
var activeMenu = ""
var hoveredMenuItem = -1

# Dialog state
var showHelp = 0
var showSaveDialog = 0
var showLoadDialog = 0
var showShareDialog = 0
var showLoadGistDialog = 0
var showSaveGistDialog = 0

# Dialog data
var statusMessage = "Ready - Click File menu or use Ctrl+S/O/E shortcuts"
var saveFileName = ""
var shareUrl = ""
var shareUrlReady = 0
var pasteInProgress = 0
var lastPasteCheck = ""
var gistIdInput = ""
var gistDescription = ""
var gistResultUrl = ""
var savedFiles: seq[string] = @[]
var loadSelection = 0

# Selection state
var hasSelection = 0
var selStartLine = 0
var selStartCol = 0
var selEndLine = 0
var selEndCol = 0

# Mouse drag state
var mousePressed = 0
var isDraggingScrollbar = 0
var isDraggingMinimap = 0
var isDraggingText = 0
var dragStartX = 0
var dragStartY = 0

# Auto-save state
var autoSaveTimer = 0
var autoSaveInterval = 180  # Auto-save every 180 frames (~3 seconds at 60fps)
var lastAutoSaveContent = ""

# Statistics
var keyPressCount = 0
var lastKeyCode = 0

# Helper: Clear selection
proc clearSelection() =
  hasSelection = 0

# Helper: Find previous word boundary
proc findPrevWord(line: string, col: int): int =
  if col <= 0:
    return 0
  var pos = col - 1
  # Skip spaces backward
  while pos > 0 and line[pos] == ' ':
    pos = pos - 1
  # Skip word backward
  while pos > 0 and line[pos] != ' ':
    pos = pos - 1
  if line[pos] == ' ' and pos < col - 1:
    pos = pos + 1
  return pos

# Helper: Find next word boundary
proc findNextWord(line: string, col: int): int =
  if col >= len(line):
    return len(line)
  var pos = col
  # Skip current word forward
  while pos < len(line) and line[pos] != ' ':
    pos = pos + 1
  # Skip spaces forward
  while pos < len(line) and line[pos] == ' ':
    pos = pos + 1
  return pos

# Helper: Get selected text
proc getSelectedText(): string =
  if hasSelection == 0:
    return ""
  
  var result = ""
  if selStartLine == selEndLine:
    # Single line selection
    let line = editorGetLine(editor, selStartLine)
    let startCol = min(selStartCol, selEndCol)
    let endCol = max(selStartCol, selEndCol)
    return line[startCol..<endCol]
  else:
    # Multi-line selection
    let startL = min(selStartLine, selEndLine)
    let endL = max(selStartLine, selEndLine)
    let startC = if selStartLine < selEndLine: selStartCol else: selEndCol
    let endC = if selStartLine < selEndLine: selEndCol else: selStartCol
    
    for i in startL..endL:
      let line = editorGetLine(editor, i)
      if i == startL:
        result = result & line[startC..<len(line)]
      elif i == endL:
        result = result & "\n" & line[0..<endC]
      else:
        result = result & "\n" & line
  
  return result

# Helper: Delete selected text
proc deleteSelection() =
  if hasSelection == 0:
    return
  
  # Move cursor to start of selection
  let startL = min(selStartLine, selEndLine)
  let endL = max(selStartLine, selEndLine)
  let startC = if selStartLine < selEndLine: selStartCol else: selEndCol
  let endC = if selStartLine < selEndLine: selEndCol else: selStartCol
  
  editorSetCursor(editor, startL, startC)
  
  # Delete character by character (simple approach)
  if startL == endL:
    # Single line
    for i in 0..<(endC - startC):
      editorDelete(editor)
  else:
    # Multi-line - delete to end of first line, then delete lines, then chars on last line
    let firstLineLen = len(editorGetLine(editor, startL))
    for i in startC..<firstLineLen:
      editorDelete(editor)
    
    # Delete newline and merge with next line
    if endL > startL:
      editorDelete(editor)
    
    # Delete middle lines
    for i in (startL+1)..<endL:
      let lineLen = len(editorGetLine(editor, startL))
      for j in 0..<lineLen:
        editorDelete(editor)
      if i < endL - 1:
        editorDelete(editor)  # newline
    
    # Delete chars on last line
    for i in 0..<endC:
      editorDelete(editor)
  
  clearSelection()

# Helper: Update saved files list
proc refreshFileList() =
  let jsonStr = localStorage_list()
  savedFiles = @[]
  var i = 0
  var currentKey = ""
  var inKey = 0
  while i < len(jsonStr):
    let ch = jsonStr[i]
    if ch == '"' and i > 0 and jsonStr[i-1] != '\\':
      if inKey:
        if currentKey == "key":
          i = i + 1
          while i < len(jsonStr) and jsonStr[i] != '"':
            i = i + 1
          i = i + 1
          var filename = ""
          while i < len(jsonStr) and jsonStr[i] != '"':
            filename = filename & $jsonStr[i]
            i = i + 1
          if filename != "" and filename != "__temp_run__":
            savedFiles = savedFiles & @[filename]
        currentKey = ""
        inKey = 0
      else:
        inKey = 1
        currentKey = ""
        i = i + 1
        while i < len(jsonStr) and jsonStr[i] != '"':
          currentKey = currentKey & $jsonStr[i]
          i = i + 1
    i = i + 1

refreshFileList()
```

```nim on:ondrop
# Handle dropped files
let droppedFileName = getDroppedFileName()
let droppedData = getDroppedFileData()

# Convert binary data to text (assuming UTF-8)
let droppedText = droppedData

# Load into editor
editor = newEditor(droppedText)
currentFileName = droppedFileName
isSaved = 1
editorClearModified(editor)
lastAutoSaveContent = droppedText

# Update status
statusMessage = "✓ Loaded '" & droppedFileName & "' (" & str(len(droppedText)) & " bytes)"

# Close any open dialogs
showLoadDialog = 0
showSaveDialog = 0
showLoadGistDialog = 0
showSaveGistDialog = 0
showShareDialog = 0
showHelp = 0
activeMenu = ""
focusedComponent = 0
```

```nim on:render
# ===================================================================
# Render
# ===================================================================
clear()

let w = termWidth
let h = termHeight

# Calculate responsive editor dimensions
let editorW = w - 1  # Full width with margins
let editorH = h - 7   # Full height minus title, status bar, and margins

# Title bar
let titleText = "t|"
drawLabel(0, 0, 1, titleText, getStyle("info"))

# Draw the main editor on layer 0
drawEditor(0, editorX, editorY, editorW, editorH, editor, 1, hasSelection, selStartLine, selStartCol, selEndLine, selEndCol)

# Auto-save logic (runs every frame)
autoSaveTimer = autoSaveTimer + 1
if autoSaveTimer >= autoSaveInterval:
  autoSaveTimer = 0
  let currentContent = editorGetText(editor)
  if currentContent != lastAutoSaveContent:
    let success = localStorage_setItem("__autosave__", currentContent)
    if success:
      lastAutoSaveContent = currentContent
      lastSaveTime = "auto-saved"

# Status bar (automatically positioned at bottom)
let statusY = h - 5
drawPanel(0, 0, statusY, w - 1, 5, "Status", "single")

# Get cursor info
let cursor = editorGetCursor(editor)
let cursorLine = cursor["line"]
let cursorCol = cursor["col"]
let lineCount = editorLineCount(editor)
let isModified = editorIsModified(editor)
let scroll = editorGetScroll(editor)
let scrollX = scroll["scrollX"]
let scrollY = scroll["scrollY"]

# Status line 1: Cursor position and scroll
let modStr = if isModified: " [MODIFIED]" else: ""
let scrollInfo = if scrollX > 0 or scrollY > 0: " | Scroll X:" & str(scrollX) & " Y:" & str(scrollY) else: ""
let posInfo = "Line " & str(cursorLine + 1) & ", Col " & str(cursorCol + 1) & " | Total: " & str(lineCount) & " lines" & modStr & scrollInfo
drawLabel(0, 7, statusY + 1, posInfo, getStyle("info"))

# Status line 2: Current message
drawLabel(0, 7, statusY + 2, statusMessage, getStyle("default"))

# Status line 3: Mouse/drag state
let dragInfo = "Mouse: (" & str(mouseX) & "," & str(mouseY) & ") | Pressed: " & str(mousePressed) & " | DragStart: (" & str(dragStartX) & "," & str(dragStartY) & ") | Dragging: " & str(isDraggingText)
drawLabel(0, 7, statusY + 3, dragInfo, getStyle("warning"))

# Check for async paste completion
if pasteInProgress:
  let pastedText = pasteFromClipboard()
  if pastedText != "" and pastedText != lastPasteCheck:
    # Parse lines - handle \r\n, \n, \r, and literal \n
    # Process the text directly without byte-by-byte iteration to preserve Unicode
    var lines: seq[string] = @[]
    var currentLine = ""
    var i = 0
    var lineCount = 0
    
    # Split by different newline types while preserving unicode characters
    # Instead of iterating byte-by-byte, we build the string until we hit newlines
    while i < len(pastedText):
      # Check for literal backslash-n (escaped newline as text)
      if i + 1 < len(pastedText) and pastedText[i] == '\\' and pastedText[i + 1] == 'n':
        add(lines, currentLine)
        lineCount = lineCount + 1
        currentLine = ""
        i = i + 2  # Skip both \ and n
        continue
      
      let code = ord(pastedText[i])
      
      # Check for actual newlines
      if code == 13:  # \r
        add(lines, currentLine)
        lineCount = lineCount + 1
        currentLine = ""
        # Check for \r\n combo and skip both
        if i + 1 < len(pastedText) and ord(pastedText[i + 1]) == 10:
          i = i + 2
        else:
          i = i + 1
        continue
      elif code == 10:  # \n
        add(lines, currentLine)
        lineCount = lineCount + 1
        currentLine = ""
        i = i + 1
        continue
      else:
        # Add the character directly without converting - preserves Unicode
        currentLine = currentLine & pastedText[i..<i+1]
      i = i + 1
    
    # Add the last line
    if currentLine != "" or len(lines) > 0:
      add(lines, currentLine)
    
    # Insert lines
    for j in 0..<len(lines):
      let line = lines[j]
      # Insert the line text (even if empty)
      editorInsertText(editor, line)
      # Insert newline between lines (but not after the last one)
      if j < len(lines) - 1:
        editorInsertNewline(editor)
    
    statusMessage = "✓ Pasted " & str(len(lines)) & " lines"
    isSaved = 0
    pasteInProgress = 0
    lastPasteCheck = ""

# ===================================================================
# Layer 1 - Menus and Dialogs (drawn on top of editor)
# ===================================================================
# Clear layer 1 with transparency so editor shows through
clear(1, true)

# Menu bar on layer 1
let menuY = 1
let menuStyle = getStyle("default")
let menuActiveStyle = getStyle("info")
let menuHoverStyle = getStyle("warning")
let fileMenuX = 4
let editMenuX = fileMenuX + 8
let viewMenuX = editMenuX + 8
let helpMenuX = viewMenuX + 8

drawLabel(1, fileMenuX, menuY, "File", if activeMenu == "file": menuActiveStyle else: menuStyle)
drawLabel(1, editMenuX, menuY, "Edit", if activeMenu == "edit": menuActiveStyle else: menuStyle)
drawLabel(1, viewMenuX, menuY, "View", if activeMenu == "view": menuActiveStyle else: menuStyle)
drawLabel(1, helpMenuX, menuY, "Help", if activeMenu == "help": menuActiveStyle else: menuStyle)

# Menu dropdowns on layer 1
if activeMenu == "file":
  let menuW = 30
  let menuH = 10
  let menuDropX = fileMenuX
  let menuDropY = menuY + 1
  drawPanel(1, menuDropX, menuDropY, menuW, menuH, "", "single")
  
  # Menu items (track bounds for click detection)
  # Item 0: Save
  drawLabel(1, menuDropX + 2, menuDropY + 1, "Save (Ctrl+S)", if hoveredMenuItem == 0: menuHoverStyle else: getStyle("default"))
  # Item 1: Open
  drawLabel(1, menuDropX + 2, menuDropY + 2, "Open (Ctrl+O)", if hoveredMenuItem == 1: menuHoverStyle else: getStyle("default"))
  # Separator
  drawLabel(1, menuDropX + 2, menuDropY + 3, "───────────────────", getStyle("comment"))
  # Item 2: Share URL
  drawLabel(1, menuDropX + 2, menuDropY + 4, "Share URL (Ctrl+E)", if hoveredMenuItem == 2: menuHoverStyle else: getStyle("default"))
  # Separator
  drawLabel(1, menuDropX + 2, menuDropY + 5, "───────────────────", getStyle("comment"))
  # Item 3: Load Gist
  drawLabel(1, menuDropX + 2, menuDropY + 6, "Load Gist (Ctrl+G)", if hoveredMenuItem == 3: menuHoverStyle else: getStyle("default"))
  # Item 4: Save as Gist
  drawLabel(1, menuDropX + 2, menuDropY + 7, "Save as Gist", if hoveredMenuItem == 4: menuHoverStyle else: getStyle("default"))
  
elif activeMenu == "view":
  let menuW = 25
  let menuH = 4
  let menuDropX = viewMenuX
  let menuDropY = menuY + 1
  drawPanel(1, menuDropX, menuDropY, menuW, menuH, "", "single")
  # Item 0: Toggle Help
  drawLabel(1, menuDropX + 2, menuDropY + 1, "Toggle Help (F1)", if hoveredMenuItem == 0: menuHoverStyle else: getStyle("default"))
  
elif activeMenu == "help":
  let menuW = 25
  let menuH = 4
  let menuDropX = helpMenuX
  let menuDropY = menuY + 1
  drawPanel(1, menuDropX, menuDropY, menuW, menuH, "", "single")
  # Item 0: Shortcuts
  drawLabel(1, menuDropX + 2, menuDropY + 1, "Shortcuts (F1)", if hoveredMenuItem == 0: menuHoverStyle else: getStyle("default"))

# ===================================================================
# Dialogs on layer 1 (on top of everything)
# ===================================================================

# Save Dialog
if showSaveDialog:
  let dialogW = 60
  let dialogH = 10
  let dialogX = (w - dialogW) div 2
  let dialogY = (h - dialogH) div 2
  
  drawPanel(1, dialogX, dialogY, dialogW, dialogH, "💾 Save to Browser", "double")
  drawLabel(1, dialogX + 2, dialogY + 2, "Enter filename (without extension):", getStyle("info"))
  drawLabel(1, dialogX + 2, dialogY + 4, " > " & saveFileName & "_", getStyle("default"))
  drawLabel(1, dialogX + 2, dialogY + 6, "Press Enter to save, Esc to cancel", getStyle("comment"))
  drawLabel(1, dialogX + 2, dialogY + 7, "Saved to localStorage in your browser", getStyle("comment"))

# Load Dialog  
if showLoadDialog:
  let dialogW = 70
  let dialogH = min(20, h - 10)
  let dialogX = (w - dialogW) div 2
  let dialogY = (h - dialogH) div 2
  
  drawPanel(1, dialogX, dialogY, dialogW, dialogH, "📂 Load from Browser", "double")
  drawLabel(1, dialogX + 2, dialogY + 2, "Saved documents in localStorage:", getStyle("info"))
  
  if len(savedFiles) == 0:
    drawLabel(1, dialogX + 2, dialogY + 4, "(No saved documents found)", getStyle("comment"))
    drawLabel(1, dialogX + 2, dialogY + 6, "Save a document first with Ctrl+S", getStyle("comment"))
  else:
    var yPos = dialogY + 4
    var idx = 0
    while idx < len(savedFiles) and yPos < dialogY + dialogH - 3:
      let fileEntry = savedFiles[idx]
      let prefix = if idx == loadSelection: "> " else: "  "
      let style = if idx == loadSelection: getStyle("info") else: getStyle("default")
      drawLabel(1, dialogX + 4, yPos, prefix & str(idx + 1) & ". " & fileEntry, style)
      yPos = yPos + 1
      idx = idx + 1
  
  drawLabel(1, dialogX + 2, dialogY + dialogH - 2, "Arrow keys + Enter to load, Esc to cancel", getStyle("comment"))

# Share Dialog
if showShareDialog:
  # Check if URL generation is complete (only checks a boolean flag - efficient!)
  if shareUrlReady == 0:
    let readyStr = checkShareUrlReady()
    if readyStr == "true":
      shareUrlReady = 1
      shareUrl = getShareUrl()
      let copiedStr = checkShareUrlCopied()
      if copiedStr == "true":
        statusMessage = "✓ Share URL copied to clipboard!"
      else:
        statusMessage = "Share URL generated (clipboard failed)"
  
  let dialogW = min(80, w - 10)
  let dialogH = 14
  let dialogX = (w - dialogW) div 2
  let dialogY = (h - dialogH) div 2
  
  drawPanel(1, dialogX, dialogY, dialogW, dialogH, "🔗 Share via URL", "double")
  drawLabel(1, dialogX + 2, dialogY + 2, "Shareable URL generated:", getStyle("info"))
  
  if shareUrlReady:
    drawLabel(1, dialogX + 2, dialogY + 4, "Copy this URL to share:", getStyle("comment"))
    let urlMaxLen = dialogW - 6
    var urlLine = shareUrl
    var urlY = dialogY + 5
    while len(urlLine) > 0 and urlY < dialogY + dialogH - 3:
      let chunk = if len(urlLine) > urlMaxLen: urlLine[0..<urlMaxLen] else: urlLine
      drawLabel(1, dialogX + 3, urlY, chunk, getStyle("default"))
      urlLine = if len(urlLine) > urlMaxLen: urlLine[urlMaxLen..<len(urlLine)] else: ""
      urlY = urlY + 1
    
    drawLabel(1, dialogX + 2, dialogY + dialogH - 3, "✓ URL copied to clipboard!", getStyle("success"))
  else:
    drawLabel(1, dialogX + 2, dialogY + 4, "Generating...", getStyle("comment"))
  
  drawLabel(1, dialogX + 2, dialogY + dialogH - 2, "Press Esc to close", getStyle("comment"))

# Load from Gist Dialog
if showLoadGistDialog:
  let dialogW = 70
  let dialogH = 12
  let dialogX = (w - dialogW) div 2
  let dialogY = (h - dialogH) div 2
  
  drawPanel(1, dialogX, dialogY, dialogW, dialogH, "📥 Load from GitHub Gist", "double")
  drawLabel(1, dialogX + 2, dialogY + 2, "Enter Gist ID or URL:", getStyle("info"))
  drawLabel(1, dialogX + 2, dialogY + 4, " > " & gistIdInput & "_", getStyle("default"))
  drawLabel(1, dialogX + 2, dialogY + 6, "Examples:", getStyle("comment"))
  drawLabel(1, dialogX + 4, dialogY + 7, "abc123def456", getStyle("comment"))
  drawLabel(1, dialogX + 4, dialogY + 8, "https://gist.github.com/user/abc123def456", getStyle("comment"))
  drawLabel(1, dialogX + 2, dialogY + 10, "Press Enter to load, Esc to cancel", getStyle("comment"))

# Save to Gist Dialog
if showSaveGistDialog:
  let dialogW = 70
  let dialogH = 14
  let dialogX = (w - dialogW) div 2
  let dialogY = (h - dialogH) div 2
  
  drawPanel(1, dialogX, dialogY, dialogW, dialogH, "📤 Save as GitHub Gist", "double")
  
  if gistResultUrl == "":
    drawLabel(1, dialogX + 2, dialogY + 2, "Description (optional):", getStyle("info"))
    drawLabel(1, dialogX + 2, dialogY + 4, " > " & gistDescription & "_", getStyle("default"))
    drawLabel(1, dialogX + 2, dialogY + 6, "Filename: " & currentFileName & ".md", getStyle("comment"))
    drawLabel(1, dialogX + 2, dialogY + 8, "This will create a public gist", getStyle("comment"))
    drawLabel(1, dialogX + 2, dialogY + 9, "(No API key required)", getStyle("comment"))
    drawLabel(1, dialogX + 2, dialogY + 11, "Press Enter to create, Esc to cancel", getStyle("comment"))
  else:
    drawLabel(1, dialogX + 2, dialogY + 2, "✓ Gist created successfully!", getStyle("success"))
    drawLabel(1, dialogX + 2, dialogY + 4, "URL:", getStyle("info"))
    drawLabel(1, dialogX + 4, dialogY + 5, gistResultUrl, getStyle("default"))
    drawLabel(1, dialogX + 2, dialogY + 7, "Press Esc to close", getStyle("comment"))

# Help panel (toggle with F1) on layer 1
if showHelp:
  let helpX = w div 2 - 35
  let helpY = h div 2 - 12
  drawPanel(1, helpX, helpY, 70, 24, "⌨ Keyboard Shortcuts", "double")
  
  drawLabel(1, helpX + 2, helpY + 2, "File Operations:", getStyle("info"))
  drawLabel(1, helpX + 4, helpY + 3, "Ctrl+S - Save to browser storage", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 4, "Ctrl+O - Open from browser storage", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 5, "Ctrl+E - Share via compressed URL", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 6, "Ctrl+G - Load from GitHub Gist", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 7, "Ctrl+Shift+S - Save as GitHub Gist", getStyle("default"))
  
  drawLabel(1, helpX + 2, helpY + 9, "Navigation:", getStyle("info"))
  drawLabel(1, helpX + 4, helpY + 10, "Arrow Keys - Move cursor", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 11, "Ctrl+Left/Right - Move by word", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 12, "Home/End - Start/end of line", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 13, "Ctrl+Home/End - Start/end of file", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 14, "Page Up/Down - Scroll page", getStyle("default"))
  
  drawLabel(1, helpX + 2, helpY + 16, "Selection:", getStyle("info"))
  drawLabel(1, helpX + 4, helpY + 17, "Shift+Arrows - Select text", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 18, "Ctrl+Shift+Left/Right - Select by word", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 19, "Ctrl+A - Select all text", getStyle("default"))
  
  drawLabel(1, helpX + 2, helpY + 21, "Editing:", getStyle("info"))
  drawLabel(1, helpX + 4, helpY + 22, "Type - Insert text", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 23, "Backspace - Delete before cursor", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 24, "Delete - Delete at/selection", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 25, "Enter - New line", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 26, "Tab - Insert spaces", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 27, "Ctrl+C - Copy selection/document", getStyle("default"))
  drawLabel(1, helpX + 4, helpY + 28, "Ctrl+V - Paste from clipboard", getStyle("default"))
  
  drawLabel(1, helpX + 20, helpY + 30, "Press F1 or Esc to close help", getStyle("warning"))
```

```nim on:input
# ===================================================================
# Input Handling
# ===================================================================
if event.type == "key":
  let keyCode = event.keyCode
  let key = event.key
  let ctrl = if contains(event.mods, "ctrl"): 1 else: 0
  let shift = if contains(event.mods, "shift"): 1 else: 0
  lastKeyCode = keyCode
  
  # ===== Dialog Input Handling (dialogs have priority) =====
  
  # Save dialog
  if showSaveDialog:
    if keyCode == KEY_ESCAPE:  # Esc
      showSaveDialog = 0
      saveFileName = ""
      focusedComponent = 0
      statusMessage = "Save cancelled"
      return true
    elif keyCode == KEY_RETURN:  # Enter
      if saveFileName != "":
        let content = editorGetText(editor)
        let success = localStorage_setItem(saveFileName, content)
        if success:
          currentFileName = saveFileName
          isSaved = 1
          editorClearModified(editor)
          statusMessage = "✓ Saved as '" & saveFileName & "' to browser storage"
          refreshFileList()
          # Clear auto-save since user explicitly saved
          discard localStorage_delete("__autosave__")
          lastAutoSaveContent = content
        else:
          statusMessage = "✗ Failed to save to browser storage"
        showSaveDialog = 0
        saveFileName = ""
        return true
    elif keyCode == KEY_BACKSPACE:  # Backspace
      if len(saveFileName) > 0:
        saveFileName = saveFileName[0..<len(saveFileName) - 1]
      return true
    return true
  
  # Load dialog
  if showLoadDialog:
    if keyCode == KEY_ESCAPE:  # Esc
      showLoadDialog = 0
      loadSelection = 0
      focusedComponent = 0
      statusMessage = "Load cancelled"
      return true
    elif keyCode == KEY_UP:  # Up arrow
      if loadSelection > 0:
        loadSelection = loadSelection - 1
      return true
    elif keyCode == KEY_DOWN:  # Down arrow
      if loadSelection < len(savedFiles) - 1:
        loadSelection = loadSelection + 1
      return true
    elif keyCode == KEY_RETURN:  # Enter
      if loadSelection >= 0 and loadSelection < len(savedFiles):
        let filename = savedFiles[loadSelection]
        statusMessage = "Loading '" & filename & "'..."
        showLoadDialog = 0
        loadSelection = 0
        let loadUrl = "?load=browser:" & filename
        navigateTo(loadUrl)
        return true
    return true
  
  # Share dialog
  if showShareDialog:
    if keyCode == KEY_ESCAPE:  # Esc
      showShareDialog = 0
      shareUrl = ""
      shareUrlReady = 0
      focusedComponent = 0
      statusMessage = "Share dialog closed"
      return true
    return true
  
  # Load from Gist dialog
  if showLoadGistDialog:
    if keyCode == KEY_ESCAPE:  # Esc
      showLoadGistDialog = 0
      gistIdInput = ""
      focusedComponent = 0
      statusMessage = "Load from Gist cancelled"
      return true
    elif keyCode == KEY_RETURN:  # Enter
      if gistIdInput != "":
        # Extract gist ID from URL if needed
        var gistId = gistIdInput
        # Check if it's a URL by looking for "gist.github.com"
        var isUrl = 0
        var checkPos = 0
        let pattern = "gist.github.com"
        while checkPos <= len(gistId) - len(pattern):
          var matches = 1
          var j = 0
          while j < len(pattern):
            if gistId[checkPos + j] != pattern[j]:
              matches = 0
              break
            j = j + 1
          if matches:
            isUrl = 1
            break
          checkPos = checkPos + 1
        
        if isUrl:
          # Extract ID from URL (last part after /)
          var parts: seq[string] = @[]
          var current = ""
          var i = 0
          while i < len(gistId):
            if gistId[i] == '/':
              if current != "":
                parts = parts & @[current]
              current = ""
            else:
              current = current & $gistId[i]
            i = i + 1
          if current != "":
            parts = parts & @[current]
          if len(parts) > 0:
            gistId = parts[len(parts) - 1]
        
        statusMessage = "Loading gist " & gistId & "..."
        showLoadGistDialog = 0
        gistIdInput = ""
        let loadUrl = "?load=gist:" & gistId
        navigateTo(loadUrl)
        return true
    elif keyCode == KEY_BACKSPACE:  # Backspace
      if len(gistIdInput) > 0:
        gistIdInput = gistIdInput[0..<len(gistIdInput) - 1]
      return true
    return true
  
  # Save to Gist dialog
  if showSaveGistDialog:
    if keyCode == KEY_ESCAPE:  # Esc
      showSaveGistDialog = 0
      gistDescription = ""
      gistResultUrl = ""
      focusedComponent = 0
      statusMessage = "Save to Gist cancelled"
      return true
    elif keyCode == KEY_RETURN and gistResultUrl == "":  # Enter (only if not showing result)
      let content = editorGetText(editor)
      let filename = currentFileName & ".md"
      let desc = if gistDescription == "": "TStorie document: " & currentFileName else: gistDescription
      
      # Create gist using gist API
      let result = gist_create(desc, filename, content)
      if result != "":
        gistResultUrl = result
        statusMessage = "✓ Gist created successfully!"
        let copied = copyToClipboard(gistResultUrl)
      else:
        statusMessage = "✗ Failed to create gist"
        showSaveGistDialog = 0
        gistDescription = ""
      return true
    elif keyCode == KEY_BACKSPACE and gistResultUrl == "":  # Backspace (only for description input)
      if len(gistDescription) > 0:
        gistDescription = gistDescription[0..<len(gistDescription) - 1]
      return true
    return true
  
  # Help dialog
  if showHelp:
    if keyCode == KEY_F1 or keyCode == KEY_ESCAPE:  # F1 or Esc
      showHelp = 0
      focusedComponent = 0
      statusMessage = "Help closed"
      return true
    return true
  
  # Menu navigation
  if activeMenu != "":
    if keyCode == KEY_ESCAPE:  # Esc
      activeMenu = ""
      hoveredMenuItem = -1
      focusedComponent = 0
      statusMessage = "Menu closed"
      return true
    elif keyCode == KEY_UP:  # Up arrow
      if hoveredMenuItem > 0:
        hoveredMenuItem = hoveredMenuItem - 1
        # Skip separators
        if activeMenu == "file" and (hoveredMenuItem == 3 or hoveredMenuItem == 5):
          hoveredMenuItem = hoveredMenuItem - 1
      return true
    elif keyCode == KEY_DOWN:  # Down arrow
      var maxItem = 0
      if activeMenu == "file":
        maxItem = 4
      elif activeMenu == "view":
        maxItem = 0
      else:
        maxItem = 0
      if hoveredMenuItem < maxItem:
        hoveredMenuItem = hoveredMenuItem + 1
        # Skip separators
        if activeMenu == "file" and (hoveredMenuItem == 3 or hoveredMenuItem == 5):
          hoveredMenuItem = hoveredMenuItem + 1
      return true
    elif keyCode == KEY_RETURN:  # Enter - activate menu item
      if hoveredMenuItem >= 0:
        # Execute menu action
        if activeMenu == "file":
          if hoveredMenuItem == 0:  # Save
            showSaveDialog = 1
            focusedComponent = 2
            saveFileName = if currentFileName == "untitled": "" else: currentFileName
            statusMessage = "Enter filename to save"
          elif hoveredMenuItem == 1:  # Open
            refreshFileList()
            showLoadDialog = 1
            focusedComponent = 2
            loadSelection = 0
            statusMessage = "Select file to load"
          elif hoveredMenuItem == 2:  # Share
            showShareDialog = 1
            focusedComponent = 2
            let content = editorGetText(editor)
            shareUrl = compressToUrl(content)
            let copied = copyToClipboard(shareUrl)
            if copied:
              statusMessage = "✓ Share URL copied to clipboard!"
            else:
              statusMessage = "Share URL generated"
          elif hoveredMenuItem == 3:  # Load Gist
            showLoadGistDialog = 1
            focusedComponent = 2
            gistIdInput = ""
            statusMessage = "Enter Gist ID or URL"
          elif hoveredMenuItem == 4:  # Save as Gist
            showSaveGistDialog = 1
            focusedComponent = 2
            gistDescription = ""
            gistResultUrl = ""
            statusMessage = "Enter description for Gist"
        elif activeMenu == "view":
          if hoveredMenuItem == 0:  # Toggle Help
            showHelp = 1 - showHelp
            focusedComponent = if showHelp: 2 else: 0
            statusMessage = if showHelp != 0: "Help opened" else: "Help closed"
        elif activeMenu == "help":
          if hoveredMenuItem == 0:  # Shortcuts
            showHelp = 1
            focusedComponent = 2
            statusMessage = "Help opened"
        
        activeMenu = ""
        hoveredMenuItem = -1
        return true
    return true
  
  # ===== Global Shortcuts (only if no menu/dialog active) =====
  
  if focusedComponent == 0:
    # Debug: Log all key events when Ctrl is pressed
    if ctrl:
      statusMessage = "Ctrl key pressed: keyCode=" & str(keyCode) & " key=" & key
    
    if ctrl:
      # Ctrl+S - Save
      if (keyCode == KEY_S or keyCode == 83) and not shift:
        showSaveDialog = 1
        focusedComponent = 2
        saveFileName = if currentFileName == "untitled": "" else: currentFileName
        statusMessage = "Enter filename to save"
        return true
      
      # Ctrl+Shift+S - Save to Gist
      elif (keyCode == KEY_S or keyCode == 83) and shift:
        showSaveGistDialog = 1
        focusedComponent = 2
        gistDescription = ""
        gistResultUrl = ""
        statusMessage = "Enter description for Gist"
        return true
      
      # Ctrl+O - Open
      elif keyCode == KEY_O or keyCode == 79:
        refreshFileList()
        showLoadDialog = 1
        focusedComponent = 2
        loadSelection = 0
        statusMessage = "Select file to load"
        return true
      
      # Ctrl+E - Share
      elif keyCode == KEY_E or keyCode == 69:
        showShareDialog = 1
        focusedComponent = 2
        shareUrl = ""
        shareUrlReady = 0
        # Trigger async generation (happens in JS, we just poll for completion)
        let content = editorGetText(editor)
        generateAndCopyShareUrl(content)
        statusMessage = "Generating shareable URL..."
        return true
      
      # Ctrl+G - Load from Gist
      elif keyCode == KEY_G or keyCode == 71:
        showLoadGistDialog = 1
        focusedComponent = 2
        gistIdInput = ""
        statusMessage = "Enter Gist ID or URL"
        return true
      
      # Ctrl+A - Select all (check multiple keyCodes for browser/terminal compatibility)
      # Browser sends keyCode 65 (uppercase A)
      # Terminal sends keyCode 97 (lowercase a) after our conversion
      elif keyCode == KEY_A or keyCode == 65 or keyCode == 97:
        hasSelection = 1
        selStartLine = 0
        selStartCol = 0
        selEndLine = editorLineCount(editor) - 1
        let lastLine = editorGetLine(editor, selEndLine)
        selEndCol = len(lastLine)
        statusMessage = "All text selected (keyCode:" & str(keyCode) & ")"
        return true
      
      # Ctrl+C - Copy selection or all content to clipboard
      elif keyCode == KEY_C or keyCode == 67:
        let content = if hasSelection: getSelectedText() else: editorGetText(editor)
        let copied = copyToClipboard(content)
        if copied:
          statusMessage = "✓ Copied entire document to clipboard"
        else:
          statusMessage = "Failed to copy to clipboard"
        return true
      
      # Ctrl+V - Paste from clipboard
      elif keyCode == KEY_V or keyCode == 86:
        # Trigger async clipboard read
        let triggerPaste = pasteFromClipboard()
        pasteInProgress = 1
        lastPasteCheck = ""
        statusMessage = "Reading clipboard..."
        return true
    
    # F1 - Toggle help
    if keyCode == KEY_F1:
      showHelp = 1 - showHelp
      focusedComponent = if showHelp: 2 else: 0
      statusMessage = if showHelp != 0: "Help panel opened" else: "Help panel closed"
      return true
    
    if keyCode == KEY_BACKQUOTE:
      # Trigger async clipboard read
      let triggerPaste = pasteFromClipboard()
      pasteInProgress = 1
      lastPasteCheck = ""
      statusMessage = "Reading clipboard..."
      return true
  
  # ===== Special Keys =====
  
  # Delete or Backspace - delete selection if any, otherwise pass to editor
  # Browser: BACKSPACE=8, DELETE=46
  # Terminal: BACKSPACE=8, DELETE=127
  if keyCode == KEY_DELETE or keyCode == KEY_BACKSPACE or keyCode == 46 or keyCode == 8:
    if hasSelection:
      deleteSelection()
      statusMessage = "Deleted selection"
      return true
    # If no selection, let it fall through to editor handler
  
  # ===== Arrow Keys and Word Movement =====
  
  # Editor only responds when it has focus
  if focusedComponent != 0:
    return false
  
  # Handle arrow keys with shift (selection) and ctrl (word movement)
  # Arrow keys: KEY_UP=1000, KEY_DOWN=1001, KEY_LEFT=1002, KEY_RIGHT=1003
  if keyCode == KEY_UP or keyCode == KEY_DOWN or keyCode == KEY_LEFT or keyCode == KEY_RIGHT:
    let cursor = editorGetCursor(editor)
    let cursorLine = cursor["line"]
    let cursorCol = cursor["col"]
    
    # Check if there's a mouse selection we should continue
    let mouseSelection = editorGetSelectionInfo(editor)
    if shift and not hasSelection and mouseSelection["active"]:
      # Convert mouse selection to keyboard selection so we can extend it
      hasSelection = 1
      selStartLine = mouseSelection["startLine"]
      selStartCol = mouseSelection["startCol"]
      selEndLine = mouseSelection["endLine"]
      selEndCol = mouseSelection["endCol"]
    
    # Start selection if shift is pressed and no selection exists
    if shift and not hasSelection:
      hasSelection = 1
      selStartLine = cursorLine
      selStartCol = cursorCol
      selEndLine = cursorLine
      selEndCol = cursorCol
    
    # Move cursor
    var newLine = cursorLine
    var newCol = cursorCol
    
    if keyCode == KEY_LEFT:  # Left
      if ctrl:
        # Ctrl+Left: Move to previous word
        let line = editorGetLine(editor, cursorLine)
        newCol = findPrevWord(line, cursorCol)
      else:
        # Regular left
        if cursorCol > 0:
          newCol = cursorCol - 1
        elif cursorLine > 0:
          newLine = cursorLine - 1
          let prevLine = editorGetLine(editor, newLine)
          newCol = len(prevLine)
    elif keyCode == KEY_RIGHT:  # Right
      if ctrl:
        # Ctrl+Right: Move to next word
        let line = editorGetLine(editor, cursorLine)
        newCol = findNextWord(line, cursorCol)
      else:
        # Regular right
        let line = editorGetLine(editor, cursorLine)
        if cursorCol < len(line):
          newCol = cursorCol + 1
        elif cursorLine < editorLineCount(editor) - 1:
          newLine = cursorLine + 1
          newCol = 0
    elif keyCode == KEY_UP:  # Up
      if cursorLine > 0:
        newLine = cursorLine - 1
        let upLine = editorGetLine(editor, newLine)
        newCol = min(cursorCol, len(upLine))
    elif keyCode == KEY_DOWN:  # Down
      if cursorLine < editorLineCount(editor) - 1:
        newLine = cursorLine + 1
        let downLine = editorGetLine(editor, newLine)
        newCol = min(cursorCol, len(downLine))
    
    # Apply movement
    editorSetCursor(editor, newLine, newCol)
    
    # Update selection if shift is pressed
    if shift:
      selEndLine = newLine
      selEndCol = newCol
      statusMessage = "Selection: " & str(selStartLine) & ":" & str(selStartCol) & " to " & str(selEndLine) & ":" & str(selEndCol)
    else:
      # Clear selection if not holding shift
      clearSelection()
      statusMessage = "Moved to line " & str(newLine + 1) & ", col " & str(newCol + 1)
    
    return true
  
  # ===== Home, End, Page Up, Page Down =====
  
  # Home key - Move to start of line or file
  if keyCode == KEY_HOME:
    let cursor = editorGetCursor(editor)
    let cursorLine = cursor["line"]
    let cursorCol = cursor["col"]
    
    # Check if there's a mouse selection we should continue
    let mouseSelection = editorGetSelectionInfo(editor)
    if shift and not hasSelection and mouseSelection["active"]:
      hasSelection = 1
      selStartLine = mouseSelection["startLine"]
      selStartCol = mouseSelection["startCol"]
      selEndLine = mouseSelection["endLine"]
      selEndCol = mouseSelection["endCol"]
    
    # Start selection if shift is pressed and no selection exists
    if shift and not hasSelection:
      hasSelection = 1
      selStartLine = cursorLine
      selStartCol = cursorCol
      selEndLine = cursorLine
      selEndCol = cursorCol
    
    var newLine = cursorLine
    var newCol = 0
    
    if ctrl:
      # Ctrl+Home: Move to start of file
      newLine = 0
      newCol = 0
    else:
      # Home: Move to start of line
      newCol = 0
    
    editorSetCursor(editor, newLine, newCol)
    
    # Update selection if shift is pressed
    if shift:
      selEndLine = newLine
      selEndCol = newCol
      statusMessage = "Selection to line start"
    else:
      clearSelection()
      statusMessage = if ctrl: "Moved to start of file" else: "Moved to line start"
    
    return true
  
  # End key - Move to end of line or file
  if keyCode == KEY_END:
    let cursor = editorGetCursor(editor)
    let cursorLine = cursor["line"]
    let cursorCol = cursor["col"]
    
    # Check if there's a mouse selection we should continue
    let mouseSelection = editorGetSelectionInfo(editor)
    if shift and not hasSelection and mouseSelection["active"]:
      hasSelection = 1
      selStartLine = mouseSelection["startLine"]
      selStartCol = mouseSelection["startCol"]
      selEndLine = mouseSelection["endLine"]
      selEndCol = mouseSelection["endCol"]
    
    # Start selection if shift is pressed and no selection exists
    if shift and not hasSelection:
      hasSelection = 1
      selStartLine = cursorLine
      selStartCol = cursorCol
      selEndLine = cursorLine
      selEndCol = cursorCol
    
    var newLine = cursorLine
    var newCol = 0
    
    if ctrl:
      # Ctrl+End: Move to end of file
      newLine = editorLineCount(editor) - 1
      let lastLine = editorGetLine(editor, newLine)
      newCol = len(lastLine)
    else:
      # End: Move to end of line
      let line = editorGetLine(editor, cursorLine)
      newCol = len(line)
    
    editorSetCursor(editor, newLine, newCol)
    
    # Update selection if shift is pressed
    if shift:
      selEndLine = newLine
      selEndCol = newCol
      statusMessage = "Selection to line end"
    else:
      clearSelection()
      statusMessage = if ctrl: "Moved to end of file" else: "Moved to line end"
    
    return true
  
  # Page Up key - Scroll up one page
  if keyCode == KEY_PAGEUP:
    let cursor = editorGetCursor(editor)
    let cursorLine = cursor["line"]
    let cursorCol = cursor["col"]
    
    # Check if there's a mouse selection we should continue
    let mouseSelection = editorGetSelectionInfo(editor)
    if shift and not hasSelection and mouseSelection["active"]:
      hasSelection = 1
      selStartLine = mouseSelection["startLine"]
      selStartCol = mouseSelection["startCol"]
      selEndLine = mouseSelection["endLine"]
      selEndCol = mouseSelection["endCol"]
    
    # Start selection if shift is pressed and no selection exists
    if shift and not hasSelection:
      hasSelection = 1
      selStartLine = cursorLine
      selStartCol = cursorCol
      selEndLine = cursorLine
      selEndCol = cursorCol
    
    # Calculate page size (editor height minus some for scrolling context)
    let pageSize = max(10, termHeight - 9)
    var newLine = max(0, cursorLine - pageSize)
    let targetLine = editorGetLine(editor, newLine)
    let newCol = min(cursorCol, len(targetLine))
    
    editorSetCursor(editor, newLine, newCol)
    
    # Update selection if shift is pressed
    if shift:
      selEndLine = newLine
      selEndCol = newCol
      statusMessage = "Selection page up"
    else:
      clearSelection()
      statusMessage = "Scrolled up one page"
    
    return true
  
  # Page Down key - Scroll down one page
  if keyCode == KEY_PAGEDOWN:
    let cursor = editorGetCursor(editor)
    let cursorLine = cursor["line"]
    let cursorCol = cursor["col"]
    
    # Check if there's a mouse selection we should continue
    let mouseSelection = editorGetSelectionInfo(editor)
    if shift and not hasSelection and mouseSelection["active"]:
      hasSelection = 1
      selStartLine = mouseSelection["startLine"]
      selStartCol = mouseSelection["startCol"]
      selEndLine = mouseSelection["endLine"]
      selEndCol = mouseSelection["endCol"]
    
    # Start selection if shift is pressed and no selection exists
    if shift and not hasSelection:
      hasSelection = 1
      selStartLine = cursorLine
      selStartCol = cursorCol
      selEndLine = cursorLine
      selEndCol = cursorCol
    
    # Calculate page size (editor height minus some for scrolling context)
    let pageSize = max(10, termHeight - 9)
    let maxLine = editorLineCount(editor) - 1
    var newLine = min(maxLine, cursorLine + pageSize)
    let targetLine = editorGetLine(editor, newLine)
    let newCol = min(cursorCol, len(targetLine))
    
    editorSetCursor(editor, newLine, newCol)
    
    # Update selection if shift is pressed
    if shift:
      selEndLine = newLine
      selEndCol = newCol
      statusMessage = "Selection page down"
    else:
      clearSelection()
      statusMessage = "Scrolled down one page"
    
    return true
  
  # ===== Editor Input (only when editor has focus) =====
  
  # Already checked focusedComponent above
  if focusedComponent != 0:
    return false
  
  # Clear selection on any typing (printable characters)
  # Exclude DELETE (46) which is a special key in browser
  if hasSelection and keyCode >= 32 and keyCode < 127 and keyCode != 46 and not ctrl:
    deleteSelection()
  
  # Skip printable characters in key events - they should be handled by text events
  # This prevents double-handling in native mode where spacebar generates both key+text
  # Exception: Allow spacebar (32), DELETE (46), and other special keys through
  if keyCode >= 33 and keyCode < 127 and keyCode != 46 and not ctrl:
    return false
  
  # Track if content modified
  let wasModified = editorIsModified(editor)
  let handled = editorHandleKey(editor, keyCode, key, event.mods)
  
  if handled:
    keyPressCount = keyPressCount + 1
    let nowModified = editorIsModified(editor)
    
    if not wasModified and nowModified:
      isSaved = 0
    
    # Clear selection after any key press
    if hasSelection:
      clearSelection()
    
    # Update status message based on action
    if keyCode == KEY_RETURN:
      statusMessage = "Inserted new line"
    elif keyCode == KEY_BACKSPACE or keyCode == KEY_DELETE:
      statusMessage = "Deleted character"
    elif keyCode == KEY_TAB:
      statusMessage = "Inserted tab (spaces)"
    elif keyCode == KEY_LEFT or keyCode == KEY_UP or keyCode == KEY_RIGHT or keyCode == KEY_DOWN:
      let cursor = editorGetCursor(editor)
      statusMessage = "Moved to line " & str(cursor["line"] + 1) & ", col " & str(cursor["col"] + 1)
    
    return true
  
  return false

# ===================================================================
# Text Input Handling
# ===================================================================
elif event.type == "text":
  # Handle text input for dialogs
  if showSaveDialog:
    # Add typed character to filename (only alphanumeric, dash, underscore)
    if len(event.text) == 1:
      let c = event.text[0]
      if (c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or c == '-' or c == '_':
        saveFileName = saveFileName & event.text
    return true
  
  if showLoadGistDialog:
    # Add typed character to gist ID
    gistIdInput = gistIdInput & event.text
    return true
  
  if showSaveGistDialog and gistResultUrl == "":
    # Add typed character to description
    gistDescription = gistDescription & event.text
    return true
  
  # Only process if editor has focus
  if focusedComponent != 0:
    return false
  
  if showLoadDialog or showShareDialog or showHelp or activeMenu != "":
    return false
  
  # Delete selection before inserting new text
  if hasSelection:
    deleteSelection()
  
  let wasModified = editorIsModified(editor)
  editorInsertText(editor, event.text)
  
  if not wasModified:
    isSaved = 0
  
  keyPressCount = keyPressCount + 1
  statusMessage = "Ready"
  return true

# ===================================================================
# Mouse/Scroll Input Handling
# ===================================================================
elif event.type == "mouse" or event.type == "scroll":
  let mx = event.x
  let my = event.y
  let action = event.action
  
  # Recalculate editor dimensions
  let w = termWidth
  let h = termHeight
  let editorW = w - 1
  let editorH = h - 7
  
  # Handle clicks on dialogs - close if clicking outside
  if action == "press":
    # Check save dialog
    if showSaveDialog:
      let dialogW = 60
      let dialogH = 10
      let dialogX = (w - dialogW) div 2
      let dialogY = (h - dialogH) div 2
      if not (mx >= dialogX and mx < dialogX + dialogW and my >= dialogY and my < dialogY + dialogH):
        showSaveDialog = 0
        saveFileName = ""
        focusedComponent = 0
        statusMessage = "Save cancelled"
      return true
    
    # Check load dialog
    if showLoadDialog:
      let dialogW = 70
      let dialogH = min(20, h - 10)
      let dialogX = (w - dialogW) div 2
      let dialogY = (h - dialogH) div 2
      if not (mx >= dialogX and mx < dialogX + dialogW and my >= dialogY and my < dialogY + dialogH):
        showLoadDialog = 0
        loadSelection = 0
        focusedComponent = 0
        statusMessage = "Load cancelled"
      return true
    
    # Check share dialog
    if showShareDialog:
      let dialogW = min(80, w - 10)
      let dialogH = 14
      let dialogX = (w - dialogW) div 2
      let dialogY = (h - dialogH) div 2
      if not (mx >= dialogX and mx < dialogX + dialogW and my >= dialogY and my < dialogY + dialogH):
        showShareDialog = 0
        shareUrl = ""
        shareUrlReady = 0
        focusedComponent = 0
        statusMessage = "Share dialog closed"
      return true
    
    # Check load gist dialog
    if showLoadGistDialog:
      let dialogW = 70
      let dialogH = 12
      let dialogX = (w - dialogW) div 2
      let dialogY = (h - dialogH) div 2
      if not (mx >= dialogX and mx < dialogX + dialogW and my >= dialogY and my < dialogY + dialogH):
        showLoadGistDialog = 0
        gistIdInput = ""
        focusedComponent = 0
        statusMessage = "Load from Gist cancelled"
      return true
    
    # Check save gist dialog
    if showSaveGistDialog:
      let dialogW = 70
      let dialogH = 14
      let dialogX = (w - dialogW) div 2
      let dialogY = (h - dialogH) div 2
      if not (mx >= dialogX and mx < dialogX + dialogW and my >= dialogY and my < dialogY + dialogH):
        showSaveGistDialog = 0
        gistDescription = ""
        gistResultUrl = ""
        focusedComponent = 0
        statusMessage = "Save to Gist cancelled"
      return true
    
    # Check help panel
    if showHelp:
      let helpW = 70
      let helpH = 24
      let helpX = w div 2 - 35
      let helpY = h div 2 - 12
      if not (mx >= helpX and mx < helpX + helpW and my >= helpY and my < helpY + helpH):
        showHelp = 0
        focusedComponent = 0
        statusMessage = "Help closed"
      return true
  
  # Handle menu bar clicks
  if action == "press" and my == 1:
    let fileMenuX = 4
    let editMenuX = fileMenuX + 8
    let viewMenuX = editMenuX + 8
    let helpMenuX = viewMenuX + 8
    
    if mx >= fileMenuX and mx < fileMenuX + 4:
      activeMenu = if activeMenu == "file": "" else: "file"
      focusedComponent = if activeMenu == "file": 1 else: 0
      hoveredMenuItem = if activeMenu == "file": 0 else: -1
      statusMessage = if activeMenu == "file": "File menu opened - Use arrows + Enter or click items" else: "Menu closed"
      return true
    elif mx >= editMenuX and mx < editMenuX + 4:
      activeMenu = if activeMenu == "edit": "" else: "edit"
      focusedComponent = if activeMenu == "edit": 1 else: 0
      hoveredMenuItem = -1
      statusMessage = if activeMenu == "edit": "Edit menu opened" else: "Menu closed"
      return true
    elif mx >= viewMenuX and mx < viewMenuX + 4:
      activeMenu = if activeMenu == "view": "" else: "view"
      focusedComponent = if activeMenu == "view": 1 else: 0
      hoveredMenuItem = if activeMenu == "view": 0 else: -1
      statusMessage = if activeMenu == "view": "View menu opened" else: "Menu closed"
      return true
    elif mx >= helpMenuX and mx < helpMenuX + 4:
      activeMenu = if activeMenu == "help": "" else: "help"
      focusedComponent = if activeMenu == "help": 1 else: 0
      hoveredMenuItem = if activeMenu == "help": 0 else: -1
      statusMessage = if activeMenu == "help": "Help menu opened" else: "Menu closed"
      return true
  
  # Handle menu dropdown clicks
  if action == "press" and activeMenu != "":
    let fileMenuX = 4
    let viewMenuX = fileMenuX + 24
    let helpMenuX = viewMenuX + 8
    
    if activeMenu == "file":
      let menuDropX = fileMenuX
      let menuDropY = 2
      let menuW = 30
      let menuH = 10
      
      # Check if click is inside menu
      if mx >= menuDropX and mx < menuDropX + menuW and my >= menuDropY and my < menuDropY + menuH:
        let itemY = my - menuDropY - 1
        if itemY == 0:  # Save
          showSaveDialog = 1
          focusedComponent = 2
          saveFileName = if currentFileName == "untitled": "" else: currentFileName
          statusMessage = "Enter filename to save"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
        elif itemY == 1:  # Open
          refreshFileList()
          showLoadDialog = 1
          focusedComponent = 2
          loadSelection = 0
          statusMessage = "Select file to load"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
        elif itemY == 3:  # Share URL
          showShareDialog = 1
          focusedComponent = 2
          shareUrl = ""
          shareUrlReady = 0
          # Trigger async generation
          let content = editorGetText(editor)
          generateAndCopyShareUrl(content)
          activeMenu = ""
          hoveredMenuItem = -1
          statusMessage = "Generating shareable URL..."
          return true
        elif itemY == 5:  # Load Gist
          showLoadGistDialog = 1
          focusedComponent = 2
          gistIdInput = ""
          statusMessage = "Enter Gist ID or URL"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
        elif itemY == 6:  # Save as Gist
          showSaveGistDialog = 1
          focusedComponent = 2
          gistDescription = ""
          gistResultUrl = ""
          statusMessage = "Enter description for Gist"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
      else:
        # Clicked outside menu - close it
        activeMenu = ""
        hoveredMenuItem = -1
        focusedComponent = 0
        statusMessage = "Menu closed"
    
    elif activeMenu == "view":
      let menuDropX = viewMenuX
      let menuDropY = 2
      let menuW = 25
      let menuH = 4
      
      if mx >= menuDropX and mx < menuDropX + menuW and my >= menuDropY and my < menuDropY + menuH:
        let itemY = my - menuDropY - 1
        if itemY == 0:  # Toggle Help
          showHelp = 1 - showHelp
          focusedComponent = if showHelp: 2 else: 0
          statusMessage = if showHelp != 0: "Help opened" else: "Help closed"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
      else:
        # Clicked outside
        activeMenu = ""
        hoveredMenuItem = -1
        focusedComponent = 0
    
    elif activeMenu == "help":
      let menuDropX = helpMenuX
      let menuDropY = 2
      let menuW = 25
      let menuH = 4
      
      if mx >= menuDropX and mx < menuDropX + menuW and my >= menuDropY and my < menuDropY + menuH:
        let itemY = my - menuDropY - 1
        if itemY == 0:  # Shortcuts
          showHelp = 1
          focusedComponent = 2
          statusMessage = "Help opened"
          activeMenu = ""
          hoveredMenuItem = -1
          return true
      else:
        # Clicked outside
        activeMenu = ""
        hoveredMenuItem = -1
        focusedComponent = 0
  
  # Mouse wheel scrolling (scroll_up/scroll_down button events) - check FIRST before generic press
  if action == "press" and (event.button == "scroll_up" or event.button == "scroll_down"):
    if mx >= editorX and mx < editorX + editorW and my >= editorY and my < editorY + editorH:
      let cursor = editorGetCursor(editor)
      let cursorLine = cursor["line"]
      let cursorCol = cursor["col"]
      
      # Scroll up or down
      if event.button == "scroll_up":
        # Scroll up - move cursor up 3 lines
        let scrollAmount = 3
        let newLine = max(0, cursorLine - scrollAmount)
        let targetLine = editorGetLine(editor, newLine)
        let newCol = min(cursorCol, len(targetLine))
        editorSetCursor(editor, newLine, newCol)
        statusMessage = "Mouse wheel: scrolled up"
      else:
        # Scroll down - move cursor down 3 lines
        let scrollAmount = 3
        let maxLine = editorLineCount(editor) - 1
        let newLine = min(maxLine, cursorLine + scrollAmount)
        let targetLine = editorGetLine(editor, newLine)
        let newCol = min(cursorCol, len(targetLine))
        editorSetCursor(editor, newLine, newCol)
        statusMessage = "Mouse wheel: scrolled down"
      
      return true
  
  # Mouse release - end any drag operation
  if action == "release":
    if mousePressed:
      # Finalize text selection if we were dragging
      if isDraggingText:
        editorHandleMouseRelease(editor)
      
      mousePressed = 0
      isDraggingScrollbar = 0
      isDraggingMinimap = 0
      isDraggingText = 0
      statusMessage = "Ready"
      return true
  
  # Regular mouse button press (left/right/middle buttons only)
  if action == "press":
    # Click in editor area - give it focus
    if mx >= editorX and mx < editorX + editorW and my >= editorY and my < editorY + editorH:
      focusedComponent = 0
      activeMenu = ""
      hoveredMenuItem = -1
      
      # Calculate scrollbar and minimap positions
      let scrollbarX = editorX + editorW - 1
      let minimapX = editorX + editorW - 6
      
      # Check if clicking on scrollbar (rightmost column)
      if mx == scrollbarX:
        mousePressed = 1
        isDraggingScrollbar = 1
        dragStartY = my
        # Calculate position and jump there
        let relativeY = my - editorY
        let totalLines = editorLineCount(editor)
        let targetLine = (relativeY * totalLines) div editorH
        editorSetCursor(editor, min(max(0, targetLine), totalLines - 1), 0)
        statusMessage = "Scrollbar: jumped to line " & str(targetLine + 1)
        return true
      
      # Check if clicking on minimap (columns -6 to -2 from right edge)
      elif mx >= minimapX and mx < scrollbarX:
        mousePressed = 1
        isDraggingMinimap = 1
        let minimapHandled = editorHandleMinimapClick(editor, mx, my, editorX, editorY, editorW, editorH, 0)
        if minimapHandled:
          statusMessage = "Minimap: jumped to position"
        return true
      
      # Regular click in text area
      else:
        mousePressed = 1
        isDraggingText = 1
        dragStartX = mx
        dragStartY = my
        
        # Clear any existing keyboard selection when clicking (mouse takes over)
        clearSelection()
        
        # Start mouse selection (shift extends selection if held)
        let shiftHeld = 0  # TODO: track shift key state if needed
        let handled = editorHandleMousePress(editor, mx, my, editorX, editorY, editorW, editorH, 1, shiftHeld)
        if handled:
          let cursor = editorGetCursor(editor)
          statusMessage = "Press at line " & str(cursor["line"] + 1) & ", col " & str(cursor["col"] + 1) & " (selection started)"
        return true
  
  return false

# ===================================================================
# Mouse Move Events (for dragging)
# ===================================================================
elif event.type == "mouse_move":
  let mx = event.x
  let my = event.y
  
  # Calculate editor dimensions
  let w = termWidth
  let h = termHeight
  let editorW = w - 1
  let editorH = h - 7
  let editorX = 0
  let editorY = 2
  
  # Handle dragging while button is pressed
  if mousePressed and isDraggingScrollbar:
    # Allow dragging anywhere vertically within editor bounds
    if my >= editorY and my < editorY + editorH:
      # Calculate position from drag - direct mapping to total lines
      let relativeY = my - editorY
      let totalLines = editorLineCount(editor)
      let targetLine = (relativeY * totalLines) div editorH
      editorSetCursor(editor, min(max(0, targetLine), totalLines - 1), 0)
      statusMessage = "Scrollbar drag: line " & str(targetLine + 1)
      return true
  elif mousePressed and isDraggingMinimap:
    # Allow dragging anywhere vertically within editor bounds
    if my >= editorY and my < editorY + editorH:
      # Handle minimap drag
      let minimapHandled = editorHandleMinimapClick(editor, mx, my, editorX, editorY, editorW, editorH, 1)
      if minimapHandled:
        statusMessage = "Minimap drag"
        return true
  elif mousePressed and isDraggingText:
    # Handle text selection drag
    let handled = editorHandleMouseDrag(editor, mx, my, editorX, editorY, editorW, editorH, 1)
    if handled:
      let cursor = editorGetCursor(editor)
      statusMessage = "Selecting... line " & str(cursor["line"] + 1) & ", col " & str(cursor["col"] + 1)
      return true
  
  return false

return false
```

## About This Editor

A complete TStorie editor with file management, sharing, and collaboration features!

### Architecture
- **Gap Buffer**: Efficient O(1) inserts at cursor position
- **Unicode-Safe**: All operations use Runes internally
- **Stateless Rendering**: Separate state from display logic
- **Modal Dialogs**: Clean UX for file operations
- **Menu System**: Traditional menu bar with dropdowns

### Features

**📝 Text Editing**
- Full text editing with gap buffer
- Unicode support (emoji: 🎉 ✨ 🚀)
- Line numbers and scrollbar
- Minimap visualization
- Mouse and keyboard navigation

**💾 File Management**
- **Save to Browser** (Ctrl+S) - Store in localStorage
- **Load from Browser** (Ctrl+O) - Browse saved files
- **Share via URL** (Ctrl+E) - Generate compressed URLs
- **Load from Gist** (Ctrl+G) - Import from GitHub
- **Save as Gist** (Ctrl+Shift+S) - Export to GitHub

**🔗 Collaboration**
- Share documents via compressed URL
- Load from public GitHub Gists
- Create new Gists (no API key needed)
- URL-based content loading

### Quick Start

1. **Type** your content
2. **Save** with Ctrl+S to browser storage
3. **Share** with Ctrl+E to get a URL
4. **Load** with Ctrl+G from a Gist ID

### Keyboard Shortcuts

- **Ctrl+S** - Save to browser
- **Ctrl+O** - Open from browser
- **Ctrl+E** - Share URL
- **Ctrl+G** - Load Gist
- **Ctrl+Shift+S** - Save as Gist
- **F1** - Show help

Try it now - edit, save, and share your content!
