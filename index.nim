# Default demo for Backstorie engine
# Shows a welcome screen with terminal info and border

# This file allows easy building off of Backstorie's engine
# without needing to touch core engine files.

var welcomeStyle = defaultStyle()
welcomeStyle.fg = cyan()
welcomeStyle.bold = true

var infoStyle = defaultStyle()
infoStyle.fg = yellow()

var borderStyle = defaultStyle()
borderStyle.fg = green()

var hintStyle = defaultStyle()
hintStyle.fg = gray(180)

onInit = proc(state: AppState) =
  discard

onUpdate = proc(state: AppState, dt: float) =
  discard

onRender = proc(state: AppState) =
  # Clear the screen
  state.currentBuffer.clear()
  
  let w = state.termWidth
  let h = state.termHeight
  
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

onInput = proc(state: AppState, event: InputEvent): bool =
  if event.kind == KeyEvent and event.keyAction == Press:
    # Check for Q key or ESC key
    if event.keyCode == ord('q') or event.keyCode == ord('Q') or event.keyCode == INPUT_ESCAPE:
      state.running = false
      return true
  return false

onShutdown = proc(state: AppState) =
  # Terminal cleanup is handled by the engine automatically
  discard
