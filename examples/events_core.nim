## Event Handler example for Backstorie

import std/strformat

# ================================================================
# DEMO STATE
# ================================================================

var eventLog: seq[string] = @[]
var lastEvent = ""
var eventCount = 0

# ================================================================
# RENDERING
# ================================================================

proc renderScreen(state: AppState) =
  ## Render the demo UI
  
  state.currentBuffer.clear()
  
  var style = Style(fg: white(), bg: black())
  var y = 0
  
  # Title
  state.currentBuffer.writeText(0, y, "=== Backstorie Event Handler Demo ===", style)
  y += 2
  
  # Instructions
  state.currentBuffer.writeText(0, y, "Type text, press keys, move mouse, scroll, resize terminal", style)
  state.currentBuffer.writeText(0, y + 1, "Press ESC to exit", style)
  y += 3
  
  # Status
  state.currentBuffer.writeText(0, y, &"Size: {state.termWidth}x{state.termHeight}", style)
  y += 1
  state.currentBuffer.writeText(0, y, &"Events: {eventCount}", style)
  y += 2
  
  # Last event
  var highlight = Style(fg: yellow(), bg: black())
  state.currentBuffer.writeText(0, y, "Last: ", style)
  state.currentBuffer.writeText(6, y, lastEvent, highlight)
  y += 2
  
  # Log
  state.currentBuffer.writeText(0, y, "Log:", style)
  y += 1
  for line in eventLog:
    if y < state.termHeight - 1:
      state.currentBuffer.writeText(2, y, line, style)
      y += 1

# ================================================================
# EVENT PROCESSING
# ================================================================

proc handleEvent(event: InputEvent) =
  ## Process an event directly
  
  inc eventCount
  
  case event.kind
  of InputEventKind.TextEvent:
    lastEvent = &"TEXT: '{event.text}'"
    eventLog.add(lastEvent)
  
  of InputEventKind.KeyEvent:
    let keyName = case event.keyCode
      of INPUT_ESCAPE: "ESC"
      of INPUT_ENTER: "ENTER"
      of INPUT_SPACE: "SPACE"
      of INPUT_UP: "UP"
      of INPUT_DOWN: "DOWN"
      of INPUT_LEFT: "LEFT"
      of INPUT_RIGHT: "RIGHT"
      else: &"KEY{event.keyCode}"
    
    lastEvent = &"KEY: {keyName}"
    eventLog.add(lastEvent)
  
  of InputEventKind.MouseEvent:
    lastEvent = &"MOUSE: ({event.mouseX}, {event.mouseY})"
    eventLog.add(lastEvent)
  
  of InputEventKind.MouseMoveEvent:
    lastEvent = &"MOUSE MOVE: ({event.moveX}, {event.moveY})"
  
  of InputEventKind.ResizeEvent:
    lastEvent = &"RESIZE: {event.newWidth}x{event.newHeight}"
    eventLog.add(lastEvent)
  
  if eventLog.len > 30:
    eventLog.delete(0)

# ================================================================
# ASSIGN THE BACKSTORIE CALLBACKS
# ================================================================

onInit = proc(state: AppState) =
  ## Initialize
  eventLog.add("App initialized")

onUpdate = proc(state: AppState, dt: float) =
  ## Update
  discard

onRender = proc(state: AppState) =
  ## Render
  renderScreen(state)

onInput = proc(state: AppState, event: InputEvent): bool =
  ## Handle input - process event directly
  
  handleEvent(event)
  
  # Check for ESC to exit
  if event.kind == InputEventKind.KeyEvent and event.keyCode == INPUT_ESCAPE:
    state.running = false
    return true
  
  return false

onShutdown = proc(state: AppState) =
  ## Cleanup
  discard