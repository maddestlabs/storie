## Simple Counter - Direct API
## Minimal example showing the simplified architecture

var counter = 0
var message = "Press space to increment, 'r' to reset, 'q' to quit"

onInit = proc(state: AppState) =
  discard  # No setup needed for this simple example

onUpdate = proc(state: AppState, dt: float) =
  discard  # No per-frame updates needed

onRender = proc(state: AppState) =
  state.currentBuffer.clear()
  
  let titleStyle = Style(fg: yellow(), bg: black(), bold: true)
  let counterStyle = Style(fg: cyan(), bg: black(), bold: true)
  let textStyle = Style(fg: white(), bg: black())
  
  # Draw title
  state.currentBuffer.writeText(2, 2, "Counter Demo", titleStyle)
  
  # Draw counter value (big!)
  let counterText = $counter
  let x = (state.termWidth - counterText.len) div 2
  state.currentBuffer.writeText(x, state.termHeight div 2, counterText, counterStyle)
  
  # Draw instructions
  state.currentBuffer.writeText(2, state.termHeight - 2, message, textStyle)

onInput = proc(state: AppState, event: InputEvent): bool =
  if event.kind == KeyEvent and event.keyAction == Press:
    case event.keyCode
    of INPUT_SPACE:
      inc counter
      return true
    of ord('r'):
      counter = 0
      return true
    of ord('q'):
      state.running = false
      return true
    else:
      discard
  return false

onShutdown = proc(state: AppState) =
  discard
