import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUISliderConfig extends WidgetConfig {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  step?: number;
  sliderStyle?: {
    fg?: Color;
    trackColor?: Color;
    knobColor?: Color;
    knobHoverColor?: Color;
    labelGap?: number;
    trackHeight?: number;
    knobWidth?: number;
    knobHeight?: number;
    valueGap?: number;
    typographyRole?: GUITypographyRole;
  };
}

/**
 * Slider widget with draggable knob and graphical rendering
 */
export class GUISlider extends BaseWidget {
  public label: string;
  public min:number;
  public max: number;
  public value: number;
  public step: number;
  private dragging: boolean = false;
  public sliderStyle: {
    fg: Color;
    trackColor: Color;
    knobColor: Color;
    knobHoverColor: Color;
    labelGap: number;
    trackHeight: number;
    knobWidth: number;
    knobHeight: number;
    valueGap: number;
    typographyRole: GUITypographyRole;
  };

  private dragOffsetX: number = 0;
  
  constructor(config: GUISliderConfig) {
    super(config);
    this.label = config.label ?? '';
    this.min = config.min ?? 0;
    this.max = config.max ?? 100;
    this.value = config.value ?? 50;
    this.step = config.step ?? 1;
    
    this.sliderStyle = {
      fg: (config.sliderStyle?.fg ?? { r: 220, g: 220, b: 220 }) as Color,
      trackColor: (config.sliderStyle?.trackColor ?? { r: 60, g: 60, b: 60 }) as Color,
      knobColor: (config.sliderStyle?.knobColor ?? { r: 100, g: 150, b: 200 }) as Color,
      knobHoverColor: (config.sliderStyle?.knobHoverColor ?? { r: 120, g: 170, b: 220 }) as Color,
      labelGap: config.sliderStyle?.labelGap ?? defaultTokens.controls.slider.labelGap,
      trackHeight: config.sliderStyle?.trackHeight ?? defaultTokens.controls.slider.trackHeight,
      knobWidth: config.sliderStyle?.knobWidth ?? defaultTokens.controls.slider.knobWidth,
      knobHeight: config.sliderStyle?.knobHeight ?? defaultTokens.controls.slider.knobHeight,
      valueGap: config.sliderStyle?.valueGap ?? defaultTokens.controls.slider.valueGap,
      typographyRole: config.sliderStyle?.typographyRole ?? 'body'
    };
  }
  
  handleDrag(mouseX: number, mouseY: number, mouseDown: boolean, charHeight: number = 0): void {
    if (!this.state.visible) return;
    
    const { x, y, width, height } = this.bounds;

    // Match GUISystem.renderSlider layout: label consumes one charHeight row.
    const labelH = this.label ? charHeight + this.sliderStyle.labelGap : 0;
    const trackTopY = y + labelH;
    const trackAreaH = Math.max(0, height - labelH);
    
    // Calculate knob position and size
    const knobWidth = this.sliderStyle.knobWidth;
    const range = this.max - this.min;
    const ratio = range > 0 ? (this.value - this.min) / range : 0;
    const knobX = x + ratio * (width - knobWidth);
    const knobY = trackTopY;
    const knobHeight = Math.min(trackAreaH, this.sliderStyle.knobHeight);
    
    // Check if mouse is over the knob specifically
    const overKnob = mouseX >= knobX && mouseX < knobX + knobWidth &&
                     mouseY >= knobY && mouseY < knobY + knobHeight;

    // Also allow click anywhere in the track area to start dragging.
    // Track area is the slider bounds minus the optional label row.
    const overTrack = mouseX >= x && mouseX < x + width &&
              mouseY >= trackTopY && mouseY < trackTopY + trackAreaH;
    
    // Start dragging when clicking on knob OR anywhere on track
    if (mouseDown && (overKnob || overTrack) && !this.dragging) {
      this.dragging = true;

      // Keep knob anchored under pointer during drag
      if (overKnob) {
        this.dragOffsetX = mouseX - knobX;
      } else {
        this.dragOffsetX = knobWidth / 2;
      }
    }
    
    // Stop dragging when mouse is released
    if (!mouseDown) {
      this.dragging = false;
    }
    
    // Update value while dragging
    if (this.dragging) {
      // Calculate value from mouse position
      const relativeX = Math.max(0, Math.min(width - knobWidth, mouseX - x - this.dragOffsetX));
      const newRatio = (width - knobWidth) > 0 ? relativeX / (width - knobWidth) : 0;
      const rawValue = this.min + newRatio * (this.max - this.min);
      this.value = Math.round(rawValue / this.step) * this.step;
      this.value = Math.max(this.min, Math.min(this.max, this.value));
    }
  }
  
  getValue(): number {
    return this.value;
  }
  
  setValue(value: number): void {
    this.value = Math.max(this.min, Math.min(this.max, value));
  }
  
  isDragging(): boolean {
    return this.dragging;
  }
  
  /**
   * Render method (rendering is handled by GUISystem)
   */
  render(): void {
    // No-op: GUI widgets are rendered by GUISystem.render()
  }

  protected getPreferredSize(): { width: number; height: number } {
    const labelWidth = this.label.length * 10;
    const trackWidth = Math.max(120, this.bounds.width);
    const contentHeight = this.label
      ? 18 + this.sliderStyle.labelGap + this.sliderStyle.knobHeight
      : this.sliderStyle.knobHeight;
    return {
      width: Math.max(this.bounds.width, labelWidth + trackWidth + this.sliderStyle.valueGap + 32),
      height: Math.max(this.bounds.height, contentHeight, defaultTokens.controls.slider.minHeight)
    };
  }
}
