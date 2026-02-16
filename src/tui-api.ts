/**
 * TUI API for Sandbox
 * Exposes retained-mode TUI functionality to sandboxed JavaScript
 */

import { TUISystem } from './ui/tui/index.js';
import { ColorUtils } from './types.js';
import type { TerminalRenderer } from './terminal-renderer.js';
import { setTUIThemeFromStyles } from './ui/tui/theme.js';

/**
 * Create TUI API for sandbox compartment
 * This gets exposed to user JavaScript code
 */
export function createTUIAPI(
  renderer: TerminalRenderer,
  getCellBuffer: () => any[][],
  getStyle?: (name: string) => any
) {
  let tuiSystem: TUISystem | null = null;
  
  return {
    /**
     * Initialize TUI system
     * Call this in on:init
     */
    init() {
      if (getStyle) {
        try {
          setTUIThemeFromStyles(getStyle);
        } catch {
          // Ignore theme failures; widgets will fall back to built-in defaults.
        }
      }
      tuiSystem = new TUISystem(renderer);
      return tuiSystem;
    },
    
    /**
     * Get the current TUI system instance
     */
    getSystem(): TUISystem | null {
      return tuiSystem;
    },
    
    /**
     * Create a button widget
     * 
     * @example
     * ```javascript
     * const btn = tui.createButton({
     *   bounds: { x: 10, y: 5, width: 20, height: 3 },
     *   label: 'Click Me'
     * });
     * ```
     */
    createButton(config: any) {
      if (!tuiSystem) {
        throw new Error('TUI system not initialized. Call tui.init() first.');
      }
      return tuiSystem.createButton(config);
    },
    
    /**
     * Create a label widget
     * 
     * @example
     * ```javascript
     * const lbl = tui.createLabel({
     *   bounds: { x: 5, y: 2, width: 30, height: 1 },
     *   text: 'My App',
     *   align: 'center'
     * });
     * ```
     */
    createLabel(config: any) {
      if (!tuiSystem) {
        throw new Error('TUI system not initialized. Call tui.init() first.');
      }
      return tuiSystem.createLabel(config);
    },
    
    /**
     * Create a checkbox widget
     * 
     * @example
     * ```javascript
     * const chk = tui.createCheckbox({
     *   bounds: { x: 10, y: 10, width: 20, height: 1 },
     *   label: 'Enable Sound',
     *   checked: true
     * });
     * ```
     */
    createCheckbox(config: any) {
      if (!tuiSystem) {
        throw new Error('TUI system not initialized. Call tui.init() first.');
      }
      return tuiSystem.createCheckbox(config);
    },
    
    /**
     * Create a slider widget
     * 
     * @example
     * ```javascript
     * const slider = tui.createSlider({
     *   bounds: { x: 10, y: 15, width: 30, height: 3 },
     *   label: 'Volume',
     *   min: 0,
     *   max: 100,
     *   value: 50
     * });
     * ```
     */
    createSlider(config: any) {
      if (!tuiSystem) {
        throw new Error('TUI system not initialized. Call tui.init() first.');
      }
      return tuiSystem.createSlider(config);
    },
    
    /**
     * Update TUI with input state
     * Call this in on:update
     * 
     * @example
     * ```javascript
     * tui.update(mouseX, mouseY, mousePressed, width, height);
     * ```
     */
    update(mouseX: number, mouseY: number, mouseDown: boolean, gridWidth: number, gridHeight: number) {
      if (!tuiSystem) return;
      tuiSystem.update(mouseX, mouseY, mouseDown, gridWidth, gridHeight);
    },

    /**
     * Handle mouse input immediately (cell coordinates)
     * Call this in on:input for 'mouse' / 'mouse_move' events.
     * This avoids missing fast click transitions between frames.
     */
    handleMouse(mouseX: number, mouseY: number, mouseDown: boolean) {
      if (!tuiSystem) return;
      tuiSystem.handleMouse(mouseX, mouseY, mouseDown);
    },
    
    /**
     * Handle keyboard input
     * Call this in on:input when handling key events
     * 
     * @example
     * ```javascript
     * tui.handleKey('Tab', { shift: false });
     * ```
     */
    handleKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }) {
      if (!tuiSystem) return;
      tuiSystem.handleKey(key, modifiers);
    },
    
    /**
     * Render all widgets
     * Call this in on:render
     * 
     * @example
     * ```javascript
     * tui.render();
     * ```
     */
    render() {
      if (!tuiSystem) return;
      const buffer = getCellBuffer();
      tuiSystem.render(buffer);
    },
    
    /**
     * Set group visibility
     * 
     * @example
     * ```javascript
     * tui.setGroupVisible(1, false); // Hide group 1
     * ```
     */
    setGroupVisible(groupId: string | number, visible: boolean) {
      if (!tuiSystem) return;
      tuiSystem.setGroupVisible(groupId, visible);
    },
    
    /**
     * Clear all widgets
     */
    clear() {
      if (!tuiSystem) return;
      tuiSystem.clear();
    },
    
    /**
     * Color utilities
     * Helpers for creating colors
     * 
     * @example
     * ```javascript
     * const red = tui.color.rgb(255, 0, 0);
     * const semiTransparent = tui.color.rgba(255, 0, 0, 128);
     * ```
     */
    color: {
      rgb: ColorUtils.rgb,
      rgba: ColorUtils.rgba,
      from: ColorUtils.from
    }
  };
}

/**
 * Example of how to integrate into sandbox.ts:
 * 
 * ```typescript
 * import { createTUIAPI } from './tui-api.js';
 * 
 * // In createSandbox function:
 * const tuiAPI = createTUIAPI(renderer, cellBuffer);
 * 
 * const endowments = {
 *   // ... existing endowments
 *   tui: tuiAPI
 * };
 * ```
 */
