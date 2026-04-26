/**
 * TUI System
 * Main entry point for terminal-based retained-mode UI
 */
import { WidgetManager } from '../core/widget-manager.js';
import { InputRouter } from '../core/input-router.js';
import { TUIButton } from './button.js';
import { TUILabel } from './label.js';
import { TUICheckbox } from './checkbox.js';
import { TUISlider } from './slider.js';
import { TUITextField } from './textfield.js';
import { TUITextEditor } from './texteditor.js';
/**
 * Main TUI system that manages terminal-based UI
 */
export class TUISystem {
    widgetManager;
    inputRouter;
    renderer;
    lastMouseX = 0;
    lastMouseY = 0;
    lastMouseDown = false;
    constructor(renderer) {
        this.renderer = renderer;
        this.widgetManager = new WidgetManager();
        this.inputRouter = new InputRouter({ widgetManager: this.widgetManager });
    }
    /**
     * Create a button widget
     */
    createButton(config) {
        const button = new TUIButton(config);
        this.widgetManager.register(button);
        return button;
    }
    /**
     * Create a label widget
     */
    createLabel(config) {
        const label = new TUILabel(config);
        this.widgetManager.register(label);
        return label;
    }
    /**
     * Create a checkbox widget
     */
    createCheckbox(config) {
        const checkbox = new TUICheckbox(config);
        this.widgetManager.register(checkbox);
        return checkbox;
    }
    /**
     * Create a slider widget
     */
    createSlider(config) {
        const slider = new TUISlider(config);
        this.widgetManager.register(slider);
        return slider;
    }
    /**
     * Create a text field widget
     */
    createTextField(config) {
        const textField = new TUITextField(config);
        this.widgetManager.register(textField);
        return textField;
    }
    /**
     * Create a text editor widget (multi-line)
     */
    createTextEditor(config) {
        const editor = new TUITextEditor(config);
        this.widgetManager.register(editor);
        return editor;
    }
    /**
     * Update all widgets with current input state
     * Call this in your update loop
     */
    update(mouseX, mouseY, mouseDown, _gridWidth, _gridHeight) {
        this.lastMouseX = mouseX;
        this.lastMouseY = mouseY;
        this.lastMouseDown = mouseDown;
        // Storie's input events (and polling helpers) provide mouse coordinates in terminal-cell units.
        // Treat them as cell coordinates directly.
        const inputCoord = {
            x: mouseX,
            y: mouseY,
            cellX: mouseX,
            cellY: mouseY
        };
        // Update input routing
        this.inputRouter.update(inputCoord, mouseDown);
        // Update sliders (for drag behavior)
        const sliders = this.widgetManager.getAll().filter(w => w instanceof TUISlider);
        for (const slider of sliders) {
            slider.updateDrag(inputCoord, mouseDown);
        }
    }
    /**
     * Handle a mouse update immediately (for use in on:input)
     * This makes quick clicks reliable even if press+release happen between frames.
     */
    handleMouse(mouseX, mouseY, mouseDown) {
        // Reuse the same routing logic as update().
        this.update(mouseX, mouseY, mouseDown, 0, 0);
    }
    /**
     * Get last observed mouse state (cell coordinates)
     */
    getMouseState() {
        return { x: this.lastMouseX, y: this.lastMouseY, down: this.lastMouseDown };
    }
    /**
     * Handle keyboard input
     */
    handleKey(key, modifiers) {
        // Handle navigation
        if (this.inputRouter.handleKey(key, modifiers)) {
            return; // Consumed by navigation
        }
        // Handle activation
        if (key === 'Enter' || key === ' ') {
            this.inputRouter.handleActivate();
        }
    }
    /**
     * Handle text input (printable characters)
     */
    handleText(text) {
        this.inputRouter.handleText(text);
    }
    /**
     * Render all visible widgets
     * Call this in your render loop
     * @param buffer - Cell buffer to render to (Cell[][])
     */
    render(buffer) {
        const visibleWidgets = this.widgetManager.getVisible();
        for (const widget of visibleWidgets) {
            widget.render(buffer, this.renderer);
        }
    }
    /**
     * Set group visibility
     */
    setGroupVisible(groupId, visible) {
        this.widgetManager.setGroupVisible(groupId, visible);
    }
    /**
     * Clear all widgets
     */
    clear() {
        this.widgetManager.clear();
    }
    /**
     * Get widget manager (for advanced usage)
     */
    getWidgetManager() {
        return this.widgetManager;
    }
}
export { TUIButton, TUILabel, TUICheckbox, TUISlider, TUITextField, TUITextEditor };
//# sourceMappingURL=index.js.map