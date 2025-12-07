## OpenGL bindings for use with SDL3
## Provides OpenGL/WebGL context and function bindings

{.push styleChecks: off.}

when defined(emscripten):
  # WebGL bindings via Emscripten
  {.passL: "-lGL".}
  # WebGL2 flags are set via EMCC_CFLAGS in build-web.sh
else:
  # Native OpenGL
  when defined(windows):
    {.passL: "-lopengl32".}
  elif defined(macosx):
    {.passL: "-framework OpenGL".}
  else:
    {.passL: "-lGL".}

# Note: For Windows, SDL_GL_GetProcAddress would be needed to load modern OpenGL functions
# but that causes circular import. For SDL_GPU builds, OpenGL is not used on Windows anyway.

# OpenGL types
type
  GLenum* = uint32
  GLboolean* = uint8
  GLbitfield* = uint32
  GLbyte* = int8
  GLshort* = int16
  GLint* = int32
  GLsizei* = int32
  GLubyte* = uint8
  GLushort* = uint16
  GLuint* = uint32
  GLfloat* = float32
  GLclampf* = float32
  GLdouble* = float64
  GLclampd* = float64
  GLchar* = char

# OpenGL constants
const
  GL_FALSE* = 0'u32
  GL_TRUE* = 1'u32
  
  # Data type constants (for glVertexAttribPointer etc.)
  cGL_BYTE* = 0x1400'u32
  cGL_UNSIGNED_BYTE* = 0x1401'u32
  cGL_SHORT* = 0x1402'u32
  cGL_UNSIGNED_SHORT* = 0x1403'u32
  cGL_INT* = 0x1404'u32
  cGL_UNSIGNED_INT* = 0x1405'u32
  cGL_FLOAT* = 0x1406'u32
  cGL_DOUBLE* = 0x140A'u32
  
  # Primitives
  GL_POINTS* = 0x0000'u32
  GL_LINES* = 0x0001'u32
  GL_LINE_LOOP* = 0x0002'u32
  GL_LINE_STRIP* = 0x0003'u32
  GL_TRIANGLES* = 0x0004'u32
  GL_TRIANGLE_STRIP* = 0x0005'u32
  GL_TRIANGLE_FAN* = 0x0006'u32
  
  # Blending
  GL_BLEND* = 0x0BE2'u32
  GL_SRC_ALPHA* = 0x0302'u32
  GL_ONE_MINUS_SRC_ALPHA* = 0x0303'u32
  
  # Depth testing
  GL_DEPTH_TEST* = 0x0B71'u32
  GL_DEPTH_BUFFER_BIT* = 0x00000100'u32
  GL_LEQUAL* = 0x0203'u32
  
  # Buffers
  GL_COLOR_BUFFER_BIT* = 0x00004000'u32
  GL_ARRAY_BUFFER* = 0x8892'u32
  GL_ELEMENT_ARRAY_BUFFER* = 0x8893'u32
  GL_STATIC_DRAW* = 0x88E4'u32
  GL_DYNAMIC_DRAW* = 0x88E8'u32
  
  # Shaders
  GL_VERTEX_SHADER* = 0x8B31'u32
  GL_FRAGMENT_SHADER* = 0x8B30'u32
  GL_COMPILE_STATUS* = 0x8B81'u32
  GL_LINK_STATUS* = 0x8B82'u32
  GL_INFO_LOG_LENGTH* = 0x8B84'u32
  
  # Culling
  GL_CULL_FACE* = 0x0B44'u32
  GL_BACK* = 0x0405'u32
  GL_FRONT* = 0x0404'u32
  GL_CCW* = 0x0901'u32
  GL_CW* = 0x0900'u32
  
  # Texture targets
  GL_TEXTURE_2D* = 0x0DE1'u32
  
  # Texture formats
  GL_RGBA* = 0x1908'u32
  GL_RGB* = 0x1907'u32
  GL_RED* = 0x1903'u32
  GL_DEPTH_COMPONENT* = 0x1902'u32
  GL_DEPTH_STENCIL* = 0x84F9'u32
  GL_DEPTH24_STENCIL8* = 0x88F0'u32
  
  # Texture data types
  GL_UNSIGNED_BYTE* = 0x1401'u32
  GL_UNSIGNED_INT_24_8* = 0x84FA'u32
  
  # Texture parameters
  GL_TEXTURE_MIN_FILTER* = 0x2801'u32
  GL_TEXTURE_MAG_FILTER* = 0x2800'u32
  GL_TEXTURE_WRAP_S* = 0x2802'u32
  GL_TEXTURE_WRAP_T* = 0x2803'u32
  
  # Texture filtering
  GL_LINEAR* = 0x2601'u32
  GL_NEAREST* = 0x2600'u32
  
  # Texture wrapping
  GL_REPEAT* = 0x2901'u32
  GL_CLAMP_TO_EDGE* = 0x812F'u32
  GL_MIRRORED_REPEAT* = 0x8370'u32

# OpenGL function bindings
when defined(windows) and not defined(emscripten):
  # Windows: Load OpenGL functions dynamically via SDL_GL_GetProcAddress
  # Only basic OpenGL 1.1 functions are in opengl32.dll, modern functions must be loaded
  
  # OpenGL 1.1 functions (directly available in opengl32.dll)
  proc glEnable*(cap: GLenum) {.importc, dynlib: "opengl32.dll".}
  proc glDisable*(cap: GLenum) {.importc, dynlib: "opengl32.dll".}
  proc glClear*(mask: GLbitfield) {.importc, dynlib: "opengl32.dll".}
  proc glClearColor*(red, green, blue, alpha: GLclampf) {.importc, dynlib: "opengl32.dll".}
  proc glClearDepth*(depth: GLclampd) {.importc, dynlib: "opengl32.dll".}
  proc glViewport*(x, y: GLint, width, height: GLsizei) {.importc, dynlib: "opengl32.dll".}
  proc glDepthFunc*(fun: GLenum) {.importc, dynlib: "opengl32.dll".}
  proc glBlendFunc*(sfactor, dfactor: GLenum) {.importc, dynlib: "opengl32.dll".}
  proc glCullFace*(mode: GLenum) {.importc, dynlib: "opengl32.dll".}
  proc glFrontFace*(mode: GLenum) {.importc, dynlib: "opengl32.dll".}
  
  # Modern OpenGL functions (OpenGL 2.0+) - must be loaded via SDL_GL_GetProcAddress
  type
    PFNGLGENBUFFERSPROC* = proc(n: GLsizei, buffers: ptr GLuint) {.cdecl.}
    PFNGLDELETEBUFFERSPROC* = proc(n: GLsizei, buffers: ptr GLuint) {.cdecl.}
    PFNGLBINDBUFFERPROC* = proc(target: GLenum, buffer: GLuint) {.cdecl.}
    PFNGLBUFFERDATAPROC* = proc(target: GLenum, size: GLsizei, data: pointer, usage: GLenum) {.cdecl.}
    PFNGLBUFFERSUBDATAPROC* = proc(target: GLenum, offset: GLint, size: GLsizei, data: pointer) {.cdecl.}
  
  var
    glGenBuffers*: PFNGLGENBUFFERSPROC
    glDeleteBuffers*: PFNGLDELETEBUFFERSPROC
    glBindBuffer*: PFNGLBINDBUFFERPROC
    glBufferData*: PFNGLBUFFERDATAPROC
    glBufferSubData*: PFNGLBUFFERSUBDATAPROC 

else:
  # Non-Windows (Linux, macOS, Emscripten): Standard OpenGL linking
  
  # Basic OpenGL functions
  proc glEnable*(cap: GLenum) {.importc.}
  proc glDisable*(cap: GLenum) {.importc.}
  proc glClear*(mask: GLbitfield) {.importc.}
  proc glClearColor*(red, green, blue, alpha: GLclampf) {.importc.}
  proc glClearDepth*(depth: GLclampd) {.importc.}
  proc glViewport*(x, y: GLint, width, height: GLsizei) {.importc.}
  proc glDepthFunc*(fun: GLenum) {.importc.}
  proc glBlendFunc*(sfactor, dfactor: GLenum) {.importc.}
  proc glCullFace*(mode: GLenum) {.importc.}
  proc glFrontFace*(mode: GLenum) {.importc.}
  
  # Buffer functions
  proc glGenBuffers*(n: GLsizei, buffers: ptr GLuint) {.importc.}
  proc glDeleteBuffers*(n: GLsizei, buffers: ptr GLuint) {.importc.}
  proc glBindBuffer*(target: GLenum, buffer: GLuint) {.importc.}
  proc glBufferData*(target: GLenum, size: GLsizei, data: pointer, usage: GLenum) {.importc.}
  proc glBufferSubData*(target: GLenum, offset: GLint, size: GLsizei, data: pointer) {.importc.}
  
  # Vertex array functions
  proc glGenVertexArrays*(n: GLsizei, arrays: ptr GLuint) {.importc.}
  proc glDeleteVertexArrays*(n: GLsizei, arrays: ptr GLuint) {.importc.}
  proc glBindVertexArray*(arr: GLuint) {.importc.}
  proc glEnableVertexAttribArray*(index: GLuint) {.importc.}
  proc glDisableVertexAttribArray*(index: GLuint) {.importc.}
  proc glVertexAttribPointer*(index: GLuint, size: GLint, typ: GLenum, normalized: GLboolean, stride: GLsizei, pointer: pointer) {.importc.}
  
  # Shader functions
  proc glCreateShader*(shaderType: GLenum): GLuint {.importc.}
  proc glDeleteShader*(shader: GLuint) {.importc.}
  proc glShaderSource*(shader: GLuint, count: GLsizei, str: ptr cstring, length: ptr GLint) {.importc.}
  proc glCompileShader*(shader: GLuint) {.importc.}
  proc glGetShaderiv*(shader: GLuint, pname: GLenum, params: ptr GLint) {.importc.}
  proc glGetShaderInfoLog*(shader: GLuint, maxLength: GLsizei, length: ptr GLsizei, infoLog: ptr GLchar) {.importc.}
  
  # Program functions
  proc glCreateProgram*(): GLuint {.importc.}
  proc glDeleteProgram*(program: GLuint) {.importc.}
  proc glAttachShader*(program, shader: GLuint) {.importc.}
  proc glLinkProgram*(program: GLuint) {.importc.}
  proc glUseProgram*(program: GLuint) {.importc.}
  proc glGetProgramiv*(program: GLuint, pname: GLenum, params: ptr GLint) {.importc.}
  proc glGetProgramInfoLog*(program: GLuint, maxLength: GLsizei, length: ptr GLsizei, infoLog: ptr GLchar) {.importc.}
  
  # Uniform functions
  proc glGetUniformLocation*(program: GLuint, name: cstring): GLint {.importc.}
  proc glUniform1f*(location: GLint, v0: GLfloat) {.importc.}
  proc glUniform2f*(location: GLint, v0, v1: GLfloat) {.importc.}
  proc glUniform3f*(location: GLint, v0, v1, v2: GLfloat) {.importc.}
  proc glUniform4f*(location: GLint, v0, v1, v2, v3: GLfloat) {.importc.}
  proc glUniform1i*(location: GLint, v0: GLint) {.importc.}
  proc glUniformMatrix4fv*(location: GLint, count: GLsizei, transpose: GLboolean, value: ptr GLfloat) {.importc.}
  
  # Drawing functions
  proc glDrawArrays*(mode: GLenum, first: GLint, count: GLsizei) {.importc.}
  proc glDrawElements*(mode: GLenum, count: GLsizei, typ: GLenum, indices: pointer) {.importc.}
  
  # Attribute binding
  proc glBindAttribLocation*(program: GLuint, index: GLuint, name: cstring) {.importc.}
  
  # Texture functions
  proc glGenTextures*(n: GLsizei, textures: ptr GLuint) {.importc.}
  proc glDeleteTextures*(n: GLsizei, textures: ptr GLuint) {.importc.}
  proc glBindTexture*(target: GLenum, texture: GLuint) {.importc.}
  proc glTexImage2D*(target: GLenum, level: GLint, internalFormat: GLint, width, height: GLsizei, 
                     border: GLint, format: GLenum, typ: GLenum, pixels: pointer) {.importc.}
  proc glTexSubImage2D*(target: GLenum, level: GLint, xoffset, yoffset: GLint, width, height: GLsizei,
                        format: GLenum, typ: GLenum, pixels: pointer) {.importc.}
  proc glTexParameteri*(target: GLenum, pname: GLenum, param: GLint) {.importc.}
  proc glActiveTexture*(texture: GLenum) {.importc.}
  proc glGenerateMipmap*(target: GLenum) {.importc.} 

{.pop.}  # End styleChecks off
