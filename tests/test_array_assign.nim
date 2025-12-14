import nimini/tokenizer
import nimini/parser

let code1 = """
var audioBuffer = newSeq[float](10)
audioBuffer[0] = 5.0
"""

echo "Test 1: Array assignment"
let tokens1 = tokenizeDsl(code1)
for tok in tokens1:
  echo tok
echo ""
let program1 = parseDsl(tokens1)
echo "SUCCESS"
