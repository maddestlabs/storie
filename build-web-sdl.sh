#!/bin/bash
# Storie WASM compiler script for SDL3 backend
# Compiles storie.nim to WebAssembly using SDL3

set -e

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
OUTPUT_DIR="docs"
FILE_BASE="${REPO_NAME}-sdl"

show_help() {
    cat << EOF
${REPO_NAME^} WASM compiler (SDL3 Minimal) v$VERSION
Compile ${REPO_NAME^} for web deployment with SDL3 backend

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
  - ${REPO_NAME}-sdl.js
  - ${REPO_NAME}-sdl.wasm

For TTF font support, use build-web-sdl-full.sh instead

EOF
}

# nim.cfg handles optimizations; set to -d:debug to disable
RELEASE_MODE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "${REPO_NAME^} WASM compiler (SDL3) version $VERSION"
            exit 0
            ;;
        -d|--debug)
            RELEASE_MODE="-d:debug"
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

echo "Compiling ${REPO_NAME^} to WASM (SDL3 backend)..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Nim compiler options for Emscripten
NIM_OPTS="c
  -d:emscripten
  -d:sdl3
  $RELEASE_MODE
  --nimcache:nimcache/wasm_sdl
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# SDL3 backend Emscripten flags
echo "Using SDL3 backend for WASM..."
export EMCC_CFLAGS="--preload-file docs/assets@/assets"

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
