## Example: Using Storie with pure Nimini scripts (no markdown)
## This demonstrates using the engine library directly

import ../storie

# Simple Nimini script as a string
const niminiScript = """
# Bouncing ball example
var x = 400
var y = 300
var vx = 3
var vy = 2

while true:
  clear()
  
  # Update position
  x = x + vx
  y = y + vy
  
  # Bounce off walls
  if x < 20 or x > 780:
    vx = -vx
  
  if y < 20 or y > 580:
    vy = -vy
  
  # Draw the ball
  setColor(100, 200, 255)
  fillCircle(x, y, 20)
  
  # Draw border
  setColor(255, 255, 255)
  drawRect(0, 0, width, height, 2)
"""

proc customRender() =
  # Execute our Nimini script each frame
  discard executeNiminiCode(niminiScript)

when isMainModule:
  # Initialize engine
  initStorie(
    width = 800,
    height = 600,
    enable3D = false,
    renderCallback = customRender
  )
  
  # Run main loop
  runStorie()
