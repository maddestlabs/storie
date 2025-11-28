# Simple WASM Test Example
# This example tests the WASM build with basic functionality

var message = "WASM Test - Press ESC to note in console"
var colorPhase = 0.0

onInit = proc(state: AppState) =
  echo "WASM Test initialized!"
  echo "Terminal size: ", state.termWidth, "x", state.termHeight

onUpdate = proc(state: AppState, dt: float) =
  colorPhase += dt

onRender = proc(state: AppState) =
  let tb = addr state.currentBuffer
  tb.clear()
  
  # Draw a border
  let w = state.termWidth
  let h = state.termHeight
  
  for x in 0 ..< w:
    tb.write(x, 0, "═", defaultStyle())
    tb.write(x, h - 1, "═", defaultStyle())
  
  for y in 0 ..< h:
    tb.write(0, y, "║", defaultStyle())
    tb.write(w - 1, y, "║", defaultStyle())
  
  # Corners
  tb.write(0, 0, "╔", defaultStyle())
  tb.write(w - 1, 0, "╗", defaultStyle())
  tb.write(0, h - 1, "╚", defaultStyle())
  tb.write(w - 1, h - 1, "╝", defaultStyle())
  
  # Centered text with animated color
  let centerX = (w - message.len) div 2
  let centerY = h div 2
  
  let r = uint8((sin(colorPhase) * 0.5 + 0.5) * 255)
  let g = uint8((sin(colorPhase + 2.0) * 0.5 + 0.5) * 255)
  let b = uint8((sin(colorPhase + 4.0) * 0.5 + 0.5) * 255)
  
  var style = defaultStyle()
  style.fg = rgb(r, g, b)
  style.bold = true
  
  tb.writeText(centerX, centerY, message, style)
  
  # Show FPS and frame count
  let info = "FPS: " & $int(state.fps) & " | Frame: " & $state.frameCount & " | Size: " & $w & "x" & $h
  tb.writeText(2, 2, info, defaultStyle())
  
  # Instructions
  let instructions = "Resize your browser window to test responsiveness"
  let instX = (w - instructions.len) div 2
  tb.writeText(instX, centerY + 2, instructions, defaultStyle())

onInput = proc(state: AppState, event: InputEvent): bool =
  case event.kind
  of KeyEvent:
    if event.keyCode == INPUT_ESCAPE:
      echo "ESC pressed! (check browser console)"
      return true
    echo "Key pressed: ", event.keyCode
  of TextEvent:
    echo "Text input: ", event.text
  of MouseEvent:
    echo "Mouse click at ", event.mouseX, ",", event.mouseY, " button: ", event.button
  of MouseMoveEvent:
    # Don't log every move, too noisy
    discard
  of ResizeEvent:
    echo "Terminal resized to ", event.newWidth, "x", event.newHeight
  return false

onShutdown = proc(state: AppState) =
  echo "WASM Test shutting down"
