export class MapNodeRegistry {
    defs = new Map();
    constructor(defs) {
        if (Array.isArray(defs)) {
            for (const def of defs)
                this.add(def);
        }
    }
    add(def) {
        this.defs.set(String(def.kind), def);
    }
    get(kind) {
        return this.defs.get(String(kind)) ?? null;
    }
    has(kind) {
        return this.defs.has(String(kind));
    }
    listKinds() {
        return Array.from(this.defs.keys()).sort();
    }
}
//# sourceMappingURL=registry.js.map