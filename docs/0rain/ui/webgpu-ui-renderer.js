import { ColorUtils } from '../types.js';
export class WebGPUUIRenderer {
    device;
    atlas;
    textureFormat;
    width;
    height;
    texture;
    depthStencilTexture = null;
    depthStencilW = 0;
    depthStencilH = 0;
    // Second render target for per-pixel material properties: { roughness, normalScale, metallic, emissive }
    // Format: rgba8unorm — matches GLTF metallic-roughness channel layout.
    materialTexture = null;
    materialW = 0;
    materialH = 0;
    // Pending material for the next draw call. Reset to defaults after each draw.
    // Default: roughness=0.5, normalScale=1.0, metallic=0.0, emissive=0.0
    pendingMaterial = [0.5, 1.0, 0.0, 0.0];
    rectPipeline;
    textPipeline;
    maskPushPipeline;
    maskPopPipeline;
    polyMaskPushPipeline;
    polyMaskPopPipeline;
    // Shared layout for pipelines that bind uniforms + a sampled texture + sampler (text + images).
    texturedBindGroupLayout;
    texturedPipelineLayout;
    // Shared layout for pipelines that only bind the uniform buffer at @group(0) @binding(0).
    // Using an explicit pipeline layout avoids WebGPU validation errors when switching between
    // multiple pipelines created with `layout: 'auto'`.
    uniformBindGroupLayout;
    uniformPipelineLayout;
    uniformBuffer;
    rectInstanceBuffer;
    textInstanceBuffer;
    imageInstanceBuffer;
    polyVertexBuffer;
    polyData;
    polyVertexCount = 0;
    // Per-instance data
    // Rect: 12 floats => x,y,w,h + r,g,b,a + matR,matG,matB,matA
    rectData;
    rectCount = 0;
    // Per-instance clip rect (x,y,w,h) in pixels; -1 means no clip
    rectClipData;
    // Per-instance stencil reference (mask depth)
    rectStencilRef;
    // Text: 16 floats => x,y,w,h + r,g,b,a + u,v,uw,uh + matR,matG,matB,matA
    textData;
    textCount = 0;
    // Per-instance clip rect (x,y,w,h) in pixels; -1 means no clip
    textClipData;
    // Per-instance stencil reference (mask depth)
    textStencilRef;
    measureTextWidth(text, scale) {
        if (!text)
            return 0;
        const s = (Number.isFinite(scale) && scale > 0) ? scale : 1;
        const charW = this.atlas.getCharWidth();
        const useSizedGlyph = Math.abs(s - 1.0) > 0.15;
        const targetFontPx = useSizedGlyph
            ? Math.max(4, Math.round(this.atlas.getFontSize() * s / 2) * 2)
            : 0;
        let total = 0;
        for (const ch of text) {
            if (useSizedGlyph) {
                const glyph = this.atlas.getGlyphAtSize(ch, targetFontPx);
                total += glyph.pixelWidth || charW * s;
            }
            else {
                const glyph = this.atlas.getGlyph(ch);
                total += Math.max(charW, glyph.pixelWidth || 0) * s;
            }
        }
        return total;
    }
    // Image: 16 floats => x,y,w,h + r,g,b,a + u,v,uw,uh + matR,matG,matB,matA
    imageData;
    imageCount = 0;
    imageClipData;
    imageStencilRef;
    imageBindGroups = new Map();
    imageSizes = new Map();
    drawCommands = [];
    // Mask depth + stack (stores clip override for symmetric push/pop)
    maskDepth = 0;
    maskStack = [];
    // Clip stack (rectangular). Stored in UI pixel coordinates.
    clipStack = [];
    currentClip = null;
    clearColor = [0, 0, 0, 0];
    // Cached bind groups (avoid per-flush allocations)
    rectBindGroup = null;
    textBindGroup = null;
    lastAtlasTexture = null;
    lastAtlasSampler = null;
    // Cache last uniform resolution written
    lastUniformW = -1;
    lastUniformH = -1;
    constructor(device, atlas, width, height) {
        this.device = device;
        this.atlas = atlas;
        this.width = Math.max(1, Math.floor(width));
        this.height = Math.max(1, Math.floor(height));
        // Use the preferred canvas format so the compositor can optionally copy this
        // texture into the swapchain when the UI is fully opaque.
        this.textureFormat = navigator.gpu.getPreferredCanvasFormat();
        this.texture = this.createRenderTexture(this.width, this.height);
        this.uniformBuffer = this.device.createBuffer({
            size: 16,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });
        // Bind group layout used by rect + mask + poly mask pipelines.
        this.uniformBindGroupLayout = this.device.createBindGroupLayout({
            entries: [{
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                }]
        });
        this.uniformPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.uniformBindGroupLayout]
        });
        // Bind group layout used by textured quad pipelines (text + images): uniforms + texture + sampler.
        this.texturedBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                }
            ]
        });
        this.texturedPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.texturedBindGroupLayout]
        });
        this.rectInstanceBuffer = this.device.createBuffer({
            size: 12 * 4 * 16384,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.textInstanceBuffer = this.device.createBuffer({
            size: 16 * 4 * 4096,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.imageInstanceBuffer = this.device.createBuffer({
            size: 16 * 4 * 4096,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        // Polygon/path masks use a dedicated vertex buffer (x,y per vertex).
        this.polyVertexBuffer = this.device.createBuffer({
            size: 2 * 4 * 8192,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });
        this.polyData = new Float32Array(2 * 8192);
        this.rectData = new Float32Array(12 * 16384);
        this.textData = new Float32Array(16 * 4096);
        this.imageData = new Float32Array(16 * 4096);
        this.rectClipData = new Int32Array(4 * 16384);
        this.textClipData = new Int32Array(4 * 4096);
        this.imageClipData = new Int32Array(4 * 4096);
        this.rectStencilRef = new Int32Array(16384);
        this.textStencilRef = new Int32Array(4096);
        this.imageStencilRef = new Int32Array(4096);
        this.rectPipeline = this.createRectPipeline();
        this.textPipeline = this.createTextPipeline();
        this.maskPushPipeline = this.createMaskPipeline('increment');
        this.maskPopPipeline = this.createMaskPipeline('decrement');
        this.polyMaskPushPipeline = this.createPolyMaskPipeline('increment');
        this.polyMaskPopPipeline = this.createPolyMaskPipeline('decrement');
        this.writeUniforms(this.width, this.height);
    }
    getTexture() {
        return this.texture;
    }
    /**
     * Format used for this renderer's pipelines/targets.
     * Any external target passed to flushTo() must use this format.
     */
    getTextureFormat() {
        return this.textureFormat;
    }
    /**
     * Return the current material render target, or null if not yet created
     * (first flush() hasn't run yet). Sized to match the last flush target.
     * Thread this through Compositor → ShaderChainManager for PBR lighting.
     */
    getMaterialTexture() {
        return this.materialTexture;
    }
    /**
     * Set the material properties for all subsequent draw calls until changed again.
     * Behaves like a colour setting — sticky until overridden, not one-shot.
     * Call `setMaterial(null)` to restore defaults.
     *
     * Channel layout (matches GLTF metallic-roughness):
     *   roughness   — R channel, 0=mirror-smooth, 1=fully diffuse   (default 0.5)
     *   normalScale — G channel, Sobel/normal-map strength           (default 1.0)
     *   metallic    — B channel, specular tint toward albedo colour  (default 0.0)
     *   emissive    — A channel, additive glow bypass               (default 0.0)
     *
     * Pass null to immediately restore defaults.
     */
    setMaterial(mat) {
        if (!mat) {
            this.pendingMaterial = [0.5, 1.0, 0.0, 0.0];
            return;
        }
        this.pendingMaterial = [
            mat.roughness !== undefined ? Math.max(0, Math.min(1, mat.roughness)) : 0.5,
            mat.normalScale !== undefined ? Math.max(0, Math.min(1, mat.normalScale)) : 1.0,
            mat.metallic !== undefined ? Math.max(0, Math.min(1, mat.metallic)) : 0.0,
            mat.emissive !== undefined ? Math.max(0, Math.min(1, mat.emissive)) : 0.0,
        ];
    }
    resize(width, height) {
        const nextWidth = Math.max(1, Math.floor(width));
        const nextHeight = Math.max(1, Math.floor(height));
        if (nextWidth === this.width && nextHeight === this.height)
            return;
        this.width = nextWidth;
        this.height = nextHeight;
        try {
            this.texture.destroy();
        }
        catch {
            // ignore
        }
        this.texture = this.createRenderTexture(this.width, this.height);
        this.writeUniforms(this.width, this.height);
        // Material texture is sized on-demand in flushTo(); mark stale so it is
        // recreated at the next flush with the correct dimensions.
        this.materialW = 0;
        this.materialH = 0;
        if (this.materialTexture) {
            try {
                this.materialTexture.destroy();
            }
            catch { /* ignore */ }
            this.materialTexture = null;
        }
        // Depth-stencil texture is sized on-demand in flushTo().
    }
    setClearColor(color) {
        if (color === undefined || color === null) {
            this.clearColor = [0, 0, 0, 0];
            return;
        }
        const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color));
        this.clearColor = [r, g, b, a];
    }
    clearCommands() {
        this.rectCount = 0;
        this.textCount = 0;
        this.imageCount = 0;
        this.drawCommands.length = 0;
        this.polyVertexCount = 0;
        // Avoid leaking clip state across frames/flushes.
        this.clipStack.length = 0;
        this.currentClip = null;
        this.maskDepth = 0;
        this.maskStack.length = 0;
    }
    ensureDepthStencil(width, height) {
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        if (this.depthStencilTexture && this.depthStencilW === w && this.depthStencilH === h) {
            return this.depthStencilTexture;
        }
        try {
            this.depthStencilTexture?.destroy();
        }
        catch {
            // ignore
        }
        this.depthStencilW = w;
        this.depthStencilH = h;
        this.depthStencilTexture = this.device.createTexture({
            size: { width: w, height: h },
            format: 'depth24plus-stencil8',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
        return this.depthStencilTexture;
    }
    /**
     * Ensure the material render target exists and matches the requested dimensions.
     * Recreated lazily on first use and after resize().
     */
    ensureMaterialTexture(width, height) {
        const w = Math.max(1, Math.floor(width));
        const h = Math.max(1, Math.floor(height));
        if (this.materialTexture && this.materialW === w && this.materialH === h) {
            return this.materialTexture;
        }
        try {
            this.materialTexture?.destroy();
        }
        catch {
            // ignore
        }
        this.materialW = w;
        this.materialH = h;
        this.materialTexture = this.device.createTexture({
            size: { width: w, height: h },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
            label: 'ui_materialTexture'
        });
        return this.materialTexture;
    }
    writeRectClip(index, clipOverride) {
        const co = index * 4;
        const clip = clipOverride !== undefined ? clipOverride : this.currentClip;
        if (clip) {
            this.rectClipData[co + 0] = Math.floor(clip.x);
            this.rectClipData[co + 1] = Math.floor(clip.y);
            this.rectClipData[co + 2] = Math.ceil(clip.w);
            this.rectClipData[co + 3] = Math.ceil(clip.h);
        }
        else {
            this.rectClipData[co + 0] = -1;
            this.rectClipData[co + 1] = -1;
            this.rectClipData[co + 2] = -1;
            this.rectClipData[co + 3] = -1;
        }
    }
    writeTextClip(index, clipOverride) {
        const co = index * 4;
        const clip = clipOverride !== undefined ? clipOverride : this.currentClip;
        if (clip) {
            this.textClipData[co + 0] = Math.floor(clip.x);
            this.textClipData[co + 1] = Math.floor(clip.y);
            this.textClipData[co + 2] = Math.ceil(clip.w);
            this.textClipData[co + 3] = Math.ceil(clip.h);
        }
        else {
            this.textClipData[co + 0] = -1;
            this.textClipData[co + 1] = -1;
            this.textClipData[co + 2] = -1;
            this.textClipData[co + 3] = -1;
        }
    }
    writeImageClip(index, clipOverride) {
        const co = index * 4;
        const clip = clipOverride !== undefined ? clipOverride : this.currentClip;
        if (clip) {
            this.imageClipData[co + 0] = Math.floor(clip.x);
            this.imageClipData[co + 1] = Math.floor(clip.y);
            this.imageClipData[co + 2] = Math.ceil(clip.w);
            this.imageClipData[co + 3] = Math.ceil(clip.h);
        }
        else {
            this.imageClipData[co + 0] = -1;
            this.imageClipData[co + 1] = -1;
            this.imageClipData[co + 2] = -1;
            this.imageClipData[co + 3] = -1;
        }
    }
    /**
     * Push a stencil mask rect. Subsequent draws are masked until popMask().
     */
    pushMaskRect(x, y, w, h) {
        if (this.rectCount >= 16384)
            return;
        const depthBefore = this.maskDepth;
        // Capture the effective clip at push time so pop is symmetric and does not
        // leave stale stencil values when the clip stack changes.
        const clip = this.currentClip ? { x: this.currentClip.x, y: this.currentClip.y, w: this.currentClip.w, h: this.currentClip.h } : null;
        this.maskStack.push({ kind: 'rect', x, y, w, h, radius: 0, clip, depthBeforePush: depthBefore });
        // Record the mask push draw (increments stencil where stencil == depthBefore).
        const [r, g, b] = [0, 0, 0];
        const o = this.rectCount * 12;
        this.rectData[o + 0] = x;
        this.rectData[o + 1] = y;
        this.rectData[o + 2] = w;
        this.rectData[o + 3] = h;
        this.rectData[o + 4] = r;
        this.rectData[o + 5] = g;
        this.rectData[o + 6] = b;
        // Radius is packed into alpha for the mask shader (0 = sharp rect).
        this.rectData[o + 7] = 0;
        // Material floats (o+8..+11) are ignored by mask pipelines (writeMask=0).
        this.rectData[o + 8] = 0.5;
        this.rectData[o + 9] = 1.0;
        this.rectData[o + 10] = 0.0;
        this.rectData[o + 11] = 0.0;
        this.writeRectClip(this.rectCount, clip);
        this.rectStencilRef[this.rectCount] = depthBefore;
        this.drawCommands.push({ kind: 'rect', mode: 'maskPush', start: this.rectCount, count: 1 });
        this.rectCount++;
        this.maskDepth = Math.min(255, this.maskDepth + 1);
    }
    /**
     * Push a rounded-rect stencil mask. Radius is in pixels.
     */
    pushMaskRoundedRect(x, y, w, h, radius) {
        const radIn = Number.isFinite(radius) ? Math.max(0, radius) : 0;
        const maxRad = Math.max(0, Math.min(Math.abs(w), Math.abs(h)) * 0.5);
        const rad = Math.min(radIn, maxRad);
        // Radius 0 => fast rect mask.
        if (rad <= 0) {
            this.pushMaskRect(x, y, w, h);
            return;
        }
        // Use a convex polygon approximation for rounded masks.
        // This avoids relying on fragment discard for stencil writes (driver-dependent early-stencil behavior).
        const seg = Math.max(3, Math.min(12, Math.round(rad / 4)));
        const pts = [];
        const addArc = (cx, cy, a0, a1, includeFirst) => {
            const start = includeFirst ? 0 : 1;
            for (let i = start; i <= seg; i++) {
                const t = i / seg;
                const a = a0 + (a1 - a0) * t;
                pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
            }
        };
        const x0 = x;
        const y0 = y;
        const x1 = x + w;
        const y1 = y + h;
        // Clockwise: top-right, bottom-right, bottom-left, top-left.
        addArc(x1 - rad, y0 + rad, -Math.PI / 2, 0, true);
        addArc(x1 - rad, y1 - rad, 0, Math.PI / 2, false);
        addArc(x0 + rad, y1 - rad, Math.PI / 2, Math.PI, false);
        addArc(x0 + rad, y0 + rad, Math.PI, (3 * Math.PI) / 2, false);
        this.pushMaskPolygon(pts);
    }
    /**
     * Pop the most recent stencil mask.
     */
    popMask() {
        if (this.maskDepth <= 0) {
            this.maskDepth = 0;
            this.maskStack.length = 0;
            return;
        }
        if (this.rectCount >= 16384)
            return;
        const top = this.maskStack.pop();
        const depthAtPop = this.maskDepth;
        if (!top || top.kind === 'rect') {
            const rect = top ?? { kind: 'rect', x: 0, y: 0, w: 0, h: 0, radius: 0, clip: null, depthBeforePush: this.maskDepth - 1 };
            // Record the mask pop draw (decrements stencil where stencil == current depth).
            const [r, g, b, _a] = [0, 0, 0, 0];
            const o = this.rectCount * 12;
            this.rectData[o + 0] = rect.x;
            this.rectData[o + 1] = rect.y;
            this.rectData[o + 2] = rect.w;
            this.rectData[o + 3] = rect.h;
            this.rectData[o + 4] = r;
            this.rectData[o + 5] = g;
            this.rectData[o + 6] = b;
            // Store radius so pop matches push.
            this.rectData[o + 7] = rect.radius;
            // Material floats (o+8..+11) are ignored by mask pipelines (writeMask=0).
            this.rectData[o + 8] = 0.5;
            this.rectData[o + 9] = 1.0;
            this.rectData[o + 10] = 0.0;
            this.rectData[o + 11] = 0.0;
            this.writeRectClip(this.rectCount, rect.clip);
            this.rectStencilRef[this.rectCount] = depthAtPop;
            this.drawCommands.push({ kind: 'rect', mode: 'maskPop', start: this.rectCount, count: 1 });
            this.rectCount++;
        }
        else {
            const clip = top.clip;
            const cx = clip ? Math.floor(clip.x) : -1;
            const cy = clip ? Math.floor(clip.y) : -1;
            const cw = clip ? Math.ceil(clip.w) : -1;
            const ch = clip ? Math.ceil(clip.h) : -1;
            this.drawCommands.push({
                kind: 'poly',
                mode: 'maskPop',
                firstVertex: top.firstVertex,
                vertexCount: top.vertexCount,
                clipX: cx,
                clipY: cy,
                clipW: cw,
                clipH: ch,
                stencilRef: depthAtPop
            });
        }
        this.maskDepth = Math.max(0, this.maskDepth - 1);
    }
    /**
     * Push a polygon/path stencil mask.
     * Points are interpreted as a triangle fan, so the polygon should be convex.
     */
    pushMaskPolygon(points) {
        if (!points || points.length < 3)
            return;
        // Triangulate as a fan (convex polygon expected) => triangle-list.
        const triVertexCount = (points.length - 2) * 3;
        if (triVertexCount <= 0)
            return;
        // Reserve space
        if (this.polyVertexCount + triVertexCount > 8192)
            return;
        const depthBefore = this.maskDepth;
        const clip = this.currentClip ? { x: this.currentClip.x, y: this.currentClip.y, w: this.currentClip.w, h: this.currentClip.h } : null;
        const firstVertex = this.polyVertexCount;
        const p0 = points[0];
        for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            let o = this.polyVertexCount * 2;
            this.polyData[o + 0] = p0.x;
            this.polyData[o + 1] = p0.y;
            this.polyVertexCount++;
            o = this.polyVertexCount * 2;
            this.polyData[o + 0] = p1.x;
            this.polyData[o + 1] = p1.y;
            this.polyVertexCount++;
            o = this.polyVertexCount * 2;
            this.polyData[o + 0] = p2.x;
            this.polyData[o + 1] = p2.y;
            this.polyVertexCount++;
        }
        this.maskStack.push({ kind: 'poly', firstVertex, vertexCount: triVertexCount, clip, depthBeforePush: depthBefore });
        const cx = clip ? Math.floor(clip.x) : -1;
        const cy = clip ? Math.floor(clip.y) : -1;
        const cw = clip ? Math.ceil(clip.w) : -1;
        const ch = clip ? Math.ceil(clip.h) : -1;
        this.drawCommands.push({
            kind: 'poly',
            mode: 'maskPush',
            firstVertex,
            vertexCount: triVertexCount,
            clipX: cx,
            clipY: cy,
            clipW: cw,
            clipH: ch,
            stencilRef: depthBefore
        });
        this.maskDepth = Math.min(255, this.maskDepth + 1);
    }
    /**
     * Push a rectangular clip region.
     * Clip regions are intersected (nested clipping).
     */
    pushClipRect(x, y, w, h) {
        const next = {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0,
            w: Number.isFinite(w) ? w : 0,
            h: Number.isFinite(h) ? h : 0
        };
        if (next.w <= 0 || next.h <= 0) {
            // Empty clip.
            this.clipStack.push(next);
            this.currentClip = { x: next.x, y: next.y, w: 0, h: 0 };
            return;
        }
        if (!this.currentClip) {
            this.clipStack.push(next);
            this.currentClip = next;
            return;
        }
        // Intersect with current clip.
        const a = this.currentClip;
        const x1 = Math.max(a.x, next.x);
        const y1 = Math.max(a.y, next.y);
        const x2 = Math.min(a.x + a.w, next.x + next.w);
        const y2 = Math.min(a.y + a.h, next.y + next.h);
        const iw = Math.max(0, x2 - x1);
        const ih = Math.max(0, y2 - y1);
        const inter = { x: x1, y: y1, w: iw, h: ih };
        this.clipStack.push(next);
        this.currentClip = inter;
    }
    /**
     * Pop the most recent clip region.
     */
    popClipRect() {
        if (this.clipStack.length === 0) {
            this.currentClip = null;
            return;
        }
        this.clipStack.pop();
        // Recompute intersection from scratch (stack sizes are expected to be small).
        let clip = null;
        for (const r of this.clipStack) {
            if (!clip) {
                clip = { x: r.x, y: r.y, w: r.w, h: r.h };
                continue;
            }
            const x1 = Math.max(clip.x, r.x);
            const y1 = Math.max(clip.y, r.y);
            const x2 = Math.min(clip.x + clip.w, r.x + r.w);
            const y2 = Math.min(clip.y + clip.h, r.y + r.h);
            clip = { x: x1, y: y1, w: Math.max(0, x2 - x1), h: Math.max(0, y2 - y1) };
        }
        this.currentClip = clip;
    }
    rect(x, y, w, h, color) {
        if (w <= 0 || h <= 0)
            return;
        if (this.rectCount >= 16384)
            return;
        const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color));
        const o = this.rectCount * 12;
        this.rectData[o + 0] = x;
        this.rectData[o + 1] = y;
        this.rectData[o + 2] = w;
        this.rectData[o + 3] = h;
        this.rectData[o + 4] = r;
        this.rectData[o + 5] = g;
        this.rectData[o + 6] = b;
        this.rectData[o + 7] = a;
        // Material: write current material (sticky — persists until setMaterial() is called again).
        this.rectData[o + 8] = this.pendingMaterial[0];
        this.rectData[o + 9] = this.pendingMaterial[1];
        this.rectData[o + 10] = this.pendingMaterial[2];
        this.rectData[o + 11] = this.pendingMaterial[3];
        this.writeRectClip(this.rectCount);
        this.rectStencilRef[this.rectCount] = this.maskDepth;
        this.drawCommands.push({ kind: 'rect', mode: 'fill', start: this.rectCount, count: 1 });
        this.rectCount++;
    }
    text(text, x, y, color, scale) {
        if (!text)
            return;
        const s = (Number.isFinite(scale) && scale > 0) ? scale : 1;
        const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color));
        const baseCharW = this.atlas.getCharWidth();
        const baseCharH = this.atlas.getCharHeight();
        const charW = baseCharW * s; // cursor advance (always scale-based)
        const charH = baseCharH * s; // nominal cell height for layout
        // When scale differs meaningfully from 1.0, rasterize into the atlas at the
        // target size so the GPU samples a crisp native-resolution glyph rather than
        // stretching a small base-size rasterization.  Snap to the nearest 2px to
        // limit unique atlas entries while still covering most practical sizes.
        const useSizedGlyph = Math.abs(s - 1.0) > 0.15;
        const targetFontPx = useSizedGlyph
            ? Math.max(4, Math.round(this.atlas.getFontSize() * s / 2) * 2)
            : 0;
        const start = this.textCount;
        let cursorX = x;
        for (const ch of text) {
            if (this.textCount >= 4096)
                break;
            const glyph = useSizedGlyph
                ? this.atlas.getGlyphAtSize(ch, targetFontPx)
                : this.atlas.getGlyph(ch);
            // Quad dimensions: use rasterized size when available (no GPU upscale),
            // otherwise fall back to scaled base-size dimensions.
            const quadW = useSizedGlyph
                ? (glyph.pixelWidth || charW)
                : Math.max(baseCharW, glyph.pixelWidth || 0) * s;
            const quadH = useSizedGlyph
                ? (glyph.pixelHeight || charH)
                : charH;
            const o = this.textCount * 16;
            this.textData[o + 0] = cursorX;
            this.textData[o + 1] = y;
            this.textData[o + 2] = quadW;
            this.textData[o + 3] = quadH;
            this.textData[o + 4] = r;
            this.textData[o + 5] = g;
            this.textData[o + 6] = b;
            this.textData[o + 7] = a;
            this.textData[o + 8] = glyph.u;
            this.textData[o + 9] = glyph.v;
            this.textData[o + 10] = glyph.w;
            this.textData[o + 11] = glyph.h;
            // Material: write current material (sticky — same material applies to all glyphs in this call).
            this.textData[o + 12] = this.pendingMaterial[0];
            this.textData[o + 13] = this.pendingMaterial[1];
            this.textData[o + 14] = this.pendingMaterial[2];
            this.textData[o + 15] = this.pendingMaterial[3];
            this.writeTextClip(this.textCount);
            this.textStencilRef[this.textCount] = this.maskDepth;
            this.textCount++;
            cursorX += charW;
        }
        const count = this.textCount - start;
        if (count > 0) {
            this.drawCommands.push({ kind: 'text', start, count });
        }
    }
    /**
     * Register an image under an id for subsequent image() draws.
     * Caller owns the source lifetime; this method copies it to GPU.
     */
    registerImage(imageId, image) {
        if (!imageId || !image)
            return null;
        const width = Math.max(1, image.width | 0);
        const height = Math.max(1, image.height | 0);
        const texture = this.device.createTexture({
            size: { width, height },
            format: 'rgba8unorm',
            // Dawn may require RENDER_ATTACHMENT for copyExternalImageToTexture internally.
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });
        this.device.queue.copyExternalImageToTexture({ source: image }, { texture }, { width, height });
        const sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge'
        });
        const bindGroup = this.device.createBindGroup({
            layout: this.texturedBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: texture.createView() },
                { binding: 2, resource: sampler }
            ]
        });
        this.imageBindGroups.set(imageId, bindGroup);
        this.imageSizes.set(imageId, { width, height });
        return { width, height };
    }
    getImageSize(imageId) {
        return this.imageSizes.get(imageId) ?? null;
    }
    image(imageId, x, y, w, h, options) {
        if (!imageId)
            return;
        if (w <= 0 || h <= 0)
            return;
        if (this.imageCount >= 4096)
            return;
        if (!this.imageBindGroups.has(imageId))
            return;
        const tint = options?.tint ?? { r: 255, g: 255, b: 255, a: 1 };
        const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(tint));
        const uv = options?.uv ?? { u: 0, v: 0, w: 1, h: 1 };
        const o = this.imageCount * 16;
        this.imageData[o + 0] = x;
        this.imageData[o + 1] = y;
        this.imageData[o + 2] = w;
        this.imageData[o + 3] = h;
        this.imageData[o + 4] = r;
        this.imageData[o + 5] = g;
        this.imageData[o + 6] = b;
        this.imageData[o + 7] = a;
        this.imageData[o + 8] = uv.u;
        this.imageData[o + 9] = uv.v;
        this.imageData[o + 10] = uv.w;
        this.imageData[o + 11] = uv.h;
        // Material: write current material (sticky — persists until setMaterial() is called again).
        this.imageData[o + 12] = this.pendingMaterial[0];
        this.imageData[o + 13] = this.pendingMaterial[1];
        this.imageData[o + 14] = this.pendingMaterial[2];
        this.imageData[o + 15] = this.pendingMaterial[3];
        this.writeImageClip(this.imageCount);
        this.imageStencilRef[this.imageCount] = this.maskDepth;
        this.drawCommands.push({ kind: 'image', imageId, start: this.imageCount, count: 1 });
        this.imageCount++;
    }
    /**
     * Render current UI commands into the offscreen UI texture.
     * Clears to transparent each frame by default.
     */
    flush() {
        this.flushTo(this.texture, this.width, this.height, {
            clear: { r: this.clearColor[0], g: this.clearColor[1], b: this.clearColor[2], a: this.clearColor[3] },
            resetClearColor: true
        });
    }
    /**
     * Render current UI commands into an external target texture.
     * Target texture must be created with format getTextureFormat() and include RENDER_ATTACHMENT usage.
     */
    flushTo(targetTexture, targetWidth, targetHeight, options = {}) {
        const tw = Math.max(1, Math.floor(targetWidth));
        const th = Math.max(1, Math.floor(targetHeight));
        const clear = options.clear ?? { r: 0, g: 0, b: 0, a: 0 };
        // If the caller provided a clear color, always perform the clear even if it is fully
        // transparent. This keeps the UI texture deterministic (GPU textures are otherwise
        // uninitialized/undefined), and matches the "clears to transparent each frame" behavior.
        const callerRequestedClear = options.clear !== undefined;
        const shouldClear = callerRequestedClear || !(clear.r === 0 && clear.g === 0 && clear.b === 0 && clear.a === 0);
        if (this.rectCount === 0 && this.textCount === 0 && this.imageCount === 0 && !shouldClear) {
            return;
        }
        // Ensure uniforms match the target resolution.
        this.writeUniforms(tw, th);
        const depthStencil = this.ensureDepthStencil(tw, th);
        // Upload atlas updates (if new glyphs were cached)
        if (this.atlas.needsUpload()) {
            this.atlas.uploadToGPU(this.device);
            // Atlas texture may become available/updated; refresh bind group next draw.
            this.textBindGroup = null;
            this.lastAtlasTexture = null;
            this.lastAtlasSampler = null;
        }
        // Upload instance buffers
        if (this.rectCount > 0) {
            const byteCount = this.rectCount * 12 * 4;
            this.device.queue.writeBuffer(this.rectInstanceBuffer, 0, this.rectData.buffer, 0, byteCount);
        }
        if (this.textCount > 0) {
            const byteCount = this.textCount * 16 * 4;
            this.device.queue.writeBuffer(this.textInstanceBuffer, 0, this.textData.buffer, 0, byteCount);
        }
        if (this.imageCount > 0) {
            const byteCount = this.imageCount * 16 * 4;
            this.device.queue.writeBuffer(this.imageInstanceBuffer, 0, this.imageData.buffer, 0, byteCount);
        }
        // Upload polygon vertices for path masks
        if (this.polyVertexCount > 0) {
            const byteCount = this.polyVertexCount * 2 * 4;
            this.device.queue.writeBuffer(this.polyVertexBuffer, 0, this.polyData.buffer, 0, byteCount);
        }
        const commandEncoder = this.device.createCommandEncoder();
        const matTex = this.ensureMaterialTexture(tw, th);
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: targetTexture.createView(),
                    clearValue: clear,
                    loadOp: 'clear',
                    storeOp: 'store'
                },
                {
                    // Material render target: clear to defaults (roughness=0.5, normalScale=1.0, metallic=0, emissive=0)
                    view: matTex.createView(),
                    clearValue: { r: 0.5, g: 1.0, b: 0.0, a: 0.0 },
                    loadOp: 'clear',
                    storeOp: 'store'
                }
            ],
            depthStencilAttachment: {
                view: depthStencil.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
                stencilClearValue: 0,
                stencilLoadOp: 'clear',
                stencilStoreOp: 'store'
            }
        });
        const applyScissor = (clipX, clipY, clipW, clipH) => {
            // -1 sentinel means "no clip".
            if (clipX < 0 || clipY < 0 || clipW < 0 || clipH < 0) {
                return { x: 0, y: 0, w: tw, h: th };
            }
            const x1 = Math.max(0, Math.min(tw, clipX));
            const y1 = Math.max(0, Math.min(th, clipY));
            const x2 = Math.max(x1, Math.min(tw, clipX + clipW));
            const y2 = Math.max(y1, Math.min(th, clipY + clipH));
            return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
        };
        // Bind groups (cached)
        if (!this.rectBindGroup) {
            this.rectBindGroup = this.device.createBindGroup({
                layout: this.uniformBindGroupLayout,
                entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
            });
        }
        const atlasTexture = this.atlas.getTexture();
        const atlasSampler = this.atlas.getSampler();
        if (atlasTexture && atlasSampler) {
            const atlasChanged = atlasTexture !== this.lastAtlasTexture || atlasSampler !== this.lastAtlasSampler;
            if (!this.textBindGroup || atlasChanged) {
                this.textBindGroup = this.device.createBindGroup({
                    layout: this.texturedBindGroupLayout,
                    entries: [
                        { binding: 0, resource: { buffer: this.uniformBuffer } },
                        { binding: 1, resource: atlasTexture.createView() },
                        { binding: 2, resource: atlasSampler }
                    ]
                });
                this.lastAtlasTexture = atlasTexture;
                this.lastAtlasSampler = atlasSampler;
            }
        }
        const getRectClip = (idx) => {
            const o = idx * 4;
            return { x: this.rectClipData[o + 0], y: this.rectClipData[o + 1], w: this.rectClipData[o + 2], h: this.rectClipData[o + 3] };
        };
        const getTextClip = (idx) => {
            const o = idx * 4;
            return { x: this.textClipData[o + 0], y: this.textClipData[o + 1], w: this.textClipData[o + 2], h: this.textClipData[o + 3] };
        };
        const getImageClip = (idx) => {
            const o = idx * 4;
            return { x: this.imageClipData[o + 0], y: this.imageClipData[o + 1], w: this.imageClipData[o + 2], h: this.imageClipData[o + 3] };
        };
        const flushRun = (run) => {
            if (!run || run.count <= 0)
                return;
            const sc = applyScissor(run.clipX, run.clipY, run.clipW, run.clipH);
            if (sc.w <= 0 || sc.h <= 0)
                return;
            pass.setPipeline(run.pipeline);
            if (run.bindGroup)
                pass.setBindGroup(0, run.bindGroup);
            pass.setVertexBuffer(0, run.vertexBuffer);
            pass.setScissorRect(sc.x, sc.y, sc.w, sc.h);
            pass.setStencilReference(Math.max(0, Math.floor(run.stencilRef)));
            pass.draw(6, run.count, 0, run.start);
        };
        let run = null;
        for (const cmd of this.drawCommands) {
            if (cmd.kind === 'poly') {
                // Flush any pending instanced run before drawing polygon.
                flushRun(run);
                run = null;
                const sc = applyScissor(cmd.clipX, cmd.clipY, cmd.clipW, cmd.clipH);
                if (sc.w <= 0 || sc.h <= 0) {
                    continue;
                }
                const pipeline = cmd.mode === 'maskPush' ? this.polyMaskPushPipeline : this.polyMaskPopPipeline;
                pass.setPipeline(pipeline);
                pass.setBindGroup(0, this.rectBindGroup);
                pass.setVertexBuffer(0, this.polyVertexBuffer);
                pass.setScissorRect(sc.x, sc.y, sc.w, sc.h);
                pass.setStencilReference(Math.max(0, Math.floor(cmd.stencilRef)));
                pass.draw(cmd.vertexCount, 1, cmd.firstVertex, 0);
                continue;
            }
            if (cmd.kind === 'rect') {
                const clip = getRectClip(cmd.start);
                const stencilRef = this.rectStencilRef[cmd.start] ?? 0;
                const pipeline = cmd.mode === 'fill' ? this.rectPipeline : (cmd.mode === 'maskPush' ? this.maskPushPipeline : this.maskPopPipeline);
                const bindGroup = this.rectBindGroup;
                const vertexBuffer = this.rectInstanceBuffer;
                const canExtend = run &&
                    run.kind === 'rect' &&
                    run.pipeline === pipeline &&
                    run.stencilRef === stencilRef &&
                    run.clipX === clip.x && run.clipY === clip.y && run.clipW === clip.w && run.clipH === clip.h &&
                    (run.start + run.count) === cmd.start;
                if (!canExtend) {
                    flushRun(run);
                    run = {
                        kind: 'rect',
                        pipeline,
                        bindGroup,
                        vertexBuffer,
                        start: cmd.start,
                        count: cmd.count,
                        clipX: clip.x,
                        clipY: clip.y,
                        clipW: clip.w,
                        clipH: clip.h,
                        stencilRef
                    };
                }
                else if (run) {
                    run.count += cmd.count;
                }
                continue;
            }
            if (cmd.kind === 'image') {
                const bindGroup = this.imageBindGroups.get(cmd.imageId) ?? null;
                if (!bindGroup)
                    continue;
                const clip = getImageClip(cmd.start);
                const stencilRef = this.imageStencilRef[cmd.start] ?? 0;
                const pipeline = this.textPipeline;
                const vertexBuffer = this.imageInstanceBuffer;
                const canExtend = run &&
                    run.kind === 'image' &&
                    run.pipeline === pipeline &&
                    run.bindGroup === bindGroup &&
                    run.stencilRef === stencilRef &&
                    run.clipX === clip.x && run.clipY === clip.y && run.clipW === clip.w && run.clipH === clip.h &&
                    (run.start + run.count) === cmd.start;
                if (!canExtend) {
                    flushRun(run);
                    run = {
                        kind: 'image',
                        pipeline,
                        bindGroup,
                        vertexBuffer,
                        start: cmd.start,
                        count: cmd.count,
                        clipX: clip.x,
                        clipY: clip.y,
                        clipW: clip.w,
                        clipH: clip.h,
                        stencilRef
                    };
                }
                else if (run) {
                    run.count += cmd.count;
                }
                continue;
            }
            // text
            if (!this.textBindGroup) {
                // If atlas isn't ready, skip text commands.
                continue;
            }
            const clip = getTextClip(cmd.start);
            const stencilRef = this.textStencilRef[cmd.start] ?? 0;
            const pipeline = this.textPipeline;
            const bindGroup = this.textBindGroup;
            const vertexBuffer = this.textInstanceBuffer;
            const canExtend = run &&
                run.kind === 'text' &&
                run.pipeline === pipeline &&
                run.stencilRef === stencilRef &&
                run.clipX === clip.x && run.clipY === clip.y && run.clipW === clip.w && run.clipH === clip.h &&
                (run.start + run.count) === cmd.start;
            if (!canExtend) {
                flushRun(run);
                run = {
                    kind: 'text',
                    pipeline,
                    bindGroup,
                    vertexBuffer,
                    start: cmd.start,
                    count: cmd.count,
                    clipX: clip.x,
                    clipY: clip.y,
                    clipW: clip.w,
                    clipH: clip.h,
                    stencilRef
                };
            }
            else if (run) {
                run.count += cmd.count;
            }
        }
        flushRun(run);
        pass.end();
        this.device.queue.submit([commandEncoder.finish()]);
        // Immediate-mode by default: commands are per-flush
        this.clearCommands();
        if (options.resetClearColor) {
            this.clearColor = [0, 0, 0, 0];
        }
    }
    writeUniforms(width, height) {
        if (width === this.lastUniformW && height === this.lastUniformH)
            return;
        this.lastUniformW = width;
        this.lastUniformH = height;
        const data = new Float32Array([width, height, 0, 0]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
    }
    createRenderTexture(width, height) {
        return this.device.createTexture({
            size: { width, height },
            format: this.textureFormat,
            usage: GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_SRC
        });
    }
    createRectPipeline() {
        const shader = this.device.createShaderModule({
            code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VSOut {
          @builtin(position) position: vec4f,
          @location(0) color: vec4f,
          @location(1) material: vec4f,
        }

        struct FSOut {
          @location(0) color: vec4f,
          @location(1) material: vec4f,
        }

        @vertex
        fn vs_main(
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
          @location(0) posSize: vec4f,
          @location(1) color: vec4f,
          @location(2) material: vec4f,
        ) -> VSOut {
          var quad = array<vec2f, 6>(
            vec2f(0.0, 0.0),
            vec2f(1.0, 0.0),
            vec2f(0.0, 1.0),
            vec2f(1.0, 0.0),
            vec2f(1.0, 1.0),
            vec2f(0.0, 1.0)
          );

          let x = posSize.x;
          let y = posSize.y;
          let w = posSize.z;
          let h = posSize.w;

          let p = vec2f(x, y) + quad[vertexIndex] * vec2f(w, h);

          var clip = (p / uniforms.resolution) * 2.0 - 1.0;
          clip.y = -clip.y;

          var out: VSOut;
          out.position = vec4f(clip, 0.0, 1.0);
          out.color = color;
          out.material = material;
          return out;
        }

        @fragment
        fn fs_main(input: VSOut) -> FSOut {
          var out: FSOut;
          out.color = input.color;
          out.material = input.material;
          return out;
        }
      `
        });
        return this.device.createRenderPipeline({
            layout: this.uniformPipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 48,
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x4' }, // posSize
                            { shaderLocation: 1, offset: 16, format: 'float32x4' }, // color
                            { shaderLocation: 2, offset: 32, format: 'float32x4' }, // material
                        ]
                    }]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: this.textureFormat,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        }
                    },
                    {
                        // Material target: no blending — last drawn element's material wins.
                        format: 'rgba8unorm'
                    }
                ]
            },
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: false,
                depthCompare: 'always',
                stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
                stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
                stencilReadMask: 0xff,
                stencilWriteMask: 0x00
            },
            primitive: { topology: 'triangle-list' }
        });
    }
    createMaskPipeline(mode) {
        const shader = this.device.createShaderModule({
            code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VSOut {
          @builtin(position) position: vec4f,
          @location(0) localPx: vec2f,
          @location(1) sizePx: vec2f,
          @location(2) radiusPx: f32,
        }

        @vertex
        fn vs_main(
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
          @location(0) posSize: vec4f,
          @location(1) color: vec4f,
        ) -> VSOut {
          var quad = array<vec2f, 6>(
            vec2f(0.0, 0.0),
            vec2f(1.0, 0.0),
            vec2f(0.0, 1.0),
            vec2f(1.0, 0.0),
            vec2f(1.0, 1.0),
            vec2f(0.0, 1.0)
          );

          let x = posSize.x;
          let y = posSize.y;
          let w = posSize.z;
          let h = posSize.w;

          let p = vec2f(x, y) + quad[vertexIndex] * vec2f(w, h);

          var clip = (p / uniforms.resolution) * 2.0 - 1.0;
          clip.y = -clip.y;

          var out: VSOut;
          out.position = vec4f(clip, 0.0, 1.0);
          out.localPx = quad[vertexIndex] * vec2f(w, h);
          out.sizePx = vec2f(w, h);
          out.radiusPx = color.a;
          return out;
        }

        @fragment
        fn fs_main(input: VSOut) -> @location(0) vec4f {
          // Rounded-rect mask. Radius is packed into alpha.
          let w = input.sizePx.x;
          let h = input.sizePx.y;
          var r = input.radiusPx;
          r = clamp(r, 0.0, min(w, h) * 0.5);

          if (r > 0.0) {
            let x = input.localPx.x;
            let y = input.localPx.y;

            // Fast accept in the central cross area.
            if (!((x >= r && x <= (w - r)) || (y >= r && y <= (h - r)))) {
              let cx = select(r, w - r, x > (w - r));
              let cy = select(r, h - r, y > (h - r));
              let dx = x - cx;
              let dy = y - cy;
              if ((dx * dx + dy * dy) > (r * r)) {
                discard;
              }
            }
          }

          // Color writes are disabled for this pipeline, but we must return something.
          return vec4f(0.0, 0.0, 0.0, 0.0);
        }
      `
        });
        const passOp = mode === 'increment' ? 'increment-clamp' : 'decrement-clamp';
        return this.device.createRenderPipeline({
            layout: this.uniformPipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 48, // 12 floats; shader only reads first 8 (posSize + color), rest ignored
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x4' },
                            { shaderLocation: 1, offset: 16, format: 'float32x4' },
                        ]
                    }]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [
                    { format: this.textureFormat, writeMask: 0 },
                    // Material target: writeMask=0 — mask passes do not write material data.
                    { format: 'rgba8unorm', writeMask: 0 }
                ]
            },
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: false,
                depthCompare: 'always',
                stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp },
                stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp },
                stencilReadMask: 0xff,
                stencilWriteMask: 0xff
            },
            primitive: { topology: 'triangle-list' }
        });
    }
    createPolyMaskPipeline(mode) {
        const shader = this.device.createShaderModule({
            code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VSOut {
          @builtin(position) position: vec4f,
        }

        @vertex
        fn vs_main(
          @location(0) pos: vec2f
        ) -> VSOut {
          var clip = (pos / uniforms.resolution) * 2.0 - 1.0;
          clip.y = -clip.y;
          var out: VSOut;
          out.position = vec4f(clip, 0.0, 1.0);
          return out;
        }

        @fragment
        fn fs_main(_input: VSOut) -> @location(0) vec4f {
          return vec4f(0.0, 0.0, 0.0, 0.0);
        }
      `
        });
        const passOp = mode === 'increment' ? 'increment-clamp' : 'decrement-clamp';
        return this.device.createRenderPipeline({
            layout: this.uniformPipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 8,
                        stepMode: 'vertex',
                        attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x2' }]
                    }]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [
                    { format: this.textureFormat, writeMask: 0 },
                    // Material target: writeMask=0 — poly mask passes do not write material data.
                    { format: 'rgba8unorm', writeMask: 0 }
                ]
            },
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: false,
                depthCompare: 'always',
                stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp },
                stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp },
                stencilReadMask: 0xff,
                stencilWriteMask: 0xff
            },
            primitive: { topology: 'triangle-list' }
        });
    }
    createTextPipeline() {
        const shader = this.device.createShaderModule({
            code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var tex: texture_2d<f32>;
        @group(0) @binding(2) var texSampler: sampler;

        struct VSOut {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
          @location(1) color: vec4f,
          @location(2) material: vec4f,
        }

        struct FSOut {
          @location(0) color: vec4f,
          @location(1) material: vec4f,
        }

        @vertex
        fn vs_main(
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
          @location(0) posSize: vec4f,
          @location(1) color: vec4f,
          @location(2) uvRect: vec4f,
          @location(3) material: vec4f,
        ) -> VSOut {
          var quad = array<vec2f, 6>(
            vec2f(0.0, 0.0),
            vec2f(1.0, 0.0),
            vec2f(0.0, 1.0),
            vec2f(1.0, 0.0),
            vec2f(1.0, 1.0),
            vec2f(0.0, 1.0)
          );

          let x = posSize.x;
          let y = posSize.y;
          let w = posSize.z;
          let h = posSize.w;

          let p = vec2f(x, y) + quad[vertexIndex] * vec2f(w, h);

          var clip = (p / uniforms.resolution) * 2.0 - 1.0;
          clip.y = -clip.y;

          var out: VSOut;
          out.position = vec4f(clip, 0.0, 1.0);
          out.uv = uvRect.xy + quad[vertexIndex] * uvRect.zw;
          out.color = color;
          out.material = material;
          return out;
        }

        @fragment
        fn fs_main(input: VSOut) -> FSOut {
          let c = textureSample(tex, texSampler, input.uv);
          var out: FSOut;
          out.color = vec4f(input.color.rgb * c.rgb, input.color.a * c.a);
          out.material = input.material;
          return out;
        }
      `
        });
        return this.device.createRenderPipeline({
            layout: this.texturedPipelineLayout,
            vertex: {
                module: shader,
                entryPoint: 'vs_main',
                buffers: [{
                        arrayStride: 64, // 16 floats: posSize + color + uvRect + material
                        stepMode: 'instance',
                        attributes: [
                            { shaderLocation: 0, offset: 0, format: 'float32x4' }, // posSize
                            { shaderLocation: 1, offset: 16, format: 'float32x4' }, // color
                            { shaderLocation: 2, offset: 32, format: 'float32x4' }, // uvRect
                            { shaderLocation: 3, offset: 48, format: 'float32x4' }, // material
                        ]
                    }]
            },
            fragment: {
                module: shader,
                entryPoint: 'fs_main',
                targets: [
                    {
                        format: this.textureFormat,
                        blend: {
                            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                        }
                    },
                    {
                        // Material target: no blending — last drawn element's material wins.
                        format: 'rgba8unorm'
                    }
                ]
            },
            depthStencil: {
                format: 'depth24plus-stencil8',
                depthWriteEnabled: false,
                depthCompare: 'always',
                stencilFront: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
                stencilBack: { compare: 'equal', failOp: 'keep', depthFailOp: 'keep', passOp: 'keep' },
                stencilReadMask: 0xff,
                stencilWriteMask: 0x00
            },
            primitive: { topology: 'triangle-list' }
        });
    }
}
//# sourceMappingURL=webgpu-ui-renderer.js.map