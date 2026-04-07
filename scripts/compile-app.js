import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const distEntry = resolve(rootDir, 'dist', 'main.js');

function printUsage() {
  console.log('Usage: node scripts/compile-app.js <input.md> [outDir] [--target web|tauri|os]');
}

function parseArgs(argv) {
  const positional = [];
  let target = 'web';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--target') {
      target = argv[i + 1] || target;
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  return {
    inputPath: positional[0],
    outDir: positional[1],
    target,
  };
}

async function main() {
  const { inputPath, outDir, target } = parseArgs(process.argv.slice(2));
  if (!inputPath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const absoluteInput = resolve(process.cwd(), inputPath);
  const absoluteOutDir = resolve(process.cwd(), outDir || join('generated', relative(rootDir, absoluteInput).replace(/\.md$/i, '')));
  const markdown = readFileSync(absoluteInput, 'utf8');
  const { compileMarkdownApp } = await import(distEntry);
  const compiled = await compileMarkdownApp(markdown, {
    sourcePath: relative(rootDir, absoluteInput),
    target,
  });

  mkdirSync(absoluteOutDir, { recursive: true });
  for (const file of compiled.files) {
    const outputPath = join(absoluteOutDir, file.path);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, file.contents, 'utf8');
  }

  console.log(`Compiled scaffold written to ${relative(process.cwd(), absoluteOutDir)}`);
  console.log(`  document: ${compiled.manifest.documentName}`);
  console.log(`  target: ${compiled.manifest.target}`);
  console.log(`  runtime packs: ${compiled.manifest.capabilityPacks.join(', ') || '(none)'}`);
  console.log(`  modules: ${compiled.manifest.modules.join(', ') || '(none)'}`);
  console.log(`  warnings: ${compiled.manifest.warnings.length}`);
}

main().catch((error) => {
  console.error('Failed to compile Storie app scaffold:', error);
  process.exitCode = 1;
});