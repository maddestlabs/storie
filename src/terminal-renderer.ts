/**
 * Terminal Renderer
 * GPU-accelerated terminal cell grid rendering
 * Uses WebGPU context and glyph atlas for efficient text rendering
 */

import type { WebGPUContext } from './webgpu-context.js';
import type { GlyphAtlas } from './glyph-atlas.js';
import type { Cell, Color } from './types.js';

export interface TerminalRendererConfig {
  width?: number;   // Terminal width in cells
  height?: number;  // Terminal height in cells
  renderToTexture?: boolean; // If true, renders to offscreen texture instead of canvas
}

export class TerminalRenderer {
  private context: WebGPUContext;
  private atlas: GlyphAtlas;
  
  private width: number;
  private height: number;
  private renderToTexture: boolean;
  
  // WebGPU resources
  private pipeline: GPURenderPipeline | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private cellBuffer: GPUBuffer | null = null;
  private cellData: Float32Array | null = null;
  private bindGroup: GPUBindGroup | null = null;
  
  // Offscreen render target (optional)
  private renderTexture: GPUTexture | null = null;
  private renderTextureView: GPUTextureView | null = null;
  
  private initialized: boolean = false;

  constructor(
    context: WebGPUContext,
    atlas: GlyphAtlas,
    config: TerminalRendererConfig = {}
  ) {
    this.context = context;
    this.atlas = atlas;
    
    this.width = config.width || 80;
    this.height = config.height || 24;
    this.renderToTexture = config.renderToTexture ?? false;
  }

  async init(canvasWidth: number, canvasHeight: number): Promise<boolean> {
    if (this.initialized) return true;
    
    console.log('[TerminalRenderer] Initializing...');
    
    const device = this.context.getDevice();
    if (!device) {
      console.error('[TerminalRenderer] WebGPU device not available');
      return false;
    }
    
    try {
      // Initialize GPU resources for atlas if not already done
      if (!this.atlas.getTexture()) {
        await this.atlas.initGPU(this.context);
      }
      
      // Pre-cache ASCII characters
      this.atlas.cacheCharRange(32, 127);

      // Pre-cache common TUI glyphs (box drawing + block elements)
      // Without this, widgets can appear invisible because the atlas initially
      // contains only ASCII glyphs.
      this.atlas.cacheCharRange(0x2500, 0x257F); // Box Drawing
      this.atlas.cacheCharRange(0x2580, 0x259F); // Block Elements
      // Common symbols used in demos/UI
      this.atlas.cacheGlyph('✓');
      this.atlas.cacheGlyph('✗');
      this.atlas.uploadToGPU(device);
      
      // Create pipeline
      await this.initPipeline();
      
      // Create uniform buffer
      this.uniformBuffer = device.createBuffer({
        size: 16, // 2 vec2f = 4 floats = 16 bytes
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });
      
      // Update uniforms
      const charWidth = this.atlas.getCharWidth();
      const charHeight = this.atlas.getCharHeight();
      const uniforms = new Float32Array([
        canvasWidth,
        canvasHeight,
        charWidth,
        charHeight
      ]);
      device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
      
      // Create bind group
      this.bindGroup = device.createBindGroup({
        layout: this.pipeline!.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: this.uniformBuffer } },
          { binding: 1, resource: this.atlas.getTexture()!.createView() },
          { binding: 2, resource: this.atlas.getSampler()! }
        ]
      });
      
      // Create cell buffer
      const maxCells = this.width * this.height;
      this.cellBuffer = device.createBuffer({
        size: maxCells * 60, // 15 floats per cell
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
      });
      this.cellData = new Float32Array(maxCells * 15);
      
      // Create offscreen render texture if requested
      if (this.renderToTexture) {
        this.createRenderTexture(canvasWidth, canvasHeight);
      }
      
      this.initialized = true;
      console.log('[TerminalRenderer] Initialized successfully');
      console.log(`[TerminalRenderer] Grid size: ${this.width}x${this.height} cells`);
      
      return true;
      
    } catch (error) {
      console.error('[TerminalRenderer] Initialization failed:', error);
      return false;
    }
  }

  private async initPipeline(): Promise<void> {
    const device = this.context.getDevice();
    if (!device) throw new Error('Device not available');
    
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
    
    const shaderModule = device.createShaderModule({ code: shaderCode });
    
    this.pipeline = device.createRenderPipeline({
      layout: 'auto',
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
          format: this.context.getPresentationFormat(),
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

  private createRenderTexture(width: number, height: number): void {
    const device = this.context.getDevice();
    if (!device) return;
    
    // Destroy old texture if exists
    if (this.renderTexture) {
      this.renderTexture.destroy();
    }
    
    this.renderTexture = device.createTexture({
      size: { width, height },
      format: this.context.getPresentationFormat(),
      usage: GPUTextureUsage.RENDER_ATTACHMENT |
             GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_SRC
    });
    this.renderTextureView = this.renderTexture.createView();
  }

  /**
   * Render terminal cell buffer
   */
  render(buffer: Cell[][]): void {
    if (!this.initialized) return;
    
    const device = this.context.getDevice();
    if (!device || !this.pipeline || !this.cellBuffer || !this.cellData) return;
    
    // Upload atlas if needed
    if (this.atlas.needsUpload()) {
      this.atlas.uploadToGPU(device);
    }
    
    // Build cell data
    let cellIndex = 0;
    for (let y = 0; y < Math.min(buffer.length, this.height); y++) {
      const row = buffer[y];
      for (let x = 0; x < Math.min(row.length, this.width); x++) {
        const cell = row[x];
        const glyph = this.atlas.getGlyph(cell.char || ' ');
        const offset = cellIndex * 15;
        
        // Cell position
        this.cellData[offset + 0] = x;
        this.cellData[offset + 1] = y;
        
        // Foreground color (unpack from 0xRRGGBBAA)
        this.cellData[offset + 2] = ((cell.fg >>> 24) & 0xFF) / 255;
        this.cellData[offset + 3] = ((cell.fg >>> 16) & 0xFF) / 255;
        this.cellData[offset + 4] = ((cell.fg >>> 8) & 0xFF) / 255;
        this.cellData[offset + 5] = (cell.fg & 0xFF) / 255;
        
        // Background color (unpack from 0xRRGGBBAA)
        this.cellData[offset + 6] = ((cell.bg >>> 24) & 0xFF) / 255;
        this.cellData[offset + 7] = ((cell.bg >>> 16) & 0xFF) / 255;
        this.cellData[offset + 8] = ((cell.bg >>> 8) & 0xFF) / 255;
        this.cellData[offset + 9] = (cell.bg & 0xFF) / 255;
        
        // Glyph UV
        this.cellData[offset + 10] = glyph.u;
        this.cellData[offset + 11] = glyph.v;
        this.cellData[offset + 12] = glyph.w;
        this.cellData[offset + 13] = glyph.h;
        
        // Char width (normalized to char cells)
        this.cellData[offset + 14] = 1.0;
        
        cellIndex++;
      }
    }
    
    // Upload cell data
    device.queue.writeBuffer(this.cellBuffer, 0, this.cellData.buffer);
    
    // Determine render target
    const renderView = this.renderToTexture && this.renderTextureView
      ? this.renderTextureView
      : this.context.getCurrentTextureView();
    
    if (!renderView) return;
    
    // Render
    const commandEncoder = device.createCommandEncoder();
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: renderView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, this.bindGroup!);
    passEncoder.setVertexBuffer(0, this.cellBuffer);
    passEncoder.draw(6, cellIndex); // 6 vertices per quad, cellIndex instances
    passEncoder.end();
    
    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Resize terminal grid
   */
  resize(width: number, height: number, canvasWidth: number, canvasHeight: number): void {
    this.width = width;
    this.height = height;
    
    const device = this.context.getDevice();
    if (!device) return;
    
    // Update uniforms
    if (this.uniformBuffer) {
      const charWidth = this.atlas.getCharWidth();
      const charHeight = this.atlas.getCharHeight();
      const uniforms = new Float32Array([
        canvasWidth,
        canvasHeight,
        charWidth,
        charHeight
      ]);
      device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    }
    
    // Recreate cell buffer
    const maxCells = width * height;
    this.cellBuffer = device.createBuffer({
      size: maxCells * 60,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.cellData = new Float32Array(maxCells * 15);
    
    // Recreate render texture if using offscreen rendering
    if (this.renderToTexture) {
      this.createRenderTexture(canvasWidth, canvasHeight);
    }
  }

  /**
   * Get terminal dimensions
   */
  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  /**
   * Get offscreen render texture (if rendering to texture)
   */
  getRenderTexture(): GPUTexture | null {
    return this.renderTexture;
  }

  /**
   * Get cell width in pixels
   */
  getCellWidth(): number {
    return this.atlas.getCharWidth();
  }

  /**
   * Get cell height in pixels
   */
  getCellHeight(): number {
    return this.atlas.getCharHeight();
  }

  /**
   * Set a single cell directly 
   * Useful for TUI rendering
   */
  setCell(buffer: Cell[][], x: number, y: number, char: string, fg: Color, bg: Color): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    if (!buffer[y]) return;
    if (!buffer[y][x]) return;
    
    buffer[y][x].char = char;
    buffer[y][x].fg = fg;
    buffer[y][x].bg = bg;
  }

  /**
   * Clear screen
   */
  clear(_color: Color = 0x000000FF): void {
    // Clear is handled by render pass clearValue
    // Could be extended to support custom clear colors
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.cellBuffer) {
      this.cellBuffer.destroy();
      this.cellBuffer = null;
    }
    if (this.uniformBuffer) {
      this.uniformBuffer.destroy();
      this.uniformBuffer = null;
    }
    if (this.renderTexture) {
      this.renderTexture.destroy();
      this.renderTexture = null;
    }
    this.cellData = null;
    this.bindGroup = null;
    this.pipeline = null;
    this.initialized = false;
  }
}
