## examples/raylib_compat_demo.nim
## Demonstrates raylib API compatibility with Storie

import ../storie/raylib

const
  screenWidth = 800
  screenHeight = 450

proc main() =
  # Initialize window - pure raylib style!
  initWindow(screenWidth, screenHeight, "Storie - Raylib Compatibility Demo")
  setTargetFPS(60)
  
  var
    ballPosition = vec2(screenWidth / 2, screenHeight / 2)
    ballSpeed = vec2(5.0, 4.0)
    ballRadius = 20.0
  
  # Main game loop - classic raylib pattern
  while not windowShouldClose():
    # Update
    ballPosition.x += ballSpeed.x
    ballPosition.y += ballSpeed.y
    
    # Check walls collision
    if ballPosition.x >= screenWidth - ballRadius or ballPosition.x <= ballRadius:
      ballSpeed.x *= -1
    if ballPosition.y >= screenHeight - ballRadius or ballPosition.y <= ballRadius:
      ballSpeed.y *= -1
    
    # Draw
    beginDrawing()
    clearBackground(RayWhite)
    
    drawText("Raylib-compatible API with Storie!", 10, 10, 20, DarkGray)
    drawText("Move the ball by clicking!", 10, 40, 20, Gray)
    drawText("Press ESC to exit", 10, screenHeight - 30, 20, Gray)
    
    # Draw bouncing ball
    drawCircleV(ballPosition, ballRadius, Maroon)
    drawCircleLines(ballPosition.x.int, ballPosition.y.int, ballRadius, Gold)
    
    # Draw some shapes
    drawRectangle(10, 70, 200, 50, Blue)
    drawRectangleLines(10, 130, 200, 50, Red)
    
    # Mouse interaction
    if isMouseButtonPressed(MouseButtonLeft):
      ballPosition = getMousePosition()
    
    # Show mouse position
    let mousePos = getMousePosition()
    drawText("Mouse: " & $mousePos.x.int & ", " & $mousePos.y.int, 10, screenHeight - 60, 20, DarkGreen)
    
    # Show FPS
    drawText("FPS: " & $getFPS(), screenWidth - 100, 10, 20, Lime)
    
    endDrawing()
  
  closeWindow()

when isMainModule:
  main()
