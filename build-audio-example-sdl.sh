#!/bin/bash
# Build audio example for SDL3 backend

set -e

echo "Building audio example (SDL3 backend)..."

nim c \
  -d:useSdl \
  --path:. \
  --passL:"-lSDL3" \
  --outdir:build \
  examples/audio_unified_example.nim

echo "Build complete: build/audio_unified_example"
echo "Run with: ./build/audio_unified_example"
