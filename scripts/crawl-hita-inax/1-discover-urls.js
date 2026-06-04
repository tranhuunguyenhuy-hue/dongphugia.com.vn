/**
 * Phase 1: Discover INAX URLs from hita.com.vn
 *
 * Two sources:
 *   1A. Sitemap pages (N=1..20) — filter URLs containing "inax"
 *   1B. Brand page https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html — catch slugs without "inax"
 *
 * Output: output/inax-urls.json (deduped array of URL strings)
 *
 * Decision D-18: Loop variable MUST be `pageNum`, never `page` (shadows Playwright page object).
 * Decision D-21: Both sitemap AND brand page sources are required.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Helpers (inline — utils.js may not exist yet)
// ---------------------------------------------------------------------------

/**
 * Sleep for a random duration between minMs and maxMs.
 * @param {number} minMs
 * @param {number} maxMs
 */
function sleep(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Write JSON atomically: write to a temp file first, then rename.
 * Prevents corrupt output if the process is killed mid-write.
 * @param {string} filePath
 * @param {unknown} data
 */
function atomicWrite(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SITEMAP_BASE = 'https://hita.com.vn/product-sitemap.xml?page=';
const SITEMAP_PAGES = 20;

const BRAND_PAGE_URL = 'https://hita.com.vn/thiet-bi-ve-sinh-inax-97.html';
const BASE_URL = 'https://hita.com.vn';

/** Rate-limit delay range (ms) between consecutive page loads */
const DELAY_MIN_MS = 1000;
const DELAY_MAX_MS = 1500;

/** Output file path (relative to repo root) */
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.resolve(__dirname, 'output/inax-urls.json');

// ---------------------------------------------------------------------------
// Phase 1A — Sitemap crawl
// ---------------------------------------------------------------------------

/**
 * Crawl all 20 sitemap pages and extract URLs that contain "inax".
 *
 * @param {import('playwright').Page} page  Playwright page object
 * @returns {Promise<string[]>}
 */
async function discoverFromSitemap(page) {
  const found = [];

  for (let pageNum = 1; pageNum <= SITEMAP_PAGES; pageNum++) {
    const url = `${SITEMAP_BASE}${pageNum}`;

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // Sitemap XML is rendered as plain text in the browser; grab it all
      const text = await page.locator('pre, body').innerText().catch(() => '');

      // Extract all hita product URLs from the text
      const allUrls = text.match(/https:\/\/hita\.com\.vn\/[^\s<>]+\.html/g) || [];

      // Filter: keep only URLs that contain "inax" (case-insensitive)
      const inaxUrls = allUrls.filter(u =>
        u.toLowerCase().includes('inax') || u.toLowerCase().includes('-inax-')
      );

      // Deduplicate within this batch before pushing
      for (const u of inaxUrls) {
        if (!found.includes(u)) found.push(u);
      }

      console.log(
        `[Sitemap] Page ${pageNum}/${SITEMAP_PAGES} — found ${inaxUrls.length} INAX URLs` +
        ` (running total: ${found.length})`
      );
    } catch (err) {
      console.error(`[Sitemap] ⚠️  Error on page ${pageNum}: ${err.message}`);
    }

    // Rate limit: pause between pages (skip delay after last page)
    if (pageNum < SITEMAP_PAGES) {
      await sleep(DELAY_MIN_MS, DELAY_MAX_MS);
    }
  }

  console.log(`[Sitemap] ✅ Done — ${found.length} unique INAX URLs`);
  return found;
}

// ---------------------------------------------------------------------------
// Phase 1B — Brand page crawl
// ---------------------------------------------------------------------------

/**
 * Resolve a potentially relative href to an absolute URL.
 * @param {string} href
 * @returns {string}
 */
function resolveUrl(href) {
  if (!href) return '';
  if (href.startsWith('http')) return href;
  if (href.startsWith('/')) return `${BASE_URL}${href}`;
  return href;
}

/**
 * Extract all product URLs from a single listing page.
 * Uses multiple selectors to be resilient to class name variations.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
async function extractProductUrlsFromPage(page) {
  const hrefs = await page.evaluate(() => {
    const candidates = [
      // Primary: explicit .product-item links
      ...document.querySelectorAll('.product-item a[href]'),
      // Fallback: any anchor inside an element whose class contains "product"
      ...document.querySelectorAll('[class*="product"] a[href]'),
    ];

    return [...new Set(
      candidates
        .map(a => a.getAttribute('href') || '')
        .filter(href => href.includes('.html'))
    )];
  });

  return hrefs
    .map(resolveUrl)
    .filter(u => u.startsWith(BASE_URL) && u.endsWith('.html'));
}

/**
 * Extract all pagination page URLs from the current listing page.
 * Returns resolved absolute URLs (excluding the current page).
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<string[]>}
 */
async function extractPaginationUrls(page) {
  const hrefs = await page.evaluate(() => {
    return [...document.querySelectorAll('.pagination a[href]')]
      .map(a => a.getAttribute('href') || '')
      .filter(Boolean);
  });

  return [...new Set(hrefs.map(resolveUrl).filter(u => u.startsWith(BASE_URL)))];
}

/**
 * Crawl the INAX brand page and all its pagination pages.
 * This supplements the sitemap by catching product slugs that don't contain "inax".
 *
 * @param {import('playwright').Page} page  Playwright page object
 * @returns {Promise<string[]>}
 */
async function discoverFromBrandPage(page) {
  const found = [];
  const visitedPages = new Set();

  // Queue starts with the brand page root
  const queue = [BRAND_PAGE_URL];

  while (queue.length > 0) {
    const currentUrl = queue.shift();

    if (visitedPages.has(currentUrl)) continue;
    visitedPages.add(currentUrl);

    try {
      await page.goto(currentUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // 1. Collect product URLs on this listing page
      const productUrls = await extractProductUrlsFromPage(page);
      let newCount = 0;
      for (const u of productUrls) {
        if (!found.includes(u)) {
          found.push(u);
          newCount++;
        }
      }

      // 2. Discover pagination links and enqueue unvisited ones
      const paginationUrls = await extractPaginationUrls(page);
      let newPages = 0;
      for (const pUrl of paginationUrls) {
        if (!visitedPages.has(pUrl) && !queue.includes(pUrl)) {
          queue.push(pUrl);
          newPages++;
        }
      }

      console.log(
        `[BrandPage] ${currentUrl.replace(BASE_URL, '')}` +
        ` — +${newCount} products, +${newPages} pages queued` +
        ` (running total: ${found.length})`
      );
    } catch (err) {
      console.error(`[BrandPage] ⚠️  Error on ${currentUrl}: ${err.message}`);
    }

    // Rate limit between listing pages
    if (queue.length > 0) {
      await sleep(DELAY_MIN_MS, DELAY_MAX_MS);
    }
  }

  console.log(`[BrandPage] ✅ Done — ${found.length} product URLs (${visitedPages.size} listing pages crawled)`);
  return found;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Phase 1: Discover INAX URLs ===');
  console.log(`Output → ${OUTPUT_PATH}`);
  console.log('');

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // Suppress noisy browser console messages
    page.on('console', () => {});

    // -----------------------------------------------------------------------
    // 1A: Sitemap
    // -----------------------------------------------------------------------
    console.log('--- Phase 1A: Sitemap crawl ---');
    const sitemapUrls = await discoverFromSitemap(page);
    console.log('');

    // -----------------------------------------------------------------------
    // 1B: Brand page
    // -----------------------------------------------------------------------
    console.log('--- Phase 1B: Brand page crawl ---');
    const brandUrls = await discoverFromBrandPage(page);
    console.log('');

    // -----------------------------------------------------------------------
    // Merge & deduplicate
    // -----------------------------------------------------------------------
    const allUrls = [...new Set([...sitemapUrls, ...brandUrls])];

    console.log('=== Summary ===');
    console.log(`  Sitemap URLs:    ${sitemapUrls.length}`);
    console.log(`  Brand page URLs: ${brandUrls.length}`);
    console.log(`  Merged unique:   ${allUrls.length}`);
    console.log('');

    // -----------------------------------------------------------------------
    // Write output atomically
    // -----------------------------------------------------------------------
    atomicWrite(OUTPUT_PATH, allUrls);
    console.log(`✅ Saved → ${OUTPUT_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
