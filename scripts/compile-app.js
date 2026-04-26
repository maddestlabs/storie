import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distEntry = resolve(rootDir, 'dist', 'main.js');

function printUsage() {
  console.log('Usage: node scripts/compile-app.js <input> [outDir] [--target web|tauri|os] [--profile js|portable|nim]');
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
  let target = 'web';
  let portabilityProfile = 'js';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') {
      target = argv[i + 1] || target;
      i += 1;
      continue;
    }
    if (arg === '--profile') {
      portabilityProfile = argv[i + 1] || portabilityProfile;
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    outDir: positional[1],
    target,
    portabilityProfile,
  };
}

async function main() {
  const { inputPath, outDir, target, portabilityProfile } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const { compileMarkdownApp, resolveMarkdownSource } = await import(distEntry);
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
  const absoluteOutDir = resolve(process.cwd(), outDir || join('generated', sourcePath.replace(/\.md$/i, '')));
  const compiled = await compileMarkdownApp(resolved.markdown, {
    sourcePath,
    target,
    portabilityProfile,
  });

  mkdirSync(absoluteOutDir, { recursive: true });
  for (const file of compiled.files) {
    const outputPath = join(absoluteOutDir, file.path);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, file.contents, 'utf8');
  }

  console.log(`Compiled scaffold written to ${relative(process.cwd(), absoluteOutDir)}`);
  console.log(`  document: ${compiled.manifest.documentName}`);
  console.log(`  source: ${sourcePath}`);
  console.log(`  target: ${compiled.manifest.target}`);
  console.log(`  profile: ${compiled.manifest.portabilityProfile}`);
  console.log(`  runtime packs: ${compiled.manifest.capabilityPacks.join(', ') || '(none)'}`);
  console.log(`  modules: ${compiled.manifest.modules.join(', ') || '(none)'}`);
  console.log(`  warnings: ${compiled.manifest.warnings.length}`);
}

main().catch((error) => {
  if (error && error.name === 'CompilePolicyError' && Array.isArray(error.warnings)) {
    console.error(`Failed to compile Storie app scaffold for profile "${error.profile}":`);
    for (const warning of error.warnings) {
      console.error(`  [${warning.code}] (${warning.severity}/${warning.category}) ${warning.message}`);
    }
    console.error('See documentation/COMPILE_WARNING_CODES.md for migration guidance.');
  } else {
    console.error('Failed to compile Storie app scaffold:', error);
  }
  process.exitCode = 1;
});