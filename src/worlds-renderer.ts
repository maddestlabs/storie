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
import { ShaderManager } from './shader-manager.js';

type WorldsBackgroundConfig = {
  enabled: boolean;
  /** Procedural layer chain, e.g. ['ruledlines','paper'] */
  chain: string[];
  /** Custom shader name for background generation */
  shaderName?: string;
  /** Runtime uniforms for custom shader */
  shaderUniforms?: Record<string, number | number[]>;
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
  private shaderManager: ShaderManager;
  
  // Buffers
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private uniformStride: number = 256;
  private uniformCapacity: number = 0;

  private backgroundTexture: GPUTexture | null = null;
  private backgroundShaderTexture: GPUTexture | null = null;

  // Avoid repeatedly fetching/evaluating the same built-in shader.
  private loadingBuiltinShaders: Set<string> = new Set();
  
  // Render to offscreen texture (for compositor)
  private renderTexture: GPUTexture | null = null;
  private depthTexture: GPUTexture | null = null;
  
  private width: number;
  private height: number;
  private format: GPUTextureFormat;

  constructor(device: GPUDevice, width: number, height: number, shaderManager?: ShaderManager) {
    this.device = device;
    this.width = width;
    this.height = height;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    
    // Use provided shader manager or create our own
    this.shaderManager = shaderManager || new ShaderManager(device, this.format);
    
    // Create render texture immediately so compositor can register it
    this.createRenderTexture();
  }

  /**
   * Initialize the 3D renderer
   */
  async init(): Promise<void> {
    // Note: Render texture already created in constructor
    // Do NOT recreate it here or compositor will have stale reference
    
    // Initialize shader manager
    await this.shaderManager.init();
    
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

    // Full-size shader background texture (render target + sampled in the 3D pipeline).
    this.backgroundShaderTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    
    // Create depth texture
    this.createDepthTexture();
    
    // (init log removed)
  }

  private requestBuiltinShaderLoad(shaderName: string): void {
    const name = String(shaderName ?? '').trim();
    if (!name) return;
    if (this.shaderManager.hasShader(name)) return;
    if (this.loadingBuiltinShaders.has(name)) return;

    this.loadingBuiltinShaders.add(name);
    void this.shaderManager.ensureBuiltinShader(name).finally(() => {
      this.loadingBuiltinShaders.delete(name);
    });
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
          cameraForward: vec4<f32>,
          // x=hasRuledLines, y=hasPaperNoise, z=noiseStrength, w=useShaderBackground
          bgFlags: vec4<f32>,
        };
        
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;
        @group(0) @binding(1) var textureSampler: sampler;
        @group(0) @binding(2) var textureData: texture_2d<f32>;
        @group(0) @binding(3) var backgroundShaderTexture: texture_2d<f32>;
        
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
          // Perspective-correct mapping: cast a ray through the current pixel
          // and intersect with a world-space XY plane at z = params1.z.
          //
          // params1: x=aspect, y=tanHalfFov, z=planeZ, w=reserved
          let aspect = uniforms.params1.x;
          let tanHalfFov = uniforms.params1.y;
          let planeZ = uniforms.params1.z;

          // NDC: x,y in [-1,1] with y up.
          let ndc = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
          let xCam = ndc.x * aspect * tanHalfFov;
          let yCam = ndc.y * tanHalfFov;

          // Camera basis is in world space.
          var dir = uniforms.cameraRight.xyz * xCam + uniforms.cameraUp.xyz * yCam + uniforms.cameraForward.xyz;
          dir = normalize(dir);

          // Intersect with plane z = planeZ.
          let dz = dir.z;
          if (abs(dz) < 1e-5) {
            return uniforms.cameraPos.xy;
          }
          let t = (planeZ - uniforms.cameraPos.z) / dz;
          let p = uniforms.cameraPos.xyz + dir * t;
          return p.xy;
        }

        fn hash21(p: vec2<f32>) -> f32 {
          // Simple, stable hash (no sin/cos) for paper grain.
          let x = dot(p, vec2<f32>(127.1, 311.7));
          let y = dot(p, vec2<f32>(269.5, 183.3));
          let h = fract(sin(x) * 43758.5453 + sin(y) * 12345.6789);
          return h;
        }

        fn modF32(x: f32, y: f32) -> f32 {
          let yy = max(0.0001, y);
          return x - floor(x / yy) * yy;
        }

        fn periodicLineMask(y: f32, period: f32, thickness: f32) -> f32 {
          let p = max(0.0001, period);
          let t = modF32(y, p);
          // AA in the same units as y/period. Using derivatives of y avoids
          // discontinuities around the mod() wrap.
          let aa = max(0.0001, abs(dpdx(y)) + abs(dpdy(y)));
          // Line from t=0..thickness with smooth AA falloff.
          return 1.0 - smoothstep(thickness, thickness + aa, t);
        }

        fn sampleBackgroundAt(coordIn: vec2<f32>) -> vec4<f32> {
          let enabled = uniforms.paperParams.w;
          if (enabled < 0.5) {
            return vec4<f32>(0.0, 0.0, 0.0, 0.0);
          }

          let scale = uniforms.paperParams.x;
          let spacing = max(0.0001, uniforms.paperParams.y);
          let thicknessFrac = clamp(uniforms.paperParams.z, 0.0, 0.5);

          let coord = coordIn * scale;

          // Base paper
          var rgb = uniforms.paperColor.rgb;

          // Optional paper grain (apply after ruled-lines so it remains visible
          // when lines are enabled, and so grain affects lines too).
          let paperStrength = select(0.0, clamp(uniforms.bgFlags.z, 0.0, 1.0), uniforms.bgFlags.y > 0.5);
          var paperGrain: f32 = 0.0;
          if (paperStrength > 0.0) {
            // Cheap multi-octave grain (no gradients): hash at a few scales.
            let n0 = hash21(floor(coord * 8.0));
            let n1 = hash21(floor(coord * 23.0));
            let n2 = hash21(floor(coord * 61.0));
            let n = n0 * 0.6 + n1 * 0.3 + n2 * 0.1;
            paperGrain = (n - 0.5) * 2.0; // -1..1
          }

          // Optional ruled lines (notebook-style): minor + major + alternating tint.
          // Mirrors the compositor ruledlines shader structure (multiply-like blend).
          if (uniforms.bgFlags.x > 0.5) {
            let y = coord.y;

            // Major line period is spacing (world units after scale).
            let majorPeriod = spacing;
            let majorThickness = max(0.00005, thicknessFrac * majorPeriod);

            // Minor lines are a subtle higher-frequency texture.
            let minorPeriod = max(0.0001, majorPeriod * 0.2);
            let minorThickness = max(0.00003, majorThickness * 0.6);

            // Theme-derived alpha is intentionally subtle (~0.25). Boost it
            // to better match the compositor ruledlines shader default (~0.6).
            let lineOpacity = clamp(uniforms.lineColor.a * 2.4, 0.0, 1.0);
            // Treat lineColor.rgb as a multiplicative darkening factor (<1 = darker).
            let baseFactor = clamp(uniforms.lineColor.rgb, vec3<f32>(0.0), vec3<f32>(1.0));

            // Blend factors (closer to 1.0 = subtler).
            let darkBlend = mix(vec3<f32>(1.0), baseFactor, lineOpacity);
            let lightBlend = mix(vec3<f32>(1.0), mix(vec3<f32>(1.0), baseFactor, 0.4), lineOpacity * 0.8);
            let altBlend = mix(vec3<f32>(1.0), mix(vec3<f32>(1.0), baseFactor, 0.2), lineOpacity * 0.35);

            let lightMask = periodicLineMask(y, minorPeriod, minorThickness);
            let darkMask = periodicLineMask(y, majorPeriod, majorThickness);

            // Alternate tint every 2 major lines (subtle banding).
            let lineNumber = floor(y / majorPeriod);
            let altPhase = modF32(lineNumber, 2.0);
            let altMask = select(0.0, 1.0, altPhase < 1.0);

            rgb = rgb * mix(vec3<f32>(1.0), lightBlend, lightMask);
            rgb = rgb * mix(vec3<f32>(1.0), altBlend, altMask);
            rgb = rgb * mix(vec3<f32>(1.0), darkBlend, darkMask);
          }

          if (paperStrength > 0.0) {
            // Multiplicative grain reads better on light themes and stays
            // visible under multiply-blended ruled lines.
            let g = 0.10 * paperStrength;
            rgb = clamp(rgb * (1.0 + vec3<f32>(paperGrain) * g), vec3<f32>(0.0), vec3<f32>(1.0));
          }

          return vec4<f32>(rgb, 1.0);
        }
        
        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          let texColor = textureSample(textureData, textureSampler, input.uv);
          let isBackground = uniforms.params0.x < 0.0;
          var outColor = texColor;

          // Full-screen paper pass only. Section textures are rendered with a
          // transparent background so paper shows through from behind.
          if (isBackground && uniforms.paperParams.w > 0.5) {
            if (uniforms.bgFlags.w > 0.5) {
              // Use custom shader background texture (world-locked mapping)
              // Map the ray/plane intersection coord into a repeatable UV domain.
              let coord = paperCoordFromScreenUv(input.uv);
              var uv2 = fract(coord * uniforms.paperParams.x);
              // Avoid sampling exactly at the clamp edge.
              uv2 = uv2 * 0.999 + vec2<f32>(0.0005, 0.0005);
              outColor = textureSample(backgroundShaderTexture, textureSampler, uv2);
            } else {
              // Use procedural background
              let coord = paperCoordFromScreenUv(input.uv);
              outColor = sampleBackgroundAt(coord);
            }
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
    background?: WorldsBackgroundConfig
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
    const shaderName = background?.shaderName;
    if (paperEnabled && shaderName && !this.shaderManager.hasShader(shaderName)) {
      // Kick off async load; we'll start using it on a later frame.
      this.requestBuiltinShaderLoad(shaderName);
    }

    const useShaderBackground = paperEnabled && !!shaderName && this.shaderManager.hasShader(shaderName);
    const bgFlags = paperEnabled ? [hasRuledLines ? 1 : 0, hasPaper ? 1 : 0, noiseStrength, useShaderBackground ? 1 : 0] : [0, 0, 0, 0];

    const camPos = camera.effectivePosition ?? camera.position;
    const cameraPos = new Float32Array([
      camPos.x,
      camPos.y,
      camPos.z,
      1,
    ]);

    // Camera basis in world space from view matrix (column-major lookAt).
    // Right = first column, Up = second column.
    const cameraRight = new Float32Array([viewMatrix[0], viewMatrix[4], viewMatrix[8], 0]);
    const cameraUp = new Float32Array([viewMatrix[1], viewMatrix[5], viewMatrix[9], 0]);
    // Forward is -Z axis in view space; in our lookAt matrix the third column
    // is the camera's backward (zAxis = normalize(eye - target)).
    const cameraForward = new Float32Array([-viewMatrix[2], -viewMatrix[6], -viewMatrix[10], 0]);

    // Full-screen paper background pass (drawn into the 3D layer).
    if (paperEnabled) {
      if (!this.backgroundTexture) {
        console.warn('WorldsRenderer missing backgroundTexture');
      } else {
        // Check if using custom shader for background
        const shaderName = background!.shaderName;
        if (shaderName && this.shaderManager.hasShader(shaderName) && this.backgroundShaderTexture) {
          // Set shader uniforms if provided
          if (background!.shaderUniforms) {
            for (const [uniformName, value] of Object.entries(background!.shaderUniforms)) {
              if (this.shaderManager.hasUniform(shaderName, uniformName)) {
                this.shaderManager.setUniform(shaderName, uniformName, value);
              }
            }
          }
          
          // Activate the shader
          this.shaderManager.setActiveShader(shaderName);
          
          // Create a temporary texture for shader input (transparent)
          const tempTexture = this.device.createTexture({
            size: { width: this.width, height: this.height },
            format: this.format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT
          });
          
          // Clear temp texture to transparent
          const clearEncoder = this.device.createCommandEncoder();
          const clearPass = clearEncoder.beginRenderPass({
            colorAttachments: [{
              view: tempTexture.createView(),
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              loadOp: 'clear',
              storeOp: 'store'
            }]
          });
          clearPass.end();
          this.device.queue.submit([clearEncoder.finish()]);
          
          // Apply shader to render background
          const shaderEncoder = this.device.createCommandEncoder();
          this.shaderManager.applyShader(tempTexture, this.backgroundShaderTexture, shaderEncoder);
          this.device.queue.submit([shaderEncoder.finish()]);
          
          // Clean up temp texture
          tempTexture.destroy();
        }
        
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

        // Paper plane selection: use the median Z of visible cards as the
        // background sampling plane. This keeps the paper “under” the sections
        // without baking per-card paper.
        const zVals = layouts
          .filter(l => l.visible)
          .map(l => l.transform.position.z)
          .sort((a, b) => a - b);
        const planeZ = zVals.length ? zVals[(zVals.length / 2) | 0]! : 0;

        // params1: x=aspect, y=tanHalfFov, z=planeZ, w=reserved
        const params1 = new Float32Array([aspect, Math.tan(camera.fov * 0.5), planeZ, 0]);

        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 0, mvp);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 64, params0);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 80, params1);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 96, new Float32Array(paperColor));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 112, new Float32Array(lineColor));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 128, new Float32Array(paperParams));
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 144, cameraPos);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 160, cameraRight);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 176, cameraUp);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 192, cameraForward);
        this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 208, new Float32Array(bgFlags));

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

      const baseW = (layout.worldWidth ?? layout.width);
      const baseH = (layout.worldHeight ?? layout.height);
      
      // Apply section dimensions to transform scale
      const sectionTransform: Transform3D = {
        position: layout.transform.position,
        rotation: layout.transform.rotation,
        scale: {
          x: layout.transform.scale.x * baseW,
          y: layout.transform.scale.y * baseH,
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
      const params0 = new Float32Array([baseW, baseH, hover, highlightEnabled]);
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
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 192, cameraForward);
      this.device.queue.writeBuffer(this.uniformBuffer, uniformOffset + 208, new Float32Array([0, 0, 0, 0]));
      
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

    const shaderBgTexture = this.backgroundShaderTexture ?? this.backgroundTexture;
    if (!shaderBgTexture) return null;
    
    return this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer, offset: uniformOffset, size: 224 }
        },
        {
          binding: 1,
          resource: this.sampler
        },
        {
          binding: 2,
          resource: texture.createView()
        },
        {
          binding: 3,
          resource: shaderBgTexture.createView()
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

    if (this.backgroundShaderTexture) {
      this.backgroundShaderTexture.destroy();
    }
    this.backgroundShaderTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
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
    this.backgroundShaderTexture?.destroy();
  }
}
