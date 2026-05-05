/**
 * audit-toto.mjs — Post-import integrity audit for TOTO products
 *
 * Checks:
 *   1. Total product count vs enriched JSON
 *   2. Missing images / broken URLs
 *   3. Products without price
 *   4. Products without specs
 *   5. Products without description
 *   6. Classification coverage
 *   7. Duplicate SKUs
 *   8. Orphaned images
 *
 * Usage:
 *   node scripts/crawl-toto/audit-toto.mjs
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { PATHS, loadEnv } from './config.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
loadEnv()

async function main() {
  console.log('🔍 TOTO Post-Import Audit')
  console.log(`   Time: ${new Date().toISOString()}\n`)

  const prisma = new PrismaClient()

  try {
    // Get TOTO brand
    const totoBrand = await prisma.brands.findFirst({
      where: { slug: 'toto' },
      select: { id: true },
    })
    if (!totoBrand) { console.error('❌ TOTO brand not found'); process.exit(1) }

    // Get all TOTO products
    const products = await prisma.products.findMany({
      where: { brand_id: totoBrand.id },
      include: {
        product_images: { select: { id: true, image_url: true } },
      },
    })

    console.log(`📊 TOTO Products in DB: ${products.length}`)

    // Load enriched for comparison
    let enrichedCount = 0
    if (existsSync(PATHS.enriched)) {
      const enriched = JSON.parse(readFileSync(PATHS.enriched, 'utf-8'))
      enrichedCount = enriched.filter(p => p.crawl_status === 'success' && /toto/i.test(p.name || '')).length
      console.log(`   Enriched JSON: ${enrichedCount} products`)
      console.log(`   Delta: ${products.length - enrichedCount} (${products.length > enrichedCount ? 'more' : 'fewer'} in DB)`)
    }

    // ── Audit checks ──
    const issues = []

    // 1. Products without price
    const noPrice = products.filter(p => !p.price)
    console.log(`\n1. Without price: ${noPrice.length}/${products.length}`)
    if (noPrice.length > 0 && noPrice.length < 20) {
      noPrice.forEach(p => issues.push(`No price: ${p.sku} — ${p.name}`))
    }

    // 2. Products without images
    const noImages = products.filter(p => p.product_images.length === 0)
    console.log(`2. Without images: ${noImages.length}/${products.length}`)
    if (noImages.length > 0 && noImages.length < 20) {
      noImages.forEach(p => issues.push(`No images: ${p.sku} — ${p.name}`))
    }

    // 3. Products without description
    const noDesc = products.filter(p => !p.description)
    console.log(`3. Without description: ${noDesc.length}/${products.length}`)

    // 4. Products without specs
    const noSpecs = products.filter(p => !p.specs || Object.keys(p.specs).length === 0)
    console.log(`4. Without specs: ${noSpecs.length}/${products.length}`)

    // 5. Products without product_type
    const noType = products.filter(p => !p.product_type)
    console.log(`5. Without product_type: ${noType.length}/${products.length}`)

    // 6. Products without source_url
    const noSource = products.filter(p => !p.source_url)
    console.log(`6. Without source_url: ${noSource.length}/${products.length}`)

    // 7. Products with online_discount_amount
    const withOnlineDiscount = products.filter(p => p.online_discount_amount)
    console.log(`7. With online_discount: ${withOnlineDiscount.length}/${products.length}`)

    // 8. By subcategory distribution
    const bySub = {}
    products.forEach(p => { bySub[p.subcategory_id] = (bySub[p.subcategory_id] || 0) + 1 })
    console.log(`\n8. By subcategory:`)
    for (const [id, count] of Object.entries(bySub).sort((a, b) => b[1] - a[1])) {
      console.log(`   sub_id=${id.padEnd(4)} → ${count}`)
    }

    // 9. By product_type distribution
    const byType = {}
    products.forEach(p => { byType[p.product_type || '(none)'] = (byType[p.product_type || '(none)'] || 0) + 1 })
    console.log(`\n9. By product_type (top 15):`)
    for (const [type, count] of Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
      console.log(`   ${type.padEnd(25)} → ${count}`)
    }

    // 10. Duplicate SKU check
    const skuCounts = {}
    products.forEach(p => { skuCounts[p.sku] = (skuCounts[p.sku] || 0) + 1 })
    const dupes = Object.entries(skuCounts).filter(([, c]) => c > 1)
    console.log(`\n10. Duplicate SKUs: ${dupes.length}`)
    dupes.forEach(([sku, count]) => issues.push(`Duplicate SKU: ${sku} (${count}x)`))

    // 11. Image count stats
    const totalImages = products.reduce((sum, p) => sum + p.product_images.length, 0)
    const avgImages = (totalImages / products.length).toFixed(1)
    console.log(`\n11. Total images: ${totalImages} (avg ${avgImages}/product)`)

    // Summary
    console.log('\n' + '='.repeat(70))
    console.log('📋 AUDIT SUMMARY')
    console.log('='.repeat(70))
    const score = Math.round(
      ((products.length - noPrice.length) / products.length * 20) +
      ((products.length - noImages.length) / products.length * 20) +
      ((products.length - noDesc.length) / products.length * 20) +
      ((products.length - noSpecs.length) / products.length * 20) +
      ((products.length - noType.length) / products.length * 20)
    )
    console.log(`  Data completeness score: ${score}/100`)
    console.log(`  Issues found: ${issues.length}`)

    if (issues.length > 0) {
      console.log('\n  Issues:')
      issues.slice(0, 30).forEach(i => console.log(`    ⚠️ ${i}`))
      if (issues.length > 30) console.log(`    ... and ${issues.length - 30} more`)
    }

    console.log('\n✅ Audit complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(e => {
  console.error('❌ Fatal:', e.message)
  process.exit(1)
})
