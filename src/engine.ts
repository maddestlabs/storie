/**
 * Main S|torie engine
 * Manages main loop, document loading, and user script execution
 */

import { LayerStack } from './layers.js';
import { InputManager } from './input.js';
import { Canvas2DRenderer } from './renderer.js';
import { WebGPURenderer } from './webgpu-renderer.js';
import { Compositor } from './compositor.js';
import { ScriptSandbox } from './sandbox.js';
import { parseMarkdown } from './markdown.js';
import { getTheme, applyTheme } from './themes.js';
import { ModuleLoader } from './modules/loader.js';
import { createTUIAPI } from './tui-api.js';
import { WebGPUUIRenderer } from './ui/webgpu-ui-renderer.js';
import type { ModuleResolverConfig } from './modules/types.js';
import type { UserScript, Color, InputEvent, ThemeColors, ThemeStyleSheet, NamedStyle } from './types.js';
import { KEY } from './types.js';
import { ColorUtils } from './types.js';
import type { SandboxAPI } from './sandbox.js';

export interface EngineConfig {
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  preferWebGPU?: boolean; // Default true
  modules?: ModuleResolverConfig; // Module loader configuration
}

type Renderer = Canvas2DRenderer | WebGPURenderer;

export class StorieEngine {
  // Core systems
  private layers: LayerStack;
  private moduleLoader: ModuleLoader;
  private input: InputManager;
  private renderer: Renderer;
  private compositor: Compositor | null = null;
  private sandbox: ScriptSandbox;
  
  // Native browser APIs (shared instances)
  private audioContext: AudioContext;
  private canvas2DContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private offscreenCanvas2D: HTMLCanvasElement | null = null;
  private webglContext: WebGLRenderingContext | null = null;
  private webgpuDevice: GPUDevice | null = null;

  // WebGPU UI (optional)
  private webgpuUIRenderer: WebGPUUIRenderer | null = null;
  
  // Theme system
  private currentTheme: ThemeColors;
  private styleSheet: ThemeStyleSheet;
  
  // Timing
  private frameCount: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private lastFrameTime: number = 0;
  private running: boolean = false;

  // (Reserved for future one-time debug/perf toggles)
  
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
    
    // Initialize native browser APIs (shared instances)
    this.audioContext = new AudioContext();
    // Canvas2D is created lazily on first use (see ensureCanvas2D())
    
    // Initialize systems
    this.layers = new LayerStack(this.width, this.height);
    this.input = new InputManager(canvas);
    
    // Try WebGPU first (unless explicitly disabled), fallback to Canvas2D
    const preferWebGPU = config.preferWebGPU !== false;
    if (preferWebGPU && navigator.gpu) {
      console.log('✓ WebGPU available, will attempt initialization');
      this.renderer = new WebGPURenderer(canvas, {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize,
        // When WebGPU is available we initialize the compositor, which expects
        // the terminal renderer to render into an offscreen texture.
        renderToTexture: true
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
    
    // Initialize module loader
    this.moduleLoader = new ModuleLoader(this, config.modules);
    
    // Create sandbox with API
    const api = this.createUserAPI();
    this.sandbox = new ScriptSandbox(api);
    
    // Set up input event listeners
    this.setupEventListeners();
    
    console.log('✓ S|torie engine initialized');
    console.log(`  Grid: ${this.width}x${this.height}`);
    console.log(`  Renderer: ${this.renderer.constructor.name}`);
    console.log(`  Theme: neotopia (default)`);
    console.log(`  Modules: ready for dynamic loading`);    console.log('  Audio: Web Audio API ready');
    console.log('  Canvas2D: lazy (created on first use)');
  }
  
  /**
   * Initialize Canvas 2D API with offscreen canvas for user drawing
   */
  private ensureCanvas2D(): OffscreenCanvasRenderingContext2D | null {
    if (this.canvas2DContext && this.offscreenCanvas2D) {
      return this.canvas2DContext as OffscreenCanvasRenderingContext2D;
    }

    const offscreen = new OffscreenCanvas(800, 600);
    const ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      console.warn('Failed to create Canvas 2D offscreen context');
      return null;
    }

    this.canvas2DContext = ctx;
    // Store as HTMLCanvasElement for API compatibility (handled as OffscreenCanvas in compositor)
    this.offscreenCanvas2D = offscreen as unknown as HTMLCanvasElement;

    // If compositor already exists, register the Canvas2D layer now.
    // This avoids any per-frame upload cost unless Canvas2D is actually used.
    if (this.compositor) {
      this.compositor.registerLayer('canvas2d', {
        canvas: this.offscreenCanvas2D as unknown as OffscreenCanvas,
        width: offscreen.width,
        height: offscreen.height,
        zIndex: 10
      });
    }

    console.log('✓ Canvas 2D offscreen canvas created (800x600)');
    return ctx;
  }
  
  /**
   * Initialize Compositor (WebGPU only)
   */
  private async initCompositor(): Promise<void> {
    if (!(this.renderer instanceof WebGPURenderer)) return;
    
    // Get WebGPU device from renderer context
    const device = this.renderer.getContext().getDevice();
    if (!device) {
      console.warn('Failed to get WebGPU device for compositor');
      return;
    }
    
    // Create compositor
    this.compositor = new Compositor(device, this.canvas);
    await this.compositor.init();
    
    // Register terminal layer (from WebGPU renderer)
    const terminalTexture = this.renderer.getRenderTexture();
    if (terminalTexture) {
      this.compositor.registerLayer('terminal', {
        texture: terminalTexture,
        width: this.canvas.width,
        height: this.canvas.height,
        zIndex: 0  // Terminal at back
      });
    }
    
    // Canvas2D layer is registered lazily on first use (see ensureCanvas2D()).
    console.log('✓ Compositor initialized (terminal layer)');
  }

  private ensureWebGPUUI(): WebGPUUIRenderer | null {
    if (!(this.renderer instanceof WebGPURenderer)) return null;
    if (!this.compositor) return null;

    if (this.webgpuUIRenderer) return this.webgpuUIRenderer;

    const device = this.renderer.getContext().getDevice();
    if (!device) return null;

    const atlas = this.renderer.getAtlas();
    // Note: atlas GPU resources may not be ready yet (font loading / init timing).
    // The UI renderer can still render rects; text rendering will begin once the
    // atlas texture + sampler exist (checked inside WebGPUUIRenderer.flush()).

    const ui = new WebGPUUIRenderer(device, atlas, this.canvas.width, this.canvas.height);
    this.webgpuUIRenderer = ui;

    this.compositor.registerLayer('ui', {
      texture: ui.getTexture(),
      width: this.canvas.width,
      height: this.canvas.height,
      zIndex: 20
    });

    return ui;
  }
  
  /**
   * Get or initialize WebGL context (lazy initialization)
   */
  private getWebGLContext(): WebGLRenderingContext | null {
    if (!this.webglContext) {
      // Try to get WebGL context from a temporary canvas
      const tempCanvas = document.createElement('canvas');
      this.webglContext = tempCanvas.getContext('webgl') as WebGLRenderingContext | null;
      
      if (!this.webglContext) {
        console.warn('WebGL not available in this browser');
      }
    }
    return this.webglContext;
  }
  
  /**
   * Initialize WebGPU (lazy initialization, async)
   */
  private async initWebGPU(): Promise<boolean> {
    if (this.webgpuDevice) return true;
    
    if (!navigator.gpu) {
      console.warn('WebGPU not available in this browser');
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter available');
        return false;
      }
      
      this.webgpuDevice = await adapter.requestDevice();
      console.log('✓ WebGPU device created for user API');
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }  }

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
          const rect = this.canvas.getBoundingClientRect();
          const charWidth = rect.width / this.width;
          return Math.floor(this.input.getMouseX() / charWidth);
        },
        y: () => {
          const rect = this.canvas.getBoundingClientRect();
          const charHeight = rect.height / this.height;
          return Math.floor(this.input.getMouseY() / charHeight);
        },
        down: (button = 0) => this.input.isMouseDown(button),
        clicked: (button = 0) => this.input.isMouseClicked(button)
      },

      // Retained-mode TUI API
      tui: createTUIAPI(
        // Use the WebGPU terminal renderer when available; otherwise provide a minimal shim
        (this.renderer instanceof WebGPURenderer
          ? this.renderer.getTerminalRenderer()
          : ({
              setCell: (buffer: any[][], x: number, y: number, char: string, fg?: Color, bg?: Color) => {
                if (!buffer?.[y]?.[x]) return;
                const cell = buffer[y][x];
                cell.char = char;
                if (fg !== undefined) cell.fg = fg;
                if (bg !== undefined) cell.bg = bg;
              }
            } as any)),
        () => this.layers.getActive().buffer
      ),
      
      // Theme API
      getStyle: (name: string) => this.getStyle(name),
      theme: this.currentTheme,
      
      // Module API
      modules: {
        load: async (name: string, options?: any) => {
          return await this.moduleLoader.load(name, options);
        },
        loadAll: async (names: string[], options?: any) => {
          return await this.moduleLoader.loadAll(names, options);
        },
        isLoaded: (name: string) => {
          return this.moduleLoader.isLoaded(name);
        },
        isLoading: (name: string) => {
          return this.moduleLoader.isLoading(name);
        },
        get: (name: string) => {
          return this.moduleLoader.get(name);
        },
        unload: async (name: string) => {
          return await this.moduleLoader.unload(name);
        },
        getMetadata: (name: string) => {
          return this.moduleLoader.getMetadata(name);
        },
        on: (event: string, callback: Function) => {
          this.moduleLoader.on(event, callback);
        }
      },
      
      // Global accessors (for convenience)
      get mouseX() {
        const rect = engine.canvas.getBoundingClientRect();
        const charWidth = rect.width / engine.width;
        const pixelX = engine.input.getMouseX();
        return Math.floor(pixelX / charWidth);
      },
      get mouseY() {
        const rect = engine.canvas.getBoundingClientRect();
        const charHeight = rect.height / engine.height;
        const pixelY = engine.input.getMouseY();
        return Math.floor(pixelY / charHeight);
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
      getDelta: () => this.deltaTime,
      
      // === NATIVE BROWSER APIs ===
      
      // Web Audio API (Phase 1) - Full exposure with shared instance
      audio: {
        // === SHARED INSTANCE (Full Web Audio API) ===
        context: this.audioContext,
        
        // === HELPERS (Use same AudioContext) ===
        playTone: (frequency: number, duration: number, volume: number = 0.5) => {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          
          osc.frequency.value = frequency;
          gain.gain.value = volume;
          
          osc.connect(gain);
          gain.connect(this.audioContext.destination);
          
          osc.start();
          osc.stop(this.audioContext.currentTime + duration);
          
          return { osc, gain }; // Return for user control
        },
        
        loadSound: async (url: string): Promise<AudioBuffer> => {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          return await this.audioContext.decodeAudioData(arrayBuffer);
        },
        
        playBuffer: (buffer: AudioBuffer, options: {
          loop?: boolean;
          volume?: number;
          playbackRate?: number;
        } = {}): AudioBufferSourceNode => {
          const source = this.audioContext.createBufferSource();
          const gain = this.audioContext.createGain();
          
          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;
          
          source.connect(gain);
          gain.connect(this.audioContext.destination);
          source.start();
          
          return source; // User can stop/modify
        },
        
        // === RAW API SHORTCUTS (Use same AudioContext) ===
        createOscillator: () => this.audioContext.createOscillator(),
        createGain: () => this.audioContext.createGain(),
        createBiquadFilter: () => this.audioContext.createBiquadFilter(),
        createDelay: () => this.audioContext.createDelay(),
        createConvolver: () => this.audioContext.createConvolver(),
        createDynamicsCompressor: () => this.audioContext.createDynamicsCompressor(),
        createAnalyser: () => this.audioContext.createAnalyser(),
        createBufferSource: () => this.audioContext.createBufferSource(),
        createPanner: () => this.audioContext.createPanner(),
        createStereoPanner: () => this.audioContext.createStereoPanner(),
        createWaveShaper: () => this.audioContext.createWaveShaper(),
        
        // === PROPERTIES ===
        get currentTime() { return engine.audioContext.currentTime; },
        get sampleRate() { return engine.audioContext.sampleRate; },
        get destination() { return engine.audioContext.destination; },
        get state() { return engine.audioContext.state; }
      },
      
      // Canvas 2D API (Phase 2) - Full exposure with shared instance
      canvas2d: {
        // === SHARED INSTANCE ===
        get context() {
          return engine.ensureCanvas2D();
        },
        
        // === HELPERS ===
        clear: (color?: string) => {
          const ctx = engine.ensureCanvas2D();
          const canvas = engine.offscreenCanvas2D;
          if (!ctx || !canvas) return;
          
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        },
        
        drawRect: (x: number, y: number, w: number, h: number, color: string, filled: boolean = true) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          
          if (filled) {
            ctx.fillRect(x, y, w, h);
          } else {
            ctx.strokeRect(x, y, w, h);
          }
        },
        
        drawCircle: (x: number, y: number, radius: number, color: string, filled: boolean = true) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          
          if (filled) {
            ctx.fill();
          } else {
            ctx.stroke();
          }
        },
        
        drawLine: (x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number = 1) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        },
        
        drawImage: (image: HTMLImageElement | ImageBitmap | HTMLCanvasElement, x: number, y: number, w?: number, h?: number) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          if (w !== undefined && h !== undefined) {
            ctx.drawImage(image, x, y, w, h);
          } else {
            ctx.drawImage(image, x, y);
          }
        },
        
        text: (text: string, x: number, y: number, color: string, font: string = '16px sans-serif') => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.font = font;
          ctx.fillText(text, x, y);
        },
        
        loadImage: async (url: string): Promise<HTMLImageElement> => {
          return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        },
        
        // === CONVENIENCE PROPERTIES ===
        get width() {
          engine.ensureCanvas2D();
          return engine.offscreenCanvas2D?.width || 0;
        },
        get height() {
          engine.ensureCanvas2D();
          return engine.offscreenCanvas2D?.height || 0;
        }
      },

      // WebGPU UI API (GPU-native immediate-mode helpers)
      ui: {
        pointer: {
          x: () => engine.input.getMouseX(),
          y: () => engine.input.getMouseY(),
          down: (button: number = 0) => engine.input.isMouseDown(button),
          clicked: (button: number = 0) => engine.input.isMouseClicked(button)
        },
        metrics: {
          get canvasWidth() { return engine.canvas.width; },
          get canvasHeight() { return engine.canvas.height; },
          get charWidth() {
            return engine.renderer instanceof WebGPURenderer
              ? engine.renderer.getAtlas().getCharWidth()
              : 0;
          },
          get charHeight() {
            return engine.renderer instanceof WebGPURenderer
              ? engine.renderer.getAtlas().getCharHeight()
              : 0;
          }
        },
        clear: (color?: Color) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.setClearColor(color);
        },
        rect: (x: number, y: number, w: number, h: number, color: Color) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.rect(x, y, w, h, color);
        },
        text: (text: string, x: number, y: number, color: Color) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.text(text, x, y, color);
        },
        button: (_id: string, x: number, y: number, w: number, h: number, label: string) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return false;

          const mx = engine.input.getMouseX();
          const my = engine.input.getMouseY();
          const hovered = mx >= x && mx < (x + w) && my >= y && my < (y + h);
          const clicked = hovered && engine.input.isMouseClicked(0);

          const base = engine.getStyle('button');
          const border = engine.getStyle('border');
          const fg = base.fg;
          const bg = hovered ? engine.currentTheme.accent1 : base.bg;

          // Background + border
          ui.rect(x, y, w, h, bg);
          ui.rect(x, y, w, 1, border.fg);
          ui.rect(x, y + h - 1, w, 1, border.fg);
          ui.rect(x, y, 1, h, border.fg);
          ui.rect(x + w - 1, y, 1, h, border.fg);

          // Center label (monospace advance)
          const atlas = (engine.renderer instanceof WebGPURenderer) ? engine.renderer.getAtlas() : null;
          const charW = atlas ? atlas.getCharWidth() : 10;
          const charH = atlas ? atlas.getCharHeight() : 16;
          const labelW = label.length * charW;
          const tx = x + Math.max(0, (w - labelW) / 2);
          const ty = y + Math.max(0, (h - charH) / 2);
          ui.text(label, tx, ty, fg);

          return clicked;
        },
        colors: {
          rgb: ColorUtils.rgb,
          rgba: ColorUtils.rgba,
          from: ColorUtils.from
        },
        get available() {
          return engine.renderer instanceof WebGPURenderer;
        }
      },
      
      // WebGL API (Phase 3) - Selective exposure with shared context
      webgl: {
        // === SHARED INSTANCE (lazy init) ===
        get context() { return engine.getWebGLContext(); },
        
        // === HELPERS ===
        createShader: (type: 'vertex' | 'fragment', source: string): WebGLShader | null => {
          const gl = this.getWebGLContext();
          if (!gl) return null;
          
          const shaderType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
          const shader = gl.createShader(shaderType);
          if (!shader) return null;
          
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
          }
          
          return shader;
        },
        
        createProgram: (vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
          const gl = this.getWebGLContext();
          if (!gl) return null;
          
          const program = gl.createProgram();
          if (!program) return null;
          
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
          }
          
          return program;
        },
        
        get available() { return engine.getWebGLContext() !== null; }
      },
      
      // WebGPU API (Phase 4) - Controlled access with safety guardrails
      webgpu: {
        // === CONTROLLED DEVICE ACCESS ===
        get device(): GPUDevice | null {
          return engine.webgpuDevice;
        },
        
        get available(): boolean {
          return engine.webgpuDevice !== null;
        },
        
        // === INITIALIZATION ===
        init: async (): Promise<boolean> => {
          return await engine.initWebGPU();
        },
        
        // === WEBGPU CONSTANTS ===
        // Buffer usage flags
        get GPUBufferUsage() {
          return typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : {
            MAP_READ: 0x0001,
            MAP_WRITE: 0x0002,
            COPY_SRC: 0x0004,
            COPY_DST: 0x0008,
            INDEX: 0x0010,
            VERTEX: 0x0020,
            UNIFORM: 0x0040,
            STORAGE: 0x0080,
            INDIRECT: 0x0100,
            QUERY_RESOLVE: 0x0200
          };
        },
        
        // Texture usage flags
        get GPUTextureUsage() {
          return typeof GPUTextureUsage !== 'undefined' ? GPUTextureUsage : {
            COPY_SRC: 0x01,
            COPY_DST: 0x02,
            TEXTURE_BINDING: 0x04,
            STORAGE_BINDING: 0x08,
            RENDER_ATTACHMENT: 0x10
          };
        },
        
        // Shader stage flags
        get GPUShaderStage() {
          return typeof GPUShaderStage !== 'undefined' ? GPUShaderStage : {
            VERTEX: 0x1,
            FRAGMENT: 0x2,
            COMPUTE: 0x4
          };
        },
        
        // === SAFE HELPERS WITH GUARDRAILS ===
        createBuffer: (size: number, usage: GPUBufferUsageFlags): GPUBuffer | null => {
          if (!engine.webgpuDevice) return null;
          
          // Enforce size limits to prevent memory exhaustion
          const MAX_BUFFER_SIZE = 256 * 1024 * 1024; // 256MB
          if (size > MAX_BUFFER_SIZE) {
            console.error('Buffer size exceeds maximum allowed:', MAX_BUFFER_SIZE);
            return null;
          }
          
          return engine.webgpuDevice.createBuffer({ size, usage });
        },
        
        createShaderModule: (code: string): GPUShaderModule | null => {
          if (!engine.webgpuDevice) return null;
          return engine.webgpuDevice.createShaderModule({ code });
        },
        
        createTexture: (width: number, height: number, format: GPUTextureFormat = 'rgba8unorm'): GPUTexture | null => {
          if (!engine.webgpuDevice) return null;
          
          // Enforce texture size limits
          const MAX_DIMENSION = 8192;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            console.error('Texture dimensions exceed maximum:', MAX_DIMENSION);
            return null;
          }
          
          return engine.webgpuDevice.createTexture({
            size: { width, height },
            format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
          });
        }
      },
      
      // Compositor API (Phase 1: Auto-compositing, future: manual mode)
      compositor: {
        // Current mode
        get mode(): 'auto' | 'manual' {
          return engine.compositor?.mode || 'auto';
        },
        
        // Set compositing mode
        setMode: (mode: 'auto' | 'manual') => {
          if (engine.compositor) {
            engine.compositor.setMode(mode);
          } else {
            console.warn('Compositor not available (WebGPU not initialized)');
          }
        },
        
        // Get layer configuration
        get layers() {
          if (!engine.compositor) return {};
          const layersObj: any = {};
          engine.compositor.layers.forEach((layer, name) => {
            layersObj[name] = {
              opacity: layer.opacity,
              blendMode: layer.blendMode,
              enabled: layer.enabled,
              zIndex: layer.zIndex
            };
          });
          return layersObj;
        },
        
        // Manual compositing methods (for future Phase 2)
        clear: (color?: string) => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            engine.compositor.clear(color);
          }
        },
        
        blit: (layerName: string, options?: any) => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            const layer = engine.compositor.layers.get(layerName);
            if (layer) {
              engine.compositor.blit(layer, options);
            }
          }
        },
        
        present: () => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            engine.compositor.present();
          }
        },
        
        // Phase 3: Custom Contexts
        createContext: (name: string, options: {
          type: 'canvas2d' | 'webgl' | 'webgl2';
          width: number;
          height: number;
          alpha?: boolean;
          antialias?: boolean;
          zIndex?: number;
        }) => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return null;
          }
          return engine.compositor.createContext(name, options);
        },
        
        removeLayer: (name: string): boolean => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return false;
          }
          return engine.compositor.removeLayer(name);
        },
        
        // Phase 5: Shader Pipeline
        loadEffect: async (name: string, url: string): Promise<void> => {
          if (!engine.compositor) {
            throw new Error('Compositor not available (WebGPU not initialized)');
          }
          await engine.compositor.loadEffect(name, url);
        },
        
        buildPipeline: async (effects: string[]): Promise<void> => {
          if (!engine.compositor) {
            throw new Error('Compositor not available (WebGPU not initialized)');
          }
          await engine.compositor.buildPipeline(effects);
        },
        
        setPipelineEnabled: (enabled: boolean): void => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return;
          }
          engine.compositor.setPipelineEnabled(enabled);
        },
        
        setEffectUniform: (effectName: string, uniformName: string, value: number | number[]): void => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return;
          }
          engine.compositor.setEffectUniform(effectName, uniformName, value);
        },
        
        getEffects: (): string[] => {
          if (!engine.compositor) {
            return [];
          }
          return engine.compositor.getEffects();
        },
        
        hasEffect: (name: string): boolean => {
          if (!engine.compositor) {
            return false;
          }
          return engine.compositor.hasEffect(name);
        },

        // Check if compositor is available
        get available(): boolean {
          return engine.compositor !== null;
        }
      }
    };
  }

  /**
   * Load a markdown document and execute its code with lifecycle hooks
   */
  async loadMarkdown(documentId: string, markdown: string): Promise<boolean> {
    try {
      console.log(`Loading document: ${documentId}`);
      
      // Parse markdown
      const parsed = parseMarkdown(markdown);
      console.log(`  Found ${parsed.sections.length} sections`);
      console.log(`  Found ${parsed.codeBlocks.length} code blocks`);
      
      // Load modules from frontmatter if specified
      if (parsed.metadata.modules) {
        const modules = Array.isArray(parsed.metadata.modules) 
          ? parsed.metadata.modules 
          : [parsed.metadata.modules];
        
        console.log(`  Loading ${modules.length} module(s):`, modules);
        
        try {
          await this.moduleLoader.loadAll(modules);
          console.log(`  ✓ All modules loaded successfully`);
        } catch (error) {
          console.error(`  ✗ Failed to load modules:`, error);
          // Continue anyway - modules are optional
        }
      }
      
      // Apply theme from frontmatter if specified
      if (parsed.metadata.theme) {
        const themeName = String(parsed.metadata.theme).toLowerCase().replace(/['"]/g, '');
        this.currentTheme = getTheme(themeName);
        this.styleSheet = applyTheme(this.currentTheme);
        console.log(`  Theme: ${themeName}`);
      }
      
      // Log exposed frontmatter variables (for debugging)
      const frontmatterKeys = Object.keys(parsed.metadata);
      if (frontmatterKeys.length > 0) {
        console.log(`  Exposed ${frontmatterKeys.length} frontmatter variable(s) as globals:`, frontmatterKeys.join(', '));
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
        // Some scope keys may come from direct `scope.foo = ...` assignments rather than
        // real JS bindings. Exporting those would throw (ReferenceError: foo is not defined).
        // Wrap in try/catch to only export when a binding exists.
        const exports = scopeVarNames.map(k => `  try { scope.${k} = ${k}; } catch (e) {}` ).join('\n');
        
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
      console.log(`  Scope values:`, scopeVarNames.map(k => `${k}=${JSON.stringify(currentScope[k])}`).join(', '));
      
      // Check if handlers were directly defined as functions
      const hasInit = typeof currentScope.init === 'function';
      const hasUpdate = typeof currentScope.update === 'function';
      const hasRender = typeof currentScope.render === 'function';
      const hasInput = typeof currentScope.input === 'function';
      
      // Build import/export statements for handlers
      // Import scope variables at handler start, export them back at handler end
      const importVars = scopeVarNames.length > 0 
        ? `  let {${scopeVarNames.join(', ')}} = scope;` 
        : '';
      // Capture original scope values BEFORE user code runs, then export back at end
      // Only export if scope value hasn't been directly modified (via scope.foo = ...)
      const captureVars = scopeVarNames.length > 0
        ? `  const __scopeBefore = {${scopeVarNames.map(k => `${k}: scope.${k}`).join(', ')}};`
        : '';
      const exportVars = scopeVarNames.length > 0
        ? scopeVarNames
            .map(k => `  if (scope.${k} === __scopeBefore.${k}) { scope.${k} = ${k}; }`)
            .join('\n')
        : '';
      
      // Only create handlers from on:init/update/render blocks if not already defined
      if (!hasInit && initBlocks.length > 0) {
        console.log(`  Creating init handler from ${initBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const initCode = `scope.init = function() {
${importVars}
${captureVars}
${initBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, initCode, true);
      }
      
      if (!hasUpdate && updateBlocks.length > 0) {
        console.log(`  Creating update handler from ${updateBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const updateCode = `scope.update = function(delta) {
${importVars}
${captureVars}
${updateBlocks.join('\n\n')}
${exportVars}
};`;
        console.log(`  Generated update wrapper (first 500 chars):`, updateCode.substring(0, 500));
        this.sandbox.executeCodeBlock(documentId, updateCode, true);
      }
      
      if (!hasRender && renderBlocks.length > 0) {
        console.log(`  Creating render handler from ${renderBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const renderCode = `scope.render = function() {
${importVars}
${captureVars}
${renderBlocks.join('\n\n')}
${exportVars}
};`;
        console.log('🔍 Generated render handler (first 300 chars):', renderCode.substring(0, 300));
        this.sandbox.executeCodeBlock(documentId, renderCode, true);
        
        // Verify it was created
        const verifyScope = this.sandbox.getScope(documentId);
        console.log('🔍 After execution, scope.render type:', typeof verifyScope?.render);
      }
      
      if (!hasInput && inputBlocks.length > 0) {
        console.log(`  Creating input handler from ${inputBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const inputCode = `scope.input = function(event) {
${importVars}
${captureVars}
${inputBlocks.join('\n\n')}
${exportVars}
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
      console.log('🔍 Extracted handlers:', {
        init: typeof handlers?.init,
        update: typeof handlers?.update,
        render: typeof handlers?.render,
        input: typeof handlers?.input
      });
      
      
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
      } else if (this.renderer instanceof WebGPURenderer) {
        // WebGPU initialized successfully - set up compositor
        await this.initCompositor();

        // Eagerly create the UI layer once WebGPU + compositor are ready.
        // This avoids a class of issues where demo code calls ui.* but the
        // layer isn't registered due to timing/guardrails.
        this.ensureWebGPUUI();
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

    try {
      // Calculate delta time
      this.deltaTime = (timestamp - this.lastFrameTime) / 1000;
      this.lastFrameTime = timestamp;
      this.elapsedTime += this.deltaTime;

      // (Optional) reserved for future one-time perf/health logs.

      // Update phase
      this.update();

      // Render phase
      this.render();

      // Composite and present
      if (this.compositor) {
        // WebGPU path: terminal renders to texture, compositor blits it + canvas2d
        const composited = this.layers.composite();
        this.renderer.render(composited);  // Render terminal to offscreen texture

        // Render GPU UI into its own texture (if created)
        if (this.webgpuUIRenderer) {
          this.webgpuUIRenderer.flush();
        }

        // Only auto-composite in auto mode. In manual mode, user code controls
        // clear/blit/present inside the document render handler.
        if (this.compositor.mode === 'auto') {
          this.compositor.autoComposite();   // Composite all layers to main canvas
        }
      } else {
        // Canvas2D fallback: render directly
        const composited = this.layers.composite();
        this.renderer.render(composited);
      }
    } catch (error) {
      console.error('[Engine] Uncaught error in mainLoop:', error);
    }

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
    // Update modules first
    this.moduleLoader.update(this.deltaTime);
    
    // Then update user code
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
    
    if (!doc) {
      if (this.frameCount < 3) console.log('🎨 No active document');
      return;
    }
    
    if (!doc.handlers) {
      if (this.frameCount < 3) console.log('🎨 No handlers object');
      return;
    }
    
    if (!doc.handlers.render) {
      if (this.frameCount < 3) console.log('🎨 No render handler');
      return;
    }
    
    try {
      doc.handlers.render();
    } catch (error) {
      console.error('Error in render handler:', error);
    }
    
    // Render modules last (so they can overlay)
    this.moduleLoader.render();
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
    
    // Update compositor if WebGPU is enabled
    if (this.compositor && this.renderer instanceof WebGPURenderer) {
      // Resize compositor (updates canvas and context)
      this.compositor.resize(this.canvas.width, this.canvas.height);
      
      // Update terminal layer texture reference (renderer creates new texture on resize)
      const terminalTexture = this.renderer.getRenderTexture();
      if (terminalTexture) {
        this.compositor.updateLayerTexture('terminal', terminalTexture);
      }

      // Resize UI texture if present
      if (this.webgpuUIRenderer) {
        this.webgpuUIRenderer.resize(this.canvas.width, this.canvas.height);
        this.compositor.updateLayerTexture('ui', this.webgpuUIRenderer.getTexture());
      }
    }
  }

  /**
   * Get a named style from the current theme
   */
  private getStyle(name: string): NamedStyle {
    if (!this.styleSheet) {
      console.warn('StyleSheet not initialized, using default colors');
      return {
        fg: 0xFFFFFFFF,
        bg: 0x000000FF
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
    console.log('⌨️ Key event:', action, e.key, `(code: ${e.keyCode})`);
    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) {
      console.log('   No input handler defined');
      return;
    }

    // Build modifiers array
    const mods: string[] = [];
    if (e.shiftKey) mods.push('shift');
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.metaKey) mods.push('meta');

    // Dispatch keydown/keyup events (TStorie convention)
    const event: InputEvent = {
      type: action === 'press' ? 'keydown' : 'keyup',
      key: e.key,
      keyCode: e.keyCode,
      mods
    };

    try {
      const shouldContinue = doc.handlers.input(event);
      // Only stop if handler explicitly returns false (undefined = continue)
      if (shouldContinue === false) {
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
      // Only stop if handler explicitly returns false (undefined = continue)
      if (shouldContinue === false) {
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
    const charWidth = rect.width / this.width;
    const charHeight = rect.height / this.height;
    const x = Math.floor((e.clientX - rect.left) / charWidth);
    const y = Math.floor((e.clientY - rect.top) / charHeight);

    const event: InputEvent = {
      type: 'mouse_move',
      x,
      y,
      mods: []
    };

    try {
      const shouldContinue = doc.handlers.input(event);
      // Only stop if handler explicitly returns false (undefined = continue)
      if (shouldContinue === false) {
        this.stop();
      }
    } catch (error) {
      console.error('Error in input handler:', error);
    }
  }
  
  /**
   * Dispose of engine resources
   */
  dispose(): void {
    console.log('Disposing engine resources');
    this.stop();
    this.moduleLoader.dispose();
    this.documents.clear();
    this.activeDocumentId = null;
    
    // Clean up native API resources
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.warn('Error closing AudioContext:', err);
      });
    }
    
    // Remove Canvas 2D overlay from DOM
    if (this.offscreenCanvas2D && this.offscreenCanvas2D.parentElement) {
      this.offscreenCanvas2D.parentElement.removeChild(this.offscreenCanvas2D);
    }
  }
  
  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  /**
   * Get the WebGPU device (if using WebGPU renderer)
   * For module sharing
   */
  getWebGPUDevice(): GPUDevice | null {
    if (this.renderer instanceof WebGPURenderer && 'getDevice' in this.renderer) {
      return (this.renderer as any).getDevice() || null;
    }
    return null;
  }
  
  /**
   * Get module loader for advanced use
   */
  getModuleLoader(): ModuleLoader {
    return this.moduleLoader;
  }
}
