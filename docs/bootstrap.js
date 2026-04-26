/**
 * Shared bootstrap for S|torie site entrypoints.
 *
 * This module was extracted from the original inline <script type="module"> in
 * site/index.html so multiple scoped PWAs (e.g. /0rain/) can share the exact
 * same runtime boot flow while customizing paths and default content.
 */

/**
 * @typedef {Object} StorieBootstrapConfig
 * @property {string} engineModuleUrl - URL to the browser runtime bundle (may include cache-buster query).
 * @property {string=} contentSourceModuleUrl - URL to the markdown source resolver module.
 * @property {string=} buildId - Used only for cache-busting demo fetches when no query string exists.
 * @property {{url: string, scope?: string}=} serviceWorker - Optional SW registration.
 * @property {string=} demoBaseUrl - Base URL for demo markdown when ?content points at a demo name.
 * @property {string=} indexMdUrl - URL for default index markdown when no content param exists.
 * @property {string|null=} defaultContent - Used when URL has no ?content. Recommended form: "demo:...".
 * @property {string=} hostAssetsBaseUrl - Base URL for host JS modules like video-exporter.js.
 * @property {string=} assetsBaseUrl - Base URL for font assets used by local-font probing.
 */

/**
 * Start the site runtime.
 *
 * @param {StorieBootstrapConfig} userConfig
 */
export function startStorieApp(userConfig = /** @type {any} */ ({})) {
  const config = {
    engineModuleUrl: './storie-site.js',
    contentSourceModuleUrl: './content-source.js',
    buildId: '__BUILD_ID__',
    serviceWorker: null,
    demoBaseUrl: 'demos/',
    indexMdUrl: 'index.md',
    defaultContent: null,
    hostAssetsBaseUrl: '.',
    assetsBaseUrl: './assets/',
    ...userConfig,
  };

  const joinUrl = (base, leaf) => {
    const b = String(base || '').trim();
    const l = String(leaf || '').trim();
    if (!b) return l;
    if (!l) return b;
    if (b.endsWith('/')) return b + l.replace(/^\//, '');
    return b + '/' + l.replace(/^\//, '');
  };

  // Minimal PWA hook: register a service worker so the app is installable.
  // Keep SW behavior intentionally light to avoid caching surprises.
  if (config.serviceWorker && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(config.serviceWorker.url, {
          scope: config.serviceWorker.scope,
          updateViaCache: 'none'
        })
        .catch((err) => console.warn('[pwa] service worker registration failed:', err));
    });
  }

  (async () => {
    // Import the built engine (dynamic so entrypoints can vary path)
    const [engineMod, contentSourceMod] = await Promise.all([
      import(/* @vite-ignore */ config.engineModuleUrl),
      import(/* @vite-ignore */ config.contentSourceModuleUrl),
    ]);
    const StorieEngine = engineMod?.StorieEngine;
    const resolveMarkdownSource = contentSourceMod?.resolveMarkdownSource;
    if (typeof StorieEngine !== 'function') {
      throw new Error('Failed to import StorieEngine from ' + config.engineModuleUrl);
    }
    if (typeof resolveMarkdownSource !== 'function') {
      throw new Error('Failed to import resolveMarkdownSource from ' + config.contentSourceModuleUrl);
    }

    const audioGate = document.getElementById('audio-gate');
    const makeSilentWavUrl = (durationMs = 120, sampleRate = 8000) => {
      const frameCount = Math.max(1, Math.round(sampleRate * (durationMs / 1000)));
      const dataSize = frameCount * 2;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);

      const writeAscii = (offset, text) => {
        for (let i = 0; i < text.length; i++) {
          view.setUint8(offset + i, text.charCodeAt(i));
        }
      };

      writeAscii(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeAscii(8, 'WAVE');
      writeAscii(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeAscii(36, 'data');
      view.setUint32(40, dataSize, true);

      return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
    };

    const hostUnlockAudioUrl = makeSilentWavUrl();
    const hostUnlockAudio = new Audio(hostUnlockAudioUrl);
    hostUnlockAudio.preload = 'auto';
    let activeEngine = null;

    const dismissAudioGate = () => {
      if (!audioGate) return;
      audioGate.classList.remove('visible');
      audioGate.setAttribute('aria-hidden', 'true');
    };

    const getClientPoint = (event) => {
      if (!event || typeof event !== 'object') return null;
      if (typeof event.clientX === 'number' && typeof event.clientY === 'number') {
        return { clientX: event.clientX, clientY: event.clientY };
      }
      const touch = event.changedTouches && event.changedTouches[0]
        ? event.changedTouches[0]
        : (event.touches && event.touches[0] ? event.touches[0] : null);
      if (touch && typeof touch.clientX === 'number' && typeof touch.clientY === 'number') {
        return { clientX: touch.clientX, clientY: touch.clientY };
      }
      return null;
    };

    const replayTapIntoEngine = (point) => {
      if (!activeEngine || !point) return;
      const canvas = activeEngine.getCanvas();
      if (!canvas) return;

      const eventInit = {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: point.clientX,
        clientY: point.clientY,
        button: 0,
      };

      try {
        canvas.dispatchEvent(new MouseEvent('mousedown', eventInit));
        canvas.dispatchEvent(new MouseEvent('mouseup', eventInit));
      } catch (error) {
        console.error('[host-audio-gate] failed to replay tap into engine:', error);
      }
    };

    const isTouchLikeDevice = (() => {
      try {
        return !!(
          navigator.maxTouchPoints > 0 ||
          'ontouchstart' in window ||
          (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
        );
      } catch {
        return false;
      }
    })();

    const demoFetchSuffix = (() => {
      const seed = window.location.search
        ? window.location.search.slice(1)
        : (config.buildId || '__BUILD_ID__');
      if (!seed) return '';
      return '?v=' + encodeURIComponent(seed);
    })();

    const fetchMarkdownText = async (path) => {
      const suffix = path.includes('?') ? '&' + demoFetchSuffix.slice(1) : demoFetchSuffix;
      const response = await fetch(path + suffix, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load markdown from ' + path + ' (HTTP ' + response.status + ')');
      }
      return response.text();
    };

    const fetchJson = async (url) => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error('Failed to load JSON from ' + url + ' (HTTP ' + response.status + ')');
      }
      return response.json();
    };

    async function loadResolvedSource(contentRef, demoPaths, logLabel = null) {
      const label = logLabel || contentRef;
      console.log('Content parameter detected:', label);

      const resolved = await resolveMarkdownSource(contentRef, {
        demoPaths,
        fetchText: fetchMarkdownText,
        fetchJson,
        getStoredText: (key) => localStorage.getItem(key),
      });

      console.log('Loaded ' + resolved.kind + ' source (' + resolved.markdown.length + ' chars)');
      return {
        source: resolved.sourcePath || resolved.kind,
        sourceKind: resolved.kind,
        sourcePath: resolved.sourcePath,
        content: resolved.markdown,
      };
    }

    /**
     * Parse URL parameters to load content from various sources
     * Supports: ?content=gist:ID, ?content=demo:name, ?content=browser:key,
     *           ?content=decode:xxx, ?content=https://gist.github.com/...
     */
    async function parseContentSource() {
      const urlParams = new URLSearchParams(window.location.search);
      const contentParam = urlParams.get('content') ?? config.defaultContent;

      if (!contentParam) {
        return null; // No custom content, will use default
      }

      console.log('Content parameter detected:', contentParam);
      return await loadResolvedSource(contentParam, [joinUrl(config.demoBaseUrl, '{name}'), '{name}']);
    }

    /**
     * Parse shader chain from URL parameters
     * Supports: ?shaders=invert+paper+scanlines
     */
    function parseShaderChain() {
      // Parse raw query string to preserve '+' as separator (not space)
      // URLSearchParams would decode '+' as space, breaking "invert+paper"
      const queryString = window.location.search;

      // Check for common typo: ?shaders+value instead of ?shaders=value
      if (queryString.match(/[?&]shaders\+/)) {
        console.error('⚠️ Shader chain parameter malformed!');
        console.error('   Found: ?shaders+something');
        console.error('   Should be: ?shaders=something');
        console.error('   Example: ?content=demo&shaders=invert+paper');
        console.error('   The + should separate shader names AFTER the = sign');
        return null;
      }

      // Extract shaders parameter from raw query string
      const match = queryString.match(/[?&]shaders=([^&]*)/);
      if (!match || !match[1]) {
        return null;
      }

      // Decode %20 and other URL encoding, but preserve '+'
      const shadersParam = decodeURIComponent(match[1]);

      if (shadersParam.trim().length === 0) {
        return null;
      }

      console.log('✓ Shader chain parameter detected:', shadersParam);
      return shadersParam.trim();
    }

    // ── Tauri native detection ──────────────────────────────────────────────────
    // When running inside Tauri, window.__TAURI_INTERNALS__ is injected by the
    // runtime (requires `withGlobalTauri: true` in tauri.conf.json).
    const IS_TAURI = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

    /**
     * Native drag-and-drop bridge for Tauri.
     */
    async function installTauriDropHandling(engine) {
      const tauri = window.__TAURI__;
      if (!tauri) {
        console.log('[tauri-drop] __TAURI__ not found — falling back to DOM D&D');
        engine.installDropHandling(document.body);
        return;
      }

      const { invoke }           = tauri.core;
      const { listen }           = tauri.event;
      const getCurrentWebviewWindow = tauri.webviewWindow?.getCurrentWebviewWindow;

      try {
        // Prefer WebviewWindow-targeted drag-drop listener: in Tauri v2 the
        // events are typically emitted on the window/webview target.
        const wvw = (typeof getCurrentWebviewWindow === 'function') ? getCurrentWebviewWindow() : null;

        const handler = async (payload) => {
          const type  = payload?.type;
          const paths = payload?.paths;

          if (type === 'drop') {
            console.log('[tauri-drop] drop event:', paths);
          }

          if (type !== 'drop' || !paths || paths.length === 0) return;

          const filePath = paths[0];
          const name = String(filePath).replace(/.*[\\/]/, '');
          const ext = (name.includes('.') ? name.split('.').pop() : '').toLowerCase();
          const isMarkdown = ext === 'md' || ext === 'markdown' || ext === 'txt';

          if (isMarkdown) {
            try {
              const content = await invoke('read_dropped_file', { path: filePath });
              await engine.loadMarkdown(name || 'dropped.md', content);
              console.log(`[tauri-drop] loaded markdown: ${name}`);
            } catch (err) {
              console.error('[tauri-drop] Failed to read markdown file:', err);
            }
            return;
          }

          // Binary files only matter if the active doc has `dropTarget: true`.
          if (!engine.isDropTargetEnabled()) {
            console.log(`[tauri-drop] Ignoring binary file (no dropTarget): ${name}`);
            return;
          }

          try {
            const b64 = await invoke('read_dropped_file_bytes', { path: filePath });
            const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
            const MIME = {
              mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
              m4a: 'audio/mp4', aac: 'audio/aac', opus: 'audio/opus',
              png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
              gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
              json: 'application/json',
            };
            const mime = MIME[ext] || 'application/octet-stream';

            const file = new File([bin], name || 'dropped', { type: mime });
            const dt = new DataTransfer();
            dt.items.add(file);
            const syntheticDrop = new DragEvent('drop', {
              dataTransfer: dt,
              bubbles: true,
              cancelable: true,
            });
            document.body.dispatchEvent(syntheticDrop);
            console.log(`[tauri-drop] dispatched binary: ${name} (${mime})`);
          } catch (err) {
            console.error('[tauri-drop] Failed to read binary file:', err);
          }
        };

        let unlisten = null;
        if (wvw && typeof wvw.onDragDropEvent === 'function') {
          unlisten = await wvw.onDragDropEvent((event) => handler(event?.payload));
          console.log('✓ Native Tauri drag-and-drop installed (webviewWindow)');
        } else {
          // Fallback: global event listener.
          unlisten = await listen('tauri://drag-drop', async (event) => handler(event?.payload || {}));
          console.log('✓ Native Tauri drag-and-drop installed (event listener)');
        }

        return () => {
          try { unlisten(); } catch {}
        };
      } catch (err) {
        console.error('[tauri-drop] Failed to install native D&D, falling back:', err);
        engine.installDropHandling(document.body);
        return null;
      }
    }

    async function main() {
      try {
        // Get canvas
        const canvas = document.getElementById('canvas');

        const parseBoolish = (value) => {
          const v = String(value ?? '').trim().toLowerCase();
          if (v === '1' || v === 'true' || v === 'yes' || v === 'on') return true;
          if (v === '0' || v === 'false' || v === 'no' || v === 'off') return false;
          return false;
        };

        const normalizeOrientationRequirement = (value) => {
          const v = String(value ?? '').trim().toLowerCase();
          if (!v || v === 'none' || v === 'auto' || v === 'any') return null;
          if (v === 'false' || v === 'off') return null;
          if (v.startsWith('landscape')) return 'landscape';
          if (v.startsWith('portrait')) return 'portrait';
          return null;
        };

        const getHostViewportSize = () => {
          const vv = window.visualViewport;
          const innerW = (typeof window.innerWidth === 'number') ? window.innerWidth : 0;
          const innerH = (typeof window.innerHeight === 'number') ? window.innerHeight : 0;
          const vvW = (vv && typeof vv.width === 'number') ? vv.width : 0;
          const vvH = (vv && typeof vv.height === 'number') ? vv.height : 0;
          const docW = (document.documentElement && typeof document.documentElement.clientWidth === 'number')
            ? document.documentElement.clientWidth
            : 0;
          const docH = (document.documentElement && typeof document.documentElement.clientHeight === 'number')
            ? document.documentElement.clientHeight
            : 0;
          const width = innerW > 0 ? innerW : (vvW > 0 ? vvW : docW);
          const height = innerH > 0 ? innerH : (vvH > 0 ? vvH : docH);
          return { width, height };
        };

        const ensureOrientationGate = () => {
          let gate = document.getElementById('orientation-gate');
          if (gate) return gate;

          gate = document.createElement('div');
          gate.id = 'orientation-gate';
          gate.setAttribute('aria-hidden', 'true');

          const card = document.createElement('div');
          card.id = 'orientation-gate-card';

          const title = document.createElement('div');
          title.className = 'orientation-gate-title';
          title.textContent = 'Rotate device';

          const message = document.createElement('div');
          message.id = 'orientation-gate-message';

          card.appendChild(title);
          card.appendChild(message);
          gate.appendChild(card);
          document.body.appendChild(gate);
          return gate;
        };

        // Optional: stretch the canvas' *CSS size* to fit the viewport even when
        // the backing buffer is cell-aligned. This trades some crispness for
        // zero wasted screen space at the edges.
        //
        // Default: ON
        // Sources (priority):
        // 1) URL param `?stretch=...` (e.g. `0` to disable)
        // 2) Frontmatter `stretch: true|false` (handled after markdown load)
        const urlParams = new URLSearchParams(window.location.search);
        const stretchParamRaw = urlParams.get('stretch');
        const stretchFromUrl = (stretchParamRaw === null) ? null : parseBoolish(stretchParamRaw);
        let stretchToFit = stretchFromUrl ?? true;

        // ── Load markdown first (so we can honor frontmatter font settings) ──
        let markdown = null;
        let source = 'embedded';

        try {
          const contentSource = await parseContentSource();

          if (contentSource) {
            markdown = contentSource.content;
            source = contentSource.source;
            console.log('✓ Loaded from ' + source);
          }
        } catch (error) {
          console.error('✗ Error loading from URL parameter:', error);
          // Fall through to try index.md
        }

        // If no content from URL params, try to load index.md
        if (!markdown) {
          try {
            const defaultSource = await loadResolvedSource(
              config.indexMdUrl,
              ['{name}'],
              `default:${config.indexMdUrl}`
            );
            markdown = defaultSource.content;
            source = defaultSource.source;

            // Diagnostics: help detect when the request returned something
            // unexpected (e.g. HTML fallback) and why section parsing might
            // be empty.
            const firstLine = (markdown.split('\n')[0] || '').slice(0, 120);
            const headingLines = markdown
              .split('\n')
              .filter(l => l.trimStart().startsWith('#'))
              .length;
            console.log(`✓ ${source} first line: ${firstLine}`);
            console.log(`✓ ${source} heading lines: ${headingLines}`);

            // Extra diagnostic: print the first heading's codepoints so we
            // can spot invisible characters between '#' and the title.
            const firstHeading = markdown.split('\n').find(l => l.trimStart().startsWith('#'));
            if (firstHeading) {
              const raw = firstHeading.slice(0, 80);
              const cps = Array.from(raw).slice(0, 24).map(ch => '0x' + ch.codePointAt(0).toString(16));
              console.log(`✓ ${source} first heading (raw):`, raw);
              console.log(`✓ ${source} first heading codepoints:`, cps.join(' '));
            }

            console.log(`✓ Loaded ${source}`);
          } catch (error) {
            console.log('⚠ index.md not found, using embedded demo');
            const embedded = document.getElementById('markdown');
            markdown = embedded ? embedded.textContent : '';
            source = 'embedded';
          }
        }

        // ── Frontmatter font parsing (lite) ───────────────────────────────
        function parseFrontmatterLite(src) {
          const out = {};
          const lines = String(src || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          if ((lines[0] || '').trim() !== '---') return out;
          let end = -1;
          for (let i = 1; i < lines.length; i++) {
            if ((lines[i] || '').trim() === '---') { end = i; break; }
          }
          if (end <= 0) return out;
          for (const line of lines.slice(1, end)) {
            const m = line.match(/^([\w-]+):\s*(.*)$/);
            if (!m) continue;
            const key = (m[1] || '').trim();
            let value = (m[2] || '').trim();
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            out[key] = value;
          }
          return out;
        }

        const fm = parseFrontmatterLite(markdown);
        const requiresAudioGesture = parseBoolish(fm.requiresAudioGesture) === true;
        const requestedOrientation = fm.orientation ?? fm.orientationLock ?? fm.requireOrientation ?? fm.requiredOrientation;
        const requiredOrientation = normalizeOrientationRequirement(requestedOrientation);

        if (requestedOrientation != null && !requiredOrientation) {
          console.warn('[host-orientation] Ignoring unsupported frontmatter orientation:', requestedOrientation);
        }

        // Frontmatter keys used by demos:
        // - font: "Rye"
        // - fontsize: 22
        // - stretch: true
        // - orientation: landscape
        const normalizeFontName = (s) => String(s || '').replace(/\+/g, ' ').trim();

        let orientationGate = null;
        const setOrientationGateVisible = (visible) => {
          if (!visible && !orientationGate) {
            document.body.classList.remove('storie-orientation-gated');
            return;
          }

          if (!orientationGate) {
            orientationGate = ensureOrientationGate();
          }

          const message = orientationGate.querySelector('#orientation-gate-message');
          if (message) {
            const targetLabel = requiredOrientation === 'portrait' ? 'portrait' : 'landscape';
            message.textContent = `This story is authored for ${targetLabel} viewing. Rotate your device to continue.`;
          }

          orientationGate.classList.toggle('visible', visible);
          orientationGate.setAttribute('aria-hidden', visible ? 'false' : 'true');
          document.body.classList.toggle('storie-orientation-gated', visible);
        };

        const matchesRequiredOrientation = () => {
          if (!requiredOrientation) return true;
          const { width, height } = getHostViewportSize();
          if (!(width > 0) || !(height > 0)) return true;
          const currentOrientation = width >= height ? 'landscape' : 'portrait';
          return currentOrientation === requiredOrientation;
        };

        const syncOrientationRequirement = () => {
          if (!requiredOrientation || !isTouchLikeDevice) {
            setOrientationGateVisible(false);
            return true;
          }

          const matches = matchesRequiredOrientation();
          setOrientationGateVisible(!matches);
          return matches;
        };

        let orientationLockAttempted = false;
        const maybeLockRequiredOrientation = async () => {
          if (!requiredOrientation || !isTouchLikeDevice || orientationLockAttempted) return false;
          orientationLockAttempted = true;

          const orientationApi = window.screen && window.screen.orientation;
          if (!orientationApi || typeof orientationApi.lock !== 'function') return false;

          try {
            await orientationApi.lock(requiredOrientation);
            console.log(`[host-orientation] locked ${requiredOrientation}`);
            return true;
          } catch (error) {
            const name = String(error?.name || '');
            if (!['AbortError', 'NotAllowedError', 'NotSupportedError', 'SecurityError', 'TypeError'].includes(name)) {
              console.warn(`[host-orientation] failed to lock ${requiredOrientation}:`, error);
            }
            return false;
          } finally {
            syncOrientationRequirement();
          }
        };

        syncOrientationRequirement();

        // Frontmatter-driven stretch, unless the URL param is explicitly set.
        if (stretchFromUrl === null && Object.prototype.hasOwnProperty.call(fm, 'stretch')) {
          stretchToFit = parseBoolish(fm.stretch);
        }

        const primaryFont = (fm.font && String(fm.font).trim()) ? normalizeFontName(fm.font) : '3270-regular';
        const parsedFontSize = Number(fm.fontsize || fm.fontSize);
        const fontSize = Number.isFinite(parsedFontSize) && parsedFontSize > 0 ? parsedFontSize : 16;

        const fallbackStack = "'3270-regular', 'Consolas', 'Monaco', monospace";
        const quotedPrimary = `'${primaryFont.replace(/'/g, "\\'")}'`;
        let fontStack = (primaryFont.toLowerCase() === '3270-regular')
          ? fallbackStack
          : `${quotedPrimary}, ${fallbackStack}`;

        function isProbablyMonospaceFontStack(stack, sizePx, tolerancePx = 0.5) {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return true;
            ctx.font = `${sizePx}px ${stack}`;
            const w1 = ctx.measureText('iiiiiiiiii').width / 10;
            const w2 = ctx.measureText('WWWWWWWWWW').width / 10;
            const w3 = ctx.measureText('..........').width / 10;
            if (![w1, w2, w3].every(Number.isFinite)) return true;
            if (w1 <= 0 || w2 <= 0 || w3 <= 0) return true;
            return Math.abs(w1 - w2) <= tolerancePx && Math.abs(w1 - w3) <= tolerancePx;
          } catch {
            return true;
          }
        }

        const LOCAL_FONT_EXTENSIONS = ['otf', 'ttf', 'woff2', 'woff'];
        const LOCAL_FONT_MARKER_PREFIX = 'storie-local-font-';

        function toKebabCase(value) {
          return String(value || '')
            .trim()
            .replace(/[^A-Za-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        }

        function getLocalFontCandidates(family) {
          const normalized = String(family || '').trim();
          if (!normalized) return [];

          const compact = normalized.replace(/\s+/g, '');
          const kebab = toKebabCase(normalized);
          const stems = Array.from(new Set([normalized, compact, kebab].filter(Boolean)));
          const names = new Set();
          for (const stem of stems) {
            names.add(stem);
            names.add(`${stem}-Regular`);
            names.add(`${stem}-regular`);
            names.add(`${stem}-VariableFont_wght`);
          }

          const base = new URL(config.assetsBaseUrl, document.baseURI);
          const candidates = [];
          for (const name of names) {
            for (const ext of LOCAL_FONT_EXTENSIONS) {
              candidates.push({
                href: new URL(`${name}.${ext}`, base).href,
                format: ext === 'otf' ? 'opentype' : ext === 'ttf' ? 'truetype' : ext
              });
            }
          }
          return candidates;
        }

        async function tryLoadLocalFont(family, physicalSizePx) {
          try {
            if (!family || !document.fonts) return false;
            const fam = String(family).trim();
            if (!fam) return false;

            const markerId = `${LOCAL_FONT_MARKER_PREFIX}${fam}`;
            const existing = document.querySelector(`style[data-storie-local-font="${CSS.escape(markerId)}"]`);
            if (existing) {
              await Promise.race([
                document.fonts.load(`${physicalSizePx}px "${fam}"`),
                new Promise(resolve => setTimeout(resolve, 750))
              ]);
              return true;
            }

            for (const candidate of getLocalFontCandidates(fam)) {
              try {
                const face = new FontFace(fam, `url("${candidate.href}") format("${candidate.format}")`);
                const loaded = await Promise.race([
                  face.load().then(() => face, () => null),
                  new Promise(resolve => setTimeout(() => resolve(null), 750))
                ]);
                if (!loaded) continue;

                document.fonts.add(loaded);
                const marker = document.createElement('style');
                marker.setAttribute('data-storie-local-font', markerId);
                marker.textContent = `:root { --${toKebabCase(markerId) || 'storie-local-font'}: 1; }`;
                document.head.appendChild(marker);

                await Promise.race([
                  document.fonts.load(`${physicalSizePx}px "${fam}"`),
                  new Promise(resolve => setTimeout(resolve, 750))
                ]);
                return true;
              } catch {
                // Try next candidate.
              }
            }
          } catch {
            // ignore
          }
          return false;
        }

        async function tryLoadGoogleFont(family, physicalSizePx) {
          try {
            if (!family || !document.fonts) return false;
            const fam = String(family).trim();
            const lower = fam.toLowerCase();
            if (!fam) return false;
            if (['3270-regular', 'consolas', 'monaco', 'monospace', 'serif', 'sans-serif'].includes(lower)) return false;

            // Avoid duplicate stylesheet inserts.
            const sel = `link[data-storie-google-font="${CSS.escape(fam)}"]`;
            let link = document.querySelector(sel);
            if (!link) {
              const famParam = encodeURIComponent(fam).replace(/%20/g, '+');
              const href = `https://fonts.googleapis.com/css2?family=${famParam}&display=swap`;
              link = document.createElement('link');
              link.rel = 'stylesheet';
              link.href = href;
              link.setAttribute('data-storie-google-font', fam);
              document.head.appendChild(link);
              await new Promise((resolve) => {
                const t = setTimeout(resolve, 1500);
                link.onload = () => { clearTimeout(t); resolve(); };
                link.onerror = () => { clearTimeout(t); resolve(); };
              });
            }

            // Trigger font resolution.
            await Promise.race([
              document.fonts.load(`${physicalSizePx}px "${fam}"`),
              new Promise(resolve => setTimeout(resolve, 1500))
            ]);
            return true;
          } catch {
            return false;
          }
        }

        async function tryLoadPreferredFont(family, physicalSizePx) {
          if (await tryLoadLocalFont(family, physicalSizePx)) return true;
          return await tryLoadGoogleFont(family, physicalSizePx);
        }

        function measureMonospaceCellWidth(ctx, extraGutterPx = 1) {
          const samples = ['M', 'W', '@', '#', '0', '1', '8', '|', '_'];
          let maxAdvance = 0;
          let maxInk = 0;
          for (const sample of samples) {
            const metrics = ctx.measureText(sample);
            if (Number.isFinite(metrics.width)) maxAdvance = Math.max(maxAdvance, metrics.width);
            const left = Number.isFinite(metrics.actualBoundingBoxLeft) ? Math.abs(metrics.actualBoundingBoxLeft) : 0;
            const right = Number.isFinite(metrics.actualBoundingBoxRight) ? Math.abs(metrics.actualBoundingBoxRight) : 0;
            maxInk = Math.max(maxInk, left + right);
          }
          return Math.max(1, Math.ceil(Math.max(maxAdvance, maxInk)) + Math.max(0, Math.round(extraGutterPx)));
        }

        // Measure actual font dimensions (must match renderer / glyph atlas)
        const dpr = window.devicePixelRatio || 1;
        const physicalFontSizePx = Math.max(1, Math.round(fontSize * dpr));

        // Best-effort preload of Google Fonts before measurement so our
        // bootstrap cell metrics match the glyph atlas.
        await tryLoadPreferredFont(primaryFont, physicalFontSizePx);

        if (document.fonts && document.fonts.ready) {
          try {
            await document.fonts.ready;
            await document.fonts.load(`${physicalFontSizePx}px ${fontStack}`);
            console.log('✓ Font ready for measurement');
          } catch (e) {
            console.log('⚠ Font readiness check failed, continuing anyway');
          }
        }

        // Guardrail: terminal rendering assumes monospace. If the requested
        // font resolves to a proportional face, fall back to monospace.
        if (!isProbablyMonospaceFontStack(fontStack, physicalFontSizePx)) {
          console.warn('⚠ Requested font is not monospace; falling back for grid alignment:', primaryFont);
          fontStack = fallbackStack;
        }

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `${physicalFontSizePx}px ${fontStack}`;
        tempCtx.textBaseline = 'top';

        // Physical char size (matches atlas internals).
        const charWidthPhysical = measureMonospaceCellWidth(tempCtx);
        const charHeightPhysical = physicalFontSizePx;
        const charWidth = charWidthPhysical / dpr;
        const charHeight = charHeightPhysical / dpr;

        const getSafeAreaInsetPx = (edge) => {
          try {
            const v = getComputedStyle(document.documentElement)
              .getPropertyValue(`--safe-area-inset-${edge}`)
              .trim();
            const n = parseFloat(v);
            return Number.isFinite(n) ? n : 0;
          } catch {
            return 0;
          }
        };

        const getViewportSize = () => {
          const vv = window.visualViewport;
          // Prefer `innerWidth/innerHeight`. In some hosted preview environments,
          // `documentElement.clientWidth/Height` can fail to update during live
          // resizes even though the browser viewport is changing.
          const innerW = (typeof window.innerWidth === 'number') ? window.innerWidth : 0;
          const innerH = (typeof window.innerHeight === 'number') ? window.innerHeight : 0;
          const vvW = (vv && typeof vv.width === 'number') ? vv.width : 0;
          const vvH = (vv && typeof vv.height === 'number') ? vv.height : 0;
          const docW = (document.documentElement && typeof document.documentElement.clientWidth === 'number')
            ? document.documentElement.clientWidth
            : 0;
          const docH = (document.documentElement && typeof document.documentElement.clientHeight === 'number')
            ? document.documentElement.clientHeight
            : 0;

          const rawW = (innerW > 0 ? innerW : (vvW > 0 ? vvW : docW));
          const rawH = (innerH > 0 ? innerH : (vvH > 0 ? vvH : docH));

          const safeTop = getSafeAreaInsetPx('top');
          const safeBottom = getSafeAreaInsetPx('bottom');
          const safeLeft = getSafeAreaInsetPx('left');
          const safeRight = getSafeAreaInsetPx('right');

          const width = Math.max(0, rawW - safeLeft - safeRight);
          const height = Math.max(0, rawH - safeTop - safeBottom);
          return { width, height };
        };

        // Debug: when running the gui-responsive demo, periodically print the
        // host's viewport + canvas metrics so we can see what is (not) changing
        // during live resizes in hosted preview environments.
        const debugViewport = (() => {
          try {
            const cp = (new URLSearchParams(window.location.search).get('content') || '').trim();
            return cp === 'gui-responsive' || cp === 'demo:gui-responsive' || cp.endsWith('/gui-responsive');
          } catch {
            return false;
          }
        })();
        if (debugViewport) {
          try {
            setInterval(() => {
              try {
                const vv = window.visualViewport;
                const m = getViewportSize();
                const rect = canvas.getBoundingClientRect();
                console.log('[debugViewport]', {
                  inner: { w: window.innerWidth, h: window.innerHeight },
                  doc: {
                    w: document.documentElement?.clientWidth,
                    h: document.documentElement?.clientHeight,
                  },
                  visualViewport: vv ? { w: vv.width, h: vv.height, scale: vv.scale } : null,
                  getViewportSize: { w: m.width, h: m.height },
                  canvasStyle: { w: canvas.style.width, h: canvas.style.height },
                  canvasRect: { w: rect.width, h: rect.height },
                  canvasBuffer: { w: canvas.width, h: canvas.height },
                  dpr: window.devicePixelRatio,
                });
              } catch {
                // ignore
              }
            }, 1000);
          } catch {
            // ignore
          }
        }

        console.log(`✓ Measured font: ${charWidthPhysical}x${charHeightPhysical}px physical (${charWidth}x${charHeight} logical) per character`);

        const { width: viewportW, height: viewportH } = getViewportSize();
        const gridWidth = Math.max(1, Math.floor(viewportW / charWidth));
        const gridHeight = Math.max(1, Math.floor(viewportH / charHeight));

        canvas.width = gridWidth * charWidthPhysical;
        canvas.height = gridHeight * charHeightPhysical;

        const untrusted = (source === 'gist' || source === 'decode' || source === 'localStorage');

        // Create engine with measured grid size
        const engine = new StorieEngine(canvas, {
          width: gridWidth,
          height: gridHeight,
          fontFamily: fontStack,
          fontSize: fontSize,
          security: {
            untrusted,
            allowCrossOriginDynamicImport: false,
            allowModuleResolverFromSandbox: false,
          }
        });
        activeEngine = engine;

        if (audioGate && isTouchLikeDevice && requiresAudioGesture) {
          audioGate.classList.add('visible');
          audioGate.setAttribute('aria-hidden', 'false');

          let audioGateHandled = false;
          const unlockFromGate = async (event) => {
            if (audioGateHandled) return;
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            const point = getClientPoint(event);
            try {
              hostUnlockAudio.pause();
              hostUnlockAudio.currentTime = 0;
              await hostUnlockAudio.play();
              const unlocked = engine.unlockAudioFromHostGesture();
              await maybeLockRequiredOrientation();
              audioGateHandled = true;
              console.log(`[host-audio-gate] audio unlock ${unlocked ? 'succeeded' : 'attempted'}`);
              dismissAudioGate();
              if (point) {
                requestAnimationFrame(() => replayTapIntoEngine(point));
              }
            } catch (error) {
              console.error('[host-audio-gate] audio unlock failed:', error);
            }
          };

          audioGate.addEventListener('pointerdown', unlockFromGate, { passive: false, once: true });
          audioGate.addEventListener('touchend', unlockFromGate, { passive: false, once: true });
          window.addEventListener('keydown', unlockFromGate, { once: true });
        } else {
          dismissAudioGate();
        }

        if (requiredOrientation && isTouchLikeDevice) {
          window.addEventListener('pointerdown', () => {
            void maybeLockRequiredOrientation();
          }, { once: true });
          window.addEventListener('keydown', () => {
            void maybeLockRequiredOrientation();
          }, { once: true });
        }

        if (IS_TAURI) {
          await installTauriDropHandling(engine);
        } else {
          engine.installDropHandling(document.body);
        }

        console.log(`✓ S|torie engine initialized (${gridWidth}x${gridHeight}) [${IS_TAURI ? 'Tauri native' : 'browser'}]`);

        const applyDocumentViewport = () => {
          const vc = engine.getViewportConstraint();
          const newDpr = window.devicePixelRatio || 1;
          const { width: vw, height: vh } = getViewportSize();
          if (vc) {
            const scale  = Math.min(vw / vc.width, vh / vc.height);
            const cssW   = Math.floor(vc.width  * scale);
            const cssH   = Math.floor(vc.height * scale);
            const newGridW = Math.max(1, Math.floor(cssW / charWidth));
            const newGridH = Math.max(1, Math.floor(cssH / charHeight));
            canvas.width  = newGridW * charWidthPhysical;
            canvas.height = newGridH * charHeightPhysical;
            engine.resize(newGridW, newGridH);

            const logicalW = canvas.width / newDpr;
            const logicalH = canvas.height / newDpr;
            const displayW = stretchToFit ? cssW : logicalW;
            const displayH = stretchToFit ? cssH : logicalH;

            const leftPx = Math.round((vw - displayW) / 2);
            const topPx  = Math.round((vh - displayH) / 2);
            canvas.style.left      = leftPx + 'px';
            canvas.style.top       = topPx  + 'px';
            canvas.style.transform = '';

            canvas.style.width  = Math.round(displayW) + 'px';
            canvas.style.height = Math.round(displayH) + 'px';

            console.log(`✓ Constrained viewport ${vc.width}x${vc.height}px → ${newGridW}x${newGridH} cells (${Math.round(displayW)}x${Math.round(displayH)} CSS px @ ${leftPx},${topPx})${stretchToFit ? ' [stretched]' : ''}`);
          } else {
            canvas.style.left      = '0';
            canvas.style.top       = '0';
            canvas.style.transform = '';
            const newGridW = Math.max(1, Math.floor(vw / charWidth));
            const newGridH = Math.max(1, Math.floor(vh / charHeight));
            canvas.width  = newGridW * charWidthPhysical;
            canvas.height = newGridH * charHeightPhysical;
            engine.resize(newGridW, newGridH);

            const logicalW = canvas.width / newDpr;
            const logicalH = canvas.height / newDpr;
            const displayW = stretchToFit ? vw : logicalW;
            const displayH = stretchToFit ? vh : logicalH;
            canvas.style.width  = Math.round(displayW) + 'px';
            canvas.style.height = Math.round(displayH) + 'px';
            console.log(`✓ Resized to ${newGridW}x${newGridH}`);
          }
        };

        let resizeTimeout;
        let resizeRaf = 0;
        const handleResize = () => {
          // Update ASAP (next frame) so live drag-resize feels responsive,
          // but also schedule a short trailing update to catch final sizes.
          if (!resizeRaf) {
            resizeRaf = requestAnimationFrame(() => {
              resizeRaf = 0;
              syncOrientationRequirement();
              applyDocumentViewport();
            });
          }
          clearTimeout(resizeTimeout);
          resizeTimeout = setTimeout(() => {
            syncOrientationRequirement();
            applyDocumentViewport();
          }, 120);
        };

        window.addEventListener('resize', handleResize);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', handleResize);
          window.visualViewport.addEventListener('scroll', handleResize);
        }

        // Some environments (webviews, split panes, embedded iframes) can
        // resize the canvas/container without firing `window.resize`.
        // Use a ResizeObserver as an additional signal.
        let resizeObserver = null;
        try {
          if (typeof ResizeObserver !== 'undefined') {
            const observed = new Set();
            const observe = (el) => {
              if (!el || observed.has(el)) return;
              observed.add(el);
              resizeObserver.observe(el);
            };

            resizeObserver = new ResizeObserver((entries) => {
              // If any observed element changes size, recompute viewport.
              for (const entry of entries || []) {
                const cr = entry && entry.contentRect;
                if (cr && cr.width > 0 && cr.height > 0) {
                  handleResize();
                  break;
                }
              }
            });

            observe(canvas);
            observe(canvas.parentElement);
            observe(document.documentElement);
            observe(document.body);
          }
        } catch {
          // ignore
        }

        const loaded = await engine.loadMarkdown('demo', markdown);

        if (!loaded) {
          console.error('✗ Failed to load demo');
          return;
        }

        console.log(`✓ Demo loaded from ${source}`);

        try {
          await document.fonts.load(`${fontSize}px ${fontStack}`);
          console.log('✓ Font loaded');
        } catch (e) {
          console.log('⚠ Font load check failed, continuing anyway');
        }

        await engine.start();
        console.log('✓ Engine started');

        applyDocumentViewport();

        // Failsafe: periodically re-check viewport size and update the canvas.
        // Some hosted preview environments can miss resize signals.
        try {
          let lastSig = '';
          setInterval(() => {
            try {
              const vv = getViewportSize();
              const dpr = window.devicePixelRatio || 1;
              const sig = `${Math.round(vv.width)}x${Math.round(vv.height)}@${Math.round(dpr * 1000)}`;
              if (sig !== lastSig) {
                lastSig = sig;
                applyDocumentViewport();
              }
            } catch {
              // ignore
            }
          }, 250);
        } catch {
          // ignore
        }

        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';

        installExportPanel(engine);
        installStorieOverlay(engine, fm, {
          source,
          sourcePath: typeof source === 'string' ? source : null,
        });

        const shaderChain = parseShaderChain();
        if (shaderChain) {
          console.log('✓ Applying shader chain from URL:', shaderChain);
          await engine.applyShaderChain(shaderChain, 'url');
        }

        setTimeout(applyDocumentViewport, 100);

      } catch (error) {
        console.error(`✗ Error: ${error.message}`, error);
      }
    }

    function sanitizeSuggestedFilename(value) {
      const raw = String(value ?? '').trim();
      if (!raw) return 'storie-document.md';
      const leaf = raw.split('/').pop().split('\\').pop();
      const safe = leaf.replace(/[<>:"|?*]+/g, '-').replace(/\s+/g, ' ').trim();
      if (!safe) return 'storie-document.md';
      return safe.toLowerCase().endsWith('.md') ? safe : `${safe}.md`;
    }

    function getSuggestedMarkdownFilename(engine, sourceInfo = {}) {
      if (typeof sourceInfo.sourcePath === 'string' && sourceInfo.sourcePath.trim()) {
        return sanitizeSuggestedFilename(sourceInfo.sourcePath);
      }
      if (typeof sourceInfo.source === 'string' && sourceInfo.source.trim()) {
        return sanitizeSuggestedFilename(sourceInfo.source);
      }
      try {
        if (typeof engine.getCurrentDocumentName === 'function') {
          const documentName = engine.getCurrentDocumentName();
          if (documentName) return sanitizeSuggestedFilename(documentName);
        }
      } catch {
        // ignore
      }
      return 'storie-document.md';
    }

    function downloadMarkdownBlob(markdown, filename) {
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function saveMarkdownViaTauri(markdown, filename) {
      if (!IS_TAURI) return null;

      const invoke = window.__TAURI__?.core?.invoke;
      if (typeof invoke !== 'function') return null;

      try {
        const savedPath = await invoke('save_markdown_document', {
          payload: {
            suggestedFilename: filename,
            markdown,
          },
        });
        if (!savedPath) return false;
        console.log(`✓ Saved markdown via Tauri: ${savedPath}`);
        return true;
      } catch (error) {
        console.error('Failed to save markdown document via Tauri:', error);
        return false;
      }
    }

    async function saveActiveMarkdownDocument(engine, sourceInfo = {}) {
      const markdown = typeof engine.getActiveDocumentSourceMarkdown === 'function'
        ? engine.getActiveDocumentSourceMarkdown()
        : null;

      if (typeof markdown !== 'string') {
        console.warn('No active markdown document is available to save');
        return false;
      }

      const filename = getSuggestedMarkdownFilename(engine, sourceInfo);

      const tauriResult = await saveMarkdownViaTauri(markdown, filename);
      if (tauriResult !== null) return tauriResult;

      if (typeof window.showSaveFilePicker === 'function') {
        try {
          const fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Markdown Document',
              accept: {
                'text/markdown': ['.md'],
                'text/plain': ['.md'],
              },
            }],
          });
          const writable = await fileHandle.createWritable();
          await writable.write(markdown);
          await writable.close();
          console.log(`✓ Saved markdown as ${filename}`);
          return true;
        } catch (error) {
          if (error && error.name === 'AbortError') return false;
          console.error('Failed to save markdown document:', error);
          return false;
        }
      }

      downloadMarkdownBlob(markdown, filename);
      console.log(`✓ Downloaded markdown as ${filename}`);
      return true;
    }

    // ── S|torie Overlay ────────────────────────────────────────────────────────
    // A small top-right corner widget with FPS counter, theme switcher, and links.
    // Opt out in frontmatter with: storieOverlay: false
    function installStorieOverlay(engine, fm, sourceInfo = {}) {
      const parseFmBool = (val) => {
        const v = String(val ?? '').trim().toLowerCase();
        return v === '0' || v === 'false' || v === 'no' || v === 'off';
      };
      if (Object.prototype.hasOwnProperty.call(fm, 'storieOverlay') && parseFmBool(fm.storieOverlay)) {
        const wrap = document.getElementById('storie-overlay');
        if (wrap) wrap.style.display = 'none';
        return;
      }

      const wrap      = document.getElementById('storie-overlay');
      const btn       = document.getElementById('storie-overlay-btn');
      const panel     = document.getElementById('storie-overlay-panel');
      const fpsEl     = document.getElementById('storie-overlay-fps');
      const themeEl   = document.getElementById('storie-overlay-theme');
      const exportLnk = document.getElementById('storie-overlay-export');
      const saveMarkdownLnk = document.getElementById('storie-overlay-save-markdown');

      if (!wrap || !btn || !panel || !fpsEl || !themeEl) return;

      // ── FPS ring-buffer ──────────────────────────────────────────
      const _fpsBuf = new Float64Array(30);
      let _fpsIdx = 0, _fpsLast = 0;
      const _tickFPS = (now) => {
        if (_fpsLast) _fpsBuf[_fpsIdx++ % 30] = now - _fpsLast;
        _fpsLast = now;
        requestAnimationFrame(_tickFPS);
      };
      requestAnimationFrame(_tickFPS);
      const getDisplayFPS = () => {
        const filled = Math.min(_fpsIdx, 30);
        if (!filled) return '—';
        let sum = 0;
        for (let i = 0; i < filled; i++) sum += _fpsBuf[i];
        return sum ? String(Math.round(1000 / (sum / filled))) : '—';
      };
      setInterval(() => { fpsEl.textContent = getDisplayFPS(); }, 500);

      // ── Theme select ─────────────────────────────────────────────
      const populateThemes = () => {
        themeEl.replaceChildren();
        let names = [];
        try {
          if (typeof engine.getThemeNames === 'function') names = engine.getThemeNames();
        } catch {}
        let current = 'neotopia';
        try {
          if (typeof engine.getThemeName === 'function') current = engine.getThemeName();
        } catch {}
        for (const name of names) {
          const opt = document.createElement('option');
          opt.value = name;
          opt.textContent = name;
          if (name === current) opt.selected = true;
          themeEl.appendChild(opt);
        }
      };
      populateThemes();
      themeEl.addEventListener('change', () => {
        try { engine.setTheme(themeEl.value); } catch {}
      });

      // ── Export Video link ────────────────────────────────────────
      if (exportLnk) {
        exportLnk.addEventListener('click', (e) => {
          e.preventDefault();
          closePanel();
          // Reuse the existing export panel keyboard shortcut logic by
          // dispatching the same Ctrl+Shift+E keyboard event into the window.
          try {
            window.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'E', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true
            }));
          } catch {}
        });
      }

      if (saveMarkdownLnk) {
        saveMarkdownLnk.addEventListener('click', async (e) => {
          e.preventDefault();
          closePanel();
          await saveActiveMarkdownDocument(engine, sourceInfo);
        });
      }

      // ── Panel toggle ─────────────────────────────────────────────
      let open = false;
      const openPanel = () => {
        open = true;
        panel.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
        populateThemes();
      };
      const closePanel = () => {
        open = false;
        panel.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      };

      btn.addEventListener('click', () => { open ? closePanel() : openPanel(); });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && open) closePanel();
      });

      document.addEventListener('pointerdown', (e) => {
        if (open && !wrap.contains(e.target)) closePanel();
      }, { capture: true });
    }

    // ── Video Export Panel ──────────────────────────────────────────────────────
    function installExportPanel(engine) {
      const panel         = document.getElementById('export-panel');
      const form          = document.getElementById('export-form');
      const progress      = document.getElementById('export-progress');
      const startBtn      = document.getElementById('export-start-btn');
      const cancelBtn     = document.getElementById('export-cancel-btn');
      const closeBtn      = document.getElementById('export-close-btn');
      const bar           = document.getElementById('export-bar');
      const statusEl      = document.getElementById('export-status');
      const durationEl    = document.getElementById('export-duration');
      const fpsEl         = document.getElementById('export-fps');
      const bitrateEl     = document.getElementById('export-bitrate');
      const resolutionEl  = document.getElementById('export-resolution');
      const customResEl   = document.getElementById('export-custom-res');
      const widthEl       = document.getElementById('export-width');
      const heightEl      = document.getElementById('export-height');
      const audioEl       = document.getElementById('export-audio');
      const timedBlockEl  = document.getElementById('export-automation-timed');

      if (!panel || !form || !progress || !startBtn || !cancelBtn || !closeBtn || !bar || !statusEl ||
          !durationEl || !fpsEl || !bitrateEl || !resolutionEl || !customResEl || !widthEl || !heightEl) {
        return;
      }

      let exporter = null;

      resolutionEl.addEventListener('change', () => {
        customResEl.classList.toggle('hidden', resolutionEl.value !== 'custom');
      });

      function getExportResolution() {
        const v = resolutionEl.value;
        if (v === 'source') return { w: engine.getCanvas().width, h: engine.getCanvas().height };
        if (v === 'custom') return { w: parseInt(widthEl.value, 10) || 1920, h: parseInt(heightEl.value, 10) || 1080 };
        const [w, h] = v.split('x').map(Number);
        return { w, h };
      }

      function openPanel() {
        form.classList.remove('hidden');
        progress.classList.add('hidden');
        bar.style.width = '0%';
        bar.style.background = '#2a7a2a';
        cancelBtn.disabled = false;
        panel.classList.remove('hidden');

        if (timedBlockEl && typeof engine.getTimedBlockNames === 'function') {
          const prev = timedBlockEl.value;
          const names = engine.getTimedBlockNames() || [];
          timedBlockEl.replaceChildren();
          timedBlockEl.append(new Option('(none)', ''));
          for (const name of names) timedBlockEl.append(new Option(name, name));
          if (prev && names.includes(prev)) timedBlockEl.value = prev;
        }
      }

      function closePanel() {
        panel.classList.add('hidden');
      }

      window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key === 'E') {
          e.preventDefault();
          panel.classList.contains('hidden') ? openPanel() : closePanel();
        }
        if (e.key === 'Escape' && !exporter) closePanel();
      });

      closeBtn.addEventListener('click', closePanel);

      const noteEl      = document.querySelector('.export-note');
      const hasWebCodecs = typeof VideoEncoder !== 'undefined';
      const hasPicker    = typeof window.showSaveFilePicker === 'function';
      const hasAudioEnc  = typeof AudioEncoder !== 'undefined';

      if (!hasAudioEnc && audioEl) {
        audioEl.disabled = true;
        audioEl.checked  = false;
        audioEl.closest('.export-audio-row').style.opacity = '0.4';
        audioEl.closest('.export-audio-row').title = 'AudioEncoder not available in this browser';
      }

      if (!hasWebCodecs || !hasPicker) {
        startBtn.disabled = true;
        startBtn.style.opacity = '0.4';
        startBtn.style.cursor = 'not-allowed';
        if (noteEl) {
          const missing = [];
          if (!hasWebCodecs) missing.push('WebCodecs (VideoEncoder)');
          if (!hasPicker)    missing.push('File System Access API');
          noteEl.textContent = `Video export requires ${missing.join(' and ')}, available in Chrome / Edge 94+.`;
        }
      }

      startBtn.addEventListener('click', async () => {
        if (startBtn.disabled) return;

        const fps        = Math.max(1, Math.min(120, parseInt(fpsEl.value, 10) || 30));
        const duration   = Math.max(0.1, parseFloat(durationEl.value) || 10);
        const bitrate    = parseInt(bitrateEl.value, 10) || 8_000_000;
        let { w: exportWidth, h: exportHeight } = getExportResolution();
        const wantAudio  = hasAudioEnc && audioEl && audioEl.checked;

        let fileHandle;
        try {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: 'storie-export.mp4',
            types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }],
          });
        } catch (_) {
          return;
        }

        form.classList.add('hidden');
        progress.classList.remove('hidden');
        bar.style.width = '0%';
        statusEl.textContent = 'Starting…';

        engine.clearLastUserHandlerError();

        if (typeof engine.setExportTimedBlockSelection === 'function') {
          engine.setExportTimedBlockSelection(timedBlockEl && timedBlockEl.value ? timedBlockEl.value : null);
        }

        engine.pauseForExport();

        const writableStream = await fileHandle.createWritable();

        const exporterUrl = joinUrl(config.hostAssetsBaseUrl, 'video-exporter.js');
        const { VideoExporter } = await import(/* @vite-ignore */ exporterUrl);
        exporter = new VideoExporter();

        const canvas = engine.getCanvas();

        let resizeToken = null;
        if (exportWidth !== canvas.width || exportHeight !== canvas.height) {
          const r = engine.resizeForExport(exportWidth, exportHeight);
          exportWidth  = r.actualWidth;
          exportHeight = r.actualHeight;
          resizeToken  = r.token;
        }

        const tickFrame = (elapsed, delta) => engine.tickExportFrame(elapsed, delta);

        if (wantAudio) {
          const dropped = engine.getLastDroppedFile?.();
          if (dropped && dropped.bytes) {
            try {
              const tmpCtx = new AudioContext({ sampleRate: engine.getAudioSampleRate() });
              const ab = dropped.bytes.buffer.slice(
                dropped.bytes.byteOffset,
                dropped.bytes.byteOffset + dropped.bytes.byteLength
              );
              const audioBuffer = await tmpCtx.decodeAudioData(ab);
              engine.setExportAudioBuffer(audioBuffer, 0);
              await tmpCtx.close();
            } catch (e) {
              console.warn('[Export] Host fallback audio decode failed:', e);
            }
          }
        }

        const audioCapture = wantAudio ? {
          sampleRate: engine.getAudioSampleRate(),
          channels:   2,
          begin: (offlineProxy) => engine.beginAudioExport(offlineProxy),
          end:   ()             => engine.endAudioExport(),
          getCapturedBuffer: () => engine.getExportAudioBuffer(),
        } : null;

        let wasCancelled = false;
        try {
          await exporter.run(
            canvas,
            tickFrame,
            { fps, duration, bitrate, exportWidth, exportHeight, audioCapture },
            writableStream,
            ({ frame, totalFrames, cancelled }) => {
              if (cancelled) { wasCancelled = true; return; }
              const pct = Math.round((frame / totalFrames) * 100);
              bar.style.width = pct + '%';
              const secs = frame / fps;
              const mm = String(Math.floor(secs / 60)).padStart(2, '0');
              const ss = String(Math.floor(secs % 60)).padStart(2, '0');
              statusEl.textContent =
                `Frame ${frame} / ${totalFrames}  —  ${mm}:${ss}  (${pct}%)`;
            }
          );
        } catch (err) {
          console.error('[Export] Render error:', err);
          statusEl.textContent = `Error: ${err.message}`;
          bar.style.background = '#7a2a2a';
        } finally {
          if (resizeToken) engine.restoreExportResize(resizeToken);
          engine.resumeFromExport();
          exporter = null;
        }

        if (wasCancelled) {
          statusEl.textContent = 'Cancelled — partial file saved to disk.';
          bar.style.background = '#7a4a2a';
          setTimeout(() => {
            cancelBtn.disabled = false;
            form.classList.remove('hidden');
            progress.classList.add('hidden');
          }, 3000);
        } else {
          bar.style.width = '100%';
          statusEl.textContent = 'Export complete.';
          setTimeout(closePanel, 2000);
        }
      });

      cancelBtn.addEventListener('click', () => {
        if (!exporter) return;
        exporter.cancel();
        statusEl.textContent = 'Cancelling…';
        cancelBtn.disabled = true;
      });

      console.log('✓ Export panel ready  (Ctrl+Shift+E to open)');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', main);
    } else {
      main();
    }
  })().catch((error) => {
    console.error('[bootstrap] fatal:', error);
  });
}
