/**
 * Phase 2: Crawl Product Detail Pages từ hita.com.vn
 *
 * Usage:
 *   node 2-crawl-pdp.js --brand=caesar --sample-only   # Phase 0: 20 URL sample
 *   node 2-crawl-pdp.js --brand=caesar                 # Full crawl
 *   node 2-crawl-pdp.js --brand=caesar --resume        # Resume interrupted run
 *
 * Lessons learned từ INAX crawl (LEO-448/450):
 *   D-01  description: innerText (plain text)
 *   D-02  gallery cap: 20 images max, Set() dedup
 *   D-03  SKU: NO fallback from slug — skip if null
 *   D-04  variant_group = slug of active variant (deterministic)
 *   D-05  PDF: try #box-attachments first, fallback #package-attachments
 *   D-06  gallery filter: /storage/ (new) OR /public/upload/images/ (legacy)
 *   D-07  Phase 0: 20 sample URLs → sample-20.json
 *   D-08  crawl-log.json: structured per-URL log
 *   D-09  concurrency: p-limit(3) — DO NOT increase (Cloudflare throttle)
 *   D-11  validation gate: skip if missing sku/name/images
 *   D-16  withRetry: exponential backoff 1s→2s→4s, max 3 retries
 *   D-19  resume: --resume reads crawl-progress.json
 *   D-20  gate: --sample-only bypasses phase0-approved.flag
 *   NEW   dual gallery template detection (new /storage/ vs legacy /public/upload/)
 */

import { chromium } from 'playwright';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sleep, parseVND, resolveUrl, atomicWrite, loadProgress, withRetry } from './utils.js';
import { lookupCategory } from './category-map.js';
import { parseBrandArg, getBrandConfig } from './brand-configs.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_SLUG = parseBrandArg();
const config = getBrandConfig(BRAND_SLUG);

const OUTPUT_DIR = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const URLS_FILE    = path.join(OUTPUT_DIR, 'urls.json');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'crawl-progress.json');
const OUTPUT_FILE  = path.join(OUTPUT_DIR, 'crawled-products.json');
const LOG_FILE     = path.join(OUTPUT_DIR, 'crawl-log.json');
const SAMPLE_FILE  = path.join(OUTPUT_DIR, 'sample-20.json');
const FLAG_FILE    = path.join(OUTPUT_DIR, 'phase0-approved.flag');

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isSampleOnly = args.includes('--sample-only');
const isResume     = args.includes('--resume');

// D-09: reduce to 2 when running multiple brands in parallel to avoid Cloudflare throttle
// Use --parallel flag when running alongside other brand crawls
const isParallel = args.includes('--parallel');
const CONCURRENCY   = isParallel ? 2 : 3;
const MAX_IMAGES    = 20;  // D-02
const DELAY_MS      = isParallel ? 1500 : 1000; // longer delay in parallel mode
const DELAY_JITTER  = isParallel ? 1000 : 800;

// --start-delay=N : wait N seconds before starting (stagger parallel processes)
const startDelayArg = args.find(a => a.startsWith('--start-delay='));
const START_DELAY_S = startDelayArg ? parseInt(startDelayArg.split('=')[1], 10) : 0;

// ─── Phase 0 gate (D-20) ──────────────────────────────────────────────────────
if (!isSampleOnly && !fs.existsSync(FLAG_FILE)) {
  console.error(
    `\n❌ Phase 0 not approved yet for brand: ${BRAND_SLUG}\n` +
    `   Run --sample-only first, review output/${BRAND_SLUG}/sample-20.json,\n` +
    `   then: touch output/${BRAND_SLUG}/phase0-approved.flag\n`
  );
  process.exit(1);
}

// ─── Load source URLs ─────────────────────────────────────────────────────────
function loadSourceUrls() {
  if (isSampleOnly) {
    // Use 20 from brand-configs.js sampleUrls, or first 20 from urls.json
    if (config.sampleUrls && config.sampleUrls.length >= 20) {
      return config.sampleUrls.slice(0, 20);
    }
    if (!fs.existsSync(URLS_FILE)) {
      console.error(`❌ No sampleUrls configured and ${URLS_FILE} missing. Run Phase 1 first.`);
      process.exit(1);
    }
    const all = JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
    // Pick 20 evenly spaced to get variety
    const step = Math.max(1, Math.floor(all.length / 20));
    return all.filter((_, i) => i % step === 0).slice(0, 20);
  }

  if (!fs.existsSync(URLS_FILE)) {
    console.error(`❌ ${URLS_FILE} not found. Run 1-discover-urls.js --brand=${BRAND_SLUG} first.`);
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(URLS_FILE, 'utf8'));
}

// ─── Gallery extraction (dual template) ───────────────────────────────────────
/**
 * Extract gallery image URLs from a hita PDP.
 * Tries new template first (.item.slick-slide[data-slick-index] with /storage/),
 * falls back to legacy template (.main-product-slider .item img with /public/upload/).
 * D-NEW: Also handles cdn.hita.com.vn/storage/ CDN URLs (MOEN, GROHE, ATMOR use CDN).
 *
 * D-06: filter by path pattern, D-02: cap at MAX_IMAGES, dedup with Set
 */
function isProductImage(url) {
  if (!url || !url.startsWith('http')) return false;
  // Accept both hita.com.vn/storage/ and cdn.hita.com.vn/storage/
  if (url.includes('/storage/products/') || url.includes('/storage/product/')) return true;
  if (url.includes('/public/upload/images/')) return true;
  // Fallback: any /storage/ path on hita domains (exclude banners, logos, brands)
  if (url.includes('hita.com.vn') && url.includes('/storage/') &&
      !url.includes('/banner/') && !url.includes('/brands/') &&
      !url.includes('/logo') && !url.includes('loading')) return true;
  return false;
}

async function extractGalleryImages(page) {
  const images = new Set();

  // --- Template 1: slick slides (new hita template)
  const newSlides = await page.locator('.item.slick-slide[data-slick-index]').all();
  for (const slide of newSlides) {
    const img = slide.locator('img').first();
    const src = await img.getAttribute('src').catch(() => null);
    const dataSrc = await img.getAttribute('data-src').catch(() => null);
    const url = dataSrc || src || '';
    if (isProductImage(url)) images.add(url);
    if (images.size >= MAX_IMAGES) break;
  }

  // --- Template 2: legacy .main-product-slider
  if (images.size === 0) {
    const legacyImgs = await page.locator('.main-product-slider .item img').all();
    for (const img of legacyImgs) {
      const src = await img.getAttribute('src').catch(() => null);
      const dataSrc = await img.getAttribute('data-src').catch(() => null);
      const url = dataSrc || src || '';
      if (isProductImage(url)) images.add(url);
      if (images.size >= MAX_IMAGES) break;
    }
  }

  // --- Template 3: broad scan — any img in product containers (CDN brands: MOEN, GROHE, ATMOR)
  // Scoped to main product area only — explicitly excludes upsell/related sections
  if (images.size === 0) {
    const allImgs = await page.evaluate(() => {
      // Find main product container (left column), fallback to full page minus upsell sections
      const root = document.querySelector(
        '.product-column-left, .product-detail-left, .product-images-wrap, .product-detail-content'
      ) || document.body;
      return [...root.querySelectorAll(
        '.product-gallery img, .product-images img, .product-detail img, ' +
        '.box-product img, #product-detail img, .product-img img, ' +
        '.owl-carousel img, .slider-for img, .slider-nav img'
      )]
        // Exclude any img inside upsell / related sections
        .filter(i => !i.closest('.section-buy-more, .related-products, .product-related, .upsell'))
        .map(i => ({ src: i.src || '', dataSrc: i.getAttribute('data-src') || '' }));
    });
    for (const { src, dataSrc } of allImgs) {
      const url = dataSrc || src;
      if (isProductImage(url)) images.add(url);
      if (images.size >= MAX_IMAGES) break;
    }
  }

  // --- Final fallback: grab all page imgs with /storage/products/ path
  if (images.size === 0) {
    const allPageImgs = await page.evaluate(() =>
      [...document.querySelectorAll('img')]
        .map(i => i.getAttribute('data-src') || i.src || '')
        .filter(s => s.includes('/storage/products/') || s.includes('/storage/product/'))
    );
    for (const url of allPageImgs) {
      if (isProductImage(url)) images.add(url);
      if (images.size >= MAX_IMAGES) break;
    }
  }

  return [...images];
}

// ─── Core PDP crawler ─────────────────────────────────────────────────────────
async function crawlPDP(page, url, visitedUrls, enqueueVariant) {
  const start = Date.now();
  let logEntry = { url, status: 'ok', skippedReason: null, durationMs: 0 };

  try {
    await withRetry(async () => {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    });

    // ── SKU (D-03: strict — no slug fallback) ──
    const skuEl = page.locator('.product-sku, .product-code, [class*="sku"], [class*="code"]').first();
    const skuRaw = await skuEl.innerText().catch(() => null);
    const sku = skuRaw
      ? skuRaw.replace(/^(mã|sku|code|model)[^:]*:\s*/i, '').trim()
      : null;

    if (!sku) {
      // Try specs table as fallback
      const specsText = await page.locator('table.product-specs, .specs-table').innerText().catch(() => '');
      const skuFromSpecs = specsText.match(/(?:mã|sku|model)[^:]*:\s*([A-Z0-9\-\/]+)/i)?.[1] || null;
      if (!skuFromSpecs) {
        logEntry.status = 'skipped';
        logEntry.skippedReason = 'sku_null';
        logEntry.durationMs = Date.now() - start;
        return null;
      }
    }

    const finalSku = sku || (await page.locator('table.product-specs').innerText().catch(() => ''))
      .match(/(?:mã|sku|model)[^:]*:\s*([A-Z0-9\-\/]+)/i)?.[1] || null;

    if (!finalSku) {
      logEntry.status = 'skipped';
      logEntry.skippedReason = 'sku_null';
      logEntry.durationMs = Date.now() - start;
      return null;
    }

    // ── Name ──
    const name = await page.locator('h1').first().innerText().catch(() => null);
    if (!name) {
      logEntry.status = 'skipped'; logEntry.skippedReason = 'name_null';
      logEntry.durationMs = Date.now() - start;
      return null;
    }

    // ── Slug ──
    const slug = new URL(url).pathname.replace(/^\//, '').replace(/\.html$/, '');

    // ── hita_product_id (needed for Phase 5 upsell) ──
    const hitaIdMatch = url.match(/-(\d+)\.html$/);
    const hita_product_id = hitaIdMatch ? parseInt(hitaIdMatch[1], 10) : null;

    // ── Price ──
    const priceEl = page.locator('.product-price .price, .price-box .price, [class*="price-new"]').first();
    const priceRaw = await priceEl.innerText().catch(() => null);
    const price = parseVND(priceRaw);

    const originalPriceEl = page.locator('.price-old, .price-through, [class*="price-old"]').first();
    const originalPriceRaw = await originalPriceEl.innerText().catch(() => null);
    const original_price = parseVND(originalPriceRaw);

    // ── Description (D-01: innerText) ──
    const descEl = page.locator('.product-description, .product-content, .tab-content').first();
    const description = await descEl.innerText().catch(() => null);

    // ── Specs ──
    const specs = {};
    const specRows = await page.locator('table.product-specs tr, .specs-table tr, .product-attribute tr').all();
    for (const row of specRows) {
      const cells = await row.locator('td, th').allInnerTexts().catch(() => []);
      if (cells.length >= 2) {
        const key = cells[0].trim().replace(/:$/, '');
        const val = cells[1].trim();
        if (key && val) specs[key] = val;
      }
    }

    // ── Gallery (dual template, D-06) ──
    const images = await extractGalleryImages(page);
    if (images.length === 0) {
      logEntry.status = 'skipped'; logEntry.skippedReason = 'no_images';
      logEntry.durationMs = Date.now() - start;
      return null; // D-11
    }

    // ── Breadcrumb → category (D-05) ──
    const breadcrumbLinks = await page.locator('.breadcrumb a[href], .breadcrumbs a[href]').all();
    let categoryMapping = null;
    for (const link of breadcrumbLinks.reverse()) {
      const href = await link.getAttribute('href').catch(() => null);
      const resolved = resolveUrl(href || '');
      categoryMapping = lookupCategory(resolved);
      if (categoryMapping) break;
    }

    // ── PDFs ──
    const pdfLinks = [];
    for (const selector of ['#box-attachments a[href$=".pdf"]', '#package-attachments a[href$=".pdf"]', 'a[href$=".pdf"]']) {
      const els = await page.locator(selector).all();
      for (const el of els) {
        const href = await el.getAttribute('href').catch(() => null);
        const text = await el.innerText().catch(() => '');
        if (href) pdfLinks.push({ url: resolveUrl(href), title: text.trim() });
      }
      if (pdfLinks.length > 0) break;
    }

    // ── Variants (D-04) ──
    const activeVariantEl = page.locator('.variant-item.active').first();
    const variant_label = await activeVariantEl.innerText().catch(() => null);
    const variant_group_id = variant_label ? slug : null;

    // Enqueue other variants
    const otherVariantEls = await page.locator('.variant-item:not(.active) a[href]').all();
    for (const el of otherVariantEls) {
      const href = await el.getAttribute('href').catch(() => null);
      const variantUrl = resolveUrl(href || '');
      if (variantUrl && variantUrl.startsWith('https://hita.com.vn') && !visitedUrls.has(variantUrl)) {
        enqueueVariant(variantUrl);
      }
    }

    logEntry.durationMs = Date.now() - start;
    logEntry.sku = finalSku;
    logEntry.imageCount = images.length;

    return {
      sku: finalSku,
      name: name.trim(),
      slug,
      hita_product_id,
      price,
      original_price: original_price || null,
      description: description?.trim() || null,
      specs: Object.keys(specs).length > 0 ? specs : null,
      images,
      pdfs: pdfLinks,
      category_id: categoryMapping?.category_id || null,
      subcategory_id: categoryMapping?.subcategory_id || null,
      product_type: categoryMapping?.product_type || null,
      variant_label: variant_label?.trim() || null,
      variant_group_id,
      source_url: url,
    };
  } catch (err) {
    logEntry.status = 'error';
    logEntry.error = err.message;
    logEntry.durationMs = Date.now() - start;
    console.error(`[PDP] ❌ Error: ${url} — ${err.message}`);
    return null;
  } finally {
    crawlLog.push(logEntry);
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
let crawlLog = [];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const mode = isSampleOnly ? 'SAMPLE (20 URLs)' : isResume ? 'RESUME' : 'FULL';
  const parallelNote = isParallel ? ' [PARALLEL MODE — concurrency=2]' : '';
  console.log(`=== Phase 2: Crawl PDPs — brand: ${BRAND_SLUG} [${mode}]${parallelNote} ===\n`);

  if (START_DELAY_S > 0) {
    console.log(`⏳ Stagger delay: waiting ${START_DELAY_S}s before starting...`);
    await sleep(START_DELAY_S * 1000);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let sourceUrls = loadSourceUrls();
  console.log(`Total URLs to process: ${sourceUrls.length}`);

  // Resume: skip already-completed URLs (D-19)
  let completedUrls = new Set();
  let existingProducts = [];

  if (isResume && fs.existsSync(PROGRESS_FILE)) {
    const progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    completedUrls = new Set(Array.isArray(progress) ? progress : []);
    if (fs.existsSync(OUTPUT_FILE)) {
      existingProducts = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    }
    const remaining = sourceUrls.filter(u => !completedUrls.has(u));
    console.log(`Resuming: ${completedUrls.size} done, ${remaining.length} remaining`);
    sourceUrls = remaining;
  }

  const visitedUrls = new Set([...completedUrls, ...sourceUrls]);
  const extraQueue = [];
  const products = [...existingProducts];

  // enqueueVariant: add variant URL to extra queue if not yet visited
  function enqueueVariant(url) {
    if (!visitedUrls.has(url) && !extraQueue.includes(url)) {
      extraQueue.push(url);
      visitedUrls.add(url);
    }
  }

  const browser = await chromium.launch({ headless: true });
  const limit = pLimit(CONCURRENCY);

  try {
    const processUrl = async (url) => {
      const page = await browser.newPage();
      page.on('console', () => {});
      try {
        const product = await crawlPDP(page, url, visitedUrls, enqueueVariant);
        if (product) {
          products.push(product);
          console.log(`[PDP] ✅ ${product.sku} — ${product.name.substring(0, 50)}`);
        } else {
          const entry = crawlLog[crawlLog.length - 1];
          console.log(`[PDP] ⏭  Skipped: ${url} (${entry?.skippedReason || entry?.error || 'unknown'})`);
        }
        completedUrls.add(url);
        // Checkpoint every 50 products
        if (completedUrls.size % 50 === 0) {
          atomicWrite(PROGRESS_FILE, [...completedUrls]);
          atomicWrite(OUTPUT_FILE, products);
        }
      } finally {
        await page.close();
        await sleep(DELAY_MS + Math.random() * DELAY_JITTER);
      }
    };

    // Process initial URLs
    await Promise.all(sourceUrls.map(url => limit(() => processUrl(url))));

    // Process variant URLs discovered during crawl
    if (extraQueue.length > 0) {
      console.log(`\n[Variants] Processing ${extraQueue.length} discovered variant URLs...`);
      await Promise.all(extraQueue.map(url => limit(() => processUrl(url))));
    }

  } finally {
    await browser.close();
  }

  // ── Final save ──
  const outputFile = isSampleOnly ? SAMPLE_FILE : OUTPUT_FILE;
  atomicWrite(outputFile, isSampleOnly ? products : products);
  atomicWrite(LOG_FILE, crawlLog);
  if (!isSampleOnly) atomicWrite(PROGRESS_FILE, [...completedUrls]);

  // ── Summary ──
  const ok = crawlLog.filter(l => l.status === 'ok').length;
  const skipped = crawlLog.filter(l => l.status === 'skipped').length;
  const errors = crawlLog.filter(l => l.status === 'error').length;

  console.log('\n=== Summary ===');
  console.log(`  ✅ OK:      ${ok}`);
  console.log(`  ⏭  Skipped: ${skipped}`);
  console.log(`  ❌ Errors:  ${errors}`);
  console.log(`  📦 Products saved: ${products.length}`);
  console.log(`  Output → ${outputFile}`);

  if (isSampleOnly) {
    console.log(`\n📋 Review sample-20.json, then:`);
    console.log(`   touch output/${BRAND_SLUG}/phase0-approved.flag`);
    console.log(`   node 2-crawl-pdp.js --brand=${BRAND_SLUG}`);
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
