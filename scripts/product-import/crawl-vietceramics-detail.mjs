/**
 * crawl-vietceramics-detail.mjs — LEO-387 Phase 2
 *
 * Reads gach-product-urls.json → fetches each product page →
 * parses all specs, images, description → writes gach-enriched.json
 *
 * Usage:
 *   node scripts/product-import/crawl-vietceramics-detail.mjs
 *   node scripts/product-import/crawl-vietceramics-detail.mjs --limit 5
 *   node scripts/product-import/crawl-vietceramics-detail.mjs --resume
 *   node scripts/product-import/crawl-vietceramics-detail.mjs --dry-run
 *
 * Output: scripts/product-import/gach-enriched.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const RESUME = args.includes('--resume')
const LIMIT = (() => {
  const idx = args.indexOf('--limit')
  return idx !== -1 ? parseInt(args[idx + 1]) : null
})()

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vietceramics.com'
const DELAY_MIN_MS = 2500
const DELAY_MAX_MS = 4000
const MAX_RETRIES = 3
const BATCH_SAVE_EVERY = 10

const INPUT_FILE = path.join(__dirname, 'gach-product-urls.json')
const OUTPUT_FILE = path.join(__dirname, 'gach-enriched.json')
const PROGRESS_FILE = path.join(__dirname, 'gach-crawl-progress.json')

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { completed: [] }
  try { return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) } catch { return { completed: [] } }
}

function saveProgress(progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2))
}

function slugify(text) {
  return (text || '')
    .toString().toLowerCase()
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

async function fetchHtml(url, retries = 0) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
    return await res.text()
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.log(`      ⚠️  Retry ${retries + 1}/${MAX_RETRIES}: ${err.message}`)
      await delay(5000 * (retries + 1))
      return fetchHtml(url, retries + 1)
    }
    throw err
  }
}

// ─── HTML PARSING UTILITIES ──────────────────────────────────────────────────

/**
 * Extract text content between two string markers in HTML.
 */
function extractBetween(html, start, end, fromIdx = 0) {
  const si = html.indexOf(start, fromIdx)
  if (si === -1) return null
  const ei = html.indexOf(end, si + start.length)
  if (ei === -1) return null
  return html.substring(si + start.length, ei)
}

/**
 * Strip HTML tags and decode common entities.
 */
function stripTags(str) {
  if (!str) return ''
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Extract all regex matches.
 */
function matchAll(html, regex) {
  const results = []
  let match
  const re = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g')
  while ((match = re.exec(html)) !== null) {
    results.push(match)
  }
  return results
}

// ─── PRODUCT PARSER ──────────────────────────────────────────────────────────

/**
 * Parse a Vietceramics product detail page HTML.
 *
 * Vietceramics HTML structure (from browser inspection):
 * - Product name: <h1 class="product-title"> or title tag
 * - SKU: Links like /gach-XXXXXX/ — the selected one is the current page slug
 * - Collection: Link to /san-pham/gach-op-lat/[collection]/
 * - Main image: https://vietceramics.com/media/images/SKU.original.jpg
 * - Specs: "KEY: VALUE" pattern in attribute-item divs
 *   Main specs (before collapseContent):
 *     BỘ SƯU TẬP, SỐ VÂN, QUY CÁCH, KÍCH THƯỚC MÔ PHỎNG, BỀ MẶT,
 *     XUẤT XỨ, CÔNG NGHỆ, ĐỘ CHỐNG TRƯỢT, CHỨNG CHỈ THÂN THIỆN VỚI MÔI TRƯỜNG
 *   Extended specs (in collapseContent):
 *     ĐỘ KHÁC BIỆT MÀU SẮC, ĐƠN VỊ TÍNH, THIẾT KẾ,
 *     VỊ TRÍ ỐP LÁT, KHU VỰC ỐP LÁT, GẠCH CẮT CẠNH
 */
function parseProductPage(html, productEntry) {
  const { productSlug, collection, subcategory, fullUrl } = productEntry

  // --- 1. Product name ---
  // Try <title> tag first: "Gạch 120278ON05B | Vietceramics"
  let name = null
  const titleMatch = html.match(/<title[^>]*>\s*(.*?)\s*<\/title>/i)
  if (titleMatch) {
    name = titleMatch[1]
      .split('|')[0]
      .replace(/\s+/g, ' ')
      .trim()
  }
  // Fallback: h1 with product name
  if (!name) {
    const h1Match = html.match(/<h1[^>]*class="[^"]*product[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
    if (h1Match) name = stripTags(h1Match[1])
  }
  if (!name) name = `Gạch ${productSlug.replace('gach-', '').toUpperCase()}`

  // --- 2. SKU ---
  // Derive from productSlug: "gach-120278on05b" → "120278ON05B"
  const rawSku = productSlug.replace(/^gach-/, '').toUpperCase()
  const sku = `GACH-${rawSku}`

  // --- 3. Collection (brand) ---
  // From productEntry or extract from breadcrumb/links
  let collectionName = collection.toUpperCase().replace(/-/g, ' ')
  // Try to extract formatted collection name from page
  const collectionLinkMatch = html.match(
    new RegExp(`href=['"]/san-pham/gach-op-lat/${collection}/['"][^>]*>([^<]+)<`, 'i')
  )
  if (collectionLinkMatch) {
    const extracted = stripTags(collectionLinkMatch[1]).trim()
    if (extracted) collectionName = extracted.toUpperCase()
  }

  // --- 4. Specs parsing ---
  // Vietceramics HTML structure (confirmed via browser inspection):
  //   <div class="product-attributes">
  //     <div>BỘ SƯU TẬP: <a class="attribute">ONYCE</a></div>
  //     <div>SỐ VÂN: 1</div>
  //     <div>QUY CÁCH: 120x278cm</div>
  //     ...
  //     <div id="collapseContent" class="collapse">  <!-- hidden section -->
  //       <div>ĐƠN VỊ TÍNH: m2</div>
  //       <div>THIẾT KẾ: GẠCH VÂN ĐÁ MARBLE</div>
  //     </div>
  //   </div>
  const specs = {}

  // Strategy 1: Extract product-attributes container (includes collapseContent)
  // Find the entire product-attributes section
  const attrSection = extractBetween(html, 'product-attributes', 'lien-he-vietceramics') ||
                      extractBetween(html, 'product-attributes', 'btn-wishes') ||
                      extractBetween(html, 'product-attributes', 'product-description') ||
                      html

  // Parse each <div>LABEL: VALUE</div> pattern within the attributes section
  // Matches: plain text OR text + anchor tag
  // e.g.: <div>QUY CÁCH: 120x278cm</div>
  // e.g.: <div>BỘ SƯU TẬP: <a class="attribute" href="...">ONYCE</a></div>
  const divContentRegex = /<div[^>]*>\s*([^<:]+?)\s*:\s*(<a[^>]*>([^<]+)<\/a>|([^<\n]+?))\s*<\/div>/gi
  const divMatches = matchAll(attrSection, divContentRegex)

  for (const m of divMatches) {
    const rawKey = stripTags(m[1]).trim().toUpperCase().replace(/\s+/g, ' ')
    // Value: either from anchor (m[3]) or plain text (m[4])
    const rawVal = (m[3] || m[4] || '').trim()
    const val = stripTags(rawVal).trim().replace(/\s+/g, ' ')
    if (rawKey && val && rawKey.length < 100 && val.length < 200 && !val.includes('javascript')) {
      specs[rawKey] = val
    }
  }

  // Strategy 2: Parse plain text "LABEL: VALUE" lines from the full HTML
  // Handles cases where the div may have additional wrapper tags or whitespace
  // Extract a focused section from HTML between known markers
  const specSection = extractBetween(html, 'product-attributes', 'lien-he-vietceramics') ||
                      extractBetween(html, 'class="sku', 'btn-wishes') ||
                      html

  // List of all expected spec keys with their canonical names
  const specKeyDefs = [
    { key: 'BỘ SƯU TẬP' },
    { key: 'SỐ VÂN' },
    { key: 'QUY CÁCH' },
    { key: 'KÍCH THƯỚC MÔ PHỎNG' },
    { key: 'BỀ MẶT' },
    { key: 'XUẤT XỨ' },
    { key: 'CÔNG NGHỆ' },
    { key: 'ĐỘ CHỐNG TRƯỢT' },
    { key: 'CHỨNG CHỈ THÂN THIỆN VỚI MÔI TRƯỜNG' },
    { key: 'ĐỘ KHÁC BIỆT MÀU SẮC' },
    { key: 'ĐƠN VỊ TÍNH' },
    { key: 'THIẾT KẾ' },
    { key: 'VỊ TRÍ ỐP LÁT' },
    { key: 'KHU VỰC ỐP LÁT' },
    { key: 'GẠCH CẮT CẠNH' },
    { key: 'MÀU SẮC' },
  ]

  // For keys not yet found, try a more flexible regex approach
  for (const { key } of specKeyDefs) {
    if (specs[key]) continue
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match: KEY followed by optional whitespace/tags then colon then value
    const patterns = [
      // Direct text: KEY: VALUE (stops at newline or next tag)
      new RegExp(escapedKey + '\\s*:\\s*([^<\\n]{1,150})', 'i'),
      // With anchor: KEY: <a...>VALUE</a>
      new RegExp(escapedKey + '[^<]*<a[^>]*>([^<]+)<\/a>', 'i'),
    ]
    for (const pat of patterns) {
      const m = specSection.match(pat)
      if (m) {
        const val = stripTags(m[1]).trim().replace(/\s+/g, ' ')
        if (val && val.length > 0 && val.length < 150 && !val.includes('javascript') && !val.includes('function')) {
          specs[key] = val
          break
        }
      }
    }
  }

  // Fallback for KÍCH THƯỚC (size display from SKU pattern)
  if (!specs['QUY CÁCH'] && !specs['KÍCH THƯỚC']) {
    const sizeMatch = specSection.match(/KÍCH\s*THƯỚC[^:]*:\s*([\d]+\s*[xX]\s*[\d]+\s*(?:cm)?)/i)
    if (sizeMatch) specs['KÍCH THƯỚC'] = sizeMatch[1].trim()
  }

  // --- 5. Parse size from QUY CÁCH or product name ---
  // "QUY CÁCH" contains values like "120x278", "60x120", "36x36"
  let sizeW = null, sizeH = null, sizeUnit = 'cm'
  const quyCach = specs['QUY CÁCH'] || specs['QUY CACH'] || ''
  if (quyCach) {
    const sizeMatch = quyCach.match(/(\d+)\s*[xX×]\s*(\d+)/)
    if (sizeMatch) {
      sizeW = parseInt(sizeMatch[1])
      sizeH = parseInt(sizeMatch[2])
    }
  }
  // Also try from product name/slug: "120278" → 120x278
  if (!sizeW) {
    const slugSizeMatch = rawSku.match(/^(\d{2,3})(\d{3})/)
    if (slugSizeMatch) {
      sizeW = parseInt(slugSizeMatch[1])
      sizeH = parseInt(slugSizeMatch[2])
    }
  }

  // --- 6. Images ---
  // Main image pattern: /media/images/RAWSKU.original.jpg
  // Gallery pattern: /media/images/COLLECTION_RAWSKU.original.jpg
  const images = []

  // Extract all image URLs from HTML
  const imgRegex = /src=['"](https?:\/\/vietceramics\.com\/media\/[^'"]+\.(jpg|jpeg|png|webp))['"]/gi
  const imgMatches = matchAll(html, imgRegex)
  const seenUrls = new Set()

  for (const m of imgMatches) {
    const imgUrl = m[1]
    if (!seenUrls.has(imgUrl)) {
      seenUrls.add(imgUrl)
      // Determine image type
      const isOriginal = imgUrl.includes('.original.')
      const isHover = imgUrl.includes('hover') || imgUrl.includes('phoi-canh') || imgUrl.includes('context')
      images.push({
        url: imgUrl,
        type: isOriginal ? 'main' : (isHover ? 'context' : 'gallery'),
        sort_order: images.length,
      })
    }
  }

  // Construct expected main image URL if not found
  if (!images.some(i => i.type === 'main')) {
    const expectedMainUrl = `${BASE_URL}/media/images/${rawSku}.original.jpg`
    images.unshift({
      url: expectedMainUrl,
      type: 'main',
      sort_order: 0,
    })
  }

  // --- 7. Description ---
  // Look for the collection description paragraph
  let description = null
  // Try to find paragraphs in product-description div
  const descPatterns = [
    /<div[^>]*class="[^"]*product-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*description[^"]*"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/i,
    // The description appears as a standalone paragraph block in the page
  ]

  for (const pattern of descPatterns) {
    const m = html.match(pattern)
    if (m) {
      const text = stripTags(m[1]).trim()
      if (text.length > 50) {
        description = text
        break
      }
    }
  }

  // Fallback: extract largest paragraph block from main content
  if (!description) {
    const paragraphs = matchAll(html, /<p[^>]*>([\s\S]{50,500}?)<\/p>/i)
    for (const m of paragraphs) {
      const text = stripTags(m[1]).trim()
      // Filter out nav/header text
      if (text.length > 80 && !text.includes('javascript') && !text.includes('http')) {
        description = text
        break
      }
    }
  }

  // --- 8. Build structured specs object ---
  const structuredSpecs = {
    bo_suu_tap: specs['BỘ SƯU TẬP'] || collectionName,
    so_van: specs['SỐ VÂN'] || null,
    quy_cach: specs['QUY CÁCH'] || specs['QUY CACH'] || null,
    kich_thuoc_mo_phong: specs['KÍCH THƯỚC MÔ PHỎNG'] || specs['KICH THUOC MO PHONG'] || null,
    be_mat: specs['BỀ MẶT'] || specs['BE MAT'] || null,
    xuat_xu: specs['XUẤT XỨ'] || specs['XUAT XU'] || null,
    cong_nghe: specs['CÔNG NGHỆ'] || specs['CONG NGHE'] || null,
    do_chong_truot: specs['ĐỘ CHỐNG TRƯỢT'] || specs['DO CHONG TRUOT'] || null,
    chung_chi_moi_truong: specs['CHỨNG CHỈ THÂN THIỆN VỚI MÔI TRƯỜNG'] || null,
    do_khac_biet_mau_sac: specs['ĐỘ KHÁC BIỆT MÀU SẮC'] || specs['DO KHAC BIET MAU SAC'] || null,
    don_vi_tinh: specs['ĐƠN VỊ TÍNH'] || specs['DON VI TINH'] || 'm2',
    thiet_ke: specs['THIẾT KẾ'] || specs['THIET KE'] || null,
    vi_tri_op_lat: specs['VỊ TRÍ ỐP LÁT'] || specs['VI TRI OP LAT'] || null,
    khu_vuc_op_lat: specs['KHU VỰC ỐP LÁT'] || specs['KHU VUC OP LAT'] || null,
    gach_cat_canh: specs['GẠCH CẮT CẠNH'] || specs['GACH CAT CANH'] || null,
  }

  // Remove null values
  Object.keys(structuredSpecs).forEach(k => {
    if (structuredSpecs[k] === null) delete structuredSpecs[k]
  })

  // --- 9. Generate slug ---
  const productSlugClean = slugify(name || sku)

  return {
    // Identity
    sku,
    rawSku,
    name,
    slug: productSlugClean,
    sourceUrl: fullUrl,

    // Classification
    collection: collection,
    collectionName,
    subcategory,

    // Pricing (PM decision: all "Liên hệ")
    price: 0,
    price_display: 'Liên hệ báo giá',

    // Size
    size_w: sizeW,
    size_h: sizeH,
    size_unit: sizeUnit,

    // Specs
    specs: structuredSpecs,

    // Images
    images,
    imageMain: images.find(i => i.type === 'main')?.url || null,

    // Description
    description,

    // Flags
    is_active: true,
    is_new: true,
    is_bestseller: false,
    is_featured: false,
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧱 LEO-387 Phase 2: Crawl Vietceramics Product Details`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE'}${RESUME ? ' + RESUME' : ''}${LIMIT ? ` + LIMIT ${LIMIT}` : ''}`)
  console.log('─'.repeat(60))

  // Load product URL list
  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`)
    console.error('   Run Phase 1 first: node crawl-vietceramics-listing.mjs')
    process.exit(1)
  }

  const { products: allProducts } = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'))
  console.log(`📋 Input: ${allProducts.length} products`)

  // Load progress for resume
  const progress = loadProgress()
  const completedUrls = new Set(progress.completed || [])

  if (RESUME && completedUrls.size > 0) {
    console.log(`🔄 Resume: ${completedUrls.size} already done`)
  }

  // Load existing enriched data for resume
  let enriched = []
  if (RESUME && existsSync(OUTPUT_FILE)) {
    enriched = JSON.parse(readFileSync(OUTPUT_FILE, 'utf-8'))
    console.log(`💾 Loaded ${enriched.length} existing enriched records`)
  }

  // Filter products to process
  let toProcess = allProducts.filter(p => !completedUrls.has(p.fullUrl))
  if (LIMIT) toProcess = toProcess.slice(0, LIMIT)

  console.log(`\n🚀 Processing ${toProcess.length} products...`)
  console.log('─'.repeat(60))

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < toProcess.length; i++) {
    const product = toProcess[i]
    const pct = Math.round(((i + 1) / toProcess.length) * 100)
    console.log(`\n[${i + 1}/${toProcess.length}] (${pct}%) ${product.productSlug}`)
    console.log(`   Collection: ${product.collection} | Subcategory: ${product.subcategory}`)

    if (DRY_RUN) {
      console.log(`   🔍 Would fetch: ${product.fullUrl}`)
      successCount++
      continue
    }

    try {
      const html = await fetchHtml(product.fullUrl)
      const parsed = parseProductPage(html, product)

      // Validate essential fields
      if (!parsed.name) {
        console.log(`   ⚠️  Warning: No product name found`)
      }

      console.log(`   ✅ Name: ${parsed.name}`)
      console.log(`   📦 SKU: ${parsed.sku}`)
      if (parsed.specs.quy_cach) {
        console.log(`   📐 Kích thước: ${parsed.specs.quy_cach}`)
      }
      if (parsed.specs.be_mat) {
        console.log(`   🪨 Bề mặt: ${parsed.specs.be_mat}`)
      }
      console.log(`   🖼️  Images: ${parsed.images.length}`)

      enriched.push(parsed)
      completedUrls.add(product.fullUrl)
      successCount++

      // Batch save every N products
      if (successCount % BATCH_SAVE_EVERY === 0) {
        writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2))
        saveProgress({ completed: [...completedUrls], lastSaved: new Date().toISOString() })
        console.log(`\n💾 Batch saved: ${enriched.length} products`)
      }

    } catch (err) {
      errorCount++
      errors.push({ url: product.fullUrl, error: err.message })
      console.log(`   ❌ Error: ${err.message}`)
    }

    // Polite delay between requests
    if (i < toProcess.length - 1) {
      const ms = randomDelay()
      await delay(ms)
    }
  }

  // Final save
  if (!DRY_RUN) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(enriched, null, 2))
    saveProgress({ completed: [...completedUrls], lastSaved: new Date().toISOString(), done: true })
    console.log(`\n💾 Final save: ${OUTPUT_FILE}`)
  }

  // Summary
  console.log('\n' + '─'.repeat(60))
  console.log('📊 Summary:')
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Errors: ${errorCount}`)
  console.log(`   💾 Total enriched: ${enriched.length}`)

  if (errors.length > 0) {
    console.log('\n❌ Failed URLs:')
    errors.forEach(e => console.log(`   - ${e.url}: ${e.error}`))
  }

  // Breakdown by subcategory
  const bySubcat = {}
  for (const p of enriched) {
    bySubcat[p.subcategory] = (bySubcat[p.subcategory] || 0) + 1
  }
  console.log('\n📂 By subcategory:')
  for (const [sub, count] of Object.entries(bySubcat)) {
    console.log(`   ${sub}: ${count}`)
  }

  console.log('\n✅ Phase 2 complete!')
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
