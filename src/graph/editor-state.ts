import type { Graph } from './types.js';

export type DragMode = 'node' | 'pan' | 'split' | 'wire';

export interface DragState {
  mode: DragMode;
  id?: string;
  ox: number;
  oy: number;
  startCamX: number;
  startCamY: number;
  startRightW?: number;
}

export interface GraphEditorState {
  graph: Graph | null;
  camX: number;
  camY: number;
  rightW: number;

  hoveredId: string | null;
  selectedId: string | null;
  mouseDownLeft: boolean;

  drag: DragState | null;
}

export function createDefaultEditorState(): GraphEditorState {
  return {
    graph: null,
    camX: 0,
    camY: 0,
    rightW: 420,
    hoveredId: null,
    selectedId: null,
    mouseDownLeft: false,
    drag: null
  };
}

export function beginPanDrag(state: GraphEditorState, mouseX: number, mouseY: number): void {
  state.drag = {
    mode: 'pan',
    ox: mouseX,
    oy: mouseY,
    startCamX: state.camX,
    startCamY: state.camY
  };
}

export function updateDrag(state: GraphEditorState, mouseX: number, mouseY: number): void {
  const d = state.drag;
  if (!d) return;

  if (d.mode === 'pan') {
    state.camX = d.startCamX + (mouseX - d.ox);
    state.camY = d.startCamY + (mouseY - d.oy);
  }
}

export function endDrag(state: GraphEditorState): void {
  state.drag = null;
}
