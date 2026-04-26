---
name: "Saint Billy"
title: "Saint Billy"
author: "Maddest Labs"
orientation: landscape
theme: "saintbilly"
shaders: "audioshake+vintage"
font: "Rye"
authoringCheck: explicit-conditionals
---

```javascript on:init
const deg = d => d * Math.PI / 180;
const CAMERA_BASE_ROT = { x: deg(-19), y: deg(-3), z: 0 };
worlds.enable();
worlds.config.setDefaults({
  autoHideSectionsUntilVisited: true,
  sectionRender: 'content',
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionContentAlign: 'center',
  defaultSectionWidth: 400,
  defaultSectionHeight: 240,
  autoLayoutSpacing: 2,
  sectionBorderEnabled: false,
  sectionBackground: 'texture:assets/img/paper_crumpled.jpg;tilePx=400;contentDistort=0.01;paperPlaneZ=focus;overlay=assets/img/saintbilly-west-texas.svg;overlayBlend=multiply;overlayOpacity=0.45;overlayFit=cover',
});

worlds.camera.setPosition(0, 55, 320);
worlds.camera.setRotation(CAMERA_BASE_ROT.x, CAMERA_BASE_ROT.y, CAMERA_BASE_ROT.z);
worlds.camera.setFOV(deg(42));
worlds.camera.setEaseSpeed(0.18, 0.12);

worlds.camera.shake.setParams({
  strength: 0.8,
  rate: 0.20,
  translate: { x: 1.2, y: 0.9, z: 0.4 },
  rotate: { x: deg(0.55), y: deg(0.65), z: 0 },
});
worlds.camera.shake.setEnabled(true);

worlds.camera.focusOnSectionFit(0, WORLDS_SECTION_FILL, { keepRotation: true });

// Navigate to the first section, but keep our camera tilt.
worlds.camera.focusOnSectionFit(0, 0.9, { keepRotation: true });
```

# Ash At Sundown
⠀
The sun is bleeding out over the New West when you rein up above **Mercy's End**. The town lies low in the dust, church steeple black against a red sky, river shining like a knife beyond it.
⠀
Six years ago, **Saint Billy** and his riders came to your family ranch at Holt Crossing and killed every soul there in cold blood. He was a legend even then: the quickest draw in three territories, an outlaw who shot to kill and hurt for fun.
⠀
You did not come for a song. You came to hunt him down.
⠀
- [Ride into Mercy's End](#mercys-end)  
- [Climb to your family's graves](#family-ridge)  
- [Follow Billy's old outlaw trail](#old-trail)

# Family Ridge
⠀
The ridge above town holds a small graveyard fenced in warped cedar. Your family's plot sits at the far end, six stones in a row, the dirt long settled hard by wind and years.
⠀
Someone has left fresh white lilies there.
⠀
Not weeds. Not wildflowers. Lilies, careful and clean, with a hand-carved wooden cross pressed into the soil.
⠀
- [Turn the cross over](#cross-at-graves)  
- [Kneel and remember their names](#grave-vow)  
- [Ride down into town](#mercys-end)

# Cross At Graves
⠀
You turn the cross in your hand. Burned into the back are the words:
⠀
*"Vengeance is mine; I will repay, saith the Lord."*
⠀
Below the verse is a single rough initial: **B**.
⠀
The wood is stained darker near the bottom, as if it once stood in wet earth while somebody stayed kneeling a long time.
⠀
- [Pocket the cross and ride to town](#mercys-end)  
- [Go after the old outlaw trail](#old-trail)  
- [Stay a while longer at the graves](#grave-vow)

# Grave Vow
⠀
You kneel in the dust and say their names aloud until the wind carries them off: your mother, your father, your brothers, your little sister.
⠀
The last time you stood here, you swore Billy would die afraid.
⠀
Tonight, with the grave dirt under your hand and the church bell far below, the oath still feels alive. It just no longer feels simple.
⠀
- [Ride into Mercy's End](#mercys-end)  
- [Follow the old trail before dark](#old-trail)

# Old Trail
⠀
West of town the mesquite opens onto a half-buried campfire ring, shotgun shells, and the charred bones of a long-abandoned outlaw camp. Saint Billy's old gang used to water their horses here before riding into Holt Crossing.
⠀
You find newer tracks too: three riders, heavy mounts, careless boot scrapes. Someone scratched a warning into the shale with a knife point:
⠀
*BILLY SOLD OUT THE LIFE.*
⠀
The men hunting him now are not lawmen. They are leftovers from the blood-soaked days, and they want their saint dead for turning away from them.
⠀
- [Follow the riders into the canyon](#canyon-trail)  
- [Cut back toward town and the church](#mercys-end)  
- [Ride to the family graves first](#family-ridge)

# Canyon Trail
⠀
The trail narrows between red stone walls and opens onto Billy's old hideout: a cave blackened by old cookfires and marked with bullet scars. The place stinks of stale tobacco and bitter memory.
⠀
You hear voices farther up the wash.
⠀
Three men are talking around a mule lantern. Red Knives riders. They say Billy's getting baptized at **Cottonwood Ford** by moonrise. They laugh about waiting until the prayers are done before they start killing.
⠀
One of them spits and says, "Saint Billy used to bring the pain. Now he wants to ease it."
⠀
- [Race to Cottonwood Ford](#cottonwood-ford)  
- [Climb the old bell tower and watch the river](#bell-tower)  
- [Circle back to town for more answers](#mercys-end)

# Mercys End
⠀
Mercy's End is the sort of town that looks half built and half survived. Storefronts lean tired into one another. A church bell hangs over the main road. The people watch you the way townsfolk watch strangers who might be trouble or justice.
⠀
Three places still have lamplight in them.
⠀
- [Go into the Last Lantern saloon](#last-lantern)  
- [Step onto the sheriff's porch](#sheriffs-porch)  
- [Walk toward the brush chapel](#brush-chapel)

# Last Lantern
⠀
The Last Lantern smells of dust, coffee, and old fear. Conversation dies when you ask about Saint Billy.
⠀
The barkeep wipes a glass and studies you. "If you're here to hear a ballad, you came late. If you're here to settle blood, you came right on time."
⠀
He tells you Billy once drank here with killers stacked shoulder to shoulder around him, all of them begging him to do his thing. Now Billy comes in only for flour, lamp oil, and medicine. He does not touch whiskey. He does not laugh. He pays cash for widows who cannot.
⠀
- [Ask about Holt Crossing](#saloon-ledger)  
- [Ask where Billy sleeps](#widow-ortega)  
- [Leave for the sheriff's porch](#sheriffs-porch)

# Saloon Ledger
⠀
Without a word, the barkeep slides you an old ledger. Half the town owes something in it.
⠀
On one brittle page, in a hand heavy enough to scar the paper, is a line item that makes your throat close:
⠀
*Burial costs for the dead at Holt Crossing. Paid in full.*
⠀
Under it is one name: **Billy**.
⠀
"Didn't make him innocent," the barkeep says. "Just made him unable to run from what he'd done."
⠀
- [Go to the brush chapel](#brush-chapel)  
- [Go to the widow's porch](#widow-ortega)  
- [Head for the river](#cottonwood-ford)

# Sheriffs Porch
⠀
The sheriff is old enough to remember when Saint Billy's name made grown men bolt their doors before sundown. His star is polished. His eyes are not.
⠀
He points to a faded wanted poster nailed beside the office door. Billy's younger face glares out from under a black hat, beautiful and cruel.
⠀
"He came back and surrendered two years ago," the sheriff says. "Told me to chain him if I had the stomach. I did. Town near tore the jail down trying to reach him. Judge never arrived. Fever took him on the road. Since then Billy's been living like a man waiting for a sentence God hasn't finished speaking."
⠀
- [Take your father's rifle from the evidence rack](#take-fathers-rifle)  
- [Ask where Billy can be found tonight](#cottonwood-ford)  
- [Leave for the chapel](#brush-chapel)

# Take Fathers Rifle
⠀
The sheriff unlocks a warped cabinet and lifts down a long rifle wrapped in canvas. You know the worn groove on the stock before he says a word.
⠀
Your father cut that notch himself for his trigger hand.
⠀
"I kept it from Holt Crossing," the sheriff says. "Figured family ought to decide what kind of ending this story gets."
⠀
The rifle is clean, loaded, and heavier than grief should be.
⠀
- [Ride to Cottonwood Ford](#cottonwood-ford)  
- [Walk to the brush chapel](#brush-chapel)  
- [Go back into town](#mercys-end)

# Brush Chapel
⠀
The brush chapel is no more than canvas walls, rough benches, and a wooden table serving as an altar, but the lamplight inside feels steady. A preacher in shirtsleeves is folding hymn sheets while two children chase each other between the benches.
⠀
When you ask about Billy, the preacher does not flinch.
⠀
"He follows Jesus now," he says. "Not the idea of Jesus. Not a cleaner story. The Jesus who told Peter to put away the sword and told the thief beside Him there was still room in mercy."
⠀
The words land badly in you.
⠀
- [Ask why the preacher trusts him](#preacher-testimony)  
- [Go to the widow's porch](#widow-ortega)  
- [Leave for the river](#cottonwood-ford)

# Preacher Testimony
⠀
The preacher sets down the hymn sheets and leans against the altar.
⠀
"Billy came to me half dead and all haunted," he says. "Said he could still hear every person he buried inside himself. I told him Christ forgives sinners, not legends. He wept like a child. Since then he's mended roofs, dug graves, carried fever medicine through flood water, and read Scripture over folks who would not speak his name to his face."
⠀
He studies you carefully.
⠀
"Repentance is not escape from judgment. But it is real. That is the hardest part of this world to believe."
⠀
- [Go to Cottonwood Ford](#cottonwood-ford)  
- [Find the widow Billy helped](#widow-ortega)  
- [Step back into the street](#mercys-end)

# Widow Ortega
⠀
Widow Ortega sits on a porch Billy rebuilt with his own hands after the spring storms. She shells peas into a dented bowl and never once asks your name.
⠀
"He burned my first house with the rest of them," she says. "Years later he came back alone and worked three weeks in the heat without asking pardon. Paid for my husband's marker too. He cannot unmake himself. But he is not that man every hour anymore."
⠀
She points with her chin toward the ridge graveyard.
⠀
"Thursday nights he goes there first. Then the river. Then the church. Always in that order. Like he thinks grief can be walked into something holy if he takes the road slow enough."
⠀
- [Wait for Billy at the graveyard](#cemetery-vigil)  
- [Ride straight to Cottonwood Ford](#cottonwood-ford)  
- [Return to town](#mercys-end)

# Cottonwood Ford
⠀
By the time you reach the river, moonlight has silvered the reeds and the whole town seems gathered at the bank. Lanterns sway. Someone sings low. Children cling to their mothers' skirts.
⠀
In the shallows stands **Saint Billy**.
⠀
He is older than the wanted poster, scarred through one eyebrow, broad in the shoulders, and utterly unarmed to the eye. His black hat is gone. His white shirt is soaked dark to the chest. A preacher stands beside him with one hand on his back and a Bible lifted high.
⠀
This is not how you imagined finding the man who murdered your family.
⠀
- [Hide in the reeds with the rifle](#reeds-at-the-river)  
- [Climb the bell tower overlooking the ford](#bell-tower)  
- [Ride ahead to the graveyard instead](#cemetery-vigil)

# Reeds At The River
⠀
You settle into the reeds and line the rifle across a root. Billy's head fills the sight. One pull and Holt Crossing gets its answer.
⠀
Then the preacher lowers him into the river and raises him again while the townspeople sing. Billy comes up gasping, face broken open by grief instead of pride.
⠀
A little boy runs down the bank and throws both arms around his waist.
⠀
You do not take the shot.
⠀
- [Follow Billy from the river](#after-the-water)  
- [Circle to the graveyard](#cemetery-vigil)  
- [Climb up to the bell tower](#bell-tower)

# Bell Tower
⠀
The old mission bell tower gives you the whole town in pieces: river below, chapel road, the graveyard ridge beyond. From up here you see more than Billy.
⠀
Three riders move along the far bank with their lanterns dark. Red Knives men from the canyon trail. They are stalking the service, waiting for Billy to step away from witnesses.
⠀
Below you, Billy helps an old rancher out of the water, steadies a widow by the elbow, and takes a crying child into his arms with the same hands that once worked revolvers faster than thought.
⠀
- [Shadow Billy after the service](#after-the-water)  
- [Cut across to meet him at the graves](#cemetery-vigil)  
- [Go down and confront him in the chapel road](#saint-billy)

# Cemetery Vigil
⠀
The graveyard is quiet except for locusts and the faint river singing below. You wait beside your family's plot until bootsteps crunch up the slope.
⠀
Billy comes alone carrying lilies in one hand and a worn Bible in the other.
⠀
He stops at each grave before yours, head bowed. When he reaches the Holt Crossing stones, his whole body seems to give way a little.
⠀
- [Listen from the shadows](#grave-prayer)  
- [Step out and face him now](#saint-billy)  
- [Force him toward the chapel at gunpoint](#chapel-confession)

# Grave Prayer
⠀
Billy kneels in the dirt before your family and speaks so softly you have to lean to hear him.
⠀
"Lord Jesus, I remember their faces better than my own," he says. "Do not let me call Your grace cheap. If judgment comes tonight, let it come true. But keep this family in Your keeping, and keep their blood from making another man into me."
⠀
He sets the lilies down with hands that shake.
⠀
You have never heard him sound afraid until now.
⠀
- [Step out of the dark](#saint-billy)  
- [March him to the chapel](#chapel-confession)  
- [Make him walk to the graves of your own dead](#grave-walk)

# After The Water
⠀
The river service breaks up slowly. Billy does not linger in the praise. He takes the same road Widow Ortega described: from the water toward the graveyard, from the graveyard toward the church.
⠀
He walks like a man who knows he is being followed and has chosen not to turn around.
⠀
- [Stop him on the chapel road](#saint-billy)  
- [Drive him toward the family graves](#grave-walk)  
- [Wait for him inside the chapel](#chapel-confession)

# Saint Billy
⠀
When you step into the road, Billy stops at once.
⠀
He looks at the rifle, then at your face, and something like recognition passes through him.
⠀
"Holt Crossing," he says.
⠀
You tell him to say your family's names if he remembers them. He does. Every one. No stumble. No excuse.
⠀
Then he says the words you have carried half your life waiting to hear:
⠀
"I killed them. I killed them in cold blood because I liked what fear did to a room, and because nobody alive could tell me no. Christ found me after that. He changed me. He did not erase what I did. If you came for justice, I will not run from it."
⠀
- [Hear the whole confession](#chapel-confession)  
- [Make Billy walk to your family's graves](#grave-walk)  
- [Force him into a dawn duel in the street](#street-of-dust)  
- [Shoot him where he stands](#shot-in-chapel)

# Chapel Confession
⠀
Inside the empty chapel, Billy lays his Bible on the altar and keeps his hands away from his belt.
⠀
He tells you the rest plainly. Holt Crossing was meant to be a warning to another rancher who would not pay protection. Your family was home instead. Billy gave the order anyway because he had built his life on becoming the vilest man in any room.
⠀
Years later, drunk and rotting from within, he tried to rob a dying circuit preacher outside El Paso. The old man looked up from his own blood and told Billy that even now Jesus could save a murderer who would turn and come empty-handed.
⠀
Billy says he has spent every day since trying to live like that was true.
⠀
"I belong to Jesus Christ now," he says. "That does not make me less guilty. It only makes lying impossible."
⠀
- [Walk him to the graves](#grave-walk)  
- [Take him into the street for a public ending](#street-of-dust)  
- [Kill him in the chapel](#shot-in-chapel)

# Grave Walk
⠀
You march Billy up the ridge under moonlight, rifle steady between his shoulders. He never asks for mercy. He never reaches for a weapon. Once, passing the fence line, he stumbles and says he is sorry so quietly it nearly sounds involuntary.
⠀
At your family's plot he kneels without being told.
⠀
The lilies he brought are still lying where he left them.
⠀
- [Order Billy to pray before the graves](#last-prayer)  
- [Shoot him over the fresh lilies](#death-at-the-graves)  
- [Drag him back down for a street reckoning](#street-of-dust)

# Last Prayer
⠀
Billy bows his head.
⠀
"Lord Jesus," he says, "I threw away the right to ask for anything good. But if there is mercy left in heaven, give it to this family first. And if this son or daughter of theirs kills me now, do not let the blood follow them like it followed me. Let it end here."
⠀
He lifts his face and looks at you straight on.
⠀
"I will not fight you."
⠀
- [End it here](#death-at-the-graves)  
- [Make him die in the open street](#street-of-dust)

# Street Of Dust
⠀
Dawn finds the whole town gathered along the main road, silent as fence posts. The sheriff stands beside the water trough. The preacher will not look at you. Widow Ortega does.
⠀
Billy steps into the street wearing the same white shirt from the river, now dry and creased. His revolver hangs at his hip, but the leather strap is still snapped over it.
⠀
"Draw," you tell him.
⠀
He shakes his head once.
⠀
"I spent too many years proving what kind of man I was with a gun in my hand," he says. "I am not picking it back up to save my hide."
⠀
- [Shoot Billy while he stands unarmed](#death-in-the-street)  
- [Give the order again and then fire](#dust-duel)

# Dust Duel
⠀
You count for him. One. Two. Three.
⠀
Billy never moves for the revolver.
⠀
The whole town sees it. The fastest gun in the New West refusing the last draw of his life because he would rather die than kill one more soul.
⠀
When you pull the trigger, the sound goes off the storefronts and into the morning like judgment.
⠀
- [See how Saint Billy dies](#death-in-the-street)

# Shot In Chapel
⠀
The rifle cracks inside the chapel and the sound slams around the rafters like thunder.
⠀
Billy folds where he stands, one hand catching the edge of the altar before he drops. Blood spreads dark across the floorboards beneath the Bible.
⠀
He looks up once, not in anger but in sorrow, and whispers, "Jesus, receive me."
⠀
Then the room goes still.
⠀
- [Walk back into the morning](#after-saint-billy)

# Death At The Graves
⠀
The shot knocks birds out of the cedar fence. Billy pitches forward across the lilies and the grave dirt, hatless head turned toward the names he came to remember.
⠀
For a moment the whole ridge is silent except for your own breathing.
⠀
You expected triumph. What comes instead is weight. The kind that does not lift just because the man beneath it is finally dead.
⠀
At your boots lies the wooden cross from earlier, half buried in dust.
⠀
- [Leave the ridge with the sun rising](#after-saint-billy)

# Death In The Street
⠀
Your bullet hits Billy high in the chest. He rocks back a step, almost surprised by how small the force looks after all the violence people once wrapped around his name.
⠀
He drops to one knee in the street dust. The sheriff starts forward, but Billy raises a hand to stop him.
⠀
His eyes find the church, then the sky above it.
⠀
"Tell them," he says, voice breaking, "that Jesus was better than Billy ever was."
⠀
Then Saint Billy falls forward and does not rise.
⠀
- [Hear the bell after the gunfire](#after-saint-billy)

# After Saint Billy
⠀
They ring the church bell for him.
⠀
Not because he died innocent. Not because the town forgot Holt Crossing, or your family, or the years when Saint Billy brought pain from one riverbank to the next.
⠀
They ring it because the man you killed was not the same beast who murdered your blood, and everyone in Mercy's End knows that both things are true at once.
⠀
By noon, somebody has covered his body with a plain sheet. By evening, the preacher is reading from the Gospel over the dead outlaw you chased across half a lifetime. By nightfall, the song has changed again.
⠀
You ride out of Mercy's End with justice behind you and no peace worth naming.
⠀
- [Ride the story again](#ash-at-sundown)
