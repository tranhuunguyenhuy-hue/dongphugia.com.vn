/**
 * crawl-enrich.mjs — Enhanced Product Crawler (LEO-370 Phase 4A)
 *
 * Scrapes source_url of each product from HITA website to extract:
 *   - specs (thông số kỹ thuật) → specs JSONB
 *   - description (chi tiết sản phẩm) → HTML
 *   - gallery images → product_images[]
 *   - documents (PDF, CAD) → specs.documents[]
 *   - warranty, origin, color, material → mapped fields
 *
 * Usage:
 *   node crawl-enrich.mjs                     # crawl all categories (TBVS → BEP → NUOC)
 *   node crawl-enrich.mjs --category tbvs     # single category
 *   node crawl-enrich.mjs --limit 10          # test run first 10 products
 *   node crawl-enrich.mjs --resume            # skip already-crawled SKUs
 *
 * Config (PM decisions):
 *   - Rate: 2000-3500ms delay (random) between requests
 *   - Priority: TBVS → BEP → NUOC
 *   - Images: full size (no resize)
 *
 * Output:
 *   scripts/product-import/tbvs-enriched.json
 *   scripts/product-import/bep-enriched.json
 *   scripts/product-import/nuoc-enriched.json
 *   scripts/product-import/crawl-progress.json   ← resume support
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const LIMIT = (() => {
  const idx = args.indexOf('--limit')
  return idx !== -1 ? parseInt(args[idx + 1]) : null
})()
const CATEGORY_FILTER = (() => {
  const idx = args.indexOf('--category')
  return idx !== -1 ? args[idx + 1]?.toLowerCase() : null
})()
const RESUME = args.includes('--resume')

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const DELAY_MIN_MS = 2000   // PM decision: slower crawl rate
const DELAY_MAX_MS = 3500
const MAX_RETRIES = 3
const RETRY_DELAY_MS = 5000

// Brand skip list (same as import-v2.mjs)
const SKIP_BRAND_PATTERNS = ['HITA', 'ĐẠI LÝ', 'DEALER']

function shouldSkipBrand(brand) {
  if (!brand || !brand.trim()) return true
  const upper = brand.toUpperCase().trim()
  return SKIP_BRAND_PATTERNS.some(p => upper.includes(p.toUpperCase()))
}

// ─── CATEGORY CONFIGS ────────────────────────────────────────────────────────
const CATEGORY_CONFIGS = {
  tbvs: {
    input: path.join(__dirname, 'tbvs-raw.json'),
    output: path.join(__dirname, 'tbvs-enriched.json'),
  },
  bep: {
    input: path.join(__dirname, 'bep-raw.json'),
    output: path.join(__dirname, 'bep-enriched.json'),
  },
  nuoc: {
    input: path.join(__dirname, 'nuoc-raw.json'),
    output: path.join(__dirname, 'nuoc-enriched.json'),
  },
}

const PROGRESS_FILE = path.join(__dirname, 'crawl-progress.json')

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return {}
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'))
  } catch {
    return {}
  }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

// Parse warranty string → months: "24 tháng" → 24
function parseWarrantyMonths(str) {
  if (!str) return null
  const m = str.match(/(\d+)\s*tháng/i)
  if (m) return parseInt(m[1])
  const y = str.match(/(\d+)\s*năm/i)
  if (y) return parseInt(y[1]) * 12
  return null
}

// ─── HTML PARSER USING REGEX + STRING MANIPULATION ───────────────────────────
// Using built-in approach (no cheerio dependency) with regex parsing of HTML
// For production: npm install cheerio and use proper DOM parsing

function extractBetween(html, startTag, endTag) {
  const start = html.indexOf(startTag)
  if (start === -1) return null
  const end = html.indexOf(endTag, start + startTag.length)
  if (end === -1) return null
  return html.substring(start + startTag.length, end).trim()
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// Extract product specs from table inside #box-specification
function parseSpecs(html) {
  const specs = {}
  // Find #box-specification section
  const specStart = html.indexOf('id="box-specification"')
  if (specStart === -1) return specs
  // Find the <table class="specification"> inside it
  const tableStart = html.indexOf('<table', specStart)
  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableStart === -1 || tableEnd === -1) return specs
  const tableHtml = html.substring(tableStart, tableEnd + 8)
  // Extract <tr><td>key</td><td>value</td></tr> pairs
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
  let match
  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const key = stripTags(match[1]).trim()
    const value = stripTags(match[2]).trim()
    if (key && value) {
      specs[key] = value
    }
  }
  return specs
}

// Extract gallery image URLs from product-slider section
function parseGalleryImages(html) {
  const images = []
  // Find product-slider section in body (match exact class attribute)
  const sliderStart = html.indexOf('product-slider"')
  if (sliderStart === -1) return images
  const sliderSection = html.substring(sliderStart, sliderStart + 8000)
  // Find all img src pointing to CDN
  const srcRegex = /src="(https?:\/\/(?:cdn\.hita\.com\.vn|hita\.com\.vn)\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
  let match
  while ((match = srcRegex.exec(sliderSection)) !== null) {
    const url = match[1].trim()
    if (!images.includes(url)) {
      images.push(url)
    }
  }
  return images
}

// Extract product detail description HTML (chi tiết sản phẩm)
function parseDescription(html) {
  // Find #box-product-description section
  const boxStart = html.indexOf('id="box-product-description"')
  if (boxStart === -1) return null
  // Find description-column content
  const contentStart = html.indexOf('class="description-column-left', boxStart)
  if (contentStart === -1) return null
  const contentDivStart = html.indexOf('>', contentStart) + 1
  // Find matching closing div — count nesting depth
  let depth = 1, pos = contentDivStart
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos)
    const nextClose = html.indexOf('</div>', pos)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      pos = nextOpen + 4
    } else {
      depth--
      pos = nextClose + 6
    }
  }
  let detail = html.substring(contentDivStart, pos - 6).trim()
  if (!detail) return null
  // Clean HITA-specific marketing text
  detail = detail
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/(?:Đến xem tại|tại showroom HITA|Xem đường đi|tư vấn miễn phí|đại lý cấp 1 HITA)[^<]*/gi, '')
    .trim()
  return detail || null
}

// Extract document download links (PDF, CAD, DWG) from package-attachments
function parseDocuments(html) {
  const docs = []
  // Find package-attachments section inside #box-product-description
  const boxStart = html.indexOf('id="box-product-description"')
  if (boxStart === -1) return docs
  const attachStart = html.indexOf('data-target="package-attachments"', boxStart) ||
                      html.indexOf('class="package-attachments"', boxStart)
  if (!attachStart || attachStart === -1) return docs
  const attachSection = html.substring(attachStart, attachStart + 3000)
  const linkRegex = /<a[^>]+href="([^"]+\.(?:pdf|dwg|dxf|doc|docx|jpg|png)[^"]*?)"[^>]*>([^<]*)<\/a>/gi
  let match
  while ((match = linkRegex.exec(attachSection)) !== null) {
    const url = match[1].trim()
    const name = stripTags(match[2]).trim()
    if (url && (url.includes('cdn.hita') || url.includes('hita.com.vn'))) {
      docs.push({ url, name: name || 'Tài liệu' })
    }
  }
  return docs
}

// ─── FETCH WITH RETRY ─────────────────────────────────────────────────────────
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'no-cache',
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })

      if (response.status === 404) {
        return { status: 404, html: null }
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      return { status: response.status, html }
    } catch (e) {
      if (attempt === retries) {
        return { status: 0, html: null, error: e.message }
      }
      console.log(`    Retry ${attempt}/${retries} for ${url}: ${e.message}`)
      await sleep(RETRY_DELAY_MS * attempt)
    }
  }
}

// ─── ENRICH SINGLE PRODUCT ───────────────────────────────────────────────────
async function enrichProduct(product) {
  if (!product.source_url) {
    return { ...product, crawl_status: 'no_url' }
  }

  const { status, html, error } = await fetchWithRetry(product.source_url)

  if (!html) {
    return {
      ...product,
      crawl_status: status === 404 ? 'not_found' : 'failed',
      crawl_error: error || `HTTP ${status}`,
    }
  }

  // Parse all enrichment data
  const specs = parseSpecs(html)
  const galleryImages = parseGalleryImages(html)
  const description = parseDescription(html)
  const documents = parseDocuments(html)

  // Extract specific fields from specs
  const warrantyMonths = parseWarrantyMonths(specs['Bảo hành'] || specs['Bảo Hành'])
  const origin = specs['Nơi sản xuất'] || specs['Xuất xứ'] || null
  const color = specs['Màu sắc'] || specs['Màu Sắc'] || null
  const material = specs['Chất liệu'] || specs['Chất Liệu'] || null
  const dimensions = specs['Kích thước'] || specs['Kích Thước'] || null
  const warrantyText = specs['Bảo hành'] || specs['Bảo Hành'] || null

  return {
    ...product,
    // Enriched fields
    description_html: description,
    gallery_images: galleryImages,
    specs_raw: specs,
    documents,
    // Extracted for DB mapping
    warranty_months: warrantyMonths,
    origin_text: origin,
    color_text: color,
    material_text: material,
    dimensions_text: dimensions,
    warranty_text: warrantyText,
    // Meta
    crawl_status: 'success',
    crawled_at: new Date().toISOString(),
  }
}

// ─── CRAWL CATEGORY ──────────────────────────────────────────────────────────
async function crawlCategory(catKey, config, progress) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`🕷️  Crawling: ${catKey.toUpperCase()}`)
  console.log('='.repeat(60))

  const allProducts = JSON.parse(readFileSync(config.input, 'utf-8'))
  const products = allProducts.filter(p => !shouldSkipBrand(p.brand))

  console.log(`  Total: ${allProducts.length} | After brand filter: ${products.length}`)

  // Apply limit
  const batch = LIMIT ? products.slice(0, LIMIT) : products
  if (LIMIT) console.log(`  ⚠️  --limit ${LIMIT}: processing first ${batch.length}`)

  // Load existing output for resume
  let existing = []
  let existingSKUs = new Set()
  if (RESUME && existsSync(config.output)) {
    try {
      existing = JSON.parse(readFileSync(config.output, 'utf-8'))
      existingSKUs = new Set(existing.map(p => p.sku))
      console.log(`  📂 Resume: ${existing.length} already crawled`)
    } catch {
      console.log(`  ⚠️  Could not read existing output, starting fresh`)
    }
  }

  const results = [...existing]
  let crawled = 0, skipped = 0, failed = 0, notFound = 0

  for (let i = 0; i < batch.length; i++) {
    const product = batch[i]

    // Resume: skip already-crawled SKUs
    if (RESUME && existingSKUs.has(product.sku)) {
      skipped++
      continue
    }

    if (i > 0 && i % 50 === 0) {
      console.log(`  [${i}/${batch.length}] crawled=${crawled} skipped=${skipped} failed=${failed} notFound=${notFound}`)
      // Save progress every 50 products
      writeFileSync(config.output, JSON.stringify(results, null, 2))
      progress[catKey] = { crawled, skipped, failed, notFound, total: batch.length, lastIndex: i }
      saveProgress(progress)
    }

    const enriched = await enrichProduct(product)
    results.push(enriched)

    if (enriched.crawl_status === 'success') {
      crawled++
    } else if (enriched.crawl_status === 'not_found') {
      notFound++
      console.log(`  ⚠️  404: ${product.sku} — ${product.source_url}`)
    } else if (enriched.crawl_status === 'failed') {
      failed++
      console.log(`  ❌ FAIL: ${product.sku} — ${enriched.crawl_error}`)
    } else if (enriched.crawl_status === 'no_url') {
      skipped++
    }

    // Rate limiting (PM decision: 2-3.5s delay)
    if (i < batch.length - 1) {
      await sleep(randomDelay())
    }
  }

  // Final save
  writeFileSync(config.output, JSON.stringify(results, null, 2))
  progress[catKey] = { crawled, skipped, failed, notFound, total: batch.length, completed: true }
  saveProgress(progress)

  console.log(`  [${batch.length}/${batch.length}] done`)
  console.log(`  ✅ Saved to ${path.basename(config.output)}`)

  return { crawled, skipped, failed, notFound, total: batch.length }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🕷️  Product Enrichment Crawler — LEO-370 Phase 4A')
  console.log(`   Rate: ${DELAY_MIN_MS}-${DELAY_MAX_MS}ms delay`)
  console.log(`   Mode: ${RESUME ? 'RESUME (skip crawled)' : 'FRESH'}`)
  if (LIMIT) console.log(`   Limit: ${LIMIT} per category`)
  if (CATEGORY_FILTER) console.log(`   Category: ${CATEGORY_FILTER} only`)
  console.log(`   Order: TBVS → BEP → NUOC (PM decision)`)
  console.log(`   Time: ${new Date().toISOString()}\n`)

  const progress = loadProgress()

  // PM decision: TBVS first, then BEP, then NUOC
  const orderedCats = ['tbvs', 'bep', 'nuoc']
  const catsToRun = CATEGORY_FILTER
    ? [CATEGORY_FILTER]
    : orderedCats

  if (CATEGORY_FILTER && !CATEGORY_CONFIGS[CATEGORY_FILTER]) {
    console.error(`❌ Unknown category: "${CATEGORY_FILTER}". Valid: tbvs, bep, nuoc`)
    process.exit(1)
  }

  const results = {}
  for (const catKey of catsToRun) {
    results[catKey] = await crawlCategory(catKey, CATEGORY_CONFIGS[catKey], progress)
  }

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(60))
  console.log('📊 CRAWL SUMMARY')
  console.log('='.repeat(60))

  let totCrawled = 0, totFailed = 0, tot404 = 0, totTotal = 0
  for (const [cat, r] of Object.entries(results)) {
    const label = cat.toUpperCase().padEnd(6)
    console.log(`  ${label}: ${r.crawled} enriched | ${r.notFound} 404 | ${r.failed} errors / ${r.total} total`)
    totCrawled += r.crawled
    totFailed += r.failed
    tot404 += r.notFound
    totTotal += r.total
  }
  console.log('─'.repeat(60))
  console.log(`  TOTAL : ${totCrawled} enriched | ${tot404} 404 | ${totFailed} errors / ${totTotal} total`)
  console.log('='.repeat(60))

  const successRate = totTotal > 0 ? ((totCrawled / totTotal) * 100).toFixed(1) : 0
  console.log(`\n✅ Enrichment complete! Success rate: ${successRate}%`)
  console.log(`📁 Outputs: tbvs-enriched.json, bep-enriched.json, nuoc-enriched.json`)

  if (totFailed > 0) {
    console.log(`\n⚠️  ${totFailed} products failed. Run with --resume to retry.`)
  }
}

main().catch(e => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
