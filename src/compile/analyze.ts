import type { CodeBlock, MarkdownDocument } from '../types.js';
import type { CompileCapabilityName, CompileLifecycleHook } from './ir.js';

export interface CompileAnalysis {
  capabilities: CompileCapabilityName[];
  modules: string[];
  lifecycleUsage: Record<CompileLifecycleHook, number>;
  warnings: string[];
}

const CAPABILITY_PATTERNS: Array<{ name: CompileCapabilityName; patterns: RegExp[] }> = [
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

function normalizeModules(rawModules: unknown): string[] {
  if (Array.isArray(rawModules)) {
    return rawModules.map((value) => String(value).trim()).filter(Boolean);
  }
  if (rawModules === undefined || rawModules === null) return [];
  const text = String(rawModules).trim();
  return text ? [text] : [];
}

function getHook(block: CodeBlock): CompileLifecycleHook {
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

export function analyzeMarkdownDocument(document: MarkdownDocument): CompileAnalysis {
  const lifecycleUsage: Record<CompileLifecycleHook, number> = {
    global: 0,
    init: 0,
    update: 0,
    render: 0,
    input: 0,
    drop: 0,
    export: 0,
    enter: 0,
  };
  const capabilities = new Set<CompileCapabilityName>();
  const warnings = new Set<string>();
  const scriptBlocks = document.codeBlocks.filter((block) => block.lang === 'js' || block.lang === 'javascript');
  const allScript = scriptBlocks.map((block) => block.code).join('\n\n');

  for (const block of scriptBlocks) {
    lifecycleUsage[getHook(block)] += 1;
  }

  for (const { name, patterns } of CAPABILITY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(allScript))) {
      capabilities.add(name);
    }
  }

  if ((document.blobBlocks?.length ?? 0) > 0) capabilities.add('blobs');
  if ((document.timedBlocks?.length ?? 0) > 0) capabilities.add('timed');
  if ((document.wgslShaders?.length ?? 0) > 0 || document.metadata.shaders) capabilities.add('shader');

  const modules = normalizeModules(document.metadata.modules);
  if (modules.length > 0) capabilities.add('modules');

  if (/\bmodules\.load(All)?\s*\(/.test(allScript)) {
    warnings.add('Dynamic modules.load usage detected. Strict compiled mode should require explicit declarations.');
  }

  if (/\b(eval|Function)\s*\(/.test(allScript)) {
    warnings.add('Dynamic code evaluation detected. Compiled backends should reject or lower this explicitly.');
  }

  if (/\bimport\s*\(/.test(allScript)) {
    warnings.add('Dynamic import() detected in document code. Compiled mode will need a manifest-based allowlist.');
  }

  if (/\bfetch\s*\(/.test(allScript)) {
    warnings.add('Direct fetch() detected in document code. Browser-dev semantics may not map cleanly to native backends.');
  }

  return {
    capabilities: Array.from(capabilities).sort(),
    modules,
    lifecycleUsage,
    warnings: Array.from(warnings),
  };
}