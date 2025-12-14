## Nimini Audio Example - Naylib-style
## Demonstrates audio programming similar to naylib examples

import ../nimini

const audioCode = """
# Audio configuration constants
const SampleRate: int = 44100
const BufferSize = 512
const Frequency: float = 440.0

# Audio buffer management
var audioBuffer = newSeq(BufferSize)
var bufferIndex: int = 0

# Initialize audio data
proc initAudio():
  print("Initializing audio system...")
  print("Sample rate:", SampleRate)
  print("Buffer size:", BufferSize)
  
  # Pre-fill buffer with zeros
  setLen(audioBuffer, BufferSize)
  for i in 0..<BufferSize:
    add(audioBuffer, 0)
  
  print("Audio system initialized")

# Generate sine wave sample
proc generateSample(phase: float): float:
  # Simplified sine wave: just return phase for demo
  return phase

# Audio callback (would be called by audio system)
proc audioCallback(outputBuffer: int, frameCount: int): int {.cdecl.}:
  defer: print("Processed", frameCount, "frames")
  
  var phase: float = 0.0
  var increment: float = 0.01
  
  for frame in 0..<frameCount:
    # Generate sample
    var sample = generateSample(phase)
    
    # Store in buffer (simplified - just use frame index)
    if frame < len(audioBuffer):
      var dummy = cast[int](sample)
    
    # Update phase
    phase = phase + increment
  
  return frameCount

# Playback control
proc startPlayback():
  defer: print("Playback stopped")
  
  print("")
  print("Starting audio playback...")
  
  # Simulate audio callback
  var frames = audioCallback(0, 256)
  print("Callback returned:", frames, "frames")

# Volume control with defer
proc setVolume(level: float):
  defer: print("Volume change complete")
  
  print("Setting volume to:", level)
  # Volume logic here

# Audio cleanup
proc shutdownAudio():
  defer: print("Audio cleanup complete")
  
  print("")
  print("Shutting down audio system...")
  
  # Clear buffer
  setLen(audioBuffer, 0)
  print("Buffer cleared")

# Main audio demo
proc main():
  print("=== Nimini Audio Demo ===")
  print("(Naylib-style)")
  print("")
  
  initAudio()
  
  print("")
  print("=== Playback Test ===")
  startPlayback()
  
  print("")
  print("=== Volume Control ===")
  setVolume(0.75)
  
  shutdownAudio()
  
  print("")
  print("=== Summary ===")
  print("✓ Audio constants and configuration")
  print("✓ Buffer management with sequences")
  print("✓ Audio callback with cdecl pragma")
  print("✓ Defer for cleanup")
  print("✓ Type annotations for clarity")
  print("✓ Cast for type conversions")
  print("")
  print("Audio demo complete!")

# Run the demo
main()
"""

proc main() =
  echo "Compiling and running Nimini audio example..."
  echo ""
  
  # Initialize runtime
  initRuntime()
  
  # Register sequence operations
  registerSeqOps()
  
  # Register print function
  proc niminiPrint(env: ref Env; args: seq[Value]): Value =
    for i, arg in args:
      if i > 0: stdout.write(" ")
      stdout.write($arg)
    stdout.write("\n")
    return valNil()
  
  registerNative("print", niminiPrint)
  
  # Tokenize and parse
  let tokens = tokenizeDsl(audioCode)
  let program = parseDsl(tokens)
  
  # Execute
  try:
    execProgram(program, runtimeEnv)
  except:
    echo "Error: ", getCurrentExceptionMsg()

when isMainModule:
  main()
