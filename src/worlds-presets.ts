import type { WorldsConfig } from './worlds-types.js';

export type WorldsPresetName = 'story' | 'story-editor';

export interface WorldsPresetCameraShake {
  enabled: boolean;
  strength: number;
  rate: number;
  translate: { x: number; y: number; z: number };
  rotate: { x: number; y: number; z: number };
}

export interface WorldsPresetCamera {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  fov: number;
  easeSpeed: { position: number; rotation: number };
  shake?: WorldsPresetCameraShake;
}

export interface WorldsPreset {
  name: WorldsPresetName;
  label: string;
  description: string;
  defaults: Partial<WorldsConfig>;
  camera: WorldsPresetCamera;
}

function deg(value: number): number {
  return value * Math.PI / 180;
}

function clonePreset(preset: WorldsPreset): WorldsPreset {
  return {
    name: preset.name,
    label: preset.label,
    description: preset.description,
    defaults: {
      ...preset.defaults,
    },
    camera: {
      position: { ...preset.camera.position },
      rotation: { ...preset.camera.rotation },
      fov: preset.camera.fov,
      easeSpeed: { ...preset.camera.easeSpeed },
      ...(preset.camera.shake ? {
        shake: {
          enabled: preset.camera.shake.enabled,
          strength: preset.camera.shake.strength,
          rate: preset.camera.shake.rate,
          translate: { ...preset.camera.shake.translate },
          rotate: { ...preset.camera.shake.rotate },
        }
      } : {})
    }
  };
}

const PRESETS: Record<WorldsPresetName, WorldsPreset> = {
  story: {
    name: 'story',
    label: 'Story',
    description: 'Oblique Worlds presentation tuned for immersive narrative docs.',
    defaults: {
      keepRotation: true,
      straightenOnFocus: true,
      screenSpaceRecenter: true,
      screenSpaceRecenterIters: 5,
      defaultSectionWidth: 70,
      defaultSectionHeight: 24,
      autoLayoutSpacing: 50,
      sectionBorderEnabled: false,
      sectionBackground: 'shader:ruledlines;paperPlaneZ=focus'
    },
    camera: {
      position: { x: 0, y: 55, z: 320 },
      rotation: { x: deg(-4), y: deg(4), z: 0 },
      fov: deg(42),
      easeSpeed: { position: 0.18, rotation: 0.12 },
      shake: {
        enabled: true,
        strength: 1.0,
        rate: 0.20,
        translate: { x: 1.2, y: 0.9, z: 0.4 },
        rotate: { x: deg(0.55), y: deg(0.65), z: 0 }
      }
    }
  },
  'story-editor': {
    name: 'story-editor',
    label: 'Story Editor',
    description: 'Stable Worlds authoring view with readable cards and no camera shake.',
    defaults: {
      keepRotation: true,
      straightenOnFocus: true,
      screenSpaceRecenter: true,
      screenSpaceRecenterIters: 5,
      defaultSectionWidth: 78,
      defaultSectionHeight: 26,
      autoLayoutSpacing: 60,
      sectionBorderEnabled: true,
      sectionBorderWidth: 2,
      sectionBackground: 'surface'
    },
    camera: {
      position: { x: 0, y: 38, z: 300 },
      rotation: { x: deg(-2.5), y: 0, z: 0 },
      fov: deg(48),
      easeSpeed: { position: 0.2, rotation: 0.14 }
    }
  }
};

export function listWorldsPresetNames(): WorldsPresetName[] {
  return Object.keys(PRESETS) as WorldsPresetName[];
}

export function getWorldsPreset(name: string): WorldsPreset | null {
  const key = String(name ?? '').trim().toLowerCase() as WorldsPresetName;
  const preset = PRESETS[key];
  return preset ? clonePreset(preset) : null;
}