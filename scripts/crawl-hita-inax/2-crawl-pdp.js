/**
 * 2-crawl-pdp.js — Crawl Product Detail Pages từ hita.com.vn
 *
 * LEO-448 (Phase 0 — sample 20 URLs)
 * LEO-450 (Phase 2 — full crawl)
 *
 * Usage:
 *   node 2-crawl-pdp.js --sample-only          # Phase 0: 20 URLs, output sample-20.json
 *   node 2-crawl-pdp.js                         # Phase 2: full crawl (requires phase0-approved.flag)
 *   node 2-crawl-pdp.js --resume                # Resume interrupted full crawl
 *
 * Decisions implemented:
 *   D-01 description: innerText (plain text)
 *   D-02 slider dedup: [data-slick-index], cap 20, Set() dedup URL
 *   D-03 SKU: no fallback from slug — skip if null
 *   D-04 variant_group = slug of isActive variant (deterministic)
 *   D-05 PDF: try #box-attachments first, fallback #package-attachments
 *   D-06 gallery filter: /storage/ in path
 *   D-07 Phase 0: 20 sample URLs → sample-20.json
 *   D-08 crawl-log.json: 8 required fields + pdfSource
 *   D-09 concurrency: p-limit(3)
 *   D-11 validation gate: skip if missing sku/name/images
 *   D-19 resume: --resume flag reads crawl-progress.json
 *   D-20 gate: --sample-only bypasses phase0-approved.flag check
 */

import { chromium } from 'playwright';
import pLimit from 'p-limit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  sleep,
  parseVND,
  resolveUrl,
  atomicWrite,
  loadProgress,
} from './utils.js';

// saveProgress: persist completed URL set to disk
function saveProgress(filePath, completedSet) {
  atomicWrite(filePath, [...completedSet]);
}
import { lookupCategory } from './category-map.js';

// ─── Constants ────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, 'output');
const PROGRESS_FILE = path.join(OUTPUT_DIR, 'crawl-progress.json');
const LOG_FILE = path.join(OUTPUT_DIR, 'crawl-log.json');

const CONCURRENCY = 3;         // D-09
const MAX_IMAGES = 20;          // D-02 hard cap
const DELAY_MS = 1000;          // base delay between requests
const DELAY_JITTER_MS = 800;    // random jitter added to base delay

// ─── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isSampleOnly = args.includes('--sample-only');
const isResume = args.includes('--resume');
const isRecover = args.includes('--recover');

// ─── D-20: Phase gate ────────────────────────────────────────────────────────
if (!isSampleOnly && !fs.existsSync(path.join(OUTPUT_DIR, 'phase0-approved.flag'))) {
  console.error(
    '\n❌ ERROR: Phase 0 chưa được Tech Lead approve.\n' +
    '   Chạy --sample-only trước, kiểm tra output/sample-20.json,\n' +
    '   sau đó tạo file: touch output/phase0-approved.flag\n'
  );
  process.exit(1);
}

// ─── D-07: 20 sample URLs (Phase 0) ─────────────────────────────────────────
const SAMPLE_URLS = [
  'https://hita.com.vn/bon-cau-1-khoi-inax-ac-1008vrn-543.html',
  'https://hita.com.vn/bon-cau-1-khoi-nap-dien-tu-inax-ac-1008r-cw-h17vn-7891.html',
  'https://hita.com.vn/combo-inax-116-ac-1008r-cw-h18vn-3242.html',
  'https://hita.com.vn/sen-tam-inax-bfv-113s-1886.html',
  'https://hita.com.vn/chau-rua-duong-vanh-inax-l-2397v-1515.html',
  'https://hita.com.vn/van-xa-bon-tieu-inax-uf-3vs-636.html',
  'https://hita.com.vn/pheu-thoat-san-inax-pbfv-120-1440.html',
  'https://hita.com.vn/pheu-thoat-san-inax-pbfv-110-1441.html',
  'https://hita.com.vn/chau-rua-am-ban-inax-l-2298v-1517.html',
  'https://hita.com.vn/chau-rua-am-ban-inax-l-2293v-1518.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-l-298v-l-298vc-1522.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-l-297v-l-297vc-1523.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-s-17v-1524.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-l-285v-l288vc-1527.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-l-284v-l-284vc-1529.html',
  'https://hita.com.vn/chau-rua-treo-tuong-inax-l-282v-1532.html',
  'https://hita.com.vn/ong-xa-chau-inax-a-016v-1543.html',
  'https://hita.com.vn/bon-cau-1-khoi-inax-ac-909vrn-1821.html',
  'https://hita.com.vn/bon-cau-2-khoi-inax-ac-808vn-1825.html',
  'https://hita.com.vn/bon-cau-1-khoi-inax-ac-918vrn-1828.html'
];

// ─── Logging ──────────────────────────────────────────────────────────────────
let crawlLog = [];

function appendLog(entry) {
  crawlLog.push(entry);
}

function flushLog() {
  atomicWrite(LOG_FILE, crawlLog);
}

// ─── Core PDP crawler ─────────────────────────────────────────────────────────
/**
 * Crawl a single Product Detail Page.
 *
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} url - full URL of the PDP
 * @param {Set<string>} visitedUrls - shared visited set (mutated for variant dedup)
 * @returns {Object|null} product data or null if skipped
 */
async function crawlPDP(page, url, visitedUrls) {
  const enqueue = global.enqueue || (() => {});
  const start = Date.now();
  let logEntry = {
    url,
    status: 'error',
    sku: null,
    imagesCount: 0,
    hasVariants: false,
    hasPdf: false,
    error: null,
    durationMs: 0,
    pdfSource: null,   // D-05: log which selector matched
  };

  try {
    // ── Navigate & check 404 ──────────────────────────────────────────────
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (!response || response.status() === 404) {
      logEntry.status = '404';
      logEntry.durationMs = Date.now() - start;
      appendLog(logEntry);
      console.log(`  ⚠️  404 skip: ${url}`);
      return null;
    }

    if (response.status() >= 400) {
      logEntry.status = `http-${response.status()}`;
      logEntry.error = `HTTP ${response.status()}`;
      logEntry.durationMs = Date.now() - start;
      appendLog(logEntry);
      console.log(`  ⚠️  HTTP ${response.status()} skip: ${url}`);
      return null;
    }

    // Allow lazy-load images to start loading
    await sleep(800);

    // ── Slug ─────────────────────────────────────────────────────────────
    const slug = new URL(page.url()).pathname.replace(/^\/|\.html$/g, '');

    // ── Name ─────────────────────────────────────────────────────────────
    const name = (await page.locator('h1').innerText({ timeout: 1000 }).catch(() => '')).trim();

    // ── SKU (D-03: no fallback from slug) ────────────────────────────────
    let sku = '';
    try {
      const ldJsonTexts = await page.locator('script[type="application/ld+json"]').allInnerTexts();
      for (const text of ldJsonTexts) {
        const data = JSON.parse(text);
        if (data['@type'] === 'Product' && data.sku) {
          sku = data.sku.trim();
          break;
        }
      }
    } catch (e) {
      // Ignore parse errors
    }

    if (!sku) {
      const skuRaw = await page.locator('.product-code').innerText({ timeout: 1000 }).catch(() => '');
      sku = skuRaw.replace(/^M[aã]\s*(?:SP|h[aà]ng)\s*:\s*/i, '').trim();
    }

    // ── Gallery Images (D-02, D-06) ───────────────────────────────────────
    // Use [data-slick-index] to select only native slides, not Slick clones
    const slides = await page.locator('.item.slick-slide[data-slick-index]').all();
    const seenImageUrls = new Set();
    const images = [];

    for (const slide of slides) {
      if (images.length >= MAX_IMAGES) break;

      const img = slide.locator('img').first();

      // D-Bẫy1: first slide may not have data-src (already loaded), fallback to src
      const dataSrc = await img.getAttribute('data-src').catch(() => null);
      const src = await img.getAttribute('src').catch(() => null);
      const raw = dataSrc || src || '';
      const imgUrl = raw.startsWith('/') ? `https://hita.com.vn${raw}` : raw;

      // Skip YouTube thumbnails
      if (!imgUrl || imgUrl.includes('i.ytimg.com')) continue;
      // Skip placeholders
      if (imgUrl.includes('images/original.jpg') || imgUrl.includes('placeholder')) continue;
      // D-06: only /storage/ images (covers both cdn.hita.com.vn and hita.com.vn)
      if (!imgUrl.includes('/storage/')) continue;
      // Skip video slides (play button inside slide)
      const hasPlayButton = await slide.locator('.play-button, .product-yt, [class*="play"]').count() > 0;
      if (hasPlayButton) continue;
      // Dedup
      if (seenImageUrls.has(imgUrl)) continue;

      seenImageUrls.add(imgUrl);
      images.push(imgUrl);
    }

    // Attempt 2: Fallback — legacy template (main-product-slider)
    if (images.length === 0) {
      const legacyImgs = await page.evaluate(() => {
        return [...document.querySelectorAll('.main-product-slider .item img')]
          .map(img => {
            const raw = img.getAttribute('data-src') || img.getAttribute('src') || '';
            return raw.startsWith('/') ? `https://hita.com.vn${raw}` : raw;
          })
          .filter(url => url && 
            !url.includes('ytimg') && 
            !url.includes('placeholder') &&
            // Accept cả /storage/ và /public/upload/
            (url.includes('/storage/') || url.includes('/public/upload/'))
          );
      });
      for (const imgUrl of legacyImgs) {
        if (images.length >= MAX_IMAGES) break;
        if (seenImageUrls.has(imgUrl)) continue;
        seenImageUrls.add(imgUrl);
        images.push(imgUrl);
      }
    }

    // ── Variants (D-04) ──────────────────────────────────────────────────
    const variants = await page.evaluate(() =>
      [...document.querySelectorAll('.variant-item')].map(el => ({
        label: el.querySelector('.variant-name, span')?.innerText?.trim() || el.innerText.split('\n')[0].trim(),
        url: el.href?.replace(/#$/, '') || null,
        isActive: el.classList.contains('active')
      }))
    );

    const activeVariant = variants.find(v => v.isActive);
    const variant_label = activeVariant?.label ?? null;
    let variantGroupId = slug;
    
    if (variants.length > 0) {
      const allUrls = variants.map(v => v.url).filter(u => u && !u.endsWith('.com.vn') && !u.endsWith('.com.vn/')).sort();
      if (allUrls.length > 0) {
        variantGroupId = new URL(allUrls[0]).pathname.replace(/^\/|\.html$/g, '');
      }
    }

    // is_master = true if this page is the variant used as the group ID
    const isMaster = variantGroupId === slug;

    // ── Pricing ─────────────────────────────────────────────────────────
    const priceBlock = await page.locator('#main-price-product').innerText({ timeout: 1000 }).catch(() => '');
    const currentPriceMatch = priceBlock.match(/([\d.]+đ)/);
    const originalMatch = priceBlock.match(/Giá gốc:\s*([\d.]+đ)/);
    const discountMatch = priceBlock.match(/Giảm thêm:\s*([\d.]+đ)/);

    const price = parseVND(currentPriceMatch?.[1]);
    const originalPrice = parseVND(originalMatch?.[1]);
    const onlineDiscountAmount = parseVND(discountMatch?.[1]);

    // ── Breadcrumb → Category ────────────────────────────────────────────
    const breadcrumbEls = await page.locator('.breadcrumbs li a').all();
    const crumbs = await Promise.all(
      breadcrumbEls.map(async (el) => ({
        text: (await el.innerText()).trim(),
        href: await el.getAttribute('href'),
      }))
    );
    // crumbs[0] = "Trang Chủ" (skip), crumbs[1] = cat1, crumbs[2] = subcat
    const subcatCrumb = crumbs[2] || crumbs[1] || null;
    const subcatPath = subcatCrumb?.href
      ? new URL(subcatCrumb.href, 'https://hita.com.vn').pathname
      : null;

    const mappedCat = lookupCategory(subcatPath) || {};
    const category_id = 'thiet-bi-ve-sinh';
    const subcategory_id = mappedCat.subcategory_id || null;
    const product_type = mappedCat.product_type || null;

    if (!subcatPath || !subcategory_id) {
      console.warn(`  ⚠️  Unknown category: "${subcatPath}" — ${url}`);
    }

    // ── Specs ────────────────────────────────────────────────────────────
    const specs = {};
    const specRows = await page.locator('#box-specification table tr').all();
    for (const row of specRows) {
      const cells = await row.locator('td').all();
      if (cells.length >= 2) {
        const key = (await cells[0].innerText()).trim();
        const val = (await cells[1].innerText()).trim();
        if (key && val) specs[key] = val;
      }
    }

    // ── Nguyên hộp (In the box) — only on toilets/combos ────────────────
    const inBox = await page
      .locator('#box-package-include .panel-body')
      .innerText({ timeout: 1000 })
      .catch(() => null);
    if (inBox && inBox.trim()) {
      specs['Nguyên hộp'] = inBox.trim();
    }

    // ── Description (D-01: HTML) ─────────────────────────────────
    const descData = await page.evaluate(() => {
      const el = document.querySelector('#description-content');
      if (!el) return { html: null, imageUrls: [] };
      const clone = el.cloneNode(true);

      // Strip hyperlinks — keep text content
      clone.querySelectorAll('a').forEach(a =>
        a.replaceWith(document.createTextNode(a.innerText || a.textContent || ''))
      );

      // Strip video/iframe embeds
      clone.querySelectorAll('iframe, video, [class*="video"], [class*="embed"]').forEach(el => el.remove());

      // Fix lazy images + collect URLs
      const imageUrls = [];
      clone.querySelectorAll('img').forEach(img => {
        const raw = img.getAttribute('data-src') || img.getAttribute('src') || '';
        const resolved = raw.startsWith('/') ? `https://hita.com.vn${raw}` : raw;
        if (resolved && (resolved.includes('/storage/') || resolved.includes('/tinymce/'))) {
          img.setAttribute('src', resolved);
          img.removeAttribute('data-src');
          img.removeAttribute('class');
          imageUrls.push(resolved);
        } else {
          img.remove();
        }
      });

      // Xóa nút "Xem thêm"
      clone.querySelector('.description-show-more')?.remove();

      // Chỉ lấy content bên trong, không lấy wrapper ngoài
      const innerEl = clone.querySelector('.editor-content, .description-collapse') ?? clone;

      return { html: innerEl.innerHTML.trim(), imageUrls };
    });

    const cleanDescription = descData.html;
    const descriptionImageUrls = descData.imageUrls;

    // ── PDFs (D-05: try both selectors, log source) ──────────────────────
    let pdfs = [];
    let pdfSource = null;

    // Try #box-attachments first (spec-preferred)
    const boxAttachLinks = await page
      .locator('#box-attachments a[href$=".pdf"]')
      .all();

    if (boxAttachLinks.length > 0) {
      pdfSource = '#box-attachments';
      pdfs = await Promise.all(
        boxAttachLinks.map(async (a) => ({
          name: (await a.innerText()).trim(),
          url: resolveUrl(await a.getAttribute('href')),
        }))
      );
    } else {
      // Fallback: #package-attachments (recon finding)
      const pkgAttachLinks = await page
        .locator('#package-attachments a[href$=".pdf"]')
        .all();
      if (pkgAttachLinks.length > 0) {
        pdfSource = '#package-attachments';
        pdfs = await Promise.all(
          pkgAttachLinks.map(async (a) => ({
            name: (await a.innerText()).trim(),
            url: resolveUrl(await a.getAttribute('href')),
          }))
        );
      }
    }

    if (pdfSource) {
      console.log(`  📄 PDF (${pdfSource}): ${pdfs.length} file(s) — ${url}`);
    }

    // ── YouTube video ────────────────────────────────────────────────────
    const youtubeId = await page
      .locator('#video-product-btn[data-embed]')
      .getAttribute('data-embed', { timeout: 1000 })
      .catch(() => null);

    // ── D-11: Validation gate ─────────────────────────────────────────────
    if (!sku || !name || images.length === 0) {
      const missingFields = [
        !sku && 'sku',
        !name && 'name',
        images.length === 0 && 'images',
      ].filter(Boolean);

      logEntry.status = 'skip';
      logEntry.reason = 'missing-required-fields';
      logEntry.sku = sku || null;
      logEntry.imagesCount = images.length;
      logEntry.hasVariants = variants.length > 0;
      logEntry.hasPdf = pdfs.length > 0;
      logEntry.error = `Missing required fields: ${missingFields.join(', ')}`;
      logEntry.durationMs = Date.now() - start;
      logEntry.pdfSource = pdfSource;
      appendLog(logEntry);

      console.log(`  ⚠️  Skip (${missingFields.join(', ')} missing): ${url}`);
      return null;
    }

    if (price === null) {
      logEntry.status = 'ok-price-null';
      logEntry.reason = 'price-on-request';
    } else {
      logEntry.status = 'ok';
    }

    // ── Build product object ──────────────────────────────────────────────
    const product = {
      url,
      slug,
      name,
      sku,
      price,
      original_price: originalPrice,
      online_discount_amount: onlineDiscountAmount,
      category_id,
      subcategory_id,
      product_type,
      hita_category_url: subcatPath,
      specs,
      description: cleanDescription,
      descriptionImageUrls,
      images,
      variants,
      variant_label,
      variant_group_id: variantGroupId,
      is_master: isMaster,
      pdfs,
      youtube_id: youtubeId || null,
    };

    // Auto-queue các variant chưa crawl
    for (const v of variants) {
      if (v.url && !v.isActive && !visitedUrls.has(v.url)) {
        visitedUrls.add(v.url); // Đánh dấu để tránh queue trùng
        enqueue(v.url);
      }
    }

    // ── Log success ──────────────────────────────────────────────────────
    // logEntry.status đã được set ở validation gate
    logEntry.sku = sku;
    logEntry.imagesCount = images.length;
    logEntry.hasVariants = variants.length > 0;
    logEntry.hasPdf = pdfs.length > 0;
    logEntry.durationMs = Date.now() - start;
    logEntry.pdfSource = pdfSource;
    appendLog(logEntry);

    console.log(
      `  ✅ OK [${sku}] "${name.substring(0, 50)}" ` +
      `imgs=${images.length} vars=${variants.length} pdf=${pdfs.length} ` +
      `${youtubeId ? '🎥' : ''} (${logEntry.durationMs}ms)`
    );

    return product;

  } catch (err) {
    logEntry.status = 'error';
    logEntry.error = err.message;
    logEntry.durationMs = Date.now() - start;
    appendLog(logEntry);
    console.error(`  ❌ ERROR: ${url}\n     ${err.message}`);
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // ── Determine URL list ──────────────────────────────────────────────────
  let urlsToProcess;

  if (isSampleOnly) {
    urlsToProcess = SAMPLE_URLS;
    console.log(`\n🔬 Phase 0 — Sample mode: ${urlsToProcess.length} URLs\n`);
  } else if (isRecover) {
    if (!fs.existsSync(LOG_FILE)) {
      console.error(`❌ ERROR: ${LOG_FILE} not found. Cannot recover.`);
      process.exit(1);
    }
    const fullLog = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    urlsToProcess = fullLog
      .filter(item => item.status === 'skip' && item.reason === 'missing-required-fields')
      .map(item => item.url);
    console.log(`\n🚀 Phase 2 — Recover mode: ${urlsToProcess.length} URLs\n`);
  } else {
    const inaxUrlsFile = path.join(OUTPUT_DIR, 'inax-urls.json');
    if (!fs.existsSync(inaxUrlsFile)) {
      console.error(`❌ ERROR: ${inaxUrlsFile} not found. Run 1-discover-urls.js first.`);
      process.exit(1);
    }
    urlsToProcess = JSON.parse(fs.readFileSync(inaxUrlsFile, 'utf8'));
    console.log(`\n🚀 Phase 2 — Full crawl: ${urlsToProcess.length} URLs\n`);
  }

  // ── D-19: Resume — skip already-completed URLs ──────────────────────────
  const visitedUrls = new Set();
  let completedUrls = new Set();

  if (isResume && !isSampleOnly) {
    completedUrls = loadProgress(PROGRESS_FILE);
    // Merge into visitedUrls so variant dedup still works
    for (const u of completedUrls) visitedUrls.add(u);
  }

  const pendingUrls = urlsToProcess.filter((u) => !completedUrls.has(u));
  const skippedByResume = urlsToProcess.length - pendingUrls.length;

  if (skippedByResume > 0) {
    console.log(`⏭️  Resume: skipping ${skippedByResume} already-completed URLs\n`);
  }

  // Load existing results when resuming or recovering
  let allProducts = [];
  if ((isResume || isRecover) && !isSampleOnly) {
    const existingFile = path.join(OUTPUT_DIR, 'crawled-products.json');
    if (fs.existsSync(existingFile)) {
      allProducts = JSON.parse(fs.readFileSync(existingFile, 'utf8'));
      console.log(`  Loaded ${allProducts.length} existing products\n`);
    }
  }

  // ── Launch browser ──────────────────────────────────────────────────────
  const browser = await chromium.launch({ headless: true });

  try {
    const limit = pLimit(CONCURRENCY); // D-09: max 3 concurrent pages
    let processedCount = 0;

    // Define enqueue globally so it can be called inside crawlPDP
    global.enqueue = (newUrl) => {
      limit(async () => {
        if (visitedUrls.has(newUrl) && completedUrls.has(newUrl)) {
          return null;
        }

        const page = await browser.newPage();
        try {
          const product = await crawlPDP(page, newUrl, visitedUrls);

          if (product) {
            allProducts.push(product);
          }

          completedUrls.add(newUrl);
          visitedUrls.add(newUrl);
          processedCount++;

          if (!isSampleOnly && processedCount % 10 === 0) {
            atomicWrite(path.join(OUTPUT_DIR, 'crawled-products.json'), allProducts);
            saveProgress(PROGRESS_FILE, completedUrls);
            flushLog();
            console.log(`  💾 Progress saved: ${allProducts.length} products, ${completedUrls.size} done`);
          }

          await sleep(DELAY_MS + Math.random() * DELAY_JITTER_MS);
        } finally {
          await page.close();
        }
      });
    };

    // Khởi tạo các URL ban đầu
    for (const url of pendingUrls) {
      if (!visitedUrls.has(url)) {
        visitedUrls.add(url);
      }
      global.enqueue(url);
    }

    // Đợi cho đến khi queue rỗng
    while (limit.activeCount > 0 || limit.pendingCount > 0) {
      await sleep(1000);
    }

  } finally {
    await browser.close();
  }

  // ── Write output files ──────────────────────────────────────────────────
  const outputFile = isSampleOnly
    ? path.join(OUTPUT_DIR, 'sample-20.json')
    : path.join(OUTPUT_DIR, 'crawled-products.json');

  atomicWrite(outputFile, allProducts);
  flushLog();

  if (!isSampleOnly) {
    saveProgress(PROGRESS_FILE, completedUrls);
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  const successCount = crawlLog.filter((l) => l.status === 'ok').length;
  const priceNullCount = crawlLog.filter((l) => l.status === 'ok-price-null').length;
  const skipCount = crawlLog.filter((l) => l.status === 'skip').length;
  const errorCount = crawlLog.filter((l) => l.status === 'error').length;
  const notFoundCount = crawlLog.filter((l) => l.status === '404').length;

  console.log('\n══════════════════════════════════════════════════');
  console.log(`📦 Crawl complete`);
  console.log(`   ✅ OK:      ${successCount} (bao gồm ${priceNullCount} price=null)`);
  console.log(`   ⏭️  Skip:    ${skipCount}  (missing required fields)`);
  console.log(`   ⚠️  404:     ${notFoundCount}`);
  console.log(`   ❌ Error:   ${errorCount}`);
  console.log(`   📁 Output:  ${outputFile}`);
  console.log(`   📋 Log:     ${LOG_FILE}`);

  if (isSampleOnly) {
    console.log('\n──────────────────────────────────────────────────');
    console.log('🔍 Phase 0 checklist — verify before approving:');
    console.log('  [ ] output/sample-20.json tồn tại, đúng schema');
    console.log('  [ ] Không có "images/original.jpg" trong image field');
    console.log('  [ ] URL #1 và #2 có cùng variant_group_id');
    console.log('  [ ] URL #6 (404) bị skip gracefully, ghi crawl-log');
    console.log('  [ ] description là plain text, không HTML tags');
    console.log('  [ ] PDF URL trỏ đúng về .pdf');
    console.log('  [ ] crawl-log.json có đủ 8 fields');
    console.log('  [ ] Không có SKU nào derive từ slug');
    console.log('\n✅ Sau khi verify: touch output/phase0-approved.flag');
  }

  console.log('══════════════════════════════════════════════════\n');
}

main().catch((err) => {
  console.error('💥 Fatal error:', err);
  flushLog();
  process.exit(1);
});
