# Forest Entrance

You stand at the edge of a dark forest. A path leads north.

``` lvl
##########
#        ######
#   @         #
#             #
#   ^         #
###############
```

``` lua on:enter
if not getFlag("visited_forest") then
  showMessage("A chill runs down your spine...")
  setFlag("visited_forest", true)
  addItem("key")
  showMessage("You found a mystical key on the ground!")
end
```

``` lua on:interact
local x, y = playerPos()
-- Check if player is on the special tile (the ^ symbol)
if y == 4 and x == 4 then
  if hasItem("key") then
    showMessage("You use the key. The path opens!")
    teleport("Deep Forest")
  else
    showMessage("The path is magically sealed. You need a key.")
  end
else
  showMessage("Nothing interesting here.")
end
```

# Deep Forest

The forest deepens around you. Mysterious symbols glow on the trees.

``` lvl
##########
#  *   * #
#        #
#   @    ######
# *           #
#             #
#       *     #
#             #
#  *          #
#    *        #######
#                  *#
#                  *#
#               ****#
#           * #######
#             #
# *           #
#             #
#    *        #
###############
```

``` lua on:enter
showMessage("You've entered the deep forest!")
if not hasItem("key") then
  addItem("key")
  showMessage("You found a mystical key on the ground!")
end
```

``` lua on:interact
showMessage("The mysterious symbols pulse with ancient magic.")
```
