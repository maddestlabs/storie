#!/bin/bash
# Build script for raylib compatibility demo

echo "Building raylib compatibility demo..."

# Get the project root directory (parent of examples)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Check if raylib library exists
RAYLIB_LIB="$PROJECT_ROOT/build/vendor/raylib-build/raylib/libraylib.a"
if [ ! -f "$RAYLIB_LIB" ]; then
    echo "Error: Raylib library not found at $RAYLIB_LIB"
    echo "Run setup-raylib.sh from the project root first to build raylib"
    exit 1
fi

# Compile with raylib linking
cd "$SCRIPT_DIR"
nim c \
    --passL:"$RAYLIB_LIB" \
    --passL:"-lm -lpthread -ldl -lrt -lX11" \
    raylib_compat_demo.nim

if [ $? -eq 0 ]; then
    echo "✓ Compilation successful!"
    echo "Run with: ./raylib_compat_demo"
else
    echo "✗ Compilation failed!"
    exit 1
fi
