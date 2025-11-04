---
title: "UI"
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
  local style = self.focused and "highlight" or "border"
  buffer:drawBox(self.x, self.y, self.width, self.height, style)
  
  if self.label ~= "" then
    buffer:writeStyled(self.x + 1, self.y, self.label, "info")
  end
  
  local textY = self.y + 1
  local textX = self.x + 2
  buffer:write(textX, textY, self.text, 37, 0, false)
  
  if self.focused then
    buffer:write(textX + self.cursor, textY, "_", 33, 0, true)
  end
end

function TextBox:handleKey(key)
  if not self.focused or not self.enabled then return false end
  
  if key == "" then return false end
  
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
  
  local style = self.focused and "highlight" or "border"
  
  if self.pressed then
    buffer:fillRect(self.x, self.y, self.width, self.height, '#', "button")
  else
    buffer:drawBox(self.x, self.y, self.width, self.height, style)
  end
  
  local labelX = self.x + math.floor((self.width - #self.label) / 2)
  local labelY = self.y + math.floor(self.height / 2)
  local labelStyle = self.focused and "highlight" or "default"
  buffer:writeStyled(labelX, labelY, self.label, labelStyle)
end

function Button:handleKey(key)
  if not self.enabled then return false end
  
  if key == "" then return false end
  
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

-- Slider widget
local Slider = setmetatable({}, Widget)
Slider.__index = Slider

function Slider:new(x, y, w, label, min, max, value)
  local obj = Widget.new(self, x, y, w, 3)
  obj.label = label or ""
  obj.min = min or 0
  obj.max = max or 100
  obj.value = value or min or 0
  obj.dragging = false
  return obj
end

function Slider:render()
  if not self.visible then return end
  
  local style = self.focused and "highlight" or "border"
  buffer:drawBox(self.x, self.y, self.width, self.height, style)
  
  if self.label ~= "" then
    buffer:writeStyled(self.x + 1, self.y, self.label, "info")
  end
  
  local sliderY = self.y + 1
  local sliderX = self.x + 2
  local sliderWidth = self.width - 4
  
  local percent = (self.value - self.min) / (self.max - self.min)
  local handlePos = math.floor(percent * (sliderWidth - 1))
  
  for i = 0, sliderWidth - 1 do
    local ch = i == handlePos and 'O' or '─'
    if i == handlePos then
      buffer:writeStyled(sliderX + i, sliderY, ch, "warning")
    else
      buffer:write(sliderX + i, sliderY, ch, 37, 0, false)
    end
  end
  
  local valueText = string.format("%.0f", self.value)
  buffer:write(self.x + self.width - #valueText - 2, self.y + 2, valueText, 37, 0, false)
end

function Slider:handleKey(key)
  if not self.enabled then return false end
  
  if key == "" then return false end
  
  local byte = string.byte(key)
  
  -- Keep +/- as backup
  if byte == 45 or byte == 95 then  -- - or _
    self.value = math.max(self.min, self.value - (self.max - self.min) / 10)
    return true
  elseif byte == 43 or byte == 61 then  -- + or =
    self.value = math.min(self.max, self.value + (self.max - self.min) / 10)
    return true
  end
  return false
end

function Slider:handleArrow(direction)
  if not self.enabled then return false end
  
  if direction == "left" or direction == "down" then
    self.value = math.max(self.min, self.value - (self.max - self.min) / 10)
    return true
  elseif direction == "right" or direction == "up" then
    self.value = math.min(self.max, self.value + (self.max - self.min) / 10)
    return true
  end
  return false
end

function Slider:handleMouse(event)
  if not self.enabled or not self.visible then return false end
  
  if event.type == "down" and self:contains(event.x, event.y) then
    self.dragging = true
    self:updateValue(event.x)
    return true
  elseif event.type == "drag" and self.dragging then
    self:updateValue(event.x)
    return true
  elseif event.type == "up" and self.dragging then
    self.dragging = false
    return true
  end
  return false
end

function Slider:updateValue(mouseX)
  local sliderX = self.x + 2
  local sliderWidth = self.width - 4
  local relX = math.max(0, math.min(sliderWidth - 1, mouseX - sliderX))
  local percent = relX / (sliderWidth - 1)
  self.value = self.min + percent * (self.max - self.min)
end

-- Checkbox widget
local Checkbox = setmetatable({}, Widget)
Checkbox.__index = Checkbox

function Checkbox:new(x, y, label, checked)
  local obj = Widget.new(self, x, y, #label + 6, 1)
  obj.label = label or "Option"
  obj.checked = checked or false
  return obj
end

function Checkbox:render()
  if not self.visible then return end
  
  local boxStyle = self.focused and "highlight" or "default"
  local checkChar = self.checked and "X" or " "
  buffer:writeStyled(self.x, self.y, "[" .. checkChar .. "]", boxStyle)
  buffer:write(self.x + 4, self.y, self.label, 37, 0, false)
end

function Checkbox:handleKey(key)
  if not self.enabled then return false end
  
  if key == "" then return false end
  
  local byte = string.byte(key)
  
  if byte == 32 or byte == 13 then
    self.checked = not self.checked
    return true
  end
  return false
end

function Checkbox:handleMouse(event)
  if not self.enabled or not self.visible then return false end
  
  if event.type == "down" and self:contains(event.x, event.y) then
    self.checked = not self.checked
    return true
  end
  return false
end

-- UI Manager
UI.TextBox = TextBox
UI.Button = Button
UI.Slider = Slider
UI.Checkbox = Checkbox
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

function UI.handleKey(keyInfo)
  if #UI.widgets == 0 then return false end
  
  -- keyInfo is now a table with: name, char, code, ctrl, alt, shift
  local keyName = keyInfo.name
  local keyChar = keyInfo.char or ""
  
  -- Tab (forward)
  if keyName == "tab" and not keyInfo.shift then
    if UI.widgets[UI.focusIndex + 1] then
      UI.widgets[UI.focusIndex + 1].focused = false
    end
    UI.focusIndex = (UI.focusIndex + 1) % #UI.widgets
    if UI.widgets[UI.focusIndex + 1] then
      UI.widgets[UI.focusIndex + 1].focused = true
    end
    return true
  end
  
  local focused = UI.widgets[UI.focusIndex + 1]
  if focused and focused.handleKey then
    return focused:handleKey(keyChar)
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

local volumeSlider = ui.Slider:new(10, 13, 30, "Volume:", 0, 100, 50)
ui.add(volumeSlider)

local brightnessSlider = ui.Slider:new(10, 17, 30, "Brightness:", 0, 100, 75)
ui.add(brightnessSlider)

local optIn = ui.Checkbox:new(12, 21, "Opt-in to newsletter", false)
ui.add(optIn)

local notifications = ui.Checkbox:new(12, 22, "Enable notifications", true)
ui.add(notifications)

local message = "Click or Tab to interact"
local lastEvent = ""

local submitBtn = ui.Button:new(15, 24, 15, 3, "Submit", function()
  if nameBox.text == "" then
    message = "Please enter a name!"
  else
    local opts = ""
    if optIn.checked then opts = opts .. " +Newsletter" end
    if notifications.checked then opts = opts .. " +Notify" end
    message = "Submitted: " .. nameBox.text .. " | Vol: " .. math.floor(volumeSlider.value) .. opts
  end
end)
ui.add(submitBtn)

local clearBtn = ui.Button:new(32, 24, 15, 3, "Clear", function()
  nameBox.text = ""
  nameBox.cursor = 0
  emailBox.text = ""
  emailBox.cursor = 0
  volumeSlider.value = 50
  brightnessSlider.value = 75
  optIn.checked = false
  notifications.checked = true
  message = "Cleared!"
end)
ui.add(clearBtn)

ui.focusIndex = 0
ui.widgets[1].focused = true

function globalRender()
  buffer:clear()
  buffer:writeStyled(5, 2, "Tab/Shift+Tab: Nav | Arrows: Sliders | Click/Drag | Space: Toggle", "info")
  buffer:writeStyled(5, 29, "Message: " .. message, "warning")
  buffer:writeStyled(5, 30, "Last event: " .. lastEvent, "info")
  
  ui.render()
end

function globalHandleKey(key)
  -- key is now a table with: name, char, code, ctrl, alt, shift
  local keyChar = key.char or ""
  local handled = false
  
  if keyChar ~= "" or key.name == "tab" then
    handled = ui.handleKey(key)
  end
  
  lastEvent = "key " .. key.name .. " (code:" .. key.code .. ")"
  return handled or (keyChar ~= "" and key.code >= 32 and key.code <= 126)
end

function globalHandleArrow(direction)
  lastEvent = "arrow " .. direction
  
  -- Give arrow key to focused widget
  local focused = ui.widgets[ui.focusIndex + 1]
  if focused and focused.handleArrow then
    return focused:handleArrow(direction)
  end
  
  return false
end

function globalHandleShiftTab()
  lastEvent = "shift-tab"
  
  -- Navigate backward through widgets
  if ui.widgets[ui.focusIndex + 1] then
    ui.widgets[ui.focusIndex + 1].focused = false
  end
  ui.focusIndex = (ui.focusIndex - 1) % #ui.widgets
  if ui.focusIndex < 0 then
    ui.focusIndex = #ui.widgets - 1
  end
  if ui.widgets[ui.focusIndex + 1] then
    ui.widgets[ui.focusIndex + 1].focused = true
  end
  
  return true
end

function globalHandleMouse(event)
  lastEvent = string.format("mouse %s at (%d,%d) btn:%d", event.type, event.x, event.y, event.button or 0)
  ui.handleMouse(event)
end

setMultiSectionMode(true)
enableMouse()
```

# Mouse Test

Testing mouse clicks and focus changes.