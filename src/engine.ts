/**
 * Main S|torie engine
 * Manages main loop, document loading, and user script execution
 */

import { LayerStack } from './layers.js';
import { InputManager } from './input.js';
import { Canvas2DRenderer } from './renderer.js';
import { WebGPURenderer } from './webgpu-renderer.js';
import { ScriptSandbox } from './sandbox.js';
import { parseMarkdown } from './markdown.js';
import { getTheme, applyTheme } from './themes.js';
import type { UserScript, Color, InputEvent, ThemeColors, ThemeStyleSheet, NamedStyle } from './types.js';
import { KEY } from './types.js';
import type { SandboxAPI } from './sandbox.js';

export interface EngineConfig {
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  preferWebGPU?: boolean; // Default true
}

type Renderer = Canvas2DRenderer | WebGPURenderer;

export class StorieEngine {
  // Core systems
  private layers: LayerStack;
  private input: InputManager;
  private renderer: Renderer;
  private sandbox: ScriptSandbox;
  
  // Theme system
  private currentTheme: ThemeColors;
  private styleSheet: ThemeStyleSheet;
  
  // Timing
  private frameCount: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private lastFrameTime: number = 0;
  private running: boolean = false;
  
  // Documents
  private documents: Map<string, UserScript> = new Map();
  private activeDocumentId: string | null = null;
  
  // Canvas viewport (reserved for future use)
  // private viewportX: number = 0;
  // private viewportY: number = 0;
  
  // Config
  private width: number;
  private height: number;
  
  // Canvas reference for event listeners
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement, config: EngineConfig = {}) {
    this.canvas = canvas;
    this.width = config.width || 80;
    this.height = config.height || 24;
    
    // Initialize theme system
    this.currentTheme = getTheme('neotopia');
    this.styleSheet = applyTheme(this.currentTheme);
    
    // Initialize systems
    this.layers = new LayerStack(this.width, this.height);
    this.input = new InputManager(canvas);
    
    // Try WebGPU first (unless explicitly disabled), fallback to Canvas2D
    const preferWebGPU = config.preferWebGPU !== false;
    if (preferWebGPU && navigator.gpu) {
      console.log('✓ WebGPU available, will attempt initialization');
      this.renderer = new WebGPURenderer(canvas, {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize
      });
    } else {
      console.log('✓ Using Canvas2D renderer');
      this.renderer = new Canvas2DRenderer(canvas, {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize
      });
    }
    
    // Resize renderer to match configured dimensions
    this.renderer.resize(this.width, this.height);
    
    // Create sandbox with API
    const api = this.createUserAPI();
    this.sandbox = new ScriptSandbox(api);
    
    // Set up input event listeners
    this.setupEventListeners();
    
    console.log('✓ S|torie engine initialized');
    console.log(`  Grid: ${this.width}x${this.height}`);
    console.log(`  Renderer: ${this.renderer.constructor.name}`);
    console.log(`  Theme: neotopia (default)`);
  }

  /**
   * Create the API surface exposed to user code
   */
  private createUserAPI(): SandboxAPI {
    // Need to capture 'this' for proper binding
    const layers = this.layers;
    const engine = this; // Capture for use in getters
    
    return {
      // Terminal text API
      term: {
        write: (x: number, y: number, text: string, fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.write(x, y, text, fg, bg);
        },
        clear: () => {
          const layer = this.layers.getActive();
          layer.clear();
        },
        get layerID(): string {
          return layers.activeLayerId;
        },
        set layerID(id: string) {
          if (layers.get(id)) {
            layers.activeLayerId = id;
          } else {
            console.warn(`Layer "${id}" does not exist`);
          }
        }
      },
      
      // Terminal canvas API (character-based drawing)
      termCanvas: {
        plot: (x: number, y: number, char: string, fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.plot(x, y, char, fg, bg);
        },
        line: (x1: number, y1: number, x2: number, y2: number, char: string, fg?: Color, bg?: Color) => {
          this.drawLine(x1, y1, x2, y2, char, fg, bg);
        },
        rect: (x: number, y: number, w: number, h: number, char: string, fg?: Color, bg?: Color, filled: boolean = false) => {
          this.drawRect(x, y, w, h, char, fg, bg, filled);
        },
        scrollTo: (x: number, y: number) => {
          // Viewport scrolling reserved for future use
          console.log(`Scroll to (${x}, ${y})`);
        },
        width: () => this.width,
        height: () => this.height
      },
      
      // Layer API
      layer: {
        create: (id: string, width?: number, height?: number) => {
          this.layers.create(id, width, height);
        },
        show: (id: string) => {
          this.layers.show(id);
        },
        hide: (id: string) => {
          this.layers.hide(id);
        },
        setAlpha: (id: string, alpha: number) => {
          this.layers.setAlpha(id, alpha);
        },
        clear: (id: string) => {
          const layer = this.layers.get(id);
          if (layer) layer.clear();
        }
      },
      
      // Input API
      key: {
        down: (key: string) => this.input.isKeyDown(key),
        pressed: (key: string) => this.input.isKeyPressed(key),
        released: (key: string) => this.input.isKeyReleased(key),
        SPACE: KEY.SPACE,
        ENTER: KEY.ENTER,
        ESC: KEY.ESC,
        ARROW_UP: KEY.ARROW_UP,
        ARROW_DOWN: KEY.ARROW_DOWN,
        ARROW_LEFT: KEY.ARROW_LEFT,
        ARROW_RIGHT: KEY.ARROW_RIGHT
      },
      
      mouse: {
        x: () => {
          const charWidth = this.renderer.getWidth() / this.width;
          return Math.floor(this.input.getMouseX() / charWidth);
        },
        y: () => {
          const charHeight = this.renderer.getHeight() / this.height;
          return Math.floor(this.input.getMouseY() / charHeight);
        },
        down: (button = 0) => this.input.isMouseDown(button),
        clicked: (button = 0) => this.input.isMouseClicked(button)
      },
      
      // Theme API
      getStyle: (name: string) => this.getStyle(name),
      theme: this.currentTheme,
      
      // Global accessors (for convenience)
      get mouseX() {
        const charWidth = engine.renderer.getWidth() / engine.width;
        const pixelX = engine.input.getMouseX();
        const result = Math.floor(pixelX / charWidth);
        console.log(`🔍 mouseX getter: pixelX=${pixelX}, charWidth=${charWidth}, result=${result}`);
        return result;
      },
      get mouseY() {
        const charHeight = engine.renderer.getHeight() / engine.height;
        const pixelY = engine.input.getMouseY();
        const result = Math.floor(pixelY / charHeight);
        console.log(`🔍 mouseY getter: pixelY=${pixelY}, charHeight=${charHeight}, result=${result}`);
        return result;
      },
      get termWidth() {
        return engine.width;
      },
      get termHeight() {
        return engine.height;
      },
      
      // Read-only state
      getFrame: () => this.frameCount,
      getTime: () => this.elapsedTime,
      getDelta: () => this.deltaTime
    };
  }

  /**
   * Load a markdown document and execute its code with lifecycle hooks
   */
  loadMarkdown(documentId: string, markdown: string): boolean {
    try {
      console.log(`Loading document: ${documentId}`);
      
      // Parse markdown
      const parsed = parseMarkdown(markdown);
      console.log(`  Found ${parsed.sections.length} sections`);
      console.log(`  Found ${parsed.codeBlocks.length} code blocks`);
      
      // Apply theme from frontmatter if specified
      if (parsed.metadata.theme) {
        const themeName = String(parsed.metadata.theme).toLowerCase().replace(/['"]/g, '');
        this.currentTheme = getTheme(themeName);
        this.styleSheet = applyTheme(this.currentTheme);
        console.log(`  Theme: ${themeName}`);
      }
      
      // Extract JavaScript code blocks
      const jsBlocks = parsed.codeBlocks.filter(block => 
        block.lang === 'javascript' || block.lang === 'js'
      );
      
      if (jsBlocks.length === 0) {
        console.warn('  No JavaScript code blocks found');
        return false;
      }
      
      // Create compartment with frontmatter as initial scope
      this.sandbox.createCompartment(documentId, parsed.metadata);
      
      // Group blocks by lifecycle hook
      const initBlocks: string[] = [];
      const updateBlocks: string[] = [];
      const renderBlocks: string[] = [];
      const inputBlocks: string[] = [];
      const globalBlocks: string[] = [];
      
      for (const block of jsBlocks) {
        const hook = block.metadata?.on;
        
        if (hook === 'init') {
          initBlocks.push(block.code);
        } else if (hook === 'update') {
          updateBlocks.push(block.code);
        } else if (hook === 'render') {
          renderBlocks.push(block.code);
        } else if (hook === 'input') {
          inputBlocks.push(block.code);
        } else {
          // No hook metadata - execute in document order (global scope)
          globalBlocks.push(block.code);
        }
      }
      
      // Execute global blocks first (variable declarations, etc.)
      console.log(`  Executing ${globalBlocks.length} global blocks`);
      for (const code of globalBlocks) {
        // First pass: execute with transformation to populate scope
        this.sandbox.executeCodeBlock(documentId, code); // Transform: yes
      }
      
      // Get current scope after first execution
      let currentScope = this.sandbox.getScope(documentId) || {};
      let scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input'].includes(k));
      
      // Second pass: re-execute UNtransformed with exports to create proper closures
      // This allows functions to reference variables in their closure
      if (scopeVarNames.length > 0 && globalBlocks.length > 0) {
        console.log(`  Re-executing global blocks to create closures for ${scopeVarNames.length} variables`);
        const exports = scopeVarNames.map(k => `  scope.${k} = ${k};`).join('\n');
        
        for (const code of globalBlocks) {
          const wrappedCode = `(function() {
${code}
${exports}
})();`;
          this.sandbox.executeCodeBlock(documentId, wrappedCode, true); // Skip transform on second pass
        }
      }
      
      // Get current scope to check for existing handlers and variables
      currentScope = this.sandbox.getScope(documentId) || {};
      
      // Get all non-handler variables from scope
      scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input'].includes(k));
      console.log(`  Scope variables:`, scopeVarNames);
      
      // Check if handlers were directly defined as functions
      const hasInit = typeof currentScope.init === 'function';
      const hasUpdate = typeof currentScope.update === 'function';
      const hasRender = typeof currentScope.render === 'function';
      const hasInput = typeof currentScope.input === 'function';
      
      // Build import/export statements for handlers
      const imports = scopeVarNames.length > 0 ? scopeVarNames.map(k => `  let ${k} = scope.${k};`).join('\n') : '';
      const exports = scopeVarNames.length > 0 ? scopeVarNames.map(k => `  scope.${k} = ${k};`).join('\n') : '';
      
      // Only create handlers from on:init/update/render blocks if not already defined
      if (!hasInit && initBlocks.length > 0) {
        console.log(`  Creating init handler from ${initBlocks.length} blocks`);
        const initCode = `scope.init = function() {
${imports}
${initBlocks.join('\n\n')}
${exports}
};`;
        console.log('🔍 Generated init handler (first 500 chars):', initCode.substring(0, 500));
        this.sandbox.executeCodeBlock(documentId, initCode, true);
      }
      
      if (!hasUpdate && updateBlocks.length > 0) {
        console.log(`  Creating update handler from ${updateBlocks.length} blocks`);
        const updateCode = `scope.update = function(delta) {
${imports}
${updateBlocks.join('\n\n')}
${exports}
};`;
        this.sandbox.executeCodeBlock(documentId, updateCode, true);
      }
      
      if (!hasRender && renderBlocks.length > 0) {
        console.log(`  Creating render handler from ${renderBlocks.length} blocks`);
        const renderCode = `scope.render = function() {
${imports}
${renderBlocks.join('\n\n')}
${exports}
};`;
        this.sandbox.executeCodeBlock(documentId, renderCode, true);
      }
      
      if (!hasInput && inputBlocks.length > 0) {
        console.log(`  Creating input handler from ${inputBlocks.length} blocks`);
        const inputCode = `scope.input = function(event) {
${imports}
${inputBlocks.join('\n\n')}
${exports}
};`;
        this.sandbox.executeCodeBlock(documentId, inputCode, true);
      }
      
      // Extract handlers from scope
      const handlers = this.sandbox.extractHandlers(documentId);
      
      if (!handlers) {
        console.error('  Failed to extract handlers');
        return false;
      }
      
      // Store document
      this.documents.set(documentId, {
        id: documentId,
        handlers,
        sections: parsed.sections
      });
      
      // Set as active if first document
      if (!this.activeDocumentId) {
        this.activeDocumentId = documentId;
      }
      
      // Call init handler
      if (handlers.init) {
        console.log('  Calling init handler');
        try {
          handlers.init();
        } catch (error) {
          console.error('  Error in init:', error);
        }
      }
      
      console.log('✓ Document loaded successfully');
      return true;
      
    } catch (error) {
      console.error(`Failed to load document ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Set the active document
   */
  setActiveDocument(documentId: string): void {
    if (this.documents.has(documentId)) {
      this.activeDocumentId = documentId;
    }
  }

  /**
   * Get the currently active document
   */
  private getActiveDocument(): UserScript | null {
    if (!this.activeDocumentId) return null;
    return this.documents.get(this.activeDocumentId) || null;
  }

  /**
   * Start the main loop (async to support WebGPU init)
   */
  async start(): Promise<void> {
    if (this.running) return;
    
    // Initialize renderer (WebGPU needs async init)
    if ('init' in this.renderer && typeof this.renderer.init === 'function') {
      const success = await this.renderer.init();
      if (!success) {
        console.warn('⚠ WebGPU init failed, falling back to Canvas2D');
        // Create Canvas2D fallback
        const canvas = (this.renderer as any).canvas;
        const fontFamily = (this.renderer as any).fontFamily;
        const fontSize = (this.renderer as any).fontSize;
        this.renderer = new Canvas2DRenderer(canvas, { fontFamily, fontSize });
        this.renderer.resize(this.width, this.height);
      }
    }
    
    this.running = true;
    this.lastFrameTime = performance.now();
    console.log('✓ Main loop started');
    this.mainLoop(this.lastFrameTime);
  }

  /**
   * Stop the main loop
   */
  stop(): void {
    this.running = false;
    console.log('✓ Main loop stopped');
  }

  /**
   * Main loop: update, render, composite
   */
  private mainLoop(timestamp: number): void {
    if (!this.running) return;

    // Calculate delta time
    this.deltaTime = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.elapsedTime += this.deltaTime;

    // Update phase
    this.update();

    // Render phase
    this.render();

    // Composite layers and present
    const composited = this.layers.composite();
    this.renderer.render(composited);

    // Clean up input state
    this.input.endFrame();

    // Next frame
    this.frameCount++;
    requestAnimationFrame((ts) => this.mainLoop(ts));
  }

  /**
   * Update phase - call user's update handler
   */
  private update(): void {
    const doc = this.getActiveDocument();
    if (doc?.handlers?.update) {
      try {
        doc.handlers.update(this.deltaTime);
      } catch (error) {
        console.error('Error in update handler:', error);
      }
    }
  }

  /**
   * Render phase - call user's render handler
   */
  private render(): void {
    const doc = this.getActiveDocument();
    if (doc?.handlers?.render) {
      try {
        doc.handlers.render();
      } catch (error) {
        console.error('Error in render handler:', error);
      }
    }
  }

  /**
   * Helper: Draw a line using Bresenham's algorithm
   */
  private drawLine(x1: number, y1: number, x2: number, y2: number, char: string, fg?: Color, bg?: Color): void {
    const layer = this.layers.getActive();
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1, y = y1;
    while (true) {
      layer.plot(x, y, char, fg, bg);
      
      if (x === x2 && y === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Helper: Draw a rectangle
   */
  private drawRect(x: number, y: number, w: number, h: number, char: string, fg?: Color, bg?: Color, filled: boolean = false): void {
    const layer = this.layers.getActive();
    
    if (filled) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          layer.plot(px, py, char, fg, bg);
        }
      }
    } else {
      // Top and bottom
      for (let px = x; px < x + w; px++) {
        layer.plot(px, y, char, fg, bg);
        layer.plot(px, y + h - 1, char, fg, bg);
      }
      // Left and right
      for (let py = y; py < y + h; py++) {
        layer.plot(x, py, char, fg, bg);
        layer.plot(x + w - 1, py, char, fg, bg);
      }
    }
  }

  /**
   * Resize the engine
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layers.resize(width, height);
    this.renderer.resize(width, height);
  }

  /**
   * Get a named style from the current theme
   */
  private getStyle(name: string): NamedStyle {
    if (!this.styleSheet) {
      console.warn('StyleSheet not initialized, using default colors');
      return {
        fg: { r: 0xff, g: 0xff, b: 0xff },
        bg: { r: 0x00, g: 0x00, b: 0x00 }
      };
    }
    const style = this.styleSheet[name];
    if (!style) {
      console.warn(`Style "${name}" not found, using default`);
      return this.styleSheet.default || {
        fg: { r: 0xff, g: 0xff, b: 0xff },
        bg: { r: 0x00, g: 0x00, b: 0x00 }
      };
    }
    return style;
  }

  /**
   * Set up input event listeners for on:input handlers
   */
  private setupEventListeners(): void {
    // Key events
    this.canvas.addEventListener('keydown', (e) => this.handleKeyEvent(e, 'press'));
    this.canvas.addEventListener('keyup', (e) => this.handleKeyEvent(e, 'release'));
    
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseEvent(e, 'press'));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseEvent(e, 'release'));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMoveEvent(e));
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    
    // Ensure canvas can receive keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.focus();
  }

  /**
   * Handle keyboard events for on:input
   */
  private handleKeyEvent(e: KeyboardEvent, action: 'press' | 'release'): void {
    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) return;

    // Build modifiers array
    const mods: string[] = [];
    if (e.shiftKey) mods.push('shift');
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');

    // Dispatch appropriate event type
    let event: InputEvent;
    
    // For printable characters, send text event on keydown
    if (action === 'press' && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      event = {
        type: 'text',
        text: e.key,
        mods
      };
    } else {
      // For special keys, send key event
      event = {
        type: 'key',
        action,
        key: e.key,
        keyCode: e.keyCode,
        mods
      };
    }

    try {
      const shouldContinue = doc.handlers.input(event);
      if (!shouldContinue) {
        this.stop();
      }
      e.preventDefault();
    } catch (error) {
      console.error('Error in input handler:', error);
    }
  }

  /**
   * Handle mouse button events for on:input
   */
  private handleMouseEvent(e: MouseEvent, action: 'press' | 'release'): void {
    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) {
      console.warn('No input handler for mouse event');
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    
    // Update InputManager's mouse position so mouseX/mouseY globals reflect click position
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    this.input.updateMousePosition(pixelX, pixelY);
    
    // Calculate character size using displayed dimensions (rect), not canvas backing store
    // This handles HiDPI displays correctly
    const charWidth = rect.width / this.width;
    const charHeight = rect.height / this.height;
    const x = Math.floor(pixelX / charWidth);
    const y = Math.floor(pixelY / charHeight);

    console.log(`🔍 Mouse calc: pixel(${pixelX.toFixed(1)},${pixelY.toFixed(1)}) display(${rect.width.toFixed(0)}x${rect.height.toFixed(0)}) grid(${this.width}x${this.height}) charSize(${charWidth.toFixed(2)}x${charHeight.toFixed(2)}) result(${x},${y})`);

    // Build modifiers array
    const mods: string[] = [];
    if (e.shiftKey) mods.push('shift');
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');

    const button = e.button === 0 ? 'left' : e.button === 1 ? 'middle' : 'right';

    const event: InputEvent = {
      type: 'mouse',
      action,
      button,
      x,
      y,
      mods
    };

    console.log('🖱️ Mouse event:', action, button, `(${x},${y})`);

    try {
      const shouldContinue = doc.handlers.input(event);
      console.log('   Input handler returned:', shouldContinue);
      if (!shouldContinue) {
        this.stop();
      }
      e.preventDefault();
    } catch (error) {
      console.error('Error in input handler:', error);
    }
  }

  /**
   * Handle mouse move events for on:input
   */
  private handleMouseMoveEvent(e: MouseEvent): void {
    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) return;

    const rect = this.canvas.getBoundingClientRect();
    const charWidth = this.renderer.getWidth() / this.width;
    const charHeight = this.renderer.getHeight() / this.height;
    const x = Math.floor((e.clientX - rect.left) / charWidth);
    const y = Math.floor((e.clientY - rect.top) / charHeight);

    const event: InputEvent = {
      type: 'mouse_move',
      x,
      y,
      mods: []
    };

    try {
      doc.handlers.input(event);
    } catch (error) {
      console.error('Error in input handler:', error);
    }
  }
}
