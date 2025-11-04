---
title: "Canvas Navigation Demo"
author: "Storied Plugin System"
minWidth: 60
minHeight: 20
---

```lua global
-- Initialize canvas plugin
local canvas = require("canvas")
canvas.init()
```

# Welcome to Canvas Mode

This is the first section. You can navigate around the canvas using:

- **Arrow keys** or **WASD** to pan the camera
- **N** or **Space** to go to next section
- **P** to go to previous section
- **Number keys (1-9)** to jump directly to a section
- **Q** to quit

Multiple sections are visible at once! Try panning around to see them all.

The section you're currently in is highlighted with a yellow border.

**Try resizing your terminal, changing font size, or going fullscreen - the canvas will automatically re-center on the current section!**

# Exploration Section

This is the second section, positioned to the right of the first.

Notice how you can see multiple sections at once when you pan around?

The canvas automatically lays out sections in a grid, but you can also manually position them using JSON metadata in the heading.

# Discovery

Keep exploring! Each section is a 60x20 character box on the canvas.

You can have as many sections as you want, and the canvas will grow to accommodate them.

# Advanced Features

You can manually position sections using JSON in the heading like this:

`# My Section {"x": 200, "y": 100}`

This gives you full control over the spatial layout of your story.

# Interactive Stories

The canvas system is perfect for:

- Non-linear narratives
- Exploration-based games
- Spatial storytelling
- Choice-driven adventures

Each section can have its own Lua scripts for custom behavior!

# More Content

This is section 6. Keep exploring to find all the sections!

The smooth panning makes navigation feel fluid and natural.

# Hidden Area

You found section 7! This one is a bit off the main path.

Try using the number keys to jump between sections quickly.

# Final Section

Congratulations! You've explored the canvas navigation system.

Now you can create your own spatially-aware interactive stories.

Press Q to exit when you're done exploring.

# Hidden Easter Egg {"x": 250, "y": 150}

You found the secret section! This one is manually positioned far away from the others.

Notice in the heading it says `{"x": 250, "y": 150}` - this tells the canvas plugin exactly where to place this section.

Try panning back to the main sections, or press 9 to jump here directly!