# Gist Test Demo

This demonstrates loading markdown from a GitHub Gist!

```nim on:init
print("=== Loaded from GitHub Gist! ===")
print("This markdown was fetched dynamically")
```

```nim on:render
clear()
clearFg()

# Purple gradient background
setColor(40, 0, 60)
fillRect(0, 0, width, height)

# Animated star pattern
var time = frameCount / 60.0
for i in 0 .. 19:
  var angle = (i / 20.0) * 6.28 + time
  var radius = 200.0 + sin(time * 2.0 + i) * 50.0
  var starX = width / 2 + int(cos(angle) * radius)
  var starY = height / 2 + int(sin(angle) * radius)
  
  # Twinkling stars
  var brightness = int((sin(time * 3.0 + i) * 0.5 + 0.5) * 255.0)
  setColor(brightness, brightness, 255)
  fillCircle(starX, starY, 8)

# Center text
setColor(255, 255, 0)
drawText(width / 2 - 150, height / 2 - 20, "LOADED FROM GIST!", 32)

# Instructions
setColor(150, 255, 150)
drawText(width / 2 - 200, height / 2 + 30, "Try: ?gist=YOUR_GIST_ID", 16)
```
