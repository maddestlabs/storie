## Test file for new Nimini language features

import ../nimini

const testCode = """
# Test const declarations
const MaxSamples = 512
const SampleRate: int = 44100

# Test var with type annotations
var frequency: float = 440.0
var audioFrequency: float = 440.0

# Test newSeq (sequence operations)
var data = newSeq(MaxSamples)

# Test for loops with ranges
for i in 0..<10:
  print(i)

# Test cast expressions
# Note: In runtime, cast is simplified to just return the value
var myValue = 32000
var casted = cast[int](myValue)

# Test addr operator
var myVar = 100
var myAddr = addr myVar

# Test proc with return type (pragmas temporarily disabled for testing)
proc audioCallback(buffer: int, frames: int):
  return frames

# Test defer
proc cleanup():
  defer: print("Cleaning up!")
  print("Doing work")

# Call cleanup to test defer
cleanup()

print("All tests passed!")
"""

proc main() =
  echo "Testing new Nimini features..."
  echo ""
  
  # Tokenize
  echo "[DEBUG] Tokenizing..."
  let tokens = tokenizeDsl(testCode)
  echo "Tokenized ", tokens.len, " tokens"
  
  # Parse
  echo "[DEBUG] Parsing..."
  let program = parseDsl(tokens)
  echo "Parsed ", program.stmts.len, " statements"
  
  # Execute
  echo "[DEBUG] Initializing runtime..."
  initRuntime()
  
  echo "[DEBUG] Registering sequence operations..."
  # Register sequence operations (must be after initRuntime)
  registerSeqOps()
  echo "[DEBUG] Done registering"
  
  # Register print function
  proc niminiPrint(env: ref Env; args: seq[Value]): Value =
    for i, arg in args:
      if i > 0: stdout.write(" ")
      stdout.write($arg)
    stdout.write("\n")
    return valNil()
  
  registerNative("print", niminiPrint)
  
  echo ""
  echo "Executing program:"
  echo "=================="
  try:
    execProgram(program, runtimeEnv)
    echo ""
    echo "✓ Program executed successfully!"
  except:
    echo "✗ Error: ", getCurrentExceptionMsg()

when isMainModule:
  main()
