/**
 * Input management for keyboard and mouse
 */

import type { InputState } from './types.js';

export class InputManager {
  private state: InputState;
  private canvas: HTMLCanvasElement;

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
      if (!this.state.keys.get(e.key)) {
        this.state.keysPressed.add(e.key);
      }
      this.state.keys.set(e.key, true);
    });

    window.addEventListener('keyup', (e) => {
      this.state.keys.set(e.key, false);
      this.state.keysReleased.add(e.key);
    });

    // Mouse events
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.state.mouseX = e.clientX - rect.left;
      this.state.mouseY = e.clientY - rect.top;
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.state.mouseButtons.set(e.button, true);
      this.state.mouseButtonsClicked.add(e.button);
      e.preventDefault();
    });

    this.canvas.addEventListener('mouseup', (e) => {
      this.state.mouseButtons.set(e.button, false);
      e.preventDefault();
    });

    // Prevent context menu
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
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
    console.log(`📍 InputManager.updateMousePosition(${x}, ${y})`);
    this.state.mouseX = x;
    this.state.mouseY = y;
    console.log(`   State now: mouseX=${this.state.mouseX}, mouseY=${this.state.mouseY}`);
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
