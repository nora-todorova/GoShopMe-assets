/**
 * Copy product/item images from assets/ to catalog/, excluding cover images,
 * avatars, shai-avatar, logo, and videos.
 * Run from GoShopMe-assets: node copy-assets-to-catalog.js
 */
const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, 'assets');
const CATALOG_DIR = path.join(__dirname, 'catalog');

// Cover images (used as coverImage in picks.json / trending.json) - do NOT copy
const COVER_FILES = new Set([
  'Paris in Spring.jpg',
  '486bd6818f-a15b8b6d17a566d04183.png',
  '7c640ee900-49da491c48a25226f4d3.png',
  'Business collection.jpg',
  'a237d37f08-9183f2271467bd16514a.png',
  'a16416caa3-176574d362901d57a338.png',
  'cba1ef9ed4-2a4abf50b1ec50c51ddd.png',
  'Urban style.jpg',
  '64c66e6d0e-91cec063e572905c683c.png',
  '73024ae4b1-a0a9c28bc4907d22ac6b.png',
  '4e2d3c7b9a-497abef6a977f5abdef1.png',
  'c1edec7423-160beffc50d92dc988c2.png',
  'c446a619d5-f94ec3967727fcde88dd.png',
  'Neutrals.jpg',
]);

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function copyAssets() {
  if (!fs.existsSync(ASSETS_DIR)) {
    console.error('assets/ not found');
    process.exit(1);
  }
  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });

  const files = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
  let copied = 0;
  for (const ent of files) {
    if (ent.isDirectory()) {
      if (ent.name === 'avatars') continue;
      // skip subdirs other than avatars if any
      continue;
    }
    const ext = path.extname(ent.name).toLowerCase();
    if (!IMAGE_EXT.has(ext)) continue;
    if (COVER_FILES.has(ent.name)) continue;
    if (ent.name === 'shai-avatar.png') continue;
    if (ent.name.toLowerCase().endsWith('.svg')) continue;

    const src = path.join(ASSETS_DIR, ent.name);
    const dest = path.join(CATALOG_DIR, ent.name);
    try {
      fs.copyFileSync(src, dest);
      console.log('Copied', ent.name);
      copied++;
    } catch (err) {
      console.warn('Skip', ent.name, err.message);
    }
  }
  console.log('Done. Copied', copied, 'files to catalog/');
}

copyAssets();
