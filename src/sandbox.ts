/**
 * SES-based sandbox for executing user code safely
 * Uses Compartments to isolate user scripts
 * 
 * ============================================================================
 * STORIE CODE STYLE GUIDE (For AI Assistants & Code Generators)
 * ============================================================================
 * 
 * Use the TWO-BLOCK PATTERN for clean, readable code:
 * 
 * ✅ PREFERRED:
 * 
 * 1. Declare persistent state in raw `js` blocks (no lifecycle annotation):
 * ```js
 * let score = 0;
 * let playerX = 10;
 * let enemies = [];
 * ```
 * 
 * 2. Use in lifecycle blocks - persistent vars auto-import, locals work normally:
 * ```js on:update
 * // score and playerX are automatically accessible (persistent)
 * score++;
 * playerX += 5;
 * 
 * // velocity is local - doesn't persist (normal JavaScript)
 * const velocity = calculateSpeed();
 * ```
 * 
 * ❌ AVOID (unnecessary boilerplate):
 * ```js
 * scope.state = scope.state || { score: 0 };
 * scope.state.score++;
 * ```
 * 
 * HOW IT WORKS:
 * - Raw `js` blocks: Top-level declarations → persistent scope
 * - Lifecycle blocks (on:*): Auto-wrapped with import/export
 * - Result: Persistent vars accessible, local vars stay local, zero boilerplate
 * 
 * See docs/CODE_STYLE_GUIDE.md for complete guide.
 * ============================================================================
 */

// Import SES shims (side-effects only - adds to globalThis)
import 'ses';

import type { UserHandlers, InputEvent } from './types.js';
import type { ThemeColors, NamedStyle } from './types.js';

// SES adds these to globalThis
declare const lockdown: any;
declare const Compartment: any;

export interface SandboxAPI {
  // Terminal text API
  term: {
    write: (x: number, y: number, text: string, fg?: any, bg?: any) => void;
    clear: () => void;
    layerID: string;
  };
  
  // Terminal canvas API (character-based drawing)
  termCanvas: {
    plot: (x: number, y: number, char: string, fg?: any, bg?: any) => void;
    line: (x1: number, y1: number, x2: number, y2: number, char: string, fg?: any, bg?: any) => void;
    rect: (x: number, y: number, w: number, h: number, char: string, fg?: any, bg?: any, filled?: boolean) => void;
    scrollTo: (x: number, y: number) => void;
    width: () => number;
    height: () => number;
  };
  
  // Layer API
  layer: {
    create: (id: string, width?: number, height?: number) => void;
    show: (id: string) => void;
    hide: (id: string) => void;
    setAlpha: (id: string, alpha: number) => void;
    clear: (id: string) => void;
  };
  
  // Input API (polling-based for backward compatibility)
  key: {
    down: (key: string) => boolean;
    pressed: (key: string) => boolean;
    released: (key: string) => boolean;
    // Key constants
    SPACE: string;
    ENTER: string;
    ESC: string;
    ARROW_UP: string;
    ARROW_DOWN: string;
    ARROW_LEFT: string;
    ARROW_RIGHT: string;
  };
  
  mouse: {
    x: () => number;
    y: () => number;
    down: (button?: number) => boolean;
    clicked: (button?: number) => boolean;
  };
  
  // Theme API
  getStyle: (name: string) => NamedStyle;
  theme: ThemeColors;
  
  // Module API
  modules: {
    load: (name: string, options?: any) => Promise<any>;
    loadAll: (names: string[], options?: any) => Promise<any[]>;
    isLoaded: (name: string) => boolean;
    isLoading: (name: string) => boolean;
    get: (name: string) => any;
    unload: (name: string) => Promise<void>;
    getMetadata: (name: string) => any;
    on: (event: string, callback: Function) => void;
  };
  
  // Global accessors (for convenience)
  mouseX: number;
  mouseY: number;
  termWidth: number;
  termHeight: number;
  
  // Read-only state
  getFrame: () => number;
  getTime: () => number;
  getDelta: () => number;
  
  // Native Browser APIs
  audio: {
    // Shared AudioContext instance
    context: AudioContext;
    // Helpers
    playTone: (frequency: number, duration: number, volume?: number) => { osc: OscillatorNode; gain: GainNode };
    loadSound: (url: string) => Promise<AudioBuffer>;
    playBuffer: (buffer: AudioBuffer, options?: { loop?: boolean; volume?: number; playbackRate?: number }) => AudioBufferSourceNode;
    // Raw API shortcuts
    createOscillator: () => OscillatorNode;
    createGain: () => GainNode;
    createBiquadFilter: () => BiquadFilterNode;
    createDelay: () => DelayNode;
    createConvolver: () => ConvolverNode;
    createDynamicsCompressor: () => DynamicsCompressorNode;
    createAnalyser: () => AnalyserNode;
    createBufferSource: () => AudioBufferSourceNode;
    createPanner: () => PannerNode;
    createStereoPanner: () => StereoPannerNode;
    createWaveShaper: () => WaveShaperNode;
    // Properties
    currentTime: number;
    sampleRate: number;
    destination: AudioDestinationNode;
    state: AudioContextState;
  };
  
  canvas2d: {
    // Shared Canvas2D context (may be OffscreenCanvasRenderingContext2D)
    context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    // Helpers
    clear: (color?: string) => void;
    drawRect: (x: number, y: number, w: number, h: number, color: string, filled?: boolean) => void;
    drawCircle: (x: number, y: number, radius: number, color: string, filled?: boolean) => void;
    drawLine: (x1: number, y1: number, x2: number, y2: number, color: string, lineWidth?: number) => void;
    drawImage: (image: HTMLImageElement | ImageBitmap | HTMLCanvasElement, x: number, y: number, w?: number, h?: number) => void;
    text: (text: string, x: number, y: number, color: string, font?: string) => void;
    loadImage: (url: string) => Promise<HTMLImageElement>;
    // Properties
    width: number;
    height: number;
  };
  
  webgl: {
    // Shared WebGL context (lazy init)
    context: WebGLRenderingContext | null;
    // Helpers
    createShader: (type: 'vertex' | 'fragment', source: string) => WebGLShader | null;
    createProgram: (vertexShader: WebGLShader, fragmentShader: WebGLShader) => WebGLProgram | null;
    available: boolean;
  };
  
  webgpu: {
    // Controlled device access
    device: GPUDevice | null;
    available: boolean;
    // Initialization
    init: () => Promise<boolean>;
    // WebGPU Constants
    GPUBufferUsage: any;
    GPUTextureUsage: any;
    GPUShaderStage: any;
    // Safe helpers with guardrails
    createBuffer: (size: number, usage: GPUBufferUsageFlags) => GPUBuffer | null;
    createShaderModule: (code: string) => GPUShaderModule | null;
    createTexture: (width: number, height: number, format?: GPUTextureFormat) => GPUTexture | null;
  };
  
  compositor: {
    // Current mode
    mode: 'auto' | 'manual';
    // Set compositing mode
    setMode: (mode: 'auto' | 'manual') => void;
    // Layer configuration
    layers: any;
    // Manual compositing methods
    clear: (color?: string) => void;
    blit: (layerName: string, options?: any) => void;
    present: () => void;
    // Phase 3: Custom contexts
    createContext: (name: string, options: {
      type: 'canvas2d' | 'webgl' | 'webgl2';
      width: number;
      height: number;
      alpha?: boolean;
      antialias?: boolean;
      zIndex?: number;
    }) => any | null;
    removeLayer: (name: string) => boolean;
    // Phase 5: Shader Pipeline
    loadEffect: (name: string, url: string) => Promise<void>;
    buildPipeline: (effects: string[]) => Promise<void>;
    setPipelineEnabled: (enabled: boolean) => void;
    setEffectUniform: (effectName: string, uniformName: string, value: number | number[]) => void;
    getEffects: () => string[];
    hasEffect: (name: string) => boolean;
    // Availability
    available: boolean;
  };

  // Retained-mode terminal UI (TUI)
  tui: any;

  // WebGPU UI (rendered to GPU texture + composited)
  ui: any;
  
  // Input event (available in on:input blocks)
  event?: InputEvent;
}

let sesInitialized = false;

/**
 * Initialize SES lockdown (only needs to be called once globally)
 */
function initializeSES(): void {
  if (sesInitialized) return;
  
  try {
    lockdown({
      errorTaming: 'unsafe',    // Better error messages during development
      consoleTaming: 'unsafe',  // Allow console.log for user debugging
      stackFiltering: 'verbose'
    });
    sesInitialized = true;
    console.log('✓ SES lockdown initialized');
  } catch (error) {
    console.error('Failed to initialize SES:', error);
    throw error;
  }
}

export class ScriptSandbox {
  private api: SandboxAPI;
  private compartments: Map<string, any> = new Map();
  private scopes: Map<string, Record<string, any>> = new Map(); // Persistent shared scope per document

  constructor(api: SandboxAPI) {
    this.api = api;
    initializeSES();
  }

  /**
   * Create a new isolated compartment for a document with persistent shared scope
   * 
   * Frontmatter variables are automatically exposed as globals in the compartment,
   * matching tstorie's exposeFrontMatterVariables() behavior. This allows scripts
   * to access frontmatter values directly (e.g., `title`, `version`, `debugMode`)
   * without needing to reference a parent object.
   * 
   * Example frontmatter:
   * ```yaml
   * ---
   * title: "My Game"
   * version: 1.5
   * debugMode: true
   * colors: red, green, blue
   * ---
   * ```
   * 
   * These become directly accessible in JavaScript:
   * ```javascript
   * console.log(title);      // "My Game"
   * console.log(version);    // 1.5 (number)
   * console.log(debugMode);  // true (boolean)
   * console.log(colors);     // ["red", "green", "blue"] (array)
   * ```
   */
  createCompartment(documentId: string, frontmatter: Record<string, any> = {}): any {
    try {
      // Create persistent scope for this document (shared across all code blocks)
      const scope: Record<string, any> = {
        ...frontmatter // Include frontmatter variables
      };
      this.scopes.set(documentId, scope);
      
      // Capture API for closures
      const api = this.api;
      
      // Build compartment globals - start with frontmatter variables exposed directly
      // This matches tstorie's exposeFrontMatterVariables() behavior
      const compartmentGlobals: Record<string, any> = {
        // Console for debugging
        console,
        
        // Math and Date are safe
        Math,
        Date,
        
        // Persistent shared scope (writable)
        scope,
        
        // Expose frontmatter variables as direct globals (for convenient access)
        ...frontmatter,
        
        // Engine API (capability-based)
        term: this.api.term,
        termCanvas: this.api.termCanvas,
        layer: this.api.layer,
        key: this.api.key,
        mouse: this.api.mouse,
        
        // Theme API
        getStyle: this.api.getStyle,
        theme: this.api.theme,
        
        // Module API
        modules: this.api.modules,
        
        // Native Browser APIs
        audio: this.api.audio,
        canvas2d: this.api.canvas2d,
        webgl: this.api.webgl,
        webgpu: this.api.webgpu,
        
        // Compositor API (Phase 1-5)
        compositor: this.api.compositor,

        // Retained-mode TUI API
        tui: this.api.tui,

        // WebGPU UI API
        ui: this.api.ui,
        
        // Global accessors (as functions, not getters, for SES compatibility)
        getMouseX: () => api.mouseX,
        getMouseY: () => api.mouseY,
        getTermWidth: () => api.termWidth,
        getTermHeight: () => api.termHeight,
        
        // Also expose as properties for convenience (but these might not work in strict SES)
        get mouseX() { return api.mouseX; },
        get mouseY() { return api.mouseY; },
        get termWidth() { return api.termWidth; },
        get termHeight() { return api.termHeight; },
        
        // Read-only state accessors
        getFrame: this.api.getFrame,
        getTime: this.api.getTime,
        getDelta: this.api.getDelta,
        
        // NO ACCESS TO:
        // - fetch (network)
        // - localStorage (storage)
        // - document (DOM)
        // - window (global)
        // - eval (code injection)
        // - Function constructor
        // - XMLHttpRequest
      };
      
      const compartment = new Compartment(compartmentGlobals);

      this.compartments.set(documentId, compartment);
      return compartment;
    } catch (error) {
      console.error(`Failed to create compartment for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a code block in the document's persistent scope
   * 
   * Auto-binding (only for initialization blocks - raw `js` blocks):
   * - Top-level `let/const/var` declarations → stored in scope
   * - Top-level `function` declarations → stored in scope
   * 
   * Lifecycle blocks (on:init, on:update, etc.) are wrapped by the engine
   * with automatic import/export of scope variables, so local declarations
   * remain local while persistent vars are accessible.
   * 
   * @param documentId - Document identifier
   * @param code - JavaScript code to execute
   * @param skipTransform - Skip auto-binding transformation (for pre-wrapped code)
   */
  executeCodeBlock(documentId: string, code: string, skipTransform: boolean = false): any {
    const compartment = this.compartments.get(documentId);
    const scopeObj = this.scopes.get(documentId);
    
    if (!compartment || !scopeObj) {
      console.error(`No compartment/scope found for ${documentId}`);
      return null;
    }

    try {
      // Apply auto-binding transformation (unless skipped)
      let transformedCode = skipTransform ? code : this.autoBindVariables(code);
      
      const result = compartment.evaluate(transformedCode);
      return result;
    } catch (error: any) {
      console.error(`Error executing code block in ${documentId}:`, error);
      console.error('Stack:', error.stack);
      return null;
    }
  }
  
  /**
   * Auto-binding for initialization blocks (raw `js` blocks only)
   * 
   * Transforms top-level variable declarations to scope assignments:
   * - `let x = 10;` → `scope.x = scope.x ?? 10;`
   * - `function foo() {}` → `scope.foo = function foo() {}`
   * 
   * This ONLY applies to raw `js` blocks (no lifecycle annotation).
   * Lifecycle blocks (on:*) are wrapped by the engine with proper
   * import/export, so local vars stay local.
   * 
   * Variables inside functions, loops, etc. remain untouched (only flush-left).
   */
  private autoBindVariables(code: string): string {
    let transformedCode = code;
    
    // Transform ONLY top-level (flush-left) variable declarations
    // Note: The ^ anchor ensures we only match at the start of lines
    
    // Transform: let x = value; -> scope.x = scope.x ?? (value);
    transformedCode = transformedCode.replace(
      /^(let|const|var)\s+(\w+)\s*=\s*([^;]+);/gm,
      (_m, _kw, varName, value) => {
        console.log(`  📝 Persisting variable: ${varName}`);
        // Use ?? to preserve existing scope values (allows re-initialization)
        return `scope.${varName} = scope.${varName} ?? (${value});`;
      }
    );
    
    // Transform: let x; -> scope.x = scope.x ?? undefined;
    transformedCode = transformedCode.replace(
      /^(let|const|var)\s+(\w+)\s*;/gm,
      (_m, _kw, varName) => {
        console.log(`  📝 Persisting variable: ${varName}`);
        return `scope.${varName} = scope.${varName} ?? undefined;`;
      }
    );
    
    // Transform: function foo(...) { -> scope.foo = function foo(...) {
    transformedCode = transformedCode.replace(
      /^function\s+(\w+)\s*\(/gm,
      (_m, funcName) => {
        console.log(`  📝 Persisting function: ${funcName}`);
        return `scope.${funcName} = function ${funcName}(`;
      }
    );
    
    return transformedCode;
  }
  
  /**
   * Execute user code and extract init/update/render/input handlers from scope
   */
  extractHandlers(documentId: string): UserHandlers | null {
    const scope = this.scopes.get(documentId);
    if (!scope) {
      console.error(`No scope found for ${documentId}`);
      return null;
    }

    try {
      const validHandlers: UserHandlers = {};
      
      if (typeof scope.init === 'function') {
        validHandlers.init = scope.init;
      }
      if (typeof scope.update === 'function') {
        validHandlers.update = scope.update;
      }
      if (typeof scope.render === 'function') {
        validHandlers.render = scope.render;
      }
      if (typeof scope.input === 'function') {
        validHandlers.input = scope.input;
      }
      
      return Object.keys(validHandlers).length > 0 ? validHandlers : null;
    } catch (error: any) {
      console.error(`Error extracting handlers from ${documentId}:`, error);
      return null;
    }
  }
  
  /**
   * Get the scope object for a document (for inspection)
   */
  getScope(documentId: string): Record<string, any> | null {
    return this.scopes.get(documentId) || null;
  }

  /**
   * Destroy a compartment and clean up resources
   */
  destroyCompartment(documentId: string): void {
    this.compartments.delete(documentId);
    this.scopes.delete(documentId);
  }

  /**
   * Clear all compartments
   */
  clearAll(): void {
    this.compartments.clear();
    this.scopes.clear();
  }
}
