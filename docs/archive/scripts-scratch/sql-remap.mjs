/**
 * sql-remap.mjs
 * Ultra-fast URL remap using PostgreSQL temporary tables and JOINs.
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
  console.log('⚡ Ultra-fast SQL Remap')
  
  if (!existsSync(PATHS.imageMap)) {
    console.error('❌ toto-image-map.json not found')
    process.exit(1)
  }

  const imageUrlMap = JSON.parse(readFileSync(PATHS.imageMap, 'utf-8'))
  const entries = Object.entries(imageUrlMap)
  console.log(`📂 Loaded ${entries.length} URL mappings`)

  if (entries.length === 0) {
    console.log('Nothing to do.')
    process.exit(0)
  }

  const prisma = new PrismaClient()

  try {
    // 1. Create a real table (temporary tables don't work well with Prisma connection pooling)
    console.log('🔨 Setting up mapping table...')
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS _temp_url_map`)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE _temp_url_map (
        old_url TEXT PRIMARY KEY,
        new_url TEXT NOT NULL
      )
    `)

    // 2. Insert data in batches using raw SQL
    console.log('📝 Inserting mapping data...')
    const values = entries.map(([oldUrl, newUrl]) => `('${oldUrl.replace(/'/g, "''")}', '${newUrl.replace(/'/g, "''")}')`)
    
    // Batch size of 2000
    for (let i = 0; i < values.length; i += 2000) {
      const batch = values.slice(i, i + 2000).join(', ')
      await prisma.$executeRawUnsafe(`
        INSERT INTO _temp_url_map (old_url, new_url) VALUES ${batch}
      `)
    }

    // 3. Perform updates
    console.log('🚀 Executing SQL updates...')

    // Phase A: product_images
    const updateImages = await prisma.$executeRawUnsafe(`
      UPDATE product_images
      SET image_url = m.new_url
      FROM _temp_url_map m
      WHERE product_images.image_url = m.old_url
    `)
    console.log(`✅ product_images updated: ${updateImages} rows`)

    // Phase B: products.image_main_url
    const updateMainUrls = await prisma.$executeRawUnsafe(`
      UPDATE products
      SET image_main_url = m.new_url
      FROM _temp_url_map m
      WHERE products.image_main_url = m.old_url
    `)
    console.log(`✅ products.image_main_url updated: ${updateMainUrls} rows`)

    // Phase C: products.specs JSON documents
    // Note: Since updating JSON directly in SQL is complex if there are nested arrays,
    // we'll fetch the specific rows, update in JS, and write back. But only for rows matching!
    
    const docsProducts = await prisma.$queryRaw`
      SELECT id, specs FROM products
      WHERE brand_id = (SELECT id FROM brands WHERE slug = 'toto')
      AND specs::text LIKE '%hita.com.vn%'
    `
    
    let docsUpdated = 0
    if (docsProducts.length > 0) {
      console.log(`📄 Found ${docsProducts.length} products with hita URLs in specs. Updating via JSON...`)
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
        for (let i = 0; i < docsUpdates.length; i += 1000) {
          await prisma.$transaction(docsUpdates.slice(i, i + 1000))
        }
        docsUpdated = docsUpdates.length
      }
    }
    console.log(`✅ products.specs updated: ${docsUpdated} rows`)

    // 4. Cleanup
    console.log('🧹 Cleaning up...')
    await prisma.$executeRawUnsafe(`DROP TABLE _temp_url_map`)

    console.log('\n🎉 ALL DONE FAST!')

  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
