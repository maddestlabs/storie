import { BaseWidget, type WidgetConfig } from '../core/base-widget.js';
import type { Bounds, Direction, WidgetEvent } from '../core/types.js';
import { ColorUtils, type Color } from '../../types.js';

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export type GUIPianoNoteFlow = 'asc' | 'desc';
export type GUIPianoRailPlacement = 'leading' | 'trailing' | 'none';
export type GUIPianoLabelMode = 'none' | 'c' | 'white' | 'all';
export type GUIPianoInteractionMode = 'oneshot' | 'gate';
export type GUIPianoVelocityMode = 'fixed' | 'axis-cross';
export type GUIPianoNoteSource = 'pointer' | 'keyboard' | 'api';

export interface GUIPianoStyle {
  background?: Color;
  whiteKeyColor?: Color;
  whiteKeyHoverColor?: Color;
  whiteKeyActiveColor?: Color;
  whiteKeyBorderColor?: Color;
  blackKeyColor?: Color;
  blackKeyHoverColor?: Color;
  blackKeyActiveColor?: Color;
  blackKeyBorderColor?: Color;
  railColor?: Color;
  railThumbColor?: Color;
  railThumbHoverColor?: Color;
  railThumbActiveColor?: Color;
  railViewportColor?: Color;
  labelColor?: Color;
  blackLabelColor?: Color;
  octaveLineColor?: Color;
  focusBorderColor?: Color;
  borderWidth?: number;
  railThickness?: number;
  railPadding?: number;
  blackKeyLengthRatio?: number;
  blackKeyWidthRatio?: number;
  labelInset?: number;
  minThumbLength?: number;
}

export interface GUIPianoKeyboardConfig extends WidgetConfig {
  orientation?: Direction;
  noteFlow?: GUIPianoNoteFlow;
  railPlacement?: GUIPianoRailPlacement;
  minMidi?: number;
  maxMidi?: number;
  visibleWhiteKeys?: number;
  minVisibleWhiteKeys?: number;
  maxVisibleWhiteKeys?: number;
  firstVisibleWhiteKey?: number;
  showLabels?: GUIPianoLabelMode;
  interactionMode?: GUIPianoInteractionMode;
  velocityMode?: GUIPianoVelocityMode;
  fixedVelocity?: number;
  pianoStyle?: GUIPianoStyle;
}

export interface GUIPianoNoteEventData {
  midi: number;
  hz: number;
  velocity: number;
  noteName: string;
  source: GUIPianoNoteSource;
}

export interface GUIPianoViewportEventData {
  firstVisibleWhiteKey: number;
  visibleWhiteKeys: number;
  firstVisibleMidi: number | null;
  lastVisibleMidi: number | null;
}

export interface PianoKeySnapshot {
  midi: number;
  noteName: string;
  isBlack: boolean;
  bounds: Bounds;
  alongStart: number;
  alongSize: number;
}

export interface PianoLayoutSnapshot {
  orientation: Direction;
  noteFlow: GUIPianoNoteFlow;
  bounds: Bounds;
  mainBounds: Bounds;
  railBounds: Bounds | null;
  railThumbBounds: Bounds | null;
  totalWhiteKeys: number;
  firstVisibleWhiteKey: number;
  visibleWhiteKeys: number;
  firstVisibleMidi: number | null;
  lastVisibleMidi: number | null;
  whiteKeys: PianoKeySnapshot[];
  blackKeys: PianoKeySnapshot[];
}

export function isBlackMidi(midi: number): boolean {
  const pc = ((Math.trunc(midi) % 12) + 12) % 12;
  return BLACK_PITCH_CLASSES.has(pc);
}

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}

export function formatMidiNoteName(midi: number): string {
  const rounded = Math.trunc(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

export function collectWhiteMidis(minMidi: number, maxMidi: number): number[] {
  const lo = Math.min(Math.trunc(minMidi), Math.trunc(maxMidi));
  const hi = Math.max(Math.trunc(minMidi), Math.trunc(maxMidi));
  const result: number[] = [];
  for (let midi = lo; midi <= hi; midi++) {
    if (!isBlackMidi(midi)) result.push(midi);
  }
  return result;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function cloneBounds(bounds: Bounds): Bounds {
  return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}

function boundsContains(bounds: Bounds | null, x: number, y: number): boolean {
  if (!bounds) return false;
  return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}

function maxStartIndex(totalWhiteKeys: number, visibleWhiteKeys: number): number {
  return Math.max(0, totalWhiteKeys - visibleWhiteKeys);
}

export function buildPianoLayout(options: {
  bounds: Bounds;
  orientation: Direction;
  noteFlow: GUIPianoNoteFlow;
  railPlacement: GUIPianoRailPlacement;
  railThickness: number;
  railPadding: number;
  minThumbLength: number;
  minMidi: number;
  maxMidi: number;
  firstVisibleWhiteKey: number;
  visibleWhiteKeys: number;
  blackKeyLengthRatio: number;
  blackKeyWidthRatio: number;
}): PianoLayoutSnapshot {
  const bounds = cloneBounds(options.bounds);
  const whiteMidis = collectWhiteMidis(options.minMidi, options.maxMidi);
  const totalWhiteKeys = Math.max(1, whiteMidis.length);
  const visibleWhiteKeys = clamp(Math.round(options.visibleWhiteKeys), 1, totalWhiteKeys);
  const firstVisibleWhiteKey = clamp(Math.round(options.firstVisibleWhiteKey), 0, maxStartIndex(totalWhiteKeys, visibleWhiteKeys));
  const railThickness = options.railPlacement === 'none' ? 0 : Math.max(0, Number(options.railThickness) || 0);

  let railBounds: Bounds | null = null;
  const mainBounds = cloneBounds(bounds);
  if (railThickness > 0) {
    if (options.orientation === 'horizontal') {
      if (options.railPlacement === 'leading') {
        railBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: railThickness };
        mainBounds.y += railThickness;
        mainBounds.height = Math.max(0, mainBounds.height - railThickness);
      } else if (options.railPlacement === 'trailing') {
        railBounds = { x: bounds.x, y: bounds.y + bounds.height - railThickness, width: bounds.width, height: railThickness };
        mainBounds.height = Math.max(0, mainBounds.height - railThickness);
      }
    } else {
      if (options.railPlacement === 'leading') {
        railBounds = { x: bounds.x, y: bounds.y, width: railThickness, height: bounds.height };
        mainBounds.x += railThickness;
        mainBounds.width = Math.max(0, mainBounds.width - railThickness);
      } else if (options.railPlacement === 'trailing') {
        railBounds = { x: bounds.x + bounds.width - railThickness, y: bounds.y, width: railThickness, height: bounds.height };
        mainBounds.width = Math.max(0, mainBounds.width - railThickness);
      }
    }
  }

  const alongSpan = options.orientation === 'horizontal' ? mainBounds.width : mainBounds.height;
  const crossSpan = options.orientation === 'horizontal' ? mainBounds.height : mainBounds.width;
  const alongOrigin = options.orientation === 'horizontal' ? mainBounds.x : mainBounds.y;
  const whiteAlongSize = visibleWhiteKeys > 0 ? alongSpan / visibleWhiteKeys : 0;
  const blackAlongSize = whiteAlongSize * clamp(options.blackKeyWidthRatio, 0.15, 0.95);
  const blackCrossSize = crossSpan * clamp(options.blackKeyLengthRatio, 0.2, 1);

  const whiteKeys: PianoKeySnapshot[] = [];
  for (let visibleIndex = 0; visibleIndex < visibleWhiteKeys; visibleIndex++) {
    const globalWhiteIndex = firstVisibleWhiteKey + visibleIndex;
    const midi = whiteMidis[globalWhiteIndex];
    const alongStart = options.noteFlow === 'asc'
      ? alongOrigin + visibleIndex * whiteAlongSize
      : alongOrigin + alongSpan - (visibleIndex + 1) * whiteAlongSize;
    const boundsForKey = options.orientation === 'horizontal'
      ? { x: alongStart, y: mainBounds.y, width: whiteAlongSize, height: crossSpan }
      : { x: mainBounds.x, y: alongStart, width: crossSpan, height: whiteAlongSize };
    whiteKeys.push({
      midi,
      noteName: formatMidiNoteName(midi),
      isBlack: false,
      bounds: boundsForKey,
      alongStart,
      alongSize: whiteAlongSize
    });
  }

  const blackKeys: PianoKeySnapshot[] = [];
  for (let index = 0; index < whiteKeys.length - 1; index++) {
    const midi = whiteKeys[index].midi + 1;
    if (midi < options.minMidi || midi > options.maxMidi || !isBlackMidi(midi)) continue;
    const boundary = options.noteFlow === 'asc'
      ? whiteKeys[index].alongStart + whiteKeys[index].alongSize
      : whiteKeys[index].alongStart;
    const alongStart = boundary - blackAlongSize / 2;
    const boundsForKey = options.orientation === 'horizontal'
      ? { x: alongStart, y: mainBounds.y, width: blackAlongSize, height: blackCrossSize }
      : { x: mainBounds.x, y: alongStart, width: blackCrossSize, height: blackAlongSize };
    blackKeys.push({
      midi,
      noteName: formatMidiNoteName(midi),
      isBlack: true,
      bounds: boundsForKey,
      alongStart,
      alongSize: blackAlongSize
    });
  }

  let railThumbBounds: Bounds | null = null;
  if (railBounds) {
    const railAlongOrigin = options.orientation === 'horizontal' ? railBounds.x : railBounds.y;
    const railAlongSpan = options.orientation === 'horizontal' ? railBounds.width : railBounds.height;
    const maximumStart = maxStartIndex(totalWhiteKeys, visibleWhiteKeys);
    const thumbAlongSize = maximumStart === 0
      ? railAlongSpan
      : clamp((railAlongSpan * visibleWhiteKeys) / totalWhiteKeys, Math.min(options.minThumbLength, railAlongSpan), railAlongSpan);
    const travel = Math.max(0, railAlongSpan - thumbAlongSize);
    const ratio = maximumStart > 0 ? firstVisibleWhiteKey / maximumStart : 0;
    const thumbAlongStart = railAlongOrigin + ratio * travel;
    const paddedRail = Math.max(0, Number(options.railPadding) || 0);
    railThumbBounds = options.orientation === 'horizontal'
      ? {
          x: thumbAlongStart,
          y: railBounds.y + paddedRail,
          width: thumbAlongSize,
          height: Math.max(0, railBounds.height - paddedRail * 2)
        }
      : {
          x: railBounds.x + paddedRail,
          y: thumbAlongStart,
          width: Math.max(0, railBounds.width - paddedRail * 2),
          height: thumbAlongSize
        };
  }

  return {
    orientation: options.orientation,
    noteFlow: options.noteFlow,
    bounds,
    mainBounds,
    railBounds,
    railThumbBounds,
    totalWhiteKeys,
    firstVisibleWhiteKey,
    visibleWhiteKeys,
    firstVisibleMidi: whiteKeys.length > 0 ? whiteKeys[0].midi : null,
    lastVisibleMidi: whiteKeys.length > 0 ? whiteKeys[whiteKeys.length - 1].midi : null,
    whiteKeys,
    blackKeys
  };
}

export class GUIPianoKeyboard extends BaseWidget {
  public orientation: Direction;
  public noteFlow: GUIPianoNoteFlow;
  public railPlacement: GUIPianoRailPlacement;
  public minMidi: number;
  public maxMidi: number;
  public visibleWhiteKeys: number;
  public minVisibleWhiteKeys: number;
  public maxVisibleWhiteKeys: number;
  public firstVisibleWhiteKey: number;
  public showLabels: GUIPianoLabelMode;
  public interactionMode: GUIPianoInteractionMode;
  public velocityMode: GUIPianoVelocityMode;
  public fixedVelocity: number;
  public pianoStyle: Required<GUIPianoStyle>;

  private pointerDown: boolean = false;
  private pointerMode: 'none' | 'keys' | 'rail' = 'none';
  private railDragOffset: number = 0;
  private hoveredMidi: number | null = null;
  private activeMidi: number | null = null;

  constructor(config: GUIPianoKeyboardConfig) {
    super({ ...config, focusable: config.focusable ?? true });
    this.orientation = config.orientation ?? 'horizontal';
    this.noteFlow = config.noteFlow ?? 'asc';
    this.railPlacement = config.railPlacement ?? 'leading';
    this.minMidi = Math.trunc(config.minMidi ?? 36);
    this.maxMidi = Math.trunc(config.maxMidi ?? 96);
    if (this.maxMidi < this.minMidi) {
      const swap = this.minMidi;
      this.minMidi = this.maxMidi;
      this.maxMidi = swap;
    }
    const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
    this.minVisibleWhiteKeys = clamp(Math.round(config.minVisibleWhiteKeys ?? 7), 1, totalWhiteKeys);
    this.maxVisibleWhiteKeys = clamp(Math.round(config.maxVisibleWhiteKeys ?? 21), this.minVisibleWhiteKeys, totalWhiteKeys);
    this.visibleWhiteKeys = clamp(Math.round(config.visibleWhiteKeys ?? Math.min(14, totalWhiteKeys)), this.minVisibleWhiteKeys, this.maxVisibleWhiteKeys);
    this.firstVisibleWhiteKey = clamp(Math.round(config.firstVisibleWhiteKey ?? 0), 0, maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
    this.showLabels = config.showLabels ?? 'c';
    this.interactionMode = config.interactionMode ?? 'gate';
    this.velocityMode = config.velocityMode ?? 'fixed';
    this.fixedVelocity = clamp(Number(config.fixedVelocity ?? 0.85), 0.05, 1);
    this.pianoStyle = {
      background: config.pianoStyle?.background ?? ColorUtils.rgba(10, 14, 20, 210),
      whiteKeyColor: config.pianoStyle?.whiteKeyColor ?? ColorUtils.rgba(248, 246, 238, 255),
      whiteKeyHoverColor: config.pianoStyle?.whiteKeyHoverColor ?? ColorUtils.rgba(255, 252, 244, 255),
      whiteKeyActiveColor: config.pianoStyle?.whiteKeyActiveColor ?? ColorUtils.rgba(245, 206, 124, 255),
      whiteKeyBorderColor: config.pianoStyle?.whiteKeyBorderColor ?? ColorUtils.rgba(44, 48, 58, 255),
      blackKeyColor: config.pianoStyle?.blackKeyColor ?? ColorUtils.rgba(26, 30, 38, 255),
      blackKeyHoverColor: config.pianoStyle?.blackKeyHoverColor ?? ColorUtils.rgba(40, 48, 60, 255),
      blackKeyActiveColor: config.pianoStyle?.blackKeyActiveColor ?? ColorUtils.rgba(237, 162, 82, 255),
      blackKeyBorderColor: config.pianoStyle?.blackKeyBorderColor ?? ColorUtils.rgba(6, 8, 12, 255),
      railColor: config.pianoStyle?.railColor ?? ColorUtils.rgba(20, 26, 34, 255),
      railThumbColor: config.pianoStyle?.railThumbColor ?? ColorUtils.rgba(96, 122, 150, 255),
      railThumbHoverColor: config.pianoStyle?.railThumbHoverColor ?? ColorUtils.rgba(132, 164, 196, 255),
      railThumbActiveColor: config.pianoStyle?.railThumbActiveColor ?? ColorUtils.rgba(238, 185, 92, 255),
      railViewportColor: config.pianoStyle?.railViewportColor ?? ColorUtils.rgba(210, 220, 232, 30),
      labelColor: config.pianoStyle?.labelColor ?? ColorUtils.rgba(28, 34, 44, 255),
      blackLabelColor: config.pianoStyle?.blackLabelColor ?? ColorUtils.rgba(244, 246, 250, 255),
      octaveLineColor: config.pianoStyle?.octaveLineColor ?? ColorUtils.rgba(208, 135, 74, 180),
      focusBorderColor: config.pianoStyle?.focusBorderColor ?? ColorUtils.rgba(251, 176, 88, 255),
      borderWidth: Math.max(1, config.pianoStyle?.borderWidth ?? 1),
      railThickness: Math.max(0, config.pianoStyle?.railThickness ?? 28),
      railPadding: Math.max(0, config.pianoStyle?.railPadding ?? 4),
      blackKeyLengthRatio: clamp(config.pianoStyle?.blackKeyLengthRatio ?? 0.62, 0.2, 0.95),
      blackKeyWidthRatio: clamp(config.pianoStyle?.blackKeyWidthRatio ?? 0.7, 0.2, 0.95),
      labelInset: Math.max(0, config.pianoStyle?.labelInset ?? 6),
      minThumbLength: Math.max(8, config.pianoStyle?.minThumbLength ?? 18)
    };
  }

  getActiveMidi(): number | null {
    return this.activeMidi;
  }

  getHoveredMidi(): number | null {
    return this.hoveredMidi;
  }

  getViewportState(): GUIPianoViewportEventData {
    const layout = this.getLayoutSnapshot();
    return {
      firstVisibleWhiteKey: this.firstVisibleWhiteKey,
      visibleWhiteKeys: this.visibleWhiteKeys,
      firstVisibleMidi: layout.firstVisibleMidi,
      lastVisibleMidi: layout.lastVisibleMidi
    };
  }

  getLayoutSnapshot(): PianoLayoutSnapshot {
    return buildPianoLayout({
      bounds: this.bounds,
      orientation: this.orientation,
      noteFlow: this.noteFlow,
      railPlacement: this.railPlacement,
      railThickness: this.pianoStyle.railThickness,
      railPadding: this.pianoStyle.railPadding,
      minThumbLength: this.pianoStyle.minThumbLength,
      minMidi: this.minMidi,
      maxMidi: this.maxMidi,
      firstVisibleWhiteKey: this.firstVisibleWhiteKey,
      visibleWhiteKeys: this.visibleWhiteKeys,
      blackKeyLengthRatio: this.pianoStyle.blackKeyLengthRatio,
      blackKeyWidthRatio: this.pianoStyle.blackKeyWidthRatio
    });
  }

  setFirstVisibleWhiteKey(index: number, emit: boolean = true): boolean {
    const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
    const next = clamp(Math.round(index), 0, maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
    if (next === this.firstVisibleWhiteKey) return false;
    this.firstVisibleWhiteKey = next;
    if (emit) this.emitViewportChange();
    return true;
  }

  panWhiteKeys(delta: number, emit: boolean = true): boolean {
    return this.setFirstVisibleWhiteKey(this.firstVisibleWhiteKey + Math.round(delta), emit);
  }

  setVisibleWhiteKeys(count: number, anchorRatio: number = 0.5, emit: boolean = true): boolean {
    const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
    const nextCount = clamp(Math.round(count), this.minVisibleWhiteKeys, Math.min(this.maxVisibleWhiteKeys, totalWhiteKeys));
    if (nextCount === this.visibleWhiteKeys) return false;
    const clampedAnchor = clamp(Number(anchorRatio) || 0.5, 0, 1);
    const anchorWhite = this.firstVisibleWhiteKey + clampedAnchor * Math.max(0, this.visibleWhiteKeys - 1);
    this.visibleWhiteKeys = nextCount;
    const nextFirst = Math.round(anchorWhite - clampedAnchor * Math.max(0, this.visibleWhiteKeys - 1));
    this.firstVisibleWhiteKey = clamp(nextFirst, 0, maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
    if (emit) this.emitViewportChange();
    return true;
  }

  zoomBy(deltaWhiteKeys: number, anchorRatio: number = 0.5, emit: boolean = true): boolean {
    return this.setVisibleWhiteKeys(this.visibleWhiteKeys + Math.round(deltaWhiteKeys), anchorRatio, emit);
  }

  noteOn(midi: number, velocity: number = this.fixedVelocity, source: GUIPianoNoteSource = 'api'): boolean {
    const rounded = Math.trunc(midi);
    if (rounded < this.minMidi || rounded > this.maxMidi) return false;
    this.activeMidi = rounded;
    this.emitNoteEvent('noteon', rounded, clamp(velocity, 0, 1), source);
    return true;
  }

  noteOff(midi?: number, velocity: number = 0, source: GUIPianoNoteSource = 'api'): boolean {
    const target = Math.trunc(midi ?? this.activeMidi ?? NaN);
    if (!Number.isFinite(target) || target < this.minMidi || target > this.maxMidi) return false;
    if (this.activeMidi === target) this.activeMidi = null;
    this.emitNoteEvent('noteoff', target, clamp(velocity, 0, 1), source);
    return true;
  }

  onNoteOn(callback: (event: WidgetEvent) => void): void {
    this.on('noteon', callback);
  }

  onNoteOff(callback: (event: WidgetEvent) => void): void {
    this.on('noteoff', callback);
  }

  onViewportChange(callback: (event: WidgetEvent) => void): void {
    this.on('viewportchange', callback);
  }

  handleKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }): boolean {
    if (!this.state.enabled) return false;
    if (modifiers?.ctrl || modifiers?.alt) return false;
    const step = modifiers?.shift ? 7 : 1;
    if (key === 'ArrowRight' || key === 'ArrowUp') return this.panWhiteKeys(step);
    if (key === 'ArrowLeft' || key === 'ArrowDown') return this.panWhiteKeys(-step);
    if (key === '+' || key === '=') return this.zoomBy(-1);
    if (key === '-' || key === '_') return this.zoomBy(1);
    if (key === 'PageUp') return this.panWhiteKeys(step * 2);
    if (key === 'PageDown') return this.panWhiteKeys(-step * 2);
    if (key === 'Home') return this.setFirstVisibleWhiteKey(0);
    if (key === 'End') {
      const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
      return this.setFirstVisibleWhiteKey(maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
    }
    return false;
  }

  handlePointer(mouseX: number, mouseY: number, mouseDown: boolean): void {
    if (!this.state.visible || !this.state.enabled) {
      this.pointerDown = mouseDown;
      return;
    }

    const layout = this.getLayoutSnapshot();
    const justPressed = mouseDown && !this.pointerDown;
    const justReleased = !mouseDown && this.pointerDown;
    const hit = this.hitTest(layout, mouseX, mouseY);
    this.hoveredMidi = hit ? hit.midi : null;

    if (justPressed) {
      if (boundsContains(layout.railBounds, mouseX, mouseY)) {
        this.pointerMode = 'rail';
        const thumb = layout.railThumbBounds;
        const pointerAlong = this.getAlongCoord(mouseX, mouseY);
        this.railDragOffset = thumb ? pointerAlong - this.getAlongStart(thumb) : 0;
        if (!thumb || !boundsContains(thumb, mouseX, mouseY)) {
          this.railDragOffset = thumb ? this.getAlongSize(thumb) / 2 : 0;
        }
        this.updateViewportFromRail(layout, pointerAlong);
      } else if (hit) {
        this.pointerMode = 'keys';
        this.triggerPointerNote(hit.midi, mouseX, mouseY, true);
      } else {
        this.pointerMode = 'none';
      }
    } else if (mouseDown) {
      if (this.pointerMode === 'rail') {
        this.updateViewportFromRail(layout, this.getAlongCoord(mouseX, mouseY));
      } else if (this.pointerMode === 'keys') {
        if (hit) {
          this.triggerPointerNote(hit.midi, mouseX, mouseY, false);
        } else if (this.interactionMode === 'gate' && this.activeMidi != null) {
          this.noteOff(this.activeMidi, 0, 'pointer');
        }
      }
    }

    if (justReleased) {
      if (this.pointerMode === 'keys' && this.interactionMode === 'gate' && this.activeMidi != null) {
        this.noteOff(this.activeMidi, 0, 'pointer');
      }
      this.pointerMode = 'none';
      this.railDragOffset = 0;
      if (this.interactionMode !== 'gate') {
        this.activeMidi = null;
      }
    }

    this.pointerDown = mouseDown;
  }

  render(): void {
    // No-op; GUISystem renders this widget.
  }

  protected getPreferredSize(): { width: number; height: number } {
    if (this.orientation === 'horizontal') {
      return {
        width: Math.max(this.bounds.width, this.visibleWhiteKeys * 22),
        height: Math.max(this.bounds.height, 120)
      };
    }
    return {
      width: Math.max(this.bounds.width, 96),
      height: Math.max(this.bounds.height, this.visibleWhiteKeys * 18)
    };
  }

  private hitTest(layout: PianoLayoutSnapshot, mouseX: number, mouseY: number): PianoKeySnapshot | null {
    for (const key of layout.blackKeys) {
      if (boundsContains(key.bounds, mouseX, mouseY)) return key;
    }
    for (const key of layout.whiteKeys) {
      if (boundsContains(key.bounds, mouseX, mouseY)) return key;
    }
    return null;
  }

  private getAlongCoord(mouseX: number, mouseY: number): number {
    return this.orientation === 'horizontal' ? mouseX : mouseY;
  }

  private getAlongStart(bounds: Bounds): number {
    return this.orientation === 'horizontal' ? bounds.x : bounds.y;
  }

  private getAlongSize(bounds: Bounds): number {
    return this.orientation === 'horizontal' ? bounds.width : bounds.height;
  }

  private computeVelocity(layout: PianoLayoutSnapshot, mouseX: number, mouseY: number): number {
    if (this.velocityMode === 'fixed') return this.fixedVelocity;
    const main = layout.mainBounds;
    const ratio = this.orientation === 'horizontal'
      ? (mouseY - main.y) / Math.max(1, main.height)
      : (mouseX - main.x) / Math.max(1, main.width);
    return clamp(ratio, 0.05, 1);
  }

  private triggerPointerNote(midi: number, mouseX: number, mouseY: number, initialPress: boolean): void {
    const velocity = this.computeVelocity(this.getLayoutSnapshot(), mouseX, mouseY);
    if (this.interactionMode === 'gate') {
      if (this.activeMidi === midi && !initialPress) return;
      if (this.activeMidi != null && this.activeMidi !== midi) {
        this.noteOff(this.activeMidi, 0, 'pointer');
      }
      this.noteOn(midi, velocity, 'pointer');
      return;
    }

    if (this.activeMidi !== midi || initialPress) {
      this.activeMidi = midi;
      this.emitNoteEvent('noteon', midi, velocity, 'pointer');
    }
  }

  private updateViewportFromRail(layout: PianoLayoutSnapshot, pointerAlong: number): void {
    if (!layout.railBounds || !layout.railThumbBounds) return;
    const railStart = this.getAlongStart(layout.railBounds);
    const railSize = this.getAlongSize(layout.railBounds);
    const thumbSize = this.getAlongSize(layout.railThumbBounds);
    const travel = Math.max(0, railSize - thumbSize);
    const maximumStart = maxStartIndex(layout.totalWhiteKeys, this.visibleWhiteKeys);
    if (maximumStart <= 0 || travel <= 0) {
      this.setFirstVisibleWhiteKey(0);
      return;
    }
    const thumbAlongStart = clamp(pointerAlong - this.railDragOffset, railStart, railStart + travel);
    const ratio = (thumbAlongStart - railStart) / travel;
    this.setFirstVisibleWhiteKey(Math.round(ratio * maximumStart));
  }

  private emitViewportChange(): void {
    const viewport = this.getViewportState();
    this.emit({
      type: 'viewportchange',
      widget: this.id,
      timestamp: Date.now(),
      data: viewport
    });
  }

  private emitNoteEvent(type: 'noteon' | 'noteoff', midi: number, velocity: number, source: GUIPianoNoteSource): void {
    const data: GUIPianoNoteEventData = {
      midi,
      hz: midiToHz(midi),
      velocity,
      noteName: formatMidiNoteName(midi),
      source
    };
    this.emit({
      type,
      widget: this.id,
      timestamp: Date.now(),
      data
    });
  }
}