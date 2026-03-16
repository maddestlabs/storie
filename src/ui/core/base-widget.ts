/**
 * Base Widget Class
 * Core widget functionality shared by all UI implementations
 * 
 * The `id` field in WidgetConfig is optional. If not provided, a unique ID
 * will be auto-generated using an internal counter. Users can reference
 * widgets directly via the returned object without needing explicit IDs.
 */

import type {
  WidgetId,
  Bounds,
  WidgetState,
  WidgetStyle,
  WidgetEvent,
  InputCoordinate,
  WidgetLayoutHints,
  WidgetLayoutSize,
  WidgetSizePolicy
} from './types.js';

export interface WidgetConfig {
  id?: WidgetId;
  bounds: Bounds;
  style?: WidgetStyle;
  group?: string | number;
  visible?: boolean;
  enabled?: boolean;
  focusable?: boolean;
  layout?: WidgetLayoutHints;
}

// Auto-increment counter for widget IDs
let nextAutoId = 1;

/**
 * Abstract base class for all widgets
 * Handles common state, input testing, and event emission
 */
export abstract class BaseWidget {
  public readonly id: WidgetId;
  public bounds: Bounds;
  public style: WidgetStyle;
  public group: string | number;
  public state: WidgetState;
  public focusable: boolean;
  public layout: WidgetLayoutHints;
  
  protected eventListeners: Map<string, ((event: WidgetEvent) => void)[]>;
  
  constructor(config: WidgetConfig) {
    // Auto-generate ID if not provided
    this.id = config.id ?? `widget_${nextAutoId++}`;
    this.bounds = { ...config.bounds };
    this.style = config.style || {};
    this.group = config.group || 0;
    this.focusable = config.focusable ?? true;
    this.layout = { ...(config.layout || {}) };
    
    this.state = {
      visible: config.visible ?? true,
      enabled: config.enabled ?? true,
      hovered: false,
      focused: false,
      pressed: false
    };
    
    this.eventListeners = new Map();
  }
  
  /**
   * Test if a point is within widget bounds
   */
  containsPoint(coord: InputCoordinate): boolean {
    return (
      coord.x >= this.bounds.x &&
      coord.x < this.bounds.x + this.bounds.width &&
      coord.y >= this.bounds.y &&
      coord.y < this.bounds.y + this.bounds.height
    );
  }
  
  /**
   * Update widget state based on input
   * Returns true if state changed
   */
  updateState(
    hovered: boolean,
    pressed: boolean,
    focused: boolean
  ): boolean {
    let changed = false;
    
    if (this.state.hovered !== hovered) {
      this.state.hovered = hovered;
      changed = true;
      
      if (hovered) {
        this.emit({ type: 'hover', widget: this.id, timestamp: Date.now() });
      }
    }
    
    if (this.state.pressed !== pressed) {
      this.state.pressed = pressed;
      changed = true;
    }
    
    if (this.state.focused !== focused) {
      const wasFocused = this.state.focused;
      this.state.focused = focused;
      changed = true;
      
      if (focused && !wasFocused) {
        this.emit({ type: 'focus', widget: this.id, timestamp: Date.now() });
      } else if (!focused && wasFocused) {
        this.emit({ type: 'blur', widget: this.id, timestamp: Date.now() });
      }
    }
    
    return changed;
  }
  
  /**
   * Get effective style based on current state
   */
  getEffectiveStyle(): WidgetStyle {
    let effectiveStyle = { ...this.style };
    
    if (!this.state.enabled && this.style.disabledStyle) {
      effectiveStyle = { ...effectiveStyle, ...this.style.disabledStyle };
    } else if (this.state.pressed && this.style.focusStyle) {
      // Pressed takes precedence
      effectiveStyle = { ...effectiveStyle, ...this.style.focusStyle };
    } else if (this.state.focused && this.style.focusStyle) {
      effectiveStyle = { ...effectiveStyle, ...this.style.focusStyle };
    } else if (this.state.hovered && this.style.hoverStyle) {
      effectiveStyle = { ...effectiveStyle, ...this.style.hoverStyle };
    }
    
    return effectiveStyle;
  }
  
  /**
   * Register event listener
   */
  on(eventType: string, callback: (event: WidgetEvent) => void): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(callback);
  }
  
  /**
   * Emit event to listeners
   */
  public emit(event: WidgetEvent): void {
    const listeners = this.eventListeners.get(event.type);
    if (listeners) {
      listeners.forEach(callback => callback(event));
    }
  }
  
  /**
   * Set visibility
   */
  setVisible(visible: boolean): void {
    this.state.visible = visible;
  }
  
  /**
   * Set enabled state
   */
  setEnabled(enabled: boolean): void {
    this.state.enabled = enabled;
  }
  
  /**
   * Update bounds
   */
  setBounds(bounds: Partial<Bounds>): void {
    this.bounds = { ...this.bounds, ...bounds };
  }

  getLayoutSize(): WidgetLayoutSize {
    const preferred = this.getPreferredSize();
    const min = this.getMinSize(preferred);
    return {
      minWidth: min.width,
      minHeight: min.height,
      preferredWidth: Math.max(min.width, preferred.width),
      preferredHeight: Math.max(min.height, preferred.height),
      widthPolicy: this.getWidthPolicy(),
      heightPolicy: this.getHeightPolicy()
    };
  }

  protected getWidthPolicy(): WidgetSizePolicy {
    return this.layout.widthPolicy ?? 'fixed';
  }

  protected getHeightPolicy(): WidgetSizePolicy {
    return this.layout.heightPolicy ?? 'fixed';
  }

  protected getPreferredSize(): { width: number; height: number } {
    return {
      width: Number.isFinite(this.layout.preferredWidth) ? Number(this.layout.preferredWidth) : this.bounds.width,
      height: Number.isFinite(this.layout.preferredHeight) ? Number(this.layout.preferredHeight) : this.bounds.height
    };
  }

  protected getMinSize(preferred?: { width: number; height: number }): { width: number; height: number } {
    const base = preferred || this.getPreferredSize();
    return {
      width: Number.isFinite(this.layout.minWidth) ? Number(this.layout.minWidth) : Math.max(0, base.width),
      height: Number.isFinite(this.layout.minHeight) ? Number(this.layout.minHeight) : Math.max(0, base.height)
    };
  }
  
  /**
   * Abstract method: render widget
   * Must be implemented by concrete widget types
   * @param buffer - Render target (type depends on renderer)
   * @param renderer - Renderer instance
   */
  abstract render(buffer: any, renderer: any): void;
}
