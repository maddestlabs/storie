---
name: "Blob Audio Demo (Storie)"
theme: "neonopia"
---

This demo embeds a tiny synthetic WAV sound directly in the document using a `blob` fenced block and plays it with `audio.playBlob()`.

Notes:
- Browsers usually require a user gesture before audio will play; press Space to trigger playback.
- For MP3 blobs, use `mime:audio/mpeg`.

## Embedded WAV

```blob name:beep mime:audio/wav enc:base64
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
```

## Game Code

```js
let status = 'Press Space to play';
let plays = 0;
```

```js on:init
term.layerID = 'default';
term.clear();

status = 'Press Space to play (user gesture required)';
```

```js on:update
if (key.pressed(key.SPACE)) {
  status = 'Decoding/playing…';

  // Resume AudioContext in case it is suspended.
  audio.context.resume().catch(() => {});

  audio.playBlob('beep', { volume: 0.7 })
    .then((src) => {
      if (src) {
        plays++;
        status = `Played (${plays})`;
      } else {
        status = 'Decode failed (unsupported codec?)';
      }
    })
    .catch((_e) => {
      status = 'Error while playing';
    });
}
```

```js on:render
term.layerID = 'default';
term.clear();

term.write(0, 0, "═".repeat(termWidth));
term.write(0, termHeight - 1, "═".repeat(termWidth));

term.write(2, 2, 'Blob Audio Demo', 0xffffffff);
term.write(2, 4, `Status: ${status}`, 0xccccccff);
term.write(2, 6, 'Press Space to play the embedded WAV blob.', 0xaaaaaaff);

const meta = blob.get('beep');
if (meta) {
  term.write(2, 8, `Blob: ${meta.name}`, 0xaaaaaaff);
  term.write(2, 9, `MIME: ${meta.mime}`, 0xaaaaaaff);
  term.write(2, 10, `Bytes (est): ${meta.byteLength}`, 0xaaaaaaff);
}
```
