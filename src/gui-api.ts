/**
 * GUI API for Sandbox
 * Exposes retained-mode GUI functionality to sandboxed JavaScript
 */

import { GUISystem } from './ui/gui/index.js';
import { GUITextField } from './ui/gui/textfield.js';
import { GUITextEditor } from './ui/gui/texteditor.js';
import type { GUITokenPatch, GUITokens } from './ui/gui/tokens.js';
import type { SafeAreaInsets } from './types.js';

/**
 * Create GUI API for sandbox compartment
 * This gets exposed to user JavaScript code
 */
export function createGUIAPI(
  getMetrics: () => { charWidth: number; charHeight: number },
  getStyle?: (name: string) => any,
  isTrustedUserInput?: () => boolean,
  getPixelScale?: () => { scaleX: number; scaleY: number },
  getViewportRect?: () => { x: number; y: number; width: number; height: number },
  getSafeAreaInsets?: () => SafeAreaInsets,
  getCurrentWorldSection?: () => number | null,
  resolveWorldSectionSelector?: (selector: number | string) => number | null
) {
  const defaultBreakpointThresholds = {
    sm: 480,
    md: 768,
    lg: 1024,
    xl: 1440
  };

  const safeGetScale = (): { scaleX: number; scaleY: number } => {
    try {
      if (typeof getPixelScale === 'function') {
        const s = getPixelScale();
        const sx = Number((s as any)?.scaleX);
        const sy = Number((s as any)?.scaleY);
        if (Number.isFinite(sx) && sx > 0 && Number.isFinite(sy) && sy > 0) {
          return { scaleX: sx, scaleY: sy };
        }
      }
    } catch {
      // ignore
    }

    const dpr = (typeof window !== 'undefined' && (window as any).devicePixelRatio)
      ? Number((window as any).devicePixelRatio)
      : 1;
    const v = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
    return { scaleX: v, scaleY: v };
  };

  const scaleBounds = (bounds: any): any => {
    if (!bounds) return bounds;
    const { scaleX, scaleY } = safeGetScale();
    const x = Number(bounds.x);
    const y = Number(bounds.y);
    const width = Number(bounds.width);
    const height = Number(bounds.height);
    if (![x, y, width, height].every(Number.isFinite)) return bounds;
    return {
      x: x * scaleX,
      y: y * scaleY,
      width: width * scaleX,
      height: height * scaleY
    };
  };

  const scaleLength = (value: any): any => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const { scaleX, scaleY } = safeGetScale();
    // When X/Y scale differ (mobile viewport quirks), prefer the larger so
    // padding/gap doesn't collapse and cause overlaps.
    const s = Math.max(scaleX, scaleY);
    return n * s;
  };

  const unscaleLength = (value: any): any => {
    const n = Number(value);
    if (!Number.isFinite(n)) return value;
    const { scaleX, scaleY } = safeGetScale();
    const s = Math.max(scaleX, scaleY);
    if (!Number.isFinite(s) || s <= 0) return value;
    return n / s;
  };

  const scaleTokenPatch = (patch?: GUITokenPatch | null): GUITokenPatch | null => {
    if (!patch) return patch ?? null;
    const next: GUITokenPatch = {};

    if (patch.spacing) {
      next.spacing = {};
      if (typeof patch.spacing.xs === 'number') next.spacing.xs = scaleLength(patch.spacing.xs);
      if (typeof patch.spacing.sm === 'number') next.spacing.sm = scaleLength(patch.spacing.sm);
      if (typeof patch.spacing.md === 'number') next.spacing.md = scaleLength(patch.spacing.md);
      if (typeof patch.spacing.lg === 'number') next.spacing.lg = scaleLength(patch.spacing.lg);
      if (typeof patch.spacing.xl === 'number') next.spacing.xl = scaleLength(patch.spacing.xl);
    }

    if (patch.typography) {
      next.typography = {};
      for (const role of Object.keys(patch.typography) as Array<keyof NonNullable<GUITokenPatch['typography']>>) {
        const src = patch.typography?.[role];
        if (!src) continue;
        (next.typography as any)[role] = {
          ...(typeof src.lineHeight === 'number' ? { lineHeight: src.lineHeight } : {}),
          ...(typeof src.minHeight === 'number' ? { minHeight: scaleLength(src.minHeight) } : {}),
          ...(typeof src.letterSpacing === 'number' ? { letterSpacing: scaleLength(src.letterSpacing) } : {})
        };
      }
    }

    if (patch.controls) {
      next.controls = {};
      if (patch.controls.button) {
        next.controls.button = {
          ...(typeof patch.controls.button.minHeight === 'number' ? { minHeight: scaleLength(patch.controls.button.minHeight) } : {}),
          ...(typeof patch.controls.button.paddingX === 'number' ? { paddingX: scaleLength(patch.controls.button.paddingX) } : {}),
          ...(typeof patch.controls.button.paddingY === 'number' ? { paddingY: scaleLength(patch.controls.button.paddingY) } : {}),
          ...(typeof patch.controls.button.borderWidth === 'number' ? { borderWidth: scaleLength(patch.controls.button.borderWidth) } : {}),
          ...(typeof patch.controls.button.focusBorderWidth === 'number' ? { focusBorderWidth: scaleLength(patch.controls.button.focusBorderWidth) } : {})
        };
      }
      if (patch.controls.input) {
        next.controls.input = {
          ...(typeof patch.controls.input.minHeight === 'number' ? { minHeight: scaleLength(patch.controls.input.minHeight) } : {}),
          ...(typeof patch.controls.input.paddingX === 'number' ? { paddingX: scaleLength(patch.controls.input.paddingX) } : {}),
          ...(typeof patch.controls.input.paddingY === 'number' ? { paddingY: scaleLength(patch.controls.input.paddingY) } : {}),
          ...(typeof patch.controls.input.borderWidth === 'number' ? { borderWidth: scaleLength(patch.controls.input.borderWidth) } : {}),
          ...(typeof patch.controls.input.focusBorderWidth === 'number' ? { focusBorderWidth: scaleLength(patch.controls.input.focusBorderWidth) } : {})
        };
      }
      if (patch.controls.checkbox) {
        next.controls.checkbox = {
          ...(typeof patch.controls.checkbox.minHeight === 'number' ? { minHeight: scaleLength(patch.controls.checkbox.minHeight) } : {}),
          ...(typeof patch.controls.checkbox.boxSize === 'number' ? { boxSize: scaleLength(patch.controls.checkbox.boxSize) } : {}),
          ...(typeof patch.controls.checkbox.labelGap === 'number' ? { labelGap: scaleLength(patch.controls.checkbox.labelGap) } : {}),
          ...(typeof patch.controls.checkbox.borderWidth === 'number' ? { borderWidth: scaleLength(patch.controls.checkbox.borderWidth) } : {})
        };
      }
      if (patch.controls.slider) {
        next.controls.slider = {
          ...(typeof patch.controls.slider.minHeight === 'number' ? { minHeight: scaleLength(patch.controls.slider.minHeight) } : {}),
          ...(typeof patch.controls.slider.labelGap === 'number' ? { labelGap: scaleLength(patch.controls.slider.labelGap) } : {}),
          ...(typeof patch.controls.slider.trackHeight === 'number' ? { trackHeight: scaleLength(patch.controls.slider.trackHeight) } : {}),
          ...(typeof patch.controls.slider.knobWidth === 'number' ? { knobWidth: scaleLength(patch.controls.slider.knobWidth) } : {}),
          ...(typeof patch.controls.slider.knobHeight === 'number' ? { knobHeight: scaleLength(patch.controls.slider.knobHeight) } : {}),
          ...(typeof patch.controls.slider.valueGap === 'number' ? { valueGap: scaleLength(patch.controls.slider.valueGap) } : {})
        };
      }
    }

    return next;
  };

  const unscaleTokens = (tokens: GUITokens): GUITokens => ({
    spacing: {
      xs: unscaleLength(tokens.spacing.xs),
      sm: unscaleLength(tokens.spacing.sm),
      md: unscaleLength(tokens.spacing.md),
      lg: unscaleLength(tokens.spacing.lg),
      xl: unscaleLength(tokens.spacing.xl)
    },
    typography: {
      caption: {
        role: tokens.typography.caption.role,
        lineHeight: tokens.typography.caption.lineHeight,
        minHeight: unscaleLength(tokens.typography.caption.minHeight),
        letterSpacing: unscaleLength(tokens.typography.caption.letterSpacing)
      },
      body: {
        role: tokens.typography.body.role,
        lineHeight: tokens.typography.body.lineHeight,
        minHeight: unscaleLength(tokens.typography.body.minHeight),
        letterSpacing: unscaleLength(tokens.typography.body.letterSpacing)
      },
      button: {
        role: tokens.typography.button.role,
        lineHeight: tokens.typography.button.lineHeight,
        minHeight: unscaleLength(tokens.typography.button.minHeight),
        letterSpacing: unscaleLength(tokens.typography.button.letterSpacing)
      },
      title: {
        role: tokens.typography.title.role,
        lineHeight: tokens.typography.title.lineHeight,
        minHeight: unscaleLength(tokens.typography.title.minHeight),
        letterSpacing: unscaleLength(tokens.typography.title.letterSpacing)
      },
      input: {
        role: tokens.typography.input.role,
        lineHeight: tokens.typography.input.lineHeight,
        minHeight: unscaleLength(tokens.typography.input.minHeight),
        letterSpacing: unscaleLength(tokens.typography.input.letterSpacing)
      }
    },
    controls: {
      button: {
        minHeight: unscaleLength(tokens.controls.button.minHeight),
        paddingX: unscaleLength(tokens.controls.button.paddingX),
        paddingY: unscaleLength(tokens.controls.button.paddingY),
        borderWidth: unscaleLength(tokens.controls.button.borderWidth),
        focusBorderWidth: unscaleLength(tokens.controls.button.focusBorderWidth)
      },
      input: {
        minHeight: unscaleLength(tokens.controls.input.minHeight),
        paddingX: unscaleLength(tokens.controls.input.paddingX),
        paddingY: unscaleLength(tokens.controls.input.paddingY),
        borderWidth: unscaleLength(tokens.controls.input.borderWidth),
        focusBorderWidth: unscaleLength(tokens.controls.input.focusBorderWidth)
      },
      checkbox: {
        minHeight: unscaleLength(tokens.controls.checkbox.minHeight),
        boxSize: unscaleLength(tokens.controls.checkbox.boxSize),
        labelGap: unscaleLength(tokens.controls.checkbox.labelGap),
        borderWidth: unscaleLength(tokens.controls.checkbox.borderWidth)
      },
      slider: {
        minHeight: unscaleLength(tokens.controls.slider.minHeight),
        labelGap: unscaleLength(tokens.controls.slider.labelGap),
        trackHeight: unscaleLength(tokens.controls.slider.trackHeight),
        knobWidth: unscaleLength(tokens.controls.slider.knobWidth),
        knobHeight: unscaleLength(tokens.controls.slider.knobHeight),
        valueGap: unscaleLength(tokens.controls.slider.valueGap)
      }
    }
  });

  const normalizeViewport = (viewport: any): any => {
    if (!viewport || typeof viewport !== 'object') return viewport;
    const next = { ...viewport };
    const space = (viewport as any).boundsSpace === 'device' || api._boundsSpace === 'device'
      ? 'device'
      : 'css';
    if (space === 'css') {
      next.x = scaleLength(next.x ?? 0);
      next.y = scaleLength(next.y ?? 0);
      next.width = scaleLength(next.width ?? 0);
      next.height = scaleLength(next.height ?? 0);
      if (typeof next.inset === 'number') next.inset = scaleLength(next.inset);
      if (typeof next.insetX === 'number') next.insetX = scaleLength(next.insetX);
      if (typeof next.insetY === 'number') next.insetY = scaleLength(next.insetY);
      if (typeof next.insetTop === 'number') next.insetTop = scaleLength(next.insetTop);
      if (typeof next.insetRight === 'number') next.insetRight = scaleLength(next.insetRight);
      if (typeof next.insetBottom === 'number') next.insetBottom = scaleLength(next.insetBottom);
      if (typeof next.insetLeft === 'number') next.insetLeft = scaleLength(next.insetLeft);
      if (typeof next.maxWidth === 'number') next.maxWidth = scaleLength(next.maxWidth);
      if (typeof next.maxHeight === 'number') next.maxHeight = scaleLength(next.maxHeight);
      if (typeof next.width === 'number' && typeof viewport.width === 'number') next.width = scaleLength(viewport.width);
      if (typeof next.height === 'number' && typeof viewport.height === 'number') next.height = scaleLength(viewport.height);
    }
    return next;
  };

  const safeGetViewportRect = () => {
    try {
      if (typeof getViewportRect === 'function') {
        const rect = getViewportRect();
        const x = Number((rect as any)?.x ?? 0);
        const y = Number((rect as any)?.y ?? 0);
        const width = Number((rect as any)?.width ?? 0);
        const height = Number((rect as any)?.height ?? 0);
        if ([x, y, width, height].every(Number.isFinite)) {
          return api._boundsSpace === 'device'
            ? normalizeViewport({ x, y, width, height, boundsSpace: 'css' })
            : { x, y, width, height };
        }
      }
    } catch {
      // ignore
    }

    return api._boundsSpace === 'device'
      ? { x: 0, y: 0, width: 0, height: 0 }
      : { x: 0, y: 0, width: 0, height: 0 };
  };

  const safeGetSafeAreaInsets = () => {
    const zero: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    try {
      if (typeof getSafeAreaInsets === 'function') {
        const insets = getSafeAreaInsets();
        const next = {
          top: Number((insets as any)?.top ?? 0),
          right: Number((insets as any)?.right ?? 0),
          bottom: Number((insets as any)?.bottom ?? 0),
          left: Number((insets as any)?.left ?? 0)
        };
        if (Object.values(next).every((value) => Number.isFinite(value) && value >= 0)) {
          if (api._boundsSpace === 'device') {
            return {
              top: scaleLength(next.top),
              right: scaleLength(next.right),
              bottom: scaleLength(next.bottom),
              left: scaleLength(next.left)
            };
          }
          return next;
        }
      }
    } catch {
      // ignore
    }
    return zero;
  };

  const isFiniteViewportRect = (value: any): value is { x: number; y: number; width: number; height: number } => {
    if (!value || typeof value !== 'object') return false;
    return ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(Number((value as any)[key])));
  };

  const isCanvasViewportRect = (viewport: any): boolean => {
    if (!isFiniteViewportRect(viewport)) return false;
    const canvasViewport = safeGetViewportRect();
    const epsilon = 0.5;
    return Math.abs(Number(viewport.x) - canvasViewport.x) <= epsilon
      && Math.abs(Number(viewport.y) - canvasViewport.y) <= epsilon
      && Math.abs(Number(viewport.width) - canvasViewport.width) <= epsilon
      && Math.abs(Number(viewport.height) - canvasViewport.height) <= epsilon;
  };

  const toBreakpoint = (width: number, thresholds?: any) => {
    const t = {
      sm: Number(thresholds?.sm ?? defaultBreakpointThresholds.sm),
      md: Number(thresholds?.md ?? defaultBreakpointThresholds.md),
      lg: Number(thresholds?.lg ?? defaultBreakpointThresholds.lg),
      xl: Number(thresholds?.xl ?? defaultBreakpointThresholds.xl)
    };
    if (!Number.isFinite(width) || width < t.sm) return 'xs';
    if (width < t.md) return 'sm';
    if (width < t.lg) return 'md';
    if (width < t.xl) return 'lg';
    return 'xl';
  };

  const safeGetCurrentWorldSection = (): number | null => {
    try {
      const section = typeof getCurrentWorldSection === 'function' ? getCurrentWorldSection() : null;
      return typeof section === 'number' && Number.isFinite(section) ? section : null;
    } catch {
      return null;
    }
  };

  const safeResolveWorldSection = (selector: any): number | null => {
    if (selector === 'current') {
      return safeGetCurrentWorldSection();
    }

    if (typeof selector === 'number' && Number.isFinite(selector)) {
      return Math.trunc(selector);
    }

    if (typeof selector !== 'string') {
      return null;
    }

    const raw = selector.trim();
    if (!raw) return null;

    if (/^-?\d+$/.test(raw)) {
      return Number(raw);
    }

    try {
      if (typeof resolveWorldSectionSelector === 'function') {
        const resolved = resolveWorldSectionSelector(raw);
        return typeof resolved === 'number' && Number.isFinite(resolved) ? resolved : null;
      }
    } catch {
      return null;
    }

    return null;
  };

  const normalizeSectionList = (selector: any): number[] => {
    const values = Array.isArray(selector) ? selector : [selector];
    const resolved: number[] = [];
    for (const value of values) {
      const section = safeResolveWorldSection(value);
      if (section === null || resolved.includes(section)) continue;
      resolved.push(section);
    }
    return resolved;
  };

  // Store GUI system in the API object itself to avoid closure issues with SES
  const api: any = {
    _system: null as GUISystem | null,
    _boundsSpace: 'css' as 'css' | 'device',
    _nextSectionGroupId: 1,
    _sectionBindings: [] as Array<{
      group: string | number;
      sections: number[];
      clearFocusOnHide: boolean;
    }>,
    
    /**
     * Initialize GUI system
     * Call this in on:init
     */
    init(options?: { boundsSpace?: 'css' | 'device' }) {
      this._boundsSpace = (options && (options as any).boundsSpace === 'device') ? 'device' : 'css';
      this._system = new GUISystem();
      this._nextSectionGroupId = 1;
      this._sectionBindings = [];
      if (getStyle) {
        try {
          this._system.setThemeFromStyles(getStyle);
        } catch {
          // Ignore theme failures; GUI widgets will use built-in defaults.
        }
      }
      if (this._boundsSpace === 'css') {
        const currentTokens = this._system.getTokens();
        this._system.setTokens(scaleTokenPatch(currentTokens));
      }
      return this._system;
    },

    _allocateSectionGroup() {
      const group = `__storie_gui_section_${this._nextSectionGroupId++}`;
      return group;
    },

    _findSectionBinding(group: string | number) {
      return this._sectionBindings.find((binding: any) => binding.group === group) ?? null;
    },

    _applySectionBinding(binding: { group: string | number; sections: number[]; clearFocusOnHide: boolean }, currentSection?: number | null) {
      if (!this._system) return false;
      const activeSection = typeof currentSection === 'number' && Number.isFinite(currentSection)
        ? currentSection
        : safeGetCurrentWorldSection();
      const visible = activeSection !== null && binding.sections.includes(activeSection);

      if (!visible && binding.clearFocusOnHide) {
        const focused = this._system.getFocusedWidget();
        if (focused && focused.group === binding.group) {
          this._system.clearFocus();
        }
      }

      this._system.setGroupVisible(binding.group, visible);
      return visible;
    },

    syncSectionBindings(currentSection?: number | null) {
      if (!this._system) return;
      const activeSection = typeof currentSection === 'number' && Number.isFinite(currentSection)
        ? currentSection
        : safeGetCurrentWorldSection();
      for (const binding of this._sectionBindings) {
        this._applySectionBinding(binding, activeSection);
      }
    },

    bindGroupToSections(group: string | number, sections: number | string | Array<number | string>, options?: { clearFocusOnHide?: boolean }) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }

      const resolvedSections = normalizeSectionList(sections);
      if (resolvedSections.length === 0) {
        throw new Error('gui.bindGroupToSections(group, sections): could not resolve any section selectors');
      }

      const clearFocusOnHide = options?.clearFocusOnHide !== false;
      const existing = this._findSectionBinding(group);
      if (existing) {
        existing.sections = resolvedSections;
        existing.clearFocusOnHide = clearFocusOnHide;
        this._applySectionBinding(existing);
        return group;
      }

      const binding = {
        group,
        sections: resolvedSections,
        clearFocusOnHide
      };
      this._sectionBindings.push(binding);
      this._applySectionBinding(binding);
      return group;
    },

    bindGroupToSection(group: string | number, section: number | string, options?: { clearFocusOnHide?: boolean }) {
      return this.bindGroupToSections(group, [section], options);
    },

    section(section: number | string | Array<number | string> = 'current', options?: { group?: string | number; clearFocusOnHide?: boolean }) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }

      const group = options?.group ?? this._allocateSectionGroup();
      this.bindGroupToSections(group, section, options);

      const withGroup = (config: any) => ({ ...(config || {}), group });

      const sectionAPI: any = {
        group,
        bind: (nextSections: number | string | Array<number | string>, nextOptions?: { clearFocusOnHide?: boolean }) => {
          api.bindGroupToSections(group, nextSections, nextOptions ?? options);
          return sectionAPI;
        },
        createButton: (config: any) => api.createButton(withGroup(config)),
        createLabel: (config: any) => api.createLabel(withGroup(config)),
        createCheckbox: (config: any) => api.createCheckbox(withGroup(config)),
        createSlider: (config: any) => api.createSlider(withGroup(config)),
        createPianoKeyboard: (config: any) => api.createPianoKeyboard(withGroup(config)),
        createTextField: (config: any) => api.createTextField(withGroup(config)),
        createTextEditor: (config: any) => api.createTextEditor(withGroup(config)),
        createMarkdownView: (config: any) => api.createMarkdownView(withGroup(config)),
        createContainer: (config: any) => api.createContainer(withGroup(config)),
        createResponsivePanel: (config: any) => api.createResponsivePanel(withGroup(config)),
        setVisible: (visible: boolean) => {
          api.setGroupVisible(group, visible);
          return sectionAPI;
        }
      };

      return sectionAPI;
    },

    _normalizeConfig(config: any) {
      if (!config || typeof config !== 'object') return config;
      const space = (config as any).boundsSpace === 'device' || this._boundsSpace === 'device'
        ? 'device'
        : 'css';

      if (space === 'device') {
        return config;
      }

      // Treat provided bounds as CSS pixels and scale to backing-store pixels.
      const next: any = { ...config };
      if (next.bounds) next.bounds = scaleBounds(next.bounds);

      // Layout helpers also use pixel lengths.
      if (typeof next.padding === 'number') next.padding = scaleLength(next.padding);
      if (typeof next.gap === 'number') next.gap = scaleLength(next.gap);
      if (typeof next.rowGap === 'number') next.rowGap = scaleLength(next.rowGap);
      if (typeof next.columnGap === 'number') next.columnGap = scaleLength(next.columnGap);
      if (typeof next.maxWidth === 'number') next.maxWidth = scaleLength(next.maxWidth);
      if (typeof next.maxHeight === 'number') next.maxHeight = scaleLength(next.maxHeight);
      if (next.pianoStyle && typeof next.pianoStyle === 'object') {
        next.pianoStyle = { ...next.pianoStyle };
        if (typeof next.pianoStyle.borderWidth === 'number') next.pianoStyle.borderWidth = scaleLength(next.pianoStyle.borderWidth);
        if (typeof next.pianoStyle.railThickness === 'number') next.pianoStyle.railThickness = scaleLength(next.pianoStyle.railThickness);
        if (typeof next.pianoStyle.railPadding === 'number') next.pianoStyle.railPadding = scaleLength(next.pianoStyle.railPadding);
        if (typeof next.pianoStyle.labelInset === 'number') next.pianoStyle.labelInset = scaleLength(next.pianoStyle.labelInset);
        if (typeof next.pianoStyle.minThumbLength === 'number') next.pianoStyle.minThumbLength = scaleLength(next.pianoStyle.minThumbLength);
      }
      return next;
    },
    
    /**
     * Get the current GUI system instance
     */
    getSystem(): GUISystem | null {
      return this._system;
    },

    syncTheme() {
      if (!this._system || !getStyle) {
        return null;
      }
      try {
        return this._system.setThemeFromStyles(getStyle);
      } catch {
        return null;
      }
    },

    getTokens() {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      const tokens = this._system.getTokens();
      return this._boundsSpace === 'device' ? tokens : unscaleTokens(tokens);
    },

    setTokens(tokens?: GUITokenPatch) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      const patch = this._boundsSpace === 'device' ? (tokens ?? null) : scaleTokenPatch(tokens ?? null);
      this._system.setTokens(patch ?? null);
      return this.getTokens();
    },

    getBreakpoint(width: number, thresholds?: { sm?: number; md?: number; lg?: number; xl?: number }) {
      return toBreakpoint(Number(width), thresholds);
    },

    getViewportRect() {
      return safeGetViewportRect();
    },

    getSafeAreaInsets() {
      return safeGetSafeAreaInsets();
    },

    getResponsiveInfo(viewport: { width: number; height: number }, thresholds?: { sm?: number; md?: number; lg?: number; xl?: number }) {
      const width = Number(viewport?.width ?? 0);
      const height = Number(viewport?.height ?? 0);
      const safeAreaInsets = safeGetSafeAreaInsets();
      const usableWidth = Math.max(0, width - safeAreaInsets.left - safeAreaInsets.right);
      const usableHeight = Math.max(0, height - safeAreaInsets.top - safeAreaInsets.bottom);
      return {
        width,
        height,
        safeAreaInsets,
        usableWidth,
        usableHeight,
        orientation: width >= height ? 'landscape' : 'portrait',
        breakpoint: toBreakpoint(usableWidth || width, thresholds)
      };
    },
    
    /**
     * Create a button widget
     * 
     * @example
     * ```javascript
     * const btn = gui.createButton({
     *   bounds: { x: 100, y: 50, width: 200, height: 40 },
     *   label: 'Click Me'
     * });
     * ```
     */
    createButton(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createButton(this._normalizeConfig(config));
    },
    
    /**
     * Create a label widget
     * 
     * @example
     * ```javascript
     * const lbl = gui.createLabel({
     *   bounds: { x: 100, y: 20, width: 300, height: 30 },
     *   text: 'My Application',
     *   align: 'center'
     * });
     * ```
     */
    createLabel(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createLabel(this._normalizeConfig(config));
    },
    
    /**
     * Create a checkbox widget
     * 
     * @example
     * ```javascript
     * const chk = gui.createCheckbox({
     *   bounds: { x: 100, y: 100, width: 200, height: 30 },
     *   label: 'Enable Sound Effects',
     *   checked: true
     * });
     * ```
     */
    createCheckbox(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createCheckbox(this._normalizeConfig(config));
    },
    
    /**
     * Create a slider widget
     * 
     * @example
     * ```javascript
     * const slider = gui.createSlider({
     *   bounds: { x: 100, y: 150, width: 300, height: 40 },
     *   label: 'Volume',
     *   min: 0,
     *   max: 100,
     *   value: 50
     * });
     * ```
     */
    createSlider(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createSlider(this._normalizeConfig(config));
    },

    /**
     * Create a piano keyboard widget
     */
    createPianoKeyboard(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createPianoKeyboard(this._normalizeConfig(config));
    },

    /**
     * Create a text field widget
     */
    createTextField(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createTextField(this._normalizeConfig(config));
    },

    /**
     * Create a text editor widget (multi-line)
     */
    createTextEditor(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createTextEditor(this._normalizeConfig(config));
    },

    /**
     * Create a markdown view widget (flow layout inside bounds)
     */
    createMarkdownView(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createMarkdownView(this._normalizeConfig(config));
    },

    /**
     * Create a layout helper container.
     * This does not create a widget; it mutates child widget bounds when layout() is called.
     *
     * @example
     * ```javascript
     * const stack = gui.createContainer({
     *   bounds: { x: 20, y: 20, width: 300, height: 400 },
     *   mode: 'stack',
     *   padding: 10,
     *   gap: 8,
     *   alignX: 'stretch'
     * });
     *
     * stack.add(btn).add(chk).add(slider);
     * stack.layout();
     *
     * const grid = gui.createContainer({
     *   bounds: { x: 20, y: 440, width: 300, height: 200 },
     *   mode: 'grid',
     *   columns: 3,
     *   gap: 8,
     *   alignX: 'stretch'
     * });
     * ```
     */
    createContainer(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createContainer(this._normalizeConfig(config));
    },

    createResponsivePanel(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }

      const normalized = this._normalizeConfig({
        mode: 'stack',
        alignX: 'stretch',
        ...(config || {})
      });
      const container = this._system.createContainer(normalized);

      const panel = {
        container,
        add: (child: any) => {
          container.add(child);
          return panel;
        },
        addMany: (children: any[]) => {
          container.addMany(children);
          return panel;
        },
        setMaxWidth: (maxWidth: number | null, relayout: boolean = true) => {
          const nextMaxWidth = maxWidth == null || api._boundsSpace === 'device'
            ? maxWidth
            : scaleLength(maxWidth);
          container.setMaxWidth(nextMaxWidth, relayout);
          return panel;
        },
        setBounds: (bounds: any, relayout: boolean = true) => {
          const nextBounds = api._boundsSpace === 'device' ? bounds : scaleBounds(bounds);
          container.setBounds(nextBounds, relayout);
          return container.bounds;
        },
        layout: () => {
          container.layout();
          return container;
        },
        measureLayout: () => container.measureLayout(),
        fitToViewport: (viewport: any, options?: any, relayout: boolean = true) => {
          const v = isFiniteViewportRect(viewport) ? { ...viewport } : safeGetViewportRect();
          const o = options && typeof options === 'object' ? { ...options } : {};
          if (o.safeArea && !isCanvasViewportRect(v)) {
            const insets = safeGetSafeAreaInsets();
            o.insetTop = Number(o.insetTop ?? 0) + insets.top;
            o.insetRight = Number(o.insetRight ?? 0) + insets.right;
            o.insetBottom = Number(o.insetBottom ?? 0) + insets.bottom;
            o.insetLeft = Number(o.insetLeft ?? 0) + insets.left;
          }
          delete o.safeArea;
          return container.fitToViewport(v, o, relayout);
        },
        getBounds: () => ({ ...container.bounds }),
        getContentBounds: () => container.getContentBounds()
      };
      return panel;
    },
    
    /**
     * Update GUI with input state (pixel coordinates)
     * Call this in on:update
     * 
     * @example
     * ```javascript
     * gui.update(mouseX, mouseY, mousePressed);
     * ```
     */
    update(mouseX: number, mouseY: number, mouseDown: boolean) {
      if (!this._system) return;
      const { charWidth, charHeight } = getMetrics();
      this._system.update(mouseX, mouseY, mouseDown, charWidth, charHeight);
    },

    /**
     * Handle mouse input immediately (pixel coordinates)
     * Call this in on:input for 'mouse' / 'mouse_move' events.
     * This avoids missing fast click transitions between frames.
     */
    handleMouse(mouseX: number, mouseY: number, mouseDown: boolean) {
      if (!this._system) return;
      const { charWidth, charHeight } = getMetrics();
      this._system.handleMouse(mouseX, mouseY, mouseDown, charWidth, charHeight);
    },
    
    /**
     * Handle keyboard input
     * Call this in on:input when handling key events
     * 
     * @example
     * ```javascript
     * gui.handleKey('Tab', { shift: false });
     * ```
     */
    handleKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }) {
      if (!this._system) return;

      const trusted = () => {
        try {
          return typeof isTrustedUserInput === 'function' ? !!isTrustedUserInput() : false;
        } catch {
          return false;
        }
      };

      const canClipboard = () => (typeof navigator !== 'undefined' && !!(navigator as any).clipboard);

      const sanitizeClipboardText = (text: string, multiline: boolean): string => {
        let s = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        s = s.replace(/[\x00-\x08\x0B-\x1F\x7F\x1B]/g, '');
        if (!multiline) s = s.replace(/\n+/g, ' ');
        const maxChars = 64 * 1024;
        if (s.length > maxChars) s = s.slice(0, maxChars);
        return s;
      };

      const mods: any = modifiers ?? {};
      const ctrl = !!mods.ctrl;
      const meta = !!mods.meta;
      const lower = String(key ?? '').toLowerCase();

      if ((ctrl || meta) && trusted() && canClipboard()) {
        const focused = this._system.getWidgetManager().getFocused();
        const isTextLike = focused && (focused instanceof GUITextField || focused instanceof GUITextEditor);

        if (isTextLike && lower === 'v') {
          void (navigator as any).clipboard.readText()
            .then((clipText: string) => {
              if (!this._system) return;
              const multiline = focused instanceof GUITextEditor;
              const safe = sanitizeClipboardText(clipText, multiline);
              if (safe) this._system.handleText(safe);
            })
            .catch(() => void 0);
          return;
        }

        if (isTextLike && lower === 'c') {
          const value = typeof (focused as any).getValue === 'function' ? String((focused as any).getValue() ?? '') : '';
          void (navigator as any).clipboard.writeText(value).catch(() => void 0);
          return;
        }
      }

      this._system.handleKey(key, modifiers as any);
    },

    /**
     * Handle text input (printable characters)
     * Call this in on:input when event.type === 'text'
     */
    handleText(text: string) {
      if (!this._system) return;
      this._system.handleText(text);
    },

    /**
     * Clear focus from the currently focused widget.
     */
    clearFocus() {
      if (!this._system) return;
      this._system.clearFocus();
    },

    /**
     * Return the currently focused widget, if any.
     */
    getFocusedWidget() {
      if (!this._system) return null;
      return this._system.getFocusedWidget();
    },
    
    /**
     * Render all widgets
     * Automatically called by the engine if the system is initialized
     */
    render(uiAPI: any) {
      if (!this._system) return;
      const { charWidth, charHeight } = getMetrics();
      this._system.render(uiAPI, charWidth, charHeight);
    },

    /**
     * Override widget drawing.
     *
     * If set, the callback is invoked for each visible widget during render.
     * Return true to indicate the widget was drawn and default rendering should be skipped.
     * Return false/undefined to fall back to built-in widget rendering.
     *
     * @example
     * ```js
    * gui.setWidgetRenderer((w, ui) => {
     *   if (w.kind === 'button') {
     *     ui.rect(w.bounds.x, w.bounds.y, w.bounds.width, w.bounds.height, ui.colors.rgb(255, 80, 140));
     *     ui.text(w.label, w.bounds.x + 10, w.bounds.y + 18, ui.colors.rgb(10, 10, 10));
     *     return true;
     *   }
     *   return false;
     * });
     * ```
     */
    setWidgetRenderer(renderer: any) {
      if (!this._system) return;
      if (renderer === null || renderer === undefined) {
        this._system.setWidgetRenderer(null);
        return;
      }
      if (typeof renderer !== 'function') {
        throw new Error('gui.setWidgetRenderer(renderer): renderer must be a function, null, or undefined');
      }
      this._system.setWidgetRenderer(renderer);
    },
    
    /**
     * Set visibility for all widgets in a group
     * 
     * @example
     * ```javascript
     * gui.setGroupVisible(1, false); // Hide group 1
     * ```
     */
    setGroupVisible(group: number, visible: boolean) {
      if (!this._system) return;
      this._system.setGroupVisible(group, visible);
    },
    
    /**
     * Color utilities
     */
    colors: {
      rgb: (r: number, g: number, b: number) => ({ r, g, b }),
      rgba: (r: number, g: number, b: number, a: number) => ({ r, g, b, a })
    }
  };
  
  return api;
}
