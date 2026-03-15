import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

export interface GUIButtonConfig extends WidgetConfig {
  label: string;
  buttonStyle?: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    hoverBg?: Color;
    activeBg?: Color;
  };
}

/**
 * Graphical button widget with pixel-based rendering
 */
export class GUIButton extends BaseWidget {
  public label: string;
  public buttonStyle: {
    fg: Color;
    bg: Color;
    borderColor: Color;
    hoverBg: Color;
    activeBg: Color;
  };
  
  private clickedThisFrame: boolean = false;
  
  constructor(config: GUIButtonConfig) {
    super(config);
    this.label = String(config.label ?? '');
    
    // Default style
    this.buttonStyle = {
      fg: (config.buttonStyle?.fg ?? { r: 240, g: 240, b: 240 }) as Color,
      bg: (config.buttonStyle?.bg ?? { r: 60, g: 60, b: 60 }) as Color,
      borderColor: (config.buttonStyle?.borderColor ?? { r: 100, g: 100, b: 100 }) as Color,
      hoverBg: (config.buttonStyle?.hoverBg ?? { r: 80, g: 80, b: 80 }) as Color,
      activeBg: (config.buttonStyle?.activeBg ?? { r: 40, g: 120, b: 180 }) as Color
    };
    
    // Listen for click events
    this.on('click', () => {
      this.clickedThisFrame = true;
    });
  }
  
  setLabel(label: unknown): void {
    this.label = String(label ?? '');
  }
  
  /**
   * Check if button was clicked this frame
   */
  wasClicked(): boolean {
    const result = this.clickedThisFrame;
    this.clickedThisFrame = false;
    return result;
  }
  
  /**
   * Render method (rendering is handled by GUISystem)
   */
  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }
}
