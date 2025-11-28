## Windows Minimal Test
## A very simple test to verify Windows rendering works
## This is the simplest possible example to test basic functionality

var titleStyle = defaultStyle()
titleStyle.fg = green()
titleStyle.bold = true

var textStyle = defaultStyle()
textStyle.fg = white()

var highlightStyle = defaultStyle()
highlightStyle.fg = yellow()
highlightStyle.bold = true

var frameCounter = 0

onInit = proc(state: AppState) =
  # Simple initialization
  discard

onUpdate = proc(state: AppState, dt: float) =
  # Simple counter
  inc frameCounter

onRender = proc(state: AppState) =
  # Clear the screen
  state.currentBuffer.clear()
  
  let w = state.termWidth
  let h = state.termHeight
  
  # Draw a simple border
  let borderStyle = Style(fg: cyan(), bg: black())
  
  # Top border
  for x in 0 ..< w:
    state.currentBuffer.write(x, 0, "=", borderStyle)
  
  # Bottom border
  for x in 0 ..< w:
    state.currentBuffer.write(x, h - 1, "=", borderStyle)
  
  # Side borders
  for y in 1 ..< h - 1:
    state.currentBuffer.write(0, y, "|", borderStyle)
    state.currentBuffer.write(w - 1, y, "|", borderStyle)
  
  # Title
  let title = "WINDOWS TEST - Backstorie Engine"
  let titleX = (w - title.len) div 2
  state.currentBuffer.writeText(titleX, 2, title, titleStyle)
  
  # Display basic info
  let centerY = h div 2
  
  state.currentBuffer.writeText(5, centerY - 3, "If you can see this text, Windows support is working!", textStyle)
  state.currentBuffer.writeText(5, centerY - 1, "Terminal Size: " & $w & " x " & $h, highlightStyle)
  state.currentBuffer.writeText(5, centerY, "Frame Count: " & $frameCounter, highlightStyle)
  state.currentBuffer.writeText(5, centerY + 1, "FPS: " & $int(state.fps), highlightStyle)
  
  # Instructions
  state.currentBuffer.writeText(5, h - 4, "Press 'Q' or ESC to quit", textStyle)
  
  # Color test
  state.currentBuffer.writeText(5, h - 6, "Color Test:", textStyle)
  var colorStyle = defaultStyle()
  
  colorStyle.fg = red()
  state.currentBuffer.writeText(18, h - 6, "Red", colorStyle)
  
  colorStyle.fg = green()
  state.currentBuffer.writeText(22, h - 6, "Green", colorStyle)
  
  colorStyle.fg = blue()
  state.currentBuffer.writeText(28, h - 6, "Blue", colorStyle)
  
  colorStyle.fg = yellow()
  state.currentBuffer.writeText(33, h - 6, "Yellow", colorStyle)
  
  colorStyle.fg = magenta()
  state.currentBuffer.writeText(40, h - 6, "Magenta", colorStyle)
  
  colorStyle.fg = cyan()
  state.currentBuffer.writeText(48, h - 6, "Cyan", colorStyle)

onInput = proc(state: AppState, event: InputEvent): bool =
  if event.kind == KeyEvent and event.keyAction == Press:
    # Check for Q key or ESC key
    if event.keyCode == ord('q') or event.keyCode == ord('Q') or event.keyCode == INPUT_ESCAPE:
      state.running = false
      return true
  return false

onShutdown = proc(state: AppState) =
  # Cleanup
  discard
