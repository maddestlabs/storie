## Simple Boxes Example - Direct API
## Demonstrates the simplified architecture without plugin boilerplate
## All code is direct - no plugin boilerplate needed!

import math

# ================================================================
# HELPER: Box drawing function
# ================================================================

proc drawBoxOnLayer(layer: Layer, x, y, w, h: int, style: Style, title: string = "") =
  ## Draw a box directly on a layer
  layer.buffer.write(x, y, "┌", style)
  for i in 1 ..< w-1:
    layer.buffer.write(x + i, y, "─", style)
  layer.buffer.write(x + w - 1, y, "┐", style)
  
  if title.len > 0 and w > title.len + 4:
    let titleX = x + (w - title.len - 2) div 2
    layer.buffer.write(titleX, y, "┤", style)
    layer.buffer.writeText(titleX + 1, y, title, style)
    layer.buffer.write(titleX + title.len + 1, y, "├", style)
  
  for i in 1 ..< h-1:
    layer.buffer.write(x, y + i, "│", style)
    layer.buffer.write(x + w - 1, y + i, "│", style)
  
  layer.buffer.write(x, y + h - 1, "└", style)
  for i in 1 ..< w-1:
    layer.buffer.write(x + i, y + h - 1, "─", style)
  layer.buffer.write(x + w - 1, y + h - 1, "┘", style)

# ================================================================
# GAME STATE - Simple, direct
# ================================================================

type
  Box = object
    x, y: float
    vx, vy: float
    color: Color
    char: string

var boxes: seq[Box] = @[]
var bgLayer: Layer
var fgLayer: Layer

# ================================================================
# INITIALIZATION
# ================================================================

onInit = proc(state: AppState) =
  # Create layers directly
  bgLayer = state.addLayer("background", 0)
  fgLayer = state.addLayer("foreground", 10)
  
  # Create some boxes
  for i in 0 ..< 5:
    boxes.add(Box(
      x: float(10 + i * 15),
      y: float(5 + i * 3),
      vx: float(i + 1) * 0.5,
      vy: float(i mod 2) * 0.3,
      color: case i mod 3
             of 0: red()
             of 1: green()
             else: blue(),
      char: ["█", "●", "■", "◆", "▲"][i mod 5]
    ))

# ================================================================
# UPDATE
# ================================================================

onUpdate = proc(state: AppState, dt: float) =
  # Update boxes
  for box in boxes.mitems:
    box.x += box.vx * dt * 30.0
    box.y += box.vy * dt * 20.0
    
    # Bounce off edges
    if box.x < 0 or box.x >= float(state.termWidth - 1):
      box.vx = -box.vx
      box.x = clamp(box.x, 0.0, float(state.termWidth - 1))
    
    if box.y < 0 or box.y >= float(state.termHeight - 1):
      box.vy = -box.vy
      box.y = clamp(box.y, 0.0, float(state.termHeight - 1))

# ================================================================
# RENDER
# ================================================================

onRender = proc(state: AppState) =
  # Clear layers
  bgLayer.buffer.clearTransparent()
  fgLayer.buffer.clearTransparent()
  
  # Draw background box using helper module
  let boxStyle = Style(fg: cyan(), bg: black())
  drawBoxOnLayer(bgLayer, 0, 0, state.termWidth, state.termHeight, boxStyle, "Direct API Demo")
  
  # Draw info text on foreground layer
  let textStyle = Style(fg: white(), bg: black())
  fgLayer.buffer.writeText(2, 1, "Press 'q' to quit", textStyle)
  fgLayer.buffer.writeText(2, 2, $boxes.len & " animated boxes", textStyle)
  
  # Draw FPS
  let fpsText = "FPS: " & $int(state.fps)
  fgLayer.buffer.writeText(state.termWidth - fpsText.len - 2, 1, fpsText, textStyle)
  
  # Draw boxes on foreground layer
  for box in boxes:
    let style = Style(fg: box.color, bg: black(), bold: true)
    fgLayer.buffer.write(int(box.x), int(box.y), box.char, style)

# ================================================================
# INPUT
# ================================================================

onInput = proc(state: AppState, event: InputEvent): bool =
  # Handle input directly - no plugin wrapper needed
  if event.kind == KeyEvent and event.keyAction == Press:
    if event.keyCode == ord('q'):
      state.running = false
      return true
  return false

onShutdown = proc(state: AppState) =
  # Clean up if needed
  discard
