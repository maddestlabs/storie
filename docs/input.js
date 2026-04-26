/**
 * Input management for keyboard and mouse
 */
export class InputManager {
    state;
    canvas;
    enabled = true;
    constructor(canvas) {
        this.canvas = canvas;
        this.state = {
            keys: new Map(),
            keysPressed: new Set(),
            keysReleased: new Set(),
            mouseX: 0,
            mouseY: 0,
            mouseButtons: new Map(),
            mouseButtonsClicked: new Set()
        };
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            if (!this.enabled)
                return;
            if (!this.state.keys.get(e.key)) {
                this.state.keysPressed.add(e.key);
            }
            this.state.keys.set(e.key, true);
        });
        window.addEventListener('keyup', (e) => {
            if (!this.enabled)
                return;
            this.state.keys.set(e.key, false);
            this.state.keysReleased.add(e.key);
        });
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.enabled)
                return;
            const rect = this.canvas.getBoundingClientRect();
            // Convert from CSS pixels (clientX/clientY) into canvas pixel coordinates.
            // This keeps input aligned when the canvas is scaled (DPR, CSS sizing).
            const scaleX = rect.width > 0 ? (this.canvas.width / rect.width) : 1;
            const scaleY = rect.height > 0 ? (this.canvas.height / rect.height) : 1;
            this.state.mouseX = (e.clientX - rect.left) * scaleX;
            this.state.mouseY = (e.clientY - rect.top) * scaleY;
        });
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.enabled) {
                e.preventDefault();
                return;
            }
            // Ensure click uses current coordinates even if mousemove didn't fire.
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = rect.width > 0 ? (this.canvas.width / rect.width) : 1;
            const scaleY = rect.height > 0 ? (this.canvas.height / rect.height) : 1;
            this.state.mouseX = (e.clientX - rect.left) * scaleX;
            this.state.mouseY = (e.clientY - rect.top) * scaleY;
            this.state.mouseButtons.set(e.button, true);
            this.state.mouseButtonsClicked.add(e.button);
            e.preventDefault();
        });
        this.canvas.addEventListener('mouseup', (e) => {
            if (!this.enabled) {
                e.preventDefault();
                return;
            }
            const rect = this.canvas.getBoundingClientRect();
            const scaleX = rect.width > 0 ? (this.canvas.width / rect.width) : 1;
            const scaleY = rect.height > 0 ? (this.canvas.height / rect.height) : 1;
            this.state.mouseX = (e.clientX - rect.left) * scaleX;
            this.state.mouseY = (e.clientY - rect.top) * scaleY;
            this.state.mouseButtons.set(e.button, false);
            e.preventDefault();
        });
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    setEnabled(enabled) {
        this.enabled = !!enabled;
        if (!this.enabled) {
            // Avoid sticky keys/buttons when switching into a locked mode.
            this.state.keys.clear();
            this.state.keysPressed.clear();
            this.state.keysReleased.clear();
            this.state.mouseButtons.clear();
            this.state.mouseButtonsClicked.clear();
        }
    }
    isEnabled() {
        return this.enabled;
    }
    isKeyDown(key) {
        return this.state.keys.get(key) || false;
    }
    isKeyPressed(key) {
        return this.state.keysPressed.has(key);
    }
    isKeyReleased(key) {
        return this.state.keysReleased.has(key);
    }
    isMouseDown(button = 0) {
        return this.state.mouseButtons.get(button) || false;
    }
    isMouseClicked(button = 0) {
        return this.state.mouseButtonsClicked.has(button);
    }
    getMouseX() {
        return this.state.mouseX;
    }
    getMouseY() {
        return this.state.mouseY;
    }
    /**
     * Apply a synthetic input event to the internal key/mouse state.
     * This bypasses the DOM event listeners and can be used for automation.
     *
     * Note: This updates state used by key.down()/pressed()/released() and
     * mouse.down()/clicked() helpers. It does not dispatch to user handlers;
     * the engine is responsible for that.
     */
    applySyntheticEvent(event) {
        const t = event?.type;
        if (t === 'keydown') {
            const k = String(event.key ?? '');
            if (!k)
                return;
            if (!this.state.keys.get(k))
                this.state.keysPressed.add(k);
            this.state.keys.set(k, true);
            return;
        }
        if (t === 'keyup') {
            const k = String(event.key ?? '');
            if (!k)
                return;
            this.state.keys.set(k, false);
            this.state.keysReleased.add(k);
            return;
        }
        if (t === 'mouse_move') {
            const x = Number(event.x);
            const y = Number(event.y);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                this.state.mouseX = x;
                this.state.mouseY = y;
            }
            return;
        }
        if (t === 'mouse') {
            const x = Number(event.x);
            const y = Number(event.y);
            if (Number.isFinite(x) && Number.isFinite(y)) {
                this.state.mouseX = x;
                this.state.mouseY = y;
            }
            const buttonNum = event.button === 'middle' ? 1 : event.button === 'right' ? 2 : 0;
            const isPress = event.action === 'press';
            const isRelease = event.action === 'release';
            if (isPress) {
                this.state.mouseButtons.set(buttonNum, true);
                this.state.mouseButtonsClicked.add(buttonNum);
            }
            else if (isRelease) {
                this.state.mouseButtons.set(buttonNum, false);
            }
            return;
        }
        // 'text' does not affect key-down state (it's a character input event)
    }
    /**
     * Update mouse position (used by event handlers)
     */
    updateMousePosition(x, y) {
        this.state.mouseX = x;
        this.state.mouseY = y;
    }
    /**
     * Clear frame-specific input states
     * Call this at the end of each frame
     */
    endFrame() {
        this.state.keysPressed.clear();
        this.state.keysReleased.clear();
        this.state.mouseButtonsClicked.clear();
    }
}
//# sourceMappingURL=input.js.map