# Storied
The little terminal engine that does some things.

## What is Storied?
Storied is sort of a terminal game engine. It's built with real-time interaction in mind, with the goal that it can be used for game creation, meanwhile providing enough flexibility for use as an easy GUI tool.

# Compile your Nim code to JavaScript
nim js -d:release -o:storied.js storiedjs.nim

# The output storied.js can be included in your HTML

## Compile without Lua (user will need Lua installed)
nim c -d:release game.nim

## Compile with Lua bundled
nim c -d:release --opt:size st0ry.nim
