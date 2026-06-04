/**
 * Phase 3: Upload product images từ hita.com.vn lên Bunny CDN.
 *
 * Usage:
 *   node 3-upload-images.js --brand=caesar
 *
 * Input:  output/<brand>/crawled-products.json
 * Output: output/<brand>/crawled-products-with-cdn.json
 *         output/<brand>/image-map.json (sourceUrl → cdnUrl mapping)
 *
 * Images are stored at: cdn.dongphugia.com.vn/hita/<filename>
 * Concurrency: 5 (network-bound, safe with Bunny CDN)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import { atomicWrite, sleep, withRetry } from './utils.js';
import { parseBrandArg } from './brand-configs.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_SLUG = parseBrandArg();
const OUTPUT_DIR  = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const INPUT_FILE  = path.join(OUTPUT_DIR, 'crawled-products.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'crawled-products-with-cdn.json');
const MAP_FILE    = path.join(OUTPUT_DIR, 'image-map.json');

const CONCURRENCY = 5;

const BUNNY_KEY      = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_ZONE     = process.env.BUNNY_STORAGE_ZONE_NAME;
const BUNNY_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN      = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

if (!BUNNY_KEY || !BUNNY_ZONE) {
  console.error('❌ Missing BUNNY_STORAGE_API_KEY or BUNNY_STORAGE_ZONE_NAME in .env');
  process.exit(1);
}

function getFileName(url) {
  try {
    return path.basename(new URL(url).pathname).split('?')[0] || `img-${Date.now()}.jpg`;
  } catch {
    return `img-${Date.now()}.jpg`;
  }
}

async function uploadToBunny(sourceUrl) {
  return withRetry(async () => {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${sourceUrl}`);
    const buffer = await res.arrayBuffer();

    const fileName = `hita/${getFileName(sourceUrl)}`;
    const uploadUrl = `https://${BUNNY_HOSTNAME}/${BUNNY_ZONE}/${fileName}`;

    const up = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'AccessKey': BUNNY_KEY,
        'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
      },
      body: buffer,
    });

    if (!up.ok) throw new Error(`Bunny upload failed: ${up.status}`);
    return `https://${BUNNY_CDN}/${fileName}`;
  });
}

async function main() {
  console.log(`=== Phase 3: Upload Images — brand: ${BRAND_SLUG} ===\n`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ ${INPUT_FILE} not found. Run Phase 2 first.`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Loaded ${products.length} products`);

  // Collect all unique source URLs
  const allSourceUrls = [...new Set(products.flatMap(p => p.images || []))];
  console.log(`Unique images to upload: ${allSourceUrls.length}`);

  // Load existing map to skip already-uploaded images
  const imageMap = fs.existsSync(MAP_FILE)
    ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'))
    : {};

  const toUpload = allSourceUrls.filter(u => !imageMap[u]);
  console.log(`Already uploaded: ${Object.keys(imageMap).length}, remaining: ${toUpload.length}\n`);

  const limit = pLimit(CONCURRENCY);
  let done = 0, errors = 0;

  await Promise.all(toUpload.map(url => limit(async () => {
    try {
      const cdnUrl = await uploadToBunny(url);
      imageMap[url] = cdnUrl;
      done++;
      if (done % 100 === 0) {
        console.log(`  Uploaded ${done}/${toUpload.length}...`);
        atomicWrite(MAP_FILE, imageMap); // checkpoint
      }
    } catch (err) {
      console.error(`  ❌ Upload failed: ${url} — ${err.message}`);
      errors++;
    }
  })));

  atomicWrite(MAP_FILE, imageMap);

  // Replace source URLs with CDN URLs in products
  const productsWithCDN = products.map(p => ({
    ...p,
    images: (p.images || []).map(src => imageMap[src] || src),
  }));

  atomicWrite(OUTPUT_FILE, productsWithCDN);

  console.log(`\n=== Summary ===`);
  console.log(`  ✅ Uploaded: ${done}`);
  console.log(`  ❌ Errors:   ${errors}`);
  console.log(`  Output → ${OUTPUT_FILE}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
