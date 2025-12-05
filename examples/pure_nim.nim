## Example: Using Storie with pure Nim (no Nimini, no markdown)
## This demonstrates direct API usage

import ../storie

var ballX = 400.0
var ballY = 300.0
var velX = 3.0
var velY = 2.0

proc update() =
  # Update ball position
  ballX += velX
  ballY += velY
  
  # Bounce off walls
  if ballX < 20 or ballX > 780:
    velX = -velX
  
  if ballY < 20 or ballY > 580:
    velY = -velY

proc render() =
  # We need to use Nimini for now since the drawing API
  # is exposed through it. In a future refactor, we could
  # expose direct Nim drawing APIs.
  let script = """
  clear()
  setColor(255, 100, 150)
  fillCircle(""" & $ballX.int & ", " & $ballY.int & """, 20)
  setColor(255, 255, 255)
  drawRect(0, 0, width, height, 2)
  """
  discard executeNiminiCode(script)

when isMainModule:
  # Initialize engine with callbacks
  initStorie(
    width = 800,
    height = 600,
    enable3D = false,
    updateCallback = update,
    renderCallback = render
  )
  
  # Run main loop
  runStorie()
