## SDL3 Core - Initialization, window management, and basic functionality
import build_config
import types
export types

# Initialization constants
var
  SDL_INIT_VIDEO* {.importc, header: "SDL3/SDL_init.h".}: uint32
  SDL_INIT_AUDIO* {.importc, header: "SDL3/SDL_init.h".}: uint32
  SDL_INIT_EVENTS* {.importc, header: "SDL3/SDL_init.h".}: uint32

# Window flags
var
  SDL_WINDOW_RESIZABLE* {.importc, header: "SDL3/SDL_video.h".}: uint64

# Core initialization and shutdown
proc SDL_Init*(flags: uint32): cint {.importc, header: "SDL3/SDL_init.h".}
proc SDL_Quit*() {.importc, header: "SDL3/SDL_init.h".}

# Window management
proc SDL_CreateWindow*(title: cstring, w, h: cint, flags: uint64): ptr SDL_Window {.importc, header: "SDL3/SDL_video.h".}
proc SDL_DestroyWindow*(window: ptr SDL_Window) {.importc, header: "SDL3/SDL_video.h".}
proc SDL_GetWindowSize*(window: ptr SDL_Window, w, h: ptr cint): bool {.importc, header: "SDL3/SDL_video.h".}
proc SDL_SetWindowSize*(window: ptr SDL_Window, w, h: cint): bool {.importc, header: "SDL3/SDL_video.h".}

# Error handling
proc SDL_GetError*(): cstring {.importc, header: "SDL3/SDL_error.h".}

# Timing
proc SDL_Delay*(ms: uint32) {.importc, header: "SDL3/SDL_timer.h".}

# Emscripten-specific functions for canvas handling
when defined(emscripten):
  proc emscripten_get_canvas_element_size*(target: cstring, width, height: ptr cint): cint {.importc, header: "emscripten/html5.h".}
