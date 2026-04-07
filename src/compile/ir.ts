import type { MarkdownDocument, Section } from '../types.js';

export type CompileTarget = 'web' | 'tauri' | 'os';

export type CompileCapabilityName =
  | 'terminal'
  | 'ui'
  | 'gui'
  | 'worlds'
  | 'audio'
  | 'shader'
  | 'blobs'
  | 'timed'
  | 'random'
  | 'themes'
  | 'modules'
  | 'host'
  | 'sys'
  | 'input'
  | 'export';

export type CompileLifecycleHook = 'global' | 'init' | 'update' | 'render' | 'input' | 'drop' | 'export' | 'enter';

export interface CompileSectionNode {
  id: string;
  title: string;
  level: number;
  startLine: number;
  endLine: number;
  children: CompileSectionNode[];
}

export interface CompileBehaviorBlock {
  id: string;
  hook: CompileLifecycleHook;
  code: string;
  startLine: number;
  endLine: number;
  sectionRef: string | null;
  targetSectionRef: string | null;
  metadata: Record<string, string>;
}

export interface CompileGlobalBinding {
  name: string;
  kind: 'var' | 'let' | 'const' | 'function';
}

export interface CompileContentIR {
  metadata: Record<string, unknown>;
  sections: CompileSectionNode[];
  rawDocument: MarkdownDocument;
}

export interface CompileBehaviorIR {
  blocks: CompileBehaviorBlock[];
  globalBindings: CompileGlobalBinding[];
}

export interface CompileCapabilityIR {
  capabilities: CompileCapabilityName[];
  modules: string[];
  warnings: string[];
}

export interface CompileAssetIR {
  timedBlockNames: string[];
  blobNames: string[];
  shaderNames: string[];
}

export interface CompileAppIR {
  target: CompileTarget;
  sourcePath: string;
  content: CompileContentIR;
  behavior: CompileBehaviorIR;
  capability: CompileCapabilityIR;
  assets: CompileAssetIR;
}

export function sectionTreeToCompileNodes(sections: Section[]): CompileSectionNode[] {
  return sections.map((section) => ({
    id: String(section.id ?? `${section.title}-${section.startLine}`),
    title: section.title,
    level: section.level,
    startLine: section.startLine,
    endLine: section.endLine,
    children: sectionTreeToCompileNodes(section.children),
  }));
}