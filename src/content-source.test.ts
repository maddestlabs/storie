import { describe, expect, it } from 'vitest';

import { parseMarkdownContentReference, resolveMarkdownSource } from './content-source.js';

describe('content source resolution', () => {
  it('parses supported content reference prefixes', () => {
    expect(parseMarkdownContentReference('demo:0rain')).toMatchObject({ kind: 'demo', value: '0rain', explicit: true });
    expect(parseMarkdownContentReference('gist:abc123')).toMatchObject({ kind: 'gist', value: 'abc123', explicit: true });
    expect(parseMarkdownContentReference('browser:draft')).toMatchObject({ kind: 'browser', value: 'draft', explicit: true });
    expect(parseMarkdownContentReference('decode:xyz')).toMatchObject({ kind: 'decode', value: 'xyz', explicit: true });
    expect(parseMarkdownContentReference('story.md')).toMatchObject({ kind: 'demo', value: 'story.md', explicit: false });
  });

  it('autodetects gist urls and ids', () => {
    expect(parseMarkdownContentReference('https://gist.github.com/user/863a4175989370857ccd67cb5492ac11')).toMatchObject({
      kind: 'gist',
      value: '863a4175989370857ccd67cb5492ac11',
      explicit: true,
    });
    expect(parseMarkdownContentReference('863a4175989370857ccd67cb5492ac11')).toMatchObject({
      kind: 'gist',
      value: '863a4175989370857ccd67cb5492ac11',
      explicit: true,
    });
  });

  it('resolves files as canonical markdown sources when a file exists', async () => {
    const result = await resolveMarkdownSource('docs/demos/0rain.md', {
      fileExists: async (path) => path === 'docs/demos/0rain.md',
      readTextFile: async (path) => `file:${path}`,
      demoPaths: ['docs/demos/{name}'],
    });

    expect(result).toEqual({
      kind: 'file',
      sourceRef: 'docs/demos/0rain.md',
      sourcePath: 'docs/demos/0rain.md',
      markdown: 'file:docs/demos/0rain.md',
    });
  });

  it('resolves demos through configured demo paths', async () => {
    const result = await resolveMarkdownSource('demo:0rain', {
      demoPaths: ['docs/demos/{name}', '{name}'],
      readTextFile: async (path) => {
        if (path === 'docs/demos/0rain.md') return '# 0RAIN';
        throw new Error(`unexpected path ${path}`);
      },
      fileExists: async (path) => path === 'docs/demos/0rain.md',
    });

    expect(result).toEqual({
      kind: 'demo',
      sourceRef: 'demo:0rain',
      sourcePath: 'docs/demos/0rain.md',
      markdown: '# 0RAIN',
    });
  });

  it('resolves gist markdown from the first markdown file in the payload', async () => {
    const result = await resolveMarkdownSource('gist:abc123', {
      fetchJson: async () => ({
        files: {
          'notes.txt': { content: 'ignore' },
          'story.md': { content: '# Story' },
        },
      }),
    });

    expect(result).toEqual({
      kind: 'gist',
      sourceRef: 'gist:abc123',
      sourcePath: 'story.md',
      markdown: '# Story',
    });
  });

  it('resolves browser content with storie_ key fallback', async () => {
    const result = await resolveMarkdownSource('browser:draft', {
      getStoredText: async (key) => (key === 'storie_draft' ? '# Draft' : null),
    });

    expect(result).toEqual({
      kind: 'browser',
      sourceRef: 'browser:draft',
      sourcePath: 'draft',
      markdown: '# Draft',
    });
  });

  it('resolves decode content through injected decompression', async () => {
    const result = await resolveMarkdownSource('decode:abc', {
      decompressText: async (compressed) => `decoded:${compressed}`,
    });

    expect(result).toEqual({
      kind: 'decode',
      sourceRef: 'decode:abc',
      sourcePath: 'decode:abc',
      markdown: 'decoded:abc',
    });
  });
});