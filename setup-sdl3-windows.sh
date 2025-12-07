#!/bin/bash
# Setup script for SDL3 - builds for Windows x64 using MinGW cross-compiler

set -e

SDL_VERSION="latest"
VENDOR_DIR="vendor"
SDL3_SRC="$VENDOR_DIR/SDL3-src"
BUILD_DIR="build-win/vendor"

echo "=== SDL3 Windows Cross-Compile Setup ==="
echo "Building SDL3 for Windows x64 using MinGW-w64"
echo ""

# Check if MinGW is installed
if ! command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    echo "ERROR: MinGW-w64 not found!"
    echo "Install with: sudo apt-get install mingw-w64"
    exit 1
fi

# Check if SDL3 source exists
if [ ! -d "$SDL3_SRC" ]; then
    echo "ERROR: SDL3 source not found at $SDL3_SRC"
    echo "Make sure you've cloned the repository with submodules."
    exit 1
fi

# Build SDL3 for Windows
echo "Building SDL3 for Windows x64..."
mkdir -p "$BUILD_DIR/SDL3-build"
cd "$BUILD_DIR/SDL3-build"

cmake ../../../"$SDL3_SRC" \
    -DCMAKE_TOOLCHAIN_FILE=../../../"$SDL3_SRC"/build-scripts/cmake-toolchain-mingw64-x86_64.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DSDL_SHARED=OFF \
    -DSDL_STATIC=ON \
    -DSDL_TEST=OFF \
    -DSDL_TESTS=OFF

make -j$(nproc)
echo "✓ SDL3 built for Windows"
cd ../../..

# Build SDL_ttf for Windows
echo ""
echo "Building SDL_ttf for Windows x64..."
mkdir -p "$BUILD_DIR/SDL_ttf-build"
cd "$BUILD_DIR/SDL_ttf-build"

# Use SDL3's build directory directly
SDL3_BUILD_DIR="$(pwd)/../SDL3-build"

# Create initial cache to force vendored options
cat > init-cache.cmake << 'CACHE_EOF'
set(BUILD_SHARED_LIBS OFF CACHE BOOL "" FORCE)
set(SDLTTF_VENDORED ON CACHE BOOL "" FORCE)
set(SDLTTF_FREETYPE_VENDORED ON CACHE BOOL "" FORCE)
set(SDLTTF_HARFBUZZ_VENDORED ON CACHE BOOL "" FORCE)
CACHE_EOF

cmake ../../../"$VENDOR_DIR/SDL_ttf-src" \
    -C init-cache.cmake \
    -DCMAKE_TOOLCHAIN_FILE=../../../"$SDL3_SRC"/build-scripts/cmake-toolchain-mingw64-x86_64.cmake \
    -DCMAKE_BUILD_TYPE=Release \
    -DSDL3_DIR="$SDL3_BUILD_DIR"

make -j$(nproc)
echo "✓ SDL_ttf built for Windows"
cd ../../..

echo ""
echo "=== Setup Complete ==="
echo "SDL3 and SDL_ttf libraries built for Windows x64 in $BUILD_DIR"
echo "  - SDL3:     $BUILD_DIR/SDL3-build/libSDL3.a"
echo "  - SDL_ttf:  $BUILD_DIR/SDL_ttf-build/libSDL3_ttf.a"
echo ""
echo "Now run: ./build-windows.sh to build your application"
