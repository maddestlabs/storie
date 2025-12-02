## SDL3 Events - Event handling, keyboard, mouse input
import build_config
import types
export types

type
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

# Event functions
proc SDL_PollEvent*(event: ptr SDL_Event): bool {.importc, header: "SDL3/SDL_events.h".}
