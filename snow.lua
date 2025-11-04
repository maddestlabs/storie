-- snow.lua - Realistic snow effect module for Storie
-- Can be embedded in any Markdown content with:
-- ```lua module:snow
-- [paste this file content]
-- ```

local Snow = {}

-- Configuration
local SNOW_COUNT = 50
local BEHIND_COUNT = 20
local FRONT_COUNT = 20
local STICKY_COUNT = 10

-- Private state
local particles = {}
local viewport = {}
local initialized = false
local contentCells = {}  -- Track which cells have content

-- Initialize snow particles
local function initParticles()
    particles = {}
    viewport = getViewport()
    
    for i = 1, SNOW_COUNT do
        local layer
        if i <= BEHIND_COUNT then
            layer = "behind"
        elseif i <= BEHIND_COUNT + FRONT_COUNT then
            layer = "front"
        else
            layer = "sticky"
        end
        
        table.insert(particles, {
            x = math.random(0, viewport.width - 1),
            y = math.random(-viewport.height, viewport.height - 1),
            speed = math.random(3, 8) / 10,  -- Varying fall speeds
            drift = math.random(-1, 1) / 10,  -- Slight horizontal drift
            layer = layer,
            stuck = false,
            stuckX = 0,
            stuckY = 0,
            char = "."
        })
    end
    
    initialized = true
end

-- Check if a position has content (non-space character)
local function hasContentAt(x, y)
    local key = x .. "," .. y
    return contentCells[key] == true
end

-- Mark a position as having content
local function markContent(x, y)
    local key = x .. "," .. y
    contentCells[key] = true
end

-- Clear content tracking
local function clearContentTracking()
    contentCells = {}
end

-- Update snow particles
function Snow.update(dt)
    if not initialized then
        initParticles()
    end
    
    viewport = getViewport()
    
    for _, particle in ipairs(particles) do
        if not particle.stuck then
            -- Update position
            particle.y = particle.y + particle.speed * dt * 20
            particle.x = particle.x + particle.drift * dt * 10
            
            -- Wrap horizontal position
            if particle.x < 0 then
                particle.x = viewport.width - 1
            elseif particle.x >= viewport.width then
                particle.x = 0
            end
            
            -- Check if particle should stick (sticky layer only)
            if particle.layer == "sticky" and particle.y >= 0 then
                local checkX = math.floor(particle.x)
                local checkY = math.floor(particle.y) + 1
                
                -- Stick if there's content below or at bottom of screen
                if checkY >= viewport.height - 1 or 
                   (checkY >= 0 and hasContentAt(checkX, checkY)) then
                    particle.stuck = true
                    particle.stuckX = math.floor(particle.x)
                    particle.stuckY = math.floor(particle.y)
                end
            end
            
            -- Reset particle if it falls off screen
            if particle.y >= viewport.height then
                particle.y = math.random(-10, -1)
                particle.x = math.random(0, viewport.width - 1)
                particle.speed = math.random(3, 8) / 10
                particle.drift = math.random(-1, 1) / 10
            end
        end
    end
end

-- Render behind layer (call before rendering content)
function Snow.renderBehind()
    if not initialized then
        return
    end
    
    for _, particle in ipairs(particles) do
        if particle.layer == "behind" and not particle.stuck then
            local x = math.floor(particle.x)
            local y = math.floor(particle.y)
            
            if y >= 0 and y < viewport.height and x >= 0 and x < viewport.width then
                -- Render with dimmed style to appear behind
                buffer:writeStyled(x, y, particle.char, "disabled")
            end
        end
    end
end

-- Render front layer (call after rendering content)
function Snow.renderFront()
    if not initialized then
        return
    end
    
    for _, particle in ipairs(particles) do
        local render = false
        local x, y
        
        if particle.layer == "front" and not particle.stuck then
            x = math.floor(particle.x)
            y = math.floor(particle.y)
            render = true
        elseif particle.layer == "sticky" then
            if particle.stuck then
                x = particle.stuckX
                y = particle.stuckY
                render = true
            else
                x = math.floor(particle.x)
                y = math.floor(particle.y)
                -- Don't render sticky particles if content is in the way
                if not hasContentAt(x, y) then
                    render = true
                end
            end
        end
        
        if render and y >= 0 and y < viewport.height and x >= 0 and x < viewport.width then
            buffer:writeStyled(x, y, particle.char, "default")
        end
    end
end

-- Track content being rendered (call this when rendering text)
function Snow.trackContent(x, y, text)
    if text then
        for i = 1, #text do
            local char = text:sub(i, i)
            if char ~= " " then
                markContent(x + i - 1, y)
            end
        end
    else
        markContent(x, y)
    end
end

-- Clear content tracking (call at start of each render)
function Snow.clearTracking()
    clearContentTracking()
end

-- Render all sections with snow (reads actual markdown content)
function Snow.renderAllContent()
    if not initialized then
        initParticles()
    end
    
    buffer:clear()
    viewport = getViewport()
    local scrollY = getScrollY()
    
    Snow.clearTracking()
    
    -- Render behind layer
    Snow.renderBehind()
    
    -- Get all sections and render them
    local sections = getAllSections()
    local y = 0
    
    if sections then
        for i = 1, #sections do
            local section = sections[i]
            
            -- Render section title as heading
            if section.title and section.title ~= "" and section.title ~= "Untitled" then
                local displayY = y - scrollY
                if displayY >= 0 and displayY < viewport.height - 1 then
                    local heading = string.rep("#", section.level) .. " " .. section.title
                    Snow.trackContent(0, displayY, heading)
                    buffer:writeStyled(0, displayY, heading, "heading")
                end
                y = y + 1
            end
            
            -- Render section content
            if section.content and section.content ~= "" then
                local inCodeBlock = false
                
                -- Split by lines
                for line in (section.content .. "\n"):gmatch("([^\n]*)\n") do
                    local displayY = y - scrollY
                    
                    -- Track code block state
                    if line:match("^```") then
                        inCodeBlock = not inCodeBlock
                    end
                    
                    -- Skip lua code blocks and heading lines that match section title
                    local isHeadingLine = line:match("^#+%s")
                    local skipLine = inCodeBlock or line:match("^```")
                    
                    -- Skip if this heading matches the section title we already rendered
                    if isHeadingLine and section.title and section.title ~= "Untitled" then
                        local lineTitle = line:match("^#+%s+(.+)$")
                        if lineTitle == section.title then
                            skipLine = true
                        end
                    end
                    
                    if not skipLine then
                        if displayY >= 0 and displayY < viewport.height - 1 then
                            if line ~= "" then
                                Snow.trackContent(0, displayY, line)
                                
                                -- Simple markdown parsing
                                if isHeadingLine then
                                    buffer:writeStyled(0, displayY, line, "heading")
                                elseif line:match("^%*%*.*%*%*") or line:match("^__.*__") then
                                    buffer:writeStyled(0, displayY, line, "info")
                                elseif line:match("^%s*%-") or line:match("^%s*%d+%.") then
                                    buffer:writeStyled(0, displayY, line, "default")
                                else
                                    buffer:writeStyled(0, displayY, line, "default")
                                end
                            end
                        end
                        y = y + 1
                    end
                end
            end
            
            -- Add spacing between sections
            y = y + 1
        end
    end
    
    -- Show controls at bottom
    local controls = "↑/↓: Scroll | ESC/Ctrl+C: Exit"
    if viewport.height > 2 then
        buffer:writeStyled(2, viewport.height - 1, controls, "disabled")
    end
    
    -- Render front layer
    Snow.renderFront()
end

-- Convenience function for simple single-section rendering
function Snow.renderWithDefaultContent()
    Snow.renderAllContent()
end

-- Reset snow (useful for viewport changes)
function Snow.reset()
    initialized = false
    particles = {}
    clearContentTracking()
end

-- Get particle count for debugging
function Snow.getParticleCount()
    local behind = 0
    local front = 0
    local sticky = 0
    local stuck = 0
    
    for _, p in ipairs(particles) do
        if p.layer == "behind" then behind = behind + 1
        elseif p.layer == "front" then front = front + 1
        elseif p.layer == "sticky" then sticky = sticky + 1 end
        
        if p.stuck then stuck = stuck + 1 end
    end
    
    return {
        total = #particles,
        behind = behind,
        front = front,
        sticky = sticky,
        stuck = stuck
    }
end

return Snow