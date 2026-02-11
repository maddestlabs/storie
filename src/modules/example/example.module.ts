/**
 * Example Storie Module
 * Template for creating custom modules
 */

import type { StorieModule } from '../types.js';
import type { StorieEngine } from '../../engine.js';

export default class ExampleModule implements StorieModule {
  readonly name = 'example';
  readonly version = '1.0.0';
  readonly description = 'Example module demonstrating the module system';
  readonly dependencies = []; // Optional dependencies
  
  private frameCount = 0;
  
  /**
   * Initialize the module
   * Called once when module is loaded
   */
  async init(engine: StorieEngine): Promise<void> {
    console.log(`[${this.name}] Initializing v${this.version}`);
    
    // Example: Access engine systems
    const canvas = engine.getCanvas();
    console.log(`[${this.name}] Canvas size: ${canvas.width}x${canvas.height}`);
    
    // Example: Register custom APIs (if needed)
    // This would require extending the engine's API surface
    
    console.log(`[${this.name}] ✓ Initialized`);
  }
  
  /**
   * Called every frame before user update
   * @param deltaTime Time since last frame in seconds
   */
  update(_deltaTime: number): void {
    this.frameCount++;
    
    // Example: Do something every 60 frames
    if (this.frameCount % 60 === 0) {
      console.log(`[${this.name}] Frame ${this.frameCount}`);
    }
  }
  
  /**
   * Called every frame during render phase
   * Use this for custom rendering
   */
  render(): void {
    // Example: Custom rendering logic
    // Access renderer, draw overlays, etc.
  }
  
  /**
   * Clean up resources
   * Called when module is unloaded or engine is disposed
   */
  dispose(): void {
    console.log(`[${this.name}] Disposing`);
    
    // Clean up event listeners, timers, etc.
    this.frameCount = 0;
    
    console.log(`[${this.name}] ✓ Disposed`);
  }
}
