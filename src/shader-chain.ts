/**
 * Shader Chain Manager - Compose multiple shaders for multi-pass effects
 * 
 * Implements the tstorie shader chain pattern where multiple shaders
 * can be chained together (e.g., "invert+paper+scanlines").
 * 
 * This complements WGSL code blocks by allowing:
 * - WGSL blocks: Define new shaders
 * - Shader chains: Compose existing shaders
 */

import type { ShaderManager } from './shader-manager.js';
import type { WGSLShader } from './types.js';

function resolveBuiltinShaderBaseUrl(baseUrl?: string): string {
  const raw = String(baseUrl ?? '').trim();
  const u = raw
    ? new URL(/* @vite-ignore */ raw, import.meta.url)
    : new URL(/* @vite-ignore */ './shaders/', import.meta.url);
  const s = u.toString();
  return s.endsWith('/') ? s : `${s}/`;
}

export interface ShaderChainConfig {
  /** Names of shaders in the chain (applied left to right) */
  shaderNames: string[];
  
  /** Source of the chain (frontmatter, url, api) */
  source: 'frontmatter' | 'url' | 'api';
}

/**
 * Manages multi-pass shader chains, inspired by tstorie's shader system
 */
export class ShaderChainManager {
  private shaderManager: ShaderManager;
  private device: GPUDevice;
  private format: GPUTextureFormat;
  
  // Active chain
  private activeChain: string[] = [];
  private chainSource: string = 'none';
  
  // Intermediate textures for multi-pass rendering
  private intermediateTextures: GPUTexture[] = [];

  // WGSL include cache (URL -> resolved text)
  private includeCache: Map<string, string> = new Map();
  
  // Constants
  private readonly MAX_CHAIN_LENGTH = 8;
  private readonly SUPPORTED_SEPARATORS = ['+', ';', ',', '|'];

  constructor(shaderManager: ShaderManager, device: GPUDevice, format?: GPUTextureFormat) {
    this.shaderManager = shaderManager;
    this.device = device;
    this.format = format || navigator.gpu.getPreferredCanvasFormat();
  }

  /**
   * Parse a shader chain string into an array of shader names
   * Supports separators: + ; , |
   * Examples:
   *   "invert+paper+scanlines"
   *   "bloom;crt;vignette"
   *   "custom,invert,blur"
   */
  parseChainString(chainStr: string): string[] {
    if (!chainStr || chainStr.trim().length === 0) {
      return [];
    }
    
    const trimmed = chainStr.trim();
    
    // Try each separator
    for (const separator of this.SUPPORTED_SEPARATORS) {
      if (trimmed.includes(separator)) {
        return trimmed
          .split(separator)
          .map(s => s.trim())
          .filter(s => s.length > 0);
      }
    }
    
    // No separator found, treat as single shader
    return [trimmed];
  }

  /**
   * Activate a shader chain from an array of shader names
   */
  async activateChain(shaderNames: string[], source: string = 'api'): Promise<boolean> {
    if (!shaderNames || shaderNames.length === 0) {
      console.log('[ShaderChain] Clearing chain');
      this.clearChain();
      return true;
    }
    
    // Validate and truncate if too long
    if (shaderNames.length > this.MAX_CHAIN_LENGTH) {
      console.warn(
        `[ShaderChain] Chain too long (${shaderNames.length} shaders), ` +
        `truncating to ${this.MAX_CHAIN_LENGTH}`
      );
      shaderNames = shaderNames.slice(0, this.MAX_CHAIN_LENGTH);
    }
    
    console.log(`[ShaderChain] Activating chain (${source}): ${shaderNames.join(' → ')}`);
    
    // Load any missing built-in shaders
    for (const name of shaderNames) {
      if (!this.shaderManager.hasShader(name)) {
        console.log(`[ShaderChain] Loading built-in shader: ${name}`);
        try {
          await this.loadBuiltinShader(name);
        } catch (error) {
          console.warn(`[ShaderChain] Failed to load shader "${name}":`, error);
        }
      }
    }
    
    // Validate each shader exists (after loading attempts)
    const validShaders: string[] = [];
    const missingShaders: string[] = [];
    
    for (const name of shaderNames) {
      if (this.shaderManager.hasShader(name)) {
        validShaders.push(name);
      } else {
        console.warn(`[ShaderChain] Shader not available: ${name}`);
        missingShaders.push(name);
      }
    }
    
    if (validShaders.length === 0) {
      console.error('[ShaderChain] No valid shaders in chain');
      return false;
    }
    
    if (missingShaders.length > 0) {
      console.warn(
        `[ShaderChain] ${missingShaders.length} shader(s) not found: ${missingShaders.join(', ')}\n` +
        `[ShaderChain] Using ${validShaders.length} valid shader(s): ${validShaders.join(', ')}`
      );
    }
    
    this.activeChain = validShaders;
    this.chainSource = source;
    
    console.log(`[ShaderChain] ✓ Active chain: ${validShaders.join(' → ')}`);
    return true;
  }

  /**
   * Activate a chain from a chain string (frontmatter or URL format)
   */
  async activateChainFromString(chainStr: string, source: string = 'api'): Promise<boolean> {
    const shaderNames = this.parseChainString(chainStr);
    return this.activateChain(shaderNames, source);
  }

  /**
   * Clear the active chain
   */
  clearChain(): void {
    this.activeChain = [];
    this.chainSource = 'none';
    this.releaseIntermediateTextures();
  }

  /**
   * Load a built-in shader from the shader library
   * Attempts to load from ./shaders/{name}.wgsl.js
   */
  private async loadBuiltinShader(name: string): Promise<void> {
    try {
      // Load the shader module via fetch (these files use plain functions, not ES6 modules)
      const baseUrl = resolveBuiltinShaderBaseUrl();
      const shaderPath = new URL(`${name}.wgsl.js`, baseUrl).toString();
      console.log(`[ShaderChain] Loading: ${shaderPath}`);
      
      const response = await fetch(shaderPath);
      if (!response.ok) {
        throw new Error(`Failed to fetch shader: ${response.status} ${response.statusText}`);
      }
      
      const shaderCode = await response.text();

      if (!/\bgetShaderConfig\b/.test(shaderCode)) {
        const preview = shaderCode.slice(0, 200).replace(/\s+/g, ' ');
        throw new Error(`Fetched content does not look like a shader module (missing getShaderConfig). Preview: ${preview}`);
      }
      
      // Evaluate the shader code to get the getShaderConfig function
      // The shader files define: function getShaderConfig() { ... }
      const evalFunc = new Function(shaderCode + '\nreturn getShaderConfig();');
      const config = evalFunc();
      
      if (!config || !config.vertexShader || !config.fragmentShader) {
        throw new Error('Shader config must include vertexShader and fragmentShader');
      }
      
      // Convert shader config to WGSLShader format
      // The combined code includes both vertex and fragment shaders
      const combinedCodeRaw = config.vertexShader + '\n' + config.fragmentShader;
      const combinedCode = await this.resolveWgslIncludes(combinedCodeRaw, baseUrl);
      
      // Parse uniforms from the shader config or extract from code
      const uniformNames: string[] = config.uniforms ? Object.keys(config.uniforms) : [];
      
      const wglsShader: WGSLShader = {
        name,
        code: combinedCode,
        kind: 'fragment',
        uniforms: uniformNames,
        bindings: [],
        workgroupSize: [1, 1, 1]  // Default for fragment shaders (not used)
      };
      
      // Register with ShaderManager
      await this.shaderManager.registerShader(wglsShader);
      
      // Set default uniform values from the shader config
      if (config.uniforms) {
        for (const [uniformName, defaultValue] of Object.entries(config.uniforms)) {
          this.shaderManager.setUniform(name, uniformName, defaultValue as number | number[]);
        }
      }
      
      console.log(`[ShaderChain] ✓ Loaded built-in shader: ${name}`);
    } catch (error) {
      console.error(`[ShaderChain] Failed to load built-in shader "${name}":`, error);
      throw error;
    }
  }

  private async resolveWgslIncludes(code: string, baseUrl: string): Promise<string> {
    // WGSL `#include` preprocessor. This is intentionally minimal:
    // - Only supports: #include "relative/path.wgsl"
    // - Resolves relative to `baseUrl` (typically "./shaders/")
    // - Recursively resolves nested includes
    // - Detects cycles
    const includeRe = /^\s*#include\s+"([^"]+)"\s*$/gm;

    const resolveOne = async (src: string, seen: Set<string>): Promise<string> => {
      const matches = Array.from(src.matchAll(includeRe));
      if (matches.length === 0) return src;

      let out = '';
      let lastIndex = 0;
      for (const m of matches) {
        const fullMatch = m[0];
        const includePath = m[1];
        const index = m.index ?? 0;

        out += src.slice(lastIndex, index);
        lastIndex = index + fullMatch.length;

        // Security/sanity: only allow relative includes.
        if (includePath.startsWith('/') || includePath.includes('://')) {
          throw new Error(`[ShaderChain] Unsupported #include path: ${includePath}`);
        }

        const base = resolveBuiltinShaderBaseUrl(baseUrl);
        const url = new URL(includePath, base).toString();

        if (seen.has(url)) {
          throw new Error(`[ShaderChain] #include cycle detected: ${url}`);
        }

        let text = this.includeCache.get(url);
        if (text === undefined) {
          const resp = await fetch(url);
          if (!resp.ok) {
            throw new Error(`[ShaderChain] Failed to fetch #include: ${url} (${resp.status} ${resp.statusText})`);
          }
          text = await resp.text();
          this.includeCache.set(url, text);
        }

        const nestedSeen = new Set(seen);
        nestedSeen.add(url);
        const resolved = await resolveOne(text, nestedSeen);
        out += `\n// begin include: ${includePath}\n${resolved}\n// end include: ${includePath}\n`;
      }

      out += src.slice(lastIndex);
      // There could be includes introduced by previous substitutions.
      return resolveOne(out, seen);
    };

    return resolveOne(code, new Set());
  }

  /**
   * Check if there's an active chain
   */
  hasActiveChain(): boolean {
    return this.activeChain.length > 0;
  }

  /**
   * Get the active chain
   */
  getActiveChain(): string[] {
    return [...this.activeChain];
  }

  /**
   * Get the source of the active chain
   */
  getChainSource(): string {
    return this.chainSource;
  }

  /**
   * Apply the shader chain to an input texture, writing to output texture
   * 
   * This performs multi-pass rendering:
   * 1. First shader: inputTexture → intermediate1
   * 2. Second shader: intermediate1 → intermediate2
   * 3. ...
   * N. Last shader: intermediateN-1 → outputTexture
   */
  applyChain(
    inputTexture: GPUTexture,
    outputTexture: GPUTexture,
    commandEncoder: GPUCommandEncoder
  ): boolean {
    if (this.activeChain.length === 0) {
      return false; // No chain active
    }
    
    // Single shader - simple pass-through
    if (this.activeChain.length === 1) {
      this.shaderManager.setActiveShader(this.activeChain[0]);
      return this.shaderManager.applyShader(inputTexture, outputTexture, commandEncoder);
    }
    
    // Multi-pass rendering
    // Ensure we have enough intermediate textures
    this.ensureIntermediateTextures(
      this.activeChain.length - 1,
      inputTexture.width,
      inputTexture.height
    );
    
    let currentInput = inputTexture;
    
    for (let i = 0; i < this.activeChain.length; i++) {
      const shaderName = this.activeChain[i];
      const isLast = (i === this.activeChain.length - 1);
      
      // Determine output texture for this pass
      const currentOutput = isLast ? outputTexture : this.intermediateTextures[i];
      
      // Apply this shader
      this.shaderManager.setActiveShader(shaderName);
      const success = this.shaderManager.applyShader(
        currentInput,
        currentOutput,
        commandEncoder
      );
      
      if (!success) {
        console.error(`[ShaderChain] Failed to apply shader: ${shaderName}`);
        return false;
      }
      
      // Next input is this output
      currentInput = currentOutput;
    }
    
    return true;
  }

  /**
   * Ensure we have enough intermediate textures for the chain
   */
  private ensureIntermediateTextures(count: number, width: number, height: number): void {
    // Release existing textures if size changed
    if (this.intermediateTextures.length > 0) {
      const firstTexture = this.intermediateTextures[0];
      if (firstTexture.width !== width || firstTexture.height !== height) {
        this.releaseIntermediateTextures();
      }
    }
    
    // Create new textures if needed
    while (this.intermediateTextures.length < count) {
      const texture = this.device.createTexture({
        size: { width, height },
        format: this.format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        label: `ShaderChain_Intermediate_${this.intermediateTextures.length}`
      });
      
      this.intermediateTextures.push(texture);
    }
    
    // Release extra textures if we have too many
    while (this.intermediateTextures.length > count) {
      const texture = this.intermediateTextures.pop();
      texture?.destroy();
    }
  }

  /**
   * Release all intermediate textures
   */
  private releaseIntermediateTextures(): void {
    for (const texture of this.intermediateTextures) {
      texture.destroy();
    }
    this.intermediateTextures = [];
  }

  /**
   * Get info about the current chain for debugging
   */
  getChainInfo(): object {
    return {
      active: this.activeChain.length > 0,
      count: this.activeChain.length,
      shaders: this.activeChain,
      source: this.chainSource,
      intermediateTextures: this.intermediateTextures.length
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.releaseIntermediateTextures();
    this.activeChain = [];
  }
}
