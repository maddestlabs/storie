## Storie - Creative coding engine library
## Default backend: Raylib (use -d:sdl3 for SDL3 backend)
##
## This is the core engine library. Import this to build custom applications.
## For the default markdown-based experience, see index.nim

import strutils, math, times
import platform/platform_interface
import platform/pixel_types
import platform/render3d_interface
import storie_core
import src/nimini
export platform_interface, pixel_types, render3d_interface, storie_core, nimini

# Backend selection: raylib by default, SDL3 with -d:sdl3
when defined(sdl3):
  import platform/sdl/sdl_platform
  import platform/sdl/sdl_render3d
  export sdl_platform, sdl_render3d
else:
  import platform/raylib/raylib_platform
  import platform/raylib/raylib_render3d
  # Import WindowShouldClose from raylib but exclude Color to avoid conflict
  from platform/raylib/raylib_bindings/core import WindowShouldClose
  export raylib_platform, raylib_render3d, WindowShouldClose

# Emscripten support
when defined(emscripten):
  {.emit: """
  #include <emscripten.h>
  """.}

# ================================================================
# NIMINI CONTEXT
# ================================================================

type
  NiminiContext = ref object
    env: ref Env

# Helper to convert Value to int (handles both int and float values)
proc valueToInt(v: Value): int =
  case v.kind
  of vkInt: return v.i
  of vkFloat: return int(v.f)
  else: return 0

# ================================================================
# GLOBAL STATE
# ================================================================

type
  AppState = ref object
    platform: Platform
    width, height: int
    bgLayer: Layer
    fgLayer: Layer
    running: bool
    
    # Timing
    targetFps: float
    totalTime: float
    frameCount: int
    fps: float
    lastFpsUpdate: float

var appState: AppState
var niminiCtx: NiminiContext

# Global layer references for nimini bindings
var gBgLayer: Layer
var gFgLayer: Layer
var gCurrentColor: Color = Color(r: 255, g: 255, b: 255, a: 255)

# 3D rendering globals
var g3DEnabled: bool = false
when defined(sdl3):
  var gRenderer3D: SdlRenderer3D
else:
  var gRenderer3D: RaylibRenderer3D
var gCamera: Camera3D
var gModelMatrix: Mat4 = identity()

# ================================================================
# NIMINI WRAPPERS - Bridge storie functions to Nimini
# ================================================================

# Type conversion functions
proc nimini_int(env: ref Env; args: seq[Value]): Value =
  if args.len > 0:
    case args[0].kind
    of vkInt: return args[0]
    of vkFloat: return valInt(args[0].f.int)
    of vkString: 
      try: return valInt(parseInt(args[0].s))
      except: return valInt(0)
    of vkBool: return valInt(if args[0].b: 1 else: 0)
    else: return valInt(0)
  return valInt(0)

proc nimini_float(env: ref Env; args: seq[Value]): Value =
  if args.len > 0:
    case args[0].kind
    of vkFloat: return args[0]
    of vkInt: return valFloat(args[0].i.float)
    of vkString: 
      try: return valFloat(parseFloat(args[0].s))
      except: return valFloat(0.0)
    of vkBool: return valFloat(if args[0].b: 1.0 else: 0.0)
    else: return valFloat(0.0)
  return valFloat(0.0)

proc nimini_str(env: ref Env; args: seq[Value]): Value =
  if args.len > 0:
    return valString($args[0])
  return valString("")

# Print function
proc print(env: ref Env; args: seq[Value]): Value {.nimini.} =
  var output = ""
  for i, arg in args:
    if i > 0: output.add(" ")
    case arg.kind
    of vkInt: output.add($arg.i)
    of vkFloat: output.add($arg.f)
    of vkString: output.add(arg.s)
    of vkBool: output.add($arg.b)
    of vkNil: output.add("nil")
    else: output.add("<value>")
  echo output
  return valNil()

# Drawing functions - Pixel-based API
proc clear(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Clear background layer
  gBgLayer.renderBuffer.clearCommands()
  return valNil()

proc clearFg(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Clear foreground layer
  gFgLayer.renderBuffer.clearCommands()
  return valNil()

proc setColor(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Set current drawing color (r, g, b, [a])
  if args.len >= 3:
    let a = if args.len >= 4: valueToInt(args[3]).uint8 else: 255'u8
    gCurrentColor = Color(
      r: valueToInt(args[0]).uint8,
      g: valueToInt(args[1]).uint8,
      b: valueToInt(args[2]).uint8,
      a: a
    )
  return valNil()

proc fillRect(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw filled rectangle on background layer
  if args.len >= 4:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    let w = valueToInt(args[2])
    let h = valueToInt(args[3])
    gBgLayer.renderBuffer.fillRect(x, y, w, h, gCurrentColor)
  return valNil()

proc drawRect(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw rectangle outline on foreground layer
  if args.len >= 4:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    let w = valueToInt(args[2])
    let h = valueToInt(args[3])
    let lineWidth = if args.len >= 5: valueToInt(args[4]) else: 1
    gFgLayer.renderBuffer.drawRect(x, y, w, h, gCurrentColor, lineWidth)
  return valNil()

proc fillCircle(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw filled circle
  if args.len >= 3:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    let radius = valueToInt(args[2])
    gFgLayer.renderBuffer.fillCircle(x, y, radius, gCurrentColor)
  return valNil()

proc drawCircle(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw circle outline
  if args.len >= 3:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    let radius = valueToInt(args[2])
    let lineWidth = if args.len >= 4: valueToInt(args[3]) else: 1
    gFgLayer.renderBuffer.drawCircle(x, y, radius, gCurrentColor, lineWidth)
  return valNil()

proc drawLine(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw line from (x1, y1) to (x2, y2)
  if args.len >= 4:
    let x1 = valueToInt(args[0])
    let y1 = valueToInt(args[1])
    let x2 = valueToInt(args[2])
    let y2 = valueToInt(args[3])
    let lineWidth = if args.len >= 5: valueToInt(args[4]) else: 1
    gFgLayer.renderBuffer.drawLine(x1, y1, x2, y2, gCurrentColor, lineWidth)
  return valNil()

proc drawText(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw text at pixel coordinates
  if args.len >= 3:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    let text = args[2].s
    let size = if args.len >= 4: valueToInt(args[3]) else: 16
    gFgLayer.renderBuffer.drawText(x, y, text, gCurrentColor, size)
  return valNil()

proc drawPixel(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw a single pixel
  if args.len >= 2:
    let x = valueToInt(args[0])
    let y = valueToInt(args[1])
    gFgLayer.renderBuffer.drawPixel(x, y, gCurrentColor)
  return valNil()

# Math functions
proc mathSin(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len > 0:
    let val = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 0.0
    return valFloat(sin(val))
  return valFloat(0.0)

proc mathCos(env: ref Env; args: seq[Value]): Value {.nimini.} =
  if args.len > 0:
    let val = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 0.0
    return valFloat(cos(val))
  return valFloat(0.0)

# 3D functions
proc enable3D(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Enable 3D rendering mode
  if not g3DEnabled:
    echo "3D mode must be enabled at startup with --3d flag"
  return valNil()

proc setCamera(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Set camera position and target: setCamera(posX, posY, posZ, targetX, targetY, targetZ)
  if not g3DEnabled:
    return valNil()
  
  if args.len >= 6:
    let posX = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 0.0
    let posY = case args[1].kind
      of vkFloat: args[1].f
      of vkInt: args[1].i.float
      else: 0.0
    let posZ = case args[2].kind
      of vkFloat: args[2].f
      of vkInt: args[2].i.float
      else: 0.0
    let tarX = case args[3].kind
      of vkFloat: args[3].f
      of vkInt: args[3].i.float
      else: 0.0
    let tarY = case args[4].kind
      of vkFloat: args[4].f
      of vkInt: args[4].i.float
      else: 0.0
    let tarZ = case args[5].kind
      of vkFloat: args[5].f
      of vkInt: args[5].i.float
      else: 0.0
    
    gCamera.position = vec3(posX, posY, posZ)
    gCamera.target = vec3(tarX, tarY, tarZ)
    
    # Update renderer camera
    let aspect = appState.width.float / appState.height.float
    gRenderer3D.setCamera(gCamera, aspect)
  return valNil()

proc setCameraFov(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Set camera field of view in degrees
  if not g3DEnabled:
    return valNil()
  
  if args.len > 0:
    let fov = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 60.0
    gCamera.fov = fov
  return valNil()

proc resetTransform(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Reset model transformation matrix to identity
  if not g3DEnabled:
    return valNil()
  gModelMatrix = identity()
  return valNil()

proc translate3D(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Translate: translate3D(x, y, z)
  if not g3DEnabled:
    return valNil()
  
  if args.len >= 3:
    let x = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 0.0
    let y = case args[1].kind
      of vkFloat: args[1].f
      of vkInt: args[1].i.float
      else: 0.0
    let z = case args[2].kind
      of vkFloat: args[2].f
      of vkInt: args[2].i.float
      else: 0.0
    gModelMatrix = gModelMatrix * translate(x, y, z)
  return valNil()

proc rotate3D(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Rotate: rotate3D(angleX, angleY, angleZ) - angles in radians
  if not g3DEnabled:
    return valNil()
  
  if args.len >= 3:
    let ax = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 0.0
    let ay = case args[1].kind
      of vkFloat: args[1].f
      of vkInt: args[1].i.float
      else: 0.0
    let az = case args[2].kind
      of vkFloat: args[2].f
      of vkInt: args[2].i.float
      else: 0.0
    if ax != 0: gModelMatrix = gModelMatrix * rotateX(ax)
    if ay != 0: gModelMatrix = gModelMatrix * rotateY(ay)
    if az != 0: gModelMatrix = gModelMatrix * rotateZ(az)
  return valNil()

proc scale3D(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Scale: scale3D(x, y, z)
  if not g3DEnabled:
    return valNil()
  
  if args.len >= 3:
    let x = case args[0].kind
      of vkFloat: args[0].f
      of vkInt: args[0].i.float
      else: 1.0
    let y = case args[1].kind
      of vkFloat: args[1].f
      of vkInt: args[1].i.float
      else: 1.0
    let z = case args[2].kind
      of vkFloat: args[2].f
      of vkInt: args[2].i.float
      else: 1.0
    gModelMatrix = gModelMatrix * scale(x, y, z)
  return valNil()

proc drawCube(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw a cube: drawCube([size])
  if not g3DEnabled:
    return valNil()
  
  let size = if args.len > 0:
    case args[0].kind
    of vkFloat: args[0].f
    of vkInt: args[0].i.float
    else: 1.0
  else:
    1.0
  
  # Create color from current color
  let color = vec3(gCurrentColor.r.float / 255.0, gCurrentColor.g.float / 255.0, gCurrentColor.b.float / 255.0)
  let meshData = createCubeMeshData(size, color)
  
  # Update renderer and draw
  gRenderer3D.setModelTransform(gModelMatrix)
  gRenderer3D.drawMesh(meshData)
  
  return valNil()

proc drawSphere(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Draw a sphere: drawSphere([radius], [segments])
  if not g3DEnabled:
    return valNil()
  
  let radius = if args.len > 0:
    case args[0].kind
    of vkFloat: args[0].f
    of vkInt: args[0].i.float
    else: 1.0
  else:
    1.0
  
  let segments = if args.len > 1:
    case args[1].kind
    of vkInt: args[1].i
    of vkFloat: args[1].f.int
    else: 16
  else:
    16
  
  # Create color from current color
  let color = vec3(gCurrentColor.r.float / 255.0, gCurrentColor.g.float / 255.0, gCurrentColor.b.float / 255.0)
  let meshData = createSphereMeshData(radius, segments, color)
  
  # Update renderer and draw
  gRenderer3D.setModelTransform(gModelMatrix)
  gRenderer3D.drawMesh(meshData)
  
  return valNil()

proc clear3D(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Clear 3D scene with background color
  if not g3DEnabled:
    return valNil()
  
  let r = if args.len > 0: valueToInt(args[0]).float / 255.0 else: 0.0
  let g = if args.len > 1: valueToInt(args[1]).float / 255.0 else: 0.0
  let b = if args.len > 2: valueToInt(args[2]).float / 255.0 else: 0.0
  
  gRenderer3D.beginFrame3D(r, g, b)
  return valNil()

proc createNiminiContext(): NiminiContext =
  ## Create a Nimini interpreter context with exposed APIs
  initRuntime()
  
  # Register type conversion functions
  registerNative("int", nimini_int)
  registerNative("float", nimini_float)
  registerNative("str", nimini_str)
  
  # Auto-register all {.nimini.} pragma functions
  exportNiminiProcs(
    print,
    clear, clearFg, setColor,
    fillRect, drawRect, fillCircle, drawCircle, drawLine, drawText, drawPixel,
    mathSin, mathCos,
    enable3D, setCamera, setCameraFov,
    resetTransform, translate3D, rotate3D, scale3D,
    drawCube, drawSphere, clear3D
  )
  
  # Register math aliases
  registerNative("sin", mathSin)
  registerNative("cos", mathCos)
  
  return NiminiContext(env: runtimeEnv)

# ================================================================
# PUBLIC API - Execute Nimini Code
# ================================================================

proc executeNiminiCode*(code: string): bool =
  ## Execute Nimini code in the global context
  ## Returns true on success, false on error
  if niminiCtx.isNil:
    echo "Error: Nimini context not initialized"
    return false
    
  if appState.isNil:
    echo "Error: App state not initialized"
    return false
  
  if code.strip().len == 0:
    return true
  
  try:
    # Build a wrapper that includes state access
    var scriptCode = ""
    
    # Add state field accessors as local variables
    scriptCode.add("var width = " & $appState.width & "\n")
    scriptCode.add("var height = " & $appState.height & "\n")
    scriptCode.add("var fps = " & formatFloat(appState.fps, ffDecimal, 2) & "\n")
    scriptCode.add("var frameCount = " & $appState.frameCount & "\n")
    scriptCode.add("\n")
    
    # Add user code
    scriptCode.add(code)
    
    let tokens = tokenizeDsl(scriptCode)
    let program = parseDsl(tokens)
    execProgram(program, niminiCtx.env)
    
    return true
  except Exception as e:
    echo "Error executing Nimini code: ", e.msg
    return false

# ================================================================
# PUBLIC API - Query Engine State
# ================================================================

proc getFrameCount*(): int =
  ## Get current frame count
  if appState.isNil: return 0
  return appState.frameCount

proc getFps*(): float =
  ## Get current FPS
  if appState.isNil: return 0.0
  return appState.fps

proc getWidth*(): int =
  ## Get window width
  if appState.isNil: return 0
  return appState.width

proc getHeight*(): int =
  ## Get window height
  if appState.isNil: return 0
  return appState.height

proc isRunning*(): bool =
  ## Check if engine is running
  if appState.isNil: return false
  return appState.running

proc stopEngine*() =
  ## Stop the engine
  if not appState.isNil:
    appState.running = false

# ================================================================
# CALLBACK TYPES
# ================================================================

type
  UpdateCallback* = proc() {.closure.}
  RenderCallback* = proc() {.closure.}
  InputCallback* = proc() {.closure.}
  ShutdownCallback* = proc() {.closure.}

var updateCallback: UpdateCallback = nil
var renderCallback: RenderCallback = nil
var inputCallback: InputCallback = nil
var shutdownCallback: ShutdownCallback = nil

# ================================================================
# MAIN LOOP
# ================================================================

# Global timing state for main loop
var lastTime: float = 0.0
var accumulator: float = 0.0

proc mainLoopIteration() =
  ## Single iteration of the main loop (called by Emscripten or native loop)
  let currentTime = cpuTime()
  let deltaTime = if lastTime == 0.0: 0.0 else: currentTime - lastTime
  lastTime = currentTime
  
  if not appState.running:
    when defined(emscripten):
      # In Emscripten, we can't just quit - the loop will keep running
      # User needs to close the browser tab
      discard
    return
  
  let fixedDt = 1.0 / appState.targetFps
  
  # Handle events
  let events = appState.platform.pollEvents()
  for event in events:
    case event.kind
    of KeyEvent:
      if event.keyAction == Press:
        # ESC key is code 27
        if event.keyCode == 27:
          appState.running = false
        # Call input callback
        if not inputCallback.isNil:
          inputCallback()
    of ResizeEvent:
      # Update dimensions on window resize
      appState.width = event.newWidth
      appState.height = event.newHeight
      echo "Window resized to ", appState.width, "x", appState.height, " pixels"
    else:
      discard
  
  # Fixed timestep update
  accumulator += deltaTime
  while accumulator >= fixedDt:
    # Update timing info
    appState.totalTime += fixedDt
    appState.frameCount += 1
    
    if appState.totalTime - appState.lastFpsUpdate >= 0.5:
      appState.fps = if deltaTime > 0.0: 1.0 / deltaTime else: 0.0
      appState.lastFpsUpdate = appState.totalTime
    
    # Call update callback
    if not updateCallback.isNil:
      updateCallback()
    
    accumulator -= fixedDt
  
  # Rendering based on mode
  if g3DEnabled:
    # 3D rendering through abstracted renderer
    gRenderer3D.setViewport(0, 0, appState.width, appState.height)
    gRenderer3D.beginFrame3D(0.1, 0.1, 0.15)
    
    # Update camera in renderer
    let aspect = appState.width.float / appState.height.float
    gRenderer3D.setCamera(gCamera, aspect)
    
    # Call render callback (user will call 3D drawing functions)
    if not renderCallback.isNil:
      renderCallback()
    
    # End frame and swap buffers
    gRenderer3D.endFrame3D()
    appState.platform.swapBuffers()
  else:
    # 2D rendering
    # Clear layer commands
    appState.bgLayer.renderBuffer.clearCommands()
    appState.fgLayer.renderBuffer.clearCommands()
    
    # Call render callback
    if not renderCallback.isNil:
      renderCallback()
    
    # Composite layers and display
    let compositeBuffer = newRenderBuffer(appState.width, appState.height)
    compositeBuffer.clear(black())
    
    # Merge all layer commands in z-order
    for cmd in appState.bgLayer.renderBuffer.commands:
      compositeBuffer.commands.add(cmd)
    for cmd in appState.fgLayer.renderBuffer.commands:
      compositeBuffer.commands.add(cmd)
    
    appState.platform.display(compositeBuffer)
  
  # Frame rate limiting (native only)
  when not defined(emscripten):
    appState.platform.sleepFrame(deltaTime)

when defined(emscripten):
  # Emscripten callback wrapper
  proc emMainLoop() {.cdecl, exportc.} =
    mainLoopIteration()

proc mainLoop() =
  ## Main loop - different implementation for backends
  when defined(sdl3):
    # SDL3: use emscripten_set_main_loop for WASM, traditional loop for native
    when defined(emscripten):
      # Emscripten: 0 fps = use requestAnimationFrame (browser controls timing)
      {.emit: """
      emscripten_set_main_loop(emMainLoop, 0, 1);
      """.}
    else:
      # Native: traditional while loop
      while appState.running:
        mainLoopIteration()
  else:
    # Raylib: use raylib's native WindowShouldClose loop
    # This works for both native and WASM without ASYNCIFY issues
    while not WindowShouldClose() and appState.running:
      mainLoopIteration()

proc initStorie*(
  width: int = 800,
  height: int = 600,
  title: string = "Storie",
  enable3D: bool = false,
  targetFps: float = 60.0,
  updateCallback: UpdateCallback = nil,
  renderCallback: RenderCallback = nil,
  inputCallback: InputCallback = nil,
  shutdownCallback: ShutdownCallback = nil
) =
  ## Initialize the Storie engine with custom callbacks
  ## This is the main API for library usage
  
  when defined(sdl3):
    echo "Initializing Storie with SDL3 backend..."
  else:
    echo "Initializing Storie with Raylib backend..."
  
  # Store callbacks
  storie.updateCallback = updateCallback
  storie.renderCallback = renderCallback
  storie.inputCallback = inputCallback
  storie.shutdownCallback = shutdownCallback
  
  # 3D mode is optional for all platforms
  let use3D = enable3D
  when defined(emscripten):
    if use3D:
      echo "3D mode enabled (WASM)"
    else:
      echo "2D mode (WASM default)"
  else:
    if enable3D:
      echo "3D mode enabled"
  
  # Create platform backend
  appState = AppState()
  when defined(sdl3):
    appState.platform = SdlPlatform()
  else:
    appState.platform = RaylibPlatform()
  appState.running = true
  appState.targetFps = targetFps
  appState.totalTime = 0.0
  appState.frameCount = 0
  appState.fps = targetFps
  appState.lastFpsUpdate = 0.0
  
  # Initialize platform
  if not appState.platform.init(use3D):
    echo "Failed to initialize platform"
    quit(1)
  appState.platform.setTargetFps(appState.targetFps)
  
  # Initialize 3D if enabled
  if use3D:
    g3DEnabled = true
    gCamera = newCamera3D(vec3(0, 0, 5), vec3(0, 0, 0), 60.0)
    when defined(sdl3):
      gRenderer3D = newSdlRenderer3D()
    else:
      gRenderer3D = newRaylibRenderer3D()
    if not gRenderer3D.init3D():
      echo "Failed to initialize 3D renderer"
      g3DEnabled = false
    else:
      gModelMatrix = identity()
      echo "3D rendering initialized"
  
  let (w, h) = appState.platform.getSize()
  appState.width = w
  appState.height = h
  
  echo "Window size: ", w, "x", h, " pixels"
  
  # Create layers with pixel-based render buffers
  appState.bgLayer = Layer(id: "bg", z: 0, visible: true, renderBuffer: newRenderBuffer(appState.width, appState.height))
  appState.fgLayer = Layer(id: "fg", z: 1, visible: true, renderBuffer: newRenderBuffer(appState.width, appState.height))
  
  # Set global references for nimini bindings
  gBgLayer = appState.bgLayer
  gFgLayer = appState.fgLayer
  gCurrentColor = Color(r: 255, g: 255, b: 255, a: 255)
  
  # Create nimini context
  niminiCtx = createNiminiContext()
  
  echo "Storie initialized successfully!"
  echo "Press ESC to quit"

proc shutdownStorie*() =
  ## Shutdown the Storie engine
  echo "Shutting down Storie..."
  
  # Call shutdown callback
  if not shutdownCallback.isNil:
    shutdownCallback()
  
  # Shutdown platform
  if not appState.platform.isNil:
    appState.platform.shutdown()
  
  echo "Goodbye!"

proc runStorie*() =
  ## Run the main loop (blocking call)
  ## Call this after initStorie()
  try:
    mainLoop()
  finally:
    shutdownStorie()
