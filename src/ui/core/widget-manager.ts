/**
 * Widget Manager
 * Central registry and lifecycle manager for all widgets
 */

import type { BaseWidget } from './base-widget.js';
import type { WidgetId, WidgetGroup, NavigationContext } from './types.js';

export class WidgetManager {
  private widgets: Map<WidgetId, BaseWidget>;
  private groups: Map<string | number, WidgetGroup>;
  private navigation: NavigationContext;
  
  constructor() {
    this.widgets = new Map();
    this.groups = new Map();
    this.navigation = {
      focusedWidget: null,
      focusableWidgets: [],
      tabOrder: []
    };
  }
  
  /**
   * Register a widget
   */
  register(widget: BaseWidget): void {
    this.widgets.set(widget.id, widget);
    
    // Add to group
    if (!this.groups.has(widget.group)) {
      this.groups.set(widget.group, {
        id: widget.group,
        visible: true,
        widgets: new Set()
      });
    }
    this.groups.get(widget.group)!.widgets.add(widget.id);
    
    // Update focusable list
    if (widget.focusable) {
      this.navigation.focusableWidgets.push(widget.id);
      this.navigation.tabOrder.push(widget.id);
    }
  }
  
  /**
   * Unregister a widget
   */
  unregister(id: WidgetId): void {
    const widget = this.widgets.get(id);
    if (!widget) return;
    
    // Remove from group
    const group = this.groups.get(widget.group);
    if (group) {
      group.widgets.delete(id);
    }
    
    // Remove from navigation
    const focusIdx = this.navigation.focusableWidgets.indexOf(id);
    if (focusIdx !== -1) {
      this.navigation.focusableWidgets.splice(focusIdx, 1);
    }
    const tabIdx = this.navigation.tabOrder.indexOf(id);
    if (tabIdx !== -1) {
      this.navigation.tabOrder.splice(tabIdx, 1);
    }
    
    // Clear focus if this widget was focused
    if (this.navigation.focusedWidget === id) {
      this.navigation.focusedWidget = null;
    }
    
    this.widgets.delete(id);
  }
  
  /**
   * Get widget by ID
   */
  get(id: WidgetId): BaseWidget | undefined {
    return this.widgets.get(id);
  }
  
  /**
   * Get all widgets
   */
  getAll(): BaseWidget[] {
    return Array.from(this.widgets.values());
  }
  
  /**
   * Get visible widgets (respecting group visibility)
   */
  getVisible(): BaseWidget[] {
    return Array.from(this.widgets.values()).filter(widget => {
      if (!widget.state.visible) return false;
      const group = this.groups.get(widget.group);
      return group ? group.visible : true;
    });
  }
  
  /**
   * Set group visibility
   */
  setGroupVisible(groupId: string | number, visible: boolean): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.visible = visible;
    }
  }
  
  /**
   * Check if group is visible
   */
  isGroupVisible(groupId: string | number): boolean {
    const group = this.groups.get(groupId);
    return group ? group.visible : true;
  }
  
  /**
   * Focus a widget
   */
  focus(id: WidgetId | null): void {
    // Blur current focused widget
    if (this.navigation.focusedWidget !== null) {
      const current = this.widgets.get(this.navigation.focusedWidget);
      if (current) {
        current.updateState(current.state.hovered, current.state.pressed, false);
      }
    }
    
    // Focus new widget
    this.navigation.focusedWidget = id;
    if (id !== null) {
      const widget = this.widgets.get(id);
      if (widget && widget.focusable) {
        widget.updateState(widget.state.hovered, widget.state.pressed, true);
      }
    }
  }
  
  /**
   * Focus next widget in tab order
   */
  focusNext(): void {
    if (this.navigation.tabOrder.length === 0) return;
    
    let currentIdx = -1;
    if (this.navigation.focusedWidget !== null) {
      currentIdx = this.navigation.tabOrder.indexOf(this.navigation.focusedWidget);
    }
    
    // Find next focusable, visible, enabled widget
    let nextIdx = (currentIdx + 1) % this.navigation.tabOrder.length;
    let attempts = 0;
    
    while (attempts < this.navigation.tabOrder.length) {
      const nextId = this.navigation.tabOrder[nextIdx];
      const widget = this.widgets.get(nextId);
      
      if (widget && widget.state.visible && widget.state.enabled && widget.focusable) {
        const group = this.groups.get(widget.group);
        if (!group || group.visible) {
          this.focus(nextId);
          return;
        }
      }
      
      nextIdx = (nextIdx + 1) % this.navigation.tabOrder.length;
      attempts++;
    }
  }
  
  /**
   * Focus previous widget in tab order
   */
  focusPrevious(): void {
    if (this.navigation.tabOrder.length === 0) return;
    
    let currentIdx = this.navigation.tabOrder.length - 1;
    if (this.navigation.focusedWidget !== null) {
      currentIdx = this.navigation.tabOrder.indexOf(this.navigation.focusedWidget);
    }
    
    // Find previous focusable, visible, enabled widget
    let prevIdx = (currentIdx - 1 + this.navigation.tabOrder.length) % this.navigation.tabOrder.length;
    let attempts = 0;
    
    while (attempts < this.navigation.tabOrder.length) {
      const prevId = this.navigation.tabOrder[prevIdx];
      const widget = this.widgets.get(prevId);
      
      if (widget && widget.state.visible && widget.state.enabled && widget.focusable) {
        const group = this.groups.get(widget.group);
        if (!group || group.visible) {
          this.focus(prevId);
          return;
        }
      }
      
      prevIdx = (prevIdx - 1 + this.navigation.tabOrder.length) % this.navigation.tabOrder.length;
      attempts++;
    }
  }
  
  /**
   * Get currently focused widget
   */
  getFocused(): BaseWidget | null {
    if (this.navigation.focusedWidget === null) return null;
    return this.widgets.get(this.navigation.focusedWidget) || null;
  }
  
  /**
   * Clear all widgets
   */
  clear(): void {
    this.widgets.clear();
    this.groups.clear();
    this.navigation.focusedWidget = null;
    this.navigation.focusableWidgets = [];
    this.navigation.tabOrder = [];
  }
}
