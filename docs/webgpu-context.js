/**
 * WebGPU Context Manager
 * Handles device initialization, adapter management, and shared GPU resources
 */
export class WebGPUContext {
    config;
    device = null;
    adapter = null;
    canvas = null;
    context = null;
    presentationFormat = 'bgra8unorm';
    initialized = false;
    constructor(config = {}) {
        this.config = config;
        this.canvas = config.canvas || null;
    }
    async init() {
        if (this.initialized)
            return true;
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
        }
        catch (error) {
            console.error('[WebGPUContext] Initialization failed:', error);
            return false;
        }
    }
    getDevice() {
        return this.device;
    }
    getAdapter() {
        return this.adapter;
    }
    getContext() {
        return this.context;
    }
    getPresentationFormat() {
        return this.presentationFormat;
    }
    isInitialized() {
        return this.initialized;
    }
    /**
     * Create a texture with common defaults
     */
    createTexture(descriptor) {
        if (!this.device)
            throw new Error('Device not initialized');
        return this.device.createTexture(descriptor);
    }
    /**
     * Create a buffer with common defaults
     */
    createBuffer(descriptor) {
        if (!this.device)
            throw new Error('Device not initialized');
        return this.device.createBuffer(descriptor);
    }
    /**
     * Create a sampler with common defaults
     */
    createSampler(descriptor = {}) {
        if (!this.device)
            throw new Error('Device not initialized');
        return this.device.createSampler(descriptor);
    }
    /**
     * Create a shader module
     */
    createShaderModule(code) {
        if (!this.device)
            throw new Error('Device not initialized');
        return this.device.createShaderModule({ code });
    }
    /**
     * Set canvas for this context
     */
    setCanvas(canvas) {
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
    getCurrentTextureView() {
        if (!this.context)
            return null;
        return this.context.getCurrentTexture().createView();
    }
    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.device) {
            this.device.destroy();
            this.device = null;
        }
        this.adapter = null;
        this.context = null;
        this.initialized = false;
    }
}
//# sourceMappingURL=webgpu-context.js.map