## Build Configuration - Compiler flags and linking setup for SDL3
## Used by all SDL3 binding modules

when not defined(emscripten):
  # Native builds: Link against SDL3 libraries built with CMake
  const vendorPath* = "/workspaces/Storie/vendor/SDL3"

  {.passC: "-I" & vendorPath & "/include".}
  {.passL: "-L" & vendorPath & "/lib".}
  {.passL: "-lSDL3".}
  {.passL: "-lSDL3_ttf".}
  {.passL: "-Wl,-rpath," & vendorPath & "/lib".}
else:
  # Emscripten: SDL3 and SDL3_ttf built from source via CMake
  # Include paths for headers
  const sdl3SrcPath* = "/workspaces/Storie/vendor/SDL3-src"
  const sdl3BuildPath* = "/workspaces/Storie/build-wasm/vendor/SDL3-src"
  const ttfSrcPath* = "/workspaces/Storie/vendor/SDL_ttf-src"
  const ttfBuildPath* = "/workspaces/Storie/build-wasm/vendor/SDL_ttf-src"
  
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
