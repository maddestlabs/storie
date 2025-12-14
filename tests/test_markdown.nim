## Test markdown parsing and Nimini compilation
## Usage: nim c -r test_markdown.nim examples/audio_slider.md

import os, strutils, tables
import nimini

type
  CodeBlock = object
    event: string
    code: string
    lineNumber: int

proc parseMarkdown(content: string): seq[CodeBlock] =
  ## Parse markdown and extract code blocks with event types
  result = @[]
  var inCodeBlock = false
  var currentBlock = CodeBlock()
  var lineNum = 0
  
  for line in content.splitLines():
    inc lineNum
    
    if line.strip().startsWith("```nim"):
      inCodeBlock = true
      currentBlock = CodeBlock()
      currentBlock.lineNumber = lineNum
      
      # Extract event type (e.g., "on:init", "on:render")
      let parts = line.strip().split()
      if parts.len > 1:
        currentBlock.event = parts[1]
      else:
        currentBlock.event = "code"
    elif inCodeBlock and line.strip().startsWith("```"):
      inCodeBlock = false
      result.add(currentBlock)
    elif inCodeBlock:
      if currentBlock.code.len > 0:
        currentBlock.code.add("\n")
      currentBlock.code.add(line)

proc testMarkdownFile(filename: string) =
  echo "Testing markdown file: ", filename
  echo "=" .repeat(60)
  
  if not fileExists(filename):
    echo "Error: File not found: ", filename
    quit(1)
  
  # Read file
  let content = readFile(filename)
  echo "File size: ", content.len, " bytes"
  echo ""
  
  # Parse markdown
  let codeBlocks = parseMarkdown(content)
  echo "Parsed ", codeBlocks.len, " code blocks"
  echo ""
  
  # Process each code block
  var hasErrors = false
  
  for i, codeBlock in codeBlocks:
    echo "--- Code Block ", i + 1, " (", codeBlock.event, ") ---"
    echo "Markdown line: ", codeBlock.lineNumber
    echo "Code lines: ", codeBlock.code.split('\n').len
    echo ""
    
    # Try to compile with Nimini
    echo "Compiling with Nimini..."
    try:
      initRuntime()
      let tokens = tokenizeDsl(codeBlock.code)
      echo "  Tokens: ", tokens.len
      
      let program = parseDsl(tokens)
      echo "  Parsed successfully!"
      echo ""
    except Exception as e:
      echo "  ✗ ERROR: ", e.msg
      echo ""
      
      # Show problematic code section
      let lines = codeBlock.code.split('\n')
      
      # Always show context around error
      echo "  Code context:"
      echo "  " & "=".repeat(70)
      
      # Try to extract line number from error message
      var errorLine = 0
      if "line" in e.msg:
        # Try to extract line number from error
        let parts = e.msg.split(" ")
        for j, part in parts:
          if part == "line" and j + 1 < parts.len:
            try:
              errorLine = parseInt(parts[j + 1])
            except:
              discard
      
      if errorLine > 0 and errorLine <= lines.len:
        # Show context around the error line
        let startLine = max(1, errorLine - 3)
        let endLine = min(lines.len, errorLine + 3)
        
        for lineIdx in startLine..endLine:
          let marker = if lineIdx == errorLine: " >>> " else: "     "
          let lineNumStr = ($lineIdx).align(4)
          echo "  ", marker, lineNumStr, ": ", lines[lineIdx - 1]
      else:
        # Show first 10 lines if we can't find the error line
        echo "  First 10 lines of code block:"
        for lineIdx in 1..min(10, lines.len):
          let lineNumStr = ($lineIdx).align(4)
          echo "       ", lineNumStr, ": ", lines[lineIdx - 1]
        if lines.len > 10:
          echo "       ... (", lines.len - 10, " more lines)"
      
      echo "  " & "=".repeat(70)
      
      echo ""
      echo "  ⚠  Block starts at markdown line ", codeBlock.lineNumber
      if errorLine > 0:
        echo "  ⚠  Error is at code line ", errorLine, " (markdown line ~", codeBlock.lineNumber + errorLine, ")"
      echo ""
      
      hasErrors = true
  
  echo "=" .repeat(60)
  
  if hasErrors:
    echo "❌ FAILED - Errors found in code blocks"
    echo ""
    quit(1)
  else:
    echo "✅ SUCCESS - All code blocks compiled successfully!"
    echo ""
    quit(0)

when isMainModule:
  if paramCount() < 1:
    echo "Usage: test_markdown <markdown_file>"
    echo "Example: test_markdown examples/audio_slider.md"
    quit(1)
  
  let filename = paramStr(1)
  testMarkdownFile(filename)
