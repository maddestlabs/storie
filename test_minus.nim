import src/nimini/tokenizer
import src/nimini/parser

echo "Testing minus operator parsing..."

let code = """
var width = 800
var titleX = (width / 2) - 180
var mouseX = 100
var sliderX = 50
var mouseOffset = mouseX - sliderX
"""

echo "=== Tokenizing ==="
let tokens = tokenizeDsl(code)
for t in tokens:
  echo t

echo ""
echo "=== Parsing ==="
try:
  let ast = parseDsl(tokens)
  echo "Success! AST parsed correctly"
except Exception as e:
  echo "Error: ", e.msg
