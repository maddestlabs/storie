import { parseMarkdown, flattenSections, ensureSectionIds, serializeMarkdownDocumentSource } from './markdown.js';
/**
 * Main S|torie engine
 * Manages main loop, document loading, and user script execution
 */

import { LayerStack } from './layers.js';
import { InputManager } from './input.js';
import { Canvas2DRenderer } from './renderer.js';
import { WebGPURenderer } from './webgpu-renderer.js';
import { Compositor } from './compositor.js';
import { ScriptSandbox } from './sandbox.js';
import { parseTimedFormat, type TimedFormat } from './timed-parsers.js';
import type { CompiledAutomation, EaseSpec, AutomationImpulseEvent } from './automation.js';
import type { HistoryStack, HistoryAction } from './history.js';
import type { InputRecorder, RecordedTape } from './recorder.js';
import type { BeatClock, BeatClockOptions } from './beat-clock.js';
import {
  compileWorldsTimeline,
  stateAtWorldsTimeline,
  getWorldsTimelineSelectorKey,
  type CompiledWorldsTimeline,
  type WorldsTimelineStateEntry,
  type WorldsTimelineSectionSelector,
  type WorldsTimelinePatch,
} from './worlds-timeline.js';
import {
  stateAtWorldsContent,
  type WorldsContentMode,
  type WorldsContentState,
  type WorldsContentStateOptions,
  type WorldsContentTarget,
  type WorldsContentTimedEntry,
} from './worlds-content.js';
import { getTheme, applyTheme, THEMES } from './themes.js';
import { ModuleLoader } from './modules/loader.js';
import { createTUIAPI } from './tui-api.js';
import { setTUIThemeFromStyles } from './ui/tui/theme.js';
import type { DrawOp, LinkRegion, MarkdownStyle, WidgetPlacement, LayoutOptions } from './ui/document/types.js';
import type { Draw2D } from './ui/draw2d.js';
import type { Draw2DAffine } from './ui/draw2d-transform.js';
import type { TextInputCapable } from './ui/core/types.js';
import type { FigletFont } from './figlet.js';
import type { AnsiParsed, AnsiRun } from './ansi.js';
import {
  createCamera3D,
  updateCamera3D,
  createSection3DLayouts,
  getDefaultWorldsConfig,
  focusOnSection,
  focusOnSectionFit,
  setCameraTarget,
  getCameraViewMatrix,
  getCameraProjectionMatrix,
  mat4Multiply,
  mat4Invert,
  mat4FromTransform,
  mat4TransformVec4,
  mat4TransformPoint,
  mat4TransformDirection,
  vec3Dot,
  vec3Cross,
  vec3Normalize,
  vec3Sub,
  vec3Add,
  vec3Scale,
  vec3Length,
  type Camera3D,
  type Section3DLayout,
  type WorldsConfig
} from './worlds.js';
import { getWorldsPreset, listWorldsPresetNames } from './worlds-presets.js';
import type { ModuleResolverConfig } from './modules/types.js';
import type { UserScript, UserHandlers, Section, Color, InputEvent, ThemeColors, ThemeStyleSheet, NamedStyle, DroppedFile, SafeAreaInsets, AudioAssetHandle, AudioVoiceHandle, MarkdownDocument } from './types.js';
import { KEY } from './types.js';
import { ColorUtils } from './types.js';
import {
  drawDecorativeBorder,
  normalizeDecorativeBorderSpec,
  type DecorativeBorderSpec,
} from './decorative-borders.js';
import {
  decodeRenderableImageFromBytes,
  loadRenderableImageFromResolvedUrl,
  resolveRenderableImageUrl,
  type RenderableImageSource,
} from './renderable-image.js';
import type { SandboxAPI } from './sandbox.js';
import type { PeakDetectionOptions, PeakDetectionResult } from './audio/peaks.js';
import type { BeatAnalysisResult, BeatDetectionOptions, BeatState } from './audio/beats.js';
import type { SfxGraphPreset } from './audio/sfx-graph.js';
import type { SfxPresetName } from './audio/sfx-presets.js';
import {
  HostSync,
  parseHostParams,
  createHostSessionIds,
  makeClientJoinUrl,
  type HostRole,
  type HostTransport
} from './host-sync.js';
import {
  DEFAULT_FONT_FALLBACK_STACK,
  buildFontStack,
  getPrimaryFontFamily,
  isProbablyMonospaceFontStack,
  tryLoadGoogleFontFamily
} from './font-loading.js';
import type { WebGPUUIRenderer } from './ui/webgpu-ui-renderer.js';
import type { ShaderManager } from './shader-manager.js';
import type { ShaderChainManager } from './shader-chain.js';
import type { WorldsRenderer, WorldsSectionArtRenderState } from './worlds-renderer.js';

type WebGPUFeaturePack = typeof import('./runtime/webgpu-pack.js');
type UIDocumentPack = typeof import('./runtime/ui-document-pack.js');
type GUIRuntimePack = typeof import('./runtime/gui-pack.js');
type AudioRuntimePack = typeof import('./runtime/audio-pack.js');
type TextRuntimePack = typeof import('./runtime/text-pack.js');
type AuthoredToolsRuntimePack = typeof import('./runtime/authored-tools-pack.js');

type ThemeOverride = { theme: ThemeColors; label: string };
type RuntimeSectionRef = {
  section: Section;
  sectionId: string;
  sectionIndex: number;
  parent: Section | null;
  parentId: string | null;
  parentIndex: number | null;
  siblings: Section[];
  siblingIndex: number;
};
type WorldsSectionRuntimeOverride = {
  position?: { x: number; y: number; z: number };
  rotationDegrees?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  visible?: boolean;
  width?: number;
  height?: number;
};
type WorldsVisualLinkConnection = {
  sourceSectionId: string;
  sourceSectionIndex: number;
  sourceTitle: string;
  linkIndex: number;
  url: string;
  text: string;
  title: string | null;
  meta: Record<string, any> | null;
  relation: string | null;
  internal: boolean;
  targetSectionId: string | null;
  targetSectionIndex: number | null;
  targetTitle: string | null;
  sourceRectScreen: { x: number; y: number; width: number; height: number } | null;
  sourceQuadScreen: Array<{ x: number; y: number }> | null;
  sourcePointScreen: { x: number; y: number } | null;
  targetPointScreen: { x: number; y: number } | null;
  visible: boolean;
};
type Worlds3DRenderedLinkOverlay = {
  enabled: boolean;
  section: number | string | null;
  internalOnly: boolean;
  thickness: number;
  allVisible: boolean;
};

function parseThemeOverride(raw: string): ThemeOverride | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;

  // Custom theme format (from `themer` demo):
  //   RRGGBB+RRGGBB+RRGGBB+RRGGBB+RRGGBB+RRGGBB+RRGGBB
  // Note: URLSearchParams decodes '+' as space in query strings.
  const parts = s.split(/[+\s]+/g).map(p => p.trim()).filter(Boolean);
  if (parts.length === 7 && parts.every(p => /^[0-9a-fA-F]{6}$/.test(p))) {
    const toRGBA = (hex: string): number => {
      const rgb = parseInt(hex, 16) >>> 0;
      return (((rgb & 0xFFFFFF) << 8) | 0xFF) >>> 0;
    };

    const theme: ThemeColors = {
      bg: toRGBA(parts[0]),
      bgAlt: toRGBA(parts[1]),
      fg: toRGBA(parts[2]),
      fgAlt: toRGBA(parts[3]),
      accent1: toRGBA(parts[4]),
      accent2: toRGBA(parts[5]),
      accent3: toRGBA(parts[6])
    };
    return { theme, label: 'custom' };
  }

  // Built-in theme name.
  const name = s.toLowerCase().replace(/['"]/g, '');
  if (Object.prototype.hasOwnProperty.call(THEMES, name)) {
    return { theme: getTheme(name), label: name };
  }

  return null;
}

function buildWorldsCardMarkdown(
  layout: Section3DLayout,
  overrides?: { title?: string; content?: string }
): string {
  const title = (overrides?.title ?? layout.displayTitle ?? layout.sectionTitle ?? '').trim();
  const content = (overrides?.content ?? layout.content ?? '').trim();

  switch (layout.renderMode) {
    case 'heading':
      return title ? `# ${title}` : '';
    case 'content':
      return content;
    case 'none':
      return '';
    case 'all':
    default:
      if (title && content) return `# ${title}\n\n${content}`;
      if (title) return `# ${title}`;
      return content;
  }
}

export interface EngineConfig {
  width?: number;
  height?: number;
  fontFamily?: string;
  fontSize?: number;
  preferWebGPU?: boolean; // Default true
  /**
   * Maximum number of bytes allowed for a single dropped file.
   * Default: 50MB. Set <= 0 to disable the limit.
   */
  maxDropBytes?: number;
  modules?: ModuleResolverConfig; // Module loader configuration

  /**
   * Security policy for user-authored scripts (SES) and content loaded via URL params.
   *
   * IMPORTANT: SES isolates *authority*, but the host engine still has APIs that can
   * execute host-privileged code (e.g. dynamic `import()` for modules/effects).
   * Use `untrusted: true` when running content you do not control (e.g. public gists).
   */
  security?: {
    /**
     * When true, disables high-risk capabilities that could be used to escape SES
     * or execute host-privileged code.
     */
    untrusted?: boolean;
    /**
     * Allow dynamic imports to cross origin (e.g. external CDNs). Default false.
     * This is only relevant for host-privileged dynamic imports (modules/effects).
     */
    allowCrossOriginDynamicImport?: boolean;
    /**
     * Allow passing a custom `resolver` to `modules.load()` from sandboxed code.
     * Default false (recommended).
     */
    allowModuleResolverFromSandbox?: boolean;
  };

  /**
   * Optional host sync (multi-window host/client).
   * Can also be enabled via URL params (see docs).
   */
  host?: {
    enabled?: boolean;
    role?: HostRole;
    transport?: HostTransport;
    channelId?: string;
    token?: string;
  };

  /** Back-compat alias for `host`. */
  presentation?: EngineConfig['host'];
}

type OutlineLevels = 'any' | number | { min?: number; max?: number };

type WorldsOverviewOptions = {
  /** Layout: how many columns in the overview grid (auto if omitted). */
  columns?: number;
  /** Layout: extra spacing between cards in world units (defaults to ~20). */
  padding?: number;
  /** Layout: Z depth to place the grid at (defaults to worldsConfig.defaultDepth). */
  depth?: number;
  /** Camera: fraction of viewport to fill when fitting the full grid (0..1). */
  fill?: number;
  /** Selection: include hidden sections (default false). */
  includeHidden?: boolean;
  /** Selection: include non-navigable sections (default false). */
  includeNonNavigable?: boolean;
  /** Selection: filter by heading levels (default 'any'). */
  levels?: OutlineLevels;
};

type WorldsTimelineBaseState = {
  selector: WorldsTimelineSectionSelector;
  title: string;
  content: string;
  visible: boolean;
  autoPositioned: boolean;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
};

type WorldsTimelineEffectiveState = WorldsTimelineBaseState;

type WorldsTimelineRuntimeState = {
  baseByKey: Map<string, WorldsTimelineBaseState>;
  lastAppliedByKey: Map<string, WorldsTimelineEffectiveState>;
};

type WorldsSectionContentOverride = {
  title?: string;
  content?: string;
};

type WorldsSectionStyleOverride = {
  fg?: Color;
};

export interface OutlineNode {
  /** Depth-first section index (matches Worlds section indices). */
  index: number;
  title: string;
  level: number;
  parentIndex: number | null;
  firstChildIndex: number | null;
  /** Inclusive index of the last node in this node's subtree. */
  lastDescendantIndex: number;
}

type Renderer = Canvas2DRenderer | WebGPURenderer;

type BlobStoreEntry = {
  name: string;
  mime: string;
  encoding: 'base64' | 'hex';
  data: string;
  bytes?: Uint8Array;
};

type TimedStoreEntry = {
  name: string;
  entries: Array<{ ms: number; text: string }>;
};

type AsciiStoreEntry = {
  name: string;
  text: string;
  lines?: string[];
};

type FigletStoreEntry = {
  name: string;
  text: string;
  font?: FigletFont;
};

type AnsiStoreEntry = {
  name: string;
  text: string;
  tabSize: number;
  parsed?: AnsiParsed;
};

type StfxrStoreEntry = {
  name: string;
  preset: SfxGraphPreset;
  defaultSeed?: number | string;
};

type DocumentAssetStores = {
  blobStore: Map<string, BlobStoreEntry>;
  timedStore: Map<string, TimedStoreEntry>;
  logicStore: Array<any>;
  asciiStore: Map<string, AsciiStoreEntry>;
  figletStore: Map<string, FigletStoreEntry>;
  ansiStore: Map<string, AnsiStoreEntry>;
  stfxrStore: Map<string, StfxrStoreEntry>;
};

type CompiledRuntimeLike = {
  scope?: Record<string, any>;
  init?: (extra?: Record<string, any>) => void;
  update?: (delta: number, extra?: Record<string, any>) => void;
  render?: (extra?: Record<string, any>) => void;
  input?: (event: InputEvent, extra?: Record<string, any>) => void;
  drop?: (file: DroppedFile, extra?: Record<string, any>) => void;
  export?: (extra?: Record<string, any>) => void;
  enter?: (sectionId: string, extra?: Record<string, any>) => void;
};

type CompiledAppModuleLike = {
  content?: {
    rawDocument?: MarkdownDocument | null;
  };
  createCompiledAppRuntime?: (api: SandboxAPI, options?: Record<string, any>) => CompiledRuntimeLike;
};

type MarkdownImageCacheEntry = {
  image: RenderableImageSource | null;
  width: number;
  height: number;
  failed: boolean;
  inFlight: Promise<void> | null;
  rendererImageId: string | null;
};

export class StorieEngine {
  // Core systems
  private layers: LayerStack;
  private moduleLoader: ModuleLoader;
  private input: InputManager;

  // Security policy
  private readonly untrustedContent: boolean;
  private readonly allowCrossOriginDynamicImport: boolean;
  private readonly allowModuleResolverFromSandbox: boolean;
  private renderer: Renderer;
  private compositor: Compositor | null = null;
  private sandbox: ScriptSandbox;
  private api!: SandboxAPI;  // User API (initialized in constructor)

  // Font settings (logical CSS pixels). WebGPU glyph atlas scales by DPR.
  private fontFamily: string;
  private fontSize: number;

  // Optional override for Worlds section card text rendering.
  // If frontmatter requests a proportional font, we keep the terminal grid
  // monospace but still allow Worlds cards to use the requested font.
  private worldsCardFontStack: string | null = null;
  
  // Native browser APIs (shared instances)
  private audioContext: AudioContext;
  private readonly audioUrlBufferCache: Map<string, AudioBuffer> = new Map();
  private readonly audioUrlInFlightCache: Map<string, Promise<AudioBuffer | null>> = new Map();
  private readonly uiImageUrlCache: Map<string, string> = new Map(); // resolvedUrl -> registered imageId
  private readonly uiImageUrlInFlight: Map<string, Promise<string | null>> = new Map();
  // Decoded images whose id has been allocated but whose registration is deferred until
  // ensureWebGPUUI() first becomes available (i.e. on:init fires before WebGPU is ready).
  private readonly uiImagePending: Map<string, RenderableImageSource> = new Map();
  private readonly backgroundImageUrlCache: Map<string, RenderableImageSource> = new Map();
  private readonly backgroundImageUrlInFlightCache: Map<string, Promise<RenderableImageSource | null>> = new Map();
  private readonly backgroundImageUrlFailures: Set<string> = new Set();
  private readonly worldsBackgroundCompositeCache: Map<string, RenderableImageSource> = new Map();
  private audioGestureUnlocked: boolean = false;
  private trustedAudioGestureDepth: number = 0;
  private pendingGestureAudioStarts: Array<() => void> = [];
  private lastTouchEventAt: number = 0;
  private canvas2DContext: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  private offscreenCanvas2D: HTMLCanvasElement | null = null;
  private safeAreaProbeElement: HTMLDivElement | null = null;
  private webglContext: WebGLRenderingContext | null = null;
  private webgpuDevice: GPUDevice | null = null;

  // WebGPU UI (optional)
  private webgpuUIRenderer: WebGPUUIRenderer | null = null;
  private sectionWebGPUUIRenderer: WebGPUUIRenderer | null = null;
  private webgpuFeaturePack: WebGPUFeaturePack | null = null;
  private webgpuFeaturePackPromise: Promise<WebGPUFeaturePack> | null = null;
  private uiDocumentPack: UIDocumentPack | null = null;
  private uiDocumentPackPromise: Promise<UIDocumentPack> | null = null;
  private guiRuntimePack: GUIRuntimePack | null = null;
  private guiRuntimePackPromise: Promise<GUIRuntimePack> | null = null;
  private guiRuntimeInstallPromise: Promise<void> | null = null;
  private guiRuntimeInstalled: boolean = false;
  private installGUIAPIImpl: ((impl: any) => void) | null = null;
  private audioRuntimePack: AudioRuntimePack | null = null;
  private audioRuntimePackPromise: Promise<AudioRuntimePack> | null = null;
  private audioRuntimeInstalled: boolean = false;
  private audioRuntimeInstallPromise: Promise<void> | null = null;
  private textRuntimePack: TextRuntimePack | null = null;
  private textRuntimePackPromise: Promise<TextRuntimePack> | null = null;
  private textRuntimeInstalled: boolean = false;
  private textRuntimeInstallPromise: Promise<void> | null = null;
  private authoredToolsRuntimePack: AuthoredToolsRuntimePack | null = null;
  private authoredToolsRuntimePackPromise: Promise<AuthoredToolsRuntimePack> | null = null;
  private authoredToolsRuntimeInstalled: boolean = false;
  private authoredToolsRuntimeInstallPromise: Promise<void> | null = null;
  private worldsInitializationPromise: Promise<boolean> | null = null;

  // Live section rendering: user on:render callbacks draw into 3D section textures.
  private _liveSections: Set<number> = new Set();
  private _liveRenderCtx: { sectionIndex: number; width: number; height: number; localMouseX: number; localMouseY: number; textureScale: number; baseMetricScale: number } | null = null;
  private _liveUIOverride: WebGPUUIRenderer | null = null;
  // Coordinate context for the update phase: makes ui.pointer/metrics section-local
  // when the current section is a live section, so hit testing matches the card geometry.
  private _liveSectionInputCtx: { sectionIndex: number; width: number; height: number; localMouseX: number; localMouseY: number; textureScale: number; baseMetricScale: number } | null = null;
  
  // WebGPU shader management
  private shaderManager: ShaderManager | null = null;
  private shaderChainManager: ShaderChainManager | null = null;

  // Cache the last terminal cellSize pushed to shaders to avoid redundant updates.
  private lastShaderCellSize: { w: number; h: number } | null = null;
  
  // Deferred shader chain (applied after WebGPU init)
  private pendingShaderChain: { chainStr: string; source: string } | null = null;

  // Desired pixel dimensions from frontmatter `width:` / `height:`.
  // Used by the host page to scale the canvas to fit the viewport.
  private frontmatterViewport: { width: number; height: number } | null = null;
  
  // 3D Canvas system
  private worldsRenderer: WorldsRenderer | null = null;
  private camera3D: Camera3D | null = null;
  private runtimeSectionStore: {
    sections: Section[];
    byId: Map<string, Section>;
    order: string[];
    indexById: Map<string, number>;
  } = {
    sections: [],
    byId: new Map(),
    order: [],
    indexById: new Map(),
  };
  private section3DLayouts: Section3DLayout[] = [];

  private pending3DCameraFocus:
    | {
        kind: 'focus';
        sectionIndex: number | string;
        distance: number;
        keepRotation?: boolean;
        straighten?: boolean;
        positionOffset?: { x: number; y: number; z: number };
        rotationOffset?: { x: number; y: number; z: number };
      }
    | {
        kind: 'fit';
        sectionIndex: number | string;
        fill: number;
        keepRotation?: boolean;
        straighten?: boolean;
        positionOffset?: { x: number; y: number; z: number };
        rotationOffset?: { x: number; y: number; z: number };
      }
    | {
        kind: 'frame';
        sectionSelectors?: Array<number | string>;
        includeHidden?: boolean;
        includeNonNavigable?: boolean;
        fill: number;
        padding: number;
        rotation?: { x: number; y: number; z: number };
      }
    | null = null;

  // Last focus request that was actually applied (used to re-frame on resize).
  private lastApplied3DCameraFocus:
    | {
        kind: 'focus';
        sectionId: string;
        sectionIndex: number;
        distance: number;
        keepRotation?: boolean;
        straighten?: boolean;
        positionOffset?: { x: number; y: number; z: number };
        rotationOffset?: { x: number; y: number; z: number };
      }
    | {
        kind: 'fit';
      sectionId: string;
        sectionIndex: number;
        fill: number;
        keepRotation?: boolean;
        straighten?: boolean;
        positionOffset?: { x: number; y: number; z: number };
        rotationOffset?: { x: number; y: number; z: number };
      }
    | {
        kind: 'frame';
        sectionIds: string[];
        fill: number;
        padding: number;
        rotation: { x: number; y: number; z: number };
      }
    | null = null;
  private worldsConfig: WorldsConfig = getDefaultWorldsConfig();
  private worldsEnabled: boolean = false;

  private worldsLayoutCallback: ((args: {
    sectionIndex: number;
    title: string;
    layout: Section3DLayout;
  }) =>
    | {
        position?: { x: number; y: number; z: number };
        rotation?: { x: number; y: number; z: number }; // degrees
        scale?: { x: number; y: number; z: number };
        width?: number;
        height?: number;
        opacity?: number;
        visible?: boolean;
        navigable?: boolean;
        interactive?: boolean;
      }
    | void) | null = null;

  // 3D interaction state (hover + basic navigation controls)
  private worldsControlsEnabled: boolean = false;
  // 3D link navigation key handling (Tab/Enter/Arrow keys). When disabled,
  // user documents can implement their own keybindings (e.g. slide decks).
  private worldsLinkKeyHandlingEnabled: boolean = true;
  private mouseLookActive: boolean = false;
  private mouseLookLastX: number = 0;
  private mouseLookLastY: number = 0;
  private middlePanActive: boolean = false;
  private middlePanLastX: number = 0;
  private middlePanLastY: number = 0;
  private pinchZoomActive: boolean = false;
  private pinchZoomLastDistance: number = 0;
  private pinchZoomLastCenterX: number = 0;
  private pinchZoomLastCenterY: number = 0;
  private multiTouchRotateActive: boolean = false;
  private multiTouchRotateLastCentroidX: number = 0;
  private multiTouchRotateLastCentroidY: number = 0;
  private doubleTapLastTime: number = 0;
  private doubleTapLastX: number = 0;
  private doubleTapLastY: number = 0;
  private freeFlyLeftPanActive: boolean = false;
  private freeFlyLeftDragSectionIndex: number | null = null;
  private freeFlyLeftLastX: number = 0;
  private freeFlyLeftLastY: number = 0;

  // 3D link-centric interaction (canvas.nim parity)
  private hovered3DLink: { sectionId: string; sectionIndex: number; linkIndex: number } | null = null;
  private focused3DLink: { sectionId: string; sectionIndex: number; linkIndex: number } | null = null;
  private current3DSectionId: string | null = null;
  private current3DSectionIndex: number | null = null;
  private selected3DSectionId: string | null = null;
  private selected3DSectionIndex: number | null = null;

  // Worlds section visit state (per-document)
  private worldsVisitedSectionIds: Set<string> = new Set();
  private worldsRemovedSectionIds: Set<string> = new Set();
  private worlds3DRenderedLinkOverlay: Worlds3DRenderedLinkOverlay = {
    enabled: false,
    section: null,
    internalOnly: true,
    thickness: 0.22,
    allVisible: false,
  };
  private activated3DLinksQueue: Array<{ url: string; text: string | null; title: string | null; meta: Record<string, any> | null; relation: string | null; sectionId: string | null; sectionIndex: number | null; linkIndex: number | null }> = [];

  // 3D section texture rasterization cache
  private sectionTextureCache: Map<string, {
    width: number;
    height: number;
    logicalWidth: number;
    logicalHeight: number;
    textureScaleX: number;
    textureScaleY: number;
    activeLinkIndex: number | null;
  }> = new Map();
  private sectionLinkRegionsCache: Map<string, LinkRegion[]> = new Map();
  private sectionWidgetPlacementsCache: Map<string, WidgetPlacement[]> = new Map();
  /** Records the `elapsedTime` (seconds) when each section last became current,
   *  keyed by sectionId. Used for `timed animate:content relative` blocks. */
  private sectionAnimEnterTimes: Map<string, number> = new Map();
  private worldsInlineWidgetInstances: Array<{
    engineId: string;
    sectionId: string;
    sectionIndex: number;
    widgetId: string;
    kind: 'button' | 'slider' | 'checkbox' | 'label';
    widget: any;
    lastValue?: number | boolean | string;
  }> = [];
  private worldsInlineWidgetEventsQueue: Array<{
    id: string;
    kind: 'button' | 'slider' | 'checkbox' | 'label';
    sectionIndex: number;
    action: 'click' | 'change' | 'toggle';
    value?: number | boolean | string;
  }> = [];
  private worldsInlineWidgetValueState: Map<string, number | boolean | string> = new Map();
  private worldsInlineWidgetConfigState: Map<string, {
    min?: number;
    max?: number;
    step?: number;
    label?: string;
    showValue?: boolean;
    fg?: number;
    trackColor?: number;
    knobColor?: number;
    knobHoverColor?: number;
  }> = new Map();
  private debugGuiLastInlineWidgetState: string | null = null;
  private debugGuiLastOverlayRenderState: string | null = null;
  private nextMarkdownImageId: number = 1;

  // Host sync (engine-level, transport pluggable)
  private hostSync: HostSync | null = null;

  // When host sync role is `client`, treat this window as display-only.
  // We keep the terminal visible until the WebGPU 3D layer exists to avoid a blank screen during startup.
  private hostAudienceView: boolean = false;

  // Shared scene state (synced host -> client). Kept intentionally small.
  private sceneState: { sectionIndex: number | null; revealStep: number } = {
    sectionIndex: null,
    revealStep: 0
  };
  
  // Theme system
  private currentTheme: ThemeColors;
  private styleSheet: ThemeStyleSheet;
  private currentThemeLabel: string = 'neotopia';
  private themeOverrideFromUrl: ThemeOverride | null = null;
  
  // Timing
  private frameCount: number = 0;
  private elapsedTime: number = 0;
  private deltaTime: number = 0;
  private _preExportState: { elapsedTime: number; deltaTime: number; frameCount: number } | null = null;
  private _exportTimedBlockSelection: string | null = null;
  private lastFrameTime: number = 0;
  private running: boolean = false;

  // (Reserved for future one-time debug/perf toggles)
  
  // Documents
  private documents: Map<string, UserScript> = new Map();
  private activeDocumentId: string | null = null;
  private worldsSectionOverridesByDocument: Map<string, Map<string, WorldsSectionRuntimeOverride>> = new Map();

  private outlineCache: { documentId: string; nodes: OutlineNode[] } | null = null;
  private worldsSectionContentOverridesByDocument: Map<string, Map<string, WorldsSectionContentOverride>> = new Map();
  private worldsSectionStyleOverridesByDocument: Map<string, Map<string, WorldsSectionStyleOverride>> = new Map();

  // Worlds Overview (host-only)
  private worldsOverviewEnabled: boolean = false;
  private worldsOverviewSavedTransforms:
    | Array<{
        position: { x: number; y: number; z: number };
        rotation: { x: number; y: number; z: number };
        scale: { x: number; y: number; z: number };
      }>
    | null = null;
  private pendingWorldsOverview: { enabled: boolean; options?: WorldsOverviewOptions } | null = null;

  // Cache last computed auto-layout step sizes so we don't rewrite positions every frame.
  private worldsAutoLayoutCache: { cols: number; stepX: number; stepY: number } | null = null;
  private worldsTimelineRuntimeState: WeakMap<object, WorldsTimelineRuntimeState> = new WeakMap();

  // Dropped-file handling (binary-safe)
  private lastDroppedFile: DroppedFile | null = null;
  private dropHandlingCleanup: (() => void) | null = null;

  // True only while dispatching a real DOM input event into the active document handler.
  // Used to gate sensitive operations (e.g., clipboard) so sandbox code cannot trigger them
  // outside a trusted user gesture.
  private inputDispatchDepth: number = 0;
  private maxDropBytes: number = 50 * 1024 * 1024;
  
  // Canvas viewport (reserved for future use)
  // private viewportX: number = 0;
  // private viewportY: number = 0;
  
  // Config
  private width: number;
  private height: number;
  
  // Canvas reference for event listeners
  private canvas: HTMLCanvasElement;
  private hiddenTextInput: HTMLTextAreaElement | null = null;
  private hiddenTextInputSyncing: boolean = false;

  private resetWorldsVisitState(): void {
    this.worldsVisitedSectionIds.clear();
    this.worldsRemovedSectionIds.clear();
  }

  private applyWorldsHiddenUntilVisitedVisibility(): void {
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;

    for (const layout of this.section3DLayouts) {
      if (!layout) continue;
      if (this.worldsRemovedSectionIds.has(layout.sectionId)) {
        layout.visible = false;
        continue;
      }
      if (layout.hiddenUntilVisited) {
        layout.visible = this.worldsVisitedSectionIds.has(layout.sectionId);
      }
    }
  }

  private applyThemeColors(theme: ThemeColors, label: string, source: 'url' | 'frontmatter' | 'default' | 'runtime'): void {
    const nextTheme = { ...theme } as ThemeColors;

    try {
      if (this.api && (this.api as any).theme && typeof (this.api as any).theme === 'object') {
        const liveTheme = (this.api as any).theme as Record<string, unknown>;
        for (const key of Object.keys(liveTheme)) {
          if (!Object.prototype.hasOwnProperty.call(nextTheme, key)) {
            delete liveTheme[key];
          }
        }
        Object.assign(liveTheme, nextTheme);
        this.currentTheme = liveTheme as unknown as ThemeColors;
      } else {
        this.currentTheme = nextTheme;
      }
    } catch {
      this.currentTheme = nextTheme;
    }

    this.currentThemeLabel = label;
    this.styleSheet = applyTheme(this.currentTheme);

    try {
      setTUIThemeFromStyles((name: string) => this.getStyle(name));
    } catch {
      // ignore
    }

    // Keep the sandbox API in sync (it’s created once in the constructor).
    try {
      if (this.api) {
        (this.api as any).theme = this.currentTheme;
        (this.api as any).themes?.getName && ((this.api as any).themes.getName = () => this.currentThemeLabel);
        (this.api as any).tui?.syncTheme?.();
        (this.api as any).gui?.syncTheme?.();
      }
    } catch {
      // ignore
    }

    // Retint terminal buffers so the background matches the new theme.
    this.layers.clearAll(this.currentTheme.bg);

    if (this.worldsEnabled) {
      this.clear3DSectionTextures();
    }

    if (source === 'url') {
      console.log(`  Theme: ${label} (url override)`);
    } else if (source === 'frontmatter') {
      console.log(`  Theme: ${label}`);
    } else if (source === 'runtime') {
      console.log(`  Theme: ${label} (runtime)`);
    }
  }

  private readThemeOverrideFromUrl(): ThemeOverride | null {
    if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') return null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const themeParam = urlParams.get('theme');
      if (!themeParam) return null;

      const override = parseThemeOverride(themeParam);
      if (!override) {
        console.warn(`[theme] Unknown theme override in URL; ignoring:`, themeParam);
        return null;
      }
      return override;
    } catch {
      return null;
    }
  }

  private isUrlFlagEnabled(name: string): boolean {
    if (typeof window === 'undefined' || typeof URLSearchParams === 'undefined') return false;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (name === 'debugGui' && urlParams.get('content') === '0rain') return true;
      const value = String(urlParams.get(name) ?? '').trim().toLowerCase();
      return value === '1' || value === 'true' || value === 'yes' || value === 'on';
    } catch {
      return false;
    }
  }

  private debugGuiLogInlineWidgets(state: string, detail: Record<string, any>): void {
    if (!this.isUrlFlagEnabled('debugGui')) return;
    const serialized = `${state}:${JSON.stringify(detail)}`;
    if (serialized === this.debugGuiLastInlineWidgetState) return;
    this.debugGuiLastInlineWidgetState = serialized;
    console.log('[debugGui][inlineWidgets]', state, detail);
  }

  private debugGuiLogOverlayRender(state: string, detail: Record<string, any>): void {
    if (!this.isUrlFlagEnabled('debugGui')) return;
    const serialized = `${state}:${JSON.stringify(detail)}`;
    if (serialized === this.debugGuiLastOverlayRenderState) return;
    this.debugGuiLastOverlayRenderState = serialized;
    console.log('[debugGui][overlayRender]', state, detail);
  }

  private updateAudienceViewLayers(): void {
    if (!this.hostAudienceView) return;
    if (!this.compositor) return;

    const has3DLayer = !!this.compositor.layers.get('3d');
    const shouldHideTerminal = this.worldsEnabled && has3DLayer;
    if (this.compositor.layers.get('terminal')) {
      this.compositor.updateLayer('terminal', { enabled: !shouldHideTerminal });
    }
  }

  private applyPendingWorldsOverview(): void {
    if (!this.pendingWorldsOverview) return;
    const p = this.pendingWorldsOverview;
    this.pendingWorldsOverview = null;
    this.setWorldsOverviewEnabled(p.enabled, p.options);
  }

  private setWorldsOverviewEnabled(enabled: boolean, options?: WorldsOverviewOptions): void {
    // Host-only: never allow audience/client windows to enter overview.
    if (this.hostAudienceView) return;

    // Defer until we have layouts + camera.
    if (!this.section3DLayouts || this.section3DLayouts.length === 0 || !this.camera3D) {
      this.pendingWorldsOverview = { enabled: !!enabled, options };
      return;
    }

    const nextEnabled = !!enabled;

    if (nextEnabled && !this.worldsOverviewEnabled) {
      // Save current transforms so we can restore exactly.
      this.worldsOverviewSavedTransforms = this.section3DLayouts.map(l => ({
        position: { ...l.transform.position },
        rotation: { ...l.transform.rotation },
        scale: { ...l.transform.scale }
      }));
    }

    if (!nextEnabled && this.worldsOverviewEnabled) {
      // Restore transforms.
      if (this.worldsOverviewSavedTransforms) {
        for (let i = 0; i < Math.min(this.worldsOverviewSavedTransforms.length, this.section3DLayouts.length); i++) {
          const saved = this.worldsOverviewSavedTransforms[i];
          const layout = this.section3DLayouts[i];
          if (!layout) continue;
          layout.transform.position = { ...saved.position };
          layout.transform.rotation = { ...saved.rotation };
          layout.transform.scale = { ...saved.scale };
        }
      }
      this.worldsOverviewSavedTransforms = null;
      this.worldsOverviewEnabled = false;

      // Return to the last slide framing (if any).
      this.refocus3DForCurrentViewport();
      return;
    }

    if (!nextEnabled) return;

    // (Re)apply overview grid layout and fit camera.
    this.worldsOverviewEnabled = true;

    const includeHidden = !!options?.includeHidden;
    const includeNonNavigable = !!options?.includeNonNavigable;
    const padding = Number.isFinite(options?.padding ?? NaN) ? (options!.padding as number) : 20;
    const depth = Number.isFinite(options?.depth ?? NaN) ? (options!.depth as number) : this.worldsConfig.defaultDepth;
    const fill = Number.isFinite(options?.fill ?? NaN) ? (options!.fill as number) : 0.9;
    const levels: OutlineLevels = options?.levels ?? 'any';

    const nodes = this.getOutlineNodes();
    if (nodes.length === 0) return;

    const levelsPred = (() => {
      if (levels === 'any') return (_n: OutlineNode) => true;
      if (typeof levels === 'number' && Number.isFinite(levels)) return (n: OutlineNode) => n.level === levels;
      if (levels && typeof levels === 'object') {
        const min = typeof (levels as any).min === 'number' ? (levels as any).min : 1;
        const max = typeof (levels as any).max === 'number' ? (levels as any).max : 6;
        return (n: OutlineNode) => n.level >= min && n.level <= max;
      }
      return (_n: OutlineNode) => true;
    })();

    // Selection: by default, treat *all headings* as candidates, but respect hidden/navigable.
    const candidates = nodes
      .filter(n => levelsPred(n))
      .map(n => n.index)
      .filter(i => {
        const layout = this.section3DLayouts[i];
        if (!layout) return false;
        if (!includeHidden && layout.visible === false) return false;
        if (!includeNonNavigable && layout.navigable === false) return false;
        return true;
      });

    if (candidates.length === 0) return;

    // Choose columns automatically from viewport aspect / count if not provided.
    const aspect = this.canvas.width > 0 && this.canvas.height > 0 ? (this.canvas.width / this.canvas.height) : 1;
    const autoCols = Math.max(1, Math.ceil(Math.sqrt(candidates.length * Math.max(0.5, Math.min(3, aspect)))));
    const cols = Number.isFinite(options?.columns ?? NaN)
      ? Math.max(1, Math.floor(options!.columns as number))
      : autoCols;
    const rows = Math.max(1, Math.ceil(candidates.length / cols));

    // Cell size from max card dims so the grid feels consistent.
    let maxWorldW = 1;
    let maxWorldH = 1;
    for (const idx of candidates) {
      const l = this.section3DLayouts[idx];
      if (!l) continue;
      const s = this.get3DCardWorldSize(l);
      maxWorldW = Math.max(maxWorldW, s.width);
      maxWorldH = Math.max(maxWorldH, s.height);
    }
    const stepX = maxWorldW + padding;
    const stepY = maxWorldH + padding;

    const xCenter = (cols - 1) / 2;
    const yCenter = (rows - 1) / 2;

    for (let i = 0; i < candidates.length; i++) {
      const idx = candidates[i];
      const layout = this.section3DLayouts[idx];
      if (!layout) continue;

      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - xCenter) * stepX;
      const y = -(row - yCenter) * stepY;

      layout.transform.position = { x, y, z: depth };
      layout.transform.rotation = { x: 0, y: 0, z: 0 };
    }

    // Fit camera to the whole grid bounds.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const idx of candidates) {
      const l = this.section3DLayouts[idx];
      if (!l) continue;
      const s = this.get3DCardWorldSize(l);
      const w = s.width;
      const h = s.height;
      minX = Math.min(minX, l.transform.position.x - w / 2);
      maxX = Math.max(maxX, l.transform.position.x + w / 2);
      minY = Math.min(minY, l.transform.position.y - h / 2);
      maxY = Math.max(maxY, l.transform.position.y + h / 2);
    }

    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) return;

    const worldWidth = Math.max(1e-6, maxX - minX);
    const worldHeight = Math.max(1e-6, maxY - minY);
    const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
    const safeFill = Math.max(0.05, Math.min(0.99, fill));

    const vFov = this.camera3D.fov;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
    const distForHeight = (worldHeight / 2) / (Math.tan(vFov / 2) * safeFill);
    const distForWidth = (worldWidth / 2) / (Math.tan(hFov / 2) * safeFill);
    const distance = Math.max(distForHeight, distForWidth);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setCameraTarget(
      this.camera3D,
      { x: centerX, y: centerY, z: depth + distance },
      { x: 0, y: 0, z: 0 }
    );
  }

  constructor(canvas: HTMLCanvasElement, config: EngineConfig = {}) {
    this.canvas = canvas;
    this.width = config.width || 80;
    this.height = config.height || 24;

    this.fontFamily = config.fontFamily || DEFAULT_FONT_FALLBACK_STACK;
    this.fontSize = config.fontSize || 16;

    const configuredMaxDropBytes = typeof config.maxDropBytes === 'number' ? config.maxDropBytes : 50 * 1024 * 1024;
    this.maxDropBytes = configuredMaxDropBytes > 0 ? configuredMaxDropBytes : Infinity;

    // Camera state should exist even before WebGPU initializes so user code can
    // configure it during on:init without worrying about timing.
    this.camera3D = createCamera3D();
    
    // Initialize theme system (default + optional URL override)
    this.themeOverrideFromUrl = this.readThemeOverrideFromUrl();
    this.currentTheme = this.themeOverrideFromUrl?.theme ?? getTheme('neotopia');
    this.styleSheet = applyTheme(this.currentTheme);
    
    // Initialize native browser APIs (shared instances)
    const AudioContextCtor = (globalThis.AudioContext || (globalThis as any).webkitAudioContext) as
      | (new () => AudioContext)
      | undefined;
    if (!AudioContextCtor) {
      throw new Error('Web Audio API is not supported in this environment');
    }
    this.audioContext = new AudioContextCtor();
    // Canvas2D is created lazily on first use (see ensureCanvas2D())
    
    // Initialize systems
    this.layers = new LayerStack(this.width, this.height);
    // Ensure the default terminal buffers start with the theme background (not hard-coded black).
    this.layers.clearAll(this.currentTheme.bg);
    this.input = new InputManager(canvas);
    
    // Try WebGPU first (unless explicitly disabled), fallback to Canvas2D
    const preferWebGPU = config.preferWebGPU !== false;
    if (preferWebGPU && navigator.gpu) {
      console.log('✓ WebGPU available, will attempt initialization');
      this.renderer = new WebGPURenderer(canvas, {
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        // When WebGPU is available we initialize the compositor, which expects
        // the terminal renderer to render into an offscreen texture.
        renderToTexture: true
      });
    } else {
      console.log('✓ Using Canvas2D renderer');
      this.renderer = new Canvas2DRenderer(canvas, {
        fontFamily: this.fontFamily,
        fontSize: this.fontSize
      });
    }
    
    // Resize renderer to match configured dimensions
    this.renderer.resize(this.width, this.height);

    // Keep the canvas element's CSS size in sync with its backing buffer.
    // This prevents visual stretching when external code sets canvas.style
    // based on stale font metrics or when cached fonts change measurement timing.
    this.syncCanvasElementSizeToBuffer();
    
    // Initialize module loader
    this.moduleLoader = new ModuleLoader(this, config.modules);

    // Security policy (defaults)
    this.untrustedContent = !!config.security?.untrusted;
    this.allowCrossOriginDynamicImport = !!config.security?.allowCrossOriginDynamicImport;
    this.allowModuleResolverFromSandbox = !!config.security?.allowModuleResolverFromSandbox;
    
    // Create sandbox with API
    const api = this.createUserAPI();
    this.api = api;  // Store api for later use

    this.sandbox = new ScriptSandbox(api);

    // Host sync can be enabled via URL params (default) or config.
    this.initHostSync(config.host ?? config.presentation);
    
    // Set up input event listeners
    this.setupEventListeners();
    
    console.log('✓ S|torie engine initialized');
    console.log(`  Grid: ${this.width}x${this.height}`);
    console.log(`  Renderer: ${this.renderer.constructor.name}`);
    console.log(
      `  Theme: ${this.themeOverrideFromUrl ? `${this.themeOverrideFromUrl.label} (url override)` : 'neotopia (default)'}`
    );
    console.log(`  Modules: ready for dynamic loading`);    console.log('  Audio: Web Audio API ready');
    console.log('  Canvas2D: lazy (created on first use)');
  }

  /**
   * Ensure the canvas element's CSS pixel size matches the backing buffer size.
   * When these disagree, the browser scales the canvas, causing stretched output.
   */
  private syncCanvasElementSizeToBuffer(): void {
    // Set the CSS display size to logical (device-independent) pixels so the
    // browser shows the canvas at its natural viewport size without any
    // implicit DPR upscaling. The backing buffer is already at physical
    // resolution (set by the entry-point before the engine is constructed).
    if (typeof window === 'undefined') return;
    const dpr = window.devicePixelRatio || 1;
    const logicalW = this.canvas.width / dpr;
    const logicalH = this.canvas.height / dpr;
    if (logicalW > 0) this.canvas.style.width = `${logicalW}px`;
    if (logicalH > 0) this.canvas.style.height = `${logicalH}px`;
  }

  private ensureSafeAreaProbe(): HTMLDivElement | null {
    if (typeof document === 'undefined' || !document.body) return null;
    if (this.safeAreaProbeElement && this.safeAreaProbeElement.isConnected) {
      return this.safeAreaProbeElement;
    }

    const probe = document.createElement('div');
    probe.setAttribute('data-storie-safe-area-probe', 'true');
    probe.style.position = 'fixed';
    probe.style.left = '0';
    probe.style.top = '0';
    probe.style.width = '0';
    probe.style.height = '0';
    probe.style.visibility = 'hidden';
    probe.style.pointerEvents = 'none';
    probe.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    probe.style.paddingRight = 'env(safe-area-inset-right, 0px)';
    probe.style.paddingBottom = 'env(safe-area-inset-bottom, 0px)';
    probe.style.paddingLeft = 'env(safe-area-inset-left, 0px)';
    document.body.appendChild(probe);
    this.safeAreaProbeElement = probe;
    return probe;
  }

  private getSafeAreaInsetsCss(): SafeAreaInsets {
    const zero: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
    if (typeof window === 'undefined' || typeof document === 'undefined') return zero;

    const probe = this.ensureSafeAreaProbe();
    if (!probe) return zero;

    const style = window.getComputedStyle(probe);
    return {
      top: Number.parseFloat(style.paddingTop || '0') || 0,
      right: Number.parseFloat(style.paddingRight || '0') || 0,
      bottom: Number.parseFloat(style.paddingBottom || '0') || 0,
      left: Number.parseFloat(style.paddingLeft || '0') || 0
    };
  }

  private getCanvasViewportRectCss(): { x: number; y: number; width: number; height: number } {
    // Prefer the host-controlled CSS pixel size if explicitly set.
    // In some hosted preview environments, `getBoundingClientRect()` can lag
    // behind style updates even though the engine is being resized.
    try {
      const w = this.canvas?.style?.width;
      const h = this.canvas?.style?.height;
      if (typeof w === 'string' && typeof h === 'string' && w.endsWith('px') && h.endsWith('px')) {
        const width = Number.parseFloat(w);
        const height = Number.parseFloat(h);
        if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
          return { x: 0, y: 0, width, height };
        }
      }
    } catch {
      // ignore
    }

    try {
      const rect = this.canvas.getBoundingClientRect();
      if (Number.isFinite(rect.width) && rect.width > 0 && Number.isFinite(rect.height) && rect.height > 0) {
        return { x: 0, y: 0, width: rect.width, height: rect.height };
      }
    } catch {
      // ignore
    }

    try {
      // Fallback: infer CSS size from the backing store size and DPR.
      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
      const v = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
      return {
        x: 0,
        y: 0,
        width: this.canvas.width / v,
        height: this.canvas.height / v
      };
    } catch {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
  }

  private initHostSync(cfg?: EngineConfig['host']): void {
    // Only meaningful in a browser environment.
    if (typeof window === 'undefined' || typeof URL === 'undefined') return;

    const url = new URL(window.location.href);
    const parsed = parseHostParams(url.search);

    const enabled = cfg?.enabled ?? parsed.enabled;
    if (!enabled) return;

    const role = (cfg?.role ?? parsed.role) || 'client';
    const transport = (cfg?.transport ?? parsed.transport) || 'broadcast';

    let channelId = cfg?.channelId ?? parsed.channelId;
    let token = cfg?.token ?? parsed.token;

    // Host can create a new session if not specified.
    if (role === 'host' && (!channelId || !token)) {
      const ids = createHostSessionIds();
      channelId = ids.channelId;
      token = ids.token;

      try {
        const joinUrl = makeClientJoinUrl({
          url,
          role: 'client',
          transport,
          channelId,
          token
        });
        console.log('[host] Host session created');
        console.log('[host] Client join URL (role/channel/token):', joinUrl);
      } catch {
        // ignore
      }
    }

    // Client must be given a channel+token.
    if (!channelId || !token) {
      console.warn('[host] Missing channel/token (client cannot connect)');
      return;
    }

    try {
      const sync = new HostSync({
        enabled: true,
        role,
        transport,
        channelId,
        token
      });
      this.hostSync = sync;

      // Client windows behave like a clean audience/presentation view by default.
      this.hostAudienceView = role === 'client';
      if (this.hostAudienceView) {
        this.input.setEnabled(false);
        this.worldsControlsEnabled = false;
        this.worldsLinkKeyHandlingEnabled = false;
        this.mouseLookActive = false;
      } else {
        this.input.setEnabled(true);
      }

      // Apply remote navigation.
      sync.onGotoSection((args) => {
        // Treat remote messages as untrusted; only allow safe navigation.
        this.worldsEnabled = true;
        if (this.compositor?.layers.get('3d')) {
          this.compositor.updateLayer('3d', { enabled: true });
        }

        this.updateAudienceViewLayers();

        // Queue focus if layouts aren’t ready.
        if (args.mode === 'focus') {
          this.request3DCameraFocus({
            kind: 'focus',
            sectionIndex: args.sectionIndex,
            distance: typeof args.distance === 'number' ? args.distance : 50
          });
        } else {
          this.request3DCameraFocus({
            kind: 'fit',
            sectionIndex: args.sectionIndex,
            fill: typeof args.fill === 'number' ? args.fill : 0.9
          });
        }
      });

      // Apply shared scene state (preferred over raw goto).
      sync.onSceneState((args) => {
        // Treat remote messages as untrusted; only allow safe navigation.
        this.worldsEnabled = true;
        if (this.compositor?.layers.get('3d')) {
          this.compositor.updateLayer('3d', { enabled: true });
        }

        this.sceneState.sectionIndex = args.sectionIndex;
        this.sceneState.revealStep = Math.max(0, Math.floor(args.revealStep));

        this.updateAudienceViewLayers();

        if (args.mode === 'focus') {
          this.request3DCameraFocus({
            kind: 'focus',
            sectionIndex: args.sectionIndex,
            distance: typeof args.distance === 'number' ? args.distance : 50
          });
        } else {
          this.request3DCameraFocus({
            kind: 'fit',
            sectionIndex: args.sectionIndex,
            fill: typeof args.fill === 'number' ? args.fill : 0.9
          });
        }
      });

      sync.start();
      const info = sync.getSessionInfo();
      console.log(`[host] Connected: ${info.transport}/${info.role} channel=${info.channelId}`);
    } catch (error) {
      console.warn('[host] Failed to start host sync:', error);
      this.hostSync = null;
    }
  }
  
  /**
   * Initialize Canvas 2D API with offscreen canvas for user drawing
   */
  private ensureCanvas2D(): OffscreenCanvasRenderingContext2D | null {
    if (this.canvas2DContext && this.offscreenCanvas2D) {
      return this.canvas2DContext as OffscreenCanvasRenderingContext2D;
    }

    const offscreen = new OffscreenCanvas(800, 600);
    const ctx = offscreen.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
    if (!ctx) {
      console.warn('Failed to create Canvas 2D offscreen context');
      return null;
    }

    this.canvas2DContext = ctx;
    // Store as HTMLCanvasElement for API compatibility (handled as OffscreenCanvas in compositor)
    this.offscreenCanvas2D = offscreen as unknown as HTMLCanvasElement;

    // If compositor already exists, register the Canvas2D layer now.
    // This avoids any per-frame upload cost unless Canvas2D is actually used.
    if (this.compositor) {
      this.compositor.registerLayer('canvas2d', {
        canvas: this.offscreenCanvas2D as unknown as OffscreenCanvas,
        width: offscreen.width,
        height: offscreen.height,
        zIndex: 10
      });
    }

    console.log('✓ Canvas 2D offscreen canvas created (800x600)');
    return ctx;
  }

  private getDocumentBlobStore(documentId?: string): Map<string, BlobStoreEntry> | null {
    const docId = documentId ?? this.activeDocumentId;
    if (!docId) return null;
    const doc = this.documents.get(docId) as any;
    return (doc && doc._blobStore) ? (doc._blobStore as Map<string, BlobStoreEntry>) : null;
  }

  private getDocumentMarkdownImageCache(documentId?: string): Map<string, MarkdownImageCacheEntry> | null {
    const docId = documentId ?? this.activeDocumentId;
    if (!docId) return null;
    const doc = this.documents.get(docId) as any;
    if (!doc) return null;
    if (!doc._markdownImageCache) {
      doc._markdownImageCache = new Map<string, MarkdownImageCacheEntry>();
    }
    return doc._markdownImageCache as Map<string, MarkdownImageCacheEntry>;
  }

  private decodeMarkdownBase64ToBytes(b64: string): Uint8Array | null {
    const clean = String(b64 ?? '').replace(/\s+/g, '');
    const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
    const estimatedBytes = Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
    if (estimatedBytes > 8 * 1024 * 1024) return null;
    try {
      const bin = atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xFF;
      return out;
    } catch {
      return null;
    }
  }

  private decodeMarkdownHexToBytes(hex: string): Uint8Array | null {
    const clean = String(hex ?? '')
      .replace(/0x/gi, '')
      .replace(/[^0-9a-f]/gi, '')
      .trim();
    if (clean.length === 0) return new Uint8Array(0);
    if (clean.length % 2 !== 0) return null;
    const estimatedBytes = Math.floor(clean.length / 2);
    if (estimatedBytes > 8 * 1024 * 1024) return null;
    const out = new Uint8Array(estimatedBytes);
    for (let i = 0; i < estimatedBytes; i++) {
      const value = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
      if (!Number.isFinite(value) || Number.isNaN(value)) return null;
      out[i] = value & 0xFF;
    }
    return out;
  }

  private decodeMarkdownBlobEntryToBytes(entry: Pick<BlobStoreEntry, 'encoding' | 'data'>): Uint8Array | null {
    return entry.encoding === 'hex'
      ? this.decodeMarkdownHexToBytes(entry.data)
      : this.decodeMarkdownBase64ToBytes(entry.data);
  }

  private async decodeRenderableImageFromBytes(bytes: Uint8Array, mime: string): Promise<RenderableImageSource | null> {
    return await decodeRenderableImageFromBytes(bytes, mime);
  }

  private resolveSandboxAudioUrl(rawUrl: string): string {
    const trimmed = String(rawUrl ?? '').trim();
    if (!trimmed) {
      throw new Error('[audio.loadSound] Missing URL');
    }

    if (this.untrustedContent) {
      const allowedPrefix = /^(?:\.\/)?assets\/audio\//;
      if (!allowedPrefix.test(trimmed) || trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
        throw new Error('[audio.loadSound] Untrusted mode allows only relative URLs under "assets/audio/"');
      }
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
        throw new Error('[audio.loadSound] Untrusted mode blocks URL schemes');
      }
    }

    let resolved: URL;
    try {
      resolved = new URL(trimmed, globalThis.location?.href ?? 'http://localhost/');
    } catch (error: any) {
      throw new Error(`[audio.loadSound] Invalid URL: ${String(error?.message ?? error)}`);
    }

    const protocol = resolved.protocol.toLowerCase();
    if (protocol === 'data:' || protocol === 'blob:' || protocol === 'javascript:' || protocol === 'file:') {
      throw new Error(`[audio.loadSound] Unsupported URL scheme: ${protocol}`);
    }
    if (resolved.username || resolved.password) {
      throw new Error('[audio.loadSound] Credentials in URLs are not supported');
    }

    const origin = globalThis.location?.origin;
    if (origin && origin !== 'null' && resolved.origin !== origin) {
      throw new Error(`[audio.loadSound] Cross-origin audio blocked: ${resolved.origin}`);
    }

    return resolved.toString();
  }

  private resolveSandboxImageUrl(rawUrl: string): string {
    return resolveRenderableImageUrl(rawUrl, {
      errorPrefix: '[ui.loadImageFromURL]',
      untrustedContent: this.untrustedContent,
    });
  }

  private async loadUIImageFromUrl(rawUrl: string, alloc: () => string): Promise<string | null> {
    const MAX_IMAGE_URL_BYTES = 32 * 1024 * 1024;

    let resolvedUrl: string;
    try {
      resolvedUrl = this.resolveSandboxImageUrl(rawUrl);
    } catch (error) {
      console.warn(error);
      return null;
    }

    const cached = this.uiImageUrlCache.get(resolvedUrl);
    if (cached) return cached;

    const inFlight = this.uiImageUrlInFlight.get(resolvedUrl);
    if (inFlight) return await inFlight;

    const promise = (async () => {
      try {
        const image = await loadRenderableImageFromResolvedUrl(resolvedUrl, {
          errorPrefix: '[ui.loadImageFromURL]',
          maxBytes: MAX_IMAGE_URL_BYTES,
        });
        if (!image) return null;

        const id = alloc();
        const ui = this.ensureWebGPUUI();
        if (ui) {
          ui.registerImage(id, image);
        } else {
          // WebGPU UI isn't ready yet (on:init fires before the GPU device is online).
          // Park the decoded image; ui.image() will register it lazily on first draw.
          this.uiImagePending.set(id, image);
          console.log(`[ui.loadImageFromURL] WebGPU UI not ready; deferring registration for "${id}"`);
        }
        this.uiImageUrlCache.set(resolvedUrl, id);
        return id;
      } catch (error) {
        console.warn(`[ui.loadImageFromURL] Failed to load image from "${resolvedUrl}":`, error);
        return null;
      } finally {
        this.uiImageUrlInFlight.delete(resolvedUrl);
      }
    })();

    this.uiImageUrlInFlight.set(resolvedUrl, promise);
    return await promise;
  }

  private async loadSoundFromUrl(rawUrl: string): Promise<AudioBuffer | null> {
    const MAX_AUDIO_URL_BYTES = 128 * 1024 * 1024;

    let resolvedUrl: string;
    try {
      resolvedUrl = this.resolveSandboxAudioUrl(rawUrl);
    } catch (error) {
      console.warn(error);
      return null;
    }

    const cached = this.audioUrlBufferCache.get(resolvedUrl);
    if (cached) return cached;

    const inFlight = this.audioUrlInFlightCache.get(resolvedUrl);
    if (inFlight) return await inFlight;

    const promise = (async () => {
      try {
        const response = await fetch(resolvedUrl, {
          mode: 'same-origin',
          credentials: 'same-origin',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} ${response.statusText}`);
        }

        const contentLength = Number(response.headers.get('content-length'));
        if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_URL_BYTES) {
          throw new Error(`Refusing audio larger than ${MAX_AUDIO_URL_BYTES} bytes (server reported ${contentLength})`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_AUDIO_URL_BYTES) {
          throw new Error(`Refusing audio larger than ${MAX_AUDIO_URL_BYTES} bytes (downloaded ${arrayBuffer.byteLength})`);
        }

        const buffer = await this.audioContext.decodeAudioData(arrayBuffer);
        this.audioUrlBufferCache.set(resolvedUrl, buffer);
        return buffer;
      } catch (error) {
        console.warn(`[audio.loadSound] Failed to load audio from "${resolvedUrl}":`, error);
        return null;
      } finally {
        this.audioUrlInFlightCache.delete(resolvedUrl);
      }
    })();

    this.audioUrlInFlightCache.set(resolvedUrl, promise);
    return await promise;
  }

  private resolveWorldsImageUrl(rawUrl: string): string {
    return resolveRenderableImageUrl(rawUrl, {
      errorPrefix: '[worlds.background]',
      untrustedContent: this.untrustedContent,
    });
  }

  private async loadWorldsImageFromResolvedUrl(resolvedUrl: string): Promise<RenderableImageSource | null> {
    return await loadRenderableImageFromResolvedUrl(resolvedUrl, {
      errorPrefix: '[worlds.background]',
      maxBytes: 128 * 1024 * 1024,
    });
  }

  private getWorldsSectionBorderSpec(value: unknown = (this.worldsConfig as any).sectionBorder): DecorativeBorderSpec | null {
    return normalizeDecorativeBorderSpec(value);
  }

  private drawWorldsCardBorder(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    borderColor: Color,
    sectionBorder?: DecorativeBorderSpec | null,
  ): void {
    const borderEnabled = this.worldsConfig.sectionBorderEnabled !== false;
    const borderWidth = Math.max(0, Math.round(this.worldsConfig.sectionBorderWidth ?? 2));
    if (!borderEnabled || borderWidth <= 0) return;

    const decorativeBorder = this.getWorldsSectionBorderSpec(sectionBorder) ?? this.getWorldsSectionBorderSpec();
    if (decorativeBorder) {
      const image = this.ensureRenderableImageLoaded(decorativeBorder.source);
      if (image && drawDecorativeBorder(ctx, image, decorativeBorder, widthPx, heightPx)) {
        return;
      }
    }

    ctx.strokeStyle = ColorUtils.toCss(borderColor);
    ctx.lineWidth = borderWidth;
    const inset = borderWidth / 2;
    ctx.strokeRect(inset, inset, widthPx - borderWidth, heightPx - borderWidth);
  }

  private ensureRenderableImageLoaded(rawUrl: string): RenderableImageSource | null {
    const rawKey = String(rawUrl ?? '').trim();
    if (!rawKey || this.backgroundImageUrlFailures.has(rawKey)) return null;

    let resolvedUrl: string;
    try {
      resolvedUrl = this.resolveWorldsImageUrl(rawUrl);
    } catch (error) {
      console.warn(error);
      this.backgroundImageUrlFailures.add(rawKey);
      return null;
    }

    if (this.backgroundImageUrlFailures.has(resolvedUrl)) return null;

    const cached = this.backgroundImageUrlCache.get(resolvedUrl);
    if (cached) return cached;

    if (!this.backgroundImageUrlInFlightCache.has(resolvedUrl)) {
      const promise = this.loadWorldsImageFromResolvedUrl(resolvedUrl)
        .then(image => {
          if (!image) {
            this.backgroundImageUrlFailures.add(resolvedUrl);
            return null;
          }
          this.backgroundImageUrlCache.set(resolvedUrl, image);
          if (this.worldsEnabled && this.section3DLayouts.length > 0) {
            this.clear3DSectionTextures();
          }
          return image;
        })
        .finally(() => {
          this.backgroundImageUrlInFlightCache.delete(resolvedUrl);
        });
      this.backgroundImageUrlInFlightCache.set(resolvedUrl, promise);
    }

    return null;
  }

  private ensureWorldsImageLoaded(rawUrl: string): RenderableImageSource | null {
    return this.ensureRenderableImageLoaded(rawUrl);
  }

  private ensureWorldsBackgroundImageLoaded(rawUrl: string): RenderableImageSource | null {
    return this.ensureRenderableImageLoaded(rawUrl);
  }

  private composeWorldsBackgroundOverlay(
    cacheKey: string,
    baseImage: RenderableImageSource,
    overlayImage: RenderableImageSource,
    options: {
      blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge';
      opacity: number;
      fit?: 'cover' | 'contain' | 'stretch';
    }
  ): RenderableImageSource | null {
    const cached = this.worldsBackgroundCompositeCache.get(cacheKey);
    if (cached) return cached;

    const width = Math.max(1, Math.round((baseImage as any).width ?? (baseImage as any).naturalWidth ?? 0));
    const height = Math.max(1, Math.round((baseImage as any).height ?? (baseImage as any).naturalHeight ?? 0));
    const overlayWidth = Math.max(1, Math.round((overlayImage as any).width ?? (overlayImage as any).naturalWidth ?? 0));
    const overlayHeight = Math.max(1, Math.round((overlayImage as any).height ?? (overlayImage as any).naturalHeight ?? 0));
    if (!(width > 0 && height > 0 && overlayWidth > 0 && overlayHeight > 0)) return null;

    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(width, height)
      : (() => {
          if (typeof document === 'undefined') return null;
          const element = document.createElement('canvas');
          element.width = width;
          element.height = height;
          return element;
        })();
    if (!canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(baseImage, 0, 0, width, height);

    const fit = options.fit ?? 'cover';
    let drawW = width;
    let drawH = height;
    let drawX = 0;
    let drawY = 0;
    if (fit !== 'stretch') {
      const scale = fit === 'contain'
        ? Math.min(width / overlayWidth, height / overlayHeight)
        : Math.max(width / overlayWidth, height / overlayHeight);
      drawW = Math.max(1, Math.round(overlayWidth * scale));
      drawH = Math.max(1, Math.round(overlayHeight * scale));
      drawX = Math.round((width - drawW) * 0.5);
      drawY = Math.round((height - drawH) * 0.5);
    }

    const blendModeMap: Record<string, GlobalCompositeOperation> = {
      normal: 'source-over',
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      softlight: 'soft-light',
      hardlight: 'hard-light',
      darken: 'darken',
      lighten: 'lighten',
      difference: 'difference',
      exclusion: 'exclusion',
      colorburn: 'color-burn',
      colordodge: 'color-dodge',
    };
    const compositeMode = blendModeMap[options.blendMode] ?? 'source-over';
    ctx.globalCompositeOperation = compositeMode;
    ctx.globalAlpha = Math.max(0, Math.min(1, options.opacity));
    ctx.drawImage(overlayImage, drawX, drawY, drawW, drawH);

    const result = typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas && typeof canvas.transferToImageBitmap === 'function'
      ? canvas.transferToImageBitmap()
      : canvas as unknown as RenderableImageSource;
    this.worldsBackgroundCompositeCache.set(cacheKey, result);
    return result;
  }

  private ensureMarkdownBlobImageLoaded(source: string, documentId?: string): MarkdownImageCacheEntry | null {
    const docId = documentId ?? this.activeDocumentId;
    const key = String(source ?? '').trim();
    if (!docId || !key) return null;

    const cache = this.getDocumentMarkdownImageCache(docId);
    if (!cache) return null;

    let cached = cache.get(key) ?? null;
    if (!cached) {
      cached = {
        image: null,
        width: 0,
        height: 0,
        failed: false,
        inFlight: null,
        rendererImageId: null,
      };
      cache.set(key, cached);
    }

    if (cached.image) return cached;
    if (cached.failed) return null;

    if (!cached.inFlight) {
      const store = this.getDocumentBlobStore(docId);
      const blobEntry = store?.get(key) ?? null;
      const mime = String(blobEntry?.mime ?? '');
      if (!blobEntry || !mime.startsWith('image/')) {
        cached.failed = true;
        return null;
      }

      cached.inFlight = (async () => {
        if (!blobEntry.bytes) {
          const decoded = this.decodeMarkdownBlobEntryToBytes(blobEntry);
          if (!decoded) {
            cached!.failed = true;
            cached!.inFlight = null;
            return;
          }
          blobEntry.bytes = decoded;
        }

        const bytes = new Uint8Array(blobEntry.bytes);
        try {
          const image = await this.decodeRenderableImageFromBytes(bytes, mime);
          if (!image) {
            cached!.failed = true;
            return;
          }
          cached!.image = image;
          cached!.width = image.width;
          cached!.height = image.height;
          cached!.failed = false;
          if (this.worldsEnabled && this.section3DLayouts.length > 0) {
            this.clear3DSectionTextures();
          }
        } catch (error) {
          cached!.failed = true;
          console.warn(`[markdown-image] Failed to decode image "${key}":`, error);
        } finally {
          cached!.inFlight = null;
        }
      })();
    }

    return cached.image ? cached : null;
  }

  private getMarkdownImageSize(source: string, documentId?: string): { width: number; height: number } | null {
    const cached = this.ensureMarkdownBlobImageLoaded(source, documentId);
    if (!cached || !cached.image || cached.width <= 0 || cached.height <= 0) return null;
    return { width: cached.width, height: cached.height };
  }

  private getMarkdownImageSource(source: string, documentId?: string): RenderableImageSource | null {
    return this.ensureMarkdownBlobImageLoaded(source, documentId)?.image ?? null;
  }

  private ensureMarkdownImageRegisteredWithRenderer(
    source: string,
    renderer: WebGPUUIRenderer,
    documentId?: string
  ): { imageId: string; width: number; height: number } | null {
    const cached = this.ensureMarkdownBlobImageLoaded(source, documentId);
    if (!cached || !cached.image) return null;

    const imageId = cached.rendererImageId ?? `mdimg_${this.nextMarkdownImageId++}`;
    cached.rendererImageId = imageId;

    if (!renderer.getImageSize(imageId)) {
      renderer.registerImage(imageId, cached.image);
    }

    return { imageId, width: cached.width, height: cached.height };
  }

  private createMarkdownAwareDraw2D(renderer: WebGPUUIRenderer, documentId?: string): Draw2D {
    return {
      rect: renderer.rect.bind(renderer),
      text: renderer.text.bind(renderer),
      image: (imageId, x, y, w, h, options) => {
        const registered = this.ensureMarkdownImageRegisteredWithRenderer(imageId, renderer, documentId);
        if (registered) {
          renderer.image(registered.imageId, x, y, w, h, options);
          return;
        }
        renderer.image(imageId, x, y, w, h, options);
      },
      getImageSize: (imageId) => {
        const registered = this.ensureMarkdownImageRegisteredWithRenderer(imageId, renderer, documentId);
        if (registered) {
          return { width: registered.width, height: registered.height };
        }
        return renderer.getImageSize(imageId);
      },
      pushClipRect: renderer.pushClipRect ? renderer.pushClipRect.bind(renderer) : undefined,
      popClipRect: renderer.popClipRect ? renderer.popClipRect.bind(renderer) : undefined,
      pushMaskRect: renderer.pushMaskRect ? renderer.pushMaskRect.bind(renderer) : undefined,
      pushMaskRoundedRect: renderer.pushMaskRoundedRect ? renderer.pushMaskRoundedRect.bind(renderer) : undefined,
      pushMaskPolygon: renderer.pushMaskPolygon ? renderer.pushMaskPolygon.bind(renderer) : undefined,
      popMask: renderer.popMask ? renderer.popMask.bind(renderer) : undefined,
    };
  }
  
  /**
   * Initialize Compositor (WebGPU only)
   */
  private async initCompositor(): Promise<void> {
    if (!(this.renderer instanceof WebGPURenderer)) return;
    
    // Get WebGPU device from renderer context
    const device = this.renderer.getContext().getDevice();
    if (!device) {
      console.warn('Failed to get WebGPU device for compositor');
      return;
    }
    
    // Create compositor
    this.compositor = new Compositor(device, this.canvas);
    await this.compositor.init();
    
    // Register terminal layer (from WebGPU renderer).
    // IMPORTANT: WebGPURenderer may create its render texture lazily (e.g. on first render()).
    // If we only register the layer when the texture exists, the compositor may end up with
    // *no* terminal layer and thus render a blank screen.
    const terminalTexture = this.renderer.getRenderTexture();
    this.compositor.registerLayer('terminal', {
      texture: terminalTexture ?? undefined,
      width: this.canvas.width,
      height: this.canvas.height,
      zIndex: 0  // Terminal at back
    });
    if (!terminalTexture) {
      console.warn('[Compositor] Terminal render texture not ready yet; will attach on first render/resize');
    }
    
    // Canvas2D layer is registered lazily on first use (see ensureCanvas2D()).
    this.updateAudienceViewLayers();
    console.log('✓ Compositor initialized (terminal layer)');
  }

  private ensureWebGPUUI(): WebGPUUIRenderer | null {
    // During live section baking, route all ui.* calls to the section renderer.
    if (this._liveUIOverride) return this._liveUIOverride;

    if (!(this.renderer instanceof WebGPURenderer)) return null;
    if (!this.compositor) return null;

    if (this.webgpuUIRenderer) return this.webgpuUIRenderer;

    const webgpuPack = this.getWebGPUFeaturePack();
    if (!webgpuPack) {
      this.requestWebGPUFeaturePack();
      return null;
    }

    const device = this.renderer.getContext().getDevice();
    if (!device) return null;

    const atlas = this.renderer.getAtlas();

    const ui = new webgpuPack.WebGPUUIRenderer(device, atlas, this.canvas.width, this.canvas.height);
    this.webgpuUIRenderer = ui;

    this.compositor.registerLayer('ui', {
      texture: ui.getTexture(),
      width: this.canvas.width,
      height: this.canvas.height,
      zIndex: 20
    });

    return ui;
  }

  private async loadWebGPUFeaturePack(): Promise<WebGPUFeaturePack> {
    if (this.webgpuFeaturePack) return this.webgpuFeaturePack;
    if (this.webgpuFeaturePackPromise) return this.webgpuFeaturePackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/webgpu-pack.js`;
    this.webgpuFeaturePackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.webgpuFeaturePack = pack;
        return pack;
      })
      .finally(() => {
        this.webgpuFeaturePackPromise = null;
      });

    return this.webgpuFeaturePackPromise;
  }

  private getWebGPUFeaturePack(): WebGPUFeaturePack | null {
    return this.webgpuFeaturePack;
  }

  private async loadUIDocumentPack(): Promise<UIDocumentPack> {
    if (this.uiDocumentPack) return this.uiDocumentPack;
    if (this.uiDocumentPackPromise) return this.uiDocumentPackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/ui-document-pack.js`;
    this.uiDocumentPackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.uiDocumentPack = pack;
        return pack;
      })
      .finally(() => {
        this.uiDocumentPackPromise = null;
      });

    return this.uiDocumentPackPromise;
  }

  private getUIDocumentPack(): UIDocumentPack | null {
    return this.uiDocumentPack;
  }

  private async loadGUIRuntimePack(): Promise<GUIRuntimePack> {
    if (this.guiRuntimePack) return this.guiRuntimePack;
    if (this.guiRuntimePackPromise) return this.guiRuntimePackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/gui-pack.js`;
    this.guiRuntimePackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.guiRuntimePack = pack;
        return pack;
      })
      .finally(() => {
        this.guiRuntimePackPromise = null;
      });

    return this.guiRuntimePackPromise;
  }

  private getGUIRuntimePack(): GUIRuntimePack | null {
    return this.guiRuntimePack;
  }

  private async loadAudioRuntimePack(): Promise<AudioRuntimePack> {
    if (this.audioRuntimePack) return this.audioRuntimePack;
    if (this.audioRuntimePackPromise) return this.audioRuntimePackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/audio-pack.js`;
    this.audioRuntimePackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.audioRuntimePack = pack;
        return pack;
      })
      .finally(() => {
        this.audioRuntimePackPromise = null;
      });

    return this.audioRuntimePackPromise;
  }

  private getAudioRuntimePack(): AudioRuntimePack | null {
    return this.audioRuntimePack;
  }

  private async loadTextRuntimePack(): Promise<TextRuntimePack> {
    if (this.textRuntimePack) return this.textRuntimePack;
    if (this.textRuntimePackPromise) return this.textRuntimePackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/text-pack.js`;
    this.textRuntimePackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.textRuntimePack = pack;
        return pack;
      })
      .finally(() => {
        this.textRuntimePackPromise = null;
      });

    return this.textRuntimePackPromise;
  }

  private getTextRuntimePack(): TextRuntimePack | null {
    return this.textRuntimePack;
  }

  private async loadAuthoredToolsRuntimePack(): Promise<AuthoredToolsRuntimePack> {
    if (this.authoredToolsRuntimePack) return this.authoredToolsRuntimePack;
    if (this.authoredToolsRuntimePackPromise) return this.authoredToolsRuntimePackPromise;

    const runtimeBaseUrl = import.meta.url.replace(/[^/]*$/, '');
    const runtimeUrl = `${runtimeBaseUrl}runtime/authored-tools-pack.js`;
    this.authoredToolsRuntimePackPromise = import(/* @vite-ignore */ runtimeUrl)
      .then((pack) => {
        this.authoredToolsRuntimePack = pack;
        return pack;
      })
      .finally(() => {
        this.authoredToolsRuntimePackPromise = null;
      });

    return this.authoredToolsRuntimePackPromise;
  }

  private getAuthoredToolsRuntimePack(): AuthoredToolsRuntimePack | null {
    return this.authoredToolsRuntimePack;
  }

  private requestTextRuntimePack(): void {
    if (this.textRuntimePack || this.textRuntimePackPromise) return;
    void this.loadTextRuntimePack().catch((error) => {
      console.warn('Failed to load text runtime pack:', error);
    });
  }

  private async ensureTextRuntimeInstalled(): Promise<void> {
    if (this.textRuntimeInstalled) return;
    if (this.textRuntimeInstallPromise) return await this.textRuntimeInstallPromise;

    this.textRuntimeInstallPromise = (async () => {
      await this.loadTextRuntimePack();
      this.textRuntimeInstalled = true;
    })().finally(() => {
      this.textRuntimeInstallPromise = null;
    });

    return await this.textRuntimeInstallPromise;
  }

  private requestAuthoredToolsRuntimePack(): void {
    if (this.authoredToolsRuntimePack || this.authoredToolsRuntimePackPromise) return;
    void this.loadAuthoredToolsRuntimePack().catch((error) => {
      console.warn('Failed to load authored tools runtime pack:', error);
    });
  }

  private async ensureAuthoredToolsRuntimeInstalled(): Promise<void> {
    if (this.authoredToolsRuntimeInstalled) return;
    if (this.authoredToolsRuntimeInstallPromise) return await this.authoredToolsRuntimeInstallPromise;

    this.authoredToolsRuntimeInstallPromise = (async () => {
      await this.loadAuthoredToolsRuntimePack();
      this.authoredToolsRuntimeInstalled = true;
    })().finally(() => {
      this.authoredToolsRuntimeInstallPromise = null;
    });

    return await this.authoredToolsRuntimeInstallPromise;
  }

  private requestAudioRuntimePack(): void {
    if (this.audioRuntimePack || this.audioRuntimePackPromise) return;
    void this.loadAudioRuntimePack().catch((error) => {
      console.warn('Failed to load audio runtime pack:', error);
    });
  }

  private async ensureAudioRuntimeInstalled(): Promise<void> {
    if (this.audioRuntimeInstalled) return;
    if (this.audioRuntimeInstallPromise) return await this.audioRuntimeInstallPromise;

    this.audioRuntimeInstallPromise = (async () => {
      await this.loadAudioRuntimePack();
      this.audioRuntimeInstalled = true;
    })().finally(() => {
      this.audioRuntimeInstallPromise = null;
    });

    return await this.audioRuntimeInstallPromise;
  }

  private requestGUIRuntimePack(): void {
    if (this.guiRuntimePack || this.guiRuntimePackPromise) return;
    void this.loadGUIRuntimePack().catch((error) => {
      console.warn('Failed to load GUI runtime pack:', error);
    });
  }

  private createDeferredGUIAPI(): any {
    const state: { impl: any | null } = { impl: null };
    return new Proxy(state as any, {
      get: (target, prop) => {
        if (prop === '__setImpl') {
          return (impl: any) => {
            target.impl = impl;
          };
        }

        const impl = target.impl;
        if (impl) {
          const value = impl[prop as keyof typeof impl];
          return typeof value === 'function' ? value.bind(impl) : value;
        }

        if (prop === '_sectionBindings') return [];
        if (prop === 'getSystem') return () => null;
        if (prop === 'isAutoInputEnabled' || prop === 'isAutoUpdateEnabled') return () => false;
        if (prop === 'render' || prop === 'update' || prop === 'syncBindings' || prop === 'syncSectionBindings') {
          return () => {};
        }

        return undefined;
      },
      set: (target, prop, value) => {
        if (target.impl) {
          target.impl[prop as keyof typeof target.impl] = value;
          return true;
        }
        target[prop as keyof typeof target] = value;
        return true;
      },
      has: (target, prop) => {
        if (target.impl) {
          return prop in target.impl;
        }
        return prop in target;
      }
    });
  }

  private buildGUIAPI(createGUIAPI: GUIRuntimePack['createGUIAPI']): any {
    return createGUIAPI(
      () => {
        const atlas = (this.renderer instanceof WebGPURenderer) ? this.renderer.getAtlas() : null;
        return {
          charWidth: atlas?.getCharWidth() ?? 10,
          charHeight: atlas?.getCharHeight() ?? 16
        };
      },
      (name: string) => this.getStyle(name),
      () => this.inputDispatchDepth > 0,
      () => {
        try {
          const sw = this.canvas?.style?.width;
          const sh = this.canvas?.style?.height;
          if (typeof sw === 'string' && typeof sh === 'string' && sw.endsWith('px') && sh.endsWith('px')) {
            const cssW = Number.parseFloat(sw);
            const cssH = Number.parseFloat(sh);
            if (Number.isFinite(cssW) && cssW > 0 && Number.isFinite(cssH) && cssH > 0) {
              const scaleX = this.canvas.width / cssW;
              const scaleY = this.canvas.height / cssH;
              if (Number.isFinite(scaleX) && scaleX > 0 && Number.isFinite(scaleY) && scaleY > 0) {
                return { scaleX, scaleY };
              }
            }
          }

          const rect = this.canvas.getBoundingClientRect();
          const scaleX = rect.width > 0 ? (this.canvas.width / rect.width) : 0;
          const scaleY = rect.height > 0 ? (this.canvas.height / rect.height) : 0;
          if (Number.isFinite(scaleX) && scaleX > 0 && Number.isFinite(scaleY) && scaleY > 0) {
            return { scaleX, scaleY };
          }
        } catch {
          // ignore
        }
        const dpr = (typeof window !== 'undefined' && (window as any).devicePixelRatio)
          ? Number((window as any).devicePixelRatio)
          : 1;
        const v = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
        return { scaleX: v, scaleY: v };
      },
      () => this.getCanvasViewportRectCss(),
      () => this.getSafeAreaInsetsCss(),
      () => this.getResolvedCurrent3DSectionIndex(),
      (selector: number | string) => this.resolve3DSectionIndex(selector)
    );
  }

  private async ensureGUIRuntimeInstalled(): Promise<void> {
    if (this.guiRuntimeInstalled) return;
    if (this.guiRuntimeInstallPromise) return await this.guiRuntimeInstallPromise;

    this.guiRuntimeInstallPromise = (async () => {
      const pack = await this.loadGUIRuntimePack();
      const guiAPI = this.buildGUIAPI(pack.createGUIAPI);
      this.installGUIAPIImpl?.(guiAPI);
      this.guiRuntimeInstalled = true;
    })().finally(() => {
      this.guiRuntimeInstallPromise = null;
    });

    return await this.guiRuntimeInstallPromise;
  }

  private requestUIDocumentPack(): void {
    if (this.uiDocumentPack || this.uiDocumentPackPromise) return;
    void this.loadUIDocumentPack().catch((error) => {
      console.warn('Failed to load UI document pack:', error);
    });
  }

  private documentNeedsTextRuntime(parsed: MarkdownDocument): boolean {
    return parsed.codeBlocks.some((block) => block.lang === 'ansi' || block.lang === 'figlet');
  }

  private createFallbackBeatClock(opts?: Partial<BeatClockOptions>): BeatClock {
    const bpm = Math.max(0.01, Number(opts?.bpm) || 120);
    const offsetMs = Number(opts?.offsetMs ?? 0) || 0;
    const beatsPerBar = Math.max(1, (opts?.beatsPerBar ?? 4) | 0);
    const msPerBeat = 60000 / bpm;

    return {
      get bpm() { return bpm; },
      get offsetMs() { return offsetMs; },
      get beatsPerBar() { return beatsPerBar; },
      beatToMs(beat: number): number {
        return offsetMs + beat * msPerBeat;
      },
      msToBeat(ms: number): number {
        return (ms - offsetMs) / msPerBeat;
      },
      beatAt(timeSec: number): number {
        const ms = timeSec * 1000;
        return Math.max(0, (ms - offsetMs) / msPerBeat);
      },
      barAt(timeSec: number): number {
        return Math.floor(Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat) / beatsPerBar);
      },
      beatPhase(timeSec: number): number {
        const beat = Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat);
        return beat - Math.floor(beat);
      },
      barPhase(timeSec: number): number {
        const beat = Math.max(0, (timeSec * 1000 - offsetMs) / msPerBeat);
        const beatInBar = beat % beatsPerBar;
        return beatInBar / beatsPerBar;
      },
    };
  }

  private requestWebGPUFeaturePack(): void {
    if (this.webgpuFeaturePack || this.webgpuFeaturePackPromise) return;
    void this.loadWebGPUFeaturePack().catch((error) => {
      console.warn('Failed to load WebGPU feature pack:', error);
    });
  }

  private hasPendingDocumentShaders(): boolean {
    for (const [, doc] of this.documents) {
      const parsed = (doc as any)?._parsedMarkdown;
      if (Array.isArray(parsed?.wgslShaders) && parsed.wgslShaders.length > 0) {
        return true;
      }
    }
    return false;
  }

  private async ensureShaderSupport(device: GPUDevice): Promise<boolean> {
    const webgpuPack = await this.loadWebGPUFeaturePack();

    let createdShaderManager = false;
    if (!this.shaderManager) {
      this.shaderManager = new webgpuPack.ShaderManager(device);
      createdShaderManager = true;
      console.log('✓ ShaderManager initialized (feature pack)');
    }

    if (!this.shaderChainManager && this.shaderManager) {
      this.shaderChainManager = new webgpuPack.ShaderChainManager(this.shaderManager, device);
      console.log('✓ ShaderChainManager initialized (feature pack)');
    }

    if (this.compositor) {
      this.compositor.setShaderManager(this.shaderManager);
      this.compositor.setShaderChainManager(this.shaderChainManager);
    }

    if (createdShaderManager) {
      await this.registerPendingShaders();
    }

    return true;
  }

  private async ensureWorldsRendererInitialized(device: GPUDevice): Promise<boolean> {
    if (this.worldsRenderer) return true;
    if (this.worldsInitializationPromise) return await this.worldsInitializationPromise;

    this.worldsInitializationPromise = (async () => {
      try {
        const webgpuPack = await this.loadWebGPUFeaturePack();
        await this.loadUIDocumentPack();
        await this.ensureShaderSupport(device);

        const renderer = new webgpuPack.WorldsRenderer(device, this.canvas.width, this.canvas.height, this.shaderManager ?? undefined);
        await renderer.init();
        this.worldsRenderer = renderer;

        if (!this.camera3D) {
          this.camera3D = createCamera3D();
        }

        const renderTexture = renderer.getRenderTexture();
        if (renderTexture && this.compositor) {
          this.compositor.registerLayer('3d', {
            texture: renderTexture,
            width: this.canvas.width,
            height: this.canvas.height,
            zIndex: 5,
            enabled: this.worldsEnabled,
            opacity: 1.0,
            blendMode: 'normal'
          });
          this.updateAudienceViewLayers();
        } else {
          console.warn('✗ Failed to register 3D layer');
        }

        for (const [docId, docData] of this.documents.entries()) {
          const anyDocData = docData as any;
          if (anyDocData._parsedMarkdown?.sections) {
            if (this.runtimeSectionStore.order.length === 0) {
              this.initializeRuntimeSectionStore(anyDocData._parsedMarkdown.sections);
            }
            this.compileWorldsLayoutsFromRuntimeSectionStore(`deferred init for document ${docId}`);
          }
        }

        return true;
      } catch (error) {
        console.warn('Failed to initialize WorldsRenderer:', error);
        return false;
      } finally {
        this.worldsInitializationPromise = null;
      }
    })();

    return await this.worldsInitializationPromise;
  }

  private requestWorldsRendererInitialization(): void {
    if (!this.worldsEnabled || this.worldsRenderer || this.worldsInitializationPromise) return;
    if (!(this.renderer instanceof WebGPURenderer)) return;

    const device = this.renderer.getContext().getDevice();
    if (!device) return;

    void this.ensureWorldsRendererInitialized(device);
  }
  
  /**
   * Get or initialize WebGL context (lazy initialization)
   */
  private getWebGLContext(): WebGLRenderingContext | null {
    if (!this.webglContext) {
      // Try to get WebGL context from a temporary canvas
      const tempCanvas = document.createElement('canvas');
      this.webglContext = tempCanvas.getContext('webgl') as WebGLRenderingContext | null;
      
      if (!this.webglContext) {
        console.warn('WebGL not available in this browser');
      }
    }
    return this.webglContext;
  }
  
  /**
   * Initialize WebGPU (lazy initialization, async)
   */
  private async initWebGPU(): Promise<boolean> {
    if (this.webgpuDevice) return true;
    
    if (!navigator.gpu) {
      console.warn('WebGPU not available in this browser');
      return false;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        console.warn('No WebGPU adapter available');
        return false;
      }
      
      this.webgpuDevice = await adapter.requestDevice();
      console.log('✓ WebGPU device created for user API');

      await this.ensureShaderSupport(this.webgpuDevice);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }  }

  /**
   * Create the API surface exposed to user code
   */
  private createUserAPI(): SandboxAPI {
    // Need to capture 'this' for proper binding
    const layers = this.layers;
    const engine = this; // Capture for use in getters
    let nextUIImageId = 1;
    const deferredGUIAPI = this.createDeferredGUIAPI();
    this.installGUIAPIImpl = (deferredGUIAPI as any).__setImpl;

    const MAX_BLOB_BYTES = 8 * 1024 * 1024;
    const getAuthoredToolsPack = (): AuthoredToolsRuntimePack | null => engine.getAuthoredToolsRuntimePack();

    const getBlobStore = (documentId?: string): Map<string, { name: string; mime: string; encoding: 'base64' | 'hex'; data: string; bytes?: Uint8Array }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._blobStore) ? (doc._blobStore as Map<string, any>) : null;
    };

    const getAsciiStore = (documentId?: string): Map<string, { name: string; text: string; lines?: string[] }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._asciiStore) ? (doc._asciiStore as Map<string, any>) : null;
    };

    const getFigletStore = (documentId?: string): Map<string, { name: string; text: string; font?: FigletFont }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._figletStore) ? (doc._figletStore as Map<string, any>) : null;
    };

    const getAnsiStore = (documentId?: string): Map<string, { name: string; text: string; tabSize: number; parsed?: AnsiParsed }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._ansiStore) ? (doc._ansiStore as Map<string, any>) : null;
    };

    const getStfxrStore = (documentId?: string): Map<string, { name: string; preset: SfxGraphPreset; defaultSeed?: number | string }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._stfxrStore) ? (doc._stfxrStore as Map<string, any>) : null;
    };

    const getTimedStore = (documentId?: string): Map<string, { name: string; entries: Array<{ ms: number; text: string }> }> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return (doc && doc._timedStore) ? (doc._timedStore as Map<string, any>) : null;
    };

    const getLogicStore = (documentId?: string): Array<any> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      return Array.isArray(doc?._logicStore) ? doc._logicStore : null;
    };

    const applyWorldsConfigDefaults = (config: Partial<WorldsConfig>) => {
      let requiresSectionLayoutRecompile = false;
      if (config.defaultDepth !== undefined) {
        engine.worldsConfig.defaultDepth = config.defaultDepth;
      }
      if (config.defaultSectionWidth !== undefined) {
        engine.worldsConfig.defaultSectionWidth = config.defaultSectionWidth;
      }
      if (config.defaultSectionHeight !== undefined) {
        engine.worldsConfig.defaultSectionHeight = config.defaultSectionHeight;
      }
      if (config.sectionRender !== undefined) {
        const prev = engine.worldsConfig.sectionRender;
        switch (config.sectionRender) {
          case 'heading':
          case 'content':
          case 'none':
          case 'all':
            engine.worldsConfig.sectionRender = config.sectionRender;
            break;
          default:
            break;
        }
        if (prev !== engine.worldsConfig.sectionRender) {
          requiresSectionLayoutRecompile = true;
        }
      }
      if ((config as any).sectionClickFocusEnabled !== undefined) {
        engine.worldsConfig.sectionClickFocusEnabled = !!(config as any).sectionClickFocusEnabled;
      }
      if ((config as any).sectionSizeUnits !== undefined) {
        const next = (config as any).sectionSizeUnits;
        if (next === 'text' || next === 'px') {
          const prev = (engine.worldsConfig as any).sectionSizeUnits;
          (engine.worldsConfig as any).sectionSizeUnits = next;
          if (prev !== next) {
            engine.clear3DSectionTextures();
          }
        }
      }

      if ((config as any).sectionOverflow !== undefined) {
        const next = (config as any).sectionOverflow;
        if (next === 'clip' || next === 'expand' || next === 'expand-y' || next === 'fit' || next === 'fit-y') {
          const prev = (engine.worldsConfig as any).sectionOverflow;
          (engine.worldsConfig as any).sectionOverflow = next;
          if (prev !== next) {
            engine.clear3DSectionTextures();
          }
        }
      }
      if ((config as any).sectionContentAlign !== undefined) {
        const next = (config as any).sectionContentAlign;
        if (next === 'start' || next === 'center') {
          const prev = (engine.worldsConfig as any).sectionContentAlign;
          (engine.worldsConfig as any).sectionContentAlign = next;
          if (prev !== next) {
            engine.clear3DSectionTextures();
          }
        }
      }
      if ((config as any).sectionTextAlign !== undefined) {
        const next = (config as any).sectionTextAlign;
        if (next === 'left' || next === 'center' || next === 'right') {
          const prev = (engine.worldsConfig as any).sectionTextAlign;
          (engine.worldsConfig as any).sectionTextAlign = next;
          if (prev !== next) {
            engine.clear3DSectionTextures();
          }
        }
      }

      if ((config as any).sectionGuiMode !== undefined) {
        const next = (config as any).sectionGuiMode;
        if (next === 'overlay' || next === 'baked') {
          const prev = (engine.worldsConfig as any).sectionGuiMode;
          (engine.worldsConfig as any).sectionGuiMode = next;
          if (prev !== next) {
            engine.clear3DSectionTextures();
          }
        }
      }
      if (config.cameraFov !== undefined) {
        engine.worldsConfig.cameraFov = config.cameraFov;
      }
      if (config.cameraNear !== undefined) {
        engine.worldsConfig.cameraNear = config.cameraNear;
      }
      if (config.cameraFar !== undefined) {
        engine.worldsConfig.cameraFar = config.cameraFar;
      }
      if (config.positionEaseSpeed !== undefined) {
        engine.worldsConfig.positionEaseSpeed = config.positionEaseSpeed;
      }
      if (config.rotationEaseSpeed !== undefined) {
        engine.worldsConfig.rotationEaseSpeed = config.rotationEaseSpeed;
      }

      if ((config as any).keepRotation !== undefined) {
        (engine.worldsConfig as any).keepRotation = !!(config as any).keepRotation;
      }

      if ((config as any).straightenOnFocus !== undefined) {
        (engine.worldsConfig as any).straightenOnFocus = !!(config as any).straightenOnFocus;
      }
      if ((config as any).screenSpaceRecenter !== undefined) {
        (engine.worldsConfig as any).screenSpaceRecenter = !!(config as any).screenSpaceRecenter;
      }
      if ((config as any).screenSpaceRecenterIters !== undefined) {
        const v = Number((config as any).screenSpaceRecenterIters);
        if (Number.isFinite(v)) {
          (engine.worldsConfig as any).screenSpaceRecenterIters = Math.max(1, Math.min(12, Math.floor(v)));
        }
      }
      if (config.autoLayoutEnabled !== undefined) {
        engine.worldsConfig.autoLayoutEnabled = config.autoLayoutEnabled;
      }
      if (config.autoLayoutColumns !== undefined) {
        engine.worldsConfig.autoLayoutColumns = config.autoLayoutColumns;
      }
      if (config.autoLayoutSpacing !== undefined) {
        engine.worldsConfig.autoLayoutSpacing = config.autoLayoutSpacing;
      }
      if (config.liveTextureScale !== undefined) {
        const v = Number(config.liveTextureScale);
        engine.worldsConfig.liveTextureScale = Number.isFinite(v) ? Math.max(1, Math.min(4, v)) : undefined;
      }
      if (config.sectionTextureMode !== undefined) {
        const prev = engine.worldsConfig.sectionTextureMode;
        engine.worldsConfig.sectionTextureMode = config.sectionTextureMode;
        if (prev !== config.sectionTextureMode) {
          engine.clear3DSectionTextures();
        }
      }

      if (config.sectionBorderEnabled !== undefined) {
        const prev = engine.worldsConfig.sectionBorderEnabled;
        engine.worldsConfig.sectionBorderEnabled = config.sectionBorderEnabled;
        if (prev !== config.sectionBorderEnabled) {
          engine.clear3DSectionTextures();
        }
      }
      if (config.sectionBorderWidth !== undefined) {
        const prev = engine.worldsConfig.sectionBorderWidth;
        engine.worldsConfig.sectionBorderWidth = config.sectionBorderWidth;
        if (prev !== config.sectionBorderWidth) {
          engine.clear3DSectionTextures();
        }
      }
      if ((config as any).sectionBorder !== undefined) {
        const prev = (engine.worldsConfig as any).sectionBorder;
        (engine.worldsConfig as any).sectionBorder = (config as any).sectionBorder;
        if (prev !== (config as any).sectionBorder) {
          engine.clear3DSectionTextures();
        }
      }

      if ((config as any).sectionBackground !== undefined) {
        const prev = (engine.worldsConfig as any).sectionBackground;
        (engine.worldsConfig as any).sectionBackground = (config as any).sectionBackground;
        if (prev !== (config as any).sectionBackground) {
          engine.clear3DSectionTextures();
        }
      }

      if ((config as any).sectionForeground !== undefined) {
        const prev = (engine.worldsConfig as any).sectionForeground;
        (engine.worldsConfig as any).sectionForeground = (config as any).sectionForeground;
        if (prev !== (config as any).sectionForeground) {
          engine.clear3DSectionTextures();
        }
      }

      if (config.sectionBackgroundPaperNoiseStrength !== undefined) {
        const v = config.sectionBackgroundPaperNoiseStrength;
        if (Number.isFinite(v as any)) {
          engine.worldsConfig.sectionBackgroundPaperNoiseStrength = Math.max(0, Math.min(1, v as number));
        }
      }

      if (config.sectionLinkUnderline !== undefined) {
        const prev = engine.worldsConfig.sectionLinkUnderline;
        engine.worldsConfig.sectionLinkUnderline = !!config.sectionLinkUnderline;
        if (prev !== engine.worldsConfig.sectionLinkUnderline) {
          engine.clear3DSectionTextures();
        }
      }

      if ((config as any).sectionListMarker !== undefined) {
        const prev = engine.worldsConfig.sectionListMarker;
        engine.worldsConfig.sectionListMarker = (config as any).sectionListMarker;
        if (prev !== engine.worldsConfig.sectionListMarker) {
          engine.clear3DSectionTextures();
        }
      }

      if ((config as any).sectionListMarkerGapPx !== undefined) {
        const prev = engine.worldsConfig.sectionListMarkerGapPx;
        const next = Number((config as any).sectionListMarkerGapPx);
        if (Number.isFinite(next)) {
          engine.worldsConfig.sectionListMarkerGapPx = Math.max(0, next);
          if (prev !== engine.worldsConfig.sectionListMarkerGapPx) {
            engine.clear3DSectionTextures();
          }
        }
      }

      if ((config as any).sectionListHangIndentPx !== undefined) {
        const prev = engine.worldsConfig.sectionListHangIndentPx;
        const next = Number((config as any).sectionListHangIndentPx);
        if (Number.isFinite(next)) {
          engine.worldsConfig.sectionListHangIndentPx = Math.max(0, next);
          if (prev !== engine.worldsConfig.sectionListHangIndentPx) {
            engine.clear3DSectionTextures();
          }
        }
      }

      // Support both the full key and the shorthand alias used in heading directives.
      const _autoHideVal = (config as any).autoHideSectionsUntilVisited ?? (config as any).hiddenUntilVisited;
      if (_autoHideVal !== undefined) {
        const prev = (engine.worldsConfig as any).autoHideSectionsUntilVisited;
        const next = !!_autoHideVal;
        (engine.worldsConfig as any).autoHideSectionsUntilVisited = next;
        if (prev !== next) {
          requiresSectionLayoutRecompile = true;
        }
      }

      if ((config as any).sectionArrowNavigation !== undefined) {
        (engine.worldsConfig as any).sectionArrowNavigation = !!(config as any).sectionArrowNavigation;
      }

      if ((config as any).sectionTextureCacheRadius !== undefined) {
        const v = Number((config as any).sectionTextureCacheRadius);
        (engine.worldsConfig as any).sectionTextureCacheRadius = Number.isFinite(v) ? Math.max(0, Math.floor(v)) : undefined;
      }

      if ((config as any).multiTouchRotateEnabled !== undefined) {
        engine.worldsConfig.multiTouchRotateEnabled = !!(config as any).multiTouchRotateEnabled;
      }

      if ((config as any).doubleTapResetEnabled !== undefined) {
        engine.worldsConfig.doubleTapResetEnabled = !!(config as any).doubleTapResetEnabled;
      }

      if ((config as any).doubleTapResetRotation !== undefined) {
        const rot = (config as any).doubleTapResetRotation;
        if (rot === null) {
          engine.worldsConfig.doubleTapResetRotation = undefined;
        } else if (typeof rot === 'object' && rot !== null) {
          const rx = Number(rot.x); const ry = Number(rot.y); const rz = Number(rot.z);
          if (Number.isFinite(rx) && Number.isFinite(ry) && Number.isFinite(rz)) {
            engine.worldsConfig.doubleTapResetRotation = { x: rx, y: ry, z: rz };
          }
        }
      }

      if ((config as any).navigationConstraints !== undefined) {
        const nc = (config as any).navigationConstraints;
        if (nc === null) {
          engine.worldsConfig.navigationConstraints = undefined;
        } else if (typeof nc === 'object') {
          const out: NonNullable<typeof engine.worldsConfig.navigationConstraints> = {};
          const clampNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
          if (nc.minX !== undefined) out.minX = clampNum(nc.minX);
          if (nc.maxX !== undefined) out.maxX = clampNum(nc.maxX);
          if (nc.minY !== undefined) out.minY = clampNum(nc.minY);
          if (nc.maxY !== undefined) out.maxY = clampNum(nc.maxY);
          if (nc.minZ !== undefined) out.minZ = clampNum(nc.minZ);
          if (nc.maxZ !== undefined) out.maxZ = clampNum(nc.maxZ);
          if (nc.dragAxis === 'x' || nc.dragAxis === 'y') out.dragAxis = nc.dragAxis;
          else if (nc.dragAxis === null || nc.dragAxis === 'none') out.dragAxis = null;
          engine.worldsConfig.navigationConstraints = out;
        }
      }

      if (requiresSectionLayoutRecompile && engine.runtimeSectionStore.sections.length > 0) {
        engine.compileWorldsLayoutsFromRuntimeSectionStore('config defaults changed');
      } else {
        engine.applyWorldsLayoutCallback();
        engine.reflowWorldsAutoLayout();
      }
    };

    const applyWorldsPreset = (name: string) => {
      const preset = getWorldsPreset(name);
      if (!preset) return null;

      engine.worldsEnabled = true;
      if (engine.compositor?.layers.get('3d')) {
        engine.compositor.updateLayer('3d', { enabled: true });
      }
      engine.updateAudienceViewLayers();

      applyWorldsConfigDefaults(preset.defaults);

      if (engine.camera3D) {
        engine.camera3D.position = { ...preset.camera.position };
        engine.camera3D.rotation = { ...preset.camera.rotation };
        engine.camera3D.target = null;
        engine.camera3D.targetRotation = null;
        engine.camera3D.fov = preset.camera.fov;
        engine.camera3D.positionEaseSpeed = preset.camera.easeSpeed.position;
        engine.camera3D.rotationEaseSpeed = preset.camera.easeSpeed.rotation;
        if (preset.camera.shake) {
          engine.camera3D.shake = {
            enabled: !!preset.camera.shake.enabled,
            strength: preset.camera.shake.strength,
            seed: engine.camera3D.shake?.seed ?? 0,
            rate: preset.camera.shake.rate,
            translate: { ...preset.camera.shake.translate },
            rotate: { ...preset.camera.shake.rotate },
          };
          engine.camera3D._shakeState = undefined;
        } else if (engine.camera3D.shake) {
          engine.camera3D.shake.enabled = false;
          engine.camera3D._shakeState = undefined;
        }
      }

      return preset;
    };

    type StfxrBakedEntry = {
      id: string;
      name: string;
      seed: number;
      sampleRate: number;
      seconds: number;
      buffer: AudioBuffer;
      bytes: number;
      createdAt: number;
    };

    const MAX_STFXR_BAKED_BYTES = 16 * 1024 * 1024; // per document (roughly)

    const estimateAudioBufferBytes = (buffer: AudioBuffer): number => {
      const frames = buffer.length;
      const channels = buffer.numberOfChannels;
      return Math.max(0, frames * channels * 4);
    };

    const getStfxrBakedStore = (documentId?: string): Map<string, StfxrBakedEntry> | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;
      if (!doc._stfxrBakedStore) doc._stfxrBakedStore = new Map();
      return doc._stfxrBakedStore as Map<string, StfxrBakedEntry>;
    };

    const sanitizePlayOptions = (options?: { volume?: number; when?: number; output?: AudioNode }): { volume?: number; when?: number; output?: AudioNode } => {
      const out: { volume?: number; when?: number; output?: AudioNode } = {};
      const v = Number(options?.volume);
      if (Number.isFinite(v)) out.volume = Math.max(0, Math.min(2, v));
      const w = Number(options?.when);
      if (Number.isFinite(w) && w >= 0) out.when = Math.min(60, w);
      const output = (options as any)?.output;
      if (output && typeof output === 'object' && typeof (output as any).connect === 'function') out.output = output;
      return out;
    };

    const sanitizeVoiceOptions = (options?: any): any => {
      const out: any = sanitizePlayOptions(options);

      const a = Number(options?.attack);
      if (Number.isFinite(a) && a >= 0) out.attack = Math.min(10, a);

      const d = Number(options?.decay);
      if (Number.isFinite(d) && d >= 0) out.decay = Math.min(10, d);

      const s = Number(options?.sustain);
      if (Number.isFinite(s)) out.sustain = Math.max(0, Math.min(1, s));

      const r = Number(options?.release);
      if (Number.isFinite(r) && r >= 0) out.release = Math.min(10, r);

      const pk = Number(options?.peak);
      if (Number.isFinite(pk) && pk >= 0) out.peak = Math.min(10, pk);

      const pitchParams = options?.pitchParams;
      if (typeof pitchParams === 'string') out.pitchParams = pitchParams;
      else if (Array.isArray(pitchParams)) out.pitchParams = pitchParams.map((p: any) => String(p));

      const gateParam = options?.gateParam;
      if (typeof gateParam === 'string' && gateParam) out.gateParam = gateParam;

      if (options?.scheduleEvents !== undefined) out.scheduleEvents = !!options.scheduleEvents;
      if (options?.obeyStopAfter !== undefined) out.obeyStopAfter = !!options.obeyStopAfter;

      return out;
    };

    const getAudioPack = (): AudioRuntimePack | null => {
      const pack = engine.getAudioRuntimePack();
      if (!pack) engine.requestAudioRuntimePack();
      return pack;
    };

    const getTextPack = (): TextRuntimePack | null => {
      const pack = engine.getTextRuntimePack();
      if (!pack) engine.requestTextRuntimePack();
      return pack;
    };

    const ensureFigletFont = (entry: FigletStoreEntry, fallbackName: string): FigletFont | null => {
      if (entry.font) return entry.font;

      const textPack = getTextPack();
      if (!textPack) return null;

      try {
        entry.font = textPack.parseFIGfont(String(entry.text ?? ''), String(entry.name ?? fallbackName));
      } catch (error) {
        console.warn('[figlet] Failed to parse font:', fallbackName, error);
        return null;
      }

      return entry.font ?? null;
    };

    const ensureAnsiParsed = (entry: AnsiStoreEntry): AnsiParsed | null => {
      if (entry.parsed) return entry.parsed;

      const textPack = getTextPack();
      if (!textPack) return null;

      const defaultStyle = engine.getStyle('default');
      entry.parsed = textPack.parseAnsiToRuns(String(entry.text ?? ''), {
        defaultFg: ColorUtils.from(defaultStyle.fg),
        defaultBg: engine.currentTheme.bg,
        tabSize: entry.tabSize ?? 4,
        bracketSGR: true
      });
      return entry.parsed;
    };

    const playPresetInternal = (presetIn: unknown, seed?: number | string, options?: { volume?: number; when?: number; output?: AudioNode }) => {
      const audioPack = getAudioPack();
      if (!audioPack) return { stop: () => {} };

      let preset: SfxGraphPreset;
      try {
        preset = audioPack.parseSfxGraphPreset(presetIn);
      } catch (e) {
        console.warn('[stfxr.playPreset] Invalid preset:', e);
        return { stop: () => {} };
      }

      const MAX_NODES = 256;
      const MAX_EDGES = 1024;
      const MAX_EVENTS = 1024;
      const nodeCount = Array.isArray(preset.nodes) ? preset.nodes.length : 0;
      const edgeCount = Array.isArray(preset.edges) ? preset.edges.length : 0;
      const eventCount = Array.isArray(preset.events) ? preset.events.length : 0;
      if (nodeCount > MAX_NODES || edgeCount > MAX_EDGES || eventCount > MAX_EVENTS) {
        console.warn(
          `[stfxr.playPreset] Refusing to play overly large preset (nodes=${nodeCount}, edges=${edgeCount}, events=${eventCount}).`
        );
        return { stop: () => {} };
      }

      engine.audioContext.resume().catch(() => {});
      const resolvedSeed = audioPack.toSfxSeed(seed);
      return audioPack.playSfxGraph(engine.audioContext, preset, resolvedSeed, sanitizePlayOptions(options));
    };

    const voicePresetInternal = (presetIn: unknown, seed?: number | string, options?: any) => {
      const audioPack = getAudioPack();
      if (!audioPack) {
        return {
          params: {},
          setHz: () => {},
          noteOn: () => {},
          noteOff: () => {},
          stop: () => {}
        };
      }

      let preset: SfxGraphPreset;
      try {
        preset = audioPack.parseSfxGraphPreset(presetIn);
      } catch (e) {
        console.warn('[stfxr.voicePreset] Invalid preset:', e);
        return {
          params: {},
          setHz: () => {},
          noteOn: () => {},
          noteOff: () => {},
          stop: () => {}
        };
      }

      const MAX_NODES = 256;
      const MAX_EDGES = 1024;
      const MAX_EVENTS = 1024;
      const nodeCount = Array.isArray(preset.nodes) ? preset.nodes.length : 0;
      const edgeCount = Array.isArray(preset.edges) ? preset.edges.length : 0;
      const eventCount = Array.isArray(preset.events) ? preset.events.length : 0;
      if (nodeCount > MAX_NODES || edgeCount > MAX_EDGES || eventCount > MAX_EVENTS) {
        console.warn(
          `[stfxr.voicePreset] Refusing to create voice from overly large preset (nodes=${nodeCount}, edges=${edgeCount}, events=${eventCount}).`
        );
        return {
          params: {},
          setHz: () => {},
          noteOn: () => {},
          noteOff: () => {},
          stop: () => {}
        };
      }

      engine.audioContext.resume().catch(() => {});
      const resolvedSeed = audioPack.toSfxSeed(seed);
      return audioPack.createSfxGraphVoice(engine.audioContext, preset, resolvedSeed, sanitizeVoiceOptions(options));
    };

    const evictStfxrBakedIfNeeded = (store: Map<string, StfxrBakedEntry>) => {
      let total = 0;
      for (const e of store.values()) total += e.bytes;
      if (total <= MAX_STFXR_BAKED_BYTES) return;
      // Evict oldest insertions first.
      while (total > MAX_STFXR_BAKED_BYTES && store.size > 1) {
        const oldestKey = store.keys().next().value as string;
        const oldest = store.get(oldestKey);
        store.delete(oldestKey);
        if (oldest) total -= oldest.bytes;
      }
    };

    const clonePreset = (preset: SfxGraphPreset): SfxGraphPreset => {
      try {
        if (typeof structuredClone === 'function') return structuredClone(preset);
      } catch {
        // ignore
      }
      return JSON.parse(JSON.stringify(preset)) as SfxGraphPreset;
    };

    const estimateBase64Bytes = (b64: string): number => {
      const s = b64.replace(/\s+/g, '');
      const padding = s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0;
      return Math.max(0, Math.floor((s.length * 3) / 4) - padding);
    };

    const normalizeHex = (hex: string): string => {
      // Keep only hex digits; tolerate whitespace, commas, underscores, 0x prefixes, etc.
      // This makes it safe to paste formatted/column-wrapped hex dumps.
      return hex
        .replace(/0x/gi, '')
        .replace(/[^0-9a-f]/gi, '')
        .trim();
    };

    const estimateHexBytes = (hex: string): number => {
      const s = normalizeHex(hex);
      return Math.floor(s.length / 2);
    };

    const decodeBase64ToBytes = (b64: string): Uint8Array | undefined => {
      const clean = b64.replace(/\s+/g, '');
      const est = estimateBase64Bytes(clean);
      if (est <= 0) return new Uint8Array(0);
      if (est > MAX_BLOB_BYTES) {
        console.warn(`[blob] Refusing to decode blob larger than ${MAX_BLOB_BYTES} bytes (estimated ${est}).`);
        return undefined;
      }
      try {
        const bin = atob(clean);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xFF;
        return out;
      } catch (e) {
        console.warn('[blob] Base64 decode failed:', e);
        return undefined;
      }
    };

    const decodeHexToBytes = (hex: string): Uint8Array | undefined => {
      const clean = normalizeHex(hex);
      if (clean.length === 0) return new Uint8Array(0);
      if (clean.length % 2 !== 0) {
        console.warn('[blob] Hex decode failed: odd-length hex string');
        return undefined;
      }

      const est = estimateHexBytes(clean);
      if (est > MAX_BLOB_BYTES) {
        console.warn(`[blob] Refusing to decode blob larger than ${MAX_BLOB_BYTES} bytes (estimated ${est}).`);
        return undefined;
      }

      const out = new Uint8Array(est);
      for (let i = 0; i < est; i++) {
        const byteStr = clean.slice(i * 2, i * 2 + 2);
        const v = Number.parseInt(byteStr, 16);
        if (!Number.isFinite(v) || Number.isNaN(v)) {
          console.warn('[blob] Hex decode failed: invalid byte');
          return undefined;
        }
        out[i] = v & 0xFF;
      }
      return out;
    };

    const estimateBlobBytes = (entry: { encoding: 'base64' | 'hex'; data: string }): number => {
      return entry.encoding === 'hex' ? estimateHexBytes(entry.data) : estimateBase64Bytes(entry.data);
    };

    const decodeBlobToBytes = (entry: { encoding: 'base64' | 'hex'; data: string }): Uint8Array | undefined => {
      return entry.encoding === 'hex' ? decodeHexToBytes(entry.data) : decodeBase64ToBytes(entry.data);
    };

    type UIBlobAudioCache = {
      resolved: Map<string, AudioBuffer>;
      inFlight: Map<string, Promise<AudioBuffer | null>>;
      failed: Set<string>;
    };

    const getUIBlobAudioCache = (documentId?: string): UIBlobAudioCache | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;

      if (!doc._uiBlobAudioCache) {
        doc._uiBlobAudioCache = {
          resolved: new Map<string, AudioBuffer>(),
          inFlight: new Map<string, Promise<AudioBuffer | null>>(),
          failed: new Set<string>()
        } satisfies UIBlobAudioCache;
      }
      return doc._uiBlobAudioCache as UIBlobAudioCache;
    };

    const toExactArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
      // Important: .buffer may include extra bytes (or be a SharedArrayBuffer); copy to a fresh ArrayBuffer.
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      return ab;
    };

    const loadAudioFromBlobInternal = async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
      const store = getBlobStore(documentId);
      if (!store) return null;
      const entry = store.get(String(name));
      if (!entry) return null;

      if (!entry.bytes) {
        entry.bytes = decodeBlobToBytes(entry);
      }
      if (!entry.bytes) return null;

      const mime = String(entry.mime ?? '');
      if (mime && !mime.startsWith('audio/')) {
        // Not a hard error: decodeAudioData sniffs content in most browsers.
        console.warn(`[audio.loadSoundFromBlob] Blob "${String(name)}" has non-audio mime "${mime}"; attempting decode anyway.`);
      }

      try {
        const ab = toExactArrayBuffer(entry.bytes);
        return await engine.audioContext.decodeAudioData(ab);
      } catch (e) {
        console.warn(`[audio.loadSoundFromBlob] Failed to decode audio blob "${String(name)}":`, e);
        return null;
      }
    };

    const loadSoundFromBlobCached = async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
      const key = String(name ?? '');
      if (!key) return null;

      const cache = getUIBlobAudioCache(documentId);
      if (!cache) return await loadAudioFromBlobInternal(key, documentId);

      const resolved = cache.resolved.get(key);
      if (resolved) return resolved;
      if (cache.failed.has(key)) return null;
      const inFlight = cache.inFlight.get(key);
      if (inFlight) return await inFlight;

      const promise = loadAudioFromBlobInternal(key, documentId)
        .then((buf) => {
          cache.inFlight.delete(key);
          if (buf) {
            cache.resolved.set(key, buf);
          } else {
            cache.failed.add(key);
          }
          return buf;
        })
        .catch((_e) => {
          cache.inFlight.delete(key);
          cache.failed.add(key);
          return null;
        });

      cache.inFlight.set(key, promise);
      return await promise;
    };

    type PortableAudioAssetEntry = {
      handle: AudioAssetHandle;
      buffer: AudioBuffer;
    };

    type PortableAudioVoiceEntry = {
      handle: AudioVoiceHandle;
      source: AudioBufferSourceNode;
      gainNode: GainNode;
      assetDurationSec: number;
    };

    const portableAudioAssets = new Map<string, PortableAudioAssetEntry>();
    const portableAudioVoices = new Map<string, PortableAudioVoiceEntry>();
    let nextPortableAudioAssetId = 1;
    let nextPortableAudioVoiceId = 1;

    const cloneAudioAssetHandle = (handle: AudioAssetHandle): AudioAssetHandle => ({ ...handle });
    const cloneAudioVoiceHandle = (handle: AudioVoiceHandle): AudioVoiceHandle => ({ ...handle });

    const registerPortableAudioAsset = (
      buffer: AudioBuffer,
      source: AudioAssetHandle['source'],
      origin?: string,
    ): AudioAssetHandle => {
      const handle: AudioAssetHandle = {
        id: `audio_asset_${nextPortableAudioAssetId++}`,
        source,
        durationSec: buffer.duration,
        sampleRate: buffer.sampleRate,
        channels: buffer.numberOfChannels,
        ...(origin ? { origin } : {}),
      };
      portableAudioAssets.set(handle.id, { handle, buffer });
      return cloneAudioAssetHandle(handle);
    };

    const resolvePortableAudioAsset = (handleOrId: string | AudioAssetHandle): PortableAudioAssetEntry | null => {
      const id = typeof handleOrId === 'string'
        ? handleOrId
        : (handleOrId && typeof handleOrId === 'object' ? String(handleOrId.id ?? '') : '');
      if (!id) return null;
      return portableAudioAssets.get(id) ?? null;
    };

    const resolvePortableAudioVoice = (voiceOrId: string | AudioVoiceHandle): PortableAudioVoiceEntry | null => {
      const id = typeof voiceOrId === 'string'
        ? voiceOrId
        : (voiceOrId && typeof voiceOrId === 'object' ? String(voiceOrId.id ?? '') : '');
      if (!id) return null;
      return portableAudioVoices.get(id) ?? null;
    };

    const createPortableAudioVoice = (
      assetEntry: PortableAudioAssetEntry,
      options: { loop?: boolean; gain?: number; playbackRate?: number; when?: number; offsetSec?: number } = {},
    ): AudioVoiceHandle => {
      const source = engine.audioContext.createBufferSource();
      const gainNode = engine.audioContext.createGain();
      const requestedOffsetSec = Number.isFinite(options.offsetSec) ? Number(options.offsetSec) : 0;
      const offsetSec = Math.max(0, Math.min(assetEntry.handle.durationSec, requestedOffsetSec));
      const handle: AudioVoiceHandle = {
        id: `audio_voice_${nextPortableAudioVoiceId++}`,
        assetId: assetEntry.handle.id,
        state: 'playing',
        loop: !!options.loop,
        gain: Number.isFinite(options.gain) ? Math.max(0, Number(options.gain)) : 1,
        playbackRate: Number.isFinite(options.playbackRate) ? Math.max(0.01, Number(options.playbackRate)) : 1,
        offsetSec,
        startedAtSec: null,
      };

      source.buffer = assetEntry.buffer;
      source.loop = handle.loop;
      source.playbackRate.value = handle.playbackRate;
      gainNode.gain.value = handle.gain;
      source.connect(gainNode);
      gainNode.connect(engine.audioContext.destination);

      const voiceEntry: PortableAudioVoiceEntry = {
        handle,
        source,
        gainNode,
        assetDurationSec: assetEntry.handle.durationSec,
      };
      portableAudioVoices.set(handle.id, voiceEntry);

      source.onended = () => {
        if (voiceEntry.handle.startedAtSec !== null) {
          const elapsed = Math.max(0, engine.audioContext.currentTime - voiceEntry.handle.startedAtSec);
          const advanced = elapsed * Math.max(0.01, voiceEntry.handle.playbackRate);
          voiceEntry.handle.offsetSec = voiceEntry.handle.loop
            ? ((voiceEntry.handle.offsetSec + advanced) % Math.max(voiceEntry.assetDurationSec, 0.000001))
            : Math.min(voiceEntry.assetDurationSec, voiceEntry.handle.offsetSec + advanced);
        }
        voiceEntry.handle.state = 'stopped';
        voiceEntry.handle.startedAtSec = null;
      };

      engine.runOrQueueGestureAudioStart(() => {
        const when = (typeof options.when === 'number' && Number.isFinite(options.when))
          ? options.when
          : engine.audioContext.currentTime;
        voiceEntry.handle.startedAtSec = when;
        try {
          source.start(when, offsetSec);
        } catch {
          source.start();
          voiceEntry.handle.startedAtSec = engine.audioContext.currentTime;
        }
      });
      engine.audioContext.resume().catch(() => {});

      return cloneAudioVoiceHandle(handle);
    };

    type UIBlobImageCache = {
      resolved: Map<string, string>;
      inFlight: Map<string, Promise<string | null>>;
      failed: Set<string>;
    };

    const getUIBlobImageCache = (documentId?: string): UIBlobImageCache | null => {
      const docId = documentId ?? engine.activeDocumentId;
      if (!docId) return null;
      const doc = engine.documents.get(docId) as any;
      if (!doc) return null;

      if (!doc._uiBlobImageCache) {
        doc._uiBlobImageCache = {
          resolved: new Map<string, string>(),
          inFlight: new Map<string, Promise<string | null>>(),
          failed: new Set<string>()
        } satisfies UIBlobImageCache;
      }
      return doc._uiBlobImageCache as UIBlobImageCache;
    };

    const loadImageFromBlobInternal = async (name: string, documentId?: string): Promise<string | null> => {
      const ui = engine.ensureWebGPUUI();
      if (!ui) return null;

      const store = getBlobStore(documentId);
      if (!store) return null;
      const entry = store.get(String(name));
      if (!entry) return null;

      if (!entry.bytes) {
        entry.bytes = decodeBlobToBytes(entry);
      }
      if (!entry.bytes) return null;

      const mime = entry.mime || 'application/octet-stream';
      try {
        const image = await engine.decodeRenderableImageFromBytes(entry.bytes, mime);
        if (!image) return null;
        const id = `img_${nextUIImageId++}`;
        ui.registerImage(id, image);
        return id;
      } catch (e) {
        console.warn(`[ui.loadImageFromBlob] Failed to decode image "${String(name)}":`, e);
        return null;
      }
    };
    
    return {
      // Terminal text API
      term: {
        write: (x: number, y: number, text: string, fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.write(x, y, text, fg, bg);
        },
        fill: (x: number, y: number, w: number, h: number, char: string = ' ', fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.fill(x, y, w, h, char, fg, bg);
        },
        clear: (bgColor?: Color) => {
          const layer = this.layers.getActive();
          layer.clear(bgColor ?? this.currentTheme.bg);
        },
        get layerID(): string {
          return layers.activeLayerId;
        },
        set layerID(id: string) {
          if (layers.get(id)) {
            layers.activeLayerId = id;
          } else {
            console.warn(`Layer "${id}" does not exist`);
          }
        }
      },
      
      // Terminal canvas API (character-based drawing)
      termCanvas: {
        plot: (x: number, y: number, char: string, fg?: Color, bg?: Color) => {
          const layer = this.layers.getActive();
          layer.plot(x, y, char, fg, bg);
        },
        line: (x1: number, y1: number, x2: number, y2: number, char: string, fg?: Color, bg?: Color) => {
          this.drawLine(x1, y1, x2, y2, char, fg, bg);
        },
        rect: (x: number, y: number, w: number, h: number, char: string, fg?: Color, bg?: Color, filled: boolean = false) => {
          this.drawRect(x, y, w, h, char, fg, bg, filled);
        },
        scrollTo: (x: number, y: number) => {
          // Viewport scrolling reserved for future use
          console.log(`Scroll to (${x}, ${y})`);
        },
        width: () => this.width,
        height: () => this.height
      },
      
      // Layer API
      layer: {
        create: (id: string, width?: number, height?: number) => {
          this.layers.create(id, width ?? this.width, height ?? this.height);
        },
        show: (id: string) => {
          this.layers.show(id);
        },
        hide: (id: string) => {
          this.layers.hide(id);
        },
        setAlpha: (id: string, alpha: number) => {
          this.layers.setAlpha(id, alpha);
        },
        clear: (id: string) => {
          const layer = this.layers.get(id);
          if (layer) layer.clear();
        }
      },
      
      // Input API
      key: {
        down: (key: string) => this.input.isKeyDown(key),
        pressed: (key: string) => this.input.isKeyPressed(key),
        released: (key: string) => this.input.isKeyReleased(key),
        SPACE: KEY.SPACE,
        ENTER: KEY.ENTER,
        ESC: KEY.ESC,
        ARROW_UP: KEY.ARROW_UP,
        ARROW_DOWN: KEY.ARROW_DOWN,
        ARROW_LEFT: KEY.ARROW_LEFT,
        ARROW_RIGHT: KEY.ARROW_RIGHT
      },
      
      mouse: {
        x: () => {
          const rect = this.canvas.getBoundingClientRect();
          const charWidth = rect.width / this.width;
          return Math.floor(this.input.getMouseX() / charWidth);
        },
        y: () => {
          const rect = this.canvas.getBoundingClientRect();
          const charHeight = rect.height / this.height;
          return Math.floor(this.input.getMouseY() / charHeight);
        },
        down: (button = 0) => this.input.isMouseDown(button),
        clicked: (button = 0) => this.input.isMouseClicked(button)
      },

      // Dropped file API (binary-safe; populated by engine.installDropHandling())
      drop: {
        has: () => !!engine.lastDroppedFile,
        name: () => engine.lastDroppedFile?.name ?? '',
        size: () => engine.lastDroppedFile?.size ?? 0,
        mime: () => engine.lastDroppedFile?.mime ?? '',
        bytes: () => engine.lastDroppedFile?.bytes ?? null,
        text: (encoding: string = 'utf-8') => {
          const bytes = engine.lastDroppedFile?.bytes;
          if (!bytes) return null;
          try {
            const decoder = new TextDecoder(encoding);
            return decoder.decode(bytes);
          } catch (e) {
            console.warn('[drop] Text decode failed:', e);
            return null;
          }
        }
      },

      // Document metadata API (read-only)
      // Section indices match Worlds's depth-first layout order.
      doc: {
        sectionsFlat: () => {
          const roots = engine.getReadableSectionRoots();
          if (roots.length === 0) return [] as Array<{ index: number; sectionId: string; title: string; level: number; timedMs?: number; directive?: Record<string, any> }>;
          const flat = flattenSections(roots);
          return flat.map((s, index) => ({
            index,
            sectionId: typeof s.id === 'string' && s.id.length > 0 ? s.id : `section-${index}`,
            title: s.title,
            level: s.level,
            ...(s.timedMs    !== undefined ? { timedMs:   s.timedMs   } : {}),
            ...(s.directive               ? { directive: s.directive } : {}),
          }));
        },
        sectionCount: () => {
          return flattenSections(engine.getReadableSectionRoots()).length;
        },
        outline: () => {
          return engine.getOutlineNodes();
        },
        sourceMarkdown: () => {
          return engine.getActiveDocumentSourceMarkdown() ?? '';
        },
        timedBlock: (name: string) => {
          const store = getTimedStore();
          if (!store) return [] as Array<{ ms: number; text: string }>;
          const block = store.get(String(name));
          return block ? block.entries.map((e: any) => ({ ms: e.ms, text: e.text })) : [];
        },
        timedBlocks: () => {
          const store = getTimedStore();
          if (!store) return [] as string[];
          return Array.from(store.keys());
        },
        logicBlocks: () => {
          const store = getLogicStore();
          if (!store) return [] as Array<any>;
          return store.map((block: any) => ({
            ...(block.name ? { name: block.name } : {}),
            ...(Object.prototype.hasOwnProperty.call(block, 'sectionId') ? { sectionId: block.sectionId ?? null } : {}),
            ...(Object.prototype.hasOwnProperty.call(block, 'sectionTitle') ? { sectionTitle: block.sectionTitle ?? null } : {}),
            startLine: block.startLine,
            endLine: block.endLine,
            statements: Array.isArray(block.statements)
              ? block.statements.map((statement: any) => ({
                  source: String(statement.source ?? ''),
                  target: String(statement.target ?? ''),
                  ...(typeof statement.rel === 'string' && statement.rel ? { rel: statement.rel } : {}),
                  ...(statement.meta ? { meta: { ...statement.meta } } : {}),
                  line: Number(statement.line ?? 0),
                }))
              : [],
          }));
        },
        logicForSection: (section?: 'current' | number | string | null) => {
          const store = getLogicStore();
          if (!store) return [] as Array<any>;
          if (section === undefined || section === null) {
            return store.flatMap((block: any) => Array.isArray(block.statements) ? block.statements.map((statement: any) => ({
              source: String(statement.source ?? ''),
              target: String(statement.target ?? ''),
              ...(typeof statement.rel === 'string' && statement.rel ? { rel: statement.rel } : {}),
              ...(statement.meta ? { meta: { ...statement.meta } } : {}),
              line: Number(statement.line ?? 0),
            })) : []);
          }

          const resolved = section === 'current'
            ? engine.resolveRuntimeSectionRef('current')
            : engine.resolveRuntimeSectionRef(section as any);
          const wantedSectionId = resolved?.sectionId ?? null;
          if (!wantedSectionId) return [] as Array<any>;

          return store
            .filter((block: any) => block.sectionId === wantedSectionId)
            .flatMap((block: any) => Array.isArray(block.statements) ? block.statements.map((statement: any) => ({
              source: String(statement.source ?? ''),
              target: String(statement.target ?? ''),
              ...(typeof statement.rel === 'string' && statement.rel ? { rel: statement.rel } : {}),
              ...(statement.meta ? { meta: { ...statement.meta } } : {}),
              line: Number(statement.line ?? 0),
            })) : []);
        },
        atTime: (name: string, timeSec: number) => {
          const store = getTimedStore();
          if (!store) return null;
          const block = store.get(String(name));
          if (!block || block.entries.length === 0) return null;
          const nowMs = Number(timeSec) * 1000;
          // Binary search: find last entry with ms ≤ nowMs.
          let lo = 0, hi = block.entries.length - 1, result = -1;
          while (lo <= hi) {
            const mid = (lo + hi) >> 1;
            if (block.entries[mid]!.ms <= nowMs) { result = mid; lo = mid + 1; }
            else hi = mid - 1;
          }
          if (result < 0) return null;
          const e = block.entries[result]!;
          return { ms: e.ms, text: e.text };
        },
        setTimedBlock: (name: string, entries: Array<{ ms: number; text: string }>) => {
          // Ensure the store exists (it may not have been created if the document
          // has no static ```timed blocks).
          const docId = engine.activeDocumentId;
          if (!docId) return;
          const doc = engine.documents.get(docId) as any;
          if (!doc) return;
          if (!doc._timedStore) doc._timedStore = new Map();
          const store = doc._timedStore as Map<string, { name: string; entries: Array<{ ms: number; text: string }> }>;
          const sorted = Array.from(entries)
            .filter(e => Number.isFinite(e.ms) && e.ms >= 0)
            .sort((a, b) => a.ms - b.ms);
          store.set(String(name), { name: String(name), entries: sorted });
        },
      },

      // Shared scene state (read-only on clients; host can write).
      scene: {
        get sectionIndex(): number | null {
          return engine.sceneState.sectionIndex;
        },
        get revealStep(): number {
          return engine.sceneState.revealStep;
        },
        getState: () => ({ ...engine.sceneState }),
        setRevealStep: (n: number) => {
          if (engine.hostAudienceView) return;
          const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
          if (engine.sceneState.revealStep === next) return;
          engine.sceneState.revealStep = next;

          const h = engine.hostSync;
          if (h && h.getSessionInfo().role === 'host') {
            const idx = engine.sceneState.sectionIndex;
            if (typeof idx === 'number') {
              h.sendSceneFit(idx, engine.sceneState.revealStep, 0.9);
            }
          }
        },
        nextRevealStep: () => {
          if (engine.hostAudienceView) return;
          const next = (engine.sceneState.revealStep ?? 0) + 1;
          const n = Number.isFinite(next) ? Math.max(0, Math.floor(next)) : 0;
          if (engine.sceneState.revealStep === n) return;
          engine.sceneState.revealStep = n;

          const h = engine.hostSync;
          if (h && h.getSessionInfo().role === 'host') {
            const idx = engine.sceneState.sectionIndex;
            if (typeof idx === 'number') {
              h.sendSceneFit(idx, engine.sceneState.revealStep, 0.9);
            }
          }
        },
        resetRevealStep: () => {
          if (engine.hostAudienceView) return;
          if (engine.sceneState.revealStep === 0) return;
          engine.sceneState.revealStep = 0;

          const h = engine.hostSync;
          if (h && h.getSessionInfo().role === 'host') {
            const idx = engine.sceneState.sectionIndex;
            if (typeof idx === 'number') {
              h.sendSceneFit(idx, engine.sceneState.revealStep, 0.9);
            }
          }
        }
      },

      // Host Sync info (read-only). Useful for host/client-specific UI.
      // Note: we intentionally do NOT expose the shared token to scripts.
      host: {
        get enabled(): boolean {
          return !!engine.hostSync;
        },
        get role(): HostRole | null {
          return engine.hostSync ? engine.hostSync.getSessionInfo().role : null;
        },
        get isHost(): boolean {
          return engine.hostSync ? engine.hostSync.getSessionInfo().role === 'host' : false;
        },
        get isClient(): boolean {
          return engine.hostSync ? engine.hostSync.getSessionInfo().role === 'client' : false;
        },
        get transport(): HostTransport | null {
          return engine.hostSync ? engine.hostSync.getSessionInfo().transport : null;
        },
        get channel(): string | null {
          return engine.hostSync ? engine.hostSync.getSessionInfo().channelId : null;
        }
      },

      // Retained-mode TUI API
      tui: createTUIAPI(
        // Use the WebGPU terminal renderer when available; otherwise provide a minimal shim
        (this.renderer instanceof WebGPURenderer
          ? this.renderer.getTerminalRenderer()
          : ({
              setCell: (buffer: any[][], x: number, y: number, char: string, fg?: Color, bg?: Color) => {
                if (!buffer?.[y]?.[x]) return;
                const cell = buffer[y][x];
                cell.char = char;
                if (fg !== undefined) cell.fg = fg;
                if (bg !== undefined) cell.bg = bg;
              }
            } as any)),
        () => this.layers.getActive().buffer,
        (name: string) => this.getStyle(name),
        () => this.inputDispatchDepth > 0
      ),
      
      // Retained-mode GUI API
      gui: deferredGUIAPI,
      
      // Theme API
      getStyle: (name: string) => this.getStyle(name),
      theme: this.currentTheme,
      themes: {
        list: () => Object.keys(THEMES),
        getName: () => this.currentThemeLabel,
        get: (name: string) => {
          const key = String(name ?? '').trim().toLowerCase();
          if (!key || !Object.prototype.hasOwnProperty.call(THEMES, key)) return null;
          return THEMES[key];
        },
        set: (name: string) => {
          const key = String(name ?? '').trim().toLowerCase();
          if (!key || !Object.prototype.hasOwnProperty.call(THEMES, key)) return false;
          this.applyThemeColors(getTheme(key), key, 'runtime');
          return true;
        }
      },
      
      // Module API
      modules: {
        load: async (name: string, options?: any) => {
          if (engine.untrustedContent) {
            throw new Error('[modules.load] Disabled in untrusted mode');
          }

          // Sandbox hardening: do not allow sandboxed scripts to provide a custom
          // URL resolver unless explicitly enabled by the host.
          if (options && typeof options === 'object') {
            if ('resolver' in options) {
              if (!engine.allowModuleResolverFromSandbox) {
                const { resolver: _resolver, ...rest } = options as any;
                options = rest;
              }
            }
          }

          return await engine.moduleLoader.load(String(name), options);
        },
        loadAll: async (names: string[], options?: any) => {
          if (engine.untrustedContent) {
            throw new Error('[modules.loadAll] Disabled in untrusted mode');
          }

          if (options && typeof options === 'object') {
            if ('resolver' in options) {
              if (!engine.allowModuleResolverFromSandbox) {
                const { resolver: _resolver, ...rest } = options as any;
                options = rest;
              }
            }
          }

          return await engine.moduleLoader.loadAll(Array.isArray(names) ? names.map(String) : [], options);
        },
        isLoaded: (name: string) => {
          return this.moduleLoader.isLoaded(name);
        },
        isLoading: (name: string) => {
          return this.moduleLoader.isLoading(name);
        },
        get: (name: string) => {
          return this.moduleLoader.get(name);
        },
        unload: async (name: string) => {
          return await this.moduleLoader.unload(name);
        },
        getMetadata: (name: string) => {
          return this.moduleLoader.getMetadata(name);
        },
        on: (event: string, callback: Function) => {
          this.moduleLoader.on(event, callback);
        }
      },

      // Embedded binary blobs (from ```blob blocks)
      blob: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getBlobStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const key = String(name);
              const entry = store.get(key);
              if (!entry) return null;
              return {
                name: entry.name,
                mime: entry.mime,
                encoding: entry.encoding,
                data: entry.data,
                byteLength: estimateBlobBytes(entry)
              };
            },
            base64: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return entry.encoding === 'base64' ? entry.data : null;
            },
            hex: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return entry.encoding === 'hex' ? entry.data : null;
            },
            bytes: (name: string) => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.bytes) {
                entry.bytes = decodeBlobToBytes(entry);
              }
              return entry.bytes ?? null;
            },
            text: (name: string, encoding: string = 'utf-8') => {
              const store = getBlobStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.bytes) {
                entry.bytes = decodeBlobToBytes(entry);
              }
              if (!entry.bytes) return null;
              try {
                const decoder = new TextDecoder(encoding);
                return decoder.decode(entry.bytes);
              } catch (e) {
                console.warn('[blob] Text decode failed:', e);
                return null;
              }
            }
          };
        },
        list: () => {
          const store = getBlobStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getBlobStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const key = String(name);
          const entry = store.get(key);
          if (!entry) return null;
          return {
            name: entry.name,
            mime: entry.mime,
            encoding: entry.encoding,
            data: entry.data,
            byteLength: estimateBlobBytes(entry)
          };
        },
        base64: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return entry.encoding === 'base64' ? entry.data : null;
        },
        hex: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return entry.encoding === 'hex' ? entry.data : null;
        },
        bytes: (name: string) => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.bytes) {
            entry.bytes = decodeBlobToBytes(entry);
          }
              return entry.bytes ?? null;
        },
        text: (name: string, encoding: string = 'utf-8') => {
          const store = getBlobStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.bytes) {
            entry.bytes = decodeBlobToBytes(entry);
          }
          if (!entry.bytes) return null;
          try {
            const decoder = new TextDecoder(encoding);
            return decoder.decode(entry.bytes);
          } catch (e) {
            console.warn('[blob] Text decode failed:', e);
            return null;
          }
        }
      },

      // Embedded ASCII art blocks (from ```ascii name:...)
      ascii: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getAsciiStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              const text = String(entry.text ?? '');
              const lines = Array.isArray(entry.lines) ? entry.lines : text.split(/\r?\n/);
              return { name: entry.name, text, lines };
            },
            text: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            lines: (name: string) => {
              const store = getAsciiStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);
              return entry.lines;
            }
          };
        },
        list: () => {
          const store = getAsciiStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getAsciiStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          const text = String(entry.text ?? '');
          const lines = Array.isArray(entry.lines) ? entry.lines : text.split(/\r?\n/);
          return { name: entry.name, text, lines };
        },
        text: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        lines: (name: string) => {
          const store = getAsciiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);
          return entry.lines;
        }
      },

      // Seeded SFX graph presets embedded in markdown (from ```stfxr name:... seed:...)
      stfxr: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          return {
            list: () => {
              const store = getStfxrStore(docId);
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStfxrStore(docId);
              if (!store) return false;
              return store.has(String(name));
            },
            get: (name: string) => {
              const store = getStfxrStore(docId);
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return clonePreset(entry.preset);
            },
            play: (
              name: string,
              seed?: number | string,
              options?: { volume?: number; when?: number; output?: AudioNode }
            ) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              if (!entry) return { stop: () => {} };
              const audioPack = getAudioPack();
              if (!audioPack) return { stop: () => {} };
              engine.audioContext.resume().catch(() => {});
              const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
              return audioPack.playSfxGraph(engine.audioContext, entry.preset, resolvedSeed, sanitizePlayOptions(options));
            },
            playPreset: (preset: any, seed?: number | string, options?: { volume?: number; when?: number; output?: AudioNode }) => {
              return playPresetInternal(preset, seed, options);
            },
            voice: (name: string, seed?: number | string, options?: any) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              if (!entry) {
                return {
                  params: {},
                  setHz: () => {},
                  noteOn: () => {},
                  noteOff: () => {},
                  stop: () => {}
                };
              }
              const audioPack = getAudioPack();
              if (!audioPack) {
                return {
                  params: {},
                  setHz: () => {},
                  noteOn: () => {},
                  noteOff: () => {},
                  stop: () => {}
                };
              }
              engine.audioContext.resume().catch(() => {});
              const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
              return audioPack.createSfxGraphVoice(engine.audioContext, entry.preset, resolvedSeed, sanitizeVoiceOptions(options));
            },
            voicePreset: (preset: any, seed?: number | string, options?: any) => {
              return voicePresetInternal(preset, seed, options);
            },
            bake: async (
              name: string,
              seed?: number | string,
              options?: { id?: string; seconds?: number; maxSeconds?: number }
            ) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              if (!entry) return '';
              const audioPack = getAudioPack();
              if (!audioPack) return '';
              const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
              const sampleRate = engine.audioContext.sampleRate;
              const id = String(options?.id ?? `stfxr:${String(name)}:${resolvedSeed >>> 0}:${sampleRate}`);

              const bakedStore = getStfxrBakedStore(docId);
              if (!bakedStore) return '';
              if (bakedStore.has(id)) return id;

              const buffer = await audioPack.bakeSfxGraphBuffer(engine.audioContext, entry.preset, resolvedSeed, {
                seconds: options?.seconds,
                maxSeconds: options?.maxSeconds
              });
              bakedStore.set(id, {
                id,
                name: String(name),
                seed: resolvedSeed >>> 0,
                sampleRate,
                seconds: buffer.length / sampleRate,
                buffer,
                bytes: estimateAudioBufferBytes(buffer),
                createdAt: Date.now()
              });
              evictStfxrBakedIfNeeded(bakedStore);
              return id;
            },
            playBaked: (
              id: string,
              options?: { volume?: number; when?: number; playbackRate?: number }
            ) => {
              const bakedStore = getStfxrBakedStore(docId);
              const entry = bakedStore?.get(String(id));
              if (!entry) return { stop: () => {} };
              engine.audioContext.resume().catch(() => {});

              const src = engine.audioContext.createBufferSource();
              const gain = engine.audioContext.createGain();
              src.buffer = entry.buffer;
              src.playbackRate.value = options?.playbackRate ?? 1;
              gain.gain.value = options?.volume ?? 1;
              src.connect(gain);
              gain.connect(engine.audioContext.destination);

              const t0 = engine.audioContext.currentTime + (options?.when ?? 0);
              try {
                src.start(t0);
              } catch {
                // ignore
              }

              return {
                stop: (when?: number) => {
                  const t = engine.audioContext.currentTime + (when ?? 0);
                  try {
                    src.stop(t);
                  } catch {
                    // ignore
                  }
                }
              };
            },
            bakedList: () => {
              const bakedStore = getStfxrBakedStore(docId);
              if (!bakedStore) return [];
              return Array.from(bakedStore.keys());
            },
            snippet: (name: string, seed?: number | string, volume?: number) => {
              const store = getStfxrStore(docId);
              const entry = store?.get(String(name));
              const seedPart = (seed ?? entry?.defaultSeed) === undefined ? '' : `, ${JSON.stringify(seed ?? entry?.defaultSeed)}`;
              const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
              return `stfxr.play(${JSON.stringify(String(name))}${seedPart}${optPart})`;
            }
          };
        },
        list: () => {
          const store = getStfxrStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getStfxrStore();
          if (!store) return false;
          return store.has(String(name));
        },
        get: (name: string) => {
          const store = getStfxrStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return clonePreset(entry.preset);
        },
        play: (name: string, seed?: number | string, options?: { volume?: number; when?: number; output?: AudioNode }) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          if (!entry) return { stop: () => {} };
          const audioPack = getAudioPack();
          if (!audioPack) return { stop: () => {} };
          engine.audioContext.resume().catch(() => {});
          const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
          return audioPack.playSfxGraph(engine.audioContext, entry.preset, resolvedSeed, sanitizePlayOptions(options));
        },
        playPreset: (preset: any, seed?: number | string, options?: { volume?: number; when?: number; output?: AudioNode }) => {
          return playPresetInternal(preset, seed, options);
        },
        voice: (name: string, seed?: number | string, options?: any) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          if (!entry) {
            return {
              params: {},
              setHz: () => {},
              noteOn: () => {},
              noteOff: () => {},
              stop: () => {}
            };
          }
          const audioPack = getAudioPack();
          if (!audioPack) {
            return {
              params: {},
              setHz: () => {},
              noteOn: () => {},
              noteOff: () => {},
              stop: () => {}
            };
          }
          engine.audioContext.resume().catch(() => {});
          const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
          return audioPack.createSfxGraphVoice(engine.audioContext, entry.preset, resolvedSeed, sanitizeVoiceOptions(options));
        },
        voicePreset: (preset: any, seed?: number | string, options?: any) => {
          return voicePresetInternal(preset, seed, options);
        },
        bake: async (name: string, seed?: number | string, options?: { id?: string; seconds?: number; maxSeconds?: number }) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          if (!entry) return '';
          const audioPack = getAudioPack();
          if (!audioPack) return '';
          const resolvedSeed = audioPack.toSfxSeed(seed ?? entry.defaultSeed);
          const sampleRate = engine.audioContext.sampleRate;
          const id = String(options?.id ?? `stfxr:${String(name)}:${resolvedSeed >>> 0}:${sampleRate}`);

          const bakedStore = getStfxrBakedStore();
          if (!bakedStore) return '';
          if (bakedStore.has(id)) return id;

          const buffer = await audioPack.bakeSfxGraphBuffer(engine.audioContext, entry.preset, resolvedSeed, {
            seconds: options?.seconds,
            maxSeconds: options?.maxSeconds
          });
          bakedStore.set(id, {
            id,
            name: String(name),
            seed: resolvedSeed >>> 0,
            sampleRate,
            seconds: buffer.length / sampleRate,
            buffer,
            bytes: estimateAudioBufferBytes(buffer),
            createdAt: Date.now()
          });
          evictStfxrBakedIfNeeded(bakedStore);
          return id;
        },
        playBaked: (id: string, options?: { volume?: number; when?: number; playbackRate?: number }) => {
          const bakedStore = getStfxrBakedStore();
          const entry = bakedStore?.get(String(id));
          if (!entry) return { stop: () => {} };
          engine.audioContext.resume().catch(() => {});

          const src = engine.audioContext.createBufferSource();
          const gain = engine.audioContext.createGain();
          src.buffer = entry.buffer;
          src.playbackRate.value = options?.playbackRate ?? 1;
          gain.gain.value = options?.volume ?? 1;
          src.connect(gain);
          gain.connect(engine.audioContext.destination);

          const t0 = engine.audioContext.currentTime + (options?.when ?? 0);
          try {
            src.start(t0);
          } catch {
            // ignore
          }

          return {
            stop: (when?: number) => {
              const t = engine.audioContext.currentTime + (when ?? 0);
              try {
                src.stop(t);
              } catch {
                // ignore
              }
            }
          };
        },
        bakedList: () => {
          const bakedStore = getStfxrBakedStore();
          if (!bakedStore) return [];
          return Array.from(bakedStore.keys());
        },
        snippet: (name: string, seed?: number | string, volume?: number) => {
          const store = getStfxrStore();
          const entry = store?.get(String(name));
          const seedPart = (seed ?? entry?.defaultSeed) === undefined ? '' : `, ${JSON.stringify(seed ?? entry?.defaultSeed)}`;
          const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
          return `stfxr.play(${JSON.stringify(String(name))}${seedPart}${optPart})`;
        }
      },

      // Embedded FIGlet fonts (from ```figlet name:...)
      figlet: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          const getStore = () => getFigletStore(docId);

          const ensureFont = (name: string): FigletFont | null => {
            const store = getStore();
            if (!store) return null;
            const entry = store.get(String(name));
            if (!entry) return null;
            return ensureFigletFont(entry, String(name));
          };

          return {
            list: () => {
              const store = getStore();
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStore();
              if (!store) return false;
              return store.has(String(name));
            },
            text: (name: string) => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            height: (name: string) => {
              const font = ensureFont(String(name));
              return font ? Math.max(0, font.height | 0) : 0;
            },
            render: (fontName: string, text: string) => {
              const font = ensureFont(String(fontName));
              const textPack = getTextPack();
              return font && textPack ? textPack.renderFigletLines(font, String(text ?? '')) : [];
            },
            renderChar: (fontName: string, ch: string) => {
              const font = ensureFont(String(fontName));
              const textPack = getTextPack();
              return font && textPack ? textPack.renderFigletCharLines(font, String(ch ?? ' ')) : [];
            }
          };
        },
        list: () => {
          const store = getFigletStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getFigletStore();
          if (!store) return false;
          return store.has(String(name));
        },
        text: (name: string) => {
          const store = getFigletStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        height: (name: string) => {
          const store = getFigletStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          const font = ensureFigletFont(entry, String(name));
          return font ? Math.max(0, font.height | 0) : 0;
        },
        render: (fontName: string, text: string) => {
          const store = getFigletStore();
          if (!store) return [];
          const entry = store.get(String(fontName));
          if (!entry) return [];
          const font = ensureFigletFont(entry, String(fontName));
          const textPack = getTextPack();
          return font && textPack ? textPack.renderFigletLines(font, String(text ?? '')) : [];
        },
        renderChar: (fontName: string, ch: string) => {
          const store = getFigletStore();
          if (!store) return [];
          const entry = store.get(String(fontName));
          if (!entry) return [];
          const font = ensureFigletFont(entry, String(fontName));
          const textPack = getTextPack();
          return font && textPack ? textPack.renderFigletCharLines(font, String(ch ?? ' ')) : [];
        }
      },

      // Embedded ANSI art (from ```ansi name:...)
      ansi: {
        forDocument: (documentId: string) => {
          const docId = String(documentId);
          const getStore = () => getAnsiStore(docId);
          return {
            list: () => {
              const store = getStore();
              if (!store) return [];
              return Array.from(store.keys());
            },
            has: (name: string) => {
              const store = getStore();
              if (!store) return false;
              return store.has(String(name));
            },
            text: (name: string) => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              return String(entry.text ?? '');
            },
            runs: (name: string): AnsiRun[][] | null => {
              const store = getStore();
              if (!store) return null;
              const entry = store.get(String(name));
              if (!entry) return null;
              const parsed = ensureAnsiParsed(entry);
              return parsed ? parsed.lines : null;
            },
            width: (name: string) => {
              const store = getStore();
              if (!store) return 0;
              const entry = store.get(String(name));
              if (!entry) return 0;
              return ensureAnsiParsed(entry)?.width ?? 0;
            },
            height: (name: string) => {
              const store = getStore();
              if (!store) return 0;
              const entry = store.get(String(name));
              if (!entry) return 0;
              return ensureAnsiParsed(entry)?.height ?? 0;
            }
          };
        },
        list: () => {
          const store = getAnsiStore();
          if (!store) return [];
          return Array.from(store.keys());
        },
        has: (name: string) => {
          const store = getAnsiStore();
          if (!store) return false;
          return store.has(String(name));
        },
        text: (name: string) => {
          const store = getAnsiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          return String(entry.text ?? '');
        },
        runs: (name: string): AnsiRun[][] | null => {
          const store = getAnsiStore();
          if (!store) return null;
          const entry = store.get(String(name));
          if (!entry) return null;
          const parsed = ensureAnsiParsed(entry);
          return parsed ? parsed.lines : null;
        },
        width: (name: string) => {
          const store = getAnsiStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          return ensureAnsiParsed(entry)?.width ?? 0;
        },
        height: (name: string) => {
          const store = getAnsiStore();
          if (!store) return 0;
          const entry = store.get(String(name));
          if (!entry) return 0;
          return ensureAnsiParsed(entry)?.height ?? 0;
        }
      },

      // Convenience: draw named ASCII art at x/y using the active layer.
      // Usage: drawAscii(x, y, 'art')
      drawAscii: (x: number, y: number, name: string, fg?: Color, bg?: Color) => {
        const store = getAsciiStore();
        if (!store) return;
        const entry = store.get(String(name));
        if (!entry) return;
        if (!entry.lines) entry.lines = String(entry.text ?? '').split(/\r?\n/);

        const layer = this.layers.getActive();
        for (let i = 0; i < entry.lines.length; i++) {
          const line = entry.lines[i] ?? '';
          layer.write(x, y + i, line, fg, bg);
        }
      },

      // Convenience: draw FIGlet-rendered text using an embedded font.
      // Usage: drawFiglet(x, y, 'standard', 'HELLO', fg?, bg?, { vertical?: boolean, letterSpacing?: number })
      drawFiglet: (
        x: number,
        y: number,
        fontName: string,
        text: string,
        fg?: Color,
        bg?: Color,
        options?: { vertical?: boolean; letterSpacing?: number }
      ) => {
        const textPack = getTextPack();
        if (!textPack) return;
        const store = getFigletStore();
        if (!store) return;
        const entry = store.get(String(fontName));
        if (!entry) return;
        const font = ensureFigletFont(entry, String(fontName));
        if (!font) return;

        const layer = this.layers.getActive();
        const vertical = !!options?.vertical;
        const letterSpacing = Math.max(0, options?.letterSpacing ?? 0);

        if (vertical) {
          let currentY = y;
          for (const ch of Array.from(String(text ?? ''))) {
            const charLines = textPack.renderFigletCharLines(font, ch);
            let lineY = currentY;
            for (const line of charLines) {
              layer.write(x, lineY, line ?? '', fg, bg);
              lineY++;
            }
            currentY = lineY + letterSpacing;
          }
          return;
        }

        if (letterSpacing > 0) {
          let currentX = x;
          for (const ch of Array.from(String(text ?? ''))) {
            const charLines = textPack.renderFigletCharLines(font, ch);
            const charWidth = textPack.measureFigletLinesWidth(charLines);
            for (let i = 0; i < charLines.length; i++) {
              layer.write(currentX, y + i, charLines[i] ?? '', fg, bg);
            }
            currentX += charWidth + letterSpacing;
          }
          return;
        }

        const lines = textPack.renderFigletLines(font, String(text ?? ''));
        for (let i = 0; i < lines.length; i++) {
          layer.write(x, y + i, lines[i] ?? '', fg, bg);
        }
      },

      // Convenience: draw ANSI art (colors) using the active layer.
      // Usage: drawAnsi(x, y, 'logo')
      drawAnsi: (x: number, y: number, name: string) => {
        const store = getAnsiStore();
        if (!store) return;
        const entry = store.get(String(name));
        if (!entry) return;
        const parsed = ensureAnsiParsed(entry);
        if (!parsed) return;

        const layer = this.layers.getActive();
        const lines = parsed.lines;
        for (let row = 0; row < lines.length; row++) {
          let cx = x;
          const runs = lines[row] ?? [];
          for (const run of runs) {
            const t = String(run.text ?? '');
            if (t.length > 0) {
              layer.write(cx, y + row, t, run.fg, run.bg);
              cx += t.length;
            }
          }
        }
      },
      
      // Global accessors (for convenience)
      // These eliminate the need for users to track coordinates manually
      get mouseX() {
        // Default to pixel coordinates (matches event.x/event.y)
        return engine.input.getMouseX();
      },
      get mouseY() {
        // Default to pixel coordinates (matches event.y)
        return engine.input.getMouseY();
      },
      get mouseCellX() {
        // Cell coordinates (for terminal/TUI work)
        // Use backing store dimensions to match coordinate system of mouseX/mouseY
        const charWidth = engine.canvas.width / engine.width;
        const pixelX = engine.input.getMouseX();
        return Math.floor(pixelX / charWidth);
      },
      get mouseCellY() {
        // Cell coordinates (for terminal/TUI work)
        // Use backing store dimensions to match coordinate system of mouseX/mouseY
        const charHeight = engine.canvas.height / engine.height;
        const pixelY = engine.input.getMouseY();
        return Math.floor(pixelY / charHeight);
      },
      get mousePixelX() {
        // Alias for mouseX (pixel coordinates)
        return engine.input.getMouseX();
      },
      get mousePixelY() {
        // Alias for mouseY (pixel coordinates)
        return engine.input.getMouseY();
      },
      get termWidth() {
        return engine.width;
      },
      get termHeight() {
        return engine.height;
      },
      
      // Read-only state
      getFrame: () => this.frameCount,
      getTime: () => this.elapsedTime,
      getDelta: () => this.deltaTime,
      /** True while a video export is in progress. Use this to auto-start audio
       *  or skip user-interaction gating so the offline tick loop captures correctly. */
      get isExporting() { return engine._isExporting; },
      /** Function form of isExporting (more robust under SES scoping). */
      getIsExporting: () => engine._isExporting,

      /**
       * Seeded / random utilities — the same PRNG the engine uses internally.
       */
      random: {
        /**
         * Generate a cryptographically random uint32 seed.
         * Drop-in replacement for the `randomSeed()` boilerplate found in demos.
         */
        seed: (): number => {
          try {
            const a = new Uint32Array(1);
            globalThis.crypto.getRandomValues(a);
            return a[0] >>> 0;
          } catch {
            return (Math.random() * 0xffffffff) >>> 0;
          }
        },
        /**
         * Create a seeded PRNG using the mulberry32 algorithm — identical to
         * what the engine uses for stfxr / sfx graph noise generation.
         * Returns a `() => number` function that yields values in [0, 1).
         *
         * Example:
         *   const rng = random.rng(stfxrSeed);
         *   const x = rng(); // deterministic float in [0, 1)
         */
        rng: (seed: number): (() => number) => {
          const audioPack = getAudioPack();
          return audioPack ? audioPack.mulberry32(seed >>> 0) : (() => 0);
        },
        /**
         * Normalise any seed value (number or string) to a uint32 in the same
         * way the engine does before passing it to stfxr / sfx presets.
         * Strings are hashed with FNV-1a 32-bit; numbers are coerced with `>>> 0`.
         *
         * Example:
         *   random.toSeed('player1') // → stable uint32 every time
         *   random.toSeed(42.7)      // → 42
         */
        toSeed: (val: number | string): number => {
          const audioPack = getAudioPack();
          return audioPack ? audioPack.toSfxSeed(val) : 0;
        },
      },

      /**
       * Host system utilities — execute in the trusted engine context so
       * the SES sandbox never needs access to `document` or `URL`.
       */
      sys: {
        params: {
          get: (name: string, defaultValue?: string | number | boolean | null): string | number | boolean | null | undefined => {
            try {
              const search = globalThis.location?.search ?? '';
              const sp = new URLSearchParams(search);
              const raw = sp.get(String(name));
              if (raw === null) return defaultValue;
              const asNum = Number(raw);
              if (raw.trim() !== '' && Number.isFinite(asNum)) return asNum;
              const lower = raw.toLowerCase();
              if (lower === 'true') return true;
              if (lower === 'false') return false;
              return raw;
            } catch {
              return defaultValue;
            }
          },
        },
        /**
         * Trigger a browser "Save As" download with raw bytes.
         * Creates a temporary object URL, clicks a hidden anchor, then revokes.
         */
        download: (bytes: Uint8Array, filename: string, mime?: string): void => {
          try {
            // Slice to a plain ArrayBuffer so TypeScript's BlobPart types are satisfied
            // regardless of whether the Uint8Array sits on a SharedArrayBuffer.
            const ab   = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
            const blob = new Blob([ab], { type: mime ?? 'application/octet-stream' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = String(filename ?? 'download');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 10_000);
          } catch (e) {
            console.warn('[sys.download] failed:', e);
          }
        },
        parseTimed: (text: string, format?: string): Array<{ ms: number; text: string }> => {
          try {
            return parseTimedFormat(String(text ?? ''), (format ?? 'auto') as TimedFormat);
          } catch (e) {
            console.warn('[sys.parseTimed] failed:', e);
            return [];
          }
        },

        /**
         * Synthetic input injection.
         * Updates the engine's InputManager state AND dispatches an on:input event
         * to the current document handler (if any).
         *
         * This is designed for deterministic automation and works during video export
         * (real input is frozen during export).
         */
        input: {
          emit: (event: InputEvent): void => {
            try {
              if (!event || typeof event !== 'object') return;
              if (engine.hostAudienceView) return;

              // Keep key/mouse state queries (key.down, mouse.down, etc.) consistent.
              // applySyntheticEvent is tolerant to extra fields.
              // @ts-ignore
              engine.input.applySyntheticEvent(event as any);

              const doc = engine.getActiveDocument();
              if (!doc?.handlers?.input) return;

              engine.inputDispatchDepth++;
              try {
                const shouldContinue = doc.handlers.input(event);
                if (shouldContinue === false) engine.stop();
              } finally {
                engine.inputDispatchDepth = Math.max(0, engine.inputDispatchDepth - 1);
              }
            } catch (e) {
              console.warn('[sys.input.emit] failed:', e);
            }
          },
        },

        /**
         * Time-based automation helpers built around ```timed blocks.
         * These are pure/deterministic utilities: they compute values and
         * enumerate impulses; they do not execute user callbacks.
         */
        automation: {
          compile: (entries: Array<{ ms: number; text: string }>): CompiledAutomation => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.compileAutomation(entries);
            } catch (e) {
              console.warn('[sys.automation.compile] failed:', e);
              return { vars: {}, impulses: [] };
            }
          },
          valueAt: (compiled: CompiledAutomation, varName: string, timeSec: number, defaultValue: number = 0): number => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.valueAt(compiled, String(varName ?? ''), Number(timeSec) || 0, Number(defaultValue) || 0);
            } catch (e) {
              console.warn('[sys.automation.valueAt] failed:', e);
              return Number(defaultValue) || 0;
            }
          },
          impulsesBetween: (compiled: CompiledAutomation, prevTimeSec: number, nowTimeSec: number): AutomationImpulseEvent[] => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.impulsesBetween(compiled, Number(prevTimeSec) || 0, Number(nowTimeSec) || 0);
            } catch (e) {
              console.warn('[sys.automation.impulsesBetween] failed:', e);
              return [];
            }
          },
          parseEase: (raw: any): EaseSpec => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.parseEaseSpec(raw);
            } catch {
              return 'linear' as EaseSpec;
            }
          },
          ease: (u: number, spec?: EaseSpec): number => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.ease(Number(u) || 0, spec ?? 'linear');
            } catch {
              return 0;
            }
          },
          entryAt: <T extends { ms: number }>(entries: T[], timeSec: number): T | undefined => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.entryAt(entries, Number(timeSec) || 0);
            } catch {
              return undefined;
            }
          },
          entriesBetween: <T extends { ms: number }>(entries: T[], prevTimeSec: number, nowTimeSec: number): T[] => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.entriesBetween(entries, Number(prevTimeSec) || 0, Number(nowTimeSec) || 0);
            } catch {
              return [];
            }
          },
        },

        /**
         * General-purpose undo/redo history stack (command pattern).
         *
         * Example:
         *   const h = sys.history.create({ maxDepth: 64 });
         *   h.push({ label: 'move', do() { const old=pos; pos=newPos; return old; }, undo(s) { pos=s; } });
         *   h.undo(); h.redo();
         */
        history: {
          create: (opts?: { maxDepth?: number }): HistoryStack => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.createHistory(opts);
            } catch (e) {
              console.warn('[sys.history.create] failed:', e);
              // Return a no-op stub so existing code doesn't crash.
              return {
                push<S>(action: HistoryAction<S>): S { return action.do(); },
                undo() { return false; },
                redo() { return false; },
                canUndo() { return false; },
                canRedo() { return false; },
                clear() {},
                get depth() { return 0; },
                get undoLabel() { return undefined; },
                get redoLabel() { return undefined; },
              };
            }
          },
        },

        /**
         * Input recorder — captures InputEvents as a timestamped tape.
         * The tape serialises to the native timed-block format for playback
         * via sys.automation.
         *
         * Example:
         *   const rec = sys.recorder.create();
         *   // on:input → rec.record(event)
         *   // on key R → rec.stop() then sys.download(tape.serialize())
         */
        recorder: {
          create: (): InputRecorder => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.createInputRecorder();
            } catch (e) {
              console.warn('[sys.recorder.create] failed:', e);
              const noTape: RecordedTape = {
                toTimedEntries() { return []; },
                serialize() { return ''; },
                get durationMs() { return 0; },
                get length() { return 0; },
              };
              return {
                start() {},
                stop() { return noTape; },
                isRecording() { return false; },
                getElapsedMs() { return 0; },
                record() {},
              };
            }
          },
        },

        /**
         * BPM beat clock — converts between beat-space and wall-clock.
         * Integrates with sys.automation via toTimedEntries().
         *
         * Example:
         *   const clock = sys.beat.clock({ bpm: 128 });
         *   const track = sys.automation.compile(
         *     sys.beat.toTimedEntries(clock, doc.timedBlock('groove'))
         *   );
         *   const beat = sys.beat.beatAt(clock, getTime());
         */
        beat: {
          clock: (opts: BeatClockOptions): BeatClock => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.createBeatClock(opts);
            } catch (e) {
              console.warn('[sys.beat.clock] failed:', e);
              return engine.createFallbackBeatClock(opts);
            }
          },
          beatAt: (clock: BeatClock, timeSec: number): number => {
            try {
              return clock.beatAt(Number(timeSec) || 0);
            } catch { return 0; }
          },
          barAt: (clock: BeatClock, timeSec: number): number => {
            try {
              return clock.barAt(Number(timeSec) || 0);
            } catch { return 0; }
          },
          beatPhase: (clock: BeatClock, timeSec: number): number => {
            try {
              return clock.beatPhase(Number(timeSec) || 0);
            } catch { return 0; }
          },
          barPhase: (clock: BeatClock, timeSec: number): number => {
            try {
              return clock.barPhase(Number(timeSec) || 0);
            } catch { return 0; }
          },
          beatToMs: (clock: BeatClock, beat: number): number => {
            try {
              return clock.beatToMs(Number(beat) || 0);
            } catch { return 0; }
          },
          msToBeat: (clock: BeatClock, ms: number): number => {
            try {
              return clock.msToBeat(Number(ms) || 0);
            } catch { return 0; }
          },
          toTimedEntries: (clock: BeatClock, entries: Array<{ beat: number; text: string }>): Array<{ ms: number; text: string }> => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.beatToTimedEntries(clock, entries);
            } catch (e) {
              console.warn('[sys.beat.toTimedEntries] failed:', e);
              return [];
            }
          },
          parseBlock: (raw: Array<{ ms: number; text: string }>, clock?: BeatClock): Array<{ ms: number; text: string }> => {
            try {
              const pack = getAuthoredToolsPack();
              if (!pack) {
                engine.requestAuthoredToolsRuntimePack();
                throw new Error('Authored tools runtime pack is not loaded');
              }
              return pack.parseBeatTimedBlock(raw, clock);
            } catch (e) {
              console.warn('[sys.beat.parseBlock] failed:', e);
              return raw;
            }
          },
        },
      },

      /**
       * Safely read a URL query parameter by name.
       * Coerces the raw string to number / boolean / string automatically.
       * Returns `defaultValue` when the param is absent or the URL is inaccessible.
       */
      getParam: (name: string, defaultValue?: string | number | boolean | null): string | number | boolean | null | undefined => {
        try {
          const search = globalThis.location?.search ?? '';
          const sp = new URLSearchParams(search);
          const raw = sp.get(String(name));
          if (raw === null) return defaultValue;
          // Coerce to number if possible
          const asNum = Number(raw);
          if (raw.trim() !== '' && Number.isFinite(asNum)) return asNum;
          // Coerce to boolean
          const lower = raw.toLowerCase();
          if (lower === 'true') return true;
          if (lower === 'false') return false;
          // Return as string
          return raw;
        } catch {
          return defaultValue;
        }
      },
      
      // === NATIVE BROWSER APIs ===
      
      // Web Audio API (Phase 1) - Full exposure with shared instance
      audio: {
        asset: {
          load: async (url: string): Promise<AudioAssetHandle | null> => {
            const buffer = await engine.loadSoundFromUrl(url);
            if (!buffer) return null;
            return registerPortableAudioAsset(buffer, 'url', String(url ?? ''));
          },
          fromDrop: async (): Promise<AudioAssetHandle | null> => {
            const buffer = await engine.api.audio.loadSoundFromDrop();
            if (!buffer) return null;
            return registerPortableAudioAsset(buffer, 'drop', String(engine.lastDroppedFile?.name ?? 'drop'));
          },
          fromBlob: async (name: string, documentId?: string): Promise<AudioAssetHandle | null> => {
            const buffer = await loadSoundFromBlobCached(String(name ?? ''), documentId);
            if (!buffer) return null;
            return registerPortableAudioAsset(buffer, 'blob', String(name ?? ''));
          },
          info: (handleOrId: string | AudioAssetHandle): AudioAssetHandle | null => {
            const entry = resolvePortableAudioAsset(handleOrId);
            return entry ? cloneAudioAssetHandle(entry.handle) : null;
          },
        },
        analysis: {
          peaks: (handleOrId: string | AudioAssetHandle, options: PeakDetectionOptions = {}): PeakDetectionResult | null => {
            const entry = resolvePortableAudioAsset(handleOrId);
            if (!entry) return null;
            const audioPack = getAudioPack();
            return audioPack ? audioPack.detectPeaksFromAudioBuffer(entry.buffer, options) : null;
          },
          beats: (handleOrId: string | AudioAssetHandle, options: BeatDetectionOptions = {}): BeatAnalysisResult | null => {
            const entry = resolvePortableAudioAsset(handleOrId);
            if (!entry) return null;
            const audioPack = getAudioPack();
            return audioPack ? audioPack.analyzeBeatsFromAudioBuffer(entry.buffer, options) : null;
          },
        },
        play: (handleOrId: string | AudioAssetHandle, options?: { loop?: boolean; gain?: number; playbackRate?: number; when?: number; offsetSec?: number }): AudioVoiceHandle | null => {
          const entry = resolvePortableAudioAsset(handleOrId);
          if (!entry) return null;
          return createPortableAudioVoice(entry, options);
        },
        stop: (voiceOrId: string | AudioVoiceHandle, when?: number): boolean => {
          const entry = resolvePortableAudioVoice(voiceOrId);
          if (!entry) return false;
          if (entry.handle.startedAtSec !== null) {
            const stopAt = (typeof when === 'number' && Number.isFinite(when)) ? when : engine.audioContext.currentTime;
            const elapsed = Math.max(0, stopAt - entry.handle.startedAtSec);
            const advanced = elapsed * Math.max(0.01, entry.handle.playbackRate);
            entry.handle.offsetSec = entry.handle.loop
              ? ((entry.handle.offsetSec + advanced) % Math.max(entry.assetDurationSec, 0.000001))
              : Math.min(entry.assetDurationSec, entry.handle.offsetSec + advanced);
          }
          try {
            if (typeof when === 'number' && Number.isFinite(when)) entry.source.stop(when);
            else entry.source.stop();
          } catch {
            return false;
          }
          entry.handle.state = 'stopped';
          entry.handle.startedAtSec = null;
          return true;
        },
        setGain: (voiceOrId: string | AudioVoiceHandle, gain: number): boolean => {
          const entry = resolvePortableAudioVoice(voiceOrId);
          if (!entry || !Number.isFinite(gain)) return false;
          const next = Math.max(0, Number(gain));
          entry.gainNode.gain.value = next;
          entry.handle.gain = next;
          return true;
        },
        setPlaybackRate: (voiceOrId: string | AudioVoiceHandle, playbackRate: number): boolean => {
          const entry = resolvePortableAudioVoice(voiceOrId);
          if (!entry || !Number.isFinite(playbackRate)) return false;
          const next = Math.max(0.01, Number(playbackRate));
          entry.source.playbackRate.value = next;
          entry.handle.playbackRate = next;
          return true;
        },
        voiceInfo: (voiceOrId: string | AudioVoiceHandle): AudioVoiceHandle | null => {
          const entry = resolvePortableAudioVoice(voiceOrId);
          return entry ? cloneAudioVoiceHandle(entry.handle) : null;
        },
        resume: async (): Promise<boolean> => {
          try {
            await engine.audioContext.resume();
          } catch {
            // Ignore resume failures and report state below.
          }
          return engine.audioContext.state === 'running';
        },
        buffer: {
          create: (channels: number, frameCount: number, sampleRate?: number): AudioBuffer => {
            const nextChannels = Math.max(1, Math.floor(Number(channels) || 1));
            const nextFrameCount = Math.max(1, Math.floor(Number(frameCount) || 1));
            const nextSampleRate = Number.isFinite(sampleRate)
              ? Math.max(1, Math.floor(Number(sampleRate)))
              : engine.audioContext.sampleRate;
            return engine.audioContext.createBuffer(nextChannels, nextFrameCount, nextSampleRate);
          },
        },
        ambient: {
          createLayeredBed: (config) => {
            const ctx = engine.audioContext;
            const clampFinite = (value: unknown, fallback: number, min?: number) => {
              const next = Number(value);
              if (!Number.isFinite(next)) return fallback;
              if (typeof min === 'number') return Math.max(min, next);
              return next;
            };
            const createImpulseBuffer = (seconds: number, decay: number): AudioBuffer => {
              const sampleRate = ctx.sampleRate;
              const frameCount = Math.max(1, Math.floor(sampleRate * Math.max(0.001, seconds)));
              const impulse = ctx.createBuffer(2, frameCount, sampleRate);
              for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
                const data = impulse.getChannelData(channel);
                for (let i = 0; i < frameCount; i++) {
                  const t = 1 - i / frameCount;
                  data[i] = (Math.random() * 2 - 1) * Math.pow(t, Math.max(0.001, decay));
                }
              }
              return impulse;
            };
            const master = ctx.createGain();
            const dry = ctx.createGain();
            const wet = ctx.createGain();
            const compressor = ctx.createDynamicsCompressor();
            const convolver = ctx.createConvolver();
            const lfo = ctx.createOscillator();
            const lfoDepth = ctx.createGain();
            const sourceEntries: Array<{ source: AudioBufferSourceNode; offsetSec: number; durationSec: number }> = [];
            let started = false;
            let stopped = false;

            master.gain.value = clampFinite(config?.masterGain, 0);
            dry.gain.value = clampFinite(config?.dryGain, 1, 0);
            wet.gain.value = clampFinite(config?.wetGain, 0, 0);

            const impulseConfig = config?.impulse;
            convolver.buffer = impulseConfig?.buffer ?? createImpulseBuffer(
              clampFinite(impulseConfig?.seconds, 1.2, 0.001),
              clampFinite(impulseConfig?.decay, 2.5, 0.001),
            );

            compressor.threshold.value = clampFinite(config?.compressor?.threshold, -24);
            compressor.knee.value = clampFinite(config?.compressor?.knee, 18, 0);
            compressor.ratio.value = clampFinite(config?.compressor?.ratio, 2, 1);
            compressor.attack.value = clampFinite(config?.compressor?.attack, 0.02, 0);
            compressor.release.value = clampFinite(config?.compressor?.release, 0.25, 0);

            dry.connect(compressor);
            wet.connect(convolver);
            convolver.connect(compressor);
            compressor.connect(master);
            master.connect(ctx.destination);

            lfo.type = config?.lfo?.type ?? 'sine';
            lfo.frequency.value = clampFinite(config?.lfo?.frequencyHz, 0.1, 0.001);
            lfoDepth.gain.value = clampFinite(config?.lfo?.depth, 0, 0);
            lfo.connect(lfoDepth);
            lfoDepth.connect(master.gain);

            const layers = Array.isArray(config?.layers) ? config.layers : [];
            for (const layer of layers) {
              if (!layer?.buffer) continue;
              const source = ctx.createBufferSource();
              source.buffer = layer.buffer;
              source.loop = !!layer.loop;
              const routes = Array.isArray(layer.routes) ? layer.routes : [];
              for (const route of routes) {
                const highpass = ctx.createBiquadFilter();
                const lowpass = ctx.createBiquadFilter();
                const routeGain = ctx.createGain();
                highpass.type = 'highpass';
                highpass.frequency.value = clampFinite(route?.hp, 0, 0);
                highpass.Q.value = clampFinite(route?.hpQ, 0.0001, 0.0001);
                lowpass.type = 'lowpass';
                lowpass.frequency.value = clampFinite(route?.lp, ctx.sampleRate / 2, 0);
                lowpass.Q.value = clampFinite(route?.lpQ, 0.0001, 0.0001);
                routeGain.gain.value = clampFinite(route?.gain, 1, 0);
                source.connect(highpass);
                highpass.connect(lowpass);
                lowpass.connect(routeGain);
                routeGain.connect(route?.bus === 'wet' ? wet : dry);
              }
              sourceEntries.push({
                source,
                offsetSec: clampFinite(layer.offsetSec, 0, 0),
                durationSec: Math.max(0.000001, source.buffer.duration || 0.000001),
              });
            }

            const beginPlayback = () => {
              if (started || stopped) return started;
              for (const entry of sourceEntries) {
                try {
                  entry.source.start(ctx.currentTime, entry.offsetSec % entry.durationSec);
                } catch {
                  entry.source.start();
                }
              }
              try {
                lfo.start(ctx.currentTime);
              } catch {
                lfo.start();
              }
              started = true;
              return true;
            };

            return {
              start: async (): Promise<boolean> => {
                if (stopped) return false;
                engine.runOrQueueGestureAudioStart(beginPlayback);
                if (started) {
                  try {
                    await ctx.resume();
                  } catch {
                    // Ignore resume failures.
                  }
                  return ctx.state === 'running';
                }
                if (ctx.state === 'running') return beginPlayback();
                try {
                  await ctx.resume();
                } catch {
                  // Ignore resume failures.
                }
                if (started) return true;
                if (String(ctx.state) !== 'running') return false;
                return beginPlayback();
              },
              stop: (when?: number) => {
                if (stopped) return;
                stopped = true;
                const stopAt = (typeof when === 'number' && Number.isFinite(when)) ? when : undefined;
                for (const entry of sourceEntries) {
                  try {
                    if (stopAt !== undefined) entry.source.stop(stopAt);
                    else entry.source.stop();
                  } catch {
                    // Ignore stop failures.
                  }
                }
                try {
                  if (stopAt !== undefined) lfo.stop(stopAt);
                  else lfo.stop();
                } catch {
                  // Ignore stop failures.
                }
              },
              setLevel: (level: number, rampSeconds?: number, lfoDepthTarget?: number) => {
                const now = ctx.currentTime;
                const nextLevel = clampFinite(level, 0, 0);
                const nextRamp = Math.max(0.01, clampFinite(rampSeconds, 0.6, 0));
                const nextLfoDepth = clampFinite(lfoDepthTarget, lfoDepth.gain.value, 0);
                master.gain.cancelScheduledValues(now);
                master.gain.setValueAtTime(master.gain.value, now);
                master.gain.linearRampToValueAtTime(nextLevel, now + nextRamp);
                lfoDepth.gain.cancelScheduledValues(now);
                lfoDepth.gain.setValueAtTime(lfoDepth.gain.value, now);
                lfoDepth.gain.linearRampToValueAtTime(nextLfoDepth, now + nextRamp);
              },
              isStarted: () => started,
            };
          },
        },
        // === SHARED INSTANCE (Full Web Audio API) ===
        get context() { return engine.audioContext; },
        startOnGesture: (start: () => void): boolean => {
          if (typeof start !== 'function') return false;
          const startedNow = engine.runOrQueueGestureAudioStart(() => {
            start();
          });
          if (!startedNow) engine.audioContext.resume().catch(() => {});
          return startedNow;
        },
        
        // === HELPERS (Use same AudioContext) ===
        playTone: (frequency: number, duration: number, volume: number = 0.5) => {
          const osc = this.audioContext.createOscillator();
          const gain = this.audioContext.createGain();
          
          osc.frequency.value = frequency;
          gain.gain.value = volume;
          
          osc.connect(gain);
          gain.connect(this.audioContext.destination);

          engine.runOrQueueGestureAudioStart(() => {
            const now = engine.audioContext.currentTime;
            try {
              osc.start(now);
            } catch {
              osc.start();
            }
            try {
              osc.stop(now + Math.max(0, duration));
            } catch {
              try {
                osc.stop();
              } catch {
                // ignore
              }
            }
          });
          engine.audioContext.resume().catch(() => {});
          
          return { osc, gain }; // Return for user control
        },
        
        /**
         * Decode a same-origin audio asset through the trusted host.
         * Sandboxed code cannot fetch directly; this keeps URL validation in the engine.
         */
        loadSound: async (url: string): Promise<AudioBuffer | null> => {
          return await engine.loadSoundFromUrl(url);
        },

        /**
         * Decode the currently dropped file (if any) into an AudioBuffer.
         * This is a safe alternative to URL loading: no network access.
         */
        loadSoundFromDrop: async (): Promise<AudioBuffer | null> => {
          const dropped = engine.lastDroppedFile;
          const bytes = dropped?.bytes ?? null;
          if (!bytes) return null;

          const mime = String(dropped?.mime ?? '');
          if (mime && !mime.startsWith('audio/')) {
            console.warn(`[audio.loadSoundFromDrop] Dropped file "${String(dropped?.name ?? '')}" has non-audio mime "${mime}"; attempting decode anyway.`);
          }

          try {
            const ab = toExactArrayBuffer(bytes);
            return await engine.audioContext.decodeAudioData(ab);
          } catch (e) {
            console.warn('[audio.loadSoundFromDrop] Failed to decode dropped audio:', e);
            return null;
          }
        },

        /**
         * Decode an embedded ```blob block into an AudioBuffer.
         * Intended for small SFX (WAV/MP3). Returns null on failure.
         */
        loadSoundFromBlob: async (name: string, documentId?: string): Promise<AudioBuffer | null> => {
          return await loadSoundFromBlobCached(name, documentId);
        },
        
        playBuffer: (buffer: AudioBuffer, options: {
          loop?: boolean;
          volume?: number;
          playbackRate?: number;
        } = {}): AudioBufferSourceNode => {
          const source = this.audioContext.createBufferSource();
          const gain = this.audioContext.createGain();
          
          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;
          
          source.connect(gain);
          gain.connect(this.audioContext.destination);
          engine.runOrQueueGestureAudioStart(() => {
            const when = engine.audioContext.currentTime;
            try {
              source.start(when);
            } catch {
              source.start();
            }
          });
          engine.audioContext.resume().catch(() => {});
          
          return source; // User can stop/modify
        },

        /**
         * Convenience: decode and play the currently dropped file as audio.
         * Returns the started AudioBufferSourceNode, or null if decode fails.
         */
        playDrop: async (options: {
          loop?: boolean;
          volume?: number;
          playbackRate?: number;
          when?: number;
          destination?: AudioNode;
        } = {}): Promise<AudioBufferSourceNode | null> => {
          const dropped = engine.lastDroppedFile;
          const bytes = dropped?.bytes ?? null;
          if (!bytes) return null;

          const mime = String(dropped?.mime ?? '');
          if (mime && !mime.startsWith('audio/')) {
            console.warn(`[audio.playDrop] Dropped file "${String(dropped?.name ?? '')}" has non-audio mime "${mime}"; attempting decode anyway.`);
          }

          let buffer: AudioBuffer | null = null;
          try {
            const ab = toExactArrayBuffer(bytes);
            buffer = await engine.audioContext.decodeAudioData(ab);
          } catch (e) {
            console.warn('[audio.playDrop] Failed to decode dropped audio:', e);
            buffer = null;
          }

          if (!buffer) return null;

          const source = engine.audioContext.createBufferSource();
          const gain = engine.audioContext.createGain();
          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;
          source.connect(gain);
          gain.connect(options.destination ?? engine.audioContext.destination);
          engine.runOrQueueGestureAudioStart(() => {
            const when = (typeof options.when === 'number' && Number.isFinite(options.when))
              ? options.when
              : engine.audioContext.currentTime;
            try {
              source.start(when);
            } catch {
              source.start();
            }
          });
          engine.audioContext.resume().catch(() => {});
          return source;
        },

        /**
         * Offline peak detection for a decoded AudioBuffer.
         * Returns peak timestamps (seconds) and the smoothed envelope.
         * Dependency-free and deterministic.
         */
        peaksFromBuffer: (buffer: AudioBuffer, options: PeakDetectionOptions = {}): PeakDetectionResult => {
          const audioPack = getAudioPack();
          return audioPack
            ? audioPack.detectPeaksFromAudioBuffer(buffer, options)
            : { peaks: [], envelopeHz: buffer.sampleRate, envelope: new Float32Array(0), threshold: 0 };
        },

        /**
         * Offline beat grid analysis for a decoded AudioBuffer.
         * Currently assumes 4/4 by default, but returns a `meter` field for future meter detection.
         */
        beatsFromBuffer: (buffer: AudioBuffer, options: BeatDetectionOptions = {}): BeatAnalysisResult => {
          const audioPack = getAudioPack();
          return audioPack
            ? audioPack.analyzeBeatsFromAudioBuffer(buffer, options)
            : {
                bpm: 0,
                confidence: 0,
                meter: 4,
                periodSec: 0,
                offsetSec: 0,
                beats: [],
                downbeats: [],
                envelopeHz: buffer.sampleRate,
                envelope: new Float32Array(0)
              };
        },

        /**
         * Convert an offline beat analysis into a "what beat are we on" state.
         * Pass prevTimeSec to get edge flags when crossing beat boundaries.
         */
        beatState: (analysis: BeatAnalysisResult, timeSec: number, prevTimeSec?: number): BeatState => {
          const audioPack = getAudioPack();
          return audioPack
            ? audioPack.getBeatState(analysis, timeSec, prevTimeSec)
            : {
                bpm: analysis.bpm,
                meter: analysis.meter,
                periodSec: analysis.periodSec,
                offsetSec: analysis.offsetSec,
                timeSec,
                beatIndex: 0,
                beatInBar: 1,
                barIndex: 0,
                beatFloat: 0,
                beatPhase: 0,
                barPhase: 0,
                nextBeatSec: analysis.offsetSec,
                nextDownbeatSec: analysis.offsetSec,
                isBeatEdge: false,
                isDownbeatEdge: false,
              };
        },

        /**
         * Realtime FFT/analyser helper for visualizers.
         * Users can still use the raw WebAudio AnalyserNode directly, but this
         * provides convenient typed-array buffers and band-energy helpers.
         */
        fft: {
          createAnalyser: (options: {
            fftSize?: number;
            smoothing?: number;
            minDecibels?: number;
            maxDecibels?: number;
          } = {}) => {
            const analyser = this.audioContext.createAnalyser();
            if (typeof options.fftSize === 'number' && Number.isFinite(options.fftSize)) {
              try { analyser.fftSize = Math.max(32, Math.floor(options.fftSize)); } catch { /* ignore */ }
            }
            if (typeof options.smoothing === 'number' && Number.isFinite(options.smoothing)) {
              analyser.smoothingTimeConstant = Math.max(0, Math.min(1, options.smoothing));
            }
            if (typeof options.minDecibels === 'number' && Number.isFinite(options.minDecibels)) {
              analyser.minDecibels = options.minDecibels;
            }
            if (typeof options.maxDecibels === 'number' && Number.isFinite(options.maxDecibels)) {
              analyser.maxDecibels = options.maxDecibels;
            }

            const freqBytes = new Uint8Array(analyser.frequencyBinCount);
            const freqFloats = new Float32Array(analyser.frequencyBinCount);
            const timeBytes = new Uint8Array(analyser.fftSize);
            const timeFloats = new Float32Array(analyser.fftSize);

            const api = {
              analyser,
              binHz: () => this.audioContext.sampleRate / analyser.fftSize,
              connectFrom: (node: AudioNode) => {
                try { node.connect(analyser); } catch { /* ignore */ }
                return api;
              },
              connectTo: (node: AudioNode) => {
                try { analyser.connect(node); } catch { /* ignore */ }
                return api;
              },
              getFrequencyBytes: () => {
                analyser.getByteFrequencyData(freqBytes);
                return freqBytes;
              },
              getFrequencyFloats: () => {
                analyser.getFloatFrequencyData(freqFloats);
                return freqFloats;
              },
              getTimeDomainBytes: () => {
                analyser.getByteTimeDomainData(timeBytes);
                return timeBytes;
              },
              getTimeDomainFloats: () => {
                analyser.getFloatTimeDomainData(timeFloats);
                return timeFloats;
              },
              /**
               * Compute simple band energies (0..1-ish) from current float frequency data.
               * Bands are given in Hz: [{ fromHz, toHz }, ...]
               */
              getBands: (bands: Array<{ fromHz: number; toHz: number }>) => {
                analyser.getFloatFrequencyData(freqFloats);
                const binHz = this.audioContext.sampleRate / analyser.fftSize;
                const out: number[] = [];
                for (const b of bands) {
                  const from = Math.max(0, Math.min(b.fromHz, b.toHz));
                  const to = Math.max(0, Math.max(b.fromHz, b.toHz));
                  const i0 = Math.max(0, Math.floor(from / binHz));
                  const i1 = Math.min(freqFloats.length - 1, Math.ceil(to / binHz));
                  let sum = 0;
                  let count = 0;
                  for (let i = i0; i <= i1; i++) {
                    const db = freqFloats[i];
                    // Convert dBFS to linear magnitude (roughly 0..1).
                    const lin = Math.pow(10, db / 20);
                    sum += lin;
                    count++;
                  }
                  out.push(count > 0 ? sum / count : 0);
                }
                return out;
              }
            };

            return api;
          }
        },

        /**
         * Convenience: decode and play an embedded audio blob by name.
         * Returns the started AudioBufferSourceNode, or null if decode fails.
         */
        playBlob: async (
          name: string,
          options: {
            loop?: boolean;
            volume?: number;
            playbackRate?: number;
            when?: number;
            destination?: AudioNode;
          } = {},
          documentId?: string
        ): Promise<AudioBufferSourceNode | null> => {
          const buffer = await loadSoundFromBlobCached(String(name ?? ''), documentId);
          if (!buffer) return null;

          const source = this.audioContext.createBufferSource();
          const gain = this.audioContext.createGain();

          source.buffer = buffer;
          source.loop = options.loop || false;
          source.playbackRate.value = options.playbackRate || 1.0;
          gain.gain.value = options.volume !== undefined ? options.volume : 1.0;

          source.connect(gain);
          gain.connect(options.destination ?? this.audioContext.destination);

          engine.runOrQueueGestureAudioStart(() => {
            const when = (typeof options.when === 'number' && Number.isFinite(options.when))
              ? options.when
              : engine.audioContext.currentTime;
            try {
              source.start(when);
            } catch {
              // Fallback: start immediately.
              source.start();
            }
          });
          engine.audioContext.resume().catch(() => {});
          return source;
        },
        
        // === RAW API SHORTCUTS (Use same AudioContext) ===
        createOscillator: () => this.audioContext.createOscillator(),
        createGain: () => this.audioContext.createGain(),
        createBiquadFilter: () => this.audioContext.createBiquadFilter(),
        createDelay: () => this.audioContext.createDelay(),
        createConvolver: () => this.audioContext.createConvolver(),
        createDynamicsCompressor: () => this.audioContext.createDynamicsCompressor(),
        createAnalyser: () => this.audioContext.createAnalyser(),
        createBufferSource: () => this.audioContext.createBufferSource(),
        createPanner: () => this.audioContext.createPanner(),
        createStereoPanner: () => this.audioContext.createStereoPanner(),

        /**
         * Capture an AudioBuffer (and optional start offset) for inclusion in
         * the current video export. Call this every on:update frame while
         * isExporting is true. The export panel reads it via engine.getExportAudioBuffer().
         *
         * Only has effect while an export is in progress; safe to call at any time.
         */
        captureForExport: (buffer: AudioBuffer, offsetSec: number = 0): void => {
          engine.setExportAudioBuffer(buffer, offsetSec);
        },

        /**
         * Read back the currently latched export audio buffer (if any).
         * Useful for export-time animation even when the demo's on:drop hasn't
         * decoded/analysed yet.
         */
        getCapturedForExport: (): { buffer: AudioBuffer; offsetSec: number } | null => {
          return engine.getExportAudioBuffer();
        },
        createWaveShaper: () => this.audioContext.createWaveShaper(),

        // === SEEDED SFX HELPERS (Chiptone basics) ===
        sfx: {
          names: () => {
            const audioPack = getAudioPack();
            return audioPack ? audioPack.getSfxPresetNames() : [];
          },
          play: (presetName, seed, options) => {
            const audioPack = getAudioPack();
            if (!audioPack) return { stop: () => {} };
            return audioPack.playSfx(this.audioContext, presetName, seed, options);
          },
          snippet: (presetName, seed, volume) => {
            const audioPack = getAudioPack();
            return audioPack ? audioPack.sfxSnippet(presetName, seed, volume) : '';
          }
        },
        
        // === PROPERTIES ===
        get currentTime() { return engine.audioContext.currentTime; },
        get sampleRate() { return engine.audioContext.sampleRate; },
        get destination() { return engine.audioContext.destination; },
        get state() { return engine.audioContext.state; }
      },
      
      // Canvas 2D API (Phase 2) - Full exposure with shared instance
      canvas2d: {
        // === SHARED INSTANCE ===
        get context() {
          return engine.ensureCanvas2D();
        },
        
        // === HELPERS ===
        clear: (color?: string) => {
          const ctx = engine.ensureCanvas2D();
          const canvas = engine.offscreenCanvas2D;
          if (!ctx || !canvas) return;
          
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        },
        
        drawRect: (x: number, y: number, w: number, h: number, color: string, filled: boolean = true) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          
          if (filled) {
            ctx.fillRect(x, y, w, h);
          } else {
            ctx.strokeRect(x, y, w, h);
          }
        },
        
        drawCircle: (x: number, y: number, radius: number, color: string, filled: boolean = true) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.strokeStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          
          if (filled) {
            ctx.fill();
          } else {
            ctx.stroke();
          }
        },
        
        drawLine: (x1: number, y1: number, x2: number, y2: number, color: string, lineWidth: number = 1) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        },
        
        drawImage: (image: HTMLImageElement | ImageBitmap | HTMLCanvasElement, x: number, y: number, w?: number, h?: number) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          if (w !== undefined && h !== undefined) {
            ctx.drawImage(image, x, y, w, h);
          } else {
            ctx.drawImage(image, x, y);
          }
        },

        drawBorder: (spec: DecorativeBorderSpec, x: number, y: number, w: number, h: number) => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx || !spec || typeof spec !== 'object') return false;
          if (spec.kind !== 'image9') return false;
          const image = engine.ensureRenderableImageLoaded(spec.source);
          if (!image) return false;
          ctx.save();
          ctx.translate(x, y);
          try {
            return drawDecorativeBorder(ctx, image, spec, w, h);
          } finally {
            ctx.restore();
          }
        },
        
        text: (text: string, x: number, y: number, color: string, font: string = '16px sans-serif') => {
          const ctx = engine.ensureCanvas2D();
          if (!ctx) return;
          
          ctx.fillStyle = color;
          ctx.font = font;
          ctx.fillText(text, x, y);
        },
        
        // NOTE: URL-based image loading is intentionally not exposed to sandboxed
        // user code. Use `ui.loadImageFromBlob()` instead.
        
        // === CONVENIENCE PROPERTIES ===
        get width() {
          engine.ensureCanvas2D();
          return engine.offscreenCanvas2D?.width || 0;
        },
        get height() {
          engine.ensureCanvas2D();
          return engine.offscreenCanvas2D?.height || 0;
        }
      },

      // WebGPU UI API (GPU-native immediate-mode helpers)
      ui: {
        pointer: {
          x: () => {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            return ctx !== null ? ctx.localMouseX : engine.input.getMouseX();
          },
          y: () => {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            return ctx !== null ? ctx.localMouseY : engine.input.getMouseY();
          },
          down: (button: number = 0) => engine.input.isMouseDown(button),
          clicked: (button: number = 0) => {
            if (!engine.input.isMouseClicked(button)) return false;
            // For live sections in the input context, only register a click if the
            // screen-space click position actually landed on the projected section quad.
            // This prevents accidental button activations when clicking elsewhere.
            const inputCtx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            if (inputCtx !== null) {
              const lx = inputCtx.localMouseX;
              const ly = inputCtx.localMouseY;
              // If the reprojected coords are within the section texture bounds, the
              // click was on the section. A small margin handles border pixels.
              const margin = 4;
              return lx >= -margin && lx < inputCtx.width + margin &&
                     ly >= -margin && ly < inputCtx.height + margin;
            }
            // If we are inside a live section's update phase but the context isn't
            // available yet (first frame before first bake), suppress clicks to
            // prevent false activations from the navigation click.
            const curSectionIdx = engine.getResolvedCurrent3DSectionIndex();
            if (typeof curSectionIdx === 'number' && engine._liveSections.has(curSectionIdx)) {
              return false;
            }
            return true;
          }
        },
        metrics: {
          get canvasWidth() {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            return ctx?.width ?? engine.canvas.width;
          },
          get canvasHeight() {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            return ctx?.height ?? engine.canvas.height;
          },
          get safeAreaInsets() { return engine.getSafeAreaInsetsCss(); },
          measureTextWidth(text: string) {
            const value = String(text ?? '');
            const ui = engine.ensureWebGPUUI();
            if (ui && typeof ui.measureTextWidth === 'function') {
              const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
              return ui.measureTextWidth(value) / Math.max(1, ctx?.baseMetricScale ?? 1);
            }

            const atlas = engine.renderer instanceof WebGPURenderer ? engine.renderer.getAtlas() : null;
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            const metricScale = Math.max(1, ctx?.baseMetricScale ?? 1);
            const charW = (atlas?.getCharWidth() ?? 10) / metricScale;
            if (!atlas) return value.length * charW;

            let total = 0;
            for (const ch of value) {
              const glyph = atlas.getGlyph(ch);
              total += Math.max(charW, (glyph.pixelWidth || 0) / metricScale);
            }
            return total;
          },
          get charWidth() {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            const metricScale = Math.max(1, ctx?.baseMetricScale ?? 1);
            return engine.renderer instanceof WebGPURenderer
              ? engine.renderer.getAtlas().getCharWidth() / metricScale
              : 0;
          },
          get charHeight() {
            const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
            const metricScale = Math.max(1, ctx?.baseMetricScale ?? 1);
            return engine.renderer instanceof WebGPURenderer
              ? engine.renderer.getAtlas().getCharHeight() / metricScale
              : 0;
          }
        },
        /**
         * Dimensions of the current live section texture during an on:render
         * section bake. Returns { width: 0, height: 0, isLive: false } when
         * called outside of a live section render context.
         */
        section: {
          get width() { return (engine._liveRenderCtx ?? engine._liveSectionInputCtx)?.width ?? 0; },
          get height() { return (engine._liveRenderCtx ?? engine._liveSectionInputCtx)?.height ?? 0; },
          get isLive() { return engine._liveRenderCtx !== null || engine._liveSectionInputCtx !== null; },
        },
        clear: (color?: Color) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.setClearColor(color);
        },
        /**
         * Set material properties for all subsequent draw calls (rect / text / image).
         * Behaves like a colour setting — sticky until overridden, not one-shot.
         * The values are written into the material render target so post-process
         * lighting shaders can perform per-pixel PBR shading.
         *
         * Pass `null` to reset to defaults (roughness=0.5, normalScale=1.0, metallic=0, emissive=0).
         *
         * All values are clamped to [0, 1].
         */
        setMaterial: (mat: { roughness?: number; normalScale?: number; metallic?: number; emissive?: number } | null) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.setMaterial(mat);
        },
        rect: (x: number, y: number, w: number, h: number, color: Color) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;
          ui.rect(x * s, y * s, w * s, h * s, color);
        },
        text: (text: string, x: number, y: number, color: Color, scale?: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const textureScale = ctx?.textureScale ?? 1;
          const metricScale = Math.max(1, ctx?.baseMetricScale ?? 1);
          const scaledText = scale !== undefined
            ? scale * (textureScale / metricScale)
            : (ctx ? (textureScale / metricScale) : undefined);
          ui.text(text, x * textureScale, y * textureScale, color, scaledText);
        },

        // NOTE: URL-based image loading is intentionally not exposed to sandboxed
        // user code. Use `ui.loadImageFromBlob()` instead.

        /**
         * Load an image from an embedded ```blob block by name.
         * The blob should be base64-encoded PNG/JPEG (mime:image/png or mime:image/jpeg).
         */
        loadImageFromBlob: async (name: string, documentId?: string): Promise<string | null> => {
          return await loadImageFromBlobInternal(name, documentId);
        },

        /**
         * Load an image from a same-origin URL (e.g. "assets/img/texture.jpg").
         * In untrusted mode only relative URLs under "assets/img/" are allowed.
         * Returns a stable imageId that can be passed to `ui.image()`, or null on failure.
         */
        loadImageFromURL: async (url: string): Promise<string | null> => {
          return await engine.loadUIImageFromUrl(url, () => `uiurl_${nextUIImageId++}`);
        },

        /**
         * Get the pixel dimensions of a previously loaded image by its id.
         * Returns null if the image has not been registered yet.
         */
        getImageSize: (imageId: string): { width: number; height: number } | null => {
          const key = String(imageId ?? '');
          if (!key) return null;
          // If the image is pending lazy-registration (decoded before GPU was ready),
          // return its natural dimensions directly from the source object.
          const pending = engine.uiImagePending.get(key);
          if (pending) {
            const w = (pending as any).width ?? (pending as any).naturalWidth ?? 0;
            const h = (pending as any).height ?? (pending as any).naturalHeight ?? 0;
            if (w > 0 && h > 0) return { width: w, height: h };
          }
          const ui = engine.ensureWebGPUUI();
          if (!ui) return null;
          return ui.getImageSize(key);
        },

        /**
         * Draw a loaded image by id.
         */
        image: (imageId: string, x: number, y: number, w: number, h: number, options?: { tint?: Color; uv?: { u: number; v: number; w: number; h: number } }) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;

          const key = String(imageId ?? '');
          if (!key) return;

          // Lazy-register any images that were decoded before the WebGPU UI was ready.
          const pending = engine.uiImagePending.get(key);
          if (pending) {
            ui.registerImage(key, pending);
            engine.uiImagePending.delete(key);
          }

          // Fast path: draw if already registered.
          if (ui.getImageSize(key)) {
            ui.image(key, x * s, y * s, w * s, h * s, options);
            return;
          }

          // If not registered, treat `imageId` as a blob name and auto-load in the background.
          const cache = getUIBlobImageCache();
          if (!cache) return;

          const resolved = cache.resolved.get(key);
          if (resolved && ui.getImageSize(resolved)) {
            ui.image(resolved, x * s, y * s, w * s, h * s, options);
            return;
          }

          if (cache.failed.has(key)) return;
          if (cache.inFlight.has(key)) return;

          const store = getBlobStore();
          const entry = store?.get(key) ?? null;
          if (!entry) return;
          const mime = String(entry.mime ?? '');
          if (!mime.startsWith('image/')) return;

          const promise = loadImageFromBlobInternal(key)
            .then((id) => {
              cache.inFlight.delete(key);
              if (id) {
                cache.resolved.set(key, id);
              } else {
                cache.failed.add(key);
              }
              return id;
            })
            .catch((_e) => {
              cache.inFlight.delete(key);
              cache.failed.add(key);
              return null;
            });

          cache.inFlight.set(key, promise);
        },
        pushClipRect: (x: number, y: number, w: number, h: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;
          ui.pushClipRect(x * s, y * s, w * s, h * s);
        },
        popClipRect: () => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.popClipRect();
        },
        pushMaskRect: (x: number, y: number, w: number, h: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;
          ui.pushMaskRect(x * s, y * s, w * s, h * s);
        },
        pushMaskRoundedRect: (x: number, y: number, w: number, h: number, radius: number) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;
          ui.pushMaskRoundedRect(x * s, y * s, w * s, h * s, radius * s);
        },
        pushMaskPolygon: (points: Array<{ x: number; y: number }>) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          const ctx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const s = ctx?.textureScale ?? 1;
          ui.pushMaskPolygon(points.map((point) => ({ x: point.x * s, y: point.y * s })));
        },
        popMask: () => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return;
          ui.popMask();
        },
        button: (_id: string, x: number, y: number, w: number, h: number, label: string) => {
          const ui = engine.ensureWebGPUUI();
          if (!ui) return false;

          // Use section-local pointer coordinates when inside a live section bake
          // or input context so that hit testing is in the same space as the draw commands.
          const _ptrCtx = engine._liveRenderCtx ?? engine._liveSectionInputCtx;
          const textureScale = _ptrCtx?.textureScale ?? 1;
          const metricScale = Math.max(1, _ptrCtx?.baseMetricScale ?? 1);
          const mx = _ptrCtx !== null ? _ptrCtx.localMouseX : engine.input.getMouseX();
          const my = _ptrCtx !== null ? _ptrCtx.localMouseY : engine.input.getMouseY();
          const hovered = mx >= x && mx < (x + w) && my >= y && my < (y + h);
          const clicked = hovered && engine.input.isMouseClicked(0);

          const base = engine.getStyle('button');
          const border = engine.getStyle('border');
          const fg = base.fg;
          const bg = hovered ? engine.currentTheme.accent1 : base.bg;

          // Background + border
          ui.rect(x * textureScale, y * textureScale, w * textureScale, h * textureScale, bg);
          ui.rect(x * textureScale, y * textureScale, w * textureScale, Math.max(1, textureScale), border.fg);
          ui.rect(x * textureScale, (y + h - 1) * textureScale, w * textureScale, Math.max(1, textureScale), border.fg);
          ui.rect(x * textureScale, y * textureScale, Math.max(1, textureScale), h * textureScale, border.fg);
          ui.rect((x + w - 1) * textureScale, y * textureScale, Math.max(1, textureScale), h * textureScale, border.fg);

          // Center label (monospace advance)
          const atlas = (engine.renderer instanceof WebGPURenderer) ? engine.renderer.getAtlas() : null;
          const charW = atlas ? (atlas.getCharWidth() / metricScale) : 10;
          const charH = atlas ? (atlas.getCharHeight() / metricScale) : 16;
          let labelW = label.length * charW;
          if (ui && typeof ui.measureTextWidth === 'function') {
            labelW = ui.measureTextWidth(label) / metricScale;
          }
          const tx = x + Math.max(0, (w - labelW) / 2);
          const ty = y + Math.max(0, (h - charH) / 2);
          ui.text(label, tx * textureScale, ty * textureScale, fg, textureScale / metricScale);

          return clicked;
        },
        colors: {
          rgb: ColorUtils.rgb,
          rgba: ColorUtils.rgba,
          from: ColorUtils.from
        },
        get available() {
          return engine.renderer instanceof WebGPURenderer;
        }
      },
      
      // WebGL API (Phase 3) - Selective exposure with shared context
      webgl: {
        // === SHARED INSTANCE (lazy init) ===
        get context() { return engine.getWebGLContext(); },
        
        // === HELPERS ===
        createShader: (type: 'vertex' | 'fragment', source: string): WebGLShader | null => {
          const gl = this.getWebGLContext();
          if (!gl) return null;
          
          const shaderType = type === 'vertex' ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER;
          const shader = gl.createShader(shaderType);
          if (!shader) return null;
          
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
          }
          
          return shader;
        },
        
        createProgram: (vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null => {
          const gl = this.getWebGLContext();
          if (!gl) return null;
          
          const program = gl.createProgram();
          if (!program) return null;
          
          gl.attachShader(program, vertexShader);
          gl.attachShader(program, fragmentShader);
          gl.linkProgram(program);
          
          if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return null;
          }
          
          return program;
        },
        
        get available() { return engine.getWebGLContext() !== null; }
      },
      
      // WebGPU API (Phase 4) - Controlled access with safety guardrails
      webgpu: {
        // === CONTROLLED DEVICE ACCESS ===
        get device(): GPUDevice | null {
          // In untrusted mode, do not expose the raw device: it bypasses guardrails
          // (scripts could allocate arbitrarily via device.createBuffer/Texture).
          return engine.untrustedContent ? null : engine.webgpuDevice;
        },
        
        get available(): boolean {
          return engine.webgpuDevice !== null;
        },
        
        // === INITIALIZATION ===
        init: async (): Promise<boolean> => {
          return await engine.initWebGPU();
        },
        
        // === WEBGPU CONSTANTS ===
        // Buffer usage flags
        get GPUBufferUsage() {
          return typeof GPUBufferUsage !== 'undefined' ? GPUBufferUsage : {
            MAP_READ: 0x0001,
            MAP_WRITE: 0x0002,
            COPY_SRC: 0x0004,
            COPY_DST: 0x0008,
            INDEX: 0x0010,
            VERTEX: 0x0020,
            UNIFORM: 0x0040,
            STORAGE: 0x0080,
            INDIRECT: 0x0100,
            QUERY_RESOLVE: 0x0200
          };
        },
        
        // Texture usage flags
        get GPUTextureUsage() {
          return typeof GPUTextureUsage !== 'undefined' ? GPUTextureUsage : {
            COPY_SRC: 0x01,
            COPY_DST: 0x02,
            TEXTURE_BINDING: 0x04,
            STORAGE_BINDING: 0x08,
            RENDER_ATTACHMENT: 0x10
          };
        },
        
        // Shader stage flags
        get GPUShaderStage() {
          return typeof GPUShaderStage !== 'undefined' ? GPUShaderStage : {
            VERTEX: 0x1,
            FRAGMENT: 0x2,
            COMPUTE: 0x4
          };
        },
        
        // === SAFE HELPERS WITH GUARDRAILS ===
        createBuffer: (size: number, usage: GPUBufferUsageFlags): GPUBuffer | null => {
          if (!engine.webgpuDevice) return null;
          
          // Enforce size limits to prevent memory exhaustion
          const MAX_BUFFER_SIZE = 256 * 1024 * 1024; // 256MB
          if (size > MAX_BUFFER_SIZE) {
            console.error('Buffer size exceeds maximum allowed:', MAX_BUFFER_SIZE);
            return null;
          }
          
          return engine.webgpuDevice.createBuffer({ size, usage });
        },
        
        createShaderModule: (code: string): GPUShaderModule | null => {
          if (!engine.webgpuDevice) return null;
          return engine.webgpuDevice.createShaderModule({ code });
        },
        
        createTexture: (width: number, height: number, format: GPUTextureFormat = 'rgba8unorm'): GPUTexture | null => {
          if (!engine.webgpuDevice) return null;
          
          // Enforce texture size limits
          const MAX_DIMENSION = 8192;
          if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            console.error('Texture dimensions exceed maximum:', MAX_DIMENSION);
            return null;
          }
          
          return engine.webgpuDevice.createTexture({
            size: { width, height },
            format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
          });
        }
      },
      
      // WGSL Shader API (high-level shader management)
      shader: {
        // Dynamically register (or replace) a named WGSL shader from user code.
        // Returns a Promise<boolean> so callers can await compilation.
        define: async (shaderName: string, wgslCode: string, opts?: { kind?: 'fragment' | 'vertex' }): Promise<boolean> => {
          if (!engine.shaderManager) {
            console.warn('ShaderManager not available (WebGPU not initialized)');
            return false;
          }
          try {
            const shader = {
              name: shaderName,
              code: wgslCode,
              kind: (opts?.kind ?? 'fragment') as import('./types.js').WGSLShaderKind,
              uniforms: [] as string[],
              bindings: [] as number[],
              workgroupSize: [1, 1, 1] as [number, number, number],
            };
            return await engine.shaderManager.registerShader(shader);
          } catch (error) {
            console.error(`Failed to define shader ${shaderName}:`, error);
            return false;
          }
        },

        setUniform: (shaderName: string, uniformName: string, value: number | number[]) => {
          if (!engine.shaderManager) {
            console.warn('ShaderManager not available (WebGPU not initialized)');
            return;
          }
          try {
            engine.shaderManager.setUniform(shaderName, uniformName, value);
          } catch (error) {
            console.error(`Failed to set uniform ${uniformName} on shader ${shaderName}:`, error);
          }
        },
        
        setActive: (shaderName: string | null) => {
          if (!engine.shaderManager) {
            console.warn('ShaderManager not available (WebGPU not initialized)');
            return;
          }
          try {
            engine.shaderManager.setActiveShader(shaderName);
          } catch (error) {
            console.error(`Failed to set active shader to ${shaderName}:`, error);
          }
        },
        
        getActive: () => {
          if (!engine.shaderManager) return null;
          return engine.shaderManager.getActiveShaderName();
        },
        
        list: () => {
          if (!engine.shaderManager) return [];
          return engine.shaderManager.getRegisteredShaders();
        },
        
        has: (shaderName: string) => {
          if (!engine.shaderManager) return false;
          return engine.shaderManager.hasShader(shaderName);
        },
        
        info: (shaderName: string) => {
          if (!engine.shaderManager) return null;
          return engine.shaderManager.getShaderInfo(shaderName);
        },
        
        // Shader chain API
        setChain: async (shaderNames: string[]) => {
          // Allow calls before WebGPU init: defer until ShaderChainManager exists.
          if (!engine.shaderChainManager) {
            const chainStr = Array.isArray(shaderNames) ? shaderNames.filter(Boolean).join('+') : '';
            if (chainStr) {
              console.log('[Engine] Deferring shader chain until WebGPU init (api):', chainStr);
              engine.pendingShaderChain = { chainStr, source: 'api' };
              return true;
            }
            engine.pendingShaderChain = null;
            return true;
          }
          try {
            return await engine.shaderChainManager.activateChain(shaderNames, 'api');
          } catch (error) {
            console.error('Failed to set shader chain:', error);
            return false;
          }
        },
        
        getChain: () => {
          if (engine.shaderChainManager) return engine.shaderChainManager.getActiveChain();
          if (engine.pendingShaderChain?.chainStr) {
            // Best-effort: expose the deferred chain as if it were active.
            return engine.pendingShaderChain.chainStr.split('+').map(s => s.trim()).filter(Boolean);
          }
          return [];
        },
        
        clearChain: () => {
          if (engine.shaderChainManager) {
            engine.shaderChainManager.clearChain();
            return;
          }
          engine.pendingShaderChain = null;
        },
        
        hasChain: () => {
          if (engine.shaderChainManager) return engine.shaderChainManager.hasActiveChain();
          return !!engine.pendingShaderChain?.chainStr;
        },
        
        chainInfo: () => {
          if (!engine.shaderChainManager) return null;
          return engine.shaderChainManager.getChainInfo();
        },

        // Background shader — runs before the chain, independent of setChain().
        // Use this for persistent scene-level effects (e.g. felt grain) so the
        // main chain can be configured freely for post-process effects.
        setBackground: async (shaderName: string | null) => {
          if (!engine.shaderChainManager) {
            console.warn('ShaderChainManager not available (WebGPU not initialized)');
            return false;
          }
          try {
            return await engine.shaderChainManager.setBackground(shaderName);
          } catch (error) {
            console.error(`Failed to set background shader "${shaderName}":`, error);
            return false;
          }
        },

        clearBackground: () => {
          if (engine.shaderChainManager) {
            engine.shaderChainManager.setBackground(null);
          }
        },

        getBackground: () => {
          if (!engine.shaderChainManager) return null;
          return engine.shaderChainManager.getBackground();
        },
      },
      
      // Compositor API (Phase 1: Auto-compositing, future: manual mode)
      compositor: {
        // Current mode
        get mode(): 'auto' | 'manual' {
          return engine.compositor?.mode || 'auto';
        },
        
        // Set compositing mode
        setMode: (mode: 'auto' | 'manual') => {
          if (engine.compositor) {
            engine.compositor.setMode(mode);
          } else {
            console.warn('Compositor not available (WebGPU not initialized)');
          }
        },
        
        // Get layer configuration
        get layers() {
          if (!engine.compositor) return {};
          const layersObj: any = {};
          engine.compositor.layers.forEach((layer, name) => {
            layersObj[name] = {
              opacity: layer.opacity,
              blendMode: layer.blendMode,
              enabled: layer.enabled,
              zIndex: layer.zIndex
            };
          });
          return layersObj;
        },
        
        // Manual compositing methods (for future Phase 2)
        clear: (color?: string) => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            engine.compositor.clear(color);
          }
        },
        
        blit: (layerName: string, options?: any) => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            const layer = engine.compositor.layers.get(layerName);
            if (layer) {
              engine.compositor.blit(layer, options);
            }
          }
        },
        
        present: () => {
          if (engine.compositor && engine.compositor.mode === 'manual') {
            engine.compositor.present();
          }
        },
        
        // Phase 3: Custom Contexts
        createContext: (name: string, options: {
          type: 'canvas2d' | 'webgl' | 'webgl2';
          width: number;
          height: number;
          alpha?: boolean;
          antialias?: boolean;
          zIndex?: number;
        }) => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return null;
          }
          return engine.compositor.createContext(name, options);
        },
        
        removeLayer: (name: string): boolean => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return false;
          }
          return engine.compositor.removeLayer(name);
        },
        
        // Phase 5: Shader Pipeline
        loadEffect: async (name: string, url: string): Promise<void> => {
          if (!engine.compositor) {
            throw new Error('Compositor not available (WebGPU not initialized)');
          }
          // In untrusted mode, allow loading only built-in, same-origin shader modules
          // from the shipped `docs/shaders/` folder.
          const rawUrl = String(url ?? '').trim();
          if (engine.untrustedContent) {
            const allowedPrefix = /^(?:\.\/)?shaders\//;
            if (!allowedPrefix.test(rawUrl) || rawUrl.includes('..') || rawUrl.startsWith('/') || rawUrl.startsWith('\\')) {
              throw new Error('[compositor.loadEffect] Untrusted mode allows only relative URLs under "shaders/"');
            }
            // Also disallow any explicit scheme in untrusted mode, even if same-origin.
            if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl)) {
              throw new Error('[compositor.loadEffect] Untrusted mode blocks URL schemes');
            }
          }

          // Prevent sandboxed scripts from importing arbitrary remote JS.
          // Even same-origin dynamic import executes in the host realm.
          // For trusted content, allow by default; for cross-origin, require opt-in.
          try {
            const u = new URL(rawUrl, globalThis.location?.href ?? 'http://localhost');
            const origin = globalThis.location?.origin;
            if (!engine.allowCrossOriginDynamicImport && origin && u.origin !== origin) {
              throw new Error(`Cross-origin dynamic import blocked: ${u.origin}`);
            }
            const proto = u.protocol.toLowerCase();
            if (proto === 'data:' || proto === 'blob:' || proto === 'javascript:') {
              throw new Error(`Unsupported import URL scheme: ${proto}`);
            }
          } catch (e: any) {
            throw new Error(`[compositor.loadEffect] Refused URL: ${String(e?.message ?? e)}`);
          }

          await engine.compositor.loadEffect(String(name), rawUrl);
        },

        /**
         * Convenience helper: load a shader effect module from the local `docs/shaders/` folder.
         *
         * Examples:
         * - `await compositor.loadBuiltInEffect('bloom')` -> imports `shaders/bloom.wgsl.js`
         * - `await compositor.loadBuiltInEffect('vignette', 'lightvignette')` -> imports `shaders/lightvignette.wgsl.js`
         */
        loadBuiltInEffect: async (effectName: string, shaderName?: string): Promise<void> => {
          const effect = String(effectName ?? '').trim();
          if (!effect) throw new Error('[compositor.loadBuiltInEffect] Missing effectName');

          const shader = String(shaderName ?? effect).trim();
          if (!/^[a-zA-Z0-9_-]+$/.test(shader)) {
            throw new Error('[compositor.loadBuiltInEffect] Invalid shaderName (expected [a-zA-Z0-9_-]+)');
          }

          const moduleUrl = `shaders/${shader}.wgsl.js`;
          await engine.api.compositor.loadEffect(effect, moduleUrl);
        },
        
        buildPipeline: async (effects: string[]): Promise<void> => {
          if (!engine.compositor) {
            throw new Error('Compositor not available (WebGPU not initialized)');
          }
          await engine.compositor.buildPipeline(effects);
        },
        
        setPipelineEnabled: (enabled: boolean): void => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return;
          }
          engine.compositor.setPipelineEnabled(enabled);
        },
        
        setEffectUniform: (effectName: string, uniformName: string, value: number | number[]): void => {
          if (!engine.compositor) {
            console.warn('Compositor not available (WebGPU not initialized)');
            return;
          }
          engine.compositor.setEffectUniform(effectName, uniformName, value);
        },
        
        getEffects: (): string[] => {
          if (!engine.compositor) {
            return [];
          }
          return engine.compositor.getEffects();
        },
        
        hasEffect: (name: string): boolean => {
          if (!engine.compositor) {
            return false;
          }
          return engine.compositor.hasEffect(name);
        },

        // Check if compositor is available
        get available(): boolean {
          return engine.compositor !== null;
        }
      },
      
      // 3D Canvas API - Hardware-accelerated 3D section rendering
      worlds: {
        // Enable/disable 3D rendering mode
        enable: () => {
          // Treat enable() as a request that can be made before WebGPU is ready.
          // If/when the 3D layer becomes available, it will be enabled.
          engine.worldsEnabled = true;
          engine.requestWorldsRendererInitialization();

          // If the compositor already exists and the 3D layer is registered, enable it now.
          if (engine.compositor?.layers.get('3d')) {
            engine.compositor.updateLayer('3d', { enabled: true });
          }

          engine.updateAudienceViewLayers();

          // Return whether Worlds is available immediately.
          return engine.worldsRenderer !== null;
        },
        
        disable: () => {
          engine.worldsEnabled = false;
          // Disable the 3D layer in compositor
          if (engine.compositor?.layers.get('3d')) {
            engine.compositor.updateLayer('3d', { enabled: false });
          }
          engine.updateAudienceViewLayers();
          console.log('3D Canvas mode disabled');
        },
        
        get enabled(): boolean {
          return engine.worldsEnabled;
        },
        
        get available(): boolean {
          return engine.worldsRenderer !== null;
        },

        // Built-in navigation controls (WASD + QE + right-drag mouse-look)
        controls: {
          setEnabled: (enabled: boolean) => {
            engine.worldsControlsEnabled = !!enabled;
          },
          get enabled(): boolean {
            return engine.worldsControlsEnabled;
          }
        },

        // Built-in 3D link navigation (Tab/Enter/Arrow). Disable this to let
        // documents own those keys (e.g. presenter/slide mode).
        links: {
          setKeyHandlingEnabled: (enabled: boolean) => {
            engine.worldsLinkKeyHandlingEnabled = !!enabled;
          },
          get keyHandlingEnabled(): boolean {
            return engine.worldsLinkKeyHandlingEnabled;
          },
          popActivated: () => {
            return engine.activated3DLinksQueue.shift() ?? null;
          },
          setRenderOverlay: (options?: {
            enabled?: boolean;
            section?: number | string | null;
            internalOnly?: boolean;
            thickness?: number;
            allVisible?: boolean;
          }) => {
            if (!options) {
              engine.worlds3DRenderedLinkOverlay.enabled = false;
              engine.worlds3DRenderedLinkOverlay.section = null;
              engine.worlds3DRenderedLinkOverlay.internalOnly = true;
              engine.worlds3DRenderedLinkOverlay.thickness = 0.22;
              engine.worlds3DRenderedLinkOverlay.allVisible = false;
              return;
            }
            if (typeof options.enabled === 'boolean') {
              engine.worlds3DRenderedLinkOverlay.enabled = options.enabled;
            } else {
              engine.worlds3DRenderedLinkOverlay.enabled = true;
            }
            if (Object.prototype.hasOwnProperty.call(options, 'section')) {
              engine.worlds3DRenderedLinkOverlay.section = options.section ?? null;
            }
            if (typeof options.internalOnly === 'boolean') {
              engine.worlds3DRenderedLinkOverlay.internalOnly = options.internalOnly;
            }
            if (typeof options.thickness === 'number' && Number.isFinite(options.thickness)) {
              engine.worlds3DRenderedLinkOverlay.thickness = Math.max(0.01, options.thickness);
            }
            if (typeof options.allVisible === 'boolean') {
              engine.worlds3DRenderedLinkOverlay.allVisible = options.allVisible;
            }
          },
          getVisualConnections: (options?: {
            section?: number | string | null;
            visibleOnly?: boolean;
            internalOnly?: boolean;
          }) => {
            return engine.getVisual3DLinkConnections(options);
          }
        },

        presets: {
          list: () => {
            return listWorldsPresetNames();
          },
          get: (name: string) => {
            return getWorldsPreset(name);
          },
          apply: (name: string) => {
            return applyWorldsPreset(name);
          }
        },

        widgets: {
          popEvent: () => {
            return engine.worldsInlineWidgetEventsQueue.shift() ?? null;
          },
          getValue: (id: string, section?: number | string) => {
            const resolved = section === undefined || section === null || section === 'current'
              ? engine.getResolvedCurrent3DSectionIndex()
              : engine.resolve3DSectionIndex(section as any);
            if (!(typeof resolved === 'number' && Number.isFinite(resolved))) return null;
            return engine.worldsInlineWidgetValueState.get(engine.getWorldsInlineWidgetStateKey(resolved, String(id))) ?? null;
          },
          setValue: (id: string, value: number | boolean | string, section?: number | string) => {
            const resolved = section === undefined || section === null || section === 'current'
              ? engine.getResolvedCurrent3DSectionIndex()
              : engine.resolve3DSectionIndex(section as any);
            if (!(typeof resolved === 'number' && Number.isFinite(resolved))) return false;
            const key = engine.getWorldsInlineWidgetStateKey(resolved, String(id));
            engine.worldsInlineWidgetValueState.set(key, value);
            const sectionId = engine.getSectionLayoutByIndex(resolved)?.sectionId;
            const live = sectionId
              ? engine.worldsInlineWidgetInstances.find((entry) => entry.sectionId === sectionId && entry.widgetId === id)
              : null;
            if (live) {
              if (live.kind === 'slider' && typeof live.widget.setValue === 'function' && typeof value === 'number') {
                live.widget.setValue(value);
                live.lastValue = live.widget.getValue();
              } else if (live.kind === 'checkbox' && typeof live.widget.setChecked === 'function' && typeof value === 'boolean') {
                live.widget.setChecked(value);
                live.lastValue = value;
              } else if (live.kind === 'label' && typeof live.widget.setText === 'function') {
                live.widget.setText(String(value));
              }
            }
            return true;
          },
          configure: (id: string, patch: { min?: number; max?: number; step?: number; label?: string; showValue?: boolean; fg?: number; trackColor?: number; knobColor?: number; knobHoverColor?: number }, section?: number | string) => {
            const resolved = section === undefined || section === null || section === 'current'
              ? engine.getResolvedCurrent3DSectionIndex()
              : engine.resolve3DSectionIndex(section as any);
            if (!(typeof resolved === 'number' && Number.isFinite(resolved))) return false;
            const key = engine.getWorldsInlineWidgetStateKey(resolved, String(id));
            const nextPatch = { ...(engine.worldsInlineWidgetConfigState.get(key) ?? {}) };

            if (typeof patch.label === 'string') nextPatch.label = patch.label;
            if (typeof patch.showValue === 'boolean') nextPatch.showValue = patch.showValue;
            if (typeof patch.min === 'number' && Number.isFinite(patch.min)) nextPatch.min = patch.min;
            if (typeof patch.max === 'number' && Number.isFinite(patch.max)) nextPatch.max = patch.max;
            if (typeof patch.step === 'number' && Number.isFinite(patch.step) && patch.step > 0) nextPatch.step = patch.step;
            if (typeof patch.fg === 'number' && Number.isFinite(patch.fg)) nextPatch.fg = patch.fg;
            if (typeof patch.trackColor === 'number' && Number.isFinite(patch.trackColor)) nextPatch.trackColor = patch.trackColor;
            if (typeof patch.knobColor === 'number' && Number.isFinite(patch.knobColor)) nextPatch.knobColor = patch.knobColor;
            if (typeof patch.knobHoverColor === 'number' && Number.isFinite(patch.knobHoverColor)) nextPatch.knobHoverColor = patch.knobHoverColor;

            engine.worldsInlineWidgetConfigState.set(key, nextPatch);

            const sectionId = engine.getSectionLayoutByIndex(resolved)?.sectionId;
            const live = sectionId
              ? engine.worldsInlineWidgetInstances.find((entry) => entry.sectionId === sectionId && entry.widgetId === id)
              : null;
            if (live?.kind === 'slider') {
              if (typeof nextPatch.label === 'string') live.widget.label = nextPatch.label;
              if (typeof nextPatch.showValue === 'boolean') live.widget.showValue = nextPatch.showValue;
              if (typeof nextPatch.min === 'number') live.widget.min = nextPatch.min;
              if (typeof nextPatch.max === 'number') live.widget.max = nextPatch.max;
              if (typeof nextPatch.step === 'number') live.widget.step = nextPatch.step;
              if (typeof nextPatch.fg === 'number') live.widget.sliderStyle.fg = nextPatch.fg;
              if (typeof nextPatch.trackColor === 'number') live.widget.sliderStyle.trackColor = nextPatch.trackColor;
              if (typeof nextPatch.knobColor === 'number') live.widget.sliderStyle.knobColor = nextPatch.knobColor;
              if (typeof nextPatch.knobHoverColor === 'number') live.widget.sliderStyle.knobHoverColor = nextPatch.knobHoverColor;
              const currentValue = live.widget.getValue();
              live.widget.setValue(currentValue);
              live.lastValue = live.widget.getValue();
              if (live.lastValue !== undefined) {
                engine.worldsInlineWidgetValueState.set(key, live.lastValue);
              }
            }

            return true;
          }
        },

        // Outline-based navigation helpers.
        // Provides flexible “next/prev” semantics (global, subtree, siblings, level filters).
        nav: (() => {
          const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
          const asBool = (v: any) => !!v;

          const levelsPredicate = (levels: OutlineLevels | undefined) => {
            if (levels === undefined || levels === 'any') return (_n: OutlineNode) => true;
            if (typeof levels === 'number' && Number.isFinite(levels)) return (n: OutlineNode) => n.level === levels;
            if (levels && typeof levels === 'object') {
              const min = typeof (levels as any).min === 'number' ? (levels as any).min : 1;
              const max = typeof (levels as any).max === 'number' ? (levels as any).max : 6;
              return (n: OutlineNode) => n.level >= min && n.level <= max;
            }
            return (_n: OutlineNode) => true;
          };

          const resolveRootIndex = (root: any): number | null => {
            if (root === undefined || root === null || root === 'current') {
              const cur = engine.current3DSectionIndex;
              return typeof cur === 'number' ? cur : null;
            }
            if (typeof root === 'number' && Number.isFinite(root)) return root;
            return null;
          };

          const list = (rule?: {
            scope?: 'global' | 'subtree' | 'siblings';
            depth?: 'descendants' | 'children';
            root?: 'current' | number;
            levels?: OutlineLevels;
            includeHidden?: boolean;
            includeNonNavigable?: boolean;
            includeSelf?: boolean;
          }) => {
            const nodes = engine.getOutlineNodes();
            if (nodes.length === 0) return [] as number[];

            const scope = (rule?.scope ?? 'global');
            const depth = (rule?.depth ?? 'descendants');
            const includeHidden = asBool(rule?.includeHidden);
            const includeNonNavigable = asBool(rule?.includeNonNavigable);
            const includeSelf = asBool(rule?.includeSelf);
            const pred = levelsPredicate(rule?.levels);

            let candidateIndices: number[] = [];

            if (scope === 'global') {
              candidateIndices = nodes.map(n => n.index);
            } else {
              const rootIndex = resolveRootIndex(rule?.root);
              if (rootIndex === null || rootIndex < 0 || rootIndex >= nodes.length) return [] as number[];
              const rootNode = nodes[rootIndex];
              if (!rootNode) return [] as number[];

              if (scope === 'subtree') {
                if (depth === 'children') {
                  candidateIndices = nodes
                    .filter(n => n.parentIndex === rootIndex)
                    .map(n => n.index);
                } else {
                  const start = includeSelf ? rootIndex : rootIndex + 1;
                  const end = rootNode.lastDescendantIndex;
                  candidateIndices = [];
                  for (let i = start; i <= end && i < nodes.length; i++) candidateIndices.push(i);
                }
              } else {
                // siblings
                const parent = rootNode.parentIndex;
                candidateIndices = nodes
                  .filter(n => n.parentIndex === parent)
                  .map(n => n.index)
                  .filter(i => includeSelf ? true : i !== rootIndex);
              }
            }

            // Levels filter
            candidateIndices = candidateIndices.filter(i => {
              const n = nodes[i];
              return !!n && pred(n);
            });

            // Layout filter (visibility/navigability)
            if (engine.section3DLayouts && engine.section3DLayouts.length > 0) {
              candidateIndices = candidateIndices.filter(i => {
                const layout = engine.section3DLayouts[i];
                if (!layout) return true;
                if (!includeHidden && layout.visible === false) return false;
                if (!includeNonNavigable && layout.navigable === false) return false;
                return true;
              });
            }

            return candidateIndices;
          };

          const count = (rule?: Parameters<typeof list>[0]) => list(rule).length;

          const cursor = (rule?: Parameters<typeof list>[0]) => {
            const candidates = list(rule);
            if (candidates.length === 0) return null;

            const current = engine.current3DSectionIndex;
            if (typeof current !== 'number') return 0;

            const exact = candidates.indexOf(current);
            if (exact >= 0) return exact;

            // If current isn't a candidate (e.g. you're on an H2 but navigating H1s),
            // anchor the cursor to the last candidate before the current index.
            let prev = -1;
            for (let i = 0; i < candidates.length; i++) {
              if (candidates[i] < current) prev = i;
              else break;
            }
            return prev >= 0 ? prev : 0;
          };

          const goto = (
            index: number,
            rule?: (Parameters<typeof list>[0] & { wrap?: boolean; mode?: 'fit' | 'focus'; fill?: number; distance?: number })
          ) => {
            const candidates = list(rule);
            if (candidates.length === 0) return;
            const wrap = asBool((rule as any)?.wrap);
            let i = Math.floor(index);
            if (wrap) {
              const m = candidates.length;
              i = ((i % m) + m) % m;
            } else {
              i = clamp(i, 0, candidates.length - 1);
            }

            const sectionIndex = candidates[i];
            const mode = (rule as any)?.mode === 'focus' ? 'focus' : 'fit';
            if (mode === 'focus') {
              const distance = typeof (rule as any)?.distance === 'number' ? (rule as any).distance : 80;
              engine.request3DCameraFocus({ kind: 'focus', sectionIndex, distance });
            } else {
              const fill = typeof (rule as any)?.fill === 'number' ? (rule as any).fill : 0.9;
              engine.request3DCameraFocus({ kind: 'fit', sectionIndex, fill });
            }
          };

          const next = (rule?: Parameters<typeof goto>[1]) => {
            const i = cursor(rule);
            if (i === null) return;
            goto(i + 1, rule);
          };

          const prev = (rule?: Parameters<typeof goto>[1]) => {
            const i = cursor(rule);
            if (i === null) return;
            goto(i - 1, rule);
          };

          return { list, count, cursor, goto, next, prev };
        })(),

        // PowerPoint-like overview mode (host-only): lays out candidate sections in a grid
        // and fits the camera to show them all.
        overview: {
          setEnabled: (enabled: boolean, options?: WorldsOverviewOptions) => {
            engine.setWorldsOverviewEnabled(enabled, options);
          },
          toggle: (options?: WorldsOverviewOptions) => {
            engine.setWorldsOverviewEnabled(!engine.worldsOverviewEnabled, options);
          },
          get enabled(): boolean {
            return engine.worldsOverviewEnabled;
          }
        },
        
        // Camera controls
        camera: {
          setPosition: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.position = { x, y, z };
          },
          
          setRotation: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.rotation = { x, y, z };
          },
          
          moveTo: (x: number, y: number, z: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.target = { x, y, z };
          },

          shake: {
            setEnabled: (enabled: boolean) => {
              if (!engine.camera3D) return;
              if (!engine.camera3D.shake) {
                engine.camera3D.shake = {
                  enabled: false,
                  strength: 1,
                  seed: Math.random(),
                  translate: { x: 0, y: 0, z: 0 },
                  rotate: { x: 0, y: 0, z: 0 },
                  rate: 0.17,
                };
              }
              engine.camera3D.shake.enabled = !!enabled;
              if (!enabled && engine.camera3D._shakeState) {
                engine.camera3D._shakeState.time = 0;
                engine.camera3D._shakeState.pos = { x: 0, y: 0, z: 0 };
                engine.camera3D._shakeState.posVel = { x: 0, y: 0, z: 0 };
                engine.camera3D._shakeState.rot = { x: 0, y: 0, z: 0 };
                engine.camera3D._shakeState.rotVel = { x: 0, y: 0, z: 0 };
              }
            },

            setParams: (params: any) => {
              if (!engine.camera3D) return;
              if (!engine.camera3D.shake) {
                engine.camera3D.shake = {
                  enabled: false,
                  strength: 1,
                  seed: Math.random(),
                  translate: { x: 0, y: 0, z: 0 },
                  rotate: { x: 0, y: 0, z: 0 },
                  rate: 0.17,
                };
              }

              const s = engine.camera3D.shake;
              if (typeof params?.strength === 'number' && Number.isFinite(params.strength)) s.strength = params.strength;
              if (typeof params?.seed === 'number' && Number.isFinite(params.seed)) s.seed = params.seed;
              if (typeof params?.rate === 'number' && Number.isFinite(params.rate)) s.rate = params.rate;

              if (params?.translate && typeof params.translate === 'object') {
                if (typeof params.translate.x === 'number' && Number.isFinite(params.translate.x)) s.translate.x = params.translate.x;
                if (typeof params.translate.y === 'number' && Number.isFinite(params.translate.y)) s.translate.y = params.translate.y;
                if (typeof params.translate.z === 'number' && Number.isFinite(params.translate.z)) s.translate.z = params.translate.z;
              }
              if (params?.rotate && typeof params.rotate === 'object') {
                if (typeof params.rotate.x === 'number' && Number.isFinite(params.rotate.x)) s.rotate.x = params.rotate.x;
                if (typeof params.rotate.y === 'number' && Number.isFinite(params.rotate.y)) s.rotate.y = params.rotate.y;
                if (typeof params.rotate.z === 'number' && Number.isFinite(params.rotate.z)) s.rotate.z = params.rotate.z;
              }
            },

            getParams: () => {
              if (!engine.camera3D?.shake) {
                return {
                  enabled: false,
                  strength: 1,
                  seed: 0,
                  rate: 0.17,
                  translate: { x: 0, y: 0, z: 0 },
                  rotate: { x: 0, y: 0, z: 0 },
                };
              }
              const s = engine.camera3D.shake;
              return {
                enabled: !!s.enabled,
                strength: Number.isFinite(s.strength) ? s.strength : 1,
                seed: Number.isFinite(s.seed) ? s.seed : 0,
                rate: Number.isFinite(s.rate) ? s.rate : 0.17,
                translate: { x: s.translate.x, y: s.translate.y, z: s.translate.z },
                rotate: { x: s.rotate.x, y: s.rotate.y, z: s.rotate.z },
              };
            }
          },
          
          focusOnSection: (
            sectionIndex: number | string,
            distance: number = 50,
            options?: {
              keepRotation?: boolean;
              positionOffset?: { x: number; y: number; z: number };
              rotationOffset?: { x: number; y: number; z: number };
            }
          ) => {
            if (!engine.camera3D) return;
            const keepRotation = !!(options as any)?.keepRotation;
            const positionOffset = (options as any)?.positionOffset;
            const rotationOffset = (options as any)?.rotationOffset;
            const normVec = (v: any) => {
              if (!v || typeof v !== 'object') return undefined;
              const x = Number(v.x);
              const y = Number(v.y);
              const z = Number(v.z);
              if (![x, y, z].every(Number.isFinite)) return undefined;
              return { x, y, z };
            };
            engine.request3DCameraFocus({
              kind: 'focus',
              sectionIndex,
              distance,
              ...(keepRotation ? { keepRotation: true } : {}),
              ...(normVec(positionOffset) ? { positionOffset: normVec(positionOffset)! } : {}),
              ...(normVec(rotationOffset) ? { rotationOffset: normVec(rotationOffset)! } : {}),
            });
          },

          focusOnSectionFit: (
            sectionIndex: number | string,
            fill: number = 0.9,
            options?: {
              keepRotation?: boolean;
              positionOffset?: { x: number; y: number; z: number };
              rotationOffset?: { x: number; y: number; z: number };
            }
          ) => {
            if (!engine.camera3D) return;
            const keepRotation = !!(options as any)?.keepRotation;
            const positionOffset = (options as any)?.positionOffset;
            const rotationOffset = (options as any)?.rotationOffset;
            const normVec = (v: any) => {
              if (!v || typeof v !== 'object') return undefined;
              const x = Number(v.x);
              const y = Number(v.y);
              const z = Number(v.z);
              if (![x, y, z].every(Number.isFinite)) return undefined;
              return { x, y, z };
            };
            engine.request3DCameraFocus({
              kind: 'fit',
              sectionIndex,
              fill,
              ...(keepRotation ? { keepRotation: true } : {}),
              ...(normVec(positionOffset) ? { positionOffset: normVec(positionOffset)! } : {}),
              ...(normVec(rotationOffset) ? { rotationOffset: normVec(rotationOffset)! } : {}),
            });
          },

          frameSections: (
            sections?: number | string | Array<number | string>,
            options?: {
              fill?: number;
              padding?: number;
              includeHidden?: boolean;
              includeNonNavigable?: boolean;
              rotation?: { x: number; y: number; z: number };
            }
          ) => {
            if (!engine.camera3D) return;
            const normalizeSections = (value: any): Array<number | string> | undefined => {
              if (value === undefined || value === null) return undefined;
              const arr = Array.isArray(value) ? value : [value];
              const normalized = arr.filter((item) => typeof item === 'number' || typeof item === 'string');
              return normalized.length > 0 ? normalized : undefined;
            };
            const normVec = (v: any) => {
              if (!v || typeof v !== 'object') return undefined;
              const x = Number(v.x);
              const y = Number(v.y);
              const z = Number(v.z);
              if (![x, y, z].every(Number.isFinite)) return undefined;
              return { x, y, z };
            };
            engine.request3DCameraFocus({
              kind: 'frame',
              ...(normalizeSections(sections) ? { sectionSelectors: normalizeSections(sections)! } : {}),
              fill: typeof options?.fill === 'number' && Number.isFinite(options.fill) ? options.fill : 0.9,
              padding: typeof options?.padding === 'number' && Number.isFinite(options.padding) ? options.padding : 24,
              ...(typeof options?.includeHidden === 'boolean' ? { includeHidden: options.includeHidden } : {}),
              ...(typeof options?.includeNonNavigable === 'boolean' ? { includeNonNavigable: options.includeNonNavigable } : {}),
              ...(normVec(options?.rotation) ? { rotation: normVec(options?.rotation)! } : {}),
            });
          },

          birdsEye: (
            options?: {
              sections?: number | string | Array<number | string>;
              fill?: number;
              padding?: number;
              includeHidden?: boolean;
              includeNonNavigable?: boolean;
              view?: 'oblique' | 'top';
              pitch?: number;
              yaw?: number;
              roll?: number;
            }
          ) => {
            if (!engine.camera3D) return;
            const view = options?.view === 'top' ? 'top' : 'oblique';
            const rotation = {
              x: typeof options?.pitch === 'number' && Number.isFinite(options.pitch)
                ? options.pitch
                : (view === 'top' ? Math.PI / 2 - 0.02 : Math.PI / 3.6),
              y: typeof options?.yaw === 'number' && Number.isFinite(options.yaw)
                ? options.yaw
                : 0,
              z: typeof options?.roll === 'number' && Number.isFinite(options.roll)
                ? options.roll
                : 0,
            };
            const sections = options?.sections;
            const normalizeSections = (value: any): Array<number | string> | undefined => {
              if (value === undefined || value === null) return undefined;
              const arr = Array.isArray(value) ? value : [value];
              const normalized = arr.filter((item) => typeof item === 'number' || typeof item === 'string');
              return normalized.length > 0 ? normalized : undefined;
            };
            engine.request3DCameraFocus({
              kind: 'frame',
              ...(normalizeSections(sections) ? { sectionSelectors: normalizeSections(sections)! } : {}),
              fill: typeof options?.fill === 'number' && Number.isFinite(options.fill) ? options.fill : 0.9,
              padding: typeof options?.padding === 'number' && Number.isFinite(options.padding) ? options.padding : 40,
              includeHidden: !!options?.includeHidden,
              includeNonNavigable: options?.includeNonNavigable !== false,
              rotation,
            });
          },
          
          setFOV: (fov: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.fov = fov;
          },
          
          setEaseSpeed: (position: number, rotation: number) => {
            if (!engine.camera3D) return;
            engine.camera3D.positionEaseSpeed = position;
            engine.camera3D.rotationEaseSpeed = rotation;
          },
          
          getPosition: () => {
            if (!engine.camera3D) return { x: 0, y: 0, z: 0 };
            return { ...engine.camera3D.position };
          },
          
          getRotation: () => {
            if (!engine.camera3D) return { x: 0, y: 0, z: 0 };
            return { ...engine.camera3D.rotation };
          }
        },

        get currentSection(): number | null {
          return engine.getResolvedCurrent3DSectionIndex();
        },

        get selectedSection(): number | null {
          return engine.getResolvedSelected3DSectionIndex();
        },
        
        // Section layout access
        getSectionLayout: (sectionIndex: number) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) return null;
          return {
            sectionId: layout.sectionId,
            sectionIndex: layout.sectionIndex,
            sectionTitle: layout.sectionTitle,
            renderMode: layout.renderMode,
            position: { ...layout.transform.position },
            rotation: { ...layout.transform.rotation },
            scale: { ...layout.transform.scale },
            width: layout.width,
            height: layout.height,
            opacity: layout.opacity,
            visible: layout.visible,
            navigable: layout.navigable,
            interactive: layout.interactive
          };
        },
        
        setSectionTransform: (sectionIndex: number, transform: {
          position?: { x: number; y: number; z: number };
          rotation?: { x: number; y: number; z: number };
          scale?: { x: number; y: number; z: number };
        }) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) {
            console.warn(`Section ${sectionIndex} not found`);
            return;
          }
          const override = engine.getOrCreateSectionRuntimeOverride(layout.sectionId);
          if (transform.position) {
            layout.transform.position = { ...transform.position };
            layout.autoPositioned = false;
            override.position = { ...transform.position };
          }
          if (transform.rotation) {
            // Convert degrees to radians
            layout.transform.rotation = {
              x: (transform.rotation.x * Math.PI) / 180,
              y: (transform.rotation.y * Math.PI) / 180,
              z: (transform.rotation.z * Math.PI) / 180
            };
            override.rotationDegrees = { ...transform.rotation };
          }
          if (transform.scale) {
            layout.transform.scale = { ...transform.scale };
            override.scale = { ...transform.scale };
          }
        },
        
        setSectionVisible: (sectionIndex: number, visible: boolean) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) {
            console.warn(`Section ${sectionIndex} not found`);
            return;
          }
          layout.visible = visible;
          engine.getOrCreateSectionRuntimeOverride(layout.sectionId).visible = visible;
        },

        /**
         * Mark a section as a "live" section whose on:render callback draws
         * directly into the section's 3D card texture every frame, so that
         * game/animation content participates in the Worlds 3D perspective.
         *
         * When live, on:render section:N is called during section texture
         * baking (not the flat 2D overlay), and ui.metrics.canvasWidth/Height
         * return the section texture dimensions. Use ui.section.width/height
         * for the same values explicitly.
         *
         * @param section Section index, title string, or section id.
         * @param live    true (default) to enable; false to remove live mode.
         */
        setSectionLive: (section: number | string, live?: boolean) => {
          const ref = engine.resolveWorldsContentSectionRef(section);
          if (!ref) {
            console.warn(`worlds.setSectionLive: section "${section}" not found`);
            return;
          }
          if (live === false) {
            engine._liveSections.delete(ref.sectionIndex);
          } else {
            engine._liveSections.add(ref.sectionIndex);
          }
        },

        // Internal helpers used by the generated section guard in on:render blocks.
        _isLive: (idx: number) => engine._liveSections.has(idx),
        get _activeLiveSectionIndex(): number | null {
          return engine._liveRenderCtx?.sectionIndex ?? engine._liveSectionInputCtx?.sectionIndex ?? null;
        },

        getSectionCount: () => {
          return engine.section3DLayouts.length;
        },

        setSectionSize: (sectionIndex: number, width: number, height: number) => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) {
            console.warn(`Section ${sectionIndex} not found`);
            return;
          }
          const safeW = Math.max(1, Number.isFinite(width) ? width : layout.width);
          const safeH = Math.max(1, Number.isFinite(height) ? height : layout.height);
          layout.width = safeW;
          layout.height = safeH;
          // Pin position so reflowWorldsAutoLayout cannot move the section after
          // the texture re-rasterizes with new dimensions.
          layout.autoPositioned = false;
          const override = engine.getOrCreateSectionRuntimeOverride(layout.sectionId);
          override.width = safeW;
          override.height = safeH;
          if (!override.position) {
            override.position = { ...layout.transform.position };
          }
          engine.invalidate3DSectionTexture(sectionIndex);
        },

        getScreenQuad: (sectionIndex: number): Array<{ x: number; y: number }> | null => {
          const layout = engine.section3DLayouts[sectionIndex];
          if (!layout) return null;
          return engine.getSectionScreenQuad(layout, { allowOffscreen: true });
        },

        unprojectPoint: (
          section: number | string,
          point: { x: number; y: number },
          options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
        ): { x: number; y: number } | null => {
          const ref = engine.resolveRuntimeSectionRef(section);
          if (!ref) return null;
          const layout = engine.getSectionLayoutByIndex(ref.sectionIndex);
          if (!layout) return null;
          return engine.unprojectScreenPointToSectionLocal(layout, point, options);
        },

        projectPoint: (
          section: number | string,
          point: { x: number; y: number },
          options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
        ): { x: number; y: number } | null => {
          const ref = engine.resolveRuntimeSectionRef(section);
          if (!ref) return null;
          const layout = engine.getSectionLayoutByIndex(ref.sectionIndex);
          if (!layout) return null;
          return engine.projectSectionLocalPointToScreen(layout, point, options);
        },

        projectRect: (
          section: number | string,
          rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number },
          options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
        ): { x: number; y: number; width: number; height: number } | null => {
          const ref = engine.resolveRuntimeSectionRef(section);
          if (!ref) return null;
          const layout = engine.getSectionLayoutByIndex(ref.sectionIndex);
          if (!layout) return null;
          const width = Number.isFinite(rect?.w) ? Number(rect.w) : Number(rect?.width);
          const height = Number.isFinite(rect?.h) ? Number(rect.h) : Number(rect?.height);
          if (!Number.isFinite(rect?.x) || !Number.isFinite(rect?.y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
          }
          return engine.projectSectionLocalRectToScreen(layout, {
            x: Number(rect.x),
            y: Number(rect.y),
            w: width,
            h: height,
          }, options);
        },

        projectQuad: (
          section: number | string,
          rect: { x: number; y: number; w?: number; h?: number; width?: number; height?: number },
          options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
        ): Array<{ x: number; y: number }> | null => {
          const ref = engine.resolveRuntimeSectionRef(section);
          if (!ref) return null;
          const layout = engine.getSectionLayoutByIndex(ref.sectionIndex);
          if (!layout) return null;
          const width = Number.isFinite(rect?.w) ? Number(rect.w) : Number(rect?.width);
          const height = Number.isFinite(rect?.h) ? Number(rect.h) : Number(rect?.height);
          if (!Number.isFinite(rect?.x) || !Number.isFinite(rect?.y) || !Number.isFinite(width) || !Number.isFinite(height)) {
            return null;
          }
          return engine.projectSectionLocalRectQuadToScreen(layout, {
            x: Number(rect.x),
            y: Number(rect.y),
            w: width,
            h: height,
          }, options);
        },

        content: {
          get: (selector?: number | string) => {
            const ref = engine.resolveWorldsContentSectionRef(selector);
            if (!ref) return null;
            const override = engine.getWorldsSectionContentOverride(ref.sectionId);
            return {
              sectionId: ref.sectionId,
              sectionIndex: ref.sectionIndex,
              baseTitle: ref.section.title,
              baseContent: ref.section.content,
              ...(override?.title !== undefined ? { overrideTitle: override.title } : {}),
              ...(override?.content !== undefined ? { overrideContent: override.content } : {}),
              effectiveTitle: override?.title ?? ref.section.title,
              effectiveContent: override?.content ?? ref.section.content,
            };
          },
          set: (selector: number | string, patch: { title?: string | null; content?: string | null }) => {
            return engine.setWorldsSectionContentOverride(selector, patch);
          },
          clear: (selector?: number | string, target: 'title' | 'content' | 'all' = 'all') => {
            return engine.clearWorldsSectionContentOverride(selector, target);
          },
          clearAll: () => {
            engine.clearWorldsSectionContentOverrides();
          },
          stateAt: (entries: WorldsContentTimedEntry[], timeSec: number, options?: WorldsContentStateOptions) => {
            return stateAtWorldsContent(entries, Number(timeSec) || 0, options);
          },
          applyTimed: (
            selector: number | string,
            entries: WorldsContentTimedEntry[],
            timeSec: number,
            options?: {
              mode?: WorldsContentMode;
              target?: WorldsContentTarget;
              separator?: string;
              maxEntries?: number;
              clearWhenEmpty?: boolean;
            }
          ) => {
            return engine.applyWorldsTimedContent(selector, entries, Number(timeSec) || 0, options);
          },
          applyAllFrames: (timeSec: number) => {
            engine.applyAllSectionFrames(Number(timeSec) || 0);
          },
        },

        timeline: {
          compile: (entries: Array<{ ms: number; text: string }>) => {
            try {
              return compileWorldsTimeline(entries);
            } catch (e) {
              console.warn('[worlds.timeline.compile] failed:', e);
              return { events: [], sections: [] } as CompiledWorldsTimeline;
            }
          },
          stateAt: (compiled: CompiledWorldsTimeline, timeSec: number) => {
            try {
              return stateAtWorldsTimeline(compiled, Number(timeSec) || 0);
            } catch (e) {
              console.warn('[worlds.timeline.stateAt] failed:', e);
              return [] as WorldsTimelineStateEntry[];
            }
          },
          apply: (compiled: CompiledWorldsTimeline, timeSec: number) => {
            try {
              return engine.applyWorldsTimeline(compiled, Number(timeSec) || 0);
            } catch (e) {
              console.warn('[worlds.timeline.apply] failed:', e);
              return [] as WorldsTimelineStateEntry[];
            }
          },
          reset: (compiled: CompiledWorldsTimeline) => {
            try {
              engine.resetWorldsTimelineRuntimeState(compiled);
            } catch (e) {
              console.warn('[worlds.timeline.reset] failed:', e);
            }
          }
        },

        sections: {
          list: () => {
            return engine.getRuntimeSectionSummaries();
          },
          get: (selector: number | string) => {
            return engine.getRuntimeSectionSummary(selector);
          },
          insert: (section: Partial<Section>, options?: { parent?: number | string | null; index?: number }) => {
            return engine.insertRuntimeSection(section, options);
          },
          update: (selector: number | string, patch: Partial<Section>) => {
            return engine.updateRuntimeSection(selector, patch);
          },
          remove: (selector: number | string) => {
            return engine.removeRuntimeSection(selector);
          },
          move: (selector: number | string, options?: { parent?: number | string | null; index?: number }) => {
            return engine.moveRuntimeSection(selector, options);
          },

          style: {
            /**
             * Set per-section style overrides. Currently supports `fg` (text color).
             *
             * @param selector - Section index, title, or 'current'
             * @param patch - Style properties to override. Pass `null` to clear a property.
             *
             * @example
             * ```js on:enter
             * // Highlight current section in accent1, reset previous
             * if (state._prevStyleSection !== null && state._prevStyleSection !== undefined) {
             *   worlds.sections.style.set(state._prevStyleSection, { fg: null });
             * }
             * state._prevStyleSection = worlds.currentSection;
             * worlds.sections.style.set('current', { fg: 'accent1' });
             * ```
             */
            set: (selector: number | string, patch: { fg?: string | null }) => {
              return engine.setWorldsSectionStyleOverride(selector, patch);
            },
            /** Clear per-section style overrides for a section (or current if omitted). */
            clear: (selector?: number | string) => {
              return engine.clearWorldsSectionStyleOverride(selector);
            },
            /** Clear all per-section style overrides for all sections. */
            clearAll: () => {
              engine.clearWorldsSectionStyleOverrides();
            },
          },
        },

        // Configuration
        config: {
          setDefaults: (config: Partial<WorldsConfig>) => {
            applyWorldsConfigDefaults(config);
          },
          
          getDefaults: () => {
            return { ...engine.worldsConfig };
          }
        },

        layout: {
          setCallback: (fn: any) => {
            engine.worldsLayoutCallback = typeof fn === 'function' ? fn : null;
            engine.applyWorldsLayoutCallback();
          },
          clearCallback: () => {
            engine.worldsLayoutCallback = null;
          }
        }
      }
    };
  }

  /**
   * Register any shaders from loaded documents that weren't registered yet
   */
  private async registerPendingShaders(): Promise<void> {
    if (!this.shaderManager) return;

    for (const [docId, doc] of this.documents) {
      const parsed = (doc as any)._parsedMarkdown;
      if (parsed?.wgslShaders && parsed.wgslShaders.length > 0) {
        console.log(`[ShaderManager] Registering ${parsed.wgslShaders.length} shader(s) from ${docId}...`);
        try {
          const sm: any = this.shaderManager as any;
          if (typeof sm.registerShaders === 'function') {
            await sm.registerShaders(parsed.wgslShaders);
          } else {
            for (const shader of parsed.wgslShaders) {
              await this.shaderManager.registerShader(shader);
            }
          }
          console.log(`  ✓ Registered WGSL shaders from ${docId}`);
        } catch (error) {
          console.error(`  ✗ Failed to register WGSL shaders from ${docId}:`, error);
        }
      }
    }
  }

  /**
   * Load a markdown document and execute its code with lifecycle hooks
   */
  private async applyFrontmatterFontConfig(metadata: Record<string, any>): Promise<void> {
    // Only meaningful in a browser environment.
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const rawFont = metadata?.font ?? metadata?.fontFamily ?? metadata?.['font-family'];
    const rawSize = metadata?.fontsize ?? metadata?.fontSize;

    const normalizedRawFont = rawFont ? String(rawFont).replace(/\+/g, ' ').trim() : null;

    const nextSize = Number.isFinite(Number(rawSize)) && Number(rawSize) > 0 ? Number(rawSize) : this.fontSize;
    const requestedFontStack = normalizedRawFont ? buildFontStack(normalizedRawFont, DEFAULT_FONT_FALLBACK_STACK) : null;
    let nextFontFamily = requestedFontStack ?? this.fontFamily;
    let nextWorldsCardFontStack: string | null = null;

    // Best-effort preload of Google Fonts (if applicable). This avoids the
    // first frame rasterizing fallback glyphs into the atlas.
    if (normalizedRawFont) {
      try {
        const primary = getPrimaryFontFamily(nextFontFamily);
        if (primary) {
          await tryLoadGoogleFontFamily(primary, {
            timeoutMs: 1500,
            fontCssPixelSize: nextSize,
            display: 'swap'
          });
        }
      } catch {
        // ignore
      }

      // Guardrail: terminal rendering assumes a fixed cell width. If the
      // requested font resolves to a proportional face, alignment breaks.
      // In that case, fall back to the default monospace stack for the terminal,
      // but still allow Worlds cards to render with the requested font.
      try {
        if (document.fonts && document.fonts.ready) {
          await Promise.race([
            document.fonts.ready,
            new Promise(resolve => setTimeout(resolve, 750))
          ]);
        }
        if (document.fonts && document.fonts.load) {
          await Promise.race([
            document.fonts.load(`${nextSize}px ${nextFontFamily}`),
            new Promise(resolve => setTimeout(resolve, 750))
          ]);
        }
        if (!isProbablyMonospaceFontStack(nextFontFamily, { fontCssPixelSize: nextSize })) {
          nextWorldsCardFontStack = nextFontFamily;
          console.warn('[Engine] Requested font is not monospace; using monospace for terminal grid and requested font for Worlds cards:', {
            requested: nextFontFamily,
            terminalFallback: DEFAULT_FONT_FALLBACK_STACK
          });
          nextFontFamily = DEFAULT_FONT_FALLBACK_STACK;
        }
      } catch {
        // ignore (best-effort)
      }
    }

    const changed =
      nextSize !== this.fontSize ||
      nextFontFamily !== this.fontFamily ||
      nextWorldsCardFontStack !== this.worldsCardFontStack;
    if (!changed) return;

    if (this.running) {
      // We can safely apply Worlds card font changes at runtime by regenerating
      // section textures. Terminal font/size changes require restart.
      const terminalChanged = nextSize !== this.fontSize || nextFontFamily !== this.fontFamily;
      if (terminalChanged) {
        console.warn('[Engine] Frontmatter font specified, but engine is already running. Restart required to apply terminal font changes:', {
          fontFamily: nextFontFamily,
          fontSize: nextSize
        });
        return;
      }

      if (nextWorldsCardFontStack !== this.worldsCardFontStack) {
        this.worldsCardFontStack = nextWorldsCardFontStack;
        try {
          this.clear3DSectionTextures();
        } catch {
          // ignore
        }
        console.log('[Engine] Applied Worlds card font override at runtime:', this.worldsCardFontStack);
      }
      return;
    }

    this.fontFamily = nextFontFamily;
    this.fontSize = nextSize;
    this.worldsCardFontStack = nextWorldsCardFontStack;

    // Recreate renderer with updated font settings (safe before start()).
    if (this.renderer instanceof WebGPURenderer && navigator.gpu) {
      this.renderer = new WebGPURenderer(this.canvas, {
        fontFamily: this.fontFamily,
        fontSize: this.fontSize,
        renderToTexture: true
      });
    } else {
      this.renderer = new Canvas2DRenderer(this.canvas, {
        fontFamily: this.fontFamily,
        fontSize: this.fontSize
      });
    }

    this.renderer.resize(this.width, this.height);
    this.syncCanvasElementSizeToBuffer();

    console.log(`[Engine] Applied frontmatter font: ${this.fontFamily} @ ${this.fontSize}px`);
  }

  private measureFontMetrics(fontStack: string, fontSizePx: number): {
    charW: number;
    charH: number;
    baseLineHeight: number;
  } {
    // Best-effort measurement in the same pixel space as the section textures.
    // This is used for Worlds card sizing and for matching the card quad aspect.
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d', { alpha: true } as any) as CanvasRenderingContext2D | null;
      if (!ctx) {
        const fallbackH = Math.max(1, Math.round(fontSizePx));
        return { charW: Math.max(1, Math.round(fontSizePx * 0.6)), charH: fallbackH, baseLineHeight: Math.max(1, Math.round(fallbackH * 1.25)) };
      }

      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = `${fontSizePx}px ${fontStack}`;

      // For proportional fonts, using a single glyph like 'M' can wildly
      // overestimate typical advance width, making section cards far wider
      // than expected. Use an average across a representative sample.
      const sample = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const wMetrics = ctx.measureText(sample);
      const wAvg = Math.max(1, Math.ceil((wMetrics.width || (fontSizePx * 0.6 * sample.length)) / sample.length));

      // Height should consider tall/descender glyphs.
      const hMetrics = ctx.measureText('Mg');
      const ascent = (hMetrics as any).actualBoundingBoxAscent;
      const descent = (hMetrics as any).actualBoundingBoxDescent;
      const hRaw = Number.isFinite(ascent) && Number.isFinite(descent)
        ? Math.max(1, Math.ceil(ascent + descent))
        : Math.max(1, Math.round(fontSizePx));
      const baseLineHeight = Math.max(1, Math.round(hRaw * 1.25));
      return { charW: wAvg, charH: hRaw, baseLineHeight };
    } catch {
      const fallbackH = Math.max(1, Math.round(fontSizePx));
      return { charW: Math.max(1, Math.round(fontSizePx * 0.6)), charH: fallbackH, baseLineHeight: Math.max(1, Math.round(fallbackH * 1.25)) };
    }
  }

  private getWorldsTextureScale(): number {
    const dpr = (typeof window !== 'undefined' && window.devicePixelRatio)
      ? Number(window.devicePixelRatio)
      : 1;
    return Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  }

  private scaleLinkRegions(regions: LinkRegion[], scale: number): LinkRegion[] {
    if (!(scale > 0) || Math.abs(scale - 1) < 1e-6) {
      return regions.map(region => ({ ...region }));
    }

    return regions.map(region => ({
      ...region,
      x: region.x * scale,
      y: region.y * scale,
      w: region.w * scale,
      h: region.h * scale,
    }));
  }

  private scaleWidgetPlacements(placements: WidgetPlacement[], scale: number): WidgetPlacement[] {
    if (!(scale > 0) || Math.abs(scale - 1) < 1e-6) {
      return placements.map((placement) => ({ ...placement, widget: { ...placement.widget } }));
    }

    return placements.map((placement) => ({
      ...placement,
      x: placement.x * scale,
      y: placement.y * scale,
      w: placement.w * scale,
      h: placement.h * scale,
      widget: { ...placement.widget },
    }));
  }

  private translateWidgetPlacements(placements: WidgetPlacement[], dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    for (const placement of placements) {
      placement.x += dx;
      placement.y += dy;
    }
  }

  private getWorldsInlineWidgetStateKey(sectionIndex: number, widgetId: string): string {
    const layout = this.getSectionLayoutByIndex(sectionIndex);
    const sectionKey = layout?.sectionId ?? `section-${sectionIndex}`;
    return `${sectionKey}:${widgetId}`;
  }

  private getSectionLayoutByIndex(sectionIndex: number | null | undefined): Section3DLayout | null {
    if (!(typeof sectionIndex === 'number' && Number.isFinite(sectionIndex))) return null;
    return this.section3DLayouts.find((item) => item.sectionIndex === sectionIndex) ?? null;
  }

  private getSectionLayoutById(sectionId: string | null | undefined): Section3DLayout | null {
    if (typeof sectionId !== 'string' || sectionId.length === 0) return null;
    return this.section3DLayouts.find((item) => item.sectionId === sectionId) ?? null;
  }

  private getSectionIndexById(sectionId: string | null | undefined): number | null {
    if (typeof sectionId !== 'string' || sectionId.length === 0) return null;
    const indexed = this.runtimeSectionStore.indexById.get(sectionId);
    if (typeof indexed === 'number' && Number.isFinite(indexed)) return indexed;
    return this.getSectionLayoutById(sectionId)?.sectionIndex ?? null;
  }

  private getResolvedCurrent3DSectionIndex(): number | null {
    const byId = this.getSectionIndexById(this.current3DSectionId);
    if (typeof byId === 'number' && Number.isFinite(byId)) return byId;
    return typeof this.current3DSectionIndex === 'number' && Number.isFinite(this.current3DSectionIndex)
      ? this.current3DSectionIndex
      : null;
  }

  private getResolvedSelected3DSectionIndex(): number | null {
    const byId = this.getSectionIndexById(this.selected3DSectionId);
    if (typeof byId === 'number' && Number.isFinite(byId)) return byId;
    return typeof this.selected3DSectionIndex === 'number' && Number.isFinite(this.selected3DSectionIndex)
      ? this.selected3DSectionIndex
      : null;
  }

  private getCurrent3DSectionLayout(): Section3DLayout | null {
    const byId = this.getSectionLayoutById(this.current3DSectionId);
    if (byId) return byId;
    return this.getSectionLayoutByIndex(this.getResolvedCurrent3DSectionIndex());
  }

  private rebind3DStateToRuntimeSectionStore(): void {
    this.current3DSectionIndex = this.getSectionIndexById(this.current3DSectionId);
    this.selected3DSectionIndex = this.getSectionIndexById(this.selected3DSectionId);

    const rebindLink = (
      entry: { sectionId: string; sectionIndex: number; linkIndex: number } | null
    ): { sectionId: string; sectionIndex: number; linkIndex: number } | null => {
      if (!entry) return null;
      const nextIndex = this.getSectionIndexById(entry.sectionId);
      if (!(typeof nextIndex === 'number' && Number.isFinite(nextIndex))) return null;
      return { ...entry, sectionIndex: nextIndex };
    };

    this.hovered3DLink = rebindLink(this.hovered3DLink);
    this.focused3DLink = rebindLink(this.focused3DLink);
    this.activated3DLinksQueue = this.activated3DLinksQueue
      .map((entry) => {
        if (!entry.sectionId) return entry;
        const nextIndex = this.getSectionIndexById(entry.sectionId);
        return {
          ...entry,
          sectionIndex: typeof nextIndex === 'number' && Number.isFinite(nextIndex) ? nextIndex : null,
        };
      })
      .filter((entry) => entry.sectionId === null || entry.sectionIndex !== null);

    if (this.lastApplied3DCameraFocus) {
      if (this.lastApplied3DCameraFocus.kind === 'frame') {
        this.lastApplied3DCameraFocus = {
          ...this.lastApplied3DCameraFocus,
          sectionIds: this.lastApplied3DCameraFocus.sectionIds.filter((sectionId) => {
            const nextIndex = this.getSectionIndexById(sectionId);
            return typeof nextIndex === 'number' && Number.isFinite(nextIndex);
          }),
        } as any;
      } else {
        const nextIndex = this.getSectionIndexById(this.lastApplied3DCameraFocus.sectionId);
        if (typeof nextIndex === 'number' && Number.isFinite(nextIndex)) {
          this.lastApplied3DCameraFocus = {
            ...this.lastApplied3DCameraFocus,
            sectionIndex: nextIndex,
          } as any;
        }
      }
    }

    this.sceneState.sectionIndex = this.current3DSectionIndex;
  }

  private setSelected3DSection(sectionIndex: number | null): void {
    const nextLayout = this.getSectionLayoutByIndex(sectionIndex);
    if (!nextLayout) {
      this.selected3DSectionId = null;
      this.selected3DSectionIndex = null;
      return;
    }
    this.selected3DSectionId = nextLayout.sectionId;
    this.selected3DSectionIndex = nextLayout.sectionIndex;
  }

  private getSectionCacheKey(layoutOrIndex: Section3DLayout | number | null | undefined): string | null {
    if (typeof layoutOrIndex === 'number') {
      return this.getSectionLayoutByIndex(layoutOrIndex)?.sectionId ?? null;
    }
    if (!layoutOrIndex) return null;
    return layoutOrIndex.sectionId;
  }

  private getGUIPixelMetrics(): { charWidth: number; charHeight: number } {
    const atlas = (this.renderer instanceof WebGPURenderer) ? this.renderer.getAtlas() : null;
    return {
      charWidth: atlas?.getCharWidth() ?? 10,
      charHeight: atlas?.getCharHeight() ?? 16,
    };
  }

  private createCanvas2DDraw2D(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): import('./ui/draw2d.js').Draw2D {
    const clipStack: Array<{ x: number; y: number; w: number; h: number } | null> = [];

    const api: import('./ui/draw2d.js').Draw2D = {
      rect: (x, y, w, h, color) => {
        ctx.fillStyle = ColorUtils.toCss(color as any);
        ctx.fillRect(x, y, w, h);
      },
      text: (text, x, y, color) => {
        ctx.fillStyle = ColorUtils.toCss(color as any);
        ctx.fillText(text, x, y);
      },
      measureTextWidth: (text) => ctx.measureText(text).width,
      image: (imageId, x, y, w, h, options) => {
        // The retained GUI passes image ids that map to sandbox-loaded images.
        // In the section-texture path we also allow markdown image sources.
        const img = this.getMarkdownImageSource(imageId, this.activeDocumentId ?? undefined);
        if (!img) return;

        if (options?.uv) {
          const sx = options.uv.u;
          const sy = options.uv.v;
          const sw = options.uv.w;
          const sh = options.uv.h;
          try {
            ctx.drawImage(img as any, sx, sy, sw, sh, x, y, w, h);
          } catch {
            // ignore
          }
        } else {
          try {
            ctx.drawImage(img as any, x, y, w, h);
          } catch {
            // ignore
          }
        }
      },
      pushClipRect: (x, y, w, h) => {
        clipStack.push({ x, y, w, h });
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.clip();
      },
      popClipRect: () => {
        if (clipStack.length === 0) return;
        clipStack.pop();
        ctx.restore();
      },
      // Stencil masking not supported on Canvas2D.
      pushMaskRect: undefined,
      pushMaskRoundedRect: undefined,
      pushMaskPolygon: undefined,
      popMask: undefined,
      colors: ColorUtils as any,
      metrics: undefined,
    };

    return api;
  }

  private getWorldsSectionTextureToScreenAffine(layout: Section3DLayout): { screenFromTexPx: Draw2DAffine; localFromScreenTexPx: Draw2DAffine; clipRectScreen: { x: number; y: number; w: number; h: number } } | null {
    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return null;
    }

    const dims = this.sectionTextureCache.get(layout.sectionId);
    if (!dims || dims.width <= 0 || dims.height <= 0) return null;

    // Sample three points in texture pixel space: origin, +x, +y.
    const p00 = this.project3DTexturePointToScreen(layout, { x: 0, y: 0 });
    const p10 = this.project3DTexturePointToScreen(layout, { x: dims.width, y: 0 });
    const p01 = this.project3DTexturePointToScreen(layout, { x: 0, y: dims.height });
    if (!p00 || !p10 || !p01) return null;

    const a = (p10.x - p00.x) / dims.width;
    const b = (p10.y - p00.y) / dims.width;
    const c = (p01.x - p00.x) / dims.height;
    const d = (p01.y - p00.y) / dims.height;
    const e = p00.x;
    const f = p00.y;
    const screenFromTexPx: Draw2DAffine = { a, b, c, d, e, f };
    const localFromScreenTexPx = uiDocumentPack.invertAffine(screenFromTexPx);
    if (!localFromScreenTexPx) return null;

    // Clip to the section quad's AABB on screen.
    const quad = this.getSectionScreenQuad(layout, { allowOffscreen: true });
    if (!quad) return null;
    const xs = quad.map((p) => p.x);
    const ys = quad.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;
    const clipRectScreen = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };

    return { screenFromTexPx, localFromScreenTexPx, clipRectScreen };
  }

  private getSectionTextureLogicalScale(layout: Section3DLayout): {
    textureScaleX: number;
    textureScaleY: number;
    logicalWidth: number;
    logicalHeight: number;
  } | null {
    const dims = this.sectionTextureCache.get(layout.sectionId);
    if (!dims || dims.width <= 0 || dims.height <= 0) return null;
    const logicalWidth = dims.logicalWidth > 0 ? dims.logicalWidth : dims.width;
    const logicalHeight = dims.logicalHeight > 0 ? dims.logicalHeight : dims.height;
    const textureScaleX = dims.textureScaleX > 0 ? dims.textureScaleX : (dims.width / Math.max(1, logicalWidth));
    const textureScaleY = dims.textureScaleY > 0 ? dims.textureScaleY : (dims.height / Math.max(1, logicalHeight));
    return { textureScaleX, textureScaleY, logicalWidth, logicalHeight };
  }

  private projectSectionLocalPointToScreen(
    layout: Section3DLayout,
    point: { x: number; y: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number } | null {
    const scale = this.getSectionTextureLogicalScale(layout);
    if (!scale) return null;
    return this.project3DTexturePointToScreen(layout, {
      x: point.x * scale.textureScaleX,
      y: point.y * scale.textureScaleY,
    }, options);
  }

  private projectSectionLocalRectToScreen(
    layout: Section3DLayout,
    rect: { x: number; y: number; w: number; h: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number; width: number; height: number } | null {
    const scale = this.getSectionTextureLogicalScale(layout);
    if (!scale) return null;
    return this.project3DTextureRectToScreen(layout, {
      x: rect.x * scale.textureScaleX,
      y: rect.y * scale.textureScaleY,
      w: rect.w * scale.textureScaleX,
      h: rect.h * scale.textureScaleY,
    }, options);
  }

  private projectSectionLocalRectQuadToScreen(
    layout: Section3DLayout,
    rect: { x: number; y: number; w: number; h: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): Array<{ x: number; y: number }> | null {
    const scale = this.getSectionTextureLogicalScale(layout);
    if (!scale) return null;
    return this.project3DTextureRectQuadToScreen(layout, {
      x: rect.x * scale.textureScaleX,
      y: rect.y * scale.textureScaleY,
      w: rect.w * scale.textureScaleX,
      h: rect.h * scale.textureScaleY,
    }, options);
  }

  private unprojectScreenPointToSectionLocal(
    layout: Section3DLayout,
    point: { x: number; y: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number } | null {
    const scale = this.getSectionTextureLogicalScale(layout);
    if (!scale) return null;

    if (!this.camera3D) return null;
    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return null;

    const ndcX = (point.x / canvasW) * 2 - 1;
    const ndcY = 1 - (point.y / canvasH) * 2;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);
    const invViewProj = mat4Invert(viewProj);
    if (!invViewProj) return null;

    const nearWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: -1 });
    const farWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: 1 });
    const rayDirWorld = vec3Normalize(vec3Sub(farWorld, nearWorld));

    const model = this.get3DCardModelMatrix(layout);
    const invModel = mat4Invert(model);
    if (!invModel) return null;

    const rayOriginLocal = mat4TransformPoint(invModel, nearWorld);
    const rayDirLocal = vec3Normalize(mat4TransformDirection(invModel, rayDirWorld));
    const denom = rayDirLocal.z;
    if (Math.abs(denom) < 1e-6) return null;

    const t = -rayOriginLocal.z / denom;
    if (t <= 0) return null;

    const hitLocal = vec3Add(rayOriginLocal, vec3Scale(rayDirLocal, t));
    let localX = (hitLocal.x + 0.5) * scale.logicalWidth;
    let localY = (0.5 - hitLocal.y) * scale.logicalHeight;

    if (!options?.allowOffscreen) {
      const inside = localX >= 0 && localX <= scale.logicalWidth && localY >= 0 && localY <= scale.logicalHeight;
      if (!inside) return null;
    }

    if (options?.clampToViewport) {
      localX = Math.max(0, Math.min(scale.logicalWidth, localX));
      localY = Math.max(0, Math.min(scale.logicalHeight, localY));
    }

    return { x: localX, y: localY };
  }

  private renderWorldsSectionBoundGUI(baseUI: Draw2D): void {
    const guiAPI: any = this.api?.gui;
    const system = guiAPI?.getSystem?.();
    if (!system) return;
    if (!this.worldsEnabled || !this.camera3D) return;

    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return;
    }

    const bindings: Array<{ group: string | number; sections: number[] }> = Array.isArray(guiAPI?._sectionBindings)
      ? guiAPI._sectionBindings
      : [];
    if (bindings.length === 0) return;
    const { charWidth, charHeight } = this.getGUIPixelMetrics();

    for (const binding of bindings) {
      for (const sectionIndex of binding.sections) {
        const layout = this.getSectionLayoutByIndex(sectionIndex);
        if (!layout || !layout.visible || layout.interactive === false || !layout.texture) continue;

        const xform = this.getWorldsSectionTextureToScreenAffine(layout);
        if (!xform) continue;

        // Render only this group's widgets, mapped from texture pixel coords to screen.
        const transformed = uiDocumentPack.createTransformedDraw2D(baseUI, {
          screenFromLocal: xform.screenFromTexPx,
          localFromScreen: xform.localFromScreenTexPx,
          clipRectScreen: xform.clipRectScreen,
        });
        (transformed as any).metrics = { charWidth, charHeight };

        system.renderGroup(binding.group, transformed, charWidth, charHeight);
      }
    }
  }

  private getWorldsSectionGUIMode(): 'baked' | 'overlay' {
    let mode: 'baked' | 'overlay' = 'overlay';
    if ((this.worldsConfig as any).sectionGuiMode === 'baked') {
      mode = 'baked';
    }
    return mode;
  }

  private clearWorldsInlineWidgets(): void {
    const guiAPI = this.api?.gui as any;
    const system = guiAPI?.getSystem?.();
    if (system && typeof system.getWidgetManager === 'function') {
      const manager = system.getWidgetManager();
      const focused = manager.getFocused();
      if (focused && this.worldsInlineWidgetInstances.some((entry) => entry.widget.id === focused.id)) {
        manager.focus(null);
      }
      for (const entry of this.worldsInlineWidgetInstances) {
        manager.unregister(entry.widget.id);
      }
    }
    this.worldsInlineWidgetInstances = [];
  }

  private ensureWorldsSectionLayoutCaches(layout: Section3DLayout): boolean {
    const hasTextureMetrics = this.sectionTextureCache.has(layout.sectionId);
    const hasWidgetPlacements = this.sectionWidgetPlacementsCache.has(layout.sectionId);
    if (hasTextureMetrics && hasWidgetPlacements) {
      return true;
    }

    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return false;
    }

    const texturePadding = 12;
    const textureScale = this.getWorldsTextureScale();
    const textureMode = (this.worldsConfig as any).sectionTextureMode;
    const minW = 256;
    const minH = 128;
    const maxTextureW = textureMode === 'webgpu-ui' ? 1024 : 2048;
    const maxTextureH = textureMode === 'webgpu-ui' ? 1024 : 2048;
    const maxW = Math.max(minW, Math.floor(maxTextureW / textureScale));
    const maxH = Math.max(minH, Math.floor(maxTextureH / textureScale));
    const logicalFontSizePx = Math.max(1, this.fontSize || 16);
    const fontStack =
      this.worldsCardFontStack ||
      this.fontFamily ||
      "'3270-regular', 'Consolas', 'Monaco', monospace";
    const measured = this.measureFontMetrics(fontStack, logicalFontSizePx);
    const measuredCharW = Math.max(1, measured.charW);
    const measuredCharH = Math.max(1, measured.charH);
    const baseLineHeight = Math.max(1, measured.baseLineHeight);
    const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
    const overflowCfg = (this.worldsConfig as any).sectionOverflow;
    const overflowMode: 'clip' | 'expand' | 'expand-y' | 'fit' | 'fit-y' =
      (overflowCfg === 'expand' || overflowCfg === 'expand-y' || overflowCfg === 'fit' || overflowCfg === 'fit-y')
        ? overflowCfg
        : 'clip';
    const layoutOverflow: 'clip' | 'expand' = overflowMode === 'clip' ? 'clip' : 'expand';

    const contentOverride = this.getWorldsSectionContentOverride(layout.sectionId);
    const markdown = buildWorldsCardMarkdown(layout, contentOverride ?? undefined);
    const nodes = uiDocumentPack.parseMarkdownLite(markdown);
    const activeLink = this.getActive3DLink();
    const activeLinkIndex = activeLink && activeLink.sectionIndex === layout.sectionIndex
      ? activeLink.linkIndex
      : null;
    const proceduralRuledPaper = this.isWorldsSectionBackgroundProceduralChainEnabled();
    const bakedRuledPaper = this.isWorldsSectionBackgroundBakedRuledLines();
    const shaderBg = !!this.parseWorldsSectionBackgroundShader();
    const textureBg = !!this.parseWorldsSectionBackgroundTexture();
    const surfaceBg = this.resolveWorldsSectionBackground();
    const mdBg = (proceduralRuledPaper || bakedRuledPaper || shaderBg || textureBg)
      ? this.withAlpha(surfaceBg, 0)
      : surfaceBg;
    const mdStyle = this.createWorldsMarkdownStyle({
      activeLinkIndex,
      background: mdBg,
      foreground: this.resolveEffectiveSectionForeground(layout.sectionId) ?? undefined,
      textAlign: layout.textAlign,
    });

    let widthPx = Math.max(
      minW,
      Math.min(
        maxW,
        units === 'px'
          ? Math.round(layout.width + texturePadding * 2)
          : Math.round(layout.width * measuredCharW + texturePadding * 2)
      )
    );
    let heightPx = Math.max(
      minH,
      Math.min(
        maxH,
        units === 'px'
          ? Math.round(layout.height + texturePadding * 2)
          : Math.round(layout.height * baseLineHeight + texturePadding * 2)
      )
    );

    const measureCtx = (() => {
      if (!this.worldsCardFontStack) return null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16;
        canvas.height = 16;
        const ctx = canvas.getContext('2d', { alpha: true } as any) as CanvasRenderingContext2D | null;
        if (!ctx) return null;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = `${logicalFontSizePx}px ${fontStack}`;
        return ctx;
      } catch {
        return null;
      }
    })();
    const measureTextWidth = this.worldsCardFontStack && measureCtx
      ? (text: string) => measureCtx.measureText(text).width
      : undefined;

    if (overflowMode !== 'clip') {
      const probeWidthPx = overflowMode === 'fit' ? maxW : widthPx;
      const probe = uiDocumentPack.layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: probeWidthPx, height: heightPx },
        {
          charW: measuredCharW,
          charH: measuredCharH,
          measureTextWidth,
          getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
        },
        mdStyle,
        0,
        texturePadding,
        { overflow: 'expand' }
      );

      const reqW = Math.ceil(probe.contentWidth + texturePadding * 2);
      const reqH = Math.ceil(probe.contentHeight + texturePadding * 2);
      const clampedW = Math.max(minW, Math.min(maxW, reqW));
      const clampedH = Math.max(minH, Math.min(maxH, reqH));

      if (overflowMode === 'expand') {
        widthPx = Math.max(widthPx, clampedW);
        heightPx = Math.max(heightPx, clampedH);
      } else if (overflowMode === 'expand-y') {
        heightPx = Math.max(heightPx, clampedH);
      } else if (overflowMode === 'fit') {
        widthPx = clampedW;
        heightPx = clampedH;
      } else if (overflowMode === 'fit-y') {
        heightPx = clampedH;
      }
    }

    const result = uiDocumentPack.layoutMarkdownDocument(
      nodes,
      { x: 0, y: 0, width: widthPx, height: heightPx },
      {
        charW: measuredCharW,
        charH: measuredCharH,
        measureTextWidth,
        getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
      },
      mdStyle,
      0,
      texturePadding,
      this.getWorldsWidgetLayoutOptions(layout.sectionIndex, layoutOverflow)
    );

    this.applyWorldsContentAlignment(result, widthPx, heightPx, texturePadding, layout.contentAlign);

    if (!hasTextureMetrics) {
      this.sectionTextureCache.set(layout.sectionId, {
        width: Math.max(1, Math.round(widthPx * textureScale)),
        height: Math.max(1, Math.round(heightPx * textureScale)),
        logicalWidth: widthPx,
        logicalHeight: heightPx,
        textureScaleX: textureScale,
        textureScaleY: textureScale,
        activeLinkIndex,
      });
    }
    if (!this.sectionLinkRegionsCache.has(layout.sectionId)) {
      this.sectionLinkRegionsCache.set(layout.sectionId, this.scaleLinkRegions(result.linkRegions, textureScale));
    }
    if (!hasWidgetPlacements) {
      this.sectionWidgetPlacementsCache.set(layout.sectionId, this.scaleWidgetPlacements(result.widgetPlacements, textureScale));
    }

    return true;
  }

  private getActiveWorldsInlineWidgetPlacements(): { layout: Section3DLayout; placements: WidgetPlacement[] } | null {
    const layout = this.getCurrent3DSectionLayout();
    if (!layout || !layout.visible || layout.interactive === false) return null;
    if (!this.ensureWorldsSectionLayoutCaches(layout)) return null;
    const placements = this.sectionWidgetPlacementsCache.get(layout.sectionId);
    if (!placements || placements.length === 0) return null;
    return { layout, placements };
  }

  private project3DTextureRectToScreen(
    layout: Section3DLayout,
    rect: { x: number; y: number; w: number; h: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number; width: number; height: number } | null {
    const screenPoints = this.project3DTextureRectQuadToScreen(layout, rect, options);
    if (!screenPoints) return null;
    const xs = screenPoints.map((point) => point.x);
    const ys = screenPoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (![minX, maxX, minY, maxY].every(Number.isFinite)) return null;

    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  private slugifyWorldsAnchor(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[`*_~]/g, '')
      .replace(/\{[^}]*\}\s*$/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private resolveWorldsInternalLinkTarget(url: string): Section3DLayout | null {
    if (typeof url !== 'string' || !url.startsWith('#')) return null;

    let target = '';
    try {
      target = decodeURIComponent(url.slice(1)).trim();
    } catch {
      target = url.slice(1).trim();
    }
    if (!target) return null;

    const targetSlug = this.slugifyWorldsAnchor(target);
    return this.section3DLayouts.find((layout) => {
      const title = (layout.displayTitle || layout.sectionTitle || '').trim();
      return this.slugifyWorldsAnchor(title) === targetSlug;
    }) ?? null;
  }

  private projectWorldPointToScreen(
    point: { x: number; y: number; z: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number } | null {
    if (!this.camera3D) return null;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return null;

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);
    const clip = mat4TransformVec4(viewProj, point.x, point.y, point.z, 1);
    if (clip.w <= 1e-6) return null;

    const ndcX = clip.x / clip.w;
    const ndcY = clip.y / clip.w;
    if (!Number.isFinite(ndcX) || !Number.isFinite(ndcY)) return null;

    const clampToViewport = options?.clampToViewport === true;
    const allowOffscreen = options?.allowOffscreen === true;
    if (!clampToViewport && !allowOffscreen && (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1)) return null;

    const screenMarginNdc = 0.94;
    const finalNdcX = clampToViewport ? Math.max(-screenMarginNdc, Math.min(screenMarginNdc, ndcX)) : ndcX;
    const finalNdcY = clampToViewport ? Math.max(-screenMarginNdc, Math.min(screenMarginNdc, ndcY)) : ndcY;

    return {
      x: (finalNdcX * 0.5 + 0.5) * canvasW,
      y: (1 - (finalNdcY * 0.5 + 0.5)) * canvasH,
    };
  }

  private getSectionScreenCenter(
    layout: Section3DLayout,
    options?: { clampToViewport?: boolean }
  ): { x: number; y: number } | null {
    const model = this.get3DCardModelMatrix(layout);
    const center = mat4TransformPoint(model, { x: 0, y: 0, z: 0 });
    return this.projectWorldPointToScreen(center, options);
  }

  private project3DCardLocalPointToScreen(
    layout: Section3DLayout,
    localPoint: { x: number; y: number; z: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number } | null {
    const model = this.get3DCardModelMatrix(layout);
    const world = mat4TransformPoint(model, localPoint);
    return this.projectWorldPointToScreen(world, options);
  }

  private project3DTexturePointToScreen(
    layout: Section3DLayout,
    point: { x: number; y: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): { x: number; y: number } | null {
    const dims = this.sectionTextureCache.get(layout.sectionId);
    if (!dims || dims.width <= 0 || dims.height <= 0) return null;

    const u = point.x / dims.width;
    const v = point.y / dims.height;
    return this.project3DCardLocalPointToScreen(
      layout,
      { x: u - 0.5, y: 0.5 - v, z: 0 },
      options,
    );
  }

  private project3DTextureRectQuadToScreen(
    layout: Section3DLayout,
    rect: { x: number; y: number; w: number; h: number },
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): Array<{ x: number; y: number }> | null {
    const points = [
      this.project3DTexturePointToScreen(layout, { x: rect.x, y: rect.y }, options),
      this.project3DTexturePointToScreen(layout, { x: rect.x + rect.w, y: rect.y }, options),
      this.project3DTexturePointToScreen(layout, { x: rect.x + rect.w, y: rect.y + rect.h }, options),
      this.project3DTexturePointToScreen(layout, { x: rect.x, y: rect.y + rect.h }, options),
    ];
    return points.every((point) => !!point) ? (points as Array<{ x: number; y: number }>) : null;
  }

  getSectionScreenQuad(
    layout: Section3DLayout,
    options?: { clampToViewport?: boolean; allowOffscreen?: boolean }
  ): Array<{ x: number; y: number }> | null {
    const points = [
      this.project3DCardLocalPointToScreen(layout, { x: -0.5, y: -0.5, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: 0.5, y: -0.5, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: 0.5, y: 0.5, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: -0.5, y: 0.5, z: 0 }, options),
    ];
    return points.every((point) => !!point) ? (points as Array<{ x: number; y: number }>) : null;
  }

  private getPolygonCenter(points: Array<{ x: number; y: number }>): { x: number; y: number } | null {
    if (!points.length) return null;
    let sumX = 0;
    let sumY = 0;
    for (const point of points) {
      sumX += point.x;
      sumY += point.y;
    }
    return { x: sumX / points.length, y: sumY / points.length };
  }

  private intersectRayWithSegment2D(
    origin: { x: number; y: number },
    dir: { x: number; y: number },
    a: { x: number; y: number },
    b: { x: number; y: number }
  ): { x: number; y: number; t: number } | null {
    const seg = { x: b.x - a.x, y: b.y - a.y };
    const cross = dir.x * seg.y - dir.y * seg.x;
    if (Math.abs(cross) < 1e-6) return null;

    const ao = { x: a.x - origin.x, y: a.y - origin.y };
    const t = (ao.x * seg.y - ao.y * seg.x) / cross;
    const u = (ao.x * dir.y - ao.y * dir.x) / cross;
    if (t < 0 || u < 0 || u > 1) return null;
    return { x: origin.x + dir.x * t, y: origin.y + dir.y * t, t };
  }

  private getPolygonAttachmentPoint(
    polygon: Array<{ x: number; y: number }>,
    towardPoint: { x: number; y: number } | null
  ): { x: number; y: number } | null {
    const center = this.getPolygonCenter(polygon);
    if (!center) return null;
    if (!towardPoint) return center;

    const dir = { x: towardPoint.x - center.x, y: towardPoint.y - center.y };
    const dirLen = Math.hypot(dir.x, dir.y);
    if (dirLen < 1e-6) return center;
    dir.x /= dirLen;
    dir.y /= dirLen;

    let best: { x: number; y: number; t: number } | null = null;
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const hit = this.intersectRayWithSegment2D(center, dir, a, b);
      if (!hit) continue;
      if (!best || hit.t < best.t) best = hit;
    }

    if (best) return { x: best.x, y: best.y };

    let fallback = polygon[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const point of polygon) {
      const dx = point.x - towardPoint.x;
      const dy = point.y - towardPoint.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        fallback = point;
        bestDist = dist;
      }
    }
    return fallback;
  }

  private getSectionScreenAttachmentPoint(
    layout: Section3DLayout,
    towardPoint: { x: number; y: number } | null,
    options?: { clampToViewport?: boolean }
  ): { x: number; y: number } | null {
    const candidates = [
      this.project3DCardLocalPointToScreen(layout, { x: -0.5, y: 0, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: 0.5, y: 0, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: 0, y: 0.5, z: 0 }, options),
      this.project3DCardLocalPointToScreen(layout, { x: 0, y: -0.5, z: 0 }, options),
      this.getSectionScreenCenter(layout, options),
    ].filter((point): point is { x: number; y: number } => !!point);

    if (candidates.length === 0) return null;
    if (!towardPoint) return candidates[candidates.length - 1] ?? null;

    let best = candidates[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const dx = candidate.x - towardPoint.x;
      const dy = candidate.y - towardPoint.y;
      const dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        best = candidate;
        bestDist = dist;
      }
    }
    return best;
  }

  private getVisual3DLinkConnections(options?: {
    section?: number | string | null;
    visibleOnly?: boolean;
    internalOnly?: boolean;
  }): WorldsVisualLinkConnection[] {
    if (!this.worldsEnabled || !this.camera3D) return [];

    const visibleOnly = options?.visibleOnly === true;
    const internalOnly = options?.internalOnly === true;
    const requested = options?.section !== undefined && options?.section !== null
      ? this.resolveRuntimeSectionRef(options.section)
      : null;
    const requestedSectionId = requested?.sectionId ?? null;

    const out: WorldsVisualLinkConnection[] = [];
    for (const layout of this.section3DLayouts) {
      if (requestedSectionId && layout.sectionId !== requestedSectionId) continue;
      if (!layout.texture || !layout.visible || layout.interactive === false) continue;

      const regions = this.sectionLinkRegionsCache.get(layout.sectionId);
      if (!regions || regions.length === 0) continue;

      for (let linkIndex = 0; linkIndex < regions.length; linkIndex++) {
        const region = regions[linkIndex];
        const internal = typeof region.url === 'string' && region.url.startsWith('#');
        const relation = typeof region.meta?.rel === 'string' && region.meta.rel.trim()
          ? region.meta.rel.trim()
          : (typeof region.title === 'string' && region.title.trim() ? region.title.trim() : null);
        if (internalOnly && !internal) continue;

        const targetLayout = internal ? this.resolveWorldsInternalLinkTarget(region.url) : null;
        const sourceRectScreen = this.project3DTextureRectToScreen(layout, region);
        const sourceQuadScreen = this.project3DTextureRectQuadToScreen(layout, region);
        const targetCenterScreen = targetLayout ? this.getSectionScreenCenter(targetLayout, { clampToViewport: true }) : null;
        const targetQuadScreen = targetLayout ? this.getSectionScreenQuad(targetLayout, { allowOffscreen: true }) : null;

        const sourcePointScreen = sourceQuadScreen
          ? this.getPolygonAttachmentPoint(sourceQuadScreen, targetCenterScreen)
          : null;

        const targetPointScreen = targetQuadScreen
          ? this.getPolygonAttachmentPoint(targetQuadScreen, sourcePointScreen)
          : (targetLayout ? this.getSectionScreenAttachmentPoint(targetLayout, sourcePointScreen, { clampToViewport: true }) : null);

        const isVisible = !!sourcePointScreen && (!internal || !targetLayout || !!targetPointScreen);
        if (visibleOnly && !isVisible) continue;

        out.push({
          sourceSectionId: layout.sectionId,
          sourceSectionIndex: layout.sectionIndex,
          sourceTitle: layout.displayTitle || layout.sectionTitle,
          linkIndex,
          url: region.url,
          text: region.text,
          title: typeof region.title === 'string' ? region.title : null,
          meta: region.meta ? { ...region.meta } : null,
          relation,
          internal,
          targetSectionId: targetLayout?.sectionId ?? null,
          targetSectionIndex: targetLayout?.sectionIndex ?? null,
          targetTitle: targetLayout ? (targetLayout.displayTitle || targetLayout.sectionTitle) : null,
          sourceRectScreen,
          sourceQuadScreen,
          sourcePointScreen,
          targetPointScreen,
          visible: isVisible,
        });
      }
    }

    return out;
  }

  private getTextureRectLocalBounds(layout: Section3DLayout, rect: { x: number; y: number; w: number; h: number }): { minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number } | null {
    const dims = this.sectionTextureCache.get(layout.sectionId);
    if (!dims || dims.width <= 0 || dims.height <= 0) return null;

    const uMin = rect.x / dims.width;
    const uMax = (rect.x + rect.w) / dims.width;
    const vMin = rect.y / dims.height;
    const vMax = (rect.y + rect.h) / dims.height;

    const minX = uMin - 0.5;
    const maxX = uMax - 0.5;
    const maxY = 0.5 - vMin;
    const minY = 0.5 - vMax;
    return {
      minX,
      maxX,
      minY,
      maxY,
      centerX: (minX + maxX) * 0.5,
      centerY: (minY + maxY) * 0.5,
    };
  }

  private getRectAttachmentPointLocal(
    bounds: { minX: number; maxX: number; minY: number; maxY: number; centerX: number; centerY: number },
    toward: { x: number; y: number }
  ): { x: number; y: number } {
    const dx = toward.x - bounds.centerX;
    const dy = toward.y - bounds.centerY;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
      return { x: bounds.maxX, y: bounds.centerY };
    }

    const tx = Math.abs(dx) > 1e-6
      ? ((dx > 0 ? bounds.maxX : bounds.minX) - bounds.centerX) / dx
      : Number.POSITIVE_INFINITY;
    const ty = Math.abs(dy) > 1e-6
      ? ((dy > 0 ? bounds.maxY : bounds.minY) - bounds.centerY) / dy
      : Number.POSITIVE_INFINITY;
    const t = Math.min(
      Number.isFinite(tx) && tx > 0 ? tx : Number.POSITIVE_INFINITY,
      Number.isFinite(ty) && ty > 0 ? ty : Number.POSITIVE_INFINITY,
    );
    if (!Number.isFinite(t)) {
      return { x: bounds.centerX, y: bounds.centerY };
    }
    return {
      x: bounds.centerX + dx * t,
      y: bounds.centerY + dy * t,
    };
  }

  private getCardAttachmentPointLocal(toward: { x: number; y: number }): { x: number; y: number } {
    return this.getRectAttachmentPointLocal(
      { minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5, centerX: 0, centerY: 0 },
      toward,
    );
  }

  private getRendered3DLinkConnectors(): Array<{ start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number }; control: { x: number; y: number; z: number }; color: Color; thickness: number; opacity: number }> {
    if (!this.worlds3DRenderedLinkOverlay.enabled) return [];

    // Match the theme colors used by markdown anchor links on Worlds cards.
    // Normal: theme `link` foreground. Active (hover/focus): theme `active` foreground.
    const themeLinkColor = this.getStyle('link').fg;
    const themeActiveLinkColor = this.getStyle('active').fg;
    const activeLink = this.getActive3DLink();

    const connectors: Array<{ start: { x: number; y: number; z: number }; end: { x: number; y: number; z: number }; control: { x: number; y: number; z: number }; color: Color; thickness: number; opacity: number }> = [];

    const getBezierControlPoint = (start: { x: number; y: number; z: number }, end: { x: number; y: number; z: number }): { x: number; y: number; z: number } => {
      // Stable, camera-independent curve: bend “up” in world space.
      // Compute a bend direction that is perpendicular to the line segment and
      // as aligned with worldUp as possible.
      const worldUp = { x: 0, y: 1, z: 0 };
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const dz = end.z - start.z;
      const dist = Math.hypot(dx, dy, dz);
      if (!(dist > 1e-6)) {
        return { x: (start.x + end.x) * 0.5, y: (start.y + end.y) * 0.5, z: (start.z + end.z) * 0.5 };
      }
      const dir = { x: dx / dist, y: dy / dist, z: dz / dist };

      // Project worldUp into the plane perpendicular to dir.
      // bend = normalize(worldUp - dir * dot(worldUp, dir))
      const dot = worldUp.x * dir.x + worldUp.y * dir.y + worldUp.z * dir.z;
      let bx = worldUp.x - dir.x * dot;
      let by = worldUp.y - dir.y * dot;
      let bz = worldUp.z - dir.z * dot;
      let blen = Math.hypot(bx, by, bz);
      if (!(blen > 1e-6)) {
        // If dir ~ worldUp, fall back to a fixed axis.
        bx = 1;
        by = 0;
        bz = 0;
        blen = 1;
      }
      bx /= blen;
      by /= blen;
      bz /= blen;

      // Bend magnitude: 20% of segment length for consistent visible curvature at any scale.
      const bend = dist * 0.2;
      const mx = (start.x + end.x) * 0.5;
      const my = (start.y + end.y) * 0.5;
      const mz = (start.z + end.z) * 0.5;
      return { x: mx + bx * bend, y: my + by * bend, z: mz + bz * bend };
    };

    const addConnectorsForSource = (sourceLayout: Section3DLayout): void => {
      if (!sourceLayout || !sourceLayout.visible || !sourceLayout.texture) return;

      const regions = this.sectionLinkRegionsCache.get(sourceLayout.sectionId);
      if (!regions || regions.length === 0) return;

      const sourceModel = this.get3DCardModelMatrix(sourceLayout);
      const sourceInv = mat4Invert(sourceModel);
      if (!sourceInv) return;

      for (let linkIndex = 0; linkIndex < regions.length; linkIndex++) {
        const region = regions[linkIndex];
        const internal = typeof region.url === 'string' && region.url.startsWith('#');
        if (this.worlds3DRenderedLinkOverlay.internalOnly && !internal) continue;

        const targetLayout = internal ? this.resolveWorldsInternalLinkTarget(region.url) : null;
        if (!targetLayout || !targetLayout.visible || !targetLayout.texture) continue;

        const sourceBounds = this.getTextureRectLocalBounds(sourceLayout, region);
        if (!sourceBounds) continue;

        const targetModel = this.get3DCardModelMatrix(targetLayout);
        const targetInv = mat4Invert(targetModel);
        if (!targetInv) continue;

        const targetCenterWorld = mat4TransformPoint(targetModel, { x: 0, y: 0, z: 0 });
        const targetCenterInSource = mat4TransformPoint(sourceInv, targetCenterWorld);
        const sourceAnchorLocal = this.getRectAttachmentPointLocal(sourceBounds, targetCenterInSource);
        const sourceAnchorWorld = mat4TransformPoint(sourceModel, { x: sourceAnchorLocal.x, y: sourceAnchorLocal.y, z: 0 });

        const sourceAnchorInTarget = mat4TransformPoint(targetInv, sourceAnchorWorld);
        const targetAnchorLocal = this.getCardAttachmentPointLocal(sourceAnchorInTarget);
        const targetAnchorWorld = mat4TransformPoint(targetModel, { x: targetAnchorLocal.x, y: targetAnchorLocal.y, z: 0 });

        connectors.push({
          start: sourceAnchorWorld,
          end: targetAnchorWorld,
          control: getBezierControlPoint(sourceAnchorWorld, targetAnchorWorld),
          color: (activeLink
            && activeLink.sectionIndex === sourceLayout.sectionIndex
            && activeLink.linkIndex === linkIndex)
            ? themeActiveLinkColor
            : themeLinkColor,
          thickness: this.worlds3DRenderedLinkOverlay.thickness,
          opacity: 0.92,
        });
      }
    };

    if (this.worlds3DRenderedLinkOverlay.allVisible) {
      if (!this.section3DLayouts || this.section3DLayouts.length === 0) return [];
      for (const layout of this.section3DLayouts) {
        if (!layout) continue;
        addConnectorsForSource(layout);
      }
      return connectors;
    }

    const requested = this.worlds3DRenderedLinkOverlay.section !== undefined && this.worlds3DRenderedLinkOverlay.section !== null
      ? this.resolveRuntimeSectionRef(this.worlds3DRenderedLinkOverlay.section)
      : null;
    const fallbackSection = this.getResolvedSelected3DSectionIndex();
    const sectionIndex = requested?.sectionIndex ?? fallbackSection;
    if (!(typeof sectionIndex === 'number' && Number.isFinite(sectionIndex))) return [];

    const sourceLayout = this.getSectionLayoutByIndex(sectionIndex);
    if (!sourceLayout) return [];
    addConnectorsForSource(sourceLayout);
    return connectors;
  }

  private getWorldsInlineWidgetRenderScale(
    placement: WidgetPlacement,
    projected: { width: number; height: number }
  ): number {
    const sx = placement.w > 0 ? projected.width / placement.w : 1;
    const sy = placement.h > 0 ? projected.height / placement.h : 1;
    const scale = Math.min(sx, sy);
    if (!Number.isFinite(scale) || scale <= 0) return 1;
    return Math.max(0.35, Math.min(6, scale));
  }

  private syncWorldsInlineWidgets(): void {
    const guiAPI = this.api?.gui as any;
    let system = guiAPI?.getSystem?.();
    if (!system && typeof guiAPI?.init === 'function') {
      try {
        guiAPI.init({ boundsSpace: 'device' });
        system = guiAPI.getSystem?.();
      } catch {
        system = null;
      }
    }
    if (!system) {
      this.debugGuiLogInlineWidgets('no-gui-system', {});
      this.clearWorldsInlineWidgets();
      return;
    }

    const active = this.getActiveWorldsInlineWidgetPlacements();
    if (!active) {
      const layout = this.getCurrent3DSectionLayout();
      if (!layout) {
        this.debugGuiLogInlineWidgets('inactive', {
          reason: 'no-current-layout',
          currentSectionId: this.current3DSectionId,
          currentSectionIndex: this.getResolvedCurrent3DSectionIndex(),
        });
      } else if (!layout.visible) {
        this.debugGuiLogInlineWidgets('inactive', {
          reason: 'layout-hidden',
          sectionId: layout.sectionId,
          sectionIndex: layout.sectionIndex,
        });
      } else if (layout.interactive === false) {
        this.debugGuiLogInlineWidgets('inactive', {
          reason: 'layout-noninteractive',
          sectionId: layout.sectionId,
          sectionIndex: layout.sectionIndex,
        });
      } else if (!this.ensureWorldsSectionLayoutCaches(layout)) {
        this.debugGuiLogInlineWidgets('inactive', {
          reason: 'layout-cache-miss',
          sectionId: layout.sectionId,
          sectionIndex: layout.sectionIndex,
        });
      } else {
        const placements = this.sectionWidgetPlacementsCache.get(layout.sectionId) ?? [];
        this.debugGuiLogInlineWidgets('inactive', {
          reason: placements.length === 0 ? 'no-widget-placements' : 'projection-failed',
          sectionId: layout.sectionId,
          sectionIndex: layout.sectionIndex,
          placementIds: placements.map((placement) => placement.widget.id),
        });
      }
      this.clearWorldsInlineWidgets();
      return;
    }

    this.debugGuiLogInlineWidgets('active', {
      sectionId: active.layout.sectionId,
      sectionIndex: active.layout.sectionIndex,
      placementIds: active.placements.map((placement) => placement.widget.id),
    });

    const nextKeys = new Set(active.placements.map((placement) => this.getWorldsInlineWidgetStateKey(active.layout.sectionIndex, placement.widget.id)));
    const manager = system.getWidgetManager();

    for (let i = this.worldsInlineWidgetInstances.length - 1; i >= 0; i--) {
      const entry = this.worldsInlineWidgetInstances[i];
      const key = this.getWorldsInlineWidgetStateKey(entry.sectionIndex, entry.widgetId);
      if (entry.sectionId !== active.layout.sectionId || !nextKeys.has(key)) {
        manager.unregister(entry.widget.id);
        this.worldsInlineWidgetInstances.splice(i, 1);
      }
    }

    for (const placement of active.placements) {
      const projected = this.project3DTextureRectToScreen(active.layout, placement);
      const widgetKey = this.getWorldsInlineWidgetStateKey(active.layout.sectionIndex, placement.widget.id);
      const configState = this.worldsInlineWidgetConfigState.get(widgetKey);
      if (!projected) continue;
      const renderScale = placement.widget.scale === 'worlds'
        ? this.getWorldsInlineWidgetRenderScale(placement, projected)
        : 1;

      let entry = this.worldsInlineWidgetInstances.find((item) => item.sectionId === active.layout.sectionId && item.widgetId === placement.widget.id);
      if (!entry) {
        const persisted = this.worldsInlineWidgetValueState.get(widgetKey);
        const bounds = { x: projected.x, y: projected.y, width: projected.width, height: projected.height };
        let widget: any;
        if (placement.widget.type === 'button') {
          widget = system.createButton({
            id: `worlds-inline-${widgetKey}`,
            group: '__worlds-inline-widgets',
            bounds,
            label: String(placement.widget.label || placement.widget.id),
          });
          widget.on('click', () => {
            this.worldsInlineWidgetEventsQueue.push({
              id: placement.widget.id,
              kind: 'button',
              sectionIndex: active.layout.sectionIndex,
              action: 'click',
            });
          });
        } else if (placement.widget.type === 'slider') {
          const configMin = configState?.min;
          const configMax = configState?.max;
          const configStep = configState?.step;
          let min = 0;
          if (Number.isFinite(configMin)) {
            min = Number(configMin);
          } else if (Number.isFinite(placement.widget.min)) {
            min = Number(placement.widget.min);
          }

          let max = 100;
          if (Number.isFinite(configMax)) {
            max = Number(configMax);
          } else if (Number.isFinite(placement.widget.max)) {
            max = Number(placement.widget.max);
          }

          let value = 0;
          if (typeof persisted === 'number') {
            value = persisted;
          } else if (Number.isFinite(placement.widget.value)) {
            value = Number(placement.widget.value);
          }

          let step = 1;
          if (Number.isFinite(configStep)) {
            step = Number(configStep);
          } else if (Number.isFinite(placement.widget.step)) {
            step = Number(placement.widget.step);
          }

          widget = system.createSlider({
            id: `worlds-inline-${widgetKey}`,
            group: '__worlds-inline-widgets',
            bounds,
            label: String(configState?.label ?? placement.widget.label ?? ''),
            min,
            max,
            value,
            step,
            showValue: typeof configState?.showValue === 'boolean' ? configState.showValue : placement.widget.showValue,
            sliderStyle: {
              ...(typeof configState?.fg === 'number' ? { fg: configState.fg } : {}),
              ...(typeof configState?.trackColor === 'number' ? { trackColor: configState.trackColor } : {}),
              ...(typeof configState?.knobColor === 'number' ? { knobColor: configState.knobColor } : {}),
              ...(typeof configState?.knobHoverColor === 'number' ? { knobHoverColor: configState.knobHoverColor } : {}),
            },
          });
        } else if (placement.widget.type === 'checkbox') {
          widget = system.createCheckbox({
            id: `worlds-inline-${widgetKey}`,
            group: '__worlds-inline-widgets',
            bounds,
            label: String(placement.widget.label || placement.widget.id),
            checked: typeof persisted === 'boolean'
              ? persisted
              : !!placement.widget.checked,
          });
          widget.on('click', () => {
            const checked = !!widget.isChecked();
            this.worldsInlineWidgetValueState.set(widgetKey, checked);
            this.worldsInlineWidgetEventsQueue.push({
              id: placement.widget.id,
              kind: 'checkbox',
              sectionIndex: active.layout.sectionIndex,
              action: 'toggle',
              value: checked,
            });
          });
        } else {
          widget = system.createLabel({
            id: `worlds-inline-${widgetKey}`,
            group: '__worlds-inline-widgets',
            bounds,
            align: placement.widget.align || 'left',
            focusable: false,
            text: String(placement.widget.text || placement.widget.label || placement.widget.id),
          });
        }

        entry = {
          engineId: widgetKey,
          sectionId: active.layout.sectionId,
          sectionIndex: active.layout.sectionIndex,
          widgetId: placement.widget.id,
          kind: placement.widget.type,
          widget,
          lastValue: undefined,
        };
        if (placement.widget.type === 'slider') {
          entry.lastValue = widget.getValue();
        } else if (placement.widget.type === 'checkbox') {
          entry.lastValue = !!widget.isChecked();
        }
        if (entry.lastValue !== undefined) {
          this.worldsInlineWidgetValueState.set(widgetKey, entry.lastValue);
        }
        this.worldsInlineWidgetInstances.push(entry);
      }

      entry.widget.setVisible(true);
      entry.widget.setEnabled(true);
      if (typeof entry.widget.setRenderScale === 'function') {
        entry.widget.setRenderScale(renderScale);
      }
      entry.widget.setBounds({
        x: projected.x,
        y: projected.y,
        width: projected.width,
        height: projected.height,
      });

      if (entry.kind === 'slider') {
        const currentValue = entry.widget.getValue();
        if (entry.lastValue !== currentValue) {
          entry.lastValue = currentValue;
          this.worldsInlineWidgetValueState.set(widgetKey, currentValue);
          this.worldsInlineWidgetEventsQueue.push({
            id: placement.widget.id,
            kind: 'slider',
            sectionIndex: active.layout.sectionIndex,
            action: 'change',
            value: currentValue,
          });
        }
      } else if (entry.kind === 'checkbox') {
        const checked = !!entry.widget.isChecked();
        entry.lastValue = checked;
        this.worldsInlineWidgetValueState.set(widgetKey, checked);
      }
    }
  }

  private handleWorldsInlineWidgetMouse(pixelX: number, pixelY: number, mouseDown: boolean): boolean {
    if (this.worldsInlineWidgetInstances.length === 0) return false;
    const guiAPI = this.api?.gui as any;
    const system = guiAPI?.getSystem?.();
    if (!system) return false;

    const { charWidth, charHeight } = this.getGUIPixelMetrics();
    const hitBefore = this.worldsInlineWidgetInstances.some((entry) => entry.widget.containsPoint({ x: pixelX, y: pixelY }));
    const draggingBefore = this.worldsInlineWidgetInstances.some((entry) => entry.kind === 'slider' && typeof entry.widget.isDragging === 'function' && entry.widget.isDragging());

    system.handleMouse(pixelX, pixelY, mouseDown, charWidth, charHeight);
    this.syncWorldsInlineWidgets();

    return hitBefore || draggingBefore;
  }

  private handleWorldsSectionBoundGUIMouse(pixelX: number, pixelY: number, mouseDown: boolean): boolean {
    const guiAPI: any = this.api?.gui;
    const system = guiAPI?.getSystem?.();
    if (!system) return false;
    if (!this.worldsEnabled || !this.camera3D) return false;

    const bindings: Array<{ group: string | number; sections: number[] }> = Array.isArray(guiAPI?._sectionBindings)
      ? guiAPI._sectionBindings
      : [];
    if (bindings.length === 0) return false;

    const { charWidth, charHeight } = this.getGUIPixelMetrics();

    // Prefer current/selected section first for UX.
    const preferred = this.getResolvedSelected3DSectionIndex();

    const candidates: Array<{ group: string | number; sectionIndex: number }> = [];
    for (const binding of bindings) {
      for (const sectionIndex of binding.sections) {
        candidates.push({ group: binding.group, sectionIndex });
      }
    }
    candidates.sort((a, b) => {
      const ap = a.sectionIndex === preferred ? -1 : 0;
      const bp = b.sectionIndex === preferred ? -1 : 0;
      return ap - bp;
    });

    let handled = false;
    for (const candidate of candidates) {
      const layout = this.getSectionLayoutByIndex(candidate.sectionIndex);
      if (!layout || !layout.visible || layout.interactive === false || !layout.texture) continue;

      const xform = this.getWorldsSectionTextureToScreenAffine(layout);
      if (!xform) continue;

      // Quick reject: outside the clipped AABB.
      const clip = xform.clipRectScreen;
      if (pixelX < clip.x || pixelY < clip.y || pixelX > clip.x + clip.w || pixelY > clip.y + clip.h) {
        continue;
      }

      const local = {
        x: xform.localFromScreenTexPx.a * pixelX + xform.localFromScreenTexPx.c * pixelY + xform.localFromScreenTexPx.e,
        y: xform.localFromScreenTexPx.b * pixelX + xform.localFromScreenTexPx.d * pixelY + xform.localFromScreenTexPx.f,
      };

      // Only route if inside the section texture bounds.
      const dims = this.sectionTextureCache.get(layout.sectionId);
      if (!dims) continue;
      if (local.x < 0 || local.y < 0 || local.x > dims.width || local.y > dims.height) continue;

      const beforeFocus = system.getFocusedWidget?.();
      system.handleMouse(local.x, local.y, mouseDown, charWidth, charHeight);
      const afterFocus = system.getFocusedWidget?.();

      if (afterFocus && afterFocus.group === candidate.group) {
        handled = true;
        break;
      }

      // If focus didn't change but something in the group is hovered/pressed, we still consider it handled.
      if (beforeFocus && beforeFocus.group === candidate.group) {
        handled = true;
        break;
      }
    }

    return handled;
  }

  private handleOverlayRetainedGUIMouse(pixelX: number, pixelY: number, mouseDown: boolean): boolean {
    const guiAPI: any = this.api?.gui;
    const system = guiAPI?.getSystem?.();
    if (!system) return false;
    if (typeof guiAPI?.isAutoInputEnabled === 'function' && !guiAPI.isAutoInputEnabled()) return false;

    const excludedGroups = this.getWorldsSectionBoundGUIGroupIds(guiAPI);
    const hitBefore = this.isPointOverVisibleGUIWidget(pixelX, pixelY, excludedGroups);
    const focusedBefore = system.getFocusedWidget?.();
    const { charWidth, charHeight } = this.getGUIPixelMetrics();

    if (excludedGroups.size > 0 && typeof system.handleMouseExcludingGroups === 'function') {
      system.handleMouseExcludingGroups(pixelX, pixelY, mouseDown, charWidth, charHeight, excludedGroups);
    } else {
      system.handleMouse(pixelX, pixelY, mouseDown, charWidth, charHeight);
    }

    const focusedAfter = system.getFocusedWidget?.();
    return hitBefore || !!focusedBefore || !!focusedAfter;
  }

  private handleOverlayRetainedGUIKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean; meta?: boolean }): boolean {
    const guiAPI: any = this.api?.gui;
    const system = guiAPI?.getSystem?.();
    if (!system) return false;
    if (typeof guiAPI?.isAutoInputEnabled === 'function' && !guiAPI.isAutoInputEnabled()) return false;

    const focused = system.getFocusedWidget?.();
    if (!focused) return false;

    const excludedGroups = this.getWorldsSectionBoundGUIGroupIds(guiAPI);
    if (excludedGroups.has(focused.group)) return false;

    const focusedIsInline = this.worldsInlineWidgetInstances.some((entry) => entry.widget.id === focused.id);
    if (focusedIsInline) return false;

    system.handleKey(key, modifiers);
    return true;
  }

  private handleWorldsInlineWidgetKey(key: string, modifiers?: { shift?: boolean; ctrl?: boolean; alt?: boolean }): boolean {
    const active = this.getActiveWorldsInlineWidgetPlacements();
    if (!active || active.placements.length === 0) return false;
    const guiAPI = this.api?.gui as any;
    const system = guiAPI?.getSystem?.();
    if (!system) return false;

    const focused = system.getFocusedWidget?.();
    const focusedIsInline = !!focused && this.worldsInlineWidgetInstances.some((entry) => entry.widget.id === focused.id);
    const navigatesInline = key === 'Tab' || key === 'ArrowLeft' || key === 'ArrowRight';
    const activatesInline = key === 'Enter' || key === ' ';
    if (!focusedIsInline && !navigatesInline) return false;

    if (navigatesInline || (activatesInline && focusedIsInline)) {
      system.handleKey(key, modifiers);
      return true;
    }

    return false;
  }

  private async prepareDocumentForActivation(parsed: MarkdownDocument): Promise<void> {
    if (this.documents.size > 0 || this.activeDocumentId) {
      try {
        await this.moduleLoader.unloadAll();
      } catch (error) {
        console.warn('[Engine] Failed to unload modules during document swap:', error);
      }

      this.documents.clear();
      this.worldsSectionContentOverridesByDocument.clear();
      this.worldsSectionOverridesByDocument.clear();
      this.sandbox.clearAll();
      this.activeDocumentId = null;
    }

    this.pendingShaderChain = null;
    if (this.shaderChainManager) {
      try {
        this.shaderChainManager.clearChain();
      } catch (error) {
        console.warn('[Engine] Failed to clear shader chain during document swap:', error);
      }
    }

    try {
      this.clear3DSectionTextures();
    } catch {
      // ignore
    }
    this.resetWorldsVisitState();
    this.resetRuntimeSectionStore();
    this.section3DLayouts = [];
    this.worldsEnabled = false;
    this.worldsOverviewEnabled = false;
    this.worldsOverviewSavedTransforms = null;
    this.pendingWorldsOverview = null;
    this.pending3DCameraFocus = null;
    if (this.worldsRenderer) {
      this.camera3D = createCamera3D();
    }

    if (parsed.wgslShaders && parsed.wgslShaders.length > 0) {
      console.log(`  Found ${parsed.wgslShaders.length} WGSL shader(s):`);
      for (const shader of parsed.wgslShaders) {
        console.log(`    - ${shader.name} (${shader.kind})`);
      }

      if (this.shaderManager) {
        console.log('  Registering shaders with ShaderManager...');
        try {
          const sm: any = this.shaderManager as any;
          if (typeof sm.registerShaders === 'function') {
            await sm.registerShaders(parsed.wgslShaders);
          } else {
            for (const shader of parsed.wgslShaders) {
              await this.shaderManager.registerShader(shader);
            }
          }
          console.log('    ✓ Registered WGSL shaders');
        } catch (error) {
          console.error('    ✗ Failed to register WGSL shaders:', error);
        }
      } else {
        console.log('  ⏳ ShaderManager not yet initialized - shaders will be registered when WebGPU starts');
      }
    }

    if (parsed.metadata.modules) {
      if (this.untrustedContent) {
        console.warn('[Engine] Skipping frontmatter module loading in untrusted mode');
      } else {
        const modules = Array.isArray(parsed.metadata.modules)
          ? parsed.metadata.modules
          : [parsed.metadata.modules];

        console.log(`  Loading ${modules.length} module(s):`, modules);

        try {
          await this.moduleLoader.loadAll(modules);
          console.log('  ✓ All modules loaded successfully');
        } catch (error) {
          console.error('  ✗ Failed to load modules:', error);
        }
      }
    }

    this.initializeRuntimeSectionStore(parsed.sections);

    this.compileWorldsLayoutsFromRuntimeSectionStore('load');

    if (this.themeOverrideFromUrl) {
      this.applyThemeColors(this.themeOverrideFromUrl.theme, this.themeOverrideFromUrl.label, 'url');
    } else if (parsed.metadata.theme) {
      const themeName = String(parsed.metadata.theme).toLowerCase().replace(/['"]/g, '');
      this.applyThemeColors(getTheme(themeName), themeName, 'frontmatter');
    } else {
      this.applyThemeColors(getTheme('neotopia'), 'neotopia', 'default');
    }

    this.layers.clearAll(this.currentTheme.bg);

    if (parsed.metadata.shaders) {
      const shadersStr = String(parsed.metadata.shaders);
      console.log(`  Shader chain (frontmatter): ${shadersStr}`);

      if (this.shaderChainManager) {
        await this.shaderChainManager.activateChainFromString(shadersStr, 'frontmatter');
      } else {
        console.log('  Deferring shader chain until WebGPU init');
        this.pendingShaderChain = { chainStr: shadersStr, source: 'frontmatter' };
      }
    }

    const fmW = Number(parsed.metadata.width);
    const fmH = Number(parsed.metadata.height);
    this.frontmatterViewport = (Number.isFinite(fmW) && fmW > 0 && Number.isFinite(fmH) && fmH > 0)
      ? { width: fmW, height: fmH }
      : null;
    if (this.frontmatterViewport) {
      console.log(`  Viewport constraint (frontmatter): ${fmW}x${fmH}px`);
    }

    const frontmatterKeys = Object.keys(parsed.metadata);
    if (frontmatterKeys.length > 0) {
      console.log(`  Exposed ${frontmatterKeys.length} frontmatter variable(s) as globals:`, frontmatterKeys.join(', '));
    }
  }

  private buildDocumentAssetStores(parsed: MarkdownDocument): DocumentAssetStores {
    const audioPack = this.getAudioRuntimePack();
    if (!audioPack) {
      throw new Error('Audio runtime pack must be installed before building document asset stores');
    }
    const textPack = this.getTextRuntimePack();

    const blobStore = new Map<string, BlobStoreEntry>();
    if (parsed.blobBlocks && parsed.blobBlocks.length > 0) {
      for (const b of parsed.blobBlocks) {
        const name = String(b.name ?? '').trim();
        if (!name) continue;
        const mime = String(b.mime ?? 'application/octet-stream').trim() || 'application/octet-stream';
        const encoding = (String((b as any).encoding ?? 'base64').trim().toLowerCase() === 'hex') ? 'hex' : 'base64';
        const data = encoding === 'hex'
          ? String(b.data ?? '')
          : String(b.data ?? '').replace(/\s+/g, '');
        if (!data) continue;
        if (blobStore.has(name)) {
          console.warn(`  [blob] Duplicate name "${name}"; last one wins.`);
        }
        blobStore.set(name, { name, mime, encoding, data });
      }
      console.log(`  Found ${blobStore.size} blob block(s)`);
    }

    const timedStore = new Map<string, TimedStoreEntry>();
    if (parsed.timedBlocks && parsed.timedBlocks.length > 0) {
      for (const b of parsed.timedBlocks) {
        const name = String(b.name ?? '').trim();
        if (!name) continue;
        if (timedStore.has(name)) {
          console.warn(`  [timed] Duplicate name "${name}"; last one wins.`);
        }
        timedStore.set(name, { name, entries: b.entries });
      }
      console.log(`  Found ${timedStore.size} timed block(s)`);
    }

    const logicStore = Array.isArray(parsed.logicBlocks)
      ? parsed.logicBlocks.map((block) => ({
          ...block,
          statements: block.statements.map((statement) => ({
            ...statement,
            ...(statement.meta ? { meta: { ...statement.meta } } : {}),
          })),
          ...(block.metadata ? { metadata: { ...block.metadata } } : {}),
        }))
      : [];
    if (logicStore.length > 0) {
      console.log(`  Found ${logicStore.length} logic block(s)`);
    }

    const asciiStore = new Map<string, AsciiStoreEntry>();
    for (const b of parsed.codeBlocks) {
      let name: string | null = null;

      if (typeof b.lang === 'string' && b.lang.startsWith('ascii:')) {
        console.warn(`  [ascii] Legacy fence syntax "${b.lang}" is no longer supported. Use \`\`\`ascii name:...\`\`\` instead.`);
      }

      if (b.lang === 'ascii') {
        const n = String(b.metadata?.name ?? '').trim();
        if (n) name = n;
      }

      if (!name) continue;
      const text = String(b.code ?? '');
      if (asciiStore.has(name)) {
        console.warn(`  [ascii] Duplicate name "${name}"; last one wins.`);
      }
      asciiStore.set(name, { name, text });
    }
    if (asciiStore.size > 0) {
      console.log(`  Found ${asciiStore.size} ascii block(s)`);
    }

    const figletStore = new Map<string, FigletStoreEntry>();
    for (const b of parsed.codeBlocks) {
      let name: string | null = null;

      if (typeof b.lang === 'string' && b.lang.startsWith('figlet:')) {
        console.warn(`  [figlet] Legacy fence syntax "${b.lang}" is no longer supported. Use \`\`\`figlet name:...\`\`\` instead.`);
      }

      if (b.lang === 'figlet') {
        const n = String(b.metadata?.name ?? '').trim();
        if (n) name = n;
      }

      if (!name) continue;
      const text = String(b.code ?? '');
      if (figletStore.has(name)) {
        console.warn(`  [figlet] Duplicate name "${name}"; last one wins.`);
      }
      figletStore.set(name, { name, text });
    }
    if (figletStore.size > 0) {
      console.log(`  Found ${figletStore.size} figlet font block(s)`);
    }

    const ansiStore = new Map<string, AnsiStoreEntry>();
    {
      const defaultStyle = this.getStyle('default');
      const defaultFg = ColorUtils.from(defaultStyle.fg);
      const defaultBg = this.currentTheme.bg;

      for (const b of parsed.codeBlocks) {
        if (b.lang !== 'ansi') continue;
        const name = String(b.metadata?.name ?? '').trim();
        if (!name) continue;

        const rawTab = String((b.metadata?.tab ?? b.metadata?.tabSize ?? '')).trim();
        const tabSize = rawTab ? Math.max(1, Number.parseInt(rawTab, 10) || 4) : 4;
        const text = String(b.code ?? '');
        if (ansiStore.has(name)) {
          console.warn(`  [ansi] Duplicate name "${name}"; last one wins.`);
        }

        const parsedAnsi = textPack
          ? textPack.parseAnsiToRuns(text, {
              defaultFg,
              defaultBg,
              tabSize,
              bracketSGR: true
            })
          : undefined;
        ansiStore.set(name, { name, text, tabSize, parsed: parsedAnsi });
      }

      if (ansiStore.size > 0) {
        console.log(`  Found ${ansiStore.size} ansi block(s)`);
      }
    }

    const stfxrStore = new Map<string, StfxrStoreEntry>();
    const stfxrPending = new Map<string, { name: string; base: string; patch: any; defaultSeed?: number | string; startLine: number; endLine: number }>();
    for (const b of parsed.codeBlocks) {
      if (b.lang !== 'stfxr') continue;
      const name = String(b.metadata?.name ?? '').trim();
      if (!name) {
        console.warn(`  [stfxr] Skipping unnamed stfxr block at lines ${b.startLine + 1}-${b.endLine + 1}`);
        continue;
      }

      const seedRaw = String(b.metadata?.seed ?? '').trim();
      let defaultSeed: number | string | undefined = undefined;
      if (seedRaw) {
        const n = Number(seedRaw);
        defaultSeed = Number.isFinite(n) ? n : seedRaw;
      }

      try {
        const def = audioPack.parseStfxrDefinitionJson(String(b.code ?? ''));
        if (def.kind === 'preset') {
          if (stfxrStore.has(name) || stfxrPending.has(name)) {
            console.warn(`  [stfxr] Duplicate name "${name}"; last one wins.`);
          }
          stfxrStore.set(name, { name, preset: def.preset, defaultSeed });
        } else {
          if (stfxrStore.has(name) || stfxrPending.has(name)) {
            console.warn(`  [stfxr] Duplicate name "${name}"; last one wins.`);
          }
          stfxrPending.set(name, {
            name,
            base: def.base,
            patch: def.patch,
            defaultSeed,
            startLine: b.startLine,
            endLine: b.endLine
          });
        }
      } catch (e) {
        console.warn(`  [stfxr] Failed to parse stfxr block for "${name}" at lines ${b.startLine + 1}-${b.endLine + 1}:`, e);
      }
    }

    const clonePreset = (preset: SfxGraphPreset): SfxGraphPreset => {
      try {
        if (typeof structuredClone === 'function') return structuredClone(preset);
      } catch {
        // ignore
      }
      return JSON.parse(JSON.stringify(preset)) as SfxGraphPreset;
    };

    const sameEdge = (
      a: { from: string; to: string; fromChannel?: number; toChannel?: number },
      b: { from: string; to: string; fromChannel?: number; toChannel?: number }
    ) =>
      a.from === b.from &&
      a.to === b.to &&
      (a.fromChannel ?? null) === (b.fromChannel ?? null) &&
      (a.toChannel ?? null) === (b.toChannel ?? null);

    const resolveBasePreset = (base: string): SfxGraphPreset | null => {
      const asBuiltIn = base as SfxPresetName;
      if ((audioPack.SFX_PRESETS as any)[asBuiltIn]) return (audioPack.SFX_PRESETS as any)[asBuiltIn] as SfxGraphPreset;
      const entry = stfxrStore.get(base);
      return entry ? entry.preset : null;
    };

    if (stfxrPending.size > 0) {
      const maxPasses = stfxrPending.size + 4;
      for (let pass = 0; pass < maxPasses && stfxrPending.size > 0; pass++) {
        let progressed = false;
        for (const [name, pending] of Array.from(stfxrPending.entries())) {
          const basePreset = resolveBasePreset(pending.base);
          if (!basePreset) continue;

          const base = clonePreset(basePreset);
          const patch = pending.patch ?? {};

          if (patch.vars) {
            base.vars = { ...(base.vars ?? {}), ...(patch.vars ?? {}) };
          }

          if (Array.isArray(patch.nodes) && patch.nodes.length > 0) {
            const out = [...(base.nodes ?? [])];
            const indexById = new Map<string, number>();
            for (let i = 0; i < out.length; i++) indexById.set(out[i]!.id, i);
            for (const n of patch.nodes) {
              const idx = indexById.get(n.id);
              if (idx === undefined) {
                indexById.set(n.id, out.length);
                out.push(n);
              } else {
                out[idx] = n;
              }
            }
            base.nodes = out;
          }

          if (Array.isArray(patch.edges)) {
            base.edges = [...patch.edges];
          }
          if (Array.isArray(patch.edgesRemove) && patch.edgesRemove.length > 0) {
            base.edges = (base.edges ?? []).filter(e => !patch.edgesRemove.some((r: any) => sameEdge(e, r)));
          }
          if (Array.isArray(patch.edgesAdd) && patch.edgesAdd.length > 0) {
            const edges = [...(base.edges ?? [])];
            for (const e of patch.edgesAdd) {
              if (!edges.some(x => sameEdge(x, e))) edges.push(e);
            }
            base.edges = edges;
          }

          if (Array.isArray(patch.events)) {
            base.events = [...patch.events];
          }
          if (Array.isArray(patch.eventsAdd) && patch.eventsAdd.length > 0) {
            base.events = [...(base.events ?? []), ...patch.eventsAdd];
          }

          stfxrStore.set(name, { name, preset: base, defaultSeed: pending.defaultSeed });
          stfxrPending.delete(name);
          progressed = true;
        }
        if (!progressed) break;
      }

      for (const pending of stfxrPending.values()) {
        console.warn(
          `  [stfxr] Could not resolve base "${pending.base}" for "${pending.name}" at lines ${pending.startLine + 1}-${pending.endLine + 1}`
        );
      }
    }

    if (stfxrStore.size > 0) {
      console.log(`  Found ${stfxrStore.size} stfxr block(s)`);
    }

    return {
      blobStore,
      timedStore,
      logicStore,
      asciiStore,
      figletStore,
      ansiStore,
      stfxrStore,
    };
  }

  private storeLoadedDocument(
    documentId: string,
    parsed: MarkdownDocument,
    handlers: UserHandlers,
    assetStores: DocumentAssetStores,
    sourceMarkdown?: string,
  ): void {
    this.outlineCache = null;
    this.documents.set(documentId, {
      id: documentId,
      handlers,
      sections: parsed.sections,
      metadata: parsed.metadata,
      sourceMarkdown: sourceMarkdown ?? parsed.sourceMarkdown,
      _parsedMarkdown: parsed,
      _blobStore: assetStores.blobStore,
      _asciiStore: assetStores.asciiStore,
      _figletStore: assetStores.figletStore,
      _ansiStore: assetStores.ansiStore,
      _stfxrStore: assetStores.stfxrStore,
      _timedStore: assetStores.timedStore,
      _logicStore: assetStores.logicStore,
      _stfxrBakedStore: new Map()
    } as any);

    this.activeDocumentId = documentId;
  }

  private finalizeLoadedDocument(handlers: UserHandlers, successMessage: string): void {
    console.log('🔍 Extracted handlers:', {
      init: typeof handlers?.init,
      export: typeof (handlers as any)?.export,
      update: typeof handlers?.update,
      render: typeof handlers?.render,
      input: typeof handlers?.input,
      drop: typeof (handlers as any)?.drop
    });

    if (handlers.init) {
      console.log('  Calling init handler');
      try {
        handlers.init();
      } catch (error) {
        console.error('  Error in init:', error);
      }
    }

    try {
      this.canvas.focus();
    } catch {
      // ignore
    }

    console.log(successMessage);
  }

  private getActiveCompiledSectionContext(): { activeSectionId?: string } {
    const activeIndex = this._liveRenderCtx?.sectionIndex ?? this._liveSectionInputCtx?.sectionIndex ?? null;
    if (typeof activeIndex !== 'number' || !Number.isFinite(activeIndex)) return {};
    const ref = this.resolveRuntimeSectionRef(activeIndex);
    return ref?.sectionId ? { activeSectionId: ref.sectionId } : {};
  }

  async loadCompiledApp(documentId: string, compiledModule: CompiledAppModuleLike): Promise<boolean> {
    try {
      console.log(`Loading compiled document: ${documentId}`);

      const createCompiledAppRuntime = compiledModule?.createCompiledAppRuntime;
      const parsed = compiledModule?.content?.rawDocument;
      if (typeof createCompiledAppRuntime !== 'function') {
        console.error('Compiled module is missing createCompiledAppRuntime(api, options)');
        return false;
      }
      if (!parsed || !Array.isArray(parsed.sections) || !Array.isArray(parsed.codeBlocks)) {
        console.error('Compiled module is missing content.rawDocument; regenerate the scaffold with a newer compiler.');
        return false;
      }

      await this.applyFrontmatterFontConfig(parsed.metadata ?? {});
      await this.prepareDocumentForActivation(parsed);
      await this.ensureAuthoredToolsRuntimeInstalled();
      await this.ensureGUIRuntimeInstalled();
      await this.ensureAudioRuntimeInstalled();
      if (this.documentNeedsTextRuntime(parsed)) {
        await this.ensureTextRuntimeInstalled();
      }

      const assetStores = this.buildDocumentAssetStores(parsed);
      this.sandbox.createCompartment(documentId, parsed.metadata);
      const scope = this.sandbox.getScope(documentId);
      if (!scope) {
        console.error(`Failed to create compiled document scope for ${documentId}`);
        return false;
      }

      const runtime = createCompiledAppRuntime(this.api, { scope, currentSectionId: null });
      const runtimeCtx = () => this.getActiveCompiledSectionContext();

      const handlers: UserHandlers = {
        init: () => runtime.init?.(runtimeCtx()),
        update: (delta) => runtime.update?.(delta, runtimeCtx()),
        render: () => runtime.render?.(runtimeCtx()),
        input: (event) => {
          runtime.input?.(event, runtimeCtx());
          return true;
        },
        drop: (file) => {
          runtime.drop?.(file, runtimeCtx());
        },
      };
      if (typeof runtime.export === 'function') {
        (handlers as any).export = (options?: { timedBlock?: string | null }) => runtime.export?.(options ?? runtimeCtx());
      }

      (scope as any).init = handlers.init;
      (scope as any).update = handlers.update;
      (scope as any).render = handlers.render;
      (scope as any).input = handlers.input;
      (scope as any).drop = handlers.drop;
      if ((handlers as any).export) {
        (scope as any).export = (handlers as any).export;
      }

      const enterHandlers: Record<number, () => void> = {};
      let sectionIndex = 0;
      const registerSection = (section: Section) => {
        const sectionId = String(section.id ?? `${section.title}-${section.startLine}`);
        enterHandlers[sectionIndex] = () => {
          runtime.enter?.(sectionId, runtimeCtx());
        };
        sectionIndex += 1;
        const children = Array.isArray(section.children) ? section.children : [];
        for (const child of children) registerSection(child);
      };
      for (const section of parsed.sections) registerSection(section);
      (scope as any).__enterHandlers = enterHandlers;

      this.storeLoadedDocument(documentId, parsed, handlers, assetStores);
      this.finalizeLoadedDocument(handlers, '✓ Compiled document loaded successfully');
      return true;
    } catch (error) {
      console.error(`Failed to load compiled document ${documentId}:`, error);
      return false;
    }
  }

  async loadMarkdown(documentId: string, markdown: string): Promise<boolean> {
    try {
      console.log(`Loading document: ${documentId}`);
      
      // Parse markdown (now async to support magic block expansion)
      const parsed = await parseMarkdown(markdown);
      console.log(`  Found ${parsed.sections.length} sections`);
      console.log(`  Found ${parsed.codeBlocks.length} code blocks`);

      // Apply frontmatter font settings early (best-effort). This is most useful
      // when the host loads markdown before `engine.start()` (e.g. the default site).
      await this.applyFrontmatterFontConfig(parsed.metadata);
      await this.prepareDocumentForActivation(parsed);
      await this.ensureAuthoredToolsRuntimeInstalled();
      await this.ensureGUIRuntimeInstalled();
      await this.ensureAudioRuntimeInstalled();
      if (this.documentNeedsTextRuntime(parsed)) {
        await this.ensureTextRuntimeInstalled();
      }
      
      // Extract JavaScript code blocks
      const jsBlocks = parsed.codeBlocks.filter(block => 
        block.lang === 'javascript' || block.lang === 'js'
      );

      const { blobStore, timedStore, logicStore, asciiStore, figletStore, ansiStore, stfxrStore } = this.buildDocumentAssetStores(parsed);
      
      if (jsBlocks.length === 0) {
        console.warn('  No JavaScript code blocks found');
        return false;
      }
      
      // Create compartment with frontmatter as initial scope
      this.sandbox.createCompartment(documentId, parsed.metadata);
      
      // Group blocks by lifecycle hook
      const initBlocks: string[] = [];
      const exportBlocks: string[] = [];
      const updateBlocks: string[] = [];
      const renderBlocks: string[] = [];
      const inputBlocks: string[] = [];
      const dropBlocks: string[] = [];
      const globalBlocks: string[] = [];

      const slugifySectionTitle = (s: string) =>
        s
          .toLowerCase()
          .trim()
          .replace(/[`*_~]/g, '')
          .replace(/\{[^}]*\}\s*$/g, '')
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-');

      // Build a map of section-title slug -> section index (traversal order matches Worlds layouts).
      const sectionIndexBySlug = new Map<string, number>();
      {
        let idx = 0;
        const walk = (sections: any[]) => {
          for (const s of sections) {
            const title = String(s?.title ?? '').trim();
            const slug = slugifySectionTitle(title);
            if (slug && !sectionIndexBySlug.has(slug)) {
              sectionIndexBySlug.set(slug, idx);
            }
            idx++;
            const children = Array.isArray(s?.children) ? s.children : [];
            if (children.length > 0) walk(children);
          }
        };
        walk(Array.isArray(parsed.sections) ? parsed.sections : []);
      }

      const wrapWithSectionGuard = (hook: string, block: any): string => {
        const sectionMeta = block?.metadata?.section;
        if (sectionMeta === undefined || sectionMeta === null) return block.code;

        const raw = String(sectionMeta).trim();
        if (!raw) return block.code;

        let sectionIdx: number | null = null;
        if (raw === 'current') {
          sectionIdx = this.findSectionIndexForLine(parsed.sections, block.startLine);
        } else {
          const n = Number(raw);
          if (Number.isFinite(n) && Number.isInteger(n)) sectionIdx = n;
        }

        // Allow section titles (matched by slugified heading text).
        if (sectionIdx === null) {
          const want = slugifySectionTitle(raw);
          if (want) {
            const resolved = sectionIndexBySlug.get(want);
            if (resolved !== undefined) sectionIdx = resolved;
          }
        }

        if (sectionIdx === null) {
          console.warn(
            `  [section] Could not resolve section "${raw}" for on:${hook} at lines ${block.startLine + 1}-${block.endLine + 1}; running unscoped.`
          );
          return block.code;
        }

        // NOTE: This adds a block scope. Avoid `let/const` declarations that must be
        // shared across later lifecycle blocks; use persisted vars (scope) instead.
        if (hook === 'render') {
          // For render blocks, live sections only fire during their texture bake
          // (when _activeLiveSectionIndex matches). Non-live sections fire normally
          // when they are the current section.
          return `if ((worlds._activeLiveSectionIndex === ${sectionIdx}) || (worlds._activeLiveSectionIndex === null && !worlds._isLive(${sectionIdx}) && worlds.currentSection === ${sectionIdx})) {\n${block.code}\n}`;
        }
        return `if (worlds.currentSection === ${sectionIdx} || worlds._activeLiveSectionIndex === ${sectionIdx}) {\n${block.code}\n}`;
      };

      // Section-scoped enter hooks
      const enterBlocksBySection: Map<number, string[]> = new Map();
      
      for (const block of jsBlocks) {
        const hook = block.metadata?.on;
        
        if (hook === 'init') {
          initBlocks.push(block.code);
        } else if (hook === 'export') {
          exportBlocks.push(block.code);
        } else if (hook === 'update') {
          updateBlocks.push(wrapWithSectionGuard('update', block));
        } else if (hook === 'render') {
          renderBlocks.push(wrapWithSectionGuard('render', block));
        } else if (hook === 'input') {
          inputBlocks.push(wrapWithSectionGuard('input', block));
        } else if (hook === 'drop') {
          dropBlocks.push(wrapWithSectionGuard('drop', block));
        } else if (hook === 'enter') {
          const sectionIdx = this.findSectionIndexForLine(parsed.sections, block.startLine);
          if (sectionIdx !== null) {
            const arr = enterBlocksBySection.get(sectionIdx) ?? [];
            arr.push(block.code);
            enterBlocksBySection.set(sectionIdx, arr);
          } else {
            // If it isn't inside a section, treat as global.
            globalBlocks.push(block.code);
          }
        } else {
          // No hook metadata - execute in document order (global scope)
          globalBlocks.push(block.code);
        }
      }
      
      // Execute global blocks first (variable declarations, etc.)
      console.log(`  Executing ${globalBlocks.length} global blocks`);
      for (const code of globalBlocks) {
        // First pass: execute with transformation to populate scope
        this.sandbox.executeCodeBlock(documentId, code); // Transform: yes
      }
      
      // Get current scope after first execution
      let currentScope = this.sandbox.getScope(documentId) || {};
      let scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input', 'drop', '__enterHandlers'].includes(k));
      
      // Second pass: re-execute with scope-guarded var initializers + exports to create
      // proper closures.  `var NAME = EXPR` is rewritten to
      //   `var NAME = ('NAME' in scope) ? scope.NAME : (EXPR);`
      // so that on hot-reload the IIFE-local binding is seeded from the already-persisted
      // scope value rather than the default EXPR.  This means functions that close over
      // `NAME` always see live state across hot-reloads without any `scope.*` boilerplate.
      if (scopeVarNames.length > 0 && globalBlocks.length > 0) {
        console.log(`  Re-executing global blocks to create closures for ${scopeVarNames.length} variables`);
        // Some scope keys may come from direct `scope.foo = ...` assignments rather than
        // real JS bindings. Exporting those would throw (ReferenceError: foo is not defined).
        // Wrap in try/catch to only export when a binding exists.
        const exports = scopeVarNames.map(k => `  try { scope.${k} = ${k}; } catch (e) {}` ).join('\n');
        
        // Pass API globals as IIFE parameters so they're accessible inside the function.
        // NOTE: Dynamic/per-frame values (termWidth, termHeight, mouseX/Y, etc.) are intentionally
        // NOT listed here — they would be captured as snapshot values at IIFE execution time
        // (document-load time) rather than returning the live value on each call.  Those names
        // are still accessible inside the IIFE via the compartment's getter-based globals, which
        // always reflect the current engine state (e.g. after viewport constraint resize).
        const apiParams = 'term, termCanvas, layer, key, mouse, drop, doc, host, scene, tui, gui, getStyle, theme, modules, getFrame, getTime, getDelta, audio, canvas2d, blob, ascii, drawAscii, figlet, drawFiglet, ansi, drawAnsi, ui, webgl, webgpu, shader, compositor, worlds';
        
        for (const code of globalBlocks) {
          // Rewrite top-level `var NAME = EXPR` for known scope vars so the IIFE-local
          // binding is initialised from the persisted scope value on hot-reload.
          const persistedCode = this.sandbox.rewriteVarsForPersistence(code, scopeVarNames);
          const wrappedCode = `(function(${apiParams}) {
${persistedCode}
${exports}
})(${apiParams});`;
          this.sandbox.executeCodeBlock(documentId, wrappedCode, true); // Skip transform on second pass
        }
      }
      
      // Get current scope to check for existing handlers and variables
      currentScope = this.sandbox.getScope(documentId) || {};
      
      // Get all non-handler variables from scope
      scopeVarNames = Object.keys(currentScope).filter(k => !['init', 'update', 'render', 'input', 'drop', '__enterHandlers'].includes(k));
      console.log(`  Scope variables:`, scopeVarNames);
      console.log(`  Scope values:`, scopeVarNames.map(k => `${k}=${JSON.stringify(currentScope[k])}`).join(', '));
      
      // Check if handlers were directly defined as functions
      const hasInit = typeof currentScope.init === 'function';
      const hasExport = typeof (currentScope as any).export === 'function';
      const hasUpdate = typeof currentScope.update === 'function';
      const hasRender = typeof currentScope.render === 'function';
      const hasInput = typeof currentScope.input === 'function';
      const hasDrop = typeof (currentScope as any).drop === 'function';
      
      // Build import/export statements for handlers
      // Import scope variables at handler start, export them back at handler end
      const importVars = scopeVarNames.length > 0 
        ? `  let {${scopeVarNames.join(', ')}} = scope;` 
        : '';
      // Capture original scope values BEFORE user code runs, then export back at end
      // Only export if scope value hasn't been directly modified (via scope.foo = ...)
      const captureVars = scopeVarNames.length > 0
        ? `  const __scopeBefore = {${scopeVarNames.map(k => `${k}: scope.${k}`).join(', ')}};`
        : '';
      const exportVars = scopeVarNames.length > 0
        ? scopeVarNames
            .map(k => `  if (scope.${k} === __scopeBefore.${k}) { scope.${k} = ${k}; }`)
            .join('\n')
        : '';
      
      // Only create handlers from on:init/update/render blocks if not already defined
      if (!hasInit && initBlocks.length > 0) {
        console.log(`  Creating init handler from ${initBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const initCode = `scope.init = function() {
${importVars}
${captureVars}
${initBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, initCode, true);
      }

      if (!hasExport && exportBlocks.length > 0) {
        console.log(`  Creating export handler from ${exportBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const exportCode = `scope.export = function(options) {
${importVars}
${captureVars}
${exportBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, exportCode, true);
      }
      
      if (!hasUpdate && updateBlocks.length > 0) {
        console.log(`  Creating update handler from ${updateBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const updateCode = `scope.update = function(delta) {
${importVars}
${captureVars}
${updateBlocks.join('\n\n')}
${exportVars}
};`;
        console.log(`  Generated update wrapper (first 500 chars):`, updateCode.substring(0, 500));
        this.sandbox.executeCodeBlock(documentId, updateCode, true);
      }
      
      if (!hasRender && renderBlocks.length > 0) {
        console.log(`  Creating render handler from ${renderBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const renderCode = `scope.render = function() {
${importVars}
${captureVars}
${renderBlocks.join('\n\n')}
${exportVars}
};`;
        console.log('🔍 Generated render handler (first 300 chars):', renderCode.substring(0, 300));
        this.sandbox.executeCodeBlock(documentId, renderCode, true);
        
        // Verify it was created
        const verifyScope = this.sandbox.getScope(documentId);
        console.log('🔍 After execution, scope.render type:', typeof verifyScope?.render);
      }
      
      if (!hasInput && inputBlocks.length > 0) {
        console.log(`  Creating input handler from ${inputBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const inputCode = `scope.input = function(event) {
${importVars}
${captureVars}
${inputBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, inputCode, true);
      }

      if (!hasDrop && dropBlocks.length > 0) {
        console.log(`  Creating drop handler from ${dropBlocks.length} blocks with ${scopeVarNames.length} imports`);
        const dropCode = `scope.drop = function(file) {
${importVars}
${captureVars}
${dropBlocks.join('\n\n')}
${exportVars}
};`;
        this.sandbox.executeCodeBlock(documentId, dropCode, true);
      }

      // Create section-scoped enter handlers (invoked by 3D navigation when a section becomes current).
      if (enterBlocksBySection.size > 0) {
        const pieces: string[] = [];
        pieces.push(`scope.__enterHandlers = scope.__enterHandlers || {};`);
        const indices = Array.from(enterBlocksBySection.keys()).sort((a, b) => a - b);
        for (const idx of indices) {
          const blocks = enterBlocksBySection.get(idx) ?? [];
          if (blocks.length === 0) continue;
          pieces.push(`scope.__enterHandlers[${idx}] = function() {`);
          if (importVars) pieces.push(importVars);
          if (captureVars) pieces.push(captureVars);
          pieces.push(blocks.join('\n\n'));
          if (exportVars) pieces.push(exportVars);
          pieces.push(`};`);
        }
        this.sandbox.executeCodeBlock(documentId, pieces.join('\n'), true);
      }
      
      // Extract handlers from scope
      const handlers = this.sandbox.extractHandlers(documentId);
      
      if (!handlers) {
        console.error('  Failed to extract handlers');
        return false;
      }
      
      this.storeLoadedDocument(documentId, parsed, handlers, {
        blobStore,
        timedStore,
        logicStore,
        asciiStore,
        figletStore,
        ansiStore,
        stfxrStore,
      });
      this.finalizeLoadedDocument(handlers, '✓ Document loaded successfully');
      return true;
      
    } catch (error) {
      console.error(`Failed to load document ${documentId}:`, error);
      return false;
    }
  }

  /**
   * Set the active document
   */
  setActiveDocument(documentId: string): void {
    const nextDocument = this.documents.get(documentId);
    if (!nextDocument) return;

    this.activeDocumentId = documentId;
    this.outlineCache = null;
    this.initializeRuntimeSectionStore(nextDocument.sections);
    this.applyRuntimeSectionStoreMutation(`activate document ${documentId}`);
  }

  /**
   * Apply shader chain (typically from URL parameter, overrides frontmatter)
   */
  async applyShaderChain(chainStr: string, source: string = 'url'): Promise<boolean> {
    if (!this.shaderChainManager) {
      console.log('[Engine] Deferring shader chain until WebGPU init:', chainStr);
      this.pendingShaderChain = { chainStr, source };
      return true;
    }
    
    return await this.shaderChainManager.activateChainFromString(chainStr, source);
  }

  /**
   * Get the currently active document
   */
  private getActiveDocument(): UserScript | null {
    if (!this.activeDocumentId) return null;
    return this.documents.get(this.activeDocumentId) || null;
  }

  getActiveDocumentSourceMarkdown(): string | null {
    const doc = this.getActiveDocument() as (UserScript & { _parsedMarkdown?: MarkdownDocument | null }) | null;
    if (!doc) return null;
    if (typeof doc.sourceMarkdown === 'string') return doc.sourceMarkdown;
    if (doc._parsedMarkdown) {
      return serializeMarkdownDocumentSource(doc._parsedMarkdown);
    }
    return serializeMarkdownDocumentSource({
      metadata: doc.metadata ?? {},
      sections: doc.sections ?? [],
    });
  }

  private getReadableSectionRoots(): Section[] {
    if (this.runtimeSectionStore.sections.length > 0) {
      return this.runtimeSectionStore.sections;
    }
    return this.getActiveDocument()?.sections ?? [];
  }

  private getActiveWorldsSectionContentOverrideMap(create: boolean = false): Map<string, WorldsSectionContentOverride> | null {
    const documentId = this.activeDocumentId;
    if (!documentId) return null;

    const existing = this.worldsSectionContentOverridesByDocument.get(documentId);
    if (existing || !create) return existing ?? null;

    const next = new Map<string, WorldsSectionContentOverride>();
    this.worldsSectionContentOverridesByDocument.set(documentId, next);
    return next;
  }

  private getWorldsSectionContentOverride(sectionId: string): WorldsSectionContentOverride | null {
    const overrides = this.getActiveWorldsSectionContentOverrideMap();
    if (!overrides) return null;
    return overrides.get(sectionId) ?? null;
  }

  private pruneActiveWorldsSectionContentOverrides(): void {
    const overrides = this.getActiveWorldsSectionContentOverrideMap();
    if (!overrides) return;

    const validIds = new Set(this.runtimeSectionStore.order);
    for (const sectionId of overrides.keys()) {
      if (!validIds.has(sectionId)) {
        overrides.delete(sectionId);
      }
    }

    if (overrides.size === 0 && this.activeDocumentId) {
      this.worldsSectionContentOverridesByDocument.delete(this.activeDocumentId);
    }
  }

  private resolveWorldsContentSectionRef(selector?: number | string | null): RuntimeSectionRef | null {
    if (selector === undefined || selector === null || selector === 'current') {
      const currentIndex = this.getResolvedCurrent3DSectionIndex();
      return typeof currentIndex === 'number' && Number.isFinite(currentIndex)
        ? this.resolveRuntimeSectionRef(currentIndex)
        : null;
    }
    return this.resolveRuntimeSectionRef(selector);
  }

  private setWorldsSectionContentOverride(
    selector: number | string,
    patch: { title?: string | null; content?: string | null }
  ): boolean {
    const ref = this.resolveWorldsContentSectionRef(selector);
    if (!ref) return false;

    const overrides = this.getActiveWorldsSectionContentOverrideMap(true);
    if (!overrides) return false;

    const previous = overrides.get(ref.sectionId) ?? {};
    const next: WorldsSectionContentOverride = { ...previous };
    let touched = false;

    if (patch.title !== undefined) {
      touched = true;
      if (patch.title === null) delete next.title;
      else next.title = String(patch.title);
    }
    if (patch.content !== undefined) {
      touched = true;
      if (patch.content === null) delete next.content;
      else next.content = String(patch.content);
    }
    if (!touched) return false;

    const unchanged = previous.title === next.title && previous.content === next.content;
    if (unchanged) return true;

    if (next.title === undefined && next.content === undefined) {
      overrides.delete(ref.sectionId);
    } else {
      overrides.set(ref.sectionId, next);
    }

    this.invalidate3DSectionTexture(ref.sectionIndex);
    return true;
  }

  private clearWorldsSectionContentOverride(
    selector?: number | string,
    target: 'title' | 'content' | 'all' = 'all'
  ): boolean {
    const ref = this.resolveWorldsContentSectionRef(selector);
    if (!ref) return false;

    const overrides = this.getActiveWorldsSectionContentOverrideMap();
    if (!overrides) return false;
    const existing = overrides.get(ref.sectionId);
    if (!existing) return false;

    const next: WorldsSectionContentOverride = { ...existing };
    if (target === 'all' || target === 'title') delete next.title;
    if (target === 'all' || target === 'content') delete next.content;

    if (next.title === undefined && next.content === undefined) {
      overrides.delete(ref.sectionId);
    } else {
      overrides.set(ref.sectionId, next);
    }

    this.invalidate3DSectionTexture(ref.sectionIndex);
    return true;
  }

  private clearWorldsSectionContentOverrides(): void {
    const overrides = this.getActiveWorldsSectionContentOverrideMap();
    if (!overrides || overrides.size === 0) return;
    overrides.clear();
    this.clear3DSectionTextures();
  }

  private getActiveWorldsSectionStyleOverrideMap(create: boolean = false): Map<string, WorldsSectionStyleOverride> | null {
    const documentId = this.activeDocumentId;
    if (!documentId) return null;
    const existing = this.worldsSectionStyleOverridesByDocument.get(documentId);
    if (existing || !create) return existing ?? null;
    const next = new Map<string, WorldsSectionStyleOverride>();
    this.worldsSectionStyleOverridesByDocument.set(documentId, next);
    return next;
  }

  private getWorldsSectionStyleOverride(sectionId: string): WorldsSectionStyleOverride | null {
    const overrides = this.getActiveWorldsSectionStyleOverrideMap();
    if (!overrides) return null;
    return overrides.get(sectionId) ?? null;
  }

  private setWorldsSectionStyleOverride(
    selector: number | string,
    patch: { fg?: Color | string | null }
  ): boolean {
    const ref = this.resolveWorldsContentSectionRef(selector);
    if (!ref) return false;
    const overrides = this.getActiveWorldsSectionStyleOverrideMap(true);
    if (!overrides) return false;

    const previous = overrides.get(ref.sectionId) ?? {};
    const next: WorldsSectionStyleOverride = { ...previous };
    let touched = false;

    if (patch.fg !== undefined) {
      touched = true;
      if (patch.fg === null) {
        delete next.fg;
      } else {
        const resolved = typeof patch.fg === 'string'
          ? this.resolveThemeColorString(patch.fg)
          : (patch.fg as Color);
        if (resolved !== null && resolved !== undefined) next.fg = resolved;
        else delete next.fg;
      }
    }
    if (!touched) return false;

    const unchanged = previous.fg === next.fg;
    if (unchanged) return true;

    if (next.fg === undefined) {
      overrides.delete(ref.sectionId);
    } else {
      overrides.set(ref.sectionId, next);
    }

    this.invalidate3DSectionTexture(ref.sectionIndex);
    return true;
  }

  private clearWorldsSectionStyleOverride(selector?: number | string): boolean {
    const ref = this.resolveWorldsContentSectionRef(selector);
    if (!ref) return false;
    const overrides = this.getActiveWorldsSectionStyleOverrideMap();
    if (!overrides) return false;
    if (!overrides.has(ref.sectionId)) return false;
    overrides.delete(ref.sectionId);
    this.invalidate3DSectionTexture(ref.sectionIndex);
    return true;
  }

  private clearWorldsSectionStyleOverrides(): void {
    const overrides = this.getActiveWorldsSectionStyleOverrideMap();
    if (!overrides || overrides.size === 0) return;
    overrides.clear();
    this.clear3DSectionTextures();
  }

  /** Resolve a theme key string (e.g. 'accent1') or hex color to a packed Color. */
  private resolveThemeColorString(value: string): Color | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const hex = this.parseHexColorToPackedColor(trimmed);
    if (hex !== null) return hex;
    const key = trimmed.toLowerCase();
    switch (key) {
      case 'surface': return this.getStyle('surface').bg;
      case 'bg': case 'background': return this.currentTheme.bg;
      case 'bgalt': case 'bg_alt': return this.currentTheme.bgAlt;
      case 'fg': case 'foreground': return this.currentTheme.fg;
      case 'fgalt': case 'fg_alt': return this.currentTheme.fgAlt;
      case 'accent1': case 'primary': return this.currentTheme.accent1;
      case 'accent2': case 'secondary': return this.currentTheme.accent2;
      case 'accent3': case 'tertiary': return this.currentTheme.accent3;
      default: return null;
    }
  }

  private applyWorldsTimedContent(
    selector: number | string,
    entries: WorldsContentTimedEntry[],
    timeSec: number,
    options?: {
      mode?: WorldsContentMode;
      target?: WorldsContentTarget;
      separator?: string;
      maxEntries?: number;
      clearWhenEmpty?: boolean;
    }
  ): WorldsContentState | null {
    const ref = this.resolveWorldsContentSectionRef(selector);
    if (!ref) return null;

    const state = stateAtWorldsContent(entries, timeSec, options);
    const target = options?.target === 'title' ? 'title' : 'content';
    const clearWhenEmpty = options?.clearWhenEmpty !== false;
    const hasText = state.entries.length > 0 || state.text.length > 0;

    if (!hasText && clearWhenEmpty) {
      this.clearWorldsSectionContentOverride(ref.sectionId, target);
      return state;
    }

    this.setWorldsSectionContentOverride(ref.sectionId, {
      [target]: hasText ? state.text : '',
    } as { title?: string | null; content?: string | null });
    return state;
  }

  private getActiveWorldsSectionOverrideMap(create: boolean = false): Map<string, WorldsSectionRuntimeOverride> | null {
    const documentId = this.activeDocumentId;
    if (!documentId) return null;

    const existing = this.worldsSectionOverridesByDocument.get(documentId);
    if (existing || !create) return existing ?? null;

    const next = new Map<string, WorldsSectionRuntimeOverride>();
    this.worldsSectionOverridesByDocument.set(documentId, next);
    return next;
  }

  private getOrCreateSectionRuntimeOverride(sectionId: string): WorldsSectionRuntimeOverride {
    const overrides = this.getActiveWorldsSectionOverrideMap(true);
    if (!overrides) return {};
    const existing = overrides.get(sectionId);
    if (existing) return existing;
    const next: WorldsSectionRuntimeOverride = {};
    overrides.set(sectionId, next);
    return next;
  }

  private pruneActiveWorldsSectionOverrides(): void {
    const overrides = this.getActiveWorldsSectionOverrideMap();
    if (!overrides) return;

    const validIds = new Set(this.section3DLayouts.map((layout) => layout.sectionId));
    for (const sectionId of overrides.keys()) {
      if (!validIds.has(sectionId)) {
        overrides.delete(sectionId);
      }
    }

    if (overrides.size === 0 && this.activeDocumentId) {
      this.worldsSectionOverridesByDocument.delete(this.activeDocumentId);
    }
  }

  private applyActiveWorldsSectionOverrides(): void {
    const overrides = this.getActiveWorldsSectionOverrideMap();
    if (!overrides || overrides.size === 0) return;

    for (const layout of this.section3DLayouts) {
      const override = overrides.get(layout.sectionId);
      if (!override) continue;

      if (override.position) {
        layout.transform.position = { ...override.position };
        layout.autoPositioned = false;
      }
      if (override.rotationDegrees) {
        layout.transform.rotation = {
          x: (override.rotationDegrees.x * Math.PI) / 180,
          y: (override.rotationDegrees.y * Math.PI) / 180,
          z: (override.rotationDegrees.z * Math.PI) / 180,
        };
      }
      if (override.scale) {
        layout.transform.scale = { ...override.scale };
      }
      if (typeof override.visible === 'boolean') {
        layout.visible = override.visible;
      }
      if (typeof override.width === 'number' && override.width > 0) {
        layout.width = override.width;
      }
      if (typeof override.height === 'number' && override.height > 0) {
        layout.height = override.height;
      }
    }
  }

  private cloneRuntimeSectionTree(sections: Section[]): Section[] {
    return sections.map((section) => this.cloneRuntimeSectionNode(section));
  }

  private cloneRuntimeSectionNode(section: Section): Section {
    const cloned: Section = {
      ...section,
      children: section.children.map((child) => this.cloneRuntimeSectionNode(child)),
    };
    if (section.directive && typeof section.directive === 'object' && !Array.isArray(section.directive)) {
      cloned.directive = { ...section.directive };
    }
    return cloned;
  }

  private resetRuntimeSectionStore(): void {
    this.runtimeSectionStore.sections = [];
    this.runtimeSectionStore.byId.clear();
    this.runtimeSectionStore.order = [];
    this.runtimeSectionStore.indexById.clear();
  }

  private rebuildRuntimeSectionStoreIndex(): void {
    this.runtimeSectionStore.byId.clear();
    this.runtimeSectionStore.order = [];
    this.runtimeSectionStore.indexById.clear();

    let sectionIndex = 0;
    const walk = (sections: Section[]) => {
      for (const section of sections) {
        if (!section.id) continue;
        this.runtimeSectionStore.byId.set(section.id, section);
        this.runtimeSectionStore.order.push(section.id);
        this.runtimeSectionStore.indexById.set(section.id, sectionIndex++);
        if (section.children.length > 0) {
          walk(section.children);
        }
      }
    };

    walk(this.runtimeSectionStore.sections);
  }

  private initializeRuntimeSectionStore(sections: Section[]): void {
    this.runtimeSectionStore.sections = this.cloneRuntimeSectionTree(sections);
    this.rebuildRuntimeSectionStoreIndex();
  }

  private syncRuntimeSectionStoreToActiveDocument(): void {
    const activeDocument = this.getActiveDocument() as (UserScript & { _parsedMarkdown?: MarkdownDocument | null }) | null;
    if (!activeDocument) return;

    const nextSections = this.cloneRuntimeSectionTree(this.runtimeSectionStore.sections);
    activeDocument.sections = nextSections;
    if (activeDocument._parsedMarkdown && Array.isArray(activeDocument._parsedMarkdown.sections)) {
      activeDocument._parsedMarkdown.sections = this.cloneRuntimeSectionTree(this.runtimeSectionStore.sections);
      activeDocument.sourceMarkdown = serializeMarkdownDocumentSource(activeDocument._parsedMarkdown);
      activeDocument._parsedMarkdown.sourceMarkdown = activeDocument.sourceMarkdown;
      return;
    }

    activeDocument.sourceMarkdown = serializeMarkdownDocumentSource({
      metadata: activeDocument.metadata ?? {},
      sections: nextSections,
    });
  }

  private applyRuntimeSectionStoreMutation(reason: string): void {
    ensureSectionIds(this.runtimeSectionStore.sections);
    this.rebuildRuntimeSectionStoreIndex();
    this.syncRuntimeSectionStoreToActiveDocument();
    this.outlineCache = null;
    this.pruneActiveWorldsSectionContentOverrides();

    this.section3DLayouts = createSection3DLayouts(this.runtimeSectionStore.sections, this.worldsConfig);
    this.rebind3DStateToRuntimeSectionStore();
    this.applyWorldsLayoutCallback();
    this.applyActiveWorldsSectionOverrides();
    this.pruneActiveWorldsSectionOverrides();
    this.applyWorldsHiddenUntilVisitedVisibility();

    this.reflowWorldsAutoLayout();
    this.applyPending3DCameraFocus();
    this.applyPendingWorldsOverview();

    if (this.worldsRenderer) {
      console.log(`  Created ${this.section3DLayouts.length} 3D layouts from runtime store (${reason})`);
    }
  }

  private compileWorldsLayoutsFromRuntimeSectionStore(reason: string): void {
    this.applyRuntimeSectionStoreMutation(reason);
  }

  private clampRuntimeSectionLevel(level: number): number {
    return Math.max(1, Math.min(6, Math.round(level)));
  }

  private createRuntimeSectionFromInput(input: Partial<Section> | null | undefined, level: number = 1): Section {
    const normalizedLevel = this.clampRuntimeSectionLevel(Number.isFinite(input?.level as number) ? Number(input!.level) : level);
    const title = typeof input?.title === 'string' && input.title.trim().length > 0
      ? input.title.trim()
      : 'Section';
    const section: Section = {
      id: typeof input?.id === 'string' && input.id.trim().length > 0 ? input.id.trim() : undefined,
      title,
      level: normalizedLevel,
      content: typeof input?.content === 'string' ? input.content : '',
      startLine: Number.isFinite(input?.startLine as number) ? Number(input!.startLine) : -1,
      endLine: Number.isFinite(input?.endLine as number) ? Number(input!.endLine) : -1,
      children: [],
    };

    if (Number.isFinite(input?.timedMs as number)) {
      section.timedMs = Number(input!.timedMs);
    }
    if (input?.directive && typeof input.directive === 'object' && !Array.isArray(input.directive)) {
      section.directive = { ...input.directive };
    }

    const children = Array.isArray(input?.children) ? input.children : [];
    section.children = children.map((child) => this.createRuntimeSectionFromInput(child, normalizedLevel + 1));
    return section;
  }

  private setRuntimeSectionSubtreeLevels(section: Section, level: number): void {
    section.level = this.clampRuntimeSectionLevel(level);
    for (const child of section.children) {
      this.setRuntimeSectionSubtreeLevels(child, section.level + 1);
    }
  }

  private getRuntimeSectionRefs(): RuntimeSectionRef[] {
    const refs: RuntimeSectionRef[] = [];
    let sectionIndex = 0;

    const visit = (sections: Section[], parent: Section | null, parentIndex: number | null) => {
      for (let siblingIndex = 0; siblingIndex < sections.length; siblingIndex++) {
        const section = sections[siblingIndex];
        const sectionId = typeof section.id === 'string' && section.id.length > 0 ? section.id : `section-${sectionIndex}`;
        const ref: RuntimeSectionRef = {
          section,
          sectionId,
          sectionIndex,
          parent,
          parentId: parent?.id ?? null,
          parentIndex,
          siblings: sections,
          siblingIndex,
        };
        refs.push(ref);
        sectionIndex += 1;

        const currentIndex = ref.sectionIndex;
        if (section.children.length > 0) {
          visit(section.children, section, currentIndex);
        }
      }
    };

    visit(this.runtimeSectionStore.sections, null, null);
    return refs;
  }

  private resolveRuntimeSectionRef(selector: number | string | null | undefined): RuntimeSectionRef | null {
    const refs = this.getRuntimeSectionRefs();
    if (typeof selector === 'number' && Number.isFinite(selector)) {
      return refs.find((ref) => ref.sectionIndex === selector) ?? null;
    }
    if (typeof selector !== 'string') return null;

    const query = selector.trim();
    if (!query) return null;

    const exactId = refs.find((ref) => ref.sectionId === query);
    if (exactId) return exactId;

    const slugify = (value: string) =>
      value
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/\{[^}]*\}\s*$/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');

    const wanted = slugify(query);
    return refs.find((ref) => slugify(ref.section.title) === wanted) ?? null;
  }

  private sectionTreeContainsId(section: Section, sectionId: string): boolean {
    if (section.id === sectionId) return true;
    return section.children.some((child) => this.sectionTreeContainsId(child, sectionId));
  }

  private getRuntimeSectionSummary(selector: number | string): {
    sectionId: string;
    sectionIndex: number;
    parentId: string | null;
    parentIndex: number | null;
    title: string;
    level: number;
    content: string;
    childCount: number;
    timedMs?: number;
    directive?: Record<string, any>;
  } | null {
    const ref = this.resolveRuntimeSectionRef(selector);
    if (!ref) return null;

    return {
      sectionId: ref.sectionId,
      sectionIndex: ref.sectionIndex,
      parentId: ref.parentId,
      parentIndex: ref.parentIndex,
      title: ref.section.title,
      level: ref.section.level,
      content: ref.section.content,
      childCount: ref.section.children.length,
      ...(ref.section.timedMs !== undefined ? { timedMs: ref.section.timedMs } : {}),
      ...(ref.section.directive ? { directive: { ...ref.section.directive } } : {}),
    };
  }

  private getRuntimeSectionSummaries(): Array<{
    sectionId: string;
    sectionIndex: number;
    parentId: string | null;
    parentIndex: number | null;
    title: string;
    level: number;
    content: string;
    childCount: number;
    timedMs?: number;
    directive?: Record<string, any>;
  }> {
    return this.getRuntimeSectionRefs().map((ref) => ({
      sectionId: ref.sectionId,
      sectionIndex: ref.sectionIndex,
      parentId: ref.parentId,
      parentIndex: ref.parentIndex,
      title: ref.section.title,
      level: ref.section.level,
      content: ref.section.content,
      childCount: ref.section.children.length,
      ...(ref.section.timedMs !== undefined ? { timedMs: ref.section.timedMs } : {}),
      ...(ref.section.directive ? { directive: { ...ref.section.directive } } : {}),
    }));
  }

  private insertRuntimeSection(
    sectionInput: Partial<Section>,
    options?: { parent?: number | string | null; index?: number }
  ): { sectionId: string; sectionIndex: number } | null {
    const parentRef = options?.parent === undefined || options?.parent === null
      ? null
      : this.resolveRuntimeSectionRef(options.parent);
    if (options?.parent !== undefined && options?.parent !== null && !parentRef) {
      return null;
    }

    const nextSection = this.createRuntimeSectionFromInput(
      sectionInput,
      parentRef ? parentRef.section.level + 1 : (Number.isFinite(sectionInput.level as number) ? Number(sectionInput.level) : 1),
    );
    this.setRuntimeSectionSubtreeLevels(nextSection, parentRef ? parentRef.section.level + 1 : nextSection.level);

    const siblings = parentRef ? parentRef.section.children : this.runtimeSectionStore.sections;
    const rawIndex = Number(options?.index);
    const insertIndex = Number.isFinite(rawIndex)
      ? Math.max(0, Math.min(siblings.length, Math.floor(rawIndex)))
      : siblings.length;
    siblings.splice(insertIndex, 0, nextSection);

    this.applyRuntimeSectionStoreMutation('insert section');
    const inserted = nextSection.id ? this.resolveRuntimeSectionRef(nextSection.id) : null;
    return inserted ? { sectionId: inserted.sectionId, sectionIndex: inserted.sectionIndex } : null;
  }

  private updateRuntimeSection(selector: number | string, patch: Partial<Section>): boolean {
    const ref = this.resolveRuntimeSectionRef(selector);
    if (!ref) return false;

    if (typeof patch.id === 'string') {
      ref.section.id = patch.id.trim() || undefined;
    }
    if (typeof patch.title === 'string' && patch.title.trim().length > 0) {
      ref.section.title = patch.title.trim();
    }
    if (typeof patch.content === 'string') {
      ref.section.content = patch.content;
    }
    if (patch.timedMs === undefined) {
      // no-op
    } else if (patch.timedMs === null || !Number.isFinite(patch.timedMs as number)) {
      delete ref.section.timedMs;
    } else {
      ref.section.timedMs = Number(patch.timedMs);
    }
    if (patch.directive === undefined) {
      // no-op
    } else if (patch.directive && typeof patch.directive === 'object' && !Array.isArray(patch.directive)) {
      ref.section.directive = { ...patch.directive };
    } else {
      delete ref.section.directive;
    }
    if (Array.isArray(patch.children)) {
      ref.section.children = patch.children.map((child) =>
        this.createRuntimeSectionFromInput(child, ref.section.level + 1)
      );
      for (const child of ref.section.children) {
        this.setRuntimeSectionSubtreeLevels(child, ref.section.level + 1);
      }
    }

    this.applyRuntimeSectionStoreMutation('update section');
    return true;
  }

  private removeRuntimeSection(selector: number | string): boolean {
    const ref = this.resolveRuntimeSectionRef(selector);
    if (!ref) return false;

    ref.siblings.splice(ref.siblingIndex, 1);
    this.applyRuntimeSectionStoreMutation('remove section');
    return true;
  }

  private moveRuntimeSection(
    selector: number | string,
    options?: { parent?: number | string | null; index?: number }
  ): { sectionId: string; sectionIndex: number } | null {
    const ref = this.resolveRuntimeSectionRef(selector);
    if (!ref) return null;

    const targetParentRef = options?.parent === undefined || options?.parent === null
      ? null
      : this.resolveRuntimeSectionRef(options.parent);
    if (options?.parent !== undefined && options?.parent !== null && !targetParentRef) {
      return null;
    }
    if (targetParentRef && this.sectionTreeContainsId(ref.section, targetParentRef.sectionId)) {
      return null;
    }

    const targetSiblings = targetParentRef ? targetParentRef.section.children : this.runtimeSectionStore.sections;
    const rawIndex = Number(options?.index);
    let insertIndex = Number.isFinite(rawIndex)
      ? Math.max(0, Math.min(targetSiblings.length, Math.floor(rawIndex)))
      : targetSiblings.length;

    ref.siblings.splice(ref.siblingIndex, 1);
    if (ref.siblings === targetSiblings && insertIndex > ref.siblingIndex) {
      insertIndex -= 1;
    }

    this.setRuntimeSectionSubtreeLevels(ref.section, targetParentRef ? targetParentRef.section.level + 1 : ref.section.level);
    targetSiblings.splice(insertIndex, 0, ref.section);

    this.applyRuntimeSectionStoreMutation('move section');
    const moved = ref.section.id ? this.resolveRuntimeSectionRef(ref.section.id) : null;
    return moved ? { sectionId: moved.sectionId, sectionIndex: moved.sectionIndex } : null;
  }

  private getWorldsTimelineRuntimeState(track: CompiledWorldsTimeline): WorldsTimelineRuntimeState {
    const key = track as unknown as object;
    const existing = this.worldsTimelineRuntimeState.get(key);
    if (existing) return existing;
    const next: WorldsTimelineRuntimeState = {
      baseByKey: new Map(),
      lastAppliedByKey: new Map(),
    };
    this.worldsTimelineRuntimeState.set(key, next);
    return next;
  }

  private resetWorldsTimelineRuntimeState(track: CompiledWorldsTimeline): void {
    this.worldsTimelineRuntimeState.delete(track as unknown as object);
  }

  private captureWorldsTimelineBaseState(selector: WorldsTimelineSectionSelector): WorldsTimelineBaseState | null {
    const ref = this.resolveRuntimeSectionRef(selector);
    if (!ref) return null;
    const layout = this.getSectionLayoutByIndex(ref.sectionIndex);
    return {
      selector,
      title: ref.section.title,
      content: ref.section.content,
      visible: layout?.visible ?? true,
      autoPositioned: layout?.autoPositioned ?? false,
      position: layout ? { ...layout.transform.position } : { x: 0, y: 0, z: 0 },
      rotation: layout
        ? {
            x: (layout.transform.rotation.x * 180) / Math.PI,
            y: (layout.transform.rotation.y * 180) / Math.PI,
            z: (layout.transform.rotation.z * 180) / Math.PI,
          }
        : { x: 0, y: 0, z: 0 },
      scale: layout ? { ...layout.transform.scale } : { x: 1, y: 1, z: 1 },
    };
  }

  private buildWorldsTimelineEffectiveState(
    base: WorldsTimelineBaseState,
    patch: WorldsTimelinePatch | undefined,
  ): WorldsTimelineEffectiveState {
    return {
      selector: base.selector,
      title: patch?.title ?? base.title,
      content: patch?.content ?? base.content,
      visible: patch?.visible ?? base.visible,
      autoPositioned: base.autoPositioned,
      position: {
        x: patch?.position?.x ?? base.position.x,
        y: patch?.position?.y ?? base.position.y,
        z: patch?.position?.z ?? base.position.z,
      },
      rotation: {
        x: patch?.rotation?.x ?? base.rotation.x,
        y: patch?.rotation?.y ?? base.rotation.y,
        z: patch?.rotation?.z ?? base.rotation.z,
      },
      scale: {
        x: patch?.scale?.x ?? base.scale.x,
        y: patch?.scale?.y ?? base.scale.y,
        z: patch?.scale?.z ?? base.scale.z,
      },
    };
  }

  private worldsTimelineStatesEqual(a: WorldsTimelineEffectiveState | undefined, b: WorldsTimelineEffectiveState): boolean {
    if (!a) return false;
    return (
      a.title === b.title &&
      a.content === b.content &&
      a.visible === b.visible &&
      a.position.x === b.position.x &&
      a.position.y === b.position.y &&
      a.position.z === b.position.z &&
      a.rotation.x === b.rotation.x &&
      a.rotation.y === b.rotation.y &&
      a.rotation.z === b.rotation.z &&
      a.scale.x === b.scale.x &&
      a.scale.y === b.scale.y &&
      a.scale.z === b.scale.z
    );
  }

  private applyWorldsTimeline(track: CompiledWorldsTimeline, timeSec: number): WorldsTimelineStateEntry[] {
    const runtime = this.getWorldsTimelineRuntimeState(track);
    const nextState = stateAtWorldsTimeline(track, timeSec);
    const nextByKey = new Map(nextState.map((entry) => [getWorldsTimelineSelectorKey(entry.section), entry]));

    for (const selector of track.sections) {
      const key = getWorldsTimelineSelectorKey(selector);
      let base = runtime.baseByKey.get(key);
      if (!base) {
        const captured = this.captureWorldsTimelineBaseState(selector);
        if (captured) {
          runtime.baseByKey.set(key, captured);
          base = captured;
        }
      }
      if (!base) continue;

      const activePatch = nextByKey.get(key)?.patch;
      const desired = this.buildWorldsTimelineEffectiveState(base, activePatch);
      const previous = runtime.lastAppliedByKey.get(key);
      if (!previous && !activePatch) {
        runtime.lastAppliedByKey.set(key, desired);
        continue;
      }
      if (this.worldsTimelineStatesEqual(previous, desired)) continue;

      const contentPatch: Partial<Section> = {};
      if (!previous || previous.title !== desired.title) contentPatch.title = desired.title;
      if (!previous || previous.content !== desired.content) contentPatch.content = desired.content;
      if (Object.keys(contentPatch).length > 0) {
        this.updateRuntimeSection(selector, contentPatch);
      }

      const ref = this.resolveRuntimeSectionRef(selector);
      if (!ref) continue;
      const layout = this.getSectionLayoutByIndex(ref.sectionIndex);
      if (!layout) continue;

      if (!previous || previous.visible !== desired.visible) {
        layout.visible = desired.visible;
        this.getOrCreateSectionRuntimeOverride(layout.sectionId).visible = desired.visible;
      }

      if (
        !previous ||
        previous.position.x !== desired.position.x ||
        previous.position.y !== desired.position.y ||
        previous.position.z !== desired.position.z ||
        previous.rotation.x !== desired.rotation.x ||
        previous.rotation.y !== desired.rotation.y ||
        previous.rotation.z !== desired.rotation.z ||
        previous.scale.x !== desired.scale.x ||
        previous.scale.y !== desired.scale.y ||
        previous.scale.z !== desired.scale.z
      ) {
        layout.transform.position = { ...desired.position };
        layout.transform.rotation = {
          x: (desired.rotation.x * Math.PI) / 180,
          y: (desired.rotation.y * Math.PI) / 180,
          z: (desired.rotation.z * Math.PI) / 180,
        };
        layout.transform.scale = { ...desired.scale };
        const hasTransformPatch = !!(activePatch?.position || activePatch?.rotation || activePatch?.scale);
        layout.autoPositioned = hasTransformPatch ? false : base.autoPositioned;

        const override = this.getOrCreateSectionRuntimeOverride(layout.sectionId);
        if (activePatch?.position) override.position = { ...desired.position };
        else delete override.position;
        if (activePatch?.rotation) override.rotationDegrees = { ...desired.rotation };
        else delete override.rotationDegrees;
        if (activePatch?.scale) override.scale = { ...desired.scale };
        else delete override.scale;
      }

      runtime.lastAppliedByKey.set(key, desired);
    }

    return nextState;
  }

  /**
   * Iterate all runtime sections and auto-apply any inline `contentFrames` /
   * `titleFrames` entries parsed from `timed animate:*` blocks in the document.
   * Called automatically at the end of `applyWorldsTimeline`.
   */
  private applyAllSectionFrames(timeSec: number): void {
    for (const ref of this.getRuntimeSectionRefs()) {
      const { section, sectionId } = ref;
      if (section.contentFrames && section.contentFrames.length > 0) {
        const t = section.contentFramesRelative
          ? timeSec - (section.timedMs !== undefined
              ? section.timedMs / 1000
              : (this.sectionAnimEnterTimes.get(sectionId) ?? 0))
          : timeSec;
        this.applyWorldsTimedContent(sectionId, section.contentFrames as any, t);
      }
      if (section.titleFrames && section.titleFrames.length > 0) {
        const t = section.titleFramesRelative
          ? timeSec - (section.timedMs !== undefined
              ? section.timedMs / 1000
              : (this.sectionAnimEnterTimes.get(sectionId) ?? 0))
          : timeSec;
        this.applyWorldsTimedContent(sectionId, section.titleFrames as any, t, { target: 'title' });
      }
    }
  }

  /**
   * Start the main loop (async to support WebGPU init)
   */
  async start(): Promise<void> {
    if (this.running) return;
    
    // Initialize renderer (WebGPU needs async init)
    if ('init' in this.renderer && typeof this.renderer.init === 'function') {
      const success = await this.renderer.init();
      if (!success) {
        console.warn('⚠ WebGPU init failed, falling back to Canvas2D');
        // Create Canvas2D fallback
        const canvas = (this.renderer as any).canvas;
        this.renderer = new Canvas2DRenderer(canvas, { fontFamily: this.fontFamily, fontSize: this.fontSize });
        this.renderer.resize(this.width, this.height);
        this.syncCanvasElementSizeToBuffer();
      } else if (this.renderer instanceof WebGPURenderer) {
        // WebGPU initialized successfully - set up compositor
        await this.initCompositor();

        // Keep engine-level WebGPU device in sync with the renderer's device.
        // The renderer is the source of truth for WebGPU initialization.
        const device = this.renderer.getContext().getDevice();
        if (device) {
          this.webgpuDevice = device;
          const needsShaderSupport = this.hasPendingDocumentShaders() || !!this.pendingShaderChain;
          if (needsShaderSupport || this.worldsEnabled) {
            await this.ensureShaderSupport(device);
          }

          if (this.worldsEnabled) {
            await this.ensureWorldsRendererInitialized(device);
          }

          if (this.pendingShaderChain && this.shaderChainManager) {
            console.log(`✓ Applying deferred shader chain (${this.pendingShaderChain.source}): ${this.pendingShaderChain.chainStr}`);
            await this.shaderChainManager.activateChainFromString(
              this.pendingShaderChain.chainStr,
              this.pendingShaderChain.source
            );
            this.pendingShaderChain = null;
          }
        }
      }
    }
    
    this.running = true;
    this.lastFrameTime = performance.now();
    console.log('✓ Main loop started');
    this.mainLoop(this.lastFrameTime);
  }

  /**
   * Stop the main loop
   */
  stop(): void {
    this.running = false;
    console.log('✓ Main loop stopped');
  }

  /**
   * Main loop: update, render, composite
   */
  private mainLoop(timestamp: number): void {
    if (!this.running) return;

    this.deltaTime = (timestamp - this.lastFrameTime) / 1000;
    this.lastFrameTime = timestamp;
    this.elapsedTime += this.deltaTime;

    this.runFrame();
    this.frameCount++;
    requestAnimationFrame((ts) => this.mainLoop(ts));
  }

  /**
   * Run one frame: update + render + composite + input flush.
   * elapsedTime and deltaTime must be set before calling.
   * Shared by the live mainLoop and tickExportFrame.
   */
  private runFrame(): void {
    try {
      // Update phase
      this.update();

      // Render phase
      this.render();

      // Composite and present
      if (this.compositor) {
        // WebGPU path: terminal renders to texture, compositor blits it + canvas2d
        const composited = this.layers.composite();

        this.renderer.render(composited);  // Render terminal to offscreen texture

        // Keep compositor terminal layer texture in sync.
        // The terminal render texture can be created lazily or recreated on resize.
        if (this.renderer instanceof WebGPURenderer) {
          const terminalTexture = this.renderer.getRenderTexture();
          const existing = this.compositor.layers.get('terminal')?.texture;
          if (terminalTexture && existing !== terminalTexture) {
            this.compositor.updateLayerTexture('terminal', terminalTexture);
            if (this.frameCount < 3) {
              console.log('[Compositor] Updated terminal layer texture');
            }
          } else if (!terminalTexture && this.frameCount < 3) {
            console.warn('[Compositor] Terminal render texture missing; frame may be blank');
          }

        }

        // Render 3D canvas to offscreen texture (before compositing)
        if (this.worldsEnabled && !this.worldsRenderer) {
          this.requestWorldsRendererInitialization();
        }

        if (this.worldsEnabled && this.worldsRenderer && this.camera3D) {
          const pick = this.pick3DAt(this.input.getMouseX(), this.input.getMouseY());

          // Track the hovered/focused link region for Worlds interaction.
          this.hovered3DLink = null;
          if (pick) {
            const linkHit = this.hitTest3DLinkAtUV(pick.layout.sectionIndex, pick.u, pick.v);
            if (linkHit) {
                this.hovered3DLink = {
                  sectionId: pick.layout.sectionId,
                  sectionIndex: pick.layout.sectionIndex,
                  linkIndex: linkHit.linkIndex,
                };
            }
          }

          // Ensure each section has a texture with its rendered heading/content.
          if (this.section3DLayouts.length > 0 && this.renderer instanceof WebGPURenderer) {
            const device = this.renderer.getContext().getDevice();
            if (device) {
              if (this.worldsConfig.sectionTextureMode === 'webgpu-ui') {
                this.ensure3DSectionTexturesWebGPUUI(device);
              } else {
                this.ensure3DSectionTextures(device);
              }
            }
          }

          // Whole-card hover invert disabled.
          const backgroundChain = this.parseWorldsSectionBackgroundChain();
          const proceduralBackground = this.isWorldsSectionBackgroundProceduralChainEnabled();
          const hasRuledLines = backgroundChain.includes('ruledlines') || backgroundChain.includes('ruled-lines') || backgroundChain.includes('ruled_lines');
          const hasPaper = backgroundChain.includes('paper');

          // Paper grain in the Worlds background shader is intentionally subtle,
          // but on light themes it can read as “nothing” when used without
          // ruled lines. Use a slightly stronger default for paper-only.
          const defaultPaperNoiseStrength = hasPaper && !hasRuledLines ? 0.22 : 0.06;
          const configuredPaperNoiseStrength = (this.worldsConfig as any).sectionBackgroundPaperNoiseStrength;
          const paperNoiseStrength = Number.isFinite(configuredPaperNoiseStrength)
            ? Math.max(0, Math.min(1, configuredPaperNoiseStrength))
            : defaultPaperNoiseStrength;

          // Check for shader background
          const shaderInfo = this.parseWorldsSectionBackgroundShader();
          const textureInfo = this.parseWorldsSectionBackgroundTexture();
          const baseTextureImage = textureInfo
            ? this.ensureWorldsBackgroundImageLoaded(textureInfo.url)
            : null;
          const overlayTextureImage = textureInfo?.overlayUrl
            ? this.ensureWorldsImageLoaded(textureInfo.overlayUrl)
            : null;
          const textureImage = textureInfo && baseTextureImage
            ? (overlayTextureImage && textureInfo.overlayUrl
                ? this.composeWorldsBackgroundOverlay(
                    `bg-overlay:${String((this.worldsConfig as any).sectionBackground ?? '')}`,
                    baseTextureImage,
                    overlayTextureImage,
                    {
                      blendMode: textureInfo.overlayBlendMode ?? 'hardlight',
                      opacity: textureInfo.overlayOpacity ?? 0.24,
                      fit: textureInfo.overlayFit ?? 'cover',
                    }
                  ) ?? baseTextureImage
                : baseTextureImage)
            : null;

          // If using a shader background, merge in a few engine-provided uniforms
          // (only applied if the shader declares these uniforms).
          let mergedShaderUniforms: Record<string, number | number[]> | undefined = shaderInfo?.uniforms
            ? { ...shaderInfo.uniforms }
            : (shaderInfo ? {} : undefined);
          if (shaderInfo && mergedShaderUniforms) {
            // Flag for shaders that support dual modes (e.g. `ruledlines`).
            mergedShaderUniforms.worldsBackground = 1;

            // Provide theme-derived paper color for shaders that generate their
            // own paper base.
            const paper = ColorUtils.rgbaNorm(this.resolveWorldsSectionBackground());
            mergedShaderUniforms.paperColor = [paper[0], paper[1], paper[2]];
            // Compatibility: some shaders avoid vec3 uniforms and use scalar RGB.
            (mergedShaderUniforms as any).paperColorR = paper[0];
            (mergedShaderUniforms as any).paperColorG = paper[1];
            (mergedShaderUniforms as any).paperColorB = paper[2];

            // Default tile size for row-aligned background shaders.
            if (!('rowsPerTile' in mergedShaderUniforms)) {
              mergedShaderUniforms.rowsPerTile = 32;
            }
          }

          // For shader-based backgrounds, we need a stable mapping from world
          // coords -> background UVs. Treat `coordScale` as an engine-level
          // parameter (world tiling frequency). Do NOT fall back to a shader's
          // `scale` uniform here because many background shaders use `scale`
          // internally (e.g. as a noise frequency), and coupling the two makes
          // the background appear massively zoomed.
          const shaderCoordScaleRaw = mergedShaderUniforms
            ? (mergedShaderUniforms as any).coordScale
            : undefined;
          let shaderCoordScale = Number.isFinite(shaderCoordScaleRaw as any)
            ? (shaderCoordScaleRaw as number)
            : 1;

          // Special-case: `shader:ruledlines` is intended to align to the text
          // grid in Worlds. If the user didn’t provide `coordScale`, derive a
          // reasonable default from `rowsPerTile` so dark lines land on integer
          // world units (1 unit == 1 text row in `sectionSizeUnits: 'text'`).
          if (shaderInfo && !(Number.isFinite(shaderCoordScaleRaw as any))) {
            const shaderNameKey = String(shaderInfo.name ?? '').trim().toLowerCase();
            if (shaderNameKey === 'ruledlines') {
              const rowsRaw = mergedShaderUniforms ? (mergedShaderUniforms as any).rowsPerTile : undefined;
              const rows = Number.isFinite(rowsRaw as any) && (rowsRaw as number) > 0
                ? (rowsRaw as number)
                : 32;
              shaderCoordScale = 1 / rows;
            }
          }

          // Keep ruledlines' `coordScale` and `rowsPerTile` in sync when the
          // user provides only one of them.
          if (shaderInfo && mergedShaderUniforms) {
            const shaderNameKey = String(shaderInfo.name ?? '').trim().toLowerCase();
            if (shaderNameKey === 'ruledlines') {
              const hasRows = Number.isFinite((mergedShaderUniforms as any).rowsPerTile as any);
              const hasScale = Number.isFinite((mergedShaderUniforms as any).coordScale as any);
              if (hasScale && !hasRows) {
                const s = (mergedShaderUniforms as any).coordScale as number;
                if (s > 0) (mergedShaderUniforms as any).rowsPerTile = 1 / s;
              } else if (hasRows && !hasScale) {
                const rows = (mergedShaderUniforms as any).rowsPerTile as number;
                if (rows > 0) (mergedShaderUniforms as any).coordScale = 1 / rows;
              }
            }
          }
          
          const paperPlaneZ = (() => {
            const planeZValue = shaderInfo?.paperPlaneZ ?? textureInfo?.paperPlaneZ;
            const planeZMode = shaderInfo?.paperPlaneZMode ?? textureInfo?.paperPlaneZMode;

            if (Number.isFinite(planeZValue as any)) {
              return planeZValue as number;
            }

            if (planeZMode === 'focus') {
              const focusedIdx = this.lastApplied3DCameraFocus?.kind === 'frame'
                ? null
                : this.lastApplied3DCameraFocus?.sectionIndex;
              if (!(typeof focusedIdx === 'number' && Number.isFinite(focusedIdx))) return undefined;
              const focused = this.section3DLayouts.find(l => l.sectionIndex === focusedIdx);
              const z = focused?.transform?.position?.z;
              return Number.isFinite(z as any) ? (z as number) : undefined;
            }

            return undefined;
          })();

          const worldsPixelsPerWorldUnit = this.getWorldsPixelsPerWorldUnit();
          const textureTilePx = Number.isFinite(textureInfo?.tilePx as any)
            ? Math.max(1, textureInfo!.tilePx as number)
            : 512;
          const textureCoordScale = Number.isFinite(textureInfo?.coordScale as any)
            ? (textureInfo!.coordScale as number)
            : (worldsPixelsPerWorldUnit / textureTilePx);

          const backgroundConfig = proceduralBackground || shaderInfo || textureInfo
            ? {
                enabled: true,
                chain: backgroundChain,
                shaderName: shaderInfo?.name,
                shaderUniforms: mergedShaderUniforms,
                image: textureImage,
                screenLock: textureInfo?.screenLock,
                paperPlaneZ,
                paperColor: this.resolveWorldsSectionBackground(),
                lineColor: this.withAlpha(this.getStyle('dim').fg, 0x40),
                scale: shaderInfo ? shaderCoordScale : (textureInfo ? textureCoordScale : 1),
                spacing: 1,
                thickness: 0.06,
                noiseStrength: paperNoiseStrength,
                sectionBlendMode: (textureInfo?.blendMode ?? (this.worldsConfig as any)?.sectionBlendMode) as any,
                contentDistortStrength: (Number.isFinite((textureInfo as any)?.contentDistort as any)
                  ? ((textureInfo as any).contentDistort as number)
                  : (Number.isFinite((this.worldsConfig as any)?.contentDistortStrength as any)
                      ? (this.worldsConfig as any).contentDistortStrength
                      : 0)),
                contentBlendStrength: Number.isFinite((textureInfo as any)?.blendStrength as any)
                  ? ((textureInfo as any).blendStrength as number)
                  : undefined,
              }
            : undefined;

          const sectionArtStates = new Map<string, WorldsSectionArtRenderState>();
          for (const layout of this.section3DLayouts) {
            const art = layout.sectionArt;
            if (!art?.url) continue;
            const image = this.ensureWorldsImageLoaded(art.url);
            if (!image) continue;
            sectionArtStates.set(layout.sectionId, {
              image,
              opacity: art.opacity,
              blendMode: art.blendMode,
              layer: art.layer,
              fit: art.fit,
              scale: art.scale,
              offsetX: art.offsetX,
              offsetY: art.offsetY,
            });
          }

          const linkConnectors = this.getRendered3DLinkConnectors();
          this.worldsRenderer.render(this.camera3D, this.section3DLayouts, null, backgroundConfig, linkConnectors, sectionArtStates);
        }

        const guiSystemForOverlay = (this.api?.gui as any)?.getSystem?.();
        const overlayRenderer = this.webgpuUIRenderer ?? (guiSystemForOverlay ? this.ensureWebGPUUI() : null);

        // Render GPU UI into its own texture.
        if (overlayRenderer) {
          this.syncWorldsInlineWidgets();

          let inlineGui: any = null;
          if (this.worldsInlineWidgetInstances.length > 0) {
            inlineGui = guiSystemForOverlay ?? (this.api?.gui as any)?.getSystem?.();
          }
          if (inlineGui) {
            const { charWidth, charHeight } = this.getGUIPixelMetrics();
            inlineGui.update(this.input.getMouseX(), this.input.getMouseY(), this.input.isMouseDown(0), charWidth, charHeight);
            this.syncWorldsInlineWidgets();
          }

          // Section-bound retained GUI needs its hover/pressed state updated in section-local coordinates.
          // The generic gui.update() runs in screen space, so we drive a per-frame update for the
          // preferred active section when bindings exist.
          const guiAPIAny: any = this.api?.gui;
          const systemForSectionGUI = guiAPIAny?.getSystem?.();
          let bindingsForSectionGUI: Array<{ group: string | number; sections: number[] }> = [];
          if (Array.isArray(guiAPIAny?._sectionBindings)) {
            bindingsForSectionGUI = guiAPIAny._sectionBindings;
          }
          if (systemForSectionGUI && this.worldsEnabled && this.camera3D && bindingsForSectionGUI.length > 0) {
            const sectionGuiMode = this.getWorldsSectionGUIMode();

            // In baked mode, visuals live in the section texture. If the GUI system
            // indicates a state change (hover/pressed/focus/caret/etc), re-bake all
            // bound sections so they don't appear "stuck" until a section becomes
            // selected again.
            if (sectionGuiMode === 'baked') {
              const anySystem = systemForSectionGUI as any;
              const needsRebake =
                (typeof anySystem.needsRedraw === 'function' && !!anySystem.needsRedraw()) ||
                (typeof anySystem.getNeedsRedraw === 'function' && !!anySystem.getNeedsRedraw());
              if (needsRebake) {
                for (const binding of bindingsForSectionGUI) {
                  for (const idx of binding.sections || []) {
                    if (typeof idx === 'number' && Number.isFinite(idx)) {
                      this.invalidate3DSectionTexture(idx);
                    }
                  }
                }
              }
            }

            let preferredIndex = this.getResolvedCurrent3DSectionIndex();
            const selectedSectionIndex = this.getResolvedSelected3DSectionIndex();
            if (typeof selectedSectionIndex === 'number' && Number.isFinite(selectedSectionIndex)) {
              preferredIndex = selectedSectionIndex;
            }
            const preferredLayout = this.getSectionLayoutByIndex(preferredIndex);
            if (preferredLayout && preferredLayout.visible && preferredLayout.interactive !== false && preferredLayout.texture) {
              const xform = this.getWorldsSectionTextureToScreenAffine(preferredLayout);
              if (xform) {
                const mx = this.input.getMouseX();
                const my = this.input.getMouseY();
                const localX = xform.localFromScreenTexPx.a * mx + xform.localFromScreenTexPx.c * my + xform.localFromScreenTexPx.e;
                const localY = xform.localFromScreenTexPx.b * mx + xform.localFromScreenTexPx.d * my + xform.localFromScreenTexPx.f;
                const { charWidth, charHeight } = this.getGUIPixelMetrics();
                systemForSectionGUI.update(localX, localY, this.input.isMouseDown(0), charWidth, charHeight);

                // In baked mode, hover/pressed/focus visuals live in the section texture.
                // Trigger a re-bake while the mouse is over the section to keep visuals responsive.
                if (sectionGuiMode === 'baked' && typeof preferredIndex === 'number' && Number.isFinite(preferredIndex)) {
                  const clip = xform.clipRectScreen;
                  const over = mx >= clip.x && my >= clip.y && mx <= clip.x + clip.w && my <= clip.y + clip.h;
                  if (over) {
                    this.invalidate3DSectionTexture(preferredIndex);
                  }
                }
              }
            }
          }

          // Render retained-mode GUI widgets
          const guiAPI = this.api?.gui;
          const guiSystem = guiAPI?.getSystem?.();
          if (guiAPI && guiSystem) {
            const hasSectionBindings = Array.isArray((guiAPI as any)?._sectionBindings) && (guiAPI as any)._sectionBindings.length > 0;
            const excludedGroups = hasSectionBindings ? this.getWorldsSectionBoundGUIGroupIds(guiAPI) : null;
            const manager = typeof (guiSystem as any).getWidgetManager === 'function'
              ? (guiSystem as any).getWidgetManager()
              : null;
            const visibleWidgets = manager && typeof manager.getVisible === 'function'
              ? manager.getVisible()
              : [];
            const autoUpdateEnabled = typeof (guiAPI as any).isAutoUpdateEnabled === 'function' && !!(guiAPI as any).isAutoUpdateEnabled();
            if (autoUpdateEnabled) {
              const { charWidth, charHeight } = this.getGUIPixelMetrics();
              if (this.worldsEnabled && hasSectionBindings && excludedGroups && excludedGroups.size > 0 && typeof guiSystem.updateExcludingGroups === 'function') {
                guiSystem.updateExcludingGroups(this.input.getMouseX(), this.input.getMouseY(), this.input.isMouseDown(0), charWidth, charHeight, excludedGroups);
              } else if (!this.worldsEnabled || !hasSectionBindings) {
                guiSystem.update(this.input.getMouseX(), this.input.getMouseY(), this.input.isMouseDown(0), charWidth, charHeight);
              }
            }
            // When sections are bound, render those groups in section-space.
            // Avoid double-rendering the same widgets in the global overlay pass.
            const sectionGuiMode = this.getWorldsSectionGUIMode();
            const overlayUI = this.createMarkdownAwareDraw2D(overlayRenderer, this.activeDocumentId ?? undefined);
            if (sectionGuiMode !== 'baked') {
              this.renderWorldsSectionBoundGUI(overlayUI);
            }
            this.debugGuiLogOverlayRender('pre-render', {
              hasSectionBindings,
              excludedGroups: excludedGroups ? Array.from(excludedGroups) : [],
              visibleWidgetIds: Array.isArray(visibleWidgets)
                ? visibleWidgets.map((widget: any) => ({
                    id: widget?.id ?? null,
                    group: widget?.group ?? null,
                    visible: !!widget?.state?.visible,
                  }))
                : [],
            });
            if (this.worldsEnabled && hasSectionBindings && excludedGroups && excludedGroups.size > 0 && typeof guiSystem.renderExcludingGroups === 'function') {
              const { charWidth, charHeight } = this.getGUIPixelMetrics();
              guiSystem.renderExcludingGroups(
                excludedGroups,
                overlayUI,
                charWidth,
                charHeight,
              );
              this.debugGuiLogOverlayRender('render-excluding-groups', {
                excludedGroups: Array.from(excludedGroups),
                visibleWidgetCount: Array.isArray(visibleWidgets) ? visibleWidgets.length : 0,
              });
            } else if (!this.worldsEnabled || !hasSectionBindings) {
              guiAPI.render(overlayUI);
              this.debugGuiLogOverlayRender('render-all', {
                visibleWidgetCount: Array.isArray(visibleWidgets) ? visibleWidgets.length : 0,
              });
            }
          }
          
          overlayRenderer.flush();

          // Thread the material render target to the compositor so the shader
          // chain can access per-pixel material properties (Phase 1 PBR).
          this.compositor.setMaterialTexture(overlayRenderer.getMaterialTexture());
        }

        // Only auto-composite in auto mode. In manual mode, user code controls
        // clear/blit/present inside the document render handler.
        if (this.compositor.mode === 'auto') {
          // Keep built-in shaders (e.g. ruledlines) in sync with the actual
          // terminal cell size derived from the current font metrics.
          this.syncTerminalCellSizeToShaders();

          // Clear to theme background (Worlds renders to transparent).
          this.compositor.setAutoClearColor(this.currentTheme.bg);
          this.compositor.autoComposite();   // Composite all layers to main canvas
        } else if (this.frameCount < 3) {
          console.warn('[Compositor] Manual mode is active; user code must call compositor.present() each frame');
        }
      } else {
        // Canvas2D fallback: render directly
        const composited = this.layers.composite();
        this.renderer.render(composited);

        if (this.renderer instanceof Canvas2DRenderer) {
          this.syncWorldsInlineWidgets();

          const guiAPI = this.api?.gui as any;
          const guiSystem = guiAPI?.getSystem?.();
          if (guiAPI && guiSystem) {
            const hasSectionBindings = Array.isArray(guiAPI?._sectionBindings) && guiAPI._sectionBindings.length > 0;
            const excludedGroups = hasSectionBindings ? this.getWorldsSectionBoundGUIGroupIds(guiAPI) : null;
            const manager = typeof guiSystem.getWidgetManager === 'function'
              ? guiSystem.getWidgetManager()
              : null;
            const visibleWidgets = manager && typeof manager.getVisible === 'function'
              ? manager.getVisible()
              : [];
            const autoUpdateEnabled = typeof guiAPI.isAutoUpdateEnabled === 'function' && !!guiAPI.isAutoUpdateEnabled();
            if (autoUpdateEnabled) {
              const { charWidth, charHeight } = this.getGUIPixelMetrics();
              if (this.worldsEnabled && hasSectionBindings && excludedGroups && excludedGroups.size > 0 && typeof guiSystem.updateExcludingGroups === 'function') {
                guiSystem.updateExcludingGroups(this.input.getMouseX(), this.input.getMouseY(), this.input.isMouseDown(0), charWidth, charHeight, excludedGroups);
              } else if (!this.worldsEnabled || !hasSectionBindings) {
                guiSystem.update(this.input.getMouseX(), this.input.getMouseY(), this.input.isMouseDown(0), charWidth, charHeight);
              }
            }
            const overlayUI = this.renderer.createDraw2D();
            const sectionGuiMode = this.getWorldsSectionGUIMode();
            if (sectionGuiMode !== 'baked') {
              this.renderWorldsSectionBoundGUI(overlayUI);
            }
            this.debugGuiLogOverlayRender('pre-render', {
              hasSectionBindings,
              excludedGroups: excludedGroups ? Array.from(excludedGroups) : [],
              visibleWidgetIds: Array.isArray(visibleWidgets)
                ? visibleWidgets.map((widget: any) => ({
                    id: widget?.id ?? null,
                    group: widget?.group ?? null,
                    visible: !!widget?.state?.visible,
                  }))
                : [],
            });
            if (this.worldsEnabled && hasSectionBindings && excludedGroups && excludedGroups.size > 0 && typeof guiSystem.renderExcludingGroups === 'function') {
              const { charWidth, charHeight } = this.getGUIPixelMetrics();
              guiSystem.renderExcludingGroups(excludedGroups, overlayUI, charWidth, charHeight);
              this.debugGuiLogOverlayRender('render-excluding-groups', {
                excludedGroups: Array.from(excludedGroups),
                visibleWidgetCount: Array.isArray(visibleWidgets) ? visibleWidgets.length : 0,
              });
            } else if (!this.worldsEnabled || !hasSectionBindings) {
              guiAPI.render(overlayUI);
              this.debugGuiLogOverlayRender('render-all', {
                visibleWidgetCount: Array.isArray(visibleWidgets) ? visibleWidgets.length : 0,
              });
            }
          }
        }
      }
    } catch (error) {
      console.error('[Engine] Uncaught error in runFrame:', error);
    }

    // Clean up input state
    this.input.endFrame();
  }

  /**
   * Pause the main loop for video export.
   * Freezes user input so document code sees no events during the export.
   * Call resumeFromExport() when done.
   */
  pauseForExport(): void {
    this.running = false;
    this._isExporting = true;
    this.input.setEnabled(false);
    this._exportAudioBuffer = null;
    this._exportAudioOffset = 0;

    // Snapshot live-time so we can restore it after export.
    this._preExportState = {
      elapsedTime: this.elapsedTime,
      deltaTime: this.deltaTime,
      frameCount: this.frameCount,
    };

    // Export runs with a synthetic clock starting at t=0.
    this.elapsedTime = 0;
    this.deltaTime = 0;
    this.frameCount = 0;

    // Give document code a deterministic moment to reset automation state.
    const doc = this.getActiveDocument();
    const handler = (doc?.handlers as any)?.export as undefined | ((options?: { timedBlock?: string | null }) => void);
    if (handler) {
      try {
        handler({ timedBlock: this._exportTimedBlockSelection });
      } catch (e) {
        console.warn('[Engine] Error in export handler:', e);
      }
    }
  }

  /**
   * Configure export-only options used by pauseForExport().
   * Called by the export UI before starting the tickExportFrame loop.
   */
  setExportTimedBlockSelection(name: string | null): void {
    const trimmed = String(name ?? '').trim();
    this._exportTimedBlockSelection = trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Resume normal operation after a video export ends or is cancelled.
   */
  resumeFromExport(): void {
    this._isExporting = false;
    this.input.setEnabled(true);

    // Restore live-time so returning to interactive mode doesn't jump.
    if (this._preExportState) {
      this.elapsedTime = this._preExportState.elapsedTime;
      this.deltaTime = this._preExportState.deltaTime;
      this.frameCount = this._preExportState.frameCount;
      this._preExportState = null;
    }

    this.running = true;
    this.lastFrameTime = performance.now();
    this.mainLoop(this.lastFrameTime);
  }

  /**
   * List timed block names available in the active document.
   * Useful for host/UI features (e.g. export panel dropdowns).
   */
  getTimedBlockNames(): string[] {
    const docId = this.activeDocumentId;
    if (!docId) return [];
    const doc = this.documents.get(docId) as any;
    const store = doc?._timedStore as Map<string, any> | undefined;
    if (!store) return [];
    return Array.from(store.keys());
  }

  /**
   * Return the sample rate of the engine's live AudioContext.
   * Used by the video export panel to configure the OfflineAudioContext.
   */
  getAudioSampleRate(): number {
    return this.audioContext.sampleRate;
  }

  unlockAudioFromHostGesture(): boolean {
    this.beginTrustedAudioGesture();
    this.endTrustedAudioGesture();
    try {
      this.canvas.focus();
    } catch {
      // ignore
    }
    const ctx = this.audioContext as AudioContext & { state?: AudioContextState };
    return this.audioGestureUnlocked || ctx.state === 'running';
  }

  /** True while a video export is in progress. Exposed to document code via api.isExporting. */
  private _isExporting: boolean = false;

  get isExporting(): boolean { return this._isExporting; }

  /** AudioBuffer captured by document code via captureForExport() during an export pass. */
  private _exportAudioBuffer: AudioBuffer | null = null;
  private _exportAudioOffset: number = 0;

  /**
   * Store an AudioBuffer (and optional playback start offset) for use in the
   * current video export. Called by the audio.captureForExport() sandbox method.
   */
  setExportAudioBuffer(buffer: AudioBuffer, offsetSec: number = 0): void {
    this._exportAudioBuffer = buffer;
    this._exportAudioOffset = offsetSec;
  }

  /**
   * Return the captured audio buffer (and offset) for the current export pass,
   * or null if none was captured.
   */
  getExportAudioBuffer(): { buffer: AudioBuffer; offsetSec: number } | null {
    if (!this._exportAudioBuffer) return null;
    return { buffer: this._exportAudioBuffer, offsetSec: this._exportAudioOffset };
  }

  /**
   * Suggest an export duration based on the current export context.
   * Prefers a captured AudioBuffer, and falls back to the selected timed block.
   */
  getSuggestedExportDuration(): number | null {
    const captured = this.getExportAudioBuffer();
    if (captured?.buffer) {
      const duration = Number(captured.buffer.duration);
      const offset = Math.max(0, Math.min(duration, Number(captured.offsetSec) || 0));
      const remaining = duration - offset;
      if (Number.isFinite(remaining) && remaining > 0) return remaining;
    }

    const selected = this._exportTimedBlockSelection;
    if (!selected) return null;

    const docId = this.activeDocumentId;
    if (!docId) return null;
    const doc = this.documents.get(docId) as any;
    const store = doc?._timedStore as Map<string, { name: string; entries: Array<{ ms: number; text: string }> }> | undefined;
    const entries = store?.get(selected)?.entries;
    if (!entries || entries.length === 0) return null;

    const last = entries[entries.length - 1];
    const duration = Number(last?.ms) / 1000;
    return Number.isFinite(duration) && duration > 0 ? duration : null;
  }

  /**
   * Resize the canvas and engine to an exact pixel resolution for native-quality
   * video export. The canvas is resized to the nearest cell-aligned dimensions
   * that fit within exportWidth × exportHeight.
   *
   * Returns the actual pixel size used (may be a few px smaller than requested
   * due to cell alignment). Pass these to VideoExporter as exportWidth/exportHeight.
   * Call restoreExportResize() with the returned token when export ends.
   */
  resizeForExport(exportWidth: number, exportHeight: number): {
    actualWidth: number;
    actualHeight: number;
    token: { cols: number; rows: number; canvasW: number; canvasH: number };
  } {
    const token = {
      cols:    this.width,
      rows:    this.height,
      canvasW: this.canvas.width,
      canvasH: this.canvas.height,
    };

    // Derive character cell size from the current atlas (WebGPU) or renderer.
    let charW = 1;
    let charH = 1;
    if (this.renderer instanceof WebGPURenderer) {
      charW = this.renderer.getAtlas().getCharWidth()  || 1;
      charH = this.renderer.getAtlas().getCharHeight() || 1;
    } else {
      // Canvas2D renderer: approximate from current canvas/grid ratio.
      charW = Math.max(1, Math.round(this.canvas.width  / Math.max(1, this.width)));
      charH = Math.max(1, Math.round(this.canvas.height / Math.max(1, this.height)));
    }

    const cols = Math.max(1, Math.floor(exportWidth  / charW));
    const rows = Math.max(1, Math.floor(exportHeight / charH));
    const actualWidth  = cols * charW;
    const actualHeight = rows * charH;

    // Temporarily expand the canvas buffer to the export resolution.
    this.canvas.width  = actualWidth;
    this.canvas.height = actualHeight;
    this.resize(cols, rows);

    return { actualWidth, actualHeight, token };
  }

  /**
   * Restore canvas and grid to the pre-export dimensions.
   * @param token — the value returned by resizeForExport()
   */
  restoreExportResize(token: { cols: number; rows: number; canvasW: number; canvasH: number }): void {
    this.canvas.width  = token.canvasW;
    this.canvas.height = token.canvasH;
    this.resize(token.cols, token.rows);
  }

  /** Saved live AudioContext while an audio export pass is active. */
  private _savedAudioContext: AudioContext | null = null;

  /**
   * Swap the engine's AudioContext for an OfflineAudioContext proxy so that
   * audio calls made during tickExportFrame() schedule nodes into the offline
   * timeline instead of playing live.
   *
   * Pass ANY object that satisfies the AudioContext surface used by user code
   * (e.g. a Proxy wrapping an OfflineAudioContext whose currentTime is
   * overridden to return the synthetic elapsed time).
   */
  beginAudioExport(ctx: BaseAudioContext): void {
    this._savedAudioContext = this.audioContext;
    this.audioContext = ctx as AudioContext;
  }

  /**
   * Restore the live AudioContext after an audio export pass.
   */
  endAudioExport(): void {
    if (this._savedAudioContext) {
      this.audioContext = this._savedAudioContext;
      this._savedAudioContext = null;
    }
  }

  /**
   * Tick one engine frame with synthetic time for video export.
   * Must be called after pauseForExport(). Does NOT schedule a new rAF.
   * @param elapsed — total seconds from start of export
   * @param delta   — time step in seconds (1/fps)
   */
  tickExportFrame(elapsed: number, delta: number): void {
    this.elapsedTime = elapsed;
    this.deltaTime   = delta;
    this.runFrame();
    this.frameCount++;
  }

  /**
   * Render one export-preflight frame without advancing the export frame counter.
   * Useful when the host UI needs document code to latch export metadata first.
   */
  primeExportFrame(elapsed: number = 0): void {
    this.elapsedTime = elapsed;
    this.deltaTime = 0;
    this.runFrame();
  }

  /**
   * Push the terminal cell size (in render-texture pixels) into any active
   * post-process shader(s) that declare a `cellSize` uniform.
   *
   * This mirrors tstorie behavior where font metrics were provided to shaders
   * like `ruledlines` so effects can align to the text grid.
   */
  private syncTerminalCellSizeToShaders(): void {
    if (!this.shaderManager) return;
    if (!(this.renderer instanceof WebGPURenderer)) return;

    const terminal = this.renderer.getTerminalRenderer();
    // TerminalRenderer metrics are in the same pixel space as the render texture
    // and the compositor/shader pipeline resolution.
    const cellW = Math.max(1, terminal.getCellWidth());
    const cellH = Math.max(1, terminal.getCellHeight());

    if (
      this.lastShaderCellSize &&
      this.lastShaderCellSize.w === cellW &&
      this.lastShaderCellSize.h === cellH
    ) {
      return;
    }
    this.lastShaderCellSize = { w: cellW, h: cellH };

    const value: number[] = [cellW, cellH];

    // If a chain is active, update every shader in the chain.
    if (this.shaderChainManager && this.shaderChainManager.hasActiveChain()) {
      const chain = this.shaderChainManager.getActiveChain();
      for (const shaderName of chain) {
        // Only update shaders that actually declare `cellSize`.
        // Avoid spamming warnings for shaders that don't use grid alignment.
        if (this.shaderManager.hasUniform(shaderName, 'cellSize')) {
          this.shaderManager.setUniform(shaderName, 'cellSize', value);
        }
      }
      return;
    }

    // Otherwise update the currently active single shader, if any.
    const active = this.shaderManager.getActiveShaderName();
    if (active) {
      if (this.shaderManager.hasUniform(active, 'cellSize')) {
        this.shaderManager.setUniform(active, 'cellSize', value);
      }
    }
  }

  /**
   * Bake a live section texture by calling the user's on:render section:N
   * callback with routing overrides so that all ui.* draw calls land in the
   * section's offscreen GPU texture instead of the flat screen overlay.
   *
   * @returns true if baking succeeded and layout.texture was updated.
   */
  private bakeLiveSectionTexture(
    layout: Section3DLayout,
    device: GPUDevice,
    baseLineHeight: number
  ): boolean {
    if (!(this.renderer instanceof WebGPURenderer)) return false;

    const atlas = this.renderer.getAtlas();
    if (!atlas) return false;

    // Ensure the section-dedicated WebGPU UI renderer exists.
    if (!this.sectionWebGPUUIRenderer) {
      const webgpuPack = this.getWebGPUFeaturePack();
      if (!webgpuPack) {
        this.requestWebGPUFeaturePack();
        return false;
      }
      this.sectionWebGPUUIRenderer = new webgpuPack.WebGPUUIRenderer(device, atlas, 1, 1);
    }
    const sectionUI = this.sectionWebGPUUIRenderer;
    const baseMetricScale = this.getWorldsTextureScale();
    const liveMin = Number.isFinite(this.worldsConfig.liveTextureScale as number)
      ? Math.max(1, Math.min(4, this.worldsConfig.liveTextureScale as number))
      : 2;
    const textureScale = Math.max(liveMin, baseMetricScale);

    // Compute logical texture size — must match the same formula used in
    // premeasure3DCardWorldSize() so the card's world dimensions are stable
    // across the premeasure → bake → camera-fit pipeline.
    const texturePadding = 12;
    const charW = atlas.getCharWidth() / Math.max(1, baseMetricScale);
    const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
    let logicalWidthPx = units === 'px'
      ? Math.round(layout.width + texturePadding * 2)
      : Math.round(layout.width * charW + texturePadding * 2);
    let logicalHeightPx = units === 'px'
      ? Math.round(layout.height + texturePadding * 2)
      : Math.round(layout.height * baseLineHeight + texturePadding * 2);
    logicalWidthPx = Math.max(64, logicalWidthPx);
    logicalHeightPx = Math.max(64, logicalHeightPx);
    const widthPx = Math.max(1, Math.round(logicalWidthPx * textureScale));
    const heightPx = Math.max(1, Math.round(logicalHeightPx * textureScale));

    // Compute section-local mouse coordinates using the affine reprojection.
    // Pre-populate the cache so getWorldsSectionTextureToScreenAffine can sample it.
    this.sectionTextureCache.set(layout.sectionId, {
      width: widthPx,
      height: heightPx,
      logicalWidth: logicalWidthPx,
      logicalHeight: logicalHeightPx,
      textureScaleX: textureScale,
      textureScaleY: textureScale,
      activeLinkIndex: null,
    });
    let localMouseX = 0;
    let localMouseY = 0;
    const hoveredPick = this.pick3DAt(this.input.getMouseX(), this.input.getMouseY());
    if (hoveredPick?.layout?.sectionId === layout.sectionId) {
      localMouseX = hoveredPick.u * logicalWidthPx;
      localMouseY = hoveredPick.v * logicalHeightPx;
    } else {
      const xform = this.getWorldsSectionTextureToScreenAffine(layout);
      if (xform) {
        const mx = this.input.getMouseX();
        const my = this.input.getMouseY();
        localMouseX = (xform.localFromScreenTexPx.a * mx + xform.localFromScreenTexPx.c * my + xform.localFromScreenTexPx.e) / textureScale;
        localMouseY = (xform.localFromScreenTexPx.b * mx + xform.localFromScreenTexPx.d * my + xform.localFromScreenTexPx.f) / textureScale;
      }
    }

    // Create or reuse the section GPU texture.
    const format = sectionUI.getTextureFormat();
    const existingOk = layout.texture && (() => {
      const d = this.sectionTextureCache.get(layout.sectionId);
      return d && d.width === widthPx && d.height === heightPx;
    })();
    if (!existingOk) {
      if (layout.texture) { try { layout.texture.destroy(); } catch { /* ignore */ } layout.texture = null; }
      layout.texture = device.createTexture({
        size: { width: widthPx, height: heightPx, depthOrArrayLayers: 1 },
        format,
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    // Set live render context: ui.* and ui.metrics redirect here.
    this._liveRenderCtx = {
      sectionIndex: layout.sectionIndex,
      width: logicalWidthPx,
      height: logicalHeightPx,
      localMouseX,
      localMouseY,
      textureScale,
      baseMetricScale,
    };
    this._liveUIOverride = sectionUI;

    sectionUI.clearCommands();

    const doc = this.getActiveDocument();
    if (doc?.handlers?.render) {
      try {
        doc.handlers.render();
      } catch (e) {
        console.error('[Worlds] Error in live section render:', e);
      }
    }

    // Restore context before flushing.
    this._liveRenderCtx = null;
    this._liveUIOverride = null;

    sectionUI.flushTo(layout.texture!, widthPx, heightPx, { clear: { r: 0, g: 0, b: 0, a: 0 } });

    this.sectionTextureCache.set(layout.sectionId, {
      width: widthPx,
      height: heightPx,
      logicalWidth: logicalWidthPx,
      logicalHeight: logicalHeightPx,
      textureScaleX: textureScale,
      textureScaleY: textureScale,
      activeLinkIndex: null,
    });
    this.set3DLayoutWorldSizeFromPixels(layout, logicalWidthPx, logicalHeightPx, baseLineHeight);

    return true;
  }

  private ensure3DSectionTextures(device: GPUDevice): void {
    if (!this.worldsEnabled || !this.camera3D) return;

    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return;
    }

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const aspect = canvasW > 0 && canvasH > 0 ? canvasW / canvasH : 1;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    // Section sizing can be:
    // - text units (legacy): width/height are columns/rows
    // - pixels: width/height are content box pixels (padding is added)
    //
    const textureScale = this.getWorldsTextureScale();
    const logicalFontSizePx = Math.max(1, this.fontSize || 16);
    const fontStack =
      this.worldsCardFontStack ||
      this.fontFamily ||
      "'3270-regular', 'Consolas', 'Monaco', monospace";
    const texturePadding = 12;
    const measured = this.measureFontMetrics(fontStack, logicalFontSizePx);
    const measuredCharW = Math.max(1, measured.charW);
    const measuredCharH = Math.max(1, measured.charH);
    const baseLineHeight = Math.max(1, measured.baseLineHeight);

    let worldSizeChanged = false;

    const overflowCfg = (this.worldsConfig as any).sectionOverflow;
    const overflowMode: 'clip' | 'expand' | 'expand-y' | 'fit' | 'fit-y' =
      (overflowCfg === 'expand' || overflowCfg === 'expand-y' || overflowCfg === 'fit' || overflowCfg === 'fit-y')
        ? overflowCfg
        : 'clip';
    const layoutOverflow: 'clip' | 'expand' = overflowMode === 'clip' ? 'clip' : 'expand';

    // Measurement context for proportional font widths (independent of card size).
    const measureCtx = (() => {
      if (!this.worldsCardFontStack) return null;
      try {
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 16;
        const ctx = c.getContext('2d', { alpha: true } as any) as CanvasRenderingContext2D | null;
        if (!ctx) return null;
        ctx.textBaseline = 'top';
        ctx.textAlign = 'left';
        ctx.font = `${logicalFontSizePx}px ${fontStack}`;
        return ctx;
      } catch {
        return null;
      }
    })();

    const sectionGuiMode = this.getWorldsSectionGUIMode();
    const guiAPIAny: any = this.api?.gui;
    let guiBindings: Array<{ group: string | number; sections: number[] }> = [];
    if (Array.isArray(guiAPIAny?._sectionBindings)) {
      guiBindings = guiAPIAny._sectionBindings;
    }
    const bakedGuiSections = new Set<number>();
    if (sectionGuiMode === 'baked' && guiBindings.length > 0) {
      for (const binding of guiBindings) {
        for (const idx of binding.sections || []) {
          if (typeof idx === 'number' && Number.isFinite(idx)) bakedGuiSections.add(idx);
        }
      }
    }

    this.evictDistantSectionTextures();

    for (const layout of this.section3DLayouts) {
      const needsBakedGui = bakedGuiSections.size > 0 && bakedGuiSections.has(layout.sectionIndex);
      if (!layout.visible && !needsBakedGui) continue;

      // Live sections: bypass canvas2d path entirely; use bakeLiveSectionTexture.
      if (this._liveSections.has(layout.sectionIndex)) {
        if (layout.visible && this.is3DCardPossiblyVisible(viewProj, layout)) {
          const liveChanged = this.bakeLiveSectionTexture(layout, device, baseLineHeight);
          if (liveChanged) worldSizeChanged = true;
        }
        continue;
      }

      const activeLink = this.getActive3DLink();
      const activeLinkIndex = activeLink && activeLink.sectionIndex === layout.sectionIndex
        ? activeLink.linkIndex
        : null;

      if (!needsBakedGui) {
        if (!this.is3DCardPossiblyVisible(viewProj, layout)) {
          continue;
        }
      }

      // Re-rasterize when the active hovered/focused link changes for this card.
      if (layout.texture) {
        const existing = this.sectionTextureCache.get(layout.sectionId);
        if (existing && existing.activeLinkIndex === activeLinkIndex) {
          const prevW = layout.worldWidth;
          const prevH = layout.worldHeight;
          this.set3DLayoutWorldSizeFromPixels(layout, existing.width / textureScale, existing.height / textureScale, baseLineHeight);
          if (layout.worldWidth !== prevW || layout.worldHeight !== prevH) worldSizeChanged = true;
          continue;
        }
      }

      const minW = 256;
      const minH = 128;
      const deviceMax = (device.limits && (device.limits as any).maxTextureDimension2D)
        ? Number((device.limits as any).maxTextureDimension2D)
        : 2048;
      const maxTextureW = Math.max(256, Math.min(2048, deviceMax));
      const maxTextureH = Math.max(256, Math.min(2048, deviceMax));
      const maxW = Math.max(minW, Math.floor(maxTextureW / textureScale));
      const maxH = Math.max(minH, Math.floor(maxTextureH / textureScale));

      const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
      const desiredW = units === 'px'
        ? Math.round(layout.width + texturePadding * 2)
        : Math.round(layout.width * measuredCharW + texturePadding * 2);
      const desiredH = units === 'px'
        ? Math.round(layout.height + texturePadding * 2)
        : Math.round(layout.height * baseLineHeight + texturePadding * 2);
      let widthPx = Math.max(minW, Math.min(maxW, desiredW));
      let heightPx = Math.max(minH, Math.min(maxH, desiredH));

      const contentOverride = this.getWorldsSectionContentOverride(layout.sectionId);
      const nodes = uiDocumentPack.parseMarkdownLite(buildWorldsCardMarkdown(layout, contentOverride ?? undefined));

      // Overflow resize modes: do a cheap layout pass to compute required pixel
      // size from the actual rendered markdown content.
      //
      // - expand/expand-y: only grow
      // - fit/fit-y: shrink or grow
      if (overflowMode === 'expand' || overflowMode === 'expand-y' || overflowMode === 'fit' || overflowMode === 'fit-y') {
        const proceduralRuledPaper = this.isWorldsSectionBackgroundProceduralChainEnabled();
        const bakedRuledPaper = this.isWorldsSectionBackgroundBakedRuledLines();
        const shaderBg = !!this.parseWorldsSectionBackgroundShader();
        const textureBg = !!this.parseWorldsSectionBackgroundTexture();
        const surfaceBg = this.resolveWorldsSectionBackground();

        const mdBg = (proceduralRuledPaper || bakedRuledPaper || shaderBg || textureBg) ? this.withAlpha(surfaceBg, 0) : surfaceBg;
        const mdStyle = this.createWorldsMarkdownStyle({
          activeLinkIndex,
          background: mdBg,
          foreground: this.resolveEffectiveSectionForeground(layout.sectionId) ?? undefined,
          textAlign: layout.textAlign,
        });

        const measureTextWidth = this.worldsCardFontStack && measureCtx
          ? (text: string) => measureCtx.measureText(text).width
          : undefined;

        const probeWidthPx = overflowMode === 'fit' ? maxW : widthPx;
        const probe = uiDocumentPack.layoutMarkdownDocument(
          nodes,
          { x: 0, y: 0, width: probeWidthPx, height: heightPx },
          {
            charW: measuredCharW,
            charH: measuredCharH,
            measureTextWidth,
            getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
          },
          mdStyle,
          0,
          texturePadding,
          { overflow: 'expand' }
        );

        const reqW = Math.ceil(probe.contentWidth + texturePadding * 2);
        const reqH = Math.ceil(probe.contentHeight + texturePadding * 2);

        const clampedW = Math.max(minW, Math.min(maxW, reqW));
        const clampedH = Math.max(minH, Math.min(maxH, reqH));

        if (overflowMode === 'expand') {
          widthPx = Math.max(widthPx, clampedW);
          heightPx = Math.max(heightPx, clampedH);
        } else if (overflowMode === 'expand-y') {
          heightPx = Math.max(heightPx, clampedH);
        } else if (overflowMode === 'fit') {
          widthPx = clampedW;
          heightPx = clampedH;
        } else if (overflowMode === 'fit-y') {
          heightPx = clampedH;
        }
      }

      // Update world sizing immediately so auto-layout spacing can be computed
      // from the real (clamped) pixel card size.
      {
        const prevW = layout.worldWidth;
        const prevH = layout.worldHeight;
        this.set3DLayoutWorldSizeFromPixels(layout, widthPx, heightPx, baseLineHeight);
        if (layout.worldWidth !== prevW || layout.worldHeight !== prevH) worldSizeChanged = true;
      }

      const textureWidthPx = Math.max(1, Math.round(widthPx * textureScale));
      const textureHeightPx = Math.max(1, Math.round(heightPx * textureScale));

      let canvas: OffscreenCanvas | HTMLCanvasElement;
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(textureWidthPx, textureHeightPx);
        } else {
          const c = document.createElement('canvas');
          c.width = textureWidthPx;
          c.height = textureHeightPx;
          canvas = c;
        }
      } catch {
        // Some environments throw on OffscreenCanvas construction.
        const c = document.createElement('canvas');
        c.width = textureWidthPx;
        c.height = textureHeightPx;
        canvas = c;
      }

      const isOffscreenCanvas = (typeof OffscreenCanvas !== 'undefined') && (canvas instanceof OffscreenCanvas);
      const ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null =
        isOffscreenCanvas
          ? (canvas.getContext('2d', { alpha: true } as any) as OffscreenCanvasRenderingContext2D | null)
          : ((canvas as HTMLCanvasElement).getContext('2d', { alpha: true } as any) as CanvasRenderingContext2D | null);
      if (!ctx) {
        continue;
      }

      // Use the same markdown-lite layout engine as the WebGPU-UI path so:
      // - explicit newlines are preserved
      // - link regions exist for picking/navigation
      //
      // IMPORTANT: In Canvas2D sectionTextureMode we must lay out using the same
      // font metrics that Canvas2D will use to draw, otherwise the monospace-based
      // layout (charW/charH) won’t match the actual rendered glyph widths.
      // That mismatch shows up as “extra spaces” between words.

      ctx.setTransform(textureScale, 0, 0, textureScale, 0, 0);
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.font = `${logicalFontSizePx}px ${fontStack}`;

      // Use the same metrics we used to size the texture.
      const charW = measuredCharW;
      const charH = measuredCharH;

      const proceduralRuledPaper = this.isWorldsSectionBackgroundProceduralChainEnabled();
      const bakedRuledPaper = this.isWorldsSectionBackgroundBakedRuledLines();
      const shaderBg = !!this.parseWorldsSectionBackgroundShader();
      const textureBg = !!this.parseWorldsSectionBackgroundTexture();
      const surfaceBg = this.resolveWorldsSectionBackground();
      const borderStyle = this.getStyle('border');

      // If the 3D shader (procedural) or this path (baked) will draw paper,
      // keep the section texture background transparent so paper shows through.
      const mdBg = (proceduralRuledPaper || bakedRuledPaper || shaderBg || textureBg) ? this.withAlpha(surfaceBg, 0) : surfaceBg;

      const mdStyle = this.createWorldsMarkdownStyle({
        activeLinkIndex,
        background: mdBg,
        foreground: this.resolveEffectiveSectionForeground(layout.sectionId) ?? undefined,
        textAlign: layout.textAlign,
      });
      const result = uiDocumentPack.layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: widthPx, height: heightPx },
        {
          charW,
          charH,
          // If a proportional font is being used for Worlds cards, advance and
          // wrap using actual pixel widths to avoid visible spacing artifacts.
          measureTextWidth: this.worldsCardFontStack ? (text: string) => ctx.measureText(text).width : undefined,
          getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
        },
        mdStyle,
        0,
        texturePadding,
        this.getWorldsWidgetLayoutOptions(layout.sectionIndex, layoutOverflow)
      );

      // Optional: center the *content block* within the card.
      // This keeps the background/border fixed while shifting text/inline rects.
      this.applyWorldsContentAlignment(result, widthPx, heightPx, texturePadding, layout.contentAlign);

      const scaledLinkRegions = this.scaleLinkRegions(result.linkRegions, textureScale);
      const scaledWidgetPlacements = this.scaleWidgetPlacements(result.widgetPlacements, textureScale);

      // Keep texture dimensions for section-bound GUI mapping + picking.
      this.sectionTextureCache.set(layout.sectionId, {
        width: textureWidthPx,
        height: textureHeightPx,
        logicalWidth: widthPx,
        logicalHeight: heightPx,
        textureScaleX: textureScale,
        textureScaleY: textureScale,
        activeLinkIndex,
      });

      // Draw ops into the Canvas2D surface
      ctx.clearRect(0, 0, widthPx, heightPx);
      if (bakedRuledPaper) {
        // Use a subtle line color derived from the theme.
        const ruledLine = this.withAlpha(mdStyle.mutedFg, 0x40);
        this.drawRuledLines2D(ctx, widthPx, heightPx, surfaceBg, ruledLine, baseLineHeight, texturePadding);
      }
      for (const op of result.ops) {
        if (op.kind === 'rect') {
          ctx.fillStyle = ColorUtils.toCss(op.color as any);
          ctx.fillRect(op.x, op.y, op.w, op.h);
        } else if (op.kind === 'image') {
          const image = this.getMarkdownImageSource(op.source, this.activeDocumentId ?? undefined);
          if (image) {
            ctx.drawImage(image, op.x, op.y, op.w, op.h);
          }
        } else {
          ctx.fillStyle = ColorUtils.toCss(op.color as any);
          ctx.fillText(op.text, op.x, op.y);
        }
      }

      // Render section-bound retained GUI into the section texture, so it transforms with the card.
      // This path is only used when sectionGuiMode is 'baked' and GUI section bindings exist.
      {
        const sectionGuiMode = this.getWorldsSectionGUIMode();
        if (sectionGuiMode !== 'baked') {
          // Skip: overlay mode renders section-bound GUI via the UI layer.
        } else {
        const guiAPI: any = this.api?.gui;
        const system = guiAPI?.getSystem?.();
        let bindings: Array<{ group: string | number; sections: number[] }> = [];
        if (Array.isArray(guiAPI?._sectionBindings)) {
          bindings = guiAPI._sectionBindings;
        }
        if (system && bindings.length > 0) {
          // IMPORTANT: GUI section bindings default to showing groups only for the
          // *currently active* section. When baking, we want the groups that are
          // bound to this layout.sectionIndex to be visible even if the user has
          // panned/zoomed away or another section is "current".
          //
          // Force bindings to treat this section as active while we render into
          // its texture, then restore normal binding state.
          let restoreBindings: (() => void) | null = null;
          if (typeof guiAPI.syncSectionBindings === 'function') {
            try {
              guiAPI.syncSectionBindings(layout.sectionIndex);
              restoreBindings = () => {
                try { guiAPI.syncSectionBindings(); } catch { /* ignore */ }
              };
            } catch {
              // ignore
            }
          }

          const boundGroups = bindings
            .filter((b) => Array.isArray(b.sections) && b.sections.includes(layout.sectionIndex))
            .map((b) => b.group);

          if (boundGroups.length > 0) {
            const draw2d = this.createCanvas2DDraw2D(ctx as any);
            const metrics = this.getGUIPixelMetrics();
            (draw2d as any).metrics = { charWidth: metrics.charWidth, charHeight: metrics.charHeight };
            for (const group of boundGroups) {
              system.renderGroup(group, draw2d as any, metrics.charWidth, metrics.charHeight);
            }
          }

          if (restoreBindings) restoreBindings();
        }
        }
      }

      // Border on top (matches previous Canvas2D look)
      this.drawWorldsCardBorder(ctx, widthPx, heightPx, borderStyle.fg, layout.sectionBorder);

      // Create GPU texture + upload
      const texture = device.createTexture({
        size: { width: textureWidthPx, height: textureHeightPx },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
      });

      let uploaded = false;
      try {
        device.queue.copyExternalImageToTexture(
          { source: canvas as any },
          { texture },
          { width: textureWidthPx, height: textureHeightPx }
        );
        uploaded = true;
      } catch {
        // Fallback path for implementations that don't accept OffscreenCanvas/Canvas directly.
        try {
          if (isOffscreenCanvas && typeof (canvas as any).transferToImageBitmap === 'function') {
            const bitmap: ImageBitmap = (canvas as any).transferToImageBitmap();
            device.queue.copyExternalImageToTexture(
              { source: bitmap },
              { texture },
              { width: textureWidthPx, height: textureHeightPx }
            );
            bitmap.close();
            uploaded = true;
          }
        } catch (error) {
          console.warn('[Worlds] Failed to upload section texture; skipping this card:', error);
          try { texture.destroy(); } catch { /* ignore */ }
          continue;
        }
      }

      // Final fallback: upload raw pixels via writeTexture (slower, but widely supported).
      if (!uploaded) {
        try {
          const imageData = (ctx as any).getImageData?.(0, 0, textureWidthPx, textureHeightPx);
          if (imageData && imageData.data) {
            const unpaddedBytesPerRow = textureWidthPx * 4;
            const bytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;
            const padded = new Uint8Array(bytesPerRow * textureHeightPx);

            // Copy row-by-row into padded buffer.
            for (let y = 0; y < textureHeightPx; y++) {
              const srcStart = y * unpaddedBytesPerRow;
              const dstStart = y * bytesPerRow;
              padded.set(imageData.data.subarray(srcStart, srcStart + unpaddedBytesPerRow), dstStart);
            }

            device.queue.writeTexture(
              { texture },
              padded,
              { bytesPerRow },
              { width: textureWidthPx, height: textureHeightPx }
            );
            uploaded = true;
          }
        } catch (error) {
          console.warn('[Worlds] writeTexture fallback failed; skipping this card:', error);
        }
      }

      if (!uploaded) {
        try { texture.destroy(); } catch { /* ignore */ }
        continue;
      }

      layout.texture = texture;
      this.sectionTextureCache.set(layout.sectionId, {
        width: textureWidthPx,
        height: textureHeightPx,
        logicalWidth: widthPx,
        logicalHeight: heightPx,
        textureScaleX: textureScale,
        textureScaleY: textureScale,
        activeLinkIndex,
      });
      this.sectionLinkRegionsCache.set(layout.sectionId, scaledLinkRegions);
      this.sectionWidgetPlacementsCache.set(layout.sectionId, scaledWidgetPlacements);

      this.set3DLayoutWorldSizeFromPixels(layout, widthPx, heightPx, baseLineHeight);
    }

    if (worldSizeChanged) {
      this.reflowWorldsAutoLayout();
    }
  }

  private clear3DSectionTextures(): void {
    for (const layout of this.section3DLayouts) {
      if (layout.texture) {
        try {
          layout.texture.destroy();
        } catch {
          // ignore
        }
        layout.texture = null;
      }
      layout.highlightUvRect = undefined;
      layout.worldWidth = undefined;
      layout.worldHeight = undefined;
    }
    this.sectionTextureCache.clear();
    this.sectionLinkRegionsCache.clear();
    this.sectionWidgetPlacementsCache.clear();
    this.clearWorldsInlineWidgets();
    this.hovered3DLink = null;
    this.focused3DLink = null;
    this.worldsAutoLayoutCache = null;
  }

  invalidate3DSectionTexture(sectionIndex: number): void {
    const layout = this.getSectionLayoutByIndex(sectionIndex);
    if (!layout) return;

    if (layout.texture) {
      try {
        layout.texture.destroy();
      } catch {
        // ignore
      }
      layout.texture = null;
    }

    layout.highlightUvRect = undefined;
    this.sectionTextureCache.delete(layout.sectionId);
    this.sectionLinkRegionsCache.delete(layout.sectionId);
    this.sectionWidgetPlacementsCache.delete(layout.sectionId);
    // Note: worldsAutoLayoutCache is intentionally NOT cleared here. The cache
    // is only invalid when card world sizes change, which is determined when the
    // new texture is rasterized. Clearing eagerly causes spurious reflows and
    // camera re-centers on texture invalidations like setSectionSize.
  }

  /**
   * Evict GPU textures for sections that are too far from the current section
   * in navigation order, when `sectionTextureCacheRadius` is configured.
   *
   * Uses the same navigable-candidate list as `navigateWorldsSection` so the
   * radius counts logical slides, not raw section indices.  Evicted sections
   * are re-rasterized lazily on the next frame they become visible.
   */
  private evictDistantSectionTextures(): void {
    const radius = (this.worldsConfig as any).sectionTextureCacheRadius;
    if (!(typeof radius === 'number' && Number.isFinite(radius) && radius >= 0)) return;
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;

    const currentIdx = this.getResolvedCurrent3DSectionIndex();
    if (currentIdx === null || !Number.isFinite(currentIdx)) return;

    // Same candidate list as navigateWorldsSection: navigable, not removed,
    // visible or hiddenUntilVisited (they may become visible soon).
    const candidates = this.section3DLayouts.filter(
      (l) => l && l.navigable
        && !this.worldsRemovedSectionIds.has(l.sectionId)
        && (l.visible !== false || l.hiddenUntilVisited === true)
    );
    if (candidates.length === 0) return;

    const currentPos = candidates.findIndex((l) => l.sectionIndex === currentIdx);
    if (currentPos < 0) return;

    for (let i = 0; i < candidates.length; i++) {
      if (Math.abs(i - currentPos) <= radius) continue;
      const layout = candidates[i]!;
      if (!layout.texture) continue;
      try { layout.texture.destroy(); } catch { /* ignore */ }
      layout.texture = null;
      this.sectionTextureCache.delete(layout.sectionId);
      this.sectionLinkRegionsCache.delete(layout.sectionId);
      this.sectionWidgetPlacementsCache.delete(layout.sectionId);
    }
  }


  private getWorldsWidgetLayoutOptions(sectionIndex: number, overflow: 'clip' | 'expand'): LayoutOptions {
    const currentSectionIndex = this.getResolvedCurrent3DSectionIndex();
    return {
      overflow,
      widgetPlaceholderMode: currentSectionIndex === sectionIndex ? 'none' : 'full',
    };
  }

  private set3DLayoutWorldSizeFromPixels(
    layout: Section3DLayout,
    widthPx: number,
    heightPx: number,
    pixelsPerWorldUnit: number
  ): void {
    const ppu = Number.isFinite(pixelsPerWorldUnit) && pixelsPerWorldUnit > 0 ? pixelsPerWorldUnit : 1;
    const w = Number.isFinite(widthPx) && widthPx > 0 ? (widthPx / ppu) : null;
    const h = Number.isFinite(heightPx) && heightPx > 0 ? (heightPx / ppu) : null;
    if (w && h && Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      layout.worldWidth = w;
      layout.worldHeight = h;
    }
  }

  private getWorldsPixelsPerWorldUnit(): number {
    const logicalFontSizePx = Math.max(1, this.fontSize || 16);
    const fontStack =
      this.worldsCardFontStack ||
      this.fontFamily ||
      "'3270-regular', 'Consolas', 'Monaco', monospace";
    const measured = this.measureFontMetrics(fontStack, logicalFontSizePx);
    return Math.max(1, measured.baseLineHeight);
  }

  private reflowWorldsAutoLayout(): void {
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;
    if (this.worldsOverviewEnabled) return;

    const autoEnabled = this.worldsConfig.autoLayoutEnabled !== false;
    if (!autoEnabled) return;

    const cols = Math.max(1, Math.floor(this.worldsConfig.autoLayoutColumns ?? 3));

    // Legacy meaning: autoLayoutSpacing is a fixed step size.
    // New behavior: never let the step be smaller than the largest card.
    const baseStep = Number.isFinite(this.worldsConfig.autoLayoutSpacing ?? NaN)
      ? (this.worldsConfig.autoLayoutSpacing as number)
      : 200;
    const padding = 20;

    // Compute required step sizes from card world dimensions.
    let maxW = 0;
    let maxH = 0;
    for (const l of this.section3DLayouts) {
      if (!l || !l.autoPositioned) continue;
      const s = this.get3DCardWorldSize(l);
      maxW = Math.max(maxW, s.width);
      maxH = Math.max(maxH, s.height);
    }
    if (!(maxW > 0) || !(maxH > 0)) return;

    const stepX = Math.max(baseStep, maxW + padding);
    const stepY = Math.max(baseStep, maxH + padding);

    if (
      this.worldsAutoLayoutCache &&
      this.worldsAutoLayoutCache.cols === cols &&
      Math.abs(this.worldsAutoLayoutCache.stepX - stepX) < 1e-6 &&
      Math.abs(this.worldsAutoLayoutCache.stepY - stepY) < 1e-6
    ) {
      return;
    }
    this.worldsAutoLayoutCache = { cols, stepX, stepY };

    const xCenter = (cols - 1) / 2;

    let anyMoved = false;
    for (const l of this.section3DLayouts) {
      if (!l || !l.autoPositioned) continue;
      const col = l.sectionIndex % cols;
      const row = Math.floor(l.sectionIndex / cols);
      const x = (col - xCenter) * stepX;
      const y = -row * stepY;
      const prevX = l.transform.position.x;
      const prevY = l.transform.position.y;
      l.transform.position = { x, y, z: l.transform.position.z };
      if (Math.abs(x - prevX) > 1e-4 || Math.abs(y - prevY) > 1e-4) anyMoved = true;
    }

    // Only re-apply the camera focus if positions actually changed (i.e. at
    // least one auto-positioned section was moved). Skipping when nothing moved
    // prevents spurious re-centers after texture invalidations like setSectionSize.
    if (anyMoved) {
      this.refocus3DForCurrentViewport();
    }
  }

  private get3DCardWorldSize(layout: Section3DLayout): { width: number; height: number } {
    // If we have pixel-derived world dimensions (from texture generation or
    // pre-measure), prefer them.
    let baseW = layout.worldWidth;
    let baseH = layout.worldHeight;

    // Fallback sizing depends on sectionSizeUnits.
    if (!(baseW && baseH)) {
      const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
      if (units === 'px') {
        // Convert declared pixel dimensions into approximate world units.
        // Keep this consistent with set3DLayoutWorldSizeFromPixels(), which
        // uses a pixels-per-world-unit scale derived from baseLineHeight.
        const texturePadding = 12;
        const fontStack =
          this.worldsCardFontStack ||
          this.fontFamily ||
          "'3270-regular', 'Consolas', 'Monaco', monospace";
        const measured = this.measureFontMetrics(fontStack, Math.max(1, this.fontSize || 16));
        const ppu = Math.max(1, measured.baseLineHeight);

        baseW = (layout.width + texturePadding * 2) / ppu;
        baseH = (layout.height + texturePadding * 2) / ppu;
      } else {
        baseW = layout.width * this.get3DCardXScaleFactor(layout);
        baseH = layout.height;
      }
    }

    const safeW = Number.isFinite(baseW as any) && (baseW as number) > 0 ? (baseW as number) : 1;
    const safeH = Number.isFinite(baseH as any) && (baseH as number) > 0 ? (baseH as number) : 1;
    return {
      width: safeW * (layout.transform.scale?.x ?? 1),
      height: safeH * (layout.transform.scale?.y ?? 1),
    };
  }

  private parseHexColorToPackedColor(hex: string): Color | null {
    const s = hex.trim();
    if (!s.startsWith('#')) return null;
    const h = s.slice(1);
    if (!(h.length === 6 || h.length === 8)) return null;

    const r = Number.parseInt(h.slice(0, 2), 16);
    const g = Number.parseInt(h.slice(2, 4), 16);
    const b = Number.parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? Number.parseInt(h.slice(6, 8), 16) : 0xFF;
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return ((r & 0xFF) << 24) | ((g & 0xFF) << 16) | ((b & 0xFF) << 8) | (a & 0xFF);
  }

  private withAlpha(color: Color, alphaByte: number): Color {
    const a = Math.max(0, Math.min(255, Math.round(alphaByte)));
    return ((color as any) & 0xFFFFFF00) | (a & 0xFF);
  }

  private parseWorldsSectionBackgroundChain(): string[] {
    const v: any = (this.worldsConfig as any).sectionBackground;
    if (typeof v !== 'string') return [];
    const trimmed = v.trim();
    if (!trimmed) return [];

    const separators = ['+', ';', ',', '|'];
    for (const sep of separators) {
      if (trimmed.includes(sep)) {
        return trimmed
          .split(sep)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    return [trimmed.toLowerCase()];
  }

  private parseWorldsSectionBackgroundShader(): {
    name: string;
    uniforms: Record<string, number | number[]>;
    paperPlaneZ?: number;
    paperPlaneZMode?: 'focus';
  } | null {
    const v: any = (this.worldsConfig as any).sectionBackground;
    if (typeof v !== 'string') return null;
    
    // Check if it's a shader reference (starts with shader:)
    if (v.startsWith('shader:')) {
      const shaderSpec = v.substring(7).trim();
      const [name, ...uniformSpecs] = shaderSpec.split(';');
      
      const uniforms: Record<string, number | number[]> = {};
      let paperPlaneZ: number | undefined;
      let paperPlaneZMode: 'focus' | undefined;
      for (const spec of uniformSpecs) {
        const [key, value] = spec.split('=');
        if (key && value) {
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();

          if (trimmedKey === 'paperPlaneZ') {
            const lower = trimmedValue.toLowerCase();
            if (lower === 'focus' || lower === 'focused') {
              paperPlaneZMode = 'focus';
              continue;
            }

            const num = parseFloat(trimmedValue);
            if (!isNaN(num) && Number.isFinite(num)) {
              paperPlaneZ = num;
              continue;
            }
          }
          
          // Try to parse as number or array
          if (trimmedValue.includes(',')) {
            uniforms[trimmedKey] = trimmedValue.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
          } else {
            const num = parseFloat(trimmedValue);
            if (!isNaN(num)) {
              uniforms[trimmedKey] = num;
            }
          }
        }
      }
      
      return { name: name.trim(), uniforms, paperPlaneZ, paperPlaneZMode };
    }
    
    return null;
  }

  private parseWorldsSectionBackgroundTexture(): {
    url: string;
    coordScale?: number;
    tilePx?: number;
    contentDistort?: number;
    blendStrength?: number;
    paperPlaneZ?: number;
    paperPlaneZMode?: 'focus';
    screenLock?: boolean;
    overlayUrl?: string;
    overlayBlendMode?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge';
    overlayOpacity?: number;
    overlayFit?: 'cover' | 'contain' | 'stretch';
    blendMode?: 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge';
  } | null {
    const v: any = (this.worldsConfig as any).sectionBackground;
    if (typeof v !== 'string' || !v.startsWith('texture:')) return null;

    const textureSpec = v.substring(8).trim();
    const [url, ...paramSpecs] = textureSpec.split(';');
    const textureUrl = String(url ?? '').trim();
    if (!textureUrl) return null;

    let coordScale: number | undefined;
    let tilePx: number | undefined;
    let contentDistort: number | undefined;
    let blendStrength: number | undefined;
    let paperPlaneZ: number | undefined;
    let paperPlaneZMode: 'focus' | undefined;
    let screenLock: boolean | undefined;
    let overlayUrl: string | undefined;
    let overlayBlendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge' | undefined;
    let overlayOpacity: number | undefined;
    let overlayFit: 'cover' | 'contain' | 'stretch' | undefined;
    let blendMode: 'multiply' | 'screen' | 'overlay' | 'softlight' | 'hardlight' | 'darken' | 'lighten' | 'difference' | 'exclusion' | 'colorburn' | 'colordodge' | undefined;

    for (const spec of paramSpecs) {
      const [key, value] = spec.split('=');
      if (!key || value === undefined) continue;

      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (!trimmedKey) continue;

      if (trimmedKey === 'paperPlaneZ') {
        const lower = trimmedValue.toLowerCase();
        if (lower === 'focus' || lower === 'focused') {
          paperPlaneZMode = 'focus';
          continue;
        }

        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num)) {
          paperPlaneZ = num;
        }
        continue;
      }

      if (trimmedKey === 'coordScale' || trimmedKey === 'scale') {
        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num) && num > 0) {
          coordScale = num;
        }
        continue;
      }

      if (trimmedKey === 'tilePx' || trimmedKey === 'tile') {
        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num) && num > 0) {
          tilePx = num;
        }
        continue;
      }

      if (trimmedKey === 'contentDistort' || trimmedKey === 'distort' || trimmedKey === 'contentWarp') {
        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num)) {
          // Treat as a subtle UV strength; clamp to sane range.
          // (Note: the shader interprets this in pixel-relative UV units.)
          contentDistort = Math.max(0, Math.min(0.05, num));
        }
        continue;
      }

      if (trimmedKey === 'screenLock') {
        const lower = trimmedValue.toLowerCase();
        if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'on') {
          screenLock = true;
        } else if (lower === '0' || lower === 'false' || lower === 'no' || lower === 'off') {
          screenLock = false;
        }
        continue;
      }

      if (trimmedKey === 'blendMode') {
        const lower = trimmedValue.toLowerCase().replace(/[-_\s]/g, '');
        const validModes = ['multiply','screen','overlay','softlight','hardlight',
                            'darken','lighten','difference','exclusion','colorburn','colordodge'];
        if (validModes.includes(lower)) {
          blendMode = lower as typeof blendMode;
        }
        continue;
      }

      if (trimmedKey === 'overlay' || trimmedKey === 'overlayUrl' || trimmedKey === 'overlaySrc') {
        if (trimmedValue) overlayUrl = trimmedValue;
        continue;
      }

      if (trimmedKey === 'overlayOpacity') {
        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num)) {
          overlayOpacity = Math.max(0, Math.min(1, num));
        }
        continue;
      }

      if (trimmedKey === 'overlayBlend' || trimmedKey === 'overlayBlendMode') {
        const lower = trimmedValue.toLowerCase().replace(/[-_\s]/g, '');
        const validModes = ['normal','multiply','screen','overlay','softlight','hardlight',
                            'darken','lighten','difference','exclusion','colorburn','colordodge'];
        if (validModes.includes(lower)) {
          overlayBlendMode = lower as typeof overlayBlendMode;
        }
        continue;
      }

      if (trimmedKey === 'overlayFit') {
        const lower = trimmedValue.toLowerCase();
        if (lower === 'contain') overlayFit = 'contain';
        else if (lower === 'stretch' || lower === 'fill') overlayFit = 'stretch';
        else overlayFit = 'cover';
        continue;
      }

      if (trimmedKey === 'blendStrength' || trimmedKey === 'blendAmount' || trimmedKey === 'paperBlend') {
        const num = parseFloat(trimmedValue);
        if (!isNaN(num) && Number.isFinite(num)) {
          blendStrength = Math.max(0, Math.min(1, num));
        }
        continue;
      }
    }

    return {
      url: textureUrl,
      coordScale,
      tilePx,
      contentDistort,
      blendStrength,
      paperPlaneZ,
      paperPlaneZMode,
      screenLock,
      overlayUrl,
      overlayBlendMode,
      overlayOpacity,
      overlayFit,
      blendMode,
    };
  }

  private isWorldsSectionBackgroundProceduralChainEnabled(): boolean {
    const chain = this.parseWorldsSectionBackgroundChain();

    const hasRuledLines = chain.includes('ruledlines') || chain.includes('ruled-lines') || chain.includes('ruled_lines');
    const hasPaper = chain.includes('paper');
    return hasRuledLines || hasPaper;
  }

  private isWorldsSectionBackgroundBakedRuledLines(): boolean {
    const v: any = (this.worldsConfig as any).sectionBackground;
    if (typeof v !== 'string') return false;
    const key = v.trim().toLowerCase();
    return key === 'ruledlines-baked' || key === 'ruledlines_baked' || key === 'ruledlinesbaked';
  }

  private drawRuledLines2D(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    widthPx: number,
    heightPx: number,
    paperColor: Color,
    lineColor: Color,
    lineSpacingPx: number,
    texturePadding: number
  ): void {
    ctx.fillStyle = ColorUtils.toCss(paperColor as any);
    ctx.fillRect(0, 0, widthPx, heightPx);

    const spacing = Math.max(6, Math.round(lineSpacingPx));
    const thickness = 1;
    // Place lines roughly under the text baseline for a “paper” look.
    const startY = Math.max(0, Math.round(texturePadding + spacing - 3));

    ctx.fillStyle = ColorUtils.toCss(lineColor as any);
    for (let y = startY; y < heightPx; y += spacing) {
      ctx.fillRect(0, y, widthPx, thickness);
    }
  }

  private resolveWorldsSectionBackground(): Color {
    const v: any = (this.worldsConfig as any).sectionBackground;

    // Default: match the theme's elevated surface color (existing behavior).
    if (v === undefined || v === null || v === 'surface') {
      return this.getStyle('surface').bg;
    }

    if (typeof v === 'number') {
      return v as Color;
    }

    if (typeof v === 'string') {
      const trimmed = v.trim();
      if (!trimmed) {
        return this.getStyle('surface').bg;
      }

      const hex = this.parseHexColorToPackedColor(trimmed);
      if (hex !== null) {
        return hex;
      }

      const key = trimmed.toLowerCase();
      switch (key) {
        case 'ruledlines':
        case 'ruled-lines':
        case 'ruled_lines':
          return this.getStyle('surface').bg;
        case 'ruledlines-baked':
        case 'ruledlines_baked':
        case 'ruledlinesbaked':
          return this.getStyle('surface').bg;
        case 'bg':
        case 'background':
          return this.currentTheme.bg;
        case 'bgalt':
        case 'bg_alt':
        case 'bgsecondary':
        case 'bg_secondary':
          return this.currentTheme.bgAlt;
        case 'fg':
        case 'foreground':
          return this.currentTheme.fg;
        case 'fgalt':
        case 'fg_alt':
        case 'fgsecondary':
        case 'fg_secondary':
          return this.currentTheme.fgAlt;
        case 'accent1':
        case 'primary':
          return this.currentTheme.accent1;
        case 'accent2':
        case 'secondary':
          return this.currentTheme.accent2;
        case 'accent3':
        case 'tertiary':
          return this.currentTheme.accent3;
        default:
          return this.getStyle('surface').bg;
      }
    }

    // Legacy object format ({r,g,b,a?})
    return ColorUtils.from(v);
  }

  private resolveWorldsSectionForeground(): Color | null {
    const v: any = (this.worldsConfig as any).sectionForeground;
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return v as Color;
    if (typeof v === 'string') return this.resolveThemeColorString(v);
    return ColorUtils.from(v);
  }

  /** Per-section override takes priority; falls back to global sectionForeground. */
  private resolveEffectiveSectionForeground(sectionId: string): Color | null {
    const perSection = this.getWorldsSectionStyleOverride(sectionId);
    if (perSection?.fg !== undefined) return perSection.fg;
    return this.resolveWorldsSectionForeground();
  }

  private createWorldsMarkdownStyle(options?: {
    activeLinkIndex?: number | null;
    background?: Color;
    foreground?: Color;
    textAlign?: 'left' | 'center' | 'right';
  }): MarkdownStyle {
    const base = this.getStyle('default');
    const dim = this.getStyle('dim');
    const border = this.getStyle('border');
    const surface = this.getStyle('surface');
    const heading = this.getStyle('heading');
    const link = this.getStyle('link');
    const active = this.getStyle('active');
    const info = this.getStyle('info');
    const success = this.getStyle('success');
    const warning = this.getStyle('warning');
    const error = this.getStyle('error');
    const code = this.getStyle('code');

    const fgOverride = options?.foreground ?? null;

    return {
      fg: fgOverride ?? base.fg,
      mutedFg: dim.fg,
      borderFg: border.fg,
      surfaceBg: surface.bg,
      headingFg: heading.fg,
      italicFg: this.currentTheme.accent3,
      textAlign: options?.textAlign ?? 'left',
      listMarker: this.getWorldsListMarker(),
      listMarkerGapPx: this.getWorldsListMarkerGapPx(),
      listHangIndentPx: this.getWorldsListHangIndentPx(),
      linkFg: link.fg,
      activeLinkFg: active.fg,
      activeLinkIndex: options?.activeLinkIndex ?? null,
      linkUnderline: this.worldsConfig.sectionLinkUnderline === true,
      infoFg: info.fg,
      successFg: success.fg,
      warningFg: warning.fg,
      errorFg: error.fg,
      codeFg: code.fg,
      codeBg: code.bg,
      bg: options?.background ?? surface.bg,
    };
  }

  private applyWorldsContentAlignment(
    result: { ops: DrawOp[]; linkRegions: LinkRegion[]; widgetPlacements: WidgetPlacement[]; contentOffsetX: number; contentOffsetY: number; contentWidth: number; contentHeight: number },
    widthPx: number,
    heightPx: number,
    texturePadding: number,
    contentAlign: 'start' | 'center'
  ): void {
    if (contentAlign !== 'center') return;

    const innerW = Math.max(1, widthPx - texturePadding * 2);
    const innerH = Math.max(1, heightPx - texturePadding * 2);
    const xInset = Math.max(0, result.contentOffsetX - texturePadding);
    const contentWidth = Math.max(0, result.contentWidth - xInset);
    const contentHeight = result.contentHeight;
    const currentLeft = result.contentOffsetX;
    const currentTop = result.contentOffsetY;
    const targetLeft = texturePadding + Math.max(0, Math.round((innerW - contentWidth) / 2));
    const targetTop = texturePadding + Math.max(0, Math.round((innerH - contentHeight) / 2));
    const dx = Math.round(targetLeft - currentLeft);
    const dy = Math.round(targetTop - currentTop);
    if (dx === 0 && dy === 0) return;

    let isFirstRect = true;
    for (const op of result.ops) {
      if (op.kind === 'rect' && isFirstRect) {
        isFirstRect = false;
        continue;
      }
      (op as DrawOp & { x: number; y: number }).x += dx;
      (op as DrawOp & { x: number; y: number }).y += dy;
    }
    for (const region of result.linkRegions) {
      region.x += dx;
      region.y += dy;
    }
    this.translateWidgetPlacements(result.widgetPlacements, dx, dy);
  }

  private ensure3DSectionTexturesWebGPUUI(device: GPUDevice): void {
    if (!(this.renderer instanceof WebGPURenderer)) return;
    if (!this.worldsEnabled || !this.camera3D) return;

    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return;
    }

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    const aspect = canvasW > 0 && canvasH > 0 ? canvasW / canvasH : 1;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    const atlas = this.renderer.getAtlas();
    const textureScale = this.getWorldsTextureScale();
    const charW = atlas ? (atlas.getCharWidth() / textureScale) : 10;
    const charH = atlas ? (atlas.getCharHeight() / textureScale) : 16;
    const texturePadding = 12;
    const baseLineHeight = Math.max(1, Math.round(charH * 1.25));

    let worldSizeChanged = false;
    const overflowCfg = (this.worldsConfig as any).sectionOverflow;
    const overflowMode: 'clip' | 'expand' | 'expand-y' | 'fit' | 'fit-y' =
      (overflowCfg === 'expand' || overflowCfg === 'expand-y' || overflowCfg === 'fit' || overflowCfg === 'fit-y')
        ? overflowCfg
        : 'clip';
    const layoutOverflow: 'clip' | 'expand' = overflowMode === 'clip' ? 'clip' : 'expand';

    if (!this.sectionWebGPUUIRenderer) {
      // Internal texture is unused for this renderer; we only use flushTo().
      const webgpuPack = this.getWebGPUFeaturePack();
      if (!webgpuPack) {
        this.requestWebGPUFeaturePack();
        return;
      }
      this.sectionWebGPUUIRenderer = new webgpuPack.WebGPUUIRenderer(device, atlas, 1, 1);
    }

    const ui = this.sectionWebGPUUIRenderer;
    const format = ui.getTextureFormat();

    // Derive markdown styling from the active theme stylesheet.
    // (Theme colors are packed 0xRRGGBBAA, compatible with UI renderer.)
    const proceduralRuledPaper = this.isWorldsSectionBackgroundProceduralChainEnabled();
    const bakedRuledPaper = this.isWorldsSectionBackgroundBakedRuledLines();
    const shaderBg = !!this.parseWorldsSectionBackgroundShader();
    const textureBg = !!this.parseWorldsSectionBackgroundTexture();
    const surfaceBg = this.resolveWorldsSectionBackground();
    const borderStyle = this.getStyle('border');

    const mdBg = (proceduralRuledPaper || bakedRuledPaper || shaderBg || textureBg) ? this.withAlpha(surfaceBg, 0) : surfaceBg;

    const borderEnabled = this.worldsConfig.sectionBorderEnabled !== false;
    const borderWidth = Math.max(0, Math.round(this.worldsConfig.sectionBorderWidth ?? 2));

    this.evictDistantSectionTextures();

    for (const layout of this.section3DLayouts) {
      if (!layout.visible) continue;

      // Live sections: bypass markdown rasterization; call user render callback.
      if (this._liveSections.has(layout.sectionIndex)) {
        if (this.is3DCardPossiblyVisible(viewProj, layout)) {
          const liveChanged = this.bakeLiveSectionTexture(layout, device, baseLineHeight);
          if (liveChanged) worldSizeChanged = true;
        }
        continue;
      }

      const activeLink = this.getActive3DLink();
      const activeLinkIndex = activeLink && activeLink.sectionIndex === layout.sectionIndex
        ? activeLink.linkIndex
        : null;

      // Skip texture work if the card is entirely offscreen.
      if (!this.is3DCardPossiblyVisible(viewProj, layout)) {
        continue;
      }

      const minW = 256;
      const minH = 128;
      const maxW = Math.max(minW, Math.floor(1024 / textureScale));
      const maxH = Math.max(minH, Math.floor(1024 / textureScale));

      const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
      const desiredW = units === 'px'
        ? Math.round(layout.width + texturePadding * 2)
        : Math.round(layout.width * charW + texturePadding * 2);
      const desiredH = units === 'px'
        ? Math.round(layout.height + texturePadding * 2)
        : Math.round(layout.height * baseLineHeight + texturePadding * 2);

      let widthPx = Math.max(minW, Math.min(maxW, desiredW));
      let heightPx = Math.max(minH, Math.min(maxH, desiredH));

      const contentOverride = this.getWorldsSectionContentOverride(layout.sectionId);
      const markdown = buildWorldsCardMarkdown(layout, contentOverride ?? undefined);
      const nodes = uiDocumentPack.parseMarkdownLite(markdown);
      const style = this.createWorldsMarkdownStyle({
        activeLinkIndex,
        background: mdBg,
        foreground: this.resolveEffectiveSectionForeground(layout.sectionId) ?? undefined,
        textAlign: layout.textAlign,
      });

      if (overflowMode === 'expand' || overflowMode === 'expand-y' || overflowMode === 'fit' || overflowMode === 'fit-y') {
        const probeWidthPx = overflowMode === 'fit' ? maxW : widthPx;
        const probe = uiDocumentPack.layoutMarkdownDocument(
          nodes,
          { x: 0, y: 0, width: probeWidthPx, height: heightPx },
          {
            charW,
            charH,
            getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
          },
          style,
          0,
          texturePadding,
          { overflow: 'expand' }
        );
        const reqW = Math.ceil(probe.contentWidth + texturePadding * 2);
        const reqH = Math.ceil(probe.contentHeight + texturePadding * 2);

        const clampedW = Math.max(minW, Math.min(maxW, reqW));
        const clampedH = Math.max(minH, Math.min(maxH, reqH));

        if (overflowMode === 'expand') {
          widthPx = Math.max(widthPx, clampedW);
          heightPx = Math.max(heightPx, clampedH);
        } else if (overflowMode === 'expand-y') {
          heightPx = Math.max(heightPx, clampedH);
        } else if (overflowMode === 'fit') {
          widthPx = clampedW;
          heightPx = clampedH;
        } else if (overflowMode === 'fit-y') {
          heightPx = clampedH;
        }
      }

      {
        const prevW = layout.worldWidth;
        const prevH = layout.worldHeight;
        this.set3DLayoutWorldSizeFromPixels(layout, widthPx, heightPx, baseLineHeight);
        if (layout.worldWidth !== prevW || layout.worldHeight !== prevH) worldSizeChanged = true;
      }

      const textureWidthPx = Math.max(1, Math.round(widthPx * textureScale));
      const textureHeightPx = Math.max(1, Math.round(heightPx * textureScale));

      const existing = this.sectionTextureCache.get(layout.sectionId);
      if (
        existing &&
        existing.width === textureWidthPx &&
        existing.height === textureHeightPx &&
        existing.activeLinkIndex === activeLinkIndex &&
        layout.texture
      ) {
        // Texture already matches current size; ensure link regions are present.
        if (!this.sectionLinkRegionsCache.has(layout.sectionId) || !this.sectionWidgetPlacementsCache.has(layout.sectionId)) {
          const style = this.createWorldsMarkdownStyle({
            activeLinkIndex,
            background: mdBg,
            foreground: this.resolveEffectiveSectionForeground(layout.sectionId) ?? undefined,
            textAlign: layout.textAlign,
          });
          const result = uiDocumentPack.layoutMarkdownDocument(
            nodes,
            { x: 0, y: 0, width: widthPx, height: heightPx },
            {
              charW,
              charH,
              getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
            },
            style,
            0,
            texturePadding,
            this.getWorldsWidgetLayoutOptions(layout.sectionIndex, layoutOverflow)
          );
          this.applyWorldsContentAlignment(result, widthPx, heightPx, texturePadding, layout.contentAlign);
          this.sectionLinkRegionsCache.set(layout.sectionId, this.scaleLinkRegions(result.linkRegions, textureScale));
          this.sectionWidgetPlacementsCache.set(layout.sectionId, this.scaleWidgetPlacements(result.widgetPlacements, textureScale));
        }
        continue;
      }

      // If we need to regenerate, destroy the old texture first.
      if (layout.texture) {
        try {
          layout.texture.destroy();
        } catch {
          // ignore
        }
        layout.texture = null;
      }

      const texture = device.createTexture({
        size: { width: textureWidthPx, height: textureHeightPx },
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC,
      });

      const result = uiDocumentPack.layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: widthPx, height: heightPx },
        {
          charW,
          charH,
          getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
        },
        style,
        0,
        texturePadding,
        this.getWorldsWidgetLayoutOptions(layout.sectionIndex, layoutOverflow)
      );

      // Optional: center the content block within the card.
      this.applyWorldsContentAlignment(result, widthPx, heightPx, texturePadding, layout.contentAlign);

      this.sectionLinkRegionsCache.set(layout.sectionId, this.scaleLinkRegions(result.linkRegions, textureScale));
      this.sectionWidgetPlacementsCache.set(layout.sectionId, this.scaleWidgetPlacements(result.widgetPlacements, textureScale));

      // Replay ops into UI renderer and render into this section texture.
      ui.clearCommands();

      if (bakedRuledPaper) {
        const ruledLine = this.withAlpha(style.mutedFg, 0x40) as any;
        ui.rect(0, 0, textureWidthPx, textureHeightPx, surfaceBg as any);

        const spacing = Math.max(1, Math.round(baseLineHeight * textureScale));
        const thickness = Math.max(1, Math.round(textureScale));
        const startY = Math.max(0, Math.round((texturePadding + baseLineHeight - 3) * textureScale));
        for (let y = startY; y < textureHeightPx; y += spacing) {
          ui.rect(0, y, textureWidthPx, thickness, ruledLine);
        }
      }
      for (const op of result.ops) {
        if (op.kind === 'rect') {
          ui.rect(op.x * textureScale, op.y * textureScale, op.w * textureScale, op.h * textureScale, op.color as any);
        } else if (op.kind === 'image') {
          const registered = this.ensureMarkdownImageRegisteredWithRenderer(op.source, ui, this.activeDocumentId ?? undefined);
          if (registered) {
            ui.image(registered.imageId, op.x * textureScale, op.y * textureScale, op.w * textureScale, op.h * textureScale);
          }
        } else {
          ui.text(op.text, op.x * textureScale, op.y * textureScale, op.color as any);
        }
      }

      if (borderEnabled && borderWidth > 0) {
        const bw = Math.max(1, Math.round(borderWidth * textureScale));
        const c = borderStyle.fg as any;
        ui.rect(0, 0, textureWidthPx, bw, c);
        ui.rect(0, textureHeightPx - bw, textureWidthPx, bw, c);
        ui.rect(0, 0, bw, textureHeightPx, c);
        ui.rect(textureWidthPx - bw, 0, bw, textureHeightPx, c);
      }

      ui.flushTo(texture, textureWidthPx, textureHeightPx, { clear: { r: 0, g: 0, b: 0, a: 0 } });

      layout.texture = texture;
      this.sectionTextureCache.set(layout.sectionId, {
        width: textureWidthPx,
        height: textureHeightPx,
        logicalWidth: widthPx,
        logicalHeight: heightPx,
        textureScaleX: textureScale,
        textureScaleY: textureScale,
        activeLinkIndex,
      });

      this.set3DLayoutWorldSizeFromPixels(layout, widthPx, heightPx, baseLineHeight);
    }

    if (worldSizeChanged) {
      this.reflowWorldsAutoLayout();
    }
  }

  private get3DCardXScaleFactor(layout?: Section3DLayout): number {
    // Section card sizes (layout.width/layout.height) are specified in logical
    // text units (columns/rows). Section textures are generated in pixel space.
    // To avoid X-stretch (and card overlap) we want the quad's world aspect
    // ratio to match the texture pixel aspect ratio.
    //
    // Best: when we have actual texture dimensions for this section, derive a
    // per-card factor directly from widthPx/heightPx.
    if (layout) {
      const dims = this.sectionTextureCache.get(layout.sectionId);
      if (dims && dims.width > 0 && dims.height > 0 && layout.width > 0 && layout.height > 0) {
        const pixelAspect = dims.width / dims.height;
        const logicalAspect = layout.width / layout.height;
        const factor = pixelAspect / logicalAspect;
        if (Number.isFinite(factor) && factor > 0) return factor;
      }
    }

    // Fallback: estimate from current font metrics.
    if (!(this.renderer instanceof WebGPURenderer)) return 1;

    const fontStack =
      this.worldsCardFontStack ||
      this.fontFamily ||
      "'3270-regular', 'Consolas', 'Monaco', monospace";

    const measured = this.measureFontMetrics(fontStack, Math.max(1, this.fontSize || 16));
    const charW = measured.charW;
    const baseLineHeight = measured.baseLineHeight;
    if (!(charW > 0 && baseLineHeight > 0)) return 1;

    const factor = charW / baseLineHeight;
    return Number.isFinite(factor) && factor > 0 ? factor : 1;
  }

  /**
   * Update phase - call user's update handler
   */
  private update(): void {
    // Update modules first
    this.moduleLoader.update(this.deltaTime);

    // Built-in 3D controls (useful for testing picking/navigation)
    if (this.worldsEnabled && this.worldsControlsEnabled && this.camera3D) {
      const dt = this.deltaTime;
      const moveSpeed = 120; // world units / second
      const lookSpeed = 1.6; // radians / second
      const textInputFocused = !!this.getFocusedGUITextInput();

      const applyMove = (dx: number, dy: number, dz: number) => {
        this.applyWorldsCameraTranslation(dx, dy, dz);
      };

      // Movement in XY plane: WASD (arrow keys reserved for link navigation)
      if (!textInputFocused && (this.input.isKeyDown('w') || this.input.isKeyDown('W'))) {
        applyMove(0, moveSpeed * dt, 0);
      }
      if (!textInputFocused && (this.input.isKeyDown('s') || this.input.isKeyDown('S'))) {
        applyMove(0, -moveSpeed * dt, 0);
      }
      if (!textInputFocused && (this.input.isKeyDown('a') || this.input.isKeyDown('A'))) {
        applyMove(-moveSpeed * dt, 0, 0);
      }
      if (!textInputFocused && (this.input.isKeyDown('d') || this.input.isKeyDown('D'))) {
        applyMove(moveSpeed * dt, 0, 0);
      }

      // QE = look left/right (yaw)
      if (!textInputFocused && (this.input.isKeyDown('q') || this.input.isKeyDown('Q'))) {
        this.camera3D.rotation.y -= lookSpeed * dt;
      }
      if (!textInputFocused && (this.input.isKeyDown('e') || this.input.isKeyDown('E'))) {
        this.camera3D.rotation.y += lookSpeed * dt;
      }

      // Right-drag mouse-look
      const rmbDown = this.input.isMouseDown(2);
      const mx = this.input.getMouseX();
      const my = this.input.getMouseY();
      if (rmbDown) {
        if (!this.mouseLookActive) {
          this.mouseLookActive = true;
          this.mouseLookLastX = mx;
          this.mouseLookLastY = my;
        } else {
          const dx = mx - this.mouseLookLastX;
          const dy = my - this.mouseLookLastY;
          this.mouseLookLastX = mx;
          this.mouseLookLastY = my;

          const sensitivity = 0.003; // radians / pixel
          this.camera3D.rotation.y += dx * sensitivity;
          this.camera3D.rotation.x += dy * sensitivity;

          // Clamp pitch to avoid flipping
          const limit = Math.PI / 2 - 0.01;
          if (this.camera3D.rotation.x > limit) this.camera3D.rotation.x = limit;
          if (this.camera3D.rotation.x < -limit) this.camera3D.rotation.x = -limit;
        }
      } else {
        this.mouseLookActive = false;
      }
    }
    
    // Update 3D camera (easing)
    if (this.camera3D && this.worldsEnabled) {
      updateCamera3D(this.camera3D, this.deltaTime);
    }
    
    // Then update user code
    const doc = this.getActiveDocument();
    if (doc?.handlers?.update) {
      // For live sections that are currently active, pre-compute section-local
      // mouse coordinates so ui.pointer.x/y() and ui.metrics return section-space
      // values during the update phase (matching the render/hit-test coordinate system).
      const hoveredPick = this.pick3DAt(this.input.getMouseX(), this.input.getMouseY());
      const hoveredLiveLayout = hoveredPick && this._liveSections.has(hoveredPick.layout.sectionIndex)
        ? hoveredPick.layout
        : null;
      const selectedSectionIdx = this.getResolvedSelected3DSectionIndex();
      const selectedLiveLayout = typeof selectedSectionIdx === 'number' && this._liveSections.has(selectedSectionIdx)
        ? this.getSectionLayoutByIndex(selectedSectionIdx)
        : null;
      const curSectionIdx = this.getResolvedCurrent3DSectionIndex();
      const currentLiveLayout = typeof curSectionIdx === 'number' && this._liveSections.has(curSectionIdx)
        ? this.getSectionLayoutByIndex(curSectionIdx)
        : null;
      const liveLayout = hoveredLiveLayout ?? selectedLiveLayout ?? currentLiveLayout;
      if (liveLayout) {
        const cached = this.sectionTextureCache.get(liveLayout.sectionId);
        if (cached && cached.width > 0 && cached.height > 0) {
          const mx = this.input.getMouseX();
          const my = this.input.getMouseY();
          const baseMetricScale = this.getWorldsTextureScale();
          const _liveMinUpd = Number.isFinite(this.worldsConfig.liveTextureScale as number)
            ? Math.max(1, Math.min(4, this.worldsConfig.liveTextureScale as number))
            : 2;
          const textureScale = Math.max(_liveMinUpd, baseMetricScale);
          const logicalWidth = Math.max(1, Math.round(cached.width / textureScale));
          const logicalHeight = Math.max(1, Math.round(cached.height / textureScale));

          let localMouseX: number | null = null;
          let localMouseY: number | null = null;

          if (hoveredPick?.layout?.sectionId === liveLayout.sectionId) {
            localMouseX = hoveredPick.u * logicalWidth;
            localMouseY = hoveredPick.v * logicalHeight;
          } else {
            const xform = this.getWorldsSectionTextureToScreenAffine(liveLayout);
            if (xform) {
              localMouseX = (xform.localFromScreenTexPx.a * mx + xform.localFromScreenTexPx.c * my + xform.localFromScreenTexPx.e) / textureScale;
              localMouseY = (xform.localFromScreenTexPx.b * mx + xform.localFromScreenTexPx.d * my + xform.localFromScreenTexPx.f) / textureScale;
            }
          }

          if (localMouseX !== null && localMouseY !== null) {
            this._liveSectionInputCtx = {
              sectionIndex: liveLayout.sectionIndex,
              width: logicalWidth,
              height: logicalHeight,
              localMouseX,
              localMouseY,
              textureScale,
              baseMetricScale,
            };
          }
        }
      }
      try {
        doc.handlers.update(this.deltaTime);
      } catch (error) {
        console.error('Error in update handler:', error);
        this.recordUserHandlerError('update', error);
      }
      this._liveSectionInputCtx = null;
    }

    this.syncHiddenTextInputBridge(false);
  }

  /**
   * Render phase - call user's render handler
   */
  private render(): void {
    const doc = this.getActiveDocument();
    
    if (!doc) {
      if (this.frameCount < 3) console.log('🎨 No active document');
      return;
    }
    
    if (!doc.handlers) {
      if (this.frameCount < 3) console.log('🎨 No handlers object');
      return;
    }
    
    if (!doc.handlers.render) {
      if (this.frameCount < 3) console.log('🎨 No render handler');
      return;
    }
    
    try {
      doc.handlers.render();
    } catch (error) {
      console.error('Error in render handler:', error);
      this.recordUserHandlerError('render', error);
    }
    
    // Render modules last (so they can overlay)
    this.moduleLoader.render();
  }

  /**
   * Helper: Draw a line using Bresenham's algorithm
   */
  private drawLine(x1: number, y1: number, x2: number, y2: number, char: string, fg?: Color, bg?: Color): void {
    const layer = this.layers.getActive();
    
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    let x = x1, y = y1;
    while (true) {
      layer.plot(x, y, char, fg, bg);
      
      if (x === x2 && y === y2) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /**
   * Helper: Draw a rectangle
   */
  private drawRect(x: number, y: number, w: number, h: number, char: string, fg?: Color, bg?: Color, filled: boolean = false): void {
    const layer = this.layers.getActive();
    
    if (filled) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          layer.plot(px, py, char, fg, bg);
        }
      }
    } else {
      // Top and bottom
      for (let px = x; px < x + w; px++) {
        layer.plot(px, y, char, fg, bg);
        layer.plot(px, y + h - 1, char, fg, bg);
      }
      // Left and right
      for (let py = y; py < y + h; py++) {
        layer.plot(x, py, char, fg, bg);
        layer.plot(x + w - 1, py, char, fg, bg);
      }
    }
  }

  /**
   * Return the pixel dimensions requested by the current document's frontmatter
   * (`width:` / `height:` keys), or `null` if not specified.
   * The host page uses this to scale the canvas to fit the viewport while
   * preserving the requested aspect ratio.
   */
  getViewportConstraint(): { width: number; height: number } | null {
    return this.frontmatterViewport;
  }

  /**
   * Resize the engine
   */
  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.layers.resize(width, height);
    this.renderer.resize(width, height);

    // Renderer.resize() may change canvas.width/height; ensure CSS matches.
    this.syncCanvasElementSizeToBuffer();
    
    // Update compositor if WebGPU is enabled
    if (this.compositor && this.renderer instanceof WebGPURenderer) {
      // Resize compositor (updates canvas and context)
      this.compositor.resize(this.canvas.width, this.canvas.height);
      
      // Update terminal layer texture reference (renderer creates new texture on resize)
      const terminalTexture = this.renderer.getRenderTexture();
      if (terminalTexture) {
        this.compositor.updateLayerTexture('terminal', terminalTexture);
      }

      // Resize UI texture if present
      if (this.webgpuUIRenderer) {
        this.webgpuUIRenderer.resize(this.canvas.width, this.canvas.height);
        this.compositor.updateLayerTexture('ui', this.webgpuUIRenderer.getTexture());
      }

      // Resize Worlds render targets (offscreen) and keep compositor layer in sync.
      if (this.worldsRenderer) {
        this.worldsRenderer.resize(this.canvas.width, this.canvas.height);
        const renderTexture = this.worldsRenderer.getRenderTexture();
        if (renderTexture) {
          this.compositor.updateLayerTexture('3d', renderTexture);
        }

        // Re-frame the focused section for the new aspect ratio.
        this.refocus3DForCurrentViewport();
      }
    }
  }

  /**
   * Get a named style from the current theme
   */
  private getStyle(name: string): NamedStyle {
    if (!this.styleSheet) {
      console.warn('StyleSheet not initialized, using default colors');
      return {
        fg: 0xFFFFFFFF,
        bg: 0x000000FF
      };
    }
    const style = this.styleSheet[name];
    if (!style) {
      console.warn(`Style "${name}" not found, using default`);
      return this.styleSheet.default || {
        fg: { r: 0xff, g: 0xff, b: 0xff },
        bg: { r: 0x00, g: 0x00, b: 0x00 }
      };
    }
    return style;
  }

  /**
   * Set up input event listeners for on:input handlers
   */
  private setupEventListeners(): void {
    try {
      (this.canvas.style as any).touchAction = 'none';
    } catch {
      // ignore
    }

    // Key events
    this.canvas.addEventListener('keydown', (e) => this.handleKeyEvent(e, 'press'));
    this.canvas.addEventListener('keyup', (e) => this.handleKeyEvent(e, 'release'));
    
    // Mouse events
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseEvent(e, 'press'));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseEvent(e, 'release'));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMoveEvent(e));
    this.canvas.addEventListener('wheel', (e) => this.handleWheelEvent(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchEvent(e, 'press'), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMoveEvent(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEvent(e, 'release'), { passive: false });
    this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEvent(e, 'release'), { passive: false });
    
    // Ensure canvas can receive keyboard events
    this.canvas.tabIndex = 0;
    this.canvas.focus();

    this.setupHiddenTextInputBridge();
  }

  private setupHiddenTextInputBridge(): void {
    if (typeof document === 'undefined' || this.hiddenTextInput) return;

    const input = document.createElement('textarea');
    input.setAttribute('aria-label', 'Storie hidden text input');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'none');
    input.setAttribute('enterkeyhint', 'done');
    input.wrap = 'off';
    input.rows = 1;
    input.spellcheck = false;
    input.tabIndex = -1;
    input.style.position = 'fixed';
    input.style.left = '0';
    input.style.top = '0';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    input.style.padding = '0';
    input.style.border = '0';
    input.style.margin = '0';
    input.style.fontSize = '16px';
    input.style.pointerEvents = 'none';
    input.style.resize = 'none';
    input.style.zIndex = '-1';

    input.addEventListener('keydown', (e) => {
      const target = this.getFocusedGUITextInput();
      if (!target) return;
      if (this.shouldDispatchHiddenTextInputKeyEvent(e, target)) {
        this.handleKeyEvent(e, 'press');
        this.syncHiddenTextInputBridge(false);
      }
    });

    input.addEventListener('keyup', (e) => {
      const target = this.getFocusedGUITextInput();
      if (!target) return;
      if (this.shouldDispatchHiddenTextInputKeyEvent(e, target)) {
        this.handleKeyEvent(e, 'release');
      }
    });

    input.addEventListener('input', () => {
      this.handleHiddenTextInputValueChange();
    });

    document.body.appendChild(input);
    this.hiddenTextInput = input;
  }

  private getFocusedGUITextInput(): TextInputCapable | null {
    const guiAPI = (this.api as any)?.gui;
    const system = guiAPI?.getSystem?.();
    if (system && typeof system.getFocusedTextInput === 'function') {
      return system.getFocusedTextInput();
    }
    return null;
  }

  private getWorldsSectionBoundGUIGroupIds(guiAPI?: any): Set<string | number> {
    const source = guiAPI ?? (this.api as any)?.gui;
    const bindings: Array<{ group: string | number; sections: number[] }> = Array.isArray(source?._sectionBindings)
      ? source._sectionBindings
      : [];
    const groups = new Set<string | number>();
    for (const binding of bindings) {
      groups.add(binding.group);
    }
    return groups;
  }

  private isPointOverVisibleGUIWidget(pixelX: number, pixelY: number, excludedGroups?: ReadonlySet<string | number>): boolean {
    const guiAPI = (this.api as any)?.gui;
    const system = guiAPI?.getSystem?.();
    const manager = system?.getWidgetManager?.();
    let widgets: any[] = [];
    if (manager && typeof manager.getVisible === 'function') {
      widgets = manager.getVisible();
    } else if (system && typeof system.getWidgets === 'function') {
      widgets = system.getWidgets();
    }

    if (!Array.isArray(widgets) || widgets.length === 0) return false;

    const charWidth = this.width > 0 ? (this.canvas.width / this.width) : 1;
    const charHeight = this.height > 0 ? (this.canvas.height / this.height) : 1;
    const coord = {
      x: pixelX,
      y: pixelY,
      cellX: Math.floor(pixelX / Math.max(1, charWidth)),
      cellY: Math.floor(pixelY / Math.max(1, charHeight))
    };

    return widgets.some((widget: any) => {
      if (!widget?.state?.visible) return false;
      if (excludedGroups?.has(widget.group)) return false;
      return typeof widget.containsPoint === 'function' && widget.containsPoint(coord);
    });
  }

  private getWorldsCameraBasis(rotation: { x: number; y: number; z: number }): {
    forward: { x: number; y: number; z: number };
    right: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  } {
    const forward = {
      x: Math.sin(rotation.y) * Math.cos(rotation.x),
      y: -Math.sin(rotation.x),
      z: -Math.cos(rotation.y) * Math.cos(rotation.x)
    };

    const zAxis = vec3Normalize(vec3Scale(forward, -1));
    let right = vec3Normalize({ x: zAxis.z, y: 0, z: -zAxis.x });
    if (vec3Length(right) <= 1e-8) right = { x: 1, y: 0, z: 0 };
    let up = {
      x: zAxis.y * right.z - zAxis.z * right.y,
      y: zAxis.z * right.x - zAxis.x * right.z,
      z: zAxis.x * right.y - zAxis.y * right.x,
    };

    const roll = Number.isFinite(rotation.z) ? rotation.z : 0;
    if (roll) {
      const c = Math.cos(roll);
      const s = Math.sin(roll);
      const rolledRight = vec3Add(vec3Scale(right, c), vec3Scale(up, s));
      const rolledUp = vec3Add(vec3Scale(up, c), vec3Scale(right, -s));
      right = rolledRight;
      up = rolledUp;
    }

    return { forward, right, up };
  }

  private applyWorldsCameraTranslation(dx: number, dy: number, dz: number): void {
    if (!this.camera3D) return;
    this.camera3D.position.x += dx;
    this.camera3D.position.y += dy;
    this.camera3D.position.z += dz;
    if (this.camera3D.target) {
      this.camera3D.target.x += dx;
      this.camera3D.target.y += dy;
      this.camera3D.target.z += dz;
    }
  }

  private estimateWorldsNavigationDistance(): number {
    if (!this.camera3D) return 120;
    const cameraPos = this.camera3D.effectivePosition ?? this.camera3D.position;

    if (this.camera3D.target) {
      const dist = vec3Length(vec3Sub(this.camera3D.target, cameraPos));
      if (Number.isFinite(dist) && dist > 1) return dist;
    }

    const currentLayout = this.getCurrent3DSectionLayout();
    if (currentLayout) {
      const dist = vec3Length(vec3Sub(currentLayout.transform.position, cameraPos));
      if (Number.isFinite(dist) && dist > 1) return dist;
    }

    const fallback = Math.abs(cameraPos.z);
    return Number.isFinite(fallback) && fallback > 1 ? fallback : 120;
  }

  private applyWorldsPositionConstraints(clampX: boolean, clampY: boolean, clampZ: boolean): void {
    if (!this.camera3D) return;
    const nc = this.worldsConfig.navigationConstraints;
    if (!nc) return;

    const pos = this.camera3D.position;
    let overshootX = 0;
    let overshootY = 0;
    let overshootZ = 0;

    if (clampX) {
      if (nc.minX !== undefined && pos.x < nc.minX) overshootX = pos.x - nc.minX;
      if (nc.maxX !== undefined && pos.x > nc.maxX) overshootX = pos.x - nc.maxX;
    }
    if (clampY) {
      if (nc.minY !== undefined && pos.y < nc.minY) overshootY = pos.y - nc.minY;
      if (nc.maxY !== undefined && pos.y > nc.maxY) overshootY = pos.y - nc.maxY;
    }
    if (clampZ) {
      if (nc.minZ !== undefined && pos.z < nc.minZ) overshootZ = pos.z - nc.minZ;
      if (nc.maxZ !== undefined && pos.z > nc.maxZ) overshootZ = pos.z - nc.maxZ;
    }

    if (overshootX !== 0 || overshootY !== 0 || overshootZ !== 0) {
      pos.x -= overshootX;
      pos.y -= overshootY;
      pos.z -= overshootZ;
      if (this.camera3D.target) {
        this.camera3D.target.x -= overshootX;
        this.camera3D.target.y -= overshootY;
        this.camera3D.target.z -= overshootZ;
      }
    }
  }

  private clampDollyForZBounds(dolly: number, forwardZ: number): number {
    const nc = this.worldsConfig.navigationConstraints;
    if (!nc || !this.camera3D) return dolly;
    if (Math.abs(forwardZ) < 1e-6) return dolly;
    const currentZ = this.camera3D.position.z;
    const newZ = currentZ + forwardZ * dolly;
    if (nc.minZ !== undefined && newZ < nc.minZ) {
      return (nc.minZ - currentZ) / forwardZ;
    }
    if (nc.maxZ !== undefined && newZ > nc.maxZ) {
      return (nc.maxZ - currentZ) / forwardZ;
    }
    return dolly;
  }

  private applyWorldsCameraPanDelta(dx: number, dy: number): boolean {
    if (!this.worldsEnabled || !this.camera3D) return false;
    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) {
      return true;
    }

    const dragAxis = this.worldsConfig.navigationConstraints?.dragAxis;
    const effectiveDx = dragAxis === 'y' ? 0 : dx;
    const effectiveDy = dragAxis === 'x' ? 0 : dy;

    if (effectiveDx === 0 && effectiveDy === 0) return true;

    const rotation = this.camera3D.effectiveRotation ?? this.camera3D.rotation;
    const basis = this.getWorldsCameraBasis(rotation);
    const distance = this.estimateWorldsNavigationDistance();
    const canvasH = Math.max(1, this.canvas.height);
    const worldPerPixel = (2 * Math.tan((this.camera3D.fov || (Math.PI / 4)) * 0.5) * distance) / canvasH;

    const move = vec3Add(
      vec3Scale(basis.right, -effectiveDx * worldPerPixel),
      vec3Scale(basis.up, effectiveDy * worldPerPixel)
    );
    this.applyWorldsCameraTranslation(move.x, move.y, move.z);
    this.applyWorldsPositionConstraints(true, true, false);
    return true;
  }

  private handleWorldsMiddlePanMove(pixelX: number, pixelY: number): boolean {
    if (!this.middlePanActive || !this.worldsEnabled || !this.camera3D) return false;

    const dx = pixelX - this.middlePanLastX;
    const dy = pixelY - this.middlePanLastY;
    this.middlePanLastX = pixelX;
    this.middlePanLastY = pixelY;

    return this.applyWorldsCameraPanDelta(dx, dy);
  }

  private handleWorldsWheelEvent(e: WheelEvent): boolean {
    if (!this.worldsEnabled || !this.camera3D) return false;

    const rect = this.canvas.getBoundingClientRect();
    const pixelX = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const pixelY = (e.clientY - rect.top) * (this.canvas.height / rect.height);

    if (this.isPointOverVisibleGUIWidget(pixelX, pixelY)) {
      return false;
    }

    let deltaY = Number(e.deltaY);
    if (!Number.isFinite(deltaY) || deltaY === 0) return false;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) deltaY *= 16;
    else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) deltaY *= Math.max(1, this.canvas.height);

    const speedScale = e.shiftKey ? 2.25 : e.altKey ? 0.35 : 1;
    const distance = this.estimateWorldsNavigationDistance();
    const rawDolly = -deltaY * 0.0015 * Math.max(24, distance) * speedScale;
    const rotation = this.camera3D.effectiveRotation ?? this.camera3D.rotation;
    const basis = this.getWorldsCameraBasis(rotation);
    const dolly = this.clampDollyForZBounds(rawDolly, basis.forward.z);
    this.applyWorldsCameraTranslation(
      basis.forward.x * dolly,
      basis.forward.y * dolly,
      basis.forward.z * dolly,
    );
    return true;
  }

  private startFreeFlyLeftDrag(pixelX: number, pixelY: number): boolean {
    if (!this.worldsEnabled || !this.camera3D || !this.worldsControlsEnabled) return false;
    if (this.isPointOverVisibleGUIWidget(pixelX, pixelY)) return false;

    const picked = this.pick3DAt(pixelX, pixelY);
    this.freeFlyLeftLastX = pixelX;
    this.freeFlyLeftLastY = pixelY;

    if (picked?.layout) {
      this.setSelected3DSection(picked.layout.sectionIndex);
      this.freeFlyLeftDragSectionIndex = picked.layout.sectionIndex;
      this.freeFlyLeftPanActive = false;
      return true;
    }

    this.freeFlyLeftPanActive = true;
    this.freeFlyLeftDragSectionIndex = null;
    return true;
  }

  private stopFreeFlyLeftDrag(): boolean {
    const wasActive = this.freeFlyLeftPanActive || this.freeFlyLeftDragSectionIndex !== null;
    this.freeFlyLeftPanActive = false;
    this.freeFlyLeftDragSectionIndex = null;
    return wasActive;
  }

  private handleFreeFlyLeftDragMove(pixelX: number, pixelY: number): boolean {
    if (!this.worldsEnabled || !this.camera3D || !this.worldsControlsEnabled) return false;
    if (!this.freeFlyLeftPanActive && this.freeFlyLeftDragSectionIndex === null) return false;

    const dx = pixelX - this.freeFlyLeftLastX;
    const dy = pixelY - this.freeFlyLeftLastY;
    this.freeFlyLeftLastX = pixelX;
    this.freeFlyLeftLastY = pixelY;

    if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return true;

    if (this.freeFlyLeftPanActive) {
      return this.applyWorldsCameraPanDelta(dx, dy);
    }

    const sectionIndex = this.freeFlyLeftDragSectionIndex;
    if (!(typeof sectionIndex === 'number' && Number.isFinite(sectionIndex))) return false;
    const layout = this.section3DLayouts[sectionIndex];
    if (!layout) return false;

    const rotation = this.camera3D.effectiveRotation ?? this.camera3D.rotation;
    const basis = this.getWorldsCameraBasis(rotation);
    const distance = this.estimateWorldsNavigationDistance();
    const canvasH = Math.max(1, this.canvas.height);
    const worldPerPixel = (2 * Math.tan((this.camera3D.fov || (Math.PI / 4)) * 0.5) * distance) / canvasH;
    const right2 = { x: basis.right.x, y: basis.right.y };
    const up2 = { x: basis.up.x, y: basis.up.y };
    const moveX = (dx * right2.x - dy * up2.x) * worldPerPixel;
    const moveY = (dx * right2.y - dy * up2.y) * worldPerPixel;
    const nextPosition = {
      x: layout.transform.position.x + moveX,
      y: layout.transform.position.y + moveY,
      z: layout.transform.position.z,
    };

    layout.transform.position = nextPosition;
    layout.autoPositioned = false;
    this.getOrCreateSectionRuntimeOverride(layout.sectionId).position = { ...nextPosition };
    return true;
  }

  private shouldDispatchHiddenTextInputKeyEvent(e: KeyboardEvent, target: TextInputCapable): boolean {
    const key = String(e.key ?? '');
    const lower = key.toLowerCase();
    const options = target.getTextInputOptions();

    if (e.ctrlKey || e.metaKey || e.altKey) {
      return lower !== 'c' && lower !== 'v' && lower !== 'x';
    }

    if (key === 'Enter') {
      return !options.multiline;
    }

    return key === 'Tab'
      || key === 'Escape'
      || key === 'Home'
      || key === 'End'
      || key === 'PageUp'
      || key === 'PageDown'
      || key === 'ArrowLeft'
      || key === 'ArrowRight'
      || key === 'ArrowUp'
      || key === 'ArrowDown';
  }

  private handleHiddenTextInputValueChange(): void {
    if (this.hiddenTextInputSyncing) return;
    const input = this.hiddenTextInput;
    const target = this.getFocusedGUITextInput();
    if (!input || !target) return;

    const guiRuntimePack = this.getGUIRuntimePack();
    if (!guiRuntimePack) {
      this.requestGUIRuntimePack();
      return;
    }

    const options = target.getTextInputOptions();
    let nextValue = guiRuntimePack.normalizeSingleLineText(input.value ?? '');
    if (options.multiline) {
      nextValue = String(input.value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }
    const currentValue = target.getValue();

    if (nextValue !== currentValue) {
      target.replaceTextRange(0, currentValue.length, nextValue);
    }

    const selectionStart = Number.isFinite(input.selectionStart as number) ? (input.selectionStart ?? nextValue.length) : nextValue.length;
    const selectionEnd = Number.isFinite(input.selectionEnd as number) ? (input.selectionEnd ?? selectionStart) : selectionStart;
    let direction: 'forward' | 'backward' | 'none' = 'none';
    if (input.selectionDirection === 'forward' || input.selectionDirection === 'backward') {
      direction = input.selectionDirection;
    }
    target.setSelectionRange(selectionStart, selectionEnd, direction);
    this.syncHiddenTextInputBridge(false);
  }

  private focusCanvasWithoutScroll(): void {
    if (typeof document === 'undefined' || document.activeElement === this.canvas) {
      return;
    }

    try {
      this.canvas.focus({ preventScroll: true });
    } catch {
      this.canvas.focus();
    }
  }

  private syncHiddenTextInputBridge(preferFocus: boolean = false): void {
    const input = this.hiddenTextInput;
    if (!input || typeof document === 'undefined') return;

    const target = this.getFocusedGUITextInput();
    if (!target) {
      if (document.activeElement === input) {
        input.blur();
      }
      return;
    }

    const guiRuntimePack = this.getGUIRuntimePack();
    if (!guiRuntimePack) {
      this.requestGUIRuntimePack();
      return;
    }

    const options = target.getTextInputOptions();
    const value = options.multiline ? target.getValue() : guiRuntimePack.normalizeSingleLineText(target.getValue());
    const selection = target.getSelectionRange();
    const bridgeAttributes = guiRuntimePack.getHiddenTextInputBridgeAttributes(options);

    if (!options.showSoftKeyboard) {
      if (document.activeElement === input) {
        input.blur();
      }
      if (preferFocus) {
        this.focusCanvasWithoutScroll();
      }
    }

    this.hiddenTextInputSyncing = true;
    try {
      if (input.value !== value) {
        input.value = value;
      }
      input.rows = options.multiline ? 2 : 1;
      input.spellcheck = options.spellcheck;
      input.autocapitalize = options.autoCapitalize === 'off' ? 'none' : options.autoCapitalize;
      input.setAttribute('autocorrect', options.autoCorrect ? 'on' : 'off');
      input.readOnly = bridgeAttributes.readOnly;
      if (bridgeAttributes.readOnly) {
        input.setAttribute('readonly', 'readonly');
      } else {
        input.removeAttribute('readonly');
      }
      (input as any).inputMode = bridgeAttributes.inputMode;
      input.setAttribute('inputmode', bridgeAttributes.inputMode);
      (input as any).virtualKeyboardPolicy = bridgeAttributes.virtualKeyboardPolicy;
      input.setAttribute('virtualkeyboardpolicy', bridgeAttributes.virtualKeyboardPolicy);
      (input as any).enterKeyHint = options.enterKeyHint;
      input.setAttribute('enterkeyhint', options.enterKeyHint);

      const start = Math.max(0, Math.min(value.length, selection.start | 0));
      const end = Math.max(0, Math.min(value.length, selection.end | 0));
      if (input.selectionStart !== start || input.selectionEnd !== end || input.selectionDirection !== (selection.direction ?? 'none')) {
        input.setSelectionRange(start, end, selection.direction ?? 'none');
      }

      if (options.showSoftKeyboard && preferFocus && document.activeElement !== input) {
        try {
          input.focus({ preventScroll: true });
        } catch {
          input.focus();
        }
      }
    } finally {
      this.hiddenTextInputSyncing = false;
    }
  }

  private beginTrustedAudioGesture(): void {
    this.trustedAudioGestureDepth++;
    this.ensureAudioGestureUnlock();
    this.flushPendingGestureAudioStarts();
  }

  private endTrustedAudioGesture(): void {
    this.trustedAudioGestureDepth = Math.max(0, this.trustedAudioGestureDepth - 1);
  }

  private runOrQueueGestureAudioStart(start: () => void): boolean {
    const ctx = this.audioContext as AudioContext & { state?: AudioContextState };
    if (
      this.trustedAudioGestureDepth > 0 ||
      this.audioGestureUnlocked ||
      ctx.state === 'running'
    ) {
      try {
        start();
        return true;
      } catch (error) {
        console.warn('[audio] gesture-time start failed:', error);
        return false;
      }
    }

    if (this.pendingGestureAudioStarts.length >= 64) {
      this.pendingGestureAudioStarts.shift();
    }
    this.pendingGestureAudioStarts.push(start);
    return false;
  }

  private flushPendingGestureAudioStarts(): void {
    while (this.pendingGestureAudioStarts.length > 0) {
      const start = this.pendingGestureAudioStarts.shift();
      if (!start) continue;
      try {
        start();
      } catch (error) {
        console.warn('[audio] queued gesture-time start failed:', error);
      }
    }
  }

  private ensureAudioGestureUnlock(): void {
    if (this.audioGestureUnlocked) return;

    const ctx = this.audioContext as AudioContext & { state?: AudioContextState };
    if (ctx.state === 'running') {
      this.audioGestureUnlocked = true;
      return;
    }

    try {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);

      const buffer = ctx.createBuffer(1, 1, Math.max(3000, Math.floor(ctx.sampleRate || 44100)));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(gain);

      const now = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
      try {
        source.start(now);
      } catch {
        source.start();
      }
      try {
        source.stop(now + 0.001);
      } catch {
        try {
          source.stop();
        } catch {
          // ignore
        }
      }
    } catch {
      // Some environments may reject node creation before unlock. Resume below still helps.
    }

    ctx.resume()
      .then(() => {
        if (ctx.state === 'running') this.audioGestureUnlocked = true;
      })
      .catch(() => {
        // Keep retrying on future gestures until iOS accepts the unlock.
      });
  }

  private touchToPixelXY(t: Touch): { pixelX: number; pixelY: number } {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = t.clientX - rect.left;
    const cssY = t.clientY - rect.top;
    const pixelX = cssX * (this.canvas.width / rect.width);
    const pixelY = cssY * (this.canvas.height / rect.height);
    return { pixelX, pixelY };
  }

  private resetWorldsPinchZoom(): void {
    this.pinchZoomActive = false;
    this.pinchZoomLastDistance = 0;
    this.pinchZoomLastCenterX = 0;
    this.pinchZoomLastCenterY = 0;
  }

  private resetWorldsMultiTouchRotate(): void {
    this.multiTouchRotateActive = false;
    this.multiTouchRotateLastCentroidX = 0;
    this.multiTouchRotateLastCentroidY = 0;
  }

  private handleWorldsMultiTouchRotate(e: TouchEvent): boolean {
    if (!this.worldsEnabled || !this.camera3D) {
      this.resetWorldsMultiTouchRotate();
      return false;
    }
    if (!e.touches || e.touches.length < 3) {
      this.resetWorldsMultiTouchRotate();
      return false;
    }

    // Compute centroid of all active touch points.
    let sumX = 0;
    let sumY = 0;
    const count = e.touches.length;
    for (let i = 0; i < count; i++) {
      const tp = e.touches[i];
      if (!tp) continue;
      const { pixelX, pixelY } = this.touchToPixelXY(tp);
      sumX += pixelX;
      sumY += pixelY;
    }
    const centroidX = sumX / count;
    const centroidY = sumY / count;

    this.lastTouchEventAt = Date.now();

    if (!this.multiTouchRotateActive) {
      this.multiTouchRotateActive = true;
      this.multiTouchRotateLastCentroidX = centroidX;
      this.multiTouchRotateLastCentroidY = centroidY;
      this.resetWorldsPinchZoom();
      this.stopFreeFlyLeftDrag();
      return true;
    }

    const dx = centroidX - this.multiTouchRotateLastCentroidX;
    const dy = centroidY - this.multiTouchRotateLastCentroidY;
    this.multiTouchRotateLastCentroidX = centroidX;
    this.multiTouchRotateLastCentroidY = centroidY;

    const sensitivity = 0.002; // radians per pixel (same scale as right-drag mouse-look)

    if (count === 3) {
      // 3 fingers: vertical drag → pitch (rotation.x)
      if (Number.isFinite(dy) && dy !== 0) {
        this.camera3D.rotation.x += dy * sensitivity;
        const pitchLimit = Math.PI / 2 - 0.01;
        if (this.camera3D.rotation.x > pitchLimit) this.camera3D.rotation.x = pitchLimit;
        if (this.camera3D.rotation.x < -pitchLimit) this.camera3D.rotation.x = -pitchLimit;
      }
    } else {
      // 4+ fingers: horizontal drag → yaw (rotation.y)
      if (Number.isFinite(dx) && dx !== 0) {
        this.camera3D.rotation.y += dx * sensitivity;
      }
    }

    return true;
  }

  private handleWorldsPinchTouchMove(e: TouchEvent): boolean {
    if (!this.worldsEnabled || !this.camera3D) {
      this.resetWorldsPinchZoom();
      return false;
    }
    if (!e.touches || e.touches.length < 2) {
      this.resetWorldsPinchZoom();
      return false;
    }

    const first = e.touches[0];
    const second = e.touches[1];
    if (!first || !second) {
      this.resetWorldsPinchZoom();
      return false;
    }

    const a = this.touchToPixelXY(first);
    const b = this.touchToPixelXY(second);
    const centerX = (a.pixelX + b.pixelX) * 0.5;
    const centerY = (a.pixelY + b.pixelY) * 0.5;
    if (this.isPointOverVisibleGUIWidget(centerX, centerY)) {
      this.resetWorldsPinchZoom();
      return false;
    }

    const dx = b.pixelX - a.pixelX;
    const dy = b.pixelY - a.pixelY;
    const distancePixels = Math.hypot(dx, dy);
    if (!Number.isFinite(distancePixels) || distancePixels <= 0) {
      this.resetWorldsPinchZoom();
      return false;
    }

    this.lastTouchEventAt = Date.now();
    this.input.updateMousePosition(centerX, centerY);
    this.input.applySyntheticEvent({ type: 'mouse_move', x: centerX, y: centerY });

    if (!this.pinchZoomActive) {
      this.pinchZoomActive = true;
      this.pinchZoomLastDistance = distancePixels;
      this.pinchZoomLastCenterX = centerX;
      this.pinchZoomLastCenterY = centerY;
      this.stopFreeFlyLeftDrag();
      return true;
    }

    const deltaCenterX = centerX - this.pinchZoomLastCenterX;
    const deltaCenterY = centerY - this.pinchZoomLastCenterY;
    this.pinchZoomLastCenterX = centerX;
    this.pinchZoomLastCenterY = centerY;

    const deltaDistance = distancePixels - this.pinchZoomLastDistance;
    this.pinchZoomLastDistance = distancePixels;

    if (Number.isFinite(deltaCenterX) && Number.isFinite(deltaCenterY) && (deltaCenterX !== 0 || deltaCenterY !== 0)) {
      this.applyWorldsCameraPanDelta(deltaCenterX, deltaCenterY);
    }

    if (!Number.isFinite(deltaDistance) || deltaDistance === 0) return true;

    const distance = this.estimateWorldsNavigationDistance();
    const rawDolly = deltaDistance * 0.002 * Math.max(24, distance);
    const rotation = this.camera3D.effectiveRotation ?? this.camera3D.rotation;
    const basis = this.getWorldsCameraBasis(rotation);
    const dolly = this.clampDollyForZBounds(rawDolly, basis.forward.z);
    this.applyWorldsCameraTranslation(
      basis.forward.x * dolly,
      basis.forward.y * dolly,
      basis.forward.z * dolly,
    );
    return true;
  }

  private handleTouchMoveEvent(e: TouchEvent): void {
    if (this.hostAudienceView) {
      e.preventDefault();
      return;
    }

    if (e.touches && e.touches.length >= 3 && this.worldsConfig.multiTouchRotateEnabled) {
      if (this.handleWorldsMultiTouchRotate(e)) {
        e.preventDefault();
        return;
      }
    } else if (this.multiTouchRotateActive) {
      this.resetWorldsMultiTouchRotate();
    }

    if (e.touches && e.touches.length >= 2) {
      if (this.handleWorldsPinchTouchMove(e)) {
        e.preventDefault();
        return;
      }
    } else if (this.pinchZoomActive) {
      this.resetWorldsPinchZoom();
    }

    const doc = this.getActiveDocument();
    const t = (e.touches && e.touches.length) ? e.touches[0] : (e.changedTouches && e.changedTouches.length ? e.changedTouches[0] : null);
    if (!t) {
      e.preventDefault();
      return;
    }

    this.lastTouchEventAt = Date.now();

    const { pixelX, pixelY } = this.touchToPixelXY(t);
    this.input.updateMousePosition(pixelX, pixelY);
    this.input.applySyntheticEvent({ type: 'mouse_move', x: pixelX, y: pixelY });

    if (this.handleFreeFlyLeftDragMove(pixelX, pixelY)) {
      e.preventDefault();
      return;
    }

    if (this.worldsInlineWidgetInstances.length > 0) {
      this.handleWorldsInlineWidgetMouse(pixelX, pixelY, this.input.isMouseDown(0));
    }

    // Section-bound retained GUI (worlds-aware hit testing).
    this.handleWorldsSectionBoundGUIMouse(pixelX, pixelY, this.input.isMouseDown(0));

    let dispatchedToDoc = false;
    if (doc?.handlers?.input) {
      const charWidth = this.canvas.width / this.width;
      const charHeight = this.canvas.height / this.height;
      const cellX = Math.floor(pixelX / charWidth);
      const cellY = Math.floor(pixelY / charHeight);

      const event: InputEvent = {
        type: 'mouse_move',
        x: pixelX,
        y: pixelY,
        cellX,
        cellY,
        mods: []
      };

      this.inputDispatchDepth++;
      try {
        const shouldContinue = doc.handlers.input(event);
        if (shouldContinue === false) this.stop();
      } catch (error) {
        console.error('Error in input handler:', error);
      } finally {
        this.inputDispatchDepth = Math.max(0, this.inputDispatchDepth - 1);
      }

      dispatchedToDoc = true;
    }

    if (this.worldsEnabled || dispatchedToDoc) e.preventDefault();
  }

  private handleTouchEvent(e: TouchEvent, action: 'press' | 'release'): void {
    if (this.hostAudienceView) {
      e.preventDefault();
      return;
    }

    if (action === 'release' && (!e.touches || e.touches.length < 3)) {
      this.resetWorldsMultiTouchRotate();
    }
    if (action === 'release' && (!e.touches || e.touches.length < 2)) {
      this.resetWorldsPinchZoom();
    }

    const isGesturePress = action === 'press';
    if (isGesturePress) this.beginTrustedAudioGesture();

    try {
      const doc = this.getActiveDocument();
      const t = (e.changedTouches && e.changedTouches.length)
        ? e.changedTouches[0]
        : ((e.touches && e.touches.length) ? e.touches[0] : null);
      if (!t) {
        e.preventDefault();
        return;
      }

      this.lastTouchEventAt = Date.now();

      const { pixelX, pixelY } = this.touchToPixelXY(t);
      this.input.updateMousePosition(pixelX, pixelY);

      // ── Double-tap background reset ─────────────────────────────────────────
      if (
        action === 'press' &&
        this.worldsEnabled &&
        this.worldsConfig.doubleTapResetEnabled &&
        this.camera3D &&
        !this.isPointOverVisibleGUIWidget(pixelX, pixelY)
      ) {
        const now = Date.now();
        const dist = Math.hypot(pixelX - this.doubleTapLastX, pixelY - this.doubleTapLastY);
        const isDoubleTap = now - this.doubleTapLastTime < 400 && dist < 60;
        this.doubleTapLastTime = now;
        this.doubleTapLastX = pixelX;
        this.doubleTapLastY = pixelY;
        if (isDoubleTap) {
          const picked = this.pick3DAt(pixelX, pixelY);
          if (!picked) {
            const currentIdx = this.current3DSectionIndex;
            const resetRot = this.worldsConfig.doubleTapResetRotation;
            if (resetRot) {
              this.camera3D.rotation.x = resetRot.x;
              this.camera3D.rotation.y = resetRot.y;
              this.camera3D.rotation.z = resetRot.z;
              this.camera3D.targetRotation = null;
            }
            this.camera3D.target = null;
            if (typeof currentIdx === 'number' && currentIdx >= 0) {
              const lastFocus = (this as any).lastApplied3DCameraFocus;
              const fill = lastFocus?.kind === 'fit' ? lastFocus.fill : 0.9;
              this.request3DCameraFocus({ kind: 'fit', sectionIndex: currentIdx, fill, keepRotation: true });
            }
            this.doubleTapLastTime = 0; // prevent triple-tap re-triggering
            e.preventDefault();
            return;
          }
        }
      }
      // ── End double-tap background reset ────────────────────────────────────

      if (this.worldsControlsEnabled) {
        this.input.applySyntheticEvent({ type: 'mouse', action, button: 'left', x: pixelX, y: pixelY });
        if (action === 'press') {
          if (this.startFreeFlyLeftDrag(pixelX, pixelY)) {
            e.preventDefault();
            return;
          }
        } else if (this.stopFreeFlyLeftDrag()) {
          e.preventDefault();
          return;
        }
      }

      const inlineWidgetConsumed = this.handleWorldsInlineWidgetMouse(pixelX, pixelY, action === 'press');

      const overlayGUIConsumed = this.handleOverlayRetainedGUIMouse(pixelX, pixelY, action === 'press');

      const sectionGuiConsumed = this.handleWorldsSectionBoundGUIMouse(pixelX, pixelY, action === 'press');

      this.input.applySyntheticEvent({ type: 'mouse', action, button: 'left', x: pixelX, y: pixelY });

      let handledBy3D = false;
      if (!this.worldsControlsEnabled && !inlineWidgetConsumed && !overlayGUIConsumed && !sectionGuiConsumed && action === 'press') {
        const picked = this.pick3DAt(pixelX, pixelY);
        if (picked && this.camera3D) {
          const linkHit = this.hitTest3DLinkAtUV(picked.layout.sectionIndex, picked.u, picked.v);
          if (linkHit) {
            handledBy3D = true;
            this.focused3DLink = {
              sectionId: picked.layout.sectionId,
              sectionIndex: picked.layout.sectionIndex,
              linkIndex: linkHit.linkIndex,
            };
            this.activate3DLink(
              linkHit.region,
              picked.layout.sectionId,
              picked.layout.sectionIndex,
              linkHit.linkIndex,
            );
          } else if (this.worldsConfig.sectionClickFocusEnabled !== false) {
            handledBy3D = true;
            const style = this.lastApplied3DCameraFocus;
            const fill = style?.kind === 'fit' ? style.fill : 0.9;
            const styleOptions = style && style.kind !== 'frame'
              ? {
                  ...(style.keepRotation ? { keepRotation: true } : {}),
                  ...(style.positionOffset ? { positionOffset: style.positionOffset } : {}),
                  ...(style.rotationOffset ? { rotationOffset: style.rotationOffset } : {}),
                }
              : {};
            this.request3DCameraFocus({
              kind: 'fit',
              sectionIndex: picked.layout.sectionIndex,
              fill,
              ...styleOptions,
            });
          }
        }
      }

      let dispatchedToDoc = false;
      if (doc?.handlers?.input) {
        const charWidth = this.canvas.width / this.width;
        const charHeight = this.canvas.height / this.height;
        const cellX = Math.floor(pixelX / charWidth);
        const cellY = Math.floor(pixelY / charHeight);

        const event: InputEvent = {
          type: 'mouse',
          action,
          button: 'left',
          x: pixelX,
          y: pixelY,
          cellX,
          cellY,
          mods: []
        };

        this.inputDispatchDepth++;
        try {
          const shouldContinue = doc.handlers.input(event);
          if (shouldContinue === false) this.stop();
        } catch (error) {
          console.error('Error in input handler:', error);
        } finally {
          this.inputDispatchDepth = Math.max(0, this.inputDispatchDepth - 1);
        }

        dispatchedToDoc = true;
      }

      if (handledBy3D || dispatchedToDoc || this.worldsEnabled) e.preventDefault();

      this.syncHiddenTextInputBridge(action === 'press');
    } finally {
      if (isGesturePress) this.endTrustedAudioGesture();
    }
  }

  private isTruthyDropTarget(value: any): boolean {
    if (value === true) return true;
    if (value === false || value === null || value === undefined) return false;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const v = value.trim().toLowerCase();
      return v === 'true' || v === 'yes' || v === '1' || v === 'on';
    }
    return !!value;
  }

  /**
   * Returns true if the active document opts into generic file drops.
   * Uses frontmatter `dropTarget: true` (tStorie parity).
   */
  isDropTargetEnabled(): boolean {
    const doc = this.getActiveDocument();
    if (!doc) return false;

    // Prefer parsed frontmatter captured at load time when available.
    const fromDoc = (doc as any).metadata?.dropTarget;
    if (fromDoc !== undefined) return this.isTruthyDropTarget(fromDoc);

    // Fallback: read from the persistent scope (frontmatter is seeded into scope).
    const scope = this.sandbox.getScope(doc.id);
    return this.isTruthyDropTarget((scope as any)?.dropTarget);
  }

  private isMarkdownFile(file: File): boolean {
    const name = String(file?.name ?? '').toLowerCase();
    const type = String((file as any)?.type ?? '').toLowerCase();
    if (name.endsWith('.md') || name.endsWith('.markdown')) return true;
    if (type.includes('text/markdown')) return true;
    return false;
  }

  private dispatchDroppedFile(payload: DroppedFile): void {
    this.lastDroppedFile = payload;

    const doc = this.getActiveDocument();
    if (!doc?.handlers?.drop) return;

    try {
      doc.handlers.drop(payload);
    } catch (error) {
      console.error('Error in drop handler:', error);
    }
  }

  private async handleDroppedFile(file: File): Promise<void> {
    if (!file) return;

    if (Number.isFinite(this.maxDropBytes) && file.size > this.maxDropBytes) {
      console.warn(
        `[drop] Ignoring dropped file "${file.name}" (${file.size} bytes) over maxDropBytes=${this.maxDropBytes}`
      );
      return;
    }

    if (!this.isDropTargetEnabled()) {
      // Default behavior: dropped markdown loads as a new story.
      if (this.isMarkdownFile(file)) {
        const markdown = await file.text();
        await this.loadMarkdown(file.name || 'dropped.md', markdown);
      }
      return;
    }

    // Pass-through behavior: apps/demos opt in and receive raw bytes.
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    const payload: DroppedFile = {
      name: file.name || 'dropped',
      size: bytes.byteLength,
      mime: file.type || 'application/octet-stream',
      bytes,
      lastModified: (file as any).lastModified
    };
    this.dispatchDroppedFile(payload);
  }

  private async handleDropEvent(e: DragEvent): Promise<void> {
    const dt = e.dataTransfer;
    if (!dt) return;

    const files = dt.files;
    if (files && files.length > 0) {
      await this.handleDroppedFile(files[0]);
      return;
    }

    // Text drops (e.g. dragging a selection) follow default behavior.
    const text = dt.getData('text/markdown') || dt.getData('text/plain');
    if (text && !this.isDropTargetEnabled()) {
      await this.loadMarkdown('dropped', text);
    }
  }

  /**
   * Install DOM drag/drop listeners.
   * Behavior:
   * - If active doc has `dropTarget: true`: pass dropped files to `on:drop` / `scope.drop`.
   * - Otherwise: dropped markdown loads as a new story.
   */
  installDropHandling(element: HTMLElement = document.body): () => void {
    if (this.dropHandlingCleanup) return this.dropHandlingCleanup;

    const prevent = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onDragOver = (e: DragEvent) => {
      prevent(e);
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onDrop = (e: DragEvent) => {
      prevent(e);
      void this.handleDropEvent(e);
    };

    element.addEventListener('dragenter', prevent);
    element.addEventListener('dragover', onDragOver);
    element.addEventListener('dragleave', prevent);
    element.addEventListener('drop', onDrop);

    const cleanup = () => {
      element.removeEventListener('dragenter', prevent);
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', prevent);
      element.removeEventListener('drop', onDrop);
      if (this.dropHandlingCleanup === cleanup) this.dropHandlingCleanup = null;
    };

    this.dropHandlingCleanup = cleanup;
    return cleanup;
  }

  /**
   * Handle keyboard events for on:input
   */
  private handleKeyEvent(e: KeyboardEvent, action: 'press' | 'release'): void {
    if (this.hostAudienceView) {
      // Audience/client view: avoid accidental browser scrolling/navigation.
      const k = e.key;
      if (
        k === ' ' ||
        k === 'Tab' ||
        k === 'Enter' ||
        k === 'ArrowUp' ||
        k === 'ArrowDown' ||
        k === 'ArrowLeft' ||
        k === 'ArrowRight' ||
        k === 'PageUp' ||
        k === 'PageDown' ||
        k === 'Home' ||
        k === 'End'
      ) {
        e.preventDefault();
      }
      return;
    }

    const isGesturePress = action === 'press';
    if (isGesturePress) this.beginTrustedAudioGesture();

    try {
      const doc = this.getActiveDocument();

      const inlineWidgetHandled = action === 'press'
        ? this.handleWorldsInlineWidgetKey(e.key, {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
          })
        : false;
      const overlayGUIHandled = action === 'press' && !inlineWidgetHandled
        ? this.handleOverlayRetainedGUIKey(e.key, {
            shift: e.shiftKey,
            ctrl: e.ctrlKey,
            alt: e.altKey,
            meta: e.metaKey,
          })
        : false;

      // Built-in 3D link navigation (canvas.nim parity)
      let handledBy3D = false;
      if (
        !inlineWidgetHandled &&
        !overlayGUIHandled &&
        action === 'press' &&
        this.worldsEnabled &&
        this.camera3D &&
        this.worldsLinkKeyHandlingEnabled
      ) {
        if (e.key === 'Tab') {
          this.move3DLinkFocus(e.shiftKey ? -1 : 1);
          handledBy3D = true;
        } else if (e.key === 'Enter') {
          this.activateFocused3DLink();
          handledBy3D = true;
        } else if ((this.worldsConfig as any).sectionArrowNavigation) {
          // Slide / presentation mode: arrows navigate between sections.
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            this.navigateWorldsSection(1);
            handledBy3D = true;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            this.navigateWorldsSection(-1);
            handledBy3D = true;
          }
        } else {
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            this.move3DLinkFocus(1);
            handledBy3D = true;
          } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            this.move3DLinkFocus(-1);
            handledBy3D = true;
          }
        }
      }

      if (doc?.handlers?.input) {
        // Build modifiers array
        const mods: string[] = [];
        if (e.shiftKey) mods.push('shift');
        if (e.ctrlKey) mods.push('ctrl');
        if (e.altKey) mods.push('alt');
        if (e.metaKey) mods.push('meta');

        // Dispatch keydown/keyup events (TStorie convention)
        const event: InputEvent = {
          type: action === 'press' ? 'keydown' : 'keyup',
          key: e.key,
          keyCode: e.keyCode,
          mods
        };

        this.inputDispatchDepth++;
        try {
          const shouldContinue = doc.handlers.input(event);
          // Only stop if handler explicitly returns false (undefined = continue)
          if (shouldContinue === false) {
            this.stop();
          }
        } catch (error) {
          console.error('Error in input handler:', error);
        } finally {
          this.inputDispatchDepth = Math.max(0, this.inputDispatchDepth - 1);
        }
      }

      if (handledBy3D || inlineWidgetHandled || overlayGUIHandled || doc?.handlers?.input) {
        e.preventDefault();
      }

      this.syncHiddenTextInputBridge(action === 'press');
    } finally {
      if (isGesturePress) this.endTrustedAudioGesture();
    }
  }

  /**
   * Handle mouse button events for on:input
   */
  private handleMouseEvent(e: MouseEvent, action: 'press' | 'release'): void {
    if (Date.now() - this.lastTouchEventAt < 750) {
      e.preventDefault();
      return;
    }

    if (this.hostAudienceView) {
      // Audience/client view: display-only.
      e.preventDefault();
      return;
    }

    const isGesturePress = action === 'press';
    if (isGesturePress) this.beginTrustedAudioGesture();

    try {
      const doc = this.getActiveDocument();
      const rect = this.canvas.getBoundingClientRect();

      // Get CSS coordinates
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Scale to canvas backing store coordinates (handles HiDPI/CSS scaling)
      const pixelX = cssX * (this.canvas.width / rect.width);
      const pixelY = cssY * (this.canvas.height / rect.height);

      // Update InputManager's mouse position so mouseX/mouseY globals reflect click position
      this.input.updateMousePosition(pixelX, pixelY);

      const buttonName = e.button === 1 ? 'middle' : e.button === 2 ? 'right' : 'left';

      if (e.button === 0 && this.worldsControlsEnabled) {
        this.input.applySyntheticEvent({
          type: 'mouse',
          action,
          button: buttonName,
          x: pixelX,
          y: pixelY,
        });

        if (action === 'press') {
          if (this.startFreeFlyLeftDrag(pixelX, pixelY)) {
            e.preventDefault();
            this.syncHiddenTextInputBridge(false);
            return;
          }
        } else if (this.stopFreeFlyLeftDrag()) {
          e.preventDefault();
          this.syncHiddenTextInputBridge(false);
          return;
        }
      }

      if (e.button === 1) {
        this.input.applySyntheticEvent({
          type: 'mouse',
          action,
          button: buttonName,
          x: pixelX,
          y: pixelY,
        });

        if (action === 'press') {
          const startedOverGUI = this.isPointOverVisibleGUIWidget(pixelX, pixelY);
          const startedOverCard = !!this.pick3DAt(pixelX, pixelY);
          if (this.worldsEnabled && this.camera3D && !startedOverGUI && !startedOverCard) {
            this.middlePanActive = true;
            this.middlePanLastX = pixelX;
            this.middlePanLastY = pixelY;
            e.preventDefault();
            this.syncHiddenTextInputBridge(false);
            return;
          }
        } else if (this.middlePanActive) {
          this.middlePanActive = false;
          e.preventDefault();
          this.syncHiddenTextInputBridge(false);
          return;
        }
      }

      const inlineWidgetConsumed = e.button === 0
        ? this.handleWorldsInlineWidgetMouse(pixelX, pixelY, action === 'press')
        : false;
      const overlayGUIConsumed = e.button === 0 && !inlineWidgetConsumed
        ? this.handleOverlayRetainedGUIMouse(pixelX, pixelY, action === 'press')
        : false;

      // Built-in 3D picking/navigation: click a section card to focus camera.
      // This runs even if the document doesn't define an on:input handler.
      if (!this.worldsControlsEnabled && !inlineWidgetConsumed && !overlayGUIConsumed && action === 'press' && e.button === 0) {
        const picked = this.pick3DAt(pixelX, pixelY);
        if (picked && this.camera3D) {
          const linkHit = this.hitTest3DLinkAtUV(picked.layout.sectionIndex, picked.u, picked.v);
          if (linkHit) {
            this.focused3DLink = {
              sectionId: picked.layout.sectionId,
              sectionIndex: picked.layout.sectionIndex,
              linkIndex: linkHit.linkIndex,
            };
            this.activate3DLink(
              linkHit.region,
              picked.layout.sectionId,
              picked.layout.sectionIndex,
              linkHit.linkIndex,
            );
          } else if (this.worldsConfig.sectionClickFocusEnabled !== false) {
            // Preserve the caller's preferred focus style and zoom (fill).
            // This makes demo-defined camera framing “sticky” across navigation.
            const style = this.lastApplied3DCameraFocus;
            const fill = style?.kind === 'fit' ? style.fill : 0.9;
            const styleOptions = style && style.kind !== 'frame'
              ? {
                  ...(style.keepRotation ? { keepRotation: true } : {}),
                  ...(style.positionOffset ? { positionOffset: style.positionOffset } : {}),
                  ...(style.rotationOffset ? { rotationOffset: style.rotationOffset } : {}),
                }
              : {};
            this.request3DCameraFocus({
              kind: 'fit',
              sectionIndex: picked.layout.sectionIndex,
              fill,
              ...styleOptions,
            });
          }
        }
      }

      // Keep InputManager button state in sync for mouse.down()/clicked().
      this.input.applySyntheticEvent({
        type: 'mouse',
        action,
        button: buttonName,
        x: pixelX,
        y: pixelY,
      });

      if (doc?.handlers?.input) {
        const charWidth = this.canvas.width / this.width;
        const charHeight = this.canvas.height / this.height;
        const cellX = Math.floor(pixelX / charWidth);
        const cellY = Math.floor(pixelY / charHeight);

        const event: InputEvent = {
          type: 'mouse',
          action,
          button: buttonName,
          x: pixelX,
          y: pixelY,
          cellX,
          cellY,
          mods: []
        };

        this.inputDispatchDepth++;
        try {
          const shouldContinue = doc.handlers.input(event);
          if (shouldContinue === false) this.stop();
        } catch (error) {
          console.error('Error in input handler:', error);
        } finally {
          this.inputDispatchDepth = Math.max(0, this.inputDispatchDepth - 1);
        }
      }

      e.preventDefault();
      this.syncHiddenTextInputBridge(action === 'press');
    } finally {
      if (isGesturePress) this.endTrustedAudioGesture();
    }
  }

  private pick3DAt(
    pixelX: number,
    pixelY: number
  ): { layout: Section3DLayout; u: number; v: number } | null {
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return null;
    if (!this.camera3D) return null;

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return null;

    const ndcX = (pixelX / canvasW) * 2 - 1;
    const ndcY = 1 - (pixelY / canvasH) * 2;

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);
    const invViewProj = mat4Invert(viewProj);
    if (!invViewProj) return null;

    // Build a world-space ray from NDC.
    const nearWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: -1 });
    const farWorld = mat4TransformPoint(invViewProj, { x: ndcX, y: ndcY, z: 1 });
    const rayDirWorld = vec3Normalize(vec3Sub(farWorld, nearWorld));

    let best: { layout: Section3DLayout; dist: number; u: number; v: number } | null = null;

    for (const layout of this.section3DLayouts) {
      if (!layout.visible || !layout.texture || layout.interactive === false) continue;

      const baseW = layout.worldWidth ?? (layout.width * this.get3DCardXScaleFactor(layout));
      const baseH = layout.worldHeight ?? layout.height;

      // Match renderer's model matrix: apply width/height into scale.
      const sectionTransform = {
        position: layout.transform.position,
        rotation: layout.transform.rotation,
        scale: {
          x: layout.transform.scale.x * baseW,
          y: layout.transform.scale.y * baseH,
          z: layout.transform.scale.z,
        },
      };

      const model = mat4FromTransform(sectionTransform as any);
      const invModel = mat4Invert(model);
      if (!invModel) continue;

      const rayOriginLocal = mat4TransformPoint(invModel, nearWorld);
      const rayDirLocal = vec3Normalize(mat4TransformDirection(invModel, rayDirWorld));

      const denom = rayDirLocal.z;
      if (Math.abs(denom) < 1e-6) continue;

      const t = -rayOriginLocal.z / denom;
      if (t <= 0) continue;

      const hitLocal = vec3Add(rayOriginLocal, vec3Scale(rayDirLocal, t));

      // Quad in local space spans [-0.5, 0.5] in X and Y.
      if (hitLocal.x < -0.5 || hitLocal.x > 0.5 || hitLocal.y < -0.5 || hitLocal.y > 0.5) {
        continue;
      }

      // Map local hit point to UVs.
      // Local (-0.5,-0.5) => UV(0,1); Local (-0.5,0.5) => UV(0,0)
      const u = hitLocal.x + 0.5;
      const v = 0.5 - hitLocal.y;

      const hitWorld = mat4TransformPoint(model, hitLocal);
      const dist = vec3Length(vec3Sub(hitWorld, nearWorld));
      if (!best || dist < best.dist) {
        best = { layout, dist, u, v };
      }
    }

    return best ? { layout: best.layout, u: best.u, v: best.v } : null;
  }

  private hitTest3DLinkAtUV(
    sectionIndex: number,
    u: number,
    v: number
  ): { linkIndex: number; region: LinkRegion } | null {
    const sectionKey = this.getSectionCacheKey(sectionIndex);
    if (!sectionKey) return null;
    const dims = this.sectionTextureCache.get(sectionKey);
    const regions = this.sectionLinkRegionsCache.get(sectionKey);
    if (!dims || !regions || regions.length === 0) return null;

    const xPx = u * dims.width;
    const yPx = v * dims.height;

    for (let i = 0; i < regions.length; i++) {
      const r = regions[i];
      if (xPx >= r.x && xPx <= r.x + r.w && yPx >= r.y && yPx <= r.y + r.h) {
        return { linkIndex: i, region: r };
      }
    }
    return null;
  }

  private getActive3DLink(): { sectionIndex: number; linkIndex: number } | null {
    if (this.hovered3DLink) {
      return this.hovered3DLink;
    }
    return this.focused3DLink;
  }

  private getWorldsListMarker(): string | null | undefined {
    const marker = this.worldsConfig.sectionListMarker;
    if (marker === undefined) return undefined;
    if (marker === null) return null;
    return String(marker);
  }

  private getWorldsListMarkerGapPx(): number | undefined {
    const value = this.worldsConfig.sectionListMarkerGapPx;
    return Number.isFinite(value as any) ? Math.max(0, Number(value)) : undefined;
  }

  private getWorldsListHangIndentPx(): number | undefined {
    const value = this.worldsConfig.sectionListHangIndentPx;
    return Number.isFinite(value as any) ? Math.max(0, Number(value)) : undefined;
  }

  private activateFocused3DLink(): void {
    const focused = this.focused3DLink;
    if (!focused) return;
    const sectionKey = focused.sectionId;
    let regions: LinkRegion[] | null | undefined = null;
    if (sectionKey) {
      regions = this.sectionLinkRegionsCache.get(sectionKey);
    }
    const region = regions ? regions[focused.linkIndex] : undefined;
    if (!region) return;
    this.activate3DLink(region, focused.sectionId, focused.sectionIndex, focused.linkIndex);
  }

  private move3DLinkFocus(delta: number): void {
    const links = this.getVisible3DLinks();
    if (links.length === 0) {
      this.focused3DLink = null;
      return;
    }

    const cur = this.focused3DLink;
    let idx = -1;
    if (cur) {
      idx = links.findIndex(l => l.sectionId === cur.sectionId && l.linkIndex === cur.linkIndex);
    }

    const next = ((idx >= 0 ? idx : 0) + delta + links.length) % links.length;
    const sel = links[next];
    this.focused3DLink = {
      sectionId: sel.sectionId,
      sectionIndex: sel.sectionIndex,
      linkIndex: sel.linkIndex,
    };
  }

  private navigateWorldsSection(delta: 1 | -1): void {
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;

    // Build an ordered list of navigable sections.
    // Include sections that are currently visible OR that are hidden-until-visited
    // (navigating to them is what reveals them). Exclude hard-hidden sections and
    // permanently removed ones.
    const candidates = this.section3DLayouts.filter(
      (l) => l && l.navigable
        && !this.worldsRemovedSectionIds.has(l.sectionId)
        && (l.visible !== false || l.hiddenUntilVisited === true)
    );
    if (candidates.length === 0) return;

    const currentIdx = this.getResolvedCurrent3DSectionIndex();
    let pos = -1;
    if (currentIdx !== null && Number.isFinite(currentIdx)) {
      pos = candidates.findIndex((l) => l.sectionIndex === currentIdx);
    }

    let nextPos = 0;
    if (pos < 0) {
      if (delta > 0) {
        nextPos = 0;
      } else {
        nextPos = candidates.length - 1;
      }
    } else {
      nextPos = Math.max(0, Math.min(candidates.length - 1, pos + delta));
    }

    const target = candidates[nextPos];
    if (!target) return;

    // Reuse the same focus mode (fit vs distance) as the last applied focus,
    // forwarding only the section-independent options (keepRotation, straighten).
    const last = this.lastApplied3DCameraFocus;
    if (last && last.kind === 'focus') {
      const focusRequest: any = {
        kind: 'focus',
        sectionIndex: target.sectionIndex,
        distance: last.distance,
      };
      if (last.keepRotation) {
        focusRequest.keepRotation = true;
      }
      if (last.straighten) {
        focusRequest.straighten = true;
      }
      this.request3DCameraFocus(focusRequest);
    } else {
      let fill = 0.9;
      if (last && last.kind === 'fit') {
        fill = last.fill;
      }
      const fitRequest: any = {
        kind: 'fit',
        sectionIndex: target.sectionIndex,
        fill,
      };
      if (last && last.kind === 'fit' && last.keepRotation) {
        fitRequest.keepRotation = true;
      }
      if (last && last.kind === 'fit' && last.straighten) {
        fitRequest.straighten = true;
      }
      this.request3DCameraFocus(fitRequest);
    }
  }

  private activate3DLink(
    link: string | LinkRegion,
    sectionId?: string | null,
    sectionIndex?: number | null,
    linkIndex?: number | null,
  ): void {
    const url = typeof link === 'string' ? link : link.url;
    if (!url) return;

    const text = typeof link === 'string' ? null : (typeof link.text === 'string' ? link.text : null);
    const title = typeof link === 'string' ? null : (typeof link.title === 'string' ? link.title : null);
    const meta = typeof link === 'string' ? null : (link.meta ? { ...link.meta } : null);
    const relation = typeof meta?.rel === 'string' && meta.rel.trim()
      ? meta.rel.trim()
      : (title && title.trim() ? title.trim() : null);

    this.activated3DLinksQueue.push({
      url,
      text,
      title,
      meta,
      relation,
      sectionId: typeof sectionId === 'string' && sectionId ? sectionId : null,
      sectionIndex: typeof sectionIndex === 'number' ? sectionIndex : null,
      linkIndex: typeof linkIndex === 'number' ? linkIndex : null,
    });
    if (this.activated3DLinksQueue.length > 32) {
      this.activated3DLinksQueue.splice(0, this.activated3DLinksQueue.length - 32);
    }

    // Internal link: #anchor
    if (url.startsWith('#')) {
      const layout = this.resolveWorldsInternalLinkTarget(url);

      if (layout) {
        // Use the engine focus request path so fill/options stay sticky and we
        // don't accidentally reset camera framing or rotation.
        const style = this.lastApplied3DCameraFocus;
        let fill = 0.9;
        const focusRequest: any = {
          kind: 'fit',
          sectionIndex: layout.sectionIndex,
          fill,
        };
        if (style && style.kind === 'fit') {
          fill = style.fill;
          focusRequest.fill = fill;
        }
        if (style && style.kind !== 'frame') {
          if (style.keepRotation) {
            focusRequest.keepRotation = true;
          }
          if (style.positionOffset) {
            focusRequest.positionOffset = style.positionOffset;
          }
          if (style.rotationOffset) {
            focusRequest.rotationOffset = style.rotationOffset;
          }
        }
        this.request3DCameraFocus(focusRequest);
      }
      return;
    }

    // External link
    if (url.startsWith('http://') || url.startsWith('https://')) {
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch {
        // ignore
      }
    }
  }

  private get3DCardModelMatrix(layout: Section3DLayout): Float32Array {
    const baseW = layout.worldWidth ?? (layout.width * this.get3DCardXScaleFactor(layout));
    const baseH = layout.worldHeight ?? layout.height;
    const sectionTransform = {
      position: layout.transform.position,
      rotation: layout.transform.rotation,
      scale: {
        x: layout.transform.scale.x * baseW,
        y: layout.transform.scale.y * baseH,
        z: layout.transform.scale.z,
      },
    };
    return mat4FromTransform(sectionTransform as any);
  }

  private get3DCardWorldCorners(layout: Section3DLayout): Array<{ x: number; y: number; z: number }> {
    const model = this.get3DCardModelMatrix(layout);
    const corners = [
      { x: -0.5, y: -0.5, z: 0 },
      { x: 0.5, y: -0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
      { x: -0.5, y: 0.5, z: 0 },
    ];
    return corners.map((corner) => mat4TransformPoint(model, corner as any));
  }

  private getCameraBasisFromRotation(rotation: { x: number; y: number; z: number }): {
    forward: { x: number; y: number; z: number };
    right: { x: number; y: number; z: number };
    up: { x: number; y: number; z: number };
  } {
    const forward = vec3Normalize({
      x: Math.sin(rotation.y) * Math.cos(rotation.x),
      y: -Math.sin(rotation.x),
      z: -Math.cos(rotation.y) * Math.cos(rotation.x),
    });

    const worldUp = Math.abs(forward.y) > 0.98
      ? { x: 0, y: 0, z: 1 }
      : { x: 0, y: 1, z: 0 };

    let right = vec3Normalize(vec3Cross(forward as any, worldUp as any));
    if (vec3Length(right as any) <= 1e-8) {
      right = { x: 1, y: 0, z: 0 };
    }

    let up = vec3Normalize(vec3Cross(right as any, forward as any));
    if (vec3Length(up as any) <= 1e-8) {
      up = { x: 0, y: 1, z: 0 };
    }

    const roll = Number.isFinite(rotation.z) ? rotation.z : 0;
    if (Math.abs(roll) > 1e-8) {
      const c = Math.cos(roll);
      const s = Math.sin(roll);
      const rolledRight = vec3Add(vec3Scale(right as any, c), vec3Scale(up as any, s));
      const rolledUp = vec3Add(vec3Scale(up as any, c), vec3Scale(right as any, -s));
      right = vec3Normalize(rolledRight as any);
      up = vec3Normalize(rolledUp as any);
    }

    return { forward, right, up };
  }

  private getWorldsFocusRecenterOptions(keepRotation: boolean): { screenSpaceRecenter?: boolean; screenSpaceRecenterIters?: number } {
    const options: { screenSpaceRecenter?: boolean; screenSpaceRecenterIters?: number } = {};
    if (!keepRotation) {
      return options;
    }

    const cfg: any = this.worldsConfig as any;
    const hasDefaultRecenter = (cfg as any).screenSpaceRecenter !== undefined;
    if (!hasDefaultRecenter) {
      return options;
    }

    const defaultRecenter = !!cfg.screenSpaceRecenter;
    options.screenSpaceRecenter = defaultRecenter;
    if (defaultRecenter) {
      const defaultRecenterIters = Number.isFinite(cfg.screenSpaceRecenterIters) ? cfg.screenSpaceRecenterIters : 5;
      options.screenSpaceRecenterIters = defaultRecenterIters;
    }

    return options;
  }

  private resolve3DCameraFrameLayouts(
    sectionSelectors?: Array<number | string>,
    includeHidden: boolean = false,
    includeNonNavigable: boolean = true,
  ): Section3DLayout[] {
    const seen = new Set<string>();
    const pushLayout = (layout: Section3DLayout | null, acc: Section3DLayout[]) => {
      if (!layout) return;
      if (seen.has(layout.sectionId)) return;
      seen.add(layout.sectionId);
      acc.push(layout);
    };

    const layouts: Section3DLayout[] = [];

    if (Array.isArray(sectionSelectors) && sectionSelectors.length > 0) {
      for (const selector of sectionSelectors) {
        pushLayout(this.getSectionLayoutByIndex(this.resolve3DSectionIndex(selector as any)), layouts);
      }
      return layouts;
    }

    for (const layout of this.section3DLayouts) {
      if (!layout) continue;
      if (!includeHidden && layout.visible === false) continue;
      if (!includeNonNavigable && layout.navigable === false) continue;
      pushLayout(layout, layouts);
    }

    return layouts;
  }

  private request3DCameraFrame(req: {
    sectionSelectors?: Array<number | string>;
    includeHidden?: boolean;
    includeNonNavigable?: boolean;
    fill: number;
    padding: number;
    rotation?: { x: number; y: number; z: number };
  }): void {
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) {
      this.pending3DCameraFocus = { kind: 'frame', ...req };
      return;
    }

    if (!this.camera3D) return;

    const layouts = this.resolve3DCameraFrameLayouts(
      req.sectionSelectors,
      !!req.includeHidden,
      req.includeNonNavigable !== false,
    );
    if (layouts.length === 0) return;

    for (const layout of layouts) {
      this.premeasure3DCardWorldSize(layout);
    }
    this.reflowWorldsAutoLayout();

    const fallbackRotation = this.camera3D ? this.camera3D.rotation : { x: 0, y: 0, z: 0 };
    const rawRotation = req.rotation;
    const rotationX = Number(rawRotation?.x);
    const rotationY = Number(rawRotation?.y);
    const rotationZ = Number(rawRotation?.z);
    const rotation = {
      x: Number.isFinite(rotationX) ? rotationX : fallbackRotation.x,
      y: Number.isFinite(rotationY) ? rotationY : fallbackRotation.y,
      z: Number.isFinite(rotationZ) ? rotationZ : fallbackRotation.z,
    };

    const points: Array<{ x: number; y: number; z: number }> = [];
    for (const layout of layouts) {
      points.push(...this.get3DCardWorldCorners(layout));
    }
    if (points.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (const point of points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      minZ = Math.min(minZ, point.z);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
      maxZ = Math.max(maxZ, point.z);
    }
    if (![minX, minY, minZ, maxX, maxY, maxZ].every(Number.isFinite)) return;

    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
      z: (minZ + maxZ) / 2,
    };

    const basis = this.getCameraBasisFromRotation(rotation);
    let fill = 0.9;
    if (Number.isFinite(req.fill)) {
      fill = req.fill;
    }
    const safeFill = Math.max(0.05, Math.min(0.99, fill));

    let padding = 0;
    if (Number.isFinite(req.padding)) {
      padding = Math.max(0, req.padding);
    }

    let aspect = 1;
    if (this.canvas.width > 0 && this.canvas.height > 0) {
      aspect = this.canvas.width / this.canvas.height;
    }
    const vFov = this.camera3D.fov;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * Math.max(1e-6, aspect));
    const halfPad = padding / 2;

    let distance = 1;
    for (const point of points) {
      const rel = vec3Sub(point as any, center as any);
      const xCam = vec3Dot(rel as any, basis.right as any);
      const yCam = vec3Dot(rel as any, basis.up as any);
      const zCam = vec3Dot(rel as any, basis.forward as any);
      distance = Math.max(distance, -zCam + 1);
      distance = Math.max(distance, ((Math.abs(xCam) + halfPad) / (Math.tan(hFov / 2) * safeFill)) - zCam);
      distance = Math.max(distance, ((Math.abs(yCam) + halfPad) / (Math.tan(vFov / 2) * safeFill)) - zCam);
    }

    const target = vec3Sub(center as any, vec3Scale(basis.forward as any, distance));

    // Expand the far clip automatically for wide scene framing. Worlds' default
    // far plane (1000) is fine for per-card focus but too small for large,
    // impress.js-like canvases viewed from a bird's-eye vantage point.
    let requiredFar = 1;
    for (const point of points) {
      const camToPoint = vec3Sub(point as any, target as any);
      const depth = vec3Dot(camToPoint as any, basis.forward as any);
      if (Number.isFinite(depth)) {
        requiredFar = Math.max(requiredFar, depth);
      }
    }
    this.camera3D.far = Math.max(this.camera3D.far, requiredFar + Math.max(100, padding));

    setCameraTarget(this.camera3D, target as any, rotation as any);

    this.lastApplied3DCameraFocus = {
      kind: 'frame',
      sectionIds: layouts.map((layout) => layout.sectionId),
      fill: safeFill,
      padding,
      rotation,
    };
  }

  private request3DCameraFocus(
    req:
      | {
          kind: 'focus';
          sectionIndex: number | string;
          distance: number;
          keepRotation?: boolean;
          positionOffset?: { x: number; y: number; z: number };
          rotationOffset?: { x: number; y: number; z: number };
        }
      | {
          kind: 'fit';
          sectionIndex: number | string;
          fill: number;
          keepRotation?: boolean;
          positionOffset?: { x: number; y: number; z: number };
          rotationOffset?: { x: number; y: number; z: number };
        }
      | {
          kind: 'frame';
          sectionSelectors?: Array<number | string>;
          includeHidden?: boolean;
          includeNonNavigable?: boolean;
          fill: number;
          padding: number;
          rotation?: { x: number; y: number; z: number };
        }
  ): void {
    if (req.kind === 'frame') {
      this.request3DCameraFrame(req);
      return;
    }

    // If layouts aren’t ready yet (common during on:init), remember the intent
    // and apply it once parsing/layout generation completes.
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) {
      this.pending3DCameraFocus = req;
      return;
    }

    if (!this.camera3D) return;

    const idx = this.resolve3DSectionIndex(req.sectionIndex);
    if (idx === null) {
      console.warn(`Section "${String(req.sectionIndex)}" not found`);
      return;
    }
    const layout = this.section3DLayouts[idx];
    if (!layout) {
      console.warn(`Section ${String(req.sectionIndex)} not found`);
      return;
    }

    // If we're fitting a section before textures exist (common in on:init),
    // `layout.worldWidth/worldHeight` will be unset. In that case
    // focusOnSectionFit() would fall back to `layout.width/height`, which are
    // in *text units* (legacy) or *pixels* (sectionSizeUnits='px') and are not
    // reliable world dimensions. Pre-measure the card size so fit behavior is
    // stable and content-aware immediately.
    if (req.kind === 'fit') {
      this.premeasure3DCardWorldSize(layout);
      // If this section is auto-positioned, its position may depend on card
      // world size (stepX/stepY). Reflow now so camera centering uses the
      // stable, size-aware position.
      this.reflowWorldsAutoLayout();
    }

    const cfg: any = this.worldsConfig as any;
    const defaultKeepRotation = !!cfg.keepRotation;
    const defaultStraighten = !!cfg.straightenOnFocus;
    let keepRotation = defaultKeepRotation;
    if ((req as any).keepRotation !== undefined) {
      keepRotation = !!(req as any).keepRotation;
    }
    let straighten = defaultStraighten;
    if ((req as any).straighten !== undefined) {
      straighten = !!(req as any).straighten;
    }
    const recenterOpts = this.getWorldsFocusRecenterOptions(keepRotation);

    // Remember last applied focus (use resolved numeric section index).
    if (req.kind === 'focus') {
      const lastApplied: any = {
        kind: 'focus',
        sectionId: layout.sectionId,
        sectionIndex: layout.sectionIndex,
        distance: req.distance,
      };
      if (keepRotation) {
        lastApplied.keepRotation = true;
      }
      if (straighten) {
        lastApplied.straighten = true;
      }
      if (req.positionOffset) {
        lastApplied.positionOffset = req.positionOffset;
      }
      if (req.rotationOffset) {
        lastApplied.rotationOffset = req.rotationOffset;
      }
      this.lastApplied3DCameraFocus = lastApplied;
    } else if (req.kind === 'fit') {
      const lastApplied: any = {
        kind: 'fit',
        sectionId: layout.sectionId,
        sectionIndex: layout.sectionIndex,
        fill: req.fill,
      };
      if (keepRotation) {
        lastApplied.keepRotation = true;
      }
      if (straighten) {
        lastApplied.straighten = true;
      }
      if (req.positionOffset) {
        lastApplied.positionOffset = req.positionOffset;
      }
      if (req.rotationOffset) {
        lastApplied.rotationOffset = req.rotationOffset;
      }
      this.lastApplied3DCameraFocus = lastApplied;
    }

    // Now that lastApplied is updated, navigation + host sync can use the
    // correct fill/distance.
    this.setCurrent3DSection(layout.sectionIndex);

    if (req.kind === 'focus') {
      focusOnSection(this.camera3D, layout, req.distance, {
        ...(keepRotation ? { keepRotation: true } : {}),
        ...(straighten ? { straighten: true } : {}),
        ...(req.positionOffset ? { positionOffset: req.positionOffset } : {}),
        ...(req.rotationOffset ? { rotationOffset: req.rotationOffset } : {}),
        ...recenterOpts,
      });
    } else {
      const aspect = this.canvas.width > 0 && this.canvas.height > 0
        ? this.canvas.width / this.canvas.height
        : 1;
      focusOnSectionFit(this.camera3D, layout, aspect, req.fill, {}, {
        ...(keepRotation ? { keepRotation: true } : {}),
        ...(straighten ? { straighten: true } : {}),
        ...(req.positionOffset ? { positionOffset: req.positionOffset } : {}),
        ...(req.rotationOffset ? { rotationOffset: req.rotationOffset } : {}),
        ...recenterOpts,
      });
    }
  }

  private premeasure3DCardWorldSize(layout: Section3DLayout): void {
    // If we already have pixel-derived world size, don't stomp it.
    if (layout.worldWidth && layout.worldHeight) return;

    const uiDocumentPack = this.getUIDocumentPack();
    if (!uiDocumentPack) {
      this.requestUIDocumentPack();
      return;
    }

    const texturePadding = 12;

    const units = (this.worldsConfig as any).sectionSizeUnits === 'px' ? 'px' : 'text';
    const overflowCfg = (this.worldsConfig as any).sectionOverflow;
    const overflowMode: 'clip' | 'expand' | 'expand-y' | 'fit' | 'fit-y' =
      (overflowCfg === 'expand' || overflowCfg === 'expand-y' || overflowCfg === 'fit' || overflowCfg === 'fit-y')
        ? overflowCfg
        : 'clip';

    // Derive markdown content to measure.
    const contentOverride = this.getWorldsSectionContentOverride(layout.sectionId);
    const markdown = buildWorldsCardMarkdown(layout, contentOverride ?? undefined);
    const nodes = uiDocumentPack.parseMarkdownLite(markdown);

    // We intentionally mimic the sizing logic in ensure3DSectionTextures*() as
    // closely as possible, but without requiring a GPU device.
    const textureMode = (this.worldsConfig as any).sectionTextureMode;

    // Defaults shared by both render paths.
    const minW = 256;
    const minH = 128;
    const textureScale = this.getWorldsTextureScale();
    const maxTextureW = textureMode === 'webgpu-ui' ? 1024 : 2048;
    const maxTextureH = textureMode === 'webgpu-ui' ? 1024 : 2048;
    const maxW = Math.max(minW, Math.floor(maxTextureW / textureScale));
    const maxH = Math.max(minH, Math.floor(maxTextureH / textureScale));

    // Theme-derived style (colors don't affect layout, but keep it consistent).
    const proceduralRuledPaper = this.isWorldsSectionBackgroundProceduralChainEnabled();
    const bakedRuledPaper = this.isWorldsSectionBackgroundBakedRuledLines();
    const shaderBg = !!this.parseWorldsSectionBackgroundShader();
    const textureBg = !!this.parseWorldsSectionBackgroundTexture();
    const surfaceBg = this.resolveWorldsSectionBackground();
    const mdBg = (proceduralRuledPaper || bakedRuledPaper || shaderBg || textureBg) ? this.withAlpha(surfaceBg, 0) : surfaceBg;
    const mdStyle = this.createWorldsMarkdownStyle({ background: mdBg, foreground: this.resolveWorldsSectionForeground() ?? undefined });

    // Measure in logical CSS pixels; the runtime render path applies DPR only
    // when rasterizing the final card texture.
    const fontSizePx = Math.max(1, this.fontSize || 16);
    const fontStack =
      this.worldsCardFontStack ||
      this.fontFamily ||
      "'3270-regular', 'Consolas', 'Monaco', monospace";

    const measured = this.measureFontMetrics(fontStack, fontSizePx);
    const measuredCharW = Math.max(1, measured.charW);
    const measuredCharH = Math.max(1, measured.charH);
    const baseLineHeight = Math.max(1, measured.baseLineHeight);

    // Start from the declared card dimensions.
    let widthPx = Math.max(
      minW,
      Math.min(
        maxW,
        units === 'px'
          ? Math.round(layout.width + texturePadding * 2)
          : Math.round(layout.width * measuredCharW + texturePadding * 2)
      )
    );
    let heightPx = Math.max(
      minH,
      Math.min(
        maxH,
        units === 'px'
          ? Math.round(layout.height + texturePadding * 2)
          : Math.round(layout.height * baseLineHeight + texturePadding * 2)
      )
    );

    // For fit/expand modes, measure required size from content.
    if (overflowMode !== 'clip') {
      // In 'fit' mode, allow the probe to use the max width so we can shrink
      // based on the natural content width.
      const probeWidthPx = overflowMode === 'fit' ? maxW : widthPx;

      // Measurement context for proportional font widths (Canvas2D path).
      const measureCtx = (() => {
        if (!this.worldsCardFontStack) return null;
        try {
          const c = document.createElement('canvas');
          c.width = 16;
          c.height = 16;
          const ctx = c.getContext('2d', { alpha: true } as any) as CanvasRenderingContext2D | null;
          if (!ctx) return null;
          ctx.textBaseline = 'top';
          ctx.textAlign = 'left';
          ctx.font = `${fontSizePx}px ${fontStack}`;
          return ctx;
        } catch {
          return null;
        }
      })();

      const measureTextWidth = this.worldsCardFontStack && measureCtx
        ? (text: string) => measureCtx.measureText(text).width
        : undefined;

      const probe = uiDocumentPack.layoutMarkdownDocument(
        nodes,
        { x: 0, y: 0, width: probeWidthPx, height: heightPx },
        {
          charW: measuredCharW,
          charH: measuredCharH,
          measureTextWidth,
          getImageSize: (source: string) => this.getMarkdownImageSize(source, this.activeDocumentId ?? undefined),
        },
        mdStyle,
        0,
        texturePadding,
        { overflow: 'expand' }
      );

      const reqW = Math.ceil(probe.contentWidth + texturePadding * 2);
      const reqH = Math.ceil(probe.contentHeight + texturePadding * 2);
      const clampedW = Math.max(minW, Math.min(maxW, reqW));
      const clampedH = Math.max(minH, Math.min(maxH, reqH));

      if (overflowMode === 'expand') {
        widthPx = Math.max(widthPx, clampedW);
        heightPx = Math.max(heightPx, clampedH);
      } else if (overflowMode === 'expand-y') {
        heightPx = Math.max(heightPx, clampedH);
      } else if (overflowMode === 'fit') {
        widthPx = clampedW;
        heightPx = clampedH;
      } else if (overflowMode === 'fit-y') {
        heightPx = clampedH;
      }
    }

    // Convert pixel size to world size using the same pixels-per-world-unit
    // convention as the runtime texture generation code.
    this.set3DLayoutWorldSizeFromPixels(layout, widthPx, heightPx, baseLineHeight);
  }

  private refocus3DForCurrentViewport(): void {
    if (!this.worldsEnabled || !this.camera3D) return;
    if (!this.lastApplied3DCameraFocus) return;

    if (this.lastApplied3DCameraFocus.kind === 'frame') {
      this.request3DCameraFrame({
        sectionSelectors: this.lastApplied3DCameraFocus.sectionIds,
        fill: this.lastApplied3DCameraFocus.fill,
        padding: this.lastApplied3DCameraFocus.padding,
        rotation: this.lastApplied3DCameraFocus.rotation,
        includeHidden: true,
        includeNonNavigable: true,
      });
      return;
    }

    const lastFocus = this.lastApplied3DCameraFocus;

    let layout = this.getSectionLayoutById(lastFocus.sectionId);
    if (!layout) {
      layout = this.section3DLayouts.find(l => l.sectionIndex === lastFocus.sectionIndex) ?? null;
    }
    if (!layout) return;

    if (lastFocus.kind === 'focus') {
      const recenterOpts = this.getWorldsFocusRecenterOptions(!!lastFocus.keepRotation);
      focusOnSection(this.camera3D, layout, lastFocus.distance, {
        ...(lastFocus.keepRotation ? { keepRotation: true } : {}),
        ...(lastFocus.straighten ? { straighten: true } : {}),
        ...(lastFocus.positionOffset ? { positionOffset: lastFocus.positionOffset } : {}),
        ...(lastFocus.rotationOffset ? { rotationOffset: lastFocus.rotationOffset } : {}),
        ...recenterOpts,
      });
    } else {
      let aspect = 1;
      if (this.canvas.width > 0 && this.canvas.height > 0) {
        aspect = this.canvas.width / this.canvas.height;
      }
      const recenterOpts = this.getWorldsFocusRecenterOptions(!!lastFocus.keepRotation);
      focusOnSectionFit(this.camera3D, layout, aspect, lastFocus.fill, {}, {
        ...(lastFocus.keepRotation ? { keepRotation: true } : {}),
        ...(lastFocus.straighten ? { straighten: true } : {}),
        ...(lastFocus.positionOffset ? { positionOffset: lastFocus.positionOffset } : {}),
        ...(lastFocus.rotationOffset ? { rotationOffset: lastFocus.rotationOffset } : {}),
        ...recenterOpts,
      });
    }
  }

  private applyPending3DCameraFocus(): void {
    if (!this.pending3DCameraFocus) return;
    const req = this.pending3DCameraFocus;
    this.pending3DCameraFocus = null;
    this.request3DCameraFocus(req);
  }

  private setCurrent3DSection(sectionIndex: number, options?: { navigationSideEffects?: boolean }): void {
    const nextLayout = this.getSectionLayoutByIndex(sectionIndex);
    if (!nextLayout) return;
    this.setSelected3DSection(sectionIndex);
    if (this.current3DSectionId === nextLayout.sectionId) {
      this.current3DSectionIndex = nextLayout.sectionIndex;
      return;
    }
    const navigationSideEffects = options?.navigationSideEffects !== false;
    const previousSectionIndex = this.getResolvedCurrent3DSectionIndex();
    let previousLayout: Section3DLayout | null = null;
    if (typeof previousSectionIndex === 'number' && Number.isFinite(previousSectionIndex)) {
      previousLayout = this.getSectionLayoutByIndex(previousSectionIndex);
    }
    this.clearWorldsInlineWidgets();

    // Leaving a section: optionally remove it after the first visit.
    if (previousLayout && previousLayout.removeAfterVisit) {
      this.worldsRemovedSectionIds.add(previousLayout.sectionId);
      previousLayout.visible = false;
    }

    // Entering a section: reveal hidden-until-visited sections.
    if (nextLayout.hiddenUntilVisited) {
      this.worldsVisitedSectionIds.add(nextLayout.sectionId);
      if (!this.worldsRemovedSectionIds.has(nextLayout.sectionId)) {
        nextLayout.visible = true;
      }
    }

    this.current3DSectionId = nextLayout.sectionId;
    this.current3DSectionIndex = nextLayout.sectionIndex;

    if (typeof previousSectionIndex === 'number' && Number.isFinite(previousSectionIndex)) {
      this.invalidate3DSectionTexture(previousSectionIndex);
    }
    this.invalidate3DSectionTexture(nextLayout.sectionIndex);

    const guiAPI = this.api?.gui as any;
    if (guiAPI && typeof guiAPI.syncSectionBindings === 'function') {
      guiAPI.syncSectionBindings(nextLayout.sectionIndex);
    }

    // Shared scene state: new section => reset reveal step.
    if (navigationSideEffects) {
      this.sceneState.sectionIndex = nextLayout.sectionIndex;
      this.sceneState.revealStep = 0;
    }

    // Host: broadcast section changes.
    // Keep this narrowly scoped to navigation only (no arbitrary messaging).
    const h = this.hostSync;
    if (navigationSideEffects && h && h.getSessionInfo().role === 'host') {
      let fill = 0.9;
      if (this.lastApplied3DCameraFocus?.kind === 'fit') {
        fill = this.lastApplied3DCameraFocus.fill;
      }
      h.sendGotoSectionFit(nextLayout.sectionIndex, fill);
      h.sendSceneFit(nextLayout.sectionIndex, this.sceneState.revealStep, fill);
    }

    if (navigationSideEffects) {
      this.runSectionEnterHandlers(nextLayout.sectionIndex);
    }

    if (guiAPI && typeof guiAPI.syncSectionBindings === 'function') {
      guiAPI.syncSectionBindings(nextLayout.sectionIndex);
    }

    this.syncWorldsInlineWidgets();
  }

  private runSectionEnterHandlers(sectionIndex: number): void {
    const doc = this.getActiveDocument() as any;
    if (!doc?.id) return;

    // Record enter time for relative animate blocks.
    const layout = this.section3DLayouts.find(l => l.sectionIndex === sectionIndex);
    if (layout?.sectionId) {
      this.sectionAnimEnterTimes.set(layout.sectionId, this.elapsedTime);
    }

    const scope = this.sandbox.getScope(doc.id) as any;
    const handler = scope?.__enterHandlers?.[sectionIndex];
    if (typeof handler !== 'function') return;

    try {
      handler();
    } catch (error) {
      console.error('Error in on:enter handler:', error);
    }
  }

  private resolve3DSectionIndex(selector: number | string): number | null {
    if (typeof selector === 'number' && Number.isFinite(selector)) {
      return selector;
    }
    return this.resolveRuntimeSectionRef(selector)?.sectionIndex ?? null;
  }

  private getOutlineNodes(): OutlineNode[] {
    const d = this.getActiveDocument();
    if (!d) return [];
    if (this.outlineCache && this.outlineCache.documentId === d.id) return this.outlineCache.nodes;

    const nodes: OutlineNode[] = [];

    const walk = (section: any, parentIndex: number | null) => {
      const idx = nodes.length;
      const node: OutlineNode = {
        index: idx,
        title: String(section?.title ?? ''),
        level: Number(section?.level ?? 1),
        parentIndex,
        firstChildIndex: null,
        lastDescendantIndex: idx,
      };
      nodes.push(node);

      const children: any[] = Array.isArray(section?.children) ? section.children : [];
      if (children.length > 0) {
        node.firstChildIndex = nodes.length;
        for (const child of children) {
          walk(child, idx);
        }
      }

      node.lastDescendantIndex = nodes.length - 1;
    };

    const roots = this.getReadableSectionRoots();
    for (const s of roots) {
      walk(s, null);
    }

    this.outlineCache = { documentId: d.id, nodes };
    return nodes;
  }

  private findSectionIndexForLine(sections: any[], line: number): number | null {
    // Mirrors createSection3DLayouts() traversal order and returns the deepest
    // section that contains the given line.
    let sectionIndex = 0;
    let best: number | null = null;

    const visit = (list: any[]) => {
      for (const s of list) {
        const idx = sectionIndex;
        sectionIndex++;

        if (typeof s.startLine === 'number' && typeof s.endLine === 'number') {
          if (line >= s.startLine && line <= s.endLine) {
            best = idx;
            if (Array.isArray(s.children) && s.children.length > 0) {
              visit(s.children);
            }
          }
        }

        // If not in this section, still need to advance over children indices
        // (since createSection3DLayouts includes them).
        if (!(line >= s.startLine && line <= s.endLine)) {
          if (Array.isArray(s.children) && s.children.length > 0) {
            visit(s.children);
          }
        }
      }
    };

    visit(sections);
    return best;
  }

  private applyWorldsLayoutCallback(sections?: any[]): void {
    if (!this.worldsLayoutCallback) return;
    if (!this.section3DLayouts || this.section3DLayouts.length === 0) return;

    const order: any[] = [];
    const walk = (list: any[]) => {
      for (const s of list) {
        order.push(s);
        if (Array.isArray(s.children) && s.children.length > 0) walk(s.children);
      }
    };

    const runtimeSections = this.runtimeSectionStore.sections;
    const doc = sections
      ? { sections }
      : (runtimeSections.length > 0
          ? { sections: runtimeSections }
          : ((this.getActiveDocument() as any)?.sections ? { sections: (this.getActiveDocument() as any).sections } : null));
    if (!doc?.sections) return;
    walk(doc.sections);

    for (let i = 0; i < Math.min(order.length, this.section3DLayouts.length); i++) {
      const layout = this.section3DLayouts[i];
      if (!layout) continue;

      try {
        const out = this.worldsLayoutCallback({
          sectionIndex: layout.sectionIndex,
          title: String(layout.displayTitle || layout.sectionTitle || ''),
          layout,
        });

        if (!out) continue;

        if (out.position) {
          layout.transform.position = { ...out.position };
          layout.autoPositioned = false;
        }
        if (out.rotation) {
          // Callback rotation is degrees (matches setSectionTransform API)
          layout.transform.rotation = {
            x: (out.rotation.x * Math.PI) / 180,
            y: (out.rotation.y * Math.PI) / 180,
            z: (out.rotation.z * Math.PI) / 180,
          };
        }
        if (out.scale) {
          layout.transform.scale = { ...out.scale };
        }
        if (typeof out.width === 'number') layout.width = out.width;
        if (typeof out.height === 'number') layout.height = out.height;
        if (typeof out.opacity === 'number' && Number.isFinite(out.opacity)) {
          layout.opacity = Math.max(0, Math.min(1, out.opacity));
        }
        if (typeof out.visible === 'boolean') layout.visible = out.visible;
        if (typeof out.navigable === 'boolean') layout.navigable = out.navigable;
        if (typeof out.interactive === 'boolean') layout.interactive = out.interactive;
      } catch (error) {
        console.error('[worlds.layout] callback error:', error);
      }
    }

    // Layout changes imply textures may need to be regenerated at different sizes.
    // Keep it simple: clear texture cache so cards re-rasterize on demand.
    this.clear3DSectionTextures();

    // If the callback only partially specified positions, keep the remaining
    // auto-laid-out cards non-overlapping.
    this.reflowWorldsAutoLayout();
  }

  private is3DCardPossiblyVisible(viewProj: Float32Array, layout: Section3DLayout): boolean {
    const model = this.get3DCardModelMatrix(layout);

    const corners = [
      { x: -0.5, y: -0.5, z: 0 },
      { x: 0.5, y: -0.5, z: 0 },
      { x: 0.5, y: 0.5, z: 0 },
      { x: -0.5, y: 0.5, z: 0 },
    ];

    const clips = corners.map(c => {
      const world = mat4TransformPoint(model, c);
      return mat4TransformVec4(viewProj, world.x, world.y, world.z, 1);
    });

    const all = (pred: (p: { x: number; y: number; z: number; w: number }) => boolean) => clips.every(pred);
    if (all(p => p.x < -p.w)) return false; // left
    if (all(p => p.x > p.w)) return false; // right
    if (all(p => p.y < -p.w)) return false; // bottom
    if (all(p => p.y > p.w)) return false; // top
    // WebGPU NDC z is [0, 1] after divide; clip test is [0, w]
    if (all(p => p.z < 0)) return false; // near
    if (all(p => p.z > p.w)) return false; // far
    return true;
  }

  private getVisible3DLinks(): Array<{
    sectionId: string;
    sectionIndex: number;
    linkIndex: number;
    region: LinkRegion;
    screenX: number;
    screenY: number;
  }> {
    if (!this.worldsEnabled || !this.camera3D) return [];

    const canvasW = this.canvas.width;
    const canvasH = this.canvas.height;
    if (canvasW <= 0 || canvasH <= 0) return [];

    const aspect = canvasW / canvasH;
    const view = getCameraViewMatrix(this.camera3D);
    const proj = getCameraProjectionMatrix(this.camera3D, aspect);
    const viewProj = mat4Multiply(proj, view);

    const out: Array<{
      sectionId: string;
      sectionIndex: number;
      linkIndex: number;
      region: LinkRegion;
      screenX: number;
      screenY: number;
    }> = [];

    for (const layout of this.section3DLayouts) {
      if (!layout.visible || !layout.texture || layout.interactive === false) continue;
      if (!this.is3DCardPossiblyVisible(viewProj, layout)) continue;

      const dims = this.sectionTextureCache.get(layout.sectionId);
      const regions = this.sectionLinkRegionsCache.get(layout.sectionId);
      if (!dims || !regions || regions.length === 0) continue;

      const model = this.get3DCardModelMatrix(layout);

      for (let i = 0; i < regions.length; i++) {
        const r = regions[i];
        const u = (r.x + r.w * 0.5) / dims.width;
        const v = (r.y + r.h * 0.5) / dims.height;
        const xLocal = u - 0.5;
        const yLocal = 0.5 - v;

        const world = mat4TransformPoint(model, { x: xLocal, y: yLocal, z: 0 });
        const clip = mat4TransformVec4(viewProj, world.x, world.y, world.z, 1);
        if (clip.w <= 1e-6) continue;

        const ndcX = clip.x / clip.w;
        const ndcY = clip.y / clip.w;
        // Keep only links whose center is within screen bounds.
        if (ndcX < -1 || ndcX > 1 || ndcY < -1 || ndcY > 1) continue;

        const screenX = (ndcX * 0.5 + 0.5) * canvasW;
        const screenY = (1 - (ndcY * 0.5 + 0.5)) * canvasH;
        out.push({
          sectionId: layout.sectionId,
          sectionIndex: layout.sectionIndex,
          linkIndex: i,
          region: r,
          screenX,
          screenY,
        });
      }
    }

    out.sort((a, b) => (a.screenY - b.screenY) || (a.screenX - b.screenX));
    return out;
  }

  /**
   * Handle mouse move events for on:input
   */
  private handleMouseMoveEvent(e: MouseEvent): void {
    if (Date.now() - this.lastTouchEventAt < 750) {
      e.preventDefault();
      return;
    }

    if (this.hostAudienceView) return;

    const rect = this.canvas.getBoundingClientRect();
    
    // Get CSS coordinates
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;
    
    // Scale to canvas backing store coordinates (handles HiDPI/CSS scaling)
    const pixelX = cssX * (this.canvas.width / rect.width);
    const pixelY = cssY * (this.canvas.height / rect.height);
    
    // Update InputManager's mouse position for mouseX/mouseY globals
    this.input.updateMousePosition(pixelX, pixelY);

    if (this.handleFreeFlyLeftDragMove(pixelX, pixelY)) {
      e.preventDefault();
      return;
    }

    if (this.middlePanActive && this.handleWorldsMiddlePanMove(pixelX, pixelY)) {
      e.preventDefault();
      return;
    }

    if (this.worldsInlineWidgetInstances.length > 0) {
      this.handleWorldsInlineWidgetMouse(pixelX, pixelY, this.input.isMouseDown(0));
    }

    const overlayGUIConsumed = this.handleOverlayRetainedGUIMouse(pixelX, pixelY, this.input.isMouseDown(0));

    const doc = this.getActiveDocument();
    if (!doc?.handlers?.input) {
      if (this.worldsEnabled || overlayGUIConsumed) e.preventDefault();
      return;
    }
    
    // Calculate character size in backing store pixels (same coordinate system as pixelX/pixelY)
    const charWidth = this.canvas.width / this.width;
    const charHeight = this.canvas.height / this.height;
    const cellX = Math.floor(pixelX / charWidth);
    const cellY = Math.floor(pixelY / charHeight);

    const event: InputEvent = {
      type: 'mouse_move',
      x: pixelX,     // Pixel coordinates (primary)
      y: pixelY,
      cellX,         // Cell coordinates (for TUI)
      cellY,
      mods: []
    };

    try {
      const shouldContinue = doc.handlers.input(event);
      // Only stop if handler explicitly returns false (undefined = continue)
      if (shouldContinue === false) {
        this.stop();
      }
    } catch (error) {
      console.error('Error in input handler:', error);
    }

    if (this.worldsEnabled || overlayGUIConsumed) e.preventDefault();
  }

  private handleWheelEvent(e: WheelEvent): void {
    if (Date.now() - this.lastTouchEventAt < 750) {
      e.preventDefault();
      return;
    }

    if (this.hostAudienceView) {
      e.preventDefault();
      return;
    }

    if (this.handleWorldsWheelEvent(e)) {
      e.preventDefault();
    }
  }
  
  /**
   * Dispose of engine resources
   */
  dispose(): void {
    console.log('Disposing engine resources');
    this.stop();
    this.moduleLoader.dispose();
    this.documents.clear();
    this.activeDocumentId = null;
    this.worldsSectionContentOverridesByDocument.clear();
    
    // Clean up native API resources
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(err => {
        console.warn('Error closing AudioContext:', err);
      });
    }
    
    // Remove Canvas 2D overlay from DOM
    if (this.offscreenCanvas2D && this.offscreenCanvas2D.parentElement) {
      this.offscreenCanvas2D.parentElement.removeChild(this.offscreenCanvas2D);
    }

    if (this.hiddenTextInput && this.hiddenTextInput.parentElement) {
      this.hiddenTextInput.parentElement.removeChild(this.hiddenTextInput);
      this.hiddenTextInput = null;
    }

    if (this.safeAreaProbeElement && this.safeAreaProbeElement.parentElement) {
      this.safeAreaProbeElement.parentElement.removeChild(this.safeAreaProbeElement);
    }
    this.safeAreaProbeElement = null;
  }
  
  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  /**
   * Get the WebGPU device (if using WebGPU renderer)
   * For module sharing
   */
  getWebGPUDevice(): GPUDevice | null {
    if (this.renderer instanceof WebGPURenderer && 'getDevice' in this.renderer) {
      return (this.renderer as any).getDevice() || null;
    }
    return null;
  }
  
  /**
   * Get module loader for advanced use
   */
  getModuleLoader(): ModuleLoader {
    return this.moduleLoader;
  }

  /**
   * Return the most recently dropped file (the last file the user dragged onto
   * the engine). Used by the export panel as a fallback audio source when the
   * document code doesn't call captureForExport().
   */
  getLastDroppedFile(): { bytes: Uint8Array; mime: string; name: string } | null {
    const dropped = this.lastDroppedFile;
    if (!dropped) return null;
    return {
      bytes: dropped.bytes,
      mime:  String(dropped.mime  ?? ''),
      name:  String(dropped.name  ?? ''),
    };
  }

  /** Last error thrown by a user-supplied update/render handler, or null. */
  private _lastUserHandlerError: { handler: string; error: unknown } | null = null;

  /**
   * Called internally when an update or render handler throws.
   * Stores the error so the export panel can surface it in the progress UI.
   */
  private recordUserHandlerError(handler: string, error: unknown): void {
    this._lastUserHandlerError = { handler, error };
  }

  /** Read (but do not clear) the last user handler error. */
  getLastUserHandlerError(): { handler: string; error: unknown } | null {
    return this._lastUserHandlerError;
  }

  /** Clear any stored user handler error (call before starting an export). */
  clearLastUserHandlerError(): void {
    this._lastUserHandlerError = null;
  }

  /** Return all available built-in theme names. */
  getThemeNames(): string[] {
    return Object.keys(THEMES);
  }

  /** Return the current theme name (e.g. 'neotopia'). */
  getThemeName(): string {
    return this.currentThemeLabel;
  }

  /** Switch to a named built-in theme at runtime. No-op for unknown names. */
  setTheme(name: string): void {
    const key = String(name ?? '').trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(THEMES, key)) return;
    this.applyThemeColors(getTheme(key), key, 'runtime');
  }
}
