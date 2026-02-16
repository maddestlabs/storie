---
title: "Canvas Presentation Demo"
author: "Maddest Labs"
theme: "catppuccin"
fontsize: 24
---

```nim on:init
# Canvas-based Presentation System using Nimini
# Navigate with arrow keys: Left/Right for main topics, Up/Down for subtopics

print "Presentation initialized"

# Initialize canvas in presentation mode
# Second parameter = starting section (1 for first real section)
# Third parameter = presentation mode (true)
initCanvas(1, true)
```

```nim on:input
# Handle keyboard and mouse input for canvas navigation

if event.type == "key":
  if event.action == "press":
    # Pass key events to canvas system
    var handled = canvasHandleKey(event.keyCode, 0)
    if handled:
      return true
  return false

elif event.type == "mouse":
  if event.action == "release":
    # Pass mouse events to canvas system (cell coordinates for navigation)
    var handled = canvasHandleMouse(event.cellX, event.cellY, event.button, false)
    if handled:
      return true
  return false

return false
```

```nim on:render
clear()
canvasRender()
```

```nim on:update
canvasUpdate()
```

# Canvas Presentations

This demo showcases the presentation mode of the canvas system, where arrow keys navigate between slides instead of following links.
⠀
### Navigation Guide
⠀
- **Left/Right arrows**: Navigate between main topics (# headings)
- **Up/Down arrows**: Navigate between subtopics (## headings)
- **Mouse/Touch**: Click/tap left side of screen to go back, right side to go forward
⠀
Let's explore the features!

# Feature Overview
⠀
The canvas presentation system provides:
⠀
- **Hierarchical navigation** based on markdown heading levels
- **Smooth camera transitions** between slides
- **All sections visible** by default (no hidden slides)
- **Dual-mode operation** - can switch between presentation and interactive fiction modes
⠀
This allows you to create engaging slide decks with the same markdown format used for interactive stories.

## Visual Design
⠀
The presentation system inherits all the visual capabilities of TStorie:
⠀
- **Themed styling** with built-in color schemes
- **Terminal graphics** with Unicode box drawing
- **Responsive layout** that adapts to terminal size
- **Rich text formatting** with markdown support

## Code Integration
⠀
Presentations can include live Nim code blocks:
⠀
```nim
var slideCount = 0
slideCount += 1
print "You're viewing slide: " & $slideCount
```
⠀
This allows for interactive demonstrations and live coding examples during presentations.

## Smooth Animations
⠀
The camera system provides smooth easing transitions between slides, making navigation feel natural and professional.
⠀
The animation system uses **quadratic ease-out** for smooth, non-linear motion that feels responsive and polished.

# Use Cases
⠀
Canvas presentations are perfect for:
⠀
- **Technical talks** with code examples
- **Interactive tutorials** that respond to user input
- **Documentation** that readers can navigate freely
- **Story outlines** and narrative structures
- **Educational content** with progressive disclosure

## Conference Presentations
⠀
Present your technical work with:
⠀
- Live code execution
- Interactive demonstrations
- Terminal-based aesthetics
- No dependency on GUI presentation software

## Educational Materials
⠀
Create engaging learning experiences:
⠀
- Progressive concept introduction
- Interactive code examples
- Self-paced navigation
- Integrated exercises

## Documentation
⠀
Build navigable documentation:
⠀
- Hierarchical topic organization
- Quick navigation between sections
- Rich formatting support
- Code and text integration

# Technical Details
⠀
The presentation mode is implemented as a flag in the canvas system's state management.
⠀
When `presentationMode: true`, the keyboard handler changes behavior:
- Arrow keys navigate between sections by heading level
- All sections are made visible on initialization
- Link navigation is disabled (can be re-enabled if needed)

## Implementation
⠀
Key components:
⠀
1. **Section hierarchy detection** - Analyzes markdown heading levels
2. **Level-based navigation** - Finds next/previous sections at specified levels
3. **Camera control** - Smooth panning between slides
4. **State management** - Tracks current slide and navigation history

## Backward Compatibility
⠀
The presentation mode is fully backward compatible:
⠀
- Existing interactive fiction demos continue to work
- Default mode is interactive (link-based navigation)
- No breaking changes to existing APIs
- Simple opt-in via boolean parameter

# Future Enhancements
⠀
Potential additions to the presentation system:
⠀
- **Slide transitions** with different animation styles
- **Speaker notes** that don't appear on main view
- **Timers** and progress indicators
- **Export formats** (HTML, PDF via terminal rendering)
- **Remote control** via network commands

## Animation System
⠀
Additional transitions could include:
⠀
- Fade effects
- Slide-in/slide-out
- Zoom transitions
- Custom easing functions

## Collaboration Features
⠀
Multi-user presentation capabilities:
⠀
- Follow-along mode for audiences
- Real-time slide synchronization
- Collaborative editing
- Q&A integration

# Conclusion
⠀
The canvas presentation system demonstrates the flexibility of TStorie's architecture.
⠀
By adding a simple mode flag, we've created an entirely new use case while preserving all existing functionality.
⠀
**Thank you for exploring this demo!**
⠀
Feel free to create your own presentations using this system. Just set `initCanvas(1, true)` in your init block.
⠀
*Press Left/Right arrows to navigate back through the slides.*
