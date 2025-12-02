## SDL3 Platform Backend Implementation
## Implements the Platform interface for SDL3 windowing and rendering

import ../pixel_types
import ../platform_interface
import sdl3_bindings
import std/tables
import std/math

export pixel_types

type
  GlyphCacheEntry = object
    texture: ptr SDL_Texture
    width: int
    height: int
  
  SdlPlatform* = ref object of Platform
    window: ptr SDL_Window
    renderer: ptr SDL_Renderer
    targetFps: float
    font*: ptr TTF_Font
    running*: bool
    glyphCache: Table[string, GlyphCacheEntry]  # Cache for rendered text
    windowWidth: int    # Window width in pixels
    windowHeight: int   # Window height in pixels

const
  DEFAULT_WINDOW_WIDTH = 1024
  DEFAULT_WINDOW_HEIGHT = 768
  DEFAULT_FONT_SIZE = 16

# ================================================================
# PLATFORM LIFECYCLE
# ================================================================

proc init*(p: SdlPlatform): bool =
  ## Initialize SDL3 and create window/renderer
  
  if SDL_Init(SDL_INIT_VIDEO or SDL_INIT_EVENTS) < 0:
    echo "SDL_Init failed: ", SDL_GetError()
    return false
  
  # Create window
  when defined(emscripten):
    # For Emscripten, get the canvas size first, then create window to match
    var canvasW, canvasH: cint
    let result = emscripten_get_canvas_element_size("#canvas", addr canvasW, addr canvasH)
    echo "Canvas size from Emscripten: ", canvasW, "x", canvasH, " (result=", result, ")"
    
    # Create window with canvas dimensions
    p.window = SDL_CreateWindow(
      "Storie SDL3",
      canvasW,
      canvasH,
      0  # No special flags
    )
    
    # Verify and force set if needed
    if not p.window.isNil:
      var verifyW, verifyH: cint
      discard SDL_GetWindowSize(p.window, addr verifyW, addr verifyH)
      echo "SDL window created with size: ", verifyW, "x", verifyH
      
      if verifyW != canvasW or verifyH != canvasH:
        echo "Window size mismatch, forcing to ", canvasW, "x", canvasH
        discard SDL_SetWindowSize(p.window, canvasW, canvasH)
  else:
    # Native: Create window with explicit dimensions
    p.window = SDL_CreateWindow(
      "Storie SDL3",
      DEFAULT_WINDOW_WIDTH,
      DEFAULT_WINDOW_HEIGHT,
      SDL_WINDOW_RESIZABLE
    )
  
  if p.window.isNil:
    echo "SDL_CreateWindow failed: ", SDL_GetError()
    SDL_Quit()
    return false
  
  p.renderer = SDL_CreateRenderer(p.window, nil)
  
  if p.renderer.isNil:
    echo "SDL_CreateRenderer failed: ", SDL_GetError()
    SDL_DestroyWindow(p.window)
    SDL_Quit()
    return false
  
  # Initialize SDL_ttf (now available for both native and Emscripten)
  if not TTF_Init():
    echo "TTF_Init failed: ", SDL_GetError()
    SDL_DestroyRenderer(p.renderer)
    SDL_DestroyWindow(p.window)
    SDL_Quit()
    return false
  
  # Load font - try multiple paths
  const fontSize = 16.0
  var fontPaths = @[
    "docs/assets/AnomalyMono-Powerline.otf",
    "assets/AnomalyMono-Powerline.otf",
    "/assets/AnomalyMono-Powerline.otf"  # Absolute path for preloaded WASM assets
  ]
  
  p.font = nil
  for fontPath in fontPaths:
    p.font = TTF_OpenFont(fontPath.cstring, fontSize)
    if not p.font.isNil:
      echo "Font loaded successfully from ", fontPath
      break
  
  if p.font.isNil:
    echo "Failed to load font from any path: ", SDL_GetError()
    echo "Tried paths: ", fontPaths
    TTF_Quit()
    SDL_DestroyRenderer(p.renderer)
    SDL_DestroyWindow(p.window)
    SDL_Quit()
    return false
  
  p.running = true
  
  # Initialize glyph cache
  p.glyphCache = initTable[string, GlyphCacheEntry]()
  
  # Get window size in pixels
  var w, h: cint
  discard SDL_GetWindowSize(p.window, addr w, addr h)
  p.windowWidth = w.int
  p.windowHeight = h.int
  
  echo "Window dimensions: ", p.windowWidth, "x", p.windowHeight, " pixels"
  
  return true

proc shutdown*(p: SdlPlatform) =
  ## Clean up SDL3 resources
  
  # Clear glyph cache
  for entry in p.glyphCache.values:
    if not entry.texture.isNil:
      SDL_DestroyTexture(entry.texture)
  p.glyphCache.clear()
  
  if not p.font.isNil:
    TTF_CloseFont(p.font)
  TTF_Quit()
  if not p.renderer.isNil:
    SDL_DestroyRenderer(p.renderer)
  if not p.window.isNil:
    SDL_DestroyWindow(p.window)
  SDL_Quit()

proc loadFont*(p: SdlPlatform, path: string, size: float = 16.0): bool =
  ## Load a font at runtime from a file path or URL
  ## For WASM: Font must be accessible via filesystem (preloaded or fetched)
  ## Returns true if successful
  
  # Close existing font if any
  if not p.font.isNil:
    TTF_CloseFont(p.font)
    # Clear glyph cache when font changes
    for entry in p.glyphCache.values:
      if not entry.texture.isNil:
        SDL_DestroyTexture(entry.texture)
    p.glyphCache.clear()
  
  # Try to load the new font
  p.font = TTF_OpenFont(path.cstring, size)
  
  if p.font.isNil:
    echo "Failed to load font from ", path, ": ", SDL_GetError()
    return false
  
  echo "Font loaded successfully from ", path
  return true

# ================================================================
# PLATFORM QUERY
# ================================================================

proc getSize*(p: SdlPlatform): tuple[width, height: int] =
  ## Get window size in pixels
  var w, h: cint
  discard SDL_GetWindowSize(p.window, addr w, addr h)
  p.windowWidth = w.int
  p.windowHeight = h.int
  return (p.windowWidth, p.windowHeight)

proc getCapabilities*(p: SdlPlatform): PlatformCapabilities =
  ## Return SDL3 capabilities
  return PlatformCapabilities(
    maxTextureSize: 4096,  # Common max texture size
    mouseSupport: true,
    resizeEvents: true,
    hardwareAcceleration: true
  )

# ================================================================
# INPUT HANDLING
# ================================================================

proc pollEvents*(p: SdlPlatform): seq[InputEvent] =
  ## Poll SDL3 events and convert to InputEvents
  var events: seq[InputEvent] = @[]
  var sdlEvent: SDL_Event
  
  while SDL_PollEvent(addr sdlEvent):
    case sdlEvent.`type`
    of SDL_EVENT_QUIT:
      p.running = false
      # SDL quit doesn't map to our event system directly
      # The app will check p.running status
    
    of SDL_EVENT_KEY_DOWN:
      let key = sdlEvent.key
      # TODO: Map SDL keycodes to InputEvent keys properly
      events.add(InputEvent(
        kind: KeyEvent,
        keyCode: key.key.int,
        keyAction: Press
      ))
    
    of SDL_EVENT_KEY_UP:
      let key = sdlEvent.key
      events.add(InputEvent(
        kind: KeyEvent,
        keyCode: key.key.int,
        keyAction: Release
      ))
    
    of SDL_EVENT_MOUSE_BUTTON_DOWN:
      let mouse = sdlEvent.button
      let btn = case mouse.button
        of 1: Left
        of 2: Middle
        of 3: Right
        else: Unknown
      events.add(InputEvent(
        kind: MouseEvent,
        button: btn,
        mouseX: mouse.x.int,
        mouseY: mouse.y.int,
        action: Press
      ))
    
    of SDL_EVENT_MOUSE_BUTTON_UP:
      let mouse = sdlEvent.button
      let btn = case mouse.button
        of 1: Left
        of 2: Middle
        of 3: Right
        else: Unknown
      events.add(InputEvent(
        kind: MouseEvent,
        button: btn,
        mouseX: mouse.x.int,
        mouseY: mouse.y.int,
        action: Release
      ))
    
    of SDL_EVENT_MOUSE_MOTION:
      let motion = sdlEvent.motion
      events.add(InputEvent(
        kind: MouseMoveEvent,
        moveX: motion.x.int,
        moveY: motion.y.int
      ))
    
    of SDL_EVENT_WINDOW_RESIZED:
      let window = sdlEvent.window
      p.windowWidth = window.data1.int
      p.windowHeight = window.data2.int
      events.add(InputEvent(
        kind: ResizeEvent,
        newWidth: p.windowWidth,
        newHeight: p.windowHeight
      ))
    
    else:
      discard
  
  return events

# ================================================================
# RENDERING
# ================================================================

proc display*(p: SdlPlatform, renderBuffer: RenderBuffer) =
  ## Execute draw commands from RenderBuffer
  
  # Clear screen with background color
  let bg = renderBuffer.backgroundColor
  discard SDL_SetRenderDrawColor(p.renderer, bg.r, bg.g, bg.b, bg.a)
  discard SDL_RenderClear(p.renderer)
  
  # Execute all draw commands
  for cmd in renderBuffer.commands:
    case cmd.kind
    of ClearScreen:
      let c = cmd.clearColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      discard SDL_RenderClear(p.renderer)
    
    of FillRect:
      let c = cmd.rectColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      var rect = SDL_FRect(
        x: cmd.rectX.float,
        y: cmd.rectY.float,
        w: cmd.rectW.float,
        h: cmd.rectH.float
      )
      discard SDL_RenderFillRect(p.renderer, addr rect)
    
    of DrawRect:
      # Draw rectangle outline using lines
      let c = cmd.rectColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      let x = cmd.rectX.float
      let y = cmd.rectY.float
      let w = cmd.rectW.float
      let h = cmd.rectH.float
      
      # Draw the four sides of the rectangle
      for i in 0..<cmd.rectLineWidth:
        let offset = i.float
        # Top
        discard SDL_RenderLine(p.renderer, x + offset, y + offset, x + w - offset, y + offset)
        # Right
        discard SDL_RenderLine(p.renderer, x + w - offset, y + offset, x + w - offset, y + h - offset)
        # Bottom
        discard SDL_RenderLine(p.renderer, x + w - offset, y + h - offset, x + offset, y + h - offset)
        # Left
        discard SDL_RenderLine(p.renderer, x + offset, y + h - offset, x + offset, y + offset)
    
    of FillCircle:
      # Draw filled circle using midpoint circle algorithm
      let c = cmd.circleColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      let cx = cmd.circleX
      let cy = cmd.circleY
      let r = cmd.circleRadius
      
      # Simple filled circle approximation
      for y in -r..r:
        let x = int(sqrt(float(r * r - y * y)))
        for px in -x..x:
          discard SDL_RenderPoint(p.renderer, (cx + px).float, (cy + y).float)
    
    of DrawCircle:
      # Draw circle outline using midpoint circle algorithm
      let c = cmd.circleColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      let cx = cmd.circleX.float
      let cy = cmd.circleY.float
      let r = cmd.circleRadius
      
      var x = 0
      var y = r
      var d = 3 - 2 * r
      
      while y >= x:
        # Draw 8 symmetric points
        discard SDL_RenderPoint(p.renderer, cx + x.float, cy + y.float)
        discard SDL_RenderPoint(p.renderer, cx - x.float, cy + y.float)
        discard SDL_RenderPoint(p.renderer, cx + x.float, cy - y.float)
        discard SDL_RenderPoint(p.renderer, cx - x.float, cy - y.float)
        discard SDL_RenderPoint(p.renderer, cx + y.float, cy + x.float)
        discard SDL_RenderPoint(p.renderer, cx - y.float, cy + x.float)
        discard SDL_RenderPoint(p.renderer, cx + y.float, cy - x.float)
        discard SDL_RenderPoint(p.renderer, cx - y.float, cy - x.float)
        
        inc x
        if d > 0:
          dec y
          d = d + 4 * (x - y) + 10
        else:
          d = d + 4 * x + 6
    
    of DrawLine:
      let c = cmd.lineColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      discard SDL_RenderLine(p.renderer, 
        cmd.lineX1.float, cmd.lineY1.float,
        cmd.lineX2.float, cmd.lineY2.float)
    
    of DrawText:
      # Render text using TTF if font is available
      if not p.font.isNil:
        let c = cmd.textColor
        let cacheKey = cmd.textContent & "_" & $c.r & "_" & $c.g & "_" & $c.b & "_" & $cmd.textSize
        
        var texture: ptr SDL_Texture
        var textW, textH: int
        
        if p.glyphCache.hasKey(cacheKey):
          let entry = p.glyphCache[cacheKey]
          texture = entry.texture
          textW = entry.width
          textH = entry.height
        else:
          # Render text to texture with blended (antialiased) rendering for better quality
          let sdlColor = SDL_Color(r: c.r, g: c.g, b: c.b, a: c.a)
          let surface = TTF_RenderText_Blended(p.font, cmd.textContent.cstring, 
                                               cmd.textContent.len.csize_t, sdlColor)
          
          if not surface.isNil:
            textW = surface.w
            textH = surface.h
            texture = SDL_CreateTextureFromSurface(p.renderer, surface)
            SDL_DestroySurface(surface)
            
            if not texture.isNil:
              p.glyphCache[cacheKey] = GlyphCacheEntry(
                texture: texture,
                width: textW,
                height: textH
              )
        
        if not texture.isNil:
          var dstRect = SDL_FRect(
            x: cmd.textX.float,
            y: cmd.textY.float,
            w: textW.float,
            h: textH.float
          )
          discard SDL_RenderTexture(p.renderer, texture, nil, addr dstRect)
    
    of DrawPixel:
      let c = cmd.pixelColor
      discard SDL_SetRenderDrawColor(p.renderer, c.r, c.g, c.b, c.a)
      discard SDL_RenderPoint(p.renderer, cmd.pixelX.float, cmd.pixelY.float)
  
  discard SDL_RenderPresent(p.renderer)

# ================================================================
# TIMING
# ================================================================

proc setTargetFps*(p: SdlPlatform, fps: float) =
  ## Set target frame rate
  p.targetFps = fps

proc sleepFrame*(p: SdlPlatform, deltaTime: float) =
  ## Sleep to maintain target FPS
  if p.targetFps > 0:
    let targetFrameTime = 1.0 / p.targetFps
    let sleepTime = targetFrameTime - deltaTime
    if sleepTime > 0:
      SDL_Delay((sleepTime * 1000.0).uint32)

# ================================================================
# FACTORY
# ================================================================

proc createSdlPlatform*(): Platform =
  ## Factory function to create SDL platform instance
  result = SdlPlatform()
