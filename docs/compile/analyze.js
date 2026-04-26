const BACKEND_ADAPTER_RULES = [
    { name: 'audio legacy helpers', pattern: /\baudio\.(?:playTone|loadSound|loadSoundFromDrop|loadSoundFromBlob|playBuffer|playDrop|playBlob|peaksFromBuffer|beatsFromBuffer|beatState)\b/ },
    { name: 'audio ambient bridge', pattern: /\baudio\.ambient\.createLayeredBed\b/ },
    { name: 'audio buffer bridge', pattern: /\baudio\.buffer\.create\b/ },
    { name: 'audio export bridge', pattern: /\baudio\.(?:captureForExport|getCapturedForExport)\b/ },
    { name: 'audio synth bridge', pattern: /\baudio\.(?:sfx|fft)\b/ },
    { name: 'tui', pattern: /\btui\b/ },
    { name: 'gui', pattern: /\bgui\b/ },
    { name: 'ui', pattern: /\bui\b/ },
    { name: 'worlds', pattern: /\bworlds\b/ },
    { name: 'shader', pattern: /\bshader\b/ },
    { name: 'compositor', pattern: /\bcompositor\b/ },
    { name: 'host', pattern: /\bhost\.(?:enabled|role|isHost|isClient|transport|channel)\b/ },
];
const JS_ONLY_RULES = [
    { name: 'audio.context', pattern: /\baudio\.context\b/ },
    { name: 'audio raw node constructors', pattern: /\baudio\.create(?:Oscillator|Gain|BiquadFilter|Delay|Convolver|DynamicsCompressor|Analyser|BufferSource|Panner|StereoPanner|WaveShaper)\b/ },
    { name: 'canvas2d.context', pattern: /\bcanvas2d\.context\b/ },
    { name: 'webgl', pattern: /\bwebgl\.(?:context|createShader|createProgram|available)\b/ },
    { name: 'webgpu', pattern: /\bwebgpu\.(?:device|init|createBuffer|createShaderModule|createTexture|GPUBufferUsage|GPUTextureUsage|GPUShaderStage|available)\b/ },
    { name: 'sys.download', pattern: /\bsys\.download\b/ },
    { name: 'getParam', pattern: /\bgetParam\s*\(/ },
    { name: 'ui.loadImageFromURL', pattern: /\bui\.loadImageFromURL\s*\(/ },
];
const CAPABILITY_PATTERNS = [
    { name: 'terminal', patterns: [/\bterm\b/, /\blayer\b/, /\btermCanvas\b/] },
    { name: 'ui', patterns: [/\bui\b/] },
    { name: 'gui', patterns: [/\bgui\b/] },
    { name: 'worlds', patterns: [/\bworlds\b/] },
    { name: 'audio', patterns: [/\baudio\b/, /\bstfxr\b/] },
    { name: 'shader', patterns: [/\bshader\b/, /\bcompositor\b/, /\bwebgpu\b/, /\bwebgl\b/] },
    { name: 'random', patterns: [/\brandom\b/] },
    { name: 'themes', patterns: [/\bthemes\b/, /\btheme\b/, /\bgetStyle\b/] },
    { name: 'modules', patterns: [/\bmodules\b/] },
    { name: 'host', patterns: [/\bhost\b/, /\bscene\b/] },
    { name: 'sys', patterns: [/\bsys\b/] },
    { name: 'input', patterns: [/\bkey\b/, /\bkeys\b/, /\bmouse\b/, /\bdrop\b/, /\bevent\b/] },
    { name: 'export', patterns: [/\bisExporting\b/, /\bcaptureForExport\b/, /\bon:export\b/] },
];
const KNOWN_CAPABILITIES = new Set([
    'terminal',
    'ui',
    'gui',
    'worlds',
    'audio',
    'shader',
    'blobs',
    'timed',
    'logic',
    'random',
    'themes',
    'modules',
    'host',
    'sys',
    'input',
    'export',
]);
const KNOWN_HOST_PERMISSIONS = new Set([
    'clipboard-read',
    'clipboard-write',
    'download',
    'modules-load',
    'dynamic-import',
    'cross-origin-dynamic-import',
    'webgpu-device',
]);
function normalizeModules(rawModules) {
    if (Array.isArray(rawModules)) {
        return rawModules.map((value) => String(value).trim()).filter(Boolean);
    }
    if (rawModules === undefined || rawModules === null)
        return [];
    const text = String(rawModules).trim();
    return text ? [text] : [];
}
function splitDeclaredList(rawValue) {
    return rawValue
        .split(',')
        .map((value) => String(value).trim())
        .filter(Boolean);
}
function normalizeDeclaredCapabilities(rawCapabilities) {
    let source = rawCapabilities;
    if (source && typeof source === 'object' && !Array.isArray(source)) {
        const record = source;
        source = record.capabilities ?? record.packs ?? record.requires ?? source;
    }
    const rawValues = Array.isArray(source)
        ? source.map((value) => String(value).trim()).filter(Boolean)
        : typeof source === 'string'
            ? splitDeclaredList(source)
            : source == null
                ? []
                : [String(source).trim()].filter(Boolean);
    const capabilities = new Set();
    const unknown = new Set();
    for (const rawValue of rawValues) {
        const normalized = rawValue.toLowerCase();
        if (KNOWN_CAPABILITIES.has(normalized)) {
            capabilities.add(normalized);
            continue;
        }
        unknown.add(rawValue);
    }
    return {
        capabilities: Array.from(capabilities).sort(),
        unknown: Array.from(unknown).sort(),
    };
}
function normalizeDeclaredHostPermissions(rawPermissions) {
    const rawValues = Array.isArray(rawPermissions)
        ? rawPermissions.map((value) => String(value).trim()).filter(Boolean)
        : typeof rawPermissions === 'string'
            ? splitDeclaredList(rawPermissions)
            : rawPermissions == null
                ? []
                : [String(rawPermissions).trim()].filter(Boolean);
    const permissions = new Set();
    const unknown = new Set();
    for (const rawValue of rawValues) {
        const normalized = rawValue.toLowerCase();
        if (KNOWN_HOST_PERMISSIONS.has(normalized)) {
            permissions.add(normalized);
            continue;
        }
        unknown.add(rawValue);
    }
    return {
        permissions: Array.from(permissions).sort(),
        unknown: Array.from(unknown).sort(),
    };
}
function getHook(block) {
    const hook = String(block.metadata?.on ?? '').trim();
    switch (hook) {
        case 'init':
        case 'update':
        case 'render':
        case 'input':
        case 'drop':
        case 'export':
        case 'enter':
            return hook;
        default:
            return 'global';
    }
}
function collectMatchedNames(source, rules) {
    return Array.from(new Set(rules.filter((rule) => rule.pattern.test(source)).map((rule) => rule.name)));
}
function createWarning(code, message, options) {
    return {
        code,
        severity: options?.severity ?? 'warning',
        category: options?.category ?? 'portability',
        message,
    };
}
export function analyzeMarkdownDocument(document) {
    const lifecycleUsage = {
        global: 0,
        init: 0,
        update: 0,
        render: 0,
        input: 0,
        drop: 0,
        export: 0,
        enter: 0,
    };
    const capabilities = new Set();
    const warnings = new Map();
    const scriptBlocks = document.codeBlocks.filter((block) => block.lang === 'js' || block.lang === 'javascript');
    const allScript = scriptBlocks.map((block) => block.code).join('\n\n');
    const declaredRequirements = normalizeDeclaredCapabilities(document.metadata.requires ?? document.metadata.capabilities);
    const declaredHostPermissions = normalizeDeclaredHostPermissions(document.metadata.hostPermissions ?? document.metadata.permissions);
    for (const block of scriptBlocks) {
        lifecycleUsage[getHook(block)] += 1;
    }
    for (const { name, patterns } of CAPABILITY_PATTERNS) {
        if (patterns.some((pattern) => pattern.test(allScript))) {
            capabilities.add(name);
        }
    }
    for (const capability of declaredRequirements.capabilities) {
        capabilities.add(capability);
    }
    if ((document.blobBlocks?.length ?? 0) > 0)
        capabilities.add('blobs');
    if ((document.timedBlocks?.length ?? 0) > 0)
        capabilities.add('timed');
    if ((document.logicBlocks?.length ?? 0) > 0)
        capabilities.add('logic');
    if ((document.wgslShaders?.length ?? 0) > 0 || document.metadata.shaders)
        capabilities.add('shader');
    const modules = normalizeModules(document.metadata.modules);
    if (modules.length > 0)
        capabilities.add('modules');
    if (declaredRequirements.unknown.length > 0) {
        warnings.set('CPDECL001', createWarning('CPDECL001', `Unknown capability names declared in frontmatter requires/capabilities (${declaredRequirements.unknown.join(', ')}). These entries were ignored during compile analysis.`, { category: 'capability' }));
    }
    if (declaredHostPermissions.unknown.length > 0) {
        warnings.set('CPDECL002', createWarning('CPDECL002', `Unknown host permission names declared in frontmatter hostPermissions/permissions (${declaredHostPermissions.unknown.join(', ')}). These entries were preserved in metadata but are not part of the known compile allowlist.`, { category: 'capability' }));
    }
    if (/\bmodules\.load(All)?\s*\(/.test(allScript)) {
        warnings.set('CPDYN001', createWarning('CPDYN001', 'Dynamic modules.load usage detected. Strict compiled mode should require explicit declarations.', { category: 'dynamic-behavior' }));
    }
    if (/\b(eval|Function)\s*\(/.test(allScript)) {
        warnings.set('CPSEC001', createWarning('CPSEC001', 'Dynamic code evaluation detected. Compiled backends should reject or lower this explicitly.', { severity: 'error', category: 'security' }));
    }
    if (/\bimport\s*\(/.test(allScript)) {
        warnings.set('CPDYN002', createWarning('CPDYN002', 'Dynamic import() detected in document code. Compiled mode will need a manifest-based allowlist.', { category: 'dynamic-behavior' }));
    }
    if (/\bfetch\s*\(/.test(allScript)) {
        warnings.set('CPPORT001', createWarning('CPPORT001', 'Direct fetch() detected in document code. Browser-dev semantics may not map cleanly to native backends.', { category: 'portability' }));
    }
    const backendAdapterMatches = collectMatchedNames(allScript, BACKEND_ADAPTER_RULES);
    if (backendAdapterMatches.length > 0) {
        warnings.set('CPPORT002', createWarning('CPPORT002', `Portability review: backend-adapter surfaces detected (${backendAdapterMatches.join(', ')}). These APIs are useful, but they still need stable Storie-level contracts before they should be treated as backend-neutral compile semantics. The new audio.asset/audio.analysis/audio.play handle layer is the preferred migration target for portable audio work.`, { category: 'portability' }));
    }
    const jsOnlyMatches = collectMatchedNames(allScript, JS_ONLY_RULES);
    if (jsOnlyMatches.length > 0) {
        warnings.set('CPPORT003', createWarning('CPPORT003', `JS-only runtime access detected (${jsOnlyMatches.join(', ')}). Portable or Nim-target compilation should reject, isolate, or replace these browser-specific APIs.`, { severity: 'error', category: 'portability' }));
    }
    return {
        capabilities: Array.from(capabilities).sort(),
        modules,
        lifecycleUsage,
        warnings: Array.from(warnings.values()),
    };
}
//# sourceMappingURL=analyze.js.map