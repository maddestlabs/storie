import type { Bounds, Alignment } from '../core/types.js';
import type { BaseWidget } from '../core/base-widget.js';

export interface GUILayoutContainerConfig {
  bounds: Bounds;
  padding?: number;
  gap?: number;
  alignX?: Alignment;
  includeHidden?: boolean;
}

/**
 * Simple layout helper for GUI widgets.
 *
 * This is intentionally NOT a widget and does not register with WidgetManager.
 * It only updates child widgets' absolute bounds to match a vertical stack.
 */
export class GUILayoutContainer {
  public bounds: Bounds;
  public padding: number;
  public gap: number;
  public alignX: Alignment;
  public includeHidden: boolean;

  private children: BaseWidget[] = [];

  constructor(config: GUILayoutContainerConfig) {
    this.bounds = { ...config.bounds };
    this.padding = config.padding ?? 0;
    this.gap = config.gap ?? 0;
    this.alignX = config.alignX ?? 'start';
    this.includeHidden = config.includeHidden ?? false;
  }

  add(child: BaseWidget): this {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
    return this;
  }

  addMany(children: BaseWidget[]): this {
    for (const child of children) this.add(child);
    return this;
  }

  remove(child: BaseWidget): this {
    const idx = this.children.indexOf(child);
    if (idx !== -1) this.children.splice(idx, 1);
    return this;
  }

  clear(): this {
    this.children.length = 0;
    return this;
  }

  getChildren(): BaseWidget[] {
    return [...this.children];
  }

  setBounds(bounds: Bounds, relayout: boolean = true): void {
    this.bounds = { ...bounds };
    if (relayout) this.layout();
  }

  /**
   * Apply a vertical stack layout to children.
   * Uses each child's current `bounds.height` (and `bounds.width` unless alignX='stretch').
   */
  layout(): void {
    const innerX = this.bounds.x + this.padding;
    const innerY = this.bounds.y + this.padding;
    const innerW = Math.max(0, this.bounds.width - this.padding * 2);

    let cursorY = innerY;

    for (const child of this.children) {
      if (!this.includeHidden && !child.state.visible) continue;

      const childHeight = child.bounds.height;
      const childWidth = this.alignX === 'stretch' ? innerW : child.bounds.width;

      let childX = innerX;
      if (this.alignX === 'center') {
        childX = innerX + (innerW - childWidth) / 2;
      } else if (this.alignX === 'end') {
        childX = innerX + (innerW - childWidth);
      }

      child.bounds.x = childX;
      child.bounds.y = cursorY;
      child.bounds.width = childWidth;
      child.bounds.height = childHeight;

      cursorY += childHeight + this.gap;
    }
  }
}
