# Happy Birthday Destiny! 🎂

A magical birthday animation with falling snow and an interactive present!

```nim on:init
var presentOpened = false
var openProgress = 0.0
var confettiStartFrame = 0
```

```nim on:render
clear()
clearFg()

# Magical gradient background (dark blue to purple)
var y = 0
while y < height:
  var ratio = float(y) / float(height)
  var r = int(20.0 + ratio * 40.0)
  var g = int(20.0 + ratio * 20.0)
  var b = int(60.0 + ratio * 80.0)
  setColor(r, g, b)
  fillRect(0, y, width, 1)
  y = y + 1

# Draw snowflakes (procedurally generated each frame)
var i = 0
while i < 80:
  var time = frameCount / 60.0
  var baseX = float(i * width) / 80.0
  var x = baseX + sin(time * 0.5 + float(i)) * 30.0
  var y = float((frameCount * (i mod 3 + 1) + i * 97) mod height)
  var size = 1.0 + float((i * 37) mod 10) / 10.0
  
  # Draw snowflake with slight glow
  setColor(255, 255, 255, 180)
  fillCircle(int(x), int(y), int(size))
  setColor(200, 220, 255, 100)
  fillCircle(int(x), int(y), int(size) + 1)
  i = i + 1

# Present position (center of screen)
var presentX = width / 2
var presentY = height / 2

# Get mouse position
var mouseX = getMouseX()
var mouseY = getMouseY()

# Check if present was clicked
var leftPressed = isMouseButtonPressed(0)
if leftPressed:
  var dx = mouseX - presentX
  var dy = mouseY - presentY
  var inBounds = dx > -60 and dx < 60 and dy > -60 and dy < 60
  if inBounds:
    if not presentOpened:
      presentOpened = true
      confettiStartFrame = frameCount

# Animate opening
if presentOpened:
  if openProgress < 1.0:
    openProgress = openProgress + 0.02
    if openProgress > 1.0:
      openProgress = 1.0

# Draw present
if openProgress < 1.0:
  # Present box (pink/magenta)
  setColor(255, 100, 180)
  fillRect(presentX - 55, presentY - 45, 110, 90)
  
  # Present ribbon (gold)
  setColor(255, 215, 0)
  fillRect(presentX - 55, presentY - 5, 110, 10)
  fillRect(presentX - 5, presentY - 45, 10, 90)
  
  # Present bow (animated)
  var bowBounce = sin(frameCount / 10.0) * 2.0
  setColor(255, 215, 0)
  fillCircle(presentX - 20, presentY + int(bowBounce), 12)
  fillCircle(presentX + 20, presentY + int(bowBounce), 12)
  fillCircle(presentX, presentY - 8 + int(bowBounce), 14)

# Opening animation
if presentOpened:
  var lidY = presentY - 40 - int(openProgress * 100.0)
  
  # Calculate fade out alpha (lid disappears as it opens)
  var lidAlpha = 255 - int(openProgress * 255.0)
  if lidAlpha < 0:
    lidAlpha = 0
  
  # Opening present lid (fades out)
  if lidAlpha > 0:
    setColor(255, 100, 180, lidAlpha)
    fillRect(presentX - 50, lidY, 100, 40)
    setColor(255, 215, 0, lidAlpha)
    fillRect(presentX - 55, lidY + 35, 110, 10)
  
  # Procedural confetti with physics
  var confettiTime = frameCount - confettiStartFrame
  if confettiTime < 200:
    var confettiI = 0
    while confettiI < 30:
      # Procedural physics calculation
      var angle = float(confettiI) * 0.209 + float(confettiI * 17) / 10.0
      var speed = 3.0 + float((confettiI * 13) mod 40) / 10.0
      var initialVX = cos(angle) * speed
      var initialVY = sin(angle) * speed - 4.0
      
      # Apply physics over time
      var t = float(confettiTime)
      var cx = float(presentX) + initialVX * t
      var cy = float(presentY) + initialVY * t + 0.15 * t * t / 2.0
      
      # Only draw if on screen
      var cxi = int(cx)
      var cyi = int(cy)
      if cyi < height and cxi > 0 and cxi < width and cyi > 0:
        var colorChoice = confettiI mod 5
        if colorChoice == 0:
          setColor(255, 100, 100)
        if colorChoice == 1:
          setColor(100, 255, 100)
        if colorChoice == 2:
          setColor(100, 100, 255)
        if colorChoice == 3:
          setColor(255, 255, 100)
        if colorChoice == 4:
          setColor(255, 100, 255)
        
        # Draw confetti piece
        var size = 4
        fillRect(cxi - size, cyi - size, size * 2, size * 2)
      
      confettiI = confettiI + 1
  
  # Birthday message appears
  if openProgress > 0.8:
    var messageAlpha = int((openProgress - 0.8) * 5.0 * 255.0)
    if messageAlpha > 255:
      messageAlpha = 255
    
    # Centered "Happy Birthday"
    setColor(255, 215, 0, messageAlpha)
    var happyText = "Happy Birthday"
    var happyWidth = 220  # Approximate width for size 32
    drawText(presentX - happyWidth / 2, presentY - 180, happyText, 32)
    
    # Centered "Destiny!"
    setColor(255, 100, 180, messageAlpha)
    var destinyText = "Destiny!"
    var destinyWidth = 140  # Approximate width for size 36
    drawText(presentX - destinyWidth / 2, presentY - 140, destinyText, 36)
    
    # Sparkles around text
    var sparkleI = 0
    while sparkleI < 12:
      var angle = float(sparkleI) * 0.524 + float(frameCount) / 20.0
      var dist = 160.0 + sin(float(frameCount + sparkleI * 10) / 10.0) * 20.0
      var sx = presentX + int(cos(angle) * dist)
      var sy = presentY - 150 + int(sin(angle) * dist)
      var sparkleSize = int(3.0 + sin(float(frameCount + sparkleI * 5) / 5.0) * 2.0)
      setColor(255, 255, 200, messageAlpha)
      fillCircle(sx, sy, sparkleSize)
      sparkleI = sparkleI + 1

# Instruction text (only before opening)
var notOpened = not presentOpened
if notOpened:
  var bounce = sin(frameCount / 20.0) * 5.0
  setColor(255, 255, 255)
  var instructionText = "Tap to open!"
  var instructionWidth = 140  # Approximate width for size 24
  drawText(presentX - instructionWidth / 2, presentY + 150 + int(bounce), instructionText, 24)

# Bottom sparkle line
var sparkBottomI = 0
while sparkBottomI < 30:
  var sparkX = (sparkBottomI * width) / 30 + int(sin(float(frameCount + sparkBottomI * 10) / 10.0) * 10.0)
  var sparkY = height - 30 + int(sin(float(frameCount + sparkBottomI * 15) / 8.0) * 5.0)
  var brightness = int(sin(float(frameCount + sparkBottomI * 20) / 6.0) * 100.0 + 155.0)
  setColor(brightness, brightness, 255)
  # fillCircle(sparkX, sparkY, 2)
  sparkBottomI = sparkBottomI + 1
```
