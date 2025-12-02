## Example: Using full SDL3 bindings (all features)
## This is the traditional approach - import everything

# Import the complete SDL3 API
import ../platform/sdl/sdl3_bindings

# All SDL3 modules are now available:
# - Core (init, windows, timing, errors)
# - Events (keyboard, mouse, window events)
# - Render (2D rendering, textures)
# - TTF (font rendering)

proc main() =
  # Initialize SDL
  if SDL_Init(SDL_INIT_VIDEO or SDL_INIT_EVENTS) != 0:
    echo "Failed to initialize SDL: ", SDL_GetError()
    return
  
  defer: SDL_Quit()
  
  # Initialize TTF
  if not TTF_Init():
    echo "Failed to initialize TTF: ", SDL_GetError()
    return
  
  defer: TTF_Quit()
  
  # Create window
  let window = SDL_CreateWindow("Full Import Example", 800, 600, SDL_WINDOW_RESIZABLE)
  if window.isNil:
    echo "Failed to create window: ", SDL_GetError()
    return
  
  defer: SDL_DestroyWindow(window)
  
  # Create renderer
  let renderer = SDL_CreateRenderer(window, nil)
  if renderer.isNil:
    echo "Failed to create renderer: ", SDL_GetError()
    return
  
  defer: SDL_DestroyRenderer(renderer)
  
  # Example showing we have access to TTF functions
  echo "TTF is available for font rendering"
  # (Not actually loading a font in this example)
  
  # Main loop
  var running = true
  var event: SDL_Event
  
  while running:
    # Handle events
    while SDL_PollEvent(addr event):
      if event.`type` == SDL_EVENT_QUIT:
        running = false
    
    # Clear screen
    discard SDL_SetRenderDrawColor(renderer, 30, 30, 30, 255)
    discard SDL_RenderClear(renderer)
    
    # Draw something
    discard SDL_SetRenderDrawColor(renderer, 100, 200, 100, 255)
    var rect = SDL_FRect(x: 200, y: 150, w: 400, h: 300)
    discard SDL_RenderFillRect(renderer, addr rect)
    
    # Present
    discard SDL_RenderPresent(renderer)
    
    SDL_Delay(16)

when isMainModule:
  main()
