function clamp01(x) {
    return x < 0 ? 0 : x > 1 ? 1 : x;
}
function isRecord(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
}
export function parseEaseSpec(raw) {
    if (!raw)
        return 'linear';
    if (typeof raw === 'string') {
        const s = raw.trim();
        const name = s;
        return name;
    }
    if (isRecord(raw) && raw.type === 'cubicBezier') {
        const x1 = Number(raw.x1);
        const y1 = Number(raw.y1);
        const x2 = Number(raw.x2);
        const y2 = Number(raw.y2);
        if ([x1, y1, x2, y2].every(Number.isFinite)) {
            return { type: 'cubicBezier', x1, y1, x2, y2 };
        }
    }
    return 'linear';
}
export function ease(u, spec = 'linear') {
    const t = clamp01(Number.isFinite(u) ? u : 0);
    const named = (name) => {
        switch (name) {
            case 'linear': return t;
            case 'step': return t >= 1 ? 1 : 0;
            case 'inQuad': return t * t;
            case 'outQuad': return 1 - (1 - t) * (1 - t);
            case 'inOutQuad': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            case 'inCubic': return t * t * t;
            case 'outCubic': return 1 - Math.pow(1 - t, 3);
            case 'inOutCubic': return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            case 'inQuart': return t * t * t * t;
            case 'outQuart': return 1 - Math.pow(1 - t, 4);
            case 'inOutQuart': return t < 0.5 ? 8 * Math.pow(t, 4) : 1 - Math.pow(-2 * t + 2, 4) / 2;
            case 'inQuint': return Math.pow(t, 5);
            case 'outQuint': return 1 - Math.pow(1 - t, 5);
            case 'inOutQuint': return t < 0.5 ? 16 * Math.pow(t, 5) : 1 - Math.pow(-2 * t + 2, 5) / 2;
            case 'inSine': return 1 - Math.cos((t * Math.PI) / 2);
            case 'outSine': return Math.sin((t * Math.PI) / 2);
            case 'inOutSine': return -(Math.cos(Math.PI * t) - 1) / 2;
            case 'inExpo': return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
            case 'outExpo': return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
            case 'inOutExpo':
                if (t === 0)
                    return 0;
                if (t === 1)
                    return 1;
                return t < 0.5
                    ? Math.pow(2, 20 * t - 10) / 2
                    : (2 - Math.pow(2, -20 * t + 10)) / 2;
            case 'inCirc': return 1 - Math.sqrt(1 - t * t);
            case 'outCirc': return Math.sqrt(1 - Math.pow(t - 1, 2));
            case 'inOutCirc':
                return t < 0.5
                    ? (1 - Math.sqrt(1 - Math.pow(2 * t, 2))) / 2
                    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2;
            default: return t;
        }
    };
    if (typeof spec === 'string')
        return named(spec);
    if (isRecord(spec) && spec.type === 'cubicBezier') {
        // Approximate y(x) by inverting x(t) with a few Newton steps.
        // Deterministic, fast, good enough for UI/automation.
        const x1 = spec.x1, y1 = spec.y1, x2 = spec.x2, y2 = spec.y2;
        const cx = 3 * x1;
        const bx = 3 * (x2 - x1) - cx;
        const ax = 1 - cx - bx;
        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;
        const sampleX = (tt) => ((ax * tt + bx) * tt + cx) * tt;
        const sampleDX = (tt) => (3 * ax * tt + 2 * bx) * tt + cx;
        const sampleY = (tt) => ((ay * tt + by) * tt + cy) * tt;
        let tt = t;
        for (let i = 0; i < 5; i++) {
            const x = sampleX(tt) - t;
            const d = sampleDX(tt);
            if (Math.abs(x) < 1e-5)
                break;
            if (Math.abs(d) < 1e-6)
                break;
            tt = clamp01(tt - x / d);
        }
        return sampleY(tt);
    }
    return t;
}
export function lerp(a, b, t) {
    return a + (b - a) * t;
}
function valueAtSegments(segments, tMs, defaultValue) {
    let cur = defaultValue;
    for (const seg of segments) {
        if (tMs < seg.startMs)
            return cur;
        if (tMs <= seg.endMs) {
            const dur = Math.max(1e-6, seg.endMs - seg.startMs);
            const u = (tMs - seg.startMs) / dur;
            const e = ease(u, seg.ease);
            return lerp(seg.from, seg.to, e);
        }
        cur = seg.to;
    }
    return cur;
}
function pushSegment(segments, seg) {
    if (!(Number.isFinite(seg.startMs) && Number.isFinite(seg.endMs)))
        return;
    if (!(Number.isFinite(seg.from) && Number.isFinite(seg.to)))
        return;
    if (seg.endMs <= seg.startMs)
        return;
    segments.push(seg);
}
export function compileAutomation(entries) {
    const vars = {};
    const impulses = [];
    // Gather and parse events in time order.
    const sorted = Array.from(entries)
        .filter(e => e && Number.isFinite(e.ms) && typeof e.text === 'string')
        .sort((a, b) => a.ms - b.ms);
    // Per-var compilation state.
    const currentTimeByVar = {};
    const currentValueByVar = {};
    for (const e of sorted) {
        const ms = Math.max(0, Math.round(e.ms));
        const raw = String(e.text ?? '').trim();
        if (!raw)
            continue;
        let obj;
        try {
            obj = JSON.parse(raw);
        }
        catch {
            continue;
        }
        if (!isRecord(obj))
            continue;
        // Impulses
        if (typeof obj.call === 'string' && obj.call.trim()) {
            impulses.push({ type: 'call', ms, call: String(obj.call), args: Array.isArray(obj.args) ? obj.args : undefined });
            continue;
        }
        if (isRecord(obj.input) && typeof obj.input.type === 'string') {
            const input = { ...obj.input, type: String(obj.input.type) };
            impulses.push({ type: 'input', ms, input });
            continue;
        }
        // Var automation
        if (typeof obj.var !== 'string' || !obj.var.trim())
            continue;
        const varName = obj.var.trim();
        const easeSpec = parseEaseSpec(obj.ease);
        if (!vars[varName])
            vars[varName] = [];
        const segments = vars[varName];
        const t0 = currentTimeByVar[varName] ?? -Infinity;
        const v0 = currentValueByVar[varName];
        // Absolute keyframe: {var, value}
        if (obj.hasOwnProperty('value')) {
            const value = Number(obj.value);
            if (!Number.isFinite(value))
                continue;
            // If this is the first defined value, just set baseline.
            if (!Number.isFinite(v0)) {
                currentTimeByVar[varName] = ms;
                currentValueByVar[varName] = value;
                continue;
            }
            // If time goes backwards or is equal, treat as an instantaneous set.
            if (!(ms > t0)) {
                currentTimeByVar[varName] = ms;
                currentValueByVar[varName] = value;
                continue;
            }
            // Create a segment from previous value to this keyframe value.
            pushSegment(segments, {
                startMs: t0,
                endMs: ms,
                from: v0,
                to: value,
                ease: easeSpec,
            });
            currentTimeByVar[varName] = ms;
            currentValueByVar[varName] = value;
            continue;
        }
        // Tween: {var, to, durMs}
        if (obj.hasOwnProperty('to') && obj.hasOwnProperty('durMs')) {
            const to = Number(obj.to);
            const durMs = Math.max(0, Math.round(Number(obj.durMs)));
            if (!Number.isFinite(to) || !Number.isFinite(durMs) || durMs <= 0)
                continue;
            // If we don't have a baseline yet, assume 0. Users should set a keyframe at 0ms.
            const from = Number.isFinite(v0) ? v0 : 0;
            // Enforce monotonic per-var time; clamp start to current time if needed.
            const startMs = Math.max(ms, Number.isFinite(t0) ? t0 : ms);
            const endMs = startMs + durMs;
            pushSegment(segments, { startMs, endMs, from, to, ease: easeSpec });
            currentTimeByVar[varName] = endMs;
            currentValueByVar[varName] = to;
            continue;
        }
    }
    impulses.sort((a, b) => a.ms - b.ms);
    return { vars, impulses };
}
export function valueAt(compiled, varName, timeSec, defaultValue = 0) {
    const tMs = Math.max(0, Math.round(Number(timeSec) * 1000));
    const segs = compiled.vars[String(varName)] ?? [];
    return valueAtSegments(segs, tMs, defaultValue);
}
export function impulsesBetween(compiled, prevTimeSec, nowTimeSec) {
    const a = Math.max(0, Math.round(Number(prevTimeSec) * 1000));
    const b = Math.max(0, Math.round(Number(nowTimeSec) * 1000));
    if (!(Number.isFinite(a) && Number.isFinite(b)))
        return [];
    if (b <= a)
        return [];
    // Linear scan is fine for typical small timelines.
    // If this grows, switch to binary search by ms.
    const out = [];
    for (const ev of compiled.impulses) {
        if (ev.ms <= a)
            continue;
        if (ev.ms > b)
            break;
        out.push(ev);
    }
    return out;
}
// ── Generic timed-entry helpers ─────────────────────────────────────────────
/**
 * Return the last entry whose `ms` is ≤ `timeSec * 1000`.
 * Useful for lyric/caption display: "what line is active right now?"
 *
 * @param entries  Sorted (ascending by ms) array of timed entries.
 * @param timeSec  Current engine time in seconds.
 * @returns        The active entry, or `undefined` before the first entry.
 */
export function entryAt(entries, timeSec) {
    const tMs = Math.max(0, Math.round(Number(timeSec) * 1000));
    let result;
    for (const e of entries) {
        if (e.ms > tMs)
            break;
        result = e;
    }
    return result;
}
/**
 * Return all entries whose `ms` falls in the half-open interval
 * `(prevTimeSec * 1000, nowTimeSec * 1000]`.
 * Mirrors `impulsesBetween` for plain timed arrays (lyrics, events, etc.).
 *
 * @param entries      Sorted (ascending by ms) array of timed entries.
 * @param prevTimeSec  Start of window (exclusive), in seconds.
 * @param nowTimeSec   End of window (inclusive), in seconds.
 * @returns            All entries that fall within the window.
 */
export function entriesBetween(entries, prevTimeSec, nowTimeSec) {
    const a = Math.max(0, Math.round(Number(prevTimeSec) * 1000));
    const b = Math.max(0, Math.round(Number(nowTimeSec) * 1000));
    if (!(Number.isFinite(a) && Number.isFinite(b)))
        return [];
    if (b <= a)
        return [];
    const out = [];
    for (const e of entries) {
        if (e.ms <= a)
            continue;
        if (e.ms > b)
            break;
        out.push(e);
    }
    return out;
}
//# sourceMappingURL=automation.js.map