import { parseMarkdown } from '../markdown.js';
import { analyzeMarkdownDocument } from './analyze.js';
import { generateCompileScaffold } from './generate-js.js';
import { sectionTreeToCompileNodes } from './ir.js';
import { CAPABILITY_RUNTIME_PACK_IMPORTS, collectCapabilityAssemblyStatus, collectCapabilityApiNames, collectCapabilityHostAdapters, collectCapabilitySurfaceDetails, collectHostRequiredApiNames, collectRuntimePackConstructibleApiNames, } from '../runtime/capability-api.js';
export class CompilePolicyError extends Error {
    profile;
    warnings;
    constructor(profile, warnings) {
        const summary = warnings.map((warning) => `${warning.code}: ${warning.message}`).join(' | ');
        super(`Compilation failed for portability profile "${profile}" due to policy violations: ${summary}`);
        this.name = 'CompilePolicyError';
        this.profile = profile;
        this.warnings = warnings;
    }
}
function normalizeSourcePath(sourcePath) {
    const normalized = String(sourcePath ?? 'document.md').trim();
    return normalized || 'document.md';
}
function normalizePortabilityProfile(profile) {
    const normalized = String(profile ?? 'js').trim().toLowerCase();
    switch (normalized) {
        case 'portable':
            return 'portable';
        case 'nim':
            return 'nim';
        default:
            return 'js';
    }
}
function shouldFailWarningForProfile(profile, warning) {
    if (profile === 'js')
        return false;
    if (profile === 'portable')
        return warning.severity === 'error';
    return warning.severity === 'error' || warning.category === 'portability';
}
function enforceCompilePolicy(profile, warnings) {
    const blockingWarnings = warnings.filter((warning) => shouldFailWarningForProfile(profile, warning));
    if (blockingWarnings.length > 0) {
        throw new CompilePolicyError(profile, blockingWarnings);
    }
}
function collectBlockingWarnings(profile, warnings) {
    return warnings.filter((warning) => shouldFailWarningForProfile(profile, warning));
}
function findSectionForLine(sections, line) {
    for (const section of sections) {
        if (line >= section.startLine && line <= section.endLine) {
            for (const child of section.children) {
                const nested = findSectionForLine([child], line);
                if (nested)
                    return nested;
            }
            return String(section.id ?? `${section.title}-${section.startLine}`);
        }
    }
    return null;
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
function slugifySectionRef(value) {
    const slug = String(value ?? '')
        .toLowerCase()
        .trim()
        .replace(/[`*_~]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'section';
}
function flattenSections(sections) {
    const out = [];
    for (const section of sections) {
        out.push(section);
        if (section.children.length > 0) {
            out.push(...flattenSections(section.children));
        }
    }
    return out;
}
function resolveTargetSectionRef(document, block) {
    const raw = String(block.metadata?.section ?? '').trim();
    if (!raw)
        return null;
    const containingSectionRef = findSectionForLine(document.sections, block.startLine);
    if (raw === 'current')
        return containingSectionRef;
    const flat = flattenSections(document.sections);
    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric < flat.length) {
        return String(flat[numeric].id ?? `${flat[numeric].title}-${flat[numeric].startLine}`);
    }
    const wantedSlug = slugifySectionRef(raw);
    const matched = flat.find((section) => slugifySectionRef(section.title) === wantedSlug || slugifySectionRef(String(section.id ?? '')) === wantedSlug);
    return matched ? String(matched.id ?? `${matched.title}-${matched.startLine}`) : null;
}
function collectGlobalBindings(blocks) {
    const globals = blocks.filter((block) => block.hook === 'global');
    const collected = new Map();
    const reserved = new Set(['true', 'false', 'null', 'undefined', 'NaN', 'Infinity']);
    for (const block of globals) {
        const lines = block.code.split('\n');
        let depth = 0;
        for (const line of lines) {
            const withoutComment = line.replace(/\/\/.*$/, '');
            const trimmed = withoutComment.trim();
            if (depth === 0) {
                const functionMatch = trimmed.match(/^function\s+([A-Za-z_$][\w$]*)\s*\(/);
                if (functionMatch) {
                    if (!reserved.has(functionMatch[1]))
                        collected.set(functionMatch[1], 'function');
                }
                const declMatch = trimmed.match(/^(var|let|const)\s+(.+?);?$/);
                if (declMatch) {
                    const kind = declMatch[1];
                    const nameMatch = declMatch[2].match(/^([A-Za-z_$][\w$]*)/);
                    if (nameMatch && !reserved.has(nameMatch[1]))
                        collected.set(nameMatch[1], kind);
                }
            }
            let inSingle = false;
            let inDouble = false;
            let inTemplate = false;
            let escaped = false;
            for (const ch of line) {
                if (escaped) {
                    escaped = false;
                    continue;
                }
                if (ch === '\\') {
                    escaped = true;
                    continue;
                }
                if (!inDouble && !inTemplate && ch === '\'') {
                    inSingle = !inSingle;
                    continue;
                }
                if (!inSingle && !inTemplate && ch === '"') {
                    inDouble = !inDouble;
                    continue;
                }
                if (!inSingle && !inDouble && ch === '`') {
                    inTemplate = !inTemplate;
                    continue;
                }
                if (inSingle || inDouble || inTemplate)
                    continue;
                if (ch === '{')
                    depth += 1;
                if (ch === '}')
                    depth = Math.max(0, depth - 1);
            }
        }
    }
    return Array.from(collected.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([name, kind]) => ({ name, kind }));
}
function normalizeStringList(rawValue) {
    if (Array.isArray(rawValue)) {
        return rawValue.map((value) => String(value).trim()).filter(Boolean);
    }
    if (rawValue === undefined || rawValue === null)
        return [];
    const text = String(rawValue).trim();
    if (!text)
        return [];
    if (text.includes(',')) {
        return text.split(',').map((value) => value.trim()).filter(Boolean);
    }
    return [text];
}
function extractDocumentContract(metadata) {
    return {
        exports: normalizeStringList(metadata.exports),
        accepts: normalizeStringList(metadata.accepts),
        hostPermissions: normalizeStringList(metadata.hostPermissions ?? metadata.permissions),
    };
}
function buildBehaviorBlocks(document) {
    let index = 0;
    return document.codeBlocks
        .filter((block) => block.lang === 'js' || block.lang === 'javascript')
        .map((block) => {
        index += 1;
        return {
            id: `block-${index}`,
            hook: getHook(block),
            code: block.code,
            startLine: block.startLine,
            endLine: block.endLine,
            sectionRef: findSectionForLine(document.sections, block.startLine),
            targetSectionRef: resolveTargetSectionRef(document, block),
            metadata: { ...(block.metadata ?? {}) },
        };
    });
}
function createManifest(app, sourcePath, portabilityProfile) {
    const documentContract = extractDocumentContract(app.content.metadata);
    const capabilityPacks = app.capability.capabilities;
    const runtimePackImports = capabilityPacks.reduce((acc, capability) => {
        acc[capability] = [...(CAPABILITY_RUNTIME_PACK_IMPORTS[capability] ?? [])];
        return acc;
    }, {});
    return {
        version: 1,
        sourcePath,
        target: app.target,
        portabilityProfile,
        generatedAt: new Date().toISOString(),
        documentName: String(app.content.metadata.name ?? sourcePath),
        capabilityPacks,
        modules: app.capability.modules,
        documentContract,
        runtimeAssembly: {
            apiSurface: collectCapabilityApiNames(capabilityPacks),
            runtimePackConstructibleApi: collectRuntimePackConstructibleApiNames(capabilityPacks),
            hostRequiredApi: collectHostRequiredApiNames(capabilityPacks),
            capabilityStatus: collectCapabilityAssemblyStatus(capabilityPacks),
            capabilitySurfaceDetails: collectCapabilitySurfaceDetails(capabilityPacks),
            capabilityHostAdapters: collectCapabilityHostAdapters(capabilityPacks),
            runtimePackImports,
        },
        lifecycleUsage: {
            global: app.behavior.blocks.filter((block) => block.hook === 'global').length,
            init: app.behavior.blocks.filter((block) => block.hook === 'init').length,
            update: app.behavior.blocks.filter((block) => block.hook === 'update').length,
            render: app.behavior.blocks.filter((block) => block.hook === 'render').length,
            input: app.behavior.blocks.filter((block) => block.hook === 'input').length,
            drop: app.behavior.blocks.filter((block) => block.hook === 'drop').length,
            export: app.behavior.blocks.filter((block) => block.hook === 'export').length,
            enter: app.behavior.blocks.filter((block) => block.hook === 'enter').length,
        },
        assets: {
            timedBlocks: app.assets.timedBlockNames.length,
            logicBlocks: app.assets.logicBlockNames.length,
            blobBlocks: app.assets.blobNames.length,
            shaderBlocks: app.assets.shaderNames.length,
        },
        warnings: app.capability.warnings,
    };
}
export async function validateMarkdownApp(markdown, options = {}) {
    const portabilityProfile = normalizePortabilityProfile(options.portabilityProfile);
    const document = await parseMarkdown(markdown);
    const analysis = analyzeMarkdownDocument(document);
    const blockingWarnings = collectBlockingWarnings(portabilityProfile, analysis.warnings);
    return {
        document,
        analysis,
        portabilityProfile,
        blockingWarnings,
        ok: blockingWarnings.length === 0,
    };
}
export async function compileMarkdownApp(markdown, options = {}) {
    const sourcePath = normalizeSourcePath(options.sourcePath);
    const target = options.target ?? 'web';
    const validation = await validateMarkdownApp(markdown, options);
    const portabilityProfile = validation.portabilityProfile;
    const document = validation.document;
    const analysis = validation.analysis;
    enforceCompilePolicy(portabilityProfile, analysis.warnings);
    const app = {
        target,
        sourcePath,
        content: {
            metadata: document.metadata,
            sections: sectionTreeToCompileNodes(document.sections),
            rawDocument: document,
        },
        behavior: {
            blocks: buildBehaviorBlocks(document),
            globalBindings: [],
        },
        capability: {
            capabilities: analysis.capabilities,
            modules: analysis.modules,
            warnings: analysis.warnings,
        },
        assets: {
            timedBlockNames: (document.timedBlocks ?? []).map((block) => block.name),
            logicBlockNames: (document.logicBlocks ?? []).map((block, index) => String(block.name ?? block.sectionId ?? `logic-${index + 1}`)),
            blobNames: (document.blobBlocks ?? []).map((block) => block.name),
            shaderNames: (document.wgslShaders ?? []).map((shader) => shader.name),
        },
    };
    app.behavior.globalBindings = collectGlobalBindings(app.behavior.blocks);
    const manifest = createManifest(app, sourcePath, portabilityProfile);
    const files = generateCompileScaffold(app, manifest);
    return {
        document,
        app,
        manifest,
        files,
    };
}
//# sourceMappingURL=compile.js.map