import type { CompileCapabilityName, CompileTarget } from './ir.js';

export interface CompileWarning {
  code: string;
  message: string;
}

export interface CompileManifestLifecycleUsage {
  global: number;
  init: number;
  update: number;
  render: number;
  input: number;
  drop: number;
  export: number;
  enter: number;
}

export interface CompileManifestAssetSummary {
  timedBlocks: number;
  logicBlocks: number;
  blobBlocks: number;
  shaderBlocks: number;
}

export interface CompileManifest {
  version: 1;
  sourcePath: string;
  target: CompileTarget;
  generatedAt: string;
  documentName: string;
  capabilityPacks: CompileCapabilityName[];
  modules: string[];
  lifecycleUsage: CompileManifestLifecycleUsage;
  assets: CompileManifestAssetSummary;
  warnings: CompileWarning[];
}