import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUIButtonConfig extends WidgetConfig {
  label: string;
  buttonStyle?: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    hoverBg?: Color;
    activeBg?: Color;
    paddingX?: number;
    paddingY?: number;
    borderWidth?: number;
    focusBorderWidth?: number;
    typographyRole?: GUITypographyRole;
  };
}

/**
 * Graphical button widget with pixel-based rendering
 */
export class GUIButton extends BaseWidget {
  public label: string;
  public buttonStyle: {
    fg?: Color;
    bg?: Color;
    borderColor?: Color;
    hoverBg?: Color;
    activeBg?: Color;
    paddingX: number;
    paddingY: number;
    borderWidth: number;
    focusBorderWidth: number;
    typographyRole: GUITypographyRole;
  };
  
  private clickedThisFrame: boolean = false;
  
  constructor(config: GUIButtonConfig) {
    super(config);
    this.label = String(config.label ?? '');
    
    // Default style
    this.buttonStyle = {
      fg: config.buttonStyle?.fg,
      bg: config.buttonStyle?.bg,
      borderColor: config.buttonStyle?.borderColor,
      hoverBg: config.buttonStyle?.hoverBg,
      activeBg: config.buttonStyle?.activeBg,
      paddingX: config.buttonStyle?.paddingX ?? defaultTokens.controls.button.paddingX,
      paddingY: config.buttonStyle?.paddingY ?? defaultTokens.controls.button.paddingY,
      borderWidth: config.buttonStyle?.borderWidth ?? defaultTokens.controls.button.borderWidth,
      focusBorderWidth: config.buttonStyle?.focusBorderWidth ?? defaultTokens.controls.button.focusBorderWidth,
      typographyRole: config.buttonStyle?.typographyRole ?? 'button'
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

  protected getPreferredSize(): { width: number; height: number } {
    const labelWidth = this.label.length * 10;
    const contentWidth = labelWidth + this.buttonStyle.paddingX * 2;
    const contentHeight = defaultTokens.typography[this.buttonStyle.typographyRole].minHeight + this.buttonStyle.paddingY * 2;
    return {
      width: Math.max(this.bounds.width, contentWidth),
      height: Math.max(this.bounds.height, contentHeight, defaultTokens.controls.button.minHeight)
    };
  }
}
