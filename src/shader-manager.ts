/**
 * Shader Manager - Compile and apply WGSL shaders
 * 
 * Manages shader pipelines, uniform buffers, and render passes
 * for post-processing effects on GPU textures.
 */

import type { WGSLShader } from './types.js';

interface CompiledShader {
  metadata: WGSLShader;
  module: GPUShaderModule;
  pipeline: GPURenderPipeline;
  uniformBuffer: GPUBuffer;
  uniformLayout: Map<string, { offset: number; size: number }>;
  uniformValues: Map<string, number | number[]>;
  bindGroupLayout: GPUBindGroupLayout;
}

interface ShaderRenderResources {
  vertexBuffer: GPUBuffer;
  sampler: GPUSampler;
}

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
  
  private initialized: boolean = false;

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
    this.initialized = true;
    
    console.log('[ShaderManager] Initialized');
  }

  /**
   * Register and compile a WGSL shader from parsed metadata
   */
  async registerShader(shader: WGSLShader): Promise<boolean> {
    if (!this.initialized) await this.init();
    
    try {
      console.log(`[ShaderManager] Compiling shader: ${shader.name} (${shader.kind})`);
      
      // Only support fragment shaders for now
      if (shader.kind !== 'fragment') {
        console.warn(`[ShaderManager] Only fragment shaders supported, got: ${shader.kind}`);
        return false;
      }
      
      // Create shader module
      const module = this.device.createShaderModule({
        code: shader.code,
        label: shader.name
      });
      
      // Calculate uniform buffer layout
      const uniformLayout = this.calculateUniformLayout(shader);
      const uniformBufferSize = this.calculateUniformBufferSize(uniformLayout);
      
      // Create uniform buffer
      const uniformBuffer = this.device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        label: `${shader.name}_uniforms`
      });
      
      // Create bind group layout
      const bindGroupLayout = this.device.createBindGroupLayout({
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
        metadata: shader,
        module,
        pipeline,
        uniformBuffer,
        uniformLayout,
        uniformValues: new Map(),
        bindGroupLayout
      };
      
      // Initialize default uniform values
      for (const uniformName of shader.uniforms) {
        compiled.uniformValues.set(uniformName, 0);
      }
      
      this.shaders.set(shader.name, compiled);
      
      console.log(`[ShaderManager] ✓ Shader compiled: ${shader.name}`);
      console.log(`[ShaderManager]   Uniforms: ${shader.uniforms.join(', ') || 'none'}`);
      
      return true;
      
    } catch (error) {
      console.error(`[ShaderManager] Failed to compile shader ${shader.name}:`, error);
      return false;
    }
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
   * Apply the active shader to a texture and render to output
   */
  applyShader(
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
    commandEncoder: GPUCommandEncoder
  ): boolean {
    if (!this.activeShader) return false;
    
    const shader = this.shaders.get(this.activeShader);
    if (!shader || !this.resources) return false;
    
    // Update uniform buffer with current values
    this.updateUniformBuffer(shader, outputTexture.width, outputTexture.height);
    
    // Create bind group
    const bindGroup = this.device.createBindGroup({
      layout: shader.bindGroupLayout,
      entries: [
        { binding: 0, resource: inputTexture.createView() },
        { binding: 1, resource: this.resources.sampler },
        { binding: 2, resource: { buffer: shader.uniformBuffer } }
      ]
    });
    
    // Render pass
    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [{
        view: outputTexture.createView(),
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
      if (n === 3) return { align: 16, size: 16 }; // treat as 16-byte slot
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
