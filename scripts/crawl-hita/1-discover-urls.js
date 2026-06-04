/**
 * Phase 1: Discover product URLs from hita.com.vn for a given brand.
 *
 * Usage:
 *   node 1-discover-urls.js --brand=caesar
 *   node 1-discover-urls.js --brand=grohe
 *
 * Two discovery sources (both required, results merged & deduped):
 *   1A. Sitemap pages (N=1..20) — filter URLs by brand's sitemapKeyword
 *   1B. Brand landing page + pagination — catches slugs without keyword in URL
 *
 * Output: output/<brand>/urls.json (array of URL strings)
 *
 * Decisions carried over from LEO-448 INAX crawl:
 *   D-18 Loop variable MUST be `pageNum`, never `page` (shadows Playwright Page)
 *   D-21 Both sitemap AND brand page sources are required
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sleep, atomicWrite } from './utils.js';
import { parseBrandArg, getBrandConfig } from './brand-configs.js';

// ─── Config ───────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRAND_SLUG = parseBrandArg();
const config = getBrandConfig(BRAND_SLUG);

const OUTPUT_DIR = path.resolve(__dirname, `output/${BRAND_SLUG}`);
const OUTPUT_PATH = path.join(OUTPUT_DIR, 'urls.json');

const SITEMAP_BASE = 'https://hita.com.vn/product-sitemap.xml?page=';
const SITEMAP_PAGES = 20;
const BASE_URL = 'https://hita.com.vn';

// Slower delays when running in parallel with other brands
const isParallel = process.argv.includes('--parallel');
const startDelayArg = process.argv.find(a => a.startsWith('--start-delay='));
const START_DELAY_S = startDelayArg ? parseInt(startDelayArg.split('=')[1], 10) : 0;

const DELAY_MIN_MS = isParallel ? 1500 : 1000;
const DELAY_MAX_MS = isParallel ? 2200 : 1500;

// ─── Sitemap discovery (Phase 1A) ─────────────────────────────────────────────
async function discoverFromSitemap(page) {
  const found = [];
  const keyword = config.sitemapKeyword.toLowerCase();

  for (let pageNum = 1; pageNum <= SITEMAP_PAGES; pageNum++) {
    const url = `${SITEMAP_BASE}${pageNum}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const text = await page.locator('pre, body').innerText().catch(() => '');
      const allUrls = text.match(/https:\/\/hita\.com\.vn\/[^\s<>]+\.html/g) || [];
      const brandUrls = allUrls.filter(u => u.toLowerCase().includes(keyword));

      for (const u of brandUrls) {
        if (!found.includes(u)) found.push(u);
      }
      console.log(`[Sitemap] Page ${pageNum}/${SITEMAP_PAGES} — +${brandUrls.length} (total: ${found.length})`);
    } catch (err) {
      console.error(`[Sitemap] ⚠️  Error page ${pageNum}: ${err.message}`);
    }
    if (pageNum < SITEMAP_PAGES) await sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  }

  console.log(`[Sitemap] ✅ Done — ${found.length} unique URLs`);
  return found;
}

// ─── Brand page discovery (Phase 1B) ──────────────────────────────────────────
function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BASE_URL}${href}`;
  return href;
}

async function extractProductUrlsFromPage(page) {
  const hrefs = await page.evaluate(() => {
    const candidates = [
      ...document.querySelectorAll('.product-item a[href]'),
      ...document.querySelectorAll('[class*="product"] a[href]'),
    ];
    return [...new Set(
      candidates.map(a => a.getAttribute('href') || '').filter(h => h.includes('.html'))
    )];
  });
  return hrefs.map(resolveUrl).filter(u => u.startsWith(BASE_URL) && u.endsWith('.html'));
}

async function extractPaginationUrls(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll('.pagination a[href]')]
      .map(a => a.getAttribute('href') || '').filter(Boolean)
  );
  return [...new Set(hrefs.map(resolveUrl).filter(u => u.startsWith(BASE_URL)))];
}

async function discoverFromBrandPage(page) {
  const found = [];
  const visitedPages = new Set();
  const queue = [config.brandPageUrl];

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    if (visitedPages.has(currentUrl)) continue;
    visitedPages.add(currentUrl);

    try {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      const productUrls = await extractProductUrlsFromPage(page);
      let newProducts = 0;
      for (const u of productUrls) {
        if (!found.includes(u)) { found.push(u); newProducts++; }
      }

      const paginationUrls = await extractPaginationUrls(page);
      let newPages = 0;
      for (const pUrl of paginationUrls) {
        if (!visitedPages.has(pUrl) && !queue.includes(pUrl)) { queue.push(pUrl); newPages++; }
      }

      console.log(
        `[BrandPage] ${currentUrl.replace(BASE_URL, '')} — +${newProducts} products, +${newPages} pages (total: ${found.length})`
      );
    } catch (err) {
      console.error(`[BrandPage] ⚠️  Error: ${currentUrl} — ${err.message}`);
    }

    if (queue.length > 0) await sleep(DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS));
  }

  console.log(`[BrandPage] ✅ Done — ${found.length} URLs (${visitedPages.size} listing pages)`);
  return found;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (START_DELAY_S > 0) {
    console.log(`⏳ Stagger delay: waiting ${START_DELAY_S}s...`);
    await new Promise(r => setTimeout(r, START_DELAY_S * 1000));
  }
  console.log(`=== Phase 1: Discover URLs — brand: ${BRAND_SLUG} ===`);
  console.log(`Brand page: ${config.brandPageUrl}`);
  console.log(`Sitemap keyword: "${config.sitemapKeyword}"`);
  console.log(`Output → ${OUTPUT_PATH}\n`);

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    page.on('console', () => {});

    console.log('--- Phase 1A: Sitemap ---');
    const sitemapUrls = await discoverFromSitemap(page);

    console.log('\n--- Phase 1B: Brand page ---');
    const brandUrls = await discoverFromBrandPage(page);

    const allUrlsRaw = [...new Set([...sitemapUrls, ...brandUrls])];

    // Filter: product URLs on hita.com.vn always have numeric ID >= 1000 (e.g. -7462.html)
    // Category/brand/service pages have ID < 1000 (e.g. -383.html, -97.html)
    // This prevents ~270 non-product URLs from being crawled per brand (saves ~4.5h per run)
    const allUrls = allUrlsRaw.filter(u => {
      const m = u.match(/-(\d+)\.html$/);
      return m && parseInt(m[1], 10) >= 1000;
    });
    const filteredOut = allUrlsRaw.length - allUrls.length;

    console.log('\n=== Summary ===');
    console.log(`  Sitemap:       ${sitemapUrls.length}`);
    console.log(`  Brand page:    ${brandUrls.length}`);
    console.log(`  Merged raw:    ${allUrlsRaw.length}`);
    console.log(`  Filtered out:  ${filteredOut} (non-product pages, ID < 1000)`);
    console.log(`  Final:         ${allUrls.length}`);

    atomicWrite(OUTPUT_PATH, allUrls);
    console.log(`\n✅ Saved → ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
