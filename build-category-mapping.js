/**
 * Reads product-catalog.json and outputs category-products.json (for app data folder).
 * Categories: shoes, dresses, bags (inferred from part1), swimwear 59-67, workwear 68-80,
 * beauty 81-86, wellness 87-90, sale (price/description indicates discount).
 * Run: node build-category-mapping.js
 */
const fs = require('fs');
const path = require('path');

const JSON_PATH = path.join(__dirname, 'product-catalog.json');

function inferCategory(p) {
  const id = parseInt(p.id, 10);
  if (id >= 59 && id <= 67) return 'swimwear';
  if (id >= 68 && id <= 80) return 'workwear';
  if (id >= 81 && id <= 86) return 'beauty';
  if (id >= 87 && id <= 90) return 'wellness';

  const name = (p.name || '').toLowerCase();
  const desc = (p.description || '').toLowerCase();
  const combined = name + ' ' + desc;

  if (/\b(sandals?|pumps?|mules?|heels?|flats?|slingback|wedge|slides|boots)\b/.test(combined)) return 'shoes';
  if (/\b(dress|gown|minidress|midi dress|shirt dress|bustier dress)\b/.test(combined)) return 'dresses';
  if (/\b(earrings?|clip-on)\b/.test(combined)) return null;
  if (/\b(clutch|tote|shoulder bag|vanity bag|top-handle bag|leather bag|jacquard shoulder bag)\b/.test(combined)) return 'bags';
  if (/\b(bag)\b/.test(combined) && !/\b(garment bag)\b/.test(combined)) return 'bags';
  return null;
}

// Part2 sale product ids (from Demo catalog part2.txt: Sale price / % off)
const PART2_SALE_IDS = ['63', '64', '65', '66', '67'];
function isOnSale(p) {
  const id = p.id.toString();
  if (PART2_SALE_IDS.includes(id)) return true;
  const price = (p.price || '').toString();
  if (/\d+%\s*off|sale\s*price|regular\s*price/i.test(price)) return true;
  return false;
}

const catalog = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
const products = catalog.products || [];

const mapping = {
  shoes: [],
  dresses: [],
  bags: [],
  swimwear: [],
  workwear: [],
  beauty: [],
  wellness: [],
  sale: []
};

products.forEach(p => {
  const id = p.id;
  if (!id || id.toString().startsWith('demo-')) return;

  const cat = inferCategory(p);
  if (cat && mapping[cat]) mapping[cat].push(id.toString());

  if (isOnSale(p)) mapping.sale.push(id.toString());
});

// Dedupe sale
mapping.sale = [...new Set(mapping.sale)];

const out = {
  description: 'Product IDs by category for Shop by Category. Part1: shoes, dresses, bags (inferred). Part2: swimwear 59-67, workwear 68-80, beauty 81-86, wellness 87-90. Sale: catalog-wide.',
  ...mapping
};

console.log(JSON.stringify(out, null, 2));
