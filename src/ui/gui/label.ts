import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUILabelConfig extends WidgetConfig {
  text: string;
  align?: 'left' | 'center' | 'right';
  labelStyle?: {
    fg?: Color;
    bg?: Color;
    typographyRole?: GUITypographyRole;
  };
}

/**
 * Static text label with graphical rendering
 */
export class GUILabel extends BaseWidget {
  public text: string;
  public align: 'left' | 'center' | 'right';
  public labelStyle: {
    fg?: Color;
    bg?: Color;
    typographyRole: GUITypographyRole;
  };
  
  constructor(config: GUILabelConfig) {
    super(config);
    this.text = String(config.text ?? '');
    this.align = config.align ?? 'left';
    
    this.labelStyle = {
      fg: config.labelStyle?.fg,
      bg: config.labelStyle?.bg,
      typographyRole: config.labelStyle?.typographyRole ?? defaultTokens.typography.body.role
    };
  }
  
  setText(text: unknown): void {
    this.text = String(text ?? '');
  }
  
  /**
   * Render method (rendering is handled by GUISystem)
   */
  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }

  protected getPreferredSize(): { width: number; height: number } {
    const type = defaultTokens.typography[this.labelStyle.typographyRole];
    return {
      width: Math.max(this.bounds.width, this.text.length * 10),
      height: Math.max(this.bounds.height, type.minHeight)
    };
  }
}
