#!/bin/bash
# Font Switcher for TStorie WebGPU Build
# Usage: ./docs/assets/font.sh <path-to-font.ttf>

set -e

# Detect script location and change to project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

echo "Working directory: $PROJECT_ROOT"
echo ""

if [ $# -eq 0 ]; then
    echo "Usage: ./docs/assets/font.sh <path-to-font.ttf> [--weight WEIGHT]"
    echo ""
    echo "Example:"
    echo "  ./docs/assets/font.sh docs/assets/3270-Regular.ttf"
    echo "  ./docs/assets/font.sh \"docs/assets/Monaspace Radon Var.ttf\""
    echo "  ./docs/assets/font.sh MonaspaceKrypton.ttf --weight Medium"
    echo ""
    echo "This script will:"
    echo "  1. Subset the font (ASCII only for fast loading)"
    echo "  2. Update web/index.html"
    echo "  3. Update web/tstorie-webgl.js"
    echo "  4. Run build-webgpu.sh"
    echo "  5. Copy tstorie-webgl.js to docs/"
    exit 1
fi

FONT_PATH="$1"
shift

# Parse additional arguments (like --weight)
EXTRA_ARGS=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --weight|-w)
            EXTRA_ARGS="$EXTRA_ARGS --weight \"$2\""
            shift 2
            ;;
        *)
            EXTRA_ARGS="$EXTRA_ARGS $1"
            shift
            ;;
    esac
done

# If font path is relative and doesn't exist, try prefixing with docs/assets/
if [ ! -f "$FONT_PATH" ] && [[ "$FONT_PATH" != /* ]]; then
    if [ -f "docs/assets/$FONT_PATH" ]; then
        FONT_PATH="docs/assets/$FONT_PATH"
    fi
fi

# Check if font file exists
if [ ! -f "$FONT_PATH" ]; then
    echo "Error: Font file not found: $FONT_PATH"
    exit 1
fi

# Extract font name (basename without extension, lowercased, spaces to dashes)
FONT_BASENAME=$(basename "$FONT_PATH")
FONT_NAME="${FONT_BASENAME%.*}"
# Remove any existing -startup, -code, -full suffixes to avoid duplication
FONT_NAME=$(echo "$FONT_NAME" | sed -e 's/-startup$//' -e 's/-code$//' -e 's/-full$//')
FONT_NAME_NORMALIZED=$(echo "$FONT_NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔤 Font Switcher for TStorie WebGPU"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Input font:  $FONT_BASENAME"
echo "Font family: $FONT_NAME_NORMALIZED"
echo ""

# Step 1: Create subset
SUBSET_OUTPUT="docs/assets/${FONT_NAME_NORMALIZED}-startup.ttf"
echo "📦 Step 1/5: Creating ASCII subset..."
eval docs/assets/subset-font.sh \"$FONT_PATH\" --preset ascii -o \"$SUBSET_OUTPUT\" $EXTRA_ARGS

if [ ! -f "$SUBSET_OUTPUT" ]; then
    echo "Error: Subsetting failed"
    exit 1
fi

echo ""
echo "✓ Subset created: $SUBSET_OUTPUT"
echo ""

# Step 2: Update web/index.html @font-face
echo "📝 Step 2/5: Updating web/index.html..."

# Find the current @font-face block and replace it
FONT_FACE_REPLACEMENT="        @font-face {
            font-family: '$FONT_NAME_NORMALIZED';
            src: url('./assets/$(basename "$SUBSET_OUTPUT")') format('truetype');
            font-weight: normal;
            font-style: normal;
        }"

# Use sed to replace the @font-face block (between @font-face { and closing })
sed -i '/@font-face {/,/^        }/c\'"$(echo "$FONT_FACE_REPLACEMENT" | sed 's/$/\\n/' | tr -d '\n' | sed 's/\\n$//')" web/index.html

# Update font-family references in body
sed -i "s/font-family: '[^']*'/font-family: '$FONT_NAME_NORMALIZED'/g" web/index.html

echo "✓ Updated web/index.html"
echo ""

# Step 3: Update web/tstorie-webgl.js fontFamily
echo "📝 Step 3/5: Updating web/tstorie-webgl.js..."
sed -i "s/this\.fontFamily = fontFamily || \"'[^']*'/this.fontFamily = fontFamily || \"'$FONT_NAME_NORMALIZED'/g" web/tstorie-webgl.js
echo "✓ Updated web/tstorie-webgl.js"
echo ""

# Step 4: Run build-webgpu.sh
echo "🔨 Step 4/5: Running build-webgpu.sh..."
./build-webgpu.sh > /tmp/build-webgpu.log 2>&1

if [ $? -ne 0 ]; then
    echo "Error: Build failed. Check /tmp/build-webgpu.log"
    tail -20 /tmp/build-webgpu.log
    exit 1
fi

echo "✓ Build complete"
echo ""

# Step 5: Manually copy tstorie-webgl.js (build script doesn't overwrite existing files)
echo "📋 Step 5/5: Copying tstorie-webgl.js to docs/..."
cp web/tstorie-webgl.js docs/tstorie-webgl.js
echo "✓ Copied tstorie-webgl.js"
echo ""

# Verify the changes
CURRENT_FONT=$(grep "fontFamily = fontFamily" docs/tstorie-webgl.js | head -1)

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Font switch complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Active font: $FONT_NAME_NORMALIZED"
echo "Subset file: $(basename "$SUBSET_OUTPUT") ($(du -h "$SUBSET_OUTPUT" | cut -f1))"
echo ""
echo "Updated files:"
echo "  ✓ web/index.html"
echo "  ✓ web/tstorie-webgl.js"
echo "  ✓ docs/index-webgpu.html"
echo "  ✓ docs/tstorie-webgl.js"
echo ""
echo "Verification:"
echo "  $CURRENT_FONT"
echo ""
echo "🌐 Refresh your browser to see the new font!"
echo ""
