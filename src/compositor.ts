/**
 * Compositor - Composites multiple offscreen layers to main canvas
 * 
 * Phase 1: Auto-compositing (terminal + canvas2d)
 * Phase 2: Manual mode with blend modes
 * Phase 3: Custom contexts (Canvas2D, WebGL, WebGL2)
 * Phase 4: Transforms (rotation, scale, translation)
 * Phase 5: Shader pipeline for post-processing effects
 */

import { ShaderPipeline } from './shader-pipeline.js';

export type BlendMode = 'normal' | 'additive' | 'multiply' | 'screen' | 'overlay';

export interface Layer {
  name: string;
  texture?: GPUTexture;           // For GPU textures (terminal)
  canvas?: OffscreenCanvas;       // For Canvas2D/WebGL contexts
  context?: CanvasRenderingContext2D | WebGLRenderingContext;
  width: number;
  height: number;
  opacity: number;
  blendMode: BlendMode;
  enabled: boolean;
  zIndex: number;
}

export interface BlitOptions {
  x?: number;              // X offset in pixels (default: 0)
  y?: number;              // Y offset in pixels (default: 0)
  width?: number;          // Destination width (default: layer width)
  height?: number;         // Destination height (default: layer height)
  opacity?: number;        // 0.0 - 1.0 (default: 1.0)
  blendMode?: BlendMode;   // Blend mode (default: 'normal')
  rotation?: number;       // Rotation in radians (default: 0)
  scale?: { x: number; y: number } | number;  // Scale (default: 1.0)
  origin?: { x: number; y: number };  // Transform origin, 0-1 normalized (default: center)
}

/**
 * WebGPU-based compositor
 * Composites multiple layers to main canvas with GPU acceleration
 */
export class Compositor {
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private context: GPUCanvasContext;
  
  // Compositor resources
  private pipelines: Map<BlendMode, GPURenderPipeline> = new Map();
  private autoPipelines: Map<BlendMode, GPURenderPipeline> = new Map();
  private sampler: GPUSampler | null = null;
  private vertexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null; // For blit parameters
  private autoUniformBuffer: GPUBuffer | null = null; // For autoComposite opacity
  
  // Layers
  public layers: Map<string, Layer> = new Map();
  
  // Mode
  public mode: 'auto' | 'manual' = 'auto';
  
  // Shader pipeline for post-processing
  private shaderPipeline: ShaderPipeline | null = null;
  
  private initialized: boolean = false;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    
    // Configure canvas context
    const context = canvas.getContext('webgpu');
    if (!context) throw new Error('Failed to get WebGPU context for compositor');
    this.context = context;
    
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: canvasFormat,
      alphaMode: 'premultiplied',
      // Enable COPY_DST so we can robustly copy a rendered terminal texture
      // directly into the swapchain when appropriate.
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[Compositor] Initializing...');
    
    // Create sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
    
    // Create fullscreen quad vertex buffer
    const vertices = new Float32Array([
      // Position (x, y)  UV (u, v)
      -1.0,  1.0,        0.0, 0.0,  // Top-left
       1.0,  1.0,        1.0, 0.0,  // Top-right
      -1.0, -1.0,        0.0, 1.0,  // Bottom-left
       1.0, -1.0,        1.0, 1.0,  // Bottom-right
    ]);
    
    this.vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(vertices);
    this.vertexBuffer.unmap();
    
    // Create uniform buffer for blit parameters
    // Layout: mat4 transform (16 floats) + opacity (1 float) + blendMode (1 float) + padding (2 floats)
    this.uniformBuffer = this.device.createBuffer({
      size: 80, // 20 floats * 4 bytes = 80 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Auto-composite needs only opacity (packed into a vec4 for alignment)
    this.autoUniformBuffer = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Create render pipelines for each blend mode
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    
    const shaderModule = this.device.createShaderModule({
      code: this.getCompositorShader()
    });
    
    const blendModes: BlendMode[] = ['normal', 'additive', 'multiply', 'screen', 'overlay'];
    
    for (const blendMode of blendModes) {
      const blendState = this.getBlendState(blendMode);
      
      const pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vs_main',
          buffers: [{
            arrayStride: 16, // 4 floats * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
              { shaderLocation: 1, offset: 8, format: 'float32x2' }   // uv
            ]
          }]
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: canvasFormat,
            blend: blendState
          }]
        },
        primitive: {
          topology: 'triangle-strip',
          stripIndexFormat: undefined
        }
      });
      
      this.pipelines.set(blendMode, pipeline);
    }

    // Create simpler fullscreen pipelines for autoComposite (no vertex buffer / no transform)
    const autoShaderModule = this.device.createShaderModule({
      code: this.getAutoCompositorShader()
    });

    for (const blendMode of blendModes) {
      const blendState = this.getBlendState(blendMode);
      const pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: autoShaderModule,
          entryPoint: 'vs_main'
        },
        fragment: {
          module: autoShaderModule,
          entryPoint: 'fs_main',
          targets: [{
            format: canvasFormat,
            blend: blendState
          }]
        },
        primitive: {
          topology: 'triangle-list'
        }
      });
      this.autoPipelines.set(blendMode, pipeline);
    }
    
    // Initialize shader pipeline for post-processing
    this.shaderPipeline = new ShaderPipeline(this.device, this.canvas);
    await this.shaderPipeline.init();
    
    this.initialized = true;
    console.log('[Compositor] Initialized');
  }

  /**
   * Register a layer
   */
  registerLayer(name: string, layer: Partial<Layer>): Layer {
    const fullLayer: Layer = {
      name,
      width: layer.width || this.canvas.width,
      height: layer.height || this.canvas.height,
      opacity: layer.opacity ?? 1.0,
      blendMode: layer.blendMode || 'normal',
      enabled: layer.enabled ?? true,
      zIndex: layer.zIndex ?? 0,
      texture: layer.texture,
      canvas: layer.canvas,
      context: layer.context
    };
    
    this.layers.set(name, fullLayer);
    console.log(`[Compositor] Registered layer: ${name} (texture=${!!layer.texture}, canvas=${!!layer.canvas}, ${fullLayer.width}x${fullLayer.height})`);
    return fullLayer;
  }

  /**
   * Update layer texture/canvas
   */
  updateLayer(name: string, updates: Partial<Layer>): void {
    const layer = this.layers.get(name);
    if (!layer) {
      console.warn(`[Compositor] Layer not found: ${name}`);
      return;
    }
    
    Object.assign(layer, updates);
  }

  /**
   * Create a new offscreen rendering context
   * Phase 3: Custom Contexts
   */
  createContext(name: string, options: {
    type: 'canvas2d' | 'webgl' | 'webgl2';
    width: number;
    height: number;
    alpha?: boolean;
    antialias?: boolean;
    zIndex?: number;
  }): Layer | null {
    // Check if name already exists
    if (this.layers.has(name)) {
      console.warn(`[Compositor] Layer "${name}" already exists`);
      return this.layers.get(name)!;
    }
    
    // Create OffscreenCanvas
    const canvas = new OffscreenCanvas(options.width, options.height);
    
    // Get requested context
    let context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | WebGLRenderingContext | WebGL2RenderingContext | null = null;
    
    try {
      if (options.type === 'canvas2d') {
        context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
      } else if (options.type === 'webgl') {
        context = canvas.getContext('webgl', {
          alpha: options.alpha ?? true,
          antialias: options.antialias ?? false,
          preserveDrawingBuffer: true
        }) as WebGLRenderingContext | null;
      } else if (options.type === 'webgl2') {
        context = canvas.getContext('webgl2', {
          alpha: options.alpha ?? true,
          antialias: options.antialias ?? false,
          preserveDrawingBuffer: true
        }) as WebGL2RenderingContext | null;
      }
    } catch (error) {
      console.error(`[Compositor] Failed to create ${options.type} context:`, error);
      return null;
    }
    
    if (!context) {
      console.error(`[Compositor] ${options.type} context not available`);
      return null;
    }
    
    // Register as layer
    const layer = this.registerLayer(name, {
      canvas,
      context: context as any,
      width: options.width,
      height: options.height,
      zIndex: options.zIndex ?? 50, // Default to middle
      opacity: 1.0,
      blendMode: 'normal',
      enabled: true
    });
    
    console.log(`[Compositor] Created ${options.type} context: ${name} (${options.width}x${options.height})`);
    return layer;
  }

  /**
   * Remove a layer
   */
  removeLayer(name: string): boolean {
    const layer = this.layers.get(name);
    if (!layer) {
      console.warn(`[Compositor] Layer not found: ${name}`);
      return false;
    }
    
    // Don't allow removing built-in layers
    if (name === 'terminal' || name === 'canvas2d') {
      console.warn(`[Compositor] Cannot remove built-in layer: ${name}`);
      return false;
    }
    
    this.layers.delete(name);
    console.log(`[Compositor] Removed layer: ${name}`);
    return true;
  }

  /**
   * Auto-composite all enabled layers (sorted by zIndex)
   */
  autoComposite(): void {
    if (!this.initialized) return;

    // In manual mode, user code drives compositing.
    if (this.mode === 'manual') return;
    
    // Get enabled layers sorted by zIndex
    const sortedLayers = Array.from(this.layers.values())
      .filter(layer => layer.enabled)
      .sort((a, b) => a.zIndex - b.zIndex);

    // IMPORTANT: acquire the swapchain texture once per frame.
    // Some WebGPU implementations may return a different texture on subsequent
    // getCurrentTexture() calls, which would make per-layer passes with loadOp=load
    // render into undefined contents (appearing blank).
    const commandEncoder = this.device.createCommandEncoder();
    const currentTexture = this.context.getCurrentTexture();
    const textureView = currentTexture.createView();

    // Update any canvas-backed layers into their textures before rendering.
    for (const layer of sortedLayers) {
      if (!layer.texture && layer.canvas) {
        layer.texture = this.ensureCanvasLayerTexture(layer);
      }
      if (layer.canvas && layer.texture) {
        this.updateTextureFromCanvas(layer.canvas, layer.texture);
      }
    }

    const passEncoder = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });

    for (const layer of sortedLayers) {
      const texture = layer.texture;
      if (!texture) continue;

      const opacity = layer.opacity ?? 1.0;
      const blendMode = layer.blendMode || 'normal';
      const pipeline = this.autoPipelines.get(blendMode);
      if (!pipeline) continue;

      // Write opacity for this layer.
      // Pack into vec4 for alignment; shader reads .x.
      this.device.queue.writeBuffer(this.autoUniformBuffer!, 0, new Float32Array([opacity, 0, 0, 0]));

      const bindGroup = this.device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler! },
          { binding: 1, resource: texture.createView() },
          { binding: 2, resource: { buffer: this.autoUniformBuffer! } }
        ]
      });

      passEncoder.setPipeline(pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.draw(6);
    }

    passEncoder.end();
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Clear the main canvas
   */
  clear(color: string = '#000000'): void {
    // Parse color
    const r = parseInt(color.slice(1, 3), 16) / 255;
    const g = parseInt(color.slice(3, 5), 16) / 255;
    const b = parseInt(color.slice(5, 7), 16) / 255;
    
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r, g, b, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Blit a layer to the main canvas
   */
  blit(layer: Layer, options: BlitOptions = {}): void {
    if (!this.initialized || this.pipelines.size === 0 || !this.vertexBuffer || !this.uniformBuffer) {
      return;
    }
    
    const opacity = options.opacity ?? 1.0;
    const blendMode = options.blendMode || 'normal';

    // Transform parameters
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    const rotation = options.rotation ?? 0;

    // Scale can be a number or {x, y}
    let scaleX = 1.0, scaleY = 1.0;
    if (typeof options.scale === 'number') {
      scaleX = scaleY = options.scale;
    } else if (options.scale) {
      scaleX = options.scale.x;
      scaleY = options.scale.y;
    }

    // Origin (0-1 normalized, default center)
    const originX = options.origin?.x ?? 0.5;
    const originY = options.origin?.y ?? 0.5;
    
    // Build transform matrix
    const transform = this.buildTransformMatrix(
      x, y,
      rotation,
      scaleX, scaleY,
      originX, originY
    );
    
    // Map blend mode to shader constant
    const blendModeMap: Record<BlendMode, number> = {
      'normal': 0,
      'additive': 1,
      'multiply': 2,
      'screen': 3,
      'overlay': 4
    };
    
    // Get texture to blit
    let texture: GPUTexture | null = null;
    
    if (layer.texture) {
      // GPU texture (terminal)
      texture = layer.texture;
    } else if (layer.canvas) {
      // OffscreenCanvas - ensure we have a persistent GPU texture for this layer
      texture = this.ensureCanvasLayerTexture(layer);
      this.updateTextureFromCanvas(layer.canvas, texture);
    }
    
    if (!texture) return;
    
    // Update uniforms: transform matrix (16 floats) + opacity + blendMode + padding
    const uniforms = new Float32Array(20);
    uniforms.set(transform, 0);  // Matrix at offset 0-15
    uniforms[16] = opacity;
    uniforms[17] = blendModeMap[blendMode];
    uniforms[18] = 0; // padding
    uniforms[19] = 0; // padding
    
    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniforms);
    
    // Get pipeline for blend mode
    const pipeline = this.pipelines.get(blendMode);
    if (!pipeline) {
      console.warn(`[Compositor] No pipeline for blend mode: ${blendMode}`);
      return;
    }
    
    // Create bind group for this texture
    const bindGroup = this.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.sampler! },
        { binding: 1, resource: texture.createView() },
        { binding: 2, resource: { buffer: this.uniformBuffer } }
      ]
    });
    
    // Render
    const commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();
    
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'load',  // Preserve existing content
        storeOp: 'store'
      }]
    };
    
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(4);
    passEncoder.end();
    
    this.device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Build a 2D transform matrix for layer compositing
   * Returns a 4x4 matrix in column-major order (WebGPU standard)
   */
  private buildTransformMatrix(
    x: number, y: number,
    rotation: number,
    scaleX: number, scaleY: number,
    originX: number, originY: number
  ): Float32Array {
    // Convert pixel coordinates to normalized device coordinates (-1 to 1)
    const ndcX = (x / this.canvas.width) * 2;
    const ndcY = -(y / this.canvas.height) * 2; // Flip Y
    
    // Origin offset in layer space (-0.5 to 0.5, centered)
    const originOffsetX = originX - 0.5;
    const originOffsetY = originY - 0.5;
    
    // Compute sin/cos for rotation
    const c = Math.cos(rotation);
    const s = Math.sin(rotation);
    
    // 4x4 matrix in column-major order
    // Combines: origin translation -> scale -> rotation -> position translation
    const matrix = new Float32Array(16);
    
    // Column 0
    matrix[0] = c * scaleX;
    matrix[1] = s * scaleX;
    matrix[2] = 0;
    matrix[3] = 0;
    
    // Column 1
    matrix[4] = -s * scaleY;
    matrix[5] = c * scaleY;
    matrix[6] = 0;
    matrix[7] = 0;
    
    // Column 2
    matrix[8] = 0;
    matrix[9] = 0;
    matrix[10] = 1;
    matrix[11] = 0;
    
    // Column 3 (translation)
    // Apply origin offset, then position
    matrix[12] = ndcX - (originOffsetX * 2 * c * scaleX) + (originOffsetY * 2 * s * scaleY);
    matrix[13] = ndcY - (originOffsetX * 2 * s * scaleX) - (originOffsetY * 2 * c * scaleY);
    matrix[14] = 0;
    matrix[15] = 1;
    
    return matrix;
  }

  /**
   * Ensure a persistent GPU texture exists for a canvas-backed layer
   */
  private ensureCanvasLayerTexture(layer: Layer): GPUTexture {
    if (!layer.canvas) {
      throw new Error('ensureCanvasLayerTexture called without layer.canvas');
    }

    const width = layer.canvas.width;
    const height = layer.canvas.height;

    // If we already have a texture of the correct size, reuse it.
    if (layer.texture && layer.texture.width === width && layer.texture.height === height) {
      return layer.texture;
    }

    // Replace any existing texture.
    if (layer.texture) {
      try {
        layer.texture.destroy();
      } catch {
        // Ignore; WebGPU may already have released it
      }
    }

    const texture = this.device.createTexture({
      size: { width, height },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING |
             GPUTextureUsage.COPY_DST |
             GPUTextureUsage.RENDER_ATTACHMENT
    });

    layer.texture = texture;
    layer.width = width;
    layer.height = height;
    return texture;
  }

  /**
   * Update an existing GPU texture from an OffscreenCanvas
   */
  private updateTextureFromCanvas(canvas: OffscreenCanvas, texture: GPUTexture): void {
    // NOTE: transferToImageBitmap clears the canvas, but the demo redraws each frame.
    const imageBitmap = canvas.transferToImageBitmap();
    this.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture },
      { width: canvas.width, height: canvas.height }
    );
    imageBitmap.close();
  }

  /**
   * Get GPU blend state for a blend mode
   */
  private getBlendState(blendMode: BlendMode): GPUBlendState {
    switch (blendMode) {
      case 'normal':
        // Standard alpha blending
        return {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
      
      case 'additive':
        // Add source to destination
        return {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one',
            operation: 'add'
          }
        };
      
      case 'multiply':
        // Multiply: darken (approximate)
        return {
          color: {
            srcFactor: 'dst',
            dstFactor: 'zero',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
      
      case 'screen':
        // Screen: lighten (approximate)
        return {
          color: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
      
      case 'overlay':
        // Overlay approximation
        return {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          },
          alpha: {
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add'
          }
        };
      
      default:
        return this.getBlendState('normal');
    }
  }

  /**
   * Get compositor shader (WGSL)
   */
  private getCompositorShader(): string {
    return `
      @group(0) @binding(0) var texSampler: sampler;
      @group(0) @binding(1) var layerTexture: texture_2d<f32>;
      
      struct BlitParams {
        transform: mat4x4<f32>,  // Transform matrix (16 floats)
        opacity: f32,
        blendMode: f32,
        padding1: f32,
        padding2: f32
      }
      @group(0) @binding(2) var<uniform> params: BlitParams;
      
      struct VertexInput {
        @location(0) position: vec2<f32>,
        @location(1) uv: vec2<f32>
      }
      
      struct VertexOutput {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>
      }
      
      @vertex
      fn vs_main(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        // Apply transform matrix to position
        let pos4 = vec4<f32>(input.position, 0.0, 1.0);
        output.position = params.transform * pos4;
        output.uv = input.uv;
        return output;
      }
      
      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        var layerColor = textureSample(layerTexture, texSampler, uv);
        
        // Apply opacity
        return vec4<f32>(layerColor.rgb, layerColor.a * params.opacity);
      }
      
      // Blend mode functions for future use
      fn blendNormal(base: vec4<f32>, blend: vec4<f32>) -> vec4<f32> {
        let alpha = blend.a;
        return base * (1.0 - alpha) + blend * alpha;
      }
      
      fn blendAdditive(base: vec4<f32>, blend: vec4<f32>) -> vec4<f32> {
        return base + blend * blend.a;
      }
      
      fn blendMultiply(base: vec4<f32>, blend: vec4<f32>) -> vec4<f32> {
        return base * mix(vec4<f32>(1.0), blend, blend.a);
      }
      
      fn blendScreen(base: vec4<f32>, blend: vec4<f32>) -> vec4<f32> {
        let invBase = vec4<f32>(1.0) - base;
        let invBlend = vec4<f32>(1.0) - blend;
        return vec4<f32>(1.0) - (invBase * invBlend);
      }
      
      fn blendOverlay(base: vec4<f32>, blend: vec4<f32>) -> vec4<f32> {
        var result: vec4<f32>;
        for (var i = 0; i < 3; i++) {
          if (base[i] < 0.5) {
            result[i] = 2.0 * base[i] * blend[i];
          } else {
            result[i] = 1.0 - 2.0 * (1.0 - base[i]) * (1.0 - blend[i]);
          }
        }
        result.a = base.a;
        return result;
      }
    `;
  }

  /**
   * Auto compositor shader: fullscreen quad per layer.
   * Avoids transform math and vertex buffers to keep autoComposite robust.
   */
  private getAutoCompositorShader(): string {
    return `
      @group(0) @binding(0) var texSampler: sampler;
      @group(0) @binding(1) var layerTexture: texture_2d<f32>;

      struct Params {
        opacity: vec4<f32>,
      }
      @group(0) @binding(2) var<uniform> params: Params;

      struct VSOut {
        @builtin(position) position: vec4<f32>,
        @location(0) uv: vec2<f32>,
      }

      @vertex
      fn vs_main(@builtin(vertex_index) i: u32) -> VSOut {
        var positions = array<vec2<f32>, 6>(
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0,  1.0),
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0,  1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0, -1.0)
        );
        var uvs = array<vec2<f32>, 6>(
          vec2<f32>(0.0, 0.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(0.0, 1.0),
          vec2<f32>(1.0, 0.0),
          vec2<f32>(1.0, 1.0),
          vec2<f32>(0.0, 1.0)
        );

        var out: VSOut;
        out.position = vec4<f32>(positions[i], 0.0, 1.0);
        out.uv = uvs[i];
        return out;
      }

      @fragment
      fn fs_main(@location(0) uv: vec2<f32>) -> @location(0) vec4<f32> {
        let c = textureSample(layerTexture, texSampler, uv);
        return vec4<f32>(c.rgb, c.a * params.opacity.x);
      }
    `;
  }

  /**
   * Present composed frame (for manual mode)
   */
  present(): void {
    // In auto mode, this is called automatically
    // In manual mode, user calls this after blitting
  }

  /**
   * Set compositing mode
   */
  setMode(mode: 'auto' | 'manual'): void {
    this.mode = mode;
    console.log(`[Compositor] Mode set to: ${mode}`);
  }

  /**
   * Resize compositor and update layer dimensions
   */
  resize(width: number, height: number): void {
    // Update canvas dimensions
    this.canvas.width = width;
    this.canvas.height = height;
    
    // Reconfigure context for new size
    const canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: canvasFormat,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST
    });
    
    console.log(`[Compositor] Resized to ${width}x${height}`);
  }

  /**
   * Update layer texture reference (called after texture recreation)
   */
  updateLayerTexture(name: string, texture: GPUTexture): void {
    const layer = this.layers.get(name);
    if (layer) {
      layer.texture = texture;
      layer.width = texture.width;
      layer.height = texture.height;
    }
  }

  // ========== Shader Pipeline Methods ==========

  /**
   * Load a shader effect from a URL
   * @param name - Name to register the effect under
   * @param url - URL to the shader module (must export getShaderConfig())
   */
  async loadEffect(name: string, url: string): Promise<void> {
    if (!this.shaderPipeline) {
      throw new Error('[Compositor] Shader pipeline not initialized');
    }
    await this.shaderPipeline.loadEffect(name, url);
  }

  /**
   * Build a shader pipeline from effect names
   * @param effects - Array of effect names to chain
   */
  async buildPipeline(effects: string[]): Promise<void> {
    if (!this.shaderPipeline) {
      throw new Error('[Compositor] Shader pipeline not initialized');
    }
    await this.shaderPipeline.buildPipeline(effects);
  }

  /**
   * Enable or disable the shader pipeline
   */
  setPipelineEnabled(_enabled: boolean): void {
    // TODO: Implement pipeline enable/disable when we have proper integration
    // For now, this is a no-op placeholder
    console.warn('[Compositor] setPipelineEnabled not yet implemented');
  }

  /**
   * Update a uniform value for a specific effect
   * @param effectName - Name of the effect
   * @param uniformName - Name of the uniform
   * @param value - New value (number or array)
   */
  setEffectUniform(effectName: string, uniformName: string, value: number | number[]): void {
    if (!this.shaderPipeline) {
      throw new Error('[Compositor] Shader pipeline not initialized');
    }
    this.shaderPipeline.setUniform(effectName, uniformName, value);
  }

  /**
   * Get list of registered effects
   */
  getEffects(): string[] {
    return this.shaderPipeline?.getEffects() || [];
  }

  /**
   * Check if an effect is registered
   */
  hasEffect(name: string): boolean {
    return this.shaderPipeline?.hasEffect(name) || false;
  }
}
