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
import { parseMarkdown, flattenSections } from './markdown.js';
import { getTheme, applyTheme } from './themes.js';
import { ModuleLoader } from './modules/loader.js';
import { createTUIAPI } from './tui-api.js';
import { createGUIAPI } from './gui-api.js';
import { WebGPUUIRenderer } from './ui/webgpu-ui-renderer.js';
import { parseMarkdownLite } from './ui/document/markdown-lite.js';
import { layoutMarkdownDocument } from './ui/document/layout.js';
import type { LinkRegion, MarkdownStyle } from './ui/document/types.js';
import { ShaderManager } from './shader-manager.js';
import { ShaderChainManager } from './shader-chain.js';
import { Canvas3DRenderer } from './canvas3d-renderer.js';
import { parseFIGfont, renderFigletCharLines, renderFigletLines, measureFigletLinesWidth, type FigletFont } from './figlet.js';
import { parseAnsiToRuns, type AnsiParsed, type AnsiRun } from './ansi.js';
import {
  createCamera3D,
  updateCamera3D,
  createSection3DLayouts,
  getDefaultCanvas3DConfig,
  focusOnSection,
  focusOnSectionFit,
  getCameraViewMatrix,
  getCameraProjectionMatrix,
  mat4Multiply,
  mat4Invert,
  mat4FromTransform,
  mat4TransformVec4,
  mat4TransformPoint,
  mat4TransformDirection,
  vec3Normalize,
  vec3Sub,
  vec3Add,
  vec3Scale,
  vec3Length,
  type Camera3D,
  type Section3DLayout,
  type Canvas3DConfig
} from './canvas3d.js';
import type { ModuleResolverConfig } from './modules/types.js';
import type { UserScript, Color, InputEvent, ThemeColors, ThemeStyleSheet, NamedStyle, DroppedFile } from './types.js';
import { detectPeaksFromAudioBuffer, type PeakDetectionOptions, type PeakDetectionResult } from './audio/peaks.js';
import { analyzeBeatsFromAudioBuffer, getBeatState, type BeatAnalysisResult, type BeatDetectionOptions, type BeatState } from './audio/beats.js';
import { KEY } from './types.js';
import { ColorUtils } from './types.js';
import type { SandboxAPI } from './sandbox.js';
import { getSfxPresetNames, playSfx, sfxSnippet, toSfxSeed } from './audio/sfx.js';
import { bakeSfxGraphBuffer, parseStfxrDefinitionJson, playSfxGraph, type SfxGraphPreset } from './audio/sfx-graph.js';
import { SFX_PRESETS, type SfxPresetName } from './audio/sfx-presets.js';

export interface EngineConfig {
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  preferWebGPU?: boolean; // Default true
  /**
   * Maximum number of bytes allowed for a single dropped file.
   * Default: 50MB. Set <= 0 to disable the limit.
   */
  maxDropBytes?: number;
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
  private api!: SandboxAPI;  // User API (initialized in constructor)
  
  // Native browser APIs (shared instances)
  private audioContext: AudioContext;
  private canvas2DContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private offscreenCanvas2D: HTMLCanvasElement | null = null;
  private webglContext: WebGLRenderingContext | null = null;
  private webgpuDevice: GPUDevice | null = null;

  // WebGPU UI (optional)
  private webgpuUIRenderer: WebGPUUIRenderer | null = null;
  private sectionWebGPUUIRenderer: WebGPUUIRenderer | null = null;
  
  // WebGPU shader management
  private shaderManager: ShaderManager | null = null;
  private shaderChainManager: ShaderChainManager | null = null;

  // Cache the last terminal cellSize pushed to shaders to avoid redundant updates.
  private lastShaderCellSize: { w: number; h: number } | null = null;
  
  // Deferred shader chain (applied after WebGPU init)
  private pendingShaderChain: { chainStr: string; source: string } | null = null;
  
  // 3D Canvas system
  private canvas3DRenderer: Canvas3DRenderer | null = null;
  private camera3D: Camera3D | null = null;
  private section3DLayouts: Section3DLayout[] = [];

  private pending3DCameraFocus:
    | { kind: 'focus'; sectionIndex: number | string; distance: number }
    | { kind: 'fit'; sectionIndex: number | string; fill: number }
    | null = null;

  // Last focus request that was actually applied (used to re-frame on resize).
  private lastApplied3DCameraFocus:
    | { kind: 'focus'; sectionIndex: number; distance: number }
    | { kind: 'fit'; sectionIndex: number; fill: number }
    | null = null;
  private canvas3DConfig: Canvas3DConfig = getDefaultCanvas3DConfig();
  private canvas3DEnabled: boolean = false;

  private canvas3DLayoutCallback: ((args: {
    sectionIndex: number;
    title: string;
    layout: Section3DLayout;
  }) =>
    | {
        position?: { x: number; y: number; z: number };
        rotation?: { x: number; y: number; z: number }; // degrees
        scale?: { x: number; y: number; z: number };
        width?: number;
        height?: number;
        visible?: boolean;
        navigable?: boolean;
      }
    | void) | null = null;

  // 3D interaction state (hover + basic navigation controls)
  private canvas3DControlsEnabled: boolean = false;
  private mouseLookActive: boolean = false;
  private mouseLookLastX: number = 0;
  private mouseLookLastY: number = 0;

  // 3D link-centric interaction (canvas.nim parity)
  private hovered3DLink: { sectionIndex: number; linkIndex: number } | null = null;
  private focused3DLink: { sectionIndex: number; linkIndex: number } | null = null;
  private current3DSectionIndex: number | null = null;

  // 3D section texture rasterization cache
  private sectionTextureCache: Map<number, { width: number; height: number }> = new Map();
  private sectionLinkRegionsCache: Map<number, LinkRegion[]> = new Map();
  
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

  // Dropped-file handling (binary-safe)
  private lastDroppedFile: DroppedFile | null = null;
  private dropHandlingCleanup: (() => void) | null = null;

  // True only while dispatching a real DOM input event into the active document handler.
  // Used to gate sensitive operations (e.g., clipboard) so sandbox code cannot trigger them
  // outside a trusted user gesture.
  private inputDispatchDepth: number = 0;
  private maxDropBytes: number = 50 * 1024 * 1024;
  
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

    const configuredMaxDropBytes = typeof config.maxDropBytes === 'number' ? config.maxDropBytes : 50 * 1024 * 1024;
    this.maxDropBytes = configuredMaxDropBytes > 0 ? configuredMaxDropBytes : Infinity;

    // Camera state should exist even before WebGPU initializes so user code can
    // configure it during on:init without worrying about timing.
    this.camera3D = createCamera3D();
    
    // Initialize theme system
    this.currentTheme = getTheme('neotopia');
    this.styleSheet = applyTheme(this.currentTheme);
    
    // Initialize native browser APIs (shared instances)
    this.audioContext = new AudioContext();
    // Canvas2D is created lazily on first use (see ensureCanvas2D())
    
    // Initialize systems
    this.layers = new LayerStack(this.width, this.height);
    // Ensure the default terminal buffers start with the theme background (not hard-coded black).
    this.layers.clearAll(this.currentTheme.bg);
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
    this.api = api;  // Store api for later use

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
    
    // Register terminal layer (from WebGPU renderer).
    // IMPORTANT: WebGPURenderer may create its render texture lazily (e.g. on first render()).
    // If we only register the layer when the texture exists, the compositor may end up with
    // *no* terminal layer and thus render a blank screen.
    const terminalTexture = this.renderer.getRenderTexture();
    this.compositor.registerLayer('terminal', {
      texture: terminalTexture ?? undefined,
      width: this.canvas.width,
      height: this.canvas.height,
      zIndex: 0  // Terminal at back
    });
    if (!terminalTexture) {
      console.warn('[Compositor] Terminal render texture not ready yet; will attach on first render/resize');
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
      
      // Initialize shader manager
      this.shaderManager = new ShaderManager(this.webgpuDevice);
      console.log('✓ ShaderManager initialized');
      
      // Initialize shader chain manager
      this.shaderChainManager = new ShaderChainManager(this.shaderManager, this.webgpuDevice);
      console.log('✓ ShaderChainManager initialized');
      
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
    let nextUIImageId = 1;

    const MAX_BLOB_BYTES = 8 * 1024 * 1024;

    const getBlobStore = (documentId?: string): Map<string, { name: string; mime: string; encoding: 'base64' | 'hex'; data: string; bytes?: Uint8Array }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._blobStore) ? (doc._blobStore as Map<string, any>) : null;
    };

    const getAsciiStore = (documentId?: string): Map<string, { name: string; text: string; lines?: string[] }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._asciiStore) ? (doc._asciiStore as Map<string, any>) : null;
    };

    const getFigletStore = (documentId?: string): Map<string, { name: string; text: string; font?: FigletFont }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._figletStore) ? (doc._figletStore as Map<string, any>) : null;
    };

    const getAnsiStore = (documentId?: string): Map<string, { name: string; text: string; tabSize: number; parsed?: AnsiParsed }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._ansiStore) ? (doc._ansiStore as Map<string, any>) : null;
    };

    const getStfxrStore = (documentId?: string): Map<string, { name: string; preset: SfxGraphPreset; defaultSeed?: number | string }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._stfxrStore) ? (doc._stfxrStore as Map<string, any>) : null;
    };

    type StfxrBakedEntry = {
      id: string;
      name: string;
      seed: number;
      sampleRate: number;
      seconds: number;
      buffer: AudioBuffer;
      bytes: number;
      createdAt: number;
    };

    const MAX_STFXR_BAKED_BYTES = 16 * 1024 * 1024; // per document (roughly)

    const estimateAudioBufferBytes = (buffer: AudioBuffer): number => {
      const frames = buffer.length;
      const channels = buffer.numberOfChannels;
      return Math.max(0, frames * channels * 4);
    };

    const getStfxrBakedStore = (documentId?: string): Map<string, StfxrBakedEntry> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;
      if (!doc._stfxrBakedStore) doc._stfxrBakedStore = new Map();
      return doc._stfxrBakedStore as Map<string, StfxrBakedEntry>;
    };

    const evictStfxrBakedIfNeeded = (store: Map<string, StfxrBakedEntry>) => {
      let total = 0;
      for (const e of store.values()) total += e.bytes;
      if (total <= MAX_STFXR_BAKED_BYTES) return;
      // Evict oldest insertions first.
      while (total > MAX_STFXR_BAKED_BYTES && store.size > 1) {
        const oldestKey = store.keys().next().value as string;
        const oldest = store.get(oldestKey);
        store.delete(oldestKey);
        if (oldest) total -= oldest.bytes;
      }
    };

    const clonePreset = (preset: SfxGraphPreset): SfxGraphPreset => {
      try {
        // @ts-ignore - structuredClone exists in modern browsers.
        if (typeof structuredClone === 'function') return structuredClone(preset);
      } catch {
        // ignore
      }
      return JSON.parse(JSON.stringify(preset)) as SfxGraphPreset;
    };

    const estimateBase64Bytes = (b64: string): number => {
      const s = b64.replace(/\s+/g, '');
      const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
      return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
    };

    const normalizeHex = (hex: string): string => {
      // Keep only hex digits; tolerate whitespace, commas, underscores, 0x prefixes, etc.
      // This makes it safe to paste formatted/column-wrapped hex dumps.
      return hex
        .replace(/0x/gi, '')
        .replace(/[^0-9a-f]/gi, '')
        .trim();
    };

    const estimateHexBytes = (hex: string): number => {
      const s = normalizeHex(hex);
      return Math.floor(s.length / 2);
    };

    const decodeBase64ToBytes = (b64: string): Uint8Array | undefined => {
      const clean = b64.replace(/\s+/g, '');
      const est = estimateBase64Bytes(clean);
      if (est <= 0) return new Uint8Array(0);
      if (est > MAX_BLOB_BYTES) {
        console.warn(`[blob] Refusing to decode blob larger than ${MAX_BLOB_BYTES} bytes (estimated ${est}).`);
        return undefined;
      }
      try {
        const bin = atob(clean);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xFF;
        return out;
      } catch (e) {
        console.warn('[blob] Base64 decode failed:', e);
        return undefined;
      }
    };

    const decodeHexToBytes = (hex: string): Uint8Array | undefined => {
      const clean = normalizeHex(hex);
      if (clean.length === 0) return new Uint8Array(0);
      if (clean.length % 2 !== 0) {
        console.warn('[blob] Hex decode failed: odd-length hex string');
        return undefined;
      }

      const est = estimateHexBytes(clean);
      if (est > MAX_BLOB_BYTES) {
        console.warn(`[blob] Refusing to decode blob larger than ${MAX_BLOB_BYTES} bytes (estimated ${est}).`);
        return undefined;
      }

      const out = new Uint8Array(est);
      for (let i = 0; i < est; i++) {
        const byteStr = clean.slice(i * 2, i * 2 + 2);
        const v = Number.parseInt(byteStr, 16);
        if (!Number.isFinite(v) || Number.isNaN(v)) {
          console.warn('[blob] Hex decode failed: invalid byte');
          return undefined;
        }
        out[i] = v & 0xFF;
      }
      return out;
    };

    const estimateBlobBytes = (entry: { encoding: 'base64' | 'hex'; data: string }): number => {
      return entry.encoding === 'hex' ? estimateHexBytes(entry.data) : estimateBase64Bytes(entry.data);
    };

    const decodeBlobToBytes = (entry: { encoding: 'base64' | 'hex'; data: string }): Uint8Array | undefined => {
      return entry.encoding === 'hex' ? decodeHexToBytes(entry.data) : decodeBase64ToBytes(entry.data);
    };

    type UIBlobAudioCache = {
      resolved: Map<string, AudioBuffer>;
      inFlight: Map<string, Promise<AudioBuffer | null>>;
      failed: Set<string>;
    };

    const getUIBlobAudioCache = (documentId?: string): UIBlobAudioCache | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;

      if (!doc._uiBlobAudioCache) {
        doc._uiBlobAudioCache = {
          resolved: new Map<string, AudioBuffer>(),
          inFlight: new Map<string, Promise<AudioBuffer | null>>(),
          failed: new Set<string>()
        } satisfies UIBlobAudioCache;
      }
      return doc._uiBlobAudioCache as UIBlobAudioCache;
    };

    const toExactArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
      // Important: .buffer may include extra bytes (or be a SharedArrayBuffer); copy to a fresh ArrayBuffer.
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      return ab;
    };

    const loadAudioFromBlobInternal = async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
      const store = getBlobStore(documentId);
      if (!store) return null;
      const entry = store.get(String(name));
      if (!entry) return null;

      if (!entry.bytes) {
        entry.bytes = decodeBlobToBytes(entry);
      }
      if (!entry.bytes) return null;

      const mime = String(entry.mime ?? '');
      if (mime && !mime.startsWith('audio/')) {
        // Not a hard error: decodeAudioData sniffs content in most browsers.
        console.warn(`[audio.loadSoundFromBlob] Blob "${String(name)}" has non-audio mime "${mime}"; attempting decode anyway.`);
      }

      try {
        const ab = toExactArrayBuffer(entry.bytes);
        return await engine.audioContext.decodeAudioData(ab);
      } catch (e) {
        console.warn(`[audio.loadSoundFromBlob] Failed to decode audio blob "${String(name)}":`, e);
        return null;
      }
    };

    const loadSoundFromBlobCached = async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
      const key = String(name ?? '');
      if (!key) return null;

      const cache = getUIBlobAudioCache(documentId);
      if (!cache) return await loadAudioFromBlobInternal(key, documentId);

      const resolved = cache.resolved.get(key);
      if (resolved) return resolved;
      if (cache.failed.has(key)) return null;
      const inFlight = cache.inFlight.get(key);
      if (inFlight) return await inFlight;

      const promise = loadAudioFromBlobInternal(key, documentId)
        .then((buf) => {
          cache.inFlight.delete(key);
          if (buf) {
            cache.resolved.set(key, buf);
          } else {
            cache.failed.add(key);
          }
          return buf;
        })
        .catch((_e) => {
          cache.inFlight.delete(key);
          cache.failed.add(key);
          return null;
        });

      cache.inFlight.set(key, promise);
      return await promise;
    };

    type UIBlobImageCache = {
      resolved: Map<string, string>;
      inFlight: Map<string, Promise<string | null>>;
      failed: Set<string>;
    };

    const getUIBlobImageCache = (documentId?: string): UIBlobImageCache | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;

      if (!doc._uiBlobImageCache) {
        doc._uiBlobImageCache = {
          resolved: new Map<string, string>(),
          inFlight: new Map<string, Promise<string | null>>(),
          failed: new Set<string>()
        } satisfies UIBlobImageCache;
      }
      return doc._uiBlobImageCache as UIBlobImageCache;
    };

    const loadImageFromBlobInternal = async (name: string, documentId?: string): Promise<string | null> => {
      const ui = engine.ensureWebGPUUI();
      if (!ui) return null;

      const store = getBlobStore(documentId);
      if (!store) return null;
      const entry = store.get(String(name));
      if (!entry) return null;

      if (!entry.bytes) {
        entry.bytes = decodeBlobToBytes(entry);
      }
      if (!entry.bytes) return null;

      const mime = entry.mime || 'application/octet-stream';
      const bytes = new Uint8Array(entry.bytes);
      const blob = new Blob([bytes], { type: mime });
      let bitmap: ImageBitmap | null = null;
      try {
        bitmap = await createImageBitmap(blob);
        const id = `img_${nextUIImageId++}`;
        ui.registerImage(id, bitmap);
        return id;
      } catch (e) {
        console.warn(`[ui.loadImageFromBlob] Failed to decode image "${String(name)}":`, e);
        return null;
      } finally {
        try { bitmap?.close(); } catch { /* ignore */ }
      }
    };
    
    return {
      // Terminal text API
      term: {
        write: (x: number, y: number, text: string, fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.write(x, y, text, fg, bg);
        },
        clear: (bgColor?: Color) => {
          const layer = this.layers.getActive();
          layer.clear(bgColor ?? this.currentTheme.bg);
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

      // Dropped file API (binary-safe; populated by engine.installDropHandling())
      drop: {
        has: () => !!engine.lastDroppedFile,
        name: () => engine.lastDroppedFile?.name ?? '',
        size: () => engine.lastDroppedFile?.size ?? 0,
        mime: () => engine.lastDroppedFile?.mime ?? '',
        bytes: () => engine.lastDroppedFile?.bytes ?? null,
        text: (encoding: string = 'utf-8') => {
          const bytes = engine.lastDroppedFile?.bytes;
          if (!bytes) return null;
          try {
            const decoder = new TextDecoder(encoding);
            return decoder.decode(bytes);
          } catch (e) {
            console.warn('[drop] Text decode failed:', e);
            return null;
          }
        }
      },

      // Document metadata API (read-only)
      // Section indices match Canvas3D's depth-first layout order.
      doc: {
        sectionsFlat: () => {
          const d = engine.getActiveDocument();
          if (!d) return [] as Array<{ index: number; title: string; level: number }>;
          const flat = flattenSections(d.sections);
          return flat.map((s, index) => ({ index, title: s.title, level: s.level }));
        },
        sectionCount: () => {
          const d = engine.getActiveDocument();
          if (!d) return 0;
          return flattenSections(d.sections).length;
        }
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
        () => this.layers.getActive().buffer,
        (name: string) => this.getStyle(name),
        () => this.inputDispatchDepth > 0
      ),
      
      // Retained-mode GUI API
      gui: createGUIAPI(
        () => {
          const atlas = (this.renderer instanceof WebGPURenderer) ? this.renderer.getAtlas() : null;
          return {
            charWidth: atlas?.getCharWidth() ?? 10,
            charHeight: atlas?.getCharHeight() ?? 16
          };
        },
        () => this.inputDispatchDepth > 0
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

      // Embedded binary blobs (from ```blob blocks)
      blob: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getBlobStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const key = String(name);
              const entry = store.get(key);
              if (!entry) return null;
              return {
                name: entry.name,
                mime: entry.mime,
                encoding: entry.encoding,
                data: entry.data,
                byteLength: estimateBlobBytes(entry)
              };
            },
            base64: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return entry.encoding === 'base64' ? entry.data : null;
            },
            hex: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return entry.encoding === 'hex' ? entry.data : null;
            },
            bytes: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.bytes) {
                entry.bytes = decodeBlobToBytes(entry);
              }
              return entry.bytes ?? null;
            },
            text: (name: string, encoding: string = 'utf-8') => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.bytes) {
                entry.bytes = decodeBlobToBytes(entry);
              }
              if (!entry.bytes) return null;
              try {
                const decoder = new TextDecoder(encoding);
                return decoder.decode(entry.bytes);
              } catch (e) {
                console.warn('[blob] Text decode failed:', e);
                return null;
              }
            }
          };
        },
        list: () => {
          const store = getBlobStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getBlobStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const key = String(name);
          const entry = store.get(key);
          if (!entry) return null;
          return {
            name: entry.name,
            mime: entry.mime,
            encoding: entry.encoding,
            data: entry.data,
            byteLength: estimateBlobBytes(entry)
          };
        },
        base64: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return entry.encoding === 'base64' ? entry.data : null;
        },
        hex: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return entry.encoding === 'hex' ? entry.data : null;
        },
        bytes: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.bytes) {
            entry.bytes = decodeBlobToBytes(entry);
          }
              return entry.bytes ?? null;
        },
        text: (name: string, encoding: string = 'utf-8') => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.bytes) {
            entry.bytes = decodeBlobToBytes(entry);
          }
          if (!entry.bytes) return null;
          try {
            const decoder = new TextDecoder(encoding);
            return decoder.decode(entry.bytes);
          } catch (e) {
            console.warn('[blob] Text decode failed:', e);
            return null;
          }
        }
      },

      // Embedded ASCII art blocks (from ```ascii name:...)
      ascii: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getAsciiStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              const text = String(entry.text ?? '');
              const lines = Array.isArray(entry.lines) ? entry.lines : text.split(/\r?\n/);
              return { name: entry.name, text, lines };
            },
            text: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            lines: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);
              return entry.lines;
            }
          };
        },
        list: () => {
          const store = getAsciiStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getAsciiStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          const text = String(entry.text ?? '');
          const lines = Array.isArray(entry.lines) ? entry.lines : text.split(/\r?\n/);
          return { name: entry.name, text, lines };
        },
        text: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        lines: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);
          return entry.lines;
        }
      },

      // Seeded SFX graph presets embedded in markdown (from ```stfxr name:... seed:...)
      stfxr: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getStfxrStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStfxrStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getStfxrStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return clonePreset(entry.preset);
            },
            play: (
              name: string,
              seed?: number | string,
              options?: { volume?: number; when?: number }
            ) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              if (!entry) return { stop: () => {} };
              engine.audioContext.resume().catch(() => {});
              const resolvedSeed = toSfxSeed(seed ?? entry.defaultSeed);
              return playSfxGraph(engine.audioContext, entry.preset, resolvedSeed, options);
            },
            bake: async (
              name: string,
              seed?: number | string,
              options?: { id?: string; seconds?: number; maxSeconds?: number }
            ) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              if (!entry) return '';
              const resolvedSeed = toSfxSeed(seed ?? entry.defaultSeed);
              const sampleRate = engine.audioContext.sampleRate;
              const id = String(options?.id ?? `stfxr:${String(name)}:${resolvedSeed >>> 0}:${sampleRate}`);

              const bakedStore = getStfxrBakedStore(docId);
              if (!bakedStore) return '';
              if (bakedStore.has(id)) return id;

              const buffer = await bakeSfxGraphBuffer(engine.audioContext, entry.preset, resolvedSeed, {
                seconds: options?.seconds,
                maxSeconds: options?.maxSeconds
              });
              bakedStore.set(id, {
                id,
                name: String(name),
                seed: resolvedSeed >>> 0,
                sampleRate,
                seconds: buffer.length / sampleRate,
                buffer,
                bytes: estimateAudioBufferBytes(buffer),
                createdAt: Date.now()
              });
              evictStfxrBakedIfNeeded(bakedStore);
              return id;
            },
            playBaked: (
              id: string,
              options?: { volume?: number; when?: number; playbackRate?: number }
            ) => {
              const bakedStore = getStfxrBakedStore(docId);
              const entry = bakedStore?.get(String(id));
              if (!entry) return { stop: () => {} };
              engine.audioContext.resume().catch(() => {});

              const src = engine.audioContext.createBufferSource();
              const gain = engine.audioContext.createGain();
              src.buffer = entry.buffer;
              src.playbackRate.value = options?.playbackRate ?? 1;
              gain.gain.value = options?.volume ?? 1;
              src.connect(gain);
              gain.connect(engine.audioContext.destination);

              const t0 = engine.audioContext.currentTime + (options?.when ?? 0);
              try {
                src.start(t0);
              } catch {
                // ignore
              }

              return {
                stop: (when?: number) => {
                  const t = engine.audioContext.currentTime + (when ?? 0);
                  try {
                    src.stop(t);
                  } catch {
                    // ignore
                  }
                }
              };
            },
            bakedList: () => {
              const bakedStore = getStfxrBakedStore(docId);
              if (!bakedStore) return [];
              return Array.from(bakedStore.keys());
            },
            snippet: (name: string, seed?: number | string, volume?: number) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              const seedPart = (seed ?? entry?.defaultSeed) === undefined ? '' : `, ${JSON.stringify(seed ?? entry?.defaultSeed)}`;
              const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
              return `stfxr.play(${JSON.stringify(String(name))}${seedPart}${optPart})`;
            }
          };
        },
        list: () => {
          const store = getStfxrStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getStfxrStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getStfxrStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return clonePreset(entry.preset);
        },
        play: (name: string, seed?: number | string, options?: { volume?: number; when?: number }) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          if (!entry) return { stop: () => {} };
          engine.audioContext.resume().catch(() => {});
          const resolvedSeed = toSfxSeed(seed ?? entry.defaultSeed);
          return playSfxGraph(engine.audioContext, entry.preset, resolvedSeed, options);
        },
        bake: async (name: string, seed?: number | string, options?: { id?: string; seconds?: number; maxSeconds?: number }) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          if (!entry) return '';
          const resolvedSeed = toSfxSeed(seed ?? entry.defaultSeed);
          const sampleRate = engine.audioContext.sampleRate;
          const id = String(options?.id ?? `stfxr:${String(name)}:${resolvedSeed >>> 0}:${sampleRate}`);

          const bakedStore = getStfxrBakedStore();
          if (!bakedStore) return '';
          if (bakedStore.has(id)) return id;

          const buffer = await bakeSfxGraphBuffer(engine.audioContext, entry.preset, resolvedSeed, {
            seconds: options?.seconds,
            maxSeconds: options?.maxSeconds
          });
          bakedStore.set(id, {
            id,
            name: String(name),
            seed: resolvedSeed >>> 0,
            sampleRate,
            seconds: buffer.length / sampleRate,
            buffer,
            bytes: estimateAudioBufferBytes(buffer),
            createdAt: Date.now()
          });
          evictStfxrBakedIfNeeded(bakedStore);
          return id;
        },
        playBaked: (id: string, options?: { volume?: number; when?: number; playbackRate?: number }) => {
          const bakedStore = getStfxrBakedStore();
          const entry = bakedStore?.get(String(id));
          if (!entry) return { stop: () => {} };
          engine.audioContext.resume().catch(() => {});

          const src = engine.audioContext.createBufferSource();
          const gain = engine.audioContext.createGain();
          src.buffer = entry.buffer;
          src.playbackRate.value = options?.playbackRate ?? 1;
          gain.gain.value = options?.volume ?? 1;
          src.connect(gain);
          gain.connect(engine.audioContext.destination);

          const t0 = engine.audioContext.currentTime + (options?.when ?? 0);
          try {
            src.start(t0);
          } catch {
            // ignore
          }

          return {
            stop: (when?: number) => {
              const t = engine.audioContext.currentTime + (when ?? 0);
              try {
                src.stop(t);
              } catch {
                // ignore
              }
            }
          };
        },
        bakedList: () => {
          const bakedStore = getStfxrBakedStore();
          if (!bakedStore) return [];
          return Array.from(bakedStore.keys());
        },
        snippet: (name: string, seed?: number | string, volume?: number) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          const seedPart = (seed ?? entry?.defaultSeed) === undefined ? '' : `, ${JSON.stringify(seed ?? entry?.defaultSeed)}`;
          const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
          return `stfxr.play(${JSON.stringify(String(name))}${seedPart}${optPart})`;
        }
      },

      // Embedded FIGlet fonts (from ```figlet name:...)
      figlet: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          const getStore = () => getFigletStore(docId);

          const ensureFont = (name: string): FigletFont | null => {
            const store = getStore();
            if (!store) return null;
            const entry = store.get(String(name));
            if (!entry) return null;
            if (!entry.font) {
              try {
                entry.font = parseFIGfont(String(entry.text ?? ''), String(entry.name ?? name));
              } catch (e) {
                console.warn('[figlet] Failed to parse font:', name, e);
                return null;
              }
            }
            return entry.font ?? null;
          };

          return {
            list: () => {
              const store = getStore();
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStore();
              if (!store) return false;
              return store.has(String(name));
            },
            text: (name: string) => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            height: (name: string) => {
              const font = ensureFont(String(name));
              return font ? Math.max(0, font.height | 0) : 0;
            },
            render: (fontName: string, text: string) => {
              const font = ensureFont(String(fontName));
              if (!font) return [];
              return renderFigletLines(font, String(text ?? ''));
            },
            renderChar: (fontName: string, ch: string) => {
              const font = ensureFont(String(fontName));
              if (!font) return [];
              return renderFigletCharLines(font, String(ch ?? ' '));
            }
          };
        },
        list: () => {
          const store = getFigletStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getFigletStore();
          if (!store) return false;
          return store.has(String(name));
        },
        text: (name: string) => {
          const store = getFigletStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        height: (name: string) => {
          const store = getFigletStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          if (!entry.font) {
            try {
              entry.font = parseFIGfont(String(entry.text ?? ''), String(entry.name ?? name));
            } catch {
              return 0;
            }
          }
          return entry.font ? Math.max(0, entry.font.height | 0) : 0;
        },
        render: (fontName: string, text: string) => {
          const store = getFigletStore();
          if (!store) return [];
          const entry = store.get(String(fontName));
          if (!entry) return [];
          if (!entry.font) {
            try {
              entry.font = parseFIGfont(String(entry.text ?? ''), String(entry.name ?? fontName));
            } catch (e) {
              console.warn('[figlet] Failed to parse font:', fontName, e);
              return [];
            }
          }
          return entry.font ? renderFigletLines(entry.font, String(text ?? '')) : [];
        },
        renderChar: (fontName: string, ch: string) => {
          const store = getFigletStore();
          if (!store) return [];
          const entry = store.get(String(fontName));
          if (!entry) return [];
          if (!entry.font) {
            try {
              entry.font = parseFIGfont(String(entry.text ?? ''), String(entry.name ?? fontName));
            } catch (e) {
              console.warn('[figlet] Failed to parse font:', fontName, e);
              return [];
            }
          }
          return entry.font ? renderFigletCharLines(entry.font, String(ch ?? ' ')) : [];
        }
      },

      // Embedded ANSI art (from ```ansi name:...)
      ansi: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          const getStore = () => getAnsiStore(docId);
          return {
            list: () => {
              const store = getStore();
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStore();
              if (!store) return false;
              return store.has(String(name));
            },
            text: (name: string) => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            runs: (name: string): AnsiRun[][] | null => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.parsed) {
                const defaultStyle = engine.getStyle('default');
                entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
                  defaultFg: ColorUtils.from(defaultStyle.fg),
                  defaultBg: engine.currentTheme.bg,
                  tabSize: entry.tabSize ?? 4,
                  bracketSGR: true
                });
              }
              return entry.parsed.lines;
            },
            width: (name: string) => {
              const store = getStore();
              if (!store) return 0;
              const entry = store.get(String(name));
              if (!entry) return 0;
              if (!entry.parsed) {
                const defaultStyle = engine.getStyle('default');
                entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
                  defaultFg: ColorUtils.from(defaultStyle.fg),
                  defaultBg: engine.currentTheme.bg,
                  tabSize: entry.tabSize ?? 4,
                  bracketSGR: true
                });
              }
              return entry.parsed.width;
            },
            height: (name: string) => {
              const store = getStore();
              if (!store) return 0;
              const entry = store.get(String(name));
              if (!entry) return 0;
              if (!entry.parsed) {
                const defaultStyle = engine.getStyle('default');
                entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
                  defaultFg: ColorUtils.from(defaultStyle.fg),
                  defaultBg: engine.currentTheme.bg,
                  tabSize: entry.tabSize ?? 4,
                  bracketSGR: true
                });
              }
              return entry.parsed.height;
            }
          };
        },
        list: () => {
          const store = getAnsiStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getAnsiStore();
          if (!store) return false;
          return store.has(String(name));
        },
        text: (name: string) => {
          const store = getAnsiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        runs: (name: string): AnsiRun[][] | null => {
          const store = getAnsiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.parsed) {
            const defaultStyle = engine.getStyle('default');
            entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
              defaultFg: ColorUtils.from(defaultStyle.fg),
              defaultBg: engine.currentTheme.bg,
              tabSize: entry.tabSize ?? 4,
              bracketSGR: true
            });
          }
          return entry.parsed.lines;
        },
        width: (name: string) => {
          const store = getAnsiStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          if (!entry.parsed) {
            const defaultStyle = engine.getStyle('default');
            entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
              defaultFg: ColorUtils.from(defaultStyle.fg),
              defaultBg: engine.currentTheme.bg,
              tabSize: entry.tabSize ?? 4,
              bracketSGR: true
            });
          }
          return entry.parsed.width;
        },
        height: (name: string) => {
          const store = getAnsiStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          if (!entry.parsed) {
            const defaultStyle = engine.getStyle('default');
            entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
              defaultFg: ColorUtils.from(defaultStyle.fg),
              defaultBg: engine.currentTheme.bg,
              tabSize: entry.tabSize ?? 4,
              bracketSGR: true
            });
          }
          return entry.parsed.height;
        }
      },

      // Convenience: draw named ASCII art at x/y using the active layer.
      // Usage: drawAscii(x, y, 'art')
      drawAscii: (x: number, y: number, name: string, fg?: Color, bg?: Color) => {
        const store = getAsciiStore();
        if (!store) return;
        const entry = store.get(String(name));
        if (!entry) return;
        if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);

        const layer = this.layers.getActive();
        for (let i = 0; i < entry.lines.length; i++) {
          const line = entry.lines[i] ?? '';
          layer.write(x, y + i, line, fg, bg);
        }
      },

      // Convenience: draw FIGlet-rendered text using an embedded font.
      // Usage: drawFiglet(x, y, 'standard', 'HELLO', fg?, bg?, { vertical?: boolean, letterSpacing?: number })
      drawFiglet: (
        x: number,
        y: number,
        fontName: string,
        text: string,
        fg?: Color,
        bg?: Color,
        options?: { vertical?: boolean; letterSpacing?: number }
      ) => {
        const store = getFigletStore();
        if (!store) return;
        const entry = store.get(String(fontName));
        if (!entry) return;
        if (!entry.font) {
          try {
            entry.font = parseFIGfont(String(entry.text ?? ''), String(entry.name ?? fontName));
          } catch (e) {
            console.warn('[figlet] Failed to parse font:', fontName, e);
            return;
          }
        }
        const font = entry.font;
        if (!font) return;

        const layer = this.layers.getActive();
        const vertical = !!options?.vertical;
        const letterSpacing = Math.max(0, options?.letterSpacing ?? 0);

        if (vertical) {
          let currentY = y;
          for (const ch of Array.from(String(text ?? ''))) {
            const charLines = renderFigletCharLines(font, ch);
            let lineY = currentY;
            for (const line of charLines) {
              layer.write(x, lineY, line ?? '', fg, bg);
              lineY++;
            }
            currentY = lineY + letterSpacing;
          }
          return;
        }

        if (letterSpacing > 0) {
          let currentX = x;
          for (const ch of Array.from(String(text ?? ''))) {
            const charLines = renderFigletCharLines(font, ch);
            const charWidth = measureFigletLinesWidth(charLines);
            for (let i = 0; i < charLines.length; i++) {
              layer.write(currentX, y + i, charLines[i] ?? '', fg, bg);
            }
            currentX += charWidth + letterSpacing;
          }
          return;
        }

        const lines = renderFigletLines(font, String(text ?? ''));
        for (let i = 0; i < lines.length; i++) {
          layer.write(x, y + i, lines[i] ?? '', fg, bg);
        }
      },

      // Convenience: draw ANSI art (colors) using the active layer.
      // Usage: drawAnsi(x, y, 'logo')
      drawAnsi: (x: number, y: number, name: string) => {
        const store = getAnsiStore();
        if (!store) return;
        const entry = store.get(String(name));
        if (!entry) return;

        if (!entry.parsed) {
          const defaultStyle = engine.getStyle('default');
          entry.parsed = parseAnsiToRuns(String(entry.text ?? ''), {
            defaultFg: ColorUtils.from(defaultStyle.fg),
            defaultBg: engine.currentTheme.bg,
            tabSize: entry.tabSize ?? 4,
            bracketSGR: true
          });
        }

        const layer = this.layers.getActive();
        const lines = entry.parsed.lines;
        for (let row = 0; row < lines.length; row++) {
          let cx = x;
          const runs = lines[row] ?? [];
          for (const run of runs) {
            const t = String(run.text ?? '');
            if (t.length > 0) {
              layer.write(cx, y + row, t, run.fg, run.bg);
              cx += t.length;
            }
          }
        }
      },
      
      // Global accessors (for convenience)
      // These eliminate the need for users to track coordinates manually
      get mouseX() {
        // Default to pixel coordinates (matches event.x/event.y)
        return engine.input.getMouseX();
      },
      get mouseY() {
        // Default to pixel coordinates (matches event.y)
        return engine.input.getMouseY();
      },
      get mouseCellX() {
        // Cell coordinates (for terminal/TUI work)
        // Use backing store dimensions to match coordinate system of mouseX/mouseY
        const charWidth = engine.canvas.width / engine.width;
        const pixelX = engine.input.getMouseX();
        return Math.floor(pixelX / charWidth);
      },
      get mouseCellY() {
        // Cell coordinates (for terminal/TUI work)
        // Use backing store dimensions to match coordinate system of mouseX/mouseY
        const charHeight = engine.canvas.height / engine.height;
        const pixelY = engine.input.getMouseY();
        return Math.floor(pixelY / charHeight);
      },
      get mousePixelX() {
        // Alias for mouseX (pixel coordinates)
        return engine.input.getMouseX();
      },
      get mousePixelY() {
        // Alias for mouseY (pixel coordinates)
        return engine.input.getMouseY();
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
        
        /**
         * Decode the currently dropped file (if any) into an AudioBuffer.
         * This is a safe alternative to URL loading: no network access.
         */
        loadSoundFromDrop: async (): Promise<AudioBuffer | null> => {
          const dropped = engine.lastDroppedFile;
          const bytes = dropped?.bytes ?? null;
          if (!bytes) return null;

          const mime = String(dropped?.mime ?? '');
          if (mime && !mime.startsWith('audio/')) {
            console.warn(`[audio.loadSoundFromDrop] Dropped file "${String(dropped?.name ?? '')}" has non-audio mime "${mime}"; attempting decode anyway.`);
          }

          try {
            const ab = toExactArrayBuffer(bytes);
            return await engine.audioContext.decodeAudioData(ab);
          } catch (e) {
            console.warn('[audio.loadSoundFromDrop] Failed to decode dropped audio:', e);
            return null;
          }
        },

        /**
         * Decode an embedded ```blob block into an AudioBuffer.
         * Intended for small SFX (WAV/MP3). Returns null on failure.
         */
        loadSoundFromBlob: async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
          return await loadSoundFromBlobCached(name, documentId);
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

        /**
         * Convenience: decode and play the currently dropped file as audio.
         * Returns the started AudioBufferSourceNode, or null if decode fails.
         */
        playDrop: async (options: {
          loop?: boolean;
          volume?: number;
          playbackRate?: number;
          when?: number;
          destination?: AudioNode;
        } = {}): Promise<AudioBufferSourceNode | null> => {
          const dropped = engine.lastDroppedFile;
          const bytes = dropped?.bytes ?? null;
          if (!bytes) return null;

          const mime = String(dropped?.mime ?? '');
          if (mime && !mime.startsWith('audio/')) {
            console.warn(`[audio.playDrop] Dropped file "${String(dropped?.name ?? '')}" has non-audio mime "${mime}"; attempting decode anyway.`);
          }

          let buffer: AudioBuffer | null = null;
          try {
            const ab = toExactArrayBuffer(bytes);
            buffer = await engine.audioContext.decodeAudioData(ab);
          } catch (e) {
            console.warn('[audio.playDrop] Failed to decode dropped audio:', e);
            buffer = null;
          }

          if (!buffer) return null;

          const source = engine.audioContext.createBufferSource();
          const gain = engine.audioContext.createGain();
          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;
          source.connect(gain);
          gain.connect(options.destination ?? engine.audioContext.destination);
          const when = (typeof options.when === 'number' && Number.isFinite(options.when))
            ? options.when
            : engine.audioContext.currentTime;
          try {
            source.start(when);
          } catch {
            source.start();
          }
          return source;
        },

        /**
         * Offline peak detection for a decoded AudioBuffer.
         * Returns peak timestamps (seconds) and the smoothed envelope.
         * Dependency-free and deterministic.
         */
        peaksFromBuffer: (buffer: AudioBuffer, options: PeakDetectionOptions = {}): PeakDetectionResult => {
          return detectPeaksFromAudioBuffer(buffer, options);
        },

        /**
         * Offline beat grid analysis for a decoded AudioBuffer.
         * Currently assumes 4/4 by default, but returns a `meter` field for future meter detection.
         */
        beatsFromBuffer: (buffer: AudioBuffer, options: BeatDetectionOptions = {}): BeatAnalysisResult => {
          return analyzeBeatsFromAudioBuffer(buffer, options);
        },

        /**
         * Convert an offline beat analysis into a "what beat are we on" state.
         * Pass prevTimeSec to get edge flags when crossing beat boundaries.
         */
        beatState: (analysis: BeatAnalysisResult, timeSec: number, prevTimeSec?: number): BeatState => {
          return getBeatState(analysis, timeSec, prevTimeSec);
        },

        /**
         * Realtime FFT/analyser helper for visualizers.
         * Users can still use the raw WebAudio AnalyserNode directly, but this
         * provides convenient typed-array buffers and band-energy helpers.
         */
        fft: {
          createAnalyser: (options: {
            fftSize?: number;
            smoothing?: number;
            minDecibels?: number;
            maxDecibels?: number;
          } = {}) => {
            const analyser = this.audioContext.createAnalyser();
            if (typeof options.fftSize === 'number' && Number.isFinite(options.fftSize)) {
              try { analyser.fftSize = Math.max(32, Math.floor(options.fftSize)); } catch { /* ignore */ }
            }
            if (typeof options.smoothing === 'number' && Number.isFinite(options.smoothing)) {
              analyser.smoothingTimeConstant = Math.max(0, Math.min(1, options.smoothing));
            }
            if (typeof options.minDecibels === 'number' && Number.isFinite(options.minDecibels)) {
              analyser.minDecibels = options.minDecibels;
            }
            if (typeof options.maxDecibels === 'number' && Number.isFinite(options.maxDecibels)) {
              analyser.maxDecibels = options.maxDecibels;
            }

            const freqBytes = new Uint8Array(analyser.frequencyBinCount);
            const freqFloats = new Float32Array(analyser.frequencyBinCount);
            const timeBytes = new Uint8Array(analyser.fftSize);
            const timeFloats = new Float32Array(analyser.fftSize);

            const api = {
              analyser,
              binHz: () => this.audioContext.sampleRate / analyser.fftSize,
              connectFrom: (node: AudioNode) => {
                try { node.connect(analyser); } catch { /* ignore */ }
                return api;
              },
              connectTo: (node: AudioNode) => {
                try { analyser.connect(node); } catch { /* ignore */ }
                return api;
              },
              getFrequencyBytes: () => {
                analyser.getByteFrequencyData(freqBytes);
                return freqBytes;
              },
              getFrequencyFloats: () => {
                analyser.getFloatFrequencyData(freqFloats);
                return freqFloats;
              },
              getTimeDomainBytes: () => {
                analyser.getByteTimeDomainData(timeBytes);
                return timeBytes;
              },
              getTimeDomainFloats: () => {
                analyser.getFloatTimeDomainData(timeFloats);
                return timeFloats;
              },
              /**
               * Compute simple band energies (0..1-ish) from current float frequency data.
               * Bands are given in Hz: [{ fromHz, toHz }, ...]
               */
              getBands: (bands: Array<{ fromHz: number; toHz: number }>) => {
                analyser.getFloatFrequencyData(freqFloats);
                const binHz = this.audioContext.sampleRate / analyser.fftSize;
                const out: number[] = [];
                for (const b of bands) {
                  const from = Math.max(0, Math.min(b.fromHz, b.toHz));
                  const to = Math.max(0, Math.max(b.fromHz, b.toHz));
                  const i0 = Math.max(0, Math.floor(from / binHz));
                  const i1 = Math.min(freqFloats.length - 1, Math.ceil(to / binHz));
                  let sum = 0;
                  let count = 0;
                  for (let i = i0; i <= i1; i++) {
                    const db = freqFloats[i];
                    // Convert dBFS to linear magnitude (roughly 0..1).
                    const lin = Math.pow(10, db / 20);
                    sum += lin;
                    count++;
                  }
                  out.push(count > 0 ? sum / count : 0);
                }
                return out;
              }
            };

            return api;
          }
        },

        /**
         * Convenience: decode and play an embedded audio blob by name.
         * Returns the started AudioBufferSourceNode, or null if decode fails.
         */
        playBlob: async (
          name: string,
          options: {
            loop?: boolean;
            volume?: number;
            playbackRate?: number;
            when?: number;
            destination?: AudioNode;
          } = {},
          documentId?: string
        ): Promise<AudioBufferSourceNode | null> => {
          const buffer = await loadSoundFromBlobCached(String(name ?? ''), documentId);
          if (!buffer) return null;

          const source = this.audioContext.createBufferSource();
          const gain = this.audioContext.createGain();

          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;

          source.connect(gain);
          gain.connect(options.destination ?? this.audioContext.destination);

          const when = (typeof options.when === 'number' && Number.isFinite(options.when))
            ? options.when
            : this.audioContext.currentTime;
          try {
            source.start(when);
          } catch {
            // Fallback: start immediately.
            source.start();
          }
          return source;
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

        // === SEEDED SFX HELPERS (Chiptone basics) ===
        sfx: {
          names: () => getSfxPresetNames(),
          play: (presetName, seed, options) => playSfx(this.audioContext, presetName, seed, options),
          snippet: (presetName, seed, volume) => sfxSnippet(presetName, seed, volume)
        },
        
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
        
        // NOTE: URL-based image loading is intentionally not exposed to sandboxed
        // user code. Use `ui.loadImageFromBlob()` instead.
        
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

        // NOTE: URL-based image loading is intentionally not exposed to sandboxed
        // user code. Use `ui.loadImageFromBlob()` instead.

        /**
         * Load an image from an embedded ```blob block by name.
         * The blob should be base64-encoded PNG/JPEG (mime:image/png or mime:image/jpeg).
         */
        loadImageFromBlob: async (name: string, documentId?: string): Promise<string | null> => {
          return await loadImageFromBlobInternal(name, documentId);
        },

        /**
         * Draw a loaded image by id.
         */
        image: (imageId: string, x: number, y: number, w: number, h: number, options?: { tint?: Color; uv?: { u: number; v: number; w: number; h: number } }) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;

          const key = String(imageId ?? '');
          if (!key) return;

          // Fast path: draw if already registered.
          if (ui.getImageSize(key)) {
            ui.image(key, x, y, w, h, options);
            return;
          }

          // If not registered, treat `imageId` as a blob name and auto-load in the background.
          const cache = getUIBlobImageCache();
          if (!cache) return;

          const resolved = cache.resolved.get(key);
          if (resolved && ui.getImageSize(resolved)) {
            ui.image(resolved, x, y, w, h, options);
            return;
          }

          if (cache.failed.has(key)) return;
          if (cache.inFlight.has(key)) return;

          const store = getBlobStore();
          const entry = store?.get(key) ?? null;
          if (!entry) return;
          const mime = String(entry.mime ?? '');
          if (!mime.startsWith('image/')) return;

          const promise = loadImageFromBlobInternal(key)
            .then((id) => {
              cache.inFlight.delete(key);
              if (id) {
                cache.resolved.set(key, id);
              } else {
                cache.failed.add(key);
              }
              return id;
            })
            .catch((_e) => {
              cache.inFlight.delete(key);
              cache.failed.add(key);
              return null;
            });

          cache.inFlight.set(key, promise);
        },
        pushClipRect: (x: number, y: number, w: number, h: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.pushClipRect(x, y, w, h);
        },
        popClipRect: () => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.popClipRect();
        },
        pushMaskRect: (x: number, y: number, w: number, h: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.pushMaskRect(x, y, w, h);
        },
        pushMaskRoundedRect: (x: number, y: number, w: number, h: number, radius: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.pushMaskRoundedRect(x, y, w, h, radius);
        },
        pushMaskPolygon: (points: Array<{ x: number; y: number }>) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.pushMaskPolygon(points);
        },
        popMask: () => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.popMask();
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
      
      // WGSL Shader API (high-level shader management)
      shader: {
        setUniform: (shaderName: string, uniformName: string, value: number | number[]) => {
          if (!engine.shaderManager) {
            console.warn('ShaderManager not available (WebGPU not initialized)');
            return;
          }
          try {
            engine.shaderManager.setUniform(shaderName, uniformName, value);
          } catch (error) {
            console.error(`Failed to set uniform ${uniformName} on shader ${shaderName}:`, error);
          }
        },
        
        setActive: (shaderName: string | null) => {
          if (!engine.shaderManager) {
            console.warn('ShaderManager not available (WebGPU not initialized)');
            return;
          }
          try {
            engine.shaderManager.setActiveShader(shaderName);
          } catch (error) {
            console.error(`Failed to set active shader to ${shaderName}:`, error);
          }
        },
        
        getActive: () => {
          if (!engine.shaderManager) return null;
          return engine.shaderManager.getActiveShaderName();
        },
        
        list: () => {
          if (!engine.shaderManager) return [];
          return engine.shaderManager.getRegisteredShaders();
        },
        
        has: (shaderName: string) => {
          if (!engine.shaderManager) return false;
          return engine.shaderManager.hasShader(shaderName);
        },
        
        info: (shaderName: string) => {
          if (!engine.shaderManager) return null;
          return engine.shaderManager.getShaderInfo(shaderName);
        },
        
        // Shader chain API
        setChain: async (shaderNames: string[]) => {
          if (!engine.shaderChainManager) {
            console.warn('ShaderChainManager not available (WebGPU not initialized)');
            return false;
          }
          try {
            return await engine.shaderChainManager.activateChain(shaderNames, 'api');
          } catch (error) {
            console.error('Failed to set shader chain:', error);
            return false;
          }
        },
        
        getChain: () => {
          if (!engine.shaderChainManager) return [];
          return engine.shaderChainManager.getActiveChain();
        },
        
        clearChain: () => {
          if (!engine.shaderChainManager) return;
          engine.shaderChainManager.clearChain();
        },
        
        hasChain: () => {
          if (!engine.shaderChainManager) return false;
          return engine.shaderChainManager.hasActiveChain();
        },
        
        chainInfo: () => {
          if (!engine.shaderChainManager) return null;
          return engine.shaderChainManager.getChainInfo();
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
      },
      
      // 3D Canvas API - Hardware-accelerated 3D section rendering
      canvas3D: {
        // Enable/disable 3D rendering mode
        enable: () => {
          // Treat enable() as a request that can be made before WebGPU is ready.
          // If/when the 3D layer becomes available, it will be enabled.
          engine.canvas3DEnabled = true;

          // If the compositor already exists and the 3D layer is registered, enable it now.
          if (engine.compositor?.layers.get('3d')) {
            engine.compositor.updateLayer('3d', { enabled: true });
          }

          // Return whether Canvas3D is available immediately.
          return engine.canvas3DRenderer !== null;
        },
        
        disable: () => {
          engine.canvas3DEnabled = false;
          // Disable the 3D layer in compositor
          if (engine.compositor?.layers.get('3d')) {
            engine.compositor.updateLayer('3d', { enabled: false });
          }
          console.log('3D Canvas mode disabled');
        },
        
        get enabled(): boolean {
          return engine.canvas3DEnabled;
        },
        
        get available(): boolean {
          return engine.canvas3DRenderer !== null;
        },

        // Built-in navigation controls (WASD + QE + right-drag mouse-look)
        controls: {
          setEnabled: (enabled: boolean) => {
            engine.canvas3DControlsEnabled = !!enabled;
          },
          get enabled(): boolean {
            return engine.canvas3DControlsEnabled;
          }
        },
        
        // Camera controls
        camera: {
          setPosition: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.position = { x, y, z };
          },
          
          setRotation: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.rotation = { x, y, z };
          },
          
          moveTo: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.target = { x, y, z };
          },
          
          focusOnSection: (sectionIndex: number | string, distance: number = 50) => {
            if (!engine.camera3D) return;
            engine.request3DCameraFocus({ kind: 'focus', sectionIndex, distance });
          },

          focusOnSectionFit: (sectionIndex: number | string, fill: number = 0.9) => {
            if (!engine.camera3D) return;
            engine.request3DCameraFocus({ kind: 'fit', sectionIndex, fill });
          },
          
          setFOV: (fov: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.fov = fov;
          },
          
          setEaseSpeed: (position: number, rotation: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.positionEaseSpeed = position;
            engine.camera3D.rotationEaseSpeed = rotation;
          },
          
          getPosition: () => {
            if (!engine.camera3D) return { x: 0, y: 0, z: 0 };
            return { ...engine.camera3D.position };
          },
          
          getRotation: () => {
            if (!engine.camera3D) return { x: 0, y: 0, z: 0 };
            return { ...engine.camera3D.rotation };
          }
        },

        get currentSection(): number | null {
          return engine.current3DSectionIndex;
        },
        
        // Section layout access
        getSectionLayout: (sectionIndex: number) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) return null;
          return {
            sectionIndex: layout.sectionIndex,
            sectionTitle: layout.sectionTitle,
            position: { ...layout.transform.position },
            rotation: { ...layout.transform.rotation },
            scale: { ...layout.transform.scale },
            width: layout.width,
            height: layout.height,
            visible: layout.visible,
            navigable: layout.navigable
          };
        },
        
        setSectionTransform: (sectionIndex: number, transform: {
          position?: { x: number; y: number; z: number };
          rotation?: { x: number; y: number; z: number };
          scale?: { x: number; y: number; z: number };
        }) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) {
            console.warn(`Section ${sectionIndex} not found`);
            return;
          }
          if (transform.position) {
            layout.transform.position = { ...transform.position };
          }
          if (transform.rotation) {
            // Convert degrees to radians
            layout.transform.rotation = {
              x: (transform.rotation.x * Math.PI) / 180,
              y: (transform.rotation.y * Math.PI) / 180,
              z: (transform.rotation.z * Math.PI) / 180
            };
          }
          if (transform.scale) {
            layout.transform.scale = { ...transform.scale };
          }
        },
        
        setSectionVisible: (sectionIndex: number, visible: boolean) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) {
            console.warn(`Section ${sectionIndex} not found`);
            return;
          }
          layout.visible = visible;
        },
        
        getSectionCount: () => {
          return engine.section3DLayouts.length;
        },
        
        // Configuration
        config: {
          setDefaults: (config: Partial<Canvas3DConfig>) => {
            if (config.defaultDepth !== undefined) {
              engine.canvas3DConfig.defaultDepth = config.defaultDepth;
            }
            if (config.defaultSectionWidth !== undefined) {
              engine.canvas3DConfig.defaultSectionWidth = config.defaultSectionWidth;
            }
            if (config.defaultSectionHeight !== undefined) {
              engine.canvas3DConfig.defaultSectionHeight = config.defaultSectionHeight;
            }
            if (config.cameraFov !== undefined) {
              engine.canvas3DConfig.cameraFov = config.cameraFov;
            }
            if (config.cameraNear !== undefined) {
              engine.canvas3DConfig.cameraNear = config.cameraNear;
            }
            if (config.cameraFar !== undefined) {
              engine.canvas3DConfig.cameraFar = config.cameraFar;
            }
            if (config.positionEaseSpeed !== undefined) {
              engine.canvas3DConfig.positionEaseSpeed = config.positionEaseSpeed;
            }
            if (config.rotationEaseSpeed !== undefined) {
              engine.canvas3DConfig.rotationEaseSpeed = config.rotationEaseSpeed;
            }
            if (config.autoLayoutEnabled !== undefined) {
              engine.canvas3DConfig.autoLayoutEnabled = config.autoLayoutEnabled;
            }
            if (config.autoLayoutColumns !== undefined) {
              engine.canvas3DConfig.autoLayoutColumns = config.autoLayoutColumns;
            }
            if (config.autoLayoutSpacing !== undefined) {
              engine.canvas3DConfig.autoLayoutSpacing = config.autoLayoutSpacing;
            }
            if (config.sectionTextureMode !== undefined) {
              const prev = engine.canvas3DConfig.sectionTextureMode;
              engine.canvas3DConfig.sectionTextureMode = config.sectionTextureMode;
              if (prev !== config.sectionTextureMode) {
                engine.clear3DSectionTextures();
              }
            }

            if (config.sectionBorderEnabled !== undefined) {
              const prev = engine.canvas3DConfig.sectionBorderEnabled;
              engine.canvas3DConfig.sectionBorderEnabled = config.sectionBorderEnabled;
              if (prev !== config.sectionBorderEnabled) {
                engine.clear3DSectionTextures();
              }
            }
            if (config.sectionBorderWidth !== undefined) {
              const prev = engine.canvas3DConfig.sectionBorderWidth;
              engine.canvas3DConfig.sectionBorderWidth = config.sectionBorderWidth;
              if (prev !== config.sectionBorderWidth) {
                engine.clear3DSectionTextures();
              }
            }

            if ((config as any).sectionBackground !== undefined) {
              const prev = (engine.canvas3DConfig as any).sectionBackground;
              (engine.canvas3DConfig as any).sectionBackground = (config as any).sectionBackground;
              if (prev !== (config as any).sectionBackground) {
                engine.clear3DSectionTextures();
              }
            }

            engine.applyCanvas3DLayoutCallback();
          },
          
          getDefaults: () => {
            return { ...engine.canvas3DConfig };
          }
        },

        layout: {
          setCallback: (fn: any) => {
            engine.canvas3DLayoutCallback = typeof fn === 'function' ? fn : null;
            engine.applyCanvas3DLayoutCallback();
          },
          clearCallback: () => {
            engine.canvas3DLayoutCallback = null;
          }
        }
      }
    };
  }

  /**
   * Register any shaders from loaded documents that weren't registered yet
   */
  private async registerPendingShaders(): Promise<void> {
    if (!this.shaderManager) return;

    for (const [docId, doc] of this.documents) {
      const parsed = (doc as any)._parsedMarkdown;
      if (parsed?.wgslShaders && parsed.wgslShaders.length > 0) {
        console.log(`[ShaderManager] Registering ${parsed.wgslShaders.length} shader(s) from ${docId}...`);
        try {
          const sm: any = this.shaderManager as any;
          if (typeof sm.registerShaders === 'function') {
            await sm.registerShaders(parsed.wgslShaders);
          } else {
            for (const shader of parsed.wgslShaders) {
              await this.shaderManager.registerShader(shader);
            }
          }
          console.log(`  ✓ Registered WGSL shaders from ${docId}`);
        } catch (error) {
          console.error(`  ✗ Failed to register WGSL shaders from ${docId}:`, error);
        }
      }
    }
  }

  /**
   * Load a markdown document and execute its code with lifecycle hooks
   */
  async loadMarkdown(documentId: string, markdown: string): Promise<boolean> {
    try {
      console.log(`Loading document: ${documentId}`);
      
      // Parse markdown (now async to support magic block expansion)
      const parsed = await parseMarkdown(markdown);
      console.log(`  Found ${parsed.sections.length} sections`);
      console.log(`  Found ${parsed.codeBlocks.length} code blocks`);
      
      // Log WGSL shaders if present
      if (parsed.wgslShaders && parsed.wgslShaders.length > 0) {
        console.log(`  Found ${parsed.wgslShaders.length} WGSL shader(s):`);
        for (const shader of parsed.wgslShaders) {
          console.log(`    - ${shader.name} (${shader.kind})`);
        }
        
        // Register shaders with ShaderManager if WebGPU is available
        if (this.shaderManager) {
          console.log(`  Registering shaders with ShaderManager...`);
          try {
            const sm: any = this.shaderManager as any;
            if (typeof sm.registerShaders === 'function') {
              await sm.registerShaders(parsed.wgslShaders);
            } else {
              for (const shader of parsed.wgslShaders) {
                await this.shaderManager.registerShader(shader);
              }
            }
            console.log(`    ✓ Registered WGSL shaders`);
          } catch (error) {
            console.error(`    ✗ Failed to register WGSL shaders:`, error);
          }
        } else {
          console.log(`  ⏳ ShaderManager not yet initialized - shaders will be registered when WebGPU starts`);
        }
      }
      
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
      
      // Create 3D layouts for sections (if 3D canvas is available)
      if (this.canvas3DRenderer) {
        this.section3DLayouts = createSection3DLayouts(parsed.sections, this.canvas3DConfig);
        console.log(`  Created 3D layouts for ${this.section3DLayouts.length} sections`);
        this.applyPending3DCameraFocus();
        this.applyCanvas3DLayoutCallback(parsed.sections);
      }
      
      // Apply theme from frontmatter if specified
      if (parsed.metadata.theme) {
        const themeName = String(parsed.metadata.theme).toLowerCase().replace(/['"]/g, '');
        this.currentTheme = getTheme(themeName);
        this.styleSheet = applyTheme(this.currentTheme);
        console.log(`  Theme: ${themeName}`);

        // Retint terminal buffers to the new theme background so the “page background”
        // matches the theme even when the terminal layer is otherwise empty.
        this.layers.clearAll(this.currentTheme.bg);
      }
      
      // Apply shader chain from frontmatter if specified
      if (parsed.metadata.shaders) {
        const shadersStr = String(parsed.metadata.shaders);
        console.log(`  Shader chain (frontmatter): ${shadersStr}`);
        
        if (this.shaderChainManager) {
          // ShaderChainManager ready, apply immediately
          await this.shaderChainManager.activateChainFromString(shadersStr, 'frontmatter');
        } else {
          // Defer until WebGPU initialization
          console.log(`  Deferring shader chain until WebGPU init`);
          this.pendingShaderChain = { chainStr: shadersStr, source: 'frontmatter' };
        }
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

      // Build blob store (```blob name:... enc:base64 mime:...)
      const blobStore = new Map<string, { name: string; mime: string; encoding: 'base64' | 'hex'; data: string; bytes?: Uint8Array }>();
      if (parsed.blobBlocks && parsed.blobBlocks.length > 0) {
        for (const b of parsed.blobBlocks) {
          const name = String(b.name ?? '').trim();
          if (!name) continue;
          const mime = String(b.mime ?? 'application/octet-stream').trim() || 'application/octet-stream';
          const encoding = (String((b as any).encoding ?? 'base64').trim().toLowerCase() === 'hex') ? 'hex' : 'base64';
          const data = encoding === 'hex'
            ? String(b.data ?? '')
            : String(b.data ?? '').replace(/\s+/g, '');
          if (!data) continue;
          if (blobStore.has(name)) {
            console.warn(`  [blob] Duplicate name "${name}"; last one wins.`);
          }
          blobStore.set(name, { name, mime, encoding, data });
        }
        console.log(`  Found ${blobStore.size} blob block(s)`);
      }

      // Build ASCII store (```ascii name:...)
      const asciiStore = new Map<string, { name: string; text: string; lines?: string[] }>();
      for (const b of parsed.codeBlocks) {
        let name: string | null = null;

        if (typeof b.lang === 'string' && b.lang.startsWith('ascii:')) {
          console.warn(`  [ascii] Legacy fence syntax "${b.lang}" is no longer supported. Use \`\`\`ascii name:...\`\`\` instead.`);
        }

        if (b.lang === 'ascii') {
          const n = String(b.metadata?.name ?? '').trim();
          if (n) name = n;
        }

        if (!name) continue;
        const text = String(b.code ?? '');
        if (asciiStore.has(name)) {
          console.warn(`  [ascii] Duplicate name "${name}"; last one wins.`);
        }
        asciiStore.set(name, { name, text });
      }
      if (asciiStore.size > 0) {
        console.log(`  Found ${asciiStore.size} ascii block(s)`);
      }

      // Build FIGlet font store (```figlet name:...)
      const figletStore = new Map<string, { name: string; text: string; font?: FigletFont }>();
      for (const b of parsed.codeBlocks) {
        let name: string | null = null;

        if (typeof b.lang === 'string' && b.lang.startsWith('figlet:')) {
          console.warn(`  [figlet] Legacy fence syntax "${b.lang}" is no longer supported. Use \`\`\`figlet name:...\`\`\` instead.`);
        }

        if (b.lang === 'figlet') {
          const n = String(b.metadata?.name ?? '').trim();
          if (n) name = n;
        }

        if (!name) continue;
        const text = String(b.code ?? '');
        if (figletStore.has(name)) {
          console.warn(`  [figlet] Duplicate name "${name}"; last one wins.`);
        }
        figletStore.set(name, { name, text });
      }
      if (figletStore.size > 0) {
        console.log(`  Found ${figletStore.size} figlet font block(s)`);
      }

      // Build ANSI store (```ansi name:...)
      const ansiStore = new Map<string, { name: string; text: string; tabSize: number; parsed?: AnsiParsed }>();
      {
        const defaultStyle = this.getStyle('default');
        const defaultFg = ColorUtils.from(defaultStyle.fg);
        const defaultBg = this.currentTheme.bg;

        for (const b of parsed.codeBlocks) {
          if (b.lang !== 'ansi') continue;
          const name = String(b.metadata?.name ?? '').trim();
          if (!name) continue;

          const rawTab = String((b.metadata?.tab ?? b.metadata?.tabSize ?? '')).trim();
          const tabSize = rawTab ? Math.max(1, Number.parseInt(rawTab, 10) || 4) : 4;
          const text = String(b.code ?? '');
          if (ansiStore.has(name)) {
            console.warn(`  [ansi] Duplicate name "${name}"; last one wins.`);
          }

          // Parse once at load so rendering is fast.
          const parsedAnsi = parseAnsiToRuns(text, {
            defaultFg,
            defaultBg,
            tabSize,
            bracketSGR: true
          });
          ansiStore.set(name, { name, text, tabSize, parsed: parsedAnsi });
        }

        if (ansiStore.size > 0) {
          console.log(`  Found ${ansiStore.size} ansi block(s)`);
        }
      }

      // Build STFXR store (```stfxr name:... seed:...)
      const stfxrStore = new Map<string, { name: string; preset: SfxGraphPreset; defaultSeed?: number | string }>();
      const stfxrPending = new Map<string, { name: string; base: string; patch: any; defaultSeed?: number | string; startLine: number; endLine: number }>();
      for (const b of parsed.codeBlocks) {
        if (b.lang !== 'stfxr') continue;
        const name = String(b.metadata?.name ?? '').trim();
        if (!name) {
          console.warn(`  [stfxr] Skipping unnamed stfxr block at lines ${b.startLine + 1}-${b.endLine + 1}`);
          continue;
        }

        const seedRaw = String(b.metadata?.seed ?? '').trim();
        let defaultSeed: number | string | undefined = undefined;
        if (seedRaw) {
          const n = Number(seedRaw);
          defaultSeed = Number.isFinite(n) ? n : seedRaw;
        }

        try {
          const def = parseStfxrDefinitionJson(String(b.code ?? ''));
          if (def.kind === 'preset') {
            if (stfxrStore.has(name) || stfxrPending.has(name)) {
              console.warn(`  [stfxr] Duplicate name "${name}"; last one wins.`);
            }
            stfxrStore.set(name, { name, preset: def.preset, defaultSeed });
          } else {
            if (stfxrStore.has(name) || stfxrPending.has(name)) {
              console.warn(`  [stfxr] Duplicate name "${name}"; last one wins.`);
            }
            stfxrPending.set(name, {
              name,
              base: def.base,
              patch: def.patch,
              defaultSeed,
              startLine: b.startLine,
              endLine: b.endLine
            });
          }
        } catch (e) {
          console.warn(`  [stfxr] Failed to parse stfxr block for "${name}" at lines ${b.startLine + 1}-${b.endLine + 1}:`, e);
          continue;
        }
      }

      const clonePreset = (preset: SfxGraphPreset): SfxGraphPreset => {
        try {
          // @ts-ignore
          if (typeof structuredClone === 'function') return structuredClone(preset);
        } catch {
          // ignore
        }
        return JSON.parse(JSON.stringify(preset)) as SfxGraphPreset;
      };

      const sameEdge = (a: { from: string; to: string }, b: { from: string; to: string }) => a.from === b.from && a.to === b.to;

      const resolveBasePreset = (base: string): SfxGraphPreset | null => {
        const asBuiltIn = base as SfxPresetName;
        if ((SFX_PRESETS as any)[asBuiltIn]) return (SFX_PRESETS as any)[asBuiltIn] as SfxGraphPreset;
        const entry = stfxrStore.get(base);
        return entry ? entry.preset : null;
      };

      // Resolve derived presets (base + patch). We allow base to refer to a built-in
      // audio.sfx preset name or another stfxr preset in this document.
      if (stfxrPending.size > 0) {
        const maxPasses = stfxrPending.size + 4;
        for (let pass = 0; pass < maxPasses && stfxrPending.size > 0; pass++) {
          let progressed = false;
          for (const [name, pending] of Array.from(stfxrPending.entries())) {
            const basePreset = resolveBasePreset(pending.base);
            if (!basePreset) continue;

            const base = clonePreset(basePreset);
            const patch = pending.patch ?? {};

            // Vars merge
            if (patch.vars) {
              base.vars = { ...(base.vars ?? {}), ...(patch.vars ?? {}) };
            }

            // Node upsert (by id)
            if (Array.isArray(patch.nodes) && patch.nodes.length > 0) {
              const out = [...(base.nodes ?? [])];
              const indexById = new Map<string, number>();
              for (let i = 0; i < out.length; i++) indexById.set(out[i]!.id, i);
              for (const n of patch.nodes) {
                const idx = indexById.get(n.id);
                if (idx === undefined) {
                  indexById.set(n.id, out.length);
                  out.push(n);
                } else {
                  out[idx] = n;
                }
              }
              base.nodes = out;
            }

            // Edges replace / remove / add
            if (Array.isArray(patch.edges)) {
              base.edges = [...patch.edges];
            }
            if (Array.isArray(patch.edgesRemove) && patch.edgesRemove.length > 0) {
              base.edges = (base.edges ?? []).filter(e => !patch.edgesRemove.some((r: any) => sameEdge(e, r)));
            }
            if (Array.isArray(patch.edgesAdd) && patch.edgesAdd.length > 0) {
              const edges = [...(base.edges ?? [])];
              for (const e of patch.edgesAdd) {
                if (!edges.some(x => sameEdge(x, e))) edges.push(e);
              }
              base.edges = edges;
            }

            // Events replace / append
            if (Array.isArray(patch.events)) {
              base.events = [...patch.events];
            }
            if (Array.isArray(patch.eventsAdd) && patch.eventsAdd.length > 0) {
              base.events = [...(base.events ?? []), ...patch.eventsAdd];
            }

            stfxrStore.set(name, { name, preset: base, defaultSeed: pending.defaultSeed });
            stfxrPending.delete(name);
            progressed = true;
          }
          if (!progressed) break;
        }

        for (const pending of stfxrPending.values()) {
          console.warn(
            `  [stfxr] Could not resolve base "${pending.base}" for "${pending.name}" at lines ${pending.startLine + 1}-${pending.endLine + 1}`
          );
        }
      }

      if (stfxrStore.size > 0) {
        console.log(`  Found ${stfxrStore.size} stfxr block(s)`);
      }
      
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
      const dropBlocks: string[] = [];
      const globalBlocks: string[] = [];

      // Section-scoped enter hooks
      const enterBlocksBySection: Map<number, string[]> = new Map();
      
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
        } else if (hook === 'drop') {
          dropBlocks.push(block.code);
        } else if (hook === 'enter') {
          const sectionIdx = this.findSectionIndexForLine(parsed.sections, block.startLine);
          if (sectionIdx !== null) {
            const arr = enterBlocksBySection.get(sectionIdx) ?? [];
            arr.push(block.code);
            enterBlocksBySection.set(sectionIdx, arr);
          } else {
            // If it isn't inside a section, treat as global.
            globalBlocks.push(block.code);
          }
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
      let scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input', 'drop', '__enterHandlers'].includes(k));
      
      // Second pass: re-execute UNtransformed with exports to create proper closures
      // This allows functions to reference variables in their closure
      if (scopeVarNames.length > 0 && globalBlocks.length > 0) {
        console.log(`  Re-executing global blocks to create closures for ${scopeVarNames.length} variables`);
        // Some scope keys may come from direct `scope.foo = ...` assignments rather than
        // real JS bindings. Exporting those would throw (ReferenceError: foo is not defined).
        // Wrap in try/catch to only export when a binding exists.
        const exports = scopeVarNames.map(k => `  try { scope.${k} = ${k}; } catch (e) {}` ).join('\n');
        
        // Pass API globals as IIFE parameters so they're accessible inside the function
        const apiParams = 'term, termCanvas, layer, key, mouse, drop, tui, gui, getStyle, theme, modules, mouseX, mouseY, mouseCellX, mouseCellY, mousePixelX, mousePixelY, termWidth, termHeight, getFrame, getTime, getDelta, audio, canvas2d, blob, ascii, drawAscii, figlet, drawFiglet, ansi, drawAnsi, ui, webgl, webgpu, shader, compositor, canvas3D';
        
        for (const code of globalBlocks) {
          const wrappedCode = `(function(${apiParams}) {
${code}
${exports}
})(${apiParams});`;
          this.sandbox.executeCodeBlock(documentId, wrappedCode, true); // Skip transform on second pass
        }
      }
      
      // Get current scope to check for existing handlers and variables
      currentScope = this.sandbox.getScope(documentId) || {};
      
      // Get all non-handler variables from scope
      scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input', 'drop', '__enterHandlers'].includes(k));
      console.log(`  Scope variables:`, scopeVarNames);
      console.log(`  Scope values:`, scopeVarNames.map(k => `${k}=${JSON.stringify(currentScope[k])}`).join(', '));
      
      // Check if handlers were directly defined as functions
      const hasInit = typeof currentScope.init === 'function';
      const hasUpdate = typeof currentScope.update === 'function';
      const hasRender = typeof currentScope.render === 'function';
      const hasInput = typeof currentScope.input === 'function';
      const hasDrop = typeof (currentScope as any).drop === 'function';
      
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

      if (!hasDrop && dropBlocks.length > 0) {
        console.log(`  Creating drop handler from ${dropBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const dropCode = `scope.drop = function(file) {
${importVars}
${captureVars}
${dropBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, dropCode, true);
      }

      // Create section-scoped enter handlers (invoked by 3D navigation when a section becomes current).
      if (enterBlocksBySection.size > 0) {
        const pieces: string[] = [];
        pieces.push(`scope.__enterHandlers = scope.__enterHandlers || {};`);
        const indices = Array.from(enterBlocksBySection.keys()).sort((a, b) => a - b);
        for (const idx of indices) {
          const blocks = enterBlocksBySection.get(idx) ?? [];
          if (blocks.length === 0) continue;
          pieces.push(`scope.__enterHandlers[${idx}] = function() {`);
          if (importVars) pieces.push(importVars);
          if (captureVars) pieces.push(captureVars);
          pieces.push(blocks.join('\n\n'));
          if (exportVars) pieces.push(exportVars);
          pieces.push(`};`);
        }
        this.sandbox.executeCodeBlock(documentId, pieces.join('\n'), true);
      }
      
      // Extract handlers from scope
      const handlers = this.sandbox.extractHandlers(documentId);
      
      if (!handlers) {
        console.error('  Failed to extract handlers');
        return false;
      }
      
      // Store document (include parsed markdown for deferred shader registration)
      this.documents.set(documentId, {
        id: documentId,
        handlers,
        sections: parsed.sections,
        metadata: parsed.metadata,
        _parsedMarkdown: parsed,  // Store for deferred shader registration
        _blobStore: blobStore,
        _asciiStore: asciiStore,
        _figletStore: figletStore,
        _ansiStore: ansiStore,
        _stfxrStore: stfxrStore,
        _stfxrBakedStore: new Map()
      } as any);
      
      // Set as active if first document
      if (!this.activeDocumentId) {
        this.activeDocumentId = documentId;
      }
      console.log('🔍 Extracted handlers:', {
        init: typeof handlers?.init,
        update: typeof handlers?.update,
        render: typeof handlers?.render,
        input: typeof handlers?.input,
        drop: typeof (handlers as any)?.drop
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
   * Apply shader chain (typically from URL parameter, overrides frontmatter)
   */
  async applyShaderChain(chainStr: string, source: string = 'url'): Promise<boolean> {
    if (!this.shaderChainManager) {
      console.log('[Engine] Deferring shader chain until WebGPU init:', chainStr);
      this.pendingShaderChain = { chainStr, source };
      return true;
    }
    
    return await this.shaderChainManager.activateChainFromString(chainStr, source);
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

        // Keep engine-level WebGPU device in sync with the renderer's device.
        // The renderer is the source of truth for WebGPU initialization.
        const device = this.renderer.getContext().getDevice();
        if (device) {
          this.webgpuDevice = device;
          if (!this.shaderManager) {
            this.shaderManager = new ShaderManager(device);
            console.log('✓ ShaderManager initialized (renderer device)');
          }
          
          if (!this.shaderChainManager) {
            this.shaderChainManager = new ShaderChainManager(this.shaderManager, device);
            console.log('✓ ShaderChainManager initialized (renderer device)');
          }
          
          // Initialize 3D Canvas renderer
          if (!this.canvas3DRenderer) {
            try {
              this.canvas3DRenderer = new Canvas3DRenderer(device, this.canvas.width, this.canvas.height);
              await this.canvas3DRenderer.init();
              if (!this.camera3D) {
                this.camera3D = createCamera3D();
              }
              
              // Register 3D layer with compositor
              const renderTexture = this.canvas3DRenderer.getRenderTexture();
              if (renderTexture && this.compositor) {
                this.compositor.registerLayer('3d', {
                  texture: renderTexture,
                  width: this.canvas.width,
                  height: this.canvas.height,
                  zIndex: 5,  // Above terminal (0) but below UI (20)
                  enabled: this.canvas3DEnabled,  // Honor early canvas3D.enable() calls
                  opacity: 1.0,  // Full opacity
                  blendMode: 'normal'  // Normal blend (not multiply)
                });
              } else {
                console.warn('✗ Failed to register 3D layer');
              }
              
              // (init logs removed)
              
              // Create section3DLayouts for any documents that were loaded before Canvas3D was ready
              // (debug log removed)
              for (const [docId, docData] of this.documents.entries()) {
                const anyDocData = docData as any;
                if (anyDocData._parsedMarkdown?.sections) {
                  const layouts = createSection3DLayouts(anyDocData._parsedMarkdown.sections, this.canvas3DConfig);
                  this.section3DLayouts = layouts;
                  this.applyPending3DCameraFocus();
                  this.applyCanvas3DLayoutCallback(anyDocData._parsedMarkdown.sections);
                  console.log(`✓ Created ${layouts.length} 3D section layouts for document ${docId}`);
                } else {
                  // (debug log removed)
                }
              }
              
            } catch (error) {
              console.warn('Failed to initialize Canvas3DRenderer:', error);
            }
          }

          // Let the compositor use the ShaderManager and ShaderChainManager for post-processing.
          if (this.compositor) {
            this.compositor.setShaderManager(this.shaderManager);
            this.compositor.setShaderChainManager(this.shaderChainManager);
          }
          
          // Apply any pending shader chain
          if (this.pendingShaderChain) {
            console.log(`✓ Applying deferred shader chain (${this.pendingShaderChain.source}): ${this.pendingShaderChain.chainStr}`);
            await this.shaderChainManager.activateChainFromString(
              this.pendingShaderChain.chainStr,
              this.pendingShaderChain.source
            );
            this.pendingShaderChain = null;
          }
        }

        // Eagerly create the UI layer once WebGPU + compositor are ready.
        // This avoids a class of issues where demo code calls ui.* but the
        // layer isn't registered due to timing/guardrails.
        this.ensureWebGPUUI();
        
        // Register any WGSL shaders that were parsed before WebGPU was initialized
        await this.registerPendingShaders();
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

        // Keep compositor terminal layer texture in sync.
        // The terminal render texture can be created lazily or recreated on resize.
        if (this.renderer instanceof WebGPURenderer) {
          const terminalTexture = this.renderer.getRenderTexture();
          const existing = this.compositor.layers.get('terminal')?.texture;
          if (terminalTexture && existing !== terminalTexture) {
            this.compositor.updateLayerTexture('terminal', terminalTexture);
            if (this.frameCount < 3) {
              console.log('[Compositor] Updated terminal layer texture');
            }
          } else if (!terminalTexture && this.frameCount < 3) {
            console.warn('[Compositor] Terminal render texture missing; frame may be blank');
          }

        }

        // Ensure each section has a texture with its rendered heading/content.
        if (this.canvas3DEnabled && this.section3DLayouts.length > 0 && this.renderer instanceof WebGPURenderer) {
          const device = this.renderer.getContext().getDevice();
          if (device) {
            if (this.canvas3DConfig.sectionTextureMode === 'webgpu-ui') {
              this.ensure3DSectionTexturesWebGPUUI(device);
            } else {
              this.ensure3DSectionTextures(device);
            }
          }
        }

        // Render 3D canvas to offscreen texture (before compositing)
        if (this.canvas3DEnabled && this.canvas3DRenderer && this.camera3D) {
          const pick = this.pick3DAt(this.input.getMouseX(), this.input.getMouseY());

          // Link hover/focus highlight (invert only the link region)
          this.hovered3DLink = null;
          if (pick) {
            const linkHit = this.hitTest3DLinkAtUV(pick.layout.sectionIndex, pick.u, pick.v);
            if (linkHit) {
              this.hovered3DLink = { sectionIndex: pick.layout.sectionIndex, linkIndex: linkHit.linkIndex };
            }
          }

          // Clear previous highlights
          for (const layout of this.section3DLayouts) {
            layout.highlightUvRect = undefined;
          }

          // Prefer mouse hover over keyboard focus
          const active = this.hovered3DLink ?? this.focused3DLink;
          if (active) {
            const rect = this.get3DLinkUvRect(active.sectionIndex, active.linkIndex);
            if (rect) {
              const layout = this.section3DLayouts.find(l => l.sectionIndex === active.sectionIndex);
              if (layout) layout.highlightUvRect = rect;
            }
          }

          // Whole-card hover invert disabled (we highlight links instead)
          const backgroundChain = this.parseCanvas3DSectionBackgroundChain();
          const proceduralBackground = this.isCanvas3DSectionBackgroundProceduralChainEnabled();
          const backgroundConfig = proceduralBackground
            ? {
                enabled: true,
                chain: backgroundChain,
                paperColor: this.resolveCanvas3DSectionBackground(),
                lineColor: this.withAlpha(this.getStyle('dim').fg, 0x40),
                scale: 1,
                spacing: 1,
                thickness: 0.06,
                noiseStrength: 0.06,
              }
            : undefined;

          this.canvas3DRenderer.render(this.camera3D, this.section3DLayouts, null, backgroundConfig);
        }

        // Render GPU UI into its own texture (if created)
        if (this.webgpuUIRenderer) {
          // Render retained-mode GUI widgets
          const guiAPI = this.api?.gui;
          if (guiAPI && guiAPI.getSystem && guiAPI.getSystem()) {
            guiAPI.render(this.api.ui);
          }
          
          this.webgpuUIRenderer.flush();
        }

        // Only auto-composite in auto mode. In manual mode, user code controls
        // clear/blit/present inside the document render handler.
        if (this.compositor.mode === 'auto') {
          // Keep built-in shaders (e.g. ruledlines) in sync with the actual
          // terminal cell size derived from the current font metrics.
          this.syncTerminalCellSizeToShaders();

          // Clear to theme background (Canvas3D renders to transparent).
          this.compositor.setAutoClearColor(this.currentTheme.bg);
          this.compositor.autoComposite();   // Composite all layers to main canvas
        } else if (this.frameCount < 3) {
          console.warn('[Compositor] Manual mode is active; user code must call compositor.present() each frame');
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
   * Push the terminal cell size (in render-texture pixels) into any active
   * post-process shader(s) that declare a `cellSize` uniform.
   *
   * This mirrors tstorie behavior where font metrics were provided to shaders
   * like `ruledlines` so effects can align to the text grid.
   */
  private syncTerminalCellSizeToShaders(): void {
    if (!this.shaderManager) return;
    if (!(this.renderer instanceof WebGPURenderer)) return;

    const terminal = this.renderer.getTerminalRenderer();
    // TerminalRenderer metrics are in the same pixel space as the render texture
    // and the compositor/shader pipeline resolution.
    const cellW = Math.max(1, terminal.getCellWidth());
    const cellH = Math.max(1, terminal.getCellHeight());

    if (
      this.lastShaderCellSize &&
      this.lastShaderCellSize.w === cellW &&
      this.lastShaderCellSize.h === cellH
    ) {
      return;
    }
    this.lastShaderCellSize = { w: cellW, h: cellH };

    const value: number[] = [cellW, cellH];

    // If a chain is active, update every shader in the chain.
    if (this.shaderChainManager && this.shaderChainManager.hasActiveChain()) {
      const chain = this.shaderChainManager.getActiveChain();
      for (const shaderName of chain) {
        // Only update shaders that actually declare `cellSize`.
        // Avoid spamming warnings for shaders that don't use grid alignment.
        if (this.shaderManager.hasUniform(shaderName, 'cellSize')) {
          this.shaderManager.setUniform(shaderName, 'cellSize', value);
        }
      }
      return;
    }

    // Otherwise update the currently active single shader, if any.
    const active = this.shaderManager.getActiveShaderName();
    if (active) {
      if (this.shaderManager.hasUniform(active, 'cellSize')) {
        this.shaderManager.setUniform(active, 'cellSize', value);
      }
    }
  }

  private ensure3DSectionTextures(device: GPUDevice): void {
    if (!this.canvas3DEnabled || !this.camera3D) return;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const aspect = canvasW > 0 && canvasH > 0 ? canvasW / canvasH : 1;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    // Treat section width/height as character columns/rows when generating
    // section textures. This makes defaultSectionHeight behave like “rows of text”.
    const fontSizePx = 16;
    const fontStack = "'3270-regular', 'Consolas', 'Monaco', monospace";
    const texturePadding = 12;

    const measureCanvas = new OffscreenCanvas(1, 1);
    const measureCtx = measureCanvas.getContext('2d', { alpha: true });
    if (!measureCtx) return;
    measureCtx.textBaseline = 'top';
    measureCtx.textAlign = 'left';
    measureCtx.font = `${fontSizePx}px ${fontStack}`;
    const m = measureCtx.measureText('M');
    const measuredCharW = Math.max(1, Math.ceil(m.width));
    const measuredCharH = Math.max(
      1,
      (m.fontBoundingBoxAscent && m.fontBoundingBoxDescent)
        ? Math.ceil(m.fontBoundingBoxAscent + m.fontBoundingBoxDescent)
        : Math.ceil(fontSizePx * 1.25)
    );
    const baseLineHeight = Math.max(1, Math.round(measuredCharH * 1.25));

    for (const layout of this.section3DLayouts) {
      if (!layout.visible) continue;

      if (!this.is3DCardPossiblyVisible(viewProj, layout)) {
        continue;
      }

      // Only rasterize once per section for now.
      if (layout.texture) continue;

      const minW = 256;
      const minH = 128;
      const maxW = 1024;
      const maxH = 1024;

      const desiredW = Math.round(layout.width * measuredCharW + texturePadding * 2);
      const desiredH = Math.round(layout.height * baseLineHeight + texturePadding * 2);
      const widthPx = Math.max(minW, Math.min(maxW, desiredW));
      const heightPx = Math.max(minH, Math.min(maxH, desiredH));

      const canvas = new OffscreenCanvas(widthPx, heightPx);
      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) {
        continue;
      }

      // Use the same markdown-lite layout engine as the WebGPU-UI path so:
      // - explicit newlines are preserved
      // - link regions exist for picking/navigation
      //
      // IMPORTANT: In Canvas2D sectionTextureMode we must lay out using the same
      // font metrics that Canvas2D will use to draw, otherwise the monospace-based
      // layout (charW/charH) won’t match the actual rendered glyph widths.
      // That mismatch shows up as “extra spaces” between words.

      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = `${fontSizePx}px ${fontStack}`;

      // Use the same metrics we used to size the texture.
      const charW = measuredCharW;
      const charH = measuredCharH;

      const base = this.getStyle('default');
      const dim = this.getStyle('dim');
      const heading = this.getStyle('heading');
      const link = this.getStyle('link');
      const code = this.getStyle('code');
      const proceduralRuledPaper = this.isCanvas3DSectionBackgroundProceduralChainEnabled();
      const bakedRuledPaper = this.isCanvas3DSectionBackgroundBakedRuledLines();
      const surfaceBg = this.resolveCanvas3DSectionBackground();
      const borderStyle = this.getStyle('border');

      // If the 3D shader (procedural) or this path (baked) will draw paper,
      // keep the section texture background transparent so paper shows through.
      const mdBg = (proceduralRuledPaper || bakedRuledPaper) ? this.withAlpha(surfaceBg, 0) : surfaceBg;

      const mdStyle: MarkdownStyle = {
        fg: base.fg,
        mutedFg: dim.fg,
        headingFg: heading.fg,
        linkFg: link.fg,
        codeFg: code.fg,
        codeBg: code.bg,
        bg: mdBg,
      };

      const title = (layout.displayTitle || layout.sectionTitle || '').trim();
      const content = (layout.content || '').trim();
      const markdown = `# ${title}\n\n${content}`.trim();

      const nodes = parseMarkdownLite(markdown);
      const result = layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: widthPx, height: heightPx },
        { charW, charH },
        mdStyle,
        0,
        texturePadding
      );

      // Draw ops into the Canvas2D surface
      ctx.clearRect(0, 0, widthPx, heightPx);
      if (bakedRuledPaper) {
        // Use a subtle line color derived from the theme.
        const ruledLine = this.withAlpha(dim.fg, 0x40);
        this.drawRuledLines2D(ctx, widthPx, heightPx, surfaceBg, ruledLine, baseLineHeight, texturePadding);
      }
      for (const op of result.ops) {
        if (op.kind === 'rect') {
          ctx.fillStyle = ColorUtils.toCss(op.color as any);
          ctx.fillRect(op.x, op.y, op.w, op.h);
        } else {
          ctx.fillStyle = ColorUtils.toCss(op.color as any);
          ctx.fillText(op.text, op.x, op.y);
        }
      }

      // Border on top (matches previous Canvas2D look)
      const borderEnabled = this.canvas3DConfig.sectionBorderEnabled !== false;
      const borderWidth = Math.max(0, Math.round(this.canvas3DConfig.sectionBorderWidth ?? 2));
      if (borderEnabled && borderWidth > 0) {
        ctx.strokeStyle = ColorUtils.toCss(borderStyle.fg);
        ctx.lineWidth = borderWidth;
        const inset = borderWidth / 2;
        ctx.strokeRect(inset, inset, widthPx - borderWidth, heightPx - borderWidth);
      }

      // Create GPU texture + upload
      const texture = device.createTexture({
        size: { width: widthPx, height: heightPx },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      try {
        device.queue.copyExternalImageToTexture(
          { source: canvas },
          { texture },
          { width: widthPx, height: heightPx }
        );
      } catch {
        // Fallback path for implementations that don't accept OffscreenCanvas directly.
        const bitmap = canvas.transferToImageBitmap();
        device.queue.copyExternalImageToTexture(
          { source: bitmap },
          { texture },
          { width: widthPx, height: heightPx }
        );
        bitmap.close();
      }

      layout.texture = texture;
      this.sectionTextureCache.set(layout.sectionIndex, { width: widthPx, height: heightPx });
      this.sectionLinkRegionsCache.set(layout.sectionIndex, result.linkRegions);
    }
  }

  private clear3DSectionTextures(): void {
    for (const layout of this.section3DLayouts) {
      if (layout.texture) {
        try {
          layout.texture.destroy();
        } catch {
          // ignore
        }
        layout.texture = null;
      }
      layout.highlightUvRect = undefined;
    }
    this.sectionTextureCache.clear();
    this.sectionLinkRegionsCache.clear();
    this.hovered3DLink = null;
    this.focused3DLink = null;
  }

  private parseHexColorToPackedColor(hex: string): Color | null {
    const s = hex.trim();
    if (!s.startsWith('#')) return null;
    const h = s.slice(1);
    if (!(h.length === 6 || h.length === 8)) return null;

    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) : 0xFF;
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF);
  }

  private withAlpha(color: Color, alphaByte: number): Color {
    const a = Math.max(0, Math.min(255, Math.round(alphaByte)));
    return ((color as any) & 0xFFFFFF00) | (a & 0xFF);
  }

  private parseCanvas3DSectionBackgroundChain(): string[] {
    const v: any = (this.canvas3DConfig as any).sectionBackground;
    if (typeof v !== 'string') return [];
    const trimmed = v.trim();
    if (!trimmed) return [];

    const separators = ['+', ';', ',', '|'];
    for (const sep of separators) {
      if (trimmed.includes(sep)) {
        return trimmed
          .split(sep)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    return [trimmed.toLowerCase()];
  }

  private isCanvas3DSectionBackgroundProceduralChainEnabled(): boolean {
    const chain = this.parseCanvas3DSectionBackgroundChain();

    const hasRuledLines = chain.includes('ruledlines') || chain.includes('ruled-lines') || chain.includes('ruled_lines');
    const hasPaper = chain.includes('paper');
    return hasRuledLines || hasPaper;
  }

  private isCanvas3DSectionBackgroundBakedRuledLines(): boolean {
    const v: any = (this.canvas3DConfig as any).sectionBackground;
    if (typeof v !== 'string') return false;
    const key = v.trim().toLowerCase();
    return key === 'ruledlines-baked' || key === 'ruledlines_baked' || key === 'ruledlinesbaked';
  }

  private drawRuledLines2D(
    ctx: OffscreenCanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    paperColor: Color,
    lineColor: Color,
    lineSpacingPx: number,
    texturePadding: number
  ): void {
    ctx.fillStyle = ColorUtils.toCss(paperColor as any);
    ctx.fillRect(0, 0, widthPx, heightPx);

    const spacing = Math.max(6, Math.round(lineSpacingPx));
    const thickness = 1;
    // Place lines roughly under the text baseline for a “paper” look.
    const startY = Math.max(0, Math.round(texturePadding + spacing - 3));

    ctx.fillStyle = ColorUtils.toCss(lineColor as any);
    for (let y = startY; y < heightPx; y += spacing) {
      ctx.fillRect(0, y, widthPx, thickness);
    }
  }

  private resolveCanvas3DSectionBackground(): Color {
    const v: any = (this.canvas3DConfig as any).sectionBackground;

    // Default: match the theme's elevated surface color (existing behavior).
    if (v === undefined || v === null || v === 'surface') {
      return this.getStyle('surface').bg;
    }

    if (typeof v === 'number') {
      return v as Color;
    }

    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) {
        return this.getStyle('surface').bg;
      }

      const hex = this.parseHexColorToPackedColor(trimmed);
      if (hex !== null) {
        return hex;
      }

      const key = trimmed.toLowerCase();
      switch (key) {
        case 'ruledlines':
        case 'ruled-lines':
        case 'ruled_lines':
          return this.getStyle('surface').bg;
        case 'ruledlines-baked':
        case 'ruledlines_baked':
        case 'ruledlinesbaked':
          return this.getStyle('surface').bg;
        case 'bg':
        case 'background':
          return this.currentTheme.bg;
        case 'bgalt':
        case 'bg_alt':
        case 'bgsecondary':
        case 'bg_secondary':
          return this.currentTheme.bgAlt;
        case 'fg':
        case 'foreground':
          return this.currentTheme.fg;
        case 'fgalt':
        case 'fg_alt':
        case 'fgsecondary':
        case 'fg_secondary':
          return this.currentTheme.fgAlt;
        case 'accent1':
        case 'primary':
          return this.currentTheme.accent1;
        case 'accent2':
        case 'secondary':
          return this.currentTheme.accent2;
        case 'accent3':
        case 'tertiary':
          return this.currentTheme.accent3;
        default:
          return this.getStyle('surface').bg;
      }
    }

    // Legacy object format ({r,g,b,a?})
    return ColorUtils.from(v);
  }

  private ensure3DSectionTexturesWebGPUUI(device: GPUDevice): void {
    if (!(this.renderer instanceof WebGPURenderer)) return;
    if (!this.canvas3DEnabled || !this.camera3D) return;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const aspect = canvasW > 0 && canvasH > 0 ? canvasW / canvasH : 1;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    const atlas = this.renderer.getAtlas();
    const charW = atlas ? atlas.getCharWidth() : 10;
    const charH = atlas ? atlas.getCharHeight() : 16;
    const texturePadding = 12;
    const baseLineHeight = Math.max(1, Math.round(charH * 1.25));

    if (!this.sectionWebGPUUIRenderer) {
      // Internal texture is unused for this renderer; we only use flushTo().
      this.sectionWebGPUUIRenderer = new WebGPUUIRenderer(device, atlas, 1, 1);
    }

    const ui = this.sectionWebGPUUIRenderer;
    const format = ui.getTextureFormat();

    // Derive markdown styling from the active theme stylesheet.
    // (Theme colors are packed 0xRRGGBBAA, compatible with UI renderer.)
    const base = this.getStyle('default');
    const dim = this.getStyle('dim');
    const heading = this.getStyle('heading');
    const link = this.getStyle('link');
    const code = this.getStyle('code');
    const proceduralRuledPaper = this.isCanvas3DSectionBackgroundProceduralChainEnabled();
    const bakedRuledPaper = this.isCanvas3DSectionBackgroundBakedRuledLines();
    const surfaceBg = this.resolveCanvas3DSectionBackground();
    const borderStyle = this.getStyle('border');

    const mdBg = (proceduralRuledPaper || bakedRuledPaper) ? this.withAlpha(surfaceBg, 0) : surfaceBg;

    const style: MarkdownStyle = {
      fg: base.fg,
      mutedFg: dim.fg,
      headingFg: heading.fg,
      linkFg: link.fg,
      codeFg: code.fg,
      codeBg: code.bg,
      // Give 3D cards a panel-like background; matches theme elevated surfaces.
      bg: mdBg,
    };

    const borderEnabled = this.canvas3DConfig.sectionBorderEnabled !== false;
    const borderWidth = Math.max(0, Math.round(this.canvas3DConfig.sectionBorderWidth ?? 2));

    for (const layout of this.section3DLayouts) {
      if (!layout.visible) continue;

      // Skip texture work if the card is entirely offscreen.
      if (!this.is3DCardPossiblyVisible(viewProj, layout)) {
        continue;
      }

      const minW = 256;
      const minH = 128;
      const maxW = 1024;
      const maxH = 1024;

      const desiredW = Math.round(layout.width * charW + texturePadding * 2);
      const desiredH = Math.round(layout.height * baseLineHeight + texturePadding * 2);

      const widthPx = Math.max(minW, Math.min(maxW, desiredW));
      const heightPx = Math.max(minH, Math.min(maxH, desiredH));

      const existing = this.sectionTextureCache.get(layout.sectionIndex);
      if (existing && existing.width === widthPx && existing.height === heightPx && layout.texture) {
        // Texture already matches current size; ensure link regions are present.
        if (!this.sectionLinkRegionsCache.has(layout.sectionIndex)) {
          const title = (layout.displayTitle || layout.sectionTitle || '').trim();
          const content = (layout.content || '').trim();
          const markdown = `# ${title}\n\n${content}`.trim();
          const nodes = parseMarkdownLite(markdown);
          const result = layoutMarkdownDocument(
            nodes,
            { x: 0, y: 0, width: widthPx, height: heightPx },
            { charW, charH },
            style,
            0,
            texturePadding
          );
          this.sectionLinkRegionsCache.set(layout.sectionIndex, result.linkRegions);
        }
        continue;
      }

      // If we need to regenerate, destroy the old texture first.
      if (layout.texture) {
        try {
          layout.texture.destroy();
        } catch {
          // ignore
        }
        layout.texture = null;
      }

      const texture = device.createTexture({
        size: { width: widthPx, height: heightPx },
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      const title = (layout.displayTitle || layout.sectionTitle || '').trim();
      const content = (layout.content || '').trim();
      const markdown = `# ${title}\n\n${content}`.trim();

      const nodes = parseMarkdownLite(markdown);
      const result = layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: widthPx, height: heightPx },
        { charW, charH },
        style,
        0,
        texturePadding
      );

      this.sectionLinkRegionsCache.set(layout.sectionIndex, result.linkRegions);

      // Replay ops into UI renderer and render into this section texture.
      ui.clearCommands();

      if (bakedRuledPaper) {
        const ruledLine = this.withAlpha(dim.fg, 0x40) as any;
        ui.rect(0, 0, widthPx, heightPx, surfaceBg as any);

        const spacing = Math.max(6, Math.round(baseLineHeight));
        const thickness = 1;
        const startY = Math.max(0, Math.round(texturePadding + spacing - 3));
        for (let y = startY; y < heightPx; y += spacing) {
          ui.rect(0, y, widthPx, thickness, ruledLine);
        }
      }
      for (const op of result.ops) {
        if (op.kind === 'rect') {
          ui.rect(op.x, op.y, op.w, op.h, op.color as any);
        } else {
          ui.text(op.text, op.x, op.y, op.color as any);
        }
      }

      if (borderEnabled && borderWidth > 0) {
        const bw = Math.max(1, borderWidth);
        const c = borderStyle.fg as any;
        ui.rect(0, 0, widthPx, bw, c);
        ui.rect(0, heightPx - bw, widthPx, bw, c);
        ui.rect(0, 0, bw, heightPx, c);
        ui.rect(widthPx - bw, 0, bw, heightPx, c);
      }

      ui.flushTo(texture, widthPx, heightPx, { clear: { r: 0, g: 0, b: 0, a: 0 } });

      layout.texture = texture;
      this.sectionTextureCache.set(layout.sectionIndex, { width: widthPx, height: heightPx });
    }
  }

  /**
   * Update phase - call user's update handler
   */
  private update(): void {
    // Update modules first
    this.moduleLoader.update(this.deltaTime);

    // Built-in 3D controls (useful for testing picking/navigation)
    if (this.canvas3DEnabled && this.canvas3DControlsEnabled && this.camera3D) {
      const dt = this.deltaTime;
      const moveSpeed = 120; // world units / second
      const lookSpeed = 1.6; // radians / second

      const applyMove = (dx: number, dy: number, dz: number) => {
        this.camera3D!.position.x += dx;
        this.camera3D!.position.y += dy;
        this.camera3D!.position.z += dz;
        if (this.camera3D!.target) {
          this.camera3D!.target.x += dx;
          this.camera3D!.target.y += dy;
          this.camera3D!.target.z += dz;
        }
      };

      // Movement in XY plane: WASD (arrow keys reserved for link navigation)
      if (this.input.isKeyDown('w') || this.input.isKeyDown('W')) {
        applyMove(0, moveSpeed * dt, 0);
      }
      if (this.input.isKeyDown('s') || this.input.isKeyDown('S')) {
        applyMove(0, -moveSpeed * dt, 0);
      }
      if (this.input.isKeyDown('a') || this.input.isKeyDown('A')) {
        applyMove(-moveSpeed * dt, 0, 0);
      }
      if (this.input.isKeyDown('d') || this.input.isKeyDown('D')) {
        applyMove(moveSpeed * dt, 0, 0);
      }

      // QE = look left/right (yaw)
      if (this.input.isKeyDown('q') || this.input.isKeyDown('Q')) {
        this.camera3D.rotation.y -= lookSpeed * dt;
      }
      if (this.input.isKeyDown('e') || this.input.isKeyDown('E')) {
        this.camera3D.rotation.y += lookSpeed * dt;
      }

      // Right-drag mouse-look
      const rmbDown = this.input.isMouseDown(2);
      const mx = this.input.getMouseX();
      const my = this.input.getMouseY();
      if (rmbDown) {
        if (!this.mouseLookActive) {
          this.mouseLookActive = true;
          this.mouseLookLastX = mx;
          this.mouseLookLastY = my;
        } else {
          const dx = mx - this.mouseLookLastX;
          const dy = my - this.mouseLookLastY;
          this.mouseLookLastX = mx;
          this.mouseLookLastY = my;

          const sensitivity = 0.003; // radians / pixel
          this.camera3D.rotation.y += dx * sensitivity;
          this.camera3D.rotation.x += dy * sensitivity;

          // Clamp pitch to avoid flipping
          const limit = Math.PI / 2 - 0.01;
          if (this.camera3D.rotation.x > limit) this.camera3D.rotation.x = limit;
          if (this.camera3D.rotation.x < -limit) this.camera3D.rotation.x = -limit;
        }
      } else {
        this.mouseLookActive = false;
      }
    }
    
    // Update 3D camera (easing)
    if (this.camera3D && this.canvas3DEnabled) {
      updateCamera3D(this.camera3D, this.deltaTime);
    }
    
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

      // Resize Canvas3D render targets (offscreen) and keep compositor layer in sync.
      if (this.canvas3DRenderer) {
        this.canvas3DRenderer.resize(this.canvas.width, this.canvas.height);
        const renderTexture = this.canvas3DRenderer.getRenderTexture();
        if (renderTexture) {
          this.compositor.updateLayerTexture('3d', renderTexture);
        }

        // Re-frame the focused section for the new aspect ratio.
        this.refocus3DForCurrentViewport();
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

  private isTruthyDropTarget(value: any): boolean {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === 'yes' || v === '1' || v === 'on';
    }
    return !!value;
  }

  /**
   * Returns true if the active document opts into generic file drops.
   * Uses frontmatter `dropTarget: true` (tStorie parity).
   */
  isDropTargetEnabled(): boolean {
    const doc = this.getActiveDocument();
    if (!doc) return false;

    // Prefer parsed frontmatter captured at load time when available.
    const fromDoc = (doc as any).metadata?.dropTarget;
    if (fromDoc !== undefined) return this.isTruthyDropTarget(fromDoc);

    // Fallback: read from the persistent scope (frontmatter is seeded into scope).
    const scope = this.sandbox.getScope(doc.id);
    return this.isTruthyDropTarget((scope as any)?.dropTarget);
  }

  private isMarkdownFile(file: File): boolean {
    const name = String(file?.name ?? '').toLowerCase();
    const type = String((file as any)?.type ?? '').toLowerCase();
    if (name.endsWith('.md') || name.endsWith('.markdown')) return true;
    if (type.includes('text/markdown')) return true;
    return false;
  }

  private dispatchDroppedFile(payload: DroppedFile): void {
    this.lastDroppedFile = payload;

    const doc = this.getActiveDocument();
    if (!doc?.handlers?.drop) return;

    try {
      doc.handlers.drop(payload);
    } catch (error) {
      console.error('Error in drop handler:', error);
    }
  }

  private async handleDroppedFile(file: File): Promise<void> {
    if (!file) return;

    if (Number.isFinite(this.maxDropBytes) && file.size > this.maxDropBytes) {
      console.warn(
        `[drop] Ignoring dropped file "${file.name}" (${file.size} bytes) over maxDropBytes=${this.maxDropBytes}`
      );
      return;
    }

    if (!this.isDropTargetEnabled()) {
      // Default behavior: dropped markdown loads as a new story.
      if (this.isMarkdownFile(file)) {
        const markdown = await file.text();
        await this.loadMarkdown(file.name || 'dropped.md', markdown);
      }
      return;
    }

    // Pass-through behavior: apps/demos opt in and receive raw bytes.
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const payload: DroppedFile = {
      name: file.name || 'dropped',
      size: bytes.byteLength,
      mime: file.type || 'application/octet-stream',
      bytes,
      lastModified: (file as any).lastModified
    };
    this.dispatchDroppedFile(payload);
  }

  private async handleDropEvent(e: DragEvent): Promise<void> {
    const dt = e.dataTransfer;
    if (!dt) return;

    const files = dt.files;
    if (files && files.length > 0) {
      await this.handleDroppedFile(files[0]);
      return;
    }

    // Text drops (e.g. dragging a selection) follow default behavior.
    const text = dt.getData('text/markdown') || dt.getData('text/plain');
    if (text && !this.isDropTargetEnabled()) {
      await this.loadMarkdown('dropped', text);
    }
  }

  /**
   * Install DOM drag/drop listeners.
   * Behavior:
   * - If active doc has `dropTarget: true`: pass dropped files to `on:drop` / `scope.drop`.
   * - Otherwise: dropped markdown loads as a new story.
   */
  installDropHandling(element: HTMLElement = document.body): () => void {
    if (this.dropHandlingCleanup) return this.dropHandlingCleanup;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDragOver = (e: DragEvent) => {
      prevent(e);
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (e: DragEvent) => {
      prevent(e);
      void this.handleDropEvent(e);
    };

    element.addEventListener('dragenter', prevent);
    element.addEventListener('dragover', onDragOver);
    element.addEventListener('dragleave', prevent);
    element.addEventListener('drop', onDrop);

    const cleanup = () => {
      element.removeEventListener('dragenter', prevent);
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', prevent);
      element.removeEventListener('drop', onDrop);
      if (this.dropHandlingCleanup === cleanup) this.dropHandlingCleanup = null;
    };

    this.dropHandlingCleanup = cleanup;
    return cleanup;
  }

  /**
   * Handle keyboard events for on:input
   */
  private handleKeyEvent(e: KeyboardEvent, action: 'press' | 'release'): void {
    const doc = this.getActiveDocument();

    // Built-in 3D link navigation (canvas.nim parity)
    let handledBy3D = false;
    if (action === 'press' && this.canvas3DEnabled && this.camera3D) {
      if (e.key === 'Tab') {
        this.move3DLinkFocus(e.shiftKey ? -1 : 1);
        handledBy3D = true;
      } else if (e.key === 'Enter') {
        this.activateFocused3DLink();
        handledBy3D = true;
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        this.move3DLinkFocus(1);
        handledBy3D = true;
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        this.move3DLinkFocus(-1);
        handledBy3D = true;
      }
    }

    if (doc?.handlers?.input) {
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

      this.inputDispatchDepth++;
      try {
        const shouldContinue = doc.handlers.input(event);
        // Only stop if handler explicitly returns false (undefined = continue)
        if (shouldContinue === false) {
          this.stop();
        }
      } catch (error) {
        console.error('Error in input handler:', error);
      } finally {
        this.inputDispatchDepth = Math.max(0, this.inputDispatchDepth - 1);
      }
    }

    if (handledBy3D || doc?.handlers?.input) {
      e.preventDefault();
    }
  }

  /**
   * Handle mouse button events for on:input
   */
  private handleMouseEvent(e: MouseEvent, action: 'press' | 'release'): void {
    const doc = this.getActiveDocument();

    const rect = this.canvas.getBoundingClientRect();
    
    // Get CSS coordinates
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    
    // Scale to canvas backing store coordinates (handles HiDPI/CSS scaling)
    const pixelX = cssX * (this.canvas.width / rect.width);
    const pixelY = cssY * (this.canvas.height / rect.height);
    
    // Update InputManager's mouse position so mouseX/mouseY globals reflect click position
    this.input.updateMousePosition(pixelX, pixelY);

    // Built-in 3D picking/navigation: click a section card to focus camera.
    // This runs even if the document doesn't define an on:input handler.
    if (action === 'press' && e.button === 0) {
      const picked = this.pick3DAt(pixelX, pixelY);
      if (picked && this.camera3D) {
        const linkHit = this.hitTest3DLinkAtUV(picked.layout.sectionIndex, picked.u, picked.v);
        if (linkHit) {
          this.focused3DLink = { sectionIndex: picked.layout.sectionIndex, linkIndex: linkHit.linkIndex };
          this.activate3DLink(linkHit.region.url);
        } else {
          this.setCurrent3DSection(picked.layout.sectionIndex);
          const aspect = this.canvas.width > 0 && this.canvas.height > 0
            ? this.canvas.width / this.canvas.height
            : 1;
          focusOnSectionFit(this.camera3D, picked.layout, aspect, 0.9, { min: 60, max: 400 });
        }
      }
    }
    
    // Calculate character size in backing store pixels (same coordinate system as pixelX/pixelY)
    const charWidth = this.canvas.width / this.width;
    const charHeight = this.canvas.height / this.height;
    const cellX = Math.floor(pixelX / charWidth);
    const cellY = Math.floor(pixelY / charHeight);

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
      x: pixelX,     // Pixel coordinates (primary)
      y: pixelY,
      cellX,         // Cell coordinates (for TUI)
      cellY,
      mods
    };

    try {
      if (doc?.handlers?.input) {
        const shouldContinue = doc.handlers.input(event);
        // Only stop if handler explicitly returns false (undefined = continue)
        if (shouldContinue === false) {
          this.stop();
        }
      }
      e.preventDefault();
    } catch (error) {
      console.error('Error in input handler:', error);
    }
  }

  private pick3DAt(
    pixelX: number,
    pixelY: number
  ): { layout: Section3DLayout; u: number; v: number } | null {
    if (!this.canvas3DEnabled || !this.camera3D) return null;
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return null;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return null;

    const ndcX = (pixelX / canvasW) * 2 - 1;
    const ndcY = 1 - (pixelY / canvasH) * 2;

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);
    const invViewProj = mat4Invert(viewProj);
    if (!invViewProj) return null;

    // Build a world-space ray from NDC.
    const nearWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: -1 });
    const farWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: 1 });
    const rayDirWorld = vec3Normalize(vec3Sub(farWorld, nearWorld));

    let best: { layout: Section3DLayout; dist: number; u: number; v: number } | null = null;

    for (const layout of this.section3DLayouts) {
      if (!layout.visible || !layout.texture) continue;

      // Match renderer's model matrix: apply width/height into scale.
      const sectionTransform = {
        position: layout.transform.position,
        rotation: layout.transform.rotation,
        scale: {
          x: layout.transform.scale.x * layout.width,
          y: layout.transform.scale.y * layout.height,
          z: layout.transform.scale.z,
        },
      };

      const model = mat4FromTransform(sectionTransform as any);
      const invModel = mat4Invert(model);
      if (!invModel) continue;

      const rayOriginLocal = mat4TransformPoint(invModel, nearWorld);
      const rayDirLocal = vec3Normalize(mat4TransformDirection(invModel, rayDirWorld));

      const denom = rayDirLocal.z;
      if (Math.abs(denom) < 1e-6) continue;

      const t = -rayOriginLocal.z / denom;
      if (t <= 0) continue;

      const hitLocal = vec3Add(rayOriginLocal, vec3Scale(rayDirLocal, t));

      // Quad in local space spans [-0.5, 0.5] in X and Y.
      if (hitLocal.x < -0.5 || hitLocal.x > 0.5 || hitLocal.y < -0.5 || hitLocal.y > 0.5) {
        continue;
      }

      // Map local hit point to UVs.
      // Local (-0.5,-0.5) => UV(0,1); Local (-0.5,0.5) => UV(0,0)
      const u = hitLocal.x + 0.5;
      const v = 0.5 - hitLocal.y;

      const hitWorld = mat4TransformPoint(model, hitLocal);
      const dist = vec3Length(vec3Sub(hitWorld, nearWorld));
      if (!best || dist < best.dist) {
        best = { layout, dist, u, v };
      }
    }

    return best ? { layout: best.layout, u: best.u, v: best.v } : null;
  }

  private hitTest3DLinkAtUV(
    sectionIndex: number,
    u: number,
    v: number
  ): { linkIndex: number; region: LinkRegion } | null {
    const dims = this.sectionTextureCache.get(sectionIndex);
    const regions = this.sectionLinkRegionsCache.get(sectionIndex);
    if (!dims || !regions || regions.length === 0) return null;

    const xPx = u * dims.width;
    const yPx = v * dims.height;

    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (xPx >= r.x && xPx <= r.x + r.w && yPx >= r.y && yPx <= r.y + r.h) {
        return { linkIndex: i, region: r };
      }
    }
    return null;
  }

  private get3DLinkUvRect(
    sectionIndex: number,
    linkIndex: number
  ): { uMin: number; vMin: number; uMax: number; vMax: number } | null {
    const dims = this.sectionTextureCache.get(sectionIndex);
    const regions = this.sectionLinkRegionsCache.get(sectionIndex);
    if (!dims || !regions) return null;
    const r = regions[linkIndex];
    if (!r) return null;
    return {
      uMin: r.x / dims.width,
      vMin: r.y / dims.height,
      uMax: (r.x + r.w) / dims.width,
      vMax: (r.y + r.h) / dims.height,
    };
  }

  private activateFocused3DLink(): void {
    const focused = this.focused3DLink;
    if (!focused) return;
    const regions = this.sectionLinkRegionsCache.get(focused.sectionIndex);
    const region = regions ? regions[focused.linkIndex] : undefined;
    if (!region) return;
    this.activate3DLink(region.url);
  }

  private move3DLinkFocus(delta: number): void {
    const links = this.getVisible3DLinks();
    if (links.length === 0) {
      this.focused3DLink = null;
      return;
    }

    const cur = this.focused3DLink;
    let idx = -1;
    if (cur) {
      idx = links.findIndex(l => l.sectionIndex === cur.sectionIndex && l.linkIndex === cur.linkIndex);
    }

    const next = ((idx >= 0 ? idx : 0) + delta + links.length) % links.length;
    const sel = links[next];
    this.focused3DLink = { sectionIndex: sel.sectionIndex, linkIndex: sel.linkIndex };
  }

  private activate3DLink(url: string): void {
    if (!url) return;

    // Internal link: #anchor
    if (url.startsWith('#')) {
      const target = decodeURIComponent(url.slice(1)).trim();
      if (!target || !this.camera3D) return;

      const slugify = (s: string) =>
        s
          .toLowerCase()
          .trim()
          .replace(/[`*_~]/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

      const targetSlug = slugify(target);
      const layout = this.section3DLayouts.find(l => {
        const title = (l.displayTitle || l.sectionTitle || '').trim();
        return slugify(title) === targetSlug;
      });

      if (layout) {
        this.setCurrent3DSection(layout.sectionIndex);
        const aspect = this.canvas.width > 0 && this.canvas.height > 0
          ? this.canvas.width / this.canvas.height
          : 1;
        focusOnSectionFit(this.camera3D, layout, aspect, 0.9, { min: 60, max: 400 });
      }
      return;
    }

    // External link
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        // ignore
      }
    }
  }

  private get3DCardModelMatrix(layout: Section3DLayout): Float32Array {
    const sectionTransform = {
      position: layout.transform.position,
      rotation: layout.transform.rotation,
      scale: {
        x: layout.transform.scale.x * layout.width,
        y: layout.transform.scale.y * layout.height,
        z: layout.transform.scale.z,
      },
    };
    return mat4FromTransform(sectionTransform as any);
  }

  private request3DCameraFocus(
    req:
      | { kind: 'focus'; sectionIndex: number | string; distance: number }
      | { kind: 'fit'; sectionIndex: number | string; fill: number }
  ): void {
    // If layouts aren’t ready yet (common during on:init), remember the intent
    // and apply it once parsing/layout generation completes.
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) {
      this.pending3DCameraFocus = req;
      return;
    }

    if (!this.camera3D) return;

    const idx = this.resolve3DSectionIndex(req.sectionIndex);
    if (idx === null) {
      console.warn(`Section "${String(req.sectionIndex)}" not found`);
      return;
    }
    const layout = this.section3DLayouts[idx];
    if (!layout) {
      console.warn(`Section ${String(req.sectionIndex)} not found`);
      return;
    }

    this.setCurrent3DSection(layout.sectionIndex);

    // Remember last applied focus (use resolved numeric section index).
    if (req.kind === 'focus') {
      this.lastApplied3DCameraFocus = {
        kind: 'focus',
        sectionIndex: layout.sectionIndex,
        distance: req.distance
      };
    } else {
      this.lastApplied3DCameraFocus = {
        kind: 'fit',
        sectionIndex: layout.sectionIndex,
        fill: req.fill
      };
    }

    if (req.kind === 'focus') {
      focusOnSection(this.camera3D, layout, req.distance);
    } else {
      const aspect = this.canvas.width > 0 && this.canvas.height > 0
        ? this.canvas.width / this.canvas.height
        : 1;
      focusOnSectionFit(this.camera3D, layout, aspect, req.fill);
    }
  }

  private refocus3DForCurrentViewport(): void {
    if (!this.canvas3DEnabled || !this.camera3D) return;
    if (!this.lastApplied3DCameraFocus) return;

    const layout = this.section3DLayouts.find(l => l.sectionIndex === this.lastApplied3DCameraFocus!.sectionIndex);
    if (!layout) return;

    if (this.lastApplied3DCameraFocus.kind === 'focus') {
      focusOnSection(this.camera3D, layout, this.lastApplied3DCameraFocus.distance);
    } else {
      const aspect = this.canvas.width > 0 && this.canvas.height > 0
        ? this.canvas.width / this.canvas.height
        : 1;
      focusOnSectionFit(this.camera3D, layout, aspect, this.lastApplied3DCameraFocus.fill);
    }
  }

  private applyPending3DCameraFocus(): void {
    if (!this.pending3DCameraFocus) return;
    const req = this.pending3DCameraFocus;
    this.pending3DCameraFocus = null;
    this.request3DCameraFocus(req);
  }

  private setCurrent3DSection(sectionIndex: number): void {
    if (this.current3DSectionIndex === sectionIndex) return;
    this.current3DSectionIndex = sectionIndex;
    this.runSectionEnterHandlers(sectionIndex);
  }

  private runSectionEnterHandlers(sectionIndex: number): void {
    const doc = this.getActiveDocument() as any;
    if (!doc?.id) return;

    const scope = this.sandbox.getScope(doc.id) as any;
    const handler = scope?.__enterHandlers?.[sectionIndex];
    if (typeof handler !== 'function') return;

    try {
      handler();
    } catch (error) {
      console.error('Error in on:enter handler:', error);
    }
  }

  private resolve3DSectionIndex(selector: number | string): number | null {
    if (typeof selector === 'number' && Number.isFinite(selector)) {
      return selector;
    }
    if (typeof selector !== 'string') return null;
    const query = selector.trim();
    if (!query) return null;

    const slugify = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/\{[^}]*\}\s*$/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    const want = slugify(query);
    const exact = this.section3DLayouts.find(l => {
      const title = (l.displayTitle || l.sectionTitle || '').trim();
      return slugify(title) === want;
    });
    return exact ? exact.sectionIndex : null;
  }

  private findSectionIndexForLine(sections: any[], line: number): number | null {
    // Mirrors createSection3DLayouts() traversal order and returns the deepest
    // section that contains the given line.
    let sectionIndex = 0;
    let best: number | null = null;

    const visit = (list: any[]) => {
      for (const s of list) {
        const idx = sectionIndex;
        sectionIndex++;

        if (typeof s.startLine === 'number' && typeof s.endLine === 'number') {
          if (line >= s.startLine && line <= s.endLine) {
            best = idx;
            if (Array.isArray(s.children) && s.children.length > 0) {
              visit(s.children);
            }
          }
        }

        // If not in this section, still need to advance over children indices
        // (since createSection3DLayouts includes them).
        if (!(line >= s.startLine && line <= s.endLine)) {
          if (Array.isArray(s.children) && s.children.length > 0) {
            visit(s.children);
          }
        }
      }
    };

    visit(sections);
    return best;
  }

  private applyCanvas3DLayoutCallback(sections?: any[]): void {
    if (!this.canvas3DLayoutCallback) return;
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;

    const order: any[] = [];
    const walk = (list: any[]) => {
      for (const s of list) {
        order.push(s);
        if (Array.isArray(s.children) && s.children.length > 0) walk(s.children);
      }
    };

    const doc = sections
      ? { sections }
      : ((this.getActiveDocument() as any)?.sections ? { sections: (this.getActiveDocument() as any).sections } : null);
    if (!doc?.sections) return;
    walk(doc.sections);

    for (let i = 0; i < Math.min(order.length, this.section3DLayouts.length); i++) {
      const layout = this.section3DLayouts[i];
      if (!layout) continue;

      try {
        const out = this.canvas3DLayoutCallback({
          sectionIndex: layout.sectionIndex,
          title: String(layout.displayTitle || layout.sectionTitle || ''),
          layout,
        });

        if (!out) continue;

        if (out.position) {
          layout.transform.position = { ...out.position };
        }
        if (out.rotation) {
          // Callback rotation is degrees (matches setSectionTransform API)
          layout.transform.rotation = {
            x: (out.rotation.x * Math.PI) / 180,
            y: (out.rotation.y * Math.PI) / 180,
            z: (out.rotation.z * Math.PI) / 180,
          };
        }
        if (out.scale) {
          layout.transform.scale = { ...out.scale };
        }
        if (typeof out.width === 'number') layout.width = out.width;
        if (typeof out.height === 'number') layout.height = out.height;
        if (typeof out.visible === 'boolean') layout.visible = out.visible;
        if (typeof out.navigable === 'boolean') layout.navigable = out.navigable;
      } catch (error) {
        console.error('[canvas3D.layout] callback error:', error);
      }
    }

    // Layout changes imply textures may need to be regenerated at different sizes.
    // Keep it simple: clear texture cache so cards re-rasterize on demand.
    this.clear3DSectionTextures();
  }

  private is3DCardPossiblyVisible(viewProj: Float32Array, layout: Section3DLayout): boolean {
    const model = this.get3DCardModelMatrix(layout);

    const corners = [
      { x: -0.5, y: -0.5, z: 0 },
      { x: 0.5, y: -0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
      { x: -0.5, y: 0.5, z: 0 },
    ];

    const clips = corners.map(c => {
      const world = mat4TransformPoint(model, c);
      return mat4TransformVec4(viewProj, world.x, world.y, world.z, 1);
    });

    const all = (pred: (p: { x: number; y: number; z: number; w: number }) => boolean) => clips.every(pred);
    if (all(p => p.x < -p.w)) return false; // left
    if (all(p => p.x > p.w)) return false; // right
    if (all(p => p.y < -p.w)) return false; // bottom
    if (all(p => p.y > p.w)) return false; // top
    // WebGPU NDC z is [0, 1] after divide; clip test is [0, w]
    if (all(p => p.z < 0)) return false; // near
    if (all(p => p.z > p.w)) return false; // far
    return true;
  }

  private getVisible3DLinks(): Array<{
    sectionIndex: number;
    linkIndex: number;
    region: LinkRegion;
    screenX: number;
    screenY: number;
  }> {
    if (!this.canvas3DEnabled || !this.camera3D) return [];

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return [];

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    const out: Array<{
      sectionIndex: number;
      linkIndex: number;
      region: LinkRegion;
      screenX: number;
      screenY: number;
    }> = [];

    for (const layout of this.section3DLayouts) {
      if (!layout.visible || !layout.texture) continue;
      if (!this.is3DCardPossiblyVisible(viewProj, layout)) continue;

      const dims = this.sectionTextureCache.get(layout.sectionIndex);
      const regions = this.sectionLinkRegionsCache.get(layout.sectionIndex);
      if (!dims || !regions || regions.length === 0) continue;

      const model = this.get3DCardModelMatrix(layout);

      for (let i = 0; i < regions.length; i++) {
        const r = regions[i];
        const u = (r.x + r.w * 0.5) / dims.width;
        const v = (r.y + r.h * 0.5) / dims.height;
        const xLocal = u - 0.5;
        const yLocal = 0.5 - v;

        const world = mat4TransformPoint(model, { x: xLocal, y: yLocal, z: 0 });
        const clip = mat4TransformVec4(viewProj, world.x, world.y, world.z, 1);
        if (clip.w <= 1e-6) continue;

        const ndcX = clip.x / clip.w;
        const ndcY = clip.y / clip.w;
        // Keep only links whose center is within screen bounds.
        if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) continue;

        const screenX = (ndcX * 0.5 + 0.5) * canvasW;
        const screenY = (1 - (ndcY * 0.5 + 0.5)) * canvasH;
        out.push({ sectionIndex: layout.sectionIndex, linkIndex: i, region: r, screenX, screenY });
      }
    }

    out.sort((a, b) => (a.screenY - b.screenY) || (a.screenX - b.screenX));
    return out;
  }

  /**
   * Handle mouse move events for on:input
   */
  private handleMouseMoveEvent(e: MouseEvent): void {
    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) return;

    const rect = this.canvas.getBoundingClientRect();
    
    // Get CSS coordinates
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    
    // Scale to canvas backing store coordinates (handles HiDPI/CSS scaling)
    const pixelX = cssX * (this.canvas.width / rect.width);
    const pixelY = cssY * (this.canvas.height / rect.height);
    
    // Update InputManager's mouse position for mouseX/mouseY globals
    this.input.updateMousePosition(pixelX, pixelY);
    
    // Calculate character size in backing store pixels (same coordinate system as pixelX/pixelY)
    const charWidth = this.canvas.width / this.width;
    const charHeight = this.canvas.height / this.height;
    const cellX = Math.floor(pixelX / charWidth);
    const cellY = Math.floor(pixelY / charHeight);

    const event: InputEvent = {
      type: 'mouse_move',
      x: pixelX,     // Pixel coordinates (primary)
      y: pixelY,
      cellX,         // Cell coordinates (for TUI)
      cellY,
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
