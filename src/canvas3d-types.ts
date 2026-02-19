/**
 * Type definitions for 3D canvas system
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
}

export interface Section3DLayout {
  sectionIndex: number;
  sectionTitle: string;
  displayTitle: string;
  content: string;
  transform: Transform3D;
  width: number;
  height: number;
  texture: GPUTexture | null; // Rendered section content
  /** Optional UV rect (0..1) to highlight (e.g. hovered/focused link). */
  highlightUvRect?: { uMin: number; vMin: number; uMax: number; vMax: number };
  visible: boolean;
  navigable: boolean;
}

export interface Canvas3DConfig {
  defaultDepth: number;
  defaultSectionWidth: number;
  defaultSectionHeight: number;
  cameraFov: number;
  cameraNear: number;
  cameraFar: number;
  positionEaseSpeed: number;
  rotationEaseSpeed: number;

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
  * - Special chain syntax (Canvas3D): 'ruledlines+paper' (apply multiple procedural background layers)
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
}
