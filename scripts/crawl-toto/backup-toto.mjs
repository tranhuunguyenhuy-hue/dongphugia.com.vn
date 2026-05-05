/**
 * backup-toto.mjs — Backup all TOTO product data before crawl import
 *
 * Creates a complete snapshot of all TOTO products, images, and relationships
 * to enable safe rollback if the import process fails.
 *
 * Usage:
 *   node scripts/crawl-toto/backup-toto.mjs
 *   node scripts/crawl-toto/backup-toto.mjs --restore toto-backup-2026-05-05.json
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, 'output')

// ─── ENV ─────────────────────────────────────────────────────────────────────
function loadEnv() {
  for (const envFile of ['.env.local', '.env']) {
    const envPath = path.join(__dirname, '../../', envFile)
    if (existsSync(envPath)) {
      const content = readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const val = match[2].trim().replace(/^["']|["']$/g, '')
          if (!process.env[key]) process.env[key] = val
        }
      }
      return
    }
  }
  throw new Error('No .env file found')
}

loadEnv()

// ─── PRISMA CLIENT ───────────────────────────────────────────────────────────
async function getPrisma() {
  const { PrismaClient } = await import('@prisma/client')
  return new PrismaClient()
}

// ─── BACKUP ──────────────────────────────────────────────────────────────────
async function backupToto() {
  const prisma = await getPrisma()

  try {
    console.log('📦 Backing up TOTO product data...\n')

    const brand = await prisma.brands.findFirst({ where: { slug: 'toto' } })
    if (!brand) {
      console.error('❌ Brand "toto" not found')
      return
    }

    // Fetch all TOTO products with related data
    const products = await prisma.products.findMany({
      where: { brand_id: brand.id },
      include: {
        product_images: true,
        parent_relationships: true,
        child_relationships: true,
      },
    })

    const backup = {
      created_at: new Date().toISOString(),
      brand_id: brand.id,
      total_products: products.length,
      total_images: products.reduce((sum, p) => sum + p.product_images.length, 0),
      total_relationships: products.reduce((sum, p) => sum + p.parent_relationships.length, 0),
      products: products.map(p => ({
        ...p,
        // Convert BigInt/Decimal safely for JSON
        price: p.price ? Number(p.price) : null,
        original_price: p.original_price ? Number(p.original_price) : null,
        online_discount_amount: p.online_discount_amount ? Number(p.online_discount_amount) : null,
      })),
    }

    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `toto-backup-${timestamp}.json`
    const filepath = path.join(OUTPUT_DIR, filename)
    writeFileSync(filepath, JSON.stringify(backup, null, 2))

    console.log('='.repeat(60))
    console.log('📊 BACKUP SUMMARY')
    console.log('='.repeat(60))
    console.log(`  Products:      ${backup.total_products}`)
    console.log(`  Images:        ${backup.total_images}`)
    console.log(`  Relationships: ${backup.total_relationships}`)
    console.log(`  File:          ${filename}`)
    console.log(`  Size:          ${(readFileSync(filepath).length / 1024 / 1024).toFixed(2)} MB`)
    console.log('='.repeat(60))
    console.log('\n✅ Backup complete!')
  } finally {
    await prisma.$disconnect()
  }
}

// ─── RESTORE ─────────────────────────────────────────────────────────────────
async function restoreToto(backupFile) {
  const filepath = path.join(OUTPUT_DIR, backupFile)
  if (!existsSync(filepath)) {
    console.error(`❌ Backup file not found: ${filepath}`)
    process.exit(1)
  }

  const prisma = await getPrisma()

  try {
    const backup = JSON.parse(readFileSync(filepath, 'utf-8'))
    console.log(`🔄 Restoring from ${backupFile}...`)
    console.log(`   Created: ${backup.created_at}`)
    console.log(`   Products: ${backup.total_products}`)

    // Safety check
    const currentCount = await prisma.products.count({
      where: { brand_id: backup.brand_id },
    })
    console.log(`   Current TOTO products in DB: ${currentCount}`)
    console.log('\n⚠️  This will OVERWRITE current TOTO data.')
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...')

    await new Promise(resolve => setTimeout(resolve, 5000))

    let restored = 0
    const BATCH_SIZE = 20

    for (let i = 0; i < backup.products.length; i += BATCH_SIZE) {
      const batch = backup.products.slice(i, i + BATCH_SIZE)

      await prisma.$transaction(async (tx) => {
        for (const p of batch) {
          const { product_images, parent_relationships, child_relationships, ...productData } = p
          // Remove fields that Prisma won't accept on upsert
          delete productData.search_vector

          await tx.products.upsert({
            where: { sku: productData.sku },
            update: {
              price: productData.price,
              original_price: productData.original_price,
              online_discount_amount: productData.online_discount_amount,
              description: productData.description,
              features: productData.features,
              specs: productData.specs,
              hita_product_id: productData.hita_product_id,
              source_url: productData.source_url,
              warranty_months: productData.warranty_months,
            },
            create: productData,
          })
          restored++
        }
      })

      if ((i + BATCH_SIZE) % 100 === 0 || i + BATCH_SIZE >= backup.products.length) {
        console.log(`  [${Math.min(i + BATCH_SIZE, backup.products.length)}/${backup.products.length}] restored`)
      }
    }

    console.log(`\n✅ Restored ${restored} products from backup.`)
  } finally {
    await prisma.$disconnect()
  }
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const restoreIdx = args.indexOf('--restore')

if (restoreIdx !== -1) {
  const backupFile = args[restoreIdx + 1]
  if (!backupFile) {
    console.error('Usage: node backup-toto.mjs --restore <filename>')
    process.exit(1)
  }
  restoreToto(backupFile).catch(e => { console.error('❌', e.message); process.exit(1) })
} else {
  backupToto().catch(e => { console.error('❌', e.message); process.exit(1) })
}
