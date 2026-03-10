/**
 * Parses "Demo catalog part2.txt" (swimwear, workwear, beauty, wellness),
 * downloads images to catalog/, and merges products into product-catalog.json
 * with ids 59, 60, ... (continuing after existing numeric ids).
 * Run: node build-catalog-part2.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ASSETS_DIR = __dirname;
const CATALOG_DIR = path.join(ASSETS_DIR, 'catalog');
const PART2_PATH = path.join(ASSETS_DIR, 'Demo catalog part2.txt');
const JSON_PATH = path.join(ASSETS_DIR, 'product-catalog.json');
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/nora-todorova/GoShopMe-assets/main/catalog';

const SIZES = {
  clothing: ['XS', 'S', 'M', 'L', 'XL'],
  dress: ['XS', 'S', 'M', 'L', 'XL'],
  skirt: ['XS', 'S', 'M', 'L', 'XL'],
  pants: ['UK 4', 'UK 6', 'UK 8', 'UK 10', 'UK 12'],
  shoes: ['EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41'],
  bag: ['One size'],
  beauty: ['One size'],
  wellness: ['One size'],
};

function inferSizes(name, description) {
  const s = ((name || '') + ' ' + (description || '')).toLowerCase();
  if (/\b(blush|lipstick|pencil|palette|balm|lip tint)\b/.test(s)) return SIZES.beauty;
  if (/\b(cleansing|serum|mask|booster|routine)\b/.test(s)) return SIZES.wellness;
  if (/\b(blazer|trousers|trench|jacket|skirt)\b/.test(s)) return SIZES.pants;
  if (/\b(bikini|swimsuit|swimwear)\b/.test(s)) return SIZES.clothing;
  if (/\b(dress)\b/.test(s)) return SIZES.dress;
  return SIZES.clothing;
}

function extractPrice(block) {
  const saleMatch = block.match(/Sale price:\s*([€$£][\d.,\s]+)/i);
  if (saleMatch) return saleMatch[1].trim();
  const priceMatch = block.match(/(?:Price|PRICE):\s*([€$£][\d.,\s]+(?:EUR|USD)?|[€$£]?\s*[\d.,]+\s*[€$£])/i);
  return priceMatch ? priceMatch[1].trim() : '';
}

function parsePart2(content) {
  const blocks = content.split(/\n(?=\d+\.\s+Product [Ll]ink:)/).filter(Boolean);
  const products = [];
  for (const block of blocks) {
    const linkMatch = block.match(/Product [Ll]ink:\s*(https:\/\/[^\s]+)/);
    const productUrl = linkMatch ? linkMatch[1].trim() : '';
    if (!productUrl) continue;

    const imageLines = block.match(/[Ii]mages?:\s*([^\n]+(?:\n[^\n]*)?)/);
    let imageStr = imageLines ? imageLines[1] : '';
    let imageUrls = (imageStr.match(/https?:\/\/[^\s,\)]+/g) || [])
      .map(u => u.replace(/&amp;/g, '&').trim())
      .filter(u => u.length > 20 && !u.includes('…'));
    imageUrls = [...new Set(imageUrls)];

    const brandMatch = block.match(/(?:BRAND|Brand):\s*([^\n]+)/i);
    const brand = brandMatch ? brandMatch[1].trim() : '';
    const nameMatch = block.match(/(?:Product name|PRODUCT NAME):\s*([^\n]+)/i);
    const name = nameMatch ? nameMatch[1].trim() : '';
    const price = extractPrice(block);
    const descMatch = block.match(/(?:Product description|Product [Dd]etails):\s*([\s\S]*?)(?=\n(?:Size|Sizes|Colors|Color:|Item|BRAND|Brand|\d+\.)|$)/i);
    const description = descMatch ? descMatch[1].replace(/\s+/g, ' ').trim().slice(0, 800) : '';

    const sizes = inferSizes(name, description);
    products.push({
      productUrl,
      originalProductUrl: productUrl,
      originalImageUrls: imageUrls,
      imageUrls: [],
      brand,
      name,
      price,
      description,
      sizes,
    });
  }
  return products;
}

function getExt(url) {
  const pathPart = url.split('?')[0];
  if (pathPart.endsWith('.webp')) return 'webp';
  if (pathPart.endsWith('.jpg') || pathPart.endsWith('.jpeg')) return 'jpg';
  if (pathPart.endsWith('.png')) return 'png';
  return 'jpg';
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
  });
}

async function downloadImages(products, startId) {
  if (!fs.existsSync(CATALOG_DIR)) fs.mkdirSync(CATALOG_DIR, { recursive: true });
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const pId = startId + i;
    const urlsToFetch = p.originalImageUrls || [];
    const localUrls = [];
    for (let j = 0; j < urlsToFetch.length; j++) {
      const url = urlsToFetch[j];
      const ext = getExt(url);
      const filename = `p${pId}_${j}.${ext}`;
      const filepath = path.join(CATALOG_DIR, filename);
      try {
        const buf = await download(url);
        fs.writeFileSync(filepath, buf);
        localUrls.push(`${GITHUB_RAW_BASE}/${filename}`);
        console.log('Downloaded', filename);
      } catch (err) {
        console.warn('Skip', filename, err.message);
      }
      await delay(400);
    }
    p.imageUrls = localUrls.length ? localUrls : urlsToFetch;
  }
}

async function main() {
  console.log('Reading Demo catalog part2.txt...');
  const content = fs.readFileSync(PART2_PATH, 'utf8');
  const part2Products = parsePart2(content);
  console.log('Parsed', part2Products.length, 'products from part2.');

  console.log('Reading product-catalog.json...');
  const catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
  const products = catalog.products;
  const numericIds = products.filter(p => /^\d+$/.test(String(p.id))).map(p => parseInt(p.id, 10));
  const startId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 59;
  console.log('Next product id:', startId);

  console.log('Downloading images to catalog/...');
  await downloadImages(part2Products, startId);

  const newProducts = part2Products.map((p, i) => ({
    id: String(startId + i),
    productUrl: p.productUrl,
    originalProductUrl: p.originalProductUrl,
    originalImageUrls: p.originalImageUrls,
    imageUrls: p.imageUrls,
    brand: p.brand,
    name: p.name,
    price: p.price,
    description: p.description,
    sizes: p.sizes,
  }));

  const insertIndex = products.findIndex(p => p.id && p.id.toString().startsWith('demo-'));
  const before = insertIndex >= 0 ? products.slice(0, insertIndex) : products;
  const after = insertIndex >= 0 ? products.slice(insertIndex) : [];
  catalog.products = [...before, ...newProducts, ...after];
  catalog.source = (catalog.source || 'Demo_catalog.txt') + ' + Demo catalog part2.txt';

  fs.writeFileSync(JSON_PATH, JSON.stringify(catalog, null, 2), 'utf8');
  console.log('Wrote', newProducts.length, 'new products to', JSON_PATH);
}

main().catch(err => { console.error(err); process.exit(1); });
