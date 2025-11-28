## Animation Helpers Module
## Reusable animation utilities

import ../backstorie
import math

# ================================================================
# EASING FUNCTIONS
# ================================================================

proc easeLinear*(t: float): float = t

proc easeInQuad*(t: float): float = t * t

proc easeOutQuad*(t: float): float = t * (2.0 - t)

proc easeInOutQuad*(t: float): float =
  if t < 0.5: 2.0 * t * t
  else: -1.0 + (4.0 - 2.0 * t) * t

proc easeInCubic*(t: float): float = t * t * t

proc easeOutCubic*(t: float): float =
  let t1 = t - 1.0
  t1 * t1 * t1 + 1.0

proc easeInOutCubic*(t: float): float =
  if t < 0.5: 4.0 * t * t * t
  else:
    let t1 = 2.0 * t - 2.0
    (t1 * t1 * t1 + 2.0) / 2.0

proc easeInSine*(t: float): float =
  1.0 - cos(t * PI / 2.0)

proc easeOutSine*(t: float): float =
  sin(t * PI / 2.0)

proc easeInOutSine*(t: float): float =
  -(cos(PI * t) - 1.0) / 2.0

# ================================================================
# INTERPOLATION
# ================================================================

proc lerp*(a, b, t: float): float =
  ## Linear interpolation
  a + (b - a) * t

proc lerpColor*(a, b: Color, t: float): Color =
  ## Interpolate between two colors
  Color(
    r: uint8(lerp(float(a.r), float(b.r), t)),
    g: uint8(lerp(float(a.g), float(b.g), t)),
    b: uint8(lerp(float(a.b), float(b.b), t))
  )

# ================================================================
# ANIMATION STATE
# ================================================================

type
  Animation* = object
    duration*: float
    elapsed*: float
    loop*: bool
    pingpong*: bool
    reversed: bool

proc newAnimation*(duration: float, loop: bool = false, pingpong: bool = false): Animation =
  Animation(duration: duration, elapsed: 0.0, loop: loop, pingpong: pingpong, reversed: false)

proc update*(anim: var Animation, dt: float) =
  ## Update animation time
  anim.elapsed += dt
  
  if anim.elapsed >= anim.duration:
    if anim.loop:
      if anim.pingpong:
        anim.reversed = not anim.reversed
        anim.elapsed = 0.0
      else:
        anim.elapsed = anim.elapsed mod anim.duration
    else:
      anim.elapsed = anim.duration

proc progress*(anim: Animation): float =
  ## Get current animation progress (0.0 to 1.0)
  let t = anim.elapsed / anim.duration
  if anim.reversed:
    return 1.0 - t
  return t

proc isDone*(anim: Animation): bool =
  ## Check if animation has finished (for non-looping animations)
  not anim.loop and anim.elapsed >= anim.duration

# ================================================================
# PARTICLE SYSTEM
# ================================================================

type
  Particle* = object
    x*, y*: float
    vx*, vy*: float
    life*: float
    maxLife*: float
    char*: string
    color*: Color

proc newParticle*(x, y, vx, vy, life: float, char: string, color: Color): Particle =
  Particle(x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life, char: char, color: color)

proc update*(p: var Particle, dt: float, gravity: float = 0.0) =
  p.x += p.vx * dt
  p.y += p.vy * dt
  p.vy += gravity * dt
  p.life -= dt

proc isAlive*(p: Particle): bool =
  p.life > 0.0

proc render*(p: Particle, state: AppState) =
  if p.isAlive():
    let alpha = p.life / p.maxLife
    var color = p.color
    # Fade out based on life
    color.r = uint8(float(color.r) * alpha)
    color.g = uint8(float(color.g) * alpha)
    color.b = uint8(float(color.b) * alpha)
    
    let style = Style(fg: color, bg: black())
    let ix = int(p.x)
    let iy = int(p.y)
    if ix >= 0 and ix < state.termWidth and iy >= 0 and iy < state.termHeight:
      state.currentBuffer.write(ix, iy, p.char, style)

proc renderToLayer*(p: Particle, layer: Layer) =
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
