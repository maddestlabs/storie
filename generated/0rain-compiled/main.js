import manifest from './manifest.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import { behaviorBlocks } from './behavior.js';
import { createCompiledAppRuntime } from './runtime.js';

export function describeCompiledApp() {
  return { manifest, content, behaviorBlocks };
}

export { createCompiledAppRuntime };
