/**
 * Module system types
 * Enables dynamic loading of optional Storie features
 */

import type { StorieEngine } from '../engine.js';

/**
 * Base interface for all Storie modules
 */
export interface StorieModule {
  /** Unique module identifier */
  readonly name: string;
  
  /** Semantic version */
  readonly version: string;
  
  /** Module description */
  readonly description?: string;
  
  /** Dependencies required before this module can load */
  readonly dependencies?: string[];
  
  /**
   * Initialize the module
   * Called once when the module is first loaded
   */
  init(engine: StorieEngine): Promise<void>;
  
  /**
   * Clean up module resources
   * Called when engine is disposed or module is unloaded
   */
  dispose(): void;
  
  /**
   * Optional: Called every frame before render
   */
  update?(deltaTime: number): void;
  
  /**
   * Optional: Called every frame during render
   */
  render?(): void;
}

/**
 * Module metadata returned by resolver
 */
export interface ModuleMetadata {
  name: string;
  version: string;
  url: string;
  description?: string;
  dependencies?: string[];
  size?: number; // Bytes
}

/**
 * Options for module loading
 */
export interface ModuleLoadOptions {
  /** Force reload even if already loaded */
  reload?: boolean;
  
  /** Timeout in milliseconds */
  timeout?: number;
  
  /** Custom resolver for this load */
  resolver?: ModuleResolver;
  
  /** Skip dependency loading */
  skipDependencies?: boolean;
}

/**
 * Function that resolves module names to URLs
 */
export type ModuleResolver = (name: string) => string | Promise<string>;

/**
 * Events emitted by module loader
 */
export interface ModuleLoaderEvents {
  'module:loading': ModuleLoadEvent;
  'module:loaded': ModuleLoadEvent;
  'module:error': ModuleErrorEvent;
  'module:disposed': { name: string };
}

export interface ModuleLoadEvent {
  name: string;
  version?: string;
  url?: string;
}

export interface ModuleErrorEvent {
  name: string;
  error: Error;
  url?: string;
}

/**
 * Built-in module names
 */
export enum BuiltInModules {
  Babylon = 'babylon',
  Physics = 'physics',
  Particles = 'particles',
  Terminal = 'terminal',
  Audio = 'audio',
  Networking = 'networking'
}

export type BuiltInModuleName = `${BuiltInModules}`;

/**
 * Module registry entry
 */
export interface ModuleRegistryEntry {
  module: StorieModule;
  metadata: ModuleMetadata;
  loadTime: number;
  initialized: boolean;
}

/**
 * Default module resolver configuration
 */
export interface ModuleResolverConfig {
  /** Base URL for module CDN */
  baseUrl?: string;
  
  /** Specific version mappings */
  versions?: Record<string, string>;
  
  /** Custom URL patterns */
  patterns?: Record<string, string>;
}
