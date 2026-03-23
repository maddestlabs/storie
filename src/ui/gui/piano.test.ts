import { describe, expect, it } from 'vitest';

import { GUIPianoKeyboard, buildPianoLayout, collectWhiteMidis, formatMidiNoteName, midiToHz } from './piano.js';

describe('GUI piano keyboard', () => {
  it('builds a horizontal layout with visible white and black keys', () => {
    const layout = buildPianoLayout({
      bounds: { x: 0, y: 0, width: 700, height: 160 },
      orientation: 'horizontal',
      noteFlow: 'asc',
      railPlacement: 'leading',
      railThickness: 24,
      railPadding: 4,
      minThumbLength: 18,
      minMidi: 60,
      maxMidi: 72,
      firstVisibleWhiteKey: 0,
      visibleWhiteKeys: 7,
      blackKeyLengthRatio: 0.62,
      blackKeyWidthRatio: 0.7
    });

    expect(layout.whiteKeys.map((key) => key.midi)).toEqual([60, 62, 64, 65, 67, 69, 71]);
    expect(layout.blackKeys.map((key) => key.midi)).toEqual([61, 63, 66, 68, 70]);
    expect(layout.blackKeys[0].bounds.height).toBeLessThan(layout.whiteKeys[0].bounds.height);
  });

  it('supports vertical descending note flow for piano-roll style gutters', () => {
    const layout = buildPianoLayout({
      bounds: { x: 0, y: 0, width: 120, height: 560 },
      orientation: 'vertical',
      noteFlow: 'desc',
      railPlacement: 'trailing',
      railThickness: 22,
      railPadding: 4,
      minThumbLength: 18,
      minMidi: 60,
      maxMidi: 72,
      firstVisibleWhiteKey: 0,
      visibleWhiteKeys: 7,
      blackKeyLengthRatio: 0.62,
      blackKeyWidthRatio: 0.7
    });

    const c4 = layout.whiteKeys.find((key) => key.midi === 60);
    const b4 = layout.whiteKeys.find((key) => key.midi === 71);

    expect(c4).toBeTruthy();
    expect(b4).toBeTruthy();
    expect((c4 as any).bounds.y).toBeGreaterThan((b4 as any).bounds.y);
  });

  it('clamps zoom and pan against the available white-key range', () => {
    const piano = new GUIPianoKeyboard({
      bounds: { x: 0, y: 0, width: 640, height: 140 },
      minMidi: 48,
      maxMidi: 84,
      visibleWhiteKeys: 12,
      minVisibleWhiteKeys: 6,
      maxVisibleWhiteKeys: 16
    });

    piano.zoomBy(-20);
    expect(piano.visibleWhiteKeys).toBe(6);

    piano.panWhiteKeys(999);
    const totalWhiteKeys = collectWhiteMidis(48, 84).length;
    expect(piano.firstVisibleWhiteKey).toBe(totalWhiteKeys - piano.visibleWhiteKeys);
  });

  it('formats note names and midi frequencies consistently', () => {
    expect(formatMidiNoteName(60)).toBe('C4');
    expect(Math.round(midiToHz(69))).toBe(440);
  });

  it('emits combined rail pan and resize gestures with suggested bounds', () => {
    const piano = new GUIPianoKeyboard({
      bounds: { x: 0, y: 100, width: 640, height: 140 },
      minMidi: 48,
      maxMidi: 84,
      visibleWhiteKeys: 12,
      railPlacement: 'leading',
      railGestureMode: 'scroll-resize',
      railResizeMinCrossSize: 96,
      railResizeMaxCrossSize: 220
    });
    const events: any[] = [];
    piano.on('railgesture', (event) => events.push(event));

    const layout = piano.getLayoutSnapshot();
    const startX = Math.round(layout.railBounds!.x + layout.railBounds!.width / 2);
    const startY = Math.round(layout.railBounds!.y + layout.railBounds!.height / 2);

    piano.handlePointer(startX, startY, true);
    piano.handlePointer(startX + 36, startY - 20, true);
    piano.handlePointer(startX + 36, startY - 20, false);

    expect(events.map((event) => event.data.phase)).toEqual(['start', 'drag', 'end']);
    expect(events[1].data.suggestedBounds.height).toBe(160);
    expect(events[1].data.suggestedBounds.y).toBe(80);
    expect(events[1].data.deltaAlong).toBe(36);
    expect(events[1].data.deltaCross).toBe(-20);
  });
});