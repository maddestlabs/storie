# FadeIn Animation Demo - Direct API
import math

# ================================================================
# ANIMATION STATE
# ================================================================

var 
  fadeLayer: Layer
  fadeTime: float = 0.0
  fadeDuration: float = 2.0
  fadeText: string = "FADE IN TEST"
  fadeX: int = 5
  fadeY: int = 5

# ================================================================
# EASING FUNCTION
# ================================================================

proc easeInSine(t: float): float =
  ## Smooth ease-in using sine curve
  return 1.0 - cos((t * PI) / 2.0)

# ================================================================
# CALLBACKS
# ================================================================

onInit = proc(state: AppState) =
  ## Initialize fade animation layer
  fadeLayer = state.addLayer("fade", 100)

onUpdate = proc(state: AppState, dt: float) =
  ## Update fade animation
  if fadeTime < fadeDuration:
    fadeTime += dt

onRender = proc(state: AppState) =
  ## Render fade effect
  state.currentBuffer.clear()
  fadeLayer.buffer.clearTransparent()
  
  # Calculate fade progress (0.0 to 1.0)
  let progress = min(fadeTime / fadeDuration, 1.0)
  let easedProgress = easeInSine(progress)
  
  # Calculate alpha (0-255)
  let alpha = uint8(easedProgress * 255.0)
  
  # Create fading style
  let fadeStyle = Style(
    fg: rgb(alpha, alpha, alpha),
    bg: black(),
    bold: false,
    underline: false,
    italic: false,
    dim: false
  )
  
  # Render fading text
  fadeLayer.buffer.writeText(fadeX, fadeY, fadeText, fadeStyle)
  
  # Show instructions
  let dimStyle = Style(
    fg: gray(128),
    bg: black(),
    bold: false,
    underline: false,
    italic: false,
    dim: true
  )
  state.currentBuffer.writeText(1, 1, "FadeIn Animation Demo", defaultStyle())
  let y = state.termHeight - 2
  state.currentBuffer.writeText(1, y, "Press 'q' to quit", dimStyle)

onInput = proc(state: AppState, event: InputEvent): bool =
  ## Handle input
  if event.kind == KeyEvent:
    if event.keyCode == ord('q') or event.keyCode == ord('Q'):
      state.running = false
      return true
  return false

onShutdown = proc(state: AppState) =
  ## Cleanup
  discard