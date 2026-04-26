import { describe, expect, it, vi } from 'vitest';

import {
  collectCapabilityAssemblyStatus,
  collectCapabilityApiNames,
  collectCapabilityHostAdapters,
  collectCapabilitySurfaceDetails,
  collectHostRequiredApiNames,
  collectRuntimePackConstructibleApiNames,
  installDocumentCapabilityApiGlobals,
  installRuntimePackCapabilityApi,
} from './capability-api.js';

describe('runtime capability api', () => {
  it('collects the compiled API surface for selected capability packs', () => {
    expect(collectCapabilityApiNames(['audio', 'input', 'sys'])).toEqual([
      'CompressionStream',
      'DecompressionStream',
      'Response',
      'TextDecoder',
      'TextEncoder',
      'atob',
      'audio',
      'btoa',
      'doc',
      'drop',
      'getDelta',
      'getFrame',
      'getParam',
      'getTime',
      'key',
      'keys',
      'mouse',
      'mouseCellX',
      'mouseCellY',
      'mousePixelX',
      'mousePixelY',
      'mouseX',
      'mouseY',
      'stfxr',
      'sys',
    ]);
  });

  it('splits runtime-pack-constructible and host-required api names', () => {
    expect(collectRuntimePackConstructibleApiNames(['gui', 'random', 'audio'])).toEqual([
      'gui',
      'random',
      'stfxr',
      'tui',
    ]);

    expect(collectHostRequiredApiNames(['gui', 'random', 'audio', 'input'])).toEqual([
      'audio',
      'doc',
      'drop',
      'getDelta',
      'getFrame',
      'getTime',
      'key',
      'keys',
      'mouse',
      'mouseCellX',
      'mouseCellY',
      'mousePixelX',
      'mousePixelY',
      'mouseX',
      'mouseY',
    ]);

    expect(collectCapabilityAssemblyStatus(['gui', 'random', 'audio', 'input'])).toEqual({
      gui: 'pack-constructible',
      random: 'pack-constructible',
      audio: 'hybrid',
      input: 'host-backed',
    });

    expect(collectCapabilitySurfaceDetails(['audio', 'gui'])).toEqual({
      audio: {
        packConstructible: [
          'audio.beatState',
          'audio.beatsFromBuffer',
          'audio.peaksFromBuffer',
          'stfxr.parseDefinitionJson',
          'stfxr.parsePreset',
          'stfxr.toSeed',
        ],
        hostRequired: [
          'audio.ambient',
          'audio.asset',
          'audio.buffer',
          'audio.captureForExport',
          'audio.context',
          'audio.createAnalyser',
          'audio.createBiquadFilter',
          'audio.createBufferSource',
          'audio.createConvolver',
          'audio.createDelay',
          'audio.createDynamicsCompressor',
          'audio.createGain',
          'audio.createOscillator',
          'audio.createPanner',
          'audio.createStereoPanner',
          'audio.fft',
          'audio.getCapturedForExport',
          'audio.loadSound',
          'audio.loadSoundFromBlob',
          'audio.loadSoundFromDrop',
          'audio.play',
          'audio.playBlob',
          'audio.playBuffer',
          'audio.playDrop',
          'audio.playTone',
          'audio.resume',
          'audio.setGain',
          'audio.setPlaybackRate',
          'audio.startOnGesture',
          'audio.stop',
          'audio.voiceInfo',
          'stfxr.bake',
          'stfxr.bakedList',
          'stfxr.get',
          'stfxr.has',
          'stfxr.list',
          'stfxr.play',
          'stfxr.playBaked',
          'stfxr.playPreset',
          'stfxr.snippet',
          'stfxr.voice',
          'stfxr.voicePreset',
        ],
      },
      gui: {
        packConstructible: ['gui', 'tui'],
        hostRequired: [],
      },
    });

    expect(collectCapabilityHostAdapters(['audio', 'gui', 'random'])).toEqual({
      audio: [
        'audio-asset-decoder',
        'audio-buffer-factory',
        'audio-context-runtime',
        'audio-export-capture',
        'stfxr-baked-store',
        'stfxr-document-store',
      ],
    });
  });

  it('augments the audio capability from runtime pack modules with analysis helpers', () => {
    const detectPeaksFromAudioBuffer = vi.fn(() => ({ peaks: [0.1], envelopeHz: 60, envelope: new Float32Array(0), threshold: 0.5 }));
    const analyzeBeatsFromAudioBuffer = vi.fn(() => ({ bpm: 120, confidence: 1, meter: 4, periodSec: 0.5, offsetSec: 0, beats: [0], downbeats: [0], envelopeHz: 60, envelope: new Float32Array(0) }));
    const getBeatState = vi.fn(() => ({ beatIndex: 2 }));
    const target: Record<string, any> = {};
    const buffer = { sampleRate: 48000 } as AudioBuffer;

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [{ detectPeaksFromAudioBuffer, analyzeBeatsFromAudioBuffer, getBeatState }],
    });

    expect(typeof target.audio.peaksFromBuffer).toBe('function');
    expect(typeof target.audio.beatsFromBuffer).toBe('function');
    expect(typeof target.audio.beatState).toBe('function');

    target.audio.peaksFromBuffer(buffer, { threshold: 0.2 });
    target.audio.beatsFromBuffer(buffer, { minBpm: 80 });
    target.audio.beatState({ bpm: 120 }, 1.5, 1.0);

    expect(detectPeaksFromAudioBuffer).toHaveBeenCalledWith(buffer, { threshold: 0.2 });
    expect(analyzeBeatsFromAudioBuffer).toHaveBeenCalledWith(buffer, { minBpm: 80 });
    expect(getBeatState).toHaveBeenCalledWith({ bpm: 120 }, 1.5, 1.0);
  });

  it('augments audio decode helpers from an explicit audio asset decoder adapter', async () => {
    const loadSound = vi.fn(async (url: string) => ({ kind: 'url', url } as unknown as AudioBuffer));
    const loadSoundFromDrop = vi.fn(async () => ({ kind: 'drop' } as unknown as AudioBuffer));
    const loadSoundFromBlob = vi.fn(async (name: string, documentId?: string) => ({ kind: 'blob', name, documentId } as unknown as AudioBuffer));
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [],
    }, {
      documentId: 'docs/demos/0rain.md',
      audioAssetDecoder: {
        loadSound,
        loadSoundFromDrop,
        loadSoundFromBlob,
      },
    });

    await expect(target.audio.loadSound('assets/beat.wav')).resolves.toEqual({ kind: 'url', url: 'assets/beat.wav' });
    await expect(target.audio.loadSoundFromDrop()).resolves.toEqual({ kind: 'drop' });
    await expect(target.audio.loadSoundFromBlob('kick')).resolves.toEqual({ kind: 'blob', name: 'kick', documentId: 'docs/demos/0rain.md' });

    expect(loadSound).toHaveBeenCalledWith('assets/beat.wav');
    expect(loadSoundFromDrop).toHaveBeenCalledTimes(1);
    expect(loadSoundFromBlob).toHaveBeenCalledWith('kick', 'docs/demos/0rain.md');
  });

  it('augments audio context access and raw factories from an explicit audio context runtime adapter', async () => {
    const createGain = vi.fn(() => ({ kind: 'gain' }));
    const createAnalyser = vi.fn(() => ({ kind: 'analyser' }));
    const resume = vi.fn(async () => true);
    const startOnGesture = vi.fn((start: () => void) => {
      start();
      return true;
    });
    const start = vi.fn();
    const context = {
      state: 'running',
      createGain,
      createAnalyser,
    };
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [],
    }, {
      audioContextRuntime: {
        context,
        resume,
        startOnGesture,
      },
    });

    expect(target.audio.context).toBe(context);
    await expect(target.audio.resume()).resolves.toBe(true);
    expect(target.audio.createGain()).toEqual({ kind: 'gain' });
    expect(target.audio.createAnalyser()).toEqual({ kind: 'analyser' });
    expect(target.audio.startOnGesture(start)).toBe(true);

    expect(resume).toHaveBeenCalledTimes(1);
    expect(createGain).toHaveBeenCalledTimes(1);
    expect(createAnalyser).toHaveBeenCalledTimes(1);
    expect(startOnGesture).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('augments audio export capture from an explicit export-capture adapter', () => {
    const buffer = { kind: 'buffer' } as unknown as AudioBuffer;
    const captureForExport = vi.fn();
    const getCapturedForExport = vi.fn(() => ({ buffer, offsetSec: 1.25 }));
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [],
    }, {
      audioExportCapture: {
        captureForExport,
        getCapturedForExport,
      },
    });

    target.audio.captureForExport(buffer, 0.5);
    expect(target.audio.getCapturedForExport()).toEqual({ buffer, offsetSec: 1.25 });

    expect(captureForExport).toHaveBeenCalledWith(buffer, 0.5);
    expect(getCapturedForExport).toHaveBeenCalledTimes(1);
  });

  it('augments audio buffer creation from an explicit audio buffer factory adapter', () => {
    const create = vi.fn((channels: number, frameCount: number, sampleRate?: number) => {
      return { channels, frameCount, sampleRate } as unknown as AudioBuffer;
    });
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [],
    }, {
      audioBufferFactory: { create },
    });

    expect(target.audio.buffer.create(2, 44100, 48000)).toEqual({
      channels: 2,
      frameCount: 44100,
      sampleRate: 48000,
    });
    expect(create).toHaveBeenCalledWith(2, 44100, 48000);
  });

  it('augments the stfxr capability from audio runtime pack helpers', () => {
    const parseSfxGraphPreset = vi.fn((preset: unknown) => ({ parsed: preset }));
    const parseStfxrDefinitionJson = vi.fn((definition: unknown) => ({ definition }));
    const toSfxSeed = vi.fn((seed: number | string | undefined) => 42);
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [{ parseSfxGraphPreset, parseStfxrDefinitionJson, toSfxSeed }],
    });

    expect(typeof target.stfxr.parsePreset).toBe('function');
    expect(typeof target.stfxr.parseDefinitionJson).toBe('function');
    expect(typeof target.stfxr.toSeed).toBe('function');

    expect(target.stfxr.parsePreset({ nodes: [] })).toEqual({ parsed: { nodes: [] } });
    expect(target.stfxr.parseDefinitionJson('{"nodes":[]}')).toEqual({ definition: '{"nodes":[]}' });
    expect(target.stfxr.toSeed('abc')).toBe(42);

    expect(parseSfxGraphPreset).toHaveBeenCalledWith({ nodes: [] });
    expect(parseStfxrDefinitionJson).toHaveBeenCalledWith('{"nodes":[]}');
    expect(toSfxSeed).toHaveBeenCalledWith('abc');
  });

  it('augments stfxr store access from an explicit document store adapter', () => {
    const target: Record<string, any> = {};
    const forDocument = vi.fn(() => ({
      list: () => ['coin'],
      has: (name: string) => name === 'coin',
      get: (name: string) => (name === 'coin' ? { nodes: [{ id: 'osc' }] } : null),
      getDefaultSeed: (name: string) => (name === 'coin' ? 99 : undefined),
    }));

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [],
    }, {
      documentId: 'docs/demos/0rain.md',
      stfxrDocumentStore: { forDocument },
    });

    expect(forDocument).toHaveBeenCalledWith('docs/demos/0rain.md');
    expect(target.stfxr.list()).toEqual(['coin']);
    expect(target.stfxr.has('coin')).toBe(true);
    expect(target.stfxr.get('coin')).toEqual({ nodes: [{ id: 'osc' }] });
    expect(target.stfxr.snippet('coin')).toBe('stfxr.play("coin", 99)');
    expect(target.stfxr.snippet('coin', undefined, 0.5)).toBe('stfxr.play("coin", 99, { volume: 0.5 })');
  });

  it('augments stfxr baked storage, baking, and playback from explicit baked-store and audio runtime adapters', async () => {
    const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), playbackRate: { value: 1 }, buffer: null as AudioBuffer | null };
    const gain = { connect: vi.fn(), gain: { value: 1 } };
    const createBufferSource = vi.fn(() => source);
    const createGain = vi.fn(() => gain);
    const resume = vi.fn(async () => true);
    const buffer = { length: 48000, numberOfChannels: 2 } as AudioBuffer;
    const bakeSfxGraphBuffer = vi.fn(async () => buffer);
    const toSfxSeed = vi.fn(() => 42);
    const bakedEntries = new Map<string, any>();
    const stfxrDocumentForDocument = vi.fn(() => ({
      get: (name: string) => (name === 'coin' ? { nodes: [{ id: 'osc' }] } : null),
      getDefaultSeed: (name: string) => (name === 'coin' ? 99 : undefined),
    }));
    const stfxrBakedForDocument = vi.fn(() => ({
      list: () => Array.from(bakedEntries.keys()),
      has: (id: string) => bakedEntries.has(id),
      get: (id: string) => bakedEntries.get(id) ?? null,
      set: (id: string, entry: any) => {
        bakedEntries.set(id, entry);
      },
    }));
    const target: Record<string, any> = {};

    installRuntimePackCapabilityApi(target, ['audio'], {
      audio: [{ toSfxSeed, bakeSfxGraphBuffer }],
    }, {
      documentId: 'docs/demos/stfxr.md',
      stfxrDocumentStore: { forDocument: stfxrDocumentForDocument },
      stfxrBakedStore: { forDocument: stfxrBakedForDocument },
      audioContextRuntime: {
        context: {
          sampleRate: 48000,
          currentTime: 1,
          destination: { kind: 'out' },
          createBufferSource,
          createGain,
        },
        resume,
      },
    });

    await expect(target.stfxr.bake('coin')).resolves.toBe('stfxr:coin:42:48000');
    expect(bakeSfxGraphBuffer).toHaveBeenCalledWith(
      expect.objectContaining({ sampleRate: 48000 }),
      { nodes: [{ id: 'osc' }] },
      42,
      { seconds: undefined, maxSeconds: undefined },
    );
    expect(target.stfxr.bakedList()).toEqual(['stfxr:coin:42:48000']);

    const handle = target.stfxr.playBaked('stfxr:coin:42:48000', { volume: 0.5, when: 0.25, playbackRate: 1.5 });
    handle.stop(0.5);

    expect(stfxrDocumentForDocument).toHaveBeenCalledWith('docs/demos/stfxr.md');
    expect(stfxrBakedForDocument).toHaveBeenCalledWith('docs/demos/stfxr.md');
    expect(toSfxSeed).toHaveBeenCalledWith(99);
    expect(resume).toHaveBeenCalledTimes(1);
    expect(createBufferSource).toHaveBeenCalledTimes(1);
    expect(createGain).toHaveBeenCalledTimes(1);
    expect(source.buffer).toBe(buffer);
    expect(source.playbackRate.value).toBe(1.5);
    expect(gain.gain.value).toBe(0.5);
    expect(source.connect).toHaveBeenCalledWith(gain);
    expect(gain.connect).toHaveBeenCalledWith(expect.objectContaining({ kind: 'out' }));
    expect(source.start).toHaveBeenCalledWith(1.25);
    expect(source.stop).toHaveBeenCalledWith(1.5);
  });

  it('installs document-aware globals while preserving accessors', () => {
    const playBlob = vi.fn();
    const loadSoundFromBlob = vi.fn();
    const write = vi.fn();
    const loadImageFromBlob = vi.fn();
    const atob = vi.fn((value: string) => `decoded:${value}`);
    const btoa = vi.fn((value: string) => `encoded:${value}`);

    const target: Record<string, any> = {};
    const api = {
      term: { write },
      key: {
        down: vi.fn(() => true),
        pressed: vi.fn(() => false),
        released: vi.fn(() => false),
      },
      mouse: {},
      drop: {},
      doc: { title: 'demo' },
      audio: {
        loadSoundFromBlob,
        playBlob,
      },
      ascii: {
        forDocument: vi.fn(() => ({ lines: () => ['AB', 'CD'] })),
      },
      ui: {
        loadImageFromBlob,
      },
      random: { seed: vi.fn(() => 123) },
      getFrame: vi.fn(() => 7),
      getTime: vi.fn(() => 10),
      getDelta: vi.fn(() => 0.016),
      getIsExporting: vi.fn(() => false),
      getParam: vi.fn(),
      sys: { save: vi.fn() },
      mouseX: 12,
      mouseY: 34,
      mouseCellX: 1,
      mouseCellY: 2,
      mousePixelX: 3,
      mousePixelY: 4,
      termWidth: 80,
      termHeight: 25,
      isExporting: false,
      stfxr: {
        forDocument: vi.fn(() => ({ preset: 'doc' })),
      },
    } as Record<string, any>;

    installDocumentCapabilityApiGlobals(target, api, ['audio', 'ui', 'input', 'sys'], {
      documentId: 'demo-doc',
      globalObject: {
        CompressionStream: class CompressionStream {},
        DecompressionStream: class DecompressionStream {},
        TextEncoder,
        TextDecoder,
        Response,
        atob,
        btoa,
      } as typeof globalThis,
      includeCompatibilityAliases: true,
    });

    target.audio.loadSoundFromBlob('kick');
    target.audio.playBlob('snare', { gain: 0.5 });
    target.ui.loadImageFromBlob('sprite');
    target.drawAscii(4, 5, 'hero');

    expect(loadSoundFromBlob).toHaveBeenCalledWith('kick', 'demo-doc');
    expect(playBlob).toHaveBeenCalledWith('snare', { gain: 0.5 }, 'demo-doc');
    expect(loadImageFromBlob).toHaveBeenCalledWith('sprite', 'demo-doc');
    expect(write).toHaveBeenNthCalledWith(1, 4, 5, 'AB', undefined, undefined);
    expect(write).toHaveBeenNthCalledWith(2, 4, 6, 'CD', undefined, undefined);

    const mouseXDescriptor = Object.getOwnPropertyDescriptor(target, 'mouseX');
    expect(mouseXDescriptor?.get).toBeTypeOf('function');
    expect(target.mouseX).toBe(12);
    expect(target.getMouseX()).toBe(12);
    expect(target.atob('abc')).toBe('decoded:abc');
    expect(target.btoa('abc')).toBe('encoded:abc');
  });

  it('augments the random capability from runtime pack modules', () => {
    const target: Record<string, any> = {};
    const mulberry32 = vi.fn((seed: number) => () => seed / 0xffffffff);
    const getRandomValues = vi.fn((values: Uint32Array) => {
      values[0] = 1234567890;
      return values;
    });

    installRuntimePackCapabilityApi(target, ['random'], {
      random: [{ mulberry32 }],
    }, {
      globalObject: {
        crypto: { getRandomValues },
      } as typeof globalThis,
    });

    expect(typeof target.random.seed).toBe('function');
    expect(typeof target.random.rng).toBe('function');
    expect(target.random.seed()).toBe(1234567890);
    expect(getRandomValues).toHaveBeenCalledTimes(1);

    const rng = target.random.rng(7);
    expect(mulberry32).toHaveBeenCalledWith(7);
    expect(rng()).toBeCloseTo(7 / 0xffffffff);
  });

  it('augments the gui capability from runtime pack modules when guiFactory hooks are provided', () => {
    const createGUIAPI = vi.fn(() => ({ init: vi.fn(), createButton: vi.fn() }));
    const getMetrics = vi.fn(() => ({ charWidth: 10, charHeight: 16 }));
    const getStyle = vi.fn((name: string) => ({ name }));
    const isTrustedUserInput = vi.fn(() => true);
    const getPixelScale = vi.fn(() => ({ scaleX: 2, scaleY: 2 }));
    const getViewportRect = vi.fn(() => ({ x: 0, y: 0, width: 320, height: 240 }));
    const getSafeAreaInsets = vi.fn(() => ({ top: 1, right: 2, bottom: 3, left: 4 }));
    const getCurrentWorldSection = vi.fn(() => 7);
    const resolveWorldSectionSelector = vi.fn((selector: number | string) => Number(selector));

    const target: Record<string, any> = {
      getStyle,
    };

    installRuntimePackCapabilityApi(target, ['gui'], {
      gui: [{ createGUIAPI }],
    }, {
      guiFactory: {
        getMetrics,
        getStyle,
        isTrustedUserInput,
        getPixelScale,
        getViewportRect,
        getSafeAreaInsets,
        getCurrentWorldSection,
        resolveWorldSectionSelector,
      },
    });

    expect(createGUIAPI).toHaveBeenCalledWith(
      getMetrics,
      getStyle,
      isTrustedUserInput,
      getPixelScale,
      getViewportRect,
      getSafeAreaInsets,
      getCurrentWorldSection,
      resolveWorldSectionSelector,
    );
    expect(target.gui).toEqual(expect.objectContaining({ init: expect.any(Function) }));
  });

  it('augments the tui capability from runtime pack modules when tuiFactory hooks are provided', () => {
    const createTUIAPI = vi.fn(() => ({ init: vi.fn(), createButton: vi.fn() }));
    const renderer = { setCell: vi.fn() };
    const getCellBuffer = vi.fn(() => [[{ char: ' ' }]]);
    const getStyle = vi.fn((name: string) => ({ name }));
    const isTrustedUserInput = vi.fn(() => true);

    const target: Record<string, any> = {
      getStyle,
    };

    installRuntimePackCapabilityApi(target, ['gui'], {
      gui: [{ createTUIAPI }],
    }, {
      tuiFactory: {
        renderer,
        getCellBuffer,
        getStyle,
        isTrustedUserInput,
      },
    });

    expect(createTUIAPI).toHaveBeenCalledWith(
      renderer,
      getCellBuffer,
      getStyle,
      isTrustedUserInput,
    );
    expect(target.tui).toEqual(expect.objectContaining({ init: expect.any(Function) }));
  });
});