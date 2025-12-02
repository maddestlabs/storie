cmake_minimum_required(VERSION 3.20)
project(Storie LANGUAGES C CXX)

set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Options
option(BUILD_SHARED_LIBS "Build shared libraries" OFF)

# Platform detection
if(EMSCRIPTEN)
    message(STATUS "Building for Emscripten/WebAssembly")
    set(PLATFORM_WASM TRUE)
else()
    message(STATUS "Building for native platform")
    set(PLATFORM_NATIVE TRUE)
endif()

# ================================================================
# SDL3 Configuration
# ================================================================
message(STATUS "Configuring SDL3 from source...")

# SDL3 options - minimize what we build
set(SDL_SHARED OFF CACHE BOOL "" FORCE)
set(SDL_STATIC ON CACHE BOOL "" FORCE)
set(SDL_TEST OFF CACHE BOOL "" FORCE)
set(SDL_TESTS OFF CACHE BOOL "" FORCE)
set(SDL_DISABLE_INSTALL OFF CACHE BOOL "" FORCE)

# Enable audio subsystem
set(SDL_AUDIO ON CACHE BOOL "" FORCE)

# Add SDL3 subdirectory
add_subdirectory(vendor/SDL3-src)

# ================================================================
# SDL3_ttf Configuration
# ================================================================
message(STATUS "Configuring SDL3_ttf from source...")

# SDL3_ttf options
set(SDL3TTF_VENDORED ON CACHE BOOL "" FORCE)
set(SDL3TTF_INSTALL OFF CACHE BOOL "" FORCE)
set(SDL3TTF_SAMPLES OFF CACHE BOOL "" FORCE)

# Force use of vendored FreeType and HarfBuzz
set(SDLTTF_VENDORED ON CACHE BOOL "" FORCE)
set(SDLTTF_FREETYPE ON CACHE BOOL "" FORCE)
set(SDLTTF_HARFBUZZ ON CACHE BOOL "" FORCE)

# For Emscripten, ensure everything is built from source
if(EMSCRIPTEN)
    message(STATUS "Emscripten: Using vendored dependencies for SDL3_ttf")
else()
    message(STATUS "Native: Using vendored dependencies for SDL3_ttf")
endif()

# Add SDL3_ttf subdirectory
add_subdirectory(vendor/SDL_ttf-src)

# ================================================================
# Installation
# ================================================================

# Install SDL3 and SDL3_ttf libraries and headers
if(PLATFORM_NATIVE)
    # For native builds, install to vendor/SDL3 for easy linking
    set(CMAKE_INSTALL_PREFIX "${CMAKE_SOURCE_DIR}/vendor/SDL3" CACHE PATH "Install path" FORCE)
    
    # Install SDL3 static library
    install(FILES ${CMAKE_BINARY_DIR}/vendor/SDL3-src/libSDL3.a
        DESTINATION lib
    )
    
    install(DIRECTORY vendor/SDL3-src/include/
        DESTINATION include
        FILES_MATCHING PATTERN "*.h"
    )
    
    # Install SDL3_ttf static library
    install(FILES ${CMAKE_BINARY_DIR}/vendor/SDL_ttf-src/libSDL3_ttf.a
        DESTINATION lib
    )
    
    install(DIRECTORY vendor/SDL_ttf-src/include/
        DESTINATION include
        FILES_MATCHING PATTERN "*.h"
    )
endif()

# ================================================================
# Build summary
# ================================================================
message(STATUS "")
message(STATUS "===========================================")
message(STATUS "Storie SDL3 Build Configuration")
message(STATUS "===========================================")
message(STATUS "Platform: ${CMAKE_SYSTEM_NAME}")
message(STATUS "Compiler: ${CMAKE_C_COMPILER_ID}")
if(EMSCRIPTEN)
    message(STATUS "Emscripten: ${EMSCRIPTEN_VERSION}")
endif()
message(STATUS "SDL3: Building from source")
message(STATUS "SDL3_ttf: Building from source with vendored dependencies")
message(STATUS "===========================================")
message(STATUS "")
