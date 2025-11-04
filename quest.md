---
title: "Forest Adventure"
author: "Storied"
player:
  x: 4
  y: 2
  inventory: []
  flags: {}
---
``` lua global
-- Global game state
gameState = {
  currentLocation = "Forest Entrance",
  player = {
    x = 4,
    y = 2
  },
  inventory = {},
  flags = {},
  messages = {}
}

-- Helper functions
function hasItem(item)
  for _, v in ipairs(gameState.inventory) do
    if v == item then return true end
  end
  return false
end

function addItem(item)
  table.insert(gameState.inventory, item)
end

function removeItem(item)
  for i, v in ipairs(gameState.inventory) do
    if v == item then
      table.remove(gameState.inventory, i)
      return
    end
  end
end

function getFlag(flag)
  return gameState.flags[flag] or false
end

function setFlag(flag, value)
  gameState.flags[flag] = value
end

function showMessage(text)
  table.insert(gameState.messages, {text = text, time = os.clock()})
end

function playerPos()
  return gameState.player.x, gameState.player.y
end

function teleport(location)
  gameState.currentLocation = location
  -- Find the section index by title and navigate to it
  -- This is a simplified version - you'd need section navigation
  showMessage("Teleporting to " .. location .. "...")
end

function drawMessages(buffer, x, y, maxLines)
  local now = os.clock()
  local active = {}
  
  for _, msg in ipairs(gameState.messages) do
    if now - msg.time < 3.0 then
      table.insert(active, msg.text)
    end
  end
  
  local start = math.max(1, #active - maxLines + 1)
  for i = start, #active do
    local lineY = y + (i - start)
    buffer:write(x, lineY, "* " .. active[i], 32)
  end
end
```
``` lua module:gamemap
-- Map rendering module
local Map = {}

function Map:new(mapData)
  local m = {
    tiles = {},
    width = 0,
    height = 0
  }
  setmetatable(m, self)
  self.__index = self
  
  -- Parse map data
  for line in mapData:gmatch("[^\n]+") do
    table.insert(m.tiles, line)
    m.width = math.max(m.width, #line)
  end
  m.height = #m.tiles
  
  return m
end

function Map:getTile(x, y)
  if y < 1 or y > #self.tiles then return "#" end
  local line = self.tiles[y]
  if x < 1 or x > #line then return "#" end
  return line:sub(x, x)
end

function Map:canMove(x, y)
  local tile = self:getTile(x, y)
  return tile ~= "#"
end

function Map:draw(buffer, viewport, cameraX, cameraY, playerX, playerY)
  for y = 1, #self.tiles do
    local line = self.tiles[y]
    for x = 1, #line do
      local screenX = x - cameraX
      local screenY = y - cameraY + 3
      
      if screenX >= 0 and screenX < viewport.width and
         screenY >= 0 and screenY < viewport.height then
        local ch = line:sub(x, x)
        local color = 37
        
        if ch == "#" then color = 33
        elseif ch == "." then color = 32
        elseif ch == "^" or ch == "*" then color = 36
        end
        
        buffer:write(screenX, screenY, ch, color)
      end
    end
  end
  
  -- Draw player
  local screenX = playerX - cameraX
  local screenY = playerY - cameraY + 3
  if screenX >= 0 and screenX < viewport.width and
     screenY >= 0 and screenY < viewport.height then
    buffer:write(screenX, screenY, "@", 37)
  end
end

return Map
```

# Forest Entrance

You stand at the edge of a dark forest. A path leads north.
``` lua on:enter
local Map = require("gamemap")

-- Initialize map for this location
forestMap = Map:new([[
##########
#        ######
#             #
#             #
#   ^         #
###############
]])

gameState.currentLocation = "Forest Entrance"
gameState.player.x = 4
gameState.player.y = 2

if not getFlag("visited_forest") then
  showMessage("A chill runs down your spine...")
  setFlag("visited_forest", true)
  addItem("key")
  showMessage("You found a mystical key on the ground!")
end
```
``` lua on:render
local vp = getViewport()
buffer:clear()

-- Title
buffer:write(0, 0, "=== Forest Entrance ===", 33)

-- Draw map
local cameraX = gameState.player.x - math.floor(vp.width / 2)
local cameraY = gameState.player.y - math.floor(vp.height / 2)
forestMap:draw(buffer, vp, cameraX, cameraY, gameState.player.x, gameState.player.y)

-- Status
local invText = "Inventory: " .. table.concat(gameState.inventory, ", ")
if #gameState.inventory == 0 then invText = "Inventory: empty" end
buffer:write(0, vp.height - 6, invText, 32)

-- Messages
drawMessages(buffer, 0, vp.height - 5, 5)
```
``` lua on:key
local newX = gameState.player.x
local newY = gameState.player.y

if key == "w" then newY = newY - 1
elseif key == "s" then newY = newY + 1
elseif key == "a" then newX = newX - 1
elseif key == "d" then newX = newX + 1
elseif key == "e" then
  -- Interact
  local x, y = playerPos()
  local tile = forestMap:getTile(x, y)
  
  if tile == "^" then
    if hasItem("key") then
      showMessage("You use the key. The path opens!")
      -- Move to next section (Deep Forest)
      -- Note: You'd need to implement section navigation
    else
      showMessage("The path is magically sealed. You need a key.")
    end
  else
    showMessage("Nothing interesting here.")
  end
  return
end

-- Movement
if forestMap:canMove(newX, newY) then
  gameState.player.x = newX
  gameState.player.y = newY
end
```

# Deep Forest

The forest deepens around you. Mysterious symbols glow on the trees.
``` lua on:enter
local Map = require("gamemap")

-- Initialize map for this location
deepMap = Map:new([[
##########
#  *   * #
#        #
#        ######
# *           #
#             #
#       *     #
#             #
#  *          #
#    *        #######
#                  *#
#                  *#
#               ****#
#           * #######
#             #
# *           #
#             #
#    *        #
###############
]])

gameState.currentLocation = "Deep Forest"
gameState.player.x = 4
gameState.player.y = 3

showMessage("You've entered the deep forest!")
if not hasItem("key") then
  addItem("key")
  showMessage("You found a mystical key on the ground!")
end
```
``` lua on:render
local vp = getViewport()
buffer:clear()

-- Title
buffer:write(0, 0, "=== Deep Forest ===", 33)

-- Draw map
local cameraX = gameState.player.x - math.floor(vp.width / 2)
local cameraY = gameState.player.y - math.floor(vp.height / 2)
deepMap:draw(buffer, vp, cameraX, cameraY, gameState.player.x, gameState.player.y)

-- Status
local invText = "Inventory: " .. table.concat(gameState.inventory, ", ")
if #gameState.inventory == 0 then invText = "Inventory: empty" end
buffer:write(0, vp.height - 6, invText, 32)

-- Messages
drawMessages(buffer, 0, vp.height - 5, 5)
```
``` lua on:key
local newX = gameState.player.x
local newY = gameState.player.y

if key == "w" then newY = newY - 1
elseif key == "s" then newY = newY + 1
elseif key == "a" then newX = newX - 1
elseif key == "d" then newX = newX + 1
elseif key == "e" then
  showMessage("The mysterious symbols pulse with ancient magic.")
  return
end

-- Movement
if deepMap:canMove(newX, newY) then
  gameState.player.x = newX
  gameState.player.y = newY
end
```

# Conclusion

You can navigate between locations using the arrow keys or N/P keys.

Press Q to exit at any time.