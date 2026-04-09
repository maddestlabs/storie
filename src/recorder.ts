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

export interface InputEventLike {
  type: string;
  [key: string]: unknown;
}

export interface RecordedTape {
  /** All captured events as ms-timestamped timed entries. */
  toTimedEntries(): Array<{ ms: number; text: string }>;
  /**
   * Serialise to native Storie timed-block text.
   * Each non-empty line is `ms|{"input":{...}}`.
   * Paste directly into a ```timed block.
   */
  serialize(): string;
  /** Total duration from first to last event in milliseconds. */
  readonly durationMs: number;
  /** Number of captured events. */
  readonly length: number;
}

export interface InputRecorder {
  /**
   * Start recording.  Resets the internal clock to 0 so the first captured
   * event is at t=0 relative to the session start.
   */
  start(): void;
  /** Stop recording and return the captured tape. */
  stop(): RecordedTape;
  /** True while the recorder is armed. */
  isRecording(): boolean;
  /** Elapsed recording time in milliseconds (0 when not recording). */
  getElapsedMs(): number;
  /**
   * Record one event.  Safe to call unconditionally — silently ignored when
   * the recorder is not running, and ignores events with type 'text' (those
   * are OS-level composition artefacts that don't replay cleanly).
   *
   * @param event    The InputEvent to capture (accepts the engine's InputEvent type).
   * @param nowMs    Optional override for the current timestamp (milliseconds).
   *                 Defaults to performance.now() relative to start.
   */
  record(event: { type: string; [key: string]: unknown } | { type: string }, nowMs?: number): void;
}

type Captured = { ms: number; event: InputEventLike };

function makeTimedEntry(c: Captured): { ms: number; text: string } {
  // Scrub internal engine fields that don't survive serialisation usefully.
  const { type, key, button, x, y, cellX, cellY, mods, keyCode, action } = c.event as any;
  const clean: Record<string, unknown> = { type };
  if (key !== undefined) clean.key = key;
  if (button !== undefined) clean.button = button;
  if (x !== undefined) clean.x = x;
  if (y !== undefined) clean.y = y;
  if (cellX !== undefined) clean.cellX = cellX;
  if (cellY !== undefined) clean.cellY = cellY;
  if (mods && (mods as string[]).length > 0) clean.mods = mods;
  if (keyCode !== undefined) clean.keyCode = keyCode;
  if (action !== undefined) clean.action = action;
  return { ms: c.ms, text: JSON.stringify({ input: clean }) };
}

function buildTape(captured: Captured[]): RecordedTape {
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

export function createInputRecorder(): InputRecorder {
  let recording = false;
  let startMs = 0;
  let captured: Captured[] = [];

  // High-res wall clock if available; degraded gracefully.
  function nowMs(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  return {
    start() {
      recording = true;
      startMs = nowMs();
      captured = [];
    },

    stop(): RecordedTape {
      recording = false;
      const tape = buildTape(captured);
      captured = [];
      return tape;
    },

    isRecording() { return recording; },

    getElapsedMs() {
      if (!recording) return 0;
      return Math.max(0, nowMs() - startMs);
    },

    record(event: { type: string; [key: string]: unknown } | { type: string }, overrideMs?: number): void {
      if (!recording) return;
      if (!event || typeof event.type !== 'string') return;
      // Skip pure text composition events — they don't replay deterministically.
      if (event.type === 'text') return;
      const ms = Math.max(0, Math.round(
        overrideMs !== undefined ? overrideMs : nowMs() - startMs
      ));
      captured.push({ ms, event });
    },
  };
}
