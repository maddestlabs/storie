#!/bin/bash
# Storie native build script - Raylib backend (default)
# Use --sdl3 flag for SDL3 backend

VERSION="0.1.0"

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

show_help() {
    cat << EOF
$REPO_NAME v$VERSION
Raylib-based engine with markdown content (index.md)

Usage: ./build.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -d, --debug           Compile in debug mode (default is optimized for size)
  -c, --compile-only    Compile without running
  --sdl3                Use SDL3 backend instead of Raylib (default)

Examples:
  ./build.sh                           # Compile and run (Raylib, optimized)
  ./build.sh -d                        # Compile in debug mode (larger binary)
  ./build.sh --sdl3                    # Use SDL3 backend
  ./build.sh -c                        # Compile only, don't run

Note: Content is loaded from index.md at runtime.

EOF
}

# nim.cfg handles optimizations by default; use -d:debug to disable
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
            echo "$REPO_NAME version $VERSION"
            exit 0
            ;;
        -d|--debug)
            RELEASE_MODE="-d:debug"
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
    echo "Compiling ${REPO_NAME^} (Raylib backend)..."
    # Raylib linking
    RAYLIB_PATH="build/vendor/raylib-build/raylib"
    RAYLIB_LIB="build/vendor/raylib-build/raylib/libraylib.a"
    
    nim c $RELEASE_MODE \
        --passL:"$RAYLIB_LIB" \
        --passL:"-lm -lpthread -ldl -lrt" \
        --passL:"-lX11" \
        index.nim
else
    echo "Compiling ${REPO_NAME^} (SDL3 backend)..."
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
