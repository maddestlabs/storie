import { describe, expect, it } from 'vitest';

import { parseMarkdown } from './markdown.js';
import { getDefaultWorldsConfig, parseSectionMetadata, parseTransform3D } from './worlds.js';

describe('heading directives', () => {
  it('parses relaxed heading directives and strips them from section titles', async () => {
    const doc = await parseMarkdown([
      '# Card One {x: 90, y: 0, z: -30, rotate-y: -18, hidden: true, timed: 4.5s}',
      '',
      'Body'
    ].join('\n'));

    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0]).toMatchObject({
      id: 'card-one-1',
      title: 'Card One',
      timedMs: 4500,
      directive: {
        x: 90,
        y: 0,
        z: -30,
        'rotate-y': -18,
        hidden: true,
        timed: '4.5s'
      }
    });
  });

  it('keeps legacy Worlds metadata parsing aligned with relaxed directives', () => {
    expect(parseSectionMetadata('Card One {x: 90, rotate-y: -18, interactive: false}')).toEqual({
      x: '90',
      'rotate-y': '-18',
      interactive: 'false'
    });
  });

  it('parses render mode metadata for Worlds layouts', async () => {
    const doc = await parseMarkdown([
      '# Card One {render: content}',
      '',
      'Body'
    ].join('\n'));

    const layout = parseTransform3D(doc.sections[0], 0, getDefaultWorldsConfig());
    expect(layout.sectionId).toBe('card-one-1');
    expect(layout.renderMode).toBe('content');
  });

  it('uses config sectionRender as the default render mode', async () => {
    const doc = await parseMarkdown([
      '# Card One',
      '',
      'Body'
    ].join('\n'));

    const layout = parseTransform3D(doc.sections[0], 0, {
      ...getDefaultWorldsConfig(),
      sectionRender: 'content'
    });
    expect(layout.renderMode).toBe('content');
  });

  it('lets section render metadata override config sectionRender', async () => {
    const doc = await parseMarkdown([
      '# Card One {render: heading}',
      '',
      'Body'
    ].join('\n'));

    const layout = parseTransform3D(doc.sections[0], 0, {
      ...getDefaultWorldsConfig(),
      sectionRender: 'content'
    });
    expect(layout.renderMode).toBe('heading');
  });

  it('falls back to render all for unknown render modes', async () => {
    const doc = await parseMarkdown([
      '# Card One {render: mystery}',
      '',
      'Body'
    ].join('\n'));

    const layout = parseTransform3D(doc.sections[0], 0, getDefaultWorldsConfig());
    expect(layout.renderMode).toBe('all');
  });

  it('parses per-section content and text alignment metadata', async () => {
    const doc = await parseMarkdown([
      '# Card One {render: content, contentAlign: center, textAlign: right}',
      '',
      'Body'
    ].join('\n'));

    const layout = parseTransform3D(doc.sections[0], 0, getDefaultWorldsConfig());
    expect(layout.contentAlign).toBe('center');
    expect(layout.textAlign).toBe('right');
  });

  it('assigns unique stable ids to duplicate section titles', async () => {
    const doc = await parseMarkdown([
      '# Card One',
      '',
      'Body',
      '',
      '# Card One',
      '',
      'More body'
    ].join('\n'));

    expect(doc.sections.map((section) => section.id)).toEqual(['card-one-1', 'card-one-5']);
  });
});