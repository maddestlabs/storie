---
title: "The Depths of Khel-Daran"
author: "Maddest Labs"
minWidth: 80
minHeight: 24
---

```lua global
canvas = require("canvas")
canvas.init()

-- Track player state
storyState = {
  hasTorch = false,
  hasKey = false,
  hasAmulet = false,
  visitedLibrary = false,
  knowsRiddle = false,
  torchQuality = "dim"
}
```

# entrance {"hidden": true}

You stand before the ancient ruins of **Khel-Daran**, a fortress swallowed by time and shadow. The stone archway before you exhales cold, stale air. Moss clings to the weathered pillars, and somewhere deep within, you hear the faint echo of water dripping.

Your torch flickers in the darkness. The adventure begins here.

**What do you do?**

- [Enter the ruins](hall_of_statues)  
- [Examine the entrance more carefully](entrance_examine)  
- [Light a better torch](prepare_torch)

# entrance_examine {"hidden": true, "removeAfterVisit": true}

You take a moment to inspect the entrance more carefully. Ancient runes are carved into the archway, worn smooth by centuries of wind and rain. You can barely make out what appears to be a warning:

*"Beware the guardian of the depths. Only the wise may pass."*

Beside the entrance, you notice an old iron sconce. It's empty, but appears functional.

- [Enter the ruins](hall_of_statues)  
- [Take the sconce](take_sconce)  
- [Go back](entrance)

# prepare_torch {"hidden": true, "removeAfterVisit": true}

You take time to properly prepare your torch, wrapping it with oil-soaked cloth from your pack. The flame burns brighter now, casting long shadows across the ancient stone.

*You feel more confident with better light.*

- [Enter the ruins](hall_of_statues)  
- [Return to the entrance](entrance)
```lua on:enter
storyState.hasTorch = true
storyState.torchQuality = "bright"
```

# hall_of_statues {"hidden": true}

You step into a vast hall supported by crumbling pillars. **Three stone statues** stand guard, each depicting a different warrior from a forgotten age. Their hollow eyes seem to follow you as you move.

Passages branch off in three directions:
- To the **north**, you hear the sound of rushing water
- To the **east**, a faint blue glow emanates from the darkness  
- To the **west**, you smell something acrid and unpleasant

The main entrance lies behind you.

- [Go north toward the water](underground_river)  
- [Go east toward the blue glow](crystal_chamber)  
- [Go west toward the smell](alchemist_lab)  
- [Examine the statues](examine_statues)  
- [Return to entrance](entrance)

# examine_statues {"hidden": true}

You approach the statues carefully. Each warrior is carved in exquisite detail:

The **first statue** holds a sword pointed downward, its face serene.  
The **second statue** clutches a shield, face twisted in rage.  
The **third statue** bears a broken chain, face sorrowful.

At the base of the third statue, you notice something glinting in the torchlight.

- [Take the glinting object](find_key)  
- [Return to the hall](hall_of_statues)

# find_key {"hidden": true, "removeAfterVisit": true}

You reach down and pick up a small, tarnished **brass key**. It's surprisingly heavy for its size, and covered in the same ancient runes you saw at the entrance.

*This might unlock something important.*

[Return to the hall](hall_of_statues)
```lua on:enter
storyState.hasKey = true
```

# underground_river {"hidden": true}

The passage opens into a cavern split by a **rushing underground river**. The water is black as ink and moves with frightening speed. A narrow stone bridge crosses the chasm, but it looks ancient and unstable.

On the far side, you can see a doorway carved into the rock.

- [Cross the bridge carefully](cross_bridge)  
- [Search for another way](search_riverbank)  
- [Return to the hall](hall_of_statues)

# cross_bridge {"hidden": true}

You step onto the stone bridge. It groans under your weight, and small chunks of stone crumble into the dark water below. Halfway across, you freeze as a loud **CRACK** echoes through the cavern.

But the bridge holds. Barely.

You make it to the other side, heart pounding.

- [Enter the carved doorway](treasure_vault)  
- [Go back across (carefully)](underground_river)

# search_riverbank {"hidden": true}

You search along the riverbank, looking for another way across. Behind a fallen column, you discover an old rope tied to an iron ring. Following it up, you see it leads to a natural rock shelf that crosses above the river.

A safer path, if you're willing to climb.

- [Take the high route](treasure_vault)  
- [Just use the bridge](cross_bridge)  
- [Go back](underground_river)

# crystal_chamber {"hidden": true}

You follow the blue glow into a chamber filled with **luminescent crystals** growing from the walls and ceiling. They pulse with an eerie inner light, casting everything in shades of azure and violet.

In the center of the room stands a stone pedestal. Resting atop it is a beautiful **silver amulet**, set with a matching blue crystal.

The chamber has two other exits: one to the north and one continuing east.

- [Take the amulet](take_amulet)  
- [Go north](library)  
- [Continue east](guardian_chamber)  
- [Return to the hall](hall_of_statues)

# take_amulet {"hidden": true, "removeAfterVisit": true}

You reach for the amulet. The moment your fingers touch the cold silver, the crystals around you **flare brilliantly**. You feel a surge of warmth spread through your body.

*The amulet pulses with protective magic.*

- [Go north](library)  
- [Continue east](guardian_chamber)  
- [Return to crystal chamber](crystal_chamber)
```lua on:enter
storyState.hasAmulet = true
```

# library {"hidden": true}

You enter what must have once been a library. Ancient books line rotting shelves, most crumbling to dust. In the center of the room, a single tome rests on a reading stand, somehow preserved.

You open the book. The pages are filled with riddles and wisdom of the ancients. One passage catches your eye:

*"The guardian seeks not strength, but humility. The warrior who bows is greater than one who strikes."*

- [Study more of the book](library)  
- [Go south](crystal_chamber)  
- [Go back to the hall](hall_of_statues)
```lua on:enter
storyState.visitedLibrary = true
storyState.knowsRiddle = true
```

# alchemist_lab {"hidden": true}

The acrid smell leads you to an old laboratory. Broken glass and ceramic vessels litter the floor. Strange stains mark the walls. Whatever happened here, it wasn't pleasant.

Among the debris, you find a workbench with several intact bottles. One contains a glowing green liquid labeled *"Essence of Light"* in faded script.

- [Take the essence](take_essence)  
- [Search the room more carefully](search_lab)  
- [Return to the hall](hall_of_statues)

# take_essence {"hidden": true, "removeAfterVisit": true}

You carefully pocket the glowing essence. It feels warm through the glass.

*This might prove useful.*

- [Search the room](search_lab)  
- [Return to the hall](hall_of_statues)
```lua on:enter
storyState.hasEssence = true
```

# search_lab {"hidden": true, "removeAfterVisit": true}

Searching more carefully, you find the alchemist's journal beneath some rubble. The final entry reads:

*"My experiments with the guardian have failed. It cannot be destroyed, only understood. I leave this place to whatever fate awaits. May those who follow be wiser than I."*

- [Return to the laboratory](alchemist_lab)  
- [Go to the hall](hall_of_statues)

# guardian_chamber {"hidden": true}

You enter a vast circular chamber. At its center stands a towering figure of **living stone**—the Guardian of Khel-Daran. Its eyes glow with ancient intelligence.

The Guardian speaks, its voice like grinding boulders:

*"Who dares disturb my eternal vigil? Prove your worth, or be destroyed!"*

Three pedestals surround the guardian, each marked with a symbol: **Sword**, **Shield**, and **Chains**.

- [Place an offering on the Sword pedestal](guardian_fail)  
- [Place an offering on the Shield pedestal](guardian_fail)  
- [Place an offering on the Chains pedestal](guardian_success)  
- [Attack the guardian](guardian_attack)  
- [Try to reason with the guardian](guardian_reason)

# guardian_attack {"hidden": true}

You draw your weapon and charge at the stone guardian. It doesn't even move.

Your blade strikes the living stone and **shatters**. The guardian's fist comes down like a falling boulder. Everything goes dark.

*Perhaps violence wasn't the answer.*

- [Try again?](guardian_chamber)

# guardian_reason {"hidden": true}

You lower your weapon and address the guardian with respect:

"I seek not to conquer, but to understand. I come in peace."

The guardian tilts its massive head, considering. Then it speaks:

*"Wisdom... rare among your kind. But words alone are insufficient. Show me you understand the truth of strength."*

- [Place something on a pedestal](guardian_chamber)

# guardian_fail {"hidden": true}

You place your offering on the pedestal. The guardian's eyes flare **angry red**.

*"You understand nothing! Strength and defense are the tools of the proud. True power lies in freedom and sacrifice!"*

The chamber begins to shake violently.

- [Run back](crystal_chamber)  
- [Try a different pedestal](guardian_chamber)

# guardian_success {"hidden": true}

You approach the pedestal marked with broken chains and bow your head. The gesture of **humility and understanding** resonates through the chamber.

The guardian's eyes shift from threatening red to a calm **golden glow**.

*"You comprehend the ancient wisdom. Strength is nothing without the wisdom to bind it. You may pass."*

The guardian steps aside, revealing a passage to the **Treasure Vault**.

- [Enter the vault](treasure_vault)
```lua on:enter
if storyState.knowsRiddle then
  -- Player read the library book
end
```

# treasure_vault {"hidden": true}

You enter the fabled treasure vault of Khel-Daran. Gold coins spill across the floor, gems glitter in the light of your torch, and ancient weapons line the walls.

But your eyes are drawn to the center of the room, where a magnificent **sword** rests on an altar, bathed in a beam of light from above. This is the legendary **Blade of Khel-Daran**, said to have defended these lands centuries ago.

The inscription on the altar reads:
*"To those who brave the depths with wisdom and courage, this is your reward."*

**Congratulations! You have completed the adventure!**

- [Take the sword and leave](victory)  
- [Explore the vault more](treasure_vault)  
- [Return to the guardian](guardian_chamber)

# victory {"hidden": true}

You lift the Blade of Khel-Daran from its altar. The weapon feels perfectly balanced in your hand, and seems to **hum with ancient power**.

As you make your way back through the dungeon, you notice the guardian watching you with what might be... respect? The stone colossus bows its head slightly as you pass.

Emerging into the daylight, you shield your eyes against the sun. The ruins of Khel-Daran stand behind you, their secrets revealed.

**Your adventure is complete! You are victorious!**

*The legend of Khel-Daran will be told for generations.*

[Explore more endings?](hall_of_statues)

# take_sconce {"hidden": true, "removeAfterVisit": true}

You remove the iron sconce from the wall. It's heavier than it looks and has a wicked pointed end. In a pinch, this could serve as a makeshift weapon.

*Might be useful in the dark.*

- [Continue to the ruins](hall_of_statues)  
- [Go back](entrance_examine)
```lua on:enter
storyState.hasWeapon = true
```