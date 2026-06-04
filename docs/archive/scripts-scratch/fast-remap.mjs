/**
 * fast-remap.mjs — Fast URL remap using batched transactions
 */
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { PrismaClient } from '@prisma/client'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PATHS = {
  imageMap: path.join(__dirname, '..', 'crawl-toto', 'output', 'toto-image-map.json')
}

async function main() {
  console.log('🔄 Fast Image URL Remap')
  
  if (!existsSync(PATHS.imageMap)) {
    console.error('❌ toto-image-map.json not found')
    process.exit(1)
  }

  const imageUrlMap = JSON.parse(readFileSync(PATHS.imageMap, 'utf-8'))
  console.log(`📂 Loaded ${Object.keys(imageUrlMap).length} URL mappings`)

  const prisma = new PrismaClient()

  try {
    // 1. PRODUCT IMAGES (Table: product_images)
    const hitaImages = await prisma.product_images.findMany({
      where: { image_url: { contains: 'hita.com.vn' } },
      select: { id: true, image_url: true },
    })

    console.log(`📸 Found ${hitaImages.length} product images with hita URLs`)
    
    let imgUpdates = []
    for (const img of hitaImages) {
      const newUrl = imageUrlMap[img.image_url]
      if (newUrl && newUrl !== img.image_url) {
        imgUpdates.push(
          prisma.product_images.update({
            where: { id: img.id },
            data: { image_url: newUrl },
          })
        )
      }
    }

    // Batch update product images
    if (imgUpdates.length > 0) {
      console.log(`   Executing ${imgUpdates.length} product_image updates...`)
      // Run in batches of 1000 to avoid limits
      for (let i = 0; i < imgUpdates.length; i += 1000) {
        await prisma.$transaction(imgUpdates.slice(i, i + 1000))
        process.stdout.write(`   ... batch ${Math.floor(i/1000) + 1} done\n`)
      }
    }
    console.log(`✅ Product images updated: ${imgUpdates.length}`)

    // 2. DOCUMENT URLs IN SPECS JSON (Table: products)
    const docsProducts = await prisma.$queryRaw`
      SELECT id, specs FROM products
      WHERE brand_id = (SELECT id FROM brands WHERE slug = 'toto')
      AND specs::text LIKE '%hita.com.vn%'
    `
    
    console.log(`📄 Found ${docsProducts.length} products with hita URLs in specs`)

    let docsUpdates = []
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

      if (changed) {
        docsUpdates.push(
          prisma.products.update({
            where: { id: p.id },
            data: { specs: { ...p.specs, documents: updatedDocs } },
          })
        )
      }
    }

    if (docsUpdates.length > 0) {
      console.log(`   Executing ${docsUpdates.length} products specs updates...`)
      for (let i = 0; i < docsUpdates.length; i += 1000) {
        await prisma.$transaction(docsUpdates.slice(i, i + 1000))
        process.stdout.write(`   ... batch ${Math.floor(i/1000) + 1} done\n`)
      }
    }
    console.log(`✅ Products specs updated: ${docsUpdates.length}`)

    // 3. MAIN URLs (Should be 0 since phase A finished, but double check)
    const mainImages = await prisma.products.findMany({
      where: { image_main_url: { contains: 'hita.com.vn' } },
      select: { id: true, image_main_url: true },
    })
    
    let mainUpdates = []
    for (const p of mainImages) {
      const newUrl = imageUrlMap[p.image_main_url]
      if (newUrl && newUrl !== p.image_main_url) {
        mainUpdates.push(
          prisma.products.update({
            where: { id: p.id },
            data: { image_main_url: newUrl },
          })
        )
      }
    }

    if (mainUpdates.length > 0) {
      console.log(`🖼️ Executing ${mainUpdates.length} main image updates...`)
      for (let i = 0; i < mainUpdates.length; i += 1000) {
        await prisma.$transaction(mainUpdates.slice(i, i + 1000))
      }
    }
    console.log(`✅ Products main_url updated: ${mainUpdates.length}`)

    console.log('\n🎉 ALL DONE FAST!')

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
