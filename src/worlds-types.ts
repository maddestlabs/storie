/**
 * Type definitions for Worlds (3D) system
 */

import type { Color } from './types.js';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Transform3D {
  position: Vec3;
  rotation: Vec3; // Euler angles in radians (x, y, z)
  scale: Vec3;
}

export interface Camera3D {
  position: Vec3;
  rotation: Vec3;
  target: Vec3 | null; // If set, camera will ease towards this
  targetRotation?: Vec3 | null; // If set, camera will ease rotation towards this
  fov: number; // Field of view in radians
  near: number;
  far: number;

  // Easing parameters
  positionEaseSpeed: number; // 0-1, higher = faster
  rotationEaseSpeed: number; // 0-1, higher = faster

  /**
   * Derived pose used for rendering/picking after applying view-only effects
   * (e.g. shake). Base `position/rotation` remain authoritative.
   */
  effectivePosition?: Vec3;
  effectiveRotation?: Vec3;

  /** Optional handheld-style camera shake (view-only additive offsets). */
  shake?: CameraShakeConfig;
  /** Internal per-camera shake integrator state. */
  _shakeState?: CameraShakeState;
}

export interface CameraShakeConfig {
  enabled: boolean;
  /** Overall shake intensity multiplier (0..2 typical). */
  strength: number;
  /** Seed to decorrelate runs; any finite number. */
  seed: number;
  /** Translation amplitudes in world units, in camera-local axes. */
  translate: Vec3;
  /** Rotation amplitudes in radians. Note: current camera view ignores roll (z). */
  rotate: Vec3;
  /** Base time rate for the noise (higher = faster shake). */
  rate: number;
}

export interface CameraShakeState {
  time: number;
  pos: Vec3;
  posVel: Vec3;
  rot: Vec3;
  rotVel: Vec3;
}

export interface Section3DLayout {
  sectionIndex: number;
  sectionTitle: string;
  displayTitle: string;
  content: string;
  transform: Transform3D;
  /** True when x/y was assigned by Worlds auto-layout (no explicit metadata). */
  autoPositioned?: boolean;
  width: number;
  height: number;
  /**
   * Optional pixel-derived world dimensions for this card.
   *
   * When present, render/picking/camera-fit should prefer these over
   * `width/height` so proportional fonts and font-size changes don't distort
   * card sizing.
   */
  worldWidth?: number;
  worldHeight?: number;
  texture: GPUTexture | null; // Rendered section content
  /** Optional UV rect (0..1) to highlight (e.g. hovered/focused link). */
  highlightUvRect?: { uMin: number; vMin: number; uMax: number; vMax: number };
  visible: boolean;
  navigable: boolean;
}

export interface WorldsConfig {
  defaultDepth: number;
  defaultSectionWidth: number;
  defaultSectionHeight: number;

  /**
   * Units for `defaultSectionWidth/defaultSectionHeight` and per-section
   * `width/height` metadata.
   *
   * - 'text': width/height are logical columns/rows (legacy/default)
   * - 'px': width/height are pixels (content box size; padding is added)
   */
  sectionSizeUnits?: 'text' | 'px';

  /**
   * Overflow behavior when rendering section content into card textures.
   * - 'clip' (default): render into fixed-size card; content beyond bounds is clipped
    * - 'expand': grow the card texture (within GPU limits) to fit all content
    * - 'expand-y': grow card height only (keep width fixed)
    * - 'fit': resize the card to tightly fit content (shrink or grow, within GPU limits)
    * - 'fit-y': resize card height to fit content (shrink or grow; keep width fixed)
   */
    sectionOverflow?: 'clip' | 'expand' | 'expand-y' | 'fit' | 'fit-y';

  /**
   * Alignment of rendered markdown content inside the card texture.
   * - 'start' (default): content begins at the top-left padding
   * - 'center': centers the content block within the card
   */
  sectionContentAlign?: 'start' | 'center';
  cameraFov: number;
  cameraNear: number;
  cameraFar: number;
  positionEaseSpeed: number;
  rotationEaseSpeed: number;

  /**
   * Optional default focus style: if true, focus helpers keep camera rotation.
   * (Can be overridden per-call via focus options.)
   */
  keepRotation?: boolean;

  /**
    * When focusing a section, apply camera roll so the focused section appears
    * upright on screen.
    *
    * Note: if `keepRotation` is enabled, this keeps camera pitch/yaw locked and
    * only adjusts roll.
   */
  straightenOnFocus?: boolean;

  /**
   * When keeping rotation, optionally adjust target position so the focused
   * section is centered in screen space (helps with tilted cameras).
   */
  screenSpaceRecenter?: boolean;
  /** Iterations for recenter solver (higher = more accurate, 3-8 typical). */
  screenSpaceRecenterIters?: number;

  /**
   * Auto-layout for sections that don't specify explicit position metadata.
   * Defaults to a 3-column grid (tstorie canvas.nim-like).
   */
  autoLayoutEnabled?: boolean;
  autoLayoutColumns?: number;
  autoLayoutSpacing?: number;

  /**
   * How section textures are generated for 3D cards.
   * - canvas2d: OffscreenCanvas + copyExternalImageToTexture (simple, non-glyph-pipeline)
   * - webgpu-ui: WebGPUUIRenderer glyph pipeline rendered into per-section GPUTexture
   */
  sectionTextureMode: 'canvas2d' | 'webgpu-ui';

  /**
   * Optional border around each section card.
   * Defaults to enabled with a 2px border using the theme's `border` style.
   */
  sectionBorderEnabled?: boolean;
  sectionBorderWidth?: number;

  /**
   * Background color used when rendering each section card texture.
   *
   * Supported values:
   * - Theme key strings: 'bg', 'bgAlt', 'fg', 'fgAlt', 'accent1', 'accent2', 'accent3'
   * - Special string: 'surface' (uses the theme stylesheet's `surface.bg`)
   * - Special string: 'ruledlines' (seamless procedural ruled-paper background, computed in the 3D shader)
    * - Special string: 'paper' (seamless procedural paper grain background, computed in the 3D shader)
   * - Special chain syntax (Worlds): 'ruledlines+paper' (apply multiple procedural background layers)
   * - Special string: 'ruledlines-baked' (draws ruled-paper into the per-section texture; non-seamless across cards)
   * - Hex strings: '#RRGGBB' or '#RRGGBBAA'
   * - Packed color: 0xRRGGBBAA
   * - Legacy object: { r, g, b, a? } where a is 0..1
   */
  sectionBackground?:
    | 'surface'
    | 'ruledlines'
    | 'ruledlines-baked'
    | 'bg'
    | 'bgAlt'
    | 'fg'
    | 'fgAlt'
    | 'accent1'
    | 'accent2'
    | 'accent3'
    | string
    | Color
    | { r: number; g: number; b: number; a?: number };

  /**
   * Procedural paper grain strength for Worlds `sectionBackground` chains that
   * include `paper`. Range 0..1.
   *
   * If omitted, a default is used (slightly stronger when `paper` is used
   * without `ruledlines`).
   */
  sectionBackgroundPaperNoiseStrength?: number;

  /**
   * Whether markdown links rendered into Worlds section cards should draw an
   * underline. Defaults to false.
   */
  sectionLinkUnderline?: boolean;

  /**
   * Optional list marker string used when rendering markdown lists into Worlds
   * section cards. Examples: `'> '`, `'• '`, or `''` to hide markers.
   * When omitted, the shared markdown renderer default is used.
   */
  sectionListMarker?: string | null;

  /**
   * Optional extra gap in pixels between a rendered list marker and item text.
   */
  sectionListMarkerGapPx?: number;

  /**
   * Optional hanging indent in pixels for wrapped list lines.
   */
  sectionListHangIndentPx?: number;
}
