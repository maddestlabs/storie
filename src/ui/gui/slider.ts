import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Direction } from '../core/types.js';
import type { Color } from '../../types.js';
import { createDefaultGUITokens, type GUITypographyRole } from './tokens.js';

const defaultTokens = createDefaultGUITokens();

export interface GUISliderConfig extends WidgetConfig {
  orientation?: Direction;
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  step?: number;
  showValue?: boolean;
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
  public orientation: Direction;
  public label: string;
  public min:number;
  public max: number;
  public value: number;
  public step: number;
  public showValue: boolean;
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

  private dragOffsetMain: number = 0;
  
  constructor(config: GUISliderConfig) {
    super(config);
    this.orientation = config.orientation ?? 'horizontal';
    this.label = config.label ?? '';
    this.min = config.min ?? 0;
    this.max = config.max ?? 100;
    this.value = config.value ?? 50;
    this.step = config.step ?? 1;
    this.showValue = config.showValue ?? true;
    
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
    
    const scale = Number.isFinite(renderScale) && renderScale > 0 ? renderScale : 1;
    const layout = this.getLayout(charHeight, scale);
    const knobBounds = layout.knobBounds;
    const overKnob = mouseX >= knobBounds.x && mouseX < knobBounds.x + knobBounds.width &&
      mouseY >= knobBounds.y && mouseY < knobBounds.y + knobBounds.height;
    const overTrack = mouseX >= layout.trackBounds.x && mouseX < layout.trackBounds.x + layout.trackBounds.width &&
      mouseY >= layout.trackBounds.y && mouseY < layout.trackBounds.y + layout.trackBounds.height;
    
    // Start dragging when clicking on knob OR anywhere on track
    if (mouseDown && (overKnob || overTrack) && !this.dragging) {
      this.dragging = true;
      const pointerMain = this.orientation === 'horizontal' ? mouseX : mouseY;
      if (overKnob) {
        this.dragOffsetMain = pointerMain - layout.knobMainStart;
      } else {
        this.dragOffsetMain = layout.knobMainSize / 2;
      }
    }
    
    // Stop dragging when mouse is released
    if (!mouseDown) {
      this.dragging = false;
    }
    
    // Update value while dragging
    if (this.dragging) {
      const pointerMain = this.orientation === 'horizontal' ? mouseX : mouseY;
      const relativeMain = Math.max(0, Math.min(layout.trackMainSize - layout.knobMainSize, pointerMain - layout.trackMainStart - this.dragOffsetMain));
      let newRatio = (layout.trackMainSize - layout.knobMainSize) > 0 ? relativeMain / (layout.trackMainSize - layout.knobMainSize) : 0;
      if (this.orientation === 'vertical') newRatio = 1 - newRatio;
      const rawValue = this.min + newRatio * (this.max - this.min);
      this.value = Math.round(rawValue / this.step) * this.step;
      this.value = Math.max(this.min, Math.min(this.max, this.value));
    }
  }

  private getLayout(charHeight: number, scale: number): {
    trackBounds: { x: number; y: number; width: number; height: number };
    knobBounds: { x: number; y: number; width: number; height: number };
    trackMainStart: number;
    trackMainSize: number;
    knobMainStart: number;
    knobMainSize: number;
  } {
    const { x, y, width, height } = this.bounds;
    const scaledLabelGap = this.sliderStyle.labelGap * scale;
    const scaledTrackHeight = this.sliderStyle.trackHeight * scale;
    const scaledKnobWidth = this.sliderStyle.knobWidth * scale;
    const scaledKnobHeight = this.sliderStyle.knobHeight * scale;
    const range = this.max - this.min;
    const ratio = range > 0 ? (this.value - this.min) / range : 0;

    if (this.orientation === 'horizontal') {
      const labelH = this.label ? charHeight + scaledLabelGap : 0;
      const trackAreaH = Math.max(0, height - labelH);
      const trackY = y + labelH + Math.max(0, (trackAreaH - scaledTrackHeight) / 2);
      const knobHeight = Math.min(trackAreaH, scaledKnobHeight);
      const knobX = x + ratio * Math.max(0, width - scaledKnobWidth);
      const knobY = y + labelH + Math.max(0, (trackAreaH - knobHeight) / 2);
      return {
        trackBounds: { x, y: trackY, width, height: scaledTrackHeight },
        knobBounds: { x: knobX, y: knobY, width: scaledKnobWidth, height: knobHeight },
        trackMainStart: x,
        trackMainSize: width,
        knobMainStart: knobX,
        knobMainSize: scaledKnobWidth
      };
    }

    const labelH = this.label ? charHeight + scaledLabelGap : 0;
    const valueReserve = this.showValue ? charHeight + this.sliderStyle.valueGap * scale : 0;
    const trackAreaY = y + labelH;
    const trackAreaH = Math.max(0, height - labelH - valueReserve);
    const trackX = x + Math.max(0, (width - scaledTrackHeight) / 2);
    const knobWidth = Math.min(width, scaledKnobWidth);
    const knobHeight = Math.min(trackAreaH, scaledKnobHeight);
    const knobTravel = Math.max(0, trackAreaH - knobHeight);
    const knobY = trackAreaY + (1 - ratio) * knobTravel;
    const knobX = x + Math.max(0, (width - knobWidth) / 2);
    return {
      trackBounds: { x: trackX, y: trackAreaY, width: scaledTrackHeight, height: trackAreaH },
      knobBounds: { x: knobX, y: knobY, width: knobWidth, height: knobHeight },
      trackMainStart: trackAreaY,
      trackMainSize: trackAreaH,
      knobMainStart: knobY,
      knobMainSize: knobHeight
    };
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
    if (this.orientation === 'vertical') {
      const labelWidth = this.label.length * 10;
      const contentWidth = Math.max(this.bounds.width, this.sliderStyle.knobWidth, labelWidth);
      const contentHeight = Math.max(this.bounds.height, 140);
      return {
        width: Math.max(contentWidth, defaultTokens.controls.slider.minHeight),
        height: contentHeight
      };
    }
    const labelWidth = this.label.length * 10;
    const trackWidth = Math.max(120, this.bounds.width);
    const contentHeight = this.label
      ? 18 + this.sliderStyle.labelGap + this.sliderStyle.knobHeight
      : this.sliderStyle.knobHeight;
    return {
      width: Math.max(this.bounds.width, labelWidth + trackWidth + (this.showValue ? this.sliderStyle.valueGap + 32 : 0)),
      height: Math.max(this.bounds.height, contentHeight, defaultTokens.controls.slider.minHeight)
    };
  }
}
