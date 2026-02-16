import type { Color } from '../../types.js';

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'code'; text: string }
  | { kind: 'newline' };

export type DocNode =
  | { kind: 'heading'; level: number; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; items: Inline[][] }
  | { kind: 'codeblock'; code: string; lang?: string; metadata?: Record<string, string> };

export interface TextMetrics {
  charW: number;
  charH: number;
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
  headingFg: Color;
  linkFg: Color;
  codeFg: Color;
  codeBg: Color;
  bg: Color;
}

export type DrawOp =
  | { kind: 'rect'; x: number; y: number; w: number; h: number; color: Color }
  | { kind: 'text'; text: string; x: number; y: number; color: Color };

export interface LinkRegion {
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  text: string;
}

export interface LayoutResult {
  ops: DrawOp[];
  linkRegions: LinkRegion[];
  contentHeight: number;
}
