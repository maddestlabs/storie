#!/bin/bash
# Build an example from the examples/ directory

if [ -z "$1" ]; then
    echo "Usage: ./build-example.sh <example_name>"
    echo ""
    echo "Available examples:"
    echo "  pure_nimini    - Using Nimini scripts without markdown"
    echo "  pure_nim       - Using pure Nim with the engine"
    exit 1
fi

EXAMPLE_NAME="$1"
EXAMPLE_FILE="examples/${EXAMPLE_NAME}.nim"

if [ ! -f "$EXAMPLE_FILE" ]; then
    echo "Error: Example not found: $EXAMPLE_FILE"
    exit 1
fi

echo "Building example: $EXAMPLE_NAME"

# Raylib linking
RAYLIB_LIB="build/vendor/raylib-build/raylib/libraylib.a"

if [ ! -f "$RAYLIB_LIB" ]; then
    echo "Error: Raylib library not found. Run ./setup-raylib.sh first"
    exit 1
fi

nim c \
    --passL:"$RAYLIB_LIB" \
    --passL:"-lm -lpthread -ldl -lrt" \
    --passL:"-lX11" \
    "$EXAMPLE_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "Build successful!"
    echo "Run with: ./examples/${EXAMPLE_NAME}"
else
    echo ""
    echo "Build failed!"
    exit 1
fi
