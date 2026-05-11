/**
 * import-toto.mjs — Import/upsert TOTO products from enriched JSON into DPG database
 *
 * Key differences from import-v2.mjs:
 *   - Uses SKU matching for upsert (not just create)
 *   - Uses classifyProduct() for auto-classification
 *   - Handles 3-tier pricing (original_price, price, online_discount_amount)
 *   - Reads toto-image-map.json to remap HITA → DPG CDN URLs
 *
 * Usage:
 *   node scripts/crawl-toto/import-toto.mjs                # import all
 *   node scripts/crawl-toto/import-toto.mjs --dry-run      # stats only
 *   node scripts/crawl-toto/import-toto.mjs --limit 50     # first 50
 *   node scripts/crawl-toto/import-toto.mjs --update-only  # only update existing
 *   node scripts/crawl-toto/import-toto.mjs --create-only  # only create new
 *
 * Output: Console report + DB changes
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { PATHS, classifyProduct, loadEnv } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
loadEnv()

// ─── CLI ARGS ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const UPDATE_ONLY = args.includes('--update-only')
const CREATE_ONLY = args.includes('--create-only')
const LIMIT = (() => { const i = args.indexOf('--limit'); return i !== -1 ? parseInt(args[i + 1]) : null })()

// ─── IMAGE URL REMAPPING ─────────────────────────────────────────────────────
let imageUrlMap = {}
if (existsSync(PATHS.imageMap)) {
  try { imageUrlMap = JSON.parse(readFileSync(PATHS.imageMap, 'utf-8')) } catch {}
}
function remapUrl(url) {
  return imageUrlMap[url] || url
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function slugify(text) {
  return (text || '')
    .toString().toLowerCase()
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

/** Extract SKU from product name. Handles combo names with 2+ TOTO model codes:
 *  "Bộ sen tắm nóng lạnh TOTO TBG11302VA TBW01010A (3 chế độ)" → "TOTO-TBG11302VA-TBW01010A"
 *  "Bồn cầu 1 khối TOTO MS636DT2 nắp đóng êm TC393VS" → "TOTO-MS636DT2"
 */
function extractSku(name) {
  if (!name) return null
  // Match ALL uppercase model codes after "TOTO" (letters + digits, optional -/)
  const modelPattern = /\b([A-Z]{2,}[A-Z0-9]*(?:[-/][A-Z0-9]+)*)\b/g
  const afterToto = name.replace(/^.*?TOTO\s*/i, '')
  const models = []
  let m
  while ((m = modelPattern.exec(afterToto)) !== null) {
    const code = m[1]
    // Must be at least 4 chars and contain at least one digit to be a model code
    if (code.length >= 4 && /\d/.test(code)) {
      models.push(code)
    }
    // Stop after 2 model codes (combo: valve + showerhead)
    if (models.length >= 2) break
  }
  if (models.length > 0) return `TOTO-${models.join('-')}`
  return null
}

/** Generate full SKU from name: handle complex names with variant suffixes */
function generateSku(name, hitaId) {
  const baseSku = extractSku(name)
  if (baseSku) return baseSku
  // Fallback: use hita_id
  return `TOTO-HITA-${hitaId}`
}

// Track SKUs used in this import batch to detect intra-batch collisions
const usedSkus = new Set()

// ─── IMPORT SINGLE PRODUCT ──────────────────────────────────────────────────
async function importProduct(prisma, p, brandId) {
  let sku = p.sku || generateSku(p.name, p.hita_id)
  if (!sku) return { status: 'no_sku', reason: 'Cannot extract SKU' }

  // Deduplicate: if SKU already used in this batch or exists in DB for a DIFFERENT product,
  // append hita_id to make it unique
  if (usedSkus.has(sku)) {
    sku = `${sku}-H${p.hita_id}`
  }

  // Check existing product by SKU
  const existing = await prisma.products.findUnique({
    where: { sku },
    select: { id: true, source_url: true },
  })

  // If exists but for a different hita source → deduplicate
  if (existing && existing.source_url !== p.url && !sku.includes('-H')) {
    sku = `${sku}-H${p.hita_id}`
    // Re-check with deduped SKU
    const existsDeduped = await prisma.products.findUnique({
      where: { sku },
      select: { id: true },
    })
    if (existsDeduped) {
      // Already imported this exact product
      usedSkus.add(sku)
      return { status: 'exists_skip' }
    }
  }

  usedSkus.add(sku)

  if (existing && CREATE_ONLY) return { status: 'exists_skip' }
  if (!existing && UPDATE_ONLY) return { status: 'new_skip' }

  // Classification
  const classification = classifyProduct(p.name, p.category_type)

  // Images (remap URLs)
  const galleryImages = (p.gallery_images || [])
    .filter(img => img && !img.includes('icon-pdf') && !img.includes('original.jpg') && !img.includes('placeholder'))
    .map(remapUrl)
  const mainImageUrl = galleryImages[0] || null

  // Specs + documents (skip DWG/DXF per user decision)
  const specs = { ...(p.specs_raw || {}) }
  if (p.documents?.length) {
    const filteredDocs = p.documents
      .filter(d => !/\.(dwg|dxf)$/i.test(d.url))
      .map(d => ({
        name: d.name,
        url: remapUrl(d.url),
        type: d.type,
      }))
    if (filteredDocs.length) specs.documents = filteredDocs
  }

  // SEO
  const seoDesc = `${p.name} chính hãng TOTO. Giá tốt nhất tại Đông Phú Gia, Đà Lạt.`.substring(0, 500)

  // Build slug
  let slug = slugify(p.name).substring(0, 185)
  if (!slug) slug = slugify(sku)

  // Check slug conflict (for new products)
  if (!existing) {
    const conflict = await prisma.products.findFirst({
      where: { category_id: classification.category_id, slug },
      select: { id: true },
    })
    if (conflict) {
      const skuPart = sku.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20)
      slug = `${slug}-${skuPart}`.substring(0, 200)
    }
  }

  const productData = {
    sku: sku.substring(0, 50),
    name: p.name.substring(0, 200),
    slug: existing ? undefined : slug.substring(0, 200), // Don't change slug on update
    category_id: classification.category_id,
    subcategory_id: classification.subcategory_id,
    ...(classification.product_type && { product_type: classification.product_type }),
    ...(classification.product_sub_type && { product_sub_type: classification.product_sub_type }),
    brand_id: brandId,
    description: p.description_html || null,
    price: p.price ? Math.round(p.price) : null,
    original_price: p.original_price ? Math.round(p.original_price) : null,
    online_discount_amount: p.online_discount_amount ? Math.round(p.online_discount_amount) : null,
    price_display: p.is_contact_price ? 'Liên hệ báo giá' : null,
    is_active: p.product_status !== 'discontinued',
    stock_status: p.product_status === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
    source_url: p.url,
    seo_title: p.name.substring(0, 200),
    seo_description: seoDesc,
    specs: Object.keys(specs).length ? specs : undefined,
    ...(p.warranty_months && { warranty_months: p.warranty_months }),
    // Note: origins → use origin_id FK, not text field
    ...(mainImageUrl && { image_main_url: mainImageUrl.substring(0, 1000) }),
  }

  if (DRY_RUN) {
    return { status: existing ? 'would_update' : 'would_create', sku }
  }

  if (existing) {
    // UPDATE existing product
    await prisma.products.update({
      where: { id: existing.id },
      data: productData,
    })

    // Update images (delete old + insert new)
    if (galleryImages.length > 0) {
      await prisma.product_images.deleteMany({ where: { product_id: existing.id } })
      await prisma.product_images.createMany({
        data: galleryImages.map((url, idx) => ({
          product_id: existing.id,
          image_url: url.substring(0, 1000),
          image_type: idx === 0 ? 'main' : 'gallery',
          sort_order: idx,
        })),
        skipDuplicates: true,
      })
    }

    return { status: 'updated', sku, id: existing.id }
  } else {
    // CREATE new product
    const created = await prisma.products.create({
      data: { ...productData, slug: slug.substring(0, 200), is_featured: false },
    })

    // Insert images
    if (galleryImages.length > 0) {
      await prisma.product_images.createMany({
        data: galleryImages.map((url, idx) => ({
          product_id: created.id,
          image_url: url.substring(0, 1000),
          image_type: idx === 0 ? 'main' : 'gallery',
          sort_order: idx,
        })),
        skipDuplicates: true,
      })
    }

    return { status: 'created', sku, id: created.id }
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('📦 TOTO Import — Phase 3')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  if (UPDATE_ONLY) console.log('   Update only: true')
  if (CREATE_ONLY) console.log('   Create only: true')
  if (LIMIT) console.log(`   Limit: ${LIMIT}`)
  console.log(`   Image map: ${Object.keys(imageUrlMap).length} URLs remapped`)
  console.log(`   Time: ${new Date().toISOString()}\n`)

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set')
    process.exit(1)
  }

  // Load enriched data
  if (!existsSync(PATHS.enriched)) {
    console.error('❌ toto-enriched.json not found')
    process.exit(1)
  }

  let products = JSON.parse(readFileSync(PATHS.enriched, 'utf-8'))
  // Filter to successfully crawled TOTO products
  // Also exclude navigation-link entries (all-caps names with no TOTO model code)
  products = products.filter(p =>
    p.crawl_status === 'success' &&
    p.name &&
    /toto/i.test(p.name) &&
    // Skip navigation links: entries where name is ALL uppercase Vietnamese
    // (e.g. "Vòi Hồ, Vòi Gắn Tường", "Phụ Kiện Sen Vòi")
    !/^[A-ZĐÀ-Ỹ\s,]+$/u.test(p.name.trim())
  )
  console.log(`📂 Loaded ${products.length} enriched TOTO products (nav links filtered)`)

  if (LIMIT) products = products.slice(0, LIMIT)

  const prisma = new PrismaClient()

  try {
    // Get TOTO brand_id
    const totoBrand = await prisma.brands.findFirst({
      where: { slug: 'toto' },
      select: { id: true },
    })
    if (!totoBrand) {
      console.error('❌ TOTO brand not found in DB')
      process.exit(1)
    }
    console.log(`   TOTO brand_id: ${totoBrand.id}`)

    const stats = {
      created: 0, updated: 0, exists_skip: 0, new_skip: 0,
      no_sku: 0, failed: 0, would_create: 0, would_update: 0,
    }
    const errors = []
    const startTime = Date.now()

    for (let i = 0; i < products.length; i++) {
      const p = products[i]
      if (i > 0 && i % 100 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
        console.log(`  [${i}/${products.length}] ${elapsed}m | created=${stats.created} updated=${stats.updated} failed=${stats.failed}`)
      }

      try {
        const result = await importProduct(prisma, p, totoBrand.id)
        stats[result.status] = (stats[result.status] || 0) + 1
      } catch (e) {
        stats.failed++
        if (errors.length < 20) {
          errors.push(`${p.hita_id} (${(p.name || '').substring(0, 40)}): ${e.message.substring(0, 100)}`)
        }
      }
    }

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
    console.log('\n' + '='.repeat(70))
    console.log('📊 IMPORT SUMMARY')
    console.log('='.repeat(70))
    if (DRY_RUN) {
      console.log(`  Would create:    ${stats.would_create}`)
      console.log(`  Would update:    ${stats.would_update}`)
    } else {
      console.log(`  Created (new):   ${stats.created}`)
      console.log(`  Updated:         ${stats.updated}`)
    }
    console.log(`  Exists (skip):   ${stats.exists_skip}`)
    console.log(`  New (skip):      ${stats.new_skip}`)
    console.log(`  No SKU:          ${stats.no_sku}`)
    console.log(`  Failed:          ${stats.failed}`)
    console.log(`  Time:            ${totalTime} minutes`)
    console.log('='.repeat(70))

    if (errors.length > 0) {
      console.log('\n  ⚠️ Errors (first 20):')
      errors.forEach(e => console.log(`    - ${e}`))
    }

    console.log('\n✅ Import complete! Next: audit-toto.mjs')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
