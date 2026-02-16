// TStorie WebGL Renderer
// High-performance terminal rendering with full Unicode support via dynamic glyph cache

class TStorieTerminal {
    constructor(canvasElement, fontFamily = null, fontSize = null) {
        this.canvas = canvasElement;
        
        // Initialize WebGL2 context
        this.gl = canvasElement.getContext('webgl2', {
            alpha: false,
            desynchronized: true,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: true  // For PNG export
        });
        
        if (!this.gl) {
            throw new Error('WebGL2 not supported. Please use a modern browser (Chrome 56+, Firefox 51+, Safari 15+, Edge 79+).');
        }
        
        // Terminal dimensions in characters
        this.cols = 80;
        this.rows = 24;
        
        // Character dimensions in pixels
        this.charWidth = 10;
        this.charHeight = 20;
        
        // Font settings
        this.fontSize = fontSize || 16;
        this.fontFamily = fontFamily || "'3270-regular', 'Consolas', 'Monaco', monospace";
        
        // Performance
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 60; // 60 FPS
        
        // Dynamic glyph cache
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
        
        // WebGL resources
        this.program = null;
        this.atlasTexture = null;
        this.cellBuffer = null;
        this.cellData = null;
        
        // Input state
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Initialize
        this.initFont();
        this.initWebGL();
        this.setupCanvas();
        this.setupInputHandlers();
        
        // Pre-cache ASCII for fast startup
        this.cacheCharRange(32, 127);
    }
    
    initFont() {
        // Measure character dimensions
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
    
    initWebGL() {
        const gl = this.gl;
        
        // Vertex shader - positions instanced quads
        const vertexShaderSource = `#version 300 es
            precision highp float;
            
            // Quad vertex positions (0,0 to 1,1)
            in vec2 a_position;
            
            // Per-instance attributes (cell data)
            in vec2 a_cellPos;       // (col, row)
            in vec4 a_fgColor;       // Foreground RGBA
            in vec4 a_bgColor;       // Background RGBA
            in vec4 a_glyphUV;       // (u, v, w, h) in atlas
            in float a_style;        // packed: bold|italic|underline bits
            in float a_charWidth;    // Character width (1 or 2 for CJK)
            
            // Outputs to fragment shader
            out vec2 v_texCoord;
            out vec4 v_fgColor;
            out vec4 v_bgColor;
            out float v_style;
            
            uniform vec2 u_resolution;  // Terminal size in pixels
            uniform vec2 u_charSize;    // Character size in pixels
            
            void main() {
                // Calculate pixel position of this cell
                vec2 cellPixelPos = a_cellPos * u_charSize;
                
                // Calculate quad size (might be double-width for CJK)
                vec2 quadSize = vec2(a_charWidth, 1.0) * u_charSize;
                
                // Position this vertex of the quad
                vec2 pixelPos = cellPixelPos + a_position * quadSize;
                
                // Convert to clip space (-1 to 1)
                vec2 clipSpace = (pixelPos / u_resolution) * 2.0 - 1.0;
                clipSpace.y = -clipSpace.y;  // Flip Y
                
                gl_Position = vec4(clipSpace, 0.0, 1.0);
                
                // Pass texture coords (map quad 0-1 to glyph UV in atlas)
                v_texCoord = a_glyphUV.xy + a_position * a_glyphUV.zw;
                v_fgColor = a_fgColor;
                v_bgColor = a_bgColor;
                v_style = a_style;
            }
        `;
        
        // Fragment shader - samples font atlas and applies styles
        const fragmentShaderSource = `#version 300 es
            precision highp float;
            
            in vec2 v_texCoord;
            in vec4 v_fgColor;
            in vec4 v_bgColor;
            in float v_style;
            
            uniform sampler2D u_fontAtlas;
            
            out vec4 fragColor;
            
            void main() {
                // Sample glyph from atlas (alpha channel contains glyph)
                float alpha = texture(u_fontAtlas, v_texCoord).a;
                
                // Extract style bits
                float underline = mod(floor(v_style), 2.0);
                float bold = mod(floor(v_style / 2.0), 2.0);
                
                // Apply bold by thickening (simple approximation)
                if (bold > 0.5) {
                    alpha = clamp(alpha * 1.3, 0.0, 1.0);
                }
                
                // Mix foreground and background based on glyph alpha
                fragColor = mix(v_bgColor, v_fgColor, alpha);
                
                // Add underline (check if we're in the bottom 2 pixels)
                if (underline > 0.5) {
                    float bottomFraction = fract(v_texCoord.y * 1024.0);  // Assuming ~20px chars
                    if (bottomFraction > 0.9) {
                        fragColor = v_fgColor;
                    }
                }
            }
        `;
        
        // Compile shaders
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        
        // Link program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link failed: ' + gl.getProgramInfoLog(this.program));
        }
        
        gl.useProgram(this.program);
        
        // Create quad geometry (two triangles)
        const quadVertices = new Float32Array([
            0, 0,  // Top-left
            1, 0,  // Top-right
            0, 1,  // Bottom-left
            1, 0,  // Top-right
            1, 1,  // Bottom-right
            0, 1   // Bottom-left
        ]);
        
        const quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);
        
        const positionLoc = gl.getAttribLocation(this.program, 'a_position');
        gl.enableVertexAttribArray(positionLoc);
        gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
        
        // Create atlas texture
        this.atlasTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        // Use NEAREST filtering for crisp monospace text (not LINEAR which causes artifacts)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        
        // Initialize with empty atlas
        this.uploadAtlasToGPU();
        
        // Get uniform locations
        this.uniformLocs = {
            resolution: gl.getUniformLocation(this.program, 'u_resolution'),
            charSize: gl.getUniformLocation(this.program, 'u_charSize'),
            fontAtlas: gl.getUniformLocation(this.program, 'u_fontAtlas')
        };
        
        // Set static uniforms
        gl.uniform1i(this.uniformLocs.fontAtlas, 0);  // Texture unit 0
        
        // Get instance attribute locations
        this.attribLocs = {
            cellPos: gl.getAttribLocation(this.program, 'a_cellPos'),
            fgColor: gl.getAttribLocation(this.program, 'a_fgColor'),
            bgColor: gl.getAttribLocation(this.program, 'a_bgColor'),
            glyphUV: gl.getAttribLocation(this.program, 'a_glyphUV'),
            style: gl.getAttribLocation(this.program, 'a_style'),
            charWidth: gl.getAttribLocation(this.program, 'a_charWidth')
        };
        
        // Create instance data buffer (will be resized in setupCanvas)
        this.cellBuffer = gl.createBuffer();
    }
    
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compile failed: ' + info);
        }
        
        return shader;
    }
    
    cacheCharRange(start, end) {
        // Pre-cache a range of characters
        for (let i = start; i <= end; i++) {
            const char = String.fromCharCode(i);
            this.getGlyphUV(char);
        }
        
        if (this.atlasNeedsUpload) {
            this.uploadAtlasToGPU();
        }
    }
    
    getGlyphUV(char) {
        // Check cache first
        if (this.glyphCache.has(char)) {
            return this.glyphCache.get(char);
        }
        
        // Empty string = no glyph
        if (!char || char === '') {
            return { u: 0, v: 0, w: 0, h: 0, width: 1, pixelWidth: this.charWidth };
        }
        
        // Add to atlas
        return this.addGlyphToAtlas(char);
    }
    
    addGlyphToAtlas(char) {
        const ctx = this.atlasCtx;
        
        // Measure glyph
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        ctx.textBaseline = 'top';
        const metrics = ctx.measureText(char);
        const pixelWidth = Math.ceil(metrics.width);
        const pixelHeight = this.charHeight;
        
        // Determine character width in cells (1 for ASCII, 2 for CJK)
        const cellWidth = pixelWidth > this.charWidth * 1.5 ? 2 : 1;
        
        // Add padding to prevent bleeding
        const padding = 2;
        const paddedWidth = pixelWidth + padding * 2;
        const paddedHeight = pixelHeight + padding * 2;
        
        // Check if we need to wrap to next row
        if (this.atlasX + paddedWidth > this.atlasCanvas.width) {
            this.atlasX = 0;
            this.atlasY += this.atlasRowHeight;
            this.atlasRowHeight = 0;
        }
        
        // Check if atlas is full
        if (this.atlasY + paddedHeight > this.atlasCanvas.height) {
            console.warn('Font atlas full! Consider increasing atlas size.');
            // For now, return a fallback glyph
            return { u: 0, v: 0, w: 0, h: 0, width: cellWidth, pixelWidth };
        }
        
        // Clear the glyph area first (for proper alpha blending)
        ctx.clearRect(this.atlasX, this.atlasY, paddedWidth, paddedHeight);
        
        // Render glyph with white color (alpha will be preserved)
        // Use integer positions to prevent sub-pixel rendering artifacts
        ctx.fillStyle = 'white';
        ctx.fillText(char, Math.floor(this.atlasX + padding), Math.floor(this.atlasY + padding));
        
        // Calculate UV coordinates (normalized 0-1) with pixel-perfect boundaries
        const uv = {
            u: Math.floor(this.atlasX + padding) / this.atlasCanvas.width,
            v: Math.floor(this.atlasY + padding) / this.atlasCanvas.height,
            w: pixelWidth / this.atlasCanvas.width,
            h: pixelHeight / this.atlasCanvas.height,
            width: cellWidth,
            pixelWidth: pixelWidth
        };
        
        // Cache it
        this.glyphCache.set(char, uv);
        
        // Advance position
        this.atlasX += paddedWidth;
        this.atlasRowHeight = Math.max(this.atlasRowHeight, paddedHeight);
        
        // Mark atlas as needing upload
        this.atlasNeedsUpload = true;
        
        return uv;
    }
    
    uploadAtlasToGPU() {
        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.atlasCanvas
        );
        this.atlasNeedsUpload = false;
    }
    
    setFontSize(newSize) {
        if (newSize < 8 || newSize > 72) {
            console.warn('Font size out of range (8-72):', newSize);
            return;
        }
        
        this.fontSize = newSize;
        
        // Clear glyph cache and regenerate
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
    
    setFontScale(scale) {
        const newSize = Math.round(this.fontSize * scale);
        this.setFontSize(newSize);
    }
    
    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        const gl = this.gl;
        const availWidth = window.innerWidth;
        const availHeight = window.innerHeight;
        
        // Calculate terminal dimensions
        this.cols = Math.max(20, Math.floor(availWidth / this.charWidth));
        this.rows = Math.max(10, Math.floor(availHeight / this.charHeight));
        
        // Set canvas size with device pixel ratio
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.cols * this.charWidth * dpr;
        this.canvas.height = this.rows * this.charHeight * dpr;
        this.canvas.style.width = (this.cols * this.charWidth) + 'px';
        this.canvas.style.height = (this.rows * this.charHeight) + 'px';
        
        // Update WebGL viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        
        // Update uniforms
        gl.useProgram(this.program);
        gl.uniform2f(this.uniformLocs.resolution, this.canvas.width, this.canvas.height);
        gl.uniform2f(this.uniformLocs.charSize, this.charWidth * dpr, this.charHeight * dpr);
        
        // Reallocate cell data buffer
        const cellCount = this.cols * this.rows;
        // Each cell: cellPos(2) + fgColor(4) + bgColor(4) + glyphUV(4) + style(1) + charWidth(1) = 16 floats
        this.cellData = new Float32Array(cellCount * 16);
        
        // Setup instance attributes
        const stride = 16 * 4; // 16 floats * 4 bytes
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, this.cellData.byteLength, gl.DYNAMIC_DRAW);
        
        // Cell position (col, row)
        gl.enableVertexAttribArray(this.attribLocs.cellPos);
        gl.vertexAttribPointer(this.attribLocs.cellPos, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(this.attribLocs.cellPos, 1);
        
        // Foreground color (RGBA)
        gl.enableVertexAttribArray(this.attribLocs.fgColor);
        gl.vertexAttribPointer(this.attribLocs.fgColor, 4, gl.FLOAT, false, stride, 8);
        gl.vertexAttribDivisor(this.attribLocs.fgColor, 1);
        
        // Background color (RGBA)
        gl.enableVertexAttribArray(this.attribLocs.bgColor);
        gl.vertexAttribPointer(this.attribLocs.bgColor, 4, gl.FLOAT, false, stride, 24);
        gl.vertexAttribDivisor(this.attribLocs.bgColor, 1);
        
        // Glyph UV (u, v, w, h)
        gl.enableVertexAttribArray(this.attribLocs.glyphUV);
        gl.vertexAttribPointer(this.attribLocs.glyphUV, 4, gl.FLOAT, false, stride, 40);
        gl.vertexAttribDivisor(this.attribLocs.glyphUV, 1);
        
        // Style flags
        gl.enableVertexAttribArray(this.attribLocs.style);
        gl.vertexAttribPointer(this.attribLocs.style, 1, gl.FLOAT, false, stride, 56);
        gl.vertexAttribDivisor(this.attribLocs.style, 1);
        
        // Character width
        gl.enableVertexAttribArray(this.attribLocs.charWidth);
        gl.vertexAttribPointer(this.attribLocs.charWidth, 1, gl.FLOAT, false, stride, 60);
        gl.vertexAttribDivisor(this.attribLocs.charWidth, 1);
        
        // Notify WASM module
        if (typeof Module !== 'undefined' && Module._emResize) {
            Module._emResize(this.cols, this.rows);
        }
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
        // Use CSS pixel dimensions (style.width/height) not canvas dimensions
        // since getBoundingClientRect returns CSS pixels
        const cssCharWidth = rect.width / this.cols;
        const cssCharHeight = rect.height / this.rows;
        const x = Math.floor((e.clientX - rect.left) / cssCharWidth);
        const y = Math.floor((e.clientY - rect.top) / cssCharHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        Module._emHandleMouseClick(x, y, e.button, shift, alt, ctrl);
    }
    
    handleMouseRelease(e) {
        if (!Module._emHandleMouseRelease) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // Use CSS pixel dimensions (style.width/height) not canvas dimensions
        // since getBoundingClientRect returns CSS pixels
        const cssCharWidth = rect.width / this.cols;
        const cssCharHeight = rect.height / this.rows;
        const x = Math.floor((e.clientX - rect.left) / cssCharWidth);
        const y = Math.floor((e.clientY - rect.top) / cssCharHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        Module._emHandleMouseRelease(x, y, e.button, shift, alt, ctrl);
    }
    
    handleMouseMove(e) {
        if (!Module._emHandleMouseMove) return;
        
        const rect = this.canvas.getBoundingClientRect();
        // Use CSS pixel dimensions (style.width/height) not canvas dimensions
        // since getBoundingClientRect returns CSS pixels
        const cssCharWidth = rect.width / this.cols;
        const cssCharHeight = rect.height / this.rows;
        const x = Math.floor((e.clientX - rect.left) / cssCharWidth);
        const y = Math.floor((e.clientY - rect.top) / cssCharHeight);
        
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
        // Use CSS pixel dimensions (style.width/height) not canvas dimensions
        // since getBoundingClientRect returns CSS pixels
        const cssCharWidth = rect.width / this.cols;
        const cssCharHeight = rect.height / this.rows;
        const x = Math.floor((e.clientX - rect.left) / cssCharWidth);
        const y = Math.floor((e.clientY - rect.top) / cssCharHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        Module._emHandleMouseWheel(x, y, e.deltaY, shift, alt, ctrl);
    }
    
    render() {
        if (!Module._emGetCell) {
            console.warn('Module._emGetCell not available');
            return;
        }
        
        const gl = this.gl;
        let dataIndex = 0;
        let instanceCount = 0;
        
        // Build cell data array
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
                
                // Get cell data
                let ch = Module.UTF8ToString(Module._emGetCell(x, y));
                
                // Filter middle dot workaround (same as Canvas2D version)
                if (ch === '・' && x > 0) {
                    const prevCh = Module.UTF8ToString(Module._emGetCell(x - 1, y));
                    if (prevCh === '>' || prevCh === '<' || prevCh === '^' || prevCh === 'v') {
                        ch = '';
                    }
                }
                
                const fgR = Module._emGetCellFgR(x, y) / 255;
                const fgG = Module._emGetCellFgG(x, y) / 255;
                const fgB = Module._emGetCellFgB(x, y) / 255;
                
                const bgR = Module._emGetCellBgR(x, y) / 255;
                const bgG = Module._emGetCellBgG(x, y) / 255;
                const bgB = Module._emGetCellBgB(x, y) / 255;
                
                const bold = Module._emGetCellBold(x, y);
                const italic = Module._emGetCellItalic(x, y);
                const underline = Module._emGetCellUnderline(x, y);
                const charWidth = Module._emGetCellWidth ? Module._emGetCellWidth(x, y) : 1;
                
                // Get or cache glyph
                const uv = this.getGlyphUV(ch);
                
                // Pack style flags
                const style = (underline ? 1 : 0) + (bold ? 2 : 0) + (italic ? 4 : 0);
                
                // Write to cell data buffer
                this.cellData[dataIndex++] = x;        // cellPos.x
                this.cellData[dataIndex++] = y;        // cellPos.y
                this.cellData[dataIndex++] = fgR;      // fgColor.r
                this.cellData[dataIndex++] = fgG;      // fgColor.g
                this.cellData[dataIndex++] = fgB;      // fgColor.b
                this.cellData[dataIndex++] = 1.0;      // fgColor.a
                this.cellData[dataIndex++] = bgR;      // bgColor.r
                this.cellData[dataIndex++] = bgG;      // bgColor.g
                this.cellData[dataIndex++] = bgB;      // bgColor.b
                this.cellData[dataIndex++] = 1.0;      // bgColor.a
                this.cellData[dataIndex++] = uv.u;     // glyphUV.u
                this.cellData[dataIndex++] = uv.v;     // glyphUV.v
                this.cellData[dataIndex++] = uv.w;     // glyphUV.w
                this.cellData[dataIndex++] = uv.h;     // glyphUV.h
                this.cellData[dataIndex++] = style;    // style
                this.cellData[dataIndex++] = charWidth; // charWidth
                
                instanceCount++;
            }
        }
        
        // Upload atlas if glyphs were added this frame
        if (this.atlasNeedsUpload) {
            this.uploadAtlasToGPU();
        }
        
        // Upload cell data to GPU
        gl.bindBuffer(gl.ARRAY_BUFFER, this.cellBuffer);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.cellData);
        
        // Draw all cells in one instanced call
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, instanceCount);
    }
    
    startAnimationLoop() {
        const animate = (currentTime) => {
            const elapsed = currentTime - this.lastFrameTime;
            
            if (elapsed >= this.frameInterval) {
                this.lastFrameTime = currentTime;
                
                if (Module._emUpdate) {
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

// Global terminal instance
let terminal = null;

async function inittstorie() {
    try {
        console.log('Initializing TStorie (Hybrid renderer: WebGPU → WebGL)...');
        
        // Wait for fonts to load
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        
        const canvas = document.getElementById('terminal');
        const customFont = Module.customFontFamily || null;
        const customFontSize = Module.customFontSize || null;
        
        if (customFont) {
            console.log('Using custom font:', customFont);
        }
        if (customFontSize) {
            console.log('Using custom font size:', customFontSize, 'px');
        }
        
        // Try hybrid renderer (WebGPU with WebGL fallback) if available
        if (typeof TStorieHybridRenderer !== 'undefined') {
            console.log('Using hybrid renderer (WebGPU with automatic WebGL fallback)...');
            terminal = new TStorieHybridRenderer(canvas, {
                fontFamily: customFont,
                fontSize: customFontSize,
                preferWebGPU: true,
                fallbackToWebGL: true,
                webgpuBridge: window.webGPUBridge || null
            });
            
            const backend = await terminal.init();
            console.log('Hybrid renderer initialized with backend:', backend);
        } else {
            // Fallback to pure WebGL if hybrid renderer not loaded
            console.log('Hybrid renderer not available, using WebGL only...');
            terminal = new TStorieTerminal(canvas, customFont, customFontSize);
        }
        
        // Expose terminal globally
        window.terminal = terminal;
        
        // Get dimensions from the underlying renderer
        const cols = terminal.renderer ? terminal.renderer.cols : terminal.cols;
        const rows = terminal.renderer ? terminal.renderer.rows : terminal.rows;
        console.log('Terminal created:', cols, 'x', rows);
        
        // Initialize WASM module
        if (Module._emInit) {
            console.log('Calling Module._emInit...');
            Module._emInit(cols, rows);
            console.log('Module._emInit completed');
        } else {
            throw new Error('Module._emInit not found');
        }
        
        // Start animation loop
        console.log('Starting animation loop...');
        if (terminal.renderer && terminal.renderer.startAnimationLoop) {
            terminal.renderer.startAnimationLoop();
        } else if (terminal.startAnimationLoop) {
            terminal.startAnimationLoop();
        }
    } catch (error) {
        console.error('Failed to initialize TStorie:', error);
        document.getElementById('container').innerHTML = 
            `<div class="error" style="color: white; text-align: center; padding: 40px;">
                <h2>Initialization Error</h2>
                <p>${error.message}</p>
                <p style="margin-top: 20px; font-size: 14px;">
                    TStorie requires WebGL2 support. Please update your browser.
                </p>
            </div>`;
    }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.inittstorie = inittstorie;
    
    // Export API functions
    window.getCharPixelWidth = function() {
        return terminal ? terminal.getCharPixelWidth() : 10;
    };
    
    window.getCharPixelHeight = function() {
        return terminal ? terminal.getCharPixelHeight() : 20;
    };
    
    window.getViewportPixelWidth = function() {
        return terminal ? terminal.getViewportPixelWidth() : window.innerWidth;
    };
    
    window.getViewportPixelHeight = function() {
        return terminal ? terminal.getViewportPixelHeight() : window.innerHeight;
    };
    
    window.setFontSize = function(size) {
        if (terminal) {
            terminal.setFontSize(size);
        }
    };
    
    window.setFontScale = function(scale) {
        if (terminal) {
            terminal.setFontScale(scale);
        }
    };
}
