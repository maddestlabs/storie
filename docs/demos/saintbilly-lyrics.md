---
title: "Depths Beckon"
author: "Maddest Labs"
theme: "saintbilly"
shaders: "blurgradual+lightvignette"
font: "Rye"
---

This variant showcases timed lyric content moving across multiple Worlds sections.

- A synthetic transport drives deterministic timed state.
- Selected story sections carry `timed` heading directives.
- The active section keeps its authored prose and gains a rolling in-card lyric block.

```javascript
var state = {
  isPlaying: true,
  startTime: 0,
  pauseOffset: 0,
  wasSeeking: false,

  currentLine: '',
  currentSection: '',
  currentSectionId: null,
  timedSections: [],

  panel: null,
  widgets: null,
  mouseDownLeft: false,
};

const DEMO_DURATION_SEC = 30;
const WORLDS_LYRIC_WINDOW = 3;
const WORLDS_SECTION_FILL = 0.9;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function fmtTime(sec) {
  if (!Number.isFinite(sec)) return '--:--';
  const m = Math.floor(Math.max(0, sec) / 60);
  const s = Math.floor(Math.max(0, sec) % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function buildTimedSections() {
  const all = doc.sectionsFlat();
  state.timedSections = all
    .filter((section) => section.timedMs !== undefined)
    .sort((a, b) => a.timedMs - b.timedMs);
}

function sectionAtMs(posMs) {
  const list = state.timedSections;
  if (!list.length) return null;
  let result = null;
  for (const section of list) {
    if (section.timedMs <= posMs) result = section;
    else break;
  }
  return result;
}

function getDemoTimeSec() {
  if (!state.isPlaying) return clamp(state.pauseOffset, 0, DEMO_DURATION_SEC);
  const elapsed = Math.max(0, getTime() - state.startTime);
  return elapsed % DEMO_DURATION_SEC;
}

function setDemoTimeSec(nextSec) {
  const clamped = clamp(nextSec, 0, DEMO_DURATION_SEC);
  state.pauseOffset = clamped;
  if (state.isPlaying) {
    state.startTime = getTime() - clamped;
  }
}

function playDemo() {
  state.startTime = getTime() - state.pauseOffset;
  state.isPlaying = true;
}

function pauseDemo() {
  state.pauseOffset = getDemoTimeSec();
  state.isPlaying = false;
}

function resetDemo(autoplay) {
  state.pauseOffset = 0;
  state.startTime = getTime();
  state.isPlaying = autoplay !== false;
  worlds.content?.clearAll?.();
  state.currentSectionId = null;
  state.currentSection = '';
  state.currentLine = '';
}

function lineAtTime(timeSec) {
  const entry = doc.atTime('lyrics', timeSec);
  return entry ? entry.text : '';
}

function getLyricEntries() {
  return doc.timedBlock('lyrics');
}

function getSectionWindow(section) {
  if (!section) return null;
  const list = state.timedSections;
  const startMs = Number(section.timedMs);
  if (!Number.isFinite(startMs)) return null;
  const index = list.findIndex((item) => item.index === section.index && item.timedMs === section.timedMs);
  const next = index >= 0 ? list[index + 1] : null;
  const endMs = Number.isFinite(next?.timedMs) ? Number(next.timedMs) : null;
  return { startMs, endMs };
}

function entriesForSection(section) {
  const window = getSectionWindow(section);
  if (!window) return [];
  return getLyricEntries().filter((entry) => {
    if (!Number.isFinite(entry.ms)) return false;
    if (entry.ms < window.startMs) return false;
    if (window.endMs !== null && entry.ms >= window.endMs) return false;
    return true;
  });
}

function composeWorldsSectionContent(baseContent, sampledText) {
  const base = String(baseContent || '').trim();
  const lyrics = String(sampledText || '').trim();
  if (!lyrics) return base;
  if (!base) return lyrics;
  return ['### Live Lyrics', '', lyrics, '', '---', '', base].join('\n');
}

function composeWorldsSectionTitle(baseTitle, sampledText) {
  const title = String(baseTitle || '').trim();
  const lyrics = String(sampledText || '').trim();
  if (!lyrics) return title;
  return `♪ ${title}`;
}

function syncWorldsSectionContent(section, posSec) {
  if (!worlds.content) return '';

  const nextLayout = section ? worlds.getSectionLayout(section.index) : null;
  const nextSectionId = nextLayout?.sectionId ?? null;

  if (state.currentSectionId && state.currentSectionId !== nextSectionId) {
    worlds.content.clear(state.currentSectionId, 'all');
  }

  if (!section || !nextSectionId) {
    state.currentSectionId = null;
    return '';
  }

  const sectionEntries = entriesForSection(section);
  const sampled = worlds.content.stateAt(sectionEntries, posSec, {
    mode: 'append',
    separator: '\n',
    maxEntries: WORLDS_LYRIC_WINDOW,
  });

  if (!sampled.text) {
    worlds.content.clear(nextSectionId, 'all');
    state.currentSectionId = nextSectionId;
    return '';
  }

  const existing = worlds.content.get(nextSectionId);
  if (!existing) return sampled.text;

  const composedTitle = composeWorldsSectionTitle(existing.baseTitle, sampled.text);
  const composedContent = composeWorldsSectionContent(existing.baseContent, sampled.text);
  const sameTitle = existing.overrideTitle === composedTitle || existing.effectiveTitle === composedTitle;
  const sameContent = existing.overrideContent === composedContent || existing.effectiveContent === composedContent;
  if (!sameTitle || !sameContent) {
    worlds.content.set(nextSectionId, {
      title: composedTitle,
      content: composedContent,
    });
  }

  state.currentSectionId = nextSectionId;
  return sampled.text;
}
```

```javascript on:init
// Camera styling helpers
const deg = d => d * Math.PI / 180;
const CAMERA_BASE_ROT = { x: deg(0), y: deg(0), z: 0 };
worlds.enable();
worlds.config.setDefaults({
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionContentAlign: 'center',
  defaultSectionWidth: 900,
  defaultSectionHeight: 520,
  autoLayoutSpacing: 2,
  sectionBorderEnabled: false,
  sectionBackground: 'shader:saintbilly',
});

// “Looking down” at an infinite canvas feel:
worlds.camera.setPosition(0, 55, 320);
worlds.camera.setRotation(CAMERA_BASE_ROT.x, CAMERA_BASE_ROT.y, CAMERA_BASE_ROT.z);
// Optional: narrower FOV reads as a touch more “zoomed” / cinematic.
worlds.camera.setFOV(deg(42));
worlds.camera.setEaseSpeed(0.18, 0.12);

// Handheld camera motion (implemented in Worlds camera, avoids shader warp artifacts)
worlds.camera.shake.setParams({
  // overall intensity (0..2 typical)
  strength: 1.0,
  // motion speed
  rate: 0.20,
  // translation is in camera-local world units
  translate: { x: 1.2, y: 0.9, z: 0.4 },
  // rotation is radians
  rotate: { x: deg(0.55), y: deg(0.65), z: 0 },
});
worlds.camera.shake.setEnabled(true);

// Navigate to the first section, but keep our camera tilt.
worlds.camera.focusOnSectionFit(0, WORLDS_SECTION_FILL, { keepRotation: true });

gui.init();
buildTimedSections();

const tokens = gui.getTokens();
const panel = gui.createResponsivePanel({
  bounds: { x: 0, y: 0, width: 420, height: 520 },
  padding: tokens.spacing.lg,
  gap: tokens.spacing.sm,
  maxWidth: 460,
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content' }
});

const heading = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 28 },
  text: 'Depths Beckon',
  align: 'left',
  labelStyle: { typographyRole: 'title' },
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const status = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 20 },
  text: 'Synthetic transport running.',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const section = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 24 },
  text: 'Section: Somehweres in the New West',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const lyricLine = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 24 },
  text: '',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const time = gui.createLabel({
  bounds: { x: 0, y: 0, width: 1, height: 20 },
  text: 'Time: 0:00 / 0:30',
  align: 'left',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const seek = gui.createSlider({
  bounds: { x: 0, y: 0, width: 1, height: 48 },
  label: 'Scrub',
  min: 0,
  max: DEMO_DURATION_SEC,
  value: 0,
  step: 0.1,
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnPlay = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Play',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnPause = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Pause',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

const btnReset = gui.createButton({
  bounds: { x: 0, y: 0, width: 1, height: 40 },
  label: 'Reset',
  layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
});

panel
  .add(heading)
  .add(status)
  .add(section)
  .add(lyricLine)
  .add(time)
  .add(seek)
  .add(btnPlay)
  .add(btnPause)
  .add(btnReset);

panel.layout();

state.panel = panel;
state.widgets = { heading, status, section, lyricLine, time, seek, btnPlay, btnPause, btnReset };
state.startTime = getTime();
worlds.content?.clearAll?.();
```

```javascript on:input
if (!event) return;
if (event.type === 'keydown') {
  gui.handleKey(event.key, {
    shift: (event.mods || []).includes('shift'),
    ctrl: (event.mods || []).includes('ctrl'),
    alt: (event.mods || []).includes('alt'),
    meta: (event.mods || []).includes('meta')
  });
}
if (event.type === 'text') gui.handleText(event.text);
if (event.type === 'mouse') {
  if (event.button === 'left') state.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  gui.handleMouse(event.x, event.y, state.mouseDownLeft);
}
if (event.type === 'mouse_move') gui.handleMouse(event.x, event.y, state.mouseDownLeft);
```

```javascript on:update
if (!state.widgets) return;

if (state.panel) {
  const viewport = gui.getViewportRect();
  const info = gui.getResponsiveInfo({ width: viewport.width, height: viewport.height });
  const tokens = gui.getTokens();
  const compact = info.breakpoint === 'xs';
  const inset = compact ? tokens.spacing.sm : tokens.spacing.lg;
  const maxWidth = compact
    ? Math.max(300, Math.min(380, info.usableWidth || viewport.width))
    : Math.max(380, Math.min(460, info.usableWidth || viewport.width));

  state.panel.container.padding = compact ? tokens.spacing.md : tokens.spacing.lg;
  state.panel.container.gap = compact ? tokens.spacing.xs : tokens.spacing.sm;
  state.panel.setMaxWidth(maxWidth, false);
  state.panel.fitToViewport(viewport, {
    inset,
    safeArea: true,
    maxWidth,
    anchorX: 'start',
    anchorY: 'start'
  }, false);
  state.panel.layout();
}

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.btnPlay.wasClicked()) playDemo();
if (state.widgets.btnPause.wasClicked()) pauseDemo();
if (state.widgets.btnReset.wasClicked()) resetDemo(true);

const dragging = state.widgets.seek.isDragging?.() ?? false;
const livePos = getDemoTimeSec();
const previewPos = dragging ? clamp(state.widgets.seek.getValue(), 0, DEMO_DURATION_SEC) : livePos;

if (!dragging && state.wasSeeking) {
  setDemoTimeSec(clamp(state.widgets.seek.getValue(), 0, DEMO_DURATION_SEC));
}
if (!dragging) state.widgets.seek.setValue(livePos);
state.wasSeeking = dragging;

const sec = sectionAtMs(previewPos * 1000);
const secTitle = sec ? sec.title : '';
if (secTitle !== state.currentSection) {
  state.currentSection = secTitle;
  state.widgets.section.setText(`Section: ${secTitle || '(none)'}`);
  if (sec) {
    worlds.camera.focusOnSectionFit(sec.index, WORLDS_SECTION_FILL, { keepRotation: true });
  }
}

const newLine = lineAtTime(previewPos);
if (newLine !== state.currentLine) {
  state.currentLine = newLine;
  state.widgets.lyricLine.setText(newLine ? `Line: ${newLine}` : 'Line: (none)');
}

syncWorldsSectionContent(sec, previewPos);

state.widgets.time.setText(`${dragging ? 'Preview' : 'Time'}: ${fmtTime(previewPos)} / ${fmtTime(DEMO_DURATION_SEC)}`);
state.widgets.status.setText(
  dragging
    ? `Scrubbing ${fmtTime(previewPos)} — timed content should move cleanly between sections.`
    : (state.isPlaying ? 'Synthetic transport running.' : 'Paused — drag the scrubber or press Play.')
);
```

```timed name:lyrics
# ms|text
0|Dust rolls across the western road.
2000|A warning waits above the ruined gate.
4000|The dark keeps breathing just beyond the stone.
6000|The statues turn their hollow gaze toward you.
8000|Three silent sentries hold the hall in place.
10000|Blue crystal light begins to stain the dark.
12000|The chamber answers with a colder song.
14000|Ancient light gathers in the amulet and the walls.
16000|Far below, the guardian chamber starts to wake.
18000|Stone remembers every step that brought you here.
20000|The vault opens only after wisdom bends the blade.
22000|Gold and dust drift through the final room.
24000|The old legend settles into your hands.
26000|The newest lines remain while the rest fall away.
28000|Then the song loops back into the dust.
```

# Somehweres in the New West {"timed": "0ms"}
⠀
In a small town...

# Entrance Examine {"timed": "4000ms"}
⠀
You take a moment to inspect the entrance more carefully. Ancient runes are carved into the archway, worn smooth by centuries of wind and rain. You can barely make out what appears to be a warning:
⠀
*"Beware the guardian of the depths. Only the wise may pass."*
⠀
Beside the entrance, you notice an old iron sconce. It's empty, but appears functional.
⠀
- [Enter the ruins](#hall-of-statues)  
- [Take the sconce](#take-sconce)  
- [Go back](#entrance)

# Prepare Torch
⠀
You take time to properly prepare your torch, wrapping it with oil-soaked cloth from your pack. The flame burns brighter now, casting long shadows across the ancient stone.
⠀
*You feel more confident with better light.*
⠀
- [Enter the ruins](#hall-of-statues)  
- [Return to the entrance](#entrance)

```nim on:enter
hasTorch = true
torchQuality = "bright"
```

# Hall of Statues {"timed": "8000ms", "rotate-z": "17"}
⠀
You step into a vast hall supported by crumbling pillars. **Three stone statues** stand guard, each depicting a different warrior from a forgotten age. Their hollow eyes seem to follow you as you move.
⠀
Passages branch off in three directions:
- To the **north**, you hear the sound of rushing water
- To the **east**, a faint blue glow emanates from the darkness  
- To the **west**, you smell something acrid and unpleasant
⠀
The main entrance lies behind you.
⠀
- [Go north toward the water](#underground-river)  
- [Go east toward the blue glow](#crystal-chamber)  
- [Go west toward the smell](#alchemist-lab)  
- [Examine the statues](#examine-statues)  
- [Return to entrance](#entrance)

# Examine Statues
⠀
You approach the statues carefully. Each warrior is carved in exquisite detail:
⠀
The **first statue** holds a sword pointed downward, its face serene.  
The **second statue** clutches a shield, face twisted in rage.  
The **third statue** bears a broken chain, face sorrowful.
⠀
At the base of the third statue, you notice something glinting in the torchlight.
⠀
- [Take the glinting object](#find-key)  
- [Return to the hall](#hall-of-statues)

# Find Key
⠀
You reach down and pick up a small, tarnished **brass key**. It's surprisingly heavy for its size, and covered in the same ancient runes you saw at the entrance.
⠀
*This might unlock something important.*
⠀
[Return to the hall](#hall-of-statues)

```nim on:enter
hasKey = true
```

# Underground River
⠀
The passage opens into a cavern split by a **rushing underground river**. The water is black as ink and moves with frightening speed. A narrow stone bridge crosses the chasm, but it looks ancient and unstable.
⠀
On the far side, you can see a doorway carved into the rock.
⠀
- [Cross the bridge carefully](#cross-bridge)  
- [Search for another way](#search-riverbank)  
- [Return to the hall](#hall-of-statues)

# Cross Bridge
⠀
You step onto the stone bridge. It groans under your weight, and small chunks of stone crumble into the dark water below. Halfway across, you freeze as a loud **CRACK** echoes through the cavern.
⠀
But the bridge holds. Barely.
⠀
You make it to the other side, heart pounding.
⠀
- [Enter the carved doorway](#treasure-vault)  
- [Go back across (carefully)](#underground-river)

# Search Riverbank
⠀
You search along the riverbank, looking for another way across. Behind a fallen column, you discover an old rope tied to an iron ring. Following it up, you see it leads to a natural rock shelf that crosses above the river.
⠀
A safer path, if you're willing to climb.
⠀
- [Take the high route](#treasure-vault)  
- [Just use the bridge](#cross-bridge)  
- [Go back](#underground-river)

# Crystal Chamber {"timed": "12000ms"}
⠀
You follow the blue glow into a chamber filled with **luminescent crystals** growing from the walls and ceiling. They pulse with an eerie inner light, casting everything in shades of azure and violet.
⠀
In the center of the room stands a stone pedestal. Resting atop it is a beautiful **silver amulet**, set with a matching blue crystal.
⠀
The chamber has two other exits: one to the north and one continuing east.
⠀
- [Take the amulet](#take-amulet)  
- [Go north](#library)  
- [Continue east](#guardian-chamber)  
- [Return to the hall](#hall-of-statues)

# Take Amulet
⠀
You reach for the amulet. The moment your fingers touch the cold silver, the crystals around you **flare brilliantly**. You feel a surge of warmth spread through your body.
⠀
*The amulet pulses with protective magic.*
⠀
- [Go north](#library)  
- [Continue east](#guardian-chamber)  
- [Return to crystal chamber](#crystal-chamber)

```nim on:enter
hasAmulet = true
```

# Library
⠀
You enter what must have once been a library. Ancient books line rotting shelves, most crumbling to dust. In the center of the room, a single tome rests on a reading stand, somehow preserved.
⠀
You open the book. The pages are filled with riddles and wisdom of the ancients. One passage catches your eye:
⠀
*"The guardian seeks not strength, but humility. The warrior who bows is greater than one who strikes."*
⠀
- [Study more of the book](#library)  
- [Go south](#crystal-chamber)  
- [Go back to the hall](#hall-of-statues)

```nim on:enter
visitedLibrary = true
```

# Alchemist Lab
⠀
The acrid smell leads you to an old laboratory. Broken glass and ceramic vessels litter the floor. Strange stains mark the walls. Whatever happened here, it wasn't pleasant.
⠀
Among the debris, you find a workbench with several intact bottles. One contains a glowing green liquid labeled *"Essence of Light"* in faded script.
⠀
- [Take the essence](#take-essence)  
- [Search the room more carefully](#search-lab)  
- [Return to the hall](#hall-of-statues)

# Take Essence
⠀
You carefully pocket the glowing essence. It feels warm through the glass.
⠀
*This might prove useful.*
⠀
- [Search the room](#search-lab)  
- [Return to the hall](#hall-of-statues)

```nim on:enter
hasEssence = true
```

# Search Lab
⠀
Searching more carefully, you find the alchemist's journal beneath some rubble. The final entry reads:
⠀
*"My experiments with the guardian have failed. It cannot be destroyed, only understood. I leave this place to whatever fate awaits. May those who follow be wiser than I."*
⠀
- [Return to the laboratory](#alchemist-lab)  
- [Go to the hall](#hall-of-statues)

# Guardian Chamber {"timed": "18000ms"}
⠀
You enter a vast circular chamber. At its center stands a towering figure of **living stone**—the Guardian of Khel-Daran. Its eyes glow with ancient intelligence.
⠀
The Guardian speaks, its voice like grinding boulders:

*"Who dares disturb my eternal vigil? Prove your worth, or be destroyed!"*
⠀
Three pedestals surround the guardian, each marked with a symbol: **Sword**, **Shield**, and **Chains**.
⠀
- [Place an offering on the Sword pedestal](#guardian-fail)  
- [Place an offering on the Shield pedestal](#guardian-fail)  
- [Place an offering on the Chains pedestal](#guardian-success)  
- [Attack the guardian](#guardian-attack)  
- [Try to reason with the guardian](#guardian-reason)

# Guardian Attack
⠀
You draw your weapon and charge at the stone guardian. It doesn't even move.

Your blade strikes the living stone and **shatters**. The guardian's fist comes down like a falling boulder. Everything goes dark.
⠀
*Perhaps violence wasn't the answer.*
⠀
- [Try again?](#guardian-chamber)

# Guardian Reason
⠀
You lower your weapon and address the guardian with respect:

"I seek not to conquer, but to understand. I come in peace."
⠀
The guardian tilts its massive head, considering. Then it speaks:
⠀
*"Wisdom... rare among your kind. But words alone are insufficient. Show me you understand the truth of strength."*
⠀
- [Place something on a pedestal](#guardian-chamber)

# Guardian Fail
⠀
You place your offering on the pedestal. The guardian's eyes flare **angry red**.

*"You understand nothing! Strength and defense are the tools of the proud. True power lies in freedom and sacrifice!"*

The chamber begins to shake violently.
⠀
- [Run back](#crystal-chamber)  
- [Try a different pedestal](#guardian-chamber)

# Guardian Success
⠀
You approach the pedestal marked with broken chains and bow your head. The gesture of **humility and understanding** resonates through the chamber.
⠀
The guardian's eyes shift from threatening red to a calm **golden glow**.
⠀
*"You comprehend the ancient wisdom. Strength is nothing without the wisdom to bind it. You may pass."*
⠀
The guardian steps aside, revealing a passage to the **Treasure Vault**.
⠀
- [Enter the vault](#treasure-vault)

```nim on:enter
if visitedLibrary:
  draw(0, h-1, 0, w, 1, "Your knowledge from the library helped you understand!", "AlignCenter", "AlignTop", "WrapNone")
```

- [Enter the vault](#treasure-vault)

# Treasure Vault {"timed": "24000ms"}
⠀
You enter the fabled treasure vault of Khel-Daran. Gold coins spill across the floor, gems glitter in the light of your torch, and ancient weapons line the walls.
⠀
But your eyes are drawn to the center of the room, where a magnificent **sword** rests on an altar, bathed in a beam of light from above. This is the legendary **Blade of Khel-Daran**, said to have defended these lands centuries ago.
⠀
The inscription on the altar reads:
*"To those who brave the depths with wisdom and courage, this is your reward."*
⠀
**Congratulations! You have completed the adventure!**
⠀
- [Take the sword and leave](#victory)  
- [Explore the vault more](#treasure-vault)  
- [Return to the guardian](#guardian-chamber)

# Victory
⠀
You lift the Blade of Khel-Daran from its altar. The weapon feels perfectly balanced in your hand, and seems to **hum with ancient power**.
⠀
As you make your way back through the dungeon, you notice the guardian watching you with what might be... respect? The stone colossus bows its head slightly as you pass.
⠀
Emerging into the daylight, you shield your eyes against the sun. The ruins of Khel-Daran stand behind you, their secrets revealed.
⠀
**Your adventure is complete! You are victorious!**
⠀
*The legend of Khel-Daran will be told for generations.*
⠀
[Explore more endings?](#hall-of-statues)

# Take Sconce
⠀
You remove the iron sconce from the wall. It's heavier than it looks and has a wicked pointed end. In a pinch, this could serve as a makeshift weapon.
⠀
*Might be useful in the dark.*
⠀
- [Continue to the ruins](#hall-of-statues)  
- [Go back](#entrance-examine)

```nim on:enter
hasWeapon = true
```
