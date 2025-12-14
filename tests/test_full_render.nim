import nimini/tokenizer
import nimini/parser
import strutils

# Extract just the second code block from audio_slider.md
let fullRenderBlock = """
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

for i in 0..<samplesToGenerate:
  # Generate sine wave sample
  var sample = sin(phase) * amplitude * volume
  
  # Store as stereo (left and right channels)
  var bufIdx1 = i * 2
  var bufIdx2 = bufIdx1 + 1
  audioBuffer[bufIdx1] = sample
  audioBuffer[bufIdx2] = sample
  
  # Advance phase
  var phaseInc = frequency * 2.0 * 3.14159265358979323846 / float(sampleRate)
  phase = phase + phaseInc
  
  # Keep phase in range to prevent overflow
  if phase > 6.28318530717958647692:
    var twoPi = 6.28318530717958647692
    phase = phase - twoPi

# Queue audio samples
queueAudio(audioBuffer)

# Waveform visualization
var waveYCenter = (height / 2) - 80
var waveHeight = 60
var waveWidth = 400
var waveHalfWidth = waveWidth / 2
var waveX = (width / 2) - waveHalfWidth
var waveHalfHeight = waveHeight / 2
var waveY = waveYCenter - waveHalfHeight

# Waveform background
setColor(30, 30, 40)
fillRect(waveX, waveY, waveWidth, waveHeight)

# Draw center line
setColor(80, 80, 100)
var waveEndX = waveX + waveWidth
drawLine(waveX, waveYCenter, waveEndX, waveYCenter, 1)

# Draw waveform
setColor(100, 200, 255)
var samplesPerPixel = 10
var prevY = waveYCenter
for x in 0..<waveWidth:
  var sampleIdx = (x * samplesPerPixel) % samplesToGenerate
  var sampleIndex = sampleIdx * 2
  var sample = audioBuffer[sampleIndex]
  var sampleOffset = sample * float(waveHalfHeight)
  var y = waveYCenter - int(sampleOffset)
  
  if x > 0:
    var lineX1 = waveX + x - 1
    var lineX2 = waveX + x
    drawLine(lineX1, prevY, lineX2, y, 2)
  
  prevY = y

# Info
setColor(150, 150, 150)
var infoY1 = height - 40
var infoY2 = height - 20
var quitTextX = width - 180
drawText(10, infoY1, "Frame: " & $frameCount, 12)
drawText(10, infoY2, "Audio Buffer: " & $samplesToGenerate & " samples", 12)
drawText(quitTextX, infoY2, "Press ESC to quit", 12)
"""

echo "Testing full render block..."

let lines = fullRenderBlock.split('\n')
echo "Code at lines 94-98:"
for i in 94..98:
  echo "Line ", i, ": ", lines[i-1]

echo ""
let tokens = tokenizeDsl(fullRenderBlock)
echo "Tokens: ", tokens.len
echo ""

# Find tokens around line 96
echo "Tokens at line 96:"
for i, tok in tokens:
  if tok.line == 96:
    echo "  ", i, ": ", tok

echo ""
echo "Now attempting to parse..."
let program = parseDsl(tokens)
echo "SUCCESS! Parsed correctly"
