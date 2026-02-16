/**
 * WebGPU 3D Canvas Renderer
 * 
 * Renders sections as textured quads in 3D space with perspective projection.
 * Uses WebGPU for hardware-accelerated 3D rendering.
 */

import type { Camera3D, Section3DLayout, Transform3D } from './canvas3d-types.js';
import {
  mat4FromTransform,
  getCameraViewMatrix,
  getCameraProjectionMatrix,
  mat4Multiply
} from './canvas3d.js';

export class Canvas3DRenderer {
  private device: GPUDevice;
  private renderPipeline: GPURenderPipeline | null = null;
  
  // Buffers
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private uniformStride: number = 256;
  private uniformCapacity: number = 0;
  
  // Render to offscreen texture (for compositor)
  private renderTexture: GPUTexture | null = null;
  private depthTexture: GPUTexture | null = null;
  
  private width: number;
  private height: number;
  private format: GPUTextureFormat;

  constructor(device: GPUDevice, width: number, height: number) {
    this.device = device;
    this.width = width;
    this.height = height;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    
    // Create render texture immediately so compositor can register it
    this.createRenderTexture();
  }

  /**
   * Initialize the 3D renderer
   */
  async init(): Promise<void> {
    // Note: Render texture already created in constructor
    // Do NOT recreate it here or compositor will have stale reference
    
    // Create render pipeline
    await this.createRenderPipeline(this.format);
    
    // Create geometry buffers
    this.createGeometryBuffers();
    
    // Create uniform buffer
    this.ensureUniformBufferCapacity(64);

    // Create shared sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
    
    // Create depth texture
    this.createDepthTexture();
    
    // (init log removed)
  }

  /**
   * Create offscreen render texture
   */
  private createRenderTexture(): void {
    if (this.renderTexture) {
      this.renderTexture.destroy();
    }
    
    this.renderTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
  }

  /**
   * Create the render pipeline with shaders
   */
  private async createRenderPipeline(format: GPUTextureFormat): Promise<void> {
    const shaderModule = this.device.createShaderModule({
      label: '3D Canvas Shader',
      code: `
        struct Uniforms {
          mvpMatrix: mat4x4<f32>,
          params0: vec4<f32>,
          params1: vec4<f32>,
        };
        
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var textureSampler: sampler;
        @group(0) @binding(2) var textureData: texture_2d<f32>;
        
        struct VertexInput {
          @location(0) position: vec3<f32>,
          @location(1) uv: vec2<f32>,
        };
        
        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) uv: vec2<f32>,
        };
        
        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
          var output: VertexOutput;
          output.position = uniforms.mvpMatrix * vec4<f32>(input.position, 1.0);
          output.uv = input.uv;
          return output;
        }
        
        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          let texColor = textureSample(textureData, textureSampler, input.uv);
          // params0.z is full-card hover flag (1 = hovered)
          if (uniforms.params0.z > 0.5) {
            return vec4<f32>(vec3<f32>(1.0) - texColor.rgb, texColor.a);
          }
          // params0.w is highlight flag (1 = enabled)
          if (uniforms.params0.w > 0.5) {
            let umin = uniforms.params1.x;
            let vmin = uniforms.params1.y;
            let umax = uniforms.params1.z;
            let vmax = uniforms.params1.w;
            if (input.uv.x >= umin && input.uv.x <= umax && input.uv.y >= vmin && input.uv.y <= vmax) {
              return vec4<f32>(vec3<f32>(1.0) - texColor.rgb, texColor.a);
            }
          }
          return texColor;
        }
      `
    });
    
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 20, // 3 floats (position) + 2 floats (uv) = 5 * 4 bytes
      attributes: [
        {
          // position
          shaderLocation: 0,
          offset: 0,
          format: 'float32x3'
        },
        {
          // uv
          shaderLocation: 1,
          offset: 12,
          format: 'float32x2'
        }
      ]
    };
    
    this.renderPipeline = this.device.createRenderPipeline({
      label: '3D Canvas Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: format,
          blend: {
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
          }
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'  // DEBUG: Disable culling to see if winding order is wrong
      }
      // DEBUG: Depth testing disabled to test if that's the issue
      // depthStencil: {
      //   format: 'depth24plus',
      //   depthWriteEnabled: true,
      //   depthCompare: 'less'
      // }
    });
  }

  /**
   * Create geometry buffers for a quad
   */
  private createGeometryBuffers(): void {
    // Vertex data: position (xyz) + uv (xy)
    // Quad centered at origin, 1x1 unit size (will be scaled by transform)
    const vertices = new Float32Array([
      // position           uv
      -0.5, -0.5, 0.0,     0.0, 1.0,  // bottom-left
       0.5, -0.5, 0.0,     1.0, 1.0,  // bottom-right
       0.5,  0.5, 0.0,     1.0, 0.0,  // top-right
      -0.5,  0.5, 0.0,     0.0, 0.0,  // top-left
    ]);
    
    this.vertexBuffer = this.device.createBuffer({
      label: 'Quad Vertex Buffer',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.vertexBuffer, 0, vertices);
    
    // Index data (two triangles)
    const indices = new Uint16Array([
      0, 1, 2,  // first triangle
      0, 2, 3   // second triangle
    ]);
    
    this.indexBuffer = this.device.createBuffer({
      label: 'Quad Index Buffer',
      size: indices.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });
    this.device.queue.writeBuffer(this.indexBuffer, 0, indices);
  }

  /**
   * Create uniform buffer for MVP matrix
   */
  private ensureUniformBufferCapacity(sectionCount: number): void {
    const needed = Math.max(1, sectionCount);
    if (this.uniformBuffer && this.uniformCapacity >= needed) {
      return;
    }

    this.uniformBuffer?.destroy();

    // Each draw gets a 256-byte aligned slice (WebGPU uniform offset alignment).
    this.uniformCapacity = needed;
    this.uniformBuffer = this.device.createBuffer({
      label: '3D Uniform Buffer',
      size: this.uniformCapacity * this.uniformStride,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
  }

  /**
   * Create depth texture for depth testing
   */
  private createDepthTexture(): void {
    this.depthTexture = this.device.createTexture({
      size: {
        width: this.width,
        height: this.height
      },
      format: 'depth24plus',
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }

  /**
   * Render all 3D sections
   */
  render(camera: Camera3D, layouts: Section3DLayout[], hoveredSectionIndex: number | null = null): void {
    if (!this.renderPipeline || !this.vertexBuffer || !this.indexBuffer || !this.renderTexture) {
      console.warn('Canvas3DRenderer not fully initialized');
      return;
    }

    this.ensureUniformBufferCapacity(layouts.length);
    if (!this.uniformBuffer || !this.sampler) {
      console.warn('Canvas3DRenderer not fully initialized');
      return;
    }
    
    // Count visible sections
    // (kept for future stats/debugging)
    const visibleCount = layouts.filter(l => l.visible && l.texture).length;
    
    // Render to offscreen texture
    const view = this.renderTexture.createView();
    
    // Create command encoder
    const encoder = this.device.createCommandEncoder({ label: '3D Canvas Encoder' });
    
    // Create render pass
    // Clear to transparent so compositor can blend properly
    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [{
        view: view,
        clearValue: { r: 0, g: 0, b: 0, a: 0 }, // Transparent
        loadOp: 'clear',
        storeOp: 'store'
      }]
      // DEBUG: Depth testing disabled
      // depthStencilAttachment: {
      //   view: this.depthTexture!.createView(),
      //   depthClearValue: 1.0,
      //   depthLoadOp: 'clear',
      //   depthStoreOp: 'store'
      // }
    };
    
    const pass = encoder.beginRenderPass(renderPassDescriptor);
    pass.setPipeline(this.renderPipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    
    // Calculate view and projection matrices
    const aspect = this.width / this.height;
    const viewMatrix = getCameraViewMatrix(camera);
    const projectionMatrix = getCameraProjectionMatrix(camera, aspect);
    const viewProjectionMatrix = mat4Multiply(projectionMatrix, viewMatrix);
    
    // Render each visible section
    let drawnCount = 0;
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      if (!layout.visible || !layout.texture) continue;
      
      // Apply section dimensions to transform scale
      const sectionTransform: Transform3D = {
        position: layout.transform.position,
        rotation: layout.transform.rotation,
        scale: {
          x: layout.transform.scale.x * layout.width,
          y: layout.transform.scale.y * layout.height,
          z: layout.transform.scale.z
        }
      };
      
      // Calculate MVP matrix for this section
      const modelMatrix = mat4FromTransform(sectionTransform);
      const mvpMatrix = mat4Multiply(viewProjectionMatrix, modelMatrix);

      // Clip-space culling (skip cards fully outside any frustum plane).
      // Use the quad corners in local space.
      const clip = (x: number, y: number, z: number, w: number) => {
        const m = mvpMatrix;
        return {
          x: m[0] * x + m[4] * y + m[8] * z + m[12] * w,
          y: m[1] * x + m[5] * y + m[9] * z + m[13] * w,
          z: m[2] * x + m[6] * y + m[10] * z + m[14] * w,
          w: m[3] * x + m[7] * y + m[11] * z + m[15] * w,
        };
      };
      const corners = [
        clip(-0.5, -0.5, 0, 1),
        clip(0.5, -0.5, 0, 1),
        clip(0.5, 0.5, 0, 1),
        clip(-0.5, 0.5, 0, 1),
      ];
      const all = (pred: (p: { x: number; y: number; z: number; w: number }) => boolean) => corners.every(pred);
      if (all(p => p.x < -p.w) || all(p => p.x > p.w) || all(p => p.y < -p.w) || all(p => p.y > p.w) || all(p => p.z < 0) || all(p => p.z > p.w)) {
        continue;
      }
      
      // Update this section's uniform slice.
      const uniformOffset = i * this.uniformStride;

      // MVP matrix at offset +0
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        uniformOffset + 0,
        mvpMatrix.buffer,
        mvpMatrix.byteOffset,
        mvpMatrix.byteLength
      );
      
      // Params at offset +64 (after mat4): xy=logical size, z=hover flag
      const hover = hoveredSectionIndex !== null && layout.sectionIndex === hoveredSectionIndex ? 1.0 : 0.0;
      const rect = layout.highlightUvRect;
      const highlightEnabled = rect ? 1.0 : 0.0;
      const params0 = new Float32Array([layout.width, layout.height, hover, highlightEnabled]);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 64, params0);

      const params1 = rect
        ? new Float32Array([rect.uMin, rect.vMin, rect.uMax, rect.vMax])
        : new Float32Array([0, 0, 0, 0]);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 80, params1);
      
      // Create bind group for this section (texture + uniforms)
      const bindGroup = this.createSectionBindGroup(layout, uniformOffset);
      if (!bindGroup) continue;
      
      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(6); // 6 indices for quad
      drawnCount++;
    }
    
    pass.end();
    
    // Submit commands
    this.device.queue.submit([encoder.finish()]);
    
    void visibleCount;
    void drawnCount;
  }

  /**
   * Create bind group for a section (texture sampling)
   */
  private createSectionBindGroup(layout: Section3DLayout, uniformOffset: number): GPUBindGroup | null {
    if (!layout.texture || !this.renderPipeline || !this.uniformBuffer || !this.sampler) return null;
    
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer, offset: uniformOffset, size: 96 }
        },
        {
          binding: 1,
          resource: this.sampler
        },
        {
          binding: 2,
          resource: layout.texture.createView()
        }
      ]
    });
  }

  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    
    // Recreate textures with new size
    if (this.depthTexture) {
      this.depthTexture.destroy();
    }
    this.createDepthTexture();
    this.createRenderTexture();
  }

  /**
   * Get the render texture (for compositor layer)
   */
  getRenderTexture(): GPUTexture | null {
    return this.renderTexture;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.uniformBuffer?.destroy();
    this.depthTexture?.destroy();
    this.renderTexture?.destroy();
  }
}
