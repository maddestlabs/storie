/**
 * Module loader for dynamic feature loading
 * Manages lazy loading of optional Storie modules
 */
/**
 * Event emitter for module loader events
 */
class EventEmitter {
    listeners = new Map();
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    off(event, callback) {
        this.listeners.get(event)?.delete(callback);
    }
    emit(event, data) {
        this.listeners.get(event)?.forEach(cb => cb(data));
    }
}
/**
 * Module loader manages dynamic imports of optional features
 */
export class ModuleLoader extends EventEmitter {
    engine;
    registry = new Map();
    loading = new Map();
    resolver;
    resolverConfig;
    constructor(engine, config = {}) {
        super();
        this.engine = engine;
        this.resolverConfig = {
            baseUrl: config.baseUrl || './modules',
            versions: config.versions || {},
            patterns: config.patterns || {}
        };
        this.resolver = this.createDefaultResolver();
    }
    /**
     * Load a module by name
     */
    async load(name, options = {}) {
        // Check if already loaded
        if (this.registry.has(name) && !options.reload) {
            return this.registry.get(name).module;
        }
        // Check if currently loading
        if (this.loading.has(name)) {
            return this.loading.get(name);
        }
        // Start loading
        const loadPromise = this.loadModule(name, options);
        this.loading.set(name, loadPromise);
        try {
            const module = await loadPromise;
            this.loading.delete(name);
            return module;
        }
        catch (error) {
            this.loading.delete(name);
            throw error;
        }
    }
    /**
     * Load multiple modules in parallel
     */
    async loadAll(names, options = {}) {
        return Promise.all(names.map(name => this.load(name, options)));
    }
    /**
     * Check if a module is loaded
     */
    isLoaded(name) {
        return this.registry.has(name) && this.registry.get(name).initialized;
    }
    /**
     * Check if a module is currently loading
     */
    isLoading(name) {
        return this.loading.has(name);
    }
    /**
     * Get a loaded module
     */
    get(name) {
        return this.registry.get(name)?.module;
    }
    /**
     * Get all loaded modules
     */
    getAll() {
        return Array.from(this.registry.values()).map(entry => entry.module);
    }
    /**
     * Get module metadata
     */
    getMetadata(name) {
        return this.registry.get(name)?.metadata;
    }
    /**
     * Get all module names (loaded and loading)
     */
    getModuleNames() {
        return Array.from(this.registry.keys());
    }
    /**
     * Unload a module
     */
    async unload(name) {
        const entry = this.registry.get(name);
        if (!entry) {
            console.warn(`Module not loaded: ${name}`);
            return;
        }
        // Dispose module
        try {
            entry.module.dispose();
            this.registry.delete(name);
            this.emit('module:disposed', { name });
            console.log(`✓ Module unloaded: ${name}`);
        }
        catch (error) {
            console.error(`✗ Error unloading module ${name}:`, error);
            throw error;
        }
    }
    /**
     * Unload all modules
     */
    async unloadAll() {
        const names = Array.from(this.registry.keys());
        await Promise.all(names.map(name => this.unload(name)));
    }
    /**
     * Set custom module resolver
     */
    setResolver(resolver) {
        this.resolver = resolver;
    }
    /**
     * Update resolver configuration
     */
    updateResolverConfig(config) {
        Object.assign(this.resolverConfig, config);
        this.resolver = this.createDefaultResolver();
    }
    /**
     * Call update on all loaded modules
     * Should be called from engine's update loop
     */
    update(deltaTime) {
        for (const entry of this.registry.values()) {
            if (entry.initialized && entry.module.update) {
                try {
                    entry.module.update(deltaTime);
                }
                catch (error) {
                    console.error(`Error updating module ${entry.metadata.name}:`, error);
                }
            }
        }
    }
    /**
     * Call render on all loaded modules
     * Should be called from engine's render loop
     */
    render() {
        for (const entry of this.registry.values()) {
            if (entry.initialized && entry.module.render) {
                try {
                    entry.module.render();
                }
                catch (error) {
                    console.error(`Error rendering module ${entry.metadata.name}:`, error);
                }
            }
        }
    }
    /**
     * Internal: Load module implementation
     */
    async loadModule(name, options) {
        const startTime = performance.now();
        this.emit('module:loading', { name });
        console.log(`[Modules] Loading: ${name}`);
        try {
            // Resolve module URL
            const resolver = options.resolver || this.resolver;
            const url = await resolver(name);
            // Defense-in-depth: custom per-load resolvers are powerful and can be used
            // as a sandbox escape (executing host-privileged code via dynamic import).
            // Reject cross-origin and dangerous schemes when a custom resolver is used.
            if (options.resolver) {
                this.assertSafeDynamicImportUrl(String(url));
            }
            // Apply timeout
            const timeout = options.timeout || 30000;
            const loadPromise = this.importModule(url);
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(`Module load timeout: ${name}`)), timeout));
            const ModuleClass = await Promise.race([loadPromise, timeoutPromise]);
            // Instantiate module
            const module = new ModuleClass();
            // Load dependencies first
            if (module.dependencies && !options.skipDependencies) {
                console.log(`[Modules] Loading dependencies for ${name}:`, module.dependencies);
                await this.loadAll(module.dependencies, options);
            }
            // Create metadata
            const metadata = {
                name: module.name,
                version: module.version,
                url,
                description: module.description,
                dependencies: module.dependencies
            };
            // Initialize module
            await module.init(this.engine);
            // Register module
            const entry = {
                module,
                metadata,
                loadTime: performance.now() - startTime,
                initialized: true
            };
            this.registry.set(name, entry);
            this.emit('module:loaded', { name, version: module.version, url });
            console.log(`✓ Module loaded: ${name} v${module.version} (${Math.round(entry.loadTime)}ms)`);
            return module;
        }
        catch (error) {
            const err = error;
            this.emit('module:error', { name, error: err });
            console.error(`✗ Failed to load module: ${name}`, err);
            throw new Error(`Module load failed: ${name} - ${err.message}`);
        }
    }
    /**
     * Validate a URL before host-privileged dynamic import.
     * Allows only same-origin http(s) or relative URLs.
     */
    assertSafeDynamicImportUrl(rawUrl) {
        const s = String(rawUrl ?? '').trim();
        if (!s)
            throw new Error('Empty module URL');
        // Fast deny-list for obvious dangerous schemes.
        const lower = s.toLowerCase();
        if (lower.startsWith('data:') || lower.startsWith('blob:') || lower.startsWith('javascript:')) {
            throw new Error(`Unsupported import URL scheme: ${s.split(':', 1)[0]}`);
        }
        // If it's a relative URL, it's fine.
        if (s.startsWith('./') || s.startsWith('../') || s.startsWith('/'))
            return;
        // Otherwise, require same-origin.
        try {
            const base = globalThis.location?.href;
            const origin = globalThis.location?.origin;
            const u = new URL(s, base || 'http://localhost');
            if (origin && u.origin !== origin) {
                throw new Error(`Cross-origin import blocked: ${u.origin}`);
            }
        }
        catch (e) {
            throw new Error(`Invalid module URL: ${String(e?.message ?? e)}`);
        }
    }
    /**
     * Import module from URL
     */
    async importModule(url) {
        try {
            const moduleExports = await import(/* @vite-ignore */ url);
            // Support both default and named exports
            if (moduleExports.default) {
                return moduleExports.default;
            }
            else if (moduleExports.Module) {
                return moduleExports.Module;
            }
            else {
                throw new Error('Module does not export a default or Module class');
            }
        }
        catch (error) {
            throw new Error(`Failed to import module from ${url}: ${error}`);
        }
    }
    /**
     * Create default module resolver
     */
    createDefaultResolver() {
        return (name) => {
            const config = this.resolverConfig;
            // Check custom patterns first
            if (config.patterns && config.patterns[name]) {
                return config.patterns[name];
            }
            // Check version mapping
            const version = config.versions?.[name] || 'latest';
            // Construct URL
            const baseUrl = config.baseUrl || './modules';
            return `${baseUrl}/${name}.module.js${version !== 'latest' ? `?v=${version}` : ''}`;
        };
    }
    /**
     * Dispose all modules and cleanup
     */
    dispose() {
        for (const entry of this.registry.values()) {
            try {
                entry.module.dispose();
            }
            catch (error) {
                console.error(`Error disposing module ${entry.metadata.name}:`, error);
            }
        }
        this.registry.clear();
        this.loading.clear();
    }
}
//# sourceMappingURL=loader.js.map