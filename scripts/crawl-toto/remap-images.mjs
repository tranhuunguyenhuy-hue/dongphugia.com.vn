/**
 * remap-images.mjs — Update product image URLs from HITA → DPG CDN
 *
 * Reads toto-image-map.json (produced by mirror-toto-images.mjs)
 * and updates all TOTO product image URLs in the database.
 *
 * This is safe to run multiple times — only updates URLs that have a mapping.
 *
 * Usage:
 *   node scripts/crawl-toto/remap-images.mjs              # update all
 *   node scripts/crawl-toto/remap-images.mjs --dry-run     # preview only
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { PATHS, loadEnv } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load env
loadEnv()

const DRY_RUN = process.argv.includes('--dry-run')

async function main() {
  console.log('🔄 TOTO Image URL Remap — Phase 2b')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`)
  console.log(`   Time: ${new Date().toISOString()}\n`)

  // Load image map
  if (!existsSync(PATHS.imageMap)) {
    console.error('❌ toto-image-map.json not found. Run mirror-toto-images.mjs first.')
    process.exit(1)
  }

  const imageUrlMap = JSON.parse(readFileSync(PATHS.imageMap, 'utf-8'))
  const mapSize = Object.keys(imageUrlMap).length
  console.log(`📂 Loaded ${mapSize} URL mappings`)

  if (mapSize === 0) {
    console.log('⚠️ No mappings found. Nothing to do.')
    process.exit(0)
  }

  const prisma = new PrismaClient()

  try {
    // Get all TOTO products with hita image URLs
    const totoProducts = await prisma.products.findMany({
      where: {
        brands: { slug: 'toto' },
        image_main_url: { contains: 'hita.com.vn' },
      },
      select: {
        id: true,
        sku: true,
        image_main_url: true,
      },
    })

    console.log(`   Found ${totoProducts.length} TOTO products with hita URLs\n`)

    const stats = { updated: 0, skipped: 0, no_mapping: 0 }

    // Phase A: Update main image URLs on products table
    for (const p of totoProducts) {
      const newUrl = imageUrlMap[p.image_main_url]
      if (!newUrl || newUrl === p.image_main_url) {
        stats.no_mapping++
        continue
      }

      if (!DRY_RUN) {
        await prisma.products.update({
          where: { id: p.id },
          data: { image_main_url: newUrl },
        })
      }
      stats.updated++
    }

    console.log(`   Products main_url: ${stats.updated} updated, ${stats.no_mapping} no mapping`)

    // Phase B: Update product_images table
    const hitaImages = await prisma.product_images.findMany({
      where: { image_url: { contains: 'hita.com.vn' } },
      select: { id: true, image_url: true },
    })

    console.log(`   Product images with hita URLs: ${hitaImages.length}`)

    let imgUpdated = 0, imgSkipped = 0
    for (const img of hitaImages) {
      const newUrl = imageUrlMap[img.image_url]
      if (!newUrl || newUrl === img.image_url) {
        imgSkipped++
        continue
      }

      if (!DRY_RUN) {
        await prisma.product_images.update({
          where: { id: img.id },
          data: { image_url: newUrl },
        })
      }
      imgUpdated++
    }

    console.log(`   Product images: ${imgUpdated} updated, ${imgSkipped} no mapping`)

    // Phase C: Update document URLs in specs JSON
    const docsProducts = await prisma.$queryRaw`
      SELECT id, specs FROM products
      WHERE brand_id = (SELECT id FROM brands WHERE slug = 'toto')
      AND specs::text LIKE '%hita.com.vn%'
    `

    let docsUpdated = 0
    for (const p of docsProducts) {
      if (!p.specs?.documents) continue
      let changed = false
      const updatedDocs = p.specs.documents.map(doc => {
        const newUrl = imageUrlMap[doc.url]
        if (newUrl && newUrl !== doc.url) {
          changed = true
          return { ...doc, url: newUrl }
        }
        return doc
      })

      if (changed && !DRY_RUN) {
        await prisma.products.update({
          where: { id: p.id },
          data: { specs: { ...p.specs, documents: updatedDocs } },
        })
        docsUpdated++
      } else if (changed) {
        docsUpdated++
      }
    }

    console.log(`   Document URLs in specs: ${docsUpdated} updated`)

    // Summary
    console.log('\n' + '='.repeat(60))
    console.log('📊 REMAP SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Product main URLs:  ${stats.updated} remapped`)
    console.log(`  Gallery images:     ${imgUpdated} remapped`)
    console.log(`  Document URLs:      ${docsUpdated} remapped`)
    console.log(`  Mode:               ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE ✅'}`)
    console.log('='.repeat(60))
    console.log('\n✅ Remap complete!')

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
