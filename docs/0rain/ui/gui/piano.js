import { BaseWidget } from '../core/base-widget.js';
import { ColorUtils } from '../../types.js';
const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export function isBlackMidi(midi) {
    const pc = ((Math.trunc(midi) % 12) + 12) % 12;
    return BLACK_PITCH_CLASSES.has(pc);
}
export function midiToHz(midi) {
    return 440 * Math.pow(2, (Number(midi) - 69) / 12);
}
export function formatMidiNoteName(midi) {
    const rounded = Math.trunc(midi);
    const pc = ((rounded % 12) + 12) % 12;
    const octave = Math.floor(rounded / 12) - 1;
    return `${NOTE_NAMES[pc]}${octave}`;
}
export function collectWhiteMidis(minMidi, maxMidi) {
    const lo = Math.min(Math.trunc(minMidi), Math.trunc(maxMidi));
    const hi = Math.max(Math.trunc(minMidi), Math.trunc(maxMidi));
    const result = [];
    for (let midi = lo; midi <= hi; midi++) {
        if (!isBlackMidi(midi))
            result.push(midi);
    }
    return result;
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function cloneBounds(bounds) {
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
}
function boundsContains(bounds, x, y) {
    if (!bounds)
        return false;
    return x >= bounds.x && x < bounds.x + bounds.width && y >= bounds.y && y < bounds.y + bounds.height;
}
function maxStartIndex(totalWhiteKeys, visibleWhiteKeys) {
    return Math.max(0, totalWhiteKeys - visibleWhiteKeys);
}
export function buildPianoLayout(options) {
    const bounds = cloneBounds(options.bounds);
    const whiteMidis = collectWhiteMidis(options.minMidi, options.maxMidi);
    const totalWhiteKeys = Math.max(1, whiteMidis.length);
    const visibleWhiteKeys = clamp(Math.round(options.visibleWhiteKeys), 1, totalWhiteKeys);
    const firstVisibleWhiteKey = clamp(Math.round(options.firstVisibleWhiteKey), 0, maxStartIndex(totalWhiteKeys, visibleWhiteKeys));
    const railThickness = options.railPlacement === 'none' ? 0 : Math.max(0, Number(options.railThickness) || 0);
    let railBounds = null;
    const mainBounds = cloneBounds(bounds);
    if (railThickness > 0) {
        if (options.orientation === 'horizontal') {
            if (options.railPlacement === 'leading') {
                railBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: railThickness };
                mainBounds.y += railThickness;
                mainBounds.height = Math.max(0, mainBounds.height - railThickness);
            }
            else if (options.railPlacement === 'trailing') {
                railBounds = { x: bounds.x, y: bounds.y + bounds.height - railThickness, width: bounds.width, height: railThickness };
                mainBounds.height = Math.max(0, mainBounds.height - railThickness);
            }
        }
        else {
            if (options.railPlacement === 'leading') {
                railBounds = { x: bounds.x, y: bounds.y, width: railThickness, height: bounds.height };
                mainBounds.x += railThickness;
                mainBounds.width = Math.max(0, mainBounds.width - railThickness);
            }
            else if (options.railPlacement === 'trailing') {
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
    const whiteKeys = [];
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
    const blackKeys = [];
    for (let index = 0; index < whiteKeys.length - 1; index++) {
        const midi = whiteKeys[index].midi + 1;
        if (midi < options.minMidi || midi > options.maxMidi || !isBlackMidi(midi))
            continue;
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
    let railThumbBounds = null;
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
    orientation;
    noteFlow;
    railPlacement;
    railGestureMode;
    railResizeMinCrossSize;
    railResizeMaxCrossSize;
    railResizeSensitivity;
    minMidi;
    maxMidi;
    visibleWhiteKeys;
    minVisibleWhiteKeys;
    maxVisibleWhiteKeys;
    firstVisibleWhiteKey;
    showLabels;
    interactionMode;
    velocityMode;
    fixedVelocity;
    pianoStyle;
    pointerDown = false;
    pointerMode = 'none';
    railDragOffset = 0;
    railDragStartAlong = 0;
    railDragStartCross = 0;
    railDragStartBounds = null;
    hoveredMidi = null;
    activeMidi = null;
    constructor(config) {
        super({ ...config, focusable: config.focusable ?? true });
        this.orientation = config.orientation ?? 'horizontal';
        this.noteFlow = config.noteFlow ?? 'asc';
        this.railPlacement = config.railPlacement ?? 'leading';
        this.railGestureMode = config.railGestureMode ?? 'scroll';
        this.railResizeMinCrossSize = Math.max(24, Number(config.railResizeMinCrossSize ?? (this.orientation === 'horizontal' ? 72 : 48)) || 24);
        this.railResizeMaxCrossSize = Math.max(this.railResizeMinCrossSize, Number(config.railResizeMaxCrossSize ?? Number.POSITIVE_INFINITY));
        this.railResizeSensitivity = Math.max(0.05, Number(config.railResizeSensitivity ?? 1) || 1);
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
    getActiveMidi() {
        return this.activeMidi;
    }
    getHoveredMidi() {
        return this.hoveredMidi;
    }
    getViewportState() {
        const layout = this.getLayoutSnapshot();
        return {
            firstVisibleWhiteKey: this.firstVisibleWhiteKey,
            visibleWhiteKeys: this.visibleWhiteKeys,
            firstVisibleMidi: layout.firstVisibleMidi,
            lastVisibleMidi: layout.lastVisibleMidi
        };
    }
    getLayoutSnapshot() {
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
    setFirstVisibleWhiteKey(index, emit = true) {
        const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
        const next = clamp(Math.round(index), 0, maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
        if (next === this.firstVisibleWhiteKey)
            return false;
        this.firstVisibleWhiteKey = next;
        if (emit)
            this.emitViewportChange();
        return true;
    }
    panWhiteKeys(delta, emit = true) {
        return this.setFirstVisibleWhiteKey(this.firstVisibleWhiteKey + Math.round(delta), emit);
    }
    setVisibleWhiteKeys(count, anchorRatio = 0.5, emit = true) {
        const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
        const nextCount = clamp(Math.round(count), this.minVisibleWhiteKeys, Math.min(this.maxVisibleWhiteKeys, totalWhiteKeys));
        if (nextCount === this.visibleWhiteKeys)
            return false;
        const clampedAnchor = clamp(Number(anchorRatio) || 0.5, 0, 1);
        const anchorWhite = this.firstVisibleWhiteKey + clampedAnchor * Math.max(0, this.visibleWhiteKeys - 1);
        this.visibleWhiteKeys = nextCount;
        const nextFirst = Math.round(anchorWhite - clampedAnchor * Math.max(0, this.visibleWhiteKeys - 1));
        this.firstVisibleWhiteKey = clamp(nextFirst, 0, maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
        if (emit)
            this.emitViewportChange();
        return true;
    }
    zoomBy(deltaWhiteKeys, anchorRatio = 0.5, emit = true) {
        return this.setVisibleWhiteKeys(this.visibleWhiteKeys + Math.round(deltaWhiteKeys), anchorRatio, emit);
    }
    noteOn(midi, velocity = this.fixedVelocity, source = 'api') {
        const rounded = Math.trunc(midi);
        if (rounded < this.minMidi || rounded > this.maxMidi)
            return false;
        this.activeMidi = rounded;
        this.emitNoteEvent('noteon', rounded, clamp(velocity, 0, 1), source);
        return true;
    }
    noteOff(midi, velocity = 0, source = 'api') {
        const target = Math.trunc(midi ?? this.activeMidi ?? NaN);
        if (!Number.isFinite(target) || target < this.minMidi || target > this.maxMidi)
            return false;
        if (this.activeMidi === target)
            this.activeMidi = null;
        this.emitNoteEvent('noteoff', target, clamp(velocity, 0, 1), source);
        return true;
    }
    onNoteOn(callback) {
        this.on('noteon', callback);
    }
    onNoteOff(callback) {
        this.on('noteoff', callback);
    }
    onViewportChange(callback) {
        this.on('viewportchange', callback);
    }
    onRailGesture(callback) {
        this.on('railgesture', callback);
    }
    handleKey(key, modifiers) {
        if (!this.state.enabled)
            return false;
        if (modifiers?.ctrl || modifiers?.alt)
            return false;
        const step = modifiers?.shift ? 7 : 1;
        if (key === 'ArrowRight' || key === 'ArrowUp')
            return this.panWhiteKeys(step);
        if (key === 'ArrowLeft' || key === 'ArrowDown')
            return this.panWhiteKeys(-step);
        if (key === '+' || key === '=')
            return this.zoomBy(-1);
        if (key === '-' || key === '_')
            return this.zoomBy(1);
        if (key === 'PageUp')
            return this.panWhiteKeys(step * 2);
        if (key === 'PageDown')
            return this.panWhiteKeys(-step * 2);
        if (key === 'Home')
            return this.setFirstVisibleWhiteKey(0);
        if (key === 'End') {
            const totalWhiteKeys = collectWhiteMidis(this.minMidi, this.maxMidi).length || 1;
            return this.setFirstVisibleWhiteKey(maxStartIndex(totalWhiteKeys, this.visibleWhiteKeys));
        }
        return false;
    }
    handlePointer(mouseX, mouseY, mouseDown) {
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
                const pointerCross = this.getCrossCoord(mouseX, mouseY);
                this.railDragOffset = thumb ? pointerAlong - this.getAlongStart(thumb) : 0;
                this.railDragStartAlong = pointerAlong;
                this.railDragStartCross = pointerCross;
                this.railDragStartBounds = cloneBounds(this.bounds);
                if (!thumb || !boundsContains(thumb, mouseX, mouseY)) {
                    this.railDragOffset = thumb ? this.getAlongSize(thumb) / 2 : 0;
                }
                this.updateViewportFromRail(layout, pointerAlong);
                this.emitRailGesture('start', pointerAlong, pointerCross);
            }
            else if (hit) {
                this.pointerMode = 'keys';
                this.triggerPointerNote(hit.midi, mouseX, mouseY, true);
            }
            else {
                this.pointerMode = 'none';
            }
        }
        else if (mouseDown) {
            if (this.pointerMode === 'rail') {
                const pointerAlong = this.getAlongCoord(mouseX, mouseY);
                const pointerCross = this.getCrossCoord(mouseX, mouseY);
                this.updateViewportFromRail(layout, pointerAlong);
                this.emitRailGesture('drag', pointerAlong, pointerCross);
            }
            else if (this.pointerMode === 'keys') {
                if (hit) {
                    this.triggerPointerNote(hit.midi, mouseX, mouseY, false);
                }
                else if (this.interactionMode === 'gate' && this.activeMidi != null) {
                    this.noteOff(this.activeMidi, 0, 'pointer');
                }
            }
        }
        if (justReleased) {
            if (this.pointerMode === 'rail') {
                this.emitRailGesture('end', this.getAlongCoord(mouseX, mouseY), this.getCrossCoord(mouseX, mouseY));
            }
            if (this.pointerMode === 'keys' && this.interactionMode === 'gate' && this.activeMidi != null) {
                this.noteOff(this.activeMidi, 0, 'pointer');
            }
            this.pointerMode = 'none';
            this.railDragOffset = 0;
            this.railDragStartAlong = 0;
            this.railDragStartCross = 0;
            this.railDragStartBounds = null;
            if (this.interactionMode !== 'gate') {
                this.activeMidi = null;
            }
        }
        this.pointerDown = mouseDown;
    }
    render() {
        // No-op; GUISystem renders this widget.
    }
    getPreferredSize() {
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
    hitTest(layout, mouseX, mouseY) {
        for (const key of layout.blackKeys) {
            if (boundsContains(key.bounds, mouseX, mouseY))
                return key;
        }
        for (const key of layout.whiteKeys) {
            if (boundsContains(key.bounds, mouseX, mouseY))
                return key;
        }
        return null;
    }
    getAlongCoord(mouseX, mouseY) {
        return this.orientation === 'horizontal' ? mouseX : mouseY;
    }
    getCrossCoord(mouseX, mouseY) {
        return this.orientation === 'horizontal' ? mouseY : mouseX;
    }
    getAlongStart(bounds) {
        return this.orientation === 'horizontal' ? bounds.x : bounds.y;
    }
    getAlongSize(bounds) {
        return this.orientation === 'horizontal' ? bounds.width : bounds.height;
    }
    getCrossStart(bounds) {
        return this.orientation === 'horizontal' ? bounds.y : bounds.x;
    }
    getCrossSize(bounds) {
        return this.orientation === 'horizontal' ? bounds.height : bounds.width;
    }
    setCrossStart(bounds, value) {
        if (this.orientation === 'horizontal')
            bounds.y = value;
        else
            bounds.x = value;
    }
    setCrossSize(bounds, value) {
        if (this.orientation === 'horizontal')
            bounds.height = value;
        else
            bounds.width = value;
    }
    computeVelocity(layout, mouseX, mouseY) {
        if (this.velocityMode === 'fixed')
            return this.fixedVelocity;
        const main = layout.mainBounds;
        const ratio = this.orientation === 'horizontal'
            ? (mouseY - main.y) / Math.max(1, main.height)
            : (mouseX - main.x) / Math.max(1, main.width);
        return clamp(ratio, 0.05, 1);
    }
    triggerPointerNote(midi, mouseX, mouseY, initialPress) {
        const velocity = this.computeVelocity(this.getLayoutSnapshot(), mouseX, mouseY);
        if (this.interactionMode === 'gate') {
            if (this.activeMidi === midi && !initialPress)
                return;
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
    updateViewportFromRail(layout, pointerAlong) {
        if (!layout.railBounds || !layout.railThumbBounds)
            return;
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
    buildRailGestureSuggestedBounds(pointerCross) {
        const startBounds = cloneBounds(this.railDragStartBounds ?? this.bounds);
        if (this.railGestureMode !== 'scroll-resize' || this.railPlacement === 'none')
            return startBounds;
        const startCrossStart = this.getCrossStart(startBounds);
        const startCrossSize = this.getCrossSize(startBounds);
        const deltaCross = (pointerCross - this.railDragStartCross) * this.railResizeSensitivity;
        const minCrossSize = this.railResizeMinCrossSize;
        const maxCrossSize = this.railResizeMaxCrossSize;
        let nextCrossSize = startCrossSize;
        let nextCrossStart = startCrossStart;
        if (this.railPlacement === 'leading') {
            nextCrossSize = clamp(startCrossSize - deltaCross, minCrossSize, maxCrossSize);
            nextCrossStart = startCrossStart + (startCrossSize - nextCrossSize);
        }
        else {
            nextCrossSize = clamp(startCrossSize + deltaCross, minCrossSize, maxCrossSize);
        }
        this.setCrossStart(startBounds, nextCrossStart);
        this.setCrossSize(startBounds, nextCrossSize);
        return startBounds;
    }
    emitRailGesture(phase, pointerAlong, pointerCross) {
        const startBounds = cloneBounds(this.railDragStartBounds ?? this.bounds);
        const data = {
            phase,
            pointerAlong,
            pointerCross,
            deltaAlong: pointerAlong - this.railDragStartAlong,
            deltaCross: pointerCross - this.railDragStartCross,
            startBounds,
            suggestedBounds: this.buildRailGestureSuggestedBounds(pointerCross),
            viewport: this.getViewportState()
        };
        this.emit({
            type: 'railgesture',
            widget: this.id,
            timestamp: Date.now(),
            data
        });
    }
    emitViewportChange() {
        const viewport = this.getViewportState();
        this.emit({
            type: 'viewportchange',
            widget: this.id,
            timestamp: Date.now(),
            data: viewport
        });
    }
    emitNoteEvent(type, midi, velocity, source) {
        const data = {
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
//# sourceMappingURL=piano.js.map