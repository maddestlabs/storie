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
import type { CompiledAutomation, EaseSpec, AutomationImpulseEvent } from './automation.js';

// SES adds these to globalThis
declare const lockdown: any;
declare const Compartment: any;

export interface SandboxAPI {
  // Terminal text API
  term: {
    write: (x: number, y: number, text: string, fg?: any, bg?: any) => void;
    fill: (x: number, y: number, w: number, h: number, char?: string, fg?: any, bg?: any) => void;
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

  // Drop API (binary-safe)
  drop: {
    has: () => boolean;
    name: () => string;
    size: () => number;
    mime: () => string;
    bytes: () => Uint8Array | null;
    text: (encoding?: string) => string | null;
  };

  // Document metadata API (read-only)
  // Indices match Worlds's depth-first section layout order.
  doc: {
    sectionsFlat: () => Array<{ index: number; title: string; level: number; timedMs?: number; directive?: Record<string, any> }>;
    sectionCount: () => number;
    outline: () => Array<{
      index: number;
      title: string;
      level: number;
      parentIndex: number | null;
      firstChildIndex: number | null;
      lastDescendantIndex: number;
    }>;
    /**
     * Returns all entries for a named ```timed block, sorted ascending by ms.
     * Returns [] when the block does not exist.
     */
    timedBlock: (name: string) => Array<{ ms: number; text: string }>;
    /**
     * Returns the names of every ```timed block in the current document.
     */
    timedBlocks: () => string[];
    /**
     * Returns the last entry whose `ms` timestamp is ≤ `timeSec * 1000`,
     * i.e. the lyric line that should be showing at the given audio position.
     * Returns `null` when the playhead is before the first entry.
     *
     * Example:
     *   const line = doc.atTime('lyrics', audio.currentTime);
     *   if (line) display(line.text);
     */
    atTime: (name: string, timeSec: number) => { ms: number; text: string } | null;
    /**
     * Inject or replace a named timed block's entries at runtime.
     * Useful inside `on:drop` handlers to load SRT/VTT/JSON subtitle files.
     *
     * Entries are sorted ascending by `ms` automatically.
     * Passing an empty array clears the block so it falls back to the
     * static block defined in the document (if any).
     *
     * Example:
     *   on:drop — read a .srt file, parse it, inject as 'lyrics':
     *   const entries = sys.parseTimed(new TextDecoder().decode(file.bytes));
     *   doc.setTimedBlock('lyrics', entries);
     */
    setTimedBlock: (name: string, entries: Array<{ ms: number; text: string }>) => void;
  };

  // Host Sync info (read-only)
  host: {
    enabled: boolean;
    role: 'host' | 'client' | null;
    isHost: boolean;
    isClient: boolean;
    transport: 'broadcast' | 'websocket' | null;
    channel: string | null;
  };

  // Shared scene state (synced host -> client)
  scene: {
    sectionIndex: number | null;
    revealStep: number;
    getState: () => { sectionIndex: number | null; revealStep: number };
    setRevealStep: (n: number) => void;
    nextRevealStep: () => void;
    resetRevealStep: () => void;
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
  /** True while a video export is in progress. Check this in on:init or on:update
   *  to auto-start audio or skip user-interaction gating during export. */
  readonly isExporting: boolean;
  /** Function form of isExporting (more robust under SES scoping). */
  getIsExporting: () => boolean;

  /**
   * Safely read a URL query parameter by name.
   * Returns the coerced value (number / boolean / string) or `defaultValue`
   * when the param is missing or the URL is inaccessible (e.g. inside SES).
   *
   * Examples:
   *   getParam('seed', 1337)   // → number
   *   getParam('debug', false) // → boolean
   *   getParam('name', 'hero') // → string
   */
  getParam: (name: string, defaultValue?: string | number | boolean | null) => string | number | boolean | null | undefined;

  /** Seeded / random utilities — same PRNG the engine uses internally. */
  random: {
    /** Generate a cryptographically random uint32 seed. */
    seed: () => number;
    /**
     * Create a seeded mulberry32 PRNG — identical to the engine's internal one.
     * Returns a `() => number` yielding values in [0, 1).
     */
    rng: (seed: number) => () => number;
    /**
     * Normalise a number or string to a uint32 (FNV-1a hash for strings)
     * using the same logic the engine applies before stfxr / sfx playback.
     */
    toSeed: (val: number | string) => number;
  };

  /**
   * Host system utilities. Runs in trusted context — outside the SES sandbox.
   * Safe to use for file I/O that must touch the browser environment.
   */
  sys: {
    /**
     * Trigger a browser "Save As" download with the supplied bytes.
     * The operation is invisible to the sandbox; no URL or DOM handle is returned.
     *
     * @param bytes    Raw file data to download.
     * @param filename Suggested filename shown in the browser save dialog.
     * @param mime     MIME type (defaults to 'application/octet-stream').
     *
     * Example:
     *   sys.download(modifiedMp3Bytes, 'track.mp3', 'audio/mpeg');
     */
    download: (bytes: Uint8Array, filename: string, mime?: string) => void;
    /**
     * Parse timed-text content from a string and return a sorted array of
     * `{ ms: number; text: string }` entries ready to use with
     * `doc.setTimedBlock()` or `doc.atTime()`.
     *
     * Supported formats (auto-detected when `format` is omitted):
     *   'native'  — Storie `ms|text` format (default)
     *   'srt'     — SubRip (.srt)
     *   'vtt'     — WebVTT (.vtt)
     *   'ttml'    — TTML / DFXP (.ttml)
     *   'json'    — Generic ASR JSON (Whisper, AssemblyAI, Rev.ai, Azure, Google)
     *
     * Example:
     *   const text    = new TextDecoder().decode(file.bytes);
     *   const entries = sys.parseTimed(text);          // auto-detect
     *   const entries = sys.parseTimed(text, 'srt');   // explicit
     *   doc.setTimedBlock('lyrics', entries);
     */
    parseTimed: (text: string, format?: string) => Array<{ ms: number; text: string }>;

    /**
     * Synthetic input injection.
     * Updates key/mouse state (so key.down etc reflect it) and dispatches an
     * on:input event to the current document handler.
     */
    input: {
      emit: (event: InputEvent) => void;
    };

    /**
     * Time-based automation helpers built on ```timed blocks.
     *
     * Typical usage:
     *   const track = sys.automation.compile(doc.timedBlock('events'));
     *   const v = sys.automation.valueAt(track, 'ui.zoom', sys.getTime(), 1);
     *   const impulses = sys.automation.impulsesBetween(track, prevT, nowT);
     */
    automation: {
      compile: (entries: Array<{ ms: number; text: string }>) => CompiledAutomation;
      valueAt: (compiled: CompiledAutomation, varName: string, timeSec: number, defaultValue?: number) => number;
      impulsesBetween: (compiled: CompiledAutomation, prevTimeSec: number, nowTimeSec: number) => AutomationImpulseEvent[];
      parseEase: (raw: any) => EaseSpec;
      ease: (u: number, spec?: EaseSpec) => number;
    };
  };

  // Native Browser APIs
  audio: {
    // Shared AudioContext instance
    context: AudioContext;
    startOnGesture: (start: () => void) => boolean;
    // Helpers
    playTone: (frequency: number, duration: number, volume?: number) => { osc: OscillatorNode; gain: GainNode };
    loadSoundFromDrop: () => Promise<AudioBuffer | null>;
    loadSoundFromBlob: (name: string, documentId?: string) => Promise<AudioBuffer | null>;
    playBuffer: (buffer: AudioBuffer, options?: { loop?: boolean; volume?: number; playbackRate?: number }) => AudioBufferSourceNode;
    playDrop: (options?: { loop?: boolean; volume?: number; playbackRate?: number; when?: number; destination?: AudioNode }) => Promise<AudioBufferSourceNode | null>;
    playBlob: (
      name: string,
      options?: { loop?: boolean; volume?: number; playbackRate?: number; when?: number; destination?: AudioNode },
      documentId?: string
    ) => Promise<AudioBufferSourceNode | null>;

    // Offline analysis helpers
    peaksFromBuffer: (
      buffer: AudioBuffer,
      options?: {
        windowMs?: number;
        smoothMs?: number;
        minGapMs?: number;
        thresholdMul?: number;
        minThreshold?: number;
        compressPow?: number;
        minProminence?: number;
      }
    ) => {
      peaks: number[];
      envelopeHz: number;
      envelope: Float32Array;
      threshold: number;
    };

    beatsFromBuffer: (
      buffer: AudioBuffer,
      options?: {
        bpmMin?: number;
        bpmMax?: number;
        envelopeHz?: number;
        smoothMs?: number;
        meter?: number;
        onsetMode?: 'energy' | 'spectralFlux';
        fftSize?: number;
        fftWindow?: 'hann' | 'none';
      }
    ) => {
      bpm: number;
      confidence: number;
      meter: number;
      periodSec: number;
      offsetSec: number;
      beats: number[];
      downbeats: number[];
      envelopeHz: number;
      envelope: Float32Array;
    };

    beatState: (
      analysis: {
        bpm: number;
        confidence: number;
        meter: number;
        periodSec: number;
        offsetSec: number;
        beats: number[];
        downbeats: number[];
        envelopeHz: number;
        envelope: Float32Array;
      },
      timeSec: number,
      prevTimeSec?: number
    ) => {
      bpm: number;
      meter: number;
      periodSec: number;
      offsetSec: number;
      timeSec: number;
      beatIndex: number;
      beatInBar: number;
      barIndex: number;
      beatFloat: number;
      beatPhase: number;
      barPhase: number;
      nextBeatSec: number;
      nextDownbeatSec: number;
      isBeatEdge: boolean;
      isDownbeatEdge: boolean;
    };

    // Realtime FFT/analyser helper for visualizers
    fft: {
      createAnalyser: (options?: {
        fftSize?: number;
        smoothing?: number;
        minDecibels?: number;
        maxDecibels?: number;
      }) => {
        analyser: AnalyserNode;
        binHz: () => number;
        connectFrom: (node: AudioNode) => any;
        connectTo: (node: AudioNode) => any;
        getFrequencyBytes: () => Uint8Array;
        getFrequencyFloats: () => Float32Array;
        getTimeDomainBytes: () => Uint8Array;
        getTimeDomainFloats: () => Float32Array;
        getBands: (bands: Array<{ fromHz: number; toHz: number }>) => number[];
      };
    };
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
    /** Capture an AudioBuffer for the current video export (Path A). */
    captureForExport: (buffer: AudioBuffer, offsetSec?: number) => void;

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
    /** Read the engine-latched export buffer (Path A/B) if available. */
    getCapturedForExport: () => { buffer: AudioBuffer; offsetSec: number } | null;
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
    loadBuiltInEffect: (effectName: string, shaderName?: string) => Promise<void>;
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

  // Seeded SFX graph presets embedded in markdown (from ```stfxr name:... seed:...)
  stfxr: {
    forDocument?: (documentId: string) => {
      list: () => string[];
      has: (name: string) => boolean;
      get: (name: string) => any | null;
      play: (name: string, seed?: number | string, options?: { volume?: number; when?: number }) => { stop: (when?: number) => void };
      playPreset: (preset: any, seed?: number | string, options?: { volume?: number; when?: number }) => { stop: (when?: number) => void };
      bake: (
        name: string,
        seed?: number | string,
        options?: { id?: string; seconds?: number; maxSeconds?: number }
      ) => Promise<string>;
      playBaked: (
        id: string,
        options?: { volume?: number; when?: number; playbackRate?: number }
      ) => { stop: (when?: number) => void };
      bakedList: () => string[];
      snippet: (name: string, seed?: number | string, volume?: number) => string;
    };
    list: () => string[];
    has: (name: string) => boolean;
    get: (name: string) => any | null;
    play: (name: string, seed?: number | string, options?: { volume?: number; when?: number }) => { stop: (when?: number) => void };
    playPreset: (preset: any, seed?: number | string, options?: { volume?: number; when?: number }) => { stop: (when?: number) => void };
    bake: (
      name: string,
      seed?: number | string,
      options?: { id?: string; seconds?: number; maxSeconds?: number }
    ) => Promise<string>;
    playBaked: (
      id: string,
      options?: { volume?: number; when?: number; playbackRate?: number }
    ) => { stop: (when?: number) => void };
    bakedList: () => string[];
    snippet: (name: string, seed?: number | string, volume?: number) => string;
  };
  
  // 3D Canvas API
  worlds: {
    enable: () => boolean;
    disable: () => void;
    enabled: boolean;
    available: boolean;
    currentSection: number | null;
    controls: {
      setEnabled: (enabled: boolean) => void;
      enabled: boolean;
    };

    links: {
      setKeyHandlingEnabled: (enabled: boolean) => void;
      keyHandlingEnabled: boolean;
      popActivated: () => { url: string; sectionIndex: number | null; linkIndex: number | null } | null;
    };

    nav: {
      list: (rule?: {
        scope?: 'global' | 'subtree' | 'siblings';
        depth?: 'descendants' | 'children';
        root?: 'current' | number;
        levels?: 'any' | number | { min?: number; max?: number };
        includeHidden?: boolean;
        includeNonNavigable?: boolean;
        includeSelf?: boolean;
      }) => number[];
      count: (rule?: Parameters<SandboxAPI['worlds']['nav']['list']>[0]) => number;
      cursor: (rule?: Parameters<SandboxAPI['worlds']['nav']['list']>[0]) => number | null;
      goto: (
        index: number,
        rule?: Parameters<SandboxAPI['worlds']['nav']['list']>[0] & {
          wrap?: boolean;
          mode?: 'fit' | 'focus';
          fill?: number;
          distance?: number;
        }
      ) => void;
      next: (rule?: Parameters<SandboxAPI['worlds']['nav']['goto']>[1]) => void;
      prev: (rule?: Parameters<SandboxAPI['worlds']['nav']['goto']>[1]) => void;
    };

    overview: {
      setEnabled: (
        enabled: boolean,
        options?: {
          columns?: number;
          padding?: number;
          depth?: number;
          fill?: number;
          includeHidden?: boolean;
          includeNonNavigable?: boolean;
          levels?: 'any' | number | { min?: number; max?: number };
        }
      ) => void;
      toggle: (options?: Parameters<SandboxAPI['worlds']['overview']['setEnabled']>[1]) => void;
      enabled: boolean;
    };
    camera: {
      setPosition: (x: number, y: number, z: number) => void;
      setRotation: (x: number, y: number, z: number) => void;
      moveTo: (x: number, y: number, z: number) => void;
      shake: {
        setEnabled: (enabled: boolean) => void;
        setParams: (params: {
          strength?: number;
          seed?: number;
          rate?: number;
          translate?: { x?: number; y?: number; z?: number };
          rotate?: { x?: number; y?: number; z?: number };
        }) => void;
        getParams: () => {
          enabled: boolean;
          strength: number;
          seed: number;
          rate: number;
          translate: { x: number; y: number; z: number };
          rotate: { x: number; y: number; z: number };
        };
      };
      focusOnSection: (
        sectionIndex: number | string,
        distance?: number,
        options?: {
          keepRotation?: boolean;
          positionOffset?: { x: number; y: number; z: number };
          rotationOffset?: { x: number; y: number; z: number };
        }
      ) => void;
      focusOnSectionFit: (
        sectionIndex: number | string,
        fill?: number,
        options?: {
          keepRotation?: boolean;
          positionOffset?: { x: number; y: number; z: number };
          rotationOffset?: { x: number; y: number; z: number };
        }
      ) => void;
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
        // Polling key-state map: keys.has('ArrowLeft'), keys.isDown('Space')
        keys: {
          has:      (k: string) => apiRef.key.down(k),
          isDown:   (k: string) => apiRef.key.down(k),
          pressed:  (k: string) => apiRef.key.pressed(k),
          released: (k: string) => apiRef.key.released(k),
        },
        mouse: this.api.mouse,

        // Dropped file API (binary-safe)
        drop: this.api.drop,

        // Document metadata (read-only)
        doc: (this.api as any).doc,

        // Host Sync info (read-only)
        host: (this.api as any).host,

        // Shared scene state (synced host -> client)
        scene: (this.api as any).scene,
        
        // Theme API
        getStyle: this.api.getStyle,
        theme: this.api.theme,
        
        // Module API
        modules: this.api.modules,
        
        // Native Browser APIs
        // Note: SES Compartments do not automatically inherit host globals.
        // Explicitly endow safe built-ins needed by user docs/demos.
        CompressionStream: (globalThis as any).CompressionStream,
        DecompressionStream: (globalThis as any).DecompressionStream,
        TextEncoder: (globalThis as any).TextEncoder,
        TextDecoder: (globalThis as any).TextDecoder,
        Response: (globalThis as any).Response,
        // Bind to the host global to avoid "Illegal invocation" in some runtimes.
        atob: (s: string) => (globalThis as any).atob(s),
        btoa: (s: string) => (globalThis as any).btoa(s),

          audio: (() => {
            const audioRef: any = (this.api as any).audio;
            if (!audioRef || typeof audioRef !== 'object') return audioRef;
            const audio = Object.create(audioRef);
            if (typeof audioRef.loadSoundFromBlob === 'function') {
              audio.loadSoundFromBlob = (name: string) => audioRef.loadSoundFromBlob(name, documentId);
            }
            if (typeof audioRef.playBlob === 'function') {
              audio.playBlob = (name: string, options?: any) => audioRef.playBlob(name, options, documentId);
            }
            // captureForExport must be an own-property so SES-hardened prototypes
            // don't block access from inside the Compartment.
            if (typeof audioRef.captureForExport === 'function') {
              audio.captureForExport = (buffer: any, offsetSec?: number) =>
                audioRef.captureForExport(buffer, offsetSec);
            }
            if (typeof audioRef.getCapturedForExport === 'function') {
              audio.getCapturedForExport = () => audioRef.getCapturedForExport();
            }
            return audio;
          })(),
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

        // Embedded STFXR presets (document-scoped)
        stfxr: (this.api as any).stfxr?.forDocument ? (this.api as any).stfxr.forDocument(documentId) : (this.api as any).stfxr,

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
        worlds: this.api.worlds,
        
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
        get isExporting() { return apiRef.isExporting; },
        getIsExporting: this.api.getIsExporting,

        // URL parameter helper (safe — resolved in host context before entering SES)
        getParam: this.api.getParam,

        // Seeded / random utilities (same PRNG as the engine)
        random: this.api.random,

        // Host system utilities (download, etc.) — run in trusted context
        sys: this.api.sys,

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
   * - `var x = 10;`   → `scope.x = ('x' in scope) ? scope.x : (10);`   (persists null/0/false)
   * - `let x = 10;`   → `scope.x = scope.x ?? (10);`                   (utilities / constants)
   * - `function foo() {}` → `scope.foo = function foo() {}`
   *
   * `var` uses the strict `'in scope'` guard so that null, false, 0, etc. are
   * treated as valid persisted values and are never overwritten on hot-reload.
   * `let`/`const` use `??` — they're typically utility functions / pure constants
   * where re-initialization is fine.
   *
   * This ONLY applies to raw `js` blocks (no lifecycle annotation).
   * Lifecycle blocks (on:*) are wrapped by the engine with proper
   * import/export, so local vars stay local.
   *
   * Variables inside functions, loops, etc. remain untouched (only flush-left).
   */
  private autoBindVariables(code: string): string {
    let transformedCode = code;

    // Transform ONLY top-level (flush-left) variable declarations.
    // The ^ anchor + gm flags ensure we only match at the start of lines.

    // `var NAME = value;`  →  scope-guarded with strict 'in' check (preserves null/0/false)
    transformedCode = transformedCode.replace(
      /^var\s+(\w+)\s*=\s*([^;]+);/gm,
      (_m, varName, value) => {
        console.log(`  📝 Persisting var: ${varName}`);
        return `scope.${varName} = ('${varName}' in scope) ? scope.${varName} : (${value});`;
      }
    );

    // `let/const NAME = value;`  →  nullish-coalescing (re-init is fine for constants/utilities)
    transformedCode = transformedCode.replace(
      /^(let|const)\s+(\w+)\s*=\s*([^;]+);/gm,
      (_m, _kw, varName, value) => {
        console.log(`  📝 Persisting variable: ${varName}`);
        return `scope.${varName} = scope.${varName} ?? (${value});`;
      }
    );

    // `var/let/const NAME;`  →  undefined sentinel
    transformedCode = transformedCode.replace(
      /^(let|const|var)\s+(\w+)\s*;/gm,
      (_m, _kw, varName) => {
        console.log(`  📝 Persisting variable: ${varName}`);
        return `scope.${varName} = scope.${varName} ?? undefined;`;
      }
    );

    // `function foo(...) {`  →  `scope.foo = function foo(...) {`
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
   * Walk forward from `start` in `code` and return the index of the first `;`
   * that is at bracket-depth 0 (not inside `()`, `[]`, `{}`, strings, or comments).
   * Returns `code.length` if no such semicolon is found (handles ASI / trailing
   * expressions at end of file).
   */
  private findTopLevelStatementEnd(code: string, start: number): number {
    let i = start;
    let depth = 0;
    let inLineComment = false;
    let inBlockComment = false;
    let inString: null | '"' | "'" | '`' = null;

    while (i < code.length) {
      const c  = code[i];
      const c2 = code[i + 1];

      if (inLineComment) {
        if (c === '\n') inLineComment = false;
        i++; continue;
      }

      if (inBlockComment) {
        if (c === '*' && c2 === '/') { inBlockComment = false; i += 2; continue; }
        i++; continue;
      }

      if (inString) {
        if (c === '\\') { i += 2; continue; } // escape sequence
        if (inString === '`') {
          if (c === '`') { inString = null; i++; continue; }
          if (c === '$' && c2 === '{') { depth++; i += 2; continue; } // template interpolation
        } else {
          if (c === inString) { inString = null; i++; continue; }
        }
        i++; continue;
      }

      // Not inside a string or comment.
      if (c === '/' && c2 === '/') { inLineComment = true;  i += 2; continue; }
      if (c === '/' && c2 === '*') { inBlockComment = true; i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { inString = c as any; i++; continue; }

      if (c === '(' || c === '[' || c === '{') { depth++; i++; continue; }
      if (c === ')' || c === ']' || c === '}') {
        if (depth > 0) depth--;
        i++; continue;
      }

      if (c === ';' && depth === 0) return i;

      i++;
    }

    return i; // end of input (no semicolon found)
  }

  /**
   * Rewrite top-level `var NAME = EXPR` for known scope vars so that the
   * IIFE-local binding is seeded from the already-persisted scope value on
   * hot-reload, falling back to the original expression only on first load.
   *
   * Before: `var state = { score: 0, buf: null };`
   * After:  `var state = ('state' in scope) ? scope.state : ({ score: 0, buf: null });`
   *
   * This correctly handles multiline initializers (objects, arrays, arrow fns)
   * because depth is tracked through the full expression, not per-line.
   * It also handles `null`, `false`, `0`, `''` as valid persisted values.
   *
   * Only `var` declarations are rewritten — `const`/`let` are utilities/constants
   * whose re-initialization on hot-reload is intentional.
   */
  rewriteVarsForPersistence(code: string, varNames: string[]): string {
    if (varNames.length === 0) return code;
    const names = new Set(varNames);

    const out: string[] = [];
    let i = 0;
    const n = code.length;

    while (i < n) {
      // We only attempt a rewrite at the start of a line (column 0).
      const atLineStart = i === 0 || code[i - 1] === '\n';

      if (atLineStart) {
        const remaining = code.slice(i);
        const m = /^var\s+(\w+)\s*=\s*/.exec(remaining);

        if (m && names.has(m[1])) {
          const name     = m[1];
          const exprStart = i + m[0].length;
          const stmtEnd   = this.findTopLevelStatementEnd(code, exprStart);
          const expr      = code.slice(exprStart, stmtEnd).trim();

          out.push(`var ${name} = ('${name}' in scope) ? scope.${name} : (${expr});`);

          // Advance past the semicolon, then consume the rest of the line
          // (which should be empty / just whitespace) and the newline itself.
          i = stmtEnd + 1; // skip `;`
          while (i < n && code[i] !== '\n') i++; // skip trailing whitespace on line
          if (i < n) { out.push('\n'); i++; }     // re-emit newline
          continue;
        }
      }

      out.push(code[i++]);
    }

    return out.join('');
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
      if (typeof (scope as any).export === 'function') {
        (validHandlers as any).export = (scope as any).export;
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
      if (typeof (scope as any).drop === 'function') {
        (validHandlers as any).drop = (scope as any).drop;
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
