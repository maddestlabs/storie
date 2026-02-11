/**
 * Module loader for dynamic feature loading
 * Manages lazy loading of optional Storie modules
 */

import type { StorieEngine } from '../engine.js';
import type {
  StorieModule,
  ModuleMetadata,
  ModuleLoadOptions,
  ModuleResolver,
  ModuleRegistryEntry,
  ModuleResolverConfig
} from './types.js';

/**
 * Event emitter for module loader events
 */
class EventEmitter {
  private listeners = new Map<string, Set<Function>>();
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: Function): void {
    this.listeners.get(event)?.delete(callback);
  }
  
  emit(event: string, data: any): void {
    this.listeners.get(event)?.forEach(cb => cb(data));
  }
}

/**
 * Module loader manages dynamic imports of optional features
 */
export class ModuleLoader extends EventEmitter {
  private engine: StorieEngine;
  private registry = new Map<string, ModuleRegistryEntry>();
  private loading = new Map<string, Promise<StorieModule>>();
  private resolver: ModuleResolver;
  private resolverConfig: ModuleResolverConfig;
  
  constructor(engine: StorieEngine, config: ModuleResolverConfig = {}) {
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
  async load(name: string, options: ModuleLoadOptions = {}): Promise<StorieModule> {
    // Check if already loaded
    if (this.registry.has(name) && !options.reload) {
      return this.registry.get(name)!.module;
    }
    
    // Check if currently loading
    if (this.loading.has(name)) {
      return this.loading.get(name)!;
    }
    
    // Start loading
    const loadPromise = this.loadModule(name, options);
    this.loading.set(name, loadPromise);
    
    try {
      const module = await loadPromise;
      this.loading.delete(name);
      return module;
    } catch (error) {
      this.loading.delete(name);
      throw error;
    }
  }
  
  /**
   * Load multiple modules in parallel
   */
  async loadAll(names: string[], options: ModuleLoadOptions = {}): Promise<StorieModule[]> {
    return Promise.all(names.map(name => this.load(name, options)));
  }
  
  /**
   * Check if a module is loaded
   */
  isLoaded(name: string): boolean {
    return this.registry.has(name) && this.registry.get(name)!.initialized;
  }
  
  /**
   * Check if a module is currently loading
   */
  isLoading(name: string): boolean {
    return this.loading.has(name);
  }
  
  /**
   * Get a loaded module
   */
  get(name: string): StorieModule | undefined {
    return this.registry.get(name)?.module;
  }
  
  /**
   * Get all loaded modules
   */
  getAll(): StorieModule[] {
    return Array.from(this.registry.values()).map(entry => entry.module);
  }
  
  /**
   * Get module metadata
   */
  getMetadata(name: string): ModuleMetadata | undefined {
    return this.registry.get(name)?.metadata;
  }
  
  /**
   * Get all module names (loaded and loading)
   */
  getModuleNames(): string[] {
    return Array.from(this.registry.keys());
  }
  
  /**
   * Unload a module
   */
  async unload(name: string): Promise<void> {
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
    } catch (error) {
      console.error(`✗ Error unloading module ${name}:`, error);
      throw error;
    }
  }
  
  /**
   * Unload all modules
   */
  async unloadAll(): Promise<void> {
    const names = Array.from(this.registry.keys());
    await Promise.all(names.map(name => this.unload(name)));
  }
  
  /**
   * Set custom module resolver
   */
  setResolver(resolver: ModuleResolver): void {
    this.resolver = resolver;
  }
  
  /**
   * Update resolver configuration
   */
  updateResolverConfig(config: Partial<ModuleResolverConfig>): void {
    Object.assign(this.resolverConfig, config);
    this.resolver = this.createDefaultResolver();
  }
  
  /**
   * Call update on all loaded modules
   * Should be called from engine's update loop
   */
  update(deltaTime: number): void {
    for (const entry of this.registry.values()) {
      if (entry.initialized && entry.module.update) {
        try {
          entry.module.update(deltaTime);
        } catch (error) {
          console.error(`Error updating module ${entry.metadata.name}:`, error);
        }
      }
    }
  }
  
  /**
   * Call render on all loaded modules
   * Should be called from engine's render loop
   */
  render(): void {
    for (const entry of this.registry.values()) {
      if (entry.initialized && entry.module.render) {
        try {
          entry.module.render();
        } catch (error) {
          console.error(`Error rendering module ${entry.metadata.name}:`, error);
        }
      }
    }
  }
  
  /**
   * Internal: Load module implementation
   */
  private async loadModule(name: string, options: ModuleLoadOptions): Promise<StorieModule> {
    const startTime = performance.now();
    
    this.emit('module:loading', { name });
    console.log(`[Modules] Loading: ${name}`);
    
    try {
      // Resolve module URL
      const resolver = options.resolver || this.resolver;
      const url = await resolver(name);
      
      // Apply timeout
      const timeout = options.timeout || 30000;
      const loadPromise = this.importModule(url);
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error(`Module load timeout: ${name}`)), timeout)
      );
      
      const ModuleClass = await Promise.race([loadPromise, timeoutPromise]);
      
      // Instantiate module
      const module: StorieModule = new ModuleClass();
      
      // Load dependencies first
      if (module.dependencies && !options.skipDependencies) {
        console.log(`[Modules] Loading dependencies for ${name}:`, module.dependencies);
        await this.loadAll(module.dependencies, options);
      }
      
      // Create metadata
      const metadata: ModuleMetadata = {
        name: module.name,
        version: module.version,
        url,
        description: module.description,
        dependencies: module.dependencies
      };
      
      // Initialize module
      await module.init(this.engine);
      
      // Register module
      const entry: ModuleRegistryEntry = {
        module,
        metadata,
        loadTime: performance.now() - startTime,
        initialized: true
      };
      this.registry.set(name, entry);
      
      this.emit('module:loaded', { name, version: module.version, url });
      console.log(`✓ Module loaded: ${name} v${module.version} (${Math.round(entry.loadTime)}ms)`);
      
      return module;
      
    } catch (error) {
      const err = error as Error;
      this.emit('module:error', { name, error: err });
      console.error(`✗ Failed to load module: ${name}`, err);
      throw new Error(`Module load failed: ${name} - ${err.message}`);
    }
  }
  
  /**
   * Import module from URL
   */
  private async importModule(url: string): Promise<any> {
    try {
      const moduleExports = await import(/* @vite-ignore */ url);
      
      // Support both default and named exports
      if (moduleExports.default) {
        return moduleExports.default;
      } else if (moduleExports.Module) {
        return moduleExports.Module;
      } else {
        throw new Error('Module does not export a default or Module class');
      }
    } catch (error) {
      throw new Error(`Failed to import module from ${url}: ${error}`);
    }
  }
  
  /**
   * Create default module resolver
   */
  private createDefaultResolver(): ModuleResolver {
    return (name: string): string => {
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
  dispose(): void {
    for (const entry of this.registry.values()) {
      try {
        entry.module.dispose();
      } catch (error) {
        console.error(`Error disposing module ${entry.metadata.name}:`, error);
      }
    }
    this.registry.clear();
    this.loading.clear();
  }
}
