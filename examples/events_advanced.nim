## Advanced Event Handler Example - Direct API Version
## Showcases event handling without plugin boilerplate
## 
## Features demonstrated:
## - Key capture and ignore patterns
## - Multi-callback event handling  
## - Key state tracking (pressed, repeat count)
## - Mouse state tracking (position, buttons, dragging)
## - Event consumption/delegation
## - Key binding simulation
## - Event filtering and statistics

import std/[strformat, tables, sets, hashes, times]

# ================================================================
# EVENT HANDLER (inlined for this example)
# ================================================================

type
  KeyState = object
    code: int
    mods: set[uint8]
    isPressed: bool
    repeatCount: int
    lastEventTime: float

  MouseState = object
    x, y: int
    leftPressed: bool
    middlePressed: bool
    rightPressed: bool
    lastX, lastY: int
    dragStartX, dragStartY: int
    isDragging: bool

  TerminalEventHandler = ref object
    onText: proc(text: string): bool {.nimcall.}
    onKeyDown: proc(code: int, mods: set[uint8]): bool {.nimcall.}
    onKeyUp: proc(code: int, mods: set[uint8]): bool {.nimcall.}
    onKeyRepeat: proc(code: int, mods: set[uint8], count: int): bool {.nimcall.}
    onMouseDown: proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseMove: proc(x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseDrag: proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseScroll: proc(delta: int, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onResize: proc(w, h: int): bool {.nimcall.}
    
    keyStates: Table[int, KeyState]
    mouseState: MouseState
    capturedKeys: HashSet[int]
    ignoreKeys: HashSet[int]
    eventCount: int
    droppedEvents: int

proc newTerminalEventHandler(): TerminalEventHandler =
  result = TerminalEventHandler()
  result.keyStates = initTable[int, KeyState]()
  result.capturedKeys = initHashSet[int]()
  result.ignoreKeys = initHashSet[int]()

proc captureKey(handler: TerminalEventHandler, keyCode: int) =
  handler.capturedKeys.incl(keyCode)

proc ignoreKey(handler: TerminalEventHandler, keyCode: int) =
  handler.ignoreKeys.incl(keyCode)

proc updateKeyState(handler: TerminalEventHandler, code: int, mods: set[uint8], 
                   action: InputAction) =
  if action == Press:
    if code in handler.keyStates:
      handler.keyStates[code].repeatCount += 1
    else:
      handler.keyStates[code] = KeyState(
        code: code, mods: mods, isPressed: true, repeatCount: 0
      )
  elif action == Release:
    if code in handler.keyStates:
      handler.keyStates[code].isPressed = false
      handler.keyStates[code].repeatCount = 0
  elif action == Repeat:
    if code in handler.keyStates:
      handler.keyStates[code].repeatCount += 1

proc updateMouseState(handler: TerminalEventHandler, button: MouseButton, 
                     x, y: int, action: InputAction) =
  handler.mouseState.lastX = handler.mouseState.x
  handler.mouseState.lastY = handler.mouseState.y
  handler.mouseState.x = x
  handler.mouseState.y = y
  
  case button
  of Left:
    if action == Press:
      handler.mouseState.leftPressed = true
      handler.mouseState.dragStartX = x
      handler.mouseState.dragStartY = y
    elif action == Release:
      handler.mouseState.leftPressed = false
      handler.mouseState.isDragging = false
  of Middle:
    handler.mouseState.middlePressed = (action == Press)
  of Right:
    handler.mouseState.rightPressed = (action == Press)
  else:
    discard
  
  if handler.mouseState.leftPressed:
    let dx = abs(x - handler.mouseState.dragStartX)
    let dy = abs(y - handler.mouseState.dragStartY)
    if dx > 0 or dy > 0:
      handler.mouseState.isDragging = true

proc dispatchEvent(handler: TerminalEventHandler, event: InputEvent): bool =
  handler.eventCount += 1
  var handled = false
  
  case event.kind
  of TextEvent:
    if not handler.onText.isNil:
      handled = handler.onText(event.text)
  
  of KeyEvent:
    if event.keyCode in handler.ignoreKeys:
      return false
    
    handler.updateKeyState(event.keyCode, event.keyMods, event.keyAction)
    
    case event.keyAction
    of Press:
      if not handler.onKeyDown.isNil:
        handled = handler.onKeyDown(event.keyCode, event.keyMods)
    of Release:
      if not handler.onKeyUp.isNil:
        handled = handler.onKeyUp(event.keyCode, event.keyMods)
    of Repeat:
      if not handler.onKeyRepeat.isNil:
        let count = handler.keyStates[event.keyCode].repeatCount
        handled = handler.onKeyRepeat(event.keyCode, event.keyMods, count)
  
  of MouseEvent:
    handler.updateMouseState(event.button, event.mouseX, event.mouseY, event.action)
    
    case event.button
    of ScrollUp, ScrollDown:
      if not handler.onMouseScroll.isNil:
        let delta = if event.button == ScrollUp: 1 else: -1
        handled = handler.onMouseScroll(delta, event.mouseX, event.mouseY, event.mods)
    else:
      if event.action == Press and not handler.onMouseDown.isNil:
        handled = handler.onMouseDown(event.button, event.mouseX, event.mouseY, event.mods)
  
  of MouseMoveEvent:
    handler.mouseState.x = event.moveX
    handler.mouseState.y = event.moveY
    
    if handler.mouseState.isDragging:
      if not handler.onMouseDrag.isNil:
        let button = if handler.mouseState.leftPressed: Left else: Unknown
        handled = handler.onMouseDrag(button, event.moveX, event.moveY, event.moveMods)
    else:
      if not handler.onMouseMove.isNil:
        handled = handler.onMouseMove(event.moveX, event.moveY, event.moveMods)
  
  of ResizeEvent:
    if not handler.onResize.isNil:
      handled = handler.onResize(event.newWidth, event.newHeight)
  
  return handled

proc getStats(handler: TerminalEventHandler): (int, int) =
  return (handler.eventCount, handler.droppedEvents)

# ================================================================
# GAME STATE
# ================================================================

var eventLog: seq[string] = @[]
var gameRunning = true
var playerX = 40
var playerY = 12
var playerChar = '@'
var selectedWeapon = "sword"
var weaponMode = "normal"  # normal, charged, special
var chargeLevel = 0

# ================================================================
# SETUP: Configure Event Handler with Advanced Features
# ================================================================

proc setupAdvancedEventHandler(): TerminalEventHandler =
  ## Demonstrates event handler features
  let handler = newTerminalEventHandler()
  
  # ================================================================
  # FEATURE 1: KEY CAPTURE - Always handle these keys
  # ================================================================
  
  # Arrow keys for movement - always capture these
  handler.captureKey(INPUT_UP)
  handler.captureKey(INPUT_DOWN)
  handler.captureKey(INPUT_LEFT)
  handler.captureKey(INPUT_RIGHT)
  
  # Space for charging attack - always handle
  handler.captureKey(INPUT_SPACE)
  
  # Q for quit - always handle
  handler.captureKey(ord('q'))
  
  # ================================================================
  # FEATURE 2: KEY IGNORE - Never handle these keys
  # ================================================================
  
  # Ignore certain keys we don't care about
  handler.ignoreKey(INPUT_BACKSPACE)
  
  # ================================================================
  # FEATURE 3: Text Input Callback
  # ================================================================
  
  handler.onText = proc(text: string): bool {.nimcall.} =
    ## Handle regular text input (non-special keys)
    if text == "w":
      selectedWeapon = "wand"
      eventLog.add(&"Selected: {selectedWeapon}")
      return true
    elif text == "b":
      selectedWeapon = "bow"
      eventLog.add(&"Selected: {selectedWeapon}")
      return true
    elif text == "s":
      selectedWeapon = "sword"
      eventLog.add(&"Selected: {selectedWeapon}")
      return true
    return false
  
  # ================================================================
  # FEATURE 4: Key Down - Initial key press
  # ================================================================
  
  handler.onKeyDown = proc(code: int, mods: set[uint8]): bool {.nimcall.} =
    ## Called once when key is pressed
    
    case code
    # Movement with arrow keys
    of INPUT_UP:
      if playerY > 0:
        playerY -= 1
      eventLog.add(&"Moved to ({playerX}, {playerY})")
      return true
    
    of INPUT_DOWN:
      if playerY < 23:
        playerY += 1
      eventLog.add(&"Moved to ({playerX}, {playerY})")
      return true
    
    of INPUT_LEFT:
      if playerX > 0:
        playerX -= 1
      eventLog.add(&"Moved to ({playerX}, {playerY})")
      return true
    
    of INPUT_RIGHT:
      if playerX < 79:
        playerX += 1
      eventLog.add(&"Moved to ({playerX}, {playerY})")
      return true
    
    # Space bar - start charging
    of INPUT_SPACE:
      chargeLevel = 0
      weaponMode = "charging"
      eventLog.add("Charging attack...")
      return true
    
    # Q to quit
    of ord('q'):
      gameRunning = false
      eventLog.add("Quit requested")
      return true
    
    else:
      discard
    
    return false
  
  # ================================================================
  # FEATURE 5: Key Up - Key release
  # ================================================================
  
  handler.onKeyUp = proc(code: int, mods: set[uint8]): bool {.nimcall.} =
    ## Called when key is released
    
    if code == INPUT_SPACE:
      # Released space - execute charged attack
      if chargeLevel > 0:
        eventLog.add(&"Attack! Charge level: {chargeLevel}")
      else:
        eventLog.add("Light attack")
      weaponMode = "normal"
      chargeLevel = 0
      return true
    
    return false
  
  # ================================================================
  # FEATURE 6: Key Repeat - For holding down keys
  # ================================================================
  
  handler.onKeyRepeat = proc(code: int, mods: set[uint8], count: int): bool {.nimcall.} =
    ## Called repeatedly while key is held
    ## Perfect for charging attacks!
    
    if code == INPUT_SPACE and weaponMode == "charging":
      # Increase charge for each repeat
      chargeLevel = min(count, 10)  # Max charge level 10
      
      # Log every 5 repeats to avoid spam
      if count mod 5 == 0:
        eventLog.add(&"Charging... level {chargeLevel}/10")
      
      return true
    
    return false
  
  # ================================================================
  # FEATURE 7: Mouse Down - Click detection
  # ================================================================
  
  handler.onMouseDown = proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.} =
    ## Detect mouse clicks (left, middle, right)
    
    case button
    of MouseButton.Left:
      eventLog.add(&"Left click at ({x}, {y})")
      # Could check if clicking on enemy, item, etc.
    of MouseButton.Right:
      eventLog.add(&"Right click at ({x}, {y}) - context menu")
    of MouseButton.Middle:
      eventLog.add(&"Middle click at ({x}, {y})")
    else:
      discard
    
    return false
  
  # ================================================================
  # FEATURE 8: Mouse Move - Track cursor
  # ================================================================
  
  handler.onMouseMove = proc(x, y: int, mods: set[uint8]): bool {.nimcall.} =
    ## Track mouse movement (not dragging)
    ## Great for UI highlighting, targeting, etc.
    # Could highlight items under cursor, show tooltips, etc.
    return false
  
  # ================================================================
  # FEATURE 9: Mouse Drag - Click and drag
  # ================================================================
  
  handler.onMouseDrag = proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.} =
    ## Called while mouse button is held and moving
    ## Perfect for: drag to select, drag to move items, pan camera, etc.
    
    case button
    of MouseButton.Left:
      eventLog.add(&"Dragging to ({x}, {y})")
      # Could implement: selection box, item dragging, etc.
    else:
      discard
    
    return false
  
  # ================================================================
  # FEATURE 10: Mouse Scroll - Wheel input
  # ================================================================
  
  handler.onMouseScroll = proc(delta: int, x, y: int, mods: set[uint8]): bool {.nimcall.} =
    ## Scroll wheel input (delta > 0 = up, < 0 = down)
    
    let direction = if delta > 0: "UP" else: "DOWN"
    let amount = abs(delta)
    
    eventLog.add(&"Scroll {direction} x{amount} at ({x}, {y})")
    
    # Could implement: zoom in/out, inventory scrolling, etc.
    
    return false
  
  # ================================================================
  # FEATURE 11: Terminal Resize
  # ================================================================
  
  handler.onResize = proc(w, h: int): bool {.nimcall.} =
    ## Called when terminal is resized
    eventLog.add(&"Terminal resized to {w}x{h}")
    return true
  
  # ================================================================
  # FEATURE 12: Query Handler Internal State
  # ================================================================
  
  # Check if specific keys are currently pressed
  # handler.isKeyPressed(INPUT_UP)
  # handler.isKeyPressed(INPUT_SPACE)
  
  # Get mouse state
  # handler.mouseState.x, handler.mouseState.y
  # handler.mouseState.leftPressed
  # handler.mouseState.isDragging
  
  # Get event statistics
  # let (count, dropped) = handler.getStats()
  
  return handler

# ================================================================
# RENDERING
# ================================================================

proc renderGameUI(state: AppState, handler: TerminalEventHandler) =
  ## Render the advanced game UI
  
  state.currentBuffer.clear()
  
  var style = Style(fg: white(), bg: black())
  var highStyle = Style(fg: yellow(), bg: black())
  var damageStyle = Style(fg: red(), bg: black())
  
  var y = 0
  
  # Title
  state.currentBuffer.writeText(0, y, "=== Advanced Event Handler Demo ===", highStyle)
  y += 2
  
  # Instructions
  state.currentBuffer.writeText(0, y, "Arrow keys: Move | Space: Charge Attack | W/B/S: Weapon | Q: Quit", style)
  state.currentBuffer.writeText(0, y + 1, "Mouse: Click, drag, scroll for advanced input", style)
  y += 3
  
  # Status
  state.currentBuffer.writeText(0, y, &"Player: ({playerX}, {playerY}) [{playerChar}]", highStyle)
  y += 1
  state.currentBuffer.writeText(0, y, &"Weapon: {selectedWeapon}", highStyle)
  y += 1
  state.currentBuffer.writeText(0, y, &"Mode: {weaponMode}", highStyle)
  
  if weaponMode == "charging":
    let chargeBar = "█".repeat(chargeLevel) & "░".repeat(10 - chargeLevel)
    state.currentBuffer.writeText(0, y + 1, &"Charge: [{chargeBar}]", damageStyle)
    y += 1
  
  y += 2
  
  # Key State Info
  let (eventCount, dropped) = getStats(handler)
  state.currentBuffer.writeText(0, y, &"Events processed: {eventCount} (dropped: {dropped})", style)
  y += 1
  state.currentBuffer.writeText(0, y, &"Mouse: ({handler.mouseState.x}, {handler.mouseState.y})", style)
  y += 1
  
  if handler.mouseState.leftPressed:
    state.currentBuffer.writeText(0, y, "Left mouse button: PRESSED", damageStyle)
    y += 1
  
  if handler.mouseState.isDragging:
    state.currentBuffer.writeText(0, y, "Status: DRAGGING", damageStyle)
    y += 1
  
  y += 1
  
  # Event Log
  state.currentBuffer.writeText(0, y, "Event Log:", highStyle)
  y += 1
  
  for logLine in eventLog:
    if y < state.termHeight - 1:
      state.currentBuffer.writeText(2, y, logLine, style)
      y += 1
  
  if eventLog.len > 50:
    eventLog.delete(0)

# ================================================================
# BACKSTORIE CALLBACKS
# ================================================================

var advancedHandler: TerminalEventHandler

onInit = proc(state: AppState) =
  ## Initialize with advanced event handler
  advancedHandler = setupAdvancedEventHandler()
  eventLog.add("Advanced event handler initialized")
  eventLog.add("Try all features: movement, attacks, mouse, scrolling")

onUpdate = proc(state: AppState, dt: float) =
  ## Update game state
  discard

onRender = proc(state: AppState) =
  ## Render the UI
  renderGameUI(state, advancedHandler)

onInput = proc(state: AppState, event: InputEvent): bool =
  ## Handle input through advanced event handler
  if advancedHandler != nil:
    return dispatchEvent(advancedHandler, event)
  return false

onShutdown = proc(state: AppState) =
  ## Cleanup
  discard