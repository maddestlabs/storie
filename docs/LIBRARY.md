# Library Architecture Guide

This document explains how to use Backstorie's helper libraries to build applications efficiently.

## Overview

Backstorie uses a **direct callback architecture** where you define five main callbacks:

- `onInit` - Called once when app starts
- `onUpdate` - Called every frame with delta time
- `onRender` - Called every frame to draw
- `onInput` - Called for each input event
- `onShutdown` - Called when app exits

The **lib/** directory contains helper modules that provide reusable utilities you can import and use within these callbacks.

## Library Modules

### lib/events.nim - Event Handling

Provides a robust event handler with typed callbacks for different input events.

**Key Features:**
- Separate callbacks for key down/up/repeat
- Mouse click, move, drag, and scroll events
- Key state tracking
- Mouse state tracking
- Event filtering and capturing

**Example Usage:**

```nim
import lib/events

var eventHandler: TerminalEventHandler

onInit = proc(state: AppState) =
  eventHandler = newTerminalEventHandler(EventHandlerConfig(
    enableMouseTracking: true,
    consumeEvents: true
  ))
  
  # Setup callbacks
  eventHandler.onKeyDown = proc(code: int, mods: set[uint8]): bool =
    if code == ord('q'):
      state.running = false
      return true
    return false
  
  eventHandler.onMouseDown = proc(btn: MouseButton, x, y: int, mods: set[uint8]): bool =
    echo "Clicked at ", x, ", ", y
    return true

onInput = proc(state: AppState, event: InputEvent): bool =
  # Dispatch events to handler
  return eventHandler.dispatchEvent(event)
```

### lib/animation.nim - Animation Utilities

Provides easing functions, interpolation, animation state management, and particle systems.

**Key Features:**
- Easing functions (linear, quad, cubic, sine, etc.)
- Color interpolation
- Animation state with loop/pingpong support
- Particle system

**Example Usage:**

```nim
import lib/animation

var fadeAnim: Animation
var particles: seq[Particle]

onInit = proc(state: AppState) =
  fadeAnim = newAnimation(2.0, loop = true, pingpong = true)
  
  # Create particles
  for i in 0 ..< 10:
    particles.add(newParticle(10.0, 10.0, 1.0, 2.0, 3.0, "*", red()))

onUpdate = proc(state: AppState, dt: float) =
  # Update animation
  fadeAnim.update(dt)
  
  # Update particles
  for p in particles.mitems:
    p.update(dt, gravity = 9.8)

onRender = proc(state: AppState) =
  # Use animation progress
  let t = fadeAnim.progress()
  let alpha = easeInOutSine(t)
  
  # Interpolate colors
  let color = lerpColor(red(), blue(), alpha)
  
  # Render particles
  for p in particles:
    p.render(state)
```

### lib/ui_components.nim - UI Elements

Provides reusable UI components like boxes, buttons, and progress bars.

**Key Features:**
- Box drawing with optional titles
- Button component with hover states
- Progress bars with labels

**Example Usage:**

```nim
import lib/ui_components

var myButton: Button

onInit = proc(state: AppState) =
  myButton = newButton(10, 10, 20, 3, "Click Me")

onRender = proc(state: AppState) =
  # Draw box
  drawBox(state, 5, 5, 50, 20, defaultStyle(), "My Window")
  
  # Draw button
  let hovered = myButton.contains(mouseX, mouseY)
  myButton.render(state, hovered)
  
  # Draw progress bar
  drawProgressBar(state, 10, 15, 40, 0.75, defaultStyle(), "75%")
```

## Architecture Pattern

### Direct State Management

You manage your app state directly in your file:

```nim
import lib/events
import lib/animation

# Your app state
var score = 0
var player = Player(x: 10, y: 10)
var eventHandler: TerminalEventHandler

onInit = proc(state: AppState) =
  # Initialize everything
  eventHandler = newTerminalEventHandler()
  eventHandler.onKeyDown = proc(code: int, mods: set[uint8]): bool =
    # Handle input
    return false

onUpdate = proc(state: AppState, dt: float) =
  # Update game logic
  player.x += player.velocity * dt

onRender = proc(state: AppState) =
  # Draw everything
  state.currentBuffer.writeText(player.x, player.y, "@", defaultStyle())
```

### Why This Pattern?

**Advantages:**
1. **Simplicity** - No boilerplate, no registration, just code
2. **Direct** - Clear flow from callbacks to libraries
3. **Flexible** - Use libraries à la carte, mix and match
4. **Debuggable** - Easy to trace execution
5. **Performant** - No indirection overhead

**When to use libraries:**
- **lib/events** - When you need structured input handling
- **lib/animation** - When you need smooth transitions or particles
- **lib/ui_components** - When you need standard UI elements

**When to code directly:**
- Simple apps with minimal input
- Performance-critical rendering
- Custom game logic
- Unique UI requirements

## Complete Example

Here's a full app using all three libraries:

```nim
import lib/events
import lib/animation
import lib/ui_components

var eventHandler: TerminalEventHandler
var fadeAnim: Animation
var button: Button
var particles: seq[Particle]

onInit = proc(state: AppState) =
  # Setup event handling
  eventHandler = newTerminalEventHandler(EventHandlerConfig(
    enableMouseTracking: true
  ))
  
  eventHandler.onKeyDown = proc(code: int, mods: set[uint8]): bool =
    if code == INPUT_ESCAPE:
      state.running = false
      return true
    return false
  
  eventHandler.onMouseDown = proc(btn: MouseButton, x, y: int, mods: set[uint8]): bool =
    if button.contains(x, y):
      # Spawn particles
      for i in 0 ..< 10:
        particles.add(newParticle(float(x), float(y), 
                                  float(i-5), -5.0, 2.0, "*", yellow()))
      return true
    return false
  
  # Setup animation
  fadeAnim = newAnimation(2.0, loop = true, pingpong = true)
  
  # Setup UI
  button = newButton(state.termWidth div 2 - 10, state.termHeight div 2, 20, 3, "Click Me!")

onUpdate = proc(state: AppState, dt: float) =
  fadeAnim.update(dt)
  for p in particles.mitems:
    p.update(dt, gravity = 10.0)

onRender = proc(state: AppState) =
  let progress = fadeAnim.progress()
  let alpha = easeInOutSine(progress)
  let color = lerpColor(cyan(), magenta(), alpha)
  
  # Draw UI
  drawBox(state, 0, 0, state.termWidth, state.termHeight, 
          Style(fg: color, bg: black()), "Library Demo")
  
  let hovered = button.contains(eventHandler.mouseState.x, eventHandler.mouseState.y)
  button.render(state, hovered)
  
  # Draw particles
  for p in particles:
    p.render(state)

onInput = proc(state: AppState, event: InputEvent): bool =
  return eventHandler.dispatchEvent(event)

onShutdown = proc(state: AppState) =
  discard
```

## Creating Your Own Libraries

You can create your own helper libraries following the same pattern:

```nim
# mylib.nim
import ../backstorie

type
  MyWidget* = object
    x*, y*: int
    label*: string

proc newMyWidget*(x, y: int, label: string): MyWidget* =
  MyWidget(x: x, y: y, label: label)

proc render*(widget: MyWidget, state: AppState) =
  state.currentBuffer.writeText(widget.x, widget.y, widget.label, defaultStyle())
```

Then use it:

```nim
import mylib

var widget: MyWidget

onInit = proc(state: AppState) =
  widget = newMyWidget(10, 10, "Hello")

onRender = proc(state: AppState) =
  widget.render(state)
```

## Best Practices

1. **Import only what you need** - Don't import unused libraries
2. **Initialize in onInit** - Setup handlers and state when the app starts
3. **Update in onUpdate** - Keep game logic separate from rendering
4. **Render in onRender** - Keep rendering separate from logic
5. **Handle events in onInput** - Use eventHandler.dispatchEvent() for structured handling
6. **Clean up in onShutdown** - Close files, log stats, etc.

## Platform Compatibility

All libraries work identically on:
- Native terminal (Linux, macOS, Windows)
- WebAssembly/Browser

No platform-specific code needed in your app or libraries!

## Performance Tips

1. **Reuse objects** - Don't create new objects every frame
2. **Batch operations** - Group similar rendering calls
3. **Cull off-screen** - Don't render what's not visible
4. **Limit particles** - Cap particle counts for mobile/web
5. **Profile first** - Measure before optimizing

## Next Steps

- Check out `example_using_libs.nim` for a working demonstration
- Read the source of `lib/*.nim` to understand implementation details
- Create your own helper libraries for reusable components
- Share your libraries with the community!
