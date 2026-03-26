import type { NodeDef, NodeRegistry } from './types.js';

export class MapNodeRegistry implements NodeRegistry {
  private defs = new Map<string, NodeDef>();

  constructor(defs?: NodeDef[]) {
    if (Array.isArray(defs)) {
      for (const def of defs) this.add(def);
    }
  }

  add(def: NodeDef): void {
    this.defs.set(String(def.kind), def);
  }

  get(kind: string): NodeDef | null {
    return this.defs.get(String(kind)) ?? null;
  }

  has(kind: string): boolean {
    return this.defs.has(String(kind));
  }

  listKinds(): string[] {
    return Array.from(this.defs.keys()).sort();
  }
}
