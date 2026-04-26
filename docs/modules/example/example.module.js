/**
 * Example Storie Module
 * Template for creating custom modules
 */
export default class ExampleModule {
    name = 'example';
    version = '1.0.0';
    description = 'Example module demonstrating the module system';
    dependencies = []; // Optional dependencies
    frameCount = 0;
    /**
     * Initialize the module
     * Called once when module is loaded
     */
    async init(engine) {
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
    update(_deltaTime) {
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
    render() {
        // Example: Custom rendering logic
        // Access renderer, draw overlays, etc.
    }
    /**
     * Clean up resources
     * Called when module is unloaded or engine is disposed
     */
    dispose() {
        console.log(`[${this.name}] Disposing`);
        // Clean up event listeners, timers, etc.
        this.frameCount = 0;
        console.log(`[${this.name}] ✓ Disposed`);
    }
}
//# sourceMappingURL=example.module.js.map