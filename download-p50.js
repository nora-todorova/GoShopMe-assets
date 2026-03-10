/**
 * Download product 50 (Jacquemus Le Salon clutch) images into catalog/ folder.
 * Run: node download-p50.js
 *
 * NOTE: Jacquemus returns HTTP 403 for scripted downloads. To get the images
 * into catalog/: open each originalImageUrl from product 50 in a browser,
 * save as p50_0.jpg, p50_1.jpg, p50_2.jpg in this repo's catalog/ folder,
 * then commit and push GoShopMe-assets so the app can load them from GitHub.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const CATALOG_DIR = path.join(__dirname, 'catalog');
const URLS = [
  'https://www.jacquemus.com/dw/image/v2/BJFJ_PRD/on/demandware.static/-/Sites-master-jacquemus/default/dwd7e9f2be/25EBAW00413AC27L14990_17.jpg?q=100',
  'https://www.jacquemus.com/dw/image/v2/BJFJ_PRD/on/demandware.static/-/Sites-master-jacquemus/default/dwe9837986/25EBAW00413AC27L14990_19.jpg?q=100',
  'https://www.jacquemus.com/dw/image/v2/BJFJ_PRD/on/demandware.static/-/Sites-master-jacquemus/default/dw290abc2d/25EBAW00413AC27L14990_21.jpg?q=100',
];

function download(url) {
  return new Promise((resolve, reject) => {
    const opts = {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    };
    const req = https.get(url, opts, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });
  const GITHUB_RAW = 'https://raw.githubusercontent.com/nora-todorova/GoShopMe-assets/main/catalog';
  for (let i = 0; i < URLS.length; i++) {
    const filename = `p50_${i}.jpg`;
    const filepath = path.join(CATALOG_DIR, filename);
    try {
      const buf = await download(URLS[i]);
      fs.writeFileSync(filepath, buf);
      console.log('Saved', filename);
    } catch (err) {
      console.warn('Failed', filename, err.message);
    }
  }
  console.log('Done. Update product-catalog.json product 50 imageUrls to:', URLS.map((_, i) => `${GITHUB_RAW}/p50_${i}.jpg`).join(', '));
}

main().catch((err) => { console.error(err); process.exit(1); });
