/**
 * Script: check-placeholder-images.mts
 * Purpose: Find placeholder/spinner images in DB
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    const r = await prisma.$queryRaw<Array<{ image_url: string; cnt: bigint }>>`
        SELECT image_url, COUNT(*) as cnt FROM product_images
        WHERE image_url ILIKE '%loading%'
           OR image_url ILIKE '%spinner%'
           OR image_url ILIKE '%placeholder%'
           OR image_url ILIKE '%dang-cap-nhat%'
           OR image_url ILIKE '%no-image%'
           OR image_url ILIKE '%noimage%'
           OR image_url ILIKE '%default%'
           OR image_url ILIKE '%ajax-loader%'
        GROUP BY image_url ORDER BY cnt DESC
    `
    console.log('📦 Placeholder images in product_images:')
    console.log(r.map(x => `Count: ${x.cnt} | ${x.image_url}`).join('\n'))

    // Check products.image_main_url for placeholders
    const p = await prisma.$queryRaw<Array<{ image_main_url: string; cnt: bigint }>>`
        SELECT image_main_url, COUNT(*) as cnt FROM products
        WHERE image_main_url ILIKE '%dang-cap-nhat%'
           OR image_main_url ILIKE '%loading%'
           OR image_main_url ILIKE '%no-image%'
           OR image_main_url ILIKE '%default%'
           OR image_main_url ILIKE '%placeholder%'
        GROUP BY image_main_url ORDER BY cnt DESC
    `
    console.log('\n📦 Placeholder image_main_url in products:')
    console.log(p.map(x => `Count: ${x.cnt} | ${x.image_main_url}`).join('\n'))

    await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
