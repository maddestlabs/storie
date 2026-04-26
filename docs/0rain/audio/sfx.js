export function toSfxSeed(seed) {
    if (seed === undefined)
        return (Math.random() * 0xffffffff) >>> 0;
    if (typeof seed === 'number' && Number.isFinite(seed))
        return seed >>> 0;
    const s = String(seed);
    // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}
import { SFX_PRESETS, SFX_PRESET_NAMES } from './sfx-presets.js';
import { playSfxGraph } from './sfx-graph.js';
export function getSfxPresetNames() {
    return [...SFX_PRESET_NAMES];
}
export function sfxSnippet(name, seed, volume) {
    const seedPart = seed === undefined ? '' : `, ${JSON.stringify(seed)}`;
    const optPart = volume === undefined ? '' : `, { volume: ${volume} }`;
    return `audio.sfx.play(${JSON.stringify(name)}${seedPart}${optPart})`;
}
export function playSfx(ctx, name, seedIn, options = {}) {
    // Try to resume, but don’t fail if user gesture rules block it.
    ctx.resume().catch(() => { });
    const seed = toSfxSeed(seedIn);
    const preset = SFX_PRESETS[name];
    if (!preset) {
        // Runtime guard if an unknown name is passed from untyped user code.
        const fallback = SFX_PRESETS.blip;
        return playSfxGraph(ctx, fallback, seed, options);
    }
    return playSfxGraph(ctx, preset, seed, options);
}
//# sourceMappingURL=sfx.js.map