---
title: "Snow Demo"
author: "Example"
minWidth: 80
minHeight: 24
---

```lua global
-- Load the snow module
local snow = require("snow")

-- Track viewport changes
local lastWidth = 0
local lastHeight = 0

-- Global render: let snow module handle everything
function globalRender()
    snow.renderAllContent()
end

-- Global update: update snow animation
function globalUpdate(dt)
    local vp = getViewport()
    
    -- Reset snow if viewport changed
    if vp.width ~= lastWidth or vp.height ~= lastHeight then
        snow.reset()
        lastWidth = vp.width
        lastHeight = vp.height
    end
    
    snow.update(dt)
end

-- Handle arrow keys for scrolling
function globalHandleArrow(direction)
    local scrollY = getScrollY()
    if direction == "up" then
        setScrollY(math.max(0, scrollY - 1))
    elseif direction == "down" then
        setScrollY(scrollY + 1)
    end
end
```

```lua on:startup
setMultiSectionMode(true)
```

# Welcome to the Snow Demo

This is a demonstration of the **snow effect module** for Storie.

As you read this content, you'll notice snow particles falling in different layers:

- **20 snow particles** falling *behind* the text (dimmed)
- **20 snow particles** falling *in front* of the text (normal brightness)  
- **10 snow particles** that try to *stick on top* of content

The snow particles continuously fall from top to bottom with slight horizontal drift for a more realistic effect.

## How It Works

The snow module provides three rendering layers:

1. **Behind layer** - Renders first, appears dimmed beneath content
2. **Content** - Your markdown content with collision tracking
3. **Front layer** - Renders last, appears over content

Sticky particles will land on top of text characters and stay there!

## Features

- Realistic falling animation with varying speeds
- Horizontal drift for natural movement
- Collision detection for sticky particles
- Viewport resize handling
- Configurable particle counts
- Automatic markdown rendering

## More Content

Add as much content as you want! The snow will continue falling throughout your entire story.

You can scroll through multiple screens and the snow will keep animating smoothly.

Each particle has its own speed and drift, creating a natural snow-like appearance.

## Customization

You can modify the snow module to:

- Change particle counts (edit SNOW_COUNT, BEHIND_COUNT, etc.)
- Adjust fall speeds (modify the speed range)
- Modify drift amounts (change drift calculation)
- Use different characters (change the char field, try ❄, *, o)
- Add color variations
- Implement wind effects

## Another Section

This demonstrates that you can have multiple markdown sections and the snow will render across all of them seamlessly.

Just write your content normally in markdown!

## The End

Enjoy the snow! ❄️

Press ESC or Ctrl+C to exit.