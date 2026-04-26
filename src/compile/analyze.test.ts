import { describe, expect, it } from 'vitest';

import { parseMarkdown } from '../markdown.js';
import { analyzeMarkdownDocument } from './analyze.js';

describe('analyzeMarkdownDocument portability warnings', () => {
  it('warns on backend-adapter surfaces', async () => {
    const doc = await parseMarkdown([
      '```js',
      'audio.playTone(440, 0.25);',
      'gui.createLabel({ text: "Hello" });',
      'worlds.enable();',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPPORT002',
          severity: 'warning',
          category: 'portability',
          message: expect.stringContaining('backend-adapter surfaces detected (audio legacy helpers, gui, worlds)')
        })
      ])
    );
  });

  it('warns precisely on legacy audio bridge surfaces', async () => {
    const doc = await parseMarkdown([
      '```js',
      'audio.ambient.createLayeredBed({ layers: [] });',
      'audio.buffer.create(1, 1024, audio.sampleRate);',
      'audio.captureForExport({ offset: 0, duration: 1 });',
      'audio.sfx.coin();',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPPORT002',
          message: expect.stringContaining('audio ambient bridge, audio buffer bridge, audio export bridge, audio synth bridge')
        })
      ])
    );
  });

  it('warns on js-only runtime access', async () => {
    const doc = await parseMarkdown([
      '```js',
      'const ctx = audio.context;',
      'const osc = audio.createOscillator();',
      'const gpu = webgpu.device;',
      'sys.download(new Uint8Array([1, 2, 3]), "x.bin");',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPPORT003',
          severity: 'error',
          category: 'portability',
          message: expect.stringContaining('JS-only runtime access detected (audio.context, audio raw node constructors, webgpu, sys.download)')
        })
      ])
    );
  });

  it('does not warn for the portable core subset alone', async () => {
    const doc = await parseMarkdown([
      '```js',
      'const entries = doc.timedBlock("lyrics");',
      'const seed = sys.params.get("seed", 1234);',
      'const rng = random.rng(1234);',
      'term.write(0, 0, String(entries.length));',
      'term.write(0, 1, String(seed));',
      'const beat = sys.beat.clock({ bpm: 120 });',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual([]);
  });

  it('does not warn for handle-based portable audio usage', async () => {
    const doc = await parseMarkdown([
      '```js',
      'const clip = await audio.asset.fromBlob("intro");',
      'if (clip) {',
      '  const info = audio.asset.info(clip);',
      '  const peaks = audio.analysis.peaks(clip);',
      '  const voice = audio.play(clip, { gain: 0.5, offsetSec: 1.25 });',
      '  if (voice) {',
      '    audio.setPlaybackRate(voice, 0.9);',
      '    audio.stop(voice);',
      '  }',
      '  term.write(0, 0, String(info?.durationSec ?? 0));',
      '  term.write(0, 1, String(peaks?.peaks.length ?? 0));',
      '}',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual([]);
  });

  it('keeps the existing dynamic module warning', async () => {
    const doc = await parseMarkdown([
      '```js',
      'await modules.load("babylon");',
      '```',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPDYN001',
          severity: 'warning',
          category: 'dynamic-behavior',
          message: expect.stringContaining('Dynamic modules.load usage detected')
        })
      ])
    );
  });

  it('merges declared capability requirements from frontmatter', async () => {
    const doc = await parseMarkdown([
      '---',
      'requires: audio, worlds',
      '---',
      '',
      'hello',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.capabilities).toEqual(
      expect.arrayContaining(['audio', 'worlds'])
    );
    expect(analysis.warnings).toEqual([]);
  });

  it('warns when frontmatter declares unknown capabilities', async () => {
    const doc = await parseMarkdown([
      '---',
      'requires: terminal, moonbeam',
      '---',
      '',
      'hello',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.capabilities).toEqual(
      expect.arrayContaining(['terminal'])
    );
    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPDECL001',
          severity: 'warning',
          category: 'capability',
          message: expect.stringContaining('moonbeam')
        })
      ])
    );
  });

  it('warns when frontmatter declares unknown host permissions', async () => {
    const doc = await parseMarkdown([
      '---',
      'hostPermissions: clipboard-read, moon-tunnel',
      '---',
      '',
      'hello',
    ].join('\n'));

    const analysis = analyzeMarkdownDocument(doc);

    expect(analysis.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'CPDECL002',
          severity: 'warning',
          category: 'capability',
          message: expect.stringContaining('moon-tunnel')
        })
      ])
    );
  });
});