---
title: "Worlds Inline Animation"
theme: "neotopia"
---

```javascript on:update
worlds.content.applyAllFrames(getTime());
```

# Worlds Inline Animation {x: 0, y: 0, scale: 1.0, width: 60}

Sections carry their own frame-by-frame animation — no external JS arrays needed.

Place a ` ```timed animate:content relative ` fence inside any section. Each frame
starts with a timestamp (ms since the section was entered), with frames separated
by `---`. Call `worlds.content.applyAllFrames(timeSec)` once per update tick and
every inline block fires automatically.

Navigate to any section and its animation replays from 0 automatically.

- [Counter](#counter) — animated title + content in one section
- [Typewriter](#typewriter) — character-by-character reveal
- [Spinner](#spinner) — 100 ms Braille spinner frames
- [Reveal](#reveal) — word-by-word sentence build-up
- [Blink](#blink) — alternating frames for a blinking alert
- [Progress](#progress) — block-character progress bar

```javascript on:init
worlds.enable();
worlds.controls.setEnabled(false);
worlds.config.setDefaults({
  sectionBackground: 'paper+ruledlines',
  sectionRender: 'all',
  sectionOverflow: 'fit-y',
  sectionLinkUnderline: true,
  sectionClickFocusEnabled: true,
  defaultSectionWidth: 48,
  defaultSectionHeight: 14,
});
worlds.camera.setEaseSpeed(0.06, 0.10);
worlds.camera.focusOnSectionFit('Worlds Inline Animation', 0.88);
```

---

# Counter {x: -30, y: -24, scale: 1.0}

Both title and content animate independently.

[← Overview](#worlds-inline-animation) · [Typewriter →](#typewriter)

```timed animate:title relative
0ms
Counter: 0
---
500ms
Counter: 1
---
1000ms
Counter: 2
---
1500ms
Counter: 3
---
2000ms
Counter: 4
---
2500ms
Counter: 5
```

```timed animate:content relative
0ms
Both title and content animate independently.

[← Overview](#worlds-inline-animation) · [Typewriter →](#typewriter)
---
2600ms
Done! Use ` ```timed animate:title `
and ` ```timed animate:content `
in the same section.

[← Overview](#worlds-inline-animation) · [Typewriter →](#typewriter)
```

---

# Typewriter {x: 0, y: -24, scale: 1.0}

[← Counter](#counter) · [← Overview](#worlds-inline-animation) · [Spinner →](#spinner)

```timed animate:content relative
0ms
_
---
150ms
H_
---
300ms
He_
---
450ms
Hel_
---
600ms
Hell_
---
750ms
Hello_
---
900ms
Hello,_
---
1050ms
Hello, W_
---
1200ms
Hello, Wo_
---
1350ms
Hello, Wor_
---
1500ms
Hello, Worl_
---
1650ms
Hello, World_
---
1800ms
Hello, World!

[← Counter](#counter) · [← Overview](#worlds-inline-animation) · [Spinner →](#spinner)
```

---

# Spinner {x: 30, y: -24, scale: 1.0}

Braille spinner — frames at 100 ms intervals.

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)

```timed animate:content relative
0ms
⠋  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
100ms
⠙  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
200ms
⠹  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
300ms
⠸  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
400ms
⠼  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
500ms
⠴  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
600ms
⠦  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
700ms
⠧  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
800ms
⠇  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
900ms
⠏  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
1000ms
⠋  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
1100ms
⠙  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
1200ms
⠹  working...

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
---
1300ms
✓  done!

[← Typewriter](#typewriter) · [← Overview](#worlds-inline-animation) · [Reveal →](#reveal)
```

---

# Reveal {x: -30, y: -48, scale: 1.0}

Words appear one at a time.

[← Overview](#worlds-inline-animation) · [Blink →](#blink)

```timed animate:content relative
0ms
The

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
400ms
The quick

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
800ms
The quick brown

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
1200ms
The quick brown fox

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
1600ms
The quick brown fox jumps

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
2000ms
The quick brown fox jumps over

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
2400ms
The quick brown fox jumps over the

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
2800ms
The quick brown fox jumps over the lazy

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
---
3200ms
The quick brown fox jumps over the lazy dog.

[← Overview](#worlds-inline-animation) · [Blink →](#blink)
```

---

# Blink {x: 0, y: -48, scale: 1.0}

Alternating frames blink the content.

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)

```timed animate:content relative
0ms
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  ALERT: blink on  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
---
400ms
░░░░░░░░░░░░░░░░░░░░
░                  ░
░░░░░░░░░░░░░░░░░░░░

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
---
800ms
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  ALERT: blink on  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
---
1200ms
░░░░░░░░░░░░░░░░░░░░
░                  ░
░░░░░░░░░░░░░░░░░░░░

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
---
1600ms
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
▓  ALERT: blink on  ▓
▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
---
2000ms
░░░░░░░░░░░░░░░░░░░░
░   ALERT: done    ░
░░░░░░░░░░░░░░░░░░░░

[← Reveal](#reveal) · [← Overview](#worlds-inline-animation) · [Progress →](#progress)
```

---

# Progress {x: 30, y: -48, scale: 1.0}

A progress bar built from block characters.

[← Blink](#blink) · [← Overview](#worlds-inline-animation)

```timed animate:content relative
0ms
[                    ] 0%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
300ms
[██                  ] 10%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
600ms
[████                ] 20%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
900ms
[██████              ] 30%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
1200ms
[████████            ] 40%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
1500ms
[██████████          ] 50%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
1800ms
[████████████        ] 60%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
2100ms
[██████████████      ] 70%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
2400ms
[████████████████    ] 80%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
2700ms
[██████████████████  ] 90%

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
---
3000ms
[████████████████████] 100%
✓ complete

[← Blink](#blink) · [← Overview](#worlds-inline-animation)
```
