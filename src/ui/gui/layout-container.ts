import type { Bounds, Alignment, WidgetLayoutHints, WidgetLayoutSize } from '../core/types.js';
import type { BaseWidget } from '../core/base-widget.js';

export type GUILayoutMode = 'stack' | 'row' | 'grid';
export type GUILayoutAnchor = 'start' | 'center' | 'end';

export interface GUILayoutViewportConfig {
  inset?: number;
  insetX?: number;
  insetY?: number;
  insetTop?: number;
  insetRight?: number;
  insetBottom?: number;
  insetLeft?: number;
  width?: number;
  height?: number;
  maxWidth?: number;
  maxHeight?: number;
  anchorX?: GUILayoutAnchor;
  anchorY?: GUILayoutAnchor;
}

export interface GUILayoutContainerConfig {
  bounds: Bounds;
  layout?: WidgetLayoutHints;
  padding?: number;
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  mode?: GUILayoutMode;
  alignX?: Alignment;
  alignY?: Alignment;
  columns?: number;
  maxWidth?: number;
  includeHidden?: boolean;
}

type LayoutChild = BaseWidget | GUILayoutContainer;

/**
 * Simple layout helper for GUI widgets.
 *
 * This is intentionally NOT a widget and does not register with WidgetManager.
 * It only updates child widgets' absolute bounds to match a vertical stack.
 */
export class GUILayoutContainer {
  public bounds: Bounds;
  public layoutHints: WidgetLayoutHints;
  public padding: number;
  public gap: number;
  public rowGap: number;
  public columnGap: number;
  public mode: GUILayoutMode;
  public alignX: Alignment;
  public alignY: Alignment;
  public columns: number;
  public maxWidth: number | null;
  public includeHidden: boolean;
  private baseBounds: Bounds;

  private children: LayoutChild[] = [];

  constructor(config: GUILayoutContainerConfig) {
    this.bounds = { ...config.bounds };
    this.baseBounds = { ...config.bounds };
    this.layoutHints = { ...(config.layout || {}) };
    this.padding = config.padding ?? 0;
    this.gap = config.gap ?? 0;
    this.rowGap = config.rowGap ?? config.gap ?? 0;
    this.columnGap = config.columnGap ?? config.gap ?? 0;
    this.mode = config.mode ?? 'stack';
    this.alignX = config.alignX ?? 'start';
    this.alignY = config.alignY ?? 'start';
    this.columns = Math.max(1, Math.floor(config.columns ?? 1));
    this.maxWidth = Number.isFinite(config.maxWidth) && (config.maxWidth as number) > 0
      ? Number(config.maxWidth)
      : null;
    this.includeHidden = config.includeHidden ?? false;
  }

  add(child: LayoutChild): this {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
    return this;
  }

  addMany(children: LayoutChild[]): this {
    for (const child of children) this.add(child);
    return this;
  }

  remove(child: LayoutChild): this {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return this;
  }

  clear(): this {
    this.children.length = 0;
    return this;
  }

  getChildren(): LayoutChild[] {
    return [...this.children];
  }

  getLayoutSize(): WidgetLayoutSize {
    const measured = this.measureLayout();
    const minWidth = Number.isFinite(this.layoutHints.minWidth) ? Number(this.layoutHints.minWidth) : measured.width;
    const minHeight = Number.isFinite(this.layoutHints.minHeight) ? Number(this.layoutHints.minHeight) : measured.height;
    const preferredWidth = Number.isFinite(this.layoutHints.preferredWidth) ? Number(this.layoutHints.preferredWidth) : measured.width;
    const preferredHeight = Number.isFinite(this.layoutHints.preferredHeight) ? Number(this.layoutHints.preferredHeight) : measured.height;
    return {
      minWidth,
      minHeight,
      preferredWidth: Math.max(minWidth, preferredWidth),
      preferredHeight: Math.max(minHeight, preferredHeight),
      widthPolicy: this.layoutHints.widthPolicy ?? 'fixed',
      heightPolicy: this.layoutHints.heightPolicy ?? 'fixed'
    };
  }

  getContentBounds(): Bounds {
    return this.getInnerBounds();
  }

  setBounds(bounds: Bounds, relayout: boolean = true): void {
    this.bounds = { ...bounds };
    this.baseBounds = { ...bounds };
    if (relayout) this.layout();
  }

  setMode(mode: GUILayoutMode, relayout: boolean = true): void {
    this.mode = mode;
    if (relayout) this.layout();
  }

  setColumns(columns: number, relayout: boolean = true): void {
    this.columns = Math.max(1, Math.floor(columns || 1));
    if (relayout) this.layout();
  }

  setMaxWidth(maxWidth: number | null, relayout: boolean = true): void {
    this.maxWidth = Number.isFinite(maxWidth) && (maxWidth as number) > 0 ? Number(maxWidth) : null;
    if (relayout) this.layout();
  }

  fitToViewport(viewport: Bounds, options?: GUILayoutViewportConfig, relayout: boolean = true): Bounds {
    const inset = Number.isFinite(options?.inset) ? Number(options?.inset) : 0;
    const insetX = Number.isFinite(options?.insetX) ? Number(options?.insetX) : inset;
    const insetY = Number.isFinite(options?.insetY) ? Number(options?.insetY) : inset;
    const insetTop = Number.isFinite(options?.insetTop) ? Number(options?.insetTop) : insetY;
    const insetRight = Number.isFinite(options?.insetRight) ? Number(options?.insetRight) : insetX;
    const insetBottom = Number.isFinite(options?.insetBottom) ? Number(options?.insetBottom) : insetY;
    const insetLeft = Number.isFinite(options?.insetLeft) ? Number(options?.insetLeft) : insetX;

    const availableX = viewport.x + insetLeft;
    const availableY = viewport.y + insetTop;
    const availableW = Math.max(0, viewport.width - insetLeft - insetRight);
    const availableH = Math.max(0, viewport.height - insetTop - insetBottom);

    const measured = this.measureLayout();
    const explicitWidth = Number.isFinite(options?.width) ? Number(options?.width) : null;
    const explicitHeight = Number.isFinite(options?.height) ? Number(options?.height) : null;
    const currentWidth = Number.isFinite(this.bounds.width) && this.bounds.width > 1
      ? Number(this.bounds.width)
      : measured.width;
    const currentHeight = Number.isFinite(this.bounds.height) && this.bounds.height > 1
      ? Number(this.bounds.height)
      : measured.height;
    const baseWidth = Number.isFinite(this.baseBounds.width) && this.baseBounds.width > 1
      ? Number(this.baseBounds.width)
      : measured.width;
    const baseHeight = Number.isFinite(this.baseBounds.height) && this.baseBounds.height > 1
      ? Number(this.baseBounds.height)
      : measured.height;
    const desiredW = explicitWidth ?? Math.max(measured.width, currentWidth, baseWidth);
    const desiredH = explicitHeight ?? Math.max(measured.height, currentHeight, baseHeight);
    const maxW = Number.isFinite(options?.maxWidth) ? Number(options?.maxWidth) : availableW;
    const maxH = Number.isFinite(options?.maxHeight) ? Number(options?.maxHeight) : availableH;
    const width = Math.max(0, Math.min(availableW, maxW, desiredW));
    const height = Math.max(0, Math.min(availableH, maxH, desiredH));
    const anchorX = options?.anchorX ?? 'start';
    const anchorY = options?.anchorY ?? 'start';

    let x = availableX;
    let y = availableY;
    if (anchorX === 'center') x = availableX + (availableW - width) / 2;
    else if (anchorX === 'end') x = availableX + (availableW - width);
    if (anchorY === 'center') y = availableY + (availableH - height) / 2;
    else if (anchorY === 'end') y = availableY + (availableH - height);

    this.bounds = { x, y, width, height };
    if (relayout) this.layout();
    return { ...this.bounds };
  }

  private isChildVisible(child: LayoutChild): boolean {
    if (child instanceof GUILayoutContainer) return true;
    return child.state.visible;
  }

  private getLayoutChildren(): LayoutChild[] {
    return this.includeHidden ? [...this.children] : this.children.filter(child => this.isChildVisible(child));
  }

  private getInnerBounds(): Bounds {
    const paddedX = this.bounds.x + this.padding;
    const paddedY = this.bounds.y + this.padding;
    const paddedW = Math.max(0, this.bounds.width - this.padding * 2);
    const paddedH = Math.max(0, this.bounds.height - this.padding * 2);

    if (!this.maxWidth || paddedW <= this.maxWidth) {
      return { x: paddedX, y: paddedY, width: paddedW, height: paddedH };
    }

    const clampedW = this.maxWidth;
    const extraX = (paddedW - clampedW) / 2;
    return {
      x: paddedX + extraX,
      y: paddedY,
      width: clampedW,
      height: paddedH
    };
  }

  private alignOffset(available: number, actual: number, align: Alignment): number {
    const slack = Math.max(0, available - actual);
    if (align === 'center') return slack / 2;
    if (align === 'end') return slack;
    return 0;
  }

  private getChildSize(child: LayoutChild): WidgetLayoutSize {
    return child.getLayoutSize();
  }

  private setChildBounds(child: LayoutChild, bounds: Bounds): void {
    if (child instanceof GUILayoutContainer) {
      child.setBounds(bounds, true);
      return;
    }
    child.bounds.x = bounds.x;
    child.bounds.y = bounds.y;
    child.bounds.width = bounds.width;
    child.bounds.height = bounds.height;
  }

  private measureStack(children: LayoutChild[]): { width: number; height: number } {
    let width = 0;
    let height = 0;
    for (let i = 0; i < children.length; i++) {
      const size = this.getChildSize(children[i]!);
      width = Math.max(width, Math.max(size.minWidth, size.preferredWidth));
      height += Math.max(size.minHeight, size.preferredHeight);
      if (i < children.length - 1) height += this.rowGap;
    }
    return { width: width + this.padding * 2, height: height + this.padding * 2 };
  }

  private measureRow(children: LayoutChild[]): { width: number; height: number } {
    let width = 0;
    let height = 0;
    for (let i = 0; i < children.length; i++) {
      const size = this.getChildSize(children[i]!);
      width += Math.max(size.minWidth, size.preferredWidth);
      if (i < children.length - 1) width += this.columnGap;
      height = Math.max(height, Math.max(size.minHeight, size.preferredHeight));
    }
    return { width: width + this.padding * 2, height: height + this.padding * 2 };
  }

  private measureGrid(children: LayoutChild[]): { width: number; height: number } {
    const columns = Math.max(1, this.columns);
    const columnWidths = new Array(columns).fill(0);
    const rowHeights: number[] = [];

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const size = this.getChildSize(child);
      const col = i % columns;
      const row = Math.floor(i / columns);
      const width = Math.max(size.minWidth, size.preferredWidth);
      const height = Math.max(size.minHeight, size.preferredHeight);
      columnWidths[col] = Math.max(columnWidths[col], width);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, height);
    }

    const totalWidth = columnWidths.reduce((sum, value) => sum + value, 0) + this.columnGap * Math.max(0, columns - 1);
    const totalHeight = rowHeights.reduce((sum, value) => sum + value, 0) + this.rowGap * Math.max(0, rowHeights.length - 1);
    return { width: totalWidth + this.padding * 2, height: totalHeight + this.padding * 2 };
  }

  measureLayout(): { width: number; height: number } {
    const children = this.getLayoutChildren();
    if (this.mode === 'row') return this.measureRow(children);
    if (this.mode === 'grid') return this.measureGrid(children);
    return this.measureStack(children);
  }

  private distributeMainAxis(available: number, fixedTotal: number, fillCount: number): number {
    if (fillCount <= 0) return 0;
    const remaining = Math.max(0, available - fixedTotal);
    return remaining / fillCount;
  }

  private layoutStack(children: LayoutChild[], inner: Bounds): void {
    const sizes = children.map((child) => this.getChildSize(child));
    let fixedHeight = 0;
    let fillCount = 0;

    for (let i = 0; i < children.length; i++) {
      const size = sizes[i]!;
      if (size.heightPolicy === 'fill') fillCount += 1;
      else fixedHeight += Math.max(size.minHeight, size.preferredHeight);
    }

    fixedHeight += this.rowGap * Math.max(0, children.length - 1);
    const fillHeight = this.distributeMainAxis(inner.height, fixedHeight, fillCount);

    let cursorY = inner.y;

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const size = sizes[i]!;
      const naturalHeight = Math.max(size.minHeight, size.preferredHeight);
      const childHeight = size.heightPolicy === 'fill'
        ? Math.max(size.minHeight, fillHeight)
        : naturalHeight;
      const naturalWidth = Math.max(size.minWidth, size.preferredWidth);
      const childWidth = this.alignX === 'stretch' || size.widthPolicy === 'fill'
        ? inner.width
        : Math.min(naturalWidth, inner.width);
      const childX = inner.x + this.alignOffset(inner.width, childWidth, this.alignX);

      this.setChildBounds(child, {
        x: childX,
        y: cursorY,
        width: childWidth,
        height: childHeight
      });

      cursorY += childHeight + this.rowGap;
    }
  }

  private layoutRow(children: LayoutChild[], inner: Bounds): void {
    const sizes = children.map((child) => this.getChildSize(child));
    let fixedWidth = 0;
    let fillCount = 0;

    for (let i = 0; i < children.length; i++) {
      const size = sizes[i]!;
      if (size.widthPolicy === 'fill') fillCount += 1;
      else fixedWidth += Math.max(size.minWidth, size.preferredWidth);
    }

    fixedWidth += this.columnGap * Math.max(0, children.length - 1);
    const fillWidth = this.distributeMainAxis(inner.width, fixedWidth, fillCount);

    let cursorX = inner.x;

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const size = sizes[i]!;
      const naturalWidth = Math.max(size.minWidth, size.preferredWidth);
      const naturalHeight = Math.max(size.minHeight, size.preferredHeight);
      const childWidth = size.widthPolicy === 'fill'
        ? Math.max(size.minWidth, fillWidth)
        : Math.min(naturalWidth, inner.width);
      const childHeight = this.alignY === 'stretch' || size.heightPolicy === 'fill'
        ? inner.height
        : Math.min(naturalHeight, inner.height);
      const childY = inner.y + this.alignOffset(inner.height, childHeight, this.alignY);

      this.setChildBounds(child, {
        x: cursorX,
        y: childY,
        width: childWidth,
        height: childHeight
      });

      cursorX += childWidth + this.columnGap;
    }
  }

  private layoutGrid(children: LayoutChild[], inner: Bounds): void {
    const columns = Math.max(1, this.columns);
    const cellW = columns > 1
      ? Math.max(0, (inner.width - this.columnGap * (columns - 1)) / columns)
      : inner.width;

    const rowHeights: number[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const row = Math.floor(i / columns);
      const size = child.getLayoutSize();
      const naturalHeight = Math.max(size.minHeight, size.preferredHeight);
      rowHeights[row] = Math.max(rowHeights[row] ?? 0, naturalHeight);
    }

    let cursorY = inner.y;
    for (let row = 0; row < rowHeights.length; row++) {
      const rowHeight = rowHeights[row] ?? 0;
      for (let col = 0; col < columns; col++) {
        const index = row * columns + col;
        const child = children[index];
        if (!child) continue;
        const size = child.getLayoutSize();

        const cellX = inner.x + col * (cellW + this.columnGap);
        const naturalWidth = Math.max(size.minWidth, size.preferredWidth);
        const naturalHeight = Math.max(size.minHeight, size.preferredHeight);
        const childWidth = this.alignX === 'stretch' || size.widthPolicy === 'fill'
          ? cellW
          : Math.min(naturalWidth, cellW);
        const childHeight = this.alignY === 'stretch' || size.heightPolicy === 'fill'
          ? rowHeight
          : naturalHeight;
        const childX = cellX + this.alignOffset(cellW, childWidth, this.alignX);
        const childY = cursorY + this.alignOffset(rowHeight, childHeight, this.alignY);

        this.setChildBounds(child, {
          x: childX,
          y: childY,
          width: childWidth,
          height: childHeight
        });
      }

      cursorY += rowHeight + this.rowGap;
    }
  }

  /**
   * Apply the configured layout to children.
   */
  layout(): void {
    const children = this.getLayoutChildren();
    const inner = this.getInnerBounds();

    if (this.mode === 'row') {
      this.layoutRow(children, inner);
      return;
    }

    if (this.mode === 'grid') {
      this.layoutGrid(children, inner);
      return;
    }

    this.layoutStack(children, inner);
  }
}
