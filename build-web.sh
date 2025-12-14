#!/bin/bash
# Storie WASM compiler script
# Compiles storie.nim to WebAssembly (Raylib by default, SDL3 with --sdl3)

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
FILE_BASE="${REPO_NAME}-raylib"

show_help() {
    cat << EOF
${REPO_NAME^} WASM compiler (Raylib) v$VERSION
Compile ${REPO_NAME^} for web deployment with Raylib backend

Usage: ./build-web.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -d, --debug           Compile in debug mode (larger, with assertions)
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web.sh                # Compile optimized (default)
  ./build-web.sh -d             # Compile debug build

The compiled files will be placed in the specified output directory as:
  - ${REPO_NAME}-raylib.js
  - ${REPO_NAME}-raylib.wasm
  - ${REPO_NAME}-raylib.data    (if docs/assets/ exists)

Assets:
  If docs/assets/ folder exists, all files are automatically preloaded.
  Access them at runtime with /assets/ prefix:
    - Audio: LoadSound("/assets/audio/sound.wav")
    - Images: LoadTexture("/assets/images/sprite.png")
    - Fonts: LoadFont("/assets/fonts/custom.ttf")
  
  Generate test audio files: ./generate-test-audio.sh

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
            echo "${REPO_NAME^} WASM compiler (Raylib) version $VERSION"
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

echo "Compiling ${REPO_NAME^} to WASM (Raylib backend)..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Nim compiler options for Emscripten
NIM_OPTS="c
  -d:emscripten
  $RELEASE_MODE
  --nimcache:nimcache/wasm_raylib
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# Raylib backend - uses GLFW for web compatibility
echo "Using Raylib backend for WASM..."
RAYLIB_LIB="build-wasm/vendor/raylib-build/raylib/libraylib.a"

# Check if assets folder exists and preload it
PRELOAD_ARGS=""
if [ -d "docs/assets" ]; then
    echo "Preloading assets from docs/assets..."
    PRELOAD_ARGS="--preload-file docs/assets@/assets"
fi

export EMCC_CFLAGS="-s USE_GLFW=3 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s TOTAL_MEMORY=67108864 \
  -s ASYNCIFY \
  -s ASSERTIONS=1 \
  -s WASM=1 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=0 \
  -s EXPORT_NAME='Module' \
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','FS','HEAPF32','HEAP16','HEAP8'] \
  -s EXPORTED_FUNCTIONS=['_main','_malloc','_free','_setWaitingForGist','_loadMarkdownFromJS'] \
  $PRELOAD_ARGS \
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
