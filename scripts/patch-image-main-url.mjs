/**
 * Patch: cập nhật image_main_url cho các sản phẩm bị null
 *
 * Usage: node scripts/patch-image-main-url.mjs
 *
 * Đọc crawled-products-with-cdn.json của từng brand,
 * UPDATE image_main_url trong DB theo SKU (chỉ update nếu hiện null/empty).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.local'), override: false });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const BRAND_FILES = [
  path.join(ROOT, 'scripts/crawl-hita/output/caesar/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/cotto/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/grohe/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/moen/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/atmor/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/viglacera/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita/output/american-standard/crawled-products-with-cdn.json'),
  path.join(ROOT, 'scripts/crawl-hita-inax/output/crawled-products-with-cdn.json'),
];

const BATCH_SIZE = 200;

async function patchBrand(filePath) {
  const brandName = filePath.includes('crawl-hita-inax') ? 'inax' : path.basename(path.dirname(filePath));
  console.log(`\n📦 Patching ${brandName}...`);

  const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const skuMap = {};
  for (const p of products) {
    if (p.sku && p.images && p.images[0]) {
      skuMap[p.sku] = p.images[0];
    }
  }

  const skus = Object.keys(skuMap);
  console.log(`  Loaded ${skus.length} SKUs with images`);

  let patched = 0;
  let skipped = 0;

  // Query products that need patching (null image_main_url + matching SKU)
  for (let i = 0; i < skus.length; i += BATCH_SIZE) {
    const batchSkus = skus.slice(i, i + BATCH_SIZE);

    const { data: rows, error: fetchErr } = await supabase
      .from('products')
      .select('id, sku, image_main_url')
      .in('sku', batchSkus)
      .or('image_main_url.is.null,image_main_url.eq.');

    if (fetchErr) {
      console.error(`  ❌ Fetch error (batch ${i}):`, fetchErr.message);
      continue;
    }

    if (!rows || rows.length === 0) {
      skipped += batchSkus.length;
      continue;
    }

    // Update each row
    const updatePromises = rows.map(row =>
      supabase
        .from('products')
        .update({ image_main_url: skuMap[row.sku], updated_at: new Date().toISOString() })
        .eq('id', row.id)
    );

    const results = await Promise.all(updatePromises);
    const errors = results.filter(r => r.error);
    errors.forEach(r => console.error(`  ❌ Update error:`, r.error.message));
    patched += rows.length - errors.length;

    process.stdout.write(`  Progress: ${Math.min(i + BATCH_SIZE, skus.length)}/${skus.length}\r`);
  }

  console.log(`  ✅ Patched: ${patched} | Skipped (already ok): ${skus.length - patched}`);
  return patched;
}

async function main() {
  console.log('=== Patch image_main_url ===\n');
  let totalPatched = 0;

  for (const file of BRAND_FILES) {
    if (!fs.existsSync(file)) {
      console.log(`⚠️  Skipping (file not found): ${file}`);
      continue;
    }
    totalPatched += await patchBrand(file);
  }

  console.log(`\n✅ Done. Total patched: ${totalPatched}`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
