---
title: "Mine|sweeper"
theme: "saintbilly"
fontsize: 20
width: 1080
height: 2400
---

# Play {"x":"0","y":"0","z":"0","width":"40","height":"18","opacity":"0.92"}

This card is just the camera target. When focused, the actual game board is drawn as a full immediate-mode overlay.

- [*](action:restart-game)
- [⚙](action:open-settings)
- [?](action:open-help)

```javascript on:enter
if (typeof worlds.currentSection === 'number') {
  game.sections.play = worlds.currentSection;
}
if (!Array.isArray(game.board) || game.board.length === 0) {
  resetGame();
}
syncWorldWidgets();
```

# Settings {"x":"0","y":"60","z":"0","width":"36","height":"30"}

Change the board size and mobile flagging behavior.

Theme:

```gui
type: slider
id: settings-theme-slider
min: 0
max: 0
value: 0
step: 1
showValue: false
width: 100%
align: center
scale: worlds
```

```gui
type: label
id: settings-difficulty-label
text: Board: Easy 8x8 10*
width: 92%
align: left
```

```gui
type: label
id: settings-long-press-label
text: Hold: ⚑ On
width: 92%
align: left
```

```gui
type: label
id: settings-sticky-label
text: Sticky: ⚑ Off
width: 92%
align: left
```

```gui
type: label
id: settings-theme-label
text: Theme: nord
width: 92%
align: left
```

- Board: [Easy](action:difficulty-easy) | [Med](action:difficulty-medium) | [Hard](action:difficulty-hard)
- Hold ⚑: [T](action:toggle-long-press)
- Sticky ⚑: [S](action:toggle-sticky-flag)
[⇦ Back](action:history-back)

```javascript on:enter
if (typeof worlds.currentSection === 'number') {
  game.sections.settings = worlds.currentSection;
}
syncWorldWidgets();
```

# Help {"x":"0","y":"120","z":"0","width":"36","height":"30"}

Controls:

- Desktop reveal: left click
- Desktop flag: right click
- Mobile reveal: tap
- Mobile flag: switch to ⚑ mode, then tap
- Mobile shortcut: long press toggles a flag when enabled in Settings

Notes:

- Sticky flag mode off means a flag tap returns to ! mode automatically.
- Sticky flag mode on leaves Flag Mode active until you turn it off.
- The first reveal is always safe and also clears its immediate neighbors.

[⇦ Back](action:history-back)

```javascript on:enter
if (typeof worlds.currentSection === 'number') {
  game.sections.help = worlds.currentSection;
}
syncWorldWidgets();
```

```javascript
var DIFFICULTIES = {
  easy: { label: 'Easy', cols: 8, rows: 8, mines: 10 },
  medium: { label: 'Medium', cols: 12, rows: 12, mines: 20 },
  hard: { label: 'Hard', cols: 16, rows: 16, mines: 40 }
};

var SETTINGS_THEME_SLIDER_ID = 'settings-theme-slider';
var SETTINGS_DIFFICULTY_ID = 'settings-difficulty-label';
var SETTINGS_LONG_PRESS_ID = 'settings-long-press-label';
var SETTINGS_STICKY_ID = 'settings-sticky-label';
var SETTINGS_THEME_LABEL_ID = 'settings-theme-label';

var LONG_PRESS_MS = 420;
var POINTER_MOVE_TOLERANCE = 18;
var NAV_HISTORY_MAX = 24;
var PLAY_SECTION_FIT = 0.96;
var CARD_SECTION_FIT = 0.94;

var game = {
  difficulty: 'easy',
  cols: 8,
  rows: 8,
  mines: 10,
  board: [],
  firstRevealPending: true,
  revealedCount: 0,
  flagsPlaced: 0,
  status: 'ready',
  message: 'Clear board.',
  flagMode: false,
  hoverCell: null,
  layout: null,
  playCardHidden: false,
  settings: {
    longPressFlag: true,
    stickyFlagMode: false
  },
  pointer: {
    active: false,
    cellX: -1,
    cellY: -1,
    startX: 0,
    startY: 0,
    startAt: 0,
    longPressFired: false,
    moved: false
  },
  sections: {
    play: null,
    settings: null,
    help: null
  },
  themeNames: [],
  themeIndex: 0,
  themeName: 'nord',
  navBackStack: [],
  navForwardStack: []
};

function chR(c) { return (c >>> 24) & 255; }
function chG(c) { return (c >>> 16) & 255; }
function chB(c) { return (c >>> 8) & 255; }

function alphaColor(c, alpha) {
  return ui.colors.rgba(chR(c), chG(c), chB(c), Math.max(0, Math.min(255, Math.round(alpha * 255))));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeSectionRef(name, fallbackIndex) {
  return typeof fallbackIndex === 'number' ? fallbackIndex : name;
}

function safeSetWorldWidgetValue(id, value, sectionRef) {
  try {
    if (!worlds || !worlds.widgets || typeof worlds.widgets.setValue !== 'function') return;
    worlds.widgets.setValue(id, value, sectionRef);
  } catch (err) {}
}

function difficultyConfig(name) {
  return DIFFICULTIES[name] || DIFFICULTIES.easy;
}

function difficultyLabel() {
  return difficultyConfig(game.difficulty).label;
}

function difficultyShortLabel() {
  if (game.difficulty === 'medium') return 'Med';
  if (game.difficulty === 'hard') return 'Hard';
  return 'Easy';
}

function getSettingsWidgetSectionRef() {
  return safeSectionRef('Settings', game.sections.settings);
}

function ensureThemeSelectorState() {
  var names = [];
  if (typeof themes !== 'undefined' && themes && typeof themes.list === 'function') {
    names = themes.list() || [];
  }

  if (!Array.isArray(names) || names.length === 0) {
    names = [game.themeName || 'nord'];
  }

  game.themeNames = names.slice();

  var currentName = game.themeName;
  if (typeof themes !== 'undefined' && themes && typeof themes.getName === 'function') {
    currentName = themes.getName() || currentName;
  }

  var index = game.themeNames.indexOf(currentName);
  if (index < 0) index = 0;

  game.themeIndex = index;
  game.themeName = game.themeNames[index];
}

function applyThemeIndex(index) {
  ensureThemeSelectorState();
  if (!game.themeNames || game.themeNames.length === 0) return;

  var nextIndex = Math.max(0, Math.min(game.themeNames.length - 1, Math.round(index)));
  var nextName = game.themeNames[nextIndex];

  if (typeof themes !== 'undefined' && themes && typeof themes.set === 'function') {
    if (!themes.set(nextName)) return;
  }

  game.themeIndex = nextIndex;
  game.themeName = nextName;
  syncWorldWidgets();
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

function syncWorldWidgets() {
  ensureThemeSelectorState();
  var settingsSectionRef = getSettingsWidgetSectionRef();

  if (worlds && worlds.widgets && typeof worlds.widgets.configure === 'function') {
    var sliderColor = getStyle('info').fg;
    worlds.widgets.configure(SETTINGS_THEME_SLIDER_ID, {
      label: '',
      min: 0,
      max: Math.max(0, game.themeNames.length - 1),
      step: 1,
      showValue: false,
      trackColor: alphaColor(sliderColor, 0.5)
    }, settingsSectionRef);
  }

  safeSetWorldWidgetValue(
    SETTINGS_THEME_SLIDER_ID,
    game.themeIndex,
    settingsSectionRef
  );

  safeSetWorldWidgetValue(
    SETTINGS_THEME_LABEL_ID,
    'Theme: ' + game.themeName,
    settingsSectionRef
  );

  safeSetWorldWidgetValue(
    SETTINGS_DIFFICULTY_ID,
    'Board: ' + difficultyShortLabel() + ' ' + game.cols + 'x' + game.rows + ' ' + game.mines + '✷',
    settingsSectionRef
  );

  safeSetWorldWidgetValue(
    SETTINGS_LONG_PRESS_ID,
    'Hold: ⚑ ' + (game.settings.longPressFlag ? 'On' : 'Off'),
    settingsSectionRef
  );

  safeSetWorldWidgetValue(
    SETTINGS_STICKY_ID,
    'Sticky: ⚑ ' + (game.settings.stickyFlagMode ? 'On' : 'Off'),
    settingsSectionRef
  );
}

function statusLabel() {
  if (game.status === 'won') return 'Won';
  if (game.status === 'lost') return 'Lost';
  if (game.status === 'playing') return '▶';
  return 'Ready';
}

function cellIndex(x, y) {
  if (x < 0 || y < 0 || x >= game.cols || y >= game.rows) return -1;
  return y * game.cols + x;
}

function getCell(x, y) {
  var index = cellIndex(x, y);
  if (index < 0 || index >= game.board.length) return null;
  return game.board[index];
}

function eachNeighbor(x, y, visit) {
  for (var dy = -1; dy <= 1; dy++) {
    for (var dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      var nx = x + dx;
      var ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= game.cols || ny >= game.rows) continue;
      visit(nx, ny);
    }
  }
}

function clearPointerGesture() {
  game.pointer.active = false;
  game.pointer.cellX = -1;
  game.pointer.cellY = -1;
  game.pointer.startX = 0;
  game.pointer.startY = 0;
  game.pointer.startAt = 0;
  game.pointer.longPressFired = false;
  game.pointer.moved = false;
}

function resetGame() {
  game.board = [];
  for (var y = 0; y < game.rows; y++) {
    for (var x = 0; x < game.cols; x++) {
      game.board.push({
        revealed: false,
        mine: false,
        flagged: false,
        adjacent: 0
      });
    }
  }

  game.firstRevealPending = true;
  game.revealedCount = 0;
  game.flagsPlaced = 0;
  game.status = 'ready';
  game.message = 'Clear board.';
  clearPointerGesture();
  syncWorldWidgets();
}

function setDifficulty(name) {
  var cfg = difficultyConfig(name);
  game.difficulty = name in DIFFICULTIES ? name : 'easy';
  game.cols = cfg.cols;
  game.rows = cfg.rows;
  game.mines = cfg.mines;
  game.flagMode = false;
  resetGame();
}

function placeMines(safeX, safeY) {
  var placed = 0;
  var attempts = 0;
  var maxAttempts = game.mines * 200;

  while (placed < game.mines && attempts < maxAttempts) {
    var rx = Math.floor(Math.random() * game.cols);
    var ry = Math.floor(Math.random() * game.rows);
    var dx = Math.abs(rx - safeX);
    var dy = Math.abs(ry - safeY);
    attempts++;

    if (dx <= 1 && dy <= 1) continue;

    var cell = getCell(rx, ry);
    if (!cell || cell.mine) continue;

    cell.mine = true;
    placed++;
  }

  for (var y = 0; y < game.rows; y++) {
    for (var x = 0; x < game.cols; x++) {
      var cell = getCell(x, y);
      if (!cell || cell.mine) continue;

      var adjacent = 0;
      eachNeighbor(x, y, function (nx, ny) {
        var neighbor = getCell(nx, ny);
        if (neighbor && neighbor.mine) adjacent++;
      });
      cell.adjacent = adjacent;
    }
  }
}

function revealAllMines() {
  for (var i = 0; i < game.board.length; i++) {
    if (game.board[i].mine) game.board[i].revealed = true;
  }
}

function checkWin() {
  if (game.status === 'lost') return false;
  var safeCells = game.cols * game.rows - game.mines;
  if (game.revealedCount >= safeCells) {
    game.status = 'won';
    game.flagMode = false;
    game.message = 'Board cleared.';
    for (var i = 0; i < game.board.length; i++) {
      if (game.board[i].mine) game.board[i].flagged = true;
    }
    game.flagsPlaced = game.mines;
    syncWorldWidgets();
    return true;
  }
  return false;
}

function revealCell(startX, startY) {
  if (game.status === 'won' || game.status === 'lost') return false;

  var startCell = getCell(startX, startY);
  if (!startCell || startCell.flagged || startCell.revealed) return false;

  if (game.firstRevealPending) {
    placeMines(startX, startY);
    game.firstRevealPending = false;
    game.status = 'playing';
    startCell = getCell(startX, startY);
  }

  if (startCell.mine) {
    startCell.revealed = true;
    game.status = 'lost';
    game.message = 'Mine hit.';
    revealAllMines();
    syncWorldWidgets();
    return true;
  }

  var queue = [[startX, startY]];
  while (queue.length) {
    var next = queue.pop();
    var x = next[0];
    var y = next[1];
    var cell = getCell(x, y);
    if (!cell || cell.revealed || cell.flagged) continue;
    if (cell.mine) continue;

    cell.revealed = true;
    game.revealedCount++;

    if (cell.adjacent === 0) {
      eachNeighbor(x, y, function (nx, ny) {
        var neighbor = getCell(nx, ny);
        if (!neighbor || neighbor.revealed || neighbor.flagged || neighbor.mine) return;
        queue.push([nx, ny]);
      });
    }
  }

  game.message = 'Revealed: ' + game.revealedCount;
  checkWin();
  syncWorldWidgets();
  return true;
}

function toggleFlag(x, y) {
  if (game.status === 'won' || game.status === 'lost') return false;
  var cell = getCell(x, y);
  if (!cell || cell.revealed) return false;

  cell.flagged = !cell.flagged;
  game.flagsPlaced += cell.flagged ? 1 : -1;
  game.status = game.firstRevealPending ? 'ready' : 'playing';
  game.message = cell.flagged ? 'Flag set.' : 'Flag removed.';
  syncWorldWidgets();
  return true;
}

function boardCellFromPixel(x, y) {
  var layout = game.layout;
  if (!layout) return null;
  if (x < layout.boardX || y < layout.boardY) return null;
  if (x >= layout.boardX + layout.boardWidth || y >= layout.boardY + layout.boardHeight) return null;

  var cellX = Math.floor((x - layout.boardX) / layout.cellSize);
  var cellY = Math.floor((y - layout.boardY) / layout.cellSize);
  if (cellX < 0 || cellY < 0 || cellX >= game.cols || cellY >= game.rows) return null;
  return { x: cellX, y: cellY };
}

function hasTouchCapability() {
  try {
    return typeof navigator !== 'undefined' && Number(navigator.maxTouchPoints || 0) > 0;
  } catch (err) {
    return false;
  }
}

function shouldUseLongPressFlagging() {
  return !!game.settings.longPressFlag && hasTouchCapability();
}

function enterFlagMode() {
  game.flagMode = true;
}

function exitFlagMode() {
  game.flagMode = false;
}

function toggleFlagMode() {
  game.flagMode = !game.flagMode;
}

function applyPrimaryTileAction(x, y) {
  if (game.flagMode) {
    var changed = toggleFlag(x, y);
    if (changed && !game.settings.stickyFlagMode) exitFlagMode();
    return changed;
  }
  return revealCell(x, y);
}

function rememberSectionForBack(sectionIndex) {
  if (typeof sectionIndex !== 'number') return;
  var stack = game.navBackStack;
  if (stack.length && stack[stack.length - 1] === sectionIndex) return;
  stack.push(sectionIndex);
  if (stack.length > NAV_HISTORY_MAX) stack.splice(0, stack.length - NAV_HISTORY_MAX);
}

function rememberSectionForForward(sectionIndex) {
  if (typeof sectionIndex !== 'number') return;
  var stack = game.navForwardStack;
  if (stack.length && stack[stack.length - 1] === sectionIndex) return;
  stack.push(sectionIndex);
  if (stack.length > NAV_HISTORY_MAX) stack.splice(0, stack.length - NAV_HISTORY_MAX);
}

function clearForwardHistory() {
  game.navForwardStack.length = 0;
}

function currentSectionIndex() {
  return worlds && typeof worlds.currentSection === 'number' ? worlds.currentSection : null;
}

function focusWorldSection(target) {
  if (!worlds || !worlds.camera || typeof worlds.camera.focusOnSectionFit !== 'function') return;
  var fill = target === 'Play' ? PLAY_SECTION_FIT : CARD_SECTION_FIT;
  worlds.camera.focusOnSectionFit(target, fill, { keepRotation: true });
}

function navigateToSectionWithHistory(target, fromSectionIndex) {
  rememberSectionForBack(fromSectionIndex);
  clearForwardHistory();
  focusWorldSection(target);
}

function goBackInHistory(fallbackTarget) {
  if (!game.navBackStack.length) {
    if (fallbackTarget) focusWorldSection(fallbackTarget);
    return false;
  }

  var current = currentSectionIndex();
  var previous = game.navBackStack.pop();
  if (typeof current === 'number') rememberSectionForForward(current);
  focusWorldSection(previous);
  return true;
}

function getNavigationSourceSection(activated) {
  if (activated && typeof activated.sectionIndex === 'number') return activated.sectionIndex;
  return currentSectionIndex();
}

function syncPlaySectionVisibility() {
  if (!worlds || typeof worlds.setSectionVisible !== 'function') return;
  if (typeof game.sections.play !== 'number') return;

  var shouldHide = currentSectionIndex() === game.sections.play;
  if (game.playCardHidden === shouldHide) return;

  worlds.setSectionVisible(game.sections.play, !shouldHide);
  game.playCardHidden = shouldHide;
}

function handleWorldLinkActions() {
  if (!worlds || !worlds.links || typeof worlds.links.popActivated !== 'function') return;

  for (;;) {
    var activated = worlds.links.popActivated();
    if (!activated) break;

    var fromSection = getNavigationSourceSection(activated);

    if (activated.url === 'action:open-settings') {
      navigateToSectionWithHistory('Settings', fromSection);
      continue;
    }
    if (activated.url === 'action:open-help') {
      navigateToSectionWithHistory('Help', fromSection);
      continue;
    }
    if (activated.url === 'action:history-back') {
      goBackInHistory('Play');
      continue;
    }
    if (activated.url === 'action:restart-game') {
      resetGame();
      continue;
    }
    if (activated.url === 'action:difficulty-easy') {
      setDifficulty('easy');
      continue;
    }
    if (activated.url === 'action:difficulty-medium') {
      setDifficulty('medium');
      continue;
    }
    if (activated.url === 'action:difficulty-hard') {
      setDifficulty('hard');
      continue;
    }
    if (activated.url === 'action:toggle-long-press') {
      game.settings.longPressFlag = !game.settings.longPressFlag;
      syncWorldWidgets();
      continue;
    }
    if (activated.url === 'action:toggle-sticky-flag') {
      game.settings.stickyFlagMode = !game.settings.stickyFlagMode;
      syncWorldWidgets();
    }
  }
}

function computeToolbarButtons(layout) {
  var specs = [
    { id: 'toolbar-restart', label: '⟳', square: true },
    { id: 'toolbar-mode', label: game.flagMode ? '⚑' : '⚑', square: true },
    { id: 'toolbar-settings', label: '⚙', square: true },
    { id: 'toolbar-help', label: '🛈', square: true }
  ];

  var buttons = [];
  var widths = [];
  var totalWidth = 0;
  for (var i = 0; i < specs.length; i++) {
    var spec = specs[i];
    var specWidth = spec.square
      ? layout.iconButtonSize
      : Math.max(layout.minButtonWidth, spec.label.length * layout.cw + layout.buttonPaddingX * 2);
    widths.push(specWidth);
    totalWidth += specWidth;
  }
  totalWidth += layout.gap * Math.max(0, specs.length - 1);

  var x = Math.max(layout.pad, Math.floor((layout.width - totalWidth) * 0.5));
  var y = layout.pad;
  var gap = layout.gap;
  var h = layout.buttonHeight;
  for (var i = 0; i < specs.length; i++) {
    buttons.push({ id: specs[i].id, label: specs[i].label, x: x, y: y, width: widths[i], height: h });
    x += widths[i] + gap;
  }
  return buttons;
}

function computePlayLayout() {
  var width = ui.metrics.canvasWidth || 1280;
  var height = ui.metrics.canvasHeight || 720;
  var isPortrait = height >= width;
  var cw = Math.max(8, ui.metrics.charWidth || 10);
  var ch = Math.max(12, ui.metrics.charHeight || 16);
  var pad = isPortrait
    ? Math.max(14, Math.floor(width * 0.035))
    : Math.max(18, Math.floor(Math.min(width, height) * 0.024));
  var gap = isPortrait
    ? Math.max(10, Math.floor(width * 0.02))
    : Math.max(8, Math.floor(ch * 0.35));
  var buttonHeight = isPortrait
    ? Math.max(44, Math.floor(Math.min(width, height) * 0.065))
    : Math.max(38, Math.floor(ch * 2.15));
  var buttonPaddingX = Math.max(18, Math.floor(cw * 1.3));
  var minButtonWidth = Math.max(102, Math.floor(cw * 9));
  var iconButtonSize = isPortrait
    ? Math.max(buttonHeight, Math.min(84, Math.floor(width * 0.12)))
    : Math.max(buttonHeight, Math.min(72, Math.floor(Math.min(width, height) * 0.08)));

  var toolbarSeed = {
    width: width,
    pad: pad,
    gap: gap,
    buttonHeight: buttonHeight,
    buttonPaddingX: buttonPaddingX,
    minButtonWidth: minButtonWidth,
    iconButtonSize: iconButtonSize,
    cw: cw
  };
  var buttons = computeToolbarButtons(toolbarSeed);
  var toolbarBottom = pad + buttonHeight;
  for (var i = 0; i < buttons.length; i++) {
    toolbarBottom = Math.max(toolbarBottom, buttons[i].y + buttons[i].height);
  }

  var footerHeight = isPortrait
    ? Math.max(72, Math.floor(ch * 3.6))
    : Math.max(56, Math.floor(ch * 3.2));
  var usableWidth = Math.max(240, width - pad * 2);
  var usableHeight = Math.max(240, height - toolbarBottom - footerHeight - pad * 2);
  var cellSize = Math.floor(Math.min(usableWidth / game.cols, usableHeight / game.rows));
  cellSize = clamp(cellSize, isPortrait ? 22 : 18, isPortrait ? 72 : 64);

  var boardWidth = game.cols * cellSize;
  var boardHeight = game.rows * cellSize;
  var boardX = Math.floor((width - boardWidth) * 0.5);
  var boardY = toolbarBottom + gap + Math.floor(Math.max(0, usableHeight - boardHeight) * (isPortrait ? 0.08 : 0.28));

  return {
    width: width,
    height: height,
    isPortrait: isPortrait,
    cw: cw,
    ch: ch,
    pad: pad,
    gap: gap,
    buttonHeight: buttonHeight,
    buttonPaddingX: buttonPaddingX,
    minButtonWidth: minButtonWidth,
    iconButtonSize: iconButtonSize,
    toolbarButtons: buttons,
    toolbarBottom: toolbarBottom,
    boardX: boardX,
    boardY: boardY,
    boardWidth: boardWidth,
    boardHeight: boardHeight,
    cellSize: cellSize,
    footerHeight: footerHeight
  };
}

function updateHoverCell() {
  game.hoverCell = boardCellFromPixel(ui.pointer.x(), ui.pointer.y());
}

function handleToolbarButtons(layout) {
  var buttons = layout.toolbarButtons || [];
  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    if (!ui.button(button.id, button.x, button.y, button.width, button.height, button.label)) continue;

    if (button.id === 'toolbar-restart') {
      resetGame();
      continue;
    }
    if (button.id === 'toolbar-mode') {
      toggleFlagMode();
      continue;
    }
    if (button.id === 'toolbar-settings') {
      navigateToSectionWithHistory('Settings', currentSectionIndex());
      continue;
    }
    if (button.id === 'toolbar-help') {
      navigateToSectionWithHistory('Help', currentSectionIndex());
    }
  }
}

function drawToolbarButtons(layout) {
  var buttons = layout.toolbarButtons || [];
  for (var i = 0; i < buttons.length; i++) {
    var button = buttons[i];
    ui.button(button.id, button.x, button.y, button.width, button.height, button.label);
  }
}

function beginBoardPointer(event, cell) {
  game.pointer.active = true;
  game.pointer.cellX = cell.x;
  game.pointer.cellY = cell.y;
  game.pointer.startX = Number(event.x || 0);
  game.pointer.startY = Number(event.y || 0);
  game.pointer.startAt = Date.now();
  game.pointer.longPressFired = false;
  game.pointer.moved = false;
}

function updateBoardPointerMove(event) {
  if (!game.pointer.active) return;
  var dx = Number(event.x || 0) - game.pointer.startX;
  var dy = Number(event.y || 0) - game.pointer.startY;
  if (Math.sqrt(dx * dx + dy * dy) > POINTER_MOVE_TOLERANCE) {
    game.pointer.moved = true;
  }
}

function finishBoardPointer(event) {
  if (!game.pointer.active) return;

  var releaseCell = boardCellFromPixel(Number(event.x || 0), Number(event.y || 0));
  var sameCell = !!releaseCell && releaseCell.x === game.pointer.cellX && releaseCell.y === game.pointer.cellY;

  if (!game.pointer.longPressFired && sameCell && !game.pointer.moved) {
    applyPrimaryTileAction(game.pointer.cellX, game.pointer.cellY);
  }

  clearPointerGesture();
}

function handleBoardPointerUI() {
  var mouseX = ui.pointer.x();
  var mouseY = ui.pointer.y();
  var leftPressed = ui.pointer.clicked(0);
  var rightPressed = ui.pointer.clicked(2);
  var leftDown = ui.pointer.down(0);
  var cell = boardCellFromPixel(mouseX, mouseY);

  if (rightPressed && cell) {
    toggleFlag(cell.x, cell.y);
  }

  if (leftPressed && cell) {
    beginBoardPointer({ x: mouseX, y: mouseY }, cell);
  }

  if (game.pointer.active && leftDown) {
    updateBoardPointerMove({ x: mouseX, y: mouseY });
  }

  if (game.pointer.active && !leftDown) {
    finishBoardPointer({ x: mouseX, y: mouseY });
  }
}

function updateLongPressFlagging() {
  if (!game.pointer.active || game.pointer.longPressFired) return;
  if (!shouldUseLongPressFlagging()) return;
  if (game.pointer.moved) return;

  var elapsed = Date.now() - game.pointer.startAt;
  if (elapsed < LONG_PRESS_MS) return;

  var cell = getCell(game.pointer.cellX, game.pointer.cellY);
  if (cell && !cell.revealed) {
    toggleFlag(game.pointer.cellX, game.pointer.cellY);
  }
  game.pointer.longPressFired = true;
}

function tileText(cell) {
  if (!cell.revealed) {
    return cell.flagged ? '⚑' : '';
  }
  if (cell.mine) return '✷';
  if (cell.adjacent <= 0) return '';
  return String(cell.adjacent);
}

function tileTextColor(cell) {
  var palette = getPalette();
  if (!cell.revealed) {
    return cell.flagged ? alphaColor(palette.flag, 1) : alphaColor(palette.hiddenText, 1);
  }
  if (cell.mine) return alphaColor(palette.mineText, 1);
  if (cell.adjacent <= 0) return alphaColor(palette.revealedText, 0.8);

  var colors = [
    palette.revealedText,
    palette.one,
    palette.two,
    palette.three,
    palette.four,
    palette.five,
    palette.six,
    palette.seven,
    palette.eight
  ];
  return alphaColor(colors[cell.adjacent] || palette.revealedText, 1);
}

function measureUITextWidth(text, fallbackCharWidth) {
  var value = String(text == null ? '' : text);
  if (!value) return 0;
  try {
    if (ui && ui.metrics && typeof ui.metrics.measureTextWidth === 'function') {
      return ui.metrics.measureTextWidth(value);
    }
  } catch (err) {}
  return value.length * fallbackCharWidth;
}

function getPalette() {
  var base = getStyle('default');
  var accent = getStyle('accent1');
  var accent2 = getStyle('accent2');
  var accent3 = getStyle('accent3');
  var info = getStyle('info');
  return {
    frame: accent2.fg,
    panelBg: base.bg,
    panelBorder: accent2.fg,
    hidden: alphaColor(accent2.fg, 0.28),
    hiddenHover: alphaColor(accent2.fg, 0.42),
    hiddenPressed: alphaColor(accent2.fg, 0.55),
    revealed: alphaColor(base.fg, 0.08),
    revealedAlt: alphaColor(base.fg, 0.12),
    flag: accent.fg,
    mine: accent3.fg,
    mineText: accent3.fg,
    hiddenText: base.fg,
    revealedText: base.fg,
    one: info.fg,
    two: accent.fg,
    three: accent3.fg,
    four: accent2.fg,
    five: accent3.fg,
    six: info.fg,
    seven: accent2.fg,
    eight: base.fg,
    shadow: alphaColor(base.bg, 0.35),
    status: base.fg,
    subtle: alphaColor(base.fg, 0.65)
  };
}

function drawTile(layout, x, y, cell) {
  var palette = getPalette();
  var size = layout.cellSize;
  var px = layout.boardX + x * size;
  var py = layout.boardY + y * size;
  var hover = game.hoverCell && game.hoverCell.x === x && game.hoverCell.y === y;
  var press = game.pointer.active && game.pointer.cellX === x && game.pointer.cellY === y && !game.pointer.longPressFired;

  var bg = palette.hidden;
  if (cell.revealed) {
    bg = ((x + y) % 2 === 0) ? palette.revealed : palette.revealedAlt;
  } else if (press) {
    bg = palette.hiddenPressed;
  } else if (hover) {
    bg = palette.hiddenHover;
  }
  if (cell.mine && cell.revealed) bg = alphaColor(palette.mine, 0.34);
  if (cell.flagged && !cell.revealed) bg = alphaColor(palette.flag, 0.24);

  ui.rect(px, py, size, size, bg);
  ui.rect(px, py, size, 1, alphaColor(palette.panelBorder, 0.42));
  ui.rect(px, py + size - 1, size, 1, alphaColor(palette.panelBorder, 0.42));
  ui.rect(px, py, 1, size, alphaColor(palette.panelBorder, 0.42));
  ui.rect(px + size - 1, py, 1, size, alphaColor(palette.panelBorder, 0.42));

  var text = tileText(cell);
  if (!text) return;

  var tw = measureUITextWidth(text, layout.cw);
  var tx = px + Math.floor((size - tw) * 0.5);
  var ty = py + Math.floor((size - layout.ch) * 0.5) + 1;
  ui.text(text, tx, ty, tileTextColor(cell));
}

function drawLongPressIndicator(layout) {
  if (!game.pointer.active || game.pointer.longPressFired) return;
  if (!shouldUseLongPressFlagging() || game.pointer.moved) return;

  var elapsed = Date.now() - game.pointer.startAt;
  var progress = clamp(elapsed / LONG_PRESS_MS, 0, 1);
  var x = game.pointer.cellX;
  var y = game.pointer.cellY;
  if (x < 0 || y < 0) return;

  var palette = getPalette();
  var size = layout.cellSize;
  var px = layout.boardX + x * size;
  var py = layout.boardY + y * size;
  var barWidth = Math.max(4, Math.floor((size - 6) * progress));
  ui.rect(px + 3, py + size - 5, barWidth, 2, alphaColor(palette.flag, 0.95));
}

function drawBoard(layout) {
  var palette = getPalette();
  ui.rect(layout.boardX - 10, layout.boardY - 10, layout.boardWidth + 20, layout.boardHeight + 20, alphaColor(palette.shadow, 0.65));
  ui.rect(layout.boardX - 1, layout.boardY - 1, layout.boardWidth + 2, layout.boardHeight + 2, alphaColor(palette.panelBg, 0.55));

  for (var y = 0; y < game.rows; y++) {
    for (var x = 0; x < game.cols; x++) {
      var cell = getCell(x, y);
      if (!cell) continue;
      drawTile(layout, x, y, cell);
    }
  }

  drawLongPressIndicator(layout);
}

function drawFooter(layout) {
  var palette = getPalette();
  var left = difficultyShortLabel() + '  ✷ ' + game.mines + '  ⚑ ' + game.flagsPlaced;
  var right = (game.flagMode ? '⚑' : '⌕') + (game.settings.stickyFlagMode ? ' S' : '') + (game.settings.longPressFlag ? ' T' : '');
  var status = statusLabel() + '  ' + game.message;
  var baseY = layout.height - layout.footerHeight + Math.max(20, Math.floor(layout.ch * 1.2));

  ui.text(left, layout.pad, baseY, alphaColor(palette.status, 1));
  ui.text(status, layout.pad, baseY + layout.ch + 4, alphaColor(palette.subtle, 1));

  if (layout.isPortrait) {
    var portraitRightX = layout.width - layout.pad - measureUITextWidth(right, layout.cw);
    ui.text(right, Math.max(layout.pad, portraitRightX), baseY + layout.ch + 4, alphaColor(palette.status, 0.9));
  } else {
    var rightX = layout.width - layout.pad - measureUITextWidth(right, layout.cw);
    ui.text(right, Math.max(layout.pad, rightX), baseY, alphaColor(palette.status, 0.9));
  }
}
```

```javascript on:init
term.layerID = 'default';
resetGame();

worlds.enable();
worlds.controls.setEnabled(false);
if (worlds.links && typeof worlds.links.setKeyHandlingEnabled === 'function') {
  worlds.links.setKeyHandlingEnabled(true);
}

worlds.config.setDefaults({
  sectionOverflow: 'fit-y',
  sectionClickFocusEnabled: false,
  defaultSectionWidth: 42,
  defaultSectionHeight: 32,
  autoLayoutSpacing: 150
});

worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSectionFit('Play', PLAY_SECTION_FIT);

syncWorldWidgets();
```

```javascript on:input
if (!event) return;

if (event.type !== 'keydown' && event.type !== 'key') return;

var key = String(event.key || '');
if (!key) return;

if (key === 'Escape') {
  goBackInHistory('Play');
  return;
}

if (key === 's' || key === 'S') {
  navigateToSectionWithHistory('Settings', currentSectionIndex());
  return;
}

if (key === 'h' || key === 'H' || key === '?') {
  navigateToSectionWithHistory('Help', currentSectionIndex());
  return;
}

if (key === '1') {
  setDifficulty('easy');
  return;
}

if (key === '2') {
  setDifficulty('medium');
  return;
}

if (key === '3') {
  setDifficulty('hard');
}
```

```javascript on:input section:play
if (!event) return;

if (event.type === 'keydown' || event.type === 'key') {
  var key = String(event.key || '');
  if (key === 'r' || key === 'R') {
    resetGame();
    return;
  }
  if (key === 'f' || key === 'F') {
    toggleFlagMode();
    return;
  }
  if (key === ' ') {
    toggleFlagMode();
    return;
  }
}
```

```javascript on:update
handleSettingsWorldWidgetEvents();
handleWorldLinkActions();
syncPlaySectionVisibility();
syncWorldWidgets();
```

```javascript on:update section:play
game.layout = computePlayLayout();
updateHoverCell();
handleToolbarButtons(game.layout);
handleBoardPointerUI();
updateLongPressFlagging();
```

```javascript on:render
term.layerID = 'default';
term.clear();
ui.clear();
```

```javascript on:render section:play
var layout = game.layout || computePlayLayout();
drawToolbarButtons(layout);
drawBoard(layout);
drawFooter(layout);
```