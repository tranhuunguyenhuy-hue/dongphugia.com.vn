/**
 * import-vietceramics.mjs — LEO-387 Phase 3
 * 
 * Đọc file gach-enriched.json và nạp vào DB.
 * Thực hiện:
 * 1. Upsert subcategories (gach-van-da-marble, vv)
 * 2. Auto-create Brands (dựa trên collection Name)
 * 3. Insert Products
 * 4. Insert Product_images
 */

import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../../.env.local') })

const DRY_RUN = process.argv.includes('--dry-run')
const INPUT_FILE = path.join(__dirname, 'gach-enriched.json')
const URL_MAP_FILE = path.join(__dirname, 'image-url-map-gach.json')

function loadUrlMap() {
  if (existsSync(URL_MAP_FILE)) {
    try {
      return JSON.parse(readFileSync(URL_MAP_FILE, 'utf-8'))
    } catch { return {} }
  }
  return {}
}

const CATEGORY_SLUG = 'gach-op-lat'

async function main() {
  console.log('🚀 LEO-387 Phase 3: Import Vietceramics DB')
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  if (!existsSync(INPUT_FILE)) {
    console.error(`❌ File không tồn tại: ${INPUT_FILE}`)
    process.exit(1)
  }

  const products = JSON.parse(readFileSync(INPUT_FILE, 'utf-8'))
  console.log(`📋 Loaded ${products.length} products to import.\n`)

  const prisma = new PrismaClient()

  try {
    // 1. Get Category
    const category = await prisma.categories.findUnique({
      where: { slug: CATEGORY_SLUG }
    })
    
    if (!category) {
      console.error(`❌ Không tìm thấy category "${CATEGORY_SLUG}". Vui lòng chạy seed category trước.`)
      process.exit(1)
    }

    // 2. Map Subcategories
    const subcats = await prisma.subcategories.findMany({
      where: { category_id: category.id }
    })
    const subcatMap = new Map(subcats.map(s => [s.slug, s.id]))

    // 3. Import
    let imported = 0
    let skipped = 0
    let failed = 0
    
    const urlMap = loadUrlMap()

    // Auto map Collection -> Brand ID
    const brandMap = new Map()

    for (let i = 0; i < products.length; i++) {
      const p = products[i]

      if (DRY_RUN) {
        imported++
        continue
      }

      try {
        // Upsert Brand
        let brandId = brandMap.get(p.collection)
        if (!brandId) {
          const brandSlug = p.collection
          // Kiểm tra db trước
          let dbBrand = await prisma.brands.findUnique({ where: { slug: brandSlug } })
          if (!dbBrand) {
            dbBrand = await prisma.brands.create({
              data: {
                name: p.collectionName,
                slug: brandSlug,
                description: `Thiết kế bộ sưu tập gạch ${p.collectionName} từ Vietceramics.`
              }
            })
          }
          brandId = dbBrand.id
          brandMap.set(p.collection, brandId)
        }

        const exists = await prisma.products.findUnique({ where: { sku: p.sku } })
        if (exists) {
          skipped++
          continue
        }

        const subcategoryId = subcatMap.get(p.subcategory)
        
        let seoDesc = `${p.name} thuộc bộ sưu tập ${p.collectionName}. Phân phối chính hãng tại Đông Phú Gia, Đà Lạt.`
        
        // Product
        const created = await prisma.products.create({
          data: {
            sku: p.sku.substring(0, 50),
            name: p.name.substring(0, 200),
            slug: p.slug.substring(0, 200),
            category_id: category.id,
            subcategory_id: subcategoryId,
            brand_id: brandId,
            description: p.description,
            price: p.price,
            price_display: p.price_display,
            is_active: p.is_active,
            is_new: p.is_new,
            is_featured: p.is_featured,
            stock_status: 'in_stock',
            seo_title: p.name.substring(0, 200),
            seo_description: seoDesc.substring(0, 500),
            specs: p.specs,
            image_main_url: p.imageMain ? (urlMap[p.imageMain] || p.imageMain).substring(0, 1000) : null
          }
        })

        // Images
        if (p.images && p.images.length > 0) {
          await prisma.product_images.createMany({
            data: p.images.map((img) => ({
              product_id: created.id,
              image_url: (urlMap[img.url] || img.url).substring(0, 1000),
              image_type: img.type,
              sort_order: img.sort_order
            }))
          })
        }

        imported++
      } catch (err) {
        failed++
        console.error(`❌ SKU ${p.sku} Error: ${err.message}`)
      }
    }

    console.log(`\n✅ Summary:`)
    console.log(`   - Imported: ${imported}`)
    console.log(`   - Skipped (Exist): ${skipped}`)
    console.log(`   - Failed: ${failed}`)

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
