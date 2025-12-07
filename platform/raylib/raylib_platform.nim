## Raylib Platform Backend Implementation
## Implements the Platform interface for raylib windowing and rendering
## Uses direct C bindings to raylib (no wrapper package needed)

import ../pixel_types
import ../platform_interface
import raylib_bindings

export pixel_types

type
  RaylibPlatform* = ref object of Platform
    running*: bool
    windowWidth: int
    windowHeight: int
    targetFps: float

# ================================================================
# PLATFORM LIFECYCLE
# ================================================================

method init*(p: RaylibPlatform, enable3D: bool = false): bool =
  ## Initialize raylib and create window
  echo "Initializing Raylib platform..."
  
  # Set configuration flags before window creation
  # SetConfigFlags(FLAG_WINDOW_RESIZABLE)
  
  # Create window
  InitWindow(1024, 768, "Storie Raylib")
  
  if not IsWindowReady():
    echo "Failed to create raylib window"
    return false
  
  # Set target FPS (native only - WASM uses browser timing)
  when not defined(emscripten):
    SetTargetFPS(60)
  
  # Get actual window size
  p.windowWidth = GetScreenWidth().int
  p.windowHeight = GetScreenHeight().int
  p.running = true
  
  echo "Raylib window created: ", p.windowWidth, "x", p.windowHeight
  return true

method shutdown*(p: RaylibPlatform) =
  ## Clean up raylib resources
  echo "Shutting down Raylib platform..."
  CloseWindow()

# ================================================================
# PLATFORM QUERY
# ================================================================

method getSize*(p: RaylibPlatform): tuple[width, height: int] =
  ## Get window size in pixels
  p.windowWidth = GetScreenWidth().int
  p.windowHeight = GetScreenHeight().int
  return (p.windowWidth, p.windowHeight)

method getCapabilities*(p: RaylibPlatform): PlatformCapabilities =
  ## Return raylib capabilities
  return PlatformCapabilities(
    maxTextureSize: 4096,
    mouseSupport: true,
    resizeEvents: true,
    hardwareAcceleration: true
  )

# ================================================================
# INPUT HANDLING
# ================================================================

method pollEvents*(p: RaylibPlatform): seq[InputEvent] =
  ## Poll raylib events and convert to InputEvents
  var events: seq[InputEvent] = @[]
  
  # Check if window should close
  if WindowShouldClose():
    p.running = false
  
  # Check for window resize - verify dimensions actually changed
  # (workaround for GLFW bug where resize callback triggers on window move)
  if IsWindowResized():
    let newWidth = GetScreenWidth().int
    let newHeight = GetScreenHeight().int
    
    # Only emit resize event if dimensions actually changed
    if newWidth != p.windowWidth or newHeight != p.windowHeight:
      p.windowWidth = newWidth
      p.windowHeight = newHeight
      events.add(InputEvent(
        kind: ResizeEvent,
        newWidth: p.windowWidth,
        newHeight: p.windowHeight
      ))
  
  # Poll all keyboard keys for press/release
  # Common keys that users might want to check
  const keysToCheck = [
    KEY_SPACE, KEY_ENTER, KEY_ESCAPE, KEY_BACKSPACE, KEY_TAB,
    KEY_RIGHT, KEY_LEFT, KEY_UP, KEY_DOWN,
    KEY_A, KEY_B, KEY_C, KEY_D, KEY_E, KEY_F, KEY_G, KEY_H,
    KEY_I, KEY_J, KEY_K, KEY_L, KEY_M, KEY_N, KEY_O, KEY_P,
    KEY_Q, KEY_R, KEY_S, KEY_T, KEY_U, KEY_V, KEY_W, KEY_X,
    KEY_Y, KEY_Z,
    KEY_ZERO, KEY_ONE, KEY_TWO, KEY_THREE, KEY_FOUR,
    KEY_FIVE, KEY_SIX, KEY_SEVEN, KEY_EIGHT, KEY_NINE,
    KEY_LEFT_SHIFT, KEY_LEFT_CONTROL, KEY_LEFT_ALT
  ]
  
  for key in keysToCheck:
    if IsKeyPressed(key.cint):
      events.add(InputEvent(
        kind: KeyEvent,
        keyCode: key,
        keyAction: Press
      ))
    if IsKeyReleased(key.cint):
      events.add(InputEvent(
        kind: KeyEvent,
        keyCode: key,
        keyAction: Release
      ))
  
  # Check for character input (for text input)
  let ch = GetCharPressed()
  if ch > 0:
    # Store character as a special key event that can be queried
    # We'll handle this separately in storie.nim
    discard
  
  # Mouse buttons
  if IsMouseButtonPressed(MOUSE_BUTTON_LEFT.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Left,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Press
    ))
  if IsMouseButtonReleased(MOUSE_BUTTON_LEFT.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Left,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Release
    ))
  
  if IsMouseButtonPressed(MOUSE_BUTTON_RIGHT.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Right,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Press
    ))
  if IsMouseButtonReleased(MOUSE_BUTTON_RIGHT.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Right,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Release
    ))
  
  if IsMouseButtonPressed(MOUSE_BUTTON_MIDDLE.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Middle,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Press
    ))
  if IsMouseButtonReleased(MOUSE_BUTTON_MIDDLE.cint):
    events.add(InputEvent(
      kind: MouseEvent,
      button: Middle,
      mouseX: GetMouseX().int,
      mouseY: GetMouseY().int,
      action: Release
    ))
  
  # Mouse position (always track)
  let mousePos = GetMousePosition()
  events.add(InputEvent(
    kind: MouseMoveEvent,
    moveX: mousePos.x.int,
    moveY: mousePos.y.int
  ))
  
  # Mouse wheel
  let wheel = GetMouseWheelMove()
  if wheel != 0.0:
    events.add(InputEvent(
      kind: MouseScrollEvent,
      scrollX: 0.0,
      scrollY: wheel
    ))
  
  return events

# ================================================================
# RENDERING
# ================================================================

method display*(p: RaylibPlatform, renderBuffer: RenderBuffer) =
  ## Execute draw commands from RenderBuffer using raylib
  BeginDrawing()
  
  # Clear with background color
  let bg = renderBuffer.backgroundColor
  ClearBackground(raylib_bindings.Color(r: bg.r, g: bg.g, b: bg.b, a: bg.a))
  
  # Execute all draw commands
  for cmd in renderBuffer.commands:
    case cmd.kind
    of ClearScreen:
      let c = cmd.clearColor
      ClearBackground(raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a))
    
    of FillRect:
      let c = cmd.rectColor
      DrawRectangle(
        cmd.rectX.cint, cmd.rectY.cint,
        cmd.rectW.cint, cmd.rectH.cint,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of DrawRect:
      let c = cmd.rectColor
      DrawRectangleLinesEx(
        Rectangle(
          x: cmd.rectX.float32,
          y: cmd.rectY.float32,
          width: cmd.rectW.float32,
          height: cmd.rectH.float32
        ),
        cmd.rectLineWidth.float32,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of FillCircle:
      let c = cmd.circleColor
      DrawCircle(
        cmd.circleX.cint, cmd.circleY.cint,
        cmd.circleRadius.float32,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of DrawCircle:
      let c = cmd.circleColor
      DrawCircleLines(
        cmd.circleX.cint, cmd.circleY.cint,
        cmd.circleRadius.float32,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of DrawLine:
      let c = cmd.lineColor
      DrawLineEx(
        Vector2(x: cmd.lineX1.float32, y: cmd.lineY1.float32),
        Vector2(x: cmd.lineX2.float32, y: cmd.lineY2.float32),
        cmd.lineWidth.float32,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of DrawText:
      let c = cmd.textColor
      DrawText(
        cmd.textContent.cstring,
        cmd.textX.cint, cmd.textY.cint,
        cmd.textSize.cint,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
    
    of DrawPixel:
      let c = cmd.pixelColor
      DrawPixel(
        cmd.pixelX.cint, cmd.pixelY.cint,
        raylib_bindings.Color(r: c.r, g: c.g, b: c.b, a: c.a)
      )
  
  EndDrawing()

# ================================================================
# TIMING
# ================================================================

method setTargetFps*(p: RaylibPlatform, fps: float) =
  ## Set target frame rate for raylib
  p.targetFps = fps
  # Only set FPS for native builds - WASM uses browser's requestAnimationFrame
  when not defined(emscripten):
    SetTargetFPS(fps.cint)

method sleepFrame*(p: RaylibPlatform, deltaTime: float) =
  ## Raylib handles timing automatically with SetTargetFPS
  # No manual sleep needed - raylib's EndDrawing() handles frame timing
  discard

method swapBuffers*(p: RaylibPlatform) =
  ## Swap buffers (for 3D rendering)
  # Raylib handles this in EndDrawing()
  discard

# ================================================================
# FACTORY
# ================================================================

proc createRaylibPlatform*(): Platform =
  ## Factory function to create Raylib platform instance
  result = RaylibPlatform()
