/**
 * WebGPU Context Manager
 * Handles device initialization, adapter management, and shared GPU resources
 */

export interface WebGPUContextConfig {
  canvas?: HTMLCanvasElement;
  powerPreference?: 'low-power' | 'high-performance';
  preferredFormat?: GPUTextureFormat;
}

export class WebGPUContext {
  private device: GPUDevice | null = null;
  private adapter: GPUAdapter | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: GPUCanvasContext | null = null;
  private presentationFormat: GPUTextureFormat = 'bgra8unorm';
  private initialized: boolean = false;

  constructor(private config: WebGPUContextConfig = {}) {
    this.canvas = config.canvas || null;
  }

  async init(): Promise<boolean> {
    if (this.initialized) return true;

    console.log('[WebGPUContext] Initializing...');

    // Check WebGPU support
    if (!navigator.gpu) {
      console.error('[WebGPUContext] WebGPU not supported in this browser');
      return false;
    }

    try {
      // Request adapter
      this.adapter = await navigator.gpu.requestAdapter({
        powerPreference: this.config.powerPreference || 'high-performance'
      });

      if (!this.adapter) {
        console.error('[WebGPUContext] Failed to get GPU adapter');
        return false;
      }

      // Request device
      this.device = await this.adapter.requestDevice();

      // Handle device lost
      this.device.lost.then((info) => {
        console.error('[WebGPUContext] Device lost:', info.message);
        this.initialized = false;
      });

      // Get preferred format
      this.presentationFormat = this.config.preferredFormat || 
                               navigator.gpu.getPreferredCanvasFormat();

      // Configure canvas context if canvas provided
      if (this.canvas) {
        this.context = this.canvas.getContext('webgpu');
        if (this.context) {
          this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied'
          });
        }
      }

      this.initialized = true;
      console.log('[WebGPUContext] Initialized successfully');
      console.log('[WebGPUContext] Presentation format:', this.presentationFormat);
      
      return true;

    } catch (error) {
      console.error('[WebGPUContext] Initialization failed:', error);
      return false;
    }
  }

  getDevice(): GPUDevice | null {
    return this.device;
  }

  getAdapter(): GPUAdapter | null {
    return this.adapter;
  }

  getContext(): GPUCanvasContext | null {
    return this.context;
  }

  getPresentationFormat(): GPUTextureFormat {
    return this.presentationFormat;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Create a texture with common defaults
   */
  createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createTexture(descriptor);
  }

  /**
   * Create a buffer with common defaults
   */
  createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createBuffer(descriptor);
  }

  /**
   * Create a sampler with common defaults
   */
  createSampler(descriptor: GPUSamplerDescriptor = {}): GPUSampler {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createSampler(descriptor);
  }

  /**
   * Create a shader module
   */
  createShaderModule(code: string): GPUShaderModule {
    if (!this.device) throw new Error('Device not initialized');
    return this.device.createShaderModule({ code });
  }

  /**
   * Set canvas for this context
   */
  setCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    if (this.device) {
      this.context = canvas.getContext('webgpu');
      if (this.context) {
        this.context.configure({
          device: this.device,
          format: this.presentationFormat,
          alphaMode: 'premultiplied'
        });
      }
    }
  }

  /**
   * Get current canvas texture view for rendering
   */
  getCurrentTextureView(): GPUTextureView | null {
    if (!this.context) return null;
    return this.context.getCurrentTexture().createView();
  }

  /**
   * Destroy and cleanup
   */
  destroy(): void {
    if (this.device) {
      this.device.destroy();
      this.device = null;
    }
    this.adapter = null;
    this.context = null;
    this.initialized = false;
  }
}
