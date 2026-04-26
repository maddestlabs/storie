export function createSimpleRegistry(defs) {
    const map = new Map();
    for (const def of defs)
        map.set(def.kind, def);
    return {
        get: (kind) => map.get(kind) ?? null,
        has: (kind) => map.has(kind),
        listKinds: () => Array.from(map.keys()).sort()
    };
}
export function nodeById(graph) {
    const map = new Map();
    for (const n of graph.nodes ?? []) {
        const id = String(n?.id ?? '');
        if (!id)
            continue;
        if (!map.has(id))
            map.set(id, { ...n, id });
    }
    return map;
}
function isTypeCompatible(src, dst) {
    if (dst === 'any' || src === 'any')
        return true;
    if (src === dst)
        return true;
    // Allow number -> vector splat in some domains.
    if (src === 'number' && (dst === 'vec2' || dst === 'vec3' || dst === 'vec4' || dst === 'color'))
        return true;
    // Allow color <-> vec3/vec4 interchange (common in shaders).
    if (src === 'color' && (dst === 'vec3' || dst === 'vec4'))
        return true;
    if ((src === 'vec3' || src === 'vec4') && dst === 'color')
        return true;
    return false;
}
export function topoSort(graph) {
    const nodes = nodeById(graph);
    const ids = Array.from(nodes.keys());
    const indeg = new Map();
    const out = new Map();
    for (const id of ids) {
        indeg.set(id, 0);
        out.set(id, []);
    }
    for (const e of graph.edges ?? []) {
        const a = String(e?.from?.node ?? '');
        const b = String(e?.to?.node ?? '');
        if (!a || !b)
            continue;
        if (!nodes.has(a) || !nodes.has(b))
            continue;
        // Directed graph from producer -> consumer
        out.get(a).push(b);
        indeg.set(b, (indeg.get(b) ?? 0) + 1);
    }
    const q = [];
    for (const id of ids)
        if ((indeg.get(id) ?? 0) === 0)
            q.push(id);
    const order = [];
    const indeg2 = new Map(indeg);
    while (q.length) {
        const id = q.shift();
        order.push(id);
        for (const b of out.get(id) ?? []) {
            indeg2.set(b, (indeg2.get(b) ?? 0) - 1);
            if ((indeg2.get(b) ?? 0) === 0)
                q.push(b);
        }
    }
    if (order.length === ids.length)
        return { order, hasCycle: false, cyclicNodes: [] };
    const seen = new Set(order);
    const cyclicNodes = ids.filter((id) => !seen.has(id));
    return { order: order.concat(cyclicNodes), hasCycle: true, cyclicNodes };
}
export function computeLevels(graph, order) {
    const nodes = nodeById(graph);
    const ids = Array.from(nodes.keys());
    const out = new Map();
    for (const id of ids)
        out.set(id, []);
    for (const e of graph.edges ?? []) {
        const a = String(e?.from?.node ?? '');
        const b = String(e?.to?.node ?? '');
        if (!a || !b)
            continue;
        if (!nodes.has(a) || !nodes.has(b))
            continue;
        out.get(a).push(b);
    }
    const level = new Map();
    for (const id of ids)
        level.set(id, 0);
    const seq = Array.isArray(order) && order.length ? order : topoSort(graph).order;
    for (const id of seq) {
        const l = level.get(id) ?? 0;
        for (const b of out.get(id) ?? [])
            level.set(b, Math.max(level.get(b) ?? 0, l + 1));
    }
    return level;
}
export function validateGraph(graph, registry) {
    const issues = [];
    const nodeBy = new Map();
    for (const n of graph.nodes ?? []) {
        const id = String(n?.id ?? '');
        if (!id)
            continue;
        if (nodeBy.has(id)) {
            issues.push({
                severity: 'error',
                code: 'duplicate-node-id',
                nodeId: id,
                message: `Duplicate node id: ${id}`
            });
            continue;
        }
        nodeBy.set(id, { ...n, id });
        if (registry && !registry.has(String(n.kind ?? ''))) {
            issues.push({
                severity: 'warning',
                code: 'unknown-kind',
                nodeId: id,
                message: `Unknown node kind: ${String(n.kind ?? '')}`
            });
        }
    }
    const inputOccupied = new Set();
    for (const e of graph.edges ?? []) {
        const a = String(e?.from?.node ?? '');
        const b = String(e?.to?.node ?? '');
        const fromPort = String(e?.from?.port ?? '');
        const toPort = String(e?.to?.port ?? '');
        const edgeId = String(e?.id ?? '');
        if (!nodeBy.has(a)) {
            issues.push({ severity: 'error', code: 'missing-node', edgeId, nodeId: a, message: `Edge from missing node: ${a}` });
            continue;
        }
        if (!nodeBy.has(b)) {
            issues.push({ severity: 'error', code: 'missing-node', edgeId, nodeId: b, message: `Edge to missing node: ${b}` });
            continue;
        }
        if (registry) {
            const defA = registry.get(nodeBy.get(a).kind);
            const defB = registry.get(nodeBy.get(b).kind);
            const portA = defA?.ports?.find((p) => p.name === fromPort) ?? null;
            const portB = defB?.ports?.find((p) => p.name === toPort) ?? null;
            if (!portA) {
                issues.push({ severity: 'warning', code: 'missing-port', edgeId, nodeId: a, message: `Missing from-port: ${a}.${fromPort}` });
            }
            else if (portA.direction !== 'out') {
                issues.push({
                    severity: 'error',
                    code: 'wrong-port-direction',
                    edgeId,
                    nodeId: a,
                    message: `From-port must be 'out': ${a}.${fromPort}`
                });
            }
            if (!portB) {
                issues.push({ severity: 'warning', code: 'missing-port', edgeId, nodeId: b, message: `Missing to-port: ${b}.${toPort}` });
            }
            else if (portB.direction !== 'in') {
                issues.push({
                    severity: 'error',
                    code: 'wrong-port-direction',
                    edgeId,
                    nodeId: b,
                    message: `To-port must be 'in': ${b}.${toPort}`
                });
            }
            if (portA && portB && !isTypeCompatible(portA.type, portB.type)) {
                issues.push({
                    severity: 'error',
                    code: 'type-mismatch',
                    edgeId,
                    message: `Type mismatch: ${a}.${fromPort} (${portA.type}) -> ${b}.${toPort} (${portB.type})`
                });
            }
            if (portB && portB.direction === 'in') {
                const key = `${b}.${toPort}`;
                if (inputOccupied.has(key)) {
                    issues.push({ severity: 'warning', code: 'multiple-inputs', edgeId, message: `Multiple edges into input: ${key}` });
                }
                inputOccupied.add(key);
            }
        }
    }
    const topo = topoSort(graph);
    if (topo.hasCycle) {
        issues.push({
            severity: 'warning',
            code: 'cycle',
            message: `Graph contains a cycle involving: ${topo.cyclicNodes.join(', ')}`
        });
    }
    const ok = !issues.some((i) => i.severity === 'error');
    return { ok, issues, nodeById: nodeBy };
}
//# sourceMappingURL=core.js.map