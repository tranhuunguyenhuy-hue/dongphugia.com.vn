/**
 * crawl-vietceramics-listing.mjs — LEO-387 Phase 1
 *
 * Crawls vietceramics.com category pages to collect all product URLs.
 * Uses simple fetch + regex/string parsing (no heavy dependencies).
 *
 * Usage:
 *   node scripts/product-import/crawl-vietceramics-listing.mjs
 *   node scripts/product-import/crawl-vietceramics-listing.mjs --dry-run
 *
 * Output: scripts/product-import/gach-product-urls.json
 */

import { writeFileSync, existsSync, readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DRY_RUN = process.argv.includes('--dry-run')

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const BASE_URL = 'https://vietceramics.com'
const DELAY_MIN_MS = 2000
const DELAY_MAX_MS = 3500
const MAX_RETRIES = 3

const SUBCATEGORIES = [
  { slug: 'gach-van-da-marble', url: '/san-pham/gach-op-lat/gach-van-da-marble/' },
  { slug: 'gach-van-da-tu-nhien', url: '/san-pham/gach-op-lat/gach-van-da-tu-nhien/' },
  { slug: 'gach-van-go', url: '/san-pham/gach-op-lat/gach-van-go/' },
  { slug: 'gach-thiet-ke-xi-mang', url: '/san-pham/gach-op-lat/gach-thiet-ke-xi-mang/' },
  { slug: 'gach-trang-tri', url: '/san-pham/gach-op-lat/gach-trang-tri/' },
]

const OUTPUT_FILE = path.join(__dirname, 'gach-product-urls.json')

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function randomDelay() {
  return Math.floor(Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS + 1)) + DELAY_MIN_MS
}

async function fetchPage(url, retries = 0) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en;q=0.8',
      },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } catch (err) {
    if (retries < MAX_RETRIES) {
      console.log(`   ⚠️  Retry ${retries + 1}/${MAX_RETRIES}: ${err.message}`)
      await delay(5000)
      return fetchPage(url, retries + 1)
    }
    throw err
  }
}

/**
 * Parse collection links from a subcategory listing page.
 * Vietceramics structure: Subcategory → Collections → Products
 * Example: /san-pham/gach-op-lat/gach-van-da-marble/ → lists collections like ONIX, INTENSE
 * Each collection page then lists individual products.
 */
function extractCollectionLinks(html, subcategoryUrl) {
  const links = new Set()

  // Pattern 1: Links matching /san-pham/gach-op-lat/[collection-slug]/
  // These are collection pages nested under the subcategory
  const basePath = '/san-pham/gach-op-lat/'
  const regex = /href=["'](\/san-pham\/gach-op-lat\/([^/"']+)\/)["']/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const fullPath = match[1]
    const collSlug = match[2]
    // Skip if it's a subcategory link itself
    const isSubcategory = SUBCATEGORIES.some(s => s.url === fullPath)
    if (!isSubcategory && collSlug) {
      links.add(fullPath)
    }
  }

  return [...links]
}

/**
 * Extract product links from a collection page.
 * Products have URLs like: /san-pham/gach-op-lat/[collection]/[product-slug]/
 */
function extractProductLinks(html, collectionPath) {
  const products = new Set()

  // Match product links: /san-pham/gach-op-lat/collection-slug/product-slug/
  const collSlug = collectionPath.split('/').filter(Boolean).pop()
  const regex = new RegExp(
    `href=["'](/san-pham/gach-op-lat/${collSlug}/([^/"']+)/)["']`,
    'g'
  )
  let match
  while ((match = regex.exec(html)) !== null) {
    const productPath = match[1]
    const productSlug = match[2]
    // Skip if it matches the collection page itself
    if (productSlug && productPath !== collectionPath) {
      products.add(productPath)
    }
  }

  return [...products]
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧱 LEO-387 Phase 1: Crawl Vietceramics Listing`)
  console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN' : '🔥 LIVE'}`)
  console.log('─'.repeat(60))

  const allProducts = []
  const collectionSet = new Set()

  for (const sub of SUBCATEGORIES) {
    console.log(`\n📁 ${sub.slug}`)
    const subcatUrl = BASE_URL + sub.url

    // Step 1: Fetch subcategory page
    console.log(`   Fetching: ${subcatUrl}`)
    const subcatHtml = await fetchPage(subcatUrl)
    await delay(randomDelay())

    // Step 2: Extract collection links
    const collections = extractCollectionLinks(subcatHtml, sub.url)
    console.log(`   Found ${collections.length} collections`)

    // Step 3: Crawl each collection
    for (const collPath of collections) {
      const collSlug = collPath.split('/').filter(Boolean).pop()

      if (collectionSet.has(collPath)) {
        console.log(`   ⏭️  Skip duplicate: ${collSlug}`)
        continue
      }
      collectionSet.add(collPath)

      const collUrl = BASE_URL + collPath
      console.log(`   📂 Collection: ${collSlug}`)

      const collHtml = await fetchPage(collUrl)
      await delay(randomDelay())

      // Extract product links
      const productLinks = extractProductLinks(collHtml, collPath)
      console.log(`      → ${productLinks.length} products`)

      for (const productPath of productLinks) {
        const productSlug = productPath.split('/').filter(Boolean).pop()
        allProducts.push({
          url: productPath,
          fullUrl: BASE_URL + productPath,
          collection: collSlug,
          subcategory: sub.slug,
          productSlug,
        })
      }
    }

    // Also check for direct product links on subcategory page
    // (some products may be listed directly without collection nesting)
    const directProducts = extractDirectProductLinks(subcatHtml, sub.url)
    if (directProducts.length > 0) {
      console.log(`   📌 ${directProducts.length} direct products (no collection nesting)`)
      for (const p of directProducts) {
        if (!allProducts.some(existing => existing.url === p.url)) {
          allProducts.push({ ...p, subcategory: sub.slug })
        }
      }
    }
  }

  // Deduplicate by URL
  const uniqueProducts = [...new Map(allProducts.map(p => [p.url, p])).values()]

  console.log('\n' + '─'.repeat(60))
  console.log(`📊 Results:`)
  console.log(`   Total collections: ${collectionSet.size}`)
  console.log(`   Total products: ${uniqueProducts.length}`)

  // Breakdown by subcategory
  const bySubcat = {}
  for (const p of uniqueProducts) {
    bySubcat[p.subcategory] = (bySubcat[p.subcategory] || 0) + 1
  }
  for (const [sub, count] of Object.entries(bySubcat)) {
    console.log(`   ${sub}: ${count}`)
  }

  // Save to file
  const output = {
    crawledAt: new Date().toISOString(),
    total: uniqueProducts.length,
    collections: collectionSet.size,
    bySubcategory: bySubcat,
    products: uniqueProducts,
  }

  if (!DRY_RUN) {
    writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2), 'utf-8')
    console.log(`\n💾 Saved to: ${OUTPUT_FILE}`)
  } else {
    console.log(`\n🔍 Dry run — would save to: ${OUTPUT_FILE}`)
  }

  console.log('✅ Phase 1 complete!')
}

/**
 * Extract direct product links from subcategory listing.
 * Some subcategories may list products directly (without collection nesting).
 */
function extractDirectProductLinks(html, subcategoryUrl) {
  const products = []
  // Match all links under /san-pham/gach-op-lat/ with 2 path segments after
  const regex = /href=["'](\/san-pham\/gach-op-lat\/([^/"']+)\/([^/"']+)\/)["']/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const fullPath = match[1]
    const collSlug = match[2]
    const productSlug = match[3]
    // Only add if collection is not a known subcategory
    const isSubcat = SUBCATEGORIES.some(s => s.url.includes(collSlug))
    if (!isSubcat && productSlug) {
      products.push({
        url: fullPath,
        fullUrl: BASE_URL + fullPath,
        collection: collSlug,
        productSlug,
      })
    }
  }
  return products
}

main()
  .catch(e => { console.error('❌ Error:', e.message); process.exit(1) })
