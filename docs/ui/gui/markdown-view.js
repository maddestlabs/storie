import { BaseWidget } from '../core/base-widget.js';
import { parseMarkdownLite } from '../document/markdown-lite.js';
import { layoutMarkdownDocument } from '../document/layout.js';
export class GUIMarkdownView extends BaseWidget {
    markdown;
    nodes;
    padding;
    scrollY;
    // Max scroll computed from the last render/layout pass (in pixels).
    // Null means unknown (e.g., before first render), so we avoid clamping.
    lastMaxScrollY = null;
    cachedLayout = null;
    cachedKey = '';
    clickedLink = null;
    mdStyle;
    collectImageSources(nodes, into) {
        for (const node of nodes) {
            if (node.kind === 'image') {
                into.add(node.source);
            }
            else if (node.kind === 'blockquote' || node.kind === 'callout') {
                this.collectImageSources(node.nodes, into);
            }
        }
    }
    constructor(config) {
        super({ ...config, focusable: config.focusable ?? true });
        this.markdown = config.markdown ?? '';
        this.nodes = parseMarkdownLite(this.markdown);
        this.padding = config.padding ?? 10;
        this.scrollY = config.scrollY ?? 0;
        const defaultStyle = {
            fg: { r: 230, g: 230, b: 230 },
            mutedFg: { r: 160, g: 160, b: 160 },
            borderFg: { r: 110, g: 110, b: 110 },
            surfaceBg: { r: 24, g: 24, b: 24, a: 0.92 },
            headingFg: { r: 255, g: 255, b: 255 },
            linkFg: { r: 80, g: 180, b: 255 },
            infoFg: { r: 80, g: 180, b: 255 },
            successFg: { r: 64, g: 210, b: 140 },
            warningFg: { r: 255, g: 205, b: 96 },
            errorFg: { r: 255, g: 110, b: 120 },
            codeFg: { r: 240, g: 240, b: 240 },
            codeBg: { r: 35, g: 35, b: 35, a: 0.9 },
            bg: { r: 0, g: 0, b: 0, a: 0 },
        };
        this.mdStyle = { ...defaultStyle, ...(config.style ?? {}) };
        this.on('click', (ev) => {
            const pos = ev.data;
            const x = pos?.x;
            const y = pos?.y;
            if (typeof x !== 'number' || typeof y !== 'number')
                return;
            const url = this.hitTestLink(x, y);
            if (url)
                this.clickedLink = url;
        });
    }
    setMarkdown(markdown) {
        this.markdown = markdown ?? '';
        this.nodes = parseMarkdownLite(this.markdown);
        this.cachedLayout = null;
    }
    getMarkdown() {
        return this.markdown;
    }
    setScrollY(scrollY) {
        const next = Math.max(0, scrollY);
        const max = this.lastMaxScrollY;
        this.scrollY = typeof max === 'number' ? Math.min(next, max) : next;
        this.cachedLayout = null;
    }
    scrollBy(deltaY) {
        this.setScrollY(this.scrollY + deltaY);
    }
    popClickedLink() {
        const v = this.clickedLink;
        this.clickedLink = null;
        return v;
    }
    computeLayout(metrics, imageSignature) {
        const key = `${this.bounds.x},${this.bounds.y},${this.bounds.width},${this.bounds.height}|${metrics.charW},${metrics.charH}|${this.scrollY}|${this.markdown.length}|${imageSignature}`;
        if (this.cachedLayout && this.cachedKey === key)
            return this.cachedLayout;
        const layout = layoutMarkdownDocument(this.nodes, {
            x: this.bounds.x,
            y: this.bounds.y,
            width: this.bounds.width,
            height: this.bounds.height,
        }, metrics, this.mdStyle, this.scrollY, this.padding);
        this.cachedLayout = layout;
        this.cachedKey = key;
        return layout;
    }
    hitTestLink(x, y) {
        if (!this.cachedLayout)
            return null;
        for (const r of this.cachedLayout.linkRegions) {
            if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
                return r.url;
            }
        }
        return null;
    }
    renderToUI(ui, charW, charH) {
        if (!this.state.visible)
            return;
        const sources = new Set();
        this.collectImageSources(this.nodes, sources);
        const imageSize = typeof ui.getImageSize === 'function'
            ? (source) => ui.getImageSize(source)
            : undefined;
        const imageSignature = Array.from(sources)
            .sort()
            .map((source) => {
            const dims = imageSize ? imageSize(source) : null;
            return dims ? `${source}:${dims.width}x${dims.height}` : `${source}:pending`;
        })
            .join('|');
        const metrics = { charW, charH, ...(imageSize ? { getImageSize: imageSize } : {}) };
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
            }
            else if (op.kind === 'image') {
                if (typeof ui.image === 'function') {
                    ui.image(op.source, op.x, op.y, op.w, op.h);
                }
            }
            else {
                ui.text(op.text, op.x, op.y, op.color);
            }
        }
        if (canClip) {
            popClip();
        }
    }
    render() {
        // No-op: graphical widgets are rendered by GUISystem
    }
}
//# sourceMappingURL=markdown-view.js.map