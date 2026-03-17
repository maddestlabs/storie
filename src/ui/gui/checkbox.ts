import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUICheckboxConfig extends WidgetConfig {
  label: string;
  checked?: boolean;
  checkboxStyle?: {
    fg?: Color;
    bg?: Color;
    checkColor?: Color;
    hoverBg?: Color;
    boxSize?: number;
    labelGap?: number;
    borderWidth?: number;
    typographyRole?: GUITypographyRole;
  };
}

/**
 * Checkbox widget with label and graphical rendering
 */
export class GUICheckbox extends BaseWidget {
  public label: string;
  public checked: boolean;
  private wasToggledThisFrame: boolean = false;
  public checkboxStyle: {
    fg?: Color;
    bg?: Color;
    checkColor?: Color;
    hoverBg?: Color;
    boxSize: number;
    labelGap: number;
    borderWidth: number;
    typographyRole: GUITypographyRole;
  };
  
  constructor(config: GUICheckboxConfig) {
    super(config);
    this.label = String(config.label ?? '');
    this.checked = config.checked ?? false;
    
    this.checkboxStyle = {
      fg: config.checkboxStyle?.fg,
      bg: config.checkboxStyle?.bg,
      checkColor: config.checkboxStyle?.checkColor,
      hoverBg: config.checkboxStyle?.hoverBg,
      boxSize: config.checkboxStyle?.boxSize ?? defaultTokens.controls.checkbox.boxSize,
      labelGap: config.checkboxStyle?.labelGap ?? defaultTokens.controls.checkbox.labelGap,
      borderWidth: config.checkboxStyle?.borderWidth ?? defaultTokens.controls.checkbox.borderWidth,
      typographyRole: config.checkboxStyle?.typographyRole ?? 'body'
    };
    
    // Listen for click events
    this.on('click', () => {
      this.checked = !this.checked;
      this.wasToggledThisFrame = true;
    });
  }
  
  wasToggled(): boolean {
    const result = this.wasToggledThisFrame;
    this.wasToggledThisFrame = false;
    return result;
  }
  
  isChecked(): boolean {
    return this.checked;
  }
  
  setChecked(checked: boolean): void {
    this.checked = checked;
  }
  
  /**
   * Render method (rendering is handled by GUISystem)
   */
  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }

  protected getPreferredSize(): { width: number; height: number } {
    const labelWidth = this.label.length * 10;
    const contentWidth = this.checkboxStyle.boxSize + this.checkboxStyle.labelGap + labelWidth;
    return {
      width: Math.max(this.bounds.width, contentWidth),
      height: Math.max(this.bounds.height, this.checkboxStyle.boxSize, defaultTokens.controls.checkbox.minHeight)
    };
  }
}
