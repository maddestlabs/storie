/**
 * WebGPU renderer for terminal-style graphics
 * Uses Canvas2D only for glyph atlas generation, WebGPU for rendering
 */

import type { Cell, Color } from './types.js';

export interface WebGPURendererConfig {
  fontFamily?: string;
  fontSize?: number;
  charWidth?: number;
  charHeight?: number;
}

export class WebGPURenderer {
  private canvas: HTMLCanvasElement;
  private device: GPUDevice | null = null;
  private context: GPUCanvasContext | null = null;
  private pipeline: GPURenderPipeline | null = null;
  
  private width: number;
  private height: number;
  
  // Font settings
  private fontFamily: string;
  private fontSize: number;
  private charWidth: number;
  private charHeight: number;
  
  // Glyph atlas (Canvas2D for rasterization)
  private atlasCanvas: HTMLCanvasElement;
  private atlasCtx: CanvasRenderingContext2D;
  private glyphCache: Map<string, GlyphInfo> = new Map();
  private atlasTexture: GPUTexture | null = null;
  private atlasSampler: GPUSampler | null = null;
  private atlasX: number = 0;
  private atlasY: number = 0;
  private atlasRowHeight: number = 0;
  private atlasNeedsUpload: boolean = false;
  
  // WebGPU resources
  private uniformBuffer: GPUBuffer | null = null;
  private cellBuffer: GPUBuffer | null = null;
  private cellData: Float32Array | null = null;
  private bindGroup: GPUBindGroup | null = null;
  
  private initialized: boolean = false;
  private fontLoggedOnce: boolean = false;

  constructor(canvas: HTMLCanvasElement, config: WebGPURendererConfig = {}) {
    this.canvas = canvas;
    this.width = 80;
    this.height = 24;
    
    this.fontFamily = config.fontFamily || 'Monaco, Consolas, "Courier New", monospace';
    this.fontSize = config.fontSize || 16;
    this.charWidth = config.charWidth || 10;
    this.charHeight = config.charHeight || 20;
    
    // Create glyph atlas canvas
    this.atlasCanvas = document.createElement('canvas');
    this.atlasCanvas.width = 2048;
    this.atlasCanvas.height = 2048;
    const ctx = this.atlasCanvas.getContext('2d', { 
      alpha: true,
      willReadFrequently: true
    });
    if (!ctx) throw new Error('Failed to create atlas context');
    this.atlasCtx = ctx;
  }
  
  async init(): Promise<boolean> {
    if (this.initialized) return true;
    
    console.log('[WebGPU] Initializing renderer...');
    
    // Check WebGPU support
    if (!navigator.gpu) {
      console.error('[WebGPU] Not supported in this browser');
      return false;
    }
    
    try {
      // Request adapter and device
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance'
      });
      
      if (!adapter) {
        console.error('[WebGPU] Failed to get GPU adapter');
        return false;
      }
      
      this.device = await adapter.requestDevice();
      
      // Handle device lost
      this.device.lost.then((info) => {
        console.error('[WebGPU] Device lost:', info.message);
        this.initialized = false;
      });
      
      // Configure canvas context
      this.context = this.canvas.getContext('webgpu');
      if (!this.context) {
        console.error('[WebGPU] Failed to get canvas context');
        return false;
      }
      
      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      this.context.configure({
        device: this.device,
        format: presentationFormat,
        alphaMode: 'opaque'
      });
      
      // Wait for fonts to load
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
        
        // Explicitly load the font we're going to use
        try {
          const fontString = this.fontFamily.includes(',') 
            ? this.fontFamily 
            : `'${this.fontFamily}'`;
          await document.fonts.load(`${this.fontSize}px ${fontString}`);
          console.log(`[WebGPU] Loaded font: ${fontString}`);
        } catch (e) {
          console.warn('[WebGPU] Font load failed, continuing anyway:', e);
        }
      }
      
      // Initialize font atlas
      this.initFont();
      
      // Initialize WebGPU resources
      await this.initWebGPU(presentationFormat);
      
      // Set canvas size
      this.setupCanvas();
      
      // Initialize cell buffer now that device is ready
      const maxCells = this.width * this.height;
      this.cellBuffer = this.device.createBuffer({
        size: maxCells * 60, // 15 floats per cell
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.cellData = new Float32Array(maxCells * 15);
      
      // Update uniforms
      const uniforms = new Float32Array([
        this.canvas.width,
        this.canvas.height,
        this.charWidth,
        this.charHeight
      ]);
      this.device.queue.writeBuffer(this.uniformBuffer!, 0, uniforms);
      
      // Pre-cache ASCII characters
      this.cacheCharRange(32, 127);
      
      this.initialized = true;
      console.log('[WebGPU] Initialized successfully');
      return true;
      
    } catch (error) {
      console.error('[WebGPU] Initialization failed:', error);
      return false;
    }
  }
  
  private initFont(): void {
    // Quote font family if it's not already a full font string with fallbacks
    const fontString = this.fontFamily.includes(',') 
      ? this.fontFamily 
      : `'${this.fontFamily}'`;
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = 'top';
    
    // Measure character dimensions
    const metrics = this.atlasCtx.measureText('M');
    this.charWidth = Math.ceil(metrics.width);
    this.charHeight = this.fontSize;
    
    console.log(`[WebGPU] Font initialized: ${this.atlasCtx.font}`);
    console.log(`[WebGPU] Char size: ${this.charWidth}x${this.charHeight}px`);
  }
  
  private async initWebGPU(presentationFormat: GPUTextureFormat): Promise<void> {
    if (!this.device) return;
    
    // WGSL shader code
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
    
    // Create shader module
    const shaderModule = this.device.createShaderModule({
      code: shaderCode
    });
    
    // Create uniform buffer
    this.uniformBuffer = this.device.createBuffer({
      size: 16, // 2 vec2f = 4 floats = 16 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Create atlas texture
    this.atlasTexture = this.device.createTexture({
      size: [this.atlasCanvas.width, this.atlasCanvas.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | 
             GPUTextureUsage.COPY_DST | 
             GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    // Create sampler
    this.atlasSampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
    
    // Create bind group layout
    const bindGroupLayout = this.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
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
    
    // Create bind group
    this.bindGroup = this.device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        { binding: 1, resource: this.atlasTexture.createView() },
        { binding: 2, resource: this.atlasSampler }
      ]
    });
    
    // Create pipeline
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });
    
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 60, // 2+4+4+4+1 floats = 15 floats = 60 bytes
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x2' },  // cellPos
            { shaderLocation: 1, offset: 8, format: 'float32x4' },  // fgColor
            { shaderLocation: 2, offset: 24, format: 'float32x4' }, // bgColor
            { shaderLocation: 3, offset: 40, format: 'float32x4' }, // glyphUV
            { shaderLocation: 4, offset: 56, format: 'float32' }    // charWidth
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: presentationFormat,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha'
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha'
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });
  }
  
  private setupCanvas(): void {
    this.canvas.width = this.width * this.charWidth;
    this.canvas.height = this.height * this.charHeight;
  }
  
  private cacheCharRange(start: number, end: number): void {
    for (let i = start; i <= end; i++) {
      this.cacheGlyph(String.fromCharCode(i));
    }
    this.uploadAtlas();
    
    // Debug: log a sample glyph to verify font rendering
    if (start === 32 && end === 127) {
      console.log('[WebGPU] ASCII glyphs cached. Sample "M" width:', this.glyphCache.get('M')?.pixelWidth);
    }
  }
  
  private cacheGlyph(char: string): GlyphInfo {
    if (this.glyphCache.has(char)) {
      return this.glyphCache.get(char)!;
    }
    
    // Ensure font is set before measuring/drawing
    // Quote font family if it's not already a full font string with fallbacks
    const fontString = this.fontFamily.includes(',') 
      ? this.fontFamily 
      : `'${this.fontFamily}'`;
    this.atlasCtx.font = `${this.fontSize}px ${fontString}`;
    this.atlasCtx.textBaseline = 'top';
    
    // Log font once for debugging
    if (!this.fontLoggedOnce) {
      console.log(`[WebGPU] Caching glyphs with font: ${this.atlasCtx.font}`);
      this.fontLoggedOnce = true;
    }
    
    const metrics = this.atlasCtx.measureText(char);
    const width = Math.ceil(metrics.width) + 2;
    const height = this.charHeight + 2;
    
    // Check if we need a new row
    if (this.atlasX + width > this.atlasCanvas.width) {
      this.atlasX = 0;
      this.atlasY += this.atlasRowHeight;
      this.atlasRowHeight = 0;
    }
    
    // Render glyph to atlas
    this.atlasCtx.clearRect(this.atlasX, this.atlasY, width, height);
    this.atlasCtx.fillStyle = '#ffffff';
    this.atlasCtx.fillText(char, this.atlasX + 1, this.atlasY + 1);
    
    const atlasWidth = this.atlasCanvas.width;
    const atlasHeight = this.atlasCanvas.height;
    
    const info: GlyphInfo = {
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
  
  private uploadAtlas(): void {
    if (!this.device || !this.atlasTexture || !this.atlasNeedsUpload) return;
    
    const imageData = this.atlasCtx.getImageData(
      0, 0,
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
  
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.setupCanvas();
    
    // Update uniform buffer
    if (this.device && this.uniformBuffer) {
      const uniforms = new Float32Array([
        this.canvas.width,
        this.canvas.height,
        this.charWidth,
        this.charHeight
      ]);
      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }
    
    // Recreate cell buffer
    const maxCells = width * height;
    if (this.device) {
      this.cellBuffer = this.device.createBuffer({
        size: maxCells * 60, // 15 floats per cell
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.cellData = new Float32Array(maxCells * 15);
    } else {
      // If device not ready yet, just allocate the typed array
      this.cellData = new Float32Array(maxCells * 15);
    }
  }
  
  getWidth(): number {
    return this.width;
  }
  
  getHeight(): number {
    return this.height;
  }
  
  render(buffer: Cell[][]): void {
    if (!this.initialized || !this.device || !this.context || !this.pipeline) {
      return;
    }
    
    // Upload atlas if needed
    if (this.atlasNeedsUpload) {
      this.uploadAtlas();
    }
    
    // Build cell data
    let cellIndex = 0;
    for (let y = 0; y < Math.min(buffer.length, this.height); y++) {
      const row = buffer[y];
      for (let x = 0; x < Math.min(row.length, this.width); x++) {
        const cell = row[x];
        
        // Cache glyph if needed
        if (cell.char && !this.glyphCache.has(cell.char)) {
          this.cacheGlyph(cell.char);
          this.uploadAtlas();
        }
        
        const glyph = this.glyphCache.get(cell.char || ' ') || this.cacheGlyph(' ');
        const offset = cellIndex * 15;
        
        // Cell position
        this.cellData![offset + 0] = x;
        this.cellData![offset + 1] = y;
        
        // Foreground color
        this.cellData![offset + 2] = cell.fg.r / 255;
        this.cellData![offset + 3] = cell.fg.g / 255;
        this.cellData![offset + 4] = cell.fg.b / 255;
        this.cellData![offset + 5] = cell.fg.a !== undefined ? cell.fg.a : 1;
        
        // Background color
        this.cellData![offset + 6] = cell.bg.r / 255;
        this.cellData![offset + 7] = cell.bg.g / 255;
        this.cellData![offset + 8] = cell.bg.b / 255;
        this.cellData![offset + 9] = cell.bg.a !== undefined ? cell.bg.a : 1;
        
        // Glyph UV
        this.cellData![offset + 10] = glyph.u;
        this.cellData![offset + 11] = glyph.v;
        this.cellData![offset + 12] = glyph.w;
        this.cellData![offset + 13] = glyph.h;
        
        // Char width
        this.cellData![offset + 14] = 1.0;
        
        cellIndex++;
      }
    }
    
    // Upload cell data
    if (this.cellBuffer && this.cellData) {
      this.device.queue.writeBuffer(this.cellBuffer, 0, this.cellData.buffer);
    }
    
    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup!);
    if (this.cellBuffer) {
      passEncoder.setVertexBuffer(0, this.cellBuffer);
    }
    passEncoder.draw(6, cellIndex);
    passEncoder.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }
  
  clear(_color: Color = { r: 0, g: 0, b: 0 }): void {
    // Clear is handled by render pass clearValue
  }
}

interface GlyphInfo {
  u: number;
  v: number;
  w: number;
  h: number;
  pixelWidth: number;
}
