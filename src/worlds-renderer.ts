/**
 * WebGPU Worlds Renderer
 * 
 * Renders sections as textured quads in 3D space with perspective projection.
 * Uses WebGPU for hardware-accelerated 3D rendering.
 */

import type { Camera3D, Section3DLayout, Transform3D, WorldsBlendMode } from './worlds-types.js';
import {
  mat4FromTransform,
  getCameraViewMatrix,
  getCameraProjectionMatrix,
  mat4Multiply
} from './worlds.js';
import { ColorUtils, type Color } from './types.js';
import { ShaderManager } from './shader-manager.js';

type RenderableImageSource = ImageBitmap | HTMLImageElement;

export type WorldsSectionArtRenderState = {
  image: RenderableImageSource;
  opacity: number;
  blendMode: WorldsBlendMode;
  layer: 'under' | 'over';
  fit: 'cover' | 'contain' | 'stretch';
  scale: number;
  offsetX: number;
  offsetY: number;
};

type WorldsBackgroundConfig = {
  enabled: boolean;
  /** Procedural layer chain, e.g. ['ruledlines','paper'] */
  chain: string[];
  /** Custom shader name for background generation */
  shaderName?: string;
  /** Runtime uniforms for custom shader */
  shaderUniforms?: Record<string, number | number[]>;
  /** Optional image-based background tile uploaded once and sampled per frame. */
  image?: RenderableImageSource | null;
  /** If true, sample in screen space instead of world space. */
  screenLock?: boolean;
  /**
   * Optional Z plane (world units) used for world-locked background sampling.
   * When omitted, WorldsRenderer uses the median Z of visible cards.
   *
   * Setting this to the currently focused card's Z reduces parallax-induced
   * scale drift between the background paper lines and card text.
   */
  paperPlaneZ?: number;
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
  /** Blend mode for section card compositing over the background. */
  sectionBlendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge';

  /** Optional UV distortion strength applied to section *content* sampling (0..0.05 typical). */
  contentDistortStrength?: number;
  /** Blend strength for in-shader paper multiply (0=none, 1=full multiply). Default 1. */
  contentBlendStrength?: number;
};

type Worlds3DConnector = {
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  control?: { x: number; y: number; z: number };
  color: Color;
  thickness: number;
  opacity: number;
};

export class WorldsRenderer {
  private device: GPUDevice;
  private renderPipeline: GPURenderPipeline | null = null;
  private sharedPipelineLayout: GPUPipelineLayout | null = null;
  private sharedBindGroupLayout: GPUBindGroupLayout | null = null;
  private linePipeline: GPURenderPipeline | null = null;
  private shaderManager: ShaderManager;
  
  // Buffers
  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;
  private uniformBuffer: GPUBuffer | null = null;
  private lineUniformBuffer: GPUBuffer | null = null;
  private lineVertexBuffer: GPUBuffer | null = null;
  private lineIndexBuffer: GPUBuffer | null = null;
  private sampler: GPUSampler | null = null;
  private uniformStride: number = 256;
  private uniformCapacity: number = 0;
  private lineUniformStride: number = 256;
  private lineUniformCapacity: number = 0;
  private static readonly LINE_SEGMENTS = 16;

  private backgroundTexture: GPUTexture | null = null;
  private backgroundShaderTexture: GPUTexture | null = null;
  private backgroundShaderMipLevelCount: number = 1;
  private backgroundImageTexture: GPUTexture | null = null;
  private backgroundImageSource: RenderableImageSource | null = null;
  private sectionArtTextureCache: Map<RenderableImageSource, GPUTexture> = new Map();

  // Neutral 1x1 fallback used to ensure binding(3) is always valid.
  private neutralBackgroundTexture: GPUTexture | null = null;

  // Mipmap generation for backgroundShaderTexture (reduces shimmer under camera motion)
  private mipmapPipeline: GPURenderPipeline | null = null;

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

    this.ensureNeutralBackgroundTexture();
  }

  private ensureNeutralBackgroundTexture(): void {
    if (this.neutralBackgroundTexture) return;
    this.neutralBackgroundTexture = this.device.createTexture({
      label: 'Worlds Neutral Background Texture',
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });
    // Mid-gray RGBA so (luma - 0.5) is ~0 and RG-centered displacement is ~0.
    this.device.queue.writeTexture(
      { texture: this.neutralBackgroundTexture },
      new Uint8Array([128, 128, 128, 255]),
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );
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
    this.createLinePipeline(this.format);
    
    // Create geometry buffers
    this.createGeometryBuffers();
    this.createLineGeometryBuffers();
    
    // Create uniform buffer
    this.ensureUniformBufferCapacity(64);
    this.ensureLineUniformBufferCapacity(64);

    // Create shared sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
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
    // Use mipmaps so world-locked sampling can minify cleanly during camera motion.
    this.backgroundShaderMipLevelCount = this.calcMipLevelCount(this.width, this.height, 9);
    this.backgroundShaderTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      mipLevelCount: this.backgroundShaderMipLevelCount,
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

  setBackgroundImage(image: RenderableImageSource | null): void {
    if (this.backgroundImageSource === image) return;

    this.backgroundImageSource = image;
    if (this.backgroundImageTexture) {
      this.backgroundImageTexture.destroy();
      this.backgroundImageTexture = null;
    }

    if (!image) return;

    const width = Math.max(1, image.width | 0);
    const height = Math.max(1, image.height | 0);
    const mipLevelCount = this.calcMipLevelCount(width, height, 12);
    const texture = this.device.createTexture({
      size: { width, height },
      mipLevelCount,
      format: this.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });

    try {
      this.device.queue.copyExternalImageToTexture(
        { source: image },
        { texture },
        { width, height }
      );

      const encoder = this.device.createCommandEncoder({ label: 'WorldsRenderer Background Image Upload' });
      this.generateMipmaps(encoder, texture, mipLevelCount, width, height);
      this.device.queue.submit([encoder.finish()]);
      this.backgroundImageTexture = texture;
    } catch (error) {
      console.warn('[WorldsRenderer] Failed to upload background image texture:', error);
      texture.destroy();
      this.backgroundImageSource = null;
    }
  }

  private getRenderableImageSize(image: RenderableImageSource): { width: number; height: number } {
    return {
      width: Math.max(1, ((image as any).width ?? (image as any).naturalWidth ?? 1) | 0),
      height: Math.max(1, ((image as any).height ?? (image as any).naturalHeight ?? 1) | 0),
    };
  }

  private ensureSectionArtTexture(image: RenderableImageSource): GPUTexture | null {
    const cached = this.sectionArtTextureCache.get(image);
    if (cached) return cached;

    const { width, height } = this.getRenderableImageSize(image);
    const mipLevelCount = this.calcMipLevelCount(width, height, 10);
    const texture = this.device.createTexture({
      size: { width, height },
      mipLevelCount,
      format: this.format,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    try {
      this.device.queue.copyExternalImageToTexture(
        { source: image },
        { texture },
        { width, height }
      );
      const encoder = this.device.createCommandEncoder({ label: 'WorldsRenderer Section Art Upload' });
      this.generateMipmaps(encoder, texture, mipLevelCount, width, height);
      this.device.queue.submit([encoder.finish()]);
      this.sectionArtTextureCache.set(image, texture);
      return texture;
    } catch (error) {
      console.warn('[WorldsRenderer] Failed to upload section art texture:', error);
      texture.destroy();
      return null;
    }
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

  private calcMipLevelCount(width: number, height: number, maxLevels: number = 9): number {
    const w = Math.max(1, width | 0);
    const h = Math.max(1, height | 0);
    const levels = 1 + Math.floor(Math.log2(Math.max(w, h)));
    return Math.max(1, Math.min(maxLevels, levels));
  }

  private ensureMipmapPipeline(): void {
    if (this.mipmapPipeline) return;
    this.mipmapPipeline = this.device.createRenderPipeline({
      label: 'WorldsRenderer Mipmap Pipeline',
      layout: 'auto',
      vertex: {
        module: this.device.createShaderModule({
          label: 'WorldsRenderer Mipmap Shader',
          code: `
            struct VSOut {
              @builtin(position) pos: vec4f,
              @location(0) uv: vec2f,
            };

            @vertex
            fn vertexMain(@builtin(vertex_index) i: u32) -> VSOut {
              var positions = array<vec2f, 3>(
                vec2f(-1.0, -1.0),
                vec2f( 3.0, -1.0),
                vec2f(-1.0,  3.0)
              );
              let p = positions[i];
              var out: VSOut;
              out.pos = vec4f(p, 0.0, 1.0);
              out.uv = p * 0.5 + vec2f(0.5, 0.5);
              return out;
            }

            @group(0) @binding(0) var srcTex: texture_2d<f32>;
            @group(0) @binding(1) var srcSampler: sampler;

            @fragment
            fn fragmentMain(input: VSOut) -> @location(0) vec4f {
              return textureSampleLevel(srcTex, srcSampler, input.uv, 0.0);
            }
          `
        }),
        entryPoint: 'vertexMain'
      },
      fragment: {
        module: this.device.createShaderModule({
          label: 'WorldsRenderer Mipmap Shader (Frag)',
          code: `
            struct VSOut {
              @builtin(position) pos: vec4f,
              @location(0) uv: vec2f,
            };

            @group(0) @binding(0) var srcTex: texture_2d<f32>;
            @group(0) @binding(1) var srcSampler: sampler;

            @fragment
            fn fragmentMain(input: VSOut) -> @location(0) vec4f {
              return textureSampleLevel(srcTex, srcSampler, input.uv, 0.0);
            }
          `
        }),
        entryPoint: 'fragmentMain',
        targets: [{ format: this.format }]
      },
      primitive: { topology: 'triangle-list' }
    });
  }

  private generateMipmaps(encoder: GPUCommandEncoder, texture: GPUTexture, mipLevelCount: number, textureWidth?: number, textureHeight?: number): void {
    if (!this.sampler) return;
    if (mipLevelCount <= 1) return;
    this.ensureMipmapPipeline();
    if (!this.mipmapPipeline) return;

    let mipWidth = textureWidth ?? this.width;
    let mipHeight = textureHeight ?? this.height;

    for (let level = 1; level < mipLevelCount; level++) {
      mipWidth = Math.max(1, mipWidth >> 1);
      mipHeight = Math.max(1, mipHeight >> 1);

      const srcView = texture.createView({ baseMipLevel: level - 1, mipLevelCount: 1 });
      const dstView = texture.createView({ baseMipLevel: level, mipLevelCount: 1 });

      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: dstView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      pass.setPipeline(this.mipmapPipeline);
      pass.setViewport(0, 0, mipWidth, mipHeight, 0, 1);
      const bindGroup = this.device.createBindGroup({
        layout: this.mipmapPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: srcView },
          { binding: 1, resource: this.sampler }
        ]
      });
      pass.setBindGroup(0, bindGroup);
      pass.draw(3);
      pass.end();
    }
  }

  private ensureLineUniformBufferCapacity(count: number): void {
    const needed = Math.max(1, count | 0);
    if (this.lineUniformBuffer && this.lineUniformCapacity >= needed) return;

    this.lineUniformCapacity = Math.max(needed, this.lineUniformCapacity > 0 ? this.lineUniformCapacity * 2 : 64);
    if (this.lineUniformBuffer) {
      this.lineUniformBuffer.destroy();
    }
    this.lineUniformBuffer = this.device.createBuffer({
      size: this.lineUniformStride * this.lineUniformCapacity,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  private createLinePipeline(format: GPUTextureFormat): void {
    const shaderModule = this.device.createShaderModule({
      label: 'Worlds 3D Connector Shader',
      code: `
        struct LineUniforms {
          viewProj: mat4x4<f32>,
          start: vec4<f32>,
          end: vec4<f32>,
          control: vec4<f32>,
          color: vec4<f32>,
          cameraForward: vec4<f32>,
          cameraRight: vec4<f32>,
          params: vec4<f32>,
        };

        @group(0) @binding(0) var<uniform> uniforms: LineUniforms;

        struct VertexInput {
          @location(0) position: vec3<f32>,
          @location(1) uv: vec2<f32>,
        };

        struct VertexOutput {
          @builtin(position) position: vec4<f32>,
          @location(0) color: vec4<f32>,
        };

        @vertex
        fn vertexMain(input: VertexInput) -> VertexOutput {
          let t = input.position.x + 0.5;
          let start = uniforms.start.xyz;
          let end = uniforms.end.xyz;
          let ctrl = uniforms.control.xyz;

          // Quadratic Bezier: p(t) = (1-t)^2 * start + 2(1-t)t * ctrl + t^2 * end
          let u = 1.0 - t;
          let pointOnCurve = (u * u) * start + (2.0 * u * t) * ctrl + (t * t) * end;

          // Tangent: p'(t) = 2(1-t)(ctrl-start) + 2t(end-ctrl)
          var tangent = (2.0 * u) * (ctrl - start) + (2.0 * t) * (end - ctrl);
          let tanLen = length(tangent);
          if (tanLen > 1e-5) {
            tangent = tangent / tanLen;
          } else {
            // Fallback: straight direction
            var dir = end - start;
            let dirLen = length(dir);
            tangent = select(uniforms.cameraRight.xyz, dir / dirLen, dirLen > 1e-5);
          }

          var side = cross(uniforms.cameraForward.xyz, tangent);
          let sideLen = length(side);
          if (sideLen > 1e-5) {
            side = side / sideLen;
          } else {
            side = uniforms.cameraRight.xyz;
          }

          let thickness = uniforms.params.x;
          let point = pointOnCurve + side * input.position.y * thickness;

          var output: VertexOutput;
          output.position = uniforms.viewProj * vec4<f32>(point, 1.0);
          output.color = uniforms.color;
          return output;
        }

        @fragment
        fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
          return input.color;
        }
      `,
    });

    this.linePipeline = this.device.createRenderPipeline({
      label: 'Worlds 3D Connector Pipeline',
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 20,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' },
            { shaderLocation: 1, offset: 12, format: 'float32x2' },
          ]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
  }

  private createBindGroupForLine(uniformOffset: number): GPUBindGroup | null {
    if (!this.linePipeline || !this.lineUniformBuffer) return null;
    return this.device.createBindGroup({
      layout: this.linePipeline.getBindGroupLayout(0),
      entries: [{
        binding: 0,
        resource: { buffer: this.lineUniformBuffer, offset: uniformOffset, size: 176 }
      }]
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
          var uv = input.uv;
          let isBackground = uniforms.params0.x < 0.0;
          var outColor = vec4<f32>(0.0);

          // Full-screen paper pass only. Section textures are rendered with a
          // transparent background so paper shows through from behind.
          if (isBackground && uniforms.paperParams.w > 0.5) {
            if (uniforms.bgFlags.w > 0.5) {
              // Use a sampled background texture (shader-rendered or uploaded image).
              // params0.y is a mode flag for the background pass:
              //   1 = screen-locked (static in screen space)
              //   0 = world-locked (mapped to a world XY plane)
              if (uniforms.params0.y > 0.5) {
                outColor = textureSample(backgroundShaderTexture, textureSampler, input.uv);
              } else {
                // World-locked mapping: map the ray/plane intersection coord into a repeatable UV domain.
                let coord = paperCoordFromScreenUv(input.uv);
                let coordScaled = coord * uniforms.paperParams.x;
                let gradX = dpdx(coordScaled);
                let gradY = dpdy(coordScaled);
                var uv2 = fract(coordScaled);
                // Avoid sampling exactly at the clamp edge.
                uv2 = uv2 * 0.999 + vec2<f32>(0.0005, 0.0005);
                outColor = textureSampleGrad(backgroundShaderTexture, textureSampler, uv2, gradX, gradY);
              }
            } else {
              // Use procedural background
              let coord = paperCoordFromScreenUv(input.uv);
              outColor = sampleBackgroundAt(coord);
            }
          }

          if (!isBackground) {
            // --- Content distortion (bgFlags.y = strength 0..0.05) ---
            if (uniforms.bgFlags.y > 0.0) {
              let strength = clamp(uniforms.bgFlags.y, 0.0, 0.05);
              let tile = max(uniforms.paperParams.x, 1.0);
              let tileUv = input.uv * tile;
              let gX = dpdx(tileUv);
              let gY = dpdy(tileUv);
              var sUv = fract(tileUv) * 0.999 + vec2f(0.0005);
              let paper0 = textureSampleGrad(backgroundShaderTexture, textureSampler, sUv, gX, gY);
              let disp = (paper0.rg - vec2f(0.5)) * 2.0;
              let uvPerPx0 = vec2f(abs(dpdx(uv.x)), abs(dpdy(uv.y)));
              uv = clamp(uv + disp * (uvPerPx0 * (strength * 600.0)), vec2f(0.001), vec2f(0.999));
            }

            let texColor = textureSample(textureData, textureSampler, uv);
            outColor = texColor;

            // --- Paper blend mode (bgFlags.x = mode index, bgFlags.z = blendStrength 0..1) ---
            // bgFlags.x encodes blend mode:
            //   0 = none   1 = multiply  2 = screen    3 = overlay
            //   4 = softlight  5 = hardlight  6 = darken  7 = lighten
            //   8 = difference  9 = exclusion  10 = colorburn  11 = colordodge
            let blendMode = i32(round(uniforms.bgFlags.x));
            if (blendMode > 0) {
              let bs = clamp(uniforms.bgFlags.z, 0.0, 1.0);
              let tile2 = max(uniforms.paperParams.x, 1.0);
              let tileUv2 = input.uv * tile2;
              let gX2 = dpdx(tileUv2);
              let gY2 = dpdy(tileUv2);
              var sUv2 = fract(tileUv2) * 0.999 + vec2f(0.0005);
              let paper = textureSampleGrad(backgroundShaderTexture, textureSampler, sUv2, gX2, gY2);
              let src = outColor.rgb;
              let dst = paper.rgb;

              var blended = src;
              if (blendMode == 1) {
                // multiply: darkens where paper is dark
                blended = src * dst;
              } else if (blendMode == 2) {
                // screen: lightens — good for dark cards on light paper
                blended = 1.0 - (1.0 - src) * (1.0 - dst);
              } else if (blendMode == 3) {
                // overlay: multiply where src<0.5, screen where src>0.5
                let m = step(vec3f(0.5), src);
                blended = mix(2.0 * src * dst,
                              1.0 - 2.0 * (1.0 - src) * (1.0 - dst), m);
              } else if (blendMode == 4) {
                // soft-light
                let m2 = step(vec3f(0.5), dst);
                blended = mix(src - (1.0 - 2.0*dst)*src*(1.0-src),
                              src + (2.0*dst - 1.0) * (sqrt(src) - src), m2);
              } else if (blendMode == 5) {
                // hard-light: like overlay but src/dst swapped
                let m3 = step(vec3f(0.5), dst);
                blended = mix(2.0 * src * dst,
                              1.0 - 2.0 * (1.0 - src) * (1.0 - dst), m3);
              } else if (blendMode == 6) {
                // darken
                blended = min(src, dst);
              } else if (blendMode == 7) {
                // lighten
                blended = max(src, dst);
              } else if (blendMode == 8) {
                // difference
                blended = abs(src - dst);
              } else if (blendMode == 9) {
                // exclusion
                blended = src + dst - 2.0 * src * dst;
              } else if (blendMode == 10) {
                // color-burn: deepens shadows
                blended = clamp(1.0 - (1.0 - dst) / max(src, vec3f(0.0001)), vec3f(0.0), vec3f(1.0));
              } else if (blendMode == 11) {
                // color-dodge: brightens highlights
                blended = clamp(dst / max(1.0 - src, vec3f(0.0001)), vec3f(0.0), vec3f(1.0));
              }

              outColor = vec4f(mix(src, blended, bs), outColor.a);

              // Ink bleed (shared by all blend modes)
              let uvPerPx = vec2f(abs(dpdx(uv.x)), abs(dpdy(uv.y)));
              let uStep = uvPerPx.x * 1.5;
              let vStep = uvPerPx.y * 1.5;
              let n0 = textureSample(textureData, textureSampler, uv + vec2f( uStep, 0.0));
              let n1 = textureSample(textureData, textureSampler, uv + vec2f(-uStep, 0.0));
              let n2 = textureSample(textureData, textureSampler, uv + vec2f(0.0,  vStep));
              let n3 = textureSample(textureData, textureSampler, uv + vec2f(0.0, -vStep));
              let lumaW = vec3f(0.299, 0.587, 0.114);
              let d0 = n0.a * (1.0 - dot(n0.rgb, lumaW));
              let d1 = n1.a * (1.0 - dot(n1.rgb, lumaW));
              let d2 = n2.a * (1.0 - dot(n2.rgb, lumaW));
              let d3 = n3.a * (1.0 - dot(n3.rgb, lumaW));
              let dSelf = outColor.a * (1.0 - dot(outColor.rgb, lumaW));
              let neighborInk = max(d0, max(d1, max(d2, d3)));
              let bleedIn = clamp((neighborInk - dSelf) * 0.45, 0.0, 0.18);
              let dTotal = max(d0 + d1 + d2 + d3, 0.00001);
              let bleedRgb = (n0.rgb * d0 + n1.rgb * d1 + n2.rgb * d2 + n3.rgb * d3) / dTotal;
              outColor = vec4f(
                mix(outColor.rgb, bleedRgb, bleedIn),
                clamp(outColor.a + bleedIn * 0.6, 0.0, 1.0)
              );
            }

            outColor = vec4f(outColor.rgb, outColor.a * clamp(uniforms.paperParams.w, 0.0, 1.0));
          }

          // params0.z is full-card hover flag (1 = hovered)
          if (uniforms.params0.z > 0.5) {
            return vec4<f32>(vec3<f32>(1.0) - outColor.rgb, outColor.a);
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
    
    // Create explicit bind group layout once; reused by both the normal and
    // multiply pipelines so that bind groups are fully interchangeable.
    this.sharedBindGroupLayout = this.device.createBindGroupLayout({
      label: '3D Canvas Bind Group Layout',
      entries: [
        { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform', hasDynamicOffset: false, minBindingSize: 224 } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d', multisampled: false } },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d', multisampled: false } },
      ]
    });
    this.sharedPipelineLayout = this.device.createPipelineLayout({
      label: '3D Canvas Pipeline Layout',
      bindGroupLayouts: [this.sharedBindGroupLayout]
    });

    this.renderPipeline = this.device.createRenderPipeline({
      label: '3D Canvas Pipeline',
      layout: this.sharedPipelineLayout,
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

    // (The multiply blend is now done in-shader, so no separate multiply pipeline is needed.)
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
   * Create segmented ribbon geometry for Bezier connector rendering.
   * Each of LINE_SEGMENTS quads covers a slice of t=[0,1].
   */
  private createLineGeometryBuffers(): void {
    const N = WorldsRenderer.LINE_SEGMENTS;
    // 4 vertices per segment, each vertex: x, y, z, u, v (5 floats)
    const verts = new Float32Array(N * 4 * 5);
    const idxs  = new Uint16Array(N * 6);
    for (let i = 0; i < N; i++) {
      const t0 = i / N - 0.5;
      const t1 = (i + 1) / N - 0.5;
      const base = i * 4 * 5;
      // bottom-left
      verts[base +  0] = t0; verts[base +  1] = -0.5; verts[base +  2] = 0;
      verts[base +  3] = 0;  verts[base +  4] = 1;
      // bottom-right
      verts[base +  5] = t1; verts[base +  6] = -0.5; verts[base +  7] = 0;
      verts[base +  8] = 1;  verts[base +  9] = 1;
      // top-right
      verts[base + 10] = t1; verts[base + 11] =  0.5; verts[base + 12] = 0;
      verts[base + 13] = 1;  verts[base + 14] = 0;
      // top-left
      verts[base + 15] = t0; verts[base + 16] =  0.5; verts[base + 17] = 0;
      verts[base + 18] = 0;  verts[base + 19] = 0;
      const ib = i * 6;
      const vb = i * 4;
      idxs[ib + 0] = vb; idxs[ib + 1] = vb + 1; idxs[ib + 2] = vb + 2;
      idxs[ib + 3] = vb; idxs[ib + 4] = vb + 2; idxs[ib + 5] = vb + 3;
    }
    this.lineVertexBuffer = this.device.createBuffer({
      label: 'Line Ribbon Vertex Buffer',
      size: verts.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.lineVertexBuffer, 0, verts);
    this.lineIndexBuffer = this.device.createBuffer({
      label: 'Line Ribbon Index Buffer',
      size: idxs.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.lineIndexBuffer, 0, idxs);
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

  private getSectionArtQuadSize(
    baseW: number,
    baseH: number,
    art: WorldsSectionArtRenderState,
    image: RenderableImageSource
  ): { width: number; height: number } {
    if (art.fit === 'stretch') {
      return {
        width: Math.max(0.001, baseW * art.scale),
        height: Math.max(0.001, baseH * art.scale),
      };
    }

    const dims = this.getRenderableImageSize(image);
    const imageAspect = dims.width / Math.max(1, dims.height);
    const baseAspect = baseW / Math.max(0.001, baseH);
    const useContain = art.fit === 'contain';

    if ((imageAspect >= baseAspect && useContain) || (imageAspect < baseAspect && !useContain)) {
      const width = Math.max(0.001, baseW * art.scale);
      return { width, height: Math.max(0.001, width / imageAspect) };
    }

    const height = Math.max(0.001, baseH * art.scale);
    return { width: Math.max(0.001, height * imageAspect), height };
  }

  /**
   * Render all 3D sections
   */
  render(
    camera: Camera3D,
    layouts: Section3DLayout[],
    hoveredSectionIndex: number | null = null,
    background?: WorldsBackgroundConfig,
    connectors: Worlds3DConnector[] = [],
    sectionArt: Map<string, WorldsSectionArtRenderState> = new Map()
  ): void {
    this.setBackgroundImage(background?.image ?? null);

    if (!this.renderPipeline || !this.vertexBuffer || !this.indexBuffer || !this.renderTexture) {
      console.warn('WorldsRenderer not fully initialized');
      return;
    }

    const paperEnabled = !!background?.enabled;
    this.ensureUniformBufferCapacity(layouts.length + (paperEnabled ? 1 : 0));
    this.ensureLineUniformBufferCapacity(connectors.length);
    if (!this.uniformBuffer || !this.sampler) {
      console.warn('WorldsRenderer not fully initialized');
      return;
    }
    const uniformBuffer = this.uniformBuffer;
    
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
    const noiseStrength = paperEnabled ? (Number.isFinite(background!.noiseStrength) ? background!.noiseStrength : 0.06) : 0;
    const contentDistortStrength = paperEnabled
      ? (Number.isFinite(background!.contentDistortStrength as any)
          ? Math.max(0, Math.min(0.05, background!.contentDistortStrength as number))
          : 0)
      : 0;
    const shaderName = background?.shaderName;
    if (paperEnabled && shaderName && !this.shaderManager.hasShader(shaderName)) {
      // Kick off async load; we'll start using it on a later frame.
      this.requestBuiltinShaderLoad(shaderName);
    }

    const useShaderBackground = paperEnabled && !!shaderName && this.shaderManager.hasShader(shaderName);
    const useImageBackground = paperEnabled && !useShaderBackground && !!background?.image && !!this.backgroundImageTexture;
    const useSampledBackground = useShaderBackground || useImageBackground;
    // bgFlags layout:
    // x=hasRuledLines (background-only; also used as 'effects active' flag for multiply cards),
    // y=contentDistortStrength (cards),
    // z=noiseStrength (background-only),
    // w=useSampledBackground
    const backgroundDetailTexture = useShaderBackground
      ? this.backgroundShaderTexture
      : (useImageBackground ? this.backgroundImageTexture : this.neutralBackgroundTexture);

    // Content distortion samples binding(3). We always bind a neutral fallback
    // texture, so it's safe to keep distortion enabled even while the real
    // sectionBackground image/shader is still loading.
    const effectiveContentDistortStrength = contentDistortStrength;

    const bgFlags = paperEnabled
      ? [hasRuledLines ? 1 : 0, effectiveContentDistortStrength, noiseStrength, useSampledBackground ? 1 : 0]
      : [0, 0, 0, 0];

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
        if (useShaderBackground && shaderName && this.backgroundShaderTexture) {
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
          
          // Clear temp texture to a theme-derived paper base.
          // Many shader backgrounds are written as “overlays” (multiply/vignette)
          // that expect an existing image; feeding transparent black yields a
          // black output. Clearing to the paper color provides a stable, theme-
          // consistent base even if the shader doesn't generate its own.
          const clearEncoder = this.device.createCommandEncoder();
          const clearPass = clearEncoder.beginRenderPass({
            colorAttachments: [{
              view: tempTexture.createView(),
              clearValue: { r: paperColor[0] ?? 0, g: paperColor[1] ?? 0, b: paperColor[2] ?? 0, a: 1 },
              loadOp: 'clear',
              storeOp: 'store'
            }]
          });
          clearPass.end();
          this.device.queue.submit([clearEncoder.finish()]);
          
          // Apply shader to render background, then generate mipmaps for stable sampling.
          const shaderEncoder = this.device.createCommandEncoder();
          this.shaderManager.applyShader(tempTexture, this.backgroundShaderTexture, shaderEncoder);
          this.generateMipmaps(shaderEncoder, this.backgroundShaderTexture, this.backgroundShaderMipLevelCount);
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
        // params0.y is reserved as a background-only flag.
        const screenLockRaw = background?.screenLock ?? (background!.shaderUniforms as any)?.screenLock;
        const screenLock = typeof screenLockRaw === 'boolean'
          ? screenLockRaw
          : (Number.isFinite(screenLockRaw as any) ? (screenLockRaw as number) > 0.5 : false);
        const params0 = new Float32Array([-1, screenLock ? 1 : 0, 0, 0]);

        // Paper plane selection:
        // - If caller provides a planeZ override, use it (useful for aligning
        //   world-locked shader backgrounds to the focused card).
        // - Otherwise use the median Z of visible cards so paper appears
        //   roughly “under” the scene without baking per-card paper.
        const planeZOverride = background && Number.isFinite(background.paperPlaneZ as any)
          ? (background.paperPlaneZ as number)
          : null;
        const planeZ = planeZOverride !== null
          ? planeZOverride
          : (() => {
              const zVals = layouts
                .filter(l => l.visible && !!l.texture)
                .map(l => l.transform.position.z)
                .sort((a, b) => a - b);
              return zVals.length ? zVals[(zVals.length / 2) | 0]! : 0;
            })();

        // params1: x=aspect, y=tanHalfFov, z=planeZ, w=screenWidth (used by card content distortion)
        const params1 = new Float32Array([aspect, Math.tan(camera.fov * 0.5), planeZ, this.width]);

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

        const bindGroup = this.createBindGroupForTexture(this.backgroundTexture, uniformOffset, backgroundDetailTexture);
        if (bindGroup) {
          pass.setBindGroup(0, bindGroup);
          pass.drawIndexed(6);
        }
      }
    }

    // Blend mode index for in-shader paper toning (0=none, matches WGSL blendMode constants).
    const BLEND_MODES: Record<string, number> = {
      multiply: 1, screen: 2, overlay: 3, softlight: 4,
      hardlight: 5, darken: 6, lighten: 7, difference: 8,
      exclusion: 9, colorburn: 10, colordodge: 11,
    };
    const blendModeStr = background?.sectionBlendMode ?? 'normal';
    const blendModeIndex = BLEND_MODES[blendModeStr] ?? 0;
    const useBlend = blendModeIndex > 0;
    const contentBlendStrength = useBlend
      ? Math.max(0, Math.min(1, background?.contentBlendStrength ?? 1.0))
      : 0;

    const isCulled = (mvpMatrix: Float32Array): boolean => {
      const clip = (x: number, y: number, z: number, w: number) => ({
        x: mvpMatrix[0] * x + mvpMatrix[4] * y + mvpMatrix[8] * z + mvpMatrix[12] * w,
        y: mvpMatrix[1] * x + mvpMatrix[5] * y + mvpMatrix[9] * z + mvpMatrix[13] * w,
        z: mvpMatrix[2] * x + mvpMatrix[6] * y + mvpMatrix[10] * z + mvpMatrix[14] * w,
        w: mvpMatrix[3] * x + mvpMatrix[7] * y + mvpMatrix[11] * z + mvpMatrix[15] * w,
      });
      const corners = [
        clip(-0.5, -0.5, 0, 1),
        clip(0.5, -0.5, 0, 1),
        clip(0.5, 0.5, 0, 1),
        clip(-0.5, 0.5, 0, 1),
      ];
      const all = (pred: (p: { x: number; y: number; z: number; w: number }) => boolean) => corners.every(pred);
      return all(p => p.x < -p.w)
        || all(p => p.x > p.w)
        || all(p => p.y < -p.w)
        || all(p => p.y > p.w)
        || all(p => p.z < 0)
        || all(p => p.z > p.w);
    };

    const resolveArtPosition = (layout: Section3DLayout, offsetX: number, offsetY: number) => {
      const localMatrix = mat4FromTransform({
        position: layout.transform.position,
        rotation: layout.transform.rotation,
        scale: layout.transform.scale,
      });
      return {
        x: localMatrix[0] * offsetX + localMatrix[4] * offsetY + localMatrix[12],
        y: localMatrix[1] * offsetX + localMatrix[5] * offsetY + localMatrix[13],
        z: localMatrix[2] * offsetX + localMatrix[6] * offsetY + localMatrix[14],
      };
    };

    const drawSectionQuad = (options: {
      texture: GPUTexture;
      uniformOffset: number;
      transform: Transform3D;
      logicalWidth: number;
      logicalHeight: number;
      opacity: number;
      blendModeIndex: number;
      quadBlendStrength: number;
      contentDistort: number;
      hover: number;
      highlightRect?: { uMin: number; vMin: number; uMax: number; vMax: number };
    }): boolean => {
      const modelMatrix = mat4FromTransform(options.transform);
      const mvpMatrix = mat4Multiply(viewProjectionMatrix, modelMatrix);
      if (isCulled(mvpMatrix)) return false;

      this.device.queue.writeBuffer(
        uniformBuffer,
        options.uniformOffset + 0,
        mvpMatrix.buffer,
        mvpMatrix.byteOffset,
        mvpMatrix.byteLength
      );

      const rect = options.highlightRect;
      const highlightEnabled = rect ? 1.0 : 0.0;
      this.device.queue.writeBuffer(
        uniformBuffer,
        options.uniformOffset + 64,
        new Float32Array([options.logicalWidth, options.logicalHeight, options.hover, highlightEnabled])
      );
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 96, new Float32Array(paperColor));
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 112, new Float32Array(lineColor));
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 128, new Float32Array([
        paperEnabled ? (paperParams[0] ?? 0) : 0,
        0,
        0,
        Math.max(0, Math.min(1, options.opacity)),
      ]));
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 144, cameraPos);
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 160, cameraRight);
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 176, cameraUp);
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 192, cameraForward);
      this.device.queue.writeBuffer(uniformBuffer, options.uniformOffset + 208, new Float32Array([
        options.blendModeIndex,
        Math.max(0, Math.min(0.05, options.contentDistort)),
        Math.max(0, Math.min(1, options.quadBlendStrength)),
        useSampledBackground ? 1 : 0,
      ]));
      this.device.queue.writeBuffer(
        uniformBuffer,
        options.uniformOffset + 80,
        rect
          ? new Float32Array([rect.uMin, rect.vMin, rect.uMax, rect.vMax])
          : new Float32Array([0, 0, 0, 0])
      );

      const bindGroup = this.createBindGroupForTexture(options.texture, options.uniformOffset, backgroundDetailTexture);
      if (!bindGroup) return false;
      pass.setBindGroup(0, bindGroup);
      pass.drawIndexed(6);
      return true;
    };
    
    // Render each visible section
    let drawnCount = 0;
    for (let i = 0; i < layouts.length; i++) {
      const layout = layouts[i];
      if (!layout.visible || !layout.texture) continue;

      const baseW = (layout.worldWidth ?? layout.width);
      const baseH = (layout.worldHeight ?? layout.height);

      const uniformIndex = paperEnabled ? (i + 1) : i;
      const uniformOffset = uniformIndex * this.uniformStride;

      const art = sectionArt.get(layout.sectionId);
      if (art && art.layer === 'under') {
        const artTexture = this.ensureSectionArtTexture(art.image);
        if (artTexture) {
          const artSize = this.getSectionArtQuadSize(baseW, baseH, art, art.image);
          const artPos = resolveArtPosition(layout, art.offsetX, art.offsetY);
          drawSectionQuad({
            texture: artTexture,
            uniformOffset,
            transform: {
              position: artPos,
              rotation: layout.transform.rotation,
              scale: {
                x: layout.transform.scale.x * artSize.width,
                y: layout.transform.scale.y * artSize.height,
                z: layout.transform.scale.z,
              },
            },
            logicalWidth: artSize.width,
            logicalHeight: artSize.height,
            opacity: art.opacity,
            blendModeIndex: BLEND_MODES[art.blendMode] ?? 0,
            quadBlendStrength: 1,
            contentDistort: 0,
            hover: 0,
          });
        }
      }

      const hover = hoveredSectionIndex !== null && layout.sectionIndex === hoveredSectionIndex ? 1.0 : 0.0;
      const rect = layout.highlightUvRect;
      const drewCard = drawSectionQuad({
        texture: layout.texture,
        uniformOffset,
        transform: {
          position: layout.transform.position,
          rotation: layout.transform.rotation,
          scale: {
            x: layout.transform.scale.x * baseW,
            y: layout.transform.scale.y * baseH,
            z: layout.transform.scale.z,
          },
        },
        logicalWidth: baseW,
        logicalHeight: baseH,
        opacity: layout.opacity,
        blendModeIndex,
        quadBlendStrength: contentBlendStrength,
        contentDistort: contentDistortStrength,
        hover,
        highlightRect: rect,
      });
      if (!drewCard) continue;
      drawnCount++;

      if (art && art.layer === 'over') {
        const artTexture = this.ensureSectionArtTexture(art.image);
        if (artTexture) {
          const artSize = this.getSectionArtQuadSize(baseW, baseH, art, art.image);
          const artPos = resolveArtPosition(layout, art.offsetX, art.offsetY);
          drawSectionQuad({
            texture: artTexture,
            uniformOffset,
            transform: {
              position: artPos,
              rotation: layout.transform.rotation,
              scale: {
                x: layout.transform.scale.x * artSize.width,
                y: layout.transform.scale.y * artSize.height,
                z: layout.transform.scale.z,
              },
            },
            logicalWidth: artSize.width,
            logicalHeight: artSize.height,
            opacity: art.opacity,
            blendModeIndex: BLEND_MODES[art.blendMode] ?? 0,
            quadBlendStrength: 1,
            contentDistort: 0,
            hover: 0,
          });
        }
      }
    }

    if (connectors.length > 0 && this.linePipeline && this.lineUniformBuffer && this.lineVertexBuffer && this.lineIndexBuffer) {
      pass.setPipeline(this.linePipeline);
      pass.setVertexBuffer(0, this.lineVertexBuffer);
      pass.setIndexBuffer(this.lineIndexBuffer, 'uint16');

      for (let i = 0; i < connectors.length; i++) {
        const connector = connectors[i];
        const uniformOffset = i * this.lineUniformStride;
        const color = ColorUtils.rgbaNorm(connector.color);
        const lineColor = new Float32Array([
          color[0] ?? 1,
          color[1] ?? 1,
          color[2] ?? 1,
          (color[3] ?? 1) * (Number.isFinite(connector.opacity) ? connector.opacity : 1),
        ]);

        const control = connector.control
          ? connector.control
          : {
              x: (connector.start.x + connector.end.x) * 0.5,
              y: (connector.start.y + connector.end.y) * 0.5,
              z: (connector.start.z + connector.end.z) * 0.5,
            };

        this.device.queue.writeBuffer(
          this.lineUniformBuffer,
          uniformOffset + 0,
          viewProjectionMatrix.buffer,
          viewProjectionMatrix.byteOffset,
          viewProjectionMatrix.byteLength,
        );
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 64, new Float32Array([connector.start.x, connector.start.y, connector.start.z, 1]));
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 80, new Float32Array([connector.end.x, connector.end.y, connector.end.z, 1]));
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 96, new Float32Array([control.x, control.y, control.z, 1]));
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 112, lineColor);
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 128, cameraForward);
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 144, cameraRight);
        this.device.queue.writeBuffer(this.lineUniformBuffer, uniformOffset + 160, new Float32Array([
          Number.isFinite(connector.thickness) ? connector.thickness : 1,
          0,
          0,
          0,
        ]));

        const bindGroup = this.createBindGroupForLine(uniformOffset);
        if (!bindGroup) continue;
        pass.setBindGroup(0, bindGroup);
        pass.drawIndexed(WorldsRenderer.LINE_SEGMENTS * 6);
      }
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
  private createBindGroupForTexture(
    texture: GPUTexture,
    uniformOffset: number,
    backgroundDetailTexture?: GPUTexture | null
  ): GPUBindGroup | null {
    if (!this.sharedBindGroupLayout || !this.uniformBuffer || !this.sampler) return null;

    const sampledBackgroundTexture = backgroundDetailTexture ?? this.backgroundShaderTexture ?? this.backgroundImageTexture ?? this.backgroundTexture;
    if (!sampledBackgroundTexture) return null;
    
    return this.device.createBindGroup({
      layout: this.sharedBindGroupLayout,
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
          resource: sampledBackgroundTexture.createView()
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
    this.backgroundShaderMipLevelCount = this.calcMipLevelCount(this.width, this.height, 9);
    this.backgroundShaderTexture = this.device.createTexture({
      size: { width: this.width, height: this.height },
      mipLevelCount: this.backgroundShaderMipLevelCount,
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
    this.backgroundImageTexture?.destroy();
    for (const texture of this.sectionArtTextureCache.values()) {
      texture.destroy();
    }
    this.sectionArtTextureCache.clear();
    this.neutralBackgroundTexture?.destroy();
  }
}
