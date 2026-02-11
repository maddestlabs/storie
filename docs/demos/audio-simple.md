# 🎵 Simple Audio Demo

A minimal example showing Web Audio API integration.

## Press SPACE to play a sound

```js
// State for audio demo
let isPlaying = false;
```

```js on:init
console.log('🎵 Audio demo ready!');
console.log('Audio Context state:', audio.state);
console.log('Sample rate:', audio.sampleRate);
```

```js on:update
// Press SPACE to play a tone
if (key.pressed(key.SPACE)) {
  // Simple helper - plays a beep
  audio.playTone(440, 0.2, 0.3);
  isPlaying = true;
  
  setTimeout(() => { isPlaying = false; }, 200);
}

// Arrow keys play different notes
if (key.pressed(key.ARROW_UP)) {
  audio.playTone(523.25, 0.15, 0.2); // C5
}
if (key.pressed(key.ARROW_DOWN)) {
  audio.playTone(261.63, 0.15, 0.2); // C4
}
if (key.pressed(key.ARROW_LEFT)) {
  audio.playTone(329.63, 0.15, 0.2); // E4
}
if (key.pressed(key.ARROW_RIGHT)) {
  audio.playTone(392.00, 0.15, 0.2); // G4
}
```

```js on:render
term.clear();

// Title
term.write(2, 2, '=== Web Audio API Demo ===', 0x00ff88ff);

// Instructions
term.write(2, 4, 'Press SPACE to play a tone', 0xffffffff);
term.write(2, 5, 'Use arrow keys for notes', 0xaaaaaaff);

// Status
if (isPlaying) {
  term.write(2, 7, '♪ PLAYING ♪', 0xff00ffff);
}

// Info
term.write(2, 10, `Audio Context: ${audio.state}`, 0x888888ff);
term.write(2, 11, `Sample Rate: ${audio.sampleRate} Hz`, 0x888888ff);
term.write(2, 12, `Current Time: ${audio.currentTime.toFixed(2)}s`, 0x888888ff);

// Advanced example
term.write(2, 15, '--- Advanced Usage ---', 0xffff00ff);
term.write(2, 16, 'Type 1 for FM synthesis', 0xaaaaaaff);

// Frame
term.write(2, termHeight - 2, `Frame: ${getFrame()}`, 0x444444ff);
```

```js on:input
// Advanced: FM synthesis on key '1'
if (event.type === 'keydown' && event.key === '1') {
  // Create a carrier oscillator
  const carrier = audio.createOscillator();
  const modulator = audio.createOscillator();
  const modGain = audio.createGain();
  const outputGain = audio.createGain();
  
  // FM synthesis setup
  carrier.frequency.value = 440;
  modulator.frequency.value = 220;
  modGain.gain.value = 100; // Modulation depth
  outputGain.gain.value = 0.3;
  
  // Connect the graph
  modulator.connect(modGain);
  modGain.connect(carrier.frequency);
  carrier.connect(outputGain);
  outputGain.connect(audio.destination);
  
  // Envelope
  const now = audio.currentTime;
  outputGain.gain.setValueAtTime(0, now);
  outputGain.gain.linearRampToValueAtTime(0.3, now + 0.01);
  outputGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
  
  // Start and stop
  carrier.start(now);
  modulator.start(now);
  carrier.stop(now + 0.5);
  modulator.stop(now + 0.5);
  
  console.log('🎹 FM synthesis!');
}
```

## How It Works

The **shared instance pattern** means:

1. **One AudioContext** - Created once by the engine
2. **Helpers use it** - `audio.playTone()` uses the same context
3. **Direct access** - `audio.context` is the real AudioContext
4. **Mix freely** - Use helpers and raw API together

```javascript
// Helper (simple)
audio.playTone(440, 1.0);

// Raw API (advanced) - SAME AudioContext!
const osc = audio.createOscillator();
osc.connect(audio.destination);
osc.start();
```

**Zero overhead. Full power. Same instance.** ✨
