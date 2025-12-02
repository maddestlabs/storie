## SDL3 Bindings - Main module that re-exports all SDL3 functionality
## 
## This module provides the complete SDL3 API surface.
## For smaller binaries, import specific modules instead:
##   - sdl3_bindings/core     - Init, windows, basic functionality
##   - sdl3_bindings/events   - Event handling, input
##   - sdl3_bindings/render   - 2D rendering and textures
##   - sdl3_bindings/audio    - Audio playback, recording, and streams
##   - sdl3_bindings/ttf      - TrueType font rendering
##
## Example (full API):
##   import sdl3_bindings
##
## Example (minimal - just what you need):
##   import sdl3_bindings/core
##   import sdl3_bindings/render
##   # Skip events, audio, ttf, etc. if not needed

import sdl3_bindings/build_config
import sdl3_bindings/types
import sdl3_bindings/core
import sdl3_bindings/events
import sdl3_bindings/render
import sdl3_bindings/audio
import sdl3_bindings/ttf

export build_config
export types
export core
export events
export render
export audio
export ttf
