import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

export interface GUILabelConfig extends WidgetConfig {
  text: string;
  align?: 'left' | 'center' | 'right';
  labelStyle?: {
    fg?: Color;
    bg?: Color;
  };
}

/**
 * Static text label with graphical rendering
 */
export class GUILabel extends BaseWidget {
  public text: string;
  public align: 'left' | 'center' | 'right';
  public labelStyle: {
    fg: Color;
    bg: Color;
  };
  
  constructor(config: GUILabelConfig) {
    super(config);
    this.text = config.text;
    this.align = config.align ?? 'left';
    
    this.labelStyle = {
      fg: (config.labelStyle?.fg ?? { r: 220, g: 220, b: 220 }) as Color,
      bg: (config.labelStyle?.bg ?? { r: 0, g: 0, b: 0, a: 0 }) as Color // Transparent by default
    };
  }
  
  setText(text: string): void {
    this.text = text;
  }
  
  /**
   * Render method (rendering is handled by GUISystem)
   */
  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }
}
