import type { CompileCapabilityName, CompilePortabilityProfile, CompileTarget, CompileWarning } from './ir.js';
import type { RuntimeAssemblyCapabilityStatus, RuntimeAssemblyCapabilitySurfaceDetail } from '../runtime/capability-api.js';

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

export interface CompileManifestDocumentContract {
  exports: string[];
  accepts: string[];
  hostPermissions: string[];
}

export interface CompileManifestRuntimeAssembly {
  apiSurface: string[];
  runtimePackConstructibleApi: string[];
  hostRequiredApi: string[];
  capabilityStatus: Record<string, RuntimeAssemblyCapabilityStatus>;
  capabilitySurfaceDetails: Record<string, RuntimeAssemblyCapabilitySurfaceDetail>;
  capabilityHostAdapters: Record<string, string[]>;
  runtimePackImports: Record<string, string[]>;
}

export interface CompileManifest {
  version: 1;
  sourcePath: string;
  target: CompileTarget;
  portabilityProfile: CompilePortabilityProfile;
  generatedAt: string;
  documentName: string;
  capabilityPacks: CompileCapabilityName[];
  modules: string[];
  documentContract: CompileManifestDocumentContract;
  runtimeAssembly: CompileManifestRuntimeAssembly;
  lifecycleUsage: CompileManifestLifecycleUsage;
  assets: CompileManifestAssetSummary;
  warnings: CompileWarning[];
}