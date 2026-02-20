/**
 * WebGPU Worlds Renderer
 * 
 * Renders sections as textured quads in 3D space with perspective projection.
 * Uses WebGPU for hardware-accelerated 3D rendering.
 */

import type { Camera3D, Section3DLayout, Transform3D } from './worlds-types.js';
import {
  mat4FromTransform,
  getCameraViewMatrix,
  getCameraProjectionMatrix,
  mat4Multiply
} from './worlds.js';
import { ColorUtils, type Color } from './types.js';

type WorldsBackgroundConfig = {
  enabled: boolean;
  /** Procedural layer chain, e.g. ['ruledlines','paper'] */
  chain: string[];
  paperColor: Color;
  lineColor: Color;
  /** Coordinate scale applied to projected coords before sampling. */
  scale: number;
  /** Line spacing in world units (after scale). */
  spacing: number;
  /** Thickness as a fraction of spacing (0..0.5). */
  thickness: number;
  /** Noise strength for the 'paper' layer (0..1). */
  noiseStrength: number;
};

export class WorldsRenderer {
  private device: GPUDevice;
  private renderPipeline: GPURenderPipeline | null = null;
  
  // Buffers
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private uniformStride: number = 256;
  private uniformCapacity: number = 0;

  private backgroundTexture: GPUTexture | null = null;
  
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

    // 1x1 transparent texture for full-screen paper pass.
    this.backgroundTexture = this.device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    this.device.queue.writeTexture(
      { texture: this.backgroundTexture },
      new Uint8Array([0, 0, 0, 0]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
    
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
          paperColor: vec4<f32>,
          lineColor: vec4<f32>,
          // x=scale, y=spacing, z=thicknessFrac, w=enabled
          paperParams: vec4<f32>,
          cameraPos: vec4<f32>,
          cameraRight: vec4<f32>,
          cameraUp: vec4<f32>,
          // x=hasRuledLines, y=hasPaperNoise, z=noiseStrength, w=reserved
          bgFlags: vec4<f32>,
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

        fn paperCoordFromScreenUv(uv: vec2<f32>) -> vec2<f32> {
          // Linear, camera-oriented background mapping.
          // Uses camera right/up (projected into XY) so the paper rotates with
          // the camera/section yaw, without ray-plane perspective warping.
          // params1: x=viewW, y=viewH
          let viewW = uniforms.params1.x;
          let viewH = uniforms.params1.y;
          let delta = (uv - vec2<f32>(0.5, 0.5)) * vec2<f32>(viewW, viewH);
          let rightXY = uniforms.cameraRight.xy;
          let upXY = uniforms.cameraUp.xy;
          return uniforms.cameraPos.xy + rightXY * delta.x + upXY * delta.y;
        }

        fn hash21(p: vec2<f32>) -> f32 {
          // Simple, stable hash (no sin/cos) for paper grain.
          let x = dot(p, vec2<f32>(127.1, 311.7));
          let y = dot(p, vec2<f32>(269.5, 183.3));
          let h = fract(sin(x) * 43758.5453 + sin(y) * 12345.6789);
          return h;
        }

        fn sampleBackgroundAt(coordIn: vec2<f32>) -> vec4<f32> {
          let enabled = uniforms.paperParams.w;
          if (enabled < 0.5) {
            return vec4<f32>(0.0, 0.0, 0.0, 0.0);
          }

          let scale = uniforms.paperParams.x;
          let spacing = max(0.0001, uniforms.paperParams.y);
          let thickness = clamp(uniforms.paperParams.z, 0.0, 0.5);

          let coord = coordIn * scale;

          // Base paper
          var rgb = uniforms.paperColor.rgb;

          // Optional paper grain
          if (uniforms.bgFlags.y > 0.5) {
            let s = clamp(uniforms.bgFlags.z, 0.0, 1.0);
            let n = hash21(floor(coord * 8.0));
            let grain = (n - 0.5) * 2.0; // -1..1
            rgb = clamp(rgb + vec3<f32>(grain) * (0.08 * s), vec3<f32>(0.0), vec3<f32>(1.0));
          }

          // Optional ruled lines
          if (uniforms.bgFlags.x > 0.5) {
            let y = coord.y;
            let phase = fract(y / spacing);
            let mask = select(0.0, 1.0, phase < thickness);
            let t = mask * uniforms.lineColor.a;
            rgb = mix(rgb, uniforms.lineColor.rgb, t);
          }

          return vec4<f32>(rgb, 1.0);
        }
        
        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          let texColor = textureSample(textureData, textureSampler, input.uv);
          let isBackground = uniforms.params0.x < 0.0;
          var outColor = texColor;

          // Full-screen paper pass only (no per-card paper).
          if (isBackground && uniforms.paperParams.w > 0.5) {
            let coord = paperCoordFromScreenUv(input.uv);
            outColor = sampleBackgroundAt(coord);
          }

          // params0.z is full-card hover flag (1 = hovered)
          if (uniforms.params0.z > 0.5) {
            return vec4<f32>(vec3<f32>(1.0) - outColor.rgb, outColor.a);
          }
          // params0.w is highlight flag (1 = enabled)
          if (uniforms.params0.w > 0.5) {
            let umin = uniforms.params1.x;
            let vmin = uniforms.params1.y;
            let umax = uniforms.params1.z;
            let vmax = uniforms.params1.w;
            if (input.uv.x >= umin && input.uv.x <= umax && input.uv.y >= vmin && input.uv.y <= vmax) {
              return vec4<f32>(vec3<f32>(1.0) - outColor.rgb, outColor.a);
            }
          }
          return outColor;
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
  render(
    camera: Camera3D,
    layouts: Section3DLayout[],
    hoveredSectionIndex: number | null = null,
    background?: WorldsBackgroundConfig,
    cardXScaleFactor: number = 1
  ): void {
    if (!this.renderPipeline || !this.vertexBuffer || !this.indexBuffer || !this.renderTexture) {
      console.warn('WorldsRenderer not fully initialized');
      return;
    }

    const paperEnabled = !!background?.enabled;
    this.ensureUniformBufferCapacity(layouts.length + (paperEnabled ? 1 : 0));
    if (!this.uniformBuffer || !this.sampler) {
      console.warn('WorldsRenderer not fully initialized');
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

    const paperColor = paperEnabled ? ColorUtils.rgbaNorm(background!.paperColor) : [0, 0, 0, 0];
    const lineColor = paperEnabled ? ColorUtils.rgbaNorm(background!.lineColor) : [0, 0, 0, 0];
    const paperParams = paperEnabled
      ? [
          Number.isFinite(background!.scale) ? background!.scale : 1,
          Number.isFinite(background!.spacing) ? background!.spacing : 1,
          Number.isFinite(background!.thickness) ? background!.thickness : 0.06,
          1,
        ]
      : [0, 0, 0, 0];

    const chain = paperEnabled ? (background!.chain || []) : [];
    const hasRuledLines = chain.some(s => s === 'ruledlines' || s === 'ruled-lines' || s === 'ruled_lines');
    const hasPaper = chain.some(s => s === 'paper');
    const noiseStrength = paperEnabled ? (Number.isFinite(background!.noiseStrength) ? background!.noiseStrength : 0.06) : 0;
    const bgFlags = paperEnabled ? [hasRuledLines ? 1 : 0, hasPaper ? 1 : 0, noiseStrength, 0] : [0, 0, 0, 0];

    const cameraPos = new Float32Array([
      camera.position.x,
      camera.position.y,
      camera.position.z,
      1,
    ]);

    // Camera basis in world space from view matrix (column-major lookAt).
    // Right = first column, Up = second column.
    const cameraRight = new Float32Array([viewMatrix[0], viewMatrix[4], viewMatrix[8], 0]);
    const cameraUp = new Float32Array([viewMatrix[1], viewMatrix[5], viewMatrix[9], 0]);

    // Full-screen paper background pass (drawn into the 3D layer).
    if (paperEnabled) {
      if (!this.backgroundTexture) {
        console.warn('WorldsRenderer missing backgroundTexture');
      } else {
        const uniformOffset = 0;
        // Map local quad (-0.5..0.5) to clip-space (-1..1).
        const mvp = new Float32Array([
          2, 0, 0, 0,
          0, 2, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1,
        ]);

        // Background mode is signaled via params0.x < 0.
        const params0 = new Float32Array([-1, -1, 0, 0]);

        // Use camera Z as a rough view distance; this makes uv->world scale
        // respond to zooming and keeps the paper stable during easing.
        const dist = Math.max(1, Math.abs(camera.position.z));
        const viewH = 2 * dist * Math.tan(camera.fov * 0.5);
        const viewW = viewH * aspect;
        const params1 = new Float32Array([viewW, viewH, dist, 0]);

        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 0, mvp);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 64, params0);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 80, params1);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 96, new Float32Array(paperColor));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 112, new Float32Array(lineColor));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 128, new Float32Array(paperParams));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 144, cameraPos);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 160, cameraRight);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 176, cameraUp);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 192, new Float32Array(bgFlags));

        const bindGroup = this.createBindGroupForTexture(this.backgroundTexture, uniformOffset);
        if (bindGroup) {
          pass.setBindGroup(0, bindGroup);
          pass.drawIndexed(6);
        }
      }
    }
    
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
          x: layout.transform.scale.x * layout.width * cardXScaleFactor,
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
      const uniformIndex = paperEnabled ? (i + 1) : i;
      const uniformOffset = uniformIndex * this.uniformStride;

      // MVP matrix at offset +0
      this.device.queue.writeBuffer(
        this.uniformBuffer,
        uniformOffset + 0,
        mvpMatrix.buffer,
        mvpMatrix.byteOffset,
        mvpMatrix.byteLength
      );
      
      // Params at offset +64: xy=logical size, z=hover flag
      const hover = hoveredSectionIndex !== null && layout.sectionIndex === hoveredSectionIndex ? 1.0 : 0.0;
      const rect = layout.highlightUvRect;
      const highlightEnabled = rect ? 1.0 : 0.0;
      const params0 = new Float32Array([layout.width, layout.height, hover, highlightEnabled]);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 64, params0);

      const params1 = rect
        ? new Float32Array([rect.uMin, rect.vMin, rect.uMax, rect.vMax])
        : new Float32Array([0, 0, 0, 0]);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 80, params1);

      // Paper uniforms (used only for background pass; set disabled for cards)
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 96, new Float32Array(paperColor));
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 112, new Float32Array(lineColor));
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 128, new Float32Array([0, 0, 0, 0]));
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 144, cameraPos);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 160, cameraRight);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 176, cameraUp);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 192, new Float32Array([0, 0, 0, 0]));
      
      // Create bind group for this section (texture + uniforms)
      const bindGroup = this.createBindGroupForTexture(layout.texture, uniformOffset);
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
  private createBindGroupForTexture(texture: GPUTexture, uniformOffset: number): GPUBindGroup | null {
    if (!this.renderPipeline || !this.uniformBuffer || !this.sampler) return null;
    
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer, offset: uniformOffset, size: 208 }
        },
        {
          binding: 1,
          resource: this.sampler
        },
        {
          binding: 2,
          resource: texture.createView()
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
    this.backgroundTexture?.destroy();
  }
}
