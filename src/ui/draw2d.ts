import type { Color } from '../types.js';

export type Draw2DPoint = { x: number; y: number };

export interface Draw2DColorUtils {
  rgb(r: number, g: number, b: number): Color;
  rgba(r: number, g: number, b: number, a: number): Color;
  from?(value: unknown): Color;
}

/**
 * Minimal 2D drawing surface used by the retained GUI system.
 *
 * This interface is intentionally small and maps to the primitive operations
 * that the engine can implement efficiently across backends.
 */
export interface Draw2D {
  rect(x: number, y: number, w: number, h: number, color: Color): void;
  text(text: string, x: number, y: number, color: Color, scale?: number): void;
  measureTextWidth?(text: string, scale?: number): number;

  /**
   * Draw a previously loaded image by id.
   * The id is provided by the sandbox ui API (e.g. ui.loadImage()).
   */
  image?(imageId: string, x: number, y: number, w: number, h: number, options?: {
    tint?: Color;
    uv?: { u: number; v: number; w: number; h: number };
  }): void;
  getImageSize?(imageId: string): { width: number; height: number } | null;

  // Optional helpers (only available on certain renderers/backends).
  clear?(color: Color): void;

  // Rectangular clipping (scissor).
  pushClipRect?(x: number, y: number, w: number, h: number): void;
  popClipRect?(): void;

  // Stencil masking.
  pushMaskRect?(x: number, y: number, w: number, h: number): void;
  pushMaskRoundedRect?(x: number, y: number, w: number, h: number, radius: number): void;
  pushMaskPolygon?(points: Array<Draw2DPoint>): void;
  popMask?(): void;

  // Optional conveniences exposed by the sandbox ui API.
  colors?: Draw2DColorUtils;
  metrics?: { charWidth?: number; charHeight?: number };
}

export type WidgetDrawKind = 'button' | 'label' | 'checkbox' | 'slider' | 'pianoKeyboard' | 'textField' | 'textEditor' | 'markdownView' | 'unknown';

export type WidgetDrawInfoCommon = {
  id: string;
  bounds: { x: number; y: number; width: number; height: number };
  state: { visible: boolean; enabled: boolean; hovered: boolean; focused: boolean; pressed: boolean };
  group: string | number;
  metrics: { charWidth: number; charHeight: number };
};

export type WidgetDrawInfo =
  | (WidgetDrawInfoCommon & { kind: 'button'; label: string })
  | (WidgetDrawInfoCommon & { kind: 'label'; text: string; align: string })
  | (WidgetDrawInfoCommon & { kind: 'checkbox'; label: string; checked: boolean })
  | (WidgetDrawInfoCommon & { kind: 'slider'; label: string; min: number; max: number; value: number })
  | (WidgetDrawInfoCommon & { kind: 'pianoKeyboard'; orientation: 'horizontal' | 'vertical'; activeMidi: number | null; visibleWhiteKeys: number })
  | (WidgetDrawInfoCommon & { kind: 'textField'; align: string; value: string; placeholder: string })
  | (WidgetDrawInfoCommon & { kind: 'textEditor'; align: string; value: string; placeholder: string })
  | (WidgetDrawInfoCommon & { kind: 'markdownView' })
  | (WidgetDrawInfoCommon & { kind: 'unknown' });
