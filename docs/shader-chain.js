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
function resolveBuiltinShaderBaseUrl(baseUrl) {
    const raw = String(baseUrl ?? '').trim();
    const u = raw
        ? new URL(/* @vite-ignore */ raw, import.meta.url)
        : new URL(/* @vite-ignore */ './shaders/', import.meta.url);
    const s = u.toString();
    return s.endsWith('/') ? s : `${s}/`;
}
/**
 * Manages multi-pass shader chains, inspired by tstorie's shader system
 */
export class ShaderChainManager {
    shaderManager;
    device;
    format;
    // Active chain
    activeChain = [];
    chainSource = 'none';
    // Background shader — runs before the main chain, independent of setChain().
    // Use setBackground(name) to apply a persistent pre-pass (e.g. felt grain)
    // without coupling it to the post-process chain configuration.
    backgroundShaderName = null;
    // Intermediate textures for multi-pass rendering
    intermediateTextures = [];
    // WGSL include cache (URL -> resolved text)
    includeCache = new Map();
    // Constants
    MAX_CHAIN_LENGTH = 8;
    SUPPORTED_SEPARATORS = ['+', ';', ',', '|'];
    constructor(shaderManager, device, format) {
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
    parseChainString(chainStr) {
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
    async activateChain(shaderNames, source = 'api') {
        if (!shaderNames || shaderNames.length === 0) {
            console.log('[ShaderChain] Clearing chain');
            this.clearChain();
            return true;
        }
        // Validate and truncate if too long
        if (shaderNames.length > this.MAX_CHAIN_LENGTH) {
            console.warn(`[ShaderChain] Chain too long (${shaderNames.length} shaders), ` +
                `truncating to ${this.MAX_CHAIN_LENGTH}`);
            shaderNames = shaderNames.slice(0, this.MAX_CHAIN_LENGTH);
        }
        console.log(`[ShaderChain] Activating chain (${source}): ${shaderNames.join(' → ')}`);
        // Load any missing built-in shaders
        for (const name of shaderNames) {
            if (!this.shaderManager.hasShader(name)) {
                console.log(`[ShaderChain] Loading built-in shader: ${name}`);
                try {
                    await this.loadBuiltinShader(name);
                }
                catch (error) {
                    console.warn(`[ShaderChain] Failed to load shader "${name}":`, error);
                }
            }
        }
        // Validate each shader exists (after loading attempts)
        const validShaders = [];
        const missingShaders = [];
        for (const name of shaderNames) {
            if (this.shaderManager.hasShader(name)) {
                validShaders.push(name);
            }
            else {
                console.warn(`[ShaderChain] Shader not available: ${name}`);
                missingShaders.push(name);
            }
        }
        if (validShaders.length === 0) {
            console.error('[ShaderChain] No valid shaders in chain');
            return false;
        }
        if (missingShaders.length > 0) {
            console.warn(`[ShaderChain] ${missingShaders.length} shader(s) not found: ${missingShaders.join(', ')}\n` +
                `[ShaderChain] Using ${validShaders.length} valid shader(s): ${validShaders.join(', ')}`);
        }
        this.activeChain = validShaders;
        this.chainSource = source;
        console.log(`[ShaderChain] ✓ Active chain: ${validShaders.join(' → ')}`);
        return true;
    }
    /**
     * Activate a chain from a chain string (frontmatter or URL format)
     */
    async activateChainFromString(chainStr, source = 'api') {
        const shaderNames = this.parseChainString(chainStr);
        return this.activateChain(shaderNames, source);
    }
    /**
     * Clear the active chain
     */
    clearChain() {
        this.activeChain = [];
        this.chainSource = 'none';
        this.releaseIntermediateTextures();
    }
    /**
     * Set (or clear) a persistent background shader that always runs before the
     * main chain, independent of setChain() configuration.  Pass null to remove.
     */
    async setBackground(name) {
        if (!name) {
            this.backgroundShaderName = null;
            console.log('[ShaderChain] Background shader cleared');
            return true;
        }
        // Load if not already available
        if (!this.shaderManager.hasShader(name)) {
            try {
                await this.loadBuiltinShader(name);
            }
            catch (error) {
                console.warn(`[ShaderChain] Background shader "${name}" not found:`, error);
                return false;
            }
        }
        if (!this.shaderManager.hasShader(name)) {
            console.warn(`[ShaderChain] Background shader "${name}" could not be loaded`);
            return false;
        }
        this.backgroundShaderName = name;
        console.log(`[ShaderChain] Background shader set: ${name}`);
        return true;
    }
    /**
     * Return the current background shader name, or null if none is set.
     */
    getBackground() {
        return this.backgroundShaderName;
    }
    /**
     * Load a built-in shader from the shader library
     * Attempts to load from ./shaders/{name}.wgsl.js
     */
    async loadBuiltinShader(name) {
        try {
            // Load the shader module via fetch (these files use plain functions, not ES6 modules)
            const baseUrl = resolveBuiltinShaderBaseUrl();
            const shaderPath = new URL(`${name}.wgsl.js`, baseUrl).toString();
            console.log(`[ShaderChain] Loading: ${shaderPath}`);
            const response = await fetch(shaderPath, { cache: 'no-store' });
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
            const uniformNames = config.uniforms ? Object.keys(config.uniforms) : [];
            const wglsShader = {
                name,
                code: combinedCode,
                kind: 'fragment',
                uniforms: uniformNames,
                bindings: [],
                workgroupSize: [1, 1, 1] // Default for fragment shaders (not used)
            };
            // Register with ShaderManager
            await this.shaderManager.registerShader(wglsShader);
            // Set default uniform values from the shader config
            if (config.uniforms) {
                for (const [uniformName, defaultValue] of Object.entries(config.uniforms)) {
                    this.shaderManager.setUniform(name, uniformName, defaultValue);
                }
            }
            console.log(`[ShaderChain] ✓ Loaded built-in shader: ${name}`);
        }
        catch (error) {
            console.error(`[ShaderChain] Failed to load built-in shader "${name}":`, error);
            throw error;
        }
    }
    async resolveWgslIncludes(code, baseUrl) {
        // WGSL `#include` preprocessor. This is intentionally minimal:
        // - Only supports: #include "relative/path.wgsl"
        // - Resolves relative to `baseUrl` (typically "./shaders/")
        // - Recursively resolves nested includes
        // - Detects cycles
        const includeRe = /^\s*#include\s+"([^"]+)"\s*$/gm;
        const resolveOne = async (src, seen) => {
            const matches = Array.from(src.matchAll(includeRe));
            if (matches.length === 0)
                return src;
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
                    const resp = await fetch(url, { cache: 'no-store' });
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
     * Check if there's an active chain or background shader
     */
    hasActiveChain() {
        return this.activeChain.length > 0 || this.backgroundShaderName !== null;
    }
    /**
     * Get the active chain
     */
    getActiveChain() {
        return [...this.activeChain];
    }
    /**
     * Get the source of the active chain
     */
    getChainSource() {
        return this.chainSource;
    }
    /**
     * Apply the shader chain to an input texture, writing to output texture.
     *
     * If a background shader is set it always runs first (before the chain),
     * independent of the chain configuration.  Full pass order:
     *   background (optional) → chain[0] → chain[1] → … → outputTexture
     *
     * @param materialTexture  Optional material render target from WebGPUUIRenderer.
     *   Passed through to each shader pass so lighting shaders can read per-pixel
     *   material properties (roughness, normalScale, metallic, emissive).
     */
    applyChain(inputTexture, outputTexture, commandEncoder, materialTexture) {
        // Build the effective pass list: [background?, ...chain]
        const effectivePasses = [];
        if (this.backgroundShaderName)
            effectivePasses.push(this.backgroundShaderName);
        effectivePasses.push(...this.activeChain);
        if (effectivePasses.length === 0) {
            return false; // Nothing to apply
        }
        // Single pass — simple case
        if (effectivePasses.length === 1) {
            this.shaderManager.setActiveShader(effectivePasses[0]);
            return this.shaderManager.applyShader(inputTexture, outputTexture, commandEncoder, materialTexture);
        }
        // Keep original activeChain references for the intermediate texture check below.
        // The effective list may be longer than activeChain by 1 (background prepended).
        // Multi-pass rendering
        this.ensureIntermediateTextures(effectivePasses.length - 1, inputTexture.width, inputTexture.height);
        let currentInput = inputTexture;
        for (let i = 0; i < effectivePasses.length; i++) {
            const shaderName = effectivePasses[i];
            const isLast = (i === effectivePasses.length - 1);
            const currentOutput = isLast ? outputTexture : this.intermediateTextures[i];
            this.shaderManager.setActiveShader(shaderName);
            const success = this.shaderManager.applyShader(currentInput, currentOutput, commandEncoder, materialTexture);
            if (!success) {
                console.error(`[ShaderChain] Failed to apply shader: ${shaderName}`);
                return false;
            }
            currentInput = currentOutput;
        }
        return true;
    }
    /**
     * Ensure we have enough intermediate textures for the chain
     */
    ensureIntermediateTextures(count, width, height) {
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
    releaseIntermediateTextures() {
        for (const texture of this.intermediateTextures) {
            texture.destroy();
        }
        this.intermediateTextures = [];
    }
    /**
     * Get info about the current chain for debugging
     */
    getChainInfo() {
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
    destroy() {
        this.releaseIntermediateTextures();
        this.activeChain = [];
    }
}
//# sourceMappingURL=shader-chain.js.map