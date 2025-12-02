## Example: SDL3 Audio Playback
##
## This example demonstrates how to use the SDL3 audio bindings
## to set up basic audio playback.

import platform/sdl/sdl3_bindings

proc main() =
  # Initialize SDL with video and audio
  if SDL_Init(SDL_INIT_VIDEO or SDL_INIT_AUDIO) != 0:
    echo "Failed to initialize SDL: ", SDL_GetError()
    return
  
  defer: SDL_Quit()
  
  echo "SDL3 initialized with audio support"
  
  # Set up audio specification
  var desiredSpec: SDL_AudioSpec
  desiredSpec.format = SDL_AUDIO_S16LE  # 16-bit signed audio
  desiredSpec.channels = 2               # Stereo
  desiredSpec.freq = 44100               # 44.1 kHz sample rate
  
  echo "Audio Spec:"
  echo "  Format: 16-bit signed (little-endian)"
  echo "  Channels: ", desiredSpec.channels, " (stereo)"
  echo "  Sample Rate: ", desiredSpec.freq, " Hz"
  
  # Open the default audio playback device
  let audioDevice = SDL_OpenAudioDevice(SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK, addr desiredSpec)
  
  if audioDevice == 0:
    echo "Failed to open audio device: ", SDL_GetError()
    return
  
  defer: SDL_CloseAudioDevice(audioDevice)
  
  echo "Audio device opened successfully (ID: ", audioDevice, ")"
  
  # Create an audio stream
  let stream = SDL_CreateAudioStream(addr desiredSpec, addr desiredSpec)
  if stream == nil:
    echo "Failed to create audio stream: ", SDL_GetError()
    return
  
  defer: SDL_DestroyAudioStream(stream)
  
  # Bind the stream to the audio device
  if not SDL_BindAudioStream(audioDevice, stream):
    echo "Failed to bind audio stream: ", SDL_GetError()
    return
  
  echo "Audio stream created and bound"
  
  # Note: In a real application, you would:
  # 1. Generate or load audio data
  # 2. Use SDL_PutAudioStreamData() to queue audio samples
  # 3. Use SDL_ResumeAudioDevice() to start playback
  # 4. Use SDL_PauseAudioDevice() to pause
  
  echo ""
  echo "Audio system ready for playback!"
  echo "To play audio:"
  echo "  1. Generate audio samples"
  echo "  2. SDL_PutAudioStreamData(stream, samples, sampleCount)"
  echo "  3. SDL_ResumeAudioDevice(audioDevice)"

when isMainModule:
  main()
