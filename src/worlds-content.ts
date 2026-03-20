export type WorldsContentTimedEntry = {
  ms: number;
  text: string;
};

export type WorldsContentMode = 'replace' | 'append';

export type WorldsContentTarget = 'content' | 'title';

export type WorldsContentStateOptions = {
  mode?: WorldsContentMode;
  separator?: string;
  maxEntries?: number;
};

export type WorldsContentState = {
  text: string;
  current: WorldsContentTimedEntry | null;
  entries: WorldsContentTimedEntry[];
};

function normalizeTimedEntries(entries: WorldsContentTimedEntry[]): WorldsContentTimedEntry[] {
  return Array.from(entries)
    .filter((entry) => entry && Number.isFinite(entry.ms) && typeof entry.text === 'string')
    .map((entry) => ({ ms: Math.max(0, Math.round(Number(entry.ms))), text: String(entry.text) }))
    .sort((a, b) => a.ms - b.ms);
}

export function stateAtWorldsContent(
  entries: WorldsContentTimedEntry[],
  timeSec: number,
  options?: WorldsContentStateOptions,
): WorldsContentState {
  const mode = options?.mode === 'append' ? 'append' : 'replace';
  const separator = typeof options?.separator === 'string' ? options.separator : '\n';
  const maxEntries = Number.isFinite(options?.maxEntries as number)
    ? Math.max(1, Math.floor(Number(options?.maxEntries)))
    : null;
  const cutoffMs = Math.max(0, Math.round(Number(timeSec) * 1000));
  const sorted = normalizeTimedEntries(entries);

  let current: WorldsContentTimedEntry | null = null;
  const activeEntries: WorldsContentTimedEntry[] = [];
  for (const entry of sorted) {
    if (entry.ms > cutoffMs) break;
    current = entry;
    activeEntries.push(entry);
  }

  if (mode === 'replace') {
    return {
      text: current?.text ?? '',
      current,
      entries: current ? [current] : [],
    };
  }

  const entriesToUse = maxEntries ? activeEntries.slice(-maxEntries) : activeEntries;
  return {
    text: entriesToUse.map((entry) => entry.text).join(separator),
    current,
    entries: entriesToUse,
  };
}