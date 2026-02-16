// TStorie WebGPU Render Pipeline
// High-performance terminal rendering with WebGPU render pipeline
// Unified GPU context with compute shaders

class TStorieWebGPURender {
    constructor(canvasElement, webgpuDevice = null, fontFamily = null, fontSize = null) {
        this.canvas = canvasElement;
        this.device = webgpuDevice;  // Shared device (can be null, will create)
        this.context = null;
        this.pipeline = null;
        this.renderPassDescriptor = null;
        
        // Terminal dimensions in characters
        this.cols = 80;
        this.rows = 24;
        
        // Character dimensions in pixels
        this.charWidth = 10;
        this.charHeight = 20;
        
        // Font settings
        this.fontSize = fontSize || 16;
        this.fontFamily = fontFamily || "'3270-Regular', 'Consolas', 'Monaco', monospace";
        
        // Performance
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 60; // 60 FPS
        
        // Dynamic glyph cache (same as WebGL version)
        this.glyphCache = new Map();  // char → {u, v, w, h, width, pixelWidth}
        this.atlasCanvas = document.createElement('canvas');
        this.atlasCanvas.width = 2048;
        this.atlasCanvas.height = 2048;
        this.atlasCtx = this.atlasCanvas.getContext('2d', { 
            alpha: true,
            willReadFrequently: true
        });
        this.atlasX = 0;
        this.atlasY = 0;
        this.atlasRowHeight = 0;
        this.atlasNeedsUpload = false;
        
        // WebGPU resources
        this.atlasTexture = null;
        this.atlasSampler = null;
        this.uniformBuffer = null;
        this.cellBuffer = null;
        this.cellData = null;
        this.bindGroup = null;
        
        // Input state
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Initialize flag
        this.initialized = false;
    }
    
    /**
     * Async initialization - must be called before use
     * Can accept shared WebGPU device for unified compute+render
     */
    async init() {
        if (this.initialized) return true;
        
        console.log('[WebGPU Render] Initializing...');
        
        // Check WebGPU support
        if (!navigator.gpu) {
            console.error('[WebGPU Render] WebGPU not supported');
            return false;
        }
        
        try {
            // Get or create device
            if (!this.device) {
                const adapter = await navigator.gpu.requestAdapter({
                    powerPreference: 'high-performance'
                });
                
                if (!adapter) {
                    console.error('[WebGPU Render] Failed to get GPU adapter');
                    return false;
                }
                
                this.device = await adapter.requestDevice({
                    requiredFeatures: [],
                    requiredLimits: {}
                });
                
                console.log('[WebGPU Render] Created new device');
            } else {
                console.log('[WebGPU Render] Using shared device');
            }
            
            // Handle device lost
            this.device.lost.then((info) => {
                console.error('[WebGPU Render] Device lost:', info.message);
                this.initialized = false;
            });
            
            // Configure canvas context
            this.context = this.canvas.getContext('webgpu');
            if (!this.context) {
                console.error('[WebGPU Render] Failed to get WebGPU canvas context');
                return false;
            }
            
            const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
            this.context.configure({
                device: this.device,
                format: presentationFormat,
                alphaMode: 'opaque'
            });
            
            // Wait for fonts to load before measuring
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
                console.log('[WebGPU Render] Fonts loaded');
            }
            
            // Initialize font and WebGPU resources
            this.initFont();
            await this.initWebGPU(presentationFormat);
            this.setupCanvas();
            this.setupInputHandlers();
            
            // Pre-cache ASCII for fast startup
            this.cacheCharRange(32, 127);
            
            this.initialized = true;
            console.log('[WebGPU Render] Initialized successfully');
            return true;
            
        } catch (error) {
            console.error('[WebGPU Render] Initialization failed:', error);
            return false;
        }
    }
    
    initFont() {
        // Measure character dimensions (same as WebGL)
        this.atlasCtx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.atlasCtx.textBaseline = 'top';
        
        const metrics = this.atlasCtx.measureText('M');
        this.charWidth = Math.ceil(metrics.width);
        
        // Use actual font bounding box height to prevent artifacts
        if (metrics.fontBoundingBoxAscent && metrics.fontBoundingBoxDescent) {
            this.charHeight = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
        } else {
            this.charHeight = Math.ceil(this.fontSize * 1.25);
        }
    }
    
    async initWebGPU(presentationFormat) {
        const device = this.device;
        
        // WGSL Shader Code (ported from GLSL)
        const shaderCode = `
            // Uniforms
            struct Uniforms {
                resolution: vec2f,    // Terminal size in pixels
                charSize: vec2f,      // Character size in pixels
            }
            @group(0) @binding(0) var<uniform> uniforms: Uniforms;
            @group(0) @binding(1) var fontAtlas: texture_2d<f32>;
            @group(0) @binding(2) var fontSampler: sampler;
            
            // Per-instance cell data
            struct CellData {
                cellPos: vec2f,      // (col, row)
                fgColor: vec4f,      // Foreground RGBA
                bgColor: vec4f,      // Background RGBA
                glyphUV: vec4f,      // (u, v, w, h) in atlas
                style: f32,          // packed: bold|italic|underline bits
                charWidth: f32,      // Character width (1 or 2 for CJK)
            }
            
            // Vertex shader output
            struct VertexOutput {
                @builtin(position) position: vec4f,
                @location(0) texCoord: vec2f,
                @location(1) fgColor: vec4f,
                @location(2) bgColor: vec4f,
                @location(3) style: f32,
            }
            
            // Vertex shader
            @vertex
            fn vertexMain(
                @builtin(vertex_index) vertexIndex: u32,
                @builtin(instance_index) instanceIndex: u32,
                @location(0) cellPos: vec2f,
                @location(1) fgColor: vec4f,
                @location(2) bgColor: vec4f,
                @location(3) glyphUV: vec4f,
                @location(4) style: f32,
                @location(5) charWidth: f32,
            ) -> VertexOutput {
                var output: VertexOutput;
                
                // Quad vertex positions (0-3 = two triangles)
                var quadPos = array<vec2f, 6>(
                    vec2f(0.0, 0.0),  // Top-left
                    vec2f(1.0, 0.0),  // Top-right
                    vec2f(0.0, 1.0),  // Bottom-left
                    vec2f(1.0, 0.0),  // Top-right
                    vec2f(1.0, 1.0),  // Bottom-right
                    vec2f(0.0, 1.0)   // Bottom-left
                );
                
                let position = quadPos[vertexIndex];
                
                // Calculate pixel position of this cell
                let cellPixelPos = cellPos * uniforms.charSize;
                
                // Calculate quad size (might be double-width for CJK)
                let quadSize = vec2f(charWidth, 1.0) * uniforms.charSize;
                
                // Position this vertex of the quad
                let pixelPos = cellPixelPos + position * quadSize;
                
                // Convert to clip space (-1 to 1)
                var clipSpace = (pixelPos / uniforms.resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;  // Flip Y
                
                output.position = vec4f(clipSpace, 0.0, 1.0);
                
                // Pass texture coords (map quad 0-1 to glyph UV in atlas)
                output.texCoord = glyphUV.xy + position * glyphUV.zw;
                output.fgColor = fgColor;
                output.bgColor = bgColor;
                output.style = style;
                
                return output;
            }
            
            // Fragment shader
            @fragment
            fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
                // Sample glyph from atlas (alpha channel contains glyph)
                let alpha = textureSample(fontAtlas, fontSampler, input.texCoord).a;
                
                // Extract style bits
                let underline = f32(u32(input.style) & 1u);
                let bold = f32((u32(input.style) >> 1u) & 1u);
                
                // Apply bold by thickening (simple approximation)
                var finalAlpha = alpha;
                if (bold > 0.5) {
                    finalAlpha = clamp(alpha * 1.3, 0.0, 1.0);
                }
                
                // Mix foreground and background based on glyph alpha
                var color = mix(input.bgColor, input.fgColor, finalAlpha);
                
                // Add underline (check if we're in the bottom pixels)
                if (underline > 0.5) {
                    let bottomFraction = fract(input.texCoord.y * 1024.0);
                    if (bottomFraction > 0.9) {
                        color = input.fgColor;
                    }
                }
                
                return color;
            }
        `;
        
        // Create shader module
        const shaderModule = device.createShaderModule({
            code: shaderCode,
            label: 'TStorie Terminal Shader'
        });
        
        // Create uniform buffer
        const uniformBufferSize = 4 * 4; // vec2 resolution + vec2 charSize
        this.uniformBuffer = device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
            label: 'Uniform Buffer'
        });
        
        // Create atlas texture
        this.atlasTexture = device.createTexture({
            size: [this.atlasCanvas.width, this.atlasCanvas.height, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
            label: 'Font Atlas Texture'
        });
        
        // Create sampler
        this.atlasSampler = device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
            label: 'Font Atlas Sampler'
        });
        
        // Upload initial empty atlas
        this.uploadAtlasToGPU();
        
        // Create bind group layout
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.VERTEX,
                    buffer: { type: 'uniform' }
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { sampleType: 'float' }
                },
                {
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { type: 'filtering' }
                }
            ],
            label: 'Bind Group Layout'
        });
        
        // Create bind group
        this.bindGroup = device.createBindGroup({
            layout: bindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.atlasTexture.createView() },
                { binding: 2, resource: this.atlasSampler }
            ],
            label: 'Bind Group'
        });
        
        // Create render pipeline
        const pipelineLayout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout],
            label: 'Pipeline Layout'
        });
        
        this.pipeline = device.createRenderPipeline({
            layout: pipelineLayout,
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
                buffers: [{
                    // Per-instance cell data
                    arrayStride: 64, // 2+4+4+4+1+1 = 16 floats * 4 bytes = 64 bytes
                    stepMode: 'instance',
                    attributes: [
                        { format: 'float32x2', offset: 0, shaderLocation: 0 },  // cellPos (2 floats, 8 bytes)
                        { format: 'float32x4', offset: 8, shaderLocation: 1 },  // fgColor (4 floats, 16 bytes)
                        { format: 'float32x4', offset: 24, shaderLocation: 2 }, // bgColor (4 floats, 16 bytes)
                        { format: 'float32x4', offset: 40, shaderLocation: 3 }, // glyphUV (4 floats, 16 bytes)
                        { format: 'float32', offset: 56, shaderLocation: 4 },   // style (1 float, 4 bytes)
                        { format: 'float32', offset: 60, shaderLocation: 5 },   // charWidth (1 float, 4 bytes)
                    ]
                }]
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{
                    format: presentationFormat,
                    blend: {
                        color: {
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha',
                            operation: 'add'
                        },
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'zero',
                            operation: 'add'
                        }
                    }
                }]
            },
            primitive: {
                topology: 'triangle-list',
                cullMode: 'none'
            },
            label: 'Render Pipeline'
        });
        
        // Setup render pass descriptor
        this.renderPassDescriptor = {
            colorAttachments: [{
                view: null, // Will be set per frame
                clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store'
            }]
        };
    }
    
    setupCanvas() {
        // Calculate terminal dimensions based on window size
        const availWidth = window.innerWidth;
        const availHeight = window.innerHeight;
        
        this.cols = Math.max(20, Math.floor(availWidth / this.charWidth));
        this.rows = Math.max(10, Math.floor(availHeight / this.charHeight));
        
        // Set canvas size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.cols * this.charWidth * dpr;
        this.canvas.height = this.rows * this.charHeight * dpr;
        this.canvas.style.width = (this.cols * this.charWidth) + 'px';
        this.canvas.style.height = (this.rows * this.charHeight) + 'px';
        
        // Allocate cell buffer
        const maxCells = this.cols * this.rows;
        const floatsPerCell = 16;
        this.cellData = new Float32Array(maxCells * floatsPerCell);
        
        const bufferSize = this.cellData.byteLength;
        this.cellBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Cell Instance Buffer'
        });
        
        // Update uniforms with DPR
        const uniformData = new Float32Array([
            this.canvas.width, this.canvas.height,
            this.charWidth * dpr, this.charHeight * dpr
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
    }
    
    setupInputHandlers() {
        // Keyboard input
        this.canvas.addEventListener('keydown', (e) => {
            e.preventDefault();
            this.handleKeyDown(e);
        });
        
        this.canvas.addEventListener('keypress', (e) => {
            e.preventDefault();
        });
        
        // Mouse input
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.handleMouseClick(e);
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            e.preventDefault();
            this.handleMouseRelease(e);
        });
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        // Mouse wheel scrolling
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.handleMouseWheel(e);
        });
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Focus management
        this.canvas.focus();
        this.canvas.addEventListener('blur', (e) => {
            setTimeout(() => {
                const activeElement = document.activeElement;
                const settingsPanel = document.getElementById('settings-panel');
                const settingsToggle = document.getElementById('settings-toggle');
                
                if (activeElement && 
                    (activeElement === settingsPanel || 
                     activeElement === settingsToggle ||
                     settingsPanel?.contains(activeElement))) {
                    return;
                }
                
                this.canvas.focus();
            }, 0);
        });
        
        // Handle window resize
        window.addEventListener('resize', () => this.resize());
    }
    
    handleKeyDown(e) {
        if (!Module._emHandleKeyPress) {
            console.warn('Module._emHandleKeyPress not available');
            return;
        }
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        let keyCode = 0;
        
        // Map special keys
        switch(e.key) {
            case 'Escape': keyCode = 27; break;
            case 'Backspace': keyCode = 127; break;
            case ' ': keyCode = 32; break;
            case 'Tab': keyCode = 9; break;
            case 'Enter': keyCode = 13; break;
            case 'Delete': keyCode = 46; break;
            
            case 'ArrowUp': keyCode = 1000; break;
            case 'ArrowDown': keyCode = 1001; break;
            case 'ArrowLeft': keyCode = 1002; break;
            case 'ArrowRight': keyCode = 1003; break;
            
            case 'Home': keyCode = 1004; break;
            case 'End': keyCode = 1005; break;
            case 'PageUp': keyCode = 1006; break;
            case 'PageDown': keyCode = 1007; break;
            case 'Insert': keyCode = 1008; break;
            
            case 'F1': keyCode = 1100; break;
            case 'F2': keyCode = 1101; break;
            case 'F3': keyCode = 1102; break;
            case 'F4': keyCode = 1103; break;
            case 'F5': keyCode = 1104; break;
            case 'F6': keyCode = 1105; break;
            case 'F7': keyCode = 1106; break;
            case 'F8': keyCode = 1107; break;
            case 'F9': keyCode = 1108; break;
            case 'F10': keyCode = 1109; break;
            case 'F11': keyCode = 1110; break;
            case 'F12': keyCode = 1111; break;
            
            default:
                if (e.key.length === 1) {
                    keyCode = e.key.charCodeAt(0);
                    
                    if (ctrl && keyCode >= 65 && keyCode <= 90) {
                        keyCode = keyCode - 64;
                    } else if (ctrl && keyCode >= 97 && keyCode <= 122) {
                        keyCode = keyCode - 96;
                    }
                }
                break;
        }
        
        if (keyCode > 0) {
            // For printable characters, only send TextEvent to avoid duplicates
            // For special keys, send KeyEvent
            const isPrintableChar = e.key.length === 1 && !ctrl && !alt && keyCode >= 32 && keyCode < 127;
            
            if (isPrintableChar) {
                // Send text input event only
                const textPtr = Module.allocateUTF8(e.key);
                Module._emHandleTextInput(textPtr);
                Module._free(textPtr);
            } else {
                // Send key press event for special keys
                Module._emHandleKeyPress(keyCode, shift, alt, ctrl);
            }
        }
    }
    
    handleMouseClick(e) {
        if (!Module._emHandleMouseClick) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.charWidth);
        const y = Math.floor((e.clientY - rect.top) / this.charHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        Module._emHandleMouseClick(x, y, e.button, shift, alt, ctrl);
    }
    
    handleMouseRelease(e) {
        if (!Module._emHandleMouseRelease) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.charWidth);
        const y = Math.floor((e.clientY - rect.top) / this.charHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        Module._emHandleMouseRelease(x, y, e.button, shift, alt, ctrl);
    }
    
    handleMouseMove(e) {
        if (!Module._emHandleMouseMove) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.charWidth);
        const y = Math.floor((e.clientY - rect.top) / this.charHeight);
        
        if (x !== this.mouseX || y !== this.mouseY) {
            this.mouseX = x;
            this.mouseY = y;
            Module._emHandleMouseMove(x, y);
        }
    }
    
    handleMouseWheel(e) {
        if (!Module._emHandleMouseWheel) {
            console.warn('Module._emHandleMouseWheel not available');
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.charWidth);
        const y = Math.floor((e.clientY - rect.top) / this.charHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        Module._emHandleMouseWheel(x, y, e.deltaY, shift, alt, ctrl);
    }
    
    resize() {
        if (!this.initialized) return;
        
        // Recalculate based on window size and current font
        const availWidth = window.innerWidth;
        const availHeight = window.innerHeight;
        
        this.cols = Math.max(20, Math.floor(availWidth / this.charWidth));
        this.rows = Math.max(10, Math.floor(availHeight / this.charHeight));
        
        // Set canvas size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.cols * this.charWidth * dpr;
        this.canvas.height = this.rows * this.charHeight * dpr;
        this.canvas.style.width = (this.cols * this.charWidth) + 'px';
        this.canvas.style.height = (this.rows * this.charHeight) + 'px';
        
        // Reallocate cell buffer
        const maxCells = this.cols * this.rows;
        const floatsPerCell = 16;
        this.cellData = new Float32Array(maxCells * floatsPerCell);
        
        const bufferSize = this.cellData.byteLength;
        if (this.cellBuffer) this.cellBuffer.destroy();
        this.cellBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
            label: 'Cell Instance Buffer'
        });
        
        // Update uniforms with DPR
        const uniformData = new Float32Array([
            this.canvas.width, this.canvas.height,
            this.charWidth * dpr, this.charHeight * dpr
        ]);
        this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        
        // Notify WASM module of new dimensions
        if (typeof Module !== 'undefined' && Module._emResize) {
            Module._emResize(this.cols, this.rows);
        }
    }
    
    setFontSize(newSize) {
        // Validate font size
        if (newSize < 8 || newSize > 72) {
            console.warn('[WebGPU Render] Font size out of range (8-72):', newSize);
            return;
        }
        
        this.fontSize = newSize;
        
        // Clear glyph cache and atlas
        this.glyphCache.clear();
        this.atlasX = 0;
        this.atlasY = 0;
        this.atlasRowHeight = 0;
        this.atlasCtx.clearRect(0, 0, this.atlasCanvas.width, this.atlasCanvas.height);
        
        // Reinitialize font metrics
        this.initFont();
        
        // Pre-cache ASCII again
        this.cacheCharRange(32, 127);
        
        // Trigger resize to recalculate terminal dimensions
        this.resize();
        
        console.log('[WebGPU Render] Font size changed to:', newSize, 'px');
    }
    
    setFontScale(scale) {
        // Scale the current font size
        const newSize = Math.round(this.fontSize * scale);
        this.setFontSize(newSize);
    }
    
    getCharPixelWidth() {
        return this.charWidth;
    }
    
    getCharPixelHeight() {
        return this.charHeight;
    }
    
    getViewportPixelWidth() {
        return window.innerWidth;
    }
    
    getViewportPixelHeight() {
        return window.innerHeight;
    }
    
    // Glyph caching methods (identical to WebGL version)
    cacheChar(char) {
        if (this.glyphCache.has(char)) {
            return this.glyphCache.get(char);
        }
        
        // Measure character
        const metrics = this.atlasCtx.measureText(char);
        const pixelWidth = Math.ceil(metrics.width);
        const width = Math.max(1, Math.ceil(pixelWidth / this.charWidth));
        
        // Check if we need a new row
        if (this.atlasX + pixelWidth > this.atlasCanvas.width) {
            this.atlasX = 0;
            this.atlasY += this.atlasRowHeight;
            this.atlasRowHeight = 0;
        }
        
        // Check if we ran out of space
        if (this.atlasY + this.charHeight > this.atlasCanvas.height) {
            console.warn('Font atlas full, clearing cache');
            this.glyphCache.clear();
            this.atlasCtx.clearRect(0, 0, this.atlasCanvas.width, this.atlasCanvas.height);
            this.atlasX = 0;
            this.atlasY = 0;
            this.atlasRowHeight = 0;
        }
        
        // Draw character to atlas
        // Use integer positions to prevent sub-pixel rendering artifacts
        this.atlasCtx.fillStyle = 'white';
        this.atlasCtx.fillText(char, Math.floor(this.atlasX), Math.floor(this.atlasY));
        
        // Calculate UV coordinates with pixel-perfect boundaries
        const u = Math.floor(this.atlasX) / this.atlasCanvas.width;
        const v = Math.floor(this.atlasY) / this.atlasCanvas.height;
        const w = pixelWidth / this.atlasCanvas.width;
        const h = this.charHeight / this.atlasCanvas.height;
        
        const glyphData = { u, v, w, h, width, pixelWidth };
        this.glyphCache.set(char, glyphData);
        
        // Update position
        this.atlasX += pixelWidth;
        this.atlasRowHeight = Math.max(this.atlasRowHeight, this.charHeight);
        this.atlasNeedsUpload = true;
        
        return glyphData;
    }
    
    cacheCharRange(start, end) {
        for (let i = start; i <= end; i++) {
            this.cacheChar(String.fromCharCode(i));
        }
        if (this.atlasNeedsUpload) {
            this.uploadAtlasToGPU();
        }
    }
    
    uploadAtlasToGPU() {
        if (!this.device || !this.atlasTexture) return;
        
        // Copy canvas to GPU texture
        this.device.queue.copyExternalImageToTexture(
            { source: this.atlasCanvas },
            { texture: this.atlasTexture },
            [this.atlasCanvas.width, this.atlasCanvas.height]
        );
        
        this.atlasNeedsUpload = false;
    }
    
    // Main render method
    render(cells) {
        if (!this.initialized) {
            console.warn('[WebGPU Render] Not initialized, cannot render');
            return;
        }
        
        // Check if Module is available
        if (typeof Module === 'undefined' || !Module._emGetCell) {
            console.warn('[WebGPU Render] Module not ready');
            return;
        }
        
        // Upload atlas if needed
        if (this.atlasNeedsUpload) {
            this.uploadAtlasToGPU();
        }
        
        // Build instance data from Module (like WebGL version)
        let instanceCount = 0;
        const data = this.cellData;
        
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                // Check if this is the second half of a double-width character
                if (x > 0) {
                    const prevCh = Module.UTF8ToString(Module._emGetCell(x - 1, y));
                    if (prevCh && prevCh !== '') {
                        const prevWidth = Module._emGetCellWidth ? Module._emGetCellWidth(x - 1, y) : 1;
                        if (prevWidth === 2) {
                            // Skip this cell entirely
                            continue;
                        }
                    }
                }
                
                // Get cell data - properly decode UTF-8 string from WASM memory
                let ch = Module.UTF8ToString(Module._emGetCell(x, y));
                
                // Filter middle dot workaround (same as WebGL version)
                if (ch === '・' && x > 0) {
                    const prevCh = Module.UTF8ToString(Module._emGetCell(x - 1, y));
                    if (prevCh === '>' || prevCh === '<' || prevCh === '^' || prevCh === 'v') {
                        ch = '';
                    }
                }
                
                // Get cell colors (including backgrounds for empty cells)
                const fgR = Module._emGetCellFgR(x, y) / 255;
                const fgG = Module._emGetCellFgG(x, y) / 255;
                const fgB = Module._emGetCellFgB(x, y) / 255;
                const bgR = Module._emGetCellBgR(x, y) / 255;
                const bgG = Module._emGetCellBgG(x, y) / 255;
                const bgB = Module._emGetCellBgB(x, y) / 255;
                
                // Get cell style
                const bold = Module._emGetCellBold(x, y);
                const italic = Module._emGetCellItalic(x, y);
                const underline = Module._emGetCellUnderline(x, y);
                const charWidth = Module._emGetCellWidth ? Module._emGetCellWidth(x, y) : 1;
                
                // Cache glyph
                const glyph = this.cacheChar(ch);
                
                // Pack style bits
                const style = (underline ? 1 : 0) + (bold ? 2 : 0) + (italic ? 4 : 0);
                
                // Write instance data
                const offset = instanceCount * 16;
                data[offset + 0] = x;
                data[offset + 1] = y;
                data[offset + 2] = fgR;
                data[offset + 3] = fgG;
                data[offset + 4] = fgB;
                data[offset + 5] = 1.0;
                data[offset + 6] = bgR;
                data[offset + 7] = bgG;
                data[offset + 8] = bgB;
                data[offset + 9] = 1.0;
                data[offset + 10] = glyph.u;
                data[offset + 11] = glyph.v;
                data[offset + 12] = glyph.w;
                data[offset + 13] = glyph.h;
                data[offset + 14] = style;
                data[offset + 15] = glyph.width;
                
                instanceCount++;
            }
        }
        
        if (instanceCount === 0) return;
        
        // Upload instance data
        this.device.queue.writeBuffer(this.cellBuffer, 0, data, 0, instanceCount * 16);
        
        // Get current texture
        const textureView = this.context.getCurrentTexture().createView();
        this.renderPassDescriptor.colorAttachments[0].view = textureView;
        
        // Create command encoder
        const commandEncoder = this.device.createCommandEncoder();
        
        // Render pass
        const passEncoder = commandEncoder.beginRenderPass(this.renderPassDescriptor);
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        passEncoder.setVertexBuffer(0, this.cellBuffer);
        passEncoder.draw(6, instanceCount, 0, 0); // 6 vertices per quad
        passEncoder.end();
        
        // Submit
        this.device.queue.submit([commandEncoder.finish()]);
    }
    
    parseColor(color) {
        // Parse hex color #RRGGBB or #RRGGBBAA to [r, g, b, a] floats
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1.0;
            return [r, g, b, a];
        }
        return [1, 1, 1, 1]; // Default white
    }
    
    // Cleanup
    destroy() {
        if (this.cellBuffer) this.cellBuffer.destroy();
        if (this.uniformBuffer) this.uniformBuffer.destroy();
        if (this.atlasTexture) this.atlasTexture.destroy();
        this.initialized = false;
    }
    
    // Start animation loop
    startAnimationLoop() {
        const animate = (currentTime) => {
            const elapsed = currentTime - this.lastFrameTime;
            
            if (elapsed >= this.frameInterval) {
                this.lastFrameTime = currentTime;
                
                if (typeof Module !== 'undefined' && Module._emUpdate) {
                    Module._emUpdate(elapsed);
                }
                
                this.render();
                
                // Notify shader system that terminal render is complete
                // This ensures shader system samples a fully rendered frame
                if (window.shaderSystem && window.shaderSystem.onTerminalRenderComplete) {
                    window.shaderSystem.onTerminalRenderComplete();
                }
            }
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
}

// Export for use in TStorie
if (typeof window !== 'undefined') {
    window.TStorieWebGPURender = TStorieWebGPURender;
}
