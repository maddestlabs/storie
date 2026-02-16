# Digital Clock Example

A real-time digital clock with large figlet-style digits that updates every frame.

```nim on:init
# Initialize figlet font
var fontLoaded = figletLoadFont("jazmine")
var debugMsg = "Font loaded: " & $fontLoaded

# Initialize rain particles using parallel arrays
var rainX = []
var rainY = []
var rainPrevY = []
var rainSpeed = []
var rainColor = []
var rainChar = []
var numRainParticles = 40

# Create rain particles
var i = 0
while i < numRainParticles:
  rainX = rainX + [randInt(80)]
  var startY = randInt(24)
  rainY = rainY + [startY]
  rainPrevY = rainPrevY + [startY]
  rainSpeed = rainSpeed + [1 + randInt(3)]
  rainColor = rainColor + [randInt(7)]
  rainChar = rainChar + [randInt(3)]
  i = i + 1
```

```nim on:render
# Clear the screen
clear()

# Update and draw rain particles
var i = 0
while i < numRainParticles:
  # Clear the previous position
  var prevPx = rainX[i]
  var prevPy = rainPrevY[i]
  if prevPx >= 0 and prevPx < termWidth and prevPy >= 0 and prevPy < termHeight:
    draw(0, prevPx, prevPy, " ", defaultStyle())
  
  # Save current position as previous
  rainPrevY[i] = rainY[i]
  
  # Update position
  rainY[i] = rainY[i] + rainSpeed[i]
  
  # Wrap around when particle goes off bottom
  if rainY[i] >= termHeight:
    rainY[i] = 0
    rainPrevY[i] = 0
    rainX[i] = randInt(termWidth)
  
  # Choose rain character
  var pChar = " "
  var charType = rainChar[i]
  if charType == 0:
    pChar = "|"
  if charType == 1:
    pChar = "!"
  if charType == 2:
    pChar = "."
  
  # Choose color based on particle color value and create style
  var pStyle = defaultStyle()
  var colorType = rainColor[i]
  if colorType == 0:
    pStyle.fg = cyan()
  if colorType == 1:
    pStyle.fg = blue()
  if colorType == 2:
    pStyle.fg = rgb(100, 150, 255)
  if colorType == 3:
    pStyle.fg = rgb(150, 200, 255)
  if colorType == 4:
    pStyle.fg = magenta()
  if colorType == 5:
    pStyle.fg = rgb(200, 100, 255)
  if colorType == 6:
    pStyle.fg = rgb(100, 255, 200)
  
  # Draw the rain particle
  var px = rainX[i]
  var py = rainY[i]
  if px >= 0 and px < termWidth and py >= 0 and py < termHeight:
    draw(0, px, py, pChar, pStyle)
  
  i = i + 1

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

draw(0, 1, 2, "Time: " & timeStr)

# Try to render
var lines = figletRender("jazmine", timeStr)

# Center and draw
if len(lines) > 0:
  var clockWidth = len(lines[0])
  var clockHeight = len(lines)
  
  var startX = 0
  if clockWidth < termWidth:
    var diff = termWidth - clockWidth
    startX = diff / 2
  
  var startY = 10
  if clockHeight < termHeight:
    var diff = termHeight - clockHeight
    startY = diff / 2
  
  var y = startY
  for line in lines:
    draw(0, startX, y, line)
    y = y + 1
else:
  draw(0, 2, 8, "No lines to render!")
```

```figlet name:jazmine
flf2a$ 8 4 14 0 21 0 16256
Cricket by Leslie Bates        Jan. 1, 1996
cricket9@aros.net       http://www.aros.net/~cricket9
I wish to thank Wade Fincher for the SIG that was used as a base for Cricket as
well as Chris Gill who designed the Square font, some of which was used in 
Cricket. And finally I wish to thank Paul Burton, who if it was not for his 
desire to create FIGWin, I may never have had the motivation to create a 
FIGfont.
 FIGWin is the Windows clone of FIGlet with a full featured FIGfont editor!
 Forget about doing the math to figure out the smushmode number.  Just check a
 few boxes for each smushing rule.  Forget about endmarks -- let the computer
 figure out how tall and how wide your font is.  Just draw FIGfonts with the
 mouse and wipe the smudgemarks off your screen from all that counting!

 FIGWin is full of features, but it's designed for use by a complete idiot.  If
 you qualify, visit the FIGWin website.  Screen shots are shown, and of course
 you can download it.  (FREE!)

                      http://home.earthlink.net/~solution

 Also see the FIGlet website:  http://st-www.cs.uiuc.edu/users/chai/figlet.html

 $$@
 $$@
 $$@
 $$@
 $$@
   @
   @
   @@
  __ @
 |  |@
 |__|@
 |__|@
     @
     @
     @
     @@
  ____ @
 | |  |@
  |_|_|@
       @
       @
       @
       @
       @@
    _____   @
  _|  |  |_ @
 |_       _|@
 |_       _|@
   |__|__|  @
            @
            @
            @@
  __,-,__ @
 |  ' '__|@
 |__     |@
 |_______|@
    |_|   @
          @
          @
          @@
  __ ___ @
 |__|   |@
 |    __|@
 |___|__|@
         @
         @
         @
         @@
  __,-,__ @
 |  ' '__|@
 |     __|@
 |_______|@
    |_|   @
          @
          @
          @@
  __ @
 |  |@
  |_|@
     @
     @
     @
     @
     @@
   ___ @
 ,'  _|@
 |  |  @
 |  |_ @
 `.___|@
       @
       @
       @@
  ___  @
 |_  `.@
   |  |@
  _|  |@
 |___,'@
       @
       @
       @@
  __ _ __ @
 |  | |  |@
  >     < @
 |__|_|__|@
          @
          @
          @
          @@
    __   @
  _|  |_ @
 |_    _|@
   |__|  @
         @
         @
         @
         @@
     @
     @
  __ @
 |  |@
  |_|@
     @
     @
     @@
         @
  ______ @
 |______|@
         @
         @
         @
         @
         @@
     @
     @
  __ @
 |__|@
     @
     @
     @
     @@
     ___@
    /  /@
  ,' ,' @
 /__/   @
        @
        @
        @
        @@
  _______ @
 |   _   |@
 |.  |   |@
 |.  |   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _____ @
 | _   |@
 |.|   |@
 `-|.  |@
   |:  |@
   |::.|@
   `---'@
        @@
  _______ @
 |       |@
 |___|   |@
  /  ___/ @
 |:  1  \ @
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |___|   |@
  _(__   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ___ ___ @
 |   Y   |@
 |   |   |@
 |____   |@
     |:  |@
     |::.|@
     `---'@
          @@
  _______ @
 |   _   |@
 |   1___|@
 |____   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |   1___|@
 |.     \ @
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |___|   |@
    /   / @
   |   |  @
   |   |  @
   `---'  @
          @@
  _______ @
 |   _   |@
 |.  |   |@
 |.  _   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |   |   |@
  \___   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  __ @
 |__|@
  __ @
 |__|@
     @
     @
     @
     @@
  __ @
 |__|@
  __ @
 |  |@
  |_|@
     @
     @
     @@
    __ @
  ,' _|@
 /  /  @
 \  \_ @
  `.__|@
       @
       @
       @@
         @
  ______ @
 |______|@
 |______|@
         @
         @
         @
         @@
  __   @
 |_ `. @
   \  \@
  _/  /@
 |__,' @
       @
       @
       @@
  _____ @
 |__   |@
 ',  ,- @
  |--|  @
  '--   @
        @
        @
        @@
  _________ @
 |   ___   |@
 |  |  _   |@
 |  |______|@
 |_________|@
            @
            @
            @@
  _______ @
 |   _   |@
 |.  1   |@
 |.  _   |@
 |:  |   |@
 |::.|:. |@
 `--- ---'@
          @@
  _______  @
 |   _   \ @
 |.  1   / @
 |.  _   \ @
 |:  1    \@
 |::.. .  /@
 `-------' @
           @@
  _______ @
 |   _   |@
 |.  1___|@
 |.  |___ @
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ______   @
 |   _  \  @
 |.  |   \ @
 |.  |    \@
 |:  1    /@
 |::.. . / @
 `------'  @
           @@
  _______ @
 |   _   |@
 |.  1___|@
 |.  __)_ @
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |.  1___|@
 |.  __)  @
 |:  |    @
 |::.|    @
 `---'    @
          @@
  _______ @
 |   _   |@
 |.  |___|@
 |.  |   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ___ ___ @
 |   Y   |@
 |.  1   |@
 |.  _   |@
 |:  |   |@
 |::.|:. |@
 `--- ---'@
          @@
  ___ @
 |   |@
 |.  |@
 |.  |@
 |:  |@
 |::.|@
 `---'@
      @@
  _______ @
 |   _   |@
 |___|   |@
 |.  |   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ___ ___  @
 |   Y   ) @
 |.  1  /  @
 |.  _  \  @
 |:  |   \ @
 |::.| .  )@
 `--- ---' @
           @@
  ___     @
 |   |    @
 |.  |    @
 |.  |___ @
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ___ ___ @
 |   Y   |@
 |.      |@
 |. \_/  |@
 |:  |   |@
 |::.|:. |@
 `--- ---'@
          @@
  ______  @
 |   _  \ @
 |.  |   |@
 |.  |   |@
 |:  |   |@
 |::.|   |@
 `--- ---'@
          @@
  _______ @
 |   _   |@
 |.  |   |@
 |.  |   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |   _   |@
 |.  1   |@
 |.  ____|@
 |:  |    @
 |::.|    @
 `---'    @
          @@
  _______ @
 |   _   |@
 |.  |   |@
 |.  |   |@
 |:  1   |@
 |::..   |@
 `----|:.|@
      `--'@@
  _______ @
 |   _   \@
 |.  l   /@
 |.  _   1@
 |:  |   |@
 |::.|:. |@
 `--- ---'@
          @@
  _______ @
 |   _   |@
 |   1___|@
 |____   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  _______ @
 |       |@
 |.|   | |@
 `-|.  |-'@
   |:  |  @
   |::.|  @
   `---'  @
          @@
  ___ ___ @
 |   Y   |@
 |.  |   |@
 |.  |   |@
 |:  1   |@
 |::.. . |@
 `-------'@
          @@
  ___ ___ @
 |   Y   |@
 |.  |   |@
 |.  |   |@
 |:  1   |@
  \:.. ./ @
   `---'  @
          @@
  ___ ___ @
 |   Y   |@
 |.  |   |@
 |. / \  |@
 |:      |@
 |::.|:. |@
 `--- ---'@
          @@
   ___ ___  @
  (   Y   ) @
   \  1  /  @
   /  _  \  @
  /:  |   \ @
 (::. |:.  )@
  `--- ---' @
            @@
  ___ ___ @
 |   Y   |@
 |   1   |@
  \_   _/ @
   |:  |  @
   |::.|  @
   `---'  @
          @@
  _______ @
 |   _   |@
 |___|   |@
  /  ___/ @
 |:  1  \ @
 |::.. . |@
 `-------'@
          @@
  ____ @
 |   _|@
 |  |  @
 |  |_ @
 |____|@
       @
       @
       @@
 ___    @
 \  \   @
  `. `. @
    \__\@
        @
        @
        @
        @@
  ____ @
 |_   |@
   |  |@
  _|  |@
 |____|@
       @
       @
       @@
  ____ @
 |    |@
 |_/\_|@
       @
       @
       @
       @
       @@
         @
         @
         @
  ______ @
 |______|@
         @
         @
         @@
  __ @
 |  |@
 |_| @
     @
     @
     @
     @
     @@
        @
 .---.-.@
 |  _  |@
 |___._|@
        @
        @
        @
        @@
  __    @
 |  |--.@
 |  _  |@
 |_____|@
        @
        @
        @
        @@
       @
 .----.@
 |  __|@
 |____|@
       @
       @
       @
       @@
     __ @
 .--|  |@
 |  _  |@
 |_____|@
        @
        @
        @
        @@
        @
 .-----.@
 |  -__|@
 |_____|@
        @
        @
        @
        @@
   ___ @
 .'  _|@
 |   _|@
 |__|  @
       @
       @
       @
       @@
        @
 .-----.@
 |  _  |@
 |___  |@
 |_____|@
        @
        @
        @@
  __    @
 |  |--.@
 |     |@
 |__|__|@
        @
        @
        @
        @@
  __ @
 |__|@
 |  |@
 |__|@
     @
     @
     @
     @@
   __ @
  |__|@
  |  |@
  |  |@
 |___|@
      @
      @
      @@
  __    @
 |  |--.@
 |    < @
 |__|__|@
        @
        @
        @
        @@
  __ @
 |  |@
 |  |@
 |__|@
     @
     @
     @
     @@
           @
 .--------.@
 |        |@
 |__|__|__|@
           @
           @
           @
           @@
        @
 .-----.@
 |     |@
 |__|__|@
        @
        @
        @
        @@
        @
 .-----.@
 |  _  |@
 |_____|@
        @
        @
        @
        @@
        @
 .-----.@
 |  _  |@
 |   __|@
 |__|   @
        @
        @
        @@
        @
 .-----.@
 |  _  |@
 |__   |@
    |__|@
        @
        @
        @@
       @
 .----.@
 |   _|@
 |__|  @
       @
       @
       @
       @@
        @
 .-----.@
 |__ --|@
 |_____|@
        @
        @
        @
        @@
  __   @
 |  |_ @
 |   _|@
 |____|@
       @
       @
       @
       @@
        @
 .--.--.@
 |  |  |@
 |_____|@
        @
        @
        @
        @@
        @
 .--.--.@
 |  |  |@
  \___/ @
        @
        @
        @
        @@
           @
 .--.--.--.@
 |  |  |  |@
 |________|@
           @
           @
           @
           @@
        @
 .--.--.@
 |_   _|@
 |__.__|@
        @
        @
        @
        @@
        @
 .--.--.@
 |  |  |@
 |___  |@
 |_____|@
        @
        @
        @@
        @
 .-----.@
 |-- __|@
 |_____|@
        @
        @
        @
        @@
   ___ @
  |  _|@
 /  /  @
 \  \_ @
  |___|@
       @
       @
       @@
  __ @
 |  |@
 |  |@
 |  |@
 |__|@
     @
     @
     @@
  ___  @
 |_  | @
   \  \@
  _/  /@
 |___| @
       @
       @
       @@
   ___ @
  | ' |@
 |_,_| @
       @
       @
       @
       @
       @@
 .--.--.@
 |-----|@
 |  -  |@
 |__|__|@
        @
        @
        @
        @@
 .--.--.@
 |-----|@
 |  _  |@
 |_____|@
        @
        @
        @
        @@
 .--.--.@
 |--|--|@
 |  |  |@
 |_____|@
        @
        @
        @
        @@
 .--.--.@
 |---.-|@
 |  _  |@
 |___._|@
        @
        @
        @
        @@
 .--.--.@
 |-----|@
 |  _  |@
 |_____|@
        @
        @
        @
        @@
 .--.--.@
 |--|--|@
 |  |  |@
 |_____|@
        @
        @
        @
        @@
  _______ @
 |    __ \@
 |    __ <@
 |  |____/@
 |__|     @
          @
          @
          @@

```