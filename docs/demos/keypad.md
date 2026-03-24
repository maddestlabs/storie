---
name: "Soft Keypad Demo"
theme: "zerorain"
font: "AnomalyMono"
fontsize: 18
---

```js
var SEED_MAX_DIGITS = 12;

var guiMouseDown = false;
var seedText = String(random.seed());
var statusText = 'Tap the seed field or the buttons below it.';
var currentBreakpoint = '';
var widgets = null;
var layouts = null;

var keypadSpec = [
  { label: '1', action: 'digit', value: '1' },
  { label: '2', action: 'digit', value: '2' },
  { label: '3', action: 'digit', value: '3' },
  { label: 'Back', action: 'backspace' },
  { label: '4', action: 'digit', value: '4' },
  { label: '5', action: 'digit', value: '5' },
  { label: '6', action: 'digit', value: '6' },
  { label: 'Clear', action: 'clear' },
  { label: '7', action: 'digit', value: '7' },
  { label: '8', action: 'digit', value: '8' },
  { label: '9', action: 'digit', value: '9' },
  { label: 'Rand', action: 'randomize' },
  { label: 'Copy', action: 'copy' },
  { label: '0', action: 'digit', value: '0' },
  { label: 'Paste', action: 'paste' },
  { label: 'Done', action: 'done' }
];

function normalizeSeedText(value) {
  return String(value == null ? '' : value).replace(/\D+/g, '').slice(0, SEED_MAX_DIGITS);
}

function setStatus(next) {
  statusText = String(next == null ? '' : next);
  if (widgets && widgets.statusLabel) widgets.statusLabel.setText(statusText);
}

function isSeedFocused() {
  return !!(widgets && widgets.seedInput && widgets.seedInput.state.focused);
}

function syncWidgetState() {
  if (!widgets) return;
  if (widgets.seedInput.getValue() !== seedText) {
    widgets.seedInput.setValue(seedText);
  }
  widgets.statusLabel.setText(statusText);
  if (widgets.seedValueLabel) {
    widgets.seedValueLabel.setText('Numeric value: ' + (seedText.length ? String(Math.floor(Number(seedText))) : '-'));
  }
}

function appendSeedDigit(digit) {
  if (isSeedFocused() && widgets.seedInput && typeof widgets.seedInput.handleText === 'function') {
    if (String(widgets.seedInput.getValue() || '').length >= SEED_MAX_DIGITS) {
      setStatus('Seed is already at max length.');
      return;
    }
    widgets.seedInput.handleText(String(digit));
    setStatus('Inserted ' + String(digit) + '.');
    return;
  }

  var next = normalizeSeedText(seedText + String(digit));
  if (next === seedText) {
    setStatus('Seed is already at max length.');
    return;
  }
  seedText = next;
  setStatus('Inserted ' + String(digit) + '.');
  syncWidgetState();
}

function removeSeedDigit() {
  if (isSeedFocused() && widgets.seedInput && typeof widgets.seedInput.handleKey === 'function') {
    widgets.seedInput.handleKey('Backspace');
    setStatus('Removed digit at cursor.');
    return;
  }

  if (!seedText.length) {
    setStatus('Seed is already empty.');
    return;
  }
  seedText = seedText.slice(0, -1);
  setStatus('Removed last digit.');
  syncWidgetState();
}

function clearSeedDigits() {
  if (!seedText.length) {
    setStatus('Seed is already empty.');
    return;
  }
  seedText = '';
  setStatus('Cleared seed.');
  syncWidgetState();
}

function randomizeSeedDigits() {
  seedText = String(random.seed());
  setStatus('Randomized seed.');
  syncWidgetState();
}

function copySeedDigits() {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    setStatus('Clipboard copy is not available here.');
    return;
  }
  void navigator.clipboard.writeText(seedText).then(function () {
    setStatus(seedText.length ? 'Copied seed to clipboard.' : 'Copied empty seed to clipboard.');
  }).catch(function () {
    setStatus('Clipboard copy failed.');
  });
}

function pasteSeedDigits() {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
    setStatus('Clipboard paste is not available here.');
    return;
  }
  void navigator.clipboard.readText().then(function (text) {
    seedText = normalizeSeedText(text);
    setStatus(seedText.length ? 'Pasted seed from clipboard.' : 'Clipboard had no digits to paste.');
    syncWidgetState();
  }).catch(function () {
    setStatus('Clipboard paste failed.');
  });
}

function applyKeypadAction(action, value) {
  if (action === 'digit') return appendSeedDigit(value);
  if (action === 'backspace') return removeSeedDigit();
  if (action === 'clear') return clearSeedDigits();
  if (action === 'randomize') return randomizeSeedDigits();
  if (action === 'copy') return copySeedDigits();
  if (action === 'paste') return pasteSeedDigits();
  if (action === 'done') {
    gui.clearFocus();
    setStatus('Closed keypad.');
  }
}

function handleFocusedSeedKey(event) {
  if (!isSeedFocused()) return false;

  var key = String(event.key || '');
  var mods = event.mods || [];
  var ctrl = mods.includes('ctrl') || mods.includes('meta');
  var alt = mods.includes('alt');

  if (!ctrl && !alt && /^[0-9]$/.test(key)) {
    appendSeedDigit(key);
    return true;
  }
  if (!ctrl && !alt && (key === 'Backspace' || key === 'Delete')) {
    removeSeedDigit();
    return true;
  }
  if (!ctrl && !alt && key === 'Enter') {
    gui.clearFocus();
    setStatus('Closed keypad.');
    return true;
  }
  return false;
}

function getBreakpointConfig() {
  var viewport = gui.getViewportRect();
  var width = viewport && viewport.width ? viewport.width : 800;
  var height = viewport && viewport.height ? viewport.height : 600;
  var info = gui.getResponsiveInfo({ width: width, height: height });
  var tokens = gui.getTokens();
  var breakpoint = info.breakpoint === 'xs' ? 'xs' : info.breakpoint === 'sm' ? 'sm' : 'md';

  if (breakpoint === 'xs') {
    return {
      breakpoint: 'xs',
      insetX: tokens.spacing.sm,
      insetY: tokens.spacing.md,
      panelPadding: tokens.spacing.md,
      sectionGap: tokens.spacing.sm,
      buttonGap: tokens.spacing.sm,
      maxWidth: Math.max(280, Math.min(380, info.usableWidth || width)),
      columns: 2,
      showSubtitle: false,
      showSeedValue: false,
      footerText: 'Tap buttons or type digits.'
    };
  }

  if (breakpoint === 'sm') {
    return {
      breakpoint: 'sm',
      insetX: tokens.spacing.md,
      insetY: tokens.spacing.lg,
      panelPadding: tokens.spacing.lg,
      sectionGap: tokens.spacing.sm,
      buttonGap: tokens.spacing.sm,
      maxWidth: Math.max(360, Math.min(520, info.usableWidth || width)),
      columns: 3,
      showSubtitle: true,
      showSeedValue: false,
      footerText: 'Tap buttons or type digits. Copy/Paste works when clipboard is available.'
    };
  }

  return {
    breakpoint: 'md',
    insetX: tokens.spacing.lg,
    insetY: tokens.spacing.xl,
    panelPadding: tokens.spacing.lg,
    sectionGap: tokens.spacing.md,
    buttonGap: tokens.spacing.md,
    maxWidth: Math.max(420, Math.min(620, info.usableWidth || width)),
    columns: 4,
    showSubtitle: true,
    showSeedValue: true,
    footerText: 'Tap buttons or type digits. Copy/Paste uses the browser clipboard when available.'
  };
}

function rebuildLayout(force) {
  var config = getBreakpointConfig();
  if (!widgets || !layouts) {
    gui.init();

    var tokens = gui.getTokens();
    var keypadButtons = [];

    layouts = {
      root: gui.createResponsivePanel({
        bounds: { x: 0, y: 0, width: 420, height: 1 },
        gap: tokens.spacing.md,
        padding: tokens.spacing.lg,
        maxWidth: 620,
        layout: { widthPolicy: 'fill', heightPolicy: 'fit-content' }
      }),
      keypad: gui.createContainer({
        bounds: { x: 0, y: 0, width: 1, height: 1 },
        mode: 'grid',
        columns: 4,
        rowGap: tokens.spacing.sm,
        columnGap: tokens.spacing.sm,
        alignX: 'stretch',
        alignY: 'stretch',
        layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
      })
    };

    var title = gui.createLabel({
      focusable: false,
      align: 'center',
      bounds: { x: 0, y: 0, width: 1, height: 30 },
      text: 'Soft Keypad Demo',
      labelStyle: { typographyRole: 'title' },
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var subtitle = gui.createLabel({
      focusable: false,
      align: 'center',
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: 'Responsive soft keypad with fluid relayout',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var seedLabel = gui.createLabel({
      focusable: false,
      align: 'left',
      bounds: { x: 0, y: 0, width: 1, height: 20 },
      text: 'SEED',
      labelStyle: { typographyRole: 'caption' },
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var seedInput = gui.createTextField({
      align: 'right',
      bounds: { x: 0, y: 0, width: 1, height: 44 },
      value: seedText,
      placeholder: 'Seed',
      textInput: {
        showSoftKeyboard: false
      },
      textFieldStyle: {
        fg: ui.colors.rgba(255, 255, 255, 220),
        drawBorder: false,
        drawBackground: false
      },
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var seedValueLabel = gui.createLabel({
      focusable: false,
      align: 'left',
      bounds: { x: 0, y: 0, width: 1, height: 22 },
      text: '',
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    var statusLabel = gui.createLabel({
      focusable: false,
      align: 'left',
      bounds: { x: 0, y: 0, width: 1, height: 22 },
      text: statusText,
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    for (var i = 0; i < keypadSpec.length; i++) {
      var spec = keypadSpec[i];
      var button = gui.createButton({
        focusable: false,
        bounds: { x: 0, y: 0, width: 1, height: 46 },
        label: spec.label,
        layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
      });
      (function (buttonAction, buttonValue) {
        button.on('click', function () {
          applyKeypadAction(buttonAction, buttonValue);
        });
      })(spec.action, spec.value);
      keypadButtons.push({ action: spec.action, value: spec.value, button: button });
      layouts.keypad.add(button);
    }

    var footerLabel = gui.createLabel({
      focusable: false,
      align: 'left',
      bounds: { x: 0, y: 0, width: 1, height: 24 },
      text: config.footerText,
      layout: { widthPolicy: 'fill', heightPolicy: 'fit-content', minWidth: 0 }
    });

    layouts.root
      .add(title)
      .add(subtitle)
      .add(seedLabel)
      .add(seedInput)
      .add(seedValueLabel)
      .add(statusLabel)
      .add(layouts.keypad)
      .add(footerLabel);

    widgets = {
      title: title,
      subtitle: subtitle,
      seedLabel: seedLabel,
      seedInput: seedInput,
      seedValueLabel: seedValueLabel,
      statusLabel: statusLabel,
      footerLabel: footerLabel,
      keypadButtons: keypadButtons
    };
  }

  currentBreakpoint = config.breakpoint;
  widgets.subtitle.setVisible(config.showSubtitle);
  widgets.seedValueLabel.setVisible(config.showSeedValue);
  widgets.footerLabel.setText(config.footerText);

  layouts.root.container.padding = config.panelPadding;
  layouts.root.container.gap = config.sectionGap;
  layouts.root.setMaxWidth(config.maxWidth, false);
  layouts.keypad.setColumns(config.columns, false);
  layouts.keypad.gap = config.buttonGap;
  layouts.keypad.rowGap = config.buttonGap;
  layouts.keypad.columnGap = config.buttonGap;

  var viewport = gui.getViewportRect();
  layouts.root.fitToViewport(viewport, {
    insetTop: config.insetY,
    insetRight: config.insetX,
    insetBottom: config.insetY,
    insetLeft: config.insetX,
    safeArea: true,
    maxWidth: config.maxWidth,
    anchorX: 'center',
    anchorY: 'start'
  }, false);
  layouts.root.layout();
  syncWidgetState();
}

function ensureLayout() {
  if (!widgets) {
    rebuildLayout(true);
  }
  return !!widgets;
}
```

```js on:init
term.layerID = 'default';
gui.init();
rebuildLayout(true);
```

```js on:input
if (!event) return;
if (!ensureLayout()) return;

if (event.type === 'keydown') {
  if (event.key === 'Escape' && widgets.seedInput.state.focused) {
    gui.clearFocus();
    return;
  }

  if (handleFocusedSeedKey(event)) {
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
  if (!widgets.seedInput.state.focused) {
    gui.handleText(event.text);
  }
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    guiMouseDown = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, guiMouseDown);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, guiMouseDown);
}
```

```js on:update
if (!ensureLayout()) return;
rebuildLayout(false);
if (!widgets) return;
gui.update(getMouseX(), getMouseY(), guiMouseDown);

if (widgets.seedInput.wasChanged()) {
  seedText = normalizeSeedText(widgets.seedInput.getValue());
  setStatus('Seed updated from text field.');
  syncWidgetState();
}

var focused = !!widgets.seedInput.state.focused;
widgets.seedInput.textFieldStyle.drawBorder = focused;
widgets.seedInput.textFieldStyle.drawBackground = focused;

syncWidgetState();
```

```js on:render
term.layerID = 'default';
term.clear();
ui.clear(getStyle('default').bg);
```