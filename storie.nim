## Storie - Creative coding engine library
## Default backend: Raylib (use -d:sdl3 for SDL3 backend)
## SDL3 can use OpenGL (default) or SDL_GPU with -d:sdlgpu
##
## This is the core engine library. Import this to build custom applications.
## For the default markdown-based experience, see index.nim

import strutils, math, times
import platform/platform_interface
import platform/pixel_types
import platform/render3d_interface
import platform/audio
import storie_core
import nimini
export platform_interface, pixel_types, render3d_interface, audio, storie_core, nimini

# Backend selection: raylib by default, SDL3 with -d:sdl3
when defined(sdl3):
  import platform/sdl/sdl_platform
  when defined(sdlgpu):
    # Use SDL_GPU for modern graphics (Vulkan/D3D12/Metal)
    import platform/sdl/sdl_gpu_render3d
    export sdl_platform, sdl_gpu_render3d
    static: echo "[Build] Using SDL3 + SDL_GPU backend (Vulkan/D3D12/Metal)"
  else:
    # Use OpenGL for 3D rendering (default)
    import platform/sdl/sdl_render3d
    export sdl_platform, sdl_render3d
    static: echo "[Build] Using SDL3 + OpenGL backend"
else:
  import platform/raylib/raylib_platform
  import platform/raylib/raylib_render3d
  # Import WindowShouldClose from raylib but exclude Color to avoid conflict
  from platform/raylib/raylib_bindings/core import WindowShouldClose
  from platform/raylib/raylib_bindings/input import 
    GetCharPressed,
    KEY_SPACE, KEY_ENTER, KEY_ESCAPE, KEY_BACKSPACE, KEY_TAB,
    KEY_RIGHT, KEY_LEFT, KEY_UP, KEY_DOWN,
    KEY_A, KEY_B, KEY_C, KEY_D, KEY_E, KEY_F, KEY_G, KEY_H,
    KEY_I, KEY_J, KEY_K, KEY_L, KEY_M, KEY_N, KEY_O, KEY_P,
    KEY_Q, KEY_R, KEY_S, KEY_T, KEY_U, KEY_V, KEY_W, KEY_X,
    KEY_Y, KEY_Z,
    KEY_ZERO, KEY_ONE, KEY_TWO, KEY_THREE, KEY_FOUR,
    KEY_FIVE, KEY_SIX, KEY_SEVEN, KEY_EIGHT, KEY_NINE
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

# Event handling globals
type
  InputState = object
    # Keyboard state
    keysPressed: array[512, bool]      # Keys pressed this frame
    keysDown: array[512, bool]         # Keys currently held down
    keysReleased: array[512, bool]     # Keys released this frame
    charPressed: int                   # Last character pressed (for text input)
    
    # Mouse state
    mouseX, mouseY: int                # Current mouse position
    mouseDeltaX, mouseDeltaY: int      # Mouse movement since last frame
    mouseButtons: array[5, bool]       # Mouse buttons currently down
    mousePressed: array[5, bool]       # Mouse buttons pressed this frame
    mouseReleased: array[5, bool]      # Mouse buttons released this frame
    mouseWheelX, mouseWheelY: float    # Mouse wheel scroll
    
    # Touch state (for mobile/web)
    touchX, touchY: int                # Primary touch position
    touchActive: bool                  # Is touch currently active

var gInputState: InputState

# 3D rendering globals
var g3DEnabled: bool = false
when defined(sdl3):
  when defined(sdlgpu):
    var gRenderer3D: SdlGpuRenderer3D
  else:
    var gRenderer3D: SdlRenderer3D
else:
  var gRenderer3D: RaylibRenderer3D
var gCamera: Camera3D
var gModelMatrix: Mat4 = identity()

# Audio system globals
var gAudioSystem: AudioSystem = nil
var gAudioDevice: AudioDevice = nil
var gAudioStream: AudioStream = nil
var gAudioInitialized: bool = false
var gAudioPlaying: bool = false
var gAudioPendingInit: bool = false  # Track if init was attempted but needs retry

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

# ================================================================
# EVENT HANDLING FUNCTIONS
# ================================================================

# Keyboard functions
proc isKeyPressed(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if a key was pressed this frame (keyCode)
  if args.len > 0:
    let key = valueToInt(args[0])
    if key >= 0 and key < 512:
      return valBool(gInputState.keysPressed[key])
  return valBool(false)

proc isKeyDown(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if a key is currently held down (keyCode)
  if args.len > 0:
    let key = valueToInt(args[0])
    if key >= 0 and key < 512:
      return valBool(gInputState.keysDown[key])
  return valBool(false)

proc isKeyReleased(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if a key was released this frame (keyCode)
  if args.len > 0:
    let key = valueToInt(args[0])
    if key >= 0 and key < 512:
      return valBool(gInputState.keysReleased[key])
  return valBool(false)

proc getCharPressed(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get the last character pressed (for text input, returns 0 if none)
  return valInt(gInputState.charPressed)

# Mouse functions
proc getMouseX(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get current mouse X position
  return valInt(gInputState.mouseX)

proc getMouseY(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get current mouse Y position
  return valInt(gInputState.mouseY)

proc getMouseDeltaX(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get mouse X movement since last frame
  return valInt(gInputState.mouseDeltaX)

proc getMouseDeltaY(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get mouse Y movement since last frame
  return valInt(gInputState.mouseDeltaY)

proc isMouseButtonPressed(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if mouse button was pressed this frame (0=left, 1=middle, 2=right)
  if args.len > 0:
    let btn = valueToInt(args[0])
    if btn >= 0 and btn < 5:
      return valBool(gInputState.mousePressed[btn])
  return valBool(false)

proc isMouseButtonDown(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if mouse button is currently held down (0=left, 1=middle, 2=right)
  if args.len > 0:
    let btn = valueToInt(args[0])
    if btn >= 0 and btn < 5:
      return valBool(gInputState.mouseButtons[btn])
  return valBool(false)

proc isMouseButtonReleased(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if mouse button was released this frame (0=left, 1=middle, 2=right)
  if args.len > 0:
    let btn = valueToInt(args[0])
    if btn >= 0 and btn < 5:
      return valBool(gInputState.mouseReleased[btn])
  return valBool(false)

proc getMouseWheelX(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get horizontal mouse wheel movement
  return valFloat(gInputState.mouseWheelX)

proc getMouseWheelY(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get vertical mouse wheel movement
  return valFloat(gInputState.mouseWheelY)

# Touch functions (same as mouse for compatibility)
proc getTouchX(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get touch X position (or mouse X if no touch)
  if gInputState.touchActive:
    return valInt(gInputState.touchX)
  return valInt(gInputState.mouseX)

proc getTouchY(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Get touch Y position (or mouse Y if no touch)
  if gInputState.touchActive:
    return valInt(gInputState.touchY)
  return valInt(gInputState.mouseY)

proc isTouchActive(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Check if touch is currently active (or left mouse button is down)
  return valBool(gInputState.touchActive or gInputState.mouseButtons[0])

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

# ================================================================
# AUDIO NIMINI WRAPPERS
# ================================================================

proc initAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Initialize audio system
  ## initAudio(sampleRate, channels, bufferSize)
  if gAudioInitialized:
    return valBool(true)
  
  let sampleRate = if args.len > 0: valueToInt(args[0]) else: 48000
  let channels = if args.len > 1: valueToInt(args[1]) else: 2
  let bufferSize = if args.len > 2: valueToInt(args[2]) else: 4096
  
  gAudioSystem = createAudioSystem()
  if not gAudioSystem.initAudio():
    echo "Failed to initialize audio system"
    return valBool(false)
  
  # Create audio spec
  # Use int16 for Raylib (better web compatibility), float32 for SDL
  when defined(raylib):
    const audioFormat = afS16
  else:
    const audioFormat = afF32
  
  var spec = AudioSpec(
    sampleRate: sampleRate.int32,
    channels: channels.int32,
    format: audioFormat,
    bufferSize: bufferSize.int32
  )
  
  # Create stream (for SDL3, this also opens the device automatically)
  gAudioStream = gAudioSystem.createStream(spec)
  
  if gAudioStream.isNil:
    echo "Failed to create audio stream"
    return valBool(false)
  
  # For non-SDL3 backends, open and bind device separately
  when not defined(sdl3):
    gAudioDevice = gAudioSystem.openDevice(spec)
    if not gAudioSystem.bindStream(gAudioDevice, gAudioStream):
      echo "Failed to bind audio stream"
      return valBool(false)
  
  gAudioInitialized = true
  return valBool(true)

proc queueAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Queue audio samples for playback
  ## queueAudio(audioBuffer) - buffer should be a sequence of float values
  if not gAudioInitialized or gAudioStream.isNil:
    return valBool(false)
  
  if args.len == 0:
    return valBool(false)
  
  let bufferVal = args[0]
  if bufferVal.kind != vkArray:
    return valBool(false)
  
  # Convert Nimini array to appropriate format
  when defined(raylib):
    # Raylib: convert to int16 for better web compatibility
    var audioData: seq[int16]
    for item in bufferVal.arr:
      let sample = case item.kind
        of vkFloat: item.f
        of vkInt: item.i.float
        else: 0.0
      # Convert -1.0..1.0 float to int16 range
      let scaled = clamp(sample * 32767.0, -32767.0, 32767.0)
      audioData.add(scaled.int16)
  else:
    # SDL: use float32
    var audioData: seq[float32]
    for item in bufferVal.arr:
      let sample = case item.kind
        of vkFloat: item.f.float32
        of vkInt: item.i.float32
        else: 0.0'f32
      audioData.add(sample)
  
  if audioData.len == 0:
    return valBool(false)
  
  # Queue the data
  let frames = audioData.len div 2  # Assuming stereo
  
  # Try putStreamData first (SDL), fall back to updateStream (Raylib)
  let success = gAudioSystem.putStreamData(gAudioStream, addr audioData[0], frames.int32)
  if not success:
    # For Raylib: update stream with new data
    # Note: UpdateAudioStream in Raylib handles buffering internally
    gAudioSystem.updateStream(gAudioStream, addr audioData[0], frames.int32)
  
  # For Emscripten/SDL3, try to re-initialize if not ready yet
  # (browser audio requires event loop to be running)
  when defined(emscripten) and defined(sdl3):
    if gAudioStream.isNil:
      echo "Audio not ready yet, attempting lazy init..."
      # Try to initialize now that event loop is running
      var spec = AudioSpec(
        sampleRate: 48000,
        channels: 2,
        format: afF32,
        bufferSize: 4096
      )
      gAudioStream = gAudioSystem.createStream(spec)
      if gAudioStream.isNil:
        echo "Still can't create audio stream (may need user interaction)"
        return valBool(false)
      echo "Audio stream created successfully after event loop started"
  
  # Auto-start playback on first queue (do this BEFORE putting data for SDL3)
  if not gAudioPlaying:
    gAudioSystem.playStream(gAudioStream)
    gAudioPlaying = true
    when defined(emscripten):
      echo "Audio playback started"
  
  return valBool(true)

proc playAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Start audio playback
  if not gAudioInitialized or gAudioStream.isNil:
    return valNil()
  
  gAudioSystem.playStream(gAudioStream)
  return valNil()

proc pauseAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Pause audio playback
  if not gAudioInitialized or gAudioStream.isNil:
    return valNil()
  
  gAudioSystem.pauseStream(gAudioStream)
  return valNil()

proc stopAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Stop audio playback
  if not gAudioInitialized or gAudioStream.isNil:
    return valNil()
  
  gAudioSystem.stopStream(gAudioStream)
  return valNil()

proc shutdownAudio(env: ref Env; args: seq[Value]): Value {.nimini.} =
  ## Shutdown audio system
  if not gAudioInitialized:
    return valNil()
  
  if not gAudioStream.isNil:
    gAudioSystem.destroyStream(gAudioStream)
    gAudioStream = nil
  
  if not gAudioDevice.isNil:
    gAudioSystem.closeDevice(gAudioDevice)
    gAudioDevice = nil
  
  gAudioSystem.shutdownAudio()
  gAudioSystem = nil
  gAudioInitialized = false
  
  return valNil()

proc createNiminiContext(): NiminiContext =
  ## Create a Nimini interpreter context with exposed APIs
  initRuntime()
  
  # Register standard library functions
  registerSeqOps()
  
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
    # Keyboard events
    isKeyPressed, isKeyDown, isKeyReleased, getCharPressed,
    # Mouse events
    getMouseX, getMouseY, getMouseDeltaX, getMouseDeltaY,
    isMouseButtonPressed, isMouseButtonDown, isMouseButtonReleased,
    getMouseWheelX, getMouseWheelY,
    # Touch events
    getTouchX, getTouchY, isTouchActive,
    # 3D rendering
    enable3D, setCamera, setCameraFov,
    resetTransform, translate3D, rotate3D, scale3D,
    drawCube, drawSphere, clear3D,
    # Audio
    initAudio, queueAudio, playAudio, pauseAudio, stopAudio, shutdownAudio
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
  
  # Reset per-frame input state
  for i in 0..<512:
    gInputState.keysPressed[i] = false
    gInputState.keysReleased[i] = false
  for i in 0..<5:
    gInputState.mousePressed[i] = false
    gInputState.mouseReleased[i] = false
  gInputState.charPressed = 0
  gInputState.mouseDeltaX = 0
  gInputState.mouseDeltaY = 0
  gInputState.mouseWheelX = 0.0
  gInputState.mouseWheelY = 0.0
  
  # Poll character input directly (Raylib only for now)
  when not defined(sdl3):
    let ch = GetCharPressed()
    if ch > 0:
      gInputState.charPressed = ch.int
  
  # Handle events
  let events = appState.platform.pollEvents()
  for event in events:
    case event.kind
    of KeyEvent:
      let keyCode = event.keyCode
      if keyCode >= 0 and keyCode < 512:
        case event.keyAction
        of Press:
          gInputState.keysPressed[keyCode] = true
          gInputState.keysDown[keyCode] = true
          # ESC key is code 256 in Raylib, 27 in some systems
          if keyCode == 27 or keyCode == 256:
            appState.running = false
        of Release:
          gInputState.keysReleased[keyCode] = true
          gInputState.keysDown[keyCode] = false
        of Repeat:
          discard  # Key repeat - already marked as down
      
      # Call input callback
      if not inputCallback.isNil:
        inputCallback()
    
    of MouseEvent:
      let btnIdx = case event.button
        of Left: 0
        of Middle: 1
        of Right: 2
        else: 3
      
      if btnIdx < 5:
        case event.action
        of Press:
          gInputState.mousePressed[btnIdx] = true
          gInputState.mouseButtons[btnIdx] = true
        of Release:
          gInputState.mouseReleased[btnIdx] = true
          gInputState.mouseButtons[btnIdx] = false
        of Repeat:
          discard
    
    of MouseMoveEvent:
      let oldX = gInputState.mouseX
      let oldY = gInputState.mouseY
      gInputState.mouseX = event.moveX
      gInputState.mouseY = event.moveY
      gInputState.mouseDeltaX = event.moveX - oldX
      gInputState.mouseDeltaY = event.moveY - oldY
      
      # Update touch position if touch is active
      if gInputState.touchActive:
        gInputState.touchX = event.moveX
        gInputState.touchY = event.moveY
    
    of MouseScrollEvent:
      gInputState.mouseWheelX = event.scrollX
      gInputState.mouseWheelY = event.scrollY
    
    of ResizeEvent:
      # Update dimensions on window resize
      appState.width = event.newWidth
      appState.height = event.newHeight
      echo "Window resized to ", appState.width, "x", appState.height, " pixels"
  
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
      when defined(sdlgpu):
        # SDL_GPU renderer needs window pointer
        # TODO: Get window from platform
        gRenderer3D = newSdlGpuRenderer3D(nil)
      else:
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
  
  # Add key constants to the environment (platform-agnostic)
  when not defined(sdl3):
    # Raylib key codes
    niminiCtx.env.defineVar("KEY_SPACE", valInt(KEY_SPACE))
    niminiCtx.env.defineVar("KEY_ENTER", valInt(KEY_ENTER))
    niminiCtx.env.defineVar("KEY_ESCAPE", valInt(KEY_ESCAPE))
    niminiCtx.env.defineVar("KEY_BACKSPACE", valInt(KEY_BACKSPACE))
    niminiCtx.env.defineVar("KEY_TAB", valInt(KEY_TAB))
    niminiCtx.env.defineVar("KEY_RIGHT", valInt(KEY_RIGHT))
    niminiCtx.env.defineVar("KEY_LEFT", valInt(KEY_LEFT))
    niminiCtx.env.defineVar("KEY_UP", valInt(KEY_UP))
    niminiCtx.env.defineVar("KEY_DOWN", valInt(KEY_DOWN))
    niminiCtx.env.defineVar("KEY_A", valInt(KEY_A))
    niminiCtx.env.defineVar("KEY_W", valInt(KEY_W))
    niminiCtx.env.defineVar("KEY_S", valInt(KEY_S))
    niminiCtx.env.defineVar("KEY_D", valInt(KEY_D))
  else:
    # SDL3 key codes (using ASCII/scancode values)
    niminiCtx.env.defineVar("KEY_SPACE", valInt(32))      # Space
    niminiCtx.env.defineVar("KEY_ENTER", valInt(13))      # Return/Enter  
    niminiCtx.env.defineVar("KEY_ESCAPE", valInt(27))     # Escape
    niminiCtx.env.defineVar("KEY_BACKSPACE", valInt(8))   # Backspace
    niminiCtx.env.defineVar("KEY_TAB", valInt(9))         # Tab
    niminiCtx.env.defineVar("KEY_RIGHT", valInt(0x4000004F))  # SDL_SCANCODE_RIGHT
    niminiCtx.env.defineVar("KEY_LEFT", valInt(0x40000050))   # SDL_SCANCODE_LEFT
    niminiCtx.env.defineVar("KEY_DOWN", valInt(0x40000051))   # SDL_SCANCODE_DOWN
    niminiCtx.env.defineVar("KEY_UP", valInt(0x40000052))     # SDL_SCANCODE_UP
    niminiCtx.env.defineVar("KEY_A", valInt(97))          # 'a'
    niminiCtx.env.defineVar("KEY_W", valInt(119))         # 'w'
    niminiCtx.env.defineVar("KEY_S", valInt(115))         # 's'
    niminiCtx.env.defineVar("KEY_D", valInt(100))         # 'd'
  
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
