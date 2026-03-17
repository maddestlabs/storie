import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';
import { parseMarkdownLite } from '../document/markdown-lite.js';
import { layoutMarkdownDocument } from '../document/layout.js';
import type { DocNode, LayoutResult, MarkdownStyle, TextMetrics } from '../document/types.js';
import type { Draw2D } from '../draw2d.js';

export interface GUIMarkdownViewConfig extends WidgetConfig {
  markdown: string;
  style?: Partial<MarkdownStyle>;
  padding?: number;
  scrollY?: number;
}

export class GUIMarkdownView extends BaseWidget {
  private markdown: string;
  private nodes: DocNode[];
  private padding: number;
  private scrollY: number;

  // Max scroll computed from the last render/layout pass (in pixels).
  // Null means unknown (e.g., before first render), so we avoid clamping.
  private lastMaxScrollY: number | null = null;

  private cachedLayout: LayoutResult | null = null;
  private cachedKey: string = '';

  private clickedLink: string | null = null;

  private mdStyle: MarkdownStyle;

  private collectImageSources(nodes: DocNode[], into: Set<string>): void {
    for (const node of nodes) {
      if (node.kind === 'image') {
        into.add(node.source);
      } else if (node.kind === 'blockquote' || node.kind === 'callout') {
        this.collectImageSources(node.nodes, into);
      }
    }
  }

  constructor(config: GUIMarkdownViewConfig) {
    super({ ...config, focusable: config.focusable ?? true });
    this.markdown = config.markdown ?? '';
    this.nodes = parseMarkdownLite(this.markdown);
    this.padding = config.padding ?? 10;
    this.scrollY = config.scrollY ?? 0;

    const defaultStyle: MarkdownStyle = {
      fg: ({ r: 230, g: 230, b: 230 } as unknown) as Color,
      mutedFg: ({ r: 160, g: 160, b: 160 } as unknown) as Color,
      borderFg: ({ r: 110, g: 110, b: 110 } as unknown) as Color,
      surfaceBg: ({ r: 24, g: 24, b: 24, a: 0.92 } as unknown) as Color,
      headingFg: ({ r: 255, g: 255, b: 255 } as unknown) as Color,
      linkFg: ({ r: 80, g: 180, b: 255 } as unknown) as Color,
      infoFg: ({ r: 80, g: 180, b: 255 } as unknown) as Color,
      successFg: ({ r: 64, g: 210, b: 140 } as unknown) as Color,
      warningFg: ({ r: 255, g: 205, b: 96 } as unknown) as Color,
      errorFg: ({ r: 255, g: 110, b: 120 } as unknown) as Color,
      codeFg: ({ r: 240, g: 240, b: 240 } as unknown) as Color,
      codeBg: ({ r: 35, g: 35, b: 35, a: 0.9 } as unknown) as Color,
      bg: ({ r: 0, g: 0, b: 0, a: 0 } as unknown) as Color,
    };

    this.mdStyle = { ...defaultStyle, ...(config.style ?? {}) };

    this.on('click', (ev) => {
      const pos = ev.data as { x?: number; y?: number } | undefined;
      const x = pos?.x;
      const y = pos?.y;
      if (typeof x !== 'number' || typeof y !== 'number') return;
      const url = this.hitTestLink(x, y);
      if (url) this.clickedLink = url;
    });
  }

  setMarkdown(markdown: string): void {
    this.markdown = markdown ?? '';
    this.nodes = parseMarkdownLite(this.markdown);
    this.cachedLayout = null;
  }

  getMarkdown(): string {
    return this.markdown;
  }

  setScrollY(scrollY: number): void {
    const next = Math.max(0, scrollY);
    const max = this.lastMaxScrollY;
    this.scrollY = typeof max === 'number' ? Math.min(next, max) : next;
    this.cachedLayout = null;
  }

  scrollBy(deltaY: number): void {
    this.setScrollY(this.scrollY + deltaY);
  }

  popClickedLink(): string | null {
    const v = this.clickedLink;
    this.clickedLink = null;
    return v;
  }

  private computeLayout(metrics: TextMetrics, imageSignature: string): LayoutResult {
    const key = `${this.bounds.x},${this.bounds.y},${this.bounds.width},${this.bounds.height}|${metrics.charW},${metrics.charH}|${this.scrollY}|${this.markdown.length}|${imageSignature}`;
    if (this.cachedLayout && this.cachedKey === key) return this.cachedLayout;

    const layout = layoutMarkdownDocument(
      this.nodes,
      {
        x: this.bounds.x,
        y: this.bounds.y,
        width: this.bounds.width,
        height: this.bounds.height,
      },
      metrics,
      this.mdStyle,
      this.scrollY,
      this.padding
    );

    this.cachedLayout = layout;
    this.cachedKey = key;
    return layout;
  }

  private hitTestLink(x: number, y: number): string | null {
    if (!this.cachedLayout) return null;
    for (const r of this.cachedLayout.linkRegions) {
      if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
        return r.url;
      }
    }
    return null;
  }

  renderToUI(ui: Draw2D, charW: number, charH: number): void {
    if (!this.state.visible) return;

    const sources = new Set<string>();
    this.collectImageSources(this.nodes, sources);
    const imageSize = typeof ui.getImageSize === 'function'
      ? (source: string) => ui.getImageSize!(source)
      : undefined;
    const imageSignature = Array.from(sources)
      .sort()
      .map((source) => {
        const dims = imageSize ? imageSize(source) : null;
        return dims ? `${source}:${dims.width}x${dims.height}` : `${source}:pending`;
      })
      .join('|');

    const metrics: TextMetrics = { charW, charH, ...(imageSize ? { getImageSize: imageSize } : {}) };
    let layout = this.computeLayout(metrics, imageSignature);

    // Clamp scroll to content bounds (prevents infinite empty scrolling).
    const innerH = Math.max(0, this.bounds.height - this.padding * 2);
    const maxScroll = Math.max(0, layout.contentHeight - innerH);
    this.lastMaxScrollY = maxScroll;
    if (this.scrollY > maxScroll) {
      this.scrollY = maxScroll;
      this.cachedLayout = null;
      layout = this.computeLayout(metrics, imageSignature);
    }

    const pushClip = ui.pushClipRect;
    const popClip = ui.popClipRect;
    const canClip = typeof pushClip === 'function' && typeof popClip === 'function';
    if (canClip) {
      pushClip(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height);
    }

    for (const op of layout.ops) {
      if (op.kind === 'rect') {
        ui.rect(op.x, op.y, op.w, op.h, op.color);
      } else if (op.kind === 'image') {
        if (typeof ui.image === 'function') {
          ui.image(op.source, op.x, op.y, op.w, op.h);
        }
      } else {
        ui.text(op.text, op.x, op.y, op.color);
      }
    }

    if (canClip) {
      popClip();
    }
  }

  render(): void {
    // No-op: graphical widgets are rendered by GUISystem
  }
}
