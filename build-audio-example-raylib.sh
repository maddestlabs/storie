#!/bin/bash
# Build audio example for raylib backend

set -e

echo "Building audio example (raylib backend)..."

# Ensure raylib is built
if [ ! -f "build/vendor/raylib-build/raylib/libraylib.a" ]; then
  echo "Raylib not found. Running setup script..."
  ./setup-raylib.sh
fi

nim c \
  -d:useRaylib \
  --path:. \
  --passL:"build/vendor/raylib-build/raylib/libraylib.a" \
  --outdir:build \
  examples/audio_unified_example.nim

echo "Build complete: build/audio_unified_example"
echo "Run with: ./build/audio_unified_example"
