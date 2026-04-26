/**
 * history.ts
 *
 * General-purpose undo/redo stack using the command pattern.
 * Each action provides a `do()` that applies the change and returns an opaque
 * revert snapshot, and an `undo(snap)` that restores from that snapshot.
 *
 * Usage from user code (sandbox):
 *   const h = sys.history.create({ maxDepth: 64 });
 *   h.push({ label: 'move', do() { const old = pos; pos = newPos; return old; }, undo(s) { pos = s; } });
 *   h.undo();  // revert
 *   h.redo();  // replay
 */
/** Full undo/redo stack with apply + revert symmetry. */
export function createHistory(opts) {
    const maxDepth = Math.max(1, (opts?.maxDepth ?? 128) | 0);
    const undoStack = [];
    const redoStack = [];
    return {
        push(action) {
            const snap = action.do();
            undoStack.push({
                label: action.label,
                apply: action.do.bind(action),
                revert: action.undo.bind(action),
                snap,
            });
            if (undoStack.length > maxDepth)
                undoStack.splice(0, undoStack.length - maxDepth);
            redoStack.length = 0;
            return snap;
        },
        undo() {
            const entry = undoStack.pop();
            if (!entry)
                return false;
            entry.revert(entry.snap);
            redoStack.push(entry);
            return true;
        },
        redo() {
            const entry = redoStack.pop();
            if (!entry)
                return false;
            const newSnap = entry.apply();
            undoStack.push({ ...entry, snap: newSnap });
            return true;
        },
        canUndo() { return undoStack.length > 0; },
        canRedo() { return redoStack.length > 0; },
        clear() { undoStack.length = 0; redoStack.length = 0; },
        get depth() { return undoStack.length; },
        get undoLabel() { return undoStack[undoStack.length - 1]?.label; },
        get redoLabel() { return redoStack[redoStack.length - 1]?.label; },
    };
}
//# sourceMappingURL=history.js.map