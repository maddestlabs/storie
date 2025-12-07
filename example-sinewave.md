# Storie Audio Example - Sine Wave Generator

Interactive sine wave audio generator with visual waveform display.
Click and drag to change frequency and pan the audio.

```nim on:init
print("=== Storie Audio Example - Sine Wave ===")
print("Click and drag to change frequency and pan")

# Audio parameters
var frequency: float32 = 440.0  # Cycles per second (Hz)
var audioFrequency: float32 = 440.0  # Smoothed audio frequency
var sineIdx: float32 = 0.0  # Phase accumulator for sine wave

# Waveform buffer for visualization
const MaxSamples = 512
var waveLength = int(22050.0 / frequency)
if waveLength > MaxSamples div 2:
  waveLength = MaxSamples div 2
if waveLength < 1:
  waveLength = 1

# Initialize waveform data as a sequence (Nimini compatible)
var waveformData = newSeq[int16](MaxSamples)
for i in 0..<waveLength * 2:
  waveformData[i] = int16(sin(2.0 * PI * float(i) / float(waveLength)) * 32000.0)

# Clear the rest
for j in waveLength * 2..<MaxSamples:
  waveformData[j] = 0

# Audio callback function
proc audioCallback(buffer: pointer, frames: uint32) =
  # Smooth frequency changes
  audioFrequency = frequency + (audioFrequency - frequency) * 0.95
  
  let incr = audioFrequency / 44100.0
  let samples = cast[ptr UncheckedArray[int16]](buffer)
  
  for i in 0..<frames:
    samples[i] = int16(32000.0 * sin(2.0 * PI * sineIdx))
    sineIdx += incr
    if sineIdx > 1.0:
      sineIdx -= 1.0

# Initialize audio stream
initAudio()
var audioStream = createAudioStream(44100, 16, 1)
setAudioCallback(audioStream, audioCallback)
playAudioStream(audioStream)

print("Audio initialized - 44100Hz, 16-bit, mono")
```

```nim on:render
# Clear screen
clear()
setColor(245, 245, 245)  # RayWhite background
fillRect(0, 0, width, height)

# Get mouse input
var mouseX = getMouseX()
var mouseY = getMouseY()
var mouseDown = isMouseButtonDown(0)  # Left button

# Update frequency based on mouse position
if mouseDown:
  # Frequency from mouse Y position (40 Hz to 490 Hz)
  frequency = 40.0 + mouseY
  
  # Pan from mouse X position (0.0 to 1.0)
  var pan = float(mouseX) / float(width)
  if pan < 0.0: pan = 0.0
  if pan > 1.0: pan = 1.0
  setAudioPan(audioStream, pan)
  
  # Update waveform visualization
  var waveLength = int(22050.0 / frequency)
  if waveLength > MaxSamples div 2:
    waveLength = MaxSamples div 2
  if waveLength < 1:
    waveLength = 1
  
  for i in 0..<waveLength * 2:
    waveformData[i] = int16(sin(2.0 * PI * float(i) / float(waveLength)) * 32000.0)
  
  for j in waveLength * 2..<MaxSamples:
    waveformData[j] = 0

# Draw instructions
setColor(80, 80, 80)  # DarkGray
drawText(10, 10, "click mouse button to change frequency or pan", 20)

# Draw frequency display
setColor(230, 41, 55)  # Red
var freqText = "sine frequency: " & $int(frequency)
drawText(width - 220, 10, freqText, 20)

# Draw waveform visualization
setColor(230, 41, 55)  # Red
var prevX = 0
var prevY = 250 + int(50.0 * float(waveformData[0]) / 32000.0)

for i in 1..<width:
  var sampleIdx = i * MaxSamples div width
  if sampleIdx >= MaxSamples:
    sampleIdx = MaxSamples - 1
  
  var x = i
  var y = 250 + int(50.0 * float(waveformData[sampleIdx]) / 32000.0)
  
  # Draw line from previous point to current point for smoother waveform
  drawLine(prevX, prevY, x, y, 1)
  
  prevX = x
  prevY = y

# Draw center line for reference
setColor(200, 200, 200)
drawLine(0, 250, width, 250, 1)

# Draw frequency range indicator
setColor(150, 150, 150)
drawText(10, 240, "40 Hz", 12)
drawText(10, height - 220, "490 Hz", 12)

# Draw pan indicator
if mouseDown:
  setColor(100, 100, 255)
  var panPercent = int((float(mouseX) / float(width)) * 100.0)
  var panText = "Pan: " & $panPercent & "%"
  drawText(width div 2 - 50, height - 30, panText, 16)
  
  # Draw pan position indicator
  setColor(255, 100, 100)
  fillCircle(mouseX, height - 50, 8)

# Draw status info
setColor(100, 100, 100)
var statusText = "Frame: " & $frameCount & " | Audio Freq: " & $int(audioFrequency) & " Hz"
drawText(10, height - 30, statusText, 12)
```

```nim on:cleanup
# Stop and cleanup audio
stopAudioStream(audioStream)
closeAudioStream(audioStream)
closeAudio()
print("Audio cleanup complete")
```
