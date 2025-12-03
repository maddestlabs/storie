#!/bin/bash
# Storie WASM compiler script
# Compiles storie.nim to WebAssembly using Emscripten's SDL3

set -e

VERSION="0.1.0"
OUTPUT_DIR="docs"
FILE_BASE="storie"

show_help() {
    cat << EOF
Storie WASM compiler v$VERSION
Compile Storie for web deployment

Usage: ./build-web.sh [OPTIONS]

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -r, --release         Compile in release mode (optimized)
  -s, --serve           Start a local web server after compilation
  -o, --output DIR      Output directory (default: docs)

Examples:
  ./build-web.sh                # Compile to docs/
  ./build-web.sh -r             # Compile optimized
  ./build-web.sh -s             # Compile and serve
  ./build-web.sh -o web         # Output to web/ directory

The compiled files will be placed in the specified output directory.

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

RELEASE_MODE=""
SERVE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "Storie WASM compiler version $VERSION"
            exit 0
            ;;
        -r|--release)
            RELEASE_MODE="-d:release --opt:size"
            shift
            ;;
        -s|--serve)
            SERVE=true
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

echo "Compiling Storie to WASM..."
echo "Output directory: $OUTPUT_DIR"
echo ""

# Nim compiler options for Emscripten
NIM_OPTS="c
  --cpu:wasm32
  --os:linux
  --cc:clang
  --clang.exe:emcc
  --clang.linkerexe:emcc
  --clang.cpp.exe:emcc
  --clang.cpp.linkerexe:emcc
  -d:emscripten
  -d:noSignalHandler
  --threads:off
  --exceptions:goto
  $RELEASE_MODE
  --nimcache:nimcache_wasm
  -o:$OUTPUT_DIR/storie.js
  ${FILE_BASE}.nim"

# Emscripten flags - Link against SDL3 and SDL3_ttf built with CMake
# Optional: Preload font assets for TTF rendering (comment out to load fonts at runtime via fetch)
# Note: Runtime loading requires setting up FS and fetching fonts via JavaScript
export EMCC_CFLAGS="-s ALLOW_MEMORY_GROWTH=1 \
  -s INITIAL_MEMORY=67108864 \
  -s STACK_SIZE=8388608 \
  -s ENVIRONMENT=web \
  -s MODULARIZE=0 \
  -s EXPORT_NAME='Module' \
  -s ASSERTIONS=1 \
  --preload-file docs/assets@/assets \
  -s EXPORTED_RUNTIME_METHODS=['ccall','cwrap','UTF8ToString','FS']"

# Additional optimization flags for release mode
if [ ! -z "$RELEASE_MODE" ]; then
    export EMCC_CFLAGS="$EMCC_CFLAGS -Oz -s ASSERTIONS=0"
fi

# Compile
echo "Running Nim compiler with Emscripten..."
echo "  Input: ${FILE_BASE}.nim"
echo "  Output: $OUTPUT_DIR/storie.js"
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
echo "  - $OUTPUT_DIR/storie.js"
echo "  - $OUTPUT_DIR/storie.wasm"
echo ""

# Create a minimal HTML file if it doesn't exist
if [ ! -f "$OUTPUT_DIR/index.html" ]; then
    cat > "$OUTPUT_DIR/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Storie</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #000;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            font-family: monospace;
            color: #fff;
        }
        #container {
            text-align: center;
        }
        #canvas {
            border: 1px solid #333;
            image-rendering: pixelated;
            image-rendering: crisp-edges;
        }
        #status {
            margin-top: 10px;
            font-size: 12px;
            color: #888;
        }
        .error {
            color: #f44;
        }
    </style>
</head>
<body>
    <div id="container">
        <canvas id="canvas" width="800" height="600"></canvas>
        <div id="status">Loading...</div>
    </div>
    
    <script>
        var Module = {
            canvas: document.getElementById('canvas'),
            printErr: function(text) {
                console.error(text);
                document.getElementById('status').innerHTML = '<span class="error">' + text + '</span>';
            },
            print: function(text) {
                console.log(text);
            },
            onRuntimeInitialized: function() {
                document.getElementById('status').textContent = 'Running - Press ESC to quit';
            }
        };
    </script>
    <script src="storie.js"></script>
</body>
</html>
HTMLEOF
    echo "  - $OUTPUT_DIR/index.html (created)"
fi

# Copy index.md if it exists (needed at runtime for WASM)
if [ -f "index.md" ]; then
    cp index.md "$OUTPUT_DIR/index.md"
    echo "  - $OUTPUT_DIR/index.md (markdown content)"
fi

echo ""
echo "Build complete!"

# Start web server if requested
if [ "$SERVE" = true ]; then
    echo ""
    echo "Starting local web server..."
    echo "Open http://localhost:8000 in your browser"
    echo "Press Ctrl+C to stop"
    echo ""
    
    # Try different server options
    if command -v python3 &> /dev/null; then
        cd "$OUTPUT_DIR" && python3 -m http.server 8000
    elif command -v python &> /dev/null; then
        cd "$OUTPUT_DIR" && python -m SimpleHTTPServer 8000
    elif command -v php &> /dev/null; then
        cd "$OUTPUT_DIR" && php -S localhost:8000
    else
        echo "Error: No web server available (tried python3, python, php)"
        echo "Please serve the $OUTPUT_DIR/ directory manually."
        exit 1
    fi
else
    echo ""
    echo "To test the build:"
    echo "  cd $OUTPUT_DIR && python3 -m http.server 8000"
    echo "  Then open http://localhost:8000 in your browser"
fi
