/**
 * Phase 4: Import crawled products vào Supabase.
 *
 * Usage:
 *   node 4-import-db.js --brand=caesar
 *
 * Input:  output/<brand>/crawled-products-with-cdn.json
 *
 * Rules:
 *   - Upsert on conflict: sku
 *   - is_active: false ALWAYS (PM activates manually after QA)
 *   - hita_product_id stored for Phase 5 upsell resolution
 *   - Old images deleted then re-inserted (idempotent)
 *   - Concurrency: 5
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import { sleep, withRetry } from './utils.js';
import { parseBrandArg, getBrandConfig } from './brand-configs.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_SLUG = parseBrandArg();
const config = getBrandConfig(BRAND_SLUG);
const OUTPUT_DIR = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const INPUT_FILE = path.join(OUTPUT_DIR, 'crawled-products-with-cdn.json');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log(`=== Phase 4: Import DB — brand: ${BRAND_SLUG} ===\n`);

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ ${INPUT_FILE} not found. Run Phase 3 first.`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Loaded ${products.length} products`);

  // ── Lookup brand_id ──
  const { data: brand, error: brandErr } = await supabase
    .from('brands').select('id').eq('slug', config.slug).single();
  if (brandErr || !brand) {
    console.error(`❌ Brand "${config.slug}" not found in DB:`, brandErr);
    process.exit(1);
  }
  const brandId = brand.id;
  console.log(`Brand "${config.slug}" → id: ${brandId}`);

  // ── Lookup category/subcategory maps ──
  const { data: categories } = await supabase.from('categories').select('id, slug');
  const catMap = {};
  (categories || []).forEach(c => { catMap[c.slug] = c.id; });

  const { data: subcategories } = await supabase.from('subcategories').select('id, slug');
  const subcatMap = {};
  (subcategories || []).forEach(s => { subcatMap[s.slug] = s.id; });

  let inserted = 0, updated = 0, imageCount = 0, errors = 0;
  const errorSkus = [];
  const limit = pLimit(5);

  const tasks = products.map(product => limit(async () => {
    try {
      // Upsert product
      const { data: upserted, error: upsertErr } = await supabase
        .from('products')
        .upsert({
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          price: product.price,
          original_price: product.original_price || null,
          description: product.description || null,
          specs: product.specs || {}, // NOT NULL constraint — default empty object
          brand_id: brandId,
          category_id: catMap[product.category_id] || null,
          subcategory_id: subcatMap[product.subcategory_id] || null,
          product_type: product.product_type || null,
          variant_label: product.variant_label || null,
          variant_group: product.variant_group_id
            ? String(product.variant_group_id).substring(0, 50)
            : null,
          hita_product_id: product.hita_product_id || null,
          image_main_url: (product.images && product.images.length > 0) ? product.images[0] : null,
          is_active: false, // NEVER true — PM activates manually
          updated_at: new Date().toISOString(),
        }, { onConflict: 'sku' })
        .select('id')
        .single();

      if (upsertErr || !upserted) {
        throw new Error(upsertErr?.message || 'Upsert returned no data');
      }

      const productId = upserted.id;

      // ── Images: delete old → insert new ──
      await supabase.from('product_images').delete().eq('product_id', productId);

      const imageRows = (product.images || []).map((url, idx) => ({
        product_id: productId,
        image_url: url,
        alt_text: product.name,
        image_type: idx === 0 ? 'primary' : 'gallery',
        sort_order: idx,
      }));

      if (imageRows.length > 0) {
        const { error: imgErr } = await supabase.from('product_images').insert(imageRows);
        if (imgErr) throw new Error(`Image insert failed: ${imgErr.message}`);
        imageCount += imageRows.length;
      }

      // ── PDFs ──
      // (Store in product specs or a separate table if schema supports it)
      // For now: append PDF links to description if any
      // TODO: extend if products table gets a pdfs column

      updated++;
    } catch (err) {
      errors++;
      errorSkus.push(product.sku);
      console.error(`  ❌ ${product.sku}: ${err.message}`);
    }
  }));

  await Promise.all(tasks);

  console.log('\n=== Summary ===');
  console.log(`  ✅ Upserted: ${updated}`);
  console.log(`  🖼  Images:   ${imageCount}`);
  console.log(`  ❌ Errors:   ${errors}`);
  if (errorSkus.length > 0) {
    console.log(`  Error SKUs:  ${errorSkus.join(', ')}`);
  }
  console.log(`\n  ⚠️  All products imported with is_active=false.`);
  console.log(`  PM activates manually after Tech Lead QA.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
