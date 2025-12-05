#!/bin/bash
# Storie WASM compiler script - FULL RAYLIB BUILD
# Compiles storie.nim to WebAssembly with ALL Raylib features enabled

set -e

VERSION="0.1.0"
OUTPUT_DIR="docs"
FILE_BASE="storie-raylib-full"

show_help() {
    cat << EOF
Storie WASM compiler (Raylib FULL) v$VERSION
Compile Storie for web deployment with ALL Raylib features + Google Fonts

This is the FULL build including:
  - All Raylib modules (models, shaders, audio, etc.)
  - Texture compression support
  - 3D rendering features
  - Advanced audio processing
  - Model loading and animation

Usage: ./build-web-full.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -d, --debug           Compile in debug mode (larger, with assertions)
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web-full.sh                # Compile optimized (default)
  ./build-web-full.sh -d             # Compile debug build

The compiled files will be placed in the specified output directory as:
  - storie-raylib-full.js
  - storie-raylib-full.wasm
  - storie-raylib-full.data

Note: 
  - Use build-web.sh for minimal/fast-loading builds
  - This build is larger (~1.5MB+) but includes all features

Requirements:
  - Nim compiler with Emscripten support
  - Emscripten SDK (emcc)

Setup Emscripten:
  cd emsdk
  ./emsdk install latest
  ./emsdk activate latest
  source ./emsdk_env.sh

EOF
}

RELEASE_MODE="-d:release --opt:size"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "Storie WASM compiler (Raylib FULL) version $VERSION"
            exit 0
            ;;
        -d|--debug)
            RELEASE_MODE=""
            shift
            ;;
        -o|--output)
            if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                OUTPUT_DIR="$2"
                shift 2
            else
                echo "Error: --output requires a directory argument"
                exit 1
            fi
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

# Check for Emscripten
if ! command -v emcc &> /dev/null; then
    echo "Error: Emscripten (emcc) not found!"
    echo ""
    echo "Please activate Emscripten:"
    echo "  cd emsdk"
    echo "  source ./emsdk_env.sh"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "Compiling Storie to WASM (Raylib FULL backend)..."
echo "Output directory: $OUTPUT_DIR"
echo "Includes: Core Google Fonts (Roboto, Roboto Mono, Inter)"
echo ""

# Nim compiler options for Emscripten
NIM_OPTS="c
  --cpu:wasm32
  --os:linux
  --cc:clang
  --clang.exe:emcc
  --clang.linkerexe:emcc
  --clang.cpp.exe:emcc
  --clang.cpp.linkerexe:emcc
  -d:emscripten
  -d:noSignalHandler
  --threads:off
  --exceptions:goto
  $RELEASE_MODE
  --nimcache:nimcache_wasm_raylib_full
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# Raylib FULL backend - all features enabled
echo "Using Raylib FULL backend for WASM..."
RAYLIB_LIB="build-wasm/vendor/raylib-build/raylib/libraylib.a"

# Check if fonts are available
if [ ! -d "docs/assets/fonts/core" ] || [ -z "$(ls -A docs/assets/fonts/core 2>/dev/null)" ]; then
    echo ""
    echo "Warning: Core fonts not found!"
    echo "Run ./build-font-packages.sh to download Google Fonts"
    echo "Continuing without fonts..."
    echo ""
    PRELOAD_ARGS=""
else
    echo "Including core fonts (~300KB)..."
    PRELOAD_ARGS="--preload-file docs/assets/fonts/core@/assets/fonts"
fi

export EMCC_CFLAGS="-s USE_GLFW=3 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=134217728 \
  -s ASYNCIFY \
  -s ASSERTIONS=1 \
  -s WASM=1 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=0 \
  -s EXPORT_NAME='Module' \
  $PRELOAD_ARGS \
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','FS'] \
  -s EXPORTED_FUNCTIONS=['_malloc','_free'] \
  -DPLATFORM_WEB \
  -DGRAPHICS_API_OPENGL_ES2 \
  -DSUPPORT_FILEFORMAT_PNG=1 \
  -DSUPPORT_FILEFORMAT_JPG=1 \
  -DSUPPORT_FILEFORMAT_GIF=1 \
  -DSUPPORT_FILEFORMAT_BMP=1 \
  -DSUPPORT_FILEFORMAT_OBJ=1 \
  -DSUPPORT_FILEFORMAT_MTL=1 \
  -DSUPPORT_FILEFORMAT_GLTF=1 \
  -DSUPPORT_MODULE_RTEXT=1 \
  -DSUPPORT_MODULE_RSHAPES=1 \
  -DSUPPORT_MODULE_RTEXTURES=1 \
  -DSUPPORT_MODULE_RAUDIO=1 \
  -DSUPPORT_MODULE_RMODELS=1 \
  $RAYLIB_LIB"

# Additional optimization flags for release mode
if [ ! -z "$RELEASE_MODE" ]; then
    export EMCC_CFLAGS="$EMCC_CFLAGS -Oz"
    # Keep some assertions for debugging in release
else
    # Debug mode - more assertions and error checking
    export EMCC_CFLAGS="$EMCC_CFLAGS -s SAFE_HEAP=1"
fi

# Compile
echo "Running Nim compiler with Emscripten..."
echo "  Input: index.nim"
echo "  Output: $OUTPUT_DIR/${FILE_BASE}.js"
echo ""
echo "Features enabled:"
echo "  ✓ All image formats (PNG, JPG, GIF, BMP)"
echo "  ✓ 3D model loading (OBJ, MTL, GLTF)"
echo "  ✓ Text rendering module"
echo "  ✓ Shapes module"
echo "  ✓ Textures module"
echo "  ✓ Audio module"
echo "  ✓ 3D models module"
echo ""

nim $NIM_OPTS

if [ $? -ne 0 ]; then
    echo ""
    echo "✗ Compilation failed!"
    exit 1
fi

echo ""
echo "✓ Compilation successful!"
echo ""
echo "Output files:"
echo "  - $OUTPUT_DIR/${FILE_BASE}.js"
echo "  - $OUTPUT_DIR/${FILE_BASE}.wasm"
if [ -f "$OUTPUT_DIR/${FILE_BASE}.data" ]; then
    echo "  - $OUTPUT_DIR/${FILE_BASE}.data (fonts + assets)"
fi
echo ""

# Copy index.md if it exists (needed at runtime for WASM)
if [ -f "index.md" ]; then
    cp index.md "$OUTPUT_DIR/index.md"
    echo "  - $OUTPUT_DIR/index.md (markdown content)"
fi

echo ""
echo "Build complete!"
echo ""
echo "Note: This is a FULL build with all features + Google Fonts."
echo "      For faster loading demos, use build-web.sh (minimal build)"
echo ""
if [ -f "$OUTPUT_DIR/${FILE_BASE}.data" ]; then
    echo "Google Fonts available at: /assets/fonts/"
    echo "  - Roboto-Regular.ttf"
    echo "  - RobotoMono-Regular.ttf"
    echo "  - Inter-Regular.ttf"
    echo ""
    echo "Usage in your code:"
    echo "  let font = LoadFont(\"/assets/fonts/Roboto-Regular.ttf\")"
    echo "  DrawTextEx(font, \"Hello!\", Vector2(100, 100), 20, 1, WHITE)"
fi

