/**
 * Worlds (3D) System for Storie
 *
 * Provides 3D positioning, rotation, and camera controls for sections.
 * Sections are rendered as textured quads in 3D space using WebGPU.
 */

import type { Section } from './types.js';
import type { Vec3, Transform3D, Camera3D, Section3DLayout, WorldsConfig } from './worlds-types.js';

// ============================================================================
// 3D Math Utilities
// ============================================================================

/**
 * Create a 3D vector
 */
export function vec3(x: number = 0, y: number = 0, z: number = 0): Vec3 {
  return { x, y, z };
}

export function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function vec3Sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function vec3Scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function vec3Dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function vec3Length(v: Vec3): number {
  return Math.sqrt(vec3Dot(v, v));
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len <= 1e-8) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function mat4TransformVec4(
  m: Float32Array,
  x: number,
  y: number,
  z: number,
  w: number
): { x: number; y: number; z: number; w: number } {
  // Column-major: out = m * v
  return {
    x: m[0] * x + m[4] * y + m[8] * z + m[12] * w,
    y: m[1] * x + m[5] * y + m[9] * z + m[13] * w,
    z: m[2] * x + m[6] * y + m[10] * z + m[14] * w,
    w: m[3] * x + m[7] * y + m[11] * z + m[15] * w,
  };
}

export function mat4TransformPoint(m: Float32Array, v: Vec3): Vec3 {
  const r = mat4TransformVec4(m, v.x, v.y, v.z, 1);
  const invW = r.w !== 0 ? 1 / r.w : 1;
  return { x: r.x * invW, y: r.y * invW, z: r.z * invW };
}

export function mat4TransformDirection(m: Float32Array, v: Vec3): Vec3 {
  const r = mat4TransformVec4(m, v.x, v.y, v.z, 0);
  return { x: r.x, y: r.y, z: r.z };
}

export function mat4Invert(a: Float32Array): Float32Array | null {
  // General 4x4 inverse (column-major). Returns null if non-invertible.
  const out = new Float32Array(16);

  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  // Calculate the determinant
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (Math.abs(det) < 1e-12) {
    return null;
  }
  det = 1.0 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;

  return out;
}

/**
 * Linear interpolation between two values
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Linear interpolation for angles (handles wrapping at 2π)
 */
export function lerpAngle(a: number, b: number, t: number): number {
  // Normalize angles to [0, 2π]
  const normalize = (angle: number) => {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  };

  a = normalize(a);
  b = normalize(b);

  // Find shortest path
  let diff = b - a;
  if (diff > Math.PI) {
    diff -= Math.PI * 2;
  } else if (diff < -Math.PI) {
    diff += Math.PI * 2;
  }

  return normalize(a + diff * t);
}

/**
 * Lerp between two 3D vectors
 */
export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t)
  };
}

/**
 * Lerp between two rotations (handles angle wrapping)
 */
export function lerpRotation(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: lerpAngle(a.x, b.x, t),
    y: lerpAngle(a.y, b.y, t),
    z: lerpAngle(a.z, b.z, t)
  };
}

/**
 * Distance between two 3D points
 */
export function distance(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Create a 4x4 identity matrix
 */
export function mat4Identity(): Float32Array {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

/**
 * Create a 4x4 perspective projection matrix
 */
export function mat4Perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
  const f = 1.0 / Math.tan(fov / 2);
  const nf = 1.0 / (near - far);

  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;

  return m;
}

/**
 * Create a 4x4 orthographic projection matrix
 */
export function mat4Ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Float32Array {
  const m = new Float32Array(16);
  m[0] = 2 / (right - left);
  m[5] = 2 / (top - bottom);
  m[10] = -2 / (far - near);
  m[12] = -(right + left) / (right - left);
  m[13] = -(top + bottom) / (top - bottom);
  m[14] = -(far + near) / (far - near);
  m[15] = 1;
  return m;
}

export function mat4Translate(x: number, y: number, z: number): Float32Array {
  const m = mat4Identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

export function mat4Scale(x: number, y: number, z: number): Float32Array {
  const m = mat4Identity();
  m[0] = x;
  m[5] = y;
  m[10] = z;
  return m;
}

export function mat4RotateX(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4Identity();
  m[5] = c;
  m[6] = s;
  m[9] = -s;
  m[10] = c;
  return m;
}

export function mat4RotateY(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4Identity();
  m[0] = c;
  m[2] = -s;
  m[8] = s;
  m[10] = c;
  return m;
}

export function mat4RotateZ(angle: number): Float32Array {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const m = mat4Identity();
  m[0] = c;
  m[1] = s;
  m[4] = -s;
  m[5] = c;
  return m;
}

export function mat4Multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      out[i + j * 4] =
        a[i] * b[j * 4] +
        a[i + 4] * b[j * 4 + 1] +
        a[i + 8] * b[j * 4 + 2] +
        a[i + 12] * b[j * 4 + 3];
    }
  }
  return out;
}

export function mat4LookAt(eye: Vec3, target: Vec3): Float32Array {
  const zAxis = vec3Normalize(vec3Sub(eye, target));
  const xAxis = vec3Normalize({ x: zAxis.z, y: 0, z: -zAxis.x });
  const yAxis = {
    x: zAxis.y * xAxis.z - zAxis.z * xAxis.y,
    y: zAxis.z * xAxis.x - zAxis.x * xAxis.z,
    z: zAxis.x * xAxis.y - zAxis.y * xAxis.x,
  };

  const m = new Float32Array(16);

  m[0] = xAxis.x;
  m[1] = yAxis.x;
  m[2] = zAxis.x;
  m[3] = 0;

  m[4] = xAxis.y;
  m[5] = yAxis.y;
  m[6] = zAxis.y;
  m[7] = 0;

  m[8] = xAxis.z;
  m[9] = yAxis.z;
  m[10] = zAxis.z;
  m[11] = 0;

  m[12] = -(xAxis.x * eye.x + xAxis.y * eye.y + xAxis.z * eye.z);
  m[13] = -(yAxis.x * eye.x + yAxis.y * eye.y + yAxis.z * eye.z);
  m[14] = -(zAxis.x * eye.x + zAxis.y * eye.y + zAxis.z * eye.z);
  m[15] = 1;

  return m;
}

/**
 * Create a model matrix from transform
 */
export function mat4FromTransform(transform: Transform3D): Float32Array {
  const translation = mat4Translate(transform.position.x, transform.position.y, transform.position.z);
  const rotationX = mat4RotateX(transform.rotation.x);
  const rotationY = mat4RotateY(transform.rotation.y);
  const rotationZ = mat4RotateZ(transform.rotation.z);
  const scale = mat4Scale(transform.scale.x, transform.scale.y, transform.scale.z);

  // Order: Scale -> Rotate Z -> Rotate Y -> Rotate X -> Translate
  let m = scale;
  m = mat4Multiply(rotationZ, m);
  m = mat4Multiply(rotationY, m);
  m = mat4Multiply(rotationX, m);
  m = mat4Multiply(translation, m);

  return m;
}

// ============================================================================
// Camera Management
// ============================================================================

/**
 * Create a new 3D camera
 */
export function createCamera3D(config: Partial<Camera3D> = {}): Camera3D {
  return {
    position: config.position || vec3(0, 0, 10),
    rotation: config.rotation || vec3(0, 0, 0),
    target: config.target || null,
    targetRotation: config.targetRotation || null,
    fov: config.fov || Math.PI / 4, // 45 degrees
    near: config.near || 0.1,
    far: config.far || 1000,
    positionEaseSpeed: config.positionEaseSpeed || 0.1,
    rotationEaseSpeed: config.rotationEaseSpeed || 0.1
  };
}

/**
 * Update camera (apply easing towards target)
 */
export function updateCamera3D(camera: Camera3D, _deltaTime: number): void {
  const hasTargetPos = !!camera.target;
  const hasTargetRot = !!camera.targetRotation;
  if (!hasTargetPos && !hasTargetRot) return;

  if (camera.target) {
    camera.position = lerpVec3(camera.position, camera.target, camera.positionEaseSpeed);
  }

  if (camera.targetRotation) {
    camera.rotation = lerpVec3(camera.rotation, camera.targetRotation, camera.rotationEaseSpeed);
  }

  const posDone = !camera.target || distance(camera.position, camera.target) < 0.01;
  const rotDone = !camera.targetRotation || distance(camera.rotation, camera.targetRotation) < 0.001;

  if (posDone && camera.target) {
    camera.position = { ...camera.target };
    camera.target = null;
  }
  if (rotDone && camera.targetRotation) {
    camera.rotation = { ...camera.targetRotation };
    camera.targetRotation = null;
  }
}

/**
 * Set camera target for smooth movement
 */
export function setCameraTarget(camera: Camera3D, target: Vec3, rotation?: Vec3): void {
  camera.target = { ...target };

  if (rotation) {
    camera.targetRotation = { ...rotation };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeYawPitchFromForward(forward: Vec3): Vec3 {
  const fx = forward.x;
  const fy = forward.y;
  const fz = forward.z;

  const yaw = Math.atan2(fx, -fz);
  const pitch = Math.asin(clamp(-fy, -1, 1));
  return { x: pitch, y: yaw, z: 0 };
}

/**
 * Focus camera on a section and frame it to approximately `fill` of the viewport.
 * This eases both camera position and rotation.
 */
export function focusOnSectionFit(
  camera: Camera3D,
  layout: Section3DLayout,
  viewportAspect: number,
  fill: number = 0.9,
  distanceLimits: { min?: number; max?: number } = {}
): void {
  const safeAspect = Number.isFinite(viewportAspect) && viewportAspect > 0 ? viewportAspect : 1;
  const safeFill = clamp(fill, 0.05, 0.99);

  const worldWidth = layout.width * (layout.transform.scale?.x ?? 1);
  const worldHeight = layout.height * (layout.transform.scale?.y ?? 1);

  const vFov = camera.fov;
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);

  const halfW = Math.max(1e-6, worldWidth / 2);
  const halfH = Math.max(1e-6, worldHeight / 2);

  const distForHeight = halfH / (Math.tan(vFov / 2) * safeFill);
  const distForWidth = halfW / (Math.tan(hFov / 2) * safeFill);
  let distance = Math.max(distForHeight, distForWidth);
  if (Number.isFinite(distanceLimits.min ?? NaN)) distance = Math.max(distance, distanceLimits.min!);
  if (Number.isFinite(distanceLimits.max ?? NaN)) distance = Math.min(distance, distanceLimits.max!);

  // Compute section normal from its rotation. Default quad normal is +Z in local space.
  const rotOnly = mat4FromTransform({
    position: { x: 0, y: 0, z: 0 },
    rotation: layout.transform.rotation,
    scale: { x: 1, y: 1, z: 1 },
  });
  const normalWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 0, z: 1 }));

  // Camera forward should point at the section center; to face the front, forward is -normal.
  const forward = vec3Scale(normalWorld, -1);
  const rotation = computeYawPitchFromForward(forward);

  const target = {
    x: layout.transform.position.x + normalWorld.x * distance,
    y: layout.transform.position.y + normalWorld.y * distance,
    z: layout.transform.position.z + normalWorld.z * distance,
  };

  setCameraTarget(camera, target, rotation);
}

/**
 * Get camera view matrix
 */
export function getCameraViewMatrix(camera: Camera3D): Float32Array {
  // Calculate look-at target based on camera position and rotation
  const forward = {
    x: Math.sin(camera.rotation.y) * Math.cos(camera.rotation.x),
    y: -Math.sin(camera.rotation.x),
    z: -Math.cos(camera.rotation.y) * Math.cos(camera.rotation.x)
  };

  const target = {
    x: camera.position.x + forward.x,
    y: camera.position.y + forward.y,
    z: camera.position.z + forward.z
  };

  return mat4LookAt(camera.position, target);
}

/**
 * Get camera projection matrix
 */
export function getCameraProjectionMatrix(camera: Camera3D, aspect: number): Float32Array {
  return mat4Perspective(camera.fov, aspect, camera.near, camera.far);
}

// ============================================================================
// Section 3D Layout
// ============================================================================

/**
 * Parse 3D transform from section metadata
 * Supports: x, y, z (or depth), width, height, rotate-x, rotate-y, rotate-z, scale
 */
export function parseTransform3D(
  section: Section,
  sectionIndex: number,
  config: WorldsConfig
): Section3DLayout {
  // Parse metadata from section title (format: # Title {"x": "10", "y": "20"})
  const metadata = parseSectionMetadata(section.title);

  const hasExplicitPosition =
    Object.prototype.hasOwnProperty.call(metadata, 'x') ||
    Object.prototype.hasOwnProperty.call(metadata, 'y') ||
    Object.prototype.hasOwnProperty.call(metadata, 'z') ||
    Object.prototype.hasOwnProperty.call(metadata, 'depth');

  // Position
  let x = parseFloat(metadata.x || '0');
  let y = parseFloat(metadata.y || '0');
  const z = parseFloat(metadata.z || metadata.depth || String(config.defaultDepth));

  // Auto-layout: 3-column grid for sections without explicit position metadata.
  const autoEnabled = config.autoLayoutEnabled !== false;
  if (autoEnabled && !hasExplicitPosition) {
    const cols = Math.max(1, Math.floor(config.autoLayoutColumns ?? 3));
    const spacing = Number.isFinite(config.autoLayoutSpacing ?? NaN) ? (config.autoLayoutSpacing as number) : 200;
    const col = sectionIndex % cols;
    const row = Math.floor(sectionIndex / cols);
    const xCenter = (cols - 1) / 2;
    x = (col - xCenter) * spacing;
    y = -row * spacing;
  }

  // Rotation (in degrees, convert to radians)
  const rotX = (parseFloat(metadata['rotate-x'] || '0') * Math.PI) / 180;
  const rotY = (parseFloat(metadata['rotate-y'] || '0') * Math.PI) / 180;
  const rotZ = (parseFloat(metadata['rotate-z'] || '0') * Math.PI) / 180;

  // Scale
  const scale = parseFloat(metadata.scale || '1');

  // Dimensions
  const width = parseFloat(metadata.width || String(config.defaultSectionWidth));
  const height = parseFloat(metadata.height || String(config.defaultSectionHeight));

  // Visibility
  const visible = metadata.hidden !== 'true';
  const navigable = metadata.navigable !== 'false';

  // For display/rendering: strip JSON metadata suffix from heading text.
  const displayTitle = section.title.replace(/\s*\{[^}]+\}\s*$/, '').trim();

  return {
    sectionIndex,
    sectionTitle: section.title,
    displayTitle,
    content: section.content,
    transform: {
      position: vec3(x, y, z),
      rotation: vec3(rotX, rotY, rotZ),
      scale: vec3(scale, scale, 1)
    },
    width,
    height,
    texture: null,
    visible,
    navigable
  };
}

/**
 * Parse JSON metadata from section title
 * Format: # Title {"key": "value", "another": true}
 */
export function parseSectionMetadata(title: string): Record<string, string> {
  const match = title.match(/\{[^}]+\}/);
  if (!match) return {};

  try {
    const jsonStr = match[0];
    const parsed = JSON.parse(jsonStr);

    // Convert all values to strings for consistent parsing
    const result: Record<string, string> = {};
    for (const key in parsed) {
      result[key] = String((parsed as any)[key]);
    }
    return result;
  } catch (e) {
    console.warn('Failed to parse section metadata:', title);
    return {};
  }
}

/**
 * Create 3D layouts for all sections
 */
export function createSection3DLayouts(
  sections: Section[],
  config: WorldsConfig
): Section3DLayout[] {
  const layouts: Section3DLayout[] = [];
  let sectionIndex = 0;

  function processSections(sectionList: Section[]) {
    for (const section of sectionList) {
      layouts.push(parseTransform3D(section, sectionIndex, config));
      sectionIndex++;

      if (section.children.length > 0) {
        processSections(section.children);
      }
    }
  }

  processSections(sections);
  return layouts;
}

/**
 * Get default Worlds config
 */
export function getDefaultWorldsConfig(): WorldsConfig {
  return {
    defaultDepth: -100, // Sections start 100 units in front of camera (negative Z)
    defaultSectionWidth: 60,
    defaultSectionHeight: 20,
    cameraFov: Math.PI / 4, // 45 degrees
    cameraNear: 0.1,
    cameraFar: 1000,
    positionEaseSpeed: 0.1,
    rotationEaseSpeed: 0.15,
    autoLayoutEnabled: true,
    autoLayoutColumns: 3,
    autoLayoutSpacing: 200,
    sectionTextureMode: 'canvas2d',
    sectionBorderEnabled: true,
    sectionBorderWidth: 2,
    // Use the theme surface by default (typically bgAlt / elevated panel color)
    sectionBackground: 'surface'
  };
}

/**
 * Focus camera on a section
 */
export function focusOnSection(
  camera: Camera3D,
  layout: Section3DLayout,
  distance: number = 50
): void {
  // Calculate camera position to view the section
  const target = {
    x: layout.transform.position.x,
    y: layout.transform.position.y,
    z: layout.transform.position.z + distance
  };

  // Calculate rotation to look at section
  const rotation = {
    x: layout.transform.rotation.x,
    y: layout.transform.rotation.y,
    z: 0
  };

  setCameraTarget(camera, target, rotation);
}

// ============================================================================
// Exports
// ============================================================================

export type {
  Vec3,
  Transform3D,
  Camera3D,
  Section3DLayout,
  WorldsConfig
} from './worlds-types.js';
