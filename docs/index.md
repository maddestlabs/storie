# Storie SDL3 Demo

Modern pixel-based graphics demo showcasing shapes, colors, and animation.

```nim on:init
print("=== Storie SDL3 Initialized ===")
print("Display size: " & $width & " x " & $height & " pixels")
```

```nim on:render
# Clear both layers
clear()
clearFg()

# Fill background with a dark blue gradient
setColor(0, 0, 60)
fillRect(0, 0, width, height)

# Draw animated bouncing box in the center
var time = frameCount / 60.0
var boxWidth = 200
var boxHeight = 100
var centerX = width / 2 - boxWidth / 2
var centerY = height / 2 - boxHeight / 2

# Animate position with sine wave
var offsetX = int(sin(time * 2.0) * 150.0)
var offsetY = int(cos(time * 1.5) * 80.0)

var boxX = centerX + offsetX
var boxY = centerY + offsetY

# Animate color (cycle through hues)
var hue = (frameCount % 360) / 360.0
var r = int(sin(hue * 6.28) * 127.5 + 127.5)
var g = int(sin((hue + 0.333) * 6.28) * 127.5 + 127.5)
var b = int(sin((hue + 0.666) * 6.28) * 127.5 + 127.5)

# Draw filled rectangle with animated color
setColor(r, g, b)
fillRect(boxX, boxY, boxWidth, boxHeight)

# Draw white border around the box
setColor(255, 255, 255)
drawRect(boxX, boxY, boxWidth, boxHeight, 3)

# Draw text in the box center
var label = "STORIE SDL3"
var labelX = boxX + boxWidth / 2 - 50
var labelY = boxY + boxHeight / 2 - 8
setColor(255, 255, 255)
drawText(labelX, labelY, label, 24)

# Draw some decorative circles
for i in 0 .. 4:
  var angle = time * 2.0 + i * 1.256
  var circleX = width / 2 + int(cos(angle) * 250.0)
  var circleY = height / 2 + int(sin(angle) * 250.0)
  var circleHue = (i * 72) / 360.0
  var cr = int(sin(circleHue * 6.28) * 127.5 + 127.5)
  var cg = int(sin((circleHue + 0.333) * 6.28) * 127.5 + 127.5)
  var cb = int(sin((circleHue + 0.666) * 6.28) * 127.5 + 127.5)
  setColor(cr, cg, cb)
  fillCircle(circleX, circleY, 30)

# Display info at top
setColor(255, 255, 0)
var info = "Frame: " & $frameCount & " | FPS: " & $fps & " | " & $width & "x" & $height & "px"
drawText(10, 10, info, 16)

# Instructions at bottom
setColor(200, 200, 200)
var instructions = "Press ESC to quit • Pixel-based rendering"
drawText(width / 2 - 150, height - 30, instructions, 14)
```
