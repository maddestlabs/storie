/**
 * Shader Manager - Compile and apply WGSL shaders
 * 
 * Manages shader pipelines, uniform buffers, and render passes
 * for post-processing effects on GPU textures.
 */

import type { WGSLShader } from './types.js';
import { parseWGSLShader } from './wgsl-parser.js';

function resolveBuiltinShaderBaseUrl(baseUrl?: string): string {
  const raw = String(baseUrl ?? '').trim();
  const u = raw
    ? new URL(/* @vite-ignore */ raw, import.meta.url)
    : new URL(/* @vite-ignore */ './shaders/', import.meta.url);
  const s = u.toString();
  return s.endsWith('/') ? s : `${s}/`;
}

interface CompiledShader {
  metadata: WGSLShader;
  module: GPUShaderModule;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  uniformLayout: Map<string, { offset: number; size: number }>;
  uniformValues: Map<string, number | number[]>;
  bindGroupLayout: GPUBindGroupLayout;
  /** True when the WGSL code declares a materialTexture binding. */
  usesMaterialTexture: boolean;
}

interface ShaderRenderResources {
  vertexBuffer: GPUBuffer;
  sampler: GPUSampler;
}

const DEFAULT_VERTEX_WGSL = `
struct DefaultVertexIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};

struct DefaultVertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex
fn vertexMain(input: DefaultVertexIn) -> DefaultVertexOut {
  var out: DefaultVertexOut;
  out.position = vec4f(input.pos, 0.0, 1.0);
  out.uv = input.uv;
  return out;
}
`;

/**
 * ShaderManager - Compile and apply WGSL shaders to textures
 */
export class ShaderManager {
  private device: GPUDevice;
  private format: GPUTextureFormat;
  
  // Compiled shaders
  private shaders: Map<string, CompiledShader> = new Map();
  
  // Shared resources
  private resources: ShaderRenderResources | null = null;
  
  // Active shader
  private activeShader: string | null = null;

  // WGSL include cache (URL -> resolved text)
  private includeCache: Map<string, string> = new Map();

  // Built-in shader load de-duplication
  private builtinShaderLoads: Map<string, Promise<boolean>> = new Map();
  
  private initialized: boolean = false;

  // Support pairing `wgsl vertex:name` + `wgsl fragment:name`
  private pendingVertexShaders: Map<string, WGSLShader> = new Map();

  // 1×1 rgba8unorm fallback used when a shader declares materialTexture but none is available.
  private defaultMaterialTexture: GPUTexture | null = null;

  constructor(device: GPUDevice, format?: GPUTextureFormat) {
    this.device = device;
    this.format = format || navigator.gpu.getPreferredCanvasFormat();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[ShaderManager] Initializing...');
    
    // Create fullscreen quad vertex buffer
    const vertices = new Float32Array([
      // Position (x, y)    UV (u, v)
      -1.0,  1.0,          0.0, 0.0,  // Top-left
       1.0,  1.0,          1.0, 0.0,  // Top-right
      -1.0, -1.0,          0.0, 1.0,  // Bottom-left
       1.0, -1.0,          1.0, 1.0,  // Bottom-right
    ]);
    
    const vertexBuffer = this.device.createBuffer({
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(vertices);
    vertexBuffer.unmap();
    
    // Create shared sampler.
    // Use nearest to preserve terminal glyph crispness and avoid double-filtering
    // when the compositor already samples layers.
    const sampler = this.device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
    
    this.resources = { vertexBuffer, sampler };

    // Create a 1×1 default material texture (roughness=0.5, normalScale=1.0, metallic=0, emissive=0).
    // Used as a fallback when a shader declares materialTexture but none has been provided.
    this.defaultMaterialTexture = this.device.createTexture({
      size: { width: 1, height: 1 },
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: 'defaultMaterialTexture'
    });
    this.device.queue.writeTexture(
      { texture: this.defaultMaterialTexture },
      new Uint8Array([128, 255, 0, 0]),  // roughness≈0.5, normalScale≈1.0, metallic=0, emissive=0
      { bytesPerRow: 4 },
      { width: 1, height: 1 }
    );

    this.initialized = true;
    
    console.log('[ShaderManager] Initialized');
  }

  /**
   * Load a built-in shader from `./shaders/{name}.wgsl.js` (same format as ShaderChainManager).
   * This is best-effort and primarily intended for Worlds background shaders.
   */
  async ensureBuiltinShader(name: string, baseUrl: string = resolveBuiltinShaderBaseUrl()): Promise<boolean> {
    const shaderName = String(name ?? '').trim();
    if (!shaderName) return false;
    if (this.hasShader(shaderName)) return true;

    const existing = this.builtinShaderLoads.get(shaderName);
    if (existing) return await existing;

    const loadPromise = (async (): Promise<boolean> => {
      try {
        if (!this.initialized) await this.init();

        const base = resolveBuiltinShaderBaseUrl(baseUrl);
        const shaderPath = new URL(`${shaderName}.wgsl.js`, base).toString();
        console.log(`[ShaderManager] Loading built-in shader: ${shaderPath}`);

        const response = await fetch(shaderPath);
        if (!response.ok) {
          throw new Error(`Failed to fetch shader: ${response.status} ${response.statusText}`);
        }

        const shaderCode = await response.text();

        if (!/\bgetShaderConfig\b/.test(shaderCode)) {
          const preview = shaderCode.slice(0, 200).replace(/\s+/g, ' ');
          throw new Error(`Fetched content does not look like a shader module (missing getShaderConfig). Preview: ${preview}`);
        }

        // Shader file defines: function getShaderConfig() { ... }
        const evalFunc = new Function(shaderCode + '\nreturn getShaderConfig();');
        const config = evalFunc();

        if (!config || !config.vertexShader || !config.fragmentShader) {
          throw new Error('Shader config must include vertexShader and fragmentShader');
        }

        const combinedCodeRaw = String(config.vertexShader) + '\n' + String(config.fragmentShader);
        const combinedCode = await this.resolveWgslIncludes(combinedCodeRaw, base);

        const uniforms: string[] = config.uniforms ? Object.keys(config.uniforms) : [];
        const wgslShader: WGSLShader = {
          name: shaderName,
          code: combinedCode,
          kind: 'fragment',
          uniforms,
          bindings: [],
          workgroupSize: [1, 1, 1]
        };

        const ok = await this.registerShader(wgslShader);
        if (!ok) return false;

        if (config.uniforms) {
          for (const [uniformName, defaultValue] of Object.entries(config.uniforms)) {
            try {
              this.setUniform(shaderName, uniformName, defaultValue as number | number[]);
            } catch {
              // ignore
            }
          }
        }

        console.log(`[ShaderManager] ✓ Loaded built-in shader: ${shaderName}`);
        return true;
      } catch (error) {
        console.warn(`[ShaderManager] Failed to load built-in shader "${shaderName}":`, error);
        return false;
      }
    })();

    this.builtinShaderLoads.set(shaderName, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.builtinShaderLoads.delete(shaderName);
    }
  }

  /**
   * Register and compile a WGSL shader from parsed metadata
   */
  async registerShader(shader: WGSLShader): Promise<boolean> {
    if (!this.initialized) await this.init();
    
    try {
      console.log(`[ShaderManager] Compiling shader: ${shader.name} (${shader.kind})`);
      
      // Support vertex shaders only as a paired stage for a fragment shader.
      if (shader.kind === 'vertex') {
        this.pendingVertexShaders.set(shader.name, shader);
        console.log(`[ShaderManager] Stored pending vertex shader: ${shader.name}`);
        return true;
      }

      // Only render pipelines (fragment) are supported here.
      if (shader.kind !== 'fragment') {
        console.warn(`[ShaderManager] Only fragment render shaders supported, got: ${shader.kind}`);
        return false;
      }

      // If we have a pending vertex stage for this name, merge it.
      const pendingVertex = this.pendingVertexShaders.get(shader.name);
      const mergedCodeRaw = this.buildRenderModuleCode(shader.code, pendingVertex?.code);
      // Allow user-authored WGSL blocks to reuse built-in WGSL snippets.
      // Includes resolve relative to the built-in shader root: ./shaders/
      const mergedCode = await this.resolveWgslIncludes(mergedCodeRaw, resolveBuiltinShaderBaseUrl());
      const mergedShader = parseWGSLShader(shader.name, mergedCode);
      mergedShader.kind = 'fragment';
      
      // Create shader module
      const module = this.device.createShaderModule({
        code: mergedShader.code,
        label: shader.name
      });

      // Surface shader compilation diagnostics early.
      // Without this, a WGSL error can manifest as “no effect” with only a
      // console warning from WebGPU validation.
      try {
        const info = await module.getCompilationInfo();
        const errors = info.messages.filter(m => m.type === 'error');
        if (errors.length > 0) {
          console.error(`[ShaderManager] WGSL compile errors in ${shader.name}:`);
          for (const m of errors) {
            console.error(`  - ${m.lineNum}:${m.linePos} ${m.message}`);
          }
          throw new Error(`WGSL compile failed for ${shader.name}`);
        }
      } catch (e) {
        // Some environments may not support compilation info; fall back.
        // If this throws due to actual WGSL errors, we'll also fail pipeline
        // creation below.
      }
      
      // Calculate uniform buffer layout
      const uniformLayout = this.calculateUniformLayout(mergedShader);
      const uniformBufferSize = this.calculateUniformBufferSize(uniformLayout);
      
      // Create uniform buffer
      const uniformBuffer = this.device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: `${shader.name}_uniforms`
      });
      
      // Detect whether the WGSL code declares a materialTexture binding.
      // Shaders that opt-in get a 4-entry bind group layout:
      //   0=contentTexture, 1=sampler, 2=materialTexture, 3=uniforms
      // All other shaders keep the existing 3-entry layout (0=texture, 1=sampler, 2=uniforms).
      const usesMaterialTexture = /\bmaterialTexture\b/.test(mergedCode);

      // Create bind group layout
      const bindGroupLayout = usesMaterialTexture
        ? this.device.createBindGroupLayout({
            label: `${shader.name}_bindGroupLayout`,
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
              },
              {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
              },
              {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
              },
              {
                binding: 3,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
              }
            ]
          })
        : this.device.createBindGroupLayout({
            label: `${shader.name}_bindGroupLayout`,
            entries: [
              {
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { sampleType: 'float' }
              },
              {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
              },
              {
                binding: 2,
                // Allow vertex shaders to use time/resolution/custom uniforms too.
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
              }
            ]
          });
      
      // Create pipeline layout
      const pipelineLayout = this.device.createPipelineLayout({
        label: `${shader.name}_pipelineLayout`,
        bindGroupLayouts: [bindGroupLayout]
      });
      
      // Create render pipeline
      const pipeline = this.device.createRenderPipeline({
        label: `${shader.name}_pipeline`,
        layout: pipelineLayout,
        vertex: {
          module,
          entryPoint: 'vertexMain',
          buffers: [{
            arrayStride: 16, // 4 floats * 4 bytes
            attributes: [
              { shaderLocation: 0, offset: 0, format: 'float32x2' },  // position
              { shaderLocation: 1, offset: 8, format: 'float32x2' }   // uv
            ]
          }]
        },
        fragment: {
          module,
          entryPoint: 'fragmentMain',
          targets: [{
            format: this.format
          }]
        },
        primitive: {
          topology: 'triangle-strip',
          stripIndexFormat: undefined
        }
      });
      
      // Store compiled shader
      const compiled: CompiledShader = {
        metadata: mergedShader,
        module,
        pipeline,
        uniformBuffer,
        uniformLayout,
        uniformValues: new Map(),
        bindGroupLayout,
        usesMaterialTexture
      };
      
      // Initialize default uniform values
      for (const uniformName of mergedShader.uniforms) {
        compiled.uniformValues.set(uniformName, 0);
      }
      
      this.shaders.set(shader.name, compiled);
      
      console.log(`[ShaderManager] ✓ Shader compiled: ${shader.name}`);
      console.log(`[ShaderManager]   Uniforms: ${mergedShader.uniforms.join(', ') || 'none'}`);

      // Clear pending vertex shader once consumed.
      if (pendingVertex) {
        this.pendingVertexShaders.delete(shader.name);
      }
      
      return true;
      
    } catch (error) {
      console.error(`[ShaderManager] Failed to compile shader ${shader.name}:`, error);
      return false;
    }
  }

  private async resolveWgslIncludes(code: string, baseUrl: string): Promise<string> {
    // WGSL `#include` preprocessor.
    // Supports: #include "relative/path.wgsl"
    // Resolves relative to `baseUrl` (typically "./shaders/")
    // Recursively resolves nested includes and detects cycles.
    const includeRe = /^\s*#include\s+"([^"]+)"\s*$/gm;

    const resolveOne = async (src: string, seen: Set<string>): Promise<string> => {
      const matches = Array.from(src.matchAll(includeRe));
      if (matches.length === 0) return src;

      let out = '';
      let lastIndex = 0;
      for (const m of matches) {
        const fullMatch = m[0];
        const includePath = m[1];
        const index = m.index ?? 0;

        out += src.slice(lastIndex, index);
        lastIndex = index + fullMatch.length;

        // Security/sanity: only allow relative includes within the origin.
        if (includePath.startsWith('/') || includePath.includes('://')) {
          throw new Error(`[ShaderManager] Unsupported #include path: ${includePath}`);
        }

        const base = resolveBuiltinShaderBaseUrl(baseUrl);
        const url = new URL(includePath, base).toString();
        if (seen.has(url)) {
          throw new Error(`[ShaderManager] #include cycle detected: ${url}`);
        }

        let text = this.includeCache.get(url);
        if (text === undefined) {
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(`[ShaderManager] Failed to fetch #include: ${url} (${resp.status} ${resp.statusText})`);
          }
          text = await resp.text();
          this.includeCache.set(url, text);
        }

        const nestedSeen = new Set(seen);
        nestedSeen.add(url);
        const resolved = await resolveOne(text, nestedSeen);
        out += `\n// begin include: ${includePath}\n${resolved}\n// end include: ${includePath}\n`;
      }

      out += src.slice(lastIndex);
      // There could be includes introduced by substitutions.
      return resolveOne(out, seen);
    };

    return resolveOne(code, new Set());
  }

  /**
   * Register a set of WGSL shaders in one pass.
   * This enables pairing `wgsl vertex:name` + `wgsl fragment:name` within a document.
   */
  async registerShaders(shaders: WGSLShader[]): Promise<void> {
    if (!Array.isArray(shaders) || shaders.length === 0) return;

    // First, store any vertex shaders so fragment compilation can consume them.
    for (const s of shaders) {
      if (s?.kind === 'vertex') {
        await this.registerShader(s);
      }
    }

    // Then, compile fragments.
    for (const s of shaders) {
      if (s?.kind === 'fragment') {
        await this.registerShader(s);
      }
    }

    // Finally, attempt to register anything else (compute etc) for future expansion.
    for (const s of shaders) {
      if (!s) continue;
      if (s.kind !== 'vertex' && s.kind !== 'fragment') {
        await this.registerShader(s);
      }
    }
  }

  private buildRenderModuleCode(fragmentCode: string, vertexCode?: string): string {
    const frag = String(fragmentCode ?? '');
    const vert = String(vertexCode ?? '');

    const hasFragment = this.hasFragmentMain(frag) || this.hasFragmentMain(vert);
    if (!hasFragment) {
      // Let WebGPU validation surface the actual issue too, but give a clearer log.
      console.warn('[ShaderManager] WGSL shader is missing fragmentMain(); cannot compile render pipeline');
    }

    // If fragment already includes a vertex stage, prefer it.
    if (this.hasVertexMain(frag)) {
      return frag;
    }

    // If a separate vertex stage exists, concatenate.
    if (this.hasVertexMain(vert)) {
      return `${vert}\n\n${frag}`;
    }

    // Fragment-only shaders: inject a default passthrough vertex shader.
    return `${DEFAULT_VERTEX_WGSL}\n\n${frag}`;
  }

  private hasVertexMain(code: string): boolean {
    const src = String(code ?? '');
    return src.includes('@vertex') && /fn\s+vertexMain\s*\(/.test(src);
  }

  private hasFragmentMain(code: string): boolean {
    const src = String(code ?? '');
    return src.includes('@fragment') && /fn\s+fragmentMain\s*\(/.test(src);
  }

  /**
   * Set a uniform value for a shader
   */
  setUniform(shaderName: string, uniformName: string, value: number | number[]): boolean {
    const shader = this.shaders.get(shaderName);
    if (!shader) {
      console.warn(`[ShaderManager] Shader not found: ${shaderName}`);
      return false;
    }
    
    if (!shader.metadata.uniforms.includes(uniformName)) {
      console.warn(`[ShaderManager] Uniform not found: ${uniformName} in shader ${shaderName}`);
      return false;
    }
    
    shader.uniformValues.set(uniformName, value);
    return true;
  }

  /**
   * Check whether a shader declares a uniform (without logging warnings).
   */
  hasUniform(shaderName: string, uniformName: string): boolean {
    const shader = this.shaders.get(shaderName);
    if (!shader) return false;
    return shader.metadata.uniforms.includes(uniformName);
  }

  /**
   * Get current uniform value
   */
  getUniform(shaderName: string, uniformName: string): number | number[] | undefined {
    const shader = this.shaders.get(shaderName);
    if (!shader) return undefined;
    return shader.uniformValues.get(uniformName);
  }

  /**
   * Set the active shader for rendering
   */
  setActiveShader(shaderName: string | null): boolean {
    if (shaderName === null) {
      this.activeShader = null;
      return true;
    }
    
    if (!this.shaders.has(shaderName)) {
      console.warn(`[ShaderManager] Cannot activate unknown shader: ${shaderName}`);
      return false;
    }
    
    this.activeShader = shaderName;
    return true;
  }

  /**
   * Get the currently active shader name
   */
  getActiveShader(): string | null {
    return this.activeShader;
  }

  /**
   * Apply the active shader to a texture and render to output.
   *
   * @param materialTexture  Optional per-pixel material data from WebGPUUIRenderer.
   *   Bound at slot 2 for shaders that declare `materialTexture` (uniforms shift to slot 3).
   *   Shaders that do not declare `materialTexture` use the classic 3-entry layout and this
   *   parameter is silently ignored.
   */
  applyShader(
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
    commandEncoder: GPUCommandEncoder,
    materialTexture?: GPUTexture
  ): boolean {
    if (!this.activeShader) return false;
    
    const shader = this.shaders.get(this.activeShader);
    if (!shader || !this.resources) return false;
    
    // Update uniform buffer with current values
    this.updateUniformBuffer(shader, outputTexture.width, outputTexture.height);

    // Create bind group — layout depends on whether the shader uses materialTexture.
    let bindGroup: GPUBindGroup;
    if (shader.usesMaterialTexture) {
      const matTex = materialTexture ?? this.defaultMaterialTexture;
      bindGroup = this.device.createBindGroup({
        layout: shader.bindGroupLayout,
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: this.resources.sampler },
          { binding: 2, resource: matTex
              ? matTex.createView()
              : (this.defaultMaterialTexture?.createView() ?? inputTexture.createView()) },
          { binding: 3, resource: { buffer: shader.uniformBuffer } }
        ]
      });
    } else {
      bindGroup = this.device.createBindGroup({
        layout: shader.bindGroupLayout,
        entries: [
          { binding: 0, resource: inputTexture.createView() },
          { binding: 1, resource: this.resources.sampler },
          { binding: 2, resource: { buffer: shader.uniformBuffer } }
        ]
      });
    }
    
    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        // If the output texture has mipmaps, the default view can include
        // multiple levels, which is not valid as a render attachment.
        view: outputTexture.createView({ baseMipLevel: 0, mipLevelCount: 1 }),
        clearValue: { r: 0, g: 0, b: 0, a: 1 },
        loadOp: 'clear',
        storeOp: 'store'
      }]
    });
    
    renderPass.setPipeline(shader.pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.setVertexBuffer(0, this.resources.vertexBuffer);
    renderPass.draw(4, 1, 0, 0);
    renderPass.end();
    
    return true;
  }

  /**
   * Calculate uniform buffer layout with proper alignment
   */
  private calculateUniformLayout(shader: WGSLShader): Map<string, { offset: number; size: number }> {
    // Prefer parsing the actual WGSL uniform struct from shader code.
    // This is required for built-in shaders like `ruledlines` that use vec2/vec3
    // and explicit padding fields, where a naive scalar packer produces buffers
    // that are too small and cause WebGPU validation errors.
    const parsed = this.tryParseUniformStructLayout(shader.code);
    if (parsed) {
      return parsed.layout;
    }

    // Fallback: minimal scalar-only layout.
    const layout = new Map<string, { offset: number; size: number }>();
    let offset = 0;

    layout.set('time', { offset, size: 4 });
    offset += 4;

    offset = this.roundUp(offset, 8);
    layout.set('resolution', { offset, size: 8 });
    offset += 8;

    for (const uniformName of shader.uniforms) {
      offset = this.roundUp(offset, 4);
      layout.set(uniformName, { offset, size: 4 });
      offset += 4;
    }

    return layout;
  }

  private roundUp(value: number, alignment: number): number {
    const a = Math.max(1, alignment | 0);
    return Math.ceil(value / a) * a;
  }

  private tryParseUniformStructLayout(code: string): { layout: Map<string, { offset: number; size: number }>; size: number } | null {
    // Find the struct name used for the `uniforms` binding.
    // Example: @group(0) @binding(2) var<uniform> uniforms: Uniforms;
    const uniformDecl = code.match(/var\s*<\s*uniform\s*>\s+uniforms\s*:\s*([A-Za-z_][A-Za-z0-9_]*)/);
    const structName = uniformDecl?.[1] ?? null;
    if (!structName) return null;

    const structMatch = this.extractWGSLStructBody(code, structName);
    if (!structMatch) return null;

    const { fields } = structMatch;
    if (fields.length === 0) return null;

    const layout = new Map<string, { offset: number; size: number }>();
    let offset = 0;
    let structAlign = 1;

    for (const field of fields) {
      const typeLayout = this.getWGSLTypeLayout(field.type);
      const align = typeLayout.align;
      const size = typeLayout.size;
      structAlign = Math.max(structAlign, align);
      offset = this.roundUp(offset, align);
      layout.set(field.name, { offset, size });
      offset += size;
    }

    const structSize = this.roundUp(offset, Math.max(16, structAlign));
    return { layout, size: structSize };
  }

  private extractWGSLStructBody(code: string, structName: string): { fields: Array<{ name: string; type: string }> } | null {
    // Extract `struct <name> { ... }` body. Keep it simple; shaders in this repo
    // tend to have one uniform struct and explicit padding fields.
    const re = new RegExp(`struct\\s+${structName}\\s*\\{([\\s\\S]*?)\\}`, 'm');
    const m = code.match(re);
    if (!m) return null;

    const body = m[1] ?? '';
    const fields: Array<{ name: string; type: string }> = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.replace(/\/\/.*$/, '').trim();
      if (!line) continue;
      // Field format: name: type,
      const fm = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^,]+)\s*,?\s*$/);
      if (!fm) continue;
      fields.push({ name: fm[1], type: fm[2].trim() });
    }

    return { fields };
  }

  private getWGSLTypeLayout(type: string): { align: number; size: number } {
    const t = type.replace(/\s+/g, '');

    // Scalars
    if (t === 'f32' || t === 'i32' || t === 'u32' || t === 'bool') {
      return { align: 4, size: 4 };
    }

    // vecNf shorthand (vec2f/vec3f/vec4f)
    const vecf = t.match(/^vec([234])f$/);
    if (vecf) {
      const n = parseInt(vecf[1], 10);
      if (n === 2) return { align: 8, size: 8 };
      // Uniform buffers are effectively std140-like for practical purposes.
      // Treat vec3 as occupying a full 16-byte slot so offsets/size match what
      // WebGPU validation expects when determining minBindingSize.
      if (n === 3) return { align: 16, size: 16 };
      return { align: 16, size: 16 };
    }

    // vecN<T>
    const vec = t.match(/^vec([234])<([A-Za-z0-9_]+)>$/);
    if (vec) {
      const n = parseInt(vec[1], 10);
      // Element assumed scalar 4 bytes for our needs.
      if (n === 2) return { align: 8, size: 8 };
      if (n === 3) return { align: 16, size: 16 };
      return { align: 16, size: 16 };
    }

    // array<T, N> (conservative std140-like packing: 16-byte stride)
    const arr = t.match(/^array<(.+),(\d+)>$/);
    if (arr) {
      const elemType = arr[1];
      const count = parseInt(arr[2], 10);
      const elem = this.getWGSLTypeLayout(elemType);
      const stride = this.roundUp(elem.size, 16);
      return { align: Math.max(16, elem.align), size: Math.max(0, count) * stride };
    }

    // Fallback for unknown host-shareable types: assume 16-byte slot.
    return { align: 16, size: 16 };
  }

  /**
   * Calculate total uniform buffer size
   */
  private calculateUniformBufferSize(layout: Map<string, { offset: number; size: number }>): number {
    let maxOffset = 0;
    let maxSize = 0;
    
    for (const [, value] of layout) {
      if (value.offset + value.size > maxOffset + maxSize) {
        maxOffset = value.offset;
        maxSize = value.size;
      }
    }
    
    const totalSize = maxOffset + maxSize;
    
    // Round up to nearest 16 bytes
    return Math.ceil(totalSize / 16) * 16;
  }

  /**
   * Update uniform buffer with current values
   */
  private updateUniformBuffer(shader: CompiledShader, outputWidth: number, outputHeight: number): void {
    const bufferData = new Float32Array(shader.uniformBuffer.size / 4);
    
    // Built-in uniforms
    const timeLayout = shader.uniformLayout.get('time');
    if (timeLayout) {
      bufferData[timeLayout.offset / 4] = performance.now() / 1000;
    }
    
    const resolutionLayout = shader.uniformLayout.get('resolution');
    if (resolutionLayout) {
      bufferData[resolutionLayout.offset / 4] = outputWidth;
      bufferData[resolutionLayout.offset / 4 + 1] = outputHeight;
    }
    
    // Custom uniforms
    for (const [uniformName, value] of shader.uniformValues) {
      const layout = shader.uniformLayout.get(uniformName);
      if (!layout) continue;
      
      if (typeof value === 'number') {
        bufferData[layout.offset / 4] = value;
      } else if (Array.isArray(value)) {
        const maxFloats = Math.max(0, Math.floor(layout.size / 4));
        const n = Math.min(value.length, maxFloats);
        for (let i = 0; i < n; i++) {
          bufferData[layout.offset / 4 + i] = value[i];
        }
      }
    }
    
    this.device.queue.writeBuffer(shader.uniformBuffer, 0, bufferData);
  }

  /**
   * Get list of registered shader names
   */
  getShaderNames(): string[] {
    return Array.from(this.shaders.keys());
  }

  /**
   * Alias for getShaderNames() - for API consistency
   */
  getRegisteredShaders(): string[] {
    return this.getShaderNames();
  }

  /**
   * Check if a shader is registered
   */
  hasShader(name: string): boolean {
    return this.shaders.has(name);
  }

  /**
   * Get shader metadata
   */
  getShaderMetadata(name: string): WGSLShader | undefined {
    return this.shaders.get(name)?.metadata;
  }

  /**
   * Alias for getShaderMetadata() - for API consistency
   */
  getShaderInfo(name: string): WGSLShader | undefined {
    return this.getShaderMetadata(name);
  }

  /**
   * Get the currently active shader name
   */
  getActiveShaderName(): string | null {
    return this.activeShader;
  }
}
