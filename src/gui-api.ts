/**
 * GUI API for Sandbox
 * Exposes retained-mode GUI functionality to sandboxed JavaScript
 */

import { GUISystem } from './ui/gui/index.js';
import { GUITextField } from './ui/gui/textfield.js';
import { GUITextEditor } from './ui/gui/texteditor.js';

/**
 * Create GUI API for sandbox compartment
 * This gets exposed to user JavaScript code
 */
export function createGUIAPI(
  getMetrics: () => { charWidth: number; charHeight: number },
  isTrustedUserInput?: () => boolean,
  getPixelScale?: () => { scaleX: number; scaleY: number }
) {
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

  // Store GUI system in the API object itself to avoid closure issues with SES
  const api: any = {
    _system: null as GUISystem | null,
    _boundsSpace: 'css' as 'css' | 'device',
    
    /**
     * Initialize GUI system
     * Call this in on:init
     */
    init(options?: { boundsSpace?: 'css' | 'device' }) {
      this._boundsSpace = (options && (options as any).boundsSpace === 'device') ? 'device' : 'css';
      this._system = new GUISystem();
      return this._system;
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
      return next;
    },
    
    /**
     * Get the current GUI system instance
     */
    getSystem(): GUISystem | null {
      return this._system;
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
     * Create a simple layout helper container for stacking widgets.
     * This does not create a widget; it mutates child widget bounds when layout() is called.
     *
     * @example
     * ```javascript
     * const container = gui.createContainer({
     *   bounds: { x: 20, y: 20, width: 300, height: 400 },
     *   padding: 10,
     *   gap: 8,
     *   alignX: 'stretch'
     * });
     *
     * container.add(btn).add(chk).add(slider);
     * container.layout();
     * ```
     */
    createContainer(config: any) {
      if (!this._system) {
        throw new Error('GUI system not initialized. Call gui.init() first.');
      }
      return this._system.createContainer(this._normalizeConfig(config));
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
