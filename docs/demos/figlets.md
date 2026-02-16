---
theme: "neotopia"
---

# Figlet Helper Demo

This demo shows **embedded FIGlet fonts** in Storie:

- Define named FIGlet fonts in markdown with `figlet name:...` fenced blocks.
- Access them from sandboxed JS via `figlet.*` (document-scoped).
- Draw them into the terminal with `drawFiglet(x, y, fontName, text, fg?, bg?, options?)`.

```js
let status = 'Loading…';
```

```js on:init
term.layerID = 'default';
term.clear();

status = `Found ${figlet.list().length} figlet font(s): ${figlet.list().join(', ')}`;
```

```js on:render
term.layerID = 'default';
term.clear();

term.write(2, 1, '=== Figlet Demo ===', 0xffffffff);
term.write(2, 3, status, 0xaaaaaaff);

// Manual way: render lines and write them
term.write(2, 5, 'Manual (figlet.render + term.write):', 0xccccccff);
const hello = figlet.render('standard', 'HELLO');
for (let i = 0; i < hello.length; i++) {
    term.write(2, 6 + i, hello[i] ?? '', 0xffffffff);
}

// Convenience helper
term.write(2, 14, 'Helper (drawFiglet):', 0xccccccff);
drawFiglet(2, 15, 'standard', 'STYLED', getStyle('warning').fg);

// Horizontal with letter spacing
term.write(2, 23, 'Letter spacing (3):', 0xccccccff);
drawFiglet(2, 24, 'standard', 'SPACE', 0xffffffff, undefined, { letterSpacing: 3 });

// Vertical
term.write(45, 5, 'Vertical:', 0xccccccff);
drawFiglet(45, 6, 'standard', 'HEY', 0xffffffff, undefined, { vertical: true, letterSpacing: 0 });
```

```figlet name:standard
flf2a$ 6 4 6 -1 4
3x5 font by Richard Kirk (rak@crosfield.co.uk).
Ported to figlet, and slightly changed (without permission :-})
by Daniel Cabeza Gras (bardo@dia.fi.upm.es)

    @
    @
    @
    @
    @
    @@
    @
 #  @
 #  @
 #  @
    @
 #  @@
    @
# # @
# # @
    @
    @
    @@
    @
# # @
### @
# # @
### @
# # @@
    @
 ## @
##  @
### @
 ## @
##  @@
    @
# # @
  # @
 #  @
#   @
# # @@
    @
 #  @
#   @
 ## @
# # @
### @@
    @
  # @
 #  @
#   @
    @
    @@
    @
  # @
 #  @
 #  @
 #  @
  # @@
    @
#   @
 #  @
 #  @
 #  @
#   @@
    @
 #  @
### @
 #  @
### @
 #  @@
    @
    @
 #  @
### @
 #  @
    @@
    @
    @
    @
    @
 #  @
#   @@
    @
    @
    @
### @
    @
    @@
    @
    @
    @
    @
    @
 #  @@
    @
  # @
  # @
 #  @
#   @
#   @@
    @
### @
# # @
# # @
# # @
### @@
    @
 #  @
##  @
 #  @
 #  @
### @@
    @
### @
  # @
### @
#   @
### @@
    @
### @
  # @
 ## @
  # @
### @@
    @
# # @
# # @
### @
  # @
  # @@
    @
### @
#   @
### @
  # @
### @@
    @
### @
#   @
### @
# # @
### @@
    @
### @
  # @
  # @
  # @
  # @@
    @
### @
# # @
### @
# # @
### @@
    @
### @
# # @
### @
  # @
### @@
    @
    @
 #  @
    @
 #  @
    @@
    @
    @
 #  @
    @
 #  @
#   @@
    @
  # @
 #  @
#   @
 #  @
  # @@
    @
    @
### @
    @
### @
    @@
    @
#   @
 #  @
  # @
 #  @
#   @@
    @
### @
  # @
 ## @
    @
 #  @@
    @
### @
# # @
#   @
### @
    @@
    @
 #  @
# # @
### @
# # @
# # @@
    @
##  @
# # @
##  @
# # @
##  @@
    @
 ## @
#   @
#   @
#   @
 ## @@
    @
##  @
# # @
# # @
# # @
##  @@
    @
### @
#   @
##  @
#   @
### @@
    @
### @
#   @
##  @
#   @
#   @@
    @
 ## @
#   @
# # @
# # @
 ## @@
    @
# # @
# # @
### @
# # @
# # @@
    @
### @
 #  @
 #  @
 #  @
### @@
    @
 ## @
  # @
  # @
# # @
 #  @@
    @
# # @
# # @
##  @
# # @
# # @@
    @
#   @
#   @
#   @
#   @
### @@
    @
# # @
### @
### @
# # @
# # @@
    @
### @
# # @
# # @
# # @
# # @@
    @
 #  @
# # @
# # @
# # @
 #  @@
    @
##  @
# # @
##  @
#   @
#   @@
    @
 #  @
# # @
# # @
 ## @
  # @@
    @
##  @
# # @
##  @
# # @
# # @@
    @
 ## @
#   @
 #  @
  # @
##  @@
    @
### @
 #  @
 #  @
 #  @
 #  @@
    @
# # @
# # @
# # @
# # @
### @@
    @
# # @
# # @
# # @
# # @
 #  @@
    @
# # @
# # @
### @
### @
# # @@
    @
# # @
# # @
 #  @
# # @
# # @@
    @
# # @
# # @
 #  @
 #  @
 #  @@
    @
### @
  # @
 #  @
#   @
### @@
    @
 ## @
 #  @
 #  @
 #  @
 ## @@
    @
#   @
#   @
 #  @
  # @
  # @@
    @
##  @
 #  @
 #  @
 #  @
##  @@
    @
 #  @
# # @
    @
    @
    @@
    @
    @
    @
    @
    @
### @@
    @
#   @
 #  @
  # @
    @
    @@
    @
    @
 ## @
# # @
### @
    @@
    @
#   @
### @
# # @
### @
    @@
    @
    @
### @
#   @
### @
    @@
    @
  # @
### @
# # @
### @
    @@
    @
    @
### @
##  @
### @
    @@
    @
 ## @
 #  @
### @
 #  @
##  @@
    @
    @
### @
# # @
 ## @
### @@
    @
#   @
### @
# # @
# # @
    @@
    @
 #  @
    @
 #  @
 ## @
    @@
    @
 #  @
    @
 #  @
 #  @
#   @@
    @
#   @
# # @
##  @
# # @
    @@
    @
 #  @
 #  @
 #  @
 ## @
    @@
    @
    @
### @
### @
# # @
    @@
    @
    @
##  @
# # @
# # @
    @@
    @
    @
### @
# # @
### @
    @@
    @
    @
### @
# # @
### @
#   @@
    @
    @
### @
# # @
### @
  # @@
    @
    @
### @
#   @
#   @
    @@
    @
    @
 ## @
 #  @
##  @
    @@
    @
 #  @
### @
 #  @
 ## @
    @@
    @
    @
# # @
# # @
### @
    @@
    @
    @
# # @
# # @
 #  @
    @@
    @
    @
# # @
### @
### @
    @@
    @
    @
# # @
 #  @
# # @
    @@
    @
    @
# # @
### @
  # @
### @@
    @
    @
##  @
 #  @
 ## @
    @@
    @
 ## @
 #  @
##  @
 #  @
 ## @@
    @
 #  @
 #  @
 #  @
 #  @
 #  @@
    @
##  @
 #  @
 ## @
 #  @
##  @@
    @
  # @
### @
#   @
    @
    @@
    @
# # @
 #  @
# # @
### @
# # @@
    @
# # @
### @
# # @
# # @
### @@
    @
# # @
    @
# # @
# # @
### @@
    @
# # @
 ## @
# # @
### @
    @@
    @
# # @
### @
# # @
### @
    @@
    @
# # @
    @
# # @
### @
    @@
    @
### @
##  @
# # @
##  @
#   @@
```
