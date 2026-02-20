/**
 * Generate placeholder PNG + ICO icons for Tauri builds.
 * Run: node scripts/gen-icons.js
 *
 * Creates solid #001111 icons with a simple teal 'S' glyph.
 * Replace with real artwork by running:
 *   npx tauri icon src-tauri/icons/source-icon.png
 */
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '../src-tauri/icons');
mkdirSync(ICONS_DIR, { recursive: true });

const BG = [0x00, 0x11, 0x11];
const FG = [0x00, 0xC8, 0xB4];

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) {
    crc ^= b;
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}

function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  return Buffer.concat([u32be(d.length), t, d, u32be(crc32(Buffer.concat([t, d])))]);
}

function makePNG(size) {
  const cx = size / 2, cy = size / 2;
  const r  = size * 0.3;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      const nx = (x - cx + 0.5) / r;
      const ny = (y - cy + 0.5) / r;
      const top    = ny < -0.05 && (nx*nx+(ny+0.45)*(ny+0.45)<0.28) && (nx*nx+(ny+0.45)*(ny+0.45)>0.10) && nx<0.15;
      const bottom = ny >  0.05 && (nx*nx+(ny-0.45)*(ny-0.45)<0.28) && (nx*nx+(ny-0.45)*(ny-0.45)>0.10) && nx>-0.15;
      const drawS  = (top || bottom) && size >= 24;
      row.push(drawS?FG[0]:BG[0], drawS?FG[1]:BG[1], drawS?FG[2]:BG[2], 255);
    }
    rows.push(Buffer.from(row));
  }
  const raw  = Buffer.concat(rows);
  const idat = deflateSync(raw);
  const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  const ihdr = pngChunk('IHDR', Buffer.concat([u32be(size), u32be(size), Buffer.from([8,6,0,0,0])]));
  return Buffer.concat([sig, ihdr, pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

function makeICO(sizes) {
  const pngs = sizes.map(makePNG);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0,0); header.writeUInt16LE(1,2); header.writeUInt16LE(sizes.length,4);
  const DIR=16; let offset=6+sizes.length*DIR;
  const dirs = pngs.map((png,i)=>{
    const s=sizes[i]; const e=Buffer.alloc(DIR);
    e[0]=s<256?s:0; e[1]=s<256?s:0;
    e.writeUInt16LE(1,4); e.writeUInt16LE(32,6);
    e.writeUInt32LE(png.length,8); e.writeUInt32LE(offset,12);
    offset+=png.length; return e;
  });
  return Buffer.concat([header,...dirs,...pngs]);
}

const FILES = [
  {name:'32x32.png',size:32},{name:'128x128.png',size:128},{name:'128x128@2x.png',size:256},
  {name:'Square44x44Logo.png',size:44},{name:'Square71x71Logo.png',size:71},
  {name:'Square89x89Logo.png',size:89},{name:'Square107x107Logo.png',size:107},
  {name:'Square142x142Logo.png',size:142},{name:'Square150x150Logo.png',size:150},
  {name:'Square310x310Logo.png',size:310},{name:'SplashScreen.png',size:620},
];

for (const {name,size} of FILES) {
  writeFileSync(join(ICONS_DIR,name), makePNG(size));
  console.log(`✓ ${name} (${size}px)`);
}
writeFileSync(join(ICONS_DIR,'icon.ico'), makeICO([16,32,48,64,128,256]));
console.log('✓ icon.ico  (16/32/48/64/128/256)');
writeFileSync(join(ICONS_DIR,'icon.icns'), makePNG(512));
console.log('✓ icon.icns (placeholder)');
console.log('\nDone. Replace with real artwork: npx tauri icon <source-512x512.png>');
