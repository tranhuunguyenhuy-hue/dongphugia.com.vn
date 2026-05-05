/**
 * category-lister.mjs — Crawl TOTO category pages to collect ALL product URLs
 *
 * Uses Hita's ?pc=N parameter to load ALL products in one request (not just SSR first batch).
 * Also classifies each product into DPG subcategory + product_type.
 *
 * Usage:
 *   node scripts/crawl-toto/category-lister.mjs                    # all categories
 *   node scripts/crawl-toto/category-lister.mjs --type bon-cau     # single category
 *
 * Output: scripts/crawl-toto/output/toto-listing.json
 */

import { writeFileSync } from 'fs'
import {
  TOTO_CATEGORIES, PATHS, fetchWithRetry, sleep, randomDelay,
  extractHitaId, classifyProduct,
} from './config.mjs'

// ─── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const TYPE_FILTER = (() => {
  const idx = args.indexOf('--type')
  return idx !== -1 ? args[idx + 1] : null
})()

// ─── SKIP PATTERNS (category/blog pages, not products) ──────────────────────
const SKIP_PATTERNS = [
  /bon-cau-toto-178\.html$/,
  /bon-cau-toto-1-khoi-180\.html$/,
  /bon-cau-toto-2-khoi-181\.html$/,
  /bon-cau-treo-tuong-toto-189\.html$/,
  /bon-cau-thong-minh-toto-366\.html$/,
  /bon-cau-nap-rua-co-toto-369\.html$/,
  /bon-cau-253\.html$/,
  /bon-cau-1-khoi-260\.html$/,
  /bon-cau-2-khoi-261\.html$/,
  /chau-rua-mat-lavabo-toto-91\.html$/,
  /chau-rua-mat-lavabo-254\.html$/,
  /voi-chau-toto-141\.html$/,
  /sen-tam-nhat-toto-143\.html$/,
  /sen-tam-289\.html$/,
  /bon-tam-toto-150\.html$/,
  /bon-tam-256\.html$/,
  /bon-tieu-nam-toto-170\.html$/,
  /bon-tieu-255\.html$/,
  /nap-bon-cau-thuong-toto-359\.html$/,
  /nap-rua-co-toto-203\.html$/,
  /nap-bon-cau-thong-minh-toto/,
  /nap-bon-cau-357\.html$/,
  /phu-kien-nha-tam-258\.html$/,
  /voi-lavabo-284\.html$/,
  /voi-rua-chen-bat-283\.html$/,
  /thuong-hieu/,
  /post-\d+\.html$/,  // Blog posts
  // Sub-category pages for sen tam
  /sen-voi-am-tuong-toto-289\.html$/,
  /sen-cay-toto-290\.html$/,
  /cu-sen-toto-146\.html$/,
  /tay-sen-toto-147\.html$/,
  // Sub-category pages for lavabo
  /lavabo-treo-tuong-\d+\.html$/,
  /lavabo-dat-ban-\d+\.html$/,
  /lavabo-am-ban-\d+\.html$/,
]

function isProductUrl(url) {
  if (!url) return false
  if (!/-\d+\.html$/.test(url)) return false
  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(url)) return false
  }
  return true
}

// ─── PARSER ──────────────────────────────────────────────────────────────────
function parseProductsFromHtml(html, cat) {
  const products = new Map()

  // Find all Hita product URLs
  const urlRegex = /https:\/\/hita\.com\.vn\/([a-z0-9-]+)-(\d+)\.html/gi
  let match

  while ((match = urlRegex.exec(html)) !== null) {
    const fullUrl = match[0]
    const hitaId = match[2]

    if (!isProductUrl(fullUrl)) continue
    if (products.has(hitaId)) continue

    products.set(hitaId, {
      url: fullUrl,
      hita_id: hitaId,
      category_type: cat.type,
      source_category_url: cat.url,
    })
  }

  // Enrich with name and price
  for (const [hitaId, product] of products) {
    const urlEscaped = product.url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    // Try title attribute
    const titleRegex = new RegExp(`href="${urlEscaped}"[^>]*title="([^"]+)"`, 'i')
    const titleMatch = html.match(titleRegex)
    if (titleMatch) {
      product.name = titleMatch[1].trim()
    } else {
      // Try text content
      const textRegex = new RegExp(`href="${urlEscaped}"[^>]*>\\s*([^<]{10,})`, 'i')
      const textMatch = html.match(textRegex)
      if (textMatch) {
        const text = textMatch[1].trim()
        if (!text.includes('Xem thêm') && !text.includes('đánh giá')) {
          product.name = text
        }
      }
    }

    // Find price
    const priceRegex = new RegExp(`${hitaId}[\\s\\S]{0,500}?(\\d{1,3}(?:\\.\\d{3})+đ)`, 'i')
    const priceMatch = html.match(priceRegex)
    if (priceMatch) product.price_text = priceMatch[1]

    // Classify into DPG category/subcategory/product_type
    const classification = classifyProduct(product.name, cat.type)
    product.category_id = classification.category_id
    product.subcategory_id = classification.subcategory_id
    product.product_type = classification.product_type
    product.product_sub_type = classification.product_sub_type
  }

  return [...products.values()]
}

// ─── CRAWL SINGLE CATEGORY ──────────────────────────────────────────────────
async function crawlCategory(cat) {
  console.log(`\n📂 ${cat.type.toUpperCase()}`)

  // Build URL with ?pc=N for full product load
  const separator = cat.url.includes('?') ? '&' : '?'
  let fullUrl = `${cat.url}${separator}pc=${cat.pc || 50}`
  if (cat.brandFilter) {
    fullUrl += `&b=${cat.brandFilter}`
  }
  console.log(`   URL: ${fullUrl}`)

  const result = await fetchWithRetry(fullUrl)
  if (!result.html) {
    console.log(`   ❌ Failed: ${result.error || 'HTTP ' + result.status}`)
    return []
  }

  const products = parseProductsFromHtml(result.html, cat)

  // Show classification stats
  const bySubcategory = {}
  for (const p of products) {
    const key = `${p.subcategory_id}:${p.product_type || 'default'}`
    bySubcategory[key] = (bySubcategory[key] || 0) + 1
  }

  console.log(`   ✅ Found: ${products.length} products`)
  const withName = products.filter(p => p.name).length
  console.log(`      With name: ${withName}/${products.length}`)
  console.log(`      Classification:`)
  for (const [key, count] of Object.entries(bySubcategory).sort((a, b) => b[1] - a[1])) {
    const [subId, ptype] = key.split(':')
    console.log(`        sub_id=${subId.padEnd(3)} type=${ptype.padEnd(25)} → ${count}`)
  }

  return products
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📋 TOTO Category Lister — Phase 1 (Full Load with ?pc=50)')
  console.log(`   Time: ${new Date().toISOString()}`)
  if (TYPE_FILTER) console.log(`   Filter: ${TYPE_FILTER} only`)
  console.log()

  const categories = TYPE_FILTER
    ? TOTO_CATEGORIES.filter(c => c.type === TYPE_FILTER)
    : TOTO_CATEGORIES

  if (categories.length === 0) {
    console.error(`❌ No category: ${TYPE_FILTER}`)
    process.exit(1)
  }

  let allProducts = []

  for (const cat of categories) {
    const products = await crawlCategory(cat)
    allProducts = allProducts.concat(products)
    if (cat !== categories[categories.length - 1]) {
      await sleep(3000)
    }
  }

  // Global dedup by hita_id (keep first match — priority goes to more specific category)
  const seen = new Map()
  for (const p of allProducts) {
    if (!seen.has(p.hita_id)) {
      seen.set(p.hita_id, p)
    } else {
      const existing = seen.get(p.hita_id)
      // Prefer the entry with name and more specific product_type
      if (!existing.name && p.name) seen.set(p.hita_id, p)
      else if (!existing.product_type && p.product_type) seen.set(p.hita_id, p)
    }
  }
  const uniqueProducts = [...seen.values()]

  // Save
  writeFileSync(PATHS.listing, JSON.stringify(uniqueProducts, null, 2))

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('📊 LISTING SUMMARY')
  console.log('='.repeat(70))

  // By Hita category
  console.log('\n  By Hita Category:')
  const byCat = {}
  for (const p of uniqueProducts) byCat[p.category_type] = (byCat[p.category_type] || 0) + 1
  for (const [type, count] of Object.entries(byCat).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(15)} ${count}`)
  }

  // By DPG subcategory
  console.log('\n  By DPG Subcategory:')
  const bySub = {}
  for (const p of uniqueProducts) {
    const key = `${p.subcategory_id}`
    bySub[key] = (bySub[key] || 0) + 1
  }
  for (const [subId, count] of Object.entries(bySub).sort((a, b) => b[1] - a[1])) {
    console.log(`    subcategory_id=${subId.padEnd(4)} → ${count}`)
  }

  // By product_type
  console.log('\n  By Product Type:')
  const byType = {}
  for (const p of uniqueProducts) {
    const key = p.product_type || '(none)'
    byType[key] = (byType[key] || 0) + 1
  }
  for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(25)} → ${count}`)
  }

  console.log('\n' + '─'.repeat(70))
  console.log(`  TOTAL:       ${uniqueProducts.length} unique products`)
  console.log(`  Duplicates:  ${allProducts.length - uniqueProducts.length} removed`)
  console.log(`  With name:   ${uniqueProducts.filter(p => p.name).length}`)
  console.log(`  Classified:  ${uniqueProducts.filter(p => p.product_type).length}`)
  console.log(`  Output:      output/toto-listing.json`)
  console.log('='.repeat(70))

  console.log('\n✅ Full listing complete! Next: crawl-toto-pdp.mjs')
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
