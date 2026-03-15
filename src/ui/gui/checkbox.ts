import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

export interface GUICheckboxConfig extends WidgetConfig {
  label: string;
  checked?: boolean;
  checkboxStyle?: {
    fg?: Color;
    bg?: Color;
    checkColor?: Color;
    hoverBg?: Color;
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
    fg: Color;
    bg: Color;
    checkColor: Color;
    hoverBg: Color;
  };
  
  constructor(config: GUICheckboxConfig) {
    super(config);
    this.label = String(config.label ?? '');
    this.checked = config.checked ?? false;
    
    this.checkboxStyle = {
      fg: (config.checkboxStyle?.fg ?? { r: 220, g: 220, b: 220 }) as Color,
      bg: (config.checkboxStyle?.bg ?? { r: 40, g: 40, b: 40 }) as Color,
      checkColor: (config.checkboxStyle?.checkColor ?? { r: 0, g: 200, b: 100 }) as Color,
      hoverBg: (config.checkboxStyle?.hoverBg ?? { r: 60, g: 60, b: 60 }) as Color
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
}
