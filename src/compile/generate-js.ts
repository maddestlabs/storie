import type { CompileAppIR, CompileBehaviorBlock } from './ir.js';
import type { CompileManifest } from './manifest.js';

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

export function generateCompileScaffold(app: CompileAppIR, manifest: CompileManifest): GeneratedCompileFile[] {
  const documentSummary = {
    metadata: app.content.metadata,
    sections: app.content.sections,
    assets: app.assets,
  };
  const warningLines = manifest.warnings.length > 0
    ? manifest.warnings.map((warning) => `- [${warning.code}] ${warning.message}`).join('\n')
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
      path: 'runtime.js',
      contents: [
        "import manifest from './manifest.json' with { type: 'json' };",
        "import content from './content.json' with { type: 'json' };",
        "import { createCompiledBehavior } from './behavior.js';",
        '',
        'export function createCompiledAppRuntime(api = {}, options = {}) {',
        '  const scope = options.scope ?? {};',
        '  const behavior = createCompiledBehavior(api, { ...options, scope });',
        '  let currentSectionId = options.currentSectionId ?? null;',
        '  return {',
        '    manifest,',
        '    content,',
        '    scope,',
        '    behavior,',
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
      ].join('\n') + '\n',
    },
    {
      path: 'main.js',
      contents:
        "import manifest from './manifest.json' with { type: 'json' };\n" +
        "import content from './content.json' with { type: 'json' };\n" +
        "import { behaviorBlocks } from './behavior.js';\n" +
        "import { createCompiledAppRuntime } from './runtime.js';\n\n" +
        'export function describeCompiledApp() {\n' +
        '  return { manifest, content, behaviorBlocks };\n' +
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
        'Generated artifacts:',
        '- manifest.json: compile manifest and detected runtime packs',
        '- content.json: normalized document content summary',
        '- behavior.js: lowered lifecycle handlers and preserved global scope bindings',
        '- runtime.js: small adapter that executes the compiled handlers with a supplied API context',
        '- main.js: minimal inspection and runtime entrypoint',
        '',
        'Warnings:',
        warningLines,
        '',
        'This output still expects the host to provide a compatible Storie API object. The next step is replacing that broad API with narrower capability-pack imports.',
      ].join('\n') + '\n',
    },
  ];
}