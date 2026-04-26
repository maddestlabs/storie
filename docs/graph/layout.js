import { computeLevels, nodeById, topoSort } from './core.js';
/**
 * Simple deterministic level-based layout.
 * Good baseline for all graph demos.
 */
export function autoLayoutLevels(graph, bounds, opts = {}) {
    const pad = opts.pad ?? 24;
    const colW = opts.colW ?? 260;
    const rowH = opts.rowH ?? 88;
    const nodeW = opts.nodeW ?? 180;
    const nodeH = opts.nodeH ?? 60;
    const nodes = nodeById(graph);
    const topo = topoSort(graph);
    const level = computeLevels(graph, topo.order);
    const groups = new Map();
    for (const id of nodes.keys()) {
        const l = level.get(id) ?? 0;
        const arr = groups.get(l) ?? [];
        arr.push(id);
        groups.set(l, arr);
    }
    const levels = Array.from(groups.keys()).sort((a, b) => a - b);
    const layout = new Map();
    for (let li = 0; li < levels.length; li++) {
        const l = levels[li];
        const ids = groups.get(l) ?? [];
        for (let ri = 0; ri < ids.length; ri++) {
            const id = ids[ri];
            const x = bounds.x + pad + li * colW;
            const y = bounds.y + pad + ri * rowH;
            layout.set(id, { x, y, w: nodeW, h: nodeH });
        }
    }
    return layout;
}
export function hitTestNode(layoutById, x, y) {
    let hit = null;
    for (const [id, r] of layoutById.entries()) {
        if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
            hit = id;
    }
    return hit;
}
//# sourceMappingURL=layout.js.map