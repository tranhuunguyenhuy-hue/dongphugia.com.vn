/**
 * import-v2.mjs — Product Import Script v2 (LEO-370 Phase 4B)
 * Reads *-enriched.json (from crawl-enrich.mjs) or falls back to *-raw.json.
 *
 * Usage:
 *   node import-v2.mjs                      # import all (live, uses enriched)
 *   node import-v2.mjs --dry-run            # stats only, no DB writes
 *   node import-v2.mjs --limit 100          # batch test first 100
 *   node import-v2.mjs --category tbvs      # single category
 *   node import-v2.mjs --use-raw            # force *-raw.json fallback
 *
 * Filter rules (PM instruction):
 *   - SKIP products with no brand
 *   - SKIP products where brand is HITA or dealer-only brand
 *
 * Idempotent: skips by SKU if already exists.
 * Image remap: reads image-url-map.json (from mirror-images.mjs) to replace
 *   HITA CDN URLs with Bunny CDN URLs before DB insert.
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
config({ path: path.resolve(__dirname, '../../.env.local') })

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const USE_RAW = args.includes('--use-raw')
const LIMIT = (() => {
  const idx = args.indexOf('--limit')
  return idx !== -1 ? parseInt(args[idx + 1]) : null
})()
const CATEGORY_FILTER = (() => {
  const idx = args.indexOf('--category')
  return idx !== -1 ? args[idx + 1]?.toLowerCase() : null
})()

// ─── PM RULE: BRANDS TO SKIP ─────────────────────────────────────────────────
// Skip products whose brand matches these patterns (case-insensitive)
const SKIP_BRAND_PATTERNS = [
  'HITA',       // HITA brand products (dealer brand, not manufacturer)
  'ĐẠI LÝ',     // "Đại lý" = dealer in Vietnamese
  'DEALER',
]

function shouldSkipBrand(brand) {
  if (!brand || !brand.trim()) return true  // no brand → skip
  const upper = brand.toUpperCase().trim()
  return SKIP_BRAND_PATTERNS.some(pattern => upper.includes(pattern.toUpperCase()))
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function slugify(text) {
  return (text || '')
    .toString()
    .toLowerCase()
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '').replace(/-+$/, '')
}

// Parse capacity from name: "15L", "30 lít", "20L"
function parseCapacityLiters(name) {
  if (!name) return null
  const m = name.match(/(\d+(?:[,.]\d+)?)\s*(?:lít|liter|L\b)/i)
  if (!m) return null
  const val = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(val) && val > 0 && val < 5000 ? Math.round(val) : null
}

// Parse power: "4.5kW", "2500W"
function parsePowerWatts(name) {
  if (!name) return null
  const kw = name.match(/(\d+(?:[.,]\d+)?)\s*kW/i)
  if (kw) {
    const val = parseFloat(kw[1].replace(',', '.'))
    return Number.isFinite(val) && val > 0 ? Math.round(val * 1000) : null
  }
  const w = name.match(/(\d{3,5})\s*W(?!h)/i)
  if (w) {
    const val = parseInt(w[1])
    return val > 0 && val < 20000 ? val : null
  }
  return null
}

// ─── CATEGORY CONFIGS ────────────────────────────────────────────────────────
function getInputFile(catKey) {
  if (!USE_RAW) {
    const enriched = path.join(__dirname, `${catKey}-enriched.json`)
    if (existsSync(enriched)) return enriched
    console.log(`  ⚠️  ${catKey}-enriched.json not found, falling back to ${catKey}-raw.json`)
  }
  return path.join(__dirname, `${catKey}-raw.json`)
}

const CATEGORY_CONFIGS = {
  tbvs: { label: 'TBVS', get file() { return getInputFile('tbvs') }, categoryId: 1 },
  bep:  { label: 'BEP',  get file() { return getInputFile('bep')  }, categoryId: 2 },
  nuoc: { label: 'NUOC', get file() { return getInputFile('nuoc') }, categoryId: 3 },
}

// ─── BUNNY CDN IMAGE URL REMAPPING ───────────────────────────────────────────
const URL_MAP_FILE = path.join(__dirname, 'image-url-map.json')
let imageUrlMap = {}
if (existsSync(URL_MAP_FILE)) {
  try {
    imageUrlMap = JSON.parse(readFileSync(URL_MAP_FILE, 'utf-8'))
  } catch { /* ignore */ }
}
function remapImageUrl(url) {
  return imageUrlMap[url] || url
}

// Parse warranty string → months integer
function parseWarrantyMonths(str) {
  if (!str) return null
  const m = str.match(/(\d+)\s*tháng/i)
  if (m) return parseInt(m[1])
  const y = str.match(/(\d+)\s*năm/i)
  if (y) return parseInt(y[1]) * 12
  return null
}

// ─── IMPORT SINGLE CATEGORY ──────────────────────────────────────────────────
async function importCategory(prisma, catKey, config, subcatMap, brandMap) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 Category: ${config.label}`)
  console.log('='.repeat(60))

  const allProducts = JSON.parse(readFileSync(config.file, 'utf-8'))

  // Apply brand filter (PM rule)
  const skippedBrand = allProducts.filter(p => shouldSkipBrand(p.brand))
  const products = allProducts.filter(p => !shouldSkipBrand(p.brand))

  console.log(`  Loaded: ${allProducts.length} | Skipped (brand filter): ${skippedBrand.length} | To import: ${products.length}`)
  if (skippedBrand.length > 0) {
    const skipNames = [...new Set(skippedBrand.map(p => p.brand || '(no brand)'))]
    console.log(`  Skipped brands: ${skipNames.join(', ')}`)
  }

  // Apply --limit flag
  const batch = LIMIT ? products.slice(0, LIMIT) : products
  if (LIMIT) console.log(`  ⚠️  --limit ${LIMIT}: processing only first ${batch.length}`)

  if (DRY_RUN) {
    const brands = [...new Set(batch.map(p => p.brand).filter(Boolean))]
    const typeSlugs = [...new Set(batch.map(p => p.product_type_slug).filter(Boolean))]
    console.log('\n  📊 DRY RUN STATS:')
    console.log(`    Products to import: ${batch.length}`)
    console.log(`    Unique brands (${brands.length}): ${brands.join(', ')}`)
    console.log(`    product_type_slugs (${typeSlugs.length}): ${typeSlugs.join(', ')}`)

    // Check subcategory mapping coverage
    const missing = typeSlugs.filter(s => !subcatMap.has(s))
    if (missing.length) {
      console.log(`    ⚠️  Missing subcategory mapping for: ${missing.join(', ')}`)
    } else {
      console.log(`    ✅ All product_type_slugs mapped to subcategories`)
    }

    // Check brand coverage
    const missingBrands = brands.filter(b => !brandMap.has(slugify(b)))
    if (missingBrands.length) {
      console.log(`    ⚠️  Missing brand in DB for: ${missingBrands.join(', ')}`)
    } else {
      console.log(`    ✅ All brands found in DB`)
    }

    return { imported: 0, skipped: 0, failedBrand: skippedBrand.length, failed: 0, total: allProducts.length }
  }

  // ── LIVE IMPORT ────────────────────────────────────────────────────────────
  let imported = 0, skipped = 0, failed = 0
  const failLog = []

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i]

    if (i > 0 && i % 200 === 0) {
      console.log(`    [${i}/${batch.length}] imported=${imported} skipped=${skipped} failed=${failed}`)
    }

    try {
      // Idempotency: skip if SKU already exists
      const exists = await prisma.products.findUnique({
        where: { sku: p.sku },
        select: { id: true },
      })
      if (exists) {
        skipped++
        continue
      }

      // Subcategory lookup by product_type_slug
      const subcategoryId = subcatMap.get(p.product_type_slug)
      if (!subcategoryId) {
        failLog.push(`No subcategory for slug "${p.product_type_slug}" — SKU ${p.sku}`)
        failed++
        continue
      }

      // Brand lookup by slug
      const brandSlug = slugify(p.brand)
      const brandId = brandMap.get(brandSlug) ?? null

      // Build unique slug
      let baseSlug = slugify(p.name).substring(0, 185)
      if (!baseSlug) baseSlug = slugify(p.sku)
      let slug = baseSlug

      const slugConflict = await prisma.products.findFirst({
        where: { category_id: config.categoryId, slug },
        select: { id: true },
      })
      if (slugConflict) {
        const skuPart = p.sku.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)
        slug = `${baseSlug}-${skuPart}`.substring(0, 200)
      }

      // SEO description
      const seoDesc = `${p.name} chính hãng${p.brand ? ` ${p.brand}` : ''}. Giá tốt nhất tại Đông Phú Gia, Đà Lạt.`.substring(0, 500)

      // ── SPECS JSONB (enriched specs_raw + NUOC-specific fields) ─────────────
      const specsBase = p.specs_raw ? { ...p.specs_raw } : {}
      if (catKey === 'nuoc') {
        specsBase.capacity_liters = parseCapacityLiters(p.name)
        specsBase.power_watts = parsePowerWatts(p.name)
      }
      if (p.documents?.length) {
        specsBase.documents = p.documents.map(d => ({ name: d.name, url: remapImageUrl(d.url) }))
      }
      const specsData = Object.keys(specsBase).length ? specsBase : undefined

      // ── WARRANTY ─────────────────────────────────────────────────────────────
      const warrantyMonths = p.warranty_months ?? parseWarrantyMonths(p.warranty_text) ?? null

      // ── DESCRIPTION (enriched HTML preferred) ────────────────────────────────
      const description = p.description_html || p.description || null

      // ── GALLERY IMAGES ───────────────────────────────────────────────────────
      const galleryImages = (p.gallery_images || []).map(remapImageUrl)
      const rawMainImg = p.image_main_url ? remapImageUrl(p.image_main_url) : null
      const mainImageUrl = galleryImages[0] || rawMainImg || null

      const productData = {
        sku: p.sku.substring(0, 50),
        name: p.name.substring(0, 200),
        slug: slug.substring(0, 200),
        category_id: config.categoryId,
        subcategory_id: subcategoryId,
        brand_id: brandId,
        description,
        price: p.price ? Math.round(p.price) : null,
        price_display: p.price ? null : 'Liên hệ báo giá',
        is_active: true,
        is_featured: false,
        stock_status: (p.stock_status || 'in_stock').substring(0, 50),
        seo_title: p.name.substring(0, 200),
        seo_description: seoDesc,
        specs: specsData,
        ...(warrantyMonths && { warranty_months: warrantyMonths }),
        ...(mainImageUrl && { image_main_url: mainImageUrl.substring(0, 1000) }),
      }

      const created = await prisma.products.create({ data: productData })

      // ── INSERT ALL GALLERY IMAGES ────────────────────────────────────────────
      const imagesToInsert = galleryImages.length > 0
        ? galleryImages
        : (rawMainImg ? [rawMainImg] : [])

      if (imagesToInsert.length > 0) {
        await prisma.product_images.createMany({
          data: imagesToInsert.map((imgUrl, idx) => ({
            product_id: created.id,
            image_url: imgUrl.substring(0, 1000),
            image_type: idx === 0 ? 'main' : 'gallery',
            sort_order: idx,
          })),
          skipDuplicates: true,
        })
      }

      imported++
    } catch (e) {
      failed++
      if (failLog.length < 30) {
        failLog.push(`SKU ${p.sku}: ${e.message.substring(0, 120)}`)
      }
    }
  }

  console.log(`    [${batch.length}/${batch.length}] done`)

  if (failLog.length > 0) {
    console.log('\n  ⚠️  Failed details (first 30):')
    for (const msg of failLog) {
      console.log(`    - ${msg}`)
    }
  }

  return {
    imported,
    skipped,
    failedBrand: skippedBrand.length,
    failed,
    total: allProducts.length,
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Product Import v2 — LEO-370 Phase 4')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no DB writes)' : 'LIVE'}`)
  if (LIMIT) console.log(`   Limit: ${LIMIT} products per category`)
  if (CATEGORY_FILTER) console.log(`   Category: ${CATEGORY_FILTER} only`)
  console.log(`   Time: ${new Date().toISOString()}\n`)

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set. Aborting.')
    process.exit(1)
  }

  const prisma = new PrismaClient()

  try {
    // Pre-load lookup maps for performance (1 DB query each)
    console.log('📋 Loading lookup tables...')

    // subcategory slug → id map
    const subcatsDb = await prisma.subcategories.findMany({
      select: { id: true, slug: true },
    })
    const subcatMap = new Map(subcatsDb.map(s => [s.slug, s.id]))
    console.log(`   subcategories: ${subcatMap.size} records`)

    // brand slug → id map
    const brandsDb = await prisma.brands.findMany({
      select: { id: true, slug: true },
    })
    const brandMap = new Map(brandsDb.map(b => [b.slug, b.id]))
    console.log(`   brands: ${brandMap.size} records`)

    // Run import per category
    const results = {}
    const catsToRun = CATEGORY_FILTER
      ? { [CATEGORY_FILTER]: CATEGORY_CONFIGS[CATEGORY_FILTER] }
      : CATEGORY_CONFIGS

    if (CATEGORY_FILTER && !CATEGORY_CONFIGS[CATEGORY_FILTER]) {
      console.error(`❌ Unknown category: "${CATEGORY_FILTER}". Valid: tbvs, bep, nuoc`)
      process.exit(1)
    }

    for (const [catKey, cfg] of Object.entries(catsToRun)) {
      results[catKey] = await importCategory(prisma, catKey, cfg, subcatMap, brandMap)
    }

    // ── SUMMARY ───────────────────────────────────────────────────────────────
    console.log('\n\n' + '='.repeat(60))
    console.log('📊 IMPORT SUMMARY')
    console.log('='.repeat(60))

    let totImported = 0, totSkipped = 0, totBrand = 0, totFailed = 0, totTotal = 0
    for (const [cat, r] of Object.entries(results)) {
      const label = CATEGORY_CONFIGS[cat].label
      console.log(`  ${label.padEnd(6)}: ${r.imported} imported | ${r.skipped} skipped | ${r.failedBrand} brand-filtered | ${r.failed} errors / ${r.total} total`)
      totImported += r.imported
      totSkipped += r.skipped
      totBrand += r.failedBrand
      totFailed += r.failed
      totTotal += r.total
    }
    console.log('─'.repeat(60))
    console.log(`  TOTAL : ${totImported} imported | ${totSkipped} skipped | ${totBrand} brand-filtered | ${totFailed} errors / ${totTotal} total`)
    console.log('='.repeat(60))

    if (!DRY_RUN && totFailed > 0) {
      console.log(`\n⚠️  ${totFailed} products had errors during import.`)
    }
    if (!DRY_RUN) {
      console.log('\n✅ Import complete!')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal error:', e)
  process.exit(1)
})
