## Example: Using minimal modular SDL3 imports
## This demonstrates how to import only what you need for smaller binaries

# Import only the SDL3 modules we actually use
import ../platform/sdl/sdl3_bindings/core      # Init, window management
import ../platform/sdl/sdl3_bindings/render    # 2D rendering
import ../platform/sdl/sdl3_bindings/events    # Event handling

# Note: We're NOT importing sdl3_bindings/ttf since we don't use fonts here
# This keeps the binary smaller by excluding unused TTF/FreeType/Harfbuzz code

proc main() =
  # Initialize SDL
  if SDL_Init(SDL_INIT_VIDEO or SDL_INIT_EVENTS) != 0:
    echo "Failed to initialize SDL: ", SDL_GetError()
    return
  
  defer: SDL_Quit()
  
  # Create window
  let window = SDL_CreateWindow("Minimal Import Example", 800, 600, SDL_WINDOW_RESIZABLE)
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
  
  # Main loop
  var running = true
  var event: SDL_Event
  
  while running:
    # Handle events
    while SDL_PollEvent(addr event):
      if event.`type` == SDL_EVENT_QUIT:
        running = false
    
    # Clear screen to blue
    discard SDL_SetRenderDrawColor(renderer, 50, 100, 200, 255)
    discard SDL_RenderClear(renderer)
    
    # Draw a white rectangle
    discard SDL_SetRenderDrawColor(renderer, 255, 255, 255, 255)
    var rect = SDL_FRect(x: 100, y: 100, w: 200, h: 150)
    discard SDL_RenderFillRect(renderer, addr rect)
    
    # Present
    discard SDL_RenderPresent(renderer)
    
    SDL_Delay(16)  # ~60 FPS

when isMainModule:
  main()
