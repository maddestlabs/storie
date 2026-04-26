import type { CompileAppIR, CompileBehaviorBlock } from './ir.js';
import type { CompileManifest } from './manifest.js';
import {
  CAPABILITY_RUNTIME_PACK_IMPORTS,
} from '../runtime/capability-api.js';

export interface GeneratedCompileFile {
  path: string;
  contents: string;
}

function serializeBehaviorBlocks(blocks: CompileBehaviorBlock[]): string {
  return JSON.stringify(
    blocks.map((block) => ({
      id: block.id,
      hook: block.hook,
      startLine: block.startLine + 1,
      endLine: block.endLine + 1,
      sectionRef: block.sectionRef,
      targetSectionRef: block.targetSectionRef,
      metadata: block.metadata,
      code: block.code,
    })),
    null,
    2,
  );
}

function indentCode(code: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return code
    .split('\n')
    .map((line) => (line.length > 0 ? indent + line : ''))
    .join('\n');
}

function generateBlockFunction(block: CompileBehaviorBlock, index: number): string {
  const functionName = `${block.hook}Block${index}`;
  return [
    `function ${functionName}(runtimeCtx = {}) {`,
    '  const delta = runtimeCtx.delta;',
    '  const event = runtimeCtx.event;',
    indentCode(block.code, 2),
    '}',
  ].join('\n');
}

function generateCapabilitiesModule(manifest: CompileManifest): string {
  const compiledDocumentId = manifest.sourcePath || manifest.documentName;
  const requiredApiNames = manifest.runtimeAssembly.apiSurface;
  const runtimePackConstructibleApi = manifest.runtimeAssembly.runtimePackConstructibleApi;
  const hostRequiredApi = manifest.runtimeAssembly.hostRequiredApi;
  const capabilityStatus = manifest.runtimeAssembly.capabilityStatus;
  const capabilitySurfaceDetails = manifest.runtimeAssembly.capabilitySurfaceDetails;
  const capabilityHostAdapters = manifest.runtimeAssembly.capabilityHostAdapters;
  const runtimePackImports = manifest.runtimeAssembly.runtimePackImports;

  return [
    "import { installDocumentCapabilityApiGlobals, installRuntimePackCapabilityApi } from 'storie/runtime/capability-api';",
    "import { runtimePackModules } from './runtime-packs.js';",
    '',
    `export const requiredCapabilityPacks = ${JSON.stringify(manifest.capabilityPacks, null, 2)};`,
    `export const requiredModules = ${JSON.stringify(manifest.modules, null, 2)};`,
    `export const documentContract = ${JSON.stringify(manifest.documentContract, null, 2)};`,
    `export const compiledDocumentId = ${JSON.stringify(compiledDocumentId)};`,
    `export const requiredApiNames = ${JSON.stringify(requiredApiNames, null, 2)};`,
    `export const runtimePackConstructibleApi = ${JSON.stringify(runtimePackConstructibleApi, null, 2)};`,
    `export const hostRequiredApi = ${JSON.stringify(hostRequiredApi, null, 2)};`,
    `export const capabilityStatus = ${JSON.stringify(capabilityStatus, null, 2)};`,
    `export const capabilitySurfaceDetails = ${JSON.stringify(capabilitySurfaceDetails, null, 2)};`,
    `export const capabilityHostAdapters = ${JSON.stringify(capabilityHostAdapters, null, 2)};`,
    `export const runtimePackImports = ${JSON.stringify(runtimePackImports, null, 2)};`,
    '',
    'export function requiresCapability(name) {',
    '  return requiredCapabilityPacks.includes(String(name));',
    '}',
    '',
    'export function allowsHostPermission(name) {',
    '  return documentContract.hostPermissions.includes(String(name));',
    '}',
    '',
    'export function createCompiledCapabilityAPI(api = {}, options = {}) {',
    '  const selected = {};',
    '  installDocumentCapabilityApiGlobals(selected, api, requiredCapabilityPacks, {',
    '    documentId: options.documentId ?? compiledDocumentId,',
    '    globalObject: options.globalObject ?? globalThis,',
    '    includeCompatibilityAliases: options.includeCompatibilityAliases ?? false,',
    '  });',
    '  installRuntimePackCapabilityApi(selected, requiredCapabilityPacks, runtimePackModules, {',
    '    documentId: options.documentId ?? compiledDocumentId,',
    '    globalObject: options.globalObject ?? globalThis,',
    '    audioContextRuntime: options.audioContextRuntime,',
    '    audioAssetDecoder: options.audioAssetDecoder,',
    '    audioExportCapture: options.audioExportCapture,',
    '    audioBufferFactory: options.audioBufferFactory,',
    '    guiFactory: options.guiFactory,',
    '    tuiFactory: options.tuiFactory,',
    '    stfxrDocumentStore: options.stfxrDocumentStore,',
    '    stfxrBakedStore: options.stfxrBakedStore,',
    '  });',
    '  return selected;',
    '}',
    '',
    'export function getRuntimePackImports(capabilityName) {',
    '  return [...(runtimePackImports[String(capabilityName)] ?? [])];',
    '}',
    '',
    'export function describeCompiledRuntimeAssembly() {',
    '  return {',
    '    capabilityPacks: requiredCapabilityPacks,',
    '    modules: requiredModules,',
    '    documentContract,',
    '    documentId: compiledDocumentId,',
    '    apiSurface: requiredApiNames,',
    '    runtimePackConstructibleApi,',
    '    hostRequiredApi,',
    '    capabilityStatus,',
    '    capabilitySurfaceDetails,',
    '    capabilityHostAdapters,',
    '    runtimePackImports,',
    '  };',
    '}',
  ].join('\n') + '\n';
}

function generateRuntimePacksModule(manifest: CompileManifest): string {
  const importBindings = new Map<string, string>();
  const importStatements: string[] = [];
  let bindingIndex = 0;

  for (const capability of manifest.capabilityPacks) {
    for (const specifier of CAPABILITY_RUNTIME_PACK_IMPORTS[capability] ?? []) {
      if (importBindings.has(specifier)) continue;
      const bindingName = `runtimePack${bindingIndex}`;
      bindingIndex += 1;
      importBindings.set(specifier, bindingName);
      importStatements.push(`import * as ${bindingName} from ${JSON.stringify(specifier)};`);
    }
  }

  const runtimePackModuleLines = manifest.capabilityPacks.map((capability) => {
    const bindings = (CAPABILITY_RUNTIME_PACK_IMPORTS[capability] ?? [])
      .map((specifier) => importBindings.get(specifier))
      .filter((bindingName): bindingName is string => typeof bindingName === 'string');
    return `  ${JSON.stringify(capability)}: [${bindings.join(', ')}],`;
  });

  return [
    ...importStatements,
    importStatements.length > 0 ? '' : '',
    'export const runtimePackModules = {',
    ...runtimePackModuleLines,
    '};',
    '',
    'export function getRuntimePackModules(capabilityName) {',
    '  return [...(runtimePackModules[String(capabilityName)] ?? [])];',
    '}',
  ].join('\n') + '\n';
}

function generateBehaviorModule(app: CompileAppIR): string {
  const behaviorJson = serializeBehaviorBlocks(app.behavior.blocks);
  const globalBlocks = app.behavior.blocks.filter((block) => block.hook === 'global');
  const nonGlobalBlocks = app.behavior.blocks.filter((block) => block.hook !== 'global');
  const globalBindings = app.behavior.globalBindings;
  const mutableGlobalNames = globalBindings.filter((binding) => binding.kind === 'var' || binding.kind === 'let').map((binding) => binding.name);
  const exportGlobalNames = globalBindings.map((binding) => binding.name);
  const blockFunctions = nonGlobalBlocks.map((block, index) => generateBlockFunction(block, index + 1)).join('\n\n');
  const registrationEntries = nonGlobalBlocks.map((block, index) => {
    const functionName = `${block.hook}Block${index + 1}`;
    return `    { id: ${JSON.stringify(block.id)}, hook: ${JSON.stringify(block.hook)}, targetSectionRef: ${JSON.stringify(block.targetSectionRef)}, fn: ${functionName} }`;
  }).join(',\n');
  const syncFromScope = mutableGlobalNames.length > 0
    ? mutableGlobalNames.map((name) => `      if (Object.prototype.hasOwnProperty.call(scope, ${JSON.stringify(name)})) ${name} = scope[${JSON.stringify(name)}];`).join('\n')
    : '';
  const syncToScope = exportGlobalNames.length > 0
    ? exportGlobalNames.map((name) => `      scope[${JSON.stringify(name)}] = ${name};`).join('\n')
    : '';
  const globalSource = globalBlocks.map((block) => block.code).join('\n\n');

  return [
    `export const behaviorBlocks = ${behaviorJson};`,
    '',
    'function shouldRunBlock(runtimeCtx, targetSectionRef) {',
    '  if (!targetSectionRef) return true;',
    '  return runtimeCtx.currentSectionId === targetSectionRef || runtimeCtx.activeSectionId === targetSectionRef;',
    '}',
    '',
    'function runRegisteredBlocks(entries, runtimeCtx, syncBindings) {',
    '  for (const entry of entries) {',
    '    if (!shouldRunBlock(runtimeCtx, entry.targetSectionRef)) continue;',
    '    syncBindings.fromScope();',
    '    entry.fn(runtimeCtx);',
    '    syncBindings.toScope();',
    '  }',
    '}',
    '',
    'export function createCompiledBehavior(api = {}, options = {}) {',
    '  const scope = options.scope ?? {};',
    '  const consoleRef = options.console ?? globalThis.console;',
    '  const MathRef = options.Math ?? globalThis.Math;',
    '  const DateRef = options.Date ?? globalThis.Date;',
    '  const {',
    '    term, termCanvas, layer, key, keys, mouse, drop, doc, host, scene, tui, gui,',
    '    getStyle, theme, themes, modules, getFrame, getTime, getDelta, audio, canvas2d, blob, ascii,',
    '    drawAscii, figlet, drawFiglet, ansi, drawAnsi, ui, webgl, webgpu, shader, compositor, worlds,',
    '    random, sys, mouseX, mouseY, mouseCellX, mouseCellY, mousePixelX, mousePixelY,',
    '    termWidth, termHeight, isExporting, getIsExporting, getParam, CompressionStream, DecompressionStream,',
    '    TextEncoder, TextDecoder, Response, atob, btoa,',
    '  } = api;',
    '  const console = consoleRef;',
    '  const Math = MathRef;',
    '  const Date = DateRef;',
    '  const syncBindings = {',
    '    fromScope() {',
    syncFromScope || '    },',
    syncFromScope ? '    },' : '',
    '    toScope() {',
    syncToScope || '    },',
    syncToScope ? '    },' : '',
    '  };',
    '',
    globalSource,
    globalSource ? '' : '',
    syncToScope ? '  syncBindings.toScope();' : '',
    '',
    blockFunctions,
    blockFunctions ? '' : '',
    '  const registeredBlocks = [',
    registrationEntries,
    '  ];',
    '',
    "  const initBlocks = registeredBlocks.filter((entry) => entry.hook === 'init');",
    "  const updateBlocks = registeredBlocks.filter((entry) => entry.hook === 'update');",
    "  const renderBlocks = registeredBlocks.filter((entry) => entry.hook === 'render');",
    "  const inputBlocks = registeredBlocks.filter((entry) => entry.hook === 'input');",
    "  const dropBlocks = registeredBlocks.filter((entry) => entry.hook === 'drop');",
    "  const exportBlocks = registeredBlocks.filter((entry) => entry.hook === 'export');",
    "  const enterBlocks = registeredBlocks.filter((entry) => entry.hook === 'enter');",
    '',
    '  return {',
    '    scope,',
    '    behaviorBlocks,',
    '    init(runtimeCtx = {}) { runRegisteredBlocks(initBlocks, runtimeCtx, syncBindings); },',
    '    update(runtimeCtx = {}) { runRegisteredBlocks(updateBlocks, runtimeCtx, syncBindings); },',
    '    render(runtimeCtx = {}) { runRegisteredBlocks(renderBlocks, runtimeCtx, syncBindings); },',
    '    input(runtimeCtx = {}) { runRegisteredBlocks(inputBlocks, runtimeCtx, syncBindings); },',
    '    drop(runtimeCtx = {}) { runRegisteredBlocks(dropBlocks, runtimeCtx, syncBindings); },',
    '    export(runtimeCtx = {}) { runRegisteredBlocks(exportBlocks, runtimeCtx, syncBindings); },',
    '    enter(sectionId, runtimeCtx = {}) {',
    '      const nextCtx = { ...runtimeCtx, currentSectionId: sectionId };',
    '      runRegisteredBlocks(enterBlocks.filter((entry) => entry.targetSectionRef === null || entry.targetSectionRef === sectionId), nextCtx, syncBindings);',
    '    },',
    '  };',
    '}',
  ].filter((line) => line !== '').join('\n') + '\n';
}

function generateKernelModule(): string {
  return [
    "import manifest from './manifest.json' with { type: 'json' };",
    "import content from './content.json' with { type: 'json' };",
    "import { createCompiledBehavior } from './behavior.js';",
    "import { createCompiledCapabilityAPI, describeCompiledRuntimeAssembly } from './capabilities.js';",
    '',
    'export function createCompiledKernel(api = {}, options = {}) {',
    '  const scope = options.scope ?? {};',
    '  const capabilityAPI = createCompiledCapabilityAPI(api, options);',
    '  const behavior = createCompiledBehavior(capabilityAPI, { ...options, scope });',
    '  let currentSectionId = options.currentSectionId ?? null;',
    '  return {',
    '    manifest,',
    '    content,',
    '    scope,',
    '    api: capabilityAPI,',
    '    behavior,',
    '    assembly: describeCompiledRuntimeAssembly(),',
    '    getCurrentSectionId() { return currentSectionId; },',
    '    setCurrentSectionId(sectionId) { currentSectionId = sectionId; },',
    '    init(extra = {}) { behavior.init({ ...extra, currentSectionId }); },',
    '    update(delta, extra = {}) { behavior.update({ ...extra, delta, currentSectionId }); },',
    '    render(extra = {}) { behavior.render({ ...extra, currentSectionId }); },',
    '    input(event, extra = {}) { behavior.input({ ...extra, event, currentSectionId }); },',
    '    drop(event, extra = {}) { behavior.drop({ ...extra, event, currentSectionId }); },',
    '    enter(sectionId, extra = {}) { currentSectionId = sectionId; behavior.enter(sectionId, { ...extra, currentSectionId: sectionId }); },',
    '  };',
    '}',
  ].join('\n') + '\n';
}

export function generateCompileScaffold(app: CompileAppIR, manifest: CompileManifest): GeneratedCompileFile[] {
  const documentSummary = {
    metadata: app.content.metadata,
    sections: app.content.sections,
    assets: app.assets,
    rawDocument: app.content.rawDocument,
  };
  const warningLines = manifest.warnings.length > 0
    ? manifest.warnings.map((warning) => `- [${warning.code}] (${warning.severity}/${warning.category}) ${warning.message}`).join('\n')
    : '- none';

  return [
    {
      path: 'manifest.json',
      contents: JSON.stringify(manifest, null, 2) + '\n',
    },
    {
      path: 'content.json',
      contents: JSON.stringify(documentSummary, null, 2) + '\n',
    },
    {
      path: 'behavior.js',
      contents: generateBehaviorModule(app),
    },
    {
      path: 'capabilities.js',
      contents: generateCapabilitiesModule(manifest),
    },
    {
      path: 'kernel.js',
      contents: generateKernelModule(),
    },
    {
      path: 'runtime-packs.js',
      contents: generateRuntimePacksModule(manifest),
    },
    {
      path: 'runtime.js',
      contents: [
        "import { createCompiledKernel } from './kernel.js';",
        "import { runtimePackModules } from './runtime-packs.js';",
        '',
        'export function createCompiledAppRuntime(api = {}, options = {}) {',
        '  return { ...createCompiledKernel(api, options), runtimePackModules };',
        '}',
      ].join('\n') + '\n',
    },
    {
      path: 'main.js',
      contents:
        "import manifest from './manifest.json' with { type: 'json' };\n" +
        "import content from './content.json' with { type: 'json' };\n" +
        "import { behaviorBlocks } from './behavior.js';\n" +
        "import { describeCompiledRuntimeAssembly } from './capabilities.js';\n" +
        "import { createCompiledAppRuntime } from './runtime.js';\n\n" +
        'export function describeCompiledApp() {\n' +
        '  return { manifest, content, behaviorBlocks, assembly: describeCompiledRuntimeAssembly() };\n' +
        '}\n\n' +
        'export { createCompiledAppRuntime };\n',
    },
    {
      path: 'README.md',
      contents: [
        '# Generated Storie Compile Scaffold',
        '',
        'This directory is a compiler scaffold, not a final runnable app bundle.',
        '',
        `Portability profile: ${manifest.portabilityProfile}`,
        '',
        'Generated artifacts:',
        '- manifest.json: compile manifest and detected runtime packs',
        '- content.json: normalized document content summary plus raw parsed document payload',
        '- behavior.js: lowered lifecycle handlers and preserved global scope bindings',
        '- capabilities.js: manifest-driven capability-pack selection plus document-aware API installation',
        '- kernel.js: minimal compiled runtime kernel for state and lifecycle dispatch',
        '- runtime-packs.js: static imports for currently mapped Storie runtime pack entrypoints',
        '- runtime.js: compatibility adapter that exposes createCompiledAppRuntime()',
        '- main.js: minimal inspection and runtime entrypoint',
        '',
        'Document contract:',
        `- exports: ${manifest.documentContract.exports.join(', ') || '(none)'}`,
        `- accepts: ${manifest.documentContract.accepts.join(', ') || '(none)'}`,
        `- host permissions: ${manifest.documentContract.hostPermissions.join(', ') || '(none)'}`,
        `- runtime-pack constructible api: ${manifest.runtimeAssembly.runtimePackConstructibleApi.join(', ') || '(none)'}`,
        `- host-required api: ${manifest.runtimeAssembly.hostRequiredApi.join(', ') || '(none)'}`,
        `- capability status: ${Object.entries(manifest.runtimeAssembly.capabilityStatus).map(([name, status]) => `${name}=${status}`).join(', ') || '(none)'}`,
        `- capability surface details: ${Object.entries(manifest.runtimeAssembly.capabilitySurfaceDetails).map(([name, detail]) => `${name}[pack=${detail.packConstructible.join('|') || '(none)'}; host=${detail.hostRequired.join('|') || '(none)'}]`).join(', ') || '(none)'}`,
        `- capability host adapters: ${Object.entries(manifest.runtimeAssembly.capabilityHostAdapters).map(([name, adapters]) => `${name}[${adapters.join('|') || '(none)'}]`).join(', ') || '(none)'}`,
        '',
        'Warnings:',
        warningLines,
        '',
        'Warning code reference: documentation/COMPILE_WARNING_CODES.md',
        '',
        'This output still expects the host to provide a compatible broad Storie API object. The bundled raw document payload is included so a host can reconstruct asset stores while executing compiled behavior.',
        'The generated kernel now installs the same document-aware capability wrappers used by the sandbox before running compiled behavior, but the next step is replacing that broad host API dependency with real capability-pack assembly.',
      ].join('\n') + '\n',
    },
  ];
}