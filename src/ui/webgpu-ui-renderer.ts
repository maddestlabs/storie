import type { GlyphAtlas } from '../glyph-atlas.js';
import type { Color } from '../types.js';
import { ColorUtils } from '../types.js';

export class WebGPUUIRenderer {
  private device: GPUDevice;
  private atlas: GlyphAtlas;

  private textureFormat: GPUTextureFormat;

  private width: number;
  private height: number;

  private texture: GPUTexture;

  private rectPipeline: GPURenderPipeline;
  private textPipeline: GPURenderPipeline;

  private uniformBuffer: GPUBuffer;

  private rectInstanceBuffer: GPUBuffer;
  private textInstanceBuffer: GPUBuffer;

  // Per-instance data
  // Rect: 8 floats => x,y,w,h + r,g,b,a
  private rectData: Float32Array;
  private rectCount: number = 0;

  // Text: 12 floats => x,y,w,h + r,g,b,a + u,v,uw,uh
  private textData: Float32Array;
  private textCount: number = 0;

  private clearColor: [number, number, number, number] = [0, 0, 0, 0];

  constructor(device: GPUDevice, atlas: GlyphAtlas, width: number, height: number) {
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

    this.rectInstanceBuffer = this.device.createBuffer({
      size: 8 * 4 * 4096,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.textInstanceBuffer = this.device.createBuffer({
      size: 12 * 4 * 4096,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.rectData = new Float32Array(8 * 4096);
    this.textData = new Float32Array(12 * 4096);

    this.rectPipeline = this.createRectPipeline();
    this.textPipeline = this.createTextPipeline();

    this.writeUniforms();
  }

  getTexture(): GPUTexture {
    return this.texture;
  }

  resize(width: number, height: number): void {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height) return;

    this.width = nextWidth;
    this.height = nextHeight;

    try {
      this.texture.destroy();
    } catch {
      // ignore
    }
    this.texture = this.createRenderTexture(this.width, this.height);
    this.writeUniforms();
  }

  setClearColor(color?: Color): void {
    if (color === undefined || color === null) {
      this.clearColor = [0, 0, 0, 0];
      return;
    }
    const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color as any));
    this.clearColor = [r, g, b, a];
  }

  clearCommands(): void {
    this.rectCount = 0;
    this.textCount = 0;
  }

  rect(x: number, y: number, w: number, h: number, color: Color): void {
    if (w <= 0 || h <= 0) return;
    if (this.rectCount >= 4096) return;

    const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color as any));
    const o = this.rectCount * 8;
    this.rectData[o + 0] = x;
    this.rectData[o + 1] = y;
    this.rectData[o + 2] = w;
    this.rectData[o + 3] = h;
    this.rectData[o + 4] = r;
    this.rectData[o + 5] = g;
    this.rectData[o + 6] = b;
    this.rectData[o + 7] = a;
    this.rectCount++;
  }

  text(text: string, x: number, y: number, color: Color): void {
    if (!text) return;

    const [r, g, b, a] = ColorUtils.rgbaNorm(ColorUtils.from(color as any));
    const charW = this.atlas.getCharWidth();
    const charH = this.atlas.getCharHeight();

    let cursorX = x;
    for (const ch of text) {
      if (this.textCount >= 4096) break;

      const glyph = this.atlas.getGlyph(ch);
      const o = this.textCount * 12;
      this.textData[o + 0] = cursorX;
      this.textData[o + 1] = y;
      this.textData[o + 2] = charW;
      this.textData[o + 3] = charH;
      this.textData[o + 4] = r;
      this.textData[o + 5] = g;
      this.textData[o + 6] = b;
      this.textData[o + 7] = a;
      this.textData[o + 8] = glyph.u;
      this.textData[o + 9] = glyph.v;
      this.textData[o + 10] = glyph.w;
      this.textData[o + 11] = glyph.h;

      this.textCount++;
      cursorX += charW;
    }
  }

  /**
   * Render current UI commands into the offscreen UI texture.
   * Clears to transparent each frame by default.
   */
  flush(): void {
    const shouldClear = !(this.clearColor[0] === 0 && this.clearColor[1] === 0 && this.clearColor[2] === 0 && this.clearColor[3] === 0);
    if (this.rectCount === 0 && this.textCount === 0 && !shouldClear) {
      // Nothing to do this frame.
      return;
    }


    // Upload atlas updates (if new glyphs were cached)
    if (this.atlas.needsUpload()) {
      this.atlas.uploadToGPU(this.device);
    }

    // Upload instance buffers
    if (this.rectCount > 0) {
      const byteCount = this.rectCount * 8 * 4;
      this.device.queue.writeBuffer(
        this.rectInstanceBuffer,
        0,
        this.rectData.buffer as ArrayBuffer,
        0,
        byteCount
      );
    }
    if (this.textCount > 0) {
      const byteCount = this.textCount * 12 * 4;
      this.device.queue.writeBuffer(
        this.textInstanceBuffer,
        0,
        this.textData.buffer as ArrayBuffer,
        0,
        byteCount
      );
    }

    const commandEncoder = this.device.createCommandEncoder();
    const pass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: this.texture.createView(),
        clearValue: { r: this.clearColor[0], g: this.clearColor[1], b: this.clearColor[2], a: this.clearColor[3] },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    // Rects
    if (this.rectCount > 0) {
      const rectBindGroup = this.device.createBindGroup({
        layout: this.rectPipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }]
      });

      pass.setPipeline(this.rectPipeline);
      pass.setBindGroup(0, rectBindGroup);
      pass.setVertexBuffer(0, this.rectInstanceBuffer);
      pass.draw(6, this.rectCount);
    }

    // Text
    if (this.textCount > 0) {
      const atlasTexture = this.atlas.getTexture();
      const atlasSampler = this.atlas.getSampler();
      if (atlasTexture && atlasSampler) {
        const textBindGroup = this.device.createBindGroup({
          layout: this.textPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: atlasTexture.createView() },
            { binding: 2, resource: atlasSampler }
          ]
        });

        pass.setPipeline(this.textPipeline);
        pass.setBindGroup(0, textBindGroup);
        pass.setVertexBuffer(0, this.textInstanceBuffer);
        pass.draw(6, this.textCount);
      }
    }

    pass.end();
    this.device.queue.submit([commandEncoder.finish()]);

    // Immediate-mode by default: commands are per-frame
    this.clearCommands();
    // Reset clear color back to transparent each frame unless user set it again
    this.clearColor = [0, 0, 0, 0];
  }

  private writeUniforms(): void {
    const data = new Float32Array([this.width, this.height, 0, 0]);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  private createRenderTexture(width: number, height: number): GPUTexture {
    return this.device.createTexture({
      size: { width, height },
      format: this.textureFormat,
      usage: GPUTextureUsage.RENDER_ATTACHMENT |
             GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_SRC
    });
  }

  private createRectPipeline(): GPURenderPipeline {
    const shader = this.device.createShaderModule({
      code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VSOut {
          @builtin(position) position: vec4f,
          @location(0) color: vec4f,
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
          out.color = color;
          return out;
        }

        @fragment
        fn fs_main(input: VSOut) -> @location(0) vec4f {
          return input.color;
        }
      `
    });

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 32,
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
        targets: [{
          format: this.textureFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  private createTextPipeline(): GPURenderPipeline {
    const shader = this.device.createShaderModule({
      code: `
        struct Uniforms { resolution: vec2f }
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var fontAtlas: texture_2d<f32>;
        @group(0) @binding(2) var fontSampler: sampler;

        struct VSOut {
          @builtin(position) position: vec4f,
          @location(0) uv: vec2f,
          @location(1) color: vec4f,
        }

        @vertex
        fn vs_main(
          @builtin(vertex_index) vertexIndex: u32,
          @builtin(instance_index) instanceIndex: u32,
          @location(0) posSize: vec4f,
          @location(1) color: vec4f,
          @location(2) uvRect: vec4f,
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
          return out;
        }

        @fragment
        fn fs_main(input: VSOut) -> @location(0) vec4f {
          let a = textureSample(fontAtlas, fontSampler, input.uv).a;
          return vec4f(input.color.rgb, input.color.a * a);
        }
      `
    });

    return this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: 'vs_main',
        buffers: [{
          arrayStride: 48,
          stepMode: 'instance',
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x4' },
            { shaderLocation: 1, offset: 16, format: 'float32x4' },
            { shaderLocation: 2, offset: 32, format: 'float32x4' },
          ]
        }]
      },
      fragment: {
        module: shader,
        entryPoint: 'fs_main',
        targets: [{
          format: this.textureFormat,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
          }
        }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }
}
