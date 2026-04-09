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

export interface HistoryAction<S = unknown> {
  label?: string;
  do(): S;
  undo(snapshot: S): void;
}

export interface HistoryStack {
  /** Execute an action and push it onto the undo stack. Clears the redo stack. */
  push<S>(action: HistoryAction<S>): S;
  /** Undo the most recent action. Returns true if an action was undone. */
  undo(): boolean;
  /** Redo the most recently undone action. Returns true if an action was redone. */
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Discard all history. */
  clear(): void;
  /** Number of steps that can be undone. */
  readonly depth: number;
  /** Peek at the label of the next action to be undone, or undefined. */
  readonly undoLabel: string | undefined;
  /** Peek at the label of the next action to be redone, or undefined. */
  readonly redoLabel: string | undefined;
}

export interface HistoryOptions {
  /** Maximum number of entries in the undo stack (default: 128). */
  maxDepth?: number;
}

type FullEntry = {
  label: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apply: () => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  revert: (snap: any) => void;
  snap: unknown;
};

/** Full undo/redo stack with apply + revert symmetry. */
export function createHistory(opts?: HistoryOptions): HistoryStack {
  const maxDepth = Math.max(1, (opts?.maxDepth ?? 128) | 0);
  const undoStack: FullEntry[] = [];
  const redoStack: FullEntry[] = [];

  return {
    push<S>(action: HistoryAction<S>): S {
      const snap = action.do();
      undoStack.push({
        label: action.label,
        apply: action.do.bind(action),
        revert: action.undo.bind(action),
        snap,
      });
      if (undoStack.length > maxDepth) undoStack.splice(0, undoStack.length - maxDepth);
      redoStack.length = 0;
      return snap;
    },

    undo(): boolean {
      const entry = undoStack.pop();
      if (!entry) return false;
      entry.revert(entry.snap);
      redoStack.push(entry);
      return true;
    },

    redo(): boolean {
      const entry = redoStack.pop();
      if (!entry) return false;
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
