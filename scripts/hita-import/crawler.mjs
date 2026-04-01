/**
 * Hita.com.vn Crawler — LEO-321
 *
 * Strategy:
 *   1. Fetch category sitemap (pages 1–2) to get all ~940 category URLs
 *   2. Filter for TBVS / BEP / NUOC — exclude Dien, Gach, San Go
 *   3. Fetch each category page, parse JSON-LD ItemList (20 products/page)
 *   4. Deduplicate by SKU (products appear on multiple category pages)
 *   5. Assign product_type from category URL slug
 *   6. Output: tbvs-hita.json, bep-hita.json, nuoc-hita.json
 *
 * Usage:
 *   node crawler.mjs              # full crawl
 *   node crawler.mjs --dry-run    # only show category URLs, no fetching
 *   node crawler.mjs --limit 3    # crawl only first 3 categories per type (for testing)
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── CLI ──────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : Infinity; })();
const DELAY_MS = 1500; // 1.5s between requests — polite crawling

// ─── Category Classification ─────────────────────────────────────────────────
// Each entry: slug keyword → { dpgType, dpgCategory }
// dpgType: name of product_type in DPG schema
// dpgCategory: which table to import into

const TBVS_KEYWORDS = [
  'bon-cau', 'lavabo', 'chau-rua-mat', 'chau-rua', 'voi-chau',
  'voi-sen', 'sen-tam', 'sen-cay', 'bo-sen',
  'bon-tam', 'bon-tieu', 'nap-bon-cau', 'nap-rua', 'nap-ve-sinh',
  'voi-xit', 'voi-nuoc', 'thiet-bi-ve-sinh', 'phu-kien-phong-tam',
  'moc-treo', 'ke-xa-phong', 'vong-khan', 'mang-khan', 'gương-phong',
  'guong-phong', 'hop-giay', 'ke-kinh', 'ke-de', 'xo-giat',
  'pheu-thoat', 'be-ngoi', 'ket-nuoc', 'nap-ket'
];

const BEP_KEYWORDS = [
  'bep-gas', 'bep-tu', 'bep-dien', 'bep-dien-tu',
  'may-hut-mui', 'may-hut-khoi', 'chau-rua-chen',
  'voi-rua-chen', 'voi-bep', 'may-rua-chen', 'lo-nuong',
  'thiet-bi-bep'
];

const NUOC_KEYWORDS = [
  'may-bom-nuoc', 'bom-nuoc', 'may-bom', 'bom-tang-ap',
  'may-loc-nuoc', 'loc-nuoc', 'loi-loc', 'may-nuoc-nong',
  'binh-nong-lanh', 'bon-chua-nuoc', 'bong-chua'
];

// Keywords that indicate OUT-OF-SCOPE categories — skip these
const EXCLUDE_KEYWORDS = [
  'den-', '-den-', '/den', 'den-led', 'den-pha', 'den-downlight', 'den-track',
  'dieu-khien', 'cong-tac', 'o-cam', 'dien-dan-dung', 'dien-gia-dung',
  'cap-dien', 'day-dien', 'day-va-cap', 'tu-dien', 'aptomat',
  'quat-', 'nang-luong', 'solar', 'nanoco', 'cadivi',
  'gach-op', 'san-go', 'san-vinyl',
  'may-lanh', 'dieu-hoa', 'refrigerator', 'tu-lanh',
  'may-giat', 'may-say',
];

function classifyCategory(url) {
  const slug = url.toLowerCase();

  // Check exclusions first
  for (const kw of EXCLUDE_KEYWORDS) {
    if (slug.includes(kw)) return null;
  }

  // Check BEP keywords (check before TBVS since some overlap like "voi-bep")
  for (const kw of BEP_KEYWORDS) {
    if (slug.includes(kw)) return 'bep';
  }

  // Check TBVS keywords
  for (const kw of TBVS_KEYWORDS) {
    if (slug.includes(kw)) return 'tbvs';
  }

  // Check NUOC keywords
  for (const kw of NUOC_KEYWORDS) {
    if (slug.includes(kw)) return 'nuoc';
  }

  return null; // unknown / skip
}

// Infer DPG product_type name from category URL
function inferProductType(url, dpgCategory) {
  const slug = url.toLowerCase();

  if (dpgCategory === 'tbvs') {
    if (slug.includes('bon-cau')) return { name: 'Bồn Cầu', slug: 'bon-cau' };
    if (slug.includes('lavabo') || slug.includes('chau-rua-mat')) return { name: 'Chậu Lavabo', slug: 'lavabo' };
    if (slug.includes('bon-tam')) return { name: 'Bồn Tắm', slug: 'bon-tam' };
    if (slug.includes('bon-tieu')) return { name: 'Bồn Tiểu', slug: 'bon-tieu' };
    if (slug.includes('sen-tam') || slug.includes('sen-cay') || slug.includes('bo-sen')) return { name: 'Sen Tắm', slug: 'sen-tam' };
    if (slug.includes('voi-sen')) return { name: 'Sen Tắm', slug: 'sen-tam' };
    if (slug.includes('voi-chau') || slug.includes('voi-lavabo')) return { name: 'Vòi Chậu', slug: 'voi-chau' };
    if (slug.includes('nap-bon') || slug.includes('nap-rua') || slug.includes('nap-ve-sinh')) return { name: 'Nắp Bồn Cầu', slug: 'nap-bon-cau' };
    if (slug.includes('voi-nuoc') || slug.includes('voi-xit')) return { name: 'Vòi Nước', slug: 'voi-nuoc' };
    return { name: 'Phụ Kiện Phòng Tắm', slug: 'phu-kien-phong-tam' };
  }

  if (dpgCategory === 'bep') {
    if (slug.includes('bep-gas')) return { name: 'Bếp Gas', slug: 'bep-gas' };
    if (slug.includes('bep-tu') || slug.includes('bep-dien')) return { name: 'Bếp Điện Từ', slug: 'bep-dien-tu' };
    if (slug.includes('may-hut-mui') || slug.includes('may-hut-khoi')) return { name: 'Máy Hút Mùi', slug: 'may-hut-mui' };
    if (slug.includes('chau-rua-chen')) return { name: 'Chậu Rửa Chén', slug: 'chau-rua-chen' };
    if (slug.includes('voi-rua-chen') || slug.includes('voi-bep')) return { name: 'Vòi Rửa Chén', slug: 'voi-rua-chen' };
    if (slug.includes('may-rua-chen')) return { name: 'Máy Rửa Chén', slug: 'may-rua-chen' };
    if (slug.includes('lo-nuong')) return { name: 'Lò Nướng', slug: 'lo-nuong' };
    return { name: 'Thiết Bị Bếp Khác', slug: 'thiet-bi-bep-khac' };
  }

  if (dpgCategory === 'nuoc') {
    if (slug.includes('may-bom') || slug.includes('bom-nuoc')) return { name: 'Máy Bơm Nước', slug: 'may-bom-nuoc' };
    if (slug.includes('loc-nuoc') || slug.includes('may-loc')) return { name: 'Lọc Nước', slug: 'loc-nuoc' };
    if (slug.includes('may-nuoc-nong') || slug.includes('binh-nong')) return { name: 'Máy Nước Nóng', slug: 'may-nuoc-nong' };
    if (slug.includes('bon-chua')) return { name: 'Bồn Chứa Nước', slug: 'bon-chua-nuoc' };
    return { name: 'Thiết Bị Nước Khác', slug: 'thiet-bi-nuoc-khac' };
  }

  return { name: 'Khác', slug: 'khac' };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DPG-research-bot/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'vi,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.text();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  ⚠️ Retry ${attempt + 1} for ${url}: ${err.message}`);
      await sleep(3000);
    }
  }
}

function extractJsonLd(html) {
  const results = [];
  const regex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      results.push(parsed);
    } catch { /* ignore invalid JSON */ }
  }
  return results;
}

function extractItemList(jsonLdBlocks) {
  for (const block of jsonLdBlocks) {
    if (block['@type'] === 'ItemList' && block.itemListElement) {
      return block.itemListElement
        .map(el => el.item || el)
        .filter(item => item && item['@type'] === 'Product');
    }
  }
  return [];
}

// ─── Fetch category sitemap ───────────────────────────────────────────────────
async function fetchCategoryUrls() {
  const urls = new Set();

  for (const page of [1, 2]) {
    console.log(`📋 Fetching category sitemap page ${page}...`);
    try {
      const xml = await fetchWithRetry(`https://hita.com.vn/category-sitemap.xml?page=${page}`);
      const locMatches = xml.matchAll(/<loc>(https?:\/\/hita\.com\.vn\/[^<]+\.html)<\/loc>/g);
      for (const m of locMatches) urls.add(m[1]);
      await sleep(DELAY_MS);
    } catch (err) {
      console.warn(`  ⚠️ Failed to fetch sitemap page ${page}: ${err.message}`);
    }
  }

  console.log(`📋 Total category URLs found: ${urls.size}`);
  return [...urls];
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Hita Crawler — LEO-321');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'FULL CRAWL'}`);
  if (LIMIT < Infinity) console.log(`   Limit: ${LIMIT} categories/type`);
  console.log('');

  // Step 1: Get all category URLs
  const allCategoryUrls = await fetchCategoryUrls();

  // Step 2: Classify categories
  const classified = { tbvs: [], bep: [], nuoc: [], skip: [] };
  for (const url of allCategoryUrls) {
    const type = classifyCategory(url);
    if (type) classified[type].push(url);
    else classified.skip.push(url);
  }

  console.log(`\n📊 Category classification:`);
  console.log(`  TBVS:    ${classified.tbvs.length} categories`);
  console.log(`  BEP:     ${classified.bep.length} categories`);
  console.log(`  NUOC:    ${classified.nuoc.length} categories`);
  console.log(`  Skipped: ${classified.skip.length} categories (Điện, Gạch, etc.)\n`);

  if (DRY_RUN) {
    console.log('--- TBVS sample (first 10):');
    classified.tbvs.slice(0, 10).forEach(u => console.log(' ', u));
    console.log('--- BEP sample:');
    classified.bep.slice(0, 10).forEach(u => console.log(' ', u));
    console.log('--- NUOC:');
    classified.nuoc.forEach(u => console.log(' ', u));
    console.log('--- SKIP sample (first 10):');
    classified.skip.slice(0, 10).forEach(u => console.log(' ', u));
    return;
  }

  // Step 3: Crawl each category and extract products
  const products = { tbvs: new Map(), bep: new Map(), nuoc: new Map() };
  const stats = { tbvs: { fetched: 0, products: 0 }, bep: { fetched: 0, products: 0 }, nuoc: { fetched: 0, products: 0 } };

  for (const dpgCategory of ['tbvs', 'bep', 'nuoc']) {
    const categoryUrls = classified[dpgCategory].slice(0, LIMIT);
    console.log(`\n🔍 Crawling ${dpgCategory.toUpperCase()} (${categoryUrls.length} categories)...`);

    for (let i = 0; i < categoryUrls.length; i++) {
      const catUrl = categoryUrls[i];
      const productType = inferProductType(catUrl, dpgCategory);
      process.stdout.write(`  [${i + 1}/${categoryUrls.length}] ${catUrl.split('/').pop()} → ${productType.name} `);

      try {
        const html = await fetchWithRetry(catUrl);
        const jsonLdBlocks = extractJsonLd(html);
        const items = extractItemList(jsonLdBlocks);

        let newCount = 0;
        for (const item of items) {
          const sku = item.sku || item.mpn?.toString();
          if (!sku) continue;

          // Skip if already seen (from another category page)
          if (products[dpgCategory].has(sku)) continue;

          const availability = item.offers?.availability || '';
          const isInStock = availability.includes('InStock') || availability === '';

          products[dpgCategory].set(sku, {
            sku,
            name: item.name || '',
            description: item.description || '',
            image_main_url: item.image || '',
            source_url: item.url || catUrl,
            brand: item.brand?.name || '',
            price: item.offers?.price || null,
            stock_status: isInStock ? 'in_stock' : 'out_of_stock',
            product_type_name: productType.name,
            product_type_slug: productType.slug,
            hita_category_url: catUrl,
            hita_product_id: item.mpn || null,
          });
          newCount++;
        }

        stats[dpgCategory].fetched++;
        stats[dpgCategory].products += newCount;
        console.log(`→ ${items.length} items, ${newCount} new`);
      } catch (err) {
        console.log(`→ ❌ ERROR: ${err.message}`);
      }

      await sleep(DELAY_MS);
    }
  }

  // Step 4: Save outputs
  console.log('\n💾 Saving output files...');
  const outputDir = __dirname;

  for (const [type, productMap] of Object.entries(products)) {
    const arr = [...productMap.values()];
    const outPath = path.join(outputDir, `${type}-hita.json`);
    writeFileSync(outPath, JSON.stringify(arr, null, 2), 'utf-8');
    console.log(`  ✅ ${type}-hita.json — ${arr.length} products`);
  }

  // Summary
  console.log('\n📈 Crawl Summary:');
  for (const [type, s] of Object.entries(stats)) {
    const count = products[type].size;
    console.log(`  ${type.toUpperCase()}: ${s.fetched} categories crawled → ${count} unique products`);
  }
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
