import type { Color } from '../../types.js';

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'code'; text: string }
  | { kind: 'widget'; widget: WidgetSpec }
  | { kind: 'newline' };

export type DocNode =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; items: Inline[][]; ordered: boolean; start?: number }
  | { kind: 'image'; alt: string; source: string; title?: string; align?: 'left' | 'center' | 'right'; width?: string }
  | { kind: 'widget'; widget: WidgetSpec }
  | { kind: 'callout'; tone: 'note' | 'info' | 'tip' | 'warning' | 'important' | 'caution'; title?: string; nodes: DocNode[] }
  | { kind: 'blockquote'; nodes: DocNode[] }
  | { kind: 'hr' }
  | { kind: 'codeblock'; code: string; lang?: string; metadata?: Record<string, string> };

export interface WidgetSpec {
  type: 'button' | 'slider' | 'checkbox' | 'label';
  id: string;
  label?: string;
  text?: string;
  min?: number;
  max?: number;
  value?: number;
  step?: number;
  showValue?: boolean;
  checked?: boolean;
  align?: 'left' | 'center' | 'right';
  width?: string;
  scale?: 'gui' | 'worlds';
}

export interface TextMetrics {
  charW: number;
  charH: number;
  /** Optional: when provided, layout uses this for pixel-accurate wrapping/advances (proportional fonts). */
  measureTextWidth?: (text: string) => number;
  /** Optional: returns intrinsic image dimensions for a markdown image source when known. */
  getImageSize?: (source: string) => { width: number; height: number } | null;
}

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MarkdownStyle {
  fg: Color;
  mutedFg: Color;
  borderFg: Color;
  surfaceBg: Color;
  headingFg: Color;
  listMarker?: string | null;
  listMarkerFg?: Color;
  listMarkerGapPx?: number;
  listHangIndentPx?: number;
  linkFg: Color;
  activeLinkFg?: Color;
  activeLinkIndex?: number | null;
  linkUnderline?: boolean;
  infoFg: Color;
  successFg: Color;
  warningFg: Color;
  errorFg: Color;
  codeFg: Color;
  codeBg: Color;
  bg: Color;
}

export type DrawOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: Color }
  | { kind: 'image'; source: string; x: number; y: number; w: number; h: number; alt?: string }
  | { kind: 'text'; text: string; x: number; y: number; color: Color };

export interface LinkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  text: string;
}

export interface WidgetPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
  widget: WidgetSpec;
}

export interface LayoutResult {
  ops: DrawOp[];
  linkRegions: LinkRegion[];
  widgetPlacements: WidgetPlacement[];
  contentWidth: number;
  contentHeight: number;
}

export interface LayoutOptions {
  overflow?: 'clip' | 'expand';
  widgetPlaceholderMode?: 'full' | 'frame' | 'none';
}
