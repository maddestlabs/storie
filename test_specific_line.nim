import src/nimini/tokenizer
import src/nimini/parser
import strutils

# This is line 96 from the render block - testing specifically
let testCode1 = """
var samplesToGenerate = 2048
var samplesTimesTwo = samplesToGenerate * 2
"""

echo "Test 1: Basic multiplication"
try:
  let tokens1 = tokenizeDsl(testCode1)
  let program1 = parseDsl(tokens1)
  echo "SUCCESS"
except Exception as e:
  echo "ERROR: ", e.msg

# Test with the specific pattern
let testCode2 = """
var samplesToGenerate = 2048
var audioBuffer = newSeq[float](samplesToGenerate * 2)
"""

echo ""
echo "Test 2: newSeq with multiplication"
try:
  let tokens2 = tokenizeDsl(testCode2)
  let program2 = parseDsl(tokens2)
  echo "SUCCESS"
except Exception as e:
  echo "ERROR: ", e.msg

# Test with multiplication in a range
let testCode3 = """
for i in 0..<10:
  var x = i * 2
  var y = x + 1
"""

echo ""
echo "Test 3: For loop with range and multiplication"
try:
  let tokens3 = tokenizeDsl(testCode3)
  let program3 = parseDsl(tokens3)
  echo "SUCCESS"
except Exception as e:
  echo "ERROR: ", e.msg

# Test the actual pattern from line 96-102
let testCode4 = """
var samplesToGenerate = 2048
var samplesTimesTwo = samplesToGenerate * 2
var audioBuffer = newSeq[float](samplesTimesTwo)

for i in 0..<samplesToGenerate:
  var sample = 0.5
  var bufIdx1 = i * 2
"""

echo ""
echo "Test 4: Full pattern from audio_slider lines 96-102"
try:
  let tokens4 = tokenizeDsl(testCode4)
  
  echo "Tokens around problem area:"
  for i, tok in tokens4:
    if i >= 40 and i <= 60:
      echo "  ", i, ": ", tok
  
  let program4 = parseDsl(tokens4)
  echo "SUCCESS"
except Exception as e:
  echo "ERROR: ", e.msg
