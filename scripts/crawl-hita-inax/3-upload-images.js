import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pLimit from 'p-limit';
import dotenv from 'dotenv';
import { atomicWrite, sleep, withRetry } from './utils.js';

// Load env for Bunny CDN credentials
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const INPUT_FILE = path.join(OUTPUT_DIR, 'crawled-products.json');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'crawled-products-with-cdn.json');
const MAP_FILE = path.join(OUTPUT_DIR, 'image-map.json');

const CONCURRENCY = 5; // D-09: or limit defined in spec

const BUNNY_STORAGE_API_KEY = process.env.BUNNY_STORAGE_API_KEY;
const BUNNY_STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE_NAME;
const BUNNY_STORAGE_HOSTNAME = process.env.BUNNY_STORAGE_HOSTNAME || 'sg.storage.bunnycdn.com';
const BUNNY_CDN_HOSTNAME = process.env.BUNNY_CDN_HOSTNAME || 'cdn.dongphugia.com.vn';

if (!BUNNY_STORAGE_API_KEY || !BUNNY_STORAGE_ZONE_NAME) {
  console.error('❌ Missing Bunny CDN credentials in .env');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileName(url) {
  try {
    const urlObj = new URL(url);
    const basename = path.basename(urlObj.pathname);
    // Remove query params if any
    return basename.split('?')[0] || `img-${Date.now()}.jpg`;
  } catch (err) {
    return `img-${Date.now()}.jpg`;
  }
}

async function uploadToBunnyCDN(sourceUrl) {
  // 1. Fetch image from source
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch source image: ${response.status} ${response.statusText}`);
  }
  const buffer = await response.arrayBuffer();

  // 2. Upload to Bunny CDN
  const fileName = `hita/${getFileName(sourceUrl)}`;
  const uploadUrl = `https://${BUNNY_STORAGE_HOSTNAME}/${BUNNY_STORAGE_ZONE_NAME}/${fileName}`;
  
  const uploadResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_STORAGE_API_KEY,
      'Content-Type': response.headers.get('content-type') || 'application/octet-stream',
    },
    body: buffer,
  });

  if (!uploadResponse.ok) {
    throw new Error(`BunnyCDN upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
  }

  return `https://${BUNNY_CDN_HOSTNAME}/${fileName}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    console.log('Run 2-crawl-pdp.js first.');
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`Loaded ${products.length} products.`);

  // Load existing map if resuming
  const imageMap = fs.existsSync(MAP_FILE) ? JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8')) : {};
  let newUploads = 0;

  // Collect all unique image URLs
  const allImageUrls = new Set();
  for (const p of products) {
    (p.images || []).forEach(url => allImageUrls.add(url));
    (p.descriptionImageUrls || []).forEach(url => allImageUrls.add(url));
  }

  const urlsToProcess = [...allImageUrls].filter(url => !imageMap[url]);
  console.log(`Total unique images: ${allImageUrls.size}`);
  console.log(`Images to upload (not in map): ${urlsToProcess.length}`);

  const limit = pLimit(CONCURRENCY);

  const uploadTasks = urlsToProcess.map(url => limit(async () => {
    try {
      // D-16: CDN upload retry 3 times with exponential backoff
      const cdnUrl = await withRetry(() => uploadToBunnyCDN(url), 3, 1000);
      imageMap[url] = cdnUrl;
      newUploads++;
      
      // Save progress atomically (D-14)
      atomicWrite(MAP_FILE, imageMap);
      console.log(`✅ Uploaded: ${url} -> ${cdnUrl}`);
    } catch (err) {
      console.error(`❌ Failed to upload ${url}: ${err.message}`);
    }
    // Rate limit gracefully
    await sleep(500);
  }));

  await Promise.all(uploadTasks);
  
  console.log(`\nUpload complete. New uploads: ${newUploads}. Total in map: ${Object.keys(imageMap).length}`);

  // Replace URLs in products
  console.log('Replacing URLs in product data...');
  for (const product of products) {
    // Main images
    if (product.images) {
      product.images = product.images
        .map(url => imageMap[url] || url)
        // filter out any failed uploads if necessary, but here we just keep them or mapped ones
        .filter(Boolean);
    }

    // Description HTML
    if (product.description) {
      let descHtml = product.description;
      // D-01/Phase 3 requirement: replace descriptionImageUrls inside the HTML
      if (product.descriptionImageUrls) {
        for (const url of product.descriptionImageUrls) {
          const cdnUrl = imageMap[url];
          if (cdnUrl) {
            // Use split/join to replace all occurrences
            descHtml = descHtml.split(url).join(cdnUrl);
          }
        }
      }
      product.description = descHtml;
    }
  }

  atomicWrite(OUTPUT_FILE, products);
  console.log(`✅ Saved mapped products to ${OUTPUT_FILE}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
