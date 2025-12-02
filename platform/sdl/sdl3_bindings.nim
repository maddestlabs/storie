## SDL3 Bindings - Direct C imports for essential functions
## Using direct C imports instead of Futhark due to SDL3's large API surface
## This gives us full control and faster compile times

when not defined(emscripten):
  # Native builds: Link against SDL3 libraries built with CMake
  const vendorPath = "/workspaces/Storie/vendor/SDL3"

  {.passC: "-I" & vendorPath & "/include".}
  {.passL: "-L" & vendorPath & "/lib".}
  {.passL: "-lSDL3".}
  {.passL: "-lSDL3_ttf".}
  {.passL: "-Wl,-rpath," & vendorPath & "/lib".}
else:
  # Emscripten: SDL3 and SDL3_ttf built from source via CMake
  # Include paths for headers
  const sdl3SrcPath = "/workspaces/Storie/vendor/SDL3-src"
  const sdl3BuildPath = "/workspaces/Storie/build-wasm/vendor/SDL3-src"
  const ttfSrcPath = "/workspaces/Storie/vendor/SDL_ttf-src"
  const ttfBuildPath = "/workspaces/Storie/build-wasm/vendor/SDL_ttf-src"
  
  # SDL3 headers (source + generated)
  {.passC: "-I" & sdl3SrcPath & "/include".}
  {.passC: "-I" & sdl3BuildPath & "/include-config-release".}
  {.passC: "-I" & sdl3BuildPath & "/include-revision".}
  
  # SDL3_ttf headers
  {.passC: "-I" & ttfSrcPath & "/include".}
  
  # Link against the WebAssembly libraries built in build-wasm/
  {.passL: sdl3BuildPath & "/libSDL3.a".}
  {.passL: ttfBuildPath & "/libSDL3_ttf.a".}
  
  # SDL3_ttf dependencies (vendored by SDL3_ttf)
  {.passL: ttfBuildPath & "/external/freetype-build/libfreetype.a".}
  {.passL: ttfBuildPath & "/external/harfbuzz-build/libharfbuzz.a".}

# Core SDL3 types and constants
type
  SDL_Window* {.importc, header: "SDL3/SDL.h", incompletestruct.} = object
  SDL_Renderer* {.importc, header: "SDL3/SDL.h", incompletestruct.} = object
  SDL_Texture* {.importc, header: "SDL3/SDL.h", incompletestruct.} = object
  
  SDL_EventType* {.importc, header: "SDL3/SDL_events.h", size: sizeof(cint).} = enum
    SDL_EVENT_QUIT = 0x100
    SDL_EVENT_WINDOW_RESIZED = 0x205
    SDL_EVENT_KEY_DOWN = 0x300
    SDL_EVENT_KEY_UP = 0x301
    SDL_EVENT_MOUSE_MOTION = 0x400
    SDL_EVENT_MOUSE_BUTTON_DOWN = 0x401
    SDL_EVENT_MOUSE_BUTTON_UP = 0x402
  
  SDL_Keycode* = distinct cint
  
  SDL_KeyboardEvent* {.importc, header: "SDL3/SDL_events.h".} = object
    kind*: SDL_EventType
    timestamp*: uint64
    windowID*: uint32
    which*: uint32
    scancode*: cint
    key*: SDL_Keycode
    mods*: uint16
    raw*: uint16
    down*: bool
    repeat*: bool
  
  SDL_MouseButtonEvent* {.importc, header: "SDL3/SDL_events.h".} = object
    kind*: SDL_EventType
    timestamp*: uint64
    windowID*: uint32
    which*: uint32
    button*: uint8
    down*: bool
    clicks*: uint8
    padding*: uint8
    x*, y*: cfloat
  
  SDL_MouseMotionEvent* {.importc, header: "SDL3/SDL_events.h".} = object
    kind*: SDL_EventType
    timestamp*: uint64
    windowID*: uint32
    which*: uint32
    state*: uint32
    x*, y*: cfloat
    xrel*, yrel*: cfloat
  
  SDL_WindowEvent* {.importc, header: "SDL3/SDL_events.h".} = object
    kind*: SDL_EventType
    timestamp*: uint64
    windowID*: uint32
    data1*, data2*: int32
  
  SDL_Event* {.importc, header: "SDL3/SDL_events.h", union.} = object
    `type`*: SDL_EventType
    key*: SDL_KeyboardEvent
    button*: SDL_MouseButtonEvent
    motion*: SDL_MouseMotionEvent
    window*: SDL_WindowEvent
  
  SDL_FRect* {.importc, header: "SDL3/SDL_rect.h".} = object
    x*, y*, w*, h*: cfloat
  
  SDL_Rect* {.importc, header: "SDL3/SDL_rect.h".} = object
    x*, y*, w*, h*: cint

# SDL constants
var
  SDL_INIT_VIDEO* {.importc, header: "SDL3/SDL_init.h".}: uint32
  SDL_INIT_EVENTS* {.importc, header: "SDL3/SDL_init.h".}: uint32
  SDL_WINDOW_RESIZABLE* {.importc, header: "SDL3/SDL_video.h".}: uint64

# Core SDL3 functions
proc SDL_Init*(flags: uint32): cint {.importc, header: "SDL3/SDL_init.h".}
proc SDL_Quit*() {.importc, header: "SDL3/SDL_init.h".}

proc SDL_CreateWindow*(title: cstring, w, h: cint, flags: uint64): ptr SDL_Window {.importc, header: "SDL3/SDL_video.h".}
proc SDL_DestroyWindow*(window: ptr SDL_Window) {.importc, header: "SDL3/SDL_video.h".}
proc SDL_GetWindowSize*(window: ptr SDL_Window, w, h: ptr cint): bool {.importc, header: "SDL3/SDL_video.h".}

proc SDL_CreateRenderer*(window: ptr SDL_Window, name: cstring): ptr SDL_Renderer {.importc, header: "SDL3/SDL_render.h".}
proc SDL_DestroyRenderer*(renderer: ptr SDL_Renderer) {.importc, header: "SDL3/SDL_render.h".}
proc SDL_SetRenderDrawColor*(renderer: ptr SDL_Renderer, r, g, b, a: uint8): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_RenderClear*(renderer: ptr SDL_Renderer): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_RenderFillRect*(renderer: ptr SDL_Renderer, rect: ptr SDL_FRect): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_RenderLine*(renderer: ptr SDL_Renderer, x1, y1, x2, y2: cfloat): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_RenderPoint*(renderer: ptr SDL_Renderer, x, y: cfloat): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_RenderPresent*(renderer: ptr SDL_Renderer): bool {.importc, header: "SDL3/SDL_render.h".}
proc SDL_SetRenderViewport*(renderer: ptr SDL_Renderer, rect: ptr SDL_Rect): bool {.importc, header: "SDL3/SDL_render.h".}

proc SDL_DestroyTexture*(texture: ptr SDL_Texture) {.importc, header: "SDL3/SDL_render.h".}

proc SDL_PollEvent*(event: ptr SDL_Event): bool {.importc, header: "SDL3/SDL_events.h".}

proc SDL_Delay*(ms: uint32) {.importc, header: "SDL3/SDL_timer.h".}

proc SDL_GetError*(): cstring {.importc, header: "SDL3/SDL_error.h".}
proc SDL_SetWindowSize*(window: ptr SDL_Window, w, h: cint): bool {.importc, header: "SDL3/SDL_video.h".}

# Emscripten-specific functions for canvas handling
when defined(emscripten):
  proc emscripten_get_canvas_element_size*(target: cstring, width, height: ptr cint): cint {.importc, header: "emscripten/html5.h".}

# SDL_ttf for text rendering (now available for both native and Emscripten)
const ttfHeader = "SDL3_ttf/SDL_ttf.h"

type
  TTF_Font* {.importc, header: ttfHeader, incompletestruct.} = object
  SDL_Surface* {.importc, header: "SDL3/SDL_surface.h".} = object
    flags*: uint32
    format*: pointer
    w*, h*: cint
    pitch*: cint
    pixels*: pointer
    refcount*: cint
    reserved*: pointer
  SDL_Color* {.importc, header: "SDL3/SDL_pixels.h".} = object
    r*, g*, b*, a*: uint8

proc TTF_Init*(): bool {.importc, header: ttfHeader.}
proc TTF_Quit*() {.importc, header: ttfHeader.}
proc TTF_OpenFont*(file: cstring, ptsize: cfloat): ptr TTF_Font {.importc, header: ttfHeader.}
proc TTF_CloseFont*(font: ptr TTF_Font) {.importc, header: ttfHeader.}
proc TTF_RenderText_Solid*(font: ptr TTF_Font, text: cstring, length: csize_t, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}
proc TTF_RenderText_Blended*(font: ptr TTF_Font, text: cstring, length: csize_t, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}
proc TTF_RenderGlyph_Solid*(font: ptr TTF_Font, ch: uint32, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}

# Surface and texture functions for text rendering
proc SDL_CreateTextureFromSurface*(renderer: ptr SDL_Renderer, surface: ptr SDL_Surface): ptr SDL_Texture {.importc, header: "SDL3/SDL_render.h".}
proc SDL_DestroySurface*(surface: ptr SDL_Surface) {.importc, header: "SDL3/SDL_surface.h".}
proc SDL_RenderTexture*(renderer: ptr SDL_Renderer, texture: ptr SDL_Texture, srcrect: ptr SDL_FRect, dstrect: ptr SDL_FRect): bool {.importc, header: "SDL3/SDL_render.h".}
