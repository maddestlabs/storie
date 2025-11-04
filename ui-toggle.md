---
title: "Widget Test"
minWidth: 60
minHeight: 20
---

```lua module: ui
local UI = {}

-- Simple button
local Button = {}
Button.__index = Button

function Button:new(x, y, label)
  local obj = {
    x = x,
    y = y,
    label = label,
    pressed = false
  }
  setmetatable(obj, self)
  return obj
end

function Button:render()
  local color = self.pressed and 33 or 37
  buffer:write(self.x, self.y, "[" .. self.label .. "]", color, self.pressed)
end

function Button:handleKey(key)
  if string.byte(key) == 32 then  -- space
    self.pressed = not self.pressed
    return true
  end
  return false
end

UI.Button = Button
UI.widgets = {}

function UI.add(widget)
  table.insert(UI.widgets, widget)
end

function UI.render()
  for _, widget in ipairs(UI.widgets) do
    widget:render()
  end
end

function UI.handleKey(key)
  for _, widget in ipairs(UI.widgets) do
    if widget.handleKey and widget:handleKey(key) then
      return true
    end
  end
  return false
end

return UI
```

```lua global
local ui = require("ui")

local testButton = ui.Button:new(10, 5, "Test Button")
ui.add(testButton)

local message = "Button created: " .. tostring(testButton ~= nil)

function globalRender()
  buffer:clear()
  buffer:write(5, 2, message, 36, false)
  buffer:write(5, 3, "Press SPACE to toggle button", 36, false)
  
  -- Render UI
  ui.render()
end

function globalHandleKey(key)
  message = "Key: " .. string.byte(key)
  local handled = ui.handleKey(key)
  if handled then
    message = message .. " [handled by UI]"
  end
  return true
end

setMultiSectionMode(true)
```

# Widget Test

Testing basic widget rendering and interaction.