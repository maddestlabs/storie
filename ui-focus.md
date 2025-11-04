---
title: "Mouse Test"
minWidth: 60
minHeight: 25
---

```lua module: ui
local UI = {}

local Widget = {}
Widget.__index = Widget

function Widget:new(x, y, w, h)
  local obj = {
    x = x or 0,
    y = y or 0,
    width = w or 10,
    height = h or 3,
    focused = false,
    enabled = true,
    visible = true
  }
  setmetatable(obj, self)
  return obj
end

function Widget:contains(mx, my)
  return mx >= self.x and mx < self.x + self.width and
         my >= self.y and my < self.y + self.height
end

-- TextBox
local TextBox = setmetatable({}, Widget)
TextBox.__index = TextBox

function TextBox:new(x, y, w, label)
  local obj = Widget.new(self, x, y, w, 3)
  obj.label = label or ""
  obj.text = ""
  obj.cursor = 0
  return obj
end

function TextBox:render()
  if not self.visible then return end
  local borderColor = self.focused and 33 or 37
  buffer:drawRect(self.x, self.y, self.width, self.height, borderColor, self.focused)
  
  if self.label ~= "" then
    buffer:write(self.x + 1, self.y, self.label, 36, false)
  end
  
  local textY = self.y + 1
  local textX = self.x + 2
  buffer:write(textX, textY, self.text, 37, false)
  
  if self.focused then
    buffer:write(textX + self.cursor, textY, "_", 33, true)
  end
end

function TextBox:handleKey(key)
  if not self.focused or not self.enabled then return false end
  
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

function TextBox:handleMouse(event)
  if not self.enabled or not self.visible then return false end
  
  if event.type == "down" and self:contains(event.x, event.y) then
    return true
  end
  return false
end

-- Button
local Button = setmetatable({}, Widget)
Button.__index = Button

function Button:new(x, y, w, h, label, callback)
  local obj = Widget.new(self, x, y, w, h)
  obj.label = label or "Button"
  obj.callback = callback
  obj.pressed = false
  return obj
end

function Button:render()
  if not self.visible then return end
  
  local borderColor = self.focused and 33 or 37
  
  if self.pressed then
    buffer:fillRect(self.x, self.y, self.width, self.height, '#', 33, true)
  else
    buffer:drawRect(self.x, self.y, self.width, self.height, borderColor, self.focused)
  end
  
  local labelX = self.x + math.floor((self.width - #self.label) / 2)
  local labelY = self.y + math.floor(self.height / 2)
  buffer:write(labelX, labelY, self.label, 37, self.focused)
end

function Button:handleKey(key)
  if not self.enabled then return false end
  local byte = string.byte(key)
  
  if byte == 32 or byte == 13 then
    if self.callback then 
      self.callback() 
    end
    return true
  end
  return false
end

function Button:handleMouse(event)
  if not self.enabled or not self.visible then return false end
  
  if event.type == "down" and self:contains(event.x, event.y) then
    self.pressed = true
    return true
  elseif event.type == "up" then
    local wasPressed = self.pressed
    self.pressed = false
    if wasPressed and self:contains(event.x, event.y) then
      if self.callback then self.callback() end
      return true
    end
  end
  return false
end

-- UI Manager
UI.TextBox = TextBox
UI.Button = Button
UI.widgets = {}
UI.focusIndex = 0

function UI.add(widget)
  table.insert(UI.widgets, widget)
end

function UI.render()
  for _, widget in ipairs(UI.widgets) do
    widget:render()
  end
end

function UI.handleKey(key)
  if #UI.widgets == 0 then return false end
  
  local byte = string.byte(key)
  
  -- Tab (forward) or Shift+Tab (backward)
  if byte == 9 then
    if UI.widgets[UI.focusIndex + 1] then
      UI.widgets[UI.focusIndex + 1].focused = false
    end
    UI.focusIndex = (UI.focusIndex + 1) % #UI.widgets
    if UI.widgets[UI.focusIndex + 1] then
      UI.widgets[UI.focusIndex + 1].focused = true
    end
    return true
  elseif byte == 27 then  -- Check for Shift+Tab sequence
    -- This is a simplified check - real Shift+Tab is complex
    return false
  end
  
  local focused = UI.widgets[UI.focusIndex + 1]
  if focused and focused.handleKey then
    return focused:handleKey(key)
  end
  
  return false
end

function UI.handleMouse(event)
  -- Update focus on click
  for i, widget in ipairs(UI.widgets) do
    if widget:contains(event.x, event.y) and event.type == "down" then
      if UI.widgets[UI.focusIndex + 1] then
        UI.widgets[UI.focusIndex + 1].focused = false
      end
      UI.focusIndex = i - 1
      widget.focused = true
      break
    end
  end
  
  -- Let widgets handle the event
  for _, widget in ipairs(UI.widgets) do
    if widget.handleMouse then
      local handled = widget:handleMouse(event)
      if handled then
        return true
      end
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

local emailBox = ui.TextBox:new(10, 9, 30, "Email:")
ui.add(emailBox)

local message = "Click or Tab to interact"
local lastEvent = ""

local submitBtn = ui.Button:new(15, 13, 15, 3, "Submit", function()
  if nameBox.text == "" then
    message = "Please enter a name!"
  else
    message = "Submitted: " .. nameBox.text
  end
end)
ui.add(submitBtn)

local clearBtn = ui.Button:new(32, 13, 15, 3, "Clear", function()
  nameBox.text = ""
  nameBox.cursor = 0
  emailBox.text = ""
  emailBox.cursor = 0
  message = "Cleared!"
end)
ui.add(clearBtn)

ui.focusIndex = 0
ui.widgets[1].focused = true

function globalRender()
  buffer:clear()
  buffer:write(5, 2, "Tab: Next | Click: Focus+Activate", 36, false)
  buffer:write(5, 18, "Message: " .. message, 33, false)
  buffer:write(5, 19, "Last event: " .. lastEvent, 36, false)
  
  ui.render()
end

function globalHandleKey(key)
  local handled = ui.handleKey(key)
  lastEvent = "key " .. string.byte(key)
  return handled or (string.byte(key) >= 32 and string.byte(key) <= 126)
end

function globalHandleMouse(event)
  lastEvent = string.format("mouse %s at (%d,%d) btn:%d", event.type, event.x, event.y, event.button or 0)
  
  -- Debug: check what we received
  message = string.format("Mouse: type=%s x=%d y=%d", event.type, event.x, event.y)
  
  -- Check if any widget contains this point
  local found = false
  for i, widget in ipairs(ui.widgets) do
    if widget:contains(event.x, event.y) then
      found = true
      message = message .. string.format(" | Widget %d hit!", i)
      break
    end
  end
  
  if not found then
    message = message .. " | No widget hit"
  end
  
  ui.handleMouse(event)
end

setMultiSectionMode(true)
enableMouse()
```

# Mouse Test

Testing mouse clicks and focus changes.