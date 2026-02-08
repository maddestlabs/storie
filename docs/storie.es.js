var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const KEY = {
  SPACE: " ",
  ENTER: "Enter",
  ESC: "Escape",
  ARROW_UP: "ArrowUp",
  ARROW_DOWN: "ArrowDown",
  ARROW_LEFT: "ArrowLeft",
  ARROW_RIGHT: "ArrowRight",
  TAB: "Tab",
  BACKSPACE: "Backspace",
  DELETE: "Delete",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown"
};
const COLORS = {
  BLACK: { r: 0, g: 0, b: 0 },
  WHITE: { r: 255, g: 255, b: 255 },
  RED: { r: 255, g: 0, b: 0 },
  GREEN: { r: 0, g: 255, b: 0 },
  BLUE: { r: 0, g: 0, b: 255 },
  YELLOW: { r: 255, g: 255, b: 0 },
  CYAN: { r: 0, g: 255, b: 255 },
  MAGENTA: { r: 255, g: 0, b: 255 }
};
class Layer {
  constructor(id, width, height) {
    __publicField(this, "id");
    __publicField(this, "buffer");
    __publicField(this, "visible", true);
    __publicField(this, "alpha", 1);
    __publicField(this, "width");
    __publicField(this, "height");
    this.id = id;
    this.width = width;
    this.height = height;
    this.buffer = this.createBuffer(width, height);
  }
  createBuffer(width, height) {
    const buffer = [];
    for (let y = 0; y < height; y++) {
      const row = [];
      for (let x = 0; x < width; x++) {
        row.push({
          char: " ",
          fg: { ...COLORS.WHITE },
          bg: { ...COLORS.BLACK }
        });
      }
      buffer.push(row);
    }
    return buffer;
  }
  write(x, y, text, fg, bg) {
    if (y < 0 || y >= this.height) return;
    for (let i = 0; i < text.length; i++) {
      const px = x + i;
      if (px < 0 || px >= this.width) continue;
      const cell = this.buffer[y][px];
      cell.char = text[i];
      if (fg) cell.fg = { ...fg };
      if (bg) cell.bg = { ...bg };
    }
  }
  plot(x, y, char, fg, bg) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    const cell = this.buffer[y][x];
    cell.char = char;
    if (fg) cell.fg = { ...fg };
    if (bg) cell.bg = { ...bg };
  }
  clear(bgColor) {
    const bg = bgColor || COLORS.BLACK;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.buffer[y][x] = {
          char: " ",
          fg: { ...COLORS.WHITE },
          bg: { ...bg }
        };
      }
    }
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.buffer = this.createBuffer(width, height);
  }
}
class LayerStack {
  constructor(width, height) {
    __publicField(this, "layers", /* @__PURE__ */ new Map());
    __publicField(this, "layerOrder", []);
    __publicField(this, "activeLayerId", "default");
    __publicField(this, "width");
    __publicField(this, "height");
    this.width = width;
    this.height = height;
    this.create("default", width, height);
  }
  create(id, width, height) {
    const w = width || this.width;
    const h = height || this.height;
    const layer = new Layer(id, w, h);
    this.layers.set(id, layer);
    if (!this.layerOrder.includes(id)) {
      this.layerOrder.push(id);
    }
    return layer;
  }
  get(id) {
    return this.layers.get(id);
  }
  getActive() {
    return this.layers.get(this.activeLayerId) || this.layers.get("default");
  }
  show(id) {
    const layer = this.layers.get(id);
    if (layer) layer.visible = true;
  }
  hide(id) {
    const layer = this.layers.get(id);
    if (layer) layer.visible = false;
  }
  setAlpha(id, alpha) {
    const layer = this.layers.get(id);
    if (layer) layer.alpha = Math.max(0, Math.min(1, alpha));
  }
  remove(id) {
    if (id === "default") return;
    this.layers.delete(id);
    const index = this.layerOrder.indexOf(id);
    if (index !== -1) {
      this.layerOrder.splice(index, 1);
    }
  }
  /**
   * Composite all visible layers into a single buffer
   * Layers are composited in order with alpha blending
   */
  composite() {
    const result = [];
    for (let y = 0; y < this.height; y++) {
      const row = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          char: " ",
          fg: { ...COLORS.WHITE },
          bg: { ...COLORS.BLACK }
        });
      }
      result.push(row);
    }
    for (const layerId of this.layerOrder) {
      const layer = this.layers.get(layerId);
      if (!layer || !layer.visible) continue;
      for (let y = 0; y < Math.min(layer.height, this.height); y++) {
        for (let x = 0; x < Math.min(layer.width, this.width); x++) {
          const srcCell = layer.buffer[y][x];
          const dstCell = result[y][x];
          if (layer.alpha >= 1) {
            dstCell.char = srcCell.char;
            dstCell.fg = { ...srcCell.fg };
            dstCell.bg = { ...srcCell.bg };
          } else {
            const alpha = layer.alpha;
            const invAlpha = 1 - alpha;
            if (srcCell.char !== " ") {
              dstCell.char = srcCell.char;
              dstCell.fg = {
                r: Math.round(srcCell.fg.r * alpha + dstCell.fg.r * invAlpha),
                g: Math.round(srcCell.fg.g * alpha + dstCell.fg.g * invAlpha),
                b: Math.round(srcCell.fg.b * alpha + dstCell.fg.b * invAlpha)
              };
            }
            dstCell.bg = {
              r: Math.round(srcCell.bg.r * alpha + dstCell.bg.r * invAlpha),
              g: Math.round(srcCell.bg.g * alpha + dstCell.bg.g * invAlpha),
              b: Math.round(srcCell.bg.b * alpha + dstCell.bg.b * invAlpha)
            };
          }
        }
      }
    }
    return result;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    for (const layer of this.layers.values()) {
      layer.resize(width, height);
    }
  }
}
class InputManager {
  constructor(canvas) {
    __publicField(this, "state");
    __publicField(this, "canvas");
    this.canvas = canvas;
    this.state = {
      keys: /* @__PURE__ */ new Map(),
      keysPressed: /* @__PURE__ */ new Set(),
      keysReleased: /* @__PURE__ */ new Set(),
      mouseX: 0,
      mouseY: 0,
      mouseButtons: /* @__PURE__ */ new Map(),
      mouseButtonsClicked: /* @__PURE__ */ new Set()
    };
    this.setupEventListeners();
  }
  setupEventListeners() {
    window.addEventListener("keydown", (e) => {
      if (!this.state.keys.get(e.key)) {
        this.state.keysPressed.add(e.key);
      }
      this.state.keys.set(e.key, true);
    });
    window.addEventListener("keyup", (e) => {
      this.state.keys.set(e.key, false);
      this.state.keysReleased.add(e.key);
    });
    this.canvas.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.state.mouseX = e.clientX - rect.left;
      this.state.mouseY = e.clientY - rect.top;
    });
    this.canvas.addEventListener("mousedown", (e) => {
      this.state.mouseButtons.set(e.button, true);
      this.state.mouseButtonsClicked.add(e.button);
      e.preventDefault();
    });
    this.canvas.addEventListener("mouseup", (e) => {
      this.state.mouseButtons.set(e.button, false);
      e.preventDefault();
    });
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
    });
  }
  isKeyDown(key) {
    return this.state.keys.get(key) || false;
  }
  isKeyPressed(key) {
    return this.state.keysPressed.has(key);
  }
  isKeyReleased(key) {
    return this.state.keysReleased.has(key);
  }
  isMouseDown(button = 0) {
    return this.state.mouseButtons.get(button) || false;
  }
  isMouseClicked(button = 0) {
    return this.state.mouseButtonsClicked.has(button);
  }
  getMouseX() {
    return this.state.mouseX;
  }
  getMouseY() {
    return this.state.mouseY;
  }
  /**
   * Update mouse position (used by event handlers)
   */
  updateMousePosition(x, y) {
    console.log(`📍 InputManager.updateMousePosition(${x}, ${y})`);
    this.state.mouseX = x;
    this.state.mouseY = y;
    console.log(`   State now: mouseX=${this.state.mouseX}, mouseY=${this.state.mouseY}`);
  }
  /**
   * Clear frame-specific input states
   * Call this at the end of each frame
   */
  endFrame() {
    this.state.keysPressed.clear();
    this.state.keysReleased.clear();
    this.state.mouseButtonsClicked.clear();
  }
}
class Canvas2DRenderer {
  constructor(canvas, config = {}) {
    __publicField(this, "canvas");
    __publicField(this, "ctx");
    __publicField(this, "width");
    __publicField(this, "height");
    // Font settings
    __publicField(this, "fontFamily");
    __publicField(this, "fontSize");
    __publicField(this, "cellWidth");
    __publicField(this, "cellHeight");
    // Font loaded flag
    __publicField(this, "fontLoaded", false);
    this.canvas = canvas;
    this.width = 80;
    this.height = 24;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context");
    }
    this.ctx = ctx;
    this.fontFamily = config.fontFamily || 'Monaco, Consolas, "Courier New", monospace';
    this.fontSize = config.fontSize || 16;
    this.cellWidth = config.cellWidth || 10;
    this.cellHeight = config.cellHeight || 20;
    this.setupCanvas();
    this.waitForFont();
  }
  async waitForFont() {
    try {
      await document.fonts.load(`${this.fontSize}px ${this.fontFamily}`);
      this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
      this.fontLoaded = true;
    } catch (e) {
      console.warn("Font loading failed, using fallback:", e);
      this.fontLoaded = true;
    }
  }
  setupCanvas() {
    this.canvas.width = this.width * this.cellWidth;
    this.canvas.height = this.height * this.cellHeight;
    this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    this.ctx.textBaseline = "top";
    this.ctx.textAlign = "left";
    this.ctx.imageSmoothingEnabled = true;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.setupCanvas();
  }
  getWidth() {
    return this.width;
  }
  getHeight() {
    return this.height;
  }
  /**
   * Render a buffer of cells to the canvas
   */
  render(buffer) {
    if (!this.fontLoaded) return;
    this.ctx.fillStyle = "#000000";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (let y = 0; y < Math.min(buffer.length, this.height); y++) {
      const row = buffer[y];
      for (let x = 0; x < Math.min(row.length, this.width); x++) {
        const cell = row[x];
        this.renderCell(x, y, cell);
      }
    }
  }
  renderCell(x, y, cell) {
    const px = x * this.cellWidth;
    const py = y * this.cellHeight;
    this.ctx.fillStyle = this.colorToString(cell.bg);
    this.ctx.fillRect(px, py, this.cellWidth, this.cellHeight);
    if (cell.char && cell.char !== " ") {
      this.ctx.fillStyle = this.colorToString(cell.fg);
      this.ctx.fillText(cell.char, px + 1, py + 2);
    }
  }
  colorToString(color) {
    if (color.a !== void 0 && color.a < 1) {
      return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
  }
  /**
   * Clear the canvas
   */
  clear(color = { r: 0, g: 0, b: 0 }) {
    this.ctx.fillStyle = this.colorToString(color);
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
class WebGPURenderer {
  constructor(canvas, config = {}) {
    __publicField(this, "canvas");
    __publicField(this, "device", null);
    __publicField(this, "context", null);
    __publicField(this, "pipeline", null);
    __publicField(this, "width");
    __publicField(this, "height");
    // Font settings
    __publicField(this, "fontFamily");
    __publicField(this, "fontSize");
    __publicField(this, "charWidth");
    __publicField(this, "charHeight");
    // Glyph atlas (Canvas2D for rasterization)
    __publicField(this, "atlasCanvas");
    __publicField(this, "atlasCtx");
    __publicField(this, "glyphCache", /* @__PURE__ */ new Map());
    __publicField(this, "atlasTexture", null);
    __publicField(this, "atlasSampler", null);
    __publicField(this, "atlasX", 0);
    __publicField(this, "atlasY", 0);
    __publicField(this, "atlasRowHeight", 0);
    __publicField(this, "atlasNeedsUpload", false);
    // WebGPU resources
    __publicField(this, "uniformBuffer", null);
    __publicField(this, "cellBuffer", null);
    __publicField(this, "cellData", null);
    __publicField(this, "bindGroup", null);
    __publicField(this, "initialized", false);
    __publicField(this, "fontLoggedOnce", false);
    this.canvas = canvas;
    this.width = 80;
    this.height = 24;
    this.fontFamily = config.fontFamily || 'Monaco, Consolas, "Courier New", monospace';
    this.fontSize = config.fontSize || 16;
    this.charWidth = config.charWidth || 10;
    this.charHeight = config.charHeight || 20;
    this.atlasCanvas = document.createElement("canvas");
    this.atlasCanvas.width = 2048;
    this.atlasCanvas.height = 2048;
    const ctx = this.atlasCanvas.getContext("2d", {
      alpha: true,
      willReadFrequently: true
    });
    if (!ctx) throw new Error("Failed to create atlas context");
    this.atlasCtx = ctx;
  }
  async init() {
    if (this.initialized) return true;
    console.log("[WebGPU] Initializing renderer...");
    if (!navigator.gpu) {
      console.error("[WebGPU] Not supported in this browser");
      return false;
    }
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance"
      });
      if (!adapter) {
        console.error("[WebGPU] Failed to get GPU adapter");
        return false;
      }
      this.device = await adapter.requestDevice();
      this.device.lost.then((info) => {
        console.error("[WebGPU] Device lost:", info.message);
        this.initialized = false;
      });
      this.context = this.canvas.getContext("webgpu");
      if (!this.context) {
        console.error("[WebGPU] Failed to get canvas context");
        return false;
      }
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: "opaque"
      });
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        try {
          const fontString = this.fontFamily.includes(",") ? this.fontFamily : `'${this.fontFamily}'`;
          await document.fonts.load(`${this.fontSize}px ${fontString}`);
          console.log(`[WebGPU] Loaded font: ${fontString}`);
        } catch (e) {
          console.warn("[WebGPU] Font load failed, continuing anyway:", e);
        }
      }
      this.initFont();
      await this.initWebGPU(presentationFormat);
      this.setupCanvas();
      const maxCells = this.width * this.height;
      this.cellBuffer = this.device.createBuffer({
        size: maxCells * 60,
        // 15 floats per cell
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.cellData = new Float32Array(maxCells * 15);
      const uniforms = new Float32Array([
        this.canvas.width,
        this.canvas.height,
        this.charWidth,
        this.charHeight
      ]);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
      this.cacheCharRange(32, 127);
      this.initialized = true;
      console.log("[WebGPU] Initialized successfully");
      return true;
    } catch (error) {
      console.error("[WebGPU] Initialization failed:", error);
      return false;
    }
  }
  initFont() {
    const fontString = this.fontFamily.includes(",") ? this.fontFamily : `'${this.fontFamily}'`;
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = "top";
    const metrics = this.atlasCtx.measureText("M");
    this.charWidth = Math.ceil(metrics.width);
    this.charHeight = this.fontSize;
    console.log(`[WebGPU] Font initialized: ${this.atlasCtx.font}`);
    console.log(`[WebGPU] Char size: ${this.charWidth}x${this.charHeight}px`);
  }
  async initWebGPU(presentationFormat) {
    if (!this.device) return;
    const shaderCode = `
      struct Uniforms {
        resolution: vec2f,
        charSize: vec2f,
      }
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;
      @group(0) @binding(1) var fontAtlas: texture_2d<f32>;
      @group(0) @binding(2) var fontSampler: sampler;
      
      struct CellData {
        cellPos: vec2f,
        fgColor: vec4f,
        bgColor: vec4f,
        glyphUV: vec4f,
        charWidth: f32,
      }
      
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) texCoord: vec2f,
        @location(1) fgColor: vec4f,
        @location(2) bgColor: vec4f,
      }
      
      @vertex
      fn vertexMain(
        @builtin(vertex_index) vertexIndex: u32,
        @builtin(instance_index) instanceIndex: u32,
        @location(0) cellPos: vec2f,
        @location(1) fgColor: vec4f,
        @location(2) bgColor: vec4f,
        @location(3) glyphUV: vec4f,
        @location(4) charWidth: f32,
      ) -> VertexOutput {
        var output: VertexOutput;
        
        var quadPos = array<vec2f, 6>(
          vec2f(0.0, 0.0),
          vec2f(1.0, 0.0),
          vec2f(0.0, 1.0),
          vec2f(1.0, 0.0),
          vec2f(1.0, 1.0),
          vec2f(0.0, 1.0)
        );
        
        let position = quadPos[vertexIndex];
        let cellPixelPos = cellPos * uniforms.charSize;
        let quadSize = vec2f(charWidth, 1.0) * uniforms.charSize;
        let pixelPos = cellPixelPos + position * quadSize;
        
        var clipSpace = (pixelPos / uniforms.resolution) * 2.0 - 1.0;
        clipSpace.y = -clipSpace.y;
        
        output.position = vec4f(clipSpace, 0.0, 1.0);
        output.texCoord = glyphUV.xy + position * glyphUV.zw;
        output.fgColor = fgColor;
        output.bgColor = bgColor;
        
        return output;
      }
      
      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
        let alpha = textureSample(fontAtlas, fontSampler, input.texCoord).a;
        return mix(input.bgColor, input.fgColor, alpha);
      }
    `;
    const shaderModule = this.device.createShaderModule({
      code: shaderCode
    });
    this.uniformBuffer = this.device.createBuffer({
      size: 16,
      // 2 vec2f = 4 floats = 16 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.atlasTexture = this.device.createTexture({
      size: [this.atlasCanvas.width, this.atlasCanvas.height],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.atlasSampler = this.device.createSampler({
      magFilter: "linear",
      minFilter: "linear",
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge"
    });
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "uniform" }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: "float" }
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: "filtering" }
        }
      ]
    });
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.atlasTexture.createView() },
        { binding: 2, resource: this.atlasSampler }
      ]
    });
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: "vertexMain",
        buffers: [{
          arrayStride: 60,
          // 2+4+4+4+1 floats = 15 floats = 60 bytes
          stepMode: "instance",
          attributes: [
            { shaderLocation: 0, offset: 0, format: "float32x2" },
            // cellPos
            { shaderLocation: 1, offset: 8, format: "float32x4" },
            // fgColor
            { shaderLocation: 2, offset: 24, format: "float32x4" },
            // bgColor
            { shaderLocation: 3, offset: 40, format: "float32x4" },
            // glyphUV
            { shaderLocation: 4, offset: 56, format: "float32" }
            // charWidth
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fragmentMain",
        targets: [{
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha"
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha"
            }
          }
        }]
      },
      primitive: {
        topology: "triangle-list"
      }
    });
  }
  setupCanvas() {
    this.canvas.width = this.width * this.charWidth;
    this.canvas.height = this.height * this.charHeight;
  }
  cacheCharRange(start, end) {
    var _a;
    for (let i = start; i <= end; i++) {
      this.cacheGlyph(String.fromCharCode(i));
    }
    this.uploadAtlas();
    if (start === 32 && end === 127) {
      console.log('[WebGPU] ASCII glyphs cached. Sample "M" width:', (_a = this.glyphCache.get("M")) == null ? void 0 : _a.pixelWidth);
    }
  }
  cacheGlyph(char) {
    if (this.glyphCache.has(char)) {
      return this.glyphCache.get(char);
    }
    const fontString = this.fontFamily.includes(",") ? this.fontFamily : `'${this.fontFamily}'`;
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = "top";
    if (!this.fontLoggedOnce) {
      console.log(`[WebGPU] Caching glyphs with font: ${this.atlasCtx.font}`);
      this.fontLoggedOnce = true;
    }
    const metrics = this.atlasCtx.measureText(char);
    const width = Math.ceil(metrics.width) + 2;
    const height = this.charHeight + 2;
    if (this.atlasX + width > this.atlasCanvas.width) {
      this.atlasX = 0;
      this.atlasY += this.atlasRowHeight;
      this.atlasRowHeight = 0;
    }
    this.atlasCtx.clearRect(this.atlasX, this.atlasY, width, height);
    this.atlasCtx.fillStyle = "#ffffff";
    this.atlasCtx.fillText(char, this.atlasX + 1, this.atlasY + 1);
    const atlasWidth = this.atlasCanvas.width;
    const atlasHeight = this.atlasCanvas.height;
    const info = {
      u: this.atlasX / atlasWidth,
      v: this.atlasY / atlasHeight,
      w: width / atlasWidth,
      h: height / atlasHeight,
      pixelWidth: width
    };
    this.glyphCache.set(char, info);
    this.atlasX += width;
    this.atlasRowHeight = Math.max(this.atlasRowHeight, height);
    this.atlasNeedsUpload = true;
    return info;
  }
  uploadAtlas() {
    if (!this.device || !this.atlasTexture || !this.atlasNeedsUpload) return;
    const imageData = this.atlasCtx.getImageData(
      0,
      0,
      this.atlasCanvas.width,
      this.atlasCanvas.height
    );
    this.device.queue.writeTexture(
      { texture: this.atlasTexture },
      imageData.data,
      { bytesPerRow: this.atlasCanvas.width * 4 },
      { width: this.atlasCanvas.width, height: this.atlasCanvas.height }
    );
    this.atlasNeedsUpload = false;
  }
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.setupCanvas();
    if (this.device && this.uniformBuffer) {
      const uniforms = new Float32Array([
        this.canvas.width,
        this.canvas.height,
        this.charWidth,
        this.charHeight
      ]);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }
    const maxCells = width * height;
    if (this.device) {
      this.cellBuffer = this.device.createBuffer({
        size: maxCells * 60,
        // 15 floats per cell
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.cellData = new Float32Array(maxCells * 15);
    } else {
      this.cellData = new Float32Array(maxCells * 15);
    }
  }
  getWidth() {
    return this.width;
  }
  getHeight() {
    return this.height;
  }
  render(buffer) {
    if (!this.initialized || !this.device || !this.context || !this.pipeline) {
      return;
    }
    if (this.atlasNeedsUpload) {
      this.uploadAtlas();
    }
    let cellIndex = 0;
    for (let y = 0; y < Math.min(buffer.length, this.height); y++) {
      const row = buffer[y];
      for (let x = 0; x < Math.min(row.length, this.width); x++) {
        const cell = row[x];
        if (cell.char && !this.glyphCache.has(cell.char)) {
          this.cacheGlyph(cell.char);
          this.uploadAtlas();
        }
        const glyph = this.glyphCache.get(cell.char || " ") || this.cacheGlyph(" ");
        const offset = cellIndex * 15;
        this.cellData[offset + 0] = x;
        this.cellData[offset + 1] = y;
        this.cellData[offset + 2] = cell.fg.r / 255;
        this.cellData[offset + 3] = cell.fg.g / 255;
        this.cellData[offset + 4] = cell.fg.b / 255;
        this.cellData[offset + 5] = cell.fg.a !== void 0 ? cell.fg.a : 1;
        this.cellData[offset + 6] = cell.bg.r / 255;
        this.cellData[offset + 7] = cell.bg.g / 255;
        this.cellData[offset + 8] = cell.bg.b / 255;
        this.cellData[offset + 9] = cell.bg.a !== void 0 ? cell.bg.a : 1;
        this.cellData[offset + 10] = glyph.u;
        this.cellData[offset + 11] = glyph.v;
        this.cellData[offset + 12] = glyph.w;
        this.cellData[offset + 13] = glyph.h;
        this.cellData[offset + 14] = 1;
        cellIndex++;
      }
    }
    if (this.cellBuffer && this.cellData) {
      this.device.queue.writeBuffer(this.cellBuffer, 0, this.cellData.buffer);
    }
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    const renderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }]
    };
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup);
    if (this.cellBuffer) {
      passEncoder.setVertexBuffer(0, this.cellBuffer);
    }
    passEncoder.draw(6, cellIndex);
    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }
  clear(_color = { r: 0, g: 0, b: 0 }) {
  }
}
const universalThis = globalThis;
const {
  Array: Array$1,
  ArrayBuffer: ArrayBuffer$2,
  Date: Date$1,
  FinalizationRegistry,
  Float32Array: Float32Array$1,
  JSON: JSON$3,
  Map: Map$1,
  Math: Math$1,
  Number: Number$1,
  Object: Object$4,
  Promise: Promise$1,
  Proxy: Proxy2,
  Reflect: Reflect$4,
  RegExp: FERAL_REG_EXP,
  Set: Set$1,
  String: String$2,
  Symbol: Symbol$2,
  Uint8Array: Uint8Array$1,
  WeakMap: WeakMap$2,
  WeakSet: WeakSet2
} = globalThis;
const {
  // The feral Error constructor is safe for internal use, but must not be
  // revealed to post-lockdown code in any compartment including the start
  // compartment since in V8 at least it bears stack inspection capabilities.
  Error: FERAL_ERROR,
  RangeError: RangeError$1,
  ReferenceError: ReferenceError$1,
  SyntaxError: SyntaxError$1,
  TypeError: TypeError$3,
  AggregateError: AggregateError$1
} = globalThis;
const {
  assign,
  create,
  defineProperties: defineProperties$1,
  entries,
  freeze: freeze$4,
  getOwnPropertyDescriptor: getOwnPropertyDescriptor$1,
  getOwnPropertyDescriptors: getOwnPropertyDescriptors$1,
  getOwnPropertyNames,
  getPrototypeOf: getPrototypeOf$1,
  is,
  keys,
  prototype: objectPrototype,
  preventExtensions,
  setPrototypeOf,
  values,
  fromEntries,
  hasOwn
} = Object$4;
const {
  species: speciesSymbol,
  toStringTag: toStringTagSymbol$1,
  iterator: iteratorSymbol,
  matchAll: matchAllSymbol,
  unscopables: unscopablesSymbol,
  keyFor: symbolKeyFor,
  for: symbolFor
} = Symbol$2;
const { isInteger } = Number$1;
const { stringify: stringifyJson } = JSON$3;
const { defineProperty: originalDefineProperty } = Object$4;
const defineProperty$2 = (object, prop, descriptor) => {
  const result = originalDefineProperty(object, prop, descriptor);
  if (result !== object) {
    throw TypeError$3(
      `Please report that the original defineProperty silently failed to set ${stringifyJson(
        String$2(prop)
      )}. (SES_DEFINE_PROPERTY_FAILED_SILENTLY)`
    );
  }
  return result;
};
const {
  apply: apply$2,
  construct,
  get: reflectGet,
  getOwnPropertyDescriptor: reflectGetOwnPropertyDescriptor,
  has: reflectHas,
  isExtensible: reflectIsExtensible,
  ownKeys: ownKeys$2,
  preventExtensions: reflectPreventExtensions,
  set: reflectSet
} = Reflect$4;
const { isArray, prototype: arrayPrototype } = Array$1;
const { prototype: arrayBufferPrototype$2 } = ArrayBuffer$2;
const { prototype: mapPrototype } = Map$1;
const { prototype: regexpPrototype } = RegExp;
const { prototype: setPrototype } = Set$1;
const { prototype: stringPrototype } = String$2;
const { prototype: weakmapPrototype } = WeakMap$2;
const { prototype: weaksetPrototype } = WeakSet2;
const { prototype: functionPrototype } = Function;
const { prototype: promisePrototype } = Promise$1;
const { prototype: generatorPrototype } = getPrototypeOf$1(
  // eslint-disable-next-line no-empty-function, func-names
  function* () {
  }
);
const iteratorPrototype = getPrototypeOf$1(
  // eslint-disable-next-line @endo/no-polymorphic-call
  getPrototypeOf$1(arrayPrototype.values())
);
const typedArrayPrototype$1 = getPrototypeOf$1(Uint8Array$1.prototype);
const { bind } = functionPrototype;
const uncurryThis$1 = bind.bind(bind.call);
const arrayFilter = uncurryThis$1(arrayPrototype.filter);
const arrayForEach = uncurryThis$1(arrayPrototype.forEach);
const arrayIncludes$1 = uncurryThis$1(arrayPrototype.includes);
const arrayJoin = uncurryThis$1(arrayPrototype.join);
const arrayMap = (
  /** @type {any} */
  uncurryThis$1(arrayPrototype.map)
);
const arrayFlatMap = (
  /** @type {any} */
  uncurryThis$1(arrayPrototype.flatMap)
);
const arrayPop = uncurryThis$1(arrayPrototype.pop);
const arrayPush$1 = uncurryThis$1(arrayPrototype.push);
const arraySlice = uncurryThis$1(arrayPrototype.slice);
const arraySome = uncurryThis$1(arrayPrototype.some);
const arraySort = uncurryThis$1(arrayPrototype.sort);
const iterateArray = uncurryThis$1(arrayPrototype[iteratorSymbol]);
const arrayBufferSlice$1 = uncurryThis$1(arrayBufferPrototype$2.slice);
const arrayBufferGetByteLength = uncurryThis$1(
  // @ts-expect-error we know it is there on all conforming platforms
  getOwnPropertyDescriptor$1(arrayBufferPrototype$2, "byteLength").get
);
const typedArraySet = uncurryThis$1(typedArrayPrototype$1.set);
const mapSet = uncurryThis$1(mapPrototype.set);
const mapGet = uncurryThis$1(mapPrototype.get);
const mapHas = uncurryThis$1(mapPrototype.has);
const mapDelete = uncurryThis$1(mapPrototype.delete);
const mapEntries = uncurryThis$1(mapPrototype.entries);
const iterateMap = uncurryThis$1(mapPrototype[iteratorSymbol]);
const setAdd = uncurryThis$1(setPrototype.add);
uncurryThis$1(setPrototype.delete);
const setForEach = uncurryThis$1(setPrototype.forEach);
const setHas = uncurryThis$1(setPrototype.has);
const iterateSet = uncurryThis$1(setPrototype[iteratorSymbol]);
const regexpTest = uncurryThis$1(regexpPrototype.test);
const regexpExec = uncurryThis$1(regexpPrototype.exec);
const matchAllRegExp = uncurryThis$1(regexpPrototype[matchAllSymbol]);
const stringEndsWith = uncurryThis$1(stringPrototype.endsWith);
const stringIncludes = uncurryThis$1(stringPrototype.includes);
const stringIndexOf = uncurryThis$1(stringPrototype.indexOf);
uncurryThis$1(stringPrototype.match);
const generatorNext = uncurryThis$1(generatorPrototype.next);
const generatorThrow = uncurryThis$1(generatorPrototype.throw);
const stringReplace = (
  /** @type {any} */
  uncurryThis$1(stringPrototype.replace)
);
const stringSearch = uncurryThis$1(stringPrototype.search);
const stringSlice = uncurryThis$1(stringPrototype.slice);
const stringSplit$1 = (
  /** @type {(thisArg: string, splitter: string | RegExp | { [Symbol.split](string: string, limit?: number): string[]; }, limit?: number) => string[]} */
  uncurryThis$1(stringPrototype.split)
);
const stringStartsWith = uncurryThis$1(stringPrototype.startsWith);
const iterateString = uncurryThis$1(stringPrototype[iteratorSymbol]);
const weakmapDelete = uncurryThis$1(weakmapPrototype.delete);
const weakmapGet = uncurryThis$1(weakmapPrototype.get);
const weakmapHas = uncurryThis$1(weakmapPrototype.has);
const weakmapSet = uncurryThis$1(weakmapPrototype.set);
const weaksetAdd = uncurryThis$1(weaksetPrototype.add);
const weaksetHas = uncurryThis$1(weaksetPrototype.has);
const functionToString = uncurryThis$1(functionPrototype.toString);
const functionBind = uncurryThis$1(bind);
uncurryThis$1(promisePrototype.catch);
const promiseThen = (
  /** @type {any} */
  uncurryThis$1(promisePrototype.then)
);
const finalizationRegistryRegister = FinalizationRegistry && uncurryThis$1(FinalizationRegistry.prototype.register);
FinalizationRegistry && uncurryThis$1(FinalizationRegistry.prototype.unregister);
const isPrimitive = (val) => !val || typeof val !== "object" && typeof val !== "function";
const isError = (value) => value instanceof FERAL_ERROR;
const identity = (x) => x;
const FERAL_EVAL = eval;
const FERAL_FUNCTION = Function;
const noEvalEvaluate = () => {
  throw TypeError$3('Cannot eval with evalTaming set to "no-eval" (SES_NO_EVAL)');
};
const er1StackDesc = getOwnPropertyDescriptor$1(Error("er1"), "stack");
const er2StackDesc = getOwnPropertyDescriptor$1(TypeError$3("er2"), "stack");
let feralStackGetter;
let feralStackSetter;
if (er1StackDesc && er2StackDesc && er1StackDesc.get) {
  if (
    // In the v8 case as we understand it, all errors have an own stack
    // accessor property, but within the same realm, all these accessor
    // properties have the same getter and have the same setter.
    // This is therefore the case that we repair.
    typeof er1StackDesc.get === "function" && er1StackDesc.get === er2StackDesc.get && typeof er1StackDesc.set === "function" && er1StackDesc.set === er2StackDesc.set
  ) {
    feralStackGetter = freeze$4(er1StackDesc.get);
    feralStackSetter = freeze$4(er1StackDesc.set);
  } else {
    throw TypeError$3(
      "Unexpected Error own stack accessor functions (SES_UNEXPECTED_ERROR_OWN_STACK_ACCESSOR)"
    );
  }
}
const FERAL_STACK_GETTER = feralStackGetter;
const FERAL_STACK_SETTER = feralStackSetter;
const getAsyncGeneratorFunctionInstance = () => {
  try {
    return new FERAL_FUNCTION(
      "return (async function* AsyncGeneratorFunctionInstance() {})"
    )();
  } catch (error) {
    if (error.name === "SyntaxError") {
      return void 0;
    } else if (error.name === "EvalError") {
      return async function* AsyncGeneratorFunctionInstance2() {
      };
    } else {
      throw error;
    }
  }
};
const AsyncGeneratorFunctionInstance = getAsyncGeneratorFunctionInstance();
function getThis() {
  return this;
}
if (getThis()) {
  throw TypeError$3(`SES failed to initialize, sloppy mode (SES_NO_SLOPPY)`);
}
const localThis = globalThis;
const { Object: Object$3, Reflect: Reflect$3, Array, String: String$1, JSON: JSON$2, Error: Error$2 } = localThis;
const { freeze: freeze$3 } = Object$3;
const { apply: apply$1 } = Reflect$3;
const uncurryThis = (fn2) => (receiver, ...args) => apply$1(fn2, receiver, args);
const arrayPush = uncurryThis(Array.prototype.push);
const arrayIncludes = uncurryThis(Array.prototype.includes);
const stringSplit = uncurryThis(String$1.prototype.split);
const q$6 = JSON$2.stringify;
const Fail$7 = (literals, ...args) => {
  let msg = literals[0];
  for (let i = 0; i < args.length; i += 1) {
    msg = `${msg}${args[i]}${literals[i + 1]}`;
  }
  throw Error$2(msg);
};
const makeEnvironmentCaptor = (aGlobal, dropNames = false) => {
  const capturedEnvironmentOptionNames = [];
  const getEnvironmentOption2 = (optionName, defaultSetting, optOtherValues = void 0) => {
    typeof optionName === "string" || Fail$7`Environment option name ${q$6(optionName)} must be a string.`;
    typeof defaultSetting === "string" || Fail$7`Environment option default setting ${q$6(
      defaultSetting
    )} must be a string.`;
    let setting = defaultSetting;
    const globalProcess = aGlobal.process || void 0;
    const globalEnv = typeof globalProcess === "object" && globalProcess.env || void 0;
    if (typeof globalEnv === "object") {
      if (optionName in globalEnv) {
        if (!dropNames) {
          arrayPush(capturedEnvironmentOptionNames, optionName);
        }
        const optionValue = globalEnv[optionName];
        typeof optionValue === "string" || Fail$7`Environment option named ${q$6(
          optionName
        )}, if present, must have a corresponding string value, got ${q$6(
          optionValue
        )}`;
        setting = optionValue;
      }
    }
    optOtherValues === void 0 || setting === defaultSetting || arrayIncludes(optOtherValues, setting) || Fail$7`Unrecognized ${q$6(optionName)} value ${q$6(
      setting
    )}. Expected one of ${q$6([defaultSetting, ...optOtherValues])}`;
    return setting;
  };
  freeze$3(getEnvironmentOption2);
  const getEnvironmentOptionsList2 = (optionName) => {
    const option = getEnvironmentOption2(optionName, "");
    return freeze$3(option === "" ? [] : stringSplit(option, ","));
  };
  freeze$3(getEnvironmentOptionsList2);
  const environmentOptionsListHas2 = (optionName, element) => arrayIncludes(getEnvironmentOptionsList2(optionName), element);
  const getCapturedEnvironmentOptionNames = () => {
    return freeze$3([...capturedEnvironmentOptionNames]);
  };
  freeze$3(getCapturedEnvironmentOptionNames);
  return freeze$3({
    getEnvironmentOption: getEnvironmentOption2,
    getEnvironmentOptionsList: getEnvironmentOptionsList2,
    environmentOptionsListHas: environmentOptionsListHas2,
    getCapturedEnvironmentOptionNames
  });
};
freeze$3(makeEnvironmentCaptor);
const {
  getEnvironmentOption,
  getEnvironmentOptionsList,
  environmentOptionsListHas
} = makeEnvironmentCaptor(localThis, true);
const {
  ArrayBuffer: ArrayBuffer$1,
  Object: Object$2,
  Reflect: Reflect$2,
  Symbol: Symbol$1,
  TypeError: TypeError$2,
  Uint8Array: Uint8Array2,
  WeakMap: WeakMap$1,
  // Capture structuredClone before it can be scuttled.
  structuredClone: optStructuredClone
  // eslint-disable-next-line no-restricted-globals
} = globalThis;
const { freeze: freeze$2, defineProperty: defineProperty$1, getPrototypeOf, getOwnPropertyDescriptor } = Object$2;
const { apply, ownKeys: ownKeys$1 } = Reflect$2;
const { toStringTag } = Symbol$1;
const { prototype: arrayBufferPrototype$1 } = ArrayBuffer$1;
const { slice, transfer: optTransfer } = arrayBufferPrototype$1;
const { get: arrayBufferByteLength } = getOwnPropertyDescriptor(
  arrayBufferPrototype$1,
  "byteLength"
);
const typedArrayPrototype = getPrototypeOf(Uint8Array2.prototype);
const { set: uint8ArraySet } = typedArrayPrototype;
const { get: uint8ArrayBuffer } = getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer"
);
const arrayBufferSlice = (realBuffer, start = void 0, end = void 0) => apply(slice, realBuffer, [start, end]);
let optArrayBufferTransfer;
if (optTransfer) {
  optArrayBufferTransfer = (arrayBuffer) => apply(optTransfer, arrayBuffer, []);
} else if (optStructuredClone) {
  optArrayBufferTransfer = (arrayBuffer) => {
    arrayBufferSlice(arrayBuffer, 0, 0);
    return optStructuredClone(arrayBuffer, {
      transfer: [arrayBuffer]
    });
  };
} else {
  optArrayBufferTransfer = void 0;
}
const buffers = new WeakMap$1();
for (const methodName of ["get", "has", "set"]) {
  defineProperty$1(buffers, methodName, { value: buffers[methodName] });
}
const getBuffer = (immuAB) => {
  const result = buffers.get(immuAB);
  if (result) {
    return result;
  }
  throw TypeError$2("Not an emulated Immutable ArrayBuffer");
};
const ImmutableArrayBufferInternalPrototype = {
  __proto__: arrayBufferPrototype$1,
  get byteLength() {
    return apply(arrayBufferByteLength, getBuffer(this), []);
  },
  get detached() {
    getBuffer(this);
    return false;
  },
  get maxByteLength() {
    return apply(arrayBufferByteLength, getBuffer(this), []);
  },
  get resizable() {
    getBuffer(this);
    return false;
  },
  get immutable() {
    getBuffer(this);
    return true;
  },
  slice(start = void 0, end = void 0) {
    return arrayBufferSlice(getBuffer(this), start, end);
  },
  sliceToImmutable(start = void 0, end = void 0) {
    return sliceBufferToImmutable(getBuffer(this), start, end);
  },
  resize(_newByteLength = void 0) {
    getBuffer(this);
    throw TypeError$2("Cannot resize an immutable ArrayBuffer");
  },
  transfer(_newLength = void 0) {
    getBuffer(this);
    throw TypeError$2("Cannot detach an immutable ArrayBuffer");
  },
  transferToFixedLength(_newLength = void 0) {
    getBuffer(this);
    throw TypeError$2("Cannot detach an immutable ArrayBuffer");
  },
  transferToImmutable(_newLength = void 0) {
    getBuffer(this);
    throw TypeError$2("Cannot detach an immutable ArrayBuffer");
  },
  /**
   * See https://github.com/endojs/endo/tree/master/packages/immutable-arraybuffer#purposeful-violation
   */
  [toStringTag]: "ImmutableArrayBuffer"
};
for (const key of ownKeys$1(ImmutableArrayBufferInternalPrototype)) {
  defineProperty$1(ImmutableArrayBufferInternalPrototype, key, {
    enumerable: false
  });
}
const makeImmutableArrayBufferInternal = (realBuffer) => {
  const result = (
    /** @type {ArrayBuffer} */
    /** @type {unknown} */
    {
      __proto__: ImmutableArrayBufferInternalPrototype
    }
  );
  buffers.set(result, realBuffer);
  return result;
};
freeze$2(makeImmutableArrayBufferInternal);
const isBufferImmutable = (buffer) => buffers.has(buffer);
const sliceBufferToImmutable = (buffer, start = void 0, end = void 0) => {
  let realBuffer = buffers.get(buffer);
  if (realBuffer === void 0) {
    realBuffer = buffer;
  }
  return makeImmutableArrayBufferInternal(
    arrayBufferSlice(realBuffer, start, end)
  );
};
let transferBufferToImmutable;
if (optArrayBufferTransfer) {
  transferBufferToImmutable = (buffer, newLength = void 0) => {
    if (newLength === void 0) {
      buffer = optArrayBufferTransfer(buffer);
    } else if (optTransfer) {
      buffer = apply(optTransfer, buffer, [newLength]);
    } else {
      buffer = optArrayBufferTransfer(buffer);
      const oldLength = buffer.byteLength;
      if (newLength <= oldLength) {
        buffer = arrayBufferSlice(buffer, 0, newLength);
      } else {
        const oldTA = new Uint8Array2(buffer);
        const newTA = new Uint8Array2(newLength);
        apply(uint8ArraySet, newTA, [oldTA]);
        buffer = apply(uint8ArrayBuffer, newTA, []);
      }
    }
    const result = makeImmutableArrayBufferInternal(buffer);
    return (
      /** @type {ArrayBuffer} */
      /** @type {unknown} */
      result
    );
  };
} else {
  transferBufferToImmutable = void 0;
}
const optTransferBufferToImmutable$1 = transferBufferToImmutable;
const {
  ArrayBuffer,
  JSON: JSON$1,
  Object: Object$1,
  Reflect: Reflect$1
  // eslint-disable-next-line no-restricted-globals
} = globalThis;
const optTransferBufferToImmutable = optTransferBufferToImmutable$1;
const { getOwnPropertyDescriptors, defineProperties, defineProperty } = Object$1;
const { ownKeys } = Reflect$1;
const { prototype: arrayBufferPrototype } = ArrayBuffer;
const { stringify: stringify$1 } = JSON$1;
const arrayBufferMethods = {
  /**
   * Creates an immutable slice of the given buffer.
   *
   * @this {ArrayBuffer} buffer The original buffer.
   * @param {number} [start] The start index.
   * @param {number} [end] The end index.
   * @returns {ArrayBuffer} The sliced immutable ArrayBuffer.
   */
  sliceToImmutable(start = void 0, end = void 0) {
    return sliceBufferToImmutable(this, start, end);
  },
  /**
   * @this {ArrayBuffer}
   */
  get immutable() {
    return isBufferImmutable(this);
  },
  ...optTransferBufferToImmutable ? {
    /**
     * Transfer the contents to a new Immutable ArrayBuffer
     *
     * @this {ArrayBuffer} buffer The original buffer.
     * @param {number} [newLength] The start index.
     * @returns {ArrayBuffer} The sliced immutable ArrayBuffer.
     */
    transferToImmutable(newLength = void 0) {
      return optTransferBufferToImmutable(this, newLength);
    }
  } : {}
};
for (const key of ownKeys(arrayBufferMethods)) {
  defineProperty(arrayBufferMethods, key, {
    enumerable: false
  });
}
const overwrites = ownKeys(arrayBufferMethods).filter(
  (key) => key in arrayBufferPrototype
);
if (overwrites.length > 0) {
  console.warn(
    `About to overwrite ArrayBuffer.prototype properties ${stringify$1(overwrites)}`
  );
}
defineProperties(
  arrayBufferPrototype,
  getOwnPropertyDescriptors(arrayBufferMethods)
);
const an = (str) => {
  str = `${str}`;
  if (str.length >= 1 && stringIncludes("aeiouAEIOU", str[0])) {
    return `an ${str}`;
  }
  return `a ${str}`;
};
freeze$4(an);
const bestEffortStringify = (payload, spaces = void 0) => {
  const seenSet = new Set$1();
  const replacer = (_, val) => {
    switch (typeof val) {
      case "object": {
        if (val === null) {
          return null;
        }
        if (setHas(seenSet, val)) {
          return "[Seen]";
        }
        setAdd(seenSet, val);
        if (isError(val)) {
          return `[${val.name}: ${val.message}]`;
        }
        if (toStringTagSymbol$1 in val) {
          return `[${val[toStringTagSymbol$1]}]`;
        }
        if (isArray(val)) {
          return val;
        }
        const names = keys(val);
        if (names.length < 2) {
          return val;
        }
        let sorted = true;
        for (let i = 1; i < names.length; i += 1) {
          if (names[i - 1] >= names[i]) {
            sorted = false;
            break;
          }
        }
        if (sorted) {
          return val;
        }
        arraySort(names);
        const entries2 = arrayMap(names, (name) => [name, val[name]]);
        return fromEntries(entries2);
      }
      case "function": {
        return `[Function ${val.name || "<anon>"}]`;
      }
      case "string": {
        if (stringStartsWith(val, "[")) {
          return `[${val}]`;
        }
        return val;
      }
      case "undefined":
      case "symbol": {
        return `[${String$2(val)}]`;
      }
      case "bigint": {
        return `[${val}n]`;
      }
      case "number": {
        if (is(val, NaN)) {
          return "[NaN]";
        } else if (val === Infinity) {
          return "[Infinity]";
        } else if (val === -Infinity) {
          return "[-Infinity]";
        }
        return val;
      }
      default: {
        return val;
      }
    }
  };
  try {
    return stringifyJson(payload, replacer, spaces);
  } catch (_err) {
    return "[Something that failed to stringify]";
  }
};
freeze$4(bestEffortStringify);
const { Error: Error$1, TypeError: TypeError$1, WeakMap } = globalThis;
const { parse, stringify } = JSON;
const { isSafeInteger: isSafeInteger$1 } = Number;
const { freeze: freeze$1 } = Object;
const { toStringTag: toStringTagSymbol } = Symbol;
const UNKNOWN_KEY = Symbol("UNKNOWN_KEY");
const deepCopyJsonable = (value, reviver) => {
  const encoded = stringify(value);
  const decoded = parse(encoded, reviver);
  return decoded;
};
const freezingReviver = (_name, value) => freeze$1(value);
const deepCopyAndFreezeJsonable = (value) => deepCopyJsonable(value, freezingReviver);
const appendNewCell = (prev, id, data) => {
  const next = prev == null ? void 0 : prev.next;
  const cell = { id, next, prev, data };
  prev.next = cell;
  next.prev = cell;
  return cell;
};
const moveCellAfter = (cell, prev, next = prev.next) => {
  if (cell === prev || cell === next) return;
  const { prev: oldPrev, next: oldNext } = cell;
  oldPrev.next = oldNext;
  oldNext.prev = oldPrev;
  cell.prev = prev;
  cell.next = next;
  prev.next = cell;
  next.prev = cell;
};
const resetCell = (cell, oldKey, makeMap) => {
  if (oldKey !== UNKNOWN_KEY) {
    cell.data.delete(oldKey);
    return;
  }
  if (cell.data.clear) {
    cell.data.clear();
    return;
  }
  if (!makeMap) {
    throw Error$1("internal: makeMap is required with UNKNOWN_KEY");
  }
  cell.data = makeMap();
};
const zeroMetrics = freeze$1({
  totalQueryCount: 0,
  totalHitCount: 0
  // TODO?
  // * method-specific counts
  // * liveTouchStats/evictedTouchStats { count, sum, mean, min, max }
  //   * p50/p90/p95/p99 via Ben-Haim/Tom-Tov streaming histograms
});
const makeCacheMapKit = (capacity, options = {}) => {
  if (!isSafeInteger$1(capacity) || capacity < 0) {
    throw TypeError$1(
      "capacity must be a non-negative safe integer number <= 2**53 - 1"
    );
  }
  const makeMap = ((MaybeCtor) => {
    try {
      MaybeCtor();
      return (
        /** @type {any} */
        MaybeCtor
      );
    } catch (err) {
      const constructNewMap = () => new MaybeCtor();
      return constructNewMap;
    }
  })(options.makeMap ?? WeakMap);
  const tag = (
    /** @type {any} */
    makeMap().clear === void 0 ? "WeakCacheMap" : "CacheMap"
  );
  const keyToCell = makeMap();
  const head = (
    /** @type {CacheMapCell<K, V>} */
    {
      id: 0,
      // next and prev are established below as self-referential.
      next: void 0,
      prev: void 0,
      data: {
        has: () => {
          throw Error$1("internal: sentinel head cell has no data");
        }
      }
    }
  );
  head.next = head;
  head.prev = head;
  let cellCount = 0;
  const metrics = deepCopyJsonable(zeroMetrics);
  const getMetrics = () => deepCopyAndFreezeJsonable(metrics);
  const touchKey = (key) => {
    metrics.totalQueryCount += 1;
    const cell = keyToCell.get(key);
    if (!(cell == null ? void 0 : cell.data.has(key))) return void 0;
    metrics.totalHitCount += 1;
    moveCellAfter(cell, head);
    return cell;
  };
  const has = (key) => {
    const cell = touchKey(key);
    return cell !== void 0;
  };
  freeze$1(has);
  const get = (key) => {
    const cell = touchKey(key);
    return cell == null ? void 0 : cell.data.get(key);
  };
  freeze$1(get);
  const set = (key, value) => {
    let cell = touchKey(key);
    if (cell) {
      cell.data.set(key, value);
      return implementation;
    }
    if (cellCount < capacity) {
      cell = appendNewCell(head, cellCount + 1, makeMap());
      cellCount += 1;
      cell.data.set(key, value);
    } else if (capacity > 0) {
      cell = head.prev;
      resetCell(
        /** @type {any} */
        cell,
        UNKNOWN_KEY,
        makeMap
      );
      cell.data.set(key, value);
      moveCellAfter(cell, head);
    }
    if (cell) keyToCell.set(key, cell);
    return implementation;
  };
  freeze$1(set);
  const { delete: deleteEntry } = {
    /** @type {WeakMapAPI<K, V>['delete']} */
    delete: (key) => {
      const cell = keyToCell.get(key);
      if (!(cell == null ? void 0 : cell.data.has(key))) {
        keyToCell.delete(key);
        return false;
      }
      moveCellAfter(cell, head.prev);
      resetCell(cell, key);
      keyToCell.delete(key);
      return true;
    }
  };
  freeze$1(deleteEntry);
  const implementation = (
    /** @type {WeakMapAPI<K, V>} */
    {
      has,
      get,
      set,
      delete: deleteEntry,
      // eslint-disable-next-line jsdoc/check-types
      [
        /** @type {typeof Symbol.toStringTag} */
        toStringTagSymbol
      ]: tag
    }
  );
  freeze$1(implementation);
  const kit = { cache: implementation, getMetrics };
  return freeze$1(kit);
};
freeze$1(makeCacheMapKit);
const { freeze } = Object;
const { isSafeInteger } = Number;
const defaultLoggedErrorsBudget = 1e3;
const defaultArgsPerErrorBudget = 100;
const makeNoteLogArgsArrayKit = (errorsBudget = defaultLoggedErrorsBudget, argsPerErrorBudget = defaultArgsPerErrorBudget) => {
  if (!isSafeInteger(argsPerErrorBudget) || argsPerErrorBudget < 1) {
    throw TypeError(
      "argsPerErrorBudget must be a safe positive integer number"
    );
  }
  const { cache: noteLogArgsArrayMap } = makeCacheMapKit(errorsBudget);
  const addLogArgs2 = (error, logArgs) => {
    const logArgsArray = noteLogArgsArrayMap.get(error);
    if (logArgsArray !== void 0) {
      if (logArgsArray.length >= argsPerErrorBudget) {
        logArgsArray.shift();
      }
      logArgsArray.push(logArgs);
    } else {
      noteLogArgsArrayMap.set(error, [logArgs]);
    }
  };
  freeze(addLogArgs2);
  const takeLogArgsArray2 = (error) => {
    const result = noteLogArgsArrayMap.get(error);
    noteLogArgsArrayMap.delete(error);
    return result;
  };
  freeze(takeLogArgsArray2);
  return freeze({
    addLogArgs: addLogArgs2,
    takeLogArgsArray: takeLogArgsArray2
  });
};
freeze(makeNoteLogArgsArrayKit);
const declassifiers = new WeakMap$2();
const quote = (payload, spaces = void 0) => {
  const result = freeze$4({
    toString: freeze$4(() => bestEffortStringify(payload, spaces))
  });
  weakmapSet(declassifiers, result, payload);
  return result;
};
freeze$4(quote);
const canBeBare = freeze$4(/^[\w:-]( ?[\w:-])*$/);
const bare = (payload, spaces = void 0) => {
  if (typeof payload !== "string" || !regexpTest(canBeBare, payload)) {
    return quote(payload, spaces);
  }
  const result = freeze$4({
    toString: freeze$4(() => payload)
  });
  weakmapSet(declassifiers, result, payload);
  return result;
};
freeze$4(bare);
const hiddenDetailsMap = new WeakMap$2();
const getMessageString = ({ template, args }) => {
  const parts = [template[0]];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    let argStr;
    if (weakmapHas(declassifiers, arg)) {
      argStr = `${arg}`;
    } else if (isError(arg)) {
      argStr = `(${an(arg.name)})`;
    } else {
      argStr = `(${an(typeof arg)})`;
    }
    arrayPush$1(parts, argStr, template[i + 1]);
  }
  return arrayJoin(parts, "");
};
const DetailsTokenProto = freeze$4({
  toString() {
    const hiddenDetails = weakmapGet(hiddenDetailsMap, this);
    if (hiddenDetails === void 0) {
      return "[Not a DetailsToken]";
    }
    return getMessageString(hiddenDetails);
  }
});
freeze$4(DetailsTokenProto.toString);
const redactedDetails = (template, ...args) => {
  const detailsToken = freeze$4({ __proto__: DetailsTokenProto });
  weakmapSet(hiddenDetailsMap, detailsToken, { template, args });
  return (
    /** @type {DetailsToken} */
    /** @type {unknown} */
    detailsToken
  );
};
freeze$4(redactedDetails);
const unredactedDetails = (template, ...args) => {
  args = arrayMap(
    args,
    (arg) => weakmapHas(declassifiers, arg) ? arg : quote(arg)
  );
  return redactedDetails(template, ...args);
};
freeze$4(unredactedDetails);
const getLogArgs = ({ template, args }) => {
  const logArgs = [template[0]];
  for (let i = 0; i < args.length; i += 1) {
    let arg = args[i];
    if (weakmapHas(declassifiers, arg)) {
      arg = weakmapGet(declassifiers, arg);
    }
    const priorWithoutSpace = stringReplace(arrayPop(logArgs) || "", / $/, "");
    if (priorWithoutSpace !== "") {
      arrayPush$1(logArgs, priorWithoutSpace);
    }
    const nextWithoutSpace = stringReplace(template[i + 1], /^ /, "");
    arrayPush$1(logArgs, arg, nextWithoutSpace);
  }
  if (logArgs[logArgs.length - 1] === "") {
    arrayPop(logArgs);
  }
  return logArgs;
};
const hiddenMessageLogArgs = new WeakMap$2();
let errorTagNum = 0;
const errorTags = new WeakMap$2();
const tagError = (err, optErrorName = err.name) => {
  let errorTag = weakmapGet(errorTags, err);
  if (errorTag !== void 0) {
    return errorTag;
  }
  errorTagNum += 1;
  errorTag = `${optErrorName}#${errorTagNum}`;
  weakmapSet(errorTags, err, errorTag);
  return errorTag;
};
const sanitizeError = (error) => {
  const descs = getOwnPropertyDescriptors$1(error);
  const {
    name: _nameDesc,
    message: _messageDesc,
    errors: _errorsDesc = void 0,
    cause: _causeDesc = void 0,
    stack: _stackDesc = void 0,
    ...restDescs
  } = descs;
  const restNames = ownKeys$2(restDescs);
  if (restNames.length >= 1) {
    for (const name of restNames) {
      delete error[name];
    }
    const droppedNote = create(objectPrototype, restDescs);
    note(
      error,
      redactedDetails`originally with properties ${quote(droppedNote)}`
    );
  }
  for (const name of ownKeys$2(error)) {
    const desc = descs[name];
    if (desc && hasOwn(desc, "get")) {
      defineProperty$2(error, name, {
        value: error[name]
        // invoke the getter to convert to data property
      });
    }
  }
  freeze$4(error);
};
const makeError = (optDetails = redactedDetails`Assert failed`, errConstructor = universalThis.Error, {
  errorName = void 0,
  cause = void 0,
  errors = void 0,
  sanitize = true
} = {}) => {
  if (typeof optDetails === "string") {
    optDetails = redactedDetails([optDetails]);
  }
  const hiddenDetails = weakmapGet(hiddenDetailsMap, optDetails);
  if (hiddenDetails === void 0) {
    throw TypeError$3(`unrecognized details ${quote(optDetails)}`);
  }
  const messageString = getMessageString(hiddenDetails);
  const opts = cause && { cause };
  let error;
  if (typeof AggregateError$1 !== "undefined" && errConstructor === AggregateError$1) {
    error = AggregateError$1(errors || [], messageString, opts);
  } else {
    error = /** @type {ErrorConstructor} */
    errConstructor(
      messageString,
      opts
    );
    if (errors !== void 0) {
      defineProperty$2(error, "errors", {
        value: errors,
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }
  weakmapSet(hiddenMessageLogArgs, error, getLogArgs(hiddenDetails));
  if (errorName !== void 0) {
    tagError(error, errorName);
  }
  if (sanitize) {
    sanitizeError(error);
  }
  return error;
};
freeze$4(makeError);
const { addLogArgs, takeLogArgsArray } = makeNoteLogArgsArrayKit();
const hiddenNoteCallbackArrays = new WeakMap$2();
const note = (error, detailsNote) => {
  if (typeof detailsNote === "string") {
    detailsNote = redactedDetails([detailsNote]);
  }
  const hiddenDetails = weakmapGet(hiddenDetailsMap, detailsNote);
  if (hiddenDetails === void 0) {
    throw TypeError$3(`unrecognized details ${quote(detailsNote)}`);
  }
  const logArgs = getLogArgs(hiddenDetails);
  const callbacks = weakmapGet(hiddenNoteCallbackArrays, error);
  if (callbacks !== void 0) {
    for (const callback of callbacks) {
      callback(error, logArgs);
    }
  } else {
    addLogArgs(error, logArgs);
  }
};
freeze$4(note);
const defaultGetStackString = (error) => {
  if (!("stack" in error)) {
    return "";
  }
  const stackString = `${error.stack}`;
  const pos = stringIndexOf(stackString, "\n");
  if (stringStartsWith(stackString, " ") || pos === -1) {
    return stackString;
  }
  return stringSlice(stackString, pos + 1);
};
const loggedErrorHandler = {
  getStackString: universalThis.getStackString || defaultGetStackString,
  tagError: (error) => tagError(error),
  resetErrorTagNum: () => {
    errorTagNum = 0;
  },
  getMessageLogArgs: (error) => weakmapGet(hiddenMessageLogArgs, error),
  takeMessageLogArgs: (error) => {
    const result = weakmapGet(hiddenMessageLogArgs, error);
    weakmapDelete(hiddenMessageLogArgs, error);
    return result;
  },
  takeNoteLogArgsArray: (error, callback) => {
    const result = takeLogArgsArray(error);
    if (callback !== void 0) {
      const callbacks = weakmapGet(hiddenNoteCallbackArrays, error);
      if (callbacks) {
        arrayPush$1(callbacks, callback);
      } else {
        weakmapSet(hiddenNoteCallbackArrays, error, [callback]);
      }
    }
    return result || [];
  }
};
freeze$4(loggedErrorHandler);
const makeAssert = (optRaise = void 0, unredacted = false) => {
  const details = unredacted ? unredactedDetails : redactedDetails;
  const assertFailedDetails = details`Check failed`;
  const fail = (optDetails = assertFailedDetails, errConstructor = void 0, options = void 0) => {
    const reason = makeError(optDetails, errConstructor, options);
    if (optRaise !== void 0) {
      optRaise(reason);
    }
    throw reason;
  };
  freeze$4(fail);
  const Fail2 = (template, ...args) => fail(details(template, ...args));
  function baseAssert(flag, optDetails = void 0, errConstructor = void 0, options = void 0) {
    flag || fail(optDetails, errConstructor, options);
  }
  const equal = (actual, expected, optDetails = void 0, errConstructor = void 0, options = void 0) => {
    is(actual, expected) || fail(
      optDetails || details`Expected ${actual} is same as ${expected}`,
      errConstructor || RangeError$1,
      options
    );
  };
  freeze$4(equal);
  const assertTypeof = (specimen, typename, optDetails) => {
    if (typeof specimen === typename) {
      return;
    }
    typeof typename === "string" || Fail2`${quote(typename)} must be a string`;
    if (optDetails === void 0) {
      const typeWithDeterminer = an(typename);
      optDetails = details`${specimen} must be ${bare(typeWithDeterminer)}`;
    }
    fail(optDetails, TypeError$3);
  };
  freeze$4(assertTypeof);
  const assertString = (specimen, optDetails = void 0) => assertTypeof(specimen, "string", optDetails);
  const assert2 = assign(baseAssert, {
    error: makeError,
    fail,
    equal,
    typeof: assertTypeof,
    string: assertString,
    note,
    details,
    Fail: Fail2,
    quote,
    bare,
    makeAssert
  });
  return freeze$4(assert2);
};
freeze$4(makeAssert);
const assert = makeAssert();
const assertEqual = assert.equal;
const typedArrayToStringTag = getOwnPropertyDescriptor$1(
  typedArrayPrototype$1,
  toStringTagSymbol$1
);
assert(typedArrayToStringTag);
const getTypedArrayToStringTag = typedArrayToStringTag.get;
assert(getTypedArrayToStringTag);
const isTypedArray = (object) => {
  const tag = apply$2(getTypedArrayToStringTag, object, []);
  return tag !== void 0;
};
const isCanonicalIntegerIndexString = (propertyKey) => {
  const n = +String$2(propertyKey);
  return isInteger(n) && String$2(n) === propertyKey;
};
const freezeTypedArray = (array) => {
  preventExtensions(array);
  arrayForEach(ownKeys$2(array), (name) => {
    const desc = getOwnPropertyDescriptor$1(array, name);
    assert(desc);
    if (!isCanonicalIntegerIndexString(name)) {
      defineProperty$2(array, name, {
        ...desc,
        writable: false,
        configurable: false
      });
    }
  });
};
const makeHardener = () => {
  if (typeof universalThis.harden === "function") {
    const safeHarden2 = universalThis.harden;
    return safeHarden2;
  }
  const hardened = new WeakSet2();
  const { harden: harden2 } = {
    /**
     * @template T
     * @param {T} root
     * @returns {T}
     */
    harden(root) {
      const toFreeze = new Set$1();
      function enqueue(val) {
        if (isPrimitive(val)) {
          return;
        }
        const type = typeof val;
        if (type !== "object" && type !== "function") {
          throw TypeError$3(`Unexpected typeof: ${type}`);
        }
        if (weaksetHas(hardened, val) || setHas(toFreeze, val)) {
          return;
        }
        setAdd(toFreeze, val);
      }
      const baseFreezeAndTraverse = (obj) => {
        if (isTypedArray(obj)) {
          freezeTypedArray(obj);
        } else {
          freeze$4(obj);
        }
        const descs = getOwnPropertyDescriptors$1(obj);
        const proto = getPrototypeOf$1(obj);
        enqueue(proto);
        arrayForEach(ownKeys$2(descs), (name) => {
          const desc = descs[
            /** @type {string} */
            name
          ];
          if (hasOwn(desc, "value")) {
            enqueue(desc.value);
          } else {
            enqueue(desc.get);
            enqueue(desc.set);
          }
        });
      };
      const freezeAndTraverse = FERAL_STACK_GETTER === void 0 && FERAL_STACK_SETTER === void 0 ? (
        // On platforms without v8's error own stack accessor problem,
        // don't pay for any extra overhead.
        baseFreezeAndTraverse
      ) : (obj) => {
        if (isError(obj)) {
          const stackDesc2 = getOwnPropertyDescriptor$1(obj, "stack");
          if (stackDesc2 && stackDesc2.get === FERAL_STACK_GETTER && stackDesc2.configurable) {
            defineProperty$2(obj, "stack", {
              // NOTE: Calls getter during harden, which seems dangerous.
              // But we're only calling the problematic getter whose
              // hazards we think we understand.
              // @ts-expect-error TS should know FERAL_STACK_GETTER
              // cannot be `undefined` here.
              // See https://github.com/endojs/endo/pull/2232#discussion_r1575179471
              value: apply$2(FERAL_STACK_GETTER, obj, [])
            });
          }
        }
        return baseFreezeAndTraverse(obj);
      };
      const dequeue = () => {
        setForEach(toFreeze, freezeAndTraverse);
      };
      const markHardened = (value) => {
        weaksetAdd(hardened, value);
      };
      const commit = () => {
        setForEach(toFreeze, markHardened);
      };
      enqueue(root);
      dequeue();
      commit();
      return root;
    }
  };
  return harden2;
};
const cauterizeProperty = (obj, prop, known, subPath, { warn, error }) => {
  if (!known) {
    warn(`Removing ${subPath}`);
  }
  try {
    delete obj[prop];
  } catch (err) {
    if (hasOwn(obj, prop)) {
      if (typeof obj === "function" && prop === "prototype") {
        obj.prototype = void 0;
        if (obj.prototype === void 0) {
          warn(`Tolerating undeletable ${subPath} === undefined`);
          return;
        }
      }
      error(`failed to delete ${subPath}`, err);
    } else {
      error(`deleting ${subPath} threw`, err);
    }
    throw err;
  }
};
const constantProperties = {
  // *** Value Properties of the Global Object
  Infinity: Infinity,
  NaN: NaN,
  undefined: void 0
};
const universalPropertyNames = {
  // *** Function Properties of the Global Object
  isFinite: "isFinite",
  isNaN: "isNaN",
  parseFloat: "parseFloat",
  parseInt: "parseInt",
  decodeURI: "decodeURI",
  decodeURIComponent: "decodeURIComponent",
  encodeURI: "encodeURI",
  encodeURIComponent: "encodeURIComponent",
  // *** Constructor Properties of the Global Object
  Array: "Array",
  ArrayBuffer: "ArrayBuffer",
  BigInt: "BigInt",
  BigInt64Array: "BigInt64Array",
  BigUint64Array: "BigUint64Array",
  Boolean: "Boolean",
  DataView: "DataView",
  EvalError: "EvalError",
  // https://github.com/tc39/proposal-float16array
  Float16Array: "Float16Array",
  Float32Array: "Float32Array",
  Float64Array: "Float64Array",
  Int8Array: "Int8Array",
  Int16Array: "Int16Array",
  Int32Array: "Int32Array",
  Map: "Map",
  Number: "Number",
  Object: "Object",
  Promise: "Promise",
  Proxy: "Proxy",
  RangeError: "RangeError",
  ReferenceError: "ReferenceError",
  Set: "Set",
  String: "String",
  SyntaxError: "SyntaxError",
  TypeError: "TypeError",
  Uint8Array: "Uint8Array",
  Uint8ClampedArray: "Uint8ClampedArray",
  Uint16Array: "Uint16Array",
  Uint32Array: "Uint32Array",
  URIError: "URIError",
  WeakMap: "WeakMap",
  WeakSet: "WeakSet",
  // https://github.com/tc39/proposal-iterator-helpers
  Iterator: "Iterator",
  // https://github.com/tc39/proposal-async-iterator-helpers
  AsyncIterator: "AsyncIterator",
  // https://github.com/endojs/endo/issues/550
  AggregateError: "AggregateError",
  // https://github.com/tc39/proposal-explicit-resource-management
  // TODO DisposableStack, AsyncDisposableStack
  // DisposableStack: 'DisposableStack',
  // AsyncDisposableStack: 'AsyncDisposableStack',
  // https://tc39.es/proposal-shadowrealm/
  // TODO ShadowRealm
  // ShadowRealm: 'ShadowRealm',
  // *** Other Properties of the Global Object
  JSON: "JSON",
  Reflect: "Reflect",
  // *** Annex B
  escape: "escape",
  unescape: "unescape",
  // ESNext
  // https://github.com/tc39/proposal-source-phase-imports?tab=readme-ov-file#js-module-source
  ModuleSource: "ModuleSource",
  lockdown: "lockdown",
  harden: "harden",
  HandledPromise: "HandledPromise"
  // TODO: Until Promise.delegate (see below).
};
const initialGlobalPropertyNames = {
  // *** Constructor Properties of the Global Object
  Date: "%InitialDate%",
  Error: "%InitialError%",
  RegExp: "%InitialRegExp%",
  // Omit `Symbol`, because we want the original to appear on the
  // start compartment without passing through the permits mechanism, since
  // we want to preserve all its properties, even if we never heard of them.
  // Symbol: '%InitialSymbol%',
  // *** Other Properties of the Global Object
  Math: "%InitialMath%",
  // ESNext
  // From Error-stack proposal
  // Only on initial global. No corresponding
  // powerless form for other globals.
  getStackString: "%InitialGetStackString%"
  // TODO https://github.com/Agoric/SES-shim/issues/551
  // Need initial WeakRef and FinalizationGroup in
  // start compartment only.
  // TODO Temporal
  // https://github.com/tc39/proposal-temporal
  // Temporal: '%InitialTemporal%' // with Temporal.Now
};
const sharedGlobalPropertyNames = {
  // *** Constructor Properties of the Global Object
  Date: "%SharedDate%",
  Error: "%SharedError%",
  RegExp: "%SharedRegExp%",
  Symbol: "%SharedSymbol%",
  // *** Other Properties of the Global Object
  Math: "%SharedMath%"
  // TODO Temporal
  // https://github.com/tc39/proposal-temporal
  // Temporal: '%SharedTemporal%' // without Temporal.Now
};
const NativeErrors = [
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError
  // https://github.com/endojs/endo/issues/550
  // Commented out to accommodate platforms prior to AggregateError.
  // Instead, conditional push below.
  // AggregateError,
];
if (typeof AggregateError !== "undefined") {
  arrayPush$1(NativeErrors, AggregateError);
}
const FunctionInstance = {
  "[[Proto]]": "%FunctionPrototype%",
  length: "number",
  name: "string"
  // Do not specify "prototype" here, since only Function instances that can
  // be used as a constructor have a prototype property. For constructors,
  // since prototype properties are instance-specific, we define it there.
};
const AsyncFunctionInstance = {
  // This property is not mentioned in ECMA 262, but is present in V8 and
  // necessary for lockdown to succeed.
  "[[Proto]]": "%AsyncFunctionPrototype%"
};
const fn = FunctionInstance;
const asyncFn = AsyncFunctionInstance;
const getter = {
  get: fn,
  set: "undefined"
};
const accessor = {
  get: fn,
  set: fn
};
const strict = function() {
};
arrayForEach(["caller", "arguments"], (prop) => {
  try {
    strict[prop];
  } catch (e) {
    if (e.message === "Restricted in strict mode") {
      FunctionInstance[prop] = accessor;
    }
  }
});
const isAccessorPermit = (permit) => {
  return permit === getter || permit === accessor;
};
function NativeError(prototype) {
  return {
    // Properties of the NativeError Constructors
    "[[Proto]]": "%SharedError%",
    // NativeError.prototype
    prototype
  };
}
function NativeErrorPrototype(constructor) {
  return {
    // Properties of the NativeError Prototype Objects
    "[[Proto]]": "%ErrorPrototype%",
    constructor,
    message: "string",
    name: "string",
    // Redundantly present only on v8. Safe to remove.
    toString: false,
    // Superfluously present in some versions of V8.
    // https://github.com/tc39/notes/blob/master/meetings/2021-10/oct-26.md#:~:text=However%2C%20Chrome%2093,and%20node%2016.11.
    cause: false
  };
}
function TypedArray(prototype) {
  return {
    // Properties of the TypedArray Constructors
    "[[Proto]]": "%TypedArray%",
    BYTES_PER_ELEMENT: "number",
    prototype
  };
}
function TypedArrayPrototype(constructor) {
  return {
    // Properties of the TypedArray Prototype Objects
    "[[Proto]]": "%TypedArrayPrototype%",
    BYTES_PER_ELEMENT: "number",
    constructor
  };
}
const CommonMath = {
  E: "number",
  LN10: "number",
  LN2: "number",
  LOG10E: "number",
  LOG2E: "number",
  PI: "number",
  SQRT1_2: "number",
  SQRT2: "number",
  "@@toStringTag": "string",
  abs: fn,
  acos: fn,
  acosh: fn,
  asin: fn,
  asinh: fn,
  atan: fn,
  atanh: fn,
  atan2: fn,
  cbrt: fn,
  ceil: fn,
  clz32: fn,
  cos: fn,
  cosh: fn,
  exp: fn,
  expm1: fn,
  floor: fn,
  fround: fn,
  hypot: fn,
  imul: fn,
  log: fn,
  log1p: fn,
  log10: fn,
  log2: fn,
  max: fn,
  min: fn,
  pow: fn,
  round: fn,
  sign: fn,
  sin: fn,
  sinh: fn,
  sqrt: fn,
  tan: fn,
  tanh: fn,
  trunc: fn,
  // https://github.com/tc39/proposal-float16array
  f16round: fn,
  // https://github.com/tc39/proposal-math-sum
  sumPrecise: fn,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  idiv: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  idivmod: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  imod: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  imuldiv: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  irem: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523
  mod: false,
  // See https://github.com/Moddable-OpenSource/moddable/issues/523#issuecomment-1942904505
  irandom: false
};
const permitted = {
  // ECMA https://tc39.es/ecma262
  // The intrinsics object has no prototype to avoid conflicts.
  "[[Proto]]": null,
  // %ThrowTypeError%
  "%ThrowTypeError%": fn,
  // *** The Global Object
  // *** Value Properties of the Global Object
  Infinity: "number",
  NaN: "number",
  undefined: "undefined",
  // *** Function Properties of the Global Object
  // eval
  "%UniqueEval%": fn,
  isFinite: fn,
  isNaN: fn,
  parseFloat: fn,
  parseInt: fn,
  decodeURI: fn,
  decodeURIComponent: fn,
  encodeURI: fn,
  encodeURIComponent: fn,
  // *** Fundamental Objects
  Object: {
    // Properties of the Object Constructor
    "[[Proto]]": "%FunctionPrototype%",
    assign: fn,
    create: fn,
    defineProperties: fn,
    defineProperty: fn,
    entries: fn,
    freeze: fn,
    fromEntries: fn,
    getOwnPropertyDescriptor: fn,
    getOwnPropertyDescriptors: fn,
    getOwnPropertyNames: fn,
    getOwnPropertySymbols: fn,
    getPrototypeOf: fn,
    is: fn,
    isExtensible: fn,
    isFrozen: fn,
    isSealed: fn,
    keys: fn,
    preventExtensions: fn,
    prototype: "%ObjectPrototype%",
    seal: fn,
    setPrototypeOf: fn,
    values: fn,
    // https://github.com/tc39/proposal-accessible-object-hasownproperty
    hasOwn: fn,
    // https://github.com/tc39/proposal-array-grouping
    groupBy: fn,
    // Seen on QuickJS
    __getClass: false
  },
  "%ObjectPrototype%": {
    // Properties of the Object Prototype Object
    "[[Proto]]": null,
    constructor: "Object",
    hasOwnProperty: fn,
    isPrototypeOf: fn,
    propertyIsEnumerable: fn,
    toLocaleString: fn,
    toString: fn,
    valueOf: fn,
    // Annex B: Additional Properties of the Object.prototype Object
    // See note in header about the difference between [[Proto]] and --proto--
    // special notations.
    "--proto--": accessor,
    __defineGetter__: fn,
    __defineSetter__: fn,
    __lookupGetter__: fn,
    __lookupSetter__: fn
  },
  "%UniqueFunction%": {
    // Properties of the Function Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%FunctionPrototype%"
  },
  "%InertFunction%": {
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%FunctionPrototype%"
  },
  "%FunctionPrototype%": {
    apply: fn,
    bind: fn,
    call: fn,
    constructor: "%InertFunction%",
    toString: fn,
    "@@hasInstance": fn,
    // proposed but not yet std. To be removed if there
    caller: false,
    // proposed but not yet std. To be removed if there
    arguments: false,
    // Seen on QuickJS. TODO grab getter for use by console
    fileName: false,
    // Seen on QuickJS. TODO grab getter for use by console
    lineNumber: false
  },
  Boolean: {
    // Properties of the Boolean Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%BooleanPrototype%"
  },
  "%BooleanPrototype%": {
    constructor: "Boolean",
    toString: fn,
    valueOf: fn
  },
  "%SharedSymbol%": {
    // Properties of the Symbol Constructor
    "[[Proto]]": "%FunctionPrototype%",
    asyncIterator: "symbol",
    for: fn,
    hasInstance: "symbol",
    isConcatSpreadable: "symbol",
    iterator: "symbol",
    keyFor: fn,
    match: "symbol",
    matchAll: "symbol",
    prototype: "%SymbolPrototype%",
    replace: "symbol",
    search: "symbol",
    species: "symbol",
    split: "symbol",
    toPrimitive: "symbol",
    toStringTag: "symbol",
    unscopables: "symbol",
    // https://github.com/tc39/proposal-explicit-resource-management
    asyncDispose: "symbol",
    // https://github.com/tc39/proposal-explicit-resource-management
    dispose: "symbol",
    // Seen at core-js https://github.com/zloirock/core-js#ecmascript-symbol
    useSimple: false,
    // Seen at core-js https://github.com/zloirock/core-js#ecmascript-symbol
    useSetter: false,
    // Seen on QuickJS
    operatorSet: false
  },
  "%SymbolPrototype%": {
    // Properties of the Symbol Prototype Object
    constructor: "%SharedSymbol%",
    description: getter,
    toString: fn,
    valueOf: fn,
    "@@toPrimitive": fn,
    "@@toStringTag": "string"
  },
  "%InitialError%": {
    // Properties of the Error Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%ErrorPrototype%",
    // Non standard, v8 only, used by tap
    captureStackTrace: fn,
    // Non standard, v8 only, used by tap, tamed to accessor
    stackTraceLimit: accessor,
    // Non standard, v8 only, used by several, tamed to accessor
    prepareStackTrace: accessor,
    // https://github.com/tc39/proposal-is-error
    isError: fn
  },
  "%SharedError%": {
    // Properties of the Error Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%ErrorPrototype%",
    // Non standard, v8 only, used by tap
    captureStackTrace: fn,
    // Non standard, v8 only, used by tap, tamed to accessor
    stackTraceLimit: accessor,
    // Non standard, v8 only, used by several, tamed to accessor
    prepareStackTrace: accessor,
    // https://github.com/tc39/proposal-is-error
    isError: fn
  },
  "%ErrorPrototype%": {
    constructor: "%SharedError%",
    message: "string",
    name: "string",
    toString: fn,
    // proposed de-facto, assumed TODO
    // Seen on FF Nightly 88.0a1
    at: false,
    // Seen on FF and XS
    stack: accessor,
    // Superfluously present in some versions of V8.
    // https://github.com/tc39/notes/blob/master/meetings/2021-10/oct-26.md#:~:text=However%2C%20Chrome%2093,and%20node%2016.11.
    cause: false
  },
  // NativeError
  EvalError: NativeError("%EvalErrorPrototype%"),
  RangeError: NativeError("%RangeErrorPrototype%"),
  ReferenceError: NativeError("%ReferenceErrorPrototype%"),
  SyntaxError: NativeError("%SyntaxErrorPrototype%"),
  TypeError: NativeError("%TypeErrorPrototype%"),
  URIError: NativeError("%URIErrorPrototype%"),
  // https://github.com/endojs/endo/issues/550
  AggregateError: NativeError("%AggregateErrorPrototype%"),
  // TODO SuppressedError
  // https://github.com/tc39/proposal-explicit-resource-management
  // SuppressedError: NativeError('%SuppressedErrorPrototype%'),
  "%EvalErrorPrototype%": NativeErrorPrototype("EvalError"),
  "%RangeErrorPrototype%": NativeErrorPrototype("RangeError"),
  "%ReferenceErrorPrototype%": NativeErrorPrototype("ReferenceError"),
  "%SyntaxErrorPrototype%": NativeErrorPrototype("SyntaxError"),
  "%TypeErrorPrototype%": NativeErrorPrototype("TypeError"),
  "%URIErrorPrototype%": NativeErrorPrototype("URIError"),
  // https://github.com/endojs/endo/issues/550
  "%AggregateErrorPrototype%": NativeErrorPrototype("AggregateError"),
  // TODO AggregateError .errors
  // TODO SuppressedError
  // https://github.com/tc39/proposal-explicit-resource-management
  // '%SuppressedErrorPrototype%': NativeErrorPrototype('SuppressedError'),
  // TODO SuppressedError .error
  // TODO SuppressedError .suppressed
  // *** Numbers and Dates
  Number: {
    // Properties of the Number Constructor
    "[[Proto]]": "%FunctionPrototype%",
    EPSILON: "number",
    isFinite: fn,
    isInteger: fn,
    isNaN: fn,
    isSafeInteger: fn,
    MAX_SAFE_INTEGER: "number",
    MAX_VALUE: "number",
    MIN_SAFE_INTEGER: "number",
    MIN_VALUE: "number",
    NaN: "number",
    NEGATIVE_INFINITY: "number",
    parseFloat: fn,
    parseInt: fn,
    POSITIVE_INFINITY: "number",
    prototype: "%NumberPrototype%"
  },
  "%NumberPrototype%": {
    // Properties of the Number Prototype Object
    constructor: "Number",
    toExponential: fn,
    toFixed: fn,
    toLocaleString: fn,
    toPrecision: fn,
    toString: fn,
    valueOf: fn
  },
  BigInt: {
    // Properties of the BigInt Constructor
    "[[Proto]]": "%FunctionPrototype%",
    asIntN: fn,
    asUintN: fn,
    prototype: "%BigIntPrototype%",
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    bitLength: false,
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    fromArrayBuffer: false,
    // Seen on QuickJS
    tdiv: false,
    // Seen on QuickJS
    fdiv: false,
    // Seen on QuickJS
    cdiv: false,
    // Seen on QuickJS
    ediv: false,
    // Seen on QuickJS
    tdivrem: false,
    // Seen on QuickJS
    fdivrem: false,
    // Seen on QuickJS
    cdivrem: false,
    // Seen on QuickJS
    edivrem: false,
    // Seen on QuickJS
    sqrt: false,
    // Seen on QuickJS
    sqrtrem: false,
    // Seen on QuickJS
    floorLog2: false,
    // Seen on QuickJS
    ctz: false
  },
  "%BigIntPrototype%": {
    constructor: "BigInt",
    toLocaleString: fn,
    toString: fn,
    valueOf: fn,
    "@@toStringTag": "string"
  },
  "%InitialMath%": {
    ...CommonMath,
    // `%InitialMath%.random()` has the standard unsafe behavior
    random: fn
  },
  "%SharedMath%": {
    ...CommonMath,
    // `%SharedMath%.random()` is tamed to always throw
    random: fn
  },
  "%InitialDate%": {
    // Properties of the Date Constructor
    "[[Proto]]": "%FunctionPrototype%",
    now: fn,
    parse: fn,
    prototype: "%DatePrototype%",
    UTC: fn
  },
  "%SharedDate%": {
    // Properties of the Date Constructor
    "[[Proto]]": "%FunctionPrototype%",
    // `%SharedDate%.now()` is tamed to always throw
    now: fn,
    parse: fn,
    prototype: "%DatePrototype%",
    UTC: fn
  },
  "%DatePrototype%": {
    constructor: "%SharedDate%",
    getDate: fn,
    getDay: fn,
    getFullYear: fn,
    getHours: fn,
    getMilliseconds: fn,
    getMinutes: fn,
    getMonth: fn,
    getSeconds: fn,
    getTime: fn,
    getTimezoneOffset: fn,
    getUTCDate: fn,
    getUTCDay: fn,
    getUTCFullYear: fn,
    getUTCHours: fn,
    getUTCMilliseconds: fn,
    getUTCMinutes: fn,
    getUTCMonth: fn,
    getUTCSeconds: fn,
    setDate: fn,
    setFullYear: fn,
    setHours: fn,
    setMilliseconds: fn,
    setMinutes: fn,
    setMonth: fn,
    setSeconds: fn,
    setTime: fn,
    setUTCDate: fn,
    setUTCFullYear: fn,
    setUTCHours: fn,
    setUTCMilliseconds: fn,
    setUTCMinutes: fn,
    setUTCMonth: fn,
    setUTCSeconds: fn,
    toDateString: fn,
    toISOString: fn,
    toJSON: fn,
    toLocaleDateString: fn,
    toLocaleString: fn,
    toLocaleTimeString: fn,
    toString: fn,
    toTimeString: fn,
    toUTCString: fn,
    valueOf: fn,
    "@@toPrimitive": fn,
    // Annex B: Additional Properties of the Date.prototype Object
    getYear: fn,
    setYear: fn,
    toGMTString: fn
  },
  // Text Processing
  String: {
    // Properties of the String Constructor
    "[[Proto]]": "%FunctionPrototype%",
    fromCharCode: fn,
    fromCodePoint: fn,
    prototype: "%StringPrototype%",
    raw: fn,
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    fromArrayBuffer: false
  },
  "%StringPrototype%": {
    // Properties of the String Prototype Object
    length: "number",
    charAt: fn,
    charCodeAt: fn,
    codePointAt: fn,
    concat: fn,
    constructor: "String",
    endsWith: fn,
    includes: fn,
    indexOf: fn,
    lastIndexOf: fn,
    localeCompare: fn,
    match: fn,
    matchAll: fn,
    normalize: fn,
    padEnd: fn,
    padStart: fn,
    repeat: fn,
    replace: fn,
    replaceAll: fn,
    // ES2021
    search: fn,
    slice: fn,
    split: fn,
    startsWith: fn,
    substring: fn,
    toLocaleLowerCase: fn,
    toLocaleUpperCase: fn,
    toLowerCase: fn,
    toString: fn,
    toUpperCase: fn,
    trim: fn,
    trimEnd: fn,
    trimStart: fn,
    valueOf: fn,
    "@@iterator": fn,
    // Failed tc39 proposal
    // https://github.com/tc39/proposal-relative-indexing-method
    at: fn,
    // https://github.com/tc39/proposal-is-usv-string
    isWellFormed: fn,
    toWellFormed: fn,
    unicodeSets: fn,
    // Annex B: Additional Properties of the String.prototype Object
    substr: fn,
    anchor: fn,
    big: fn,
    blink: fn,
    bold: fn,
    fixed: fn,
    fontcolor: fn,
    fontsize: fn,
    italics: fn,
    link: fn,
    small: fn,
    strike: fn,
    sub: fn,
    sup: fn,
    trimLeft: fn,
    trimRight: fn,
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    compare: false,
    // Seen on QuickJS
    __quote: false
  },
  "%StringIteratorPrototype%": {
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    "@@toStringTag": "string"
  },
  "%InitialRegExp%": {
    // Properties of the RegExp Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%RegExpPrototype%",
    "@@species": getter,
    // https://github.com/tc39/proposal-regex-escaping
    escape: fn,
    // The https://github.com/tc39/proposal-regexp-legacy-features
    // are all optional, unsafe, and omitted
    input: false,
    $_: false,
    lastMatch: false,
    "$&": false,
    lastParen: false,
    "$+": false,
    leftContext: false,
    "$`": false,
    rightContext: false,
    "$'": false,
    $1: false,
    $2: false,
    $3: false,
    $4: false,
    $5: false,
    $6: false,
    $7: false,
    $8: false,
    $9: false
  },
  "%SharedRegExp%": {
    // Properties of the RegExp Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%RegExpPrototype%",
    "@@species": getter,
    // https://github.com/tc39/proposal-regex-escaping
    escape: fn
  },
  "%RegExpPrototype%": {
    // Properties of the RegExp Prototype Object
    constructor: "%SharedRegExp%",
    exec: fn,
    dotAll: getter,
    flags: getter,
    global: getter,
    hasIndices: getter,
    ignoreCase: getter,
    "@@match": fn,
    "@@matchAll": fn,
    multiline: getter,
    "@@replace": fn,
    "@@search": fn,
    source: getter,
    "@@split": fn,
    sticky: getter,
    test: fn,
    toString: fn,
    unicode: getter,
    unicodeSets: getter,
    // Annex B: Additional Properties of the RegExp.prototype Object
    compile: false
    // UNSAFE and suppressed.
  },
  "%RegExpStringIteratorPrototype%": {
    // The %RegExpStringIteratorPrototype% Object
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    "@@toStringTag": "string"
  },
  // Indexed Collections
  Array: {
    // Properties of the Array Constructor
    "[[Proto]]": "%FunctionPrototype%",
    from: fn,
    isArray: fn,
    of: fn,
    prototype: "%ArrayPrototype%",
    "@@species": getter,
    // Failed tc39 proposal
    // https://tc39.es/proposal-relative-indexing-method/
    at: fn,
    // https://tc39.es/proposal-array-from-async/
    fromAsync: fn
  },
  "%ArrayPrototype%": {
    // Properties of the Array Prototype Object
    length: "number",
    concat: fn,
    constructor: "Array",
    copyWithin: fn,
    entries: fn,
    every: fn,
    fill: fn,
    filter: fn,
    find: fn,
    findIndex: fn,
    flat: fn,
    flatMap: fn,
    forEach: fn,
    includes: fn,
    indexOf: fn,
    join: fn,
    keys: fn,
    lastIndexOf: fn,
    map: fn,
    pop: fn,
    push: fn,
    reduce: fn,
    reduceRight: fn,
    reverse: fn,
    shift: fn,
    slice: fn,
    some: fn,
    sort: fn,
    splice: fn,
    toLocaleString: fn,
    toString: fn,
    unshift: fn,
    values: fn,
    "@@iterator": fn,
    "@@unscopables": {
      "[[Proto]]": null,
      copyWithin: "boolean",
      entries: "boolean",
      fill: "boolean",
      find: "boolean",
      findIndex: "boolean",
      flat: "boolean",
      flatMap: "boolean",
      includes: "boolean",
      keys: "boolean",
      values: "boolean",
      // Failed tc39 proposal
      // https://tc39.es/proposal-relative-indexing-method/
      // Seen on FF Nightly 88.0a1
      at: "boolean",
      // See https://github.com/tc39/proposal-array-find-from-last
      findLast: "boolean",
      findLastIndex: "boolean",
      // https://github.com/tc39/proposal-change-array-by-copy
      toReversed: "boolean",
      toSorted: "boolean",
      toSpliced: "boolean",
      with: "boolean",
      // https://github.com/tc39/proposal-array-grouping
      group: "boolean",
      groupToMap: "boolean",
      groupBy: "boolean"
    },
    // See https://github.com/tc39/proposal-array-find-from-last
    findLast: fn,
    findLastIndex: fn,
    // https://github.com/tc39/proposal-change-array-by-copy
    toReversed: fn,
    toSorted: fn,
    toSpliced: fn,
    with: fn,
    // https://github.com/tc39/proposal-array-grouping
    group: fn,
    // Not in proposal? Where?
    groupToMap: fn,
    // Not in proposal? Where?
    groupBy: fn,
    // Failed tc39 proposal
    // https://tc39.es/proposal-relative-indexing-method/
    at: fn
  },
  "%ArrayIteratorPrototype%": {
    // The %ArrayIteratorPrototype% Object
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    "@@toStringTag": "string"
  },
  // *** TypedArray Objects
  "%TypedArray%": {
    // Properties of the %TypedArray% Intrinsic Object
    "[[Proto]]": "%FunctionPrototype%",
    from: fn,
    of: fn,
    prototype: "%TypedArrayPrototype%",
    "@@species": getter
  },
  "%TypedArrayPrototype%": {
    buffer: getter,
    byteLength: getter,
    byteOffset: getter,
    constructor: "%TypedArray%",
    copyWithin: fn,
    entries: fn,
    every: fn,
    fill: fn,
    filter: fn,
    find: fn,
    findIndex: fn,
    forEach: fn,
    includes: fn,
    indexOf: fn,
    join: fn,
    keys: fn,
    lastIndexOf: fn,
    length: getter,
    map: fn,
    reduce: fn,
    reduceRight: fn,
    reverse: fn,
    set: fn,
    slice: fn,
    some: fn,
    sort: fn,
    subarray: fn,
    toLocaleString: fn,
    toString: fn,
    values: fn,
    "@@iterator": fn,
    "@@toStringTag": getter,
    // Failed tc39 proposal
    // https://tc39.es/proposal-relative-indexing-method/
    at: fn,
    // See https://github.com/tc39/proposal-array-find-from-last
    findLast: fn,
    findLastIndex: fn,
    // https://github.com/tc39/proposal-change-array-by-copy
    toReversed: fn,
    toSorted: fn,
    with: fn
  },
  // The TypedArray Constructors
  BigInt64Array: TypedArray("%BigInt64ArrayPrototype%"),
  BigUint64Array: TypedArray("%BigUint64ArrayPrototype%"),
  // https://github.com/tc39/proposal-float16array
  Float16Array: TypedArray("%Float16ArrayPrototype%"),
  Float32Array: TypedArray("%Float32ArrayPrototype%"),
  Float64Array: TypedArray("%Float64ArrayPrototype%"),
  Int16Array: TypedArray("%Int16ArrayPrototype%"),
  Int32Array: TypedArray("%Int32ArrayPrototype%"),
  Int8Array: TypedArray("%Int8ArrayPrototype%"),
  Uint16Array: TypedArray("%Uint16ArrayPrototype%"),
  Uint32Array: TypedArray("%Uint32ArrayPrototype%"),
  Uint8ClampedArray: TypedArray("%Uint8ClampedArrayPrototype%"),
  Uint8Array: {
    ...TypedArray("%Uint8ArrayPrototype%"),
    // https://github.com/tc39/proposal-arraybuffer-base64
    fromBase64: fn,
    // https://github.com/tc39/proposal-arraybuffer-base64
    fromHex: fn
  },
  "%BigInt64ArrayPrototype%": TypedArrayPrototype("BigInt64Array"),
  "%BigUint64ArrayPrototype%": TypedArrayPrototype("BigUint64Array"),
  // https://github.com/tc39/proposal-float16array
  "%Float16ArrayPrototype%": TypedArrayPrototype("Float16Array"),
  "%Float32ArrayPrototype%": TypedArrayPrototype("Float32Array"),
  "%Float64ArrayPrototype%": TypedArrayPrototype("Float64Array"),
  "%Int16ArrayPrototype%": TypedArrayPrototype("Int16Array"),
  "%Int32ArrayPrototype%": TypedArrayPrototype("Int32Array"),
  "%Int8ArrayPrototype%": TypedArrayPrototype("Int8Array"),
  "%Uint16ArrayPrototype%": TypedArrayPrototype("Uint16Array"),
  "%Uint32ArrayPrototype%": TypedArrayPrototype("Uint32Array"),
  "%Uint8ClampedArrayPrototype%": TypedArrayPrototype("Uint8ClampedArray"),
  "%Uint8ArrayPrototype%": {
    ...TypedArrayPrototype("Uint8Array"),
    // https://github.com/tc39/proposal-arraybuffer-base64
    setFromBase64: fn,
    // https://github.com/tc39/proposal-arraybuffer-base64
    setFromHex: fn,
    // https://github.com/tc39/proposal-arraybuffer-base64
    toBase64: fn,
    // https://github.com/tc39/proposal-arraybuffer-base64
    toHex: fn
  },
  // *** Keyed Collections
  Map: {
    // Properties of the Map Constructor
    "[[Proto]]": "%FunctionPrototype%",
    "@@species": getter,
    prototype: "%MapPrototype%",
    // https://github.com/tc39/proposal-array-grouping
    groupBy: fn
  },
  "%MapPrototype%": {
    clear: fn,
    constructor: "Map",
    delete: fn,
    entries: fn,
    forEach: fn,
    get: fn,
    has: fn,
    keys: fn,
    set: fn,
    size: getter,
    values: fn,
    "@@iterator": fn,
    "@@toStringTag": "string"
  },
  "%MapIteratorPrototype%": {
    // The %MapIteratorPrototype% Object
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    "@@toStringTag": "string"
  },
  Set: {
    // Properties of the Set Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%SetPrototype%",
    "@@species": getter,
    // Seen on QuickJS
    groupBy: false
  },
  "%SetPrototype%": {
    add: fn,
    clear: fn,
    constructor: "Set",
    delete: fn,
    entries: fn,
    forEach: fn,
    has: fn,
    keys: fn,
    size: getter,
    values: fn,
    "@@iterator": fn,
    "@@toStringTag": "string",
    // See https://github.com/tc39/proposal-set-methods
    intersection: fn,
    // See https://github.com/tc39/proposal-set-methods
    union: fn,
    // See https://github.com/tc39/proposal-set-methods
    difference: fn,
    // See https://github.com/tc39/proposal-set-methods
    symmetricDifference: fn,
    // See https://github.com/tc39/proposal-set-methods
    isSubsetOf: fn,
    // See https://github.com/tc39/proposal-set-methods
    isSupersetOf: fn,
    // See https://github.com/tc39/proposal-set-methods
    isDisjointFrom: fn
  },
  "%SetIteratorPrototype%": {
    // The %SetIteratorPrototype% Object
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    "@@toStringTag": "string"
  },
  WeakMap: {
    // Properties of the WeakMap Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%WeakMapPrototype%"
  },
  "%WeakMapPrototype%": {
    constructor: "WeakMap",
    delete: fn,
    get: fn,
    has: fn,
    set: fn,
    "@@toStringTag": "string"
  },
  WeakSet: {
    // Properties of the WeakSet Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%WeakSetPrototype%"
  },
  "%WeakSetPrototype%": {
    add: fn,
    constructor: "WeakSet",
    delete: fn,
    has: fn,
    "@@toStringTag": "string"
  },
  // *** Structured Data
  ArrayBuffer: {
    // Properties of the ArrayBuffer Constructor
    "[[Proto]]": "%FunctionPrototype%",
    isView: fn,
    prototype: "%ArrayBufferPrototype%",
    "@@species": getter,
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    fromString: false,
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    fromBigInt: false
  },
  "%ArrayBufferPrototype%": {
    byteLength: getter,
    constructor: "ArrayBuffer",
    slice: fn,
    "@@toStringTag": "string",
    // See https://github.com/Moddable-OpenSource/moddable/issues/523
    concat: false,
    // See https://github.com/tc39/proposal-resizablearraybuffer
    transfer: fn,
    resize: fn,
    resizable: getter,
    maxByteLength: getter,
    // https://github.com/tc39/proposal-arraybuffer-transfer
    transferToFixedLength: fn,
    detached: getter,
    // https://github.com/endojs/endo/pull/2309#issuecomment-2155513240
    // to be proposed
    transferToImmutable: fn,
    sliceToImmutable: fn,
    immutable: getter
  },
  // If this exists, it is purely an artifact of how we currently shim
  // `transferToImmutable`. As natively implemented, there would be no
  // such extra prototype.
  "%ImmutableArrayBufferPrototype%": {
    "[[Proto]]": "%ArrayBufferPrototype%",
    byteLength: getter,
    slice: fn,
    // See https://github.com/endojs/endo/tree/master/packages/immutable-arraybuffer#purposeful-violation
    "@@toStringTag": "string",
    // See https://github.com/tc39/proposal-resizablearraybuffer
    transfer: fn,
    resize: fn,
    resizable: getter,
    maxByteLength: getter,
    // https://github.com/tc39/proposal-arraybuffer-transfer
    transferToFixedLength: fn,
    detached: getter,
    // https://github.com/endojs/endo/pull/2309#issuecomment-2155513240
    // to be proposed
    transferToImmutable: fn,
    sliceToImmutable: fn,
    immutable: getter
  },
  // SharedArrayBuffer Objects
  SharedArrayBuffer: false,
  // UNSAFE and purposely suppressed.
  "%SharedArrayBufferPrototype%": false,
  // UNSAFE and purposely suppressed.
  DataView: {
    // Properties of the DataView Constructor
    "[[Proto]]": "%FunctionPrototype%",
    BYTES_PER_ELEMENT: "number",
    // Non std but undeletable on Safari.
    prototype: "%DataViewPrototype%"
  },
  "%DataViewPrototype%": {
    buffer: getter,
    byteLength: getter,
    byteOffset: getter,
    constructor: "DataView",
    getBigInt64: fn,
    getBigUint64: fn,
    // https://github.com/tc39/proposal-float16array
    getFloat16: fn,
    getFloat32: fn,
    getFloat64: fn,
    getInt8: fn,
    getInt16: fn,
    getInt32: fn,
    getUint8: fn,
    getUint16: fn,
    getUint32: fn,
    setBigInt64: fn,
    setBigUint64: fn,
    // https://github.com/tc39/proposal-float16array
    setFloat16: fn,
    setFloat32: fn,
    setFloat64: fn,
    setInt8: fn,
    setInt16: fn,
    setInt32: fn,
    setUint8: fn,
    setUint16: fn,
    setUint32: fn,
    "@@toStringTag": "string"
  },
  // Atomics
  Atomics: false,
  // UNSAFE and suppressed.
  JSON: {
    parse: fn,
    stringify: fn,
    "@@toStringTag": "string",
    // https://github.com/tc39/proposal-json-parse-with-source/
    rawJSON: fn,
    isRawJSON: fn
  },
  // *** Control Abstraction Objects
  // https://github.com/tc39/proposal-iterator-helpers
  Iterator: {
    // Properties of the Iterator Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%IteratorPrototype%",
    from: fn,
    // https://github.com/tc39/proposal-joint-iteration
    zip: fn,
    zipKeyed: fn,
    // https://github.com/tc39/proposal-iterator-sequencing
    concat: fn
  },
  "%IteratorPrototype%": {
    // The %IteratorPrototype% Object
    "@@iterator": fn,
    // https://github.com/tc39/proposal-iterator-helpers
    constructor: "Iterator",
    map: fn,
    filter: fn,
    take: fn,
    drop: fn,
    flatMap: fn,
    reduce: fn,
    toArray: fn,
    forEach: fn,
    some: fn,
    every: fn,
    find: fn,
    "@@toStringTag": "string",
    // https://github.com/tc39/proposal-async-iterator-helpers
    toAsync: fn,
    // https://github.com/tc39/proposal-explicit-resource-management
    // See https://github.com/Moddable-OpenSource/moddable/issues/523#issuecomment-1942904505
    "@@dispose": false
  },
  // https://github.com/tc39/proposal-iterator-helpers
  "%WrapForValidIteratorPrototype%": {
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    return: fn
  },
  // https://github.com/tc39/proposal-iterator-helpers
  "%IteratorHelperPrototype%": {
    "[[Proto]]": "%IteratorPrototype%",
    next: fn,
    return: fn,
    "@@toStringTag": "string"
  },
  // https://github.com/tc39/proposal-async-iterator-helpers
  AsyncIterator: {
    // Properties of the Iterator Constructor
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%AsyncIteratorPrototype%",
    from: fn
  },
  "%AsyncIteratorPrototype%": {
    // The %AsyncIteratorPrototype% Object
    "@@asyncIterator": fn,
    // https://github.com/tc39/proposal-async-iterator-helpers
    constructor: "AsyncIterator",
    map: fn,
    filter: fn,
    take: fn,
    drop: fn,
    flatMap: fn,
    reduce: fn,
    toArray: fn,
    forEach: fn,
    some: fn,
    every: fn,
    find: fn,
    "@@toStringTag": "string",
    // https://github.com/tc39/proposal-explicit-resource-management
    // See https://github.com/Moddable-OpenSource/moddable/issues/523#issuecomment-1942904505
    "@@asyncDispose": false
  },
  // https://github.com/tc39/proposal-async-iterator-helpers
  "%WrapForValidAsyncIteratorPrototype%": {
    "[[Proto]]": "%AsyncIteratorPrototype%",
    next: fn,
    return: fn
  },
  // https://github.com/tc39/proposal-async-iterator-helpers
  "%AsyncIteratorHelperPrototype%": {
    "[[Proto]]": "%AsyncIteratorPrototype%",
    next: fn,
    return: fn,
    "@@toStringTag": "string"
  },
  "%InertGeneratorFunction%": {
    // Properties of the GeneratorFunction Constructor
    "[[Proto]]": "%InertFunction%",
    prototype: "%Generator%"
  },
  "%Generator%": {
    // Properties of the GeneratorFunction Prototype Object
    "[[Proto]]": "%FunctionPrototype%",
    constructor: "%InertGeneratorFunction%",
    prototype: "%GeneratorPrototype%",
    "@@toStringTag": "string"
  },
  "%InertAsyncGeneratorFunction%": {
    // Properties of the AsyncGeneratorFunction Constructor
    "[[Proto]]": "%InertFunction%",
    prototype: "%AsyncGenerator%"
  },
  "%AsyncGenerator%": {
    // Properties of the AsyncGeneratorFunction Prototype Object
    "[[Proto]]": "%FunctionPrototype%",
    constructor: "%InertAsyncGeneratorFunction%",
    prototype: "%AsyncGeneratorPrototype%",
    // length prop added here for React Native jsc-android
    // https://github.com/endojs/endo/issues/660
    // https://github.com/react-native-community/jsc-android-buildscripts/issues/181
    length: "number",
    "@@toStringTag": "string"
  },
  "%GeneratorPrototype%": {
    // Properties of the Generator Prototype Object
    "[[Proto]]": "%IteratorPrototype%",
    constructor: "%Generator%",
    next: fn,
    return: fn,
    throw: fn,
    "@@toStringTag": "string"
  },
  "%AsyncGeneratorPrototype%": {
    // Properties of the AsyncGenerator Prototype Object
    "[[Proto]]": "%AsyncIteratorPrototype%",
    constructor: "%AsyncGenerator%",
    next: fn,
    return: fn,
    throw: fn,
    "@@toStringTag": "string"
  },
  // TODO: To be replaced with Promise.delegate
  //
  // The HandledPromise global variable shimmed by `@agoric/eventual-send/shim`
  // implements an initial version of the eventual send specification at:
  // https://github.com/tc39/proposal-eventual-send
  //
  // We will likely change this to add a property to Promise called
  // Promise.delegate and put static methods on it, which will necessitate
  // another permits change to update to the current proposed standard.
  HandledPromise: {
    "[[Proto]]": "Promise",
    applyFunction: fn,
    applyFunctionSendOnly: fn,
    applyMethod: fn,
    applyMethodSendOnly: fn,
    get: fn,
    getSendOnly: fn,
    prototype: "%PromisePrototype%",
    resolve: fn
  },
  // https://github.com/tc39/proposal-source-phase-imports?tab=readme-ov-file#js-module-source
  ModuleSource: {
    "[[Proto]]": "%AbstractModuleSource%",
    prototype: "%ModuleSourcePrototype%"
  },
  "%ModuleSourcePrototype%": {
    "[[Proto]]": "%AbstractModuleSourcePrototype%",
    constructor: "ModuleSource",
    "@@toStringTag": "string",
    // https://github.com/tc39/proposal-compartments
    bindings: getter,
    needsImport: getter,
    needsImportMeta: getter,
    // @endo/module-source provides a legacy interface
    imports: getter,
    exports: getter,
    reexports: getter
  },
  "%AbstractModuleSource%": {
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%AbstractModuleSourcePrototype%"
  },
  "%AbstractModuleSourcePrototype%": {
    constructor: "%AbstractModuleSource%"
  },
  Promise: {
    // Properties of the Promise Constructor
    "[[Proto]]": "%FunctionPrototype%",
    all: fn,
    allSettled: fn,
    // https://github.com/Agoric/SES-shim/issues/550
    any: fn,
    prototype: "%PromisePrototype%",
    race: fn,
    reject: fn,
    resolve: fn,
    // https://github.com/tc39/proposal-promise-with-resolvers
    withResolvers: fn,
    "@@species": getter,
    // https://github.com/tc39/proposal-promise-try
    try: fn
  },
  "%PromisePrototype%": {
    // Properties of the Promise Prototype Object
    catch: fn,
    constructor: "Promise",
    finally: fn,
    then: fn,
    "@@toStringTag": "string",
    // Non-standard, used in node to prevent async_hooks from breaking
    "UniqueSymbol(async_id_symbol)": accessor,
    "UniqueSymbol(trigger_async_id_symbol)": accessor,
    "UniqueSymbol(destroyed)": accessor
  },
  "%InertAsyncFunction%": {
    // Properties of the AsyncFunction Constructor
    "[[Proto]]": "%InertFunction%",
    prototype: "%AsyncFunctionPrototype%"
  },
  "%AsyncFunctionPrototype%": {
    // Properties of the AsyncFunction Prototype Object
    "[[Proto]]": "%FunctionPrototype%",
    constructor: "%InertAsyncFunction%",
    // length prop added here for React Native jsc-android
    // https://github.com/endojs/endo/issues/660
    // https://github.com/react-native-community/jsc-android-buildscripts/issues/181
    length: "number",
    "@@toStringTag": "string"
  },
  // Reflection
  Reflect: {
    // The Reflect Object
    // Not a function object.
    apply: fn,
    construct: fn,
    defineProperty: fn,
    deleteProperty: fn,
    get: fn,
    getOwnPropertyDescriptor: fn,
    getPrototypeOf: fn,
    has: fn,
    isExtensible: fn,
    ownKeys: fn,
    preventExtensions: fn,
    set: fn,
    setPrototypeOf: fn,
    "@@toStringTag": "string"
  },
  Proxy: {
    // Properties of the Proxy Constructor
    "[[Proto]]": "%FunctionPrototype%",
    revocable: fn
  },
  // Appendix B
  // Annex B: Additional Properties of the Global Object
  escape: fn,
  unescape: fn,
  // Proposed
  "%UniqueCompartment%": {
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%CompartmentPrototype%",
    toString: fn
  },
  "%InertCompartment%": {
    "[[Proto]]": "%FunctionPrototype%",
    prototype: "%CompartmentPrototype%",
    toString: fn
  },
  "%CompartmentPrototype%": {
    constructor: "%InertCompartment%",
    evaluate: fn,
    globalThis: getter,
    name: getter,
    import: asyncFn,
    load: asyncFn,
    importNow: fn,
    module: fn,
    "@@toStringTag": "string"
  },
  lockdown: fn,
  harden: { ...fn, isFake: "boolean" },
  "%InitialGetStackString%": fn
};
const isFunction = (obj) => typeof obj === "function";
function initProperty(obj, name, desc) {
  if (hasOwn(obj, name)) {
    const preDesc = getOwnPropertyDescriptor$1(obj, name);
    if (!preDesc || !is(preDesc.value, desc.value) || preDesc.get !== desc.get || preDesc.set !== desc.set || preDesc.writable !== desc.writable || preDesc.enumerable !== desc.enumerable || preDesc.configurable !== desc.configurable) {
      throw TypeError$3(`Conflicting definitions of ${name}`);
    }
  }
  defineProperty$2(obj, name, desc);
}
function initProperties(obj, descs) {
  for (const [name, desc] of entries(descs)) {
    initProperty(obj, name, desc);
  }
}
function sampleGlobals(globalObject, newPropertyNames) {
  const newIntrinsics = { __proto__: null };
  for (const [globalName, intrinsicName] of entries(newPropertyNames)) {
    if (hasOwn(globalObject, globalName)) {
      newIntrinsics[intrinsicName] = globalObject[globalName];
    }
  }
  return newIntrinsics;
}
const makeIntrinsicsCollector = (reporter) => {
  const intrinsics = create(null);
  let pseudoNatives;
  const addIntrinsics = (newIntrinsics) => {
    initProperties(intrinsics, getOwnPropertyDescriptors$1(newIntrinsics));
  };
  freeze$4(addIntrinsics);
  const completePrototypes = () => {
    for (const [name, intrinsic] of entries(intrinsics)) {
      if (isPrimitive(intrinsic)) {
        continue;
      }
      if (!hasOwn(intrinsic, "prototype")) {
        continue;
      }
      const permit = permitted[name];
      if (typeof permit !== "object") {
        throw TypeError$3(`Expected permit object at permits.${name}`);
      }
      const namePrototype = permit.prototype;
      if (!namePrototype) {
        cauterizeProperty(
          intrinsic,
          "prototype",
          false,
          `${name}.prototype`,
          reporter
        );
        continue;
      }
      if (typeof namePrototype !== "string" || !hasOwn(permitted, namePrototype)) {
        throw TypeError$3(`Unrecognized ${name}.prototype permits entry`);
      }
      const intrinsicPrototype = intrinsic.prototype;
      if (hasOwn(intrinsics, namePrototype)) {
        if (intrinsics[namePrototype] !== intrinsicPrototype) {
          throw TypeError$3(`Conflicting bindings of ${namePrototype}`);
        }
        continue;
      }
      intrinsics[namePrototype] = intrinsicPrototype;
    }
  };
  freeze$4(completePrototypes);
  const finalIntrinsics = () => {
    freeze$4(intrinsics);
    pseudoNatives = new WeakSet2(arrayFilter(values(intrinsics), isFunction));
    return intrinsics;
  };
  freeze$4(finalIntrinsics);
  const isPseudoNative = (obj) => {
    if (!pseudoNatives) {
      throw TypeError$3(
        "isPseudoNative can only be called after finalIntrinsics"
      );
    }
    return weaksetHas(pseudoNatives, obj);
  };
  freeze$4(isPseudoNative);
  const intrinsicsCollector = {
    addIntrinsics,
    completePrototypes,
    finalIntrinsics,
    isPseudoNative
  };
  freeze$4(intrinsicsCollector);
  addIntrinsics(constantProperties);
  addIntrinsics(sampleGlobals(universalThis, universalPropertyNames));
  return intrinsicsCollector;
};
const getGlobalIntrinsics = (globalObject, reporter) => {
  const { addIntrinsics, finalIntrinsics } = makeIntrinsicsCollector(reporter);
  addIntrinsics(sampleGlobals(globalObject, sharedGlobalPropertyNames));
  return finalIntrinsics();
};
function removeUnpermittedIntrinsics(intrinsics, markVirtualizedNativeFunction2, reporter) {
  const primitives = ["undefined", "boolean", "number", "string", "symbol"];
  const wellKnownSymbolNames = new Map$1(
    Symbol$2 ? arrayMap(
      arrayFilter(
        entries(permitted["%SharedSymbol%"]),
        ([name, permit]) => permit === "symbol" && typeof Symbol$2[name] === "symbol"
      ),
      ([name]) => [Symbol$2[name], `@@${name}`]
    ) : []
  );
  function asStringPropertyName(path, prop) {
    if (typeof prop === "string") {
      return prop;
    }
    const wellKnownSymbol = mapGet(wellKnownSymbolNames, prop);
    if (typeof prop === "symbol") {
      if (wellKnownSymbol) {
        return wellKnownSymbol;
      } else {
        const registeredKey = symbolKeyFor(prop);
        if (registeredKey !== void 0) {
          return `RegisteredSymbol(${registeredKey})`;
        } else {
          return `Unique${String$2(prop)}`;
        }
      }
    }
    throw TypeError$3(`Unexpected property name type ${path} ${prop}`);
  }
  function visitPrototype(path, obj, protoName) {
    if (isPrimitive(obj)) {
      throw TypeError$3(`Object expected: ${path}, ${String$2(obj)}, ${protoName}`);
    }
    const proto = getPrototypeOf$1(obj);
    if (proto === null && protoName === null) {
      return;
    }
    if (protoName !== void 0 && typeof protoName !== "string") {
      throw TypeError$3(`Malformed permit ${path}.__proto__`);
    }
    if (proto === intrinsics[protoName || "%ObjectPrototype%"]) {
      return;
    }
    throw TypeError$3(
      `Unexpected [[Prototype]] at ${path}.__proto__ (expected ${protoName || "%ObjectPrototype%"})`
    );
  }
  function isAllowedPropertyValue(path, value, prop, permit) {
    if (typeof permit === "object") {
      visitProperties(path, value, permit);
      return true;
    }
    if (permit === false) {
      return false;
    }
    if (typeof permit === "string") {
      if (prop === "prototype" || prop === "constructor") {
        if (hasOwn(intrinsics, permit)) {
          if (value !== intrinsics[permit]) {
            throw TypeError$3(`Does not match permit for ${path}`);
          }
          return true;
        }
      } else {
        if (arrayIncludes$1(primitives, permit)) {
          if (typeof value !== permit) {
            throw TypeError$3(
              `At ${path} expected ${permit} not ${typeof value}`
            );
          }
          return true;
        }
      }
    }
    throw TypeError$3(
      `Unexpected property ${prop} with permit ${permit} at ${path}`
    );
  }
  function isAllowedProperty(path, obj, prop, permit) {
    const desc = getOwnPropertyDescriptor$1(obj, prop);
    if (!desc) {
      throw TypeError$3(`Property ${prop} not found at ${path}`);
    }
    if (hasOwn(desc, "value")) {
      if (isAccessorPermit(permit)) {
        throw TypeError$3(`Accessor expected at ${path}`);
      }
      return isAllowedPropertyValue(path, desc.value, prop, permit);
    }
    if (!isAccessorPermit(permit)) {
      throw TypeError$3(`Accessor not expected at ${path}`);
    }
    return isAllowedPropertyValue(`${path}<get>`, desc.get, prop, permit.get) && isAllowedPropertyValue(`${path}<set>`, desc.set, prop, permit.set);
  }
  function getSubPermit(obj, permit, prop) {
    const permitProp = prop === "__proto__" ? "--proto--" : prop;
    if (hasOwn(permit, permitProp)) {
      return permit[permitProp];
    }
    if (typeof obj === "function") {
      if (hasOwn(FunctionInstance, permitProp)) {
        return FunctionInstance[permitProp];
      }
    }
    return void 0;
  }
  function visitProperties(path, obj, permit) {
    if (obj === void 0 || obj === null) {
      return;
    }
    const protoName = permit["[[Proto]]"];
    visitPrototype(path, obj, protoName);
    if (typeof obj === "function") {
      markVirtualizedNativeFunction2(obj);
    }
    for (const prop of ownKeys$2(obj)) {
      const propString = asStringPropertyName(path, prop);
      const subPath = `${path}.${propString}`;
      const subPermit = getSubPermit(obj, permit, propString);
      if (!subPermit || !isAllowedProperty(subPath, obj, prop, subPermit)) {
        cauterizeProperty(obj, prop, subPermit === false, subPath, reporter);
      }
    }
  }
  visitProperties("intrinsics", intrinsics, permitted);
}
function tameFunctionConstructors() {
  try {
    FERAL_FUNCTION.prototype.constructor("return 1");
  } catch (ignore) {
    return freeze$4({});
  }
  const newIntrinsics = {};
  function repairFunction(name, intrinsicName, declaration) {
    let FunctionInstance2;
    try {
      FunctionInstance2 = (0, eval)(declaration);
    } catch (e) {
      if (e instanceof SyntaxError$1) {
        return;
      }
      throw e;
    }
    const FunctionPrototype = getPrototypeOf$1(FunctionInstance2);
    const InertConstructor = function() {
      throw TypeError$3(
        "Function.prototype.constructor is not a valid constructor."
      );
    };
    defineProperties$1(InertConstructor, {
      prototype: { value: FunctionPrototype },
      name: {
        value: name,
        writable: false,
        enumerable: false,
        configurable: true
      }
    });
    defineProperties$1(FunctionPrototype, {
      constructor: { value: InertConstructor }
    });
    if (InertConstructor !== FERAL_FUNCTION.prototype.constructor) {
      setPrototypeOf(InertConstructor, FERAL_FUNCTION.prototype.constructor);
    }
    newIntrinsics[intrinsicName] = InertConstructor;
  }
  repairFunction("Function", "%InertFunction%", "(function(){})");
  repairFunction(
    "GeneratorFunction",
    "%InertGeneratorFunction%",
    "(function*(){})"
  );
  repairFunction(
    "AsyncFunction",
    "%InertAsyncFunction%",
    "(async function(){})"
  );
  if (AsyncGeneratorFunctionInstance !== void 0) {
    repairFunction(
      "AsyncGeneratorFunction",
      "%InertAsyncGeneratorFunction%",
      "(async function*(){})"
    );
  }
  return newIntrinsics;
}
function tameDateConstructor() {
  const OriginalDate = Date$1;
  const DatePrototype = OriginalDate.prototype;
  const tamedMethods2 = {
    /**
     * `%SharedDate%.now()` throw a `TypeError` starting with "secure mode".
     * See https://github.com/endojs/endo/issues/910#issuecomment-1581855420
     */
    now() {
      throw TypeError$3("secure mode Calling %SharedDate%.now() throws");
    }
  };
  const makeDateConstructor = ({ powers = "none" } = {}) => {
    let ResultDate;
    if (powers === "original") {
      ResultDate = function Date2(...rest) {
        if (new.target === void 0) {
          return apply$2(OriginalDate, void 0, rest);
        }
        return construct(OriginalDate, rest, new.target);
      };
    } else {
      ResultDate = function Date2(...rest) {
        if (new.target === void 0) {
          throw TypeError$3(
            "secure mode Calling %SharedDate% constructor as a function throws"
          );
        }
        if (rest.length === 0) {
          throw TypeError$3(
            "secure mode Calling new %SharedDate%() with no arguments throws"
          );
        }
        return construct(OriginalDate, rest, new.target);
      };
    }
    defineProperties$1(ResultDate, {
      length: { value: 7 },
      prototype: {
        value: DatePrototype,
        writable: false,
        enumerable: false,
        configurable: false
      },
      parse: {
        value: OriginalDate.parse,
        writable: true,
        enumerable: false,
        configurable: true
      },
      UTC: {
        value: OriginalDate.UTC,
        writable: true,
        enumerable: false,
        configurable: true
      }
    });
    return ResultDate;
  };
  const InitialDate = makeDateConstructor({ powers: "original" });
  const SharedDate = makeDateConstructor({ powers: "none" });
  defineProperties$1(InitialDate, {
    now: {
      value: OriginalDate.now,
      writable: true,
      enumerable: false,
      configurable: true
    }
  });
  defineProperties$1(SharedDate, {
    now: {
      value: tamedMethods2.now,
      writable: true,
      enumerable: false,
      configurable: true
    }
  });
  defineProperties$1(DatePrototype, {
    constructor: { value: SharedDate }
  });
  return {
    "%InitialDate%": InitialDate,
    "%SharedDate%": SharedDate
  };
}
function tameMathObject() {
  const originalMath = Math$1;
  const initialMath = originalMath;
  const { random: _, ...otherDescriptors } = getOwnPropertyDescriptors$1(originalMath);
  const tamedMethods2 = {
    /**
     * `%SharedMath%.random()` throws a TypeError starting with "secure mode".
     * See https://github.com/endojs/endo/issues/910#issuecomment-1581855420
     */
    random() {
      throw TypeError$3("secure mode %SharedMath%.random() throws");
    }
  };
  const sharedMath = create(objectPrototype, {
    ...otherDescriptors,
    random: {
      value: tamedMethods2.random,
      writable: true,
      enumerable: false,
      configurable: true
    }
  });
  return {
    "%InitialMath%": initialMath,
    "%SharedMath%": sharedMath
  };
}
function tameRegExpConstructor(regExpTaming = "safe") {
  const RegExpPrototype = FERAL_REG_EXP.prototype;
  const makeRegExpConstructor = (_ = {}) => {
    const ResultRegExp = function RegExp2(...rest) {
      if (new.target === void 0) {
        return FERAL_REG_EXP(...rest);
      }
      return construct(FERAL_REG_EXP, rest, new.target);
    };
    defineProperties$1(ResultRegExp, {
      length: { value: 2 },
      prototype: {
        value: RegExpPrototype,
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
    if (speciesSymbol) {
      const speciesDesc = getOwnPropertyDescriptor$1(
        FERAL_REG_EXP,
        speciesSymbol
      );
      if (!speciesDesc) {
        throw TypeError$3("no RegExp[Symbol.species] descriptor");
      }
      defineProperties$1(ResultRegExp, {
        [speciesSymbol]: speciesDesc
      });
    }
    return ResultRegExp;
  };
  const InitialRegExp = makeRegExpConstructor();
  const SharedRegExp = makeRegExpConstructor();
  if (regExpTaming !== "unsafe") {
    delete RegExpPrototype.compile;
  }
  defineProperties$1(RegExpPrototype, {
    constructor: { value: SharedRegExp }
  });
  return {
    "%InitialRegExp%": InitialRegExp,
    "%SharedRegExp%": SharedRegExp
  };
}
const minEnablements = {
  "%ObjectPrototype%": {
    toString: true
  },
  "%FunctionPrototype%": {
    toString: true
    // set by "rollup"
  },
  "%ErrorPrototype%": {
    name: true
    // set by "precond", "ava", "node-fetch"
  },
  "%IteratorPrototype%": {
    toString: true,
    // https://github.com/tc39/proposal-iterator-helpers
    constructor: true,
    // https://github.com/tc39/proposal-iterator-helpers
    [toStringTagSymbol$1]: true
  }
};
const moderateEnablements = {
  "%ObjectPrototype%": {
    toString: true,
    valueOf: true
  },
  "%ArrayPrototype%": {
    toString: true,
    push: true,
    // set by "Google Analytics"
    concat: true,
    // set by mobx generated code (old TS compiler?)
    [iteratorSymbol]: true
    // set by mobx generated code (old TS compiler?)
  },
  // Function.prototype has no 'prototype' property to enable.
  // Function instances have their own 'name' and 'length' properties
  // which are configurable and non-writable. Thus, they are already
  // non-assignable anyway.
  "%FunctionPrototype%": {
    constructor: true,
    // set by "regenerator-runtime"
    bind: true,
    // set by "underscore", "express"
    toString: true
    // set by "rollup"
  },
  "%ErrorPrototype%": {
    constructor: true,
    // set by "fast-json-patch", "node-fetch"
    message: true,
    name: true,
    // set by "precond", "ava", "node-fetch", "node 14"
    toString: true
    // set by "bluebird"
  },
  "%TypeErrorPrototype%": {
    constructor: true,
    // set by "readable-stream"
    message: true,
    // set by "tape"
    name: true
    // set by "readable-stream", "node 14"
  },
  "%SyntaxErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"
  },
  "%RangeErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"
  },
  "%URIErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"
  },
  "%EvalErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"
  },
  "%ReferenceErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"
  },
  // https://github.com/endojs/endo/issues/550
  "%AggregateErrorPrototype%": {
    message: true,
    // to match TypeErrorPrototype.message
    name: true
    // set by "node 14"?
  },
  "%PromisePrototype%": {
    constructor: true
    // set by "core-js"
  },
  "%TypedArrayPrototype%": "*",
  // set by https://github.com/feross/buffer
  "%Generator%": {
    constructor: true,
    name: true,
    toString: true
  },
  "%IteratorPrototype%": {
    toString: true,
    // https://github.com/tc39/proposal-iterator-helpers
    constructor: true,
    // https://github.com/tc39/proposal-iterator-helpers
    [toStringTagSymbol$1]: true
  }
};
const severeEnablements = {
  ...moderateEnablements,
  /**
   * Rollup (as used at least by vega) and webpack
   * (as used at least by regenerator) both turn exports into assignments
   * to a big `exports` object that inherits directly from
   * `Object.prototype`. Some of the exported names we've seen include
   * `hasOwnProperty`, `constructor`, and `toString`. But the strategy used
   * by rollup and webpack potentionally turns any exported name
   * into an assignment rejected by the override mistake. That's why
   * the `severe` enablements takes the extreme step of enabling
   * everything on `Object.prototype`.
   *
   * In addition, code doing inheritance manually will often override
   * the `constructor` property on the new prototype by assignment. We've
   * seen this several times.
   *
   * The cost of enabling all these is that they create a miserable debugging
   * experience specifically on Node.
   * https://github.com/Agoric/agoric-sdk/issues/2324
   * explains how it confused the Node console.
   *
   * (TODO Reexamine the vscode situation. I think it may have improved
   * since the following paragraph was written.)
   *
   * The vscode debugger's object inspector shows the own data properties of
   * an object, which is typically what you want, but also shows both getter
   * and setter for every accessor property whether inherited or own.
   * With the `'*'` setting here, all the properties inherited from
   * `Object.prototype` are accessors, creating an unusable display as seen
   * at As explained at
   * https://github.com/endojs/endo/blob/master/packages/ses/docs/lockdown.md#overridetaming-options
   * Open the triangles at the bottom of that section.
   */
  "%ObjectPrototype%": "*",
  /**
   * The widely used Buffer defined at https://github.com/feross/buffer
   * on initialization, manually creates the equivalent of a subclass of
   * `TypedArray`, which it then initializes by assignment. These assignments
   * include enough of the `TypeArray` methods that here, the `severe`
   * enablements just enable them all.
   */
  "%TypedArrayPrototype%": "*",
  /**
   * Needed to work with Immer before https://github.com/immerjs/immer/pull/914
   * is accepted.
   */
  "%MapPrototype%": "*",
  /**
   * Needed to work with Immer before https://github.com/immerjs/immer/pull/914
   * is accepted.
   */
  "%SetPrototype%": "*"
};
function enablePropertyOverrides(intrinsics, overrideTaming, { warn }, overrideDebug = []) {
  const debugProperties = new Set$1(overrideDebug);
  function enable(path, obj, prop, desc) {
    if ("value" in desc && desc.configurable) {
      const { value } = desc;
      const isDebug = setHas(debugProperties, prop);
      const { get: getter2, set: setter } = getOwnPropertyDescriptor$1(
        {
          get [prop]() {
            return value;
          },
          set [prop](newValue) {
            if (obj === this) {
              throw TypeError$3(
                `Cannot assign to read only property '${String$2(
                  prop
                )}' of '${path}'`
              );
            }
            if (hasOwn(this, prop)) {
              this[prop] = newValue;
            } else {
              if (isDebug) {
                warn(TypeError$3(`Override property ${prop}`));
              }
              defineProperty$2(this, prop, {
                value: newValue,
                writable: true,
                enumerable: true,
                configurable: true
              });
            }
          }
        },
        prop
      );
      defineProperty$2(getter2, "originalValue", {
        value,
        writable: false,
        enumerable: false,
        configurable: false
      });
      defineProperty$2(obj, prop, {
        get: getter2,
        set: setter,
        enumerable: desc.enumerable,
        configurable: desc.configurable
      });
    }
  }
  function enableProperty(path, obj, prop) {
    const desc = getOwnPropertyDescriptor$1(obj, prop);
    if (!desc) {
      return;
    }
    enable(path, obj, prop, desc);
  }
  function enableAllProperties(path, obj) {
    const descs = getOwnPropertyDescriptors$1(obj);
    if (!descs) {
      return;
    }
    arrayForEach(ownKeys$2(descs), (prop) => enable(path, obj, prop, descs[prop]));
  }
  function enableProperties(path, obj, plan2) {
    for (const prop of ownKeys$2(plan2)) {
      const desc = getOwnPropertyDescriptor$1(obj, prop);
      if (!desc || desc.get || desc.set) {
        continue;
      }
      const subPath = `${path}.${String$2(prop)}`;
      const subPlan = plan2[prop];
      if (subPlan === true) {
        enableProperty(subPath, obj, prop);
      } else if (subPlan === "*") {
        enableAllProperties(subPath, desc.value);
      } else if (!isPrimitive(subPlan)) {
        enableProperties(subPath, desc.value, subPlan);
      } else {
        throw TypeError$3(`Unexpected override enablement plan ${subPath}`);
      }
    }
  }
  let plan;
  switch (overrideTaming) {
    case "min": {
      plan = minEnablements;
      break;
    }
    case "moderate": {
      plan = moderateEnablements;
      break;
    }
    case "severe": {
      plan = severeEnablements;
      break;
    }
    default: {
      throw TypeError$3(`unrecognized overrideTaming ${overrideTaming}`);
    }
  }
  enableProperties("root", intrinsics, plan);
}
const { Fail: Fail$6, quote: q$5 } = assert;
const localePattern = /^(\w*[a-z])Locale([A-Z]\w*)$/;
const tamedMethods$1 = {
  // See https://tc39.es/ecma262/#sec-string.prototype.localecompare
  localeCompare(arg) {
    if (this === null || this === void 0) {
      throw TypeError$3(
        'Cannot localeCompare with null or undefined "this" value'
      );
    }
    const s = `${this}`;
    const that = `${arg}`;
    if (s < that) {
      return -1;
    }
    if (s > that) {
      return 1;
    }
    s === that || Fail$6`expected ${q$5(s)} and ${q$5(that)} to compare`;
    return 0;
  },
  toString() {
    return `${this}`;
  }
};
const nonLocaleCompare = tamedMethods$1.localeCompare;
const numberToString = tamedMethods$1.toString;
function tameLocaleMethods(intrinsics, localeTaming = "safe") {
  if (localeTaming === "unsafe") {
    return;
  }
  defineProperty$2(String$2.prototype, "localeCompare", {
    value: nonLocaleCompare
  });
  for (const intrinsicName of getOwnPropertyNames(intrinsics)) {
    const intrinsic = intrinsics[intrinsicName];
    if (!isPrimitive(intrinsic)) {
      for (const methodName of getOwnPropertyNames(intrinsic)) {
        const match = regexpExec(localePattern, methodName);
        if (match) {
          typeof intrinsic[methodName] === "function" || Fail$6`expected ${q$5(methodName)} to be a function`;
          const nonLocaleMethodName = `${match[1]}${match[2]}`;
          const method = intrinsic[nonLocaleMethodName];
          typeof method === "function" || Fail$6`function ${q$5(nonLocaleMethodName)} not found`;
          defineProperty$2(intrinsic, methodName, { value: method });
        }
      }
    }
  }
  defineProperty$2(Number$1.prototype, "toLocaleString", {
    value: numberToString
  });
}
const makeEvalFunction = (evaluator) => {
  const newEval = {
    eval(source) {
      if (typeof source !== "string") {
        return source;
      }
      return evaluator(source);
    }
  }.eval;
  return newEval;
};
const { Fail: Fail$5 } = assert;
const makeFunctionConstructor = (evaluator) => {
  const newFunction = function Function2(_body) {
    const bodyText = `${arrayPop(arguments) || ""}`;
    const parameters = `${arrayJoin(arguments, ",")}`;
    new FERAL_FUNCTION(parameters, "");
    new FERAL_FUNCTION(bodyText);
    const src = `(function anonymous(${parameters}
) {
${bodyText}
})`;
    return evaluator(src);
  };
  defineProperties$1(newFunction, {
    // Ensure that any function created in any evaluator in a realm is an
    // instance of Function in any evaluator of the same realm.
    prototype: {
      value: FERAL_FUNCTION.prototype,
      writable: false,
      enumerable: false,
      configurable: false
    }
  });
  getPrototypeOf$1(FERAL_FUNCTION) === FERAL_FUNCTION.prototype || Fail$5`Function prototype is the same accross compartments`;
  getPrototypeOf$1(newFunction) === FERAL_FUNCTION.prototype || Fail$5`Function constructor prototype is the same across compartments`;
  return newFunction;
};
const setGlobalObjectSymbolUnscopables = (globalObject) => {
  defineProperty$2(
    globalObject,
    unscopablesSymbol,
    freeze$4(
      assign(create(null), {
        set: freeze$4(() => {
          throw TypeError$3(
            `Cannot set Symbol.unscopables of a Compartment's globalThis`
          );
        }),
        enumerable: false,
        configurable: false
      })
    )
  );
};
const setGlobalObjectConstantProperties = (globalObject) => {
  for (const [name, constant] of entries(constantProperties)) {
    defineProperty$2(globalObject, name, {
      value: constant,
      writable: false,
      enumerable: false,
      configurable: false
    });
  }
};
const setGlobalObjectMutableProperties = (globalObject, {
  intrinsics,
  newGlobalPropertyNames,
  makeCompartmentConstructor: makeCompartmentConstructor2,
  markVirtualizedNativeFunction: markVirtualizedNativeFunction2,
  parentCompartment
}) => {
  for (const [name, intrinsicName] of entries(universalPropertyNames)) {
    if (hasOwn(intrinsics, intrinsicName)) {
      defineProperty$2(globalObject, name, {
        value: intrinsics[intrinsicName],
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }
  for (const [name, intrinsicName] of entries(newGlobalPropertyNames)) {
    if (hasOwn(intrinsics, intrinsicName)) {
      defineProperty$2(globalObject, name, {
        value: intrinsics[intrinsicName],
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
  }
  const perCompartmentGlobals = {
    globalThis: globalObject
  };
  perCompartmentGlobals.Compartment = freeze$4(
    makeCompartmentConstructor2(
      makeCompartmentConstructor2,
      intrinsics,
      markVirtualizedNativeFunction2,
      {
        parentCompartment,
        enforceNew: true
      }
    )
  );
  for (const [name, value] of entries(perCompartmentGlobals)) {
    defineProperty$2(globalObject, name, {
      value,
      writable: true,
      enumerable: false,
      configurable: true
    });
    if (typeof value === "function") {
      markVirtualizedNativeFunction2(value);
    }
  }
};
const setGlobalObjectEvaluators = (globalObject, evaluator, markVirtualizedNativeFunction2) => {
  {
    const f = freeze$4(makeEvalFunction(evaluator));
    markVirtualizedNativeFunction2(f);
    defineProperty$2(globalObject, "eval", {
      value: f,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
  {
    const f = freeze$4(makeFunctionConstructor(evaluator));
    markVirtualizedNativeFunction2(f);
    defineProperty$2(globalObject, "Function", {
      value: f,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }
};
const { Fail: Fail$4, quote: q$4 } = assert;
const objTarget$1 = freeze$4({ __proto__: null });
const alwaysThrowHandler = new Proxy2(
  objTarget$1,
  freeze$4({
    get(_shadow, prop) {
      Fail$4`Please report unexpected scope handler trap: ${q$4(String$2(prop))}`;
    }
  })
);
const scopeProxyHandlerProperties = {
  get(_shadow, _prop) {
    return void 0;
  },
  set(_shadow, prop, _value) {
    throw ReferenceError$1(`${String$2(prop)} is not defined`);
  },
  has(_shadow, prop) {
    return true;
  },
  // note: this is likely a bug of safari
  // https://bugs.webkit.org/show_bug.cgi?id=195534
  getPrototypeOf(_shadow) {
    return null;
  },
  // See https://github.com/endojs/endo/issues/1510
  // TODO: report as bug to v8 or Chrome, and record issue link here.
  getOwnPropertyDescriptor(_shadow, prop) {
    const quotedProp = q$4(String$2(prop));
    console.warn(
      `getOwnPropertyDescriptor trap on scopeTerminatorHandler for ${quotedProp}`,
      TypeError$3().stack
    );
    return void 0;
  },
  // See https://github.com/endojs/endo/issues/1490
  // TODO Report bug to JSC or Safari
  ownKeys(_shadow) {
    return [];
  }
};
const strictScopeTerminatorHandler = freeze$4(
  create(
    alwaysThrowHandler,
    getOwnPropertyDescriptors$1(scopeProxyHandlerProperties)
  )
);
const strictScopeTerminator = new Proxy2(
  objTarget$1,
  strictScopeTerminatorHandler
);
const objTarget = freeze$4({ __proto__: null });
const createSloppyGlobalsScopeTerminator = (globalObject) => {
  const scopeProxyHandlerProperties2 = {
    // inherit scopeTerminator behavior
    ...strictScopeTerminatorHandler,
    // Redirect set properties to the globalObject.
    set(_shadow, prop, value) {
      return reflectSet(globalObject, prop, value);
    },
    // Always claim to have a potential property in order to be the recipient of a set
    has(_shadow, _prop) {
      return true;
    }
  };
  const sloppyGlobalsScopeTerminatorHandler = freeze$4(
    create(
      alwaysThrowHandler,
      getOwnPropertyDescriptors$1(scopeProxyHandlerProperties2)
    )
  );
  const sloppyGlobalsScopeTerminator = new Proxy2(
    objTarget,
    sloppyGlobalsScopeTerminatorHandler
  );
  return sloppyGlobalsScopeTerminator;
};
freeze$4(createSloppyGlobalsScopeTerminator);
const { Fail: Fail$3 } = assert;
const makeEvalScopeKit = () => {
  const evalScope = create(null);
  const oneTimeEvalProperties = freeze$4({
    eval: {
      get() {
        delete evalScope.eval;
        return FERAL_EVAL;
      },
      enumerable: false,
      configurable: true
    }
  });
  const evalScopeKit = {
    evalScope,
    allowNextEvalToBeUnsafe() {
      const { revoked } = evalScopeKit;
      if (revoked !== null) {
        Fail$3`a handler did not reset allowNextEvalToBeUnsafe ${revoked.err}`;
      }
      defineProperties$1(evalScope, oneTimeEvalProperties);
    },
    /** @type {null | { err: any }} */
    revoked: null
  };
  return evalScopeKit;
};
const sourceMetaEntryRegExp = "\\s*[@#]\\s*([a-zA-Z][a-zA-Z0-9]*)\\s*=\\s*([^\\s\\*]*)";
const sourceMetaEntriesRegExp = new FERAL_REG_EXP(
  `(?:\\s*//${sourceMetaEntryRegExp}|/\\*${sourceMetaEntryRegExp}\\s*\\*/)\\s*$`
);
const getSourceURL = (src) => {
  let sourceURL = "<unknown>";
  while (src.length > 0) {
    const match = regexpExec(sourceMetaEntriesRegExp, src);
    if (match === null) {
      break;
    }
    src = stringSlice(src, 0, src.length - match[0].length);
    if (match[3] === "sourceURL") {
      sourceURL = match[4];
    } else if (match[1] === "sourceURL") {
      sourceURL = match[2];
    }
  }
  return sourceURL;
};
function getLineNumber(src, pattern) {
  const index = stringSearch(src, pattern);
  if (index < 0) {
    return -1;
  }
  const adjustment = src[index] === "\n" ? 1 : 0;
  return stringSplit$1(stringSlice(src, 0, index), "\n").length + adjustment;
}
const htmlCommentPattern = new FERAL_REG_EXP(`(?:${"<"}!--|--${">"})`, "g");
const rejectHtmlComments = (src) => {
  const lineNumber = getLineNumber(src, htmlCommentPattern);
  if (lineNumber < 0) {
    return src;
  }
  const name = getSourceURL(src);
  throw SyntaxError$1(
    `Possible HTML comment rejected at ${name}:${lineNumber}. (SES_HTML_COMMENT_REJECTED)`
  );
};
const evadeHtmlCommentTest = (src) => {
  const replaceFn = (match) => match[0] === "<" ? "< ! --" : "-- >";
  return stringReplace(src, htmlCommentPattern, replaceFn);
};
const importPattern = new FERAL_REG_EXP(
  "(^|[^.]|\\.\\.\\.)\\bimport(\\s*(?:\\(|/[/*]))",
  "g"
);
const rejectImportExpressions = (src) => {
  const lineNumber = getLineNumber(src, importPattern);
  if (lineNumber < 0) {
    return src;
  }
  const name = getSourceURL(src);
  throw SyntaxError$1(
    `Possible import expression rejected at ${name}:${lineNumber}. (SES_IMPORT_REJECTED)`
  );
};
const evadeImportExpressionTest = (src) => {
  const replaceFn = (_, p1, p2) => `${p1}__import__${p2}`;
  return stringReplace(src, importPattern, replaceFn);
};
const someDirectEvalPattern = new FERAL_REG_EXP(
  "(^|[^.])\\beval(\\s*\\()",
  "g"
);
const rejectSomeDirectEvalExpressions = (src) => {
  const lineNumber = getLineNumber(src, someDirectEvalPattern);
  if (lineNumber < 0) {
    return src;
  }
  const name = getSourceURL(src);
  throw SyntaxError$1(
    `Possible direct eval expression rejected at ${name}:${lineNumber}. (SES_EVAL_REJECTED)`
  );
};
const mandatoryTransforms = (source) => {
  source = rejectHtmlComments(source);
  source = rejectImportExpressions(source);
  return source;
};
const applyTransforms = (source, transforms) => {
  for (let i = 0, l = transforms.length; i < l; i += 1) {
    const transform = transforms[i];
    source = transform(source);
  }
  return source;
};
freeze$4({
  rejectHtmlComments: freeze$4(rejectHtmlComments),
  evadeHtmlCommentTest: freeze$4(evadeHtmlCommentTest),
  rejectImportExpressions: freeze$4(rejectImportExpressions),
  evadeImportExpressionTest: freeze$4(evadeImportExpressionTest),
  rejectSomeDirectEvalExpressions: freeze$4(rejectSomeDirectEvalExpressions),
  mandatoryTransforms: freeze$4(mandatoryTransforms),
  applyTransforms: freeze$4(applyTransforms)
});
const keywords = [
  // 11.6.2.1 Keywords
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  // Also reserved when parsing strict mode code
  "let",
  "static",
  // 11.6.2.2 Future Reserved Words
  "enum",
  // Also reserved when parsing strict mode code
  "implements",
  "package",
  "protected",
  "interface",
  "private",
  "public",
  // Reserved but not mentioned in specs
  "await",
  "null",
  "true",
  "false",
  "this",
  "arguments"
];
const identifierPattern = /^[a-zA-Z_$][\w$]*$/;
const isValidIdentifierName = (name) => {
  return name !== "eval" && !arrayIncludes$1(keywords, name) && regexpTest(identifierPattern, name);
};
function isImmutableDataProperty(obj, name) {
  const desc = getOwnPropertyDescriptor$1(obj, name);
  return desc && //
  // The getters will not have .writable, don't let the falsyness of
  // 'undefined' trick us: test with === false, not ! . However descriptors
  // inherit from the (potentially poisoned) global object, so we might see
  // extra properties which weren't really there. Accessor properties have
  // 'get/set/enumerable/configurable', while data properties have
  // 'value/writable/enumerable/configurable'.
  desc.configurable === false && desc.writable === false && //
  // Checks for data properties because they're the only ones we can
  // optimize (accessors are most likely non-constant). Descriptors can't
  // can't have accessors and value properties at the same time, therefore
  // this check is sufficient. Using explicit own property deal with the
  // case where Object.prototype has been poisoned.
  hasOwn(desc, "value");
}
const getScopeConstants = (globalObject, moduleLexicals = {}) => {
  const globalObjectNames = getOwnPropertyNames(globalObject);
  const moduleLexicalNames = getOwnPropertyNames(moduleLexicals);
  const moduleLexicalConstants = arrayFilter(
    moduleLexicalNames,
    (name) => isValidIdentifierName(name) && isImmutableDataProperty(moduleLexicals, name)
  );
  const globalObjectConstants = arrayFilter(
    globalObjectNames,
    (name) => (
      // Can't define a constant: it would prevent a
      // lookup on the endowments.
      !arrayIncludes$1(moduleLexicalNames, name) && isValidIdentifierName(name) && isImmutableDataProperty(globalObject, name)
    )
  );
  return {
    globalObjectConstants,
    moduleLexicalConstants
  };
};
function buildOptimizer(constants, name) {
  if (constants.length === 0) return "";
  return `const {${arrayJoin(constants, ",")}} = this.${name};`;
}
const makeEvaluate = (context) => {
  const { globalObjectConstants, moduleLexicalConstants } = getScopeConstants(
    context.globalObject,
    context.moduleLexicals
  );
  const globalObjectOptimizer = buildOptimizer(
    globalObjectConstants,
    "globalObject"
  );
  const moduleLexicalOptimizer = buildOptimizer(
    moduleLexicalConstants,
    "moduleLexicals"
  );
  const evaluateFactory = FERAL_FUNCTION(`
    with (this.scopeTerminator) {
      with (this.globalObject) {
        with (this.moduleLexicals) {
          with (this.evalScope) {
            ${globalObjectOptimizer}
            ${moduleLexicalOptimizer}
            return function() {
              'use strict';
              return eval(arguments[0]);
            };
          }
        }
      }
    }
  `);
  return apply$2(evaluateFactory, context, []);
};
const { Fail: Fail$2 } = assert;
const makeSafeEvaluator = ({
  globalObject,
  moduleLexicals = {},
  globalTransforms = [],
  sloppyGlobalsMode = false
}) => {
  const scopeTerminator = sloppyGlobalsMode ? createSloppyGlobalsScopeTerminator(globalObject) : strictScopeTerminator;
  const evalScopeKit = makeEvalScopeKit();
  const { evalScope } = evalScopeKit;
  const evaluateContext = freeze$4({
    evalScope,
    moduleLexicals,
    globalObject,
    scopeTerminator
  });
  let evaluate;
  const provideEvaluate = () => {
    if (!evaluate) {
      evaluate = makeEvaluate(evaluateContext);
    }
  };
  const safeEvaluate = (source, options) => {
    const { localTransforms = [] } = options || {};
    provideEvaluate();
    source = applyTransforms(
      source,
      arrayFlatMap(
        [localTransforms, globalTransforms, [mandatoryTransforms]],
        identity
      )
    );
    let err;
    try {
      evalScopeKit.allowNextEvalToBeUnsafe();
      return apply$2(evaluate, globalObject, [source]);
    } catch (e) {
      err = e;
      throw e;
    } finally {
      const unsafeEvalWasStillExposed = "eval" in evalScope;
      delete evalScope.eval;
      if (unsafeEvalWasStillExposed) {
        evalScopeKit.revoked = { err };
        Fail$2`handler did not reset allowNextEvalToBeUnsafe ${err}`;
      }
    }
  };
  return { safeEvaluate };
};
const nativeSuffix = ") { [native code] }";
let markVirtualizedNativeFunction$1;
const tameFunctionToString = () => {
  if (markVirtualizedNativeFunction$1 === void 0) {
    const virtualizedNativeFunctions = new WeakSet2();
    const tamingMethods = {
      toString() {
        const str = functionToString(this);
        if (stringEndsWith(str, nativeSuffix) || !weaksetHas(virtualizedNativeFunctions, this)) {
          return str;
        }
        return `function ${this.name}() { [native code] }`;
      }
    };
    defineProperty$2(functionPrototype, "toString", {
      value: tamingMethods.toString
    });
    markVirtualizedNativeFunction$1 = freeze$4(
      (func) => weaksetAdd(virtualizedNativeFunctions, func)
    );
  }
  return markVirtualizedNativeFunction$1;
};
function tameDomains(domainTaming = "safe") {
  if (domainTaming === "unsafe") {
    return;
  }
  const globalProcess = universalThis.process || void 0;
  if (typeof globalProcess === "object") {
    const domainDescriptor = getOwnPropertyDescriptor$1(globalProcess, "domain");
    if (domainDescriptor !== void 0 && domainDescriptor.get !== void 0) {
      throw TypeError$3(
        `SES failed to lockdown, Node.js domains have been initialized (SES_NO_DOMAINS)`
      );
    }
    defineProperty$2(globalProcess, "domain", {
      value: null,
      configurable: false,
      writable: false,
      enumerable: false
    });
  }
}
const tameModuleSource = () => {
  const newIntrinsics = {};
  const ModuleSource = universalThis.ModuleSource;
  if (ModuleSource !== void 0) {
    let AbstractModuleSource = function() {
    };
    newIntrinsics.ModuleSource = ModuleSource;
    const ModuleSourceProto = getPrototypeOf$1(ModuleSource);
    if (ModuleSourceProto === functionPrototype) {
      setPrototypeOf(ModuleSource, AbstractModuleSource);
      newIntrinsics["%AbstractModuleSource%"] = AbstractModuleSource;
      newIntrinsics["%AbstractModuleSourcePrototype%"] = AbstractModuleSource.prototype;
    } else {
      newIntrinsics["%AbstractModuleSource%"] = ModuleSourceProto;
      newIntrinsics["%AbstractModuleSourcePrototype%"] = ModuleSourceProto.prototype;
    }
    const ModuleSourcePrototype = ModuleSource.prototype;
    if (ModuleSourcePrototype !== void 0) {
      newIntrinsics["%ModuleSourcePrototype%"] = ModuleSourcePrototype;
      const ModuleSourcePrototypeProto = getPrototypeOf$1(ModuleSourcePrototype);
      if (ModuleSourcePrototypeProto === objectPrototype) {
        setPrototypeOf(ModuleSource.prototype, AbstractModuleSource.prototype);
      }
    }
  }
  return newIntrinsics;
};
const defineName = (name, fn2) => defineProperty$2(fn2, "name", { value: name });
const consoleLevelMethods = freeze$4([
  ["debug", "debug"],
  // (fmt?, ...args) verbose level on Chrome
  ["log", "log"],
  // (fmt?, ...args) info level on Chrome
  ["info", "info"],
  // (fmt?, ...args)
  ["warn", "warn"],
  // (fmt?, ...args)
  ["error", "error"],
  // (fmt?, ...args)
  ["trace", "log"],
  // (fmt?, ...args)
  ["dirxml", "log"],
  // (fmt?, ...args)          but TS typed (...data)
  ["group", "log"],
  // (fmt?, ...args)           but TS typed (...label)
  ["groupCollapsed", "log"]
  // (fmt?, ...args)  but TS typed (...label)
]);
const consoleOtherMethods = freeze$4([
  ["assert", "error"],
  // (value, fmt?, ...args)
  ["timeLog", "log"],
  // (label?, ...args) no fmt string
  // Insensitive to whether any argument is an error. All arguments can pass
  // thru to baseConsole as is.
  ["clear", void 0],
  // ()
  ["count", "info"],
  // (label?)
  ["countReset", void 0],
  // (label?)
  ["dir", "log"],
  // (item, options?)
  ["groupEnd", "log"],
  // ()
  // In theory tabular data may be or contain an error. However, we currently
  // do not detect these and may never.
  ["table", "log"],
  // (tabularData, properties?)
  ["time", "info"],
  // (label?)
  ["timeEnd", "info"],
  // (label?)
  // Node Inspector only, MDN, and TypeScript, but not whatwg
  ["profile", void 0],
  // (label?)
  ["profileEnd", void 0],
  // (label?)
  ["timeStamp", void 0]
  // (label?)
]);
freeze$4([
  ...consoleLevelMethods,
  ...consoleOtherMethods
]);
const ErrorInfo = {
  NOTE: "ERROR_NOTE:",
  MESSAGE: "ERROR_MESSAGE:",
  CAUSE: "cause:",
  ERRORS: "errors:"
};
freeze$4(ErrorInfo);
const makeCausalConsole = (baseConsole, loggedErrorHandler2) => {
  if (!baseConsole) {
    return void 0;
  }
  const { getStackString, tagError: tagError2, takeMessageLogArgs, takeNoteLogArgsArray } = loggedErrorHandler2;
  const extractErrorArgs = (logArgs, subErrorsSink) => {
    const argTags = arrayMap(logArgs, (arg) => {
      if (isError(arg)) {
        arrayPush$1(subErrorsSink, arg);
        return `(${tagError2(arg)})`;
      }
      return arg;
    });
    return argTags;
  };
  const logErrorInfo = (severity, error, kind, logArgs, subErrorsSink) => {
    const errorTag = tagError2(error);
    const errorName = kind === ErrorInfo.MESSAGE ? `${errorTag}:` : `${errorTag} ${kind}`;
    const argTags = extractErrorArgs(logArgs, subErrorsSink);
    baseConsole[severity](errorName, ...argTags);
  };
  const logSubErrors = (severity, subErrors, optTag = void 0) => {
    if (subErrors.length === 0) {
      return;
    }
    if (subErrors.length === 1 && optTag === void 0) {
      logError(severity, subErrors[0]);
      return;
    }
    let label;
    if (subErrors.length === 1) {
      label = `Nested error`;
    } else {
      label = `Nested ${subErrors.length} errors`;
    }
    if (optTag !== void 0) {
      label = `${label} under ${optTag}`;
    }
    baseConsole.group(label);
    try {
      for (const subError of subErrors) {
        logError(severity, subError);
      }
    } finally {
      if (baseConsole.groupEnd) {
        baseConsole.groupEnd();
      }
    }
  };
  const errorsLogged = new WeakSet2();
  const makeNoteCallback = (severity) => (error, noteLogArgs) => {
    const subErrors = [];
    logErrorInfo(severity, error, ErrorInfo.NOTE, noteLogArgs, subErrors);
    logSubErrors(severity, subErrors, tagError2(error));
  };
  const logError = (severity, error) => {
    if (weaksetHas(errorsLogged, error)) {
      return;
    }
    const errorTag = tagError2(error);
    weaksetAdd(errorsLogged, error);
    const subErrors = [];
    const messageLogArgs = takeMessageLogArgs(error);
    const noteLogArgsArray = takeNoteLogArgsArray(
      error,
      makeNoteCallback(severity)
    );
    if (messageLogArgs === void 0) {
      baseConsole[severity](`${errorTag}:`, error.message);
    } else {
      logErrorInfo(
        severity,
        error,
        ErrorInfo.MESSAGE,
        messageLogArgs,
        subErrors
      );
    }
    let stackString = getStackString(error);
    if (typeof stackString === "string" && stackString.length >= 1 && !stringEndsWith(stackString, "\n")) {
      stackString += "\n";
    }
    baseConsole[severity](stackString);
    if (error.cause) {
      logErrorInfo(severity, error, ErrorInfo.CAUSE, [error.cause], subErrors);
    }
    if (error.errors) {
      logErrorInfo(severity, error, ErrorInfo.ERRORS, error.errors, subErrors);
    }
    for (const noteLogArgs of noteLogArgsArray) {
      logErrorInfo(severity, error, ErrorInfo.NOTE, noteLogArgs, subErrors);
    }
    logSubErrors(severity, subErrors, errorTag);
  };
  const levelMethods = arrayMap(consoleLevelMethods, ([level, _]) => {
    const levelMethod = defineName(level, (...logArgs) => {
      const subErrors = [];
      const argTags = extractErrorArgs(logArgs, subErrors);
      if (baseConsole[level]) {
        baseConsole[level](...argTags);
      }
      logSubErrors(level, subErrors);
    });
    return [level, freeze$4(levelMethod)];
  });
  const otherMethodNames = arrayFilter(
    consoleOtherMethods,
    ([name, _]) => name in baseConsole
  );
  const otherMethods = arrayMap(otherMethodNames, ([name, _]) => {
    const otherMethod = defineName(name, (...args) => {
      baseConsole[name](...args);
      return void 0;
    });
    return [name, freeze$4(otherMethod)];
  });
  const causalConsole = fromEntries([...levelMethods, ...otherMethods]);
  return (
    /** @type {VirtualConsole} */
    freeze$4(causalConsole)
  );
};
freeze$4(makeCausalConsole);
const indentAfterAllSeps = (str, sep, indents) => {
  const [firstLine, ...restLines] = stringSplit$1(str, sep);
  const indentedRest = arrayFlatMap(restLines, (line) => [sep, ...indents, line]);
  return ["", firstLine, ...indentedRest];
};
const defineCausalConsoleFromLogger = (loggedErrorHandler2) => {
  const makeCausalConsoleFromLogger = (tlogger) => {
    const indents = [];
    const logWithIndent = (...args) => {
      if (indents.length > 0) {
        args = arrayFlatMap(
          args,
          (arg) => typeof arg === "string" && stringIncludes(arg, "\n") ? indentAfterAllSeps(arg, "\n", indents) : [arg]
        );
        args = [...indents, ...args];
      }
      return tlogger(...args);
    };
    const baseConsole = fromEntries([
      ...arrayMap(consoleLevelMethods, ([name]) => [
        name,
        defineName(name, (...args) => logWithIndent(...args))
      ]),
      ...arrayMap(consoleOtherMethods, ([name]) => [
        name,
        defineName(name, (...args) => logWithIndent(name, ...args))
      ])
    ]);
    for (const name of ["group", "groupCollapsed"]) {
      if (baseConsole[name]) {
        baseConsole[name] = defineName(name, (...args) => {
          if (args.length >= 1) {
            logWithIndent(...args);
          }
          arrayPush$1(indents, " ");
        });
      } else {
        baseConsole[name] = defineName(name, () => {
        });
      }
    }
    baseConsole.groupEnd = defineName(
      "groupEnd",
      baseConsole.groupEnd ? (...args) => {
        arrayPop(indents);
      } : () => {
      }
    );
    harden(baseConsole);
    const causalConsole = makeCausalConsole(
      /** @type {VirtualConsole} */
      baseConsole,
      loggedErrorHandler2
    );
    return (
      /** @type {VirtualConsole} */
      causalConsole
    );
  };
  return freeze$4(makeCausalConsoleFromLogger);
};
freeze$4(defineCausalConsoleFromLogger);
const makeRejectionHandlers = (reportReason) => {
  if (FinalizationRegistry === void 0) {
    return void 0;
  }
  let lastReasonId = 0;
  const idToReason = new Map$1();
  const removeReasonId = (reasonId) => {
    mapDelete(idToReason, reasonId);
  };
  const promiseToReasonId = new WeakMap$2();
  const finalizeDroppedPromise = (heldReasonId) => {
    if (mapHas(idToReason, heldReasonId)) {
      const reason = mapGet(idToReason, heldReasonId);
      removeReasonId(heldReasonId);
      reportReason(reason);
    }
  };
  const promiseToReason = new FinalizationRegistry(finalizeDroppedPromise);
  const unhandledRejectionHandler = (reason, pr) => {
    lastReasonId += 1;
    const reasonId = lastReasonId;
    mapSet(idToReason, reasonId, reason);
    weakmapSet(promiseToReasonId, pr, reasonId);
    finalizationRegistryRegister(promiseToReason, pr, reasonId, pr);
  };
  const rejectionHandledHandler = (pr) => {
    const reasonId = weakmapGet(promiseToReasonId, pr);
    removeReasonId(reasonId);
  };
  const processTerminationHandler = () => {
    for (const [reasonId, reason] of mapEntries(idToReason)) {
      removeReasonId(reasonId);
      reportReason(reason);
    }
  };
  return {
    rejectionHandledHandler,
    unhandledRejectionHandler,
    processTerminationHandler
  };
};
const failFast = (message) => {
  throw TypeError$3(message);
};
const wrapLogger = (logger, thisArg) => freeze$4((...args) => apply$2(logger, thisArg, args));
const tameConsole = (consoleTaming = "safe", errorTrapping = "platform", unhandledRejectionTrapping = "report", optGetStackString = void 0) => {
  let loggedErrorHandler$1;
  if (optGetStackString === void 0) {
    loggedErrorHandler$1 = loggedErrorHandler;
  } else {
    loggedErrorHandler$1 = {
      ...loggedErrorHandler,
      getStackString: optGetStackString
    };
  }
  const originalConsole = (
    /** @type {VirtualConsole} */
    // eslint-disable-next-line no-nested-ternary
    typeof universalThis.console !== "undefined" ? universalThis.console : typeof universalThis.print === "function" ? (
      // Make a good-enough console for eshost (including only functions that
      // log at a specific level with no special argument interpretation).
      // https://console.spec.whatwg.org/#logging
      ((p) => freeze$4({ debug: p, log: p, info: p, warn: p, error: p }))(
        // eslint-disable-next-line no-undef
        wrapLogger(universalThis.print)
      )
    ) : void 0
  );
  if (originalConsole && originalConsole.log) {
    for (const methodName of ["warn", "error"]) {
      if (!originalConsole[methodName]) {
        defineProperty$2(originalConsole, methodName, {
          value: wrapLogger(originalConsole.log, originalConsole)
        });
      }
    }
  }
  const ourConsole = (
    /** @type {VirtualConsole} */
    consoleTaming === "unsafe" ? originalConsole : makeCausalConsole(originalConsole, loggedErrorHandler$1)
  );
  const globalProcess = universalThis.process || void 0;
  if (errorTrapping !== "none" && typeof globalProcess === "object" && typeof globalProcess.on === "function") {
    let terminate;
    if (errorTrapping === "platform" || errorTrapping === "exit") {
      const { exit } = globalProcess;
      typeof exit === "function" || failFast("missing process.exit");
      terminate = () => exit(globalProcess.exitCode || -1);
    } else if (errorTrapping === "abort") {
      terminate = globalProcess.abort;
      typeof terminate === "function" || failFast("missing process.abort");
    }
    globalProcess.on("uncaughtException", (error) => {
      ourConsole.error("SES_UNCAUGHT_EXCEPTION:", error);
      if (terminate) {
        terminate();
      }
    });
  }
  if (unhandledRejectionTrapping !== "none" && typeof globalProcess === "object" && typeof globalProcess.on === "function") {
    const handleRejection = (reason) => {
      ourConsole.error("SES_UNHANDLED_REJECTION:", reason);
    };
    const h = makeRejectionHandlers(handleRejection);
    if (h) {
      globalProcess.on("unhandledRejection", h.unhandledRejectionHandler);
      globalProcess.on("rejectionHandled", h.rejectionHandledHandler);
      globalProcess.on("exit", h.processTerminationHandler);
    }
  }
  const globalWindow = universalThis.window || void 0;
  if (errorTrapping !== "none" && typeof globalWindow === "object" && typeof globalWindow.addEventListener === "function") {
    globalWindow.addEventListener("error", (event) => {
      event.preventDefault();
      ourConsole.error("SES_UNCAUGHT_EXCEPTION:", event.error);
      if (errorTrapping === "exit" || errorTrapping === "abort") {
        globalWindow.location.href = `about:blank`;
      }
    });
  }
  if (unhandledRejectionTrapping !== "none" && typeof globalWindow === "object" && typeof globalWindow.addEventListener === "function") {
    const handleRejection = (reason) => {
      ourConsole.error("SES_UNHANDLED_REJECTION:", reason);
    };
    const h = makeRejectionHandlers(handleRejection);
    if (h) {
      globalWindow.addEventListener("unhandledrejection", (event) => {
        event.preventDefault();
        h.unhandledRejectionHandler(event.reason, event.promise);
      });
      globalWindow.addEventListener("rejectionhandled", (event) => {
        event.preventDefault();
        h.rejectionHandledHandler(event.promise);
      });
      globalWindow.addEventListener("beforeunload", (_event) => {
        h.processTerminationHandler();
      });
    }
  }
  return { console: ourConsole };
};
const safeV8CallSiteMethodNames = [
  // suppress 'getThis' definitely
  "getTypeName",
  // suppress 'getFunction' definitely
  "getFunctionName",
  "getMethodName",
  "getFileName",
  "getLineNumber",
  "getColumnNumber",
  "getEvalOrigin",
  "isToplevel",
  "isEval",
  "isNative",
  "isConstructor",
  "isAsync",
  // suppress 'isPromiseAll' for now
  // suppress 'getPromiseIndex' for now
  // Additional names found by experiment, absent from
  // https://v8.dev/docs/stack-trace-api
  "getPosition",
  "getScriptNameOrSourceURL",
  "toString"
  // TODO replace to use only permitted info
];
const safeV8CallSiteFacet = (callSite) => {
  const methodEntry = (name) => {
    const method = callSite[name];
    return [name, () => apply$2(method, callSite, [])];
  };
  const o = fromEntries(arrayMap(safeV8CallSiteMethodNames, methodEntry));
  return create(o, {});
};
const safeV8SST = (sst) => arrayMap(sst, safeV8CallSiteFacet);
const FILENAME_NODE_DEPENDENTS_CENSOR = /\/node_modules\//;
const FILENAME_NODE_INTERNALS_CENSOR = /^(?:node:)?internal\//;
const FILENAME_ASSERT_CENSOR = /\/packages\/ses\/src\/error\/assert\.js$/;
const FILENAME_EVENTUAL_SEND_CENSOR = /\/packages\/eventual-send\/src\//;
const FILENAME_SES_AVA_CENSOR = /\/packages\/ses-ava\/src\/ses-ava-test\.js$/;
const FILENAME_CENSORS = [
  FILENAME_NODE_DEPENDENTS_CENSOR,
  FILENAME_NODE_INTERNALS_CENSOR,
  FILENAME_ASSERT_CENSOR,
  FILENAME_EVENTUAL_SEND_CENSOR,
  FILENAME_SES_AVA_CENSOR
];
const filterFileName = (fileName) => {
  if (!fileName) {
    return true;
  }
  for (const filter of FILENAME_CENSORS) {
    if (regexpTest(filter, fileName)) {
      return false;
    }
  }
  return true;
};
const CALLSITE_ELLIPSIS_PATTERN1 = /^((?:.*[( ])?)[:/\w_-]*\/\.\.\.\/(.+)$/;
const CALLSITE_ELLIPSIS_PATTERN2 = /^((?:.*[( ])?)\.\.\.\/(.+)$/;
const CALLSITE_PACKAGES_PATTERN = /^((?:.*[( ])?)[:/\w_-]*\/(packages\/.+)$/;
const CALLSITE_FILE_2SLASH_PATTERN = /^((?:.*[( ])?)file:\/\/([^/].*)$/;
const CALLSITE_PATTERNS = [
  CALLSITE_ELLIPSIS_PATTERN1,
  CALLSITE_ELLIPSIS_PATTERN2,
  CALLSITE_PACKAGES_PATTERN,
  CALLSITE_FILE_2SLASH_PATTERN
];
const shortenCallSiteString = (callSiteString) => {
  for (const filter of CALLSITE_PATTERNS) {
    const match = regexpExec(filter, callSiteString);
    if (match) {
      return arrayJoin(arraySlice(match, 1), "");
    }
  }
  return callSiteString;
};
const tameV8ErrorConstructor = (OriginalError, InitialError, errorTaming, stackFiltering) => {
  if (errorTaming === "unsafe-debug") {
    throw TypeError$3(
      "internal: v8+unsafe-debug special case should already be done"
    );
  }
  const originalCaptureStackTrace = OriginalError.captureStackTrace;
  const omitFrames = stackFiltering === "concise" || stackFiltering === "omit-frames";
  const shortenPaths = stackFiltering === "concise" || stackFiltering === "shorten-paths";
  const callSiteFilter = (callSite) => {
    if (omitFrames) {
      return filterFileName(callSite.getFileName());
    }
    return true;
  };
  const callSiteStringifier = (callSite) => {
    let callSiteString = `${callSite}`;
    if (shortenPaths) {
      callSiteString = shortenCallSiteString(callSiteString);
    }
    return `
  at ${callSiteString}`;
  };
  const stackStringFromSST = (_error, sst) => arrayJoin(
    arrayMap(arrayFilter(sst, callSiteFilter), callSiteStringifier),
    ""
  );
  const stackInfos = new WeakMap$2();
  const tamedMethods2 = {
    // The optional `optFn` argument is for cutting off the bottom of
    // the stack --- for capturing the stack only above the topmost
    // call to that function. Since this isn't the "real" captureStackTrace
    // but instead calls the real one, if no other cutoff is provided,
    // we cut this one off.
    captureStackTrace(error, optFn = tamedMethods2.captureStackTrace) {
      if (typeof originalCaptureStackTrace === "function") {
        apply$2(originalCaptureStackTrace, OriginalError, [error, optFn]);
        return;
      }
      reflectSet(error, "stack", "");
    },
    // Shim of proposed special power, to reside by default only
    // in the start compartment, for getting the stack traceback
    // string associated with an error.
    // See https://tc39.es/proposal-error-stacks/
    getStackString(error) {
      let stackInfo = weakmapGet(stackInfos, error);
      if (stackInfo === void 0) {
        void error.stack;
        stackInfo = weakmapGet(stackInfos, error);
        if (!stackInfo) {
          stackInfo = { stackString: "" };
          weakmapSet(stackInfos, error, stackInfo);
        }
      }
      if (stackInfo.stackString !== void 0) {
        return stackInfo.stackString;
      }
      const stackString = stackStringFromSST(error, stackInfo.callSites);
      weakmapSet(stackInfos, error, { stackString });
      return stackString;
    },
    prepareStackTrace(error, sst) {
      if (errorTaming === "unsafe") {
        const stackString = stackStringFromSST(error, sst);
        weakmapSet(stackInfos, error, { stackString });
        return `${error}${stackString}`;
      } else {
        weakmapSet(stackInfos, error, { callSites: sst });
        return "";
      }
    }
  };
  const defaultPrepareFn = tamedMethods2.prepareStackTrace;
  OriginalError.prepareStackTrace = defaultPrepareFn;
  const systemPrepareFnSet = new WeakSet2([defaultPrepareFn]);
  const systemPrepareFnFor = (inputPrepareFn) => {
    if (weaksetHas(systemPrepareFnSet, inputPrepareFn)) {
      return inputPrepareFn;
    }
    const systemMethods = {
      prepareStackTrace(error, sst) {
        weakmapSet(stackInfos, error, { callSites: sst });
        return inputPrepareFn(error, safeV8SST(sst));
      }
    };
    weaksetAdd(systemPrepareFnSet, systemMethods.prepareStackTrace);
    return systemMethods.prepareStackTrace;
  };
  defineProperties$1(InitialError, {
    captureStackTrace: {
      value: tamedMethods2.captureStackTrace,
      writable: true,
      enumerable: false,
      configurable: true
    },
    prepareStackTrace: {
      get() {
        return OriginalError.prepareStackTrace;
      },
      set(inputPrepareStackTraceFn) {
        if (typeof inputPrepareStackTraceFn === "function") {
          const systemPrepareFn = systemPrepareFnFor(inputPrepareStackTraceFn);
          OriginalError.prepareStackTrace = systemPrepareFn;
        } else {
          OriginalError.prepareStackTrace = defaultPrepareFn;
        }
      },
      enumerable: false,
      configurable: true
    }
  });
  return tamedMethods2.getStackString;
};
const stackDesc = getOwnPropertyDescriptor$1(FERAL_ERROR.prototype, "stack");
const stackGetter = stackDesc && stackDesc.get;
const tamedMethods = {
  getStackString(error) {
    if (typeof stackGetter === "function") {
      return apply$2(stackGetter, error, []);
    } else if ("stack" in error) {
      return `${error.stack}`;
    }
    return "";
  }
};
let initialGetStackString = tamedMethods.getStackString;
function tameErrorConstructor(errorTaming = "safe", stackFiltering = "concise") {
  const ErrorPrototype = FERAL_ERROR.prototype;
  const { captureStackTrace: originalCaptureStackTrace } = FERAL_ERROR;
  const platform = typeof originalCaptureStackTrace === "function" ? "v8" : "unknown";
  const makeErrorConstructor = (_ = {}) => {
    const ResultError = function Error2(...rest) {
      let error;
      if (new.target === void 0) {
        error = apply$2(FERAL_ERROR, this, rest);
      } else {
        error = construct(FERAL_ERROR, rest, new.target);
      }
      if (platform === "v8") {
        apply$2(originalCaptureStackTrace, FERAL_ERROR, [error, ResultError]);
      }
      return error;
    };
    defineProperties$1(ResultError, {
      length: { value: 1 },
      prototype: {
        value: ErrorPrototype,
        writable: false,
        enumerable: false,
        configurable: false
      }
    });
    return ResultError;
  };
  const InitialError = makeErrorConstructor({});
  const SharedError = makeErrorConstructor({});
  defineProperties$1(ErrorPrototype, {
    constructor: { value: SharedError }
  });
  for (const NativeError2 of NativeErrors) {
    setPrototypeOf(NativeError2, SharedError);
  }
  defineProperties$1(InitialError, {
    stackTraceLimit: {
      get() {
        if (typeof FERAL_ERROR.stackTraceLimit === "number") {
          return FERAL_ERROR.stackTraceLimit;
        }
        return void 0;
      },
      set(newLimit) {
        if (typeof newLimit !== "number") {
          return;
        }
        if (typeof FERAL_ERROR.stackTraceLimit === "number") {
          FERAL_ERROR.stackTraceLimit = newLimit;
          return;
        }
      },
      // WTF on v8 stackTraceLimit is enumerable
      enumerable: false,
      configurable: true
    }
  });
  if (errorTaming === "unsafe-debug" && platform === "v8") {
    defineProperties$1(InitialError, {
      prepareStackTrace: {
        get() {
          return FERAL_ERROR.prepareStackTrace;
        },
        set(newPrepareStackTrace) {
          FERAL_ERROR.prepareStackTrace = newPrepareStackTrace;
        },
        enumerable: false,
        configurable: true
      },
      captureStackTrace: {
        value: FERAL_ERROR.captureStackTrace,
        writable: true,
        enumerable: false,
        configurable: true
      }
    });
    const descs = getOwnPropertyDescriptors$1(InitialError);
    defineProperties$1(SharedError, {
      stackTraceLimit: descs.stackTraceLimit,
      prepareStackTrace: descs.prepareStackTrace,
      captureStackTrace: descs.captureStackTrace
    });
    return {
      "%InitialGetStackString%": initialGetStackString,
      "%InitialError%": InitialError,
      "%SharedError%": SharedError
    };
  }
  defineProperties$1(SharedError, {
    stackTraceLimit: {
      get() {
        return void 0;
      },
      set(_newLimit) {
      },
      enumerable: false,
      configurable: true
    }
  });
  if (platform === "v8") {
    defineProperties$1(SharedError, {
      prepareStackTrace: {
        get() {
          return () => "";
        },
        set(_prepareFn) {
        },
        enumerable: false,
        configurable: true
      },
      captureStackTrace: {
        value: (errorish, _constructorOpt) => {
          defineProperty$2(errorish, "stack", {
            value: ""
          });
        },
        writable: false,
        enumerable: false,
        configurable: true
      }
    });
  }
  if (platform === "v8") {
    initialGetStackString = tameV8ErrorConstructor(
      FERAL_ERROR,
      InitialError,
      errorTaming,
      stackFiltering
    );
  } else if (errorTaming === "unsafe" || errorTaming === "unsafe-debug") {
    defineProperties$1(ErrorPrototype, {
      stack: {
        get() {
          return initialGetStackString(this);
        },
        set(newValue) {
          defineProperties$1(this, {
            stack: {
              value: newValue,
              writable: true,
              enumerable: true,
              configurable: true
            }
          });
        }
      }
    });
  } else {
    defineProperties$1(ErrorPrototype, {
      stack: {
        get() {
          return `${this}`;
        },
        set(newValue) {
          defineProperties$1(this, {
            stack: {
              value: newValue,
              writable: true,
              enumerable: true,
              configurable: true
            }
          });
        }
      }
    });
  }
  return {
    "%InitialGetStackString%": initialGetStackString,
    "%InitialError%": InitialError,
    "%SharedError%": SharedError
  };
}
const noop = () => {
};
const asyncTrampoline = async (generatorFunc, args, errorWrapper) => {
  await null;
  const iterator = generatorFunc(...args);
  let result = generatorNext(iterator);
  while (!result.done) {
    try {
      const val = await result.value;
      result = generatorNext(iterator, val);
    } catch (error) {
      result = generatorThrow(iterator, errorWrapper(error));
    }
  }
  return result.value;
};
const syncTrampoline = (generatorFunc, args) => {
  const iterator = generatorFunc(...args);
  let result = generatorNext(iterator);
  while (!result.done) {
    try {
      result = generatorNext(iterator, result.value);
    } catch (error) {
      result = generatorThrow(iterator, error);
    }
  }
  return result.value;
};
const makeAlias = (compartment, specifier) => freeze$4({ compartment, specifier });
const resolveAll = (imports, resolveHook, fullReferrerSpecifier) => {
  const resolvedImports = create(null);
  for (const importSpecifier of imports) {
    const fullSpecifier = resolveHook(importSpecifier, fullReferrerSpecifier);
    resolvedImports[importSpecifier] = fullSpecifier;
  }
  return freeze$4(resolvedImports);
};
const loadModuleSource = (compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier, moduleSource, enqueueJob, selectImplementation, moduleLoads, importMeta) => {
  const { resolveHook, name: compartmentName } = weakmapGet(
    compartmentPrivateFields,
    compartment
  );
  const { imports } = moduleSource;
  if (!isArray(imports) || arraySome(imports, (specifier) => typeof specifier !== "string")) {
    throw makeError(
      redactedDetails`Invalid module source: 'imports' must be an array of strings, got ${imports} for module ${quote(moduleSpecifier)} of compartment ${quote(compartmentName)}`
    );
  }
  const resolvedImports = resolveAll(imports, resolveHook, moduleSpecifier);
  const moduleRecord = freeze$4({
    compartment,
    moduleSource,
    moduleSpecifier,
    resolvedImports,
    importMeta
  });
  for (const fullSpecifier of values(resolvedImports)) {
    enqueueJob(memoizedLoadWithErrorAnnotation, [
      compartmentPrivateFields,
      moduleAliases2,
      compartment,
      fullSpecifier,
      enqueueJob,
      selectImplementation,
      moduleLoads
    ]);
  }
  return moduleRecord;
};
function* loadWithoutErrorAnnotation(compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier, enqueueJob, selectImplementation, moduleLoads) {
  const {
    importHook,
    importNowHook,
    moduleMap,
    moduleMapHook,
    moduleRecords,
    parentCompartment
  } = weakmapGet(compartmentPrivateFields, compartment);
  if (mapHas(moduleRecords, moduleSpecifier)) {
    return mapGet(moduleRecords, moduleSpecifier);
  }
  let moduleDescriptor = moduleMap[moduleSpecifier];
  if (moduleDescriptor === void 0 && moduleMapHook !== void 0) {
    moduleDescriptor = moduleMapHook(moduleSpecifier);
  }
  if (moduleDescriptor === void 0) {
    const moduleHook = selectImplementation(importHook, importNowHook);
    if (moduleHook === void 0) {
      const moduleHookName = selectImplementation(
        "importHook",
        "importNowHook"
      );
      throw makeError(
        redactedDetails`${bare(moduleHookName)} needed to load module ${quote(
          moduleSpecifier
        )} in compartment ${quote(compartment.name)}`
      );
    }
    moduleDescriptor = moduleHook(moduleSpecifier);
    if (!weakmapHas(moduleAliases2, moduleDescriptor)) {
      moduleDescriptor = yield moduleDescriptor;
    }
  }
  if (typeof moduleDescriptor === "string") {
    throw makeError(
      redactedDetails`Cannot map module ${quote(moduleSpecifier)} to ${quote(
        moduleDescriptor
      )} in parent compartment, use {source} module descriptor`,
      TypeError$3
    );
  } else if (!isPrimitive(moduleDescriptor)) {
    let aliasDescriptor = weakmapGet(moduleAliases2, moduleDescriptor);
    if (aliasDescriptor !== void 0) {
      moduleDescriptor = aliasDescriptor;
    }
    if (moduleDescriptor.namespace !== void 0) {
      if (typeof moduleDescriptor.namespace === "string") {
        const {
          compartment: aliasCompartment = parentCompartment,
          namespace: aliasSpecifier
        } = moduleDescriptor;
        if (isPrimitive(aliasCompartment) || !weakmapHas(compartmentPrivateFields, aliasCompartment)) {
          throw makeError(
            redactedDetails`Invalid compartment in module descriptor for specifier ${quote(moduleSpecifier)} in compartment ${quote(compartment.name)}`
          );
        }
        const aliasRecord = yield memoizedLoadWithErrorAnnotation(
          compartmentPrivateFields,
          moduleAliases2,
          aliasCompartment,
          aliasSpecifier,
          enqueueJob,
          selectImplementation,
          moduleLoads
        );
        mapSet(moduleRecords, moduleSpecifier, aliasRecord);
        return aliasRecord;
      }
      if (!isPrimitive(moduleDescriptor.namespace)) {
        const { namespace } = moduleDescriptor;
        aliasDescriptor = weakmapGet(moduleAliases2, namespace);
        if (aliasDescriptor !== void 0) {
          moduleDescriptor = aliasDescriptor;
        } else {
          const exports$1 = getOwnPropertyNames(namespace);
          const moduleSource2 = {
            imports: [],
            exports: exports$1,
            execute(env) {
              for (const name of exports$1) {
                env[name] = namespace[name];
              }
            }
          };
          const importMeta = void 0;
          const moduleRecord2 = loadModuleSource(
            compartmentPrivateFields,
            moduleAliases2,
            compartment,
            moduleSpecifier,
            moduleSource2,
            enqueueJob,
            selectImplementation,
            moduleLoads,
            importMeta
          );
          mapSet(moduleRecords, moduleSpecifier, moduleRecord2);
          return moduleRecord2;
        }
      } else {
        throw makeError(
          redactedDetails`Invalid compartment in module descriptor for specifier ${quote(moduleSpecifier)} in compartment ${quote(compartment.name)}`
        );
      }
    }
    if (moduleDescriptor.source !== void 0) {
      if (typeof moduleDescriptor.source === "string") {
        const {
          source: loaderSpecifier,
          specifier: instanceSpecifier = moduleSpecifier,
          compartment: loaderCompartment = parentCompartment,
          importMeta = void 0
        } = moduleDescriptor;
        const loaderRecord = yield memoizedLoadWithErrorAnnotation(
          compartmentPrivateFields,
          moduleAliases2,
          loaderCompartment,
          loaderSpecifier,
          enqueueJob,
          selectImplementation,
          moduleLoads
        );
        const { moduleSource: moduleSource2 } = loaderRecord;
        const moduleRecord2 = loadModuleSource(
          compartmentPrivateFields,
          moduleAliases2,
          compartment,
          instanceSpecifier,
          moduleSource2,
          enqueueJob,
          selectImplementation,
          moduleLoads,
          importMeta
        );
        mapSet(moduleRecords, moduleSpecifier, moduleRecord2);
        return moduleRecord2;
      } else {
        const {
          source: moduleSource2,
          specifier: aliasSpecifier = moduleSpecifier,
          importMeta
        } = moduleDescriptor;
        const aliasRecord = loadModuleSource(
          compartmentPrivateFields,
          moduleAliases2,
          compartment,
          aliasSpecifier,
          moduleSource2,
          enqueueJob,
          selectImplementation,
          moduleLoads,
          importMeta
        );
        mapSet(moduleRecords, moduleSpecifier, aliasRecord);
        return aliasRecord;
      }
    }
    if (moduleDescriptor.archive !== void 0) {
      throw makeError(
        redactedDetails`Unsupported archive module descriptor for specifier ${quote(moduleSpecifier)} in compartment ${quote(compartment.name)}`
      );
    }
    if (moduleDescriptor.record !== void 0) {
      const {
        compartment: aliasCompartment = compartment,
        specifier: aliasSpecifier = moduleSpecifier,
        record: moduleSource2,
        importMeta
      } = moduleDescriptor;
      const aliasRecord = loadModuleSource(
        compartmentPrivateFields,
        moduleAliases2,
        aliasCompartment,
        aliasSpecifier,
        moduleSource2,
        enqueueJob,
        selectImplementation,
        moduleLoads,
        importMeta
      );
      mapSet(moduleRecords, moduleSpecifier, aliasRecord);
      mapSet(moduleRecords, aliasSpecifier, aliasRecord);
      return aliasRecord;
    }
    if (moduleDescriptor.compartment !== void 0 && moduleDescriptor.specifier !== void 0) {
      if (isPrimitive(moduleDescriptor.compartment) || !weakmapHas(compartmentPrivateFields, moduleDescriptor.compartment) || typeof moduleDescriptor.specifier !== "string") {
        throw makeError(
          redactedDetails`Invalid compartment in module descriptor for specifier ${quote(moduleSpecifier)} in compartment ${quote(compartment.name)}`
        );
      }
      const aliasRecord = yield memoizedLoadWithErrorAnnotation(
        compartmentPrivateFields,
        moduleAliases2,
        moduleDescriptor.compartment,
        moduleDescriptor.specifier,
        enqueueJob,
        selectImplementation,
        moduleLoads
      );
      mapSet(moduleRecords, moduleSpecifier, aliasRecord);
      return aliasRecord;
    }
    const moduleSource = moduleDescriptor;
    const moduleRecord = loadModuleSource(
      compartmentPrivateFields,
      moduleAliases2,
      compartment,
      moduleSpecifier,
      moduleSource,
      enqueueJob,
      selectImplementation,
      moduleLoads
    );
    mapSet(moduleRecords, moduleSpecifier, moduleRecord);
    return moduleRecord;
  } else {
    throw makeError(
      redactedDetails`module descriptor must be a string or object for specifier ${quote(
        moduleSpecifier
      )} in compartment ${quote(compartment.name)}`
    );
  }
}
const memoizedLoadWithErrorAnnotation = (compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier, enqueueJob, selectImplementation, moduleLoads) => {
  const { name: compartmentName } = weakmapGet(
    compartmentPrivateFields,
    compartment
  );
  let compartmentLoading = mapGet(moduleLoads, compartment);
  if (compartmentLoading === void 0) {
    compartmentLoading = new Map$1();
    mapSet(moduleLoads, compartment, compartmentLoading);
  }
  let moduleLoading = mapGet(compartmentLoading, moduleSpecifier);
  if (moduleLoading !== void 0) {
    return moduleLoading;
  }
  moduleLoading = selectImplementation(asyncTrampoline, syncTrampoline)(
    loadWithoutErrorAnnotation,
    [
      compartmentPrivateFields,
      moduleAliases2,
      compartment,
      moduleSpecifier,
      enqueueJob,
      selectImplementation,
      moduleLoads
    ],
    (error) => {
      note(
        error,
        redactedDetails`${error.message}, loading ${quote(moduleSpecifier)} in compartment ${quote(
          compartmentName
        )}`
      );
      throw error;
    }
  );
  mapSet(compartmentLoading, moduleSpecifier, moduleLoading);
  return moduleLoading;
};
const asyncJobQueue = ({ errors = [], noAggregateErrors = false } = {}) => {
  const pendingJobs = new Set$1();
  const enqueueJob = (func, args) => {
    setAdd(
      pendingJobs,
      promiseThen(func(...args), noop, (error) => {
        if (noAggregateErrors) {
          throw error;
        } else {
          arrayPush$1(errors, error);
        }
      })
    );
  };
  const drainQueue = async () => {
    await null;
    for (const job of pendingJobs) {
      await job;
    }
  };
  return { enqueueJob, drainQueue, errors };
};
const syncJobQueue = ({ errors = [], noAggregateErrors = false } = {}) => {
  let current = [];
  let next = [];
  const enqueueJob = (func, args) => {
    arrayPush$1(next, [func, args]);
  };
  const drainQueue = () => {
    for (const [func, args] of current) {
      try {
        func(...args);
      } catch (error) {
        if (noAggregateErrors) {
          throw error;
        } else {
          arrayPush$1(errors, error);
        }
      }
    }
    current = next;
    next = [];
    if (current.length > 0) drainQueue();
  };
  return { enqueueJob, drainQueue, errors };
};
const throwAggregateError = ({ errors, errorPrefix }) => {
  if (errors.length > 0) {
    const verbose = (
      /** @type {'' | 'verbose'} */
      getEnvironmentOption("COMPARTMENT_LOAD_ERRORS", "", ["verbose"]) === "verbose"
    );
    throw TypeError$3(
      `${errorPrefix} (${errors.length} underlying failures: ${arrayJoin(
        arrayMap(errors, (error) => error.message + (verbose ? error.stack : "")),
        ", "
      )}`
    );
  }
};
const preferSync = (_asyncImpl, syncImpl) => syncImpl;
const preferAsync = (asyncImpl, _syncImpl) => asyncImpl;
const load = async (compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier, { noAggregateErrors = false } = {}) => {
  const { name: compartmentName } = weakmapGet(
    compartmentPrivateFields,
    compartment
  );
  const moduleLoads = new Map$1();
  const { enqueueJob, drainQueue, errors } = asyncJobQueue({
    noAggregateErrors
  });
  enqueueJob(memoizedLoadWithErrorAnnotation, [
    compartmentPrivateFields,
    moduleAliases2,
    compartment,
    moduleSpecifier,
    enqueueJob,
    preferAsync,
    moduleLoads
  ]);
  await drainQueue();
  throwAggregateError({
    errors,
    errorPrefix: `Failed to load module ${quote(moduleSpecifier)} in package ${quote(
      compartmentName
    )}`
  });
};
const loadNow = (compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier, { noAggregateErrors = false } = {}) => {
  const { name: compartmentName } = weakmapGet(
    compartmentPrivateFields,
    compartment
  );
  const moduleLoads = new Map$1();
  const { enqueueJob, drainQueue, errors } = syncJobQueue({
    noAggregateErrors
  });
  enqueueJob(memoizedLoadWithErrorAnnotation, [
    compartmentPrivateFields,
    moduleAliases2,
    compartment,
    moduleSpecifier,
    enqueueJob,
    preferSync,
    moduleLoads
  ]);
  drainQueue();
  throwAggregateError({
    errors,
    errorPrefix: `Failed to load module ${quote(moduleSpecifier)} in package ${quote(
      compartmentName
    )}`
  });
};
const { quote: q$3 } = assert;
const deferExports = () => {
  let active = false;
  const exportsTarget = create(null, {
    // Make this appear like an ESM module namespace object.
    [toStringTagSymbol$1]: {
      value: "Module",
      writable: false,
      enumerable: false,
      configurable: false
    }
  });
  return freeze$4({
    activate() {
      active = true;
    },
    exportsTarget,
    exportsProxy: new Proxy2(exportsTarget, {
      get(_target, name, receiver) {
        if (!active) {
          throw TypeError$3(
            `Cannot get property ${q$3(
              name
            )} of module exports namespace, the module has not yet begun to execute`
          );
        }
        return reflectGet(exportsTarget, name, receiver);
      },
      set(_target, name, _value) {
        throw TypeError$3(
          `Cannot set property ${q$3(name)} of module exports namespace`
        );
      },
      has(_target, name) {
        if (!active) {
          throw TypeError$3(
            `Cannot check property ${q$3(
              name
            )}, the module has not yet begun to execute`
          );
        }
        return reflectHas(exportsTarget, name);
      },
      deleteProperty(_target, name) {
        throw TypeError$3(
          `Cannot delete property ${q$3(name)}s of module exports namespace`
        );
      },
      ownKeys(_target) {
        if (!active) {
          throw TypeError$3(
            "Cannot enumerate keys, the module has not yet begun to execute"
          );
        }
        return ownKeys$2(exportsTarget);
      },
      getOwnPropertyDescriptor(_target, name) {
        if (!active) {
          throw TypeError$3(
            `Cannot get own property descriptor ${q$3(
              name
            )}, the module has not yet begun to execute`
          );
        }
        return reflectGetOwnPropertyDescriptor(exportsTarget, name);
      },
      preventExtensions(_target) {
        if (!active) {
          throw TypeError$3(
            "Cannot prevent extensions of module exports namespace, the module has not yet begun to execute"
          );
        }
        return reflectPreventExtensions(exportsTarget);
      },
      isExtensible() {
        if (!active) {
          throw TypeError$3(
            "Cannot check extensibility of module exports namespace, the module has not yet begun to execute"
          );
        }
        return reflectIsExtensible(exportsTarget);
      },
      getPrototypeOf(_target) {
        return null;
      },
      setPrototypeOf(_target, _proto) {
        throw TypeError$3("Cannot set prototype of module exports namespace");
      },
      defineProperty(_target, name, _descriptor) {
        throw TypeError$3(
          `Cannot define property ${q$3(name)} of module exports namespace`
        );
      },
      apply(_target, _thisArg, _args) {
        throw TypeError$3(
          "Cannot call module exports namespace, it is not a function"
        );
      },
      construct(_target, _args) {
        throw TypeError$3(
          "Cannot construct module exports namespace, it is not a constructor"
        );
      }
    })
  });
};
const getDeferredExports = (compartment, compartmentPrivateFields, moduleAliases2, specifier) => {
  const { deferredExports } = compartmentPrivateFields;
  if (!mapHas(deferredExports, specifier)) {
    const deferred = deferExports();
    weakmapSet(
      moduleAliases2,
      deferred.exportsProxy,
      makeAlias(compartment, specifier)
    );
    mapSet(deferredExports, specifier, deferred);
  }
  return mapGet(deferredExports, specifier);
};
const provideCompartmentEvaluator = (compartmentFields, options) => {
  const { sloppyGlobalsMode = false, __moduleShimLexicals__ = void 0 } = options;
  let safeEvaluate;
  if (__moduleShimLexicals__ === void 0 && !sloppyGlobalsMode) {
    ({ safeEvaluate } = compartmentFields);
  } else {
    let { globalTransforms } = compartmentFields;
    const { globalObject } = compartmentFields;
    let moduleLexicals;
    if (__moduleShimLexicals__ !== void 0) {
      globalTransforms = void 0;
      moduleLexicals = create(
        null,
        getOwnPropertyDescriptors$1(__moduleShimLexicals__)
      );
    }
    ({ safeEvaluate } = makeSafeEvaluator({
      globalObject,
      moduleLexicals,
      globalTransforms,
      sloppyGlobalsMode
    }));
  }
  return { safeEvaluate };
};
const compartmentEvaluate = (compartmentFields, source, options) => {
  if (typeof source !== "string") {
    throw TypeError$3("first argument of evaluate() must be a string");
  }
  const {
    transforms = [],
    __evadeHtmlCommentTest__ = false,
    __evadeImportExpressionTest__ = false,
    __rejectSomeDirectEvalExpressions__ = true
    // Note default on
  } = options;
  const localTransforms = [...transforms];
  if (__evadeHtmlCommentTest__ === true) {
    arrayPush$1(localTransforms, evadeHtmlCommentTest);
  }
  if (__evadeImportExpressionTest__ === true) {
    arrayPush$1(localTransforms, evadeImportExpressionTest);
  }
  if (__rejectSomeDirectEvalExpressions__ === true) {
    arrayPush$1(localTransforms, rejectSomeDirectEvalExpressions);
  }
  const { safeEvaluate } = provideCompartmentEvaluator(
    compartmentFields,
    options
  );
  return safeEvaluate(source, {
    localTransforms
  });
};
const { quote: q$2 } = assert;
const makeVirtualModuleInstance = (compartmentPrivateFields, moduleSource, compartment, moduleAliases2, moduleSpecifier, resolvedImports) => {
  const { exportsProxy, exportsTarget, activate } = getDeferredExports(
    compartment,
    weakmapGet(compartmentPrivateFields, compartment),
    moduleAliases2,
    moduleSpecifier
  );
  const notifiers = create(null);
  if (moduleSource.exports) {
    if (!isArray(moduleSource.exports) || arraySome(moduleSource.exports, (name) => typeof name !== "string")) {
      throw TypeError$3(
        `SES virtual module source "exports" property must be an array of strings for module ${moduleSpecifier}`
      );
    }
    arrayForEach(moduleSource.exports, (name) => {
      let value = exportsTarget[name];
      const updaters = [];
      const get = () => value;
      const set = (newValue) => {
        value = newValue;
        for (const updater of updaters) {
          updater(newValue);
        }
      };
      defineProperty$2(exportsTarget, name, {
        get,
        set,
        enumerable: true,
        configurable: false
      });
      notifiers[name] = (update) => {
        arrayPush$1(updaters, update);
        update(value);
      };
    });
    notifiers["*"] = (update) => {
      update(exportsTarget);
    };
  }
  const localState = {
    activated: false
  };
  return freeze$4({
    notifiers,
    exportsProxy,
    execute() {
      if (reflectHas(localState, "errorFromExecute")) {
        throw localState.errorFromExecute;
      }
      if (!localState.activated) {
        activate();
        localState.activated = true;
        try {
          moduleSource.execute(exportsTarget, compartment, resolvedImports);
        } catch (err) {
          localState.errorFromExecute = err;
          throw err;
        }
      }
    }
  });
};
const makeModuleInstance = (privateFields2, moduleAliases2, moduleRecord, importedInstances) => {
  const {
    compartment,
    moduleSpecifier,
    moduleSource,
    importMeta: moduleRecordMeta
  } = moduleRecord;
  const {
    reexports: exportAlls = [],
    __syncModuleProgram__: functorSource,
    __fixedExportMap__: fixedExportMap = {},
    __liveExportMap__: liveExportMap = {},
    __reexportMap__: reexportMap = {},
    __needsImport__: needsImport = false,
    __needsImportMeta__: needsImportMeta = false,
    __syncModuleFunctor__
  } = moduleSource;
  const compartmentFields = weakmapGet(privateFields2, compartment);
  const { __shimTransforms__, resolveHook, importMetaHook, compartmentImport } = compartmentFields;
  const { exportsProxy, exportsTarget, activate } = getDeferredExports(
    compartment,
    compartmentFields,
    moduleAliases2,
    moduleSpecifier
  );
  const exportsProps = create(null);
  const moduleLexicals = create(null);
  const onceVar = create(null);
  const liveVar = create(null);
  const importMeta = create(null);
  if (moduleRecordMeta) {
    assign(importMeta, moduleRecordMeta);
  }
  if (needsImportMeta && importMetaHook) {
    importMetaHook(moduleSpecifier, importMeta);
  }
  let dynamicImport;
  if (needsImport) {
    dynamicImport = async (importSpecifier) => compartmentImport(resolveHook(importSpecifier, moduleSpecifier));
  }
  const localGetNotify = create(null);
  const notifiers = create(null);
  arrayForEach(entries(fixedExportMap), ([fixedExportName, [localName]]) => {
    let fixedGetNotify = localGetNotify[localName];
    if (!fixedGetNotify) {
      let value;
      let tdz = true;
      let optUpdaters = [];
      const get = () => {
        if (tdz) {
          throw ReferenceError$1(`binding ${q$2(localName)} not yet initialized`);
        }
        return value;
      };
      const init = freeze$4((initValue) => {
        if (!tdz) {
          throw TypeError$3(
            `Internal: binding ${q$2(localName)} already initialized`
          );
        }
        value = initValue;
        const updaters = optUpdaters;
        optUpdaters = null;
        tdz = false;
        for (const updater of updaters || []) {
          updater(initValue);
        }
        return initValue;
      });
      const notify = (updater) => {
        if (updater === init) {
          return;
        }
        if (tdz) {
          arrayPush$1(optUpdaters || [], updater);
        } else {
          updater(value);
        }
      };
      fixedGetNotify = {
        get,
        notify
      };
      localGetNotify[localName] = fixedGetNotify;
      onceVar[localName] = init;
    }
    exportsProps[fixedExportName] = {
      get: fixedGetNotify.get,
      set: void 0,
      enumerable: true,
      configurable: false
    };
    notifiers[fixedExportName] = fixedGetNotify.notify;
  });
  arrayForEach(
    entries(liveExportMap),
    ([liveExportName, [localName, setProxyTrap]]) => {
      let liveGetNotify = localGetNotify[localName];
      if (!liveGetNotify) {
        let value;
        let tdz = true;
        const updaters = [];
        const get = () => {
          if (tdz) {
            throw ReferenceError$1(
              `binding ${q$2(liveExportName)} not yet initialized`
            );
          }
          return value;
        };
        const update = freeze$4((newValue) => {
          value = newValue;
          tdz = false;
          for (const updater of updaters) {
            updater(newValue);
          }
        });
        const set = (newValue) => {
          if (tdz) {
            throw ReferenceError$1(`binding ${q$2(localName)} not yet initialized`);
          }
          value = newValue;
          for (const updater of updaters) {
            updater(newValue);
          }
        };
        const notify = (updater) => {
          if (updater === update) {
            return;
          }
          arrayPush$1(updaters, updater);
          if (!tdz) {
            updater(value);
          }
        };
        liveGetNotify = {
          get,
          notify
        };
        localGetNotify[localName] = liveGetNotify;
        if (setProxyTrap) {
          defineProperty$2(moduleLexicals, localName, {
            get,
            set,
            enumerable: true,
            configurable: false
          });
        }
        liveVar[localName] = update;
      }
      exportsProps[liveExportName] = {
        get: liveGetNotify.get,
        set: void 0,
        enumerable: true,
        configurable: false
      };
      notifiers[liveExportName] = liveGetNotify.notify;
    }
  );
  const notifyStar = (update) => {
    update(exportsTarget);
  };
  notifiers["*"] = notifyStar;
  function imports(updateRecord) {
    const candidateAll = create(null);
    candidateAll.default = false;
    for (const [specifier, importUpdaters] of updateRecord) {
      const instance = mapGet(importedInstances, specifier);
      instance.execute();
      const { notifiers: importNotifiers } = instance;
      for (const [importName, updaters] of importUpdaters) {
        const importNotify = importNotifiers[importName];
        if (!importNotify) {
          throw SyntaxError$1(
            `The requested module '${specifier}' does not provide an export named '${importName}'`
          );
        }
        for (const updater of updaters) {
          importNotify(updater);
        }
      }
      if (arrayIncludes$1(exportAlls, specifier)) {
        for (const [importAndExportName, importNotify] of entries(
          importNotifiers
        )) {
          if (candidateAll[importAndExportName] === void 0) {
            candidateAll[importAndExportName] = importNotify;
          } else {
            candidateAll[importAndExportName] = false;
          }
        }
      }
      if (reexportMap[specifier]) {
        for (const [localName, exportedName] of reexportMap[specifier]) {
          candidateAll[exportedName] = importNotifiers[localName];
        }
      }
    }
    for (const [exportName, notify] of entries(candidateAll)) {
      if (!notifiers[exportName] && notify !== false) {
        notifiers[exportName] = notify;
        let value;
        const update = (newValue) => value = newValue;
        notify(update);
        exportsProps[exportName] = {
          get() {
            return value;
          },
          set: void 0,
          enumerable: true,
          configurable: false
        };
      }
    }
    arrayForEach(
      arraySort(keys(exportsProps)),
      (k) => defineProperty$2(exportsTarget, k, exportsProps[k])
    );
    freeze$4(exportsTarget);
    activate();
  }
  let optFunctor;
  if (__syncModuleFunctor__ !== void 0) {
    optFunctor = __syncModuleFunctor__;
  } else {
    optFunctor = compartmentEvaluate(compartmentFields, functorSource, {
      globalObject: compartment.globalThis,
      transforms: __shimTransforms__,
      __moduleShimLexicals__: moduleLexicals
    });
  }
  let didThrow = false;
  let thrownError;
  function execute() {
    if (optFunctor) {
      const functor = optFunctor;
      optFunctor = null;
      try {
        functor(
          freeze$4({
            imports: freeze$4(imports),
            onceVar: freeze$4(onceVar),
            liveVar: freeze$4(liveVar),
            import: dynamicImport,
            importMeta
          })
        );
      } catch (e) {
        didThrow = true;
        thrownError = e;
      }
    }
    if (didThrow) {
      throw thrownError;
    }
  }
  return freeze$4({
    notifiers,
    exportsProxy,
    execute
  });
};
const { Fail: Fail$1, quote: q$1 } = assert;
const link = (compartmentPrivateFields, moduleAliases2, compartment, moduleSpecifier) => {
  const { name: compartmentName, moduleRecords } = weakmapGet(
    compartmentPrivateFields,
    compartment
  );
  const moduleRecord = mapGet(moduleRecords, moduleSpecifier);
  if (moduleRecord === void 0) {
    throw ReferenceError$1(
      `Missing link to module ${q$1(moduleSpecifier)} from compartment ${q$1(
        compartmentName
      )}`
    );
  }
  return instantiate(compartmentPrivateFields, moduleAliases2, moduleRecord);
};
function mayBePrecompiledModuleSource(moduleSource) {
  return typeof moduleSource.__syncModuleProgram__ === "string";
}
function validatePrecompiledModuleSource(moduleSource, moduleSpecifier) {
  const { __fixedExportMap__, __liveExportMap__ } = moduleSource;
  !isPrimitive(__fixedExportMap__) || Fail$1`Property '__fixedExportMap__' of a precompiled module source must be an object, got ${q$1(
    __fixedExportMap__
  )}, for module ${q$1(moduleSpecifier)}`;
  !isPrimitive(__liveExportMap__) || Fail$1`Property '__liveExportMap__' of a precompiled module source must be an object, got ${q$1(
    __liveExportMap__
  )}, for module ${q$1(moduleSpecifier)}`;
}
function mayBeVirtualModuleSource(moduleSource) {
  return typeof moduleSource.execute === "function";
}
function validateVirtualModuleSource(moduleSource, moduleSpecifier) {
  const { exports: exports$1 } = moduleSource;
  isArray(exports$1) || Fail$1`Invalid module source: 'exports' of a virtual module source must be an array, got ${q$1(
    exports$1
  )}, for module ${q$1(moduleSpecifier)}`;
}
function validateModuleSource(moduleSource, moduleSpecifier) {
  !isPrimitive(moduleSource) || Fail$1`Invalid module source: must be of type object, got ${q$1(
    moduleSource
  )}, for module ${q$1(moduleSpecifier)}`;
  const { imports, exports: exports$1, reexports = [] } = moduleSource;
  isArray(imports) || Fail$1`Invalid module source: 'imports' must be an array, got ${q$1(
    imports
  )}, for module ${q$1(moduleSpecifier)}`;
  isArray(exports$1) || Fail$1`Invalid module source: 'exports' must be an array, got ${q$1(
    exports$1
  )}, for module ${q$1(moduleSpecifier)}`;
  isArray(reexports) || Fail$1`Invalid module source: 'reexports' must be an array if present, got ${q$1(
    reexports
  )}, for module ${q$1(moduleSpecifier)}`;
}
const instantiate = (compartmentPrivateFields, moduleAliases2, moduleRecord) => {
  const { compartment, moduleSpecifier, resolvedImports, moduleSource } = moduleRecord;
  const { instances } = weakmapGet(compartmentPrivateFields, compartment);
  if (mapHas(instances, moduleSpecifier)) {
    return mapGet(instances, moduleSpecifier);
  }
  validateModuleSource(moduleSource, moduleSpecifier);
  const importedInstances = new Map$1();
  let moduleInstance;
  if (mayBePrecompiledModuleSource(moduleSource)) {
    validatePrecompiledModuleSource(moduleSource, moduleSpecifier);
    moduleInstance = makeModuleInstance(
      compartmentPrivateFields,
      moduleAliases2,
      moduleRecord,
      importedInstances
    );
  } else if (mayBeVirtualModuleSource(moduleSource)) {
    validateVirtualModuleSource(moduleSource, moduleSpecifier);
    moduleInstance = makeVirtualModuleInstance(
      compartmentPrivateFields,
      moduleSource,
      compartment,
      moduleAliases2,
      moduleSpecifier,
      resolvedImports
    );
  } else {
    throw TypeError$3(`Invalid module source, got ${q$1(moduleSource)}`);
  }
  mapSet(instances, moduleSpecifier, moduleInstance);
  for (const [importSpecifier, resolvedSpecifier] of entries(resolvedImports)) {
    const importedInstance = link(
      compartmentPrivateFields,
      moduleAliases2,
      compartment,
      resolvedSpecifier
    );
    mapSet(importedInstances, importSpecifier, importedInstance);
  }
  return moduleInstance;
};
const moduleAliases = new WeakMap$2();
const privateFields = new WeakMap$2();
const InertCompartment = function Compartment2(_endowments = {}, _modules = {}, _options = {}) {
  throw TypeError$3(
    "Compartment.prototype.constructor is not a valid constructor."
  );
};
const compartmentImportNow = (compartment, specifier) => {
  const { execute, exportsProxy } = link(
    privateFields,
    moduleAliases,
    compartment,
    specifier
  );
  execute();
  return exportsProxy;
};
const CompartmentPrototype = {
  constructor: InertCompartment,
  get globalThis() {
    return (
      /** @type {CompartmentFields} */
      weakmapGet(privateFields, this).globalObject
    );
  },
  get name() {
    return (
      /** @type {CompartmentFields} */
      weakmapGet(privateFields, this).name
    );
  },
  evaluate(source, options = {}) {
    const compartmentFields = weakmapGet(privateFields, this);
    return compartmentEvaluate(compartmentFields, source, options);
  },
  module(specifier) {
    if (typeof specifier !== "string") {
      throw TypeError$3("first argument of module() must be a string");
    }
    const { exportsProxy } = getDeferredExports(
      this,
      weakmapGet(privateFields, this),
      moduleAliases,
      specifier
    );
    return exportsProxy;
  },
  async import(specifier) {
    const { noNamespaceBox, noAggregateLoadErrors } = (
      /** @type {CompartmentFields} */
      weakmapGet(privateFields, this)
    );
    if (typeof specifier !== "string") {
      throw TypeError$3("first argument of import() must be a string");
    }
    return promiseThen(
      load(privateFields, moduleAliases, this, specifier, {
        noAggregateErrors: noAggregateLoadErrors
      }),
      () => {
        const namespace = compartmentImportNow(
          /** @type {Compartment} */
          this,
          specifier
        );
        if (noNamespaceBox) {
          return namespace;
        }
        return { namespace };
      }
    );
  },
  async load(specifier) {
    if (typeof specifier !== "string") {
      throw TypeError$3("first argument of load() must be a string");
    }
    const { noAggregateLoadErrors } = (
      /** @type {CompartmentFields} */
      weakmapGet(privateFields, this)
    );
    return load(privateFields, moduleAliases, this, specifier, {
      noAggregateErrors: noAggregateLoadErrors
    });
  },
  importNow(specifier) {
    if (typeof specifier !== "string") {
      throw TypeError$3("first argument of importNow() must be a string");
    }
    const { noAggregateLoadErrors } = (
      /** @type {CompartmentFields} */
      weakmapGet(privateFields, this)
    );
    loadNow(privateFields, moduleAliases, this, specifier, {
      noAggregateErrors: noAggregateLoadErrors
    });
    return compartmentImportNow(
      /** @type {Compartment} */
      this,
      specifier
    );
  }
};
defineProperties$1(CompartmentPrototype, {
  [toStringTagSymbol$1]: {
    value: "Compartment",
    writable: false,
    enumerable: false,
    configurable: true
  }
});
defineProperties$1(InertCompartment, {
  prototype: { value: CompartmentPrototype }
});
const compartmentOptions = (...args) => {
  if (args.length === 0) {
    return {};
  }
  if (args.length === 1 && typeof args[0] === "object" && args[0] !== null && "__options__" in args[0]) {
    const { __options__, ...options } = args[0];
    assert(
      __options__ === true,
      `Compartment constructor only supports true __options__ sigil, got ${__options__}`
    );
    return options;
  } else {
    const [
      globals = (
        /** @type {Map<string, any>} */
        {}
      ),
      modules = (
        /** @type {Map<string, ModuleDescriptor>} */
        {}
      ),
      options = {}
    ] = (
      /** @type {LegacyCompartmentOptionsArgs} */
      args
    );
    assertEqual(
      options.modules,
      void 0,
      `Compartment constructor must receive either a module map argument or modules option, not both`
    );
    assertEqual(
      options.globals,
      void 0,
      `Compartment constructor must receive either globals argument or option, not both`
    );
    return {
      ...options,
      globals,
      modules
    };
  }
};
const makeCompartmentConstructor = (targetMakeCompartmentConstructor, intrinsics, markVirtualizedNativeFunction2, { parentCompartment = void 0, enforceNew = false } = {}) => {
  function Compartment3(...args) {
    if (enforceNew && new.target === void 0) {
      throw TypeError$3(
        "Class constructor Compartment cannot be invoked without 'new'"
      );
    }
    const {
      name = "<unknown>",
      transforms = [],
      __shimTransforms__ = [],
      globals: endowmentsOption = {},
      modules: moduleMapOption = {},
      resolveHook,
      importHook,
      importNowHook,
      moduleMapHook,
      importMetaHook,
      __noNamespaceBox__: noNamespaceBox = false,
      noAggregateLoadErrors = false
    } = compartmentOptions(...args);
    const globalTransforms = arrayFlatMap(
      [transforms, __shimTransforms__],
      identity
    );
    const endowments = { __proto__: null, ...endowmentsOption };
    const moduleMap = { __proto__: null, ...moduleMapOption };
    const moduleRecords = new Map$1();
    const instances = new Map$1();
    const deferredExports = new Map$1();
    const globalObject = {};
    const compartment = this;
    setGlobalObjectSymbolUnscopables(globalObject);
    setGlobalObjectConstantProperties(globalObject);
    const { safeEvaluate } = makeSafeEvaluator({
      globalObject,
      globalTransforms,
      sloppyGlobalsMode: false
    });
    setGlobalObjectMutableProperties(globalObject, {
      intrinsics,
      newGlobalPropertyNames: sharedGlobalPropertyNames,
      makeCompartmentConstructor: targetMakeCompartmentConstructor,
      parentCompartment: this,
      markVirtualizedNativeFunction: markVirtualizedNativeFunction2
    });
    setGlobalObjectEvaluators(
      globalObject,
      safeEvaluate,
      markVirtualizedNativeFunction2
    );
    assign(globalObject, endowments);
    const compartmentImport = async (fullSpecifier) => {
      if (typeof resolveHook !== "function") {
        throw TypeError$3(
          `Compartment does not support dynamic import: no configured resolveHook for compartment ${quote(name)}`
        );
      }
      await load(privateFields, moduleAliases, compartment, fullSpecifier, {
        noAggregateErrors: noAggregateLoadErrors
      });
      const { execute, exportsProxy } = link(
        privateFields,
        moduleAliases,
        compartment,
        fullSpecifier
      );
      execute();
      return exportsProxy;
    };
    weakmapSet(privateFields, this, {
      name: `${name}`,
      globalTransforms,
      globalObject,
      safeEvaluate,
      resolveHook,
      importHook,
      importNowHook,
      moduleMap,
      moduleMapHook,
      importMetaHook,
      moduleRecords,
      __shimTransforms__,
      deferredExports,
      instances,
      parentCompartment,
      noNamespaceBox,
      compartmentImport,
      noAggregateLoadErrors
    });
  }
  Compartment3.prototype = CompartmentPrototype;
  return Compartment3;
};
function getConstructorOf(obj) {
  return getPrototypeOf$1(obj).constructor;
}
function makeArguments() {
  return arguments;
}
const getAnonymousIntrinsics = () => {
  const InertFunction = FERAL_FUNCTION.prototype.constructor;
  const argsCalleeDesc = getOwnPropertyDescriptor$1(makeArguments(), "callee");
  const ThrowTypeError = argsCalleeDesc && argsCalleeDesc.get;
  const StringIteratorObject = iterateString(new String$2());
  const StringIteratorPrototype = getPrototypeOf$1(StringIteratorObject);
  const RegExpStringIterator = regexpPrototype[matchAllSymbol] && matchAllRegExp(/./);
  const RegExpStringIteratorPrototype = RegExpStringIterator && getPrototypeOf$1(RegExpStringIterator);
  const ArrayIteratorObject = iterateArray([]);
  const ArrayIteratorPrototype = getPrototypeOf$1(ArrayIteratorObject);
  const TypedArray2 = getPrototypeOf$1(Float32Array$1);
  const MapIteratorObject = iterateMap(new Map$1());
  const MapIteratorPrototype = getPrototypeOf$1(MapIteratorObject);
  const SetIteratorObject = iterateSet(new Set$1());
  const SetIteratorPrototype = getPrototypeOf$1(SetIteratorObject);
  const IteratorPrototype = getPrototypeOf$1(ArrayIteratorPrototype);
  function* GeneratorFunctionInstance() {
  }
  const GeneratorFunction = getConstructorOf(GeneratorFunctionInstance);
  const Generator = GeneratorFunction.prototype;
  async function AsyncFunctionInstance2() {
  }
  const AsyncFunction = getConstructorOf(AsyncFunctionInstance2);
  const intrinsics = {
    "%InertFunction%": InertFunction,
    "%ArrayIteratorPrototype%": ArrayIteratorPrototype,
    "%InertAsyncFunction%": AsyncFunction,
    "%Generator%": Generator,
    "%InertGeneratorFunction%": GeneratorFunction,
    "%IteratorPrototype%": IteratorPrototype,
    "%MapIteratorPrototype%": MapIteratorPrototype,
    "%RegExpStringIteratorPrototype%": RegExpStringIteratorPrototype,
    "%SetIteratorPrototype%": SetIteratorPrototype,
    "%StringIteratorPrototype%": StringIteratorPrototype,
    "%ThrowTypeError%": ThrowTypeError,
    "%TypedArray%": TypedArray2,
    "%InertCompartment%": InertCompartment
  };
  if (AsyncGeneratorFunctionInstance !== void 0) {
    const AsyncGeneratorFunction = getConstructorOf(
      AsyncGeneratorFunctionInstance
    );
    const AsyncGenerator = AsyncGeneratorFunction.prototype;
    const AsyncGeneratorPrototype = AsyncGenerator.prototype;
    const AsyncIteratorPrototype = getPrototypeOf$1(AsyncGeneratorPrototype);
    assign(intrinsics, {
      "%AsyncGenerator%": AsyncGenerator,
      "%InertAsyncGeneratorFunction%": AsyncGeneratorFunction,
      "%AsyncGeneratorPrototype%": AsyncGeneratorPrototype,
      "%AsyncIteratorPrototype%": AsyncIteratorPrototype
    });
  }
  if (universalThis.Iterator) {
    intrinsics["%IteratorHelperPrototype%"] = getPrototypeOf$1(
      // eslint-disable-next-line @endo/no-polymorphic-call
      universalThis.Iterator.from([]).take(0)
    );
    intrinsics["%WrapForValidIteratorPrototype%"] = getPrototypeOf$1(
      // eslint-disable-next-line @endo/no-polymorphic-call
      universalThis.Iterator.from({
        next() {
          return { value: void 0 };
        }
      })
    );
  }
  if (universalThis.AsyncIterator) {
    intrinsics["%AsyncIteratorHelperPrototype%"] = getPrototypeOf$1(
      // eslint-disable-next-line @endo/no-polymorphic-call
      universalThis.AsyncIterator.from([]).take(0)
    );
    intrinsics["%WrapForValidAsyncIteratorPrototype%"] = getPrototypeOf$1(
      // eslint-disable-next-line @endo/no-polymorphic-call
      universalThis.AsyncIterator.from({ next() {
      } })
    );
  }
  const ab = new ArrayBuffer$2(0);
  const iab = ab.sliceToImmutable();
  const iabProto = getPrototypeOf$1(iab);
  if (iabProto !== ArrayBuffer$2.prototype) {
    intrinsics["%ImmutableArrayBufferPrototype%"] = iabProto;
  }
  return intrinsics;
};
const tameHarden = (safeHarden2, hardenTaming) => {
  if (hardenTaming === "safe") {
    return safeHarden2;
  }
  Object.isExtensible = () => false;
  Object.isFrozen = () => true;
  Object.isSealed = () => true;
  Reflect.isExtensible = () => false;
  if (safeHarden2.isFake) {
    return safeHarden2;
  }
  const fakeHarden = (arg) => arg;
  fakeHarden.isFake = true;
  return freeze$4(fakeHarden);
};
freeze$4(tameHarden);
const tameSymbolConstructor = () => {
  const OriginalSymbol = Symbol$2;
  const SymbolPrototype = OriginalSymbol.prototype;
  const SharedSymbol = functionBind(Symbol$2, void 0);
  defineProperties$1(SymbolPrototype, {
    constructor: {
      value: SharedSymbol
      // leave other `constructor` attributes as is
    }
  });
  const originalDescsEntries = entries(
    getOwnPropertyDescriptors$1(OriginalSymbol)
  );
  const descs = fromEntries(
    arrayMap(originalDescsEntries, ([name, desc]) => [
      name,
      { ...desc, configurable: true }
    ])
  );
  defineProperties$1(SharedSymbol, descs);
  return { "%SharedSymbol%": SharedSymbol };
};
const throws = (thunk) => {
  try {
    thunk();
    return false;
  } catch (er) {
    return true;
  }
};
const tameFauxDataProperty = (obj, prop, expectedValue) => {
  if (obj === void 0) {
    return false;
  }
  const desc = getOwnPropertyDescriptor$1(obj, prop);
  if (!desc || "value" in desc) {
    return false;
  }
  const { get, set } = desc;
  if (typeof get !== "function" || typeof set !== "function") {
    return false;
  }
  if (get() !== expectedValue) {
    return false;
  }
  if (apply$2(get, obj, []) !== expectedValue) {
    return false;
  }
  const testValue = "Seems to be a setter";
  const subject1 = { __proto__: null };
  apply$2(set, subject1, [testValue]);
  if (subject1[prop] !== testValue) {
    return false;
  }
  const subject2 = { __proto__: obj };
  apply$2(set, subject2, [testValue]);
  if (subject2[prop] !== testValue) {
    return false;
  }
  if (!throws(() => apply$2(set, obj, [expectedValue]))) {
    return false;
  }
  if ("originalValue" in get) {
    return false;
  }
  if (desc.configurable === false) {
    return false;
  }
  defineProperty$2(obj, prop, {
    value: expectedValue,
    writable: true,
    enumerable: desc.enumerable,
    configurable: true
  });
  return true;
};
const tameFauxDataProperties = (intrinsics) => {
  tameFauxDataProperty(
    intrinsics["%IteratorPrototype%"],
    "constructor",
    intrinsics.Iterator
  );
  tameFauxDataProperty(
    intrinsics["%IteratorPrototype%"],
    toStringTagSymbol$1,
    "Iterator"
  );
};
const tameRegeneratorRuntime = () => {
  const iter = iteratorPrototype[iteratorSymbol];
  defineProperty$2(iteratorPrototype, iteratorSymbol, {
    configurable: true,
    get() {
      return iter;
    },
    set(value) {
      if (this === iteratorPrototype) return;
      if (hasOwn(this, iteratorSymbol)) {
        this[iteratorSymbol] = value;
      }
      defineProperty$2(this, iteratorSymbol, {
        value,
        writable: true,
        enumerable: true,
        configurable: true
      });
    }
  });
};
const shimArrayBufferTransfer = () => {
  if (typeof arrayBufferPrototype$2.transfer === "function") {
    return {};
  }
  const clone = universalThis.structuredClone;
  if (typeof clone !== "function") {
    return {};
  }
  const methods = {
    /**
     * @param {number} [newLength]
     */
    transfer(newLength = void 0) {
      const oldLength = arrayBufferGetByteLength(this);
      if (newLength === void 0 || newLength === oldLength) {
        return clone(this, { transfer: [this] });
      }
      if (typeof newLength !== "number") {
        throw TypeError$3(`transfer newLength if provided must be a number`);
      }
      if (newLength > oldLength) {
        const result = new ArrayBuffer$2(newLength);
        const taOld = new Uint8Array$1(this);
        const taNew = new Uint8Array$1(result);
        typedArraySet(taNew, taOld);
        clone(this, { transfer: [this] });
        return result;
      } else {
        const result = arrayBufferSlice$1(this, 0, newLength);
        clone(this, { transfer: [this] });
        return result;
      }
    }
  };
  defineProperty$2(arrayBufferPrototype$2, "transfer", {
    // @ts-expect-error
    value: methods.transfer,
    writable: true,
    enumerable: false,
    configurable: true
  });
  return {};
};
const makeReportPrinter = (print) => {
  let indent = false;
  const printIndent = (...args) => {
    if (indent) {
      print(" ", ...args);
    } else {
      print(...args);
    }
  };
  return (
    /** @type {GroupReporter} */
    {
      warn(...args) {
        printIndent(...args);
      },
      error(...args) {
        printIndent(...args);
      },
      groupCollapsed(...args) {
        assert(!indent);
        print(...args);
        indent = true;
      },
      groupEnd() {
        indent = false;
      }
    }
  );
};
const mute = () => {
};
const chooseReporter = (reporting) => {
  if (reporting === "none") {
    return makeReportPrinter(mute);
  }
  if (reporting === "console" || universalThis.window === universalThis || universalThis.importScripts !== void 0) {
    return console;
  }
  if (universalThis.console !== void 0) {
    const console2 = universalThis.console;
    const error = functionBind(console2.error, console2);
    return makeReportPrinter(error);
  }
  if (universalThis.print !== void 0) {
    return makeReportPrinter(universalThis.print);
  }
  return makeReportPrinter(mute);
};
const reportInGroup = (groupLabel, console2, callback) => {
  const { warn, error, groupCollapsed, groupEnd } = console2;
  const grouping = groupCollapsed && groupEnd;
  let groupStarted = false;
  try {
    return callback({
      warn(...args) {
        if (grouping && !groupStarted) {
          groupCollapsed(groupLabel);
          groupStarted = true;
        }
        warn(...args);
      },
      error(...args) {
        if (grouping && !groupStarted) {
          groupCollapsed(groupLabel);
          groupStarted = true;
        }
        error(...args);
      }
    });
  } finally {
    if (grouping && groupStarted) {
      groupEnd();
      groupStarted = false;
    }
  }
};
const { Fail, details: X, quote: q } = assert;
let priorRepairIntrinsics;
let priorHardenIntrinsics;
const safeHarden = makeHardener();
const probeHostEvaluators = () => {
  let functionAllowed;
  try {
    functionAllowed = FERAL_FUNCTION("return true")();
  } catch (_error) {
    functionAllowed = false;
  }
  let evalAllowed;
  try {
    evalAllowed = FERAL_EVAL("true");
  } catch (_error) {
    evalAllowed = false;
  }
  let directEvalAllowed;
  if (functionAllowed && evalAllowed) {
    directEvalAllowed = FERAL_FUNCTION(
      "eval",
      "SES_changed",
      `        eval("SES_changed = true");
        return SES_changed;
      `
    )(FERAL_EVAL, false);
    if (!directEvalAllowed) {
      delete universalThis.SES_changed;
    }
  }
  return { functionAllowed, evalAllowed, directEvalAllowed };
};
const repairIntrinsics = (options = {}) => {
  const {
    errorTaming = (
      /** @type {'safe' | 'unsafe' | 'unsafe-debug'} */
      getEnvironmentOption("LOCKDOWN_ERROR_TAMING", "safe", ["unsafe", "unsafe-debug"])
    ),
    errorTrapping = (
      /** @type {'platform' | 'none' | 'report' | 'abort' | 'exit'} */
      getEnvironmentOption("LOCKDOWN_ERROR_TRAPPING", "platform", [
        "none",
        "report",
        "abort",
        "exit"
      ])
    ),
    reporting = (
      /** @type {'platform' | 'console' | 'none'} */
      getEnvironmentOption("LOCKDOWN_REPORTING", "platform", ["console", "none"])
    ),
    unhandledRejectionTrapping = (
      /** @type {'none' | 'report'} */
      getEnvironmentOption("LOCKDOWN_UNHANDLED_REJECTION_TRAPPING", "report", ["none"])
    ),
    regExpTaming = (
      /** @type {'safe' | 'unsafe'} */
      getEnvironmentOption("LOCKDOWN_REGEXP_TAMING", "safe", ["unsafe"])
    ),
    localeTaming = (
      /** @type {'safe' | 'unsafe'} */
      getEnvironmentOption("LOCKDOWN_LOCALE_TAMING", "safe", ["unsafe"])
    ),
    consoleTaming = (
      /** @type {'unsafe' | 'safe'} */
      getEnvironmentOption("LOCKDOWN_CONSOLE_TAMING", "safe", ["unsafe"])
    ),
    overrideTaming = (
      /** @type {'moderate' | 'min' | 'severe'} */
      getEnvironmentOption("LOCKDOWN_OVERRIDE_TAMING", "moderate", ["min", "severe"])
    ),
    stackFiltering = (
      /** @type {'concise' | 'omit-frames' | 'shorten-paths' | 'verbose'} */
      getEnvironmentOption("LOCKDOWN_STACK_FILTERING", "concise", [
        "omit-frames",
        "shorten-paths",
        "verbose"
      ])
    ),
    domainTaming = (
      /** @type {'safe' | 'unsafe'} */
      getEnvironmentOption("LOCKDOWN_DOMAIN_TAMING", "safe", ["unsafe"])
    ),
    evalTaming = (
      /** @type {'safe-eval' | 'unsafe-eval' | 'no-eval'} */
      getEnvironmentOption("LOCKDOWN_EVAL_TAMING", "safe-eval", [
        "unsafe-eval",
        "no-eval",
        // deprecated
        "safeEval",
        "unsafeEval",
        "noEval"
      ])
    ),
    overrideDebug = (
      /** @type {string[]} */
      arrayFilter(
        stringSplit$1(getEnvironmentOption("LOCKDOWN_OVERRIDE_DEBUG", ""), ","),
        /** @param {string} debugName */
        (debugName) => debugName !== ""
      )
    ),
    legacyRegeneratorRuntimeTaming = (
      /** @type {'safe' | 'unsafe-ignore'} */
      getEnvironmentOption("LOCKDOWN_LEGACY_REGENERATOR_RUNTIME_TAMING", "safe", [
        "unsafe-ignore"
      ])
    ),
    __hardenTaming__ = (
      /** @type {'safe' | 'unsafe'} */
      getEnvironmentOption("LOCKDOWN_HARDEN_TAMING", "safe", ["unsafe"])
    ),
    dateTaming,
    // deprecated
    mathTaming,
    // deprecated
    ...extraOptions
  } = options;
  const extraOptionsNames = ownKeys$2(extraOptions);
  extraOptionsNames.length === 0 || Fail`lockdown(): non supported option ${q(extraOptionsNames)}`;
  const reporter = chooseReporter(reporting);
  const { warn } = reporter;
  if (dateTaming !== void 0) {
    warn(
      `SES The 'dateTaming' option is deprecated and does nothing. In the future specifying it will be an error.`
    );
  }
  if (mathTaming !== void 0) {
    warn(
      `SES The 'mathTaming' option is deprecated and does nothing. In the future specifying it will be an error.`
    );
  }
  priorRepairIntrinsics === void 0 || // eslint-disable-next-line @endo/no-polymorphic-call
  assert.fail(
    X`Already locked down at ${priorRepairIntrinsics} (SES_ALREADY_LOCKED_DOWN)`,
    TypeError$3
  );
  priorRepairIntrinsics = TypeError$3("Prior lockdown (SES_ALREADY_LOCKED_DOWN)");
  priorRepairIntrinsics.stack;
  const { functionAllowed, evalAllowed, directEvalAllowed } = probeHostEvaluators();
  if (directEvalAllowed === false && evalTaming === "safe-eval" && (functionAllowed || evalAllowed)) {
    throw TypeError$3(
      "SES cannot initialize unless 'eval' is the original intrinsic 'eval', suitable for direct eval (dynamically scoped eval) (SES_DIRECT_EVAL)"
    );
  }
  const seemsToBeLockedDown = () => {
    return universalThis.Function.prototype.constructor !== universalThis.Function && // @ts-ignore harden is absent on globalThis type def.
    typeof universalThis.harden === "function" && // @ts-ignore lockdown is absent on globalThis type def.
    typeof universalThis.lockdown === "function" && universalThis.Date.prototype.constructor !== universalThis.Date && typeof universalThis.Date.now === "function" && // @ts-ignore does not recognize that Date constructor is a special
    // Function.
    // eslint-disable-next-line @endo/no-polymorphic-call
    is(universalThis.Date.prototype.constructor.now(), NaN);
  };
  if (seemsToBeLockedDown()) {
    throw TypeError$3(
      `Already locked down but not by this SES instance (SES_MULTIPLE_INSTANCES)`
    );
  }
  tameDomains(domainTaming);
  const markVirtualizedNativeFunction2 = tameFunctionToString();
  const { addIntrinsics, completePrototypes, finalIntrinsics } = makeIntrinsicsCollector(reporter);
  const tamedHarden = tameHarden(safeHarden, __hardenTaming__);
  addIntrinsics({ harden: tamedHarden });
  addIntrinsics(tameFunctionConstructors());
  addIntrinsics(tameDateConstructor());
  addIntrinsics(tameErrorConstructor(errorTaming, stackFiltering));
  addIntrinsics(tameMathObject());
  addIntrinsics(tameRegExpConstructor(regExpTaming));
  addIntrinsics(tameSymbolConstructor());
  addIntrinsics(shimArrayBufferTransfer());
  addIntrinsics(tameModuleSource());
  addIntrinsics(getAnonymousIntrinsics());
  completePrototypes();
  const intrinsics = finalIntrinsics();
  const hostIntrinsics = { __proto__: null };
  if (typeof universalThis.Buffer === "function") {
    hostIntrinsics.Buffer = universalThis.Buffer;
  }
  let optGetStackString;
  if (errorTaming === "safe") {
    optGetStackString = intrinsics["%InitialGetStackString%"];
  }
  const consoleRecord = tameConsole(
    consoleTaming,
    errorTrapping,
    unhandledRejectionTrapping,
    optGetStackString
  );
  universalThis.console = /** @type {Console} */
  consoleRecord.console;
  if (typeof /** @type {any} */
  consoleRecord.console._times === "object") {
    hostIntrinsics.SafeMap = getPrototypeOf$1(
      // eslint-disable-next-line no-underscore-dangle
      /** @type {any} */
      consoleRecord.console._times
    );
  }
  if ((errorTaming === "unsafe" || errorTaming === "unsafe-debug") && universalThis.assert === assert) {
    universalThis.assert = makeAssert(void 0, true);
  }
  tameLocaleMethods(intrinsics, localeTaming);
  tameFauxDataProperties(intrinsics);
  reportInGroup(
    "SES Removing unpermitted intrinsics",
    reporter,
    (groupReporter) => removeUnpermittedIntrinsics(
      intrinsics,
      markVirtualizedNativeFunction2,
      groupReporter
    )
  );
  setGlobalObjectConstantProperties(universalThis);
  setGlobalObjectMutableProperties(universalThis, {
    intrinsics,
    newGlobalPropertyNames: initialGlobalPropertyNames,
    makeCompartmentConstructor,
    markVirtualizedNativeFunction: markVirtualizedNativeFunction2
  });
  if (evalTaming === "no-eval" || // deprecated
  evalTaming === "noEval") {
    setGlobalObjectEvaluators(
      universalThis,
      noEvalEvaluate,
      markVirtualizedNativeFunction2
    );
  } else if (evalTaming === "safe-eval" || // deprecated
  evalTaming === "safeEval") {
    const { safeEvaluate } = makeSafeEvaluator({ globalObject: universalThis });
    setGlobalObjectEvaluators(
      universalThis,
      safeEvaluate,
      markVirtualizedNativeFunction2
    );
  } else ;
  const hardenIntrinsics = () => {
    priorHardenIntrinsics === void 0 || // eslint-disable-next-line @endo/no-polymorphic-call
    assert.fail(
      X`Already locked down at ${priorHardenIntrinsics} (SES_ALREADY_LOCKED_DOWN)`,
      TypeError$3
    );
    priorHardenIntrinsics = TypeError$3(
      "Prior lockdown (SES_ALREADY_LOCKED_DOWN)"
    );
    priorHardenIntrinsics.stack;
    reportInGroup(
      "SES Enabling property overrides",
      reporter,
      (groupReporter) => enablePropertyOverrides(
        intrinsics,
        overrideTaming,
        groupReporter,
        overrideDebug
      )
    );
    if (legacyRegeneratorRuntimeTaming === "unsafe-ignore") {
      tameRegeneratorRuntime();
    }
    const toHarden = {
      intrinsics,
      hostIntrinsics,
      globals: {
        // Harden evaluators
        Function: universalThis.Function,
        eval: universalThis.eval,
        // @ts-ignore Compartment does exist on globalThis
        Compartment: universalThis.Compartment,
        // Harden Symbol
        Symbol: universalThis.Symbol
      }
    };
    for (const prop of getOwnPropertyNames(initialGlobalPropertyNames)) {
      toHarden.globals[prop] = universalThis[prop];
    }
    tamedHarden(toHarden);
    return tamedHarden;
  };
  return hardenIntrinsics;
};
universalThis.lockdown = (options) => {
  const hardenIntrinsics = repairIntrinsics(options);
  universalThis.harden = hardenIntrinsics();
};
universalThis.repairIntrinsics = (options) => {
  const hardenIntrinsics = repairIntrinsics(options);
  universalThis.hardenIntrinsics = () => {
    universalThis.harden = hardenIntrinsics();
  };
};
const markVirtualizedNativeFunction = tameFunctionToString();
const muteReporter = chooseReporter("none");
universalThis.Compartment = makeCompartmentConstructor(
  makeCompartmentConstructor,
  // Any reporting that would need to be done should have already been done
  // during `lockdown()`.
  // See https://github.com/endojs/endo/pull/2624#discussion_r1840979770
  getGlobalIntrinsics(universalThis, muteReporter),
  markVirtualizedNativeFunction,
  {
    enforceNew: true
  }
);
universalThis.assert = assert;
const makeCausalConsoleFromLoggerForSesAva = defineCausalConsoleFromLogger(loggedErrorHandler);
const MAKE_CAUSAL_CONSOLE_FROM_LOGGER_KEY_FOR_SES_AVA = symbolFor(
  "MAKE_CAUSAL_CONSOLE_FROM_LOGGER_KEY_FOR_SES_AVA"
);
universalThis[MAKE_CAUSAL_CONSOLE_FROM_LOGGER_KEY_FOR_SES_AVA] = makeCausalConsoleFromLoggerForSesAva;
let sesInitialized = false;
function initializeSES() {
  if (sesInitialized) return;
  try {
    lockdown({
      errorTaming: "unsafe",
      // Better error messages during development
      consoleTaming: "unsafe",
      // Allow console.log for user debugging
      stackFiltering: "verbose"
    });
    sesInitialized = true;
    console.log("✓ SES lockdown initialized");
  } catch (error) {
    console.error("Failed to initialize SES:", error);
    throw error;
  }
}
class ScriptSandbox {
  // Persistent shared scope per document
  constructor(api) {
    __publicField(this, "api");
    __publicField(this, "compartments", /* @__PURE__ */ new Map());
    __publicField(this, "scopes", /* @__PURE__ */ new Map());
    this.api = api;
    initializeSES();
  }
  /**
   * Create a new isolated compartment for a document with persistent shared scope
   */
  createCompartment(documentId, frontmatter = {}) {
    try {
      const scope = {
        ...frontmatter
        // Include frontmatter variables
      };
      this.scopes.set(documentId, scope);
      const api = this.api;
      const compartment = new Compartment({
        // Console for debugging
        console,
        // Math and Date are safe
        Math,
        Date,
        // Persistent shared scope (writable)
        scope,
        // Engine API (capability-based)
        term: this.api.term,
        termCanvas: this.api.termCanvas,
        layer: this.api.layer,
        key: this.api.key,
        mouse: this.api.mouse,
        // Theme API
        getStyle: this.api.getStyle,
        theme: this.api.theme,
        // Global accessors (as functions, not getters, for SES compatibility)
        getMouseX: () => api.mouseX,
        getMouseY: () => api.mouseY,
        getTermWidth: () => api.termWidth,
        getTermHeight: () => api.termHeight,
        // Also expose as properties for convenience (but these might not work in strict SES)
        get mouseX() {
          return api.mouseX;
        },
        get mouseY() {
          return api.mouseY;
        },
        get termWidth() {
          return api.termWidth;
        },
        get termHeight() {
          return api.termHeight;
        },
        // Read-only state accessors
        getFrame: this.api.getFrame,
        getTime: this.api.getTime,
        getDelta: this.api.getDelta
        // NO ACCESS TO:
        // - fetch (network)
        // - localStorage (storage)
        // - document (DOM)
        // - window (global)
        // - eval (code injection)
        // - Function constructor
        // - XMLHttpRequest
      });
      this.compartments.set(documentId, compartment);
      return compartment;
    } catch (error) {
      console.error(`Failed to create compartment for ${documentId}:`, error);
      throw error;
    }
  }
  /**
   * Execute a code block in the document's persistent scope
   * Makes scope variables available as top-level variables
   * Captures newly defined variables back into scope
   * Returns function result or undefined
   */
  executeCodeBlock(documentId, code, skipTransform = false) {
    const compartment = this.compartments.get(documentId);
    const scopeObj = this.scopes.get(documentId);
    if (!compartment || !scopeObj) {
      console.error(`No compartment/scope found for ${documentId}`);
      return null;
    }
    try {
      let transformedCode = skipTransform ? code : this.transformCodeForScope(code);
      const wrappedCode = transformedCode;
      const result = compartment.evaluate(wrappedCode);
      return result;
    } catch (error) {
      console.error(`Error executing code block in ${documentId}:`, error);
      console.error("Stack:", error.stack);
      return null;
    }
  }
  /**
   * Transform variable declarations to scope assignments
   * Examples:
   *   let x = 10; -> scope.x = 10;
   *   const y = 20; -> scope.y = 20;
   *   function update(delta) { } -> scope.update = function update(delta) { }
   */
  transformCodeForScope(code) {
    let transformed = code;
    console.log("🔧 Transforming code, original length:", code.length);
    transformed = transformed.replace(/^(\s*)(let|const|var)\s+(\w+)\s*=\s*([^;]+);/gm, (_m, indent, _kw, varName, value) => {
      console.log(`  📝 Transforming: ${_kw} ${varName} = ${value.substring(0, 50)}...`);
      if (value.trim().startsWith("function")) {
        return `${indent}scope.${varName} = ${value};`;
      }
      return `${indent}scope.${varName} = ${value};`;
    });
    transformed = transformed.replace(/^(\s*)(let|const|var)\s+(\w+)\s*;/gm, "$1scope.$3 = undefined;");
    transformed = transformed.replace(/^(\s*)function\s+(\w+)\s*\(/gm, "$1scope.$2 = function $2(");
    console.log("✅ Transformed code, new length:", transformed.length);
    return transformed;
  }
  /**
   * Execute user code and extract init/update/render/input handlers from scope
   */
  extractHandlers(documentId) {
    const scope = this.scopes.get(documentId);
    if (!scope) {
      console.error(`No scope found for ${documentId}`);
      return null;
    }
    try {
      const validHandlers = {};
      if (typeof scope.init === "function") {
        validHandlers.init = scope.init;
      }
      if (typeof scope.update === "function") {
        validHandlers.update = scope.update;
      }
      if (typeof scope.render === "function") {
        validHandlers.render = scope.render;
      }
      if (typeof scope.input === "function") {
        validHandlers.input = scope.input;
      }
      return Object.keys(validHandlers).length > 0 ? validHandlers : null;
    } catch (error) {
      console.error(`Error extracting handlers from ${documentId}:`, error);
      return null;
    }
  }
  /**
   * Get the scope object for a document (for inspection)
   */
  getScope(documentId) {
    return this.scopes.get(documentId) || null;
  }
  /**
   * Destroy a compartment and clean up resources
   */
  destroyCompartment(documentId) {
    this.compartments.delete(documentId);
    this.scopes.delete(documentId);
  }
  /**
   * Clear all compartments
   */
  clearAll() {
    this.compartments.clear();
    this.scopes.clear();
  }
}
function parseMarkdown(source) {
  const sections = extractSections(source);
  const codeBlocks = extractCodeBlocks(source);
  const metadata = extractFrontmatter(source);
  return {
    sections,
    codeBlocks,
    metadata
  };
}
function extractSections(source) {
  const lines = source.split("\n");
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const atxMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (atxMatch) {
      headings.push({
        level: atxMatch[1].length,
        title: atxMatch[2].trim(),
        line: i
      });
      continue;
    }
    if (i > 0 && lines[i - 1].trim().length > 0) {
      if (/^=+$/.test(line.trim())) {
        headings.push({
          level: 1,
          title: lines[i - 1].trim(),
          line: i - 1
        });
      } else if (/^-+$/.test(line.trim())) {
        headings.push({
          level: 2,
          title: lines[i - 1].trim(),
          line: i - 1
        });
      }
    }
  }
  const rootSections = [];
  const stack = [];
  for (let i = 0; i < headings.length; i++) {
    const heading = headings[i];
    const nextHeading = headings[i + 1];
    const endLine = nextHeading ? nextHeading.line - 1 : lines.length - 1;
    const contentLines = lines.slice(heading.line + 1, endLine + 1);
    const content = contentLines.join("\n").trim();
    const section = {
      title: heading.title,
      level: heading.level,
      content,
      startLine: heading.line,
      endLine,
      children: []
    };
    while (stack.length > 0 && stack[stack.length - 1].level >= heading.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      rootSections.push(section);
    } else {
      stack[stack.length - 1].section.children.push(section);
    }
    stack.push({ section, level: heading.level });
  }
  return rootSections;
}
function extractCodeBlocks(source) {
  const lines = source.split("\n");
  const codeBlocks = [];
  let inCodeBlock = false;
  let currentBlock = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCodeBlock) {
        const declLine = line.trim().substring(3).trim();
        const parts = declLine.split(/\s+/);
        const lang = parts[0] || "text";
        const metadata = {};
        for (let j = 1; j < parts.length; j++) {
          const pair = parts[j].split(":");
          if (pair.length === 2) {
            metadata[pair[0]] = pair[1];
          }
        }
        currentBlock = {
          lang,
          metadata,
          lines: [],
          startLine: i
        };
        inCodeBlock = true;
      } else {
        if (currentBlock) {
          const block = {
            lang: currentBlock.lang,
            code: currentBlock.lines.join("\n"),
            startLine: currentBlock.startLine,
            endLine: i
          };
          if (Object.keys(currentBlock.metadata).length > 0) {
            block.metadata = currentBlock.metadata;
          }
          codeBlocks.push(block);
        }
        currentBlock = null;
        inCodeBlock = false;
      }
    } else if (inCodeBlock && currentBlock) {
      currentBlock.lines.push(line);
    }
  }
  return codeBlocks;
}
function extractFrontmatter(source) {
  var _a;
  const lines = source.split("\n");
  const metadata = {};
  if (((_a = lines[0]) == null ? void 0 : _a.trim()) === "---") {
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === "---") {
        endIndex = i;
        break;
      }
    }
    if (endIndex > 0) {
      const yamlLines = lines.slice(1, endIndex);
      for (const line of yamlLines) {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          const key = match[1];
          let value = match[2].trim();
          if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          } else if (value === "true") value = true;
          else if (value === "false") value = false;
          else if (!isNaN(Number(value))) value = Number(value);
          metadata[key] = value;
        }
      }
    }
  }
  return metadata;
}
function findSection(sections, title) {
  const normalized = title.toLowerCase().trim();
  for (const section of sections) {
    if (section.title.toLowerCase().trim() === normalized) {
      return section;
    }
    const found = findSection(section.children, title);
    if (found) return found;
  }
  return null;
}
function flattenSections(sections) {
  const result = [];
  for (const section of sections) {
    result.push(section);
    if (section.children.length > 0) {
      result.push(...flattenSections(section.children));
    }
  }
  return result;
}
const THEMES = {
  neotopia: {
    bg: { r: 0, g: 17, b: 17 },
    // Deep teal
    bgAlt: { r: 9, g: 52, b: 58 },
    // Lighter teal
    fg: { r: 224, g: 224, b: 224 },
    // Bright gray
    fgAlt: { r: 144, g: 144, b: 144 },
    // Medium gray
    accent1: { r: 0, g: 217, b: 142 },
    // Aquamarine
    accent2: { r: 255, g: 255, b: 0 },
    // Yellow
    accent3: { r: 255, g: 0, b: 110 }
    // Pink
  },
  neonopia: {
    bg: { r: 5, g: 0, b: 0 },
    // Deep burgundy
    bgAlt: { r: 52, g: 9, b: 5 },
    // Dark coral
    fg: { r: 160, g: 160, b: 160 },
    // Dark gray
    fgAlt: { r: 111, g: 111, b: 111 },
    // Lighter gray
    accent1: { r: 255, g: 38, b: 113 },
    // Hot pink
    accent2: { r: 0, g: 0, b: 255 },
    // Pure blue
    accent3: { r: 0, g: 255, b: 145 }
    // Bright mint
  },
  catppuccin: {
    bg: { r: 30, g: 30, b: 46 },
    bgAlt: { r: 49, g: 50, b: 68 },
    fg: { r: 205, g: 214, b: 244 },
    fgAlt: { r: 108, g: 112, b: 134 },
    accent1: { r: 245, g: 194, b: 231 },
    // Pink
    accent2: { r: 137, g: 180, b: 250 },
    // Blue
    accent3: { r: 166, g: 227, b: 161 }
    // Green
  },
  nord: {
    bg: { r: 46, g: 52, b: 64 },
    bgAlt: { r: 59, g: 66, b: 82 },
    fg: { r: 236, g: 239, b: 244 },
    fgAlt: { r: 216, g: 222, b: 233 },
    accent1: { r: 136, g: 192, b: 208 },
    // Frost cyan
    accent2: { r: 129, g: 161, b: 193 },
    // Frost teal
    accent3: { r: 163, g: 190, b: 140 }
    // Aurora green
  },
  dracula: {
    bg: { r: 40, g: 42, b: 54 },
    bgAlt: { r: 68, g: 71, b: 90 },
    fg: { r: 248, g: 248, b: 242 },
    fgAlt: { r: 98, g: 114, b: 164 },
    accent1: { r: 255, g: 121, b: 198 },
    // Pink
    accent2: { r: 139, g: 233, b: 253 },
    // Cyan
    accent3: { r: 80, g: 250, b: 123 }
    // Green
  },
  outrun: {
    bg: { r: 26, g: 0, b: 51 },
    bgAlt: { r: 45, g: 0, b: 85 },
    fg: { r: 240, g: 240, b: 255 },
    fgAlt: { r: 139, g: 92, b: 246 },
    accent1: { r: 255, g: 0, b: 110 },
    // Neon pink
    accent2: { r: 0, g: 245, b: 255 },
    // Electric cyan
    accent3: { r: 255, g: 190, b: 11 }
    // Golden yellow
  },
  alleycat: {
    bg: { r: 10, g: 10, b: 15 },
    bgAlt: { r: 26, g: 26, b: 46 },
    fg: { r: 224, g: 224, b: 255 },
    fgAlt: { r: 107, g: 127, b: 215 },
    accent1: { r: 0, g: 255, b: 255 },
    // Electric cyan
    accent2: { r: 255, g: 0, b: 255 },
    // Magenta
    accent3: { r: 0, g: 255, b: 0 }
    // Matrix green
  },
  terminal: {
    bg: { r: 10, g: 10, b: 10 },
    bgAlt: { r: 26, g: 26, b: 26 },
    fg: { r: 0, g: 255, b: 0 },
    fgAlt: { r: 0, g: 136, b: 0 },
    accent1: { r: 0, g: 255, b: 0 },
    // Bright green
    accent2: { r: 0, g: 204, b: 0 },
    // Medium green
    accent3: { r: 0, g: 170, b: 0 }
    // Dark green
  },
  solardark: {
    bg: { r: 0, g: 43, b: 54 },
    bgAlt: { r: 7, g: 54, b: 66 },
    fg: { r: 131, g: 148, b: 150 },
    fgAlt: { r: 88, g: 110, b: 117 },
    accent1: { r: 38, g: 139, b: 210 },
    // Blue
    accent2: { r: 42, g: 161, b: 152 },
    // Cyan
    accent3: { r: 133, g: 153, b: 0 }
    // Green
  },
  solarlight: {
    bg: { r: 253, g: 246, b: 227 },
    bgAlt: { r: 238, g: 232, b: 213 },
    fg: { r: 101, g: 123, b: 131 },
    fgAlt: { r: 147, g: 161, b: 161 },
    accent1: { r: 38, g: 139, b: 210 },
    // Blue
    accent2: { r: 42, g: 161, b: 152 },
    // Cyan
    accent3: { r: 133, g: 153, b: 0 }
    // Green
  },
  coffee: {
    bg: { r: 242, g: 211, b: 172 },
    // Cream
    bgAlt: { r: 115, g: 20, b: 37 },
    // Dark burgundy
    fg: { r: 38, g: 3, b: 36 },
    // Deep purple-brown
    fgAlt: { r: 191, g: 140, b: 111 },
    // Tan
    accent1: { r: 191, g: 52, b: 52 },
    // Rich red
    accent2: { r: 191, g: 140, b: 111 },
    // Tan
    accent3: { r: 242, g: 211, b: 172 }
    // Cream accent
  },
  stonegarden: {
    bg: { r: 26, g: 29, b: 30 },
    // Darker stone
    bgAlt: { r: 45, g: 48, b: 50 },
    // Elevated surfaces
    fg: { r: 232, g: 230, b: 227 },
    // Soft cream
    fgAlt: { r: 152, g: 150, b: 147 },
    // Muted stone
    accent1: { r: 141, g: 184, b: 141 },
    // Moss green
    accent2: { r: 196, g: 167, b: 119 },
    // Warm sand
    accent3: { r: 90, g: 122, b: 142 }
    // Blue-gray
  }
};
function applyTheme(theme) {
  return {
    // Default body text
    default: {
      fg: theme.fg,
      bg: theme.bg
    },
    // Direct access to theme base colors
    fg: {
      fg: theme.fg,
      bg: theme.bg
    },
    bg: {
      fg: theme.fg,
      bg: theme.bg
    },
    fgAlt: {
      fg: theme.fgAlt,
      bg: theme.bg
    },
    bgAlt: {
      fg: theme.fg,
      bg: theme.bgAlt
    },
    // Direct access to accent colors
    accent1: {
      fg: theme.accent1,
      bg: theme.bg
    },
    accent2: {
      fg: theme.accent2,
      bg: theme.bg
    },
    accent3: {
      fg: theme.accent3,
      bg: theme.bg
    },
    // Inverted colors (for hidden cells, selections, etc.)
    inverted: {
      fg: theme.bg,
      bg: theme.fg,
      bold: true
    },
    // Dim/muted text
    dim: {
      fg: theme.fgAlt,
      bg: theme.bg
    },
    // Primary heading (h1)
    heading: {
      fg: theme.accent1,
      bg: theme.bg,
      bold: true
    },
    // Secondary heading (h2)
    heading2: {
      fg: theme.accent2,
      bg: theme.bg,
      bold: true
    },
    // Tertiary heading (h3+)
    heading3: {
      fg: theme.accent3,
      bg: theme.bg
    },
    // Links
    link: {
      fg: theme.accent2,
      bg: theme.bg,
      underline: false
    },
    // Interactive buttons
    button: {
      fg: theme.accent1,
      bg: theme.bgAlt,
      bold: true
    },
    // Borders and frames
    border: {
      fg: theme.accent2,
      bg: theme.bg
    },
    // Elevated surfaces (cards, panels)
    surface: {
      fg: theme.fg,
      bg: theme.bgAlt
    },
    // Code or monospace text
    code: {
      fg: theme.accent3,
      bg: theme.bgAlt
    },
    // Warnings and errors
    warning: {
      fg: theme.accent3,
      bg: theme.bg,
      bold: true
    }
  };
}
function getTheme(name) {
  const normalized = name.toLowerCase();
  return THEMES[normalized] || THEMES.neotopia;
}
function getAvailableThemes() {
  return Object.keys(THEMES);
}
class StorieEngine {
  constructor(canvas, config = {}) {
    // Core systems
    __publicField(this, "layers");
    __publicField(this, "input");
    __publicField(this, "renderer");
    __publicField(this, "sandbox");
    // Theme system
    __publicField(this, "currentTheme");
    __publicField(this, "styleSheet");
    // Timing
    __publicField(this, "frameCount", 0);
    __publicField(this, "elapsedTime", 0);
    __publicField(this, "deltaTime", 0);
    __publicField(this, "lastFrameTime", 0);
    __publicField(this, "running", false);
    // Documents
    __publicField(this, "documents", /* @__PURE__ */ new Map());
    __publicField(this, "activeDocumentId", null);
    // Canvas viewport (reserved for future use)
    // private viewportX: number = 0;
    // private viewportY: number = 0;
    // Config
    __publicField(this, "width");
    __publicField(this, "height");
    // Canvas reference for event listeners
    __publicField(this, "canvas");
    this.canvas = canvas;
    this.width = config.width || 80;
    this.height = config.height || 24;
    this.currentTheme = getTheme("neotopia");
    this.styleSheet = applyTheme(this.currentTheme);
    this.layers = new LayerStack(this.width, this.height);
    this.input = new InputManager(canvas);
    const preferWebGPU = config.preferWebGPU !== false;
    if (preferWebGPU && navigator.gpu) {
      console.log("✓ WebGPU available, will attempt initialization");
      this.renderer = new WebGPURenderer(canvas, {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize
      });
    } else {
      console.log("✓ Using Canvas2D renderer");
      this.renderer = new Canvas2DRenderer(canvas, {
        fontFamily: config.fontFamily,
        fontSize: config.fontSize
      });
    }
    this.renderer.resize(this.width, this.height);
    const api = this.createUserAPI();
    this.sandbox = new ScriptSandbox(api);
    this.setupEventListeners();
    console.log("✓ S|torie engine initialized");
    console.log(`  Grid: ${this.width}x${this.height}`);
    console.log(`  Renderer: ${this.renderer.constructor.name}`);
    console.log(`  Theme: neotopia (default)`);
  }
  /**
   * Create the API surface exposed to user code
   */
  createUserAPI() {
    const layers = this.layers;
    const engine = this;
    return {
      // Terminal text API
      term: {
        write: (x, y, text, fg, bg) => {
          const layer = this.layers.getActive();
          layer.write(x, y, text, fg, bg);
        },
        clear: () => {
          const layer = this.layers.getActive();
          layer.clear();
        },
        get layerID() {
          return layers.activeLayerId;
        },
        set layerID(id) {
          if (layers.get(id)) {
            layers.activeLayerId = id;
          } else {
            console.warn(`Layer "${id}" does not exist`);
          }
        }
      },
      // Terminal canvas API (character-based drawing)
      termCanvas: {
        plot: (x, y, char, fg, bg) => {
          const layer = this.layers.getActive();
          layer.plot(x, y, char, fg, bg);
        },
        line: (x1, y1, x2, y2, char, fg, bg) => {
          this.drawLine(x1, y1, x2, y2, char, fg, bg);
        },
        rect: (x, y, w, h, char, fg, bg, filled = false) => {
          this.drawRect(x, y, w, h, char, fg, bg, filled);
        },
        scrollTo: (x, y) => {
          console.log(`Scroll to (${x}, ${y})`);
        },
        width: () => this.width,
        height: () => this.height
      },
      // Layer API
      layer: {
        create: (id, width, height) => {
          this.layers.create(id, width, height);
        },
        show: (id) => {
          this.layers.show(id);
        },
        hide: (id) => {
          this.layers.hide(id);
        },
        setAlpha: (id, alpha) => {
          this.layers.setAlpha(id, alpha);
        },
        clear: (id) => {
          const layer = this.layers.get(id);
          if (layer) layer.clear();
        }
      },
      // Input API
      key: {
        down: (key) => this.input.isKeyDown(key),
        pressed: (key) => this.input.isKeyPressed(key),
        released: (key) => this.input.isKeyReleased(key),
        SPACE: KEY.SPACE,
        ENTER: KEY.ENTER,
        ESC: KEY.ESC,
        ARROW_UP: KEY.ARROW_UP,
        ARROW_DOWN: KEY.ARROW_DOWN,
        ARROW_LEFT: KEY.ARROW_LEFT,
        ARROW_RIGHT: KEY.ARROW_RIGHT
      },
      mouse: {
        x: () => {
          const charWidth = this.renderer.getWidth() / this.width;
          return Math.floor(this.input.getMouseX() / charWidth);
        },
        y: () => {
          const charHeight = this.renderer.getHeight() / this.height;
          return Math.floor(this.input.getMouseY() / charHeight);
        },
        down: (button = 0) => this.input.isMouseDown(button),
        clicked: (button = 0) => this.input.isMouseClicked(button)
      },
      // Theme API
      getStyle: (name) => this.getStyle(name),
      theme: this.currentTheme,
      // Global accessors (for convenience)
      get mouseX() {
        const charWidth = engine.renderer.getWidth() / engine.width;
        const pixelX = engine.input.getMouseX();
        const result = Math.floor(pixelX / charWidth);
        console.log(`🔍 mouseX getter: pixelX=${pixelX}, charWidth=${charWidth}, result=${result}`);
        return result;
      },
      get mouseY() {
        const charHeight = engine.renderer.getHeight() / engine.height;
        const pixelY = engine.input.getMouseY();
        const result = Math.floor(pixelY / charHeight);
        console.log(`🔍 mouseY getter: pixelY=${pixelY}, charHeight=${charHeight}, result=${result}`);
        return result;
      },
      get termWidth() {
        return engine.width;
      },
      get termHeight() {
        return engine.height;
      },
      // Read-only state
      getFrame: () => this.frameCount,
      getTime: () => this.elapsedTime,
      getDelta: () => this.deltaTime
    };
  }
  /**
   * Load a markdown document and execute its code with lifecycle hooks
   */
  loadMarkdown(documentId, markdown) {
    var _a;
    try {
      console.log(`Loading document: ${documentId}`);
      const parsed = parseMarkdown(markdown);
      console.log(`  Found ${parsed.sections.length} sections`);
      console.log(`  Found ${parsed.codeBlocks.length} code blocks`);
      if (parsed.metadata.theme) {
        const themeName = String(parsed.metadata.theme).toLowerCase().replace(/['"]/g, "");
        this.currentTheme = getTheme(themeName);
        this.styleSheet = applyTheme(this.currentTheme);
        console.log(`  Theme: ${themeName}`);
      }
      const jsBlocks = parsed.codeBlocks.filter(
        (block) => block.lang === "javascript" || block.lang === "js"
      );
      if (jsBlocks.length === 0) {
        console.warn("  No JavaScript code blocks found");
        return false;
      }
      this.sandbox.createCompartment(documentId, parsed.metadata);
      const initBlocks = [];
      const updateBlocks = [];
      const renderBlocks = [];
      const inputBlocks = [];
      const globalBlocks = [];
      for (const block of jsBlocks) {
        const hook = (_a = block.metadata) == null ? void 0 : _a.on;
        if (hook === "init") {
          initBlocks.push(block.code);
        } else if (hook === "update") {
          updateBlocks.push(block.code);
        } else if (hook === "render") {
          renderBlocks.push(block.code);
        } else if (hook === "input") {
          inputBlocks.push(block.code);
        } else {
          globalBlocks.push(block.code);
        }
      }
      console.log(`  Executing ${globalBlocks.length} global blocks`);
      for (const code of globalBlocks) {
        this.sandbox.executeCodeBlock(documentId, code);
      }
      let currentScope = this.sandbox.getScope(documentId) || {};
      let scopeVarNames = Object.keys(currentScope).filter((k) => !["init", "update", "render", "input"].includes(k));
      if (scopeVarNames.length > 0 && globalBlocks.length > 0) {
        console.log(`  Re-executing global blocks to create closures for ${scopeVarNames.length} variables`);
        const exports2 = scopeVarNames.map((k) => `  scope.${k} = ${k};`).join("\n");
        for (const code of globalBlocks) {
          const wrappedCode = `(function() {
${code}
${exports2}
})();`;
          this.sandbox.executeCodeBlock(documentId, wrappedCode, true);
        }
      }
      currentScope = this.sandbox.getScope(documentId) || {};
      scopeVarNames = Object.keys(currentScope).filter((k) => !["init", "update", "render", "input"].includes(k));
      console.log(`  Scope variables:`, scopeVarNames);
      const hasInit = typeof currentScope.init === "function";
      const hasUpdate = typeof currentScope.update === "function";
      const hasRender = typeof currentScope.render === "function";
      const hasInput = typeof currentScope.input === "function";
      const imports = scopeVarNames.length > 0 ? scopeVarNames.map((k) => `  let ${k} = scope.${k};`).join("\n") : "";
      const exports$1 = scopeVarNames.length > 0 ? scopeVarNames.map((k) => `  scope.${k} = ${k};`).join("\n") : "";
      if (!hasInit && initBlocks.length > 0) {
        console.log(`  Creating init handler from ${initBlocks.length} blocks`);
        const initCode = `scope.init = function() {
${imports}
${initBlocks.join("\n\n")}
${exports$1}
};`;
        console.log("🔍 Generated init handler (first 500 chars):", initCode.substring(0, 500));
        this.sandbox.executeCodeBlock(documentId, initCode, true);
      }
      if (!hasUpdate && updateBlocks.length > 0) {
        console.log(`  Creating update handler from ${updateBlocks.length} blocks`);
        const updateCode = `scope.update = function(delta) {
${imports}
${updateBlocks.join("\n\n")}
${exports$1}
};`;
        this.sandbox.executeCodeBlock(documentId, updateCode, true);
      }
      if (!hasRender && renderBlocks.length > 0) {
        console.log(`  Creating render handler from ${renderBlocks.length} blocks`);
        const renderCode = `scope.render = function() {
${imports}
${renderBlocks.join("\n\n")}
${exports$1}
};`;
        this.sandbox.executeCodeBlock(documentId, renderCode, true);
      }
      if (!hasInput && inputBlocks.length > 0) {
        console.log(`  Creating input handler from ${inputBlocks.length} blocks`);
        const inputCode = `scope.input = function(event) {
${imports}
${inputBlocks.join("\n\n")}
${exports$1}
};`;
        this.sandbox.executeCodeBlock(documentId, inputCode, true);
      }
      const handlers = this.sandbox.extractHandlers(documentId);
      if (!handlers) {
        console.error("  Failed to extract handlers");
        return false;
      }
      this.documents.set(documentId, {
        id: documentId,
        handlers,
        sections: parsed.sections
      });
      if (!this.activeDocumentId) {
        this.activeDocumentId = documentId;
      }
      if (handlers.init) {
        console.log("  Calling init handler");
        try {
          handlers.init();
        } catch (error) {
          console.error("  Error in init:", error);
        }
      }
      console.log("✓ Document loaded successfully");
      return true;
    } catch (error) {
      console.error(`Failed to load document ${documentId}:`, error);
      return false;
    }
  }
  /**
   * Set the active document
   */
  setActiveDocument(documentId) {
    if (this.documents.has(documentId)) {
      this.activeDocumentId = documentId;
    }
  }
  /**
   * Get the currently active document
   */
  getActiveDocument() {
    if (!this.activeDocumentId) return null;
    return this.documents.get(this.activeDocumentId) || null;
  }
  /**
   * Start the main loop (async to support WebGPU init)
   */
  async start() {
    if (this.running) return;
    if ("init" in this.renderer && typeof this.renderer.init === "function") {
      const success = await this.renderer.init();
      if (!success) {
        console.warn("⚠ WebGPU init failed, falling back to Canvas2D");
        const canvas = this.renderer.canvas;
        const fontFamily = this.renderer.fontFamily;
        const fontSize = this.renderer.fontSize;
        this.renderer = new Canvas2DRenderer(canvas, { fontFamily, fontSize });
        this.renderer.resize(this.width, this.height);
      }
    }
    this.running = true;
    this.lastFrameTime = performance.now();
    console.log("✓ Main loop started");
    this.mainLoop(this.lastFrameTime);
  }
  /**
   * Stop the main loop
   */
  stop() {
    this.running = false;
    console.log("✓ Main loop stopped");
  }
  /**
   * Main loop: update, render, composite
   */
  mainLoop(timestamp) {
    if (!this.running) return;
    this.deltaTime = (timestamp - this.lastFrameTime) / 1e3;
    this.lastFrameTime = timestamp;
    this.elapsedTime += this.deltaTime;
    this.update();
    this.render();
    const composited = this.layers.composite();
    this.renderer.render(composited);
    this.input.endFrame();
    this.frameCount++;
    requestAnimationFrame((ts) => this.mainLoop(ts));
  }
  /**
   * Update phase - call user's update handler
   */
  update() {
    var _a;
    const doc = this.getActiveDocument();
    if ((_a = doc == null ? void 0 : doc.handlers) == null ? void 0 : _a.update) {
      try {
        doc.handlers.update(this.deltaTime);
      } catch (error) {
        console.error("Error in update handler:", error);
      }
    }
  }
  /**
   * Render phase - call user's render handler
   */
  render() {
    var _a;
    const doc = this.getActiveDocument();
    if ((_a = doc == null ? void 0 : doc.handlers) == null ? void 0 : _a.render) {
      try {
        doc.handlers.render();
      } catch (error) {
        console.error("Error in render handler:", error);
      }
    }
  }
  /**
   * Helper: Draw a line using Bresenham's algorithm
   */
  drawLine(x1, y1, x2, y2, char, fg, bg) {
    const layer = this.layers.getActive();
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;
    let x = x1, y = y1;
    while (true) {
      layer.plot(x, y, char, fg, bg);
      if (x === x2 && y === y2) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  /**
   * Helper: Draw a rectangle
   */
  drawRect(x, y, w, h, char, fg, bg, filled = false) {
    const layer = this.layers.getActive();
    if (filled) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          layer.plot(px, py, char, fg, bg);
        }
      }
    } else {
      for (let px = x; px < x + w; px++) {
        layer.plot(px, y, char, fg, bg);
        layer.plot(px, y + h - 1, char, fg, bg);
      }
      for (let py = y; py < y + h; py++) {
        layer.plot(x, py, char, fg, bg);
        layer.plot(x + w - 1, py, char, fg, bg);
      }
    }
  }
  /**
   * Resize the engine
   */
  resize(width, height) {
    this.width = width;
    this.height = height;
    this.layers.resize(width, height);
    this.renderer.resize(width, height);
  }
  /**
   * Get a named style from the current theme
   */
  getStyle(name) {
    if (!this.styleSheet) {
      console.warn("StyleSheet not initialized, using default colors");
      return {
        fg: { r: 255, g: 255, b: 255 },
        bg: { r: 0, g: 0, b: 0 }
      };
    }
    const style = this.styleSheet[name];
    if (!style) {
      console.warn(`Style "${name}" not found, using default`);
      return this.styleSheet.default || {
        fg: { r: 255, g: 255, b: 255 },
        bg: { r: 0, g: 0, b: 0 }
      };
    }
    return style;
  }
  /**
   * Set up input event listeners for on:input handlers
   */
  setupEventListeners() {
    this.canvas.addEventListener("keydown", (e) => this.handleKeyEvent(e, "press"));
    this.canvas.addEventListener("keyup", (e) => this.handleKeyEvent(e, "release"));
    this.canvas.addEventListener("mousedown", (e) => this.handleMouseEvent(e, "press"));
    this.canvas.addEventListener("mouseup", (e) => this.handleMouseEvent(e, "release"));
    this.canvas.addEventListener("mousemove", (e) => this.handleMouseMoveEvent(e));
    this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    this.canvas.tabIndex = 0;
    this.canvas.focus();
  }
  /**
   * Handle keyboard events for on:input
   */
  handleKeyEvent(e, action) {
    var _a;
    const doc = this.getActiveDocument();
    if (!((_a = doc == null ? void 0 : doc.handlers) == null ? void 0 : _a.input)) return;
    const mods = [];
    if (e.shiftKey) mods.push("shift");
    if (e.ctrlKey) mods.push("ctrl");
    if (e.altKey) mods.push("alt");
    if (e.metaKey) mods.push("meta");
    let event;
    if (action === "press" && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      event = {
        type: "text",
        text: e.key,
        mods
      };
    } else {
      event = {
        type: "key",
        action,
        key: e.key,
        keyCode: e.keyCode,
        mods
      };
    }
    try {
      const shouldContinue = doc.handlers.input(event);
      if (!shouldContinue) {
        this.stop();
      }
      e.preventDefault();
    } catch (error) {
      console.error("Error in input handler:", error);
    }
  }
  /**
   * Handle mouse button events for on:input
   */
  handleMouseEvent(e, action) {
    var _a;
    const doc = this.getActiveDocument();
    if (!((_a = doc == null ? void 0 : doc.handlers) == null ? void 0 : _a.input)) {
      console.warn("No input handler for mouse event");
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;
    this.input.updateMousePosition(pixelX, pixelY);
    const charWidth = rect.width / this.width;
    const charHeight = rect.height / this.height;
    const x = Math.floor(pixelX / charWidth);
    const y = Math.floor(pixelY / charHeight);
    console.log(`🔍 Mouse calc: pixel(${pixelX.toFixed(1)},${pixelY.toFixed(1)}) display(${rect.width.toFixed(0)}x${rect.height.toFixed(0)}) grid(${this.width}x${this.height}) charSize(${charWidth.toFixed(2)}x${charHeight.toFixed(2)}) result(${x},${y})`);
    const mods = [];
    if (e.shiftKey) mods.push("shift");
    if (e.ctrlKey) mods.push("ctrl");
    if (e.altKey) mods.push("alt");
    if (e.metaKey) mods.push("meta");
    const button = e.button === 0 ? "left" : e.button === 1 ? "middle" : "right";
    const event = {
      type: "mouse",
      action,
      button,
      x,
      y,
      mods
    };
    console.log("🖱️ Mouse event:", action, button, `(${x},${y})`);
    try {
      const shouldContinue = doc.handlers.input(event);
      console.log("   Input handler returned:", shouldContinue);
      if (!shouldContinue) {
        this.stop();
      }
      e.preventDefault();
    } catch (error) {
      console.error("Error in input handler:", error);
    }
  }
  /**
   * Handle mouse move events for on:input
   */
  handleMouseMoveEvent(e) {
    var _a;
    const doc = this.getActiveDocument();
    if (!((_a = doc == null ? void 0 : doc.handlers) == null ? void 0 : _a.input)) return;
    const rect = this.canvas.getBoundingClientRect();
    const charWidth = this.renderer.getWidth() / this.width;
    const charHeight = this.renderer.getHeight() / this.height;
    const x = Math.floor((e.clientX - rect.left) / charWidth);
    const y = Math.floor((e.clientY - rect.top) / charHeight);
    const event = {
      type: "mouse_move",
      x,
      y,
      mods: []
    };
    try {
      doc.handlers.input(event);
    } catch (error) {
      console.error("Error in input handler:", error);
    }
  }
}
const VERSION = "2.0.0-alpha.1";
console.log(`S|torie v${VERSION}`);
export {
  COLORS,
  Canvas2DRenderer,
  InputManager,
  KEY,
  Layer,
  LayerStack,
  StorieEngine,
  THEMES,
  VERSION,
  WebGPURenderer,
  applyTheme,
  findSection,
  flattenSections,
  getAvailableThemes,
  getTheme,
  parseMarkdown
};
