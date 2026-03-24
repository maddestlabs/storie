/**
 * Widget Manager
 * Central registry and lifecycle manager for all widgets
 */

import type { BaseWidget } from './base-widget.js';
import type {
  WidgetId,
  WidgetGroup,
  NavigationContext,
  WidgetGroupPresentation,
  WidgetGroupTransform,
} from './types.js';

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

  private normalizeGroupScale(scale: number | undefined): number {
    const value = Number(scale);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private normalizeGroupOpacity(opacity: number | undefined): number {
    const value = Number(opacity);
    if (!Number.isFinite(value)) return 1;
    return Math.max(0, Math.min(1, value));
  }

  private createGroup(groupId: string | number): WidgetGroup {
    return {
      id: groupId,
      visible: true,
      widgets: new Set(),
      transform: {
        x: 0,
        y: 0,
        scale: 1,
      },
      presentation: {
        opacity: 1,
      },
    };
  }

  private ensureGroup(groupId: string | number): WidgetGroup {
    let group = this.groups.get(groupId);
    if (!group) {
      group = this.createGroup(groupId);
      this.groups.set(groupId, group);
    }
    return group;
  }
  
  /**
   * Register a widget
   */
  register(widget: BaseWidget): void {
    this.widgets.set(widget.id, widget);
    
    // Add to group
    this.ensureGroup(widget.group).widgets.add(widget.id);
    
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
    this.ensureGroup(groupId).visible = visible;
  }

  setGroupOpacity(groupId: string | number, opacity: number): void {
    this.ensureGroup(groupId).presentation.opacity = this.normalizeGroupOpacity(opacity);
  }

  setGroupTransform(groupId: string | number, transform: Partial<WidgetGroupTransform>): void {
    const group = this.ensureGroup(groupId);
    if (transform.x !== undefined && Number.isFinite(Number(transform.x))) {
      group.transform.x = Number(transform.x);
    }
    if (transform.y !== undefined && Number.isFinite(Number(transform.y))) {
      group.transform.y = Number(transform.y);
    }
    if (transform.scale !== undefined) {
      group.transform.scale = this.normalizeGroupScale(transform.scale);
    }
  }

  getGroupState(groupId: string | number): WidgetGroup {
    return this.ensureGroup(groupId);
  }

  getGroupTransform(groupId: string | number): WidgetGroupTransform {
    return { ...this.ensureGroup(groupId).transform };
  }

  getGroupPresentation(groupId: string | number): WidgetGroupPresentation {
    return { ...this.ensureGroup(groupId).presentation };
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
