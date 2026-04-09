/**
 * beat-clock.ts
 *
 * Converts between beat-space and wall-clock time, then bridges into the
 * existing automation pipeline by transforming beat-indexed timed entries
 * into millisecond-indexed ones that `compileAutomation()` can consume.
 *
 * Timed block syntax extension
 * ----------------------------
 * A ```timed block may carry a `# bpm:N` header line.  The helpers here
 * process that header when called from user code; the automation compiler
 * remains format-agnostic. Example:
 *
 *   ```timed name:groove
 *   # bpm:128
 *   beat:0|{"var":"filter.cutoff","value":0.2}
 *   beat:4|{"var":"filter.cutoff","value":0.9,"ease":"outCubic"}
 *   beat:8|{"var":"filter.cutoff","value":0.2}
 *   ```
 *
 * Usage from user code
 * --------------------
 *   const clock = sys.beat.clock({ bpm: 128 });
 *
 *   // Convert a beat-indexed timed block then compile as usual.
 *   const track = sys.automation.compile(
 *     sys.beat.toTimedEntries(clock, doc.timedBlock('groove'))
 *   );
 *
 *   // Helpers while running.
 *   const beat = sys.beat.beatAt(clock, getTime());   // fractional beat number
 *   const ms   = sys.beat.beatToMs(clock, 4);         // 4th beat in ms
 */

export interface BeatClockOptions {
  /** Beats per minute (required). */
  bpm: number;
  /**
   * Wall-clock offset in milliseconds at which beat 0 occurs.
   * Useful when the audio track starts at a non-zero position.
   * Default: 0.
   */
  offsetMs?: number;
  /**
   * Number of beats per bar (default: 4).
   * Used by `barAt()` but does not affect ms/beat arithmetic.
   */
  beatsPerBar?: number;
}

export interface BeatClock {
  readonly bpm: number;
  readonly offsetMs: number;
  readonly beatsPerBar: number;
  /** Convert a beat number to an absolute millisecond offset from the clock origin. */
  beatToMs(beat: number): number;
  /** Convert an absolute millisecond offset to a (fractional) beat number. */
  msToBeat(ms: number): number;
  /**
   * Return the fractional beat number at the given engine time in seconds.
   * This is the primary per-frame query: `sys.beat.beatAt(clock, getTime())`.
   */
  beatAt(timeSec: number): number;
  /** Current bar index (0-based) at the given engine time in seconds. */
  barAt(timeSec: number): number;
  /** Phase within the current beat [0, 1) at the given engine time in seconds. */
  beatPhase(timeSec: number): number;
  /** Phase within the current bar [0, 1) at the given engine time in seconds. */
  barPhase(timeSec: number): number;
}

export function createBeatClock(opts: BeatClockOptions): BeatClock {
  const bpm = Math.max(0.01, Number(opts.bpm) || 120);
  const offsetMs = Number(opts.offsetMs ?? 0) || 0;
  const beatsPerBar = Math.max(1, (opts.beatsPerBar ?? 4) | 0);
  const msPerBeat = 60000 / bpm;

  return {
    get bpm() { return bpm; },
    get offsetMs() { return offsetMs; },
    get beatsPerBar() { return beatsPerBar; },

    beatToMs(beat: number): number {
      return offsetMs + beat * msPerBeat;
    },

    msToBeat(ms: number): number {
      return (ms - offsetMs) / msPerBeat;
    },

    beatAt(timeSec: number): number {
      const ms = timeSec * 1000;
      return Math.max(0, (ms - offsetMs) / msPerBeat);
    },

    barAt(timeSec: number): number {
      return Math.floor(Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat) / beatsPerBar);
    },

    beatPhase(timeSec: number): number {
      const beat = Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat);
      return beat - Math.floor(beat);
    },

    barPhase(timeSec: number): number {
      const beat = Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat);
      const beatInBar = beat % beatsPerBar;
      return beatInBar / beatsPerBar;
    },
  };
}

/** Alias kept for symmetry with sandbox API naming. */
export { createBeatClock as beatClock };

// ---------------------------------------------------------------------------
// Beat-indexed timed entry conversion
// ---------------------------------------------------------------------------

export interface BeatIndexedEntry {
  beat: number;
  text: string;
}

/**
 * Convert manually-constructed beat-indexed entries to ms-indexed timed entries.
 *
 * @param clock    A BeatClock created by `createBeatClock`.
 * @param entries  Array of `{ beat, text }` objects.
 * @returns        Array of `{ ms, text }` ready for `compileAutomation()`.
 */
export function beatToTimedEntries(
  clock: BeatClock,
  entries: BeatIndexedEntry[]
): Array<{ ms: number; text: string }> {
  return entries.map(e => ({
    ms: Math.round(clock.beatToMs(Number(e.beat) || 0)),
    text: String(e.text ?? ''),
  }));
}

/**
 * Parse a timed-block that uses `beat:N|text` lines (plus an optional
 * `# bpm:N` header line) and return ms-indexed timed entries.
 *
 * Lines without a `beat:` prefix are treated as ordinary `ms|text` lines
 * so that a `# bpm:128` block can freely mix beat-indexed and ms-indexed lines.
 *
 * @param raw    Raw timed-block text (as returned by `doc.timedBlock()`).
 * @param clock  Clock to use.  When omitted the function looks for a
 *               `# bpm:N` header in `raw` and creates a clock automatically.
 *               If neither is present, beat lines are silently skipped.
 */
export function parseBeatTimedBlock(
  raw: Array<{ ms: number; text: string }>,
  clock?: BeatClock
): Array<{ ms: number; text: string }> {
  // doc.timedBlock() already returns { ms, text }[] after native-format parsing.
  // Beat lines come through as text === 'beat:N|json' because the native parser
  // splits on the first `|`, giving ms=0 and text='beat:N|json' for comment/special lines.
  // We need to check both the raw entry text and pick the correct path.
  const out: Array<{ ms: number; text: string }> = [];
  let resolvedClock = clock ?? null;

  for (const entry of raw) {
    const t = String(entry.text ?? '').trim();

    // Header: `# bpm:120`
    if (!resolvedClock && t.startsWith('#')) {
      const m = t.match(/bpm\s*:\s*(\d+(?:\.\d+)?)/i);
      if (m) {
        resolvedClock = createBeatClock({ bpm: parseFloat(m[1]!) });
      }
      continue;
    }

    // Beat line that survived native parsing as text field (ms would be 0 with text like beat:4|{...})
    const beatMatch = t.match(/^beat\s*:\s*(\d+(?:\.\d+)?)\|(.*)$/s);
    if (beatMatch) {
      if (!resolvedClock) continue; // no bpm context, skip
      const beat = parseFloat(beatMatch[1]!);
      const payload = beatMatch[2]!;
      out.push({ ms: Math.round(resolvedClock.beatToMs(beat)), text: payload });
      continue;
    }

    // Ordinary ms-indexed entry — pass through unchanged.
    out.push(entry);
  }

  return out;
}
