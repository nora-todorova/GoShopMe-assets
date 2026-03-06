/**
 * Builds product-catalog.json from Demo_catalog.txt:
 * - Parses products and adds appropriate sizes where missing
 * - Downloads images to catalog/ folder
 * - Outputs JSON with productUrl (for "search on internet" flow), imageUrls (GitHub raw), brand, name, price, description, sizes
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ASSETS_DIR = __dirname;
const CATALOG_DIR = path.join(ASSETS_DIR, 'catalog');
const TXT_PATH = path.join(ASSETS_DIR, 'Demo_catalog.txt');
const JSON_PATH = path.join(ASSETS_DIR, 'product-catalog.json');
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/nora-todorova/GoShopMe-assets/main/catalog';

// Size presets by product type (inferred from name/description). No blank sizes; use real options where applicable.
const SIZES = {
  clothing: ['XS', 'S', 'M', 'L', 'XL'],
  dress: ['UK 6', 'UK 8', 'UK 10', 'UK 12', 'UK 14'],
  skirt: ['UK 6', 'UK 8', 'UK 10', 'UK 12', 'UK 14'],
  tops: ['XS', 'S', 'M', 'L', 'XL'],
  pants: ['UK 6', 'UK 8', 'UK 10', 'UK 12', 'UK 14'],
  jeans: ['25', '26', '27', '28', '29', '30'],
  shoes: ['EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41'],
  bag: ['One size'],
  jewelry: ['One size'],
};

function inferSizes(productName, productDescription) {
  const name = (productName || '').toLowerCase();
  const desc = (productDescription || '').toLowerCase();
  const combined = name + ' ' + desc;
  // Check jewelry and shoes first (unambiguous)
  if (/\b(earrings?|clip-on|drop earrings|embellished clip-on)\b/.test(combined)) return SIZES.jewelry;
  if (/\b(sandals?|pumps?|mules?|heels?|flats?|slingback|wedge|slides)\b/.test(combined)) return SIZES.shoes;
  if (/\b(jeans?|wide.?leg|capri|straight leg|jacquard straight)\b/.test(combined)) return SIZES.jeans;
  if (/\b(pants?|trousers|shorts)\b/.test(combined)) return SIZES.pants;
  // Skirt and dress before bag so "midi skirt" isn't matched by "garment bag"
  if (/\b(skirt|pencil skirt|midi skirt)\b/.test(combined)) return SIZES.skirt;
  if (/\b(dress|gown|minidress|midi dress|shirt dress|bustier dress)\b/.test(combined)) return SIZES.dress;
  if (/\b(bag|clutch|tote|shoulder bag|vanity|baguette|top-handle|backpack)\b/.test(combined)) return SIZES.bag;
  if (/\b(top|blouse|shirt|cardigan|coat|jacket|trench|tank|blouson)\b/.test(combined)) return SIZES.clothing;
  return SIZES.clothing;
}

function extractPrice(text) {
  if (!text) return '';
  const m = text.match(/(?:€|£|\$)\s*[\d.,]+\s*(?:€|£|\$)?|[\d.,]+\s*(?:€|£|\$)/);
  return m ? m[0].trim() : '';
}

function parseCatalogTxt(content) {
  const blocks = content.split(/\n(?=\d+\.?\s+Product [Ll]ink:)/).filter(Boolean);
  const products = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const linkMatch = block.match(/Product [Ll]ink:\s*(https:\/\/[^\s]+)/);
    const productUrl = linkMatch ? linkMatch[1].replace(/\s*:\s*$/, '').trim() : '';
    if (!productUrl) continue;

    let imageLines = block.match(/[Ii]mages?:\s*([^\n]+(?:\n[^\n]*)?)/);
    let imageStr = imageLines ? imageLines[1] : '';
    const imageUrls = (imageStr.match(/https?:\/\/[^\s,\)]+/g) || [])
      .map(u => u.replace(/&amp;/g, '&').trim())
      .filter(u => u.length > 20 && !u.includes('…') && !/\.\.\./.test(u));

    // Fix relative URLs
    const fixedImageUrls = imageUrls.map(u => {
      if (u.startsWith('/cdn/')) return 'https://www.self-portrait.com' + u;
      if (u.startsWith('/') && u.includes('cdn/shop')) return 'https://eu.self-portrait.com' + u.split('?')[0];
      return u;
    });

    const brandMatch = block.match(/(?:BRAND|Brand):\s*([^\n]+)/i);
    const brand = brandMatch ? brandMatch[1].trim() : '';
    const nameMatch = block.match(/(?:Product name|PRODUCT NAME|PRODCUT NAME):\s*([^\n]+)/i);
    const productName = nameMatch ? nameMatch[1].trim() : '';
    const price = extractPrice(block);
    const descMatch = block.match(/(?:Product description|Product details|PRODUCT DESCRIPTION):\s*([\s\S]*?)(?=\n(?:Size|Sizes|Item`s|BRAND|Brand|\d+\.)|$)/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim().slice(0, 800) : '';

    const sizes = inferSizes(productName, description);
    products.push({
      id: String(products.length + 1),
      productUrl,
      originalProductUrl: productUrl,
      originalImageUrls: fixedImageUrls,
      imageUrls: [],
      brand,
      name: productName,
      price,
      description,
      sizes,
    });
  }
  return products;
}

function download(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const opts = {
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    };
    const req = client.get(url, opts, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function getExt(url) {
  const pathPart = url.split('?')[0];
  if (pathPart.endsWith('.webp')) return 'webp';
  if (pathPart.endsWith('.jpg') || pathPart.endsWith('.jpeg')) return 'jpg';
  if (pathPart.endsWith('.png')) return 'png';
  return 'jpg';
}

async function downloadImages(products) {
  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  for (let pIdx = 0; pIdx < products.length; pIdx++) {
    const p = products[pIdx];
    const localUrls = [];
    const urlsToFetch = p.originalImageUrls || [];
    for (let iIdx = 0; iIdx < urlsToFetch.length; iIdx++) {
      const url = urlsToFetch[iIdx];
      const ext = getExt(url);
      const filename = `p${pIdx + 1}_${iIdx}.${ext}`;
      const filepath = path.join(CATALOG_DIR, filename);
      try {
        const buf = await download(url);
        fs.writeFileSync(filepath, buf);
        localUrls.push(`${GITHUB_RAW_BASE}/${filename}`);
      } catch (err) {
        console.warn(`Skip image ${filename}: ${err.message}`);
      }
      await delay(300);
    }
    p.imageUrls = localUrls.length ? localUrls : urlsToFetch;
  }
}

async function main() {
  console.log('Reading Demo_catalog.txt...');
  const content = fs.readFileSync(TXT_PATH, 'utf8');
  const products = parseCatalogTxt(content);
  console.log(`Parsed ${products.length} products.`);

  console.log('Downloading images to catalog/...');
  await downloadImages(products);

  const catalog = {
    source: 'Demo_catalog.txt',
    productUrlUsage: 'Use productUrl when ShAI suggests "search on internet" so the app can show these links as recommendations.',
    products,
  };
  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`Wrote ${JSON_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
