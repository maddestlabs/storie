-- Canvas Navigation Plugin for Storied
-- Provides spatial layout, smooth panning, and interactive link navigation

local Canvas = {}

-- Configuration
local SECTION_WIDTH = 60
local SECTION_HEIGHT = 20
local SECTION_PADDING = 10
local MAX_SECTIONS_PER_ROW = 3
local PAN_SPEED = 5.0
local SMOOTH_SPEED = 8.0

-- State
local camera = {x = 0, y = 0, targetX = 0, targetY = 0}
local sections = {}
local currentSectionIdx = 0
local links = {}  -- Table of all clickable links in current section
local focusedLinkIdx = 0  -- Currently focused link (for tab navigation)
local visitedSections = {}  -- Track which sections have been visited (by ID)
local hiddenSections = {}  -- Track which sections are hidden (by ID)
local removedSections = {}  -- Track which sections have been removed (by ID)

-- Parse markdown links from text: [text](target)
local function parseLinks(text)
  local foundLinks = {}
  for linkText, target in text:gmatch("%[([^%]]+)%]%(([^%)]+)%)") do
    table.insert(foundLinks, {text = linkText, target = target})
  end
  return foundLinks
end

-- Find section by ID or title
local function findSectionByReference(ref)
  -- Remove leading # if present
  if ref:sub(1,1) == "#" then
    ref = ref:sub(2)
  end
  
  -- Try exact title match FIRST (most common case)
  for i, section in ipairs(sections) do
    if section.title == ref then
      return section
    end
  end
  
  -- Try exact ID match
  for i, section in ipairs(sections) do
    if section.id == ref then
      return section
    end
  end
  
  -- Try title match (case-insensitive)
  local lowerRef = ref:lower()
  for i, section in ipairs(sections) do
    if section.title:lower() == lowerRef then
      return section
    end
  end
  
  -- Try partial title match
  for i, section in ipairs(sections) do
    if section.title:lower():find(lowerRef, 1, true) then
      return section
    end
  end
  
  return nil
end

-- Check if a section has been visited (by title)
local function isVisited(sectionTitle)
  return visitedSections[sectionTitle] == true
end

-- Check if a section is hidden (by title)
local function isHidden(sectionTitle)
  return hiddenSections[sectionTitle] == true
end

-- Check if a section has been removed (by title)
local function isRemoved(sectionTitle)
  return removedSections[sectionTitle] == true
end

-- Mark a section as visited (by title)
local function markVisited(sectionTitle)
  visitedSections[sectionTitle] = true
  hiddenSections[sectionTitle] = nil  -- Unhide when visited
end

-- Hide a section (by title)
local function hideSection(sectionTitle)
  hiddenSections[sectionTitle] = true
end

-- Remove a section (by title)
local function removeSection(sectionTitle)
  removedSections[sectionTitle] = true
end

-- Restore a removed section (by title)
local function restoreSection(sectionTitle)
  removedSections[sectionTitle] = nil
end

-- Filter out list items that contain only links to removed sections
local function filterRemovedSectionLinks(content)
  local lines = {}
  
  for line in content:gmatch("[^\n]+") do
    local trimmedLine = line:match("^%s*(.-)%s*$") -- trim whitespace
    
    -- Check for list item pattern: bullet + optional whitespace + content
    local bullet, restOfLine = trimmedLine:match("^([*+-])%s+(.+)$")
    
    if bullet and restOfLine then
      -- Check if the rest is purely a link (no other text)
      local linkText, target = restOfLine:match("^%[([^%]]+)%]%(([^%)]+)%)$")
      
      if linkText and target then
        -- This is a list item with ONLY a link
        local targetSection = findSectionByReference(target)
        
        if targetSection and isRemoved(targetSection.title) then
          -- Skip this entire list item
          goto continue
        end
      end
      -- Otherwise, it's a list item with mixed content or just text - keep it
    end
    
    -- Keep this line (either not a list item, or a list item we want to keep)
    table.insert(lines, line)
    
    ::continue::
  end
  
  return table.concat(lines, "\n")
end

local function calculateSectionPositions()
  local currentX, currentY = 0, 0
  local maxHeightInRow, sectionsInRow = 0, 0
  for i, section in ipairs(sections) do
    -- Check if section has metadata with x,y position
    if section.metadata and section.metadata.x and section.metadata.y then
      section.x, section.y = section.metadata.x, section.metadata.y
    else
      section.x, section.y = currentX, currentY
      sectionsInRow = sectionsInRow + 1
      maxHeightInRow = math.max(maxHeightInRow, SECTION_HEIGHT)
      if sectionsInRow >= MAX_SECTIONS_PER_ROW then
        currentX, currentY = 0, currentY + maxHeightInRow + SECTION_PADDING
        maxHeightInRow, sectionsInRow = 0, 0
      else
        currentX = currentX + SECTION_WIDTH + SECTION_PADDING
      end
    end
    section.width, section.height = SECTION_WIDTH, SECTION_HEIGHT
  end
end

local function wrapText(text, maxWidth)
  local lines, words = {}, {}
  for word in text:gmatch("%S+") do table.insert(words, word) end
  local currentLine = ""
  for _, word in ipairs(words) do
    if #currentLine + #word + 1 <= maxWidth then
      currentLine = (#currentLine > 0) and (currentLine .. " " .. word) or word
    else
      if #currentLine > 0 then table.insert(lines, currentLine) end
      currentLine = word
    end
  end
  if #currentLine > 0 then table.insert(lines, currentLine) end
  return lines
end

-- Parse and render inline markdown (bold, italic)
local function renderInlineMarkdown(text, x, y, maxWidth, baseColor, baseBold)
  local currentX = x
  local pos = 1
  local isBold = baseBold or false
  local isItalic = false
  
  while pos <= #text and currentX < x + maxWidth do
    if pos + 1 <= #text and text:sub(pos, pos + 1) == "**" then
      isBold = not isBold
      pos = pos + 2
    elseif text:sub(pos, pos) == "*" and (pos == 1 or text:sub(pos - 1, pos - 1) ~= "*") and
           (pos == #text or text:sub(pos + 1, pos + 1) ~= "*") then
      isItalic = not isItalic
      pos = pos + 1
    elseif text:sub(pos, pos) == "_" then
      local prevChar = (pos > 1) and text:sub(pos - 1, pos - 1) or " "
      local nextChar = (pos < #text) and text:sub(pos + 1, pos + 1) or " "
      if prevChar:match("[%s%p]") and nextChar:match("[%s%p]") or
         prevChar:match("%s") or nextChar:match("%s") or
         pos == 1 or pos == #text then
        isItalic = not isItalic
        pos = pos + 1
      else
        local char = text:sub(pos, pos)
        buffer:write(currentX, y, char, baseColor, 0, isBold, false, isItalic)
        currentX = currentX + 1
        pos = pos + 1
      end
    else
      local char = text:sub(pos, pos)
      buffer:write(currentX, y, char, baseColor, 0, isBold, false, isItalic)
      currentX = currentX + 1
      pos = pos + 1
    end
  end
  
  return currentX - x
end

-- Render text with inline link highlighting and markdown formatting
-- Links to removed sections are rendered as plain text
local function renderTextWithLinks(text, x, y, maxWidth, linkStyle)
  local pos = 0
  local currentX = x
  local globalLinkIdx = #links + 1
  
  while pos < #text do
    local linkStart, linkEnd, linkText, target = text:find("%[([^%]]+)%]%(([^%)]+)%)", pos + 1)
    
    if linkStart then
      local beforeLink = text:sub(pos + 1, linkStart - 1)
      if #beforeLink > 0 then
        local charsRendered = renderInlineMarkdown(beforeLink, currentX, y, maxWidth - (currentX - x), 37, false)
        currentX = currentX + charsRendered
      end
      
      -- Check if target section is removed
      local targetSection = findSectionByReference(target)
      local shouldRenderLink = not (targetSection and isRemoved(targetSection.title))
      
      if shouldRenderLink then
        -- Render as active link
        local isFocused = (globalLinkIdx == focusedLinkIdx)
        local linkColor = isFocused and 33 or 34
        local linkBold = isFocused
        local isUnderlined = true
        
        if linkStyle then
          table.insert(links, {
            text = linkText,
            target = target,
            screenX = currentX,
            screenY = y,
            width = #linkText,
            index = globalLinkIdx
          })
        end
        
        for i = 1, #linkText do
          if currentX < x + maxWidth then
            buffer:write(currentX, y, linkText:sub(i, i), linkColor, 0, linkBold, isUnderlined)
            currentX = currentX + 1
          end
        end
        
        globalLinkIdx = globalLinkIdx + 1
      else
        -- Render as plain text (dimmed/grayed out)
        local charsRendered = renderInlineMarkdown(linkText, currentX, y, maxWidth - (currentX - x), 30, false)
        currentX = currentX + charsRendered
      end
      
      pos = linkEnd
    else
      local remaining = text:sub(pos + 1)
      if #remaining > 0 then
        renderInlineMarkdown(remaining, currentX, y, maxWidth - (currentX - x), 37, false)
      end
      break
    end
  end
end

local function renderSection(section, screenX, screenY, viewport)
  local isCurrent = section.index == currentSectionIdx
  
  -- Skip removed sections entirely
  if isRemoved(section.title) then
    return
  end
  
  if isCurrent then
    links = {}
    if focusedLinkIdx == 0 then
      focusedLinkIdx = 1
    end
  end
  
  local contentY = screenY
  local contentX = screenX
  local maxContentWidth = section.width
  local lines = {}
  
  local function formatHeading(text)
    local cleaned = text:gsub("^#+%s*", "")
    cleaned = cleaned:gsub("_", " ")
    cleaned = cleaned:gsub("(%a)([%w_']*)", function(first, rest)
      return first:upper() .. rest:lower()
    end)
    return cleaned
  end
  
  -- If section is hidden and not current, show placeholder
  local hidden = isHidden(section.title)
  if hidden and not isCurrent then
    local placeholder = "???"
    local centerX = contentX + math.floor((maxContentWidth - #placeholder) / 2)
    local centerY = contentY + math.floor(section.height / 2)
    buffer:write(centerX, centerY, placeholder, 30, 0, true)
    return
  end
  
  -- Preprocess content to filter removed links in list items
  local processedContent = filterRemovedSectionLinks(section.content)
  
  for line in processedContent:gmatch("[^\n]+") do
    if line:match("^#+%s") then
      table.insert(lines, {type = "heading", text = line})
    elseif line:match("^```") then
      table.insert(lines, {type = "code", text = line})
    else
      if line:match("%[.-%]%(.-%)") then
        table.insert(lines, {type = "text", text = line, hasLinks = true})
      else
        local wrapped = wrapText(line, maxContentWidth)
        for _, wLine in ipairs(wrapped) do
          table.insert(lines, {type = "text", text = wLine, hasLinks = false})
        end
      end
    end
  end
  
  for _, line in ipairs(lines) do
    if contentY >= screenY + section.height then break end
    if line.type == "heading" then
      local formatted = formatHeading(line.text)
      local displayText = (#formatted > maxContentWidth) and formatted:sub(1, maxContentWidth) or formatted
      buffer:write(contentX, contentY, displayText, 33, true)
    elseif line.type == "code" then
      buffer:write(contentX, contentY, line.text, 36, false)
    else
      if line.hasLinks then
        renderTextWithLinks(line.text, contentX, contentY, maxContentWidth, isCurrent)
      elseif line.text:match("%*%*") or line.text:match("%*[^%*]") or line.text:match("_[^_]+_") then
        renderInlineMarkdown(line.text, contentX, contentY, maxContentWidth, 37, false)
      else
        buffer:write(contentX, contentY, line.text, 37, false)
      end
    end
    contentY = contentY + 1
  end
  
  if isCurrent and #links == 0 then
    focusedLinkIdx = 0
  end
end

local function updateCamera(deltaTime)
  local t = math.min(1.0, deltaTime * SMOOTH_SPEED)
  camera.x = camera.x + (camera.targetX - camera.x) * t
  camera.y = camera.y + (camera.targetY - camera.y) * t
  if math.abs(camera.targetX - camera.x) < 0.5 then camera.x = camera.targetX end
  if math.abs(camera.targetY - camera.y) < 0.5 then camera.y = camera.targetY end
end

local function centerOnSection(sectionIdx)
  if sectionIdx < 0 or sectionIdx >= #sections then return end
  local section = sections[sectionIdx + 1]
  local viewport = getViewport()
  camera.targetX = section.x + section.width / 2 - viewport.width / 2
  camera.targetY = section.y + section.height / 2 - viewport.height / 2
end

local function navigateToLink(link)
  local targetSection = findSectionByReference(link.target)
  if targetSection then
    gotoSection(targetSection.index)
    currentSectionIdx = targetSection.index
    centerOnSection(currentSectionIdx)
    focusedLinkIdx = 0
    
    -- Mark new section as visited
    markVisited(targetSection.title)
    
    -- Check if target section should be removed after visit
    if targetSection.metadata and targetSection.metadata.removeAfterVisit then
      targetSection._pendingRemoval = true
    end
  end
end

function globalRender()
  buffer:clear()
  
  if viewportChanged() then
    centerOnSection(currentSectionIdx)
  end
  
  -- Mark current section as visited
  local currentSection = sections[currentSectionIdx + 1]
  if currentSection then
    markVisited(currentSection.title)
  end
  
  local viewport = getViewport()
  local cameraX, cameraY = math.floor(camera.x), math.floor(camera.y)
  
  for _, section in ipairs(sections) do
    if not isRemoved(section.title) then
      local screenX, screenY = section.x - cameraX, section.y - cameraY
      if screenX + section.width >= 0 and screenX < viewport.width and
         screenY + section.height >= 0 and screenY < viewport.height then
        renderSection(section, screenX, screenY, viewport)
      end
    end
  end
  
  local statusY = viewport.height - 1
  if statusY >= 0 and currentSection then
    local linkInfo = (#links > 0) and string.format(" | Arrows/Tab: cycle links (%d) | Enter: follow", #links) or ""
    local status = string.format(" %s%s | 1-9: jump to section | Q: quit ", 
                                currentSection.title, linkInfo)
    if #status > viewport.width then status = status:sub(1, viewport.width) end
    buffer:write(0, statusY, status, 30, false)
  end
end

function globalUpdate(dt)
  updateCamera(dt)
  
  -- Handle pending section removals
  for _, section in ipairs(sections) do
    if section._pendingRemoval and section.index ~= currentSectionIdx then
      removeSection(section.title)
      section._pendingRemoval = nil
    end
  end
end

function globalHandleKey(key)
  if key.name == "enter" then
    if focusedLinkIdx > 0 and focusedLinkIdx <= #links then
      navigateToLink(links[focusedLinkIdx])
    end
  elseif key.name == "tab" then
    if #links > 0 then
      focusedLinkIdx = (focusedLinkIdx % #links) + 1
    end
  elseif key.char >= "1" and key.char <= "9" then
    local idx = tonumber(key.char) - 1
    if idx < #sections then
      gotoSection(idx)
      currentSectionIdx = idx
      centerOnSection(currentSectionIdx)
      focusedLinkIdx = 0
    end
  elseif key.name == "q" or key.name == "Q" then
    running = false
  end
end

function globalHandleArrow(direction)
  if direction == "up" then
    if #links > 0 then
      focusedLinkIdx = focusedLinkIdx - 1
      if focusedLinkIdx < 1 then
        focusedLinkIdx = #links
      end
    end
  elseif direction == "down" then
    if #links > 0 then
      focusedLinkIdx = (focusedLinkIdx % #links) + 1
    end
  end
end

function globalHandleShiftTab()
  if #links > 0 then
    focusedLinkIdx = focusedLinkIdx - 1
    if focusedLinkIdx < 1 then
      focusedLinkIdx = #links
    end
  end
end

function globalHandleMouse(event)
  if event.type == "down" then
    for _, link in ipairs(links) do
      if event.x >= link.screenX and event.x < link.screenX + link.width and
         event.y == link.screenY then
        navigateToLink(link)
        return
      end
    end
  elseif event.type == "move" then
    local oldFocus = focusedLinkIdx
    focusedLinkIdx = 0
    
    for _, link in ipairs(links) do
      if event.x >= link.screenX and event.x < link.screenX + link.width and
         event.y == link.screenY then
        focusedLinkIdx = link.index
        break
      end
    end
  end
end

function Canvas.init()
  local allSections = getAllSections()
  sections = {}
  for i = 1, #allSections do 
    table.insert(sections, allSections[i])
  end
  
  calculateSectionPositions()
  local current = getCurrentSection()
  currentSectionIdx = current.index
  
  -- Initialize section visibility based on metadata
  for i, section in ipairs(sections) do
    if section.metadata then
      if section.metadata.hidden then
        hideSection(section.title)
      end
    end
  end
  
  -- Mark starting section as visited
  if sections[currentSectionIdx + 1] then
    markVisited(sections[currentSectionIdx + 1].title)
  end
  
  centerOnSection(currentSectionIdx)
  camera.x, camera.y = camera.targetX, camera.targetY
  setMultiSectionMode(true)
  
  enableMouse()
end

-- Public API

function Canvas.hideSection(ref)
  local section = findSectionByReference(ref)
  if section then
    hideSection(section.title)
  end
end

function Canvas.removeSection(ref)
  local section = findSectionByReference(ref)
  if section then
    removeSection(section.title)
  end
end

function Canvas.restoreSection(ref)
  local section = findSectionByReference(ref)
  if section then
    restoreSection(section.title)
  end
end

function Canvas.isVisited(ref)
  local section = findSectionByReference(ref)
  if section then
    return isVisited(section.title)
  end
  return false
end

function Canvas.markVisited(ref)
  local section = findSectionByReference(ref)
  if section then
    markVisited(section.title)
  end
end

return Canvas
