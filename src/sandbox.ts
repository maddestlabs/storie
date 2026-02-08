/**
 * SES-based sandbox for executing user code safely
 * Uses Compartments to isolate user scripts
 */

// Import SES shims (side-effects only - adds to globalThis)
import 'ses';

import type { UserHandlers, InputEvent } from './types.js';
import type { ThemeColors, NamedStyle } from './types.js';

// SES adds these to globalThis
declare const lockdown: any;
declare const Compartment: any;

export interface SandboxAPI {
  // Terminal text API
  term: {
    write: (x: number, y: number, text: string, fg?: any, bg?: any) => void;
    clear: () => void;
    layerID: string;
  };
  
  // Terminal canvas API (character-based drawing)
  termCanvas: {
    plot: (x: number, y: number, char: string, fg?: any, bg?: any) => void;
    line: (x1: number, y1: number, x2: number, y2: number, char: string, fg?: any, bg?: any) => void;
    rect: (x: number, y: number, w: number, h: number, char: string, fg?: any, bg?: any, filled?: boolean) => void;
    scrollTo: (x: number, y: number) => void;
    width: () => number;
    height: () => number;
  };
  
  // Layer API
  layer: {
    create: (id: string, width?: number, height?: number) => void;
    show: (id: string) => void;
    hide: (id: string) => void;
    setAlpha: (id: string, alpha: number) => void;
    clear: (id: string) => void;
  };
  
  // Input API (polling-based for backward compatibility)
  key: {
    down: (key: string) => boolean;
    pressed: (key: string) => boolean;
    released: (key: string) => boolean;
    // Key constants
    SPACE: string;
    ENTER: string;
    ESC: string;
    ARROW_UP: string;
    ARROW_DOWN: string;
    ARROW_LEFT: string;
    ARROW_RIGHT: string;
  };
  
  mouse: {
    x: () => number;
    y: () => number;
    down: (button?: number) => boolean;
    clicked: (button?: number) => boolean;
  };
  
  // Theme API
  getStyle: (name: string) => NamedStyle;
  theme: ThemeColors;
  
  // Global accessors (for convenience)
  mouseX: number;
  mouseY: number;
  termWidth: number;
  termHeight: number;
  
  // Read-only state
  getFrame: () => number;
  getTime: () => number;
  getDelta: () => number;
  
  // Input event (available in on:input blocks)
  event?: InputEvent;
}

let sesInitialized = false;

/**
 * Initialize SES lockdown (only needs to be called once globally)
 */
function initializeSES(): void {
  if (sesInitialized) return;
  
  try {
    lockdown({
      errorTaming: 'unsafe',    // Better error messages during development
      consoleTaming: 'unsafe',  // Allow console.log for user debugging
      stackFiltering: 'verbose'
    });
    sesInitialized = true;
    console.log('✓ SES lockdown initialized');
  } catch (error) {
    console.error('Failed to initialize SES:', error);
    throw error;
  }
}

export class ScriptSandbox {
  private api: SandboxAPI;
  private compartments: Map<string, any> = new Map();
  private scopes: Map<string, Record<string, any>> = new Map(); // Persistent shared scope per document

  constructor(api: SandboxAPI) {
    this.api = api;
    initializeSES();
  }

  /**
   * Create a new isolated compartment for a document with persistent shared scope
   */
  createCompartment(documentId: string, frontmatter: Record<string, any> = {}): any {
    try {
      // Create persistent scope for this document (shared across all code blocks)
      const scope: Record<string, any> = {
        ...frontmatter // Include frontmatter variables
      };
      this.scopes.set(documentId, scope);
      
      // Capture API for closures
      const api = this.api;
      
      const compartment = new Compartment({
        // Console for debugging
        console,
        
        // Math and Date are safe
        Math,
        Date,
        
        // Persistent shared scope (writable)
        scope,
        
        // Engine API (capability-based)
        term: this.api.term,
        termCanvas: this.api.termCanvas,
        layer: this.api.layer,
        key: this.api.key,
        mouse: this.api.mouse,
        
        // Theme API
        getStyle: this.api.getStyle,
        theme: this.api.theme,
        
        // Global accessors (as functions, not getters, for SES compatibility)
        getMouseX: () => api.mouseX,
        getMouseY: () => api.mouseY,
        getTermWidth: () => api.termWidth,
        getTermHeight: () => api.termHeight,
        
        // Also expose as properties for convenience (but these might not work in strict SES)
        get mouseX() { return api.mouseX; },
        get mouseY() { return api.mouseY; },
        get termWidth() { return api.termWidth; },
        get termHeight() { return api.termHeight; },
        
        // Read-only state accessors
        getFrame: this.api.getFrame,
        getTime: this.api.getTime,
        getDelta: this.api.getDelta,
        
        // NO ACCESS TO:
        // - fetch (network)
        // - localStorage (storage)
        // - document (DOM)
        // - window (global)
        // - eval (code injection)
        // - Function constructor
        // - XMLHttpRequest
      });

      this.compartments.set(documentId, compartment);
      return compartment;
    } catch (error) {
      console.error(`Failed to create compartment for ${documentId}:`, error);
      throw error;
    }
  }

  /**
   * Execute a code block in the document's persistent scope
   * Makes scope variables available as top-level variables
   * Captures newly defined variables back into scope
   * Returns function result or undefined
   */
  executeCodeBlock(documentId: string, code: string, skipTransform: boolean = false): any {
    const compartment = this.compartments.get(documentId);
    const scopeObj = this.scopes.get(documentId);
    
    if (!compartment || !scopeObj) {
      console.error(`No compartment/scope found for ${documentId}`);
      return null;
    }

    try {
      // Transform variable declarations to scope assignments (unless skipped)
      let transformedCode = skipTransform ? code : this.transformCodeForScope(code);
      
      // IMPORTANT: We don't add imports here at the top level anymore
      // Instead, we make scope available and let user code access scope.varName
      // This is simpler and more reliable than trying to import everything
      
      const wrappedCode = transformedCode;

      const result = compartment.evaluate(wrappedCode);
      return result;
    } catch (error: any) {
      console.error(`Error executing code block in ${documentId}:`, error);
      console.error('Stack:', error.stack);
      return null;
    }
  }
  
  /**
   * Transform variable declarations to scope assignments
   * Examples:
   *   let x = 10; -> scope.x = 10;
   *   const y = 20; -> scope.y = 20;
   *   function update(delta) { } -> scope.update = function update(delta) { }
   */
  private transformCodeForScope(code: string): string {
    let transformed = code;
    
    console.log('🔧 Transforming code, original length:', code.length);
    
    // Transform simple variable declarations: let x = value;
    transformed = transformed.replace(/^(\s*)(let|const|var)\s+(\w+)\s*=\s*([^;]+);/gm, (_m, indent, _kw, varName, value) => {
      console.log(`  📝 Transforming: ${_kw} ${varName} = ${value.substring(0, 50)}...`);
      // Skip if value is a function expression
      if (value.trim().startsWith('function')) {
        return `${indent}scope.${varName} = ${value};`;
      }
      return `${indent}scope.${varName} = ${value};`;
    });
    
    // Transform variable declarations without initialization: let x;
    transformed = transformed.replace(/^(\s*)(let|const|var)\s+(\w+)\s*;/gm, '$1scope.$3 = undefined;');
    
    // Transform function declarations: function name(...) { -> scope.name = function name(...) {
    // This simple replacement works because we don't need to modify the function body
    // The variables will be accessible via the imports added by executeCodeBlock
    transformed = transformed.replace(/^(\s*)function\s+(\w+)\s*\(/gm, '$1scope.$2 = function $2(');
    
    console.log('✅ Transformed code, new length:', transformed.length);
    
    return transformed;
  }
  
  /**
   * Execute user code and extract init/update/render/input handlers from scope
   */
  extractHandlers(documentId: string): UserHandlers | null {
    const scope = this.scopes.get(documentId);
    if (!scope) {
      console.error(`No scope found for ${documentId}`);
      return null;
    }

    try {
      const validHandlers: UserHandlers = {};
      
      if (typeof scope.init === 'function') {
        validHandlers.init = scope.init;
      }
      if (typeof scope.update === 'function') {
        validHandlers.update = scope.update;
      }
      if (typeof scope.render === 'function') {
        validHandlers.render = scope.render;
      }
      if (typeof scope.input === 'function') {
        validHandlers.input = scope.input;
      }
      
      return Object.keys(validHandlers).length > 0 ? validHandlers : null;
    } catch (error: any) {
      console.error(`Error extracting handlers from ${documentId}:`, error);
      return null;
    }
  }
  
  /**
   * Get the scope object for a document (for inspection)
   */
  getScope(documentId: string): Record<string, any> | null {
    return this.scopes.get(documentId) || null;
  }

  /**
   * Destroy a compartment and clean up resources
   */
  destroyCompartment(documentId: string): void {
    this.compartments.delete(documentId);
    this.scopes.delete(documentId);
  }

  /**
   * Clear all compartments
   */
  clearAll(): void {
    this.compartments.clear();
    this.scopes.clear();
  }
}
