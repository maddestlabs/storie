/**
 * Worlds (3D) System for Storie
 *
 * Provides 3D positioning, rotation, and camera controls for sections.
 * Sections are rendered as textured quads in 3D space using WebGPU.
 */
import { parseHeadingDirectiveObject } from './markdown.js';
import { normalizeDecorativeBorderSpec } from './decorative-borders.js';
// ============================================================================
// 3D Math Utilities
// ============================================================================
/**
 * Create a 3D vector
 */
export function vec3(x = 0, y = 0, z = 0) {
    return { x, y, z };
}
export function vec3Add(a, b) {
    return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
export function vec3Sub(a, b) {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}
export function vec3Scale(v, s) {
    return { x: v.x * s, y: v.y * s, z: v.z * s };
}
export function vec3Dot(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}
export function vec3Cross(a, b) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}
export function vec3Length(v) {
    return Math.sqrt(vec3Dot(v, v));
}
export function vec3Normalize(v) {
    const len = vec3Length(v);
    if (len <= 1e-8)
        return { x: 0, y: 0, z: 0 };
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}
export function mat4TransformVec4(m, x, y, z, w) {
    // Column-major: out = m * v
    return {
        x: m[0] * x + m[4] * y + m[8] * z + m[12] * w,
        y: m[1] * x + m[5] * y + m[9] * z + m[13] * w,
        z: m[2] * x + m[6] * y + m[10] * z + m[14] * w,
        w: m[3] * x + m[7] * y + m[11] * z + m[15] * w,
    };
}
export function mat4TransformPoint(m, v) {
    const r = mat4TransformVec4(m, v.x, v.y, v.z, 1);
    const invW = r.w !== 0 ? 1 / r.w : 1;
    return { x: r.x * invW, y: r.y * invW, z: r.z * invW };
}
export function mat4TransformDirection(m, v) {
    const r = mat4TransformVec4(m, v.x, v.y, v.z, 0);
    return { x: r.x, y: r.y, z: r.z };
}
export function mat4Invert(a) {
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
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
/**
 * Linear interpolation for angles (handles wrapping at 2π)
 */
export function lerpAngle(a, b, t) {
    // Normalize angles to [0, 2π]
    const normalize = (angle) => {
        while (angle < 0)
            angle += Math.PI * 2;
        while (angle >= Math.PI * 2)
            angle -= Math.PI * 2;
        return angle;
    };
    a = normalize(a);
    b = normalize(b);
    // Find shortest path
    let diff = b - a;
    if (diff > Math.PI) {
        diff -= Math.PI * 2;
    }
    else if (diff < -Math.PI) {
        diff += Math.PI * 2;
    }
    return normalize(a + diff * t);
}
/**
 * Lerp between two 3D vectors
 */
export function lerpVec3(a, b, t) {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
}
/**
 * Lerp between two rotations (handles angle wrapping)
 */
export function lerpRotation(a, b, t) {
    return {
        x: lerpAngle(a.x, b.x, t),
        y: lerpAngle(a.y, b.y, t),
        z: lerpAngle(a.z, b.z, t)
    };
}
/**
 * Distance between two 3D points
 */
export function distance(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
/**
 * Create a 4x4 identity matrix
 */
export function mat4Identity() {
    const m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    return m;
}
/**
 * Create a 4x4 perspective projection matrix
 */
export function mat4Perspective(fov, aspect, near, far) {
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
export function mat4Ortho(left, right, bottom, top, near, far) {
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
export function mat4Translate(x, y, z) {
    const m = mat4Identity();
    m[12] = x;
    m[13] = y;
    m[14] = z;
    return m;
}
export function mat4Scale(x, y, z) {
    const m = mat4Identity();
    m[0] = x;
    m[5] = y;
    m[10] = z;
    return m;
}
export function mat4RotateX(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = mat4Identity();
    m[5] = c;
    m[6] = s;
    m[9] = -s;
    m[10] = c;
    return m;
}
export function mat4RotateY(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = mat4Identity();
    m[0] = c;
    m[2] = -s;
    m[8] = s;
    m[10] = c;
    return m;
}
export function mat4RotateZ(angle) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const m = mat4Identity();
    m[0] = c;
    m[1] = s;
    m[4] = -s;
    m[5] = c;
    return m;
}
export function mat4Multiply(a, b) {
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
export function mat4LookAt(eye, target) {
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
export function mat4FromTransform(transform) {
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
export function createCamera3D(config = {}) {
    const seed = Number.isFinite(config?.shake?.seed) ? config.shake.seed : Math.random();
    const shakeDefaults = {
        enabled: false,
        strength: 1,
        seed,
        translate: vec3(0, 0, 0),
        rotate: vec3(0, 0, 0),
        rate: 0.17,
    };
    return {
        position: config.position || vec3(0, 0, 10),
        rotation: config.rotation || vec3(0, 0, 0),
        target: config.target || null,
        targetRotation: config.targetRotation || null,
        fov: config.fov || Math.PI / 4, // 45 degrees
        near: config.near || 0.1,
        far: config.far || 1000,
        positionEaseSpeed: config.positionEaseSpeed || 0.1,
        rotationEaseSpeed: config.rotationEaseSpeed || 0.1,
        effectivePosition: config.position ? { ...config.position } : vec3(0, 0, 10),
        effectiveRotation: config.rotation ? { ...config.rotation } : vec3(0, 0, 0),
        shake: {
            ...shakeDefaults,
            ...(typeof config.shake === 'object' ? config.shake : {}),
            translate: {
                ...shakeDefaults.translate,
                ...((config.shake?.translate && typeof config.shake.translate === 'object') ? config.shake.translate : {}),
            },
            rotate: {
                ...shakeDefaults.rotate,
                ...((config.shake?.rotate && typeof config.shake.rotate === 'object') ? config.shake.rotate : {}),
            },
        }
    };
}
function fract(x) {
    return x - Math.floor(x);
}
function smoothstep(t) {
    return t * t * (3 - 2 * t);
}
function hash2i(ix, iy, seedInt) {
    // Deterministic 32-bit hash -> [0, 1)
    let h = (ix | 0) * 374761393 + (iy | 0) * 668265263 + (seedInt | 0) * 1442695041;
    h = (h ^ (h >>> 13)) | 0;
    h = Math.imul(h, 1274126177);
    h = (h ^ (h >>> 16)) | 0;
    return ((h >>> 0) / 4294967296);
}
function valueNoise2(x, y, seedInt) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fract(x);
    const fy = fract(y);
    const a = hash2i(x0, y0, seedInt);
    const b = hash2i(x0 + 1, y0, seedInt);
    const c = hash2i(x0, y0 + 1, seedInt);
    const d = hash2i(x0 + 1, y0 + 1, seedInt);
    const ux = smoothstep(fx);
    const uy = smoothstep(fy);
    const ab = a + (b - a) * ux;
    const cd = c + (d - c) * ux;
    return ab + (cd - ab) * uy;
}
function fbm2(x, y, seedInt) {
    let f = 0;
    let a = 0.5;
    let px = x;
    let py = y;
    for (let i = 0; i < 4; i++) {
        f += a * valueNoise2(px, py, seedInt);
        px = px * 2.03 + 17.7;
        py = py * 2.03 + 9.2;
        a *= 0.5;
    }
    return f;
}
function spring1(x, v, target, stiffness, damping, dt) {
    // Semi-implicit Euler integration of a damped spring.
    const a = stiffness * (target - x) - damping * v;
    v = v + a * dt;
    x = x + v * dt;
    return { x, v };
}
function ensureShakeState(camera) {
    if (camera._shakeState)
        return camera._shakeState;
    camera._shakeState = {
        time: 0,
        pos: vec3(0, 0, 0),
        posVel: vec3(0, 0, 0),
        rot: vec3(0, 0, 0),
        rotVel: vec3(0, 0, 0),
    };
    return camera._shakeState;
}
function computeForwardFromRotation(rotation) {
    return {
        x: Math.sin(rotation.y) * Math.cos(rotation.x),
        y: -Math.sin(rotation.x),
        z: -Math.cos(rotation.y) * Math.cos(rotation.x)
    };
}
function computeRightUpFromForward(forward) {
    // Match mat4LookAt's basis construction for consistency.
    const zAxis = vec3Normalize(vec3Scale(forward, -1));
    const right = vec3Normalize({ x: zAxis.z, y: 0, z: -zAxis.x });
    const up = {
        x: zAxis.y * right.z - zAxis.z * right.y,
        y: zAxis.z * right.x - zAxis.x * right.z,
        z: zAxis.x * right.y - zAxis.y * right.x,
    };
    return { right, up };
}
function applyRollToBasis(basis, roll) {
    const c = Math.cos(roll);
    const s = Math.sin(roll);
    const right = vec3Add(vec3Scale(basis.right, c), vec3Scale(basis.up, s));
    const up = vec3Add(vec3Scale(basis.up, c), vec3Scale(basis.right, -s));
    return { right, up };
}
function computeRightUpFromRotation(rotation) {
    const forward = computeForwardFromRotation(rotation);
    const basis = computeRightUpFromForward(forward);
    const roll = Number.isFinite(rotation.z) ? rotation.z : 0;
    if (!roll)
        return basis;
    return applyRollToBasis(basis, roll);
}
function computeRollDeltaToAlignUp(forward, baseUp, desiredUp) {
    const f = vec3Normalize(forward);
    const desiredProj = vec3Normalize(vec3Sub(desiredUp, vec3Scale(f, vec3Dot(desiredUp, f))));
    if (vec3Length(desiredProj) <= 1e-8)
        return 0;
    const baseUpProj = vec3Normalize(vec3Sub(baseUp, vec3Scale(f, vec3Dot(baseUp, f))));
    if (vec3Length(baseUpProj) <= 1e-8)
        return 0;
    const sin = vec3Dot(f, vec3Cross(baseUpProj, desiredProj));
    const cos = clamp(vec3Dot(baseUpProj, desiredProj), -1, 1);
    const angle = Math.atan2(sin, cos);
    // Our basis roll application rotates `up` towards `-right` for +roll.
    return -angle;
}
/**
 * Update camera (apply easing towards target)
 */
export function updateCamera3D(camera, _deltaTime) {
    const hasTargetPos = !!camera.target;
    const hasTargetRot = !!camera.targetRotation;
    if (hasTargetPos && camera.target) {
        camera.position = lerpVec3(camera.position, camera.target, camera.positionEaseSpeed);
    }
    if (hasTargetRot && camera.targetRotation) {
        camera.rotation = lerpVec3(camera.rotation, camera.targetRotation, camera.rotationEaseSpeed);
    }
    if (hasTargetPos || hasTargetRot) {
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
    // Always refresh effective pose (even when not easing).
    let effectivePosition = { ...camera.position };
    let effectiveRotation = { ...camera.rotation };
    const shake = camera.shake;
    const dt = Number.isFinite(_deltaTime) ? Math.max(0, Math.min(_deltaTime, 0.05)) : 0;
    if (shake && shake.enabled && Number.isFinite(shake.strength) && shake.strength > 0) {
        const state = ensureShakeState(camera);
        state.time += dt;
        const strength = clamp(shake.strength, 0, 2);
        const seed = Number.isFinite(shake.seed) ? shake.seed : 0;
        const seedInt = ((seed * 1_000_000) | 0) ^ 0x9e3779b9;
        const t = state.time;
        const rate = Number.isFinite(shake.rate) ? shake.rate : 0.17;
        // Base 2D domain-warped fBm track.
        const baseX = t * rate;
        const baseY = seed * 19.19;
        const warpX = fbm2(baseX + 12.3, baseY + 4.7, seedInt);
        const warpY = fbm2(baseX + 3.1, baseY + 27.9, seedInt);
        const p2x = baseX + (warpX - 0.5) * 3.0;
        const p2y = baseY + (warpY - 0.5) * 3.0;
        const nx = fbm2(p2x + 10.0, p2y + 20.0, seedInt) - 0.5;
        const ny = fbm2(p2x + 30.0, p2y + 40.0, seedInt) - 0.5;
        const nz = fbm2(p2x + 50.0, p2y + 60.0, seedInt) - 0.5;
        // Add a small faster component to avoid “slow looping”.
        const jx = (fbm2(t * (rate * 4.2) + 91.0, baseY + 7.0, seedInt) - 0.5);
        const jy = (fbm2(t * (rate * 3.7) + 13.0, baseY + 11.0, seedInt) - 0.5);
        const jz = (fbm2(t * (rate * 4.9) + 41.0, baseY + 19.0, seedInt) - 0.5);
        const nxf = nx * 0.82 + jx * 0.18;
        const nyf = ny * 0.82 + jy * 0.18;
        const nzf = nz * 0.82 + jz * 0.18;
        const targetRot = {
            x: nxf * shake.rotate.x * strength,
            y: nyf * shake.rotate.y * strength,
            z: nzf * shake.rotate.z * strength,
        };
        const targetPos = {
            x: (fbm2(p2x + 90.0, p2y + 100.0, seedInt) - 0.5) * shake.translate.x * strength,
            y: (fbm2(p2x + 110.0, p2y + 120.0, seedInt) - 0.5) * shake.translate.y * strength,
            z: nzf * shake.translate.z * strength,
        };
        // Spring-filter offsets for inertia.
        const rotStiff = 55;
        const rotDamp = 16;
        const posStiff = 45;
        const posDamp = 14;
        const rx = spring1(state.rot.x, state.rotVel.x, targetRot.x, rotStiff, rotDamp, dt);
        const ry = spring1(state.rot.y, state.rotVel.y, targetRot.y, rotStiff, rotDamp, dt);
        const rz = spring1(state.rot.z, state.rotVel.z, targetRot.z, rotStiff, rotDamp, dt);
        state.rot = { x: rx.x, y: ry.x, z: rz.x };
        state.rotVel = { x: rx.v, y: ry.v, z: rz.v };
        const px = spring1(state.pos.x, state.posVel.x, targetPos.x, posStiff, posDamp, dt);
        const py = spring1(state.pos.y, state.posVel.y, targetPos.y, posStiff, posDamp, dt);
        const pz = spring1(state.pos.z, state.posVel.z, targetPos.z, posStiff, posDamp, dt);
        state.pos = { x: px.x, y: py.x, z: pz.x };
        state.posVel = { x: px.v, y: py.v, z: pz.v };
        effectiveRotation = {
            x: camera.rotation.x + state.rot.x,
            y: camera.rotation.y + state.rot.y,
            z: camera.rotation.z + state.rot.z,
        };
        // Apply translation in camera-local axes (right/up/forward).
        const forward = computeForwardFromRotation(effectiveRotation);
        const basis = computeRightUpFromRotation(effectiveRotation);
        effectivePosition = vec3Add(camera.position, vec3Add(vec3Scale(basis.right, state.pos.x), vec3Add(vec3Scale(basis.up, state.pos.y), vec3Scale(forward, state.pos.z))));
    }
    else {
        // If shake is disabled, reset integrator so re-enabling doesn't jump.
        if (camera._shakeState) {
            camera._shakeState.time = 0;
            camera._shakeState.pos = vec3(0, 0, 0);
            camera._shakeState.posVel = vec3(0, 0, 0);
            camera._shakeState.rot = vec3(0, 0, 0);
            camera._shakeState.rotVel = vec3(0, 0, 0);
        }
    }
    camera.effectivePosition = effectivePosition;
    camera.effectiveRotation = effectiveRotation;
}
/**
 * Set camera target for smooth movement
 */
export function setCameraTarget(camera, target, rotation) {
    camera.target = { ...target };
    if (rotation) {
        camera.targetRotation = { ...rotation };
    }
}
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function computeYawPitchFromForward(forward) {
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
export function focusOnSectionFit(camera, layout, viewportAspect, fill = 0.9, distanceLimits = {}, options) {
    const safeAspect = Number.isFinite(viewportAspect) && viewportAspect > 0 ? viewportAspect : 1;
    const safeFill = clamp(fill, 0.05, 0.99);
    const baseW = (layout.worldWidth ?? layout.width);
    const baseH = (layout.worldHeight ?? layout.height);
    const worldWidth = baseW * (layout.transform.scale?.x ?? 1);
    const worldHeight = baseH * (layout.transform.scale?.y ?? 1);
    const vFov = camera.fov;
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * safeAspect);
    const halfW = Math.max(1e-6, worldWidth / 2);
    const halfH = Math.max(1e-6, worldHeight / 2);
    const distForHeight = halfH / (Math.tan(vFov / 2) * safeFill);
    const distForWidth = halfW / (Math.tan(hFov / 2) * safeFill);
    let distance = Math.max(distForHeight, distForWidth);
    if (Number.isFinite(distanceLimits.min ?? NaN))
        distance = Math.max(distance, distanceLimits.min);
    if (Number.isFinite(distanceLimits.max ?? NaN))
        distance = Math.min(distance, distanceLimits.max);
    // Compute section normal from its rotation. Default quad normal is +Z in local space.
    const rotOnly = mat4FromTransform({
        position: { x: 0, y: 0, z: 0 },
        rotation: layout.transform.rotation,
        scale: { x: 1, y: 1, z: 1 },
    });
    const normalWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 0, z: 1 }));
    // Camera forward should point at the section center; to face the front, forward is -normal.
    const forward = vec3Scale(normalWorld, -1);
    const baseRotation = computeYawPitchFromForward(forward);
    const positionOffset = options?.positionOffset;
    const rotationOffset = options?.rotationOffset;
    const center = {
        x: layout.transform.position.x + (positionOffset?.x ?? 0),
        y: layout.transform.position.y + (positionOffset?.y ?? 0),
        z: layout.transform.position.z + (positionOffset?.z ?? 0),
    };
    let target = {
        x: center.x + normalWorld.x * distance,
        y: center.y + normalWorld.y * distance,
        z: center.z + normalWorld.z * distance,
    };
    // Default behavior: rotate to face the section unless keepRotation is
    // explicitly requested.
    const keepRotation = options?.keepRotation ?? false;
    if (keepRotation) {
        const doStraighten = options?.straighten ?? false;
        const rotationOffset = options?.rotationOffset;
        let rollTarget = Number.isFinite(camera.rotation.z) ? camera.rotation.z : 0;
        if (doStraighten) {
            const camForward = computeForwardFromRotation(camera.rotation);
            const camBasis = computeRightUpFromRotation(camera.rotation);
            const upWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 1, z: 0 }));
            rollTarget = rollTarget + computeRollDeltaToAlignUp(camForward, camBasis.up, upWorld);
        }
        rollTarget = rollTarget + (rotationOffset?.z ?? 0);
        // Only set a target rotation when we need to roll.
        // This preserves pitch/yaw while allowing roll-only straightening.
        if (doStraighten || (rotationOffset?.z ?? 0) !== 0) {
            camera.targetRotation = { x: camera.rotation.x, y: camera.rotation.y, z: rollTarget };
        }
        else {
            camera.targetRotation = null;
        }
        // Recenter the focused section in screen space when rotation is locked.
        // Without this, placing the camera along the section normal does *not*
        // guarantee the section center lands on the screen center when the camera
        // yaw/pitch is fixed.
        //
        // Default: enabled (unless explicitly disabled).
        const doRecenter = options?.screenSpaceRecenter ?? true;
        if (doRecenter) {
            const forward = computeForwardFromRotation(camera.rotation);
            // Preserve approx distance-to-plane along the section normal.
            const denom = Math.max(0.2, -vec3Dot(normalWorld, forward));
            const distAlongForward = distance / denom;
            target = vec3Sub(center, vec3Scale(forward, distAlongForward));
            const iters = options?.screenSpaceRecenterIters ?? 5;
            const recenterRot = camera.targetRotation ?? camera.rotation;
            target = recenterCameraToPoint(camera, target, recenterRot, center, safeAspect, iters);
        }
        setCameraTarget(camera, target, camera.targetRotation ?? undefined);
        return;
    }
    const doStraighten = options?.straighten ?? false;
    let roll = 0;
    if (doStraighten) {
        const upWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 1, z: 0 }));
        const baseBasis = computeRightUpFromForward(forward);
        roll = computeRollDeltaToAlignUp(forward, baseBasis.up, upWorld);
    }
    const rotation = {
        x: baseRotation.x + (rotationOffset?.x ?? 0),
        y: baseRotation.y + (rotationOffset?.y ?? 0),
        z: roll + (rotationOffset?.z ?? 0),
    };
    setCameraTarget(camera, target, rotation);
}
/**
 * Get camera view matrix
 */
export function getCameraViewMatrix(camera) {
    const pos = camera.effectivePosition ?? camera.position;
    const rot = camera.effectiveRotation ?? camera.rotation;
    return getViewMatrixForPose(pos, rot);
}
/**
 * Get camera projection matrix
 */
export function getCameraProjectionMatrix(camera, aspect) {
    return mat4Perspective(camera.fov, aspect, camera.near, camera.far);
}
// ============================================================================
// Section 3D Layout
// ============================================================================
/**
 * Parse 3D transform from section metadata
 * Supports: x, y, z (or depth), width, height, rotate-x, rotate-y, rotate-z, scale
 */
export function parseTransform3D(section, sectionIndex, config) {
    // Parse metadata from section directive first (preferred), with a fallback
    // to legacy JSON-in-title parsing for older/hand-authored Section objects.
    const rawMetadata = (section.directive && typeof section.directive === 'object' && !Array.isArray(section.directive))
        ? section.directive
        : parseSectionMetadata(section.title);
    const metaStr = (key, fallback) => {
        const v = rawMetadata[key];
        if (v === undefined || v === null)
            return fallback;
        const s = String(v);
        return s.length ? s : fallback;
    };
    const metaHas = (key) => Object.prototype.hasOwnProperty.call(rawMetadata, key);
    const parseContentAlign = (value) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'center' || raw === 'middle')
            return 'center';
        return 'start';
    };
    const parseTextAlign = (value) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'center' || raw === 'middle')
            return 'center';
        if (raw === 'right' || raw === 'end')
            return 'right';
        return 'left';
    };
    const parseBlendMode = (value, fallback = 'normal') => {
        const raw = String(value ?? '').trim().toLowerCase().replace(/[-_\s]/g, '');
        switch (raw) {
            case 'multiply':
            case 'screen':
            case 'overlay':
            case 'softlight':
            case 'hardlight':
            case 'darken':
            case 'lighten':
            case 'difference':
            case 'exclusion':
            case 'colorburn':
            case 'colordodge':
                return raw;
            default:
                return fallback;
        }
    };
    const parseArtFit = (value) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'contain')
            return 'contain';
        if (raw === 'stretch' || raw === 'fill')
            return 'stretch';
        return 'cover';
    };
    const parseArtLayer = (value) => {
        const raw = String(value ?? '').trim().toLowerCase();
        if (raw === 'over' || raw === 'overlay' || raw === 'front' || raw === 'above')
            return 'over';
        return 'under';
    };
    const metaTruthy = (key) => {
        const v = rawMetadata[key];
        if (v === true)
            return true;
        if (v === false || v === null || v === undefined)
            return false;
        const s = String(v).trim().toLowerCase();
        return s === 'true' || s === '1' || s === 'yes' || s === 'on';
    };
    const metaBoolean = (key) => {
        if (!metaHas(key))
            return undefined;
        const v = rawMetadata[key];
        if (v === true)
            return true;
        if (v === false)
            return false;
        if (v === null || v === undefined)
            return undefined;
        const s = String(v).trim().toLowerCase();
        if (s === 'true' || s === '1' || s === 'yes' || s === 'on')
            return true;
        if (s === 'false' || s === '0' || s === 'no' || s === 'off')
            return false;
        return undefined;
    };
    const hasExplicitPosition = metaHas('x') || metaHas('y') || metaHas('z') || metaHas('depth');
    // Position
    let x = parseFloat(metaStr('x', '0'));
    let y = parseFloat(metaStr('y', '0'));
    const z = parseFloat(metaStr('z', metaStr('depth', String(config.defaultDepth))));
    // Auto-layout: 3-column grid for sections without explicit position metadata.
    const autoEnabled = config.autoLayoutEnabled !== false;
    const autoPositioned = autoEnabled && !hasExplicitPosition;
    if (autoEnabled && !hasExplicitPosition) {
        const cols = Math.max(1, Math.floor(config.autoLayoutColumns ?? 3));
        const spacing = Number.isFinite(config.autoLayoutSpacing ?? NaN) ? config.autoLayoutSpacing : 200;
        const col = sectionIndex % cols;
        const row = Math.floor(sectionIndex / cols);
        const xCenter = (cols - 1) / 2;
        x = (col - xCenter) * spacing;
        y = -row * spacing;
    }
    // Rotation (in degrees, convert to radians)
    const rotX = (parseFloat(metaStr('rotate-x', '0')) * Math.PI) / 180;
    const rotY = (parseFloat(metaStr('rotate-y', '0')) * Math.PI) / 180;
    const rotZ = (parseFloat(metaStr('rotate-z', '0')) * Math.PI) / 180;
    // Scale
    const scale = parseFloat(metaStr('scale', '1'));
    // Visual alpha
    const rawOpacity = parseFloat(metaStr('opacity', '1'));
    const opacity = Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 1;
    // Dimensions
    const width = parseFloat(metaStr('width', String(config.defaultSectionWidth)));
    const height = parseFloat(metaStr('height', String(config.defaultSectionHeight)));
    // Visibility
    const hiddenUntilVisited = (() => {
        const explicit = metaBoolean('hiddenUntilVisited');
        if (explicit !== undefined)
            return explicit;
        // `hidden: true` also implies hiddenUntilVisited: sections are hidden from
        // the navigation listing but become visible when first navigated to via a link.
        if (metaTruthy('hidden'))
            return true;
        const cfgDefault = config.autoHideSectionsUntilVisited;
        return cfgDefault === true;
    })();
    const removeAfterVisit = metaTruthy('removeAfterVisit');
    // `hiddenUntilVisited` (and `hidden`) start hidden but become visible on visit.
    const visible = hiddenUntilVisited ? false : true;
    const navigable = metaStr('navigable', 'true').trim().toLowerCase() !== 'false';
    const interactive = metaStr('interactive', 'true').trim().toLowerCase() !== 'false';
    const contentAlign = metaHas('contentAlign')
        ? parseContentAlign(rawMetadata.contentAlign)
        : parseContentAlign(config.sectionContentAlign ?? 'start');
    const textAlign = metaHas('textAlign')
        ? parseTextAlign(rawMetadata.textAlign)
        : parseTextAlign(config.sectionTextAlign ?? 'left');
    const renderMode = (() => {
        const defaultMode = (() => {
            switch ((config.sectionRender ?? 'all').toLowerCase()) {
                case 'heading':
                case 'content':
                case 'none':
                    return config.sectionRender;
                default:
                    return 'all';
            }
        })();
        const mode = metaStr('render', defaultMode).trim().toLowerCase();
        switch (mode) {
            case 'heading':
            case 'content':
            case 'none':
                return mode;
            default:
                return 'all';
        }
    })();
    const sectionBorder = (() => {
        const value = rawMetadata.sectionBorder ?? rawMetadata.border;
        return normalizeDecorativeBorderSpec(value) ?? undefined;
    })();
    const sectionArt = (() => {
        const artUrl = metaStr('art', metaStr('artUrl', metaStr('artSrc', ''))).trim();
        if (!artUrl)
            return undefined;
        const rawOpacity = parseFloat(metaStr('artOpacity', '1'));
        const rawScale = parseFloat(metaStr('artScale', '1'));
        const rawOffsetX = parseFloat(metaStr('artOffsetX', metaStr('artX', '0')));
        const rawOffsetY = parseFloat(metaStr('artOffsetY', metaStr('artY', '0')));
        return {
            url: artUrl,
            opacity: Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 1,
            blendMode: parseBlendMode(rawMetadata.artBlend ?? rawMetadata.artBlendMode, 'normal'),
            layer: parseArtLayer(rawMetadata.artLayer),
            fit: parseArtFit(rawMetadata.artFit),
            scale: Number.isFinite(rawScale) ? Math.max(0.05, rawScale) : 1,
            offsetX: Number.isFinite(rawOffsetX) ? rawOffsetX : 0,
            offsetY: Number.isFinite(rawOffsetY) ? rawOffsetY : 0,
        };
    })();
    // For display/rendering: markdown parser already strips directive JSON from
    // the title when it stores it in `section.directive`. Keep a legacy fallback.
    const displayTitle = section.directive
        ? section.title
        : section.title.replace(/\s*\{[^}]+\}\s*$/, '').trim();
    const sectionId = typeof section.id === 'string' && section.id.trim().length > 0
        ? section.id.trim()
        : `section-${sectionIndex}`;
    return {
        sectionId,
        sectionIndex,
        sectionTitle: section.title,
        displayTitle,
        content: section.content,
        renderMode,
        contentAlign,
        textAlign,
        ...(sectionArt ? { sectionArt } : {}),
        ...(sectionBorder ? { sectionBorder } : {}),
        transform: {
            position: vec3(x, y, z),
            rotation: vec3(rotX, rotY, rotZ),
            scale: vec3(scale, scale, 1)
        },
        autoPositioned,
        width,
        height,
        texture: null,
        opacity,
        visible,
        hiddenUntilVisited,
        removeAfterVisit,
        navigable,
        interactive
    };
}
/**
 * Parse section metadata from a trailing heading directive.
 * Supports both strict JSON and a relaxed flat-object form.
 */
export function parseSectionMetadata(title) {
    const match = title.match(/\{[\s\S]*\}\s*$/);
    if (!match)
        return {};
    const parsed = parseHeadingDirectiveObject(match[0]);
    if (!parsed) {
        console.warn('Failed to parse section metadata:', title);
        return {};
    }
    // Convert all values to strings for consistent parsing.
    const result = {};
    for (const key in parsed) {
        result[key] = String(parsed[key]);
    }
    return result;
}
/**
 * Create 3D layouts for all sections
 */
export function createSection3DLayouts(sections, config) {
    const layouts = [];
    let sectionIndex = 0;
    function processSections(sectionList) {
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
export function getDefaultWorldsConfig() {
    return {
        defaultDepth: -100, // Sections start 100 units in front of camera (negative Z)
        defaultSectionWidth: 60,
        defaultSectionHeight: 20,
        sectionRender: 'all',
        sectionClickFocusEnabled: true,
        sectionSizeUnits: 'text',
        sectionOverflow: 'clip',
        cameraFov: Math.PI / 4, // 45 degrees
        cameraNear: 0.1,
        cameraFar: 1000,
        positionEaseSpeed: 0.1,
        rotationEaseSpeed: 0.15,
        keepRotation: false,
        straightenOnFocus: false,
        screenSpaceRecenter: false,
        screenSpaceRecenterIters: 5,
        autoLayoutEnabled: true,
        autoLayoutColumns: 3,
        autoLayoutSpacing: 200,
        autoHideSectionsUntilVisited: false,
        sectionTextureMode: 'canvas2d',
        sectionContentAlign: 'start',
        sectionTextAlign: 'left',
        sectionBorderEnabled: true,
        sectionBorderWidth: 2,
        sectionBorder: undefined,
        sectionLinkUnderline: false,
        sectionListMarker: undefined,
        // Use the theme surface by default (typically bgAlt / elevated panel color)
        sectionBackground: 'surface'
    };
}
function getViewMatrixForPose(position, rotation) {
    const forward = computeForwardFromRotation(rotation);
    const zAxis = vec3Normalize(vec3Scale(forward, -1));
    let xAxis = vec3Normalize({ x: zAxis.z, y: 0, z: -zAxis.x });
    if (vec3Length(xAxis) <= 1e-8)
        xAxis = { x: 1, y: 0, z: 0 };
    let yAxis = {
        x: zAxis.y * xAxis.z - zAxis.z * xAxis.y,
        y: zAxis.z * xAxis.x - zAxis.x * xAxis.z,
        z: zAxis.x * xAxis.y - zAxis.y * xAxis.x,
    };
    const roll = Number.isFinite(rotation.z) ? rotation.z : 0;
    if (roll) {
        const rolled = applyRollToBasis({ right: xAxis, up: yAxis }, roll);
        xAxis = rolled.right;
        yAxis = rolled.up;
    }
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
    m[12] = -(xAxis.x * position.x + xAxis.y * position.y + xAxis.z * position.z);
    m[13] = -(yAxis.x * position.x + yAxis.y * position.y + yAxis.z * position.z);
    m[14] = -(zAxis.x * position.x + zAxis.y * position.y + zAxis.z * position.z);
    m[15] = 1;
    return m;
}
function projectToNdc(camera, position, rotation, point, aspect) {
    const view = getViewMatrixForPose(position, rotation);
    const proj = getCameraProjectionMatrix(camera, aspect);
    const viewProj = mat4Multiply(proj, view);
    const r = mat4TransformVec4(viewProj, point.x, point.y, point.z, 1);
    const invW = r.w !== 0 ? 1 / r.w : 1;
    return { x: r.x * invW, y: r.y * invW, z: r.z * invW };
}
function recenterCameraToPoint(camera, basePosition, baseRotation, point, aspect, iters) {
    // Solve for a camera translation (with fixed rotation) such that `point`
    // projects to NDC (0,0). Uses a tiny finite-difference Jacobian.
    const basis = computeRightUpFromRotation(baseRotation);
    let pos = { ...basePosition };
    const maxIters = Math.max(1, Math.min(12, Math.floor(iters || 1)));
    for (let i = 0; i < maxIters; i++) {
        const ndc = projectToNdc(camera, pos, baseRotation, point, aspect);
        const errX = ndc.x;
        const errY = ndc.y;
        if (Math.abs(errX) + Math.abs(errY) < 1e-4)
            break;
        const eps = 0.5;
        const posR = vec3Add(pos, vec3Scale(basis.right, eps));
        const ndcR = projectToNdc(camera, posR, baseRotation, point, aspect);
        const dxdR = (ndcR.x - ndc.x) / eps;
        const dydR = (ndcR.y - ndc.y) / eps;
        const posU = vec3Add(pos, vec3Scale(basis.up, eps));
        const ndcU = projectToNdc(camera, posU, baseRotation, point, aspect);
        const dxdU = (ndcU.x - ndc.x) / eps;
        const dydU = (ndcU.y - ndc.y) / eps;
        // Solve 2x2 linear system J * delta = -err.
        const det = dxdR * dydU - dxdU * dydR;
        if (Math.abs(det) < 1e-8)
            break;
        const invDet = 1 / det;
        let deltaR = (-errX * dydU - (-errY) * dxdU) * invDet;
        let deltaU = (dxdR * (-errY) - dydR * (-errX)) * invDet;
        // Clamp step to avoid huge jumps.
        const maxStep = 50;
        deltaR = clamp(deltaR, -maxStep, maxStep);
        deltaU = clamp(deltaU, -maxStep, maxStep);
        pos = vec3Add(pos, vec3Add(vec3Scale(basis.right, deltaR), vec3Scale(basis.up, deltaU)));
    }
    return pos;
}
/**
 * Focus camera on a section
 */
export function focusOnSection(camera, layout, distance = 50, options) {
    // Calculate camera position to view the section
    const positionOffset = options?.positionOffset;
    const rotationOffset = options?.rotationOffset;
    const center = {
        x: layout.transform.position.x + (positionOffset?.x ?? 0),
        y: layout.transform.position.y + (positionOffset?.y ?? 0),
        z: layout.transform.position.z + (positionOffset?.z ?? 0)
    };
    let target = {
        x: center.x,
        y: center.y,
        z: center.z + distance
    };
    // Calculate rotation to look at section
    const keepRotation = options?.keepRotation ?? false;
    if (keepRotation) {
        const doStraighten = options?.straighten ?? false;
        const rotationOffset = options?.rotationOffset;
        let rollTarget = Number.isFinite(camera.rotation.z) ? camera.rotation.z : 0;
        if (doStraighten) {
            const camForward = computeForwardFromRotation(camera.rotation);
            const camBasis = computeRightUpFromRotation(camera.rotation);
            const rotOnly = mat4FromTransform({
                position: { x: 0, y: 0, z: 0 },
                rotation: layout.transform.rotation,
                scale: { x: 1, y: 1, z: 1 },
            });
            const upWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 1, z: 0 }));
            rollTarget = rollTarget + computeRollDeltaToAlignUp(camForward, camBasis.up, upWorld);
        }
        rollTarget = rollTarget + (rotationOffset?.z ?? 0);
        if (doStraighten || (rotationOffset?.z ?? 0) !== 0) {
            camera.targetRotation = { x: camera.rotation.x, y: camera.rotation.y, z: rollTarget };
        }
        else {
            camera.targetRotation = null;
        }
        // Recenter in screen space when camera has a tilt/yaw.
        // Default: enabled (unless explicitly disabled).
        const doRecenter = options?.screenSpaceRecenter ?? true;
        if (doRecenter) {
            const forward = computeForwardFromRotation(camera.rotation);
            target = vec3Sub(center, vec3Scale(forward, distance));
        }
        setCameraTarget(camera, target, camera.targetRotation ?? undefined);
        return;
    }
    const doStraighten = options?.straighten ?? false;
    let roll = 0;
    if (doStraighten) {
        const approxForward = computeForwardFromRotation({
            x: layout.transform.rotation.x + (rotationOffset?.x ?? 0),
            y: layout.transform.rotation.y + (rotationOffset?.y ?? 0),
            z: 0,
        });
        const baseBasis = computeRightUpFromForward(approxForward);
        const rotOnly = mat4FromTransform({
            position: { x: 0, y: 0, z: 0 },
            rotation: layout.transform.rotation,
            scale: { x: 1, y: 1, z: 1 },
        });
        const upWorld = vec3Normalize(mat4TransformDirection(rotOnly, { x: 0, y: 1, z: 0 }));
        roll = computeRollDeltaToAlignUp(approxForward, baseBasis.up, upWorld);
    }
    const rotation = {
        x: layout.transform.rotation.x + (rotationOffset?.x ?? 0),
        y: layout.transform.rotation.y + (rotationOffset?.y ?? 0),
        z: roll + (rotationOffset?.z ?? 0)
    };
    setCameraTarget(camera, target, rotation);
}
//# sourceMappingURL=worlds.js.map