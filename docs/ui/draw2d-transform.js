export function applyAffine(m, x, y) {
    return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}
export function invertAffine(m) {
    const det = m.a * m.d - m.b * m.c;
    if (!Number.isFinite(det) || Math.abs(det) < 1e-12)
        return null;
    const invDet = 1 / det;
    const a = m.d * invDet;
    const b = -m.b * invDet;
    const c = -m.c * invDet;
    const d = m.a * invDet;
    const e = -(a * m.e + c * m.f);
    const f = -(b * m.e + d * m.f);
    return { a, b, c, d, e, f };
}
function transformRectAABB(m, x, y, w, h) {
    const p0 = applyAffine(m, x, y);
    const p1 = applyAffine(m, x + w, y);
    const p2 = applyAffine(m, x + w, y + h);
    const p3 = applyAffine(m, x, y + h);
    const minX = Math.min(p0.x, p1.x, p2.x, p3.x);
    const maxX = Math.max(p0.x, p1.x, p2.x, p3.x);
    const minY = Math.min(p0.y, p1.y, p2.y, p3.y);
    const maxY = Math.max(p0.y, p1.y, p2.y, p3.y);
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
export function createTransformedDraw2D(base, space) {
    const colors = base.colors;
    const metrics = base.metrics;
    const pushClip = (rect) => {
        if (!rect)
            return;
        if (!base.pushClipRect)
            return;
        base.pushClipRect(rect.x, rect.y, rect.w, rect.h);
    };
    const popClip = () => {
        if (!base.popClipRect)
            return;
        base.popClipRect();
    };
    const clipStack = [];
    const rootClip = space.clipRectScreen ?? null;
    const api = {
        rect(x, y, w, h, color) {
            // Note: Draw2D primitives are axis-aligned; we approximate rotated spaces
            // by transforming rects to a screen-space AABB.
            const aabb = transformRectAABB(space.screenFromLocal, x, y, w, h);
            base.rect(aabb.x, aabb.y, aabb.w, aabb.h, color);
        },
        text(text, x, y, color, scale) {
            const p = applyAffine(space.screenFromLocal, x, y);
            base.text(text, p.x, p.y, color, scale);
        },
        measureTextWidth: base.measureTextWidth ? base.measureTextWidth.bind(base) : undefined,
        image: base.image
            ? (imageId, x, y, w, h, options) => {
                const aabb = transformRectAABB(space.screenFromLocal, x, y, w, h);
                base.image(imageId, aabb.x, aabb.y, aabb.w, aabb.h, options);
            }
            : undefined,
        getImageSize: base.getImageSize ? base.getImageSize.bind(base) : undefined,
        clear: base.clear ? base.clear.bind(base) : undefined,
        pushClipRect: base.pushClipRect
            ? (x, y, w, h) => {
                const aabb = transformRectAABB(space.screenFromLocal, x, y, w, h);
                clipStack.push(aabb);
                pushClip(aabb);
            }
            : undefined,
        popClipRect: base.popClipRect
            ? () => {
                if (clipStack.length === 0)
                    return;
                clipStack.pop();
                popClip();
            }
            : undefined,
        // Masking in transformed spaces is not supported yet.
        pushMaskRect: undefined,
        pushMaskRoundedRect: undefined,
        pushMaskPolygon: undefined,
        popMask: undefined,
        colors,
        metrics,
    };
    // Apply a root clip if provided.
    if (rootClip && base.pushClipRect) {
        base.pushClipRect(rootClip.x, rootClip.y, rootClip.w, rootClip.h);
        clipStack.push(rootClip);
    }
    return api;
}
//# sourceMappingURL=draw2d-transform.js.map