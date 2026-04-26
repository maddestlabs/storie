import manifest from './manifest.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import { createCompiledBehavior } from './behavior.js';

export function createCompiledAppRuntime(api = {}, options = {}) {
  const scope = options.scope ?? {};
  const behavior = createCompiledBehavior(api, { ...options, scope });
  let currentSectionId = options.currentSectionId ?? null;
  return {
    manifest,
    content,
    scope,
    behavior,
    getCurrentSectionId() { return currentSectionId; },
    setCurrentSectionId(sectionId) { currentSectionId = sectionId; },
    init(extra = {}) { behavior.init({ ...extra, currentSectionId }); },
    update(delta, extra = {}) { behavior.update({ ...extra, delta, currentSectionId }); },
    render(extra = {}) { behavior.render({ ...extra, currentSectionId }); },
    input(event, extra = {}) { behavior.input({ ...extra, event, currentSectionId }); },
    drop(event, extra = {}) { behavior.drop({ ...extra, event, currentSectionId }); },
    enter(sectionId, extra = {}) { currentSectionId = sectionId; behavior.enter(sectionId, { ...extra, currentSectionId: sectionId }); },
  };
}
