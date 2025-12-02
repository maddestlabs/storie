# Test Demo - Custom Markdown

This is a test to verify custom markdown loading works!

```nim on:init
print("=== Custom Markdown Loaded! ===")
print("This is from test_demo.md")
```

```nim on:render
# Simple bouncing ball demo
clear()
clearFg()

# Dark background
setColor(20, 20, 40)
fillRect(0, 0, width, height)

# Bouncing ball
var time = frameCount / 60.0
var ballX = width / 2 + int(sin(time * 3.0) * 300.0)
var ballY = height / 2 + int(cos(time * 2.0) * 200.0)

# Rainbow ball
var hue = (frameCount % 180) / 180.0
var r = int(sin(hue * 6.28) * 127.5 + 127.5)
var g = int(sin((hue + 0.333) * 6.28) * 127.5 + 127.5)
var b = int(sin((hue + 0.666) * 6.28) * 127.5 + 127.5)

setColor(r, g, b)
fillCircle(ballX, ballY, 50)

# White outline
setColor(255, 255, 255)
drawCircle(ballX, ballY, 50, 3)

# Title
setColor(255, 255, 100)
drawText(10, 10, "CUSTOM MARKDOWN DEMO", 20)

# Info
setColor(200, 200, 200)
drawText(10, height - 30, "Loaded from: test_demo.md", 14)
```
