/**
 * Input management for keyboard and mouse
 */

import type { InputState } from './types.js';

export class InputManager {
  private state: InputState;
  private canvas: HTMLCanvasElement;
  private enabled: boolean = true;

  constructor(canvas: HTMLCanvasElement) {
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

  private setupEventListeners(): void {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (!this.state.keys.get(e.key)) {
        this.state.keysPressed.add(e.key);
      }
      this.state.keys.set(e.key, true);
    });

    window.addEventListener('keyup', (e) => {
      if (!this.enabled) return;
      this.state.keys.set(e.key, false);
      this.state.keysReleased.add(e.key);
    });

    // Mouse events
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
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

  setEnabled(enabled: boolean): void {
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

  isEnabled(): boolean {
    return this.enabled;
  }

  isKeyDown(key: string): boolean {
    return this.state.keys.get(key) || false;
  }

  isKeyPressed(key: string): boolean {
    return this.state.keysPressed.has(key);
  }

  isKeyReleased(key: string): boolean {
    return this.state.keysReleased.has(key);
  }

  isMouseDown(button: number = 0): boolean {
    return this.state.mouseButtons.get(button) || false;
  }

  isMouseClicked(button: number = 0): boolean {
    return this.state.mouseButtonsClicked.has(button);
  }

  getMouseX(): number {
    return this.state.mouseX;
  }

  getMouseY(): number {
    return this.state.mouseY;
  }

  /**
   * Update mouse position (used by event handlers)
   */
  updateMousePosition(x: number, y: number): void {
    this.state.mouseX = x;
    this.state.mouseY = y;
  }

  /**
   * Clear frame-specific input states
   * Call this at the end of each frame
   */
  endFrame(): void {
    this.state.keysPressed.clear();
    this.state.keysReleased.clear();
    this.state.mouseButtonsClicked.clear();
  }
}
