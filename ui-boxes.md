---
title: "Box Drawing"
minWidth: 60
minHeight: 25
---

```lua global
function globalRender()
  buffer:clear()
  
  -- Title
  buffer:write(5, 2, "Unicode Box Drawing Test", 33, 0, true)
  
  -- Test 1: Simple box with border style
  buffer:write(5, 4, "Test 1: Border style", 36, 0, false)
  buffer:drawBox(5, 5, 20, 5, "border")
  buffer:write(7, 7, "Border style", 37, 0, false)
  
  -- Test 2: Highlighted box
  buffer:write(30, 4, "Test 2: Highlight style", 36, 0, false)
  buffer:drawBox(30, 5, 20, 5, "highlight")
  buffer:write(32, 7, "Highlight", 37, 0, false)
  
  -- Test 3: Custom style box
  buffer:write(5, 11, "Test 3: Warning style", 36, 0, false)
  buffer:drawBox(5, 12, 20, 5, "warning")
  buffer:write(7, 14, "Warning box", 37, 0, false)
  
  -- Test 4: Multiple nested boxes
  buffer:write(30, 11, "Test 4: Nested", 36, 0, false)
  buffer:drawBox(30, 12, 20, 7, "border")
  buffer:drawBox(32, 13, 16, 5, "info")
  buffer:write(34, 15, "Nested!", 37, 0, false)
  
  -- Instructions
  buffer:write(5, 22, "Press Q to exit", 36, 0, false)
end

function globalHandleKey(key)
  if key == "q" or key == "Q" then
    return false
  end
  return true
end

setMultiSectionMode(true)
```

Box Drawing Test
This should display beautiful Unicode box characters!