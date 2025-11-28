# Storie Engine

Welcome to Storie! Edit this file to create your interactive terminal app.

``` nim on:render
# Clear the foreground layer each frame
fgClearTransparent()

# Center a welcome message
var msg = "Hello from Storie!"
var x = (termWidth - 19) / 2
var y = termHeight / 2
fgWriteText(x, y, msg)

# Draw a border using fillRect
bgClearTransparent()
bgFillRect(0, 0, termWidth, 1, "─")
bgFillRect(0, termHeight - 1, termWidth, 1, "─")

# Show FPS and frame counter in top-left
fgWriteText(2, 1, "FPS: " & $int(fps) & " | Frame: " & $frameCount)
```
