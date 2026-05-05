/**
 * merge-sources.mjs — Merge product URLs from category listing + existing DB
 *
 * Combines:
 * 1. toto-listing.json (from category-lister.mjs) — 259 SSR products
 * 2. Existing products in DB with source_url — 689 products
 *
 * This ensures we don't miss any products that Hita loads via AJAX
 * (which we can't get from static HTML).
 *
 * Usage:
 *   node scripts/crawl-toto/merge-sources.mjs
 *
 * Output: scripts/crawl-toto/output/toto-master-urls.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PATHS, loadEnv, extractHitaId } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

loadEnv()

async function main() {
  console.log('🔗 Merging product URL sources...\n')

  // Source 1: Category listing (SSR products)
  const listingPath = PATHS.listing
  let listingProducts = []
  if (existsSync(listingPath)) {
    listingProducts = JSON.parse(readFileSync(listingPath, 'utf-8'))
    console.log(`📂 Category listing: ${listingProducts.length} products`)
  } else {
    console.log('⚠️  No listing file found. Run category-lister.mjs first.')
  }

  // Source 2: Existing DB products with source_url
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  try {
    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!brand) {
      console.error('❌ Brand "toto" not found')
      return
    }

    const dbProducts = await prisma.products.findMany({
      where: { brand_id: brand.id },
      select: {
        id: true,
        sku: true,
        name: true,
        slug: true,
        source_url: true,
        hita_product_id: true,
        category_id: true,
        subcategory_id: true,
        price: true,
        image_main_url: true,
        subcategories: { select: { name: true } },
      },
    })
    console.log(`📦 DB products:       ${dbProducts.length} TOTO products`)

    const withSourceUrl = dbProducts.filter(p => p.source_url)
    console.log(`   With source_url:   ${withSourceUrl.length}`)

    // Merge: use hita_id as key for dedup
    const master = new Map()

    // Add DB products first (they have more context)
    for (const p of dbProducts) {
      const hitaId = p.hita_product_id || (p.source_url ? extractHitaId(p.source_url) : null)
      if (!hitaId) continue

      master.set(hitaId, {
        url: p.source_url || `https://hita.com.vn/sp-${hitaId}.html`,
        hita_id: hitaId,
        name: p.name,
        sku: p.sku,
        dpg_product_id: p.id,
        has_source_url: !!p.source_url,
        has_image: !!p.image_main_url,
        subcategory: p.subcategories?.name || null,
        source: 'db',
      })
    }

    // Add listing products (may have new products not in DB)
    let newFromListing = 0
    for (const p of listingProducts) {
      if (master.has(p.hita_id)) {
        // Enrich existing entry with listing data
        const existing = master.get(p.hita_id)
        if (!existing.has_source_url && p.url) {
          existing.url = p.url
          existing.has_source_url = true
        }
        if (!existing.name && p.name) {
          existing.name = p.name
        }
        existing.found_in_listing = true
      } else {
        // New product not in DB
        master.set(p.hita_id, {
          ...p,
          dpg_product_id: null,
          has_source_url: true,
          has_image: false,
          source: 'listing',
          found_in_listing: true,
        })
        newFromListing++
      }
    }

    const masterList = [...master.values()]

    // Save
    const masterPath = path.join(PATHS.output, 'toto-master-urls.json')
    writeFileSync(masterPath, JSON.stringify(masterList, null, 2))

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 MERGE SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Total master URLs:    ${masterList.length}`)
    console.log(`  From DB only:         ${masterList.filter(p => p.source === 'db' && !p.found_in_listing).length}`)
    console.log(`  From listing only:    ${newFromListing} (NEW — not in DB)`)
    console.log(`  From both:            ${masterList.filter(p => p.source === 'db' && p.found_in_listing).length}`)
    console.log(`  Without source_url:   ${masterList.filter(p => !p.has_source_url).length}`)
    console.log(`  Output:               output/toto-master-urls.json`)
    console.log('='.repeat(60))

    if (newFromListing > 0) {
      console.log(`\n🆕 ${newFromListing} NEW products found on Hita not yet in DPG DB!`)
      const newProducts = masterList.filter(p => p.source === 'listing' && !p.dpg_product_id)
      for (const p of newProducts.slice(0, 10)) {
        console.log(`   ${p.hita_id} | ${p.name || 'NO NAME'} | ${p.url}`)
      }
      if (newProducts.length > 10) console.log(`   ... and ${newProducts.length - 10} more`)
    }

    console.log('\n✅ Master URL list ready! Next: crawl-toto-pdp.mjs')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
