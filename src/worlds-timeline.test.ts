import { describe, expect, it } from 'vitest';

import {
  compileWorldsTimeline,
  stateAtWorldsTimeline,
} from './worlds-timeline.js';

describe('worlds timeline', () => {
  it('compiles section patch events and merges them over time', () => {
    const track = compileWorldsTimeline([
      { ms: 0, text: '{"section":"intro","content":"Hello","visible":true}' },
      { ms: 1000, text: '{"section":"intro","set":{"title":"Intro Card"}}' },
      { ms: 2000, text: '{"section":"intro","position":{"x":10},"rotation":{"y":15}}' },
      { ms: 2500, text: '{"section":"intro","position":{"y":20}}' },
    ]);

    expect(track.sections).toEqual(['intro']);

    const state = stateAtWorldsTimeline(track, 3);
    expect(state).toEqual([
      {
        section: 'intro',
        patch: {
          content: 'Hello',
          visible: true,
          title: 'Intro Card',
          position: { x: 10, y: 20 },
          rotation: { y: 15 },
        },
      },
    ]);
  });

  it('supports shorthand transform aliases and ignores invalid entries', () => {
    const track = compileWorldsTimeline([
      { ms: 0, text: '{"section":"hero","x":12,"rotate-y":30,"scale":1.5}' },
      { ms: 1000, text: '{"section":"hero","scale-y":2}' },
      { ms: 1200, text: 'not json' },
      { ms: 1500, text: '{"call":"noop"}' },
    ]);

    expect(stateAtWorldsTimeline(track, 2)).toEqual([
      {
        section: 'hero',
        patch: {
          position: { x: 12 },
          rotation: { y: 30 },
          scale: { x: 1.5, y: 2, z: 1.5 },
        },
      },
    ]);
  });
});