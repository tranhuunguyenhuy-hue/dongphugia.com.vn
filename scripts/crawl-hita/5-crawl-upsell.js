/**
 * Phase 5: Crawl upsell relationships từ hita.com.vn → product_relationships table.
 *
 * Crawls "Sản phẩm thường được mua cùng" (.section-buy-more) trên mỗi PDP.
 * Inserts vào product_relationships với relationship_type = 'upsell'.
 *
 * Usage:
 *   # Brand mới (dùng urls.json từ Phase 1)
 *   node 5-crawl-upsell.js --brand=caesar
 *
 *   # Retroactive INAX/TOTO (dùng URL file từ crawl cũ)
 *   node 5-crawl-upsell.js --brand=inax --urls-from=../crawl-hita-inax/output/inax-urls.json
 *   node 5-crawl-upsell.js --brand=toto --urls-from=../crawl-toto/output/toto-urls.json
 *
 *   # Resume interrupted run
 *   node 5-crawl-upsell.js --brand=caesar --resume
 *
 * HTML selectors (verified 2026-05-30 on hita.com.vn):
 *   Container:         .section-buy-more
 *   Bundle rows:       .section-buy-more .content .item
 *   Complement URL:    .item a:not(.main-product):not(.btn-total-suggest)[href]
 *   hita_product_id:  URL regex /-(\d+)\.html$/
 *
 * DB target: product_relationships
 *   parent_id         = products.id (current product)
 *   child_sku         = products.sku (complement product)
 *   child_id          = products.id (complement, nullable if not yet imported)
 *   relationship_type = 'upsell'
 *   component_type    = 'bought_together'
 *   sort_order        = position in bundle list (0, 1, ...)
 *   UNIQUE(parent_id, child_sku) — upsert safe
 */

import { chromium } from 'playwright';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { sleep, withRetry, atomicWrite } from './utils.js';
import { parseBrandArg, getBrandConfig } from './brand-configs.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI args ─────────────────────────────────────────────────────────────────
const BRAND_SLUG = parseBrandArg();
const config = getBrandConfig(BRAND_SLUG);

const urlsFromArg = process.argv.find(a => a.startsWith('--urls-from='));
const URLS_FROM = urlsFromArg ? path.resolve(__dirname, urlsFromArg.split('=')[1]) : null;
const isResume = process.argv.includes('--resume');

// ─── Paths ────────────────────────────────────────────────────────────────────
const OUTPUT_DIR      = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const URLS_FILE       = URLS_FROM || path.join(OUTPUT_DIR, 'urls.json');
const PROGRESS_FILE   = path.join(OUTPUT_DIR, 'upsell-progress.json');
const LOG_FILE        = path.join(OUTPUT_DIR, 'upsell-log.json');

// ─── Supabase ─────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials in .env');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CONCURRENCY = 3; // same as Phase 2 — Cloudflare throttle
const DELAY_MS = 1200;
const DELAY_JITTER = 600;

// ─── Cache: hita_product_id → { id, sku } ────────────────────────────────────
// Avoids DB roundtrip per URL
const productCache = new Map();

async function lookupProductByHitaId(hitaId) {
  const cacheKey = String(hitaId);
  if (productCache.has(cacheKey)) return productCache.get(cacheKey);

  const { data } = await supabase
    .from('products')
    .select('id, sku')
    .eq('hita_product_id', hitaId)
    .single();

  const result = data || null;
  productCache.set(cacheKey, result);
  return result;
}

// ─── Extract upsell bundles from a PDP ───────────────────────────────────────
async function extractUpsellBundles(page, url) {
  return await page.evaluate(() => {
    const section = document.querySelector('.section-buy-more');
    if (!section) return []; // Product has no upsell section — skip gracefully

    const items = [...section.querySelectorAll('.content .item')];
    return items.map(item => {
      // Complement link: NOT .main-product (current product), NOT .btn-total-suggest
      const link = item.querySelector('a:not(.main-product):not(.btn-total-suggest)[href]');
      const complementUrl = link?.href;
      // hita_product_id = trailing number before .html
      const hitaId = complementUrl?.match(/-(\d+)\.html$/)?.[1];
      return { complementUrl: complementUrl || null, hitaId: hitaId || null };
    }).filter(b => b.hitaId !== null);
  });
}

// ─── Process one PDP URL ─────────────────────────────────────────────────────
async function processUrl(page, url, log) {
  const hitaIdMatch = url.match(/-(\d+)\.html$/);
  if (!hitaIdMatch) {
    log.push({ url, status: 'skipped', reason: 'no_hita_id_in_url' });
    return;
  }
  const parentHitaId = hitaIdMatch[1];

  // Lookup parent product in DB
  const parent = await lookupProductByHitaId(parentHitaId);
  if (!parent) {
    log.push({ url, status: 'skipped', reason: 'parent_not_in_db', hitaId: parentHitaId });
    return;
  }

  // Load PDP and extract bundles
  let bundles;
  try {
    await withRetry(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    });
    bundles = await extractUpsellBundles(page, url);
  } catch (err) {
    log.push({ url, status: 'error', reason: err.message });
    return;
  }

  if (bundles.length === 0) {
    log.push({ url, status: 'no_upsell', parentSku: parent.sku });
    return;
  }

  // Resolve each complement product and upsert
  let inserted = 0, skipped = 0;
  for (let i = 0; i < bundles.length; i++) {
    const { hitaId } = bundles[i];
    const child = await lookupProductByHitaId(hitaId);

    if (!child) {
      // Complement not yet in DB (brand not yet crawled) — skip + log for retry later
      skipped++;
      log.push({
        url,
        status: 'complement_not_in_db',
        parentSku: parent.sku,
        complementHitaId: hitaId,
        note: 'Re-run Phase 5 after importing complement brand',
      });
      continue;
    }

    const { error } = await supabase.from('product_relationships').upsert({
      parent_id: parent.id,
      child_sku: child.sku,
      child_id: child.id,
      relationship_type: 'upsell',
      component_type: 'bought_together',
      sort_order: i,
    }, { onConflict: 'parent_id,child_sku' });

    if (error) {
      log.push({ url, status: 'db_error', error: error.message, parentSku: parent.sku });
    } else {
      inserted++;
    }
  }

  log.push({
    url,
    status: 'ok',
    parentSku: parent.sku,
    bundlesFound: bundles.length,
    inserted,
    skippedComplement: skipped,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`=== Phase 5: Crawl Upsell — brand: ${BRAND_SLUG} ===`);
  console.log(`URLs from: ${URLS_FILE}\n`);

  if (!fs.existsSync(URLS_FILE)) {
    console.error(`❌ ${URLS_FILE} not found.`);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let urls = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));

  // Resume: skip already-processed URLs
  let completedUrls = new Set();
  if (isResume && fs.existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    completedUrls = new Set(Array.isArray(progress) ? progress : []);
    const remaining = urls.filter(u => !completedUrls.has(u));
    console.log(`Resuming: ${completedUrls.size} done, ${remaining.length} remaining`);
    urls = remaining;
  }

  console.log(`Processing ${urls.length} URLs...`);

  // Pre-warm cache with all products for this brand (faster than per-URL lookups)
  const { data: brandProducts } = await supabase
    .from('products')
    .select('id, sku, hita_product_id')
    .not('hita_product_id', 'is', null);
  (brandProducts || []).forEach(p => {
    productCache.set(String(p.hita_product_id), { id: p.id, sku: p.sku });
  });
  console.log(`Cache pre-warmed: ${productCache.size} products\n`);

  const browser = await chromium.launch({ headless: true });
  const limit = pLimit(CONCURRENCY);
  const log = [];

  let done = 0;

  const tasks = urls.map(url => limit(async () => {
    const page = await browser.newPage();
    page.on('console', () => {});
    try {
      await processUrl(page, url, log);
      completedUrls.add(url);
      done++;

      if (done % 100 === 0) {
        console.log(`  Progress: ${done}/${urls.length}`);
        atomicWrite(PROGRESS_FILE, [...completedUrls]);
        atomicWrite(LOG_FILE, log);
      }
    } finally {
      await page.close();
      await sleep(DELAY_MS + Math.random() * DELAY_JITTER);
    }
  }));

  await Promise.all(tasks);
  await browser.close();

  atomicWrite(PROGRESS_FILE, [...completedUrls]);
  atomicWrite(LOG_FILE, log);

  // Summary
  const ok = log.filter(l => l.status === 'ok').length;
  const noUpsell = log.filter(l => l.status === 'no_upsell').length;
  const skippedParent = log.filter(l => l.status === 'skipped').length;
  const complementMissing = log.filter(l => l.status === 'complement_not_in_db').length;
  const errors = log.filter(l => l.status === 'error' || l.status === 'db_error').length;
  const totalInserted = log.filter(l => l.status === 'ok').reduce((s, l) => s + (l.inserted || 0), 0);

  console.log('\n=== Summary ===');
  console.log(`  ✅ Products with upsell:      ${ok}`);
  console.log(`  🔗 Relationships inserted:    ${totalInserted}`);
  console.log(`  ⏭  No upsell section:         ${noUpsell}`);
  console.log(`  ⏭  Parent not in DB:          ${skippedParent}`);
  console.log(`  ⚠️  Complement not in DB:      ${complementMissing} (re-run after importing other brands)`);
  console.log(`  ❌ Errors:                    ${errors}`);
  console.log(`\n  Log → ${LOG_FILE}`);

  if (complementMissing > 0) {
    console.log(`\n💡 Re-run this script after importing all brands to resolve missing complements.`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
