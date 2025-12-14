#!/bin/bash
# Storie WASM compiler script - FULL SDL3 BUILD
# Compiles storie.nim to WebAssembly with ALL SDL3 features enabled

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
FILE_BASE="${REPO_NAME}-sdl-full"

show_help() {
    cat << EOF
${REPO_NAME^} WASM compiler (SDL3 FULL) v$VERSION
Compile ${REPO_NAME^} for web deployment with ALL SDL3 features

This is the FULL build including:
  - SDL3_ttf (TrueType font rendering with HarfBuzz)
  - SDL3_image (PNG, JPG, WebP support)
  - SDL3_mixer (Audio playback and mixing)
  - Advanced text shaping (complex scripts support)
  - Color emoji rendering (SVG-based)

Usage: ./build-web-sdl-full.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -d, --debug           Compile in debug mode (larger, with assertions)
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web-sdl-full.sh                # Compile optimized (default)
  ./build-web-sdl-full.sh -d             # Compile debug build

The compiled files will be placed in the specified output directory as:
  - ${REPO_NAME}-sdl-full.js
  - ${REPO_NAME}-sdl-full.wasm
  - ${REPO_NAME}-sdl-full.data

Note: 
  - Use build-web-sdl.sh for minimal/fast-loading builds
  - This build is larger (~3-4MB) but includes all SDL3 features
  - Includes FreeType, HarfBuzz, and PlutoSVG libraries

Requirements:
  - Nim compiler with Emscripten support
  - Emscripten SDK (emcc) with SDL3 support

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
            echo "${REPO_NAME^} WASM compiler (SDL3 FULL) version $VERSION"
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

echo "Compiling ${REPO_NAME^} to WASM (SDL3 FULL backend)..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Nim compiler options for Emscripten
NIM_OPTS="c
  -d:emscripten
  -d:sdl3
  -d:sdl3Full
  $RELEASE_MODE
  --nimcache:nimcache/wasm_sdl_full
  -o:$OUTPUT_DIR/${FILE_BASE}.js
  index.nim"

# SDL3 FULL backend - all features enabled
echo "Using SDL3 FULL backend for WASM..."

# Build SDL3 with all features from vendor
SDL3_DIR="build-wasm/vendor/SDL-build"
SDL3_TTF_DIR="build-wasm/vendor/SDL_ttf-build"
SDL3_IMAGE_DIR="build-wasm/vendor/SDL_image-build"
SDL3_MIXER_DIR="build-wasm/vendor/SDL_mixer-build"

export EMCC_CFLAGS="-s INITIAL_MEMORY=134217728 \
  -s STACK_SIZE=16777216 \
  --preload-file docs/assets@/assets \
  -s EXPORTED_FUNCTIONS=['_malloc','_free','_main','_loadMarkdownFromJS','_setWaitingForGist'] \
  -s USE_SDL=3 \
  -s USE_SDL_TTF=3 \
  -s USE_SDL_IMAGE=3 \
  -s USE_SDL_MIXER=3 \
  -s SDL2_IMAGE_FORMATS=['png','jpg','webp'] \
  -s USE_FREETYPE=1 \
  -s USE_HARFBUZZ=1"

# Additional debug-specific flags
if [ "$RELEASE_MODE" = "-d:debug" ]; then
    export EMCC_CFLAGS="$EMCC_CFLAGS -s SAFE_HEAP=1 -s STACK_OVERFLOW_CHECK=2"
fi

# Compile
echo "Running Nim compiler with Emscripten..."
echo "  Input: index.nim"
echo "  Output: $OUTPUT_DIR/${FILE_BASE}.js"
echo ""
echo "Features enabled:"
echo "  ✓ SDL3 core rendering"
echo "  ✓ SDL3_ttf (TrueType fonts)"
echo "  ✓ FreeType (font rasterization)"
echo "  ✓ HarfBuzz (text shaping for complex scripts)"
echo "  ✓ PlutoSVG (SVG color emoji support)"
echo "  ✓ SDL3_image (PNG, JPG, WebP)"
echo "  ✓ SDL3_mixer (audio playback)"
echo "  ✓ WebGL2 with full ES3 support"
echo ""
echo "Bundled libraries:"
echo "  • FreeType (font engine)"
echo "  • HarfBuzz (text shaping)"
echo "  • PlutoSVG (SVG rendering)"
echo "  • PlutoVG (vector graphics)"
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
echo "  - $OUTPUT_DIR/${FILE_BASE}.data (preloaded assets)"
echo ""

echo ""
echo "Build complete!"
echo ""
echo "Note: This is a FULL build with all SDL3 features."
echo "      For faster loading demos, use build-web-sdl.sh (minimal build)"
echo ""
echo "Size comparison (approximate):"
echo "  Minimal SDL3: ~800KB"
echo "  Full SDL3:    ~3-4MB (includes FreeType, HarfBuzz, PlutoSVG)"

