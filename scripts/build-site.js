/**
 * Build script: Copy site files to docs/ after library build
 */

import { copyFileSync, mkdirSync, readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const siteDir = join(rootDir, 'site');
const docsDir = join(rootDir, 'docs');

// Ensure docs directory exists
if (!existsSync(docsDir)) {
  mkdirSync(docsDir, { recursive: true });
}

/**
 * Recursively copy directory
 */
function copyDir(src, dest) {
  // Create destination directory
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src);

  for (const entry of entries) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    const stat = statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
      console.log(`  Copied: ${entry}`);
    }
  }
}

console.log('📦 Building S|torie...\n');

console.log('Generating favicons...');
execSync('npm run generate-favicons', { stdio: 'inherit' });

console.log('Copying site files to docs/...');
copyDir(siteDir, docsDir);

console.log('Copying compiled runtime modules to docs/...');
copyCompiledModules(join(rootDir, 'dist'), docsDir);

function copyFileIfExists(src, dest) {
  if (!existsSync(src)) return false;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  return true;
}

function copyCompiledModules(src, dest) {
  if (!existsSync(src)) return;
  const stat = statSync(src);
  if (stat.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const entry of readdirSync(src)) {
      copyCompiledModules(join(src, entry), join(dest, entry));
    }
    return;
  }

  if (!src.endsWith('.js') && !src.endsWith('.js.map')) return;
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function parseFrontmatterName(markdown) {
  if (typeof markdown !== 'string') return null;
  if (!markdown.startsWith('---')) return null;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return null;
  const fm = markdown.slice(3, end).split('\n');
  for (const rawLine of fm) {
    const line = String(rawLine).trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^name\s*:\s*(.+)\s*$/);
    if (!m) continue;
    let value = m[1].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.trim();
    return value || null;
  }
  return null;
}

function makeVariantSelfContained(variant) {
  const variantDir = join(docsDir, variant);
  if (!existsSync(variantDir)) return;

  console.log(`Making ${variant}/ self-contained...`);

  // Copy runtime dependencies into the variant folder so it can be hosted standalone.
  const runtimeFiles = [
    'bootstrap.js',
    'storie-site.js',
    'storie.es.js',
    'style.css',
    'video-exporter.js',
    'mp4-muxer.mjs',
  ];
  for (const fileName of runtimeFiles) {
    copyFileIfExists(join(docsDir, fileName), join(variantDir, fileName));
  }

  // Copy shared folders that runtime may load from relative paths.
  const folders = [
    { src: join(docsDir, 'assets'), dest: join(variantDir, 'assets') },
    { src: join(docsDir, 'shaders'), dest: join(variantDir, 'shaders') },
    { src: join(docsDir, 'figlets'), dest: join(variantDir, 'figlets') },
  ];
  for (const { src, dest } of folders) {
    if (existsSync(src)) copyDir(src, dest);
  }

  copyCompiledModules(join(rootDir, 'dist'), variantDir);

  // Copy the demo markdown into the variant so default content works.
  const demosDir = join(variantDir, 'demos');
  mkdirSync(demosDir, { recursive: true });
  const srcDemoMdPath = join(docsDir, 'demos', `${variant}.md`);
  const destDemoMdPath = join(demosDir, `${variant}.md`);
  copyFileIfExists(srcDemoMdPath, destDemoMdPath);

  // If the demo has a frontmatter name, apply it to the app title and manifest.
  let displayName = null;
  try {
    if (existsSync(destDemoMdPath)) {
      displayName = parseFrontmatterName(readFileSync(destDemoMdPath, 'utf8'));
    }
  } catch {
    // ignore
  }

  // Rewrite variant index.html to use only local (same-folder/child-folder) URLs.
  const indexHtmlPath = join(variantDir, 'index.html');
  if (existsSync(indexHtmlPath)) {
    let html = readFileSync(indexHtmlPath, 'utf8');
    html = html
      .replaceAll('href="../assets/', 'href="./assets/')
      .replaceAll("href='../assets/", "href='./assets/")
      .replaceAll('href="../style.css"', 'href="./style.css"')
      .replaceAll("href='../style.css'", "href='./style.css'")
      .replace("import { startStorieApp } from '../bootstrap.js", "import { startStorieApp } from './bootstrap.js")
      .replace("engineModuleUrl: '../storie-site.js", "engineModuleUrl: './storie-site.js")
      .replace("contentSourceModuleUrl: '../content-source.js", "contentSourceModuleUrl: './content-source.js")
      .replace("engineModuleUrl: '../storie.es.js", "engineModuleUrl: './storie.es.js")
      .replace("demoBaseUrl: '../demos/'", "demoBaseUrl: './demos/'")
      .replace("indexMdUrl: '../index.md'", `indexMdUrl: './demos/${variant}.md'`)
      .replace("assetsBaseUrl: '../assets/'", "assetsBaseUrl: './assets/'");

    if (displayName) {
      html = html.replace(/<title>[^<]*<\/title>/i, `<title>${displayName}</title>`);
    }
    writeFileSync(indexHtmlPath, html);
  }

  // Rewrite the manifest so icon URLs stay inside the variant scope.
  const manifestPath = join(variantDir, 'manifest.webmanifest');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.id = './';
      if (displayName) {
        manifest.name = displayName;
        manifest.short_name = displayName;
      }
      if (Array.isArray(manifest.icons)) {
        manifest.icons = manifest.icons.map((icon) => {
          if (!icon || typeof icon !== 'object') return icon;
          if (typeof icon.src === 'string') {
            return { ...icon, src: icon.src.replace(/^\.\.\//, './') };
          }
          return icon;
        });
      }
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    } catch (e) {
      console.warn(`  ⚠ Failed to rewrite ${variant}/manifest.webmanifest:`, e);
    }
  }
}

function listVariantDirs() {
  const entries = readdirSync(docsDir, { withFileTypes: true });
  const variants = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;
    if (name.startsWith('.')) continue;
    // Skip known non-variant directories.
    if (['assets', 'demos', 'shaders', 'figlets'].includes(name)) continue;
    const dir = join(docsDir, name);
    if (!existsSync(join(dir, 'index.html'))) continue;
    if (!existsSync(join(dir, 'manifest.webmanifest'))) continue;
    if (!existsSync(join(dir, 'sw.js'))) continue;
    variants.push(name);
  }
  return variants;
}

for (const variant of listVariantDirs()) {
  makeVariantSelfContained(variant);
}

function walkFiles(dir) {
  const out = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// Bust caches for module imports in generated HTML.
// Tauri/WebView environments can aggressively cache module URLs; if the query
// string is fixed, a rebuild may still load an old bundle.
try {
  const buildId = new Date().toISOString();
  let updatedCount = 0;
  for (const filePath of walkFiles(docsDir)) {
    if (!filePath.endsWith('.html')) continue;
    const html = readFileSync(filePath, 'utf8');
    if (!html.includes('__BUILD_ID__')) continue;
    const nextHtml = html.replace(/__BUILD_ID__/g, buildId);
    writeFileSync(filePath, nextHtml);
    updatedCount++;
  }
  if (updatedCount > 0) {
    console.log(`  Updated: ${updatedCount} HTML file(s) cache-buster (?v=${buildId})`);
  }
} catch (e) {
  console.warn('  ⚠ Failed to update HTML cache-buster:', e);
}

// Create warning README
const warningReadme = `# ⚠️ AUTO-GENERATED DIRECTORY

**DO NOT EDIT FILES IN THIS DIRECTORY DIRECTLY**

This folder is automatically generated by the build process and served by GitHub Pages.

## Source Files

- **HTML/Static files**: Edit in \`/site/\` directory
- **JavaScript library**: Edit TypeScript files in \`/src/\` directory

## Build Process

\`\`\`bash
npm run build
\`\`\`

This will:
1. Compile TypeScript (\`src/\`) → JavaScript
2. Bundle with Vite → \`docs/storie.*.js\`
3. Copy \`site/\` contents → \`docs/\`

## Deployment

This folder is served at: https://maddestlabs.github.io/storie/

Changes pushed to \`main\` branch are automatically deployed by GitHub Pages.

## To Make Changes

1. Edit files in \`/site/\` or \`/src/\` directories
2. Run \`npm run build\`
3. Test locally: \`npm run preview\`
4. Commit both source and built files
5. Push to deploy

---

**Last built:** ${new Date().toISOString()}
`;

writeFileSync(join(docsDir, 'AUTO_GENERATED_README.md'), warningReadme);
console.log('  Created: AUTO_GENERATED_README.md');

// Create .nojekyll for GitHub Pages
writeFileSync(join(docsDir, '.nojekyll'), '');
console.log('  Created: .nojekyll');

console.log('\n✅ Build complete!');
console.log('📁 Output: /docs/ directory');
console.log('🌐 Preview: npm run preview');
