## Test markdown parsing and Nimini compilation
## Usage: nim c -r test_markdown.nim examples/audio_slider.md

import os, strutils, tables
import src/nimini

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
  for i, codeBlock in codeBlocks:
    echo "--- Code Block ", i + 1, " ---"
    echo "Event: ", codeBlock.event
    echo "Lines: ", codeBlock.code.split('\n').len
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
      echo "  ERROR: ", e.msg
      echo ""
      
      # Show problematic code section
      let lines = codeBlock.code.split('\n')
      
      # Try to extract line number from error message
      if "line" in e.msg:
        # Try to extract line number from error
        var lineNum = 0
        let parts = e.msg.split(" ")
        for j, part in parts:
          if part == "line" and j + 1 < parts.len:
            try:
              lineNum = parseInt(parts[j + 1])
            except:
              discard
        
        if lineNum > 0 and lineNum <= lines.len:
          echo "  Problem area (around line ", lineNum, "):"
          echo "  " & "-".repeat(50)
          let startLine = max(1, lineNum - 2)
          let endLine = min(lines.len, lineNum + 2)
          
          for lineIdx in startLine..endLine:
            let marker = if lineIdx == lineNum: " >>> " else: "     "
            echo "  ", marker, lineIdx, ": ", lines[lineIdx - 1]
          echo "  " & "-".repeat(50)
      
      echo ""
      quit(1)
  
  echo "=" .repeat(60)
  echo "All code blocks compiled successfully!"

when isMainModule:
  if paramCount() < 1:
    echo "Usage: test_markdown <markdown_file>"
    echo "Example: test_markdown examples/audio_slider.md"
    quit(1)
  
  let filename = paramStr(1)
  testMarkdownFile(filename)
