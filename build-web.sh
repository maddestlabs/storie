#!/bin/bash
# Storie WASM compiler script
# Compiles storie.nim to WebAssembly (Raylib by default, SDL3 with --sdl3)

set -e

VERSION="0.1.0"
OUTPUT_DIR="docs"
FILE_BASE="storie-raylib"

show_help() {
    cat << EOF
Storie WASM compiler (Raylib) v$VERSION
Compile Storie for web deployment with Raylib backend

Usage: ./build-web.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -r, --release         Compile in release mode (optimized)
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web.sh                # Compile to docs/
  ./build-web.sh -r             # Compile optimized

The compiled files will be placed in the specified output directory as:
  - storie-raylib.js
  - storie-raylib.wasm

Note: Use build-web-sdl.sh for SDL3 backend.

Requirements:
  - Nim compiler with Emscripten support
  - Emscripten SDK (emcc) - SDL3 built-in support

Setup Emscripten:
  cd emsdk
  ./emsdk install latest
  ./emsdk activate latest
  source ./emsdk_env.sh

EOF
}

RELEASE_MODE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "Storie WASM compiler (Raylib) version $VERSION"
            exit 0
            ;;
        -r|--release)
            RELEASE_MODE="-d:release --opt:size"
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

echo "Compiling Storie to WASM (Raylib backend)..."
echo "Output directory: $OUTPUT_DIR"
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
  --nimcache:nimcache_wasm_raylib
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# Raylib backend - uses GLFW for web compatibility
echo "Using Raylib backend for WASM..."
RAYLIB_LIB="build-wasm/vendor/raylib-build/raylib/libraylib.a"

export EMCC_CFLAGS="-s USE_GLFW=3 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=67108864 \
  -s ASYNCIFY \
  -s ASSERTIONS=1 \
  -s WASM=1 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=0 \
  -s EXPORT_NAME='Module' \
  --preload-file docs/assets@/assets \
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','FS'] \
  -DPLATFORM_WEB \
  -DGRAPHICS_API_OPENGL_ES2 \
  $RAYLIB_LIB"

# Additional optimization flags for release mode
if [ ! -z "$RELEASE_MODE" ]; then
    export EMCC_CFLAGS="$EMCC_CFLAGS -Oz -s ASSERTIONS=0"
fi

# Compile
echo "Running Nim compiler with Emscripten..."
echo "  Input: index.nim"
echo "  Output: $OUTPUT_DIR/${FILE_BASE}.js"
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
echo ""
echo "Build complete!"

# Copy index.md if it exists (needed at runtime for WASM)
if [ -f "index.md" ]; then
    cp index.md "$OUTPUT_DIR/index.md"
    echo "  - $OUTPUT_DIR/index.md (markdown content)"
fi

echo ""
echo "Build complete!"
