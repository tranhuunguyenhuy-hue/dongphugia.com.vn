/**
 * Script: find-placeholder-images.mts
 * Purpose: Find and display placeholder/loading-spinner images in product_images table
 * Usage: npx tsx --env-file=.env.local scripts/db/find-placeholder-images.mts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🔍 Scanning product_images for placeholder/suspect URLs...\n')

    // Get all distinct image URLs with count
    const allImages = await prisma.$queryRaw<Array<{ image_url: string; cnt: bigint }>>`
        SELECT image_url, COUNT(*) as cnt
        FROM product_images
        GROUP BY image_url
        ORDER BY cnt DESC
        LIMIT 50
    `

    console.log('📊 Top 50 most common image URLs in product_images:')
    console.log('─'.repeat(100))
    for (const row of allImages) {
        const count = Number(row.cnt)
        const marker = count > 5 ? '⚠️ ' : '   '
        console.log(`${marker}Count: ${String(count).padStart(5)} | URL: ${row.image_url.substring(0, 90)}`)
    }

    // Also check image_main_url and image_hover_url on products table
    console.log('\n\n📊 Top 30 most common image_main_url in products table:')
    console.log('─'.repeat(100))
    const mainUrls = await prisma.$queryRaw<Array<{ image_main_url: string | null; cnt: bigint }>>`
        SELECT image_main_url, COUNT(*) as cnt
        FROM products
        WHERE image_main_url IS NOT NULL
        GROUP BY image_main_url
        ORDER BY cnt DESC
        LIMIT 30
    `
    for (const row of mainUrls) {
        const count = Number(row.cnt)
        const marker = count > 3 ? '⚠️ ' : '   '
        console.log(`${marker}Count: ${String(count).padStart(5)} | URL: ${(row.image_main_url || '').substring(0, 90)}`)
    }

    // Total counts
    const totalImages = await prisma.product_images.count()
    const totalProducts = await prisma.products.count()
    console.log(`\n\n📈 Stats:`)
    console.log(`   Total product_images rows: ${totalImages}`)
    console.log(`   Total products: ${totalProducts}`)

    await prisma.$disconnect()
}

main().catch(e => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
})
