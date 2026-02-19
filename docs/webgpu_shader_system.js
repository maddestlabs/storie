/**
 * WebGPU Shader Chain System for TStorie
 * 
 * Renders multi-pass shader effects using WebGPU API
 * Similar to WebGL shader chain but using modern WebGPU architecture
 */

function parseCssColorToRgb01(cssColor) {
  if (!cssColor || typeof cssColor !== 'string') return null;

  const c = cssColor.trim();

  // #rgb or #rrggbb
  if (c[0] === '#') {
    const hex = c.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r / 255, g / 255, b / 255];
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r / 255, g / 255, b / 255];
    }
  }

  // rgb()/rgba() in comma or space separated forms
  // Examples: rgb(0, 20, 20), rgba(0, 20, 20, 0.9), rgb(0 20 20 / 0.9)
  const m = c.match(/rgba?\((.*)\)/i);
  if (m) {
    const parts = m[1]
      .replace(/\//g, ' ')
      .split(/[\s,]+/)
      .map(p => p.trim())
      .filter(Boolean);

    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r / 255, g / 255, b / 255];
  }

  return null;
}

function parseCssColorToRgba01(cssColor) {
  if (!cssColor || typeof cssColor !== 'string') return null;
  const c = cssColor.trim();

  if (c[0] === '#') {
    const rgb = parseCssColorToRgb01(c);
    return rgb ? [rgb[0], rgb[1], rgb[2], 1.0] : null;
  }

  const m = c.match(/rgba?\((.*)\)/i);
  if (!m) return null;

  const parts = m[1]
    .replace(/\//g, ' ')
    .split(/[\s,]+/)
    .map(p => p.trim())
    .filter(Boolean);

  const r = Number(parts[0]);
  const g = Number(parts[1]);
  const b = Number(parts[2]);
  let a = parts.length >= 4 ? Number(parts[3]) : 1.0;

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
  if (!Number.isFinite(a)) a = 1.0;
  a = Math.max(0, Math.min(1, a));

  return [r / 255, g / 255, b / 255, a];
}

function getLiveThemeBackgroundRgb01(system) {
  // Prefer a value derived from the real rendered terminal pixels (most reliable).
  // This is set during the terminalCanvas -> texture copy step.
  const cached = system?.liveThemeBackgroundRgb01;
  if (Array.isArray(cached) && cached.length === 3 && cached.every(Number.isFinite)) return cached;

  try {
    const t = window.terminal;

    // Common theme locations (xterm-like and custom)
    const theme =
      t?.theme ||
      t?.options?.theme ||
      (typeof t?.getOption === 'function' ? t.getOption('theme') : null);
    const fromTheme = parseCssColorToRgb01(theme?.background);
    if (fromTheme) return fromTheme;

    // Computed styles (works even when theme is applied via CSS).
    // Walk up the DOM tree so we don't get stuck on a transparent canvas.
    let el = t?.element || system?.terminalCanvas || document.getElementById('terminal') || document.body;
    while (el) {
      const bg = window.getComputedStyle(el).backgroundColor;
      const rgba = parseCssColorToRgba01(bg);
      if (rgba && rgba[3] > 0) return [rgba[0], rgba[1], rgba[2]];
      el = el.parentElement;
    }
  } catch {
    // ignore
  }

  return [0, 0, 0];
}

function computeLikelyBackgroundRgb01FromImageData(imageData) {
  try {
    if (!imageData || !imageData.data || !imageData.width || !imageData.height) return null;

    const w = imageData.width;
    const h = imageData.height;
    const d = imageData.data;

    const samplePoints = [
      [0, 0], [2, 2],
      [w - 1, 0], [Math.max(0, w - 3), 2],
      [0, h - 1], [2, Math.max(0, h - 3)],
      [w - 1, h - 1], [Math.max(0, w - 3), Math.max(0, h - 3)]
    ];

    const counts = new Map();
    let sumR = 0, sumG = 0, sumB = 0, n = 0;

    for (const [x0, y0] of samplePoints) {
      const x = Math.max(0, Math.min(w - 1, x0 | 0));
      const y = Math.max(0, Math.min(h - 1, y0 | 0));
      const idx = (y * w + x) * 4;
      const r = d[idx] | 0;
      const g = d[idx + 1] | 0;
      const b = d[idx + 2] | 0;
      const a = d[idx + 3] | 0;

      // Ignore fully transparent samples (shouldn't happen for the terminal canvas, but safe).
      if (a === 0) continue;

      sumR += r; sumG += g; sumB += b; n++;
      const key = `${r},${g},${b}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    if (n === 0) return null;

    // If a clear majority exists, use it; otherwise use the average of samples.
    let bestKey = null;
    let bestCount = 0;
    for (const [k, c] of counts.entries()) {
      if (c > bestCount) {
        bestCount = c;
        bestKey = k;
      }
    }

    if (bestKey && bestCount >= 2) {
      const [r, g, b] = bestKey.split(',').map(Number);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r / 255, g / 255, b / 255];
    }

    return [sumR / (255 * n), sumG / (255 * n), sumB / (255 * n)];
  } catch {
    return null;
  }
}

async function initWebGPUShaderSystem(shaderCodes) {
  console.log('[WebGPU Shaders] Initializing shader chain system');
  
  // Get terminal canvas and create WebGPU canvas
  const terminalCanvas = window.canvas || document.getElementById('terminal');
  if (!terminalCanvas) {
    console.error('[WebGPU Shaders] Terminal canvas not found');
    throw new Error('Terminal canvas not found');
  }
  
  // Check WebGPU availability
  if (!navigator.gpu || !window.webgpuBridge) {
    console.warn('[WebGPU Shaders] WebGPU not available');
    throw new Error('WebGPU not available');
  }
  
  try {
    // Ensure WebGPU bridge is initialized
    if (!window.webgpuBridge.initialized) {
      console.log('[WebGPU Shaders] Initializing WebGPU bridge...');
      await window.webgpuBridge.init();
    }
    
    const device = window.webgpuBridge.getDevice();
    if (!device) {
      console.error('[WebGPU Shaders] Failed to get WebGPU device');
      return initWebGLShaderSystem(shaderCodes);
    }
    
    // Get actual dimensions
    const width = terminalCanvas.width || 800;
    const height = terminalCanvas.height || 600;
    
    console.log('[WebGPU Shaders] Terminal dimensions:', width, 'x', height);
    
    // Create WebGPU canvas for shader output
    const webgpuCanvas = document.createElement('canvas');
    webgpuCanvas.id = 'terminal-webgpu';
    const dpr = window.devicePixelRatio || 1;
    webgpuCanvas.width = window.innerWidth * dpr;
    webgpuCanvas.height = window.innerHeight * dpr;
    webgpuCanvas.className = terminalCanvas.className;
    webgpuCanvas.style.position = 'absolute';
    webgpuCanvas.style.top = '0';
    webgpuCanvas.style.left = '0';
    webgpuCanvas.style.width = '100%';
    webgpuCanvas.style.height = '100%';
    webgpuCanvas.style.outline = 'none';
    webgpuCanvas.style.zIndex = '1'; // Explicitly above terminal
    webgpuCanvas.tabIndex = terminalCanvas.tabIndex || 0;
    
    // Keep terminal canvas visible but behind the WebGPU canvas
    // We need it visible to copy from it
    terminalCanvas.style.position = 'absolute';
    terminalCanvas.style.top = '0';
    terminalCanvas.style.left = '0';
    terminalCanvas.style.zIndex = '-1';
    terminalCanvas.style.pointerEvents = 'none';
    terminalCanvas.style.visibility = 'visible'; // Explicitly set visible for copying
    
    // Insert WebGPU canvas
    terminalCanvas.parentNode.insertBefore(webgpuCanvas, terminalCanvas.nextSibling);
    
    // Function to sync WebGPU canvas dimensions on window resize
    function syncWebGPUCanvasDimensions() {
      const dpr = window.devicePixelRatio || 1;
      const newWidth = window.innerWidth * dpr;
      const newHeight = window.innerHeight * dpr;
      
      // Only resize if dimensions actually changed
      if (webgpuCanvas.width !== newWidth || webgpuCanvas.height !== newHeight) {
        webgpuCanvas.width = newWidth;
        webgpuCanvas.height = newHeight;
        console.log('[WebGPU Shaders] Canvas resized to:', newWidth, 'x', newHeight);
      }
    }
    
    // Watch for window resize events
    window.addEventListener('resize', () => {
      requestAnimationFrame(syncWebGPUCanvasDimensions);
    });
    
    // ------------------------------------------------------------
    // Input forwarding + optional pointer remapping
    // ------------------------------------------------------------
    function clamp01(v) {
      return Math.max(0, Math.min(1, v));
    }

    function clientToUv(clientX, clientY, canvas) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return { x: 0.5, y: 0.5 };
      return {
        x: (clientX - rect.left) / rect.width,
        y: (clientY - rect.top) / rect.height
      };
    }

    function uvToClient(uv, canvas) {
      const rect = canvas.getBoundingClientRect();
      return {
        clientX: rect.left + uv.x * rect.width,
        clientY: rect.top + uv.y * rect.height
      };
    }

    function getLiveCellSize() {
      try {
        const system = window.shaderSystem;
        const t = window.terminal;
        if (t && t.cols && t.rows && system && system.terminalCanvas && system.terminalCanvas.width > 0 && system.terminalCanvas.height > 0) {
          return {
            x: system.terminalCanvas.width / t.cols,
            y: system.terminalCanvas.height / t.rows
          };
        }
        if (t && typeof t.charWidth === 'number' && typeof t.charHeight === 'number') {
          const dpr = window.devicePixelRatio || 1;
          return { x: t.charWidth * dpr, y: t.charHeight * dpr };
        }
      } catch {
        // ignore
      }
      return { x: 10, y: 20 };
    }

    function applyCoordinateTransform(transformName, uv, shaderUniforms, resolution) {
      if (!transformName) return { uv, inside: true };

      // Waver mapping: uv -> contentUV (matches docs/shaders/waver.wgsl.js)
      if (transformName === 'waver') {
        const t = Number(window.shaderSystem?.currentTime ?? window.shaderSystem?.lastTime ?? 0);
        // Prefer using the same time value the render loop uses, when available.
        // Fallback to performance-based seconds.
        const time = Number.isFinite(t) && t !== 0 ? t : (performance.now() - (window.shaderSystem?.startTime || performance.now())) / 1000;

        const resX = Math.max(1, Number(resolution?.x ?? resolution?.[0] ?? terminalCanvas.width ?? 1));
        const resY = Math.max(1, Number(resolution?.y ?? resolution?.[1] ?? terminalCanvas.height ?? 1));
        const minRes = Math.max(1, Math.min(resX, resY));

        const panPx = shaderUniforms?.panPx || shaderUniforms?.panPX || [0, 0];
        const tiltPx = shaderUniforms?.tiltPx || shaderUniforms?.tiltPX || [0, 0];
        const zoom = Number(shaderUniforms?.zoom ?? 1.1);
        const panSpeed = Number(shaderUniforms?.panSpeed ?? 0.22);
        const rollPx = Number(shaderUniforms?.rollPx ?? 1.0);
        const rollSpeed = Number(shaderUniforms?.rollSpeed ?? 0.14);
        const tiltSpeed = Number(shaderUniforms?.tiltSpeed ?? 0.11);
        const tiltWobble = Number(shaderUniforms?.tiltWobble ?? 0.35);
        const perspective = Math.max(0.2, Number(shaderUniforms?.perspective ?? 1.35));

        const panWaveX = Math.sin(time * panSpeed) + 0.35 * Math.sin(time * panSpeed * 0.41 + 1.7);
        const panWaveY = Math.sin(time * panSpeed * 0.91 + 0.8) + 0.35 * Math.sin(time * panSpeed * 0.33 + 2.3);
        const panUvX = (panWaveX * Number(panPx?.[0] ?? 0)) / resX;
        const panUvY = (panWaveY * Number(panPx?.[1] ?? 0)) / resY;

        const rollWave = Math.sin(time * rollSpeed) + 0.25 * Math.sin(time * rollSpeed * 0.37 + 0.9);
        const rollAngle = rollWave * (rollPx * 2.0 / minRes);
        const c = Math.cos(rollAngle);
        const s = Math.sin(rollAngle);

        const tiltWaveX = Math.sin(time * tiltSpeed + 1.1);
        const tiltWaveY = Math.sin(time * tiltSpeed * 0.83 + 2.4);
        const wobbleX = Math.sin(time * tiltSpeed * 1.77 + 0.2);
        const wobbleY = Math.sin(time * tiltSpeed * 1.53 + 1.9);
        const tiltX = (tiltWaveX + wobbleX * tiltWobble) * Number(tiltPx?.[0] ?? 0);
        const tiltY = (tiltWaveY + wobbleY * tiltWobble) * Number(tiltPx?.[1] ?? 0);
        const tiltAngleX = (tiltY * 2.0) / resY;
        const tiltAngleY = (tiltX * 2.0) / resX;

        // Apply the same mapping as WGSL: outputUV -> contentUV
        let px = uv.x - 0.5;
        let py = uv.y - 0.5;

        const z = Math.max(1e-6, zoom);
        px /= z;
        py /= z;

        px -= panUvX;
        py -= panUvY;

        // Roll
        const rx = c * px - s * py;
        const ry = s * px + c * py;
        px = rx;
        py = ry;

        // Tilt with perspective
        let vx = px;
        let vy = py;
        let vz = 1.0 / perspective;

        // rotateX
        {
          const cx = Math.cos(tiltAngleX);
          const sx = Math.sin(tiltAngleX);
          const ny = cx * vy - sx * vz;
          const nz = sx * vy + cx * vz;
          vy = ny;
          vz = nz;
        }

        // rotateY
        {
          const cy = Math.cos(tiltAngleY);
          const sy = Math.sin(tiltAngleY);
          const nx = cy * vx + sy * vz;
          const nz = -sy * vx + cy * vz;
          vx = nx;
          vz = nz;
        }

        const invZ = 1.0 / Math.max(0.2, vz);
        const contentX = vx * invZ + 0.5;
        const contentY = vy * invZ + 0.5;
        const inside = contentX >= 0 && contentX <= 1 && contentY >= 0 && contentY <= 1;

        return {
          uv: { x: clamp01(contentX), y: clamp01(contentY) },
          inside
        };
      }

      // CRT mapping: screen UV -> content UV (matches docs/shaders/crt.js + WGSL port)
      if (transformName === 'crt') {
        const curveStrength = Number(shaderUniforms?.curveStrength ?? 0);
        const frameSize = Number(shaderUniforms?.frameSize ?? 0);
        const resX = Math.max(1, Number(resolution?.x ?? resolution?.[0] ?? terminalCanvas.width ?? 1));

        const centerX = 0.5;
        const centerY = 0.5;
        const dx = uv.x - centerX;
        const dy = uv.y - centerY;
        const dist = Math.hypot(dx, dy);

        const warp = Math.pow(dist, 5) * curveStrength;
        const warpedX = uv.x + dx * warp;
        const warpedY = uv.y + dy * warp;

        const frame = frameSize / resX;
        const denom = Math.max(1e-6, 1 - 2 * frame);
        const contentX = (warpedX - frame) / denom;
        const contentY = (warpedY - frame) / denom;
        const inside = contentX >= 0 && contentX <= 1 && contentY >= 0 && contentY <= 1;

        return {
          uv: { x: clamp01(contentX), y: clamp01(contentY) },
          inside
        };
      }

      // Border mapping: uv -> contentUV (matches docs/shaders/wgsl/border.wgsl.js)
      // Interprets borderSize as "cells", converted to pixels via live cellSize.
      if (transformName === 'border') {
        const borderCells = Number(shaderUniforms?.borderSize ?? 0);
        const cell = getLiveCellSize();

        const resX = Math.max(1, Number(resolution?.x ?? resolution?.[0] ?? terminalCanvas.width ?? 1));
        const resY = Math.max(1, Number(resolution?.y ?? resolution?.[1] ?? terminalCanvas.height ?? 1));

        const cellPx = Math.max(0, Math.min(cell.x, cell.y));
        const borderPx = Math.max(0, borderCells) * cellPx;
        const borderX = borderPx / resX;
        const borderY = borderPx / resY;

        const inside = uv.x >= borderX && uv.x <= (1 - borderX) && uv.y >= borderY && uv.y <= (1 - borderY);
        const denomX = Math.max(1e-6, 1 - 2 * borderX);
        const denomY = Math.max(1e-6, 1 - 2 * borderY);
        const contentX = (uv.x - borderX) / denomX;
        const contentY = (uv.y - borderY) / denomY;

        return {
          uv: { x: clamp01(contentX), y: clamp01(contentY) },
          inside
        };
      }

      return { uv, inside: true };
    }

    function getPointerTransformChain() {
      const system = window.shaderSystem;
      if (!system || system.backend !== 'webgpu' || !Array.isArray(system.pipelines)) return null;

      // Compose transforms from last -> first. Each transform maps output-UV back to input-UV.
      const chain = [];
      for (let i = system.pipelines.length - 1; i >= 0; i--) {
        const p = system.pipelines[i];
        if (p && p.coordinateTransform) chain.push(p);
      }
      return chain.length ? chain : null;
    }

    function buildForwardedEvent(originalEvent, mappedClientX, mappedClientY) {
      const common = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: mappedClientX,
        clientY: mappedClientY,
        screenX: originalEvent.screenX,
        screenY: originalEvent.screenY,
        ctrlKey: originalEvent.ctrlKey,
        shiftKey: originalEvent.shiftKey,
        altKey: originalEvent.altKey,
        metaKey: originalEvent.metaKey,
        button: originalEvent.button,
        buttons: originalEvent.buttons,
        detail: originalEvent.detail
      };

      if (originalEvent.type === 'wheel') {
        return new WheelEvent('wheel', {
          ...common,
          deltaX: originalEvent.deltaX,
          deltaY: originalEvent.deltaY,
          deltaZ: originalEvent.deltaZ,
          deltaMode: originalEvent.deltaMode
        });
      }

      return new MouseEvent(originalEvent.type, common);
    }

    function forwardEventToTerminal(e) {
      // Keep a pointer state for uniforms/debug
      if (e.type === 'mousemove' || e.type === 'mousedown' || e.type === 'mouseup' || e.type === 'click') {
        window.__shaderPointer = { clientX: e.clientX, clientY: e.clientY };
      }

      if (e.type === 'contextmenu') {
        e.preventDefault();
      }

      // Keyboard events can be forwarded verbatim
      if (e.type === 'keydown' || e.type === 'keyup' || e.type === 'keypress') {
        terminalCanvas.dispatchEvent(new e.constructor(e.type, e));
        return;
      }

      const chain = getPointerTransformChain();
      if (!chain) {
        terminalCanvas.dispatchEvent(new e.constructor(e.type, e));
        return;
      }

      let uv = clientToUv(e.clientX, e.clientY, webgpuCanvas);
      let inside = true;

      for (const p of chain) {
        const mapped = applyCoordinateTransform(
          p.coordinateTransform,
          uv,
          p.uniforms,
          { x: terminalCanvas.width, y: terminalCanvas.height }
        );
        uv = mapped.uv;
        inside = inside && mapped.inside;
      }

      // If click happens outside any mapped content region, swallow it to avoid mis-clicks
      if (!inside && e.type !== 'mousemove' && e.type !== 'wheel') return;

      const client = uvToClient(uv, terminalCanvas);
      terminalCanvas.dispatchEvent(buildForwardedEvent(e, client.clientX, client.clientY));
    }

    ['keydown', 'keyup', 'keypress', 'mousedown', 'mouseup', 'mousemove', 'click', 'wheel', 'contextmenu'].forEach(eventType => {
      webgpuCanvas.addEventListener(eventType, forwardEventToTerminal);
    });
    
    // Get WebGPU context
    const context = webgpuCanvas.getContext('webgpu');
    if (!context) {
      console.error('[WebGPU Shaders] Failed to get WebGPU context');
      throw new Error('No WebGPU context');
    }
    
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied',
    });
    
    console.log('[WebGPU Shaders] Canvas format:', format);
    
    // Compile shader pipelines
    const shaderPipelines = [];
    
    for (let i = 0; i < shaderCodes.length; i++) {
      const shader = shaderCodes[i];
      console.log('[WebGPU Shaders] Compiling', (i + 1), '/', shaderCodes.length, ':', shader.name);
      
      try {
        // Eval shader code to get config
        const getShaderConfig = (function() {
          eval(shader.content);
          if (typeof getShaderConfig !== 'function') {
            throw new Error('Shader must export getShaderConfig()');
          }
          return getShaderConfig();
        })();
        
        // Create WGSL shader module
        const shaderModule = device.createShaderModule({
          label: shader.name,
          code: getShaderConfig.vertexShader + '\n' + getShaderConfig.fragmentShader
        });
        
        // Check if shader has @group(0) bindings by looking for @group in the shader code
        const fullShaderCode = getShaderConfig.vertexShader + '\n' + getShaderConfig.fragmentShader;
        const hasBindings = fullShaderCode.includes('@group(0)');
        
        // Check if shader uses binding(2) for uniforms
        const usesUniformsBuffer = /\@binding\(2\)/.test(fullShaderCode);
        
        // Check for compilation errors
        const info = await shaderModule.getCompilationInfo();
        const errors = info.messages.filter(m => m.type === 'error');
        if (errors.length > 0) {
          console.error('[WebGPU Shaders] Compilation errors in', shader.name + ':', errors);
          throw new Error('Shader compilation failed: ' + shader.name);
        }
        
        // Create render pipeline
        const pipeline = device.createRenderPipeline({
          label: shader.name + '_pipeline',
          layout: 'auto',
          vertex: {
            module: shaderModule,
            entryPoint: 'vertexMain',
            buffers: [{
              arrayStride: 8, // 2 floats * 4 bytes
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
              format: format
            }]
          },
          primitive: {
            topology: 'triangle-list'
          }
        });
        
        shaderPipelines.push({
          name: shader.name,
          pipeline: pipeline,
          module: shaderModule,
          uniforms: getShaderConfig.uniforms || {},
          hasBindings: hasBindings,
          usesUniformsBuffer: usesUniformsBuffer,
          // Optional coordinate mapping used for pointer correction.
          // Defaults CRT shader to 'crt' so curved monitor effects remain interactive.
          coordinateTransform: getShaderConfig.coordinateTransform || (shader.name === 'crt' ? 'crt' : null)
        });
        
        console.log('[WebGPU Shaders] ✓ Compiled:', shader.name);
        
      } catch (error) {
        console.error('[WebGPU Shaders] Failed to compile', shader.name + ':', error);
        throw error;
      }
    }
    
    console.log('[WebGPU Shaders] Successfully compiled', shaderPipelines.length, 'pipeline(s)');
    
    // Create fullscreen quad vertex buffer
    const vertices = new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1
    ]);
    
    const vertexBuffer = device.createBuffer({
      label: 'fullscreen_quad',
      size: vertices.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(vertexBuffer, 0, vertices);
    
    // Create textures for intermediate passes
    const intermediateTextures = [];
    for (let i = 0; i < shaderPipelines.length - 1; i++) {
      const texture = device.createTexture({
        label: `intermediate_${i}`,
        size: [webgpuCanvas.width, webgpuCanvas.height],
        format: format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING
      });
      intermediateTextures.push(texture);
    }
    
    // Create sampler
    const sampler = device.createSampler({
      magFilter: 'linear',
      minFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });
    
    // Create per-shader uniform buffers (each shader gets its own buffer)
    const shaderUniformBuffers = [];
    for (let i = 0; i < shaderPipelines.length; i++) {
      const shader = shaderPipelines[i];
      if (shader.usesUniformsBuffer) {
        const buffer = device.createBuffer({
          label: `uniforms_${shader.name}`,
          size: 256, // Enough for time, resolution, and custom shader uniforms
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        shaderUniformBuffers.push(buffer);
      } else {
        shaderUniformBuffers.push(null); // No buffer for shaders without uniforms
      }
    }
    
    // Create persistent terminal texture for canvas copy
    const terminalTexture = device.createTexture({
      label: 'terminal_input',
      size: [terminalCanvas.width, terminalCanvas.height],
      format: 'rgba8unorm', // Use rgba8unorm for ImageBitmap compatibility
      usage: GPUTextureUsage.TEXTURE_BINDING | 
             GPUTextureUsage.COPY_DST | 
             GPUTextureUsage.RENDER_ATTACHMENT
    });
    
    console.log('[WebGPU Shaders] Created terminal texture:', terminalCanvas.width + 'x' + terminalCanvas.height);
    
    // Store shader system globally
    window.shaderSystem = {
      backend: 'webgpu',
      device: device,
      context: context,
      canvas: webgpuCanvas,
      terminalCanvas: terminalCanvas,
      terminalTexture: terminalTexture,
      pipelines: shaderPipelines,
      vertexBuffer: vertexBuffer,
      intermediateTextures: intermediateTextures,
      sampler: sampler,
      shaderUniformBuffers: shaderUniformBuffers, // Per-shader uniform buffers
      format: format,
      startTime: performance.now(),
      frameCount: 0,
      render: renderWebGPUShaderChain
    };
    
    window.terminalCanvas = terminalCanvas;
    
    console.log('[WebGPU Shaders] Shader chain initialized:', 
                shaderPipelines.map(p => p.name).join(' → '));
    
    // Instead of independent render loop, hook into terminal's render cycle
    // This eliminates flickering by ensuring shader system only samples fully rendered frames
    let renderRequested = false;
    
    window.shaderSystem.onTerminalRenderComplete = function() {
      if (!renderRequested) {
        renderRequested = true;
        // Use setImmediate-like behavior via Promise microtask
        Promise.resolve().then(async () => {
          renderRequested = false;
          await renderWebGPUShaderChain();
        });
      }
    };
    
    console.log('[WebGPU Shaders] Synchronized with terminal render loop');
    console.log('[WebGPU Shaders] Render loop started');
    console.log('[WebGPU Shaders] WebGPU canvas:', webgpuCanvas.id, webgpuCanvas.width + 'x' + webgpuCanvas.height);
    console.log('[WebGPU Shaders] Terminal canvas:', terminalCanvas.id, terminalCanvas.width + 'x' + terminalCanvas.height);
    
  } catch (error) {
    console.error('[WebGPU Shaders] Initialization failed:', error);
    console.log('[WebGPU Shaders] WebGPU shaders not available - page needs to reload WebGL shaders');
    throw error; // Let caller handle fallback by reloading appropriate shaders
  }
}

function renderWebGPUShaderChain() {
  return (async function() {
    try {
    const system = window.shaderSystem;
    if (!system || system.backend !== 'webgpu') return;
    
    try {
      const device = system.device;
      const context = system.context;
      const terminalCanvas = system.terminalCanvas;
      
      // Check if terminal canvas size changed - recreate texture if needed
      if (system.terminalTexture.width !== terminalCanvas.width || 
          system.terminalTexture.height !== terminalCanvas.height) {
        console.log('[WebGPU Shaders] Terminal canvas resized:', 
                    system.terminalTexture.width + 'x' + system.terminalTexture.height,
                    '→', terminalCanvas.width + 'x' + terminalCanvas.height);
        
        // Recreate terminal texture with new dimensions
        system.terminalTexture.destroy();
        system.terminalTexture = device.createTexture({
          label: 'terminal_input',
          size: [terminalCanvas.width, terminalCanvas.height],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | 
                 GPUTextureUsage.COPY_DST | 
                 GPUTextureUsage.RENDER_ATTACHMENT
        });
      }
    
    // Only log first frame to avoid spam
    if (system.frameCount === 0) {
      console.log('[WebGPU Shaders] First frame render starting...');
    }
    
    // Get texture references from system (terminalCanvas already declared above)
    const terminalTexture = system.terminalTexture;
    
    if (system.frameCount === 0) {
      console.log('[WebGPU Shaders] Terminal canvas:', terminalCanvas.width, 'x', terminalCanvas.height);
    }
    
    // Check if terminal has content
    if (terminalCanvas.width === 0 || terminalCanvas.height === 0) {
      console.warn('[WebGPU Shaders] Terminal canvas has zero dimensions, skipping frame');
      return; // Skip this frame, render loop will retry
    }
    
    // Copy terminal canvas to texture (only needed for shaders with bindings)
    const needsTerminalInput = system.pipelines.some(p => p.hasBindings);
    
    if (needsTerminalInput) {
      if (system.frameCount === 0) {
        console.log('[WebGPU Shaders] Copying terminal canvas (shader chain uses bindings)...');
      }
      
      try {
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Using writeTexture method (avoids copyExternalImageToTexture crash)...');
        }
        
        // Alternative approach: get pixel data from canvas and write to texture
        // This avoids the copyExternalImageToTexture GPU driver crash
        const ctx2d = document.createElement('canvas').getContext('2d');
        const tempCanvas = ctx2d.canvas;
        tempCanvas.width = terminalCanvas.width;
        tempCanvas.height = terminalCanvas.height;
        ctx2d.drawImage(terminalCanvas, 0, 0);
        
        const imageData = ctx2d.getImageData(0, 0, terminalCanvas.width, terminalCanvas.height);

        // Cache a best-effort background color derived from the actual rendered pixels.
        // This is more reliable than reading theme objects/CSS when themeing is applied in WASM.
        const bgRgb01 = computeLikelyBackgroundRgb01FromImageData(imageData);
        if (bgRgb01) {
          system.liveThemeBackgroundRgb01 = bgRgb01;
          if (system.frameCount === 0) {
            console.log('[WebGPU Shaders] Live background (from pixels):', bgRgb01);
          }
        }
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Got image data:', imageData.width + 'x' + imageData.height);
          console.log('[WebGPU Shaders] Writing to texture...');
        }
        
        device.queue.writeTexture(
          { texture: terminalTexture },
          imageData.data,
          { 
            offset: 0,
            bytesPerRow: terminalCanvas.width * 4,
            rowsPerImage: terminalCanvas.height
          },
          {
            width: terminalCanvas.width,
            height: terminalCanvas.height,
            depthOrArrayLayers: 1
          }
        );
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] ✓ Terminal canvas copied successfully via writeTexture');
        }
      } catch (e) {
        console.error('[WebGPU Shaders] Failed to copy terminal canvas:', e);
        return;
      }
    } else {
      if (system.frameCount === 0) {
        console.log('[WebGPU Shaders] Skipping canvas copy (no shaders use bindings)');
      }
    }
    
    if (system.frameCount === 0) {
      console.log('[WebGPU Shaders] Creating command encoder...');
    }
    
    const encoder = device.createCommandEncoder();
    
    if (system.frameCount === 0) {
      console.log('[WebGPU Shaders] Command encoder created');
    }
    
    // Update uniforms for each shader that needs them
    const currentTime = (performance.now() - system.startTime) / 1000.0;
    system.lastTime = currentTime;
    
    for (let i = 0; i < system.pipelines.length; i++) {
      const shader = system.pipelines[i];
      const uniformBuffer = system.shaderUniformBuffers[i];
      
      if (!uniformBuffer) continue; // Skip shaders without uniforms
      
      // Build uniform array for this specific shader
      const uniformArray = [
        currentTime,                      // time (f32)
        0, 0, 0,                          // padding
        system.terminalCanvas.width,      // resolution.x - terminal canvas size for pixel-accurate cell-aligned shaders
        system.terminalCanvas.height,     // resolution.y
        0, 0                              // padding after resolution
      ];
      
      // Add this shader's custom uniforms in the order they appear in the uniforms object
      // JavaScript object iteration order is insertion order (ES2015+)
      const uniformNames = Object.keys(shader.uniforms);
      
      for (const name of uniformNames) {
        let value = shader.uniforms[name];
        
        // Special handling for cellSize - get live values from terminal (with DPR scaling)
        if (name === 'cellSize' && window.terminal) {
          const t = window.terminal;
          // Prefer deriving cell size from the *actual* terminal canvas pixel grid.
          // This avoids accumulating drift if canvas.width/height were rounded.
          if (t.cols && t.rows && system.terminalCanvas && system.terminalCanvas.width > 0 && system.terminalCanvas.height > 0) {
            value = [
              system.terminalCanvas.width / t.cols,
              system.terminalCanvas.height / t.rows
            ];
          } else {
            const dpr = window.devicePixelRatio || 1;
            value = [t.charWidth * dpr, t.charHeight * dpr];
          }
          
          if (system.frameCount === 0) {
            console.log(`[WebGPU Shaders] ${shader.name} cellSize:`, value, 'terminal:', t.cols + 'x' + t.rows, 'canvas:', system.terminalCanvas.width + 'x' + system.terminalCanvas.height);
          }
        }

        // Special handling for backgroundColor: optionally pull from active theme.
        // Opt-in by setting backgroundColor to 'theme' (or null) in the shader config.
        if (name === 'backgroundColor' && (value === 'theme' || value === null)) {
          value = getLiveThemeBackgroundRgb01(system);
        }
        
        if (system.frameCount === 0 && name !== 'cellSize') {
          console.log(`[WebGPU Shaders] ${shader.name} uniform ${name}:`, value);
        }
        
        if (typeof value === 'number') {
          uniformArray.push(value);
          // Don't pad individual numbers - let them pack naturally
        } else if (Array.isArray(value)) {
          if (value.length === 2) {
            uniformArray.push(value[0], value[1]);
            // vec2 - add 2 padding floats to reach vec4 alignment
            uniformArray.push(0, 0);
          } else if (value.length === 3) {
            uniformArray.push(value[0], value[1], value[2]);
            // vec3 - add 1 padding float to reach vec4 alignment
            uniformArray.push(0);
          } else if (value.length === 4) {
            uniformArray.push(value[0], value[1], value[2], value[3]);
          }
        } else if (typeof value === 'string') {
          // Support simple keyword uniforms (currently only backgroundColor: 'theme')
          if (name === 'backgroundColor' && value === 'theme') {
            const rgb = getLiveThemeBackgroundRgb01(system);
            uniformArray.push(rgb[0], rgb[1], rgb[2]);
            uniformArray.push(0);
          }
        }
      }
      
      // Pad the final array to vec4 alignment
      while (uniformArray.length % 4 !== 0) {
        uniformArray.push(0);
      }
      
      const uniformData = new Float32Array(uniformArray);
      
      if (system.frameCount === 0) {
        console.log(`[WebGPU Shaders] ${shader.name} uniform buffer (${uniformData.length} floats):`, Array.from(uniformData));
      }
      
      device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    }
    
    // Render shader chain
    let inputTexture = terminalTexture;
    
    if (system.frameCount === 0) {
      console.log('[WebGPU Shaders] Starting shader chain with', system.pipelines.length, 'shader(s)');
    }
    
    for (let i = 0; i < system.pipelines.length; i++) {
      const shader = system.pipelines[i];
      const isLastShader = i === system.pipelines.length - 1;
      
      if (system.frameCount === 0) {
        console.log('[WebGPU Shaders] Rendering shader', i, ':', shader.name);
        console.log('[WebGPU Shaders] Is last shader?', isLastShader);
      }
      
      let outputTexture;
      let renderPass;
      try {
        outputTexture = isLastShader ? 
          context.getCurrentTexture() : 
          system.intermediateTextures[i];
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Creating render pass...');
        }
        
        renderPass = encoder.beginRenderPass({
          colorAttachments: [{
            view: outputTexture.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
          }],
        });
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Setting pipeline...');
        }
        renderPass.setPipeline(shader.pipeline);
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Setting vertex buffer...');
        }
        renderPass.setVertexBuffer(0, system.vertexBuffer);
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Checking for bindings...');
        }
        
        // Only create and set bind group if shader actually has bindings
        if (shader.hasBindings) {
          try {
            const bindGroupLayout = shader.pipeline.getBindGroupLayout(0);
            
            if (system.frameCount === 0) {
              console.log('[WebGPU Shaders] Creating bind group for', shader.name);
            }
            
            // Create bind group with correct number of bindings
            let entries;
            if (shader.usesUniformsBuffer) {
              // Shader needs all 3 bindings - use per-shader uniform buffer
              const uniformBuffer = system.shaderUniformBuffers[i];
              entries = [
                { binding: 0, resource: inputTexture.createView() },
                { binding: 1, resource: system.sampler },
                { binding: 2, resource: { buffer: uniformBuffer } }
              ];
            } else {
              // Shader only needs texture and sampler
              entries = [
                { binding: 0, resource: inputTexture.createView() },
                { binding: 1, resource: system.sampler }
              ];
            }
            
            const bindGroup = device.createBindGroup({
              layout: bindGroupLayout,
              entries: entries
            });
            
            if (system.frameCount === 0) {
              console.log('[WebGPU Shaders] Bind group created with', entries.length, 'bindings');
            }
            
            renderPass.setBindGroup(0, bindGroup);
          } catch (e) {
            console.error('[WebGPU Shaders] Failed to create bind group:', e);
          }
        } else {
          if (system.frameCount === 0) {
            console.log('[WebGPU Shaders] Shader', shader.name, 'has no bindings');
          }
        }
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Issuing draw call...');
        }
        renderPass.draw(6, 1, 0, 0);
        
        if (system.frameCount === 0) {
          console.log('[WebGPU Shaders] Draw call completed');
        }
      } catch (e) {
        console.error('[WebGPU Shaders] Render pass failed for', shader.name + ':', e);
        throw e;
      } finally {
        if (renderPass) {
          if (system.frameCount === 0) {
            console.log('[WebGPU Shaders] Ending render pass...');
          }
          renderPass.end();
        }
      }
      
      // Output becomes input for next shader
      inputTexture = outputTexture;
    }
    
    device.queue.submit([encoder.finish()]);
    system.frameCount++;
    
  } catch (error) {
    console.error('[WebGPU Shaders] Render error:', error);
    console.error('[WebGPU Shaders] Error stack:', error.stack);
  }
  } catch (outerError) {
    console.error('[WebGPU Shaders] Fatal render error:', outerError);
    console.error('[WebGPU Shaders] Fatal error stack:', outerError.stack);
  }
  })();
}

// Export for use in HTML
window.initWebGPUShaderSystem = initWebGPUShaderSystem;
window.renderWebGPUShaderChain = renderWebGPUShaderChain;
