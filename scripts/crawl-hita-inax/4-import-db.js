import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import pLimit from 'p-limit';
import { sleep, withRetry } from './utils.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const INPUT_FILE = path.join(OUTPUT_DIR, 'crawled-products-with-cdn.json');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
  }

  const products = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
  console.log(`Loaded ${products.length} products from ${INPUT_FILE}`);

  // 1. Lookup brand_id INAX một lần
  const { data: brand, error: brandErr } = await supabase
    .from('brands')
    .select('id')
    .eq('slug', 'inax')
    .single();

  if (brandErr || !brand) {
    console.error('❌ Failed to find INAX brand in DB:', brandErr);
    process.exit(1);
  }
  const brandId = brand.id;

  // 1b. Fetch all categories and subcategories to map slugs to IDs
  const { data: categories } = await supabase.from('categories').select('id, slug');
  const catMap = {};
  (categories || []).forEach(c => { catMap[c.slug] = c.id; });

  const { data: subcategories } = await supabase.from('subcategories').select('id, slug');
  const subcatMap = {};
  (subcategories || []).forEach(s => { subcatMap[s.slug] = s.id; });

  let inserted = 0, updated = 0, imageCount = 0, errors = 0;
  const errorSkus = [];

  const limit = pLimit(5); // Adjust concurrency if needed

  const tasks = products.map((product) => limit(async () => {
    try {
      // 2. Upsert product
      const { data: upserted, error: upsertErr } = await supabase
        .from('products')
        .upsert({
          sku: product.sku,
          name: product.name,
          slug: product.slug, // Ensure slug is populated
          price: product.price,
          original_price: product.original_price || null,
          online_discount_amount: product.online_discount_amount || null,
          description: product.description,
          specs: product.specs || null,
          brand_id: brandId,
          category_id: catMap[product.category_id] || null,
          subcategory_id: subcatMap[product.subcategory_id] || null,
          product_type: product.product_type,
          variant_label: product.variant_label,
          variant_group: product.variant_group_id ? product.variant_group_id.substring(0, 50) : null,
          image_main_url: product.images && product.images.length > 0 ? product.images[0] : null,
          is_active: false,   // LUÔN false — PM review thủ công
          source_url: product.url,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'sku',
          ignoreDuplicates: false,
        })
        .select('id, created_at, updated_at')
        .single();

      if (upsertErr) throw upsertErr;

      // Note: Supabase created_at might be returned differently, using simple check
      const isNew = upserted.created_at === upserted.updated_at || !upserted.updated_at;
      isNew ? inserted++ : updated++;

      // 3. Delete old images & insert new ones
      await supabase.from('product_images').delete().eq('product_id', upserted.id);

      if (product.images && product.images.length > 0) {
        const images = product.images.map((url, i) => ({
          product_id: upserted.id,
          image_url: url,
          image_type: i === 0 ? 'main' : 'gallery',
          sort_order: i,
        }));

        const { error: imgErr } = await supabase.from('product_images').insert(images);
        if (imgErr) throw imgErr;
        imageCount += images.length;
      }
      
      console.log(`✅ Upserted ${product.sku}`);

    } catch (err) {
      errors++;
      errorSkus.push(product.sku);
      console.error(`ERROR ${product.sku}:`, err.message);
    }
  }));

  await Promise.all(tasks);

  console.log(`\n══════════════════════════════════════════════════`);
  console.log(`📦 DB Import Complete`);
  console.log(`   ✅ Inserted (New):  ${inserted}`);
  console.log(`   🔄 Updated (Exist): ${updated}`);
  console.log(`   🖼️  Images mapped:  ${imageCount}`);
  console.log(`   ❌ Errors:          ${errors}`);
  if (errors > 0) {
    console.log(`   ❌ Error SKUs:      ${errorSkus.join(', ')}`);
  }
  console.log(`══════════════════════════════════════════════════`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
