/**
 * recorder.ts
 *
 * Input recorder that captures InputEvent objects as a timestamped tape.
 * The tape serialises to the native Storie timed-block format so it can be
 * pasted back into a demo's ```timed block and played back via the existing
 * sys.automation pipeline.
 *
 * Life-cycle
 * ----------
 *  rec.start()              — arm the recorder (resets internal clock to 0)
 *  rec.record(event)        — call from on:input; no-op when not recording
 *  const tape = rec.stop()  — disarm and return the captured tape
 *  tape.serialize()         — get the timed-block text to copy/paste or download
 *  tape.toTimedEntries()    — get entries for sys.automation.compile()
 *
 * Usage example
 * -------------
 *  ```js on:input
 *  if (event.key === 'r') {
 *    if (rec.isRecording()) {
 *      const tape = rec.stop();
 *      sys.download(new TextEncoder().encode(tape.serialize()), 'demo.timed', 'text/plain');
 *    } else {
 *      rec.start();
 *    }
 *    return true;
 *  }
 *  rec.record(event);
 *  return true;
 *  ```
 */
function makeTimedEntry(c) {
    // Scrub internal engine fields that don't survive serialisation usefully.
    const { type, key, button, x, y, cellX, cellY, mods, keyCode, action } = c.event;
    const clean = { type };
    if (key !== undefined)
        clean.key = key;
    if (button !== undefined)
        clean.button = button;
    if (x !== undefined)
        clean.x = x;
    if (y !== undefined)
        clean.y = y;
    if (cellX !== undefined)
        clean.cellX = cellX;
    if (cellY !== undefined)
        clean.cellY = cellY;
    if (mods && mods.length > 0)
        clean.mods = mods;
    if (keyCode !== undefined)
        clean.keyCode = keyCode;
    if (action !== undefined)
        clean.action = action;
    return { ms: c.ms, text: JSON.stringify({ input: clean }) };
}
function buildTape(captured) {
    const sorted = captured.slice().sort((a, b) => a.ms - b.ms);
    const last = sorted[sorted.length - 1];
    const durationMs = last ? last.ms : 0;
    return {
        toTimedEntries() {
            return sorted.map(makeTimedEntry);
        },
        serialize() {
            return sorted.map(c => {
                const e = makeTimedEntry(c);
                return `${e.ms}|${e.text}`;
            }).join('\n');
        },
        get durationMs() { return durationMs; },
        get length() { return sorted.length; },
    };
}
export function createInputRecorder() {
    let recording = false;
    let startMs = 0;
    let captured = [];
    // High-res wall clock if available; degraded gracefully.
    function nowMs() {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }
    return {
        start() {
            recording = true;
            startMs = nowMs();
            captured = [];
        },
        stop() {
            recording = false;
            const tape = buildTape(captured);
            captured = [];
            return tape;
        },
        isRecording() { return recording; },
        getElapsedMs() {
            if (!recording)
                return 0;
            return Math.max(0, nowMs() - startMs);
        },
        record(event, overrideMs) {
            if (!recording)
                return;
            if (!event || typeof event.type !== 'string')
                return;
            // Skip pure text composition events — they don't replay deterministically.
            if (event.type === 'text')
                return;
            const ms = Math.max(0, Math.round(overrideMs !== undefined ? overrideMs : nowMs() - startMs));
            captured.push({ ms, event });
        },
    };
}
//# sourceMappingURL=recorder.js.map