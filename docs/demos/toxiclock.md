---
title: "ToxiClock"
author: "Maddest Labs"
---

# Highly Toxic Digital Clock with Embedded Figlet Font

```nim on:init
var fontLoaded = figletLoadFont("poison")
var debugMsg = "Font loaded: " & $fontLoaded

# Pre-calculate static centering using widest possible time string
var maxWidthLines = figletRender("poison", "88:88:88")

# Initialize particle system for rising bubbles effect
particleInit("toxins", 100)
var accentStyle = getStyle("accent1")
var defaultStyle = getStyle("default")

# Configure fire effect rising from bottom
particleConfigureFire("toxins", 10.0, false)
particleSetBackgroundFromStyle("toxins", defaultStyle)
particleSetForegroundFromStyle("toxins", accentStyle)
particleSetEmitterPos("toxins", 0, termHeight)
particleSetEmitterSize("toxins", termWidth, float(termHeight) / 2)
particleSetLifeRange("toxins", 3.0, 5.0)
particleSetVelocityRange("toxins", 0.0, -10.0, 0.0, -25.0)
particleSetChars("toxins", "....o")

# Initialize displacement shader for watery distortion effect
# Effect 0 = Horizontal Wave (ocean waves)
var displayLayer = 0
initDisplacement(0, displayLayer, 0, 0, termWidth, termHeight, 0.6)

# Dripping character effect system
type DripChar = object
  char: string
  startX: int
  startY: int
  currentY: float
  age: float
  lifetime: float

type CharPos = object
  x: int
  y: int
  char: string

var dripChars: seq[DripChar] = @[]
var timeSinceLastDrip = 0.0
var dripInterval = 1.5  # seconds between drips
var maxDrips = 15  # maximum concurrent drips

# Store clock position for drip calculations
var clockStartX = 0
var clockStartY = 10
```

```nim on:render
clear()

# Render particle effect in background
particleRender("toxins", "default")

# Get current time
var time = now()
var hour = time.hour
var minute = time.minute
var second = time.second

# Format time string
var timeStr = ""
if hour < 10:
  timeStr = timeStr & "0"
timeStr = timeStr & $hour & ":"
if minute < 10:
  timeStr = timeStr & "0"
timeStr = timeStr & $minute & ":"
if second < 10:
  timeStr = timeStr & "0"
timeStr = timeStr & $second

# Render and draw figlet text
var lines = figletRender("poison", timeStr)

# Calculate centering
var clockWidth = 0
var clockHeight = len(lines)
if clockHeight > 0:
  clockWidth = len(lines[0])
var startX = 0
if clockWidth < termWidth:
  var diff = termWidth - clockWidth
  startX = diff / 2

var startY = 10
if clockHeight < termHeight:
  var diff = termHeight - clockHeight
  startY = diff / 2

# Store for drip calculations
clockStartX = startX
clockStartY = startY

# Draw using helper function
if clockHeight > 0:
  drawFigletText(0, startX, startY, "poison", timeStr, 0, getStyle("accent1"))
else:
  draw(0, 2, 8, "No lines to render!")

# Render dripping characters on top
for drip in dripChars:
  if drip.age <= drip.lifetime:
    # Easing function: ease-out cubic for smooth deceleration
    var t = drip.age / drip.lifetime
    var easedT = 1.0 - pow(1.0 - t, 3.0)
    
    # Calculate drop distance (fall off screen)
    var dropDistance = float(termHeight - drip.startY + 5)
    var yPos = int(float(drip.startY) + easedT * dropDistance)
    
    # Fade out as it falls (optional - adds to the toxic dissolution effect)
    var alpha = 1.0 - (t * 0.7)  # fade to 30% opacity
    
    if yPos < termHeight:
      draw(0, drip.startX, yPos, drip.char, getStyle("accent1"))

# Apply watery displacement effect to entire screen
drawDisplacementInPlace("default")
```

```nim on:update
# Update displacement animation for watery wave effect
updateDisplacement()

# Update particle emitter position at bottom of screen
particleSetEmitterPos("toxins", 0.0, float(termHeight - 1))
particleSetEmitterSize("toxins", float(termWidth), 1.0)
particleUpdate("toxins", deltaTime)

# Update dripping characters
timeSinceLastDrip = timeSinceLastDrip + deltaTime

# Create new drip every 1-2 seconds
if timeSinceLastDrip >= dripInterval and len(dripChars) < maxDrips:
  # Get current time for figlet rendering
  var time = now()
  var hour = time.hour
  var minute = time.minute
  var second = time.second
  
  var timeStr = ""
  if hour < 10:
    timeStr = timeStr & "0"
  timeStr = timeStr & $hour & ":"
  if minute < 10:
    timeStr = timeStr & "0"
  timeStr = timeStr & $minute & ":"
  if second < 10:
    timeStr = timeStr & "0"
  timeStr = timeStr & $second
  
  # Render the figlet text to get character positions
  var figletLines = figletRender("poison", timeStr)
  
  if len(figletLines) > 0:
    # Collect all non-space characters with their positions
    var charPositions: seq[CharPos] = @[]
    
    for lineIdx in 0..<len(figletLines):
      var line = figletLines[lineIdx]
      for colIdx in 0..<len(line):
        var ch = $line[colIdx]
        if ch != " " and ch != "$":
          var pos: CharPos
          pos.x = clockStartX + colIdx
          pos.y = clockStartY + lineIdx
          pos.char = ch
          charPositions.add(pos)
    
    # Pick a random character to drip
    if len(charPositions) > 0:
      var randomIdx = rand(len(charPositions) - 1)
      var selectedChar = charPositions[randomIdx]
      
      # Create new dripping character
      var newDrip: DripChar
      newDrip.char = selectedChar.char
      newDrip.startX = selectedChar.x
      newDrip.startY = selectedChar.y
      newDrip.currentY = float(selectedChar.y)
      newDrip.age = 0.0
      newDrip.lifetime = 2.0 + rand(1.0)  # 2-3 seconds to fall
      
      dripChars.add(newDrip)
      
      # Randomize next drip interval (1-2 seconds)
      dripInterval = 1.0 + rand(1.0)
      timeSinceLastDrip = 0.0

# Update existing drips
var activeDrips: seq[DripChar] = @[]
for drip in dripChars:
  var updatedDrip = drip
  updatedDrip.age = updatedDrip.age + deltaTime
  
  # Keep drip if it's still active
  if updatedDrip.age <= updatedDrip.lifetime + 0.5:  # keep a bit longer for complete fall
    activeDrips.add(updatedDrip)

dripChars = activeDrips
```

```figlet name:poison
flf2a$ 12 10 20 -1 14
poison.flf composed into figlet by Vinney Thai <ssfiit@eris.cc.umb.edu>
poison font (numbers & puntuation marks) composed by Vinney Thai
poison font (uppercase characters) composed David Issel <dissel@nunic.nu.edu>
date: Oct 23, 1994
Explanation of first line:
flf2 - "magic number" for file identification
a    - should always be `a', for now
$    - the "hardblank" -- prints as a blank, but can't be smushed
12   - height of a character
10   - height of a character, not including descenders
20   - max line length (excluding comment lines) + a fudge factor
-1   - default smushmode for this font (like "-m 0" on command line)
15   - number of comment lines

$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@
$ $@@
     @
@@@ $@
@@@ $@
@@! $@
!@  $@
@!@ $@
!!! $@
     @
:!: $@
 :: $@
::: $@
     @@
         @
@@@ @@@ $@
@@@ @@@ $@
@@! @@! $@
 @!  @! $@
  $   $  @
  $   $  @
  $   $  @
  $   $  @
  $   $  @
  $   $  @
         @@
              @
  @@@  @@@ $  @
  @@@  @@@ $  @
@!@@!@!@@@@! $@
!@!@!!@@!@!@ $@
  @!@  !@! $  @
  !!!  !!! $  @
!:!!:!:!!!!: $@
:!:!::!!:!:! $@
  ::   ::: $  @
   :   : : $  @
              @@
            @
    @@ $    @
 @@@@@@@@@ $@
!@@!@@!@@! $@
!@! !@ $    @
!!!@@!!!! $ @
 !!!@@@!!! $@
    !: !:! $@
!:!!:!: :! $@
: :::: :: $ @
    :: $    @
            @@
              @
@@@@     @@@ $@
@@@@    @@@ $ @
@@!@   @@! $  @
      !@! $   @
     @!! $    @
    !!! $     @
   !!: $      @
  ::!   ::!: $@
  ::    :::  $@
: :     : :: $@
              @@
             @
  @@@@@ $    @
 @@@@@@@ $   @
@@!   @@@ $  @
 !@  @!@ $   @
  @!@!@ $    @
  !!!@  !!! $@
 !!:!!:!!: $ @
:!:  !:!: $  @
::: :::::: $ @
 ::: :: ::: $@
             @@
     @
@@@ $@
 @@ $@
@! $ @
 $   @
 $   @
 $   @
 $   @
 $   @
 $   @
 $   @
     @@
        @
   @@@ $@
  @@@ $ @
 @@! $  @
!@! $   @
!!@ $   @
!!! $   @
!!: $   @
 :!: $  @
   :: $ @
     : $@
        @@
        @
@@@ $   @
 @@@ $  @
  @@! $ @
   !@! $@
   !!@ $@
   !!! $@
   !!: $@
  :!: $ @
 :: $   @
: $     @
        @@
            @
            @
@@!    !@@ $@
 !@!  @!! $ @
  !@@!@! $  @
@!@!@!!@!! $@
  !: :!! $  @
 :!:  !:! $ @
:::    ::: $@
            @
            @
            @@
           @
           @
           @
   @@! $   @
   !@! $   @
@!@!@!@!@ $@
!!!@!@!!! $@
   !!: $   @
   :!: $   @
           @
           @
           @@
     @
     @
     @
     @
     @
     @
     @
     @
:!: $@
 :: $@
:: $ @
     @@
           @
           @
           @
           @
           @
@!@!@!@!@ $@
!!!@!@!!! $@
           @
           @
           @
           @
           @@
     @
     @
     @
     @
     @
     @
     @
     @
:!: $@
::: $@
::: $@
     @@
              @
         @@@ $@
        @@@ $ @
       @@! $  @
      !@! $   @
     @!! $    @
    !!! $     @
   !!: $      @
  ::! $       @
  :: $        @
: : $         @
              @@
            @
 @@@@@@@@ $ @
@@@@@@@@@@ $@
@@!   @@@@ $@
!@!  @!@!@ $@
@!@ @! !@! $@
!@!!!  !!! $@
!!:!   !!! $@
:!:    !:! $@
::::::: :: $@
 : : :  : $ @
            @@
       @
  @@@ $@
 @@@@ $@
@@@!! $@
  !@! $@
  @!@ $@
  !@! $@
  !!: $@
  :!: $@
  ::: $@
   :: $@
       @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
     @@@ $@
    @!@ $ @
   !!@ $  @
  !!: $   @
 !:! $    @
:!: $     @
:: ::::: $@
:: : ::: $@
          @@
         @
@@@@@@ $ @
@@@@@@@ $@
    @@@ $@
    @!@ $@
@!@!!@ $ @
!!@!@! $ @
    !!: $@
    :!: $@
:: :::: $@
 : : : $ @
         @@
           @
     @@@ $ @
    @@@@ $ @
   @@!@! $ @
  !@!!@! $ @
 @!! @!! $ @
!!!  !@! $ @
:!!:!:!!: $@
!:::!!::: $@
     ::: $ @
     ::: $ @
           @@
         @
@@@@@@@ $@
@@@@@@@ $@
!@@ $    @
!@! $    @
!!@@!! $ @
@!!@!!! $@
    !:! $@
    !:! $@
:::: :: $@
:: : : $ @
         @@
          @
  @@@@@@ $@
 @@@@@@@ $@
!@@ $     @
!@! $     @
!!@@!@! $ @
@!!@!!!! $@
!:!  !:! $@
:!:  !:! $@
:::: ::: $@
 :: : : $ @
          @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
     @@! $@
    !@! $ @
   @!! $  @
  !!! $   @
 !!: $    @
:!: $     @
 :: $     @
: : $     @
          @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
 !@!!@! $ @
 !!@!!! $ @
!!:  !!! $@
:!:  !:! $@
::::: :: $@
 : :  : $ @
          @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
!!@!!@!! $@
  !!@!!! $@
     !!! $@
     !:! $@
::::: :: $@
 : :  : $ @
          @@
     @
     @
     @
     @
@!@ $@
!@! $@
!:! $@
 $$  @
:!: $@
::: $@
::: $@
     @@
     @
     @
     @
     @
@!@  @
!@! $@
:!: $@
 $$  @
:!: $@
 :: $@
:: $ @
     @@
             @
        @@@ $@
      @@@ $  @
    @@! $    @
  !@! $      @
!!@ $        @
!!! $        @
  !!: $      @
    :!: $    @
      :: $   @
        : $  @
             @@
           @
           @
           @
           @
!@!!@!!@! $@
@!@!@!@!@ $@
 $      $  @
!!:!!::!! $@
::!:!:!!: $@
           @
           @
           @@
             @
@@@ $        @
  @@@ $      @
    @@! $    @
      !@! $  @
        !!@ $@
        !!! $@
      !!: $  @
    :!: $    @
  :: $       @
: $          @
             @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
    @!@ $ @
   !!@ $  @
  !!@ $   @
          @
  !:! $   @
   :: $   @
  ::: $   @
          @@
            @
 @@@@@@@@ $ @
@@@@@@@@@@ $@
@@!    @@@ $@
!@! @!@!!@ $@
@!@ !@@!@! $@
!@! @@!@!! $@
!!:  !:!! $ @
:!: $       @
:::::::::: $@
 : : :: : $ @
            @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!@!@! $@
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@   @!@ $@
@!@!@!@ $ @
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
 :: :::: $@
:: : :: $ @
          @@
          @
 @@@@@@@ $@
@@@@@@@@ $@
!@@ $     @
!@! $     @
!@! $     @
!!! $     @
:!! $     @
:!: $     @
 ::: ::: $@
 :: :: : $@
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
 :::: :: $@
:: :  : $ @
          @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
@@! $     @
!@! $     @
@!!!:! $  @
!!!!!: $  @
!!: $     @
:!: $     @
 :: :::: $@
: :: :: $ @
          @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
@@! $     @
!@! $     @
@!!!:! $  @
!!!!!: $  @
!!: $     @
:!: $     @
 :: $     @
 : $      @
          @@
           @
 @@@@@@@@ $@
@@@@@@@@@ $@
!@@ $      @
!@! $      @
!@! @!@!@ $@
!!! !!@!! $@
:!!   !!: $@
:!:   !:: $@
 ::: :::: $@
 :: :: : $ @
           @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!@!@! $@
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
     @
@@@ $@
@@@ $@
@@! $@
!@! $@
!!@ $@
!!! $@
!!: $@
:!: $@
 :: $@
: $  @
     @@
          @
     @@@ $@
     @@@ $@
     @@! $@
     !@! $@
     !!@ $@
     !!! $@
     !!: $@
!!:  :!: $@
::: : :: $@
 : ::: $  @
          @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  !@@ $@
!@!  @!! $@
@!@@!@! $ @
!!@!!! $  @
!!: :!! $ @
:!:  !:! $@
 ::  ::: $@
 :   ::: $@
          @@
          @
@@@      $@
@@@      $@
@@!      $@
!@!      $@
@!!      $@
!!!      $@
!!:      $@
 :!:     $@
 :: :::: $@
: :: : : $@
          @@
             @
@@@@@@@@@@ $ @
@@@@@@@@@@@ $@
@@! @@! @@! $@
!@! !@! !@! $@
@!! !!@ @!@ $@
!@!   ! !@! $@
!!:     !!: $@
:!:     :!: $@
:::     :: $ @
 :      : $  @
             @@
          @
@@@  @@@ $@
@@@@ @@@ $@
@@!@!@@@ $@
!@!!@!@! $@
@!@ !!@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
 ::   :: $@
::    : $ @
          @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
::::: :: $@
 : :  : $ @
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@@!@! $ @
!!@!!! $  @
!!: $     @
:!: $     @
 :: $     @
 : $      @
          @@
           @
 @@@@@@ $  @
@@@@@@@@ $ @
@@!  @@@ $ @
!@!  @!@ $ @
@!@  !@! $ @
!@!  !!! $ @
!!:!!:!: $ @
:!: :!:  $ @
::::: :! $ @
 : :  ::: $@
           @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!!@! $ @
!!@!@! $  @
!!: :!! $ @
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
          @
 @@@@@@ $ @
@@@@@@@ $ @
!@@ $     @
!@! $     @
!!@@!! $  @
 !!@!!! $ @
     !:! $@
    !:! $ @
:::: :: $ @
:: : : $  @
          @@
         @
@@@@@@@ $@
@@@@@@@ $@
  @@! $  @
  !@! $  @
  @!! $  @
  !!! $  @
  !!: $  @
  :!: $  @
   :: $  @
   : $   @
         @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
::::: :: $@
 : :  : $ @
          @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
:!:  !!: $@
 ::!!:! $ @
  :::: $  @
   : $    @
          @@
               @
@@@  @@@  @@@ $@
@@@  @@@  @@@ $@
@@!  @@!  @@! $@
!@!  !@!  !@! $@
@!!  !!@  @!@ $@
!@!  !!!  !@! $@
!!:  !!:  !!: $@
:!:  :!:  :!: $@
 :::: :: ::: $ @
  :: :  : : $  @
               @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  !@@ $@
!@!  @!! $@
 !@@!@! $ @
  @!!! $  @
 !: :!! $ @
:!:  !:! $@
 ::  ::: $@
 :   :: $ @
          @@
         @
@@@ @@@ $@
@@@ @@@ $@
@@! !@@ $@
!@! @!! $@
 !@!@! $ @
  @!!! $ @
  !!: $  @
  :!: $  @
   :: $  @
   : $   @
         @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
     @@! $@
    !@! $ @
   @!! $  @
  !!! $   @
 !!: $    @
:!: $     @
 :: :::: $@
: :: : : $@
          @@
       @
@@@@@ $@
@@@@@ $@
@@! $  @
!@! $  @
@!@ $  @
!!! $  @
!!: $  @
:!: $  @
::::: $@
 : : $ @
       @@
               @
 @@@ $         @
  @@@ $        @
   @@! $       @
    !@! $      @
     @!! $     @
      !!! $    @
       !!: $   @
        ::! $  @
         :: $  @
          : : $@
               @@
       @
@@@@@ $@
@@@@@ $@
  @@! $@
  !@! $@
  @!@ $@
  !!! $@
  !!: $@
  :!: $@
::::: $@
 : : $ @
       @@
                @
     @@@@@ $    @
   @@@@ @@@@ $  @
 @!@!     @!@! $@
   $        $   @
   $        $   @
   $        $   @
   $        $   @
   $        $   @
   $        $   @
   $        $   @
                @@
               @
              $@
              $@
              $@
              $@
              $@
              $@
              $@
              $@
::::::::::::: $@
::::::::::::: $@
               @@
     @
@@@ $@
@@ $ @
 @! $@
  $  @
  $  @
  $  @
  $  @
  $  @
  $  @
  $  @
     @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!@!@! $@
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@   @!@ $@
@!@!@!@ $ @
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
 :: :::: $@
:: : :: $ @
          @@
          @
 @@@@@@@ $@
@@@@@@@@ $@
!@@ $     @
!@! $     @
!@! $     @
!!! $     @
:!! $     @
:!: $     @
 ::: ::: $@
 :: :: : $@
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
 :::: :: $@
:: :  : $ @
          @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
@@! $     @
!@! $     @
@!!!:! $  @
!!!!!: $  @
!!: $     @
:!: $     @
 :: :::: $@
: :: :: $ @
          @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
@@! $     @
!@! $     @
@!!!:! $  @
!!!!!: $  @
!!: $     @
:!: $     @
 :: $     @
 : $      @
          @@
           @
 @@@@@@@@ $@
@@@@@@@@@ $@
!@@ $      @
!@! $      @
!@! @!@!@ $@
!!! !!@!! $@
:!!   !!: $@
:!:   !:: $@
 ::: :::: $@
 :: :: : $ @
           @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!@!@! $@
!!!@!!!! $@
!!:  !!! $@
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
     @
@@@ $@
@@@ $@
@@! $@
!@! $@
!!@ $@
!!! $@
!!: $@
:!: $@
 :: $@
: $  @
     @@
          @
     @@@ $@
     @@@ $@
     @@! $@
     !@! $@
     !!@ $@
     !!! $@
     !!: $@
!!:  :!: $@
::: : :: $@
 : ::: $  @
          @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  !@@ $@
!@!  @!! $@
@!@@!@! $ @
!!@!!! $  @
!!: :!! $ @
:!:  !:! $@
 ::  ::: $@
 :   ::: $@
          @@
          @
@@@      $@
@@@      $@
@@!      $@
!@!      $@
@!!      $@
!!!      $@
!!:      $@
 :!:     $@
 :: :::: $@
: :: : : $@
          @@
             @
@@@@@@@@@@ $ @
@@@@@@@@@@@ $@
@@! @@! @@! $@
!@! !@! !@! $@
@!! !!@ @!@ $@
!@!   ! !@! $@
!!:     !!: $@
:!:     :!: $@
:::     :: $ @
 :      : $  @
             @@
          @
@@@  @@@ $@
@@@@ @@@ $@
@@!@!@@@ $@
!@!!@!@! $@
@!@ !!@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
 ::   :: $@
::    : $ @
          @@
          @
 @@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
::::: :: $@
 : :  : $ @
          @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@@!@! $ @
!!@!!! $  @
!!: $     @
:!: $     @
 :: $     @
 : $      @
          @@
           @
 @@@@@@ $  @
@@@@@@@@ $ @
@@!  @@@ $ @
!@!  @!@ $ @
@!@  !@! $ @
!@!  !!! $ @
!!:!!:!: $ @
:!: :!:  $ @
::::: :! $ @
 : :  ::: $@
           @@
          @
@@@@@@@ $ @
@@@@@@@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@!!@! $ @
!!@!@! $  @
!!: :!! $ @
:!:  !:! $@
::   ::: $@
 :   : : $@
          @@
          @
 @@@@@@ $ @
@@@@@@@ $ @
!@@ $     @
!@! $     @
!!@@!! $  @
 !!@!!! $ @
     !:! $@
    !:! $ @
:::: :: $ @
:: : : $  @
          @@
         @
@@@@@@@ $@
@@@@@@@ $@
  @@! $  @
  !@! $  @
  @!! $  @
  !!! $  @
  !!: $  @
  :!: $  @
   :: $  @
   : $   @
         @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
!!:  !!! $@
:!:  !:! $@
::::: :: $@
 : :  : $ @
          @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  @@@ $@
!@!  @!@ $@
@!@  !@! $@
!@!  !!! $@
:!:  !!: $@
 ::!!:! $ @
  :::: $  @
   : $    @
          @@
               @
@@@  @@@  @@@ $@
@@@  @@@  @@@ $@
@@!  @@!  @@! $@
!@!  !@!  !@! $@
@!!  !!@  @!@ $@
!@!  !!!  !@! $@
!!:  !!:  !!: $@
:!:  :!:  :!: $@
 :::: :: ::: $ @
  :: :  : : $  @
               @@
          @
@@@  @@@ $@
@@@  @@@ $@
@@!  !@@ $@
!@!  @!! $@
 !@@!@! $ @
  @!!! $  @
 !: :!! $ @
:!:  !:! $@
 ::  ::: $@
 :   :: $ @
          @@
         @
@@@ @@@ $@
@@@ @@@ $@
@@! !@@ $@
!@! @!! $@
 !@!@! $ @
  @!!! $ @
  !!: $  @
  :!: $  @
   :: $  @
   : $   @
         @@
          @
@@@@@@@@ $@
@@@@@@@@ $@
     @@! $@
    !@! $ @
   @!! $  @
  !!! $   @
 !!: $    @
:!: $     @
 :: :::: $@
: :: : : $@
          @@
          @
   @@@@@ $@
   @@@@@ $@
  @@! $   @
  !@! $   @
@!@ $     @
!!! $     @
  !!: $   @
  :!: $   @
   ::::: $@
    : : $ @
          @@
     @
@@@ $@
@@@ $@
@@! $@
!@! $@
 $$  @
!!! $@
!!: $@
:!: $@
:: $ @
 : $ @
     @@
          @
@@@@@ $   @
@@@@@ $   @
   @@! $  @
   !@! $  @
     @!@ $@
     !!! $@
   !!: $  @
   :!: $  @
::::: $   @
 : : $    @
          @@
               @
               @
   !@!    @!@ $@
 @!@!@!@!@!@ $ @
!!!    !@! $   @
  $      $     @
  $      $     @
  $      $     @
  $      $     @
  $      $     @
  $      $     @
               @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @
  @@
```