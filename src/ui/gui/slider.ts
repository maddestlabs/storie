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
    fg?: Color;
    trackColor?: Color;
    knobColor?: Color;
    knobHoverColor?: Color;
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
      fg: config.sliderStyle?.fg,
      trackColor: config.sliderStyle?.trackColor,
      knobColor: config.sliderStyle?.knobColor,
      knobHoverColor: config.sliderStyle?.knobHoverColor,
      labelGap: config.sliderStyle?.labelGap ?? defaultTokens.controls.slider.labelGap,
      trackHeight: config.sliderStyle?.trackHeight ?? defaultTokens.controls.slider.trackHeight,
      knobWidth: config.sliderStyle?.knobWidth ?? defaultTokens.controls.slider.knobWidth,
      knobHeight: config.sliderStyle?.knobHeight ?? defaultTokens.controls.slider.knobHeight,
      valueGap: config.sliderStyle?.valueGap ?? defaultTokens.controls.slider.valueGap,
      typographyRole: config.sliderStyle?.typographyRole ?? 'body'
    };
  }
  
  handleDrag(mouseX: number, mouseY: number, mouseDown: boolean, charHeight: number = 0, renderScale: number = 1): void {
    if (!this.state.visible) return;
    
    const { x, y, width, height } = this.bounds;

    // Match GUISystem.renderSlider layout: label consumes one charHeight row.
    const scale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
    const scaledLabelGap = this.sliderStyle.labelGap * scale;
    const scaledKnobWidth = this.sliderStyle.knobWidth * scale;
    const scaledKnobHeight = this.sliderStyle.knobHeight * scale;
    const labelH = this.label ? charHeight + scaledLabelGap : 0;
    const trackTopY = y + labelH;
    const trackAreaH = Math.max(0, height - labelH);
    
    // Calculate knob position and size
    const knobWidth = scaledKnobWidth;
    const range = this.max - this.min;
    const ratio = range > 0 ? (this.value - this.min) / range : 0;
    const knobX = x + ratio * (width - knobWidth);
    const knobY = trackTopY;
    const knobHeight = Math.min(trackAreaH, scaledKnobHeight);
    
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
