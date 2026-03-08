const engine = {
  worldsConfig: { sectionBackground: 'shader:testShader;speed=1.5;colors=0.8,0.6,0.4' }
};

function parseWorldsSectionBackgroundShader() {
  const v = engine.worldsConfig.sectionBackground;
  if (typeof v !== 'string') return null;

  if (v.startsWith('shader:')) {
    const shaderSpec = v.substring(7).trim();
    const [name, ...uniformSpecs] = shaderSpec.split(';');

    const uniforms = {};
    for (const spec of uniformSpecs) {
      const [key, value] = spec.split('=');
      if (key && value) {
        const trimmedKey = key.trim();
        const trimmedValue = value.trim();

        if (trimmedValue.includes(',')) {
          uniforms[trimmedKey] = trimmedValue.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
        } else {
          const num = parseFloat(trimmedValue);
          if (!isNaN(num)) {
            uniforms[trimmedKey] = num;
          }
        }
      }
    }

    return { name: name.trim(), uniforms };
  }

  return null;
}

console.log('Parsed shader:', JSON.stringify(parseWorldsSectionBackgroundShader(), null, 2));