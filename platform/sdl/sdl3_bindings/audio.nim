## SDL3 Audio - Audio playback, recording, and stream management
import build_config
import types
export types

# Audio opaque types
type
  SDL_AudioStream* {.importc, header: "SDL3/SDL_audio.h", incompletestruct.} = object
  SDL_AudioDeviceID* = uint32

# Audio format specification
type
  SDL_AudioFormat* = uint16

# SDL3 audio formats
var
  SDL_AUDIO_U8* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat      # Unsigned 8-bit samples
  SDL_AUDIO_S8* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat      # Signed 8-bit samples
  SDL_AUDIO_S16LE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # Signed 16-bit samples (little-endian)
  SDL_AUDIO_S16BE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # Signed 16-bit samples (big-endian)
  SDL_AUDIO_S32LE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # Signed 32-bit samples (little-endian)
  SDL_AUDIO_S32BE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # Signed 32-bit samples (big-endian)
  SDL_AUDIO_F32LE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # 32-bit floating point samples (little-endian)
  SDL_AUDIO_F32BE* {.importc, header: "SDL3/SDL_audio.h".}: SDL_AudioFormat   # 32-bit floating point samples (big-endian)

# Audio specification structure
type
  SDL_AudioSpec* {.importc, header: "SDL3/SDL_audio.h".} = object
    format*: SDL_AudioFormat  ## Audio data format
    channels*: cint           ## Number of channels: 1 mono, 2 stereo, etc
    freq*: cint               ## Sample rate: 44100, 48000, etc

# Audio device management
proc SDL_OpenAudioDevice*(devid: SDL_AudioDeviceID, spec: ptr SDL_AudioSpec): SDL_AudioDeviceID {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_CloseAudioDevice*(devid: SDL_AudioDeviceID) {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_PauseAudioDevice*(dev: SDL_AudioDeviceID): bool {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_ResumeAudioDevice*(dev: SDL_AudioDeviceID): bool {.importc, header: "SDL3/SDL_audio.h".}

# Audio stream management
proc SDL_CreateAudioStream*(src_spec: ptr SDL_AudioSpec, dst_spec: ptr SDL_AudioSpec): ptr SDL_AudioStream {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_DestroyAudioStream*(stream: ptr SDL_AudioStream) {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_BindAudioStream*(devid: SDL_AudioDeviceID, stream: ptr SDL_AudioStream): bool {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_UnbindAudioStream*(stream: ptr SDL_AudioStream) {.importc, header: "SDL3/SDL_audio.h".}

# Stream data operations
proc SDL_PutAudioStreamData*(stream: ptr SDL_AudioStream, buf: pointer, len: cint): bool {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_GetAudioStreamData*(stream: ptr SDL_AudioStream, buf: pointer, len: cint): cint {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_GetAudioStreamAvailable*(stream: ptr SDL_AudioStream): cint {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_ClearAudioStream*(stream: ptr SDL_AudioStream): bool {.importc, header: "SDL3/SDL_audio.h".}

# Query and device enumeration
proc SDL_GetAudioPlaybackDevices*(count: ptr cint): ptr SDL_AudioDeviceID {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_GetAudioRecordingDevices*(count: ptr cint): ptr SDL_AudioDeviceID {.importc, header: "SDL3/SDL_audio.h".}
proc SDL_GetAudioDeviceName*(devid: SDL_AudioDeviceID): cstring {.importc, header: "SDL3/SDL_audio.h".}

# Convenience constants for default device
const
  SDL_AUDIO_DEVICE_DEFAULT_PLAYBACK* = 0xFFFFFFFF'u32
  SDL_AUDIO_DEVICE_DEFAULT_RECORDING* = 0xFFFFFFFE'u32
