// TStorie JavaScript Interface
// Handles terminal rendering, input, and WASM module integration

class TStorieTerminal {
    constructor(canvasElement, fontFamily = null, fontSize = null) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext('2d', { 
            alpha: false,
            desynchronized: true
        });
        
        // Disable anti-aliasing to prevent sub-pixel rendering artifacts
        this.ctx.imageSmoothingEnabled = false;
        
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
        
        // Use actual font bounding box height to prevent artifacts
        // Characters can extend beyond fontSize, especially with line spacing
        if (metrics.fontBoundingBoxAscent && metrics.fontBoundingBoxDescent) {
            this.charHeight = Math.ceil(metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent);
        } else {
            // Fallback: add 25% padding for safety
            this.charHeight = Math.ceil(this.fontSize * 1.25);
        }
    }
    
    setFontSize(newSize) {
        // Validate font size
        if (newSize < 8 || newSize > 72) {
            console.warn('Font size out of range (8-72):', newSize);
            return;
        }
        
        this.fontSize = newSize;
        // Reinitialize font metrics
        this.initFont();
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
        // Scale the current font size
        const newSize = Math.round(this.fontSize * scale);
        this.setFontSize(newSize);
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
        
        // Focus canvas on load
        this.canvas.focus();
        this.canvas.addEventListener('blur', (e) => {
            // Don't refocus if user clicked on settings panel or its inputs
            setTimeout(() => {
                const activeElement = document.activeElement;
                const settingsPanel = document.getElementById('settings-panel');
                const settingsToggle = document.getElementById('settings-toggle');
                
                // Check if focus moved to settings panel or its children, or the toggle button
                if (activeElement && 
                    (activeElement === settingsPanel || 
                     activeElement === settingsToggle ||
                     settingsPanel?.contains(activeElement))) {
                    // Let the settings panel keep focus
                    return;
                }
                
                // Otherwise, refocus the canvas for keyboard input
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
        
        // Map special keys to Storie key codes
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
        if (!Module._emHandleMouseClick) {
            console.warn('Module._emHandleMouseClick not available');
            return;
        }
        
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - rect.left) / this.charWidth);
        const y = Math.floor((e.clientY - rect.top) / this.charHeight);
        
        const shift = e.shiftKey ? 1 : 0;
        const alt = e.altKey ? 1 : 0;
        const ctrl = e.ctrlKey ? 1 : 0;
        Module._emHandleMouseClick(x, y, e.button, shift, alt, ctrl);
    }
    
    handleMouseRelease(e) {
        if (!Module._emHandleMouseRelease) {
            console.warn('Module._emHandleMouseRelease not available');
            return;
        }
        
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
    
    render() {
        if (!Module._emGetCell) {
            console.warn('Module._emGetCell not available');
            return;
        }
        
        // Debug first frame
        if (this.debugFirstFrame) {
            console.log('First render frame - dimensions:', this.cols, 'x', this.rows);
            this.debugFirstFrame = false;
        }
        
        // Render each cell (backgrounds cover entire canvas, no pre-clear needed)
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this.renderCell(x, y);
            }
        }
    }
    
    renderCell(x, y) {
        // Check if this cell is the second half of a double-width character
        // Do this BEFORE getting any cell data to avoid rendering over it
        if (x > 0) {
            const prevCh = Module.UTF8ToString(Module._emGetCell(x - 1, y));
            if (prevCh && prevCh !== '') {
                const prevWidth = Module._emGetCellWidth ? Module._emGetCellWidth(x - 1, y) : 1;
                if (prevWidth === 2) {
                    // This is the second cell of a double-width character, skip entirely
                    return;
                }
            }
        }
        
        // Get cell data from WASM
        let ch = Module.UTF8ToString(Module._emGetCell(x, y));
        
        // Filter out middle dot (・/U+30FB) used as terminal rendering workaround
        // It's added after arrow characters in level data to fix terminal glitches
        // but should not be rendered in canvas. Check if previous cell has an arrow.
        if (ch === '・' && x > 0) {
            const prevCh = Module.UTF8ToString(Module._emGetCell(x - 1, y));
            // If previous character is an ASCII arrow, filter the middle dot
            if (prevCh === '>' || prevCh === '<' || prevCh === '^' || prevCh === 'v') {
                ch = '';
            }
        }
        
        const fgR = Module._emGetCellFgR(x, y);
        const fgG = Module._emGetCellFgG(x, y);
        const fgB = Module._emGetCellFgB(x, y);
        
        const bgR = Module._emGetCellBgR(x, y);
        const bgG = Module._emGetCellBgG(x, y);
        const bgB = Module._emGetCellBgB(x, y);
        
        const bold = Module._emGetCellBold(x, y);
        const italic = Module._emGetCellItalic(x, y);
        const underline = Module._emGetCellUnderline(x, y);
        const charWidth = Module._emGetCellWidth ? Module._emGetCellWidth(x, y) : 1;
        
        const px = Math.floor(x * this.charWidth);
        const py = Math.floor(y * this.charHeight);
        const pxNext = Math.ceil((x + charWidth) * this.charWidth);
        const pyNext = Math.ceil((y + 1) * this.charHeight);
        
        // Ensure integer dimensions for pixel-perfect rendering
        const width = Math.max(1, pxNext - px);
        const height = Math.max(1, pyNext - py);
        
        // Draw background (always draw to ensure no gaps)
        // Clear extra pixels above and below to eliminate artifacts from adjacent rows
        this.ctx.fillStyle = `rgb(${bgR}, ${bgG}, ${bgB})`;
        this.ctx.fillRect(px, py - 2, width, height + 4);
        
        // If no character, we're done
        if (!ch || ch === '') return;
        
        // Set font style
        let fontStyle = '';
        if (italic) fontStyle += 'italic ';
        if (bold) fontStyle += 'bold ';
        this.ctx.font = `${fontStyle}${this.fontSize}px ${this.fontFamily}`;
        
        // Ensure textBaseline is set (font changes may reset it)
        this.ctx.textBaseline = 'top';
        
        // Draw text - no scaling, just draw it normally
        this.ctx.fillStyle = `rgb(${fgR}, ${fgG}, ${fgB})`;
        this.ctx.fillText(ch, px, py);
        
        // Draw underline
        if (underline) {
            this.ctx.strokeStyle = `rgb(${fgR}, ${fgG}, ${fgB})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(px, py + this.charHeight - 2);
            this.ctx.lineTo(px + charWidth * this.charWidth, py + this.charHeight - 2);
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

async function inittstorie() {
    try {
        console.log('Initializing TStorie...');
        
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
        terminal = new TStorieTerminal(canvas, customFont, customFontSize);
        
        // Expose terminal globally for shader system to access cell dimensions
        window.terminal = terminal;
        
        console.log('Terminal created:', terminal.cols, 'x', terminal.rows);
        
        // Initialize WASM module
        if (Module._emInit) {
            console.log('Calling Module._emInit...');
            Module._emInit(terminal.cols, terminal.rows);
            console.log('Module._emInit completed');
        } else {
            throw new Error('Module._emInit not found');
        }
        
        // Start animation loop
        console.log('Starting animation loop...');
        terminal.startAnimationLoop();
    } catch (error) {
        console.error('Failed to initialize TStorie:', error);
        document.getElementById('container').innerHTML = 
            `<div class="error">
                <h2>Initialization Error</h2>
                <p>${error.message}</p>
            </div>`;
    }
}

// Export for use in HTML
if (typeof window !== 'undefined') {
    window.inittstorie = inittstorie;
    
    // Export font metric and scaling functions globally for WASM access
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