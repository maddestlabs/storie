## Terminal Event Handler - Direct API Version
## Robust event handling for backstorie terminal engine
## No plugin boilerplate - just import and use!

import std/[tables, sets, hashes, times]

# Note: InputEvent types are already available from backstorie.nim

# ================================================================
# EVENT HANDLER CONFIGURATION AND STATE
# ================================================================

type
  EventHandlerConfig* = object
    ## Configuration for event handler behavior
    consumeEvents*: bool  ## Whether handled events prevent other handlers
    enableLogging*: bool  ## Debug logging of all events
    enableRepeatTracking*: bool  ## Track key repeat state
    enableMouseTracking*: bool  ## Enable mouse event processing
    enableResizeTracking*: bool  ## Enable resize event processing
    maxCallbackDepth*: int  ## Prevent callback recursion issues

  KeyState* = object
    ## Track key press/release state
    code*: int
    mods*: set[uint8]
    isPressed*: bool
    repeatCount*: int
    lastEventTime*: float

  MouseState* = object
    ## Track mouse position and button state
    x*, y*: int
    leftPressed*: bool
    middlePressed*: bool
    rightPressed*: bool
    lastX*, lastY*: int
    dragStartX*, dragStartY*: int
    isDragging*: bool

  TerminalEventHandler* = ref object
    ## Main event handler with flexible callback system
    config*: EventHandlerConfig
    
    # Callbacks
    onText*: proc(text: string): bool {.nimcall.}
    onKey*: proc(code: int, mods: set[uint8], action: InputAction): bool {.nimcall.}
    onKeyDown*: proc(code: int, mods: set[uint8]): bool {.nimcall.}
    onKeyUp*: proc(code: int, mods: set[uint8]): bool {.nimcall.}
    onKeyRepeat*: proc(code: int, mods: set[uint8], count: int): bool {.nimcall.}
    
    onMouse*: proc(button: MouseButton, x, y: int, action: InputAction, mods: set[uint8]): bool {.nimcall.}
    onMouseDown*: proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseUp*: proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseMove*: proc(x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseDrag*: proc(button: MouseButton, x, y: int, mods: set[uint8]): bool {.nimcall.}
    onMouseScroll*: proc(delta: int, x, y: int, mods: set[uint8]): bool {.nimcall.}
    
    onResize*: proc(w, h: int): bool {.nimcall.}
    
    # Internal state tracking
    keyStates*: Table[int, KeyState]
    mouseState*: MouseState
    lastEventTime*: float
    callbackDepth*: int
    
    # Filter support
    capturedKeys*: HashSet[int]  ## Keys that trigger handlers even in text context
    ignoreKeys*: HashSet[int]    ## Keys that are completely ignored
    
    # Statistics
    eventCount*: int
    droppedEvents*: int

# ================================================================
# CONSTRUCTOR AND UTILITY FUNCTIONS
# ================================================================

proc newTerminalEventHandler*(config: EventHandlerConfig = EventHandlerConfig()): TerminalEventHandler =
  result = TerminalEventHandler()
  result.config = config
  result.config.maxCallbackDepth = max(1, config.maxCallbackDepth)
  result.mouseState = MouseState()
  result.keyStates = initTable[int, KeyState]()
  result.capturedKeys = initHashSet[int]()
  result.ignoreKeys = initHashSet[int]()
  result.eventCount = 0
  result.droppedEvents = 0

proc debugLog*(handler: TerminalEventHandler, msg: string) =
  if handler.config.enableLogging:
    stderr.writeLine("[EventHandler] " & msg)

# ================================================================
# KEY CAPTURE AND IGNORE FILTERS
# ================================================================

proc captureKey*(handler: TerminalEventHandler, keyCode: int) =
  ## Mark a key as "captured" - always handled by callbacks
  handler.capturedKeys.incl(keyCode)

proc ignoreKey*(handler: TerminalEventHandler, keyCode: int) =
  ## Mark a key as "ignored" - never processed
  handler.ignoreKeys.incl(keyCode)

proc isCaptured*(handler: TerminalEventHandler, code: int): bool =
  code in handler.capturedKeys

proc isIgnored*(handler: TerminalEventHandler, code: int): bool =
  code in handler.ignoreKeys

# ================================================================
# KEY STATE TRACKING
# ================================================================

proc updateKeyState*(handler: TerminalEventHandler, code: int, mods: set[uint8], 
                     action: InputAction, currentTime: float) =
  if not handler.config.enableRepeatTracking:
    return
  
  if action == Press:
    if code in handler.keyStates:
      handler.keyStates[code].repeatCount += 1
    else:
      handler.keyStates[code] = KeyState(
        code: code,
        mods: mods,
        isPressed: true,
        repeatCount: 0,
        lastEventTime: currentTime
      )
  elif action == Release:
    if code in handler.keyStates:
      handler.keyStates[code].isPressed = false
      handler.keyStates[code].repeatCount = 0
  elif action == Repeat:
    if code in handler.keyStates:
      handler.keyStates[code].repeatCount += 1
      handler.keyStates[code].lastEventTime = currentTime

proc isKeyPressed*(handler: TerminalEventHandler, code: int): bool =
  if code in handler.keyStates:
    return handler.keyStates[code].isPressed
  return false

proc getKeyRepeatCount*(handler: TerminalEventHandler, code: int): int =
  if code in handler.keyStates:
    return handler.keyStates[code].repeatCount
  return 0

# ================================================================
# MOUSE STATE TRACKING
# ================================================================

proc updateMouseState*(handler: TerminalEventHandler, button: MouseButton, 
                      x, y: int, action: InputAction) =
  if not handler.config.enableMouseTracking:
    return
  
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
  
  # Detect dragging
  if handler.mouseState.leftPressed:
    let dx = abs(x - handler.mouseState.dragStartX)
    let dy = abs(y - handler.mouseState.dragStartY)
    if dx > 0 or dy > 0:
      handler.mouseState.isDragging = true

# ================================================================
# EVENT DISPATCH
# ================================================================

proc dispatchEvent*(handler: TerminalEventHandler, event: InputEvent): bool =
  ## Dispatch an event to appropriate callbacks
  ## Returns true if event was handled (consumed)
  
  if handler.callbackDepth >= handler.config.maxCallbackDepth:
    handler.droppedEvents += 1
    return false
  
  handler.callbackDepth += 1
  defer: handler.callbackDepth -= 1
  
  handler.eventCount += 1
  let currentTime = epochTime()
  var handled = false
  
  case event.kind
  of TextEvent:
    if not handler.onText.isNil:
      handled = handler.onText(event.text)
  
  of KeyEvent:
    if isIgnored(handler, event.keyCode):
      return false
    
    handler.updateKeyState(event.keyCode, event.keyMods, event.keyAction, currentTime)
    
    # Generic key callback
    if not handler.onKey.isNil:
      handled = handler.onKey(event.keyCode, event.keyMods, event.keyAction)
    
    # Specific action callbacks
    if not handled:
      case event.keyAction
      of Press:
        if not handler.onKeyDown.isNil:
          handled = handler.onKeyDown(event.keyCode, event.keyMods)
      of Release:
        if not handler.onKeyUp.isNil:
          handled = handler.onKeyUp(event.keyCode, event.keyMods)
      of Repeat:
        if not handler.onKeyRepeat.isNil:
          let count = handler.getKeyRepeatCount(event.keyCode)
          handled = handler.onKeyRepeat(event.keyCode, event.keyMods, count)
  
  of MouseEvent:
    if not handler.config.enableMouseTracking:
      return false
    
    handler.updateMouseState(event.button, event.mouseX, event.mouseY, event.action)
    
    # Generic mouse callback
    if not handler.onMouse.isNil:
      handled = handler.onMouse(event.button, event.mouseX, event.mouseY, 
                                event.action, event.mods)
    
    # Specific action callbacks
    if not handled:
      case event.button
      of ScrollUp, ScrollDown:
        if not handler.onMouseScroll.isNil:
          let delta = if event.button == ScrollUp: 1 else: -1
          handled = handler.onMouseScroll(delta, event.mouseX, event.mouseY, event.mods)
      else:
        case event.action
        of Press:
          if not handler.onMouseDown.isNil:
            handled = handler.onMouseDown(event.button, event.mouseX, event.mouseY, event.mods)
        of Release:
          if not handler.onMouseUp.isNil:
            handled = handler.onMouseUp(event.button, event.mouseX, event.mouseY, event.mods)
        else:
          discard
  
  of MouseMoveEvent:
    if not handler.config.enableMouseTracking:
      return false
    
    handler.mouseState.x = event.moveX
    handler.mouseState.y = event.moveY
    
    if handler.mouseState.isDragging:
      if not handler.onMouseDrag.isNil:
        let button = if handler.mouseState.leftPressed: Left
                    elif handler.mouseState.rightPressed: Right
                    elif handler.mouseState.middlePressed: Middle
                    else: Unknown
        handled = handler.onMouseDrag(button, event.moveX, event.moveY, event.moveMods)
    else:
      if not handler.onMouseMove.isNil:
        handled = handler.onMouseMove(event.moveX, event.moveY, event.moveMods)
  
  of ResizeEvent:
    if handler.config.enableResizeTracking:
      if not handler.onResize.isNil:
        handled = handler.onResize(event.newWidth, event.newHeight)
  
  return handled and handler.config.consumeEvents

# ================================================================
# STATISTICS
# ================================================================

proc getStats*(handler: TerminalEventHandler): (int, int) =
  ## Returns (eventCount, droppedEvents)
  return (handler.eventCount, handler.droppedEvents)

proc resetStats*(handler: TerminalEventHandler) =
  handler.eventCount = 0
  handler.droppedEvents = 0
