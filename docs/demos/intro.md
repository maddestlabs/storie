---
title: "t|Storie ꭲꭼꭱꮇꮖꮑꭺꮮ ꭼꮑᏽꮖꮑꭼ"
author: "Maddest Labs"
theme: "neonopia"
---

```javascript on:init
worlds.enable();
console.log('✓ 3D Canvas enabled!');
worlds.config.setDefaults({
  defaultSectionWidth: 60,        // Default width
  defaultSectionHeight: 24,       // Default height
  autoLayoutSpacing: 150,         // Spacing between auto-laid-out sections (world units)
  sectionBorderEnabled: false,     // Draw a border around each section card
  sectionBackground: 'bg',   // Section card background: 'surface' | 'bg' | 'bgAlt' | 'accent1' | '#RRGGBB' | 0xRRGGBBAA
});
worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 10, 0.5);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSection(0, 50);
```

# Welcome to
⠀
```ascii
 ▄▄▄▄  █  ▄                     
█      █ ▄█▄  ▄▄▄▄ ▄▄▄▄ ▄  ▄▄▄▄▄
 ▀▄▄   █  █   █  █ █    █  █▄▄▄█
    █  █  █   █  █ █    █  █    
▀▀▀▀   █  ▀▀  ▀▀▀▀ ▀    ▀  ▀▀▀▀▀
```
⠀
The abominable, little engine that could,
but probably shouldn't!
⠀
**Ready to explore?**
⠀
- [Start the tour](#tour-start)  
- [Learn about Markdown first](#what-is-markdown)  
- [Skip to advanced features](#advanced-hub)

# What is Markdown?
⠀
Markdown is a simple, plain text language that lets you create formatted documents quickly using basic symbols. It's how you naturally write in Notepad, with special symbols for emphasis.
⠀
For example:
- `# Heading` creates a heading
- `**bold**` creates **bold** text
- `[link](#url)` creates a clickable link
⠀
t|Storie extends Markdown with code blocks that can respond to events, render graphics, and create interactive experiences.
⠀
- [Continue the tour](#tour-start)  
- [Return to start](#welcome-to)

# Tour Start
⠀
**The Journey Begins**
⠀
t|Storie parses Markdown documents into **Sections** (separated by headings) and renders them in a large interactive canvas.
⠀
Each Section can contain:
- **Rich text content** - Markdown-formatted text
- **Links** - Navigate between Sections
- **Code blocks** - Executable Nim code that runs in response to events
- **Front matter** - Configuration variables in YAML format
⠀
Let's explore each feature:
⠀
- [Front Matter Variables](#frontmatter)
- [Markdown Sections](#markdown-sections)
- [Canvas & Rendering](#canvas-rendering)
- [Interactive Code](#interactive-code)
- [Skip to the end](#journey-complete)

# Frontmatter
⠀
At the top of any t|Storie document, you can define variables in YAML format:

```ascii
---
title: "My Story"
author: "Your Name"
targetFPS: 60
theme: "nord"
---
```
⠀
These variables become **global variables** in your code blocks! For example, this document's title is `? title` and it's running at `? targetFPS` FPS.
⠀
Front matter is perfect for configuration, game state, or any data you want to access throughout your document.
⠀
- [Continue to Markdown sections](#markdown-sections)  
- [Back to tour start](#tour-start)

```nim on:enter
visitedFrontmatter = true
explorerLevel++
```

# Markdown Sections {"hidden": true}
⠀
Each `# Heading` in your document creates a new **Section**. Sections are the building blocks of your interactive experience.
⠀
Sections can be:
- **Visible** - Show up in the table of contents
- **Hidden** - Marked with `{"hidden": true}` metadata
- **One-time** - Marked with `{"removeAfterVisit": "true"}`
⠀
Right now, you're in a hidden Section that's navigable via links but doesn't appear in the main contents listing. This is perfect for creating branching narratives!
⠀
- [Learn about canvas rendering](#canvas-rendering)  
- [Jump to interactive code](#interactive-code)  
- [Back to tour start](#tour-start)

```nim on:enter
visitedMarkdown = true
explorerLevel++
```

# Canvas Rendering
⠀
t|Storie provides a powerful terminal-based canvas with multiple layers:
⠀
**Unified Drawing API:**
- `draw(layer, x, y, text)` - Draw text on any layer
- `clear(layer)` - Clear a layer
- `fillRect(layer, x, y, w, h, char)` - Fill a rectangle
⠀
Use `on:render` code blocks to draw each frame!
⠀
- [Explore interactive code](#interactive-code)  
- [See a rendering example](#render-example)  
- [Back to tour](#tour-start)

```nim on:enter
visitedRendering = true
explorerLevel++
```

# Render Example
⠀
Here's a simple rendering code block:

```nim
# Example: on:render
clear()
var msg = "Hello from t|Storie!"
draw(0, 2, 2, msg)
```
⠀
This code would run **every frame** and:
1. Clear the background
2. Calculate center position
3. Draw centered text
⠀
You can combine multiple layers to create complex UIs and graphics!
⠀
- [Continue to interactive code](#interactive-code)  
- [Back to canvas info](#canvas-rendering)

# Interactive Code
⠀
t|Storie supports several event types:
⠀
**`on:init`** - Runs once when document loads  
**`on:render`** - Runs every frame for drawing  
**`on:update`** - Runs every frame for logic  
**`on:input`** - Handles keyboard/mouse events  
**`on:enter`** - Runs when entering a section
⠀
You can track state with variables, respond to player input, and create fully interactive experiences - all within a Markdown document!
⠀
The canvas navigation system you're using right now is built with these code blocks.
⠀
- [Learn about advanced features](#advanced-hub)  
- [Complete the tour](#journey-complete)  
- [Back to tour start](#tour-start)

```nim on:enter
visitedInteractive = true
explorerLevel++
```

# Advanced Hub
⠀
Ready to dive deeper? t|Storie includes powerful features for creating sophisticated interactive experiences:
⠀
- [Animation & Effects](#animation-features)  
- [Audio System](#audio-features)  
- [State Management](#state-management)  
- [Layout & Themes](#layout-themes)  
- [Gist Integration](#gist-integration)  
- [Complete the tour](#journey-complete)

# Animation Features
⠀
t|Storie includes built-in animation helpers:
- **Transitions** - Smooth property changes
- **Easing functions** - Make animations feel natural
- **Timing controls** - Frame-based or time-based
⠀
Combined with the rendering system, you can create:
- Scrolling text effects
- Character movement
- UI transitions
- Screen effects
⠀
Check out `lib/animation.nim` and `lib/transition_helpers.nim` for the full API.
⠀
- [Back to advanced hub](#advanced-hub)

# audio_features
⠀
Generate and play audio directly from your code:
⠀
- **Audio nodes** - Modular sound generation
- **Audio generation** - Create sounds procedurally
- **miniaudio bindings** - Full audio playback support
⠀
Perfect for:
- Background music
- Sound effects
- Interactive audio experiences
- Generative soundscapes
⠀
See `lib/audio.nim`, `lib/audio_gen.nim`, and `lib/audio_nodes.nim` for details.
⠀
- [Back to advanced hub](#advanced-hub)

# State Management
⠀
Manage complex application state with:
⠀
**Variables:**
- Declare with `var myState = false`
- Persist across sections
- Update in `on:enter` blocks
⠀
**Front Matter:**
- Global configuration
- Accessible everywhere
- Easy to modify
⠀
**Section Metadata:**
- Control visibility
- One-time visits
- Conditional content
⠀
- [Back to advanced hub](#advanced-hub)

# Layout Themes
⠀
Customize your experience:
⠀
**Themes:**
- Pre-built color schemes (nord, dark, etc.)
- CSS-like customization
- Theme variables
⠀
**Layout:**
- Responsive text wrapping
- Text box helpers
- Alignment controls
- Custom dimensions
⠀
Check `lib/layout.nim` and `lib/storie_themes.nim`.
⠀
- [Back to advanced hub](#advanced-hub)

# Gist Integration
⠀
**GitHub Gist Integration**
⠀
Load and share documents easily:
- Create a Markdown file in a GitHub Gist
- Get the Gist ID
- Load it directly in t|Storie with `?content=gistid`
⠀
GitHub Gist is totally free, facilitates sharing and collaboration and includes built-in version control. Made a mistake in your code? No problem, just revert back to previous version.
⠀
- [Back to advanced hub](#advanced-hub)

# Journey Complete
⠀
Congratulations! You've explored t|Storie and learned about:
⠀
✓ Markdown sections and navigation
✓ Front matter variables
✓ Canvas rendering system
✓ Interactive code blocks
✓ Event handling
✓ Advanced features
⠀
- [What's Next](#whats-next)
- [Return to start](#welcome-to)

```nim on:enter
# Activate fire particles in this section
inFinalStats = true
```

```nim on:exit
# Deactivate fire when leaving Final Stats section
inFinalStats = false
particleClear("fire")
```

# Whats Next
⠀
Check out these example documents:
- `docs/demos/depths.md` - Full dungeon adventure
- `examples/canvas_demo.md` - Canvas system basics
⠀
Or dive into the source code in `lib/` to see how it all works!
⠀
- [Start over](#welcome-to)  
- [Explore advanced features](#advanced-hub)  
- [See your explorer stats](#final-stats)

# Final Stats
⠀
**Your Explorer Stats**
⠀
**Sections Visited:** `? explorerLevel`
⠀
**Achievements Unlocked:**
⠀
```nim on:enter
contentClear()
if visitedFrontmatter:
  contentWrite("✓ Front Matter Master")
if visitedMarkdown:
  contentWrite("✓ Markdown Navigator")
if visitedRendering:
  contentWrite("✓ Canvas Artist")
if visitedInteractive:
  contentWrite("✓ Code Wizard")
```
⠀
You've completed the t|Storie walkthrough!
⠀
- [Start over](#welcome-to)  
- [Return to journey complete](#journey-complete)

```nim on:render
# Display explorer level at the bottom
if explorerLevel > 0:
  var stats = "Explorer Level: " & str(explorerLevel)
  draw(0, 2, termHeight - 2, stats)
```