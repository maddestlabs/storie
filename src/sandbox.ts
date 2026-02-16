/**
 * SES-based sandbox for executing user code safely
 * Uses Compartments to isolate user scripts
 * 
 * ============================================================================
 * STORIE CODE STYLE GUIDE (For AI Assistants & Code Generators)
 * ============================================================================
 * 
 * Storie provides THREE ways to create persistent variables:
 * 
 * 1. FRONTMATTER (for document configuration):
 * ```yaml
 * ---
 * playerSpeed: 5
 * startingHealth: 100
 * debugMode: true
 * ---
 * ```
 * Access directly: `playerSpeed`, `startingHealth`, `debugMode`
 * 
 * 2. RAW JS BLOCKS (for runtime state):
 * ```js
 * let score = 0;
 * let playerX = 10;
 * let enemies = [];
 * ```
 * 
 * 3. LIFECYCLE BLOCKS use both (persistent vars auto-import, locals work normally):
 * ```js on:update
 * // Frontmatter config accessible
 * const speed = debugMode ? playerSpeed * 2 : playerSpeed;
 * 
 * // Persistent vars accessible  
 * score++;
 * playerX += speed;
 * 
 * // Local vars don't persist (normal JavaScript)
 * const velocity = calculateSpeed();
 * const bonus = Math.floor(delta * 10);
 * ```
 * 
 * ❌ AVOID (unnecessary boilerplate):
 * ```js
 * scope.state = scope.state || { score: 0 };
 * scope.state.score++;
 * ```
 * 
 * HOW IT WORKS:
 * - Frontmatter variables → automatically added to persistent scope
 * - Raw `js` blocks: Top-level declarations → persistent scope
 * - Lifecycle blocks (on:*): Auto-wrapped with import/export
 * - Result: Config + persistent vars accessible, local vars stay local, zero boilerplate
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
    clear: (bgColor?: any) => void;
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
  
  // Global accessors (for convenience - eliminates manual coordinate tracking)
  mouseX: number;        // Pixel X coordinate (default, matches event.x)
  mouseY: number;        // Pixel Y coordinate (default, matches event.y)
  mouseCellX: number;    // Cell X coordinate (for terminal/TUI work)
  mouseCellY: number;    // Cell Y coordinate (for terminal/TUI work)
  mousePixelX: number;   // Alias for mouseX (pixel coordinates)
  mousePixelY: number;   // Alias for mouseY (pixel coordinates)
  termWidth: number;     // Terminal width in cells
  termHeight: number;    // Terminal height in cells
  
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

    // Seeded SFX helper (built-in chiptone basics)
    sfx: {
      names: () => Array<'coin' | 'zap' | 'boom' | 'jump' | '1up' | 'lose' | 'hurt' | 'blip'>;
      play: (
        name: 'coin' | 'zap' | 'boom' | 'jump' | '1up' | 'lose' | 'hurt' | 'blip',
        seed?: number | string,
        options?: { volume?: number; when?: number }
      ) => { stop: (when?: number) => void };
      snippet: (
        name: 'coin' | 'zap' | 'boom' | 'jump' | '1up' | 'lose' | 'hurt' | 'blip',
        seed?: number | string,
        volume?: number
      ) => string;
    };
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
  
  shader: {
    // WGSL shader management (high-level API)
    // Set uniform values for a registered shader
    setUniform: (shaderName: string, uniformName: string, value: number | number[]) => void;
    // Set the active shader (null to disable)
    setActive: (shaderName: string | null) => void;
    // Get the currently active shader name
    getActive: () => string | null;
    // Get list of registered shader names
    list: () => string[];
    // Check if a shader is registered
    has: (shaderName: string) => boolean;
    // Get shader info (kind, uniforms, etc.)
    info: (shaderName: string) => any;
    // Shader chain API
    // Set a chain of shaders for multi-pass rendering (e.g., ['invert', 'bloom', 'crt'])
    setChain: (shaderNames: string[]) => Promise<boolean>;
    // Get the currently active shader chain
    getChain: () => string[];
    // Clear the active shader chain
    clearChain: () => void;
    // Check if there's an active shader chain
    hasChain: () => boolean;
    // Get detailed info about the active chain
    chainInfo: () => any;
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
  
  // Retained-mode graphical UI (GUI)
  gui: any;

  // WebGPU UI (rendered to GPU texture + composited)
  ui: any;

  // Embedded binary blobs (from ```blob blocks)
  blob: {
    forDocument?: (documentId: string) => {
      list: () => string[];
      has: (name: string) => boolean;
      get: (name: string) => { name: string; mime: string; encoding: 'base64' | 'hex'; data: string; byteLength: number } | null;
      base64: (name: string) => string | null;
      hex: (name: string) => string | null;
      bytes: (name: string) => Uint8Array | null;
      text: (name: string, encoding?: string) => string | null;
    };
    list: () => string[];
    has: (name: string) => boolean;
    get: (name: string) => { name: string; mime: string; encoding: 'base64' | 'hex'; data: string; byteLength: number } | null;
    base64: (name: string) => string | null;
    hex: (name: string) => string | null;
    bytes: (name: string) => Uint8Array | null;
    text: (name: string, encoding?: string) => string | null;
  };

  // Embedded ASCII art blocks (from ```ascii name:...)
  ascii: {
    forDocument?: (documentId: string) => {
      list: () => string[];
      has: (name: string) => boolean;
      get: (name: string) => { name: string; text: string; lines: string[] } | null;
      text: (name: string) => string | null;
      lines: (name: string) => string[] | null;
    };
    list: () => string[];
    has: (name: string) => boolean;
    get: (name: string) => { name: string; text: string; lines: string[] } | null;
    text: (name: string) => string | null;
    lines: (name: string) => string[] | null;
  };

  // Convenience drawing helper for named ASCII blocks
  drawAscii: (x: number, y: number, name: string, fg?: any, bg?: any) => void;

  // Embedded FIGlet fonts (from ```figlet name:...)
  figlet: {
    forDocument?: (documentId: string) => {
      list: () => string[];
      has: (name: string) => boolean;
      text: (name: string) => string | null;
      height: (name: string) => number;
      render: (fontName: string, text: string) => string[];
      renderChar: (fontName: string, ch: string) => string[];
    };
    list: () => string[];
    has: (name: string) => boolean;
    text: (name: string) => string | null;
    height: (name: string) => number;
    render: (fontName: string, text: string) => string[];
    renderChar: (fontName: string, ch: string) => string[];
  };

  // Convenience drawing helper for FIGlet text
  drawFiglet: (
    x: number,
    y: number,
    fontName: string,
    text: string,
    fg?: any,
    bg?: any,
    options?: { vertical?: boolean; letterSpacing?: number }
  ) => void;

  // Embedded ANSI art blocks (from ```ansi name:...)
  ansi: {
    forDocument?: (documentId: string) => {
      list: () => string[];
      has: (name: string) => boolean;
      text: (name: string) => string | null;
      runs: (name: string) => any[] | null;
      width: (name: string) => number;
      height: (name: string) => number;
    };
    list: () => string[];
    has: (name: string) => boolean;
    text: (name: string) => string | null;
    runs: (name: string) => any[] | null;
    width: (name: string) => number;
    height: (name: string) => number;
  };

  // Convenience drawing helper for ANSI assets
  drawAnsi: (x: number, y: number, name: string) => void;
  
  // 3D Canvas API
  canvas3D: {
    enable: () => boolean;
    disable: () => void;
    enabled: boolean;
    available: boolean;
    currentSection: number | null;
    controls: {
      setEnabled: (enabled: boolean) => void;
      enabled: boolean;
    };
    camera: {
      setPosition: (x: number, y: number, z: number) => void;
      setRotation: (x: number, y: number, z: number) => void;
      moveTo: (x: number, y: number, z: number) => void;
      focusOnSection: (sectionIndex: number | string, distance?: number) => void;
      focusOnSectionFit: (sectionIndex: number | string, fill?: number) => void;
      setFOV: (fov: number) => void;
      setEaseSpeed: (position: number, rotation: number) => void;
      getPosition: () => { x: number; y: number; z: number };
      getRotation: () => { x: number; y: number; z: number };
    };
    getSectionLayout: (sectionIndex: number) => any;
    setSectionTransform: (sectionIndex: number, transform: any) => void;
    setSectionVisible: (sectionIndex: number, visible: boolean) => void;
    getSectionCount: () => number;
    config: {
      setDefaults: (config: any) => void;
      getDefaults: () => any;
    };

    layout: {
      setCallback: (fn: (args: any) => any) => void;
      clearCallback: () => void;
    };
  };
  
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
      // Scope is for USER variables only - API objects live in compartment globals
      const scope: Record<string, any> = {
        ...frontmatter, // Include frontmatter variables
      };
      this.scopes.set(documentId, scope);
      
      // Capture API reference for use in compartment globals
      const apiRef = this.api;
      
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

        // WGSL Shader API (high-level shader management)
        shader: this.api.shader,
        
        // Compositor API (Phase 1-5)
        compositor: this.api.compositor,

        // Retained-mode TUI API
        tui: this.api.tui,
        
        // Retained-mode GUI API
        gui: this.api.gui,

        // Embedded blobs (document-scoped)
        blob: (this.api as any).blob?.forDocument ? (this.api as any).blob.forDocument(documentId) : (this.api as any).blob,

        // Embedded ASCII blocks (document-scoped)
        ascii: (this.api as any).ascii?.forDocument ? (this.api as any).ascii.forDocument(documentId) : (this.api as any).ascii,

        // Convenience drawing helper (document-aware)
        drawAscii: (x: number, y: number, name: string, fg?: any, bg?: any) => {
          const asciiRef: any = (this.api as any).ascii;
          const ascii = asciiRef?.forDocument ? asciiRef.forDocument(documentId) : asciiRef;
          if (!ascii || typeof ascii.lines !== 'function') return;
          const lines = ascii.lines(name) as string[] | null;
          if (!lines || !Array.isArray(lines)) return;
          for (let i = 0; i < lines.length; i++) {
            this.api.term.write(x, y + i, lines[i] ?? '', fg, bg);
          }
        },

        // Embedded FIGlet fonts (document-scoped)
        figlet: (this.api as any).figlet?.forDocument ? (this.api as any).figlet.forDocument(documentId) : (this.api as any).figlet,

        // Convenience drawing helper (document-aware)
        drawFiglet: (x: number, y: number, fontName: string, text: string, fg?: any, bg?: any, options?: { vertical?: boolean; letterSpacing?: number }) => {
          const figletRef: any = (this.api as any).figlet;
          const figlet = figletRef?.forDocument ? figletRef.forDocument(documentId) : figletRef;
          if (!figlet) return;

          const vertical = !!options?.vertical;
          const letterSpacing = Math.max(0, options?.letterSpacing ?? 0);

          if (vertical) {
            let currentY = y;
            for (const ch of Array.from(String(text ?? ''))) {
              const lines = typeof figlet.renderChar === 'function' ? (figlet.renderChar(fontName, ch) as string[]) : [];
              for (let i = 0; i < (lines?.length ?? 0); i++) {
                this.api.term.write(x, currentY + i, lines[i] ?? '', fg, bg);
              }
              currentY += (typeof figlet.height === 'function' ? figlet.height(fontName) : (lines?.length ?? 0)) + letterSpacing;
            }
            return;
          }

          if (letterSpacing > 0 && typeof figlet.renderChar === 'function') {
            let currentX = x;
            const height = (typeof figlet.height === 'function') ? figlet.height(fontName) : 0;
            for (const ch of Array.from(String(text ?? ''))) {
              const lines = figlet.renderChar(fontName, ch) as string[];
              for (let i = 0; i < (lines?.length ?? height); i++) {
                this.api.term.write(currentX, y + i, (lines?.[i] ?? ''), fg, bg);
              }
              const w = Math.max(0, ...(lines ?? []).map((l: string) => (l ?? '').length));
              currentX += w + letterSpacing;
            }
            return;
          }

          const lines = (typeof figlet.render === 'function') ? (figlet.render(fontName, text) as string[]) : [];
          if (!lines || !Array.isArray(lines)) return;
          for (let i = 0; i < lines.length; i++) {
            this.api.term.write(x, y + i, lines[i] ?? '', fg, bg);
          }
        },

        // Embedded ANSI art (document-scoped)
        ansi: (this.api as any).ansi?.forDocument ? (this.api as any).ansi.forDocument(documentId) : (this.api as any).ansi,

        // Convenience drawing helper (document-aware)
        drawAnsi: (x: number, y: number, name: string) => {
          const ansiRef: any = (this.api as any).ansi;
          const ansi = ansiRef?.forDocument ? ansiRef.forDocument(documentId) : ansiRef;
          if (!ansi || typeof ansi.runs !== 'function') return;
          const lines = ansi.runs(name) as any[] | null;
          if (!lines || !Array.isArray(lines)) return;
          for (let row = 0; row < lines.length; row++) {
            const runs = lines[row] as any[];
            if (!runs || !Array.isArray(runs)) continue;
            let cx = x;
            for (const run of runs) {
              const text = String(run?.text ?? '');
              if (!text) continue;
              this.api.term.write(cx, y + row, text, run?.fg, run?.bg);
              cx += text.length;
            }
          }
        },

        // WebGPU UI API (document-aware wrapper for helpers that need doc context)
        ui: (() => {
          const uiRef: any = (this.api as any).ui;
          if (!uiRef || typeof uiRef !== 'object') return uiRef;
          if (typeof uiRef.loadImageFromBlob !== 'function') return uiRef;
          const ui = Object.create(uiRef);
          ui.loadImageFromBlob = (name: string) => uiRef.loadImageFromBlob(name, documentId);
          return ui;
        })(),
        
        // 3D Canvas API
        canvas3D: this.api.canvas3D,
        
        // Mouse/terminal accessors - provide BOTH properties (getters) and functions
        // Use captured apiRef to avoid this binding issues in SES
        get mouseX() { return apiRef.mouseX; },
        get mouseY() { return apiRef.mouseY; },
        get mouseCellX() { return apiRef.mouseCellX; },
        get mouseCellY() { return apiRef.mouseCellY; },
        get mousePixelX() { return apiRef.mousePixelX; },
        get mousePixelY() { return apiRef.mousePixelY; },
        get termWidth() { return apiRef.termWidth; },
        get termHeight() { return apiRef.termHeight; },
        
        // Function versions - same as getters but explicit
        getMouseX: () => apiRef.mouseX,
        getMouseY: () => apiRef.mouseY,
        getMouseCellX: () => apiRef.mouseCellX,
        getMouseCellY: () => apiRef.mouseCellY,
        getMousePixelX: () => apiRef.mousePixelX,
        getMousePixelY: () => apiRef.mousePixelY,
        getTermWidth: () => apiRef.termWidth,
        getTermHeight: () => apiRef.termHeight,
        
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
