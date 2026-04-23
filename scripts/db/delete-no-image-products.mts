/**
 * Script: delete-no-image-products.mts
 * Purpose: Permanently delete products with no main image (image_main_url IS NULL)
 *
 * Usage:
 *   Preview:  npx tsx --env-file=.env.local scripts/db/delete-no-image-products.mts
 *   Execute:  DRY_RUN=false npx tsx --env-file=.env.local scripts/db/delete-no-image-products.mts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.env.DRY_RUN !== 'false'

async function main() {
    console.log('━'.repeat(60))
    console.log(`🗑️  Delete Products With No Image`)
    console.log(`   Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '🚀 EXECUTE (permanent delete)'}`)
    console.log('━'.repeat(60))

    // Tìm tất cả sản phẩm không có ảnh chính
    const targets = await prisma.products.findMany({
        where: { image_main_url: null },
        select: {
            id: true,
            sku: true,
            name: true,
            brands: { select: { name: true } },
            categories: { select: { name: true } },
        },
        orderBy: { id: 'asc' },
    })

    console.log(`\n🏷️  Products to delete (image_main_url IS NULL): ${targets.length}`)
    console.log('─'.repeat(60))
    for (const p of targets) {
        const brand = p.brands?.name ?? 'N/A'
        const cat = p.categories?.name ?? 'N/A'
        console.log(`   ID: ${String(p.id).padStart(5)} | SKU: ${p.sku.padEnd(20)} | [${brand}] ${p.name.substring(0, 45)}`)
        console.log(`          Category: ${cat}`)
    }

    console.log('\n' + '─'.repeat(60))
    console.log(`📊 Tổng: ${targets.length} sản phẩm sẽ bị XÓA VĨNH VIỄN`)
    console.log('   (Các bảng liên quan: product_images, quote_items, order_items sẽ cascade delete)')

    if (DRY_RUN) {
        console.log('\n⚠️  DRY RUN — chưa xóa gì.')
        console.log('   Để thực hiện, chạy:')
        console.log('   DRY_RUN=false npx tsx --env-file=.env.local scripts/db/delete-no-image-products.mts')
        await prisma.$disconnect()
        return
    }

    // Thực thi xóa — cascade sẽ tự xóa product_images, product_feature_values
    const ids = targets.map(p => p.id)
    const result = await prisma.products.deleteMany({
        where: { id: { in: ids } },
    })

    console.log(`\n✅ Đã xóa ${result.count} sản phẩm thành công!`)
    await prisma.$disconnect()
}

main().catch(e => {
    console.error('❌ Error:', e)
    prisma.$disconnect()
    process.exit(1)
})
