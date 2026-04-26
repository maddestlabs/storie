import type { RenderableImageSource } from './renderable-image.js';

export type BorderEdgeMode = 'tile' | 'stretch';

export interface NineSliceBorderCuts {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ImageNineSliceBorderSpec {
  kind: 'image9';
  source: string;
  cuts: NineSliceBorderCuts;
  edgeMode?: BorderEdgeMode | Partial<Record<'top' | 'right' | 'bottom' | 'left', BorderEdgeMode>>;
  opacity?: number;
  scale?: number;
  inset?: number;
}

export type DecorativeBorderSpec = ImageNineSliceBorderSpec;
export function normalizeDecorativeBorderSpec(value: unknown): DecorativeBorderSpec | null {
  if (!value || typeof value !== 'object') return null;
  const spec = value as Record<string, any>;
  if (spec.kind !== 'image9') return null;
  if (typeof spec.source !== 'string' || !spec.source.trim()) return null;
  const cuts = spec.cuts;
  if (!cuts || typeof cuts !== 'object') return null;
  const left = Number((cuts as any).left);
  const right = Number((cuts as any).right);
  const top = Number((cuts as any).top);
  const bottom = Number((cuts as any).bottom);
  if (!(Number.isFinite(left) && Number.isFinite(right) && Number.isFinite(top) && Number.isFinite(bottom))) return null;

  return {
    kind: 'image9',
    source: spec.source,
    cuts: { left, right, top, bottom },
    edgeMode: spec.edgeMode,
    opacity: Number.isFinite(spec.opacity) ? spec.opacity : undefined,
    scale: Number.isFinite(spec.scale) ? spec.scale : undefined,
    inset: Number.isFinite(spec.inset) ? spec.inset : undefined,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getRenderableImageSize(image: RenderableImageSource): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round((image as any).width ?? (image as any).naturalWidth ?? 1)),
    height: Math.max(1, Math.round((image as any).height ?? (image as any).naturalHeight ?? 1)),
  };
}

function resolveEdgeMode(
  edgeMode: ImageNineSliceBorderSpec['edgeMode'],
  side: 'top' | 'right' | 'bottom' | 'left',
): BorderEdgeMode {
  if (edgeMode === 'tile' || edgeMode === 'stretch') return edgeMode;
  const value = edgeMode?.[side];
  return value === 'stretch' ? 'stretch' : 'tile';
}

function drawHorizontalEdge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: RenderableImageSource,
  source: { x: number; y: number; width: number; height: number },
  dest: { x: number; y: number; width: number; height: number },
  mode: BorderEdgeMode,
  scale: number,
): void {
  if (!(source.width > 0 && source.height > 0 && dest.width > 0 && dest.height > 0)) return;
  if (mode === 'stretch') {
    ctx.drawImage(image, source.x, source.y, source.width, source.height, dest.x, dest.y, dest.width, dest.height);
    return;
  }

  const tileWidth = Math.max(1, source.width * Math.max(0.01, scale));
  let cursor = dest.x;
  const end = dest.x + dest.width;
  while (cursor < end - 0.001) {
    const drawWidth = Math.min(tileWidth, end - cursor);
    const sourceWidth = source.width * (drawWidth / tileWidth);
    ctx.drawImage(image, source.x, source.y, sourceWidth, source.height, cursor, dest.y, drawWidth, dest.height);
    cursor += drawWidth;
  }
}

function drawVerticalEdge(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: RenderableImageSource,
  source: { x: number; y: number; width: number; height: number },
  dest: { x: number; y: number; width: number; height: number },
  mode: BorderEdgeMode,
  scale: number,
): void {
  if (!(source.width > 0 && source.height > 0 && dest.width > 0 && dest.height > 0)) return;
  if (mode === 'stretch') {
    ctx.drawImage(image, source.x, source.y, source.width, source.height, dest.x, dest.y, dest.width, dest.height);
    return;
  }

  const tileHeight = Math.max(1, source.height * Math.max(0.01, scale));
  let cursor = dest.y;
  const end = dest.y + dest.height;
  while (cursor < end - 0.001) {
    const drawHeight = Math.min(tileHeight, end - cursor);
    const sourceHeight = source.height * (drawHeight / tileHeight);
    ctx.drawImage(image, source.x, source.y, source.width, sourceHeight, dest.x, cursor, dest.width, drawHeight);
    cursor += drawHeight;
  }
}

export function drawDecorativeBorder(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  image: RenderableImageSource,
  spec: DecorativeBorderSpec,
  width: number,
  height: number,
): boolean {
  if (spec.kind !== 'image9') return false;

  const imageSize = getRenderableImageSize(image);
  const leftCut = clamp(Math.round(spec.cuts.left), 0, imageSize.width - 1);
  const rightCut = clamp(Math.round(spec.cuts.right), leftCut + 1, imageSize.width);
  const topCut = clamp(Math.round(spec.cuts.top), 0, imageSize.height - 1);
  const bottomCut = clamp(Math.round(spec.cuts.bottom), topCut + 1, imageSize.height);

  const sourceLeft = leftCut;
  const sourceRight = imageSize.width - rightCut;
  const sourceTop = topCut;
  const sourceBottom = imageSize.height - bottomCut;
  const edgeSourceWidth = Math.max(0, rightCut - leftCut);
  const edgeSourceHeight = Math.max(0, bottomCut - topCut);
  if (!(sourceLeft > 0 || sourceRight > 0 || sourceTop > 0 || sourceBottom > 0)) return false;

  const scale = Number.isFinite(spec.scale) && (spec.scale as number) > 0 ? (spec.scale as number) : 1;
  const inset = Number.isFinite(spec.inset) ? Math.max(0, spec.inset as number) : 0;
  const innerWidth = Math.max(0, width - inset * 2);
  const innerHeight = Math.max(0, height - inset * 2);
  if (!(innerWidth > 0 && innerHeight > 0)) return false;

  let leftWidth = sourceLeft * scale;
  let rightWidth = sourceRight * scale;
  let topHeight = sourceTop * scale;
  let bottomHeight = sourceBottom * scale;

  if (leftWidth + rightWidth > innerWidth && leftWidth + rightWidth > 0) {
    const fit = innerWidth / (leftWidth + rightWidth);
    leftWidth *= fit;
    rightWidth *= fit;
  }
  if (topHeight + bottomHeight > innerHeight && topHeight + bottomHeight > 0) {
    const fit = innerHeight / (topHeight + bottomHeight);
    topHeight *= fit;
    bottomHeight *= fit;
  }

  const x0 = inset;
  const x1 = x0 + leftWidth;
  const x2 = x0 + innerWidth - rightWidth;
  const y0 = inset;
  const y1 = y0 + topHeight;
  const y2 = y0 + innerHeight - bottomHeight;

  const prevAlpha = ctx.globalAlpha;
  ctx.globalAlpha = prevAlpha * clamp(Number(spec.opacity ?? 1), 0, 1);
  try {
    if (sourceLeft > 0 && sourceTop > 0 && leftWidth > 0 && topHeight > 0) {
      ctx.drawImage(image, 0, 0, sourceLeft, sourceTop, x0, y0, leftWidth, topHeight);
    }
    if (sourceRight > 0 && sourceTop > 0 && rightWidth > 0 && topHeight > 0) {
      ctx.drawImage(image, rightCut, 0, sourceRight, sourceTop, x2, y0, rightWidth, topHeight);
    }
    if (sourceLeft > 0 && sourceBottom > 0 && leftWidth > 0 && bottomHeight > 0) {
      ctx.drawImage(image, 0, bottomCut, sourceLeft, sourceBottom, x0, y2, leftWidth, bottomHeight);
    }
    if (sourceRight > 0 && sourceBottom > 0 && rightWidth > 0 && bottomHeight > 0) {
      ctx.drawImage(image, rightCut, bottomCut, sourceRight, sourceBottom, x2, y2, rightWidth, bottomHeight);
    }

    drawHorizontalEdge(
      ctx,
      image,
      { x: leftCut, y: 0, width: edgeSourceWidth, height: sourceTop },
      { x: x1, y: y0, width: Math.max(0, x2 - x1), height: topHeight },
      resolveEdgeMode(spec.edgeMode, 'top'),
      scale,
    );
    drawHorizontalEdge(
      ctx,
      image,
      { x: leftCut, y: bottomCut, width: edgeSourceWidth, height: sourceBottom },
      { x: x1, y: y2, width: Math.max(0, x2 - x1), height: bottomHeight },
      resolveEdgeMode(spec.edgeMode, 'bottom'),
      scale,
    );
    drawVerticalEdge(
      ctx,
      image,
      { x: 0, y: topCut, width: sourceLeft, height: edgeSourceHeight },
      { x: x0, y: y1, width: leftWidth, height: Math.max(0, y2 - y1) },
      resolveEdgeMode(spec.edgeMode, 'left'),
      scale,
    );
    drawVerticalEdge(
      ctx,
      image,
      { x: rightCut, y: topCut, width: sourceRight, height: edgeSourceHeight },
      { x: x2, y: y1, width: rightWidth, height: Math.max(0, y2 - y1) },
      resolveEdgeMode(spec.edgeMode, 'right'),
      scale,
    );
  } finally {
    ctx.globalAlpha = prevAlpha;
  }

  return true;
}