---
name: "Soft Keypad Demo"
theme: "zerorain"
font: "AnomalyMono"
fontsize: 18
authoringCheck: explicit-conditionals
---

```js
var SEED_MAX_DIGITS = 12;

var state = {
  seedText: String(random.seed()),
  statusText: 'Tap the seed field or the buttons below it.',
  breakpoint: '',
  footerText: '',
  subtitleVisible: true,
  seedValueVisible: true
};

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
  var source = value;
  if (source == null) source = '';
  return String(source).replace(/\D+/g, '').slice(0, SEED_MAX_DIGITS);
}

function getSeedInput() {
  return gui.get('seedInput');
}

function syncDerivedLabels() {
  var numericValue = '-';
  if (state.seedText.length) {
    numericValue = String(Math.floor(Number(state.seedText)));
  }
  gui.text('statusLabel', state.statusText);
  gui.text('seedValueLabel', 'Numeric value: ' + numericValue);
}

function setStatus(next) {
  var status = next;
  if (status == null) status = '';
  state.statusText = String(status);
  syncDerivedLabels();
}

function isSeedFocused() {
  var seedInput = getSeedInput();
  return !!(seedInput && seedInput.state.focused);
}

function syncSeedFromWidget(status) {
  var seedInput = getSeedInput();
  if (!seedInput || typeof seedInput.getValue !== 'function') return;

  var next = normalizeSeedText(seedInput.getValue());
  if (typeof seedInput.setValue === 'function' && seedInput.getValue() !== next) {
    seedInput.setValue(next);
  }
  state.seedText = next;
  gui.syncBindings();
  if (arguments.length) setStatus(status);
  else syncDerivedLabels();
}

function appendSeedDigit(digit) {
  var seedInput = getSeedInput();
  if (isSeedFocused() && seedInput && typeof seedInput.handleText === 'function') {
    if (String(seedInput.getValue() || '').length >= SEED_MAX_DIGITS) {
      setStatus('Seed is already at max length.');
      return;
    }
    seedInput.handleText(String(digit));
    syncSeedFromWidget('Inserted ' + String(digit) + '.');
    return;
  }

  var next = normalizeSeedText(state.seedText + String(digit));
  if (next === state.seedText) {
    setStatus('Seed is already at max length.');
    return;
  }
  state.seedText = next;
  gui.syncBindings();
  setStatus('Inserted ' + String(digit) + '.');
}

function removeSeedDigit() {
  var seedInput = getSeedInput();
  if (isSeedFocused() && seedInput && typeof seedInput.handleKey === 'function') {
    seedInput.handleKey('Backspace');
    syncSeedFromWidget('Removed digit at cursor.');
    return;
  }

  if (!state.seedText.length) {
    setStatus('Seed is already empty.');
    return;
  }
  state.seedText = state.seedText.slice(0, -1);
  gui.syncBindings();
  setStatus('Removed last digit.');
}

function clearSeedDigits() {
  if (!state.seedText.length) {
    setStatus('Seed is already empty.');
    return;
  }
  state.seedText = '';
  gui.syncBindings();
  setStatus('Cleared seed.');
}

function randomizeSeedDigits() {
  state.seedText = String(random.seed());
  gui.syncBindings();
  setStatus('Randomized seed.');
}

function copySeedDigits() {
  if (typeof navigator === 'undefined' || !navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
    setStatus('Clipboard copy is not available here.');
    return;
  }
  void navigator.clipboard.writeText(state.seedText).then(function () {
    if (state.seedText.length) {
      setStatus('Copied seed to clipboard.');
      return;
    }
    setStatus('Copied empty seed to clipboard.');
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
    state.seedText = normalizeSeedText(text);
    gui.syncBindings();
    if (state.seedText.length) {
      setStatus('Pasted seed from clipboard.');
      return;
    }
    setStatus('Clipboard had no digits to paste.');
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

function getBreakpointConfig(viewport, info, tokens) {
  var width = 800;
  if (viewport && viewport.width) width = viewport.width;

  var usableWidth = width;
  if (info && info.usableWidth) usableWidth = info.usableWidth;

  var breakpoint = 'md';
  if (info.breakpoint === 'xs') breakpoint = 'xs';
  else if (info.breakpoint === 'sm') breakpoint = 'sm';

  if (breakpoint === 'xs') {
    return {
      breakpoint: 'xs',
      insetX: tokens.spacing.sm,
      insetY: tokens.spacing.md,
      panelPadding: tokens.spacing.md,
      sectionGap: tokens.spacing.sm,
      buttonGap: tokens.spacing.sm,
      maxWidth: Math.max(280, Math.min(380, usableWidth)),
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
      maxWidth: Math.max(360, Math.min(520, usableWidth)),
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
    maxWidth: Math.max(420, Math.min(620, usableWidth)),
    columns: 4,
    showSubtitle: true,
    showSeedValue: true,
    footerText: 'Tap buttons or type digits. Copy/Paste uses the browser clipboard when available.'
  };
}

function buildKeypadWidgets() {
  var widgets = {};
  for (var i = 0; i < keypadSpec.length; i++) {
    (function (index, spec) {
      widgets['keypad_' + index] = gui.button(spec.label, {
        focusable: false,
        bounds: { height: 46 },
        onClick: function () {
          applyKeypadAction(spec.action, spec.value);
        }
      });
    })(i, keypadSpec[i]);
  }
  return widgets;
}

function syncKeypadLayout(ctx) {
  if (!ctx || !ctx.viewport || !ctx.root || !ctx.widgets) return;

  var config = getBreakpointConfig(ctx.viewport, ctx.responsive, ctx.tokens || gui.getTokens());
  state.breakpoint = config.breakpoint;
  state.footerText = config.footerText;
  state.subtitleVisible = config.showSubtitle;
  state.seedValueVisible = config.showSeedValue;

  ctx.widgets.subtitle.setVisible(config.showSubtitle);
  ctx.widgets.seedValueLabel.setVisible(config.showSeedValue);
  gui.text('footerLabel', config.footerText);

  if (ctx.root.container) {
    ctx.root.container.padding = config.panelPadding;
    ctx.root.container.gap = config.sectionGap;
    ctx.root.container.rowGap = config.sectionGap;
  }

  if (ctx.widgets.keypadGrid) {
    ctx.widgets.keypadGrid.setColumns(config.columns, false);
    ctx.widgets.keypadGrid.gap = config.buttonGap;
    ctx.widgets.keypadGrid.rowGap = config.buttonGap;
    ctx.widgets.keypadGrid.columnGap = config.buttonGap;
  }

  return {
    insetTop: config.insetY,
    insetRight: config.insetX,
    insetBottom: config.insetY,
    insetLeft: config.insetX,
    maxWidth: config.maxWidth,
    anchorX: 'center',
    anchorY: 'start'
  };
}
```

```js on:init
term.layerID = 'default';
gui.screen({
  input: 'auto',
  update: 'auto',
  state,
  layout: {
    type: 'panel',
    rowGap: 'md',
    anchorX: 'center',
    anchorY: 'start',
    onLayout: syncKeypadLayout
  },
  widgets: {
    title: gui.label('Soft Keypad Demo', {
      focusable: false,
      align: 'center',
      bounds: { height: 30 },
      labelStyle: { typographyRole: 'title' }
    }),
    subtitle: gui.label('Responsive soft keypad with fluid relayout', {
      focusable: false,
      align: 'center',
      bounds: { height: 24 }
    }),
    seedLabel: gui.label('SEED', {
      focusable: false,
      align: 'left',
      bounds: { height: 20 },
      labelStyle: { typographyRole: 'caption' }
    }),
    seedInput: gui.input({
      align: 'right',
      bounds: { height: 44 },
      value: state.seedText,
      bind: 'seedText',
      placeholder: 'Seed',
      textInput: {
        showSoftKeyboard: false
      },
      textFieldStyle: {
        fg: ui.colors.rgba(255, 255, 255, 220),
        drawBorder: false,
        drawBackground: false
      },
      onChange: function () {
        syncSeedFromWidget('Seed updated from text field.');
      }
    }),
    seedValueLabel: gui.label('', {
      focusable: false,
      align: 'left',
      bounds: { height: 22 }
    }),
    statusLabel: gui.label(state.statusText, {
      focusable: false,
      align: 'left',
      bounds: { height: 22 }
    }),
    keypadGrid: gui.container({
      bounds: { height: 1 },
      mode: 'grid',
      columns: 4,
      rowGap: 8,
      columnGap: 8,
      alignX: 'stretch',
      alignY: 'stretch',
      widgets: buildKeypadWidgets()
    }),
    footerLabel: gui.label('', {
      focusable: false,
      align: 'left',
      bounds: { height: 24 }
    })
  }
});

syncDerivedLabels();
```

```js on:update
var seedInput = getSeedInput();
if (!seedInput) return;

var focused = !!seedInput.state.focused;
seedInput.textFieldStyle.drawBorder = focused;
seedInput.textFieldStyle.drawBackground = focused;

syncDerivedLabels();
```

```js on:render
term.layerID = 'default';
term.clear();
ui.clear(getStyle('default').bg);
```