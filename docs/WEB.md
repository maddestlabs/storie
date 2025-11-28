# Backstorie WASM Deployment Guide

This guide explains how to compile and deploy Backstorie applications to the web using WebAssembly (WASM).

## Prerequisites

1. **Nim Compiler** - Install from https://nim-lang.org/
2. **Emscripten SDK** - Required for WASM compilation

### Installing Emscripten

```bash
# Clone the Emscripten SDK
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk

# Install and activate the latest version
./emsdk install latest
./emsdk activate latest

# Activate the environment (run this in each new terminal session)
source ./emsdk_env.sh
```

## Compiling to WASM

### Basic Usage

```bash
# Compile the default index.nim
./compile_wasm.sh

# Compile a specific example
./compile_wasm.sh example_boxes

# Compile in release mode (optimized)
./compile_wasm.sh -r example_boxes

# Compile and start a local web server
./compile_wasm.sh -s

# Compile to a different directory (e.g., for GitHub Pages)
./compile_wasm.sh -o docs example_boxes
./compile_wasm.sh -o . example_boxes  # Output to root directory
```

### Output

The compilation creates the following files in the `web/` directory:

- `backstorie.wasm` - The compiled WebAssembly binary
- `backstorie.wasm.js` - Emscripten JavaScript glue code
- `backstorie.js` - Backstorie terminal renderer and input handler
- `index.html` - HTML template for running the application

## Testing Locally

After compilation, start a local web server:

```bash
cd web
python3 -m http.server 8000
```

Then open http://localhost:8000 in your web browser.

## Browser Features

The web version includes:

- **Full-window terminal** - Terminal automatically fills the browser window
- **Responsive resizing** - Terminal resizes when the browser window changes
- **Keyboard input** - Full keyboard support including special keys and modifiers
- **Mouse input** - Click and mouse move events
- **RGB color support** - Full 24-bit color rendering

## Deployment

### GitHub Pages

The easiest deployment option! See [GITHUB_PAGES.md](GITHUB_PAGES.md) for detailed instructions.

Quick setup:
```bash
./compile_wasm.sh -o docs -r your_app
git add docs/
git commit -m "Deploy to GitHub Pages"
git push
```

Then configure GitHub Pages to serve from the `/docs` directory.

### Custom Web Server

To deploy to your own web server:

1. Compile in release mode for optimization:
   ```bash
   ./compile_wasm.sh -r your_app
   ```

2. Upload the entire `web/` directory to your web server

3. Ensure your web server serves `.wasm` files with the correct MIME type:
   - MIME type: `application/wasm`

### Example Nginx Configuration

```nginx
location /backstorie/ {
    types {
        application/wasm wasm;
    }
}
```

### Example Apache .htaccess

```apache
AddType application/wasm .wasm
```

## Differences from Native

When compiling for WASM, be aware of these differences:

1. **No POSIX APIs** - Terminal manipulation, file I/O, and system calls work differently
2. **No threading** - Single-threaded execution only
3. **Memory limits** - Browser-imposed memory constraints
4. **No terminal control codes** - Rendering handled by canvas instead of ANSI codes

## Troubleshooting

### "emcc not found"

Make sure you've activated the Emscripten environment:
```bash
source /path/to/emsdk/emsdk_env.sh
```

### Blank screen in browser

1. Check the browser console for errors
2. Ensure all files (HTML, JS, WASM) are in the same directory
3. Verify the web server is serving WASM files correctly

### Poor performance

1. Compile in release mode: `./compile_wasm.sh -r`
2. Reduce terminal size or frame rate
3. Optimize your rendering code

## Examples

All example files can be compiled to WASM:

```bash
./compile_wasm.sh example_boxes
./compile_wasm.sh example_counter
./compile_wasm.sh example_particles
./compile_wasm.sh example_fadein
```

## Advanced Configuration

You can modify `compile_wasm.sh` to customize:

- Memory allocation (`INITIAL_MEMORY`)
- Optimization level (`-O2`, `-O3`)
- Emscripten settings
- Export additional functions

See the Emscripten documentation for more options: https://emscripten.org/
