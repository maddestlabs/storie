/**
 * Generate favicons from storie-icon.png
 */

import sharp from 'sharp';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = join(__dirname, '..');
const srcIcon = join(rootDir, 'storie-icon.png');
const faviconDirs = [
  join(rootDir, 'site', 'assets', 'favicons'),
  join(rootDir, 'docs', 'assets', 'favicons'),
];

const sizes = {
  'favicon-16x16.png': 16,
  'favicon-32x32.png': 32,
  'apple-touch-icon.png': 180,
  'android-chrome-192x192.png': 192,
  'android-chrome-512x512.png': 512,
};

async function generateFavicons() {
  console.log('🎨 Generating favicons from storie-icon.png...');

  // Ensure source exists
  if (!existsSync(srcIcon)) {
    console.error(`❌ Source icon not found: ${srcIcon}`);
    process.exit(1);
  }

  for (const dir of faviconDirs) {
    mkdirSync(dir, { recursive: true });

    // Generate PNGs
    for (const [filename, size] of Object.entries(sizes)) {
      const outputPath = join(dir, filename);
      await sharp(srcIcon)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toFile(outputPath);
      console.log(`  ✓ ${filename} (${size}x${size})`);
    }

    // Generate favicon.ico (as PNG, since Sharp ICO is tricky)
    const icoPath = join(dir, 'favicon.ico');
    await sharp(srcIcon)
      .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(icoPath);
    console.log(`  ✓ favicon.ico (32x32 PNG)`);
  }

  console.log('✅ Favicon generation complete!');
}

generateFavicons().catch(console.error);