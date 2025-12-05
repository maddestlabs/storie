#!/bin/bash
# Storie native build script - Raylib backend (default)
# Use --sdl3 flag for SDL3 backend

VERSION="0.1.0"

show_help() {
    cat << EOF
storie v$VERSION
Raylib-based engine with markdown content (index.md)

Usage: ./build.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -r, --release         Compile in release mode (optimized)
  -c, --compile-only    Compile without running
  --sdl3                Use SDL3 backend instead of Raylib (default)

Examples:
  ./build.sh                           # Compile and run (Raylib)
  ./build.sh -r                        # Compile optimized and run (Raylib)
  ./build.sh --sdl3                    # Use SDL3 backend
  ./build.sh -c                        # Compile only, don't run

Note: Content is loaded from index.md at runtime.

EOF
}

RELEASE_MODE=""
COMPILE_ONLY=false
BACKEND_FLAG=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "storie version $VERSION"
            exit 0
            ;;
        -r|--release)
            RELEASE_MODE="-d:release"
            shift
            ;;
        --sdl3)
            BACKEND_FLAG="-d:sdl3"
            shift
            ;;
        -c|--compile-only)
            COMPILE_ONLY=true
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

# Check for index.md
if [ ! -f "index.md" ]; then
    echo "Warning: index.md not found. Create it with Nim code blocks."
fi

# Compile
if [ -z "$BACKEND_FLAG" ]; then
    echo "Compiling Storie (Raylib backend)..."
    # Raylib linking
    RAYLIB_PATH="build/vendor/raylib-build/raylib"
    RAYLIB_LIB="build/vendor/raylib-build/raylib/libraylib.a"
    
    nim c $RELEASE_MODE \
        --passL:"$RAYLIB_LIB" \
        --passL:"-lm -lpthread -ldl -lrt" \
        --passL:"-lX11" \
        index.nim
else
    echo "Compiling Storie (SDL3 backend)..."
    nim c $RELEASE_MODE $BACKEND_FLAG index.nim
fi

if [ $? -ne 0 ]; then
    echo "Compilation failed!"
    exit 1
fi

# Run if not compile-only
if [ "$COMPILE_ONLY" = false ]; then
    echo "Running index..."
    echo ""
    ./index "$@"
else
    echo "Compilation successful!"
    echo "Run with: ./index"
fi
