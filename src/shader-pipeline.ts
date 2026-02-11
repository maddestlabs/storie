/**
 * Shader Pipeline - Chain WGSL shaders for post-processing effects
 * 
 * Inspired by the original tstorie shader chain system.
 * Allows composing primitive effects into complex visual pipelines.
 */

export interface ShaderConfig {
  vertexShader: string;
  fragmentShader: string;
  uniforms?: Record<string, number | number[]>;
  coordinateTransform?: string;
}

export interface ShaderEffect {
  name: string;
  config: ShaderConfig;
  uniforms: Record<string, number | number[]>;
}

export interface PipelineStage {
  effect: ShaderEffect;
  pipeline: GPURenderPipeline;
  bindGroup: GPUBindGroup | null;
  uniformBuffer: GPUBuffer;
  inputTexture: GPUTexture | null;
  outputTexture: GPUTexture;
  outputTextureView: GPUTextureView;
}

/**
 * ShaderPipeline - Manages a chain of WGSL post-processing shaders
 */
export class ShaderPipeline {
  private device: GPUDevice;
  private canvas: HTMLCanvasElement;
  private format: GPUTextureFormat;
  
  // Registered effects library
  private effects: Map<string, ShaderEffect> = new Map();
  
  // Active pipeline stages
  private stages: PipelineStage[] = [];
  
  // Shared sampler
  private sampler: GPUSampler | null = null;
  
  // Timing
  private startTime: number = performance.now();
  
  private initialized: boolean = false;

  constructor(device: GPUDevice, canvas: HTMLCanvasElement) {
    this.device = device;
    this.canvas = canvas;
    this.format = navigator.gpu.getPreferredCanvasFormat();
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[ShaderPipeline] Initializing...');
    
    // Create shared sampler
    this.sampler = this.device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge'
    });
    
    this.initialized = true;
    console.log('[ShaderPipeline] Initialized');
  }

  /**
   * Register a shader effect from config
   */
  registerEffect(name: string, config: ShaderConfig): void {
    const effect: ShaderEffect = {
      name,
      config,
      uniforms: config.uniforms || {}
    };
    
    this.effects.set(name, effect);
    console.log(`[ShaderPipeline] Registered effect: ${name}`);
  }

  /**
   * Load shader from JS file (following tstorie convention)
   */
  async loadEffect(name: string, url: string): Promise<void> {
    try {
      // Dynamic import the shader module
      const module = await import(url);
      
      if (typeof module.getShaderConfig !== 'function') {
        throw new Error('Shader module must export getShaderConfig()');
      }
      
      const config = module.getShaderConfig();
      this.registerEffect(name, config);
    } catch (error) {
      console.error(`[ShaderPipeline] Failed to load effect "${name}" from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Build the shader pipeline from a chain of effect names
   */
  async buildPipeline(effectNames: string[]): Promise<void> {
    // Clear existing pipeline
    this.clearPipeline();
    
    if (effectNames.length === 0) {
      console.warn('[ShaderPipeline] No effects specified');
      return;
    }
    
    console.log(`[ShaderPipeline] Building pipeline: ${effectNames.join(' → ')}`);
    
    for (const effectName of effectNames) {
      const effect = this.effects.get(effectName);
      if (!effect) {
        console.error(`[ShaderPipeline] Effect not found: ${effectName}`);
        continue;
      }
      
      await this.addStage(effect);
    }
    
    console.log(`[ShaderPipeline] Pipeline built with ${this.stages.length} stages`);
  }

  /**
   * Add a stage to the pipeline
   */
  private async addStage(effect: ShaderEffect): Promise<void> {
    // Create shader module with combined code
    const combinedShaderCode = effect.config.vertexShader + '\n' + effect.config.fragmentShader;
    
    const shaderModule = this.device.createShaderModule({
      code: combinedShaderCode
    });
    
    // Create uniform buffer
    // Standard layout: time (4) + pad[3] (12) + resolution (8) + pad[2] (8) + custom uniforms
    const baseUniformSize = 32; // 4 floats padding for alignment
    const customUniformCount = Object.keys(effect.uniforms).length;
    const uniformSize = baseUniformSize + customUniformCount * 16; // 16 bytes per uniform (aligned)
    
    const uniformBuffer = this.device.createBuffer({
      size: uniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    
    // Create output texture
    const outputTexture = this.device.createTexture({
      size: { width: this.canvas.width, height: this.canvas.height },
      format: this.format,
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
    });
    
    const outputTextureView = outputTexture.createView();
    
    // Create render pipeline
    const pipeline = this.device.createRenderPipeline({
      layout: 'auto',
      vertex: {
        module: shaderModule,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 8, // 2 floats (position)
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2'
          }]
        }]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format
        }]
      },
      primitive: {
        topology: 'triangle-strip'
      }
    });
    
    // Add stage
    const stage: PipelineStage = {
      effect,
      pipeline,
      bindGroup: null, // Created when rendering
      uniformBuffer,
      inputTexture: null, // Set during render
      outputTexture,
      outputTextureView
    };
    
    this.stages.push(stage);
  }

  /**
   * Apply the shader pipeline to an input texture
   */
  apply(inputTexture: GPUTexture): GPUTexture {
    if (this.stages.length === 0) {
      return inputTexture; // No effects, return input
    }
    
    const time = (performance.now() - this.startTime) / 1000;
    
    // Create fullscreen quad vertex buffer if not exists
    const quadVertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1
    ]);
    
    const vertexBuffer = this.device.createBuffer({
      size: quadVertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(vertexBuffer.getMappedRange()).set(quadVertices);
    vertexBuffer.unmap();
    
    // Process each stage
    let currentInput = inputTexture;
    
    for (let i = 0; i < this.stages.length; i++) {
      const stage = this.stages[i];
      stage.inputTexture = currentInput;
      
      // Update uniforms
      this.updateUniforms(stage, time);
      
      // Create bind group for this stage
      stage.bindGroup = this.device.createBindGroup({
        layout: stage.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: currentInput.createView() },
          { binding: 1, resource: this.sampler! },
          { binding: 2, resource: { buffer: stage.uniformBuffer } }
        ]
      });
      
      // Render this stage
      const commandEncoder = this.device.createCommandEncoder();
      
      const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: stage.outputTextureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store'
        }]
      });
      
      renderPass.setPipeline(stage.pipeline);
      renderPass.setBindGroup(0, stage.bindGroup);
      renderPass.setVertexBuffer(0, vertexBuffer);
      renderPass.draw(4);
      renderPass.end();
      
      this.device.queue.submit([commandEncoder.finish()]);
      
      // Output of this stage becomes input to next stage
      currentInput = stage.outputTexture;
    }
    
    // Return final output
    return this.stages[this.stages.length - 1].outputTexture;
  }

  /**
   * Update uniform buffer for a stage
   */
  private updateUniforms(stage: PipelineStage, time: number): void {
    // Build uniform data
    // Layout: time, pad[3], resolution, pad[2], custom uniforms
    const uniformData: number[] = [];
    
    // Base uniforms
    uniformData.push(time, 0, 0, 0); // time + padding
    uniformData.push(this.canvas.width, this.canvas.height, 0, 0); // resolution + padding
    
    // Custom uniforms from effect
    for (const [_key, value] of Object.entries(stage.effect.uniforms)) {
      if (typeof value === 'number') {
        uniformData.push(value, 0, 0, 0); // Scalar + padding
      } else if (Array.isArray(value)) {
        uniformData.push(...value);
        // Pad to 16-byte alignment
        while (uniformData.length % 4 !== 0) {
          uniformData.push(0);
        }
      }
    }
    
    const uniformArray = new Float32Array(uniformData);
    this.device.queue.writeBuffer(stage.uniformBuffer, 0, uniformArray);
  }

  /**
   * Update a specific uniform value for an effect
   */
  setUniform(effectName: string, uniformName: string, value: number | number[]): void {
    const effect = this.effects.get(effectName);
    if (!effect) {
      console.warn(`[ShaderPipeline] Effect not found: ${effectName}`);
      return;
    }
    
    effect.uniforms[uniformName] = value;
  }

  /**
   * Clear the pipeline
   */
  clearPipeline(): void {
    // Clean up textures
    for (const stage of this.stages) {
      if (stage.outputTexture) {
        stage.outputTexture.destroy();
      }
    }
    
    this.stages = [];
  }

  /**
   * Get list of registered effects
   */
  getEffects(): string[] {
    return Array.from(this.effects.keys());
  }

  /**
   * Check if effect is registered
   */
  hasEffect(name: string): boolean {
    return this.effects.has(name);
  }
}
