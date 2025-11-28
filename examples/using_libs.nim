# Example: Using Library Modules
# This demonstrates how to use the helper libraries (lib/events, lib/animation, lib/ui_components)

import lib/events
import lib/animation
import lib/ui_components

# ================================================================
# APP STATE
# ================================================================

var eventHandler: TerminalEventHandler
var fadeAnimation: Animation
var buttonHovered = false
var button: Button
var particleEffect: seq[Particle] = @[]
var lastSpawnTime = 0.0

# ================================================================
# INITIALIZATION
# ================================================================

onInit = proc(state: AppState) =
  # Setup event handler from lib/events
  eventHandler = newTerminalEventHandler(EventHandlerConfig(
    enableMouseTracking: true,
    enableResizeTracking: true,
    consumeEvents: true
  ))
  
  # Setup event callbacks
  eventHandler.onKeyDown = proc(code: int, mods: set[uint8]): bool =
    if code == ord('q') or code == INPUT_ESCAPE:
      state.running = false
      return true
    return false
  
  eventHandler.onMouseMove = proc(x, y: int, mods: set[uint8]): bool =
    buttonHovered = button.contains(x, y)
    return false
  
  eventHandler.onMouseDown = proc(btn: MouseButton, x, y: int, mods: set[uint8]): bool =
    if button.contains(x, y):
      # Spawn particles on button click
      for i in 0 ..< 20:
        let angle = float(i) * 0.314159  # ~PI/10
        let speed = 5.0 + float(i mod 5) * 2.0
        particleEffect.add(newParticle(
          float(x), float(y),
          cos(angle) * speed, sin(angle) * speed,
          1.0 + float(i mod 3) * 0.5,
          ["*", "·", "•", "○"][i mod 4],
          [red(), yellow(), cyan(), magenta()][i mod 4]
        ))
      return true
    return false
  
  # Setup animation from lib/animation
  fadeAnimation = newAnimation(3.0, loop = true, pingpong = true)
  
  # Setup button from lib/ui_components
  button = newButton(
    state.termWidth div 2 - 10,
    state.termHeight div 2,
    20, 3,
    "Click Me!"
  )

# ================================================================
# UPDATE
# ================================================================

onUpdate = proc(state: AppState, dt: float) =
  # Update animation
  fadeAnimation.update(dt)
  
  # Update particles
  lastSpawnTime += dt
  for particle in particleEffect.mitems:
    particle.update(dt, gravity = 9.8)
  
  # Remove dead particles
  var i = 0
  while i < particleEffect.len:
    if not particleEffect[i].isAlive():
      particleEffect.delete(i)
    else:
      inc i
  
  # Auto-spawn particles occasionally
  if lastSpawnTime > 0.5:
    lastSpawnTime = 0.0
    let x = float(10 + (state.frameCount mod (state.termWidth - 20)))
    let y = 5.0
    particleEffect.add(newParticle(
      x, y,
      0.0, 3.0,
      2.0,
      "✦",
      rgb(
        uint8(128 + (state.frameCount * 17) mod 128),
        uint8(128 + (state.frameCount * 23) mod 128),
        uint8(128 + (state.frameCount * 31) mod 128)
      )
    ))

# ================================================================
# RENDER
# ================================================================

onRender = proc(state: AppState) =
  # Use animation progress for fade effect
  let progress = fadeAnimation.progress()
  let alpha = easeInOutSine(progress)
  
  # Clear with animated background
  let bgLevel = uint8(alpha * 32.0)
  let bgStyle = Style(fg: white(), bg: rgb(bgLevel, 0, bgLevel))
  state.currentBuffer.fillRect(0, 0, state.termWidth, state.termHeight, " ", bgStyle)
  
  # Draw main box using lib/ui_components
  let boxStyle = Style(
    fg: lerpColor(cyan(), magenta(), alpha),
    bg: black(),
    bold: true
  )
  drawBox(state, 2, 2, state.termWidth - 4, state.termHeight - 4, boxStyle, "Library Demo")
  
  # Draw title with animated color
  let titleColor = lerpColor(yellow(), red(), alpha)
  let titleStyle = Style(fg: titleColor, bg: black(), bold: true, underline: true)
  let title = "Using lib/events, lib/animation, lib/ui_components"
  state.currentBuffer.writeText((state.termWidth - title.len) div 2, 4, title, titleStyle)
  
  # Draw instructions
  let instrStyle = Style(fg: gray(200), bg: black())
  state.currentBuffer.writeText(4, 6, "• Move mouse over button to see hover effect", instrStyle)
  state.currentBuffer.writeText(4, 7, "• Click button to spawn particles", instrStyle)
  state.currentBuffer.writeText(4, 8, "• Auto-spawning particles at top", instrStyle)
  state.currentBuffer.writeText(4, 9, "• Press 'q' or ESC to quit", instrStyle)
  
  # Draw button (uses lib/ui_components)
  button.render(state, buttonHovered)
  
  # Draw progress bar showing animation progress
  let progressY = state.termHeight - 5
  let progressLabel = $int(progress * 100.0) & "%"
  drawProgressBar(state, 4, progressY, state.termWidth - 8, progress, 
                  Style(fg: green(), bg: black()), progressLabel)
  
  # Draw particles (uses lib/animation)
  for particle in particleEffect:
    particle.render(state)
  
  # Draw stats
  let statsStyle = Style(fg: gray(180), bg: black(), dim: true)
  state.currentBuffer.writeText(4, state.termHeight - 3, 
    "FPS: " & $int(state.fps) & " | Particles: " & $particleEffect.len, statsStyle)

# ================================================================
# INPUT
# ================================================================

onInput = proc(state: AppState, event: InputEvent): bool =
  # Dispatch to event handler from lib/events
  return eventHandler.dispatchEvent(event)

# ================================================================
# SHUTDOWN
# ================================================================

onShutdown = proc(state: AppState) =
  echo "Demo shutting down"
  let (events, dropped) = eventHandler.getStats()
  echo "Event stats - Total: ", events, ", Dropped: ", dropped
