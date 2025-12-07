# Install script for directory: /workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz

# Set the install prefix
if(NOT DEFINED CMAKE_INSTALL_PREFIX)
  set(CMAKE_INSTALL_PREFIX "/usr/local")
endif()
string(REGEX REPLACE "/$" "" CMAKE_INSTALL_PREFIX "${CMAKE_INSTALL_PREFIX}")

# Set the install configuration name.
if(NOT DEFINED CMAKE_INSTALL_CONFIG_NAME)
  if(BUILD_TYPE)
    string(REGEX REPLACE "^[^A-Za-z0-9_]+" ""
           CMAKE_INSTALL_CONFIG_NAME "${BUILD_TYPE}")
  else()
    set(CMAKE_INSTALL_CONFIG_NAME "Release")
  endif()
  message(STATUS "Install configuration: \"${CMAKE_INSTALL_CONFIG_NAME}\"")
endif()

# Set the component getting installed.
if(NOT CMAKE_INSTALL_COMPONENT)
  if(COMPONENT)
    message(STATUS "Install component: \"${COMPONENT}\"")
    set(CMAKE_INSTALL_COMPONENT "${COMPONENT}")
  else()
    set(CMAKE_INSTALL_COMPONENT)
  endif()
endif()

# Is this installation the result of a crosscompile?
if(NOT DEFINED CMAKE_CROSSCOMPILING)
  set(CMAKE_CROSSCOMPILING "TRUE")
endif()

# Set default install directory permissions.
if(NOT DEFINED CMAKE_OBJDUMP)
  set(CMAKE_OBJDUMP "/usr/bin/x86_64-w64-mingw32-objdump")
endif()

if(CMAKE_INSTALL_COMPONENT STREQUAL "Unspecified" OR NOT CMAKE_INSTALL_COMPONENT)
  file(INSTALL DESTINATION "${CMAKE_INSTALL_PREFIX}/include/harfbuzz" TYPE FILE FILES
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-aat-layout.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-aat.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-blob.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-buffer.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-common.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-cplusplus.hh"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-deprecated.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-draw.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-face.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-font.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-map.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-color.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-deprecated.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-font.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-layout.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-math.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-meta.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-metrics.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-name.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-shape.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot-var.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ot.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-paint.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-set.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-shape-plan.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-shape.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-style.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-unicode.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-version.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-ft.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-gdi.h"
    "/workspaces/Storie/vendor/SDL_ttf-src/external/harfbuzz/src/hb-uniscribe.h"
    )
endif()

