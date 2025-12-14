## Comprehensive Nimini Feature Demonstration
## This example showcases all major language features

import ../nimini

const exampleCode = """
# ============================================================================
# Constants and Type Definitions
# ============================================================================

const MaxBufferSize = 1024
const SampleRate: int = 44100
const DefaultFrequency: float = 440.0

# ============================================================================
# Variables with Type Annotations
# ============================================================================

var counter: int = 0
var temperature: float = 98.6
var message: string = "Hello, Nimini!"
var isActive: bool = true

# ============================================================================
# Sequence Operations
# ============================================================================

print("=== Sequence Operations ===")
var numbers = newSeq(0)

# Add elements
add(numbers, 10)
add(numbers, 20)
add(numbers, 30)
add(numbers, 40)
add(numbers, 50)

print("Numbers length:", len(numbers))

# Insert at beginning
insert(numbers, 5, 0)
print("After insert at 0:", len(numbers))

# Delete an element
delete(numbers, 2)
print("After delete at 2:", len(numbers))

# Resize
setLen(numbers, 10)
print("After resize to 10:", len(numbers))

# ============================================================================
# For Loops and Ranges
# ============================================================================

print("")
print("=== For Loop Demo ===")
print("Counting from 0 to 4:")
for i in 0..<5:
  print("  Count:", i)

# ============================================================================
# Functions with Type Annotations
# ============================================================================

proc multiply(a: int, b: int): int:
  return a * b

proc divide(x: float, y: float): float:
  return x / y

print("")
print("=== Function Calls ===")
var product = multiply(7, 6)
print("7 * 6 =", product)

var quotient = divide(100.0, 4.0)
print("100.0 / 4.0 =", quotient)

# ============================================================================
# Defer Statements
# ============================================================================

proc demonstrateDefer():
  print("")
  print("=== Defer Demo ===")
  print("Starting function...")
  
  defer: print("Defer 1: This executes last")
  print("Middle of function...")
  
  defer: print("Defer 2: This executes second")
  print("Near end of function...")
  
  defer: print("Defer 3: This executes first")
  print("Function body complete")
  # Note: defers execute in LIFO order when function returns

demonstrateDefer()

# ============================================================================
# Cast and Pointer Operations
# ============================================================================

print("")
print("=== Cast and Pointer Demo ===")

var value = 42
print("Original value:", value)

var castedValue = cast[int](value)
print("Casted value:", castedValue)

var ptr = addr value
print("Pointer created (addr operator)")
# Note: Dereferencing in Nimini is simplified

# ============================================================================
# Conditional Logic
# ============================================================================

print("")
print("=== Conditional Logic ===")

var score = 85

if score >= 90:
  print("Grade: A")
elif score >= 80:
  print("Grade: B")
elif score >= 70:
  print("Grade: C")
else:
  print("Grade: F")

# ============================================================================
# While Loops
# ============================================================================

print("")
print("=== While Loop ===")
var countdown = 5
print("Countdown:")
while countdown > 0:
  print("  ", countdown)
  countdown = countdown - 1
print("  Liftoff!")

# ============================================================================
# Complex Function with Multiple Features
# ============================================================================

proc processData(size: int): int:
  defer: print("Cleanup: processData complete")
  
  var localData = newSeq(size)
  
  for i in 0..<size:
    add(localData, i * 2)
  
  var sum: int = 0
  var length = len(localData)
  
  # Calculate sum
  for i in 0..<length:
    if i < len(localData):
      sum = sum + i
  
  return sum

print("")
print("=== Complex Function ===")
var result = processData(10)
print("Result from processData:", result)

# ============================================================================
# Pragmas (for native function callbacks)
# ============================================================================

proc audioCallback(buffer: int, frames: int): int {.cdecl.}:
  # This would be used as a callback in audio systems
  return frames

proc renderCallback(width: int, height: int): int {.cdecl.}:
  # This would be used as a callback in graphics systems
  return width * height

print("")
print("=== Pragma Demo (callbacks) ===")
var audioFrames = audioCallback(0, 256)
print("Audio callback returned:", audioFrames)

var pixels = renderCallback(800, 600)
print("Render callback returned:", pixels)

# ============================================================================
# Nested Scopes and Defer
# ============================================================================

proc nestedDefers():
  print("")
  print("=== Nested Defer Demo ===")
  defer: print("Outer defer")
  
  proc innerFunction():
    defer: print("Inner defer 1")
    defer: print("Inner defer 2")
    print("Inside inner function")
  
  print("Before inner call")
  innerFunction()
  print("After inner call")

nestedDefers()

# ============================================================================
# Summary
# ============================================================================

print("")
print("=== Summary ===")
print("✓ Constants and type annotations")
print("✓ Sequence operations (newSeq, add, delete, insert, len, setLen)")
print("✓ For loops with ranges")
print("✓ Functions with typed parameters and return values")
print("✓ Defer statements for cleanup")
print("✓ Cast expressions")
print("✓ Pointer operations (addr)")
print("✓ Pragmas for native callbacks")
print("✓ Conditional logic and loops")
print("")
print("All Nimini features demonstrated successfully!")
"""

proc main() =
  echo "Nimini Comprehensive Feature Demonstration"
  echo "==========================================="
  echo ""
  
  # Initialize runtime
  initRuntime()
  
  # Register sequence operations
  registerSeqOps()
  
  # Register print function
  proc niminiPrint(env: ref Env; args: seq[Value]): Value =
    for i, arg in args:
      if i > 0: stdout.write(" ")
      stdout.write($arg)
    stdout.write("\n")
    return valNil()
  
  registerNative("print", niminiPrint)
  
  # Tokenize
  let tokens = tokenizeDsl(exampleCode)
  
  # Parse
  let program = parseDsl(tokens)
  
  # Execute
  try:
    execProgram(program, runtimeEnv)
  except:
    echo ""
    echo "Error: ", getCurrentExceptionMsg()

when isMainModule:
  main()
