import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Color } from '../../types.js';

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
      knobHoverColor: (config.sliderStyle?.knobHoverColor ?? { r: 120, g: 170, b: 220 }) as Color
    };
  }
  
  handleDrag(mouseX: number, mouseY: number, mouseDown: boolean, charHeight: number = 0): void {
    if (!this.state.visible) return;
    
    const { x, y, width, height } = this.bounds;

    // Match GUISystem.renderSlider layout: label consumes one charHeight row.
    const labelH = this.label ? charHeight : 0;
    const trackTopY = y + labelH;
    const trackAreaH = Math.max(0, height - labelH);
    
    // Calculate knob position and size
    const knobWidth = 16;
    const range = this.max - this.min;
    const ratio = range > 0 ? (this.value - this.min) / range : 0;
    const knobX = x + ratio * (width - knobWidth);
    const knobY = trackTopY;
    const knobHeight = trackAreaH;
    
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
}
