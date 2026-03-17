/**
 * Core UI Types
 * Shared types for both TUI and graphical UI systems
 */

import type { Color } from '../../types.js';

/**
 * Widget unique identifier
 */
export type WidgetId = string | number;

/**
 * Rectangle bounds
 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WidgetLayoutHints {
  minWidth?: number;
  minHeight?: number;
  preferredWidth?: number;
  preferredHeight?: number;
  widthPolicy?: WidgetSizePolicy;
  heightPolicy?: WidgetSizePolicy;
}

export interface WidgetLayoutSize {
  minWidth: number;
  minHeight: number;
  preferredWidth: number;
  preferredHeight: number;
  widthPolicy: WidgetSizePolicy;
  heightPolicy: WidgetSizePolicy;
}

export type WidgetSizePolicy = 'fixed' | 'fill' | 'fit-content';

/**
 * Widget state flags
 */
export interface WidgetState {
  visible: boolean;
  enabled: boolean;
  hovered: boolean;
  focused: boolean;
  pressed: boolean;
}

/**
 * Widget interaction event
 */
export interface WidgetEvent {
  type: 'click' | 'hover' | 'focus' | 'blur' | 'change' | 'drag';
  widget: WidgetId;
  timestamp: number;
  data?: any;
}

/**
 * Widget style properties (can be themed)
 */
export interface WidgetStyle {
  // Colors
  fg?: Color;
  bg?: Color;
  borderColor?: Color;
  accentColor?: Color;
  
  // Text styling (for TUI)
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  
  // Layout
  padding?: number | { top: number; right: number; bottom: number; left: number };
  margin?: number | { top: number; right: number; bottom: number; left: number };
  
  // State-specific styles
  hoverStyle?: Partial<WidgetStyle>;
  focusStyle?: Partial<WidgetStyle>;
  disabledStyle?: Partial<WidgetStyle>;
}

/**
 * Layout alignment options
 */
export type Alignment = 'start' | 'center' | 'end' | 'stretch';

/**
 * Layout direction
 */
export type Direction = 'horizontal' | 'vertical';

/**
 * Widget group for visibility/layer management
 */
export interface WidgetGroup {
  id: string | number;
  visible: boolean;
  widgets: Set<WidgetId>;
}

/**
 * Input coordinate (can be mouse or touch)
 */
export interface InputCoordinate {
  x: number;
  y: number;
  cellX?: number;  // For TUI: which cell
  cellY?: number;
}

/**
 * Keyboard navigation context
 */
export interface NavigationContext {
  focusedWidget: WidgetId | null;
  focusableWidgets: WidgetId[];
  tabOrder: WidgetId[];
}

export interface WidgetRenderContext {
  charWidth: number;
  charHeight: number;
  scale: number;
}
