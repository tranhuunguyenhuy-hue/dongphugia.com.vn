/**
 * crawl-toto-pdp.mjs — Crawl full PDP (Product Detail Page) for all TOTO products
 *
 * Reuses parsing patterns from scripts/product-import/crawl-enrich.mjs
 * Adds: 3-tier price parsing, online discount, variant picker, auto-classification
 *
 * Usage:
 *   node scripts/crawl-toto/crawl-toto-pdp.mjs                 # crawl all
 *   node scripts/crawl-toto/crawl-toto-pdp.mjs --resume        # resume from last
 *   node scripts/crawl-toto/crawl-toto-pdp.mjs --limit 20      # test first 20
 *   node scripts/crawl-toto/crawl-toto-pdp.mjs --type bon-cau  # single category
 *
 * Input:  scripts/crawl-toto/output/toto-listing.json
 * Output: scripts/crawl-toto/output/toto-enriched.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  PATHS, fetchWithRetry, sleep, randomDelay, extractHitaId,
  classifyProduct, isValidProductImage,
} from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : null })()
const TYPE_FILTER = (() => { const i = args.indexOf('--type'); return i !== -1 ? args[i + 1] : null })()
const RESUME = args.includes('--resume')

// ─── SKIP NON-TOTO URLS ─────────────────────────────────────────────────────
function isTotoProduct(product) {
  if (!product.url) return false
  // Skip blog posts
  if (/post-\d+\.html$/.test(product.url)) return false
  // Skip navigation/category pages without specific product ID pattern
  if (!product.name && !product.url.includes('toto')) return false
  // Skip known non-TOTO brands in name
  const name = (product.name || '').toLowerCase()
  const nonTotoBrands = ['inax', 'caesar', 'luxta', 'landsign', 'tovashu', 'cleansui', 'unilever']
  if (nonTotoBrands.some(b => name.includes(b)) && !name.includes('toto')) return false
  // Skip generic nav text
  if (/^(bồn cầu|lavabo|vòi|sen|phụ kiện) \w+$/i.test(name) && name.length < 25) return false
  if (/dưới|trên|từ.*triệu/i.test(name)) return false
  return true
}

// ─── HTML HELPERS (reused from crawl-enrich.mjs) ─────────────────────────────
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
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function parsePrice(priceStr) {
  if (!priceStr) return null
  const cleaned = priceStr.replace(/[^\d]/g, '')
  return cleaned ? parseInt(cleaned) : null
}

function parseWarrantyMonths(str) {
  if (!str) return null
  const m = str.match(/(\d+)\s*tháng/i)
  if (m) return parseInt(m[1])
  const y = str.match(/(\d+)\s*năm/i)
  if (y) return parseInt(y[1]) * 12
  return null
}

// ─── PARSERS ─────────────────────────────────────────────────────────────────

/** Parse product name from H1 */
function parseName(html) {
  const h1 = html.match(/<h1[^>]*>([^<]+)</i)
  return h1 ? h1[1].trim() : null
}

/** Parse 3-tier price: original → sale → online discount */
function parsePriceThreeTier(html) {
  // Sale price (current price) — class="product-new-price-land"
  const saleMatch = html.match(/class="product-new-price-land"[^>]*>([^<]+)/i)
  const sale = saleMatch ? parsePrice(saleMatch[1]) : null

  // Original price (crossed out) — class="product-old-price-land"
  const origMatch = html.match(/class="product-old-price-land"[^>]*>([^<]+)/i)
  const original = origMatch ? parsePrice(origMatch[1]) : null

  // Online discount — class="gift-cashback"
  const onlineMatch = html.match(/class="gift-cashback"[^>]*>\s*([^<]+)/i)
  const onlineDiscount = onlineMatch ? parsePrice(onlineMatch[1]) : null

  // "Liên hệ" detection
  const isLienHe = !sale && /liên hệ/i.test(
    html.substring(
      html.indexOf('product-price') || 0,
      (html.indexOf('product-price') || 0) + 2000
    )
  )

  return {
    original_price: original,
    price: sale,
    online_discount_amount: onlineDiscount,
    price_display: isLienHe ? 'Liên hệ báo giá' : (sale ? `${sale.toLocaleString('vi-VN')}đ` : null),
    is_contact_price: isLienHe,
  }
}

/** Parse specs table — from #box-specification */
function parseSpecs(html) {
  const specs = {}
  const specStart = html.indexOf('id="box-specification"')
  if (specStart === -1) return specs
  const tableStart = html.indexOf('<table', specStart)
  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableStart === -1 || tableEnd === -1) return specs
  const tableHtml = html.substring(tableStart, tableEnd + 8)
  const rowRegex = /<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>[\s\S]*?<\/tr>/gi
  let match
  while ((match = rowRegex.exec(tableHtml)) !== null) {
    const key = stripTags(match[1]).trim()
    const value = stripTags(match[2]).trim()
    if (key && value) specs[key] = value
  }
  return specs
}

/** Parse gallery images from product-slider */
function parseGalleryImages(html) {
  const images = []
  const sliderStart = html.indexOf('product-slider"')
  if (sliderStart === -1) return images
  const sliderSection = html.substring(sliderStart, sliderStart + 10000)
  // Match both src and data-src for lazy-loaded images
  const srcRegex = /(?:src|data-src)="(https?:\/\/(?:cdn\.hita\.com\.vn|hita\.com\.vn)\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi
  let match
  while ((match = srcRegex.exec(sliderSection)) !== null) {
    const url = match[1].trim()
    // Skip placeholder images and duplicates
    if (url.includes('original.jpg')) continue
    if (url.includes('placeholder')) continue
    if (url.includes('/icon/')) continue
    if (!images.includes(url)) images.push(url)
  }
  return images
}

/** Parse description HTML — from #box-product-description */
function parseDescription(html) {
  const boxStart = html.indexOf('id="box-product-description"')
  if (boxStart === -1) return null
  const contentStart = html.indexOf('class="description-column-left', boxStart)
  if (contentStart === -1) return null
  const contentDivStart = html.indexOf('>', contentStart) + 1
  let depth = 1, pos = contentDivStart
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos)
    const nextClose = html.indexOf('</div>', pos)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) { depth++; pos = nextOpen + 4 }
    else { depth--; pos = nextClose + 6 }
  }
  let detail = html.substring(contentDivStart, pos - 6).trim()
  if (!detail) return null
  // Clean Hita marketing text
  detail = detail
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/(?:Đến xem tại|tại showroom HITA|Xem đường đi|tư vấn miễn phí|đại lý cấp 1 HITA|Mua hàng online)[^<]*/gi, '')
    .replace(/(?:Hotline|Zalo|zalo|hotline)[^<]*/gi, '')
    .trim()
  return detail || null
}

/** Parse document links (PDF, DWG) */
function parseDocuments(html) {
  const docs = []
  const boxStart = html.indexOf('id="box-product-description"')
  if (boxStart === -1) return docs
  const attachStart = html.indexOf('package-attachments', boxStart)
  if (attachStart === -1) return docs
  const attachSection = html.substring(attachStart, attachStart + 5000)
  const linkRegex = /<a[^>]+href="([^"]+\.(?:pdf|dwg|dxf)[^"]*?)"[^>]*>([^<]*)<\/a>/gi
  let match
  while ((match = linkRegex.exec(attachSection)) !== null) {
    const url = match[1].trim()
    const name = stripTags(match[2]).trim()
    if (url && (url.includes('cdn.hita') || url.includes('hita.com.vn'))) {
      docs.push({
        url,
        name: name || 'Tài liệu',
        type: url.includes('.dwg') || url.includes('.dxf') ? 'cad' : 'pdf',
      })
    }
  }
  return docs
}

/** Parse variant links from variant-slider or box-categories-related */
function parseVariants(html) {
  const variants = []

  // Strategy 1: variant-slider section (bồn cầu combo)
  const variantSliderStart = html.indexOf('class="variant-slider"')
  if (variantSliderStart !== -1) {
    const section = html.substring(variantSliderStart, variantSliderStart + 8000)
    const linkRegex = /href="(https:\/\/hita\.com\.vn\/[^"]+\.html)"/gi
    let match
    while ((match = linkRegex.exec(section)) !== null) {
      const url = match[1]
      if (url === '#') continue
      const hitaId = extractHitaId(url)
      if (hitaId && !variants.some(v => v.hita_id === hitaId)) {
        // Try to get variant name
        const nameCtx = section.substring(match.index, match.index + 500)
        const nameMatch = nameCtx.match(/title="([^"]+)"/i) || nameCtx.match(/>([^<]{10,})</i)
        variants.push({
          url,
          hita_id: hitaId,
          name: nameMatch ? nameMatch[1].trim() : null,
          relationship: 'variant',
        })
      }
    }
  }

  // Strategy 2: box-categories-related (related/combo products)
  const relatedStart = html.indexOf('class="box-categories-related"')
  if (relatedStart !== -1) {
    const section = html.substring(relatedStart, relatedStart + 10000)
    const itemRegex = /class="item-categories-related"[\s\S]*?href="(https:\/\/hita\.com\.vn\/[^"]+\.html)"[\s\S]*?<\/a>/gi
    let match
    while ((match = itemRegex.exec(section)) !== null) {
      const url = match[1]
      const hitaId = extractHitaId(url)
      if (hitaId && !variants.some(v => v.hita_id === hitaId)) {
        const ctx = match[0]
        const nameMatch = ctx.match(/title="([^"]+)"/i)
        const priceMatch = ctx.match(/pbi-price-new"[^>]*>([^<]+)/i)
        variants.push({
          url,
          hita_id: hitaId,
          name: nameMatch ? nameMatch[1].trim() : null,
          price_text: priceMatch ? priceMatch[1].trim() : null,
          relationship: 'related',
        })
      }
    }
  }

  return variants
}

/** Parse product status (in stock, discontinued, etc.) */
function parseStatus(html) {
  const priceZone = html.substring(
    html.indexOf('product-price') || 0,
    (html.indexOf('product-price') || 0) + 3000
  )
  if (/ngừng kinh doanh/i.test(html)) return 'discontinued'
  if (/hết hàng/i.test(priceZone)) return 'out_of_stock'
  return 'active'
}

// ─── ENRICH SINGLE PRODUCT ──────────────────────────────────────────────────
async function enrichProduct(product) {
  const { status, html, error } = await fetchWithRetry(product.url)

  if (!html) {
    return {
      ...product,
      crawl_status: status === 404 ? 'not_found' : 'failed',
      crawl_error: error || `HTTP ${status}`,
    }
  }

  // Parse all data
  const name = parseName(html) || product.name
  const pricing = parsePriceThreeTier(html)
  const specs = parseSpecs(html)
  const galleryImages = parseGalleryImages(html)
  const description = parseDescription(html)
  const documents = parseDocuments(html)
  const variants = parseVariants(html)
  const productStatus = parseStatus(html)

  // Extract fields from specs
  const warrantyMonths = parseWarrantyMonths(specs['Bảo hành'] || specs['Bảo Hành'])
  const origin = specs['Nơi sản xuất'] || specs['Xuất xứ'] || null
  const color = specs['Màu sắc'] || specs['Màu Sắc'] || null
  const material = specs['Chất liệu'] || specs['Chất Liệu'] || null

  // Re-classify with full PDP name (more accurate than listing name)
  const classification = classifyProduct(name, product.category_type)

  return {
    // From listing
    url: product.url,
    hita_id: product.hita_id,
    category_type: product.category_type,
    source_category_url: product.source_category_url,

    // PDP enriched
    name,
    ...pricing,
    specs_raw: specs,
    gallery_images: galleryImages,
    description_html: description,
    documents,
    variants,
    product_status: productStatus,

    // Extracted fields
    warranty_months: warrantyMonths,
    origin_text: origin,
    color_text: color,
    material_text: material,

    // Classification (re-classified with full name)
    category_id: classification.category_id,
    subcategory_id: classification.subcategory_id,
    product_type: classification.product_type,
    product_sub_type: classification.product_sub_type,

    // Meta
    crawl_status: 'success',
    crawled_at: new Date().toISOString(),
  }
}

// ─── PROGRESS MANAGEMENT ─────────────────────────────────────────────────────
function loadProgress() {
  if (!existsSync(PATHS.progress)) return { crawled: [], failed: [] }
  try { return JSON.parse(readFileSync(PATHS.progress, 'utf-8')) }
  catch { return { crawled: [], failed: [] } }
}

function saveProgress(progress) {
  writeFileSync(PATHS.progress, JSON.stringify(progress, null, 2))
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍 TOTO PDP Crawler — Phase 2')
  console.log(`   Time: ${new Date().toISOString()}`)
  console.log(`   Mode: ${RESUME ? 'RESUME' : 'FRESH'}`)
  if (LIMIT) console.log(`   Limit: ${LIMIT}`)
  if (TYPE_FILTER) console.log(`   Filter: ${TYPE_FILTER}`)
  console.log()

  // Load listing
  if (!existsSync(PATHS.listing)) {
    console.error('❌ toto-listing.json not found. Run category-lister.mjs first.')
    process.exit(1)
  }

  let products = JSON.parse(readFileSync(PATHS.listing, 'utf-8'))
  console.log(`📂 Loaded ${products.length} products from listing`)

  // Filter TOTO only
  products = products.filter(isTotoProduct)
  console.log(`   After TOTO filter: ${products.length}`)

  // Type filter
  if (TYPE_FILTER) {
    products = products.filter(p => p.category_type === TYPE_FILTER)
    console.log(`   After type filter (${TYPE_FILTER}): ${products.length}`)
  }

  // Limit
  if (LIMIT) {
    products = products.slice(0, LIMIT)
    console.log(`   After limit: ${products.length}`)
  }

  // Resume support
  const progress = RESUME ? loadProgress() : { crawled: [], failed: [] }
  if (RESUME && progress.crawled.length > 0) {
    const before = products.length
    products = products.filter(p => !progress.crawled.includes(p.hita_id))
    console.log(`   Resume: skipping ${before - products.length} already crawled`)
  }

  console.log(`\n   🚀 Starting crawl of ${products.length} PDPs...\n`)

  // Load existing enriched data (for resume)
  let enriched = []
  if (RESUME && existsSync(PATHS.enriched)) {
    enriched = JSON.parse(readFileSync(PATHS.enriched, 'utf-8'))
  }

  const stats = {
    success: 0, not_found: 0, failed: 0,
    with_price: 0, with_online_discount: 0, with_docs: 0,
    with_variants: 0, with_specs: 0,
    reclassified: 0,
  }

  const startTime = Date.now()

  for (let i = 0; i < products.length; i++) {
    const p = products[i]
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    const eta = i > 0 ? (((Date.now() - startTime) / i * (products.length - i)) / 1000 / 60).toFixed(1) : '?'

    process.stdout.write(
      `  [${i + 1}/${products.length}] ${elapsed}m elapsed, ETA ${eta}m | ${p.hita_id} `
    )

    try {
      const result = await enrichProduct(p)
      enriched.push(result)

      if (result.crawl_status === 'success') {
        stats.success++
        progress.crawled.push(p.hita_id)
        if (result.price) stats.with_price++
        if (result.online_discount_amount) stats.with_online_discount++
        if (result.documents.length > 0) stats.with_docs++
        if (result.variants.length > 0) stats.with_variants++
        if (Object.keys(result.specs_raw).length > 0) stats.with_specs++
        if (result.product_type !== p.product_type) stats.reclassified++
        console.log(`✅ ${(result.name || '').substring(0, 50)}`)
      } else if (result.crawl_status === 'not_found') {
        stats.not_found++
        progress.crawled.push(p.hita_id)
        console.log(`⚠️  404 Not Found`)
      } else {
        stats.failed++
        progress.failed.push(p.hita_id)
        console.log(`❌ ${result.crawl_error}`)
      }
    } catch (e) {
      stats.failed++
      progress.failed.push(p.hita_id)
      console.log(`❌ CRASH: ${e.message}`)
      enriched.push({
        ...p,
        crawl_status: 'crashed',
        crawl_error: e.message,
      })
    }

    // Save progress + enriched every 25 products
    if ((i + 1) % 25 === 0 || i === products.length - 1) {
      saveProgress(progress)
      writeFileSync(PATHS.enriched, JSON.stringify(enriched, null, 2))
    }

    // Delay before next request
    if (i < products.length - 1) {
      await sleep(randomDelay())
    }
  }

  // Final save
  saveProgress(progress)
  writeFileSync(PATHS.enriched, JSON.stringify(enriched, null, 2))

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  console.log('\n' + '='.repeat(70))
  console.log('📊 PDP CRAWL SUMMARY')
  console.log('='.repeat(70))
  console.log(`  Total crawled:        ${stats.success + stats.not_found + stats.failed}`)
  console.log(`  Success:              ${stats.success}`)
  console.log(`  404 Not Found:        ${stats.not_found}`)
  console.log(`  Failed:               ${stats.failed}`)
  console.log('─'.repeat(70))
  console.log(`  With price:           ${stats.with_price}`)
  console.log(`  With online discount: ${stats.with_online_discount}`)
  console.log(`  With specs:           ${stats.with_specs}`)
  console.log(`  With documents:       ${stats.with_docs}`)
  console.log(`  With variants:        ${stats.with_variants}`)
  console.log(`  Re-classified:        ${stats.reclassified}`)
  console.log('─'.repeat(70))
  console.log(`  Time:                 ${totalTime} minutes`)
  console.log(`  Output:               output/toto-enriched.json`)
  console.log(`  Size:                 ${(readFileSync(PATHS.enriched).length / 1024 / 1024).toFixed(2)} MB`)
  console.log('='.repeat(70))

  // Classification summary
  const bySub = {}
  const byType = {}
  for (const p of enriched.filter(p => p.crawl_status === 'success')) {
    bySub[p.subcategory_id] = (bySub[p.subcategory_id] || 0) + 1
    byType[p.product_type || '(none)'] = (byType[p.product_type || '(none)'] || 0) + 1
  }

  console.log('\n  Classification after PDP:')
  console.log('  By Subcategory:')
  for (const [id, count] of Object.entries(bySub).sort((a, b) => b[1] - a[1])) {
    console.log(`    sub_id=${id.padEnd(4)} → ${count}`)
  }
  console.log('  By Product Type (top 15):')
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${type.padEnd(25)} → ${count}`)
  }

  console.log('\n✅ PDP crawl complete! Next: variant-expander.mjs')
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
