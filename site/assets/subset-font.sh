#!/bin/bash
# Font Subsetting Helper for TStorie
# Creates optimized font subsets from Iosevka or other TTF fonts

set -e

VERSION="1.0.0"

show_help() {
    cat << 'EOF'
Font Subsetting Helper v1.0.0
Create optimized font subsets for TStorie

Usage: ./subset-font.sh [OPTIONS] INPUT_FONT

Arguments:
  INPUT_FONT            Path to the input font file (ttf, woff, or woff2)

Options:
  -h, --help            Show this help message
  -o, --output FILE     Output file name (default: input-Subset.ttf)
  -p, --preset NAME     Preset configuration:
                          ascii      - Basic ASCII only (U+0020-007E) ~10KB
                          latin      - ASCII + Latin-1 (U+0020-00FF) ~15KB
                          code       - Programming chars + box drawing ~20KB
                          extended   - Code + powerline + icons ~50KB
                          full       - No subsetting (optimize only)
  -u, --unicodes RANGE  Custom Unicode range (e.g., "U+0020-007E,U+2500-257F")
  -f, --format FORMAT   Output format: ttf, woff, woff2 (default: ttf)
  -c, --compress        Use Brotli compression (for WOFF2)
  -w, --weight WEIGHT   Extract single weight from variable font (e.g., "Regular", "Medium", "Bold")
  --no-layout           Remove layout features (reduces size)
  --no-hinting          Remove hinting data

Examples:
  # Create ASCII-only subset
  ./subset-font.sh IosevkaTerm-Regular.ttf --preset ascii

  # Create programming-optimized subset
  ./subset-font.sh IosevkaTerm-Regular.ttf --preset code -o startup-font.ttf

  # Custom Unicode range
  ./subset-font.sh MyFont.ttf -u "U+0020-007E,U+00A0-00FF" -f woff2

  # Full font with optimization only
  ./subset-font.sh IosevkaTerm-Regular.ttf --preset full -o optimized.ttf

  # Extract Medium weight from variable font
  ./subset-font.sh MonaspaceKrypton.ttf --weight Medium --preset ascii -o krypton-medium.ttf

  # Convert WOFF to TTF while subsetting
  ./subset-font.sh MonaspaceXenon-Light.woff --preset ascii -o xenon-light.ttf

Requirements:
  - Python 3
  - fonttools: pip install fonttools brotli zopfli

EOF
}

# Default values
OUTPUT=""
PRESET="code"
CUSTOM_UNICODES=""
FORMAT="ttf"
COMPRESS=false
NO_LAYOUT=false
NO_HINTING=false
WEIGHT=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -o|--output)
            OUTPUT="$2"
            shift 2
            ;;
        -p|--preset)
            PRESET="$2"
            shift 2
            ;;
        -u|--unicodes)
            CUSTOM_UNICODES="$2"
            shift 2
            ;;
        -f|--format)
            FORMAT="$2"
            shift 2
            ;;
        -c|--compress)
            COMPRESS=true
            shift
            ;;
        -w|--weight)
            WEIGHT="$2"
            shift 2
            ;;
        --no-layout)
            NO_LAYOUT=true
            shift
            ;;
        --no-hinting)
            NO_HINTING=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            INPUT_FONT="$1"
            shift
            ;;
    esac
done

# Validate input
if [ -z "$INPUT_FONT" ]; then
    echo "Error: No input font specified"
    echo "Use --help for usage information"
    exit 1
fi

if [ ! -f "$INPUT_FONT" ]; then
    echo "Error: Font file not found: $INPUT_FONT"
    exit 1
fi

# Check for pyftsubset
if ! command -v pyftsubset &> /dev/null; then
    echo "Error: pyftsubset not found!"
    echo ""
    echo "Please install fonttools:"
    echo "  pip install fonttools brotli zopfli"
    exit 1
fi

# Generate output filename
if [ -z "$OUTPUT" ]; then
    BASENAME=$(basename "$INPUT_FONT")
    # Remove extension (.ttf, .woff, .woff2)
    BASENAME="${BASENAME%.*}"
    OUTPUT="${BASENAME}-Subset.${FORMAT}"
fi

# Unicode ranges by preset
case $PRESET in
    ascii)
        UNICODE_RANGE="U+0020-007E"
        echo "📦 Creating ASCII-only subset (~10KB)"
        ;;
    latin)
        UNICODE_RANGE="U+0020-007E,U+00A0-00FF"
        echo "📦 Creating Latin subset (~15KB)"
        ;;
    code)
        # ASCII + Latin-1 + Box Drawing + Block Elements + Powerline
        UNICODE_RANGE="U+0020-007E,U+00A0-00FF,U+2500-257F,U+2580-259F,U+E0A0-E0A3,U+E0B0-E0C8"
        echo "📦 Creating programming subset (~20KB)"
        ;;
    extended)
        # Code + common programming icons + math symbols
        UNICODE_RANGE="U+0020-007E,U+00A0-00FF,U+2190-21FF,U+2200-22FF,U+2500-257F,U+2580-259F,U+25A0-25FF,U+2600-26FF,U+E0A0-E0A3,U+E0B0-E0C8,U+E0D0-E0D4,U+F000-F2FF"
        echo "📦 Creating extended subset (~50KB)"
        ;;
    full)
        UNICODE_RANGE="*"
        echo "📦 Optimizing full font (no subsetting)"
        ;;
    *)
        echo "Error: Unknown preset: $PRESET"
        echo "Valid presets: ascii, latin, code, extended, full"
        exit 1
        ;;
esac

# Use custom unicodes if provided
if [ -n "$CUSTOM_UNICODES" ]; then
    UNICODE_RANGE="$CUSTOM_UNICODES"
    echo "📦 Using custom Unicode range: $UNICODE_RANGE"
fi

# Build pyftsubset command
CMD="pyftsubset \"$INPUT_FONT\" --output-file=\"$OUTPUT\""

# Add Unicode range
CMD="$CMD --unicodes=\"$UNICODE_RANGE\""

# Note: Weight extraction from variable fonts is not supported in this version
# Variable fonts will be subset with all weights intact
if [ -n "$WEIGHT" ]; then
    echo "Note: Weight parameter ignored - variable fonts are subset with all weights"
fi

# Layout features
if [ "$NO_LAYOUT" = true ]; then
    CMD="$CMD --layout-features=\"\""
else
    CMD="$CMD --layout-features=\"*\""
fi

# Hinting
if [ "$NO_HINTING" = true ]; then
    CMD="$CMD --no-hinting --desubroutinize"
fi

# Format-specific options
case $FORMAT in
    woff)
        CMD="$CMD --flavor=woff"
        ;;
    woff2)
        CMD="$CMD --flavor=woff2"
        if [ "$COMPRESS" = true ]; then
            CMD="$CMD --with-zopfli"
        fi
        ;;
    ttf)
        # TTF is default, no flavor needed
        ;;
    *)
        echo "Error: Unknown format: $FORMAT"
        echo "Valid formats: ttf, woff, woff2"
        exit 1
        ;;
esac

# Show command
echo ""
echo "Running:"
echo "$CMD"
echo ""

# Execute
eval $CMD

# Show results
if [ -f "$OUTPUT" ]; then
    INPUT_SIZE=$(stat -f%z "$INPUT_FONT" 2>/dev/null || stat -c%s "$INPUT_FONT" 2>/dev/null)
    OUTPUT_SIZE=$(stat -f%z "$OUTPUT" 2>/dev/null || stat -c%s "$OUTPUT" 2>/dev/null)
    
    INPUT_KB=$((INPUT_SIZE / 1024))
    OUTPUT_KB=$((OUTPUT_SIZE / 1024))
    REDUCTION=$(( (INPUT_SIZE - OUTPUT_SIZE) * 100 / INPUT_SIZE ))
    
    echo "✅ Success!"
    echo ""
    echo "Input:  $(basename "$INPUT_FONT") - ${INPUT_KB} KB"
    echo "Output: $(basename "$OUTPUT") - ${OUTPUT_KB} KB"
    echo "Reduction: ${REDUCTION}%"
    echo ""
    echo "📍 Output file: $OUTPUT"
    
    # Usage instructions
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📖 Usage Instructions"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "1. Copy the font to assets directory:"
    echo "   cp \"$OUTPUT\" docs/assets/"
    echo ""
    echo "2. Update build script (build-modular.sh or build-webgpu.sh):"
    echo "   --passL:\"--preload-file\" --passL:\"docs/assets/$(basename "$OUTPUT")@/fonts/startup-font.ttf\" \\"
    echo ""
    echo "3. Update backends/sdl3/sdl_canvas.nim (line ~125):"
    echo "   result.font = TTF_OpenFont(\"/fonts/startup-font.ttf\", 16.0)"
    echo ""
    echo "4. (Optional) Create full font for progressive loading:"
    echo "   ./subset-font.sh \"$INPUT_FONT\" --preset full -o IosevkaTerm-Full.ttf"
    echo "   Then update progressive_font_loader.js to use it"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "❌ Error: Subsetting failed"
    exit 1
fi
