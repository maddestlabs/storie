---
title: "TextBox Test"
minWidth: 60
minHeight: 20
---

```lua module: ui
local UI = {}

local TextBox = {}
TextBox.__index = TextBox

function TextBox:new(x, y, w, label)
  local obj = {
    x = x,
    y = y,
    width = w,
    height = 3,
    label = label or "",
    text = "",
    cursor = 0,
    showCursor = true,
    cursorBlink = 0,
    focused = true
  }
  setmetatable(obj, self)
  return obj
end

function TextBox:render()
  buffer:drawRect(self.x, self.y, self.width, self.height, 37, false)
  
  if self.label ~= "" then
    buffer:write(self.x + 1, self.y, self.label, 36, false)
  end
  
  local textY = self.y + 1
  local textX = self.x + 2
  
  buffer:write(textX, textY, self.text, 37, false)
  
  if self.showCursor then
    buffer:write(textX + self.cursor, textY, "_", 33, true)
  end
end

function TextBox:handleKey(key)
  local byte = string.byte(key)
  
  if byte >= 32 and byte <= 126 then
    self.text = self.text:sub(1, self.cursor) .. key .. self.text:sub(self.cursor + 1)
    self.cursor = self.cursor + 1
    return true
  elseif byte == 127 or byte == 8 then
    if self.cursor > 0 then
      self.text = self.text:sub(1, self.cursor - 1) .. self.text:sub(self.cursor + 1)
      self.cursor = self.cursor - 1
    end
    return true
  end
  
  return false
end

function TextBox:update(dt)
  self.cursorBlink = self.cursorBlink + dt
  if self.cursorBlink > 0.5 then
    self.showCursor = not self.showCursor
    self.cursorBlink = 0
  end
end

UI.TextBox = TextBox
UI.widgets = {}

function UI.add(widget)
  table.insert(UI.widgets, widget)
end

function UI.render()
  for _, widget in ipairs(UI.widgets) do
    widget:render()
  end
end

function UI.update(dt)
  for _, widget in ipairs(UI.widgets) do
    if widget.update then
      widget:update(dt)
    end
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

local nameBox = ui.TextBox:new(10, 5, 30, "Name:")
ui.add(nameBox)

local message = "Type to enter text, Backspace to delete"

function globalRender()
  buffer:clear()
  buffer:write(5, 2, message, 36, false)
  buffer:write(5, 3, "Text: '" .. nameBox.text .. "'", 33, false)
  
  ui.render()
end

function globalUpdate(dt)
  ui.update(dt)
end

function globalHandleKey(key)
  local handled = ui.handleKey(key)
  return handled or (string.byte(key) >= 32 and string.byte(key) <= 126)
end

setMultiSectionMode(true)
```

# TextBox Test

Testing text input.