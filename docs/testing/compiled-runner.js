const canvas = document.getElementById('canvas');
const statusText = document.getElementById('status-text');

function setStatus(text) {
  if (statusText) statusText.textContent = text;
}

function resolveCompiledAppUrl() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('app') || './0rain-compiled-latest/main.js';
  return new URL(requested, import.meta.url).href;
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.floor(window.innerWidth * dpr));
  const height = Math.max(1, Math.floor(window.innerHeight * dpr));
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
}

async function main() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  const compiledAppUrl = resolveCompiledAppUrl();
  setStatus(`Importing engine…\n${compiledAppUrl}`);

  const engineMod = await import('../storie.es.js');
  const compiledModule = await import(/* @vite-ignore */ compiledAppUrl);
  const StorieEngine = engineMod?.StorieEngine;
  if (typeof StorieEngine !== 'function') {
    throw new Error('Failed to import StorieEngine');
  }

  const engine = new StorieEngine(canvas, {
    preferWebGPU: true,
  });

  setStatus(`Loading compiled app…\n${compiledAppUrl}`);
  const loaded = await engine.loadCompiledApp('compiled', compiledModule);
  if (!loaded) {
    throw new Error('Engine failed to load compiled app');
  }

  await engine.start();
  try {
    canvas.focus();
  } catch {
    // ignore
  }

  setStatus(`Running compiled app\n${compiledAppUrl}\n\nAppend ?app=<folder>/main.js to load a different scaffold.`);
}

main().catch((error) => {
  console.error(error);
  setStatus(`Runner failed\n${error instanceof Error ? error.message : String(error)}`);
});