---
name: "Saint Billy"
title: "Saint Billy"
author: "Maddest Labs"
theme: "saintbilly"
shaders: "blurgradual+lightvignette"
font: "Rye"
---

This Saint Billy variant turns the demo into a song board instead of a dungeon crawl.

- The full-quality track now loads from the local asset at `docs/assets/audio/saintbilly.wav` instead of an embedded blob.
- The `lyrics` block keeps the original line-level timestamps from `lyrics.json`.
- The `lyricWords` block estimates individual word timing inside the second section so the hook can reveal word by word.
- Timed section headings break the track into large visual beats that the Worlds camera can follow.

```javascript
var state = {
  audioBuffer: null,
  audioLoadPromise: null,
  source: null,
  gain: null,
  playRequested: false,
  isPlaying: false,
  startTime: 0,
  pauseOffset: 0,
  wasSeeking: false,

  currentLine: '',
  currentSection: '',
  currentSectionId: null,
  timedSections: [],

  widgets: null,
  mouseDownLeft: false,
  statusText: 'Loading local WAV asset...',
};

const WORLDS_LYRIC_WINDOW = 3;
const WORLDS_SECTION_FILL = 0.9;
const WORD_REVEAL_SECTION = 'Saint Billy Rides In';
const LOCAL_AUDIO_URL = 'assets/audio/saintbilly.wav';

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
  if (!state.audioBuffer) return 0;
  if (!state.isPlaying) return clamp(state.pauseOffset, 0, state.audioBuffer.duration);
  return clamp(audio.currentTime - state.startTime, 0, state.audioBuffer.duration);
}

function resetDemo(autoplay) {
  stopAudio({ keepOffset: false });
  state.pauseOffset = 0;
  worlds.content?.clearAll?.();
  state.currentSectionId = null;
  state.currentSection = '';
  state.currentLine = '';
  if (state.widgets?.seek) state.widgets.seek.setValue(0);
  if (state.widgets?.time) {
    const total = state.audioBuffer ? fmtTime(state.audioBuffer.duration) : '--:--';
    state.widgets.time.setText(`0:00 / ${total}`);
  }
  if (autoplay !== false && state.audioBuffer) playFrom(0);
}

function stopAudio({ keepOffset } = { keepOffset: true }) {
  if (!state.source) return;
  try {
    if (keepOffset) {
      state.pauseOffset = clamp(audio.currentTime - state.startTime, 0, state.audioBuffer?.duration ?? 0);
    } else {
      state.pauseOffset = 0;
    }
    state.source.onended = null;
    state.source.stop();
  } catch { /* ignore */ }
  try { state.source.disconnect(); } catch { /* ignore */ }
  state.source = null;
  state.isPlaying = false;
}

function playFrom(offsetSec) {
  if (!state.audioBuffer) return;
  stopAudio({ keepOffset: false });
  const offset = clamp(offsetSec, 0, state.audioBuffer.duration);
  state.pauseOffset = offset;
  const src = audio.createBufferSource();
  src.buffer = state.audioBuffer;
  src.connect(state.gain ?? audio.destination);
  state.startTime = audio.currentTime - offset;
  state.isPlaying = true;
  src.onended = () => {
    if (state.source === src) {
      state.source = null;
      state.isPlaying = false;
      state.pauseOffset = clamp(audio.currentTime - state.startTime, 0, state.audioBuffer.duration);
    }
  };
  state.source = src;
  try {
    src.start(0, offset);
  } catch {
    src.start();
  }
}

function setStatus(text) {
  state.statusText = text;
}

function loadLocalAudio() {
  if (state.audioBuffer) return Promise.resolve(state.audioBuffer);
  if (state.audioLoadPromise) return state.audioLoadPromise;

  setStatus('Loading local WAV asset...');

  state.audioLoadPromise = (async () => {
    try {
      audio.context.resume().catch(() => {});
      const buffer = await audio.loadSound(LOCAL_AUDIO_URL);
      if (!buffer) throw new Error('Local asset decode failed');

      state.audioBuffer = buffer;
      state.pauseOffset = 0;
      state.widgets.seek.min = 0;
      state.widgets.seek.max = Math.max(0.01, buffer.duration);
      state.widgets.seek.step = 0.01;
      state.widgets.seek.setValue(0);
      state.widgets.time.setText(`0:00 / ${fmtTime(buffer.duration)}`);

      const firstSection = sectionAtMs(0);
      if (firstSection) {
        state.currentSection = firstSection.title;
        worlds.camera.focusOnSectionFit(firstSection.index, WORLDS_SECTION_FILL, { keepRotation: true });
        syncWorldsSectionContent(firstSection, 0);
      }

      if (state.playRequested) {
        state.playRequested = false;
        playFrom(state.pauseOffset);
      }

      setStatus(`Track ready from local asset - ${fmtTime(buffer.duration)}. Press Play to start.`);
      return buffer;
    } catch (e) {
      console.warn('[saintbilly-lyrics] local audio load failed:', e);
      state.playRequested = false;
      setStatus('Local WAV failed to load. Press Play to retry.');
      return null;
    } finally {
      state.audioLoadPromise = null;
    }
  })();

  return state.audioLoadPromise;
}

function lineAtTime(timeSec) {
  const entry = doc.atTime('lyrics', timeSec);
  return entry ? entry.text : '';
}

function getTimedEntries(name) {
  return doc.timedBlock(name) || [];
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

function entriesForSection(section, name) {
  const window = getSectionWindow(section);
  if (!window) return [];
  return getTimedEntries(name).filter((entry) => {
    if (!Number.isFinite(entry.ms)) return false;
    if (entry.ms < window.startMs) return false;
    if (window.endMs !== null && entry.ms >= window.endMs) return false;
    return true;
  });
}

function isWordRevealSection(section) {
  if (!section) return false;
  if (typeof WORD_REVEAL_SECTION === 'number' && Number.isFinite(WORD_REVEAL_SECTION)) {
    return section.index === Math.floor(WORD_REVEAL_SECTION);
  }
  if (typeof WORD_REVEAL_SECTION !== 'string') return false;

  const wanted = WORD_REVEAL_SECTION.trim();
  if (!wanted) return false;
  if (section.title === wanted) return true;

  const layout = worlds.getSectionLayout?.(section.index);
  return layout?.sectionId === wanted;
}

function sampleWordsForSection(section, posSec) {
  const nowMs = Math.max(0, Math.round(Number(posSec) * 1000));
  const entries = entriesForSection(section, 'lyricWords').filter((entry) => entry.ms <= nowMs);
  if (!entries.length) return '';

  const renderedLines = [];
  let currentWords = [];
  for (const entry of entries) {
    const token = String(entry?.text || '').trim();
    if (!token) continue;
    if (token === '__BREAK__') {
      if (currentWords.length) {
        renderedLines.push(currentWords.join(' '));
        currentWords = [];
      }
      continue;
    }
    currentWords.push(token);
  }

  if (currentWords.length) renderedLines.push(currentWords.join(' '));
  return renderedLines.join('\n');
}

function composeWorldsSectionContent(baseContent, sampledText) {
  const base = String(baseContent || '').trim();
  const lyrics = String(sampledText || '').trim();
  if (!lyrics) return base;
  if (!base) return lyrics;
  return [lyrics, '', base].join('\n');
}

function composeWorldsSectionTitle(baseTitle, sampledText) {
  const title = String(baseTitle || '').trim();
  const lyrics = String(sampledText || '').trim();
  if (!lyrics) return title;
  return `${title}`;
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

  const sectionEntries = entriesForSection(section, 'lyrics');
  const sampledText = isWordRevealSection(section)
    ? sampleWordsForSection(section, posSec)
    : worlds.content.stateAt(sectionEntries, posSec, {
        mode: 'append',
        separator: '\n',
        maxEntries: WORLDS_LYRIC_WINDOW,
      }).text;

  if (!sampledText) {
    worlds.content.clear(nextSectionId, 'all');
    state.currentSectionId = nextSectionId;
    return '';
  }

  const existing = worlds.content.get(nextSectionId);
  if (!existing) return sampledText;

  const composedTitle = composeWorldsSectionTitle(existing.baseTitle, sampledText);
  const composedContent = composeWorldsSectionContent(existing.baseContent, sampledText);
  const sameTitle = existing.overrideTitle === composedTitle || existing.effectiveTitle === composedTitle;
  const sameContent = existing.overrideContent === composedContent || existing.effectiveContent === composedContent;
  if (!sameTitle || !sameContent) {
    worlds.content.set(nextSectionId, {
      title: composedTitle,
      content: composedContent,
    });
  }

  state.currentSectionId = nextSectionId;
  return sampledText;
}
```

```javascript on:init
const deg = d => d * Math.PI / 180;
const CAMERA_BASE_ROT = { x: deg(-9), y: deg(4), z: 0 };
worlds.enable();
worlds.config.setDefaults({
  sectionRender: 'content',
  keepRotation: true,
  straightenOnFocus: true,
  screenSpaceRecenter: true,
  screenSpaceRecenterIters: 5,
  sectionSizeUnits: 'px',
  sectionOverflow: 'fit-y',
  sectionContentAlign: 'center',
  defaultSectionWidth: 600,
  defaultSectionHeight: 520,
  autoLayoutSpacing: 2,
  sectionBorderEnabled: false,
  sectionBackground: 'texture:assets/img/Paper004_1K-JPG_Displacement.jpg;tilePx=640;contentDistort=0.003;blendMode=overlay;blendStrength=0.7;paperPlaneZ=focus',
});

worlds.camera.setPosition(0, 55, 320);
worlds.camera.setRotation(CAMERA_BASE_ROT.x, CAMERA_BASE_ROT.y, CAMERA_BASE_ROT.z);
worlds.camera.setFOV(deg(42));
worlds.camera.setEaseSpeed(0.18, 0.12);

worlds.camera.shake.setParams({
  strength: 1.0,
  rate: 0.20,
  translate: { x: 1.2, y: 0.9, z: 0.4 },
  rotate: { x: deg(0.55), y: deg(0.65), z: 0 },
});
worlds.camera.shake.setEnabled(true);

worlds.camera.focusOnSectionFit(0, WORLDS_SECTION_FILL, { keepRotation: true });

gui.init({ boundsSpace: 'device' });
buildTimedSections();

const btnPlayPause = gui.createButton({
  bounds: { x: 0, y: 0, width: 180, height: 36 },
  label: 'Play',
});

const time = gui.createLabel({
  bounds: { x: 0, y: 0, width: 180, height: 24 },
  text: '--:-- / --:--',
  align: 'left',
});

const seek = gui.createSlider({
  bounds: { x: 0, y: 0, width: 180, height: 28 },
  label: '',
  min: 0,
  max: 1,
  value: 0,
  step: 0.1,
});

state.widgets = { time, seek, btnPlayPause };
state.gain = audio.createGain();
state.gain.gain.value = 1;
state.gain.connect(audio.destination);
audio.context.resume().catch(() => {});
worlds.content?.clearAll?.();
void loadLocalAudio();
```

```javascript on:input
if (!event) return;
if (typeof state === 'undefined' || !state) return;
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
if (typeof state === 'undefined' || !state || !state.widgets) return;

const W = ui.metrics.canvasWidth;
const inset = 16;
const ctrlW = 180;
const btnH = 36, timeH = 24, seekH = 28, gap = 6;
const x = W - inset - ctrlW;
let y = inset;
state.widgets.btnPlayPause.setBounds({ x, y, width: ctrlW, height: btnH });
y += btnH + gap;
state.widgets.time.setBounds({ x, y, width: ctrlW, height: timeH });
y += timeH + gap;
state.widgets.seek.setBounds({ x, y, width: ctrlW, height: seekH });

gui.update(getMouseX(), getMouseY(), state.mouseDownLeft);

if (state.widgets.btnPlayPause.wasClicked()) {
  if (state.isPlaying) {
    state.playRequested = false;
    stopAudio({ keepOffset: true });
  } else {
    audio.context.resume().catch(() => {});
    state.playRequested = true;
    if (state.audioBuffer) {
      playFrom(state.pauseOffset);
      state.playRequested = false;
    }
    else {
      void loadLocalAudio();
      setStatus('Loading local WAV asset...');
    }
  }
}

const dragging = state.widgets.seek.isDragging?.() ?? false;
const livePos = getDemoTimeSec();
const maxSeek = state.audioBuffer ? state.audioBuffer.duration : 0;
const previewPos = dragging ? clamp(state.widgets.seek.getValue(), 0, maxSeek) : livePos;

if (state.audioBuffer && !dragging && state.wasSeeking) {
  const target = clamp(state.widgets.seek.getValue(), 0, state.audioBuffer.duration);
  state.pauseOffset = target;
  if (state.isPlaying) playFrom(target);
}
if (state.audioBuffer && !dragging) state.widgets.seek.setValue(livePos);

state.wasSeeking = dragging;

const sec = sectionAtMs(previewPos * 1000);
const secTitle = sec ? sec.title : '';
if (secTitle !== state.currentSection) {
  state.currentSection = secTitle;
  if (sec) {
    worlds.camera.focusOnSectionFit(sec.index, WORLDS_SECTION_FILL, { keepRotation: true });
  }
}

const newLine = lineAtTime(previewPos);
if (newLine !== state.currentLine) {
  state.currentLine = newLine;
}

syncWorldsSectionContent(sec, previewPos);

const total = state.audioBuffer ? fmtTime(state.audioBuffer.duration) : '--:--';
state.widgets.time.setText(`${fmtTime(previewPos)} / ${total}`);
if (dragging && state.audioBuffer) {
  setStatus(`Scrubbing ${fmtTime(previewPos)} - lyric and section sync are following the local WAV asset.`);
} else if (state.audioBuffer) {
  setStatus(state.isPlaying ? 'Playing synced local audio.' : 'Paused - drag the scrubber or press Play.');
}
state.widgets.btnPlayPause.setLabel(state.isPlaying ? 'Pause' : 'Play');
```

```timed name:lyrics
# ms|text
0|Somewheres in the wild New West
27000|Way out West in the Texas Sun
28600|Outlaws outrun and outgun
31800|Shoot to kill, they shoot for the giggle and thrill
35600|They love that blood to spill
38000|And amidst them standing tall
41400|Mighty and proud on top of it all
44600|One man towers without shame
45000|One man TOWERS without shame
48140|One man oversees this game
51700|They call him Billy the Saint
54780|Saint Billy, that's his name
56380|One evil, rotten son of a gun
58980|Does hurt for work
62140|And hurt for fun
63780|And when he come round with his gang
65000|All them hoodlums sing
68000|Go on Saint Billy, do your thing
73000|Go on Saint Billy go and bring the pain
85000|Bring the pain
88760|Word got round bout a strange young man, Colt at his side and sword in hand
96080|Huntin' souls down like a sour bloodhound
98940|Even demons flee when he come to town
102120|It's said that he woke the dead then drowned them again
106000|By the river's edge. Saint Billy
109000|It's all on you, what ya gonna do
112000|What ya gonna do with this fool. This West ain't
115000|Big enough for two outlaws
117000|Kicking in doors and teeth and more, but you
122000|You're the vilest sort, bed him down, Billy
125000|Like you do for sport. Mounted his horse
129000|With a "Yippee Ki‐Yay", all them hoodlums sing
68000|Go on Saint Billy, do your thing
73000|Go on Saint Billy go and bring the pain
147000|High noon and high eyed on the trail outside of saloon, so pale and frail.
160000|A preacher man, he spoke so bold, Town folks gather round for the stories
165340|And then
167640|Coulda heard a pin drop
169240|When he called them sinners
171040|Repent and stop and turn to Jesus
174400|King of kings
176040|Bring your filth, he'll make y'all clean
179040|Slowly the crowd broke up
182040|But one stood shook
183960|All trembling and stuff
185440|They call him Billy the Saint
188940|Saint Billy, that's his name and when he come round nowadays
194960|All them choir sing
68000|Go on Saint Billy, do your thing
73000|Go on Saint Billy go and ease the pain
205000|...and so the New West was won.
```

```timed name:lyricWords
# Estimated per-word timing for the featured hook section.
# `__BREAK__` ends the current rendered line.
45000|One
45897|man
46346|towers
46794|without
47243|shame
47691|♪
48139|__BREAK__
48649|One
49157|man
49666|oversees
50174|this
50683|game
51699|__BREAK__
51700|They
52384|call
52727|him
53069|Billy
53753|the
54096|Saint
54779|__BREAK__
54780|Saint
55237|Billy
55466|that's
55694|his
55923|name
56151|♪
56379|__BREAK__
56380|One
57123|evil
57494|rotten
58979|__BREAK__
58980||Son
59842|of
60129|a
60416|gun
60704|does
60991|hurt
61278|for
61565|work
61853|♪
62139|__BREAK__
62413|And
62687|hurt
62960|for
63233|fun
63779|__BREAK__
63780|And
63891|when
63946|he
64002|come
64057|round
64113|with
64168|his
64224|gang
64999|__BREAK__
65000|All
66000|them
66500|hoodlums
67000|sing
67999|__BREAK__
68000|Go on,
69250|Saint
69875|Billy
70500|do
71125|your
71750|thing
72375|♪
72999|__BREAK__
73000|Go on
74000|Saint
74500|Billy
75000|go
75500|and
76000|bring
76500|the
77000|pain
89699|__BREAK__
```

# Opening {"timed": "0ms", "render": "content"}

»»——————¤——————««

# Saint Billy Rides In {"timed": "44600ms", "rotate-z": "12", "render": "content"}

✎﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏﹏

# River Talk {"timed": "92840ms", "render": "content"}

‿︵‿︵‿︵‿︵‿︵‿︵

# Two-Outlaw Gospel {"timed": "125000ms", "render": "content"}

»»——————¤——————««

# Pulpit Fire {"timed": "160000ms", "render": "content"}

━◦○◦━◦○◦━◦○◦━◦○◦━◦○◦━◦○◦━

# Choir for Saint Billy {"timed": "185440ms", "render": "content"}

»»——————¤——————««

# Last Echo {"timed": "205000ms", "render": "content"}

»——————◦•♛•◦——————«