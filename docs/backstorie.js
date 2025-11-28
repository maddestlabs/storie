// Backstorie JavaScript Interface
// Handles terminal rendering, input, and WASM module integration

class BackstorieTerminal {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d', { alpha: false });
        
        // Terminal dimensions in characters
        this.cols = 80;
        this.rows = 24;
        
        // Character dimensions in pixels
        this.charWidth = 10;
        this.charHeight = 20;
        
        // Font settings
        this.fontSize = 16;
        this.fontFamily = "'AnomalyMono', 'Consolas', 'Monaco', monospace";
        
        // Performance
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / 60; // 60 FPS
        
        // Input state
        this.keys = new Set();
        this.mouseX = 0;
        this.mouseY = 0;
        
        // Debug flags
        this.debugFirstFrame = true;
        this.debugFirstCell = true;
        
        this.initFont();
        this.setupCanvas();
        this.setupInputHandlers();
    }
    
    initFont() {
        // Measure character dimensions accurately
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.ctx.textBaseline = 'top';
        
        // Measure width using a wide character
        const metrics = this.ctx.measureText('M');
        this.charWidth = Math.ceil(metrics.width);
        
        // Use fontSize directly for height to avoid gaps
        // This matches how terminals render without inter-line spacing
        this.charHeight = this.fontSize;
    }
    
    setupCanvas() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }
    
    resize() {
        // Calculate how many characters fit in the window
        const availWidth = window.innerWidth;
        const availHeight = window.innerHeight;
        
        // Calculate terminal dimensions
        this.cols = Math.floor(availWidth / this.charWidth);
        this.rows = Math.floor(availHeight / this.charHeight);
        
        // Ensure minimum size
        this.cols = Math.max(20, this.cols);
        this.rows = Math.max(10, this.rows);
        
        // Set canvas size with device pixel ratio for sharp rendering
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.cols * this.charWidth * dpr;
        this.canvas.height = this.rows * this.charHeight * dpr;
        this.canvas.style.width = (this.cols * this.charWidth) + 'px';
        this.canvas.style.height = (this.rows * this.charHeight) + 'px';
        
        // Scale context to match device pixel ratio
        this.ctx.scale(dpr, dpr);
        
        // Improve text rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.textRendering = 'geometricPrecision';
        
        // Update font after resize
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        this.ctx.textBaseline = 'top';
        
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
        
        this.canvas.addEventListener('mousemove', (e) => {
            this.handleMouseMove(e);
        });
        
        // Prevent context menu
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Focus canvas on load
        this.canvas.focus();
        this.canvas.addEventListener('blur', () => {
            setTimeout(() => this.canvas.focus(), 0);
        });
    }
    
    handleKeyDown(e) {
        if (!Module._emHandleKeyPress) return;
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        
        let keyCode = 0;
        
        // Map special keys to Backstorie key codes
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
            
            case 'F1': keyCode = 1008; break;
            case 'F2': keyCode = 1009; break;
            case 'F3': keyCode = 1010; break;
            case 'F4': keyCode = 1011; break;
            case 'F5': keyCode = 1012; break;
            case 'F6': keyCode = 1013; break;
            case 'F7': keyCode = 1014; break;
            case 'F8': keyCode = 1015; break;
            case 'F9': keyCode = 1016; break;
            case 'F10': keyCode = 1017; break;
            case 'F11': keyCode = 1018; break;
            case 'F12': keyCode = 1019; break;
            
            default:
                // Handle regular character input
                if (e.key.length === 1) {
                    keyCode = e.key.charCodeAt(0);
                    
                    // Handle Ctrl+key combinations
                    if (ctrl && keyCode >= 65 && keyCode <= 90) {
                        // Ctrl+A through Ctrl+Z
                        keyCode = keyCode - 64;
                    } else if (ctrl && keyCode >= 97 && keyCode <= 122) {
                        // Ctrl+a through Ctrl+z
                        keyCode = keyCode - 96;
                    }
                }
                break;
        }
        
        if (keyCode > 0) {
            Module._emHandleKeyPress(keyCode, shift, alt, ctrl);
            
            // Also send text input for printable characters
            if (e.key.length === 1 && !ctrl && !alt && keyCode < 127) {
                const textPtr = Module.allocateUTF8(e.key);
                Module._emHandleTextInput(textPtr);
                Module._free(textPtr);
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
    
    render() {
        if (!Module._emGetCell) {
            console.warn('Module._emGetCell not available');
            return;
        }
        
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render each cell
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.renderCell(x, y);
            }
        }
    }
    
    renderCell(x, y) {
        // Get cell data from WASM
        const ch = Module.UTF8ToString(Module._emGetCell(x, y));
        if (!ch || ch === '') return;
        
        const fgR = Module._emGetCellFgR(x, y);
        const fgG = Module._emGetCellFgG(x, y);
        const fgB = Module._emGetCellFgB(x, y);
        
        const bgR = Module._emGetCellBgR(x, y);
        const bgG = Module._emGetCellBgG(x, y);
        const bgB = Module._emGetCellBgB(x, y);
        
        const bold = Module._emGetCellBold(x, y);
        const italic = Module._emGetCellItalic(x, y);
        const underline = Module._emGetCellUnderline(x, y);
        
        const px = x * this.charWidth;
        const py = y * this.charHeight;
        
        // Draw background
        if (bgR !== 0 || bgG !== 0 || bgB !== 0) {
            this.ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
            this.ctx.fillRect(px, py, this.charWidth, this.charHeight);
        }
        
        // Set font style
        let fontStyle = '';
        if (italic) fontStyle += 'italic ';
        if (bold) fontStyle += 'bold ';
        this.ctx.font = `${fontStyle}${this.fontSize}px ${this.fontFamily}`;
        
        // Draw text
        this.ctx.fillStyle = `rgb(${fgR}, ${fgG}, ${fgB})`;
        this.ctx.fillText(ch, px, py);
        
        // Draw underline
        if (underline) {
            this.ctx.strokeStyle = `rgb(${fgR}, ${fgG}, ${fgB})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(px, py + this.charHeight - 2);
            this.ctx.lineTo(px + this.charWidth, py + this.charHeight - 2);
            this.ctx.stroke();
        }
        
        // Reset font
        this.ctx.font = `${this.fontSize}px ${this.fontFamily}`;
    }
    
    startAnimationLoop() {
        const animate = (currentTime) => {
            // Throttle to target FPS
            const elapsed = currentTime - this.lastFrameTime;
            
            if (elapsed >= this.frameInterval) {
                this.lastFrameTime = currentTime;
                
                // Update and render
                if (Module._emUpdate) {
                    Module._emUpdate(elapsed);
                }
                
                this.render();
            }
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }
}

// Global terminal instance
let terminal = null;

async function initBackstorie() {
    try {
        // Wait for fonts to load
        if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
        }
        
        const canvas = document.getElementById('terminal');
        terminal = new BackstorieTerminal(canvas);
        
        // Initialize WASM module
        if (Module._emInit) {
            Module._emInit(terminal.cols, terminal.rows);
        } else {
            throw new Error('Module._emInit not found');
        }
        
        // Start animation loop
        terminal.startAnimationLoop();
    } catch (error) {
        console.error('Failed to initialize Backstorie:', error);
        document.getElementById('container').innerHTML = 
            `<div class="error">
                <h2>Initialization Error</h2>
                <p>${error.message}</p>
            </div>`;
    }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.initBackstorie = initBackstorie;
}
