---
title: "Depths Beckon"
author: "Maddest Labs"
theme: "saintbilly"
font: "Rye"
shaders: "blurgradual+lightvignette"
---

```javascript on:init
// Camera styling helpers
const deg = d => d * Math.PI / 180;
const CAMERA_BASE_ROT = { x: deg(-11), y: deg(4), z: 0 };
worlds.enable();
worlds.config.setDefaults({
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionListMarker: '➵',
  sectionListMarkerGapPx: 12,
  sectionListHangIndentPx: 24,
  defaultSectionWidth: 900,
  defaultSectionHeight: 520,
  autoLayoutSpacing: 10,
  sectionBorderEnabled: false,
  sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.008;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',
});
worlds.camera.setPosition(0, 55, 320);
worlds.camera.setRotation(CAMERA_BASE_ROT.x, CAMERA_BASE_ROT.y, CAMERA_BASE_ROT.z);
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
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
```

# Entrance
⠀
You stand before the ancient ruins of **Khel-Daran**, a fortress swallowed by time and shadow. The stone archway before you exhales cold, stale air. Moss clings to the weathered pillars, and somewhere deep within, you hear the faint echo of water dripping.
⠀
Your torch flickers in the darkness. The adventure begins here.
⠀
**What do you do?**
⠀
- [Enter the ruins](#hall-of-statues)  
- [Examine the entrance more carefully](#entrance-examine)  
- [Light a better torch](#prepare-torch)

# Entrance Examine
⠀
You take a moment to inspect the entrance more carefully. Ancient runes are carved into the archway, worn smooth by centuries of wind and rain. 
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

# Hall of Statues {"rotate-z": "17"}
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

# Crystal Chamber
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

# Guardian Chamber
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

# Treasure Vault
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
