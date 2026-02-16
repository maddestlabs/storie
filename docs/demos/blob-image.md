---
name: "Blob Image Demo (Storie)"
theme: "neonopia"
---

This demo embeds a tiny PNG directly in the document using a `blob` fenced block and renders it with `ui.image()`.

## Embedded PNG

```blob name:icon mime:image/png enc:base64
iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACo0lEQVR4nFWTT2udVRDGfzNzzvve
/LlNUhNIokHaQMEqwUIL4laL38Iv4ofp0o1rF278AkVBIYvAzaY1Fa4it9ebm/e858y4uO3CB+Z5
Nr9ZzMAjwGfAI1V9rCrnInpmqkeiOhWRToAginss3X3u7q/cfSbulw2uEvDIzC5yzhc554c5pxMz
m5papyqCCESEe5Tm7bjW8bCUuldKSYwjSVUf55wvJpP+077rT1NOO2YmqspmX0BAkK1a66TWup3S
sAUwtFaTiJznlB52XT7NXd7NlkhmmCmqSojg7pRS6PtezGwXkdNWfT0Mw0JV9cxSOkmWdpIZnoR1
gnUSbhOECPt793j67CkRQc6JnPNOSukkJT1LqnJkqlNTkyrwQLf5XPdRVZIZP7c5+/f3ef78G16+
/IXtrQmmTSzZVMSOVESnqto1gX3NfCWHXOmaa72jV+VLu88QzljKu7MEVcVUO1WZpojoEERFGHAG
cT5ii5/4m0vW7AIfygmiunkoAoBs1CkAARLBGMEP8SeHGN/xgI9jwtsYkWCDRWzg9x6gIlFiIzSg
hPPC/+BHn/NtHPMk7rGOikQQ/58Iomg4S3cvNYIc8LUf8IlvM/MVv/uCZ23KrTfCA3fH32drxT2W
ySPmzdsxzSdvtchc7viCKV0kUhjf19d84Mc4QR0rLVdaa1FrW0ZrczGzF5PJ5Mmk78+7vtttJqgZ
pkqo0KNsdz17Bwe8ubkBYCjl39XqdrZarX5NETGrte6NJlsIp13KO+YiqqAqhATLccU/iwXJLMZa
V8Mw3IzjeA3Mkrhf1loSQGuxrqmemNpUTTuVd2WCICh3d3fLWtubWsv1MIy/AZepwZW1YIyx1loX
qvqXqh6JyBSiA0GEEhFL95i7+yvwGchla+3qP/9rcc2xUr4KAAAAAElFTkSuQmCC
```

```blob name:iconHex mime:image/png enc:hex
89504e470d0a1a0a0000000d49484452000000100000001008060000001ff3ff61000002a3494441
54789c55934f6b9d5510c67f3373cefbdefcb94d521348a241da40c12ac1420be2568bdfc22fe287
e9d28d6b176efc024541218bc0cda63515ae22b7d79b9bf7bce7ccb8b8edc207e67936bf59ccc023
c067c023557dac2ae7227a66aa47a23a15914e80208a7b2cdd7deeeeafdc7d26ee970dae12f0c8cc
2e72ce1739e78739a713339b9a5aa72a820844847b94e6edb8d6f1b094ba574a498c2349551fe79c
2f2693fed3beeb4f534e3b6626aaca665f404090ad5aeba4d6ba9dd2b00530b45693889ce7941e76
5d3ecd5ddecd9648669829aa4a88e0ee9452e8fb5ecc6c1791d3567d3d0cc34255f5cc523a499676
92199e84758275126e138408fb7bf778faec291141ce899cf34e4ae924253d4baa7264aa5353932a
f040b7f95cf7515592193fb739fbf7f779fefc1b5ebefc85edad09a64d2cd954c48e5444a7aada35
817dcd7c25875ce99a6bbda357e54bbbcf10ce58cabbb30455c5543b5599a688e810444518700671
3e628b9ff89b4bd6ec021fca09a2ba792802806cd429000112c118c10ff1278718dff1808f63c2db
18916083456ce0f71ea02251622334a084f3c2ffe0479ff36d1cf324eeb18e8a4410ff9f08a26838
4b772f35821cf0b51ff0896f33f315bffb82676dcaad37c20377c7df676bc53d96c923e6cddb31cd
276fb5c85ceef882295d245218dfd7d77ce0c738411d2b2d575a6b516b5b466b7331b31793c9e4c9
a4efcfbbbedb6d26a819a64aa8d0a36c773d7b0707bcb9b9016028e5dfd5ea76b65aad7e4d1131ab
b5ee8d265b08a75dca3be622aaa02a8404cb71c53f8b05c92cc65a57c330dc8ce3780dcc92b85fd6
5a12406bb1aea99e98da544d3b957765822028777777cb5adb9b5acbf5308cbf0197a9c195b5608c
b1d65a17aafa97aa1e89c814a203418412114bf798bbfb2bf019c8656bedea3fff6b71cdb152be0a
0000000049454e44ae426082
```

## Game Code

```js
let status = 'Loading…';
```

```js on:init
term.layerID = 'default';
term.clear();

gui.init();
// NOTE: WebGPU UI isn't available until after engine.start().
// `ui.image('icon', ...)` will auto-load the embedded blob on first use.
```

```js on:render
const base = getStyle('default');
// Keep the UI layer transparent so terminal text/border stays visible.
// (If you clear UI to an opaque color, it will cover the terminal layer.)
ui.clear();
term.layerID = 'default';
term.clear();

// Simple border like gui-basic (helps confirm terminal is rendering)
term.write(0, 0, "═".repeat(termWidth));
term.write(0, termHeight - 1, "═".repeat(termWidth));

term.write(2, 2, 'Blob Image Demo', 0xffffffff);
term.write(2, 4, `Status: ${status}`, 0xccccccff);

ui.image('icon', 20, 90, 32, 20);
term.write(2, 7, 'Left: base64', 0xaaaaaaff);

ui.image('iconHex', 100, 90, 32, 32);
term.write(2, 8, 'Right: hex', 0xaaaaaaff);

term.write(2, 10, 'Images should appear shortly.', 0xaaaaaaff);
```
