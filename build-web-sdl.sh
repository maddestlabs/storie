#!/bin/bash
# Storie WASM compiler script for SDL3 backend
# Compiles storie.nim to WebAssembly using SDL3

set -e

VERSION="0.1.0"
OUTPUT_DIR="docs"
FILE_BASE="storie-sdl"

show_help() {
    cat << EOF
Storie WASM compiler (SDL3 Minimal) v$VERSION
Compile Storie for web deployment with SDL3 backend

This is the MINIMAL build:
  - Uses SDL_RenderDebugText (built-in, no TTF)
  - No font loading required
  - Smallest SDL3 build (~800KB)

Usage: ./build-web-sdl.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -d, --debug           Compile in debug mode (larger, with assertions)
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web-sdl.sh                # Compile optimized (default)
  ./build-web-sdl.sh -d             # Compile debug build

The compiled files will be placed in the specified output directory as:
  - storie-sdl.js
  - storie-sdl.wasm

For TTF font support, use build-web-sdl-full.sh instead

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
            echo "Storie WASM compiler (SDL3) version $VERSION"
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

echo "Compiling Storie to WASM (SDL3 backend)..."
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
  -d:sdl3
  -d:noSignalHandler
  --threads:off
  --exceptions:goto
  $RELEASE_MODE
  --nimcache:nimcache_wasm_sdl
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# SDL3 backend Emscripten flags
echo "Using SDL3 backend for WASM..."
export EMCC_CFLAGS="-s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s STACK_SIZE=8388608 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=0 \
  -s EXPORT_NAME='Module' \
  -s ASSERTIONS=1 \
  --preload-file docs/assets@/assets \
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','FS'] \
  -s USE_WEBGL2=1 \
  -s FULL_ES3=1"

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
