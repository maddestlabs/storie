import { describe, expect, it } from 'vitest';

import { layoutMarkdownDocument } from './layout.js';
import { parseMarkdownLite } from './markdown-lite.js';
import type { MarkdownStyle } from './types.js';

const style: MarkdownStyle = {
  fg: 0x111111ff,
  mutedFg: 0x222222ff,
  borderFg: 0x2a2a2aff,
  surfaceBg: 0x2b2b2bff,
  headingFg: 0x333333ff,
  textAlign: 'left',
  linkFg: 0x444444ff,
  infoFg: 0x4a90e2ff,
  successFg: 0x3bb273ff,
  warningFg: 0xf5a623ff,
  errorFg: 0xd0021bff,
  codeFg: 0x555555ff,
  codeBg: 0x666666ff,
  bg: 0x00000000,
};

describe('parseMarkdownLite', () => {
  it('parses blockquotes and horizontal rules as explicit nodes', () => {
    const nodes = parseMarkdownLite('> Quoted line\n>\n> Still quoted\n\n---\n\nParagraph');

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ kind: 'blockquote' });
    expect((nodes[0] as any).nodes).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Quoted line' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'Still quoted' }] }
    ]);
    expect(nodes[1]).toEqual({ kind: 'hr' });
    expect(nodes[2]).toMatchObject({ kind: 'paragraph' });
  });

  it('parses callout blockquotes as callout nodes', () => {
    const nodes = parseMarkdownLite('> [!NOTE] Renderer status\n> Shared markdown renderer is active.');

    expect(nodes[0]).toEqual({
      kind: 'callout',
      tone: 'note',
      title: 'Renderer status',
      nodes: [{ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Shared markdown renderer is active.' }] }]
    });
  });

  it('parses standalone markdown images as image nodes', () => {
    const nodes = parseMarkdownLite('![Status Diagram](status-card)\n\nParagraph');

    expect(nodes[0]).toEqual({ kind: 'image', alt: 'Status Diagram', source: 'status-card' });
    expect(nodes[1]).toMatchObject({ kind: 'paragraph' });
  });

  it('parses image width and alignment metadata from the title field', () => {
    const nodes = parseMarkdownLite('![Status Diagram](status-card "width:50% align:center")');

    expect(nodes[0]).toEqual({ kind: 'image', alt: 'Status Diagram', source: 'status-card', width: '50%', align: 'center' });
  });

  it('parses gui fences into widget nodes', () => {
    const nodes = parseMarkdownLite('```gui\ntype: slider\nid: mix\nlabel: Mix\nmin: 0\nmax: 1\nvalue: 0.35\nstep: 0.05\nshowValue: false\nwidth: 60%\nalign: center\nscale: worlds\n```');

    expect(nodes[0]).toEqual({
      kind: 'widget',
      widget: {
        type: 'slider',
        id: 'mix',
        label: 'Mix',
        min: 0,
        max: 1,
        value: 0.35,
        step: 0.05,
        showValue: false,
        width: '60%',
        align: 'center',
        scale: 'worlds'
      }
    });
  });

  it('parses inline gui directives inside paragraphs', () => {
    const nodes = parseMarkdownLite('Press :gui{type:button, id:inline-fire, label:"Fire", scale:worlds} now.');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      kind: 'paragraph',
      inlines: [
        { kind: 'text', text: 'Press ' },
        { kind: 'widget', widget: { type: 'button', id: 'inline-fire', label: 'Fire', scale: 'worlds' } },
        { kind: 'text', text: ' now.' }
      ]
    });
  });

  it('parses per-item list-icon directive objects on unordered lists', () => {
    const nodes = parseMarkdownLite('- First {"list-icon":"➵"}\n- Second\n- Third {list-icon: "✦"}');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toEqual({
      kind: 'list',
      ordered: false,
      items: [
        { inlines: [{ kind: 'text', text: 'First' }], markerText: '➵' },
        { inlines: [{ kind: 'text', text: 'Second' }], markerText: undefined },
        { inlines: [{ kind: 'text', text: 'Third' }], markerText: '✦' },
      ]
    });
  });

  it('parses emphasis and strong into inline nodes', () => {
    const nodes = parseMarkdownLite('Go *north* then **run**.');
    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      kind: 'paragraph',
      inlines: [
        { kind: 'text', text: 'Go ' },
        { kind: 'em' },
        { kind: 'text', text: ' then ' },
        { kind: 'strong' },
        { kind: 'text', text: '.' },
      ]
    });
  });

  it('parses link titles and trailing directive metadata', () => {
    const nodes = parseMarkdownLite('[grace](#grace-and-faith "Explanation") {not-a-link}\n\n[that](#that){rel:"refers-to-clause", strength: 0.9}');

    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toEqual({
      kind: 'paragraph',
      inlines: [
        { kind: 'link', text: 'grace', url: '#grace-and-faith', title: 'Explanation' },
        { kind: 'text', text: ' {not-a-link}' },
      ]
    });
    expect(nodes[1]).toEqual({
      kind: 'paragraph',
      inlines: [
        { kind: 'link', text: 'that', url: '#that', meta: { rel: 'refers-to-clause', strength: 0.9 } },
      ]
    });
  });
});

describe('layoutMarkdownDocument', () => {
  it('indents quoted content and emits quote/rule rects', () => {
    const nodes = parseMarkdownLite('> Quoted line\n\n---\n\nParagraph');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 240 },
      { charW: 8, charH: 16 },
      style,
      0,
      10
    );

    const quotedText = result.ops.find((op) => op.kind === 'text' && op.text === 'Quoted');
    const paragraphText = result.ops.find((op) => op.kind === 'text' && op.text === 'Paragraph');
    const quoteBar = result.ops.find((op) => op.kind === 'rect' && op.color === style.borderFg && op.w <= 4);
    const rule = result.ops.find((op) => op.kind === 'rect' && op.color === style.borderFg && op.w >= 200);

    expect(quotedText).toBeTruthy();
    expect(paragraphText).toBeTruthy();
    expect((quotedText as { x: number }).x).toBeGreaterThan((paragraphText as { x: number }).x);
    expect(quoteBar).toBeTruthy();
    expect(rule).toBeTruthy();
  });

  it('emits image draw ops and uses intrinsic image size when known', () => {
    const nodes = parseMarkdownLite('![Status Diagram](status-card)');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 240 },
      {
        charW: 8,
        charH: 16,
        getImageSize: (source) => source === 'status-card' ? { width: 200, height: 100 } : null,
      },
      style,
      0,
      10
    );

    const imageOp = result.ops.find((op) => op.kind === 'image');
    const placeholderFrame = result.ops.find((op) => op.kind === 'rect' && op.color === style.borderFg && op.w >= 200);

    expect(imageOp).toBeTruthy();
    expect((imageOp as { w: number; h: number; source: string }).source).toBe('status-card');
    expect((imageOp as { w: number; h: number }).w).toBeGreaterThan((imageOp as { w: number; h: number }).h);
    expect(placeholderFrame).toBeTruthy();
  });

  it('renders centered narrow images using width metadata', () => {
    const nodes = parseMarkdownLite('![Status Diagram](status-card "width:50% align:center")');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 240 },
      {
        charW: 8,
        charH: 16,
        getImageSize: (source) => source === 'status-card' ? { width: 200, height: 100 } : null,
      },
      style,
      0,
      10
    );

    const imageOp = result.ops.find((op) => op.kind === 'image') as { x: number; w: number } | undefined;
    expect(imageOp).toBeTruthy();
    expect(imageOp!.w).toBeLessThan(220);
    expect(imageOp!.x).toBeGreaterThan(10);
  });

  it('renders callouts with background and accent bar', () => {
    const nodes = parseMarkdownLite('> [!TIP] Blob images\n> GUI markdown now shares the same asset path.');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 260, height: 260 },
      { charW: 8, charH: 16 },
      style,
      0,
      10
    );

    const tipTitle = result.ops.find((op) => op.kind === 'text' && op.text === 'Blob images');
    const calloutBg = result.ops.find((op) => op.kind === 'rect' && op.color === style.surfaceBg && op.w >= 200);
    const accentBar = result.ops.find((op) => op.kind === 'rect' && op.color === style.successFg && op.w <= 8);

    expect(tipTitle).toBeTruthy();
    expect(calloutBg).toBeTruthy();
    expect(accentBar).toBeTruthy();
  });

  it('reserves layout space and placement data for embedded widgets', () => {
    const nodes = parseMarkdownLite('Before\n\n```gui\ntype: button\nid: pulse\nlabel: Pulse\nwidth: 50%\nalign: center\n```\n\nAfter');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 280, height: 280 },
      { charW: 8, charH: 16 },
      style,
      0,
      10
    );

    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.widgetPlacements[0]).toMatchObject({
      widget: { type: 'button', id: 'pulse', label: 'Pulse' }
    });

    const buttonRect = result.ops.find((op) => op.kind === 'rect' && op.w < 200 && op.h >= 38);
    const buttonText = result.ops.find((op) => op.kind === 'text' && op.text === 'Pulse');
    expect(buttonRect).toBeTruthy();
    expect(buttonText).toBeTruthy();
  });

  it('renders per-item list-icon markers when provided', () => {
    const nodes = parseMarkdownLite('- A {"list-icon":"➵"}\n- B');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 240 },
      { charW: 8, charH: 16 },
      { ...style, listMarker: '* ' },
      0,
      10
    );

    const markerOps = result.ops.filter((op) => op.kind === 'text' && (op.text === '➵' || op.text === '* '));
    expect(markerOps.some((op) => op.kind === 'text' && op.text === '➵')).toBe(true);
    expect(markerOps.some((op) => op.kind === 'text' && op.text === '* ')).toBe(true);
  });

  it('preserves link metadata in link regions', () => {
    const nodes = parseMarkdownLite('[grace](#grace-and-faith "Explanation"){rel:"explanation"}');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 120 },
      { charW: 8, charH: 16 },
      style,
      0,
      10
    );

    expect(result.linkRegions).toEqual([
      expect.objectContaining({
        url: '#grace-and-faith',
        text: 'grace',
        title: 'Explanation',
        meta: { rel: 'explanation' },
      })
    ]);
  });

  it('renders italics using italicFg and strong as a double-draw pass', () => {
    const nodes = parseMarkdownLite('*north* and **bold**');
    const italicFg = 0xabcdef01 as any;
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 120 },
      { charW: 8, charH: 16 },
      { ...style, italicFg },
      0,
      10
    );

    const northOps = result.ops.filter((op) => op.kind === 'text' && op.text === 'north') as any[];
    expect(northOps.length).toBe(1);
    expect(northOps[0].color).toBe(italicFg);

    const boldOps = result.ops.filter((op) => op.kind === 'text' && op.text === 'bold') as any[];
    expect(boldOps.length).toBe(2);
    expect(boldOps[1].x).toBe(boldOps[0].x + 1);
  });

  it('can reserve widget space without drawing duplicate placeholder content', () => {
    const nodes = parseMarkdownLite('```gui\ntype: checkbox\nid: keep\nlabel: Keep widgets in the card\nwidth: 84%\nalign: center\n```');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 280, height: 140 },
      { charW: 8, charH: 16 },
      style,
      0,
      10,
      { widgetPlaceholderMode: 'frame' }
    );

    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.ops.filter((op) => op.kind === 'text')).toHaveLength(0);
    expect(result.ops.filter((op) => op.kind === 'rect')).toHaveLength(3);
  });

  it('lays out inline widgets inside paragraph flow', () => {
    const nodes = parseMarkdownLite('Press :gui{type:button, id:inline-fire, label:"Fire", scale:worlds} now.');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 320, height: 180 },
      { charW: 8, charH: 16 },
      style,
      0,
      10
    );

    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.widgetPlacements[0]).toMatchObject({
      widget: { type: 'button', id: 'inline-fire', label: 'Fire', scale: 'worlds' }
    });

    const beforeText = result.ops.find((op) => op.kind === 'text' && op.text === 'Press');
    const afterText = result.ops.find((op) => op.kind === 'text' && op.text === 'now.');
    expect(beforeText).toBeTruthy();
    expect(afterText).toBeTruthy();
    expect(result.widgetPlacements[0].x).toBeGreaterThan((beforeText as { x: number }).x);
    expect((afterText as { x: number }).x).toBeGreaterThan(result.widgetPlacements[0].x + result.widgetPlacements[0].w - 1);
  });

  it('centers paragraph lines when textAlign is center', () => {
    const nodes = parseMarkdownLite('Center me');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 120 },
      { charW: 8, charH: 16 },
      { ...style, textAlign: 'center' },
      0,
      10
    );

    const textOp = result.ops.find((op) => op.kind === 'text' && op.text === 'Center') as { x: number } | undefined;
    expect(textOp).toBeTruthy();
    expect(textOp!.x).toBeGreaterThan(10);
  });

  it('right-aligns paragraph lines when textAlign is right', () => {
    const nodes = parseMarkdownLite('Align right');
    const result = layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: 240, height: 120 },
      { charW: 8, charH: 16 },
      { ...style, textAlign: 'right' },
      0,
      10
    );

    const textOp = result.ops.find((op) => op.kind === 'text' && op.text === 'Align') as { x: number } | undefined;
    expect(textOp).toBeTruthy();
    expect(textOp!.x).toBeGreaterThan(58);
  });
});
