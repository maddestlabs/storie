const CORE_COMPILED_API_NAMES = [
  'doc',
  'getFrame',
  'getTime',
  'getDelta',
] as const;

export const CAPABILITY_API_NAMES: Record<string, string[]> = {
  terminal: ['term', 'termCanvas', 'layer', 'termWidth', 'termHeight'],
  ui: ['ui', 'canvas2d', 'ascii', 'drawAscii', 'figlet', 'drawFiglet', 'ansi', 'drawAnsi'],
  gui: ['gui', 'tui'],
  worlds: ['worlds'],
  audio: ['audio', 'stfxr'],
  shader: ['shader', 'compositor', 'webgpu', 'webgl'],
  blobs: ['blob'],
  timed: ['doc'],
  logic: ['doc'],
  random: ['random'],
  themes: ['getStyle', 'theme', 'themes'],
  modules: ['modules'],
  host: ['host', 'scene'],
  sys: ['sys', 'getParam', 'CompressionStream', 'DecompressionStream', 'TextEncoder', 'TextDecoder', 'Response', 'atob', 'btoa'],
  input: ['key', 'keys', 'mouse', 'drop', 'mouseX', 'mouseY', 'mouseCellX', 'mouseCellY', 'mousePixelX', 'mousePixelY'],
  export: ['isExporting', 'getIsExporting'],
};

const CAPABILITY_COMPATIBILITY_ALIAS_NAMES: Partial<Record<string, string[]>> = {
  terminal: ['getTermWidth', 'getTermHeight'],
  input: ['getMouseX', 'getMouseY', 'getMouseCellX', 'getMouseCellY', 'getMousePixelX', 'getMousePixelY'],
};

export const CAPABILITY_RUNTIME_PACK_IMPORTS: Partial<Record<string, string[]>> = {
  audio: ['storie/runtime/audio-pack'],
  gui: ['storie/runtime/gui-pack'],
  ui: ['storie/runtime/ui-document-pack'],
  shader: ['storie/runtime/webgpu-pack'],
  worlds: ['storie/runtime/webgpu-pack'],
  random: ['storie/runtime/audio-pack'],
};

const CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_API_NAMES: Partial<Record<string, string[]>> = {
  gui: ['gui', 'tui'],
  audio: ['stfxr'],
  random: ['random'],
};

const CAPABILITY_RUNTIME_PACK_AUGMENTED_CAPABILITIES = new Set<string>([
  'audio',
  'gui',
  'random',
]);

export type RuntimeAssemblyCapabilityStatus = 'pack-constructible' | 'host-backed' | 'hybrid';
export interface RuntimeAssemblyCapabilitySurfaceDetail {
  packConstructible: string[];
  hostRequired: string[];
}

interface StfxrBakedStoreEntry {
  id: string;
  name: string;
  seed: number;
  sampleRate: number;
  seconds: number;
  buffer: AudioBuffer;
  bytes: number;
  createdAt: number;
}

const CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_SURFACES: Partial<Record<string, string[]>> = {
  gui: ['gui', 'tui'],
  audio: [
    'audio.peaksFromBuffer',
    'audio.beatsFromBuffer',
    'audio.beatState',
    'stfxr.parsePreset',
    'stfxr.parseDefinitionJson',
    'stfxr.toSeed',
  ],
  random: ['random'],
};

const CAPABILITY_HOST_REQUIRED_SURFACES: Partial<Record<string, string[]>> = {
  audio: [
    'audio.asset',
    'audio.play',
    'audio.stop',
    'audio.setGain',
    'audio.setPlaybackRate',
    'audio.voiceInfo',
    'audio.resume',
    'audio.buffer',
    'audio.ambient',
    'audio.context',
    'audio.startOnGesture',
    'audio.playTone',
    'audio.loadSound',
    'audio.loadSoundFromDrop',
    'audio.loadSoundFromBlob',
    'audio.playBuffer',
    'audio.playDrop',
    'audio.fft',
    'audio.playBlob',
    'audio.createOscillator',
    'audio.createGain',
    'audio.createBiquadFilter',
    'audio.createDelay',
    'audio.createConvolver',
    'audio.createDynamicsCompressor',
    'audio.createAnalyser',
    'audio.createBufferSource',
    'audio.createPanner',
    'audio.createStereoPanner',
    'audio.captureForExport',
    'audio.getCapturedForExport',
    'stfxr.list',
    'stfxr.has',
    'stfxr.get',
    'stfxr.play',
    'stfxr.playPreset',
    'stfxr.voice',
    'stfxr.voicePreset',
    'stfxr.bake',
    'stfxr.playBaked',
    'stfxr.bakedList',
    'stfxr.snippet',
  ],
};

const CAPABILITY_HOST_ADAPTERS: Partial<Record<string, string[]>> = {
  audio: [
    'audio-context-runtime',
    'audio-asset-decoder',
    'audio-buffer-factory',
    'audio-export-capture',
    'stfxr-document-store',
    'stfxr-baked-store',
  ],
};

interface InstallDocumentCapabilityApiOptions {
  documentId: string;
  globalObject?: typeof globalThis;
  includeCompatibilityAliases?: boolean;
}

interface InstallRuntimePackCapabilityApiOptions {
  globalObject?: typeof globalThis;
  documentId?: string;
  audioContextRuntime?: {
    context?: Record<string, any> | null;
    resume?: () => Promise<boolean> | boolean;
    startOnGesture?: (start: () => void) => boolean;
  };
  audioAssetDecoder?: {
    loadSound?: (url: string) => Promise<AudioBuffer | null> | AudioBuffer | null;
    loadSoundFromDrop?: () => Promise<AudioBuffer | null> | AudioBuffer | null;
    loadSoundFromBlob?: (name: string, documentId?: string) => Promise<AudioBuffer | null> | AudioBuffer | null;
  };
  audioExportCapture?: {
    captureForExport?: (buffer: AudioBuffer, offsetSec?: number) => void;
    getCapturedForExport?: () => { buffer: AudioBuffer; offsetSec: number } | null;
  };
  audioBufferFactory?: {
    create: (channels: number, frameCount: number, sampleRate?: number) => AudioBuffer;
  };
  guiFactory?: {
    getMetrics: () => { charWidth: number; charHeight: number };
    getStyle?: (name: string) => any;
    isTrustedUserInput?: () => boolean;
    getPixelScale?: () => { scaleX: number; scaleY: number };
    getViewportRect?: () => { x: number; y: number; width: number; height: number };
    getSafeAreaInsets?: () => any;
    getCurrentWorldSection?: () => number | null;
    resolveWorldSectionSelector?: (selector: number | string) => number | null;
  };
  tuiFactory?: {
    renderer: any;
    getCellBuffer: () => any[][];
    getStyle?: (name: string) => any;
    isTrustedUserInput?: () => boolean;
  };
  stfxrDocumentStore?: {
    forDocument?: (documentId: string) => {
      list?: () => string[];
      has?: (name: string) => boolean;
      get?: (name: string) => unknown;
      getDefaultSeed?: (name: string) => number | string | undefined;
    } | null;
    list?: () => string[];
    has?: (name: string) => boolean;
    get?: (name: string) => unknown;
    getDefaultSeed?: (name: string) => number | string | undefined;
  };
  stfxrBakedStore?: {
    forDocument?: (documentId: string) => {
      list?: () => string[];
      has?: (id: string) => boolean;
      get?: (id: string) => StfxrBakedStoreEntry | null | undefined;
      set?: (id: string, entry: StfxrBakedStoreEntry) => void;
    } | null;
    list?: () => string[];
    has?: (id: string) => boolean;
    get?: (id: string) => StfxrBakedStoreEntry | null | undefined;
    set?: (id: string, entry: StfxrBakedStoreEntry) => void;
  };
}

function cloneStructuredValue<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(value);
    } catch {
      // Fall through to JSON clone below.
    }
  }

  return value === undefined ? value : JSON.parse(JSON.stringify(value)) as T;
}

function estimateAudioBufferBytes(buffer: AudioBuffer): number {
  const frames = Number(buffer?.length ?? 0);
  const channels = Number(buffer?.numberOfChannels ?? 0);
  return Math.max(0, frames * channels * 4);
}

function getCapabilityRuntimePackModules(
  runtimePackModules: Record<string, unknown>,
  capabilityName: string,
): Record<string, any>[] {
  const entries = runtimePackModules[capabilityName];
  if (!Array.isArray(entries)) return [];
  return entries.filter((entry): entry is Record<string, any> => !!entry && typeof entry === 'object');
}

function installRandomCapabilityAugmentation(
  target: Record<string, any>,
  runtimePackModules: Record<string, unknown>,
  globalObject: typeof globalThis,
): void {
  const randomTarget = (target.random && typeof target.random === 'object') ? target.random : {};
  const audioPack = getCapabilityRuntimePackModules(runtimePackModules, 'random').find(
    (entry) => typeof entry.mulberry32 === 'function',
  ) ?? getCapabilityRuntimePackModules(runtimePackModules, 'audio').find(
    (entry) => typeof entry.mulberry32 === 'function',
  ) ?? null;

  if (typeof randomTarget.seed !== 'function') {
    randomTarget.seed = (): number => {
      try {
        const values = new Uint32Array(1);
        globalObject.crypto.getRandomValues(values);
        return values[0] >>> 0;
      } catch {
        return (Math.random() * 0xffffffff) >>> 0;
      }
    };
  }

  if (typeof randomTarget.rng !== 'function' && typeof audioPack?.mulberry32 === 'function') {
    randomTarget.rng = (seed: number): (() => number) => audioPack.mulberry32(seed >>> 0);
  }

  if (Object.keys(randomTarget).length > 0) {
    target.random = randomTarget;
  }
}

function installAudioCapabilityAugmentation(
  target: Record<string, any>,
  runtimePackModules: Record<string, unknown>,
): void {
  const audioTarget = (target.audio && typeof target.audio === 'object') ? target.audio : {};
  const audioPack = getCapabilityRuntimePackModules(runtimePackModules, 'audio').find(
    (entry) => (
      typeof entry.detectPeaksFromAudioBuffer === 'function'
      || typeof entry.analyzeBeatsFromAudioBuffer === 'function'
      || typeof entry.getBeatState === 'function'
    ),
  ) ?? null;

  if (!audioPack) return;

  if (typeof audioTarget.peaksFromBuffer !== 'function' && typeof audioPack.detectPeaksFromAudioBuffer === 'function') {
    audioTarget.peaksFromBuffer = (buffer: AudioBuffer, options: Record<string, any> = {}) => {
      return audioPack.detectPeaksFromAudioBuffer(buffer, options);
    };
  }

  if (typeof audioTarget.beatsFromBuffer !== 'function' && typeof audioPack.analyzeBeatsFromAudioBuffer === 'function') {
    audioTarget.beatsFromBuffer = (buffer: AudioBuffer, options: Record<string, any> = {}) => {
      return audioPack.analyzeBeatsFromAudioBuffer(buffer, options);
    };
  }

  if (typeof audioTarget.beatState !== 'function' && typeof audioPack.getBeatState === 'function') {
    audioTarget.beatState = (analysis: Record<string, any>, timeSec: number, prevTimeSec?: number) => {
      return audioPack.getBeatState(analysis, timeSec, prevTimeSec);
    };
  }

  if (Object.keys(audioTarget).length > 0) {
    target.audio = audioTarget;
  }
}

function installAudioAssetDecoderAugmentation(
  target: Record<string, any>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  const audioTarget = (target.audio && typeof target.audio === 'object') ? target.audio : {};
  const decoder = options.audioAssetDecoder;
  if (!decoder) return;

  if (typeof audioTarget.loadSound !== 'function' && typeof decoder.loadSound === 'function') {
    audioTarget.loadSound = (url: string) => decoder.loadSound!(String(url ?? ''));
  }

  if (typeof audioTarget.loadSoundFromDrop !== 'function' && typeof decoder.loadSoundFromDrop === 'function') {
    audioTarget.loadSoundFromDrop = () => decoder.loadSoundFromDrop!();
  }

  if (typeof audioTarget.loadSoundFromBlob !== 'function' && typeof decoder.loadSoundFromBlob === 'function') {
    audioTarget.loadSoundFromBlob = (name: string, documentId?: string) => {
      return decoder.loadSoundFromBlob!(String(name ?? ''), documentId ?? options.documentId);
    };
  }

  if (Object.keys(audioTarget).length > 0) {
    target.audio = audioTarget;
  }
}

function installAudioContextRuntimeAugmentation(
  target: Record<string, any>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  const audioTarget = (target.audio && typeof target.audio === 'object') ? target.audio : {};
  const runtime = options.audioContextRuntime;
  const context = runtime?.context;
  if (!runtime || (!context && typeof runtime.resume !== 'function' && typeof runtime.startOnGesture !== 'function')) return;

  if (!('context' in audioTarget) && context !== undefined) {
    Object.defineProperty(audioTarget, 'context', {
      enumerable: true,
      configurable: true,
      get() {
        return runtime.context ?? null;
      },
    });
  }

  if (typeof audioTarget.resume !== 'function') {
    if (typeof runtime.resume === 'function') {
      audioTarget.resume = () => runtime.resume!();
    } else if (typeof context?.resume === 'function') {
      audioTarget.resume = async () => {
        try {
          await context.resume();
        } catch {
          // Ignore resume failure and report current state below.
        }
        return context.state === 'running';
      };
    }
  }

  if (typeof audioTarget.startOnGesture !== 'function' && typeof runtime.startOnGesture === 'function') {
    audioTarget.startOnGesture = (start: () => void) => runtime.startOnGesture!(start);
  }

  const contextFactoryNames = [
    'createOscillator',
    'createGain',
    'createBiquadFilter',
    'createDelay',
    'createConvolver',
    'createDynamicsCompressor',
    'createAnalyser',
    'createBufferSource',
    'createPanner',
    'createStereoPanner',
  ] as const;

  for (const name of contextFactoryNames) {
    if (typeof audioTarget[name] === 'function') continue;
    const factory = context?.[name];
    if (typeof factory !== 'function') continue;
    audioTarget[name] = (...args: unknown[]) => factory.apply(context, args);
  }

  if (Object.keys(audioTarget).length > 0 || Object.prototype.hasOwnProperty.call(audioTarget, 'context')) {
    target.audio = audioTarget;
  }
}

function installAudioExportCaptureAugmentation(
  target: Record<string, any>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  const audioTarget = (target.audio && typeof target.audio === 'object') ? target.audio : {};
  const exportCapture = options.audioExportCapture;
  if (!exportCapture) return;

  if (typeof audioTarget.captureForExport !== 'function' && typeof exportCapture.captureForExport === 'function') {
    audioTarget.captureForExport = (buffer: AudioBuffer, offsetSec?: number) => {
      return exportCapture.captureForExport!(buffer, offsetSec);
    };
  }

  if (typeof audioTarget.getCapturedForExport !== 'function' && typeof exportCapture.getCapturedForExport === 'function') {
    audioTarget.getCapturedForExport = () => exportCapture.getCapturedForExport!();
  }

  if (Object.keys(audioTarget).length > 0) {
    target.audio = audioTarget;
  }
}

function installAudioBufferFactoryAugmentation(
  target: Record<string, any>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  const audioTarget = (target.audio && typeof target.audio === 'object') ? target.audio : {};
  const bufferFactory = options.audioBufferFactory;
  if (!bufferFactory || typeof bufferFactory.create !== 'function') return;

  const bufferTarget = (audioTarget.buffer && typeof audioTarget.buffer === 'object') ? audioTarget.buffer : {};
  if (typeof bufferTarget.create !== 'function') {
    bufferTarget.create = (channels: number, frameCount: number, sampleRate?: number) => {
      return bufferFactory.create(channels, frameCount, sampleRate);
    };
  }

  if (Object.keys(bufferTarget).length > 0) {
    audioTarget.buffer = bufferTarget;
  }

  if (Object.keys(audioTarget).length > 0) {
    target.audio = audioTarget;
  }
}

function installStfxrCapabilityAugmentation(
  target: Record<string, any>,
  runtimePackModules: Record<string, unknown>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  const stfxrTarget = (target.stfxr && typeof target.stfxr === 'object') ? target.stfxr : {};
  const audioPack = getCapabilityRuntimePackModules(runtimePackModules, 'audio').find(
    (entry) => (
      typeof entry.parseSfxGraphPreset === 'function'
      || typeof entry.parseStfxrDefinitionJson === 'function'
      || typeof entry.toSfxSeed === 'function'
      || typeof entry.bakeSfxGraphBuffer === 'function'
    ),
  ) ?? null;
  const storeAdapter = typeof options.stfxrDocumentStore?.forDocument === 'function'
    ? options.stfxrDocumentStore.forDocument(options.documentId ?? '')
    : options.stfxrDocumentStore;
  const bakedStoreAdapter = typeof options.stfxrBakedStore?.forDocument === 'function'
    ? options.stfxrBakedStore.forDocument(options.documentId ?? '')
    : options.stfxrBakedStore;
  const audioContextRuntime = options.audioContextRuntime;
  const audioContext = audioContextRuntime?.context;

  if (!audioPack && !storeAdapter && !bakedStoreAdapter) return;

  if (storeAdapter && typeof stfxrTarget.list !== 'function' && typeof storeAdapter.list === 'function') {
    stfxrTarget.list = () => [...storeAdapter.list!()];
  }

  if (storeAdapter && typeof stfxrTarget.has !== 'function' && typeof storeAdapter.has === 'function') {
    stfxrTarget.has = (name: string) => !!storeAdapter.has!(String(name));
  }

  if (storeAdapter && typeof stfxrTarget.get !== 'function' && typeof storeAdapter.get === 'function') {
    stfxrTarget.get = (name: string) => {
      const preset = storeAdapter.get!(String(name));
      return preset === undefined || preset === null ? null : cloneStructuredValue(preset);
    };
  }

  if (storeAdapter && typeof stfxrTarget.snippet !== 'function') {
    stfxrTarget.snippet = (name: string, seed?: number | string, volume?: number) => {
      const defaultSeed = typeof storeAdapter.getDefaultSeed === 'function'
        ? storeAdapter.getDefaultSeed(String(name))
        : undefined;
      const resolvedSeed = seed ?? defaultSeed;
      const seedPart = resolvedSeed === undefined ? '' : `, ${JSON.stringify(resolvedSeed)}`;
      const optionPart = volume === undefined ? '' : `, { volume: ${volume} }`;
      return `stfxr.play(${JSON.stringify(String(name))}${seedPart}${optionPart})`;
    };
  }

  if (typeof stfxrTarget.parsePreset !== 'function' && typeof audioPack?.parseSfxGraphPreset === 'function') {
    stfxrTarget.parsePreset = (preset: unknown) => audioPack.parseSfxGraphPreset(preset);
  }

  if (typeof stfxrTarget.parseDefinitionJson !== 'function' && typeof audioPack?.parseStfxrDefinitionJson === 'function') {
    stfxrTarget.parseDefinitionJson = (definition: unknown) => audioPack.parseStfxrDefinitionJson(definition);
  }

  if (typeof stfxrTarget.toSeed !== 'function' && typeof audioPack?.toSfxSeed === 'function') {
    stfxrTarget.toSeed = (seed: number | string | undefined) => audioPack.toSfxSeed(seed);
  }

  if (bakedStoreAdapter && typeof stfxrTarget.bakedList !== 'function' && typeof bakedStoreAdapter.list === 'function') {
    stfxrTarget.bakedList = () => [...bakedStoreAdapter.list!()];
  }

  if (
    bakedStoreAdapter
    && typeof stfxrTarget.playBaked !== 'function'
    && typeof bakedStoreAdapter.get === 'function'
    && audioContext
    && typeof audioContext.createBufferSource === 'function'
    && typeof audioContext.createGain === 'function'
    && audioContext.destination
  ) {
    stfxrTarget.playBaked = (id: string, playbackOptions?: { volume?: number; when?: number; playbackRate?: number }) => {
      const entry = bakedStoreAdapter.get!(String(id));
      if (!entry?.buffer) {
        return { stop: () => {} };
      }

      if (typeof audioContextRuntime?.resume === 'function') {
        Promise.resolve(audioContextRuntime.resume()).catch(() => {});
      } else if (typeof audioContext.resume === 'function') {
        Promise.resolve(audioContext.resume()).catch(() => {});
      }

      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = entry.buffer;
      source.playbackRate.value = playbackOptions?.playbackRate ?? 1;
      gain.gain.value = playbackOptions?.volume ?? 1;
      source.connect(gain);
      gain.connect(audioContext.destination);

      const startTime = Number(audioContext.currentTime ?? 0) + (playbackOptions?.when ?? 0);
      try {
        source.start(startTime);
      } catch {
        // Ignore start failures to preserve host behavior.
      }

      return {
        stop: (when?: number) => {
          const stopTime = Number(audioContext.currentTime ?? 0) + (when ?? 0);
          try {
            source.stop(stopTime);
          } catch {
            // Ignore stop failures to preserve host behavior.
          }
        },
      };
    };
  }

  if (
    bakedStoreAdapter
    && storeAdapter
    && typeof stfxrTarget.bake !== 'function'
    && typeof bakedStoreAdapter.has === 'function'
    && typeof bakedStoreAdapter.set === 'function'
    && typeof storeAdapter.get === 'function'
    && typeof audioPack?.toSfxSeed === 'function'
    && typeof audioPack?.bakeSfxGraphBuffer === 'function'
    && audioContext
  ) {
    stfxrTarget.bake = async (
      name: string,
      seed?: number | string,
      bakeOptions?: { id?: string; seconds?: number; maxSeconds?: number },
    ) => {
      const resolvedName = String(name);
      const preset = storeAdapter.get!(resolvedName);
      if (!preset) return '';

      const defaultSeed = typeof storeAdapter.getDefaultSeed === 'function'
        ? storeAdapter.getDefaultSeed(resolvedName)
        : undefined;
      const resolvedSeed = audioPack.toSfxSeed(seed ?? defaultSeed);
      const sampleRate = Number(audioContext.sampleRate ?? 0);
      const id = String(bakeOptions?.id ?? `stfxr:${resolvedName}:${resolvedSeed >>> 0}:${sampleRate}`);

      if (bakedStoreAdapter.has!(id)) {
        return id;
      }

      const buffer = await audioPack.bakeSfxGraphBuffer(audioContext, preset, resolvedSeed, {
        seconds: bakeOptions?.seconds,
        maxSeconds: bakeOptions?.maxSeconds,
      });

      bakedStoreAdapter.set!(id, {
        id,
        name: resolvedName,
        seed: resolvedSeed >>> 0,
        sampleRate,
        seconds: Number(buffer?.length ?? 0) / (sampleRate || 1),
        buffer,
        bytes: estimateAudioBufferBytes(buffer),
        createdAt: Date.now(),
      });
      return id;
    };
  }

  if (Object.keys(stfxrTarget).length > 0) {
    target.stfxr = stfxrTarget;
  }
}

function installGuiCapabilityAugmentation(
  target: Record<string, any>,
  runtimePackModules: Record<string, unknown>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  if (target.gui) return;

  const guiPack = getCapabilityRuntimePackModules(runtimePackModules, 'gui').find(
    (entry) => typeof entry.createGUIAPI === 'function',
  ) ?? null;
  const guiFactory = options.guiFactory;
  if (!guiPack || !guiFactory || typeof guiFactory.getMetrics !== 'function') return;

  target.gui = guiPack.createGUIAPI(
    guiFactory.getMetrics,
    guiFactory.getStyle ?? target.getStyle,
    guiFactory.isTrustedUserInput,
    guiFactory.getPixelScale,
    guiFactory.getViewportRect,
    guiFactory.getSafeAreaInsets,
    guiFactory.getCurrentWorldSection,
    guiFactory.resolveWorldSectionSelector,
  );
}

function installTuiCapabilityAugmentation(
  target: Record<string, any>,
  runtimePackModules: Record<string, unknown>,
  options: InstallRuntimePackCapabilityApiOptions,
): void {
  if (target.tui) return;

  const guiPack = getCapabilityRuntimePackModules(runtimePackModules, 'gui').find(
    (entry) => typeof entry.createTUIAPI === 'function',
  ) ?? null;
  const tuiFactory = options.tuiFactory;
  if (!guiPack || !tuiFactory || typeof tuiFactory.getCellBuffer !== 'function' || !tuiFactory.renderer) return;

  target.tui = guiPack.createTUIAPI(
    tuiFactory.renderer,
    tuiFactory.getCellBuffer,
    tuiFactory.getStyle ?? target.getStyle,
    tuiFactory.isTrustedUserInput,
  );
}

function createScopedAudioApi(api: Record<string, any>, documentId: string): any {
  const audioRef = api.audio;
  if (!audioRef || typeof audioRef !== 'object') return audioRef;
  const audio = Object.create(audioRef);
  if (typeof audioRef.loadSoundFromBlob === 'function') {
    audio.loadSoundFromBlob = (name: string) => audioRef.loadSoundFromBlob(name, documentId);
  }
  if (typeof audioRef.playBlob === 'function') {
    audio.playBlob = (name: string, options?: any) => audioRef.playBlob(name, options, documentId);
  }
  if (typeof audioRef.captureForExport === 'function') {
    audio.captureForExport = (buffer: any, offsetSec?: number) =>
      audioRef.captureForExport(buffer, offsetSec);
  }
  if (typeof audioRef.getCapturedForExport === 'function') {
    audio.getCapturedForExport = () => audioRef.getCapturedForExport();
  }
  return audio;
}

function createScopedUiApi(api: Record<string, any>, documentId: string): any {
  const uiRef = api.ui;
  if (!uiRef || typeof uiRef !== 'object') return uiRef;
  if (typeof uiRef.loadImageFromBlob !== 'function') return uiRef;
  const ui = Object.create(uiRef);
  ui.loadImageFromBlob = (name: string) => uiRef.loadImageFromBlob(name, documentId);
  if (typeof uiRef.loadImageFromURL === 'function') {
    ui.loadImageFromURL = (url: string) => uiRef.loadImageFromURL(url);
  }
  if (typeof uiRef.getImageSize === 'function') {
    ui.getImageSize = (imageId: string) => uiRef.getImageSize(imageId);
  }
  return ui;
}

function resolveDocumentScopedValue(value: any, documentId: string): any {
  return value?.forDocument ? value.forDocument(documentId) : value;
}

function createDocumentCapabilityGlobals(api: Record<string, any>, documentId: string, globalObject: typeof globalThis): Record<string, any> {
  const apiRef = api;

  return {
    term: api.term,
    termCanvas: api.termCanvas,
    layer: api.layer,
    key: api.key,
    keys: {
      has: (keyName: string) => apiRef.key.down(keyName),
      isDown: (keyName: string) => apiRef.key.down(keyName),
      pressed: (keyName: string) => apiRef.key.pressed(keyName),
      released: (keyName: string) => apiRef.key.released(keyName),
    },
    mouse: api.mouse,
    drop: api.drop,
    doc: api.doc,
    host: api.host,
    scene: api.scene,
    getStyle: api.getStyle,
    theme: api.theme,
    themes: api.themes,
    modules: api.modules,
    CompressionStream: globalObject.CompressionStream,
    DecompressionStream: globalObject.DecompressionStream,
    TextEncoder: globalObject.TextEncoder,
    TextDecoder: globalObject.TextDecoder,
    Response: globalObject.Response,
    atob: (value: string) => globalObject.atob(value),
    btoa: (value: string) => globalObject.btoa(value),
    audio: createScopedAudioApi(api, documentId),
    canvas2d: api.canvas2d,
    webgl: api.webgl,
    webgpu: api.webgpu,
    shader: api.shader,
    compositor: api.compositor,
    tui: api.tui,
    gui: api.gui,
    blob: resolveDocumentScopedValue(api.blob, documentId),
    ascii: resolveDocumentScopedValue(api.ascii, documentId),
    drawAscii: (x: number, y: number, name: string, fg?: any, bg?: any) => {
      const ascii = resolveDocumentScopedValue(api.ascii, documentId);
      if (!ascii || typeof ascii.lines !== 'function') return;
      const lines = ascii.lines(name) as string[] | null;
      if (!lines || !Array.isArray(lines)) return;
      for (let index = 0; index < lines.length; index += 1) {
        api.term.write(x, y + index, lines[index] ?? '', fg, bg);
      }
    },
    figlet: resolveDocumentScopedValue(api.figlet, documentId),
    stfxr: resolveDocumentScopedValue(api.stfxr, documentId),
    drawFiglet: (x: number, y: number, fontName: string, text: string, fg?: any, bg?: any, options?: { vertical?: boolean; letterSpacing?: number }) => {
      const figlet = resolveDocumentScopedValue(api.figlet, documentId);
      if (!figlet) return;

      const vertical = !!options?.vertical;
      const letterSpacing = Math.max(0, options?.letterSpacing ?? 0);

      if (vertical) {
        let currentY = y;
        for (const character of Array.from(String(text ?? ''))) {
          const lines = typeof figlet.renderChar === 'function' ? (figlet.renderChar(fontName, character) as string[]) : [];
          for (let index = 0; index < (lines?.length ?? 0); index += 1) {
            api.term.write(x, currentY + index, lines[index] ?? '', fg, bg);
          }
          currentY += (typeof figlet.height === 'function' ? figlet.height(fontName) : (lines?.length ?? 0)) + letterSpacing;
        }
        return;
      }

      if (letterSpacing > 0 && typeof figlet.renderChar === 'function') {
        let currentX = x;
        const height = typeof figlet.height === 'function' ? figlet.height(fontName) : 0;
        for (const character of Array.from(String(text ?? ''))) {
          const lines = figlet.renderChar(fontName, character) as string[];
          for (let index = 0; index < (lines?.length ?? height); index += 1) {
            api.term.write(currentX, y + index, lines?.[index] ?? '', fg, bg);
          }
          const width = Math.max(0, ...(lines ?? []).map((line: string) => (line ?? '').length));
          currentX += width + letterSpacing;
        }
        return;
      }

      const lines = typeof figlet.render === 'function' ? (figlet.render(fontName, text) as string[]) : [];
      if (!lines || !Array.isArray(lines)) return;
      for (let index = 0; index < lines.length; index += 1) {
        api.term.write(x, y + index, lines[index] ?? '', fg, bg);
      }
    },
    ansi: resolveDocumentScopedValue(api.ansi, documentId),
    drawAnsi: (x: number, y: number, name: string) => {
      const ansi = resolveDocumentScopedValue(api.ansi, documentId);
      if (!ansi || typeof ansi.runs !== 'function') return;
      const lines = ansi.runs(name) as any[] | null;
      if (!lines || !Array.isArray(lines)) return;
      for (let row = 0; row < lines.length; row += 1) {
        const runs = lines[row] as any[];
        if (!runs || !Array.isArray(runs)) continue;
        let currentX = x;
        for (const run of runs) {
          const text = String(run?.text ?? '');
          if (!text) continue;
          api.term.write(currentX, y + row, text, run?.fg, run?.bg);
          currentX += text.length;
        }
      }
    },
    ui: createScopedUiApi(api, documentId),
    worlds: api.worlds,
    get mouseX() { return apiRef.mouseX; },
    get mouseY() { return apiRef.mouseY; },
    get mouseCellX() { return apiRef.mouseCellX; },
    get mouseCellY() { return apiRef.mouseCellY; },
    get mousePixelX() { return apiRef.mousePixelX; },
    get mousePixelY() { return apiRef.mousePixelY; },
    get termWidth() { return apiRef.termWidth; },
    get termHeight() { return apiRef.termHeight; },
    getMouseX: () => apiRef.mouseX,
    getMouseY: () => apiRef.mouseY,
    getMouseCellX: () => apiRef.mouseCellX,
    getMouseCellY: () => apiRef.mouseCellY,
    getMousePixelX: () => apiRef.mousePixelX,
    getMousePixelY: () => apiRef.mousePixelY,
    getTermWidth: () => apiRef.termWidth,
    getTermHeight: () => apiRef.termHeight,
    getFrame: api.getFrame,
    getTime: api.getTime,
    getDelta: api.getDelta,
    get isExporting() { return apiRef.isExporting; },
    getIsExporting: api.getIsExporting,
    getParam: api.getParam,
    random: api.random,
    sys: api.sys,
  };
}

export function collectCapabilityApiNames(capabilityPacks: readonly string[]): string[] {
  const names = new Set<string>(CORE_COMPILED_API_NAMES);
  for (const capability of capabilityPacks) {
    for (const name of CAPABILITY_API_NAMES[capability] ?? []) {
      names.add(name);
    }
  }
  return Array.from(names).sort();
}

export function getAllKnownCapabilityPacks(): string[] {
  return Object.keys(CAPABILITY_API_NAMES);
}

export function collectRuntimePackConstructibleApiNames(capabilityPacks: readonly string[]): string[] {
  const names = new Set<string>();
  for (const capability of capabilityPacks) {
    for (const name of CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_API_NAMES[capability] ?? []) {
      names.add(name);
    }
  }
  return Array.from(names).sort();
}

export function collectHostRequiredApiNames(capabilityPacks: readonly string[]): string[] {
  const requiredNames = new Set<string>(collectCapabilityApiNames(capabilityPacks));
  for (const name of collectRuntimePackConstructibleApiNames(capabilityPacks)) {
    requiredNames.delete(name);
  }
  return Array.from(requiredNames).sort();
}

export function collectCapabilityAssemblyStatus(capabilityPacks: readonly string[]): Record<string, RuntimeAssemblyCapabilityStatus> {
  const statuses: Record<string, RuntimeAssemblyCapabilityStatus> = {};

  for (const capability of capabilityPacks) {
    const apiNames = new Set<string>(CAPABILITY_API_NAMES[capability] ?? []);
    const constructibleNames = new Set<string>(CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_API_NAMES[capability] ?? []);

    if (apiNames.size === 0 || constructibleNames.size === 0) {
      statuses[capability] = CAPABILITY_RUNTIME_PACK_AUGMENTED_CAPABILITIES.has(capability)
        ? 'hybrid'
        : 'host-backed';
      continue;
    }

    let constructibleCount = 0;
    for (const name of apiNames) {
      if (constructibleNames.has(name)) constructibleCount += 1;
    }

    if (constructibleCount === 0) {
      statuses[capability] = CAPABILITY_RUNTIME_PACK_AUGMENTED_CAPABILITIES.has(capability)
        ? 'hybrid'
        : 'host-backed';
      continue;
    }

    statuses[capability] = constructibleCount === apiNames.size ? 'pack-constructible' : 'hybrid';
  }

  return statuses;
}

export function collectCapabilitySurfaceDetails(
  capabilityPacks: readonly string[],
): Record<string, RuntimeAssemblyCapabilitySurfaceDetail> {
  const details: Record<string, RuntimeAssemblyCapabilitySurfaceDetail> = {};

  for (const capability of capabilityPacks) {
    const packConstructible = [
      ...(CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_SURFACES[capability]
        ?? CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_API_NAMES[capability]
        ?? []),
    ].sort();

    const hostRequired = [
      ...(CAPABILITY_HOST_REQUIRED_SURFACES[capability]
        ?? (CAPABILITY_API_NAMES[capability] ?? []).filter(
          (name) => !(CAPABILITY_RUNTIME_PACK_CONSTRUCTIBLE_API_NAMES[capability] ?? []).includes(name),
        )),
    ].sort();

    details[capability] = {
      packConstructible,
      hostRequired,
    };
  }

  return details;
}

export function collectCapabilityHostAdapters(capabilityPacks: readonly string[]): Record<string, string[]> {
  const adapters: Record<string, string[]> = {};

  for (const capability of capabilityPacks) {
    const names = [...(CAPABILITY_HOST_ADAPTERS[capability] ?? [])].sort();
    if (names.length > 0) {
      adapters[capability] = names;
    }
  }

  return adapters;
}

export function installDocumentCapabilityApiGlobals(
  target: Record<string, any>,
  api: Record<string, any>,
  capabilityPacks: readonly string[],
  options: InstallDocumentCapabilityApiOptions,
): Record<string, any> {
  const selectedNames = new Set<string>(collectCapabilityApiNames(capabilityPacks));

  if (options.includeCompatibilityAliases) {
    for (const capability of capabilityPacks) {
      for (const alias of CAPABILITY_COMPATIBILITY_ALIAS_NAMES[capability] ?? []) {
        selectedNames.add(alias);
      }
    }
  }

  const source = createDocumentCapabilityGlobals(api, options.documentId, options.globalObject ?? globalThis);
  const descriptors = Object.getOwnPropertyDescriptors(source);
  const selectedDescriptors: PropertyDescriptorMap = {};

  for (const name of selectedNames) {
    const descriptor = descriptors[name];
    if (descriptor) selectedDescriptors[name] = descriptor;
  }

  Object.defineProperties(target, selectedDescriptors);
  return target;
}

export function installRuntimePackCapabilityApi(
  target: Record<string, any>,
  capabilityPacks: readonly string[],
  runtimePackModules: Record<string, unknown>,
  options: InstallRuntimePackCapabilityApiOptions = {},
): Record<string, any> {
  const capabilitySet = new Set<string>(capabilityPacks);
  const globalObject = options.globalObject ?? globalThis;

  if (capabilitySet.has('random')) {
    installRandomCapabilityAugmentation(target, runtimePackModules, globalObject);
  }

  if (capabilitySet.has('audio')) {
    installAudioContextRuntimeAugmentation(target, options);
    installAudioAssetDecoderAugmentation(target, options);
    installAudioExportCaptureAugmentation(target, options);
    installAudioBufferFactoryAugmentation(target, options);
    installAudioCapabilityAugmentation(target, runtimePackModules);
    installStfxrCapabilityAugmentation(target, runtimePackModules, options);
  }

  if (capabilitySet.has('gui')) {
    installGuiCapabilityAugmentation(target, runtimePackModules, options);
    installTuiCapabilityAugmentation(target, runtimePackModules, options);
  }

  return target;
}