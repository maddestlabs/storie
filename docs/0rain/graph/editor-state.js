export function createDefaultEditorState() {
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
export function beginPanDrag(state, mouseX, mouseY) {
    state.drag = {
        mode: 'pan',
        ox: mouseX,
        oy: mouseY,
        startCamX: state.camX,
        startCamY: state.camY
    };
}
export function updateDrag(state, mouseX, mouseY) {
    const d = state.drag;
    if (!d)
        return;
    if (d.mode === 'pan') {
        state.camX = d.startCamX + (mouseX - d.ox);
        state.camY = d.startCamY + (mouseY - d.oy);
    }
}
export function endDrag(state) {
    state.drag = null;
}
//# sourceMappingURL=editor-state.js.map