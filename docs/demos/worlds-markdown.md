---
title: "Worlds Markdown Content"
theme: "nord"
---

# Worlds Markdown Showcase {"x":"0","y":"0","z":"0","width":"64","height":"26","render":"all"}

This demo begins showcasing the expanded static markdown content support inside Worlds cards.

What to look for:

- Lists and internal links still work as before.
- The document defaults to content-only cards, so most section headings stay hidden.
- Blockquotes now render with a vertical quote bar.
- GitHub-style callouts such as `> [!TIP]` now render as framed admonitions.
- Horizontal rules now render as separators inside cards.
- Standalone markdown images now render from embedded blob images, including width and alignment metadata.
- ASCII fenced blocks can still render as visible preformatted content.
- Section-scoped retained GUI can now be mounted from within a Worlds section.
- Embedded `gui` fences can now place buttons, sliders, checkboxes, and labels directly in card flow.
- The intro card overrides the document default so its heading remains visible.

- [Lists and links](#lists-and-links)
- [Blockquotes and rules](#blockquotes-and-rules)
- [Blob image](#blob-image)
- [Embedded widgets](#embedded-widgets)
- [Section GUI](#section-gui)
- [ASCII fence](#ascii-fence)
- [Mixed composition](#mixed-composition)

```javascript on:init
worlds.enable();
worlds.controls.setEnabled(false);
gui.init({ boundsSpace: 'device' });

worlds.config.setDefaults({
  sectionBackground: 'paper+ruledlines',
  sectionLinkUnderline: true,
  sectionRender: 'content',
  sectionOverflow: 'fit-y',
  sectionClickFocusEnabled: true,
  defaultSectionWidth: 64,
  defaultSectionHeight: 24,
});

worlds.camera.setPosition(0, 0, 250);
worlds.camera.setRotation(0, 0, 0);
worlds.camera.setEaseSpeed(0.08, 0.12);
worlds.camera.focusOnSectionFit('Worlds Markdown Showcase', 0.92);
```

```javascript
var guiDemo = {
  mouseDownLeft: false,
  clicks: 0,
  inlineClicks: 0,
  inlineSliderValue: 0.35,
  sectionGui: null,
  widgets: null,
};

function ensureWorldsGuiDemo() {
  if (guiDemo.widgets || typeof gui === 'undefined' || typeof gui.section !== 'function') return guiDemo.widgets;

  var sectionGui = gui.section('current');
  var title = sectionGui.createLabel({
    align: 'left',
    focusable: false,
    bounds: { x: 0, y: 0, width: 320, height: 30 },
    text: 'Section GUI is active'
  });
  var button = sectionGui.createButton({
    bounds: { x: 0, y: 0, width: 220, height: 44 },
    label: 'Pulse GUI'
  });
  var status = sectionGui.createLabel({
    align: 'left',
    focusable: false,
    bounds: { x: 0, y: 0, width: 420, height: 30 },
    text: 'Clicks: 0'
  });

  guiDemo.sectionGui = sectionGui;
  guiDemo.widgets = { title: title, button: button, status: status };
  return guiDemo.widgets;
}

function layoutWorldsGuiDemo() {
  if (!guiDemo.widgets) return;

  var width = ui.metrics.canvasWidth;
  var height = ui.metrics.canvasHeight;
  var panelWidth = Math.min(420, Math.floor(width * 0.34));
  var inset = Math.max(24, Math.floor(Math.min(width, height) * 0.03));
  var lineHeight = Math.max(30, Math.floor(ui.metrics.charHeight * 1.45));
  var baseX = width - inset - panelWidth;
  var baseY = height - inset - lineHeight * 3 - 18;

  guiDemo.widgets.title.setBounds({
    x: baseX,
    y: baseY,
    width: panelWidth,
    height: lineHeight
  });
  guiDemo.widgets.button.setBounds({
    x: baseX,
    y: baseY + lineHeight + 6,
    width: panelWidth,
    height: lineHeight + 8
  });
  guiDemo.widgets.status.setBounds({
    x: baseX,
    y: baseY + lineHeight * 2 + 20,
    width: panelWidth,
    height: lineHeight
  });
}
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

if (event.type === 'text') {
  gui.handleText(event.text);
}

if (event.type === 'mouse') {
  if (event.button === 'left') {
    guiDemo.mouseDownLeft = event.action === 'press' || event.action === 'repeat';
  }
  gui.handleMouse(event.x, event.y, guiDemo.mouseDownLeft);
}

if (event.type === 'mouse_move') {
  gui.handleMouse(event.x, event.y, guiDemo.mouseDownLeft);
}
```

```javascript on:update
gui.update(getMouseX(), getMouseY(), guiDemo.mouseDownLeft);
layoutWorldsGuiDemo();

if (guiDemo.widgets && guiDemo.widgets.button.wasClicked()) {
  guiDemo.clicks++;
  guiDemo.widgets.status.setText('Clicks: ' + guiDemo.clicks + ' from a Worlds section GUI');
}

if (worlds && worlds.widgets && worlds.widgets.popEvent) {
  while (true) {
    var widgetEvent = worlds.widgets.popEvent();
    if (!widgetEvent) break;

    if ((widgetEvent.id === 'widget-demo-button' || widgetEvent.id === 'inline-quick-fire') && widgetEvent.action === 'click') {
      guiDemo.inlineClicks++;
      worlds.widgets.setValue(
        'widget-demo-status',
        'Inline clicks: ' + guiDemo.inlineClicks + ' | Blend: ' + guiDemo.inlineSliderValue.toFixed(2),
        'Embedded Widgets'
      );
    }
  }

  var sliderValue = worlds.widgets.getValue('widget-demo-slider', 'Embedded Widgets');
  if (typeof sliderValue === 'number' && Math.abs(sliderValue - guiDemo.inlineSliderValue) > 0.0001) {
    guiDemo.inlineSliderValue = sliderValue;
    worlds.widgets.setValue(
      'widget-demo-status',
      'Inline clicks: ' + guiDemo.inlineClicks + ' | Blend: ' + guiDemo.inlineSliderValue.toFixed(2),
      'Embedded Widgets'
    );
  }
}
```

# Lists And Links {"x":"120","y":"20","z":"-80","rotate-y":"-12","width":"60","height":"24"}

This card stays close to the original Worlds feature set, but it helps anchor the newer formatting features in a familiar layout.

Checklist:

- Section-to-section links still focus the destination card.
- Ordered and unordered lists still share the same card renderer.
- The new content types compose with existing paragraphs and links.

Next stops:

1. [Jump to quotes](#blockquotes-and-rules)
2. [Jump to ASCII content](#ascii-fence)
3. [Return to intro](#worlds-markdown-showcase)

```javascript on:enter
worlds.camera.focusOnSectionFit('Lists And Links', 0.92);
```

# Blockquotes And Rules {"x":"-120","y":"-12","z":"-120","rotate-y":"12","width":"60","height":"24"}

The new blockquote support gives Worlds cards a clearer editorial voice.

> Worlds cards should feel like documents in space, not just textured headings.
>
> Adding quote blocks and separators makes longer cards easier to scan.

---

The rule above is rendered by the shared markdown layout engine, so GUI markdown views and Worlds cards now stay in sync.

> [!TIP] Shared renderer
> Callouts are parsed from blockquotes, so the same source now works in both Worlds cards and GUI markdown views.

- [See mixed composition](#mixed-composition)
- [Back to intro](#worlds-markdown-showcase)

```javascript on:enter
worlds.camera.focusOnSectionFit('Blockquotes And Rules', 0.92);
```

# Blob Image {"x":"132","y":"-86","z":"-165","rotate-y":"-10","width":"60","height":"26"}

Markdown images are now supported as **standalone block images** inside Worlds cards.

![Storie favicon](worlds-demo-icon "width:50% align:center")

---

Current constraints:

- The image source should be the name of an embedded `blob` block.
- The card rerasterizes once the image finishes decoding.
- Width metadata accepts `px` or `%`, and alignment supports `left`, `center`, and `right`.

- [Go to section GUI](#section-gui)
- [Go to embedded widgets](#embedded-widgets)
- [Go to ASCII content](#ascii-fence)
- [Back to intro](#worlds-markdown-showcase)

```javascript on:enter
worlds.camera.focusOnSectionFit('Blob Image', 0.92);
```

# Embedded Widgets {"x":"30","y":"-136","z":"-250","rotate-y":"2","width":"64","height":"30"}

This card uses visible `gui` fences, so the controls live inside the markdown flow instead of being positioned as an overlay.

Inline syntax also works for compact controls inside prose, like :gui{type:button, id:inline-quick-fire, label:"Quick Fire", scale:worlds} when you want the widget to read like part of the sentence.

The `scale` field is optional:

- `scale: gui` keeps the default retained-GUI control sizing.
- `scale: worlds` makes the live widget internals follow the projected card scale more closely.

```gui
type: button
id: widget-demo-button
label: Fire Inline Action
width: 68%
align: center
scale: worlds
```

```gui
type: slider
id: widget-demo-slider
label: Blend
min: 0
max: 1
value: 0.35
step: 0.05
width: 82%
align: center
scale: worlds
```

```gui
type: checkbox
id: widget-demo-toggle
label: Keep widgets in the card
checked: true
width: 84%
align: center
scale: worlds
```

```gui
type: label
id: widget-demo-status
text: Inline clicks: 0 | Blend: 0.35
width: 88%
align: center
```

What this demonstrates:

- The controls reserve space in markdown layout like any other block element.
- The active section mounts real retained widgets over those placeholders.
- Scripts can read and write inline widget state through `worlds.widgets`.

- [Back to blob image](#blob-image)
- [Continue to section GUI](#section-gui)

```javascript on:enter
worlds.camera.focusOnSectionFit('Embedded Widgets', 0.92);
worlds.widgets.setValue('widget-demo-status', 'Inline clicks: ' + guiDemo.inlineClicks + ' | Blend: ' + guiDemo.inlineSliderValue.toFixed(2), 'Embedded Widgets');
```

# Section GUI {"x":"-138","y":"-92","z":"-182","rotate-y":"14","width":"62","height":"26"}

This card showcases the first pass of **GUI inside Worlds sections**.

The overlay in the lower-right corner is created from this section using `gui.section('current')`.

What this demonstrates:

- Widgets can be created once from a section-local GUI context.
- That GUI group becomes visible only while this Worlds section is active.
- Focus is managed automatically when the section stops being current.
- The regular retained GUI event loop still works for buttons and keyboard focus.

- Click the overlay button to increment the section-local counter.
- Tab will focus the button while this section is active.
- [Back to blob image](#blob-image)
- [Continue to ASCII content](#ascii-fence)

```javascript on:enter
ensureWorldsGuiDemo();
worlds.camera.focusOnSectionFit('Section GUI', 0.92);
```

# ASCII Fence {"x":"0","y":"88","z":"-180","rotate-x":"-8","width":"58","height":"22"}

ASCII fenced blocks remain useful when you want visible preformatted content without turning a code fence into executable behavior.

```ascii
   .-.
  (o o)
   |=|
  __|__
 //.=|=.\\
// .=|=. \\
\\ .=|=. //
 \\(_=_)//
  (:| |:)
   || ||
   () ()
   || ||
   || ||
  ==' '==
```

---

Use this for diagrams, badges, terminal-flavored scene dressing, or quick layout placeholders.

- [Go to mixed composition](#mixed-composition)
- [Go back to lists](#lists-and-links)

```javascript on:enter
worlds.camera.focusOnSectionFit('ASCII Fence', 0.94);
```

# Mixed Composition {"x":"0","y":"-96","z":"-210","rotate-x":"8","width":"66","height":"28"}

This final card mixes the currently supported content forms in one place.

> [!NOTE] Phase progression
> The renderer is still intentionally lightweight, but it can now express much richer editorial structure than plain paragraphs and links.

> The goal for Phase 1 is not “all markdown”.
>
> The goal is to make card content noticeably more expressive while keeping the renderer simple and deterministic.

---

Practical takeaways:

1. Authors can structure denser narrative cards without dropping into custom UI.
2. Blob-backed markdown images can now render inline as card content.
3. Worlds sections can now own retained GUI through section-scoped bindings.
4. The same parser now feeds GUI markdown views and Worlds card textures.
5. This is a base for later additions like embedded declarative widgets.

- [Intro](#worlds-markdown-showcase)
- [Quotes](#blockquotes-and-rules)
- [Image](#blob-image)
- [Section GUI](#section-gui)
- [ASCII](#ascii-fence)

```javascript on:enter
worlds.camera.focusOnSectionFit('Mixed Composition', 0.92);
```

```blob name:worlds-demo-icon mime:image/png enc:base64
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
```