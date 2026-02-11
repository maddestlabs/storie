# Native Browser API Demo

This demo showcases S|torie's **native browser API access** - Web Audio API, Canvas 2D API, WebGL, and WebGPU with shared instances and zero overhead.

## 🎵 Web Audio API Example

### Simple Tone with Helper

```js on:init
console.log('🎵 Native API Demo loaded!');

// Simple helper - plays a 440Hz tone for 0.5 seconds
audio.playTone(440, 0.5, 0.3);
```

### Advanced Web Audio with Full API Access

```js
// Create a complex audio graph using the shared AudioContext
const lfo = audio.createOscillator();
const carrier = audio.createOscillator();
const lfoGain = audio.createGain();
const outputGain = audio.createGain();

// LFO modulates the carrier frequency
lfo.frequency.value = 5; // 5Hz vibrato
lfoGain.gain.value = 20; // ±20Hz modulation depth

carrier.frequency.value = 440; // A4 note
outputGain.gain.value = 0.2;

// Connect the audio graph
lfo.connect(lfoGain);
lfoGain.connect(carrier.frequency);
carrier.connect(outputGain);
outputGain.connect(audio.destination);

// Start oscillators
lfo.start();
carrier.start();

console.log('🎵 FM synthesis started!');
console.log('Audio context state:', audio.state);
console.log('Sample rate:', audio.sampleRate);
```

### Load and Play Audio Buffer

```js
// Load a sound asynchronously (you'd need a real sound file)
async function playSoundEffect() {
  try {
    // Example with a real URL:
    // const buffer = await audio.loadSound('https://example.com/sound.mp3');
    // audio.playBuffer(buffer, { volume: 0.5, loop: false });
    
    // For now, just show the API
    console.log('Use audio.loadSound(url) and audio.playBuffer(buffer) to play sounds');
  } catch (error) {
    console.error('Sound loading error:', error);
  }
}
```

## 🎨 Canvas 2D API Example

### Draw with Helpers

```js on:render
// Clear with transparency instead of opaque background
// This lets the terminal show through
canvas2d.clear('rgba(26, 26, 46, 0.7)'); // Semi-transparent dark background

// Draw some shapes using helpers
const time = getTime();
const centerX = canvas2d.width / 2;
const centerY = canvas2d.height / 2;

// Animated circle
const radius = 50 + Math.sin(time * 2) * 20;
canvas2d.drawCircle(centerX, centerY, radius, '#00ff88', true);

// Rotating rectangle
const ctx = canvas2d.context;
if (ctx) {
  ctx.save();
  ctx.translate(centerX + 100, centerY);
  ctx.rotate(time);
  canvas2d.drawRect(-25, -25, 50, 50, '#ff0088', false);
  ctx.restore();
}

// Text with custom font
canvas2d.text('Native Canvas 2D!', 20, 30, '#ffffff', '24px monospace');

// Draw some lines
for (let i = 0; i < 5; i++) {
  const x = (i / 5) * canvas2d.width;
  canvas2d.drawLine(x, 0, x, canvas2d.height, `hsl(${i * 60}, 80%, 60%)`, 2);
}
```

### Advanced Canvas 2D - Direct Context Access

```js
// Use the shared context directly for advanced operations
const ctx = canvas2d.context;
if (!ctx) {
  console.warn('Canvas 2D not available');
} else {
  // Create a gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas2d.width, 0);
  gradient.addColorStop(0, '#00ff88');
  gradient.addColorStop(0.5, '#0088ff');
  gradient.addColorStop(1, '#ff0088');
  
  // Draw with gradient
  ctx.fillStyle = gradient;
  ctx.fillRect(0, canvas2d.height - 50, canvas2d.width, 50);
  
  // Apply composite operations
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(255, 255, 0, 0.5)';
  ctx.fillRect(100, canvas2d.height - 60, 200, 60);
  ctx.globalCompositeOperation = 'source-over'; // Reset
  
  console.log('Canvas size:', canvas2d.width, 'x', canvas2d.height);
}
```

## 🎹 Interactive Audio Demo

Press keys to play different notes!

```js
let notes = {
  'a': 261.63, // C4
  's': 293.66, // D4
  'd': 329.63, // E4
  'f': 349.23, // F4
  'g': 392.00, // G4
  'h': 440.00, // A4
  'j': 493.88, // B4
  'k': 523.25  // C5
};

let activeOscillators = {};
```

```js on:input
// Access scope variables explicitly
const notes = scope.notes;
const activeOscillators = scope.activeOscillators;

if (event.type === 'keydown') {
  const note = notes[event.key];
  
  if (note && !activeOscillators[event.key]) {
    // Create oscillator and envelope
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    
    osc.frequency.value = note;
    gain.gain.setValueAtTime(0, audio.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audio.currentTime + 0.01); // Attack
    
    osc.connect(gain);
    gain.connect(audio.destination);
    
    osc.start();
    activeOscillators[event.key] = { osc, gain };
    
    console.log('🎵 Playing note:', note, 'Hz');
  }
}

if (event.type === 'keyup') {
  const activeNote = activeOscillators[event.key];
  
  if (activeNote) {
    // Release envelope
    const { osc, gain } = activeNote;
    const now = audio.currentTime;
    
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.1); // Release
    
    osc.stop(now + 0.1);
    delete activeOscillators[event.key];
  }
}
```

## 🎮 WebGL & WebGPU

### Check WebGL Availability

```js on:init
if (webgl.available) {
  console.log('✓ WebGL is available!');
  const gl = webgl.context;
  if (gl) {
    console.log('  Version:', gl.getParameter(gl.VERSION));
    console.log('  Vendor:', gl.getParameter(gl.VENDOR));
    console.log('  Renderer:', gl.getParameter(gl.RENDERER));
  }
} else {
  console.log('✗ WebGL is not available');
}
```

### Initialize WebGPU (if available)

```js on:init
// WebGPU requires async initialization
async function setupWebGPU() {
  if (await webgpu.init()) {
    console.log('✓ WebGPU initialized successfully!');
    
    const device = webgpu.device;
    if (device) {
      console.log('  Device:', device);
      console.log('  Features:', Array.from(device.features));
      console.log('  Limits:', device.limits);
      
      // Create a simple buffer with safety limits
      const buffer = webgpu.createBuffer(1024, webgpu.GPUBufferUsage.UNIFORM);
      if (buffer) {
        console.log('  ✓ Created 1KB uniform buffer');
      }
    }
  } else {
    console.log('✗ WebGPU not available or initialization failed');
  }
}

setupWebGPU().catch(err => console.error('WebGPU setup error:', err));
```

## 📊 Terminal Display

```js on:render
term.clear();

// Display API status
term.write(2, 2, '=== Native Browser APIs ===', 0x00ff88ff);
term.write(2, 4, 'Audio:   Web Audio API Ready', 0xffffffff);
term.write(2, 5, `  State: ${audio.state}`, 0xaaaaaaff);
term.write(2, 6, `  Rate:  ${audio.sampleRate} Hz`, 0xaaaaaaff);

term.write(2, 8, 'Canvas:  Canvas 2D Ready', 0xffffffff);
term.write(2, 9, `  Size:  ${canvas2d.width}x${canvas2d.height}`, 0xaaaaaaff);

term.write(2, 11, 'WebGL:   ' + (webgl.available ? 'Available' : 'Not Available'), 
  webgl.available ? 0x00ff00ff : 0xff0000ff);

term.write(2, 12, 'WebGPU:  ' + (webgpu.available ? 'Ready' : 'Not Initialized'), 
  webgpu.available ? 0x00ff00ff : 0xffff00ff);

// Instructions
term.write(2, 15, 'Press A-S-D-F-G-H-J-K for musical notes', 0xff8800ff);
term.write(2, 16, 'Watch the Canvas 2D animation above!', 0xff8800ff);

// Frame counter
term.write(2, 18, `Frame: ${getFrame()}`, 0x888888ff);
