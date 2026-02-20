---
title: "t|HΞR Voice"
author: "Maddest Labs"
theme: "neonopia"
hideHeadings: "true"
hideSections: "true"
fontsize: 20
crewMorale: 50
rainLevel: 0.0
---

```javascript on:init
worlds.enable();
console.log('✓ 3D Canvas enabled!');
worlds.config.setDefaults({
  defaultSectionWidth: 100,        // Default width
  defaultSectionHeight: 24,       // Default height
  autoLayoutSpacing: 150,         // Spacing between auto-laid-out sections (world units)
  sectionBorderEnabled: false,     // Draw a border around each section card
  sectionBackground: 'bg',   // Section card background: 'surface' | 'bg' | 'bgAlt' | 'accent1' | '#RRGGBB' | 0xRRGGBBAA
});
worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 10, 0.5);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSection(0, 50);
```

# Awake
⠀
You wake gasping.
⠀
A voice—feminine, breathy, singing—calls from impossible distance. In the dream, a city of rain and light beckons you. But the *Meridian* groans around you, dying. Metal cooling. Fluids dripping.
⠀
Kess moves through darkness checking heads. Five crew. Everyone breathing. Not everyone whole.
⠀
The dream lingers. The voice lingers.
⠀
- [What's our status?](#assess-damage)
- [Where are we?](#question-location)

```js on:enter
crewMorale = 45;
```

# Assess Damage
⠀
The crash site is a tomb. Twisted corridors. Broken systems. In the engine room, Dax sits against a bulkhead, holding his ribs. Something's cracked inside him.
⠀
"I'll live," he mutters.
⠀
The engines are scrap. Fuel cells ruptured. No beacon. No rescue signal. The *Meridian* won't fly again.
⠀
You move to the navigation console. One file survives the corruption: coordinates labeled simply **"HER."**
⠀
- [Plan with Kess](#plan-with-kess)

```js on:enter
crewMorale = 40
```

# Plan with Kess
⠀
Kess is moving through the main cabin distributing rations. Her face is stone cold.
⠀
"Enough for a week if we're strict. There's a city marked here. 4-5 days on foot through that wasteland out there."
⠀
She points to the viewport. Concrete plains. Gray sky. Ruins stretching endlessly.
⠀
"We move at first light. Travel light. Travel quiet. This zone exists for a reason, and it's not good."
⠀
- [Head out at dawn](#day-one)
- [Explore the crash site first](#explore-crash)

# Question Location
⠀
You pull Kess aside. Her expression darkens.
⠀
"The trajectory was wrong. Navigation got hijacked or the charts were compromised." She glances at the wasteland. "There are rumors. Resistance channels mentioned a place called 'Her' — a megacity where they test control systems."
⠀
She meets your eyes. "We need to be very careful."
⠀
- [Prepare to move](#plan-with-kess)

# Day One
⠀
The first day, hope is swallowed in a desolate landscape.
⠀
Concrete plains. Dead factories. Residential blocks in various states of collapse. Everything gray. Everything silent. The system broadcasts insisted the world was cultivated, content, controlled.
⠀
You're seeing the lie. You're in the place the system pretends doesn't exist.
⠀
Dax struggles to keep pace. His fever is rising.
⠀
- [Continue walking](#day-two)

```js on:enter
crewMorale = 35
rainLevel = 5.0
```

# Day Two
⠀
By the second day, you wish you were back in the system.
⠀
The rain starts — not a downpour, just constant, merciless drizzle that soaks everything and makes the ground slick. Your clothes are damp. Your skin is damp. Everything is damp.
⠀
Marta remarks quietly: "It always rains here."
⠀
She's right. The rain feels permanent. Almost intentional.
⠀
"Didn't you know? It always rains in Dystopia," Kess comments.
⠀
- [Press on](#day-three)

```js on:enter
rainLevel = 30.0
```

# Day Three
⠀
Dax is worse. His fever climbs. He moves slower. The group tightens rations. The remaining supplies from the *Meridian* dwindle faster than expected.
⠀
The landscape remains unchanging. As if you're walking in circles. As if the city is keeping you at a distance, testing your resolve before allowing you closer.
⠀
The voice from your dream whispers at the edge of awareness. Almost subliminal.
⠀
- [Keep moving](#day-four)

# Day Four
⠀
On the evening of the fourth day, exhaustion settles into your bones like sediment. The rain intensifies. Your visibility drops.
⠀
Then you see it ahead.
⠀
A structure still standing. Windows intact. Power flowing to its lights. In the middle of a dead zone. With electricity. Impossible.
⠀
Kess stops the group. Her hand moves to her weapon. "No structure should have independent power out here."
⠀
- [Approach cautiously](#cautious-approach)
- [Camp here instead](#camp-distance)

# Cautious Approach
⠀
A neon sign flickers pink. "Laundromat". Warm light spills through glass doors. Inside: rows of machines with clothes strewn about. The mundane infrastructure of ordinary life in a dead world.
⠀
The surrounding buildings are hollowed. Windows are empty sockets. Doors hang at wrong angles. The system erases inconvenient zones. Inconvenient people. This building is a ghost of what was—but it still lives.
⠀
Kess scans the interior carefully before signaling you forward.
⠀
- [Enter the laundromat](#inside-laundromat)

# Inside Laundromat
⠀
Inside: warmth. Dry air. Humming machines cycling through their routines. No people visible. No signs of recent habitation.
⠀
On a bench: a journal. Sketches. Maps of the city. Observations about "the Voice." Warnings about towers. References to "Station V."
⠀
Dax sinks onto a bench, fever making him docile. The warmth helps. Kess photographs pages carefully with an old camera—nothing digital that could be traced.
⠀
Behind the machines, you notice a door marked "Maintenance."
⠀
- [Check the back room](#maintenance-room)
- [Rest here with the others](#rest-here)

```js on:enter
crewMorale += 10
```

# Maintenance Room
⠀
Behind the door: a small room. At its center, a power conduit. Jury-rigged but functional. It runs from somewhere buried beneath the laundromat, splitting into multiple directions.
⠀
This power source shouldn't exist. The government controls all infrastructure. But this is independent. Defiant. Someone maintains this space. Someone wants this laundromat alive.
⠀
Kess examines it with a grim expression. "Resistance. Or fragments of it. A network keeping safe spaces alive in the dead zones."
⠀
- [Return to the main room](#rest-here)

# Rest Here
⠀
Kess gathers the crew. "Two hours rest. Then we move toward the city."
⠀
You find yourself staring at the washing machines. Their rhythm is hypnotic. Almost meditative. Then the voice comes—not external, but inside your head.
⠀
*You are safe here. You are valued. You are home.*
⠀
For a moment, you believe it absolutely. Then Kess grabs your shoulder, snapping you back to reality. She's terrified.
⠀
"Whatever's in that city, it's reaching out. The Voice is here. We need to move. Now."
⠀
- [Head toward the city](#city-approach)

```js on:enter
crewMorale = 25
```

# City Approach
⠀
The transition from wasteland to civilization is gradual, then sudden. Abandoned buildings become maintained structures. Power lines multiply. The rain intensifies.
⠀
Then you see it.
⠀
Brutalist towers of concrete and dark glass rise from rain-soaked earth. Some towers disappear into cloud cover. Impossible architecture. Overwhelming presence.
⠀
Beneath it all, that voice again. Louder now. Broadcast outward but also seemingly in your skull.
⠀
*You are valued. You are appreciated.*
⠀
- [Find shelter before entering](#find-shelter)
- [Enter the city](#city-entrance)

```js on:enter
crewMorale = 20
```

# City Entrance
⠀
People move through the streets with purpose but without energy. Everyone has the implant—visible port behind their left ear. Everyone is listening to something invisible.
⠀
You pass a monolithic building. Sign reads: "Human Resource Center - Daily Affirmation Sessions 9AM to 8PM." Through windows: people in meditation posture, eyes closed, faces peaceful.
⠀
The Voice speaks directly into their skulls. Tells them they're valued, safe, loved. Lies they desperately want to believe.
⠀
Your crew is conspicuous. Wrong clothes. Wrong bearing. Implants without proper status markers.
⠀
You need to disappear quickly.
⠀
- [Find Kess's contact](#find-contact)

# Find Contact
⠀
Kess leads through back streets. Her movements are practiced. She's been here before. The contact is in what she calls the "Marginal Zones"—areas that exist but aren't officially listed.
⠀
A ground-floor apartment. An unmarked door. Kess knocks.
⠀
When it opens: an old man. Sharp eyes. Intelligence burning behind them. Something like defiance in his posture.
⠀
"Kess," he says, and smiles. "It's been a long time."
⠀
"Marcus," Kess responds. "We need shelter. Answers."
⠀
He ushers you inside quickly.
⠀
- [Listen to Marcus](#marcus-begins)

```js on:enter
crewMorale = 35
```

# Marcus Begins
⠀
His apartment is crammed with contraband. Physical books. Pre-government recordings. Photographs of a city that was different. Alive.
⠀
Marcus moves among his collection like a priest tending a shrine.
⠀
"I remember when this city was alive," he says quietly. "Before the Voice. Before the government. Artists. Musicians. People who made things for joy. Real joy, not the artificial kind the Voice provides."
⠀
He turns to face you directly.
⠀
- [Ask about the Voice](#ask-voice)
- [Ask about Station V](#ask-station)

# Ask Voice
⠀
"The government came slowly at first," Marcus explains. "Public safety programs. Social optimization. Mental health support. Everyone was tired. Ready to let someone else decide."
⠀
He pauses meaningfully.
⠀
"Then the implants. Just communication devices, they said. Just coordination. But it was access. Access to the part of your mind that decides what you want. Who you are. Once they had that, they shaped it. Gently. Kindly. The Voice tells you good things. Makes you feel loved. But it also tells you not to remember. Not to ask questions."
⠀
- [Ask about Station V](#ask-station)

# Ask Station
⠀
"Station V," Marcus says grimly. "The central system. Where the Voice originates. Where the control algorithms run. If you want to survive—if you want to do anything—you need to understand Station V."
⠀
He moves to a hidden panel. Pulls it back. A terminal glows faintly. Offline. Not connected.
⠀
"Station V is sealed. Protected. Guarded. In the highest tower. The one that reaches beyond the rain."
⠀
Then: sirens. Distant but growing closer.
⠀
- [Hide or flee?](#sirens-approach)

# Sirens Approach
⠀
The sirens stop suddenly. Worse than when they were wailing. Silence is more ominous than noise.
⠀
Marcus doesn't flinch. His hand moves toward a concealed compartment.
⠀
"There's a way out. Through the maintenance tunnels beneath the city. They connect to the utility core. Station V is accessible from there. But you have to go now."
⠀
He hands you a data drive. "Maps. Schematics. Everything I could gather."
⠀
A soft knock at the door. Polite. Terrifying in its politeness.
⠀
- [Flee through the tunnels](#maintenance-tunnels)

# Maintenance Tunnels
⠀
The tunnels are dark. Older than the city above. Remnants of something else. Repurposed and adapted for modern systems.
⠀
Marcus moves with practiced ease. He knows these paths well. Has used them before. Many times.
⠀
"Station V is at the apex of the utility core," he explains quietly. "The government sealed the main entrances, but they can't seal the service conduits without disrupting the system. These tunnels connect to them."
⠀
The air grows cooler. You hear water in pipes. Machinery humming. The sound of vast systems performing their functions.
⠀
- [Continue through the tunnels](#deep-tunnels)

# Deep Tunnels
⠀
After what feels like hours, you reach a grate. Through it: a massive space. Equipment. Humming with power and purpose.
⠀
The core systems. The heart of the city.
⠀
Marcus stops. His expression is heavy with meaning.
⠀
"This is as far as I can take you. What happens next is your choice. But understand: if you destroy Station V, you destroy the Voice holding this entire city. What happens after—no one knows."
⠀
He looks at each of you.
⠀
"Are you ready?"
⠀
- [Enter the core](#enter-core)

# Enter Core
⠀
**[SYSTEMS BREACHED]**
⠀
Inside: terrible order. Glass chambers everywhere. Hundreds of them in geometric patterns. Inside each chamber: neural monitoring systems. Signal amplifiers. Data storage so dense it hums with barely-contained power.
⠀
Kess runs diagnostics through an old device. Her expression darkens with each result.
⠀
"The Voice isn't centralized," she whispers. "It's distributed. Every chamber is a relay. Every piece of equipment is networked. Destroying one does nothing. We need the center."
⠀
Then: a voice.
⠀
"There is a center."
⠀
- [Who's speaking?](#who-speaks)

# Who Speaks
⠀
A figure emerges from the shadows. Tall. Dark-clothed. Face hidden.
⠀
Your hand moves to your weapon. Government agent, you think.
⠀
The figure removes their hood.
⠀
The face is scarred. Badly. Burned. Healed wrong. But the eyes are human. Intelligent. Filled with something—hope or delusion, you can't yet tell.
⠀
"Station V," the figure says. "Central processing. Destroy that, the network becomes inert. The Voice goes silent."
⠀
"And the city?" Kess asks.
⠀
"Becomes free."
⠀
- [Trust this figure](#trust-figure)
- [Demand answers](#demand-answers)

# Trust Figure
⠀
"I'm Del," the figure says. "Former city engineer. Before the government. Before the Voice. I built this place when it was supposed to be a city of innovation. A free city in a controlled world."
⠀
Del moves through the chamber network with practiced ease.
⠀
"The government saw it as a test bed. A perfect place to experiment with control systems before rolling them out everywhere. Station V is at the apex. In the highest tower. It's not just processing—it's administration."
⠀
Del stops at a checkpoint.
⠀
"Someone's in charge up there. Someone who volunteered for it."
⠀
- [Ask about the administrator](#ask-administrator)

# Ask Administrator
⠀
"A woman named Aria," Del says. "Former mayor. Before mayors were elected by Voice consensus. She volunteered for the position. The Voice offered her something. Power. Certainty. Purpose."
⠀
Del moves forward through the checkpoints. They open for them as if expected.
⠀
"She took it, and it took her. Now she's more linked to the system than human. Neural integration is almost complete. Her consciousness is distributed across the entire city."
⠀
Ahead: a lift. Massive. Glass. Reaching upward into darkness.
⠀
"This is it," Del says. "The lift to Station V."
⠀
- [Enter the lift](#lift-up)

# Demand Answers
⠀
"Why should we trust you?" you demand. "How do we know you're not government?"
⠀
Del doesn't react defensively. Just nods.
⠀
"You don't. But I'm offering you a choice: trust me and possibly die trying to stop this, or leave this chamber and slowly watch the Voice erase what's left of your free will."
⠀
Del pulls back their sleeve. Neural ports. Crude. Painful-looking.
⠀
"I was interfaced once. I know what they do. I know what it costs. That's enough trust for you?"
⠀
Kess nods slowly. "We move with Del."
⠀
- [Move through the core](#trust-figure)

# Lift Up
⠀
The lift is massive. Reinforced glass. Designed to intimidate. Designed to remind you that you're ascending to something vast and powerful. To make you feel small.
⠀
It works.
⠀
As the lift rises, the city falls away beneath you. Rain-soaked streets become patterns. Buildings become geography. People become statistics. Higher. Higher. Endlessly higher.
⠀
And as you rise, the Voice gets louder.
⠀
*You are valued. You are home. You are part of something greater.*
⠀
It's harder to resist here. The signal is clearest. For a moment, you almost want to believe.
⠀
Then the lift stops.
⠀
The doors open onto Station V.
⠀
- [Enter Station V](#station-v_enter)

```js on:enter
crewMorale = 15
```

# Station V Enter
⠀
**[HUSH]**
⠀
Silence. Not quiet. Silence. The absence of sound.
⠀
But beneath it you feel the Voice—not heard but felt. Resonating through bones. Through structure. Through the architecture itself.
⠀
At the center of the chamber, suspended in neural interfaces: a figure.
⠀
Her name is Aria.
⠀
She was beautiful once. The bone structure shows it. But the machinery is extensive. Neural ports across her skull. Sensory deprivation suit wired with thousands of connections. Her eyes are closed. Atrophied.
⠀
She is the Voice.
⠀
Literally. Her mind networked directly to the apparatus. Her consciousness distributed across the entire city.
⠀
- [Examine the systems](#examine-systems)

# Examine Systems
⠀
"She cannot be disturbed," Del whispers. "Any sudden input. Any loud sound. Sensory shock could cause catastrophic failure. Her neural integration is too complete. The system would collapse if she's damaged."
⠀
Kess approaches the control interfaces. Her fingers move across displays. Downloading. Analyzing. Finding the architecture of the Voice.
⠀
"We can disable her from here," Kess says quietly. "Shut down the neural linkage. It would take time, but—"
⠀
A sound.
⠀
Not loud. Barely a whisper. But in the silence, it's catastrophic.
⠀
Aria's eyes snap open.
⠀
She *screams*.
⠀
- [What happens next?](#aria-awakens)

```js on:enter
crewMorale = 5
```

# Aria Awakens
⠀
It's not a human scream. It's the sound of a system overloading. Of something too vast and networked to be human experiencing pain in every direction simultaneously.
⠀
Aria thrashes in her neural harness. The systems around her spike. Lights flare. Alarms shriek through Station V.
⠀
The whole city convulses with her agony.
⠀
"Run!" Del shouts.
⠀
The former mayor's eyes fix on you. Not seeing. Not thinking. Just reacting. A creature more system than woman now. Triggered. Hunting instinctively.
⠀
- [Flee Station V](#flee-station)

# Flee Station
⠀
You run through endless chambers. Through corridors that multiply. Behind you: sounds. Movement. Something broken and vast moving through the darkness.
⠀
Del guides you. Knows every passage. The emergency conduits. The ancient tunnels. You descend deeper. Down and down and down into the city's hidden spaces.
⠀
The sounds fade. Distant now. But not gone.
⠀
The tunnel opens. Light ahead. Unreal. Impossible.
⠀
You emerge into another destroyed cityscape. Another wasteland. But this one feels different.
⠀
Alive with possibility.
⠀
- [What now?](#aftermath)

# Aftermath
⠀
**[WHO WILL SAVE US]**
⠀
The crew collapses, breathing hard. Station V still hums above you, but the signal is weaker. Fractured. Damaged beyond immediate repair.
⠀
You've broken something fundamental.
⠀
Despair is heavy. The Voice may be broken, but Station V still stands. The government still controls the city above. What did you actually accomplish? What did you sacrifice?
⠀
Rain falls. Or maybe it never stopped.
⠀
Then one of you notices something. In the distant rubble. Movement. Small. Quick.
⠀
A dog. Alive. Free. Darting through the rain toward a faint light in the darkness.
⠀
Kess looks at you. Something flickers across her face. Not hope exactly. But conviction. Possibility.
⠀
"Come on," she says.
⠀
And you move. Toward the light. Toward the dog. Toward whatever comes next.
⠀
**END OF CHAPTER ONE**
⠀
- [Begin again](#opening)