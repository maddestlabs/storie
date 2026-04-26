import { readFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

import { CompilePolicyError, compileMarkdownApp, validateMarkdownApp } from './compile.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..', '..');

describe('compileMarkdownApp warning manifest', () => {
  it('preserves structured analyzer warnings in the manifest', async () => {
    const compiled = await compileMarkdownApp([
      '```js',
      'const ctx = audio.context;',
      'await modules.load("babylon");',
      '```',
    ].join('\n'));

    expect(compiled.manifest.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPPORT003',
          severity: 'error',
          category: 'portability',
        }),
        expect.objectContaining({
          code: 'CPDYN001',
          severity: 'warning',
          category: 'dynamic-behavior',
        }),
      ])
    );
    expect(compiled.manifest.portabilityProfile).toBe('js');
  });

  it('allows js profile compilation even with portability violations', async () => {
    await expect(compileMarkdownApp([
      '```js',
      'const ctx = audio.context;',
      '```',
    ].join('\n'), {
      portabilityProfile: 'js',
    })).resolves.toBeTruthy();
  });

  it('fails portable profile compilation on error-severity warnings', async () => {
    await expect(compileMarkdownApp([
      '```js',
      'const ctx = audio.context;',
      '```',
    ].join('\n'), {
      portabilityProfile: 'portable',
    })).rejects.toMatchObject({
      name: 'CompilePolicyError',
      profile: 'portable',
      warnings: expect.arrayContaining([
        expect.objectContaining({ code: 'CPPORT003' })
      ])
    });
  });

  it('fails nim profile compilation on portability warnings, including adapter surfaces', async () => {
    await expect(compileMarkdownApp([
      '```js',
      'audio.playTone(440, 0.25);',
      '```',
    ].join('\n'), {
      portabilityProfile: 'nim',
    })).rejects.toBeInstanceOf(CompilePolicyError);
  });

  it('allows nim profile when only portable subset is used', async () => {
    const compiled = await compileMarkdownApp([
      '```js',
      'const entries = doc.timedBlock("lyrics");',
      'term.write(0, 0, String(entries.length));',
      '```',
    ].join('\n'), {
      portabilityProfile: 'nim',
    });

    expect(compiled.manifest.portabilityProfile).toBe('nim');
  });

  it('allows nim profile when using the portable audio handle layer', async () => {
    const compiled = await compileMarkdownApp([
      '```js',
      'const clip = await audio.asset.fromBlob("intro");',
      'if (clip) {',
      '  const voice = audio.play(clip, { gain: 0.7, offsetSec: 2 });',
      '  if (voice) {',
      '    audio.setPlaybackRate(voice, 1.1);',
      '    audio.stop(voice);',
      '  }',
      '}',
      '```',
    ].join('\n'), {
      portabilityProfile: 'nim',
    });

    expect(compiled.manifest.portabilityProfile).toBe('nim');
  });

  it('reports blocking warnings without throwing via validateMarkdownApp', async () => {
    const result = await validateMarkdownApp([
      '```js',
      'audio.playTone(440, 0.25);',
      '```',
    ].join('\n'), {
      portabilityProfile: 'nim',
    });

    expect(result.ok).toBe(false);
    expect(result.blockingWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CPPORT002' })
      ])
    );
  });

  it('reports non-blocking warnings in js profile validation', async () => {
    const result = await validateMarkdownApp([
      '```js',
      'const ctx = audio.context;',
      '```',
    ].join('\n'), {
      portabilityProfile: 'js',
    });

    expect(result.ok).toBe(true);
    expect(result.analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CPPORT003' })
      ])
    );
    expect(result.blockingWarnings).toEqual([]);
  });

  it('emits manifest-driven kernel and capability scaffold files', async () => {
    const compiled = await compileMarkdownApp([
      '```js',
      'term.write(0, 0, "hi");',
      'const seed = random.seed();',
      'audio.playTone(440, 0.25);',
      '```',
    ].join('\n'));

    const files = new Map(compiled.files.map((file) => [file.path, file.contents]));

    expect(files.has('capabilities.js')).toBe(true);
    expect(files.has('kernel.js')).toBe(true);

    expect(files.get('capabilities.js')).toContain('export const requiredCapabilityPacks');
    expect(files.get('capabilities.js')).toContain('createCompiledCapabilityAPI');
    expect(files.get('capabilities.js')).toContain("import { installDocumentCapabilityApiGlobals, installRuntimePackCapabilityApi } from 'storie/runtime/capability-api';");
    expect(files.get('capabilities.js')).toContain("import { runtimePackModules } from './runtime-packs.js';");
    expect(files.get('capabilities.js')).toContain('documentId: options.documentId ?? compiledDocumentId');
    expect(files.get('capabilities.js')).toContain('installRuntimePackCapabilityApi(selected, requiredCapabilityPacks, runtimePackModules');
    expect(files.get('capabilities.js')).toContain('documentId: options.documentId ?? compiledDocumentId');
    expect(files.get('capabilities.js')).toContain('audioContextRuntime: options.audioContextRuntime');
    expect(files.get('capabilities.js')).toContain('audioAssetDecoder: options.audioAssetDecoder');
    expect(files.get('capabilities.js')).toContain('audioExportCapture: options.audioExportCapture');
    expect(files.get('capabilities.js')).toContain('audioBufferFactory: options.audioBufferFactory');
    expect(files.get('capabilities.js')).toContain('guiFactory: options.guiFactory');
    expect(files.get('capabilities.js')).toContain('tuiFactory: options.tuiFactory');
    expect(files.get('capabilities.js')).toContain('stfxrDocumentStore: options.stfxrDocumentStore');
    expect(files.get('capabilities.js')).toContain('stfxrBakedStore: options.stfxrBakedStore');
    expect(files.get('capabilities.js')).toContain('export const runtimePackConstructibleApi');
    expect(files.get('capabilities.js')).toContain('export const hostRequiredApi');
    expect(files.get('capabilities.js')).toContain('export const capabilityStatus');
    expect(files.get('capabilities.js')).toContain('export const capabilitySurfaceDetails');
    expect(files.get('capabilities.js')).toContain('export const capabilityHostAdapters');
    expect(files.get('capabilities.js')).toContain('export const runtimePackImports');
    expect(files.get('capabilities.js')).toContain('storie/runtime/audio-pack');
    expect(files.get('runtime-packs.js')).toContain('import * as runtimePack0 from "storie/runtime/audio-pack";');
    expect(files.get('runtime-packs.js')).toContain('export const runtimePackModules');
    expect(files.get('capabilities.js')).toContain('"audio"');
    expect(files.get('capabilities.js')).toContain('"terminal"');
    expect(files.get('capabilities.js')).toContain('"random"');
    expect(files.get('capabilities.js')).toContain('"stfxr"');

    expect(files.get('kernel.js')).toContain('export function createCompiledKernel');
    expect(files.get('kernel.js')).toContain('createCompiledCapabilityAPI(api, options)');

    expect(files.get('runtime.js')).toContain("import { createCompiledKernel } from './kernel.js';");
    expect(files.get('runtime.js')).toContain("import { runtimePackModules } from './runtime-packs.js';");
    expect(files.get('runtime.js')).toContain('return { ...createCompiledKernel(api, options), runtimePackModules };');

    expect(files.get('main.js')).toContain('describeCompiledRuntimeAssembly');
  });

  it('preserves declared frontmatter capability requirements in the manifest', async () => {
    const compiled = await compileMarkdownApp([
      '---',
      'requires: audio, worlds',
      '---',
      '',
      'hello',
    ].join('\n'));

    expect(compiled.manifest.capabilityPacks).toEqual(
      expect.arrayContaining(['audio', 'worlds'])
    );
  });

  it('preserves document contract metadata in manifest and scaffold output', async () => {
    const compiled = await compileMarkdownApp([
      '---',
      'exports: score, currentPreset',
      'accepts: audioGraph',
      'hostPermissions: clipboard-read, clipboard-write',
      '---',
      '',
      'hello',
    ].join('\n'));

    expect(compiled.manifest.documentContract).toEqual({
      exports: ['score', 'currentPreset'],
      accepts: ['audioGraph'],
      hostPermissions: ['clipboard-read', 'clipboard-write'],
    });
    expect(compiled.manifest.runtimeAssembly.runtimePackConstructibleApi).toEqual([]);
    expect(compiled.manifest.runtimeAssembly.hostRequiredApi).toEqual(['doc', 'getDelta', 'getFrame', 'getTime']);
    expect(compiled.manifest.runtimeAssembly.capabilityStatus).toEqual({});
    expect(compiled.manifest.runtimeAssembly.capabilitySurfaceDetails).toEqual({});
    expect(compiled.manifest.runtimeAssembly.capabilityHostAdapters).toEqual({});

    const files = new Map(compiled.files.map((file) => [file.path, file.contents]));
    expect(files.get('capabilities.js')).toContain('export const documentContract');
    expect(files.get('capabilities.js')).toContain('export function allowsHostPermission');
    expect(files.get('capabilities.js')).toContain('clipboard-read');
    expect(files.get('README.md')).toContain('Document contract:');
    expect(files.get('README.md')).toContain('exports: score, currentPreset');
    expect(files.get('README.md')).toContain('runtime-pack constructible api: (none)');
    expect(files.get('README.md')).toContain('host-required api: doc, getDelta, getFrame, getTime');
    expect(files.get('README.md')).toContain('capability status: (none)');
    expect(files.get('README.md')).toContain('capability surface details: (none)');
    expect(files.get('README.md')).toContain('capability host adapters: (none)');
  });

  it('compiles the 0rain demo as a regression fixture', async () => {
    const markdown = await readFile(resolve(rootDir, 'docs/demos/0rain.md'), 'utf8');
    const compiled = await compileMarkdownApp(markdown, {
      sourcePath: 'docs/demos/0rain.md',
      portabilityProfile: 'js',
    });

    expect(compiled.manifest.sourcePath).toBe('docs/demos/0rain.md');
    expect(compiled.manifest.capabilityPacks).toEqual(
      expect.arrayContaining(['audio', 'gui', 'ui', 'worlds', 'shader', 'input', 'themes', 'random'])
    );
    expect(compiled.manifest.runtimeAssembly.capabilityStatus).toEqual(
      expect.objectContaining({
        gui: 'pack-constructible',
        random: 'pack-constructible',
        audio: 'hybrid',
      })
    );
    expect(compiled.manifest.runtimeAssembly.capabilitySurfaceDetails).toEqual(
      expect.objectContaining({
        audio: expect.objectContaining({
          packConstructible: expect.arrayContaining(['audio.peaksFromBuffer', 'stfxr.parsePreset']),
          hostRequired: expect.arrayContaining(['audio.play', 'stfxr.play']),
        }),
      })
    );
    expect(compiled.manifest.runtimeAssembly.capabilityHostAdapters).toEqual(
      expect.objectContaining({
        audio: expect.arrayContaining(['audio-context-runtime', 'stfxr-document-store']),
      })
    );
    expect(compiled.manifest.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'CPPORT002' })
      ])
    );

    const files = new Map(compiled.files.map((file) => [file.path, file.contents]));
    expect(files.get('capabilities.js')).toContain('requiredCapabilityPacks');
    expect(files.get('kernel.js')).toContain('createCompiledKernel');
  });
});