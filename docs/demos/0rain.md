---
name: "0RAIN"
theme: "zerorain"
requiresAudioGesture: true
width: 1080
height: 2400
shaders: "bloom+zerorain+zerocrt"
font: "AnomalyMono"
fontsize: 28
---

# 0RAIN {"x": "0", "y": "0", "render": "content"}

- [Play](#play)
- [Random Seed](action:randomize-seed)
- [Settings](action:open-settings)

Read the backstory.
- [Intro](#awake)

```js on:enter
if (typeof worlds.currentSection === 'number') {
  g.titleSectionIndex = worlds.currentSection;
}
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# H3R {"x": "-5", "y": "-58", "rotate-z": "270", "scale": "8", "opacity": "0.8", "interactive": "false", "render": "content"}
0RAIN

# Awake

You wake gasping.

A voice, feminine and singing, calls from impossible distance. In the dream, a city of rain and light beckons you. But the [Meridian](action:lore-meridian) groans around you, dying. Metal cooling. Fluids dripping.

Kess moves through darkness checking heads. Five crew. Everyone breathing. Not everyone whole.

The dream lingers. The voice lingers.

- [What's our status?](#assess-damage)
- [Where are we?](#question-location)
- [Exit](#0RAIN)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Assess Damage

The crash site is a tomb. Twisted corridors. Broken systems. In the engine room, Dax sits against a bulkhead, holding his ribs. Something is cracked inside him.

"I'll live," he mutters.

The engines are scrap. Fuel cells ruptured. No beacon. No rescue signal. The [Meridian](action:lore-meridian) will not fly again. At the navigation console, one file survives the corruption: coordinates labeled simply **HER**.

- [Plan with Kess](#plan-with-kess)
- [Exit](#0RAIN)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Question Location

You pull Kess aside. Her expression darkens.

"The trajectory was wrong. Navigation got hijacked or the charts were compromised." She glances at the wasteland. "Resistance channels used to mention a place called Her. A megacity where they test control systems."

She meets your eyes. "We need to be very careful."

- [Prepare to move](#plan-with-kess)
- [Back to intro](#intro)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Meridian

The *Meridian* was a resistance courier refitted from an aging transport hull, more endurance than elegance. It carried people, contraband, and messages through routes the system preferred to pretend were impossible.

Its crew knew every rattle in the frame. Kess trusted it because it was ugly, overused, and repairable. That made it honest. In another life it moved medicine and evacuees between quiet cells beyond the system's approved maps.

Now the ship is a carcass cooling in the rain, but to the survivors it still means one thing: there is no route home except the one they make themselves.

- [Back](action:history-back)

# Plan with Kess

Kess is moving through the main cabin distributing rations. Her face is stone cold.

"Enough for a week if we're strict. There's a city marked here. Four, maybe five days on foot through that wasteland out there."

She points to the viewport. Concrete plains. Gray sky. Ruins stretching endlessly.

"We move at first light. Travel light. Travel quiet. This zone exists for a reason, and it's not good."

- [Head out at dawn](#day-one)
- [Exit](#0RAIN)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Day One

The first day, hope is swallowed in a desolate landscape.

Concrete plains. Dead factories. Residential blocks in various states of collapse. Everything gray. Everything silent. The system broadcasts insisted the world was cultivated, content, controlled.

You are seeing the lie. You are in the place the system pretends does not exist.

Dax struggles to keep pace. His fever is rising.

- [Continue walking](#day-two)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.1, 0.35);
```

# Day Two

By the second day, you wish you were back in the system.

The rain starts, not a downpour, just constant merciless drizzle that soaks everything and makes the ground slick. Your clothes are damp. Your skin is damp. Everything is damp.

Marta remarks quietly, "It always rains here."

Kess does not look back. "Didn't you know? It always rains in Dystopia."

- [Press on](#day-three)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.35, 0.35);
```

# Day Three

Dax is worse. His fever climbs. He moves slower. The group tightens rations. The remaining supplies from the *Meridian* dwindle faster than expected.

The landscape remains unchanging, as if you are walking in circles, as if the city is keeping you at a distance and testing your resolve before allowing you closer.

The voice from your dream whispers at the edge of awareness. Almost subliminal.

- [Keep moving](#day-four)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.45, 0.35);
```

# Day Four

On the evening of the fourth day, exhaustion settles into your bones like sediment. The rain intensifies. Your visibility drops.

Then you see it ahead.

A structure still standing. Windows intact. Power flowing to its lights. In the middle of a dead zone. With electricity. Impossible.

Kess stops the group. Her hand moves to her weapon. "No structure should have independent power out here."

- [Approach cautiously](#cautious-approach)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.55, 0.35);
```

# Cautious Approach

A neon sign flickers pink. *Laundromat.* Warm light spills through glass doors. Inside: rows of machines with clothes strewn about. The mundane infrastructure of ordinary life in a dead world.

The surrounding buildings are hollowed. Windows are empty sockets. Doors hang at wrong angles. The system erases inconvenient zones and inconvenient people. This building is a ghost of what was, but it still lives.

Kess scans the interior carefully before signaling you forward.

- [Enter the laundromat](#inside-laundromat)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.5, 0.35);
```

# Inside Laundromat

Inside: warmth. Dry air. Humming machines cycling through their routines. No people visible. No signs of recent habitation.

On a bench: a journal. Sketches. Maps of the city. Observations about *the Voice*. Warnings about towers. References to *Station V*.

Dax sinks onto a bench, fever making him docile. The warmth helps. Kess photographs pages carefully with an old camera, nothing digital that could be traced.

Behind the machines, you notice a door marked *Maintenance*.

- [Check the back room](#maintenance-room)
- [Rest here with the others](#rest-here)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.15, 0.35);
```

# Maintenance Room

Behind the door: a small room. At its center, a power conduit. Jury-rigged but functional. It runs from somewhere buried beneath the laundromat, splitting into multiple directions.

This power source should not exist. The government controls all infrastructure. But this is independent. Defiant. Someone maintains this space. Someone wants this laundromat alive.

Kess examines it with a grim expression. "Resistance. Or fragments of it. A network keeping safe spaces alive in the dead zones."

- [Return to the main room](#rest-here)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Rest Here

Kess gathers the crew. "Two hours rest. Then we move toward the city."

You find yourself staring at the washing machines. Their rhythm is hypnotic. Almost meditative. Then the voice comes, not external, but inside your head.

*You are safe here. You are valued. You are home.*

For a moment, you believe it absolutely. Then Kess grabs your shoulder, snapping you back to reality. She is terrified.

"Whatever's in that city, it's reaching out. The Voice is here. We need to move. Now."

- [Head toward the city](#city-approach)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.9, 0.35);
```

# City Approach

The transition from wasteland to civilization is gradual, then sudden. Abandoned buildings become maintained structures. Power lines multiply. The rain intensifies.

Then you see it.

Brutalist towers of concrete and dark glass rise from rain-soaked earth. Some towers disappear into cloud cover. Impossible architecture. Overwhelming presence.

Beneath it all, that voice again. Louder now. Broadcast outward but also seemingly in your skull.

*You are valued. You are appreciated.*

- [Enter the city](#city-entrance)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.7, 0.35);
```

# City Entrance

People move through the streets with purpose but without energy. Everyone has the implant, visible port behind their left ear. Everyone is listening to something invisible.

You pass a monolithic building. Sign reads: *Human Resource Center - Daily Affirmation Sessions 9AM to 8PM.* Through windows: people in meditation posture, eyes closed, faces peaceful.

The Voice speaks directly into their skulls. It tells them they are valued, safe, loved. Lies they desperately want to believe.

Your crew is conspicuous. Wrong clothes. Wrong bearing. Implants without proper status markers.

- [Find Kess's contact](#find-contact)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.6, 0.35);
```

# Find Contact

Kess leads through back streets. Her movements are practiced. She has been here before. The contact is in what she calls the *Marginal Zones*, areas that exist but are not officially listed.

A ground-floor apartment. An unmarked door. Kess knocks.

When it opens: an old man. Sharp eyes. Intelligence burning behind them. Something like defiance in his posture.

"Kess," he says, and smiles. "It's been a long time."

"Marcus," Kess responds. "We need shelter. Answers."

- [Listen to Marcus](#marcus-begins)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.05, 0.35);
```

# Marcus Begins

His apartment is crammed with contraband. Physical books. Pre-government recordings. Photographs of a city that was different. Alive.

Marcus moves among his collection like a priest tending a shrine.

"I remember when this city was alive," he says quietly. "Before the Voice. Before the government. Artists. Musicians. People who made things for joy. Real joy, not the artificial kind the Voice provides."

He turns to face you directly.

- [Ask about the Voice](#ask-voice)
- [Ask about Station V](#ask-station)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.95, 0.35);
```

# Ask Voice

"The government came slowly at first," Marcus explains. "Public safety programs. Social optimization. Mental health support. Everyone was tired. Ready to let someone else decide."

He pauses.

"Then the implants. Just communication devices, they said. But it was access. Access to the part of your mind that decides what you want. Who you are. The Voice tells you good things. Makes you feel loved. But it also tells you not to remember. Not to ask questions."

- [Ask about Station V](#ask-station)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.85, 0.35);
```

# Ask Station

"Station V," Marcus says grimly. "The central system. Where the Voice originates. Where the control algorithms run. If you want to survive, if you want to do anything, you need to understand Station V."

He moves to a hidden panel. Pulls it back. A terminal glows faintly. Offline. Not connected.

"Station V is sealed. Protected. Guarded. In the highest tower. The one that reaches beyond the rain."

Then: sirens. Distant, but growing closer.

- [Hide or flee?](#sirens-approach)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

# Sirens Approach

The sirens stop suddenly. Worse than when they were wailing. Silence is more ominous than noise.

Marcus does not flinch. His hand moves toward a concealed compartment.

"There's a way out. Through the maintenance tunnels beneath the city. They connect to the utility core. Station V is accessible from there. But you have to go now."

He hands you a data drive. "Maps. Schematics. Everything I could gather."

A soft knock at the door. Polite. Terrifying in its politeness.

- [Flee through the tunnels](#maintenance-tunnels)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.8, 0.35);
```

# Maintenance Tunnels

The tunnels are dark. Older than the city above. Remnants of something else. Repurposed and adapted for modern systems.

Marcus moves with practiced ease. He knows these paths well. Has used them before. Many times.

"Station V is at the apex of the utility core," he explains quietly. "The government sealed the main entrances, but they cannot seal the service conduits without disrupting the system. These tunnels connect to them."

The air grows cooler. You hear water in pipes. Machinery humming. Vast systems performing their functions.

- [Continue through the tunnels](#deep-tunnels)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.7, 0.35);
```

# Deep Tunnels

After what feels like hours, you reach a grate. Through it: a massive space. Equipment humming with power and purpose.

The core systems. The heart of the city.

Marcus stops. His expression is heavy with meaning.

"This is as far as I can take you. What happens next is your choice. But understand: if you destroy Station V, you destroy the Voice holding this entire city. What happens after, no one knows."

- [Enter the core](#enter-core)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.6, 0.35);
```

# Enter Core

Inside: terrible order. Glass chambers everywhere. Hundreds of them in geometric patterns. Inside each chamber: neural monitoring systems, signal amplifiers, and data storage so dense it hums with barely contained power.

Kess runs diagnostics through an old device. Her expression darkens with each result.

"The Voice is not centralized," she whispers. "It's distributed. Every chamber is a relay. Every piece of equipment is networked. Destroying one does nothing. We need the center."

Then: a voice.

"There is a center."

- [Who's speaking?](#who-speaks)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.55, 0.35);
```

# Who Speaks

A figure emerges from the shadows. Tall. Dark clothed. Face hidden.

Your hand moves to your weapon. Government agent, you think.

The figure removes their hood.

The face is scarred. Badly. Burned. Healed wrong. But the eyes are human, intelligent, and filled with something you cannot name yet.

"Station V," the figure says. "Central processing. Destroy that, the network becomes inert. The Voice goes silent."

- [Trust this figure](#trust-figure)
- [Demand answers](#trust-figure)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.5, 0.35);
```

# Trust Figure

"I'm Del," the figure says. "Former city engineer. Before the government. Before the Voice. I built this place when it was supposed to be a city of innovation. A free city in a controlled world."

Del moves through the chamber network with practiced ease.

"The government saw it as a test bed. A perfect place to experiment with control systems before rolling them out everywhere. Station V is at the apex. It's not just processing. It's administration."

Del stops at a checkpoint.

"Someone's in charge up there. Someone who volunteered for it."

- [Ask about the administrator](#ask-administrator)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.45, 0.35);
```

# Ask Administrator

"A woman named Aria," Del says. "Former mayor. Before mayors were elected by Voice consensus. She volunteered for the position. The Voice offered her something. Power. Certainty. Purpose."

Del moves forward through the checkpoints. They open for them as if expected.

"She took it, and it took her. Now she's more linked to the system than human. Neural integration is almost complete. Her consciousness is distributed across the entire city."

Ahead: a lift. Massive. Glass. Reaching upward into darkness.

"This is it," Del says. "The lift to Station V."

- [Enter the lift](#lift-up)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.4, 0.35);
```

# Lift Up

The lift is massive. Reinforced glass. Designed to intimidate. Designed to remind you that you are ascending toward something vast and powerful.

As the lift rises, the city falls away beneath you. Rain-soaked streets become patterns. Buildings become geography. People become statistics. Higher. Higher. Endlessly higher.

And as you rise, the Voice gets louder.

*You are valued. You are home. You are part of something greater.*

It is harder to resist here. For a moment, you almost want to believe.

Then the lift stops.

- [Enter Station V](#station-v-enter)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.35, 0.35);
```

# Station V Enter

Silence. Not quiet. Silence. The absence of sound.

But beneath it you feel the Voice, not heard but felt, resonating through bone, structure, architecture.

At the center of the chamber, suspended in neural interfaces, is a figure.

Her name is Aria.

She was beautiful once. The bone structure shows it. But the machinery is extensive. Neural ports across her skull. Sensory deprivation suit wired with thousands of connections. Her eyes are closed. Atrophied.

She is the Voice.

- [Examine the systems](#aria-awakens)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.3, 0.35);
```

# Aria Awakens

The sound comes first. Not loud. Barely a whisper. But in the silence it is catastrophic.

Aria's eyes snap open.

She screams.

It is not a human scream. It is the sound of a system overloading, of something too vast and too networked to remain human experiencing pain in every direction simultaneously.

The whole city convulses with her agony.

"Run," Del shouts.

- [Flee into the aftermath](#aftermath)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 0.95, 0.35);
```

# Aftermath

You run through endless chambers, through corridors that multiply. Behind you: sounds, movement, something broken and vast moving through the darkness.

You emerge into another ruined cityscape. Another wasteland. But this one feels different. Alive with possibility.

Station V still hums above you, but the signal is weaker now. Fractured. Damaged beyond immediate repair. You have broken something fundamental.

Rain falls. Or maybe it never stopped.

Then one of you notices movement in the rubble. Small. Quick. A dog. Alive. Free. Darting through the rain toward a faint light in the distance.

Kess looks at you. Something flickers across her face. Not hope exactly. But conviction. Possibility.

- [Exit](#0RAIN)

```js on:enter
setRainLevel(RAIN_IDLE_GAIN * 1.2, 0.35);
```

# Play

```ascii
 █████  ████     █    ███    █   █
 ▒  ▒▒  ▒   ▒   ▒ ▒     ▒    ▒▒  ▒
 ▒ ▒ ▒  ▒  ▒   ▒   ▒    ▒    ▒ ▒ ▒
 ░░  ░  ░  ░   ░   ░    ░    ░  ░░
 ░░░░░  ░   ░  ░   ░  ░░░░░  ░   ░
```

```js on:enter
if (typeof worlds.currentSection === 'number') {
  g.playSectionIndex = worlds.currentSection;
}
if (g.gameMode === 'play') restartGame();
else startGame();
startBackgroundMusicFromTop();
setRainLevel(g.gameMode === 'play' ? RAIN_PLAY_GAIN : RAIN_IDLE_GAIN, 0.35);
```

# Settings

To play, clear digits by:
Pressing 0|1 or tapping LEFT|RIGHT

Theme:
:gui{type:slider,id:settings-theme-slider,min:0,max:0,value:0,step:1,showValue:false,width:100%,align:center,scale:worlds}

Status: :gui{type:label,id:settings-audio-state,text:"Audio: On",width:36%,align:left,scale:worlds}

- [Audio on](action:audio-on)
- [Audio off](action:audio-off)
- [Back](action:history-back)

```js on:enter
if (typeof worlds.currentSection === 'number') {
  g.settingsSectionIndex = worlds.currentSection;
}
syncSettingsWorldWidgets();
setRainLevel(RAIN_IDLE_GAIN, 0.35);
```

```js
// ── Constants (module-level, safe to re-declare as var) ───────────────────
var STRAIN_MIN  = 3;
var STRAIN_MAX  = 6;
var SPEED_MIN   = 1.4;
var SPEED_MAX   = 3.2;
var MAX_STRAINS = 30;
var DESTROY_DUR = 0.55;
var RAIN_PLAY_GAIN = 0.11;
var RAIN_IDLE_GAIN = 0.06;
var RAIN_DROP_MIN_GAP = 0.085;
var RAIN_DROP_MAX_GAP = 0.16;
var WORLDS_SECTION_FIT = 3.0;
var WORLDS_CARD_WIDTH = 500;
var WORLDS_CARD_HEIGHT = 1960;
var GUI_GROUP_HUD = 1;
var GUI_GROUP_KEYPAD = 2;
var SEED_MAX_DIGITS = 12;
var SETTINGS_THEME_SLIDER_ID = 'settings-theme-slider';
var SETTINGS_AUDIO_LABEL_ID = 'settings-audio-state';
var NAV_HISTORY_MAX = 24;
var BGM_AUDIO_URL = 'assets/audio/01-dreams-of-her.ogg';
var BGM_VOLUME = 0.34;

var guiWidgets = null;

var g = {
    gameMode: 'start',
    score:    0,
    seed:     random.seed(),
    rng:      null,
  urlSeed:  null,
  firstStartPending: true,
  strains:  [],
  bgDrops:  [],
  rain:     null,
  gameSfx:  {},
  lastDropSfxAt: -999,
  nextDropSfxGap: 0.11,
  audioEnabled: true,
  audioUnlocked: false,
  audioUnlockPending: false,
  bgmBuffer: null,
  bgmLoadPromise: null,
  bgmSource: null,
  bgmStartToken: 0,
  guiMouseDown: false,
  titleSectionIndex: null,
  playSectionIndex: null,
  settingsSectionIndex: null,
  navBackStack: [],
  navForwardStack: [],
  themeNames: [],
  themeIndex: 0,
  themeName: 'zerorain',
  playSectionHidden: false
  };

// ── PRNG helpers (take the raw ()=>number from random.rng) ────────────────
function rInt(r, min, max)   { return Math.floor(r() * (max - min + 1)) + min; }
function rFloat(r, min, max) { return r() * (max - min) + min; }
function chR(c) { return (c >>> 24) & 255; }
function chG(c) { return (c >>> 16) & 255; }
function chB(c) { return (c >>>  8) & 255; }
function mixColor(a, b, t) {
  var r = Math.round(chR(a) + (chR(b) - chR(a)) * t);
  var g = Math.round(chG(a) + (chG(b) - chG(a)) * t);
  var bl = Math.round(chB(a) + (chB(b) - chB(a)) * t);
  return ui.colors.rgb(r, g, bl);
}
function alphaColor(c, a01) {
  var a = Math.max(0, Math.min(255, Math.round(a01 * 255)));
  return ui.colors.rgba(chR(c), chG(c), chB(c), a);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isPlaySectionCurrent() {
  return !!(
    worlds &&
    typeof g.playSectionIndex === 'number' &&
    worlds.currentSection === g.playSectionIndex
  );
}

function ensureBackgroundMusicBuffer() {
  if (g.bgmBuffer) return Promise.resolve(g.bgmBuffer);
  if (g.bgmLoadPromise) return g.bgmLoadPromise;

  g.bgmLoadPromise = audio.loadSound(BGM_AUDIO_URL).then(function (buffer) {
    g.bgmLoadPromise = null;
    if (buffer) g.bgmBuffer = buffer;
    return buffer || null;
  }).catch(function () {
    g.bgmLoadPromise = null;
    return null;
  });

  return g.bgmLoadPromise;
}

function stopBackgroundMusic() {
  g.bgmStartToken++;
  var source = g.bgmSource;
  g.bgmSource = null;
  if (!source) return;
  source.onended = null;
  try { source.stop(); } catch (e) {}
}

function startBackgroundMusicFromTop() {
  if (!g.audioEnabled || !isPlaySectionCurrent()) return;

  stopBackgroundMusic();
  var startToken = g.bgmStartToken;
  audio.context.resume().catch(function () {});

  ensureBackgroundMusicBuffer().then(function (buffer) {
    if (!buffer) return;
    if (startToken !== g.bgmStartToken) return;
    if (!g.audioEnabled || !isPlaySectionCurrent()) return;

    var source = audio.playBuffer(buffer, {
      loop: true,
      volume: BGM_VOLUME
    });

    if (startToken !== g.bgmStartToken) {
      try { source.stop(); } catch (e) {}
      return;
    }

    g.bgmSource = source;
    source.onended = function () {
      if (g.bgmSource === source) g.bgmSource = null;
    };
  }).catch(function () {});
}

function syncBackgroundMusic() {
  if (!g.audioEnabled || !isPlaySectionCurrent()) {
    if (g.bgmSource) stopBackgroundMusic();
  }
}

function setAudioEnabled(enabled) {
  g.audioEnabled = !!enabled;
  if (!g.audioEnabled) {
    for (var name in g.gameSfx) stopGameSfx(name);
    stopBackgroundMusic();
  } else if (isPlaySectionCurrent()) {
    startBackgroundMusicFromTop();
  }
  setRainLevel(g.audioEnabled ? (g.gameMode === 'play' ? RAIN_PLAY_GAIN : RAIN_IDLE_GAIN) : 0, 0.25);
}

function randomizeSeed() {
  g.seed = random.seed();
  g.rng = random.rng(g.seed);
}

function normalizeSeedText(value) {
  return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, SEED_MAX_DIGITS);
}

function applyManualSeed(value) {
  var normalized = normalizeSeedText(value);
  if (guiWidgets && guiWidgets.seedInput && guiWidgets.seedInput.getValue() !== normalized) {
    guiWidgets.seedInput.setValue(normalized);
  }
  if (!normalized.length) return;

  var nextSeed = Math.floor(Number(normalized));
  if (!isFinite(nextSeed) || nextSeed === g.seed) return;

  g.seed = nextSeed;
  g.rng = random.rng(g.seed);
}

function insertSeedDigitAtCursor(digit) {
  if (!isSeedInputFocused() || !guiWidgets || !guiWidgets.seedInput) return false;
  var current = String(guiWidgets.seedInput.getValue() || '');
  if (current.length >= SEED_MAX_DIGITS) return false;
  if (typeof guiWidgets.seedInput.handleText !== 'function') return false;
  return !!guiWidgets.seedInput.handleText(String(digit));
}

function backspaceSeedAtCursor() {
  if (!isSeedInputFocused() || !guiWidgets || !guiWidgets.seedInput) return false;
  if (typeof guiWidgets.seedInput.handleKey !== 'function') return false;
  return !!guiWidgets.seedInput.handleKey('Backspace');
}

function replaceSeedText(value) {
  if (!guiWidgets || !guiWidgets.seedInput) return;
  var normalized = normalizeSeedText(value);
  guiWidgets.seedInput.setValue(normalized);
  applyManualSeed(normalized);
}

function applySeedKeypadAction(action, value) {
  if (action === 'digit') {
    insertSeedDigitAtCursor(value);
    return;
  }
  if (action === 'backspace') {
    backspaceSeedAtCursor();
    return;
  }
  if (action === 'clear') {
    replaceSeedText('');
    return;
  }
  if (action === 'randomize') {
    randomizeSeed();
    replaceSeedText(String(g.seed));
    return;
  }
  if (action === 'copy') {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') return;
    void navigator.clipboard.writeText(String(guiWidgets && guiWidgets.seedInput ? guiWidgets.seedInput.getValue() : g.seed)).catch(function () {});
    return;
  }
  if (action === 'paste') {
    if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.readText !== 'function') return;
    void navigator.clipboard.readText().then(function (text) {
      var normalized = normalizeSeedText(text);
      if (!normalized.length) return;
      if (isSeedInputFocused() && guiWidgets && guiWidgets.seedInput && typeof guiWidgets.seedInput.handleText === 'function') {
        guiWidgets.seedInput.handleText(normalized);
      } else {
        replaceSeedText(normalized);
      }
    }).catch(function () {});
    return;
  }
  if (action === 'done') {
    clearSeedInputFocus();
  }
}

function isSeedInputFocused() {
  return !!(
    guiWidgets &&
    guiWidgets.seedInput &&
    guiWidgets.seedInput.state.visible &&
    guiWidgets.seedInput.state.enabled &&
    guiWidgets.seedInput.state.focused
  );
}

function clearSeedInputFocus() {
  if (!isSeedInputFocused()) return;
  if (gui && typeof gui.clearFocus === 'function') gui.clearFocus();
}

function isSeedInputPointerEvent(event) {
  if (!event || !guiWidgets || !guiWidgets.seedInput || typeof guiWidgets.seedInput.containsPoint !== 'function') {
    return false;
  }
  if (typeof event.x !== 'number' || typeof event.y !== 'number') return false;
  return guiWidgets.seedInput.containsPoint({ x: event.x, y: event.y });
}

function isSeedKeypadPointerEvent(event) {
  if (!event || !guiWidgets || !guiWidgets.keypadButtons) return false;
  if (typeof event.x !== 'number' || typeof event.y !== 'number') return false;
  for (var i = 0; i < guiWidgets.keypadButtons.length; i++) {
    var button = guiWidgets.keypadButtons[i].button;
    if (button && typeof button.containsPoint === 'function' && button.containsPoint({ x: event.x, y: event.y })) {
      return true;
    }
  }
  return false;
}

function isSeedEditorPointerEvent(event) {
  return isSeedInputPointerEvent(event) || isSeedKeypadPointerEvent(event);
}

function shouldKeepSeedFocusOnKey(key) {
  if (!key) return false;
  if ((key >= '0' && key <= '9') || key === 'Numpad0' || key === 'Numpad1' || key === 'Numpad2' || key === 'Numpad3' || key === 'Numpad4' || key === 'Numpad5' || key === 'Numpad6' || key === 'Numpad7' || key === 'Numpad8' || key === 'Numpad9') {
    return true;
  }
  return key === 'Backspace' || key === 'Delete' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
}

function shouldKeepSeedFocusOnText(text) {
  return typeof text === 'string' && /^\d+$/.test(text);
}

function rememberSectionForBack(sectionIndex) {
  if (typeof sectionIndex !== 'number') return;
  var stack = g.navBackStack;
  var last = stack.length ? stack[stack.length - 1] : null;
  if (last === sectionIndex) return;
  stack.push(sectionIndex);
  if (stack.length > NAV_HISTORY_MAX) stack.splice(0, stack.length - NAV_HISTORY_MAX);
}

function rememberSectionForForward(sectionIndex) {
  if (typeof sectionIndex !== 'number') return;
  var stack = g.navForwardStack;
  var last = stack.length ? stack[stack.length - 1] : null;
  if (last === sectionIndex) return;
  stack.push(sectionIndex);
  if (stack.length > NAV_HISTORY_MAX) stack.splice(0, stack.length - NAV_HISTORY_MAX);
}

function clearForwardHistory() {
  if (g.navForwardStack.length) g.navForwardStack.length = 0;
}

function navigateToSectionWithHistory(target, fromSectionIndex) {
  rememberSectionForBack(fromSectionIndex);
  clearForwardHistory();
  focusWorldSection(target);
}

function getNavigationSourceSection(activated) {
  if (activated && typeof activated.sectionIndex === 'number') return activated.sectionIndex;
  if (worlds && typeof worlds.currentSection === 'number') return worlds.currentSection;
  return null;
}

function goBackInHistory(fallbackTarget) {
  if (!g.navBackStack.length) {
    if (fallbackTarget) focusWorldSection(fallbackTarget);
    return false;
  }

  var currentSection = worlds && typeof worlds.currentSection === 'number' ? worlds.currentSection : null;
  var previousSection = g.navBackStack.pop();
  if (typeof currentSection === 'number') rememberSectionForForward(currentSection);
  focusWorldSection(previousSection);
  return true;
}

function openSettings(fromSectionIndex) {
  navigateToSectionWithHistory('Settings', fromSectionIndex);
}

function openMeridianLore(fromSectionIndex) {
  navigateToSectionWithHistory('Meridian', fromSectionIndex);
}

function handleWorldLinkActions() {
  if (!worlds || !worlds.links || !worlds.links.popActivated) return;

  for (;;) {
    var activated = worlds.links.popActivated();
    if (!activated) break;

    var sourceSectionIndex = getNavigationSourceSection(activated);

    if (activated.url === 'action:open-settings') {
      openSettings(sourceSectionIndex);
      continue;
    }

    if (activated.url === 'action:lore-meridian') {
      openMeridianLore(sourceSectionIndex);
      continue;
    }

    if (activated.url === 'action:history-back') {
      goBackInHistory('0RAIN');
      continue;
    }

    if (activated.url === 'action:randomize-seed') {
      randomizeSeed();
      continue;
    }

    if (activated.url === 'action:audio-on') {
      setAudioEnabled(true);
      continue;
    }

    if (activated.url === 'action:audio-off') {
      setAudioEnabled(false);
      continue;
    }

    if (activated.url === 'action:toggle-audio') {
      setAudioEnabled(!g.audioEnabled);
    }
  }
}

function focusWorldSection(title) {
  if (!worlds || !worlds.camera || !worlds.camera.focusOnSectionFit) return;
  worlds.camera.focusOnSectionFit(title, WORLDS_SECTION_FIT, { keepRotation: true });
}

function syncPlaySectionVisibility() {
  if (typeof g.playSectionIndex !== 'number') return;

  var shouldHide = worlds.currentSection === g.playSectionIndex;
  if (g.playSectionHidden === shouldHide) return;

  worlds.setSectionVisible(g.playSectionIndex, !shouldHide);
  g.playSectionHidden = shouldHide;
}

function getSettingsWidgetSectionRef() {
  return typeof g.settingsSectionIndex === 'number' ? g.settingsSectionIndex : 'Settings';
}

function syncSettingsWorldWidgets() {
  if (!worlds || !worlds.widgets || typeof worlds.widgets.setValue !== 'function') return;

  ensureThemeSelectorState();
  var sectionRef = getSettingsWidgetSectionRef();
  if (typeof worlds.widgets.configure === 'function') {
    var sliderColor = getStyle('info').fg;
    worlds.widgets.configure(SETTINGS_THEME_SLIDER_ID, {
      label: '',
      min: 0,
      max: Math.max(0, g.themeNames.length - 1),
      step: 1,
      showValue: false,
      trackColor: alphaColor(sliderColor, 0.5)
    }, sectionRef);
  }
  worlds.widgets.setValue(SETTINGS_THEME_SLIDER_ID, g.themeIndex, sectionRef);
  worlds.widgets.setValue(SETTINGS_AUDIO_LABEL_ID, 'Audio: ' + (g.audioEnabled ? 'On' : 'Off'), sectionRef);
}

function handleSettingsWorldWidgetEvents() {
  if (!worlds || !worlds.widgets || typeof worlds.widgets.popEvent !== 'function') return;

  for (;;) {
    var widgetEvent = worlds.widgets.popEvent();
    if (!widgetEvent) break;

    if (widgetEvent.id === SETTINGS_THEME_SLIDER_ID && widgetEvent.action === 'change' && typeof widgetEvent.value === 'number') {
      applyThemeIndex(widgetEvent.value);
    }
  }
}

function ensureThemeSelectorState() {
  var names = [];
  if (typeof themes !== 'undefined' && themes && typeof themes.list === 'function') {
    names = themes.list() || [];
  }

  if (!Array.isArray(names) || names.length === 0) {
    names = ['zerorain'];
  }

  g.themeNames = names.slice();

  var currentName = g.themeName;
  if (typeof themes !== 'undefined' && themes && typeof themes.getName === 'function') {
    currentName = themes.getName() || currentName;
  }

  var index = g.themeNames.indexOf(currentName);
  if (index < 0) index = 0;

  g.themeIndex = index;
  g.themeName = g.themeNames[index];
}

function applyThemeIndex(index) {
  ensureThemeSelectorState();
  if (!g.themeNames || g.themeNames.length === 0) return;

  var nextIndex = Math.max(0, Math.min(g.themeNames.length - 1, Math.round(index)));
  var nextName = g.themeNames[nextIndex];

  if (typeof themes !== 'undefined' && themes && typeof themes.set === 'function') {
    if (!themes.set(nextName)) return;
  }

  g.themeIndex = nextIndex;
  g.themeName = nextName;
  syncSettingsWorldWidgets();
}

function unlockExperienceAudio() {
  if (g.audioUnlocked || g.audioUnlockPending || !g.audioEnabled) return;
  g.audioUnlockPending = true;
  startRainAudio().then(function (started) {
    g.audioUnlockPending = false;
    if (!started || !g.audioEnabled || audio.context.state !== 'running') return;
    g.audioUnlocked = true;
    setRainLevel(g.gameMode === 'play' ? RAIN_PLAY_GAIN : RAIN_IDLE_GAIN, 0.35);
  }).catch(function () {
    g.audioUnlockPending = false;
  });
}

function initOverlayGui() {
  gui.init({ boundsSpace: 'device' });

  var keypadSpec = [
    { label: '1', action: 'digit', value: '1' },
    { label: '2', action: 'digit', value: '2' },
    { label: '3', action: 'digit', value: '3' },
    { label: '<', action: 'backspace' },
    { label: '4', action: 'digit', value: '4' },
    { label: '5', action: 'digit', value: '5' },
    { label: '6', action: 'digit', value: '6' },
    { label: 'X', action: 'clear' },
    { label: '7', action: 'digit', value: '7' },
    { label: '8', action: 'digit', value: '8' },
    { label: '9', action: 'digit', value: '9' },
    { label: '?', action: 'randomize' },
    { label: '⧉', action: 'copy' },
    { label: '0', action: 'digit', value: '0' },
    { label: '⎘', action: 'paste' },
    { label: '↵', action: 'done' }
  ];

  guiWidgets = {
    seedCaption: gui.createLabel({
      group: GUI_GROUP_HUD,
      focusable: false,
      align: 'right',
      bounds: { x: 0, y: 0, width: 120, height: 20 },
      text: 'SEED',
      labelStyle: {
        fg: ui.colors.rgba(255, 255, 255, 255)
      }
    }),
    seedInput: gui.createTextField({
      group: GUI_GROUP_HUD,
      align: 'right',
      bounds: { x: 0, y: 0, width: 240, height: 40 },
      value: String(g.seed),
      placeholder: 'Seed',
      textFieldStyle: {
        fg: ui.colors.rgba(255, 255, 255, 170)
      }
    }),
    scoreLabel: gui.createLabel({
      group: GUI_GROUP_HUD,
      focusable: false,
      align: 'right',
      bounds: { x: 0, y: 0, width: 280, height: 40 },
      text: ''
    }),
    keypadButtons: []
  };

  for (var i = 0; i < keypadSpec.length; i++) {
    var spec = keypadSpec[i];
    var button = gui.createButton({
      group: GUI_GROUP_KEYPAD,
      focusable: false,
      bounds: { x: 0, y: 0, width: 1, height: 1 },
      label: spec.label
    });
    (function (buttonAction, buttonValue) {
      button.on('click', function () {
        applySeedKeypadAction(buttonAction, buttonValue);
      });
    })(spec.action, spec.value);
    guiWidgets.keypadButtons.push({ action: spec.action, value: spec.value, button: button });
  }

  gui.setGroupVisible(GUI_GROUP_HUD, true);
  gui.setGroupVisible(GUI_GROUP_KEYPAD, false);
}

function layoutOverlayGui() {
  if (!guiWidgets) return;

  var width = ui.metrics.canvasWidth;
  var height = ui.metrics.canvasHeight;
  var inset = Math.max(28, Math.floor(Math.min(width, height) * 0.028));
  var hudWidth = Math.min(420, Math.floor(width * 0.42));
  var hudHeight = Math.max(34, Math.floor(ui.metrics.charHeight * 1.35));
  var seedX = width - inset - hudWidth;
  var seedY = inset;
  var keypadGap = Math.max(12, Math.floor(hudHeight * 0.35));
  var keypadColumns = 4;
  var keypadButtonHeight = hudHeight;
  var keypadRowGap = Math.max(8, Math.floor(hudHeight * 0.18));
  var keypadColumnGap = keypadRowGap;
  var keypadButtonWidth = Math.max(56, Math.floor((hudWidth - keypadColumnGap * (keypadColumns - 1)) / keypadColumns));
  var keypadWidth = keypadButtonWidth * keypadColumns + keypadColumnGap * (keypadColumns - 1);
  var keypadX = Math.max(inset, seedX + hudWidth - keypadWidth);
  var keypadY = seedY + hudHeight + keypadGap;

  guiWidgets.seedCaption.setBounds({
    x: seedX - 10,
    y: seedY + fontsize,
    width: hudWidth,
    height: hudHeight
  });
  guiWidgets.seedInput.setBounds({
    x: seedX,
    y: seedY,
    width: hudWidth,
    height: hudHeight
  });
  guiWidgets.scoreLabel.setBounds({
    x: width - inset - hudWidth,
    y: height - inset - hudHeight,
    width: hudWidth,
    height: hudHeight
  });

  for (var i = 0; i < guiWidgets.keypadButtons.length; i++) {
    var keypad = guiWidgets.keypadButtons[i];
    var col = i % keypadColumns;
    var row = Math.floor(i / keypadColumns);
    keypad.button.setBounds({
      x: keypadX + col * (keypadButtonWidth + keypadColumnGap),
      y: keypadY + row * (keypadButtonHeight + keypadRowGap),
      width: keypadButtonWidth,
      height: keypadButtonHeight
    });
  }
}

function updateOverlayHud() {
  if (!guiWidgets) return;

  var onTitle = typeof g.titleSectionIndex === 'number' && worlds.currentSection === g.titleSectionIndex;
  var onSettings = typeof g.settingsSectionIndex === 'number' && worlds.currentSection === g.settingsSectionIndex;
  var canEditSeed = onTitle || onSettings;
  var seedFocused = isSeedInputFocused();
  var showKeypad = canEditSeed && seedFocused;
  guiWidgets.seedInput.setEnabled(canEditSeed);
  guiWidgets.seedCaption.setVisible(canEditSeed && !seedFocused);
  gui.setGroupVisible(GUI_GROUP_KEYPAD, showKeypad);

  if (!canEditSeed) {
    clearSeedInputFocus();
  }

  guiWidgets.seedInput.textFieldStyle.drawBorder = seedFocused;
  guiWidgets.seedInput.textFieldStyle.drawBackground = seedFocused;

  if (guiWidgets.seedInput.wasChanged()) {
    applyManualSeed(guiWidgets.seedInput.getValue());
  }

  if (!seedFocused) {
    var seedText = String(g.seed);
    if (guiWidgets.seedInput.getValue() !== seedText) {
      guiWidgets.seedInput.setValue(seedText);
    }
  }

  guiWidgets.scoreLabel.setText(g.gameMode === 'start' ? '' : String(g.score));

  ensureThemeSelectorState();
  syncSettingsWorldWidgets();
}

function getDigitColor(s, i, alpha) {
  var baseAlpha = 0.6 * alpha;
  var a = baseAlpha;
  var pulse = i === Math.floor(s.currentAnim);

  if (i > s.highlight) {
    return alphaColor(theme.fg, 0.75 * alpha);
  }

  if (i === s.strainSize - 1) {
    a += 0.2;
  }

  if (i === s.highlight) {
    return alphaColor(theme.fg, Math.max(a, 0.95 * alpha));
  }

  if (pulse) {
    return alphaColor(mixColor(theme.accent1, theme.fg, 0.45), Math.max(a, 0.7 * alpha));
  }

  return alphaColor(theme.accent1, a);
}

function bgDropTarget() {
  var area = ui.metrics.canvasWidth * ui.metrics.canvasHeight;
  return Math.max(40, Math.min(100, Math.floor(area / 12000)));
}

function makeBgDrop(r) {
  var cw = ui.metrics.charWidth;
  var ch = ui.metrics.charHeight;
  var minSize = Math.max(2, Math.floor(Math.min(cw, ch) * 0.18));
  var maxSize = Math.max(minSize + 1, Math.floor(Math.min(cw, ch) * 0.36));
  return {
    x: rFloat(r, 0, Math.max(1, ui.metrics.canvasWidth - maxSize)),
    y: rFloat(r, -ui.metrics.canvasHeight, ui.metrics.canvasHeight),
    speed: rFloat(r, 160, 420),
    size: rInt(r, minSize, maxSize),
    bright: r() < 0.22,
    alpha: rFloat(r, 0.09, 0.22)
  };
}

function syncBgDrops(r) {
  var target = bgDropTarget();
  while (g.bgDrops.length < target) g.bgDrops.push(makeBgDrop(r));
  if (g.bgDrops.length > target) g.bgDrops.length = target;
}

function resetBgDrop(d, r) {
  d.x = rFloat(r, 0, Math.max(1, ui.metrics.canvasWidth - d.size));
  d.y = -d.size - rFloat(r, 0, ui.metrics.canvasHeight * 0.35);
  d.speed = rFloat(r, 1200, 2000);
  d.bright = r() < 0.22;
  d.alpha = rFloat(r, 0.2, 0.5);
  maybePlayRainDrop(d, r);
}

function updateBgDrops(dt) {
  syncBgDrops(g.rng);
  for (var i = 0; i < g.bgDrops.length; i++) {
    var d = g.bgDrops[i];
    d.y += d.speed * dt;
    if (d.y > ui.metrics.canvasHeight + d.size) resetBgDrop(d, g.rng);
  }
}

function drawBgDrops() {
  for (var i = 0; i < g.bgDrops.length; i++) {
    var d = g.bgDrops[i];
    var c = d.bright ? mixColor(theme.fg, theme.accent3, 0.55) : mixColor(theme.fgAlt, theme.fg, 0.35);
    ui.rect(d.x, d.y, d.size, d.size + 1, alphaColor(c, d.alpha));
  }
}

// ── Object factories ───────────────────────────────────────────────────────
function makeStrain(col, r) {
  var size = rInt(r, STRAIN_MIN, STRAIN_MAX);
  var digits = [];
  for (var i = 0; i < size; i++) {
    digits.push({ value: r() < 0.5 ? '0' : '1', row: -(size - i) * ui.metrics.charHeight, drift: 0 });
  }
  return {
    col,
    digits,
    speed:        rFloat(r, SPEED_MIN, SPEED_MAX),
    strainSize:   size,
    highlight:    size - 1,
    currentAnim:  size,
    animMultiplier: rFloat(r, 4, 12),
    destroyTimer: -1,
    gameover:     false
  };
}

// ── Column picker ─────────────────────────────────────────────────────────
function findFreeCol(r) {
  var busy = new Set();
  for (var i = 0; i < g.strains.length; i++) {
    for (var d = -2; d <= 2; d++) busy.add(g.strains[i].col + d);
  }
  var free = [];
    var tw = getTermWidth();
    for (var c = 1; c < tw - 1; c++) {
    if (!busy.has(c)) free.push(c);
  }
  if (!free.length) return -1;
  return free[rInt(r, 0, free.length - 1)];
}

// ── Audio ─────────────────────────────────────────────────────────────────
function stopGameSfx(name) {
  var active = g.gameSfx[name];
  if (active && active.stop) active.stop();
  delete g.gameSfx[name];
}

function playGameSfx(name, vol) {
  if (!g.audioEnabled) return;
  stopGameSfx(name);
  g.gameSfx[name] = stfxr.play(name, undefined, { volume: vol });
}

function playGameBlobSfx(name, blobName, vol) {
  if (!g.audioEnabled) return;
  stopGameSfx(name);
  audio.context.resume().catch(function () {});

  var handle = {
    source: null,
    stopped: false,
    stop: function () {
      handle.stopped = true;
      if (handle.source) {
        try { handle.source.stop(); } catch (e) {}
      }
    }
  };

  g.gameSfx[name] = handle;

  audio.playBlob(blobName, { volume: vol }).then(function (source) {
    if (g.gameSfx[name] !== handle) {
      if (source) {
        try { source.stop(); } catch (e) {}
      }
      return;
    }

    if (!source || handle.stopped) {
      if (source && handle.stopped) {
        try { source.stop(); } catch (e) {}
      }
      delete g.gameSfx[name];
      return;
    }

    handle.source = source;
    source.onended = function () {
      if (g.gameSfx[name] === handle) delete g.gameSfx[name];
    };
  }).catch(function () {
    if (g.gameSfx[name] === handle) delete g.gameSfx[name];
  });
}

function maybePlayRainDrop(drop, r) {
  if (!g.audioEnabled) return;
  var now = audio.currentTime;
  if (now - g.lastDropSfxAt < g.nextDropSfxGap) return;

  var cw = Math.max(1, ui.metrics.charWidth || 1);
  var ch = Math.max(1, ui.metrics.charHeight || 1);
  var maxVisualSize = Math.max(1, Math.floor(Math.min(cw, ch) * 0.36));
  var sizeNorm = clamp(drop.size / maxVisualSize, 0, 1);
  var brightBonus = drop.bright ? 0.18 : 0;
  var chance = 0.12 + sizeNorm * 0.28 + brightBonus;

  if (r() > chance) return;

  var volume = 0.016 + sizeNorm * 0.028 + (drop.bright ? 0.01 : 0);
  var seed = rInt(r, 1, 2147483646);
  stfxr.play('rain_drop', seed, { volume: clamp(volume, 0.012, 0.055) });

  g.lastDropSfxAt = now;
  g.nextDropSfxGap = rFloat(r, RAIN_DROP_MIN_GAP, RAIN_DROP_MAX_GAP);
}

function makeRainImpulseBuffer(seconds, decay) {
  var ctx = audio.context;
  var length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  var impulse = ctx.createBuffer(2, length, ctx.sampleRate);

  for (var channel = 0; channel < impulse.numberOfChannels; channel++) {
    var data = impulse.getChannelData(channel);
    for (var i = 0; i < length; i++) {
      var t = 1 - i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(t, decay);
    }
  }

  return impulse;
}

function makeRainNoiseBuffer(seconds, kind) {
  var ctx = audio.context;
  var length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  var buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  var data = buffer.getChannelData(0);
  var brown = 0;
  var low = 0;
  var impulse = 0;

  for (var i = 0; i < length; i++) {
    var white = Math.random() * 2 - 1;

    if (kind === 'body') {
      brown = (brown + white * 0.018) / 1.018;
      data[i] = clamp(brown * 4.2, -1, 1);
      continue;
    }

    if (kind === 'detail') {
      low = low * 0.985 + white * 0.06;
      data[i] = clamp((white - low) * 0.85, -1, 1);
      continue;
    }

    if (Math.random() < 0.0032) {
      impulse = 0.5 + Math.random() * 0.5;
    }
    impulse *= 0.992;
    low = low * 0.965 + white * 0.035;
    data[i] = clamp(white * impulse + (white - low) * 0.25, -1, 1);
  }

  return buffer;
}

function wireRainLayer(source, options) {
  var highpass = audio.createBiquadFilter();
  var lowpass = audio.createBiquadFilter();
  var layerGain = audio.createGain();

  highpass.type = 'highpass';
  highpass.frequency.value = options.hp;
  highpass.Q.value = options.hpQ || 0.0001;

  lowpass.type = 'lowpass';
  lowpass.frequency.value = options.lp;
  lowpass.Q.value = options.lpQ || 0.0001;

  layerGain.gain.value = options.gain;

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(layerGain);
  layerGain.connect(options.bus);
  return layerGain;
}

function ensureRainAudio() {
  if (g.rain) return g.rain;

  var ctx = audio.context;
  var rain = {
    started: false,
    master: audio.createGain(),
    dry: audio.createGain(),
    wet: audio.createGain(),
    convolver: audio.createConvolver(),
    compressor: ctx.createDynamicsCompressor(),
    lfo: audio.createOscillator(),
    lfoDepth: audio.createGain(),
    sources: []
  };

  rain.master.gain.value = 0;
  rain.dry.gain.value = 0.82;
  rain.wet.gain.value = 0.48;
  rain.convolver.buffer = makeRainImpulseBuffer(1.8, 2.7);

  rain.compressor.threshold.value = -26;
  rain.compressor.knee.value = 18;
  rain.compressor.ratio.value = 2.4;
  rain.compressor.attack.value = 0.02;
  rain.compressor.release.value = 0.25;

  rain.dry.connect(rain.compressor);
  rain.wet.connect(rain.convolver);
  rain.convolver.connect(rain.compressor);
  rain.compressor.connect(rain.master);
  rain.master.connect(audio.destination);

  rain.lfo.type = 'sine';
  rain.lfo.frequency.value = 0.07;
  rain.lfoDepth.gain.value = 0.018;
  rain.lfo.connect(rain.lfoDepth);
  rain.lfoDepth.connect(rain.master.gain);

  rain.sources.push({
    source: ctx.createBufferSource(),
    offset: Math.random() * 11.17,
    duration: 11.17,
    route: function (src) {
      src.buffer = makeRainNoiseBuffer(11.17, 'body');
      src.loop = true;
      wireRainLayer(src, { hp: 180, lp: 1800, gain: 0.18, bus: rain.dry });
      wireRainLayer(src, { hp: 260, lp: 2200, gain: 0.11, bus: rain.wet });
    }
  });

  rain.sources.push({
    source: ctx.createBufferSource(),
    offset: Math.random() * 7.31,
    duration: 7.31,
    route: function (src) {
      src.buffer = makeRainNoiseBuffer(7.31, 'detail');
      src.loop = true;
      wireRainLayer(src, { hp: 2400, lp: 9800, gain: 0.09, bus: rain.dry });
      wireRainLayer(src, { hp: 3200, lp: 9000, gain: 0.08, bus: rain.wet });
    }
  });

  rain.sources.push({
    source: ctx.createBufferSource(),
    offset: Math.random() * 5.13,
    duration: 5.13,
    route: function (src) {
      src.buffer = makeRainNoiseBuffer(5.13, 'drops');
      src.loop = true;
      wireRainLayer(src, { hp: 900, lp: 4200, hpQ: 0.5, lpQ: 0.7, gain: 0.06, bus: rain.wet });
    }
  });

  g.rain = rain;
  return rain;
}

function setRainLevel(level, rampSeconds) {
  var rain = ensureRainAudio();
  var now = audio.currentTime;
  var target = g.audioEnabled ? clamp(level, 0, 0.25) : 0;
  var current = rain.master.gain.value;
  var modDepth = target > 0 ? 0.018 : 0;

  rain.master.gain.cancelScheduledValues(now);
  rain.master.gain.setValueAtTime(current, now);
  rain.master.gain.linearRampToValueAtTime(target, now + Math.max(0.01, rampSeconds || 0.6));

  rain.lfoDepth.gain.cancelScheduledValues(now);
  rain.lfoDepth.gain.setValueAtTime(rain.lfoDepth.gain.value, now);
  rain.lfoDepth.gain.linearRampToValueAtTime(modDepth, now + Math.max(0.01, rampSeconds || 0.6));
}

function startRainAudio() {
  if (!g.audioEnabled) return Promise.resolve(false);
  var rain = ensureRainAudio();

  function beginPlayback() {
    if (rain.started) return true;
    for (var i = 0; i < rain.sources.length; i++) {
      var layer = rain.sources[i];
      layer.route(layer.source);
      layer.source.start(audio.currentTime, layer.offset % layer.duration);
    }
    rain.lfo.start();
    rain.started = true;
    return true;
  }

  audio.startOnGesture(beginPlayback);

  if (rain.started) {
    audio.context.resume().catch(function () {
      return false;
    });
    return Promise.resolve(true);
  }

  if (audio.context.state === 'running') {
    return Promise.resolve(beginPlayback());
  }

  return audio.context.resume().then(function () {
    if (rain.started) return true;
    if (audio.context.state !== 'running') return false;
    return beginPlayback();
  }).catch(function () {
    return rain.started;
  });
}

// ── Input ─────────────────────────────────────────────────────────────────
function handleDigit(key) {
  for (var i = 0; i < g.strains.length; i++) {
    var s = g.strains[i];
    if (s.destroyTimer > 0) continue;
    var cur = s.digits[s.highlight];
    if (key === cur.value) {
      var hitRow = Math.floor(cur.row);
      s.highlight--;
      playGameSfx('rain_hit', 0.38);
      if (s.highlight < 0) scoreUp(s);
    } else {
      s.highlight = s.strainSize - 1;
    }
  }
}

function scoreUp(s) {
  g.score += s.strainSize;
  s.destroyTimer = DESTROY_DUR;
  playGameSfx('rain_clear', 0.45);
}

// ── Mode transitions ──────────────────────────────────────────────────────
function startGame() {
  stopGameSfx('rain_over');
  startRainAudio();
  setRainLevel(RAIN_PLAY_GAIN, 1.2);
  g.firstStartPending = false;
  g.rng     = random.rng(g.seed);
  g.gameMode = 'play';
  g.score   = 0;
  g.strains = [];
  syncBgDrops(g.rng);
  playGameSfx('rain_start', 0.4);
}

function restartGame() {
  stopGameSfx('rain_over');
  startRainAudio();
  setRainLevel(RAIN_PLAY_GAIN, 0.8);
  g.rng     = random.rng(g.seed);
  g.gameMode = 'play';
  g.score   = 0;
  g.strains = [];
  syncBgDrops(g.rng);
}

function doGameOver() {
  g.gameMode = 'gameover';
  setRainLevel(RAIN_IDLE_GAIN, 1.6);
  playGameBlobSfx('rain_over', 'rain_over_huh', 0.7);
  for (var i = 0; i < g.strains.length; i++) {
    if (g.strains[i].destroyTimer <= 0) g.strains[i].destroyTimer = DESTROY_DUR;
  }
  focusWorldSection('0RAIN');
}

// ── Update ────────────────────────────────────────────────────────────────
function updateStrains(dt) {
  for (var i = g.strains.length - 1; i >= 0; i--) {
    var s = g.strains[i];
    s.currentAnim += dt * s.animMultiplier;
    if (s.currentAnim > s.strainSize) s.currentAnim = 0;
    for (var j = 0; j < s.digits.length; j++) {
      var d = s.digits[j];
      d.row += s.speed * ui.metrics.charHeight * dt;
      if (s.destroyTimer > 0) {
        d.drift += (Math.random() - 0.5) * 1.2 * ui.metrics.charWidth;
        d.row   += (Math.random() - 0.5) * 0.6 * ui.metrics.charHeight;
      }
    }
    if (s.destroyTimer > 0) {
      s.destroyTimer -= dt;
      if (s.destroyTimer <= 0) { g.strains.splice(i, 1); continue; }
    } else if (!s.gameover) {
      var bottom = s.digits[s.digits.length - 1];
        if (bottom.row >= ui.metrics.canvasHeight && g.gameMode === 'play') {
        s.gameover = true;
        doGameOver();
        return;
      }
    }
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────
function drawStrains() {
  var cW = ui.metrics.charWidth;
  var cH = ui.metrics.charHeight;
  var canW = ui.metrics.canvasWidth;
  var canH = ui.metrics.canvasHeight;
  for (var si = 0; si < g.strains.length; si++) {
    var s = g.strains[si];
    var dying = s.destroyTimer > 0;
    for (var i = 0; i < s.digits.length; i++) {
      var d = s.digits[i];
      var px = s.col * cW + (dying ? d.drift : 0);
      var py = d.row;
      var alpha = dying ? Math.max(0, s.destroyTimer / DESTROY_DUR) : 1;
      if (px < 0 || px >= canW || py < -cH || py >= canH) continue;
      var fg = getDigitColor(s, i, alpha);
      ui.text(d.value, px, py, fg);
    }
  }
}
```

```js on:init
term.layerID = 'default';
initOverlayGui();
worlds.enable();
worlds.controls.setEnabled(false);
worlds.config.setDefaults({
  keepRotation: true,
  sectionClickFocusEnabled: false,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 6,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionListMarker: '⥤',
  sectionListMarkerGapPx: 20,
  sectionListHangIndentPx: 24,
  defaultSectionWidth: WORLDS_CARD_WIDTH,
  defaultSectionHeight: WORLDS_CARD_HEIGHT,
  autoLayoutSpacing: 220,
  sectionBorderEnabled: false,
  sectionBackground: 'shader:zerorain'
});
worlds.camera.setPosition(0, 20, 235);
worlds.camera.setRotation(-0.06, 0.09, 0);
worlds.camera.setEaseSpeed(0.12, 0.14);

// Apply URL seed override on first load only
var urlSeed = getParam('seed', '');
var parsedUrlSeed = Math.floor(Number(urlSeed));
if (urlSeed !== '' && isFinite(parsedUrlSeed) && g.gameMode === 'start') {
  g.urlSeed = parsedUrlSeed;
  g.seed = parsedUrlSeed;
}
// Always recreate rng — ensures it's a live closure from the current
// SES compartment rather than a stale reference from a previous reload.
g.rng = random.rng(g.seed);
ensureRainAudio();
audio.loadSoundFromBlob('rain_over_huh').catch(function () {});
ensureBackgroundMusicBuffer().catch(function () {});
setAudioEnabled(g.audioEnabled);
setRainLevel(RAIN_IDLE_GAIN, 0.01);
worlds.camera.focusOnSectionFit('0RAIN', WORLDS_SECTION_FIT, { keepRotation: true });

```

```js on:input
if (!event) return;

if (isSeedInputFocused()) {
  if (event.type === 'keydown' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    clearSeedInputFocus();
    return;
  }

  if (event.type === 'keydown' && !shouldKeepSeedFocusOnKey(event.key)) {
    clearSeedInputFocus();
  }

  if (event.type === 'text' && !shouldKeepSeedFocusOnText(event.text)) {
    clearSeedInputFocus();
    return;
  }

  if (event.type === 'mouse' && event.action === 'press' && !isSeedEditorPointerEvent(event)) {
    clearSeedInputFocus();
  }
}

if (event.type === 'keydown') {
  if (!isSeedInputFocused() && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    return;
  }

  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt'),
    meta: (event.mods || []).includes('meta')
  });
}

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    g.guiMouseDown = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, !!g.guiMouseDown);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, !!g.guiMouseDown);
}

var shouldUnlockAudio =
  event.type === 'keydown' ||
  event.type === 'text' ||
  (event.type === 'mouse' && event.action === 'press');

if (shouldUnlockAudio) unlockExperienceAudio();
```

```js on:input section:play
if (!event) return;
var _gm = g.gameMode;

if (isSeedInputFocused()) return;

if (event.type === 'keydown') {
  var k = event.key;
  if (k === 'Escape')                            { openSettings(worlds.currentSection); return; }
  else if (k === 'h' || k === 'H')              { focusWorldSection('0RAIN'); return; }
  if      (k === '0' || k === 'Numpad0')       { if (_gm === 'play') handleDigit('0'); }
  else if (k === '1' || k === 'Numpad1')        { if (_gm === 'play') handleDigit('1'); }
  else if (k.toLowerCase() === 's')             { if (_gm !== 'play') startGame(); }
  else if (k.toLowerCase() === 'r')             { if (_gm === 'gameover') restartGame(); }
}

if (event.type === 'mouse' && event.action === 'press') {
  if (_gm === 'play') {
     handleDigit(event.cellX < getTermWidth() / 2 ? '1' : '0');
  } else {
    startGame();
  }
}
```

```js on:update section:play
if (!g.rng) return;
var dt = Math.min(getDelta(), 0.05);

updateBgDrops(dt);

if (g.gameMode === 'play' || g.gameMode === 'gameover') {
  updateStrains(dt);
}

if (g.gameMode === 'play') {
  var cap = Math.min(MAX_STRAINS, Math.floor(getTermWidth() / 3));
  while (g.strains.length < cap) {
    var col = findFreeCol(g.rng);
    if (col < 0) break;
    g.strains.push(makeStrain(col, g.rng));
  }
}
```

```js on:update
handleWorldLinkActions();
handleSettingsWorldWidgetEvents();
gui.update(getMouseX(), getMouseY(), !!g.guiMouseDown);
layoutOverlayGui();
updateOverlayHud();
syncPlaySectionVisibility();
syncBackgroundMusic();
```

```js on:render
term.layerID = 'default';
term.clear();
```

```js on:render section:play
drawBgDrops();
drawStrains();
```

```stfxr name:rain_hit
{
  "vars": {
    "click": { "kind": "rand", "min": 0.004, "max": 0.008 },
    "spray": { "kind": "rand", "min": 0.016, "max": 0.028 },
    "body":  { "kind": "rand", "min": 0.03,  "max": 0.055 },
    "hp0":   { "kind": "rand", "min": 2400, "max": 4200 },
    "hp1":   { "kind": "rand", "min": 700,  "max": 1300 },
    "bp0":   { "kind": "rand", "min": 1700, "max": 2600 },
    "bp1":   { "kind": "rand", "min": 900,  "max": 1500 },
    "lp0":   { "kind": "rand", "min": 2500, "max": 4200 },
    "lp1":   { "kind": "rand", "min": 1300, "max": 2200 },
    "q":     { "kind": "rand", "min": 1.1,  "max": 2.3 }
  },
  "nodes": [
    { "kind": "noiseVoice", "id": "click", "noiseType": "white", "duration": { "kind": "var", "name": "click" }, "gain": 0.18, "stopAfter": 0.016 },
    { "kind": "noiseVoice", "id": "spray", "noiseType": "pink",  "duration": { "kind": "var", "name": "spray" }, "gain": 0.085, "stopAfter": 0.04 },
    { "kind": "noiseVoice", "id": "body",  "noiseType": "brown", "duration": { "kind": "var", "name": "body" },  "gain": 0.03, "stopAfter": 0.07 },
    { "kind": "filter", "id": "hp", "filterType": "highpass", "freqHz": { "kind": "var", "name": "hp0" }, "q": 0.8 },
    { "kind": "filter", "id": "bp", "filterType": "bandpass", "freqHz": { "kind": "var", "name": "bp0" }, "q": { "kind": "var", "name": "q" } },
    { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": { "kind": "var", "name": "lp0" }, "q": 0.8 }
  ],
  "edges": [
    { "from": "click", "to": "hp" },
    { "from": "spray", "to": "hp" },
    { "from": "body", "to": "hp" },
    { "from": "hp", "to": "bp" },
    { "from": "bp", "to": "lp" },
    { "from": "lp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "click", "attack": 0.0002, "release": 0.007, "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "spray", "attack": 0.0006, "release": 0.022, "peak": 1.0, "at": 0.002 },
    { "kind": "envAR", "node": "body",  "attack": 0.0012, "release": 0.045, "peak": 1.0, "at": 0.003 },
    { "kind": "freqDrop", "node": "hp", "startHz": { "kind": "var", "name": "hp0" }, "endHz": { "kind": "var", "name": "hp1" }, "duration": 0.028, "at": 0 },
    { "kind": "freqDrop", "node": "bp", "startHz": { "kind": "var", "name": "bp0" }, "endHz": { "kind": "var", "name": "bp1" }, "duration": 0.034, "at": 0.001 },
    { "kind": "freqDrop", "node": "lp", "startHz": { "kind": "var", "name": "lp0" }, "endHz": { "kind": "var", "name": "lp1" }, "duration": 0.04, "at": 0.002 }
  ]
}
```

```stfxr name:rain_clear
{
  "base": "boom",
  "patch": {
    "nodes": [
      { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": 800, "q": 1.5 }
    ]
  }
}
```

```stfxr name:rain_start
{
  "base": "coin"
}
```

```stfxr name:rain_drop seed:1337
{
  "vars": {
    "burst": { "kind": "rand", "min": 0.007, "max": 0.014 },
    "spray": { "kind": "rand", "min": 0.028, "max": 0.05 },
    "body":  { "kind": "rand", "min": 0.045, "max": 0.075 },
    "hp0":   { "kind": "rand", "min": 420,  "max": 820 },
    "hp1":   { "kind": "rand", "min": 1400, "max": 2400 },
    "bp0":   { "kind": "rand", "min": 900,  "max": 1700 },
    "bp1":   { "kind": "rand", "min": 2400, "max": 4200 },
    "q":     { "kind": "rand", "min": 1.0,  "max": 2.4 },
    "lp0":   { "kind": "rand", "min": 1700, "max": 3000 },
    "lp1":   { "kind": "rand", "min": 5200, "max": 8600 }
  },
  "nodes": [
    { "kind": "noiseVoice", "id": "burst", "noiseType": "white", "duration": { "kind": "var", "name": "burst" }, "gain": 0.18, "stopAfter": 0.025 },
    { "kind": "noiseVoice", "id": "spray", "noiseType": "pink",  "duration": { "kind": "var", "name": "spray" }, "gain": 0.11, "stopAfter": 0.08 },
    { "kind": "noiseVoice", "id": "body",  "noiseType": "brown", "duration": { "kind": "var", "name": "body" },  "gain": 0.05, "stopAfter": 0.11 },
    { "kind": "filter", "id": "hp", "filterType": "highpass", "freqHz": { "kind": "var", "name": "hp1" }, "q": 0.7 },
    { "kind": "filter", "id": "bp", "filterType": "bandpass", "freqHz": { "kind": "var", "name": "bp1" }, "q": { "kind": "var", "name": "q" } },
    { "kind": "filter", "id": "lp", "filterType": "lowpass", "freqHz": { "kind": "var", "name": "lp1" }, "q": 0.8 }
  ],
  "edges": [
    { "from": "burst", "to": "hp" },
    { "from": "spray", "to": "hp" },
    { "from": "body", "to": "hp" },
    { "from": "hp", "to": "bp" },
    { "from": "bp", "to": "lp" },
    { "from": "lp", "to": "out" }
  ],
  "events": [
    { "kind": "envAR", "node": "burst", "attack": 0.0003, "release": 0.012, "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "spray", "attack": 0.0009, "release": 0.038, "peak": 1.0, "at": 0 },
    { "kind": "envAR", "node": "body",  "attack": 0.002,  "release": 0.065, "peak": 1.0, "at": 0 },
    { "kind": "freqDrop", "node": "hp", "startHz": { "kind": "var", "name": "hp1" }, "endHz": { "kind": "var", "name": "hp0" }, "duration": 0.055, "at": 0 },
    { "kind": "freqDrop", "node": "bp", "startHz": { "kind": "var", "name": "bp1" }, "endHz": { "kind": "var", "name": "bp0" }, "duration": 0.05, "at": 0 },
    { "kind": "freqDrop", "node": "lp", "startHz": { "kind": "var", "name": "lp1" }, "endHz": { "kind": "var", "name": "lp0" }, "duration": 0.065, "at": 0 }
  ]
}
```


```blob name:rain_over_huh mime:audio/ogg enc:base64
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
VAHRNAEAAAAAAABAE0XAM0VANFUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABxNAzRRBDRRBAAAAAAAAABNFAFRNQFPNAEA
AAAAAABAE0VANE1AVE0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAABAAABDgAAARZCoSErAoA4AQCH40CSIEnwNIBjWfA8eBpME+BYFjwPmgfTBAAAAAAAAAAAAEDy
NHgePA+mCZA0D54Hz4NpAgAAAAAAAAAAACB5HjwPngfTBEieB8+D58E0AQAAAAAAAAAAAPBME6YJ
0YRqAjzThGnCNGGqAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAAIABBwCAABPKQKEhKwKAOAEAh6NI
EgAAOJJkWQAAoEiSZQEAgGVZngcAAJJleR4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAgAEHAIAAE8pAoSErAYAoAACHolgW
cBzLAo5jWUCSLAtgWQBNA3gaQBQBgAAAgAIHAIAAGzQlFgcoNGQlABAFAOBwFMvSNFHkOJalaaLI
cSxL00SRZWmapokiNEvTRBGe53mmCc/zPNOEKIqiaQJRNE0BAAAFDgAAATZoSiwOUGjISgAgJADA
4TiW5XmiKIqmaZqqynEsy/NEURRNU1Vdl+NYlueJoiiapqq6LsvSNM8TRVE0TVV1XWia54miKJqm
qrouNE0UTdM0VVVVXRea5ommaZqqqqquC88TRdM0TVV1XdcFomiapqmqruu6QBRN0zRV1XVdF4ii
aJqmqrqu6wLTNE1VVV3XlWWAaaqqqrquLANUVVVd15VlGaCqquq6rivLANd1XdmVZVkG4LquK8uy
LAAA4MABACDACDrJqLIIG0248AAUGrIiAIgCAACMYUoxpQxjEkIKoWFMQkghZFJSKimlCkIqJZVS
QUilpFIySi2lllIFIZWSSqkgpFJSKQUAgB04AIAdWAiFhqwEAPIAAAhjlGLMOeckQkox5pxzEiGl
GHPOOakUY84555yUkjHnnHNOSsmYc845J6VkzDnnnJNSOueccw5KKaV0zjnnpJRSQuicc1JKKZ1z
zjkBAEAFDgAAATaKbE4wElRoyEoAIBUAwOA4lqVpnieKpmlJkqZ5nieapmlqkqRpnieKpmmaPM/z
RFEUTVNVeZ7niaIomqaqcl1RFE3TNE1VJcuiKIqmqaqqCtM0TdNUVVWFaZqmaaqq68K2VVVVXdd1
Yduqqqqu67rAdV3XdWUZuK7ruq4sCwAAT3AAACqwYXWEk6KxwEJDVgIAGQAAhDEIKYQQUgYhpBBC
SCmFkAAAgAEHAIAAE8pAoSErAYBwAACAEIwxxhhjjDE2jGGMMcYYY4wxcQpjjDHGGGOMMcYYY4wx
xhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYY
Y4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcYYY4wxxhhjjDHGGGOMMcbYWmuttVYAGM6FA0BZ
hI0zrCSdFY4GFxqyEgAICQAAjEGIMegklJJKShVCjDkoJZWWWoqtQogxCKWk1FpsMRbPOQehpJRa
iim24jnnpKTUWowxxlpcCyGllFqLLbYYm2whpJRSazHGWmMzSrWUWosxxhhrLEq5lFJrscUYa41F
KJtbazHGWmutNSnlc0ux1VpjrLUmo4ySMcZaa6y11iKUUjLGFFOstdaahDDG9xhjrDHnWpMSwvge
Uy2x1VprUkopI2SNqcZac05KCWWMjS3VlHPOBQBAPTgAQCUYQScZVRZhowkXHoBCQ1YCALkBAAhC
SjHGmHPOOeeccw5SpBhzzDnnIIQQQgghpAgxxphzzkEIIYQQQkgZY8w55yCEEEIIoYSSUsqYc85B
CCGEUkopJaXUOecghBBCKKWUUkpKqXPOQQghhFJKKaWUlFIIIYQQQgillFJKKSmllEIIIYQSSiml
lFJSSimFEEIIpZRSSimlpJRSCiGEEEoppZRSSkkppRRCCaWUUkoppZSSUkoppRBKKaWUUkopJaWU
UkqllFJKKaWUUkpKKaWUSimllFJKKaWUlFJKKZVSSimllFJKKSmllFJKqZRSSimllFJSSimllFIp
pZRSSimlpJRSSimlUkoppZRSSkkppZRSSqWUUkoppZSSUkoppZRSKqWUUkoppQAAoAMHAIAAIyot
xE4zrjwCRxQyTECFhqwEAMgAABAHsbTWWquMcspJSa1DRhrmoKTYSQchtVhLZSBByklKnYIIKQap
hYwqpZiTlkLLmFIMYisxdIwxRznlVELHGAAAAIIAAAMRMhMIFECBgQwAOEBIkAIACgsMHcNFQEAu
IaPAoHBMOCedNgAAQYjMEImIxSAxoRooKqYDgMUFhnwAyNDYSLu4gC4DXNDFXQdCCEIQglgcQAEJ
ODjhhife8IQbnKBTVOpAAAAAAAAcAOABACDZACIiopnj6PD4AAkRGSEpMTlBEQAAAAAANgD4AABI
UoCIiGjmODo8PkBCREZISkxOUAIAAAEEAAAAAEAAAQgICAAAAAAABAAAAAgIT2dnUwAAQDIAAAAA
AAC+PgAAAgAAAIBFt5kbOP86/zD/Pv9I/0b/Lf9A/zr/Qf85/zb/O/819DR79yMu4o65PHqaU3WR
F9xxyAGpDQUAxOk/vtf6fvvlOeeU18kcF1q6yy4tSmYchwZAy0qEuwDahewdSyJz6LzLhno6zEL2
BCUyODTuNC6tx8cfAMBY97G+eHl567Z5/+Js75uwyIZ1hCNKHCGUKckkAQAAgPFyuqndYWj97OG1
P24pQMNRo+/zv908S/CVe0aYvJLy7FONL7a/ejnD9282+d23pmHb7bVn3w7tdfjtR/a71xYjl96C
ptxbcTrcj8FwiKoY/tyGYZqeH3f80DuLPk7bq/M2Pi/HuyWTGEu1iEAkDMueO48Yx1U24OpTF3zV
QiaCy7TJDJauWpZWNhW5G7zbq4euIZNiUosaqLvCOI5jmunnUHSmIDXrbJxLMIoQAsL24NXYzIDB
ZgmEbahoLCAm1mNVq9rYAAgjeRIAVms9kFIIwqg0u+qkOG9qzNASNmgN4SkU81NEgTuuSHL3V4X3
k1ZAthM4MNElQIEA/oVMGu1maHQNk6H3pPVUzEIKhpdIDS2TiOvZ+Cb2kGMYX+wcyyOOfH81+yrc
yIavEE6YOJQpZmYAAHJRc1apR7YP3bh37eSprCwXTsuybr1v9+0vzkc9+68f77H7Zuexqb99hx62
LY1sFWLaiB9epoYRBM3Xim+lu2xnNjWqW8zd2CKy5991T16JbAwJNvlTe5hkp5hk6gmmGznKLMd+
sykzzECb74xehUXvu2fRIroUKhaZ8eaejvSytDFHwTPQBXQCVPFnDLWOgDHoVHREQB/dYuyt5wEc
IojaQBgCeAmEFe1bElIdZ/qkWEEgCgAI4BTny4A0HUYxvLQcAaElLMlIDaF8VlRQqasGgMCjuSsf
AyktLrZmFw03ZlXwu3at2Q79zkc8xn6fiL8M/uYlnoXEFOwmHUT2f4WoZyBhSCbAjr2g3f9CDaGa
yO2o9mgVzXtdDzUXPBtGUhv10xwouswmmWYAQEm8epj/6K42zywfbnU2Wh6dPDTGen3B9sr67tDr
yapxGp3dxvJocL1bRrvNqnc6HdLWOoqUbmad7L7sQUvfpb3XzgbcEXVD04+yEC3fXREfO78RhdqO
qEb0yy7WwW9Cz5CshDWRnVRj18zW7FuJll4qK8VzOkoIGe2IZepZmsJeWaRxZsaRvDR0MQYtUADm
yiiSgK6cgck7u6PpL1LA3EuGmrR3hU2qykw0qbVxil4SsE12pYQnTYMVSEY2s0oLNMtRpZTQnJfZ
sZIlP5wiYQBYGkmBsAEMUWgXKCEwNgAcRuLqgcIPhW6WiYweIUB2HiSzVeUHyzlNkOrKALAsksCk
9g6HHwaehYSACNkF9ts4NSBXSBKgYB8o9xdxjchbZBrztbjzxXJ8hOLx3CGF67sC+/Cem3A72mGu
ilKJMTMTuwCAvGyqwXhd2Zn51nbmf+N8MegTfw7jX7/+l0M2+60zPIW+/qG3duXt9Qu75599luIC
OqnOkrX04xeLGMk3ER69FSKrQIr7jjQz/efMft2a1eh6e/PWlJbbcwoEaaZ4C1FVJiEulgVFQ1yU
szdFJqoQEMCAHlV51Xn48QJLg6xzWSAt+esXd06UTIre+6pqBpmBHDIRHNaZK1dPcDd9zUQ7K58z
7E06AstHDtZ4Ma0uOMIMaQhQs5UoRAqwIgAMIFl4BOFIy9+nsQ4bzlNBhRqi7clEVBVsaCzoABSL
otjCgoKrsEWg2lXN5nVaKDUih3/7lUa3xdMvsiVALKlbGvQipoOwQGwAwEbCyAEehuQw7cirYe+N
oIZIF5IHMJgLxj6GxDVEbjkh7leiQ41t+sZY+hGlbWOmmR1oEgDGsWbS5vt8bWjxv9pwOH5bPX+0
TZh3zd/YRcKx1rjJ17fUI+tZmGHO+tLeMXeozeo/D8Vl8fRA1OsUZQpQUJ3q5IHyd8Sk8s6B8SCC
BS4Ds86sMTuLWixZVXopj24DRR08TFa8ThKTrB6lyLG50GPG6n44RpbO3LieVBe9BBYId5ieRWTl
TRZh+7Hr0ZtaLKbWqIoFd/59qGnEFIqA6a9hTGSLl1Cy3C6SoqYorhZsHtSTGOUsdiwaEANmGajO
btLMKsByaCEs4RVAsBoVAfKAkR0akNeoI22DtILBDsRSsEStW2aLCgpGbI1qY2Pv4L+K8ZNIiidh
ggBAEQDAUgoKIAFrDPtzwDOY98NySMQGhw6xsAMAPoZUhRgX5oL0PEjrOZIwpC3EuOKgKPdGrueA
lxGSdXpr29aJshgzM4EYMWEEgBKXzg5MNf1eajfv5X5xc66Hl3KH/ed/yOqrv/KzsZOHlS4LwzzI
06bL/QexLJVlQmUpAldAJaRB9ChQiMuwECISGVVaBJMA2RIVY/sJoAhkiuJYqbaZQ8qFwyYG3CnI
fhVXNONcYhrU0RhmJoTu/fsnFRTpooqi1D+5ow9NAT88+bvbqaTIKGGyEtjDoRq0MF0z43c6rqdo
1SOS/vnZFz2utFcV/RxG7JldMxQCAzAr0NBawEggZItuASGC3BWHwZIZikEilTDE9UorLEelr1+T
kVRcuxVB32GffE0Ji8GEDD7uzJOyXel3rgF/PEArgCxju/k9lrW2RjqPQgAAfoUcBDpXcoJxF6in
BFvIASFzTR7Q3glpLeK+tjEaWVshOsouM7EjEgA0tXbLqjYsMn/+Zuyev1J+s1+07Nyw5VP3fOl2
C5utXUfqWmvVqq629axRVjMPhmOBECiwFYQAQKJsQ1h2GACk7USwgECgEIVowGuTIabsoIEZ7Ahw
Pd2a4TwpiqIiJVlH4ELSkgvrAHRDq+9dYwXKthjIVjJf5iLi66vf3G9x4HdZtpmSY2LluXjraOjD
zCWf9tRteM4MR+xzOL2fmbfInJptuycmqQE1IADZLABmYIws8ILBNgLAQiyNcKBdh8ABzRJGBREg
HEdUBkSKiG0qRLHelYxCHyUFrqSIEgwFrjSRwIICx1k2ghTg5BxG8QAgCa9GUJj6f5Gx2pUBx59k
Xb9CEmHRW5u03hbFgg5RRDQaa5UsAL6FHCJlRhaUL0M0fCEHgKxbFkF70xrTcAsbOaA/cvM+vI+a
dIkdUjlhZmJHuVMBgNQ+LpjGoL3VsVm3OxkcJdnG13c9Y9X2wB3Fi0Xl1kwdMWy0PspsDNaiVVXB
ZRmATOTQGZICMQSCWKvqBIwTwCYiAS0NtuCVATEiUsQWIWsCKKplFJPojcgV2gMCutEoASgIg1Gb
KAgRLMKDMkjN5E6OcK6G5HNKvTvqKbqyTDUXI1iWBeI4zdTHyWuAKtS83c/LlPj30jIkjmaYZs85
isIxZhwALMYy/J5Em+l3hkaqqZbzaB8p+cxcVRCNgmK0imJRAa/2DcBgGgEoYClea1smIcsjDXIJ
9dQBpN7C+QEvFsQ7JL36xICIolFEqopFFbAiIqIoqtaAhYqlWlhgkVUNrFmoWgMAAAAehsyRtNya
Bv6BcxgyS8JcpImO/0kiQS3BBbvpwso0Zn07KktMnCqYmU7JxR0AsFBle9eIvHUY+g4iaqquik0y
jLxdJfKVy5Ky4xK2jv0Ymy2ywDAtUBdAUUQPrJeF1bJgZMVYyjSR11UMxkCmQdp6bJXColQSg71Q
BCICgQRIWCA7EpGTtCOEKRTQ0koUajGKAotqIJBYIGC1wcawSDlDUW9dmXMMFrmzT3demQ39LGzq
De+42kIhRFfORKhbGdHdkPQM1qIIsqt6iueILFesjVDQllULg0LcwNihQzDGHgPqtN0mw9LHI4N/
qWvp5si3IqoYEVTRACIm7XBGCGxC5AKGalMUVRcpf1C7T2DSSRkG3JW2baAAAFYBtgGwvQjYsrDi
GQ1YFliq2GLsZdBRI6NGJDdGj1JGY4w2EAAAAB6GHCRYxjTRa1/ktRbxCzlEsgymsSp/kd1wyzV9
CZa1Qwq0o65DHU2amVkgF3cACIadRjPjRstsvKWKhs/3dYohpp16Q40+2wFGrI06+KyNzXvGNo6F
pvYREQEBGEJsMQ7DsMEeQYdGGoFlsDqIBcboQEpxvNLySA6MFwkXsYr8Fr0Wfv69P0qiohX0aIwB
azGE9iIBsLoYoLOaVugsapgCGZjJbrriij/0/je6TOI4Q8ZAmeIdahJgFEFcsyLLCL/0mjnmRKTb
QgBAAKRkfrJzQk4OgoaRhUKQAo0JoS0AG+D4oXpiC6ABDNgirFWMClALAMJSHSxYxe0uHGIFgw0A
FbnEeiAcAUgOWqTvOyGlt//X1d60WhRIxegpQYpSACgQo+hFl/WkCam9bTFFM69ir5kzBQAAAP6F
HE6KNdLAXxdAVj6HIYchVmw5wF9l1xK8yUCIPHXTQWtsM5V4h0anim8qcWhmmu4UdwAIWil5keT6
zqubZBKxiL2pJNjO1gxrWW0gqxgjGFhYGCOmUXVoFNrGk6oGK0WDKGKtQKBUAA1YZmyMGAD0BoiE
i1jwUm5ktAoAVpCBelbbKn10NcIKWMeEDmCwV4OSVgoIG6a7Ie4GyIL9Bf1P/Lp3zMVCvNghlQtr
V7IkpA3IQ+J4QYKYtJlqYUwiGImoLiwrpG2HoAKuWX5CMm5khPEiWu2GkMCykQQrBgsAWyMYjIhC
/YKPLkFDeElNCcLwP9iBAAMQQOq5ySUSOdLej8ENAABgL4DOACBZwCpAklcELLACADZilWwvoGAx
ahVWa6kXRVlRywpX19qL9VEjCgAAAL6F3Ahp9pwG+18HtQhTyI3ndQY5wfnrWGuJ/AAAckuCsnbs
SuQ2Gz7rCKOGE3EEmImZc6cCAACucCZG0zbNm2v3YFAzOSnmYYmvTCWd4p42HazYYIIYYgO2EGu2
ZibGEtCg5hgtoWhUWqzAohF0Zi2AUZlxiyUwEBQsaImEJXUoihg5UGiLxCI5ZUmxRpFbsBhCFvCE
xoKqNKgYIWuLqWKMwWHIWMsLsKEmNMoGgClqvJ/AMwKiyuUgX9TKkFSIWWh1oAZIo3HFFg6RqwTK
FQJ1HYWJIDAGDPrWFFpehohgW0DcilYRYQUkWQE4RISB1aEk2Xau9bf7U5XdBznglLtSsQCcAgho
ESwW80Ti2ThiEh4tSVIfR3jgifyFkuaLE61EW0FAbFEFEI2FISaImpYWZFJ7q9YYAAAA3oXcAIhc
2gkP9dDQhRwOWK7MAf56bsMliKPcHI06imahYjOVAzOzg6M8BQBKam9NTbVG46l96XOaVs49MpJp
sNHmsVkVS6ujsixxO0sRqzbZaGNaplVREVBELGAtKrHRFkpRq4oVVSwJxjZYrCBWVgKhHBjAsgex
WlpmFrDADAJaYAjX3HIhEVZEQWyxaPUCpVy2ASISiGtRuzuiChMydXZ3NuTADNC+tCcpFqqmiBlD
Ie99oH+jBaGKhmqlI0ktXKtQ1ma2tQlsThokG74lNqCIqQWxMVZdtZVGRMWgrqysREQ0AiCq7XMc
CK2C8sScF0xQNvzdR7s9mP93toIXc5i8ajFNT3UkwO6OjtwGRrEhgaAYC4K1YIuqEatiVRRVBMMw
QK2J1URtMDEsdIgICAAAAwBPZ2dTAABAagAAAAAAAL4+AAADAAAA+JDxJBz/KP8p/y7/Mv86/zD/
OP8s/zT/S/9A/z//H/9EnoXcUBUhm2D/q4bzuZbwCzlI0GKTTTD+V+O7luCG1MXAyjNDMBuz9eoy
cSpxaGZm4pwEgJKo1sg6Nb556n71fXJIjCGnOI14FRVvmBZTLYml2lPDOnldnqpVR/XTJZ4uq7ru
lgVW7qqgulNoqrUGnRpASYNYCAkKgTKsEJCQBAEqp6k0gZAgFdJtmWTMRFFFCxawEcQKqqCidaFi
Y9oNixrcAAYetaQE6BXK0zzNABom/Q5k70h7UQeZsYhwAd3RBLLAVBKuHNysp+s2ZmqAiTGhKxAI
rsW73bPXY4kzOybfY1wQAxstFoMVi5+txSFSOzJUGIAsFiBhEJA4ANnhxMjSl2nEW3q0vJvs4D3K
hJeBRdhvGRFEsQgYi9ZEBQvUMGywIoYoBr6FHMbRtc0XnfE/S8rvWsIq5AYKzWW+6G7Kkr21iLdk
Iw0GZ8JK4kfm24ZKh1RMzGLMLC4SAEoeDNpXb7W5eNq18WbWaaeJjYEZGXZqW6khIdjX2altcWab
pEgLthEUxIo1R1WTGgFJRCiXS7EFhCCgUUWEEHIgViAwIWlEo2IQQsjKnrakINukBOWQSERUXaIa
g2BjCBwQAxaAJAsF4/ggNZV5apm9zKyYOTBx3icjqoch0nJPLiEOCmyaHJVeQKlpt91PDjZOupNT
VYn2i40T+RvX7RIFqVU+Pq3PArd9HM21nhmtFYxVFFWMta/Ibkj11Ps2POm3pievbVK9S5S/mRTo
EI8ErT26IK3aJZUnzxosFKTVK/js1HIIVsTSzIAYgjU1TAMAXoXckMe5zCY8xaCQtZbgCzlIwO0i
n/BOFFprCR4wQyoykeKESCewzNaJNWtpJ6nYJWZmselUAKhq1hHWjcpsnUNUvvieXFGxWViiGUMt
NqRiJNYkW3CtoQJhcFBGkiorQQQxgqJiEaNWLYAtdhlLogaCEBsso8A9WLJQKAwFBQCwGEwggGBx
oECsXtTvtnh/ymRLwmIiFJCtYqC6tltyZuux6umbscDHlTE03aYUqrYYqWNsa+QbCmqWbCHVAgpC
OeVkoBBO2YAInYgYEDaAt3rya4wBr5IBCQFiDQ12mPPSjgvFNUaLR8wIhyCeSIoN0nkkECC0Ai2T
Vj19N1zxsLRdgxxPUQwh27eOvVuyPLtuCUcVWMzbCwBgi8YWrWJFqGhtBZ2K1mhqAAAAAB6GzAOx
X2YHlH81VKXfWsYt5DAk1lVK0P4qpfPxgt0q1ll3Wn1dYkslaWIm5nqnAgDWZKuNOfgm69ftO1SX
fZMJOzVzM3NiYYNk2ytJJlPVCtZtsGZhqoItJCkgFqEORUFQAYAU1TpWqAggCBCUBMaEiyEtHICA
loOAsC0orJF888q1EXS1Edq6EbGiWKMqYINLBZEH085aiw5+qa0+mqfgjKufoR6+uxg8gLtbEYn0
hOvL3T2k9QaEsmESnDV5Opm1lWwVU1d1RwsYLFkA9Epysw8z5AFEMrT0roAtGzVBABhVEQVYi1GN
KEmP4K+Iosx+/IS2AADAKmEgEQnA8EbEixHBek/koKsplfOVwU17QMQgEMQAIBBEWNiKIzkCbBNY
K1a1iq3o1ImoisYKAAAAHoYcovq8lA3OTwxVAa+WcAw5wMT9igXnRySGXy3hBXoxZ/oEc6TyNmbD
nFQpZmax3KkAgMpobyKR/VvzZFw3MGvaWMVGDRuDBquRaHDrXvsstDVDZmpaUWuWMlnRAgGoFlAE
FesDGwGkUBE9+lIFBAcJZI2oiKys1hLKdssAxgGKFkRooSEBRjGMFhOERSkOQRUcorcKpqTuEi16
KAxorb2vUrbZckNm82zf2b1BGwCm/A7GZRkEoQ8Z6D6NZDq8DTg1NbztGsaWD8/2ZDNhj8WdQpZB
gKR7aINWvmwtQawhMvaKEGq8ghQslgHa7uW4U7BgwA1g4dU2DsDAktrQHImnqnOYUyOJjmpV/lZR
exJ0dQw1awQm3TwqPXYBb5ZY8PhTghUAsbUYi5iCYopY2Ctjs9BYAAAAAF6F3ICX2YqJ6P7BWsvY
hRwgxLowE9F549YyXpjdcaJvEt/mjdYl9qnEYRZjZkeEEQAqjURD09biNjY3bG1crBJnZ2OX0BDF
JxpiqJkBtSLmYNps2mDVxZIQAsDEQdiWTagMTOh0UFKUUTUtgoCIYIyJZEWDY4tQdoNCIxY1tlaD
E6nA0IgcrQ5Gsbio18jQRpAsRcTIxsBQChDgBlgxYAAe4N5Fcaeyp7Iy53AGtPf1UUjtLoKeKVJv
BRID7oGiu84Y5ojYwNK9QPEp/DWAiEFg4eprwtgwPN4mA0YKwigEELGINapoxUYUMYiqQSwG0LIA
i0JyxiUVR4WeOE4z5P2SFYwysiw49pqVvRZRzaQNhz287TzNRY5OvP4RMgoRNdWiBEQVQRVVER3W
eSkAAB6GzFHRr9mJZP5FrXmBcy2SMWSWyXVlFsX8y8YFtUguTAbr7EjaWrh+BMVizMREijsAFM1i
xDvaJxgN1lSI2oqOoDaP9lGZGzKaiJXKarMtMjPHmJbYGWlGE2HbEMBq2SpGSjUrAEJZWtW2wQZD
E4NE6LCRERjHWAYMto4GaKBTRIuCRpIDyWFjHAXW0HYJtdUAq5gqgACjDlgbYG1abuBlRO8rk2yG
KWcBjaEbYAWikDUIYY1hGUswjLT2lNxc6sfNJw8z7oFiGkIGAQCrsEU/vCqNA2xjEBFuiX6wiCNA
EBjAWqdtsAKiqKkxKUYMIAZBECJIG2GJSAAlq6QhlJXCetiwkZSSRfonZ5e8ZBXBPT6Zz9iz6Trp
4DNerr6xLXUID6tGgFiKqgGWFjZYWBWs2qAGAAAAnoUcBPK8li2C8S9KCa+W8Qo5hOR2mS0Y/yKh
rmW8mdDGGDhDTBij02INSmwTx2VmMWZxORUACoblqGHYq6HlxbU42xnHIaOaLpo0E22LaQl2WKwJ
OemMs0Z11qEEhYoAiiziFSBgpBoggmKFCEIHcRQAYEGCKoBXGMPYEgLCJhYhDrEHAQLwABCCDV6E
MJoaxIqqRbWI1iqiLggNEclGCRb05JvzbaXm5qf4X9X/M5ppZw5eKQJwCnO0qSKYTjSGGKNcYiTo
ZgBJivM3ptzw1xvoalRDL4Na0qkDUBRFVKxbICqCWIOggP1Jk64qR3MaUBAQQAiNSOwlXYm3V4/H
PptcGuzfTokUoAEmJ6PGRastPSe+9O7OPvyqLt8ExVCwqljD0ppqtAYAAAC+hcwC4Q6YTUTtL2t3
QleL0IXMALFfzxJR+0/bo54ubHsm1tn6tiHFHDijmZnnFHcAKCjejSXajBPV/mfug8TQVF3HLows
qnXEYmRMNmophr2NljZkRIy0HchWwMhuQQMWAEs1S1QNKmIjgDgRtExoCAVhKBnBIAopXDsAQVqA
5AarBjIqewnlxUgiM6hoFawiqoowYyGgWZhmMTDQXjNImDWbeKdgM326mSxImBGOoQMRZS3rNRIX
d4Uiw8Smy93Ho2RhrSY1KJK3rBhNEOQqnM5/BKY2pkZS7a5SmNylnIONf9uHpgdGwIhGBFsUgMJE
3TUFJAAmBsj9+PbrxuqwiVXuJ5MKsV+b9laO+le2E71BXACmwAAIIiKuAGIEjOCisG5UXEE0qhZB
FFQd1gwVAAAAvoXMUzOuDYni/CH25y5klupxfUikD0mJ+nxhZzPWMWI0WrdOKoSTsoMT8blTAaCA
oU7HfncYx6l+b++4ktHC0k6sZco6YGmDNZtV2wqWqWJrllnHzgbEMsAIIpAsW0RN51gJLxqjAl4Q
K20AAAfWaLN0iaBgNQhUKETQk4jGEFqPmOwqJqElVw0EoMoKLZYgFJaFkQzIK0ADQKVOhU6vdTO7
qpv77J5Hugk4SD2OZul3jXuUI+kx1cHkuOLFidsNMg0mIc7uZljdEQDYIIu5DTsJhAfJCsEaJIBQ
awsIrBUwgtAjZhVaLAqNbDDhOOgAMKKxwKkvFWEsECXEggALM/KEqIKEzGoDxoANNrCAjD888tn6
AYJfPiInu9UVWRhhG7DBXartpjMyg20J4WDFgW1BNSqoaxQrahUDw6o1S7C0wbQcNCoAAAAAPoa0
GJNwawvMP+EPB/s8hrQZk3BjGux/IfxhQS3ABf1tbHON2bbheidiFBMz09OpAFAw3FpTX97bmIsX
mqNfvzM7c8CajbmNtrDEsDdrqDGjbTmqs7RiZNmGpGJLTapi04VWUZWCRKmV0KrUKzQWY9e2ETCq
UA6MRlSRMLghDGSs0GCDmsLW7CZWS4Kl1ldpyCKJFYgoiqoqMAAI4QXABqG2Mj/7zBl6lvpk9832
A5A07oQaPO/aFXeYPTw92qGqhURDlIxzpt8hl2G16KarwdVsDQFggREsAEkfQAlYLABjoP/0MTKB
AYJlEQJgDDXYdpUQrNAgzNDEBoqU7MK/Yo1WF0UHJfBsmdK+pSlg2QVeorkEjdgcfatsbHYWZKaN
2wBjBIsWA9gIIqyQKrXXWnmiPlmt6qq6rPAKAAAAAB6GJCD4XtsWqvYn/HeKBLvhC8lB8L62mcg3
hlDfKRDVMhzS2mAbqepnI1IcKp6YYqbpkUYCYQSAfm9bI2mTRtk+0TCDkqbptGynqlTqknWG0WKR
W4wf1BQjmZvH19dG1RGr5iAkiWUWMxtlapdVtYpqUZBECBdOtdKkADL6EFq4xoaODAMtoJHAYjnq
XruOgFYnAiHGCa50tbTYErNMGFUGaMWEgFE1iBWxAABQtVggIAeAC9n6FJKghp/KpA41CQkGKKJY
tilyWQlD0rHf2NM6NpjKWosRYPAw6PG0K5MgJIIAk6S0iAjtEC+RD+hQFkYYh6G8rLIsGyFKjsgp
CyYYQCCAEZ89EAD6mwoNRfCrf/KH/TG1+quxd+9WrCCwjDFoElgCLLOIFYBHA/YCDYiVASOkxRgM
UNcisDoBAJ6FzEDxvjQHlH+MiWqZTCHzSOwXZoLyE4yJahlv9Ik0bJhtNqZFVk0hTiUlM7ODAAkA
xXA0YsYwjrMySlfs4p2NA1WDRRIdLXPaBj/bJrjYkFocaFq1HwzJkNGUwUglGLGCiChSIhWtBcG2
YusUAykImFAp0iIwIIwD4wGx9jhEthHyCFV4UddPWi0sLDqYtAU9iBGlakFBRBBSKA1jGCi/A+D9
zavPruo+PTU5qpsEsKsqBlgwzUs0itINIIdpJc1C0IMAd4FRTvVAQXmUVRURBBEDEDVeZl2fIke5
WdBaEBAbMx/F2hcpokDxK7IvUAbdv1rudpnaeMQ+3a7b1NdfHmmjwXRAi5fDjxgeAKk6St+/kolo
sTUKaLRgewEehrSkuba2wPwKlWtDFDIPWN/aC+ZfArsBuUF7IDM4SSSj9Taj0eFEHGZajPa5uANA
MVQmLO79RXZfvA1YSbEqlU0t3iqS9I6G5IlC2jOxiqP4YJHlMhAAgcNCmqpGERSRlsIOAHkQAEIO
EXFQMoRUgC3ojAKlzRricoPBCGRYJEIJTICHBozSKCClxnpb3IgompCehTbiVMenVHk/j9yvsyeR
DROEQ5yeQBObO8w1EYhrkoDagJFMDodpyBVQTXevIdGILjJqAAEWEioN7WvAuhpjYKBlekBeULP0
yKruGiwKxgtgswjW0KHCFWsRZm0Mncl9j8S8w5kaN4ekE9Kl/ULS5s+qsdm5sX0shAEQYIjmR3Py
v/NhPYIMrBgwq0CGVQCsjQC2Bfx0BQILeBGpumZBsnVQTBkMxsIUUesjAAAAAE9nZ1MAAECiAAAA
AAAAvj4AAAQAAADOr1hmHP9B/0f/Pf8+/zr/I/8q/yf/Lf8h/yP/Lv8g/xiehbSo/G3tgvJm3F2L
WIW0sfhepgTlzQrnm+mSKW92025ztG3rsiNXTLpM064XdwAobsG0f26Oqfb14UkP423/+hPics/R
G/2Rja1dfBvS43mjByWZBBnlxSsRQaxgrEyKQtFWdBQOafTaNQbEmABsaoOkXlpETACNaSwrpTgK
YwI3IONiOjIAXhwgAlIKUaERkmKCeBzACCjWro5wIEAuoIe59RdNhjtiz+egfWsKpleGxNADDYT5
09Nt4OxKdWOynk4akeXsZP/MEA/bk8r8Zy2OPgWAARjBE/8nVuD2Ojl8PrxGSwpFAxZRRVFsISBs
CTtwCAq6+niwO0+CYz9Aw4v7vn4PsA0CFoOaPbr6yic4WmgbA5EMCAPaCiIBEiBsYSIAAIDYcva6
RiISsYghtC6Xer1a2IKiLYXMAAAAAB6G5KR4X9gJ0jeEn2VEtYxTyCzUz8YWovRHsrThsCkE6xid
mkXV/GCKmInb6VQA8JvxlWpfxnDijDelRbaWtnC7aeSc73uW3fhqCzPbWN/EvtXCdlmMxiLAHYWY
wKChXlqUMRW94kIEx1ESCsjpAcQgy0qssFbEBihjx6EsCCtsDAyQApBkADLCYsllMLa1i2o9oUqB
ghgDc7KkKEXNYa3759fdfOzH1434NzJrtvEM32xMtT/BflbycEhzdRzH3xn26SxlvribnjMGX1px
vGy2i0gVKowhMMM6EKoIEwIRAAaZOBQSIUCgFmIVLAZcUQExujCiaMRKiCiEwDhEZ/rmZzfqKpAp
T/c/Vc+W11BqHHH4C1+2ZpMKkhEmRgAYEKAYbAAUiwgDhooLIiNHUlQggJhCvB5EwegqSxVQ0CGl
7gIAAAAAPobkvXtfUKC9RUjQ8IXktflsbYL0I1SChgsbMbFlI2ajzZrKicvMxAIjcSoAFIm2aXFX
B+KvbboODzRYPNPsdKOjU7vMuRGlNmVb0cjgjIy2EjYNVs06ACqkJQAFRFUUg95Ylrr0XdXFkiaN
DKC7xKoYiTjEAChYsAILGktGh/o06peqVResWYClZRQAVjiAttMYBAJwOEZofPd9Tjb9ztf70A6f
Sxvb6/l5brfu1qsufafuDfPMAwzjShR/SFFDVjeeYYYhESsbn4cEBowAQJWnQlKIbYyIDCAwKMIY
sSHESKmITgMiCkk2oQKvtpDkXkGWn1DIII1cmGk+pxlSHQAnnXbz6OM/2CcUWb6NbdmrJYJojBjA
KAjUoGAWpLoyxl6wbWwJySzYoVBoKWKYYFjPTQtDRlnTAAAAAB6GREl6AqRF5keoqUW1jFNIRdL9
+jDRSX9B65HWMrkwkZnbmDFGtBrinbAYzcx0QhgBoFAXjBA/cC3RrXfIetGXfmuxXyNjZWgbk8x8
bNYW1kZlW7WeWdlgg6hYFV08SilKVYtlSLdYNFBHl4pTdVNENgESoUYMWEBiuqlKvQbGCoLtMYRp
Y8AAFN7QHVkwqMVKpHQh0h5BOIGMgUzcAmY0ANC4Pdzfuoqqc597f71rJtdnpt7ZA3eMeKLN7jP1
nqJO1uC0a2KeJXe9uafxvIRnza7JWvdzlwZfuZk4buHxugnBuAlAAiDRKPdIgugcIAsNQYAEI4SB
AK9GRsSWnd3+QrB3OowwFE9XwMNaNgZsACtanixTMiy9FmTz/oLmJfzK4+cHHAkAZDAABgBHGJhJ
IvYZVVPTwlK1BwAAHoYkpPmOIhC5hZ9MQxXSxvo9+ATuALWEB8FiHT7zzdpWJCWzy+wFnAoA0bWB
nk2ROhnb2lk0MerUMuuIVYvx1EpWu7HW2Go7RSTJapHJlpb2mrFsW7rtRUBjB6BWStSysEIXihRo
FAADcRvjEYEBzNiiimJoELDIGhAEAAqBXHK7pKHCRfEEhhZIgEYrks1CKUBnZDBq5ViU0NzffoOo
T2WPLF62PpAHPCwmjvW8YTQEujuXPOTnPVPkDC43ucnzqypHb2uAtyQ4U2dw/m8YiR7cAM3KCPAA
2Biz2MbQBk8vQlrFQqon1astglksAFXFQarcVIvY+LmiOBJRZAMm1Dudsm77YFHX3wMwIGIBoP6B
5aLvjOhGhTaspGUFA4DXBcMCy6oWgywq1/sShEVExKjW6kALAAAAAB6GBE7et3ZB+gmhCtZaxCok
L8V5ZRf4CVCL5AYDZrHVmxNvvuHWiRizGDMTSQIAajNOrCKLGSeRbbx3FqcbX2LmUH1q643JeKza
2baiFqYpYz8TIehsqja2XWnBhsXIJEFQY5ugAo1RyWpAUQoSLYGlKKJBJIkSRGWPGi2oaDRA02Kx
INQQyt2lxWzKV9QGvGoxKJ12e1lEeF0Fu50TOzB75yBDg27AbKSC5c/I+7zNhWGS4A2PO1XzNaBH
/Q4s7J5mxMJwV5RioQwCIDolhxA7AgHI4FrHBoEqgAghAcYBCBMDMmFoUApsBzXtIlXhmACSol7z
0/ajgQec3uhtJYgAtZlNZObr42PhumBuOeHZuA8LLqcs8OUKBgaoIKhmMg0AvoUkvJbwwhRoz2SI
WsQpJK/15yI1kvYXjFFL5FBjk216mzbaoFOJl8xMi7EACQAvV1qTeG+1MTpn8GJtbJusuuNTw9qh
rJY+so4VrSxTCxtG28X6M5mWbdUBWgwIhSQGKSowheqqc3Ch101AuGgFI2NXos6xQgxkjak14K6F
Wi2VOLQbLQA2EpZqdkeADAmICohoBdIpvV4EFxYOai023zupjN8Z+fKSBHF3JEl3V82VoO5eCbP2
TKyXhGlouirrBzKihuFGYFDBb61733EdwLplChBCIEwQNCVsieQQuREYwIixKFhEg9E84bJEaBDb
yAK5AwsOKCEuK2oK/p7ja73zauZgLFXW3twryzqJARAAmFIkCNigyv6eJ3jUzccQXGIBRV8ajQgA
voUkq/tfmQLlJyGqRbxCcsn8LlOB+ZOMO9ci3iCEhXTGbDBnpzVrsBCpVJmZWYAwAkARwbmqvVZD
fDIxzqqD2UFDxJDkTINNaaNGM85bxNLnTg1bZ8EbkhQYpKgkOFFCEikA0U7JRBm6E1sQ6BCBZEDC
UAVZgRGDGoiF4pCCAgRUIREAMLOSELrWKgBuFBVb1iKIgXCPIy3ElMGD+IFMR+e6/4bPgfcuMXAn
NDXTvfSELNPMBXgjEz/rMMV/V2/1ZH15wGfP2us7Tc9VUJivmAZhewE9eQrN9PPdre87kSLQjZaG
VB1Ji4jGqDZWDSLgVoqm3FQNKYWKIAIwGYKnOJMGEeCTk7qrSVand2gvRVgK1hrvVyQRWJe0XlgR
RCtWFLEtCgAAvoXEVUu8sgXmO1mhJjELiZKT8NI4mF9w3k+wwxgd1o4w74SZmZkWIAEgNSutOVYY
I5sEETVaxGzby1EWduubxXMcJHi8tusfe7thlNUVm7JgPNu2h0IEDEHKYIVCETxah0ptxgoDeVQj
gxsQQpCKqIVe0oqgcDrK1kLjBVCwIKsYRtiNQ1tiFRqaFtMuGkvudbfsdYmce1O2pA7IceWK6uP6
SMXQU0y/7qKyuqhIiRvLUJVtdolz5XxeYB83BVPc5vKXIy4F1+TKLEHBHI06S0BhhAOMVFDEViol
qRghlyrCxkiRCIkRCBODIGAjoLEGG4gsGVsQ2403e2llUsb665KY73GBZTW/83R82OtcetnUg7X3
Bq2Uvr/KAAPIRFi25rOyIIpBBcGK1gUAvoUE3ks4ygDjDUHDFZJ0/jfaAPsH0oYbtp0WO2z1MRq1
EO+kYhQzswMxCQBFfEmWhdY7OjA56HRGV4MJlQtxFpvyiVP2UhmVl2HbXqzYUmxpEGoPWEgNg9gd
oA46bRkgcOzICyIL4Q4BIJk4RFifMgGqWFmkFjAeKEDE2JPU6LB2zuiLLCa9FKmuUMRpVpielSJc
MHiFBBhYu+v0qGaU36F//Z7qbWh1fHLFxxEzGfWwOMIPvOfMC37k3XMx3OwfMQX8wpvHUlz73tgk
Bo8NKw0OkljyGMGhJ2MzFoQymAkMyBhMrEocxkAg8AIiIBRawQrBrPBkQGR2TEzxOKQllT4/QLsk
TNqDvGU8RaH6tMDQY2RTk0jUAsf2PG4x6aYAvoXEyUncGAftNMPucxYSeiPhRqaB9NMQ1QTu2/Rt
21YIISgxSTPTLAAAaFF286b1fe5mZm3PqsPnPDObdGREbTnYaGEtRo2oadqI3XAnsZZBjaZuRGsr
CKGGyNKrUUS1jWJQTK1VAaETUwJgASbDNBUREIsIhRruZQUEMGCMpmnJiHQwEynCIJeEhU0qDqNF
A6SBiRGQFqB1TFX1TlGfc/82dVfSAORNFTBJVrOnskbk8zSQ5LwAN9OZKCv3YTWZ0RQGNjmKL6VF
JQYBEKgwACEgrESjFf3skNFWJER9iUrp+oyEmpdz3beRkiGSNDjw45xUIvD9UH5pv/YBMgaIAXKS
2l0sZEFbvHYkalFHgAEAFsju2Dtqme3QSCBioyqCNdjehWRTkriRAcYueGsCs5C4JQkvZSAaJ0mh
hvECw0nYCIavb2R1hRhaE2NmFiABoIh67TMikRxZqkQr5uw4sZpxeHo+4UFymm+3vrHR7dV9fQ9q
MMduJMqEEAUKFOJFwxpkEnCAxUThmFkMlELZRSOI6EKTWEO2sW2pg6hIY1jADABeBQDGpMMsYKFB
UiEQEUWtVU80OQ0rgCkDrMBNbaffcvml+yeuZqqbQsSXHoQs8iDdSfPoWa9dbe/wU8pblwuF8bQo
dyCupawZSrmS2EJCcK/s5imxIkRxDCQDVgBBa7GFMQYchKEtoZmRFHcUhk8iHhKMRGiJVdC2CAEw
pjOKJ2AM1kgoEAazAzJmXJxil7Irz8/5Ym96CspyJKsU+YZTPkSdQ6xYAEALWgsA3oXUs5N4TSoo
92A6byH1qP+X1kyU90RwvoDZtb7e2hGueBaHEmNmBwEAAAKkFmo+wVxriD+5eTF/YsgZLLKYwSKD
zfaGZT7qjiNWMuyxip2NNoQXyJEVmazQwo5QQLKGEuXMMMBh2mC1pw0anEFsm8yxlOIC1thIx4HA
ZBvAiVNWkWYx1gSxCO0mnbgNFEC9UgQ6jHqIIkLgLqqHG7jgD5vumjlU2iSUYNmVzjtnSGVO8bD7
5gEm6T0nyvkuftD2MMJxvHcOlV2KAxLiJAU0EgC8KEGow8AgADq77jElT2K2bAEKEYtYLyqTJCba
lRjqFYh4SGSLMwUQHAkUS5bdhzjRpptRy3PJMDLCdLohn2AAoKpMF+dLRBCwaFStagHehTRjlDga
02ThbhKJahKzkHKM/401A+XZJItqEve1Dd9GpTgVo6QYMzMxCQBIGtpo5kbV6I1FFo86W0kjMrh9
5rJALMeUIaliZNY2nmGOLaPuTdMIjETgXhQYBQSSQHZQWQQlGUIjYAhog4goQDhoYRN0hoGQKZp1
sCj0NGQqxE4GD9cThLIrawZA41AVgJQUM3JkLFQMIw/94l1F3kkVmTTvSSAqhp4Bl8ie9cSGt6vy
pWXaQ7zeZOdQm2h1aWGeaciaPtPtuhY0YVYedyG/60ZQdmQFWgCBG5HGCiMoWQoQWJdEO0Pe0l9t
nr0PRlPBBENrd+SciR01E3hRnV+QV/4VAsMud+1hD8RxXCgFOdc9W9SeQwFPZ2dTAABA3gAAAAAA
AL4+AAAFAAAAsMZwUR7/Ef8f/xL/G/8a/x7/F/8d/x3/F/8M/xD/Av8B/wrehYyjk7gxbsKzQQ1j
FtJN7ndhzIbngBrGA2hxBj1m1Yf6WWJxxChil5mZCSMATLQ2VgHipbkE08QRLIZKFZ3PkaAIqKAj
5DGS+fzAw2p6JrXSAiAyZq1kjQQkIn1Kp9PKPVBLJlABsVWRgRADXtI1JhQlTGAfp6NbaLyUAS9x
DSloERlbVUUsAyIEG8ImedEtW+LG7J4ZMxVzpuxo6gP9dLNKGVmiuv/tz4JhKNtMx84jwdiWzklp
d7cjFO9cTitQFoYAAWCMBTGI/qPZNjBfRDJYjox0hhupcLaWnflkKdwW3AgRhJBPIyKsH6DFAAhD
BM2PNsH6mhoru/fkHMina0Q0FnQOUpdewvuofl8DAN6F9Nfyv0JBejYTNYRXSH2U76VQ4BRo3Dff
aDsaTsJcZmZmYgAAqKcxZNQahkxW7Se7lYw2q+YZ8sdNcx0rxj610bDJluspK9NBj7nmWUX0Woug
KCoCIWjVEjpB9lihTEeqorOUCIwFgobuwQsFK+RiYHlrQBRuWKgJyGLZ8NKiQL56DJqeCgdKWbSC
VQ5aeKoUWDiLIAbU3u0LBsVQuwu552hMGT9Tk5UVDI1rJ+eacWZKjfqBFZQaiz15spOs7GTxMCs5
c8VTguqk3WBQiLpvpVsaAgtAIEr0lpAABFiUTYhEsIqKVmGYLqxMCGUIMZIQslgNIPAdz3LzLsX6
CVyvF7jabrCp5EnknHYN0GG/yMgwX8ps0sU5C0GlegHehUxLknArzBTZQzI1hFlIv5bvFjVBg8Z9
HSJro6FCiFJR4hAzsxgDAEAdcyS3KKtnYLPxtPGXgzEmDfuz2zLbfiTAsG2nepDeN1i1SUeJhjJu
XiAknliozpCqUQUZmAxsGncB3Ej13F4EsEYSRyPiRnYdOFUANcsIhCCyF6dg0IwhIJVUaBUKCZpT
wUQzbjpkBSedJABOaE8WwwLABzw9by+TvfbMM8wYerqfhowGEA0wyTzQ8N9lb30gl4p+xjritFMF
qxllGOHGPrIUQnSjIiJhS2ADWiOS6FEMiCogknOtU/ZblA3LlUQtMSZGKRmDotadTAfehUixxJ83
rlLL6WNvrQhutpbZI9MvaIB97AHehaxn+l9ateE7kGsIr5BpTp9tUgfxblqE1RrCNPSweR+16JB0
y0rMYszEJADk0V7k1mJ1DeliVNlhQgIe1Uunbl1rVE07t24l35vYbKkm2aRMYjGsIQOKxUawMMTQ
ucE1y4GmB9LqsThtKhR6VlKLjWIR5MAAbgDqVvQ9NaEDxUQIumQ6lME4MMNAZB27ZV1JYOhxN2R3
cXJy4GbKgi/OzeGyDnDHl9yDG5j8Sdqd03AT9LWXtIWWhQNs1lkms94N3w+/UQri0xuvPlltow2A
BRADMpYJnOACBAqLOHEqRJjIILBAyMZSrDTwyDEZXTI39uikuyrjN5wMNVqGQXgipDfTNUj+ECRq
TSThGqfK264ZaqBE6Ik0AQDehRzv3h+AVUTtPSUJGq+Q5Ro/160iO++hhaHxgBWcWbF4X29tI8qS
xZiZmQQAbdaihKTm+NrQvrjpkBYSDLu40Lq29T7FBIUGVNLOiCDiBswKM0aGICAJsCWQixg9l4GZ
aSQY0lL3soyKXCooBNGqmwySwUy27aTGlcbCK5NWuIQEtntNtCqlVUstS1Vsd9tDcsMeENDT2dVN
4czswzzAUQ9Aatq7yl9h0pm6HNXK2cXjZGPKd2eVsvL9u6CGx8UCAE0tA/eypmAEo3ajGxilKsGK
SUAOZYYklCEAAAkhIEekkBVZqJCKbTvZGpJolXNImu19wO6JOOweHM3Z/z1Pc37IYKvkgssAEpBG
N5FPZGoyVdzNXesnAJ6FrI/6uZDCQtjFQK4RuUKWW31vBLOQTjGQ1gD3Mz0TeJH5thE0LUYxEzO7
TAIAGLkutR1KaIiZDaopKAoQRnn2/jR7Z8pgsdGsceBO9npGdWVGiZNQiWptcdztzgXaT4bqBlfP
UhxlYC6FfWsLIQaqxTYJKvZKKPcOXV9/j8FgdbJqCdXUdHhKk/U4kAoAtaoiNmU5mY2JsJISgEwe
6jvl4alSFkAONJUnK6qi5M56FmrfLTJkwJOlInsW2KSAVwnxtZL3uf/bstvbpnB5wUowI+iE7lJH
G0ezZ1iQhQGGnXW3AQ5II2HgTWGGk2nmP0MXS0a7UNaIQINubl4fdPXW6GEAIb7eWT7SLSwpgIxA
NixOmRvwapzkiFwBAJ6FbLf6uRCCwLNITY3IFbLc6nsQDPazQI0wDdps06xtq2HByszsMgCgaho1
o+aGONtmgyatCgMgI7gCRbaRp4xdBouF1WF8/0qY1gWu616UOcZEE4sSqIFGW4TI3BQqylSmNmDa
3BatWhaZyBWlsQuIYiarbtUYwIopKNEAppKJUd5PDlSIlYGD1mrS1WshI4bRAKxTPdWdNc0WScKc
WYBKYKap7vhHc1LkXR8vjVZaXBo2O69d09Ts9d6rpsnKQ7JlwPFjmB9HJItRxlGhMK0CAIMXSJ3O
somqXiUR4SCAciiANm4RgDACoEsnqW2UIabnAJDAk9T0XMvH5wBLojJGRXVo7ugN1aYLGACxyuBq
IYR2JN8EfoXs9/F+DQIUqBHZQs73+r0UAtwDakTybVp4bU3rK7XMLJ4BAAANJusMjSvLnBRj4xZW
9pBZr1jZ74lp2q3f3ubRqQ2TISiCVWHQWyCnrReRxIiRg0w41FWwX8aSJVGeukIuAwdralAgwlKo
UAMzxYBhs5AHMa+BXBy5GYpM0bjwgm1qIWZmZis0YmOJ4O/emiLKrMqL9GlRkFVJXjdU0jS3sqro
pDdkJZWFK/OGkq0ruxXvrrLKxwBzjTdTwSSsqjqgowwQtghsYWwWMRgDlrAZWADkHgMCDFSxACxy
9wINIJt1ZBmD3HGgVHnshIY4xSA1p6jBGBYQYDCAAbHAZFk3EGjdeur7/Xb05m/ta8PBMQAZAauA
PGDJ2QB+hZyv9X6ZMyjfQXg1JlfI9VrulyOD8h428a4RcYZps83WWyRRtw1mZmJmEgCamFSRxWJp
8EMNznorAAhkllyxE7yzZqu1xNAD1LQU7SIjBhSQckJttQICFRNHas7pOZIvQkMtRsyADhAskYfA
JQKPK0swlYaOCkVFZTlfTVJWYXwlOZOjXtNBiWKPaAwd7Hm3RzGpdZmW3ZdyQxnVpgruVdBfF+Go
nzqXOVoc8X+UQ2+jVBdN9TJ/3QEDRKPM0b8wPzF1ii+jT82ASGEAAAoZhQBxrQ0AxsKLasPZQIEg
RoQOBADYoDGLDQAFeAUhkG0BgAxesAEjyF4FkEh6DqK5y4W8OTc2dzEl6hr0do/EI54Z5tYlCX1a
AAcKAJ6F3O/tPUgEnhtqilfI9dbvo4UgPTfSGmOyDR++5kdU0hTNzEwzAACgaUDCK/NmGArMbCtj
MmZntBg3d5dZLdiSYZsxYzZk161WRaG0wF3+rxR1RRWui6hE1Eh2RiGwfduybKSck3SSKzi7ozI2
Lkdgho5AkGRBqXPISJWJKogp0SEusLqKqiwqND1N3gmWcsqwYJhCILK2PFz44s4I0TldpB71eA50
N27yT0r2dgP7nr/zkhCwy+IiZaoMc5IuQQ4swTYmxEC70cErpxuoECBGYISJQRqlsKVXpLSNv2/X
xJyYQQbJirE/xS7DpIqR8pKcAaNaASS+svvYkFKC/lTPS3SfNxlAKZ1u15HhQFqNjYRBQIAHfoXc
L+0NEJS9oWa8Qq6X/kYhSPdGXDMKHwYwRDayjlCXFoJYMjMzAwB0R1Yfw43UTBujCEDTGIeNp4MV
xFbJLV0UuYlkaTWr7UtyNvsx1tAsWZ7SUueihO03gLV0M4mYLPvi3DG1UEGhU2mEkmVf9ujaiWAd
GqqAKEccjij1SyLuJMLItiVWcqJMroXBEvjooeK1zgVCTh8Ko4d0Fe2GvmFuZkByhG01ZR5IYEks
Nt25IEMnKCsho/nmDDEzOTaqba4E0DFUzJVAkGAUGfhV5dF3AJSKNC1wdjwC6RAd1Uqc274bLPgR
UpTy5JQs/r2XXSTjiC/asJuzwduOvIz+dvxcWlr3o/wBSFIBnoU8LyMP9gNhH8O+WvEKud12btIH
4jkEa61o+/Q6GlMUFpRkZmZmAAA8JOkap5FNHHaMPTsL7YbkDrZc2pi5VxzIrg12SbKuR9JGQi46
ru1CqQisCvGB06JhIlYZcy+FRSyqoGi9VpwcD2XhTDGKqqwqTNYRcirb5RXrzA0NpyAmFhYQsdaN
5U46Y/E8MAGyDJwlG43HqsRsBjkqxgBV/Lm/rTHp66QCwiB4Z1ICoInzvm3J+dRVv6LzyDNIE7DV
Q+JsMF4M7dsXlqGGq7CcR0RRA40IAWTAIAshS8SU/VqI2py7J7w9pCc8dIK2lUqiifp1kgZupeRJ
A2TMnvxmls4sa1B7LV3An9jUIHXtOJ6F3F5HHsQHUrkJbm2YhTyvIw/iA23fiGtD4W00hraistKS
YmZmBgAAnFeFLqiHqrrFGoaluSp7lChmFslsxG6bnVu2WyeCUhcytwZRyxwj06vxRVQIgjCwG033
4BRqmMinkwBaQCwGB4MILMhKFSAeyofWNxOqeoyzrHYFw7IQZlkhpC1yA610D7t67307Dv1Oz0zZ
epdRJgMusm9avWGCynvpqrtlECQQ96A/g63pHWd9ZDRAZAFN9aqhDIkZAAAAIyLziY2/ZsZM87kG
LFRGs4Fe/zuAI2EQIKemyFDwBtplM0JgwKa0lED+wkE8tqO+7vl1KMbbEpqk1n/zAXEAnoW8XSZu
7AvK80mQ1oxXyMtl4sa+YNxPRDWjbbPhrc20TqRkZmYGAADgYGgwEIIjd76JGabbY9zBzM5gw+oh
q5JVFGHUydXJ7yxXL4g4gCpBoWijl7F01t0gQ1ok06lRxlyz1lToDhmJWmYogVBjeav2TuMf7SAM
aGoZqldKtO2hRagB8Ruz0YBgKRo0bwNQR66mlgaq6KzRdNYBL6uRoK+pxRh3Vbe7u3v/TAG9j74t
bSE547bQprm8Tgj0LPSkvh0plHEkYwAG4wUBwjIkCDGKLRAaEEvoRstrdL1uRL5E7yM2dDkZTUJJ
JFk4sYkh3Kg4iK2GphPaflOtMZc9DL6FfF4nHswDwnkirRW3kO/ryEN6gPO0IteKom34aNvQCCFU
MjMzCQAAAPw0EGhUKbW6LtP2uSKDrTFiN+T2faaFa2v1CmGxsbIppVatIPoy0HMsgOT+hM9/y3cC
NAwMdhOLmqokVtvQ4aBhDJUkMd3olpguniiXrqNAkwwLbmxNlAYMQ4YBNDQFBFRhkWBwFmrg1mQW
JGTn0NnpE2Rvj8kZZ9wbmJNeppKINJW4DMbptcjb+xz8nhvWRSJhFO3GsAOqBmNZsRFworVEowwB
G0RhFuZCgjR5q4pWfsR8mJRddGQLMaczU0ne1fl1m20/RXo9mVa+tqXUyVpcA7OHf4Mf2hYEyKwV
YABPZ2dTAATIKAEAAAAAAL4+AAAGAAAAx+FUbRP549zUsY54XEQsIiIiFgEBAQEB3oX8vI68iAfw
hpqxC/lxG3mxDyj3G7lmJMzNW/iGteK4qhQTMzMAAAwgICllVFpUcMFVzE6xzqjpBa07WQqQZAGC
gl5NT0Mpq1ro/muBkGi5jwubUHGAl1IObjdAk2taHS/WDh9udX1ENMb4TuQidC+FBIssrkLPxPMa
AFxKLZh1RpMwlUl0KJwCGrhLw2R76JVZ073WTcFEQBJX1S2ymIp6poiHSlUM3VlQRZWJsemuZpBA
WbRX4ZZRwjpxezJqDWGFgQUbQ0rvnByJGpGHdLdQ7Wk8ItVqV81N+T4NkxCSNBI9mo4/j0jphWDI
zgbm8xrrwIB5AcMa3oX8vs68sAPeUFPsQv5cJx7kDnhDTZEwzHptqKq6UZeZmUkAAID2CqpFCqRe
q7RW0Vam1cqIxdOqRFE7mKWJQg2GycB9kWHzVnU7x1CqAxqSCiK6UkNApj5w7HI6yL2uiaqLq1vN
RC3qirvajqU4uC2tnchRjmK3U4Br9HlmJ3ItA+7wwN4MBveRxz3PEjx1HvBgz/Lw0t9fhTQm3qC8
GD9dSYUA5FUY+hkfmgK0jAAAKCNs2zgEQwNA6FwQGJyyWNz2SiIBLdnwJ/1K8muLc7Rd0pprLSqc
pxD3W9JRAXQ0AAPehfx9mXgRO+ANNcUu5O/LxAs74A01RUKjopiZqtZYxWFmBgAAACh6Q0SY2lhJ
61VRsFNAWoG1amShJocK2+D4qggyvPru6iX3zM2L+0LBkaCtGXGBLDFsDIAh13Ilfj1LKsl0UUm1
qBdR0Sj19aFcpP3pzgKZl1Nxq0zjjmujXjVrFh9+xkxfeu74mA76U0TwvIflYues+XScNdZZQ+ZH
TzL6mKSmVjxiFmM3ooOBBsSygSAiRkABwLtN0om+iaFcUoVoMUDjX4BMk9GcHheAivbnIqUYdM4F
egcM3oX8u+18xA54Q02xC7n5duSFHfCEmiKh1re1MFVaKclMAgAAAEdhQFExkskEgQAgpgsMhlQB
8ZheexwA+XFSREXGnRvoKFZFUSrn6mBiyWwlVeCzNl1rTzOVmOo2Q8/aqnT2PXS16Y5pnwPygI7V
9WOpp2mKYKDMvfbUVDPFzFl/UyhNPcB1AMiCbgYYapn1rO7s9A3KSUQSWoOIKiGxsg6GYmF96KjV
oRDP3UgzRDPaq1YrN02MMQBQ1IQoIzKHUQ8CSgQDWIP0gBkOTiAJCkNAQADehfznWfhgB7yhptiF
/Oe28MIOeENNEerNWlUNSakyEwAAAACY2LJkXoThqlc4JDBDLj5JTt5Dx/ydpJy9+E12pPWmYkqD
iNdwIWdV09v7Gp8bMK1iIqDBdA0tVoZEzfyUGsrtStNFMI0TA6yVTXfnlOgiWI34QR3DOn9vf0Ds
gsMuYDasNcgBLnDwAIDuhQZQD+4AIIJdpUsDSltIHEjXgFIYAK3EAQ44FGCAAwzAAA7ehfznmfjw
HfCGmmIX8p9n4cN3wBtqilBVraqqKkWBEAAAAABoyAHQLKifQ8Uda+uNDdx7NyMYe+v/2Es/cqjs
XcHVlH2x7GW85hcoakCZ67QA6K6EjGRc5Dea1+nU7uyROLG5lOHhXMTADM5Bg4WpwVo4iCt0ApYH
AACeRzcM1APMQYGCOgYDIACwYAEA3oX85zbxEjvgDTXFLuQ/t4mX2AFvqClCVauqqoKCAAAAAAAA
ABw8gOQ9WHhwhwExY2PNukAU3wDRoIGeyaGACJIhgTJs51TgZ3M3XCDbgW+Nu9nuyr45OGXybm1a
sMvLtpyLMWUt8AALwBngzwAAnoD3APgtAA8A3oX857bwEjvgDTXFLuQ/t4WX2AFvqCmCECFVVRUE
BAEAAAAAAAB2wMNZ/BUsA5sw9ry1MIyDKXKcO7fJFVe3zkifKJ50TcsYyxUt1uTOPvKaRRsrAwAD
OAAADADehfznNvESO+ANNcUu5D+3hRffAW+oKQKEBAmpChKCIAAAAAAAAMCBAXgPgAMAAByvTeC0
hb9PPAA2DgMAwAPwAAA8AN6F/Oc28RI74A01xS7kP7eJl9gBb6gpAgBUAQAAAAAAAIADAHDvACwA
AA8A3oX851n4iB3whppiF/KfZ+EjdsAbaooAAAAAAAAAAAAAAN6F/OdZ+Igd8IaaYhfyn9vCS+yA
N9QUAQAAAAAAAAAAAADehfznmfiIHfCGmmIX8p9n4iN2wBtqigAAAAAAAAAAAAAA3oX855n48B3w
hpoiAAAAAAAAAAAAAA4ODg4O
```

