#!/bin/bash
# Windows SDL_GPU build script for Storie (cross-compile from WSL/Linux)
# Uses Direct3D 12 on Windows via SDL_GPU
# Usage: ./build-windows-gpu.sh

# Auto-detect repository/project name
# Priority: 1) PROJECT_NAME env var, 2) .project-name file, 3) git remote, 4) directory name
if [ -n "$PROJECT_NAME" ]; then
    REPO_NAME="$PROJECT_NAME"
elif [ -f ".project-name" ]; then
    REPO_NAME=$(cat .project-name | tr '[:upper:]' '[:lower:]')
elif git rev-parse --git-dir > /dev/null 2>&1; then
    # Try to get name from git remote URL
    REMOTE_URL=$(git config --get remote.origin.url 2>/dev/null || echo "")
    if [ -n "$REMOTE_URL" ]; then
        REPO_NAME=$(basename -s .git "$REMOTE_URL" | tr '[:upper:]' '[:lower:]')
    else
        # Fallback to git repo directory name
        REPO_NAME=$(basename "$(git rev-parse --show-toplevel)" | tr '[:upper:]' '[:lower:]')
    fi
else
    # Final fallback to current directory name
    REPO_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]')
fi

VERSION="0.1.0"

show_help() {
    cat << EOF
${REPO_NAME^} v$VERSION - Windows x64 Build (SDL_GPU + Direct3D 12 + TTF)
Cross-compile for Windows from Linux/WSL using MinGW-w64

This build includes:
  - SDL_GPU with Direct3D 12 on Windows (no OpenGL issues!)
  - SDL_ttf for TrueType font rendering (includes FreeType & HarfBuzz)
  - Full text rendering support

Usage: ./build-windows.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -r, --release         Compile in release mode (optimized) [default]
  --debug               Compile in debug mode

Examples:
  ./build-windows.sh                  # Build release version
  ./build-windows.sh --debug          # Build debug version

Prerequisites:
  1. Install MinGW-w64: sudo apt-get install mingw-w64
  2. Run: ./setup-sdl3-windows.sh

Output: ${REPO_NAME}.exe (Windows x64 executable with D3D12 and text support)

EOF
}

RELEASE_MODE="-d:release"
BUILD_DIR="build-win/vendor"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "${REPO_NAME} version $VERSION"
            exit 0
            ;;
        -r|--release)
            RELEASE_MODE="-d:release"
            shift
            ;;
        --debug)
            RELEASE_MODE=""
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            echo "Error: Unexpected argument: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Check prerequisites
if ! command -v nim &> /dev/null; then
    echo "ERROR: Nim compiler not found!"
    echo "Install from: https://nim-lang.org/"
    exit 1
fi

if ! command -v x86_64-w64-mingw32-gcc &> /dev/null; then
    echo "ERROR: MinGW-w64 not found!"
    echo "Install with: sudo apt-get install mingw-w64"
    exit 1
fi

if [ ! -f "$BUILD_DIR/SDL3-build/libSDL3.a" ]; then
    echo "ERROR: SDL3 not built for Windows!"
    echo "Run: ./setup-sdl3-windows.sh first"
    exit 1
fi

if [ ! -f "$BUILD_DIR/SDL_ttf-build/libSDL3_ttf.a" ]; then
    echo "ERROR: SDL_ttf not built for Windows!"
    echo "Run: ./setup-sdl3-windows.sh first"
    exit 1
fi

# Check for index.md
if [ ! -f "index.md" ]; then
    echo "Warning: index.md not found. Create it with Nim code blocks."
fi

# Compile for Windows with SDL_GPU (uses D3D12 on Windows)
echo "Cross-compiling ${REPO_NAME^} for Windows x64 (SDL_GPU + Direct3D 12)..."
echo ""

SDL3_LIB="$BUILD_DIR/SDL3-build/libSDL3.a"
SDL3_TTF_LIB="$BUILD_DIR/SDL_ttf-build/libSDL3_ttf.a"
FREETYPE_LIB="$BUILD_DIR/SDL_ttf-build/external/freetype-build/libfreetype.a"
HARFBUZZ_LIB="$BUILD_DIR/SDL_ttf-build/external/harfbuzz-build/libharfbuzz.a"

nim c --os:windows --cpu:amd64 \
    --gcc.exe:x86_64-w64-mingw32-gcc \
    --gcc.linkerexe:x86_64-w64-mingw32-gcc \
    -d:sdl3 -d:sdl3Full -d:sdlgpu $RELEASE_MODE \
    --passC:"-I$(pwd)/$BUILD_DIR/SDL3-build/include" \
    --passC:"-I$(pwd)/$BUILD_DIR/SDL_ttf-build/include" \
    --passL:"-L/usr/x86_64-w64-mingw32/lib" \
    --passL:"$(pwd)/$SDL3_LIB" \
    --passL:"$(pwd)/$SDL3_TTF_LIB" \
    --passL:"$(pwd)/$FREETYPE_LIB" \
    --passL:"$(pwd)/$HARFBUZZ_LIB" \
    --passL:"-ld3d12 -ldxgi -lmingw32 -lm -luser32 -lgdi32 -lwinmm -limm32 -lole32 -loleaut32 -lshell32 -lsetupapi -lversion -luuid -ldinput8 -ldxguid -lrpcrt4 -static-libgcc -static-libstdc++" \
    --out:${REPO_NAME}.exe \
    index.nim

if [ $? -ne 0 ]; then
    echo ""
    echo "Compilation failed!"
    exit 1
fi

echo ""
echo "=========================================="
echo "Build successful!"
echo "=========================================="
echo ""
echo "Output: ${REPO_NAME}.exe"
echo "Graphics: Direct3D 12 (via SDL_GPU)"
echo "Text: SDL_ttf with FreeType & HarfBuzz"
echo "File size: $(du -h ${REPO_NAME}.exe | cut -f1)"
echo ""
echo "Transfer to Windows and run: ${REPO_NAME}.exe"
echo "Make sure to include font file(s) in same directory:"
echo "  - docs/assets/AnomalyMono-Powerline.otf"
echo ""
echo "Note: Requires Windows 10+ with D3D12 support"
echo "      (Most Windows 10 and all Windows 11 systems)"
