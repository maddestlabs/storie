#!/bin/bash
# Build script for raylib compatibility demo

set -e

echo "Building raylib compatibility demo..."
nim c --passL:"build/vendor/raylib-build/raylib/libraylib.a -lm" \
     examples/raylib_compat_demo.nim

echo "Build complete! Executable: examples/raylib_compat_demo"
echo ""
echo "To run (requires X11 display):"
echo "  ./examples/raylib_compat_demo"
