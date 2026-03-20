export type WorldsTimelineSectionSelector = number | string;

export type WorldsTimelineVec3 = {
  x?: number;
  y?: number;
  z?: number;
};

export type WorldsTimelinePatch = {
  title?: string;
  content?: string;
  visible?: boolean;
  position?: WorldsTimelineVec3;
  rotation?: WorldsTimelineVec3;
  scale?: WorldsTimelineVec3;
};

export type WorldsTimelineEvent = {
  ms: number;
  section: WorldsTimelineSectionSelector;
  patch: WorldsTimelinePatch;
};

export type WorldsTimelineStateEntry = {
  section: WorldsTimelineSectionSelector;
  patch: WorldsTimelinePatch;
};

export type CompiledWorldsTimeline = {
  events: WorldsTimelineEvent[];
  sections: WorldsTimelineSectionSelector[];
};

type TimedEntryLike = { ms: number; text: string };

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSelector(raw: unknown): WorldsTimelineSectionSelector | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function normalizeNumber(raw: unknown): number | undefined {
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function normalizeBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (value === 'true' || value === '1' || value === 'yes' || value === 'on') return true;
    if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  }
  return undefined;
}

function normalizeVec3(raw: unknown): WorldsTimelineVec3 | undefined {
  if (!isRecord(raw)) return undefined;
  const x = normalizeNumber(raw.x);
  const y = normalizeNumber(raw.y);
  const z = normalizeNumber(raw.z);
  if (x === undefined && y === undefined && z === undefined) return undefined;
  return {
    ...(x !== undefined ? { x } : {}),
    ...(y !== undefined ? { y } : {}),
    ...(z !== undefined ? { z } : {}),
  };
}

function normalizeScale(raw: unknown): WorldsTimelineVec3 | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { x: raw, y: raw, z: raw };
  }
  if (typeof raw === 'string') {
    const value = Number(raw.trim());
    if (Number.isFinite(value)) return { x: value, y: value, z: value };
  }
  return normalizeVec3(raw);
}

function normalizeAliases(source: Record<string, any>): Pick<WorldsTimelinePatch, 'position' | 'rotation' | 'scale'> {
  const positionX = normalizeNumber(source.x);
  const positionY = normalizeNumber(source.y);
  const positionZ = normalizeNumber(source.z ?? source.depth);
  const rotationX = normalizeNumber(source.rotateX ?? source['rotate-x']);
  const rotationY = normalizeNumber(source.rotateY ?? source['rotate-y']);
  const rotationZ = normalizeNumber(source.rotateZ ?? source['rotate-z']);
  const scaleX = normalizeNumber(source.scaleX ?? source['scale-x']);
  const scaleY = normalizeNumber(source.scaleY ?? source['scale-y']);
  const scaleZ = normalizeNumber(source.scaleZ ?? source['scale-z']);

  return {
    ...((positionX !== undefined || positionY !== undefined || positionZ !== undefined)
      ? {
          position: {
            ...(positionX !== undefined ? { x: positionX } : {}),
            ...(positionY !== undefined ? { y: positionY } : {}),
            ...(positionZ !== undefined ? { z: positionZ } : {}),
          },
        }
      : {}),
    ...((rotationX !== undefined || rotationY !== undefined || rotationZ !== undefined)
      ? {
          rotation: {
            ...(rotationX !== undefined ? { x: rotationX } : {}),
            ...(rotationY !== undefined ? { y: rotationY } : {}),
            ...(rotationZ !== undefined ? { z: rotationZ } : {}),
          },
        }
      : {}),
    ...((scaleX !== undefined || scaleY !== undefined || scaleZ !== undefined)
      ? {
          scale: {
            ...(scaleX !== undefined ? { x: scaleX } : {}),
            ...(scaleY !== undefined ? { y: scaleY } : {}),
            ...(scaleZ !== undefined ? { z: scaleZ } : {}),
          },
        }
      : {}),
  };
}

function hasVec3(vec: WorldsTimelineVec3 | undefined): boolean {
  return !!vec && (vec.x !== undefined || vec.y !== undefined || vec.z !== undefined);
}

function mergeVec3(base: WorldsTimelineVec3 | undefined, patch: WorldsTimelineVec3 | undefined): WorldsTimelineVec3 | undefined {
  if (!patch) return base ? { ...base } : undefined;
  const merged: WorldsTimelineVec3 = {
    ...(base ?? {}),
    ...patch,
  };
  return hasVec3(merged) ? merged : undefined;
}

export function mergeWorldsTimelinePatch(
  base: WorldsTimelinePatch | undefined,
  patch: WorldsTimelinePatch | undefined,
): WorldsTimelinePatch {
  const merged: WorldsTimelinePatch = {
    ...(base ?? {}),
    ...(patch ?? {}),
  };

  merged.position = mergeVec3(base?.position, patch?.position);
  merged.rotation = mergeVec3(base?.rotation, patch?.rotation);
  merged.scale = mergeVec3(base?.scale, patch?.scale);

  if (!hasVec3(merged.position)) delete merged.position;
  if (!hasVec3(merged.rotation)) delete merged.rotation;
  if (!hasVec3(merged.scale)) delete merged.scale;

  return merged;
}

function patchHasData(patch: WorldsTimelinePatch): boolean {
  return (
    patch.title !== undefined ||
    patch.content !== undefined ||
    patch.visible !== undefined ||
    hasVec3(patch.position) ||
    hasVec3(patch.rotation) ||
    hasVec3(patch.scale)
  );
}

export function normalizeWorldsTimelinePatch(raw: unknown): WorldsTimelinePatch | null {
  if (!isRecord(raw)) return null;

  const aliases = normalizeAliases(raw);
  const title = typeof raw.title === 'string' ? raw.title : undefined;
  const content = typeof raw.content === 'string' ? raw.content : undefined;
  const visible = raw.hidden !== undefined
    ? (() => {
        const hidden = normalizeBoolean(raw.hidden);
        return hidden === undefined ? undefined : !hidden;
      })()
    : normalizeBoolean(raw.visible ?? raw.show);

  const nestedPosition = normalizeVec3(raw.position);
  const nestedRotation = normalizeVec3(raw.rotation);
  const nestedScale = normalizeScale(raw.scale);

  const patch: WorldsTimelinePatch = {
    ...(title !== undefined ? { title } : {}),
    ...(content !== undefined ? { content } : {}),
    ...(visible !== undefined ? { visible } : {}),
    ...(nestedPosition || aliases.position ? { position: mergeVec3(aliases.position, nestedPosition) } : {}),
    ...(nestedRotation || aliases.rotation ? { rotation: mergeVec3(aliases.rotation, nestedRotation) } : {}),
    ...(nestedScale || aliases.scale ? { scale: mergeVec3(aliases.scale, nestedScale) } : {}),
  };

  return patchHasData(patch) ? patch : null;
}

export function compileWorldsTimeline(entries: TimedEntryLike[]): CompiledWorldsTimeline {
  const sorted = Array.from(entries)
    .filter((entry) => entry && Number.isFinite(entry.ms) && typeof entry.text === 'string')
    .sort((a, b) => a.ms - b.ms);

  const events: WorldsTimelineEvent[] = [];
  const sections: WorldsTimelineSectionSelector[] = [];
  const seenSections = new Set<string>();

  for (const entry of sorted) {
    const rawText = String(entry.text ?? '').trim();
    if (!rawText) continue;

    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) continue;

    const selector = normalizeSelector(parsed.section ?? parsed.target ?? parsed.sectionId ?? parsed.sectionIndex);
    if (selector === null) continue;

    const patchSource = isRecord(parsed.set) ? parsed.set : parsed;
    const patch = normalizeWorldsTimelinePatch(patchSource);
    if (!patch) continue;

    events.push({
      ms: Math.max(0, Math.round(Number(entry.ms))),
      section: selector,
      patch,
    });

    const key = typeof selector === 'number' ? `#${selector}` : `$${selector}`;
    if (!seenSections.has(key)) {
      seenSections.add(key);
      sections.push(selector);
    }
  }

  return { events, sections };
}

export function getWorldsTimelineSelectorKey(selector: WorldsTimelineSectionSelector): string {
  return typeof selector === 'number' ? `#${selector}` : `$${selector}`;
}

export function stateAtWorldsTimeline(compiled: CompiledWorldsTimeline, timeSec: number): WorldsTimelineStateEntry[] {
  const cutoffMs = Math.max(0, Math.round(Number(timeSec) * 1000));
  const bySection = new Map<string, WorldsTimelineStateEntry>();

  for (const event of compiled.events) {
    if (event.ms > cutoffMs) break;
    const key = getWorldsTimelineSelectorKey(event.section);
    const prev = bySection.get(key);
    bySection.set(key, {
      section: event.section,
      patch: mergeWorldsTimelinePatch(prev?.patch, event.patch),
    });
  }

  return Array.from(bySection.values());
}