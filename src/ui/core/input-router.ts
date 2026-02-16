/**
 * Input Router
 * Routes input events to appropriate widgets
 */

import type { BaseWidget } from './base-widget.js';
import type { WidgetManager } from './widget-manager.js';
import type { InputCoordinate } from './types.js';

export interface InputRouterConfig {
  widgetManager: WidgetManager;
}

/**
 * Handles mouse and keyboard input routing to widgets
 */
export class InputRouter {
  private widgetManager: WidgetManager;
  
  private currentHoverWidget: BaseWidget | null = null;
  private currentPressedWidget: BaseWidget | null = null;
  private mousePressed: boolean = false;
  
  constructor(config: InputRouterConfig) {
    this.widgetManager = config.widgetManager;
  }
  
  /**
   * Update input routing
   * Should be called every frame before rendering
   */
  update(mousePos: InputCoordinate, mouseDown: boolean): void {
    // Get visible widgets in reverse order (top to bottom)
    const visibleWidgets = this.widgetManager.getVisible().reverse();
    
    // Find hovered widget
    let hoveredWidget: BaseWidget | null = null;
    for (const widget of visibleWidgets) {
      if (widget.state.enabled && widget.containsPoint(mousePos)) {
        hoveredWidget = widget;
        break;
      }
    }
    
    // Update hover states
    if (hoveredWidget !== this.currentHoverWidget) {
      if (this.currentHoverWidget) {
        this.currentHoverWidget.updateState(false, this.currentHoverWidget.state.pressed, this.currentHoverWidget.state.focused);
      }
      if (hoveredWidget) {
        hoveredWidget.updateState(true, hoveredWidget.state.pressed, hoveredWidget.state.focused);
      }
      this.currentHoverWidget = hoveredWidget;
    }
    
    // Handle mouse press/release
    const mouseJustPressed = mouseDown && !this.mousePressed;
    const mouseJustReleased = !mouseDown && this.mousePressed;
    
    if (mouseJustPressed && hoveredWidget) {
      // Press started on widget
      this.currentPressedWidget = hoveredWidget;
      hoveredWidget.updateState(hoveredWidget.state.hovered, true, hoveredWidget.state.focused);

      // Match tStorie semantics: treat a press on a widget as a click.
      // This makes buttons/checkboxes respond immediately and avoids relying on
      // observing the release in a later update.
      hoveredWidget.emit({
        type: 'click',
        widget: hoveredWidget.id,
        timestamp: Date.now(),
        data: { x: mousePos.x, y: mousePos.y }
      });
    }
    
    if (mouseJustReleased && this.currentPressedWidget) {
      // Press ended
      const wasHovered = this.currentPressedWidget.state.hovered;
      this.currentPressedWidget.updateState(wasHovered, false, this.currentPressedWidget.state.focused);
      
      this.currentPressedWidget = null;
    }
    
    this.mousePressed = mouseDown;
  }
  
  /**
   * Handle keyboard input for focused widget
   */
  handleKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }): boolean {
    // Handle Tab navigation
    if (key === 'Tab') {
      if (modifiers?.shift) {
        this.widgetManager.focusPrevious();
      } else {
        this.widgetManager.focusNext();
      }
      return true; // Consumed
    }
    
    // Handle arrow key navigation
    if (key === 'ArrowDown' || key === 'ArrowRight') {
      this.widgetManager.focusNext();
      return true;
    }
    
    if (key === 'ArrowUp' || key === 'ArrowLeft') {
      this.widgetManager.focusPrevious();
      return true;
    }
    
    // Pass to focused widget (for future extension)
    const focused = this.widgetManager.getFocused();
    if (focused) {
      // Widgets can handle their own keys in the future
      // For now, just return false
    }
    
    return false; // Not consumed
  }
  
  /**
   * Handle activation (Enter/Space on focused widget)
   */
  handleActivate(): boolean {
    const focused = this.widgetManager.getFocused();
    if (focused && focused.state.enabled) {
      // Emit click event on focused widget
      focused.emit({
        type: 'click',
        widget: focused.id,
        timestamp: Date.now()
      });
      return true;
    }
    return false;
  }
  
  /**
   * Get widget currently under mouse
   */
  getHoveredWidget(): BaseWidget | null {
    return this.currentHoverWidget;
  }
  
  /**
   * Get widget currently being pressed
   */
  getPressedWidget(): BaseWidget | null {
    return this.currentPressedWidget;
  }
}
