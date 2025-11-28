## Particle Burst Example
## Shows direct usage without plugin boilerplate

import math, random

# ================================================================
# PARTICLE SYSTEM
# ================================================================

type
  Particle = object
    x, y: float
    vx, vy: float
    life: float
    maxLife: float
    char: string
    color: Color

proc newParticle(x, y, vx, vy, life: float, char: string, color: Color): Particle =
  Particle(x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, char: char, color: color)

proc update(p: var Particle, dt: float, gravity: float = 0.0) =
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.vy += gravity * dt
  p.life -= dt

proc isAlive(p: Particle): bool =
  p.life > 0.0

proc renderToLayer(p: Particle, layer: Layer) =
  if p.isAlive():
    let alpha = p.life / p.maxLife
    var color = p.color
    color.r = uint8(float(color.r) * alpha)
    color.g = uint8(float(color.g) * alpha)
    color.b = uint8(float(color.b) * alpha)
    
    let style = Style(fg: color, bg: black())
    let ix = int(p.x)
    let iy = int(p.y)
    if ix >= 0 and ix < layer.buffer.width and iy >= 0 and iy < layer.buffer.height:
      layer.buffer.write(ix, iy, p.char, style)

# ================================================================
# GAME STATE
# ================================================================

var particles: seq[Particle] = @[]
var particleLayer: Layer
var uiLayer: Layer

proc spawnBurst(x, y: float, count: int, color: Color) =
  ## Create a burst of particles
  for i in 0 ..< count:
    let angle = rand(2.0 * PI)
    let speed = rand(20.0) + 10.0
    let vx = cos(angle) * speed
    let vy = sin(angle) * speed
    let life = rand(2.0) + 1.0
    let chars = ["*", "·", "•", "+", "×"]
    let char = chars[rand(chars.len - 1)]
    
    particles.add(newParticle(x, y, vx, vy, life, char, color))

onInit = proc(state: AppState) =
  randomize()
  particleLayer = state.addLayer("particles", 5)
  uiLayer = state.addLayer("ui", 10)
  
  # Initial burst in center
  spawnBurst(float(state.termWidth div 2), float(state.termHeight div 2), 50, yellow())

onUpdate = proc(state: AppState, dt: float) =
  # Update all particles
  for p in particles.mitems:
    p.update(dt, gravity = 20.0)  # Apply gravity
  
  # Remove dead particles
  var i = 0
  while i < particles.len:
    if not particles[i].isAlive():
      particles.delete(i)
    else:
      inc i

onRender = proc(state: AppState) =
  # Clear layers
  particleLayer.buffer.clearTransparent()
  uiLayer.buffer.clearTransparent()
  
  # Render particles
  for p in particles:
    p.renderToLayer(particleLayer)
  
  # Draw UI
  let titleStyle = Style(fg: yellow(), bg: black(), bold: true)
  let textStyle = Style(fg: white(), bg: black())
  
  uiLayer.buffer.writeText(2, 0, "Particle Demo", titleStyle)
  uiLayer.buffer.writeText(2, 1, "Click anywhere to spawn particles!", textStyle)
  uiLayer.buffer.writeText(2, 2, "Active particles: " & $particles.len, textStyle)
  uiLayer.buffer.writeText(2, 3, "Press 'q' to quit", textStyle)

onInput = proc(state: AppState, event: InputEvent): bool =
  case event.kind
  of KeyEvent:
    if event.keyAction == Press and event.keyCode == ord('q'):
      state.running = false
      return true
  
  of MouseEvent:
    if event.action == Press and event.button == Left:
      # Spawn particles at click location
      let colors = [red(), green(), blue(), cyan(), magenta(), yellow()]
      spawnBurst(float(event.mouseX), float(event.mouseY), 30, colors[rand(colors.len - 1)])
      return true
  
  else:
    discard
  
  return false

onShutdown = proc(state: AppState) =
  discard
