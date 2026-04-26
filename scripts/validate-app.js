import { existsSync, readFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distEntry = resolve(rootDir, 'dist', 'main.js');

function printUsage() {
  console.log('Usage: node scripts/validate-app.js <input> [--profile js|portable|nim]');
  console.log('  <input> may be a file path, demo ref (demo:name), gist ref, or decode ref');
}

function normalizeSourcePath(resolved, inputPath) {
  if (!resolved.sourcePath) {
    return `${resolved.kind}/${inputPath.replace(/[:/\\]+/g, '-')}`;
  }
  if (resolved.kind === 'file' || resolved.kind === 'demo') {
    return relative(rootDir, resolve(process.cwd(), resolved.sourcePath));
  }
  return `${resolved.kind}/${resolved.sourcePath}`;
}

function parseArgs(argv) {
  const positional = [];
  let portabilityProfile = 'js';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--profile') {
      portabilityProfile = argv[i + 1] || portabilityProfile;
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    portabilityProfile,
  };
}

async function main() {
  const { inputPath, portabilityProfile } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { validateMarkdownApp, resolveMarkdownSource } = await import(distEntry);
  const resolved = await resolveMarkdownSource(inputPath, {
    demoPaths: [resolve(rootDir, 'docs', 'demos', '{name}'), resolve(rootDir, '{name}')],
    fileExists: (filePath) => existsSync(resolve(process.cwd(), filePath)),
    readTextFile: (filePath) => readFileSync(resolve(process.cwd(), filePath), 'utf8'),
    fetchJson: async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load ${url} (HTTP ${response.status})`);
      }
      return response.json();
    },
  });
  const sourcePath = normalizeSourcePath(resolved, inputPath);
  const result = await validateMarkdownApp(resolved.markdown, {
    sourcePath,
    portabilityProfile,
  });

  console.log(`Validation result for ${sourcePath}`);
  console.log(`  profile: ${result.portabilityProfile}`);
  console.log(`  status: ${result.ok ? 'ok' : 'blocked'}`);
  console.log(`  warnings: ${result.analysis.warnings.length}`);
  console.log(`  blocking warnings: ${result.blockingWarnings.length}`);

  if (result.analysis.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of result.analysis.warnings) {
      const blocking = result.blockingWarnings.some((candidate) => candidate.code === warning.code);
      console.log(`  [${warning.code}] (${warning.severity}/${warning.category})${blocking ? ' [blocking]' : ''} ${warning.message}`);
    }
    console.log('');
    console.log('See documentation/COMPILE_WARNING_CODES.md for migration guidance.');
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Failed to validate Storie app:', error);
  process.exitCode = 1;
});