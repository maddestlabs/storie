#!/bin/bash
# Backstorie compiler script - compile and run with custom file support

VERSION="0.1.0"

show_help() {
    cat << EOF
backstorie v$VERSION
Terminal engine with sophisticated input parsing

Usage: ./compile.sh [OPTIONS] [FILE]

Arguments:
  FILE                   Nim file to run (default: index.nim)
                        Can be specified with or without .nim extension

Options:
  -h, --help            Show this help message
  -v, --version         Show version information
  -r, --release         Compile in release mode (optimized)
  -c, --compile-only    Compile without running

Examples:
  ./compile.sh                           # Run index.nim
  ./compile.sh example_boxes             # Run example_boxes.nim
  ./compile.sh plugins/simple_counter    # Run plugins/simple_counter.nim
  ./compile.sh -r example_boxes          # Compile optimized and run
  ./compile.sh -c example_boxes          # Compile only, don't run

EOF
}

RELEASE_MODE=""
COMPILE_ONLY=false
USER_FILE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -v|--version)
            echo "backstorie version $VERSION"
            exit 0
            ;;
        -r|--release)
            RELEASE_MODE="-d:release"
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
            if [ -z "$USER_FILE" ]; then
                USER_FILE="$1"
            else
                echo "Error: Multiple files specified. Only one file can be run at a time."
                exit 1
            fi
            shift
            ;;
    esac
done

# Determine file to use
if [ -z "$USER_FILE" ]; then
    FILE_BASE="index"
else
    # Remove .nim extension if provided
    FILE_BASE="${USER_FILE%.nim}"
fi

# Check if file exists, try examples/ directory if not found in current location
if [ ! -f "${FILE_BASE}.nim" ]; then
    if [ ! -z "$USER_FILE" ] && [ -f "examples/${FILE_BASE}.nim" ]; then
        FILE_BASE="examples/${FILE_BASE}"
        echo "Found file in examples directory: ${FILE_BASE}.nim"
    else
        echo "Error: File not found: ${FILE_BASE}.nim"
        if [ -z "$USER_FILE" ]; then
            echo "Hint: Create an index.nim file or specify a different file to run"
        else
            echo "Hint: File not found in current directory or examples/ directory"
        fi
        exit 1
    fi
fi

# Compile with userFile define
echo "Compiling backstorie with ${FILE_BASE}.nim..."
nim c $RELEASE_MODE -d:userFile="$FILE_BASE" backstorie.nim || \
  (echo "Compilation failed. Make sure ${FILE_BASE}.nim is added to the include list in backstorie.nim" && exit 1)

if [ $? -ne 0 ]; then
    echo "Compilation failed!"
    exit 1
fi

# Run if not compile-only
if [ "$COMPILE_ONLY" = false ]; then
    echo "Running backstorie..."
    echo ""
    ./backstorie "$@"
else
    echo "Compilation successful!"
    echo "Run with: ./backstorie"
fi
