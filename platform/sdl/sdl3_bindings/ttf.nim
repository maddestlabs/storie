## SDL3_ttf - TrueType font rendering
import build_config
import types
export types

const ttfHeader = "SDL3_ttf/SDL_ttf.h"

type
  TTF_Font* {.importc, header: ttfHeader, incompletestruct.} = object

# TTF initialization
proc TTF_Init*(): bool {.importc, header: ttfHeader.}
proc TTF_Quit*() {.importc, header: ttfHeader.}

# Font management
proc TTF_OpenFont*(file: cstring, ptsize: cfloat): ptr TTF_Font {.importc, header: ttfHeader.}
proc TTF_CloseFont*(font: ptr TTF_Font) {.importc, header: ttfHeader.}

# Text rendering
proc TTF_RenderText_Solid*(font: ptr TTF_Font, text: cstring, length: csize_t, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}
proc TTF_RenderText_Blended*(font: ptr TTF_Font, text: cstring, length: csize_t, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}
proc TTF_RenderGlyph_Solid*(font: ptr TTF_Font, ch: uint32, fg: SDL_Color): ptr SDL_Surface {.importc, header: ttfHeader.}
