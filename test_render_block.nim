import src/nimini/tokenizer
import src/nimini/parser
import strutils

let renderCode = """
# Clear screen
clear()
clearFg()

# Background
setColor(25, 25, 35)
fillRect(0, 0, width, height)

# Title
setColor(100, 200, 255)
var titleX = (width / 2) - 180
drawText(titleX, 30, "AUDIO SINE WAVE GENERATOR", 24)

# Instructions
setColor(200, 200, 200)
var instX1 = (width / 2) - 150
var instX2 = (width / 2) - 100
drawText(instX1, 80, "Generating " & $int(frequency) & " Hz sine wave", 14)
drawText(instX2, 100, "Drag slider to adjust volume", 14)

# Volume slider
var sliderX = (width / 2) - 200
var sliderY = height / 2
var sliderWidth = 400
var sliderHeight = 20

# Slider background
setColor(60, 60, 80)
fillRect(sliderX, sliderY, sliderWidth, sliderHeight)

# Slider fill (current volume)
var fillWidth = int(volume * float(sliderWidth))
setColor(100, 200, 100)
fillRect(sliderX, sliderY, fillWidth, sliderHeight)

# Slider border
setColor(150, 150, 180)
drawRect(sliderX, sliderY, sliderWidth, sliderHeight, 2)

# Slider handle
var handleX = sliderX + fillWidth
var handleY = sliderY + (sliderHeight / 2)
setColor(255, 255, 255)
fillCircle(handleX, handleY, 12)
setColor(100, 100, 120)
drawCircle(handleX, handleY, 12, 2)

# Check for mouse interaction with slider
var mouseX = getMouseX()
var mouseY = getMouseY()
var mouseDown = isMouseButtonDown(0)

if mouseDown:
  var sliderTop = sliderY - 20
  var sliderBottom = sliderY + sliderHeight + 20
  var sliderRight = sliderX + sliderWidth
  
  if mouseY >= sliderTop and mouseY <= sliderBottom:
    if mouseX >= sliderX and mouseX <= sliderRight:
      var mouseOffset = mouseX - sliderX
      volume = float(mouseOffset) / float(sliderWidth)
      if volume < 0.0:
        volume = 0.0
      if volume > 1.0:
        volume = 1.0

# Display volume percentage
setColor(255, 255, 255)
var volumeText = "Volume: " & $int(volume * 100.0) & "%"
var volumeTextX = (width / 2) - 40
var volumeTextY = sliderY + 50
drawText(volumeTextX, volumeTextY, volumeText, 16)

# Volume bars visualization
var barCount = 20
var barWidth = 15
var barSpacing = 5
# Volume meter (simple horizontal bar)
setColor(100, 200, 100)
var meterY = (height / 2) + 100
var meterWidth = int(volume * 300.0)
fillRect(200, meterY, meterWidth, 30)

# Generate and queue audio samples
var samplesToGenerate = 2048
var samplesTimesTwo = samplesToGenerate * 2
var audioBuffer = newSeq[float](samplesTimesTwo)
"""

echo "Testing render block parsing..."
echo ""

try:
  let tokens = tokenizeDsl(renderCode)
  echo "Tokens: ", tokens.len
  echo ""
  
  let program = parseDsl(tokens)
  echo "SUCCESS! Parsed correctly"
except Exception as e:
  echo "ERROR: ", e.msg
  echo ""
  
  # Find problem line
  let lines = renderCode.split('\n')
  if "line" in e.msg:
    var lineNum = 0
    let parts = e.msg.split(" ")
    for j, part in parts:
      if part == "line" and j + 1 < parts.len:
        try:
          lineNum = parseInt(parts[j + 1])
        except:
          discard
    
    if lineNum > 0 and lineNum <= lines.len:
      echo "Problem around line ", lineNum, ":"
      echo "-".repeat(50)
      let startLine = max(1, lineNum - 3)
      let endLine = min(lines.len, lineNum + 3)
      
      for lineIdx in startLine..endLine:
        let marker = if lineIdx == lineNum: " >>> " else: "     "
        echo marker, lineIdx, ": ", lines[lineIdx - 1]
      echo "-".repeat(50)
